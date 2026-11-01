// Enemy projectiles (fireballs). The player can dodge through them while dashing or cut them with a swing.
// Fireballs count as fire damage (reduced by the Ember Scale bloodline).
import { inArc } from '../systems/combat.js';

export function createProjectile(owner, x, y, angle, speed, r = 10, mult = 1) {
  return { owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, mult, life: 4, dead: false, t: 0 };
}

export function updateProjectiles(list, dt, world) {
  const p = world.player;
  for (let i = list.length - 1; i >= 0; i--) {
    const pr = list[i];
    pr.t += dt; pr.life -= dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (Math.random() < 0.6) world.particles.spawn({ x: pr.x, y: pr.y, vx: -pr.vx * 0.1 + (Math.random() - 0.5) * 30, vy: -pr.vy * 0.1 + (Math.random() - 0.5) * 30, life: 0.35, size: pr.r * 0.6, size2: 1, color: Math.random() < 0.5 ? '#ff8a3d' : '#ffd08a', drag: 3, glow: true });
    const out = pr.x < -40 || pr.y < -40 || pr.x > world.arena.w + 40 || pr.y > world.arena.h + 40;
    if (!pr.dead && !p.dead && Math.hypot(pr.x - p.x, pr.y - (p.y - 30)) < pr.r + p.r) {
      const a = Math.atan2(pr.vy, pr.vx);
      if (world.hitPlayer(pr.owner, pr.mult, Math.cos(a) * 240, Math.sin(a) * 240, true)) {
        pr.dead = true;
        world.particles.burst(pr.x, pr.y, 10, { color: ['#ff8a3d', '#ffd08a'], speedMin: 60, speedMax: 200, life: 0.35, size: 3, drag: 4, glow: true });
      }
    }
    if (pr.dead || pr.life <= 0 || out) list.splice(i, 1);
  }
}

// Called by the player's swing: removes fireballs inside the arc and returns how many were cut.
export function cutProjectiles(list, cx, cy, dir, range, arc, world) {
  let n = 0;
  for (const pr of list) {
    if (pr.dead || !inArc(cx, cy, dir, range, arc, pr.x, pr.y, pr.r)) continue;
    pr.dead = true; n++;
    world.particles.burst(pr.x, pr.y, 12, { color: ['#ffd08a', '#fff3c4', '#ff8a3d'], speedMin: 90, speedMax: 260, life: 0.3, size: 2.5, drag: 5, glow: true });
    world.fx.number(pr.x, pr.y - 20, 'ตัดลูกไฟ', 'info');
  }
  if (n) world.sfx('crit');
  return n;
}

export function drawProjectile(ctx, pr, time) {
  const pulse = 1 + 0.12 * Math.sin(time * 20 + pr.t * 10);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, pr.r * 2.6 * pulse);
  g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(0.35, 'rgba(255,138,61,0.8)'); g.addColorStop(1, 'rgba(194,65,47,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 2.6 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = '#8e2c21'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
