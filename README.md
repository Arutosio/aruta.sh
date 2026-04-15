# aruta.sh

A desktop-OS-styled personal site with a full windowing system, themeable UI, a built-in terminal, and a **plugin system** that lets anyone install custom apps and terminal commands by dropping a `.zip` on the desktop.

Live site: **[aruta.sh](https://aruta.sh)**

---

## Features

- 🪟 Arcane-themed desktop OS — windows (drag, maximize, **resize from any edge or corner**), taskbar, start menu, system info
- 🌓 Dark/light themes (defaults to **follow OS**, propagated live to every app iframe), accent colors, i18n (IT, EN, ES, JA, Elder Futhark runes)
- ⌨️ Built-in Terminal with history and colored output
- 📦 **Plugin packages** — drag-and-drop `.zip` install for apps (windowed), commands (terminal), or **hybrids** that ship both at once. Bundled defaults include 📦 Package Manager (`pkg` CLI, browse + install from remote repos), 🎲 Dice Roller (`roll` CLI), 🔮 Oracle (`fortune` CLI), 🐍 Snake, 📜 Grimoire (folder-based notes/code editor), Timer, QR, and more
- 🔐 iOS-style runtime permissions, revocable per app
- 💾 Full persistence — preferences in localStorage, packages & app data in IndexedDB
- 🗂️ **Portable Profile** — link a folder for live disk sync (Chromium) or export/import a `.zip` (any browser). [docs/profile.md](./docs/profile.md)

---

## Writing your own app or command

Everything you need is in [**`docs/`**](./docs):

- [**Packages**](./docs/packages.md) — authoring guide (`.zip` layout, manifest, entry modules)
- [**`ctx` API reference**](./docs/ctx-api.md) — every method available to your package
- [**Permissions**](./docs/permissions.md) — what each permission unlocks
- [**Examples**](./docs/examples.md) — bundled example packages you can install right away
- [**Portable Profile**](./docs/profile.md) — folder sync + zip export/import of your whole OS state
- [**Architecture**](./docs/architecture.md) — how the package system is wired internally (with boot/runtime diagrams)

Start at [`docs/README.md`](./docs/README.md) for the full index (incl. the bundled default-packages list).

**Minimal command package** (`mypackage.zip` containing `manifest.json` + `index.js`):

```json
{ "roles": ["command"], "id": "hi", "name": "Hi", "entry": "index.js",
  "permissions": ["terminal"] }
```

(Legacy `"type": "command"` / `"type": "app"` manifests still install — they're auto-normalized to `roles` at boot.)
```js
export default {
    async run(args, ctx) { await ctx.print('Hello, ' + (args[0] || 'world') + '!'); }
};
```

Drag the zip onto the desktop, confirm the install, then in the Terminal: `hi Aruta`.

Full walkthrough and a windowed-app example (with canvas, storage, notifications): see [`docs/packages.md`](./docs/packages.md) and [`packages/`](./packages). The `packages/` folder doubles as a live Package Store repo — enable the `Aruta.sh Examples` repo in the Package Store (URL: `https://raw.githubusercontent.com/Arutosio/aruta.sh/master/packages/index.json`) to install them from inside the OS.

---

## Local development

Static site, no build step. Open `index.html` directly or serve the folder:

```bash
npx serve .
# or
python -m http.server 8000
```

---

## Project layout

```
JavaScript/       boot sequence, OS, packages, terminal, effects
Style/            CSS (main.css bundles the rest + terminal.css for plugins)
packages/         working example packages (sources + prebuilt zips + index.json repo manifest)
docs/             full documentation (start here → docs/README.md)
```

---

## License

See [LICENSE](./LICENSE).
