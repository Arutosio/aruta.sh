/* ╔══════════════════════════════════════════════════════════╗
 * ║  SANDBOX — Iframe host for apps + executor for commands   ║
 * ║  Bridges ctx API across postMessage with permission gate  ║
 * ╚══════════════════════════════════════════════════════════╝ */

const _mounted = new Map(); // appId -> { iframe, channel }

const _appDBCache = new Map();
function _appStorageDB(appId) {
    let p = _appDBCache.get(appId);
    if (p) return p;
    p = new Promise((resolve, reject) => {
        const req = indexedDB.open('aruta_app_' + appId, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { _appDBCache.delete(appId); reject(req.error); };
    });
    _appDBCache.set(appId, p);
    return p;
}

async function _appStorageGet(appId, key) {
    const db = await _appStorageDB(appId);
    return new Promise((res, rej) => {
        const t = db.transaction('kv', 'readonly');
        const r = t.objectStore('kv').get(key);
        r.onsuccess = () => res(r.result === undefined ? null : r.result);
        r.onerror = () => rej(r.error);
    });
}
async function _appStorageSet(appId, key, value) {
    const db = await _appStorageDB(appId);
    return new Promise((res, rej) => {
        const t = db.transaction('kv', 'readwrite');
        t.objectStore('kv').put(value, key);
        t.oncomplete = () => res(true);
        t.onerror = () => rej(t.error);
    });
}
async function _appStorageRemove(appId, key) {
    const db = await _appStorageDB(appId);
    return new Promise((res, rej) => {
        const t = db.transaction('kv', 'readwrite');
        t.objectStore('kv').delete(key);
        t.oncomplete = () => res(true);
        t.onerror = () => rej(t.error);
    });
}

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
            const r = await fetch(args[0], args[1] || {});
            const text = await r.text();
            return { ok: r.ok, status: r.status, statusText: r.statusText, body: text };
        }
        case 'theme.get': return window.currentTheme || document.documentElement.dataset.theme;
        case 'theme.set':
            if (args[0] !== window.currentTheme && typeof toggleTheme === 'function') toggleTheme();
            return true;
        case 'clipboard.read': return await navigator.clipboard.readText();
        case 'clipboard.write': await navigator.clipboard.writeText(String(args[0] ?? '')); return true;
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
        } else if (d.type === 'init') {
            try {
                const fileURLs = {};
                for (const [path, blob] of Object.entries(d.files)) {
                    fileURLs[path] = URL.createObjectURL(blob);
                }
                const ctx = {
                    appId: d.manifest.id,
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
                        };
                    },
                    theme: { get: () => call('theme.get'), set: (t) => call('theme.set', t) },
                    clipboard: { read: () => call('clipboard.read'), write: (s) => call('clipboard.write', s) },
                    i18n: (k) => call('i18n', k),
                    permission: { request: (p) => call('permission.request', p) },
                };
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

    const win = document.getElementById('win-' + appId);
    if (!win) return false;
    const content = win.querySelector('.custom-app-content');
    if (!content) return false;

    if (_mounted.has(appId)) return true;

    const files = await window.registry.getFiles(appId);

    content.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'sandbox-iframe';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = 'width:100%;height:100%;border:0;background:transparent;';
    iframe.srcdoc = IFRAME_BOOT;
    content.appendChild(iframe);

    const onMsg = async (e) => {
        if (e.source !== iframe.contentWindow) return;
        const d = e.data;
        if (!d || !d.__aruta_sdk) return;
        if (d.type === 'ready') {
            iframe.contentWindow.postMessage({ __aruta_sdk: true, type: 'init', manifest, files }, '*');
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
    const p = _appDBCache.get(appId);
    if (!p) return;
    try { const db = await p; db.close(); } catch {}
    _appDBCache.delete(appId);
}

window.sandbox = { mount: mountApp, unmount: unmountApp, runCommand, closeAppStorage };
