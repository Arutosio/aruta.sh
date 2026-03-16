/* ============================================================
   ARUTA.SH — Medieval Fantasy Script
   ============================================================ */

/* ════════════════════════════
   TRANSLATIONS
════════════════════════════ */
const i18n = {
    it: {
        realm:         'IL REGNO DI ARUTA',
        tome_label:    '✦ TOMO DEL MAGO ERRANTE ✦',
        char_subtitle: '— Il Viandante —',
        char_class:    'Streamer · Programmatore · Avventuriero',
        status:        'Online',
        attr_title:    '⊕ Attributi',
        stat_gaming:   'Avventura',
        stat_coding:   'Magia delle Rune',
        stat_stream:   'Arti Bardiche',
        stat_creativity:'Saggezza Arcana',
        sec_home:      'Home',
        sec_about:     'About',
        sec_links:     'Link',
        links_desc:    'Trovami su queste piattaforme',
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
        realm:         'REALM OF ARUTA',
        tome_label:    '✦ TOME OF THE WANDERING MAGE ✦',
        char_subtitle: '— The Wanderer —',
        char_class:    'Streamer · Programmer · Adventurer',
        status:        'Online',
        attr_title:    '⊕ Attributes',
        stat_gaming:   'Adventuring',
        stat_coding:   'Spellcrafting',
        stat_stream:   'Bardic Arts',
        stat_creativity:'Arcane Wisdom',
        sec_home:      'Home',
        sec_about:     'About',
        sec_links:     'Links',
        links_desc:    'Find me on these platforms',
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
        realm:         'REINO DE ARUTA',
        tome_label:    '✦ TOMO DEL MAGO ERRANTE ✦',
        char_subtitle: '— El Viajero —',
        char_class:    'Streamer · Programador · Aventurero',
        status:        'En línea',
        attr_title:    '⊕ Atributos',
        stat_gaming:   'Aventura',
        stat_coding:   'Magia Rúnica',
        stat_stream:   'Artes Bárdicas',
        stat_creativity:'Sabiduría Arcana',
        sec_home:      'Inicio',
        sec_about:     'Sobre mí',
        sec_links:     'Enlaces',
        links_desc:    'Encuéntrame en estas plataformas',
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
        realm:         'アルタの王国',
        tome_label:    '✦ 放浪の魔法使いの書 ✦',
        char_subtitle: '— 旅人 —',
        char_class:    'ストリーマー · プログラマー · 冒険者',
        status:        'オンライン',
        attr_title:    '⊕ ステータス',
        stat_gaming:   '冒険',
        stat_coding:   'ルーン魔法',
        stat_stream:   '吟遊詩人の技',
        stat_creativity:'秘術の知恵',
        sec_home:      'ホーム',
        sec_about:     'について',
        sec_links:     'リンク',
        links_desc:    'これらのプラットフォームで見つけてください',
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

        // Grow-in factor
        const grow = Math.min(1, t / 80);

        ctx.save();
        ctx.translate(cx, cy);

        // Outer ring (clockwise)
        ctx.rotate(t * 0.008);
        drawRing(ctx, 0, 0, maxR * grow, 1.2, 'rgba(212,175,55,0.35)', [4, 8]);
        drawRing(ctx, 0, 0, maxR * grow, 0.6, 'rgba(212,175,55,0.15)', [1, 6]);
        drawRuneDots(ctx, 0, 0, maxR * grow, 8, 'rgba(212,175,55,0.6)', 3);

        // Middle ring (counter-clockwise)
        ctx.rotate(-t * 0.016);
        drawRing(ctx, 0, 0, maxR * 0.7 * grow, 1, 'rgba(167,139,250,0.4)', [2, 5]);
        drawTriangle(ctx, 0, 0, maxR * 0.7 * grow, 'rgba(167,139,250,0.2)');

        // Inner ring (clockwise)
        ctx.rotate(t * 0.024);
        drawRing(ctx, 0, 0, maxR * 0.45 * grow, 0.8, 'rgba(52,211,153,0.35)', [3, 7]);
        drawRuneDots(ctx, 0, 0, maxR * 0.45 * grow, 6, 'rgba(52,211,153,0.7)', 2);

        // Innermost star
        ctx.rotate(-t * 0.012);
        drawStar(ctx, 0, 0, maxR * 0.22 * grow, 6, 'rgba(212,175,55,0.25)');

        ctx.restore();

        // Central glow
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

    // Store cancel reference
    window._cancelSummon = () => cancelAnimationFrame(raf);
}

function drawRing(ctx, x, y, r, lw, color, dash) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}
function drawRuneDots(ctx, cx, cy, r, count, color, dotR) {
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }
}
function drawTriangle(ctx, cx, cy, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();
}
function drawStar(ctx, cx, cy, r, points, color) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        const x  = cx + Math.cos(a) * rr;
        const y  = cy + Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();
}

/* ════════════════════════════
   SUMMONING SEQUENCE (boot text)
════════════════════════════ */
function runSummoning(onComplete) {
    const logEl = document.getElementById('summon-log');
    const lines  = i18n[currentLang].boot;
    let idx = 0;

    function addLine() {
        if (idx < lines.length) {
            const span = document.createElement('span');
            span.className   = 'summon-line';
            span.textContent = lines[idx];
            logEl.appendChild(span);
            idx++;
            setTimeout(addLine, 380);
        } else {
            setTimeout(() => {
                if (window._cancelSummon) window._cancelSummon();
                const overlay = document.getElementById('summon-overlay');
                overlay.classList.add('fade-out');
                setTimeout(onComplete, 850);
            }, 500);
        }
    }
    addLine();
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
            el.insertBefore(document.createTextNode(text.charAt(i)), cursor);
            i++;
            bioTimeout = setTimeout(type, 22);
        } else {
            setTimeout(() => cursor.remove(), 2500);
        }
    }
    type();
}

/* ════════════════════════════
   ATTRIBUTES ANIMATION
════════════════════════════ */
function animateAttributes() {
    document.querySelectorAll('.attr-fill').forEach(bar => {
        bar.style.width = bar.dataset.val + '%';
    });
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

