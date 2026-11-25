import { proto } from '../../../WAProto/index.js'
import type { RepanMessageSocket } from '../../Utils/repan-message.js'
import { VamXRepanMessage, VamXRepanSendError } from '../../Utils/vamxrepan-message.js'

describe('VamXRepan.Message', () => {
	const setup = (rejected?: Error) => {
		const sendMessage = jest.fn().mockImplementation(() => rejected ? Promise.reject(rejected) : Promise.resolve({ key: { id: 'sent-1' } }))
		const relayMessage = jest.fn().mockResolvedValue(undefined)
		const emit = jest.fn()
		const socket = { sendMessage, relayMessage, ev: { emit } } as unknown as RepanMessageSocket
		return { socket, sendMessage, relayMessage, emit }
	}

	it('routes regular content through the public socket send method', async () => {
		const { socket, sendMessage, relayMessage } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		await api.send('123@s.whatsapp.net', { text: 'hello' })
		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', { text: 'hello' }, {})
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('preserves the class receiver while wrapping all send methods for diagnostics', async () => {
		const { socket, sendMessage } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })

		const sendText = api.Text.send
		await sendText('123@s.whatsapp.net', 'text helper')
		await api.Image.send('123@s.whatsapp.net', Buffer.from('image'))
		await api.Document.send('123@s.whatsapp.net', Buffer.from('document'), 'application/pdf', { fileName: 'test.pdf' })

		expect(sendMessage).toHaveBeenNthCalledWith(1, '123@s.whatsapp.net', { text: 'text helper' }, {})
		expect(sendMessage).toHaveBeenNthCalledWith(2, '123@s.whatsapp.net', { image: Buffer.from('image') }, {})
		expect(sendMessage).toHaveBeenNthCalledWith(3, '123@s.whatsapp.net', {
			document: Buffer.from('document'),
			mimetype: 'application/pdf',
			fileName: 'test.pdf'
		}, {})
	})

	it('reports successful local submission separately from delivery receipts', async () => {
		const { socket } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		const result = await api.sendDetailed('123@s.whatsapp.net', { text: 'submitted' })
		expect(result).toMatchObject({ ok: true, status: 'submitted', jid: '123@s.whatsapp.net', messageType: 'text' })
	})

	it('validates URL schemes before calling the socket', async () => {
		const { socket, sendMessage, emit } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		await api.Url.send('123@s.whatsapp.net', 'https://example.com')
		expect(sendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', { text: 'https://example.com' }, {})
		expect(() => api.Url.send('123@s.whatsapp.net', 'javascript:alert(1)')).toThrow(VamXRepanSendError)
		expect(emit).toHaveBeenCalledWith('messages.send-error', expect.objectContaining({ stage: 'validation', messageType: 'url' }))
	})

	it('returns a diagnostic result without swallowing send failures', async () => {
		const { socket, emit } = setup(new Error('Connection Closed'))
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		const result = await api.sendDetailed('123@s.whatsapp.net', { text: 'diagnostic' })

		expect(result).toMatchObject({ ok: false, stage: 'connection', jid: '123@s.whatsapp.net' })
		expect(emit).toHaveBeenCalledWith('messages.send-error', expect.objectContaining({ stage: 'connection' }))
	})

	it('exposes dedicated domain helpers and validates live-location coordinates before relay', () => {
		const { socket, relayMessage, sendMessage, emit } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		expect(api.Location).toBeDefined()
		expect(api.LiveLocation).toBeDefined()
		expect(api.Poll).toBeDefined()
		expect(api.Event).toBeDefined()
		expect(api.Reaction).toBeDefined()
		expect(api.Contact).toBeDefined()
		expect(api.Album).toBeDefined()
		expect(api.Product).toBeDefined()
		expect(api.Interactive).toBeDefined()
		expect(() => api.LiveLocation.send('123@s.whatsapp.net', {
			degreesLatitude: -99999999,
			degreesLongitude: 0
		})).toThrow(VamXRepanSendError)
		expect(emit).toHaveBeenCalledWith('messages.send-error', expect.objectContaining({ stage: 'validation', messageType: 'liveLocation' }))
		expect(relayMessage).not.toHaveBeenCalled()
		expect(sendMessage).not.toHaveBeenCalled()
	})

	it('rejects payment protobufs that combine multiple mutually exclusive families', () => {
		const { socket, relayMessage } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		expect(() => api.Payment.send('123@s.whatsapp.net', {
			requestPaymentMessage: {},
			cancelPaymentRequestMessage: {}
		} as proto.IMessage)).toThrow(VamXRepanSendError)
		expect(relayMessage).not.toHaveBeenCalled()
	})

	it('routes generated-schema IMessage payloads through validated raw relay', async () => {
		const { socket, sendMessage, relayMessage } = setup()
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		await api.sendProto('123@s.whatsapp.net', { conversation: 'proto' } as proto.IMessage)
		expect(sendMessage).not.toHaveBeenCalled()
		expect(relayMessage).toHaveBeenCalledTimes(1)
	})

	it('exposes specialised helpers for media and payment schema families', () => {
		const api = new VamXRepanMessage(setup().socket, { diagnostics: false })
		expect(api.Sticker).toBeDefined()
		expect(api.Document).toBeDefined()
		expect(api.Payment).toBeDefined()
		expect(api.Proto.supportedFields()).toContain('imageMessage')
	})

	it('emits a typed failure event and throws a diagnostic error on send rejection', async () => {
		const { socket, emit } = setup(new Error('Connection Closed'))
		const api = new VamXRepanMessage(socket, { diagnostics: false })
		await expect(api.send('123@s.whatsapp.net', { text: 'fail' })).rejects.toBeInstanceOf(VamXRepanSendError)
		expect(emit).toHaveBeenCalledWith('messages.send-error', expect.objectContaining({ stage: 'connection', suggestion: expect.stringContaining('connection: open') }))
	})
})
