/* ============================================================
   ARUTA.SH — Medieval Fantasy Script
   Dati e contenuti: JavaScript/config.js
   ============================================================ */

/* ════════════════════════════
   STATE
════════════════════════════ */
let currentLang  = 'it';
let currentTheme = 'dark';
const RUNE_SET = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᛡᛣᛤᛥᛦ✦⊕⋆◈✧';
// bioTimeout scoped inside typewriterBio

/* ════════════════════════════
   PERFORMANCE: Cached globals (avoid DOM reads in loops)
════════════════════════════ */
let _isLight = false;          // cached theme check — updated in toggleTheme
let _tabVisible = true;        // visibility state — pause animations when hidden

document.addEventListener('visibilitychange', () => {
    _tabVisible = !document.hidden;
});

/* ════════════════════════════
   INIT
════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const savedLang  = localStorage.getItem('aruta_lang');
    const savedTheme = localStorage.getItem('aruta_theme');

    currentLang  = (savedLang && i18n[savedLang]) ? savedLang : detectLanguage();
    currentTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    document.documentElement.setAttribute('data-theme', currentTheme);
    _isLight = currentTheme === 'light';
    document.documentElement.setAttribute('lang', currentLang === 'fn' ? 'en' : currentLang);
    updateThemeIcon();
    setActiveLangBtn(currentLang);

    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    initRuneParticles();
    initMagicCursor();
    initParallax();
    initClickSpells();

    if (sessionStorage.getItem('aruta_summoned')) {
        // Skip summoning on repeat visits in same session
        const overlay = document.getElementById('summon-overlay');
        if (overlay) overlay.remove();
        showApp();
    } else {
        initSummonCanvas();
        runSummoning(() => {
            sessionStorage.setItem('aruta_summoned', '1');
            showApp();
        });
    }

    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('lang-select').addEventListener('change', e => switchLanguage(e.target.value));
});

/* ════════════════════════════
   LANGUAGE DETECTION
════════════════════════════ */
function detectLanguage() {
    const code = (navigator.language || 'en').split('-')[0].toLowerCase();
    if (i18n[code]) return code;
    const map = { pt:'es', ca:'es', gl:'es' };
    return map[code] || 'en';
}

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
        const sec = document.getElementById('sec-home');
        if (!sec || sec.hidden) return (mcCache = null);
        const el = sec.querySelector('.magic-circle-frame');
        if (!el) return (mcCache = null);
        const r = el.getBoundingClientRect();
        return (mcCache = { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    // Invalidate cache on resize and section switches
    document.addEventListener('click', e => { if (e.target.closest('.sec-btn')) mcDirty = true; });

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

/* ════════════════════════════
   MAGIC CURSOR
════════════════════════════ */
function initMagicCursor() {
    const el = document.getElementById('magic-cursor');
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;

    // Hide native cursor everywhere — the magic dot replaces it
    document.documentElement.classList.add('magic-cursor-active');

    window.addEventListener('mousemove', e => {
        el.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    });

    // Ring expands over interactive elements (delegation handles dynamic cards)
    document.addEventListener('mouseover', e => {
        if (e.target.closest('a, button')) el.classList.add('cursor-hover');
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest('a, button')) el.classList.remove('cursor-hover');
    });
}

/* ════════════════════════════
   PARALLAX DEPTH
════════════════════════════ */
function initParallax() {
    const ring1 = document.querySelector('.bg-ring-1');
    const ring2 = document.querySelector('.bg-ring-2');
    const magicBg = document.querySelector('.magic-bg');
    if (!ring1 || !ring2 || !magicBg) return;

    let mx = 0.5, my = 0.5;
    let cx = 0.5, cy = 0.5;

    window.addEventListener('mousemove', e => {
        mx = e.clientX / window.innerWidth;
        my = e.clientY / window.innerHeight;
    });

    function parallaxTick() {
        if (!_tabVisible) { requestAnimationFrame(parallaxTick); return; }
        cx += (mx - cx) * 0.04;
        cy += (my - cy) * 0.04;

        const offX = (cx - 0.5) * 30;
        const offY = (cy - 0.5) * 20;

        // Shift background pseudo-elements via CSS custom properties
        magicBg.style.setProperty('--px', `${offX * 0.6}px`);
        magicBg.style.setProperty('--py', `${offY * 0.6}px`);

        // Shift rings subtly via CSS custom properties (avoids layout thrashing)
        ring1.style.setProperty('--parallax-x', `${offX * 0.3}px`);
        ring1.style.setProperty('--parallax-y', `${offY * 0.3}px`);
        ring2.style.setProperty('--parallax-x', `${offX * -0.2}px`);
        ring2.style.setProperty('--parallax-y', `${offY * -0.2}px`);

        requestAnimationFrame(parallaxTick);
    }
    parallaxTick();
}

/* ════════════════════════════
   CLICK SPELL BURST
════════════════════════════ */
function initClickSpells() {
    const RUNES = RUNE_SET;
    const BURST_COUNT = 12;

    document.addEventListener('click', e => {
        // Don't burst on interactive elements
        if (e.target.closest('a, button, select, input')) return;

        for (let i = 0; i < BURST_COUNT; i++) {
            const el = document.createElement('div');
            el.className = 'spell-burst';
            el.setAttribute('data-rune', RUNES[Math.floor(Math.random() * RUNES.length)]);

            const angle = (i / BURST_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist  = 40 + Math.random() * 60;
            el.style.left = `${e.clientX}px`;
            el.style.top  = `${e.clientY}px`;
            el.style.setProperty('--bx', `${Math.cos(angle) * dist}px`);
            el.style.setProperty('--by', `${Math.sin(angle) * dist}px`);
            el.style.animationDelay = `${Math.random() * 0.08}s`;

            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }
    });
}

/* ════════════════════════════
   INTERACTIVE MAGIC CIRCLE
   4 rings with auto-rotation + drag to rotate + alignment easter egg
════════════════════════════ */
function initMagicCircleInteraction() {
    const frame = document.querySelector('.magic-circle-frame');
    if (!frame) return;

    // Speeds start at 0 and ramp up to target over 2 seconds
    const TARGET_SPEEDS = [0.3, 0.5, 0.7, 0.9];
    const rings = [
        { el: frame.querySelector('.mc-outer'), angle: 0, speed: 0, targetSpeed: 0.3, dir:  1 },
        { el: frame.querySelector('.mc-mid'),   angle: 0, speed: 0, targetSpeed: 0.5, dir: -1 },
        { el: frame.querySelector('.mc-rune'),  angle: 0, speed: 0, targetSpeed: 0.7, dir: -1 },
        { el: frame.querySelector('.mc-inner'), angle: 0, speed: 0, targetSpeed: 0.9, dir:  1 }
    ].filter(r => r.el);
    const ringsStartTime = performance.now();

    let dragging = null;   // which ring index is being dragged
    let dragStart = 0;     // angle at drag start
    let dragAngleStart = 0;
    let lastDragAngle = 0;
    let lastDragTime = 0;
    let alignmentGrace = true; // block alignment check for first 5s (rings start at 0 = "aligned")
    let alignTriggered = false;

    function getAngle(e, rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    }

    // Detect which ring based on distance from center
    function getRingIndex(e) {
        const rect = frame.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dist = Math.sqrt((clientX - cx) ** 2 + (clientY - cy) ** 2);
        const maxR = rect.width / 2;
        const ratio = dist / maxR;

        // Map distance to ring: outer > mid > rune > inner > portrait
        if (ratio > 0.86) return 0;      // outer (500px)
        if (ratio > 0.72) return 1;      // mid (430px)
        if (ratio > 0.60) return 2;      // rune (370px)
        if (ratio > 0.48) return 3;      // inner (320px)
        return -1;                        // portrait area
    }

    function onDown(e) {
        const idx = getRingIndex(e);
        if (idx < 0 || idx >= rings.length) return;
        e.preventDefault();
        dragging = idx;
        rings[idx].el.classList.add('mc-dragging');
        const rect = frame.getBoundingClientRect();
        dragStart = getAngle(e, rect);
        dragAngleStart = rings[idx].angle;
        lastDragAngle = dragStart;
        lastDragTime = performance.now();
    }

    function onMove(e) {
        if (dragging === null) return;
        const rect = frame.getBoundingClientRect();
        const current = getAngle(e, rect);
        const delta = current - dragStart;
        rings[dragging].angle = dragAngleStart + delta;

        // Track velocity for release
        lastDragAngle = current;
        lastDragTime = performance.now();
    }

    function onUp(e) {
        if (dragging === null) return;
        const r = rings[dragging];
        r.el.classList.remove('mc-dragging');

        // Calculate release velocity from drag movement
        const rect = frame.getBoundingClientRect();
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const finalAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        const dt = Math.max(1, performance.now() - lastDragTime);
        let velocity = (finalAngle - lastDragAngle) / dt * 16; // degrees per frame

        // Clamp velocity
        velocity = Math.max(-5, Math.min(5, velocity));

        // Apply release velocity as the new speed+direction
        if (Math.abs(velocity) > 0.1) {
            r.speed = Math.abs(velocity);
            r.dir = velocity > 0 ? 1 : -1;
        }
        // Friction: speed decays slowly over time (handled in tickRings)

        dragging = null;
    }

    frame.addEventListener('mousedown', onDown);
    frame.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // Disable alignment grace period after 5s (rings need time to diverge from 0°)
    setTimeout(() => { alignmentGrace = false; }, 5000);

    // Check alignment easter egg: all rings within ±15° of 0
    function checkAlignment() {
        if (alignTriggered || alignmentGrace) return;
        const aligned = rings.every(r => {
            const norm = ((r.angle % 360) + 360) % 360;
            return norm < 15 || norm > 345;
        });
        if (aligned) {
            alignTriggered = true;
            triggerAlignmentEasterEgg();
            // Reset after 10s
            setTimeout(() => alignTriggered = false, 10000);
        }
    }

    function triggerAlignmentEasterEgg() {
        // All rings aligned — magic burst + glow flash
        const frame = document.querySelector('.magic-circle-frame');
        if (!frame) return;

        // Bright flash
        frame.style.transition = 'filter 0.3s';
        frame.style.filter = 'drop-shadow(0 0 40px rgba(167,139,250,0.9)) drop-shadow(0 0 80px rgba(255,200,87,0.6)) brightness(1.8)';

        // Burst particles from center
        const rect = frame.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const RUNES = RUNE_SET;

        for (let i = 0; i < 20; i++) {
            const el = document.createElement('div');
            el.className = 'spell-burst';
            el.setAttribute('data-rune', RUNES[Math.floor(Math.random() * RUNES.length)]);
            const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const dist = 60 + Math.random() * 100;
            el.style.left = cx + 'px';
            el.style.top = cy + 'px';
            el.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
            el.style.setProperty('--by', Math.sin(angle) * dist + 'px');
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }

        // Temporarily speed up all rings
        rings.forEach(r => r.speed *= 4);
        setTimeout(() => {
            rings.forEach(r => r.speed /= 4);
            frame.style.filter = '';
            frame.style.transition = '';
        }, 3000);
    }

    // Fade in rings + ambient glow after a short delay so CSS doesn't flash on load
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            rings.forEach(r => r.el.classList.add('mc-ready'));
            frame.classList.add('mc-frame-ready');
        });
    });

    // Animation loop — auto-rotate with friction + apply transform
    function tickRings() {
        if (!_tabVisible) { requestAnimationFrame(tickRings); return; }
        // Ramp up speed over first 2 seconds
        const elapsed = performance.now() - ringsStartTime;
        const rampUp = Math.min(1, elapsed / 2000);

        for (const r of rings) {
            if (dragging === null || rings[dragging] !== r) {
                // During ramp-up, lerp speed toward target
                if (rampUp < 1 && r.speed < r.targetSpeed) {
                    r.speed = r.targetSpeed * rampUp;
                }
                r.angle += r.speed * r.dir;
                // Gentle friction — speed decays toward a minimum idle speed
                const minSpeed = 0.15;
                if (rampUp >= 1 && r.speed > minSpeed) {
                    r.speed *= 0.998;
                    if (r.speed < minSpeed) r.speed = minSpeed;
                }
            }
            r.el.style.transform = `rotate(${r.angle}deg)`;
        }
        checkAlignment();
        requestAnimationFrame(tickRings);
    }
    tickRings();
}

/* ════════════════════════════
   FIREFLY NAV SYSTEM
════════════════════════════ */
function initFireflies() {
    const COUNT = 10;       // fireflies per active button
    const pools = new Map(); // btn → firefly[]

    function spawnFirefly(btn) {
        const el = document.createElement('div');
        el.className = 'firefly';
        btn.appendChild(el);

        // Each firefly has its own orbit params
        const f = {
            el,
            // Random elliptical orbit center offset from button center
            cx: 0.3 + Math.random() * 0.4,    // 30%-70% of width
            cy: 0.2 + Math.random() * 0.6,    // 20%-80% of height
            rx: 8 + Math.random() * 18,        // orbit radius X
            ry: 4 + Math.random() * 10,        // orbit radius Y
            angle: Math.random() * Math.PI * 2,
            speed: 0.008 + Math.random() * 0.018, // radians per frame
            dir: Math.random() < 0.5 ? 1 : -1,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.02 + Math.random() * 0.03,
            pulsePhase: Math.random() * Math.PI * 2,
            size: 3 + Math.random() * 3
        };
        el.style.width  = f.size + 'px';
        el.style.height = f.size + 'px';

        // Fade in
        requestAnimationFrame(() => el.classList.add('alive'));
        return f;
    }

    function killFireflies(btn) {
        const flies = pools.get(btn);
        if (!flies) return;
        flies.forEach(f => {
            f.el.classList.remove('alive');
            f.el.classList.add('dying');
            setTimeout(() => f.el.remove(), 600);
        });
        pools.delete(btn);
    }

    // Cache button dimensions (avoid reflow in loop)
    const btnSizes = new Map();
    function cacheBtnSizes() {
        document.querySelectorAll('.sec-btn').forEach(btn => {
            btnSizes.set(btn, { w: btn.offsetWidth, h: btn.offsetHeight });
        });
    }
    window.addEventListener('resize', cacheBtnSizes);

    function activateBtn(btn) {
        if (pools.has(btn)) return;
        cacheBtnSizes(); // cache once on activate
        const flies = [];
        for (let i = 0; i < COUNT; i++) {
            flies.push(spawnFirefly(btn));
        }
        pools.set(btn, flies);
    }

    // Animation loop — uses cached sizes, no boxShadow recalc
    function tick() {
        if (!_tabVisible) { requestAnimationFrame(tick); return; }
        pools.forEach((flies, btn) => {
            const size = btnSizes.get(btn) || { w: 80, h: 40 };
            for (const f of flies) {
                f.angle += f.speed * f.dir;
                f.wobble += f.wobbleSpeed;

                const wobbleX = Math.sin(f.wobble) * 3;
                const wobbleY = Math.cos(f.wobble * 0.7) * 2;
                const x = f.cx * size.w + Math.cos(f.angle) * f.rx + wobbleX;
                const y = f.cy * size.h + Math.sin(f.angle) * f.ry + wobbleY;

                // Only update position + opacity (GPU-friendly, no boxShadow recalc)
                f.pulsePhase += 0.03;
                const pulse = 0.5 + 0.5 * Math.sin(f.pulsePhase);

                f.el.style.transform = `translate(${x}px, ${y}px)`;
                f.el.style.opacity = 0.35 + pulse * 0.65;
            }
        });
        requestAnimationFrame(tick);
    }
    tick();

    // Watch for active button changes
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.sec-btn').forEach(btn => {
            if (btn.classList.contains('active')) {
                activateBtn(btn);
            } else {
                killFireflies(btn);
            }
        });
    });

    // Observe class changes on all sec-btns
    document.querySelectorAll('.sec-btn').forEach(btn => {
        observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
    });

    // Activate initial active button
    const initial = document.querySelector('.sec-btn.active');
    if (initial) activateBtn(initial);
}

/* ════════════════════════════
   SUMMONING CIRCLE (boot canvas)
════════════════════════════ */
function initSummonCanvas() {
    const canvas = document.getElementById('summon-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Limit summoning canvas to ~30 fps to cut GPU load during page load
    const SUMMON_INTERVAL = 1000 / 30;
    let lastSummonTime = 0;
    let t = 0;
    function drawSummonCircle(ts) {
        raf = requestAnimationFrame(drawSummonCircle);
        if (ts - lastSummonTime < SUMMON_INTERVAL) return;
        lastSummonTime = ts;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx    = canvas.width  / 2;
        const cy    = canvas.height / 2;
        const maxR  = Math.min(canvas.width, canvas.height) * 0.36;
        const grow  = Math.min(1, t / 90);
        const pulse = 0.82 + 0.18 * Math.sin(t * 0.05);

        const light = _isLight;
        const G = light ? 'rgba(90,50,8,'   : 'rgba(255,200,87,';   // ocra / gold
        const P = light ? 'rgba(139,28,34,' : 'rgba(167,139,250,'; // cremisi / viola
        const E = light ? 'rgba(72,40,8,'   : 'rgba(52,211,153,';  // seppia / smeraldo

        ctx.save();
        ctx.translate(cx, cy);

        // ── L1: Anello esterno + 16 dot + glifi runici (CW lento) ──────
        ctx.save();
        ctx.rotate(t * 0.005);
        ctx.shadowColor = `${G}0.80)`; ctx.shadowBlur = 10;
        const r1 = maxR * grow;
        drawRing(ctx, 0, 0, r1,        3.5, `${G}0.45)`, [6, 10]);
        drawRing(ctx, 0, 0, r1 * 0.96, 1.2, `${G}0.15)`, [1, 5]);
        drawRuneDots(ctx, 0, 0, r1, 16, `${G}0.45)`, 2);
        drawRuneDots(ctx, 0, 0, r1, 4,  `${G}0.90)`, 4.5);
        drawRuneArc(ctx, 0, 0, r1 * 0.89, 24, `${G}0.28)`, maxR * 0.040);
        ctx.restore();

        // ── L2: Tacche bussola (CCW lento) ─────────────────────────────
        ctx.save();
        ctx.rotate(-t * 0.009);
        ctx.shadowColor = `${G}0.60)`; ctx.shadowBlur = 7;
        const r2 = maxR * 0.83 * grow;
        drawRing(ctx, 0, 0, r2, 2.0, `${G}0.25)`, [3, 6]);
        drawTickMarks(ctx, 0, 0, r2, 24, r2 * 0.09, `${G}0.38)`);
        ctx.restore();

        // ── L3: Esagramma (CW medio) ────────────────────────────────────
        ctx.save();
        ctx.rotate(t * 0.014);
        ctx.shadowColor = `${P}0.85)`; ctx.shadowBlur = 13;
        const r3 = maxR * 0.70 * grow;
        drawRing(ctx, 0, 0, r3, 2.5, `${P}0.45)`, [4, 7]);
        drawPolygon(ctx, 0, 0, r3, 3, `${P}0.24)`, 0);
        drawPolygon(ctx, 0, 0, r3, 3, `${P}0.24)`, Math.PI);
        drawRuneDots(ctx, 0, 0, r3, 6, `${P}0.65)`, 2.5);
        ctx.restore();

        // ── L4: Pentagono (CCW medio) ───────────────────────────────────
        ctx.save();
        ctx.rotate(-t * 0.021);
        ctx.shadowColor = `${P}0.70)`; ctx.shadowBlur = 9;
        const r4 = maxR * 0.55 * grow;
        drawRing(ctx, 0, 0, r4, 2.0, `${P}0.35)`, [2, 5]);
        drawPolygon(ctx, 0, 0, r4, 5, `${P}0.20)`, -Math.PI / 2);
        drawRuneDots(ctx, 0, 0, r4, 5, `${P}0.55)`, 2);
        ctx.restore();

        // ── L5: Doppio anello + triangolo (CW veloce) ──────────────────
        ctx.save();
        ctx.rotate(t * 0.030);
        ctx.shadowColor = `${E}0.90)`; ctx.shadowBlur = 14;
        const r5 = maxR * 0.42 * grow;
        drawRing(ctx, 0, 0, r5,        3.0, `${E}0.55)`, []);
        drawRing(ctx, 0, 0, r5 * 0.91, 1.2, `${E}0.22)`, [2, 4]);
        drawPolygon(ctx, 0, 0, r5, 3, `${E}0.28)`, -Math.PI / 2);
        drawRuneDots(ctx, 0, 0, r5, 3, `${E}0.75)`, 2.5);
        ctx.restore();

        // ── L6: Stella a 6 punte (CCW veloce) ──────────────────────────
        ctx.save();
        ctx.rotate(-t * 0.040);
        ctx.shadowColor = `${G}0.90)`; ctx.shadowBlur = 11;
        const r6 = maxR * 0.27 * grow;
        drawRing(ctx, 0, 0, r6, 2.2, `${G}0.45)`, []);
        drawStar(ctx, 0, 0, r6, 6, `${G}0.32)`);
        ctx.restore();

        // ── Centro: nucleo pulsante ─────────────────────────────────────
        const coreR = maxR * 0.09 * grow * pulse;
        ctx.shadowBlur = 0;
        const gCore = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.5);
        gCore.addColorStop(0,   `${G}0.60)`);
        gCore.addColorStop(0.5, `${G}0.18)`);
        gCore.addColorStop(1,   `${G}0.0)`);
        ctx.fillStyle = gCore;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Alone ambientale
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.32 * grow);
        grd.addColorStop(0,   `${G}0.10)`);
        grd.addColorStop(0.5, `${P}0.05)`);
        grd.addColorStop(1,   'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        t++;
    }
    raf = requestAnimationFrame(drawSummonCircle);
    window._cancelSummon = () => cancelAnimationFrame(raf);
}

/* ── Canvas helpers ──────────────────────────────────────────────── */
function drawRing(ctx, x, y, r, lw, color, dash) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
}
function drawRuneDots(ctx, cx, cy, r, count, color, dotR) {
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
    }
}
function drawPolygon(ctx, cx, cy, r, sides, color, rotOffset) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + (rotOffset || 0);
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
}
function drawTickMarks(ctx, cx, cy, r, count, len, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r,       cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len));
        ctx.stroke();
    }
    ctx.restore();
}
function drawRuneArc(ctx, cx, cy, r, count, color, size) {
    const SET = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(SET[i % SET.length], 0, 0);
        ctx.restore();
    }
    ctx.restore();
}
function drawStar(ctx, cx, cy, r, points, color) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const a  = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
                : ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke();
}

/* ════════════════════════════
   SUMMONING SEQUENCE
════════════════════════════ */
function runSummoning(onComplete) {
    const logEl = document.getElementById('summon-log');
    const lines  = i18n[currentLang].boot;
    let idx = 0;

    function addLine() {
        if (idx < lines.length) {
            const span = document.createElement('span');
            span.className   = 'summon-line';
            span.textContent = lines[idx++];
            logEl.appendChild(span);
            setTimeout(addLine, 380);
        } else {
            setTimeout(() => {
                if (window._cancelSummon) window._cancelSummon();
                document.getElementById('summon-overlay').classList.add('fade-out');
                setTimeout(onComplete, 850);
            }, 500);
        }
    }
    addLine();
}

/* ════════════════════════════
   BUILDERS
════════════════════════════ */
function buildLinkCards() {
    document.getElementById('link-cards').innerHTML = SOCIALS.map(s =>
        `<a href="${s.href}" class="link-card ${s.id}" target="_blank" rel="noopener" aria-label="${s.platform} — ${s.handle}">
            ${s.icon}
            <div class="link-card-text">
                <span class="link-card-platform">${s.platform}</span>
                <span class="link-card-handle">${s.handle}</span>
            </div>
            <i class="fas fa-arrow-right link-card-arrow" aria-hidden="true"></i>
        </a>`
    ).join('');
}

function buildInterestGrid(lang) {
    const t = i18n[lang];
    document.getElementById('interest-grid').innerHTML = INTERESTS.map(item =>
        `<div class="interest-card">
            <span class="interest-icon">${item.icon}</span>
            <div class="interest-body">
                <span class="interest-name">${t[item.key]}</span>
                <span class="interest-detail">${item.detail}</span>
            </div>
        </div>`
    ).join('');
}

/* ════════════════════════════
   LIVE SECTION
════════════════════════════ */
const LIVE_PLATFORMS = {
    twitch: {
        player: (channel) => `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}&muted=true`,
        chat: (channel) => `https://www.twitch.tv/embed/${channel}/chat?parent=${location.hostname}&darkpopout`,
        channel: 'aruta.sh'
    },
    kick: {
        player: (channel) => `https://player.kick.com/${channel}`,
        chat: (channel) => `https://kick.com/${channel}/chatroom`,
        channel: 'aruta_sh'
    },
    youtube: {
        player: (channel) => `https://www.youtube.com/embed/live_stream?channel=${channel}&autoplay=1&mute=1`,
        chat: (channel) => `https://www.youtube.com/live_chat?v=live_stream&embed_domain=${location.hostname}`,
        channel: 'UC_CHANNEL_ID'
    }
};

function initLiveSection() {
    const tabs = document.querySelectorAll('.live-tab');
    const playerEl = document.getElementById('live-player');
    const chatEl = document.getElementById('live-chat');

    if (!tabs.length || !playerEl || !chatEl) return;

    function switchPlatform(platform) {
        const config = LIVE_PLATFORMS[platform];
        if (!config) return;

        // Update tabs
        tabs.forEach(t => t.classList.toggle('active', t.dataset.platform === platform));

        // Update player iframe
        playerEl.innerHTML = `<iframe
            src="${config.player(config.channel)}"
            allowfullscreen
            allow="autoplay; encrypted-media"
            title="${platform} player"
        ></iframe>`;

        // Update chat iframe
        chatEl.innerHTML = `<iframe
            src="${config.chat(config.channel)}"
            title="${platform} chat"
        ></iframe>`;
    }

    // Tab click handlers
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchPlatform(tab.dataset.platform));
    });

    // Initialize with Twitch
    switchPlatform('twitch');
}

/* ════════════════════════════
   PROJECT CARDS (GitHub API)
════════════════════════════ */
const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', 'C#': '#178600', Python: '#3572A5',
    Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95',
    Shell: '#89e051', Groovy: '#4298b8', HTML: '#e34c26', CSS: '#563d7c', Kotlin: '#A97BFF',
    Swift: '#F05138', Dart: '#00B4AB', Lua: '#000080', C: '#555555', 'C++': '#f34b7d'
};

let projectCache = null;

async function fetchCommitCount(slug) {
    // Use per_page=1 and parse Link header to get total commit count
    const r = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=1`);
    if (!r.ok) return 0;
    const link = r.headers.get('Link');
    if (!link) return 1;
    const match = link.match(/page=(\d+)>;\s*rel="last"/);
    return match ? parseInt(match[1], 10) : 1;
}

async function fetchProjects() {
    if (projectCache) return projectCache;
    const results = await Promise.allSettled(
        PROJECTS.map(async slug => {
            const [repoRes, commits] = await Promise.all([
                fetch(`https://api.github.com/repos/${slug}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
                fetchCommitCount(slug)
            ]);
            repoRes._commits = commits;
            return repoRes;
        })
    );
    projectCache = results.map((r, i) => r.status === 'fulfilled' ? r.value : { _error: true, _slug: PROJECTS[i] });
    return projectCache;
}

function fmtDate(iso, lang) {
    const loc = lang === 'fn' ? 'en' : lang;
    return new Date(iso).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderProjectCards(repos, lang) {
    const t = i18n[lang];
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    grid.innerHTML = repos.map(repo => {
        if (repo._error) {
            return `<div class="project-card project-card--error">
                <span class="project-error-icon">⚠</span>
                <span class="project-error-text">${t.proj_error}: ${repo._slug}</span>
            </div>`;
        }

        const langDot = repo.language && LANG_COLORS[repo.language]
            ? `<span class="proj-lang-dot" style="background:${LANG_COLORS[repo.language]}"></span>`
            : '';
        const langName = repo.language || '—';
        const createdStr = fmtDate(repo.created_at, lang);
        const updatedStr = fmtDate(repo.pushed_at, lang);
        const topics = (repo.topics || []).slice(0, 4);
        const topicsHtml = topics.length
            ? `<div class="proj-topics">${topics.map(t => `<span class="proj-topic">${t}</span>`).join('')}</div>`
            : '';

        return `<a href="${repo.html_url}" class="project-card" target="_blank" rel="noopener" aria-label="${repo.name}">
            <div class="project-header">
                <i class="fab fa-github project-gh-icon" aria-hidden="true"></i>
                <span class="project-name">${repo.name}</span>
                ${repo.archived ? '<span class="proj-badge proj-badge--archived">archived</span>' : ''}
                ${repo.private ? '<span class="proj-badge proj-badge--private"><i class="fas fa-lock"></i></span>' : ''}
            </div>
            <p class="project-desc">${repo.description || '—'}</p>
            ${topicsHtml}
            <div class="project-stats">
                <span class="proj-stat">${langDot} ${langName}</span>
                <span class="proj-stat"><i class="fas fa-star" aria-hidden="true"></i> ${repo.stargazers_count}</span>
                <span class="proj-stat"><i class="fas fa-code-branch" aria-hidden="true"></i> ${repo.forks_count}</span>
                <span class="proj-stat"><i class="fas fa-code-commit" aria-hidden="true"></i> ${repo._commits} ${t.proj_commits}</span>
                <span class="proj-stat"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> ${repo.open_issues_count} ${t.proj_issues}</span>
            </div>
            <div class="project-dates">
                <span class="proj-date"><i class="fas fa-calendar-plus" aria-hidden="true"></i> ${t.proj_created} ${createdStr}</span>
                <span class="proj-date"><i class="fas fa-clock" aria-hidden="true"></i> ${t.proj_updated} ${updatedStr}</span>
            </div>
        </a>`;
    }).join('');
}

async function buildProjectCards(lang) {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;
    const t = i18n[lang];
    grid.innerHTML = `<div class="project-card project-card--loading"><span class="proj-loading-rune">◈</span> ${t.proj_loading}</div>`;
    const repos = await fetchProjects();
    renderProjectCards(repos, lang);
}

/* ════════════════════════════
   FLYING LETTERS (drift like runes → assemble into Aruta.sh)
   Phase 1: letters float/drift in the background like rune particles
   Phase 2: letters slowly fly to their final position, color shifts to gold
════════════════════════════ */
let titleAnimated = false;
let _flyingRAF = null;

function flyingLettersInit() {
    const el = document.querySelector('.char-name');
    if (!el || titleAnimated) return;
    titleAnimated = true;

    const text = 'Aruta.sh';
    const runeColor = _isLight ? 'rgb(139, 105, 20)' : 'rgb(167, 139, 250)';

    el.textContent = '';
    el.style.overflow = 'visible';

    const DRIFT_DURATION = 2500;  // ms letters float before assembling
    const FLY_DURATION   = 2200;  // ms to fly to final position
    const FLY_STAGGER    = 180;   // ms between each letter starting to fly

    // Create letter objects with physics
    const letters = [];
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.textContent = text[i];
        span.className = 'fly-letter';
        span.style.display = 'inline-block';
        span.style.color = runeColor;
        span.style.opacity = '0';
        el.appendChild(span);

        letters.push({
            el: span,
            // Scattered position — scaled to viewport so letters stay on screen
            x: (Math.random() - 0.5) * Math.min(window.innerWidth * 0.85, 1200),
            y: (Math.random() - 0.5) * Math.min(window.innerHeight * 0.7, 800),
            rot: (Math.random() - 0.5) * 300,
            // Slow drift velocity (like rune particles)
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.4,
            vr: (Math.random() - 0.5) * 0.3,
            // Wobble
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleAmp: 0.15 + Math.random() * 0.25,
            // State
            flying: false,
            landed: false,
            flyStart: 0,
            startX: 0, startY: 0, startRot: 0
        });
    }

    const t0 = performance.now();

    function tick(now) {
        const elapsed = now - t0;

        for (let i = 0; i < letters.length; i++) {
            const L = letters[i];

            // Phase 1: drift like a rune
            if (!L.flying) {
                // Fade in during first 600ms
                const fadeIn = Math.min(1, elapsed / 600);
                L.el.style.opacity = fadeIn * 0.65;

                // Drift
                L.wobblePhase += 0.02;
                L.x += L.vx + Math.sin(L.wobblePhase) * L.wobbleAmp;
                L.y += L.vy + Math.cos(L.wobblePhase * 0.7) * L.wobbleAmp * 0.6;
                L.rot += L.vr;

                L.el.style.transform = `translate(${L.x}px, ${L.y}px) rotate(${L.rot}deg) scale(0.75)`;

                // Trigger fly phase after drift duration (staggered per letter)
                const flyTrigger = DRIFT_DURATION + i * FLY_STAGGER;
                if (elapsed > flyTrigger) {
                    L.flying = true;
                    L.flyStart = now;
                    L.startX = L.x;
                    L.startY = L.y;
                    L.startRot = L.rot;
                }
            }
            // Phase 2: fly to final position
            else if (!L.landed) {
                const flyElapsed = now - L.flyStart;
                // Ease out expo: 1 - 2^(-10t)
                let t = Math.min(1, flyElapsed / FLY_DURATION);
                t = 1 - Math.pow(2, -10 * t);

                const cx = L.startX * (1 - t);
                const cy = L.startY * (1 - t);
                const cr = L.startRot * (1 - t);
                const cs = 0.75 + t * 0.25; // scale 0.75 → 1
                const co = 0.65 + t * 0.35; // opacity 0.65 → 1

                L.el.style.transform = `translate(${cx}px, ${cy}px) rotate(${cr}deg) scale(${cs})`;
                L.el.style.opacity = co;

                if (flyElapsed >= FLY_DURATION) {
                    L.landed = true;
                    L.el.style.transform = '';
                    L.el.style.opacity = '1';
                    L.el.style.color = '';
                    L.el.classList.add('fly-letter-landed');
                }
            }
        }

        // Continue loop until all landed
        if (letters.some(L => !L.landed)) {
            _flyingRAF = requestAnimationFrame(tick);
        } else {
            _flyingRAF = null;
        }
    }

    _flyingRAF = requestAnimationFrame(tick);
}

/* ════════════════════════════
   CARD ENTRANCE (CSS-based, smooth)
════════════════════════════ */
function revealCards(selector, delay) {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;

    // Set initial hidden state without forcing reflow
    els.forEach(el => {
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px) scale(0.97)';
    });

    // Single rAF to batch the reflow, then apply transitions
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            els.forEach((el, i) => {
                el.style.transition = `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 60}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 60}ms`;
                el.style.opacity = '1';
                el.style.transform = 'translateY(0) scale(1)';
            });
        });
    });

    // Clean inline styles after all animations done
    const totalTime = delay + els.length * 60 + 600;
    setTimeout(() => {
        els.forEach(el => {
            el.style.opacity = '';
            el.style.transform = '';
            el.style.transition = '';
        });
    }, totalTime);
}

/* ════════════════════════════
   VANILLA TILT (3D hover on cards)
════════════════════════════ */
function initTilt() {
    if (typeof VanillaTilt === 'undefined' || window.matchMedia('(pointer: coarse)').matches) return;

    document.querySelectorAll('.interest-card, .link-card').forEach(el => {
        if (el.vanillaTilt) return; // already init
        VanillaTilt.init(el, { max: 7, speed: 400, glare: true, 'max-glare': 0.10, scale: 1.02 });
    });

    document.querySelectorAll('.project-card:not(.project-card--loading):not(.project-card--error)').forEach(el => {
        if (el.vanillaTilt) return;
        VanillaTilt.init(el, { max: 5, speed: 400, glare: true, 'max-glare': 0.08 });
    });

    const portrait = document.querySelector('.portrait-img-wrap');
    if (portrait && !portrait.vanillaTilt) {
        VanillaTilt.init(portrait, { max: 8, speed: 600, glare: true, 'max-glare': 0.12, scale: 1.03 });
    }
}

/* ════════════════════════════
   SECTION ENTRANCE EFFECTS
════════════════════════════ */
function animateSectionEntrance(sectionId) {
    switch (sectionId) {
        case 'home':
            flyingLettersInit();
            break;

        case 'about':
            revealCards('.interest-card', 200);
            setTimeout(initTilt, 800);
            break;

        case 'live':
            // No special entrance animation needed
            break;

        case 'links':
            revealCards('.link-card', 100);
            setTimeout(initTilt, 600);
            break;
    }
}

/* ════════════════════════════
   SHOW APP
════════════════════════════ */
function showApp() {
    const app = document.getElementById('app');
    app.classList.remove('hidden');
    app.classList.add('visible');
    buildLinkCards();
    buildInterestGrid(currentLang);
    initLiveSection();
    buildProjectCards(currentLang);
    applyTranslations(currentLang);
    startClock();
    initSections();
    initFireflies();
    initMagicCircleInteraction();

    // Entrance animation for home section
    setTimeout(() => {
        animateSectionEntrance('home');
        initTilt();
    }, 200);
}

/* ════════════════════════════
   TRANSLATIONS
════════════════════════════ */
function applyTranslations(lang) {
    const t = i18n[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] !== undefined) el.textContent = t[key];
    });
}

/* ════════════════════════════
   CLOCK
════════════════════════════ */
function startClock() {
    tickClock();
    setInterval(tickClock, 1000);
}
function tickClock() {
    const now = new Date();
    const h  = String(now.getHours()).padStart(2, '0');
    const m  = String(now.getMinutes()).padStart(2, '0');
    const s  = String(now.getSeconds()).padStart(2, '0');
    const y  = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d  = String(now.getDate()).padStart(2, '0');
    const tEl = document.getElementById('hud-time');
    const dEl = document.getElementById('hud-date');
    if (tEl) tEl.textContent = `${h}:${m}:${s}`;
    if (dEl) dEl.textContent = `${y}/${mo}/${d}`;
}

/* ════════════════════════════
   SECTION SWITCHING
════════════════════════════ */
function initSections() {
    let bioTyped = false;
    let transitioning = false;

    document.querySelectorAll('.sec-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            if (transitioning) return;
            const id = btn.dataset.sec;
            const target = document.getElementById(`sec-${id}`);

            // Find currently visible section
            const current = document.querySelector('.page-section:not([hidden])');
            if (current === target) return;

            // Update nav buttons immediately
            document.querySelectorAll('.sec-btn').forEach(b =>
                b.classList.toggle('active', b === btn)
            );

            // Animate out current section, then animate in new one
            if (current) {
                transitioning = true;
                current.classList.add('sec-exit');
                current.addEventListener('animationend', function handler() {
                    current.removeEventListener('animationend', handler);
                    current.classList.remove('sec-exit');
                    current.hidden = true;

                    // Show new section with fade-in
                    target.hidden = false;
                    target.style.animation = 'none';
                    target.offsetHeight; // force reflow
                    target.style.animation = '';

                    transitioning = false;

                    if (id === 'about' && !bioTyped) {
                        bioTyped = true;
                        typewriterBio(i18n[currentLang].bio);
                    }
                    animateSectionEntrance(id);
                }, { once: true });
            } else {
                target.hidden = false;
                if (id === 'about' && !bioTyped) {
                    bioTyped = true;
                    typewriterBio(i18n[currentLang].bio);
                }
                animateSectionEntrance(id);
            }
        })
    );

    // Mobile swipe between sections
    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 60;

    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        // Only horizontal swipes (not vertical scrolling)
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

        const sections = ['home', 'about', 'live', 'links'];
        const currentBtn = document.querySelector('.sec-btn.active');
        if (!currentBtn) return;
        const currentIdx = sections.indexOf(currentBtn.dataset.sec);
        if (currentIdx < 0) return;

        const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
        if (nextIdx < 0 || nextIdx >= sections.length) return;

        const nextBtn = document.querySelector(`.sec-btn[data-sec="${sections[nextIdx]}"]`);
        if (nextBtn) nextBtn.click();
    }, { passive: true });
}

/* ════════════════════════════
   TYPEWRITER
════════════════════════════ */
function typewriterBio(text) {
    const el = document.getElementById('char-bio');
    if (!el) return;
    if (typewriterBio._timeout) clearTimeout(typewriterBio._timeout);
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);
    let i = 0;
    function type() {
        if (i < text.length) {
            el.insertBefore(document.createTextNode(text.charAt(i++)), cursor);
            typewriterBio._timeout = setTimeout(type, 22);
        } else {
            setTimeout(() => cursor.remove(), 2500);
        }
    }
    type();
}

/* ════════════════════════════
   LANGUAGE SWITCH
════════════════════════════ */
function switchLanguage(lang) {
    if (!i18n[lang] || lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem('aruta_lang', lang);
    document.documentElement.setAttribute('lang', lang);
    setActiveLangBtn(lang);
    applyTranslations(lang);
    buildInterestGrid(lang);
    if (projectCache) renderProjectCards(projectCache, lang);
    typewriterBio(i18n[lang].bio);
}
function setActiveLangBtn(lang) {
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
}

/* ════════════════════════════
   THEME TOGGLE
════════════════════════════ */
function toggleTheme() {
    // Ripple transition effect
    const ripple = document.createElement('div');
    ripple.className = 'theme-ripple';
    const btnRect = document.getElementById('theme-btn').getBoundingClientRect();
    ripple.style.left = btnRect.left + btnRect.width / 2 + 'px';
    ripple.style.top = btnRect.top + btnRect.height / 2 + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);

    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    _isLight = currentTheme === 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('aruta_theme', currentTheme);
    updateThemeIcon();
}
function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

/* ════════════════════════════
   EASTER EGG — ARCANE DUEL (5 clicks on ⚜ rune)
════════════════════════════ */
(function initDuelTrigger() {
    let clicks = 0, timer = null;
    document.addEventListener('click', e => {
        if (e.target.closest('.magic-circle-frame')) {
            clicks++;
            clearTimeout(timer);
            timer = setTimeout(() => clicks = 0, 3000); // reset after 3s
            if (clicks >= 7) {
                clicks = 0;
                if (typeof ArcaneDuel !== 'undefined') ArcaneDuel.start();
            }
        }
    });
})();

/* ════════════════════════════
   EASTER EGG — KONAMI CODE
   ↑↑↓↓←→←→BA triggers a golden rune storm
════════════════════════════ */
(function initKonamiEgg() {
    const SEQ = [38,38,40,40,37,39,37,39,66,65]; // ↑↑↓↓←→←→BA
    let pos = 0;
    let eggActive = false;

    document.addEventListener('keydown', e => {
        if (e.keyCode === SEQ[pos]) {
            pos++;
            if (pos === SEQ.length) {
                pos = 0;
                if (!eggActive) triggerRuneStorm();
            }
        } else {
            pos = 0;
        }
    });

    function triggerRuneStorm() {
        eggActive = true;
        const RUNES = RUNE_SET;
        const COUNT = 120;
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;';
        document.body.appendChild(container);

        // Secret message
        const msg = document.createElement('div');
        const eggMessages = {
            it: '✦ Hai trovato l\'incantesimo segreto ✦',
            en: '✦ You found the secret spell ✦',
            es: '✦ Encontraste el hechizo secreto ✦',
            ja: '✦ 秘密の呪文を見つけた ✦',
            fn: '✦ ᛃᛟᚢ ᚠᛟᚢᚾᛞ ᚦᛖ ᛊᛖᚲᚱᛖᛏ ᛊᛈᛖᛚᛚ ✦'
        };
        msg.textContent = eggMessages[currentLang] || eggMessages.en;
        msg.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;
            font-family:'IM Fell English',serif;font-size:clamp(1.5rem,4vw,2.5rem);
            color:#fff;text-align:center;pointer-events:none;
            text-shadow:0 0 20px rgba(167,139,250,0.8),0 0 50px rgba(167,139,250,0.4),0 0 80px rgba(255,200,87,0.3);
            opacity:0;transition:opacity 0.8s;letter-spacing:0.1em;
        `;
        document.body.appendChild(msg);
        requestAnimationFrame(() => msg.style.opacity = '1');

        // Screen flash
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;z-index:9997;background:radial-gradient(circle at 50% 50%, rgba(255,200,87,0.15), rgba(167,139,250,0.1));pointer-events:none;transition:opacity 1.5s;';
        document.body.appendChild(flash);

        // Spawn rune rain
        for (let i = 0; i < COUNT; i++) {
            const rune = document.createElement('div');
            const char = RUNES[Math.floor(Math.random() * RUNES.length)];
            const x = Math.random() * 100;
            const size = 14 + Math.random() * 24;
            const dur = 2 + Math.random() * 3;
            const delay = Math.random() * 2;
            const rand = Math.random();
            const color = rand > 0.6 ? '#ffc857' : rand > 0.3 ? '#a78bfa' : '#e8c84a';
            const glow = rand > 0.5 ? 'rgba(255,200,87,0.6)' : 'rgba(167,139,250,0.5)';

            rune.textContent = char;
            rune.style.cssText = `
                position:absolute;top:-5%;left:${x}%;
                font-size:${size}px;color:${color};opacity:0;
                text-shadow:0 0 8px ${glow},0 0 16px ${glow};
                font-family:serif;pointer-events:none;
                animation:eggRuneFall ${dur}s ${delay}s ease-in forwards;
            `;
            container.appendChild(rune);
        }

        // Cleanup after animation
        setTimeout(() => {
            msg.style.opacity = '0';
            flash.style.opacity = '0';
            setTimeout(() => {
                container.remove();
                msg.remove();
                flash.remove();
                eggActive = false;
            }, 1500);
        }, 4500);
    }
})();
