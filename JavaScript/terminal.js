/* ╔══════════════════════════════════════════════════════════╗
 * ║  TERMINAL — Built-in shell with command parser + history ║
 * ╚══════════════════════════════════════════════════════════╝ */

const HISTORY_KEY = 'aruta_term_history';
const HISTORY_MAX = 100;

let _output, _input, _prompt;
let _history = [];
let _historyIdx = -1;
let _initialized = false;
let _cwd = ''; // session-local working directory, relative to linked profile folder root

// ── Filesystem helpers ────────────────────────────────────
// Normalize target path against cwd. Throws on '..' above home.
// Returns path without leading slash (empty string = home).
function resolvePath(target, cwd) {
    target = String(target || '');
    const absolute = target.startsWith('/') || target.startsWith('~');
    if (target.startsWith('~')) target = target.slice(1);
    if (target.startsWith('/')) target = target.slice(1);
    const stack = absolute ? [] : (cwd ? cwd.split('/').filter(Boolean) : []);
    const segs = target.split('/');
    for (const s of segs) {
        if (!s || s === '.') continue;
        if (s === '..') {
            if (stack.length === 0) throw new Error('cannot go above home');
            stack.pop();
        } else {
            stack.push(s);
        }
    }
    return stack.join('/');
}

// Walk from root handle along slash-separated path, returning the final dir handle.
async function walkToDir(handle, path) {
    if (!path) return handle;
    let dir = handle;
    for (const seg of path.split('/').filter(Boolean)) {
        dir = await dir.getDirectoryHandle(seg, { create: false });
    }
    return dir;
}

// Return the linked handle or print a friendly error + return null.
async function requireLinked() {
    const fn = window.profile?.getLinkedHandle;
    if (typeof fn !== 'function') {
        termPrint('no profile folder linked. Open Settings → Profile to pick one.', 'term-error');
        return null;
    }
    const h = await fn();
    if (!h) {
        termPrint('no profile folder linked. Open Settings → Profile to pick one.', 'term-error');
        return null;
    }
    return h;
}

function _updatePromptUI() {
    if (_prompt) _prompt.textContent = _promptText();
}

function _loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        _history = raw ? JSON.parse(raw) : [];
    } catch { _history = []; }
}

function _saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(_history.slice(-HISTORY_MAX)));
    } catch {}
}

function _scroll() {
    if (_output) _output.scrollTop = _output.scrollHeight;
}

function termPrint(text, cls = '') {
    if (!_output) return;
    const line = document.createElement('div');
    line.className = 'term-line ' + cls;
    line.textContent = text;
    _output.appendChild(line);
    _scroll();
}

function termPrintHTML(html) {
    if (!_output) return;
    const line = document.createElement('div');
    line.className = 'term-line';
    line.innerHTML = html;
    _output.appendChild(line);
    _scroll();
}

function termClear() {
    if (_output) _output.innerHTML = '';
}

function _parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    // Simple split with quoted-string support
    const tokens = [];
    let cur = '';
    let quote = null;
    for (let i = 0; i < trimmed.length; i++) {
        const c = trimmed[i];
        if (quote) {
            if (c === quote) { quote = null; }
            else cur += c;
        } else if (c === '"' || c === "'") { quote = c; }
        else if (c === ' ') { if (cur) { tokens.push(cur); cur = ''; } }
        else cur += c;
    }
    if (cur) tokens.push(cur);
    return { name: tokens[0], args: tokens.slice(1) };
}

const BUILTINS = {
    help: {
        desc: 'Show available commands',
        run() {
            const t = window.t();
            termPrint(t.term_help_header || 'Built-in commands:', 'term-info');
            const max = Math.max(...Object.keys(BUILTINS).map(k => k.length));
            for (const [name, def] of Object.entries(BUILTINS)) {
                termPrintHTML(`  <span class="term-key">${_escape(name.padEnd(max + 2))}</span><span class="term-muted">${_escape(def.desc || '')}</span>`);
            }
            const customCmds = window.registry?.listCommands() || [];
            if (customCmds.length) {
                termPrint('');
                termPrint(t.term_help_custom || 'Installed commands:', 'term-info');
                for (const c of customCmds) {
                    termPrintHTML(`  <span class="term-key">${_escape(c.id.padEnd(max + 2))}</span><span class="term-muted">${_escape(c.name || '')}</span>`);
                }
            }
        }
    },
    clear: { desc: 'Clear the screen', run() { termClear(); } },
    echo:  { desc: 'Print text', run(args) { termPrint(args.join(' ')); } },
    apps:  {
        desc: 'List installed apps',
        run() {
            const apps = (window.registry?.list() || []).filter(m => m.type === 'app');
            if (!apps.length) { termPrint('(no apps installed)', 'term-dim'); return; }
            for (const a of apps) {
                termPrintHTML(`${a.icon || '📦'} <span class="term-key">${_escape(a.id.padEnd(20))}</span><span class="term-muted">${_escape(a.name)}</span>`);
            }
        }
    },
    commands: {
        desc: 'List installed commands',
        run() {
            const cs = window.registry?.listCommands() || [];
            if (!cs.length) { termPrint('(no commands installed)', 'term-dim'); return; }
            for (const c of cs) {
                termPrintHTML(`<span class="term-success">⚡</span> <span class="term-key">${_escape(c.id.padEnd(20))}</span><span class="term-muted">${_escape(c.name)}</span>`);
            }
        }
    },
    install: {
        desc: 'Install a .zip package (opens file picker)',
        async run() { await window.installer?.installPrompt(); }
    },
    uninstall: {
        desc: 'Uninstall a package by id',
        async run(args) {
            const id = args[0];
            if (!id) { termPrint('usage: uninstall <id>', 'term-error'); return; }
            if (!window.registry?.isInstalled(id)) { termPrint('not installed: ' + id, 'term-error'); return; }
            await window.registry.uninstall(id);
            try { localStorage.removeItem('aruta_perms_' + id); } catch {}
            termPrint('uninstalled: ' + id, 'term-success');
        }
    },
    open: {
        desc: 'Open a window by id',
        run(args) {
            const id = args[0];
            if (!id) { termPrint('usage: open <id>', 'term-error'); return; }
            if (typeof openWindow !== 'function') return;
            openWindow(id);
            termPrint('opened: ' + id, 'term-success');
        }
    },
    close: {
        desc: 'Close a window by id',
        run(args) {
            const id = args[0];
            if (!id) { termPrint('usage: close <id>', 'term-error'); return; }
            if (typeof closeWindow !== 'function') return;
            closeWindow(id);
            termPrint('closed: ' + id, 'term-success');
        }
    },
    permissions: {
        desc: 'Show or edit permissions for an app',
        run(args) {
            const id = args[0];
            if (!id) { termPrint('usage: permissions <id>', 'term-error'); return; }
            const m = window.registry?.getManifest(id);
            if (!m) { termPrint('not installed: ' + id, 'term-error'); return; }
            const perms = JSON.parse(localStorage.getItem('aruta_perms_' + id) || '{}');
            termPrintHTML(`<span class="term-info">${_escape(m.name)}</span> <span class="term-muted">(</span><span class="term-value">${_escape(id)}</span><span class="term-muted">)</span>`);
            const decl = m.permissions || [];
            const all = Array.from(new Set([...decl, ...Object.keys(perms)]));
            if (!all.length) { termPrint('  (no permissions)', 'term-dim'); return; }
            for (const p of all) {
                const state = perms[p] || 'ask';
                const stateCls = state === 'granted' ? 'term-success' : state === 'denied' ? 'term-error' : 'term-muted';
                termPrintHTML(`  <span class="term-key">${_escape(p.padEnd(16))}</span><span class="${stateCls}">${state}</span>`);
            }
        }
    },
    history: {
        desc: 'Show command history',
        run() { _history.forEach((h, i) => termPrint(String(i + 1).padStart(3) + '  ' + h)); }
    },
    theme: {
        desc: 'Toggle theme: theme [dark|light]',
        run(args) {
            if (typeof toggleTheme !== 'function') return;
            const target = args[0];
            if (target && target !== window.currentTheme) toggleTheme();
            else if (!target) toggleTheme();
            termPrint('theme: ' + window.currentTheme, 'term-success');
        }
    },
    lang: {
        desc: 'Switch language: lang <it|en|es|ja|fn>',
        run(args) {
            if (!args[0]) { termPrint('current: ' + window.currentLang, 'term-info'); return; }
            if (typeof switchLanguage === 'function') { switchLanguage(args[0]); termPrint('lang: ' + args[0], 'term-success'); }
        }
    },
    pwd: {
        desc: 'Print working directory',
        async run() {
            if (!(await requireLinked())) return;
            termPrint('~' + (_cwd ? '/' + _cwd : ''));
        }
    },
    cd: {
        desc: 'Change directory: cd [path]',
        async run(args) {
            const handle = await requireLinked();
            if (!handle) return;
            const arg = args[0];
            if (!arg || arg === '~') { _cwd = ''; _updatePromptUI(); return; }
            let target;
            try { target = resolvePath(arg, _cwd); }
            catch (e) { termPrint('cd: ' + (e.message || e), 'term-error'); return; }
            try { await walkToDir(handle, target); }
            catch { termPrint('cd: no such directory: ' + arg, 'term-error'); return; }
            _cwd = target;
            _updatePromptUI();
        }
    },
    ls: {
        desc: 'List directory: ls [-a] [path]',
        async run(args) {
            const handle = await requireLinked();
            if (!handle) return;
            let showAll = false;
            const rest = [];
            for (const a of (args || [])) {
                if (a === '-a' || a === '--all') showAll = true;
                else rest.push(a);
            }
            let target = _cwd;
            if (rest[0]) {
                try { target = resolvePath(rest[0], _cwd); }
                catch (e) { termPrint('ls: ' + (e.message || e), 'term-error'); return; }
            }
            let dir;
            try { dir = await walkToDir(handle, target); }
            catch { termPrint('ls: no such directory: ' + (rest[0] || ('~' + (target ? '/' + target : ''))), 'term-error'); return; }
            const dirs = [];
            const files = [];
            try {
                for await (const [name, entry] of dir.entries()) {
                    if (!showAll && name.startsWith('.')) continue;
                    if (entry.kind === 'directory') dirs.push(name);
                    else files.push(name);
                }
            } catch (e) { termPrint('ls: ' + (e.message || e), 'term-error'); return; }
            dirs.sort((a, b) => a.localeCompare(b));
            files.sort((a, b) => a.localeCompare(b));
            for (const n of dirs) termPrintHTML(`<span class="term-key">${_escape(n)}/</span>`);
            for (const n of files) termPrintHTML(`<span class="term-value">${_escape(n)}</span>`);
        }
    },
};

async function termRun(line) {
    const parsed = _parseLine(line);
    if (!parsed) return;
    const t = window.t();

    _history.push(line);
    if (_history.length > HISTORY_MAX) _history = _history.slice(-HISTORY_MAX);
    _saveHistory();
    _historyIdx = _history.length;

    termPrintHTML(`<span class="term-prompt">${_promptText()}</span><span class="term-cmd">${_escape(line)}</span>`);

    const builtin = BUILTINS[parsed.name];
    if (builtin) {
        try { await builtin.run(parsed.args); }
        catch (e) { termPrint('error: ' + (e.message || e), 'term-error'); }
        return;
    }
    if (window.registry?.isInstalled(parsed.name)) {
        const m = window.registry.getManifest(parsed.name);
        if (m.type === 'command') {
            try { await window.sandbox.runCommand(parsed.name, parsed.args); }
            catch (e) { termPrint('error: ' + (e.message || e), 'term-error'); }
            return;
        }
        if (m.type === 'app') {
            if (typeof openWindow === 'function') openWindow(parsed.name);
            return;
        }
    }
    termPrint((t.term_unknown || 'unknown command:') + ' ' + parsed.name, 'term-error');
}

function _escape(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function _promptText() { return '⚜ aruta:~' + (_cwd ? '/' + _cwd : '') + '$ '; }

function _onKey(e) {
    if (e.key === 'Enter') {
        const v = _input.value;
        _input.value = '';
        termRun(v);
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        if (_history.length === 0) return;
        _historyIdx = Math.max(0, _historyIdx - 1);
        _input.value = _history[_historyIdx] || '';
        e.preventDefault();
    } else if (e.key === 'ArrowDown') {
        if (_historyIdx < _history.length - 1) {
            _historyIdx++;
            _input.value = _history[_historyIdx];
        } else {
            _historyIdx = _history.length;
            _input.value = '';
        }
        e.preventDefault();
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        termClear();
        e.preventDefault();
    }
}

function initTerminal() {
    if (_initialized) return;
    const win = document.getElementById('win-terminal');
    if (!win) return;
    const content = win.querySelector('.win-content');
    if (!content) return;

    content.innerHTML = `
        <div class="term-screen">
            <div class="term-output" id="term-output"></div>
            <div class="term-inputline">
                <span class="term-prompt" id="term-prompt">⚜ aruta:~$ </span>
                <input class="term-input" id="term-input" type="text" autocomplete="off" spellcheck="false" autocapitalize="off">
            </div>
        </div>
    `;
    _output = content.querySelector('#term-output');
    _input = content.querySelector('#term-input');
    _prompt = content.querySelector('#term-prompt');

    _loadHistory();
    _historyIdx = _history.length;

    const t = window.t();
    termPrint(t.term_welcome || '✦ Aruta Terminal — type "help" for commands', 'term-info');
    termPrint('');

    _input.addEventListener('keydown', _onKey);
    content.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && !window.getSelection()?.toString()) _input.focus();
    });

    _initialized = true;
}

window.terminal = {
    init: initTerminal,
    print: termPrint,
    printHTML: termPrintHTML,
    clear: termClear,
    run: termRun,
};
