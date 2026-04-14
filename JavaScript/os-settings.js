/* SETTINGS — Settings panel + Portable profile UI (split from os.js). */

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

    // Follow-OS toggle — when on, theme tracks prefers-color-scheme live.
    // Defaults to true; manual theme toggles flip this off via toggleTheme().
    const followToggle = document.getElementById('settings-theme-follow-toggle');
    if (followToggle) {
        const isOn = localStorage.getItem('aruta_theme_follow_os') !== 'false';
        followToggle.classList.toggle('active', isOn);
        followToggle.addEventListener('click', () => {
            const nowOn = !followToggle.classList.contains('active');
            localStorage.setItem('aruta_theme_follow_os', nowOn ? 'true' : 'false');
            followToggle.classList.toggle('active', nowOn);
            if (nowOn) {
                const osPref = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                if (osPref !== window.currentTheme) toggleTheme({ keepFollowOS: true });
            }
        });
    }

    // Font family preset
    const FONTS = {
        default:  { body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "'Cinzel', Georgia, serif" },
        medieval: { body: "'IM Fell English', Georgia, serif", display: "'IM Fell English', Georgia, serif" },
        modern:   { body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", display: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
        serif:    { body: "Georgia, 'Times New Roman', serif", display: "Georgia, 'Times New Roman', serif" },
        mono:     { body: "'Courier New', Consolas, monospace", display: "'Courier New', Consolas, monospace" },
        nordic:   { body: "'Cinzel', Georgia, serif", display: "'Cinzel', Georgia, serif" },
    };
    function applyFont(id) {
        const f = FONTS[id] || FONTS.default;
        document.documentElement.style.setProperty('--font-body', f.body);
        document.documentElement.style.setProperty('--font-display', f.display);
    }
    const fontSel = document.getElementById('settings-font');
    if (fontSel) {
        const saved = localStorage.getItem('aruta_font') || 'default';
        fontSel.value = FONTS[saved] ? saved : 'default';
        applyFont(fontSel.value);
        fontSel.addEventListener('change', () => {
            applyFont(fontSel.value);
            localStorage.setItem('aruta_font', fontSel.value);
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

    initProfileSettings();

    // Reset button — clears all aruta_ settings from localStorage
    const resetBtn = document.getElementById('settings-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem('aruta_theme');
            localStorage.removeItem('aruta_fontsize');
            localStorage.removeItem('aruta_font');
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
            if (fontSel) { fontSel.value = 'default'; applyFont('default'); }
            if (dateToggle) { dateToggle.classList.add('active'); if (dateEl) dateEl.style.display = ''; if (dateSep) dateSep.style.display = ''; }
            if (h24Toggle) { h24Toggle.classList.add('active'); window._use24h = true; }
            document.querySelectorAll('.settings-color-btn').forEach(b => b.classList.remove('active'));
            const goldBtn = document.querySelector('.settings-color-btn[data-accent="gold"]');
            if (goldBtn) goldBtn.classList.add('active');
            const t = window.t();
            if (window.showToast) showToast(t.toast_reset_done || 'Settings restored to defaults', 'success');
        });
    }

    // Wipe button — clears ALL localStorage + sessionStorage and reloads
    const wipeBtn = document.getElementById('settings-wipe');
    if (wipeBtn) {
        wipeBtn.addEventListener('click', async () => {
            const t = window.t();
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
            const t = window.t();
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
 * § PROFILE — Portable profile (link folder / export / import)
 * ──────────────────────────────── */
function initProfileSettings() {
    if (!window.profile) return;
    const statusEl   = document.getElementById('settings-profile-status');
    const pickBtn    = document.getElementById('settings-profile-pick');
    const reconnBtn  = document.getElementById('settings-profile-reconnect');
    const unlinkBtn  = document.getElementById('settings-profile-unlink');
    const exportBtn  = document.getElementById('settings-profile-export');
    const importBtn  = document.getElementById('settings-profile-import');
    const importFile = document.getElementById('settings-profile-import-file');
    if (!pickBtn || !exportBtn || !importBtn) return;

    const hasFSAPI = !!(window.showDirectoryPicker);

    async function refreshStatus() {
        const t = window.t();
        const hasHandle = await window.profile.hasHandle();
        const linked    = window.profile.isLinked();
        const disc      = window.profile.isDisconnected();
        const name      = window.profile.linkedName();

        if (!hasFSAPI) {
            pickBtn.style.display = 'none';
            reconnBtn.style.display = 'none';
            unlinkBtn.style.display = 'none';
            if (statusEl) statusEl.textContent = t.settings_profile_zip_only || 'Use Export/Import .zip (folder sync requires Chromium).';
            return;
        }

        if (linked && name) {
            pickBtn.textContent = (t.settings_profile_change || 'Change folder…');
            reconnBtn.style.display = 'none';
            unlinkBtn.style.display = '';
            if (statusEl) statusEl.textContent = (t.settings_profile_linked || 'Linked:') + ' ' + name;
        } else if (hasHandle && disc) {
            pickBtn.textContent = (t.settings_profile_pick || 'Pick folder…');
            reconnBtn.style.display = '';
            unlinkBtn.style.display = '';
            if (statusEl) statusEl.textContent = (t.settings_profile_disconnected || 'Disconnected — reconnect to resume sync.') + (name ? ' (' + name + ')' : '');
        } else {
            pickBtn.textContent = (t.settings_profile_pick || 'Pick folder…');
            reconnBtn.style.display = 'none';
            unlinkBtn.style.display = 'none';
            if (statusEl) statusEl.textContent = t.settings_profile_not_linked || 'Not linked';
        }
    }

    pickBtn.addEventListener('click', async () => {
        const t = window.t();
        if (!hasFSAPI) {
            showToast(t.settings_profile_zip_only || 'Folder linking requires Chromium — use Export/Import.', 'warning');
            return;
        }
        let handle;
        try {
            handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch { return; /* user cancelled */ }

        // Peek: does the folder already hold a profile?
        let existingMeta = null;
        try {
            // Minimal read probe via a transient DiskBackend (we reuse profile internals).
            const probe = new (class {
                constructor(h){ this.handle = h; }
                async read() {
                    try {
                        const fh = await this.handle.getFileHandle('profile.json', { create: false });
                        const f  = await fh.getFile();
                        return JSON.parse(await f.text());
                    } catch { return null; }
                }
            })(handle);
            existingMeta = await probe.read();
        } catch {}

        if (existingMeta) {
            const msg = (t.settings_profile_found_msg || 'This folder already contains a profile.')
                + (existingMeta.updatedAt ? ' (' + existingMeta.updatedAt + ')' : '')
                + '\n\n' + (t.settings_profile_found_prompt || 'Load profile FROM the folder (overwrites browser state), or overwrite the folder WITH current browser state?');
            const confirmFn = window.showConfirm || ((m) => Promise.resolve(confirm(m)));
            const loadFromFolder = await confirmFn(msg, {
                type: 'warning',
                okText: t.settings_profile_load_from_folder || 'Load from folder',
                cancelText: t.settings_profile_overwrite_folder || 'Overwrite folder',
            });
            try {
                if (loadFromFolder) {
                    // Link without overwriting, then read folder and restore (which reloads).
                    await window.profile.link(handle, { overwriteFolder: false });
                    showToast(t.settings_profile_linked_toast || 'Profile linked — loading from folder…', 'success');
                    // Trigger a full read+restore path by calling reconnect-equivalent:
                    const snap = await window.profile.__readLinkedFolder?.();
                    if (snap) { await window.profile.restore(snap); location.reload(); }
                    else {
                        // Fallback: reload and let tryRestoreFromHandle handle it.
                        location.reload();
                    }
                } else {
                    await window.profile.link(handle, { overwriteFolder: true });
                    showToast(t.settings_profile_linked_toast || 'Profile linked — folder written.', 'success');
                    refreshStatus();
                }
            } catch (e) {
                console.warn(e);
                showToast((t.settings_profile_link_failed || 'Link failed:') + ' ' + (e.message || e), 'error');
            }
            return;
        }

        // Fresh folder: just link and write.
        try {
            await window.profile.link(handle, { overwriteFolder: true });
            showToast(t.settings_profile_linked_toast || 'Profile linked — folder written.', 'success');
        } catch (e) {
            console.warn(e);
            showToast((t.settings_profile_link_failed || 'Link failed:') + ' ' + (e.message || e), 'error');
        }
        refreshStatus();
    });

    reconnBtn?.addEventListener('click', async () => {
        const t = window.t();
        const ok = await window.profile.reconnect();
        if (ok) showToast(t.settings_profile_reconnected || 'Profile reconnected.', 'success');
        else showToast(t.settings_profile_reconnect_failed || 'Reconnect denied.', 'warning');
        refreshStatus();
    });

    unlinkBtn?.addEventListener('click', async () => {
        const t = window.t();
        const confirmFn = window.showConfirm || ((m) => Promise.resolve(confirm(m)));
        const ok = await confirmFn(t.settings_profile_unlink_confirm || 'Unlink folder? Your local browser data is kept; only the sync connection is dropped.', {
            type: 'warning',
            okText: t.settings_profile_unlink || 'Unlink',
            cancelText: t.confirm_cancel || 'Cancel',
        });
        if (!ok) return;
        await window.profile.unlink();
        showToast(t.settings_profile_unlinked || 'Profile unlinked.', 'info');
        refreshStatus();
    });

    exportBtn.addEventListener('click', async () => {
        const t = window.t();
        try {
            await window.profile.exportZip();
            showToast(t.settings_profile_exported || 'Profile exported.', 'success');
        } catch (e) {
            console.warn(e);
            showToast((t.settings_profile_export_failed || 'Export failed:') + ' ' + (e.message || e), 'error');
        }
    });

    importBtn.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', async (e) => {
        const t = window.t();
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const confirmFn = window.showConfirm || ((m) => Promise.resolve(confirm(m)));
        const ok = await confirmFn(t.settings_profile_import_confirm || 'Importing will REPLACE all current settings, apps, and app data. Continue?', {
            type: 'warning',
            okText: t.settings_profile_import_btn || 'Import',
            cancelText: t.confirm_cancel || 'Cancel',
        });
        if (!ok) return;
        try {
            showToast(t.settings_profile_importing || 'Importing profile…', 'info', 1500);
            await window.profile.importZip(file);
            // importZip reloads on success.
        } catch (err) {
            console.warn(err);
            showToast((t.settings_profile_import_failed || 'Import failed:') + ' ' + (err.message || err), 'error');
        }
    });

    refreshStatus();
}
