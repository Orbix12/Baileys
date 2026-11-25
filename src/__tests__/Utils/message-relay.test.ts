import { proto } from '../../../WAProto/index.js'
import {
	getRelayMediaType,
	getRelayStanzaType,
	normalizeRelayMessage,
	prepareRelayRequest
} from '../../Utils/message-relay.js'

describe('shared relay request preparation', () => {
	it('normalizes legacy and modern schema message families through one relay gate', () => {
		const cases: proto.IMessage[] = [
			{ conversation: 'legacy text' },
			{ extendedTextMessage: { text: 'link preview / mention text' } },
			{ imageMessage: { mimetype: 'image/jpeg' } },
			{ videoMessage: { mimetype: 'video/mp4', gifPlayback: false } },
			{ ptvMessage: { mimetype: 'video/mp4' } },
			{ audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } },
			{ documentMessage: { mimetype: 'application/pdf', fileName: 'guide.pdf' } },
			{ stickerMessage: { mimetype: 'image/webp' } },
			{ contactsArrayMessage: { displayName: 'Contacts', contacts: [] } },
			{ listResponseMessage: { title: 'Choice', singleSelectReply: { selectedRowId: 'row-1' } } },
			{ buttonsResponseMessage: { selectedButtonId: 'button-1' } },
			{ interactiveResponseMessage: { body: { text: 'Selected' } } },
			{ groupInviteMessage: { groupJid: '123@g.us', inviteCode: 'invite' } },
			{ contactMessage: { displayName: 'Contact', vcard: 'BEGIN:VCARD\nEND:VCARD' } },
			{ locationMessage: { degreesLatitude: 1, degreesLongitude: 2 } },
			{ liveLocationMessage: { degreesLatitude: 1, degreesLongitude: 2 } },
			{ pollCreationMessage: { name: 'Choose', options: [], selectableOptionsCount: 1 } },
			{ reactionMessage: { text: '👍' } },
			{ eventMessage: { name: 'Event' } },
			{ listMessage: { title: 'Menu', description: 'Choose', buttonText: 'Open', sections: [] } },
			{ buttonsMessage: { contentText: 'Choose', footerText: '', buttons: [] } },
			{ interactiveMessage: { body: { text: 'Choose' } } },
			{ productMessage: {} },
			{ orderMessage: {} },
			{ protocolMessage: { type: proto.Message.ProtocolMessage.Type.REVOKE } },
			{ messageContextInfo: { messageSecret: Buffer.from([1, 2, 3]) } }
		]

		for (const message of cases) {
			const normalized = normalizeRelayMessage(message)
			expect(Object.keys(normalized).length).toBeGreaterThan(0)
		}
	})

	it('keeps legacy media stanza metadata when the payload is wrapped', () => {
		expect(
			getRelayMediaType({ viewOnceMessage: { message: { imageMessage: { mimetype: 'image/jpeg' } } } })
		).toBe('image')
		expect(
			getRelayMediaType({ ephemeralMessage: { message: { videoMessage: { gifPlayback: true } } } })
		).toBe('gif')
		expect(
			getRelayMediaType({ documentWithCaptionMessage: { message: { documentMessage: { mimetype: 'application/pdf' } } } })
		).toBe('document')
		expect(
			getRelayMediaType({ editedMessage: { message: { audioMessage: { ptt: true } } } })
		).toBe('ptt')
		expect(
			getRelayMediaType({ viewOnceMessage: { message: { ptvMessage: { mimetype: 'video/mp4' } } } })
		).toBe('video')
	})

	it('retains the legacy media labels used by existing relay stanza attributes', () => {
		const cases: Array<[proto.IMessage, string]> = [
			[{ imageMessage: { mimetype: 'image/jpeg' } }, 'image'],
			[{ videoMessage: { mimetype: 'video/mp4' } }, 'video'],
			[{ ptvMessage: { mimetype: 'video/mp4' } }, 'video'],
			[{ videoMessage: { mimetype: 'video/mp4', gifPlayback: true } }, 'gif'],
			[{ audioMessage: { mimetype: 'audio/ogg; codecs=opus' } }, 'audio'],
			[{ audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } }, 'ptt'],
			[{ contactMessage: { displayName: 'Contact', vcard: 'BEGIN:VCARD\nEND:VCARD' } }, 'vcard'],
			[{ documentMessage: { mimetype: 'application/pdf', fileName: 'guide.pdf' } }, 'document'],
			[{ contactsArrayMessage: { displayName: 'Contacts', contacts: [] } }, 'contact_array'],
			[{ liveLocationMessage: { degreesLatitude: 1, degreesLongitude: 2 } }, 'livelocation'],
			[{ stickerMessage: { mimetype: 'image/webp' } }, 'sticker'],
			[{ listMessage: { title: 'Menu', description: 'Choose', buttonText: 'Open', sections: [] } }, 'list'],
			[{ listResponseMessage: { title: 'Choice', singleSelectReply: { selectedRowId: 'row-1' } } }, 'list_response'],
			[{ buttonsResponseMessage: { selectedButtonId: 'button-1' } }, 'buttons_response'],
			[{ orderMessage: {} }, 'order'],
			[{ productMessage: {} }, 'product'],
			[{ interactiveResponseMessage: { body: { text: 'Selected' } } }, 'native_flow_response'],
			[{ groupInviteMessage: { groupJid: '123@g.us', inviteCode: 'invite' } }, 'url']
		]

		for (const [message, expected] of cases) {
			expect(getRelayMediaType(message)).toBe(expected)
		}
	})
	it('preserves the stanza family for text, reactions, polls, events and media', () => {
		expect(getRelayStanzaType({ conversation: 'hello' })).toBe('text')
		expect(getRelayStanzaType({ reactionMessage: { text: '👍' } })).toBe('reaction')
		expect(getRelayStanzaType({ pollCreationMessage: { name: 'Choose', options: [] } })).toBe('poll')
		expect(getRelayStanzaType({ pollCreationMessageV2: { name: 'Choose', options: [] } })).toBe('poll')
		expect(getRelayStanzaType({ pollCreationMessageV3: { name: 'Choose', options: [] } })).toBe('poll')
		expect(getRelayStanzaType({ pollCreationMessageV4: {} })).toBe('poll')
		expect(getRelayStanzaType({ pollCreationMessageV5: { name: 'Choose', options: [] } })).toBe('poll')
		expect(getRelayStanzaType({ pollResultSnapshotMessage: {} })).toBe('poll')
		expect(getRelayStanzaType({ pollResultSnapshotMessageV3: {} })).toBe('poll')
		expect(getRelayStanzaType({ pollUpdateMessage: {} })).toBe('poll')
		expect(getRelayStanzaType({ eventMessage: { name: 'Event' } })).toBe('event')
		expect(
			getRelayStanzaType({ viewOnceMessage: { message: { imageMessage: { mimetype: 'image/jpeg' } } } })
		).toBe('media')
		expect(getRelayStanzaType({ locationMessage: { degreesLatitude: 1, degreesLongitude: 2 } })).toBe('text')
	})

	it('accepts the full request without requiring a separate options object', () => {
		const prepared = prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' })
		expect(prepared.message.conversation).toBe('hello')
		expect(prepared.options).toEqual({})
		expect(prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, { messageId: '' }).options.messageId).toBe('')
		expect(() => prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, { messageId: '   ' })).toThrow(
			'Relay messageId'
		)
	})

	it('rejects malformed or incomplete destination JIDs before relay', () => {
		expect(() => prepareRelayRequest('not-a-jid', { conversation: 'hello' })).toThrow('Destination JID')
		expect(() => prepareRelayRequest('@s.whatsapp.net', { conversation: 'hello' })).toThrow('Destination JID')
		expect(() => prepareRelayRequest('123@s.whatsapp.net ', { conversation: 'hello' })).toThrow('Destination JID')
		expect(() => prepareRelayRequest('123@host@server', { conversation: 'hello' })).toThrow('exactly one @')
	})

	it('rejects empty messages and fields absent from the bundled schema', () => {
		expect(() => normalizeRelayMessage({} as proto.IMessage)).toThrow('non-empty proto.IMessage')
		expect(() => normalizeRelayMessage({ inventedMessage: {} } as unknown as proto.IMessage)).toThrow(
			'not present in the bundled WhatsApp schema'
		)
		expect(() => normalizeRelayMessage({ conversation: undefined } as unknown as proto.IMessage)).toThrow(
			'at least one populated field'
		)
	})

	it('validates participant retry metadata before device selection', () => {
		expect(() =>
			prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, {
				participant: { jid: 'bad-jid', count: 1 }
			})
		).toThrow('Relay participant JID')

		expect(() =>
			prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, {
				participant: { jid: '456@s.whatsapp.net', count: -1 }
			})
		).toThrow('non-negative safe integer')
	})

	it('validates extra relay nodes recursively without blocking valid binary content', () => {
		const binary = Buffer.from([1, 2, 3])
		const prepared = prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, {
			additionalNodes: [
				{ tag: 'meta', attrs: { appdata: 'default' }, content: binary },
				{ tag: 'text', attrs: {}, content: 'keep this text' }
			]
		})
		expect(prepared.options.additionalNodes?.[0]?.tag).toBe('meta')
		expect(prepared.options.additionalNodes?.[0]?.content).toBe(binary)
		expect(prepared.options.additionalNodes?.[1]?.content).toBe('keep this text')

		expect(() =>
			prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, {
				additionalNodes: [{ tag: 'meta', attrs: { appdata: 123 } } as never]
			})
		).toThrow('string values')
	})

	it('takes a snapshot of mutable relay metadata before asynchronous transport work', () => {
		const attributes = { category: 'peer' }
		const participant = { jid: '789@s.whatsapp.net', count: 2 }
		const statusJidList = ['456@s.whatsapp.net']
		const additionalNodes = [{ tag: 'meta', attrs: { appdata: 'default' }, content: [{ tag: 'trace', attrs: {} }] }]

		const prepared = prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, {
			participant,
			additionalAttributes: attributes,
			additionalNodes,
			statusJidList
		})

		participant.jid = '999@s.whatsapp.net'
		participant.count = 99
		attributes.category = 'changed'
		additionalNodes[0]!.attrs.appdata = 'changed'
		additionalNodes[0]!.content[0]!.tag = 'changed'
		statusJidList[0] = '789@s.whatsapp.net'

		expect(prepared.options.participant).toEqual({ jid: '789@s.whatsapp.net', count: 2 })
		expect(prepared.options.additionalAttributes?.category).toBe('peer')
		expect(prepared.options.additionalNodes?.[0]?.attrs.appdata).toBe('default')
		expect(prepared.options.additionalNodes?.[0]?.content?.[0]?.tag).toBe('trace')
		expect(prepared.options.statusJidList).toEqual(['456@s.whatsapp.net'])
	})

	it('rejects invalid relay option types before entering the key transaction', () => {
		expect(() =>
			prepareRelayRequest('123@s.whatsapp.net', { conversation: 'hello' }, {
				useUserDevicesCache: 'yes'
			} as never)
		).toThrow('must be a boolean')
	})
})
