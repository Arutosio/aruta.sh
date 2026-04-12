/* ════════════════════════════
   MAGIC CURSOR
════════════════════════════ */
function initMagicCursor() {
    const el = document.getElementById('magic-cursor');
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;

    // Hide native cursor everywhere — the magic dot replaces it
    document.documentElement.classList.add('magic-cursor-active');

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
