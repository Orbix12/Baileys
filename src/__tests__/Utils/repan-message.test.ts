import { proto } from '../../../WAProto/index.js'
import {
	LexzyMessage,
	RepanMessage,
	RichMessage,
	VamMessage,
	createRepanFunctions,
	createRepanSuite,
	filterRepanPlerUpsert
} from '../../Utils/repan-message.js'
import { unwrapRepanMessage } from '../../Utils/repan-delivery.js'
import type { AnyMessageContent, MessageRelayOptions, MiscMessageGenerationOptions, WAMessage } from '../../Types/index.js'

describe('RepanOffcl message helpers', () => {
	const setup = () => {
		const sendMessage = jest.fn<(
			jid: string,
			content: AnyMessageContent,
			options?: MiscMessageGenerationOptions
		) => Promise<WAMessage | undefined>>().mockResolvedValue(undefined)
		const relayMessage = jest.fn<(
			jid: string,
			content: proto.IMessage,
			options: MessageRelayOptions
		) => Promise<void>>().mockResolvedValue(undefined)
		return { sendMessage, relayMessage, socket: { sendMessage, relayMessage } }
	}

	it('VamMessage sends through the native socket API', async () => {
		const { sendMessage, socket } = setup()
		await new VamMessage(socket).text('123@s.whatsapp.net', 'hello')
		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', { text: 'hello' }, {})
	})

	it('every facade auto-routes regular payloads and protobuf fields from the full schema', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const vam = new VamMessage(socket)
		const lexzy = new LexzyMessage(socket)
		const repan = new RepanMessage(socket)
		const rich = new RichMessage(socket)

		await vam.sendAny('123@s.whatsapp.net', { text: 'Vam text' })
		await lexzy.auto('123@s.whatsapp.net', { imageMessage: { mimetype: 'image/jpeg' } } as proto.IMessage)
		await repan.auto('123@s.whatsapp.net', { call: {} } as proto.IMessage)
		await rich.sendAny('123@s.whatsapp.net', { chat: {} } as proto.IMessage)
		await repan.auto('123@s.whatsapp.net', { messageContextInfo: {} } as proto.IMessage)

		expect(sendMessage).toHaveBeenCalledTimes(1)
		expect(relayMessage).toHaveBeenCalledTimes(4)
		expect(relayMessage.mock.calls.map(call => Object.keys(call[1]))).toEqual([
			['imageMessage'],
			['call'],
			['chat'],
			['messageContextInfo']
		])
	})

	it('auto rejects a payload that mixes raw proto fields with regular sendMessage content', () => {
		const { socket } = setup()
		const vam = new VamMessage(socket)
		expect(() => vam.auto('123@s.whatsapp.net', { text: 'mixed', conversation: 'raw' } as never)).toThrow(
			'mix raw proto.IMessage fields'
		)
	})

	it('raw validates unknown protobuf fields before trying to relay', () => {
		const { relayMessage, socket } = setup()
		const vam = new VamMessage(socket)
		expect(() => vam.raw('123@s.whatsapp.net', { futureInventedField: {} } as never)).toThrow(
			'not present in the bundled WhatsApp schema'
		)
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('raw rejects known fields whose values disappear during protobuf normalization', () => {
		const { relayMessage, socket } = setup()
		const vam = new VamMessage(socket)
		expect(() => vam.raw('123@s.whatsapp.net', { conversation: undefined } as never)).toThrow(
			'Raw proto.IMessage must contain at least one populated field'
		)
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('auto rejects null and array input instead of treating it as message content', () => {
		const { socket } = setup()
		const vam = new VamMessage(socket)
		expect(() => vam.auto('123@s.whatsapp.net', null as never)).toThrow('message content object')
		expect(() => vam.auto('123@s.whatsapp.net', [] as never)).toThrow('message content object')
	})

	it('media() routes image, MP4 video, audio, document, and sticker through sendMessage', async () => {
		const { sendMessage, socket } = setup()
		const vam = new VamMessage(socket)
		const binary = Buffer.from('sample')

		await vam.media('123@s.whatsapp.net', { type: 'image', media: binary, options: { caption: 'image' } })
		await vam.media('123@s.whatsapp.net', {
			type: 'video', media: binary, options: { mimetype: 'video/mp4', caption: 'clip.mp4' }
		})
		await vam.sendMedia('123@s.whatsapp.net', {
			type: 'audio', media: binary, options: { mimetype: 'audio/mpeg', ptt: false }
		})
		await vam.media('123@s.whatsapp.net', {
			type: 'document', media: binary, options: { mimetype: 'application/pdf', fileName: 'guide.pdf' }
		})
		await vam.media('123@s.whatsapp.net', { type: 'sticker', media: binary, options: { isAnimated: false } })

		expect(sendMessage).toHaveBeenCalledTimes(5)
		expect(sendMessage.mock.calls[0]?.[1]).toMatchObject({ image: binary, caption: 'image' })
		expect(sendMessage.mock.calls[1]?.[1]).toMatchObject({ video: binary, mimetype: 'video/mp4', caption: 'clip.mp4' })
		expect(sendMessage.mock.calls[2]?.[1]).toMatchObject({ audio: binary, mimetype: 'audio/mpeg', ptt: false })
		expect(sendMessage.mock.calls[3]?.[1]).toMatchObject({ document: binary, mimetype: 'application/pdf', fileName: 'guide.pdf' })
		expect(sendMessage.mock.calls[4]?.[1]).toMatchObject({ sticker: binary, isAnimated: false })
	})

	it('VamMessage builds a native flow with quick-reply buttons', async () => {
		const { relayMessage, socket } = setup()
		await new VamMessage(socket).nativeFlow('123@s.whatsapp.net', {
			header: 'VAM FLOW',
			body: 'Choose one',
			buttons: [{ id: 'one', label: 'Option One' }]
		})
		const payload = unwrapRepanMessage(relayMessage.mock.calls[0][1])
		const flow = payload.interactiveMessage?.nativeFlowMessage
		expect(flow?.buttons).toHaveLength(1)
		expect(JSON.parse(flow!.buttons[0]!.buttonParamsJson!)).toEqual({ display_text: 'Option One', id: 'one' })
	})


	it('VamMessage supports URL, call, and copy Native Flow actions', async () => {
		const { relayMessage, socket } = setup()
		await new VamMessage(socket).nativeFlow('123@s.whatsapp.net', {
			body: 'Choose an action',
			buttons: [
				{ type: 'url', label: 'Open website', url: 'https://example.com' },
				{ type: 'call', label: 'Call support', phoneNumber: '+6281234567890' },
				{ type: 'copy', label: 'Copy code', copyCode: 'WELCOME-2026' }
			]
		})

		const buttons = unwrapRepanMessage(relayMessage.mock.calls[0][1]).interactiveMessage?.nativeFlowMessage?.buttons
		expect(buttons?.map(button => button.name)).toEqual(['cta_url', 'cta_call', 'cta_copy'])
		expect(JSON.parse(buttons![0]!.buttonParamsJson!)).toMatchObject({ url: 'https://example.com' })
		expect(JSON.parse(buttons![1]!.buttonParamsJson!)).toMatchObject({ phone_number: '+6281234567890' })
		expect(JSON.parse(buttons![2]!.buttonParamsJson!)).toMatchObject({ copy_code: 'WELCOME-2026' })
	})

	it('VamMessage rejects malformed Native Flow button actions before relay', async () => {
		const { relayMessage, socket } = setup()
		expect(() => new VamMessage(socket).nativeFlow('123@s.whatsapp.net', {
			body: 'Bad URL',
			buttons: [{ type: 'url', label: 'Open', url: 'javascript:alert(1)' }]
		})).toThrow('only support http:// or https://')
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('VamMessage sends an already-built raw protobuf message through relayMessage', async () => {
		const { relayMessage, socket } = setup()
		const raw = { conversation: 'raw protobuf text' } as proto.IMessage
		await new VamMessage(socket).raw('123@s.whatsapp.net', raw)
		expect(relayMessage).toHaveBeenCalledWith('123@s.whatsapp.net', expect.objectContaining({ conversation: 'raw protobuf text' }), {})
		expect(() => new VamMessage(socket).raw('123@s.whatsapp.net', {} as proto.IMessage)).toThrow(
			'Raw message must be a non-empty proto.IMessage object'
		)
	})

	it('VamMessage builds a document header with uploaded media and Native Flow buttons', async () => {
		const { relayMessage, socket } = setup()
		const waUploadToServer = jest.fn(async () => ({
			mediaUrl: 'https://mmg.whatsapp.net/d/fake-media',
			directPath: '/v/t62.7118-24/fake-media'
		}))
		const socketWithUpload = { ...socket, waUploadToServer }
		await new VamMessage(socketWithUpload).documentWithButtons(
			'123@s.whatsapp.net',
			Buffer.from('sample document'),
			{
				header: 'DOCUMENT CENTER',
				body: 'Choose what to do with this file',
				buttons: [{ id: 'download', label: 'Continue' }]
			},
			{ mimetype: 'text/plain', fileName: 'sample.txt' }
		)

		expect(waUploadToServer).toHaveBeenCalledTimes(1)
		const header = unwrapRepanMessage(relayMessage.mock.calls[0][1]).interactiveMessage?.header
		expect(header?.hasMediaAttachment).toBe(true)
		expect(header?.title).toBe('DOCUMENT CENTER')
		expect(header?.documentMessage?.fileName).toBe('sample.txt')
	})

	it('VamMessage rejects an empty media-flow body before uploading', async () => {
		const { socket } = setup()
		const waUploadToServer = jest.fn()
		const vam = new VamMessage({ ...socket, waUploadToServer })
		await expect(vam.nativeFlowWithMedia('123@s.whatsapp.net', {
			body: '   ',
			buttons: [{ id: 'continue', label: 'Continue' }]
		}, { type: 'document', media: Buffer.from('sample') })).rejects.toThrow(
			'Native Flow body must be a non-empty string'
		)
		expect(waUploadToServer).not.toHaveBeenCalled()
	})

	it('VamMessage exposes contact and phone-number message helpers', async () => {
		const { sendMessage, socket } = setup()
		const vam = new VamMessage(socket)
		const contact = { displayName: 'Example' } as proto.Message.IContactMessage
		await vam.contact('123@s.whatsapp.net', contact)
		await vam.requestPhoneNumber('123@s.whatsapp.net')
		await vam.sharePhoneNumber('123@s.whatsapp.net')
		expect(sendMessage).toHaveBeenNthCalledWith(1, '123@s.whatsapp.net', {
			contacts: { contacts: [contact] }
		}, {})
		expect(sendMessage).toHaveBeenNthCalledWith(2, '123@s.whatsapp.net', { requestPhoneNumber: true }, {})
		expect(sendMessage).toHaveBeenNthCalledWith(3, '123@s.whatsapp.net', { sharePhoneNumber: true }, {})
	})

	it('LexzyMessage rejects an empty carousel body before relay', async () => {
		const { relayMessage, socket } = setup()
		await expect(new LexzyMessage(socket).carousel('123@s.whatsapp.net', {
			body: '   ',
			cards: [
				{ id: 'a', title: 'Card A', body: 'First card' },
				{ id: 'b', title: 'Card B', body: 'Second card' }
			]
		})).rejects.toThrow('carousel body must be a non-empty string')
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('Lexzy validates every card before beginning any media upload', async () => {
		const { relayMessage, socket } = setup()
		const waUploadToServer = jest.fn(async () => ({
			mediaUrl: 'https://mmg.whatsapp.net/d/should-not-upload',
			directPath: '/v/t62.7118-24/should-not-upload'
		}))
		const lexzy = new LexzyMessage({ ...socket, waUploadToServer })
		await expect(lexzy.carousel('123@s.whatsapp.net', {
			body: 'Preflight',
			cards: [
				{ id: 'valid', title: 'Valid', body: 'Would upload', media: { type: 'image', media: Buffer.from('image') } },
				{ id: 'invalid', title: 'Invalid', body: 'Bad media', media: { type: 'audio', media: Buffer.from('audio') } as never }
			]
		})).rejects.toThrow('media type must be image or video')
		expect(waUploadToServer).not.toHaveBeenCalled()
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('Vam media and Repan menus reject malformed runtime objects before sending', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const vam = new VamMessage(socket)
		const repan = new RepanMessage(socket)
		expect(() => vam.media('123@s.whatsapp.net', { type: 'video', media: 'not-a-media' } as never)).toThrow('Media must be a Buffer')
		expect(() => repan.menu('123@s.whatsapp.net', {
			title: 'Menu', description: 'Choose', sections: [{ rows: [null] }]
		} as never)).toThrow('Every select menu row must be an object')
		expect(sendMessage).not.toHaveBeenCalled()
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('Repan panels reject malformed block data before formatting', () => {
		const { sendMessage, socket } = setup()
		const repan = new RepanMessage(socket)
		expect(() => repan.panel('123@s.whatsapp.net', {
			title: 'Unsafe input', blocks: [{ type: 'progress', label: 'Progress', current: 2, max: 1 }]
		} as never)).toThrow('Invalid Repan progress block')
		expect(() => repan.panel('123@s.whatsapp.net', {
			title: 'Unknown', blocks: [{ type: 'unexpected' }]
		} as never)).toThrow('unsupported block type')
		expect(sendMessage).not.toHaveBeenCalled()
	})

	it('Repan buttonMessage rejects null and malformed button records before relay', () => {
		const { relayMessage, socket } = setup()
		const repan = new RepanMessage(socket)
		expect(() => repan.buttonMessage('123@s.whatsapp.net', null as never)).toThrow('options must be an object')
		expect(() => repan.buttonMessage('123@s.whatsapp.net', {
			text: 'Pick', buttons: [null]
		} as never)).toThrow('Every Repan button must be an object')
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('LexzyMessage creates a native carousel with separate card actions', async () => {
		const { relayMessage, socket } = setup()
		await new LexzyMessage(socket).carousel('123@s.whatsapp.net', {
			body: 'LEXZY COLLECTION',
			cards: [
				{ id: 'a', title: 'Card A', body: 'First card', buttons: [{ id: 'pick_a', label: 'Choose A' }] },
				{ id: 'b', title: 'Card B', body: 'Second card', buttons: [{ id: 'pick_b', label: 'Choose B' }] }
			]
		})
		const carousel = unwrapRepanMessage(relayMessage.mock.calls[0][1]).interactiveMessage?.carouselMessage
		expect(carousel?.cards).toHaveLength(2)
		expect(carousel?.cards[0]?.nativeFlowMessage?.buttons?.[0]?.name).toBe('quick_reply')
	})

	it('LexzyMessage uploads per-card media and preserves per-card CTA buttons', async () => {
		const { relayMessage, socket } = setup()
		const waUploadToServer = jest.fn(async () => ({
			mediaUrl: 'https://mmg.whatsapp.net/d/lexzy-image',
			directPath: '/v/t62.7118-24/lexzy-image'
		}))
		const lexzy = new LexzyMessage({ ...socket, waUploadToServer })
		await lexzy.carousel('123@s.whatsapp.net', {
			body: 'LEXZY MEDIA COLLECTION',
			cards: [
				{
					id: 'photo',
					title: 'Photo card',
					body: 'Image-backed card',
					media: { type: 'image', media: Buffer.from('image-data'), mimetype: 'image/jpeg' },
					buttons: [{ type: 'url', label: 'Open gallery', url: 'https://example.com/gallery' }]
				},
				{ id: 'text', title: 'Text card', body: 'Text-only card', buttons: [{ id: 'choose', label: 'Choose' }] }
			]
		})

		const cards = unwrapRepanMessage(relayMessage.mock.calls[0][1]).interactiveMessage?.carouselMessage?.cards
		expect(waUploadToServer).toHaveBeenCalledTimes(1)
		expect(cards?.[0]?.header?.hasMediaAttachment).toBe(true)
		expect(cards?.[0]?.header?.imageMessage).toBeDefined()
		expect(cards?.[0]?.nativeFlowMessage?.buttons?.[0]?.name).toBe('cta_url')
		expect(cards?.[1]?.header?.hasMediaAttachment).toBe(false)
	})

	it('RepanMessage supports quote/reply options', async () => {
		const { sendMessage, socket } = setup()
		const quoted = { key: { id: 'message-id' } } as WAMessage
		await new RepanMessage(socket).reply('123@s.whatsapp.net', quoted, 'reply')
		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', { text: 'reply' }, { quoted })
	})

	it('RepanMessage formats metrics and progress into a compatible text panel', async () => {
		const { sendMessage, socket } = setup()
		await new RepanMessage(socket).panel('123@s.whatsapp.net', {
			title: 'REPAN STATUS',
			style: 'plain',
			blocks: [
				{ type: 'status', label: 'Connection', value: 'Online', level: 'success' },
				{ type: 'metric', label: 'Users', value: 12 },
				{ type: 'progress', label: 'Storage', current: 75, max: 100 }
			]
		})
		const content = sendMessage.mock.calls[0][1]
		expect('text' in content ? content.text : '').toContain('[SUCCESS] Connection: Online')
		expect('text' in content ? content.text : '').toContain('Storage: ████████░░ 75%')
	})

	it('RepanMessage sends its own listMessage wire type with selectable rows', async () => {
		const { relayMessage, socket } = setup()
		await new RepanMessage(socket).menu('123@s.whatsapp.net', {
			title: 'REPAN CONTROL',
			description: 'Choose a control action',
			buttonText: 'OPEN CONTROL',
			sections: [
				{
					title: 'SYSTEM',
					rows: [
						{ id: 'status', title: 'System status', description: 'Show runtime metrics' },
						{ id: 'restart', title: 'Restart worker', description: 'Restart the selected worker' }
					]
				}
			]
		})

		const payload = unwrapRepanMessage(relayMessage.mock.calls[0][1])
		expect(payload.listMessage?.title).toBe('REPAN CONTROL')
		expect(payload.listMessage?.buttonText).toBe('OPEN CONTROL')
		expect(payload.listMessage?.sections[0]?.rows[0]?.rowId).toBe('status')
		expect(payload.interactiveMessage).toBeUndefined()
	})

	it('RepanMessage dashboard combines metrics with list actions', async () => {
		const { relayMessage, socket } = setup()
		await new RepanMessage(socket).dashboard('123@s.whatsapp.net', {
			title: 'BOT DASHBOARD',
			subtitle: 'Live worker overview',
			blocks: [{ type: 'metric', label: 'Active jobs', value: 4 }],
			sections: [{ rows: [{ id: 'jobs', title: 'View jobs' }] }]
		})
		const list = unwrapRepanMessage(relayMessage.mock.calls[0][1]).listMessage
		expect(list?.description).toContain('Active jobs*  ›  4')
		expect(list?.sections[0]?.rows[0]?.rowId).toBe('jobs')
	})

	it('RepanMessage exposes a separate classic response-button protobuf', async () => {
		const { relayMessage, socket } = setup()
		await new RepanMessage(socket).buttonMessage('123@s.whatsapp.net', {
			header: 'CONFIRM ACTION',
			text: 'Choose one action',
			footer: 'Repan control',
			buttons: [
				{ id: 'approve', label: 'Approve' },
				{ id: 'details', label: 'Details' }
			]
		})
		const buttons = unwrapRepanMessage(relayMessage.mock.calls[0][1]).buttonsMessage
		expect(buttons?.contentText).toBe('Choose one action')
		expect(buttons?.buttons).toHaveLength(2)
		expect(buttons?.buttons[0]?.type).toBe(proto.Message.ButtonsMessage.Button.Type.RESPONSE)
		expect(unwrapRepanMessage(relayMessage.mock.calls[0][1]).listMessage).toBeUndefined()
	})

	it('RichMessage preserves mentions and link/context fields', async () => {
		const { sendMessage, socket } = setup()
		const contextInfo = { stanzaId: 'quoted-id' }
		const linkPreview = { 'canonical-url': 'https://example.com', 'matched-text': 'https://example.com', title: 'Example' }
		await new RichMessage(socket).richText('123@s.whatsapp.net', 'rich', {
			mentions: ['456@s.whatsapp.net'],
			contextInfo,
			linkPreview
		})
		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', {
			text: 'rich',
			mentions: ['456@s.whatsapp.net'],
			contextInfo,
			linkPreview
		}, {})
	})

	it('the all-in-one Repan facade also exposes richText', async () => {
		const { sendMessage, socket } = setup()
		await new RepanMessage(socket).richText('123@s.whatsapp.net', 'all modules', {
			mentions: ['456@s.whatsapp.net']
		})
		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', {
			text: 'all modules',
			mentions: ['456@s.whatsapp.net']
		}, {})
	})

	it('RepanMessage card panel draws an icon-led frame with every block type', async () => {
		const { sendMessage, socket } = setup()
		await new RepanMessage(socket).panel('123@s.whatsapp.net', {
			title: 'REPAN STATUS',
			subtitle: 'Live overview',
			footer: 'Repan Monitoring',
			blocks: [
				{ type: 'status', label: 'Connection', value: 'Online', level: 'success' },
				{ type: 'status', label: 'Queue', value: 'Backed up', level: 'danger' },
				{ type: 'progress', label: 'Storage', current: 75, max: 100 },
				{ type: 'list', title: 'Todo', items: ['one', 'two'], ordered: true },
				{ type: 'quote', text: 'stay sharp' },
				{ type: 'divider' }
			]
		})
		const content = sendMessage.mock.calls[0][1]
		const text = 'text' in content ? content.text : ''
		expect(text).toContain('╭━━『 *REPAN STATUS* 』')
		expect(text).toContain('🟢 *Connection*  ›  Online')
		expect(text).toContain('🔴 *Queue*')
		expect(text).toContain('████████░░ 75%')
		expect(text).toContain('1. one')
		expect(text).toContain('╰━━━━━━━━━━━━━━━━')
	})

	it('interactive payloads are enveloped and carry a biz node; plain content is untouched', async () => {
		const { relayMessage, socket } = setup()
		await new VamMessage(socket).nativeFlow('123@s.whatsapp.net', { body: 'hi', buttons: [{ id: 'a', label: 'A' }] })
		const [, message, options] = relayMessage.mock.calls[0]
		expect(message.viewOnceMessage?.message?.messageContextInfo?.deviceListMetadataVersion).toBe(2)
		expect(message.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage).toBeDefined()
		const tags = (options.additionalNodes ?? []).map(node => node.tag)
		expect(tags).toEqual(['biz', 'bot'])

		await new VamMessage(socket).raw('123@s.whatsapp.net', { conversation: 'plain' } as proto.IMessage)
		expect(relayMessage.mock.calls[1][1].viewOnceMessage).toBeUndefined()
		expect(relayMessage.mock.calls[1][2].additionalNodes).toBeUndefined()
	})

	it('group delivery omits the private-chat bot node', async () => {
		const { relayMessage, socket } = setup()
		await new RepanMessage(socket).menu('123@g.us', {
			title: 'Menu',
			description: 'Pick',
			sections: [{ rows: [{ id: 'a', title: 'A' }] }]
		})
		const nodes = relayMessage.mock.calls[0][2].additionalNodes ?? []
		expect(nodes.map(node => node.tag)).toEqual(['biz'])
		expect(nodes[0]?.content).toEqual([{ tag: 'list', attrs: { v: '2', type: 'product_list' } }])
	})

	it('RepanMessage.select builds a single_select Native Flow and validates rows', async () => {
		const { relayMessage, socket } = setup()
		const repan = new RepanMessage(socket)
		await repan.select('123@s.whatsapp.net', {
			body: 'Pick one',
			buttonText: 'OPEN',
			sections: [{ title: 'Main', rows: [{ id: 'a', title: 'Alpha', description: 'first' }] }]
		})
		const button = unwrapRepanMessage(relayMessage.mock.calls[0][1]).interactiveMessage?.nativeFlowMessage?.buttons?.[0]
		expect(button?.name).toBe('single_select')
		expect(JSON.parse(button!.buttonParamsJson!)).toMatchObject({ title: 'OPEN', sections: [{ rows: [{ id: 'a', title: 'Alpha' }] }] })
		expect(() => repan.select('123@s.whatsapp.net', {
			body: 'dup',
			buttonText: 'OPEN',
			sections: [{ rows: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] }]
		})).toThrow('Duplicate select menu row id')
	})

	it('RepanMessage.actionDeck builds modern Native Flow actions with optional icons', async () => {
		const { relayMessage, socket } = setup()
		await new RepanMessage(socket).actionDeck('123@s.whatsapp.net', {
			header: 'REPAN CONTROL',
			body: 'Choose an action',
			footer: 'REPAN UI',
			actions: [
				{ id: 'status', label: 'System status', icon: '◈' },
				{ type: 'url', label: 'Open dashboard', icon: '↗', url: 'https://example.com/dashboard' },
				{ type: 'copy', label: 'Copy code', icon: '⧉', copyCode: 'REPAN-ACCESS' }
			]
		})

		const interactive = unwrapRepanMessage(relayMessage.mock.calls[0]![1]).interactiveMessage
		const buttons = interactive?.nativeFlowMessage?.buttons ?? []
		expect(interactive?.header?.title).toBe('REPAN CONTROL')
		expect(interactive?.body?.text).toBe('Choose an action')
		expect(buttons.map(button => button.name)).toEqual(['quick_reply', 'cta_url', 'cta_copy'])
		expect(JSON.parse(buttons[0]!.buttonParamsJson!)).toMatchObject({ display_text: '◈ System status', id: 'status' })
		expect(JSON.parse(buttons[1]!.buttonParamsJson!)).toMatchObject({ display_text: '↗ Open dashboard', url: 'https://example.com/dashboard' })
		expect(JSON.parse(buttons[2]!.buttonParamsJson!)).toMatchObject({ display_text: '⧉ Copy code', copy_code: 'REPAN-ACCESS' })
	})

	it('quoted replies are applied inside already-wrapped interactive protobuf messages', async () => {
		const { relayMessage, socket } = setup()
		const quoted = {
			key: { id: 'WRAPPED-Q1', remoteJid: '123@s.whatsapp.net' },
			message: { conversation: 'quoted text' }
		} as WAMessage
		const raw = {
			viewOnceMessage: {
				message: {
					interactiveMessage: {
						body: { text: 'Already wrapped' },
						nativeFlowMessage: {
						messageVersion: 1,
						buttons: [{ name: 'quick_reply', buttonParamsJson: '{\"display_text\":\"Open\",\"id\":\"open\"}' }]
						}
					}
				}
			}
		} as proto.IMessage

		await new VamMessage(socket).raw('123@s.whatsapp.net', raw, { quoted })
		const delivered = relayMessage.mock.calls[0]![1]
		const inner = unwrapRepanMessage(delivered)
		expect(inner.interactiveMessage?.contextInfo?.stanzaId).toBe('WRAPPED-Q1')
		expect(delivered.viewOnceMessage?.message?.interactiveMessage).toBeDefined()
		expect(delivered.viewOnceMessage?.message?.messageContextInfo?.deviceListMetadataVersion).toBe(2)
	})

	it('preserves caller biz metadata and adds the private-chat bot hint once', async () => {
		const { relayMessage, socket } = setup()
		const customBiz = { tag: 'biz', attrs: { source: 'caller' } }
		await new VamMessage(socket).nativeFlow(
			'123@s.whatsapp.net',
			{ body: 'Custom metadata', buttons: [{ id: 'go', label: 'Go' }] },
			{ additionalNodes: [customBiz] as MessageRelayOptions['additionalNodes'] }
		)
		const nodes = relayMessage.mock.calls[0]![2].additionalNodes ?? []
		expect(nodes.map(node => node.tag)).toEqual(['biz', 'bot'])
		expect(nodes[0]).toEqual(customBiz)
		expect(nodes[1]).toEqual({ tag: 'bot', attrs: { biz_bot: '1' } })
	})

	it('quoted replies are folded into the interactive contextInfo', async () => {
		const { relayMessage, socket } = setup()
		const quoted = { key: { id: 'Q1', remoteJid: '123@s.whatsapp.net' }, message: { conversation: 'hey' } } as WAMessage
		await new RepanMessage(socket).buttonMessage('123@s.whatsapp.net', {
			text: 'Choose',
			buttons: [{ id: 'ok', label: 'OK' }]
		}, { quoted })
		const ctx = unwrapRepanMessage(relayMessage.mock.calls[0][1]).buttonsMessage?.contextInfo
		expect(ctx?.stanzaId).toBe('Q1')
		expect(relayMessage.mock.calls[0][2]).not.toHaveProperty('quoted')
	})

	it('buttonMessage can carry an uploaded image header', async () => {
		const { relayMessage, socket } = setup()
		const waUploadToServer = jest.fn(async () => ({ mediaUrl: 'https://mmg.whatsapp.net/d/x', directPath: '/v/x' }))
		await new RepanMessage({ ...socket, waUploadToServer }).buttonMessage('123@s.whatsapp.net', {
			text: 'With image',
			buttons: [{ id: 'ok', label: 'OK' }],
			attachment: { type: 'image', media: Buffer.from('img'), mimetype: 'image/jpeg' }
		})
		const buttons = unwrapRepanMessage(relayMessage.mock.calls[0][1]).buttonsMessage
		expect(waUploadToServer).toHaveBeenCalledTimes(1)
		expect(buttons?.headerType).toBe(proto.Message.ButtonsMessage.HeaderType.IMAGE)
		expect(buttons?.imageMessage).toBeDefined()
	})

	it('RepanMessage.auto routes ordinary content to sendMessage and protobuf to the relay lane', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const repan = new RepanMessage(socket)
		await repan.auto('123@s.whatsapp.net', { text: 'hello' })
		await repan.auto('123@s.whatsapp.net', { listMessage: { title: 'T', description: 'D', buttonText: 'B', sections: [] } } as proto.IMessage)
		expect(sendMessage).toHaveBeenCalledTimes(1)
		expect(relayMessage).toHaveBeenCalledTimes(1)
		expect(relayMessage.mock.calls[0][2].additionalNodes?.[0]?.tag).toBe('biz')
	})

	it('createRepanSuite exposes every module, and Repan inherits Lexzy carousels', async () => {
		const { relayMessage, socket } = setup()
		const suite = createRepanSuite(socket)
		expect(Object.keys(suite).sort()).toEqual(['lexzy', 'rich', 'repan', 'send', 'vam'].sort())
		await suite.repan.carousel('123@s.whatsapp.net', {
			body: 'All in one',
			cards: [
				{ id: 'a', title: 'A', body: 'a' },
				{ id: 'b', title: 'B', body: 'b' }
			]
		})
		expect(unwrapRepanMessage(relayMessage.mock.calls[0][1]).interactiveMessage?.carouselMessage?.cards).toHaveLength(2)
	})

	it('binds facade methods so destructured methods work inside bot handler functions', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const vam = new VamMessage(socket)
		const lexzy = new LexzyMessage(socket)
		const repan = new RepanMessage(socket)
		const { text: sendText } = vam
		const { carousel: sendCarousel } = lexzy
		const { actionDeck: sendActionDeck } = repan

		const handlers = {
			status: (jid: string) => sendText(jid, 'Function handler works'),
			gallery: (jid: string) => sendCarousel(jid, {
				body: 'Gallery',
				cards: [
					{ id: 'one', title: 'One', body: 'First card' },
					{ id: 'two', title: 'Two', body: 'Second card' }
				]
			}),
			menu: (jid: string) => sendActionDeck(jid, {
				body: 'Choose an action',
				actions: [{ id: 'ping', label: 'Ping' }]
			})
		}

		await handlers.status('123@s.whatsapp.net')
		await handlers.gallery('123@s.whatsapp.net')
		await handlers.menu('123@s.whatsapp.net')

		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', { text: 'Function handler works' }, {})
		expect(relayMessage).toHaveBeenCalledTimes(2)
	})

	it('RepanPler filters sender-side outgoing echoes but preserves recipient messages', () => {
		const { socket } = setup()
		const functions = createRepanFunctions(socket, { RepanPler: true })
		const outgoing = { key: { remoteJid: '123@s.whatsapp.net', fromMe: true, id: 'OUT' } } as WAMessage
		const incoming = { key: { remoteJid: '123@s.whatsapp.net', fromMe: false, id: 'IN' } } as WAMessage
		const event = { messages: [outgoing, incoming], type: 'notify' as const, requestId: 'req-1' }

		expect(functions.RepanPler).toBe(true)
		expect(functions.filterUpsert(event)).toEqual({ messages: [incoming], type: 'notify', requestId: 'req-1' })
		expect(functions.isVisibleMessage(outgoing)).toBe(false)
		expect(functions.isVisibleMessage(incoming)).toBe(true)
		expect(filterRepanPlerUpsert(event, false)).toBe(event)
	})

	it('createRepanFunctions provides the complete bound function-first API', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const functions = createRepanFunctions(socket)
		const expectedFunctions = [
			'sendAny', 'sendText', 'sendReply', 'sendImage', 'sendVideo', 'sendAudio', 'sendDocument',
			'sendSticker', 'sendMedia', 'sendReaction', 'deleteMessage', 'forwardMessage', 'editMessage',
			'sendPoll', 'sendEvent', 'sendLocation', 'sendAlbum', 'sendContact', 'sendContacts',
			'sendGroupInvite', 'sendListReply', 'sendButtonReply', 'sendProduct', 'sharePhoneNumber',
			'requestPhoneNumber', 'pinMessage', 'sendLimitSharing', 'sendDisappearing', 'setDisappearing', 'sendRaw',
			'sendNativeFlow', 'sendNativeFlowWithMedia', 'sendDocumentWithButtons', 'sendImageWithButtons',
			'sendVideoWithButtons', 'sendStep', 'sendCarousel', 'sendRichText', 'sendPanel', 'sendMenu',
			'sendDashboard', 'sendSelect', 'sendActionDeck', 'sendButtonMessage'
		]
		for (const name of expectedFunctions) expect(functions).toHaveProperty(name, expect.any(Function))
		expect(functions).toHaveProperty('RepanPler', false)
		expect(functions).toHaveProperty('filterUpsert', expect.any(Function))
		const { sendText, sendMedia, sendRaw, sendCarousel, sendActionDeck, sendMenu } = functions

		const botHandlers = {
			text: (jid: string) => sendText(jid, 'Hello from function API'),
			raw: (jid: string) => sendRaw(jid, { conversation: 'Raw from function API' } as proto.IMessage),
			media: (jid: string) => sendMedia(jid, { type: 'video', media: Buffer.from('video'), options: { mimetype: 'video/mp4' } }),
			carousel: (jid: string) => sendCarousel(jid, {
				body: 'Cards',
				cards: [
					{ id: 'a', title: 'A', body: 'A' },
					{ id: 'b', title: 'B', body: 'B' }
				]
			}),
			actions: (jid: string) => sendActionDeck(jid, { body: 'Actions', actions: [{ id: 'go', label: 'Go' }] }),
			menu: (jid: string) => sendMenu(jid, {
				title: 'Menu',
				description: 'Pick one',
				sections: [{ rows: [{ id: 'home', title: 'Home' }] }]
			})
		}

		await botHandlers.text('123@s.whatsapp.net')
		await botHandlers.raw('123@s.whatsapp.net')
		await botHandlers.media('123@s.whatsapp.net')
		await botHandlers.carousel('123@s.whatsapp.net')
		await botHandlers.actions('123@s.whatsapp.net')
		await botHandlers.menu('123@s.whatsapp.net')

		expect(sendMessage).toHaveBeenCalledTimes(2)
		expect(relayMessage).toHaveBeenCalledTimes(4)
	})
})
