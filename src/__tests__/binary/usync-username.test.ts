import { decodeBinaryNode, encodeBinaryNode } from '../../WABinary'
import { USyncUsernameProtocol } from '../../WAUSync/Protocols/USyncUsernameProtocol'

describe('USync username decoding', () => {
	const protocol = new USyncUsernameProtocol()

	it('preserves a username through the binary wire codec', async () => {
		const node = await decodeBinaryNode(encodeBinaryNode({ tag: 'username', attrs: {}, content: 'example.user_123' }))
		expect(Buffer.isBuffer(node.content)).toBe(true)
		expect(protocol.parser(node)).toBe('example.user_123')
	})

	it('accepts text and byte payloads without reading display names', () => {
		for (const content of ['example.user', Buffer.from('example.user'), new Uint8Array(Buffer.from('example.user'))]) {
			expect(protocol.parser({ tag: 'username', attrs: {}, content })).toBe('example.user')
		}
		expect(protocol.parser({ tag: 'username', attrs: { name: 'Display name' } })).toBeNull()
		expect(protocol.parser({ tag: 'notify', attrs: {}, content: 'Display name' })).toBeNull()
	})

	it('propagates protocol errors instead of interpreting them as usernames', () => {
		expect(() =>
			protocol.parser({
				tag: 'username',
				attrs: {},
				content: [{ tag: 'error', attrs: { code: '401', text: 'not-authorized' } }]
			})
		).toThrow('not-authorized')
	})
})
