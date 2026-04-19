// Tavern — full app UI. Adventurer's chat by the firelight.
// Anonymous P2P chat via Trystero (BitTorrent trackers, no backend).
//
// Flow:
//   1. mount() shows a setup screen (nickname + room) — no auto-join,
//      so the user can pick a name before any message is broadcast.
//   2. "Enter the tavern" button triggers chat.init() and announces a
//      presence:join so other peers see "X joined".
//   3. unmount() announces presence:leave UNLESS the widget heartbeat
//      shows the user is still listening through the pinned widget.

const TAVERN_WIDGET_ALIVE_KEY = '_widgetAlive';
const TAVERN_WIDGET_FRESH_MS = 20000; // widget alive flag must be this recent

export default {
    async mount(root, ctx) {
        root.innerHTML = `
            <div class="tavern-app">
                <header class="tavern-header">
                    <span class="tavern-title">🍺 <span>Tavern</span></span>
                    <span class="tavern-status" data-status>not connected</span>
                </header>

                <section class="tavern-setup" data-setup>
                    <p class="tavern-setup-blurb">
                        An anonymous, peer-to-peer common room. No accounts, no servers — just travelers.
                        Pick a name and a room before pushing through the door.
                    </p>
                    <label class="tavern-field">
                        <span>Nickname</span>
                        <input type="text" data-nick maxlength="32" placeholder="WanderingMage123">
                    </label>
                    <label class="tavern-field">
                        <span>Room</span>
                        <input type="text" data-room maxlength="64" placeholder="public">
                    </label>
                    <button type="button" class="tavern-join-btn" data-join>Enter the tavern</button>
                </section>

                <ul class="tavern-log" data-log style="display:none;"></ul>

                <section class="tavern-settings" data-settings style="display:none;">
                    <label class="tavern-field">
                        <span>Nickname</span>
                        <input type="text" data-nick-live maxlength="32">
                    </label>
                    <label class="tavern-field">
                        <span>Room</span>
                        <input type="text" data-room-live maxlength="64">
                    </label>
                    <button type="button" class="tavern-leave-btn" data-leave>Leave</button>
                </section>

                <form class="tavern-compose" data-compose style="display:none;">
                    <input type="text" data-input maxlength="1000" placeholder="Speak your piece…" autocomplete="off">
                    <button type="submit">Send</button>
                </form>
            </div>
        `;

        const $status = root.querySelector('[data-status]');
        const $setup = root.querySelector('[data-setup]');
        const $settings = root.querySelector('[data-settings]');
        const $log = root.querySelector('[data-log]');
        const $form = root.querySelector('[data-compose]');
        const $input = root.querySelector('[data-input]');
        const $nickSetup = root.querySelector('[data-nick]');
        const $roomSetup = root.querySelector('[data-room]');
        const $joinBtn = root.querySelector('[data-join]');
        const $nickLive = root.querySelector('[data-nick-live]');
        const $roomLive = root.querySelector('[data-room-live]');
        const $leaveBtn = root.querySelector('[data-leave]');

        const chat = new TavernChat(ctx);
        let connected = false;
        let nickTimer = null, roomTimer = null;

        // Pre-load saved profile so the setup inputs are pre-filled.
        await chat.loadProfile();
        $nickSetup.value = chat.nick;
        $roomSetup.value = chat.roomName;

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

        async function widgetIsAlive() {
            try {
                const ts = await ctx.storage.get(TAVERN_WIDGET_ALIVE_KEY);
                return Number(ts) > 0 && (Date.now() - Number(ts)) < TAVERN_WIDGET_FRESH_MS;
            } catch { return false; }
        }

        async function doJoin() {
            // Persist the chosen identity before connecting.
            await chat.setNick($nickSetup.value);
            await chat.setRoom($roomSetup.value);
            try {
                await chat._connect();
            } catch (e) {
                $status.textContent = 'connection failed';
                appendSystem('Could not reach the tavern: ' + (e.message || e));
                $log.style.display = '';
                return;
            }
            connected = true;
            $setup.style.display = 'none';
            $log.style.display = '';
            $settings.style.display = '';
            $form.style.display = '';
            $nickLive.value = chat.nick;
            $roomLive.value = chat.roomName;
            refreshStatus();
            appendSystem('You entered "' + chat.roomName + '" as ' + chat.nick);

            chat.onMessage(append);
            chat.onPeerJoin(refreshStatus);
            chat.onPeerLeave((id, count, info) => {
                refreshStatus();
                if (info?.nick) appendSystem(info.nick + ' left the tavern');
            });
            chat.onPresence(({ type, nick }) => {
                if (type === 'join') appendSystem(nick + ' entered the tavern');
                else                 appendSystem(nick + ' left the tavern');
                refreshStatus();
            });
            chat.announcePresence('join');
        }

        $joinBtn.addEventListener('click', () => { doJoin(); });

        $form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = $input.value;
            const sent = chat.send(text);
            if (sent) { append(sent); $input.value = ''; }
        });

        $nickLive.addEventListener('input', () => {
            clearTimeout(nickTimer);
            nickTimer = setTimeout(() => chat.setNick($nickLive.value), 400);
        });

        $roomLive.addEventListener('input', () => {
            clearTimeout(roomTimer);
            roomTimer = setTimeout(async () => {
                if (!connected) return;
                const before = chat.roomName;
                // Announce leave on the OLD room before reconnecting.
                chat.announcePresence('leave');
                await chat.setRoom($roomLive.value);
                if (chat.roomName !== before) {
                    appendSystem('Moved to room "' + chat.roomName + '"');
                    chat.announcePresence('join');
                    refreshStatus();
                }
            }, 600);
        });

        $leaveBtn.addEventListener('click', async () => {
            if (!connected) return;
            chat.announcePresence('leave');
            await chat.destroy();
            connected = false;
            $log.innerHTML = '';
            $log.style.display = 'none';
            $settings.style.display = 'none';
            $form.style.display = 'none';
            $setup.style.display = '';
            $status.textContent = 'not connected';
        });

        return {
            async unmount() {
                clearTimeout(nickTimer);
                clearTimeout(roomTimer);
                if (!connected) return;
                // Suppress the "left" broadcast when the widget is still
                // alive — the user is staying in the room through it.
                if (!(await widgetIsAlive())) {
                    chat.announcePresence('leave');
                }
                await chat.destroy();
            }
        };
    },
};
