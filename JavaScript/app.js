/* ╔══════════════════════════════════════════════════════════╗
 * ║  APP.JS — Application Entry Point                       ║
 * ║  Bootstraps the Arcane OS: restores settings, inits all ║
 * ║  modules, runs summoning sequence, then shows the app.  ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Load order (regular <script> tags, no modules):
 *   1. config.js  — i18n translations, social links, project slugs
 *   2. core.js    — state, i18n functions, theme toggle
 *   3. effects.js — particles, cursor, parallax, spells, fireflies, flying letters
 *   4. desktop.js — magic circle interaction, summoning canvas + sequence
 *   5. content.js — link cards, interests, projects, clips, live, countdown, tilt
 *   6. extras.js  — ambient sound, achievements, share, easter eggs
 *   7. os.js      — window manager, taskbar, start menu, settings, sysinfo, clock
 *   8. app.js     — this file (entry point)
 */

/* ────────────────────────────────
 * § SHOW APP
 * Called after summoning completes (or immediately on repeat
 * visits). Reveals the main app container and initializes
 * all interactive features.
 * ──────────────────────────────── */
function showApp() {
    const app = document.getElementById('app');
    app.classList.remove('hidden');
    app.classList.add('visible');
    buildLinkCards();
    buildInterestGrid(currentLang);
    initLiveSection();
    initCountdown();
    initShareButton();
    buildProjectCards(currentLang);
    buildClipGallery();
    applyTranslations(currentLang);
    startClock();
    initWindowManager();
    initStartMenu();
    initSections();
    updateTabTitle('home');
    initFireflies();
    initMagicCircleInteraction();
    initAmbientSound();
    initAchievements();
    initSysInfo();

    // Entrance animation for home hero on desktop
    setTimeout(() => {
        animateSectionEntrance('home');
        initTilt();
    }, 200);
}

/* ────────────────────────────────
 * § SECTION ENTRANCE EFFECTS
 * Triggers visual entrance animations when a section/window
 * is opened. Each section has its own entrance pattern.
 * ──────────────────────────────── */
function animateSectionEntrance(sectionId) {
    switch (sectionId) {
        case 'home':
            flyingLettersInit();
            break;

        case 'about':
            revealCards('.interest-card', 200);
            setTimeout(initTilt, 800);
            break;

        case 'live':
            // No special entrance animation needed
            break;

        case 'links':
            revealCards('.link-card', 100);
            setTimeout(initTilt, 600);
            break;
    }
}

/* ────────────────────────────────
 * § INIT — DOMContentLoaded
 * Restores saved settings (font size, language, theme),
 * starts background effects, and either runs the summoning
 * sequence or skips it for repeat visits in the same session.
 * ──────────────────────────────── */
// Restore theme/font ASAP (DOMContentLoaded) to prevent flash
document.addEventListener('DOMContentLoaded', () => {
    const savedFontSize = localStorage.getItem('aruta_fontsize');
    if (savedFontSize) document.documentElement.style.fontSize = savedFontSize + '%';

    const savedTheme = localStorage.getItem('aruta_theme');
    currentTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', currentTheme);
    _isLight = currentTheme === 'light';
});

// Wait for ALL resources (CSS, fonts, images) before initializing
window.addEventListener('load', () => {
    const savedLang  = localStorage.getItem('aruta_lang');

    currentLang  = (savedLang && i18n[savedLang]) ? savedLang : detectLanguage();
    document.documentElement.setAttribute('lang', currentLang === 'fn' ? 'en' : currentLang);
    updateThemeIcon();
    setActiveLangBtn(currentLang);

    // Start background effects — CSS is fully loaded now
    initRuneParticles();
    initMagicCursor();
    initParallax();
    initClickSpells();

    /**
     * Smooth fade transition from overlay to desktop.
     * Prepares the app behind the overlay, then fades out.
     */
    function fadeOverlayAndReveal() {
        // Prepare app behind the overlay (invisible, ready to go)
        showApp();
        // Smooth fade-out of the overlay
        const overlay = document.getElementById('summon-overlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            // Fallback removal if transitionend doesn't fire
            setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 1200);
        }
    }

    if (sessionStorage.getItem('aruta_summoned')) {
        // Repeat visit — everything loaded, reveal immediately
        const overlay = document.getElementById('summon-overlay');
        if (overlay) overlay.remove();
        showApp();
    } else {
        // First visit — resources already loaded (we're inside window.load)
        // Play summoning animation then reveal
        initSummonCanvas();

        runSummoning(() => {
            sessionStorage.setItem('aruta_summoned', '1');
            fadeOverlayAndReveal();
        });
    }

    // Bind taskbar controls
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.addEventListener('change', e => switchLanguage(e.target.value));
});
