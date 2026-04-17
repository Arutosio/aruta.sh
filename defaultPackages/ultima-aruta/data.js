/* ╔══════════════════════════════════════════════════════════╗
 * ║  ULTIMA ARUTA — data.js                                    ║
 * ║  All game constants, item/creature/biome definitions.      ║
 * ║  Pure data — no logic, no side effects.                    ║
 * ╚══════════════════════════════════════════════════════════╝ */

export const TILE_W = 48;
export const TILE_H = 24;
export const CHUNK_SIZE = 32;
export const MOVE_MS = 440;
export const CREATURE_MOVE_MS = 600;
export const DAY_MS = 5 * 60 * 1000;
export const ELEV_PX = 18;
export const PERSP_STRENGTH = 0.65;
export const DUNGEON_SIZE = 24;
export const SELL_RATIO = 0.3;

export const BIOMES = {
    deep:     { color1: '#123864', color2: '#0a1e3d', passable: false, name: 'Deep Water' },
    water:    { color1: '#2a7abc', color2: '#1d5a92', passable: false, name: 'Water' },
    sand:     { color1: '#e0cc8a', color2: '#c4ad66', passable: true,  name: 'Beach' },
    grass:    { color1: '#5ca14b', color2: '#427a35', passable: true,  name: 'Plain' },
    forest:   { color1: '#2d6a2a', color2: '#1f4c1c', passable: true,  name: 'Forest' },
    mountain: { color1: '#7a6e5b', color2: '#554b3d', passable: false, name: 'Mountain' },
    snow:     { color1: '#e8e8f0', color2: '#b4b8cc', passable: true,  name: 'Snow' },
};

export const DUNGEON_BIOMES = {
    cave_floor: { color1: '#3a3040', color2: '#28202a', passable: true,  name: 'Cave' },
    cave_wall:  { color1: '#1a1418', color2: '#0e0a10', passable: false, name: 'Wall' },
    lava:       { color1: '#a03010', color2: '#601808', passable: false, name: 'Lava' },
    exit:       { color1: '#406040', color2: '#304830', passable: true,  name: 'Exit' },
};

export const ALL_BIOMES = { ...BIOMES, ...DUNGEON_BIOMES };

export const FEATURES = {
    sand:   [{ emoji: '🌴', rate: 0.02 }, { emoji: '🪨', rate: 0.01 }],
    grass:  [{ emoji: '🌳', rate: 0.03 }, { emoji: '🌿', rate: 0.04 }, { emoji: '🌾', rate: 0.02 }, { emoji: '🪨', rate: 0.005 }],
    forest: [{ emoji: '🌲', rate: 0.35 }, { emoji: '🌳', rate: 0.12 }, { emoji: '🍄', rate: 0.01 }, { emoji: '🪨', rate: 0.01 }],
    snow:   [{ emoji: '🌲', rate: 0.06 }, { emoji: '⛄', rate: 0.005 }],
};

export const CREATURE_DEFS = {
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
};

export const CREATURES = {
    grass:  { count: 3, pool: ['🐑', '🐇', '🦊', '🦌'] },
    forest: { count: 4, pool: ['🦌', '🐗', '🦉', '🦝'] },
    sand:   { count: 1, pool: ['🦀', '🦎'] },
    water:  { count: 3, pool: ['🐟', '🐠'] },
    snow:   { count: 1, pool: ['🦌', '🐺'] },
};

export const DUNGEON_CREATURES = [
    { emoji: '💀', ai: 'aggressive', hp: 45, dmg: 10, xp: 15, loot: [{ key: 'gold', rate: 0.6 }, { key: 'sword', rate: 0.1 }] },
    { emoji: '👻', ai: 'aggressive', hp: 35, dmg: 8,  xp: 12, loot: [{ key: 'scroll', rate: 0.3 }, { key: 'gem', rate: 0.15 }] },
    { emoji: '🦇', ai: 'aggressive', hp: 20, dmg: 5,  xp: 6,  loot: [{ key: 'herb', rate: 0.4 }] },
    { emoji: '🕷️', ai: 'aggressive', hp: 30, dmg: 7,  xp: 10, loot: [{ key: 'potion', rate: 0.2 }, { key: 'gold', rate: 0.4 }] },
];

export const VILLAGE = {
    houses:  ['🏠', '🏡', '🛖'],
    centers: ['⛪', '🏛️', '🏰'],
    npcs:    ['🧙', '🧝', '🧑‍🌾', '🧑‍🍳', '⚔️'],
};

export const ITEMS = {
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

export const ITEM_DROPS = {
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

export const MERCHANT_STOCK = [
    { key: 'potion',    price: 15 }, { key: 'scroll',    price: 12 },
    { key: 'berry',     price: 3 },  { key: 'apple',     price: 5 },
    { key: 'herb',      price: 4 },  { key: 'sword',     price: 40 },
    { key: 'shield',    price: 35 }, { key: 'helm',      price: 30 },
    { key: 'armor',     price: 50 }, { key: 'boots',     price: 20 },
    { key: 'bow',       price: 45 }, { key: 'ring',      price: 25 },
    { key: 'spellbook', price: 55 },
];

export const RECIPES = [
    { name: 'Potion',        inputs: ['herb', 'mushroom'],       output: 'potion' },
    { name: 'Strong Potion', inputs: ['herb', 'herb', 'berry'],  output: 'potion' },
    { name: 'Scroll',        inputs: ['flower', 'herb'],         output: 'scroll' },
    { name: 'Ring',          inputs: ['gem', 'gold'],            output: 'ring' },
    { name: 'Necklace',      inputs: ['gem', 'gem', 'gold'],    output: 'necklace' },
    { name: 'Dagger',        inputs: ['stone', 'stone'],         output: 'dagger' },
    { name: 'Axe',           inputs: ['stone', 'stone', 'herb'], output: 'axe' },
];

export const SLOTS = [
    { key: 'head',   label: '⛑️ Head'   }, { key: 'neck',   label: '📿 Neck'   },
    { key: 'cape',   label: '🧣 Cape'   }, { key: 'chest',  label: '🦺 Chest'  },
    { key: 'hands',  label: '🧤 Hands'  }, { key: 'ring',   label: '💍 Ring'   },
    { key: 'weapon', label: '⚔️ Weapon' }, { key: 'shield', label: '🛡️ Shield'},
    { key: 'feet',   label: '🥾 Feet'   }, { key: 'book',   label: '📖 Book'   },
];

export const DIALOGS = [
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
export const SPRITE_SIZES = {
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
};
