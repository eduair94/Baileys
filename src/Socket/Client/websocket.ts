import WebSocket from 'ws'
import { DEFAULT_ORIGIN } from '../../Defaults'
import { AbstractSocketClient } from './types'

export class WebSocketClient extends AbstractSocketClient {
	protected socket: WebSocket | null = null

	/**
	 * CONNECTION STABILITY: Store references to the event forwarding
	 * functions so they can be removed from the native WebSocket when
	 * the connection closes. Without this, the native socket holds
	 * references to `this.emit` which prevents GC of the client and
	 * all objects it references.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private socketListeners: Map<string, (...args: any[]) => void> = new Map()

	get isOpen(): boolean {
		return this.socket?.readyState === WebSocket.OPEN
	}
	get isClosed(): boolean {
		return this.socket === null || this.socket?.readyState === WebSocket.CLOSED
	}
	get isClosing(): boolean {
		return this.socket === null || this.socket?.readyState === WebSocket.CLOSING
	}
	get isConnecting(): boolean {
		return this.socket?.readyState === WebSocket.CONNECTING
	}

	connect() {
		if (this.socket) {
			return
		}

		this.socket = new WebSocket(this.url, {
			origin: DEFAULT_ORIGIN,
			headers: this.config.options?.headers as {},
			handshakeTimeout: this.config.connectTimeoutMs,
			timeout: this.config.connectTimeoutMs,
			agent: this.config.agent
		})

		this.socket.setMaxListeners(0)

		/**
		 * CONNECTION STABILITY: Enable OS-level TCP keepalive + disable
		 * Nagle on the underlying net.Socket once the HTTP upgrade completes.
		 *
		 * Without OS keepalive, NAT/firewall middleboxes (cellular carriers,
		 * corporate proxies) silently drop idle TCP connections after a few
		 * minutes, leaving us with a half-open socket. Detection then relies
		 * on the app-layer keepalive (~30s interval, 3-strike), so worst-case
		 * dead-detection is well over a minute. OS keepalive sends TCP probes
		 * every 30s once the connection is otherwise idle and fails the
		 * socket via RST within seconds of no ACK.
		 *
		 * `setNoDelay(true)` disables Nagle's algorithm — WhatsApp's protocol
		 * is request/response with small frames, so coalescing adds latency
		 * without compression benefit.
		 *
		 * We listen on the `upgrade` event so this fires exactly when the
		 * raw socket transitions to WebSocket — the `_socket` property is
		 * stable by then. Errors here are non-fatal (some platforms lack
		 * the option) so swallow rather than break the connection.
		 */
		const tuneRawSocket = () => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const raw = (this.socket as any)?._socket
				if (raw && typeof raw.setKeepAlive === 'function') {
					raw.setKeepAlive(true, 30_000)
				}

				if (raw && typeof raw.setNoDelay === 'function') {
					raw.setNoDelay(true)
				}
			} catch {
				// Tuning is best-effort; never block the connection on it.
			}
		}

		this.socket.once('upgrade', tuneRawSocket)
		// Some flows expose the socket before 'upgrade' (e.g. when a proxy
		// completes CONNECT). Try once on 'open' as well — idempotent.
		this.socket.once('open', tuneRawSocket)

		const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response']

		for (const event of events) {
			const handler = (...args: any[]) => this.emit(event, ...args)
			this.socketListeners.set(event, handler)
			this.socket?.on(event, handler)
		}
	}

	async close() {
		if (!this.socket) {
			return
		}

		/**
		 * CONNECTION STABILITY: Remove all forwarding listeners from the
		 * native WebSocket before closing. This ensures no event fires
		 * after close and breaks the reference chain from the native
		 * socket back to this client instance.
		 */
		for (const [event, handler] of this.socketListeners) {
			this.socket.removeListener(event, handler)
		}

		this.socketListeners.clear()

		/**
		 * CONNECTION STABILITY: Swallow any error the native ws emits
		 * synchronously during close (e.g. when called before the socket
		 * finished connecting, ws emits 'error' from inside close()).
		 * Without this listener, those late errors propagate as Node
		 * unhandled errors and crash the test runner.
		 */
		this.socket.on('error', () => {})

		const closePromise = new Promise<void>(resolve => {
			this.socket?.once('close', resolve)
		})

		this.socket.close()

		await closePromise

		this.socket = null
	}
	send(str: string | Uint8Array, cb?: (err?: Error) => void): boolean {
		this.socket?.send(str, cb)

		return Boolean(this.socket)
	}
}
