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

        /* Link-mode strings, inline like the rest of the app, in the site's
         * 5 languages. Lang comes from the host (same-origin iframe). */
        const LINK_I18N = {
            en: {
                title: 'Link cable — P2P',
                hint: 'Both players need their own copy of the game.<br>One creates the room, the other joins with the code.',
                tip: 'Pokémon trades: once connected, both players walk to the Cable Club upstairs in any Pokémon Center.',
                create: '🛖 Create room',
                or: '— or —',
                join: 'Join',
                waiting: '⌛ Waiting for the other player…',
                waitShort: 'waiting…',
                connected: 'connected',
                disconnected: 'disconnected',
                lost: '🔌 Peer disconnected.<br>Save is safe — go back and relink.',
                host: 'P1 (host)', guest: 'P2 (guest)',
            },
            it: {
                title: 'Cavo Link — P2P',
                hint: 'Ogni giocatore deve avere la propria copia del gioco.<br>Uno crea la stanza, l’altro entra col codice.',
                tip: 'Scambi Pokémon: una volta connessi, salite entrambi al Cable Club di un Centro Pokémon.',
                create: '🛖 Crea stanza',
                or: '— oppure —',
                join: 'Entra',
                waiting: '⌛ In attesa dell’altro giocatore…',
                waitShort: 'in attesa…',
                connected: 'connesso',
                disconnected: 'disconnesso',
                lost: '🔌 Giocatore disconnesso.<br>Il salvataggio è al sicuro — torna indietro e ricollega.',
                host: 'P1 (host)', guest: 'P2 (ospite)',
            },
            es: {
                title: 'Cable Link — P2P',
                hint: 'Cada jugador necesita su propia copia del juego.<br>Uno crea la sala, el otro se une con el código.',
                tip: 'Intercambios Pokémon: una vez conectados, subid los dos al Club Cable de un Centro Pokémon.',
                create: '🛖 Crear sala',
                or: '— o —',
                join: 'Unirse',
                waiting: '⌛ Esperando al otro jugador…',
                waitShort: 'esperando…',
                connected: 'conectado',
                disconnected: 'desconectado',
                lost: '🔌 Jugador desconectado.<br>La partida está a salvo — vuelve atrás y reconecta.',
                host: 'P1 (anfitrión)', guest: 'P2 (invitado)',
            },
            ja: {
                title: '通信ケーブル — P2P',
                hint: '対戦するには各プレイヤーがゲームのコピーを持っている必要があります。<br>一人がルームを作成し、もう一人がコードで参加します。',
                tip: 'ポケモン交換：接続後、二人ともポケモンセンター2階の通信クラブへ。',
                create: '🛖 ルーム作成',
                or: '— または —',
                join: '参加',
                waiting: '⌛ 相手を待っています…',
                waitShort: '待機中…',
                connected: '接続済み',
                disconnected: '切断',
                lost: '🔌 相手が切断しました。<br>セーブは無事です — 戻って再接続してください。',
                host: 'P1（ホスト）', guest: 'P2（ゲスト）',
            },
            fn: {
                title: 'ᛚᛁᚾᚲ ᚲᚨᛒᛚᛖ — ᛈ2ᛈ',
                hint: 'ᛒᛟᚦ ᛈᛚᚨᛁᛖᚱᛊ ᚾᛖᛖᛞ ᚦᛖᛁᚱ ᛟᚹᚾ ᚷᚨᛗᛖ.<br>ᛟᚾᛖ ᛗᚨᚲᛖᛊ ᚦᛖ ᚱᛟᛟᛗ, ᛟᚾᛖ ᛃᛟᛁᚾᛊ ᚹᛁᚦ ᚦᛖ ᚲᛟᛞᛖ.',
                tip: 'ᛈᛟᚲᛖᛗᛟᚾ ᛏᚱᚨᛞᛖᛊ: ᛒᛟᚦ ᚷᛟ ᛏᛟ ᚦᛖ ᚲᚨᛒᛚᛖ ᚲᛚᚢᛒ.',
                create: '🛖 ᛗᚨᚲᛖ ᚱᛟᛟᛗ',
                or: '— ᛟᚱ —',
                join: 'ᛃᛟᛁᚾ',
                waiting: '⌛ ᚹᚨᛁᛏᛁᚾᚷ ᚠᛟᚱ ᚦᛖ ᛟᚦᛖᚱ ᛈᛚᚨᛁᛖᚱ…',
                waitShort: 'ᚹᚨᛁᛏᛁᚾᚷ…',
                connected: 'ᚲᛟᚾᚾᛖᚲᛏᛖᛞ',
                disconnected: 'ᛞᛁᛊᚲᛟᚾᚾᛖᚲᛏᛖᛞ',
                lost: '🔌 ᛈᛖᛖᚱ ᛞᛁᛊᚲᛟᚾᚾᛖᚲᛏᛖᛞ.<br>ᛊᚨᚡᛖ ᛁᛊ ᛊᚨᚠᛖ — ᚷᛟ ᛒᚨᚲ ᚨᚾᛞ ᚱᛖᛚᛁᚾᚲ.',
                host: 'ᛈ1 (ᚺᛟᛊᛏ)', guest: 'ᛈ2 (ᚷᚢᛖᛊᛏ)',
            },
        };
        function linkLang() {
            try { return window.parent?.currentLang || 'en'; } catch { return 'en'; }
        }
        function LT() { return LINK_I18N[linkLang()] || LINK_I18N.en; }

        /* Short human-friendly room codes: 3 words from a fixed list. */
        const LINK_WORDS = [
            'luna', 'fuoco', 'rana', 'stella', 'drago', 'lupo', 'gufo', 'mago',
            'rosa', 'neve', 'onda', 'vento', 'sole', 'orso', 'volpe', 'fata',
            'rune', 'gemma', 'torre', 'bosco', 'lago', 'rovo', 'falco', 'tuono',
            'perla', 'corvo', 'spada', 'scudo', 'elfo', 'troll', 'nano', 'arco',
        ];
        function linkMakeCode() {
            const buf = new Uint32Array(3);
            crypto.getRandomValues(buf);
            return [...buf].map(n => LINK_WORDS[n % LINK_WORDS.length]).join('-');
        }
        const LINK_TRACKERS = [
            // Same working set as tavern — Trystero's defaults include dead hosts.
            'wss://tracker.openwebtorrent.com',
            'wss://tracker.webtorrent.dev',
            'wss://tracker.files.fm:7073/announce',
            'wss://tracker.ghostchu-services.top',
        ];

        async function startLink(rom) {
            const b64 = await ctx.storage.get('rom_' + rom.id);
            if (!b64) { alert('ROM data missing from storage.'); return; }
            if (typeof mGBA !== 'function' || !globalThis.__trystero?.torrent) {
                alert('Link core missing — reinstall the GBA app (Package Store → Defaults).');
                return;
            }

            /* ── lobby: create a room (host/master) or join one (guest/slave) ── */
            root.innerHTML = `
                <div class="gba-player">
                    <div class="gba-toolbar">
                        <button class="gba-btn" id="gba-back">← Library</button>
                        <span class="gba-playing">🔗 ${escapeHTML(rom.name)}</span>
                    </div>
                    <div class="gba-lobby">
                        <div class="gba-lobby-box">
                            <div class="gba-lobby-title">${LT().title}</div>
                            <div class="gba-lobby-hint">${LT().hint}</div>
                            <button class="gba-btn gba-lobby-btn" id="gba-create">${LT().create}</button>
                            <div class="gba-lobby-or">${LT().or}</div>
                            <div class="gba-lobby-join">
                                <input id="gba-code" type="text" placeholder="luna-fuoco-rana" spellcheck="false" autocomplete="off">
                                <button class="gba-btn gba-lobby-btn" id="gba-join">${LT().join}</button>
                            </div>
                            <div class="gba-lobby-hint">${LT().tip}</div>
                        </div>
                    </div>
                </div>
            `;
            root.querySelector('#gba-back').addEventListener('click', () => location.reload());
            root.querySelector('#gba-create').addEventListener('click', () => {
                bootLinkCore(rom, b64, 'host', linkMakeCode());
            });
            const joinIt = () => {
                const code = root.querySelector('#gba-code').value.trim().toLowerCase();
                if (!code) return;
                bootLinkCore(rom, b64, 'guest', code);
            };
            root.querySelector('#gba-join').addEventListener('click', joinIt);
            root.querySelector('#gba-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinIt(); });
        }

        async function bootLinkCore(rom, b64, role, code) {
            playing = rom;
            rom.lastPlayed = Date.now();
            await ctx.storage.set('roms', roms);
            const savB64 = await ctx.storage.get('sav_' + rom.id);
            const isHost = role === 'host';

            root.innerHTML = `
                <div class="gba-player">
                    <div class="gba-toolbar">
                        <button class="gba-btn" id="gba-back">← Library</button>
                        <span class="gba-playing">🔗 ${escapeHTML(rom.name)}</span>
                        <span class="gba-link-code" id="gba-link-code" title="Room code — click to copy">${escapeHTML(code)}</span>
                        <span class="gba-link-status" id="gba-link-status">${LT().waitShort}</span>
                    </div>
                    <div class="gba-screen gba-link-screen">
                        <canvas id="gba-canvas" width="240" height="160"></canvas>
                        <div class="gba-link-overlay" id="gba-link-overlay">
                            <div>${LT().waiting}<br><span class="gba-link-overlay-code">${escapeHTML(code)}</span></div>
                        </div>
                    </div>
                    <div class="gba-foot">Z=B · X=A · A=L · S=R · Enter=Start · Shift=Select · ${isHost ? LT().host : LT().guest}</div>
                </div>
            `;
            const statusEl = root.querySelector('#gba-link-status');
            const overlayEl = root.querySelector('#gba-link-overlay');
            root.querySelector('#gba-link-code').addEventListener('click', () => {
                ctx.clipboard.write(code).catch(() => {});
            });
            function setStatus(text, on) {
                statusEl.textContent = text;
                statusEl.classList.toggle('on', !!on);
            }
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
                    runLoop:            Module.cwrap('runLoop', null, []),
                    runCycles:          Module.cwrap('runCycles', null, ['number']),
                    frameCount:         Module.cwrap('frameCount', 'number', []),
                    setKeys:            Module.cwrap('setKeys', null, ['number']),
                    getVideoBufferPtr:  Module.cwrap('getVideoBufferPtr', 'number', []),
                    sioSetLink:         Module.cwrap('sioSetLink', null, ['number', 'number']),
                    sioGetSendValue:    Module.cwrap('sioGetSendValue', 'number', []),
                    sioCompleteMulti4:  Module.cwrap('sioCompleteMulti4', null, ['number', 'number', 'number', 'number']),
                    sioTransferPending: Module.cwrap('sioTransferPending', 'number', []),
                    sioPushCompletion:  Module.cwrap('sioPushCompletion', null, ['number', 'number', 'number', 'number']),
                    sioQueueCount:      Module.cwrap('sioQueueCount', 'number', []),
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
                api.sioSetLink(isHost ? 0 : 1, 0); // connected flips when the peer arrives
            } catch (err) {
                console.warn('[gba] link core boot failed', err);
                root.querySelector('.gba-screen').innerHTML =
                    `<div class="gba-offline">⚠ Link core failed to start.<br>${escapeHTML(String(err))}</div>`;
                return;
            }

            /* ── Trystero room: serial bridge + presence (2-4 players) ──
             * Protocol (host = GBA master id 0, guests = slaves id 1..3):
             *  host  onSioStart(v) ──▶ broadcast {t:'x', q, v, f}
             *  guest on 'x': drain queued completions, reply {t:'r', q, sv}
             *  host  collects every guest's reply → vals[4] → completes
             *        locally and broadcasts {t:'c', q, vals}
             *  guest on 'c': queue the full vector in the core (per-IRQ paced)
             * Emulated time freezes while a transfer is in flight, so the
             * games' own frame-based link timeouts never fire spuriously.
             */
            const room = globalThis.__trystero.torrent.joinRoom(
                { appId: 'aruta-gba-link', trackerUrls: LINK_TRACKERS },
                'gba-' + code
            );
            const [sendSio, getSio] = room.makeAction('sio');
            const [sendCtl, getCtl] = room.makeAction('ctl');
            const players = new Map();   // host: peerId → slave id (1..3)
            let hostId = null;           // guest: the host's peerId
            let myId = isHost ? 0 : -1;  // guest learns its slot from the roster
            let playerCount = 1;
            let connected = false;
            let paused = false;
            let frameCount = 0;
            let pendingVal = null;       // host: value in flight
            let pendingSeq = 0;
            let pendingSince = 0;
            let pendingReplies = null;   // host: Map slaveId → sv for in-flight q

            function setLinkState(count) {
                playerCount = count;
                connected = count >= 2 && (isHost || myId > 0);
                api.sioSetLink(isHost ? 0 : Math.max(myId, 1), connected ? count : 1);
                if (connected) {
                    paused = false;
                    overlayEl.classList.add('hide');
                    setStatus(LT().connected + ' · P' + ((isHost ? 0 : myId) + 1) + '/' + count, true);
                }
            }
            function linkLost() {
                if (!connected) return;
                connected = false;
                pendingVal = null;
                pendingReplies = null;
                heldX = null;
                lastCq = -1;
                // Unblock a master frozen mid-transfer: complete it like a
                // yanked cable would (all peer slots read 0xFFFF).
                if (isHost) setTimeout(() => {
                    try { if (api.sioTransferPending()) api.sioCompleteMulti4(0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF); } catch {}
                }, 0);
                api.sioSetLink(isHost ? 0 : Math.max(myId, 1), 1);
                paused = true;
                flushLinkSram();
                setStatus(LT().disconnected, false);
                overlayEl.querySelector('div').innerHTML = LT().lost;
                overlayEl.classList.remove('hide');
            }
            if (isHost) {
                room.onPeerJoin((id) => {
                    const used = new Set(players.values());
                    let sid = 1;
                    while (used.has(sid)) sid++;
                    if (sid > 3) return;   // room full (4 players max)
                    players.set(id, sid);
                    sendCtl({ t: 'roster', id: sid, count: players.size + 1 }, id);
                    sendCtl({ t: 'count', n: players.size + 1 });
                    setLinkState(players.size + 1);
                });
                room.onPeerLeave((id) => {
                    if (!players.has(id)) return;
                    players.delete(id);
                    // A cable yanked mid-session kills the link for everyone.
                    linkLost();
                    sendCtl({ t: 'bye' });
                });
            } else {
                room.onPeerLeave((id) => { if (id === hostId) linkLost(); });
            }
            getCtl((msg, id) => {
                if (!msg) return;
                if (!isHost && msg.t === 'roster') {
                    hostId = id;
                    myId = msg.id;
                    setLinkState(msg.count);
                } else if (!isHost && id === hostId && msg.t === 'count') {
                    setLinkState(msg.n);
                } else if (!isHost && id === hostId && msg.t === 'f') {
                    masterFrame = Math.max(masterFrame, msg.n | 0);
                } else if (msg.t === 'bye' && (isHost ? players.has(id) : id === hostId)) {
                    if (isHost) players.delete(id);
                    linkLost();
                }
            });
            /* Serial lockstep (the VBA-Link trick): emulated time STOPS while
             * waiting for the peer, so the games' own link timeouts (the
             * slave resets its handshake after 10 vblanks without a serial
             * IRQ; the master bursts 9 transfers per frame off Timer3) can
             * never fire spuriously. Wall-clock speed degrades with RTT;
             * correctness doesn't. */
            let lastXAt = 0;          // slave: when the last master transfer arrived
            let masterFrame = 0;      // slave: master's frame counter from 'x'/'f' msgs
            const __linkStats = { sioStarts: 0, xRecv: 0, rRecv: 0, completes: 0, lastSent: -1, lastRecv: -1, xHeld: 0, xForced: 0, ifStuck: 0 };
            const netLog = [];        // arrival ring: {t, q, at, sv?} for ordering forensics
            function netLogPush(e) { netLog.push(e); if (netLog.length > 256) netLog.shift(); }
            // Drain at SUB-frame granularity (~20k cycles ≈ 0.07 frames per
            // slice): replies/completions happen this turn, but a 9-transfer
            // master burst advances the slave's clock by well under a frame.
            function drainQueue() {
                let guard = 80;
                while (api.sioQueueCount() && guard--) api.runCycles(20000);
                // The last completion's serial IRQ may still be pending or its
                // handler mid-flight: run until IF(serial) clears, plus one
                // grace slice so DoSend has written the game's NEXT value —
                // otherwise our reply carries the previous (stale) halfword.
                // Budget must survive the Trade Room's long DMA bursts, which
                // block the CPU for tens of thousands of cycles before the
                // ISR can even start.
                guard = 64;
                while ((window.__gbaLink.read16(0x4000202) & 0x80) && guard--) api.runCycles(4096);
                if (window.__gbaLink.read16(0x4000202) & 0x80) __linkStats.ifStuck++;
                api.runCycles(4096);
                frameCount = api.frameCount();
            }
            /* Sequencing barrier (slave): the master emits 'c' N and 'x' N+1
             * back-to-back inside one burst. Our reply for N+1 is only valid
             * AFTER completion N's ISR ran DoSend — so never answer an 'x'
             * whose predecessor 'c' hasn't been processed yet. The held 'x'
             * is answered from the matching 'c' handler; a watchdog answers
             * anyway after 1s so a seq desync can't deadlock the link. */
            let lastCq = -1;          // slave: last completion seq processed
            let heldX = null;         // slave: 'x' parked until its 'c' arrives
            let heldXAt = 0;
            function answerX(msg) {
                __linkStats.xRecv++;
                __linkStats.lastRecv = msg.v;
                lastXAt = performance.now();
                if (typeof msg.f === 'number' && msg.f > masterFrame) masterFrame = msg.f;
                drainQueue();
                const sv = api.sioGetSendValue();
                netLogPush({ t: 'r', q: msg.q, at: performance.now() | 0, sv });
                sendSio({ t: 'r', q: msg.q, sv }, hostId);
            }
            getSio((msg, id) => {
                if (!msg || !connected) return;
                if (!isHost && id === hostId && msg.t === 'x') {
                    netLogPush({ t: 'x', q: msg.q, at: performance.now() | 0 });
                    if (lastCq >= 0 && msg.q !== ((lastCq + 1) & 0xFFFF)) {
                        __linkStats.xHeld++;
                        heldX = msg;
                        heldXAt = performance.now();
                        return;
                    }
                    heldX = null;
                    answerX(msg);
                } else if (!isHost && id === hostId && msg.t === 'c') {
                    // Full value vector for a finished transfer — queue it in
                    // the core; an mTiming event delivers one per serviced
                    // serial IRQ (two-phase, Timer3 cadence).
                    __linkStats.completes++;
                    const v = msg.vals || [];
                    const dbgN = (n) => { try { return Module.ccall(n, 'number', [], []); } catch { return -1; } };
                    const c0 = dbgN('sioGetCompleteCount'), i0 = dbgN('sioGetIrqCount');
                    api.sioPushCompletion(
                        v[0] ?? 0xFFFF, v[1] ?? 0xFFFF, v[2] ?? 0xFFFF, v[3] ?? 0xFFFF);
                    drainQueue();
                    netLogPush({ t: 'c', q: msg.q, at: performance.now() | 0, sv: api.sioGetSendValue(),
                                 dc: dbgN('sioGetCompleteCount') - c0, di: dbgN('sioGetIrqCount') - i0,
                                 if7: window.__gbaLink.read16(0x4000202) & 0x80, qn: api.sioQueueCount() });
                    lastCq = msg.q & 0xFFFF;
                    if (heldX && heldX.q === ((lastCq + 1) & 0xFFFF)) {
                        const m = heldX;
                        heldX = null;
                        answerX(m);
                    }
                } else if (isHost && msg.t === 'r' && players.has(id) &&
                           msg.q === pendingSeq && pendingVal !== null) {
                    __linkStats.rRecv++;
                    __linkStats.lastRecv = msg.sv;
                    pendingReplies.set(players.get(id), msg.sv & 0xFFFF);
                    if (pendingReplies.size === players.size) {
                        const vals = [pendingVal & 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF];
                        for (const [sid, sv] of pendingReplies) vals[sid] = sv;
                        api.sioCompleteMulti4(vals[0], vals[1], vals[2], vals[3]);
                        __linkStats.completes++;
                        pendingVal = null;
                        pendingReplies = null;
                        sendSio({ t: 'c', q: pendingSeq, vals });
                        // Resume the frame suspended on this transfer right
                        // away — waiting for the next rAF tick would crawl.
                        if (midFrame) {
                            if (advanceFrame()) {
                                midFrame = false;
                                draw();
                                pumpAudio();
                            } // else: blocked again on the frame's next transfer
                        }
                    }
                }
            });
            if (isHost) {
                Module.onSioStart = (v) => {
                    __linkStats.sioStarts++;
                    __linkStats.lastSent = v;
                    if (!connected) {
                        // No peer: complete like real hardware (peer slots
                        // 0xFFFF) so the core never stays latched Busy. Defer —
                        // we're inside the wasm call stack right now.
                        setTimeout(() => {
                            try { if (pendingVal === null && api.sioTransferPending()) api.sioCompleteMulti4(v & 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF); } catch {}
                        }, 0);
                        return;
                    }
                    pendingSeq = (pendingSeq + 1) & 0xFFFF;
                    pendingVal = v;
                    pendingReplies = new Map();
                    pendingSince = performance.now();
                    sendSio({ t: 'x', q: pendingSeq, v, f: frameCount });
                };
            }
            // Debug handle for link diagnostics (read from devtools; harmless in prod).
            const dbg = (name) => { try { return Module.ccall(name, 'number', [], []); } catch { return -2; } };
            window.__gbaLink = {
                stats: __linkStats, isHost,
                get pending() { return pendingVal; },
                get loopState() {
                    return { midFrame, paused, connected, acc, frameCount,
                             pendingSeq, pendingVal, masterFrame, lastCq,
                             heldX: heldX ? heldX.q : null,
                             transferPending: api.sioTransferPending(),
                             queueCount: api.sioQueueCount() };
                },
                get netLog() { return netLog.slice(-96); },
                get sio() {
                    return {
                        siocnt: dbg('sioGetSiocnt').toString(2).padStart(16, '0'),
                        rcnt: dbg('sioGetRcnt').toString(2).padStart(16, '0'),
                        mode: dbg('sioGetMode'),
                        irqs: dbg('sioGetIrqCount'),
                        completes: dbg('sioGetCompleteCount'),
                        send: api.sioGetSendValue(),
                    };
                },
                read16: (a) => Module.ccall('readBus16', 'number', ['number'], [a]),
                read8: (a) => Module.ccall('readBus8', 'number', ['number'], [a]),
                get trace() { return linkTrace; },
                get pairLog() {
                    const n = Module.ccall('sioLogCount', 'number', [], []);
                    const out = [];
                    for (let i = Math.max(0, n - 64); i < n; i++) {
                        const v = Module.ccall('sioLogGet', 'number', ['number'], [i]) >>> 0;
                        out.push({ i, d0: (v >>> 16).toString(16), d1: (v & 0xFFFF).toString(16) });
                    }
                    return out;
                },
                /* Emerald-specific link globals (pret symbols, US/EU BPEE). */
                get game() {
                    const r16 = (a) => Module.ccall('readBus16', 'number', ['number'], [a]);
                    const r8  = (a) => Module.ccall('readBus8', 'number', ['number'], [a]);
                    return {
                        isMaster: r8(0x03003170),
                        state: r8(0x03003171),
                        localId: r8(0x03003172),
                        playerCount: r8(0x03003173),
                        hs: [0x3174, 0x3176, 0x3178, 0x317A].map(o => r16(0x03000000 + o).toString(16)),
                        handshakeAsMaster: r8(0x0300317E),
                        shouldAdvance: r8(0x03003144),
                        wirelessType: r8(0x030030FC),
                        ie: r16(0x04000200).toString(2).padStart(16, '0'),
                        ime: r16(0x04000208),
                    };
                },
            };

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
                // Keep ~90ms of scheduled lead: short leads underrun whenever a
                // rAF tick is late and the result is audible crackle.
                if (audioTime < now + 0.09) audioTime = now + 0.09;
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
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(loop);
                acc += now - last;
                last = now;
                if (acc > 100) acc = 100; // tab was hidden — don't fast-forward
                if (paused) { acc = 0; return; }
                // Transfer watchdog: a reply should arrive within seconds even
                // on a bad link — anything longer means the peer is gone.
                if (pendingVal !== null && now - pendingSince > 10000) linkLost();
                // Lockstep stalls — emulated time freezes instead of letting
                // the games' own link timeouts expire:
                //  - master: don't run frames while a transfer is in flight;
                //  - slave: while the master is actively clocking (an 'x'
                //    arrived recently), never run more than 3 frames past the
                //    master's frame counter. Incoming transfers still complete
                //    from the network callback while stalled.
                if (isHost) {
                    // Self-heal: a transfer cancelled out-of-band (link drop
                    // mid-flight) can leave midFrame latched with nothing
                    // pending in the core — that froze emulation for good.
                    if (midFrame && pendingVal === null && !api.sioTransferPending()) midFrame = false;
                    if (pendingVal !== null || midFrame) { acc = 0; return; }
                } else if (heldX && now - heldXAt > 1000) {
                    // Barrier watchdog: predecessor 'c' never came (seq desync)
                    // — answer anyway rather than deadlock the master.
                    __linkStats.xForced++;
                    const m = heldX;
                    heldX = null;
                    lastCq = (m.q - 1) & 0xFFFF;
                    answerX(m);
                } else if (connected && now - lastXAt < 2000 && frameCount > masterFrame + 3 &&
                           !api.sioQueueCount()) {
                    // Frame-capped to the master — but never stall while
                    // queued transfers still need CPU time to drain.
                    acc = 0;
                    return;
                }
                let ran = false;
                while (acc >= FRAME_MS && !midFrame) {
                    if (advanceFrame()) {
                        acc -= FRAME_MS;
                        ran = true;
                    } else {
                        midFrame = true; // suspended inside a frame, resume on 'r'
                        acc = 0;
                    }
                }
                if (ran) { draw(); pumpAudio(); }
            }
            /* Emulate one frame in runLoop slices. Returns false when the
             * master blocked on a serial transfer mid-frame — the frame is
             * resumed (same function) when the peer's reply arrives. */
            let midFrame = false;
            function advanceFrame() {
                const f0 = api.frameCount();
                let guard = 20000;
                while (api.frameCount() === f0) {
                    api.runLoop();
                    if (isHost && api.sioTransferPending()) return false;
                    if (!--guard) { console.warn('[gba] runLoop guard tripped'); break; }
                }
                frameCount = api.frameCount();
                if (isHost && connected && frameCount % 30 === 0) {
                    try { sendCtl({ t: 'f', n: frameCount }); } catch {}
                }
                traceTick();
                return true;
            }
            /* Per-frame trace of the game's link globals — captures the exact
             * frame where an error bit appears (devtools-only diagnostics). */
            const linkTrace = [];
            function traceTick() {
                try {
                    const L = window.__gbaLink;
                    if (!L) return;
                    const s32 = (L.read16(0x030030E0) | (L.read16(0x030030E2) << 16)) >>> 0;
                    const e = {
                        f: frameCount,
                        st: L.read8(0x03003171),
                        s: '0x' + s32.toString(16),
                        snd: __linkStats.lastSent,
                        rcv: __linkStats.lastRecv,
                    };
                    const p = linkTrace[linkTrace.length - 1];
                    if (!p || p.st !== e.st || p.s !== e.s) {
                        linkTrace.push(e);
                        if (linkTrace.length > 400) linkTrace.shift();
                    }
                } catch {}
            }
            rafId = requestAnimationFrame(loop);
            // Hidden tabs get their rAF throttled to ~1 Hz, which freezes the
            // emulated clock and trips the games' link timeouts. The active
            // AudioContext marks the tab audible, so interval timers keep
            // ticking — use them as the frame driver while hidden.
            const bgTimer = setInterval(() => {
                if (document.hidden) loop(performance.now());
            }, 50);

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
                clearInterval(bgTimer);
                if (sramTimer) { clearInterval(sramTimer); sramTimer = null; }
                document.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('keyup', onKeyUp);
                document.removeEventListener('pointerdown', onClickResume);
                document.removeEventListener('visibilitychange', onVis);
                await flushLinkSram();
                try { if (connected) sendCtl({ t: 'bye' }); } catch {}
                try { await room.leave(); } catch {}
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
