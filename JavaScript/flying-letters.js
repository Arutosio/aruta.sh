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
