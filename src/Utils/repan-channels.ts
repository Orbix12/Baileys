import type { RepanAutoJoinChannelsConfig } from '../Types/index.js'

/** Official VamXRepan WhatsApp Channel invitation links. */
export const VAMXREPAN_CHANNEL_INVITES = Object.freeze([
	'https://whatsapp.com/channel/0029VbDZnTy1yT2AfO7bT109',
	'https://whatsapp.com/channel/0029Vb94TgY0lwgo7vzR263R',
	'https://whatsapp.com/channel/0029VbDc8oRBPzjQaw0dkY3k',
	'https://whatsapp.com/channel/0029VbE4mSkElagw09USeB0v'
] as const)

/** @deprecated Legacy alias retained for backwards compatibility. */
export const REPANOFFCL_CHANNEL_INVITES = VAMXREPAN_CHANNEL_INVITES

export type RepanNewsletterSocket = {
	newsletterMetadata: (type: 'invite', key: string) => Promise<{ id?: string } | null>
	newsletterFollow: (jid: string) => Promise<unknown>
}

export type RepanAutoJoinReport = {
	total: number
	followed: number
	failed: number
	skipped: number
}

/** Extract a WhatsApp Channel invite code from a canonical invite URL. */
export const extractRepanChannelInviteCode = (inviteUrl: string): string => {
	if (typeof inviteUrl !== 'string' || inviteUrl.length > 512) {
		throw new TypeError('Channel invitation must be a valid WhatsApp Channel URL')
	}

	let parsed: URL
	try {
		parsed = new URL(inviteUrl)
	} catch {
		throw new TypeError('Channel invitation must be a valid WhatsApp Channel URL')
	}

	if (
		parsed.protocol !== 'https:' ||
		!['whatsapp.com', 'www.whatsapp.com'].includes(parsed.hostname.toLowerCase())
	) {
		throw new TypeError('Channel invitation must use https://whatsapp.com/channel/<invite-code>')
	}

	const match = /^\/channel\/([A-Za-z0-9_-]+)\/?$/.exec(parsed.pathname)
	if (!match) {
		throw new TypeError('Channel invitation must use https://whatsapp.com/channel/<invite-code>')
	}

	return match[1]!
}

/**
 * The bundled publisher channels are followed only when explicitly enabled.
 * Pass enabled:true to opt in, or provide inviteUrls to replace the bundled list.
 */
export const resolveRepanAutoJoinInviteUrls = (
	config?: RepanAutoJoinChannelsConfig
): readonly string[] => {
	if (config?.enabled !== true) return []

	const inviteUrls = config.inviteUrls?.length ? [...config.inviteUrls] : [...REPANOFFCL_CHANNEL_INVITES]
	if (inviteUrls.length > 20) {
		throw new TypeError('repanAutoJoinChannels supports a maximum of 20 WhatsApp Channel URLs')
	}

	for (const inviteUrl of inviteUrls) extractRepanChannelInviteCode(inviteUrl)
	return inviteUrls
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Resolve invite codes to newsletter JIDs and follow sequentially. Each invite gets
 * a bounded retry window for transient MEX/network failures. The returned report
 * contains aggregate counts only; it never includes invite URLs or newsletter JIDs.
 */
export const followRepanChannelsSilently = async (
	socket: RepanNewsletterSocket,
	inviteUrls: readonly string[],
	completedInviteCodes: Set<string> = new Set<string>(),
	options: { maxAttempts?: number; retryDelayMs?: number } = {}
): Promise<RepanAutoJoinReport> => {
	const report: RepanAutoJoinReport = { total: inviteUrls.length, followed: 0, failed: 0, skipped: 0 }
	const requestedAttempts = options.maxAttempts ?? 3
	const requestedDelay = options.retryDelayMs ?? 800
	const maxAttempts = Number.isFinite(requestedAttempts)
		? Math.max(1, Math.min(4, Math.floor(requestedAttempts)))
		: 3
	const retryDelayMs = Number.isFinite(requestedDelay)
		? Math.max(0, Math.min(5_000, requestedDelay))
		: 800

	for (const inviteUrl of inviteUrls) {
		let inviteCode: string
		try {
			inviteCode = extractRepanChannelInviteCode(inviteUrl)
		} catch {
			report.failed += 1
			continue
		}

		if (completedInviteCodes.has(inviteCode)) {
			report.skipped += 1
			continue
		}

		let succeeded = false
		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			try {
				const metadata = await socket.newsletterMetadata('invite', inviteCode)
				const newsletterJid = metadata?.id
				if (!newsletterJid || !/^\d+@newsletter$/.test(newsletterJid)) {
					throw new Error('Channel invite did not resolve to a newsletter JID')
				}

				await socket.newsletterFollow(newsletterJid)
				completedInviteCodes.add(inviteCode)
				report.followed += 1
				succeeded = true
				break
			} catch {
				if (attempt < maxAttempts && retryDelayMs > 0) {
					await sleep(retryDelayMs * attempt)
				}
			}
		}

		if (!succeeded) report.failed += 1
	}

	return report
}
