import { LTHashAntiTampering as LTHashAntiTamperingFallback } from './wasm-fallback'

interface ILTHashAntiTampering {
	subtractThenAdd(base: Uint8Array, subtract: Uint8Array[], add: Uint8Array[]): Uint8Array
}

let ltHash: ILTHashAntiTampering

try {
	const wasm = await import('whatsapp-rust-bridge')
	ltHash = new wasm.LTHashAntiTampering()
} catch{
	ltHash = new LTHashAntiTamperingFallback()
}

/**
 * LT Hash is a summation based hash algorithm that maintains the integrity of a piece of data
 * over a series of mutations. You can add/remove mutations and it'll return a hash equal to
 * if the same series of mutations was made sequentially.
 */
export const LT_HASH_ANTI_TAMPERING = ltHash
