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
    currentTheme = savedTheme || 'dark';

    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
    setActiveLangBtn(currentLang);

    initRuneParticles();
    initMagicCursor();
    initSummonCanvas();
    runSummoning(() => showApp());

    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.querySelectorAll('.lang-btn').forEach(btn =>
        btn.addEventListener('click', () => switchLanguage(btn.dataset.lang))
    );
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
    // Normal: #6e8efb (original blue). Hot: #d0eaff (near-white blue, near cursor only)
    const BASE_R = 110, BASE_G = 142, BASE_B = 251;
    const HOT_R  = 210, HOT_G  = 234, HOT_B  = 255;
    const MOUSE_R = 170;
    const MC_R    = 190;
    let mouse = { x: -999, y: -999 };
    let frame = 0;
    const trail = [];

    function runeColor(t) {
        return `rgb(${Math.round(BASE_R + t*(HOT_R-BASE_R))},${Math.round(BASE_G + t*(HOT_G-BASE_G))},${Math.round(BASE_B + t*(HOT_B-BASE_B))})`;
    }

    // Returns center of magic circle only when home section is visible
    function getMCCenter() {
        const sec = document.getElementById('sec-home');
        if (!sec || sec.hidden) return null;
        const el = sec.querySelector('.magic-circle-frame');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        trail.push({ x: e.clientX, y: e.clientY, t: Date.now() });
        if (trail.length > 25) trail.shift();
    });

    function spawn() {
        return {
            x:      Math.random() * window.innerWidth,
            y:      Math.random() * window.innerHeight,
            vx:     (Math.random() - 0.5) * 0.35,
            vy:     (Math.random() - 0.5) * 0.35,
            char:   RUNES[Math.floor(Math.random() * RUNES.length)],
            base:   18 + Math.random() * 20,   // fixed normal size 18–38px
            phase:  Math.random() * Math.PI * 2,
            alpha:  0.13 + Math.random() * 0.17,
            glowM:  0,   // mouse proximity → color + size
            glowMC: 0,   // magic circle proximity → size only
            life:   0
        };
    }

    const particles = Array.from({ length: 120 }, spawn);

    function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frame++;

        // Thin cursor trail — white-blue, fast fade
        const now = Date.now();
        trail.forEach(pt => {
            const age = now - pt.t;
            if (age > 480) return;
            const life = 1 - age / 480;
            ctx.save();
            ctx.globalAlpha = life * 0.30;
            ctx.shadowColor = '#ddeeff';
            ctx.shadowBlur  = life * 8;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, life * 2.5 + 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#eef5ff';
            ctx.fill();
            ctx.restore();
        });

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

            // Magic circle proximity → size boost only (no color change)
            let targetMC = 0;
            if (mc) {
                const mx = p.x - mc.x, my = p.y - mc.y;
                targetMC = Math.sqrt(mx * mx + my * my) < MC_R
                    ? 1 - Math.sqrt(mx * mx + my * my) / MC_R : 0;
            }
            p.glowMC += (targetMC - p.glowMC) * 0.05;

            // Size grows near cursor OR magic circle, returns to base when away
            const size  = p.base * float * (1 + Math.max(p.glowM, p.glowMC) * 0.65);
            const color = runeColor(p.glowM);
            const blur  = 2 + float * 3 + p.glowM * 26;
            const alpha = (p.alpha + p.glowM * 0.55) * edge * p.life;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font        = `${size}px serif`;
            ctx.fillStyle   = color;
            ctx.shadowColor = color;
            ctx.shadowBlur  = blur;
            ctx.fillText(p.char, p.x, p.y);
            ctx.restore();
        }

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

    let t = 0;
    function drawSummonCircle() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        const maxR = Math.min(canvas.width, canvas.height) * 0.34;
        const grow = Math.min(1, t / 80);

        ctx.save();
        ctx.translate(cx, cy);

        ctx.rotate(t * 0.008);
        drawRing(ctx, 0, 0, maxR * grow, 1.2, 'rgba(212,175,55,0.35)', [4, 8]);
        drawRing(ctx, 0, 0, maxR * grow, 0.6, 'rgba(212,175,55,0.15)', [1, 6]);
        drawRuneDots(ctx, 0, 0, maxR * grow, 8, 'rgba(212,175,55,0.6)', 3);

        ctx.rotate(-t * 0.016);
        drawRing(ctx, 0, 0, maxR * 0.7 * grow, 1, 'rgba(167,139,250,0.4)', [2, 5]);
        drawTriangle(ctx, 0, 0, maxR * 0.7 * grow, 'rgba(167,139,250,0.2)');

        ctx.rotate(t * 0.024);
        drawRing(ctx, 0, 0, maxR * 0.45 * grow, 0.8, 'rgba(52,211,153,0.35)', [3, 7]);
        drawRuneDots(ctx, 0, 0, maxR * 0.45 * grow, 6, 'rgba(52,211,153,0.7)', 2);

        ctx.rotate(-t * 0.012);
        drawStar(ctx, 0, 0, maxR * 0.22 * grow, 6, 'rgba(212,175,55,0.25)');

        ctx.restore();

        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.25 * grow);
        grd.addColorStop(0,   'rgba(212,175,55,0.15)');
        grd.addColorStop(0.5, 'rgba(167,139,250,0.08)');
        grd.addColorStop(1,   'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        t++;
        raf = requestAnimationFrame(drawSummonCircle);
    }
    drawSummonCircle();
    window._cancelSummon = () => cancelAnimationFrame(raf);
}

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
function drawTriangle(ctx, cx, cy, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke();
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
    ctx.strokeStyle = color; ctx.lineWidth = 0.8; ctx.stroke();
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
    document.querySelectorAll('.lang-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.lang === lang)
    );
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
