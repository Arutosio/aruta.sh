/* ╔══════════════════════════════════════════════════════════╗
 * ║  PACKAGE STORE — browse + install packages from remote    ║
 * ║  repositories. Repo = JSON index pointing to .zip files.  ║
 * ╚══════════════════════════════════════════════════════════╝ */

const DEFAULT_REPO = {
    url: 'https://raw.githubusercontent.com/Arutosio/aruta.sh-packages/main/index.json',
    name: 'Official',
    description: 'Curated bundle by Aruta',
    enabled: false,
};

const PREFS_KEY = 'prefs';
// Legacy storage key — only read once during migration to ctx.repos.
const LEGACY_REPOS_KEY = 'repos';

function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function resolveURL(base, maybeRelative) {
    try { return new URL(maybeRelative, base).toString(); }
    catch { return maybeRelative; }
}

function cmpVersion(a, b) {
    // naive semver-ish compare: split on non-digits, compare numerically where
    // possible. Returns +1 if a > b, -1 if a < b, 0 if equal or uncomparable.
    if (a === b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    const pa = String(a).split(/[.\-+]/);
    const pb = String(b).split(/[.\-+]/);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const na = parseInt(pa[i], 10);
        const nb = parseInt(pb[i], 10);
        const aNum = !isNaN(na);
        const bNum = !isNaN(nb);
        if (aNum && bNum) {
            if (na !== nb) return na > nb ? 1 : -1;
        } else {
            const sa = pa[i] || '';
            const sb = pb[i] || '';
            if (sa !== sb) return sa > sb ? 1 : -1;
        }
    }
    return 0;
}

export default {
    async mount(root, ctx) {
        const state = {
            repos: [],
            prefs: { sortBy: 'name', showOnlyUpdates: false, showOnlyInstalled: false },
            installed: new Map(), // id -> version
            filter: '',
            category: '',
            selectedPkg: null,
            busy: new Set(), // package ids currently installing
        };

        // ── Persist ───────────────────────────────────────────
        // Repos now live in the system module (window.repos / ctx.repos). We
        // pull them on demand and write through with `ctx.repos.update` so all
        // consumers (pkg CLI, future apps) see the same state.
        async function reloadRepos() {
            try { state.repos = await ctx.repos.list() || []; }
            catch (e) { console.warn('[packagestore] repos.list failed', e); state.repos = []; }
        }
        async function persistRepoFields(url, patch) {
            try { await ctx.repos.update(url, patch); }
            catch (e) { console.warn('[packagestore] repos.update failed', e); }
        }
        async function savePrefs() { await ctx.storage.set(PREFS_KEY, state.prefs); }

        async function migrateLegacyRepos() {
            // One-time migration: copy any private `repos` entries into the
            // system module, then drop the private key. After this point the
            // app never writes to its private storage for repos again.
            const legacy = await ctx.storage.get(LEGACY_REPOS_KEY);
            if (!Array.isArray(legacy) || !legacy.length) return;
            const systemList = (await ctx.repos.list()) || [];
            const seen = new Set(systemList.map(r => r.url));
            for (const r of legacy) {
                if (!r || !r.url) continue;
                if (seen.has(r.url)) {
                    // Merge cached fields into the existing system entry.
                    await ctx.repos.update(r.url, {
                        name: r.name || r.displayName,
                        description: r.description,
                        enabled: !!r.enabled,
                        lastFetched: r.lastFetched || null,
                        etag: r.etag || null,
                        cachedIndex: r.cachedIndex || null,
                    });
                } else {
                    try {
                        await ctx.repos.add(r.url, {
                            name: r.name || r.displayName,
                            description: r.description,
                            enabled: !!r.enabled,
                            lastFetched: r.lastFetched || null,
                            etag: r.etag || null,
                            cachedIndex: r.cachedIndex || null,
                        });
                    } catch (e) { console.warn('[packagestore] migrate add failed', e); }
                }
            }
            await ctx.storage.remove(LEGACY_REPOS_KEY);
        }

        async function loadState() {
            await migrateLegacyRepos();
            await reloadRepos();
            const prefs = await ctx.storage.get(PREFS_KEY);
            if (prefs && typeof prefs === 'object') state.prefs = { ...state.prefs, ...prefs };
            await refreshInstalled();
        }

        async function refreshInstalled() {
            try {
                const list = await ctx.listInstalled();
                state.installed.clear();
                for (const m of list || []) state.installed.set(m.id, m.version);
            } catch (e) {
                console.warn('[packagestore] listInstalled failed', e);
            }
        }

        // ── Network ───────────────────────────────────────────
        async function fetchRepo(repo) {
            const headers = {};
            if (repo.etag) headers['If-None-Match'] = repo.etag;
            let resp;
            try {
                resp = await ctx.fetch(repo.url, { headers });
            } catch (e) {
                repo.lastError = String(e.message || e);
                return;
            }
            if (resp.status === 304) {
                repo.lastFetched = Date.now();
                repo.lastError = null;
                return;
            }
            if (!resp.ok) {
                repo.lastError = 'HTTP ' + resp.status + ' ' + (resp.statusText || '');
                return;
            }
            let data;
            try { data = await resp.json(); }
            catch (e) { repo.lastError = 'Invalid JSON: ' + e.message; return; }
            if (!data || !Array.isArray(data.packages)) {
                repo.lastError = 'Missing "packages" array';
                return;
            }
            // Resolve relative package urls against the repo url
            for (const p of data.packages) {
                if (p && typeof p.url === 'string') {
                    p.url = resolveURL(repo.url, p.url);
                }
            }
            repo.cachedIndex = data;
            repo.lastFetched = Date.now();
            repo.lastError = null;
            if (resp.headers && typeof resp.headers.get === 'function') {
                repo.etag = resp.headers.get('etag') || repo.etag;
            }
            // Also harvest repo metadata
            if (data.name && !repo.nameLocked) repo.displayName = data.name;
            if (data.description) repo.description = data.description;
        }

        async function refreshAllRepos() {
            const enabled = state.repos.filter(r => r.enabled);
            await Promise.all(enabled.map(r => fetchRepo(r)));
            // Push fetched fields back to the system module for each repo.
            for (const r of enabled) {
                await persistRepoFields(r.url, {
                    lastFetched: r.lastFetched,
                    etag: r.etag,
                    cachedIndex: r.cachedIndex,
                    description: r.description,
                });
            }
        }

        // ── Derived ───────────────────────────────────────────
        function getAllPackages() {
            const seen = new Map(); // id -> { pkg, repoName }
            for (const repo of state.repos) {
                if (!repo.enabled || !repo.cachedIndex) continue;
                for (const pkg of repo.cachedIndex.packages || []) {
                    if (!pkg || !pkg.id) continue;
                    if (!seen.has(pkg.id)) {
                        seen.set(pkg.id, { pkg, repoName: repo.displayName || repo.name || repo.url });
                    }
                }
            }
            return Array.from(seen.values());
        }

        function installedState(pkg) {
            const v = state.installed.get(pkg.id);
            if (v === undefined) return { status: 'available' };
            if (cmpVersion(pkg.version, v) > 0) return { status: 'update', installedVersion: v };
            return { status: 'installed', installedVersion: v };
        }

        function filteredPackages() {
            const q = state.filter.trim().toLowerCase();
            const cat = state.category;
            const all = getAllPackages();
            let out = all.filter(({ pkg }) => {
                if (q) {
                    const hay = (pkg.name + ' ' + (pkg.author || '') + ' ' + (pkg.description || '') + ' ' + pkg.id).toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                if (cat && pkg.category !== cat) return false;
                const st = installedState(pkg);
                if (state.prefs.showOnlyUpdates && st.status !== 'update') return false;
                if (state.prefs.showOnlyInstalled && st.status === 'available') return false;
                return true;
            });
            const sort = state.prefs.sortBy;
            out.sort((a, b) => {
                if (sort === 'author') return (a.pkg.author || '').localeCompare(b.pkg.author || '');
                if (sort === 'category') return (a.pkg.category || '').localeCompare(b.pkg.category || '');
                return (a.pkg.name || a.pkg.id).localeCompare(b.pkg.name || b.pkg.id);
            });
            return out;
        }

        function getCategories() {
            const set = new Set();
            for (const { pkg } of getAllPackages()) {
                if (pkg.category) set.add(pkg.category);
            }
            return Array.from(set).sort();
        }

        // ── Actions ───────────────────────────────────────────
        async function installPackage(pkg) {
            if (!pkg || !pkg.url) {
                ctx.toast('Missing package URL', 'error');
                return;
            }
            if (state.busy.has(pkg.id)) return;
            state.busy.add(pkg.id);
            renderPackages();
            renderDetails();
            try {
                // Pass binary:true so the host fetch handler returns a raw Blob
                // instead of text — zips are binary, text round-tripping corrupts them.
                const resp = await ctx.fetch(pkg.url, { binary: true });
                if (!resp.ok) throw new Error('Download failed: HTTP ' + resp.status);
                const blob = await resp.blob();
                const result = await ctx.installZip(blob, { filename: (pkg.id || 'remote') + '.zip' });
                if (result) {
                    await ctx.toast('Installed ' + (pkg.name || pkg.id), 'success');
                } else {
                    await ctx.toast('Install cancelled', 'info');
                }
            } catch (e) {
                console.warn('[packagestore] install failed', e);
                await ctx.toast(String(e.message || e), 'error');
            } finally {
                state.busy.delete(pkg.id);
                await refreshInstalled();
                renderPackages();
                renderDetails();
            }
        }

        async function addRepo() {
            const url = prompt('Repository index URL (JSON):', 'https://');
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) {
                ctx.toast('URL must start with http(s)://', 'error');
                return;
            }
            if (!/^https:/i.test(url)) {
                if (!confirm('This URL is NOT HTTPS. Continue anyway?')) return;
            }
            if (state.repos.some(r => r.url === url)) {
                ctx.toast('Repo already added', 'info');
                return;
            }
            const name = prompt('Display name (optional):', '') || new URL(url).hostname;
            try {
                await ctx.repos.add(url, { name, enabled: true });
            } catch (e) {
                ctx.toast(String(e.message || e), 'error');
                return;
            }
            await reloadRepos();
            renderRepos();
            const r = state.repos.find(x => x.url === url);
            if (r) {
                await fetchRepo(r);
                await persistRepoFields(r.url, {
                    lastFetched: r.lastFetched, etag: r.etag,
                    cachedIndex: r.cachedIndex, description: r.description,
                });
            }
            renderAll();
        }

        async function removeRepo(url) {
            if (!confirm('Remove this repository?')) return;
            await ctx.repos.remove(url);
            await reloadRepos();
            renderAll();
        }

        async function toggleRepo(url) {
            const r = state.repos.find(x => x.url === url);
            if (!r) return;
            r.enabled = !r.enabled;
            await ctx.repos.setEnabled(url, r.enabled);
            renderRepos();
            if (r.enabled && !r.cachedIndex) {
                await fetchRepo(r);
                await persistRepoFields(r.url, {
                    lastFetched: r.lastFetched, etag: r.etag,
                    cachedIndex: r.cachedIndex, description: r.description,
                });
            }
            renderPackages();
        }

        async function refreshRepo(url) {
            const r = state.repos.find(x => x.url === url);
            if (!r) return;
            r.busy = true;
            renderRepos();
            await fetchRepo(r);
            r.busy = false;
            await persistRepoFields(r.url, {
                lastFetched: r.lastFetched, etag: r.etag,
                cachedIndex: r.cachedIndex, description: r.description,
            });
            renderAll();
        }

        // ── Render ────────────────────────────────────────────
        root.innerHTML = `
            <div class="ps-wrap">
                <aside class="ps-sidebar">
                    <div class="ps-side-head">
                        <span class="ps-side-title">Repositories</span>
                        <button class="ps-btn ps-btn-ghost" data-action="refresh-all" title="Refresh all">⟳</button>
                    </div>
                    <div class="ps-repos"></div>
                    <div class="ps-side-foot">
                        <button class="ps-btn" data-action="add-repo">+ Add Repository</button>
                    </div>
                </aside>
                <section class="ps-main">
                    <div class="ps-toolbar">
                        <input type="search" class="ps-search" placeholder="Search packages…" />
                        <select class="ps-cat"><option value="">All categories</option></select>
                        <select class="ps-sort">
                            <option value="name">Sort: Name</option>
                            <option value="author">Sort: Author</option>
                            <option value="category">Sort: Category</option>
                        </select>
                        <label class="ps-chip"><input type="checkbox" class="ps-only-updates" /> Updates only</label>
                        <label class="ps-chip"><input type="checkbox" class="ps-only-installed" /> Installed</label>
                        <span class="ps-count"></span>
                    </div>
                    <div class="ps-packages"></div>
                </section>
                <aside class="ps-details"></aside>
            </div>
        `;

        const $repos = root.querySelector('.ps-repos');
        const $pkgs = root.querySelector('.ps-packages');
        const $details = root.querySelector('.ps-details');
        const $search = root.querySelector('.ps-search');
        const $cat = root.querySelector('.ps-cat');
        const $sort = root.querySelector('.ps-sort');
        const $onlyUpd = root.querySelector('.ps-only-updates');
        const $onlyInst = root.querySelector('.ps-only-installed');
        const $count = root.querySelector('.ps-count');

        function renderRepos() {
            if (!state.repos.length) {
                $repos.innerHTML = '<div class="ps-empty">No repositories yet.</div>';
                return;
            }
            $repos.innerHTML = state.repos.map(r => {
                const label = escapeHTML(r.displayName || r.name || r.url);
                const meta = r.busy ? 'refreshing…'
                    : r.lastError ? ('error: ' + escapeHTML(r.lastError))
                    : r.lastFetched ? ('updated ' + new Date(r.lastFetched).toLocaleDateString())
                    : 'never fetched';
                const count = r.cachedIndex?.packages?.length || 0;
                return `
                    <div class="ps-repo ${r.enabled ? 'is-on' : 'is-off'}" data-url="${escapeHTML(r.url)}">
                        <label class="ps-repo-main">
                            <input type="checkbox" ${r.enabled ? 'checked' : ''} data-action="toggle-repo" />
                            <span class="ps-repo-label">
                                <strong>${label}</strong>
                                <small>${count} pkg · ${meta}</small>
                            </span>
                        </label>
                        <div class="ps-repo-acts">
                            <button class="ps-btn ps-btn-ghost" data-action="refresh-repo" title="Refresh">⟳</button>
                            <button class="ps-btn ps-btn-ghost ps-danger" data-action="remove-repo" title="Remove">×</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderCategories() {
            const current = state.category;
            const cats = getCategories();
            $cat.innerHTML = '<option value="">All categories</option>' +
                cats.map(c => `<option value="${escapeHTML(c)}" ${c === current ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('');
        }

        function renderPackages() {
            const list = filteredPackages();
            $count.textContent = list.length + ' package' + (list.length === 1 ? '' : 's');
            if (!list.length) {
                const hasAnyEnabled = state.repos.some(r => r.enabled);
                $pkgs.innerHTML = `<div class="ps-empty">
                    ${hasAnyEnabled ? 'No packages match your filters.' : 'Enable or add a repository to browse packages.'}
                </div>`;
                return;
            }
            $pkgs.innerHTML = list.map(({ pkg, repoName }) => {
                const st = installedState(pkg);
                const busy = state.busy.has(pkg.id);
                const actLabel = busy ? 'Installing…'
                    : st.status === 'update' ? 'Update ↑'
                    : st.status === 'installed' ? 'Installed'
                    : 'Install';
                const actDisabled = busy || st.status === 'installed' ? 'disabled' : '';
                const sel = state.selectedPkg === pkg.id ? 'is-selected' : '';
                return `
                    <div class="ps-pkg ${sel}" data-id="${escapeHTML(pkg.id)}">
                        <span class="ps-pkg-icon">${escapeHTML(pkg.icon || '📦')}</span>
                        <div class="ps-pkg-main">
                            <div class="ps-pkg-title">
                                <strong>${escapeHTML(pkg.name || pkg.id)}</strong>
                                <span class="ps-pkg-ver">v${escapeHTML(pkg.version || '—')}</span>
                                ${st.status === 'update' ? '<span class="ps-badge">↑</span>' : ''}
                                ${st.status === 'installed' ? '<span class="ps-badge ps-badge-ok">✓</span>' : ''}
                            </div>
                            <div class="ps-pkg-sub">
                                ${escapeHTML(pkg.description || '')}
                            </div>
                            <div class="ps-pkg-meta">
                                ${pkg.category ? `<span class="ps-tag">${escapeHTML(pkg.category)}</span>` : ''}
                                ${pkg.author ? `<span class="ps-meta">by ${escapeHTML(pkg.author)}</span>` : ''}
                                <span class="ps-meta">${escapeHTML(repoName)}</span>
                            </div>
                        </div>
                        <button class="ps-btn ps-act" data-action="install" ${actDisabled}>${actLabel}</button>
                    </div>
                `;
            }).join('');
        }

        function renderDetails() {
            const id = state.selectedPkg;
            if (!id) {
                $details.innerHTML = '<div class="ps-empty">Select a package to see details.</div>';
                return;
            }
            const found = getAllPackages().find(x => x.pkg.id === id);
            if (!found) {
                $details.innerHTML = '<div class="ps-empty">Package no longer available.</div>';
                return;
            }
            const { pkg, repoName } = found;
            const st = installedState(pkg);
            const busy = state.busy.has(pkg.id);
            const actLabel = busy ? 'Installing…'
                : st.status === 'update' ? 'Update to ' + (pkg.version || '?')
                : st.status === 'installed' ? 'Installed'
                : 'Install';
            const actDisabled = busy || st.status === 'installed' ? 'disabled' : '';
            const perms = Array.isArray(pkg.permissions) ? pkg.permissions : [];
            $details.innerHTML = `
                <div class="ps-det-head">
                    <div class="ps-det-icon">${escapeHTML(pkg.icon || '📦')}</div>
                    <div class="ps-det-title">
                        <strong>${escapeHTML(pkg.name || pkg.id)}</strong>
                        <small>v${escapeHTML(pkg.version || '—')}${pkg.type ? ' · ' + escapeHTML(pkg.type) : ''}</small>
                    </div>
                </div>
                ${pkg.description ? `<p class="ps-det-desc">${escapeHTML(pkg.description)}</p>` : ''}
                <dl class="ps-det-meta">
                    <dt>ID</dt><dd>${escapeHTML(pkg.id)}</dd>
                    ${pkg.author ? `<dt>Author</dt><dd>${escapeHTML(pkg.author)}</dd>` : ''}
                    ${pkg.category ? `<dt>Category</dt><dd>${escapeHTML(pkg.category)}</dd>` : ''}
                    ${pkg.homepage ? `<dt>Homepage</dt><dd><a href="${escapeHTML(pkg.homepage)}" target="_blank" rel="noopener">${escapeHTML(pkg.homepage)}</a></dd>` : ''}
                    <dt>Source</dt><dd>${escapeHTML(repoName)}</dd>
                    ${pkg.size ? `<dt>Size</dt><dd>${(pkg.size / 1024).toFixed(1)} KB</dd>` : ''}
                    ${st.installedVersion ? `<dt>Installed</dt><dd>v${escapeHTML(st.installedVersion)}</dd>` : ''}
                </dl>
                ${perms.length ? `
                    <div class="ps-det-perms">
                        <div class="ps-det-h">Permissions</div>
                        <ul>${perms.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>
                    </div>
                ` : ''}
                ${pkg.allowOrigin ? '<div class="ps-warn">Requests relaxed sandbox (allowOrigin)</div>' : ''}
                <div class="ps-det-actions">
                    <button class="ps-btn ps-btn-primary" data-action="install-detail" ${actDisabled}>${actLabel}</button>
                </div>
            `;
        }

        function renderAll() {
            renderRepos();
            renderCategories();
            renderPackages();
            renderDetails();
        }

        // ── Wire events ───────────────────────────────────────
        root.querySelector('[data-action="add-repo"]').addEventListener('click', addRepo);
        root.querySelector('[data-action="refresh-all"]').addEventListener('click', async () => {
            const btn = root.querySelector('[data-action="refresh-all"]');
            btn.disabled = true;
            for (const r of state.repos) if (r.enabled) r.busy = true;
            renderRepos();
            await refreshAllRepos();
            for (const r of state.repos) r.busy = false;
            btn.disabled = false;
            renderAll();
        });

        $repos.addEventListener('click', async (e) => {
            const row = e.target.closest('.ps-repo');
            if (!row) return;
            const url = row.dataset.url;
            const action = e.target.dataset.action;
            if (action === 'toggle-repo') await toggleRepo(url);
            else if (action === 'refresh-repo') await refreshRepo(url);
            else if (action === 'remove-repo') await removeRepo(url);
        });

        $pkgs.addEventListener('click', async (e) => {
            const row = e.target.closest('.ps-pkg');
            if (!row) return;
            const id = row.dataset.id;
            if (e.target.dataset.action === 'install') {
                const found = getAllPackages().find(x => x.pkg.id === id);
                if (found) await installPackage(found.pkg);
                return;
            }
            state.selectedPkg = id;
            renderPackages();
            renderDetails();
        });

        $details.addEventListener('click', async (e) => {
            if (e.target.dataset.action !== 'install-detail') return;
            const id = state.selectedPkg;
            const found = getAllPackages().find(x => x.pkg.id === id);
            if (found) await installPackage(found.pkg);
        });

        $search.addEventListener('input', () => {
            state.filter = $search.value;
            renderPackages();
        });
        $cat.addEventListener('change', () => {
            state.category = $cat.value;
            renderPackages();
        });
        $sort.addEventListener('change', async () => {
            state.prefs.sortBy = $sort.value;
            await savePrefs();
            renderPackages();
        });
        $onlyUpd.addEventListener('change', async () => {
            state.prefs.showOnlyUpdates = $onlyUpd.checked;
            await savePrefs();
            renderPackages();
        });
        $onlyInst.addEventListener('change', async () => {
            state.prefs.showOnlyInstalled = $onlyInst.checked;
            await savePrefs();
            renderPackages();
        });

        // ── Boot ──────────────────────────────────────────────
        await loadState();
        $sort.value = state.prefs.sortBy;
        $onlyUpd.checked = !!state.prefs.showOnlyUpdates;
        $onlyInst.checked = !!state.prefs.showOnlyInstalled;
        renderAll();
        // auto-refresh enabled repos on first open
        refreshAllRepos().then(() => renderAll()).catch(e => console.warn(e));
    }
};
