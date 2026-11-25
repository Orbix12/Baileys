import { proto } from '../../WAProto/index.js'
import type {
	AnyMediaMessageContent,
	AnyMessageContent,
	AlbumMessageOptions,
	ButtonReplyInfo,
	EventMessageOptions,
	GroupInviteInfo,
	MessageUpsertType,
	MessageRelayOptions,
	MiscMessageGenerationOptions,
	PollMessageOptions,
	WAContextInfo,
	WAMediaUpload,
	WAMediaUploadFunction,
	WAMessage,
	WAMessageKey,
	WALocationMessage,
	WAUrlInfo,
	WASendableProduct
} from '../Types/index.js'
import { prepareWAMessageMedia } from './messages.js'
import { planRepanDelivery } from './repan-delivery.js'
import { normalizeRelayMessage } from './message-relay.js'

/** Minimal socket contract accepted by the VamXRepan and legacy Repan message helpers. */
export type RepanMessageSocket = {
	sendMessage: (
		jid: string,
		content: AnyMessageContent,
		options?: MiscMessageGenerationOptions
	) => Promise<WAMessage | undefined>
	relayMessage?: (jid: string, content: proto.IMessage, options: MessageRelayOptions) => Promise<string | void>
	/** Uploads encrypted media using the socket's authenticated WhatsApp media connection. */
	waUploadToServer?: WAMediaUploadFunction
}

/** Native message payload aliases exposed under the Repan/Vam API names. */
export type VamMessageContent = AnyMessageContent
export type RepanMessageContent = AnyMessageContent
export type RichMessageContent = Extract<AnyMessageContent, { text: string }>
export type LexzyMessageContent = proto.IMessage

export type VamTextContentOptions = {
	mentions?: string[]
	contextInfo?: WAContextInfo
	linkPreview?: WAUrlInfo | null
}

export type VamMediaContentOptions = {
	caption?: string
	mimetype?: string
	fileName?: string
	jpegThumbnail?: string
	gifPlayback?: boolean
	ptt?: boolean
	ptv?: boolean
	seconds?: number
	isAnimated?: boolean
	width?: number
	height?: number
	mentions?: string[]
	contextInfo?: WAContextInfo
}

/**
 * Discriminated media input for the short `media()` / `sendMedia()` entry points.
 * Audio deliberately has no caption field because WhatsApp's audio message schema
 * does not render captions; use `text()` separately when a caption is required.
 */
export type RepanMediaInput =
	| { type: 'image'; media: WAMediaUpload; options?: VamMediaContentOptions }
	| { type: 'video'; media: WAMediaUpload; options?: VamMediaContentOptions }
	| { type: 'audio'; media: WAMediaUpload; options?: Pick<VamMediaContentOptions, 'mimetype' | 'ptt' | 'seconds'> }
	| { type: 'document'; media: WAMediaUpload; options?: VamMediaContentOptions }
	| { type: 'sticker'; media: WAMediaUpload; options?: Pick<VamMediaContentOptions, 'isAnimated' | 'width' | 'height'> }

/** Native Flow actions supported by the WhatsApp interactive-message schema. */
export type VamFlowButton =
	| { type?: 'quick_reply'; id: string; label: string; description?: string; icon?: string }
	| { type: 'url'; label: string; url: string; merchantUrl?: string; icon?: string }
	| { type: 'call'; label: string; phoneNumber: string; icon?: string }
	| { type: 'copy'; label: string; copyCode: string; icon?: string }
	/** Native single-select menu (opens a bottom sheet with sections/rows). Must be the only button. */
	| { type: 'select'; label: string; sections: readonly RepanMenuSection[]; icon?: string }

export type VamFlowAttachment =
	| { type: 'image'; media: WAMediaUpload; mimetype?: string; caption?: string }
	| { type: 'video'; media: WAMediaUpload; mimetype?: string; caption?: string; gifPlayback?: boolean }
	| { type: 'document'; media: WAMediaUpload; mimetype?: string; fileName?: string; caption?: string }

/**
 * relayMessage options for interactive payloads. `quoted` replies to a message the same way
 * sendMessage() does, even though interactive payloads are relayed through the Repan delivery lane.
 */
export type RepanRelayOptions = MessageRelayOptions & { quoted?: WAMessage }

/** relay options plus the media upload timeout used by attachment flows. */
export type VamInteractiveSendOptions = RepanRelayOptions & Pick<MiscMessageGenerationOptions, 'mediaUploadTimeoutMs'>

export type VamDocumentButtonOptions = {
	mimetype?: string
	fileName?: string
	caption?: string
}

export type VamFlowOptions = {
	header?: string
	body: string
	footer?: string
	buttons: readonly VamFlowButton[]
	contextInfo?: WAContextInfo
}

/**
 * Branded, compact action-deck API. The builder maps to WhatsApp Native Flow so
 * recipient clients can render and return supported actions. It is a new library
 * API, not a new proprietary WhatsApp wire format or a promise of custom client UI.
 */
export type RepanActionDeckOptions = {
	header?: string
	body: string
	footer?: string
	actions: readonly VamFlowButton[]
	contextInfo?: WAContextInfo
	/** Optional image/video/document header; audio is sent with `media()` instead. */
	attachment?: VamFlowAttachment
}

/** Per-card media for Lexzy's native horizontal carousel. */
export type LexzyCarouselMedia =
	| { type: 'image'; media: WAMediaUpload; mimetype?: string }
	| { type: 'video'; media: WAMediaUpload; mimetype?: string; gifPlayback?: boolean }

export type LexzyCarouselCard = {
	id: string
	title: string
	subtitle?: string
	body: string
	footer?: string
	/** Optional image/video header uploaded separately for this card. */
	media?: LexzyCarouselMedia
	/** Per-card actions: quick reply, URL, call, or copy-code. */
	buttons?: readonly VamFlowButton[]
}

export type LexzyCarouselOptions = {
	header?: string
	body: string
	footer?: string
	cards: readonly LexzyCarouselCard[]
	contextInfo?: WAContextInfo
}

export type LexzyCarouselSendOptions = VamInteractiveSendOptions

export type RepanPanelBlock =
	| { type: 'note'; text: string }
	| { type: 'metric'; label: string; value: string | number; detail?: string }
	| { type: 'status'; label: string; value: string; level: 'success' | 'warning' | 'info' | 'danger' }
	| { type: 'progress'; label: string; current: number; max: number; suffix?: string }
	| { type: 'fields'; rows: readonly { label: string; value: string | number }[] }
	| { type: 'timeline'; items: readonly { time: string; label: string; detail?: string }[] }
	| { type: 'list'; title?: string; items: readonly string[]; ordered?: boolean }
	| { type: 'quote'; text: string }
	| { type: 'divider' }

/**
 * `card` (default) draws a framed card with icons; `plain` keeps the original flat text layout,
 * which is the safest choice for clients that render exotic box-drawing glyphs poorly.
 */
export type RepanPanelStyle = 'card' | 'plain'

export type RepanPanelOptions = {
	title: string
	subtitle?: string
	blocks: readonly RepanPanelBlock[]
	footer?: string
	style?: RepanPanelStyle
}

/** A selectable row inside Repan's native WhatsApp list menu. */
export type RepanMenuRow = {
	id: string
	title: string
	description?: string
}

export type RepanMenuSection = {
	title?: string
	rows: readonly RepanMenuRow[]
}

/** Uses WhatsApp's listMessage wire type, not Native Flow or carousel. */
export type RepanMenuOptions = {
	title: string
	description: string
	buttonText?: string
	footer?: string
	sections: readonly RepanMenuSection[]
	contextInfo?: WAContextInfo
}

export type RepanDashboardOptions = RepanPanelOptions & {
	buttonText?: string
	sections: readonly RepanMenuSection[]
	contextInfo?: WAContextInfo
}

/** Classic response buttons are kept as a separate legacy-compatible wire type. */
export type RepanButtonMessageOptions = {
	header?: string
	text: string
	footer?: string
	buttons: readonly { id: string; label: string }[]
	contextInfo?: WAContextInfo
	/** Optional uploaded image/video/document shown above the buttons. */
	attachment?: VamFlowAttachment
	mediaUploadTimeoutMs?: number
}

/** Modern Native Flow select menu: one button that opens a sheet of sections and rows. */
export type RepanSelectOptions = {
	header?: string
	body: string
	footer?: string
	buttonText: string
	sections: readonly RepanMenuSection[]
	contextInfo?: WAContextInfo
	/** Optional uploaded image/video/document header. */
	attachment?: VamFlowAttachment
}

/** Anything RepanMessage.auto() accepts: ordinary content or an already-built protobuf message. */
export type RepanAutoContent = AnyMessageContent | proto.IMessage
export type RepanAutoOptions = MiscMessageGenerationOptions & RepanRelayOptions

/**
 * RepanPler is an opt-in sender-echo filter for bot-side event handlers.
 * It does not remove, conceal, or unsend a message in WhatsApp clients.
 */
export type RepanPlerOptions = {
	RepanPler?: boolean
}

/** Minimal shape of the Baileys messages.upsert event used by the RepanPler filter. */
export type RepanPlerUpsertEvent = {
	messages: WAMessage[]
	type: MessageUpsertType
	requestId?: string
}

/**
 * Filter messages sent by this account (`key.fromMe === true`) from a bot-side
 * messages.upsert handler. Recipients still receive ordinary WhatsApp messages.
 * The helper returns the original event unchanged while disabled.
 */
export const filterRepanPlerUpsert = <T extends RepanPlerUpsertEvent>(event: T, enabled = true): T => {
	if (!enabled) return event
	return {
		...event,
		messages: event.messages.filter(message => message.key.fromMe !== true)
	} as T
}

/** True when a message should be processed by the sender-side bot handler. */
export const isRepanPlerVisibleMessage = (message: WAMessage, enabled = true): boolean =>
	!enabled || message.key.fromMe !== true

/**
 * Bind public facade methods to their instance so they remain safe when passed into
 * bot handlers, object literals, callbacks, or destructured local variables.
 * The nearest implementation wins when a subclass overrides a method. Accessors,
 * constructors and private runtime helpers are deliberately left untouched.
 */
const bindRepanFacadeMethods = <T extends object>(instance: T): T => {
	const visited = new Set<string>()
	let prototype = Object.getPrototypeOf(instance) as object | null

	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name === 'constructor' || name.startsWith('_') || visited.has(name) || Object.prototype.hasOwnProperty.call(instance, name)) {
				continue
			}

			const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
			if (typeof descriptor?.value !== 'function') continue

			Object.defineProperty(instance, name, {
				configurable: true,
				enumerable: false,
				writable: true,
				value: descriptor.value.bind(instance)
			})
			visited.add(name)
		}

		prototype = Object.getPrototypeOf(prototype) as object | null
	}

	return instance
}

/**
 * Read the actual top-level fields from the generated WhatsApp protobuf schema.
 * This is more reliable than checking whether a key ends in `Message`: valid
 * IMessage fields such as `call`, `chat`, and `messageContextInfo` do not.
 * The generated schema keeps message fields as null-valued prototype properties.
 */
const PROTO_MESSAGE_FIELDS = new Set(
	Object.keys(proto.Message.prototype).filter(
		key => (proto.Message.prototype as unknown as Record<string, unknown>)[key] === null
	)
)

/** True when an object contains one or more top-level fields from proto.IMessage. */
export const isRepanProtoMessage = (content: unknown): content is proto.IMessage => {
	if (content === null || typeof content !== 'object' || Array.isArray(content)) return false
	const keys = Object.keys(content)
	return keys.length > 0 && keys.every(key => PROTO_MESSAGE_FIELDS.has(key))
}

const containsRepanProtoField = (content: object) => Object.keys(content).some(key => PROTO_MESSAGE_FIELDS.has(key))


const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const assertNonEmptyString: (value: unknown, label: string) => asserts value is string = (value, label) => {
	if (typeof value !== 'string' || !value.trim()) {
		throw new TypeError(`${label} must be a non-empty string`)
	}
}

const assertOptionalString = (value: unknown, label: string): void => {
	if (value !== undefined && typeof value !== 'string') {
		throw new TypeError(`${label} must be a string when provided`)
	}
}

const assertMediaUpload: (value: unknown, label?: string) => asserts value is WAMediaUpload = (value, label = 'Media') => {
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return
	if (!isRecord(value)) throw new TypeError(`${label} must be a Buffer, { url }, or readable { stream }`)
	if ('url' in value && ((typeof value.url === 'string' && value.url.trim()) || value.url instanceof URL)) return
	if ('stream' in value && isRecord(value.stream)) {
		const stream = value.stream as Record<string, unknown>
		if (typeof stream.pipe === 'function' && typeof stream.on === 'function') return
	}
	throw new TypeError(`${label} must be a Buffer, { url }, or readable { stream }`)
}

const requireRelay = (socket: RepanMessageSocket) => {
	if (typeof socket.relayMessage !== 'function') {
		throw new Error('This socket does not expose relayMessage(); native interactive messages are unavailable')
	}
	return socket.relayMessage.bind(socket)
}

const buildQuotedContext = (quoted: WAMessage): WAContextInfo => ({
	stanzaId: quoted.key.id ?? undefined,
	participant: quoted.key.participant ?? quoted.key.remoteJid ?? undefined,
	quotedMessage: quoted.message ?? undefined
})

/** Attach a quote (reply) to whichever interactive family the message belongs to. */
const applyQuoted = (message: proto.IMessage, quoted: WAMessage, depth = 0): proto.IMessage => {
	if (depth >= 4) return message

	// Raw protobuf input may already be wrapped in a view-once / ephemeral envelope.
	// Descend first so the quote is attached to the actual interactive payload.
	if (message.viewOnceMessage?.message) {
		return {
			...message,
			viewOnceMessage: {
				...message.viewOnceMessage,
				message: applyQuoted(message.viewOnceMessage.message, quoted, depth + 1)
			}
		}
	}
	if (message.viewOnceMessageV2?.message) {
		return {
			...message,
			viewOnceMessageV2: {
				...message.viewOnceMessageV2,
				message: applyQuoted(message.viewOnceMessageV2.message, quoted, depth + 1)
			}
		}
	}
	if (message.viewOnceMessageV2Extension?.message) {
		return {
			...message,
			viewOnceMessageV2Extension: {
				...message.viewOnceMessageV2Extension,
				message: applyQuoted(message.viewOnceMessageV2Extension.message, quoted, depth + 1)
			}
		}
	}
	if (message.ephemeralMessage?.message) {
		return {
			...message,
			ephemeralMessage: {
				...message.ephemeralMessage,
				message: applyQuoted(message.ephemeralMessage.message, quoted, depth + 1)
			}
		}
	}
	if (message.documentWithCaptionMessage?.message) {
		return {
			...message,
			documentWithCaptionMessage: {
				...message.documentWithCaptionMessage,
				message: applyQuoted(message.documentWithCaptionMessage.message, quoted, depth + 1)
			}
		}
	}

	const quote = buildQuotedContext(quoted)
	if (message.interactiveMessage) {
		return { ...message, interactiveMessage: { ...message.interactiveMessage, contextInfo: { ...quote, ...message.interactiveMessage.contextInfo } } }
	}
	if (message.listMessage) {
		return { ...message, listMessage: { ...message.listMessage, contextInfo: { ...quote, ...message.listMessage.contextInfo } } }
	}
	if (message.buttonsMessage) {
		return { ...message, buttonsMessage: { ...message.buttonsMessage, contextInfo: { ...quote, ...message.buttonsMessage.contextInfo } } }
	}
	return message
}

/**
 * The single exit point for every relayed payload. Interactive messages get the Repan delivery
 * treatment (viewOnce envelope + biz node); everything else is relayed exactly as given.
 */
const relayRepan = (socket: RepanMessageSocket, jid: string, message: proto.IMessage, options: RepanRelayOptions = {}) => {
	const relay = requireRelay(socket)
	const { quoted, ...relayOptions } = options
	const prepared = quoted ? applyQuoted(message, quoted) : message
	const plan = planRepanDelivery(jid, prepared, relayOptions)
	return relay(jid, plan.message, plan.options)
}

const validateSelectSections = (sections: unknown): void => {
	if (!Array.isArray(sections) || sections.length < 1 || sections.length > 10) {
		throw new TypeError('Select menu requires between 1 and 10 sections')
	}
	const rowIds = new Set<string>()
	let totalRows = 0
	for (const sectionValue of sections as unknown[]) {
		if (!isRecord(sectionValue)) throw new TypeError('Every select menu section must be an object')
		assertOptionalString(sectionValue.title, 'Select menu section title')
		if (!Array.isArray(sectionValue.rows) || sectionValue.rows.length === 0) {
			throw new TypeError('Every select menu section must contain at least one row')
		}
		for (const rowValue of sectionValue.rows as unknown[]) {
			if (!isRecord(rowValue)) throw new TypeError('Every select menu row must be an object')
			assertNonEmptyString(rowValue.id, 'Select menu row id')
			assertNonEmptyString(rowValue.title, 'Select menu row title')
			assertOptionalString(rowValue.description, 'Select menu row description')
			if (rowIds.has(rowValue.id)) throw new TypeError(`Duplicate select menu row id: ${rowValue.id}`)
			rowIds.add(rowValue.id)
			totalRows += 1
		}
	}
	if (totalRows > 10) throw new TypeError('Select menu supports a maximum of 10 selectable rows')
}

const validateFlowButtons = (buttons: unknown): void => {
	if (!Array.isArray(buttons) || buttons.length < 1 || buttons.length > 10) {
		throw new TypeError('Native Flow requires between 1 and 10 buttons')
	}
	const ids = new Set<string>()
	for (const buttonValue of buttons as unknown[]) {
		if (!isRecord(buttonValue)) throw new TypeError('Every Native Flow action must be an object')
		assertNonEmptyString(buttonValue.label, 'Native Flow button label')
		assertOptionalString(buttonValue.icon, 'Native Flow button icon')
		const type = buttonValue.type ?? 'quick_reply'
		switch (type) {
			case 'quick_reply': {
				assertNonEmptyString(buttonValue.id, 'Quick-reply button id')
				assertOptionalString(buttonValue.description, 'Quick-reply button description')
				if (ids.has(buttonValue.id)) throw new TypeError(`Duplicate Native Flow button id: ${buttonValue.id}`)
				ids.add(buttonValue.id)
				break
			}
			case 'url': {
				assertNonEmptyString(buttonValue.url, 'URL button URL')
				let parsed: URL
				try {
					parsed = new URL(buttonValue.url)
				} catch {
					throw new TypeError('URL buttons need a valid http(s) URL')
				}
				if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
					throw new TypeError('URL buttons only support http:// or https:// URLs')
				}
				assertOptionalString(buttonValue.merchantUrl, 'URL button merchantUrl')
				if (typeof buttonValue.merchantUrl === 'string' && buttonValue.merchantUrl) {
					let merchant: URL
					try {
						merchant = new URL(buttonValue.merchantUrl)
					} catch {
						throw new TypeError('merchantUrl must be a valid http(s) URL')
					}
					if (merchant.protocol !== 'https:' && merchant.protocol !== 'http:') {
						throw new TypeError('merchantUrl only supports http:// or https:// URLs')
					}
				}
				break
			}
			case 'call':
				assertNonEmptyString(buttonValue.phoneNumber, 'Call button phone number')
				if (!/^\+?[1-9]\d{5,14}$/.test(buttonValue.phoneNumber)) {
					throw new TypeError('Call buttons need a valid international phone number')
				}
				break
			case 'copy':
				assertNonEmptyString(buttonValue.copyCode, 'Copy button code')
				break
			case 'select':
				if (buttons.length !== 1) throw new TypeError('A select button must be the only Native Flow button')
				validateSelectSections(buttonValue.sections)
				break
			default:
				throw new TypeError(`Unsupported Native Flow button type: ${String(type)}`)
		}
	}
}

const toNativeFlowButton = (button: VamFlowButton) => {
	const displayText = button.icon?.trim() ? `${button.icon.trim()} ${button.label}` : button.label
	if ('sections' in button) {
		return {
			name: 'single_select',
			buttonParamsJson: JSON.stringify({
				title: displayText,
				sections: button.sections.map(section => ({
					...(section.title?.trim() ? { title: section.title.trim() } : {}),
					rows: section.rows.map(row => ({
						title: row.title,
						...(row.description ? { description: row.description } : {}),
						id: row.id
					}))
				}))
			})
		}
	}
	if ('url' in button) {
		return {
			name: 'cta_url',
			buttonParamsJson: JSON.stringify({
				display_text: displayText,
				url: button.url,
				merchant_url: button.merchantUrl ?? button.url
			})
		}
	}
	if ('phoneNumber' in button) {
		return {
			name: 'cta_call',
			buttonParamsJson: JSON.stringify({ display_text: displayText, phone_number: button.phoneNumber })
		}
	}
	if ('copyCode' in button) {
		return {
			name: 'cta_copy',
			buttonParamsJson: JSON.stringify({ display_text: displayText, copy_code: button.copyCode })
		}
	}
	if (!('id' in button)) throw new TypeError('Quick-reply buttons need a non-empty id')
	return {
		name: 'quick_reply',
		buttonParamsJson: JSON.stringify({
			display_text: displayText,
			id: button.id,
			...(button.description ? { description: button.description } : {})
		})
	}
}

type UploadedAttachment =
	| { imageMessage: proto.Message.IImageMessage }
	| { videoMessage: proto.Message.IVideoMessage }
	| { documentMessage: proto.Message.IDocumentMessage }

/** Upload an attachment through the socket's authenticated media connection. */
const uploadAttachment = async (
	socket: RepanMessageSocket,
	jid: string,
	attachment: VamFlowAttachment,
	mediaUploadTimeoutMs?: number
): Promise<UploadedAttachment> => {
	if (!isRecord(attachment)) throw new TypeError('Interactive media attachment must be an object')
	assertMediaUpload(attachment.media, 'Interactive attachment media')
	const upload = socket.waUploadToServer
	if (typeof upload !== 'function') {
		throw new Error('This socket does not expose waUploadToServer(); interactive media upload is unavailable')
	}

	let mediaContent: AnyMediaMessageContent
	switch (attachment.type) {
		case 'image':
			mediaContent = {
				image: attachment.media,
				...(attachment.mimetype ? { mimetype: attachment.mimetype } : {}),
				...(attachment.caption ? { caption: attachment.caption } : {})
			}
			break
		case 'video':
			mediaContent = {
				video: attachment.media,
				...(attachment.mimetype ? { mimetype: attachment.mimetype } : {}),
				...(attachment.caption ? { caption: attachment.caption } : {}),
				...(attachment.gifPlayback ? { gifPlayback: true } : {})
			}
			break
		case 'document':
			mediaContent = {
				document: attachment.media,
				mimetype: attachment.mimetype ?? 'application/octet-stream',
				...(attachment.fileName ? { fileName: attachment.fileName } : {}),
				...(attachment.caption ? { caption: attachment.caption } : {})
			}
			break
		default:
			throw new TypeError(`Unsupported attachment type: ${String((attachment as { type?: unknown }).type)}`)
	}

	const prepared = await prepareWAMessageMedia(mediaContent, {
		upload: upload.bind(socket),
		jid,
		...(mediaUploadTimeoutMs !== undefined ? { mediaUploadTimeoutMs } : {})
	})

	switch (attachment.type) {
		case 'image':
			if (!prepared.imageMessage) throw new Error('Image upload did not produce an imageMessage')
			return { imageMessage: prepared.imageMessage }
		case 'video':
			if (!prepared.videoMessage) throw new Error('Video upload did not produce a videoMessage')
			return { videoMessage: prepared.videoMessage }
		default:
			if (!prepared.documentMessage) throw new Error('Document upload did not produce a documentMessage')
			return { documentMessage: prepared.documentMessage }
	}
}

const buildNativeFlowContent = (
	flow: VamFlowOptions,
	header?: proto.Message.InteractiveMessage.IHeader
): proto.IMessage => {
	if (!isRecord(flow)) throw new TypeError('Native Flow options must be an object')
	assertNonEmptyString(flow.body, 'Native Flow body')
	assertOptionalString(flow.header, 'Native Flow header')
	assertOptionalString(flow.footer, 'Native Flow footer')
	validateFlowButtons(flow.buttons)
	return {
		interactiveMessage: {
			...(header ? { header } : flow.header ? { header: { title: flow.header, hasMediaAttachment: false } } : {}),
			body: { text: flow.body },
			...(flow.footer ? { footer: { text: flow.footer } } : {}),
			...(flow.contextInfo ? { contextInfo: flow.contextInfo } : {}),
			nativeFlowMessage: {
				messageVersion: 1,
				buttons: flow.buttons.map(toNativeFlowButton)
			}
		}
	}
}

/**
 * Typed, ergonomic message facade. Standard payloads delegate to sendMessage;
 * Native Flow payloads use relayMessage with WhatsApp's existing protobuf schema.
 */
export class VamMessage {
	constructor(protected readonly socket: RepanMessageSocket) {
		bindRepanFacadeMethods(this)
	}

	send(jid: string, content: AnyMessageContent, options: MiscMessageGenerationOptions = {}): Promise<WAMessage | undefined | void> {
		return this.socket.sendMessage(jid, content, options)
	}

	/**
	 * Universal dispatcher for every regular AnyMessageContent payload and every
	 * top-level field currently defined by the generated WhatsApp proto.IMessage.
	 * Regular content uses sendMessage(); raw protobuf content uses relayMessage().
	 */
	auto(jid: string, content: RepanAutoContent, options: RepanAutoOptions = {}) {
		if (!content || typeof content !== 'object' || Array.isArray(content)) {
			throw new TypeError('Message auto() needs a message content object')
		}
		if (containsRepanProtoField(content)) {
			if (!isRepanProtoMessage(content)) {
				throw new TypeError('Do not mix raw proto.IMessage fields with sendMessage() content; pass one message format at a time')
			}
			return this.raw(jid, content, options)
		}
		return this.send(jid, content as AnyMessageContent, options)
	}

	/** Alias for auto(), available on Vam, Lexzy, Repan, and Rich facades. */
	sendAny(jid: string, content: RepanAutoContent, options: RepanAutoOptions = {}) {
		return this.auto(jid, content, options)
	}

	text(
		jid: string,
		text: string,
		contentOptions: VamTextContentOptions = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { text, ...contentOptions }, sendOptions)
	}

	reply(
		jid: string,
		quoted: WAMessage,
		text: string,
		contentOptions: VamTextContentOptions = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.text(jid, text, contentOptions, { ...sendOptions, quoted })
	}

	image(
		jid: string,
		image: WAMediaUpload,
		contentOptions: VamMediaContentOptions = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { image, ...contentOptions }, sendOptions)
	}

	video(
		jid: string,
		video: WAMediaUpload,
		contentOptions: VamMediaContentOptions = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { video, ...contentOptions }, sendOptions)
	}

	audio(
		jid: string,
		audio: WAMediaUpload,
		contentOptions: Pick<VamMediaContentOptions, 'mimetype' | 'ptt' | 'seconds'> = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { audio, ...contentOptions }, sendOptions)
	}

	document(
		jid: string,
		document: WAMediaUpload,
		mimetype = 'application/octet-stream',
		contentOptions: Omit<VamMediaContentOptions, 'mimetype'> = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { document, mimetype, ...contentOptions }, sendOptions)
	}

	sticker(
		jid: string,
		sticker: WAMediaUpload,
		contentOptions: Pick<VamMediaContentOptions, 'isAnimated' | 'width' | 'height'> = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { sticker, ...contentOptions }, sendOptions)
	}

	/**
	 * Send image, video (including MP4), audio, document, or sticker content through
	 * Baileys' normal media pipeline. Upload encryption, media keys, and retries stay
	 * inside the authenticated socket rather than being reimplemented by this helper.
	 */
	media(jid: string, input: RepanMediaInput, sendOptions: MiscMessageGenerationOptions = {}) {
		if (!isRecord(input) || !('media' in input)) {
			throw new TypeError('media() needs a discriminated media input with a media payload')
		}
		assertMediaUpload(input.media)
		switch (input.type) {
			case 'image':
				return this.image(jid, input.media, input.options, sendOptions)
			case 'video':
				return this.video(jid, input.media, input.options, sendOptions)
			case 'audio':
				return this.audio(jid, input.media, input.options, sendOptions)
			case 'document': {
				const { mimetype, ...contentOptions } = input.options ?? {}
				return this.document(jid, input.media, mimetype ?? 'application/octet-stream', contentOptions, sendOptions)
			}
			case 'sticker':
				return this.sticker(jid, input.media, input.options, sendOptions)
			default:
				throw new TypeError(`Unsupported media type: ${String((input as { type?: unknown }).type)}`)
		}
	}

	/** Alias for media(), intended for callers that prefer an explicit send verb. */
	sendMedia(jid: string, input: RepanMediaInput, sendOptions: MiscMessageGenerationOptions = {}) {
		return this.media(jid, input, sendOptions)
	}

	reaction(jid: string, key: WAMessageKey, text: string, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { react: { key, text } }, options)
	}

	delete(jid: string, key: WAMessageKey, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { delete: key }, options)
	}

	forward(jid: string, message: WAMessage, force = false, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { forward: message, force }, options)
	}

	editText(jid: string, key: WAMessageKey, text: string, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { text, edit: key }, options)
	}

	poll(jid: string, poll: PollMessageOptions, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { poll }, options)
	}

	event(jid: string, event: EventMessageOptions, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { event }, options)
	}

	location(jid: string, location: WALocationMessage, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { location }, options)
	}

	album(jid: string, album: AlbumMessageOptions, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { album }, options)
	}

	contact(jid: string, contact: proto.Message.IContactMessage, options: MiscMessageGenerationOptions = {}) {
		return this.contacts(jid, [contact], undefined, options)
	}

	contacts(
		jid: string,
		contacts: proto.Message.IContactMessage[],
		displayName?: string,
		options: MiscMessageGenerationOptions = {}
	) {
		if (!contacts.length) throw new TypeError('At least one contact is required')
		return this.send(jid, { contacts: { contacts, ...(displayName ? { displayName } : {}) } }, options)
	}

	groupInvite(jid: string, invite: GroupInviteInfo, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { groupInvite: invite }, options)
	}

	listReply(
		jid: string,
		reply: Omit<proto.Message.IListResponseMessage, 'contextInfo'>,
		options: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { listReply: reply }, options)
	}

	buttonReply(
		jid: string,
		reply: ButtonReplyInfo,
		type: 'template' | 'plain' = 'plain',
		options: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { buttonReply: reply, type }, options)
	}

	product(jid: string, product: WASendableProduct, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { product }, options)
	}

	sharePhoneNumber(jid: string, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { sharePhoneNumber: true }, options)
	}

	requestPhoneNumber(jid: string, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { requestPhoneNumber: true }, options)
	}

	pin(
		jid: string,
		key: WAMessageKey,
		type: proto.PinInChat.Type,
		time?: 86400 | 604800 | 2592000,
		options: MiscMessageGenerationOptions = {}
	) {
		return this.send(jid, { pin: key, type, ...(time ? { time } : {}) }, options)
	}

	limitSharing(jid: string, enabled = true, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { limitSharing: enabled }, options)
	}

	/**
	 * Relay an already-constructed protobuf message without re-generating its content.
	 * Use regular send()/text()/document() for ordinary messages; raw() is for valid
	 * WhatsApp proto.IMessage payloads and deliberately does not repair malformed data.
	 */
	raw(jid: string, message: proto.IMessage, options: RepanRelayOptions = {}) {
		const prepared = normalizeRelayMessage(message)
		return relayRepan(this.socket, jid, prepared, options)
	}

	sendRaw(jid: string, message: proto.IMessage, options: RepanRelayOptions = {}) {
		return this.raw(jid, message, options)
	}

	disappearing(jid: string, duration: boolean | number, options: MiscMessageGenerationOptions = {}) {
		return this.send(jid, { disappearingMessagesInChat: duration }, options)
	}

	/** Send a WhatsApp Native Flow message with quick-reply, URL, call, or copy actions. */
	nativeFlow(jid: string, flow: VamFlowOptions, options: RepanRelayOptions = {}) {
		return this.raw(jid, buildNativeFlowContent(flow), options)
	}

	/** Send a Native Flow message with an uploaded image, video, or document header. */
	async nativeFlowWithMedia(
		jid: string,
		flow: VamFlowOptions,
		attachment: VamFlowAttachment,
		options: VamInteractiveSendOptions = {}
	) {
		if (!isRecord(flow)) throw new TypeError('Native Flow options must be an object')
		assertNonEmptyString(flow.body, 'Native Flow body')
		assertOptionalString(flow.header, 'Native Flow header')
		assertOptionalString(flow.footer, 'Native Flow footer')
		validateFlowButtons(flow.buttons)
		const { mediaUploadTimeoutMs, ...relayOptions } = options
		const header = await uploadAttachment(this.socket, jid, attachment, mediaUploadTimeoutMs)
		return this.raw(jid, buildNativeFlowContent(flow, {
			...(flow.header ? { title: flow.header } : {}),
			hasMediaAttachment: true,
			...(header as proto.Message.InteractiveMessage.IHeader)
		}), relayOptions)
	}

	/** Convenience helper for sending a document with Native Flow buttons. */
	documentWithButtons(
		jid: string,
		document: WAMediaUpload,
		flow: VamFlowOptions,
		mediaOptions: VamDocumentButtonOptions = {},
		sendOptions: VamInteractiveSendOptions = {}
	) {
		return this.nativeFlowWithMedia(jid, flow, {
			type: 'document',
			media: document,
			mimetype: mediaOptions.mimetype ?? 'application/octet-stream',
			...(mediaOptions.fileName ? { fileName: mediaOptions.fileName } : {}),
			...(mediaOptions.caption ? { caption: mediaOptions.caption } : {})
		}, sendOptions)
	}

	imageWithButtons(jid: string, image: WAMediaUpload, flow: VamFlowOptions, options: VamInteractiveSendOptions = {}) {
		return this.nativeFlowWithMedia(jid, flow, { type: 'image', media: image }, options)
	}

	videoWithButtons(jid: string, video: WAMediaUpload, flow: VamFlowOptions, options: VamInteractiveSendOptions = {}) {
		return this.nativeFlowWithMedia(jid, flow, { type: 'video', media: video }, options)
	}

	/** Alias for nativeFlow(), useful when a VamMessage represents one wizard step. */
	step(jid: string, flow: VamFlowOptions, options: RepanRelayOptions = {}) {
		return this.nativeFlow(jid, flow, options)
	}
}

/** Lexzy's native WhatsApp carousel facade. */
export class LexzyMessage extends VamMessage {
	async carousel(jid: string, carousel: LexzyCarouselOptions, options: LexzyCarouselSendOptions = {}) {
		if (!isRecord(carousel)) throw new TypeError('Lexzy carousel options must be an object')
		assertNonEmptyString(carousel.body, 'Lexzy carousel body')
		assertOptionalString(carousel.header, 'Lexzy carousel header')
		assertOptionalString(carousel.footer, 'Lexzy carousel footer')
		if (!Array.isArray(carousel.cards) || carousel.cards.length < 2 || carousel.cards.length > 10) {
			throw new TypeError('Lexzy carousel requires between 2 and 10 cards')
		}

		// Validate the complete carousel before uploading the first card. A malformed
		// later card must not leave earlier media uploaded without a send operation.
		const cardIds = new Set<string>()
		for (const cardValue of carousel.cards as unknown[]) {
			if (!isRecord(cardValue)) throw new TypeError('Every Lexzy carousel card must be an object')
			const card = cardValue as unknown as LexzyCarouselCard
			assertNonEmptyString(card.id, 'Lexzy carousel card id')
			assertNonEmptyString(card.title, 'Lexzy carousel card title')
			assertNonEmptyString(card.body, 'Lexzy carousel card body')
			assertOptionalString(card.subtitle, 'Lexzy carousel card subtitle')
			assertOptionalString(card.footer, 'Lexzy carousel card footer')
			if (cardIds.has(card.id)) throw new TypeError(`Duplicate Lexzy carousel card id: ${card.id}`)
			cardIds.add(card.id)
			if (card.buttons !== undefined && !Array.isArray(card.buttons)) {
				throw new TypeError(`Lexzy card ${card.id} buttons must be an array`)
			}
			if (card.buttons?.length) validateFlowButtons(card.buttons)
			if (card.media !== undefined) {
				if (!isRecord(card.media) || (card.media.type !== 'image' && card.media.type !== 'video')) {
					throw new TypeError(`Lexzy card ${card.id} media type must be image or video`)
				}
				assertMediaUpload(card.media.media, `Lexzy card ${card.id} media`)
				assertOptionalString(card.media.mimetype, `Lexzy card ${card.id} mimetype`)
				if (card.media.type === 'video' && card.media.gifPlayback !== undefined && typeof card.media.gifPlayback !== 'boolean') {
					throw new TypeError(`Lexzy card ${card.id} gifPlayback must be a boolean`)
				}
			}
		}
		if (carousel.cards.some(card => isRecord(card) && card.media !== undefined) && typeof this.socket.waUploadToServer !== 'function') {
			throw new Error('This socket does not expose waUploadToServer(); Lexzy media cards are unavailable')
		}

		const cards: proto.Message.IInteractiveMessage[] = []
		const { mediaUploadTimeoutMs, ...relayOptions } = options
		const upload = this.socket.waUploadToServer

		for (const cardValue of carousel.cards as unknown[]) {
			if (!isRecord(cardValue)) throw new TypeError('Every Lexzy carousel card must be an object')
			const card = cardValue as unknown as LexzyCarouselCard
			assertNonEmptyString(card.id, 'Lexzy carousel card id')
			assertNonEmptyString(card.title, 'Lexzy carousel card title')
			assertNonEmptyString(card.body, 'Lexzy carousel card body')
			assertOptionalString(card.subtitle, 'Lexzy carousel card subtitle')
			assertOptionalString(card.footer, 'Lexzy carousel card footer')
			if (cardIds.has(card.id)) throw new TypeError(`Duplicate Lexzy carousel card id: ${card.id}`)
			cardIds.add(card.id)
			if (card.buttons !== undefined && !Array.isArray(card.buttons)) {
				throw new TypeError(`Lexzy card ${card.id} buttons must be an array`)
			}
			if (card.buttons?.length) validateFlowButtons(card.buttons)
			if (card.media !== undefined) {
				if (!isRecord(card.media) || (card.media.type !== 'image' && card.media.type !== 'video')) {
					throw new TypeError(`Lexzy card ${card.id} media type must be image or video`)
				}
				assertMediaUpload(card.media.media, `Lexzy card ${card.id} media`)
				assertOptionalString(card.media.mimetype, `Lexzy card ${card.id} mimetype`)
			}

			let header: proto.Message.InteractiveMessage.IHeader
			if (card.media) {
				if (typeof upload !== 'function') {
					throw new Error('This socket does not expose waUploadToServer(); Lexzy media cards are unavailable')
				}

				const mediaContent: AnyMediaMessageContent = card.media.type === 'image'
					? { image: card.media.media, ...(card.media.mimetype ? { mimetype: card.media.mimetype } : {}) }
					: {
						video: card.media.media,
						...(card.media.mimetype ? { mimetype: card.media.mimetype } : {}),
						...(card.media.gifPlayback ? { gifPlayback: true } : {})
					}
				const prepared = await prepareWAMessageMedia(mediaContent, {
					upload: upload.bind(this.socket),
					jid,
					...(mediaUploadTimeoutMs !== undefined ? { mediaUploadTimeoutMs } : {})
				})

				if (card.media.type === 'image') {
					if (!prepared.imageMessage) throw new Error(`Lexzy card ${card.id} image upload did not produce an imageMessage`)
					header = { title: card.title, ...(card.subtitle ? { subtitle: card.subtitle } : {}), hasMediaAttachment: true, imageMessage: prepared.imageMessage }
				} else {
					if (!prepared.videoMessage) throw new Error(`Lexzy card ${card.id} video upload did not produce a videoMessage`)
					header = { title: card.title, ...(card.subtitle ? { subtitle: card.subtitle } : {}), hasMediaAttachment: true, videoMessage: prepared.videoMessage }
				}
			} else {
				header = {
					title: card.title,
					...(card.subtitle ? { subtitle: card.subtitle } : {}),
					hasMediaAttachment: false
				}
			}

			cards.push({
				header,
				body: { text: card.body },
				...(card.footer ? { footer: { text: card.footer } } : {}),
				...(card.buttons?.length
					? {
						nativeFlowMessage: {
							messageVersion: 1,
							buttons: card.buttons.map(toNativeFlowButton)
						}
					}
					: {})
			})
		}

		const content: proto.IMessage = {
			interactiveMessage: {
				...(carousel.header ? { header: { title: carousel.header, hasMediaAttachment: false } } : {}),
				body: { text: carousel.body },
				...(carousel.footer ? { footer: { text: carousel.footer } } : {}),
				...(carousel.contextInfo ? { contextInfo: carousel.contextInfo } : {}),
				carouselMessage: {
					messageVersion: 1,
					carouselCardType: proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType.HSCROLL_CARDS,
					cards
				}
			}
		}

		return relayRepan(this.socket, jid, content, relayOptions)
	}
}

const validateRepanMenu = (menu: RepanMenuOptions) => {
	if (!isRecord(menu)) throw new TypeError('Repan menu options must be an object')
	assertNonEmptyString(menu.title, 'Repan menu title')
	assertNonEmptyString(menu.description, 'Repan menu description')
	assertOptionalString(menu.footer, 'Repan menu footer')
	if (menu.buttonText !== undefined) {
		assertNonEmptyString(menu.buttonText, 'Repan menu buttonText')
		if (menu.buttonText.length > 20) throw new TypeError('Repan menu buttonText must contain 1 to 20 characters')
	}
	validateSelectSections(menu.sections)
}

const toRepanListMessage = (menu: RepanMenuOptions): proto.IMessage => {
	validateRepanMenu(menu)
	return {
		listMessage: {
			title: menu.title.trim(),
			description: menu.description.trim(),
			buttonText: menu.buttonText?.trim() || 'OPEN MENU',
			listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
			sections: menu.sections.map(section => ({
				...(section.title?.trim() ? { title: section.title.trim() } : {}),
				rows: section.rows.map(row => ({
					rowId: row.id,
					title: row.title,
					...(row.description ? { description: row.description } : {})
				}))
			})),
			...(menu.footer ? { footerText: menu.footer } : {}),
			...(menu.contextInfo ? { contextInfo: menu.contextInfo } : {})
		}
	}
}

const STATUS_ICONS: Record<'success' | 'warning' | 'info' | 'danger', string> = {
	success: '🟢',
	warning: '🟡',
	info: '🔵',
	danger: '🔴'
}

const PANEL_RULE = '━━━━━━━━━━━━━━━━━━'
const CARD_DIVIDER = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄'
const PROGRESS_SEGMENTS = 10

const renderProgressBar = (block: Extract<RepanPanelBlock, { type: 'progress' }>) => {
	if (
		!Number.isFinite(block.current) ||
		!Number.isFinite(block.max) ||
		block.max <= 0 ||
		block.current < 0 ||
		block.current > block.max
	) {
		throw new RangeError(`Invalid Repan progress block: ${block.label}`)
	}
	const percent = Math.round((block.current / block.max) * 100)
	const filled = Math.round((percent / 100) * PROGRESS_SEGMENTS)
	return `${'█'.repeat(filled)}${'░'.repeat(PROGRESS_SEGMENTS - filled)} ${percent}${block.suffix ?? '%'}`
}

/** Original flat layout; kept for clients that struggle with box-drawing glyphs. */
const renderPlainBlocks = (blocks: readonly RepanPanelBlock[]): string[] => {
	const lines: string[] = []
	for (const block of blocks) {
		switch (block.type) {
			case 'note':
				lines.push(block.text)
				break
			case 'metric':
				lines.push(`${block.label}: ${block.value}`)
				if (block.detail) lines.push(`  ${block.detail}`)
				break
			case 'status':
				lines.push(`[${block.level.toUpperCase()}] ${block.label}: ${block.value}`)
				break
			case 'progress':
				lines.push(`${block.label}: ${renderProgressBar(block)}`)
				break
			case 'fields':
				for (const row of block.rows) lines.push(`${row.label}: ${row.value}`)
				break
			case 'timeline':
				for (const item of block.items) {
					lines.push(`${item.time}  ${item.label}`)
					if (item.detail) lines.push(`  ${item.detail}`)
				}
				break
			case 'list':
				if (block.title) lines.push(block.title)
				block.items.forEach((item, index) => lines.push(block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
				break
			case 'quote':
				lines.push(`> ${block.text}`)
				break
			case 'divider':
				lines.push(PANEL_RULE)
				break
		}
	}
	return lines
}

/** Icon-led card layout used by default. Lines are returned without the surrounding frame. */
const renderCardBlocks = (blocks: readonly RepanPanelBlock[]): string[] => {
	const lines: string[] = []
	for (const block of blocks) {
		switch (block.type) {
			case 'note':
				lines.push(block.text)
				break
			case 'metric':
				lines.push(`◈ *${block.label}*  ›  ${block.value}`)
				if (block.detail) lines.push(`   └ _${block.detail}_`)
				break
			case 'status':
				lines.push(`${STATUS_ICONS[block.level]} *${block.label}*  ›  ${block.value}`)
				break
			case 'progress':
				lines.push(`▣ *${block.label}*`, `   ${renderProgressBar(block)}`)
				break
			case 'fields':
				for (const row of block.rows) lines.push(`▫ *${row.label}*  ›  ${row.value}`)
				break
			case 'timeline':
				for (const item of block.items) {
					lines.push(`⏱ \`${item.time}\`  ›  ${item.label}`)
					if (item.detail) lines.push(`   └ _${item.detail}_`)
				}
				break
			case 'list':
				if (block.title) lines.push(`✦ *${block.title}*`)
				block.items.forEach((item, index) => lines.push(block.ordered ? `${index + 1}. ${item}` : `• ${item}`))
				break
			case 'quote':
				lines.push(`❝ _${block.text}_`)
				break
			case 'divider':
				lines.push(CARD_DIVIDER)
				break
		}
	}
	return lines
}

const renderRepanBlocks = (blocks: readonly RepanPanelBlock[], style: RepanPanelStyle = 'card'): string[] =>
	style === 'plain' ? renderPlainBlocks(blocks) : renderCardBlocks(blocks)

const assertScalarValue = (value: unknown, label: string): void => {
	if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value))) {
		throw new TypeError(`${label} must be a string or finite number`)
	}
}

const assertBlockCount = (blocks: unknown, label: string): void => {
	if (!Array.isArray(blocks) || blocks.length === 0 || blocks.length > 30) {
		throw new TypeError(`${label} requires between 1 and 30 blocks`)
	}
	for (const blockValue of blocks as unknown[]) {
		if (!isRecord(blockValue)) throw new TypeError(`${label} blocks must be objects`)
		switch (blockValue.type) {
			case 'note':
				assertNonEmptyString(blockValue.text, `${label} note text`)
				break
			case 'metric':
				assertNonEmptyString(blockValue.label, `${label} metric label`)
				assertScalarValue(blockValue.value, `${label} metric value`)
				assertOptionalString(blockValue.detail, `${label} metric detail`)
				break
			case 'status':
				assertNonEmptyString(blockValue.label, `${label} status label`)
				assertNonEmptyString(blockValue.value, `${label} status value`)
				if (!['success', 'warning', 'info', 'danger'].includes(String(blockValue.level))) {
					throw new TypeError(`${label} status level must be success, warning, info, or danger`)
				}
				break
			case 'progress':
				assertNonEmptyString(blockValue.label, `${label} progress label`)
				assertOptionalString(blockValue.suffix, `${label} progress suffix`)
				if (typeof blockValue.current !== 'number' || typeof blockValue.max !== 'number') {
					throw new TypeError(`${label} progress values must be numbers`)
				}
				renderProgressBar(blockValue as unknown as Extract<RepanPanelBlock, { type: 'progress' }>)
				break
			case 'fields':
				if (!Array.isArray(blockValue.rows) || blockValue.rows.length === 0 || blockValue.rows.length > 30) {
					throw new TypeError(`${label} fields block requires 1 to 30 rows`)
				}
				for (const row of blockValue.rows as unknown[]) {
					if (!isRecord(row)) throw new TypeError(`${label} field rows must be objects`)
					assertNonEmptyString(row.label, `${label} field label`)
					assertScalarValue(row.value, `${label} field value`)
				}
				break
			case 'timeline':
				if (!Array.isArray(blockValue.items) || blockValue.items.length === 0 || blockValue.items.length > 30) {
					throw new TypeError(`${label} timeline block requires 1 to 30 items`)
				}
				for (const item of blockValue.items as unknown[]) {
					if (!isRecord(item)) throw new TypeError(`${label} timeline items must be objects`)
					assertNonEmptyString(item.time, `${label} timeline time`)
					assertNonEmptyString(item.label, `${label} timeline label`)
					assertOptionalString(item.detail, `${label} timeline detail`)
				}
				break
			case 'list':
				assertOptionalString(blockValue.title, `${label} list title`)
				if (!Array.isArray(blockValue.items) || blockValue.items.length === 0 || blockValue.items.length > 30) {
					throw new TypeError(`${label} list block requires 1 to 30 items`)
				}
				for (const item of blockValue.items as unknown[]) assertNonEmptyString(item, `${label} list item`)
				if (blockValue.ordered !== undefined && typeof blockValue.ordered !== 'boolean') {
					throw new TypeError(`${label} list ordered must be a boolean`)
				}
				break
			case 'quote':
				assertNonEmptyString(blockValue.text, `${label} quote text`)
				break
			case 'divider':
				break
			default:
				throw new TypeError(`${label} contains an unsupported block type`)
		}
	}
}

/**
 * Repan's all-in-one message facade. It inherits every Vam helper (text, media, polls, native
 * flow...) and every Lexzy helper (carousel), then adds structured panels, list menus,
 * dashboards, select menus and classic response buttons. Interactive payloads are delivered
 * through the Repan delivery lane (viewOnce envelope + biz node); everything else uses sendMessage().
 */
export class RepanMessage extends LexzyMessage {
	/** Rich text options are also available on the all-in-one Repan facade. */
	richText(
		jid: string,
		text: string,
		options: VamTextContentOptions & { quoted?: WAMessage } = {},
		sendOptions: MiscMessageGenerationOptions = {}
	) {
		const { quoted, ...contentOptions } = options
		return this.text(jid, text, contentOptions, quoted ? { ...sendOptions, quoted } : sendOptions)
	}

	/**
	 * Send a structured status panel as ordinary text. `style: 'card'` (default) draws an
	 * icon-led card; `style: 'plain'` keeps the original flat layout.
	 */
	panel(jid: string, panel: RepanPanelOptions, options: MiscMessageGenerationOptions = {}) {
		if (!isRecord(panel)) throw new TypeError('Repan panel options must be an object')
		assertNonEmptyString(panel.title, 'Repan panel title')
		assertOptionalString(panel.subtitle, 'Repan panel subtitle')
		assertOptionalString(panel.footer, 'Repan panel footer')
		if (panel.style !== undefined && panel.style !== 'card' && panel.style !== 'plain') {
			throw new TypeError('Repan panel style must be card or plain')
		}
		assertBlockCount(panel.blocks, 'Repan panel')

		const style = panel.style ?? 'card'
		const body = renderRepanBlocks(panel.blocks, style)
		const lines: string[] = []

		if (style === 'plain') {
			lines.push(panel.title.trim())
			if (panel.subtitle?.trim()) lines.push(panel.subtitle.trim())
			lines.push(PANEL_RULE, ...body)
			if (panel.footer?.trim()) lines.push(PANEL_RULE, panel.footer.trim())
		} else {
			lines.push(`╭━━『 *${panel.title.trim()}* 』`)
			if (panel.subtitle?.trim()) lines.push(`┃ _${panel.subtitle.trim()}_`)
			lines.push('┣━━━━━━━━━━━━━━━━')
			for (const line of body) lines.push(`┃ ${line}`)
			lines.push('╰━━━━━━━━━━━━━━━━')
			if (panel.footer?.trim()) lines.push(`  _${panel.footer.trim()}_`)
		}
		return this.send(jid, { text: lines.join('\n') }, options)
	}

	/** Send a structured WhatsApp listMessage with selectable rows (not Native Flow). */
	menu(jid: string, menu: RepanMenuOptions, options: RepanRelayOptions = {}) {
		return relayRepan(this.socket, jid, toRepanListMessage(menu), options)
	}

	/** Send a dashboard summary whose actions open a native selectable list. */
	dashboard(jid: string, dashboard: RepanDashboardOptions, options: RepanRelayOptions = {}) {
		if (!isRecord(dashboard)) throw new TypeError('Repan dashboard options must be an object')
		assertNonEmptyString(dashboard.title, 'Repan dashboard title')
		assertOptionalString(dashboard.subtitle, 'Repan dashboard subtitle')
		assertOptionalString(dashboard.footer, 'Repan dashboard footer')
		if (dashboard.style !== undefined && dashboard.style !== 'card' && dashboard.style !== 'plain') {
			throw new TypeError('Repan dashboard style must be card or plain')
		}
		assertBlockCount(dashboard.blocks, 'Repan dashboard')
		validateSelectSections(dashboard.sections)
		const summary = [dashboard.subtitle?.trim(), ...renderRepanBlocks(dashboard.blocks, dashboard.style ?? 'card')]
			.filter(Boolean)
			.join('\n')
		return this.menu(jid, {
			title: dashboard.title,
			description: summary,
			buttonText: dashboard.buttonText,
			footer: dashboard.footer,
			sections: dashboard.sections,
			contextInfo: dashboard.contextInfo
		}, options)
	}

	/**
	 * Modern Native Flow select menu: a single button that opens a sheet of sections and rows,
	 * optionally under an uploaded image/video/document header.
	 */
	select(jid: string, select: RepanSelectOptions, options: VamInteractiveSendOptions = {}) {
		if (!isRecord(select)) throw new TypeError('Repan select options must be an object')
		assertNonEmptyString(select.buttonText, 'Repan select buttonText')
		assertNonEmptyString(select.body, 'Repan select body')
		assertOptionalString(select.header, 'Repan select header')
		assertOptionalString(select.footer, 'Repan select footer')
		validateSelectSections(select.sections)
		if (select.buttonText.length > 40) {
			throw new TypeError('Repan select buttonText must contain 1 to 40 characters')
		}
		const flow: VamFlowOptions = {
			...(select.header ? { header: select.header } : {}),
			body: select.body,
			...(select.footer ? { footer: select.footer } : {}),
			...(select.contextInfo ? { contextInfo: select.contextInfo } : {}),
			buttons: [{ type: 'select', label: select.buttonText.trim(), sections: select.sections }]
		}
		return select.attachment
			? this.nativeFlowWithMedia(jid, flow, select.attachment, options)
			: this.nativeFlow(jid, flow, options)
	}

	/**
	 * Send a Repan-branded action deck with quick replies and call-to-action actions.
	 * This is the preferred modern button API; it uses supported Native Flow wire
	 * messages rather than the older `buttonsMessage` format.
	 */
	actionDeck(jid: string, deck: RepanActionDeckOptions, options: VamInteractiveSendOptions = {}) {
		if (!isRecord(deck)) throw new TypeError('Repan action deck options must be an object')
		assertNonEmptyString(deck.body, 'Repan action deck body')
		assertOptionalString(deck.header, 'Repan action deck header')
		assertOptionalString(deck.footer, 'Repan action deck footer')
		if (!Array.isArray(deck.actions) || deck.actions.length === 0) {
			throw new TypeError('Repan action deck requires at least one action')
		}
		const flow: VamFlowOptions = {
			...(deck.header ? { header: deck.header } : {}),
			body: deck.body,
			...(deck.footer ? { footer: deck.footer } : {}),
			...(deck.contextInfo ? { contextInfo: deck.contextInfo } : {}),
			buttons: deck.actions
		}
		return deck.attachment
			? this.nativeFlowWithMedia(jid, flow, deck.attachment, options)
			: this.nativeFlow(jid, flow, options)
	}

	/**
	 * Send the classic response-button protobuf (1-3 buttons), optionally with an uploaded
	 * image/video/document header. Intentionally separate from Lexzy carousels and Vam Native
	 * Flow; modern clients may prefer menu() or select().
	 */
	buttonMessage(jid: string, message: RepanButtonMessageOptions, options: VamInteractiveSendOptions = {}) {
		if (!isRecord(message)) throw new TypeError('Repan button message options must be an object')
		assertNonEmptyString(message.text, 'Repan button message text')
		assertOptionalString(message.header, 'Repan button message header')
		assertOptionalString(message.footer, 'Repan button message footer')
		if (!Array.isArray(message.buttons) || message.buttons.length < 1 || message.buttons.length > 3) {
			throw new TypeError('Repan buttonMessage requires between 1 and 3 buttons')
		}
		const ids = new Set<string>()
		for (const buttonValue of message.buttons as unknown[]) {
			if (!isRecord(buttonValue)) throw new TypeError('Every Repan button must be an object')
			assertNonEmptyString(buttonValue.id, 'Repan button id')
			assertNonEmptyString(buttonValue.label, 'Repan button label')
			if (ids.has(buttonValue.id)) throw new TypeError(`Duplicate Repan button id: ${buttonValue.id}`)
			ids.add(buttonValue.id)
		}
		if (message.attachment !== undefined && !isRecord(message.attachment)) {
			throw new TypeError('Repan button message attachment must be an object')
		}
		if (message.mediaUploadTimeoutMs !== undefined && (!Number.isFinite(message.mediaUploadTimeoutMs) || message.mediaUploadTimeoutMs <= 0)) {
			throw new TypeError('Repan button mediaUploadTimeoutMs must be a positive finite number')
		}

		const HeaderType = proto.Message.ButtonsMessage.HeaderType
		const build = (media?: UploadedAttachment): proto.IMessage => ({
			buttonsMessage: {
				...(media
					? {
						headerType:
							'imageMessage' in media ? HeaderType.IMAGE : 'videoMessage' in media ? HeaderType.VIDEO : HeaderType.DOCUMENT,
						...media
					}
					: message.header
						? { text: message.header, headerType: HeaderType.TEXT }
						: { headerType: HeaderType.EMPTY }),
				contentText: message.text,
				...(message.footer ? { footerText: message.footer } : {}),
				...(message.contextInfo ? { contextInfo: message.contextInfo } : {}),
				buttons: message.buttons.map(button => ({
					buttonId: button.id,
					buttonText: { displayText: button.label },
					type: proto.Message.ButtonsMessage.Button.Type.RESPONSE
				}))
			}
		})

		if (!message.attachment) return relayRepan(this.socket, jid, build(), options)
		const { mediaUploadTimeoutMs, ...relayOptions } = options
		const attachment = message.attachment
		return (async () => {
			const media = await uploadAttachment(this.socket, jid, attachment, mediaUploadTimeoutMs ?? message.mediaUploadTimeoutMs)
			return relayRepan(this.socket, jid, build(media), relayOptions)
		})()
	}

}

/**
 * Rich text facade with mention, quote, context-info and link-preview support.
 * These are WhatsApp-supported message fields, not a proprietary wire format.
 */
/** Dedicated Rich facade; its helpers are inherited by the all-in-one Repan facade. */
export class RichMessage extends RepanMessage {}

/** Every Repan message module bound to one socket. `repan` already includes Vam + Lexzy + Rich helpers. */
export type RepanSuite = {
	vam: VamMessage
	lexzy: LexzyMessage
	repan: RepanMessage
	rich: RichMessage
	/** Shortcut for repan.auto(): sends any content through the right pipe. */
	send: RepanMessage['auto']
}

/**
 * Function-first API for bot projects that prefer named handlers over class instances.
 * Every function is already bound to the correct message facade and can be destructured.
 */
export type RepanFunctionSuite = RepanSuite & {
	/** Whether sender-side outgoing-echo filtering is enabled. */
	RepanPler: boolean
	/** Apply RepanPler filtering to a `messages.upsert` event before command/case routing. */
	filterUpsert: <T extends RepanPlerUpsertEvent>(event: T) => T
	/** Check whether one message should enter the sender-side bot handler. */
	isVisibleMessage: (message: WAMessage) => boolean
	/** Generic dispatcher; equivalent to `repan.auto()`. */
	sendAny: VamMessage['sendAny']
	sendText: VamMessage['text']
	sendReply: VamMessage['reply']
	sendImage: VamMessage['image']
	sendVideo: VamMessage['video']
	sendAudio: VamMessage['audio']
	sendDocument: VamMessage['document']
	sendSticker: VamMessage['sticker']
	sendMedia: VamMessage['sendMedia']
	sendReaction: VamMessage['reaction']
	deleteMessage: VamMessage['delete']
	forwardMessage: VamMessage['forward']
	editMessage: VamMessage['editText']
	sendPoll: VamMessage['poll']
	sendEvent: VamMessage['event']
	sendLocation: VamMessage['location']
	sendAlbum: VamMessage['album']
	sendContact: VamMessage['contact']
	sendContacts: VamMessage['contacts']
	sendGroupInvite: VamMessage['groupInvite']
	sendListReply: VamMessage['listReply']
	sendButtonReply: VamMessage['buttonReply']
	sendProduct: VamMessage['product']
	sharePhoneNumber: VamMessage['sharePhoneNumber']
	requestPhoneNumber: VamMessage['requestPhoneNumber']
	pinMessage: VamMessage['pin']
	sendLimitSharing: VamMessage['limitSharing']
	sendDisappearing: VamMessage['disappearing']
	setDisappearing: VamMessage['disappearing']
	sendRaw: VamMessage['sendRaw']
	sendNativeFlow: VamMessage['nativeFlow']
	sendNativeFlowWithMedia: VamMessage['nativeFlowWithMedia']
	sendDocumentWithButtons: VamMessage['documentWithButtons']
	sendImageWithButtons: VamMessage['imageWithButtons']
	sendVideoWithButtons: VamMessage['videoWithButtons']
	sendStep: VamMessage['step']
	sendCarousel: LexzyMessage['carousel']
	sendRichText: RepanMessage['richText']
	sendPanel: RepanMessage['panel']
	sendMenu: RepanMessage['menu']
	sendDashboard: RepanMessage['dashboard']
	sendSelect: RepanMessage['select']
	sendActionDeck: RepanMessage['actionDeck']
	sendButtonMessage: RepanMessage['buttonMessage']
}

export const createLexzyMessage = (socket: RepanMessageSocket) => new LexzyMessage(socket)
export const createVamMessage = (socket: RepanMessageSocket) => new VamMessage(socket)
export const createRepanMessage = (socket: RepanMessageSocket) => new RepanMessage(socket)
export const createRichMessage = (socket: RepanMessageSocket) => new RichMessage(socket)
export const createRepanSuite = (socket: RepanMessageSocket): RepanSuite => {
	const repan = new RepanMessage(socket)
	return {
		vam: new VamMessage(socket),
		lexzy: new LexzyMessage(socket),
		repan,
		rich: new RichMessage(socket),
		send: repan.auto
	}
}

/** Create a destructuring-safe collection of reusable message functions for bot handlers. */
export const createRepanFunctions = (
	socket: RepanMessageSocket,
	options: RepanPlerOptions = {}
): RepanFunctionSuite => {
	const suite = createRepanSuite(socket)
	const repanPlerEnabled = options.RepanPler === true
	return {
		...suite,
		RepanPler: repanPlerEnabled,
		filterUpsert: <T extends RepanPlerUpsertEvent>(event: T) => filterRepanPlerUpsert(event, repanPlerEnabled),
		isVisibleMessage: (message: WAMessage) => isRepanPlerVisibleMessage(message, repanPlerEnabled),
		sendAny: suite.vam.sendAny,
		sendText: suite.vam.text,
		sendReply: suite.vam.reply,
		sendImage: suite.vam.image,
		sendVideo: suite.vam.video,
		sendAudio: suite.vam.audio,
		sendDocument: suite.vam.document,
		sendSticker: suite.vam.sticker,
		sendMedia: suite.vam.sendMedia,
		sendReaction: suite.vam.reaction,
		deleteMessage: suite.vam.delete,
		forwardMessage: suite.vam.forward,
		editMessage: suite.vam.editText,
		sendPoll: suite.vam.poll,
		sendEvent: suite.vam.event,
		sendLocation: suite.vam.location,
		sendAlbum: suite.vam.album,
		sendContact: suite.vam.contact,
		sendContacts: suite.vam.contacts,
		sendGroupInvite: suite.vam.groupInvite,
		sendListReply: suite.vam.listReply,
		sendButtonReply: suite.vam.buttonReply,
		sendProduct: suite.vam.product,
		sharePhoneNumber: suite.vam.sharePhoneNumber,
		requestPhoneNumber: suite.vam.requestPhoneNumber,
		pinMessage: suite.vam.pin,
		sendLimitSharing: suite.vam.limitSharing,
		sendDisappearing: suite.vam.disappearing,
		setDisappearing: suite.vam.disappearing,
		sendRaw: suite.vam.sendRaw,
		sendNativeFlow: suite.vam.nativeFlow,
		sendNativeFlowWithMedia: suite.vam.nativeFlowWithMedia,
		sendDocumentWithButtons: suite.vam.documentWithButtons,
		sendImageWithButtons: suite.vam.imageWithButtons,
		sendVideoWithButtons: suite.vam.videoWithButtons,
		sendStep: suite.vam.step,
		sendCarousel: suite.lexzy.carousel,
		sendRichText: suite.repan.richText,
		sendPanel: suite.repan.panel,
		sendMenu: suite.repan.menu,
		sendDashboard: suite.repan.dashboard,
		sendSelect: suite.repan.select,
		sendActionDeck: suite.repan.actionDeck,
		sendButtonMessage: suite.repan.buttonMessage
	}
}
