/* ╔══════════════════════════════════════════════════════════╗
 * ║  ULTIMA ARUTA — isometric emoji RPG                       ║
 * ║                                                            ║
 * ║  Structure (single file for blob-URL compatibility):       ║
 * ║    §1 DATA      — constants, biomes, items, creatures      ║
 * ║    §2 ENGINE    — noise, World, dungeon, rendering, SFX    ║
 * ║    §3 PLAYER    — Player class, stats, movement            ║
 * ║    §4 UI        — world-select, backpack, paperdoll, shop  ║
 * ║    §5 GAME LOOP — mount, combat, creature AI, input        ║
 * ╚══════════════════════════════════════════════════════════╝ */

/* ╔══════════════════════════════════════════════════════════╗
 * ║  ULTIMA ARUTA — data.js                                    ║
 * ║  All game constants, item/creature/biome definitions.      ║
 * ║  Pure data — no logic, no side effects.                    ║
 * ╚══════════════════════════════════════════════════════════╝ */

const TILE_W = 48;
const TILE_H = 24;
const CHUNK_SIZE = 32;
const MOVE_MS = 440;
const CREATURE_MOVE_MS = 600;
const DAY_MS = 5 * 60 * 1000;
const ELEV_PX = 18;
const PERSP_STRENGTH = 0.65;
const DUNGEON_SIZE = 24;
const SELL_RATIO = 0.3;

const BIOMES = {
    deep:     { color1: '#123864', color2: '#0a1e3d', passable: false, name: 'Deep Water' },
    water:    { color1: '#2a7abc', color2: '#1d5a92', passable: false, name: 'Water' },
    sand:     { color1: '#e0cc8a', color2: '#c4ad66', passable: true,  name: 'Beach' },
    grass:    { color1: '#5ca14b', color2: '#427a35', passable: true,  name: 'Plain' },
    forest:   { color1: '#2d6a2a', color2: '#1f4c1c', passable: true,  name: 'Forest' },
    mountain: { color1: '#7a6e5b', color2: '#554b3d', passable: false, name: 'Mountain' },
    snow:     { color1: '#e8e8f0', color2: '#b4b8cc', passable: true,  name: 'Snow' },
};

const DUNGEON_BIOMES = {
    cave_floor: { color1: '#3a3040', color2: '#28202a', passable: true,  name: 'Cave' },
    cave_wall:  { color1: '#1a1418', color2: '#0e0a10', passable: false, name: 'Wall' },
    lava:       { color1: '#a03010', color2: '#601808', passable: false, name: 'Lava' },
    exit:       { color1: '#406040', color2: '#304830', passable: true,  name: 'Exit' },
};

const ALL_BIOMES = { ...BIOMES, ...DUNGEON_BIOMES };

const FEATURES = {
    sand:   [{ emoji: '🌴', rate: 0.02 }, { emoji: '🪨', rate: 0.01 }],
    grass:  [{ emoji: '🌳', rate: 0.03 }, { emoji: '🌿', rate: 0.04 }, { emoji: '🌾', rate: 0.02 }, { emoji: '🪨', rate: 0.005 }],
    forest: [{ emoji: '🌲', rate: 0.35 }, { emoji: '🌳', rate: 0.12 }, { emoji: '🍄', rate: 0.01 }, { emoji: '🪨', rate: 0.01 }],
    snow:   [{ emoji: '🌲', rate: 0.06 }, { emoji: '⛄', rate: 0.005 }],
};

const CREATURE_DEFS = {
    '🐑': { ai: 'passive', hp: 10, dmg: 0, xp: 2, loot: [{ key: 'herb', rate: 0.4 }] },
    '🐇': { ai: 'passive', hp: 8,  dmg: 0, xp: 1, loot: [{ key: 'berry', rate: 0.5 }] },
    '🦌': { ai: 'passive', hp: 18, dmg: 0, xp: 3, loot: [{ key: 'herb', rate: 0.3 }, { key: 'apple', rate: 0.2 }] },
    '🐟': { ai: 'passive', hp: 6,  dmg: 0, xp: 1, loot: [] },
    '🐠': { ai: 'passive', hp: 6,  dmg: 0, xp: 1, loot: [] },
    '🦊': { ai: 'neutral',  hp: 20, dmg: 4, xp: 5, loot: [{ key: 'gold', rate: 0.3 }] },
    '🦉': { ai: 'neutral',  hp: 14, dmg: 3, xp: 3, loot: [{ key: 'scroll', rate: 0.15 }] },
    '🦝': { ai: 'neutral',  hp: 16, dmg: 3, xp: 4, loot: [{ key: 'gold', rate: 0.2 }] },
    '🦀': { ai: 'neutral',  hp: 12, dmg: 2, xp: 2, loot: [{ key: 'stone', rate: 0.3 }] },
    '🦎': { ai: 'neutral',  hp: 10, dmg: 2, xp: 2, loot: [{ key: 'gem', rate: 0.1 }] },
    '🐗': { ai: 'aggressive', hp: 35, dmg: 7, xp: 10, loot: [{ key: 'gold', rate: 0.5 }, { key: 'potion', rate: 0.2 }] },
    '🐺': { ai: 'aggressive', hp: 40, dmg: 8, xp: 12, loot: [{ key: 'gold', rate: 0.4 }, { key: 'dagger', rate: 0.08 }] },
    '💀': { ai: 'aggressive', hp: 45, dmg: 10, xp: 15, loot: [{ key: 'gold', rate: 0.6 }, { key: 'sword', rate: 0.1 }] },
    '👻': { ai: 'aggressive', hp: 35, dmg: 8,  xp: 12, loot: [{ key: 'scroll', rate: 0.3 }, { key: 'gem', rate: 0.15 }] },
    '🦇': { ai: 'aggressive', hp: 20, dmg: 5,  xp: 6,  loot: [{ key: 'herb', rate: 0.4 }] },
    '🕷️': { ai: 'aggressive', hp: 30, dmg: 7,  xp: 10, loot: [{ key: 'potion', rate: 0.2 }, { key: 'gold', rate: 0.4 }] },
    '🐻': { ai: 'neutral',    hp: 50, dmg: 9,  xp: 14, loot: [{ key: 'herb', rate: 0.4 }, { key: 'gold', rate: 0.3 }] },
    '🐍': { ai: 'aggressive', hp: 22, dmg: 6,  xp: 7,  loot: [{ key: 'potion', rate: 0.15 }] },
    '🐉': { ai: 'aggressive', hp: 120, dmg: 18, xp: 50, loot: [{ key: 'gem', rate: 0.8 }, { key: 'crown', rate: 0.2 }, { key: 'spellbook', rate: 0.15 }] },
};

const CREATURES = {
    grass:  { count: 3, pool: ['🐑', '🐇', '🦊', '🦌'] },
    forest: { count: 4, pool: ['🦌', '🐗', '🦉', '🦝', '🐻', '🐍'] },
    sand:   { count: 1, pool: ['🦀', '🦎'] },
    water:  { count: 3, pool: ['🐟', '🐠'] },
    snow:   { count: 1, pool: ['🦌', '🐺', '🐻'] },
    mountain: { count: 1, pool: ['🐉'] },
};

const DUNGEON_CREATURES = [
    { emoji: '💀', ai: 'aggressive', hp: 45, dmg: 10, xp: 15, loot: [{ key: 'gold', rate: 0.6 }, { key: 'sword', rate: 0.1 }] },
    { emoji: '👻', ai: 'aggressive', hp: 35, dmg: 8,  xp: 12, loot: [{ key: 'scroll', rate: 0.3 }, { key: 'gem', rate: 0.15 }] },
    { emoji: '🦇', ai: 'aggressive', hp: 20, dmg: 5,  xp: 6,  loot: [{ key: 'herb', rate: 0.4 }] },
    { emoji: '🕷️', ai: 'aggressive', hp: 30, dmg: 7,  xp: 10, loot: [{ key: 'potion', rate: 0.2 }, { key: 'gold', rate: 0.4 }] },
];

const VILLAGE = {
    houses:  ['🏠', '🏡', '🛖'],
    centers: ['⛪', '🏛️', '🏰'],
    npcs:    ['🧙', '🧝', '🧑‍🌾', '🧑‍🍳', '⚔️'],
};

const ITEMS = {
    gold:     { emoji: '🪙', name: 'Gold Coin' },
    gem:      { emoji: '💎', name: 'Gem' },
    berry:    { emoji: '🍓', name: 'Wild Berry',  use: { hp: 8, stamina: 10 } },
    mushroom: { emoji: '🍄', name: 'Mushroom',    use: { hp: 5, mana: 8 } },
    stone:    { emoji: '🪨', name: 'Stone' },
    flower:   { emoji: '🌸', name: 'Flower' },
    apple:    { emoji: '🍎', name: 'Apple',       use: { hp: 12, stamina: 15 } },
    herb:     { emoji: '🌿', name: 'Herb',        use: { hp: 6, mana: 5 } },
    key:      { emoji: '🗝️', name: 'Old Key' },
    potion:   { emoji: '🧪', name: 'Potion',      use: { hp: 30, mana: 20 } },
    scroll:   { emoji: '📜', name: 'Scroll',      use: { mana: 25 } },
    sword:    { emoji: '⚔️', name: 'Shortsword',   slot: 'weapon' },
    axe:      { emoji: '🪓', name: 'Hand Axe',      slot: 'weapon' },
    bow:      { emoji: '🏹', name: 'Hunter Bow',    slot: 'weapon' },
    dagger:   { emoji: '🗡️', name: 'Dagger',       slot: 'weapon' },
    shield:   { emoji: '🛡️', name: 'Round Shield', slot: 'shield' },
    helm:     { emoji: '⛑️', name: 'Iron Helm',    slot: 'head' },
    crown:    { emoji: '👑', name: 'Crown',         slot: 'head' },
    hat:      { emoji: '🎩', name: 'Mage Hat',      slot: 'head' },
    armor:    { emoji: '🦺', name: 'Cuirass',       slot: 'chest' },
    robe:     { emoji: '🥼', name: 'Robe',          slot: 'chest' },
    gloves:   { emoji: '🧤', name: 'Gloves',        slot: 'hands' },
    boots:    { emoji: '🥾', name: 'Boots',         slot: 'feet' },
    sandals:  { emoji: '👡', name: 'Sandals',       slot: 'feet' },
    cape:     { emoji: '🧣', name: 'Cape',          slot: 'cape' },
    necklace: { emoji: '📿', name: 'Necklace',      slot: 'neck' },
    ring:     { emoji: '💍', name: 'Ring',          slot: 'ring' },
    spellbook:{ emoji: '📖', name: 'Spellbook',     slot: 'book' },
};

const ITEM_DROPS = {
    grass:  [
        { key: 'flower', rate: 0.01 }, { key: 'berry', rate: 0.006 }, { key: 'gold', rate: 0.002 },
        { key: 'sword', rate: 0.0008 }, { key: 'dagger', rate: 0.0008 }, { key: 'shield', rate: 0.0006 },
        { key: 'robe', rate: 0.0005 }, { key: 'ring', rate: 0.0003 },
    ],
    forest: [
        { key: 'mushroom', rate: 0.008 }, { key: 'herb', rate: 0.006 }, { key: 'apple', rate: 0.003 },
        { key: 'bow', rate: 0.0008 }, { key: 'axe', rate: 0.0006 }, { key: 'cape', rate: 0.0005 },
        { key: 'spellbook', rate: 0.0005 }, { key: 'hat', rate: 0.0003 },
    ],
    sand:   [
        { key: 'stone', rate: 0.004 }, { key: 'gem', rate: 0.001 },
        { key: 'sandals', rate: 0.0006 }, { key: 'necklace', rate: 0.0004 }, { key: 'crown', rate: 0.00015 },
    ],
    snow:   [
        { key: 'stone', rate: 0.003 }, { key: 'gem', rate: 0.001 },
        { key: 'boots', rate: 0.0007 }, { key: 'helm', rate: 0.0005 }, { key: 'gloves', rate: 0.0005 },
        { key: 'armor', rate: 0.0003 },
    ],
};

const MERCHANT_STOCK = [
    { key: 'potion',    price: 15 }, { key: 'scroll',    price: 12 },
    { key: 'berry',     price: 3 },  { key: 'apple',     price: 5 },
    { key: 'herb',      price: 4 },  { key: 'sword',     price: 40 },
    { key: 'shield',    price: 35 }, { key: 'helm',      price: 30 },
    { key: 'armor',     price: 50 }, { key: 'boots',     price: 20 },
    { key: 'bow',       price: 45 }, { key: 'ring',      price: 25 },
    { key: 'spellbook', price: 55 },
];

const RECIPES = [
    { name: 'Potion',        inputs: ['herb', 'mushroom'],       output: 'potion' },
    { name: 'Strong Potion', inputs: ['herb', 'herb', 'berry'],  output: 'potion' },
    { name: 'Scroll',        inputs: ['flower', 'herb'],         output: 'scroll' },
    { name: 'Ring',          inputs: ['gem', 'gold'],            output: 'ring' },
    { name: 'Necklace',      inputs: ['gem', 'gem', 'gold'],    output: 'necklace' },
    { name: 'Dagger',        inputs: ['stone', 'stone'],         output: 'dagger' },
    { name: 'Axe',           inputs: ['stone', 'stone', 'herb'], output: 'axe' },
];

const SLOTS = [
    { key: 'head',   label: '⛑️ Head'   }, { key: 'neck',   label: '📿 Neck'   },
    { key: 'cape',   label: '🧣 Cape'   }, { key: 'chest',  label: '🦺 Chest'  },
    { key: 'hands',  label: '🧤 Hands'  }, { key: 'ring',   label: '💍 Ring'   },
    { key: 'weapon', label: '⚔️ Weapon' }, { key: 'shield', label: '🛡️ Shield'},
    { key: 'feet',   label: '🥾 Feet'   }, { key: 'book',   label: '📖 Book'   },
];

const DIALOGS = [
    'Hail, wanderer. Safe travels beyond these walls.',
    'Have ye seen the shadows grow longer at dusk?',
    'The smith needs iron. Bring some if ye find any.',
    "The forest whispers of old ruins eastward.",
    'Gold buys bread; courage buys tales.',
    'Stay out of the deep caves. Nothing good lives there.',
    'A traveller once told me the sea hides an island of spires.',
    'Do not trust mushrooms that glow.',
    'At night the fae dance in forest clearings.',
    'I dreamt of a dragon last night. Wasn\'t friendly.',
];

// Sprite sizes by emoji — used by the renderer.
const SPRITE_SIZES = {
    '🌲': 46, '🌳': 46, '🌴': 42,
    '🪨': 14, '🌿': 14, '🌾': 16, '🍄': 14, '⛄': 24,
    '⛪': 44, '🏛️': 44, '🏰': 46, '🏠': 38, '🏡': 38, '🛖': 36,
    '🐑': 22, '🐇': 18, '🦊': 22, '🦌': 26, '🐗': 24, '🦉': 18, '🦝': 22,
    '🦀': 18, '🦎': 18, '🐟': 20, '🐠': 20, '🐺': 24,
    '🧙': 28, '🧝': 26, '🧑‍🌾': 26, '🧑‍🍳': 26, '🧑‍💼': 28,
    '🪙': 12, '💎': 14, '🍓': 12, '🍎': 14, '🌸': 12,
    '🗝️': 14, '🧪': 14, '📜': 14,
    '⚔️': 20, '🪓': 20, '🏹': 22, '🗡️': 18, '🛡️': 22,
    '⛑️': 20, '👑': 18, '🎩': 20, '🦺': 22, '🥼': 22,
    '🧤': 16, '🥾': 18, '👡': 16, '🧣': 18, '📿': 16,
    '💍': 12, '📖': 20,
    '🕳️': 32, '🏚️': 38, '🪜': 30, '🧰': 24,
    '💀': 26, '👻': 24, '🦇': 20, '🕷️': 22,
    '🐻': 28, '🐍': 20, '🐉': 42,
};
/* ╔══════════════════════════════════════════════════════════╗
 * ║  ULTIMA ARUTA — engine.js                                  ║
 * ║  Noise, World class, dungeon gen, rendering, iso math,     ║
 * ║  day/night, fog-of-war, SFX, floaters, stars.              ║
 * ║  Call setup(dataModule) before using — sets constant refs.  ║
 * ╚══════════════════════════════════════════════════════════╝ */



function generateDungeon(dungeonId) {
    const rnd = mulberry32(dungeonId);
    const N = DUNGEON_SIZE;
    const biomes = new Array(N * N).fill('cave_wall');
    const elevations = new Float32Array(N * N).fill(0.5);
    const features = [];
    const creatures = [];

    // Carve rooms + corridors.
    const rooms = [];
    for (let i = 0; i < 6; i++) {
        const rw = 3 + Math.floor(rnd() * 4);
        const rh = 3 + Math.floor(rnd() * 4);
        const rx = 1 + Math.floor(rnd() * (N - rw - 2));
        const ry = 1 + Math.floor(rnd() * (N - rh - 2));
        rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
        for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) biomes[y * N + x] = 'cave_floor';
    }
    for (let i = 1; i < rooms.length; i++) {
        let cx = rooms[i - 1].cx, cy = rooms[i - 1].cy;
        const tx = rooms[i].cx, ty = rooms[i].cy;
        while (cx !== tx) { biomes[cy * N + cx] = 'cave_floor'; cx += Math.sign(tx - cx); }
        while (cy !== ty) { biomes[cy * N + cx] = 'cave_floor'; cy += Math.sign(ty - cy); }
    }
    const exitRoom = rooms[0];
    biomes[exitRoom.cy * N + exitRoom.cx] = 'exit';
    features.push({ c: exitRoom.cx, r: exitRoom.cy, emoji: '🪜', isExit: true });
    const lastRoom = rooms[rooms.length - 1];
    for (let i = 0; i < 4; i++) {
        const lx = lastRoom.x + Math.floor(rnd() * lastRoom.w);
        const ly = lastRoom.y + Math.floor(rnd() * lastRoom.h);
        if (biomes[ly * N + lx] === 'cave_floor') biomes[ly * N + lx] = 'lava';
    }
    for (let i = 1; i < rooms.length; i++) {
        if (rnd() < 0.5) {
            const tc = rooms[i].x + Math.floor(rnd() * rooms[i].w);
            const tr = rooms[i].y + Math.floor(rnd() * rooms[i].h);
            if (biomes[tr * N + tc] === 'cave_floor' && !features.find(f => f.c === tc && f.r === tr)) {
                const pool = ['gold', 'gold', 'gold', 'gem', 'potion', 'sword', 'shield', 'helm', 'armor', 'spellbook'];
                features.push({ c: tc, r: tr, emoji: '🧰', item: true, itemKey: pool[Math.floor(rnd() * pool.length)], chest: true });
            }
        }
    }
    for (let i = 1; i < rooms.length; i++) {
        const count = 1 + Math.floor(rnd() * 3);
        for (let j = 0; j < count; j++) {
            const cc = rooms[i].x + Math.floor(rnd() * rooms[i].w);
            const cr2 = rooms[i].y + Math.floor(rnd() * rooms[i].h);
            if (biomes[cr2 * N + cc] !== 'cave_floor') continue;
            const def = DUNGEON_CREATURES[Math.floor(rnd() * DUNGEON_CREATURES.length)];
            creatures.push({
                c: cc, r: cr2, rc: cc, rr: cr2, fromC: cc, fromR: cr2, moveT: 0,
                emoji: def.emoji, biome: 'cave_floor',
                nextMoveAt: 800 + rnd() * 3000, timer: 0,
                hp: def.hp, maxHp: def.hp, ai: def.ai, dmg: def.dmg,
                attackCooldown: 0, dead: false,
            });
        }
    }
    return { biomes, elevations, features, creatures, N, spawnX: exitRoom.cx, spawnY: exitRoom.cy };
}

// ── Seeded RNG (Mulberry32) ───────────���──────────���───────
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
        const elevations = new Float32Array(N * N);
        const features = [];
        const rnd = mulberry32(this.seed ^ (cx * 73856093) ^ (cy * 19349663));

        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                const wx = cx * N + c;
                const wy = cy * N + r;
                // Two noise fields: elevation + moisture.
                // Large-scale continental shelf (low freq) + local detail (high freq).
                const continental = fbm2D(wx / 200, wy / 200, this.seed + 777, 2, 0.5);
                const detail      = fbm2D(wx / 50,  wy / 50,  this.seed, 4, 0.5);
                const elev = continental * 0.6 + detail * 0.4;
                const moist = fbm2D(wx / 120, wy / 120, this.seed + 9999, 3, 0.5);
                const biome = this._classify(elev, moist);
                biomes[r * N + c] = biome;
                elevations[r * N + c] = elev;

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

                // Loose item scatter — independent of the scenic feature roll.
                const drops = ITEM_DROPS[biome];
                if (drops && BIOMES[biome].passable) {
                    const roll = rnd();
                    let acc = 0;
                    for (const d of drops) {
                        acc += d.rate;
                        if (roll < acc) {
                            features.push({ c, r, emoji: ITEMS[d.key].emoji, item: true, itemKey: d.key });
                            break;
                        }
                    }
                }
            }
        }

        // ── Village placement ──────────────────────────────
        // ~8% of chunks get a village. Find the largest flat grass patch
        // around the chunk center; if big enough, carve a small settlement.
        if (rnd() < 0.14) {
            this._maybePlaceVillage(cx, cy, biomes, features, rnd);
        }

        // ── Dungeon entrance placement ─────────────────────
        // ~3% of chunks get a dungeon — a cave mouth on mountain-adjacent
        // grass/forest, or a ruined arch on any forest cell.
        if (rnd() < 0.03) {
            for (let attempts = 0; attempts < 20; attempts++) {
                const lc = Math.floor(rnd() * CHUNK_SIZE);
                const lr = Math.floor(rnd() * CHUNK_SIZE);
                const b = biomes[lr * CHUNK_SIZE + lc];
                if (b !== 'grass' && b !== 'forest' && b !== 'sand') continue;
                if (features.find(f => f.c === lc && f.r === lr)) continue;
                const emoji = rnd() < 0.5 ? '🕳️' : '🏚️';
                features.push({ c: lc, r: lr, emoji, dungeon: true, dungeonId: (this.seed ^ (cx * 31) ^ (cy * 17) ^ lc ^ lr * 911) >>> 0 });
                break;
            }
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
                const def = CREATURE_DEFS[em] || { ai: 'neutral', hp: 10, dmg: 2, xp: 1, loot: [] };
                creatures.push({
                    c: lc, r: lr,
                    rc: lc, rr: lr,
                    fromC: lc, fromR: lr,
                    moveT: 0,
                    emoji: em,
                    biome: bKey,
                    nextMoveAt: 800 + rnd() * 4000,
                    timer: 0,
                    hp: def.hp, maxHp: def.hp,
                    ai: def.ai, dmg: def.dmg,
                    attackCooldown: 0,
                    dead: false,
                });
                placed++;
            }
        }

        return { cx, cy, biomes, elevations, features, creatures };
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

            // Pave the village area with sand (dirt paths).
            for (let pr = or - 1; pr <= or + 1; pr++) {
                for (let pc = oc - 1; pc <= oc + 1; pc++) {
                    if (pr >= 0 && pr < N && pc >= 0 && pc < N) biomes[pr * N + pc] = 'sand';
                }
            }
            // Cross paths to houses.
            for (const [hc, hr] of [[-2,0],[2,0],[0,-2],[0,2]]) {
                const pc = oc + hc, pr2 = or + hr;
                if (pc >= 0 && pc < N && pr2 >= 0 && pr2 < N) biomes[pr2 * N + pc] = 'sand';
                const mc = oc + Math.sign(hc), mr = or + Math.sign(hr);
                if (mc >= 0 && mc < N && mr >= 0 && mr < N) biomes[mr * N + mc] = 'sand';
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
            // 1-2 dialog NPCs near the centre.
            const npcCount = 1 + Math.floor(rnd() * 2);
            for (let i = 0; i < npcCount; i++) {
                const c = oc + (Math.floor(rnd() * 3) - 1);
                const r = or + 1 + Math.floor(rnd() * 2);
                if (features.find(f => f.c === c && f.r === r)) continue;
                features.push({
                    c, r,
                    emoji: VILLAGE.npcs[Math.floor(rnd() * VILLAGE.npcs.length)],
                    npc: true,
                    dialog: DIALOGS[Math.floor(rnd() * DIALOGS.length)],
                });
            }
            // 1 merchant per village (always present).
            const mc = oc + 1, mr = or - 1;
            if (!features.find(f => f.c === mc && f.r === mr)) {
                features.push({ c: mc, r: mr, emoji: '🧑‍💼', npc: true, merchant: true });
            }
            return; // stamp one village per chunk
        }
    }

    _classify(elev, moist) {
        if (elev < 0.25) return 'deep';
        if (elev < 0.32) return 'water';
        if (elev < 0.38) return 'sand';
        if (elev > 0.80) return 'snow';
        if (elev > 0.70) return 'mountain';
        if (moist > 0.50 && elev > 0.42) return 'forest';
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
        const b = this.biomeAt(wx, wy);
        if (BIOMES[b].passable) {
            const f = this.featureAt(wx, wy);
            if (f && f.blocks) return false;
            return true;
        }
        // Wade rule: a shallow-water tile (not deep) is passable if any of
        // its 8 world-neighbours is solid land. Lets the player reach
        // narrow landmasses, islands' corners, and coves without being
        // stopped just because the target cell is classified as water.
        if (b === 'water') {
            const neighbours = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            for (const [dx, dy] of neighbours) {
                const nb = this.biomeAt(wx + dx, wy + dy);
                if (BIOMES[nb].passable) {
                    const f = this.featureAt(wx + dx, wy + dy);
                    if (!f || !f.blocks) return true;
                }
            }
        }
        return false;
    }

    elevAt(wx, wy) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cy = Math.floor(wy / CHUNK_SIZE);
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return this.getChunk(cx, cy).elevations[ly * CHUNK_SIZE + lx];
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

// ── Day/night + fog of war ────────────────────────────────
// timeOfDay: 0..1, with 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.

/** Returns a darkness factor 0 (full day) → 1 (midnight). */
function _nightFactor(t) {
    // Cosine curve peaking at 0.5 (noon = 0 dark). Minimum at 0 (midnight = max dark).
    const noon = Math.cos(t * Math.PI * 2); // +1 at noon, -1 at midnight
    return Math.max(0, -noon); // 0..1
}

/** Vision radius in tiles. Day = 12 tiles, night = 5. Tighter for close cam. */
function _visionRadius(t) {
    const nf = _nightFactor(t);
    return 12 - nf * 7; // 12 day → 5 night
}

/** Vision radius fog — ALWAYS active. Daytime shows a wide clear area
 *  with grey beyond; night shrinks the radius and tints with dark blue. */
function drawFogOfWar(ctx, W, H, playerScreenX, playerScreenY, timeOfDay) {
    const nf = _nightFactor(timeOfDay);
    const vr = _visionRadius(timeOfDay);
    const radiusPx = vr * TILE_W * 0.7;

    // Colour: warm at dusk/dawn, cold at night, neutral grey during day.
    const warm = (timeOfDay > 0.66 && timeOfDay < 0.85) || (timeOfDay > 0.15 && timeOfDay < 0.34);
    const r = warm ? 80 : nf > 0.1 ? 8 : 40;
    const g = warm ? 50 : nf > 0.1 ? 10 : 40;
    const b = warm ? 20 : nf > 0.1 ? 35 : 45;

    // Inner alpha: 0 (clear). Outer alpha: 0.92 at night, 0.85 during day.
    const outerAlpha = 0.85 + nf * 0.07;
    const midAlpha   = nf * 0.35;

    const grad = ctx.createRadialGradient(
        playerScreenX, playerScreenY, radiusPx * 0.25,
        playerScreenX, playerScreenY, radiusPx
    );
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},${midAlpha.toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${outerAlpha.toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Extra night atmosphere.
    if (nf > 0.05) {
        const flatAlpha = nf * 0.25;
        ctx.fillStyle = `rgba(${r},${g},${b},${flatAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
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

// Perspective scale: tiles/sprites near the bottom of the screen (close)
// appear larger; those near the top (far) appear smaller. Returns a
// multiplier centred on 1.0 at the viewport middle.
// PERSP_STRENGTH loaded from data.js
function perspScale(screenY, viewH) {
    const norm = (screenY / viewH) - 0.5; // -0.5 (top) to +0.5 (bottom)
    return 1.0 + norm * PERSP_STRENGTH;   // ~0.825 at top, ~1.175 at bottom
}

// ── Rendering ────────────────────────────────────────────
// ELEV_PX loaded from data.js

let _renderTime = 0;
let _playerFlash = 0;
const _floaters = [];
function addFloater(wx, wy, text, color = '#fff') {
    _floaters.push({ wx, wy, text, color, age: 0, maxAge: 900 });
}
function tickFloaters(dt) {
    for (let i = _floaters.length - 1; i >= 0; i--) {
        _floaters[i].age += dt;
        if (_floaters[i].age >= _floaters[i].maxAge) _floaters.splice(i, 1);
    }
}

// ── Stars (rendered behind tiles at night) ───────────────
let _stars = null;
function ensureStars() {
    if (_stars) return _stars;
    _stars = [];
    for (let i = 0; i < 120; i++) {
        _stars.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.2, twinkle: Math.random() * Math.PI * 2 });
    }
    return _stars;
}

// ── Simple WebAudio SFX (no assets) ─────────────────────
let _sfxCtx = null;
function _sfx(freq, dur = 0.1, type = 'sine', gain = 0.06) {
    if (!_sfxCtx) try { _sfxCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const t = _sfxCtx.currentTime;
    const o = _sfxCtx.createOscillator();
    const g = _sfxCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_sfxCtx.destination);
    o.start(t); o.stop(t + dur + 0.02);
}
// _playerFlash lives in index.js (mutable game state).

function sfxHit()     { _sfx(180, 0.1, 'square', 0.07); }
function sfxKill()    { _sfx(440, 0.08); setTimeout(() => _sfx(660, 0.12), 60); }
function sfxHurt()    { _sfx(120, 0.14, 'sawtooth', 0.08); }
function sfxLevelUp() { _sfx(523, 0.12); setTimeout(() => _sfx(659, 0.14), 100); setTimeout(() => _sfx(784, 0.2), 240); }

function drawTile(ctx, sx, sy, biome, elev = 0.5) {
    const b = BIOMES[biome] || DUNGEON_BIOMES[biome];
    const hx = TILE_W / 2, hy = TILE_H / 2;
    // Elevation offset: higher tiles render higher on screen.
    const lift = (elev - 0.35) * ELEV_PX;
    const ty = sy - lift;

    // Brightness shift: low tiles slightly darker, high tiles brighter.
    let bright = 0.85 + elev * 0.3; // range ~0.85–1.15
    // Water shimmer — gentle brightness wave.
    if (biome === 'water' || biome === 'deep') {
        bright += Math.sin(_renderTime * 0.002 + sx * 0.08 + sy * 0.12) * 0.12;
    }

    const g = ctx.createLinearGradient(sx, ty, sx, ty + TILE_H);
    g.addColorStop(0, _adjustBright(b.color1, bright));
    g.addColorStop(1, _adjustBright(b.color2, bright));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx + hx, ty);
    ctx.lineTo(sx + TILE_W, ty + hy);
    ctx.lineTo(sx + hx, ty + TILE_H);
    ctx.lineTo(sx, ty + hy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
}

/** Draw south-east "wall" face when this tile is elevated above its
 *  neighbours — gives a cliff / depth impression. */
function drawTileDepth(ctx, sx, sy, elev, elevS, elevE) {
    const lift = (elev - 0.35) * ELEV_PX;
    const ty = sy - lift;
    const hx = TILE_W / 2, hy = TILE_H / 2;

    // South face (bottom-right edge → tile below).
    const sLift = (elevS - 0.35) * ELEV_PX;
    const diff = lift - sLift;
    if (diff > 1.5) {
        const tyS = sy - sLift;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.moveTo(sx + hx, ty + TILE_H);
        ctx.lineTo(sx + TILE_W, ty + hy);
        ctx.lineTo(sx + TILE_W, tyS + hy);
        ctx.lineTo(sx + hx, tyS + TILE_H);
        ctx.closePath();
        ctx.fill();
    }
    // East face (bottom-left edge).
    const eLift = (elevE - 0.35) * ELEV_PX;
    const diffE = lift - eLift;
    if (diffE > 1.5) {
        const tyE = sy - eLift;
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.moveTo(sx + hx, ty + TILE_H);
        ctx.lineTo(sx, ty + hy);
        ctx.lineTo(sx, tyE + hy);
        ctx.lineTo(sx + hx, tyE + TILE_H);
        ctx.closePath();
        ctx.fill();
    }
}

function _adjustBright(hex, factor) {
    const h = hex.replace('#', '');
    const r = Math.min(255, Math.round(parseInt(h.slice(0,2), 16) * factor));
    const g = Math.min(255, Math.round(parseInt(h.slice(2,4), 16) * factor));
    const b = Math.min(255, Math.round(parseInt(h.slice(4,6), 16) * factor));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function drawShadow(ctx, sx, sy, spriteSize) {
    if (spriteSize < 16) return; // tiny items (coins, flowers) skip shadow
    const rx = Math.min(12, spriteSize * 0.35);
    const ry = Math.min(5, spriteSize * 0.14);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx + TILE_W / 2, sy + TILE_H / 2 + 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

// Emoji cache: render each emoji+size pair to an offscreen canvas once,
// force all partially-transparent pixels to full opacity (fixes Windows
// Segoe UI Emoji rendering with internal alpha), then drawImage from cache.
const _emojiCache = new Map();
function _getEmojiImg(emoji, size) {
    const key = emoji + ':' + size;
    let c = _emojiCache.get(key);
    if (c) return c;
    const s = Math.ceil(size * 1.4);
    c = document.createElement('canvas');
    c.width = s; c.height = s;
    const c2 = c.getContext('2d');
    c2.font = size + "px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillText(emoji, s / 2, s / 2);
    // Force full opacity on every visible pixel.
    const img = c2.getImageData(0, 0, s, s);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 25) d[i] = 255;
    }
    c2.putImageData(img, 0, 0);
    _emojiCache.set(key, c);
    return c;
}

function drawEmoji(ctx, sx, sy, emoji, size = 28) {
    const cached = _getEmojiImg(emoji, size);
    const cx = sx + TILE_W / 2 - cached.width / 2;
    const cy = sy + TILE_H / 2 - cached.height / 2;
    ctx.drawImage(cached, cx, cy);
}
/* ╔══════════════════════════════════════════════════════════╗
 * ║  ULTIMA ARUTA — index.js (entry point)                     ║
 * ║  Imports data.js (constants) and wires Player, combat,     ║
 * ║  UI panels, world/dungeon layer, and the game loop.        ║
 * ╚══════════════════════════════════════════════════════════╝ */

// Data is loaded dynamically in mount() via sdk.asset('data.js').
// We declare D as a module-level ref so top-level functions (generateDungeon,
// World, noise, rendering) can access it after setup.

// These are assigned from data.js in mount() — declared here so
// top-level functions (World, generateDungeon, rendering) can use them.




// ── Player ───────────────────────────────────────────────
class Player {
    constructor(wx, wy) {
        this.wx = wx; this.wy = wy;
        this.rx = wx; this.ry = wy;
        this.moveT = 0;
        this.moveFrom = { wx, wy };
        this.emoji = '🧙';
        this.hp = 100; this.maxHp = 100;
        this.mana = 50; this.maxMana = 50;
        this.stamina = 100; this.maxStamina = 100;
        this.level = 1; this.xp = 0; this.xpNext = 20;
        this.attackCooldown = 0;
        this.baseDmg = 5;
    }
    tryMove(dx, dy, passCheck) {
        if (this.moveT > 0) return false;
        const nx = this.wx + dx, ny = this.wy + dy;
        if (!passCheck(nx, ny)) return false;
        this.moveFrom = { wx: this.wx, wy: this.wy };
        this.wx = nx; this.wy = ny;
        // Stamina cost: each step drains 2. When exhausted, movement slows.
        this.stamina = Math.max(0, this.stamina - 2);
        this.moveT = this.stamina > 0 ? MOVE_MS : MOVE_MS * 1.8;
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

// ── World-select screen ──────────────────────────────────
// Shown before the game mounts. Returns the picked world id (or null
// on cancel). Mutates the `worlds` array in place via `onChange`.
function showWorldSelect(root, worlds, onChange) {
    return new Promise((resolve) => {
        function render() {
            root.innerHTML = `
                <div class="ua-select-shell">
                    <h1 class="ua-select-title">⚔ Ultima Aruta</h1>
                    <p class="ua-select-sub">Choose a realm to wander…</p>
                    <div class="ua-select-list" id="ua-select-list">
                        ${worlds.slice().sort((a,b) => (b.lastPlayed||0) - (a.lastPlayed||0)).map(w => `
                            <div class="ua-select-row" data-id="${w.id}">
                                <div class="ua-select-meta">
                                    <div class="ua-select-name">${escapeHTML(w.name)}</div>
                                    <div class="ua-select-info">Seed ${w.seed} · Last played ${w.lastPlayed ? new Date(w.lastPlayed).toLocaleString() : '—'}</div>
                                </div>
                                <div class="ua-select-actions">
                                    <button class="ua-btn" data-act="play">▶ Play</button>
                                    <button class="ua-btn ua-btn-danger" data-act="del">🗑</button>
                                </div>
                            </div>
                        `).join('') || '<div class="ua-select-empty">No worlds yet — create one below.</div>'}
                    </div>
                    <div class="ua-select-new">
                        <input type="text" id="ua-new-name" placeholder="World name" class="ua-input" maxlength="40">
                        <input type="text" id="ua-new-seed" placeholder="Seed (optional)" class="ua-input" maxlength="12">
                        <button class="ua-btn ua-btn-primary" id="ua-new-go">＋ Create new world</button>
                    </div>
                </div>
            `;

            root.querySelectorAll('.ua-select-row').forEach(row => {
                const id = row.dataset.id;
                row.querySelector('[data-act="play"]').addEventListener('click', () => {
                    resolve(id);
                });
                row.querySelector('[data-act="del"]').addEventListener('click', async () => {
                    if (!confirm('Delete world permanently? Save data will be lost.')) return;
                    const i = worlds.findIndex(w => w.id === id);
                    if (i >= 0) {
                        worlds.splice(i, 1);
                        await onChange(worlds);
                        render();
                    }
                });
            });

            const $name = root.querySelector('#ua-new-name');
            const $seed = root.querySelector('#ua-new-seed');
            const $go   = root.querySelector('#ua-new-go');
            $go.addEventListener('click', async () => {
                const name = ($name.value || '').trim() || ('World ' + (worlds.length + 1));
                let seed = ($seed.value || '').trim();
                let seedNum;
                if (seed && /^\d+$/.test(seed)) seedNum = Number(seed) >>> 0;
                else if (seed) { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); seedNum = h >>> 0; }
                else seedNum = (Math.random() * 0xffffffff) >>> 0;
                const w = {
                    id: 'w_' + Math.random().toString(36).slice(2, 9),
                    name, seed: seedNum,
                    createdAt: Date.now(), lastPlayed: Date.now(),
                };
                worlds.push(w);
                await onChange(worlds);
                resolve(w.id);
            });
        }

        function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

        render();
    });
}

// ── Mount ────────────────────────────────────────────────
export default {
    async mount(root, sdk) {
        // ── Load data + engine modules ────────────────────

        // ── World selection ──────────────────────────────
        // Each "world" is an independent save slot: its own seed, player
        // position, inventory, day/night clock, and world deltas.
        let worlds = [];
        try {
            const w = await sdk.storage.get('worlds');
            if (Array.isArray(w)) worlds = w;
        } catch {}

        const pickedWorldId = await showWorldSelect(root, worlds, async (newWorlds) => {
            worlds = newWorlds;
            await sdk.storage.set('worlds', worlds).catch(() => {});
        });
        if (!pickedWorldId) return; // user closed the window while selecting

        const worldRow = worlds.find(w => w.id === pickedWorldId);
        const worldId = pickedWorldId;
        const STATE_KEY  = 'state_'        + worldId;
        const INV_KEY    = 'inventory_'    + worldId;
        const DELTA_KEY  = 'worldDeltas_'  + worldId;
        const EQUIP_KEY  = 'equipment_'    + worldId;

        // ── Save/load ────────────────────────────────────
        let saved = null;
        try { saved = await sdk.storage.get(STATE_KEY); } catch {}
        const seed = worldRow.seed >>> 0;
        const world = new World(seed);

        // Find a walkable starting cell. Spiral outward from (0,0) looking
        // for a grass tile surrounded by other grass (= continental interior,
        // not a tiny island). The wider search radius ensures we land on a
        // proper landmass even when (0,0) is deep ocean.
        let startX = saved?.px ?? 0, startY = saved?.py ?? 0;
        if (!saved) {
            let bestX = 0, bestY = 0, bestScore = -1;
            for (let r = 0; r < 600; r++) {
                const ang = r * 0.618;
                const rad = Math.floor(1 + r * 0.5);
                const tx = Math.round(Math.cos(ang) * rad);
                const ty = Math.round(Math.sin(ang) * rad);
                if (!world.passable(tx, ty)) continue;
                const b = world.biomeAt(tx, ty);
                if (b !== 'grass' && b !== 'forest') continue;
                // Score: count passable neighbours in a 5-tile radius.
                let score = 0;
                for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
                    if (world.passable(tx + dx, ty + dy)) score++;
                }
                if (score > bestScore) { bestScore = score; bestX = tx; bestY = ty; }
                if (bestScore >= 40) break; // big enough landmass, stop searching
            }
            startX = bestX; startY = bestY;
        }
        // ── Dungeon state ──────────────────────────────────
        let _dungeon = null; // { map, overworldX, overworldY } when inside a dungeon

        // Dungeon-aware lookups (override world methods when inside).
        function biomeAtDg(wx, wy) {
            if (!_dungeon) return world.biomeAt(wx, wy);
            if (wx < 0 || wy < 0 || wx >= DUNGEON_SIZE || wy >= DUNGEON_SIZE) return 'cave_wall';
            return _dungeon.map.biomes[wy * DUNGEON_SIZE + wx];
        }
        function elevAtDg(wx, wy) {
            if (!_dungeon) return world.elevAt(wx, wy);
            return 0.5; // flat dungeons
        }
        function passableDg(wx, wy) {
            const b = biomeAtDg(wx, wy);
            const bio = ALL_BIOMES[b];
            if (!bio) return false;
            if (!bio.passable) return false;
            if (!_dungeon) return world.passable(wx, wy);
            const f = featureAtDg(wx, wy);
            return !(f && f.blocks);
        }
        function featureAtDg(wx, wy) {
            if (!_dungeon) return world.featureAt(wx, wy);
            return _dungeon.map.features.find(f => f.c === wx && f.r === wy) || null;
        }
        function creaturesForRender() {
            if (_dungeon) return [{ key: '0,0', creatures: _dungeon.map.creatures, ox: 0, oy: 0 }];
            return null; // use normal chunk-based rendering
        }

        function enterDungeon(dungeonId) {
            const map = generateDungeon(dungeonId);
            _dungeon = { map, overworldX: player.wx, overworldY: player.wy };
            player.wx = map.spawnX; player.wy = map.spawnY;
            player.rx = map.spawnX; player.ry = map.spawnY;
            player.moveT = 0;
            showDialogBubble('🕳️', 'You descend into the darkness...');
            _sfx(120, 0.3, 'sawtooth', 0.06);
        }
        function exitDungeon() {
            player.wx = _dungeon.overworldX; player.wy = _dungeon.overworldY;
            player.rx = player.wx; player.ry = player.wy;
            player.moveT = 0;
            _dungeon = null;
            showDialogBubble('🪜', 'You emerge back to the surface.');
            _sfx(440, 0.15, 'sine', 0.05);
        }

        const player = new Player(startX, startY);
        // Restore player stats from save.
        if (saved) {
            if (saved.hp != null)      player.hp      = saved.hp;
            if (saved.mana != null)    player.mana    = saved.mana;
            if (saved.level != null)   player.level   = saved.level;
            if (saved.xp != null)      player.xp      = saved.xp;
            if (saved.xpNext != null)  player.xpNext  = saved.xpNext;
            if (saved.maxHp != null)   player.maxHp   = saved.maxHp;
            if (saved.maxMana != null) player.maxMana = saved.maxMana;
            if (saved.stamina != null)    player.stamina    = saved.stamina;
            if (saved.maxStamina != null) player.maxStamina = saved.maxStamina;
            if (saved.baseDmg != null) player.baseDmg = saved.baseDmg;
        }
        // Day starts at noon on first load. Time advances with real-time dt.
        let timeOfDay = (typeof saved?.timeOfDay === 'number') ? saved.timeOfDay : 0.5;

        // ── Inventory + equipment + world deltas ─────────
        let inventory = { items: [] };
        let equipment = {}; // { head: itemRow, weapon: ..., ... }
        try {
            const inv = await sdk.storage.get(INV_KEY);
            if (inv && Array.isArray(inv.items)) inventory = inv;
        } catch {}
        try {
            const eq = await sdk.storage.get(EQUIP_KEY);
            if (eq && typeof eq === 'object') equipment = eq;
        } catch {}
        // Persistent mutations to the procedural world (things picked up,
        // things dropped by the player). Applied to each chunk after
        // generation — without this a reload would respawn picked items.
        let worldDeltas = { removed: {}, added: {} };
        try {
            const d = await sdk.storage.get(DELTA_KEY);
            if (d) worldDeltas = { removed: d.removed || {}, added: d.added || {} };
        } catch {}
        world._applyDeltas = (ch) => {
            const key = ch.cx + ',' + ch.cy;
            const rem = worldDeltas.removed[key];
            if (rem) ch.features = ch.features.filter(f => !rem.some(r => r.c === f.c && r.r === f.r && r.key === f.itemKey));
            const add = worldDeltas.added[key];
            if (add) {
                for (const a of add) {
                    if (!ch.features.find(f => f.c === a.c && f.r === a.r)) ch.features.push({ c: a.c, r: a.r, emoji: ITEMS[a.key].emoji, item: true, itemKey: a.key });
                }
            }
        };
        // Patch getChunk to apply deltas on generation.
        const _origGen = world._generate.bind(world);
        world._generate = (cx, cy) => {
            const ch = _origGen(cx, cy);
            world._applyDeltas(ch);
            return ch;
        };

        function saveInventory()    { sdk.storage.set(INV_KEY,   inventory).catch(() => {}); }
        function saveWorldDeltas()  { sdk.storage.set(DELTA_KEY, worldDeltas).catch(() => {}); }
        function saveEquipment()    { sdk.storage.set(EQUIP_KEY, equipment).catch(() => {}); }

        function removeWorldItem(wx, wy) {
            const cx = Math.floor(wx / CHUNK_SIZE), cy = Math.floor(wy / CHUNK_SIZE);
            const lc = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const lr = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const ch = world.getChunk(cx, cy);
            const idx = ch.features.findIndex(f => f.c === lc && f.r === lr && f.item);
            if (idx < 0) return null;
            const f = ch.features[idx];
            ch.features.splice(idx, 1);
            const key = cx + ',' + cy;
            (worldDeltas.removed[key] = worldDeltas.removed[key] || []).push({ c: lc, r: lr, key: f.itemKey });
            saveWorldDeltas();
            return f.itemKey;
        }
        function placeWorldItem(wx, wy, itemKey) {
            const cx = Math.floor(wx / CHUNK_SIZE), cy = Math.floor(wy / CHUNK_SIZE);
            const lc = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const lr = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const ch = world.getChunk(cx, cy);
            if (ch.features.find(f => f.c === lc && f.r === lr)) return false;
            ch.features.push({ c: lc, r: lr, emoji: ITEMS[itemKey].emoji, item: true, itemKey });
            const key = cx + ',' + cy;
            (worldDeltas.added[key] = worldDeltas.added[key] || []).push({ c: lc, r: lr, key: itemKey });
            saveWorldDeltas();
            return true;
        }

        // ── DOM ──────────────────────────────────────────
        root.innerHTML = `
            <div class="ua-shell">
                <canvas class="ua-canvas" id="ua-canvas"></canvas>
                <canvas class="ua-minimap" id="ua-minimap" width="140" height="140"></canvas>
                <div class="ua-hud" id="ua-hud"></div>
                <div class="ua-help">WASD move · <b>Right-hold</b> walk · <b>Space</b> interact · <b>I</b> bag · <b>P</b> doll · <b>C</b> craft · ${worldRow.name}</div>
                <div class="ua-backpack" id="ua-backpack" style="display:none;">
                    <div class="ua-backpack-head">
                        <span class="ua-backpack-title">🎒 Backpack</span>
                        <span class="ua-backpack-close" data-close="pack" title="Close (I)">×</span>
                    </div>
                    <div class="ua-backpack-body" id="ua-backpack-body"></div>
                </div>
                <div class="ua-paperdoll" id="ua-paperdoll" style="display:none;">
                    <div class="ua-paperdoll-head">
                        <span>👤 Paperdoll</span>
                        <span class="ua-backpack-close" data-close="doll" title="Close (P)">×</span>
                    </div>
                    <div class="ua-paperdoll-body" id="ua-paperdoll-body">
                        <div class="ua-doll-figure">🧙</div>
                        <div class="ua-doll-slots" id="ua-doll-slots"></div>
                    </div>
                </div>
                <div class="ua-stats" id="ua-stats" style="display:none;">
                    <div class="ua-backpack-head">
                        <span>📊 Stats</span>
                        <span class="ua-backpack-close" data-close="stats" title="Close">×</span>
                    </div>
                    <div class="ua-stats-body" id="ua-stats-body"></div>
                </div>
                <div class="ua-craft" id="ua-craft" style="display:none;">
                    <div class="ua-backpack-head"><span>🔨 Craft</span><span class="ua-backpack-close" data-close="craft">×</span></div>
                    <div class="ua-craft-body" id="ua-craft-body"></div>
                </div>
                <div class="ua-hub" id="ua-hub">
                    <button class="ua-hub-btn" data-hub="pack"   title="Backpack (I)">🎒</button>
                    <button class="ua-hub-btn" data-hub="doll"   title="Paperdoll (P)">👤</button>
                    <button class="ua-hub-btn" data-hub="craft"  title="Craft (C)">🔨</button>
                    <button class="ua-hub-btn" data-hub="stats"  title="Stats">📊</button>
                </div>
                <div class="ua-drag-ghost" id="ua-drag-ghost" style="display:none;"></div>
            </div>
        `;
        const canvas = root.querySelector('#ua-canvas');
        const ctx = canvas.getContext('2d');
        const $hud = root.querySelector('#ua-hud');

        // Fixed internal resolution — the viewport always shows the same
        // area (~18 tiles wide) regardless of the window size. CSS stretches
        // the canvas to fill; `image-rendering: pixelated` on the canvas
        // element keeps it crisp.
        const VIEW_W = 560, VIEW_H = 380;
        canvas.width = VIEW_W;
        canvas.height = VIEW_H;
        canvas.style.imageRendering = 'pixelated';

        // ── Input: grid-snap with auto-repeat ────────────
        const held = new Set();
        function onKey(e) {
            const k = e.key.toLowerCase();
            const MAP = { arrowup:'n', w:'n', arrowdown:'s', s:'s', arrowleft:'w', a:'w', arrowright:'e', d:'e' };
            const dir = MAP[k];
            if (dir) {
                e.preventDefault();
                if (e.type === 'keydown') held.add(dir); else held.delete(dir);
                return;
            }
            if (e.type === 'keydown' && (k === ' ' || k === 'enter' || k === 'e')) {
                e.preventDefault();
                tryInteract();
                return;
            }
            if (e.type === 'keydown' && (k === 'i' || k === 'b')) {
                e.preventDefault();
                toggleBackpack();
                return;
            }
            if (e.type === 'keydown' && k === 'p') {
                e.preventDefault();
                togglePaperdoll();
                return;
            }
            if (e.type === 'keydown' && k === 'c') {
                e.preventDefault();
                togglePanel('craft');
            }
        }

        // ── Interaction: SPACE/E talks to an adjacent NPC or enters a
        // dungeon when the player is standing on (or beside) its tile.
        function tryInteract() {
            // In dungeon: check for exit tile.
            if (_dungeon) {
                const f = featureAtDg(player.wx, player.wy);
                if (f && f.isExit) { exitDungeon(); return; }
                // Check adjacent for dungeon features (chests handled via drag).
                return;
            }
            // Overworld: check the 9 cells centred on the player.
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const f = world.featureAt(player.wx + dx, player.wy + dy);
                    if (!f) continue;
                    if (f.merchant) { showShop(); return; }
                    if (f.npc) { showDialogBubble(f.emoji, f.dialog || DIALOGS[0]); return; }
                    if (f.dungeon && dx === 0 && dy === 0) {
                        enterDungeon(f.dungeonId);
                        return;
                    }
                }
            }
        }

        // ── Merchant shop UI ──────────────────────────────
        function showShop() {
            let shopEl = root.querySelector('#ua-shop');
            if (shopEl) { shopEl.remove(); return; } // toggle off
            shopEl = document.createElement('div');
            shopEl.id = 'ua-shop';
            shopEl.className = 'ua-shop';
            function goldCount() { return inventory.items.filter(i => i.key === 'gold').length; }
            function renderShop() {
                const gold = goldCount();
                shopEl.innerHTML = `
                    <div class="ua-backpack-head"><span>🧑‍💼 Merchant</span><span class="ua-backpack-close" id="ua-shop-close">×</span></div>
                    <div class="ua-shop-gold">🪙 Your gold: <b>${gold}</b></div>
                    <div class="ua-shop-section"><b>Buy</b></div>
                    <div class="ua-shop-list">
                        ${MERCHANT_STOCK.map(s => {
                            const def = ITEMS[s.key];
                            return `<div class="ua-shop-row">
                                <span>${def.emoji} ${def.name}</span>
                                <span class="ua-shop-price">${s.price}🪙</span>
                                <button class="ua-btn ua-shop-buy" data-key="${s.key}" data-price="${s.price}" ${gold < s.price ? 'disabled' : ''}>Buy</button>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="ua-shop-section"><b>Sell</b></div>
                    <div class="ua-shop-list">
                        ${inventory.items.filter(i => i.key !== 'gold').map(i => {
                            const def = ITEMS[i.key] || {};
                            const buyPrice = MERCHANT_STOCK.find(s => s.key === i.key)?.price;
                            const sellPrice = buyPrice ? Math.max(1, Math.floor(buyPrice * SELL_RATIO)) : 1;
                            return `<div class="ua-shop-row">
                                <span>${def.emoji || '?'} ${def.name || i.key}</span>
                                <span class="ua-shop-price">${sellPrice}🪙</span>
                                <button class="ua-btn ua-shop-sell" data-id="${i.id}" data-sell="${sellPrice}">Sell</button>
                            </div>`;
                        }).join('') || '<div style="opacity:0.5;padding:6px;">Nothing to sell.</div>'}
                    </div>
                `;
                shopEl.querySelector('#ua-shop-close').addEventListener('click', () => shopEl.remove());
                shopEl.querySelectorAll('.ua-shop-buy').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const key = btn.dataset.key;
                        const price = Number(btn.dataset.price);
                        if (goldCount() < price) return;
                        // Remove gold coins.
                        let removed = 0;
                        inventory.items = inventory.items.filter(i => {
                            if (i.key === 'gold' && removed < price) { removed++; return false; }
                            return true;
                        });
                        // Add purchased item.
                        const def = ITEMS[key];
                        inventory.items.push({
                            id: 'it_' + Math.random().toString(36).slice(2, 9),
                            key, emoji: def.emoji, name: def.name,
                            x: 6 + (inventory.items.length % 7) * 36,
                            y: 6 + Math.floor(inventory.items.length / 7) * 36,
                        });
                        saveInventory();
                        addFloater(player.wx, player.wy, '-' + price + '🪙', '#ffaa00');
                        _sfx(880, 0.06, 'sine', 0.04);
                        renderShop();
                        if ($pack.style.display !== 'none') renderBackpack();
                    });
                });
                shopEl.querySelectorAll('.ua-shop-sell').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        const sell = Number(btn.dataset.sell);
                        inventory.items = inventory.items.filter(i => i.id !== id);
                        // Add gold coins.
                        for (let g = 0; g < sell; g++) {
                            inventory.items.push({
                                id: 'it_' + Math.random().toString(36).slice(2, 9),
                                key: 'gold', emoji: '🪙', name: 'Gold Coin',
                                x: 6 + (inventory.items.length % 7) * 36,
                                y: 6 + Math.floor(inventory.items.length / 7) * 36,
                            });
                        }
                        saveInventory();
                        addFloater(player.wx, player.wy, '+' + sell + '🪙', '#ffc857');
                        _sfx(660, 0.06, 'sine', 0.04);
                        renderShop();
                        if ($pack.style.display !== 'none') renderBackpack();
                    });
                });
            }
            root.querySelector('.ua-shell').appendChild(shopEl);
            renderShop();
        }

        function showDialogBubble(icon, text) {
            let b = root.querySelector('#ua-dialog');
            if (b) b.remove();
            b = document.createElement('div');
            b.id = 'ua-dialog';
            b.className = 'ua-dialog';
            b.innerHTML = `<span class="ua-dialog-icon">${icon}</span><span class="ua-dialog-text">${text.replace(/[<>&]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))}</span>`;
            root.querySelector('.ua-shell').appendChild(b);
            setTimeout(() => { b.classList.add('ua-dialog-out'); setTimeout(() => b.remove(), 500); }, 4500);
        }
        document.addEventListener('keydown', onKey);
        document.addEventListener('keyup', onKey);

        // ── Backpack + drag-drop ─────────────────────────
        const $pack = root.querySelector('#ua-backpack');
        const $packBody = root.querySelector('#ua-backpack-body');
        const $ghost = root.querySelector('#ua-drag-ghost');
        let dragState = null;

        function toggleBackpack() { togglePanel('pack'); }
        function togglePaperdoll() { togglePanel('doll'); }
        // ── Paperdoll + HUB + stats windows ──────────────
        const $doll     = root.querySelector('#ua-paperdoll');
        const $dollBody = root.querySelector('#ua-doll-slots');
        const $stats    = root.querySelector('#ua-stats');
        const $statsBody= root.querySelector('#ua-stats-body');

        const $craft     = root.querySelector('#ua-craft');
        const $craftBody = root.querySelector('#ua-craft-body');

        function renderCraft() {
            $craftBody.innerHTML = RECIPES.map((r, ri) => {
                const def = ITEMS[r.output];
                // Check if player has the ingredients.
                const counts = {};
                for (const k of r.inputs) counts[k] = (counts[k] || 0) + 1;
                let canCraft = true;
                for (const [k, need] of Object.entries(counts)) {
                    const have = inventory.items.filter(i => i.key === k).length;
                    if (have < need) canCraft = false;
                }
                const inputStr = r.inputs.map(k => (ITEMS[k]?.emoji || '?') + ' ' + (ITEMS[k]?.name || k)).join(' + ');
                return `<div class="ua-shop-row">
                    <span>${def.emoji} <b>${r.name}</b></span>
                    <span style="font-size:11px;opacity:0.7">${inputStr}</span>
                    <button class="ua-btn" data-craft="${ri}" ${canCraft ? '' : 'disabled'}>Craft</button>
                </div>`;
            }).join('');
            $craftBody.querySelectorAll('[data-craft]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const ri = Number(btn.dataset.craft);
                    const r = RECIPES[ri];
                    // Consume ingredients.
                    const toRemove = {};
                    for (const k of r.inputs) toRemove[k] = (toRemove[k] || 0) + 1;
                    for (const [k, n] of Object.entries(toRemove)) {
                        let rem = 0;
                        inventory.items = inventory.items.filter(i => {
                            if (i.key === k && rem < n) { rem++; return false; }
                            return true;
                        });
                    }
                    // Add result.
                    const def = ITEMS[r.output];
                    inventory.items.push({
                        id: 'it_' + Math.random().toString(36).slice(2, 9),
                        key: r.output, emoji: def.emoji, name: def.name,
                        x: 6 + (inventory.items.length % 7) * 36,
                        y: 6 + Math.floor(inventory.items.length / 7) * 36,
                    });
                    saveInventory();
                    addFloater(player.wx, player.wy, '🔨 ' + def.name, '#80c0ff');
                    _sfx(520, 0.08, 'triangle', 0.05); setTimeout(() => _sfx(780, 0.1, 'triangle', 0.04), 80);
                    renderCraft();
                    if ($pack.style.display !== 'none') renderBackpack();
                });
            });
        }

        function togglePanel(kind) {
            const m = { pack: $pack, doll: $doll, stats: $stats, craft: $craft };
            const el = m[kind]; if (!el) return;
            const open = el.style.display !== 'none';
            if (open) el.style.display = 'none';
            else { el.style.display = ''; if (kind === 'pack') renderBackpack(); if (kind === 'doll') renderPaperdoll(); if (kind === 'stats') renderStats(); if (kind === 'craft') renderCraft(); }
        }
        root.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => togglePanel(btn.dataset.close)));
        root.querySelectorAll('.ua-hub-btn').forEach(btn => btn.addEventListener('click', () => togglePanel(btn.dataset.hub)));

        function renderPaperdoll() {
            $dollBody.innerHTML = SLOTS.map(s => `
                <div class="ua-slot" data-slot="${s.key}">
                    <div class="ua-slot-label">${s.label}</div>
                    <div class="ua-slot-cell">${equipment[s.key] ? `<div class="ua-item ua-slot-item" data-slot-of="${s.key}">${equipment[s.key].emoji}</div>` : ''}</div>
                </div>
            `).join('');
            // Wire equipped items for drag (equip → inventory or swap).
            $dollBody.querySelectorAll('.ua-slot-item').forEach(el => {
                el.addEventListener('pointerdown', (ev) => {
                    ev.preventDefault();
                    const slotKey = el.dataset.slotOf;
                    const it = equipment[slotKey];
                    if (!it) return;
                    startDrag('equip', { invItem: it, fromSlot: slotKey }, ev.clientX, ev.clientY);
                });
            });
        }
        function renderStats() {
            const bm = BIOMES[world.biomeAt(player.wx, player.wy)].name;
            $statsBody.innerHTML = `
                <div><b>${worldRow.name}</b></div>
                <div>Seed <span style="color:#ffc857">${worldRow.seed}</span></div>
                <div>Position: ${player.wx}, ${player.wy}</div>
                <div>Biome: ${bm}</div>
                <div>Inventory: ${inventory.items.length} items</div>
                <div>Equipment: ${Object.keys(equipment).length} slots filled</div>
                <div style="margin-top:10px"><button class="ua-btn ua-btn-danger" id="ua-back-to-menu">↩ Back to world menu</button></div>
            `;
            $statsBody.querySelector('#ua-back-to-menu').addEventListener('click', () => {
                // Persist state then re-mount the shell.
                sdk.storage.set(STATE_KEY, {
                    seed, px: player.wx, py: player.wy, timeOfDay,
                    hp: player.hp, mana: player.mana, stamina: player.stamina,
                    level: player.level, xp: player.xp, xpNext: player.xpNext,
                    maxHp: player.maxHp, maxMana: player.maxMana, maxStamina: player.maxStamina, baseDmg: player.baseDmg,
                }).catch(() => {});
                root.__uaCleanup?.();
                // Reload by re-invoking mount — simplest way.
                location.reload();
            });
        }

        root.querySelector('#ua-backpack-close')?.addEventListener?.('click', toggleBackpack);

        // Draggable backpack window — grab the title bar.
        (function makeBackpackDraggable() {
            const head = root.querySelector('.ua-backpack-head');
            let dragging = false, dx = 0, dy = 0;
            head.style.cursor = 'grab';
            head.addEventListener('pointerdown', (ev) => {
                if (ev.target.closest('.ua-backpack-close')) return;
                dragging = true;
                const rect = $pack.getBoundingClientRect();
                dx = ev.clientX - rect.left;
                dy = ev.clientY - rect.top;
                // Remove the centering transform so left/top in px apply directly.
                $pack.style.transform = 'none';
                $pack.style.left = rect.left + 'px';
                $pack.style.top  = rect.top  + 'px';
                head.setPointerCapture?.(ev.pointerId);
                head.style.cursor = 'grabbing';
            });
            head.addEventListener('pointermove', (ev) => {
                if (!dragging) return;
                $pack.style.left = (ev.clientX - dx) + 'px';
                $pack.style.top  = (ev.clientY - dy) + 'px';
            });
            function stop() { dragging = false; head.style.cursor = 'grab'; }
            head.addEventListener('pointerup', stop);
            head.addEventListener('pointercancel', stop);
        })();

        function renderBackpack() {
            $packBody.innerHTML = '';
            for (const it of inventory.items) {
                const el = document.createElement('div');
                el.className = 'ua-item';
                el.style.left = (it.x || 6) + 'px';
                el.style.top  = (it.y || 6) + 'px';
                el.textContent = it.emoji;
                el.title = it.name;
                el.dataset.id = it.id;
                $packBody.appendChild(el);
            }
        }

        function showGhost(emoji, x, y) {
            $ghost.textContent = emoji;
            $ghost.style.display = '';
            $ghost.style.left = x + 'px';
            $ghost.style.top  = y + 'px';
        }
        function hideGhost() { $ghost.style.display = 'none'; $ghost.textContent = ''; }

        // Convert CSS-pixel coords relative to canvas top-left into internal
        // 800×540 resolution coords (canvas stretches via CSS).
        function _cssToInternal(relX, relY) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: relX * VIEW_W / rect.width,
                y: relY * VIEW_H / rect.height,
            };
        }

        function canvasToWorldCell(cssRelX, cssRelY) {
            const { x: canvasX, y: canvasY } = _cssToInternal(cssRelX, cssRelY);
            const W = VIEW_W, H = VIEW_H;
            const cam = camera(W, H, player.rx, player.ry);
            const a = (canvasY - cam.cy) * 2 / TILE_H;
            const b = (canvasX - cam.cx) * 2 / TILE_W;
            return { wx: Math.round((a + b) / 2), wy: Math.round((a - b) / 2) };
        }

        function startDrag(source, data, pageX, pageY) {
            dragState = { source, ...data };
            const emoji = source === 'inv' ? data.invItem.emoji : ITEMS[data.worldKey].emoji;
            showGhost(emoji, pageX - 16, pageY - 16);
        }

        function _dropTarget(ev) {
            // What is under the pointer? Return one of 'pack' | 'doll:<slot>' | 'world' | null.
            if ($pack.style.display !== 'none') {
                const r = $packBody.getBoundingClientRect();
                if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) return { kind: 'pack', rect: r };
            }
            if ($doll.style.display !== 'none') {
                for (const s of SLOTS) {
                    const slotEl = $dollBody.querySelector(`.ua-slot[data-slot="${s.key}"] .ua-slot-cell`);
                    if (!slotEl) continue;
                    const r = slotEl.getBoundingClientRect();
                    if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) return { kind: 'doll', slot: s.key };
                }
            }
            return { kind: 'world' };
        }

        function endDrag(ev) {
            if (!dragState) return;
            hideGhost();
            const target = _dropTarget(ev);

            // ── From world ──────────────────────────────────
            if (dragState.source === 'world') {
                const key = dragState.worldKey;
                const def = ITEMS[key];
                const picked = () => removeItemAt(dragState.wx, dragState.wy);
                // Detect drop on the player's own tile (or any tile within 1),
                // which acts as a shortcut for "put in backpack".
                let droppedOnPlayer = false;
                if (target.kind === 'world') {
                    const cr = canvas.getBoundingClientRect();
                    const { wx, wy } = canvasToWorldCell(ev.clientX - cr.left, ev.clientY - cr.top);
                    droppedOnPlayer = Math.max(Math.abs(wx - player.wx), Math.abs(wy - player.wy)) <= 1;
                }
                if (target.kind === 'pack' && picked()) {
                    const r = target.rect;
                    inventory.items.push({
                        id: 'it_' + Math.random().toString(36).slice(2, 9),
                        key, emoji: def.emoji, name: def.name,
                        x: Math.max(0, ev.clientX - r.left - 16),
                        y: Math.max(0, ev.clientY - r.top  - 16),
                    });
                    saveInventory(); renderBackpack();
                } else if (target.kind === 'doll' && def.slot === target.slot && picked()) {
                    _equipTo(target.slot, {
                        id: 'it_' + Math.random().toString(36).slice(2, 9),
                        key, emoji: def.emoji, name: def.name,
                    });
                } else if (droppedOnPlayer && picked()) {
                    // Auto-pickup into backpack at a free-looking spot near the top-left.
                    inventory.items.push({
                        id: 'it_' + Math.random().toString(36).slice(2, 9),
                        key, emoji: def.emoji, name: def.name,
                        x: 6 + (inventory.items.length % 7) * 36,
                        y: 6 + Math.floor(inventory.items.length / 7) * 36,
                    });
                    saveInventory();
                    if ($pack.style.display !== 'none') renderBackpack();
                }
                dragState = null;
                return;
            }

            // ── From inventory ──────────────────────────────
            if (dragState.source === 'inv') {
                if (target.kind === 'pack') {
                    const it = dragState.invItem;
                    const r = target.rect;
                    it.x = Math.max(0, ev.clientX - r.left - 16);
                    it.y = Math.max(0, ev.clientY - r.top  - 16);
                    saveInventory(); renderBackpack();
                } else if (target.kind === 'doll' && ITEMS[dragState.invItem.key]?.slot === target.slot) {
                    _equipTo(target.slot, dragState.invItem);
                    inventory.items = inventory.items.filter(i => i.id !== dragState.invItem.id);
                    saveInventory(); renderBackpack();
                } else if (target.kind === 'world') {
                    const cr = canvas.getBoundingClientRect();
                    const { wx, wy } = canvasToWorldCell(ev.clientX - cr.left, ev.clientY - cr.top);
                    const dist = Math.max(Math.abs(wx - player.wx), Math.abs(wy - player.wy));
                    if (dist <= 2 && world.passable(wx, wy) && placeWorldItem(wx, wy, dragState.invItem.key)) {
                        inventory.items = inventory.items.filter(i => i.id !== dragState.invItem.id);
                        saveInventory(); renderBackpack();
                    }
                }
                dragState = null;
                return;
            }

            // ── From equipment slot ─────────────────────────
            if (dragState.source === 'equip') {
                const it = dragState.invItem;
                const fromSlot = dragState.fromSlot;
                if (target.kind === 'doll' && ITEMS[it.key]?.slot === target.slot) {
                    equipment[fromSlot] = null;
                    _equipTo(target.slot, it);
                } else if (target.kind === 'pack' || target.kind === 'world') {
                    // Unequip → backpack (or drop on world if far).
                    delete equipment[fromSlot];
                    if (target.kind === 'pack') {
                        const r = target.rect;
                        inventory.items.push({
                            ...it,
                            x: Math.max(0, ev.clientX - r.left - 16),
                            y: Math.max(0, ev.clientY - r.top  - 16),
                        });
                        saveInventory(); renderBackpack();
                    } else {
                        const cr = canvas.getBoundingClientRect();
                        const { wx, wy } = canvasToWorldCell(ev.clientX - cr.left, ev.clientY - cr.top);
                        const dist = Math.max(Math.abs(wx - player.wx), Math.abs(wy - player.wy));
                        if (dist <= 2 && world.passable(wx, wy)) placeWorldItem(wx, wy, it.key);
                        else inventory.items.push(it);
                        saveInventory(); renderBackpack();
                    }
                    saveEquipment(); renderPaperdoll();
                }
                dragState = null;
            }
        }

        function _equipTo(slotKey, itemRow) {
            // If already equipped, the displaced item goes to the backpack.
            const prev = equipment[slotKey];
            equipment[slotKey] = itemRow;
            if (prev && prev !== itemRow) {
                inventory.items.push({ ...prev, x: 6, y: 6 });
            }
            saveEquipment(); saveInventory();
            renderPaperdoll(); renderBackpack();
        }

        canvas.addEventListener('pointerdown', (ev) => {
            if (ev.button === 2) return; // right-click handled by mouseWalk below
            const rect = canvas.getBoundingClientRect();
            const cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
            // Emoji render anchor is at the bottom of the tile, so the visible
            // glyph hovers ~20–30 px above its logical cell. Probe the clicked
            // cell and a small cluster just above it (wy-1, wx-1, wx+1) so a
            // click on the *visible* sprite maps to its owner tile.
            const hit = _findItemNear(cx, cy, world, canvasToWorldCell);
            if (!hit) return;
            const { wx, wy, feature: f } = hit;
            const dist = Math.max(Math.abs(wx - player.wx), Math.abs(wy - player.wy));
            if (dist > 2) return;
            startDrag('world', { worldKey: f.itemKey, wx, wy }, ev.clientX, ev.clientY);
        });

        function _findItemNear(cx, cy, _unused, c2w) {
            const base = c2w(cx, cy);
            const offsets = [[0,0],[0,-1],[-1,-1],[1,-1],[-1,0],[1,0],[0,1],[0,-2],[-1,-2],[1,-2]];
            for (const [dx, dy] of offsets) {
                const wx = base.wx + dx, wy = base.wy + dy;
                const f = featureAtDg(wx, wy);
                if (f && f.item) return { wx, wy, feature: f };
            }
            return null;
        }

        // Remove an item from wherever we are (overworld or dungeon).
        function removeItemAt(wx, wy) {
            if (_dungeon) {
                const idx = _dungeon.map.features.findIndex(f => f.c === wx && f.r === wy && f.item);
                if (idx < 0) return null;
                const f = _dungeon.map.features[idx];
                _dungeon.map.features.splice(idx, 1);
                return f.itemKey;
            }
            return removeWorldItem(wx, wy);
        }

        // Double-click an item in backpack to consume it (food/potions).
        $packBody.addEventListener('dblclick', (ev) => {
            const itemEl = ev.target.closest('.ua-item');
            if (!itemEl) return;
            const id = itemEl.dataset.id;
            const it = inventory.items.find(i => i.id === id);
            if (!it) return;
            const def = ITEMS[it.key];
            if (!def || !def.use) { addFloater(player.wx, player.wy, 'Cannot use', '#aaa'); return; }
            // Apply effects.
            if (def.use.hp)      player.hp      = Math.min(player.maxHp,      player.hp      + def.use.hp);
            if (def.use.mana)    player.mana    = Math.min(player.maxMana,    player.mana    + def.use.mana);
            if (def.use.stamina) player.stamina = Math.min(player.maxStamina, player.stamina + def.use.stamina);
            // Remove from inventory.
            inventory.items = inventory.items.filter(i => i.id !== id);
            saveInventory();
            renderBackpack();
            const parts = [];
            if (def.use.hp)      parts.push('+' + def.use.hp + ' HP');
            if (def.use.mana)    parts.push('+' + def.use.mana + ' MP');
            if (def.use.stamina) parts.push('+' + def.use.stamina + ' SP');
            addFloater(player.wx, player.wy, parts.join(' '), '#60ff60');
            _sfx(660, 0.08, 'sine', 0.05);
        });

        $packBody.addEventListener('pointerdown', (ev) => {
            const itemEl = ev.target.closest('.ua-item');
            if (!itemEl) return;
            const id = itemEl.dataset.id;
            const it = inventory.items.find(i => i.id === id);
            if (!it) return;
            ev.preventDefault();
            startDrag('inv', { invItem: it }, ev.clientX, ev.clientY);
        });

        function onPointerMove(ev) {
            if (!dragState) return;
            showGhost($ghost.textContent, ev.clientX - 16, ev.clientY - 16);
        }
        function onPointerUp(ev) { endDrag(ev); }
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);

        // ── Game loop ────────────────────────────────────
        let last = performance.now();
        let rafId = 0;
        let saveTimer = 0;

        // Mouse-walk (UO-style): right-click + hold to steer.
        let mouseWalk = null; // { clientX, clientY } when active
        canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
        canvas.addEventListener('pointerdown', (ev) => {
            if (ev.button === 2) {
                ev.preventDefault();
                canvas.setPointerCapture?.(ev.pointerId);
                mouseWalk = { clientX: ev.clientX, clientY: ev.clientY };
            }
        });
        canvas.addEventListener('pointermove', (ev) => {
            if (mouseWalk) { mouseWalk.clientX = ev.clientX; mouseWalk.clientY = ev.clientY; }
        });
        function stopMouseWalk(ev) {
            if (ev && ev.button !== 2) return;
            mouseWalk = null;
        }
        canvas.addEventListener('pointerup', stopMouseWalk);
        canvas.addEventListener('pointercancel', () => { mouseWalk = null; });

        function tryStepFromHeld() {
            if (player.moveT > 0) return;
            let dx = 0, dy = 0;
            if (held.has('n')) { dx -= 1; dy -= 1; }
            if (held.has('s')) { dx += 1; dy += 1; }
            if (held.has('e')) { dx += 1; dy -= 1; }
            if (held.has('w')) { dx -= 1; dy += 1; }

            // If right-mouse is held, steer toward the cursor. Compute the
            // direction in screen space from the player's on-screen position
            // to the cursor, then convert back to world delta via inverse iso.
            if (!dx && !dy && mouseWalk) {
                const rect = canvas.getBoundingClientRect();
                const { x: cx, y: cy } = _cssToInternal(
                    mouseWalk.clientX - rect.left,
                    mouseWalk.clientY - rect.top);
                const W = VIEW_W, H = VIEW_H;
                const cam = camera(W, H, player.rx, player.ry);
                const p = iso(player.wx, player.wy);
                const px = p.x + cam.cx, py = p.y + cam.cy;
                const vx = cx - px, vy = cy - py;
                // Dead zone so tiny movements don't cause twitchy walking.
                if (vx * vx + vy * vy < 22 * 22) return;
                // Convert screen delta into world delta (inverse iso).
                const a = vy * 2 / TILE_H;
                const b = vx * 2 / TILE_W;
                const wdx = (a + b) / 2;
                const wdy = (a - b) / 2;
                // Snap to one of the 8 compass directions. If one axis is
                // much smaller than the other (ratio < 0.4), treat it as 0
                // so the player can walk along a pure world-axis (which in
                // screen space reads as a diagonal NE/NW/SE/SW).
                const absX = Math.abs(wdx), absY = Math.abs(wdy);
                const bigger = Math.max(absX, absY);
                dx = absX >= bigger * 0.4 ? Math.sign(wdx) : 0;
                dy = absY >= bigger * 0.4 ? Math.sign(wdy) : 0;
            }
            if (dx || dy) {
                // If the diagonal step is blocked, slide along a single axis
                // so the player doesn't "stick" against a corner.
                if (!player.tryMove(Math.sign(dx), Math.sign(dy), passableDg)) {
                    if (dx && dy) {
                        if (!player.tryMove(Math.sign(dx), 0, passableDg)) {
                            player.tryMove(0, Math.sign(dy), passableDg);
                        }
                    }
                }
            }
        }

        function render() {
            const W = VIEW_W;
            const H = VIEW_H;
            ctx.clearRect(0, 0, W, H);

            // Stars behind everything, visible at night.
            const nf = _nightFactor(timeOfDay);
            if (nf > 0.15) {
                const stars = ensureStars();
                const alpha = Math.min(1, (nf - 0.15) * 2);
                for (const s of stars) {
                    const twinkle = 0.5 + 0.5 * Math.sin(_renderTime * 0.001 + s.twinkle);
                    ctx.fillStyle = `rgba(220,220,255,${(alpha * twinkle * 0.7).toFixed(2)})`;
                    ctx.beginPath();
                    ctx.arc(s.x * W, s.y * H * 0.5, s.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

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

            // PASS 1 — tiles with elevation + depth walls.
            // Each tile's 4 diamond vertices are individually perspective-
            // projected so adjacent tiles share exact edge coordinates (no seams).
            function perspPt(isoX, isoY) {
                const screenY = isoY;
                const ps = perspScale(screenY, H);
                return {
                    x: W / 2 + (isoX - W / 2) * ps,
                    y: H / 2 + (isoY - H / 2) * ps,
                };
            }
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const p = iso(x, y);
                    const cx2 = p.x + cam.cx;
                    const cy2 = p.y + cam.cy;
                    const elev = elevAtDg(x, y);
                    const lift = (elev - 0.35) * ELEV_PX;
                    const b = biomeAtDg(x, y);
                    const bio = ALL_BIOMES[b] || BIOMES.grass;
                    const bright = 0.85 + elev * 0.3;
                    let bri = bright;
                    if (b === 'water' || b === 'deep') bri += Math.sin(_renderTime * 0.002 + cx2 * 0.08 + cy2 * 0.12) * 0.12;

                    // 4 vertices of the diamond (top, right, bottom, left) with lift.
                    const top    = perspPt(cx2,              cy2 - lift);
                    const right  = perspPt(cx2 + TILE_W / 2, cy2 + TILE_H / 2 - lift);
                    const bottom = perspPt(cx2,              cy2 + TILE_H - lift);
                    const left   = perspPt(cx2 - TILE_W / 2, cy2 + TILE_H / 2 - lift);

                    const g = ctx.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
                    g.addColorStop(0, _adjustBright(bio.color1, bri));
                    g.addColorStop(1, _adjustBright(bio.color2, bri));
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.moveTo(top.x, top.y);
                    ctx.lineTo(right.x, right.y);
                    ctx.lineTo(bottom.x, bottom.y);
                    ctx.lineTo(left.x, left.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();

                    // Depth wall — south-east face.
                    const elevS = elevAtDg(x + 1, y);
                    const liftS = (elevS - 0.35) * ELEV_PX;
                    if (lift - liftS > 1.5) {
                        const botS = perspPt(cx2, cy2 + TILE_H - liftS);
                        const rightS = perspPt(cx2 + TILE_W / 2, cy2 + TILE_H / 2 - liftS);
                        ctx.fillStyle = 'rgba(0,0,0,0.22)';
                        ctx.beginPath();
                        ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(right.x, right.y);
                        ctx.lineTo(rightS.x, rightS.y); ctx.lineTo(botS.x, botS.y);
                        ctx.closePath(); ctx.fill();
                    }
                    const elevE = elevAtDg(x, y + 1);
                    const liftE = (elevE - 0.35) * ELEV_PX;
                    if (lift - liftE > 1.5) {
                        const botE = perspPt(cx2, cy2 + TILE_H - liftE);
                        const leftE = perspPt(cx2 - TILE_W / 2, cy2 + TILE_H / 2 - liftE);
                        ctx.fillStyle = 'rgba(0,0,0,0.30)';
                        ctx.beginPath();
                        ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y);
                        ctx.lineTo(leftE.x, leftE.y); ctx.lineTo(botE.x, botE.y);
                        ctx.closePath(); ctx.fill();
                    }
                }
            }

            // ── Day/night fog of war (drawn on tiles, BEFORE sprites
            //    so entities stay fully opaque and visible in the dark).
            const pScreen = iso(player.rx, player.ry);
            const pLift = (elevAtDg(player.wx, player.wy) - 0.35) * ELEV_PX;
            drawFogOfWar(ctx, W, H,
                pScreen.x + cam.cx, pScreen.y + cam.cy + TILE_H / 2 - pLift,
                timeOfDay);

            // PASS 2 — features + player, depth-sorted by wx+wy then wx.
            // Sprite sizes come from data.js (SPRITE_SIZES).
            const sprites = [];
            if (_dungeon) {
                // Dungeon features + creatures.
                for (const f of _dungeon.map.features) {
                    if (f.c >= minX && f.c <= maxX && f.r >= minY && f.r <= maxY) {
                        sprites.push({ wx: f.c, wy: f.r, emoji: f.emoji, size: SPRITE_SIZES[f.emoji] || 26 });
                    }
                }
                for (const cr of _dungeon.map.creatures) {
                    if (cr.dead) continue;
                    const aggro = cr.ai === 'aggressive' && Math.max(Math.abs(cr.rc - player.wx), Math.abs(cr.rr - player.wy)) <= 6;
                    sprites.push({ wx: cr.rc, wy: cr.rr, emoji: cr.emoji, size: SPRITE_SIZES[cr.emoji] || 22,
                                   hp: cr.hp, maxHp: cr.maxHp, isCreature: true, aggro });
                }
            } else {
                // Overworld features + creatures.
                const seenChunks = new Set();
                for (let y = minY; y <= maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        const f = world.featureAt(x, y);
                        if (f) sprites.push({ wx: x, wy: y, emoji: f.emoji, size: SPRITE_SIZES[f.emoji] || 26 });
                        const ccx = Math.floor(x / CHUNK_SIZE), ccy = Math.floor(y / CHUNK_SIZE);
                        seenChunks.add(ccx + ',' + ccy);
                    }
                }
                for (const key of seenChunks) {
                    const [ccx, ccy] = key.split(',').map(Number);
                    const ch = world.getChunk(ccx, ccy);
                    for (const cr of ch.creatures) {
                        if (cr.dead) continue;
                        const wx = ccx * CHUNK_SIZE + cr.rc;
                        const wy = ccy * CHUNK_SIZE + cr.rr;
                        if (wx < minX - 1 || wx > maxX + 1 || wy < minY - 1 || wy > maxY + 1) continue;
                        const isNight = _nightFactor(timeOfDay) > 0.5;
                        const effAI = (isNight && cr.ai === 'neutral') ? 'aggressive' : cr.ai;
                        const aggro = effAI === 'aggressive' && Math.max(Math.abs(wx - player.wx), Math.abs(wy - player.wy)) <= 6;
                        sprites.push({ wx, wy, emoji: cr.emoji, size: SPRITE_SIZES[cr.emoji] || 22,
                                       hp: cr.hp, maxHp: cr.maxHp, isCreature: true, aggro });
                    }
                }
            }
            sprites.push({ wx: player.rx, wy: player.ry, emoji: player.emoji, size: 32, isPlayer: true, flash: _playerFlash });
            sprites.sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy) || a.wx - b.wx);
            for (const s of sprites) {
                const p = iso(s.wx, s.wy);
                const rawSx = p.x + cam.cx;
                const rawSy = p.y + cam.cy;
                const elev = elevAtDg(Math.round(s.wx), Math.round(s.wy));
                const lift = (elev - 0.35) * ELEV_PX;
                const spriteScreenY = rawSy - lift + TILE_H / 2;
                const ps = perspScale(spriteScreenY, H);
                const sx = W / 2 + (rawSx - W / 2) * ps - (TILE_W * ps) / 2;
                const sy = H / 2 + ((rawSy - lift) - H / 2) * ps;
                const scaledSize = Math.round(s.size * ps);
                drawShadow(ctx, sx, sy, scaledSize);
                // Player damage flash: red glow under sprite.
                if (s.flash && s.flash > 0) {
                    const fa = Math.min(0.5, s.flash / 300);
                    ctx.fillStyle = `rgba(255,40,40,${fa.toFixed(2)})`;
                    ctx.beginPath();
                    ctx.ellipse(sx + TILE_W / 2, sy + TILE_H / 2, 16, 10, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                drawEmoji(ctx, sx, sy, s.emoji, scaledSize);
                // Aggro indicator — pulsing red triangle above hostile creatures.
                if (s.aggro) {
                    const pulse = 0.5 + 0.5 * Math.sin(_renderTime * 0.008);
                    ctx.fillStyle = `rgba(255,50,50,${(0.5 + pulse * 0.5).toFixed(2)})`;
                    const tw = TILE_W * ps;
                    const ax = sx + tw / 2, ay = sy - 6 * ps;
                    ctx.beginPath();
                    ctx.moveTo(ax, ay - 6); ctx.lineTo(ax - 4, ay); ctx.lineTo(ax + 4, ay);
                    ctx.closePath(); ctx.fill();
                }
                // HP bar above damaged creatures.
                if (s.isCreature && s.hp < s.maxHp) {
                    const bw = Math.round(24 * ps), bh = 3;
                    const tw = TILE_W * ps;
                    const bx = sx + tw / 2 - bw / 2;
                    const by = sy - 2 * ps;
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
                    const pct = Math.max(0, s.hp / s.maxHp);
                    const hpColor = pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336';
                    ctx.fillStyle = hpColor;
                    ctx.fillRect(bx, by, bw * pct, bh);
                }
            }

            // ── Player stat bars (top-left, below HUD) ─────
            const barX = 8, barY = H - 28, barW = 120, barH = 5, barGap = 8;
            function drawBar(y, pct, color) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(barX - 1, y - 1, barW + 2, barH + 2);
                ctx.fillStyle = color;
                ctx.fillRect(barX, y, barW * Math.max(0, pct), barH);
            }
            drawBar(barY,              player.hp / player.maxHp,           '#e04040');
            drawBar(barY - barH - barGap, player.mana / player.maxMana,     '#4080e0');
            drawBar(barY - (barH + barGap) * 2, player.stamina / player.maxStamina, '#e0c040');
            // Labels.
            ctx.font = "9px 'Inter', sans-serif";
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText('HP',  barX + barW + 4, barY + barH / 2);
            ctx.fillText('MP',  barX + barW + 4, barY - barH - barGap + barH / 2);
            ctx.fillText('SP',  barX + barW + 4, barY - (barH + barGap) * 2 + barH / 2);

            // ── Floating combat text ────────────────────────
            ctx.font = "bold 11px 'Inter', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const fl of _floaters) {
                const p = iso(fl.wx, fl.wy);
                const elev = world.elevAt(Math.round(fl.wx), Math.round(fl.wy));
                const lift = (elev - 0.35) * ELEV_PX;
                const fx = p.x + cam.cx;
                const fy = p.y + cam.cy + TILE_H / 2 - lift - (fl.age / fl.maxAge) * 20;
                const alpha = 1 - fl.age / fl.maxAge;
                ctx.fillStyle = fl.color.replace(')', ',' + alpha.toFixed(2) + ')').replace('rgb', 'rgba');
                // Fallback for hex colours.
                if (fl.color.startsWith('#')) {
                    const h = fl.color.replace('#', '');
                    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
                    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
                }
                ctx.strokeStyle = `rgba(0,0,0,${(alpha * 0.7).toFixed(2)})`;
                ctx.lineWidth = 2;
                ctx.strokeText(fl.text, fx, fy);
                ctx.fillText(fl.text, fx, fy);
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

            // Village markers (yellow squares) + creature dots (red) on minimap.
            const mpx = player.wx, mpy = player.wy;
            const mcx = Math.floor(mpx / CHUNK_SIZE), mcy = Math.floor(mpy / CHUNK_SIZE);
            for (let dcy = -2; dcy <= 2; dcy++) for (let dcx = -2; dcx <= 2; dcx++) {
                const ch = world.chunks.get((mcx+dcx)+','+(mcy+dcy));
                if (!ch) continue;
                for (const f of ch.features) {
                    if (!f.village && !f.npc && !f.merchant) continue;
                    const fwx = (mcx+dcx) * CHUNK_SIZE + f.c;
                    const fwy = (mcy+dcy) * CHUNK_SIZE + f.r;
                    const mx = fwx - mpx + 70, my = fwy - mpy + 70;
                    if (mx < 0 || mx >= 140 || my < 0 || my >= 140) continue;
                    miniCtx.fillStyle = f.merchant ? '#60ff60' : f.npc ? '#ffffff' : '#ffc857';
                    miniCtx.fillRect(mx, my, 2, 2);
                }
                for (const cr of ch.creatures) {
                    if (cr.dead) continue;
                    const fwx = (mcx+dcx) * CHUNK_SIZE + cr.c;
                    const fwy = (mcy+dcy) * CHUNK_SIZE + cr.r;
                    const mx = fwx - mpx + 70, my = fwy - mpy + 70;
                    if (mx < 0 || mx >= 140 || my < 0 || my >= 140) continue;
                    const isAgg = cr.ai === 'aggressive' || (_nightFactor(timeOfDay) > 0.5 && cr.ai === 'neutral');
                    miniCtx.fillStyle = isAgg ? '#ff4040' : '#80ff80';
                    miniCtx.fillRect(mx, my, 1, 1);
                }
            }
            // Player dot.
            miniCtx.fillStyle = '#ffc857';
            miniCtx.fillRect(69, 69, 3, 3);
            miniCtx.strokeStyle = 'rgba(0,0,0,0.6)';
            miniCtx.strokeRect(68.5, 68.5, 4, 4);
        }

        function updateHUD() {
            const b = biomeAtDg(player.wx, player.wy);
            const biome = (ALL_BIOMES[b] || BIOMES.grass).name;
            const hours = Math.floor(timeOfDay * 24);
            const mins  = Math.floor((timeOfDay * 24 * 60) % 60);
            const hh = String(hours).padStart(2, '0');
            const mm = String(mins).padStart(2, '0');
            const phase = timeOfDay < 0.25 ? '🌑' : timeOfDay < 0.42 ? '🌅' : timeOfDay < 0.66 ? '☀️' : timeOfDay < 0.83 ? '🌇' : '🌙';
            $hud.innerHTML = `❤️ <b>${Math.round(player.hp)}/${player.maxHp}</b> · 💧 <b>${Math.round(player.mana)}/${player.maxMana}</b> · ⚡ <b>${Math.round(player.stamina)}/${player.maxStamina}</b> · Lv <b>${player.level}</b> (${player.xp}/${player.xpNext})<br>📍 <b>${player.wx}, ${player.wy}</b> · ${biome} · ${phase} <b>${hh}:${mm}</b>`;
        }

        // ── Combat helpers ─────────────────────────────────
        function getWeaponDmg() {
            const w = equipment.weapon;
            if (!w) return 0;
            const map = { sword: 8, axe: 10, bow: 7, dagger: 5 };
            return map[w.key] || 4;
        }

        function attackCreature(cr) {
            if (cr.dead || player.attackCooldown > 0) return;
            const dist = Math.max(Math.abs((cr.c + Math.floor(cr.rc - cr.c)) - player.wx),
                                  Math.abs((cr.r + Math.floor(cr.rr - cr.r)) - player.wy));
            // Bow has range 3; melee range 1.5
            const range = equipment.weapon?.key === 'bow' ? 3 : 1.5;
            // Compute world pos of creature.
            const chCx = Math.floor(player.wx / CHUNK_SIZE), chCy = Math.floor(player.wy / CHUNK_SIZE);
            const cwx = chCx * CHUNK_SIZE + cr.c, cwy = chCy * CHUNK_SIZE + cr.r;
            const d = Math.max(Math.abs(cwx - player.wx), Math.abs(cwy - player.wy));
            if (d > range) return;

            if (player.stamina < 5) { addFloater(player.wx, player.wy, 'Exhausted!', '#ffaa00'); return; }
            player.stamina = Math.max(0, player.stamina - 8);
            const dmg = player.baseDmg + getWeaponDmg() + Math.floor(Math.random() * 3);
            cr.hp = Math.max(0, cr.hp - dmg);
            player.attackCooldown = 800;
            addFloater(cwx, cwy, '-' + dmg, '#ff4040');
            sfxHit();
            // Turn neutral creatures aggressive when attacked.
            if (cr.ai === 'neutral') cr.ai = 'aggressive';
            if (cr.hp <= 0) killCreature(cr, chCx, chCy);
        }

        function killCreature(cr, chCx, chCy) {
            cr.dead = true;
            sfxKill();
            const def = CREATURE_DEFS[cr.emoji] || { xp: 1, loot: [] };
            player.xp += def.xp;
            addFloater(chCx * CHUNK_SIZE + cr.c, chCy * CHUNK_SIZE + cr.r, '+' + def.xp + ' XP', '#ffc857');
            while (player.xp >= player.xpNext) {
                player.xp -= player.xpNext;
                player.level++;
                player.xpNext = Math.floor(player.xpNext * 1.5);
                player.maxHp += 10; player.hp = player.maxHp;
                player.maxMana += 5; player.mana = player.maxMana;
                player.maxStamina += 5; player.stamina = player.maxStamina;
                player.baseDmg += 1;
                sfxLevelUp();
                showDialogBubble('✦', 'Level up! You are now level ' + player.level);
            }
            // Loot drop at the creature's tile.
            if (_dungeon) {
                // Dungeon: add directly to dungeon features.
                for (const l of def.loot) {
                    if (Math.random() < l.rate) {
                        const lootDef = ITEMS[l.key];
                        if (lootDef && !_dungeon.map.features.find(f => f.c === cr.c && f.r === cr.r)) {
                            _dungeon.map.features.push({ c: cr.c, r: cr.r, emoji: lootDef.emoji, item: true, itemKey: l.key });
                        }
                        break;
                    }
                }
            } else {
                // Overworld: use persistent world delta system.
                const wx = chCx * CHUNK_SIZE + cr.c;
                const wy = chCy * CHUNK_SIZE + cr.r;
                for (const l of def.loot) {
                    if (Math.random() < l.rate) {
                        placeWorldItem(wx, wy, l.key);
                        break;
                    }
                }
            }
        }

        // Dungeon creature tick helper — same AI as overworld but on a flat array.
        function _tickCreatureList(creatures, ox, oy, dt, N) {
            for (const cr of creatures) {
                if (cr.dead) continue;
                if (cr.attackCooldown > 0) cr.attackCooldown -= dt;
                if (cr.moveT > 0) {
                    cr.moveT = Math.max(0, cr.moveT - dt);
                    const t = 1 - (cr.moveT / CREATURE_MOVE_MS);
                    cr.rc = cr.fromC + (cr.c - cr.fromC) * t;
                    cr.rr = cr.fromR + (cr.r - cr.fromR) * t;
                    continue;
                }
                cr.rc = cr.c; cr.rr = cr.r;
                const cwx = ox + cr.c, cwy = oy + cr.r;
                const distToPlayer = Math.max(Math.abs(cwx - player.wx), Math.abs(cwy - player.wy));
                if (cr.ai === 'aggressive' && distToPlayer <= 6) {
                    if (distToPlayer <= 1 && cr.attackCooldown <= 0) {
                        player.hp = Math.max(0, player.hp - cr.dmg);
                        cr.attackCooldown = 1200;
                        addFloater(player.wx, player.wy, '-' + cr.dmg, '#ff6060');
                        sfxHurt();
                        _playerFlash = 300;
                        if (player.hp <= 0) {
                            showDialogBubble('☠️', 'You have been slain!');
                            if (_dungeon) exitDungeon();
                            player.hp = player.maxHp; player.mana = player.maxMana; player.stamina = player.maxStamina;
                            player.wx = startX; player.wy = startY;
                            player.rx = startX; player.ry = startY;
                            _playerFlash = 600;
                        }
                        continue;
                    }
                    cr.timer += dt;
                    if (cr.timer < 400) continue;
                    cr.timer = 0;
                    const sdx = Math.sign(player.wx - cwx), sdy = Math.sign(player.wy - cwy);
                    const nc = cr.c + sdx, nr = cr.r + sdy;
                    if (nc >= 0 && nc < N && nr >= 0 && nr < N) {
                        cr.fromC = cr.c; cr.fromR = cr.r;
                        cr.c = nc; cr.r = nr;
                        cr.moveT = CREATURE_MOVE_MS * 0.7;
                    }
                    continue;
                }
                cr.timer += dt;
                if (cr.timer < cr.nextMoveAt) continue;
                cr.timer = 0;
                cr.nextMoveAt = 1200 + Math.random() * 3500;
                const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
                const [ddx, ddy] = dirs[Math.floor(Math.random() * 4)];
                const nc = cr.c + ddx, nr = cr.r + ddy;
                if (nc < 0 || nc >= N || nr < 0 || nr >= N) continue;
                cr.fromC = cr.c; cr.fromR = cr.r;
                cr.c = nc; cr.r = nr;
                cr.moveT = CREATURE_MOVE_MS;
            }
        }

        // Respawn dead creatures after 30–60 s.
        let _respawnTimer = 0;
        function tickCreatureRespawn(dt) {
            _respawnTimer += dt;
            if (_respawnTimer < 5000) return; // check every 5 s
            _respawnTimer = 0;
            const cx0 = Math.floor(player.wx / CHUNK_SIZE), cy0 = Math.floor(player.wy / CHUNK_SIZE);
            for (let dcy = -2; dcy <= 2; dcy++) for (let dcx = -2; dcx <= 2; dcx++) {
                const ch = world.chunks.get((cx0+dcx)+','+(cy0+dcy));
                if (!ch) continue;
                for (const cr of ch.creatures) {
                    if (!cr.dead) continue;
                    cr._deadTime = (cr._deadTime || 0) + 5000;
                    if (cr._deadTime > 30000 + Math.random() * 30000) {
                        const def = CREATURE_DEFS[cr.emoji] || { hp: 10 };
                        cr.dead = false; cr.hp = def.hp; cr.maxHp = def.hp;
                        cr.ai = (CREATURE_DEFS[cr.emoji] || {}).ai || 'neutral';
                        cr._deadTime = 0;
                        cr.attackCooldown = 0;
                    }
                }
            }
        }

        function tickCombat(dt) {
            if (player.attackCooldown > 0) player.attackCooldown -= dt;
            // Auto-attack: keep swinging at the target if still alive + in range.
            if (_autoTarget && !_autoTarget.dead) {
                attackCreature(_autoTarget);
            } else {
                _autoTarget = null;
            }
            // HP regen (slow).
            if (player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 0.3 * dt / 1000);
            // Mana regen.
            if (player.mana < player.maxMana) player.mana = Math.min(player.maxMana, player.mana + 0.5 * dt / 1000);
            // Stamina regen — faster when standing still (6/s), slower while moving (2/s).
            const moving = player.moveT > 0;
            const staminaRate = moving ? 2 : 6;
            if (player.stamina < player.maxStamina) player.stamina = Math.min(player.maxStamina, player.stamina + staminaRate * dt / 1000);
        }

        // ── Ambient biome sounds ─────────────────────────
        let _ambientOsc = null, _ambientGain = null, _ambientBiome = '';
        const BIOME_TONES = {
            grass: { freq: 180, type: 'sine',     gain: 0.012 },
            forest:{ freq: 140, type: 'sine',     gain: 0.015 },
            sand:  { freq: 260, type: 'triangle', gain: 0.008 },
            water: { freq: 220, type: 'sine',     gain: 0.018 },
            deep:  { freq: 190, type: 'sine',     gain: 0.020 },
            snow:  { freq: 300, type: 'triangle', gain: 0.010 },
            mountain:{ freq: 160, type: 'sine',   gain: 0.008 },
        };
        function tickAmbientSound() {
            const biome = world.biomeAt(player.wx, player.wy);
            if (biome === _ambientBiome) return;
            _ambientBiome = biome;
            const tone = BIOME_TONES[biome];
            if (!tone) return;
            if (!_sfxCtx) try { _sfxCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
            // Crossfade to new ambient tone.
            try {
                if (_ambientGain) _ambientGain.gain.linearRampToValueAtTime(0, _sfxCtx.currentTime + 0.5);
                if (_ambientOsc) setTimeout(() => { try { _ambientOsc.stop(); } catch {} }, 600);
            } catch {}
            const o = _sfxCtx.createOscillator();
            const g = _sfxCtx.createGain();
            o.type = tone.type; o.frequency.value = tone.freq;
            g.gain.setValueAtTime(0, _sfxCtx.currentTime);
            g.gain.linearRampToValueAtTime(tone.gain, _sfxCtx.currentTime + 0.8);
            o.connect(g); g.connect(_sfxCtx.destination);
            o.start();
            _ambientOsc = o; _ambientGain = g;
        }

        // ── Hover tooltip ─────────────────────────────────
        let _tooltip = null;
        canvas.addEventListener('mousemove', (ev) => {
            const rect = canvas.getBoundingClientRect();
            const { wx, wy } = canvasToWorldCell(ev.clientX - rect.left, ev.clientY - rect.top);
            let text = null;
            // Check creatures.
            const cx0 = Math.floor(wx / CHUNK_SIZE), cy0 = Math.floor(wy / CHUNK_SIZE);
            outer: for (let dcy = -1; dcy <= 1; dcy++) for (let dcx = -1; dcx <= 1; dcx++) {
                const ch = world.chunks.get((cx0+dcx)+','+(cy0+dcy));
                if (!ch) continue;
                for (const cr of ch.creatures) {
                    if (cr.dead) continue;
                    const cwx = (cx0+dcx) * CHUNK_SIZE + cr.c, cwy = (cy0+dcy) * CHUNK_SIZE + cr.r;
                    if (Math.abs(cwx - wx) <= 1 && Math.abs(cwy - wy) <= 1) {
                        const def = CREATURE_DEFS[cr.emoji] || {};
                        const aiLabel = cr.ai === 'aggressive' ? '⚠ Hostile' : cr.ai === 'passive' ? 'Passive' : 'Neutral';
                        text = `${cr.emoji} ${aiLabel} · HP ${Math.round(cr.hp)}/${cr.maxHp}`;
                        break outer;
                    }
                }
            }
            // Check features (items, NPCs, dungeons).
            if (!text) {
                const hit = _findItemNear(ev.clientX - rect.left, ev.clientY - rect.top, world, canvasToWorldCell);
                if (hit) {
                    const def = ITEMS[hit.feature.itemKey];
                    text = `${hit.feature.emoji} ${def ? def.name : 'Item'}`;
                    if (def && def.use) {
                        const parts = [];
                        if (def.use.hp) parts.push('+' + def.use.hp + ' HP');
                        if (def.use.mana) parts.push('+' + def.use.mana + ' MP');
                        if (def.use.stamina) parts.push('+' + def.use.stamina + ' SP');
                        if (parts.length) text += ' (' + parts.join(', ') + ')';
                    }
                } else {
                    const f = world.featureAt(wx, wy);
                    if (f && f.merchant) text = `${f.emoji} Merchant · Press Space to trade`;
                    else if (f && f.npc) text = `${f.emoji} NPC · Press Space to talk`;
                    else if (f && f.dungeon) text = `${f.emoji} Dungeon entrance`;
                }
            }
            if (text && text !== _tooltip) {
                _tooltip = text;
                canvas.title = text;
            } else if (!text && _tooltip) {
                _tooltip = null;
                canvas.title = '';
            }
        });

        // ── Click-to-attack (+ auto-attack on hold) ─────
        let _autoTarget = null; // creature ref, cleared on pointerup or target death/far
        canvas.addEventListener('pointerup', () => { _autoTarget = null; });

        canvas.addEventListener('click', (ev) => {
            if (ev.button !== 0) return;
            const rect = canvas.getBoundingClientRect();
            const { wx, wy } = canvasToWorldCell(ev.clientX - rect.left, ev.clientY - rect.top);

            // Search creatures — in dungeon use the flat array, overworld uses chunks.
            const creatureSources = [];
            if (_dungeon) {
                creatureSources.push({ creatures: _dungeon.map.creatures, ox: 0, oy: 0 });
            } else {
                const cx0 = Math.floor(wx / CHUNK_SIZE), cy0 = Math.floor(wy / CHUNK_SIZE);
                for (let dcy = -1; dcy <= 1; dcy++) for (let dcx = -1; dcx <= 1; dcx++) {
                    const ch = world.chunks.get((cx0+dcx)+','+(cy0+dcy));
                    if (ch) creatureSources.push({ creatures: ch.creatures, ox: (cx0+dcx) * CHUNK_SIZE, oy: (cy0+dcy) * CHUNK_SIZE });
                }
            }
            for (const src of creatureSources) {
                for (const cr of src.creatures) {
                    if (cr.dead) continue;
                    const cwx = src.ox + cr.c, cwy = src.oy + cr.r;
                    if (Math.abs(cwx - wx) <= 1 && Math.abs(cwy - wy) <= 1) {
                        attackCreature(cr);
                        _autoTarget = cr;
                        return;
                    }
                }
            }
        });

        function tickCreatures(dt) {
            // In dungeon, tick dungeon creatures directly.
            if (_dungeon) {
                _tickCreatureList(_dungeon.map.creatures, 0, 0, dt, DUNGEON_SIZE);
                return;
            }
            const cx0 = Math.floor(player.wx / CHUNK_SIZE), cy0 = Math.floor(player.wy / CHUNK_SIZE);
            for (let dcy = -1; dcy <= 1; dcy++) {
                for (let dcx = -1; dcx <= 1; dcx++) {
                    const ch = world.chunks.get((cx0 + dcx) + ',' + (cy0 + dcy));
                    if (!ch) continue;
                    for (const cr of ch.creatures) {
                        if (cr.dead) continue;
                        // Attack cooldown.
                        if (cr.attackCooldown > 0) cr.attackCooldown -= dt;
                        // Advance an in-progress tween.
                        if (cr.moveT > 0) {
                            cr.moveT = Math.max(0, cr.moveT - dt);
                            const t = 1 - (cr.moveT / CREATURE_MOVE_MS);
                            cr.rc = cr.fromC + (cr.c - cr.fromC) * t;
                            cr.rr = cr.fromR + (cr.r - cr.fromR) * t;
                            continue;
                        }
                        cr.rc = cr.c; cr.rr = cr.r;

                        // World coords of this creature.
                        const cwx = (cx0 + dcx) * CHUNK_SIZE + cr.c;
                        const cwy = (cy0 + dcy) * CHUNK_SIZE + cr.r;
                        const distToPlayer = Math.max(Math.abs(cwx - player.wx), Math.abs(cwy - player.wy));

                        // At night, neutral creatures turn aggressive (UO-style danger).
                        const isNight = _nightFactor(timeOfDay) > 0.5;
                        const effectiveAI = (isNight && cr.ai === 'neutral') ? 'aggressive' : cr.ai;

                        // Aggressive AI: chase player + attack when adjacent.
                        if (effectiveAI === 'aggressive' && distToPlayer <= 6) {
                            if (distToPlayer <= 1 && cr.attackCooldown <= 0) {
                                player.hp = Math.max(0, player.hp - cr.dmg);
                                cr.attackCooldown = 1200;
                                addFloater(player.wx, player.wy, '-' + cr.dmg, '#ff6060');
                                sfxHurt();
                                _playerFlash = 300;
                                if (player.hp <= 0) {
                                    // Death penalty: lose gold from backpack.
                                    const goldCount = inventory.items.filter(i => i.key === 'gold').length;
                                    const goldLost = Math.min(goldCount, Math.max(1, Math.floor(goldCount * 0.3)));
                                    let removed = 0;
                                    inventory.items = inventory.items.filter(i => {
                                        if (i.key === 'gold' && removed < goldLost) { removed++; return false; }
                                        return true;
                                    });
                                    saveInventory();
                                    const lostMsg = goldLost > 0 ? ' Lost ' + goldLost + ' gold.' : '';
                                    showDialogBubble('☠️', 'You have been slain! Respawning...' + lostMsg);
                                    player.hp = player.maxHp; player.mana = player.maxMana; player.stamina = player.maxStamina;
                                    player.wx = startX; player.wy = startY;
                                    player.rx = startX; player.ry = startY;
                                    _playerFlash = 600;
                                }
                                continue;
                            }
                            cr.timer += dt;
                            if (cr.timer < 400) continue;
                            cr.timer = 0;
                            // Chase: step toward player.
                            const sdx = Math.sign(player.wx - cwx);
                            const sdy = Math.sign(player.wy - cwy);
                            const nc = cr.c + sdx, nr = cr.r + sdy;
                            if (nc >= 0 && nc < CHUNK_SIZE && nr >= 0 && nr < CHUNK_SIZE) {
                                cr.fromC = cr.c; cr.fromR = cr.r;
                                cr.c = nc; cr.r = nr;
                                cr.moveT = CREATURE_MOVE_MS * 0.7;
                            }
                            continue;
                        }

                        // Passive AI: flee if player within 4 tiles.
                        if (effectiveAI === 'passive' && distToPlayer <= 4) {
                            cr.timer += dt;
                            if (cr.timer < 300) continue;
                            cr.timer = 0;
                            const fdx = Math.sign(cwx - player.wx);
                            const fdy = Math.sign(cwy - player.wy);
                            const nc = cr.c + fdx, nr = cr.r + fdy;
                            if (nc >= 0 && nc < CHUNK_SIZE && nr >= 0 && nr < CHUNK_SIZE &&
                                ch.biomes[nr * CHUNK_SIZE + nc] === cr.biome) {
                                cr.fromC = cr.c; cr.fromR = cr.r;
                                cr.c = nc; cr.r = nr;
                                cr.moveT = CREATURE_MOVE_MS * 0.6;
                            }
                            continue;
                        }

                        // Default wander.
                        cr.timer += dt;
                        if (cr.timer < cr.nextMoveAt) continue;
                        cr.timer = 0;
                        cr.nextMoveAt = 1200 + Math.random() * 3500;
                        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
                        const [dx, dy] = dirs[Math.floor(Math.random() * 4)];
                        const nc = cr.c + dx, nr = cr.r + dy;
                        if (nc < 0 || nc >= CHUNK_SIZE || nr < 0 || nr >= CHUNK_SIZE) continue;
                        if (ch.biomes[nr * CHUNK_SIZE + nc] !== cr.biome) continue;
                        if (ch.features.find(f => f.c === nc && f.r === nr && f.blocks)) continue;
                        cr.fromC = cr.c; cr.fromR = cr.r;
                        cr.c = nc; cr.r = nr;
                        cr.moveT = CREATURE_MOVE_MS;
                    }
                }
            }
        }

        function loop(now) {
            const dt = Math.min(50, now - last); last = now;
            _renderTime += dt;
            tryStepFromHeld();
            player.update(dt);
            tickCreatures(dt);
            tickCombat(dt);
            tickFloaters(dt);
            tickCreatureRespawn(dt);
            if (_playerFlash > 0) _playerFlash = Math.max(0, _playerFlash - dt);
            tickAmbientSound();
            render();
            updateHUD();
            renderMinimap();

            // Advance time-of-day (wraps 0..1 over DAY_MS).
            timeOfDay = (timeOfDay + dt / DAY_MS) % 1;

            // Save every ~2s.
            saveTimer += dt;
            if (saveTimer > 2000) {
                saveTimer = 0;
                sdk.storage.set(STATE_KEY, {
                    seed, px: player.wx, py: player.wy, timeOfDay,
                    hp: player.hp, mana: player.mana, stamina: player.stamina,
                    level: player.level, xp: player.xp, xpNext: player.xpNext,
                    maxHp: player.maxHp, maxMana: player.maxMana, maxStamina: player.maxStamina, baseDmg: player.baseDmg,
                }).catch(() => {});
                worldRow.lastPlayed = Date.now();
                sdk.storage.set('worlds', worlds).catch(() => {});
            }

            rafId = requestAnimationFrame(loop);
        }
        rafId = requestAnimationFrame(loop);

        // ── Cleanup ──────────────────────────────────────
        root.__uaCleanup = () => {
            cancelAnimationFrame(rafId);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('keyup', onKey);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            try { _ambientOsc?.stop(); _ambientOsc = null; } catch {}
        };
    },

    async unmount(root) {
        try { root.__uaCleanup?.(); } catch {}
        delete root.__uaCleanup;
    }
};
