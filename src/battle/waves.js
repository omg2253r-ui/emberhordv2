// Spawn placement for room encounters: spread out and away from the player.
// Picks spawn points spread around the arena, away from the player.
export function spawnPoints(count, arena, player, rng) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    let best = null, bestD = -1;
    for (let k = 0; k < 8; k++) {
      const x = 120 + rng.next() * (arena.w - 240), y = 140 + rng.next() * (arena.h - 260);
      const d = Math.hypot(x - player.x, y - player.y);
      const spread = pts.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), 9999);
      const score = Math.min(d, 600) + Math.min(spread, 200);
      if (score > bestD && d > 260) { bestD = score; best = { x, y }; }
    }
    pts.push(best || { x: arena.w / 2 + (rng.next() - 0.5) * 400, y: 160 });
  }
  return pts;
}
