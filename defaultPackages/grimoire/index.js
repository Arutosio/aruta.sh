const HLJS_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
const HLJS_THEME  = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';

const EXT_TO_LANG = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
    py: 'python', pyw: 'python',
    cs: 'csharp',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp', c: 'cpp',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin', kts: 'kotlin',
    swift: 'swift',
    php: 'php', phtml: 'php',
    rb: 'ruby',
    sql: 'sql',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    ps1: 'powershell', psm1: 'powershell',
    html: 'html', htm: 'html',
    css: 'css', scss: 'css', sass: 'css',
    json: 'json',
    yaml: 'yaml', yml: 'yaml',
    xml: 'xml', svg: 'xml',
    md: 'markdown', markdown: 'markdown', mdown: 'markdown',
    txt: 'plaintext', log: 'plaintext',
};

function langFromFilename(name) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
    if (!m) return 'plaintext';
    return EXT_TO_LANG[m[1].toLowerCase()] || 'plaintext';
}

const LANGS = [
    { id: 'plaintext', label: 'Plain' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'csharp', label: 'C#' },
    { id: 'cpp', label: 'C++' },
    { id: 'rust', label: 'Rust' },
    { id: 'go', label: 'Go' },
    { id: 'java', label: 'Java' },
    { id: 'kotlin', label: 'Kotlin' },
    { id: 'swift', label: 'Swift' },
    { id: 'php', label: 'PHP' },
    { id: 'ruby', label: 'Ruby' },
    { id: 'sql', label: 'SQL' },
    { id: 'bash', label: 'Bash' },
    { id: 'powershell', label: 'PowerShell' },
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'json', label: 'JSON' },
    { id: 'yaml', label: 'YAML' },
    { id: 'xml', label: 'XML' },
    { id: 'markdown', label: 'Markdown' },
];

const DEFAULT_SETTINGS = {
    activeLine:    true,
    lineNumbers:   true,
    grid:          false,
    liveHighlight: true,
    wrap:          false,
    tabWidth:      4,
};

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('failed to load ' + src));
        document.head.appendChild(s);
    });
}
function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export default {
    async mount(root, ctx) {
        loadCSS(HLJS_THEME);
        const hljsReady = loadScript(HLJS_SCRIPT).catch(() => null);

        root.innerHTML = `
            <div class="wrap">
                <aside class="sidebar">
                    <div class="sidebar-head">
                        <button class="folder-open-btn" title="Open a folder to browse/edit its files">📁 Open folder</button>
                        <button class="folder-new-file" style="display:none" title="New file in root">📄＋</button>
                        <button class="folder-new-dir" style="display:none" title="New folder in root">📁＋</button>
                        <button class="menu-btn" title="More">⋮</button>
                        <div class="menu-pop" style="display:none"></div>
                    </div>
                    <div class="fs-section">
                        <div class="folder-tree"></div>
                    </div>
                </aside>
                <section class="main">
                    <div class="toolbar">
                        <input class="title" type="text" placeholder="Untitled" />
                        <select class="lang">
                            ${LANGS.map(l => `<option value="${l.id}">${l.label}</option>`).join('')}
                        </select>
                        <div class="view-tabs">
                            <button class="tab-edit active" data-view="edit">Edit</button>
                            <button class="tab-preview" data-view="preview">Preview</button>
                            <button class="tab-settings" data-view="settings" title="Editor settings">⚙</button>
                        </div>
                        <span class="save-indicator"></span>
                    </div>
                    <div class="body"><div class="empty">Open a folder to start editing.</div></div>
                </section>
            </div>
        `;

        const $title   = root.querySelector('.title');
        const $lang    = root.querySelector('.lang');
        const $tabs    = root.querySelectorAll('.view-tabs button');
        const $body    = root.querySelector('.body');
        const $saveInd = root.querySelector('.save-indicator');

        let activeId = (await ctx.storage.get('active')) || null;
        // Ignore any non-file: active id (legacy scroll id from pre-1.8.0).
        if (activeId && !(typeof activeId === 'string' && activeId.startsWith('file:'))) activeId = null;
        let settings = Object.assign({}, DEFAULT_SETTINGS, (await ctx.storage.get('settings')) || {});
        let view = 'edit';

        // Folder state — session-only (File System Access handles can't be
        // persisted; re-opening the folder is a user gesture anyway).
        const _folder = { root: null, name: '', tree: null, expanded: new Set(), fallback: false };
        const _fileDocs = new Map(); // path → { handle?, file?, title, lang, content, updatedAt }
        let fileSaveTimer = null;

        // Hold references to the current edit-view nodes (re-set by renderBody)
        let $editor = null, $paper = null, $ta = null, $gutter = null, $activeLine = null;
        let $hlLayer = null, $hlCode = null, hlTimer = null;

        function active() {
            if (activeId && typeof activeId === 'string' && activeId.startsWith('file:')) {
                return _fileDocs.get(activeId.slice(5)) || null;
            }
            return null;
        }

        // ── Editor helpers ──────────────────────────
        function applyEditorSettings() {
            if (!$editor) return;
            $editor.classList.toggle('opt-activeline', settings.activeLine);
            $editor.classList.toggle('opt-linenums',   settings.lineNumbers);
            $editor.classList.toggle('opt-hl-live',    settings.liveHighlight);
            $editor.classList.toggle('opt-wrap',       settings.wrap);
            $paper.classList.toggle('opt-grid',        settings.grid);
            $ta.style.tabSize = settings.tabWidth;
            if (settings.wrap) {
                requestAnimationFrame(() => {
                    const sbw = $ta.offsetWidth - $ta.clientWidth;
                    $editor.style.setProperty('--sbw', sbw + 'px');
                    updateGutter();
                });
            } else {
                $editor.style.setProperty('--sbw', '0px');
            }
        }

        const HL_MAX_BYTES = 200 * 1024;

        function updateHighlight() {
            if (!$hlCode || !$ta) return;
            if (!settings.liveHighlight) return;
            const d = active();
            const lang = d?.lang || 'plaintext';
            const text = $ta.value + '\n';
            $hlCode.textContent = text;
            const tooBig = text.length > HL_MAX_BYTES;
            if (window.hljs && lang !== 'plaintext' && !tooBig) {
                $hlCode.className = 'language-' + lang;
                $hlCode.removeAttribute('data-highlighted');
                try { window.hljs.highlightElement($hlCode); } catch {}
            } else {
                $hlCode.className = '';
            }
            syncHLScroll();
        }

        function scheduleHighlight() {
            if (hlTimer) clearTimeout(hlTimer);
            hlTimer = setTimeout(updateHighlight, 80);
        }

        function syncHLScroll() {
            if (!$hlCode || !$ta || !$gutter) return;
            $hlCode.style.transform = `translate(${-$ta.scrollLeft}px, ${-$ta.scrollTop}px)`;
            $gutter.style.transform = `translateY(${-$ta.scrollTop}px)`;
        }

        let $gutterMirror = null;
        function ensureGutterMirror() {
            if ($gutterMirror && $gutterMirror.isConnected) return $gutterMirror;
            $gutterMirror = document.createElement('div');
            $gutterMirror.setAttribute('aria-hidden', 'true');
            $gutterMirror.style.cssText =
                'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;' +
                'padding:0;margin:0;border:0;box-sizing:border-box;' +
                'font-family:var(--mono);font-size:var(--ed-font);line-height:var(--ed-line);' +
                'white-space:pre-wrap;word-wrap:break-word;tab-size:' + settings.tabWidth + ';';
            document.body.appendChild($gutterMirror);
            return $gutterMirror;
        }
        function updateGutter() {
            if (!$gutter || !$ta) return;
            const lines = $ta.value.split('\n');
            if (!settings.wrap) {
                _lineRows = null;
                let html = '';
                for (let i = 0; i < lines.length; i++) html += (i + 1) + '\n';
                $gutter.textContent = html;
            } else {
                const mirror = ensureGutterMirror();
                const taStyle = getComputedStyle($ta);
                const padX = parseFloat(taStyle.paddingLeft) + parseFloat(taStyle.paddingRight);
                const wrapW = $ta.clientWidth - padX;
                if (wrapW <= 0) { $gutter.textContent = ''; return; }
                mirror.style.width = wrapW + 'px';
                mirror.style.tabSize = settings.tabWidth;
                const lineH = parseFloat(getComputedStyle(mirror).lineHeight) || 22;
                let html = '';
                _lineRows = new Array(lines.length);
                for (let i = 0; i < lines.length; i++) {
                    mirror.textContent = lines[i] === '' ? ' ' : lines[i];
                    const rows = Math.max(1, Math.round(mirror.clientHeight / lineH));
                    _lineRows[i] = rows;
                    html += (i + 1);
                    for (let j = 1; j < rows; j++) html += '\n';
                    html += '\n';
                }
                $gutter.textContent = html;
            }
            syncHLScroll();
        }

        let _lineRows = null;

        function updateActiveLine() {
            if (!$activeLine || !$ta) return;
            const before = $ta.value.slice(0, $ta.selectionStart);
            const lineIdx = (before.match(/\n/g) || []).length;
            const rootStyles = getComputedStyle(document.documentElement);
            const lineH = parseFloat(rootStyles.getPropertyValue('--ed-line')) || 22;
            const padY  = parseFloat(rootStyles.getPropertyValue('--ed-pad-y')) || 12;

            let visualRow = lineIdx;
            if (settings.wrap && _lineRows) {
                let sum = 0;
                for (let i = 0; i < lineIdx && i < _lineRows.length; i++) sum += _lineRows[i];
                const mirror = ensureGutterMirror();
                const lineStart = before.lastIndexOf('\n') + 1;
                const colBefore = $ta.value.slice(lineStart, $ta.selectionStart);
                mirror.textContent = colBefore === '' ? ' ' : colBefore;
                const mLineH = parseFloat(getComputedStyle(mirror).lineHeight) || 22;
                const rowInLine = Math.max(0, Math.round(mirror.clientHeight / mLineH) - 1);
                visualRow = sum + rowInLine;
            }
            $activeLine.style.transform = `translateY(${padY + visualRow * lineH - $ta.scrollTop}px)`;
        }

        function onContentChange() { updateGutter(); updateActiveLine(); syncHLScroll(); }
        function onCaretChange()   { updateActiveLine(); syncHLScroll(); }

        // ── Body rendering ──────────────────────────
        async function renderBody() {
            const d = active();
            $title.disabled = !d || view === 'settings';
            $lang.disabled  = !d || view === 'settings';
            if (!d) {
                $body.innerHTML = _folder.tree
                    ? '<div class="empty">Select a file from the tree…</div>'
                    : '<div class="empty">Open a folder to start editing.</div>';
                $title.value = ''; return;
            }
            $title.value = d.title || '';
            $lang.value  = d.lang || 'plaintext';

            if (view === 'edit') {
                $body.innerHTML = `
                    <div class="editor">
                        <div class="gutter"><div class="gutter-inner"></div></div>
                        <div class="paper">
                            <div class="active-line"></div>
                            <pre class="hl-layer" aria-hidden="true"><code></code></pre>
                            <textarea spellcheck="false"></textarea>
                        </div>
                    </div>
                `;
                $editor     = $body.querySelector('.editor');
                $paper      = $body.querySelector('.paper');
                $ta         = $body.querySelector('textarea');
                $gutter     = $body.querySelector('.gutter-inner');
                $activeLine = $body.querySelector('.active-line');
                $hlLayer    = $body.querySelector('.hl-layer');
                $hlCode     = $hlLayer.querySelector('code');
                $ta.value = d.content || '';
                applyEditorSettings();
                updateGutter();
                updateActiveLine();
                hljsReady.then(updateHighlight);

                $ta.addEventListener('input', () => {
                    d.content = $ta.value;
                    d.updatedAt = Date.now();
                    onContentChange();
                    scheduleHighlight();
                    scheduleFileSave();
                });
                $ta.addEventListener('keyup',  onCaretChange);
                $ta.addEventListener('click',  onCaretChange);
                $ta.addEventListener('scroll', syncHLScroll);
                $ta.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = $ta.selectionStart, end = $ta.selectionEnd;
                        const ins = ' '.repeat(settings.tabWidth);
                        $ta.value = $ta.value.slice(0, start) + ins + $ta.value.slice(end);
                        $ta.selectionStart = $ta.selectionEnd = start + ins.length;
                        d.content = $ta.value;
                        onContentChange();
                        scheduleHighlight();
                        scheduleFileSave();
                    }
                });
                $ta.focus();

                window.addEventListener('resize', () => {
                    if ($editor?.isConnected) updateGutter();
                });
            } else if (view === 'preview') {
                const content = d.content || '';
                const lang = d.lang || 'plaintext';
                await hljsReady;
                $body.innerHTML = '<div class="preview"><pre><code></code></pre></div>';
                const codeEl = $body.querySelector('code');
                codeEl.textContent = content;
                if (window.hljs && lang !== 'plaintext') {
                    codeEl.className = 'language-' + lang;
                    try { window.hljs.highlightElement(codeEl); } catch {}
                }
            } else if (view === 'settings') {
                $body.innerHTML = `
                    <div class="settings-pane">
                        <h3>Editor</h3>
                        <p>These apply to every file; changes save automatically.</p>
                        <div class="settings-row">
                            <div class="label"><strong>Highlight active line</strong><small>Soft glow on the line containing the cursor.</small></div>
                            <button class="toggle" data-opt="activeLine" type="button"></button>
                        </div>
                        <div class="settings-row">
                            <div class="label"><strong>Show line numbers</strong><small>Gutter on the left with 1, 2, 3…</small></div>
                            <button class="toggle" data-opt="lineNumbers" type="button"></button>
                        </div>
                        <div class="settings-row">
                            <div class="label"><strong>Grid paper background</strong><small>Math-notebook ruled background (cells match the line height).</small></div>
                            <button class="toggle" data-opt="grid" type="button"></button>
                        </div>
                        <div class="settings-row">
                            <div class="label"><strong>Live syntax highlighting</strong><small>Colors the code as you type. Turn off for large files if typing feels sluggish.</small></div>
                            <button class="toggle" data-opt="liveHighlight" type="button"></button>
                        </div>
                        <div class="settings-row">
                            <div class="label"><strong>Wrap long lines</strong><small>Off: long lines scroll horizontally. On: lines wrap visually.</small></div>
                            <button class="toggle" data-opt="wrap" type="button"></button>
                        </div>
                        <div class="settings-row">
                            <div class="label"><strong>Tab width</strong><small>Number of spaces inserted by the Tab key.</small></div>
                            <input type="number" min="2" max="8" step="1" data-opt="tabWidth">
                        </div>
                    </div>
                `;
                const pane = $body.querySelector('.settings-pane');
                pane.querySelectorAll('.toggle').forEach(btn => {
                    const k = btn.dataset.opt;
                    btn.classList.toggle('on', !!settings[k]);
                    btn.addEventListener('click', async () => {
                        settings[k] = !settings[k];
                        btn.classList.toggle('on', settings[k]);
                        await ctx.storage.set('settings', settings);
                    });
                });
                const num = pane.querySelector('input[type="number"]');
                num.value = settings.tabWidth;
                num.addEventListener('change', async () => {
                    const v = Math.max(2, Math.min(8, parseInt(num.value, 10) || 4));
                    settings.tabWidth = v; num.value = v;
                    await ctx.storage.set('settings', settings);
                });
            }
        }

        // File-backed docs: debounced write-back to disk via FS Access handle.
        // For fallback (webkitdirectory, read-only) there's no handle, so
        // edits stay in memory only until the user manually saves (future
        // virtual-workspace will cover this).
        function scheduleFileSave() {
            const d = active();
            if (!d || !d.handle || typeof d.handle.createWritable !== 'function') return;
            $saveInd.textContent = 'saving…';
            if (fileSaveTimer) clearTimeout(fileSaveTimer);
            fileSaveTimer = setTimeout(async () => {
                try {
                    const w = await d.handle.createWritable();
                    await w.write(d.content || '');
                    await w.close();
                    $saveInd.textContent = 'saved';
                    setTimeout(() => { $saveInd.textContent = ''; }, 1400);
                } catch (e) {
                    console.warn('[grimoire] autosave failed', e);
                    $saveInd.textContent = 'save failed';
                }
            }, 450);
        }

        async function persistActive() {
            if (activeId && typeof activeId === 'string' && activeId.startsWith('file:')) {
                await ctx.storage.set('active', activeId);
            } else {
                await ctx.storage.set('active', null);
            }
        }

        // ── Folder tree ────────────────────────────
        const $folderOpen    = root.querySelector('.folder-open-btn');
        const $folderNewFile = root.querySelector('.folder-new-file');
        const $folderNewDir  = root.querySelector('.folder-new-dir');
        const $folderTree    = root.querySelector('.folder-tree');
        const $menuBtn       = root.querySelector('.menu-btn');
        const $menuPop       = root.querySelector('.menu-pop');

        const _canWrite = 'showDirectoryPicker' in window;
        if (!_canWrite) {
            $folderOpen.title = 'Read-only mode: this browser does not support folder write access.\nOpen in Chrome/Edge/Brave/Opera for create/rename/move/delete.';
        }

        function folderHeaderControls(show) {
            const writable = show && !!_folder.root;
            $folderNewFile.style.display = writable ? '' : 'none';
            $folderNewDir.style.display  = writable ? '' : 'none';
            renderMenu();
        }

        function renderMenu() {
            const items = [];
            if (_folder.tree) {
                items.push({ label: '✕ Close folder', action: 'close-folder' });
            }
            if (!items.length) {
                $menuPop.innerHTML = '<div class="menu-empty">No actions yet.</div>';
            } else {
                $menuPop.innerHTML = items.map(it =>
                    `<button class="menu-item" data-action="${it.action}">${escapeHTML(it.label)}</button>`
                ).join('');
            }
        }
        renderMenu();

        function toggleMenu(force) {
            const show = force ?? ($menuPop.style.display === 'none');
            $menuPop.style.display = show ? '' : 'none';
        }
        $menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
        document.addEventListener('click', (e) => {
            if (!$menuPop.contains(e.target) && e.target !== $menuBtn) toggleMenu(false);
        });
        $menuPop.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            toggleMenu(false);
            const action = btn.dataset.action;
            if (action === 'close-folder') {
                closeFolder();
            }
        });

        function closeFolder() {
            _folder.root = null; _folder.tree = null; _folder.name = '';
            _folder.expanded.clear();
            _fileDocs.clear();
            activeId = null;
            folderHeaderControls(false);
            $folderOpen.textContent = '📁 Open folder';
            $folderTree.innerHTML = '';
            renderBody();
            persistActive();
        }

        // Skipped entries that would clutter the tree for no real gain.
        const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.DS_Store', 'dist', 'build', '.next', '.cache', '.idea', '.vscode']);
        const SKIP_FILES_RE = /\.(lock|log|map|pyc|class|so|dll|exe|bin|zip|gz|tar|jar|war|pdf|png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|mp[34]|wav|mov|mp4|webm)$/i;

        async function buildTreeFromHandle(dirHandle, path = '') {
            const node = { name: dirHandle.name, path, isDir: true, handle: dirHandle, children: [] };
            try {
                const q = await dirHandle.queryPermission?.({ mode: 'read' });
                if (q !== 'granted' && dirHandle.requestPermission) {
                    const r = await dirHandle.requestPermission({ mode: 'read' });
                    if (r !== 'granted') throw new Error('read permission denied');
                }
            } catch (e) { /* entries() will throw if truly blocked */ }
            try {
                for await (const [name, h] of dirHandle.entries()) {
                    if (h.kind === 'directory') {
                        if (SKIP_DIRS.has(name)) continue;
                        const childPath = path ? path + '/' + name : name;
                        try { node.children.push(await buildTreeFromHandle(h, childPath)); }
                        catch (e) { console.warn('[grimoire] skipped dir', childPath, e); }
                    } else {
                        if (SKIP_FILES_RE.test(name)) continue;
                        const childPath = path ? path + '/' + name : name;
                        node.children.push({ name, path: childPath, isDir: false, handle: h });
                    }
                }
            } catch (e) {
                console.error('[grimoire] entries() failed for', path || '(root)', e);
                throw e;
            }
            node.children.sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
            return node;
        }

        function buildTreeFromFiles(files, rootName = 'folder') {
            const root = { name: rootName, path: '', isDir: true, children: [] };
            const byPath = new Map([['', root]]);
            for (const f of files) {
                const rel = f.webkitRelativePath || f.name;
                if (SKIP_FILES_RE.test(f.name)) continue;
                const parts = rel.split('/');
                if (!root.name || root.name === 'folder') root.name = parts[0];
                let cur = root;
                let curPath = '';
                for (let i = 1; i < parts.length; i++) {
                    const seg = parts[i];
                    if (i === parts.length - 1) {
                        cur.children.push({ name: seg, path: curPath ? curPath + '/' + seg : seg, isDir: false, file: f });
                    } else {
                        if (SKIP_DIRS.has(seg)) { cur = null; break; }
                        curPath = curPath ? curPath + '/' + seg : seg;
                        let child = byPath.get(curPath);
                        if (!child) {
                            child = { name: seg, path: curPath, isDir: true, children: [] };
                            cur.children.push(child);
                            byPath.set(curPath, child);
                        }
                        cur = child;
                    }
                }
            }
            function sortRec(n) {
                if (!n.children) return;
                n.children.sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
                n.children.forEach(sortRec);
            }
            sortRec(root);
            return root;
        }

        function renderFolderTree() {
            if (!_folder.tree) { $folderTree.innerHTML = ''; return; }
            const html = renderNode(_folder.tree, 0, true);
            $folderTree.innerHTML = html;
            wireTreeInteractions();
        }
        function renderNode(node, depth, isRoot) {
            const canWrite = !!_folder.root;
            if (node.isDir) {
                const collapsed = !isRoot && !_folder.expanded.has(node.path);
                const kids = (node.children || []).map(c => renderNode(c, depth + 1, false)).join('');
                const actions = canWrite ? `
                    <button class="ftree-act" data-action="new-file" data-path="${escapeHTML(node.path)}" title="New file here">📄＋</button>
                    <button class="ftree-act" data-action="new-dir"  data-path="${escapeHTML(node.path)}" title="New folder here">📁＋</button>
                ` : '';
                return `
                    <div class="ftree-dir ${collapsed ? 'is-collapsed' : ''}" data-path="${escapeHTML(node.path)}">
                        <div class="ftree-item ftree-drop" data-kind="dir" data-path="${escapeHTML(node.path)}">
                            <span class="ftree-chev">▾</span>
                            <span class="ftree-icon">${isRoot ? '📂' : '📁'}</span>
                            <span class="ftree-name">${escapeHTML(node.name)}</span>
                            ${actions}
                        </div>
                        <div class="ftree-children">${kids || '<div class="ftree-empty">empty</div>'}</div>
                    </div>
                `;
            } else {
                const isActive = activeId === 'file:' + node.path;
                return `
                    <div class="ftree-file" data-path="${escapeHTML(node.path)}">
                        <div class="ftree-item ${isActive ? 'ftree-active' : ''}" data-kind="file" data-path="${escapeHTML(node.path)}" ${canWrite ? 'draggable="true"' : ''}>
                            <span class="ftree-chev"></span>
                            <span class="ftree-icon">📄</span>
                            <span class="ftree-name">${escapeHTML(node.name)}</span>
                        </div>
                    </div>
                `;
            }
        }
        function wireTreeInteractions() {
            $folderTree.querySelectorAll('.ftree-item').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const act = e.target.closest('.ftree-act');
                    if (act) {
                        e.stopPropagation();
                        const action = act.dataset.action;
                        const path = act.dataset.path;
                        const dir = findDirNode(path);
                        if (!dir) return;
                        if (action === 'new-file') await promptAndCreateFile(dir);
                        else if (action === 'new-dir') await promptAndCreateDir(dir);
                        return;
                    }
                    const path = el.dataset.path;
                    if (el.dataset.kind === 'dir') {
                        const dir = el.closest('.ftree-dir');
                        if (dir && !dir.classList.contains('is-root')) {
                            const wasCollapsed = dir.classList.toggle('is-collapsed');
                            if (wasCollapsed) _folder.expanded.delete(path);
                            else _folder.expanded.add(path);
                        }
                    } else {
                        await openFileFromTree(path);
                    }
                });
                if (el.getAttribute('draggable') === 'true') {
                    el.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/grimoire-path', el.dataset.path);
                        e.dataTransfer.effectAllowed = 'move';
                        el.classList.add('ftree-dragging');
                    });
                    el.addEventListener('dragend', () => el.classList.remove('ftree-dragging'));
                }
                if (el.classList.contains('ftree-drop')) {
                    el.addEventListener('dragover', (e) => {
                        if (!e.dataTransfer.types.includes('text/grimoire-path')) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        el.classList.add('ftree-dragover');
                    });
                    el.addEventListener('dragleave', () => el.classList.remove('ftree-dragover'));
                    el.addEventListener('drop', async (e) => {
                        el.classList.remove('ftree-dragover');
                        const srcPath = e.dataTransfer.getData('text/grimoire-path');
                        if (!srcPath) return;
                        e.preventDefault();
                        await moveFile(srcPath, el.dataset.path);
                    });
                }
            });
        }

        function findDirNode(path, node = _folder.tree) {
            if (!node) return null;
            if (node.path === path && node.isDir) return node;
            if (node.children) {
                for (const c of node.children) {
                    const r = findDirNode(path, c);
                    if (r) return r;
                }
            }
            return null;
        }

        async function refreshTree() {
            if (!_folder.root) return;
            _folder.tree = await buildTreeFromHandle(_folder.root);
            renderFolderTree();
        }

        async function promptAndCreateFile(dirNode) {
            const name = window.prompt('New file name (e.g. notes.md)');
            if (!name || !name.trim()) return;
            await createFileIn(dirNode, name.trim());
        }
        async function promptAndCreateDir(dirNode) {
            const name = window.prompt('New folder name');
            if (!name || !name.trim()) return;
            await createDirIn(dirNode, name.trim());
        }

        async function createFileIn(dirNode, name) {
            try {
                const h = await dirNode.handle.getFileHandle(name, { create: true });
                const w = await h.createWritable();
                await w.write('');
                await w.close();
                _folder.expanded.add(dirNode.path);
                await refreshTree();
                const newPath = dirNode.path ? dirNode.path + '/' + name : name;
                await openFileFromTree(newPath);
            } catch (e) {
                console.warn('[grimoire] createFileIn failed', e);
                alert('Could not create file: ' + (e.message || e));
            }
        }
        async function createDirIn(parentNode, name) {
            try {
                await parentNode.handle.getDirectoryHandle(name, { create: true });
                _folder.expanded.add(parentNode.path);
                const newPath = parentNode.path ? parentNode.path + '/' + name : name;
                _folder.expanded.add(newPath);
                await refreshTree();
            } catch (e) {
                console.warn('[grimoire] createDirIn failed', e);
                alert('Could not create folder: ' + (e.message || e));
            }
        }

        async function moveFile(srcPath, destDirPath) {
            if (srcPath === destDirPath) return;
            const src = findNode(srcPath);
            const destDir = findDirNode(destDirPath);
            if (!src || !destDir) return;
            const srcParentPath = srcPath.split('/').slice(0, -1).join('/');
            if (srcParentPath === destDirPath) return;
            if (src.handle && typeof src.handle.move === 'function') {
                try {
                    await src.handle.move(destDir.handle, src.name);
                    await refreshTree();
                    return;
                } catch (e) { console.warn('[grimoire] native move failed, falling back', e); }
            }
            try {
                const file = await src.handle.getFile();
                const newH = await destDir.handle.getFileHandle(src.name, { create: true });
                const w = await newH.createWritable();
                await w.write(file);
                await w.close();
                const srcParent = findDirNode(srcParentPath);
                if (srcParent) await srcParent.handle.removeEntry(src.name);
                await refreshTree();
            } catch (e) {
                console.warn('[grimoire] move fallback failed', e);
                alert('Could not move file: ' + (e.message || e));
            }
        }
        function findNode(path, node = _folder.tree) {
            if (!node) return null;
            if (node.path === path && !node.isDir) return node;
            if (node.children) {
                for (const c of node.children) {
                    const r = findNode(path, c);
                    if (r) return r;
                }
            }
            return null;
        }
        async function openFileFromTree(path) {
            const node = findNode(path);
            if (!node) return;
            let file = node.file || null;
            if (node.handle) {
                try { file = await node.handle.getFile(); }
                catch (e) { console.warn('[grimoire] getFile failed', e); return; }
            }
            if (!file) return;
            const content = await file.text();
            const title = node.name.replace(/\.[^.]+$/, '');
            const lang = langFromFilename(node.name);
            _fileDocs.set(path, {
                id: 'file:' + path,
                title: node.name,
                lang,
                content,
                updatedAt: Date.now(),
                handle: node.handle || null,
                file,
                displayTitle: title,
            });
            activeId = 'file:' + path;
            view = 'edit';
            $tabs.forEach(x => x.classList.toggle('active', x.dataset.view === 'edit'));
            renderFolderTree();
            await renderBody();
            await persistActive();
        }

        function showTreeMessage(msg, isErr) {
            $folderTree.innerHTML = `<div class="ftree-empty" style="${isErr ? 'color:#fb7185;' : ''}">${escapeHTML(msg)}</div>`;
        }

        async function tryDirectoryPicker() {
            try {
                const handle = await window.showDirectoryPicker();
                _folder.root = handle;
                _folder.name = handle.name;
                _folder.fallback = false;
                _folder.expanded.clear();
                showTreeMessage('Reading folder…');
                _folder.tree = await buildTreeFromHandle(handle);
                folderHeaderControls(true);
                $folderOpen.textContent = '📂 ' + handle.name;
                renderFolderTree();
                renderBody();
                return true;
            } catch (e) {
                if (e?.name === 'AbortError') return true;
                console.error('[grimoire] picker blocked', e);
                showTreeMessage(`Folder read blocked (${e?.name || 'error'}: ${e?.message || 'unknown'}) — falling back`, true);
                return false;
            }
        }

        function openWebkitDirInput() {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.multiple = true;
            input.addEventListener('change', () => {
                const files = Array.from(input.files || []);
                if (!files.length) { showTreeMessage('No files in folder.', false); return; }
                _folder.root = null;
                _folder.name = files[0].webkitRelativePath.split('/')[0] || 'folder';
                _folder.fallback = true;
                _folder.expanded.clear();
                _folder.tree = buildTreeFromFiles(files, _folder.name);
                folderHeaderControls(true);
                $folderOpen.textContent = '📂 ' + _folder.name + ' (read-only)';
                $folderOpen.title = 'This browser does not support folder write access. Open in Chrome/Edge for create/rename/move/delete.';
                renderFolderTree();
                renderBody();
            });
            input.click();
        }

        $folderOpen.addEventListener('click', async () => {
            if ('showDirectoryPicker' in window) {
                const ok = await tryDirectoryPicker();
                if (ok) return;
            }
            openWebkitDirInput();
        });

        $folderNewFile.addEventListener('click', () => {
            if (_folder.tree) promptAndCreateFile(_folder.tree);
        });
        $folderNewDir.addEventListener('click', () => {
            if (_folder.tree) promptAndCreateDir(_folder.tree);
        });

        $title.addEventListener('input', () => {
            const d = active(); if (!d) return;
            d.title = $title.value; d.updatedAt = Date.now();
        });

        $lang.addEventListener('change', () => {
            const d = active(); if (!d) return;
            d.lang = $lang.value; d.updatedAt = Date.now();
            if (view === 'preview') renderBody();
            else if (view === 'edit') updateHighlight();
        });

        $tabs.forEach(t => t.addEventListener('click', async () => {
            $tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            view = t.dataset.view;
            await renderBody();
        }));

        // No folder is restored on boot — FS handles can't be persisted. Any
        // leftover legacy 'docs' key in storage is intentionally ignored (kept
        // for user rollback safety, not deleted).
        activeId = null;
        await persistActive();
        await renderBody();
    }
};
