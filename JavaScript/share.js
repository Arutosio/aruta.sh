/* ════════════════════════════
   SHARE BUTTON
════════════════════════════ */
function initShareButton() {
    const btn = document.getElementById('share-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const shareData = {
            title: 'Aruta.sh \u2014 The Wandering Mage',
            text: 'Streamer \u00b7 Programmer \u00b7 Adventurer',
            url: 'https://aruta.sh'
        };

        if (navigator.share) {
            try { await navigator.share(shareData); } catch {}
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(shareData.url);
                btn.classList.add('share-copied');
                setTimeout(() => btn.classList.remove('share-copied'), 2000);
            } catch {}
        }
    });
}
