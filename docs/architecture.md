# Architecture — Package System

This is a contributor-facing overview of how apps and commands are wired internally. If you just want to *build* a package, see [packages.md](./packages.md).

---

## Module map

| File | Role |
|---|---|
| [`JavaScript/installer.js`](../JavaScript/installer.js) | Reads `.zip` (JSZip lazy-loaded from CDN), validates the manifest, shows install confirmation, sets correct MIME types on extracted Blobs, wires drag-drop overlay |
| [`JavaScript/registry.js`](../JavaScript/registry.js) | IndexedDB `aruta_packages` (manifests + files), `localStorage.aruta_installed_apps` cache for fast boot, registers custom apps in `WIN_META` + dynamically creates their window DOM + Start menu items |
| [`JavaScript/sandbox.js`](../JavaScript/sandbox.js) | Apps → `<iframe sandbox="allow-scripts">` with `srcdoc` bootstrap, commands → blob-URL dynamic `import()`. Implements the `ctx` bridge (postMessage for apps, direct for commands) and the permission-gated method dispatcher |
| [`JavaScript/permissions.js`](../JavaScript/permissions.js) | Per-app grant store, runtime prompt modal (serialized so only one shows at a time), Settings → Permissions renderer |
| [`JavaScript/terminal.js`](../JavaScript/terminal.js) | Shell UI, parser (quoted strings), history, built-in commands. Unknown names fall through to `registry.listCommands()` → `sandbox.runCommand()` |

Script load order in `index.html`:
```
config.js  core.js  effects.js  desktop.js  content.js  extras.js
os.js  permissions.js  registry.js  sandbox.js  installer.js  terminal.js
app.js
```

`app.js:showApp()` calls `registry.bootstrap()` (hydrate from IndexedDB) and `installer.initDragDrop()`.

---

## Storage layout

| Where | Key / name | Purpose |
|---|---|---|
| IndexedDB | `aruta_packages` / `manifests` store | Full manifest + `_installedAt` (keyPath `id`) |
| IndexedDB | `aruta_packages` / `files` store | Blobs keyed by `[appId, path]` |
| IndexedDB | `aruta_app_<id>` / `kv` store | Per-app private storage exposed via `ctx.storage` |
| localStorage | `aruta_installed_apps` | Fast index cache (id/name/icon/type/permissions) |
| localStorage | `aruta_perms_<id>` | `{ permName: 'granted'\|'denied' }` |
| localStorage | `aruta_term_history` | Terminal history (max 100) |

### Wipe flows

- **Wipe All** (`os.js` wipe button) — clears both storages and deletes `aruta_packages` + every `aruta_app_<id>`
- **Wipe Settings Only** — iterates `localStorage`, preserves `aruta_installed_apps` and any `aruta_perms_*`, clears everything else. IndexedDB untouched.

---

## Sandbox lifecycle (apps)

Iframe boot HTML is inlined in `sandbox.js:IFRAME_BOOT` via `srcdoc`. Because `sandbox="allow-scripts"` has no `allow-same-origin`, the iframe gets an opaque origin → fully isolated from the host DOM.

```
┌──────────────────────────── Parent ────────────────────────────┐
│  mountApp(id):                                                 │
│    getFiles() from IndexedDB → Map<path, Blob>                 │
│    iframe.srcdoc = IFRAME_BOOT                                 │
│    listen for messages                                         │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────── Iframe (opaque origin) ────────────────────┐
│  on load → postMessage({type:'ready'})                         │
│  on 'init' → URL.createObjectURL(blob) for each file          │
│             inject style.css if present                        │
│             import(entryBlobURL) → mount(root, ctx)            │
│  ctx.foo(...) → postMessage({type:'call', id, method, args})  │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────── Parent ────────────────────────────────────┐
│  on 'call' → _handleCall(appId, method, args)                  │
│    permissions.request(appId, PERM_REQUIRED[method])           │
│    execute real host method                                    │
│    postMessage({type:'reply', id, value|error})                │
└────────────────────────────────────────────────────────────────┘
```

**Important**: blob URLs are origin-scoped. The host's blob URLs can't be used inside the iframe. That's why Blobs themselves (not URLs) are shipped via postMessage, and the iframe mints its own URLs locally.

### File MIME types

`installer.js` sets the Blob type from the file extension when unpacking. Browsers require `text/javascript` on blobs used with dynamic `import()`, otherwise the module load is rejected. If you add new supported file types, extend the MIME map there.

---

## Commands

Commands have no UI, so running them in an iframe would add startup cost for no security benefit. Instead:

- `sandbox.runCommand(id, args)` grabs the entry Blob from IndexedDB
- `URL.createObjectURL` + `await import(url)` in the main thread
- Builds a host-side `ctx` via `_buildHostCtx(id, files)` — same API, direct calls, but each call still goes through `permissions.request()`

Trade-off: commands can touch main-thread globals if they want to. The permission gate only covers documented capabilities. Users should install commands only from trusted sources — the install modal clearly shows the type.

---

## Permission gate

- Declared permissions (`manifest.permissions`) → **informational only**, shown in install modal
- Real grants → runtime, per-method (mapping in `sandbox.js:PERM_REQUIRED`)
- Stored in `localStorage.aruta_perms_<id>`

`permissions.js:permRequest(appId, perm)`:
1. Read stored state
2. `granted` → return `true`
3. `denied` → return `false`
4. Unset → show modal (serialized through `_activePrompt` so multiple simultaneous requests queue), persist decision on `always` / `deny`, resolve

If a method resolves to something that would be misleading when denied (e.g. `fetch`), the dispatcher throws `permission_denied:<perm>`. Otherwise the soft-fail pattern (null/false) keeps package code simple.

---

## Extending the API

To add a new `ctx.foo(...)` method:

1. Decide if it's protected. If yes, add to `sandbox.js:PERM_REQUIRED` and to `permissions.js:PERM_LIST`. Add copy in `config.js` under `perm_<name>` + `perm_<name>_desc` (at least IT & EN).
2. Implement the host-side behaviour in `sandbox.js:_handleCall` (for apps via iframe bridge).
3. Mirror the call shape in `sandbox.js:IFRAME_BOOT`'s `ctx` object (the proxy the iframe hands to user code).
4. Mirror again in `sandbox.js:_buildHostCtx` (the direct-call ctx for commands).
5. Document it in [ctx-api.md](./ctx-api.md).

---

## Gotchas to remember

- `WIN_META` entries for custom apps are created at runtime with `custom: true`. `os.js:openWindow` uses that flag to decide whether to invoke `sandbox.mount(id)`.
- Window label translation uses `sec_<id>` in i18n. Custom apps have no entry → `addWindowTab` falls back to `meta.label` (= manifest name). If you want user-facing strings translatable, add them at registration time — or accept the fallback.
- The install dropzone has `pointer-events: none` but `dragover` still needs `preventDefault()` for drop to fire. Document-level listeners handle that.
- `JSZip` is loaded from CDN lazily the first time the user installs something. If you want offline support, vendor it locally.
- The iframe's default font is whatever the iframe CSS sets — the host's Google Fonts don't cross the origin. If you want your app to use them, link them in your `style.css`.
