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

const LANG_TO_EXT = {
    javascript: 'js', typescript: 'ts', python: 'py', csharp: 'cs',
    cpp: 'cpp', rust: 'rs', go: 'go', java: 'java', kotlin: 'kt',
    swift: 'swift', php: 'php', ruby: 'rb', sql: 'sql', bash: 'sh',
    powershell: 'ps1', html: 'html', css: 'css', json: 'json',
    yaml: 'yaml', xml: 'xml', markdown: 'md', plaintext: 'txt',
};

function langFromFilename(name) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
    if (!m) return 'plaintext';
    return EXT_TO_LANG[m[1].toLowerCase()] || 'plaintext';
}

function extForLang(lang) { return LANG_TO_EXT[lang] || 'txt'; }

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

function uuid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

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
                        <button class="new-btn" title="New scroll">＋</button>
                        <button class="import-btn" title="Load a file from disk">⬆</button>
                        <button class="export-btn" title="Save the current scroll to disk">⬇</button>
                    </div>
                    <ul class="doclist"></ul>
                    <div class="folder-section">
                        <div class="folder-head">
                            <button class="folder-open-btn" title="Open a folder to browse/edit its files">📁 Open folder</button>
                            <button class="folder-close" style="display:none" title="Close folder">✕</button>
                        </div>
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
                    <div class="body"><div class="empty">Select or create a scroll…</div></div>
                </section>
            </div>
        `;

        const $doclist = root.querySelector('.doclist');
        const $newBtn  = root.querySelector('.new-btn');
        const $title   = root.querySelector('.title');
        const $lang    = root.querySelector('.lang');
        const $tabs    = root.querySelectorAll('.view-tabs button');
        const $body    = root.querySelector('.body');
        const $saveInd = root.querySelector('.save-indicator');

        let docs = (await ctx.storage.get('docs')) || [];
        let activeId = (await ctx.storage.get('active')) || null;
        let settings = Object.assign({}, DEFAULT_SETTINGS, (await ctx.storage.get('settings')) || {});
        let view = 'edit';
        let saveTimer = null;

        // Folder state — session-only (File System Access handles can't be
        // persisted; re-opening the folder is a user gesture anyway).
        // _folder.root is a FileSystemDirectoryHandle when the modern API is
        // available; otherwise _folder.fallbackFiles holds a File[] coming
        // from <input webkitdirectory>.
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
            return docs.find(d => d.id === activeId);
        }

        function renderSidebar() {
            $doclist.innerHTML = docs.map(d =>
                `<li data-id="${d.id}" class="${d.id === activeId ? 'active' : ''}">
                    <span><span class="dot">●</span> ${escapeHTML(d.title || 'Untitled')}</span>
                    <button class="del" data-del="${d.id}" title="Delete">✕</button>
                </li>`
            ).join('');
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
            // When wrap is on the textarea reserves a scrollbar gutter; the
            // hl-layer has to mirror that padding so both wrap at the same x.
            // Measure after the class toggle so offsetWidth reflects the
            // overflow-y: scroll rule we just enabled.
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

        // File-size bail: above this byte count, skip the hljs highlight
        // pass — just render plain text through the hl-layer so typing
        // stays snappy. (Setting toggle still wins if user forces off.)
        const HL_MAX_BYTES = 200 * 1024;

        function updateHighlight() {
            if (!$hlCode || !$ta) return;
            if (!settings.liveHighlight) return;
            const d = active();
            const lang = d?.lang || 'plaintext';
            // Trailing newline ensures the rendered layer extends one row
            // past the caret so the last empty line still paints.
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
            // The <pre class=hl-layer> is a fixed-size viewport; its <code>
            // child holds the full text. Translate the CODE so the visible
            // slice matches the textarea's scroll position. Translating the
            // pre itself would just shift the clip region — content below
            // the first viewport-tall slice would never be renderable.
            $hlCode.style.transform = `translate(${-$ta.scrollLeft}px, ${-$ta.scrollTop}px)`;
            // Gutter: same story — overflow:hidden means scrollTop is a
            // no-op, so translate the text node inside instead.
            $gutter.style.transform = `translateY(${-$ta.scrollTop}px)`;
        }

        // Hidden mirror used to measure visual row count per logical line
        // when wrap is on. Cached across calls; its width is synced to .paper.
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
                // 1:1 mapping — each logical line takes exactly one row.
                _lineRows = null;
                let html = '';
                for (let i = 0; i < lines.length; i++) html += (i + 1) + '\n';
                $gutter.textContent = html;
            } else {
                // Measure each line's visual row count so the gutter can
                // pad with empty rows for wrapped continuations.
                // Wrap happens inside the textarea's *content area*
                // (clientWidth minus its own padding), NOT the paper's width.
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

        // Cache of visual-row counts per logical line, populated by
        // updateGutter when wrap is on. Lets updateActiveLine compute the
        // wrapped caret position without re-measuring each line.
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
                // Sum visual rows of lines before the caret's line…
                let sum = 0;
                for (let i = 0; i < lineIdx && i < _lineRows.length; i++) sum += _lineRows[i];
                // …plus the wrapped row offset within the current line,
                // measured on-demand (small: one line at a time).
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

        // Content-change events (input) reshape the gutter (line count,
        // wrap boundaries can change). Caret/scroll events only move the
        // highlight + the scroll-synced transforms, which is cheap.
        function onContentChange() { updateGutter(); updateActiveLine(); syncHLScroll(); }
        function onCaretChange()   { updateActiveLine(); syncHLScroll(); }

        // ── Body rendering ──────────────────────────
        async function renderBody() {
            const d = active();
            $title.disabled = !d || view === 'settings';
            $lang.disabled  = !d || view === 'settings';
            if (!d) {
                $body.innerHTML = '<div class="empty">Select or create a scroll…</div>';
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
                // Highlight initially; the layer needs highlight.js to be
                // loaded, so wait on hljsReady for the very first paint.
                hljsReady.then(updateHighlight);

                $ta.addEventListener('input', () => {
                    d.content = $ta.value;
                    d.updatedAt = Date.now();
                    onContentChange();
                    scheduleHighlight();
                    scheduleSave();
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
                        scheduleSave();
                    }
                });
                $ta.focus();

                // Wrap-aware gutter needs to recompute when the viewport
                // resizes, since wrap boundaries change.
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
                        <p>These apply to every scroll; changes save automatically.</p>
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
                            <div class="label"><strong>Live syntax highlighting</strong><small>Colors the code as you type based on the selected language. Turn off for large files if typing feels sluggish.</small></div>
                            <button class="toggle" data-opt="liveHighlight" type="button"></button>
                        </div>
                        <div class="settings-row">
                            <div class="label"><strong>Wrap long lines</strong><small>Off: long lines scroll horizontally — line numbers stay aligned. On: lines wrap visually, but a wrapped line still carries a single number (gutter may look off).</small></div>
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

        function scheduleSave() {
            $saveInd.textContent = 'saving…';
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                await ctx.storage.set('docs', docs);
                $saveInd.textContent = 'saved';
                setTimeout(() => { $saveInd.textContent = ''; }, 1400);
            }, 450);
        }
        async function persistActive() { await ctx.storage.set('active', activeId); }

        // ── Wire sidebar / toolbar ─────────────────
        $newBtn.addEventListener('click', async () => {
            const d = { id: uuid(), title: 'Untitled', lang: 'plaintext', content: '', updatedAt: Date.now() };
            docs.unshift(d);
            activeId = d.id;
            view = 'edit';
            $tabs.forEach(x => x.classList.toggle('active', x.dataset.view === 'edit'));
            renderSidebar();
            await renderBody();
            scheduleSave();
            await persistActive();
        });

        // Import: read a text file from disk into a new scroll.
        root.querySelector('.import-btn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.md,.markdown,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.cs,.cpp,.cc,.cxx,.h,.hpp,.c,.rs,.go,.java,.kt,.kts,.swift,.php,.phtml,.rb,.sql,.sh,.bash,.zsh,.ps1,.psm1,.html,.htm,.css,.scss,.sass,.json,.yaml,.yml,.xml,.svg,.log,text/*';
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                    alert('File too large (>5 MB). Grimoire is meant for scrolls, not tomes.');
                    return;
                }
                const text = await file.text();
                const title = file.name.replace(/\.[^.]+$/, '');
                const lang = langFromFilename(file.name);
                const d = {
                    id: uuid(),
                    title: title || 'Imported',
                    lang,
                    content: text,
                    updatedAt: Date.now(),
                };
                docs.unshift(d);
                activeId = d.id;
                view = 'edit';
                $tabs.forEach(x => x.classList.toggle('active', x.dataset.view === 'edit'));
                renderSidebar();
                await renderBody();
                scheduleSave();
                await persistActive();
            });
            input.click();
        });

        // Export: for file-backed docs (opened via folder) this writes back
        // to disk via the File System Access handle. For in-memory scrolls
        // (and fallback <input webkitdirectory> files) it triggers a download.
        root.querySelector('.export-btn').addEventListener('click', async () => {
            const d = active();
            if (!d) return;
            if (d.handle && typeof d.handle.createWritable === 'function') {
                try {
                    const w = await d.handle.createWritable();
                    await w.write(d.content || '');
                    await w.close();
                    $saveInd.textContent = 'saved to file';
                    setTimeout(() => { $saveInd.textContent = ''; }, 1400);
                    return;
                } catch (e) {
                    console.warn('[grimoire] write-back failed, falling back to download', e);
                }
            }
            const ext = extForLang(d.lang || 'plaintext');
            const base = (d.displayTitle || d.title || 'scroll').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'scroll';
            const name = /\.[^.]+$/.test(base) ? base : base + '.' + ext;
            const blob = new Blob([d.content || ''], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });

        // ── Folder tree ────────────────────────────
        const $folderOpen  = root.querySelector('.folder-open-btn');
        const $folderClose = root.querySelector('.folder-close');
        const $folderTree  = root.querySelector('.folder-tree');

        // Skipped entries that would clutter the tree for no real gain.
        const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.DS_Store', 'dist', 'build', '.next', '.cache', '.idea', '.vscode']);
        const SKIP_FILES_RE = /\.(lock|log|map|pyc|class|so|dll|exe|bin|zip|gz|tar|jar|war|pdf|png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|mp[34]|wav|mov|mp4|webm)$/i;

        async function buildTreeFromHandle(dirHandle, path = '') {
            const node = { name: dirHandle.name, path, isDir: true, handle: dirHandle, children: [] };
            // Some browsers (or sandboxed iframes) return a handle that
            // can be picked but whose entries() is gated by an explicit
            // permission request. Ask once, up-front.
            try {
                const q = await dirHandle.queryPermission?.({ mode: 'read' });
                if (q !== 'granted' && dirHandle.requestPermission) {
                    const r = await dirHandle.requestPermission({ mode: 'read' });
                    if (r !== 'granted') throw new Error('read permission denied');
                }
            } catch (e) {
                // permission flow not available — entries() below will throw if blocked
            }
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
                // First segment is the folder name
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
            // Root is always expanded; sub-dirs default collapsed unless user opened.
            const html = renderNode(_folder.tree, 0, true);
            $folderTree.innerHTML = html;
            wireTreeInteractions();
        }
        function renderNode(node, depth, isRoot) {
            if (node.isDir) {
                const collapsed = !isRoot && !_folder.expanded.has(node.path);
                const kids = (node.children || []).map(c => renderNode(c, depth + 1, false)).join('');
                return `
                    <div class="ftree-dir ${collapsed ? 'is-collapsed' : ''}" data-path="${window.escapeHTML(node.path)}">
                        <div class="ftree-item" data-kind="dir" data-path="${window.escapeHTML(node.path)}">
                            <span class="ftree-chev">▾</span>
                            <span class="ftree-icon">${isRoot ? '📂' : '📁'}</span>
                            <span class="ftree-name">${window.escapeHTML(node.name)}</span>
                        </div>
                        <div class="ftree-children">${kids || '<div class="ftree-empty">empty</div>'}</div>
                    </div>
                `;
            } else {
                const isActive = activeId === 'file:' + node.path;
                return `
                    <div class="ftree-file" data-path="${window.escapeHTML(node.path)}">
                        <div class="ftree-item ${isActive ? 'ftree-active' : ''}" data-kind="file" data-path="${window.escapeHTML(node.path)}">
                            <span class="ftree-chev"></span>
                            <span class="ftree-icon">📄</span>
                            <span class="ftree-name">${window.escapeHTML(node.name)}</span>
                        </div>
                    </div>
                `;
            }
        }
        function wireTreeInteractions() {
            $folderTree.querySelectorAll('.ftree-item').forEach(el => {
                el.addEventListener('click', async () => {
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
            });
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
            let content = '';
            let file = node.file || null;
            if (node.handle) {
                try { file = await node.handle.getFile(); }
                catch (e) { console.warn('[grimoire] getFile failed', e); return; }
            }
            if (!file) return;
            content = await file.text();
            const title = node.name.replace(/\.[^.]+$/, '');
            const lang = langFromFilename(node.name);
            _fileDocs.set(path, {
                id: 'file:' + path,
                title: node.name,
                lang,
                content,
                updatedAt: Date.now(),
                // Keep the write handle around when available so Export saves
                // back to disk instead of forcing a download.
                handle: node.handle || null,
                file,
                displayTitle: title,
            });
            activeId = 'file:' + path;
            view = 'edit';
            $tabs.forEach(x => x.classList.toggle('active', x.dataset.view === 'edit'));
            renderSidebar();
            renderFolderTree();
            await renderBody();
            await persistActive();
        }

        function showTreeMessage(msg, isErr) {
            $folderTree.innerHTML = `<div class="ftree-empty" style="${isErr ? 'color:#fb7185;' : ''}">${window.escapeHTML(msg)}</div>`;
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
                $folderClose.style.display = '';
                $folderOpen.textContent = '📂 ' + handle.name;
                renderFolderTree();
                return true;
            } catch (e) {
                if (e?.name === 'AbortError') return true; // user cancelled — stop here
                console.warn('[grimoire] showDirectoryPicker failed, falling back', e);
                showTreeMessage('Folder read blocked — try again (browser permission?)', true);
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
                $folderClose.style.display = '';
                $folderOpen.textContent = '📂 ' + _folder.name;
                renderFolderTree();
            });
            input.click();
        }

        $folderOpen.addEventListener('click', async () => {
            // File System Access API gives us read+write handles — preferred
            // path. If it's gated by the sandboxed-iframe policy, we fall back
            // to <input webkitdirectory>. Fallback has to be kicked off in a
            // fresh user gesture (a click) so we don't lose activation: route
            // through a retry button if async path fails.
            if ('showDirectoryPicker' in window) {
                const ok = await tryDirectoryPicker();
                if (ok) return;
            }
            openWebkitDirInput();
        });

        $folderClose.addEventListener('click', () => {
            _folder.root = null; _folder.tree = null; _folder.name = '';
            _folder.expanded.clear();
            $folderClose.style.display = 'none';
            $folderOpen.textContent = '📁 Open folder';
            $folderTree.innerHTML = '';
        });

        $doclist.addEventListener('click', async (e) => {
            const del = e.target.closest('[data-del]');
            if (del) {
                e.stopPropagation();
                const id = del.dataset.del;
                docs = docs.filter(d => d.id !== id);
                if (activeId === id) activeId = docs[0]?.id || null;
                await ctx.storage.set('docs', docs);
                await persistActive();
                renderSidebar();
                await renderBody();
                return;
            }
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            activeId = li.dataset.id;
            renderSidebar();
            await renderBody();
            await persistActive();
        });

        $title.addEventListener('input', () => {
            const d = active(); if (!d) return;
            d.title = $title.value; d.updatedAt = Date.now();
            renderSidebar();
            scheduleSave();
        });

        $lang.addEventListener('change', () => {
            const d = active(); if (!d) return;
            d.lang = $lang.value; d.updatedAt = Date.now();
            scheduleSave();
            if (view === 'preview') renderBody();
            else if (view === 'edit') updateHighlight();
        });

        $tabs.forEach(t => t.addEventListener('click', async () => {
            $tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            view = t.dataset.view;
            await renderBody();
        }));

        // Seed a welcome doc the first time Grimoire is opened.
        if (docs.length === 0) {
            docs.push({
                id: uuid(),
                title: 'Welcome',
                lang: 'markdown',
                content: '# Grimoire\n\nWrite your incantations here. Switch language for syntax highlighting.\n\nTap the ⚙ icon in the toolbar to toggle line numbers, the active-line glow, or a graph-paper background.\n\n```js\nconsole.log("hello, wanderer");\n```',
                updatedAt: Date.now(),
            });
            activeId = docs[0].id;
            await ctx.storage.set('docs', docs);
            await persistActive();
        } else if (!active()) {
            activeId = docs[0].id;
            await persistActive();
        }

        renderSidebar();
        await renderBody();
    }
};
