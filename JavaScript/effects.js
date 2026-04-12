/* ════════════════════════════
   CLICK SPELL BURST
════════════════════════════ */
function initClickSpells() {
    const RUNES = RUNE_SET;
    const BURST_COUNT = 12;

    document.addEventListener('click', e => {
        if (window._clickSpellsEnabled === false) return;
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
