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
 */

type WasmBridge = typeof import('whatsapp-rust-bridge')

let _bridge: WasmBridge | undefined

/**
 * Ensures the WASM bridge is loaded. Must be awaited once before any
 * synchronous helpers (getWasmBridge) are called.
 */
export async function loadWasmBridge(): Promise<WasmBridge> {
	if(!_bridge) {
		_bridge = await import('whatsapp-rust-bridge')
	}

	return _bridge
}

/**
 * Returns the already-loaded WASM bridge **synchronously**.
 * Throws if `loadWasmBridge()` has not been awaited yet.
 */
export function getWasmBridge(): WasmBridge {
	if(!_bridge) {
		throw new Error(
			'whatsapp-rust-bridge has not been initialized. '
			+ 'Call and await loadWasmBridge() before using WASM functions.'
		)
	}

	return _bridge
}
