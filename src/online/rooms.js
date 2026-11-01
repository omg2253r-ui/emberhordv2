// PvP rooms in the village: create a 1v1 / 2v2 / 3v3 room, others join it from the room list, pick a team,
// get ready, and the host starts the match. The host advertises the room in its lobby presence (`pr`) and keeps
// the roster in the room's presence (`rm`), so the list and the seats are always the current state.
import { PROTOCOL, lookOf, readPresence } from './protocol.js';
import { MODES, getMode, emptyRoster, readRoster, seat, unseat, teamOf, canStart, cleanTitle, isFull } from './match.js';
import { getZone } from '../data/zones.js';
import { towerLock, startFloors, towerProgress } from '../data/tower.js';

const SEAT_RETRY = 1500;
const GONE_AFTER = 3000;

const roomId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

export function createRooms(app) {
  const subs = new Set();
  let cur = null;
  let timer = null;
  const online = () => app.online;
  const me = () => online().me.peer;
  const changed = () => { for (const fn of subs) fn(cur); };

  // ------------------------------------------------------------ list (other hosts' adverts)
  function list() {
    return online().peers.filter((x) => x.p.room).map((x) => ({ ...x.p.room, host: x.peer, hostName: x.p.name, hostLv: x.p.lv }));
  }

  // ------------------------------------------------------------ my room
  function roomPresence() {
    const st = app.store.get();
    return { v: PROTOCOL, ...lookOf(st), rdy: cur.ready[me()] ? 1 : 0, rm: cur.amHost ? { m: cur.mode, t: cur.title, z: cur.zone || null, f: cur.floor || undefined, as: cur.asc || undefined, ro: cur.roster, st: cur.started ? 'match' : 'lobby' } : null };
  }
  function advertise() {
    if (!cur?.amHost) return;
    const n = cur.roster.a.length + cur.roster.b.length;
    online().publish({ pr: cur.started ? null : { i: cur.id, m: cur.mode, t: cur.title, z: cur.zone || undefined, f: cur.floor || undefined, as: cur.asc || undefined, n, p: 0 } });
  }
  function share() { if (cur) { cur.ch.presence(roomPresence()); advertise(); } }

  async function open(id, opts) {
    const ch = await online().net.join('pvp-' + id);
    cur = { id, ch, mode: opts.mode, zone: opts.zone || null, floor: opts.floor || null, asc: opts.asc || 0, title: opts.title, host: opts.host, amHost: opts.host === me(), roster: opts.roster || emptyRoster(), ready: {}, members: new Map(), started: false, joinedAt: Date.now(), seatTries: 0, unsub: [] };
    cur.unsub.push(ch.on('match', onMessage));
    cur.unsub.push(ch.onPeers(onPeers));
    clearInterval(timer);
    timer = setInterval(tick, 500);
    share();
    changed();
  }

  async function create(mode, title, zone = null, extra = {}) {
    if (!online().canSend()) return { ok: false, reason: online().online ? 'view_only' : 'offline' };
    const md = getMode(mode);
    let floor = null, asc = 0;
    if (md?.tower) {
      // the tower with friends: the room's floor is one the host may start from, and the host's own ascension
      const st = app.store.get(), lock = towerLock(st);
      if (lock) return { ok: false, reason: 'tower_locked', detail: lock };
      floor = extra.floor | 0;
      if (!startFloors(st).includes(floor)) return { ok: false, reason: 'floor_locked' };
      asc = st.tower?.asc || 0; zone = 'tower';
    } else if (!md || (md.coop && !getZone(zone))) return { ok: false, reason: 'bad_mode' };
    if (!md.coop && app.store.get().integrity === 'modified') return { ok: false, reason: 'save_modified' };
    if (cur) await leave();
    const t = cleanTitle(title) || (md.tower ? `หอคอยขุมนรก ชั้น ${floor}` : md.coop ? `สำรวจ${getZone(zone).name}` : `${MODES[mode].name} ของ ${app.store.get().story.name}`);
    try { await open(roomId(), { mode, zone, floor, asc, title: cleanTitle(t), host: me(), roster: seat(emptyRoster(), me(), 'a', mode).roster }); }
    catch { return { ok: false, reason: 'join_failed' }; }
    return { ok: true };
  }

  async function join(ad) {
    if (!online().canSend()) return { ok: false, reason: online().online ? 'view_only' : 'offline' };
    if (ad.playing || ad.players >= ad.max) return { ok: false, reason: 'room_full' };
    if (!getMode(ad.mode)?.coop && app.store.get().integrity === 'modified') return { ok: false, reason: 'save_modified' };
    if (cur?.id === ad.id) return { ok: true };
    if (getMode(ad.mode)?.tower) {
      // a friend's tower climb: I need the tower itself, and to have reached the room's floor in the room's ascension
      const st = app.store.get(), lock = towerLock(st), t = towerProgress(st);
      if (lock) return { ok: false, reason: 'tower_locked', detail: lock };
      if (ad.asc > t.asc || (ad.asc === t.asc && ad.floor > t.best + 1)) return { ok: false, reason: 'floor_locked', detail: `ต้องผ่านชั้น ${Math.max(1, ad.floor - 1)} ก่อนจึงจะเข้าห้องนี้ได้` };
    }
    if (cur) await leave();
    if (ad.zone && !getMode(ad.mode)?.tower && app.zoneLock?.(ad.zone)) return { ok: false, reason: 'zone_locked', detail: app.zoneLock(ad.zone) };
    try { await open(ad.id, { mode: ad.mode, zone: ad.zone, floor: ad.floor, asc: ad.asc, title: ad.title, host: ad.host, roster: emptyRoster() }); }
    catch { return { ok: false, reason: 'join_failed' }; }
    askSeat(null);
    return { ok: true };
  }

  function askSeat(team) {
    if (!cur) return;
    if (cur.amHost) { const r = seat(cur.roster, me(), team, cur.mode); if (r.ok) { cur.roster = r.roster; share(); changed(); } return r; }
    cur.wantTeam = team; cur.seatAt = Date.now(); cur.seatTries += 1;
    cur.ch.emit('match', { k: 'seat', team });
    return { ok: true };
  }

  function setReady(v) {
    if (!cur) return;
    cur.ready[me()] = !!v;
    share(); changed();
  }

  function start() {
    if (!cur?.amHost) return { ok: false, reason: 'not_host' };
    const r = canStart(cur.roster, cur.mode, cur.ready, me());
    if (!r.ok) return r;
    cur.started = true;
    share();
    launch();
    return { ok: true };
  }

  function launch() {
    const c = cur;
    clearInterval(timer); timer = null;
    for (const u of c.unsub) u();
    cur = null;
    changed();
    if (getMode(c.mode).tower) app.startTowerRoom({ room: c.ch, floor: c.floor, asc: c.asc, host: c.host, roster: [...c.roster.a], title: c.title });
    else if (getMode(c.mode).coop) app.startZone({ room: c.ch, zoneId: c.zone, host: c.host, roster: [...c.roster.a], title: c.title });
    else app.startMatch({ room: c.ch, roomName: 'pvp-' + c.id, mode: c.mode, host: c.host, roster: c.roster, title: c.title });
  }

  async function leave() {
    if (!cur) return;
    const c = cur;
    cur = null;
    clearInterval(timer); timer = null;
    for (const u of c.unsub) u();
    if (c.amHost) online().publish({ pr: null });
    await c.ch.leave().catch(() => {});
    changed();
  }

  // ------------------------------------------------------------ room traffic
  function onMessage(m) {
    if (!cur || m.sameTab) return;
    const d = m.data || {};
    if (cur.amHost && d.k === 'seat') {
      const r = seat(cur.roster, m.peer, d.team === 'a' || d.team === 'b' ? d.team : null, cur.mode);
      if (r.ok) { cur.roster = r.roster; delete cur.ready[m.peer]; share(); changed(); }
      else cur.ch.emit('match', { k: 'seat_no', to: m.peer, reason: r.reason });
    } else if (!cur.amHost && d.k === 'seat_no' && d.to === me() && m.peer === cur.host) {
      app.toast(d.reason === 'team_full' ? 'ทีมนั้นเต็มแล้ว' : 'ห้องเต็มแล้ว', 'warn', 'room');
      cur.wantTeam = undefined;
      if (!teamOf(cur.roster, me())) leave();
    }
  }

  function onPeers(c) {
    if (!cur) return;
    cur.members.clear();
    for (const p of c.peers) {
      if (p.kind === 'agent') continue;
      const clean = p.sameTab ? null : readPresence(p.presence);
      cur.members.set(p.peer, { peer: p.peer, me: p.sameTab, name: p.sameTab ? app.store.get().story.name : clean?.name || 'นักล่า', lv: p.sameTab ? app.store.get().player.level : clean?.lv || 1, race: p.sameTab ? app.store.get().race?.id : clean?.race, seen: Date.now() });
      if (!p.sameTab) cur.ready[p.peer] = !!p.presence?.rdy;
      if (!cur.amHost && p.peer === cur.host && p.presence?.rm) {
        const rm = p.presence.rm;
        if (getMode(rm.m)) cur.mode = rm.m;
        if (getZone(rm.z)) cur.zone = rm.z;
        if (rm.z === 'tower' && getMode(rm.m)?.tower) { cur.zone = 'tower'; cur.floor = Math.max(1, Math.min(100, rm.f | 0 || 1)); cur.asc = Math.max(0, Math.min(999, rm.as | 0)); }
        cur.title = cleanTitle(rm.t) || cur.title;
        cur.roster = readRoster(rm.ro, cur.mode);
        cur.hostSeen = Date.now();
        if (rm.st === 'match' && teamOf(cur.roster, me())) { launch(); return; }
      }
    }
    if (cur.amHost) {
      // seats of players who left the room are freed
      let r = cur.roster;
      for (const peer of [...r.a, ...r.b]) if (peer !== me() && !cur.members.has(peer)) r = unseat(r, peer);
      if (r !== cur.roster && JSON.stringify(r) !== JSON.stringify(cur.roster)) { cur.roster = r; share(); }
    }
    // the drawer only redraws when something it shows changed
    const key = JSON.stringify([cur.mode, cur.zone, cur.floor, cur.asc, cur.title, cur.roster, cur.ready, [...cur.members.values()].map((m) => [m.peer, m.name, m.race])]);
    if (key !== cur.viewKey) { cur.viewKey = key; changed(); }
  }

  function tick() {
    if (!cur) return;
    if (!cur.amHost) {
      const hostHere = cur.members.has(cur.host);
      if (!hostHere && Date.now() - cur.joinedAt > GONE_AFTER + 2000) { app.toast('เจ้าของห้องปิดห้องแล้ว', 'info', 'room'); leave(); return; }
      // keep asking for a seat until the host's roster has me (messages can drop)
      if (!teamOf(cur.roster, me()) && cur.wantTeam !== undefined && Date.now() - cur.seatAt > SEAT_RETRY) {
        if (cur.seatTries > 6) { app.toast('เข้าห้องไม่สำเร็จ ห้องอาจเต็ม', 'warn', 'room'); leave(); return; }
        askSeat(cur.wantTeam);
      }
      if (cur.wantTeam && teamOf(cur.roster, me()) === cur.wantTeam) cur.wantTeam = null;
    }
  }

  return {
    list, create, join, leave, start, setReady,
    pick: (team) => askSeat(team),
    get current() { return cur; },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    canStartNow() { return cur?.amHost ? canStart(cur.roster, cur.mode, cur.ready, me()) : { ok: false, reason: 'not_host' }; },
    isFull: () => !!cur && isFull(cur.roster, cur.mode),
  };
}
