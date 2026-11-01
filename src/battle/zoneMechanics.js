// Zone mechanics: the environment of each online zone fights you too. The host runs these timers and every effect
// goes out as strikes / pools / gusts (src/battle/strikes.js), so all players see and dodge the same thing.
// Fixed props (vents, giant mushrooms, floor tiles) sit at known spots so every client draws them identically.
import { zoneStats, ZONE_ROOM } from '../data/zones.js';

const A = ZONE_ROOM;
const TAU = Math.PI * 2;

// Client-side flags: how the zone changes movement and sight for everyone.
export const ZONE_FLAGS = Object.freeze({ ice: { slippery: true }, dark: { dark: true } });

// props were laid out for the old 1240×820 room; v8 scales them to the bigger one
const SX = A.w / 1240, SY = A.h / 820;
const at = (list) => Object.freeze(list.map(([x, y]) => Object.freeze([Math.round(x * SX), Math.round(y * SY)])));
export const VENTS = at([[300, 260], [620, 220], [940, 260], [1000, 560], [620, 640], [260, 560]]);
export const SHROOMS = at([[260, 240], [980, 240], [300, 640], [940, 640]]);
export const TILE = Object.freeze({ cols: 6, rows: 4, x0: Math.round(120 * SX), y0: Math.round(150 * SY), w: Math.round(170 * SX), h: Math.round(140 * SY) });

const CRACKS = [[180, 300, 330, 360, 420, 330], [820, 250, 930, 320, 1060, 300], [300, 640, 420, 590, 560, 640], [760, 650, 880, 600, 1020, 660]].map((r) => r.map((v, i) => Math.round(v * (i % 2 ? SY : SX))));

export function createMechanic(zone, world) {
  const owner = { atk: Math.round(zoneStats(zone.level).atk * 0.9) };
  world.zoneAtk = owner.atk;
  const rng = world.rng;
  let t = 0, t2 = 0, step = 0, ri = 0;
  const near = (list, spread) => {
    const p = list.length ? list[(rng.next() * list.length) | 0] : { x: A.w / 2, y: A.h / 2 };
    return { x: Math.max(100, Math.min(A.w - 100, p.x + (rng.next() - 0.5) * spread)), y: Math.max(160, Math.min(A.h - 90, p.y + (rng.next() - 0.5) * spread)) };
  };
  const S = (s) => world.strike({ ...s, owner });

  const kinds = {
    gale(dt, list) {
      t += dt;
      if (t >= 7) { t = 0; world.gust(rng.next() * TAU, 1.2, 250); world.sfx('telegraph'); }
    },
    ice(dt, list) {
      t += dt;
      if (t >= 2.6) { t = 0; for (let i = 0; i < Math.min(3, list.length + 1); i++) { const at = near(list, 160); S({ shape: 'circle', x: at.x, y: at.y, r: 58, dur: 1.1, mult: 0.8, tone: 'ice', meteor: true }); } }
    },
    toxic(dt, list) {
      t += dt;
      if (t >= 5) { t = 0; const at = near(list, 260); world.pool({ x: at.x, y: at.y, r: 80 + rng.next() * 30, dur: 7, kind: 'poison', mult: 0.2, owner }); }
    },
    dark(dt, list) {
      t += dt;
      if (t >= 4) { t = 0; for (const p of list.slice(0, 2)) S({ shape: 'circle', x: p.x, y: p.y, r: 70, dur: 1.05, mult: 0.9, tone: 'shadow' }); }
    },
    sun(dt, list) {
      t += dt;
      if (t >= 6) {
        t = 0;
        const horiz = rng.next() < 0.5, p = near(list, 60);
        S(horiz ? { shape: 'line', x: 40, y: p.y, angle: 0, len: A.w - 80, width: 90, dur: 1.3, mult: 1, tone: 'sun' } : { shape: 'line', x: p.x, y: 80, angle: Math.PI / 2, len: A.h - 120, width: 90, dur: 1.3, mult: 1, tone: 'sun' });
      }
    },
    spores(dt) {
      t += dt;
      if (t >= 4) { t = 0; step += 1; SHROOMS.forEach(([x, y], i) => { if ((i + step) % 2 === 0) S({ shape: 'circle', x, y, r: 115, dur: 1.2, mult: 0.85, tone: 'spore', then: { pool: { kind: 'poison', r: 70, dur: 2, mult: 0.15 } } }); }); }
    },
    storm(dt, list) {
      t += dt;
      if (t >= 2.5) { t = 0; const at = near(list, 170); S({ shape: 'circle', x: at.x, y: at.y, r: 62, dur: 1.0, mult: 1, tone: 'volt', meteor: false }); world.sfx('telegraph'); }
    },
    geysers(dt) {
      t += dt;
      if (t >= 0.95) { t = 0; const [x, y] = VENTS[step % VENTS.length]; step += 1; S({ shape: 'circle', x, y, r: 85, dur: 1.1, mult: 1, fire: true, tone: 'fire', then: { pool: { kind: 'fire', r: 70, dur: 3, mult: 0.3 } } }); }
    },
    void(dt, list) {
      t += dt;
      if (t >= 4) {
        t = 0;
        const picks = new Set();
        const p = near(list, 0);
        const c = Math.max(0, Math.min(TILE.cols - 1, Math.floor((p.x - TILE.x0) / TILE.w))), r = Math.max(0, Math.min(TILE.rows - 1, Math.floor((p.y - TILE.y0) / TILE.h)));
        picks.add(r * TILE.cols + c);
        while (picks.size < 3) picks.add((rng.next() * TILE.cols * TILE.rows) | 0);
        for (const k of picks) { const cx = k % TILE.cols, cy = (k / TILE.cols) | 0; S({ shape: 'rect', x: TILE.x0 + cx * TILE.w, y: TILE.y0 + cy * TILE.h, w: TILE.w, h: TILE.h, dur: 1.4, mult: 1.1, kb: 0, tone: 'shadow' }); }
      }
    },
    ashstorm(dt, list) {
      t += dt; t2 += dt;
      if (t >= 3) { t = 0; for (const p of list.slice(0, 3)) { const at = near([p], 120); S({ shape: 'circle', x: at.x, y: at.y, r: 55, dur: 1.1, mult: 0.8, fire: true, tone: 'fire', meteor: true }); } }
      if (t2 >= 10) { t2 = 0; world.darkPulse(3.2); world.announce('พายุเถ้าพัดมา'); }
    },
    // special dungeons: light pressure only — the boss is the fight
    eruption(dt, list) {
      t += dt;
      if (t >= 6.5) { t = 0; const at = near(list, 300); S({ shape: 'circle', x: at.x, y: at.y, r: 90, dur: 1.4, mult: 0.9, fire: true, tone: 'fire', then: { pool: { kind: 'fire', r: 70, dur: 4, mult: 0.25 } } }); world.sfx('telegraph'); }
    },
    starfall(dt, list) {
      t += dt;
      if (t >= 5) { t = 0; for (const p of list.slice(0, 2)) { const at = near([{ x: p.x + (p.vx || 0) * 0.9, y: p.y + (p.vy || 0) * 0.9 }], 40); S({ shape: 'circle', x: at.x, y: at.y, r: 52, dur: 1.2, mult: 0.7, tone: 'ice', meteor: true }); } }
    },
    verdict(dt, list) {
      t += dt;
      if (t >= 7) {
        t = 0; const p = near(list, 0);
        const c = Math.max(0, Math.min(TILE.cols - 1, Math.floor((p.x - TILE.x0) / TILE.w))), r = Math.max(0, Math.min(TILE.rows - 1, Math.floor((p.y - TILE.y0) / TILE.h)));
        S({ shape: 'rect', x: TILE.x0 + c * TILE.w, y: TILE.y0 + r * TILE.h, w: TILE.w, h: TILE.h, dur: 1.5, mult: 0.9, kb: 0, tone: 'holy' });
      }
    },
    // v8 — Shattered Mirror: your reflection (the point mirrored across the arena's middle line) shoots a lane of
    // light at where you stand; one time in three a second lane crosses it from your reflection above/below.
    mirror(dt, list) {
      t += dt;
      if (t >= 5) {
        t = 0; step += 1;
        const p = list[(rng.next() * list.length) | 0];
        const m = { x: A.w - p.x, y: p.y };
        if (Math.abs(m.x - p.x) < 140) m.x = p.x < A.w / 2 ? A.w - 120 : 120;     // standing in the middle: it comes from the wall
        const a = Math.atan2(p.y - m.y, p.x - m.x), len = Math.hypot(p.x - m.x, p.y - m.y) + 260;
        S({ shape: 'line', x: m.x, y: m.y - 10, angle: a, len, width: 60, dur: 1.15, mult: 0.9, tone: 'mirror' });
        world.fx?.ring?.(m.x, m.y - 10, 8, 60, '#bfe8ff', 0.5, 4);
        if (step % 3 === 0) {
          const m2 = { x: p.x, y: A.h - p.y };
          if (Math.abs(m2.y - p.y) < 140) m2.y = p.y < A.h / 2 ? A.h - 110 : 150;
          const b = Math.atan2(p.y - m2.y, p.x - m2.x), len2 = Math.hypot(p.x - m2.x, p.y - m2.y) + 260;
          S({ shape: 'line', x: m2.x, y: m2.y - 10, angle: b, len: len2, width: 60, dur: 1.55, mult: 0.9, tone: 'mirror' });
        }
        world.sfx('telegraph');
      }
    },
    // v8 — Eclipse: every 14 s the light goes out except one circle of sun near someone; outside it, a scorching
    // ring lands after 2.2 s. Read where the light is, not where the darkness is.
    eclipse(dt, list) {
      t += dt;
      if (t >= (step ? 14 : 9)) {
        t = 0; step += 1;
        const p = list[(rng.next() * list.length) | 0], a = rng.next() * TAU;
        const at = { x: Math.max(200, Math.min(A.w - 200, p.x + Math.cos(a) * 230)), y: Math.max(220, Math.min(A.h - 160, p.y + Math.sin(a) * 170)) };
        world.darkPulse?.(2.6);
        S({ shape: 'ring', x: at.x, y: at.y, r: Math.hypot(A.w, A.h), inner: 150, dur: 2.2, mult: 0.85, tone: 'eclipse' });
        S({ shape: 'circle', x: at.x, y: at.y, r: 150, dur: 2.2, mult: 0, tone: 'holy' });
        world.announce?.('สุริยคราส! เข้าวงแสงอาทิตย์');
        world.sfx('roar');
      }
    },
  };
  const fn = kinds[zone.mechanic] || (() => {});
  return {
    reset(room) {
      ri = room; t = 0; t2 = 0; step = 0;
      // quicksand stays for the whole room
      if (zone.mechanic === 'sun') for (const [x, y] of at([[360, 300], [880, 560], [620, 420]])) world.pool({ x: x + (ri * 37) % 90, y, r: 130, dur: 9999, kind: 'sand', mult: 0, owner });
    },
    update(dt, list) { if (list.length) fn(dt, list); },
  };
}

// Static props, drawn by everyone.
export function drawMechanicFloor(ctx, zone, time) {
  if (zone.mechanic === 'geysers') {
    for (const [x, y] of VENTS) {
      ctx.fillStyle = '#1a0e0a'; ctx.strokeStyle = '#ff7a33'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, 40, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(255,138,61,${0.35 + 0.2 * Math.sin(time * 4 + x)})`; ctx.beginPath(); ctx.ellipse(x, y, 26, 13, 0, 0, TAU); ctx.fill();
    }
  } else if (zone.mechanic === 'spores') {
    for (const [x, y] of SHROOMS) {
      const glow = 0.5 + 0.5 * Math.sin(time * 1.57);
      ctx.fillStyle = '#e8d8c8'; ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - 12, y - 46, 24, 48, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a86ad0'; ctx.beginPath(); ctx.ellipse(x, y - 52, 52, 30, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(159,255,216,${0.4 + 0.5 * glow})`;
      for (const [dx, dy, r] of [[-22, -62, 7], [4, -70, 9], [26, -58, 6]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, TAU); ctx.fill(); }
    }
  } else if (zone.mechanic === 'eruption') {
    // glowing lava cracks across the crater floor (fixed, so every client draws them the same)
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2, x3, y3] of CRACKS) {
      const g = 0.45 + 0.3 * Math.sin(time * 2.2 + x1);
      ctx.strokeStyle = '#1a0806'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
      ctx.strokeStyle = `rgba(255,120,40,${g.toFixed(3)})`; ctx.lineWidth = 4; ctx.stroke();
    }
  } else if (zone.mechanic === 'mirror') {
    // the mirror line down the middle of the abyss: everything is reflected across it
    ctx.save();
    ctx.strokeStyle = `rgba(191,232,255,${(0.25 + 0.12 * Math.sin(time * 2)).toFixed(3)})`; ctx.lineWidth = 4; ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.moveTo(A.w / 2, 70); ctx.lineTo(A.w / 2, A.h - 40); ctx.stroke();
    ctx.setLineDash([]); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const y = 120 + i * (A.h - 200) / 7, k = 0.5 + 0.5 * Math.sin(time * 3 + i); ctx.fillStyle = `rgba(232,246,255,${(0.15 + 0.25 * k).toFixed(3)})`; ctx.beginPath(); ctx.arc(A.w / 2, y, 4 + 3 * k, 0, TAU); ctx.fill(); }
    ctx.restore();
  } else if (zone.mechanic === 'eclipse') {
    // the half-eaten sun on the throne floor
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cx = A.w / 2, cy = A.h / 2 + 20, r = 220 * SY;
    const g = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.25);
    g.addColorStop(0, 'rgba(255,182,72,0)'); g.addColorStop(0.5, `rgba(255,182,72,${(0.16 + 0.06 * Math.sin(time * 1.5)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,182,72,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.25, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,210,122,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + time * 0.04; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05); ctx.lineTo(cx + Math.cos(a) * r * 1.22, cy + Math.sin(a) * r * 1.22); ctx.stroke(); }
  } else if (zone.mechanic === 'starfall') {
    ctx.strokeStyle = 'rgba(160,230,255,0.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(A.w / 2, A.h / 2 + 20, 300 * SY, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(A.w / 2, A.h / 2 + 20, 180 * SY, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + time * 0.05; ctx.fillStyle = `rgba(200,240,255,${0.3 + 0.25 * Math.sin(time * 3 + i)})`; ctx.beginPath(); ctx.arc(A.w / 2 + Math.cos(a) * 300 * SY, A.h / 2 + 20 + Math.sin(a) * 300 * SY, 3, 0, TAU); ctx.fill(); }
  } else if (zone.mechanic === 'void' || zone.mechanic === 'verdict') {
    ctx.strokeStyle = zone.mechanic === 'verdict' ? 'rgba(255,236,160,0.2)' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    for (let c = 0; c <= TILE.cols; c++) { ctx.beginPath(); ctx.moveTo(TILE.x0 + c * TILE.w, TILE.y0); ctx.lineTo(TILE.x0 + c * TILE.w, TILE.y0 + TILE.rows * TILE.h); ctx.stroke(); }
    for (let r = 0; r <= TILE.rows; r++) { ctx.beginPath(); ctx.moveTo(TILE.x0, TILE.y0 + r * TILE.h); ctx.lineTo(TILE.x0 + TILE.cols * TILE.w, TILE.y0 + r * TILE.h); ctx.stroke(); }
  }
}
