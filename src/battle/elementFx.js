// The weather of a boss: sparks, snow, lightning, shadow smoke, holy rays … drawn around it in battle and behind
// it on its card in the boss book. Stateless: every mote's place comes from its index and the time, so the same
// function serves a 60 fps fight and a still picture.
import { hexA } from './rigDraw.js';

const TAU = Math.PI * 2;
const fr = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };   // fixed noise 0..1

// box: { x, y, w, h } (the area), el: ELEMENTS entry, t: seconds, k: strength 0..1
export function drawElementFx(ctx, el, box, t, k = 1) {
  if (!el || k <= 0) return;
  const { x, y, w, h } = box;
  const n = Math.round((el.fx === 'rays' ? 5 : 26) * Math.min(1.4, (w * h) / 90000 + 0.5));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  switch (el.fx) {
    case 'embers': case 'leaves': case 'spores': case 'bubbles': {
      const rise = el.fx !== 'leaves';
      for (let i = 0; i < n; i++) {
        const sp = 0.08 + fr(i, 1) * 0.12, life = ((t * sp + fr(i, 2)) % 1);
        const px = x + fr(i, 3) * w + Math.sin(t * (0.8 + fr(i, 4)) + i) * w * 0.04;
        const py = rise ? y + h - life * h : y + life * h;
        const a = Math.sin(life * Math.PI) * k;
        const r = el.fx === 'bubbles' ? 2 + fr(i, 5) * 5 : el.fx === 'spores' ? 1.5 + fr(i, 5) * 3 : 1 + fr(i, 5) * 2.4;
        if (el.fx === 'bubbles') { ctx.strokeStyle = hexA(el.glow, 0.55 * a); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke(); continue; }
        if (el.fx === 'leaves') { ctx.save(); ctx.translate(px, py); ctx.rotate(t * 2 + i); ctx.fillStyle = hexA(i % 2 ? el.c1 : el.glow, 0.5 * a); ctx.beginPath(); ctx.ellipse(0, 0, 4, 1.8, 0, 0, TAU); ctx.fill(); ctx.restore(); continue; }
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3); g.addColorStop(0, hexA('#ffffff', 0.9 * a)); g.addColorStop(0.35, hexA(el.glow, 0.7 * a)); g.addColorStop(1, hexA(el.c1, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 3, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'snow': case 'sand': case 'drops': {
      for (let i = 0; i < n * 1.4; i++) {
        const sp = 0.15 + fr(i, 1) * 0.25, life = (t * sp + fr(i, 2)) % 1;
        const sand = el.fx === 'sand';
        const px = sand ? x + life * w : x + fr(i, 3) * w + Math.sin(t + i) * 8, py = sand ? y + fr(i, 3) * h : y + life * h;
        const a = Math.sin(life * Math.PI) * k;
        ctx.strokeStyle = hexA(el.glow, (sand ? 0.35 : 0.6) * a); ctx.lineWidth = el.fx === 'drops' ? 1.6 : sand ? 1.2 : 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px, py);
        if (sand) ctx.lineTo(px - 14, py); else if (el.fx === 'drops') ctx.lineTo(px, py - 8); else ctx.lineTo(px + 0.5, py + 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'lightning': {
      // a bolt every so often, flickering, plus a static crackle along the ground
      for (let b = 0; b < 2; b++) {
        const slot = Math.floor(t * 2.2 + b * 0.5), on = fr(slot, b + 7) < 0.55 && ((t * 2.2 + b * 0.5) % 1) < 0.22;
        if (!on) continue;
        let px = x + fr(slot, b + 3) * w, py = y;
        ctx.strokeStyle = hexA(el.glow, 0.9 * k); ctx.lineWidth = 2.4; ctx.shadowColor = el.c1; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(px, py);
        for (let s = 1; s <= 7; s++) { px += (fr(slot * 13 + s, b) - 0.5) * w * 0.18; py = y + (s / 7) * h * 0.9; ctx.lineTo(px, py); }
        ctx.stroke(); ctx.shadowBlur = 0;
      }
      for (let i = 0; i < n * 0.6; i++) { const px = x + fr(i, 3) * w, py = y + h * (0.55 + fr(i, 4) * 0.45); const a = (Math.sin(t * 9 + i * 3) > 0.7 ? 0.8 : 0.2) * k; ctx.fillStyle = hexA(el.glow, a); ctx.fillRect(px, py, 2, 2); }
      break;
    }
    case 'shadow': {
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < n * 0.7; i++) {
        const life = (t * (0.06 + fr(i, 1) * 0.08) + fr(i, 2)) % 1;
        const px = x + fr(i, 3) * w + Math.sin(t * 0.7 + i) * 14, py = y + h - life * h * 0.9, r = 10 + fr(i, 5) * 22 * (1 + life);
        const a = Math.sin(life * Math.PI) * 0.35 * k;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, hexA(el.c1, a)); g.addColorStop(1, hexA(el.c2, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n * 0.5; i++) { const life = (t * 0.2 + fr(i, 6)) % 1; ctx.fillStyle = hexA(el.glow, Math.sin(life * Math.PI) * 0.6 * k); ctx.fillRect(x + fr(i, 7) * w, y + h - life * h, 2, 2); }
      break;
    }
    case 'rays': {
      for (let i = 0; i < n; i++) {
        const cx = x + w * (0.15 + fr(i, 1) * 0.7), a = 0.08 + 0.07 * Math.sin(t * 1.3 + i * 1.7);
        const g = ctx.createLinearGradient(cx, y, cx, y + h); g.addColorStop(0, hexA(el.glow, a * 2 * k)); g.addColorStop(1, hexA(el.glow, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 6, y); ctx.lineTo(cx + 6, y); ctx.lineTo(cx + 26 + i * 3, y + h); ctx.lineTo(cx - 26 - i * 3, y + h); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 14; i++) { const life = (t * 0.15 + fr(i, 4)) % 1; ctx.fillStyle = hexA('#ffffff', Math.sin(life * Math.PI) * 0.7 * k); ctx.fillRect(x + fr(i, 5) * w, y + h - life * h, 2, 2); }
      break;
    }
    case 'stars': {
      for (let i = 0; i < n * 1.2; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + fr(i, 1) * 3) + i * 2), px = x + fr(i, 2) * w, py = y + fr(i, 3) * h, r = 0.8 + fr(i, 4) * 1.8;
        ctx.fillStyle = hexA(el.glow, tw * 0.8 * k); ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
        if (tw > 0.92) { ctx.strokeStyle = hexA('#ffffff', 0.6 * k); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.moveTo(px, py - 6); ctx.lineTo(px, py + 6); ctx.stroke(); }
      }
      break;
    }
    default: break;
  }
  ctx.restore();
}

// the backdrop of a boss card: its element's colours, a glow behind it, a floor, fog and the weather
export function drawBossBackdrop(ctx, el, W, H, t, opts = {}) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, el.c2); bg.addColorStop(0.7, mixDark(el.c2)); bg.addColorStop(1, '#05060c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // distant streaks of the element's colour (brush texture)
  ctx.save(); ctx.globalAlpha = 0.18;
  for (let i = 0; i < 9; i++) { ctx.strokeStyle = i % 2 ? el.c1 : el.glow; ctx.lineWidth = 2 + fr(i, 9) * 8; ctx.beginPath(); const yy = H * (0.1 + fr(i, 2) * 0.6); ctx.moveTo(-10, yy); ctx.bezierCurveTo(W * 0.3, yy - 30 * fr(i, 3), W * 0.7, yy + 30 * fr(i, 4), W + 10, yy - 10); ctx.stroke(); }
  ctx.restore();
  const cy = H * (opts.glowY ?? 0.48);
  const g = ctx.createRadialGradient(W / 2, cy, 4, W / 2, cy, Math.max(W, H) * 0.55);
  g.addColorStop(0, hexA(el.c1, 0.55)); g.addColorStop(0.45, hexA(el.c1, 0.18)); g.addColorStop(1, hexA(el.c1, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawElementFx(ctx, el, { x: 0, y: 0, w: W, h: H }, t, 0.9);
  // ground and fog
  const gy = H * (opts.groundY ?? 0.86);
  const fl = ctx.createLinearGradient(0, gy - 20, 0, H); fl.addColorStop(0, hexA(el.c1, 0)); fl.addColorStop(0.4, hexA(el.c1, 0.16)); fl.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = fl; ctx.fillRect(0, gy - 20, W, H - gy + 20);
}
export function drawVignette(ctx, W, H) {
  const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function mixDark(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * 0.45).toString(16).padStart(2, '0'); return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255); }
