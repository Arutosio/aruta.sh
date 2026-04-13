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

export default {
    async mount(root, ctx) {
        loadCSS(HLJS_THEME);
        const hljsReady = loadScript(HLJS_SCRIPT).catch(() => null);

        root.innerHTML = `
            <div class="wrap">
                <aside class="sidebar">
                    <div class="sidebar-head">
                        <button class="new-btn">＋ New</button>
                    </div>
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
        let view = 'edit';
        let saveTimer = null;

        function active() { return docs.find(d => d.id === activeId); }

        function renderSidebar() {
            $doclist.innerHTML = docs.map(d =>
                `<li data-id="${d.id}" class="${d.id === activeId ? 'active' : ''}">
                    <span><span class="dot">●</span> ${escapeHTML(d.title || 'Untitled')}</span>
                    <button class="del" data-del="${d.id}" title="Delete">✕</button>
                </li>`
            ).join('');
        }

        function escapeHTML(s) {
            return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        }

        async function renderBody() {
            const d = active();
            if (!d) {
                $body.innerHTML = '<div class="empty">Select or create a scroll…</div>';
                $title.value = ''; $title.disabled = true;
                $lang.disabled = true;
                return;
            }
            $title.value = d.title || '';
            $title.disabled = false;
            $lang.value = d.lang || 'plaintext';
            $lang.disabled = false;
            if (view === 'edit') {
                const content = d.content || '';
                $body.innerHTML = '<textarea spellcheck="false"></textarea>';
                const ta = $body.querySelector('textarea');
                ta.value = content;
                ta.addEventListener('input', () => {
                    d.content = ta.value;
                    d.updatedAt = Date.now();
                    scheduleSave();
                });
                ta.addEventListener('keydown', (e) => {
                    // Tab inserts 4 spaces instead of tabbing focus
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = ta.selectionStart, end = ta.selectionEnd;
                        ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(end);
                        ta.selectionStart = ta.selectionEnd = start + 4;
                        d.content = ta.value;
                        scheduleSave();
                    }
                });
                ta.focus();
            } else {
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

        async function persistActive() {
            await ctx.storage.set('active', activeId);
        }

        $newBtn.addEventListener('click', async () => {
            const d = {
                id: uuid(),
                title: 'Untitled',
                lang: 'plaintext',
                content: '',
                updatedAt: Date.now(),
            };
            docs.unshift(d);
            activeId = d.id;
            view = 'edit';
            $tabs.forEach(t => t.classList.toggle('active', t.dataset.view === 'edit'));
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

        if (docs.length === 0) {
            // Seed with a welcome doc
            docs.push({
                id: uuid(),
                title: 'Welcome',
                lang: 'markdown',
                content: '# Grimoire\n\nWrite your incantations here. Switch language for syntax highlighting.\n\n```js\nconsole.log("hello, wanderer");\n```',
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
