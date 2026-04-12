/* ════════════════════════════
   AMBIENT SOUND (Web Audio API)
════════════════════════════ */
function initAmbientSound() {
    const btn = document.getElementById('sound-btn');
    const icon = document.getElementById('sound-icon');
    if (!btn || !icon) return;

    let audioCtx = null;
    let playing = false;
    let nodes = [];

    function createDrone() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Deep drone — mystical hum
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 55; // A1 — deep bass
        gain1.gain.value = 0.04;
        osc1.connect(gain1).connect(audioCtx.destination);

        // Higher harmonic
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 165; // E3
        gain2.gain.value = 0.015;
        osc2.connect(gain2).connect(audioCtx.destination);

        // Very subtle shimmer
        const osc3 = audioCtx.createOscillator();
        const gain3 = audioCtx.createGain();
        osc3.type = 'triangle';
        osc3.frequency.value = 440; // A4
        gain3.gain.value = 0.005;
        // LFO for shimmer
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 0.3;
        lfoGain.gain.value = 0.003;
        lfo.connect(lfoGain).connect(gain3.gain);
        lfo.start();
        osc3.connect(gain3).connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc3.start();

        nodes = [osc1, osc2, osc3, lfo, gain1, gain2, gain3, lfoGain];
    }

    function stopDrone() {
        nodes.forEach(n => { try { n.stop?.(); n.disconnect(); } catch {} });
        nodes = [];
    }

    btn.addEventListener('click', () => {
        if (playing) {
            stopDrone();
            icon.className = 'fas fa-volume-mute';
            playing = false;
        } else {
            createDrone();
            icon.className = 'fas fa-volume-up';
            playing = true;
        }
    });
}
