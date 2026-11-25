/** How much colour the terminal can show. `auto` inspects the stream and environment. */
export type RepanColorMode = 'auto' | 'truecolor' | '256' | 'basic' | 'none'

/** Gradient palette used for the artwork, typing effect and progress bar. */
export type RepanBannerTheme = 'aurora' | 'sunset' | 'neon' | 'ocean' | 'fire'

export type RepanStartupOptions = {
	/** Clear the current TTY before drawing the startup banner. Defaults to true. */
	clearBefore?: boolean
	/** Clear the current TTY after the completion message. Defaults to false. */
	clearAfter?: boolean
	/** Total animation duration in milliseconds (typing + reveal + progress). 0 disables all delays. Defaults to 1800. */
	durationMs?: number
	/** Override the output stream, primarily useful for tests. */
	stream?: NodeJS.WriteStream
	/** Typewriter effect for the caption lines. Defaults to true on a TTY. */
	typing?: boolean
	/** Colour depth. Defaults to `auto` (NO_COLOR / FORCE_COLOR / COLORTERM / TERM aware). */
	color?: RepanColorMode
	/** Gradient palette. Defaults to `aurora`. */
	theme?: RepanBannerTheme
}

/** Options for the reusable terminal typewriter effect. */
export type RepanTypingOptions = {
	/** Output stream. Defaults to stdout. */
	stream?: NodeJS.WriteStream
	/** Delay between Unicode characters. Defaults to 24ms on a TTY and 0 otherwise. */
	delayMs?: number
	/** Colour depth. Defaults to auto-detection. */
	color?: RepanColorMode
	/** Gradient palette. Defaults to aurora. */
	theme?: RepanBannerTheme
	/** Start and end positions in the selected gradient, each from 0 to 1. */
	from?: number
	to?: number
	/** Print the small cursor while characters are being typed. Defaults to true. */
	cursor?: boolean
	/** Apply bold styling. Defaults to false. */
	bold?: boolean
	/** Append a newline. Defaults to true. */
	newline?: boolean
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

type RGB = readonly [number, number, number]

const THEMES: Record<RepanBannerTheme, readonly RGB[]> = {
	aurora: [[0, 245, 212], [0, 187, 249], [155, 93, 229], [241, 91, 181]],
	sunset: [[255, 190, 11], [251, 86, 7], [255, 0, 110], [131, 56, 236]],
	neon: [[57, 255, 20], [0, 255, 255], [255, 0, 255], [255, 255, 0]],
	ocean: [[144, 224, 239], [0, 180, 216], [0, 119, 182], [3, 4, 94]],
	fire: [[255, 241, 118], [255, 183, 3], [251, 133, 0], [214, 40, 40]]
}

/** 16-colour fallback sequence (bright ANSI codes) for terminals without 256/true colour. */
const BASIC_CYCLE = [96, 94, 95, 91, 93, 92]

/** Block letters (ANSI-shadow style). Every glyph has 6 rows. */
const FONT: Record<string, readonly string[]> = {
	R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
	E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
	P: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
	A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
	N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
	B: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
	I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
	L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
	Y: ['██╗   ██╗', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚██╔╝  ', '   ██║   ', '   ╚═╝   '],
	S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
	V: ['██╗   ██╗', '██║   ██║', '██║   ██║', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚═══╝  '],
	M: ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
	X: ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝']
}
const GLYPH_ROWS = 6

/** Render a word as `GLYPH_ROWS` strings. Unknown characters become a blank gap. */
export const renderRepanAscii = (word: string): string[] =>
	Array.from({ length: GLYPH_ROWS }, (_, row) =>
		[...word]
			.map(letter => {
				const glyph = FONT[letter.toUpperCase()]
				if (!glyph) return '  '
				const width = Math.max(...glyph.map(line => line.length))
				return (glyph[row] ?? '').padEnd(width, ' ')
			})
			.join(' ')
			.replace(/\s+$/, '')
	)

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)

const gradientAt = (theme: readonly RGB[], t: number): RGB => {
	const clamped = Math.min(1, Math.max(0, t))
	const scaled = clamped * (theme.length - 1)
	const index = Math.min(theme.length - 2, Math.floor(scaled))
	const local = scaled - index
	const from = theme[index]!
	const to = theme[index + 1]!
	return [lerp(from[0], to[0], local), lerp(from[1], to[1], local), lerp(from[2], to[2], local)]
}

const to256 = ([r, g, b]: RGB) => 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5)

const detectColorMode = (stream: NodeJS.WriteStream, requested: RepanColorMode): Exclude<RepanColorMode, 'auto'> => {
	if (requested !== 'auto') return requested
	const env = process.env
	if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'none'
	const forced = env.FORCE_COLOR
	if (forced === '0' || forced === 'false') return 'none'
	if (!stream.isTTY && forced === undefined) return 'none'
	if (env.TERM === 'dumb') return 'none'
	const depth = typeof stream.getColorDepth === 'function' ? stream.getColorDepth() : 0
	if (depth >= 24) return 'truecolor'
	if (env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit') return 'truecolor'
	if (depth >= 8 || (env.TERM ?? '').includes('256color')) return '256'
	return 'basic'
}

const RESET = '\u001b[0m'
const BOLD = '\u001b[1m'
const DIM = '\u001b[2m'

/** Build a colouriser for the chosen mode. `position` is 0..1 along the theme gradient. */
const makePainter = (mode: Exclude<RepanColorMode, 'auto'>, theme: readonly RGB[]) => {
	const code = (position: number, strength = 1): string => {
		if (mode === 'none') return ''
		const [r, g, b] = gradientAt(theme, position)
		const rgb: RGB = [Math.round(r * strength), Math.round(g * strength), Math.round(b * strength)]
		if (mode === 'truecolor') return `\u001b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
		if (mode === '256') return `\u001b[38;5;${to256(rgb)}m`
		return `\u001b[${BASIC_CYCLE[Math.min(BASIC_CYCLE.length - 1, Math.floor(position * BASIC_CYCLE.length))]}m`
	}
	return {
		enabled: mode !== 'none',
		code,
		/** Colour each character of `text` along the gradient between `from` and `to`. */
		text: (text: string, from = 0, to = 1, bold = false) => {
			if (mode === 'none') return text
			const chars = [...text]
			const painted = chars
				.map((char, index) => (char === ' ' ? char : `${code(from + ((to - from) * index) / Math.max(1, chars.length - 1))}${char}`))
				.join('')
			return `${bold ? BOLD : ''}${painted}${RESET}`
		},
		solid: (text: string, r: number, g: number, b: number, bold = false) => {
			if (mode === 'none') return text
			const open =
				mode === 'truecolor'
					? `\u001b[38;2;${r};${g};${b}m`
					: mode === '256'
						? `\u001b[38;5;${to256([r, g, b])}m`
						: g > r && g > b
							? '\u001b[92m'
							: r > g
								? '\u001b[91m'
								: '\u001b[97m'
			return `${bold ? BOLD : ''}${open}${text}${RESET}`
		}
	}
}

/**
 * Print text with a per-character gradient typewriter effect.
 * Non-TTY output stays immediate; auto colour mode keeps redirected logs free of ANSI codes.
 */
export const typeRepanText = async (text: string, options: RepanTypingOptions = {}): Promise<void> => {
	const stream = options.stream ?? process.stdout
	const isTTY = Boolean(stream.isTTY)
	const theme = THEMES[options.theme ?? 'aurora'] ?? THEMES.aurora
	const painter = makePainter(detectColorMode(stream, options.color ?? 'auto'), theme)
	const requestedDelay = options.delayMs ?? (isTTY ? 24 : 0)
	const delayMs = Number.isFinite(requestedDelay) ? Math.max(0, Math.min(1_000, requestedDelay)) : (isTTY ? 24 : 0)
	const requestedFrom = options.from ?? 0
	const requestedTo = options.to ?? 1
	const from = Number.isFinite(requestedFrom) ? Math.min(1, Math.max(0, requestedFrom)) : 0
	const to = Number.isFinite(requestedTo) ? Math.min(1, Math.max(0, requestedTo)) : 1
	const bold = options.bold ?? false
	const newline = options.newline ?? true
	const animate = isTTY && delayMs > 0

	if (!animate) {
		stream.write(`${painter.text(text, from, to, bold)}${newline ? '\n' : ''}`)
		return
	}

	const chars = [...text]
	const showCursor = options.cursor ?? true
	if (showCursor) stream.write('▌')
	for (let index = 0; index < chars.length; index += 1) {
		const char = chars[index]!
		const position = from + ((to - from) * index) / Math.max(1, chars.length - 1)
		const painted = char === ' ' || !painter.enabled
			? char
			: `${bold ? BOLD : ''}${painter.code(position)}${char}${RESET}`
		if (showCursor) stream.write(`\b${painted}▌`)
		else stream.write(painted)
		await sleep(delayMs)
	}
	if (showCursor) stream.write('\b \b')
	if (newline) stream.write('\n')
}

/** Colour a block of ASCII rows with a diagonal gradient; the box-drawing "shadow" is dimmed. */
const paintArt = (rows: readonly string[], painter: ReturnType<typeof makePainter>): string[] => {
	if (!painter.enabled) return [...rows]
	const width = Math.max(1, ...rows.map(row => row.length))
	const span = width + rows.length * 2
	return rows.map((row, y) => {
		let out = ''
		for (let x = 0; x < row.length; x += 1) {
			const char = row[x]!
			if (char === ' ') {
				out += char
				continue
			}
			const position = (x + y * 2) / span
			out += `${painter.code(position, char === '█' ? 1 : 0.5)}${char}`
		}
		return `${BOLD}${out}${RESET}`
	})
}

const BAR_WIDTH = 32
const CAPTIONS = {
	version: 'VAMXREPAN BAILEYS 1.0.0  •  MESSAGE ENGINE',
	api: 'UNIFIED MESSAGE API  /  MEDIA  /  INTERACTIVE  /  PROTO',
	loading: 'INITIALIZING MESSAGE ROUTER, MEDIA PIPELINE & DIAGNOSTICS',
	done: 'SYSTEM READY  •  VAMXREPAN SOCKET ONLINE'
}

const FRAME_INNER_WIDTH = 58
const frameLine = (text: string) => `│ ${text.padEnd(FRAME_INNER_WIDTH)} │`
const BRAND_FRAME = [
	`╭${'─'.repeat(FRAME_INNER_WIDTH + 2)}╮`,
	frameLine('◈  VAMXREPAN  /  BAILEYS MESSAGE ENGINE  1.0.0'),
	frameLine('▸  UNIFIED API  •  TEXT / MEDIA / DOCUMENT / STICKER / PROTO'),
	`╰${'─'.repeat(FRAME_INNER_WIDTH + 2)}╯`
]

/** Display the VamXRepan Baileys terminal intro. It is never run on import. */
export const showRepanStartup = async (options: RepanStartupOptions = {}): Promise<void> => {
	const stream = options.stream ?? process.stdout
	const isTTY = Boolean(stream.isTTY)
	const clearBefore = options.clearBefore ?? true
	const clearAfter = options.clearAfter ?? false
	const requestedDuration = options.durationMs ?? 1800
	const durationMs = Number.isFinite(requestedDuration) ? Math.max(0, Math.min(15_000, requestedDuration)) : 1800
	const animate = isTTY && durationMs > 0
	const typing = options.typing ?? true
	const theme = THEMES[options.theme ?? 'aurora'] ?? THEMES.aurora
	const painter = makePainter(detectColorMode(stream, options.color ?? 'auto'), theme)
	const columns = typeof stream.columns === 'number' && stream.columns > 0 ? stream.columns : 80

	// Time budget: reveal 25 %, typing 35 %, progress bar 40 %.
	const revealDelay = animate ? (durationMs * 0.25) / (GLYPH_ROWS * 2) : 0
	const typedChars = CAPTIONS.version.length + CAPTIONS.api.length + CAPTIONS.loading.length
	const charDelay = animate && typing ? (durationMs * 0.35) / typedChars : 0
	const barDelay = animate ? (durationMs * 0.4) / 100 : 0

	const hideCursor = isTTY ? '\u001b[?25l' : ''
	const showCursor = isTTY ? '\u001b[?25h' : ''

	const typeLine = async (text: string, from: number, to: number, bold: boolean) =>
		typeRepanText(text, {
			stream,
			delayMs: animate && typing ? charDelay : 0,
			color: options.color ?? 'auto',
			theme: options.theme ?? 'aurora',
			from,
			to,
			bold
		})

	try {
		if (clearBefore && isTTY) stream.write('\u001b[2J\u001b[H')
		stream.write(hideCursor)
		stream.write('\n')

		// Keep at least two spare columns so Unicode borders never wrap in Termux.
		const wide = columns >= FRAME_INNER_WIDTH + 6
		if (wide) {
			for (const line of BRAND_FRAME) stream.write(`${painter.text(line, 0, 1, true)}\n`)
			for (const line of paintArt(renderRepanAscii('VAMX'), painter)) {
				stream.write(`${line}\n`)
				if (revealDelay > 0) await sleep(revealDelay)
			}
			stream.write(`${painter.text('BAILEYS  /  MESSAGE TRANSPORT CORE', 0.15, 0.85, true)}\n`)
		} else {
			// Narrow terminal: a compact one-line mark keeps the layout from wrapping.
			stream.write(`${painter.text('◢◤ VAMXREPAN / BAILEYS 1.0.0 ◥◣', 0, 1, true)}\n`)
		}

		await typeLine(CAPTIONS.version, 0, 1, true)
		await typeLine(CAPTIONS.api, 1, 0, true)
		await typeLine(CAPTIONS.loading, 0.15, 0.85, false)

		if (!isTTY) {
			stream.write(`${painter.text(`[${'█'.repeat(BAR_WIDTH)}] 100%`, 0, 1)}\n`)
			stream.write(`${painter.text(CAPTIONS.done, 0, 1, true)}\n`)
			return
		}

		const frames = 100
		for (let frame = 1; frame <= frames; frame += 1) {
			const filled = Math.max(1, Math.round((frame / frames) * BAR_WIDTH))
			let bar = ''
			for (let cell = 0; cell < BAR_WIDTH; cell += 1) {
				bar += cell < filled ? `${painter.code(cell / (BAR_WIDTH - 1))}█` : `${painter.enabled ? DIM : ''}░`
				if (painter.enabled) bar += RESET
			}
			const percent = `${String(frame).padStart(3, ' ')}%`
			stream.write(`\r${painter.solid('[', 160, 160, 160)}${bar}${painter.solid(']', 160, 160, 160)} ${painter.code(frame / frames)}${percent}${painter.enabled ? RESET : ''}`)
			if (frame < frames && barDelay > 0) await sleep(barDelay)
		}

		stream.write(`\n${painter.enabled ? `${painter.solid('✔ ', 80, 250, 123, true)}` : '✔ '}${painter.text(CAPTIONS.done, 0, 1, true)}\n`)
		if (clearAfter) {
			await sleep(animate ? 180 : 0)
			stream.write('\u001b[2J\u001b[H')
		}
	} finally {
		stream.write(showCursor)
	}
}

/** Preferred branded alias; the older export remains for compatibility. */
export const showVamXRepanStartup = showRepanStartup
