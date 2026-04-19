// Tavern chat helper — wraps Trystero P2P signaling so ui.js and widget.js
// share one connection logic. Bundled inline by the host iframe loader.
// Trystero exposes joinRoom/selfId via globalThis.__trystero (added at the
// end of trystero.min.js after we strip the ESM exports).

const TAVERN_APP_ID = 'aruta-tavern';
const TAVERN_DEFAULT_ROOM = 'public';
const TAVERN_NICK_KEY = 'nickname';
const TAVERN_NICK_COLOR_KEY = 'nickColor';
const TAVERN_ROOM_KEY = 'room';

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
        this.peerCount = 0;
        this.nick = '';
        this.color = '';
        this.roomName = TAVERN_DEFAULT_ROOM;
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
        const T = globalThis.__trystero;
        if (!T || typeof T.joinRoom !== 'function') {
            throw new Error('Trystero bundle missing joinRoom');
        }
        this.peerCount = 0;
        this.peerNicks = new Map(); // peerId -> {nick, color}
        this.room = T.joinRoom({ appId: TAVERN_APP_ID }, this.roomName);
        const [sendMsg, getMsg] = this.room.makeAction('msg');
        const [sendPresence, getPresence] = this.room.makeAction('presence');
        this.sendMsg = sendMsg;
        this.getMsg = getMsg;
        this.sendPresence = sendPresence;
        this.getMsg((msg, peerId) => {
            if (typeof this.onMessageCb === 'function') {
                this.onMessageCb({
                    text: String(msg?.text || '').slice(0, 1000),
                    nick: String(msg?.nick || 'Stranger').slice(0, 32),
                    color: String(msg?.color || '#a78bfa'),
                    ts: Number(msg?.ts) || Date.now(),
                    self: false,
                    peerId,
                });
            }
        });
        getPresence((info, peerId) => {
            const nick  = String(info?.nick  || 'Stranger').slice(0, 32);
            const color = String(info?.color || '#a78bfa');
            const type  = info?.type === 'leave' ? 'leave' : 'join';
            if (type === 'join') this.peerNicks.set(peerId, { nick, color });
            else                 this.peerNicks.delete(peerId);
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

    async destroy() {
        if (this.room) {
            try { await this.room.leave(); } catch (_) {}
        }
        this.room = null;
        this.sendMsg = null;
        this.getMsg = null;
    }
}
