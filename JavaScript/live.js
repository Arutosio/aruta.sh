/* ════════════════════════════
   LIVE SECTION
════════════════════════════ */
const LIVE_PLATFORMS = {
    twitch: {
        player: (channel) => `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}&muted=true`,
        chat: (channel) => `https://www.twitch.tv/embed/${channel}/chat?parent=${location.hostname}&darkpopout`,
        channel: 'aruta.sh'
    },
    kick: {
        player: (channel) => `https://player.kick.com/${channel}`,
        chat: (channel) => `https://kick.com/${channel}/chatroom`,
        channel: 'aruta_sh'
    },
    youtube: {
        player: (channel) => `https://www.youtube.com/embed/live_stream?channel=${channel}&autoplay=1&mute=1`,
        chat: (channel) => `https://www.youtube.com/live_chat?v=live_stream&embed_domain=${location.hostname}`,
        channel: 'UC_CHANNEL_ID'
    }
};

function initLiveSection() {
    const tabs = document.querySelectorAll('.live-tab');
    const playerEl = document.getElementById('live-player');
    const chatEl = document.getElementById('live-chat');

    if (!tabs.length || !playerEl || !chatEl) return;

    function switchPlatform(platform) {
        const config = LIVE_PLATFORMS[platform];
        if (!config) return;

        // Update tabs
        tabs.forEach(t => t.classList.toggle('active', t.dataset.platform === platform));

        // Update player iframe
        playerEl.innerHTML = `<iframe
            src="${config.player(config.channel)}"
            allowfullscreen
            allow="autoplay; encrypted-media"
            title="${platform} player"
        ></iframe>`;

        // Update chat iframe
        chatEl.innerHTML = `<iframe
            src="${config.chat(config.channel)}"
            title="${platform} chat"
        ></iframe>`;
    }

    // Tab click handlers
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchPlatform(tab.dataset.platform));
    });

    // Initialize with Twitch
    switchPlatform('twitch');
}

/* ════════════════════════════
   STREAM COUNTDOWN
════════════════════════════ */
function initCountdown() {
    const el = document.getElementById('live-countdown');
    if (!el) return;

    // Schedule: Tue 21:00, Thu 21:00, Sat 16:00 (CET = UTC+1, CEST = UTC+2)
    const SCHEDULE = [
        { day: 2, hour: 21, min: 0 },  // Tuesday
        { day: 4, hour: 21, min: 0 },  // Thursday
        { day: 6, hour: 16, min: 0 },  // Saturday
    ];

    function getNextStream() {
        const now = new Date();
        const candidates = [];
        for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
            for (const s of SCHEDULE) {
                const d = new Date(now);
                d.setDate(d.getDate() + ((s.day - d.getDay() + 7) % 7) + weekOffset * 7);
                d.setHours(s.hour, s.min, 0, 0);
                if (d > now) candidates.push(d);
            }
        }
        candidates.sort((a, b) => a - b);
        return candidates[0] || null;
    }

    function update() {
        const next = getNextStream();
        if (!next) { el.textContent = ''; return; }
        const diff = next - Date.now();
        if (diff <= 0) { el.textContent = '\u2726 NOW \u2726'; return; }
        const days = Math.floor(diff / 86400000);
        const hrs  = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);

        let text = '';
        if (days > 0) text += `${days}d `;
        text += `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        el.textContent = text;
    }

    update();
    setInterval(update, 1000);
}
