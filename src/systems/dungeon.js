// Dungeon map helpers and validation (pure, testable without a browser).
import { DUNGEONS, CHEST_LOOT, ROOM } from '../data/dungeons.js';
import { getEnemy } from '../data/enemies.js';
import { LORE } from '../data/story.js';
import { validateDropTable } from './loot.js';

export const DIRS = Object.freeze({ N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] });
export const OPPOSITE = Object.freeze({ N: 'S', S: 'N', W: 'E', E: 'W' });

export function roomAt(dungeon, x, y) {
  return dungeon.rooms.find((r) => r.at[0] === x && r.at[1] === y) || null;
}

export function roomById(dungeon, id) {
  return dungeon.rooms.find((r) => r.id === id) || null;
}

// Doors of a room: [{ dir, to }]. A door exists when the neighbour exists and neither side walls it off.
export function doorsOf(dungeon, room) {
  const out = [];
  for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
    const n = roomAt(dungeon, room.at[0] + dx, room.at[1] + dy);
    if (!n) continue;
    if ((room.walls || []).includes(dir) || (n.walls || []).includes(OPPOSITE[dir])) continue;
    out.push({ dir, to: n.id });
  }
  return out;
}

// Shortest room path (list of room ids) from a to b. `blocked(roomId)` can forbid rooms.
export function findPath(dungeon, fromId, toId, blocked = () => false) {
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const id = queue.shift();
    if (id === toId) break;
    for (const d of doorsOf(dungeon, roomById(dungeon, id))) {
      if (prev.has(d.to) || (d.to !== toId && blocked(d.to))) continue;
      prev.set(d.to, id); queue.push(d.to);
    }
  }
  if (!prev.has(toId)) return null;
  const path = [];
  for (let id = toId; id != null; id = prev.get(id)) path.unshift(id);
  return path;
}

export function startRoom(dungeon) { return dungeon.rooms.find((r) => r.type === 'start'); }
export function bossRoom(dungeon) { return dungeon.rooms.find((r) => r.type === 'boss'); }

// Every enemy that can appear in a dungeon (for stage previews).
export function dungeonEnemies(dungeon) {
  const ids = new Set();
  for (const r of dungeon.rooms) for (const w of r.waves || []) for (const s of w) ids.add(s.enemy);
  return [...ids];
}

export function validateDungeon(stageId, dungeon = DUNGEONS[stageId]) {
  const errors = [];
  if (!dungeon) return [`${stageId}: no dungeon`];
  const ids = new Set(), cells = new Set();
  for (const r of dungeon.rooms) {
    if (ids.has(r.id)) errors.push(`${stageId}: duplicate room id ${r.id}`);
    ids.add(r.id);
    const c = r.at.join(',');
    if (cells.has(c)) errors.push(`${stageId}: two rooms at ${c}`);
    cells.add(c);
    for (const w of r.waves || []) for (const s of w) if (!getEnemy(s.enemy)) errors.push(`${stageId}/${r.id}: unknown enemy ${s.enemy}`);
    const pts = [r.lore, r.chest, r.bonfire, ...(r.traps || []).filter((t) => t.x != null)].filter(Boolean);
    for (const p of pts) if (!(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) errors.push(`${stageId}/${r.id}: position outside room`);
    if (r.lore && !LORE[r.lore.id]) errors.push(`${stageId}/${r.id}: unknown lore ${r.lore.id}`);
    if (r.chest && !CHEST_LOOT[r.chest.loot]) errors.push(`${stageId}/${r.id}: unknown chest loot ${r.chest.loot}`);
    if ((r.type === 'fight' || r.type === 'key' || r.type === 'boss') && !(r.waves && r.waves.length)) errors.push(`${stageId}/${r.id}: ${r.type} room needs waves`);
  }
  const start = startRoom(dungeon), boss = bossRoom(dungeon), keys = dungeon.rooms.filter((r) => r.chest?.key);
  if (!start) errors.push(`${stageId}: no start room`);
  if (!boss) errors.push(`${stageId}: no boss room`);
  if (keys.length !== 1) errors.push(`${stageId}: needs exactly one key chest`);
  if (start && boss && keys.length === 1) {
    // the key must be reachable without walking through the (sealed) boss room
    if (!findPath(dungeon, start.id, keys[0].id, (id) => id === boss.id)) errors.push(`${stageId}: key unreachable`);
    if (!findPath(dungeon, keys[0].id, boss.id)) errors.push(`${stageId}: boss unreachable from key`);
    for (const r of dungeon.rooms) if (!findPath(dungeon, start.id, r.id)) errors.push(`${stageId}: room ${r.id} unreachable`);
  }
  for (const [lid, l] of Object.entries(LORE)) {
    if (l.stage !== stageId) continue;
    const n = dungeon.rooms.filter((r) => r.lore?.id === lid).length;
    if (n !== 1) errors.push(`${stageId}: lore ${lid} placed ${n} times`);
  }
  return errors;
}

export function validateChestLoot() {
  return Object.entries(CHEST_LOOT).flatMap(([id, t]) => validateDropTable(t.drops, `chest:${id}`));
}

// Door rectangle in room coordinates (the gap in the wall the player walks through).
export function doorRect(dir) {
  const { w, h, wall, door } = ROOM;
  if (dir === 'N') return { x: w / 2 - door / 2, y: 0, w: door, h: wall };
  if (dir === 'S') return { x: w / 2 - door / 2, y: h - wall, w: door, h: wall };
  if (dir === 'W') return { x: 0, y: h / 2 - door / 2, w: wall, h: door };
  return { x: w - wall, y: h / 2 - door / 2, w: wall, h: door };
}

// Where the player appears when entering through a door on side `dir`.
export function entryPoint(dir) {
  const { w, h, wall } = ROOM;
  const m = wall + 50;
  if (dir === 'N') return { x: w / 2, y: m + 20 };
  if (dir === 'S') return { x: w / 2, y: h - m };
  if (dir === 'W') return { x: m, y: h / 2 + 20 };
  return { x: w - m, y: h / 2 + 20 };
}
