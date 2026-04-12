/* ════════════════════════════
   WINDOW TABS (taskbar)
════════════════════════════ */
const WIN_META = {
    about:    { icon: '📖', label: 'About' },
    live:     { icon: '🔮', label: 'Live' },
    links:    { icon: '🔗', label: 'Links' },
    settings: { icon: '⚙️', label: 'Settings' },
};

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
        const win = document.getElementById(`win-${id}`);
        if (win) focusWindow(win);
    });
    tabs.appendChild(tab);
}

function removeWindowTab(id) {
    const tab = document.querySelector(`.taskbar-tab[data-tab="${id}"]`);
    if (tab) tab.remove();
}

function updateActiveTab(id) {
    document.querySelectorAll('.taskbar-tab').forEach(t =>
        t.classList.toggle('tab-active', t.dataset.tab === id)
    );
}

/* ════════════════════════════
   WINDOW MANAGER (Arcane OS)
════════════════════════════ */
let topZ = 10;

function initWindowManager() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    // Window controls (minimize, maximize, close)
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
}

function openWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;

    if (win.style.display === 'none' || !win.style.display) {
        // Reset position to centered
        win.style.position = 'absolute';
        win.style.display = 'flex';
        win.style.left = '50%';
        win.style.top = '50%';
        win.style.width = '';
        win.style.height = '';
        win.style.margin = '';
        win.style.borderRadius = '';
        win.classList.remove('win-maximized');
        const offset = Math.round((Math.random() - 0.5) * 40);
        win.style.transform = `translate(calc(-50% + ${offset}px), calc(-50% + ${offset}px))`;
        win.style.animation = 'windowOpen 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    }
    focusWindow(win);

    // Add taskbar tab
    const meta = WIN_META[id];
    if (meta) addWindowTab(id);
    updateActiveTab(id);

    // Trigger section entrance effects
    animateSectionEntrance(id);

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
}
openWindow._bioTyped = false;
openWindow._settingsInit = false;

function closeWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;

    win.style.animation = 'windowClose 0.25s ease forwards';
    setTimeout(() => {
        win.style.display = 'none';
        win.style.animation = '';
        win.style.transform = '';
    }, 250);

    // Remove taskbar tab
    removeWindowTab(id);
}

function minimizeWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;
    win.style.animation = 'windowClose 0.25s ease forwards';
    setTimeout(() => {
        win.style.display = 'none';
        win.style.animation = '';
    }, 250);
    win.classList.remove('win-focused');
    // Keep the taskbar tab — clicking it restores the window via openWindow()
    updateActiveTab('');
}

function focusWindow(win) {
    // Remove focus from all windows
    document.querySelectorAll('.os-window').forEach(w => w.classList.remove('win-focused'));
    // Focus this one
    topZ++;
    win.style.zIndex = topZ;
    win.classList.add('win-focused');
    // Update active tab
    updateActiveTab(win.dataset.window);
}

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

function initDrag(win, handle) {
    let startX, startY, origX, origY;
    let dragging = false;

    function onDown(e) {
        // Don't drag if clicking a button
        if (e.target.closest('.win-btn')) return;
        if (win.classList.contains('win-maximized')) return; // Don't drag maximized windows

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

        // Switch from centered to absolute positioning — use fixed position to match viewport
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
        const minVisible = 40; // pixels of window that must stay on screen

        let newX = origX + dx;
        let newY = origY + dy;

        // Don't go above taskbar
        newY = Math.max(taskbarH, newY);
        // Don't go below screen (keep at least titlebar visible)
        newY = Math.min(window.innerHeight - minVisible, newY);
        // Don't go too far left/right (keep some of window visible)
        newX = Math.max(-winW + minVisible, newX);
        newX = Math.min(window.innerWidth - minVisible, newX);

        win.style.left = newX + 'px';
        win.style.top = newY + 'px';
    }

    function onUp() {
        if (!dragging) return;
        dragging = false;
        win.classList.remove('win-dragging');
        // Keep the position as-is (don't reset to absolute centered)
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
}
