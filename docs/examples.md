# Example Packages

The [`packages/`](../packages) folder at the repo root contains working packages with their raw sources, prebuilt zips, and an `index.json` that doubles as a live Package Store repo.

To install them from inside the OS, open the Package Store → add / enable the repo:

```
https://raw.githubusercontent.com/Arutosio/aruta.sh/master/packages/index.json
```

(The `Aruta.sh Examples` repo is also seeded in the Package Store but disabled by default — flip it on.)

---

## `greet` — a terminal command

A tiny command that prints a decorated greeting and fires a success toast. Good starting point for a command package — shows tokenized args, multi-line output, cross-permission use.

**Source**: [`packages/greet/`](../packages/greet)
**Zip**: [`packages/greet.zip`](../packages/greet.zip)

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

## `arcane-snake` — an app with canvas, storage, notifications

Responsive Snake: arrow keys / WASD / on-screen D-pad / swipe, high score persisted per-app, game-over toast. Shows how to:

- Keep a canvas-based app responsive with `ResizeObserver`
- Persist state with `ctx.storage`
- Fire `ctx.toast` on lifecycle events
- Ship a `style.css` alongside `index.js`

The id is `arcane-snake` (not `snake`) so it doesn't collide with the bundled default Snake app at `defaultPackages/snake/`.

**Source**: [`packages/arcane-snake/`](../packages/arcane-snake)
**Zip**: [`packages/arcane-snake.zip`](../packages/arcane-snake.zip)

**manifest.json**
```json
{
    "type": "app",
    "id": "arcane-snake",
    "name": "Arcane Snake",
    "icon": "🐍",
    "version": "1.0.1",
    "author": "Aruta",
    "entry": "index.js",
    "category": "games",
    "permissions": ["storage", "notifications"]
}
```

**Install flow**: drop `arcane-snake.zip` on the desktop → confirm → 🐍 appears in the Start menu → open it. First time you eat food and beat your high score, the storage permission prompt appears.

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
