// Ultimate signatures: the big apparitions of the ultimates (dragons, a phoenix, a falling heavenly blade, moons,
// suns, a world tree…). Each is an effect type drawn by battle/skillVfx.js; the ultimate runner (battle/ultimate.js)
// places them and deals the damage. Every drawer reads { t, dur, x, y, tx, ty, el, s (scale), … }.
import { registerFx, elOf, hexA } from './skillVfx.js';

const TAU = Math.PI * 2;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ease = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t) => clamp01(t) * clamp01(t);
const fadeOf = (e, a = 0.15, b = 0.3) => Math.min(1, e.t / a) * Math.min(1, (e.dur - e.t) / b);
function glow(ctx, x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// ------------------------------------------------------------------ dragon: a long serpent of light flying a path
registerFx('dragon', 'air', (ctx, e, time) => {
  const C = elOf(e.el), s = e.s || 1, k = clamp01(e.t / e.dur);
  const fade = fadeOf(e, 0.1, 0.25);
  // path: from start, through the target, beyond — with a sine wave
  const ax = e.x, ay = e.y - 60, bx = e.tx, by = e.ty - 50;
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const total = L * 2.2, head = -0.3 * total + k * total * 1.5;
  const at = (d) => { const w = Math.sin(d / 70 + (e.seed || 0)) * 46 * s; return [ax + ux * d + nx * w, ay + uy * d + ny * w]; };
  const segs = 30, gap = 26 * s;
  ctx.save(); ctx.globalAlpha = fade;
  // glow trail
  ctx.globalCompositeOperation = 'lighter';
  for (let i = segs; i >= 0; i--) { const d = head - i * gap; if (d < -60) continue; const [x, y] = at(d); glow(ctx, x, y, 34 * s * (1 - i / segs * 0.6), C.glow, 0.35); }
  ctx.globalCompositeOperation = 'source-over';
  // body (back to front)
  for (let i = segs; i >= 1; i--) {
    const d = head - i * gap; if (d < -60) continue;
    const [x, y] = at(d), [x2, y2] = at(d + gap);
    const ang = Math.atan2(y2 - y, x2 - x), r = (25 - i * 0.55) * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = i % 2 ? C.deep : hexA(C.glow, 1); ctx.strokeStyle = '#120c18'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, gap * 0.75, r, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hexA(C.core, 0.85); ctx.beginPath(); ctx.ellipse(-2, -r * 0.35, gap * 0.45, r * 0.3, 0, 0, TAU); ctx.fill();      // belly sheen
    if (i % 3 === 0) { ctx.fillStyle = C.core; ctx.beginPath(); ctx.moveTo(-4, -r); ctx.lineTo(4, -r - 12 * s); ctx.lineTo(8, -r); ctx.fill(); }  // dorsal fin
    if (i === 6 || i === 16) { ctx.strokeStyle = C.deep; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.lineTo(10 * s, r + 16 * s); ctx.moveTo(-6, r * 0.8); ctx.lineTo(0, r + 16 * s); ctx.stroke(); }  // claws
    ctx.restore();
  }
  // head
  const [hx, hy] = at(head), [px, py] = at(head - gap);
  const ha = Math.atan2(hy - py, hx - px);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha); ctx.scale(s * 1.45, s * 1.45);
  ctx.fillStyle = C.deep; ctx.strokeStyle = '#120c18'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-20, -16); ctx.quadraticCurveTo(10, -22, 38, -6); ctx.lineTo(44, 0); ctx.lineTo(30, 6); ctx.quadraticCurveTo(10, 20, -20, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hexA(C.glow, 1); ctx.beginPath(); ctx.moveTo(24, 6); ctx.lineTo(44, 12 + Math.sin(time * 18) * 4); ctx.lineTo(18, 14); ctx.closePath(); ctx.fill(); ctx.stroke();   // jaw
  ctx.strokeStyle = C.core; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(-26, -40, -44, -34); ctx.moveTo(4, -16); ctx.quadraticCurveTo(-8, -46, -30, -50); ctx.stroke();  // horns
  ctx.strokeStyle = hexA(C.glow, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, 4); ctx.quadraticCurveTo(10, 30, -30, 34 + Math.sin(time * 6) * 6); ctx.stroke();   // whisker
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 14, -6, 12, C.core, 1); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(14, -6, 5, 2.4, 0, 0, TAU); ctx.fill();
  if (e.breath) { const g = ctx.createLinearGradient(40, 0, 180, 0); g.addColorStop(0, hexA(C.core, 0.9)); g.addColorStop(1, hexA(C.glow, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(40, 4); ctx.lineTo(180, -36); ctx.lineTo(180, 44); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.restore();
});

// ------------------------------------------------------------------ phoenix: a burning bird diving from the sky
registerFx('phoenix', 'air', (ctx, e, time) => {
  const C = elOf(e.el), s = e.s || 1, k = clamp01(e.t / e.dur), fade = fadeOf(e, 0.1, 0.25);
  const dive = easeIn(Math.min(1, k * 1.4));
  const x = e.tx - 260 * s * (1 - dive), y = e.ty - 70 - 420 * (1 - dive);
  const flap = Math.sin(time * 14) * 0.35;
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, 0, 150, C.glow, 0.5);
  // tail streamers
  for (let i = 0; i < 5; i++) { ctx.strokeStyle = hexA(i % 2 ? C.core : C.glow, 0.7); ctx.lineWidth = 6 - i; ctx.beginPath(); ctx.moveTo(-10, 10); ctx.bezierCurveTo(-80, 40 + i * 10, -140, -20 + i * 18, -220 - i * 20, 30 + Math.sin(time * 6 + i) * 20 + i * 12); ctx.stroke(); }
  // wings (feathered fans)
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(1, side); ctx.rotate(-0.5 + flap);
    for (let f = 0; f < 9; f++) {
      const a = -0.2 - f * 0.17, len = 120 - Math.abs(f - 3) * 9;
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      g.addColorStop(0, hexA(C.core, 0.95)); g.addColorStop(0.6, hexA(C.glow, 0.85)); g.addColorStop(1, hexA(C.deep, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a - 0.12) * len * 0.6, Math.sin(a - 0.12) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len);
      ctx.quadraticCurveTo(Math.cos(a + 0.12) * len * 0.6, Math.sin(a + 0.12) * len * 0.6, 0, 0); ctx.fill();
    }
    ctx.restore();
  }
  // body and head
  ctx.fillStyle = hexA(C.core, 1); ctx.beginPath(); ctx.ellipse(10, 0, 34, 14, 0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(46, 10, 11, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = C.deep; ctx.beginPath(); ctx.moveTo(56, 8); ctx.lineTo(72, 16); ctx.lineTo(55, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(49, 7, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.core; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(42, 0); ctx.quadraticCurveTo(36, -24, 22, -30); ctx.moveTo(46, 0); ctx.quadraticCurveTo(46, -26, 36, -36); ctx.stroke();   // crest
  ctx.restore();
});

// ------------------------------------------------------------------ giant blade: a heavenly sword falling onto the target
registerFx('bigblade', 'air', (ctx, e) => {
  const C = elOf(e.el), s = e.s || 1, k = clamp01(e.t / (e.fall || e.dur * 0.45)), fade = Math.min(1, (e.dur - e.t) / 0.35);
  const y = e.ty - 30 - 560 * (1 - easeIn(k));
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.tx, y); ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -120, 160, C.glow, 0.45); ctx.globalCompositeOperation = 'source-over';
  // blade (point down)
  const g = ctx.createLinearGradient(-26, 0, 26, 0);
  g.addColorStop(0, '#9aa6c0'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#7a86a0');
  ctx.fillStyle = g; ctx.strokeStyle = '#140f22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(-26, -20); ctx.lineTo(-24, -250); ctx.lineTo(24, -250); ctx.lineTo(26, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = hexA(C.glow, 0.9); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, -240); ctx.stroke();
  // runes along the fuller
  ctx.fillStyle = C.core; for (let i = 0; i < 6; i++) ctx.fillRect(-3, -60 - i * 30, 6, 12);
  // guard and grip
  ctx.fillStyle = C.deep; ctx.beginPath(); ctx.moveTo(-70, -250); ctx.quadraticCurveTo(0, -230, 70, -250); ctx.lineTo(60, -268); ctx.quadraticCurveTo(0, -252, -60, -268); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a40'; ctx.fillRect(-10, -330, 20, 64); ctx.strokeRect(-10, -330, 20, 64);
  ctx.fillStyle = C.glow; ctx.beginPath(); ctx.arc(0, -340, 16, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (k >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, e.tx, e.ty - 20, 220 * s * (1 - (e.t - (e.fall || e.dur * 0.45)) / (e.dur * 0.55)), C.core, 0.8); ctx.restore(); }
});

// ------------------------------------------------------------------ moon: a huge crescent that rises and slices
registerFx('moon', 'air', (ctx, e, time) => {
  const C = elOf(e.el), s = e.s || 1, k = clamp01(e.t / e.dur), fade = fadeOf(e, 0.2, 0.3);
  const R = 170 * s, rise = ease(Math.min(1, k * 2.2)), spin = k > 0.45 ? easeIn((k - 0.45) / 0.55) * 2.6 : 0;
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.tx, e.ty - 60 - (1 - rise) * 200); ctx.rotate(-0.6 + spin + (e.dir || 0));
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, R * 1.5, C.glow, 0.35);
  ctx.fillStyle = hexA(C.core, 0.95);
  ctx.beginPath(); ctx.arc(0, 0, R, -1.4, 1.4); ctx.arc(R * 0.45, 0, R * 0.82, 1.25, -1.25, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hexA(C.glow, 0.8); ctx.lineWidth = 3; ctx.stroke();
  // craters of light
  ctx.fillStyle = hexA(C.glow, 0.5); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-R * 0.75 + i * 6, -R * 0.4 + i * R * 0.27, 6 + i * 2, 0, TAU); ctx.fill(); }
  ctx.restore();
  void time;
});

// ------------------------------------------------------------------ sun: a blazing (or black) sun descending
registerFx('sun', 'air', (ctx, e, time) => {
  const C = elOf(e.el), s = e.s || 1, k = clamp01(e.t / e.dur), fade = fadeOf(e, 0.2, 0.25);
  const R = 90 * s * (0.6 + 0.4 * ease(k * 2)), y = e.ty - 60 - 300 * (1 - ease(k * 1.6));
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.tx, y);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + time * 0.8; ctx.strokeStyle = hexA(C.glow, 0.6); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1); ctx.lineTo(Math.cos(a) * R * (1.6 + 0.3 * Math.sin(time * 9 + i)), Math.sin(a) * R * (1.6 + 0.3 * Math.sin(time * 9 + i))); ctx.stroke(); }
  glow(ctx, 0, 0, R * 2.4, C.glow, 0.45);
  ctx.globalCompositeOperation = 'source-over';
  if (e.black) { ctx.fillStyle = '#05030c'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.strokeStyle = C.core; ctx.lineWidth = 4; ctx.stroke(); }
  else { const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, C.core); g.addColorStop(1, C.glow); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); }
  ctx.restore();
});

// ------------------------------------------------------------------ lotus: petals of light open under the target (ground)
registerFx('lotus', 'ground', (ctx, e, time) => {
  const C = elOf(e.el), s = e.s || 1, k = ease(e.t / (e.dur * 0.5)), fade = fadeOf(e, 0.1, 0.35);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.tx, e.ty); ctx.scale(1, 0.55);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 180 * s, C.glow, 0.4); ctx.globalCompositeOperation = 'source-over';
  for (const [n, len, rot, col] of [[12, 150, 0.13, C.deep], [10, 115, 0, C.glow], [8, 75, 0.2, C.core]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rot + time * 0.1, L = len * s * k;
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = col; ctx.strokeStyle = '#140f22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -L * 0.28, L, 0); ctx.quadraticCurveTo(L * 0.5, L * 0.28, 0, 0); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
});

// ------------------------------------------------------------------ wolves: a pack of spirit wolves charging through
registerFx('wolves', 'air', (ctx, e, time) => {
  const C = elOf(e.el), k = clamp01(e.t / e.dur), fade = fadeOf(e, 0.1, 0.2);
  const ang = Math.atan2(e.ty - e.y, e.tx - e.x), L = Math.hypot(e.tx - e.x, e.ty - e.y) + 300;
  ctx.save(); ctx.globalAlpha = fade;
  for (let i = 0; i < (e.n || 5); i++) {
    const off = (i - 2) * 46, lag = i * 0.06, d = Math.max(0, (k - lag) / (1 - lag)) * L;
    const x = e.x + Math.cos(ang) * d - Math.sin(ang) * off, y = e.y - 30 + Math.sin(ang) * d + Math.cos(ang) * off;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.5, 1.5);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-80, 0, 20, 0); g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(1, hexA(C.glow, 0.6));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-26, 0, 50, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hexA(C.core, 0.9); const bob = Math.sin(time * 26 + i) * 2;
    ctx.beginPath(); ctx.ellipse(-4, bob, 22, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, bob - 7); ctx.lineTo(28, bob - 1); ctx.lineTo(12, bob + 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, bob - 7); ctx.lineTo(11, bob - 17); ctx.lineTo(15, bob - 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
});

// ------------------------------------------------------------------ hammer: a titan's hammer swinging down
registerFx('hammer', 'air', (ctx, e) => {
  const C = elOf(e.el), s = e.s || 1, k = clamp01(e.t / (e.dur * 0.55)), fade = Math.min(1, (e.dur - e.t) / 0.3);
  const ang = -2.4 + easeIn(k) * 2.4;
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.tx - 40 * s, e.ty - 10); ctx.scale(s, s); ctx.rotate(ang);
  ctx.fillStyle = '#4a3428'; ctx.strokeStyle = '#140f22'; ctx.lineWidth = 3;
  ctx.fillRect(-8, -260, 16, 260); ctx.strokeRect(-8, -260, 16, 260);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -280, 120, C.glow, 0.5); ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(-70, -320, 70, -240); g.addColorStop(0, '#b8c0d0'); g.addColorStop(1, '#5a6278');
  ctx.fillStyle = g; ctx.beginPath(); ctx.rect(-80, -320, 160, 80); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.glow; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-60, -280); ctx.lineTo(60, -280); ctx.stroke();
  ctx.fillStyle = C.core; ctx.beginPath(); ctx.arc(0, -280, 14, 0, TAU); ctx.fill();
  ctx.restore();
});

// ------------------------------------------------------------------ chains: chains of light bursting from the ground
registerFx('chains', 'air', (ctx, e, time) => {
  const C = elOf(e.el), k = ease(e.t / 0.35), fade = fadeOf(e, 0.05, 0.3);
  ctx.save(); ctx.globalAlpha = fade;
  for (let i = 0; i < (e.n || 6); i++) {
    const a = (i / (e.n || 6)) * TAU + 0.3, R = 200 * (e.s || 1);
    const sx = e.tx + Math.cos(a) * R, sy = e.ty + Math.sin(a) * R * 0.55;
    const ex = sx + (e.tx - sx) * k, ey = sy + (e.ty - 40 - sy) * k;
    const n = 12, dx = (ex - sx) / n, dy = (ey - sy) / n;
    for (let j = 0; j < n; j++) {
      ctx.save(); ctx.translate(sx + dx * j, sy + dy * j - Math.sin((j / n) * Math.PI) * 40); ctx.rotate(Math.atan2(dy, dx) + (j % 2) * Math.PI / 2);
      ctx.strokeStyle = j % 2 ? C.core : C.glow; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, e.tx, e.ty - 40, 90, C.glow, 0.5 + 0.2 * Math.sin(time * 10));
  ctx.restore();
});

// ------------------------------------------------------------------ galaxy: a spiral of stars turning under the target
registerFx('galaxy', 'ground', (ctx, e, time) => {
  const C = elOf(e.el), s = e.s || 1, fade = fadeOf(e, 0.2, 0.4), R = 240 * s;
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.tx, e.ty); ctx.scale(1, 0.6);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, 0, R, C.deep, 0.6); glow(ctx, 0, 0, R * 0.35, C.core, 0.9);
  for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 60; i++) {
    const f = i / 60, a = time * 1.8 + arm * (TAU / 3) + f * 5.5, r = R * f;
    ctx.fillStyle = hexA(i % 4 ? C.glow : C.core, 1 - f * 0.6);
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5 + (1 - f) * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
});

// ------------------------------------------------------------------ blossom: a storm of petals spiralling up
registerFx('blossom', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.15, 0.4), R = 220 * (e.s || 1);
  ctx.save(); ctx.globalAlpha = fade;
  for (let i = 0; i < 90; i++) {
    const ph = ((i * 0.137 + time * 0.6) % 1), a = i * 2.4 + time * (2 + (i % 3)), r = R * (0.2 + 0.8 * ((i * 37) % 100) / 100);
    const x = e.tx + Math.cos(a) * r, y = e.ty - 20 + Math.sin(a) * r * 0.45 - ph * 200;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a * 2);
    ctx.fillStyle = i % 5 ? (e.pink === false ? C.core : '#ffc8de') : C.glow;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
});

// ------------------------------------------------------------------ claws: three huge claw marks tearing across
registerFx('claws', 'air', (ctx, e) => {
  const C = elOf(e.el), s = e.s || 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let set = 0; set < (e.sets || 2); set++) {
    const tt = e.t - set * 0.22; if (tt < 0) continue;
    const k = clamp01(tt / 0.2), fade = Math.max(0, 1 - tt / 0.7), dir = set % 2 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 36 * s;
      const x0 = e.tx - 140 * s * dir + off, y0 = e.ty - 190 * s, x1 = e.tx + 140 * s * dir + off, y1 = e.ty + 40 * s;
      const xm = x0 + (x1 - x0) * ease(k), ym = y0 + (y1 - y0) * ease(k);
      ctx.strokeStyle = hexA(C.glow, 0.55 * fade); ctx.lineWidth = 22 * s; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.stroke();
      ctx.strokeStyle = hexA(C.core, fade); ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.stroke();
    }
  }
  ctx.restore();
});

// ------------------------------------------------------------------ clock: a giant clock face; time stops while its hands spin
registerFx('clock', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.2, 0.3), R = 150 * (e.s || 1);
  ctx.save(); ctx.globalAlpha = fade * 0.9; ctx.translate(e.x, e.y - 160);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, R * 1.4, C.glow, 0.3);
  ctx.strokeStyle = hexA(C.core, 0.9); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R * 0.86, 0, TAU); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.lineWidth = i % 3 ? 2 : 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74); ctx.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); ctx.stroke(); }
  const spin = e.t * 9;
  ctx.lineCap = 'round'; ctx.strokeStyle = C.core;
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(spin * 0.25 - 1.5) * R * 0.5, Math.sin(spin * 0.25 - 1.5) * R * 0.5); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(spin - 1.5) * R * 0.75, Math.sin(spin - 1.5) * R * 0.75); ctx.stroke();
  // gears turning behind
  for (const [gx, gy, gr, sp] of [[-R * 0.9, R * 0.4, 40, 1], [R * 0.95, -R * 0.3, 32, -1.3]]) {
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(time * sp); ctx.lineWidth = 3; ctx.strokeStyle = hexA(C.glow, 0.7);
    ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r = i % 2 ? gr : gr * 0.82; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
});

// ------------------------------------------------------------------ eye: a giant eye opening in the sky
registerFx('eye', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.2, 0.3), open = ease(e.t / 0.5), R = 130 * (e.s || 1);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.x, e.y - 300);
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, R * 1.8, C.glow, 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f8f4ff'; ctx.strokeStyle = C.deep; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-R * 1.4, 0); ctx.quadraticCurveTo(0, -R * open, R * 1.4, 0); ctx.quadraticCurveTo(0, R * open, -R * 1.4, 0); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();
  const look = Math.atan2(e.ty - (e.y - 300), e.tx - e.x);
  const ix = Math.cos(look) * R * 0.25, iy = Math.sin(look) * R * 0.15;
  const g = ctx.createRadialGradient(ix, iy, 4, ix, iy, R * 0.5); g.addColorStop(0, '#fff'); g.addColorStop(0.3, C.glow); g.addColorStop(1, C.deep);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, R * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#05030c'; ctx.beginPath(); ctx.ellipse(ix, iy, R * 0.09, R * 0.36, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hexA(C.core, 0.8); ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5); ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.1, Math.sin(a) * R * 0.75 * open); ctx.lineTo(Math.cos(a) * R * 1.35, Math.sin(a) * R * 1.05 * open); ctx.stroke(); }
  ctx.restore();
  void time;
});

// ------------------------------------------------------------------ gate: portals behind the hero that loose blades
registerFx('gate', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.2, 0.3), n = e.n || 7;
  ctx.save(); ctx.globalAlpha = fade;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i - (n - 1) / 2) * 0.32, R = 170;
    const x = e.x + Math.cos(a + Math.PI / 2 * 0) * 0 + (i - (n - 1) / 2) * 62, y = e.y - 170 - Math.abs(i - (n - 1) / 2) * -14 - Math.cos((i / (n - 1)) * Math.PI) * 0;
    const open = ease((e.t - i * 0.05) / 0.3);
    if (open <= 0) continue;
    ctx.save(); ctx.translate(x, y); ctx.scale(open, open);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, 46, C.glow, 0.6);
    ctx.strokeStyle = C.core; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 28, 34, 0, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#06040e'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 28, 0, 0, TAU); ctx.fill();
    ctx.rotate(time * 3 + i); ctx.strokeStyle = hexA(C.glow, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 4); ctx.stroke();
    ctx.restore();
    void R;
  }
  ctx.restore();
});

// ------------------------------------------------------------------ roots: giant thorned roots erupting around the target
registerFx('roots', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.05, 0.35), grow = ease(e.t / 0.45), n = e.n || 7, s = e.s || 1;
  ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.4, R = 120 * s;
    const bx = e.tx + Math.cos(a) * R, by = e.ty + Math.sin(a) * R * 0.5;
    const H = (150 + (i % 3) * 40) * s * grow, lean = Math.cos(a) * -40 * s;
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 22 * s;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + lean * 0.3, by - H * 0.6, bx + lean, by - H); ctx.stroke();
    ctx.strokeStyle = C.deep; ctx.lineWidth = 14 * s; ctx.stroke();
    ctx.strokeStyle = hexA(C.glow, 0.85); ctx.lineWidth = 3 * s; ctx.stroke();
    for (let t = 0; t < 4; t++) { const f = 0.25 + t * 0.18, x = bx + lean * f * f, y = by - H * f; ctx.fillStyle = C.glow; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (t % 2 ? 18 : -18) * s, y - 8 * s); ctx.lineTo(x, y - 10 * s); ctx.fill(); }
  }
  ctx.globalCompositeOperation = 'lighter'; glow(ctx, e.tx, e.ty - 40, 120 * s, C.glow, 0.35 + 0.15 * Math.sin(time * 8));
  ctx.restore();
});

// ------------------------------------------------------------------ serpent: a sea serpent coiling up around the target
registerFx('serpent', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.1, 0.3), k = clamp01(e.t / e.dur), s = e.s || 1;
  ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round';
  const n = 40;
  const pts = [];
  for (let i = 0; i < n; i++) { const f = i / n, a = f * 9 + time * 3, r = (160 - f * 110) * s, h = f * 260 * s * ease(k * 1.5); pts.push([e.tx + Math.cos(a) * r, e.ty - 20 + Math.sin(a) * r * 0.4 - h]); }
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? hexA(C.glow, 0.95) : '#0a1426'; ctx.lineWidth = (pass ? 18 : 26) * s;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  ctx.strokeStyle = hexA(C.core, 0.9); ctx.lineWidth = 4 * s; ctx.setLineDash([8, 10]); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
  const [hx, hy] = pts[n - 1];
  ctx.fillStyle = C.glow; ctx.strokeStyle = '#0a1426'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(hx, hy, 30 * s, 18 * s, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 10 * s, hy - 6 * s, 4 * s, 0, TAU); ctx.fill();
  ctx.restore();
});

// ------------------------------------------------------------------ thunder god: a crown of lightning above the hero
registerFx('thundergod', 'air', (ctx, e, time) => {
  const C = elOf(e.el), fade = fadeOf(e, 0.15, 0.3);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(e.x, e.y - 220);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, 0, 0, 180, C.glow, 0.4);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32, L = 110 + (i % 2) * 40;
    ctx.strokeStyle = hexA(C.core, 0.9); ctx.lineWidth = 4;
    ctx.beginPath(); let x = 0, y = 0; ctx.moveTo(0, 0);
    for (let s = 1; s <= 6; s++) { x = Math.cos(a) * L * s / 6 + Math.sin(time * 40 + s * i) * 8; y = Math.sin(a) * L * s / 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = C.core; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
  ctx.restore();
});

// ------------------------------------------------------------------ small falling things for the rains
registerFx('fall', 'air', (ctx, e) => {
  const C = elOf(e.el), k = easeIn(clamp01(e.t / e.dur)), H = e.h || 420;
  const x = e.tx + (e.dx ?? 60) * (1 - k), y = e.ty - 10 - H * (1 - k);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(H, -(e.dx ?? 60)));
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(-90, 0, 0, 0); g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(1, hexA(C.glow, 0.7));
  ctx.fillStyle = g; ctx.fillRect(-90, -5, 90, 10);
  ctx.globalCompositeOperation = 'source-over';
  if (e.kind === 'sword') {
    ctx.fillStyle = '#e8eef8'; ctx.strokeStyle = '#140f22'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-8, -6); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.deep; ctx.fillRect(-12, -11, 5, 22); ctx.fillStyle = '#3a2a40'; ctx.fillRect(-24, -3, 12, 6);
  } else if (e.kind === 'arrow') {
    ctx.strokeStyle = '#6e4a30'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.fillStyle = C.core; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(6, -5); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
  } else if (e.kind === 'feather') {
    ctx.fillStyle = C.glow; ctx.beginPath(); ctx.ellipse(0, 0, 18, 6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = C.core; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
  } else {
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 16, C.core, 1);
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = hexA(C.glow, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.ellipse(e.tx, e.ty, (e.mark || 40) * (0.4 + k * 0.6), (e.mark || 40) * 0.5 * (0.4 + k * 0.6), 0, 0, TAU); ctx.stroke(); ctx.restore();
});

// ------------------------------------------------------------------ a giant X cut on the target
registerFx('xcut', 'air', (ctx, e) => {
  const C = elOf(e.el), R = (e.r || 160);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const tt = e.t - i * 0.12; if (tt < 0) continue;
    const k = ease(tt / 0.16), fade = Math.max(0, 1 - tt / (e.dur - i * 0.12));
    const a = i ? 2.35 : 0.8, dx = Math.cos(a) * R, dy = Math.sin(a) * R;
    const x0 = e.tx - dx, y0 = e.ty - 30 - dy, x1 = e.tx - dx + dx * 2 * k, y1 = e.ty - 30 - dy + dy * 2 * k;
    ctx.strokeStyle = hexA(C.glow, 0.5 * fade); ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = hexA(C.core, fade); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
});

// ------------------------------------------------------------------ energy gathering into the hero
registerFx('gather', 'air', (ctx, e, time) => {
  const C = elOf(e.el), k = clamp01(e.t / e.dur), x = e.follow ? e.follow.x : e.x, y = (e.follow ? e.follow.y : e.y) - 40;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, 60 + 60 * k, C.glow, 0.25 + 0.4 * k);
  for (let i = 0; i < 24; i++) {
    const ph = (i / 24 + time * 1.5) % 1, a = i * 2.4, r = 220 * (1 - ph);
    ctx.fillStyle = hexA(C.spark[i % C.spark.length], ph);
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2 + ph * 3, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = hexA(C.core, 0.6 * k); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 30 + Math.sin(time * 20) * 4, 0, TAU); ctx.stroke();
  ctx.restore();
});
