// 'mesh' transport: for the game hosted on an ordinary website (Netlify).
//
// Players connect to each other directly with WebRTC data channels. A small hub (netlify/functions/hub.mts,
// polled every few seconds) only says who is online and carries the connection set-up messages. When two
// players' networks cannot connect directly (some strict NATs), their messages go through the hub instead
// ("relay"): slower (about a second), but presence, chat and requests still work.
//
// The Channel API matches src/net/net.js: emit · on · presence · peers · onPeers · connected · leave.
// Rooms are multiplexed over the one connection per player: a peer is in my room once it said so.
// Everything received is untrusted data from other players.
//
// Load (v8.0.3): presence goes out as a small "delta" (only the fields that changed) to players who said they
// understand it (`cap: 1` in their greeting), with a full copy every few seconds; updates from others are merged
// into one change notice per ~50 ms. Nothing here depends on the graphics setting: everyone sees everyone.

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const WORLD = 'v1';
const HEARTBEAT = 3000;        // hub poll when nothing is pending
const FAST = 700;              // hub poll while connections are being set up
const RELAY_POLL = 1000;       // hub poll while some player is reached through the hub
const FULL_EVERY = 4000;        // a full presence copy at least this often (also the keepalive); in between only changes are sent
const NOTIFY_MS = 50;          // updates from other players are announced to the game at most this often
const RTC_TIMEOUT = 12000;     // give up on a direct connection and relay instead
const MAX_LINKS = 40;
const MAX_QUEUE = 240;
const ROOM_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const TOPIC_RE = /^[a-z][a-z0-9_.-]{0,47}$/;

const same = (a, b) => a === b || (a && b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
const randomId = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

export async function createMeshNet({ base = '/api', uid, ukey = null, rtc = true, iceServers = ICE, fetchImpl = (...a) => fetch(...a), world = WORLD } = {}) {
  const myPeer = randomId(12);
  const myKey = randomId(32);           // proves to the hub that this page owns myPeer
  const myId = uid || 'u' + randomId(14);
  let uidVerified = false;
  const auth = () => ({ world, peer: myPeer, key: myKey, uid: myId, ukey });
  const links = new Map();          // peer → link
  const rooms = new Map();          // name → room
  const refusedFns = new Set();
  const useRtc = rtc && typeof RTCPeerConnection === 'function';
  let closed = false, hubOk = false, syncing = false, timer = null, kick = null, lastSync = 0;

  // ------------------------------------------------------------ hub
  async function post(body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
    try {
      const r = await fetchImpl(`${base}/hub`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl?.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('hub ' + r.status);
      return await r.json();
    } finally { if (t) clearTimeout(t); }
  }

  // queued mail, cut into pieces the hub accepts (≤ ~80 KB each, ≤ ~200 KB per call); the rest waits
  function takeMail() {
    const send = [];
    let total = 0;
    for (const l of links.values()) {
      while (l.out.length && total < 200_000 && send.length < 36) {
        const items = [];
        let size = 0;
        while (l.out.length && items.length < 280) {
          const n = JSON.stringify(l.out[0]).length + 1;
          if (n > 80_000) { l.out.shift(); continue; }          // one oversized message: dropped, never blocks the queue
          if (size + n > 80_000) break;
          items.push(l.out.shift()); size += n;
        }
        if (!items.length) break;
        send.push({ to: l.peer, items });
        total += size;
      }
    }
    return send;
  }

  async function sync() {
    if (closed || syncing) return;
    syncing = true;
    const send = takeMail();
    try {
      const res = await post({ ...auth(), send });
      uidVerified = res.uid === myId;
      hubOk = true;
      lastSync = Date.now();
      onRoster(Array.isArray(res.peers) ? res.peers : []);
      for (const m of res.mail || []) onMail(m);
      if (res.more) schedule(50);
    } catch {
      hubOk = false;
      // put unsent mail back so it goes next time
      for (const s of [...send].reverse()) { const l = links.get(s.to); if (l) l.out = [...s.items, ...l.out].slice(-MAX_QUEUE); }
    } finally {
      syncing = false;
      tickLinks();
      schedule();
    }
  }

  function schedule(ms) {
    if (closed) return;
    clearTimeout(timer);
    let wait = ms ?? HEARTBEAT;
    if (ms == null) {
      for (const l of links.values()) {
        if (l.state === 'relay') wait = Math.min(wait, RELAY_POLL);
        else if (l.state !== 'open') wait = Math.min(wait, FAST);
        if (l.out.length) wait = Math.min(wait, l.state === 'relay' ? RELAY_POLL : 120);
      }
      if (!hubOk) wait = Math.max(wait, 2500);
    }
    timer = setTimeout(sync, wait);
  }
  // something is waiting to go through the hub: send it soon (coalesced)
  function nudge() {
    if (kick || closed) return;
    kick = setTimeout(() => { kick = null; if (!syncing) { clearTimeout(timer); sync(); } }, 60);
  }

  // ------------------------------------------------------------ links (one per other player)
  function linkFor(peer, create = true) {
    let l = links.get(peer);
    if (!l && create && links.size < MAX_LINKS && /^[a-z0-9]{8,24}$/.test(peer) && peer !== myPeer) {
      l = { peer, uid: null, claimed: null, vuid: null, state: 'new', pc: null, dc: null, startedAt: Date.now(), rooms: new Map(), out: [], seenAt: Date.now(), missing: 0, greeted: false, cap: false, fullAt: new Map() };
      links.set(peer, l);
    }
    return l || null;
  }

  // A player's lasting id counts only when the hub confirmed that peer owns it (no impersonating friends or guild members).
  function settleUid(l) {
    const next = l.vuid && l.claimed === l.vuid ? l.vuid : null;
    if (next === l.uid) return;
    l.uid = next;
    for (const name of l.rooms.keys()) rooms.get(name)?.notify([], [], [{ peer: l.peer }]);
  }

  function onRoster(raw) {
    const list = raw.map((x) => (typeof x === 'string' ? { p: x, u: null } : x)).filter((x) => x && typeof x.p === 'string');
    const live = new Set(list.map((x) => x.p));
    for (const { p: peer, u } of list) {
      const l = linkFor(peer);
      if (!l) continue;
      l.seenAt = Date.now(); l.missing = 0;
      l.vuid = typeof u === 'string' ? u : null;
      settleUid(l);
      if (l.state === 'new') {
        if (!useRtc) toRelay(l, true);
        else if (myPeer < peer) startOffer(l);
        else l.state = 'waiting';
      }
    }
    for (const l of [...links.values()]) {
      if (live.has(l.peer) || l.state === 'open') continue;
      if (++l.missing >= 2) drop(l);
    }
  }

  function tickLinks() {
    const now = Date.now();
    for (const l of links.values()) {
      if ((l.state === 'offering' || l.state === 'answering' || l.state === 'waiting') && now - l.startedAt > RTC_TIMEOUT) toRelay(l, true);
    }
  }

  function signal(l, sig) { l.out.push({ sig }); nudge(); }

  function waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((res) => {
      const done = () => { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', check); res(); };
      const check = () => { if (pc.iceGatheringState === 'complete') done(); };
      const t = setTimeout(done, 2500);
      let early = null;
      pc.addEventListener('icecandidate', (e) => { if (!early && e.candidate && / typ srflx /.test(e.candidate.candidate)) early = setTimeout(done, 300); });
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  function newPc(l) {
    const pc = new RTCPeerConnection({ iceServers });
    l.pc = pc;
    pc.addEventListener('connectionstatechange', () => {
      if (l.pc !== pc) return;
      if (pc.connectionState === 'failed') { if (l.state === 'open') drop(l); else toRelay(l, true); }
    });
    return pc;
  }

  function bindChannel(l, dc) {
    l.dc = dc;
    dc.addEventListener('open', () => { if (l.dc !== dc) return; l.state = 'open'; greet(l); });
    dc.addEventListener('close', () => { if (l.dc === dc && l.state === 'open') drop(l); });
    dc.addEventListener('message', (e) => { if (typeof e.data === 'string' && e.data.length < 256 * 1024) { try { onEnvelope(l, JSON.parse(e.data)); } catch { /* ignore */ } } });
  }

  async function startOffer(l) {
    l.state = 'offering'; l.startedAt = Date.now();
    try {
      const pc = newPc(l);
      bindChannel(l, pc.createDataChannel('eh', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc);
      if (l.pc !== pc) return;
      signal(l, { type: 'offer', sdp: pc.localDescription.sdp });
    } catch { toRelay(l, true); }
  }

  async function onOffer(l, sdp) {
    if (l.state === 'open' || l.state === 'relay') return;
    if (!useRtc) { toRelay(l, true); return; }
    l.state = 'answering'; l.startedAt = Date.now();
    try {
      const pc = newPc(l);
      pc.addEventListener('datachannel', (e) => bindChannel(l, e.channel));
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc);
      if (l.pc !== pc) return;
      signal(l, { type: 'answer', sdp: pc.localDescription.sdp });
    } catch { toRelay(l, true); }
  }

  async function onAnswer(l, sdp) {
    if (l.state !== 'offering' || !l.pc) return;
    try { await l.pc.setRemoteDescription({ type: 'answer', sdp }); } catch { toRelay(l, true); }
  }

  function closePc(l) {
    try { l.dc?.close(); } catch { /* already closed */ }
    try { l.pc?.close(); } catch { /* already closed */ }
    l.dc = null; l.pc = null;
  }

  function toRelay(l, tell) {
    if (l.state === 'relay' || l.state === 'gone') return;
    closePc(l);
    l.state = 'relay';
    if (tell) l.out.push({ sig: { type: 'relay' } });
    greet(l);
    nudge();
  }

  function drop(l) {
    if (l.state === 'gone') return;
    l.state = 'gone';
    closePc(l);
    links.delete(l.peer);
    for (const name of l.rooms.keys()) rooms.get(name)?.notify([], [{ peer: l.peer }]);
    l.rooms.clear();
  }

  function onMail(m) {
    const l = linkFor(m.from);
    if (!l) return;
    l.seenAt = Date.now();
    for (const it of m.items) {
      if (!it || typeof it !== 'object') continue;
      if (it.sig) {
        const s = it.sig;
        if (s.type === 'offer' && typeof s.sdp === 'string') onOffer(l, s.sdp);
        else if (s.type === 'answer' && typeof s.sdp === 'string') onAnswer(l, s.sdp);
        else if (s.type === 'relay') toRelay(l, false);
      } else if (it.m) {
        if (l.state !== 'relay') toRelay(l, false);
        onEnvelope(l, it.m);
      }
    }
  }

  // ------------------------------------------------------------ envelopes
  function sendTo(l, env) {
    if (l.state === 'open' && l.dc?.readyState === 'open') {
      if (l.dc.bufferedAmount > 4 * 1024 * 1024) return;      // the link is choking: drop rather than stall
      try { l.dc.send(JSON.stringify(env)); } catch { /* closed meanwhile */ }
    } else if (l.state === 'relay') {
      if (env.t === 'p' && !env.ask) l.out = l.out.filter((x) => !(x.m && x.m.t === 'p' && !x.m.ask && x.m.r === env.r));
      l.out.push({ m: env });
      if (l.out.length > MAX_QUEUE) l.out.splice(0, l.out.length - MAX_QUEUE);
      nudge();
    }
  }
  const reachable = (l) => l.state === 'open' || l.state === 'relay';

  function greet(l) {
    if (!reachable(l)) return;
    const rs = {};
    for (const [name, r] of rooms) rs[name] = r.mine;
    sendTo(l, { t: 'hi', u: myId, rs, cap: 1 });
  }

  function onEnvelope(l, env) {
    if (!env || typeof env !== 'object') return;
    if (env.t === 'hi') {
      if (typeof env.u === 'string' && env.u.length <= 128) { l.claimed = env.u; settleUid(l); }
      l.cap = env.cap === 1;
      const theirs = env.rs && typeof env.rs === 'object' ? env.rs : {};
      for (const [name, r] of rooms) {
        const p = theirs[name];
        const had = l.rooms.has(name);
        if (p && typeof p === 'object') { l.rooms.set(name, { presence: Object.freeze({ ...p }), at: Date.now() }); r.notify(had ? [] : [{ peer: l.peer }], [], had ? [{ peer: l.peer }] : []); }
        else if (had) { l.rooms.delete(name); r.notify([], [{ peer: l.peer }]); }
      }
      // first greeting from this side reaches them too (relay pairs greet each other once)
      if (!l.greeted) { l.greeted = true; if (l.state === 'relay') greet(l); }
    } else if (env.t === 'p') {
      const r = rooms.get(env.r);
      if (!r) return;
      const had = l.rooms.get(env.r);
      let presence;
      if (env.d && typeof env.d === 'object' && !Array.isArray(env.d)) {
        // a change-only update: needs the full copy it builds on; if that never arrived, ask for it
        if (!had) { sendTo(l, { t: 'p', r: env.r, p: r.mine, ask: 1 }); return; }
        if (Object.keys(env.d).length > 64) return;
        presence = { ...had.presence, ...env.d };
        if (Array.isArray(env.x)) for (const k of env.x.slice(0, 64)) if (typeof k === 'string') delete presence[k];
      } else if (env.p && typeof env.p === 'object') presence = { ...env.p };
      else return;
      l.rooms.set(env.r, { presence: Object.freeze(presence), at: Date.now() });
      if (had) r.notifyLater(l.peer); else r.notify([{ peer: l.peer }], [], []);
      if (env.ask) sendTo(l, { t: 'p', r: env.r, p: r.mine });
    } else if (env.t === 'x') {
      if (l.rooms.delete(env.r)) rooms.get(env.r)?.notify([], [{ peer: l.peer }]);
    } else if (env.t === 'e') {
      const r = rooms.get(env.r);
      if (!r || !l.rooms.has(env.r) || typeof env.k !== 'string') return;
      r.deliver({ topic: env.k, data: env.d, peer: l.peer, by: l.uid, isMe: false, sameTab: false });
    } else if (env.t === 'bye') {
      drop(l);
    }
  }

  // ------------------------------------------------------------ rooms
  function makeRoom(name) {
    const handlers = new Map();
    const peerFns = new Set();
    let snapshot = [];
    const room = {
      name, mine: Object.freeze({}), at: Date.now(),
      members() { return [...links.values()].filter((l) => reachable(l) && l.rooms.has(name)); },
      rebuild() {
        snapshot = Object.freeze([
          { peer: myPeer, by: myId, isMe: true, sameTab: true, presence: room.mine, updatedAt: room.at },
          ...room.members().map((l) => ({ peer: l.peer, by: l.uid, isMe: false, sameTab: false, presence: l.rooms.get(name).presence, updatedAt: l.rooms.get(name).at })),
        ]);
      },
      // many small updates from other players become one notice every NOTIFY_MS (the game re-reads everyone on each notice)
      pending: new Set(), pendingTimer: null,
      notifyLater(peer) {
        room.pending.add(peer);
        if (room.pendingTimer) return;
        room.pendingTimer = setTimeout(() => { room.pendingTimer = null; const list = [...room.pending].map((p) => ({ peer: p })); room.pending.clear(); if (list.length) room.notify([], [], list); }, NOTIFY_MS);
      },
      notify(joined = [], left = [], updated = []) { room.rebuild(); for (const fn of peerFns) { try { fn({ peers: snapshot, joined, left, updated }); } catch (e) { console.error(e); } } },
      deliver(m) { const set = handlers.get(m.topic); if (set) for (const fn of [...set]) { try { fn(m); } catch (e) { console.error(e); } } },
      api: {
        name,
        // opts.to: send to one player only (big answers such as a profile card are not sent to everyone)
        async emit(topic, data, opts = null) {
          if (!TOPIC_RE.test(topic)) return;
          const env = { t: 'e', r: name, k: topic, d: data };
          for (const l of room.members()) if (!opts?.to || l.peer === opts.to) sendTo(l, env);
          room.deliver({ topic, data, peer: myPeer, by: myId, isMe: true, sameTab: true });
        },
        on(topic, fn) {
          if (!handlers.has(topic)) handlers.set(topic, new Set());
          handlers.get(topic).add(fn);
          return () => handlers.get(topic)?.delete(fn);
        },
        async presence(patch) {
          const next = { ...room.mine };
          const changed = {}, removed = [];
          for (const [k, v] of Object.entries(patch || {})) {
            if (v === null || v === undefined) { if (k in next) { delete next[k]; removed.push(k); } }
            else if (!same(next[k], v)) { next[k] = v; changed[k] = v; }
          }
          const nothing = !removed.length && !Object.keys(changed).length;
          room.mine = Object.freeze(next); room.at = Date.now();
          const now = Date.now();
          const full = { t: 'p', r: name, p: room.mine };
          const delta = nothing ? null : { t: 'p', r: name, d: changed, ...(removed.length ? { x: removed } : {}) };
          for (const l of room.members()) {
            // players who understand deltas get only what changed (links through the hub always get the full copy:
            // the hub path keeps only the newest presence message per room)
            if (l.state === 'open' && l.cap && now - (l.fullAt.get(name) || 0) < FULL_EVERY) { if (delta) sendTo(l, delta); }
            else { l.fullAt.set(name, now); sendTo(l, full); }
          }
          if (!nothing) room.notify([], [], [{ peer: myPeer }]);
        },
        peers: () => snapshot,
        onPeers(fn) { peerFns.add(fn); queueMicrotask(() => { try { fn({ peers: snapshot, joined: snapshot, left: [], updated: [] }); } catch (e) { console.error(e); } }); return () => peerFns.delete(fn); },
        connected: () => hubOk || [...links.values()].some((l) => l.state === 'open'),
        async leave() {
          if (name === 'lobby' || !rooms.has(name)) return;
          for (const l of room.members()) sendTo(l, { t: 'x', r: name });
          rooms.delete(name);
          for (const l of links.values()) l.rooms.delete(name);
        },
      },
    };
    rooms.set(name, room);
    room.rebuild();
    // tell everyone I'm here and ask members for their presence
    for (const l of links.values()) if (reachable(l)) sendTo(l, { t: 'p', r: name, p: room.mine, ask: 1 });
    return room;
  }

  // ------------------------------------------------------------ start
  const lobby = makeRoom('lobby');
  try {
    const res = await post({ ...auth(), send: [], sweep: true });
    uidVerified = res.uid === myId;
    hubOk = true; lastSync = Date.now();
    onRoster(Array.isArray(res.peers) ? res.peers : []);
    for (const m of res.mail || []) onMail(m);
  } catch {
    closed = true;
    return null;      // no hub here (plain static hosting): the caller falls back to offline
  }
  schedule(FAST);

  const leaveHub = () => {
    for (const l of links.values()) if (l.state === 'open') { try { l.dc.send(JSON.stringify({ t: 'bye' })); } catch { /* closing */ } }
    try { navigator.sendBeacon?.(`${base}/hub`, new Blob([JSON.stringify({ ...auth(), leave: true })], { type: 'application/json' })); } catch { /* page closing */ }
  };
  if (typeof addEventListener === 'function') addEventListener('pagehide', leaveHub);

  const net = {
    kind: 'mesh', mode: 'mesh', online: true, reason: '', myId, myPeer, canSend: true,
    me: { peer: myPeer, id: myId },
    lobby: lobby.api,
    async join(name) {
      if (!ROOM_RE.test(name)) throw new Error('bad room name');
      return (rooms.get(name) || makeRoom(name)).api;
    },
    onSendRefused(fn) { refusedFns.add(fn); return () => refusedFns.delete(fn); },
    // diagnostics (tests and the settings panel)
    stats() {
      const s = { open: 0, relay: 0, connecting: 0, hub: hubOk, lastSync, uidVerified };
      for (const l of links.values()) { if (l.state === 'open') s.open++; else if (l.state === 'relay') s.relay++; else s.connecting++; }
      return s;
    },
    close() { if (closed) return; leaveHub(); closed = true; clearTimeout(timer); for (const l of [...links.values()]) drop(l); },
  };
  return net;
}

// ---------------------------------------------------------------- shared documents through the hub
// doc(path) → { get, set, update, onSnapshot }. Snapshots poll while watched; a failed read keeps the last value
// (a network hiccup must not look like "the guild was deleted").
export function createHubDocs({ base = '/api', uid = null, ukey = null, fetchImpl = (...a) => fetch(...a), every = 4000 } = {}) {
  const watchers = new Map();   // path → { fns:Set, last, timer }
  async function read(path) {
    const r = await fetchImpl(`${base}/docs?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('docs ' + r.status);
    return (await r.json()).data ?? null;
  }
  async function write(path, op, value) {
    const r = await fetchImpl(`${base}/docs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, op, value }) });
    if (!r.ok) throw new Error('docs ' + r.status);
    const out = await r.json();
    const w = watchers.get(path);
    if (w) publish(path, out.data ?? null);
    return out;
  }
  function publish(path, data) {
    const w = watchers.get(path);
    if (!w) return;
    const key = JSON.stringify(data);
    if (key === w.last) return;
    w.last = key;
    for (const fn of [...w.fns]) { try { fn(data); } catch (e) { console.error(e); } }
  }
  async function poll(path) {
    const w = watchers.get(path);
    if (!w) return;
    try { publish(path, await read(path)); } catch { /* keep last */ }
    if (watchers.get(path) === w) w.timer = setTimeout(() => poll(path), every);
  }
  return {
    kind: 'hub',
    // Guild actions are checked and applied by the server (netlify/lib/guildRules.mjs); the result updates watchers.
    async guildOp(op, gid, args = {}) {
      const r = await fetchImpl(`${base}/docs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...args, op, gid, uid, ukey }) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, reason: out.error || 'write_failed' };
      publish(`guilds/${gid}`, out.data ?? null);
      return { ok: true, data: out.data };
    },
    doc(path) {
      return {
        get: () => read(path),
        set: (data) => write(path, 'set', data),
        update: (data) => write(path, 'update', data),
        onSnapshot(fn) {
          let w = watchers.get(path);
          if (!w) { w = { fns: new Set(), last: undefined, timer: null }; watchers.set(path, w); poll(path); }
          else if (w.last !== undefined) { const v = JSON.parse(w.last); queueMicrotask(() => fn(v)); }
          w.fns.add(fn);
          return () => { w.fns.delete(fn); if (!w.fns.size) { clearTimeout(w.timer); watchers.delete(path); } };
        },
      };
    },
  };
}
