/* ============================================================
   ARUTA.SH — Main logic
   Tutti i contenuti sono in JavaScript/config.js
   ============================================================ */

/* ════════════════════════════
   STATE
════════════════════════════ */
let lang  = 'it';
let theme = 'dark';
let bioTmr = null;

/* ════════════════════════════
   BOOT
════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const sl = localStorage.getItem('aruta_lang');
    const st = localStorage.getItem('aruta_theme');
    lang  = (sl && CONFIG.i18n[sl]) ? sl : detectLang();
    theme = st || 'dark';

    buildTags();
    buildSocials();
    buildFooter();
    applyTheme();
    setLangBtn(lang);
    document.documentElement.setAttribute('lang', lang);

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
   BUILD DOM FROM CONFIG
════════════════════════════ */
function buildTags() {
    document.getElementById('tags').innerHTML =
        CONFIG.tags.map(t => `<span>${t.emoji} ${t.label}</span>`).join('');
}

const KICK_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M2 2h4v6l4-6h5l-5 7 5 7h-5l-4-6v6H2V2z"/></svg>`;

function buildSocials() {
    document.getElementById('socials').innerHTML =
        CONFIG.socials.map(s => {
            const icon = s.icon === 'kick' ? KICK_SVG : `<i class="${s.icon}"></i>`;
            return `<a href="${s.url}" class="sl ${s.id}" target="_blank" rel="noopener" aria-label="${s.label}">${icon}<span>${s.label}</span></a>`;
        }).join('');
}

function buildFooter() {
    const el = document.getElementById('footer-note');
    if (el) el.textContent = `✦ ${CONFIG.fullName} · ${CONFIG.year} ✦`;
}

/* ════════════════════════════
   SHOW PAGE
════════════════════════════ */
function showPage() {
    const page = document.getElementById('page');
    page.classList.remove('hidden');
    page.classList.add('visible');
    translate(lang);
    setTimeout(() => typewriter(CONFIG.i18n[lang].bio), 400);
}

/* ════════════════════════════
   TRANSLATE
════════════════════════════ */
function translate(l) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = CONFIG.i18n[l][el.dataset.i18n];
        if (v !== undefined) el.textContent = v;
    });
}

/* ════════════════════════════
   TYPEWRITER
════════════════════════════ */
function typewriter(text) {
    const el = document.getElementById('bio');
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
            bioTmr = setTimeout(t, 20);
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
    translate(l);
    typewriter(CONFIG.i18n[l].bio);
}
function setLangBtn(l) {
    document.querySelectorAll('.lb').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === l)
    );
}

/* ════════════════════════════
   THEME
════════════════════════════ */
function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    localStorage.setItem('aruta_theme', theme);
}
const THEME_COLORS = { dark: '#08042a', light: '#1a6cd8' };
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
   Day:   sun rays + light haze
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
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.strokeStyle = gr;
            ctx.lineWidth = 2.2;
            ctx.stroke();
        }
    }

    /* ── Fireflies (night) / sparkles (day) ── */
    const DARK_C = ['150,255,80', '190,255,110', '80,255,180', '220,255,90'];
    const DAY_C  = ['255,200,50', '255,175,70',  '255,230,100', '210,160,255'];

    class Particle {
        constructor(initial) {
            this.reset(initial);
        }
        reset(initial = false) {
            const dark = document.documentElement.getAttribute('data-theme') !== 'light';
            const cols = dark ? DARK_C : DAY_C;
            this.x    = Math.random() * canvas.width;
            this.y    = initial
                ? Math.random() * canvas.height
                : canvas.height * (0.5 + Math.random() * 0.5);
            this.vy   = -(Math.random() * 0.35 + 0.08);
            this.vx   = (Math.random() - 0.5) * 0.2;
            this.sz   = 1.6 + Math.random() * 2.4;
            this.maxA = dark ? 0.45 + Math.random() * 0.5 : 0.35 + Math.random() * 0.4;
            this.a    = 0;
            this.ph   = Math.random() * Math.PI * 2;
            this.life = 0;
            this.max  = 160 + Math.random() * 140;
            this.col  = cols[Math.floor(Math.random() * cols.length)];
        }
        update() {
            this.life++;
            this.ph += 0.036;
            this.x  += this.vx + Math.sin(this.ph) * 0.3;
            this.y  += this.vy;
            const p  = this.life / this.max;
            this.a   = p < 0.15 ? (p / 0.15) * this.maxA
                     : p > 0.82 ? ((1 - p) / 0.18) * this.maxA
                     : this.maxA;
            if (this.life >= this.max || this.y < 0) this.reset();
        }
        draw() {
            const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.sz * 5.5);
            g.addColorStop(0,   `rgba(${this.col},${this.a * 0.9})`);
            g.addColorStop(0.3, `rgba(${this.col},${this.a * 0.35})`);
            g.addColorStop(1,   `rgba(${this.col},0)`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.sz * 5.5, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.sz * 0.44, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.col},${this.a})`; ctx.fill();
        }
    }

    let particles = [];
    function makeParticles() {
        const n = Math.max(20, Math.floor(canvas.width * canvas.height / 10000));
        particles = Array.from({ length: n }, (_, i) => new Particle(i < n * 0.6));
    }
    makeParticles();
    addEventListener('resize', makeParticles);

    /* ── Main loop ── */
    (function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
        if (dark) {
            drawStars();
            drawAurora();
        } else {
            drawSunRays();
        }
        particles.forEach(p => { p.update(); p.draw(); });
        t += 0.011;
        requestAnimationFrame(frame);
    })();
}
