/* ╔══════════════════════════════════════════════════════════╗
 * ║  OS — Shell: start menu, sections, clock, tab title,     ║
 * ║       typewriter. Window manager, settings, sysinfo and  ║
 * ║       profile UI live in sibling files:                  ║
 * ║         os-windows.js   — window manager / tabs / drag   ║
 * ║         os-settings.js  — settings panel + profile UI    ║
 * ║         os-sysinfo.js   — system info popover            ║
 * ║       Load order in index.html: os-windows → os →        ║
 * ║       os-settings → os-sysinfo (settings/sysinfo call    ║
 * ║       into os-windows; os.js itself only needs it for    ║
 * ║       openWindow/closeWindow references in start menu).  ║
 * ╚══════════════════════════════════════════════════════════╝ */

/* ────────────────────────────────
 * § START MENU
 * Toggle-able menu anchored to the taskbar start button.
 * Opens windows via .start-item clicks and closes on outside
 * click or Escape key.
 * ──────────────────────────────── */
function initStartMenu() {
    const btn = document.getElementById('start-btn');
    const menu = document.getElementById('start-menu');
    if (!btn || !menu) return;

    let isOpen = false;

    function toggleMenu() {
        if (isOpen) {
            menu.style.animation = 'startMenuClose 0.2s ease forwards';
            btn.classList.remove('start-open');
            setTimeout(() => { menu.style.display = 'none'; menu.style.animation = ''; }, 200);
            isOpen = false;
        } else {
            menu.style.display = 'block';
            menu.style.animation = 'startMenuOpen 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            btn.classList.add('start-open');
            isOpen = true;
        }
    }

    function closeMenu() {
        if (!isOpen) return;
        toggleMenu();
    }

    btn.addEventListener('click', toggleMenu);

    // Start menu items → open window + close menu
    menu.querySelectorAll('.start-item').forEach(item => {
        item.addEventListener('click', () => {
            openWindow(item.dataset.window);
            closeMenu();
        });
    });

    // Share in start menu — close menu on click (share logic in extras.js)
    const shareBtn = document.getElementById('start-share');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => closeMenu());
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) {
            closeMenu();
        }
    });

    // Close menu on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closeMenu();
    });
}

/* ────────────────────────────────
 * § SECTION SWITCHING
 * Mobile swipe navigation between open windows.
 * Swipe left/right to switch focus between open windows.
 * ──────────────────────────────── */
function initSections() {
    let touchStartX = 0;
    let touchStartY = 0;
    const SWIPE_THRESHOLD = 60;

    document.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

        const openWindows = Array.from(document.querySelectorAll('.os-window')).filter(w => w.style.display !== 'none');
        if (openWindows.length < 2) return;

        const focused = document.querySelector('.os-window.win-focused');
        if (!focused) return;
        const currentIdx = openWindows.indexOf(focused);
        if (currentIdx < 0) return;

        const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
        if (nextIdx < 0 || nextIdx >= openWindows.length) return;

        focusWindow(openWindows[nextIdx]);
    }, { passive: true });
}

/* ────────────────────────────────
 * § CLOCK
 * Updates the HUD time and date every second.
 * Respects the _use24h setting for 12/24 hour format.
 * ──────────────────────────────── */
function startClock() {
    tickClock();
    setInterval(tickClock, 1000);
}

function tickClock() {
    const now = new Date();
    let hrs = now.getHours();
    if (window._use24h === false) {
        hrs = hrs % 12 || 12;
    }
    const h  = String(hrs).padStart(2, '0');
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

/* ────────────────────────────────
 * § TAB TITLE — LIVE INDICATOR
 * Updates the browser tab title when the live section is open.
 * ──────────────────────────────── */
function updateTabTitle(sectionId) {
    const base = 'Aruta.sh \u2014 Tome of the Wandering Mage';
    if (sectionId === 'live') {
        document.title = '\uD83D\uDD2E Live \u2014 Aruta.sh';
    } else {
        document.title = base;
    }
}

/* ────────────────────────────────
 * § TYPEWRITER
 * Character-by-character bio text animation with a blinking
 * cursor. Unlocks the speed_reader achievement on completion.
 * ──────────────────────────────── */

/**
 * Typewriter animation for the bio text
 * @param {string} text — the bio text to type out
 */
function typewriterBio(text) {
    const el = document.getElementById('char-bio');
    if (!el) return;
    if (typewriterBio._timeout) clearTimeout(typewriterBio._timeout);
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);
    let i = 0;
    function type() {
        if (i < text.length) {
            el.insertBefore(document.createTextNode(text.charAt(i++)), cursor);
            typewriterBio._timeout = setTimeout(type, 22);
        } else {
            unlockAchievement('speed_reader');
            setTimeout(() => cursor.remove(), 2500);
        }
    }
    type();
}
