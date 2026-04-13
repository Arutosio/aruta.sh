const HLJS_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
const HLJS_THEME  = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';

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
    activeLine: true,
    lineNumbers: true,
    grid: false,
    tabWidth: 4,
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
                    <div class="sidebar-head"><button class="new-btn">＋ New</button></div>
                    <ul class="doclist"></ul>
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

        // Hold references to the current edit-view nodes (re-set by renderBody)
        let $editor = null, $paper = null, $ta = null, $gutter = null, $activeLine = null;

        function active() { return docs.find(d => d.id === activeId); }

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
            $paper.classList.toggle('opt-grid',        settings.grid);
            $ta.style.tabSize = settings.tabWidth;
        }

        function updateGutter() {
            if (!$gutter || !$ta) return;
            const lines = $ta.value.split('\n').length;
            let html = '';
            for (let i = 1; i <= lines; i++) html += i + '\n';
            $gutter.textContent = html;
            $gutter.scrollTop = $ta.scrollTop;
        }

        function updateActiveLine() {
            if (!$activeLine || !$ta) return;
            const before = $ta.value.slice(0, $ta.selectionStart);
            const lineIdx = (before.match(/\n/g) || []).length;
            const rootStyles = getComputedStyle(document.documentElement);
            const lineH = parseFloat(rootStyles.getPropertyValue('--ed-line')) || 22;
            const padY  = parseFloat(rootStyles.getPropertyValue('--ed-pad-y')) || 12;
            $activeLine.style.transform = `translateY(${padY + lineIdx * lineH - $ta.scrollTop}px)`;
        }

        function onEditEvent() { updateGutter(); updateActiveLine(); }

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
                        <div class="gutter"></div>
                        <div class="paper">
                            <div class="active-line"></div>
                            <textarea spellcheck="false"></textarea>
                        </div>
                    </div>
                `;
                $editor     = $body.querySelector('.editor');
                $paper      = $body.querySelector('.paper');
                $ta         = $body.querySelector('textarea');
                $gutter     = $body.querySelector('.gutter');
                $activeLine = $body.querySelector('.active-line');
                $ta.value = d.content || '';
                applyEditorSettings();
                updateGutter();
                updateActiveLine();

                $ta.addEventListener('input', () => {
                    d.content = $ta.value;
                    d.updatedAt = Date.now();
                    onEditEvent();
                    scheduleSave();
                });
                $ta.addEventListener('keyup',    onEditEvent);
                $ta.addEventListener('click',    onEditEvent);
                $ta.addEventListener('scroll',   onEditEvent);
                $ta.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = $ta.selectionStart, end = $ta.selectionEnd;
                        const ins = ' '.repeat(settings.tabWidth);
                        $ta.value = $ta.value.slice(0, start) + ins + $ta.value.slice(end);
                        $ta.selectionStart = $ta.selectionEnd = start + ins.length;
                        d.content = $ta.value;
                        onEditEvent();
                        scheduleSave();
                    }
                });
                $ta.focus();
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
