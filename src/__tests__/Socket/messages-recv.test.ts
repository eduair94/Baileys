import { jest } from '@jest/globals'
import { DEFAULT_CONNECTION_CONFIG } from '../../Defaults'
import type { AuthenticationState } from '../../Types'
import { type BinaryNode } from '../../WABinary'

const sendNode = jest.fn(async () => undefined)
const authState = {
	creds: {},
	keys: {
		get: jest.fn(async () => ({})),
		set: jest.fn(async () => undefined)
	}
}

jest.unstable_mockModule('../../Socket/messages-send', () => ({
	makeMessagesSocket: jest.fn(() => ({
		authState,
		sendNode,
		ws: {
			on: jest.fn()
		},
		ev: {
			on: jest.fn()
		},
		registerSocketEndHandler: jest.fn(),
		signalRepository: {
			lidMapping: {
				getLIDForPN: jest.fn()
			}
		}
	}))
}))

const { makeMessagesRecvSocket } = await import('../../Socket/messages-recv')

describe('sendMessageAck', () => {
	it('acknowledges notifications before credentials identify the device', async () => {
		const sock = makeMessagesRecvSocket({
			...DEFAULT_CONNECTION_CONFIG,
			auth: authState as unknown as AuthenticationState
		})
		const node: BinaryNode = {
			tag: 'notification',
			attrs: {
				id: 'pre-login-notification',
				from: 's.whatsapp.net',
				type: 'companion_reg_refresh'
			}
		}

		await expect(sock.sendMessageAck(node)).resolves.toBeUndefined()
		expect(sendNode).toHaveBeenCalledWith({
			tag: 'ack',
			attrs: {
				id: 'pre-login-notification',
				to: 's.whatsapp.net',
				class: 'notification',
				type: 'companion_reg_refresh'
			}
		})
	})
})

describe('socket end cleanup', () => {
	it('closes every cache it created, including the retry-resend cache', async () => {
		const NodeCache = (await import('@cacheable/node-cache')).default
		const closeSpy = jest.spyOn(NodeCache.prototype, 'close')
		const { makeMessagesSocket } = await import('../../Socket/messages-send')
		const registerSocketEndHandler = jest.fn()
		;(makeMessagesSocket as jest.Mock).mockReturnValueOnce({
			authState,
			sendNode,
			ws: { on: jest.fn() },
			ev: { on: jest.fn() },
			registerSocketEndHandler,
			signalRepository: { lidMapping: { getLIDForPN: jest.fn() } }
		})

		makeMessagesRecvSocket({
			...DEFAULT_CONNECTION_CONFIG,
			auth: authState as unknown as AuthenticationState
		})
		closeSpy.mockClear()

		// every handler registered for socket end must run; each owned NodeCache keeps a
		// checkperiod timer alive until close(), so a missed close leaks one per socket
		for (const [handler] of registerSocketEndHandler.mock.calls) {
			;(handler as () => void)()
		}

		// msgRetryCache, msgRetryResendCache, callOfferCache, identityAssertDebounce
		expect(new Set(closeSpy.mock.contexts).size).toBe(4)
		closeSpy.mockRestore()
	})
})
