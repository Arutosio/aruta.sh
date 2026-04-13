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
    // Fetch every file (including manifest) in parallel. The manifest is tiny JSON;
    // the others are JS/CSS blobs. This collapses ~3 round-trips per package into 1.
    const entries = await Promise.all(
        pkg.files.map(async f => [f, await fetchBlob(base + f)])
    );
    const map = Object.fromEntries(entries);
    const manifest = JSON.parse(await map['manifest.json'].text());
    delete map['manifest.json'];
    await window.registry.saveManifest(manifest, map);
    // Default (system) packages ship trusted — auto-grant every permission
    // the manifest declares, so the user doesn't see a stream of prompts on
    // first use. The user can still revoke from Settings → Permissions.
    if (Array.isArray(manifest.permissions) && manifest.permissions.length) {
        const grants = {};
        for (const p of manifest.permissions) grants[p] = 'granted';
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
        if (window.registry.isInstalled(pkg.id)) continue;
        pending.push(
            installDefault(pkg).catch(e => console.warn('[defaults] failed to install', pkg.id, e))
        );
    }
    await Promise.all(pending);
}

function markUninstalled(id) {
    const seen = new Set(readList(SEEN_KEY));
    if (!seen.has(id)) return;
    const bl = new Set(readList(BLACKLIST_KEY));
    bl.add(id);
    writeList(BLACKLIST_KEY, Array.from(bl));
}

window.defaults = { bootstrap: bootstrapDefaults, markUninstalled };
