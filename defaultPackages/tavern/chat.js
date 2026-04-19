// Tavern chat helper — wraps Trystero P2P signaling so ui.js and widget.js
// share one connection logic. Bundled inline by the host iframe loader.
// Trystero exposes joinRoom/selfId via globalThis.__trystero (added at the
// end of trystero.min.js after we strip the ESM exports).

const TAVERN_APP_ID = 'aruta-tavern';
const TAVERN_DEFAULT_ROOM = 'public';
const TAVERN_NICK_KEY = 'nickname';
const TAVERN_NICK_COLOR_KEY = 'nickColor';
const TAVERN_ROOM_KEY = 'room';
const TAVERN_ROOMS_KEY = 'rooms';
const TAVERN_SIDE_KEY = 'sidebarSide';
const TAVERN_STRATEGY_KEY = 'strategy';
const TAVERN_STRATEGIES = ['torrent', 'nostr', 'mqtt'];
const TAVERN_STRATEGY_DEFAULT = 'torrent';
const TAVERN_PASSWORD_KEY = 'password';
const TAVERN_RATE_LIMIT_MS = 200;   // drop msgs from same peer faster than this

async function tavernLoadRooms(ctx) {
    const stored = await ctx.storage.get(TAVERN_ROOMS_KEY);
    if (Array.isArray(stored) && stored.every(r => typeof r === 'string')) return stored;
    return [TAVERN_DEFAULT_ROOM];
}

async function tavernSaveRooms(ctx, rooms) {
    const cleaned = Array.from(new Set(
        rooms.map(r => String(r || '').trim().slice(0, 64)).filter(Boolean)
    ));
    if (cleaned.length === 0) cleaned.push(TAVERN_DEFAULT_ROOM);
    await ctx.storage.set(TAVERN_ROOMS_KEY, cleaned);
    return cleaned;
}

async function tavernLoadSide(ctx) {
    const s = await ctx.storage.get(TAVERN_SIDE_KEY);
    return s === 'right' ? 'right' : 'left';
}

async function tavernSaveSide(ctx, side) {
    await ctx.storage.set(TAVERN_SIDE_KEY, side === 'right' ? 'right' : 'left');
}

function tavernRandNick() {
    const adj = ['Wandering', 'Mystic', 'Silent', 'Lone', 'Crimson', 'Frost', 'Shadow', 'Iron', 'Wild', 'Old'];
    const noun = ['Mage', 'Bard', 'Druid', 'Knight', 'Rogue', 'Seer', 'Smith', 'Wraith', 'Pilgrim', 'Sage'];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    const num = Math.floor(Math.random() * 900 + 100);
    return a + n + num;
}

function tavernNickColor(nick) {
    // Stable HSL hue derived from nick — same nick always gets same color.
    let h = 0;
    for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ', 70%, 65%)';
}

function tavernEscapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

function tavernFmtTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
}

class TavernChat {
    constructor(ctx) {
        this.ctx = ctx;
        this.room = null;
        this.sendMsg = null;
        this.getMsg = null;
        this.onPeerJoinCb = null;
        this.onPeerLeaveCb = null;
        this.onMessageCb = null;
        this.onSpoofCb = null;
        this.peerCount = 0;
        this.nick = '';
        this.color = '';
        this.roomName = TAVERN_DEFAULT_ROOM;
        this.password = '';
        // Per-session security state (cleared on room/strategy change).
        this.peerFirstNick = new Map();   // peerId -> first declared nick
        this.peerLastMsgTs = new Map();   // peerId -> last msg timestamp
        this.blockedPeers = new Set();    // peerIds user has muted
    }

    async loadProfile() {
        let nick = await this.ctx.storage.get(TAVERN_NICK_KEY);
        if (!nick) {
            nick = tavernRandNick();
            await this.ctx.storage.set(TAVERN_NICK_KEY, nick);
        }
        this.nick = nick;
        let color = await this.ctx.storage.get(TAVERN_NICK_COLOR_KEY);
        if (!color) {
            color = tavernNickColor(nick);
            await this.ctx.storage.set(TAVERN_NICK_COLOR_KEY, color);
        }
        this.color = color;
        const room = await this.ctx.storage.get(TAVERN_ROOM_KEY);
        if (room) this.roomName = room;
        const strategy = await this.ctx.storage.get(TAVERN_STRATEGY_KEY);
        this.strategy = TAVERN_STRATEGIES.includes(strategy) ? strategy : TAVERN_STRATEGY_DEFAULT;
        const pwd = await this.ctx.storage.get(TAVERN_PASSWORD_KEY);
        this.password = typeof pwd === 'string' ? pwd : '';
    }

    async setPassword(pwd) {
        const trimmed = String(pwd || '');
        if (trimmed === this.password) return;
        this.password = trimmed;
        await this.ctx.storage.set(TAVERN_PASSWORD_KEY, trimmed);
        if (this.room) {
            try { await this.room.leave(); } catch (_) {}
        }
        await this._connect();
    }

    blockPeer(peerId) {
        if (peerId && peerId !== 'self') this.blockedPeers.add(peerId);
    }
    unblockPeer(peerId) { this.blockedPeers.delete(peerId); }
    isBlocked(peerId)   { return this.blockedPeers.has(peerId); }

    async setStrategy(name) {
        const trimmed = TAVERN_STRATEGIES.includes(name) ? name : TAVERN_STRATEGY_DEFAULT;
        if (trimmed === this.strategy) return;
        this.strategy = trimmed;
        await this.ctx.storage.set(TAVERN_STRATEGY_KEY, trimmed);
        if (this.room) {
            try { await this.room.leave(); } catch (_) {}
        }
        await this._connect();
    }

    async setNick(newNick) {
        const trimmed = String(newNick || '').trim().slice(0, 32);
        if (!trimmed || trimmed === this.nick) return;
        this.nick = trimmed;
        this.color = tavernNickColor(trimmed);
        await this.ctx.storage.set(TAVERN_NICK_KEY, trimmed);
        await this.ctx.storage.set(TAVERN_NICK_COLOR_KEY, this.color);
    }

    async setRoom(newRoom) {
        const trimmed = String(newRoom || '').trim().slice(0, 64) || TAVERN_DEFAULT_ROOM;
        if (trimmed === this.roomName) return;
        this.roomName = trimmed;
        await this.ctx.storage.set(TAVERN_ROOM_KEY, trimmed);
        // Reconnect to new room.
        if (this.room) {
            try { await this.room.leave(); } catch (_) {}
        }
        await this._connect();
    }

    async _connect() {
        const strategy = this.strategy || TAVERN_STRATEGY_DEFAULT;
        const T = globalThis.__trystero?.[strategy];
        if (!T || typeof T.joinRoom !== 'function') {
            throw new Error('Trystero strategy "' + strategy + '" not loaded');
        }
        this.peerCount = 0;
        this.peerNicks = new Map();      // peerId -> {nick, color, joinedAt}
        this.peerFirstNick = new Map();  // peerId -> first declared nick (spoof guard)
        this.peerLastMsgTs = new Map();  // peerId -> last accepted ts (rate limit)
        // Password makes the room name namespace differently inside Trystero,
        // so "public" + pwd "secret" is a distinct swarm from "public" with
        // no password. Empty string = open room.
        const config = { appId: TAVERN_APP_ID };
        if (this.password) config.password = this.password;
        this.room = T.joinRoom(config, this.roomName);
        const [sendMsg, getMsg] = this.room.makeAction('msg');
        const [sendPresence, getPresence] = this.room.makeAction('presence');
        this.sendMsg = sendMsg;
        this.getMsg = getMsg;
        this.sendPresence = sendPresence;
        this.getMsg((msg, peerId) => {
            // Muted peer — drop silently.
            if (this.blockedPeers.has(peerId)) return;
            // Per-peer rate limit. Prevents spam flood from a single source.
            const now = Date.now();
            const last = this.peerLastMsgTs.get(peerId) || 0;
            if (now - last < TAVERN_RATE_LIMIT_MS) return;
            this.peerLastMsgTs.set(peerId, now);
            if (typeof this.onMessageCb === 'function') {
                // Nick lock: if peer's declared msg nick differs from the
                // first nick we saw from them (via presence), surface the
                // attempt but display the original — don't let them
                // impersonate someone else mid-stream.
                const firstNick = this.peerFirstNick.get(peerId);
                const declaredNick = String(msg?.nick || 'Stranger').slice(0, 32);
                const nick = firstNick && firstNick !== declaredNick ? firstNick : declaredNick;
                const spoofed = !!(firstNick && firstNick !== declaredNick);
                this.onMessageCb({
                    text: String(msg?.text || '').slice(0, 1000),
                    nick,
                    color: String(msg?.color || '#a78bfa'),
                    ts: Number(msg?.ts) || Date.now(),
                    self: false,
                    peerId,
                    spoofed,
                });
                if (spoofed && typeof this.onSpoofCb === 'function') {
                    this.onSpoofCb({ peerId, declared: declaredNick, actual: firstNick });
                }
            }
        });
        getPresence((info, peerId) => {
            const nick  = String(info?.nick  || 'Stranger').slice(0, 32);
            const color = String(info?.color || '#a78bfa');
            const type  = info?.type === 'leave' ? 'leave' : 'join';
            if (type === 'join') {
                // Track join timestamp so the UI can show "X min ago"
                // entries in the peer list. Preserve original joinedAt if
                // the same peer re-announces (e.g. on room hop).
                const prev = this.peerNicks.get(peerId);
                this.peerNicks.set(peerId, {
                    nick, color,
                    joinedAt: prev?.joinedAt || Date.now()
                });
                // Lock the first nick we saw from this peer — any later
                // attempt to change nick is treated as a spoof attempt.
                if (!this.peerFirstNick.has(peerId)) {
                    this.peerFirstNick.set(peerId, nick);
                }
            } else {
                this.peerNicks.delete(peerId);
                this.peerFirstNick.delete(peerId);
                this.peerLastMsgTs.delete(peerId);
            }
            if (typeof this.onPresenceCb === 'function') {
                this.onPresenceCb({ type, nick, color, peerId, ts: Number(info?.ts) || Date.now() });
            }
        });
        this.room.onPeerJoin((peerId) => {
            this.peerCount++;
            // Re-announce ourselves so the new peer learns who we are.
            try { this.sendPresence({ type: 'join', nick: this.nick, color: this.color, ts: Date.now() }, peerId); } catch (_) {}
            if (typeof this.onPeerJoinCb === 'function') this.onPeerJoinCb(peerId, this.peerCount);
        });
        this.room.onPeerLeave((peerId) => {
            this.peerCount = Math.max(0, this.peerCount - 1);
            const info = this.peerNicks.get(peerId);
            this.peerNicks.delete(peerId);
            if (typeof this.onPeerLeaveCb === 'function') this.onPeerLeaveCb(peerId, this.peerCount, info);
        });
    }

    async init() {
        await this.loadProfile();
        await this._connect();
    }

    /** Broadcast a presence event so other peers can render the join/leave note. */
    announcePresence(type) {
        if (!this.sendPresence) return;
        if (type === 'join') this.selfJoinedAt = Date.now();
        try { this.sendPresence({ type, nick: this.nick, color: this.color, ts: Date.now() }); } catch (_) {}
    }

    send(text) {
        const trimmed = String(text || '').trim().slice(0, 1000);
        if (!trimmed || !this.sendMsg) return null;
        const payload = {
            text: trimmed,
            nick: this.nick,
            color: this.color,
            ts: Date.now(),
        };
        try { this.sendMsg(payload); } catch (e) { console.warn('[tavern] send failed', e); return null; }
        return { ...payload, self: true };
    }

    onMessage(cb) { this.onMessageCb = cb; }
    onPeerJoin(cb) { this.onPeerJoinCb = cb; }
    onPeerLeave(cb) { this.onPeerLeaveCb = cb; }
    onPresence(cb) { this.onPresenceCb = cb; }
    onSpoof(cb) { this.onSpoofCb = cb; }

    /**
     * Snapshot of everyone in the room from this client's perspective.
     * Self is always included as the first entry; remote peers follow
     * (whose nicks are known from received presence broadcasts).
     */
    getPeers() {
        const list = [{
            peerId: 'self',
            nick: this.nick,
            color: this.color,
            joinedAt: this.selfJoinedAt || Date.now(),
            self: true,
        }];
        for (const [peerId, info] of this.peerNicks.entries()) {
            list.push({ peerId, nick: info.nick, color: info.color, joinedAt: info.joinedAt, self: false });
        }
        return list;
    }

    async destroy() {
        if (this.room) {
            try { await this.room.leave(); } catch (_) {}
        }
        this.room = null;
        this.sendMsg = null;
        this.getMsg = null;
    }
}
