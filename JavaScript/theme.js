/* ════════════════════════════
   THEME TOGGLE
════════════════════════════ */
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

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}
