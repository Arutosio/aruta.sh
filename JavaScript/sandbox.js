/* ╔══════════════════════════════════════════════════════════╗
 * ║  SANDBOX — Iframe host for apps + executor for commands   ║
 * ║  Bridges ctx API across postMessage with permission gate  ║
 * ╚══════════════════════════════════════════════════════════╝ */

/** Host-side SDK version. The ctx contract surface. Bump this only on a
 *  breaking change to `ctx.*` / init-payload shape. Apps may declare a
 *  minimum `sdk` in their manifest to opt into a newer contract. */
const SDK_VERSION = 1;

const _mounted = new Map(); // appId -> { iframe, channel }

/**
 * Push a theme change to every mounted app iframe. The in-iframe bootstrap
 * listens for `{type:'theme', value}` messages and updates the iframe's
 * root `data-theme` attribute so CSS vars recompute automatically.
 */
function broadcastTheme(v) {
    for (const m of _mounted.values()) {
        try { m.iframe.contentWindow?.postMessage({ __aruta_sdk: true, type: 'theme', value: v }, '*'); } catch (_) {}
    }
}

// Per-app KV is implemented in storage.js (window.Storage.appKV). These thin
// wrappers route the host-side `ctx.storage.*` calls through the facade so
// the DB name (`aruta_app_<id>`) lives in exactly one place.
async function _appStorageGet(appId, key)         { return window.Storage.appKV.get(appId, key); }
async function _appStorageSet(appId, key, value)  { return window.Storage.appKV.set(appId, key, value); }
async function _appStorageRemove(appId, key)      { return window.Storage.appKV.remove(appId, key); }

const PERM_REQUIRED = {
    print: 'terminal',
    clear: 'terminal',
    toast: 'notifications',
    openWindow: 'windows',
    closeWindow: 'windows',
    'storage.get': 'storage',
    'storage.set': 'storage',
    'storage.remove': 'storage',
    fetch: 'fetch',
    'theme.get': 'theme',
    'theme.set': 'theme',
    'clipboard.read': 'clipboard',
    'clipboard.write': 'clipboard',
    installZip: 'install',
    listInstalled: 'install',
    uninstall: 'install',
};

async function _handleCall(appId, method, args) {
    const perm = PERM_REQUIRED[method];
    if (perm) {
        const ok = await window.permissions.request(appId, perm);
        if (!ok) throw new Error('permission_denied:' + perm);
    }
    switch (method) {
        case 'print': window.terminal?.print(String(args[0] ?? '')); return true;
        case 'clear': window.terminal?.clear(); return true;
        case 'toast': window.showToast?.(String(args[0] ?? ''), args[1] || 'info'); return true;
        case 'openWindow': window.openWindow?.(String(args[0])); return true;
        case 'closeWindow': window.closeWindow?.(String(args[0])); return true;
        case 'storage.get': return await _appStorageGet(appId, args[0]);
        case 'storage.set': return await _appStorageSet(appId, args[0], args[1]);
        case 'storage.remove': return await _appStorageRemove(appId, args[0]);
        case 'fetch': {
            const opts = args[1] || {};
            const binary = opts && opts.binary;
            // Strip our custom flag before passing through to fetch — browsers
            // treat unknown init fields as no-ops but this keeps it clean.
            const init = { ...opts }; delete init.binary;
            const r = await fetch(args[0], init);
            if (binary) {
                const blob = await r.blob();
                return { ok: r.ok, status: r.status, statusText: r.statusText, blob };
            }
            const text = await r.text();
            return { ok: r.ok, status: r.status, statusText: r.statusText, body: text };
        }
        case 'theme.get': return window.currentTheme || document.documentElement.dataset.theme;
        case 'theme.set':
            if (args[0] !== window.currentTheme && typeof toggleTheme === 'function') toggleTheme();
            return true;
        case 'clipboard.read': return await navigator.clipboard.readText();
        case 'clipboard.write': await navigator.clipboard.writeText(String(args[0] ?? '')); return true;
        case 'installZip': {
            // Accept a Blob (postMessage structured-clones Blobs across frames)
            // and hand it to the existing installer pipeline. The installer
            // still shows the install-confirm modal — we do NOT bypass it.
            const blob = args[0];
            if (!blob) throw new Error('installZip: missing blob');
            const file = (typeof File !== 'undefined' && blob instanceof File)
                ? blob
                : new File([blob], (args[1] && args[1].filename) || 'remote.zip', { type: blob.type || 'application/zip' });
            const m = await window.installer.installFromFile(file);
            if (!m) return null; // user cancelled
            return { id: m.id, name: m.name, version: m.version, type: m.type };
        }
        case 'uninstall': {
            const targetId = String(args[0] || '');
            if (!targetId) throw new Error('uninstall: missing id');
            // Guard against an app uninstalling itself mid-call (would yank its
            // own iframe out while we're still waiting on the reply).
            if (targetId === appId) throw new Error('uninstall: refusing to self-uninstall');
            if (!window.registry?.isInstalled(targetId)) return false;
            await window.registry.uninstall(targetId);
            try { localStorage.removeItem('aruta_perms_' + targetId); } catch {}
            return true;
        }
        case 'listInstalled': {
            const all = window.registry?.list() || [];
            return all.map(m => ({ id: m.id, name: m.name, version: m.version || null, type: m.type }));
        }
        case 'i18n': return (window.i18n?.[window.currentLang] || {})[args[0]] || args[0];
        default: throw new Error('unknown_method:' + method);
    }
}

const IFRAME_BOOT = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;color:inherit;font-family:Inter,system-ui,sans-serif;}
#root{width:100%;height:100%;overflow:auto;}
</style></head><body><div id="root"></div><script>
(function(){
    const root = document.getElementById('root');
    const pending = new Map();
    let nextId = 1;
    function call(method, ...args) {
        return new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            parent.postMessage({ __aruta_sdk: true, type: 'call', id, method, args }, '*');
        });
    }
    window.addEventListener('message', async (e) => {
        const d = e.data;
        if (!d || !d.__aruta_sdk) return;
        if (d.type === 'reply') {
            const p = pending.get(d.id);
            if (!p) return;
            pending.delete(d.id);
            if (d.error) p.reject(new Error(d.error));
            else p.resolve(d.value);
        } else if (d.type === 'theme') {
            if (d.value) document.documentElement.dataset.theme = d.value;
        } else if (d.type === 'init') {
            try {
                const fileURLs = {};
                for (const [path, blob] of Object.entries(d.files)) {
                    fileURLs[path] = URL.createObjectURL(blob);
                }
                const ctx = {
                    appId: d.manifest.id,
                    sdkVersion: d.sdkVersion || 1,
                    asset: (p) => fileURLs[p] || fileURLs['assets/' + p] || null,
                    print: (s) => call('print', s),
                    clear: () => call('clear'),
                    toast: (m, t) => call('toast', m, t),
                    openWindow: (id) => call('openWindow', id),
                    closeWindow: (id) => call('closeWindow', id),
                    storage: {
                        get: (k) => call('storage.get', k),
                        set: (k, v) => call('storage.set', k, v),
                        remove: (k) => call('storage.remove', k),
                    },
                    fetch: async (url, opts) => {
                        const r = await call('fetch', url, opts);
                        return {
                            ok: r.ok, status: r.status, statusText: r.statusText,
                            text: async () => r.body,
                            json: async () => JSON.parse(r.body),
                            blob: async () => r.blob || new Blob([r.body || ''], { type: 'application/octet-stream' }),
                            arrayBuffer: async () => {
                                if (r.blob) return await r.blob.arrayBuffer();
                                return new TextEncoder().encode(r.body || '').buffer;
                            },
                        };
                    },
                    theme: { get: () => call('theme.get'), set: (t) => call('theme.set', t) },
                    clipboard: { read: () => call('clipboard.read'), write: (s) => call('clipboard.write', s) },
                    i18n: (k) => call('i18n', k),
                    installZip: (blob, opts) => call('installZip', blob, opts),
                    listInstalled: () => call('listInstalled'),
                    uninstall: (id) => call('uninstall', id),
                    permission: { request: (p) => call('permission.request', p) },
                };
                // sync theme from host before user CSS loads so the first paint
                // already matches light/dark instead of flashing the CSS default.
                // Theme is sent in the init payload (no permission prompt).
                if (d.theme) document.documentElement.dataset.theme = d.theme;
                // inject style.css if present
                if (fileURLs['style.css']) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = fileURLs['style.css'];
                    document.head.appendChild(link);
                }
                const entryPath = d.manifest.entry || 'index.js';
                const mod = await import(fileURLs[entryPath]);
                const exp = mod.default || mod;
                if (typeof exp.mount === 'function') await exp.mount(root, ctx);
                parent.postMessage({ __aruta_sdk: true, type: 'mounted' }, '*');
            } catch (err) {
                root.innerHTML = '<pre style="color:#fb7185;padding:1rem;white-space:pre-wrap;">' + (err.stack || err.message || err) + '</pre>';
                parent.postMessage({ __aruta_sdk: true, type: 'error', error: String(err) }, '*');
            }
        }
    });
    parent.postMessage({ __aruta_sdk: true, type: 'ready' }, '*');
})();
<\/script></body></html>`;

async function mountApp(appId) {
    const manifest = window.registry.getManifest(appId);
    if (!manifest || manifest.type !== 'app') return false;

    // SDK version gate: warn, don't block. Packages that absolutely need a
    // newer host feature can branch on `ctx.sdkVersion` inside their code.
    const requestedSDK = Number(manifest.sdk) || 1;
    if (requestedSDK > SDK_VERSION) {
        console.warn('[sandbox] ' + appId + ' requires SDK v' + requestedSDK + ', host is v' + SDK_VERSION);
    }

    const win = document.getElementById('win-' + appId);
    if (!win) return false;
    const content = win.querySelector('.custom-app-content');
    if (!content) return false;

    if (_mounted.has(appId)) return true;

    const files = await window.registry.getFiles(appId);

    content.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'sandbox-iframe';
    // Packages can opt into same-origin by declaring `allowOrigin: true` in
    // their manifest. This breaks the opaque-origin sandbox boundary (the
    // iframe can then reach window.parent and shares storage origin) but is
    // required for a handful of browser APIs — notably the File System
    // Access API (showDirectoryPicker) — which refuse to run in a null-
    // origin frame. Trust is on the user: the install modal shows the flag.
    // allow-modals lets apps use prompt()/alert()/confirm(). Without it these
    // silently return null in sandboxed iframes (Firefox/Chrome both block).
    const sandboxAttr = manifest.allowOrigin
        ? 'allow-scripts allow-same-origin allow-modals'
        : 'allow-scripts allow-modals';
    iframe.setAttribute('sandbox', sandboxAttr);
    console.debug('[sandbox] mounted', appId, 'with sandbox=', sandboxAttr);
    iframe.style.cssText = 'width:100%;height:100%;border:0;background:transparent;';
    iframe.srcdoc = IFRAME_BOOT;
    content.appendChild(iframe);

    const onMsg = async (e) => {
        if (e.source !== iframe.contentWindow) return;
        const d = e.data;
        if (!d || !d.__aruta_sdk) return;
        if (d.type === 'ready') {
            const theme = window.currentTheme || document.documentElement.dataset.theme || 'dark';
            iframe.contentWindow.postMessage({ __aruta_sdk: true, type: 'init', manifest, files, theme, sdkVersion: SDK_VERSION }, '*');
        } else if (d.type === 'call') {
            try {
                const value = await _handleCall(appId, d.method, d.args || []);
                iframe.contentWindow.postMessage({ __aruta_sdk: true, type: 'reply', id: d.id, value }, '*');
            } catch (err) {
                iframe.contentWindow.postMessage({ __aruta_sdk: true, type: 'reply', id: d.id, error: String(err.message || err) }, '*');
            }
        } else if (d.type === 'error') {
            console.warn('[sandbox]', appId, d.error);
        }
    };
    window.addEventListener('message', onMsg);
    _mounted.set(appId, { iframe, onMsg });
    return true;
}

function unmountApp(appId) {
    const m = _mounted.get(appId);
    if (!m) return;
    window.removeEventListener('message', m.onMsg);
    m.iframe.remove();
    _mounted.delete(appId);
}

async function runCommand(commandId, args) {
    const manifest = window.registry.getManifest(commandId);
    if (!manifest || manifest.type !== 'command') throw new Error('not_a_command');
    const files = await window.registry.getFiles(commandId);
    const entry = files[manifest.entry || 'index.js'];
    if (!entry) throw new Error('entry_missing');

    const entryURL = URL.createObjectURL(entry);
    const { ctx, cleanup } = _buildHostCtx(commandId, files);
    try {
        const mod = await import(/* @vite-ignore */ entryURL);
        const exp = mod.default || mod;
        if (typeof exp.run === 'function') return await exp.run(args, ctx);
        throw new Error('command_missing_run');
    } finally {
        setTimeout(() => { URL.revokeObjectURL(entryURL); cleanup(); }, 1000);
    }
}

function _buildHostCtx(appId, files) {
    const fileURLs = {};
    for (const [p, b] of Object.entries(files || {})) fileURLs[p] = URL.createObjectURL(b);
    const cleanup = () => { for (const u of Object.values(fileURLs)) URL.revokeObjectURL(u); };
    const ctx = {
        appId,
        asset: (p) => fileURLs[p] || fileURLs['assets/' + p] || null,
        print: async (s) => { if (await window.permissions.request(appId, 'terminal')) window.terminal?.print(String(s ?? '')); },
        clear: async () => { if (await window.permissions.request(appId, 'terminal')) window.terminal?.clear(); },
        toast: async (m, t) => { if (await window.permissions.request(appId, 'notifications')) window.showToast?.(String(m ?? ''), t || 'info'); },
        openWindow: async (id) => { if (await window.permissions.request(appId, 'windows')) window.openWindow?.(id); },
        closeWindow: async (id) => { if (await window.permissions.request(appId, 'windows')) window.closeWindow?.(id); },
        storage: {
            get: async (k) => (await window.permissions.request(appId, 'storage')) ? _appStorageGet(appId, k) : null,
            set: async (k, v) => (await window.permissions.request(appId, 'storage')) ? _appStorageSet(appId, k, v) : false,
            remove: async (k) => (await window.permissions.request(appId, 'storage')) ? _appStorageRemove(appId, k) : false,
        },
        fetch: async (url, opts) => {
            if (!(await window.permissions.request(appId, 'fetch'))) throw new Error('permission_denied:fetch');
            return fetch(url, opts);
        },
        theme: {
            get: async () => (await window.permissions.request(appId, 'theme')) ? (window.currentTheme || document.documentElement.dataset.theme) : null,
            set: async (t) => { if (await window.permissions.request(appId, 'theme')) { if (t !== window.currentTheme) toggleTheme(); } },
        },
        clipboard: {
            read: async () => (await window.permissions.request(appId, 'clipboard')) ? navigator.clipboard.readText() : null,
            write: async (s) => (await window.permissions.request(appId, 'clipboard')) ? navigator.clipboard.writeText(String(s ?? '')) : false,
        },
        i18n: (k) => (window.i18n?.[window.currentLang] || {})[k] || k,
        permission: { request: (p) => window.permissions.request(appId, p) },
    };
    return { ctx, cleanup };
}

async function closeAppStorage(appId) {
    await window.db.closeDB((window.Storage?.constants.APP_DB_PREFIX || 'aruta_app_') + appId);
}

window.sandbox = { mount: mountApp, unmount: unmountApp, runCommand, closeAppStorage, broadcastTheme };
