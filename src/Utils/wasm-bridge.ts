/**
 * Lazy-loading wrapper for whatsapp-rust-bridge.
 *
 * The whatsapp-rust-bridge package uses a top-level `await` to initialize its
 * WASM module, which makes the entire ESM graph asynchronous. This prevents
 * CJS consumers from using `require()` on any package that statically imports
 * from it (ERR_REQUIRE_ASYNC_MODULE).
 *
 * This wrapper uses dynamic `import()` so the top-level await is deferred and
 * does not infect the rest of the module graph. The module is cached after the
 * first load so subsequent calls are synchronous.
 *
 * If the WASM module fails to load (e.g. on CPUs without SIMD support),
 * the bridge will remain undefined and callers should handle the absence.
 */

type WasmBridge = typeof import('whatsapp-rust-bridge')

let _bridge: WasmBridge | undefined
let _loadError: Error | undefined

/**
 * Ensures the WASM bridge is loaded. Must be awaited once before any
 * synchronous helpers (getWasmBridge) are called.
 *
 * Returns undefined if the WASM module cannot be loaded (e.g. SIMD not supported).
 */
export async function loadWasmBridge(): Promise<WasmBridge | undefined> {
	if(_bridge) {
		return _bridge
	}

	if(_loadError) {
		return undefined
	}

	try {
		_bridge = await import('whatsapp-rust-bridge')
	} catch(err) {
		_loadError = err as Error
		console.warn(
			'[Baileys] whatsapp-rust-bridge WASM module could not be loaded. '
			+ 'Falling back to pure JS implementations. '
			+ 'Reason: ' + (err as Error)?.message
		)
	}

	return _bridge
}

/**
 * Returns the already-loaded WASM bridge **synchronously**.
 * Returns undefined if the module was not loaded or failed to load.
 */
export function getWasmBridge(): WasmBridge | undefined {
	return _bridge
}

/**
 * Returns true if the WASM bridge failed to load.
 */
export function wasmBridgeFailed(): boolean {
	return !!_loadError
}
