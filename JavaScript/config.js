/* ============================================================
   ARUTA.SH — CONFIG
   Modifica questo file per aggiornare contenuti, social e testi.
   ============================================================ */

/* ════════════════════════════
   TRANSLATIONS
════════════════════════════ */
const i18n = {
    it: {
        char_class: 'Streamer · Programmatore · Avventuriero',
        sec_home:   'Home',
        sec_about:  'About',
        sec_links:  'Link',
        links_desc: 'Trovami su queste piattaforme',
        bio: 'Mi chiamo Stefano Aruta. Programmatore appassionato con un amore profondo per anime, manga, Ultima Online, Minecraft e D&D. Come i protagonisti delle storie isekai, mi lancio ora in un nuovo viaggio: lo streaming. Cercando mondi senza confini dove libertà e creatività non hanno limite.',
        boot: [
            '✦ Un\'anima si risveglia in questo reame...',
            '⊕ Consultando il Tomo Antico...',
            '⋆ I Quattro Elementi rispondono...',
            '✦ Il cerchio magico prende forma...',
            '⊕ Il portale si apre...',
            '✦ Benvenuto nel Reame di Aruta ✦'
        ],
        int_gaming:    'Gaming',
        int_anime:     'Anime & Manga',
        int_coding:    'Programmazione',
        int_streaming: 'Streaming',
        int_fantasy:   'Fantasy & GdR',
        int_openworld: 'Open World',
        projects_title: 'Progetti in Corso',
        proj_stars: 'stelle',
        proj_forks: 'fork',
        proj_commits: 'commit',
        proj_issues: 'issue',
        proj_created: 'Creato',
        proj_updated: 'Aggiornato',
        proj_loading: 'Consultando gli archivi...',
        proj_error: 'Pergamena non trovata'
    },
    en: {
        char_class: 'Streamer · Programmer · Adventurer',
        sec_home:   'Home',
        sec_about:  'About',
        sec_links:  'Links',
        links_desc: 'Find me on these platforms',
        bio: 'My name is Stefano Aruta. A passionate programmer with a deep love for anime, manga, Ultima Online, Minecraft and D&D. Like the heroes of isekai tales, I now embark on a new journey: streaming. Seeking worlds without boundaries, where freedom and creativity know no limits.',
        boot: [
            '✦ A soul awakens in this realm...',
            '⊕ Consulting the Ancient Tome...',
            '⋆ The Four Elements respond...',
            '✦ The magic circle takes shape...',
            '⊕ The portal opens...',
            '✦ Welcome to the Realm of Aruta ✦'
        ],
        int_gaming:    'Gaming',
        int_anime:     'Anime & Manga',
        int_coding:    'Programming',
        int_streaming: 'Streaming',
        int_fantasy:   'Fantasy & RPG',
        int_openworld: 'Open World',
        projects_title: 'Current Projects',
        proj_stars: 'stars',
        proj_forks: 'forks',
        proj_commits: 'commits',
        proj_issues: 'issues',
        proj_created: 'Created',
        proj_updated: 'Updated',
        proj_loading: 'Consulting the archives...',
        proj_error: 'Scroll not found'
    },
    es: {
        char_class: 'Streamer · Programador · Aventurero',
        sec_home:   'Inicio',
        sec_about:  'Sobre mí',
        sec_links:  'Enlaces',
        links_desc: 'Encuéntrame en estas plataformas',
        bio: 'Me llamo Stefano Aruta. Programador apasionado con un profundo amor por el anime, manga, Ultima Online, Minecraft y D&D. Como los protagonistas de las historias isekai, me lanzo ahora a un nuevo viaje: el streaming. Buscando mundos sin límites donde la libertad y la creatividad no tienen fronteras.',
        boot: [
            '✦ Un alma despierta en este reino...',
            '⊕ Consultando el Tomo Antiguo...',
            '⋆ Los Cuatro Elementos responden...',
            '✦ El círculo mágico toma forma...',
            '⊕ El portal se abre...',
            '✦ Bienvenido al Reino de Aruta ✦'
        ],
        int_gaming:    'Gaming',
        int_anime:     'Anime y Manga',
        int_coding:    'Programación',
        int_streaming: 'Streaming',
        int_fantasy:   'Fantasía y RPG',
        int_openworld: 'Mundo Abierto',
        projects_title: 'Proyectos Actuales',
        proj_stars: 'estrellas',
        proj_forks: 'forks',
        proj_commits: 'commits',
        proj_issues: 'issues',
        proj_created: 'Creado',
        proj_updated: 'Actualizado',
        proj_loading: 'Consultando los archivos...',
        proj_error: 'Pergamino no encontrado'
    },
    ja: {
        char_class: 'ストリーマー · プログラマー · 冒険者',
        sec_home:   'ホーム',
        sec_about:  'について',
        sec_links:  'リンク',
        links_desc: 'これらのプラットフォームで見つけてください',
        bio: '私はStefano Arutaです。アニメ、マンガ、ウルティマオンライン、マインクラフト、D&Dへの深い愛を持つ情熱的なプログラマーです。異世界転生の主人公のように、今私は新たな旅へ踏み出します——ストリーミングの世界へ。自由と創造性に限界のない世界を求めて。',
        boot: [
            '✦ この王国に魂が目覚める...',
            '⊕ 古代の書を開く...',
            '⋆ 四つの元素が応答する...',
            '✦ 魔法陣が形を成す...',
            '⊕ 転移門が開く...',
            '✦ アルタの王国へようこそ ✦'
        ],
        int_gaming:    'ゲーム',
        int_anime:     'アニメ & マンガ',
        int_coding:    'プログラミング',
        int_streaming: 'ストリーミング',
        int_fantasy:   'ファンタジー & RPG',
        int_openworld: 'オープンワールド',
        projects_title: '進行中のプロジェクト',
        proj_stars: 'スター',
        proj_forks: 'フォーク',
        proj_commits: 'コミット',
        proj_issues: 'イシュー',
        proj_created: '作成日',
        proj_updated: '更新日',
        proj_loading: '古文書を調べています...',
        proj_error: '巻物が見つかりません'
    },
    fn: {
        char_class: 'ᛊᛏᚱᛖᚨᛗᛖᚱ · ᛈᚱᛟᚷᚱᚨᛗᛗᛖᚱ · ᚨᛞᚹᛖᚾᛏᚢᚱᛖᚱ',
        sec_home:   'ᚺᛟᛗᛖ',
        sec_about:  'ᚨᛒᛟᚢᛏ',
        sec_links:  'ᛚᛁᚾᚲᛊ',
        links_desc: 'ᚠᛁᚾᛞ ᛗᛖ ᛟᚾ ᚦᛖᛊᛖ ᛈᛚᚨᛏᚠᛟᚱᛗᛊ',
        bio: 'ᛁ ᚨᛗ ᛊᛏᛖᚠᚨᚾᛟ ᚨᚱᚢᛏᚨ · ᚨ ᛈᚨᛊᛊᛁᛟᚾᚨᛏᛖ ᛈᚱᛟᚷᚱᚨᛗᛗᛖᚱ ᚹᛁᛏᚺ ᚨ ᛞᛖᛖᛈ ᛚᛟᚹᛖ ᚠᛟᚱ ᚨᚾᛁᛗᛖ · ᛗᚨᚾᚷᚨ · ᚢᛚᛏᛁᛗᚨ ᛟᚾᛚᛁᚾᛖ · ᛗᛁᚾᛖᚲᚱᚨᚠᛏ ᚨᚾᛞ ᛞᚨᚾᛞ · ᛚᛁᚲᛖ ᚦᛖ ᚺᛖᚱᛟᛖᛊ ᛟᚠ ᛁᛊᛖᚲᚨᛁ ᛏᚨᛚᛖᛊ · ᛁ ᚾᛟᚹ ᛖᛗᛒᚨᚱᚲ ᛟᚾ ᚨ ᚾᛖᚹ ᛃᛟᚢᚱᚾᛖᛃ · ᛊᛏᚱᛖᚨᛗᛁᚾᚷ · ᛊᛖᛖᚲᛁᚾᚷ ᚹᛟᚱᛚᛞᛊ ᚹᛁᛏᚺᛟᚢᛏ ᛒᛟᚢᚾᛞᚨᚱᛁᛖᛊ',
        boot: [
            '✦ ᚨ ᛊᛟᚢᛚ ᚨᚹᚨᚲᛖᚾᛊ ᛁᚾ ᚦᛁᛊ ᚱᛖᚨᛚᛗ...',
            '⊕ ᚲᛟᚾᛊᚢᛚᛏᛁᚾᚷ ᚦᛖ ᚨᚾᚲᛁᛖᚾᛏ ᛏᛟᛗᛖ...',
            '⋆ ᚦᛖ ᚠᛟᚢᚱ ᛖᛚᛖᛗᛖᚾᛏᛊ ᚱᛖᛊᛈᛟᚾᛞ...',
            '✦ ᚦᛖ ᛗᚨᚷᛁᚲ ᚲᛁᚱᚲᛚᛖ ᛏᚨᚲᛖᛊ ᛊᚺᚨᛈᛖ...',
            '⊕ ᚦᛖ ᛈᛟᚱᛏᚨᛚ ᛟᛈᛖᚾᛊ...',
            '✦ ᚹᛖᛚᚲᛟᛗᛖ ᛏᛟ ᚦᛖ ᚱᛖᚨᛚᛗ ᛟᚠ ᚨᚱᚢᛏᚨ ✦'
        ],
        int_gaming:    'ᚷᚨᛗᛁᚾᚷ',
        int_anime:     'ᚨᚾᛁᛗᛖ & ᛗᚨᚾᚷᚨ',
        int_coding:    'ᛈᚱᛟᚷᚱᚨᛗᛗᛁᚾᚷ',
        int_streaming: 'ᛊᛏᚱᛖᚨᛗᛁᚾᚷ',
        int_fantasy:   'ᚠᚨᚾᛏᚨᛊᛃ & ᚱᛈᚷ',
        int_openworld: 'ᛟᛈᛖᚾ ᚹᛟᚱᛚᛞ',
        projects_title: 'ᛈᚱᛟᛃᛖᚲᛏᛊ',
        proj_stars: 'ᛊᛏᚨᚱᛊ',
        proj_forks: 'ᚠᛟᚱᚲᛊ',
        proj_commits: 'ᚲᛟᛗᛗᛁᛏᛊ',
        proj_issues: 'ᛁᛊᛊᚢᛖᛊ',
        proj_created: 'ᚲᚱᛖᚨᛏᛖᛞ',
        proj_updated: 'ᚢᛈᛞᚨᛏᛖᛞ',
        proj_loading: 'ᚲᛟᚾᛊᚢᛚᛏᛁᚾᚷ...',
        proj_error: 'ᛊᚲᚱᛟᛚᛚ ᚾᛟᛏ ᚠᛟᚢᚾᛞ'
    }
};

/* ════════════════════════════
   SOCIAL LINKS
════════════════════════════ */
const SOCIALS = [
    { id: 'twitch',    href: 'https://twitch.tv/aruta.sh',     platform: 'Twitch',      handle: 'aruta.sh',  icon: '<i class="fab fa-twitch link-card-icon"></i>' },
    { id: 'kick',      href: 'https://kick.com/aruta_sh',      platform: 'Kick',        handle: 'aruta_sh',  icon: '<svg class="link-card-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 2h4v6l4-6h5l-5 7 5 7h-5l-4-6v6H2V2z"/></svg>' },
    { id: 'youtube',   href: 'https://youtube.com/@aruta.sh',  platform: 'YouTube',     handle: '@aruta.sh', icon: '<i class="fab fa-youtube link-card-icon"></i>' },
    { id: 'twitter',   href: 'https://twitter.com/aruta.sh',   platform: 'Twitter / X', handle: '@aruta.sh', icon: '<i class="fab fa-twitter link-card-icon"></i>' },
    { id: 'instagram', href: 'https://instagram.com/aruta_sr', platform: 'Instagram',   handle: 'aruta_sr',  icon: '<i class="fab fa-instagram link-card-icon"></i>' },
    { id: 'github',    href: 'https://github.com/Arutosio',    platform: 'GitHub',      handle: 'Arutosio',  icon: '<i class="fab fa-github link-card-icon"></i>' }
];

/* ════════════════════════════
   PROJECTS — just change the slug to swap a repo
════════════════════════════ */
const PROJECTS = [
    'Arutosio/Hina',
    'Arutosio/AnimeWorldDownloader'
];

/* ════════════════════════════
   INTERESTS
════════════════════════════ */
const INTERESTS = [
    { icon: '🎮', key: 'int_gaming',    detail: 'Ultima Online · Minecraft · D&D' },
    { icon: '🌸', key: 'int_anime',     detail: 'Isekai · Shonen · Seinen' },
    { icon: '💻', key: 'int_coding',    detail: 'Web · Scripts · Automation' },
    { icon: '📺', key: 'int_streaming', detail: 'Twitch · Kick · YouTube' },
    { icon: '⚔️', key: 'int_fantasy',   detail: 'Dungeons & Dragons · Roleplay' },
    { icon: '🌍', key: 'int_openworld', detail: 'Exploration · Sandbox · Adventure' }
];
