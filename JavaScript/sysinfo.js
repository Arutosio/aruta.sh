/* ════════════════════════════
   SYSTEM INFO PANEL
════════════════════════════ */
function initSysInfo() {
    const btn = document.getElementById('sysinfo-btn');
    const panel = document.getElementById('sysinfo-panel');
    if (!btn || !panel) return;

    let fps = 0;
    let fpsFrames = 0;
    let fpsLast = performance.now();
    function trackFPS() {
        fpsFrames++;
        const now = performance.now();
        if (now - fpsLast >= 1000) {
            fps = fpsFrames;
            fpsFrames = 0;
            fpsLast = now;
        }
        requestAnimationFrame(trackFPS);
    }
    trackFPS();

    let isOpen = false;
    let ipData = null;
    const startTime = Date.now();

    function toggle() {
        if (isOpen) {
            panel.style.animation = 'startMenuClose 0.2s ease forwards';
            setTimeout(() => { panel.style.display = 'none'; panel.style.animation = ''; }, 200);
            isOpen = false;
        } else {
            panel.style.display = 'block';
            panel.style.animation = 'startMenuOpen 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            isOpen = true;
            refreshInfo();
            // Auto-refresh every 1s while open
            if (window._sysInfoInterval) clearInterval(window._sysInfoInterval);
            window._sysInfoInterval = setInterval(() => {
                if (isOpen) refreshInfo();
                else clearInterval(window._sysInfoInterval);
            }, 1000);
        }
    }

    btn.addEventListener('click', toggle);

    document.addEventListener('click', (e) => {
        if (isOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
            toggle();
        }
    });

    async function fetchIP() {
        if (ipData) return ipData;
        try {
            const res = await fetch('https://ipapi.co/json/');
            ipData = await res.json();
        } catch { ipData = {}; }
        return ipData;
    }

    function getPlatform() {
        const ua = navigator.userAgent;
        if (ua.includes('Win')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return navigator.platform || 'Unknown';
    }

    function formatUptime(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return h + 'h ' + (m % 60) + 'm';
        if (m > 0) return m + 'm ' + (s % 60) + 's';
        return s + 's';
    }

    async function refreshInfo() {
        const rows = document.getElementById('sysinfo-rows');
        if (!rows) return;

        const ip = await fetchIP();
        const conn = navigator.connection || {};
        const uptime = formatUptime(Date.now() - startTime);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let batteryInfo = '\u2014';
        try {
            if (navigator.getBattery) {
                const bat = await navigator.getBattery();
                batteryInfo = Math.round(bat.level * 100) + '%' + (bat.charging ? ' \u26a1' : '');
            }
        } catch {}

        const data = [
            { label: 'Status', value: navigator.onLine ? 'Online' : 'Offline', cls: navigator.onLine ? 'green' : 'red' },
            { label: 'IP', value: ip.ip || '\u2014', cls: 'gold' },
            { label: 'Location', value: [ip.city, ip.region, ip.country_name].filter(Boolean).join(', ') || '\u2014', cls: '' },
            { label: 'ISP', value: ip.org || '\u2014', cls: '' },
            { label: 'Battery', value: batteryInfo, cls: 'gold' },
            { label: 'CPU', value: (navigator.hardwareConcurrency || '?') + ' cores', cls: '' },
            { label: 'Memory', value: (navigator.deviceMemory || '?') + ' GB', cls: '' },
            { label: 'Platform', value: getPlatform(), cls: '' },
            { label: 'Viewport', value: window.innerWidth + '\u00d7' + window.innerHeight, cls: '' },
            { label: 'Screen', value: screen.width + '\u00d7' + screen.height + ' @' + devicePixelRatio + 'x', cls: '' },
            { label: 'Locale', value: navigator.language, cls: '' },
            { label: 'Timezone', value: tz, cls: '' },
            { label: 'Network', value: conn.effectiveType ? conn.effectiveType.toUpperCase() + ' (' + (conn.downlink || '?') + ' Mbps)' : '\u2014', cls: '' },
            { label: 'Uptime', value: uptime, cls: 'gold' },
            { label: 'FPS', value: fps + ' fps', cls: fps >= 50 ? 'green' : fps >= 30 ? 'gold' : 'red' },
        ];

        rows.innerHTML = data.map(d =>
            `<div class="sysinfo-row"><span class="sysinfo-label">${d.label}</span><span class="sysinfo-value ${d.cls}">${d.value}</span></div>`
        ).join('');
    }
}
