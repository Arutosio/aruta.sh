/* ════════════════════════════
   BUILDERS
════════════════════════════ */
function buildLinkCards() {
    document.getElementById('link-cards').innerHTML = SOCIALS.map(s =>
        `<a href="${s.href}" class="link-card ${s.id}" target="_blank" rel="noopener" aria-label="${s.platform} — ${s.handle}">
            ${s.icon}
            <div class="link-card-text">
                <span class="link-card-platform">${s.platform}</span>
                <span class="link-card-handle">${s.handle}</span>
            </div>
            <i class="fas fa-arrow-right link-card-arrow" aria-hidden="true"></i>
        </a>`
    ).join('');
}

function buildInterestGrid(lang) {
    const t = i18n[lang];
    document.getElementById('interest-grid').innerHTML = INTERESTS.map(item =>
        `<div class="interest-card">
            <span class="interest-icon">${item.icon}</span>
            <div class="interest-body">
                <span class="interest-name">${t[item.key]}</span>
                <span class="interest-detail">${item.detail}</span>
            </div>
        </div>`
    ).join('');
}

/* ════════════════════════════
   CLIP GALLERY
════════════════════════════ */
function buildClipGallery() {
    const grid = document.getElementById('clips-grid');
    if (!grid || !CLIPS || !CLIPS.length) return;
    grid.innerHTML = '';

    CLIPS.forEach(clip => {
        const card = document.createElement('div');
        card.className = 'clip-card';
        card.innerHTML = `
            <div class="clip-embed">
                <div class="clip-placeholder" data-clip-id="${clip.embedId}" data-platform="${clip.platform}">
                    <span class="clip-play-icon">▶</span>
                    <span class="clip-title">${clip.title}</span>
                </div>
            </div>
        `;
        // Click to load iframe (lazy — don't load all iframes at once)
        card.querySelector('.clip-placeholder').addEventListener('click', function() {
            const p = this.dataset.platform;
            const id = this.dataset.clipId;
            let src = '';
            if (p === 'twitch') src = `https://clips.twitch.tv/embed?clip=${id}&parent=${location.hostname}`;
            else if (p === 'youtube') src = `https://www.youtube.com/embed/${id}?autoplay=1`;
            this.outerHTML = `<iframe src="${src}" allowfullscreen allow="autoplay; encrypted-media" title="${clip.title}"></iframe>`;
        });
        grid.appendChild(card);
    });
}

/* ════════════════════════════
   PROJECT CARDS (GitHub API)
════════════════════════════ */
const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', 'C#': '#178600', Python: '#3572A5',
    Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95',
    Shell: '#89e051', Groovy: '#4298b8', HTML: '#e34c26', CSS: '#563d7c', Kotlin: '#A97BFF',
    Swift: '#F05138', Dart: '#00B4AB', Lua: '#000080', C: '#555555', 'C++': '#f34b7d'
};

let projectCache = null;

async function fetchCommitCount(slug) {
    // Use per_page=1 and parse Link header to get total commit count
    const r = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=1`);
    if (!r.ok) return 0;
    const link = r.headers.get('Link');
    if (!link) return 1;
    const match = link.match(/page=(\d+)>;\s*rel="last"/);
    return match ? parseInt(match[1], 10) : 1;
}

async function fetchProjects() {
    if (projectCache) return projectCache;
    const results = await Promise.allSettled(
        PROJECTS.map(async slug => {
            const [repoRes, commits] = await Promise.all([
                fetch(`https://api.github.com/repos/${slug}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
                fetchCommitCount(slug)
            ]);
            repoRes._commits = commits;
            return repoRes;
        })
    );
    projectCache = results.map((r, i) => r.status === 'fulfilled' ? r.value : { _error: true, _slug: PROJECTS[i] });
    return projectCache;
}

function fmtDate(iso, lang) {
    const loc = lang === 'fn' ? 'en' : lang;
    return new Date(iso).toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderProjectCards(repos, lang) {
    const t = i18n[lang];
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    grid.innerHTML = repos.map(repo => {
        if (repo._error) {
            return `<div class="project-card project-card--error">
                <span class="project-error-icon">⚠</span>
                <span class="project-error-text">${t.proj_error}: ${repo._slug}</span>
            </div>`;
        }

        const langDot = repo.language && LANG_COLORS[repo.language]
            ? `<span class="proj-lang-dot" style="background:${LANG_COLORS[repo.language]}"></span>`
            : '';
        const langName = repo.language || '—';
        const createdStr = fmtDate(repo.created_at, lang);
        const updatedStr = fmtDate(repo.pushed_at, lang);
        const topics = (repo.topics || []).slice(0, 4);
        const topicsHtml = topics.length
            ? `<div class="proj-topics">${topics.map(t => `<span class="proj-topic">${t}</span>`).join('')}</div>`
            : '';

        return `<a href="${repo.html_url}" class="project-card" target="_blank" rel="noopener" aria-label="${repo.name}">
            <div class="project-header">
                <i class="fab fa-github project-gh-icon" aria-hidden="true"></i>
                <span class="project-name">${repo.name}</span>
                ${repo.archived ? '<span class="proj-badge proj-badge--archived">archived</span>' : ''}
                ${repo.private ? '<span class="proj-badge proj-badge--private"><i class="fas fa-lock"></i></span>' : ''}
            </div>
            <p class="project-desc">${repo.description || '—'}</p>
            ${topicsHtml}
            <div class="project-stats">
                <span class="proj-stat">${langDot} ${langName}</span>
                <span class="proj-stat"><i class="fas fa-star" aria-hidden="true"></i> ${repo.stargazers_count}</span>
                <span class="proj-stat"><i class="fas fa-code-branch" aria-hidden="true"></i> ${repo.forks_count}</span>
                <span class="proj-stat"><i class="fas fa-code-commit" aria-hidden="true"></i> ${repo._commits} ${t.proj_commits}</span>
                <span class="proj-stat"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> ${repo.open_issues_count} ${t.proj_issues}</span>
            </div>
            <div class="project-dates">
                <span class="proj-date"><i class="fas fa-calendar-plus" aria-hidden="true"></i> ${t.proj_created} ${createdStr}</span>
                <span class="proj-date"><i class="fas fa-clock" aria-hidden="true"></i> ${t.proj_updated} ${updatedStr}</span>
            </div>
        </a>`;
    }).join('');
}

async function buildProjectCards(lang) {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;
    const t = i18n[lang];
    grid.innerHTML = `<div class="project-card project-card--loading"><span class="proj-loading-rune">◈</span> ${t.proj_loading}</div>`;
    const repos = await fetchProjects();
    renderProjectCards(repos, lang);
}

/* ════════════════════════════
   CARD ENTRANCE (CSS-based, smooth)
════════════════════════════ */
function revealCards(selector, delay) {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;

    // Set initial hidden state without forcing reflow
    els.forEach(el => {
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px) scale(0.97)';
    });

    // Single rAF to batch the reflow, then apply transitions
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            els.forEach((el, i) => {
                el.style.transition = `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 60}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay + i * 60}ms`;
                el.style.opacity = '1';
                el.style.transform = 'translateY(0) scale(1)';
            });
        });
    });

    // Clean inline styles after all animations done
    const totalTime = delay + els.length * 60 + 600;
    setTimeout(() => {
        els.forEach(el => {
            el.style.opacity = '';
            el.style.transform = '';
            el.style.transition = '';
        });
    }, totalTime);
}

/* ════════════════════════════
   VANILLA TILT (3D hover on cards)
════════════════════════════ */
function initTilt() {
    if (typeof VanillaTilt === 'undefined' || window.matchMedia('(pointer: coarse)').matches) return;

    document.querySelectorAll('.interest-card, .link-card').forEach(el => {
        if (el.vanillaTilt) return; // already init
        VanillaTilt.init(el, { max: 7, speed: 400, glare: true, 'max-glare': 0.10, scale: 1.02 });
    });

    document.querySelectorAll('.project-card:not(.project-card--loading):not(.project-card--error)').forEach(el => {
        if (el.vanillaTilt) return;
        VanillaTilt.init(el, { max: 5, speed: 400, glare: true, 'max-glare': 0.08 });
    });

    const portrait = document.querySelector('.portrait-img-wrap');
    if (portrait && !portrait.vanillaTilt) {
        VanillaTilt.init(portrait, { max: 8, speed: 600, glare: true, 'max-glare': 0.12, scale: 1.03 });
    }
}
