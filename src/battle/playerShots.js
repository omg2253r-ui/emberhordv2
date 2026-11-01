// Player-side ranged attacks: arrows, magic bolts, thrown knives, pet feathers; delayed blast zones (meteor);
// and breath cones (race skill, drake pet). Every hit goes through world.playerStrike / world.petStrike.

export function createShot(o) {
  return {
    kind: o.kind, x: o.x, y: o.y, vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed, speed: o.speed,
    r: o.r, pierce: o.pierce || 0, homing: o.homing || 0, power: o.power, critBonus: o.critBonus || 0, forceCrit: !!o.forceCrit,
    stun: o.stun || 0, kb: o.kb || 90, src: o.src || 'proj', life: o.life || 1.1, t: 0, hit: new Set(), dead: false, target: null,
    burn: !!o.burn, tint: o.tint || null, mark: o.mark || 0, slow: o.slow || 0,
  };
}

const ROOM_PAD = 50;

export function updateShots(list, dt, world) {
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.t += dt; s.life -= dt;
    // gentle homing: turn toward the nearest enemy in front
    if (s.homing > 0) {
      if (!s.target || s.target.dead) {
        let best = null, bd = 520;
        const dir = Math.atan2(s.vy, s.vx);
        for (const e of world.enemies) {
          if (e.dead || e.spawning > 0 || s.hit.has(e)) continue;
          const a = Math.atan2(e.y - 30 - s.y, e.x - s.x);
          let da = Math.abs(a - dir); if (da > Math.PI) da = Math.PI * 2 - da;
          const d = Math.hypot(e.x - s.x, e.y - s.y);
          if (da < 1.1 && d < bd) { bd = d; best = e; }
        }
        s.target = best;
      }
      if (s.target) {
        const cur = Math.atan2(s.vy, s.vx), want = Math.atan2(s.target.y - s.target.r - s.y, s.target.x - s.x);
        let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        const a = cur + Math.max(-s.homing * dt, Math.min(s.homing * dt, d));
        s.vx = Math.cos(a) * s.speed; s.vy = Math.sin(a) * s.speed;
      }
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.kind === 'bolt' || s.kind === 'feather' || s.kind === 'bigArrow') {
      if (Math.random() < 0.7) world.particles.spawn({ x: s.x, y: s.y, vx: -s.vx * 0.08, vy: -s.vy * 0.08, life: 0.3, size: s.r * 0.7, size2: 0.5, color: s.tint ? s.tint[1] : s.kind === 'feather' ? '#ff8a3d' : s.kind === 'bigArrow' ? '#d6f59a' : '#ffd08a', drag: 4, glow: true });
    }
    for (const e of world.enemies) {
      if (s.dead || e.dead || e.spawning > 0 || s.hit.has(e)) continue;
      if (Math.hypot(e.x - s.x, e.y - e.r * 0.8 - s.y) > e.r + s.r) continue;
      s.hit.add(e);
      const a = Math.atan2(s.vy, s.vx);
      const opts = { kx: Math.cos(a) * s.kb, ky: Math.sin(a) * s.kb, critBonus: s.critBonus, forceCrit: s.forceCrit, stun: s.stun, src: s.src, burn: s.burn || undefined };
      if (s.mark) { opts.mark = s.mark; opts.markT = 3; }
      if (s.slow) { opts.slow = s.slow; opts.slowT = 1.5; }
      if (s.src === 'pet') world.petStrike(e, s.power, opts); else world.playerStrike(e, s.power, opts);
      world.particles.burst(s.x, s.y, 8, { color: ['#fff3c4', '#ffd08a'], speedMin: 60, speedMax: 200, life: 0.25, size: 2.5, drag: 5, glow: true });
      if (s.pierce-- <= 0) s.dead = true;
    }
    const W = world.arena.w, H = world.arena.h;
    const out = s.x < ROOM_PAD || s.y < ROOM_PAD || s.x > W - ROOM_PAD || s.y > H - 20 || !!world.shotBlocked?.(s.x, s.y);
    if (out && !s.dead) { s.dead = true; world.particles.burst(s.x, s.y, 5, { color: ['#c9bfa9', '#8a7350'], speedMin: 30, speedMax: 120, life: 0.25, size: 2, drag: 5 }); }
    if (s.dead || s.life <= 0) list.splice(i, 1);
  }
}

export function drawShot(ctx, s, time) {
  const a = Math.atan2(s.vy, s.vx);
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(a);
  if (s.kind === 'arrow' || s.kind === 'bigArrow') {
    const big = s.kind === 'bigArrow', L = big ? 46 : 30;
    if (big) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-L * 1.6, 0, 8, 0);
      g.addColorStop(0, 'rgba(214,245,154,0)'); g.addColorStop(1, 'rgba(214,245,154,0.75)');
      ctx.fillStyle = g; ctx.fillRect(-L * 1.6, -7, L * 1.6 + 8, 14);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.strokeStyle = 'rgba(243,230,200,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-L - 26, 0); ctx.lineTo(-L, 0); ctx.stroke();
    }
    ctx.strokeStyle = '#6e4a30'; ctx.lineWidth = big ? 3.4 : 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = '#efe2c4';
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(-L - 7, -5); ctx.lineTo(-L + 3, 0); ctx.lineTo(-L - 7, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = big ? '#d6f59a' : '#d7d1c4'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(big ? 12 : 8, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (s.kind === 'knife') {
    ctx.rotate(s.t * 30);
    ctx.fillStyle = '#e8ecef'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-2, -4); ctx.lineTo(-6, 0); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2a20'; ctx.fillRect(-11, -2, 6, 4);
  } else if (s.kind === 'shard' || s.kind === 'spear') {
    // v8: ice lance / bone spear — a long tapered shard with a cold (or pale) glow
    const L = s.kind === 'spear' ? 44 : 34, col = s.tint || ['143,214,255', '#f4fdff'];
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-L * 1.8, 0, L * 0.4, 0);
    g.addColorStop(0, `rgba(${col[0]},0)`); g.addColorStop(1, `rgba(${col[0]},0.7)`);
    ctx.fillStyle = g; ctx.fillRect(-L * 1.8, -s.r * 0.8, L * 2.2, s.r * 1.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = s.kind === 'spear' ? '#efe6d0' : col[1]; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(L * 0.5, 0); ctx.lineTo(-L * 0.2, -s.r * 0.55); ctx.lineTo(-L, 0); ctx.lineTo(-L * 0.2, s.r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(L * 0.4, 0); ctx.lineTo(-L * 0.8, 0); ctx.stroke();
  } else if (s.kind === 'star') {
    const col = s.tint || ['184,208,255', '#ffffff'];
    ctx.rotate(s.t * 9);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r * 3);
    g.addColorStop(0, `rgba(${col[0]},0.9)`); g.addColorStop(1, `rgba(${col[0]},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s.r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col[1];
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? s.r * 0.45 : s.r * 1.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else if (s.kind === 'wolf') {
    // a spirit wolf running at its prey
    const col = s.tint || ['159,230,207', '#f6fffb'];
    const bob = Math.sin(time * 22 + s.t * 10) * 2;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-60, 0, 20, 0);
    g.addColorStop(0, `rgba(${col[0]},0)`); g.addColorStop(1, `rgba(${col[0]},0.55)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-20, bob, 42, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${col[0]},0.85)`;
    ctx.beginPath(); ctx.ellipse(-4, bob, 20, 9, 0, 0, Math.PI * 2); ctx.fill();          // body
    ctx.beginPath(); ctx.moveTo(10, bob - 7); ctx.lineTo(24, bob - 2); ctx.lineTo(10, bob + 5); ctx.closePath(); ctx.fill();   // snout
    ctx.beginPath(); ctx.moveTo(6, bob - 7); ctx.lineTo(9, bob - 16); ctx.lineTo(12, bob - 7); ctx.closePath(); ctx.fill();    // ear
    ctx.fillStyle = col[1]; ctx.beginPath(); ctx.arc(13, bob - 4, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${col[0]},0.8)`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const leg = Math.sin(time * 30 + s.t * 12) * 6;
    ctx.beginPath(); ctx.moveTo(4, bob + 6); ctx.lineTo(8 + leg, bob + 14); ctx.moveTo(-12, bob + 6); ctx.lineTo(-16 - leg, bob + 14); ctx.stroke();
  } else {
    // bolt / feather: glowing orb with a short streak
    const col = s.tint || (s.kind === 'feather' ? ['255,138,61', '#ffd08a'] : ['255,200,110', '#fff3c4']);
    const pulse = 1 + 0.15 * Math.sin(time * 24 + s.t * 10);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r * 2.6 * pulse);
    g.addColorStop(0, `rgba(${col[0]},0.95)`); g.addColorStop(1, `rgba(${col[0]},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s.r * 2.6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = col[1];
    if (s.kind === 'feather') { ctx.beginPath(); ctx.ellipse(0, 0, s.r * 1.2, s.r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 0, s.r * 0.6, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- delayed blast zones (meteor)
export function updateZones(zones, dt, world) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t += dt;
    if (!z.done && z.t >= z.delay) {
      z.done = true;
      world.shake(z.shake || 8, 0.3); world.sfx('slam');
      world.fx.ring(z.x, z.y, 10, z.r * 1.1, '#ffd08a', 0.5, 10);
      world.particles.burst(z.x, z.y - 10, 40, { color: ['#ff8a3d', '#ffd08a', '#c2412f', '#3a2420'], speedMin: 140, speedMax: 420, life: 0.7, size: 5, drag: 3, glow: true });
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r) continue;
        const a = Math.atan2(e.y - z.y, e.x - z.x);
        for (let k = 0; k < (z.times || 1) && !e.dead; k++) world.playerStrike(e, z.power, { ...z.opts, kx: k ? 0 : Math.cos(a) * z.kb, ky: k ? 0 : Math.sin(a) * z.kb, stun: z.stun, burn: true });
      }
      world.hitStop(0.06);
    }
    if (z.t >= z.delay + 0.35) zones.splice(i, 1);
  }
}

export function drawZones(ctx, zones, time) {
  for (const z of zones) {
    const k = Math.min(1, z.t / z.delay);
    ctx.save();
    if (!z.done) {
      ctx.fillStyle = `rgba(255,170,80,${(0.1 + 0.08 * Math.sin(time * 20)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,216,137,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, Math.PI * 2); ctx.stroke();
      // the falling meteor
      const h = (1 - k) * 420;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(z.x + h * 0.3, z.y - h - 20, 2, z.x + h * 0.3, z.y - h - 20, 30);
      g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.4, 'rgba(255,138,61,0.9)'); g.addColorStop(1, 'rgba(194,65,47,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x + h * 0.3, z.y - h - 20, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,90,0.5)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(z.x + h * 0.3 + 30, z.y - h - 90); ctx.lineTo(z.x + h * 0.3, z.y - h - 20); ctx.stroke();
    } else {
      const p = Math.min(1, (z.t - z.delay) / 0.35);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = 'rgba(255,170,80,0.35)';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1 + p * 0.2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- breath cones
// cone: { from() → {x, y, dir}, range, arc, ticks, interval, power, src, t, n }
export function updateCones(cones, dt, world) {
  for (let i = cones.length - 1; i >= 0; i--) {
    const c = cones[i];
    c.t += dt;
    const o = c.from();
    if (!o) { cones.splice(i, 1); continue; }
    for (let k = 0; k < 3; k++) {
      const a = o.dir + (Math.random() - 0.5) * c.arc;
      const sp = 260 + Math.random() * 220;
      world.particles.spawn({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: c.range / sp, size: 7, size2: 14, color: Math.random() < 0.5 ? '#ff8a3d' : '#ffd08a', drag: 1.2, glow: true });
    }
    while (c.n < c.ticks && c.t >= c.n * c.interval) {
      c.n += 1;
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0) continue;
        const dx = e.x - o.x, dy = e.y - e.r - o.y, d = Math.hypot(dx, dy);
        if (d > c.range + e.r) continue;
        let da = Math.abs(Math.atan2(dy, dx) - o.dir); if (da > Math.PI) da = Math.PI * 2 - da;
        if (da > c.arc / 2 + 0.15) continue;
        const opts = { kx: Math.cos(o.dir) * 60, ky: Math.sin(o.dir) * 60, src: c.src, burn: true };
        if (c.src === 'pet') world.petStrike(e, c.power, opts); else world.playerStrike(e, c.power, opts);
      }
    }
    if (c.n >= c.ticks && c.t >= c.ticks * c.interval) cones.splice(i, 1);
  }
}
