/* ╔══════════════════════════════════════════════════════════╗
 * ║  REGISTRY — IndexedDB store of installed packages         ║
 * ║  Keeps in-memory cache, syncs to IndexedDB and localStorage ║
 * ╚══════════════════════════════════════════════════════════╝ */

const DB_NAME = 'aruta_packages';
const DB_VERSION = 1;
const INDEX_KEY = 'aruta_installed_apps';

let _dbPromise = null;
function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('manifests')) db.createObjectStore('manifests', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: ['appId', 'path'] });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

function tx(db, stores, mode) {
    return db.transaction(stores, mode);
}

const _manifests = new Map();
const _commands = new Map();

function loadIndex() {
    try {
        const raw = localStorage.getItem(INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveIndex() {
    const arr = Array.from(_manifests.values()).map(m => ({
        id: m.id, name: m.name, icon: m.icon, type: m.type, permissions: m.permissions || []
    }));
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(arr)); } catch {}
}

async function bootstrap() {
    try {
        const db = await openDB();
        const store = tx(db, ['manifests'], 'readonly').objectStore('manifests');
        const all = await new Promise((res, rej) => {
            const r = store.getAll();
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
        for (const m of all) {
            _manifests.set(m.id, m);
            if (m.type === 'command') _commands.set(m.id, m);
            if (m.type === 'app') { registerAppInOS(m); ensureAppWindow(m); }
        }
        saveIndex();
        renderStartMenuItems();
    } catch (e) {
        console.warn('[registry] bootstrap failed', e);
    }
}

function registerAppInOS(manifest) {
    if (typeof WIN_META !== 'undefined') {
        WIN_META[manifest.id] = { icon: manifest.icon || '📦', label: manifest.name, custom: true };
    }
}

function unregisterAppFromOS(id) {
    window.sandbox?.unmount(id);
    if (typeof WIN_META !== 'undefined') delete WIN_META[id];
    const win = document.getElementById('win-' + id);
    if (win) win.remove();
    if (typeof removeWindowTab === 'function') removeWindowTab(id);
}

function renderStartMenuItems() {
    const items = document.querySelector('#start-menu .start-items');
    if (!items) return;
    items.querySelectorAll('.start-item.start-custom').forEach(b => b.remove());
    for (const m of _manifests.values()) {
        if (m.type !== 'app') continue;
        const btn = document.createElement('button');
        btn.className = 'start-item start-custom';
        btn.dataset.window = m.id;
        btn.innerHTML = `${m.icon || '📦'} <span>${m.name}</span>`;
        btn.addEventListener('click', () => {
            if (typeof openWindow === 'function') openWindow(m.id);
            const menu = document.getElementById('start-menu');
            const startBtn = document.getElementById('start-btn');
            // Trigger the start button's toggle so internal isOpen state stays consistent.
            if (menu && menu.style.display !== 'none') startBtn?.click();
        });
        items.appendChild(btn);
    }
}

async function saveManifest(manifest, files) {
    const db = await openDB();
    await new Promise((res, rej) => {
        const t = tx(db, ['manifests', 'files'], 'readwrite');
        t.objectStore('manifests').put({ ...manifest, _installedAt: Date.now() });
        const filesStore = t.objectStore('files');
        const range = IDBKeyRange.bound([manifest.id, ''], [manifest.id, '\uffff']);
        const req = filesStore.openCursor(range);
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) { cursor.delete(); cursor.continue(); }
            else {
                for (const [path, blob] of Object.entries(files)) {
                    filesStore.put({ appId: manifest.id, path, blob });
                }
            }
        };
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
    });
    _manifests.set(manifest.id, manifest);
    if (manifest.type === 'command') _commands.set(manifest.id, manifest);
    if (manifest.type === 'app') {
        registerAppInOS(manifest);
        ensureAppWindow(manifest);
    }
    saveIndex();
    renderStartMenuItems();
}

async function getFiles(appId) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const t = tx(db, ['files'], 'readonly');
        const store = t.objectStore('files');
        const out = {};
        const range = IDBKeyRange.bound([appId, ''], [appId, '\uffff']);
        const req = store.openCursor(range);
        req.onsuccess = (e) => {
            const c = e.target.result;
            if (c) { out[c.value.path] = c.value.blob; c.continue(); }
            else res(out);
        };
        req.onerror = () => rej(req.error);
    });
}

async function uninstall(id) {
    const m = _manifests.get(id);
    if (!m) return;
    const db = await openDB();
    await new Promise((res, rej) => {
        const t = tx(db, ['manifests', 'files'], 'readwrite');
        t.objectStore('manifests').delete(id);
        const filesStore = t.objectStore('files');
        const range = IDBKeyRange.bound([id, ''], [id, '\uffff']);
        const req = filesStore.openCursor(range);
        req.onsuccess = (e) => {
            const c = e.target.result;
            if (c) { c.delete(); c.continue(); }
        };
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
    });
    _manifests.delete(id);
    _commands.delete(id);
    unregisterAppFromOS(id);
    // Drop app's own storage DB
    try { indexedDB.deleteDatabase('aruta_app_' + id); } catch {}
    // If this was a default package, remember so we don't auto-reinstall it.
    window.defaults?.markUninstalled(id);
    saveIndex();
    renderStartMenuItems();
}

function ensureAppWindow(manifest) {
    const id = manifest.id;
    if (document.getElementById('win-' + id)) return;
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    const win = document.createElement('div');
    win.className = 'os-window os-window-custom';
    win.id = 'win-' + id;
    win.dataset.window = id;
    win.style.display = 'none';
    win.innerHTML = `
        <div class="win-titlebar">
            <span class="win-title">${manifest.icon || '📦'} <span>${manifest.name}</span></span>
            <div class="win-controls">
                <button class="win-btn win-minimize" title="Minimize">▬</button>
                <button class="win-btn win-maximize" title="Maximize">☐</button>
                <button class="win-btn win-close" title="Close">✕</button>
            </div>
        </div>
        <div class="win-content custom-app-content"></div>
    `;
    desktop.appendChild(win);
    // Wire window controls (mirrors initWindowManager logic for one window)
    const titlebar = win.querySelector('.win-titlebar');
    if (titlebar && typeof initDrag === 'function') {
        initDrag(win, titlebar);
        titlebar.addEventListener('dblclick', (e) => {
            if (e.target.closest('.win-btn')) return;
            if (typeof toggleMaximize === 'function') toggleMaximize(win);
        });
    }
    win.addEventListener('mousedown', () => { if (typeof focusWindow === 'function') focusWindow(win); });
    win.querySelector('.win-minimize')?.addEventListener('click', e => { e.stopPropagation(); if (typeof minimizeWindow === 'function') minimizeWindow(id); });
    win.querySelector('.win-maximize')?.addEventListener('click', e => { e.stopPropagation(); if (typeof toggleMaximize === 'function') toggleMaximize(win); });
    win.querySelector('.win-close')?.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof closeWindow === 'function') closeWindow(id);
        // Keep iframe alive so app state (game progress, form input, ...) survives close/reopen.
        // Full teardown happens only on uninstall via unregisterAppFromOS → sandbox.unmount.
    });
}

window.registry = {
    bootstrap,
    saveManifest,
    getFiles,
    uninstall,
    list: () => Array.from(_manifests.values()),
    listCommands: () => Array.from(_commands.values()),
    getManifest: (id) => _manifests.get(id),
    isInstalled: (id) => _manifests.has(id),
};
