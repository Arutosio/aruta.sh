/* ============================================================
   ARUTA.SH — CONFIG
   Modifica questo file per aggiornare contenuti, social e lingue.
   ============================================================ */

const CONFIG = {

    /* ── Dati generali ── */
    name:     'Aruta',
    fullName: 'Stefano Aruta',
    year:     2025,

    /* ── Locale per orologio/data ── */
    locales: {
        it: 'it-IT',
        en: 'en-US',
        es: 'es-ES',
        ja: 'ja-JP'
    },

    /* ── Sezioni di navigazione ── */
    sections: [
        { id: 'home',   icon: 'fas fa-hat-wizard'      },
        { id: 'stream', icon: 'fas fa-satellite-dish'  },
        { id: 'links',  icon: 'fas fa-scroll'          }
    ],

    /* ── Testi per lingua ── */
    i18n: {
        it: {
            /* nav */
            nav_home:   'Presentazione',
            nav_stream: 'Stream',
            nav_links:  'Contatti',
            /* home */
            pre: 'Il Mago Errante',
            cls: 'Streamer · Programmatore · Avventuriero',
            bio: 'Mi chiamo Stefano Aruta. Programmatore appassionato, amante di anime, manga, Ultima Online, Minecraft e D&D. Attratto da mondi senza confini dove libertà e creatività regnano sovrane. Ora mi lancio in una nuova avventura: lo streaming.',
            /* stream */
            stream_pre:  'In diretta su',
            stream_desc: 'Gameplay, chiacchiere e avventure fantasy. Attiva le notifiche per non perderti nessuna diretta!',
            stream_note: '📅 Orari variabili — seguimi per aggiornamenti',
            /* links */
            links_pre:   'Trovami su',
            links_desc:  'Tutti i miei canali e profili social in un unico posto.'
        },
        en: {
            nav_home:   'Home',
            nav_stream: 'Stream',
            nav_links:  'Links',
            pre: 'The Wandering Mage',
            cls: 'Streamer · Programmer · Adventurer',
            bio: 'My name is Stefano Aruta. A passionate programmer, lover of anime, manga, Ultima Online, Minecraft and D&D. Drawn to worlds without limits where freedom and creativity reign. Now embarking on a new adventure: streaming.',
            stream_pre:  'Watch me live on',
            stream_desc: 'Gameplay, chats and fantasy adventures. Turn on notifications so you never miss a stream!',
            stream_note: '📅 Varied schedule — follow me for updates',
            links_pre:   'Find me on',
            links_desc:  'All my channels and social profiles in one place.'
        },
        es: {
            nav_home:   'Inicio',
            nav_stream: 'Stream',
            nav_links:  'Links',
            pre: 'El Mago Errante',
            cls: 'Streamer · Programador · Aventurero',
            bio: 'Me llamo Stefano Aruta. Programador apasionado, amante del anime, manga, Ultima Online, Minecraft y D&D. Atraído por mundos sin límites donde reinan la libertad y la creatividad. Ahora me embarco en una nueva aventura: el streaming.',
            stream_pre:  'Sígueme en vivo en',
            stream_desc: '¡Gameplay, charlas y aventuras fantásticas. Activa las notificaciones para no perderte ningún directo!',
            stream_note: '📅 Horario variable — sígueme para actualizaciones',
            links_pre:   'Encuéntrame en',
            links_desc:  'Todos mis canales y perfiles sociales en un solo lugar.'
        },
        ja: {
            nav_home:   'ホーム',
            nav_stream: 'ストリーム',
            nav_links:  'リンク',
            pre: '放浪の魔法使い',
            cls: 'ストリーマー · プログラマー · 冒険者',
            bio: '私はStefano Arutaです。アニメ、マンガ、ウルティマオンライン、マインクラフト、D&Dを愛する情熱的なプログラマー。自由と創造性が支配する限界のない世界に惹かれています。そして今、新たな冒険へ——ストリーミング。',
            stream_pre:  'ライブ配信中',
            stream_desc: 'ゲームプレイ、雑談、ファンタジーの冒険。通知をオンにして配信を見逃さないで！',
            stream_note: '📅 配信スケジュールは不定期 — フォローして最新情報をチェック',
            links_pre:   'フォローはこちら',
            links_desc:  'すべてのチャンネルとSNSプロフィールをまとめました。'
        }
    },

    /* ── Tag / interessi ── */
    tags: [
        { emoji: '🎮', label: 'Ultima Online' },
        { emoji: '⚔️', label: 'D&D'           },
        { emoji: '🌍', label: 'Minecraft'      },
        { emoji: '🌸', label: 'Anime · Manga'  },
        { emoji: '💻', label: 'Programming'    }
    ],

    /* ── Social links ── */
    socials: [
        { id: 'twitch',    url: 'https://twitch.tv/aruta.sh',     icon: 'fab fa-twitch',    label: 'Twitch',    stream: true  },
        { id: 'kick',      url: 'https://kick.com/aruta_sh',      icon: 'kick',             label: 'Kick',      stream: true  },
        { id: 'youtube',   url: 'https://youtube.com/@aruta.sh',  icon: 'fab fa-youtube',   label: 'YouTube',   stream: true  },
        { id: 'instagram', url: 'https://instagram.com/aruta_sr', icon: 'fab fa-instagram', label: 'Instagram', stream: false },
        { id: 'twitter',   url: 'https://twitter.com/aruta.sh',   icon: 'fab fa-twitter',   label: 'Twitter',   stream: false }
    ]

};
