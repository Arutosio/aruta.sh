/* Ultima Aruta — player.js: Player class */
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
        this.kills = 0;
        this.days = 0;
        this.poison = 0;    // remaining poison ticks (ms). 0 = not poisoned.
        this.poisonDps = 0; // damage per second while poisoned.
    }
    tryMove(dx, dy, passCheck) {
        if (this.moveT > 0) return false;
        const nx = this.wx + dx, ny = this.wy + dy;
        if (!passCheck(nx, ny)) return false;
        this.moveFrom = { wx: this.wx, wy: this.wy };
        this.wx = nx; this.wy = ny;
        // Stamina cost: each step drains 2 (4 in water = swimming). When exhausted, movement slows.
        this.stamina = Math.max(0, this.stamina - 2);
        this.moveT = this.stamina > 0 ? MOVE_MS : MOVE_MS * 1.8;
        // Footstep SFX (subtle).
        try { _sfx(100 + Math.random() * 60, 0.04, 'triangle', 0.02); } catch {}
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

