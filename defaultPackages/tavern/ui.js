// Tavern — full app UI. Adventurer's chat by the firelight.
// Anonymous P2P chat via Trystero (BitTorrent trackers, no backend).

export default {
    async mount(root, ctx) {
        root.innerHTML = `
            <div class="tavern-app">
                <header class="tavern-header">
                    <span class="tavern-title">🍺 <span>Tavern</span></span>
                    <span class="tavern-status" data-status>connecting…</span>
                </header>
                <section class="tavern-settings">
                    <label class="tavern-field">
                        <span>Nickname</span>
                        <input type="text" data-nick maxlength="32" placeholder="WanderingMage123">
                    </label>
                    <label class="tavern-field">
                        <span>Room</span>
                        <input type="text" data-room maxlength="64" placeholder="public">
                    </label>
                </section>
                <ul class="tavern-log" data-log>
                    <li class="tavern-system">Stoke the fire and wait for fellow travelers…</li>
                </ul>
                <form class="tavern-compose" data-compose>
                    <input type="text" data-input maxlength="1000" placeholder="Speak your piece…" autocomplete="off">
                    <button type="submit">Send</button>
                </form>
            </div>
        `;

        const $status = root.querySelector('[data-status]');
        const $log = root.querySelector('[data-log]');
        const $nick = root.querySelector('[data-nick]');
        const $room = root.querySelector('[data-room]');
        const $form = root.querySelector('[data-compose]');
        const $input = root.querySelector('[data-input]');

        const chat = new TavernChat(ctx);

        function append(msg) {
            const li = document.createElement('li');
            li.className = 'tavern-msg' + (msg.self ? ' is-self' : '');
            const time = tavernFmtTime(msg.ts);
            li.innerHTML = `<span class="tavern-msg-head">
                    <span class="tavern-nick" style="color:${tavernEscapeHtml(msg.color)};">${tavernEscapeHtml(msg.nick)}</span>
                    <time>${time}</time>
                </span>
                <span class="tavern-msg-text"></span>`;
            li.querySelector('.tavern-msg-text').textContent = msg.text;
            $log.appendChild(li);
            $log.scrollTop = $log.scrollHeight;
            // Cap visible history to avoid runaway DOM growth.
            while ($log.children.length > 200) $log.removeChild($log.firstChild);
        }

        function appendSystem(text) {
            const li = document.createElement('li');
            li.className = 'tavern-system';
            li.textContent = text;
            $log.appendChild(li);
            $log.scrollTop = $log.scrollHeight;
            while ($log.children.length > 200) $log.removeChild($log.firstChild);
        }

        function refreshStatus() {
            const peers = chat.peerCount;
            $status.textContent = peers === 0
                ? 'alone in the tavern'
                : (peers === 1 ? '1 fellow nearby' : peers + ' fellows nearby');
        }

        try {
            await chat.init();
        } catch (e) {
            $status.textContent = 'connection failed';
            appendSystem('Could not reach the tavern: ' + (e.message || e));
            return;
        }
        $nick.value = chat.nick;
        $room.value = chat.roomName;
        refreshStatus();
        appendSystem('Joined room "' + chat.roomName + '" as ' + chat.nick);

        chat.onMessage(append);
        chat.onPeerJoin((id, count) => { refreshStatus(); appendSystem('A traveler arrives. (' + count + ' nearby)'); });
        chat.onPeerLeave((id, count) => { refreshStatus(); appendSystem('A traveler departs. (' + count + ' nearby)'); });

        $form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = $input.value;
            const sent = chat.send(text);
            if (sent) { append(sent); $input.value = ''; }
        });

        let nickTimer = null;
        $nick.addEventListener('input', () => {
            clearTimeout(nickTimer);
            nickTimer = setTimeout(() => chat.setNick($nick.value), 400);
        });

        let roomTimer = null;
        $room.addEventListener('input', () => {
            clearTimeout(roomTimer);
            roomTimer = setTimeout(async () => {
                const before = chat.roomName;
                await chat.setRoom($room.value);
                if (chat.roomName !== before) {
                    appendSystem('Moved to room "' + chat.roomName + '"');
                    refreshStatus();
                }
            }, 600);
        });

        return {
            async unmount() {
                clearTimeout(nickTimer);
                clearTimeout(roomTimer);
                await chat.destroy();
            }
        };
    },
};
