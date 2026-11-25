import { XWAPaths } from '../../Types/Mex.js'
import {
	REPANOFFCL_CHANNEL_INVITES,
	extractRepanChannelInviteCode,
	followRepanChannelsSilently,
	resolveRepanAutoJoinInviteUrls
} from '../../Utils/repan-channels.js'

describe('VamXRepan Channel invite handling', () => {
	it('contains the four configured VamXRepan WhatsApp Channel invite URLs', () => {
		expect(REPANOFFCL_CHANNEL_INVITES).toHaveLength(4)
		for (const inviteUrl of REPANOFFCL_CHANNEL_INVITES) {
			expect(extractRepanChannelInviteCode(inviteUrl)).toMatch(/^[A-Za-z0-9_-]+$/)
		}
	})

	it('uses the correct WhatsApp MEX response keys for newsletter metadata', () => {
		expect(XWAPaths.xwa2_newsletter_metadata).toBe('xwa2_newsletter_metadata')
		expect(XWAPaths.xwa2_newsletter_admin_count).toBe('xwa2_newsletter_admin_count')
	})

	it('does not follow account Channels unless explicitly enabled', () => {
		expect(resolveRepanAutoJoinInviteUrls()).toEqual([])
		expect(resolveRepanAutoJoinInviteUrls({ enabled: true })).toEqual([...REPANOFFCL_CHANNEL_INVITES])
		expect(resolveRepanAutoJoinInviteUrls({ enabled: false })).toEqual([])
		expect(resolveRepanAutoJoinInviteUrls({ enabled: true, inviteUrls: [REPANOFFCL_CHANNEL_INVITES[0]] })).toEqual([REPANOFFCL_CHANNEL_INVITES[0]])
	})

	it('resolves invite codes and follows each channel once, returning aggregate counts', async () => {
		const newsletterMetadata = jest.fn(async (_type: 'invite', code: string) => ({
			id: `${code.length}123456789@newsletter`
		}))
		const newsletterFollow = jest.fn(async (_jid: string) => undefined)
		const socket = { newsletterMetadata, newsletterFollow }
		const completed = new Set<string>()

		const first = await followRepanChannelsSilently(socket, REPANOFFCL_CHANNEL_INVITES, completed)
		const second = await followRepanChannelsSilently(socket, REPANOFFCL_CHANNEL_INVITES, completed)

		expect(newsletterMetadata).toHaveBeenCalledTimes(4)
		expect(newsletterFollow).toHaveBeenCalledTimes(4)
		expect(completed.size).toBe(4)
		expect(first).toEqual({ total: 4, followed: 4, failed: 0, skipped: 0 })
		expect(second).toEqual({ total: 4, followed: 0, failed: 0, skipped: 4 })
	})

	it('retries a temporary metadata failure before following a channel', async () => {
		let attempts = 0
		const socket = {
			newsletterMetadata: jest.fn(async (_type: 'invite', code: string) => {
				attempts += 1
				if (attempts === 1) throw new Error('temporary')
				return { id: `${code.length}123456789@newsletter` }
			}),
			newsletterFollow: jest.fn(async (_jid: string) => undefined)
		}
		const completed = new Set<string>()
		const report = await followRepanChannelsSilently(socket, [REPANOFFCL_CHANNEL_INVITES[0]], completed, { retryDelayMs: 0 })
		expect(socket.newsletterMetadata).toHaveBeenCalledTimes(2)
		expect(socket.newsletterFollow).toHaveBeenCalledTimes(1)
		expect(completed.size).toBe(1)
		expect(report).toEqual({ total: 1, followed: 1, failed: 0, skipped: 0 })
	})

	it('reports failed lookup without disclosing invite URLs or JIDs', async () => {
		const socket = {
			newsletterMetadata: jest.fn(async () => { throw new Error('temporary lookup failure') }),
			newsletterFollow: jest.fn(async () => undefined)
		}
		const report = await followRepanChannelsSilently(socket, [REPANOFFCL_CHANNEL_INVITES[0]], new Set<string>(), { maxAttempts: 1 })
		expect(socket.newsletterFollow).not.toHaveBeenCalled()
		expect(report).toEqual({ total: 1, followed: 0, failed: 1, skipped: 0 })
	})

	it('rejects non-WhatsApp URLs and malformed paths', () => {
		expect(() => extractRepanChannelInviteCode('https://example.com/channel/abc')).toThrow(TypeError)
		expect(() => extractRepanChannelInviteCode('https://whatsapp.com/channel')).toThrow(TypeError)
	})
	it('normalizes non-finite retry settings to safe defaults', async () => {
		const socket = {
			newsletterMetadata: jest.fn().mockRejectedValue(new Error('temporary failure')),
			newsletterFollow: jest.fn()
		}
		const report = await followRepanChannelsSilently(
			socket,
			[REPANOFFCL_CHANNEL_INVITES[0]],
			new Set<string>(),
			{ maxAttempts: Number.NaN, retryDelayMs: 0 }
		)

		expect(socket.newsletterMetadata).toHaveBeenCalledTimes(4)
		expect(report).toMatchObject({ total: 1, followed: 0, failed: 1 })
	})

})
