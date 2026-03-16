/* ============================================================
   ARUTA.SH — Medieval Fantasy Script
   ============================================================ */

/* ════════════════════════════
   TRANSLATIONS
════════════════════════════ */
const i18n = {
    it: {
        char_class: 'Streamer · Programmatore · Avventuriero',
        sec_home:   'Home',
        sec_about:  'About',
        sec_links:  'Link',
        links_desc: 'Trovami su queste piattaforme',
        bio: 'Mi chiamo Stefano Aruta. Programmatore appassionato con un amore profondo per anime, manga, Ultima Online, Minecraft e D&D. Come i protagonisti delle storie isekai, mi lancio ora in un nuovo viaggio: lo streaming. Cercando mondi senza confini dove libertà e creatività non hanno limite.',
        boot: [
            '✦ Un\'anima si risveglia in questo reame...',
            '⊕ Consultando il Tomo Antico...',
            '⋆ I Quattro Elementi rispondono...',
            '✦ Il cerchio magico prende forma...',
            '⊕ Il portale si apre...',
            '✦ Benvenuto nel Reame di Aruta ✦'
        ]
    },
    en: {
        char_class: 'Streamer · Programmer · Adventurer',
        sec_home:   'Home',
        sec_about:  'About',
        sec_links:  'Links',
        links_desc: 'Find me on these platforms',
        bio: 'My name is Stefano Aruta. A passionate programmer with a deep love for anime, manga, Ultima Online, Minecraft and D&D. Like the heroes of isekai tales, I now embark on a new journey: streaming. Seeking worlds without boundaries, where freedom and creativity know no limits.',
        boot: [
            '✦ A soul awakens in this realm...',
            '⊕ Consulting the Ancient Tome...',
            '⋆ The Four Elements respond...',
            '✦ The magic circle takes shape...',
            '⊕ The portal opens...',
            '✦ Welcome to the Realm of Aruta ✦'
        ]
    },
    es: {
        char_class: 'Streamer · Programador · Aventurero',
        sec_home:   'Inicio',
        sec_about:  'Sobre mí',
        sec_links:  'Enlaces',
        links_desc: 'Encuéntrame en estas plataformas',
        bio: 'Me llamo Stefano Aruta. Programador apasionado con un profundo amor por el anime, manga, Ultima Online, Minecraft y D&D. Como los protagonistas de las historias isekai, me lanzo ahora a un nuevo viaje: el streaming. Buscando mundos sin límites donde la libertad y la creatividad no tienen fronteras.',
        boot: [
            '✦ Un alma despierta en este reino...',
            '⊕ Consultando el Tomo Antiguo...',
            '⋆ Los Cuatro Elementos responden...',
            '✦ El círculo mágico toma forma...',
            '⊕ El portal se abre...',
            '✦ Bienvenido al Reino de Aruta ✦'
        ]
    },
    ja: {
        char_class: 'ストリーマー · プログラマー · 冒険者',
        sec_home:   'ホーム',
        sec_about:  'について',
        sec_links:  'リンク',
        links_desc: 'これらのプラットフォームで見つけてください',
        bio: '私はStefano Arutaです。アニメ、マンガ、ウルティマオンライン、マインクラフト、D&Dへの深い愛を持つ情熱的なプログラマーです。異世界転生の主人公のように、今私は新たな旅へ踏み出します——ストリーミングの世界へ。自由と創造性に限界のない世界を求めて。',
        boot: [
            '✦ この王国に魂が目覚める...',
            '⊕ 古代の書を開く...',
            '⋆ 四つの元素が応答する...',
            '✦ 魔法陣が形を成す...',
            '⊕ 転移門が開く...',
            '✦ アルタの王国へようこそ ✦'
        ]
    }
};

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
   SHOW APP
════════════════════════════ */
function showApp() {
    const app = document.getElementById('app');
    app.classList.remove('hidden');
    app.classList.add('visible');
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
