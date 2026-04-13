# Example Packages

The [`ExampleApps/`](../ExampleApps) folder at the repo root contains two working packages with their raw sources and prebuilt zips.

---

## `greet` — a terminal command

A tiny command that prints a decorated greeting and fires a success toast. Good starting point for a command package — shows tokenized args, multi-line output, cross-permission use.

**Source**: [`ExampleApps/greet/`](../ExampleApps/greet)
**Zip**: [`ExampleApps/greet.zip`](../ExampleApps/greet.zip)

**manifest.json**
```json
{
    "type": "command",
    "id": "greet",
    "name": "Greet",
    "icon": "✨",
    "version": "1.0.0",
    "author": "Aruta",
    "entry": "index.js",
    "permissions": ["terminal", "notifications"]
}
```

**Usage**: after installing, open the Terminal and run:
```
greet Aruta
greet "Stefano Aruta"
```

---

## `snake` — an app with canvas, storage, notifications

Responsive Snake: arrow keys / WASD / on-screen D-pad / swipe, high score persisted per-app, game-over toast. Shows how to:

- Keep a canvas-based app responsive with `ResizeObserver`
- Persist state with `ctx.storage`
- Fire `ctx.toast` on lifecycle events
- Ship a `style.css` alongside `index.js`

**Source**: [`ExampleApps/snake/`](../ExampleApps/snake)
**Zip**: [`ExampleApps/snake.zip`](../ExampleApps/snake.zip)

**manifest.json**
```json
{
    "type": "app",
    "id": "snake",
    "name": "Arcane Snake",
    "icon": "🐍",
    "version": "1.0.0",
    "author": "Aruta",
    "entry": "index.js",
    "permissions": ["storage", "notifications"]
}
```

**Install flow**: drop `snake.zip` on the desktop → confirm → 🐍 appears in the Start menu → open it. First time you eat food and beat your high score, the storage permission prompt appears.

---

## Rolling your own zip

```bash
# macOS / Linux
cd mypackage
zip -r ../mypackage.zip .

# Windows (PowerShell)
Compress-Archive -Path .\mypackage\* -DestinationPath .\mypackage.zip -Force
```

Zip the *contents* of the folder — the zip must contain `manifest.json` at its root, not nested one level deep.

---

## Ideas for your first package

- **Clipboard log** (command) — `cblog` reads clipboard on each call and appends a timestamped line to `ctx.storage`
- **Pomodoro** (app) — simple 25/5 timer with toasts on phase change
- **Weather** (command) — `weather <city>` → `ctx.fetch('https://wttr.in/...')` → `ctx.print()`
- **Markdown preview** (app) — paste markdown, render with a tiny markdown-it bundle you ship in the zip
- **Random D&D character** (command) — rolls stats, prints a formatted sheet
