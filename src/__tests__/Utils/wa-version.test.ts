import { fetchLatestBaileysVersion, fetchLatestWaWebVersion } from '../../Utils/generics.js'

describe('version discovery helpers', () => {
	afterEach(() => {
		jest.restoreAllMocks()
	})

	it('parses the Baileys version declaration without relying on a fixed source line', async () => {
		const source = [
			'// header',
			'/* moved by an upstream edit */',
			'export const metadata = true',
			'const version = [2, 3000, 1234567890] as const'
		].join('\n')
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(source, { status: 200 }))

		const result = await fetchLatestBaileysVersion({ timeoutMs: 1500 })
		expect(result.isLatest).toBe(true)
		expect(result.version).toEqual([2, 3000, 1234567890])
	})

	it('parses a quoted WhatsApp Web client_revision from the service worker', async () => {
		const source = '/* service worker */ self.config = {"client_revision":"1234567890"};'
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(source, { status: 200 }))

		const result = await fetchLatestWaWebVersion({ timeoutMs: 1500 })
		expect(result.isLatest).toBe(true)
		expect(result.version).toEqual([2, 3000, 1234567890])
	})

	it('returns the bundled version rather than accepting a malformed client revision', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('self.config = {"client_revision":"not-a-number"};', { status: 200 })
		)

		const result = await fetchLatestWaWebVersion({ timeoutMs: 1500 })
		expect(result.isLatest).toBe(false)
		expect(result.version).toHaveLength(3)
		expect(result.error).toBeInstanceOf(Error)
	})

	it('returns the bundled version when the remote endpoint rejects the request', async () => {
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }))

		const result = await fetchLatestBaileysVersion({ timeoutMs: 1500 })
		expect(result.isLatest).toBe(false)
		expect(result.version).toHaveLength(3)
		expect(result.error).toBeInstanceOf(Error)
	})
})
