/* ════════════════════════════
   SETTINGS APP
════════════════════════════ */
function initSettings() {
    // Sidebar category navigation
    document.querySelectorAll('.settings-cat').forEach(cat => {
        cat.addEventListener('click', () => {
            document.querySelectorAll('.settings-cat').forEach(c => c.classList.remove('active'));
            cat.classList.add('active');
            const page = cat.dataset.cat;
            document.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));
            const target = document.querySelector(`.settings-page[data-page="${page}"]`);
            if (target) target.classList.add('active');
        });
    });

    // Theme toggle
    const themeToggle = document.getElementById('settings-theme-toggle');
    if (themeToggle) {
        if (currentTheme === 'dark') themeToggle.classList.remove('active');
        else themeToggle.classList.add('active');
        themeToggle.addEventListener('click', () => {
            toggleTheme();
            themeToggle.classList.toggle('active');
        });
    }

    // Font size
    const fontRange = document.getElementById('settings-font-size');
    const fontLabel = document.getElementById('font-size-label');
    if (fontRange) {
        const saved = localStorage.getItem('aruta_fontsize') || '100';
        fontRange.value = saved;
        if (fontLabel) fontLabel.textContent = saved + '%';
        document.documentElement.style.fontSize = saved + '%';
        fontRange.addEventListener('input', () => {
            const val = fontRange.value;
            document.documentElement.style.fontSize = val + '%';
            if (fontLabel) fontLabel.textContent = val + '%';
            localStorage.setItem('aruta_fontsize', val);
        });
    }

    // Accent color
    document.querySelectorAll('.settings-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const accent = btn.dataset.accent;
            const ACCENTS = {
                gold:    { gold: '#ffc857', goldLight: '#ffe4a0' },
                purple:  { gold: '#a78bfa', goldLight: '#c4b5fd' },
                cyan:    { gold: '#22d3ee', goldLight: '#67e8f9' },
                rose:    { gold: '#fb7185', goldLight: '#fda4af' },
                emerald: { gold: '#34d399', goldLight: '#6ee7b7' },
            };
            const colors = ACCENTS[accent];
            if (colors) {
                document.documentElement.style.setProperty('--gold', colors.gold);
                document.documentElement.style.setProperty('--gold-light', colors.goldLight);
                localStorage.setItem('aruta_accent', accent);
            }
        });
    });
    // Restore saved accent
    const savedAccent = localStorage.getItem('aruta_accent');
    if (savedAccent) {
        const btn = document.querySelector(`.settings-color-btn[data-accent="${savedAccent}"]`);
        if (btn) btn.click();
    }

    // Show/hide date
    const dateToggle = document.getElementById('settings-show-date');
    const dateEl = document.getElementById('hud-date');
    const dateSep = document.querySelector('.hud-clock-sep');
    if (dateToggle) {
        const showDate = localStorage.getItem('aruta_showdate') !== 'false';
        dateToggle.classList.toggle('active', showDate);
        if (!showDate && dateEl) { dateEl.style.display = 'none'; if (dateSep) dateSep.style.display = 'none'; }
        dateToggle.addEventListener('click', () => {
            dateToggle.classList.toggle('active');
            const show = dateToggle.classList.contains('active');
            if (dateEl) dateEl.style.display = show ? '' : 'none';
            if (dateSep) dateSep.style.display = show ? '' : 'none';
            localStorage.setItem('aruta_showdate', show);
        });
    }

    // 24h format
    const h24Toggle = document.getElementById('settings-24h');
    if (h24Toggle) {
        const use24 = localStorage.getItem('aruta_24h') !== 'false';
        h24Toggle.classList.toggle('active', use24);
        window._use24h = use24;
        h24Toggle.addEventListener('click', () => {
            h24Toggle.classList.toggle('active');
            window._use24h = h24Toggle.classList.contains('active');
            localStorage.setItem('aruta_24h', window._use24h);
        });
    }

    // Sound toggle
    const soundToggle = document.getElementById('settings-sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            soundToggle.classList.toggle('active');
            document.getElementById('sound-btn')?.click();
        });
    }

    // Language
    const langSelect = document.getElementById('settings-lang');
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener('change', () => {
            const mainSelect = document.getElementById('lang-select');
            if (mainSelect) {
                mainSelect.value = langSelect.value;
                mainSelect.dispatchEvent(new Event('change'));
            }
        });
    }

    // Reset button
    const resetBtn = document.getElementById('settings-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // Clear all settings from localStorage
            localStorage.removeItem('aruta_theme');
            localStorage.removeItem('aruta_fontsize');
            localStorage.removeItem('aruta_accent');
            localStorage.removeItem('aruta_showdate');
            localStorage.removeItem('aruta_24h');
            localStorage.removeItem('aruta_lang');
            // Reset to defaults
            document.documentElement.style.fontSize = '100%';
            document.documentElement.style.setProperty('--gold', '#ffc857');
            document.documentElement.style.setProperty('--gold-light', '#ffe4a0');
            // Reset theme to dark
            if (currentTheme !== 'dark') toggleTheme();
            // Reset toggles UI
            if (themeToggle) themeToggle.classList.remove('active');
            if (fontRange) { fontRange.value = 100; if (fontLabel) fontLabel.textContent = '100%'; }
            if (dateToggle) { dateToggle.classList.add('active'); if (dateEl) dateEl.style.display = ''; if (dateSep) dateSep.style.display = ''; }
            if (h24Toggle) { h24Toggle.classList.add('active'); window._use24h = true; }
            document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
            const goldBtn = document.querySelector('.settings-color-btn[data-accent="gold"]');
            if (goldBtn) goldBtn.classList.add('active');
            // Visual feedback
            resetBtn.textContent = '✓';
            setTimeout(() => resetBtn.textContent = 'Reset', 1500);
        });
    }

    // Performance toggles
    const perfToggles = {
        'settings-particles': { selector: '#rune-bg', prop: 'display' },
        'settings-fog': { selector: '.fog-layer', prop: 'display', all: true },
        'settings-parallax': { key: '_parallaxEnabled' },
        'settings-cursor': { selector: '#magic-cursor', prop: 'display', cursorClass: true },
        'settings-clickspells': { key: '_clickSpellsEnabled' },
        'settings-circles': { key: '_circleRotationEnabled' },
    };

    for (const [id, config] of Object.entries(perfToggles)) {
        const toggle = document.getElementById(id);
        if (!toggle) continue;

        // Restore from localStorage
        const saved = localStorage.getItem('aruta_' + id);
        if (saved === 'false') {
            toggle.classList.remove('active');
            applyPerfToggle(config, false);
        }

        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            const enabled = toggle.classList.contains('active');
            localStorage.setItem('aruta_' + id, enabled);
            applyPerfToggle(config, enabled);
        });
    }

    function applyPerfToggle(config, enabled) {
        if (config.selector) {
            const els = config.all
                ? document.querySelectorAll(config.selector)
                : [document.querySelector(config.selector)];
            els.forEach(el => {
                if (!el) return;
                if (config.prop === 'display') el.style.display = enabled ? '' : 'none';
                else if (config.prop === 'animation') el.style.animation = enabled ? '' : 'none';
            });
        }
        if (config.key) window[config.key] = enabled;
        if (config.cursorClass) {
            if (enabled) document.documentElement.classList.add('magic-cursor-active');
            else document.documentElement.classList.remove('magic-cursor-active');
        }
    }
}
