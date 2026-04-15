/* ╔══════════════════════════════════════════════════════════╗
 * ║  APPEARANCE — User-customizable background, portrait,     ║
 * ║  and display name. Binaries live in IDB `aruta_appearance`║
 * ║  and are slurped by profile.js into snapshots (zip/disk). ║
 * ╚══════════════════════════════════════════════════════════╝ */
(function () {
    const DB_NAME = 'aruta_appearance';
    const STORE   = 'assets';
    const DB_VER  = 1;
    const LS_META = 'aruta_appearance_meta';
    const DEFAULT_NAME = 'Aruta.sh';
    const DEFAULT_PORTRAIT = './Images/aru2_meta.png';
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
    const MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50 MB

    let _bgURL = null;
    let _portraitURL = null;

    // ── IDB helpers ────────────────────────────────────────
    function _open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VER);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    }
    async function _put(key, value) {
        const db = await _open();
        await new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readwrite');
            t.objectStore(STORE).put(value, key);
            t.oncomplete = () => res();
            t.onerror    = () => rej(t.error);
        });
        db.close();
        window.profile?.markDirty?.('appearance', key);
    }
    async function _get(key) {
        const db = await _open();
        const v = await new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readonly');
            const r = t.objectStore(STORE).get(key);
            r.onsuccess = () => res(r.result || null);
            r.onerror   = () => rej(r.error);
        });
        db.close();
        return v;
    }
    async function _del(key) {
        const db = await _open();
        await new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readwrite');
            t.objectStore(STORE).delete(key);
            t.oncomplete = () => res();
            t.onerror    = () => rej(t.error);
        });
        db.close();
        window.profile?.markDirty?.('appearance', key);
    }
    async function _readAll() {
        const out = {};
        try {
            const db = await _open();
            await new Promise((res, rej) => {
                const t = db.transaction(STORE, 'readonly');
                const req = t.objectStore(STORE).openCursor();
                req.onsuccess = (e) => {
                    const c = e.target.result;
                    if (c) { out[String(c.key)] = c.value; c.continue(); }
                    else res();
                };
                req.onerror = () => rej(req.error);
            });
            db.close();
        } catch {}
        return out;
    }

    // ── Metadata (name + mime + filename) ──────────────────
    function _readMeta() {
        try { return JSON.parse(localStorage.getItem(LS_META) || '{}'); }
        catch { return {}; }
    }
    function _writeMeta(m) {
        try { localStorage.setItem(LS_META, JSON.stringify(m || {})); } catch {}
    }

    // ── File size / type validation ────────────────────────
    function _validate(file) {
        if (!file) return { ok: false, reason: 'no_file' };
        const isImg = /^image\//.test(file.type);
        const isVid = /^video\//.test(file.type);
        if (!isImg && !isVid) return { ok: false, reason: 'bad_type' };
        const cap = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > cap) return { ok: false, reason: 'too_big', cap };
        return { ok: true, kind: isVid ? 'video' : 'image' };
    }

    async function _fileToRecord(file, kind) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return { kind, mime: file.type || (kind === 'video' ? 'video/mp4' : 'image/png'), filename: file.name || '', bytes };
    }

    // ── URL lifecycle ──────────────────────────────────────
    function _revokeBg() {
        if (_bgURL) { try { URL.revokeObjectURL(_bgURL); } catch {} _bgURL = null; }
    }
    function _revokePortrait() {
        if (_portraitURL) { try { URL.revokeObjectURL(_portraitURL); } catch {} _portraitURL = null; }
    }
    function _recordToURL(rec) {
        if (!rec || !rec.bytes) return null;
        const bytes = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes);
        const blob = new Blob([bytes], { type: rec.mime || 'application/octet-stream' });
        return URL.createObjectURL(blob);
    }

    // ── DOM application ────────────────────────────────────
    function _applyBackground(rec) {
        _revokeBg();
        const mount = document.getElementById('user-bg-layer');
        if (!mount) return;
        mount.innerHTML = '';
        if (!rec) { mount.style.display = 'none'; return; }
        mount.style.display = '';
        _bgURL = _recordToURL(rec);
        if (!_bgURL) return;
        if (rec.kind === 'video') {
            const v = document.createElement('video');
            v.src = _bgURL;
            v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
            v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
            v.className = 'user-bg-media';
            mount.appendChild(v);
            v.play?.().catch(() => {});
        } else {
            const img = document.createElement('img');
            img.src = _bgURL;
            img.alt = '';
            img.className = 'user-bg-media';
            mount.appendChild(img);
        }
    }
    function _applyPortrait(rec) {
        _revokePortrait();
        const img = document.querySelector('.portrait-img');
        if (!img) return;
        if (!rec) { img.src = DEFAULT_PORTRAIT; return; }
        _portraitURL = _recordToURL(rec);
        img.src = _portraitURL || DEFAULT_PORTRAIT;
    }
    function _applyName(name) {
        const label = (name && String(name).trim()) || DEFAULT_NAME;
        document.querySelectorAll('.char-name, .start-title').forEach(el => {
            el.textContent = label;
        });
    }

    // ── Public API ─────────────────────────────────────────
    async function apply() {
        const meta = _readMeta();
        _applyName(meta.name);
        const bg = await _get('background');
        _applyBackground(bg);
        const portrait = await _get('portrait');
        _applyPortrait(portrait);
    }

    async function setBackground(file) {
        if (file == null) {
            await _del('background');
            const meta = _readMeta(); delete meta.background; _writeMeta(meta);
            _applyBackground(null);
            return { ok: true };
        }
        const v = _validate(file);
        if (!v.ok) return v;
        const rec = await _fileToRecord(file, v.kind);
        await _put('background', rec);
        const meta = _readMeta();
        meta.background = { kind: v.kind, mime: rec.mime, filename: rec.filename };
        _writeMeta(meta);
        _applyBackground(rec);
        return { ok: true };
    }

    async function setPortrait(file) {
        if (file == null) {
            await _del('portrait');
            const meta = _readMeta(); delete meta.portrait; _writeMeta(meta);
            _applyPortrait(null);
            return { ok: true };
        }
        const v = _validate(file);
        if (!v.ok || v.kind !== 'image') return { ok: false, reason: 'image_only' };
        const rec = await _fileToRecord(file, 'image');
        await _put('portrait', rec);
        const meta = _readMeta();
        meta.portrait = { mime: rec.mime, filename: rec.filename };
        _writeMeta(meta);
        _applyPortrait(rec);
        return { ok: true };
    }

    function setName(str) {
        const meta = _readMeta();
        if (!str || !String(str).trim()) delete meta.name;
        else meta.name = String(str).trim().slice(0, 64);
        _writeMeta(meta);
        _applyName(meta.name);
    }

    async function reset() {
        await _del('background');
        await _del('portrait');
        try { localStorage.removeItem(LS_META); } catch {}
        _applyBackground(null);
        _applyPortrait(null);
        _applyName(null);
    }

    function get() {
        const meta = _readMeta();
        return {
            name: meta.name || null,
            background: meta.background || null,
            portrait: meta.portrait || null,
        };
    }

    // ── Snapshot helpers for profile.js ────────────────────
    /** Dump IDB contents as array for profile snapshot. */
    async function dumpForSnapshot() {
        const all = await _readAll();
        const out = [];
        for (const [key, rec] of Object.entries(all)) {
            if (!rec) continue;
            const bytes = rec.bytes instanceof Uint8Array
                ? rec.bytes
                : (rec.bytes ? new Uint8Array(rec.bytes) : new Uint8Array(0));
            out.push({ key, kind: rec.kind || '', mime: rec.mime || 'application/octet-stream', filename: rec.filename || '', bytes });
        }
        return out;
    }

    /** Restore IDB from a snapshot-style array. Does not touch LS (that's handled via snapshot.localStorage). */
    async function restoreFromSnapshot(items) {
        try {
            const req = indexedDB.deleteDatabase(DB_NAME);
            await new Promise((res) => { req.onsuccess = () => res(); req.onerror = () => res(); req.onblocked = () => res(); });
        } catch {}
        if (!items || !items.length) return;
        const db = await _open();
        await new Promise((res, rej) => {
            const t = db.transaction(STORE, 'readwrite');
            const store = t.objectStore(STORE);
            for (const it of items) {
                const bytes = it.bytes instanceof Uint8Array
                    ? it.bytes
                    : (typeof it.bytes === 'string' ? new TextEncoder().encode(it.bytes) : new Uint8Array(it.bytes || []));
                store.put({ kind: it.kind || '', mime: it.mime || 'application/octet-stream', filename: it.filename || '', bytes }, it.key);
            }
            t.oncomplete = () => res();
            t.onerror    = () => rej(t.error);
        });
        db.close();
    }

    window.appearance = {
        apply,
        get,
        setBackground,
        setPortrait,
        setName,
        reset,
        dumpForSnapshot,
        restoreFromSnapshot,
        DEFAULT_NAME,
        DEFAULT_PORTRAIT,
        MAX_IMAGE_BYTES,
        MAX_VIDEO_BYTES,
    };
})();
