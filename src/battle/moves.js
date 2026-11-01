// Executes weapon moves (data/weapons.js): starting a move, resolving its hit shape at the impact frame,
// and the committed "rush" moves that carry the hero through enemies.
import { BALANCE } from '../config/balance.js';
import { inArc } from '../systems/combat.js';
import { GUARD } from './guard.js';

const C = BALANCE.combat;
const DEG = Math.PI / 180;

// Where an attack should go: mouse aim, else the nearest enemy in reach, else straight ahead.
export function aimDirection(p, intent, world, range = C.autoAimRange) {
  if (intent.aim) {
    const w = world.screenToWorld(intent.aim.sx, intent.aim.sy);
    return Math.atan2(w.y - (p.y - 20), w.x - p.x);
  }
  const t = nearestEnemy(world, p, range);
  return t ? Math.atan2(t.y - p.y, t.x - p.x) : p.facing;
}

export function nearestEnemy(world, from, range, filter = null) {
  let best = null, bd = range;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || (filter && !filter(e))) continue;
    const d = Math.hypot(e.x - from.x, e.y - from.y) - e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function moveDef(type, kind, step) {
  if (kind === 'charged') return type.charged;
  if (kind === 'dash') return type.dash;
  if (kind === 'branch') return type.branch || type.combo[type.combo.length - 1];
  return type.combo[step];
}

export function startMove(p, kind, step, intent, world) {
  const type = p.wtype;
  const def = moveDef(type, kind, step);
  const range = type.ranged ? 600 : C.autoAimRange;
  let dir = kind === 'charged' && p.chargeDir != null ? p.chargeDir : aimDirection(p, intent, world, range);

  // dagger dodge-attack: appear behind the nearest enemy
  if (def.teleport === 'behind') {
    const e = nearestEnemy(world, p, 320);
    if (e) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      world.particles.burst(p.x, p.y - 30, 14, { color: ['#c27ff0', '#f3e6c8'], speedMin: 40, speedMax: 160, life: 0.35, size: 3, drag: 4, glow: true });
      p.x = e.x + Math.cos(a) * (e.r + p.r + 10);
      p.y = e.y + Math.sin(a) * (e.r + p.r + 10);
      world.clampBody?.(p);
      dir = Math.atan2(e.y - p.y, e.x - p.x);
      p.iframes = Math.max(p.iframes, 0.25);
      world.particles.burst(p.x, p.y - 30, 14, { color: ['#c27ff0', '#f3e6c8'], speedMin: 40, speedMax: 160, life: 0.35, size: 3, drag: 4, glow: true });
    }
  }
  if (def.hop) { p.vx = -Math.cos(dir) * def.hop * 6; p.vy = -Math.sin(dir) * def.hop * 6; }

  const pre = def.windup + def.active;
  // a move started inside the counter window (after a parry) is a counter: much stronger, always critical
  const counter = !!p.guard && p.guard.counterT > 0;
  if (counter) p.guard.counterT = 0;
  p.move = { def, kind, step, phase: 'windup', t: 0, dir, stepLeft: def.step || 0, stepSpeed: def.step ? def.step / Math.max(0.05, pre) : 0, hits: 0, counter, mult: counter ? GUARD.counterPower * (1 + (p.stats?.counterBonus || 0)) : 1 };
  if (counter) world.onCounter?.(kind);
  if (kind === 'combo') { p.comboStep = step; p.comboTimer = 0; }
  if (p.moveCounts) p.moveCounts[kind] = (p.moveCounts[kind] || 0) + 1;
  p.buffered = false;
  p.facing = dir; p.flip = Math.cos(dir) < 0;
  world.onPlayerSwing?.(def, kind, step);
}

// Impact frame of the current move.
export function resolveMove(p, world) {
  const m = p.move, d0 = m.def, h = d0.hit;
  const type = p.wtype;
  const d = m.mult && m.mult !== 1 ? { ...d0, power: d0.power * m.mult } : d0;
  const base = { critBonus: d.critBonus || 0, forceCrit: !!d.forceCrit || !!m.counter, stun: d.stun || 0, src: 'melee', counter: !!m.counter };
  // v7 weapon moves: burn, slow and mark on hit; `multi` strikes the same targets several times
  if (d.burn) base.burn = true;
  if (d.slow) { base.slow = d.slow; base.slowT = 1.6; }
  if (d.mark) { base.mark = d.mark; base.markT = 3; }
  const times = Math.max(1, Math.min(8, d.multi || 1));
  const cx = p.x, cy = p.y - 18;
  let hits = 0;
  const trail = type.trail;
  switch (h.shape) {
    case 'arc': {
      const arc = h.arc * DEG;
      if (d.anim === 'thrust' || d.anim === 'stab' || d.anim === 'stabB') world.fx.thrust(cx, cy, m.dir, h.range, trail.color, trail.glow, d.power);
      else world.fx.slash(cx, cy, m.dir, arc, h.range * 0.82, d.power * trail.width, trail.color, d.anim === 'slashUp' || d.anim === 'heavyUp', trail.glow);
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0) continue;
        if (!inArc(cx, cy, m.dir, h.range, arc, e.x, e.y - e.r * 0.6, e.r)) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        for (let k = 0; k < times && !e.dead; k++) world.playerStrike(e, d.power, { ...base, kx: k ? 0 : Math.cos(a) * (d.kb || 0), ky: k ? 0 : Math.sin(a) * (d.kb || 0) });
        hits++;
      }
      if (times > 1 && hits) for (let k = 1; k < times; k++) world.fx.slash(cx, cy, m.dir + (k % 2 ? 0.3 : -0.3), arc * 0.8, h.range * 0.7, d.power * trail.width * 0.6, trail.color, k % 2 === 1, trail.glow);
      hits += world.cutProjectiles?.(cx, cy, m.dir, h.range, arc) || 0;
      break;
    }
    case 'circle': {
      const ox = p.x + Math.cos(m.dir) * (h.forward || 0), oy = p.y - 10 + Math.sin(m.dir) * (h.forward || 0);
      world.fx.ring(ox, oy, 12, h.r, trail.glow, 0.42, 9 * Math.min(1.6, d.power / 2 + 0.4));
      world.fx.ring(ox, oy, 8, h.r * 0.75, trail.color, 0.3, 5);
      if (h.forward) world.particles.burst(ox, oy, 26, { color: ['#8a7350', '#6b5638', trail.glow], speedMin: 120, speedMax: 320, life: 0.55, size: 5, drag: 3.5, shape: 1 });
      else world.particles.burst(ox, oy - 10, 22, { color: [trail.color, trail.glow], speedMin: 160, speedMax: 340, life: 0.4, size: 3.5, drag: 4, glow: true });
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || Math.hypot(e.x - ox, e.y - oy) > h.r + e.r) continue;
        const a = Math.atan2(e.y - oy, e.x - ox);
        for (let k = 0; k < times && !e.dead; k++) world.playerStrike(e, d.power, { ...base, kx: k ? 0 : Math.cos(a) * (d.kb || 0), ky: k ? 0 : Math.sin(a) * (d.kb || 0) });
        hits++;
      }
      hits += world.cutProjectiles?.(ox, oy - 10, 0, h.r, Math.PI * 2) || 0;
      if (d.shake) world.shake(d.shake, 0.22);
      break;
    }
    case 'proj': {
      const hx = p.x + Math.cos(m.dir) * 26, hy = p.y - 36 + Math.sin(m.dir) * 20;
      const n = h.count || 1, spread = (h.spread || 0) * DEG;
      for (let i = 0; i < n; i++) {
        const a = m.dir + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
        world.firePlayerShot({ kind: h.kind, x: hx, y: hy, angle: a, speed: h.speed, r: h.r, pierce: h.pierce || 0, homing: h.homing || 0, power: d.power, critBonus: base.critBonus, forceCrit: base.forceCrit, stun: base.stun, kb: d.kb || 90, burn: d.burn, mark: d.mark, slow: d.slow, tint: type.own && type.trail.glow ? [hexRgb(type.trail.glow), type.trail.color] : undefined });
      }
      if (d.shake) world.shake(d.shake, 0.15);
      break;
    }
    case 'rush': {
      p.rush = { t: d.active, dir: m.dir, speed: h.dist / d.active, width: h.width, hit: new Set(), power: d.power, opts: base, kb: d.kb || 200, times };
      p.iframes = Math.max(p.iframes, d.active + 0.12);
      world.fx.thrust(p.x, p.y - 30, m.dir, h.dist + 30, trail.color, trail.glow, 2);
      break;
    }
    case 'zone': {
      const t = nearestEnemy(world, p, h.reach);
      let tx = p.x + Math.cos(m.dir) * h.reach * 0.55, ty = p.y + Math.sin(m.dir) * h.reach * 0.55;
      if (t) { tx = t.x; ty = t.y; }
      world.addZone({ x: tx, y: ty, r: h.r, delay: h.delay, power: d.power, kb: d.kb || 300, stun: d.stun || 0, shake: d.shake || 0, opts: base, times });
      break;
    }
    default: break;
  }
  m.hits = hits;
  if (hits > 0) world.hitStop(d.hitStop ?? (d.power >= 1.5 ? 0.055 : 0.03));
  if (hits > 0 && d.shake && h.shape === 'arc') world.shake(d.shake, 0.16);
}

// The hero dashes along the move direction, striking each enemy once. Returns false when finished.
export function updateRush(p, dt, world) {
  const R = p.rush;
  R.t -= dt;
  p.vx = Math.cos(R.dir) * R.speed; p.vy = Math.sin(R.dir) * R.speed;
  p.x += p.vx * dt; p.y += p.vy * dt;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || R.hit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + R.width) continue;
    R.hit.add(e);
    for (let k = 0; k < (R.times || 1) && !e.dead; k++) world.playerStrike(e, R.power, { ...R.opts, kx: k ? 0 : Math.cos(R.dir) * R.kb, ky: k ? 0 : Math.sin(R.dir) * R.kb });
    world.hitStop(0.04);
  }
  p.ghostT -= dt;
  if (p.ghostT <= 0) { p.ghostT = 0.03; p.ghosts.push({ x: p.x, y: p.y, flip: p.flip, t: 0.25, max: 0.25, walkT: p.walkT }); }
  world.particles.spawn({ x: p.x, y: p.y - 30, vx: -p.vx * 0.05, vy: -p.vy * 0.05, life: 0.3, size: 8, size2: 1, color: p.wtype.trail.glow, drag: 6, glow: true });
  world.clampBody?.(p);
  if (R.t <= 0) { p.vx *= 0.15; p.vy *= 0.15; return false; }
  return true;
}

function hexRgb(h) { const n = parseInt(String(h).slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }
