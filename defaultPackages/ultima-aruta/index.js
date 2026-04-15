/* ╔══════════════════════════════════════════════════════════╗
 * ║  ULTIMA ARUTA — isometric emoji world (MVP commit 1)      ║
 * ║  Camera: iso 2:1 diamond tiles. World: seeded procedural  ║
 * ║  via value-noise. Biomes: deep/water/sand/grass/forest/   ║
 * ║  mountain/snow. Player: 🧙 with grid-snap movement.       ║
 * ╚══════════════════════════════════════════════════════════╝ */

// ── Constants ────────────────────────────────────────────
const TILE_W = 64;
const TILE_H = 32;
const CHUNK_SIZE = 32;
const MOVE_MS = 140;

// Biome palette: [topColor, bottomColor, passable]
const BIOMES = {
    deep:     { color1: '#123864', color2: '#0a1e3d', passable: false, name: 'Deep Water' },
    water:    { color1: '#2a7abc', color2: '#1d5a92', passable: false, name: 'Water' },
    sand:     { color1: '#e0cc8a', color2: '#c4ad66', passable: true,  name: 'Beach' },
    grass:    { color1: '#5ca14b', color2: '#427a35', passable: true,  name: 'Plain' },
    forest:   { color1: '#2d6a2a', color2: '#1f4c1c', passable: true,  name: 'Forest' },
    mountain: { color1: '#7a6e5b', color2: '#554b3d', passable: false, name: 'Mountain' },
    snow:     { color1: '#e8e8f0', color2: '#b4b8cc', passable: true,  name: 'Snow' },
};

// Feature emoji per biome (placed sparsely)
const FEATURES = {
    sand:   [{ emoji: '🌴', rate: 0.02 }, { emoji: '🪨', rate: 0.01 }],
    grass:  [{ emoji: '🌳', rate: 0.03 }, { emoji: '🌿', rate: 0.04 }, { emoji: '🌾', rate: 0.02 }, { emoji: '🪨', rate: 0.005 }],
    forest: [{ emoji: '🌲', rate: 0.35 }, { emoji: '🌳', rate: 0.12 }, { emoji: '🍄', rate: 0.01 }, { emoji: '🪨', rate: 0.01 }],
    snow:   [{ emoji: '🌲', rate: 0.06 }, { emoji: '⛄', rate: 0.005 }],
};

// Ambient creatures per biome (as wandering entities, not static features).
// Counts are per-chunk spawn targets.
const CREATURES = {
    grass:  { count: 3, pool: ['🐑', '🐇', '🦊', '🦌'] },
    forest: { count: 4, pool: ['🦌', '🐗', '🦉', '🦝'] },
    sand:   { count: 1, pool: ['🦀', '🦎'] },
    water:  { count: 3, pool: ['🐟', '🐠'] },
    snow:   { count: 1, pool: ['🦌', '🐺'] },
};

// Village building palette.
const VILLAGE = {
    houses:  ['🏠', '🏡', '🛖'],
    centers: ['⛪', '🏛️', '🏰'],
    npcs:    ['🧙', '🧝', '🧑‍🌾', '🧑‍🍳', '⚔️'],
};

// ── Seeded RNG (Mulberry32) ──────────────────────────────
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Deterministic hash-based value noise (fast, good enough for biomes)
function hash2(x, y, seed) {
    let h = x * 374761393 + y * 668265263 + seed * 2147483647;
    h = (h ^ (h >> 13)) * 1274126177;
    h = (h ^ (h >> 16)) >>> 0;
    return h / 4294967295;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise2D(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = x0 + 1, y1 = y0 + 1;
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const n00 = hash2(x0, y0, seed);
    const n10 = hash2(x1, y0, seed);
    const n01 = hash2(x0, y1, seed);
    const n11 = hash2(x1, y1, seed);
    return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
}

// Fractal noise: sum octaves for natural terrain.
function fbm2D(x, y, seed, octaves = 4, persistence = 0.5) {
    let total = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
        total += valueNoise2D(x * freq, y * freq, seed + i * 101) * amp;
        max += amp; amp *= persistence; freq *= 2;
    }
    return total / max;
}

// ── World ────────────────────────────────────────────────
class World {
    constructor(seed) {
        this.seed = seed >>> 0;
        this.chunks = new Map(); // "cx,cy" -> { tiles: Uint8Array(CHUNK_SIZE²), features: Array<{c,r,emoji}>, biomeIds: Uint8Array }
        this._biomeKeys = Object.keys(BIOMES);
    }

    _chunkKey(cx, cy) { return cx + ',' + cy; }

    getChunk(cx, cy) {
        const key = this._chunkKey(cx, cy);
        let ch = this.chunks.get(key);
        if (!ch) { ch = this._generate(cx, cy); this.chunks.set(key, ch); }
        return ch;
    }

    _generate(cx, cy) {
        const N = CHUNK_SIZE;
        const biomes = new Array(N * N);
        const features = [];
        const rnd = mulberry32(this.seed ^ (cx * 73856093) ^ (cy * 19349663));

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const wx = cx * N + c;
                const wy = cy * N + r;
                // Two noise fields: elevation + moisture. Scale is the "zoom".
                const elev = fbm2D(wx / 40, wy / 40, this.seed, 4, 0.5);
                const moist = fbm2D(wx / 60, wy / 60, this.seed + 9999, 3, 0.5);
                const biome = this._classify(elev, moist);
                biomes[r * N + c] = biome;

                // Feature roll
                const feats = FEATURES[biome];
                if (feats) {
                    const roll = rnd();
                    let acc = 0;
                    for (const f of feats) {
                        acc += f.rate;
                        if (roll < acc) { features.push({ c, r, emoji: f.emoji }); break; }
                    }
                }
            }
        }

        // ── Village placement ──────────────────────────────
        // ~8% of chunks get a village. Find the largest flat grass patch
        // around the chunk center; if big enough, carve a small settlement.
        if (rnd() < 0.08) {
            this._maybePlaceVillage(cx, cy, biomes, features, rnd);
        }

        // ── Ambient creatures ──────────────────────────────
        // Creature positions are stored in chunk-local coords; world coord
        // reads add the chunk origin. We also track a per-creature random-
        // walk timer so the AI ticks independently per creature.
        const creatures = [];
        const rule = null; // picked per-cell below via biome
        // Spawn up to N creatures in this chunk based on the dominant biomes.
        const biomeCount = {};
        for (const b of biomes) biomeCount[b] = (biomeCount[b] || 0) + 1;
        for (const [bKey, rule2] of Object.entries(CREATURES)) {
            if ((biomeCount[bKey] || 0) < 20) continue;
            const target = rule2.count;
            let placed = 0, attempts = 0;
            while (placed < target && attempts < 40) {
                attempts++;
                const lc = Math.floor(rnd() * N), lr = Math.floor(rnd() * N);
                if (biomes[lr * N + lc] !== bKey) continue;
                // Don't spawn on a blocking feature tile.
                if (features.find(f => f.c === lc && f.r === lr && f.blocks)) continue;
                const em = rule2.pool[Math.floor(rnd() * rule2.pool.length)];
                creatures.push({
                    c: lc, r: lr,
                    emoji: em,
                    biome: bKey,
                    nextMoveAt: 800 + rnd() * 4000,
                    timer: 0,
                });
                placed++;
            }
        }

        return { cx, cy, biomes, features, creatures };
    }

    /** Try to find a ~5×5 mostly-grass patch near the chunk centre and
     *  stamp a small village (houses around a central landmark) + NPCs. */
    _maybePlaceVillage(cx, cy, biomes, features, rnd) {
        const N = CHUNK_SIZE;
        const centerC = Math.floor(N / 2), centerR = Math.floor(N / 2);
        // Probe offsets spiralling out from centre.
        const probes = [];
        for (let dr = -8; dr <= 8; dr++) for (let dc = -8; dc <= 8; dc++) probes.push([dc, dr]);
        probes.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
        for (const [dc, dr] of probes) {
            const oc = centerC + dc, or = centerR + dr;
            if (oc < 2 || or < 2 || oc > N - 3 || or > N - 3) continue;
            // Check 5×5 area is mostly grass (no mountain/water).
            let grass = 0, bad = 0;
            for (let r = or - 2; r <= or + 2; r++) {
                for (let c = oc - 2; c <= oc + 2; c++) {
                    const b = biomes[r * N + c];
                    if (b === 'grass' || b === 'forest') grass++;
                    else if (!BIOMES[b].passable) bad++;
                }
            }
            if (bad > 0 || grass < 20) continue;

            // Clear any existing features in the 5×5 area so the village
            // gets a clean footprint.
            for (let i = features.length - 1; i >= 0; i--) {
                const f = features[i];
                if (f.c >= oc - 2 && f.c <= oc + 2 && f.r >= or - 2 && f.r <= or + 2) features.splice(i, 1);
            }

            // Landmark at the centre.
            const landmark = VILLAGE.centers[Math.floor(rnd() * VILLAGE.centers.length)];
            features.push({ c: oc, r: or, emoji: landmark, blocks: true, village: true });

            // 4 houses at the cardinal +2 cells (skip diagonals for visibility).
            const houseSpots = [[-2,0],[2,0],[0,-2],[0,2]];
            for (const [hc, hr] of houseSpots) {
                if (rnd() < 0.15) continue; // slight variety
                features.push({ c: oc + hc, r: or + hr, emoji: VILLAGE.houses[Math.floor(rnd() * VILLAGE.houses.length)], blocks: true, village: true });
            }
            // 1-2 NPCs near the centre.
            const npcCount = 1 + Math.floor(rnd() * 2);
            for (let i = 0; i < npcCount; i++) {
                const c = oc + (Math.floor(rnd() * 3) - 1);
                const r = or + 1 + Math.floor(rnd() * 2);
                if (features.find(f => f.c === c && f.r === r)) continue;
                features.push({ c, r, emoji: VILLAGE.npcs[Math.floor(rnd() * VILLAGE.npcs.length)], npc: true });
            }
            return; // stamp one village per chunk
        }
    }

    _classify(elev, moist) {
        if (elev < 0.28) return 'deep';
        if (elev < 0.36) return 'water';
        if (elev < 0.40) return 'sand';
        if (elev > 0.78) return 'snow';
        if (elev > 0.68) return 'mountain';
        if (moist > 0.55 && elev > 0.45) return 'forest';
        return 'grass';
    }

    biomeAt(wx, wy) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cy = Math.floor(wy / CHUNK_SIZE);
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return this.getChunk(cx, cy).biomes[ly * CHUNK_SIZE + lx];
    }

    passable(wx, wy) {
        if (!BIOMES[this.biomeAt(wx, wy)].passable) return false;
        const f = this.featureAt(wx, wy);
        if (f && f.blocks) return false;
        return true;
    }

    featureAt(wx, wy) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cy = Math.floor(wy / CHUNK_SIZE);
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ch = this.getChunk(cx, cy);
        return ch.features.find(f => f.c === lx && f.r === ly) || null;
    }
}

// ── Color helpers ────────────────────────────────────────
function _hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)];
}

// ── Isometric projection ─────────────────────────────────
function iso(wx, wy) {
    return {
        x: (wx - wy) * (TILE_W / 2),
        y: (wx + wy) * (TILE_H / 2),
    };
}

// Given canvas size + player (possibly tweened) world position, compute camera.
function camera(canvasW, canvasH, pwx, pwy) {
    const p = iso(pwx, pwy);
    return { cx: canvasW / 2 - p.x, cy: canvasH / 2 - p.y };
}

// ── Rendering ────────────────────────────────────────────
function drawTile(ctx, sx, sy, biome) {
    const b = BIOMES[biome];
    const hx = TILE_W / 2, hy = TILE_H / 2;
    const g = ctx.createLinearGradient(sx, sy, sx, sy + TILE_H);
    g.addColorStop(0, b.color1); g.addColorStop(1, b.color2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx + hx, sy);
    ctx.lineTo(sx + TILE_W, sy + hy);
    ctx.lineTo(sx + hx, sy + TILE_H);
    ctx.lineTo(sx, sy + hy);
    ctx.closePath();
    ctx.fill();
    // Subtle edge shading for depth.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawEmoji(ctx, sx, sy, emoji, size = 28) {
    ctx.font = size + "px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Place the emoji so its "feet" sit near the tile center, slightly up for perspective.
    ctx.fillText(emoji, sx + TILE_W / 2, sy + TILE_H + 2);
}

// ── Player ───────────────────────────────────────────────
class Player {
    constructor(wx, wy) {
        this.wx = wx; this.wy = wy;         // integer world cell
        this.rx = wx; this.ry = wy;         // rendered position (tweened)
        this.moveT = 0;                      // ms remaining in current tween
        this.moveFrom = { wx, wy };
        this.emoji = '🧙';
    }
    tryMove(dx, dy, world) {
        if (this.moveT > 0) return false;
        const nx = this.wx + dx, ny = this.wy + dy;
        if (!world.passable(nx, ny)) return false;
        this.moveFrom = { wx: this.wx, wy: this.wy };
        this.wx = nx; this.wy = ny;
        this.moveT = MOVE_MS;
        return true;
    }
    update(dt) {
        if (this.moveT > 0) {
            this.moveT = Math.max(0, this.moveT - dt);
            const t = 1 - (this.moveT / MOVE_MS);
            this.rx = this.moveFrom.wx + (this.wx - this.moveFrom.wx) * t;
            this.ry = this.moveFrom.wy + (this.wy - this.moveFrom.wy) * t;
        } else {
            this.rx = this.wx; this.ry = this.wy;
        }
    }
}

// ── Mount ────────────────────────────────────────────────
export default {
    async mount(root, sdk) {
        // ── Save/load ────────────────────────────────────
        let saved = null;
        try { saved = await sdk.storage.get('state'); } catch {}
        const seed = (saved && Number.isFinite(saved.seed)) ? saved.seed : (Math.random() * 0xffffffff) >>> 0;
        const world = new World(seed);

        // Find a walkable starting cell near (0,0) if the seed gave water.
        let startX = saved?.px ?? 0, startY = saved?.py ?? 0;
        if (!saved) {
            for (let r = 0; r < 200 && !world.passable(startX, startY); r++) {
                const ang = r * 0.618;
                const rad = Math.floor(1 + r * 0.6);
                startX = Math.round(Math.cos(ang) * rad);
                startY = Math.round(Math.sin(ang) * rad);
            }
        }
        const player = new Player(startX, startY);

        // ── DOM ──────────────────────────────────────────
        root.innerHTML = `
            <div class="ua-shell">
                <canvas class="ua-canvas" id="ua-canvas"></canvas>
                <canvas class="ua-minimap" id="ua-minimap" width="140" height="140"></canvas>
                <div class="ua-hud" id="ua-hud"></div>
                <div class="ua-help">Arrows / WASD to move · Seed <b>${seed}</b></div>
            </div>
        `;
        const canvas = root.querySelector('#ua-canvas');
        const ctx = canvas.getContext('2d');
        const $hud = root.querySelector('#ua-hud');

        function resize() {
            const r = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width  = Math.max(320, Math.floor(r.width  * dpr));
            canvas.height = Math.max(240, Math.floor(r.height * dpr));
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

        // ── Input: grid-snap with auto-repeat ────────────
        const held = new Set();
        function onKey(e) {
            const k = e.key.toLowerCase();
            const MAP = { arrowup:'n', w:'n', arrowdown:'s', s:'s', arrowleft:'w', a:'w', arrowright:'e', d:'e' };
            const dir = MAP[k];
            if (!dir) return;
            e.preventDefault();
            if (e.type === 'keydown') held.add(dir); else held.delete(dir);
        }
        document.addEventListener('keydown', onKey);
        document.addEventListener('keyup', onKey);

        // ── Game loop ────────────────────────────────────
        let last = performance.now();
        let rafId = 0;
        let saveTimer = 0;

        function tryStepFromHeld() {
            if (player.moveT > 0) return;
            // Movement maps: north = decrease y, south = +y, east = +x, west = -x
            // In isometric with our formulas, "up" on screen corresponds to decreasing (x+y).
            let dx = 0, dy = 0;
            if (held.has('n')) { dx -= 1; dy -= 1; }
            if (held.has('s')) { dx += 1; dy += 1; }
            if (held.has('e')) { dx += 1; dy -= 1; }
            if (held.has('w')) { dx -= 1; dy += 1; }
            // Normalize to one cardinal step (prefer axis-aligned).
            if (dx !== 0 && dy !== 0) {
                // Combine produced diagonal in world-space. That's fine — we allow diagonals.
            }
            if (dx || dy) player.tryMove(Math.sign(dx), Math.sign(dy), world);
        }

        function render() {
            const W = canvas.width  / (window.devicePixelRatio || 1);
            const H = canvas.height / (window.devicePixelRatio || 1);
            ctx.clearRect(0, 0, W, H);

            const cam = camera(W, H, player.rx, player.ry);

            // Determine visible world-cell range.
            // Convert screen corners to world coords (approx): invert iso projection.
            // For a tile at (wx, wy): sx = (wx-wy)*TW/2 + cam.cx; sy = (wx+wy)*TH/2 + cam.cy
            // So: wx + wy = (sy - cam.cy) * 2 / TH;  wx - wy = (sx - cam.cx) * 2 / TW
            function screenToWorld(sx, sy) {
                const a = (sy - cam.cy) * 2 / TILE_H;
                const b = (sx - cam.cx) * 2 / TILE_W;
                return { wx: Math.floor((a + b) / 2), wy: Math.floor((a - b) / 2) };
            }
            const tl = screenToWorld(-TILE_W, -TILE_H);
            const tr = screenToWorld(W + TILE_W, -TILE_H);
            const bl = screenToWorld(-TILE_W, H + TILE_H);
            const br = screenToWorld(W + TILE_W, H + TILE_H);
            const minX = Math.min(tl.wx, tr.wx, bl.wx, br.wx) - 1;
            const maxX = Math.max(tl.wx, tr.wx, bl.wx, br.wx) + 1;
            const minY = Math.min(tl.wy, tr.wy, bl.wy, br.wy) - 1;
            const maxY = Math.max(tl.wy, tr.wy, bl.wy, br.wy) + 1;

            // PASS 1 — tiles (front-to-back by wx+wy ascending). Group by chunk
            // so each cell only needs one biome lookup.
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const p = iso(x, y);
                    const sx = p.x + cam.cx - TILE_W / 2;
                    const sy = p.y + cam.cy;
                    drawTile(ctx, sx, sy, world.biomeAt(x, y));
                }
            }

            // PASS 2 — features + player, depth-sorted by wx+wy then wx.
            const SIZES = {
                '🌲': 40, '🌳': 40, '🌴': 38,
                '🪨': 18, '🌿': 18, '🌾': 20, '🍄': 16,
                '⛄': 28,
                // Structures
                '⛪': 48, '🏛️': 50, '🏰': 52,
                '🏠': 42, '🏡': 42, '🛖': 40,
                // Creatures
                '🐑': 22, '🐇': 18, '🦊': 22, '🦌': 26, '🐗': 24, '🦉': 18, '🦝': 22,
                '🦀': 18, '🦎': 18, '🐟': 20, '🐠': 20, '🐺': 24,
                // NPCs
                '🧙': 30, '🧝': 28, '🧑‍🌾': 28, '🧑‍🍳': 28, '⚔️': 26,
            };
            const sprites = [];
            // Visible chunks for creature sampling.
            const seenChunks = new Set();
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const f = world.featureAt(x, y);
                    if (f) sprites.push({ wx: x, wy: y, emoji: f.emoji, size: SIZES[f.emoji] || 26 });
                    const ccx = Math.floor(x / CHUNK_SIZE), ccy = Math.floor(y / CHUNK_SIZE);
                    seenChunks.add(ccx + ',' + ccy);
                }
            }
            // Draw creatures from visible chunks.
            for (const key of seenChunks) {
                const [ccx, ccy] = key.split(',').map(Number);
                const ch = world.getChunk(ccx, ccy);
                for (const cr of ch.creatures) {
                    const wx = ccx * CHUNK_SIZE + cr.c;
                    const wy = ccy * CHUNK_SIZE + cr.r;
                    if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;
                    sprites.push({ wx, wy, emoji: cr.emoji, size: SIZES[cr.emoji] || 22 });
                }
            }
            sprites.push({ wx: player.rx, wy: player.ry, emoji: player.emoji, size: 32, isPlayer: true });
            sprites.sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy) || a.wx - b.wx);
            for (const s of sprites) {
                const p = iso(s.wx, s.wy);
                drawEmoji(ctx, p.x + cam.cx - TILE_W / 2, p.y + cam.cy, s.emoji, s.size);
            }
        }

        // ── Minimap ────────────────────────────────────────
        const $mini = root.querySelector('#ua-minimap');
        const miniCtx = $mini.getContext('2d');
        const MINI_RADIUS = 70; // cells per half-axis → 140×140 total
        let miniElapsed = 0;
        function renderMinimap() {
            miniElapsed += 16; // coarse throttle; function called once per frame
            if (miniElapsed < 250) return;
            miniElapsed = 0;
            miniCtx.fillStyle = '#0a0d18';
            miniCtx.fillRect(0, 0, 140, 140);
            const img = miniCtx.getImageData(0, 0, 140, 140);
            const data = img.data;
            const pw = player.wx, pyw = player.wy;
            for (let py = 0; py < 140; py++) {
                for (let px = 0; px < 140; px++) {
                    const wx = pw + (px - 70);
                    const wy = pyw + (py - 70);
                    const b = BIOMES[world.biomeAt(wx, wy)];
                    const rgb = _hexToRgb(b.color1);
                    const i = (py * 140 + px) * 4;
                    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
                }
            }
            miniCtx.putImageData(img, 0, 0);
            // Player dot.
            miniCtx.fillStyle = '#ffc857';
            miniCtx.fillRect(69, 69, 3, 3);
            miniCtx.strokeStyle = 'rgba(0,0,0,0.6)';
            miniCtx.strokeRect(68.5, 68.5, 4, 4);
        }

        function updateHUD() {
            const biome = BIOMES[world.biomeAt(player.wx, player.wy)].name;
            $hud.innerHTML = `📍 <b>${player.wx}, ${player.wy}</b> · ${biome}`;
        }

        function tickCreatures(dt) {
            // Wander creatures only in chunks near the player (keeps cost low).
            const cx0 = Math.floor(player.wx / CHUNK_SIZE), cy0 = Math.floor(player.wy / CHUNK_SIZE);
            for (let dcy = -1; dcy <= 1; dcy++) {
                for (let dcx = -1; dcx <= 1; dcx++) {
                    const ch = world.chunks.get((cx0 + dcx) + ',' + (cy0 + dcy));
                    if (!ch) continue;
                    for (const cr of ch.creatures) {
                        cr.timer += dt;
                        if (cr.timer < cr.nextMoveAt) continue;
                        cr.timer = 0;
                        cr.nextMoveAt = 1200 + Math.random() * 3500;
                        // Try random cardinal step.
                        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
                        const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
                        const nc = cr.c + dx, nr = cr.r + dy;
                        if (nc < 0 || nc >= CHUNK_SIZE || nr < 0 || nr >= CHUNK_SIZE) continue;
                        if (ch.biomes[nr * CHUNK_SIZE + nc] !== cr.biome) continue;
                        // Don't step onto blocking features.
                        if (ch.features.find(f => f.c === nc && f.r === nr && f.blocks)) continue;
                        cr.c = nc; cr.r = nr;
                    }
                }
            }
        }

        function loop(now) {
            const dt = Math.min(50, now - last); last = now;
            tryStepFromHeld();
            player.update(dt);
            tickCreatures(dt);
            render();
            updateHUD();
            renderMinimap();

            // Save every ~2s.
            saveTimer += dt;
            if (saveTimer > 2000) {
                saveTimer = 0;
                sdk.storage.set('state', { seed, px: player.wx, py: player.wy }).catch(() => {});
            }

            rafId = requestAnimationFrame(loop);
        }
        rafId = requestAnimationFrame(loop);

        // ── Cleanup ──────────────────────────────────────
        root.__uaCleanup = () => {
            cancelAnimationFrame(rafId);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('keyup', onKey);
            try { ro.disconnect(); } catch {}
        };
    },

    async unmount(root) {
        try { root.__uaCleanup?.(); } catch {}
        delete root.__uaCleanup;
    }
};
