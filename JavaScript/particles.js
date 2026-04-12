/* ════════════════════════════
   RUNE PARTICLES + CURSOR TRAIL
════════════════════════════ */
function initRuneParticles() {
    const canvas = document.getElementById('rune-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const RUNES   = RUNE_SET;
    // dark:  base #6e8efb (blue) → hot #d0eaff (white-blue near cursor)
    // light: base #5a320a (sepia ink) → hot #bc6c14 (amber candlelight near cursor)
    const THEMES = {
        dark:  { br: 110, bg: 142, bb: 251, hr: 255, hg: 200, hb: 87, trail: '#ffc857',  tShadow: 'rgba(255,200,87,0.55)' },
        light: { br:  90, bg:  50, bb:  10, hr: 139, hg: 105, hb:  20, trail: '#8b6914',  tShadow: 'rgba(139,105,20,0.55)' }
    };
    const MOUSE_R = 170;
    const MC_R    = 190;
    let mouse = { x: -999, y: -999 };
    let frame = 0;
    const trail = [];

    function getTheme() {
        return _isLight ? THEMES.light : THEMES.dark;
    }
    function runeColor(c, t) {
        return `rgb(${Math.round(c.br + t*(c.hr-c.br))},${Math.round(c.bg + t*(c.hg-c.bg))},${Math.round(c.bb + t*(c.hb-c.bb))})`;
    }

    // Cache MC center — recompute only on resize or section change
    let mcCache = null, mcDirty = true;
    function getMCCenter() {
        if (!mcDirty) return mcCache;
        mcDirty = false;
        const el = document.querySelector('.magic-circle-frame');
        if (!el) return (mcCache = null);
        const r = el.getBoundingClientRect();
        return (mcCache = { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        mcDirty = true;
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        trail.push({ x: e.clientX, y: e.clientY, t: Date.now() });
        if (trail.length > 15) trail.shift();
    });

    const ATTRACT_R = 68;   // radius where magnet kicks in
    const ORBIT_R   = 46;   // target orbit distance from cursor
    const MAX_V     = 0.45; // absolute speed cap for all runes

    function spawn() {
        // Random slow speed with uniform direction → varied but always gentle
        const spd = 0.06 + Math.random() * 0.22;
        const ang = Math.random() * Math.PI * 2;
        return {
            x:        Math.random() * window.innerWidth,
            y:        Math.random() * window.innerHeight,
            vx:       Math.cos(ang) * spd,
            vy:       Math.sin(ang) * spd,
            char:     RUNES[Math.floor(Math.random() * RUNES.length)],
            base:     18 + Math.random() * 20,
            phase:    Math.random() * Math.PI * 2,
            alpha:    0.13 + Math.random() * 0.17,
            glowM:    0,
            glowMC:   0,
            pull:     0,
            orbitDir: Math.random() < 0.5 ? 1 : -1,
            life:     0
        };
    }

    const particles = Array.from({ length: 65 }, spawn);

    function tick() {
        if (!_tabVisible) { requestAnimationFrame(tick); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frame++;

        // Thin cursor trail — single save/restore for all points
        const now = Date.now();
        const c = getTheme();
        ctx.save();
        ctx.fillStyle = c.trail;
        ctx.shadowColor = c.tShadow;
        for (let ti = 0; ti < trail.length; ti++) {
            const pt = trail[ti];
            const age = now - pt.t;
            if (age > 480) continue;
            const life = 1 - age / 480;
            ctx.globalAlpha = life * 0.30;
            ctx.shadowBlur  = life * 8;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, life * 2.5 + 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        const mc = getMCCenter();

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.life < 1) p.life = Math.min(1, p.life + 0.012);

            // Off-screen → respawn
            if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
                particles[i] = spawn();
                continue;
            }

            // Edge fade
            const edge = Math.min(p.x / 80, (canvas.width - p.x) / 80,
                                  p.y / 80, (canvas.height - p.y) / 80, 1);

            // Very subtle float: stays between 90%–100% so runes never "shrink to nothing"
            const float = 0.90 + 0.10 * Math.sin(frame * 0.009 + p.phase);

            // Mouse proximity → color shift + size boost
            const dx = p.x - mouse.x, dy = p.y - mouse.y;
            const distM = Math.sqrt(dx * dx + dy * dy);
            p.glowM += ((distM < MOUSE_R ? 1 - distM / MOUSE_R : 0) - p.glowM) * 0.07;

            // ── Magnetic orbit ──────────────────────────────────────────
            // pull: 0=free drift, 1=fully captured in orbit
            p.pull += ((distM < ATTRACT_R && distM > 1 ? 1 : 0) - p.pull) * 0.04;

            if (p.pull > 0.01) {
                const nx = dx / distM, ny = dy / distM;
                const dr = distM - ORBIT_R;
                // Very subtle spring + tangential — minimal attraction
                p.vx += -dr * 0.0012 * p.pull * nx;
                p.vy += -dr * 0.0012 * p.pull * ny;
                p.vx += -ny * p.orbitDir * 0.004 * p.pull;
                p.vy +=  nx * p.orbitDir * 0.004 * p.pull;
                const damp = 1 - p.pull * 0.03;
                p.vx *= damp;
                p.vy *= damp;
            }

            // Hard speed cap — runes never rush
            const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (spd > MAX_V) { p.vx = p.vx / spd * MAX_V; p.vy = p.vy / spd * MAX_V; }
            // ────────────────────────────────────────────────────────────

            // Magic circle proximity → size boost only (no color change)
            let targetMC = 0;
            if (mc) {
                const mx = p.x - mc.x, my = p.y - mc.y;
                targetMC = Math.sqrt(mx * mx + my * my) < MC_R
                    ? 1 - Math.sqrt(mx * mx + my * my) / MC_R : 0;
            }
            p.glowMC += (targetMC - p.glowMC) * 0.05;

            // Orbit pulse: very slow intensity swell while circling
            const orbitPulse = p.pull > 0.15
                ? p.pull * (0.5 + 0.5 * Math.sin(frame * 0.025 + p.phase))
                : 0;

            const effectiveGlow = Math.min(1, p.glowM + orbitPulse * 0.7);

            // Size grows near cursor OR magic circle, returns to base when away
            const size  = p.base * float * (1 + Math.max(effectiveGlow, p.glowMC) * 0.65);
            const color = runeColor(c, effectiveGlow);
            const blur  = 2 + float * 3 + effectiveGlow * 30;
            const alpha = (p.alpha + effectiveGlow * 0.55) * edge * p.life;

            // Skip shadow entirely when rune is far from any attractor (biggest GPU saver)
            const sz = Math.round(size);
            ctx.globalAlpha = alpha;
            ctx.font        = `${sz}px serif`;
            ctx.fillStyle   = color;
            if (effectiveGlow > 0.04 || p.glowMC > 0.04) {
                ctx.shadowColor = color;
                ctx.shadowBlur  = blur;
            } else {
                ctx.shadowBlur  = 0;
            }
            ctx.fillText(p.char, p.x, p.y);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;

        // ── Constellation lines between nearby particles ──
        ctx.save();
        const LINK_DIST = 120;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i], b = particles[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < LINK_DIST) {
                    const strength = (1 - d / LINK_DIST);
                    // Only draw if at least one particle is near cursor or magic circle
                    const proximity = Math.max(a.glowM, b.glowM, a.glowMC * 0.5, b.glowMC * 0.5);
                    if (proximity < 0.02) continue;
                    ctx.globalAlpha = strength * proximity * 0.3 * Math.min(a.life, b.life);
                    ctx.strokeStyle = runeColor(c, proximity);
                    ctx.lineWidth = strength * 0.8;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();

        requestAnimationFrame(tick);
    }
    tick();
}
