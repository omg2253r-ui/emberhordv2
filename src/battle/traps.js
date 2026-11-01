// Dungeon traps. Every trap has a visible warning phase before it can hurt, and damage is a share of
// max HP (reduced by the "หนังหนา" passive) so traps stay fair at any level. Dashing (i-frames) avoids them.
import { ROOM, TRAP_TIMING } from '../data/dungeons.js';

const TILE = 48;

export function createTraps(roomDef) {
  const W = ROOM.w, H = ROOM.h;
  return (roomDef.traps || []).map((t) => {
    if (t.kind === 'spikes' || t.kind === 'vent') {
      return { kind: t.kind, x: t.x * W, y: t.y * H, w: t.w * W, h: t.h * H, period: t.period, offset: t.offset || 0, state: 'idle', cycle: -1, hitPlayer: false, hitEnemies: new Set() };
    }
    if (t.kind === 'dart') {
      return { kind: 'dart', x: t.x * W, y: t.y * H, dir: (t.dir * Math.PI) / 180, period: t.period, t: t.offset || 0, warn: false };
    }
    return { kind: 'rocks', every: t.every, t: 0, pending: [] };
  });
}

function phaseOf(tr, time) {
  const tim = TRAP_TIMING[tr.kind];
  const c = (time + tr.offset) % tr.period;
  const cycle = Math.floor((time + tr.offset) / tr.period);
  if (c >= tr.period - tim.up) return { state: 'up', cycle, k: (c - (tr.period - tim.up)) / tim.up };
  if (c >= tr.period - tim.up - tim.warn) return { state: 'warn', cycle, k: (c - (tr.period - tim.up - tim.warn)) / tim.warn };
  return { state: 'idle', cycle, k: 0 };
}

const inRect = (tr, x, y, r) => x + r > tr.x && x - r < tr.x + tr.w && y > tr.y - r * 0.5 && y - r * 0.5 < tr.y + tr.h;

export function updateTraps(traps, dt, world) {
  const p = world.player;
  for (const tr of traps) {
    if (tr.kind === 'spikes' || tr.kind === 'vent') {
      const ph = phaseOf(tr, world.time);
      if (ph.cycle !== tr.cycle) { tr.cycle = ph.cycle; tr.hitPlayer = false; tr.hitEnemies.clear(); }
      if (ph.state === 'warn' && tr.state !== 'warn' && tr.kind === 'vent') world.sfx('telegraph');
      if (ph.state === 'up' && tr.state !== 'up') world.sfx(tr.kind === 'vent' ? 'dash' : 'swing');
      tr.state = ph.state; tr.k = ph.k;
      if (ph.state !== 'up') continue;
      if (!tr.hitPlayer && !p.dead && inRect(tr, p.x, p.y, p.r * 0.6)) {
        if (world.trapHit(tr.kind, 0, -160)) tr.hitPlayer = true;
      }
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || tr.hitEnemies.has(e) || !inRect(tr, e.x, e.y, e.r * 0.6)) continue;
        tr.hitEnemies.add(e);
        world.trapHitEnemy(e);
      }
    } else if (tr.kind === 'dart') {
      tr.t += dt;
      tr.warn = tr.t > tr.period - TRAP_TIMING.dart.warn;
      if (tr.t >= tr.period) {
        tr.t -= tr.period; tr.warn = false;
        world.fireTrapDart(tr.x + Math.cos(tr.dir) * 30, tr.y + Math.sin(tr.dir) * 30, tr.dir, TRAP_TIMING.dart.speed);
      }
    } else if (tr.kind === 'rocks') {
      tr.t += dt;
      if (tr.t >= tr.every && !p.dead) {
        tr.t = 0;
        const x = p.x + (world.rng.next() - 0.5) * 90, y = p.y + (world.rng.next() - 0.5) * 60;
        const r = TRAP_TIMING.rocks.radius;
        tr.pending.push({ x, y, t: 0 });
        world.addHazard({ type: 'circle', x, y, r, dur: TRAP_TIMING.rocks.warn, rock: true });
      }
      for (let i = tr.pending.length - 1; i >= 0; i--) {
        const pr = tr.pending[i];
        pr.t += dt;
        if (pr.t < TRAP_TIMING.rocks.warn) continue;
        tr.pending.splice(i, 1);
        const r = TRAP_TIMING.rocks.radius;
        world.shake(6, 0.2); world.sfx('slam');
        world.particles.burst(pr.x, pr.y - 6, 18, { color: ['#5b5450', '#7a716b', '#3a3330'], speedMin: 80, speedMax: 240, life: 0.55, size: 5, drag: 3, shape: 1 });
        world.fx.ring(pr.x, pr.y, 10, r, '#c9bfa9', 0.35, 5);
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < r + p.r * 0.5) world.trapHit('rocks', (p.x - pr.x) * 3, (p.y - pr.y) * 3);
        for (const e of world.enemies) if (!e.dead && Math.hypot(e.x - pr.x, e.y - pr.y) < r + e.r * 0.5) world.trapHitEnemy(e);
      }
    }
  }
}

// Floor layer: plates, grates and the warning glow.
export function drawTrapsFloor(ctx, traps, time) {
  for (const tr of traps) {
    if (tr.kind !== 'spikes' && tr.kind !== 'vent') continue;
    const warn = tr.state === 'warn', up = tr.state === 'up';
    ctx.fillStyle = tr.kind === 'vent' ? '#1e1714' : '#2a2520';
    ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
    ctx.strokeStyle = 'rgba(10,6,4,0.8)'; ctx.lineWidth = 2;
    ctx.strokeRect(tr.x, tr.y, tr.w, tr.h);
    for (let x = tr.x; x < tr.x + tr.w - 1; x += TILE) {
      const tw = Math.min(TILE, tr.x + tr.w - x);
      ctx.strokeStyle = 'rgba(120,110,95,0.35)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, tr.y + 3, tw - 6, tr.h - 6);
      if (tr.kind === 'spikes') {
        ctx.fillStyle = '#0d0907';
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(x + tw * (0.22 + i * 0.28), tr.y + tr.h * (0.32 + j * 0.36), 2.4, 0, Math.PI * 2); ctx.fill(); }
      } else {
        ctx.fillStyle = '#0d0907';
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * (tw - 12) / 4, tr.y + 6, (tw - 12) / 4 - 4, tr.h - 12);
      }
    }
    if (warn || up) {
      const a = warn ? 0.18 + 0.22 * Math.abs(Math.sin(time * 14)) : 0.35;
      ctx.fillStyle = tr.kind === 'vent' ? `rgba(255,120,40,${a})` : `rgba(224,80,58,${a})`;
      ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
    }
  }
}

// Upper layer: raised spikes, flames, turrets. Drawn after the floor, before characters at the same depth.
export function drawTrapsTop(ctx, traps, time, sprites) {
  for (const tr of traps) {
    if (tr.kind === 'spikes' && (tr.state === 'warn' || tr.state === 'up')) {
      const hgt = tr.state === 'up' ? 22 * Math.min(1, tr.k * 6) : 5;
      for (let x = tr.x + 10; x < tr.x + tr.w - 6; x += 16) for (let y = tr.y + 12; y < tr.y + tr.h - 2; y += 16) {
        ctx.fillStyle = '#c9c4b8'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y - hgt); ctx.lineTo(x + 5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff8ea'; ctx.beginPath(); ctx.moveTo(x - 1, y - 2); ctx.lineTo(x, y - hgt + 2); ctx.stroke();
      }
    } else if (tr.kind === 'vent') {
      if (tr.state === 'warn') {
        for (let i = 0; i < 3; i++) {
          const x = tr.x + ((time * 60 + i * 97) % tr.w), y = tr.y + tr.h / 2 - ((time * 40 + i * 20) % 30);
          ctx.fillStyle = 'rgba(120,110,100,0.35)'; ctx.beginPath(); ctx.arc(x, y, 8 + i * 2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (tr.state === 'up') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let x = tr.x + 8; x < tr.x + tr.w; x += 22) {
          const h = 60 + 18 * Math.sin(time * 20 + x);
          const g = ctx.createLinearGradient(0, tr.y + tr.h, 0, tr.y + tr.h - h);
          g.addColorStop(0, 'rgba(255,240,190,0.9)'); g.addColorStop(0.4, 'rgba(255,138,61,0.75)'); g.addColorStop(1, 'rgba(194,65,47,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - 10, tr.y + tr.h); ctx.quadraticCurveTo(x - 12, tr.y + tr.h - h * 0.5, x, tr.y + tr.h - h); ctx.quadraticCurveTo(x + 12, tr.y + tr.h - h * 0.5, x + 10, tr.y + tr.h); ctx.fill();
        }
        ctx.restore();
      }
    } else if (tr.kind === 'dart') {
      const s = sprites.dart_turret;
      if (s) {
        ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.dir - Math.PI / 2);
        ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
        if (tr.warn) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(160,220,90,${0.4 + 0.4 * Math.sin(time * 30)})`; ctx.beginPath(); ctx.arc(0, 12, 12, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    }
  }
}
