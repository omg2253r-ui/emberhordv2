// Physical loot on the ground: arcs out of the enemy, bounces, glows by rarity, then flies to the player.
import { BALANCE } from '../config/balance.js';
import { getItem } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';

export function createDrop(kind, id, qty, x, y, rng) {
  const a = rng.next() * Math.PI * 2, sp = 60 + rng.next() * 110;
  const def = kind === 'item' ? getItem(id) : null;   // 'gold' and 'spark' are currencies
  return {
    kind, id, qty, x, y, z: 6, vz: 260 + rng.next() * 120,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7,
    state: 'fly', t: 0, bob: rng.next() * 6,
    rarity: def ? rarityOf(def.rarity) : null,
    collected: false, blockedUntil: 0,
  };
}

// Returns true while the drop still exists.
export function updateDrop(d, dt, world) {
  d.t += dt; d.bob += dt * 3;
  const p = world.player;
  if (d.state === 'fly') {
    d.vz -= 900 * dt; d.z += d.vz * dt;
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.z <= 0) {
      d.z = 0;
      if (Math.abs(d.vz) > 120) { d.vz = -d.vz * 0.38; d.vx *= 0.5; d.vy *= 0.5; }
      else { d.state = 'rest'; d.vx = d.vy = 0; if (d.rarity && d.rarity.order >= 2) world.fx.ring(d.x, d.y, 6, 34, d.rarity.color, 0.6, 3); }
    }
    d.x = Math.max(20, Math.min(world.arena.w - 20, d.x)); d.y = Math.max(40, Math.min(world.arena.h - 20, d.y));
    return true;
  }
  if (p.dead) return true;
  const dist = Math.hypot(p.x - d.x, p.y - 20 - d.y);
  const pull = world.vacuum || dist < BALANCE.pickup.magnetRadius * (p.stats.magnetMult || 1);
  if (pull && world.time >= d.blockedUntil) d.state = 'magnet';
  if (d.state === 'magnet') {
    const sp = BALANCE.pickup.flySpeed * (world.vacuum ? 1.6 : 1) * Math.min(1, 0.35 + d.t * 0.8);
    const a = Math.atan2(p.y - 20 - d.y, p.x - d.x);
    d.x += Math.cos(a) * sp * dt; d.y += Math.sin(a) * sp * dt;
    if (dist < BALANCE.pickup.collectRadius) {
      const ok = world.collect(d);
      if (ok) return false;
      // Bag full: bounce away and wait before trying again.
      d.state = 'rest'; d.blockedUntil = world.time + 2.5;
      d.x -= Math.cos(a) * 60; d.y -= Math.sin(a) * 60;
    }
  }
  return true;
}

// skin: optional sprite prefix. Scenes no longer pass 'egy_' for z13 (v9.3.2) — the ground icon must match the bag / pickup toast icon.
export function drawDrop(ctx, d, sprites, time, skin = '') {
  const key = d.kind === 'gold' ? 'gold' : d.kind === 'spark' ? 'spark' : d.id;
  const icon = (skin && sprites[`icon_${skin}${key}`]) || sprites[`icon_${key}`];
  const bobY = d.state === 'rest' ? Math.sin(d.bob) * 3 : 0;
  const size = d.kind === 'gold' ? 0.42 : d.kind === 'spark' ? 0.5 : 0.55;
  if (d.kind === 'spark') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(d.x, d.y - d.z - 16 + bobY, 2, d.x, d.y - d.z - 16 + bobY, 28);
    gr.addColorStop(0, `rgba(255,200,110,${(0.55 + 0.25 * Math.sin(time * 6 + d.bob)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.x, d.y - d.z - 16 + bobY, 28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // ground shadow
  ctx.fillStyle = 'rgba(10,6,4,0.35)';
  ctx.beginPath(); ctx.ellipse(d.x, d.y, 12 * size * 1.6, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (d.rarity && d.rarity.order >= 1) {
    const g = 0.45 + 0.25 * Math.sin(time * 4 + d.bob);
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(d.x, d.y - d.z - 14 + bobY, 2, d.x, d.y - d.z - 14 + bobY, 30);
    grad.addColorStop(0, d.rarity.color); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = g; ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(d.x, d.y - d.z - 14 + bobY, 30, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (d.rarity.order >= 2 && d.state === 'rest') { // light pillar for rare loot
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 3);
      const lg = ctx.createLinearGradient(0, d.y - 120, 0, d.y);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, d.rarity.color);
      ctx.fillStyle = lg; ctx.fillRect(d.x - 6, d.y - 120, 12, 120);
      ctx.globalAlpha = 1;
    }
  }
  if (icon) ctx.drawImage(icon.canvas, d.x - (icon.w * size) / 2, d.y - d.z - icon.h * size - 2 + bobY, icon.w * size, icon.h * size);
}
