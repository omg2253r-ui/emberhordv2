// v8.3 Resume a dungeon: the unfinished run of a story dungeon is kept in `state.dungeonRuns[stageId]`
// so the hero can leave (rest at camp, close the tab) and later continue from where they stopped.
//
// A snapshot only holds what the dungeon scene cannot rebuild by itself: which rooms are visited / cleared,
// chests opened, bonfires used, the seal key, the hero's HP and place, the enemies still alive in the current
// room (with their HP) and the run's counters for the result screen. Gold, XP, items and kills are already in
// the normal save, so nothing here is ever paid out twice.
//
// Pure functions (no DOM): they are used by the dungeon scene, the save sanitiser and the stage panel.
import { ROOM, getDungeon } from '../data/dungeons.js';
import { getEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { getStage } from '../data/stages.js';
import { BALANCE } from '../config/balance.js';

export const RUN_VERSION = 1;
export const MAX_FOES = 16;
export const MAX_RUN_ITEMS = 80;

const num = (v, d, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const int = (v, d, min, max) => Math.round(num(v, d, min, max));
const round3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------- reading the live dungeon world
// `w` is the dungeon scene's world: { stage, room, rooms: Map, player, enemies, keys, unsealed, run, parries }.
export function buildSnapshot(w, now = Date.now(), perfNow = (typeof performance !== 'undefined' ? performance.now() : 0)) {
  const rooms = {};
  for (const [id, rt] of w.rooms) {
    const r = {};
    if (rt.visited) r.vis = 1;
    if (rt.cleared && rt.def.waves?.length) r.clr = 1;
    if (rt.wave >= 0) r.wave = rt.wave;
    if (rt.chestOpened) r.chest = 1;
    if (rt.bonfireUsed) r.fire = 1;
    if (Object.keys(r).length) rooms[id] = r;
  }
  // enemies still to beat in the current room: the ones alive plus the ones about to spawn.
  // Only the room's own enemy types count (summons of a boss come back with the boss).
  const rt = w.room;
  const foes = [];
  if (rt && !rt.cleared) {
    const own = new Set((rt.def.waves || []).flat().map((s) => s.enemy));
    for (const e of w.enemies) if (!e.dead && own.has(e.type.id)) foes.push({ id: e.type.id, hp: round3(Math.max(0.01, Math.min(1, e.hp / e.maxHp))) });
    for (const q of rt.queue) if (own.has(q.enemy)) foes.push({ id: q.enemy, hp: q.hp ? round3(q.hp) : 1 });
  }
  const items = {};
  for (const [id, qty] of w.run.items) items[id] = qty;
  const p = w.player;
  return {
    v: RUN_VERSION, at: now,
    room: rt.def.id, x: Math.round(p.x), y: Math.round(p.y),
    hp: round3(Math.max(0.01, Math.min(1, p.hp / p.maxHp))),
    keys: w.keys, unsealed: !!w.unsealed,
    rooms, foes: foes.slice(0, MAX_FOES),
    run: {
      gold: w.run.gold, sparks: w.run.sparks, xp: w.run.xp, kills: w.run.kills, levelUps: w.run.levelUps,
      rooms: w.run.rooms, chests: w.run.chests, lore: w.run.lore, bestCombo: w.run.bestCombo, perfects: w.run.perfects,
      bossKills: w.run.bossKills || 0, parries: w.parries || 0,
      secs: Math.max(0, Math.round((perfNow - w.run.start) / 1000)), items,
    },
  };
}

// ---------------------------------------------------------------- reading it back from a save
// Returns a clean snapshot for `stageId`, or null when it cannot be used (unknown stage, a room that no longer
// exists, a finished boss room). An edited or out-of-date snapshot is therefore simply dropped, never half-applied.
export function cleanRun(raw, stageId) {
  if (!raw || typeof raw !== 'object' || !getStage(stageId)) return null;
  const dungeon = getDungeon(stageId);
  if (!dungeon) return null;
  const byId = new Map(dungeon.rooms.map((r) => [r.id, r]));
  const cur = byId.get(raw.room);
  if (!cur || raw.v !== RUN_VERSION) return null;

  const rooms = {};
  for (const [id, r] of Object.entries(raw.rooms || {})) {
    const def = byId.get(id);
    if (!def || !r || typeof r !== 'object') continue;
    const o = {};
    if (r.vis) o.vis = 1;
    if (r.clr && def.waves?.length) o.clr = 1;
    if (def.waves?.length && typeof r.wave === 'number') o.wave = int(r.wave, -1, -1, def.waves.length - 1);
    if (r.chest && def.chest) o.chest = 1;
    if (r.fire && def.bonfire) o.fire = 1;
    if (o.wave === -1) delete o.wave;
    if (Object.keys(o).length) rooms[id] = o;
  }
  rooms[cur.id] = { ...(rooms[cur.id] || {}), vis: 1 };
  const boss = dungeon.rooms.find((r) => r.type === 'boss');
  if (boss && rooms[boss.id]?.clr) return null;                       // the boss is already down: nothing to resume
  const unsealed = raw.unsealed === true || !!rooms[boss?.id]?.vis;  // seen the boss room → the seal is broken

  const foes = [];
  const own = new Set((cur.waves || []).flat().map((s) => s.enemy));
  if (!rooms[cur.id].clr) {
    for (const f of Array.isArray(raw.foes) ? raw.foes : []) {
      if (foes.length >= MAX_FOES) break;
      if (f && typeof f.id === 'string' && getEnemy(f.id) && own.has(f.id)) foes.push({ id: f.id, hp: num(f.hp, 1, 0.01, 1) });
    }
  }

  const rr = raw.run || {};
  const items = {};
  let nItems = 0;
  for (const [id, qty] of Object.entries(rr.items || {})) {
    if (nItems >= MAX_RUN_ITEMS) break;
    if (getItem(id)) { items[id] = int(qty, 1, 1, BALANCE.inventory.maxStack * 50); nItems++; }
  }
  const big = 1e9;
  return {
    v: RUN_VERSION, at: int(raw.at, 0, 0, 9e15),
    room: cur.id,
    x: int(raw.x, ROOM.w / 2, 0, ROOM.w), y: int(raw.y, ROOM.h / 2, 0, ROOM.h),
    hp: num(raw.hp, 1, 0.01, 1),
    keys: int(raw.keys, 0, 0, 3), unsealed,
    rooms, foes,
    run: {
      gold: int(rr.gold, 0, 0, big), sparks: int(rr.sparks, 0, 0, big), xp: int(rr.xp, 0, 0, big), kills: int(rr.kills, 0, 0, big),
      levelUps: int(rr.levelUps, 0, 0, 1000), rooms: int(rr.rooms, 0, 0, dungeon.rooms.length), chests: int(rr.chests, 0, 0, dungeon.rooms.length),
      lore: int(rr.lore, 0, 0, dungeon.rooms.length), bestCombo: int(rr.bestCombo, 0, 0, 1e6), perfects: int(rr.perfects, 0, 0, big),
      bossKills: int(rr.bossKills, 0, 0, 100), parries: int(rr.parries, 0, 0, big),
      secs: int(rr.secs, 0, 0, 86400 * 7), items,
    },
  };
}

export function cleanRuns(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [stageId, r] of Object.entries(raw)) {
    const c = cleanRun(r, stageId);
    if (c) out[stageId] = c;
  }
  return out;
}

// ---------------------------------------------------------------- state helpers
export function getRun(state, stageId) {
  return state?.dungeonRuns?.[stageId] || null;
}

// In-place edits on a cloned state (the caller commits it).
export function setRunInPlace(next, stageId, snap) {
  next.dungeonRuns = { ...(next.dungeonRuns || {}), [stageId]: snap };
}
export function clearRunInPlace(next, stageId) {
  if (!next.dungeonRuns || !(stageId in next.dungeonRuns)) return false;
  next.dungeonRuns = { ...next.dungeonRuns };
  delete next.dungeonRuns[stageId];
  return true;
}

// What the stage panel shows for a saved run.
export function runSummary(snap, stageId) {
  const dungeon = getDungeon(stageId);
  if (!snap || !dungeon) return null;
  const visited = Object.values(snap.rooms).filter((r) => r.vis).length;
  const room = dungeon.rooms.find((r) => r.id === snap.room);
  return {
    roomName: room?.name || '',
    visited, total: dungeon.rooms.length,
    hpPct: Math.round(snap.hp * 100),
    keys: snap.keys, unsealed: snap.unsealed,
    chests: snap.run.chests, kills: snap.run.kills,
    secs: snap.run.secs, at: snap.at,
  };
}
