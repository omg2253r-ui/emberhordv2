// Visual feedback that is not a game object: damage numbers, slash arcs, telegraphs, banners.
import { PAL } from '../art/palette.js';

export function createFx() {
  const numbers = [];   // pooled damage numbers
  for (let i = 0; i < 48; i++) numbers.push({ alive: false, x: 0, y: 0, vy: 0, t: 0, max: 0.8, text: '', kind: 'hit' });
  const slashes = [];
  for (let i = 0; i < 16; i++) slashes.push({ alive: false, x: 0, y: 0, angle: 0, arc: 2, range: 90, t: 0, max: 0.18, power: 1, color: PAL.cream, glow: PAL.gold, reverse: false });
  const thrusts = [];
  for (let i = 0; i < 10; i++) thrusts.push({ alive: false, x: 0, y: 0, angle: 0, len: 100, t: 0, max: 0.16, power: 1, color: PAL.cream, glow: PAL.gold });
  const texts = [];  // short callouts ("หลบสมบูรณ์!", "เสียหลัก!")
  for (let i = 0; i < 6; i++) texts.push({ alive: false, x: 0, y: 0, t: 0, max: 0.9, text: '', color: '#fff' });
  const rings = [];
  for (let i = 0; i < 16; i++) rings.push({ alive: false, x: 0, y: 0, r: 0, r2: 0, t: 0, max: 0.4, color: '#fff', width: 4 });

  const take = (arr) => arr.find((o) => !o.alive) || arr.reduce((a, b) => (a.t > b.t ? a : b));

  return {
    number(x, y, text, kind = 'hit') {
      const n = take(numbers);
      Object.assign(n, { alive: true, x: x + (Math.random() - 0.5) * 14, y, vy: kind === 'crit' ? -95 : -70, t: 0, max: kind === 'crit' ? 1 : 0.75, text: String(text), kind });
    },
    slash(x, y, angle, arc, range, power = 1, color = PAL.cream, reverse = false, glow = PAL.gold) {
      const s = take(slashes);
      Object.assign(s, { alive: true, x, y, angle, arc, range, t: 0, max: 0.15 + Math.min(2, power) * 0.04, power: Math.min(2.2, power), color, reverse, glow });
    },
    thrust(x, y, angle, len, color = PAL.cream, glow = PAL.gold, power = 1) {
      const s = take(thrusts);
      Object.assign(s, { alive: true, x, y, angle, len, t: 0, max: 0.14 + Math.min(2, power) * 0.03, power: Math.min(2.2, power), color, glow });
    },
    callout(x, y, text, color = '#fff3c4') {
      const s = take(texts);
      Object.assign(s, { alive: true, x, y, t: 0, max: 0.9, text, color });
    },
    ring(x, y, r, r2, color = '#fff', max = 0.4, width = 4) {
      const g = take(rings);
      Object.assign(g, { alive: true, x, y, r, r2, color, max, t: 0, width });
    },
    update(dt) {
      for (const n of numbers) if (n.alive) { n.t += dt; n.y += n.vy * dt; n.vy += 140 * dt; if (n.t >= n.max) n.alive = false; }
      for (const s of slashes) if (s.alive) { s.t += dt; if (s.t >= s.max) s.alive = false; }
      for (const s of thrusts) if (s.alive) { s.t += dt; if (s.t >= s.max) s.alive = false; }
      for (const s of texts) if (s.alive) { s.t += dt; s.y -= dt * 30; if (s.t >= s.max) s.alive = false; }
      for (const g of rings) if (g.alive) { g.t += dt; if (g.t >= g.max) g.alive = false; }
    },
    drawWorld(ctx) {
      for (const s of slashes) {
        if (!s.alive) continue;
        const p = s.t / s.max;
        const sweep = s.arc * Math.min(1, p * 2.4);
        // crescent: a filled band that is thick in the middle of the sweep and thin at the ends
        const start = s.reverse ? s.angle + s.arc / 2 : s.angle - s.arc / 2;
        const dir = s.reverse ? -1 : 1;
        const tail = Math.max(0, sweep - s.arc * 0.85 * Math.max(0, p - 0.25) / 0.75);
        const a0 = start + dir * tail, a1 = start + dir * sweep;
        const r = s.range * (0.82 + p * 0.12), thick = 16 * s.power * (1 - p * 0.7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p) * 0.55;
        ctx.fillStyle = s.glow;
        crescent(ctx, s.x, s.y, r + 4, thick * 1.7, a0, a1, dir);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - p * p;
        ctx.fillStyle = s.color;
        crescent(ctx, s.x, s.y, r, thick, a0, a1, dir);
        ctx.restore();
      }
      for (const s of thrusts) {
        if (!s.alive) continue;
        const p = s.t / s.max;
        const len = s.len * Math.min(1, 0.4 + p * 2);
        ctx.save();
        ctx.translate(s.x, s.y); ctx.rotate(s.angle);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p) * 0.6; ctx.fillStyle = s.glow;
        ctx.beginPath(); ctx.moveTo(10, -7 * s.power); ctx.lineTo(len + 12, 0); ctx.lineTo(10, 7 * s.power); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - p; ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.moveTo(14, -2.6 * s.power); ctx.lineTo(len, 0); ctx.lineTo(14, 2.6 * s.power); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      for (const g of rings) {
        if (!g.alive) continue;
        const p = g.t / g.max;
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = g.color; ctx.lineWidth = g.width * (1 - p) + 1;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r + (g.r2 - g.r) * p, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    drawNumbers(ctx) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const s of texts) {
        if (!s.alive) continue;
        const p = s.t / s.max;
        const pop = s.t < 0.1 ? 0.7 + s.t * 4 : 1.1 - Math.min(0.1, (s.t - 0.1));
        ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        ctx.font = `800 ${(24 * pop).toFixed(1)}px "Chonburi", "Bai Jamjuree", system-ui, sans-serif`;
        ctx.lineWidth = 5; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = s.color;
        ctx.strokeText(s.text, s.x, s.y); ctx.fillText(s.text, s.x, s.y);
      }
      ctx.globalAlpha = 1;
      for (const n of numbers) {
        if (!n.alive) continue;
        const p = n.t / n.max;
        const pop = n.t < 0.08 ? 0.6 + (n.t / 0.08) * 0.7 : 1.3 - Math.min(0.3, (n.t - 0.08) * 1.5);
        const size = (n.kind === 'crit' ? 26 : n.kind === 'heal' ? 20 : n.kind === 'player' ? 20 : n.kind === 'burn' || n.kind === 'pet' ? 14 : 18) * pop;
        ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
        ctx.font = `800 ${size.toFixed(1)}px "Bai Jamjuree", "Noto Sans Thai", system-ui, sans-serif`;
        ctx.lineWidth = 4; ctx.strokeStyle = '#1a100c';
        ctx.fillStyle = n.kind === 'crit' ? '#ffcf5a' : n.kind === 'player' ? '#ff6b57' : n.kind === 'heal' ? '#8fe27a' : n.kind === 'info' ? '#f3e6c8' : n.kind === 'burn' ? '#ff9a4a' : n.kind === 'pet' ? '#bfe3ff' : '#fff8ea';
        ctx.strokeText(n.text, n.x, n.y); ctx.fillText(n.text, n.x, n.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() { for (const a of [numbers, slashes, rings, thrusts, texts]) for (const o of a) o.alive = false; },
  };
}

// Filled crescent between angles a0→a1 (dir = sweep direction), tapering at both ends.
function crescent(ctx, x, y, r, thick, a0, a1, dir) {
  const n = 14;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t;
    const w = thick * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.35 + 0.65 * t);
    const rr = r + w / 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n, a = a0 + (a1 - a0) * t;
    const w = thick * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.35 + 0.65 * t);
    const rr = r - w / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

// Danger zones: filled as the attack winds up so the player can read the timing.
export function drawTelegraph(ctx, h, time) {
  const p = Math.min(1, h.t / h.dur);
  const pulse = 0.5 + 0.5 * Math.sin(time * 18);
  ctx.save();
  if (h.type === 'circle') {
    ctx.fillStyle = `rgba(224,80,58,${0.12 + 0.08 * pulse})`;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(224,80,58,0.28)';
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * p, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,120,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
  } else if (h.type === 'line') {
    ctx.translate(h.x, h.y); ctx.rotate(h.angle);
    ctx.fillStyle = `rgba(224,80,58,${0.12 + 0.08 * pulse})`;
    ctx.fillRect(0, -h.width / 2, h.len, h.width);
    ctx.fillStyle = 'rgba(224,80,58,0.3)';
    ctx.fillRect(0, -h.width / 2, h.len * p, h.width);
    ctx.strokeStyle = 'rgba(255,170,120,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.strokeRect(0, -h.width / 2, h.len, h.width);
  }
  ctx.restore();
}
