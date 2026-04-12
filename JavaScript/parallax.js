/* ════════════════════════════
   PARALLAX DEPTH
════════════════════════════ */
function initParallax() {
    const ring1 = document.querySelector('.bg-ring-1');
    const ring2 = document.querySelector('.bg-ring-2');
    const magicBg = document.querySelector('.magic-bg');
    if (!ring1 || !ring2 || !magicBg) return;

    let mx = 0.5, my = 0.5;
    let cx = 0.5, cy = 0.5;

    window.addEventListener('mousemove', e => {
        mx = e.clientX / window.innerWidth;
        my = e.clientY / window.innerHeight;
    });

    function parallaxTick() {
        if (window._parallaxEnabled === false) { requestAnimationFrame(parallaxTick); return; }
        if (!_tabVisible) { requestAnimationFrame(parallaxTick); return; }
        cx += (mx - cx) * 0.04;
        cy += (my - cy) * 0.04;

        const offX = (cx - 0.5) * 30;
        const offY = (cy - 0.5) * 20;

        // Shift background pseudo-elements via CSS custom properties
        magicBg.style.setProperty('--px', `${offX * 0.6}px`);
        magicBg.style.setProperty('--py', `${offY * 0.6}px`);

        // Shift rings subtly via CSS custom properties (avoids layout thrashing)
        ring1.style.setProperty('--parallax-x', `${offX * 0.3}px`);
        ring1.style.setProperty('--parallax-y', `${offY * 0.3}px`);
        ring2.style.setProperty('--parallax-x', `${offX * -0.2}px`);
        ring2.style.setProperty('--parallax-y', `${offY * -0.2}px`);

        requestAnimationFrame(parallaxTick);
    }
    parallaxTick();
}
