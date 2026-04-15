/* ╔══════════════════════════════════════════════════════════╗
 * ║  DEFAULTS — auto-install the bundled default packages     ║
 * ║  Fetches defaultPackages/defaults.json and installs each  ║
 * ║  package on first boot. Respects a blacklist so the user  ║
 * ║  can uninstall them permanently.                          ║
 * ╚══════════════════════════════════════════════════════════╝ */

const DEFAULTS_URL = 'defaultPackages/defaults.json';
const SEEN_KEY = 'aruta_defaults_seen';
const BLACKLIST_KEY = 'aruta_defaults_uninstalled';

function readList(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeList(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
}

const MIME = {
    js: 'text/javascript', json: 'application/json', css: 'text/css',
    html: 'text/html', svg: 'image/svg+xml', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', wav: 'audio/wav',
    mp3: 'audio/mpeg', txt: 'text/plain',
};

async function fetchBlob(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('fetch ' + path + ' → ' + r.status);
    const blob = await r.blob();
    const ext = path.split('.').pop().toLowerCase();
    const mime = MIME[ext] || blob.type || 'application/octet-stream';
    return blob.type === mime ? blob : new Blob([blob], { type: mime });
}

async function installDefault(pkg) {
    const base = 'defaultPackages/' + pkg.id + '/';
    // Fetch the manifest first (small), so we can short-circuit when the
    // bundled version matches what's already installed — avoids pulling
    // all the JS/CSS on every boot.
    const manifestBlob = await fetchBlob(base + 'manifest.json');
    const manifest = JSON.parse(await manifestBlob.text());
    const installed = window.registry.getManifest(pkg.id);
    if (installed && installed.version === manifest.version) return null;

    // Install / update. Fetch remaining files in parallel.
    const others = pkg.files.filter(f => f !== 'manifest.json');
    const entries = await Promise.all(
        others.map(async f => [f, await fetchBlob(base + f)])
    );
    const map = Object.fromEntries(entries);
    // Tag manifest so UI (Package Store "Installed" view) can tell default
    // / bundled packages apart from user-installed ones.
    manifest._origin = 'default';
    await window.registry.saveManifest(manifest, map);
    // Default (system) packages ship trusted — auto-grant every permission
    // the manifest declares, so the user doesn't see a stream of prompts on
    // first use. Existing grants are preserved; only missing ones are set.
    if (Array.isArray(manifest.permissions) && manifest.permissions.length) {
        const grants = window.storage.get('aruta_perms_' + manifest.id, {}) || {};
        for (const p of manifest.permissions) {
            if (!(p in grants)) grants[p] = 'granted';
        }
        window.storage.set('aruta_perms_' + manifest.id, grants);
    }
    return manifest;
}

async function bootstrapDefaults() {
    if (!window.registry) return;
    let index;
    try {
        const r = await fetch(DEFAULTS_URL, { cache: 'no-cache' });
        if (!r.ok) return;
        index = await r.json();
    } catch {
        return; // offline or missing — skip silently
    }
    if (!index || !Array.isArray(index.packages)) return;

    const seen = new Set(readList(SEEN_KEY));
    const blacklist = new Set(readList(BLACKLIST_KEY));

    // Keep the seen list up to date even for packages the user has blacklisted.
    for (const pkg of index.packages) {
        seen.add(pkg.id);
    }
    writeList(SEEN_KEY, Array.from(seen));

    // Install packages in parallel. Each installDefault awaits one IndexedDB
    // write which is fast; the network fetches are also parallel within each,
    // turning a ~25-request serial chain into a single burst.
    const pending = [];
    for (const pkg of index.packages) {
        if (blacklist.has(pkg.id)) continue;
        // installDefault short-circuits when the bundled version matches
        // the installed one, so it's safe to call unconditionally — and
        // it's how default packages receive updates across site releases.
        pending.push(
            installDefault(pkg).catch(e => console.warn('[defaults] failed to install', pkg.id, e))
        );
    }
    await Promise.all(pending);

    // Prune orphaned default packages: any installed manifest still tagged
    // _origin:'default' whose id no longer appears in defaults.json (and that
    // the user hasn't explicitly blacklisted) is a stale bundled package from
    // a previous site release — remove it now that fresh defaults are in.
    // User-reinstalled packages (_origin:'user') are untouched.
    const currentIds = new Set(index.packages.map(p => p.id));
    try {
        const installed = window.registry.list();
        for (const m of installed) {
            if (m._origin !== 'default') continue;
            if (currentIds.has(m.id)) continue;
            if (blacklist.has(m.id)) continue;
            try {
                await window.registry.uninstall(m.id);
                console.info('[defaults] pruned orphan default:', m.id);
            } catch (e) {
                console.warn('[defaults] prune failed for', m.id, e);
            }
        }
    } catch (e) {
        console.warn('[defaults] prune scan failed', e);
    }
}

function markUninstalled(id) {
    const seen = new Set(readList(SEEN_KEY));
    if (!seen.has(id)) return;
    const bl = new Set(readList(BLACKLIST_KEY));
    bl.add(id);
    writeList(BLACKLIST_KEY, Array.from(bl));
}

window.defaults = { bootstrap: bootstrapDefaults, markUninstalled };
