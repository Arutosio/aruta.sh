# aruta.sh — Documentation

Welcome to the docs. This folder covers everything beyond the top-level project intro.

## Contents

### User-facing
- [**Packages**](./packages.md) — how to write, package, and install apps & commands (the main plugin guide)
- [**`ctx` API reference**](./ctx-api.md) — every method available to your apps and commands
- [**Permissions**](./permissions.md) — what each permission unlocks and how the runtime prompt works
- [**Examples**](./examples.md) — walk-through of the bundled example packages
- [**Portable Profile**](./profile.md) — sync your settings, packages, and app data to a folder or `.zip`

### Contributor-facing
- [**Architecture**](./architecture.md) — how the package system is wired internally, with boot/runtime flow diagrams

---

## Bundled default packages

Auto-installed on first boot from `defaultPackages/` (uninstall sticks):

| App / command | Description |
|---|---|
| `rune` (cmd) | Draw an Elder Futhark rune with meaning |
| `weather` (cmd) | `weather <city>` via wttr.in |
| `timer` (app) | Countdown timer with toasts |
| `qr` (app) | QR code generator |
| `whoami` (cmd) | Print user/origin/agent info |
| `clip` (app) | Clipboard log |
| `oracle` (app + `fortune` cmd) | Themed oracle app; `fortune` CLI prints a random quote |
| `dice-roller` (app + `roll` cmd) | Visual dice roller app; `roll 2d6+3` CLI via dice notation |
| `grimoire` (app) | Folder-based notes/code editor — real folders via FS Access (Chromium) or virtual workspaces (any browser); zip export/import |
| `snake` (app) | Responsive Snake with wrap-around edges |
| `packagestore` (app + `pkg` cmd) | Package Manager app + apt-style `pkg` CLI |
| `filemanager` (app) | File Explorer — browse virtual workspace, linked profile folder, external folders, and installed package files; preview + "Open in Grimoire" handoff |

---

If something is missing or outdated, PRs welcome.
