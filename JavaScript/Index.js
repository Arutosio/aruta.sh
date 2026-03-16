/* ============================================================
   ARUTA.SH — Main logic
   Tutti i contenuti sono in JavaScript/config.js
   ============================================================ */

/* ════════════════════════════
   STATE
════════════════════════════ */
let lang    = 'it';
let theme   = 'dark';
let section = 'home';
let bioTmr  = null;
let clockTmr = null;

/* ════════════════════════════
   BOOT
════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const sl = localStorage.getItem('aruta_lang');
    const st = localStorage.getItem('aruta_theme');
    lang  = (sl && CONFIG.i18n[sl]) ? sl : detectLang();
    theme = st || 'dark';

    applyTheme();
    setLangBtn(lang);
    document.documentElement.setAttribute('lang', lang);

    buildNav();
    renderSection('home');
    startClock();

    initAtmo();
    showPage();

    document.getElementById('tbtn').onclick = toggleTheme;
    document.querySelectorAll('.lb').forEach(b =>
        b.addEventListener('click', () => setLang(b.dataset.lang))
    );
});

function detectLang() {
    const c = (navigator.language || 'en').split('-')[0].toLowerCase();
    return CONFIG.i18n[c] ? c : ({ pt:'es', ca:'es', gl:'es', zh:'ja', ko:'ja' }[c] || 'en');
}

/* ════════════════════════════
   SHOW PAGE
════════════════════════════ */
function showPage() {
    const page = document.getElementById('page');
    page.classList.remove('hidden');
    page.classList.add('visible');
}

/* ════════════════════════════
   CLOCK
════════════════════════════ */
function startClock() {
    tickClock();
    clockTmr = setInterval(tickClock, 1000);
}

function tickClock() {
    const locale = CONFIG.locales[lang] || 'en-US';
    const now    = new Date();

    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');

    if (timeEl) timeEl.textContent = now.toLocaleTimeString(locale, {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    if (dateEl) dateEl.textContent = now.toLocaleDateString(locale, {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

/* ════════════════════════════
   NAV
════════════════════════════ */
function buildNav() {
    const t = CONFIG.i18n[lang];
    document.getElementById('vn-nav').innerHTML = CONFIG.sections.map(s =>
        `<button class="vn-choice${s.id === section ? ' active' : ''}" data-section="${s.id}">
            <i class="${s.icon}"></i>
            <span>${t['nav_' + s.id]}</span>
        </button>`
    ).join('');
    document.querySelectorAll('.vn-choice').forEach(b =>
        b.addEventListener('click', () => renderSection(b.dataset.section))
    );
}

/* ════════════════════════════
   SECTION RENDERING
════════════════════════════ */
const KICK_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M2 2h4v6l4-6h5l-5 7 5 7h-5l-4-6v6H2V2z"/></svg>`;

function socialIcon(s) {
    return s.icon === 'kick' ? KICK_SVG : `<i class="${s.icon}"></i>`;
}
function socialLink(s) {
    return `<a href="${s.url}" class="sl ${s.id}" target="_blank" rel="noopener" aria-label="${s.label}">${socialIcon(s)}<span>${s.label}</span></a>`;
}

function renderSection(id) {
    section = id;
    const t   = CONFIG.i18n[lang];
    const inner = document.getElementById('vn-inner');
    if (!inner) return;

    /* update nav active state */
    document.querySelectorAll('.vn-choice').forEach(b =>
        b.classList.toggle('active', b.dataset.section === id)
    );

    if (id === 'home')   inner.innerHTML = homeHTML(t);
    if (id === 'stream') inner.innerHTML = streamHTML(t);
    if (id === 'links')  inner.innerHTML = linksHTML(t);

    /* typewriter only for home bio */
    if (id === 'home') {
        if (bioTmr) clearTimeout(bioTmr);
        setTimeout(() => typewriter(t.bio, 'bio'), 120);
    }
}

function homeHTML(t) {
    const tags = CONFIG.tags.map(tg => `<span>${tg.emoji} ${tg.label}</span>`).join('');
    const socials = CONFIG.socials.map(s => socialLink(s)).join('');
    return `
        <div class="vn-header">
            <div class="vn-nametag">
                <p class="hero-pre">${t.pre}</p>
                <h1 class="hero-name">${CONFIG.name}</h1>
                <p class="hero-cls">${t.cls}</p>
            </div>
            <p class="bio" id="bio"></p>
        </div>
        <div class="rule"><span>✦</span></div>
        <div class="tags">${tags}</div>
        <nav class="socials" aria-label="Social links">${socials}</nav>
        <p class="footer-note">✦ ${CONFIG.fullName} · ${CONFIG.year} ✦</p>`;
}

function streamHTML(t) {
    const platforms = CONFIG.socials.filter(s => s.stream);
    const cards = platforms.map(s => `
        <a href="${s.url}" class="stream-card ${s.id}" target="_blank" rel="noopener" aria-label="${s.label}">
            ${socialIcon(s)}
            <span class="stream-card-label">${s.label}</span>
        </a>`).join('');
    return `
        <div class="vn-nametag">
            <p class="hero-pre">${t.stream_pre}</p>
            <h1 class="hero-name">${CONFIG.name}</h1>
        </div>
        <div class="rule"><span>✦</span></div>
        <p class="section-desc">${t.stream_desc}</p>
        <div class="stream-cards">${cards}</div>
        <p class="stream-note">${t.stream_note}</p>
        <p class="footer-note">✦ ${CONFIG.fullName} · ${CONFIG.year} ✦</p>`;
}

function linksHTML(t) {
    const all = CONFIG.socials.map(s => socialLink(s)).join('');
    return `
        <div class="vn-nametag">
            <p class="hero-pre">${t.links_pre}</p>
            <h1 class="hero-name">${CONFIG.name}</h1>
        </div>
        <div class="rule"><span>✦</span></div>
        <p class="section-desc">${t.links_desc}</p>
        <nav class="socials links-socials" aria-label="All links">${all}</nav>
        <p class="footer-note">✦ ${CONFIG.fullName} · ${CONFIG.year} ✦</p>`;
}

/* ════════════════════════════
   TYPEWRITER
════════════════════════════ */
function typewriter(text, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (bioTmr) clearTimeout(bioTmr);
    el.innerHTML = '';
    const cur = document.createElement('span');
    cur.className = 'cur';
    el.appendChild(cur);
    let i = 0;
    (function t() {
        if (i < text.length) {
            el.insertBefore(document.createTextNode(text[i++]), cur);
            bioTmr = setTimeout(t, 18);
        } else {
            setTimeout(() => cur.remove(), 2500);
        }
    })();
}

/* ════════════════════════════
   LANGUAGE
════════════════════════════ */
function setLang(l) {
    if (!CONFIG.i18n[l] || l === lang) return;
    lang = l;
    localStorage.setItem('aruta_lang', l);
    document.documentElement.setAttribute('lang', l);
    setLangBtn(l);
    buildNav();
    renderSection(section);
}
function setLangBtn(l) {
    document.querySelectorAll('.lb').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === l)
    );
}

/* ════════════════════════════
   THEME
════════════════════════════ */
const THEME_COLORS = { dark: '#08042a', light: '#1a6cd8' };
function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    localStorage.setItem('aruta_theme', theme);
}
function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('ticon').className =
        theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    const m = document.getElementById('meta-theme-color');
    if (m) m.content = THEME_COLORS[theme];
}

/* ════════════════════════════
   ATMOSPHERIC CANVAS
   Night: stars + aurora borealis
   Day:   sun rays
   (particles removed for performance)
════════════════════════════ */
function initAtmo() {
    const canvas = document.getElementById('atmo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let t = 0;

    function resize() {
        canvas.width  = innerWidth;
        canvas.height = innerHeight;
        makeStars();
    }
    resize();
    addEventListener('resize', resize);

    /* ── Stars ── */
    function makeStars() {
        const n = Math.floor(canvas.width * canvas.height / 1200);
        stars = Array.from({ length: n }, () => ({
            x:      Math.random() * canvas.width,
            y:      Math.random() * canvas.height * 0.78,
            r:      Math.random() * 1.3 + 0.2,
            phase:  Math.random() * Math.PI * 2,
            speed:  Math.random() * 0.008 + 0.003,
            bright: Math.random() > 0.88
        }));
    }

    function drawStars() {
        stars.forEach(s => {
            const a = (0.25 + 0.75 * Math.abs(Math.sin(s.phase))) * 0.9;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,252,230,${a})`;
            ctx.fill();
            if (s.bright) {
                ctx.strokeStyle = `rgba(255,252,230,${a * 0.32})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(s.x - s.r * 3.2, s.y); ctx.lineTo(s.x + s.r * 3.2, s.y);
                ctx.moveTo(s.x, s.y - s.r * 3.2); ctx.lineTo(s.x, s.y + s.r * 3.2);
                ctx.stroke();
            }
            s.phase += s.speed;
        });
    }

    /* ── Aurora borealis ── */
    const AURORA = [
        { col: '0,255,180',  yf: 0.20, amp: 46, wl: 0.72, spd: 3.6 },
        { col: '70,110,255', yf: 0.29, amp: 33, wl: 1.15, spd: 2.5 },
        { col: '200,80,255', yf: 0.37, amp: 27, wl: 0.56, spd: 4.2 }
    ];
    function drawAurora() {
        AURORA.forEach((a, idx) => {
            const baseY = canvas.height * a.yf;
            ctx.beginPath();
            ctx.moveTo(0, baseY);
            for (let x = 0; x <= canvas.width; x += 4) {
                const xn = x / canvas.width;
                const y  = baseY
                    + Math.sin((xn * a.spd * Math.PI) + t * a.wl) * a.amp
                    + Math.sin((xn * a.spd * Math.PI * 1.8) + t * a.wl * 1.5) * a.amp * 0.36;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(canvas.width, 0);
            ctx.lineTo(0, 0);
            ctx.closePath();
            const op = 0.048 + 0.022 * Math.sin(t * 0.48 + idx * 1.1);
            const gr = ctx.createLinearGradient(0, baseY - a.amp, 0, baseY + a.amp * 1.9);
            gr.addColorStop(0,    `rgba(${a.col},0)`);
            gr.addColorStop(0.32, `rgba(${a.col},${op})`);
            gr.addColorStop(0.68, `rgba(${a.col},${op * 1.45})`);
            gr.addColorStop(1,    `rgba(${a.col},0)`);
            ctx.fillStyle = gr;
            ctx.fill();
        });
    }

    /* ── Sun rays (day) ── */
    function drawSunRays() {
        const sx = canvas.width  * 0.90;
        const sy = canvas.height * 0.10;
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            const len   = (52 + 22 * Math.sin(t * 0.7 + i)) * (0.65 + 0.35 * Math.sin(t * 0.35 + i * 0.8));
            const ex    = sx + Math.cos(angle) * len;
            const ey    = sy + Math.sin(angle) * len;
            const gr    = ctx.createLinearGradient(sx, sy, ex, ey);
            gr.addColorStop(0, 'rgba(255,230,90,0.18)');
            gr.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
            ctx.strokeStyle = gr; ctx.lineWidth = 2.2; ctx.stroke();
        }
    }

    /* ── Main loop ── */
    (function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
        if (dark) { drawStars(); drawAurora(); }
        else      { drawSunRays(); }
        t += 0.011;
        requestAnimationFrame(frame);
    })();
}
