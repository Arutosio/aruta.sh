/* ============================================================
   ARUTA.SH — Medieval Fantasy Script
   Dati e contenuti: JavaScript/config.js
   ============================================================ */

/* ════════════════════════════
   STATE
════════════════════════════ */
let currentLang  = 'it';
let currentTheme = 'dark';
let bioTimeout   = null;

/* ════════════════════════════
   INIT
════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const savedLang  = localStorage.getItem('aruta_lang');
    const savedTheme = localStorage.getItem('aruta_theme');

    currentLang  = (savedLang && i18n[savedLang]) ? savedLang : detectLanguage();
    currentTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
    setActiveLangBtn(currentLang);

    initRuneParticles();
    initMagicCursor();
    initSummonCanvas();
    runSummoning(() => showApp());

    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('lang-select').addEventListener('change', e => switchLanguage(e.target.value));
});

/* ════════════════════════════
   LANGUAGE DETECTION
════════════════════════════ */
function detectLanguage() {
    const code = (navigator.language || 'en').split('-')[0].toLowerCase();
    if (i18n[code]) return code;
    const map = { pt:'es', ca:'es', gl:'es', zh:'ja', ko:'ja' };
    return map[code] || 'en';
}

/* ════════════════════════════
   RUNE PARTICLES + CURSOR TRAIL
════════════════════════════ */
function initRuneParticles() {
    const canvas = document.getElementById('rune-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const RUNES   = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᛡᛣᛤᛥᛦ✦⊕⋆◈✧';
    // dark:  base #6e8efb (blue) → hot #d0eaff (white-blue near cursor)
    // light: base #5a320a (sepia ink) → hot #bc6c14 (amber candlelight near cursor)
    const THEMES = {
        dark:  { br: 110, bg: 142, bb: 251, hr: 210, hg: 234, hb: 255, trail: '#eef5ff',  tShadow: '#ddeeff' },
        light: { br:  90, bg:  50, bb:  10, hr: 188, hg: 108, hb:  20, trail: '#7a4e06',  tShadow: 'rgba(122,78,6,0.55)' }
    };
    const MOUSE_R = 170;
    const MC_R    = 190;
    let mouse = { x: -999, y: -999 };
    let frame = 0;
    const trail = [];

    function getTheme() {
        return document.documentElement.getAttribute('data-theme') === 'light' ? THEMES.light : THEMES.dark;
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

        const light = document.documentElement.getAttribute('data-theme') === 'light';
        const G = light ? 'rgba(90,50,8,'   : 'rgba(212,175,55,';  // ocra / oro
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
        `<a href="${s.href}" class="link-card ${s.id}" target="_blank" rel="noopener">
            ${s.icon}
            <div class="link-card-text">
                <span class="link-card-platform">${s.platform}</span>
                <span class="link-card-handle">${s.handle}</span>
            </div>
            <i class="fas fa-arrow-right link-card-arrow"></i>
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
   SHOW APP
════════════════════════════ */
function showApp() {
    const app = document.getElementById('app');
    app.classList.remove('hidden');
    app.classList.add('visible');
    buildLinkCards();
    buildInterestGrid(currentLang);
    applyTranslations(currentLang);
    startClock();
    initSections();
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
    document.querySelectorAll('.sec-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            const id = btn.dataset.sec;
            document.querySelectorAll('.page-section').forEach(s => {
                s.hidden = s.id !== `sec-${id}`;
            });
            document.querySelectorAll('.sec-btn').forEach(b =>
                b.classList.toggle('active', b === btn)
            );
            if (id === 'about' && !bioTyped) {
                bioTyped = true;
                typewriterBio(i18n[currentLang].bio);
            }
        })
    );
}

/* ════════════════════════════
   TYPEWRITER
════════════════════════════ */
function typewriterBio(text) {
    const el = document.getElementById('char-bio');
    if (!el) return;
    if (bioTimeout) clearTimeout(bioTimeout);
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);
    let i = 0;
    function type() {
        if (i < text.length) {
            el.insertBefore(document.createTextNode(text.charAt(i++)), cursor);
            bioTimeout = setTimeout(type, 22);
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
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('aruta_theme', currentTheme);
    updateThemeIcon();
}
function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}
