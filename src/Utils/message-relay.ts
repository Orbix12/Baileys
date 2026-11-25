import { Boom } from '@hapi/boom'
import { proto } from '../../WAProto/index.js'
import type { MessageRelayOptions } from '../Types/index.js'
import { jidDecode, type BinaryNode } from '../WABinary/index.js'
import { normalizeMessageContent } from './messages.js'

export type PreparedRelayRequest = {
	message: proto.IMessage
	options: MessageRelayOptions
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const PROTO_MESSAGE_FIELDS = new Set(
	Object.keys(proto.Message.prototype).filter(
		key => (proto.Message.prototype as unknown as Record<string, unknown>)[key] === null
	)
)

/** Validate a WhatsApp JID before it enters device lookup or encryption code. */
export const assertRelayJid: (jid: unknown, label?: string) => asserts jid is string = (
	jid,
	label = 'Destination JID'
) => {
	if (typeof jid !== 'string' || !jid || jid !== jid.trim() || /\s/.test(jid)) {
		throw new Boom(`${label} must be a non-empty JID without whitespace`, { statusCode: 400 })
	}

	const separatorIndex = jid.indexOf('@')
	if (separatorIndex <= 0 || separatorIndex !== jid.lastIndexOf('@')) {
		throw new Boom(`${label} must contain exactly one @ separator`, { statusCode: 400 })
	}

	const decoded = jidDecode(jid)
	if (!decoded?.user || !decoded.server) {
		throw new Boom(
			`${label} must include a user and server, for example 123@s.whatsapp.net`,
			{ statusCode: 400 }
		)
	}
}

/**
 * Normalize and preflight an IMessage against the bundled WhatsApp protobuf schema.
 * This runs before session lookup/encryption so malformed payloads fail early instead
 * of failing halfway through a multi-device send. It accepts legacy and newer schema
 * fields alike; only keys absent from the bundled IMessage schema are rejected.
 */
export const normalizeRelayMessage = (message: proto.IMessage): proto.IMessage => {
	if (!isRecord(message) || Object.keys(message).length === 0) {
		throw new Boom('Raw message must be a non-empty proto.IMessage object', { statusCode: 400 })
	}

	const unknownFields = Object.keys(message).filter(key => !PROTO_MESSAGE_FIELDS.has(key))
	if (unknownFields.length) {
		throw new Boom(
			`Raw message contains fields not present in the bundled WhatsApp schema: ${unknownFields.join(', ')}`,
			{ statusCode: 400 }
		)
	}

	try {
		const prepared = proto.Message.fromObject(message as unknown as Parameters<typeof proto.Message.fromObject>[0])
		const populatedFields = Object.keys(prepared).filter(key => {
			const value = (prepared as unknown as Record<string, unknown>)[key]
			return value !== undefined && value !== null
		})
		if (populatedFields.length === 0) {
			throw new Boom('Raw proto.IMessage must contain at least one populated field', { statusCode: 400 })
		}

		// Exercise the generated encoder before opening a Signal-key transaction. Media
		// bytes are already uploaded by this stage; this validates only the compact proto.
		proto.Message.encode(prepared).finish()
		return prepared
	} catch (error) {
		if (error instanceof Boom) throw error
		const reason = error instanceof Error ? error.message : String(error)
		throw new Boom(`Invalid raw proto.IMessage: ${reason}`, { statusCode: 400 })
	}
}

const validateBinaryNode: (node: unknown, label: string, depth?: number) => asserts node is BinaryNode = (
	node,
	label,
	depth = 0
) => {
	if (depth > 16) throw new Boom(`${label} exceeds the maximum nesting depth`, { statusCode: 400 })
	if (!isRecord(node) || typeof node.tag !== 'string' || !node.tag.trim() || !isRecord(node.attrs)) {
		throw new Boom(`${label} must contain a non-empty tag and an attributes object`, { statusCode: 400 })
	}
	for (const [key, value] of Object.entries(node.attrs)) {
		if (!key || typeof value !== 'string') {
			throw new Boom(
				`${label} attributes must be non-empty string keys and string values`,
				{ statusCode: 400 }
			)
		}
	}

	const content = node.content
	if (content === undefined || typeof content === 'string' || content instanceof Uint8Array) return
	if (!Array.isArray(content)) {
		throw new Boom(`${label} content must be text, bytes, or child nodes`, { statusCode: 400 })
	}
	for (let index = 0; index < content.length; index += 1) {
		validateBinaryNode(content[index], `${label} child ${index + 1}`, depth + 1)
	}
}

/** Snapshot mutable stanza metadata because relay work continues across asynchronous network steps. */
// Binary buffers may be large, so snapshot node/attribute metadata without copying byte payloads.
const cloneBinaryNode = (node: BinaryNode): BinaryNode => ({
	tag: node.tag,
	attrs: { ...node.attrs },
	...(node.content !== undefined
		? { content: Array.isArray(node.content) ? node.content.map(cloneBinaryNode) : node.content }
		: {})
})

const snapshotRelayOptions = (options: MessageRelayOptions): MessageRelayOptions => ({
	...options,
	...(options.participant ? { participant: { ...options.participant } } : {}),
	...(options.additionalAttributes ? { additionalAttributes: { ...options.additionalAttributes } } : {}),
	...(options.additionalNodes ? { additionalNodes: options.additionalNodes.map(cloneBinaryNode) } : {}),
	...(options.statusJidList ? { statusJidList: [...options.statusJidList] } : {})
})

const validateRelayOptions = (options: MessageRelayOptions = {}): MessageRelayOptions => {
	if (!isRecord(options)) throw new Boom('Relay options must be an object', { statusCode: 400 })

	if (
		options.messageId !== undefined &&
		(typeof options.messageId !== 'string' || (options.messageId.length > 0 && !options.messageId.trim()))
	) {
		throw new Boom('Relay messageId must be a string; an empty string requests an automatic ID', { statusCode: 400 })
	}
	// Preserve the historical empty-string behavior: relayMessage generates an ID when it is falsy.

	for (const key of ['useCachedGroupMetadata', 'useUserDevicesCache'] as const) {
		if (options[key] !== undefined && typeof options[key] !== 'boolean') {
			throw new Boom(`Relay option ${key} must be a boolean when provided`, { statusCode: 400 })
		}
	}

	if (options.participant !== undefined) {
		if (!isRecord(options.participant)) {
			throw new Boom('Relay participant must be an object', { statusCode: 400 })
		}
		assertRelayJid(options.participant.jid, 'Relay participant JID')
		if (
			typeof options.participant.count !== 'number' ||
			!Number.isSafeInteger(options.participant.count) ||
			options.participant.count < 0
		) {
			throw new Boom('Relay participant count must be a non-negative safe integer', { statusCode: 400 })
		}
	}

	if (options.additionalAttributes !== undefined) {
		if (!isRecord(options.additionalAttributes)) {
			throw new Boom('Relay additionalAttributes must be an object', { statusCode: 400 })
		}
		for (const [key, value] of Object.entries(options.additionalAttributes)) {
			if (!key || typeof value !== 'string') {
				throw new Boom(
					'Relay additionalAttributes must contain non-empty keys and string values',
					{ statusCode: 400 }
				)
			}
		}
	}

	if (options.additionalNodes !== undefined) {
		if (!Array.isArray(options.additionalNodes)) {
			throw new Boom('Relay additionalNodes must be an array', { statusCode: 400 })
		}
		for (let index = 0; index < options.additionalNodes.length; index += 1) {
			validateBinaryNode(options.additionalNodes[index], `Relay additional node ${index + 1}`)
		}
	}

	if (options.statusJidList !== undefined) {
		if (!Array.isArray(options.statusJidList)) {
			throw new Boom('Relay statusJidList must be an array', { statusCode: 400 })
		}
		for (let index = 0; index < options.statusJidList.length; index += 1) {
			assertRelayJid(options.statusJidList[index], `Relay status recipient ${index + 1}`)
		}
	}

	return options
}

/** Validate, normalize and prepare the complete public relay request. */
export const prepareRelayRequest = (
	jid: string,
	message: proto.IMessage,
	options: MessageRelayOptions = {}
): PreparedRelayRequest => {
	assertRelayJid(jid)
	const validatedOptions = validateRelayOptions(options)
	const preparedMessage = normalizeRelayMessage(message)

	return {
		message: preparedMessage,
		options: snapshotRelayOptions(validatedOptions)
	}
}

/** These labels intentionally match the long-standing Baileys transport values. */
const getRelayMediaTypeFromContent = (content: proto.IMessage): string => {
	if (content.imageMessage) return 'image'
	const videoMessage = content.videoMessage ?? content.ptvMessage
	if (videoMessage) return videoMessage.gifPlayback ? 'gif' : 'video'
	if (content.audioMessage) return content.audioMessage.ptt ? 'ptt' : 'audio'
	if (content.contactMessage) return 'vcard'
	if (content.documentMessage) return 'document'
	if (content.contactsArrayMessage) return 'contact_array'
	if (content.liveLocationMessage) return 'livelocation'
	if (content.stickerMessage) return 'sticker'
	if (content.listMessage) return 'list'
	if (content.listResponseMessage) return 'list_response'
	if (content.buttonsResponseMessage) return 'buttons_response'
	if (content.orderMessage) return 'order'
	if (content.productMessage) return 'product'
	if (content.interactiveResponseMessage) return 'native_flow_response'
	if (content.groupInviteMessage) return 'url'
	return ''
}

/**
 * Return the established WhatsApp stanza `mediatype` for any supported message,
 * including payloads wrapped by ephemeral, view-once, edited or caption envelopes.
 */
export const getRelayMediaType = (message: proto.IMessage): string => {
	const content = normalizeMessageContent(message) ?? message
	return getRelayMediaTypeFromContent(content)
}

/** Classify the XMPP stanza type without changing the original message family. */
export const getRelayStanzaType = (
	message: proto.IMessage
): 'reaction' | 'poll' | 'event' | 'media' | 'text' => {
	const content = normalizeMessageContent(message)
	if (!content) return 'text'
	if (content.reactionMessage || content.encReactionMessage) return 'reaction'
	if (
		content.pollCreationMessage ||
		content.pollCreationMessageV2 ||
		content.pollCreationMessageV3 ||
		content.pollCreationMessageV4 ||
		content.pollCreationMessageV5 ||
		content.pollResultSnapshotMessage ||
		content.pollResultSnapshotMessageV3 ||
		content.pollUpdateMessage
	) {
		return 'poll'
	}
	if (content.eventMessage) return 'event'
	return getRelayMediaTypeFromContent(content) ? 'media' : 'text'
}
