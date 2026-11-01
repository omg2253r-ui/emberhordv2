// Animates and draws the jointed fighters of art/rig.js, and gives every other monster sprite the same body
// language (anticipation before a blow, follow-through after it, breathing, recoil, collapse).
//
// What drives the motion (set by the scenes, see noteSwing / noteCast):
//   e.warn > 0         the telegraph: the fighter winds up (weapon drawn back, weight on the back foot)
//   warn → 0           the blow: a fast swing / thrust through the target (with a smear of light)
//   noteCast(e)        a spell: the weapon is raised toward the target and its tip flares
//   e.flash            took a hit: recoil
//   e.dead / deathT    collapse
import { RIG2 } from '../art/rig.js';

const PI = Math.PI;
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;
const SWING_T = 0.3, CAST_T = 0.55;

export function animOf(e) { return (e.anim ||= { wind: 0, swing: -1, cast: -1, lastWarn: 0, lt: null, cur: null, from: null }); }
export function noteSwing(e) { const a = animOf(e); if (a.swing < 0 || a.swing > 0.7) a.swing = 0; }
export function noteCast(e) { const a = animOf(e); a.cast = 0; }

// advance the timers once per frame (time = the scene clock)
export function tickAnim(e, time) {
  const a = animOf(e);
  const dt = a.lt == null ? 0 : Math.max(0, Math.min(0.1, time - a.lt));
  a.lt = time;
  const warn = (e.warn || 0) > 0 && !e.dead;
  a.wind = warn ? Math.min(1, a.wind + dt * 5) : Math.max(0, a.wind - dt * 6);
  if (!warn && a.lastWarn && !e.dead) { if (e.anim.hold === 'cast' && !e.anim.melee) a.cast = 0; else a.swing = 0; }
  a.lastWarn = warn ? 1 : 0;
  if (a.swing >= 0) { a.swing += dt / SWING_T; if (a.swing > 1.6) a.swing = -1; }
  if (a.cast >= 0) { a.cast += dt / CAST_T; if (a.cast > 1.3) a.cast = -1; }
  a.dt = dt;
  return a;
}

// ------------------------------------------------------------------ poses per way of holding the weapon
// arm: direction of the front arm · blade: where the weapon tip points · reach: hand travel · lean · crouch
function targetPose(hold, a, aim, t, moving, walk) {
  const sway = Math.sin(t * 2.1) * 0.05, run = moving ? Math.sin(walk) * 0.3 : 0;
  const w = ease(a.wind), s = a.swing >= 0 ? Math.min(1, a.swing) : -1, c = a.cast >= 0 ? Math.min(1, a.cast) : -1;
  let p;
  switch (hold) {
    case 'heavy':
      p = { arm: lerp(1.05 + run * 0.3, -2.0, w), blade: lerp(-1.25 + sway, -2.95, w), reach: 0, lean: -0.12 * w, crouch: 8 * w, two: true };
      if (s >= 0) { const k = ease(s); p = { arm: lerp(-2.0, 1.25, k), blade: lerp(-2.95, 1.55, k), reach: 10 * k, lean: lerp(-0.12, 0.2, k), crouch: lerp(8, 4, k), two: true, smear: [-2.95, lerp(-2.95, 1.55, k)] }; }
      break;
    case 'thrust':
      p = { arm: lerp(0.9 + run * 0.3, aim + 0.25, w), blade: lerp(-0.65 + sway, aim, w), reach: -22 * w, lean: -0.08 * w, crouch: 6 * w, two: true };
      if (s >= 0) { const k = ease(s * 1.4); p = { arm: aim + 0.2, blade: aim, reach: lerp(-22, 30, k), lean: 0.16 * k, crouch: 6, two: true, thrust: k }; }
      break;
    case 'cast':
      p = { arm: 1.15 + run * 0.4, blade: -PI / 2 + 0.12 + sway, reach: 0, lean: 0, crouch: 0, backArm: 1.75 - run };
      if (w > 0) p = { arm: lerp(p.arm, aim - 0.6, w), blade: lerp(p.blade, -PI / 2 - 0.15, w), reach: 4 * w, lean: -0.06 * w, crouch: 3 * w, backArm: lerp(1.75, -1.4, w), glow: w };
      if (c >= 0) { const k = ease(c * 2); const back = ease(Math.max(0, c - 0.5) * 2); p = { arm: lerp(lerp(aim - 0.6, aim - 0.15, k), 1.15, back), blade: lerp(-PI / 2 - 0.15, -PI / 2 + 0.12, back), reach: lerp(14 * k, 0, back), lean: lerp(0.1 * k, 0, back), crouch: 0, backArm: lerp(-1.4, 1.75, back), glow: 1 - back, flare: c < 0.5 ? 1 - c * 2 : 0 }; }
      if (s >= 0) { const k = ease(s); p = { arm: lerp(-2.2, 1.1, k), blade: lerp(-2.6, 0.9, k), reach: 8 * k, lean: 0.14 * k, crouch: 3, backArm: 1.6, smear: [-2.6, lerp(-2.6, 0.9, k)] }; }
      break;
    case 'bow':
      p = { arm: aim, blade: aim, reach: 0, lean: 0, crouch: 0, bow: true, draw: w };
      if (c >= 0) p.draw = c < 0.15 ? 1 : 0;
      if (s >= 0) p.draw = 0;
      break;
    default: // one-handed blade
      p = { arm: lerp(1.2 + run * 0.4, -2.3, w), blade: lerp(-0.9 + sway, -2.6, w), reach: 0, lean: -0.1 * w, crouch: 5 * w, backArm: lerp(1.7 - run, 2.4, w) };
      if (s >= 0) { const k = ease(s); p = { arm: lerp(-2.3, 1.3, k), blade: lerp(-2.6, 1.3, k), reach: 8 * k, lean: lerp(-0.1, 0.18, k), crouch: 5, backArm: 2.2, smear: [-2.6, lerp(-2.6, 1.3, k)] }; }
  }
  // a power move by a fighter without a staff: the weapon goes up (its tip flares), then comes down hard
  if (c >= 0 && hold !== 'cast' && hold !== 'bow' && s < 0) {
    const up = ease(Math.min(1, c * 2.2)), down = ease(Math.max(0, c - 0.45) * 2.4);
    const blade = lerp(lerp(p.blade, -PI / 2 - 0.25, up), 0.8, down);
    p = { arm: lerp(lerp(p.arm, -1.9, up), 1.0, down), blade, reach: 6 * down, lean: lerp(-0.08 * up, 0.16, down), crouch: lerp(2, 10, down), two: p.two, backArm: lerp(1.7, -1.5, up), flare: c < 0.45 ? up : 0, smear: down > 0 && down < 1 ? [-PI / 2 - 0.25, blade] : null };
  }
  return p;
}

// ------------------------------------------------------------------ the jointed fighter
// R: { parts (rasterized), def (RIGS entry), hold, tip }
// o: { x, y, flip, scale, time, moving, walkT, aim (relative to facing), alpha, flash, deathT, hurt }
export function drawRig(renderer, R, e, o) {
  const ctx = renderer.ctx, P = R.parts, t = o.time;
  const a = animOf(e); a.hold = R.hold;
  const raw = targetPose(R.hold, a, o.aim, t, o.moving, o.walkT);
  // ease toward the pose (blows themselves are set directly so they stay sharp)
  const sharp = a.swing >= 0 || (a.cast >= 0 && a.cast < 0.5);
  if (!a.cur || sharp) a.cur = { ...raw };
  else { const k = Math.min(1, (a.dt || 0.016) * 14); for (const key of ['arm', 'blade', 'reach', 'lean', 'crouch', 'backArm', 'draw']) if (raw[key] != null) a.cur[key] = a.cur[key] == null ? raw[key] : lerp(a.cur[key], raw[key], k); Object.assign(a.cur, { two: raw.two, bow: raw.bow, glow: raw.glow, flare: raw.flare, smear: raw.smear, thrust: raw.thrust }); }
  const p = a.cur;
  const sc = o.scale;
  const walk = o.walkT || 0, moving = !!o.moving;
  const bob = moving ? Math.abs(Math.sin(walk)) * 3 : Math.sin(t * 2.2) * 1.4;
  const legA = moving ? Math.sin(walk) * 0.42 : 0;
  const crouch = (p.crouch || 0) + (o.deathT != null ? Math.min(30, o.deathT * 60) : 0);
  const lift = bob - crouch;
  let rot = (p.lean || 0) - (o.hurt || 0) * 0.16;
  if (o.deathT != null) rot = -Math.min(1.1, o.deathT * 2.2);
  const fx = { flash: o.flash || 0, alpha: o.alpha ?? 1 };
  const S = (spr, x, y, r = 0, extra = null) => spr && renderer.sprite(spr, x, y, { rot: r, ...fx, ...(extra || {}) });
  const dir = (ang) => ({ x: Math.cos(ang), y: Math.sin(ang) });

  ctx.save();
  ctx.translate(o.x, o.y);
  if (P.boat) S(P.boat, 0, 6 + Math.sin(t * 1.4) * 3, Math.sin(t * 1.1) * 0.02, { sx: sc, sy: sc });
  ctx.scale(o.flip ? -sc : sc, sc);
  ctx.rotate(rot);

  const sF = { x: RIG2.shoulderFront.x, y: RIG2.shoulderFront.y - lift }, sB = { x: RIG2.shoulderBack.x, y: RIG2.shoulderBack.y - lift };
  const L = RIG2.armLen;
  const reach = Math.max(-26, Math.min(32, p.reach || 0));
  const aF = dir(p.arm);
  const hand = { x: sF.x + aF.x * (L + reach), y: sF.y + aF.y * (L + reach) };
  const bd = dir(p.blade);
  let backAng = (p.backArm ?? (1.7 - legA * 0.6)), backLen = L;
  if (R.def.orb && !p.two) backAng = Math.min(backAng, 0.7 + Math.sin(t * 1.7) * 0.08 - a.wind * 0.9);    // the orb is held out in front
  if (p.two) { const grip = { x: hand.x - bd.x * 22, y: hand.y - bd.y * 22 }; backAng = Math.atan2(grip.y - sB.y, grip.x - sB.x); backLen = Math.min(L + 20, Math.hypot(grip.x - sB.x, grip.y - sB.y)); }
  if (p.bow) { const pull = 10 + (p.draw || 0) * 46; const grip = { x: hand.x - bd.x * pull, y: hand.y - bd.y * pull }; backAng = Math.atan2(grip.y - sB.y, grip.x - sB.x); backLen = Math.min(L + 30, Math.hypot(grip.x - sB.x, grip.y - sB.y)); }
  const aB = dir(backAng);
  const backHand = { x: sB.x + aB.x * backLen, y: sB.y + aB.y * backLen };
  const armSy = (len) => Math.max(0.75, Math.min(1.5, len / L));

  // behind the body
  if (P.wings) { const f = Math.sin(t * 3.2) * 0.07 + (a.wind ? 0.08 : 0); S(P.wings, -6, -128 - lift, 0, { sx: 1 + f, sy: 1 - f * 0.4 }); }
  if (P.cape) S(P.cape, RIG2.capeAt.x, RIG2.capeAt.y - lift, Math.sin(t * 1.8) * 0.05 + (moving ? 0.16 : 0) + (p.lean || 0) * -0.8 + (a.swing >= 0 ? 0.12 : 0));
  if (!(P.lantern && R.def.orb)) S(P.armBack, sB.x, sB.y, backAng - PI / 2, { sy: armSy(backLen) });
  if (P.lantern && !R.def.orb) S(P.lantern, backHand.x, backHand.y, Math.sin(t * 2.4) * 0.22);
  S(P.legBack, RIG2.hipBack.x, RIG2.hipBack.y - Math.min(0, lift) * 0.4, -legA);
  S(P.legFront, RIG2.hipFront.x, RIG2.hipFront.y - Math.min(0, lift) * 0.4, legA);
  if (P.skirt) S(P.skirt, 0, RIG2.waist.y - lift * 0.6, Math.sin(t * 1.9) * 0.025 - (p.lean || 0) * 0.4 + (moving ? Math.sin(walk) * 0.04 : 0), { sy: 1 - Math.max(0, crouch) * 0.004 });
  S(P.torso, RIG2.waist.x, RIG2.waist.y - lift * 0.6, 0, { sy: 1 + Math.sin(t * 2.2) * 0.012 });
  const headTilt = Math.sin(t * 1.6) * 0.04 - a.wind * 0.08 + (a.swing >= 0 && a.swing < 1 ? 0.08 : 0);
  S(P.head, RIG2.neck.x, RIG2.neck.y - lift, headTilt);
  if (P.lantern && R.def.orb) { S(P.armBack, sB.x, sB.y, backAng - PI / 2, { sy: armSy(backLen) }); S(P.lantern, backHand.x, backHand.y + Math.sin(t * 2.6) * 2, 0, { sx: 1 + a.wind * 0.3, sy: 1 + a.wind * 0.3 }); }
  if (R.def.halo) drawHalo(ctx, RIG2.neck.x, RIG2.neck.y - lift - 80, t, R.def.c.glow, fx.alpha);

  // the swing's smear of light (drawn under the weapon)
  const tip = R.tip || 100;
  if (p.smear && a.swing >= 0 && a.swing < 1.05) {
    const [from, to] = p.smear, k = Math.min(1, a.swing);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k * 0.6) * fx.alpha;
    const g = ctx.createRadialGradient(hand.x, hand.y, tip * 0.35, hand.x, hand.y, tip * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, hexA(R.def.c.glow, 0.35)); g.addColorStop(0.95, hexA('#ffffff', 0.55)); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hand.x, hand.y, tip * 1.05, Math.min(from, to), Math.max(from, to)); ctx.arc(hand.x, hand.y, tip * 0.35, Math.max(from, to), Math.min(from, to), true); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (p.thrust > 0 && p.thrust < 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - p.thrust) * fx.alpha;
    const tx = hand.x + bd.x * tip, ty = hand.y + bd.y * tip;
    ctx.strokeStyle = hexA(R.def.c.glow, 0.8); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx - bd.x * 90, ty - bd.y * 90); ctx.lineTo(tx + bd.x * 20, ty + bd.y * 20); ctx.stroke();
    ctx.restore();
  }

  // the weapon in the hand, then the hand over its grip
  if (p.bow) {
    S(P.weapon, hand.x, hand.y, p.blade);
    const top = rotPt(hand, p.blade, -70), bot = rotPt(hand, p.blade, 70);
    ctx.save(); ctx.globalAlpha = fx.alpha; ctx.strokeStyle = '#f3e6c8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(backHand.x, backHand.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
    if (p.draw > 0.2) { ctx.strokeStyle = R.def.c.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(backHand.x, backHand.y); ctx.lineTo(backHand.x + bd.x * 70, backHand.y + bd.y * 70); ctx.stroke(); }
    ctx.restore();
  } else S(P.weapon, hand.x, hand.y, p.blade + PI / 2);
  S(P.armFront, sF.x, sF.y, p.arm - PI / 2, { sy: armSy(L + reach) });

  // a spell gathering at the tip
  const g = Math.max(p.glow || 0, p.flare || 0);
  if (g > 0.02 && !p.bow) {
    const tx = hand.x + bd.x * tip, ty = hand.y + bd.y * tip, r = 18 + g * 26 + Math.sin(t * 20) * 3 + (p.flare || 0) * 30;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, g) * fx.alpha;
    const gr = ctx.createRadialGradient(tx, ty, 1, tx, ty, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, hexA(R.def.c.glow, 0.9)); gr.addColorStop(1, hexA(R.def.c.glow, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(tx, ty, r, 0, PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) { const an = t * 3 + i * 1.05, rr = r * (0.6 + 0.4 * Math.sin(t * 5 + i)); ctx.fillStyle = hexA('#ffffff', 0.7); ctx.fillRect(tx + Math.cos(an) * rr - 1.5, ty + Math.sin(an) * rr - 1.5, 3, 3); }
    ctx.restore();
  }
  ctx.restore();
  // world-space tip, for effects
  const fl = o.flip ? -1 : 1;
  return { tipX: o.x + fl * (hand.x + bd.x * tip) * sc, tipY: o.y + (hand.y + bd.y * tip) * sc, height: 215 * sc };
}

function rotPt(c, ang, d) { const a = ang + PI / 2; return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d }; }
function drawHalo(ctx, x, y, t, col, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(col, 0.9); ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y + Math.sin(t * 2) * 2, 30, 8, 0, 0, PI * 2); ctx.stroke();
  ctx.strokeStyle = hexA('#ffffff', 0.7); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
}
const hexCache = new Map();
export function hexA(hex, a) {
  let c = hexCache.get(hex);
  if (!c) { const n = parseInt(hex.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(hex, c); }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// ------------------------------------------------------------------ every other monster: squash, stretch, lean
// returns extra transform for renderer.sprite: { sx, sy, rot, dx, dy }
export function spriteMotion(e, a, time, facing) {
  const ph = (e.id || 0) * 1.7;
  const breathe = Math.sin(time * 2.3 + ph) * 0.028;
  let sx = 1 - breathe * 0.5, sy = 1 + breathe, rot = 0, dx = 0, dy = 0;
  const w = ease(a.wind);
  sx *= 1 + 0.1 * w; sy *= 1 - 0.13 * w; rot -= 0.1 * w * facing; dx -= 6 * w * facing;          // gather: crouch and lean back
  if (a.swing >= 0 && a.swing < 1) { const k = 1 - a.swing; sx *= 1 + 0.2 * k; sy *= 1 - 0.1 * k; rot += 0.16 * k * facing; dx += 14 * k * facing; }   // strike: lunge through
  if (a.cast >= 0 && a.cast < 1) { const k = Math.sin(a.cast * PI); sy *= 1 + 0.12 * k; sx *= 1 - 0.06 * k; dy -= 6 * k; }
  if ((e.flash || 0) > 0.4 && !e.dead) { rot -= 0.07 * facing; dx -= 4 * facing; }
  const sp = Math.hypot(e.vx || 0, e.vy || 0);
  if (sp > 20) rot += Math.max(-0.1, Math.min(0.1, (e.vx || 0) / 900));
  if (e.dead) { const d = Math.min(1, (e.deathT || 0) / 0.5); sy *= 1 - d * 0.55; sx *= 1 + d * 0.3; }
  return { sx, sy, rot, dx, dy };
}
