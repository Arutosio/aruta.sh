// Tavern — full app UI. Adventurer's chat by the firelight.
// Anonymous P2P chat via Trystero (BitTorrent trackers, no backend).
//
// Layout:
//   [Setup screen] -> click "Enter the tavern" -> [Main view]
//   Main view = sidebar (room bookmarks) + chat pane.
//   Sidebar position is user-configurable (left/right) and persists
//   in ctx.storage. One room is active at a time; switching tears
//   down the current Trystero connection and joins the new one.

const TAVERN_WIDGET_ALIVE_KEY = '_widgetAlive';
const TAVERN_WIDGET_FRESH_MS = 20000;

export default {
    async mount(root, ctx) {
        root.innerHTML = `
            <div class="tavern-app" data-side="left">
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

                <div class="tavern-main" data-main style="display:none;">
                    <aside class="tavern-sidebar" data-sidebar>
                        <div class="tavern-side-head">
                            <span class="tavern-side-title">Rooms</span>
                            <button type="button" class="tavern-side-flip" data-flip title="Move sidebar">⇄</button>
                        </div>
                        <ul class="tavern-room-list" data-rooms></ul>
                        <form class="tavern-add-room" data-add>
                            <input type="text" data-add-input maxlength="64" placeholder="+ add room">
                        </form>
                        <div class="tavern-side-foot">
                            <label class="tavern-field tavern-field-compact">
                                <span>Nick</span>
                                <input type="text" data-nick-live maxlength="32">
                            </label>
                        </div>
                    </aside>

                    <section class="tavern-chat-pane">
                        <div class="tavern-room-banner" data-banner>
                            <span class="tavern-room-name" data-room-name>#</span>
                            <span class="tavern-status" data-status>not connected</span>
                        </div>
                        <ul class="tavern-log" data-log></ul>
                        <form class="tavern-compose" data-compose>
                            <input type="text" data-input maxlength="1000" placeholder="Speak your piece…" autocomplete="off">
                            <button type="submit">Send</button>
                        </form>
                    </section>
                </div>
            </div>
        `;

        const $app = root.querySelector('.tavern-app');
        const $status = root.querySelector('[data-status]');
        const $setup = root.querySelector('[data-setup]');
        const $main = root.querySelector('[data-main]');
        const $log = root.querySelector('[data-log]');
        const $form = root.querySelector('[data-compose]');
        const $input = root.querySelector('[data-input]');
        const $nickSetup = root.querySelector('[data-nick]');
        const $roomSetup = root.querySelector('[data-room]');
        const $joinBtn = root.querySelector('[data-join]');
        const $nickLive = root.querySelector('[data-nick-live]');
        const $roomsUl = root.querySelector('[data-rooms]');
        const $addForm = root.querySelector('[data-add]');
        const $addInput = root.querySelector('[data-add-input]');
        const $flipBtn = root.querySelector('[data-flip]');
        const $roomName = root.querySelector('[data-room-name]');

        const chat = new TavernChat(ctx);
        let connected = false;
        let nickTimer = null;
        let rooms = [];
        let side = 'left';

        // Pre-load identity + room bookmarks + sidebar pref so the setup
        // screen and the eventual sidebar both render with saved state.
        await chat.loadProfile();
        rooms = await tavernLoadRooms(ctx);
        if (!rooms.includes(chat.roomName)) rooms.push(chat.roomName);
        side = await tavernLoadSide(ctx);
        $app.dataset.side = side;
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
            // Re-render the sidebar so the active-room count badge stays in
            // sync as peers join/leave. Cheap (just innerHTML rewrite).
            renderRooms();
        }

        function renderRooms() {
            $roomsUl.innerHTML = '';
            for (const name of rooms) {
                const isActive = name === chat.roomName;
                const li = document.createElement('li');
                li.className = 'tavern-room' + (isActive ? ' is-active' : '');
                li.dataset.room = name;
                // Active room shows a peer-count badge (self + remote peers).
                // Click on the badge opens the peer list popover.
                const countBadge = isActive
                    ? `<button type="button" class="tavern-room-count" data-peers title="Show peers">${chat.peerCount + 1}</button>`
                    : '';
                li.innerHTML = `<span class="tavern-room-hash">#</span><span class="tavern-room-label"></span>${countBadge}<button type="button" class="tavern-room-x" title="Close">×</button>`;
                li.querySelector('.tavern-room-label').textContent = name;
                $roomsUl.appendChild(li);
            }
            $roomName.textContent = '# ' + chat.roomName;
        }

        function fmtAgo(ts) {
            const sec = Math.max(1, Math.floor((Date.now() - Number(ts)) / 1000));
            if (sec < 60) return sec + 's';
            const min = Math.floor(sec / 60);
            if (min < 60) return min + 'm';
            const h = Math.floor(min / 60);
            return h + 'h ' + (min % 60) + 'm';
        }

        function closePeersPopover() {
            const existing = document.querySelector('.tavern-peers-popover');
            if (existing) existing.remove();
        }

        function showPeersPopover(anchor) {
            closePeersPopover();
            const peers = chat.getPeers();
            const pop = document.createElement('div');
            pop.className = 'tavern-peers-popover';
            pop.innerHTML = `<div class="tavern-peers-head">In # ${tavernEscapeHtml(chat.roomName)} (${peers.length})</div><ul class="tavern-peers-list"></ul>`;
            const ul = pop.querySelector('.tavern-peers-list');
            for (const p of peers) {
                const li = document.createElement('li');
                li.className = 'tavern-peer' + (p.self ? ' is-self' : '');
                li.innerHTML = `<span class="tavern-peer-nick" style="color:${tavernEscapeHtml(p.color)};"></span><span class="tavern-peer-time"></span>`;
                li.querySelector('.tavern-peer-nick').textContent = p.nick + (p.self ? ' (you)' : '');
                li.querySelector('.tavern-peer-time').textContent = fmtAgo(p.joinedAt) + ' ago';
                ul.appendChild(li);
            }
            // Anchor to the badge inside the room list.
            const r = anchor.getBoundingClientRect();
            pop.style.position = 'fixed';
            pop.style.left = Math.min(window.innerWidth - 220, r.left) + 'px';
            pop.style.top = (r.bottom + 6) + 'px';
            document.body.appendChild(pop);
            // Close on outside click.
            const offClick = (e) => {
                if (pop.contains(e.target) || anchor.contains(e.target)) return;
                closePeersPopover();
                document.removeEventListener('mousedown', offClick);
            };
            setTimeout(() => document.addEventListener('mousedown', offClick), 0);
        }

        async function widgetIsAlive() {
            try {
                const ts = await ctx.storage.get(TAVERN_WIDGET_ALIVE_KEY);
                return Number(ts) > 0 && (Date.now() - Number(ts)) < TAVERN_WIDGET_FRESH_MS;
            } catch { return false; }
        }

        async function switchRoom(name) {
            if (!connected || name === chat.roomName) return;
            chat.announcePresence('leave');
            await chat.setRoom(name);
            // Bookmark the room if new.
            if (!rooms.includes(chat.roomName)) {
                rooms.push(chat.roomName);
                rooms = await tavernSaveRooms(ctx, rooms);
            }
            $log.innerHTML = '';
            appendSystem('Moved to room "' + chat.roomName + '"');
            chat.announcePresence('join');
            renderRooms();
            refreshStatus();
        }

        async function removeRoom(name) {
            const isActive = name === chat.roomName;
            if (!isActive) {
                // Just unpin the bookmark.
                rooms = rooms.filter(r => r !== name);
                rooms = await tavernSaveRooms(ctx, rooms);
                renderRooms();
                return;
            }
            // Active room — leave broadcast first, then drop the bookmark.
            // If other rooms remain, hop to the first one; otherwise return
            // to the setup screen so the user can pick a fresh entry.
            chat.announcePresence('leave');
            const remaining = rooms.filter(r => r !== name);
            if (remaining.length > 0) {
                rooms = remaining;
                rooms = await tavernSaveRooms(ctx, rooms);
                await chat.setRoom(rooms[0]);
                $log.innerHTML = '';
                appendSystem('Moved to room "' + chat.roomName + '"');
                chat.announcePresence('join');
                renderRooms();
                refreshStatus();
            } else {
                await chat.destroy();
                connected = false;
                $log.innerHTML = '';
                $main.style.display = 'none';
                $setup.style.display = '';
                $status.textContent = 'not connected';
                rooms = await tavernSaveRooms(ctx, []); // reset to default ['public']
            }
        }

        async function doJoin() {
            await chat.setNick($nickSetup.value);
            await chat.setRoom($roomSetup.value);
            try {
                await chat._connect();
            } catch (e) {
                $status.textContent = 'connection failed';
                appendSystem('Could not reach the tavern: ' + (e.message || e));
                $main.style.display = '';
                $setup.style.display = 'none';
                return;
            }
            connected = true;
            $setup.style.display = 'none';
            $main.style.display = '';
            $nickLive.value = chat.nick;
            // Make sure the chosen room is bookmarked.
            if (!rooms.includes(chat.roomName)) rooms.push(chat.roomName);
            rooms = await tavernSaveRooms(ctx, rooms);
            renderRooms();
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

        let warnedEmpty = false;
        $form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = $input.value;
            // Warn the user once per empty-room session that no one is
            // listening yet — Trystero send is fire-and-forget, so an
            // unattended room silently swallows everything otherwise.
            if (chat.peerCount === 0 && !warnedEmpty && text.trim()) {
                appendSystem('No one else is in this room yet — your message will only reach travelers who join afterwards.');
                warnedEmpty = true;
            }
            if (chat.peerCount > 0) warnedEmpty = false; // reset if peers arrived
            const sent = chat.send(text);
            if (sent) { append(sent); $input.value = ''; }
        });

        $nickLive.addEventListener('input', () => {
            clearTimeout(nickTimer);
            nickTimer = setTimeout(() => chat.setNick($nickLive.value), 400);
        });

        $roomsUl.addEventListener('click', (e) => {
            const peers = e.target.closest('.tavern-room-count');
            if (peers) {
                e.stopPropagation();
                showPeersPopover(peers);
                return;
            }
            const x = e.target.closest('.tavern-room-x');
            if (x) {
                e.stopPropagation();
                const li = x.closest('.tavern-room');
                if (li) removeRoom(li.dataset.room);
                return;
            }
            const li = e.target.closest('.tavern-room');
            if (li) switchRoom(li.dataset.room);
        });

        $addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = ($addInput.value || '').trim().slice(0, 64);
            if (!name) return;
            $addInput.value = '';
            const wasNew = !rooms.includes(name);
            if (wasNew) {
                rooms.push(name);
                rooms = await tavernSaveRooms(ctx, rooms);
            }
            // Already on it? Just confirm — no reconnect needed.
            if (name === chat.roomName) {
                renderRooms();
                appendSystem(wasNew ? 'Bookmarked "' + name + '" (already here)' : 'Already in "' + name + '"');
                return;
            }
            await switchRoom(name);
        });

        $flipBtn.addEventListener('click', async () => {
            side = side === 'left' ? 'right' : 'left';
            $app.dataset.side = side;
            await tavernSaveSide(ctx, side);
        });

        return {
            async unmount() {
                clearTimeout(nickTimer);
                if (!connected) return;
                if (!(await widgetIsAlive())) {
                    chat.announcePresence('leave');
                }
                await chat.destroy();
            }
        };
    },
};
