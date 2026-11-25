import { DisconnectReason, type UserFacingSocketConfig } from '../Types/index.js'
import type { ConnectionState } from '../Types/State.js'
import makeWASocket from '../Socket/index.js'

export type RepanManagedSocket = ReturnType<typeof makeWASocket>

export type RepanConnectionManagerOptions = {
	config: UserFacingSocketConfig
	/** Optional socket factory override for deterministic tests/custom adapters. */
	makeSocket?: (config: UserFacingSocketConfig) => RepanManagedSocket
	/** Save the existing auth state whenever Baileys emits creds.update. */
	saveCreds?: () => Promise<void> | void
	onSocket?: (socket: RepanManagedSocket) => void | Promise<void>
	onConnectionUpdate?: (update: Partial<ConnectionState>) => void | Promise<void>
	onError?: (error: unknown) => void | Promise<void>
	minReconnectDelayMs?: number
	maxReconnectDelayMs?: number
	maxRetries?: number
}

const NON_RETRYABLE_DISCONNECTS = new Set<number>([
	DisconnectReason.loggedOut,
	DisconnectReason.badSession,
	DisconnectReason.forbidden,
	DisconnectReason.multideviceMismatch,
	DisconnectReason.connectionReplaced
])

const getStatusCode = (error: unknown): number | undefined => {
	if (!error || typeof error !== 'object') return undefined
	const output = 'output' in error ? error.output : undefined
	if (output && typeof output === 'object' && 'statusCode' in output) {
		const statusCode = output.statusCode
		return typeof statusCode === 'number' ? statusCode : undefined
	}
	return undefined
}

/**
 * Owns socket recreation for transient disconnects. It deliberately stops on
 * logout, invalid auth, forbidden accounts and replaced sessions; those cases
 * require user action and must not be hidden by an endless reconnect loop.
 */
export const createRepanConnectionManager = (options: RepanConnectionManagerOptions) => {
	const requestedMinDelay = options.minReconnectDelayMs ?? 1_000
	const requestedMaxDelay = options.maxReconnectDelayMs ?? 30_000
	const requestedMaxRetries = options.maxRetries ?? 12
	const minDelay = Number.isFinite(requestedMinDelay)
		? Math.max(250, Math.min(60_000, Math.floor(requestedMinDelay)))
		: 1_000
	const maxDelay = Number.isFinite(requestedMaxDelay)
		? Math.max(minDelay, Math.min(300_000, Math.floor(requestedMaxDelay)))
		: Math.max(minDelay, 30_000)
	const maxRetries = Number.isFinite(requestedMaxRetries)
		? Math.max(0, Math.min(100, Math.floor(requestedMaxRetries)))
		: 12

	let socket: RepanManagedSocket | undefined
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined
	let stopped = false
	let retryCount = 0
	let generation = 0
	let pendingCredentialSave: Promise<void> = Promise.resolve()

	const reportError = (error: unknown) => {
		try {
			const result = options.onError?.(error)
			// Error reporters are user code too; a rejected reporter must not create
			// a second unhandled rejection while handling the original failure.
			void Promise.resolve(result).catch(() => undefined)
		} catch {
			// User callbacks must not break connection lifecycle management.
		}
	}

	const invokeCallback = (callback: (() => void | Promise<void>) | undefined) => {
		if (!callback) return
		try {
			void Promise.resolve(callback()).catch(reportError)
		} catch (error) {
			reportError(error)
		}
	}

	const scheduleReconnect = (error: unknown, statusCode?: number) => {
		if (stopped || reconnectTimer) return
		if (statusCode !== undefined && NON_RETRYABLE_DISCONNECTS.has(statusCode)) {
			reportError(error ?? new Error(`Non-retryable WhatsApp disconnect: ${statusCode}`))
			return
		}
		if (retryCount >= maxRetries) {
			reportError(new Error(`VamXRepan reconnect limit reached (${maxRetries}). Last status: ${statusCode ?? 'unknown'}`))
			return
		}

		const exponential = Math.min(maxDelay, minDelay * 2 ** retryCount)
		const jitter = Math.floor(Math.random() * Math.min(750, Math.max(1, exponential * 0.2)))
		const delay = Math.min(maxDelay, exponential + jitter)
		retryCount += 1
		reconnectTimer = setTimeout(() => {
			reconnectTimer = undefined
			if (!stopped) {
				try {
					createSocket()
				} catch {
					// createSocket reports construction failures and schedules the
					// next bounded retry; never leak an uncaught timer exception.
				}
			}
		}, delay)
	}

	const createSocket = (): RepanManagedSocket => {
		if (stopped) throw new Error('VamXRepan connection manager has been stopped')
		let instance: RepanManagedSocket
		try {
			instance = (options.makeSocket ?? makeWASocket)(options.config)
		} catch (error) {
			reportError(error)
			scheduleReconnect(error, getStatusCode(error))
			throw error
		}
		const currentGeneration = ++generation
		socket = instance

		if (options.saveCreds) {
			instance.ev.on('creds.update', () => {
				// Ignore late updates from a replaced/stopped socket; they must not overwrite
				// credentials already persisted by the current connection generation.
				if (stopped || currentGeneration !== generation) return
				// Serialize saves so an older, slower write cannot overtake a newer one.
				pendingCredentialSave = pendingCredentialSave
					.then(async () => { await options.saveCreds?.() })
					.catch(reportError)
			})
		}

		instance.ev.on('connection.update', update => {
			if (currentGeneration !== generation || stopped) return
			invokeCallback(() => options.onConnectionUpdate?.(update))
			if (update.connection === 'open') {
				retryCount = 0
				return
			}
			if (update.connection === 'close') {
				const error = update.lastDisconnect?.error
				socket = undefined
				scheduleReconnect(error, getStatusCode(error))
			}
		})

		// Attach lifecycle listeners before invoking user code: an onSocket callback
		// may synchronously inspect or emit socket events during setup.
		invokeCallback(() => options.onSocket?.(instance))
		return instance
	}

	return {
		start: (): RepanManagedSocket => {
			if (stopped) throw new Error('VamXRepan connection manager has been stopped')
			if (reconnectTimer) clearTimeout(reconnectTimer)
			reconnectTimer = undefined
			return socket ?? createSocket()
		},
		stop: async (): Promise<void> => {
			stopped = true
			if (reconnectTimer) clearTimeout(reconnectTimer)
			reconnectTimer = undefined
			const current = socket
			socket = undefined
			try {
				if (current) await current.end(new Error('VamXRepan connection manager stopped'))
			} finally {
				await pendingCredentialSave
			}
		},
		getSocket: () => socket,
		getRetryCount: () => retryCount,
		isStopped: () => stopped
	}
}
