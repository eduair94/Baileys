# Fixing `ERR_REQUIRE_ASYNC_MODULE` after updating `@eduair94/baileys`

## The Problem

After updating to `@eduair94/baileys@7.0.0-rc.12`, you may see this error:

```
Error: require() cannot be used on an ESM graph with top-level await.
Use import() instead.
ERR_REQUIRE_ASYNC_MODULE
```

## Why It Happens

Starting in `v7.0.0-rc.12`, Baileys depends on `whatsapp-rust-bridge`, a Rust-based WASM module that uses a **top-level `await`** to initialize itself. Node.js cannot synchronously `require()` any module that has a top-level `await` anywhere in its dependency tree — even indirectly.

```
Your project (CJS / require)
  └── @eduair94/baileys (ESM)
        └── whatsapp-rust-bridge (ESM + top-level await) ← breaks require()
```

## How to Fix It

### Option 1 — Use `await import()` (Minimal Change)

Replace your `require()` call with a dynamic `import()`:

**Before:**

```js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@eduair94/baileys')
```

**After:**

```js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import('@eduair94/baileys')
```

> **Note:** `await` at the top level only works in ESM files (`.mjs` or `"type": "module"` in your `package.json`). If your file is CJS, wrap it in an async function instead — see Option 2.

---

### Option 2 — Wrap in an Async Entry Point (CJS Projects)

If your project uses CommonJS and you cannot switch to ESM, wrap your entry point in an async IIFE:

**Before (`index.js`):**

```js
const { default: makeWASocket, useMultiFileAuthState } = require('@eduair94/baileys')

const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state })
    // ...
}

startBot()
```

**After (`index.js`):**

```js
async function main() {
    const { default: makeWASocket, useMultiFileAuthState } = await import('@eduair94/baileys')

    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state })
    // ...
}

main()
```

That's it — the only change is replacing `require()` with `await import()` inside an async function.

---

### Option 3 — Convert Your Project to ESM (Cleanest)

1. Add `"type": "module"` to your `package.json`:

   ```json
   {
     "type": "module"
   }
   ```

2. Replace all `require()` calls with `import` statements:

   ```js
   import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@eduair94/baileys'
   ```

3. Replace `module.exports` with `export`:

   ```js
   // Before
   module.exports = { myFunction }

   // After
   export { myFunction }
   ```

4. Replace `__dirname` / `__filename` if used:

   ```js
   import { fileURLToPath } from 'url'
   import { dirname } from 'path'

   const __filename = fileURLToPath(import.meta.url)
   const __dirname = dirname(__filename)
   ```

---

### Option 4 — Use a `.mjs` Wrapper File

If you don't want to touch your existing CJS code at all, create a thin ESM wrapper:

**`baileys-loader.mjs`:**

```js
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@eduair94/baileys'

export {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
}
```

**Your CJS code:**

```js
async function main() {
    const baileys = await import('./baileys-loader.mjs')
    const sock = baileys.makeWASocket({ /* ... */ })
}

main()
```

---

## TypeScript Projects

If you're using TypeScript, make sure your `tsconfig.json` targets ESM:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2020"
  }
}
```

And use standard `import` syntax — TypeScript handles this natively:

```ts
import makeWASocket, { useMultiFileAuthState } from '@eduair94/baileys'
```

---

## Quick Reference

| Your Setup | Fix |
|---|---|
| `require('@eduair94/baileys')` in CJS | → `await import('@eduair94/baileys')` inside an async function |
| `.js` file with `"type": "module"` | → Use `import` or top-level `await import()` |
| TypeScript with ESM config | → Use `import` (no changes needed) |
| Can't modify imports at all | → Pin to `@eduair94/baileys@7.0.0-rc.11` |

## Minimum Node.js Version

This package requires **Node.js >= 20.0.0**.
