// Online session: who is around, chat, friend / party / duel requests. Built on src/net/net.js.
// UI and scenes subscribe with on(event, fn). Events: 'peers', 'chat', 'requests', 'party', 'status', 'duel'.
import { publicCard, readCard } from '../systems/profile.js';
import { createHitGate } from './fairplay.js';
import { PROTOCOL, REQUEST_TTL, PARTY_MAX, readPresence, cleanChat, addFriend, touchFriend, newParty, partyAdd, partyRemove, readRoster, lookOf, rid } from './protocol.js';

const CHAT_KEEP = 40;
const CHAT_GAP = 700;   // ms between my messages (the room asks for "a few a second" at most)

export function createOnline(app, net) {
  const subs = new Map();
  const emitLocal = (ev, data) => { for (const fn of subs.get(ev) || []) fn(data); };
  const state = {
    net, peers: new Map(),        // peer → { peer, by, p (clean presence), raw }
    chat: [], requests: [],       // incoming requests waiting for an answer
    outgoing: new Map(),          // rid → { kind, to, at }
    party: null, partyRoom: null,
    zone: 'camp', lastChat: 0, presence: {},
  };
  const me = () => net.me.peer;
  const myInfo = () => { const st = app.store.get(); return { peer: me(), uid: net.me.id, name: st.story.name, lv: st.player.level }; };

  // ------------------------------------------------------------ presence
  function publish(patch) {
    Object.assign(state.presence, patch);
    net.lobby.presence({ v: PROTOCOL, u: net.me.id, ...lookOf(app.store.get()), py: state.party?.id || null, ...patch });
  }
  function refreshLook() { publish({}); }

  // Each update from the network builds a new frozen presence object, so the cleaned copy is kept per object:
  // a player who did not change since the last notice is not re-validated (with a crowd this was O(players²)/s).
  const cleanCache = new WeakMap();
  const cleanOf = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    let c = cleanCache.get(raw);
    if (c === undefined) { c = readPresence(raw); cleanCache.set(raw, c); }
    return c;
  };

  net.lobby.onPeers((c) => {
    state.peers.clear();
    for (const p of c.peers) {
      if (p.sameTab) continue;
      const clean = cleanOf(p.presence);
      if (clean) state.peers.set(p.peer, { peer: p.peer, by: p.by, p: clean, isMe: p.isMe });
    }
    // remember friends' latest names; drop requests and party members whose page closed
    const st = app.store.get();
    for (const x of state.peers.values()) {
      const uid = x.by;
      if (uid && st.social?.friends?.[uid]) { const n = touchFriend(app.store.get(), uid, x.p.name); if (n) app.store.commit(n, { reason: 'friend-seen' }); }
    }
    const reqsBefore = state.requests.length;
    for (const l of c.left || []) {
      state.requests = state.requests.filter((r) => r.from.peer !== l.peer);
      if (state.party && state.party.leader === me() && state.party.members.some((m) => m.peer === l.peer)) {
        const r = partyRemove(state.party, l.peer); if (r.ok) changeParty(r.party, state.party.id);
      } else if (state.party && state.party.leader === l.peer) {
        // leader's page closed: the longest-standing member takes over and announces it
        const r = partyRemove(state.party, l.peer);
        if (r.ok && r.party?.leader === me()) changeParty(r.party, state.party.id);
        else if (r.ok) setParty(r.party && r.party.members.length > 1 ? r.party : null);
      }
    }
    emitLocal('peers', [...state.peers.values()]);
    if (state.requests.length !== reqsBefore) emitLocal('requests', state.requests);
  });

  net.onSendRefused?.(() => { app.toast('บัญชีนี้มีสิทธิ์ดูอย่างเดียว ส่งแชทหรือคำขอไม่ได้ (ขอสิทธิ์ "ผู้ร่วมแก้ไข/โต้ตอบ" จากเจ้าของเกม)', 'warn', 'net-view-only', { duration: 6000 }); emitLocal('status', 'view-only'); });

  // ------------------------------------------------------------ chat
  const chatGate = createHitGate(6, 10_000);        // at most 6 lines per 10 s from one player (spam)
  net.lobby.on('chat', (m) => {
    const text = cleanChat(m.data?.text);
    if (!text) return;
    if (!m.sameTab && !chatGate.allow(m.peer)) return;
    const who = m.sameTab ? myInfo().name : (state.peers.get(m.peer)?.p.name || 'นักล่า');
    pushChat({ ch: 'village', peer: m.peer, name: who, text, me: m.sameTab, at: Date.now() });
  });
  function pushChat(line) {
    state.chat.push(line);
    if (state.chat.length > CHAT_KEEP) state.chat.shift();
    emitLocal('chat', line);
  }
  async function sendChat(text, ch = 'village') {
    const t = cleanChat(text);
    if (!t) return { ok: false, reason: 'empty' };
    if (!net.online) return { ok: false, reason: 'offline' };
    if (!net.canSend) return { ok: false, reason: 'view_only' };
    if (Date.now() - state.lastChat < CHAT_GAP) return { ok: false, reason: 'too_fast' };
    state.lastChat = Date.now();
    if (ch === 'party') {
      if (!state.partyRoom) return { ok: false, reason: 'no_party' };
      await state.partyRoom.emit('chat', { text: t });
    } else await net.lobby.emit('chat', { text: t });
    return { ok: true };
  }

  // ------------------------------------------------------------ requests (friend / party / duel)
  function send(k, to, extra = {}) { return net.lobby.emit('social', { k, to, from: myInfo(), ...extra }); }

  function request(kind, toPeer) {
    if (!net.online) return { ok: false, reason: 'offline' };
    const target = state.peers.get(toPeer);
    if (!target) return { ok: false, reason: 'not_here' };
    if ([...state.outgoing.values()].some((o) => o.kind === kind && o.to === toPeer && Date.now() - o.at < REQUEST_TTL)) return { ok: false, reason: 'already_sent' };
    if (kind === 'friend' && !target.by) return { ok: false, reason: 'no_account' };
    if (kind === 'guild' && !app.guild?.current) return { ok: false, reason: 'no_guild' };
    if (kind === 'guild' && target.p.gtag) return { ok: false, reason: 'has_guild' };
    if (kind === 'guild' && !target.by) return { ok: false, reason: 'no_account' };
    if (kind === 'friend' && app.store.get().social.friends[target.by]) return { ok: false, reason: 'already_friend' };
    if (!net.canSend) return { ok: false, reason: 'view_only' };
    if (kind === 'party') {
      if (state.party && state.party.leader !== me()) return { ok: false, reason: 'not_leader' };
      if (state.party && state.party.members.length >= PARTY_MAX) return { ok: false, reason: 'party_full' };
      if (target.p.party && target.p.party === state.party?.id) return { ok: false, reason: 'already_member' };
    }
    if ((kind === 'duel' || kind === 'trade') && target.p.busy) return { ok: false, reason: 'busy' };
    // an edited save neither trades nor duels, and nobody trades or duels with one
    if ((kind === 'duel' || kind === 'trade') && app.store.get().integrity === 'modified') return { ok: false, reason: 'save_modified' };
    if ((kind === 'duel' || kind === 'trade') && target.p.modified) return { ok: false, reason: 'their_save_modified' };
    const id = rid();
    state.outgoing.set(id, { kind, to: toPeer, at: Date.now() });
    const g = kind === 'guild' ? app.guild.current : null;
    const go = () => send(kind + '_req', toPeer, { rid: id, pid: kind === 'party' ? (state.party?.id || null) : undefined, gid: g?.id, gname: g?.name, gtag: g?.tag });
    // a guild invitation is registered with the server first, so the invited player is allowed to join
    if (kind === 'guild') { let inv; try { inv = app.guild.invite?.(target.by); } catch { inv = null; } Promise.resolve(inv).then(go, go); } else go();
    return { ok: true, rid: id };
  }

  function respond(reqId, accept) {
    const r = state.requests.find((x) => x.rid === reqId);
    if (!r) return { ok: false, reason: 'expired' };
    state.requests = state.requests.filter((x) => x !== r);
    emitLocal('requests', state.requests);
    if (Date.now() - r.at > REQUEST_TTL) return { ok: false, reason: 'expired' };
    if (!accept) { send(r.kind + '_no', r.from.peer, { rid: r.rid }); return { ok: true }; }
    if (r.kind === 'friend') {
      const res = addFriend(app.store.get(), r.from.uid, r.from.name);
      if (res.ok) app.store.commit(res.state, { reason: 'friend' });
      send('friend_ok', r.from.peer, { rid: r.rid });
      return res.ok ? { ok: true } : res;
    }
    if (r.kind === 'party') {
      if (state.party) leaveParty();
      send('party_ok', r.from.peer, { rid: r.rid });
      return { ok: true };
    }
    if (r.kind === 'guild') {
      send('guild_ok', r.from.peer, { rid: r.rid });
      emitLocal('guild', { gid: r.gid, name: r.gname, from: r.from });
      return { ok: true };
    }
    if (r.kind === 'duel' || r.kind === 'trade') {
      const room = `${r.kind}-${r.rid}`;
      send(r.kind + '_ok', r.from.peer, { rid: r.rid, room });
      emitLocal(r.kind, { room, opponent: r.from, partner: r.from, host: false, hostPeer: r.from.peer, rid: r.rid });
      return { ok: true };
    }
    return { ok: false, reason: 'unknown' };
  }

  net.lobby.on('social', (m) => {
    const d = m.data || {};
    if (m.sameTab || d.to !== me() || !d.from) return;
    const from = { peer: m.peer, uid: m.by || null, name: readPresence({ v: PROTOCOL, n: d.from.name })?.name || 'นักล่า', lv: Math.max(1, Math.min(100, d.from.lv | 0)) };
    const kind = String(d.k || '').split('_')[0], verb = String(d.k || '').split('_')[1];
    if (verb === 'req') {
      if (!['friend', 'party', 'duel', 'trade', 'guild'].includes(kind) || typeof d.rid !== 'string' || !/^[a-z0-9]{4,24}$/.test(d.rid) || state.requests.some((x) => x.rid === d.rid)) return;
      if (kind === 'friend' && from.uid && app.store.get().social.friends[from.uid]) { send('friend_ok', m.peer, { rid: d.rid }); return; }
      if (kind === 'guild' && !(typeof d.gid === 'string' && /^g[a-z0-9]{6,16}$/.test(d.gid))) return;
      // duels and trades with an edited save are declined automatically, both ways
      if ((kind === 'duel' || kind === 'trade') && (app.store.get().integrity === 'modified' || state.peers.get(m.peer)?.p.modified)) { send(kind + '_no', m.peer, { rid: d.rid }); return; }
      state.requests.push({ rid: String(d.rid).slice(0, 24), kind, from, at: Date.now(), gid: kind === 'guild' ? d.gid : undefined, gname: kind === 'guild' ? String(d.gname || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 16) : undefined });
      emitLocal('requests', state.requests);
      app.audio?.play('click');
      return;
    }
    const out = state.outgoing.get(d.rid);
    if (!out || out.to !== m.peer) return;          // answers only count for requests I really sent to that player
    state.outgoing.delete(d.rid);
    if (verb === 'no') { emitLocal('answer', { kind, accepted: false, from }); return; }
    if (kind === 'friend' && verb === 'ok') {
      const res = addFriend(app.store.get(), from.uid, from.name);
      if (res.ok) app.store.commit(res.state, { reason: 'friend' });
      emitLocal('answer', { kind, accepted: true, from });
    } else if (kind === 'party' && verb === 'ok') {
      const mine = state.party || newParty(rid(), myInfo());
      const r = partyAdd(mine, from);
      if (r.ok) changeParty(r.party, mine.id);
      emitLocal('answer', { kind, accepted: r.ok, from, reason: r.reason });
    } else if (kind === 'guild' && verb === 'ok') {
      emitLocal('answer', { kind, accepted: true, from });
    } else if ((kind === 'duel' || kind === 'trade') && verb === 'ok') {
      emitLocal('answer', { kind, accepted: true, from });
      emitLocal(kind, { room: `${kind}-${d.rid}`, opponent: from, partner: from, host: true, hostPeer: me(), rid: d.rid });
    }
  });

  // ------------------------------------------------------------ party
  // The leader owns the roster and announces it in the lobby; members accept a roster only from its leader.
  // The party's own named room carries party chat and "I'm leaving" notes.
  // The leader tells everyone the new roster after any change; an empty roster disbands the party.
  function announce(pid, leader, members) {
    net.lobby.emit('social', { k: 'party_roster', to: null, pid, leader: leader || me(), members, from: myInfo() });
  }
  function changeParty(next, pid) {
    announce(pid, next?.leader, next && next.members.length > 1 ? next.members : []);
    setParty(next && next.members.length > 1 && next.members.some((m) => m.peer === me()) ? next : null);
  }

  async function setParty(party) {
    const prevId = state.party?.id;
    state.party = party;
    if (prevId !== party?.id) {
      if (state.partyRoom) { state.partyRoom.leave(); state.partyRoom = null; }
      if (party) {
        const room = await net.join('party-' + party.id).catch(() => null);
        if (state.party?.id !== party.id) { room?.leave(); return; }
        state.partyRoom = room;
        room?.on('chat', (m) => {
          const t = cleanChat(m.data?.text); if (!t) return;
          const who = m.sameTab ? myInfo().name : (state.party?.members.find((x) => x.peer === m.peer)?.name || 'สมาชิก');
          pushChat({ ch: 'party', peer: m.peer, name: who, text: t, me: m.sameTab, at: Date.now() });
        });
        room?.on('leave', (m) => {
          if (m.sameTab || state.party?.leader !== me()) return;
          const r = partyRemove(state.party, m.peer); if (r.ok) changeParty(r.party, state.party.id);
        });
      }
    }
    publish({});
    emitLocal('party', state.party);
  }

  // ------------------------------------------------------------ profile cards (โปรไฟล์)
  // ask a player for their card; they answer only to me. Answers are cleaned (readCard) before use.
  const cardWait = new Map();     // peer → { resolve, timer }
  const cardAsked = new Map();    // peer → last time they asked me (one answer every 3 s)
  function requestCard(peer) {
    if (!net.online) return Promise.resolve({ ok: false, reason: 'offline' });
    if (!state.peers.get(peer)) return Promise.resolve({ ok: false, reason: 'not_here' });
    const old = cardWait.get(peer);
    if (old) { clearTimeout(old.timer); old.resolve({ ok: false, reason: 'replaced' }); }
    return new Promise((resolve) => {
      const timer = setTimeout(() => { cardWait.delete(peer); resolve({ ok: false, reason: 'no_answer' }); }, 6000);
      cardWait.set(peer, { resolve, timer });
      net.lobby.emit('social', { k: 'cardq', to: peer, from: myInfo() }, { to: peer });
    });
  }
  net.lobby.on('social', (m) => {
    const d = m.data || {};
    if (m.sameTab || d.to !== me() || (d.k !== 'cardq' && d.k !== 'carda')) return;
    if (d.k === 'cardq') {
      if (!net.canSend || Date.now() - (cardAsked.get(m.peer) || 0) < 3000) return;
      cardAsked.set(m.peer, Date.now());
      if (cardAsked.size > 200) cardAsked.clear();
      net.lobby.emit('social', { k: 'carda', to: m.peer, from: myInfo(), card: publicCard(app.store.get()) }, { to: m.peer });
      return;
    }
    const w = cardWait.get(m.peer);
    if (!w) return;
    cardWait.delete(m.peer); clearTimeout(w.timer);
    const card = readCard(d.card);
    w.resolve(card ? { ok: true, card } : { ok: false, reason: 'bad_card' });
  });

  net.lobby.on('social', (m) => {
    const d = m.data || {};
    if (d.k !== 'party_roster' || m.sameTab) return;
    const r = readRoster(d, m.peer, state.party?.id === d.pid ? state.party.leader : null);
    if (!r) return;
    if (r.members.length > 1 && r.members.some((x) => x.peer === me())) setParty(r);
    else if (state.party?.id === r.id) setParty(null);   // removed, or the party broke up
  });

  function leaveParty() {
    if (!state.party) return { ok: false, reason: 'no_party' };
    if (state.party.leader === me()) {
      const r = partyRemove(state.party, me());
      announce(state.party.id, r.party?.leader, r.party && r.party.members.length > 1 ? r.party.members : []);
    } else state.partyRoom?.emit('leave', {});
    setParty(null);
    return { ok: true };
  }

  function kick(peer) {
    if (!state.party || state.party.leader !== me()) return { ok: false, reason: 'not_leader' };
    if (peer === me()) return { ok: false, reason: 'not_member' };
    const r = partyRemove(state.party, peer);
    if (r.ok) changeParty(r.party, state.party.id);
    return r;
  }

  // the timer clears requests nobody answered
  const sweep = setInterval(() => {
    const before = state.requests.length;
    state.requests = state.requests.filter((r) => Date.now() - r.at < REQUEST_TTL);
    if (state.requests.length !== before) emitLocal('requests', state.requests);
    for (const [k, o] of state.outgoing) if (Date.now() - o.at > REQUEST_TTL) state.outgoing.delete(k);
  }, 1000);

  return {
    get net() { return net; },
    get online() { return net.online; },
    get mode() { return net.mode; },
    get me() { return myInfo(); },
    get peers() { return [...state.peers.values()]; },
    get chat() { return state.chat; },
    get requests() { return state.requests; },
    get party() { return state.party; },
    on(ev, fn) { if (!subs.has(ev)) subs.set(ev, new Set()); subs.get(ev).add(fn); return () => subs.get(ev).delete(fn); },
    publish, refreshLook, sendChat, request, respond, leaveParty, kick, requestCard,
    addChat: (line) => pushChat(line),
    get reason() { return net.reason; },
    canSend: () => net.online && net.canSend,
    destroy() { clearInterval(sweep); },
  };
}
