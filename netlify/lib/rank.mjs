// Leaderboards (อันดับ). Scores are computed HERE, from the save the player's account uploads (cloud push) —
// the client never sends a score. Saves the game itself flagged as edited outside the game are left out, and
// every value is clamped to what the game can really reach.
//
// One blob key holds every board: ranks → { [board]: [{ uid, n, a, v, t, lv, r, at }] } (top 100 each).
import { sanitize } from '../../src/persistence/save.js';
import { computeStats } from '../../src/systems/stats.js';
import { RACES } from '../../src/data/races.js';
import { PETS } from '../../src/data/pets.js';
import { TITLES } from '../../src/data/titles.js';
import { ZONES, RAIDS } from '../../src/data/zones.js';
import { GODS } from '../../src/data/tower.js';
import { publicCard } from '../../src/systems/profile.js';

export const TOP = 100;
const cnt = (o) => Object.keys(o || {}).length;
const clamp = (v, hi) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));

// board id → how its value is read from a (sanitized) save, and the most the game allows
export const BOARDS = Object.freeze({
  power: (s) => { const t = computeStats(s); return clamp(t.atk * 3 + t.def * 2.5 + t.maxHp * 0.35 + t.crit * 400 + (t.critMult - 1.5) * 60, 1e6); },
  level: (s) => clamp(s.player.level * 1e7 + Math.min(s.player.xp, 9_999_999), 100 * 1e7 + 9_999_999),
  tower: (s) => clamp(s.tower?.deepest || 0, 999 * 100 + 100),
  gods: (s) => clamp(cnt(s.tower?.gods) * 1e6 + Object.values(s.tower?.gods || {}).reduce((a, b) => a + b, 0), GODS.length * 1e6 + 999_999),
  kills: (s) => clamp(s.stats.kills, 1e9),
  pvp: (s) => clamp(s.pvp?.wins || 0, 1e7),
  rift: (s) => clamp(s.infinite?.best || 0, 1e5),
  raids: (s) => clamp(RAIDS.reduce((a, r) => a + (s.raids?.[r.id]?.kills || 0), 0), 1e7),
  zones: (s) => clamp(ZONES.reduce((a, z) => a + (s.zones?.cleared?.[z.id] || 0), 0), 1e7),
  pets: (s) => clamp(cnt(s.pets?.owned) * 100 + Object.values(s.pets?.owned || {}).reduce((a, p) => a + p.stars, 0), Object.keys(PETS).length * 105),
  races: (s) => clamp(cnt(s.raceSeen), Object.keys(RACES).length),
  titles: (s) => clamp(cnt(s.titles?.owned), TITLES.length),
  crafted: (s) => clamp(s.stats.crafted, 1e7),
  gold: (s) => clamp(s.gold, 1e12),
});
export const BOARD_IDS = Object.freeze(Object.keys(BOARDS));

// a transfer code → the sanitized save, or null
export function stateOfCode(code) {
  try {
    const body = String(code).split('.')[1];
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return sanitize(raw).state;
  } catch { return null; }
}
export function scoresOf(state) {
  if (!state || state.integrity === 'modified') return null;
  const out = {};
  for (const [id, f] of Object.entries(BOARDS)) { try { out[id] = f(state); } catch { out[id] = 0; } }
  return out;
}

const readJ = async (kv, k) => { const t = await kv.get(k); if (!t) return null; try { return JSON.parse(t); } catch { return null; } };

// called after a successful cloud push
export async function updateBoards(kv, uid, account, code, now = Date.now()) {
  const st = stateOfCode(code);
  const sc = scoresOf(st);
  const all = (await readJ(kv, 'ranks')) || {};
  let changed = false;
  for (const id of BOARD_IDS) {
    const list = Array.isArray(all[id]) ? all[id] : [];
    const i = list.findIndex((e) => e.uid === uid);
    if (!sc || sc[id] <= 0) { if (i >= 0) { list.splice(i, 1); changed = true; } all[id] = list; continue; }
    const entry = { uid, n: String(st.story.name || '').slice(0, 16), a: String(account || '').slice(0, 20), v: sc[id], t: st.titles?.equipped || null, lv: st.player.level, r: st.race?.id || null, at: now };
    if (i >= 0) { if (list[i].v === entry.v && list[i].n === entry.n && list[i].t === entry.t && list[i].lv === entry.lv) continue; list[i] = entry; }
    else if (list.length < TOP || entry.v > list[list.length - 1].v) list.push(entry);
    else continue;
    list.sort((a, b) => b.v - a.v || a.at - b.at);
    all[id] = list.slice(0, TOP);
    changed = true;
  }
  if (changed) await kv.set('ranks', JSON.stringify(all));
  // the public profile card shown when someone opens this player from a leaderboard (built here, from the save)
  if (st) { try { await kv.set('card/' + uid, JSON.stringify({ ...publicCard(st), acct: String(account || '').slice(0, 20) })); } catch { /* best-effort */ } }
  return sc;
}

export async function readBoard(kv, board, uid = null) {
  if (!BOARDS[board]) return null;
  const all = (await readJ(kv, 'ranks')) || {};
  const list = Array.isArray(all[board]) ? all[board] : [];
  const mine = uid ? list.findIndex((e) => e.uid === uid) : -1;
  return { board, entries: list.map(({ uid: _u, ...e }, i) => ({ ...e, rank: i + 1 })), me: mine >= 0 ? mine + 1 : null };
}
