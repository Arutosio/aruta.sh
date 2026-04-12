/* ╔══════════════════════════════════════════════════════════╗
 * ║  CORE — State, Internationalization, Theme              ║
 * ║  Global state variables, language switching, theme mgmt ║
 * ╚══════════════════════════════════════════════════════════╝ */

/* ────────────────────────────────
 * § STATE — Global variables & constants
 * Shared across all modules via window scope.
 * _tabVisible pauses canvas loops when the tab is hidden.
 * ──────────────────────────────── */
let currentLang  = 'it';
let currentTheme = 'dark';
const RUNE_SET = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᛡᛣᛤᛥᛦ✦⊕⋆◈✧';

/* Cached globals — avoid DOM reads in animation loops */
let _isLight = false;          // cached theme check — updated in toggleTheme
let _tabVisible = true;        // visibility state — pause animations when hidden
window._parallaxEnabled = true;
window._clickSpellsEnabled = true;
window._circleRotationEnabled = true;

document.addEventListener('visibilitychange', () => {
    _tabVisible = !document.hidden;
});

/* ────────────────────────────────
 * § I18N — Language detection, switching, translation
 * Reads from the global `i18n` object defined in config.js.
 * Persists choice in localStorage under 'aruta_lang'.
 * ──────────────────────────────── */

/**
 * Apply translations to all elements with data-i18n attributes
 * @param {string} lang — language code (it, en, es, ja, fn)
 */
function applyTranslations(lang) {
    const t = i18n[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] !== undefined) el.textContent = t[key];
    });
}

/**
 * Auto-detect user language from navigator, with fallback mapping
 * @returns {string} language code
 */
function detectLanguage() {
    const code = (navigator.language || 'en').split('-')[0].toLowerCase();
    if (i18n[code]) return code;
    const map = { pt:'es', ca:'es', gl:'es' };
    return map[code] || 'en';
}

/**
 * Switch the active language, updating all translated content
 * @param {string} lang — target language code
 */
function switchLanguage(lang) {
    if (!i18n[lang] || lang === currentLang) return;
    currentLang = lang;
    localStorage.setItem('aruta_lang', lang);
    document.documentElement.setAttribute('lang', lang === 'fn' ? 'en' : lang);
    setActiveLangBtn(lang);
    applyTranslations(lang);
    buildInterestGrid(lang);
    buildProjectCards(lang);
    typewriterBio(i18n[lang].bio);
    // Update taskbar tab labels to match new language
    document.querySelectorAll('.taskbar-tab').forEach(tab => {
        const id = tab.dataset.tab;
        const meta = WIN_META[id];
        if (!meta) return;
        const labelKey = id === 'settings' ? 'sec_settings' : 'sec_' + id;
        const newLabel = i18n[currentLang][labelKey] || meta.label;
        const labelSpan = tab.querySelector('.tab-label');
        if (labelSpan) labelSpan.textContent = newLabel;
    });
}

/**
 * Sync the language selector UI to the current language
 * @param {string} lang — active language code
 */
function setActiveLangBtn(lang) {
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
    const settingsSel = document.getElementById('settings-lang');
    if (settingsSel) settingsSel.value = lang;
}

/* ────────────────────────────────
 * § THEME — Dark/Light mode toggle
 * Uses a CSS ripple transition centered on the toggle button.
 * Persists choice in localStorage under 'aruta_theme'.
 * ──────────────────────────────── */

/**
 * Toggle between dark and light themes with a ripple transition
 */
function toggleTheme() {
    unlockAchievement('theme_switch');
    // Ripple transition effect
    const ripple = document.createElement('div');
    ripple.className = 'theme-ripple';
    const themeEl = document.getElementById('theme-btn') || document.getElementById('settings-theme-toggle');
    if (themeEl) {
        const btnRect = themeEl.getBoundingClientRect();
        ripple.style.left = btnRect.left + btnRect.width / 2 + 'px';
        ripple.style.top = btnRect.top + btnRect.height / 2 + 'px';
    } else {
        ripple.style.left = '50%';
        ripple.style.top = '50%';
    }
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);

    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    _isLight = currentTheme === 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('aruta_theme', currentTheme);
    updateThemeIcon();
}

/**
 * Sync the theme icon (sun/moon) to the current theme
 */
function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}
