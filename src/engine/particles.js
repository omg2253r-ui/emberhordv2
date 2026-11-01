// Pooled particle system. A fixed pool avoids garbage collection spikes during big fights.
export function createParticles(max = 420) {
  const pool = [];
  for (let i = 0; i < max; i++) pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, size2: 0, color: '#fff', grav: 0, drag: 0, shape: 0, rot: 0, vr: 0, glow: false });
  let cursor = 0;
  let scale = 1; // lowered by reduced motion and by the quality setting
  let glowOn = true; // additive blending is the costliest thing here; the "low" quality turns it off

  // direct spawns (not via burst) are thinned at random by the same scale
  function spawn(o) {
    if (scale < 1 && Math.random() > scale) return null;
    return add(o);
  }

  function add(o) {
    for (let n = 0; n < max; n++) {
      const p = pool[cursor]; cursor = (cursor + 1) % max;
      if (p.alive && n < max - 1) continue;
      p.alive = true;
      p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.life = p.max = o.life || 0.5; p.size = o.size || 3; p.size2 = o.size2 ?? 0;
      p.color = o.color || '#fff'; p.grav = o.grav || 0; p.drag = o.drag ?? 2;
      p.shape = o.shape || 0; p.rot = o.rot || 0; p.vr = o.vr || 0; p.glow = !!o.glow;
      return p;
    }
    return null;
  }

  return {
    setScale(s) { scale = s; },
    setGlow(v) { glowOn = !!v; },
    // Radial burst helper
    burst(x, y, count, o = {}) {
      const n = Math.max(1, Math.round(count * scale));
      for (let i = 0; i < n; i++) {
        const a = (o.angle ?? Math.random() * Math.PI * 2) + (o.spread != null ? (Math.random() - 0.5) * o.spread : 0);
        const sp = (o.speedMin ?? 60) + Math.random() * ((o.speedMax ?? 220) - (o.speedMin ?? 60));
        add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life ?? 0.5) * (0.6 + Math.random() * 0.6),
          size: (o.size ?? 3) * (0.6 + Math.random() * 0.8), size2: o.size2, color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color,
          grav: o.grav, drag: o.drag, shape: o.shape, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, glow: o.glow });
      }
    },
    spawn,
    update(dt) {
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    },
    draw(ctx) {
      for (const p of pool) {
        if (!p.alive) continue;
        const t = p.life / p.max;
        const s = p.size2 ? p.size2 + (p.size - p.size2) * t : p.size;
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.fillStyle = p.color;
        const lit = p.glow && glowOn;
        if (lit) ctx.globalCompositeOperation = 'lighter';
        if (p.shape === 1) { // leaf / shard
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
        }
        if (lit) ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    },
    clear() { for (const p of pool) p.alive = false; },
    get alive() { let n = 0; for (const p of pool) if (p.alive) n++; return n; },
  };
}
