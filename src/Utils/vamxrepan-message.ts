import { proto } from '../../WAProto/index.js'
import type {
	AlbumMessageOptions,
	EventMessageOptions,
	PollMessageOptions,
	WALocationMessage,
	WAMessage,
	WAMessageKey,
	WASendableProduct
} from '../Types/index.js'
import {
	RepTzyMessage,
	type RepTzyMessageInput,
	type RepTzyMessageOptions,
	getSupportedRepTzyMessageFields
} from './reptzy-message.js'
import type {
	RepanMessageSocket,
	RepanMediaInput,
	VamMediaContentOptions,
	VamTextContentOptions,
	RepanRelayOptions,
	RepanActionDeckOptions,
	RepanMenuOptions,
	RepanSelectOptions,
	VamFlowOptions,
	VamInteractiveSendOptions
} from './repan-message.js'

export type VamXRepanDiagnosticOptions = { diagnostics?: boolean }
export type VamXRepanFailureStage = 'validation' | 'connection' | 'media' | 'encryption' | 'relay' | 'unknown'

export type VamXRepanSendFailure = {
	ok: false
	jid: string
	messageType: string
	stage: VamXRepanFailureStage
	code?: string | number
	reason: string
	suggestion: string
	timestamp: number
}

export class VamXRepanSendError extends Error {
	readonly report: VamXRepanSendFailure
	readonly cause: unknown

	constructor(report: VamXRepanSendFailure, cause: unknown) {
		super(`[VamXRepan] ${report.messageType} gagal dikirim: ${report.reason}`)
		this.name = 'VamXRepanSendError'
		this.report = report
		this.cause = cause
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const GENERIC_SEND_METHODS = new Set([
	'unknown', 'send', 'sendMessage', 'dispatch', 'relay', 'sendProto', 'raw', 'sendRaw', 'auto', 'sendAny'
])

const describeMessage = (input: RepTzyMessageInput, fallback = 'unknown'): string => {
	if (!GENERIC_SEND_METHODS.has(fallback)) return fallback
	if (!isRecord(input)) return fallback
	const record = input as unknown as Record<string, unknown>
	if (record.format === 'media' && isRecord(record.media)) return `${String(record.media.type ?? 'unknown')} media`
	if (record.type && record.media !== undefined) return `${String(record.type)} media`
	if (record.format === 'proto' && isRecord(record.message)) {
		return Object.keys(record.message).join(', ') || 'empty protobuf'
	}
	const keys = Object.keys(record).filter(key => !/^\d+$/.test(key))
	return keys.length ? keys.slice(0, 3).join(', ') : fallback
}

const readErrorCode = (error: unknown): string | number | undefined => {
	if (!isRecord(error)) return undefined
	const direct = error.code
	if (typeof direct === 'string' || typeof direct === 'number') return direct
	const status = error.statusCode
	if (typeof status === 'string' || typeof status === 'number') return status
	const output = isRecord(error.output) ? error.output : undefined
	const nested = output?.statusCode
	return typeof nested === 'string' || typeof nested === 'number' ? nested : undefined
}

const getErrorText = (error: unknown): string => {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	try { return JSON.stringify(error) } catch { return String(error) }
}

const diagnoseSendFailure = (jid: string, input: RepTzyMessageInput, error: unknown, fallbackType = 'unknown'): VamXRepanSendFailure => {
	const reason = getErrorText(error) || 'Unknown send error'
	const lower = reason.toLowerCase()
	const code = readErrorCode(error)
	let stage: VamXRepanFailureStage = 'unknown'
	let suggestion = 'Periksa detail error, versi WhatsApp Web, dan coba kirim pesan teks sederhana untuk memisahkan masalah transport dari payload.'

	if (/invalid.*jid|jid.*invalid|not a valid jid|recipient.*invalid/.test(lower)) {
		stage = 'validation'
		suggestion = 'Pastikan JID tujuan benar, misalnya 62812xxxxxxx@s.whatsapp.net atau ID grup yang valid.'
	} else if (/invalid|unsupported|schema|protobuf|unknown field|must contain|needs a message|must be between|must be a non-empty|requires a valid absolute|must be an object|exactly one supported field|only allows http/.test(lower)) {
		stage = 'validation'
		suggestion = 'Cek nama field dan bentuk payload terhadap supportedProtoFields. Untuk media, gunakan helper Image, Video, Audio, Document, atau Sticker agar upload metadata dibuat oleh Baileys.'
	} else if (/media|upload|decrypt.*media|download.*media|content-length/.test(lower)) {
		stage = 'media'
		suggestion = 'Periksa file/URL media, MIME type, ukuran, koneksi upload, dan pastikan sumber media masih dapat diakses.'
	} else if (/encrypt|signal|session|sender.key|all encryptions failed|device list/.test(lower)) {
		stage = 'encryption'
		suggestion = 'Periksa auth state, sesi perangkat penerima, metadata grup, dan koneksi. Pastikan hanya satu proses memakai folder auth yang sama.'
	} else if (/connection closed|not open|websocket|socket.*closed|timed out|timeout|econnreset|etimedout|enotfound|eai_again|fetch failed|network/.test(lower)) {
		stage = 'connection'
		suggestion = 'Tunggu socket kembali connection: open, cek internet/DNS, lalu kirim ulang secara manual setelah status koneksi pulih.'
	} else if (typeof code === 'number' && (code === 401 || code === 403)) {
		stage = 'connection'
		suggestion = 'Sesi WhatsApp tidak diotorisasi atau akses ditolak. Cek status login dan tautkan ulang perangkat jika perlu.'
	} else if (typeof code === 'number' && code >= 400 && code < 500) {
		stage = 'validation'
		suggestion = 'Server menolak payload atau tujuan. Cek JID, fitur pesan yang didukung client, dan field protobuf wajib.'
	} else if (typeof code === 'number' && code >= 500) {
		stage = 'relay'
		suggestion = 'Server atau proses relay sedang gagal. Periksa koneksi, coba lagi setelah socket stabil, dan simpan error lengkap.'
	}

	return { ok: false, jid, messageType: describeMessage(input, fallbackType), stage, ...(code !== undefined ? { code } : {}), reason, suggestion, timestamp: Date.now() }
}

/** Bind helper-class methods too, so destructuring a nested API method keeps its parent. */
const bindMessageHelperMethods = <T extends object>(instance: T): T => {
	const prototype = Object.getPrototypeOf(instance) as object | null
	if (!prototype) return instance
	for (const name of Object.getOwnPropertyNames(prototype)) {
		if (name === 'constructor' || Object.prototype.hasOwnProperty.call(instance, name)) continue
		const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
		if (typeof descriptor?.value !== 'function') continue
		Object.defineProperty(instance, name, {
			configurable: true,
			enumerable: false,
			writable: true,
			value: descriptor.value.bind(instance)
		})
	}
	return instance
}

/** Shared type-specific helpers use the same underlying validated send router. */
export class RepanSendMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, input: RepTzyMessageInput, options: RepTzyMessageOptions = {}) { return this.parent.send(jid, input, options) }
	text(jid: string, text: string, content: VamTextContentOptions = {}, options: RepTzyMessageOptions = {}) { return this.parent.text(jid, text, content, options) }
	proto(jid: string, message: proto.IMessage, options: RepanRelayOptions = {}) { return this.parent.sendProto(jid, message, options) }
}

export class RepanTextMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, text: string, content: VamTextContentOptions = {}, options: RepTzyMessageOptions = {}) { return this.parent.text(jid, text, content, options) }
	reply(jid: string, quoted: WAMessage, text: string, content: VamTextContentOptions = {}, options: RepTzyMessageOptions = {}) { return this.parent.reply(jid, quoted, text, content, options) }
}

export class RepanImageMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, media: Extract<RepanMediaInput, { type: 'image' }>['media'], options: VamMediaContentOptions = {}, sendOptions: RepTzyMessageOptions = {}) { return this.parent.image(jid, media, options, sendOptions) }
}

export class RepanVideoMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, media: Extract<RepanMediaInput, { type: 'video' }>['media'], options: VamMediaContentOptions = {}, sendOptions: RepTzyMessageOptions = {}) { return this.parent.video(jid, media, options, sendOptions) }
}

export class RepanAudioMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, media: Extract<RepanMediaInput, { type: 'audio' }>['media'], options: Pick<VamMediaContentOptions, 'mimetype' | 'ptt' | 'seconds'> = {}, sendOptions: RepTzyMessageOptions = {}) { return this.parent.audio(jid, media, options, sendOptions) }
}

export class RepanDocumentMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, media: Extract<RepanMediaInput, { type: 'document' }>['media'], mimetype = 'application/octet-stream', options: Omit<VamMediaContentOptions, 'mimetype'> = {}, sendOptions: RepTzyMessageOptions = {}) { return this.parent.document(jid, media, mimetype, options, sendOptions) }
}

export class RepanStickerMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, media: Extract<RepanMediaInput, { type: 'sticker' }>['media'], options: Pick<VamMediaContentOptions, 'isAnimated' | 'width' | 'height'> = {}, sendOptions: RepTzyMessageOptions = {}) { return this.parent.sticker(jid, media, options, sendOptions) }
}

export class RepanLocationMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, location: WALocationMessage, options: RepTzyMessageOptions = {}) { return this.parent.location(jid, location, options) }
}

export class RepanLiveLocationMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, location: proto.Message.ILiveLocationMessage, options: RepanRelayOptions = {}) { return this.parent.liveLocation(jid, location, options) }
}

export class RepanPollMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, poll: PollMessageOptions, options: RepTzyMessageOptions = {}) { return this.parent.poll(jid, poll, options) }
}

export class RepanEventMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, event: EventMessageOptions, options: RepTzyMessageOptions = {}) { return this.parent.event(jid, event, options) }
}

export class RepanReactionMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, key: WAMessageKey, text: string, options: RepTzyMessageOptions = {}) { return this.parent.reaction(jid, key, text, options) }
}

export class RepanContactMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, contact: proto.Message.IContactMessage, options: RepTzyMessageOptions = {}) { return this.parent.contact(jid, contact, options) }
	sendMany(jid: string, contacts: proto.Message.IContactMessage[], displayName?: string, options: RepTzyMessageOptions = {}) { return this.parent.contacts(jid, contacts, displayName, options) }
}

export class RepanAlbumMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, album: AlbumMessageOptions, options: RepTzyMessageOptions = {}) { return this.parent.album(jid, album, options) }
}

export class RepanProductMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, product: WASendableProduct, options: RepTzyMessageOptions = {}) { return this.parent.product(jid, product, options) }
}

export class RepanInteractiveMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	nativeFlow(jid: string, flow: VamFlowOptions, options: VamInteractiveSendOptions = {}) { return this.parent.nativeFlow(jid, flow, options) }
	select(jid: string, menu: RepanSelectOptions, options: VamInteractiveSendOptions = {}) { return this.parent.select(jid, menu, options) }
	menu(jid: string, menu: RepanMenuOptions, options: RepanRelayOptions = {}) { return this.parent.menu(jid, menu, options) }
	actionDeck(jid: string, deck: RepanActionDeckOptions, options: VamInteractiveSendOptions = {}) { return this.parent.actionDeck(jid, deck, options) }
}

export class RepanMediaMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, input: RepanMediaInput, options: RepTzyMessageOptions = {}) { return this.parent.media(jid, input, options) }
}

export class RepanUrlMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	send(jid: string, url: string, content: VamTextContentOptions = {}, options: RepTzyMessageOptions = {}) {
		return this.parent.guardSend(jid, 'url', { url }, () => {
			let parsed: URL
			try { parsed = new URL(url) } catch { throw new TypeError('URL message requires a valid absolute URL') }
			if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new TypeError('URL message only allows HTTP(S) links')
			return this.parent.text(jid, url, content, options)
		})
	}
}

const PAYMENT_PROTO_FIELDS = new Set(['sendPaymentMessage', 'requestPaymentMessage', 'declinePaymentRequestMessage', 'cancelPaymentRequestMessage', 'paymentInviteMessage'])
export class RepanPaymentMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	supportedFields(): readonly string[] { return [...PAYMENT_PROTO_FIELDS] }
	send(jid: string, message: proto.IMessage, options: RepanRelayOptions = {}) {
		return this.parent.guardSend(jid, 'payment', message, () => {
			const paymentFields = message ? Object.keys(message).filter(field => PAYMENT_PROTO_FIELDS.has(field)) : []
			if (paymentFields.length !== 1) {
				throw new TypeError(`Payment protobuf must contain exactly one supported field (${[...PAYMENT_PROTO_FIELDS].join(', ')})`)
			}
			return this.parent.sendProto(jid, message, options)
		})
	}
}

export class RepanProtoMessage {
	constructor(private readonly parent: VamXRepanMessage) { bindMessageHelperMethods(this) }
	supportedFields() { return getSupportedRepTzyMessageFields() }
	build(message: proto.IMessage) { return this.parent.buildProto(message) }
	encode(message: proto.IMessage) { return this.parent.encodeProto(message) }
	decode(bytes: Uint8Array) { return this.parent.decodeProto(bytes) }
	send(jid: string, message: proto.IMessage, options: RepanRelayOptions = {}) { return this.parent.sendProto(jid, message, options) }
}

export type VamXRepanSendResult =
	| { ok: true; status: 'submitted'; jid: string; messageType: string; message?: WAMessage }
	| VamXRepanSendFailure

/**
 * Public replacement for application-level Relay.Message calls.
 * The underlying Baileys relayMessage transport remains internal and keeps its
 * Signal encryption, device fan-out, sender-key and retry implementation intact.
 */
export class VamXRepanMessage extends RepTzyMessage {
	readonly Send: RepanSendMessage
	readonly Text: RepanTextMessage
	readonly Image: RepanImageMessage
	readonly Video: RepanVideoMessage
	readonly Audio: RepanAudioMessage
	readonly Document: RepanDocumentMessage
	readonly Sticker: RepanStickerMessage
	readonly Location: RepanLocationMessage
	readonly LiveLocation: RepanLiveLocationMessage
	readonly Poll: RepanPollMessage
	readonly Event: RepanEventMessage
	readonly Reaction: RepanReactionMessage
	readonly Contact: RepanContactMessage
	readonly Album: RepanAlbumMessage
	readonly Product: RepanProductMessage
	readonly Interactive: RepanInteractiveMessage
	readonly Media: RepanMediaMessage
	readonly Url: RepanUrlMessage
	readonly Payment: RepanPaymentMessage
	readonly Proto: RepanProtoMessage
	private readonly diagnostics: boolean

	constructor(socket: RepanMessageSocket, options: VamXRepanDiagnosticOptions = {}) {
		super(socket)
		this.diagnostics = options.diagnostics ?? true
		this.Send = new RepanSendMessage(this)
		this.Text = new RepanTextMessage(this)
		this.Image = new RepanImageMessage(this)
		this.Video = new RepanVideoMessage(this)
		this.Audio = new RepanAudioMessage(this)
		this.Document = new RepanDocumentMessage(this)
		this.Sticker = new RepanStickerMessage(this)
		this.Location = new RepanLocationMessage(this)
		this.LiveLocation = new RepanLiveLocationMessage(this)
		this.Poll = new RepanPollMessage(this)
		this.Event = new RepanEventMessage(this)
		this.Reaction = new RepanReactionMessage(this)
		this.Contact = new RepanContactMessage(this)
		this.Album = new RepanAlbumMessage(this)
		this.Product = new RepanProductMessage(this)
		this.Interactive = new RepanInteractiveMessage(this)
		this.Media = new RepanMediaMessage(this)
		this.Url = new RepanUrlMessage(this)
		this.Payment = new RepanPaymentMessage(this)
		this.Proto = new RepanProtoMessage(this)
		this.wrapSendFacadeMethods()
	}

	private runSend(jid: string, input: RepTzyMessageInput, options: RepTzyMessageOptions = {}) {
		let operation: Promise<WAMessage | undefined | void>
		try {
			operation = super.sendMessage(jid, input, options)
		} catch (error) {
			return Promise.reject(this.createSendError(jid, input, error))
		}
		return Promise.resolve(operation).catch(error => { throw this.createSendError(jid, input, error) })
	}

	private wrapSendFacadeMethods(): void {
		const methods = [
			'send', 'sendMessage', 'dispatch', 'relay', 'sendProto', 'raw', 'sendRaw',
			'auto', 'sendAny', 'text', 'reply', 'image', 'video', 'audio', 'document', 'sticker',
			'media', 'sendMedia', 'reaction', 'delete', 'forward', 'editText', 'disappearing', 'location',
			'liveLocation', 'contact', 'contacts', 'poll', 'event', 'groupInvite', 'listReply', 'buttonReply',
			'sharePhoneNumber', 'requestPhoneNumber', 'pin', 'limitSharing', 'nativeFlow',
			'nativeFlowWithMedia', 'documentWithButtons', 'imageWithButtons', 'videoWithButtons',
			'step', 'carousel', 'menu', 'dashboard', 'actionDeck', 'buttonMessage', 'select',
			'panel', 'richText', 'album', 'sendAlbum', 'product'
		]

		for (const methodName of methods) {
			const original = (this as unknown as Record<string, unknown>)[methodName]
			if (typeof original !== 'function') continue
			Object.defineProperty(this, methodName, {
				configurable: true,
				enumerable: false,
				writable: true,
				value: (...args: unknown[]) => {
					const jid = typeof args[0] === 'string' ? args[0] : 'unknown'
					const rawInput = args[1]
					const input = (isRecord(rawInput) ? rawInput : { [methodName]: true }) as unknown as RepTzyMessageInput
					try {
						const result = (original as (...values: unknown[]) => unknown).apply(this, args)
						if (result && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
							return Promise.resolve(result).catch(error => { throw this.createSendError(jid, input, error, methodName) })
						}
						return result
					} catch (error) {
						throw this.createSendError(jid, input, error, methodName)
					}
				}
			})
		}
	}

	private createSendError(jid: string, input: RepTzyMessageInput, error: unknown, fallbackType = 'unknown'): VamXRepanSendError {
		if (error instanceof VamXRepanSendError) return error
		const report = diagnoseSendFailure(jid, input, error, fallbackType)
		const socketWithEvents = this.socket as RepanMessageSocket & {
			ev?: { emit?: (event: 'messages.send-error', data: VamXRepanSendFailure) => unknown }
		}
		try { socketWithEvents.ev?.emit?.('messages.send-error', report) } catch { /* diagnostic listeners must not hide the original send error */ }
		if (this.diagnostics) {
			const code = report.code === undefined ? '' : ` [${report.code}]`
			console.error(`\n[VamXRepan SEND ERROR] ${report.messageType}${code}\n  Penyebab: ${report.reason}\n  Saran: ${report.suggestion}\n`)
		}
		return new VamXRepanSendError(report, error)
	}

	/** @internal Route helper preflight failures through the same typed send diagnostics. */
	guardSend<T>(jid: string, messageType: string, input: unknown, operation: () => T): T {
		const diagnosticInput = (isRecord(input) ? input : { [messageType]: true }) as unknown as RepTzyMessageInput
		try {
			const result = operation()
			if (result && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
				return Promise.resolve(result).catch(error => { throw this.createSendError(jid, diagnosticInput, error, messageType) }) as T
			}
			return result
		} catch (error) {
			throw this.createSendError(jid, diagnosticInput, error, messageType)
		}
	}

	/** Universal send API for standard content, media wrappers, and schema-valid IMessage objects. */
	override sendMessage(jid: string, input: RepTzyMessageInput, options: RepTzyMessageOptions = {}) {
		return this.runSend(jid, input, options)
	}

	/** Alias that keeps older VamMessage-style call sites working with proto-aware routing. */
	override send(jid: string, content: RepTzyMessageInput, options: RepTzyMessageOptions = {}) {
		return this.runSend(jid, content as RepTzyMessageInput, options)
	}

	dispatch(jid: string, input: RepTzyMessageInput, options: RepTzyMessageOptions = {}) {
		return this.runSend(jid, input, options)
	}

	relay(jid: string, input: RepTzyMessageInput, options: RepTzyMessageOptions = {}) {
		return this.runSend(jid, input, options)
	}

	/** Send an existing-schema live-location payload through validated protobuf relay. */
	liveLocation(jid: string, location: proto.Message.ILiveLocationMessage, options: RepanRelayOptions = {}) {
		if (!isRecord(location)) throw new TypeError('Live location must be an object')
		const latitude = location.degreesLatitude
		const longitude = location.degreesLongitude
		if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
			throw new RangeError('Live location latitude must be between -90 and 90')
		}
		if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
			throw new RangeError('Live location longitude must be between -180 and 180')
		}
		return this.sendProto(jid, { liveLocationMessage: location }, options)
	}

	/** Returns an inspectable result instead of throwing; it still reports failures to the socket event. */
	async sendDetailed(jid: string, input: RepTzyMessageInput, options: RepTzyMessageOptions = {}): Promise<VamXRepanSendResult> {
		try {
			const result = await this.runSend(jid, input, options)
			return { ok: true, status: 'submitted', jid, messageType: describeMessage(input), ...(result && typeof result === 'object' && 'key' in result ? { message: result as WAMessage } : {}) }
		} catch (error) {
			if (error instanceof VamXRepanSendError) return error.report
			return diagnoseSendFailure(jid, input, error)
		}
	}
}

export { VamXRepanMessage as VamXRepanMessageAPI }
