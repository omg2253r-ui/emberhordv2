// Telegraphed area strikes, lingering ground pools, enemy projectiles and wind gusts for the online zones.
// The host creates them and every client receives a copy; each client resolves them against ITS OWN hero only
// (you are hit by what you saw on your screen), so the damage is fair for everyone in the party.
import { inArc } from '../systems/combat.js';

const TAU = Math.PI * 2;
export const TONES = Object.freeze({
  wind: ['198,236,226', '#e6fff6'], ice: ['143,208,240', '#e8f8ff'], poison: ['176,122,208', '#e8ff9a'], shadow: ['154,138,208', '#e0b0ff'],
  earth: ['200,160,96', '#f0d89a'], spore: ['159,255,216', '#ecd2ff'], volt: ['255,230,90', '#fff9c4'], fire: ['255,138,61', '#ffe0a0'],
  sun: ['255,207,90', '#fff3c4'], holy: ['255,243,160', '#ffffff'], bone: ['224,80,58', '#f3ead2'],
  pierce: ['255,40,90', '#ffd0dc'],      // v7: piercing attacks (no block, no armour) are always this crimson
  mirror: ['191,232,255', '#ffffff'], eclipse: ['255,182,72', '#fff3c4'], moon: ['184,170,255', '#f0ecff'],   // v8 lands
});
const POOL_STYLE = Object.freeze({
  poison: { fill: 'rgba(150,90,190,0.38)', edge: 'rgba(232,255,154,0.6)', bubble: '#e8ff9a' },
  fire: { fill: 'rgba(255,110,40,0.36)', edge: 'rgba(255,224,160,0.7)', bubble: '#ffcf5a' },
  ice: { fill: 'rgba(170,220,250,0.42)', edge: 'rgba(255,255,255,0.75)', bubble: '#ffffff' },
  web: { fill: 'rgba(200,184,255,0.25)', edge: 'rgba(159,255,216,0.7)', bubble: '#9fffd8' },
  sand: { fill: 'rgba(200,160,96,0.42)', edge: 'rgba(240,216,154,0.6)', bubble: '#f0d89a' },
});
const SLOW = Object.freeze({ web: 0.4, sand: 0.55 });
const TICK = 0.5;

export function createEffects() {
  return { strikes: [], pools: [], shots: [], gusts: [], seq: 0 };
}

// ------------------------------------------------------------------ shapes
export function inShape(s, x, y, pad = 0) {
  switch (s.shape) {
    case 'circle': return Math.hypot(x - s.x, y - s.y) <= s.r + pad;
    case 'ring': { const d = Math.hypot(x - s.x, y - s.y); return d <= s.r + pad && d >= (s.inner || 0) - pad; }
    case 'line': {
      const dx = x - s.x, dy = y - s.y, c = Math.cos(s.angle), sn = Math.sin(s.angle);
      const along = dx * c + dy * sn, across = -dx * sn + dy * c;
      return along >= -pad && along <= s.len + pad && Math.abs(across) <= s.width / 2 + pad;
    }
    case 'cone': return inArc(s.x, s.y, s.angle, s.r, s.arc, x, y, pad) && (!(s.inner > 0) || Math.hypot(x - s.x, y - s.y) >= s.inner - pad);   // v8: a band of a cone
    case 'rect': return x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad;
    default: return false;
  }
}
function centerOf(s) {
  if (s.shape === 'line') return { x: s.x + Math.cos(s.angle) * s.len / 2, y: s.y + Math.sin(s.angle) * s.len / 2 };
  if (s.shape === 'cone') return { x: s.x + Math.cos(s.angle) * s.r * 0.6, y: s.y + Math.sin(s.angle) * s.r * 0.6 };
  if (s.shape === 'rect') return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  return { x: s.x, y: s.y };
}

// ------------------------------------------------------------------ update
// ctx: { me (my hero), hurt(owner, mult, kx, ky, fire) → bool, posOf(peer) → {x,y} | null, particles, sfx, shake, arena }
// Returns what the pools do to me this frame: { slow, ice }.
export function updateEffects(fx, dt, ctx) {
  const me = ctx.me;
  const alive = me && !me.dead;
  const at = alive ? { x: me.x, y: me.y - 10 } : null;
  // strikes
  for (let i = fx.strikes.length - 1; i >= 0; i--) {
    const s = fx.strikes[i];
    s.t += dt;
    if (s.t < s.dur) continue;
    if (s.mult > 0 || s.pct > 0) {
      if (alive && inShape(s, at.x, at.y, me.r * 0.6)) {
        const a = Math.atan2(at.y - s.y, at.x - s.x);
        const kb = s.kb ?? 330;
        ctx.hurt(s.owner, s.mult, Math.cos(a) * kb, Math.sin(a) * kb, !!s.fire, false, (s.pierce || s.silence || s.chill || s.pct) ? { pierce: !!s.pierce, silence: s.silence || 0, chill: s.chill || 0, pct: s.pct || 0 } : null);
      }
      burst(s, ctx);
    }
    if (s.then?.pool) {
      const c = centerOf(s);
      addPool(fx, { ...s.then.pool, x: c.x, y: c.y });
    }
    fx.strikes.splice(i, 1);
  }
  // pools
  let slow = 1, ice = false;
  for (let i = fx.pools.length - 1; i >= 0; i--) {
    const p = fx.pools[i];
    p.t += dt;
    if (p.t >= p.dur) { fx.pools.splice(i, 1); continue; }
    if (!alive || Math.hypot(at.x - p.x, (at.y - p.y) * 1.4) > p.r) continue;
    if (SLOW[p.kind]) slow = Math.min(slow, SLOW[p.kind]);
    if (p.kind === 'ice') ice = true;
    if (p.mult > 0) {
      p.tick = (p.tick ?? 0) - dt;
      if (p.tick <= 0) { p.tick = TICK; ctx.hurt(p.owner || { atk: p.atk || 10, crit: 0, critMult: 1 }, p.mult, 0, 0, p.kind === 'fire', true); }
    }
  }
  // projectiles
  for (let i = fx.shots.length - 1; i >= 0; i--) {
    const s = fx.shots[i];
    s.t += dt; s.life -= dt;
    if (s.orbit) {
      const o = s.orbit, r = o.r0 + o.grow * s.t, a = s.angle0 + o.spin * s.t;
      s.x = o.cx + Math.cos(a) * r; s.y = o.cy + Math.sin(a) * r * 0.8;
    } else {
      if (s.homing && s.life > 0.4) {
        const tgt = s.target === 'me' ? (alive ? me : null) : ctx.posOf?.(s.target);
        if (tgt) {
          const want = Math.atan2(tgt.y - 30 - s.y, tgt.x - s.x), cur = Math.atan2(s.vy, s.vx);
          let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const turn = Math.max(-s.homing * dt, Math.min(s.homing * dt, d)), sp = Math.hypot(s.vx, s.vy) || s.speed;
          s.vx = Math.cos(cur + turn) * sp; s.vy = Math.sin(cur + turn) * sp;
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    if (Math.random() < 0.5) ctx.particles.spawn({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.3, size: s.r * 0.5, size2: 1, color: TONES[s.tone]?.[1] || '#ffd08a', drag: 3, glow: true });
    const A = ctx.arena;
    const out = s.x < -60 || s.y < -60 || s.x > A.w + 60 || s.y > A.h + 60;
    let hit = false;
    const hy = s.ground ? me?.y : (me ? me.y - 30 : 0);
    if (alive && !s.dead && (s.hitT || 0) <= 0 && Math.hypot(s.x - me.x, s.y - hy) < s.r + me.r) {
      const a = Math.atan2(s.vy || (me.y - s.y), s.vx || (me.x - s.x));
      if (ctx.hurt(s.owner, s.mult, Math.cos(a) * 240, Math.sin(a) * 240, !!s.fire)) hit = true;
      if (s.pierce) s.hitT = 0.8;
    }
    if (s.hitT > 0) s.hitT -= dt;
    if ((hit && !s.pierce) || s.life <= 0 || out) {
      if (s.pool && !out) addPool(fx, { ...s.pool, x: s.x, y: s.ground ? s.y : s.y + 30, mult: s.pool.mult ?? (s.pool.kind === 'poison' || s.pool.kind === 'fire' ? 0.25 : 0), owner: s.owner });
      if (hit || s.life <= 0) ctx.particles.burst(s.x, s.y, 8, { color: [TONES[s.tone]?.[1] || '#ffd08a', '#ffffff'], speedMin: 60, speedMax: 200, life: 0.3, size: 3, drag: 4, glow: true });
      fx.shots.splice(i, 1);
    }
  }
  // gusts: a warning, then everyone is pushed
  for (let i = fx.gusts.length - 1; i >= 0; i--) {
    const g = fx.gusts[i];
    g.t += dt;
    if (g.t >= g.warn && g.t < g.warn + g.dur && alive && !(me.dashT > 0)) {
      me.x += Math.cos(g.angle) * g.force * dt; me.y += Math.sin(g.angle) * g.force * dt;
    }
    if (g.t >= g.warn + g.dur) fx.gusts.splice(i, 1);
  }
  return { slow, ice };
}

function burst(s, ctx) {
  const c = centerOf(s);
  const col = TONES[s.tone] || TONES.fire;
  const big = s.shape === 'circle' && s.r > 100;
  ctx.particles.burst(c.x, c.y, big ? 26 : 14, { color: [col[1], `rgb(${col[0]})`, '#ffffff'], speedMin: 80, speedMax: big ? 320 : 220, life: 0.45, size: 4, drag: 3.5, glow: s.tone !== 'earth' });
  if (s.shape === 'circle' && s.r >= 80) ctx.shake(5, 0.18);
  if (s.meteor || (s.shape === 'circle' && s.r >= 110)) ctx.sfx('slam');
}

// ------------------------------------------------------------------ create (the host, and copies from the host)
export function addStrike(fx, s) { const x = { t: 0, tone: 'fire', ...s }; fx.strikes.push(x); return x; }
export function addPool(fx, p) { const x = { t: 0, mult: 0, ...p }; fx.pools.push(x); if (fx.pools.length > 40) fx.pools.shift(); return x; }
export function addShot(fx, o) {
  const s = { t: 0, life: o.life ?? 4, x: o.x, y: o.y, r: o.r ?? 10, mult: o.mult ?? 1, kind: o.kind || 'orb', tone: SHOT_TONE[o.kind] || 'fire', owner: o.owner,
    vx: Math.cos(o.angle) * (o.speed ?? 300), vy: Math.sin(o.angle) * (o.speed ?? 300), speed: o.speed ?? 300, homing: o.homing || 0, pierce: !!o.pierce,
    pool: o.pool || null, fire: !!o.fire, ground: !!o.ground, target: o.target || null, angle0: o.angle,
    orbit: o.orbit ? { ...o.orbit } : null };
  fx.shots.push(s);
  if (fx.shots.length > 160) fx.shots.shift();
  return s;
}
export function addGust(fx, g) { fx.gusts.push({ t: 0, warn: 1.2, dur: 1.2, force: 240, ...g }); }
const SHOT_TONE = { seed: 'spore', shard: 'ice', sand: 'earth', spore: 'spore', poison: 'poison', feather: 'wind', tornado: 'wind', orb: 'fire', wheel: 'holy', petal: 'holy' };

// ------------------------------------------------------------------ drawing
export function drawPools(ctx, fx, time) {
  for (const p of fx.pools) {
    const st = POOL_STYLE[p.kind] || POOL_STYLE.poison;
    const fadeIn = Math.min(1, p.t / 0.3), fadeOut = Math.min(1, (p.dur - p.t) / 0.6);
    ctx.globalAlpha = fadeIn * fadeOut;
    ctx.fillStyle = st.fill; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = st.edge; ctx.lineWidth = 2; ctx.stroke();
    if (p.kind === 'web') { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r * 0.7); } ctx.stroke(); }
    const n = 3;
    for (let i = 0; i < n; i++) {
      const ph = (time * 1.3 + i / n + p.x * 0.01) % 1;
      ctx.fillStyle = st.bubble; ctx.globalAlpha = fadeIn * fadeOut * (1 - ph) * 0.8;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(i * 2.3 + p.y) * p.r * 0.5, p.y + Math.sin(i * 1.7) * p.r * 0.3 - ph * 14, 2 + ph * 3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawStrikes(ctx, fx, time) {
  for (const s of fx.strikes) {
    const col = TONES[s.tone] || TONES.fire;
    const k = Math.min(1, s.t / s.dur);
    const pulse = 0.5 + 0.5 * Math.sin(time * 18);
    const warnOnly = !(s.mult > 0 || s.pct > 0), lethal = s.pct > 0;
    ctx.save();
    const base = warnOnly ? 0.08 : lethal ? 0.2 + 0.12 * pulse : 0.12 + 0.08 * pulse, fill = warnOnly ? 0.14 : lethal ? 0.42 : 0.3;
    const outline = `rgba(${col[0]},${warnOnly ? 0.55 : 0.9})`;
    ctx.lineWidth = 3; ctx.setLineDash(warnOnly ? [6, 10] : [12, 8]);
    if (s.shape === 'circle' || s.shape === 'ring') {
      ctx.fillStyle = `rgba(${col[0]},${base})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); if (s.shape === 'ring') ctx.arc(s.x, s.y, Math.max(0, s.inner || 0), 0, TAU, true); ctx.fill('evenodd');
      ctx.fillStyle = `rgba(${col[0]},${fill})`;
      if (s.shape === 'circle') { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * k, 0, TAU); ctx.fill(); }
      else { const rr = (s.inner || 0) + (s.r - (s.inner || 0)) * k; ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.arc(s.x, s.y, Math.max(0, s.inner || 0), 0, TAU, true); ctx.fill('evenodd'); }
      ctx.strokeStyle = outline; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      if (s.shape === 'ring' && s.inner > 0) { ctx.beginPath(); ctx.arc(s.x, s.y, s.inner, 0, TAU); ctx.stroke(); }
      if (s.arc && s.mult > 0) {
        // a lobbed shell: its arc from the launcher to the landing spot
        const sx = s.arc.x, sy = s.arc.y, mx = (sx + s.x) / 2, my = Math.min(sy, s.y) - 220;
        const u = k, bx = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * s.x, by = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * s.y;
        ctx.setLineDash([]); ctx.fillStyle = '#3a2420'; ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill(); ctx.stroke();
      }
      if (s.meteor && s.mult > 0) {
        const fy = s.y - (1 - k) * 520;
        ctx.setLineDash([]); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(s.x, fy, 2, s.x, fy, 26); g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, fy, 26, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (s.shape === 'line') {
      ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.fillStyle = `rgba(${col[0]},${base})`; ctx.fillRect(0, -s.width / 2, s.len, s.width);
      ctx.fillStyle = `rgba(${col[0]},${fill})`; ctx.fillRect(0, -s.width / 2, s.len * k, s.width);
      ctx.strokeStyle = outline; ctx.strokeRect(0, -s.width / 2, s.len, s.width);
    } else if (s.shape === 'cone' && s.inner > 0) {
      // a band (part of a ring): v8 shatter rings
      const a0 = s.angle - s.arc / 2, a1 = s.angle + s.arc / 2, ri = s.inner, rr = ri + (s.r - ri) * k;
      ctx.fillStyle = `rgba(${col[0]},${base})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, a0, a1); ctx.arc(s.x, s.y, ri, a1, a0, true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(${col[0]},${fill})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, rr, a0, a1); ctx.arc(s.x, s.y, ri, a1, a0, true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = outline; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, a0, a1); ctx.arc(s.x, s.y, ri, a1, a0, true); ctx.closePath(); ctx.stroke();
    } else if (s.shape === 'cone') {
      ctx.fillStyle = `rgba(${col[0]},${base})`;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.r, s.angle - s.arc / 2, s.angle + s.arc / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(${col[0]},${fill})`;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.r * k, s.angle - s.arc / 2, s.angle + s.arc / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = outline; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.r, s.angle - s.arc / 2, s.angle + s.arc / 2); ctx.closePath(); ctx.stroke();
    } else if (s.shape === 'rect') {
      ctx.fillStyle = `rgba(${col[0]},${base + 0.1 * pulse})`; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = outline; ctx.strokeRect(s.x, s.y, s.w, s.h);
    }
    if (s.tone === 'holy' && warnOnly && s.shape === 'circle') {
      // a safe spot: a column of light the hero runs into
      ctx.setLineDash([]); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(255,243,160,${(0.35 + 0.2 * pulse).toFixed(3)})`); g.addColorStop(1, 'rgba(255,243,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,250,210,${(0.18 + 0.1 * pulse).toFixed(3)})`; ctx.fillRect(s.x - s.r * 0.35, s.y - 420, s.r * 0.7, 420);
    }
    ctx.restore();
  }
}

export function drawShots(ctx, fx, time) {
  for (const s of fx.shots) {
    const col = TONES[s.tone] || TONES.fire;
    if (s.kind === 'tornado') {
      ctx.save(); ctx.translate(s.x, s.y);
      for (let i = 0; i < 5; i++) {
        const y = -i * 18, w = s.r * (0.5 + i * 0.22), a = time * 9 + i;
        ctx.strokeStyle = `rgba(230,250,245,${0.7 - i * 0.08})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(Math.sin(a) * 6, y, w, w * 0.3, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    if (s.kind === 'wheel') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(time * 12);
      ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = '#8f6f37'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s.r, -6); ctx.lineTo(s.r * 0.8, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      continue;
    }
    const pulse = 1 + 0.12 * Math.sin(time * 20 + s.t * 10);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, s.r * 2.4 * pulse);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, `rgba(${col[0]},0.75)`); g.addColorStop(1, `rgba(${col[0]},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.4 * pulse, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = col[1]; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2;
    if (s.kind === 'shard' || s.kind === 'feather' || s.kind === 'petal') {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(s.r * 1.6, 0); ctx.lineTo(-s.r, -s.r * 0.6); ctx.lineTo(-s.r * 0.5, 0); ctx.lineTo(-s.r, s.r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.7, 0, TAU); ctx.fill(); ctx.stroke(); }
  }
}

// Gust warning: arrows across the screen in the wind direction (drawn in world space over the arena).
export function drawGusts(ctx, fx, arena, time) {
  for (const g of fx.gusts) {
    const warn = g.t < g.warn;
    const a = warn ? 0.25 + 0.25 * Math.sin(time * 14) : 0.35;
    ctx.save(); ctx.globalAlpha = Math.max(0.1, a);
    ctx.strokeStyle = warn ? '#e6fff6' : '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const c = Math.cos(g.angle), s = Math.sin(g.angle);
    for (let i = 0; i < 14; i++) {
      const bx = ((i * 197) % arena.w), by = 120 + ((i * 131) % (arena.h - 200));
      const off = warn ? 0 : ((g.t - g.warn) * 600 + i * 40) % 120;
      const x = bx + c * off, y = by + s * off;
      ctx.beginPath(); ctx.moveTo(x - c * 40, y - s * 40); ctx.lineTo(x + c * 40, y + s * 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + c * 40, y + s * 40); ctx.lineTo(x + c * 22 - s * 14, y + s * 22 + c * 14); ctx.moveTo(x + c * 40, y + s * 40); ctx.lineTo(x + c * 22 + s * 14, y + s * 22 - c * 14); ctx.stroke();
    }
    ctx.restore();
  }
}
