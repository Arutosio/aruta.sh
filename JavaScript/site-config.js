/* ╔══════════════════════════════════════════════════════════╗
 * ║  SITE CONFIG — Per-site branding and default backgrounds. ║
 * ║  Mirrors of this site (e.g. arutosio.com) keep their own  ║
 * ║  copy of this file; tools/sync-arutosio.sh never touches  ║
 * ║  it. Loaded before appearance.js.                          ║
 * ╚══════════════════════════════════════════════════════════╝ */
window.SITE_CONFIG = {
    name: 'Aruta.sh',
    backgrounds: {
        // Defaults used until the user picks their own in Settings → Appearance.
        mode: 'interval',   // 'interval' | 'time'
        intervalMin: 10,    // minutes between backgrounds in interval mode
        // [{ src: './Backgrounds/x.webm', kind?: 'video'|'image', slot?: 'dawn'|'noon'|'sunset'|'night' }]
        items: [],
    },
    // Per-site defaults for Settings → Performance toggles, by toggle id
    // (e.g. 'settings-hero', 'settings-bgrings', 'settings-intro'). The user's
    // own choice in Settings always wins.
    effects: {},
};
