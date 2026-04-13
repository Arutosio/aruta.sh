# Packages — Apps & Commands

aruta.sh can be extended at runtime by anyone. Users drop a `.zip` on the desktop, confirm the install, and a new app or command is permanently available until uninstalled. No build pipeline, no server, no dev tooling required — just an editor and a zip utility.

This doc covers **how to build your own package**. See also:

- [`ctx` API reference](./ctx-api.md)
- [Permissions](./permissions.md)
- [Examples](./examples.md)
- [Architecture](./architecture.md) (internals)

---

## Two kinds of package

| Type | Runs in | Has UI | Typical use |
|---|---|---|---|
| **app** | `<iframe sandbox="allow-scripts">` inside an OS window | yes | games, tools, mini-apps |
| **command** | main thread, invoked from the Terminal | no | shell utilities, automations |

Both share the same zip format and the same `ctx` API.

---

## Zip layout

```
mypackage.zip
├── manifest.json     ← required
├── index.js          ← required (entry module)
├── style.css         ← optional (apps only — auto-injected into the iframe)
└── assets/           ← optional (images, audio, json, …)
```

The zip **must** contain `manifest.json` and the entry module at its root (not nested in a folder). If you zip a folder on Windows, make sure you zip the *contents* of the folder, not the folder itself.

---

## `manifest.json`

```json
{
    "type": "app",
    "id": "snake-game",
    "name": "Snake",
    "icon": "🐍",
    "version": "1.0.0",
    "author": "Your Name",
    "entry": "index.js",
    "permissions": ["storage", "notifications"]
}
```

| Field | Required | Rules | Notes |
|---|---|---|---|
| `type` | ✅ | `"app"` \| `"command"` | |
| `id` | ✅ | `^[a-z0-9][a-z0-9_-]{1,40}$` | must be unique; reinstalling overwrites |
| `name` | ✅ | non-empty string | display name in Start menu / Terminal |
| `icon` | — | string | emoji or any single glyph |
| `version` | — | string | free-form (`"1.0.0"`, `"2025-01-beta"`, …) |
| `author` | — | string | free-form |
| `entry` | — | path inside zip | defaults to `index.js` |
| `permissions` | — | string[] | declared permissions — informative at install time, still gated at runtime |

Declared `permissions` are shown in the install modal so users know upfront what the package *might* ask for. It's not a grant — every capability is still prompted the first time it's actually used (iOS-style).

---

## Writing an **app**

ES module, default export an object with a `mount` function:

```js
export default {
    async mount(root, ctx) {
        // `root` is a <div> that fills the window — it's yours.
        root.innerHTML = `
            <style> h1 { color: gold; } </style>
            <h1>Hello, ${ctx.appId}!</h1>
            <button id="go">Save</button>
        `;

        root.querySelector('#go').addEventListener('click', async () => {
            await ctx.storage.set('clicked', Date.now());
            await ctx.toast('Saved!', 'success');
        });
    },

    unmount() {
        // Optional. Most apps don't need this — the whole iframe
        // is torn down when the window closes.
    }
};
```

### Sizing and layout

The host does **not** force a size on your app. You get an iframe filling the window — if the window is resized, your CSS (or `ResizeObserver`) must react. See `ExampleApps/snake` for a working pattern: the canvas listens on its container and snaps to a grid multiple.

### CSS

If your zip contains a top-level `style.css`, it's auto-injected into the iframe's `<head>`. For more files, import them yourself:

```js
async mount(root, ctx) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ctx.asset('styles/extra.css');
    document.head.appendChild(link);
}
```

### Assets

Use `ctx.asset(path)` to get a blob URL you can drop into `<img src>`, `<audio src>`, `fetch()`, etc.

```js
const img = new Image();
img.src = ctx.asset('assets/dragon.png');
root.appendChild(img);
```

---

## Writing a **command**

```js
export default {
    async run(args, ctx) {
        const name = args[0] || 'wanderer';
        await ctx.print('Hello, ' + name + '!');
        await ctx.toast('Greeted ' + name, 'success');
    }
};
```

- `args` is a string array, already tokenized (quoted strings are respected: `greet "Stefano Aruta"` → `args[0] === 'Stefano Aruta'`).
- Commands are invoked from the Terminal as `<id> [args...]`.
- `run()` can be async; the terminal waits for completion before showing the next prompt.
- Built-in command names (`help`, `clear`, `install`, …) take precedence and cannot be shadowed.

---

## Packaging & installing

### Create the zip

Zip **the contents** of your package folder, not the folder:

```bash
# inside mypackage/
zip -r ../mypackage.zip .
```

Windows PowerShell:

```powershell
Compress-Archive -Path .\mypackage\* -DestinationPath .\mypackage.zip
```

### Install

Three ways, all equivalent:

1. **Drag & drop** the `.zip` anywhere on the desktop.
2. **Terminal** → `install` → pick the file.
3. **Settings → 🔐 Permissions → Install package**.

All three trigger the install confirmation modal, which shows the manifest details and declared permissions.

Reinstalling an existing `id` replaces the package (update flow).

---

## Managing installed packages

- **Settings → 🔐 Permissions** — every installed app & command, with per-permission toggles and an uninstall button.
- **Terminal built-ins:**
    - `apps` — list installed apps
    - `commands` — list installed commands
    - `permissions <id>` — show an app's current grants
    - `uninstall <id>` — remove a package
- **Wipe Settings Only** (Settings → Reset) preserves packages & permissions.
- **Wipe All** erases everything, including packages.

---

## Debugging

- Errors during `mount()` are caught and shown in the app window as a red stack trace. The host also logs them to the browser console.
- `console.log` / `console.error` inside an app go to the main DevTools console (iframe shares the console).
- `ctx.storage` persists in a dedicated IndexedDB named `aruta_app_<id>` — you can inspect it in DevTools → Application → IndexedDB.

---

## Host-level behaviors apps can rely on

- The host respects `prefers-reduced-motion` (parallax, click spells, circle rotation turn off) and sets `.is-reduced-motion` on `<html>` so your own CSS can follow suit: `@media (prefers-reduced-motion: reduce) { … }` works inside your sandbox too.
- `<html>` also carries `.is-mobile` and `.is-touch` classes synced with the viewport / pointer type. Useful from inside your app when you want to match the host's layout decisions.
- Keyboard focus shows a consistent gold outline on all interactive elements. If you add buttons in your app, simply leaving `:focus-visible` to the browser default is fine — the host style cascade doesn't reach inside your sandboxed iframe, but the convention is worth matching for visual parity.

## Limitations

- Package files are stored as Blobs — very large packages (hundreds of MB) are possible but not recommended.
- Dynamic `import()` inside the iframe requires correct MIME types; the installer sets them when unpacking — you don't need to do anything special.
- You can't call host `window`/`document` directly from an app (it's a different origin). Use `ctx` for everything.
- Commands *do* run in the main thread and have access to global JS, but you should still use `ctx` — capabilities go through the permission gate there too.
