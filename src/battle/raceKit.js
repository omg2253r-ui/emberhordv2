// The bloodline skill kit: v7 races build their skill (key R) from these steps (see data/races2.js).
// Works in every scene that has the shared world API (dungeon, online zones, PvP): hits go through
// world.playerStrike with src 'race', so skill power, marks, burns and PvP hit reports all apply.
import { nearestEnemy } from './moves.js';
import { addBuff } from './buffs.js';
import { inArc } from '../systems/combat.js';

const TAU = Math.PI * 2;
const live = (world) => world.enemies.filter((e) => !e.dead && !(e.spawning > 0) && !e.untargetable);
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

function strike(world, e, power, o) { return world.playerStrike(e, power, { src: 'race', ...o }); }

// Runs the kit. Returns false when the skill could not start (no target in reach for a targeted first step).
export function castKit(world, s) {
  const p = world.player, kit = s.v.kit;
  const first = kit[0];
  if (['leap', 'blink'].includes(first.type) && !nearestEnemy(world, p, first.reach)) {
    world.toast?.('ไม่มีศัตรูในระยะ', 'warn', 'race-range'); world.sfx('error'); return false;
  }
  s.fx ||= []; s.queue ||= [];
  for (const step of kit) {
    if (step.delay) s.queue.push({ t: step.delay, step });
    else run(world, s, step);
  }
  return true;
}

function run(world, s, step) {
  const p = world.player, col = s.color || '#ffd08a';
  if (p.dead) return;
  switch (step.type) {
    case 'blast': {
      for (const e of live(world)) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > step.r + (e.r || 20)) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x), kb = step.kb ?? 260;
        strike(world, e, step.power, { kx: Math.cos(a) * kb, ky: Math.sin(a) * kb, stun: step.stun, burn: step.burn, slow: step.slow, slowT: step.slow ? 2 : undefined });
      }
      world.fx.ring(p.x, p.y - 20, 16, step.r, col, 0.5, 10);
      world.particles.burst(p.x, p.y - 30, 30, { color: [col, '#ffffff'], speedMin: 100, speedMax: 320, life: 0.6, size: 4, drag: 3, glow: true });
      world.shake?.(Math.min(10, 3 + step.power * 3), 0.25); world.sfx('slam');
      break;
    }
    case 'cone':
      world.addCone({ from: () => (p.dead ? null : { x: p.x + Math.cos(p.facing) * 20, y: p.y - 42 + Math.sin(p.facing) * 10, dir: p.facing }),
        range: step.range, arc: (step.arc * Math.PI) / 180, ticks: step.ticks, interval: step.interval, power: step.power, src: 'race', t: 0, n: 0 });
      world.sfx('roar');
      break;
    case 'claws':
      for (let i = 0; i < step.n; i++) s.queue.push({ t: i * step.gap, step: { type: 'claw', range: step.range, arc: step.arc, power: step.power, i } });
      break;
    case 'claw': {
      const dir = p.facing, arc = (step.arc * Math.PI) / 180;
      for (const e of live(world)) if (inArc(p.x, p.y - 10, dir, step.range, arc, e.x, e.y - 10, e.r || 20)) strike(world, e, step.power, { kx: Math.cos(dir) * 120, ky: Math.sin(dir) * 120 });
      world.fx.slash(p.x, p.y - 22, dir + (step.i % 2 ? 0.25 : -0.25), arc, step.range * 0.85, 1.4, '#fff8ea', step.i % 2 === 1, col);
      world.sfx('swing', { power: 1.1 });
      break;
    }
    case 'volley': {
      const e = nearestEnemy(world, p, 640);
      const base = e ? Math.atan2(e.y - (e.r || 20) - (p.y - 40), e.x - p.x) : p.facing;
      for (let i = 0; i < step.count; i++) {
        const a = step.ring ? (i / step.count) * TAU : base + (step.count > 1 ? ((i / (step.count - 1)) - 0.5) * (step.spread * Math.PI / 180) : 0);
        world.firePlayerShot({ kind: 'bolt', x: p.x, y: p.y - 40, angle: a, speed: step.speed, r: 8, pierce: step.pierce || 0, homing: step.homing || 0, power: step.power, src: 'race', kb: 90, life: step.ring ? 1.4 : 1.1, tint: step.tint });
      }
      world.sfx('cast', { power: 1.3 });
      break;
    }
    case 'dash': {
      const a = p.facing, A = world.arena || { w: 2000, h: 2000 };
      const x0 = p.x, y0 = p.y;
      let x1 = x0 + Math.cos(a) * step.dist, y1 = y0 + Math.sin(a) * step.dist;
      x1 = Math.max(70, Math.min(A.w - 70, x1)); y1 = Math.max(90, Math.min(A.h - 50, y1));
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      for (const e of live(world)) {
        const dx = e.x - x0, dy = e.y - y0, along = dx * ux + dy * uy, across = Math.abs(-dx * uy + dy * ux);
        if (along < -(e.r || 20) || along > len + (e.r || 20) || across > step.width / 2 + (e.r || 20)) continue;
        const kb = step.kb ?? 260;
        strike(world, e, step.power, { kx: ux * kb, ky: uy * kb, stun: step.stun, burn: step.burn });
      }
      p.x = x1; p.y = y1; world.clampBody?.(p);
      p.iframes = Math.max(p.iframes, 0.3);
      p.ghosts?.push({ x: x0, y: y0, t: 0.3, max: 0.3, flip: p.flip, walkT: p.walkT }, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, t: 0.3, max: 0.3, flip: p.flip, walkT: p.walkT });
      s.fx.push({ kind: 'streak', x: x0, y: y0 - 30, x2: p.x, y2: p.y - 30, w: step.width, t: 0, life: 0.35, color: col });
      world.shake?.(5, 0.2); world.sfx('dash');
      break;
    }
    case 'leap': {
      const e = nearestEnemy(world, p, step.reach);
      if (!e) break;
      const x0 = p.x, y0 = p.y;
      p.x = e.x - Math.cos(p.facing) * ((e.r || 20) + 10); p.y = e.y + 4; world.clampBody?.(p);
      p.iframes = Math.max(p.iframes, 0.35);
      s.fx.push({ kind: 'arcjump', x: x0, y: y0 - 30, x2: p.x, y2: p.y - 30, t: 0, life: 0.3, color: col });
      run(world, s, { type: 'blast', r: step.r, power: step.power, stun: step.stun, kb: 300 });
      break;
    }
    case 'blink': {
      const hit = new Set();
      for (let i = 0; i < (step.count || 1); i++) s.queue.push({ t: i * 0.16, step: { type: 'blinkOne', reach: step.reach, power: step.power, hit } });
      break;
    }
    case 'blinkOne': {
      const e = nearestEnemy(world, p, step.reach, (o) => !step.hit.has(o)) || nearestEnemy(world, p, step.reach);
      if (!e) break;
      step.hit.add(e);
      world.particles.burst(p.x, p.y - 30, 16, { color: ['#14121c', col, '#e0e0ff'], speedMin: 60, speedMax: 200, life: 0.4, size: 4, drag: 3 });
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      p.x = e.x + Math.cos(a) * ((e.r || 20) + p.r + 12); p.y = e.y + Math.sin(a) * ((e.r || 20) + p.r + 12); world.clampBody?.(p);
      const back = Math.atan2(e.y - p.y, e.x - p.x);
      p.facing = back; p.flip = Math.cos(back) < 0; p.iframes = Math.max(p.iframes, 0.4);
      world.fx.slash(p.x, p.y - 18, back, 2.4, 80, 1.8, '#e8eeff', false, col);
      strike(world, e, step.power, { forceCrit: true, kx: Math.cos(back) * 220, ky: Math.sin(back) * 220, stun: 0.4 });
      world.hitStop?.(0.05); world.sfx('crit');
      break;
    }
    case 'chain': {
      let e = nearestEnemy(world, p, step.range);
      const hit = new Set();
      let x0 = p.x, y0 = p.y - 50;
      for (let j = 0; j <= step.jumps && e; j++) {
        hit.add(e);
        strike(world, e, step.power * Math.pow(0.88, j), { kx: 0, ky: 0, stun: 0.25 });
        s.fx.push({ kind: 'bolt', x: x0, y: y0, x2: e.x, y2: e.y - (e.r || 20), t: 0, life: 0.3, color: col });
        x0 = e.x; y0 = e.y - (e.r || 20);
        const cur = e;
        e = nearestEnemy(world, cur, 260, (o) => !hit.has(o));
      }
      if (!hit.size) world.fx.ring(p.x, p.y - 30, 10, 60, col, 0.3, 4);
      world.sfx('crit');
      break;
    }
    case 'meteor': {
      const list = live(world).filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < step.reach).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      for (let i = 0; i < step.count; i++) {
        const e = list[i % Math.max(1, list.length)];
        const ang = world.rng.next() * TAU, d = e ? (i < list.length ? 0 : 40 + world.rng.next() * 50) : 60 + world.rng.next() * 160;
        const x = (e ? e.x : p.x + Math.cos(p.facing) * 140) + Math.cos(ang) * d, y = (e ? e.y : p.y) + Math.sin(ang) * d * 0.7;
        world.addZone({ x, y, r: step.r, delay: step.delay + i * 0.12, power: step.power, kb: 260, stun: 0.3, opts: { src: 'race' } });
      }
      break;
    }
    case 'field':
      s.fx.push({ kind: 'field', x: p.x, y: p.y, r: step.r, t: 0, life: step.t, power: step.power, every: step.every, slow: step.slow, heal: step.heal, burn: step.burn, color: step.color || col, follow: !!step.follow, tick: 0 });
      world.sfx('cast', { power: 1.2 });
      break;
    case 'orbit':
      s.fx.push({ kind: 'orbit', n: step.n, r: step.r, t: 0, life: step.t, power: step.power, every: step.every, color: step.color || col, a: 0, hitAt: new Map() });
      world.sfx('cast', { power: 0.8 });
      break;
    case 'pull': {
      for (const e of live(world)) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > step.r + (e.r || 20)) continue;
        const a = Math.atan2(p.y - e.y, p.x - e.x), f = step.force * Math.min(1, d / 120);
        strike(world, e, step.power, { kx: Math.cos(a) * f, ky: Math.sin(a) * f });
      }
      world.fx.ring(p.x, p.y - 20, step.r, 20, col, 0.5, 8);
      world.particles.burst(p.x, p.y - 30, 26, { color: [col, '#14121c'], speedMin: -260, speedMax: -80, life: 0.5, size: 4, drag: 1, glow: true });
      world.sfx('roar');
      break;
    }
    case 'mark':
      for (const e of live(world)) if (Math.hypot(e.x - p.x, e.y - p.y) < step.r + (e.r || 20)) strike(world, e, 0.05, { kx: 0, ky: 0, mark: step.mark, markT: step.t });
      world.fx.ring(p.x, p.y - 20, 20, step.r, col, 0.45, 4);
      break;
    case 'buff':
      for (const k of ['haste', 'crit', 'dmg', 'reduce', 'speed', 'lifesteal', 'regen', 'burn']) if (step[k]) addBuff(p, k, step[k], step.t);
      world.fx.ring(p.x, p.y - 40, 10, 70, col, 0.5, 6);
      world.particles.burst(p.x, p.y - 50, 20, { color: [col, '#ffffff'], speedMin: 40, speedMax: 160, life: 0.6, size: 3, drag: 2, grav: -80, glow: true });
      world.sfx('levelup');
      break;
    case 'heal': {
      const n = Math.round(p.maxHp * step.pct);
      p.hp = Math.min(p.maxHp, p.hp + n);
      world.fx.number(p.x, p.y - 96, `+${n}`, 'heal');
      world.sfx('potion');
      break;
    }
    case 'shield': {
      const n = Math.round(p.maxHp * step.pct);
      p.shield = Math.max(p.shield, n); p.shieldMax = Math.max(p.shieldMax, n); p.shieldT = Math.max(p.shieldT, step.t);
      world.fx.ring(p.x, p.y - 30, 50, 24, col, 0.45, 6);
      break;
    }
    case 'iframes': p.iframes = Math.max(p.iframes, step.t); break;
    default: break;
  }
}

// lasting parts: delayed steps, fields, orbits and the short-lived streaks
export function tickKit(s, dt, world) {
  if (!s || !s.fx) return;
  const p = world.player;
  for (let i = s.queue.length - 1; i >= 0; i--) { const q = s.queue[i]; q.t -= dt; if (q.t <= 0) { s.queue.splice(i, 1); run(world, s, q.step); } }
  for (let i = s.fx.length - 1; i >= 0; i--) {
    const f = s.fx[i];
    f.t += dt;
    if (f.kind === 'field') {
      if (f.follow && !p.dead) { f.x = p.x; f.y = p.y; }
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = f.every || 0.5;
        for (const e of live(world)) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + (e.r || 20)) strike(world, e, f.power, { kx: 0, ky: 0, slow: f.slow, slowT: f.slow ? 1 : undefined, burn: f.burn });
        if (f.heal && !p.dead && Math.hypot(p.x - f.x, p.y - f.y) < f.r && p.hp < p.maxHp) {
          const n = Math.max(1, Math.round(p.maxHp * f.heal * (f.every || 0.5)));
          p.hp = Math.min(p.maxHp, p.hp + n);
        }
      }
    } else if (f.kind === 'orbit') {
      f.a += dt * 4.2;
      for (let k = 0; k < f.n; k++) {
        const a = f.a + (k / f.n) * TAU, x = p.x + Math.cos(a) * f.r, y = p.y - 20 + Math.sin(a) * f.r * 0.6;
        for (const e of live(world)) {
          if (Math.hypot(e.x - x, e.y - (e.r || 20) * 0.5 - y) > (e.r || 20) + 18) continue;
          if (f.t - (f.hitAt.get(e) ?? -9) < f.every) continue;
          f.hitAt.set(e, f.t);
          strike(world, e, f.power, { kx: Math.cos(a + 1.57) * 140, ky: Math.sin(a + 1.57) * 140 });
        }
      }
    }
    if (f.t >= f.life) s.fx.splice(i, 1);
  }
}

export function drawKitGround(renderer, s, time) {
  if (!s?.fx?.length) return;
  const ctx = renderer.ctx;
  for (const f of s.fx) {
    if (f.kind !== 'field') continue;
    const fade = Math.min(1, (f.life - f.t) / 0.4, f.t / 0.2);
    const c = rgb(f.color);
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = `rgba(${c},0.16)`; ctx.strokeStyle = `rgba(${c},0.75)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(${c},0.8)`;
    for (let i = 0; i < 14; i++) { const a = i * 2.39 + time * (f.follow ? 2.4 : 0.6), d = f.r * (0.25 + ((i * 37) % 70) / 100); ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.6 - ((time * 40 + i * 13) % 24), 2.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

export function drawKitAir(renderer, s, player, time) {
  if (!s?.fx?.length) return;
  const ctx = renderer.ctx;
  for (const f of s.fx) {
    const fade = Math.max(0, 1 - f.t / f.life);
    ctx.save();
    if (f.kind === 'orbit') {
      const c = rgb(f.color);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < f.n; k++) {
        const a = f.a + (k / f.n) * TAU, x = player.x + Math.cos(a) * f.r, y = player.y - 20 + Math.sin(a) * f.r * 0.6;
        const g = ctx.createRadialGradient(x, y, 1, x, y, 20);
        g.addColorStop(0, `rgba(${c},0.95)`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, 7, 3, a + 1.57, 0, TAU); ctx.fill();
      }
    } else if (f.kind === 'streak' || f.kind === 'bolt' || f.kind === 'arcjump') {
      ctx.globalAlpha = fade; ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = f.color; ctx.lineCap = 'round'; ctx.lineWidth = f.kind === 'streak' ? f.w * 0.5 * fade : 4;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      if (f.kind === 'bolt') { for (let k = 1; k < 7; k++) { const q = k / 7; ctx.lineTo(f.x + (f.x2 - f.x) * q + (Math.random() - 0.5) * 18, f.y + (f.y2 - f.y) * q + (Math.random() - 0.5) * 18); } ctx.lineTo(f.x2, f.y2); }
      else if (f.kind === 'arcjump') ctx.quadraticCurveTo((f.x + f.x2) / 2, Math.min(f.y, f.y2) - 120, f.x2, f.y2);
      else ctx.lineTo(f.x2, f.y2);
      ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
}
