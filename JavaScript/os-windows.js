/* ╔══════════════════════════════════════════════════════════╗
 * ║  OS-WINDOWS — Window manager, taskbar tabs, drag/resize   ║
 * ║  Split out of os.js. Must load BEFORE os-settings.js,     ║
 * ║  os-sysinfo.js, and registry.js (which all call into it). ║
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

        // Resize handles (8-direction)
        initResize(win);

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

/**
 * Attach 8-direction resize handles (4 edges + 4 corners) to a window.
 * Uses pointer events with setPointerCapture so the drag survives
 * the cursor leaving the viewport. Skips work when the window is
 * maximized. Idempotent — bails if handles were already added.
 * @param {HTMLElement} win
 */
function initResize(win) {
    if (win._resizeWired) return;
    win._resizeWired = true;

    const DIRS = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
    const MIN_W = 240, MIN_H = 160;

    DIRS.forEach(dir => {
        const h = document.createElement('div');
        h.className = 'win-resize ' + dir;
        h.dataset.dir = dir;
        h.addEventListener('pointerdown', (e) => startResize(e, win, dir));
        win.appendChild(h);
    });

    function startResize(e, win, dir) {
        if (e.button !== 0) return;
        if (win.classList.contains('win-maximized')) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof focusWindow === 'function') focusWindow(win);

        const handle = e.currentTarget;
        try { handle.setPointerCapture(e.pointerId); } catch {}

        const rect = win.getBoundingClientRect();
        const startX = e.clientX, startY = e.clientY;
        const startLeft = rect.left, startTop = rect.top;
        const startW = rect.width, startH = rect.height;
        const prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
        win.classList.add('win-resizing');

        // Commit to fixed-position geometry to match dragged state
        win.style.position = 'fixed';
        win.style.transform = 'none';
        win.style.margin = '0';
        win.style.left = startLeft + 'px';
        win.style.top = startTop + 'px';
        win.style.width = startW + 'px';
        win.style.height = startH + 'px';
        win.style.right = '';
        win.style.bottom = '';

        const TASKBAR_H = 68;
        const MAX_W = window.innerWidth;
        const MAX_H = window.innerHeight - TASKBAR_H;

        function onMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let newLeft = startLeft, newTop = startTop;
            let newW = startW, newH = startH;

            if (dir.includes('e')) {
                newW = Math.max(MIN_W, Math.min(MAX_W - startLeft, startW + dx));
            }
            if (dir.includes('s')) {
                newH = Math.max(MIN_H, Math.min(MAX_H - (startTop - TASKBAR_H), startH + dy));
            }
            if (dir.includes('w')) {
                // Constrain so width stays >= MIN_W and left stays >= 0
                const maxDx = startW - MIN_W;
                const minDx = -startLeft;
                const cdx = Math.max(minDx, Math.min(maxDx, dx));
                newLeft = startLeft + cdx;
                newW = startW - cdx;
            }
            if (dir.includes('n')) {
                const maxDy = startH - MIN_H;
                const minDy = TASKBAR_H - startTop;
                const cdy = Math.max(minDy, Math.min(maxDy, dy));
                newTop = startTop + cdy;
                newH = startH - cdy;
            }

            win.style.left = newLeft + 'px';
            win.style.top = newTop + 'px';
            win.style.width = newW + 'px';
            win.style.height = newH + 'px';
        }

        function onUp(ev) {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
            try { handle.releasePointerCapture(ev.pointerId); } catch {}
            document.body.style.userSelect = prevUserSelect;
            win.classList.remove('win-resizing');
        }

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
    }
}
