import { showRepanStartup, typeRepanText } from '../../Utils/repan-banner.js'

const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '')

describe('VAMXREPAN BAILEYS startup banner', () => {
	it('prints the branded screen and clears an interactive terminal after 1–100%', async () => {
		const chunks: string[] = []
		const stream = {
			isTTY: true,
			write: (chunk: string) => {
				chunks.push(chunk)
				return true
			}
		} as unknown as NodeJS.WriteStream

		await showRepanStartup({ stream, durationMs: 0, clearAfter: true })
		const raw = chunks.join('')
		const output = stripAnsi(raw)

		expect(output).toContain('██████╗')
		expect(output).toContain('BAILEYS')
		expect(output).toContain('VAMXREPAN BAILEYS 1.0.0')
		expect(output).toContain('UNIFIED MESSAGE API  /  MEDIA  /  INTERACTIVE  /  PROTO')
		expect(output).toContain('INITIALIZING MESSAGE ROUTER, MEDIA PIPELINE & DIAGNOSTICS')
		expect(output).toContain('  1%')
		expect(output).toContain('100%')
		expect(output).toContain('SYSTEM READY')
		expect(output).toContain('BAILEYS MESSAGE ENGINE')
		expect(output).toContain('MESSAGE TRANSPORT CORE')
		expect(output).toContain('◈  VAMXREPAN  /  BAILEYS MESSAGE ENGINE  1.0.0')
		expect(raw).toContain('\u001b[2J\u001b[H')
	})
})


describe('VAMXREPAN BAILEYS startup banner defaults', () => {
	it('keeps the ASCII artwork visible and allows clear-before to be disabled', async () => {
		const chunks: string[] = []
		const stream = {
			isTTY: true,
			write: (chunk: string) => {
				chunks.push(chunk)
				return true
			}
		} as unknown as NodeJS.WriteStream

		await showRepanStartup({ stream, durationMs: 0, clearBefore: false })
		const raw = chunks.join('')
		expect(stripAnsi(raw)).toContain('╚═╝')
		expect(stripAnsi(raw)).toContain('VAMXREPAN BAILEYS 1.0.0')
		expect(stripAnsi(raw)).toContain('VAMXREPAN')
		expect(raw).not.toContain('\u001b[2J\u001b[H')
	})
})

describe('VAMXREPAN BAILEYS startup banner colour and typing', () => {
	const makeStream = (extra: Record<string, unknown> = {}) => {
		const chunks: string[] = []
		const stream = {
			isTTY: true,
			columns: 100,
			write: (chunk: string) => {
				chunks.push(chunk)
				return true
			},
			...extra
		} as unknown as NodeJS.WriteStream
		return { chunks, stream }
	}

	it('paints a truecolor gradient when requested and always restores the cursor', async () => {
		const { chunks, stream } = makeStream()
		await showRepanStartup({ stream, durationMs: 0, color: 'truecolor', theme: 'neon' })
		const output = chunks.join('')
		expect(output).toMatch(/\u001b\[38;2;\d+;\d+;\d+m/)
		expect(output.startsWith('\u001b[?25l')).toBe(true)
		expect(output.endsWith('\u001b[?25h')).toBe(true)
	})

	it('bounds invalid and excessively long animation durations', async () => {
		jest.useFakeTimers()
		const { chunks, stream } = makeStream()
		const rendered = showRepanStartup({ stream, durationMs: Number.POSITIVE_INFINITY, typing: false })
		await jest.advanceTimersByTimeAsync(15_000)
		await rendered
		expect(stripAnsi(chunks.join(''))).toContain('SYSTEM READY')
		jest.useRealTimers()
	})

	it('emits no colour codes for color:none and for non-TTY streams', async () => {
		const plain = makeStream()
		await showRepanStartup({ stream: plain.stream, durationMs: 0, color: 'none' })
		expect(plain.chunks.join('')).not.toMatch(/\u001b\[3[0-9]/)

		const piped = makeStream({ isTTY: false })
		await showRepanStartup({ stream: piped.stream })
		const text = piped.chunks.join('')
		expect(text).not.toContain('\u001b')
		expect(text).toContain('SYSTEM READY')
	})

	it('types caption characters one by one when animated', async () => {
		const { chunks, stream } = makeStream()
		await showRepanStartup({ stream, durationMs: 40, color: 'none' })
		const typed = chunks.filter(chunk => chunk.startsWith('\b') && chunk.endsWith('▌'))
		expect(typed.length).toBeGreaterThan(40)
	})

	it('sanitizes non-finite gradient positions in the reusable typewriter', async () => {
		const { chunks, stream } = makeStream()
		await typeRepanText('REPAN', { stream, delayMs: 0, color: 'truecolor', from: Number.NaN, to: Number.POSITIVE_INFINITY })
		const output = chunks.join('')
		expect(stripAnsi(output)).toContain('REPAN')
		expect(output).not.toContain('NaN')
	})

	it('falls back to a compact mark on narrow terminals', async () => {
		const { chunks, stream } = makeStream({ columns: 40 })
		await showRepanStartup({ stream, durationMs: 0, color: 'none' })
		const output = chunks.join('')
		expect(output).toContain('◢◤ VAMXREPAN / BAILEYS 1.0.0 ◥◣')
		expect(output).not.toContain('██████╗')
	})

	it('keeps the wide logo from wrapping on medium-width terminals', async () => {
		const { chunks, stream } = makeStream({ columns: 60 })
		await showRepanStartup({ stream, durationMs: 0, color: 'none' })
		const output = chunks.join('')
		expect(output).toContain('◢◤ VAMXREPAN / BAILEYS 1.0.0 ◥◣')
		expect(output).not.toContain('██████╗')
	})

	it('uses the framed wordmark only when the complete frame fits', async () => {
		const narrow = makeStream({ columns: 63 })
		await showRepanStartup({ stream: narrow.stream, durationMs: 0, color: 'none' })
		expect(narrow.chunks.join('')).toContain('◢◤ VAMXREPAN / BAILEYS 1.0.0 ◥◣')

		const wide = makeStream({ columns: 64 })
		await showRepanStartup({ stream: wide.stream, durationMs: 0, color: 'none' })
		const frameLines = stripAnsi(wide.chunks.join('')).split('\n').filter(line => /^[╭│╰]/.test(line))
		expect(frameLines).toHaveLength(4)
		expect(frameLines[0]).toBe('╭' + '─'.repeat(60) + '╮')
		expect(frameLines.every(line => line.length === 62)).toBe(true)
	})

	it('exports a reusable coloured typewriter for arbitrary terminal text', async () => {
		const { chunks, stream } = makeStream()
		await typeRepanText('REPAN CORE', {
			stream,
			delayMs: 1,
			color: 'truecolor',
			theme: 'ocean',
			bold: true
		})
		const output = chunks.join('')
		expect(output.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '').replace(/[\b▌]/g, '')).toContain('REPAN CORE')
		expect(output).toMatch(/\u001b\[38;2;\d+;\d+;\d+m/)
		expect(output).toContain('▌')
	})
})
