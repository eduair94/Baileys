/**
 * Pure JS fallback implementations for whatsapp-	subtractThenAdd(
		base: Uint8Array,
		subtractList: Uint8Array[],
		addList: Uint8Array[]
	): Uint8Array {
		let result: Uint8Array = new Uint8Array(base)
		for(const item of subtractList) {
			result = this.performOp(result, item, (a, b) => a - b) as Uint8Array
		}

		for(const item of addList) {
			result = this.performOp(result, item, (a, b) => a + b) as Uint8Array
		}

		return result
	}tions.
 *
 * These are used when the WASM module fails to load (e.g. on CPUs
 * that do not support WebAssembly SIMD instructions).
 *
 * All functions match the synchronous signatures of the WASM versions.
 */
import { createHash, hkdfSync } from 'crypto'

export function md5(buffer: Uint8Array): Uint8Array {
	return createHash('md5').update(buffer).digest()
}

export function hkdf(
	buffer: Uint8Array,
	expandedLength: number,
	info: { salt?: Uint8Array; info?: string }
): Uint8Array {
	const salt = info.salt ?? Buffer.alloc(0)
	const infoBytes = info.info ? Buffer.from(info.info) : Buffer.alloc(0)
	return new Uint8Array(hkdfSync('sha256', buffer, salt, infoBytes, expandedLength))
}

export interface ExpandedAppStateKeysFallback {
	readonly indexKey: Uint8Array
	readonly valueEncryptionKey: Uint8Array
	readonly valueMacKey: Uint8Array
	readonly snapshotMacKey: Uint8Array
	readonly patchMacKey: Uint8Array
}

export function expandAppStateKeys(keyData: Uint8Array): ExpandedAppStateKeysFallback {
	const expanded = hkdf(keyData, 160, { info: 'WhatsApp Mutation Keys' })
	return {
		indexKey: expanded.slice(0, 32),
		valueEncryptionKey: expanded.slice(32, 64),
		valueMacKey: expanded.slice(64, 96),
		snapshotMacKey: expanded.slice(96, 128),
		patchMacKey: expanded.slice(128, 160)
	}
}

/**
 * Pure-JS replacement for the WASM LTHashAntiTampering class.
 *
 * LT Hash is a summation-based hash that maintains data integrity
 * over a series of add/subtract mutations.
 */
export class LTHashAntiTampering {
	private readonly salt = 'WhatsApp Patch Integrity'
	private readonly hashLength = 128

	subtractThenAdd(
		base: Uint8Array,
		subtractList: Uint8Array[],
		addList: Uint8Array[]
	): Uint8Array {
		let result = new Uint8Array(base)
		for(const item of subtractList) {
			result = this.performOp(result, item, (a, b) => a - b)
		}

		for(const item of addList) {
			result = this.performOp(result, item, (a, b) => a + b)
		}

		return result
	}

	private performOp(
		base: Uint8Array,
		item: Uint8Array,
		op: (a: number, b: number) => number
	): Uint8Array {
		const derived = hkdf(item, this.hashLength, { info: this.salt })
		const n = new DataView(base.buffer, base.byteOffset, base.byteLength)
		const d = new DataView(derived.buffer, derived.byteOffset, derived.byteLength)
		const out = new Uint8Array(n.byteLength)
		const s = new DataView(out.buffer, out.byteOffset, out.byteLength)

		for(let offset = 0; offset < n.byteLength; offset += 2) {
			s.setUint16(offset, op(n.getUint16(offset, true), d.getUint16(offset, true)), true)
		}

		return out
	}
}
