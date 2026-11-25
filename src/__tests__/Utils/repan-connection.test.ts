import { EventEmitter } from 'events'
import { createRepanConnectionManager, type RepanManagedSocket } from '../../Utils/repan-connection.js'
import { DisconnectReason } from '../../Types/index.js'

describe('RepanOffcl connection manager', () => {
	afterEach(() => {
		jest.useRealTimers()
	})

	it('saves updated credentials and recreates sockets after transient disconnects', async () => {
		jest.useFakeTimers()
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const saveCreds = jest.fn().mockResolvedValue(undefined)
		const manager = createRepanConnectionManager({
			config: { auth: {} as never },
			makeSocket,
			saveCreds,
			minReconnectDelayMs: 250,
			maxReconnectDelayMs: 500,
			maxRetries: 2
		})

		manager.start()
		sockets[0].ev.emit('creds.update', {})
		await Promise.resolve()
		expect(saveCreds).toHaveBeenCalledTimes(1)

		sockets[0].ev.emit('connection.update', {
			connection: 'close',
			lastDisconnect: { error: { output: { statusCode: DisconnectReason.connectionLost } }, date: new Date() }
		})
		jest.advanceTimersByTime(2_000)
		expect(makeSocket).toHaveBeenCalledTimes(2)
		expect(manager.getSocket()).toBe(sockets[1])
		await manager.stop()
		expect(manager.isStopped()).toBe(true)
	})

	it('ignores credential and connection events after stop', async () => {
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const saveCreds = jest.fn().mockResolvedValue(undefined)
		const onConnectionUpdate = jest.fn()
		const manager = createRepanConnectionManager({
			config: { auth: {} as never }, makeSocket, saveCreds, onConnectionUpdate
		})
		manager.start()
		await manager.stop()
		sockets[0].ev.emit('creds.update', {})
		sockets[0].ev.emit('connection.update', { connection: 'open' })
		await Promise.resolve()
		expect(saveCreds).not.toHaveBeenCalled()
		expect(onConnectionUpdate).not.toHaveBeenCalled()
		expect(manager.getSocket()).toBeUndefined()
	})

	it('ignores late credential updates from a replaced socket generation', async () => {
		jest.useFakeTimers()
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const saveCreds = jest.fn().mockResolvedValue(undefined)
		const manager = createRepanConnectionManager({
			config: { auth: {} as never }, makeSocket, saveCreds,
			minReconnectDelayMs: 250, maxReconnectDelayMs: 250
		})
		manager.start()
		sockets[0].ev.emit('connection.update', {
			connection: 'close',
			lastDisconnect: { error: { output: { statusCode: DisconnectReason.connectionLost } }, date: new Date() }
		})
		jest.advanceTimersByTime(1_000)
		expect(sockets).toHaveLength(2)
		sockets[0].ev.emit('creds.update', {})
		sockets[1].ev.emit('creds.update', {})
		await Promise.resolve()
		expect(saveCreds).toHaveBeenCalledTimes(1)
		await manager.stop()
	})

	it('registers lifecycle listeners before invoking the socket callback', async () => {
		const events = new EventEmitter()
		const socket = { ev: events, end: jest.fn().mockResolvedValue(undefined) }
		const onConnectionUpdate = jest.fn()
		const manager = createRepanConnectionManager({
			config: { auth: {} as never },
			makeSocket: () => socket as unknown as RepanManagedSocket,
			onConnectionUpdate,
			onSocket: current => { current.ev.emit('connection.update', { connection: 'open' }) }
		})
		manager.start()
		expect(onConnectionUpdate).toHaveBeenCalledWith({ connection: 'open' })
		await manager.stop()
	})

	it('does not reconnect a logged-out session', () => {
		jest.useFakeTimers()
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const onError = jest.fn()
		const manager = createRepanConnectionManager({
			config: { auth: {} as never },
			makeSocket,
			onError,
			maxRetries: 3
		})

		manager.start()
		sockets[0].ev.emit('connection.update', {
			connection: 'close',
			lastDisconnect: { error: { output: { statusCode: DisconnectReason.loggedOut } }, date: new Date() }
		})
		jest.runOnlyPendingTimers()
		expect(makeSocket).toHaveBeenCalledTimes(1)
		expect(onError).toHaveBeenCalledTimes(1)
	})
	it('serializes asynchronous credential snapshots so newer saves cannot overtake older ones', async () => {
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		let releaseFirst!: () => void
		const firstSave = new Promise<void>(resolve => { releaseFirst = resolve })
		const saveCreds = jest.fn().mockImplementationOnce(() => firstSave).mockResolvedValue(undefined)
		const manager = createRepanConnectionManager({ config: { auth: {} as never }, makeSocket, saveCreds })

		manager.start()
		sockets[0].ev.emit('creds.update', {})
		sockets[0].ev.emit('creds.update', {})
		await Promise.resolve()
		expect(saveCreds).toHaveBeenCalledTimes(1)
		releaseFirst()
		await Promise.resolve()
		await Promise.resolve()
		expect(saveCreds).toHaveBeenCalledTimes(2)
		await manager.stop()
	})

	it('reports rejected async lifecycle callbacks without leaking unhandled rejections', async () => {
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const callbackError = new Error('async callback failed')
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const onError = jest.fn()
		const manager = createRepanConnectionManager({
			config: { auth: {} as never }, makeSocket, onError,
			onConnectionUpdate: async () => { throw callbackError }
		})
		manager.start()
		sockets[0].ev.emit('connection.update', { connection: 'connecting' })
		await Promise.resolve()
		await Promise.resolve()
		expect(onError).toHaveBeenCalledWith(callbackError)
		await manager.stop()
	})

	it('reports synchronous credential-save errors without throwing from the event handler', async () => {
		const socketEvents: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			socketEvents.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const saveError = new Error('credential store unavailable')
		const saveCreds = jest.fn(() => { throw saveError })
		const onError = jest.fn()
		const manager = createRepanConnectionManager({
			config: { auth: {} as never },
			makeSocket,
			saveCreds,
			onError
		})

		manager.start()
		expect(() => socketEvents[0].ev.emit('creds.update', {})).not.toThrow()
		await Promise.resolve()
		expect(onError).toHaveBeenCalledWith(saveError)
		await manager.stop()
	})

	it('bounds non-finite reconnect settings and retains a finite retry budget', async () => {
		jest.useFakeTimers()
		const sockets: { ev: EventEmitter; end: jest.Mock }[] = []
		const makeSocket = jest.fn(() => {
			const socket = { ev: new EventEmitter(), end: jest.fn().mockResolvedValue(undefined) }
			sockets.push(socket)
			return socket as unknown as RepanManagedSocket
		})
		const onError = jest.fn()
		const manager = createRepanConnectionManager({
			config: { auth: {} as never },
			makeSocket,
			onError,
			minReconnectDelayMs: Number.NaN,
			maxReconnectDelayMs: Number.POSITIVE_INFINITY,
			maxRetries: Number.NaN
		})

		manager.start()
		for (let attempt = 0; attempt < 13; attempt += 1) {
			sockets[sockets.length - 1].ev.emit('connection.update', {
				connection: 'close',
				lastDisconnect: { error: { output: { statusCode: DisconnectReason.connectionLost } }, date: new Date() }
			})
			jest.runOnlyPendingTimers()
		}

		expect(makeSocket).toHaveBeenCalledTimes(13)
		expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining('limit reached') }))
		await manager.stop()
	})

})
