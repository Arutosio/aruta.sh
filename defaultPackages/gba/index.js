/* ╔══════════════════════════════════════════════════════════╗
 * ║  GBA — Game Boy Advance emulator                          ║
 * ║  EmulatorJS (CDN, single-thread mGBA core) + ROM library  ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Architecture notes:
 * - The emulator core comes from cdn.emulatorjs.org at play time. A locally
 *   bundled mGBA WASM is not possible: those builds need SharedArrayBuffer,
 *   which requires COOP/COEP headers GitHub Pages can't serve.
 * - manifest.allowOrigin = true: EmulatorJS caches cores and its own save
 *   states in IndexedDB, which doesn't exist in an opaque-origin sandbox.
 * - ROMs / SRAM / save states persist through ctx.storage as base64 strings,
 *   NEVER as TypedArrays: the profile exporter JSON.stringify()s the whole
 *   app KV into apps/gba.json, so binary data must be JSON-safe to survive
 *   an export/import round-trip.
 */

const CDN_DATA = 'https://cdn.emulatorjs.org/stable/data/';
const MAX_ROM  = 32 * 1024 * 1024; // largest licensed GBA cart
const ROM_EXTS = ['gba', 'gb', 'gbc'];
const SRAM_FLUSH_MS = 20000;

/* ── base64 helpers (chunked — String.fromCharCode.apply caps the stack) ── */
function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
}
function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
function fmtSize(n) {
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
}
function fmtDate(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleDateString(); } catch { return '—'; }
}
function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default {
    async mount(root, ctx) {
        let roms = (await ctx.storage.get('roms')) || [];
        let playing = null;        // rom meta currently in the player
        let sramTimer = null;
        let lastSramB64 = null;

        /* ════════════════ LIBRARY ════════════════ */

        function renderLibrary() {
            root.innerHTML = `
                <div class="gba-wrap">
                    <div class="gba-head">
                        <span class="gba-title">🎮 Game Boy Advance</span>
                        <label class="gba-add-btn">＋ Add ROM
                            <input type="file" id="gba-file" accept=".gba,.gb,.gbc" multiple style="display:none;">
                        </label>
                    </div>
                    <div class="gba-grid" id="gba-grid"></div>
                    <div class="gba-drop-overlay" id="gba-drop"><div>⬇ Drop your .gba ROM</div></div>
                    <div class="gba-foot">ROMs and saves are stored in your profile · Core: mGBA via EmulatorJS (CDN)</div>
                </div>
            `;
            const grid = root.querySelector('#gba-grid');
            if (!roms.length) {
                grid.innerHTML = `<div class="gba-empty">
                    <div class="gba-empty-icon">🕹️</div>
                    <div>No ROMs yet.</div>
                    <div class="gba-empty-hint">Drag &amp; drop a <b>.gba</b> / <b>.gb</b> / <b>.gbc</b> file anywhere in this window,<br>or use the “＋ Add ROM” button.</div>
                </div>`;
            } else {
                grid.innerHTML = roms.map(r => `
                    <div class="gba-card" data-id="${r.id}">
                        <div class="gba-cart">${r.ext === 'gba' ? '🟪' : '🟩'}</div>
                        <div class="gba-meta">
                            <div class="gba-name" title="${escapeHTML(r.name)}">${escapeHTML(r.name)}</div>
                            <div class="gba-sub">${fmtSize(r.size)} · ${r.ext.toUpperCase()} · ${fmtDate(r.lastPlayed)}${r.hasSave ? ' · 💾' : ''}</div>
                        </div>
                        <div class="gba-actions">
                            <button class="gba-btn gba-play" data-act="play" title="Play">▶</button>
                            ${r.ext === 'gba' ? '<button class="gba-btn gba-link" data-act="link" title="Link cable (P2P)">🔗</button>' : ''}
                            <button class="gba-btn" data-act="rename" title="Rename">✏️</button>
                            <button class="gba-btn gba-danger" data-act="delete" title="Delete">🗑</button>
                        </div>
                    </div>
                `).join('');
            }

            grid.addEventListener('click', async (e) => {
                const btn = e.target.closest('[data-act]');
                if (!btn) return;
                const id = btn.closest('.gba-card').dataset.id;
                const rom = roms.find(r => r.id === id);
                if (!rom) return;
                if (btn.dataset.act === 'play') return startGame(rom);
                if (btn.dataset.act === 'link') return startLink(rom);
                if (btn.dataset.act === 'rename') {
                    const name = prompt('Rename ROM:', rom.name);
                    if (name && name.trim()) {
                        rom.name = name.trim().slice(0, 80);
                        await ctx.storage.set('roms', roms);
                        renderLibrary();
                    }
                    return;
                }
                if (btn.dataset.act === 'delete') {
                    if (!confirm(`Delete "${rom.name}" and its saves?`)) return;
                    roms = roms.filter(r => r.id !== id);
                    await ctx.storage.set('roms', roms);
                    await ctx.storage.remove('rom_' + id);
                    await ctx.storage.remove('sav_' + id);
                    await ctx.storage.remove('state_' + id);
                    renderLibrary();
                }
            });

            root.querySelector('#gba-file').addEventListener('change', async (e) => {
                for (const f of e.target.files) await addRom(f);
                e.target.value = '';
            });
        }

        async function addRom(file) {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!ROM_EXTS.includes(ext)) {
                alert(`Unsupported file: ${file.name}\nAccepted: .gba .gb .gbc`);
                return;
            }
            if (file.size > MAX_ROM) {
                alert(`${file.name} is too big (${fmtSize(file.size)}). Max ${fmtSize(MAX_ROM)}.`);
                return;
            }
            const bytes = new Uint8Array(await file.arrayBuffer());
            const id = 'r_' + Math.random().toString(36).slice(2, 9);
            await ctx.storage.set('rom_' + id, bytesToB64(bytes));
            roms.push({
                id,
                name: file.name.replace(/\.(gba|gbc?|GBA|GBC?)$/, ''),
                ext,
                size: file.size,
                addedAt: Date.now(),
                lastPlayed: null,
                hasSave: false,
            });
            await ctx.storage.set('roms', roms);
            renderLibrary();
        }

        /* Drag & drop — overlay shown on dragover anywhere in the window. */
        let dragDepth = 0;
        const onDragEnter = (e) => {
            if (playing) return;
            e.preventDefault();
            dragDepth++;
            root.querySelector('#gba-drop')?.classList.add('show');
        };
        const onDragOver = (e) => { e.preventDefault(); };
        const onDragLeave = () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (!dragDepth) root.querySelector('#gba-drop')?.classList.remove('show');
        };
        const onDrop = async (e) => {
            e.preventDefault();
            dragDepth = 0;
            root.querySelector('#gba-drop')?.classList.remove('show');
            if (playing) return;
            for (const f of (e.dataTransfer?.files || [])) await addRom(f);
        };
        document.addEventListener('dragenter', onDragEnter);
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('dragleave', onDragLeave);
        document.addEventListener('drop', onDrop);

        /* ════════════════ PLAYER ════════════════ */

        function gm() { return window.EJS_emulator?.gameManager || null; }

        /** Read the current SRAM bytes out of the emscripten FS (best effort). */
        function readSram() {
            try {
                const g = gm();
                if (!g) return null;
                g.saveSaveFiles();
                const data = g.getSaveFile();
                return (data && data.length) ? new Uint8Array(data) : null;
            } catch { return null; }
        }

        async function flushSram() {
            if (!playing) return;
            const bytes = readSram();
            if (!bytes) return;
            const b64 = bytesToB64(bytes);
            if (b64 === lastSramB64) return;
            lastSramB64 = b64;
            await ctx.storage.set('sav_' + playing.id, b64);
            if (!playing.hasSave) {
                playing.hasSave = true;
                await ctx.storage.set('roms', roms);
            }
        }

        async function startGame(rom) {
            const b64 = await ctx.storage.get('rom_' + rom.id);
            if (!b64) { alert('ROM data missing from storage.'); return; }
            playing = rom;
            rom.lastPlayed = Date.now();
            await ctx.storage.set('roms', roms);

            const bytes = b64ToBytes(b64);
            const blobURL = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
            const savB64 = await ctx.storage.get('sav_' + rom.id);

            root.innerHTML = `
                <div class="gba-player">
                    <div class="gba-toolbar">
                        <button class="gba-btn" id="gba-back">← Library</button>
                        <span class="gba-playing">${escapeHTML(rom.name)}</span>
                    </div>
                    <div class="gba-screen"><div id="ejs"></div></div>
                </div>
            `;
            root.querySelector('#gba-back').addEventListener('click', async () => {
                await flushSram();
                // EmulatorJS has no reliable teardown — reload the iframe to
                // get a clean library (same pattern as ultima-aruta's menu).
                location.reload();
            });

            /* EmulatorJS configuration globals — must exist before loader.js */
            window.EJS_player = '#ejs';
            window.EJS_core = (rom.ext === 'gba') ? 'gba' : 'gb';
            window.EJS_gameUrl = blobURL;
            window.EJS_gameName = rom.id;          // stable key for EJS-side saves
            window.EJS_biosUrl = (rom.ext === 'gba') ? ctx.asset('bios.bin') : '';
            window.EJS_pathtodata = CDN_DATA;
            window.EJS_startOnLoaded = true;
            window.EJS_controlScheme = rom.ext === 'gba' ? 'gba' : 'gb';
            window.EJS_volume = 0.7;
            window.EJS_backgroundColor = '#0c0a1a';
            // Restore SRAM: EmulatorJS loads the save file found in its FS at
            // game start. Write ours right when the emulator is ready.
            window.EJS_onGameStart = () => {
                try {
                    if (!savB64) return;
                    const g = gm();
                    if (!g) return;
                    const path = g.getSaveFilePath();
                    const FS = g.FS;
                    const dir = path.slice(0, path.lastIndexOf('/'));
                    let p = '';
                    for (const part of dir.split('/')) {
                        if (!part) continue;
                        p += '/' + part;
                        try { FS.mkdir(p); } catch {}
                    }
                    FS.writeFile(path, b64ToBytes(savB64));
                    g.loadSaveFiles();
                    lastSramB64 = savB64;
                } catch (err) { console.warn('[gba] SRAM restore failed', err); }
            };
            // Save states: keep a profile-portable copy of the latest state.
            window.EJS_onSaveState = async ({ state }) => {
                try {
                    if (!state) return;
                    await ctx.storage.set('state_' + rom.id, bytesToB64(new Uint8Array(state)));
                    if (!rom.hasSave) { rom.hasSave = true; await ctx.storage.set('roms', roms); }
                } catch (err) { console.warn('[gba] state save failed', err); }
            };
            window.EJS_onLoadState = async () => {
                try {
                    const b = await ctx.storage.get('state_' + rom.id);
                    if (b) gm()?.loadState(b64ToBytes(b));
                } catch (err) { console.warn('[gba] state load failed', err); }
            };

            const script = document.createElement('script');
            script.src = CDN_DATA + 'loader.js';
            script.onerror = () => {
                root.querySelector('.gba-screen').innerHTML =
                    `<div class="gba-offline">⚠ Could not reach the emulator CDN.<br>
                     The first launch needs an internet connection<br>(cdn.emulatorjs.org).</div>`;
            };
            document.body.appendChild(script);

            // Periodic SRAM flush so in-game saves survive a tab close.
            sramTimer = setInterval(flushSram, SRAM_FLUSH_MS);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') flushSram();
            });
        }

        /* ════════════════ LINK MODE (custom mGBA core) ════════════════
         *
         * Uses the bundled single-thread mGBA WASM core (see CORE_BUILD.md)
         * instead of the EmulatorJS CDN: it exposes the GBA serial port to
         * JS so two browsers can emulate a link cable over WebRTC (M2).
         * The `mGBA` factory comes from core/mgba.js, concatenated into this
         * module by the sandbox mini-bundler (same pattern as tavern's
         * trystero bundle).
         */

        const LINK_KEYMAP = {
            // GBA key bits: A=0 B=1 Select=2 Start=3 →=4 ←=5 ↑=6 ↓=7 R=8 L=9
            x: 0, z: 1, Shift: 2, Enter: 3,
            ArrowRight: 4, ArrowLeft: 5, ArrowUp: 6, ArrowDown: 7,
            s: 8, a: 9,
        };
        let linkCleanup = null;   // set while link mode is active

        async function startLink(rom) {
            const b64 = await ctx.storage.get('rom_' + rom.id);
            if (!b64) { alert('ROM data missing from storage.'); return; }
            if (typeof mGBA !== 'function') {
                alert('Link core missing — reinstall the GBA app (Package Store → Defaults).');
                return;
            }
            playing = rom;
            rom.lastPlayed = Date.now();
            await ctx.storage.set('roms', roms);
            const savB64 = await ctx.storage.get('sav_' + rom.id);

            root.innerHTML = `
                <div class="gba-player">
                    <div class="gba-toolbar">
                        <button class="gba-btn" id="gba-back">← Library</button>
                        <span class="gba-playing">🔗 ${escapeHTML(rom.name)}</span>
                        <span class="gba-link-status" id="gba-link-status">solo</span>
                    </div>
                    <div class="gba-screen gba-link-screen">
                        <canvas id="gba-canvas" width="240" height="160"></canvas>
                    </div>
                    <div class="gba-foot">Z=B · X=A · A=L · S=R · Enter=Start · Shift=Select</div>
                </div>
            `;
            const canvas = root.querySelector('#gba-canvas');
            const ctx2d = canvas.getContext('2d');
            const imageData = ctx2d.createImageData(240, 160);

            /* ── boot core ── */
            let Module, api;
            try {
                Module = await mGBA({
                    locateFile: () => ctx.asset('core/mgba.wasm'),
                    print: () => {},
                    printErr: () => {},
                });
                api = {
                    loadGame:           Module.cwrap('loadGame', 'number', ['string']),
                    quitGame:           Module.cwrap('quitGame', null, []),
                    runFrame:           Module.cwrap('runFrame', null, []),
                    setKeys:            Module.cwrap('setKeys', null, ['number']),
                    getVideoBufferPtr:  Module.cwrap('getVideoBufferPtr', 'number', []),
                    sioSetLink:         Module.cwrap('sioSetLink', null, ['number', 'number']),
                    sioGetSendValue:    Module.cwrap('sioGetSendValue', 'number', []),
                    sioCompleteMulti:   Module.cwrap('sioCompleteMulti', null, ['number', 'number']),
                    sioTransferPending: Module.cwrap('sioTransferPending', 'number', []),
                    flushSave:          Module.cwrap('flushSave', null, []),
                };
                const bios = await (await fetch(ctx.asset('bios.bin'))).arrayBuffer();
                Module.FS.writeFile('/gba_bios.bin', new Uint8Array(bios));
                Module.FS.mkdir('/data');
                Module.FS.mkdir('/data/saves');
                Module.FS.mkdir('/data/states');
                Module.FS.writeFile('/rom.gba', b64ToBytes(b64));
                if (savB64) Module.FS.writeFile('/data/saves/rom.sav', b64ToBytes(savB64));
                if (!api.loadGame('/rom.gba')) throw new Error('core rejected ROM');
                api.sioSetLink(0, 0); // master, no peer yet (P2P lobby lands in M2)
            } catch (err) {
                console.warn('[gba] link core boot failed', err);
                root.querySelector('.gba-screen').innerHTML =
                    `<div class="gba-offline">⚠ Link core failed to start.<br>${escapeHTML(String(err))}</div>`;
                return;
            }

            /* ── audio: scheduled AudioBufferSources @ core rate 32768 Hz ── */
            let audioCtx = null;
            let audioPtr = 0;
            let audioTime = 0;
            try {
                audioCtx = new AudioContext({ sampleRate: 32768 });
                audioPtr = Module._malloc(4096 * 2 * 2); // 4096 stereo int16 frames
            } catch (err) { console.warn('[gba] link audio unavailable', err); }
            const readAudio = Module.cwrap('readAudio', 'number', ['number', 'number']);
            function pumpAudio() {
                if (!audioCtx || audioCtx.state !== 'running' || !audioPtr) return;
                const frames = readAudio(audioPtr, 4096);
                if (frames <= 0) return;
                const heap = new Int16Array(Module.HEAPU8.buffer, audioPtr, frames * 2);
                const buf = audioCtx.createBuffer(2, frames, 32768);
                const L = buf.getChannelData(0);
                const R = buf.getChannelData(1);
                for (let i = 0; i < frames; i++) {
                    L[i] = heap[i * 2] / 32768;
                    R[i] = heap[i * 2 + 1] / 32768;
                }
                const src = audioCtx.createBufferSource();
                src.buffer = buf;
                src.connect(audioCtx.destination);
                const now = audioCtx.currentTime;
                if (audioTime < now + 0.02) audioTime = now + 0.02;
                src.start(audioTime);
                audioTime += frames / 32768;
            }

            /* ── input ── */
            let keys = 0;
            const onKeyDown = (e) => {
                if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                const k = LINK_KEYMAP[e.key];
                if (k === undefined) return;
                keys |= 1 << k;
                api.setKeys(keys);
                e.preventDefault();
            };
            const onKeyUp = (e) => {
                const k = LINK_KEYMAP[e.key];
                if (k === undefined) return;
                keys &= ~(1 << k);
                api.setKeys(keys);
                e.preventDefault();
            };
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            const onClickResume = () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); };
            document.addEventListener('pointerdown', onClickResume);

            /* ── frame loop: pace at GBA 59.7275 fps regardless of display Hz ── */
            const FRAME_MS = 1000 / 59.7275;
            let rafId = 0;
            let last = performance.now();
            let acc = 0;
            function draw() {
                const ptr = api.getVideoBufferPtr();
                if (!ptr) return;
                const src = new Uint8Array(Module.HEAPU8.buffer, ptr, 240 * 160 * 4);
                const d = imageData.data;
                d.set(src);
                for (let i = 3; i < d.length; i += 4) d[i] = 255;
                ctx2d.putImageData(imageData, 0, 0);
            }
            function loop(now) {
                rafId = requestAnimationFrame(loop);
                acc += now - last;
                last = now;
                if (acc > 100) acc = 100; // tab was hidden — don't fast-forward
                let ran = false;
                while (acc >= FRAME_MS) {
                    api.runFrame();
                    acc -= FRAME_MS;
                    ran = true;
                }
                if (ran) { draw(); pumpAudio(); }
            }
            rafId = requestAnimationFrame(loop);

            /* ── SRAM persistence (same storage keys as the EmulatorJS path,
             *    same raw .sav bytes — saves are interchangeable) ── */
            async function flushLinkSram() {
                try {
                    api.flushSave();
                    const data = Module.FS.readFile('/data/saves/rom.sav');
                    if (!data || !data.length) return;
                    const b = bytesToB64(data);
                    if (b === lastSramB64) return;
                    lastSramB64 = b;
                    await ctx.storage.set('sav_' + rom.id, b);
                    if (!rom.hasSave) {
                        rom.hasSave = true;
                        await ctx.storage.set('roms', roms);
                    }
                } catch { /* no save file yet */ }
            }
            sramTimer = setInterval(flushLinkSram, SRAM_FLUSH_MS);
            const onVis = () => { if (document.visibilityState === 'hidden') flushLinkSram(); };
            document.addEventListener('visibilitychange', onVis);

            linkCleanup = async () => {
                cancelAnimationFrame(rafId);
                if (sramTimer) { clearInterval(sramTimer); sramTimer = null; }
                document.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('keyup', onKeyUp);
                document.removeEventListener('pointerdown', onClickResume);
                document.removeEventListener('visibilitychange', onVis);
                await flushLinkSram();
                try { if (audioCtx) await audioCtx.close(); } catch {}
                try { api.quitGame(); } catch {}
            };

            root.querySelector('#gba-back').addEventListener('click', async () => {
                await linkCleanup();
                linkCleanup = null;
                location.reload(); // same clean-slate pattern as the EmulatorJS player
            });
        }

        renderLibrary();
        root.__gbaCleanup = async () => {
            if (linkCleanup) { await linkCleanup(); linkCleanup = null; return; }
            if (sramTimer) clearInterval(sramTimer);
            document.removeEventListener('dragenter', onDragEnter);
            document.removeEventListener('dragover', onDragOver);
            document.removeEventListener('dragleave', onDragLeave);
            document.removeEventListener('drop', onDrop);
            await flushSram();
        };
    },

    async unmount(root) {
        try { await root.__gbaCleanup?.(); } catch {}
        delete root.__gbaCleanup;
    },
};
