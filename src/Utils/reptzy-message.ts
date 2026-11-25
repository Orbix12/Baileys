import { proto } from '../../WAProto/index.js'
import type { AnyMessageContent, WAMessage } from '../Types/index.js'
import {
	isRepanProtoMessage,
	RepanMessage,
	type RepanAutoOptions,
	type RepanMediaInput,
	type RepanMessageSocket,
	type RepanRelayOptions
} from './repan-message.js'
import { normalizeRelayMessage } from './message-relay.js'

/**
 * Explicit input wrappers remove ambiguity for callers that want to choose the
 * normal sendMessage pipeline, the validated protobuf relay pipeline, or media.
 */
export type RepTzyMessageEnvelope =
	| { format: 'content'; content: AnyMessageContent }
	| { format: 'proto'; message: proto.IMessage }
	| { format: 'media'; media: RepanMediaInput }

/**
 * RepTzy accepts every regular Baileys AnyMessageContent payload and every
 * top-level field present in this package's generated WhatsApp proto.IMessage.
 */
export type RepTzyMessageInput = AnyMessageContent | proto.IMessage | RepTzyMessageEnvelope
export type RepTzyMessageOptions = RepanAutoOptions

const PROTO_MESSAGE_FIELDS = Object.freeze(
	Object.keys(proto.Message.prototype).filter(
		key => (proto.Message.prototype as unknown as Record<string, unknown>)[key] === null
	).sort()
)

const PROTO_MESSAGE_FIELD_SET = new Set(PROTO_MESSAGE_FIELDS)

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/** Stable, read-only inventory of the generated IMessage fields supported by this build. */
export const getSupportedRepTzyMessageFields = (): readonly string[] => PROTO_MESSAGE_FIELDS

/** True when the object contains only recognized top-level fields from proto.IMessage. */
export const isRepTzyProtoMessage = (value: unknown): value is proto.IMessage => {
	if (!isRepanProtoMessage(value) || !isRecord(value)) return false
	return Object.keys(value).every(key => PROTO_MESSAGE_FIELD_SET.has(key))
}

/**
 * Unified message facade. It inherits the Vam/Lexzy/Repan/Rich helpers and adds
 * one dispatcher for ordinary content, media and already-built protobuf payloads.
 *
 * `relayMessage()` remains the private transport lane used by the underlying
 * Baileys socket; this class replaces the need for application code to call that
 * low-level method directly. It does not invent a new WhatsApp wire message type.
 */
export class RepTzyMessage extends RepanMessage {
	constructor(socket: RepanMessageSocket) {
		super(socket)
	}

	/** All top-level IMessage keys available in the bundled generated schema. */
	get supportedProtoFields(): readonly string[] {
		return getSupportedRepTzyMessageFields()
	}

	/**
	 * Universal entry point. Plain AnyMessageContent and proto.IMessage objects are
	 * auto-detected. Use a `format` envelope when the caller wants an explicit route.
	 */
	sendMessage(
		jid: string,
		input: RepTzyMessageInput,
		options: RepTzyMessageOptions = {}
	): Promise<WAMessage | undefined | void> {
		if (!isRecord(input)) {
			throw new TypeError('RepTzyMessage.sendMessage() needs a message object')
		}

		const record = input as Record<string, unknown>

		if (record.format === 'content') {
			if (!isRecord(record.content)) {
				throw new TypeError('RepTzy content envelope must contain a content object')
			}
			return this.socket.sendMessage(jid, record.content as AnyMessageContent, options)
		}

		if (record.format === 'proto') {
			if (!isRepTzyProtoMessage(record.message)) {
				throw new TypeError('RepTzy proto envelope must contain a valid proto.IMessage object')
			}
			return this.sendProto(jid, record.message, options)
		}

		if (record.format === 'media') {
			if (!isRecord(record.media)) {
				throw new TypeError('RepTzy media envelope must contain a media input object')
			}
			return this.media(jid, record.media as RepanMediaInput, options)
		}

		// Keep the ordinary-content lane on the socket's public sendMessage API.
		const hasProtoField = Object.keys(input).some(key => PROTO_MESSAGE_FIELD_SET.has(key))
		if (hasProtoField) {
			if (!isRepTzyProtoMessage(input)) {
				throw new TypeError('RepTzy protobuf input contains an unsupported top-level field')
			}
			return this.sendProto(jid, input, options)
		}
		return this.socket.sendMessage(jid, input as AnyMessageContent, options)
	}

	/** Alias for `sendMessage()` when a generic dispatch verb is preferred. */
	dispatch(
		jid: string,
		input: RepTzyMessageInput,
		options: RepTzyMessageOptions = {}
	): Promise<WAMessage | undefined | void> {
		return this.sendMessage(jid, input, options)
	}

	/** Backward-friendly alias for callers moving from direct Relay.Message usage. */
	relay(
		jid: string,
		input: RepTzyMessageInput,
		options: RepTzyMessageOptions = {}
	): Promise<WAMessage | undefined | void> {
		return this.sendMessage(jid, input, options)
	}

	/** Explicit validated protobuf route for any schema-defined IMessage family. */
	async sendProto(jid: string, message: proto.IMessage, options: RepanRelayOptions = {}): Promise<void> {
		await this.raw(jid, message, options)
	}

	/** Normalize and encode-check a proto.IMessage without sending it. */
	buildProto(message: proto.IMessage): proto.IMessage {
		return normalizeRelayMessage(message)
	}

	/** Serialize a schema-valid IMessage using the exact generated package schema. */
	encodeProto(message: proto.IMessage): Uint8Array {
		return proto.Message.encode(this.buildProto(message)).finish()
	}

	/** Decode and validate bytes using this package's generated WhatsApp schema. */
	decodeProto(bytes: Uint8Array): proto.IMessage {
		if (!(bytes instanceof Uint8Array)) {
			throw new TypeError('RepTzy decodeProto() expects a Uint8Array or Buffer')
		}

		try {
			return this.buildProto(proto.Message.decode(bytes))
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			throw new TypeError(`Unable to decode RepTzy proto.IMessage: ${reason}`)
		}
	}
}

/** Create the all-in-one RepTzy message facade for one connected Baileys socket. */
export const createRepTzyMessage = (socket: RepanMessageSocket): RepTzyMessage => new RepTzyMessage(socket)

/** Function-style companion for projects that prefer a bound send function. */
export type RepTzySuite = {
	reptzy: RepTzyMessage
	send: RepTzyMessage['sendMessage']
}

export const createRepTzySuite = (socket: RepanMessageSocket): RepTzySuite => {
	const reptzy = createRepTzyMessage(socket)
	return { reptzy, send: reptzy.sendMessage }
}
