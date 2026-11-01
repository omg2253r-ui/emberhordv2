// Status effects on enemies: burning (damage over time), moon mark (takes extra damage), boss poise / break.
import { BALANCE } from '../config/balance.js';

const B = BALANCE.combat.burn;
const PO = BALANCE.combat.poise;

export function applyBurn(e) {
  if (e.dead) return;
  e.burn = { left: B.ticks, t: 0 };
}

export function applyMark(e, bonus, duration) {
  e.mark = Math.max(e.mark || 0, bonus); e.markT = duration;
}

// Bosses only. Returns true when this hit broke the boss's poise.
export function poiseHit(e, amount) {
  if (!e.type.boss || e.dead || e.brokenT > 0) return false;
  if (e.poise == null) e.poise = PO.max;
  e.poise -= amount * PO.perHit;
  e.poiseIdle = 0;
  if (e.poise > 0) return false;
  e.poise = 0; e.brokenT = PO.breakStun;
  return true;
}

export function tickStatus(e, dt, world) {
  if (e.dead) return;
  if (e.markT > 0) { e.markT -= dt; if (e.markT <= 0) e.mark = 0; }
  if (e.burn) {
    e.burn.t += dt;
    if (e.burn.t >= B.interval) {
      e.burn.t -= B.interval; e.burn.left -= 1;
      world.playerStrike(e, B.power, { src: 'burn', kx: 0, ky: 0 });
      if (Math.random() < 0.9) world.particles.burst(e.x, e.y - e.r, 4, { color: ['#ff8a3d', '#ffd08a'], speedMin: 20, speedMax: 70, life: 0.4, size: 3, drag: 2, grav: -120, glow: true });
      if (e.burn && e.burn.left <= 0) e.burn = null;
    }
  }
  if (e.type.boss) {
    if (e.poise == null) e.poise = PO.max;
    if (e.brokenT > 0) {
      e.brokenT -= dt;
      if (e.brokenT <= 0) { e.brokenT = 0; e.poise = PO.max; }
    } else {
      e.poiseIdle = (e.poiseIdle || 0) + dt;
      if (e.poiseIdle > PO.regenDelay) e.poise = Math.min(PO.max, e.poise + PO.regenRate * dt);
    }
  }
}

export function drawStatus(ctx, e, time, spriteH) {
  if (e.dead) return;
  if (e.burn) {
    for (let i = 0; i < 3; i++) {
      const x = e.x + Math.sin(time * 7 + i * 2.1) * e.r * 0.6, y = e.y - e.r * 0.4 - i * 6;
      const h = 12 + 5 * Math.sin(time * 13 + i);
      ctx.fillStyle = i === 1 ? '#ffd08a' : '#ff8a3d';
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 4, y - h * 0.6, x, y - h); ctx.quadraticCurveTo(x + 4, y - h * 0.6, x + 4, y); ctx.closePath(); ctx.fill();
    }
  }
  if (e.markT > 0) {
    const y = e.y - spriteH - 26;
    ctx.save(); ctx.globalAlpha = Math.min(1, e.markT);
    ctx.fillStyle = '#c8d2f4'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, y, 9, 0, Math.PI * 2); ctx.arc(e.x + 4, y - 2, 7.5, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.stroke();
    ctx.restore();
  }
  if (e.brokenT > 0) {
    const y = e.y - spriteH - 8;
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i * Math.PI * 2) / 3;
      const x = e.x + Math.cos(a) * 30, yy = y + Math.sin(a) * 8;
      ctx.fillStyle = '#f5d48a'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 3 : 7, aa = (k / 10) * Math.PI * 2; k ? ctx.lineTo(x + Math.cos(aa) * r, yy + Math.sin(aa) * r) : ctx.moveTo(x + Math.cos(aa) * r, yy + Math.sin(aa) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}
