// Tavern widget — compact chat pinned on the desktop.
// Uses the same TavernChat helper as the full app, so opening both keeps
// them in lockstep on nickname / room (shared via ctx.storage).

export default {
    async mount(root, ctx) {
        root.innerHTML = `
            <div class="tavern-widget">
                <div class="tavern-widget-status" data-status>connecting…</div>
                <ul class="tavern-widget-log" data-log></ul>
                <form class="tavern-widget-compose" data-compose>
                    <input type="text" data-input maxlength="500" placeholder="Speak…" autocomplete="off">
                </form>
            </div>
        `;
        const $status = root.querySelector('[data-status]');
        const $log = root.querySelector('[data-log]');
        const $form = root.querySelector('[data-compose]');
        const $input = root.querySelector('[data-input]');

        const chat = new TavernChat(ctx);

        function append(msg) {
            const li = document.createElement('li');
            li.className = 'tavern-widget-msg' + (msg.self ? ' is-self' : '');
            li.innerHTML = `<span class="tavern-widget-nick" style="color:${tavernEscapeHtml(msg.color)};">${tavernEscapeHtml(msg.nick)}</span><span class="tavern-widget-text"></span>`;
            li.querySelector('.tavern-widget-text').textContent = msg.text;
            $log.appendChild(li);
            $log.scrollTop = $log.scrollHeight;
            // Mini view keeps only the last ~20 entries.
            while ($log.children.length > 20) $log.removeChild($log.firstChild);
        }

        function refreshStatus() {
            $status.textContent = chat.roomName + ' · ' + (chat.peerCount === 0 ? 'no one' : chat.peerCount + ' nearby');
        }

        try {
            await chat.init();
        } catch (e) {
            $status.textContent = 'offline';
            return;
        }
        refreshStatus();

        chat.onMessage(append);
        chat.onPeerJoin(refreshStatus);
        chat.onPeerLeave(refreshStatus);

        $form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = $input.value;
            const sent = chat.send(text);
            if (sent) { append(sent); $input.value = ''; }
        });

        return {
            async unmount() {
                await chat.destroy();
            }
        };
    },
};
