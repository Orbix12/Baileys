import type { proto } from '../../WAProto/index.js'
import type { MessageRelayOptions } from '../Types/index.js'
import { isHostedLidUser, isHostedPnUser, isLidUser, isPnUser, type BinaryNode } from '../WABinary/index.js'

/**
 * Repan delivery lane.
 *
 * Interactive WhatsApp payloads (Native Flow, carousel, list and classic buttons) are not
 * ordinary `sendMessage()` content. To render on current clients they must travel as:
 *
 *   1. a `viewOnceMessage` envelope whose inner message carries `messageContextInfo`
 *      (device-list metadata v2), and
 *   2. a `<biz>` binary node attached to the stanza that tells the server which interactive
 *      family is being sent.
 *
 * This module builds both parts. It never touches non-interactive messages, so text, media,
 * polls, reactions etc. keep using the stock `sendMessage()` path untouched.
 */

export type RepanInteractiveKind = 'native_flow' | 'carousel' | 'buttons' | 'list'

/** Native Flow actions that need a dedicated `native_flow name=...` hint instead of `mixed`. */
const SPECIAL_NATIVE_FLOW_NAMES = new Set([
	'mpm',
	'cta_catalog',
	'send_location',
	'call_permission_request',
	'wa_payment_transaction_details',
	'automated_greeting_message_view_catalog'
])

/** Envelope keys that already wrap interactive content; we never double-wrap these. */
const ENVELOPE_KEYS = [
	'viewOnceMessage',
	'viewOnceMessageV2',
	'viewOnceMessageV2Extension',
	'ephemeralMessage',
	'documentWithCaptionMessage'
] as const

const hasEnvelope = (message: proto.IMessage) => ENVELOPE_KEYS.some(key => Boolean(message[key]))

/** Return the inner message of a Repan envelope (or the message itself when it is not wrapped). */
export const unwrapRepanMessage = (message: proto.IMessage): proto.IMessage => {
	let current = message
	for (let depth = 0; depth < 4; depth += 1) {
		const inner =
			current.viewOnceMessage?.message ??
			current.viewOnceMessageV2?.message ??
			current.viewOnceMessageV2Extension?.message ??
			current.ephemeralMessage?.message ??
			current.documentWithCaptionMessage?.message
		if (!inner) break
		current = inner
	}
	return current
}

/** Classify a message by the interactive family it belongs to, or `undefined` if it is not interactive. */
export const getRepanInteractiveKind = (message: proto.IMessage): RepanInteractiveKind | undefined => {
	const content = unwrapRepanMessage(message)
	if (content.listMessage) return 'list'
	if (content.buttonsMessage) return 'buttons'
	if (content.interactiveMessage?.carouselMessage) return 'carousel'
	if (content.interactiveMessage?.nativeFlowMessage) return 'native_flow'
	return undefined
}

/**
 * Ensure an existing envelope has the device-list metadata required by the interactive lane.
 * Raw callers may supply a view-once/ephemeral wrapper themselves; preserve their other fields
 * while normalizing the innermost message instead of treating the envelope as already valid.
 */
const ensureInteractiveMetadata = (message: proto.IMessage, depth = 0): proto.IMessage => {
	if (depth >= 4) return message

	if (message.viewOnceMessage?.message) {
		return {
			...message,
			viewOnceMessage: {
				...message.viewOnceMessage,
				message: ensureInteractiveMetadata(message.viewOnceMessage.message, depth + 1)
			}
		}
	}
	if (message.viewOnceMessageV2?.message) {
		return {
			...message,
			viewOnceMessageV2: {
				...message.viewOnceMessageV2,
				message: ensureInteractiveMetadata(message.viewOnceMessageV2.message, depth + 1)
			}
		}
	}
	if (message.viewOnceMessageV2Extension?.message) {
		return {
			...message,
			viewOnceMessageV2Extension: {
				...message.viewOnceMessageV2Extension,
				message: ensureInteractiveMetadata(message.viewOnceMessageV2Extension.message, depth + 1)
			}
		}
	}
	if (message.ephemeralMessage?.message) {
		return {
			...message,
			ephemeralMessage: {
				...message.ephemeralMessage,
				message: ensureInteractiveMetadata(message.ephemeralMessage.message, depth + 1)
			}
		}
	}
	if (message.documentWithCaptionMessage?.message) {
		return {
			...message,
			documentWithCaptionMessage: {
				...message.documentWithCaptionMessage,
				message: ensureInteractiveMetadata(message.documentWithCaptionMessage.message, depth + 1)
			}
		}
	}

	const contextInfo = message.messageContextInfo
	return {
		...message,
		messageContextInfo: {
			...(contextInfo ?? {}),
			deviceListMetadata: contextInfo?.deviceListMetadata ?? {},
			deviceListMetadataVersion: contextInfo?.deviceListMetadataVersion ?? 2
		}
	}
}

/** Wrap an interactive message in the envelope WhatsApp clients expect. Other messages pass through. */
export const wrapRepanInteractive = (message: proto.IMessage): proto.IMessage => {
	if (!getRepanInteractiveKind(message)) return message
	if (hasEnvelope(message)) return ensureInteractiveMetadata(message)
	return {
		viewOnceMessage: {
			message: {
				messageContextInfo: {
					deviceListMetadata: {},
					deviceListMetadataVersion: 2
				},
				...message
			}
		}
	}
}

const nativeFlowHint = (name: string, version: string): BinaryNode => ({
	tag: 'biz',
	attrs: {},
	content: [
		{
			tag: 'interactive',
			attrs: { type: 'native_flow', v: '1' },
			content: [{ tag: 'native_flow', attrs: { v: version, name } }]
		}
	]
})

/** Build the `<biz>` node for an interactive message, or `undefined` when none is needed. */
export const getRepanBizNode = (message: proto.IMessage): BinaryNode | undefined => {
	const kind = getRepanInteractiveKind(message)
	if (!kind) return undefined
	const content = unwrapRepanMessage(message)

	if (kind === 'list') {
		return { tag: 'biz', attrs: {}, content: [{ tag: 'list', attrs: { v: '2', type: 'product_list' } }] }
	}

	if (kind === 'native_flow') {
		const firstName = content.interactiveMessage?.nativeFlowMessage?.buttons?.[0]?.name ?? ''
		if (firstName === 'review_and_pay' || firstName === 'payment_info') {
			return {
				tag: 'biz',
				attrs: { native_flow_name: firstName === 'review_and_pay' ? 'order_details' : firstName }
			}
		}
		if (SPECIAL_NATIVE_FLOW_NAMES.has(firstName)) return nativeFlowHint(firstName, '2')
	}

	// quick_reply / cta_url / cta_call / cta_copy / single_select, carousel and classic buttons
	return nativeFlowHint('mixed', '9')
}

const hasBizNode = (nodes: readonly BinaryNode[] | undefined) => Boolean(nodes?.some(node => node.tag === 'biz'))

export type RepanDeliveryPlan = {
	/** The message to relay (enveloped when it is interactive). */
	message: proto.IMessage
	/** relay options with the biz hint merged in; caller-supplied nodes are preserved. */
	options: MessageRelayOptions
}

/**
 * Prepare a message and its relay options for delivery.
 * Non-interactive messages are returned unchanged (same object, same options).
 */
export const planRepanDelivery = (
	jid: string,
	message: proto.IMessage,
	options: MessageRelayOptions = {}
): RepanDeliveryPlan => {
	const kind = getRepanInteractiveKind(message)
	if (!kind) return { message, options }

	const additionalNodes = [...(options.additionalNodes ?? [])]
	if (!hasBizNode(additionalNodes)) {
		const biz = getRepanBizNode(message)
		if (biz) additionalNodes.push(biz)
	}

	// Keep custom caller-supplied <biz> metadata and still attach the private-chat bot hint.
	// Only known one-to-one PN/LID JIDs qualify; broadcast/group/newsletter targets do not.
	const isPrivate = isPnUser(jid) || isLidUser(jid) || isHostedPnUser(jid) || isHostedLidUser(jid)
	if (isPrivate && !additionalNodes.some(node => node.tag === 'bot')) {
		additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })
	}

	return { message: wrapRepanInteractive(message), options: { ...options, additionalNodes } }
}
