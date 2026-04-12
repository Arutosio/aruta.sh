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

    // Random summoning variant
    const SUMMON_VARIANTS = [
        { hue: 250, name: 'arcane' },    // purple (default)
        { hue: 45,  name: 'golden' },    // gold
        { hue: 180, name: 'frost' },     // cyan/ice
        { hue: 320, name: 'blood' },     // crimson
    ];
    const summonVariant = SUMMON_VARIANTS[Math.floor(Math.random() * SUMMON_VARIANTS.length)];

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
        const svH = summonVariant.hue;
        const G = light ? 'rgba(90,50,8,'   : `hsla(${svH},80%,67%,`;   // primary glow
        const P = light ? 'rgba(139,28,34,' : `hsla(${(svH + 60) % 360},60%,70%,`; // secondary
        const E = light ? 'rgba(72,40,8,'   : `hsla(${(svH + 150) % 360},55%,55%,`;  // accent

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
