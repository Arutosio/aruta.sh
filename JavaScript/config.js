/* ============================================================
   ARUTA.SH — CONFIG
   Modifica questo file per aggiornare contenuti, social e lingue.
   ============================================================ */

const CONFIG = {

    /* ── Dati generali ── */
    name:     'Aruta',
    fullName: 'Stefano Aruta',
    year:     2025,

    /* ── Testi per lingua ──────────────────────────────────────
       Aggiungi una nuova lingua copiando uno dei blocchi qui sotto
       e aggiungendo il codice lingua (es. "fr", "de"…).
       Ricorda poi di aggiungere il pulsante in index.html.
    ─────────────────────────────────────────────────────────── */
    i18n: {
        it: {
            pre: 'Il Mago Errante',
            cls: 'Streamer · Programmatore · Avventuriero',
            bio: 'Mi chiamo Stefano Aruta. Programmatore appassionato, amante di anime, manga, Ultima Online, Minecraft e D&D. Attratto da mondi senza confini dove libertà e creatività regnano sovrane. Ora mi lancio in una nuova avventura: lo streaming.'
        },
        en: {
            pre: 'The Wandering Mage',
            cls: 'Streamer · Programmer · Adventurer',
            bio: 'My name is Stefano Aruta. A passionate programmer, lover of anime, manga, Ultima Online, Minecraft and D&D. Drawn to worlds without limits where freedom and creativity reign. Now embarking on a new adventure: streaming.'
        },
        es: {
            pre: 'El Mago Errante',
            cls: 'Streamer · Programador · Aventurero',
            bio: 'Me llamo Stefano Aruta. Programador apasionado, amante del anime, manga, Ultima Online, Minecraft y D&D. Atraído por mundos sin límites donde reinan la libertad y la creatividad. Ahora me embarco en una nueva aventura: el streaming.'
        },
        ja: {
            pre: '放浪の魔法使い',
            cls: 'ストリーマー · プログラマー · 冒険者',
            bio: '私はStefano Arutaです。アニメ、マンガ、ウルティマオンライン、マインクラフト、D&Dを愛する情熱的なプログラマー。自由と創造性が支配する限界のない世界に惹かれています。そして今、新たな冒険へ——ストリーミング。'
        }
    },

    /* ── Tag / interessi ───────────────────────────────────────
       Aggiungi, rimuovi o modifica le voci liberamente.
    ─────────────────────────────────────────────────────────── */
    tags: [
        { emoji: '🎮', label: 'Ultima Online' },
        { emoji: '⚔️', label: 'D&D'           },
        { emoji: '🌍', label: 'Minecraft'      },
        { emoji: '🌸', label: 'Anime · Manga'  },
        { emoji: '💻', label: 'Programming'    }
    ],

    /* ── Social links ──────────────────────────────────────────
       id     → usato come classe CSS per il colore hover
       url    → link completo
       icon   → classe Font Awesome  OPPURE  'kick' per l'icona SVG custom
       label  → testo del pulsante
    ─────────────────────────────────────────────────────────── */
    socials: [
        { id: 'twitch',    url: 'https://twitch.tv/aruta.sh',     icon: 'fab fa-twitch',    label: 'Twitch'    },
        { id: 'kick',      url: 'https://kick.com/aruta_sh',      icon: 'kick',             label: 'Kick'      },
        { id: 'youtube',   url: 'https://youtube.com/@aruta.sh',  icon: 'fab fa-youtube',   label: 'YouTube'   },
        { id: 'instagram', url: 'https://instagram.com/aruta_sr', icon: 'fab fa-instagram', label: 'Instagram' },
        { id: 'twitter',   url: 'https://twitter.com/aruta.sh',   icon: 'fab fa-twitter',   label: 'Twitter'   }
    ]

};
