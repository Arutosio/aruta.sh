/* ════════════════════════════
   EASTER EGG — ARCANE DUEL (5 clicks on ⚜ rune)
════════════════════════════ */
(function initDuelTrigger() {
    let clicks = 0, timer = null;
    document.addEventListener('click', e => {
        if (e.target.closest('.magic-circle-frame')) {
            clicks++;
            clearTimeout(timer);
            timer = setTimeout(() => clicks = 0, 3000); // reset after 3s
            if (clicks >= 7) {
                clicks = 0;
                if (typeof ArcaneDuel !== 'undefined') ArcaneDuel.start();
            }
        }
    });
})();

/* ════════════════════════════
   EASTER EGG — KONAMI CODE
   ↑↑↓↓←→←→BA triggers a golden rune storm
════════════════════════════ */
(function initKonamiEgg() {
    const SEQ = [38,38,40,40,37,39,37,39,66,65]; // ↑↑↓↓←→←→BA
    let pos = 0;
    let eggActive = false;

    document.addEventListener('keydown', e => {
        if (e.keyCode === SEQ[pos]) {
            pos++;
            if (pos === SEQ.length) {
                pos = 0;
                if (!eggActive) triggerRuneStorm();
            }
        } else {
            pos = 0;
        }
    });

    function triggerRuneStorm() {
        unlockAchievement('konami');
        eggActive = true;
        const RUNES = RUNE_SET;
        const COUNT = 120;
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;overflow:hidden;';
        document.body.appendChild(container);

        // Secret message
        const msg = document.createElement('div');
        const eggMessages = {
            it: '✦ Hai trovato l\'incantesimo segreto ✦',
            en: '✦ You found the secret spell ✦',
            es: '✦ Encontraste el hechizo secreto ✦',
            ja: '✦ 秘密の呪文を見つけた ✦',
            fn: '✦ ᛃᛟᚢ ᚠᛟᚢᚾᛞ ᚦᛖ ᛊᛖᚲᚱᛖᛏ ᛊᛈᛖᛚᛚ ✦'
        };
        msg.textContent = eggMessages[currentLang] || eggMessages.en;
        msg.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;
            font-family:'Cinzel',Georgia,serif;font-size:clamp(1.5rem,4vw,2.5rem);
            color:#fff;text-align:center;pointer-events:none;
            text-shadow:0 0 20px rgba(167,139,250,0.8),0 0 50px rgba(167,139,250,0.4),0 0 80px rgba(255,200,87,0.3);
            opacity:0;transition:opacity 0.8s;letter-spacing:0.1em;
        `;
        document.body.appendChild(msg);
        requestAnimationFrame(() => msg.style.opacity = '1');

        // Screen flash
        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;z-index:9997;background:radial-gradient(circle at 50% 50%, rgba(255,200,87,0.15), rgba(167,139,250,0.1));pointer-events:none;transition:opacity 1.5s;';
        document.body.appendChild(flash);

        // Spawn rune rain
        for (let i = 0; i < COUNT; i++) {
            const rune = document.createElement('div');
            const char = RUNES[Math.floor(Math.random() * RUNES.length)];
            const x = Math.random() * 100;
            const size = 14 + Math.random() * 24;
            const dur = 2 + Math.random() * 3;
            const delay = Math.random() * 2;
            const rand = Math.random();
            const color = rand > 0.6 ? '#ffc857' : rand > 0.3 ? '#a78bfa' : '#e8c84a';
            const glow = rand > 0.5 ? 'rgba(255,200,87,0.6)' : 'rgba(167,139,250,0.5)';

            rune.textContent = char;
            rune.style.cssText = `
                position:absolute;top:-5%;left:${x}%;
                font-size:${size}px;color:${color};opacity:0;
                text-shadow:0 0 8px ${glow},0 0 16px ${glow};
                font-family:serif;pointer-events:none;
                animation:eggRuneFall ${dur}s ${delay}s ease-in forwards;
            `;
            container.appendChild(rune);
        }

        // Cleanup after animation
        setTimeout(() => {
            msg.style.opacity = '0';
            flash.style.opacity = '0';
            setTimeout(() => {
                container.remove();
                msg.remove();
                flash.remove();
                eggActive = false;
            }, 1500);
        }, 4500);
    }
})();
