// v8 critter motion: the small monsters of art/critterRig.js come alive part by part.
//   quad    four legs on a trot (diagonal pairs), the head bobs, the jaw drops on the wind-up and snaps on the bite,
//           the tail sways (and burns, for the hounds); toads hop instead
//   biped   little legs step, arms swing against them, the claw goes up on the wind-up and rakes down on the blow
//   golem   slow heavy stomps, both fists rise and slam
//   bug     six (or eight) jointed legs on a tripod gait, mandibles open, scarabs buzz their wings
//   blob    a jelly body on a spring: it squashes before a hop or a blow, stretches through it and wobbles after;
//           eyes follow the hero and blink
//   floater bobs in the air, streamers trail and wave, rings orbit, rotors spin
//   flyer   wings beat (faster when it attacks), the tail whips
//   plant   the stem sways and recoils, the bud opens and glows before it spits
// The timers come from rigDraw.tickAnim: a.wind (telegraph), a.swing (the blow), a.cast (a spell).
import { INK } from '../art/palette.js';
import { mixC } from '../art/critterRig.js';

const PI = Math.PI, TAU = PI * 2;
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const blow = (a) => (a.swing >= 0 && a.swing < 1 ? Math.sin(Math.min(1, a.swing) * PI) : 0);

function stateOf(e) { return (e.crit ||= { sq: 0, sqV: 0, capV: 0, cap: 0, blink: 1.5 + Math.random() * 3, blinkT: 0, last: null, tail: 0 }); }

// a jointed limb drawn as ink + colour + highlight, so it matches the painted parts
function limb(ctx, pts, wd, col, fl) {
  const c = fl > 0 ? mixC(col, '#fff8ea', Math.min(1, fl)) : col;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = INK; ctx.lineWidth = wd + 5; ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.stroke();
  ctx.strokeStyle = mixC(c, '#fff4dc', 0.35); ctx.lineWidth = Math.max(1, wd * 0.28); ctx.globalAlpha *= 0.7;
  ctx.beginPath(); ctx.moveTo(pts[0].x - wd * 0.15, pts[0].y - wd * 0.2); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - wd * 0.15, pts[i].y - wd * 0.2); ctx.stroke();
  ctx.globalAlpha /= 0.7;
}
function curve(ctx, x0, y0, cx, cy, x1, y1, wd, col, fl, taper = true) {
  const c = fl > 0 ? mixC(col, '#fff8ea', Math.min(1, fl)) : col;
  const N = 8, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push({ x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1 }); }
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? INK : c;
    for (let i = 0; i < N; i++) {
      const w = taper ? wd * (1 - (i / N) * 0.7) : wd;
      ctx.lineWidth = pass === 0 ? w + 5 : w;
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke();
    }
  }
}
// two-bone reach: where the knee goes for a hip, a foot and two bone lengths (bend = which way the knee points)
function knee(h, f, l1, l2, bend) {
  const dx = f.x - h.x, dy = f.y - h.y, d = Math.max(0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const base = Math.atan2(dy, dx) + a * bend;
  return { x: h.x + Math.cos(base) * l1, y: h.y + Math.sin(base) * l1 };
}
function blinkLids(ctx, part, at, st, col) {
  if (!part?.eyes?.length || st.blinkT <= 0) return;
  const k = Math.sin((1 - st.blinkT / 0.14) * PI);
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  for (const [ex, ey, r] of part.eyes) {
    const x = at.x + (ex - part.ax), y = at.y + (ey - part.ay);
    ctx.beginPath(); ctx.ellipse(x, y - r * (1 - k), r + 1, r * k + 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
}
function flame(ctx, x, y, s, t, c1, c2) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const f = Math.sin(t * (9 + i * 3) + i * 2) * 0.18, hgt = s * (1.3 - i * 0.28) * (1 + f);
    const g = ctx.createRadialGradient(x, y - hgt * 0.3, 1, x, y - hgt * 0.3, hgt);
    g.addColorStop(0, i === 2 ? '#fff6d0' : c2); g.addColorStop(0.6, c1); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - s * (0.55 - i * 0.12), y);
    ctx.quadraticCurveTo(x - s * 0.6, y - hgt * 0.6, x + Math.sin(t * 7 + i) * s * 0.25, y - hgt);
    ctx.quadraticCurveTo(x + s * 0.6, y - hgt * 0.6, x + s * (0.55 - i * 0.12), y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the entry point
// C: { parts, def } · a: anim timers · o: { x, y, flip, scale, time, moving, walkT, speed, aim, look, alpha, flash, hurt, deathT, air }
export function drawCritter(renderer, C, e, a, o) {
  const ctx = renderer.ctx, st = stateOf(e), t = o.time;
  const dt = Math.max(0, Math.min(0.1, st.last == null ? 0 : t - st.last)); st.last = t;
  // blinking
  st.blink -= dt; if (st.blink <= 0) { st.blinkT = 0.14; st.blink = 2 + Math.random() * 3.5; }
  if (st.blinkT > 0) st.blinkT = Math.max(0, st.blinkT - dt);
  if (o.deathT != null) st.blinkT = 0.07;
  // the jelly spring: crouch before a blow, stretch through it, wobble after
  const w = ease(a.wind), b = blow(a);
  const target = 0.16 * w - 0.22 * b + (o.hurt ? 0.12 : 0);
  st.sqV += ((target - st.sq) * 160 - st.sqV * 10) * dt; st.sq += st.sqV * dt;
  if (o.moving && o.speed > 120 && Math.random() < dt * 2) st.sqV -= 1.6;
  st.capV += ((-st.sqV * 0.02 - st.cap) * 120 - st.capV * 8) * dt; st.cap += st.capV * dt;
  const sc = o.scale;
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.scale(o.flip ? -sc : sc, sc);
  if (o.deathT != null) { const d = Math.min(1, o.deathT / 0.5); ctx.rotate(-d * 0.6); ctx.scale(1 + d * 0.2, 1 - d * 0.45); }
  const ctxO = { ctx, renderer, C, e, a, o, st, t, w, b, dt, fl: o.flash || 0 };
  switch (C.def.kind) {
    case 'quad': drawQuad(ctxO); break;
    case 'biped': drawBiped(ctxO); break;
    case 'golem': drawGolem(ctxO); break;
    case 'bug': drawBug(ctxO); break;
    case 'blob': drawBlob(ctxO); break;
    case 'floater': drawFloater(ctxO); break;
    case 'flyer': drawFlyer(ctxO); break;
    case 'plant': drawPlant(ctxO); break;
  }
  ctx.restore();
}
// how tall the critter stands (for the marks drawn above it)
export function critterHeight(C) {
  return ({ quad: 96, biped: 118, golem: 150, bug: 78, blob: 90, floater: 120, flyer: 120, plant: 120 })[C.def.kind] || 100;
}
const S = (X, spr, x, y, rot = 0, sx = 1, sy = 1) => spr && X.renderer.sprite(spr, x, y, { rot, sx, sy, flash: X.fl, alpha: X.o.alpha ?? 1 });

// ------------------------------------------------------------------ quad
function drawQuad(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const toad = !!f.toad, moving = o.moving;
  const walk = o.walkT || 0;
  const hop = toad && moving ? Math.abs(Math.sin(walk * 0.5)) : 0;
  const bodyY = (toad ? -36 - hop * 26 : -52) + w * 9 - (moving && !toad ? Math.abs(Math.sin(walk)) * 3 : Math.sin(t * 2.2) * 1.2);
  const lunge = b * 22 - w * 6 - (o.hurt ? 5 : 0);
  const tilt = -w * 0.08 + b * 0.06 + (moving ? 0.03 : 0);
  const legC = mixC(c.main, '#0c0710', 0.15), farC = mixC(c.main, '#0c0710', 0.45);
  const stride = moving ? (toad ? 6 : 16) : 0;
  const L1 = toad ? 20 : 22, L2 = toad ? 22 : 24;
  const hips = [{ x: 30, front: true }, { x: -34, front: false }];
  const leg = (hx, phase, far, front) => {
    const h = { x: hx + lunge + (far ? 6 : 0), y: bodyY + 16 - (far ? 4 : 0) };
    const ph = walk + phase;
    let fx = hx + lunge * 0.35 + Math.sin(ph) * stride + (far ? 6 : 0), fy = -Math.max(0, Math.cos(ph)) * (moving ? 9 : 0) - (far ? 3 : 0);
    if (toad && !front) { fx = hx + 6 - hop * 18; fy = -hop * 6; }
    if (toad && front) { fx = hx + 10 + hop * 8; fy = -hop * 10; }
    if (w > 0 && front) fx += 6 * w;
    const k = knee(h, { x: fx, y: fy }, L1, L2, toad ? (front ? 1 : -1) : front ? -1 : 1);
    limb(ctx, [h, k, { x: fx, y: fy }], (toad && !front ? 14 : 10), far ? farC : legC, fl);
    ctx.fillStyle = far ? farC : mixC(legC, '#0c0710', 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(fx + 4, fy - 2, 7, 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
  };
  // far legs, tail, body, near legs, head
  leg(hips[0].x, PI, true, true); leg(hips[1].x, 0, true, false);
  // tail
  const sway = Math.sin(t * 3.1) * 8 + (moving ? Math.sin(walk) * 5 : 0) - w * 10;
  const tx0 = -56 + lunge, ty0 = bodyY - 6;
  if (!toad) {
    curve(ctx, tx0, ty0, tx0 - 26, ty0 - 18 + sway * 0.4, tx0 - 40, ty0 - 34 + sway - w * 12, 9, c.main, fl);
    if (f.tailFire) flame(ctx, tx0 - 40, ty0 - 30 + sway - w * 12, 12, t, c.accent, c.glow);
  }
  ctx.save(); ctx.translate(lunge, bodyY); ctx.rotate(tilt);
  S(X, P.body, 0, 0, 0, 1 + st.sq * 0.25, 1 - st.sq * 0.25);
  ctx.restore();
  leg(hips[0].x, 0, false, true); leg(hips[1].x, PI, false, false);
  // head with a jaw that drops on the wind-up and snaps shut on the bite
  const hx = (toad ? 40 : 50) + lunge + b * 8, hy = bodyY - (toad ? 4 : 12) + w * 8 + (moving ? Math.sin(walk * 2) * 2 : Math.sin(t * 2) * 1.5);
  const hr = (o.look || 0) * 0.35 + w * 0.12 - b * 0.1;
  const jaw = Math.max(w * 0.55, a.swing >= 0 && a.swing < 0.3 ? 0.5 : 0) + (toad ? 0 : Math.sin(t * 1.3) * 0.03);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(hr);
  S(X, P.jaw, 18, 8, jaw);
  S(X, P.head, 0, 0);
  blinkLids(ctx, P.head, { x: 0, y: 0 }, X.st, c.main);
  if (w > 0.2 && f.cracks) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(56, 2, 1, 56, 2, 22); g.addColorStop(0, `rgba(255,220,140,${0.7 * w})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(56, 2, 22, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.restore();
  if (f.corona) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lunge, bodyY - 10, 10, lunge, bodyY - 10, 70);
    g.addColorStop(0, 'rgba(255,210,122,0)'); g.addColorStop(0.75, `rgba(255,190,90,${0.18 + 0.12 * Math.sin(t * 4)})`); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lunge, bodyY - 10, 70, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// ------------------------------------------------------------------ biped
function drawBiped(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const walk = o.walkT || 0, moving = o.moving;
  const legLen = 24, hipY = -legLen - 2;
  const bob = moving ? Math.abs(Math.sin(walk)) * 3 : Math.sin(t * 2.4) * 1.5;
  const crouch = w * 6 - b * 3;
  const lunge = b * 14 - w * 4 - (o.hurt ? 4 : 0);
  const bodyY = hipY - bob + crouch;
  const lean = -w * 0.12 + b * 0.16;
  const legC = mixC(c.main, '#0c0710', 0.3);
  const stepL = (side) => {
    const ph = walk + (side ? PI : 0);
    const h = { x: lunge * 0.4 + (side ? -9 : 9), y: bodyY - 6 };
    const fx = h.x + (moving ? Math.sin(ph) * 10 : 0) + (side ? -2 : 2), fy = -(moving ? Math.max(0, Math.cos(ph)) * 7 : 0);
    const k = knee(h, { x: fx, y: fy }, 14, 15, 1);
    limb(ctx, [h, k, { x: fx, y: fy }], 8, side ? mixC(legC, '#0c0710', 0.3) : legC, fl);
    ctx.fillStyle = mixC(legC, '#0c0710', 0.35); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(fx + 3, fy - 1, 7, 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
  };
  // tail
  if (f.tail) {
    const sw = Math.sin(t * 2.6) * 6 - w * 6;
    curve(ctx, -14 + lunge, bodyY - 10, -36 + lunge, bodyY - 4 + sw, -40 + lunge, bodyY - 30 + sw, 6, f.tail, fl);
    ctx.fillStyle = c.accent; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-40 + lunge, bodyY - 30 + sw); ctx.lineTo(-48 + lunge, bodyY - 40 + sw); ctx.lineTo(-34 + lunge, bodyY - 36 + sw); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // wings behind (flap; harder on the wind-up)
  const shoulderY = bodyY - 30;
  if (P.wing) {
    const flap = Math.sin(t * (8 + w * 10)) * (0.25 + w * 0.2);
    ctx.save(); ctx.translate(-8 + lunge, shoulderY + 4); ctx.rotate(-0.5 + flap); ctx.globalAlpha *= 0.85;
    S(X, P.wing, 0, 0, 0, -1, 1);
    ctx.restore();
  }
  stepL(true);
  // back arm (behind the body)
  const arm = (front) => {
    const sx0 = (front ? 17 : -15) + lunge, sy0 = shoulderY;
    const swingA = moving ? Math.sin(walk + (front ? PI : 0)) * 0.6 : Math.sin(t * 2 + (front ? 0 : 1)) * 0.12;
    let ang = (front ? 1.1 : 1.9) + swingA;
    if (front) {
      ang = lerp(ang, -2.3, w);                                   // claw raised high
      if (a.swing >= 0 && a.swing < 1) ang = lerp(-2.3, 1.1, ease(a.swing));   // rakes down through
      if (a.cast >= 0 && a.cast < 1) ang = lerp(ang, -0.4, Math.sin(a.cast * PI));
    } else ang = lerp(ang, 0.5, w * 0.6);
    const el = { x: sx0 + Math.cos(ang) * 13, y: sy0 + Math.sin(ang) * 13 };
    const ang2 = ang + (front ? -0.6 : 0.5) * (1 - b);
    const hd = { x: el.x + Math.cos(ang2) * 13, y: el.y + Math.sin(ang2) * 13 };
    limb(ctx, [{ x: sx0, y: sy0 }, el, hd], 7, front ? c.main : mixC(c.main, '#0c0710', 0.35), fl);
    // claws
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = '#fff8ea';
    for (let i = -1; i <= 1; i++) { const ca = ang2 + i * 0.35; ctx.beginPath(); ctx.moveTo(hd.x, hd.y); ctx.lineTo(hd.x + Math.cos(ca) * 7, hd.y + Math.sin(ca) * 7); ctx.stroke(); }
    if (front && a.swing >= 0 && a.swing < 0.8) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= (1 - a.swing) * 0.8;
      ctx.strokeStyle = c.glow; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(sx0, sy0, 30, -2.3, lerp(-2.3, 1.1, ease(a.swing))); ctx.stroke();
      ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    if (!front && f.emberHand) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const r = 8 + w * 5 + Math.sin(t * 8) * 1.2, g = ctx.createRadialGradient(hd.x, hd.y, 1, hd.x, hd.y, r * 2);
      g.addColorStop(0, '#fff6d0'); g.addColorStop(0.35, c.accent); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hd.x, hd.y, r * 2, 0, TAU); ctx.fill(); ctx.restore();
    }
  };
  arm(false);
  ctx.save(); ctx.translate(lunge, bodyY); ctx.rotate(lean);
  S(X, P.body, 0, 0, 0, 1 + st.sq * 0.18, 1 - st.sq * 0.18);
  // head on the neck: looks at the hero, tips back on the wind-up
  const hy = -42 + Math.sin(t * 2.4) * 0.8, hr = (o.look || 0) * 0.3 - w * 0.12 + b * 0.1;
  ctx.save(); ctx.translate(2, hy); ctx.rotate(hr);
  S(X, P.head, 0, 0);
  blinkLids(ctx, P.head, { x: 0, y: 0 }, st, c.main);
  if (f.flameHead) flame(ctx, 0, -40, 15 + w * 6, t, c.accent, c.glow);
  ctx.restore();
  ctx.restore();
  stepL(false);
  arm(true);
}

// ------------------------------------------------------------------ golem
function drawGolem(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const walk = (o.walkT || 0) * 0.7, moving = o.moving;
  const legLen = f.squat ? 16 : 30;
  const stomp = moving ? Math.abs(Math.sin(walk)) : 0;
  const crouch = w * 10 - b * 4;
  const lunge = b * 10 - w * 3;
  const bodyY = -legLen - stomp * 4 + crouch;
  const legC = mixC(c.main, '#0c0710', 0.25);
  const leg = (side) => {
    const ph = walk + (side ? PI : 0);
    const h = { x: (side ? -24 : 22) + lunge * 0.3, y: bodyY - 10 };
    const fx = h.x + (moving ? Math.sin(ph) * 9 : 0), fy = -(moving ? Math.max(0, Math.cos(ph)) * 6 : 0);
    const k = knee(h, { x: fx, y: fy }, legLen * 0.55 + 4, legLen * 0.55 + 4, 1);
    limb(ctx, [h, k, { x: fx, y: fy }], 16, side ? mixC(legC, '#0c0710', 0.3) : legC, fl);
    ctx.fillStyle = mixC(c.light, '#0c0710', 0.3); ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(fx - 12, fy - 8, 26, 10, 4); ctx.fill(); ctx.stroke();
  };
  const shoulderY = bodyY - 64;
  const arm = (front) => {
    const sx0 = (front ? 40 : -40) + lunge;
    let up = Math.sin(t * 1.6 + (front ? 0 : 1)) * 0.08 + (moving ? Math.sin(walk + (front ? PI : 0)) * 0.25 : 0);
    let ang = 1.45 + up;
    ang = lerp(ang, -1.9, w);
    if (a.swing >= 0 && a.swing < 1) ang = lerp(-1.9, 1.3, ease(a.swing * 1.3));
    if (f.shield && front && w === 0 && a.swing < 0) ang = 1.0;      // the shield is held up in front
    const len = f.shield && front && w === 0 && a.swing < 0 ? 22 : 34;
    const hd = { x: sx0 + Math.cos(ang) * len, y: shoulderY + Math.sin(ang) * len };
    limb(ctx, [{ x: sx0, y: shoulderY }, hd], 14, front ? c.main : mixC(c.main, '#0c0710', 0.35), fl);
    const spr = front && P.shield ? P.shield : P.fist;
    S(X, spr, hd.x, hd.y, ang - PI / 2, 1, 1);
  };
  leg(true); arm(false);
  ctx.save(); ctx.translate(lunge, bodyY); ctx.rotate(-w * 0.06 + b * 0.08);
  S(X, P.body, 0, 0, 0, 1 + st.sq * 0.1, 1 - st.sq * 0.1);
  ctx.save(); ctx.translate(0, -74 + (f.squat ? 6 : 0)); ctx.rotate((o.look || 0) * 0.2);
  S(X, P.head, 0, 0);
  if (w > 0.1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,240,180,${0.6 * w})`; ctx.fillRect(-18, -20, 36, 9); ctx.restore(); }
  ctx.restore();
  // the core glows brighter before a blow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, -42, 2, 0, -42, 26 + w * 20); g.addColorStop(0, `rgba(255,248,220,${0.35 + 0.5 * w})`); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -42, 26 + w * 20, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
  leg(false); arm(true);
}

// ------------------------------------------------------------------ bug
function drawBug(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const walk = (o.walkT || 0) * 1.6, moving = o.moving;
  const spider = !!f.spider;
  const bodyY = -34 - (spider ? 12 : 0) + w * 5 + Math.sin(walk * 2) * (moving ? 1.5 : 0) - (o.air ? 20 : 0);
  const lunge = b * 14 - w * 5;
  const legC = mixC(c.main, '#0c0710', 0.35);
  const pairs = spider ? [-34, -12, 10, 32] : [-26, 0, 26];
  const legs = (far) => {
    pairs.forEach((px, i) => {
      const tri = (i % 2 === 0) !== far;               // tripod gait: alternate legs move together
      const ph = walk + (tri ? 0 : PI);
      const h = { x: px * 0.55 + lunge + (far ? 4 : 0), y: bodyY + 6 - (far ? 3 : 0) };
      const reach = spider ? 50 : 36;
      const fx = px * 1.35 + lunge * 0.4 + (moving ? Math.sin(ph) * 10 : Math.sin(t * 2 + i) * 1.5) + (far ? 4 : 0);
      const fy = -(moving ? Math.max(0, Math.cos(ph)) * 7 : 0) - (far ? 2 : 0) - (o.air ? 18 : 0);
      const k = knee(h, { x: fx, y: fy }, reach * 0.55, reach * 0.6, px < 0 ? 1 : -1);
      if (spider) k.y -= 12; else k.y -= 4;
      limb(ctx, [h, k, { x: fx, y: fy }], spider ? 4.5 : 5, far ? mixC(legC, '#0c0710', 0.4) : legC, fl);
    });
  };
  legs(true);
  // scarab wings buzz behind the shell when it flies or charges
  if (f.wings && (o.air || o.speed > 160 || w > 0)) {
    ctx.save(); ctx.globalAlpha *= 0.55;
    for (const side of [-1, 1]) {
      const fl2 = Math.sin(t * 60 + side) * 0.35;
      ctx.save(); ctx.translate(lunge - 6, bodyY - 30); ctx.rotate(-0.9 + fl2 * side);
      ctx.fillStyle = 'rgba(230,250,255,0.6)'; ctx.strokeStyle = 'rgba(36,23,18,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(-30, 0, 34, 10, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  ctx.save(); ctx.translate(lunge, bodyY); ctx.rotate(-w * 0.05 + (moving ? Math.sin(walk) * 0.02 : 0));
  S(X, P.shell, 0, 0, 0, 1 + st.sq * 0.12, 1 - st.sq * 0.12);
  ctx.restore();
  // head and mandibles
  const hx = 48 + lunge + b * 6, hy = bodyY - 14 + w * 4, hr = (o.look || 0) * 0.25 + w * 0.08;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(hr);
  const open = 0.15 + w * 0.6 - (a.swing >= 0 && a.swing < 0.4 ? 0.5 : 0);
  for (const side of [-1, 1]) {
    const ang = side * Math.max(0, open);
    ctx.save(); ctx.translate(38, 8); ctx.rotate(ang);
    ctx.fillStyle = fl > 0 ? mixC(c.light, '#fff8ea', fl) : c.light; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, -side * 2); ctx.quadraticCurveTo(16, side * 1, 20, side * 12); ctx.quadraticCurveTo(10, side * 8, -4, side * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  S(X, P.head, 0, 0);
  ctx.restore();
  legs(false);
  if (f.cracks && w > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lunge, bodyY - 20, 4, lunge, bodyY - 20, 60); g.addColorStop(0, `rgba(255,170,80,${0.4 * w})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lunge, bodyY - 20, 60, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// ------------------------------------------------------------------ blob
function drawBlob(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const walk = o.walkT || 0, moving = o.moving;
  const hop = o.air ? 1 : moving ? Math.max(0, Math.sin(walk * 0.8)) : 0;
  const lift = hop * 16;
  const breathe = Math.sin(t * 2.6) * 0.035;
  const sq = st.sq + breathe + (hop > 0.6 ? -0.08 : 0);
  const sx = 1 + sq, sy = 1 - sq;
  const lunge = b * 12;
  // little feet
  if (f.feet) {
    for (const side of [-1, 1]) {
      const ph = walk + (side > 0 ? 0 : PI), step = moving ? Math.sin(ph) * 6 : 0, up = moving ? Math.max(0, Math.cos(ph)) * 5 : 0;
      ctx.fillStyle = fl > 0 ? mixC(c.dark, '#fff8ea', fl) : mixC(c.main, '#0c0710', 0.35); ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(side * 18 + step + lunge * 0.5, -3 - up - lift * 0.6, 10, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  const by = -lift;
  S(X, P.body, lunge, by, 0, sx, sy);
  // top pieces wobble behind the body (spring with lag)
  const top = by - 58 * sy;
  if (P.sprout) S(X, P.sprout, lunge + 2, top + 4, Math.sin(t * 2.4) * 0.15 + st.cap * 4 - w * 0.2);
  if (P.cap) S(X, P.cap, lunge, top + 16, st.cap * 3 + Math.sin(t * 1.8) * 0.03, 1 + sq * 0.6, 1 - sq * 0.4);
  // eyes that follow the hero and blink; the mouth opens on the wind-up
  const eyes = P.body.eyes || [];
  const lx = Math.cos(o.aimA || 0) * 2.6, ly = Math.sin(o.aimA || 0) * 2.6;
  for (const [ex, ey, r] of eyes) {
    const x = lunge + (ex - P.body.ax) * sx, y = by + (ey - P.body.ay) * sy;
    const k = st.blinkT > 0 ? Math.max(0.1, 1 - Math.sin((1 - st.blinkT / 0.14) * PI)) : 1;
    ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.1 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (k > 0.3) {
      ctx.fillStyle = w > 0.3 ? '#c2412f' : c.glow; ctx.beginPath(); ctx.arc(x + lx, y + ly * k, r * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + lx, y + ly * k, r * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + lx + r * 0.25, y + ly * k - r * 0.3, r * 0.2, 0, TAU); ctx.fill();
    }
    if (w > 0.2) { ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - r, y - r * 1.25 - (ex < P.body.ax ? -2 : 2) * w); ctx.lineTo(x + r, y - r * 1.25 + (ex < P.body.ax ? -2 : 2) * w); ctx.stroke(); }
  }
  if (f.blush && w < 0.2) { ctx.fillStyle = 'rgba(229,147,122,0.5)'; for (const [ex, ey] of eyes) { ctx.beginPath(); ctx.ellipse(lunge + (ex - P.body.ax) * sx + (ex < P.body.ax ? -9 : 9), by + (ey - P.body.ay + 11) * sy, 4, 2.2, 0, 0, TAU); ctx.fill(); } }
  const my = by + (74 - P.body.ay) * sy, open = 1.5 + w * 6 + b * 3;
  ctx.fillStyle = '#2a1410'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(lunge + 2, my, 6 + w * 2, open, 0, 0, TAU); ctx.fill(); ctx.stroke();
}

// ------------------------------------------------------------------ floater
function drawFloater(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const bob = Math.sin(t * 2.2) * 6;
  const cy = -64 + bob - w * 6 + b * 6;
  const lunge = b * 16 - w * 6;
  const pulse = 1 + Math.sin(t * 3) * 0.03 + w * 0.12 - b * 0.08;
  // streamers / tentacles trail behind the motion
  const n = f.streamers || 0;
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * 12, wave = Math.sin(t * 4 + i * 1.3) * 10 - (o.speed || 0) * 0.03;
    curve(ctx, lunge + ox, cy + 22, lunge + ox - 8 + wave, cy + 38, lunge + ox - 18 + wave * 1.6, cy + 50, 4, mixC(c.main, '#0c0710', 0.2), fl);
  }
  // orbit ring: the back half under the body, the front half over it
  const ring = (front) => {
    if (!f.ring) return;
    const spin = t * (2 + w * 6);
    ctx.save(); ctx.translate(lunge, cy); ctx.rotate(-0.25);
    ctx.strokeStyle = front ? c.accent : mixC(c.accent, '#0c0710', 0.4); ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 14, 0, front ? 0 : PI, front ? PI : TAU); ctx.stroke();
    ctx.fillStyle = c.glow;
    for (let i = 0; i < 3; i++) { const ang = spin + (i / 3) * TAU, s = Math.sin(ang); if ((s > 0) !== front) continue; ctx.beginPath(); ctx.arc(Math.cos(ang) * 46, s * 14, 3.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  ring(false);
  if (f.shards) for (let i = 0; i < 4; i++) {
    const ang = t * 1.4 + (i / 4) * TAU, r = 40 + w * 16;
    ctx.save(); ctx.translate(lunge + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.5); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(230,246,255,0.9)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 0); ctx.lineTo(0, 8); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  S(X, P.body, lunge, cy, Math.sin(t * 1.5) * 0.06, pulse + st.sq * 0.2, pulse - st.sq * 0.2);
  blinkLids(ctx, P.body, { x: lunge, y: cy }, st, c.main);
  ring(true);
  if (f.rotor) {
    ctx.save(); ctx.translate(lunge, cy - 34);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -4); ctx.stroke();
    const sp = t * 30;
    ctx.fillStyle = 'rgba(200,216,234,0.55)';
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(0, -4, Math.abs(Math.cos(sp + i * PI / 2)) * 28 + 2, 3, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (f.wind) {
    ctx.save(); ctx.strokeStyle = 'rgba(230,255,246,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const ang = t * 3 + i * 2.1; ctx.beginPath(); ctx.arc(lunge, cy, 34 + i * 6, ang, ang + 1.1); ctx.stroke(); }
    ctx.restore();
  }
  if (f.spores) {
    ctx.fillStyle = f.spores;
    for (let i = 0; i < 6; i++) { const ph = (t * 0.6 + i / 6) % 1; ctx.globalAlpha = (o.alpha ?? 1) * (1 - ph); ctx.beginPath(); ctx.arc(lunge + Math.sin(i * 2.3 + t) * 30, cy - 20 - ph * 40, 2.5, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = o.alpha ?? 1;
  }
  if (w > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lunge, cy, 4, lunge, cy, 50); g.addColorStop(0, `rgba(255,255,255,${0.35 * w})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lunge, cy, 50, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// ------------------------------------------------------------------ flyer
function drawFlyer(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, f = C.def.f, c = C.def.c;
  const rate = 5 + w * 6 + (o.speed > 200 ? 4 : 0);
  const flap = Math.sin(t * rate);
  const cy = -72 + Math.sin(t * 2) * 5 - flap * 4 + w * 8;
  const lunge = b * 20 - w * 8;
  const pitch = -w * 0.12 + b * 0.18;
  if (f.tail) {
    const sw = Math.sin(t * 3) * 10;
    curve(ctx, lunge - 46, cy + 2, lunge - 80, cy + 4 + sw, lunge - 110, cy - 6 - sw, 4, mixC(c.main, '#0c0710', 0.2), fl);
  }
  // far wing (darker, behind)
  // wings rise behind the back and beat down together (the far one a beat behind and in shadow)
  ctx.save(); ctx.translate(lunge + 6, cy - 8); ctx.rotate(pitch - 2.35 + Math.sin(t * rate - 0.4) * 0.75); ctx.globalAlpha *= 0.75;
  S(X, P.wing, 0, 0, 0, 0.85, -0.9);
  ctx.restore();
  ctx.save(); ctx.translate(lunge, cy); ctx.rotate(pitch);
  S(X, P.body, 0, 0, 0, 1 + st.sq * 0.12, 1 - st.sq * 0.12);
  blinkLids(ctx, P.body, { x: 0, y: 0 }, st, c.main);
  ctx.restore();
  ctx.save(); ctx.translate(lunge + 2, cy - 4); ctx.rotate(pitch - 2.6 + flap * 0.85);
  S(X, P.wing, 0, 0, 0, 1, -1);
  ctx.restore();
}

// ------------------------------------------------------------------ plant
function drawPlant(X) {
  const { ctx, C, o, a, st, t, w, b, fl } = X, P = C.parts, c = C.def.c;
  const sway = Math.sin(t * 1.7) * 6;
  const hx = sway - w * 16 + b * 22 + (o.look || 0) * 6, hy = -74 + w * 8 - b * 6;
  // leaves at the foot
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * 6, -4); ctx.rotate(side * (0.5 + Math.sin(t * 2 + side) * 0.08));
    ctx.fillStyle = fl > 0 ? mixC(c.main, '#fff8ea', fl) : c.main; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * 22, -16, side * 40, -2); ctx.quadraticCurveTo(side * 22, 6, 0, 0); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  curve(ctx, 0, -2, sway * 0.4 - w * 4, -40, hx, hy + 6, 10, mixC(c.main, '#0c0710', 0.15), fl, false);
  S(X, P.head, hx, hy + 6, (o.look || 0) * 0.3 - w * 0.2 + b * 0.25, 1 + st.sq * 0.2, 1 - st.sq * 0.2);
  blinkLids(ctx, P.head, { x: hx, y: hy + 6 }, st, c.main);
  if (w > 0) {
    const m = P.head.mouth || [48, 46];
    const mx = hx + m[0] - P.head.ax, my = hy + 6 + m[1] - P.head.ay;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, my, 1, mx, my, 18 * w + 4); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.5, c.glow); g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 18 * w + 4, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// Shared by the scenes: works out facing, gait and gaze from the monster's own motion, then draws it.
export function drawCritterAt(renderer, C, e, a, { z = 0, scale, alpha = 1, flash = 0, target = null, time }) {
  const st = stateOf(e);
  // remote copies (co-op views) carry no velocity: read it from how far they moved since the last frame
  let vx = e.vx, vy = e.vy;
  if (vx == null || e.isView) {
    const d = st.pt == null ? 0 : Math.max(1e-3, time - st.pt);
    vx = st.px == null || !d ? 0 : (e.x - st.px) / d; vy = st.py == null || !d ? 0 : (e.y - st.py) / d;
    st.vxs = lerp(st.vxs || 0, vx, 0.25); st.vys = lerp(st.vys || 0, vy, 0.25); vx = st.vxs; vy = st.vys;
  }
  st.px = e.x; st.py = e.y; st.pt = time;
  const sp = Math.hypot(vx || 0, vy || 0);
  // face the hero while winding up or close; otherwise face where it is going
  let face = st.face || 1;
  if (target && !e.dead && (a.wind > 0 || Math.abs(target.x - e.x) < 420 || sp < 30)) face = target.x < e.x ? -1 : 1;
  else if (Math.abs(vx || 0) > 25) face = vx < 0 ? -1 : 1;
  st.face = face;
  st.walkT = (st.walkT || 0) + (a.dt || 0) * Math.min(16, sp / 12);
  const dx = target ? target.x - e.x : 0, dy = target ? (target.y - 40) - (e.y - 60) : 0;
  const look = target ? Math.max(-1, Math.min(1, Math.atan2(dy, Math.abs(dx) || 1))) : 0;
  drawCritter(renderer, C, e, a, {
    x: e.x, y: e.y - z, flip: face < 0, scale, time: time + (st.ph ??= Math.random() * 10), moving: sp > 25, walkT: st.walkT, speed: sp,
    look, aimA: Math.atan2(dy, dx * face), alpha, flash, hurt: (e.flash || 0) > 0.4, air: z > 4, deathT: e.dead ? (e.deathT || 0) : null,
  });
}
