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
    const manifestBlob = await fetchBlob(base + 'manifest.json');
    const manifestText = await manifestBlob.text();
    const manifest = JSON.parse(manifestText);

    const files = {};
    for (const f of pkg.files) {
        if (f === 'manifest.json') continue;
        files[f] = await fetchBlob(base + f);
    }
    await window.registry.saveManifest(manifest, files);
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

    for (const pkg of index.packages) {
        if (blacklist.has(pkg.id)) continue;
        if (window.registry.isInstalled(pkg.id)) continue;
        try { await installDefault(pkg); }
        catch (e) { console.warn('[defaults] failed to install', pkg.id, e); }
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
