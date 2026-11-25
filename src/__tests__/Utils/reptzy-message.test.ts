import { proto } from '../../../WAProto/index.js'
import type { RepanMessageSocket } from '../../Utils/repan-message.js'
import { createRepTzySuite, getSupportedRepTzyMessageFields, RepTzyMessage } from '../../Utils/reptzy-message.js'

describe('RepTzyMessage', () => {
	const setup = () => {
		const sendMessage = jest.fn().mockResolvedValue(undefined)
		const relayMessage = jest.fn().mockResolvedValue(undefined)
		const socket = { sendMessage, relayMessage } as unknown as RepanMessageSocket
		return { sendMessage, relayMessage, socket }
	}

	it('routes ordinary AnyMessageContent through sendMessage()', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const reptzy = new RepTzyMessage(socket)

		await reptzy.sendMessage('123@s.whatsapp.net', { text: 'RepTzy standard text' })

		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', { text: 'RepTzy standard text' }, {})
		expect(relayMessage).not.toHaveBeenCalled()
	})


	it('dispatch() and relay() are aliases for the unified router', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const reptzy = new RepTzyMessage(socket)

		await reptzy.dispatch('123@s.whatsapp.net', { text: 'dispatch alias' })
		await reptzy.relay('123@s.whatsapp.net', { conversation: 'relay alias' } as proto.IMessage)

		expect(sendMessage).toHaveBeenCalledTimes(1)
		expect(relayMessage).toHaveBeenCalledTimes(1)
	})

	it('rejects mixed known and unknown protobuf top-level fields before sending', () => {
		const { sendMessage, relayMessage, socket } = setup()
		const reptzy = new RepTzyMessage(socket)

		expect(() => reptzy.sendMessage('123@s.whatsapp.net', {
			conversation: 'not partially valid',
			inventedRepTzyField: true
		} as never)).toThrow('unsupported top-level field')
		expect(sendMessage).not.toHaveBeenCalled()
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('routes schema-defined IMessage fields through the validated relay lane', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const reptzy = new RepTzyMessage(socket)

		await reptzy.sendMessage('123@s.whatsapp.net', { richResponseMessage: { messageType: 1 } } as proto.IMessage)

		expect(sendMessage).not.toHaveBeenCalled()
		expect(relayMessage).toHaveBeenCalledTimes(1)
		expect(relayMessage.mock.calls[0]?.[1]).toHaveProperty('richResponseMessage.messageType', 1)
	})

	it('supports explicit content, proto and media envelopes', async () => {
		const { sendMessage, relayMessage, socket } = setup()
		const reptzy = new RepTzyMessage(socket)
		const media = Buffer.from('image-bytes')

		await reptzy.sendMessage('123@s.whatsapp.net', { format: 'content', content: { text: 'wrapped' } })
		await reptzy.sendMessage('123@s.whatsapp.net', { format: 'proto', message: { conversation: 'raw wrapped' } })
		await reptzy.sendMessage('123@s.whatsapp.net', {
			format: 'media',
			media: { type: 'image', media, options: { caption: 'wrapped media' } }
		})

		expect(sendMessage).toHaveBeenCalledTimes(2)
		expect(relayMessage).toHaveBeenCalledTimes(1)
		expect(sendMessage.mock.calls[0]?.[1]).toEqual({ text: 'wrapped' })
		expect(sendMessage.mock.calls[1]?.[1]).toMatchObject({ image: media, caption: 'wrapped media' })
	})

	it('exports the complete supported IMessage field inventory from the generated proto', () => {
		const fields = getSupportedRepTzyMessageFields()
		const reptzy = new RepTzyMessage(setup().socket)

		expect(fields).toContain('conversation')
		expect(fields).toContain('imageMessage')
		expect(fields).toContain('liveLocationMessage')
		expect(fields).toContain('interactiveMessage')
		expect(fields).toContain('richResponseMessage')
		expect(reptzy.supportedProtoFields).toEqual(fields)
		expect(Object.isFrozen(fields)).toBe(true)
	})

	it('builds, encodes and decodes protobuf messages with the bundled schema', () => {
		const reptzy = new RepTzyMessage(setup().socket)
		const encoded = reptzy.encodeProto({ conversation: 'RepTzy round trip' } as proto.IMessage)
		const decoded = reptzy.decodeProto(encoded)

		expect(decoded.conversation).toBe('RepTzy round trip')
	})

	it('rejects unknown proto fields before relay', async () => {
		const { relayMessage, socket } = setup()
		const reptzy = new RepTzyMessage(socket)

		expect(() => reptzy.sendProto('123@s.whatsapp.net', { inventedRepTzyField: {} } as never)).toThrow(
			'not present in the bundled WhatsApp schema'
		)
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('creates a destructuring-safe RepTzy suite', async () => {
		const { sendMessage, socket } = setup()
		const { reptzy, send } = createRepTzySuite(socket)

		await send('123@s.whatsapp.net', { text: 'suite send' })
		await reptzy.sendMessage('123@s.whatsapp.net', { text: 'suite instance' })

		expect(sendMessage).toHaveBeenCalledTimes(2)
	})
})
