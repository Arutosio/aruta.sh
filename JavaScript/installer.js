/* ╔══════════════════════════════════════════════════════════╗
 * ║  INSTALLER — .zip package import flow                     ║
 * ║  Lazy-loads JSZip, validates manifest, confirms install   ║
 * ╚══════════════════════════════════════════════════════════╝ */

const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
let _jszipPromise = null;

function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (_jszipPromise) return _jszipPromise;
    _jszipPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = JSZIP_CDN;
        s.onload = () => resolve(window.JSZip);
        s.onerror = () => reject(new Error('Failed to load JSZip from CDN'));
        document.head.appendChild(s);
    });
    return _jszipPromise;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,40}$/;
const TYPES = ['app', 'command'];

function validateManifest(m) {
    if (!m || typeof m !== 'object') return 'manifest is not an object';
    if (!ID_RE.test(m.id || '')) return 'invalid id (a-z, 0-9, _-, 2-41 chars)';
    if (!TYPES.includes(m.type)) return 'type must be "app" or "command"';
    if (!m.name || typeof m.name !== 'string') return 'name is required';
    if (m.entry && typeof m.entry !== 'string') return 'entry must be a string';
    if (m.permissions && !Array.isArray(m.permissions)) return 'permissions must be an array';
    return null;
}

async function _confirmInstall(manifest, isUpdate) {
    const t = window.t();
    const titleTpl = isUpdate ? (t.install_update_title || 'Update {name}?') : (t.install_title || 'Install {name}?');
    const title = titleTpl.replace('{name}', manifest.name);
    const permsList = (manifest.permissions || []).map(p => '• ' + (window.permissions?.label(p) || p)).join('\n');
    const body = (t.install_body || 'Type: {type}\nID: {id}\nVersion: {version}\nAuthor: {author}\n\nDeclared permissions:\n{perms}')
        .replace('{type}', manifest.type)
        .replace('{id}', manifest.id)
        .replace('{version}', manifest.version || '—')
        .replace('{author}', manifest.author || '—')
        .replace('{perms}', permsList || (t.install_no_perms || '(none)'));

    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'confirm-backdrop perm-backdrop';
        const modal = document.createElement('div');
        modal.className = 'confirm-modal install-modal';
        modal.innerHTML = `
            <div class="perm-header"><span class="perm-icon"></span><div class="perm-title"></div></div>
            <pre class="install-body"></pre>
            <div class="confirm-actions">
                <button class="confirm-btn confirm-cancel"></button>
                <button class="confirm-btn confirm-ok"></button>
            </div>
        `;
        modal.querySelector('.perm-icon').textContent = manifest.icon || '📦';
        modal.querySelector('.perm-title').textContent = title;
        modal.querySelector('.install-body').textContent = body;
        modal.querySelector('.confirm-cancel').textContent = t.confirm_cancel || 'Cancel';
        modal.querySelector('.confirm-ok').textContent = isUpdate ? (t.install_update || 'Update') : (t.install_install || 'Install');
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('confirm-show'));
        const close = (ok) => {
            backdrop.classList.remove('confirm-show');
            setTimeout(() => backdrop.remove(), 250);
            resolve(ok);
        };
        modal.querySelector('.confirm-ok').addEventListener('click', () => close(true));
        modal.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
        backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });
    });
}

async function installFromFile(file) {
    const t = window.t();
    if (!file) throw new Error('no file');
    if (!/\.zip$/i.test(file.name)) {
        if (window.showToast) showToast(t.install_err_not_zip || 'File must be a .zip', 'error');
        throw new Error('not a zip');
    }
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);

    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) throw new Error('manifest.json missing');
    const manifestText = await manifestEntry.async('string');
    let manifest;
    try { manifest = JSON.parse(manifestText); }
    catch (e) { throw new Error('manifest.json invalid JSON: ' + e.message); }

    const err = validateManifest(manifest);
    if (err) {
        if (window.showToast) showToast((t.install_err_invalid || 'Invalid manifest') + ': ' + err, 'error');
        throw new Error(err);
    }

    const entryPath = manifest.entry || 'index.js';
    if (!zip.file(entryPath)) throw new Error('entry not found: ' + entryPath);

    const isUpdate = window.registry.isInstalled(manifest.id);
    const ok = await _confirmInstall(manifest, isUpdate);
    if (!ok) return false;

    // Read all files as Blobs
    const files = {};
    const filePromises = [];
    zip.forEach((path, entry) => {
        if (entry.dir) return;
        if (path === 'manifest.json') return;
        filePromises.push(entry.async('blob').then(blob => {
            // Set blob type from extension for proper module loading
            const ext = path.split('.').pop().toLowerCase();
            const mime = ext === 'js' ? 'text/javascript'
                : ext === 'css' ? 'text/css'
                : ext === 'json' ? 'application/json'
                : ext === 'html' ? 'text/html'
                : blob.type || 'application/octet-stream';
            files[path] = blob.type === mime ? blob : new Blob([blob], { type: mime });
        }));
    });
    await Promise.all(filePromises);

    await window.registry.saveManifest(manifest, files);
    if (window.showToast) showToast(((isUpdate ? (t.install_updated || '{name} updated') : (t.install_installed || '{name} installed'))).replace('{name}', manifest.name), 'success');
    return manifest;
}

function pickFile() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip,application/zip';
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
    });
}

async function installPrompt() {
    const file = await pickFile();
    if (!file) return null;
    try {
        return await installFromFile(file);
    } catch (e) {
        console.warn('[installer]', e);
        return null;
    }
}

function initDragDrop() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    let counter = 0;
    const overlay = document.createElement('div');
    overlay.className = 'install-dropzone';
    overlay.innerHTML = '<div class="install-dropzone-inner">📦 <span></span></div>';
    document.body.appendChild(overlay);
    const updateLabel = () => {
        const t = window.t();
        overlay.querySelector('span').textContent = t.install_drop_label || 'Drop .zip to install';
    };
    updateLabel();

    document.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
        counter++;
        updateLabel();
        overlay.classList.add('show');
    });
    document.addEventListener('dragover', (e) => {
        if (overlay.classList.contains('show')) { e.preventDefault(); }
    });
    document.addEventListener('dragleave', () => {
        counter--;
        if (counter <= 0) { counter = 0; overlay.classList.remove('show'); }
    });
    document.addEventListener('drop', async (e) => {
        if (!e.dataTransfer) return;
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        e.preventDefault();
        counter = 0;
        overlay.classList.remove('show');
        try { await installFromFile(f); }
        catch (err) { console.warn('[installer drop]', err); }
    });
}

window.installer = { installFromFile, pickFile, installPrompt, initDragDrop };
