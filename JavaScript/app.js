/* ════════════════════════════
   SHOW APP
════════════════════════════ */
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

/* ════════════════════════════
   SECTION ENTRANCE EFFECTS
════════════════════════════ */
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

/* ════════════════════════════
   INIT
════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    // Restore saved font size immediately to avoid flash
    const savedFontSize = localStorage.getItem('aruta_fontsize');
    if (savedFontSize) document.documentElement.style.fontSize = savedFontSize + '%';

    const savedLang  = localStorage.getItem('aruta_lang');
    const savedTheme = localStorage.getItem('aruta_theme');

    currentLang  = (savedLang && i18n[savedLang]) ? savedLang : detectLanguage();
    currentTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    document.documentElement.setAttribute('data-theme', currentTheme);
    _isLight = currentTheme === 'light';
    document.documentElement.setAttribute('lang', currentLang === 'fn' ? 'en' : currentLang);
    updateThemeIcon();
    setActiveLangBtn(currentLang);

    initRuneParticles();
    initMagicCursor();
    initParallax();
    initClickSpells();

    if (sessionStorage.getItem('aruta_summoned')) {
        // Skip summoning on repeat visits in same session
        const overlay = document.getElementById('summon-overlay');
        if (overlay) overlay.remove();
        showApp();
    } else {
        initSummonCanvas();
        runSummoning(() => {
            sessionStorage.setItem('aruta_summoned', '1');
            showApp();
        });
    }

    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    document.getElementById('lang-select').addEventListener('change', e => switchLanguage(e.target.value));
});
