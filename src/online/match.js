// PvP rooms (1v1 / 2v2 / 3v3): the room host owns the roster and the round state and shares them as presence
// (absolute state, re-delivered to late joiners, so nothing is lost when a message drops). Every player owns their
// own hero and their own "knocked out" flag. Pure functions, unit-tested without a network.
export const MODES = Object.freeze({
  '1v1': { id: '1v1', size: 1, name: 'ดวล 1v1' },
  '2v2': { id: '2v2', size: 2, name: 'ทีม 2v2' },
  '3v3': { id: '3v3', size: 3, name: 'ทีม 3v3' },
  coop: { id: 'coop', size: 4, name: 'คณะสำรวจ', coop: true },      // online zone run: one team of up to four
  tower: { id: 'tower', size: 8, name: 'หอคอยขุมนรก', coop: true, tower: true },   // the Underworld Tower with friends: one team of up to eight
});
const ZONE_RE = /^(?:z(?:[1-9]|1[0-2])|r[1-3]|rush|tower)$/;   // zones, special dungeons and the Boss Rush (v8)
export const TEAMS = ['a', 'b'];
export const TEAM_INFO = Object.freeze({ a: { name: 'ทีมชาด', color: '#e0593f' }, b: { name: 'ทีมหยก', color: '#5fbfa8' } });
export const ROUNDS_TO_WIN = 2;
export const ROOM_TITLE_MAX = 24;

const okPeer = (p) => typeof p === 'string' && /^[A-Za-z0-9_.:@+~=/-]{1,128}$/.test(p);

export function getMode(id) { return MODES[id] || null; }

export function emptyRoster() { return { a: [], b: [] }; }

// Cleans a roster read from the host's presence.
export function readRoster(raw, mode) {
  const size = getMode(mode)?.size || 1;
  const out = emptyRoster();
  const seen = new Set();
  for (const t of TEAMS) {
    if (getMode(mode)?.coop && t === 'b') continue;
    for (const p of Array.isArray(raw?.[t]) ? raw[t] : []) {
      if (!okPeer(p) || seen.has(p) || out[t].length >= size) continue;
      seen.add(p); out[t].push(p);
    }
  }
  return out;
}

export function teamOf(roster, peer) {
  for (const t of TEAMS) if (roster[t].includes(peer)) return t;
  return null;
}

// A player asks for a seat (team = 'a' | 'b' | null for "any"). Returns the new roster or a reason.
export function seat(roster, peer, team, mode) {
  const size = getMode(mode)?.size;
  if (!size || !okPeer(peer)) return { ok: false, reason: 'bad' };
  const cur = teamOf(roster, peer);
  if (getMode(mode).coop) {
    if (cur) return { ok: true, roster };
    if (roster.a.length >= size) return { ok: false, reason: 'team_full' };
    return { ok: true, roster: { a: [...roster.a, peer], b: [] } };
  }
  const want = team && TEAMS.includes(team) ? team : cur || (roster.a.length <= roster.b.length ? 'a' : 'b');
  if (cur === want) return { ok: true, roster };
  const free = (t) => roster[t].length < size;
  const target = free(want) ? want : !team && free(want === 'a' ? 'b' : 'a') ? (want === 'a' ? 'b' : 'a') : null;
  if (!target) return { ok: false, reason: 'team_full' };
  const next = { a: roster.a.filter((p) => p !== peer), b: roster.b.filter((p) => p !== peer) };
  next[target] = [...next[target], peer];
  return { ok: true, roster: next };
}

export function unseat(roster, peer) {
  return { a: roster.a.filter((p) => p !== peer), b: roster.b.filter((p) => p !== peer) };
}

export function isFull(roster, mode) {
  const size = getMode(mode)?.size || 1;
  if (getMode(mode)?.coop) return roster.a.length >= size;
  return roster.a.length === size && roster.b.length === size;
}

// Everyone seated and ready (the host's ready is implied by pressing start).
export function canStart(roster, mode, ready, host) {
  if (getMode(mode)?.coop) {
    if (!roster.a.includes(host)) return { ok: false, reason: 'not_full' };
  } else if (!isFull(roster, mode)) return { ok: false, reason: 'not_full' };
  const waiting = [...roster.a, ...roster.b].filter((p) => p !== host && !ready[p]);
  return waiting.length ? { ok: false, reason: 'not_ready', waiting } : { ok: true };
}

// alive: peer → boolean (from each fighter's own presence). A team with nobody standing loses the round.
export function roundOutcome(roster, alive) {
  const up = (t) => roster[t].filter((p) => alive[p]).length;
  const a = up('a'), b = up('b');
  if (a > 0 && b > 0) return null;
  if (a === 0 && b === 0) return 'draw';
  return a > 0 ? 'a' : 'b';
}

export function matchWinner(score) {
  if (score.a >= ROUNDS_TO_WIN) return 'a';
  if (score.b >= ROUNDS_TO_WIN) return 'b';
  return null;
}

// Spawn points: team A on the left, team B on the right, spread vertically by seat.
export function spawnFor(team, slot, size, arena) {
  const x = team === 'a' ? arena.w * 0.24 : arena.w * 0.76;
  const span = arena.h - arena.wall * 2 - 160;
  const y = size === 1 ? arena.h * 0.58 : arena.wall + 100 + (span * (slot + 0.5)) / size;
  return { x, y };
}

export function cleanTitle(raw) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, ROOM_TITLE_MAX).join('');
}

// The lobby advert a host puts in its own lobby presence so others can list the room.
export function readAdvert(raw) {
  if (!raw || typeof raw !== 'object' || !/^[a-z0-9]{4,16}$/.test(raw.i || '') || !getMode(raw.m)) return null;
  const size = MODES[raw.m].size;
  const coop = !!MODES[raw.m].coop;
  if (coop && !ZONE_RE.test(raw.z || '')) return null;
  const max = coop ? size : size * 2;
  // a match in progress may be watched: its room channel and who is seated come with the advert
  const ch = !coop && raw.p && typeof raw.ch === 'string' && /^(?:pvp|duel)-[a-z0-9-]{4,40}$/.test(raw.ch) ? raw.ch : null;
  const ro = ch ? readRoster(raw.ro, raw.m) : null;
  const tower = !!MODES[raw.m].tower;
  return { id: raw.i, mode: raw.m, zone: coop ? raw.z : null, floor: tower ? Math.max(1, Math.min(100, (raw.f | 0) || 1)) : null, asc: tower ? Math.max(0, Math.min(999, raw.as | 0)) : 0, title: cleanTitle(raw.t) || MODES[raw.m].name, players: Math.max(0, Math.min(max, raw.n | 0)), playing: !!raw.p, max,
    watch: ch && ro && ro.a.length && ro.b.length ? { ch, roster: ro } : null };
}
