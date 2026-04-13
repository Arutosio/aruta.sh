# aruta.sh

A desktop-OS-styled personal site with a full windowing system, themeable UI, a built-in terminal, and a **plugin system** that lets anyone install custom apps and terminal commands by dropping a `.zip` on the desktop.

Live site: **[aruta.sh](https://aruta.sh)**

---

## Features

- 🪟 Arcane-themed desktop OS — windows, taskbar, start menu, system info
- 🌓 Dark/light themes, accent colors, i18n (IT, EN, ES, JA, Elder Futhark runes)
- ⌨️ Built-in Terminal with history and colored output
- 📦 **Plugin packages** — drag-and-drop `.zip` install for apps (windowed) and commands (terminal)
- 🔐 iOS-style runtime permissions, revocable per app
- 💾 Full persistence — preferences in localStorage, packages & app data in IndexedDB

---

## Writing your own app or command

Everything you need is in [**`docs/`**](./docs):

- [**Packages**](./docs/packages.md) — authoring guide (`.zip` layout, manifest, entry modules)
- [**`ctx` API reference**](./docs/ctx-api.md) — every method available to your package
- [**Permissions**](./docs/permissions.md) — what each permission unlocks
- [**Examples**](./docs/examples.md) — bundled example packages you can install right away
- [**Architecture**](./docs/architecture.md) — how the package system is wired internally

**Minimal command package** (`mypackage.zip` containing `manifest.json` + `index.js`):

```json
{ "type": "command", "id": "hi", "name": "Hi", "entry": "index.js",
  "permissions": ["terminal"] }
```
```js
export default {
    async run(args, ctx) { await ctx.print('Hello, ' + (args[0] || 'world') + '!'); }
};
```

Drag the zip onto the desktop, confirm the install, then in the Terminal: `hi Aruta`.

Full walkthrough and a windowed-app example (with canvas, storage, notifications): see [`docs/packages.md`](./docs/packages.md) and [`ExampleApps/`](./ExampleApps).

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
ExampleApps/      working example packages (sources + prebuilt zips)
docs/             full documentation (start here → docs/README.md)
```

---

## License

See [LICENSE](./LICENSE).
