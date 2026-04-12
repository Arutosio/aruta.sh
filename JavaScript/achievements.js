/* ════════════════════════════
   VISITOR ACHIEVEMENTS
════════════════════════════ */
const ACHIEVEMENTS = {
    first_visit:   { icon: '🏰', name: 'First Steps', desc: 'Visited the realm' },
    theme_switch:  { icon: '🌓', name: 'Duality', desc: 'Toggled the theme' },
    all_sections:  { icon: '🗺️', name: 'Explorer', desc: 'Visited all sections' },
    konami:        { icon: '✦', name: 'Secret Spell', desc: 'Found the Konami code' },
    night_owl:     { icon: '🦉', name: 'Night Owl', desc: 'Visited after midnight' },
    speed_reader:  { icon: '📖', name: 'Speed Reader', desc: 'Read the full bio' },
};

function getUnlockedAchievements() {
    try {
        return JSON.parse(localStorage.getItem('aruta_achievements') || '[]');
    } catch { return []; }
}

function unlockAchievement(id) {
    const unlocked = getUnlockedAchievements();
    if (unlocked.includes(id)) return;
    unlocked.push(id);
    try { localStorage.setItem('aruta_achievements', JSON.stringify(unlocked)); } catch {}

    const ach = ACHIEVEMENTS[id];
    if (!ach) return;

    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <span class="ach-icon">${ach.icon}</span>
        <div class="ach-body">
            <span class="ach-name">${ach.name}</span>
            <span class="ach-desc">${ach.desc}</span>
        </div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('ach-show'));
    setTimeout(() => {
        toast.classList.remove('ach-show');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

function initAchievements() {
    // First visit
    unlockAchievement('first_visit');

    // Night owl (after midnight)
    if (new Date().getHours() < 5) unlockAchievement('night_owl');

    // Track sections visited via window opens
    const visited = new Set(['home']);
    const _origOpenWindow = openWindow;
    // We patch indirectly: check on tab additions
    const origAddTab = addWindowTab;
    window._achAddTab = function(id) {
        visited.add(id);
        if (visited.size >= 4) unlockAchievement('all_sections');
    };
    // Hook into openWindow via a MutationObserver on taskbar-tabs
    const tabsEl = document.getElementById('taskbar-tabs');
    if (tabsEl) {
        const obs = new MutationObserver(() => {
            document.querySelectorAll('.taskbar-tab').forEach(t => {
                visited.add(t.dataset.tab);
            });
            if (visited.size >= 4) unlockAchievement('all_sections');
        });
        obs.observe(tabsEl, { childList: true });
    }
}
