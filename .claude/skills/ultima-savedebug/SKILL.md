---
name: ultima-savedebug
description: Inspect, validate, or repair Ultima Aruta save state (STATE_KEY, worlds, inventory, equipment, world deltas) stored in browser IndexedDB. Use when debugging corrupt save, lost progress, world generation desync, inventory drift, or before shipping save-format changes.
---

# Ultima Aruta — Save State Debug

Save state lives in IndexedDB under the sandboxed app DB `aruta_app_ultima-aruta` (key store via host SDK). Keys actively used:

| Key | Shape | Owner |
|-----|-------|-------|
| `worlds` | `[{id, name, seed, lastPlayed, playerClass, level, kills}]` | World registry |
| `STATE_KEY` (per world) | `{seed, px, py, timeOfDay, playerClass, hp, mana, stamina, level, xp, xpNext, maxHp, maxMana, maxStamina, baseDmg, kills, days}` | Player progression |
| `INV_KEY` | inventory array | Player items |
| `EQUIP_KEY` | equipment slots map | Player gear |
| `DELTA_KEY` | chunk delta map | World-edit persistence |

`STATE_KEY`/`INV_KEY`/`EQUIP_KEY`/`DELTA_KEY` are world-scoped (constants built per world id — verify in `defaultPackages/ultima-aruta/index.js`).

## Quick browser-console probes

Paste in DevTools console of `aruta.sh` (host page, NOT iframe). Adjust `appId` if needed.

### Dump everything

```js
const dbName = 'aruta_app_ultima-aruta';
indexedDB.open(dbName).onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction(db.objectStoreNames, 'readonly');
  const store = tx.objectStore(db.objectStoreNames[0]);
  store.getAllKeys().onsuccess = (kEv) => {
    const keys = kEv.target.result;
    const out = {};
    let pending = keys.length;
    if (!pending) return console.log('empty');
    keys.forEach(k => store.get(k).onsuccess = (vEv) => {
      out[k] = vEv.target.result;
      if (--pending === 0) console.log(JSON.stringify(out, null, 2));
    });
  };
};
```

### Wipe a single world without nuking the rest

```js
const targetId = 'world-XXXXX'; // pick from worlds list
const dbName = 'aruta_app_ultima-aruta';
indexedDB.open(dbName).onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction(db.objectStoreNames, 'readwrite');
  const store = tx.objectStore(db.objectStoreNames[0]);
  ['state', 'inventory', 'equipment', 'world_deltas'].forEach(suffix =>
    store.delete(`${targetId}:${suffix}`)
  );
  tx.oncomplete = () => console.log('wiped', targetId);
};
```

### Force-heal player (stuck at 0 hp soft-lock)

```js
indexedDB.open('aruta_app_ultima-aruta').onsuccess = (e) => {
  const db = e.target.result;
  const tx = db.transaction(db.objectStoreNames, 'readwrite');
  const store = tx.objectStore(db.objectStoreNames[0]);
  store.get('state-of-target-world').onsuccess = (g) => {
    const s = g.target.result;
    s.hp = s.maxHp; s.mana = s.maxMana; s.stamina = s.maxStamina;
    store.put(s, 'state-of-target-world');
  };
};
```

## Schema validation checklist

Before shipping a save-format migration, verify:

- [ ] `seed` is a number (not string) — chunk gen depends on it
- [ ] `px`/`py` are integers within world bounds
- [ ] `level >= 1`, `xp >= 0`, `xpNext > xp`
- [ ] `hp <= maxHp`, `mana <= maxMana`, `stamina <= maxStamina`
- [ ] `kills >= 0`, `days >= 0`
- [ ] `playerClass` matches a known class id in `data.js`
- [ ] World deltas: each chunk key `(cx,cy)` has tile mutations within `CHUNK_SIZE` bounds

## Migration pattern

When changing `STATE_KEY` shape:

1. Bump `STATE_VERSION` constant in `defaultPackages/ultima-aruta/index.js`
2. On load, check stored `version` — if missing or older, run migrator before using fields
3. Re-save with new version on next autosave (line ~2325)
4. Document migration in commit body so users know about reset risk

## When to re-roll vs migrate

- **Compatible add** (new optional field): migrate, default to safe value
- **Rename** (`speed` → `moveSpeed`): migrate, copy old → new, delete old
- **Breaking** (chunk format change): bump major, force re-roll affected worlds, warn user before wipe

## Common bug signatures

| Symptom | Likely cause |
|---------|--------------|
| Player spawns at (0,0) on reload | `px`/`py` save race — check `await` on `sdk.storage.set(STATE_KEY, ...)` |
| Inventory items duplicate | Listener attached twice, no `unmount()` cleanup |
| World looks different on reload | `seed` saved as string, gen function reading as number → NaN seed |
| Chunk shows mountains where water should be | DELTA_KEY mutation written under wrong `(cx,cy)` key |
| Stuck "loading..." | Storage promise rejected silently — check console.warn from save catches |
