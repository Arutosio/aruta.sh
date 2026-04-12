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
        if (window._circleRotationEnabled === false) { requestAnimationFrame(tickRings); return; }
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
