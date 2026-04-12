/* ════════════════════════════
   STATE
════════════════════════════ */
let currentLang  = 'it';
let currentTheme = 'dark';
const RUNE_SET = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᛡᛣᛤᛥᛦ✦⊕⋆◈✧';

/* ════════════════════════════
   PERFORMANCE: Cached globals (avoid DOM reads in loops)
════════════════════════════ */
let _isLight = false;          // cached theme check — updated in toggleTheme
let _tabVisible = true;        // visibility state — pause animations when hidden
window._parallaxEnabled = true;
window._clickSpellsEnabled = true;
window._circleRotationEnabled = true;

document.addEventListener('visibilitychange', () => {
    _tabVisible = !document.hidden;
});
