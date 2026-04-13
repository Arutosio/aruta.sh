/* ╔══════════════════════════════════════════════════════════╗
 * ║  PERMISSIONS — iOS-style runtime grants for installed pkgs ║
 * ╚══════════════════════════════════════════════════════════╝ */

const PERM_KEY_PREFIX = 'aruta_perms_';
const PERM_LIST = ['storage', 'notifications', 'windows', 'terminal', 'fetch', 'theme', 'clipboard'];

function permLabel(perm) {
    const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};
    return t['perm_' + perm] || perm;
}

function permDesc(perm) {
    const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};
    return t['perm_' + perm + '_desc'] || perm;
}

function permsLoad(appId) {
    try {
        const raw = localStorage.getItem(PERM_KEY_PREFIX + appId);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function permsSave(appId, obj) {
    try { localStorage.setItem(PERM_KEY_PREFIX + appId, JSON.stringify(obj)); } catch {}
}

function permsClear(appId) {
    try { localStorage.removeItem(PERM_KEY_PREFIX + appId); } catch {}
}

function permGet(appId, perm) {
    return permsLoad(appId)[perm];
}

function permSet(appId, perm, value) {
    const p = permsLoad(appId);
    if (value == null) delete p[perm];
    else p[perm] = value;
    permsSave(appId, p);
}

let _activePrompt = null;
async function permRequest(appId, perm) {
    const check = () => {
        const s = permGet(appId, perm);
        if (s === 'granted') return true;
        if (s === 'denied') return false;
        return null;
    };
    const initial = check();
    if (initial !== null) return initial;

    // Wait for any in-flight prompt to finish, then re-check stored state
    // in case the same permission was just granted/denied by that prompt.
    while (_activePrompt) {
        try { await _activePrompt; } catch {}
        const again = check();
        if (again !== null) return again;
    }
    _activePrompt = (async () => {
        const manifest = window.registry?.getManifest(appId) || { name: appId, icon: '📦' };
        const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};
        const titleTpl = t.perm_request_title || '{name} wants to access {perm}';
        const title = titleTpl.replace('{name}', manifest.name).replace('{perm}', permLabel(perm));
        const body = permDesc(perm);

        return new Promise(resolve => {
            const backdrop = document.createElement('div');
            backdrop.className = 'confirm-backdrop perm-backdrop';
            const modal = document.createElement('div');
            modal.className = 'confirm-modal perm-modal';
            modal.innerHTML = `
                <div class="perm-header"><span class="perm-icon"></span><div class="perm-title"></div></div>
                <div class="perm-body"></div>
                <div class="confirm-actions perm-actions">
                    <button class="confirm-btn confirm-cancel" data-act="deny"></button>
                    <button class="confirm-btn confirm-ok" data-act="once"></button>
                    <button class="confirm-btn confirm-ok perm-always" data-act="always"></button>
                </div>
            `;
            modal.querySelector('.perm-icon').textContent = manifest.icon || '📦';
            modal.querySelector('.perm-title').textContent = title;
            modal.querySelector('.perm-body').textContent = body;
            modal.querySelector('[data-act="deny"]').textContent = t.perm_deny || 'Deny';
            modal.querySelector('[data-act="once"]').textContent = t.perm_allow_once || 'Allow once';
            modal.querySelector('[data-act="always"]').textContent = t.perm_allow_always || 'Always allow';
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);
            requestAnimationFrame(() => backdrop.classList.add('confirm-show'));

            const close = (decision) => {
                backdrop.classList.remove('confirm-show');
                setTimeout(() => backdrop.remove(), 250);
                if (decision === 'always') permSet(appId, perm, 'granted');
                else if (decision === 'deny') permSet(appId, perm, 'denied');
                resolve(decision !== 'deny');
            };
            modal.querySelectorAll('button[data-act]').forEach(b => {
                b.addEventListener('click', () => close(b.dataset.act));
            });
            backdrop.addEventListener('click', e => { if (e.target === backdrop) close('deny'); });
        });
    })();
    const result = await _activePrompt;
    _activePrompt = null;
    return result;
}

function permRevokeAll(appId) {
    permsClear(appId);
}

function permRenderSettings() {
    const root = document.getElementById('settings-perms-list');
    if (!root) return;
    const apps = window.registry?.list() || [];
    const t = (typeof i18n !== 'undefined' && i18n[currentLang]) || {};

    if (apps.length === 0) {
        root.innerHTML = `<div class="perm-empty">${t.perm_empty || 'No packages installed.'}</div>`;
        return;
    }

    root.innerHTML = apps.map(a => {
        const perms = permsLoad(a.id);
        const declared = a.permissions || [];
        const allKeys = Array.from(new Set([...declared, ...Object.keys(perms)]));
        const rows = allKeys.length ? allKeys.map(p => {
            const state = perms[p] || 'ask';
            const granted = state === 'granted';
            return `<div class="perm-item">
                <span class="perm-name">${permLabel(p)}</span>
                <span class="perm-state perm-state-${state}">${t['perm_state_' + state] || state}</span>
                <button class="perm-toggle" data-app="${a.id}" data-perm="${p}" data-state="${state}">${granted ? (t.perm_revoke || 'Revoke') : (t.perm_grant || 'Grant')}</button>
            </div>`;
        }).join('') : `<div class="perm-empty-small">${t.perm_no_perms || 'No permissions used.'}</div>`;
        return `<div class="perm-app">
            <div class="perm-app-head">
                <span class="perm-app-icon">${a.icon || '📦'}</span>
                <strong class="perm-app-name">${a.name}</strong>
                <span class="perm-app-type">${a.type}</span>
                <button class="perm-uninstall" data-app="${a.id}" title="${t.perm_uninstall || 'Uninstall'}">🗑️</button>
            </div>
            <div class="perm-app-perms">${rows}</div>
        </div>`;
    }).join('');

    root.querySelectorAll('.perm-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const { app, perm, state } = btn.dataset;
            permSet(app, perm, state === 'granted' ? 'denied' : 'granted');
            permRenderSettings();
        });
    });
    root.querySelectorAll('.perm-uninstall').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.app;
            const ok = await (window.showConfirm || (m => Promise.resolve(confirm(m))))(
                (t.perm_uninstall_confirm || 'Uninstall {name}?').replace('{name}', id),
                { type: 'warning', okText: t.perm_uninstall || 'Uninstall', cancelText: t.confirm_cancel || 'Cancel' }
            );
            if (!ok) return;
            await window.registry?.uninstall(id);
            permsClear(id);
            permRenderSettings();
            if (window.showToast) showToast((t.perm_uninstalled || '{name} uninstalled').replace('{name}', id), 'success');
        });
    });
}

window.permissions = {
    request: permRequest,
    get: permGet,
    set: permSet,
    revokeAll: permRevokeAll,
    renderSettings: permRenderSettings,
    list: PERM_LIST,
    label: permLabel,
};
