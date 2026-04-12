/* ════════════════════════════
   TRANSLATIONS
════════════════════════════ */
function applyTranslations(lang) {
    const t = i18n[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] !== undefined) el.textContent = t[key];
    });
}

/* ════════════════════════════
   LANGUAGE DETECTION
════════════════════════════ */
function detectLanguage() {
    const code = (navigator.language || 'en').split('-')[0].toLowerCase();
    if (i18n[code]) return code;
    const map = { pt:'es', ca:'es', gl:'es' };
    return map[code] || 'en';
}

/* ════════════════════════════
   LANGUAGE SWITCH
════════════════════════════ */
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
    // Update taskbar tab labels
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

function setActiveLangBtn(lang) {
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
    const settingsSel = document.getElementById('settings-lang');
    if (settingsSel) settingsSel.value = lang;
}
