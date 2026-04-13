/* ╔══════════════════════════════════════════════════════════╗
 * ║  OS — Windows, Taskbar, Settings, System Info           ║
 * ║  The Arcane OS windowing system and system utilities    ║
 * ╚══════════════════════════════════════════════════════════╝ */

/* ────────────────────────────────
 * § WINDOW TABS (taskbar tab management)
 * Dynamically adds/removes tabs in the taskbar when windows
 * are opened or closed. Each tab shows the window icon + label
 * and has a close button.
 * ──────────────────────────────── */

/** Window metadata — icon and default label for each window type */
const WIN_META = {
    about:    { icon: '📖', label: 'About' },
    live:     { icon: '🔮', label: 'Live' },
    links:    { icon: '🔗', label: 'Links' },
    settings: { icon: '⚙️', label: 'Settings' },
    terminal: { icon: '⌨️', label: 'Terminal' },
};

/**
 * Add a tab to the taskbar for a window
 * @param {string} id — window identifier (about, live, links, settings)
 */
function addWindowTab(id) {
    const tabs = document.getElementById('taskbar-tabs');
    if (!tabs || tabs.querySelector(`[data-tab="${id}"]`)) return;
    const meta = WIN_META[id];
    if (!meta) return;
    const t = i18n[currentLang];
    const labelKey = id === 'settings' ? 'sec_settings' : 'sec_' + id;
    const label = t[labelKey] || meta.label;
    const tab = document.createElement('button');
    tab.className = 'taskbar-tab';
    tab.dataset.tab = id;
    tab.innerHTML = `${meta.icon} <span class="tab-label">${label}</span> <span class="taskbar-tab-close" title="Close">\u2715</span>`;
    tab.addEventListener('click', (e) => {
        if (e.target.closest('.taskbar-tab-close')) {
            closeWindow(id);
            return;
        }
        openWindow(id);
    });
    tabs.appendChild(tab);
}

/**
 * Remove a tab from the taskbar
 * @param {string} id — window identifier
 */
function removeWindowTab(id) {
    const tab = document.querySelector(`.taskbar-tab[data-tab="${id}"]`);
    if (tab) tab.remove();
}

/**
 * Highlight the active tab, un-highlight all others
 * @param {string} id — window identifier to mark active (empty to clear)
 */
function updateActiveTab(id) {
    document.querySelectorAll('.taskbar-tab').forEach(t =>
        t.classList.toggle('tab-active', t.dataset.tab === id)
    );
}

/* ────────────────────────────────
 * § WINDOW MANAGER
 * Handles open/close/minimize/maximize/focus/drag for all
 * .os-window elements. Windows are positioned absolutely
 * within the .desktop container.
 * ──────────────────────────────── */
let topZ = 10;

/** Initialize window controls (minimize, maximize, close, drag) for all windows */
function initWindowManager() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    document.querySelectorAll('.os-window').forEach(win => {
        const id = win.dataset.window;

        // Titlebar drag
        const titlebar = win.querySelector('.win-titlebar');
        if (titlebar) {
            initDrag(win, titlebar);
            // Double-click titlebar to maximize
            titlebar.addEventListener('dblclick', (e) => {
                if (e.target.closest('.win-btn')) return;
                toggleMaximize(win);
            });
        }

        // Focus on click anywhere in window
        win.addEventListener('mousedown', () => focusWindow(win));

        // Minimize button
        const minBtn = win.querySelector('.win-minimize');
        if (minBtn) minBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            minimizeWindow(id);
        });

        // Maximize button
        const maxBtn = win.querySelector('.win-maximize');
        if (maxBtn) maxBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMaximize(win);
        });

        // Close button
        const closeBtn = win.querySelector('.win-close');
        if (closeBtn) closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeWindow(id);
        });
    });

    // Runtime breakpoint transition: maximize visible windows when entering mobile
    const mobileMQ = window.matchMedia('(max-width: 640px)');
    mobileMQ.addEventListener('change', (e) => {
        if (!e.matches) return;
        document.querySelectorAll('.os-window').forEach(win => {
            if (win.style.display !== 'none' && !win.classList.contains('win-maximized')) {
                toggleMaximize(win);
            }
        });
    });
}

/**
 * Open a window by id — centers it with a random offset,
 * adds a taskbar tab, and triggers section entrance effects
 * @param {string} id — window identifier
 */
function openWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;

    if (win.style.display === 'none' || !win.style.display) {
        const isMobile = window.matchMedia('(max-width: 640px)').matches;
        win.style.display = 'flex';
        win.style.width = '';
        win.style.height = '';
        win.style.margin = '';
        win.style.borderRadius = '';
        win.classList.remove('win-maximized');
        if (!isMobile) {
            // Desktop: cascade-centered placement via inline styles
            win.style.position = 'absolute';
            win.style.left = '50%';
            win.style.top = '50%';
            const offset = Math.round((Math.random() - 0.5) * 40);
            win.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px))`;
        } else {
            // Mobile: clear inline overrides so responsive.css takes effect
            win.style.position = '';
            win.style.left = '';
            win.style.top = '';
            win.style.transform = '';
        }
        win.style.animation = 'windowOpen 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        if (isMobile) toggleMaximize(win);
    }
    focusWindow(win);

    // Add taskbar tab
    const meta = WIN_META[id];
    if (meta) addWindowTab(id);
    updateActiveTab(id);

    // Trigger section entrance effects
    animateSectionEntrance(id);

    // Lazy-load live iframes on first open
    if (id === 'live' && !window._liveLoaded) {
        window._liveLoaded = true;
        const firstTab = document.querySelector('.live-tab.active');
        if (firstTab) firstTab.click();
    }

    // Special: bio typewriter on first about open
    if (id === 'about' && !openWindow._bioTyped) {
        openWindow._bioTyped = true;
        typewriterBio(i18n[currentLang].bio);
    }

    // Init settings on first open
    if (id === 'settings' && !openWindow._settingsInit) {
        openWindow._settingsInit = true;
        initSettings();
    }

    // Init terminal on first open
    if (id === 'terminal' && window.terminal) {
        window.terminal.init();
        setTimeout(() => document.getElementById('term-input')?.focus(), 50);
    }

    // Mount custom app via sandbox iframe (lazy)
    const customMeta = WIN_META[id];
    if (customMeta && customMeta.custom && window.sandbox) {
        window.sandbox.mount(id);
    }
}
openWindow._bioTyped = false;
openWindow._settingsInit = false;

/**
 * Close a window with a shrink animation
 * @param {string} id — window identifier
 */
function closeWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;

    win.style.animation = 'windowClose 0.25s ease forwards';
    setTimeout(() => {
        win.style.display = 'none';
        win.style.animation = '';
        win.style.transform = '';
    }, 250);

    removeWindowTab(id);
}

/**
 * Minimize a window (hide it but keep the taskbar tab)
 * @param {string} id — window identifier
 */
function minimizeWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;
    win.style.animation = 'windowClose 0.25s ease forwards';
    setTimeout(() => {
        win.style.display = 'none';
        win.style.animation = '';
    }, 250);
    win.classList.remove('win-focused');
    updateActiveTab('');
}

/**
 * Bring a window to the front and mark it focused
 * @param {HTMLElement} win — the window element
 */
function focusWindow(win) {
    document.querySelectorAll('.os-window').forEach(w => w.classList.remove('win-focused'));
    topZ++;
    win.style.zIndex = topZ;
    win.classList.add('win-focused');
    updateActiveTab(win.dataset.window);
}

/**
 * Toggle a window between maximized (fills screen) and restored
 * @param {HTMLElement} win — the window element
 */
function toggleMaximize(win) {
    if (win.classList.contains('win-maximized')) {
        // Restore
        win.classList.remove('win-maximized');
        win.style.position = win._restoreRect?.position || 'absolute';
        win.style.left = win._restoreRect?.left || '';
        win.style.top = win._restoreRect?.top || '';
        win.style.right = '';
        win.style.bottom = '';
        win.style.width = win._restoreRect?.width || '';
        win.style.height = win._restoreRect?.height || '';
        win.style.transform = win._restoreRect?.transform || '';
        win.style.borderRadius = '';
        win.style.margin = '';
    } else {
        // Save current position for restore
        win._restoreRect = {
            position: win.style.position,
            left: win.style.left,
            top: win.style.top,
            width: win.style.width,
            height: win.style.height,
            transform: win.style.transform,
        };
        // Maximize — fill screen below taskbar
        win.classList.add('win-maximized');
        win.style.position = 'fixed';
        win.style.transform = 'none';
        win.style.left = '0';
        win.style.top = '68px';
        win.style.right = '0';
        win.style.bottom = '0';
        win.style.width = 'auto';
        win.style.height = 'auto';
        win.style.borderRadius = '0';
        win.style.margin = '0';
    }
}

/**
 * Initialize drag behavior on a window's titlebar
 * @param {HTMLElement} win — the window element
 * @param {HTMLElement} handle — the titlebar element
 */
function initDrag(win, handle) {
    let startX, startY, origX, origY;
    let dragging = false;

    function onDown(e) {
        if (e.target.closest('.win-btn')) return;
        if (win.classList.contains('win-maximized')) return;

        dragging = true;
        win.classList.add('win-dragging');
        focusWindow(win);

        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;

        // Get current rendered position
        const rect = win.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;

        // Switch to fixed position to match viewport
        win.style.position = 'fixed';
        win.style.transform = 'none';
        win.style.left = origX + 'px';
        win.style.top = origY + 'px';
        win.style.margin = '0';

        e.preventDefault();
    }

    function onMove(e) {
        if (!dragging) return;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // Clamp within viewport — keep titlebar always reachable
        const winW = win.offsetWidth;
        const winH = win.offsetHeight;
        const taskbarH = 68;
        const minVisible = 40;

        let newX = origX + dx;
        let newY = origY + dy;

        newY = Math.max(taskbarH, newY);
        newY = Math.min(window.innerHeight - minVisible, newY);
        newX = Math.max(-winW + minVisible, newX);
        newX = Math.min(window.innerWidth - minVisible, newX);

        win.style.left = newX + 'px';
        win.style.top = newY + 'px';
    }

    function onUp() {
        if (!dragging) return;
        dragging = false;
        win.classList.remove('win-dragging');
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
}

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

/* ────────────────────────────────
 * § SETTINGS APP
 * Full settings panel with categories: Appearance, Performance,
 * Clock, Language, Sound, Reset, About. Each category has its
 * own page with toggles, sliders, and selectors.
 * All preferences persist in localStorage with 'aruta_' prefix.
 * ──────────────────────────────── */
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
            if (page === 'permissions' && window.permissions) window.permissions.renderSettings();
        });
    });

    // Install button on permissions tab
    const installBtn = document.getElementById('settings-install-pkg');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            await window.installer?.installPrompt();
            window.permissions?.renderSettings();
        });
    }

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

    // Font size slider
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

    // Accent color buttons
    const ACCENTS = {
        gold:    { gold: '#ffc857', goldLight: '#ffe4a0' },
        purple:  { gold: '#a78bfa', goldLight: '#c4b5fd' },
        cyan:    { gold: '#22d3ee', goldLight: '#67e8f9' },
        rose:    { gold: '#fb7185', goldLight: '#fda4af' },
        emerald: { gold: '#34d399', goldLight: '#6ee7b7' },
    };
    // Derive a lighter variant by mixing with white (40%) — used for custom colors.
    function lightenHex(hex, amount = 0.4) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);
        const mix = (c) => Math.round(c + (255 - c) * amount);
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return '#' + toHex(mix(r)) + toHex(mix(g)) + toHex(mix(b));
    }
    function applyAccent(gold, goldLight) {
        document.documentElement.style.setProperty('--gold', gold);
        document.documentElement.style.setProperty('--gold-light', goldLight);
    }
    const customPicker = document.getElementById('settings-accent-custom');
    const customBtn = document.querySelector('.settings-color-btn[data-accent="custom"]');

    document.querySelectorAll('.settings-color-btn').forEach(btn => {
        // Preset buttons: click = select. Custom button: the <input type="color">
        // inside handles the interaction; we only update "active" after it changes.
        if (btn.dataset.accent === 'custom') return;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const colors = ACCENTS[btn.dataset.accent];
            if (colors) {
                applyAccent(colors.gold, colors.goldLight);
                localStorage.setItem('aruta_accent', btn.dataset.accent);
            }
        });
    });

    if (customPicker && customBtn) {
        const onCustomPick = () => {
            const hex = customPicker.value;
            const light = lightenHex(hex, 0.4);
            applyAccent(hex, light);
            localStorage.setItem('aruta_accent', 'custom');
            localStorage.setItem('aruta_accent_custom', hex);
            document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
            customBtn.classList.add('active');
            customBtn.style.setProperty('--custom-color', hex);
        };
        customPicker.addEventListener('input', onCustomPick);
        customPicker.addEventListener('change', onCustomPick);
    }

    // Restore saved accent
    const savedAccent = localStorage.getItem('aruta_accent');
    if (savedAccent === 'custom') {
        const hex = localStorage.getItem('aruta_accent_custom') || '#ffc857';
        if (customPicker) customPicker.value = hex;
        applyAccent(hex, lightenHex(hex, 0.4));
        document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
        if (customBtn) {
            customBtn.classList.add('active');
            customBtn.style.setProperty('--custom-color', hex);
        }
    } else if (savedAccent) {
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

    // Language select
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

    // Reset button — clears all aruta_ settings from localStorage
    const resetBtn = document.getElementById('settings-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem('aruta_theme');
            localStorage.removeItem('aruta_fontsize');
            localStorage.removeItem('aruta_accent');
            localStorage.removeItem('aruta_accent_custom');
            localStorage.removeItem('aruta_showdate');
            localStorage.removeItem('aruta_24h');
            localStorage.removeItem('aruta_lang');
            // Reset to defaults
            document.documentElement.style.fontSize = '100%';
            document.documentElement.style.setProperty('--gold', '#ffc857');
            document.documentElement.style.setProperty('--gold-light', '#ffe4a0');
            if (currentTheme !== 'dark') toggleTheme();
            // Reset toggles UI
            if (themeToggle) themeToggle.classList.remove('active');
            if (fontRange) { fontRange.value = 100; if (fontLabel) fontLabel.textContent = '100%'; }
            if (dateToggle) { dateToggle.classList.add('active'); if (dateEl) dateEl.style.display = ''; if (dateSep) dateSep.style.display = ''; }
            if (h24Toggle) { h24Toggle.classList.add('active'); window._use24h = true; }
            document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
            const goldBtn = document.querySelector('.settings-color-btn[data-accent="gold"]');
            if (goldBtn) goldBtn.classList.add('active');
            const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};
            if (window.showToast) showToast(t.toast_reset_done || 'Settings restored to defaults', 'success');
        });
    }

    // Wipe button — clears ALL localStorage + sessionStorage and reloads
    const wipeBtn = document.getElementById('settings-wipe');
    if (wipeBtn) {
        wipeBtn.addEventListener('click', async () => {
            const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};
            const confirmMsg = t.settings_wipe_confirm || 'Delete all locally stored data and reload the page?';
            const confirmFn = window.showConfirm || ((m) => Promise.resolve(confirm(m)));
            const ok = await confirmFn(confirmMsg, { type: 'warning', okText: t.confirm_wipe || 'Wipe', cancelText: t.confirm_cancel || 'Cancel' });
            if (!ok) return;
            // Collect installed app ids BEFORE clearing storage so we can delete their per-app DBs
            let appIds = [];
            try { appIds = (window.registry?.list() || []).map(a => a.id); } catch {}
            try { localStorage.clear(); } catch (e) { console.warn('localStorage.clear failed', e); }
            try { sessionStorage.clear(); } catch (e) { console.warn('sessionStorage.clear failed', e); }
            // Delete IndexedDB: package registry + each app's private storage DB
            try {
                indexedDB.deleteDatabase('aruta_packages');
                for (const id of appIds) indexedDB.deleteDatabase('aruta_app_' + id);
            } catch (e) { console.warn('indexedDB wipe failed', e); }
            if (window.showToast) showToast(t.toast_wipe_done || 'Local data wiped. Reloading…', 'warning', 1200);
            setTimeout(() => location.reload(), 900);
        });
    }

    // Wipe settings only — keeps installed packages + permissions
    const wipeSettingsBtn = document.getElementById('settings-wipe-settings');
    if (wipeSettingsBtn) {
        wipeSettingsBtn.addEventListener('click', async () => {
            const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};
            const confirmMsg = t.settings_wipe_settings_confirm || 'Reset preferences? Installed apps, commands and their permissions will be kept.';
            const confirmFn = window.showConfirm || ((m) => Promise.resolve(confirm(m)));
            const ok = await confirmFn(confirmMsg, { type: 'warning', okText: t.confirm_wipe || 'Wipe', cancelText: t.confirm_cancel || 'Cancel' });
            if (!ok) return;
            try {
                const preserve = new Set();
                preserve.add('aruta_installed_apps');
                preserve.add('aruta_defaults_seen');
                preserve.add('aruta_defaults_uninstalled');
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('aruta_perms_')) preserve.add(k);
                }
                const toRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('aruta_') && !preserve.has(k)) toRemove.push(k);
                }
                toRemove.forEach(k => localStorage.removeItem(k));
            } catch (e) { console.warn('wipe settings failed', e); }
            try { sessionStorage.clear(); } catch {}
            if (window.showToast) showToast(t.toast_wipe_settings_done || 'Settings wiped. Reloading…', 'warning', 1200);
            setTimeout(() => location.reload(), 900);
        });
    }

    // Performance toggles — enable/disable visual effects
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

    /**
     * Apply a performance toggle — show/hide elements or set window flags
     * @param {Object} config — toggle configuration
     * @param {boolean} enabled — whether the feature is enabled
     */
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

/* ────────────────────────────────
 * § SYSTEM INFO PANEL
 * Popover panel showing live system stats: IP, location,
 * battery, CPU, viewport, FPS, uptime, etc. Auto-refreshes
 * every second while open. Uses ipapi.co for geolocation.
 * ──────────────────────────────── */
function initSysInfo() {
    const btn = document.getElementById('sysinfo-btn');
    const panel = document.getElementById('sysinfo-panel');
    if (!btn || !panel) return;

    // FPS counter
    let fps = 0;
    let fpsFrames = 0;
    let fpsLast = performance.now();
    function trackFPS() {
        fpsFrames++;
        const now = performance.now();
        if (now - fpsLast >= 1000) {
            fps = fpsFrames;
            fpsFrames = 0;
            fpsLast = now;
        }
        requestAnimationFrame(trackFPS);
    }
    trackFPS();

    let isOpen = false;
    let ipData = null;
    const startTime = Date.now();

    function toggle() {
        if (isOpen) {
            panel.style.animation = 'startMenuClose 0.2s ease forwards';
            setTimeout(() => { panel.style.display = 'none'; panel.style.animation = ''; }, 200);
            isOpen = false;
            if (window._sysInfoInterval) { clearInterval(window._sysInfoInterval); window._sysInfoInterval = null; }
        } else {
            panel.style.display = 'block';
            panel.style.animation = 'startMenuOpen 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            isOpen = true;
            refreshInfo();
            if (window._sysInfoInterval) clearInterval(window._sysInfoInterval);
            window._sysInfoInterval = setInterval(() => {
                if (isOpen) refreshInfo();
                else clearInterval(window._sysInfoInterval);
            }, 1000);
        }
    }

    btn.addEventListener('click', toggle);

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (isOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
            toggle();
        }
    });

    /** Fetch IP geolocation data (cached after first call) */
    async function fetchIP() {
        if (ipData) return ipData;
        try {
            const res = await fetch('https://ipapi.co/json/');
            ipData = await res.json();
        } catch { ipData = {}; }
        return ipData;
    }

    /** Detect platform from user agent */
    function getPlatform() {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return navigator.platform || 'Unknown';
    }

    /** Format milliseconds as human-readable uptime */
    function formatUptime(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return h + 'h ' + (m % 60) + 'm';
        if (m > 0) return m + 'm ' + (s % 60) + 's';
        return s + 's';
    }

    /** Refresh all system info rows */
    async function refreshInfo() {
        const rows = document.getElementById('sysinfo-rows');
        if (!rows) return;

        const ip = await fetchIP();
        const conn = navigator.connection || {};
        const uptime = formatUptime(Date.now() - startTime);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let batteryInfo = '\u2014';
        try {
            if (navigator.getBattery) {
                const bat = await navigator.getBattery();
                batteryInfo = Math.round(bat.level * 100) + '%' + (bat.charging ? ' \u26a1' : '');
            }
        } catch {}

        const data = [
            { label: 'Status', value: navigator.onLine ? 'Online' : 'Offline', cls: navigator.onLine ? 'green' : 'red' },
            { label: 'IP', value: ip.ip || '\u2014', cls: 'gold' },
            { label: 'Location', value: [ip.city, ip.region, ip.country_name].filter(Boolean).join(', ') || '\u2014', cls: '' },
            { label: 'ISP', value: ip.org || '\u2014', cls: '' },
            { label: 'Battery', value: batteryInfo, cls: 'gold' },
            { label: 'CPU', value: (navigator.hardwareConcurrency || '?') + ' cores', cls: '' },
            { label: 'Memory', value: (navigator.deviceMemory || '?') + ' GB', cls: '' },
            { label: 'Platform', value: getPlatform(), cls: '' },
            { label: 'Viewport', value: window.innerWidth + '\u00d7' + window.innerHeight, cls: '' },
            { label: 'Screen', value: screen.width + '\u00d7' + screen.height + ' @' + devicePixelRatio + 'x', cls: '' },
            { label: 'Locale', value: navigator.language, cls: '' },
            { label: 'Timezone', value: tz, cls: '' },
            { label: 'Network', value: conn.effectiveType ? conn.effectiveType.toUpperCase() + ' (' + (conn.downlink || '?') + ' Mbps)' : '\u2014', cls: '' },
            { label: 'Uptime', value: uptime, cls: 'gold' },
            { label: 'FPS', value: fps + ' fps', cls: fps >= 50 ? 'green' : fps >= 30 ? 'gold' : 'red' },
        ];

        rows.innerHTML = data.map(d =>
            `<div class="sysinfo-row"><span class="sysinfo-label">${d.label}</span><span class="sysinfo-value ${d.cls}">${d.value}</span></div>`
        ).join('');
    }
}
