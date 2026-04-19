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
const TAVERN_STRATEGY_KEY_UI = 'strategy';
const TAVERN_PASSWORD_KEY_UI = 'password';
const TAVERN_SHOW_SYS_KEY    = 'showSystemMsgs';
const TAVERN_SIDE_KEY_UI     = 'sidebarSide';

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
                    <label class="tavern-field">
                        <span>Password (optional)</span>
                        <input type="password" data-password maxlength="128" placeholder="leave empty for a public room">
                        <small class="tavern-field-hint">Only peers using the exact same password land in the same swarm. Anyone without it sees a different "public" room.</small>
                    </label>
                    <input type="hidden" data-strategy value="torrent">
                    <div class="tavern-setup-warning">
                        ⚠ Tavern is peer-to-peer. Your public IP is visible to everyone connected. Avoid sharing sensitive info.
                    </div>
                    <button type="button" class="tavern-join-btn" data-join>Enter the tavern</button>
                </section>

                <div class="tavern-main" data-main style="display:none;">
                    <aside class="tavern-sidebar" data-sidebar>
                        <div class="tavern-side-head">
                            <span class="tavern-side-title">Rooms</span>
                            <button type="button" class="tavern-side-prefs" data-prefs title="Preferences">⚙</button>
                        </div>
                        <ul class="tavern-room-list" data-rooms></ul>
                        <div class="tavern-add-room" data-add>
                            <div class="tavern-add-row">
                                <input type="text" data-add-input maxlength="64" placeholder="+ add room">
                                <button type="button" class="tavern-add-btn" data-add-btn title="Add room">+</button>
                            </div>
                            <input type="password" data-add-pwd maxlength="128" placeholder="password (optional)" class="tavern-add-pwd">
                        </div>
                        <div class="tavern-side-foot">
                            <label class="tavern-field tavern-field-compact">
                                <span>Nick</span>
                                <input type="text" data-nick-live maxlength="32">
                            </label>
                            <input type="hidden" data-strategy-live value="torrent">
                        </div>
                    </aside>

                    <section class="tavern-chat-pane">
                        <div class="tavern-room-banner" data-banner>
                            <span class="tavern-room-name" data-room-name>#</span>
                            <span class="tavern-status" data-status>not connected</span>
                        </div>
                        <ul class="tavern-log" data-log></ul>
                        <div class="tavern-compose" data-compose>
                            <input type="text" data-input maxlength="1000" placeholder="Speak your piece…" autocomplete="off">
                            <button type="button" data-send>Send</button>
                        </div>
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
        const $sendBtn = root.querySelector('[data-send]');
        const $nickSetup = root.querySelector('[data-nick]');
        const $roomSetup = root.querySelector('[data-room]');
        const $strategySetup = root.querySelector('[data-strategy]');
        const $passwordSetup = root.querySelector('[data-password]');
        const $joinBtn = root.querySelector('[data-join]');
        const $nickLive = root.querySelector('[data-nick-live]');
        const $strategyLive = root.querySelector('[data-strategy-live]');
        const $roomsUl = root.querySelector('[data-rooms]');
        const $addBox = root.querySelector('[data-add]');
        const $addInput = root.querySelector('[data-add-input]');
        const $addPwd = root.querySelector('[data-add-pwd]');
        const $addBtn = root.querySelector('[data-add-btn]');
        const $prefsBtn = root.querySelector('[data-prefs]');
        const $roomName = root.querySelector('[data-room-name]');

        const chat = new TavernChat(ctx);
        let connected = false;
        let nickTimer = null;
        let rooms = [];
        let side = 'right';
        let showSystemMsgs = true;
        // Session-only set of rooms the user explicitly disconnected from.
        // Used to paint the status dot red (explicit disconnect) vs grey
        // (never connected this session / idle after switching away).
        const offlineRooms = new Set();

        // Pre-load identity + room bookmarks + sidebar pref so the setup
        // screen and the eventual sidebar both render with saved state.
        await chat.loadProfile();
        rooms = await tavernLoadRooms(ctx);
        if (!rooms.includes(chat.roomName)) rooms.push(chat.roomName);
        side = await tavernLoadSide(ctx);
        $app.dataset.side = side;
        const storedSys = await ctx.storage.get(TAVERN_SHOW_SYS_KEY);
        showSystemMsgs = storedSys !== false; // default true
        $nickSetup.value = chat.nick;
        $roomSetup.value = chat.roomName;
        $strategySetup.value = chat.strategy;
        $passwordSetup.value = chat.password || '';

        function append(msg) {
            const li = document.createElement('li');
            li.className = 'tavern-msg'
                + (msg.self ? ' is-self' : '')
                + (msg.spoofed ? ' is-spoofed' : '')
                + (msg.verified ? ' is-verified' : '');
            const time = tavernFmtTime(msg.ts);
            const check = msg.verified ? '<span class="tavern-msg-check" title="Signature verified">✓</span>' : '';
            li.innerHTML = `<span class="tavern-msg-head">
                    <span class="tavern-nick" style="color:${tavernEscapeHtml(msg.color)};">${tavernEscapeHtml(msg.nick)}</span>
                    <time>${time}${check}</time>
                </span>
                <span class="tavern-msg-text"></span>`;
            li.querySelector('.tavern-msg-text').textContent = msg.text;
            $log.appendChild(li);
            $log.scrollTop = $log.scrollHeight;
            while ($log.children.length > 200) $log.removeChild($log.firstChild);
        }

        function appendSystem(text, kind) {
            if (!showSystemMsgs) return;
            const li = document.createElement('li');
            li.className = 'tavern-system is-' + (kind || 'info');
            li.textContent = text;
            $log.appendChild(li);
            $log.scrollTop = $log.scrollHeight;
            while ($log.children.length > 200) $log.removeChild($log.firstChild);
        }

        // Diagnostic status transitions through phases while waiting for
        // the first peer: connecting → searching → stuck (suggest switch).
        // refreshStatus() takes over once anyone shows up.
        let statusTimers = [];
        function clearStatusTimers() {
            statusTimers.forEach(clearTimeout);
            statusTimers = [];
        }
        function setConnectingStatus() {
            clearStatusTimers();
            $status.textContent = 'connecting via ' + chat.strategy + '…';
            statusTimers.push(setTimeout(() => {
                if (chat.peerCount === 0) $status.textContent = 'searching peers via ' + chat.strategy + '…';
            }, 3000));
            statusTimers.push(setTimeout(() => {
                if (chat.peerCount === 0) $status.textContent = 'still alone — try another strategy below';
            }, 15000));
        }

        function refreshStatus() {
            const peers = chat.peerCount;
            if (peers === 0) {
                // Don't overwrite the diagnostic sequence while it's running.
                if ($status.textContent && $status.textContent.includes('fellow')) {
                    $status.textContent = 'alone in the tavern';
                }
            } else {
                clearStatusTimers();
                $status.textContent = peers === 1 ? '1 fellow nearby' : peers + ' fellows nearby';
            }
            // Re-render the sidebar so the active-room count badge stays in
            // sync as peers join/leave. Cheap (just innerHTML rewrite).
            renderRooms();
        }

        function renderRooms() {
            $roomsUl.innerHTML = '';
            for (const name of rooms) {
                const isActive = name === chat.roomName;
                const isLive = isActive && chat.isConnected;
                const hasPwd = !!(chat.roomPasswords && chat.roomPasswords[name]);
                const li = document.createElement('li');
                li.className = 'tavern-room'
                    + (isActive ? ' is-active' : '')
                    + (isLive ? ' is-live' : ' is-offline');
                li.dataset.room = name;
                const lock = hasPwd ? `<span class="tavern-room-lock" title="Password protected">🔒</span>` : '';
                const countBadge = isLive
                    ? `<button type="button" class="tavern-room-count" data-peers title="Show peers">${chat.peerCount + 1}</button>`
                    : '';
                // Status dot:
                //   green = this row is the live Trystero swarm
                //   red   = user explicitly disconnected from this room
                //   grey  = idle (never connected this session, or switched away)
                const isExplicitOff = offlineRooms.has(name);
                const dotClass = isLive ? ' is-on' : (isExplicitOff ? ' is-off' : '');
                const connLabel = isLive ? 'Disconnect' : 'Connect';
                const connBtn = `<button type="button" class="tavern-room-conn${dotClass}" data-conn title="${connLabel}" aria-label="${connLabel}"></button>`;
                li.innerHTML = `${lock}<span class="tavern-room-hash">#</span><span class="tavern-room-label"></span>${countBadge}${connBtn}<button type="button" class="tavern-room-x" title="Close">×</button>`;
                li.querySelector('.tavern-room-label').textContent = name;
                $roomsUl.appendChild(li);
            }
            const liveMarker = chat.isConnected ? '' : ' (offline)';
            $roomName.textContent = '# ' + chat.roomName + liveMarker;
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
                const blocked = chat.isBlocked(p.peerId);
                li.className = 'tavern-peer' + (p.self ? ' is-self' : '') + (blocked ? ' is-blocked' : '');
                li.innerHTML = `<span class="tavern-peer-nick" style="color:${tavernEscapeHtml(p.color)};"></span><span class="tavern-peer-time"></span>` +
                    (p.self ? '' : `<button type="button" class="tavern-peer-block" data-peer="${tavernEscapeHtml(p.peerId)}" title="${blocked ? 'Unmute' : 'Mute'} this peer">${blocked ? '🔊' : '🔇'}</button>`);
                li.querySelector('.tavern-peer-nick').textContent = p.nick + (p.self ? ' (you)' : '');
                li.querySelector('.tavern-peer-time').textContent = fmtAgo(p.joinedAt) + ' ago';
                ul.appendChild(li);
            }
            ul.addEventListener('click', (e) => {
                const btn = e.target.closest('.tavern-peer-block');
                if (!btn) return;
                const pid = btn.dataset.peer;
                if (chat.isBlocked(pid)) {
                    chat.unblockPeer(pid);
                    appendSystem('Unmuted peer');
                } else {
                    chat.blockPeer(pid);
                    appendSystem('Muted peer — their messages will no longer appear');
                }
                // Refresh the popover so the button state updates.
                showPeersPopover(anchor);
            });
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
            return switchRoomWithPwd(name, undefined);
        }
        async function switchRoomWithPwd(name, pwd) {
            if (!connected || name === chat.roomName) return;
            chat.announcePresence('leave');
            await chat.setRoom(name, pwd);
            if (!rooms.includes(chat.roomName)) {
                rooms.push(chat.roomName);
                rooms = await tavernSaveRooms(ctx, rooms);
            }
            // Target room is now live — can no longer be in the red set.
            offlineRooms.delete(chat.roomName);
            $log.innerHTML = '';
            appendSystem('Moved to room "' + chat.roomName + '"', 'info');
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
            chat.strategy = $strategySetup.value; // picker value
            await ctx.storage.set(TAVERN_STRATEGY_KEY_UI, chat.strategy);
            // Password: apply without triggering an extra reconnect —
            // _connect is about to run anyway.
            chat.password = String($passwordSetup.value || '');
            await ctx.storage.set(TAVERN_PASSWORD_KEY_UI, chat.password);
            try {
                await chat._connect();
            } catch (e) {
                $status.textContent = 'connection failed';
                appendSystem('Could not reach the tavern: ' + (e.message || e), 'error');
                $main.style.display = '';
                $setup.style.display = 'none';
                return;
            }
            connected = true;
            setConnectingStatus();
            $setup.style.display = 'none';
            $main.style.display = '';
            $nickLive.value = chat.nick;
            $strategyLive.value = chat.strategy;
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
                if (info?.nick) appendSystem(info.nick + ' left the tavern', 'warning');
            });
            chat.onPresence(({ type, nick }) => {
                if (type === 'join') appendSystem(nick + ' entered the tavern', 'success');
                else                 appendSystem(nick + ' left the tavern', 'warning');
                refreshStatus();
            });
            chat.onSpoof(({ declared, actual }) => {
                appendSystem('⚠ A peer tried to impersonate "' + declared + '" (real nick: ' + actual + ')', 'error');
            });
            chat.announcePresence('join');
        }

        $joinBtn.addEventListener('click', () => { doJoin(); });

        let warnedEmpty = false;
        async function commitSend() {
            const text = $input.value;
            if (chat.peerCount === 0 && !warnedEmpty && text.trim()) {
                appendSystem('No one else is in this room yet — your message will only reach travelers who join afterwards.', 'warning');
                warnedEmpty = true;
            }
            if (chat.peerCount > 0) warnedEmpty = false;
            const sent = await chat.send(text);
            if (sent) { append(sent); $input.value = ''; }
        }
        $sendBtn.addEventListener('click', () => { commitSend(); });
        $input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitSend();
            }
        });

        $nickLive.addEventListener('input', () => {
            clearTimeout(nickTimer);
            nickTimer = setTimeout(() => chat.setNick($nickLive.value), 400);
        });

        $strategyLive.addEventListener('change', async () => {
            if (!connected) return;
            const newStrat = $strategyLive.value;
            if (newStrat === chat.strategy) return;
            chat.announcePresence('leave');
            await chat.setStrategy(newStrat);
            $log.innerHTML = '';
            appendSystem('Reconnected via ' + chat.strategy);
            setConnectingStatus();
            chat.announcePresence('join');
            renderRooms();
        });

        $roomsUl.addEventListener('click', async (e) => {
            const peers = e.target.closest('.tavern-room-count');
            if (peers) {
                e.stopPropagation();
                showPeersPopover(peers);
                return;
            }
            const conn = e.target.closest('.tavern-room-conn');
            if (conn) {
                e.stopPropagation();
                const li = conn.closest('.tavern-room');
                if (!li) return;
                const name = li.dataset.room;
                const isActive = name === chat.roomName;
                if (isActive && chat.isConnected) {
                    // Explicit disconnect — mark the room red so the user
                    // can see it's intentionally off, not just idle.
                    await chat.disconnect();
                    offlineRooms.add(name);
                    appendSystem('Disconnected from "' + name + '"', 'warning');
                } else if (isActive && !chat.isConnected) {
                    try {
                        await chat.reconnect();
                        offlineRooms.delete(name);
                        appendSystem('Reconnected to "' + name + '"', 'success');
                    } catch (err) {
                        appendSystem('Could not reconnect: ' + (err.message || err), 'error');
                    }
                } else {
                    // Connect to a different bookmarked room. Any currently
                    // live room flips to idle (grey), not red — the user
                    // didn't disconnect it, they moved on.
                    if (chat.isConnected) await chat.disconnect();
                    await chat.setRoom(name);
                    offlineRooms.delete(name);
                    $log.innerHTML = '';
                    appendSystem('Moved to room "' + chat.roomName + '"', 'info');
                    chat.announcePresence('join');
                }
                renderRooms();
                refreshStatus();
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

        // Iframe sandbox doesn't carry `allow-forms`, so we drive the
        // add-room flow with a button + manual Enter key handling instead
        // of a <form> submit. Avoids silently swallowed events.
        async function commitAddRoom() {
            const name = ($addInput.value || '').trim().slice(0, 64);
            if (!name) return;
            const pwd = $addPwd ? ($addPwd.value || '') : '';
            $addInput.value = '';
            if ($addPwd) $addPwd.value = '';
            const wasNew = !rooms.includes(name);
            if (wasNew) {
                rooms.push(name);
                rooms = await tavernSaveRooms(ctx, rooms);
            }
            // Always persist the password the user typed for this room (empty
            // string clears any previous one).
            if ($addPwd) {
                chat.roomPasswords[name] = pwd;
                chat.roomPasswords = await tavernSaveRoomPwds(ctx, chat.roomPasswords);
            }
            if (name === chat.roomName) {
                // Already in that room but password may have changed — reconnect
                // via setRoom which picks up the new pwd and rebuilds the swarm.
                if (pwd !== (chat.password || '')) {
                    await chat.setRoom(name, pwd);
                    $log.innerHTML = '';
                    appendSystem('Password updated — reconnected to "' + name + '"', 'info');
                } else {
                    appendSystem(wasNew ? 'Bookmarked "' + name + '" (already here)' : 'Already in "' + name + '"', 'info');
                }
                renderRooms();
                return;
            }
            await switchRoomWithPwd(name, pwd);
        }
        $addBtn.addEventListener('click', () => { commitAddRoom(); });
        $addInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitAddRoom();
            }
        });

        // Preferences popover anchored under the gear button.
        function closePrefsPopover() {
            const existing = document.querySelector('.tavern-prefs-popover');
            if (existing) existing.remove();
        }
        function openPrefsPopover() {
            closePrefsPopover();
            const pop = document.createElement('div');
            pop.className = 'tavern-prefs-popover';
            pop.innerHTML = `
                <div class="tavern-prefs-head">Preferences</div>
                <div class="tavern-prefs-section">
                    <label class="tavern-prefs-label">Sidebar side</label>
                    <div class="tavern-prefs-btn-group" data-side-group>
                        <button type="button" data-side-choice="left"${side === 'left' ? ' class="is-active"' : ''}>Left</button>
                        <button type="button" data-side-choice="right"${side === 'right' ? ' class="is-active"' : ''}>Right</button>
                    </div>
                </div>
                <div class="tavern-prefs-section">
                    <label class="tavern-prefs-label">Signaling strategy</label>
                    <div class="tavern-prefs-readonly">${tavernEscapeHtml(chat.strategy)} <small>(only option available)</small></div>
                </div>
                <div class="tavern-prefs-section">
                    <label class="tavern-prefs-row">
                        <span>Show activity messages</span>
                        <input type="checkbox" data-show-sys${showSystemMsgs ? ' checked' : ''}>
                    </label>
                    <small class="tavern-prefs-hint">Joins, leaves, warnings, moved rooms, etc.</small>
                </div>
                <div class="tavern-prefs-section">
                    <label class="tavern-prefs-label">Identity</label>
                    <div class="tavern-prefs-readonly">Nick: <strong>${tavernEscapeHtml(chat.nick)}</strong></div>
                    <div class="tavern-prefs-readonly">Key thumbprint: <code>${tavernEscapeHtml((chat.selfThumbprint || '').slice(0, 16))}…</code></div>
                </div>
                <div class="tavern-prefs-section">
                    <button type="button" class="tavern-prefs-close" data-close>Close</button>
                </div>
            `;
            const r = $prefsBtn.getBoundingClientRect();
            pop.style.position = 'fixed';
            pop.style.left = Math.min(window.innerWidth - 260, r.left) + 'px';
            pop.style.top = (r.bottom + 6) + 'px';
            document.body.appendChild(pop);

            pop.querySelectorAll('[data-side-choice]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const next = btn.dataset.sideChoice;
                    if (next === side) return;
                    side = next;
                    $app.dataset.side = side;
                    await tavernSaveSide(ctx, side);
                    pop.querySelectorAll('[data-side-choice]').forEach(b =>
                        b.classList.toggle('is-active', b.dataset.sideChoice === side));
                });
            });
            pop.querySelector('[data-show-sys]').addEventListener('change', async (e) => {
                showSystemMsgs = e.target.checked;
                await ctx.storage.set(TAVERN_SHOW_SYS_KEY, showSystemMsgs);
            });
            pop.querySelector('[data-close]').addEventListener('click', closePrefsPopover);

            const offClick = (e) => {
                if (pop.contains(e.target) || $prefsBtn.contains(e.target)) return;
                closePrefsPopover();
                document.removeEventListener('mousedown', offClick);
            };
            setTimeout(() => document.addEventListener('mousedown', offClick), 0);
        }
        $prefsBtn.addEventListener('click', () => {
            if (document.querySelector('.tavern-prefs-popover')) closePrefsPopover();
            else openPrefsPopover();
        });

        return {
            async unmount() {
                clearTimeout(nickTimer);
                clearStatusTimers();
                if (!connected) return;
                if (!(await widgetIsAlive())) {
                    chat.announcePresence('leave');
                }
                await chat.destroy();
            }
        };
    },
};
