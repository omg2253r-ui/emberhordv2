// Network layer. One small interface over several transports:
//   'claude' — the claude.ai artifact runtime's realtime room (presence + topics + named rooms) and user ids.
//              Everyone who opens the published game on claude.ai with access is in the same lobby.
//   'mesh'   — the game on an ordinary website (Netlify): players connect directly over WebRTC, a small hub
//              function says who is online (src/net/mesh.js, netlify/functions/). Everyone on the site meets.
//   'local'  — BroadcastChannel between tabs of ONE browser. Used for development and the automated
//              multiplayer tests (?net=local). It is not a way to meet other people.
//   'offline'— no connection: the game is fully playable alone; online features say why they are unavailable.
//
// Channel API (lobby and named rooms):
//   emit(topic, data) · on(topic, fn) → unsub · presence(patch) · peers() → [{peer, by, isMe, presence}]
//   onPeers(fn) → unsub · connected() · leave()
// Everything received is untrusted data from other players.

import { createClaudeDocs, createLocalDocs } from './docs.js';
import { createMeshNet, createHubDocs } from './mesh.js';

const TOPICS = ['chat', 'social', 'leave', 'match'];   // event topics the game sends (opened to Contributors on claude.ai)
export const NET_TOPICS = TOPICS;

const randomId = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

// A player id that stays the same on this browser (friends and guild membership are keyed by it), with the
// secret that proves to the hub that this browser owns it.
function browserUid(slot) {
  const key = 'emberhold.uid' + (slot ? '.' + slot : '');
  const kkey = key + '.key';
  try {
    let v = localStorage.getItem(key), k = localStorage.getItem(kkey);
    if (!/^u[a-z0-9]{14}$/.test(v || '')) { v = 'u' + randomId(14); localStorage.setItem(key, v); k = null; }
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(k || '')) { k = randomId(32); localStorage.setItem(kkey, k); }
    return { uid: v, ukey: k };
  } catch { return { uid: 'u' + randomId(14), ukey: randomId(32) }; }
}

async function meshOrNull({ slot, rtc, ice }) {
  const id = browserUid(slot);
  const net = await createMeshNet({ uid: id.uid, ukey: id.ukey, rtc, ...(ice === 'none' ? { iceServers: [] } : {}) }).catch(() => null);
  if (net) net.docs = createHubDocs({ uid: id.uid, ukey: id.ukey });
  return net;
}

export async function createNet({ mode = 'auto', localId = null, slot = '', rtc = true, ice = '' } = {}) {
  if (mode === 'local' && typeof BroadcastChannel !== 'undefined') return createLocalNet(localId);
  if (mode === 'offline') return offlineNet('ปิดออนไลน์อยู่');
  const onWeb = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
  if (mode === 'mesh') return (onWeb && await meshOrNull({ slot, rtc, ice })) || offlineNet('เชื่อมต่อเซิร์ฟเวอร์ออนไลน์ของเกมไม่ได้');
  const claude = typeof window !== 'undefined' ? window.claude : null;
  if (!claude || typeof claude.use !== 'function') {
    // an ordinary website: online play works where the site ships the game's hub (Netlify build adds the marker)
    const hub = typeof document !== 'undefined' && document.querySelector('meta[name="emberhold-hub"]');
    if (onWeb && hub) { const net = await meshOrNull({ slot, rtc, ice }); if (net) return net; }
    return offlineNet('เปิดเกมจากเว็บไซต์ของเกมเพื่อเล่นออนไลน์ (เซิร์ฟเวอร์ออนไลน์ไม่ตอบ)');
  }
  let room = null, user = null, db = null;
  try { [room, user, db] = await Promise.all([claude.use('room'), claude.use('user'), claude.use('db').catch(() => null)]); } catch { /* treated as unavailable */ }
  if (!room) return offlineNet('บัญชีนี้เชื่อมต่อห้องออนไลน์ไม่ได้ (ต้องลงชื่อเข้าใช้และได้รับเชิญเข้าเกม)');
  let myId = null;
  try { myId = user ? await user.id() : null; } catch { myId = null; }
  const net = createClaudeNet(room, myId);
  net.docs = db && myId ? createClaudeDocs(db) : null;
  return net;
}

function offlineNet(reason) {
  const dead = deadChannel('lobby');
  return { kind: 'offline', mode: 'offline', online: false, reason, myId: null, myPeer: 'me', me: { peer: 'me', id: null }, canSend: false, docs: null, lobby: dead, join: async () => deadChannel('x'), onSendRefused: () => () => {}, close() {} };
}

function deadChannel(name) {
  return { name, emit: async () => {}, on: () => () => {}, presence: async () => {}, peers: () => [], onPeers: () => () => {}, connected: () => false, leave: async () => {} };
}

// ---------------------------------------------------------------- claude.ai
function createClaudeNet(room, myId) {
  const refusedFns = new Set();
  const net = {
    kind: 'claude', mode: 'claude', online: true, reason: '', myId, myPeer: null, canSend: true,
    get me() { return { peer: net.myPeer, id: net.myId }; },
    lobby: null,
    async join(name) { return wrapClaude(await room.join(name), net, refusedFns); },
    onSendRefused(fn) { refusedFns.add(fn); return () => refusedFns.delete(fn); },
    close() {},
  };
  net.lobby = wrapClaude(room, net, refusedFns);
  return net;
}

function wrapClaude(ch, net, refusedFns) {
  return {
    name: ch.name || 'lobby',
    emit(topic, data) {
      return ch.emit(topic, data).catch((e) => {
        // view-only players may move and be seen, but not send messages
        if (e?.code === 'not_permitted' && net.canSend) { net.canSend = false; for (const fn of refusedFns) fn(); }
      });
    },
    on(topic, fn) { return ch.on(topic, (m) => fn({ topic, data: m.data, peer: m.peer, by: m.by, isMe: m.isMe, sameTab: m.sameTab })); },
    presence(patch) { return ch.presence(patch).catch(() => {}); },
    peers() {
      const list = ch.peers();
      for (const p of list) if (p.sameTab && !net.myPeer) net.myPeer = p.peer;
      return list.filter((p) => p.kind !== 'agent');
    },
    onPeers(fn) { return ch.onPeers((c) => { for (const p of c.peers) if (p.sameTab) net.myPeer = p.peer; fn(c); }); },
    connected: () => ch.connected(),
    leave: () => (ch.leave ? ch.leave() : Promise.resolve()),
  };
}

// ---------------------------------------------------------------- local (tabs of one browser)
function createLocalNet(localId) {
  const bc = new BroadcastChannel('emberhold-net');
  const myPeer = randomId(10);
  const myId = localId || myPeer;
  const rooms = new Map();
  const send = (msg) => bc.postMessage({ ...msg, from: myPeer, by: myId });

  function makeRoom(name) {
    const peers = new Map();          // peer → {peer, by, presence, seen}
    const handlers = new Map();       // topic → Set
    const peerFns = new Set();
    let mine = {};
    let snapshot = [];
    const self = () => ({ peer: myPeer, by: myId, isMe: true, sameTab: true, presence: mine, updatedAt: Date.now() });
    const rebuild = () => { snapshot = Object.freeze([self(), ...[...peers.values()].map((p) => ({ peer: p.peer, by: p.by, isMe: false, sameTab: false, presence: p.presence, updatedAt: p.seen }))]); };
    rebuild();
    const notify = (joined = [], left = [], updated = []) => { rebuild(); for (const fn of peerFns) fn({ peers: snapshot, joined, left, updated }); };
    const room = {
      name, peers,
      receive(msg) {
        if (msg.type === 'presence' || msg.type === 'hello') {
          const prev = peers.get(msg.from);
          const json = JSON.stringify(msg.presence || {});
          if (prev && prev.json === json) { prev.seen = Date.now(); return; }    // keepalive: nothing changed
          peers.set(msg.from, { peer: msg.from, by: msg.by, presence: Object.freeze({ ...(msg.presence || {}) }), seen: Date.now(), json });
          if (!prev) { notify([{ peer: msg.from }]); if (msg.type === 'hello') send({ type: 'presence', room: name, presence: mine }); }
          else notify([], [], [{ peer: msg.from }]);
        } else if (msg.type === 'bye') {
          if (peers.delete(msg.from)) notify([], [{ peer: msg.from }]);
        } else if (msg.type === 'emit') {
          const set = handlers.get(msg.topic);
          if (set) for (const fn of set) fn({ topic: msg.topic, data: msg.data, peer: msg.from, by: msg.by, isMe: false, sameTab: false });
        }
      },
      expire() {
        const now = Date.now();
        for (const [k, p] of peers) if (now - p.seen > 4000) { peers.delete(k); notify([], [{ peer: k }]); }
      },
      api: {
        name,
        async emit(topic, data) {
          send({ type: 'emit', room: name, topic, data });
          const set = handlers.get(topic);
          if (set) for (const fn of set) fn({ topic, data, peer: myPeer, by: myId, isMe: true, sameTab: true });
        },
        on(topic, fn) {
          if (!handlers.has(topic)) handlers.set(topic, new Set());
          handlers.get(topic).add(fn);
          return () => handlers.get(topic)?.delete(fn);
        },
        async presence(patch) {
          const next = { ...mine };
          for (const [k, v] of Object.entries(patch)) { if (v === null) delete next[k]; else next[k] = v; }
          mine = Object.freeze(next);
          send({ type: 'presence', room: name, presence: mine });
          notify([], [], [self()]);
        },
        peers: () => snapshot,
        onPeers(fn) { peerFns.add(fn); queueMicrotask(() => fn({ peers: snapshot, joined: snapshot, left: [], updated: [] })); return () => peerFns.delete(fn); },
        connected: () => true,
        async leave() { send({ type: 'bye', room: name }); rooms.delete(name); },
      },
    };
    rooms.set(name, room);
    send({ type: 'hello', room: name, presence: mine });
    return room;
  }

  bc.onmessage = (e) => {
    const msg = e.data;
    if (!msg || msg.from === myPeer) return;
    const r = rooms.get(msg.room);
    if (r) r.receive(msg);
  };
  // keepalive: presence is re-sent so late tabs and expiry work like the real platform
  const keepalive = setInterval(() => { for (const r of rooms.values()) { send({ type: 'presence', room: r.name, presence: r.api.peers()[0].presence }); r.expire(); } }, 1000);
  const bye = () => { for (const r of rooms.values()) send({ type: 'bye', room: r.name }); };
  if (typeof addEventListener === 'function') addEventListener('pagehide', bye);

  const lobby = makeRoom('lobby');
  return {
    kind: 'local', mode: 'local', online: true, reason: '', myId, myPeer, me: { peer: myPeer, id: myId }, canSend: true,
    docs: typeof localStorage !== 'undefined' ? createLocalDocs(localStorage) : null,
    lobby: lobby.api,
    async join(name) { return (rooms.get(name) || makeRoom(name)).api; },
    onSendRefused: () => () => {},
    close() { bye(); clearInterval(keepalive); bc.close(); },
  };
}
