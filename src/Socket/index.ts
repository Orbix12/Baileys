import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js'
import type { UserFacingSocketConfig } from '../Types/index.js'
import {
	followRepanChannelsSilently,
	extractRepanChannelInviteCode,
	resolveRepanAutoJoinInviteUrls
} from '../Utils/repan-channels.js'
import { makeCommunitiesSocket } from './communities.js'
import { showRepanStartup } from '../Utils/repan-banner.js'
import { VamXRepanMessage } from '../Utils/vamxrepan-message.js'

// Keep successful follows across socket recreation within the same process/auth state.
const followedChannelsByAuth = new WeakMap<object, Set<string>>()
let startupBannerShown = false

// export the last socket layer
const makeWASocket = (config: UserFacingSocketConfig) => {
	// Show the startup artwork once per process when the first socket is created.
	// Importing the package remains side-effect free; no terminal is cleared.
	if (!startupBannerShown && process.env.VAMXREPAN_STARTUP_SHOWN !== '1' && process.env.REPANN_BAILS_STARTUP_SHOWN !== '1') {
		startupBannerShown = true
		void showRepanStartup({ clearBefore: true, clearAfter: false, durationMs: 1100, typing: true }).catch(() => undefined)
	}
	const { repanAutoJoinChannel, repanAutoJoinChannels, ...socketOptions } = config
	const newConfig = {
		...DEFAULT_CONNECTION_CONFIG,
		...socketOptions
	}

	// Channel follows are an account-side change and require explicit opt-in.
	const channelInviteUrls = resolveRepanAutoJoinInviteUrls(repanAutoJoinChannels)
	const legacyChannelJid = repanAutoJoinChannel?.enabled ? repanAutoJoinChannel.jid.trim() : ''
	if (legacyChannelJid && !/^\d+@newsletter$/.test(legacyChannelJid)) {
		throw new TypeError('repanAutoJoinChannel.jid must be a WhatsApp newsletter JID ending in @newsletter')
	}

	const socket = makeCommunitiesSocket(newConfig)
	// One public message facade per socket. relayMessage stays the private transport.
	const VamXRepan = Object.assign(socket, { Message: new VamXRepanMessage(socket) })
	if (channelInviteUrls.length > 0 || legacyChannelJid) {
		let joining = false
		const authKey = config.auth as object
		let completed = followedChannelsByAuth.get(authKey)
		if (!completed) {
			completed = new Set<string>()
			followedChannelsByAuth.set(authKey, completed)
		}

		socket.ev.on('connection.update', update => {
			if (update.connection !== 'open' || joining) return
			const hasPendingLegacy = Boolean(legacyChannelJid && !completed!.has(`jid:${legacyChannelJid}`))
			const hasPendingInvites = channelInviteUrls.some(url => {
				try {
					return !completed!.has(extractRepanChannelInviteCode(url))
				} catch {
					return false
				}
			})
			if (!hasPendingLegacy && !hasPendingInvites) return

			joining = true
			void (async () => {
				if (hasPendingLegacy) {
					try {
						await socket.newsletterFollow(legacyChannelJid)
						completed!.add(`jid:${legacyChannelJid}`)
					} catch {
						// Auto-follow is intentionally silent; socket startup must stay quiet.
					}
				}

				if (channelInviteUrls.length > 0) {
					await followRepanChannelsSilently(socket, channelInviteUrls, completed!)
				}
			})()
				.catch(() => undefined)
				.finally(() => {
					joining = false
				})
		})
	}

	return VamXRepan
}

export { makeWASocket as VamXRepan }
export default makeWASocket
