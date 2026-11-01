// Draws the jointed hunter with a weapon-specific pose (see weaponPose.js). Used by the dungeon and the camp,
// so the hero looks the same everywhere. Returns the hand and weapon-tip positions in world space (for trails).
import { RIG } from '../art/hero.js';
import { idlePose } from './weaponPose.js';

const PI = Math.PI;

// pose: { x, y, flip, time, walkT, moving, wp (weapon pose) | null, type (weapon type), dashing, flash, alpha, scale,
//         deathT, vx, speed }
export function drawHero(renderer, parts, weapon, pose) {
  const ctx = renderer.ctx;
  const sc = pose.scale ?? 1;
  const t = pose.time || 0;
  const moving = !!pose.moving;
  const walk = pose.walkT || 0;
  const bob = moving ? Math.abs(Math.sin(walk)) * 2.4 : Math.sin(t * 2.4) * 0.8;
  const leg = moving ? Math.sin(walk) * 0.55 : 0;
  const wp = pose.wp || idlePose(pose.type || { id: 'sword' }, t, moving, leg);
  const o = { flash: pose.flash || 0, alpha: pose.alpha ?? 1 };
  const crouch = wp.crouch || 0;
  const lift = bob - crouch;

  // whole-body tilt: lean into the run, into the swing, and forward while dodging
  const runLean = moving && pose.speed ? Math.max(-0.1, Math.min(0.1, (Math.abs(pose.vx || 0) / pose.speed) * 0.09)) : 0;
  let rot = runLean + (wp.lean || 0);
  if (pose.dashing) rot += 0.2;
  if (pose.deathT != null) rot = Math.min(1.35, pose.deathT * 3);

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.flip ? -sc : sc, sc);
  ctx.rotate(rot);
  if (pose.deathT != null) ctx.globalAlpha = Math.max(0.35, 1 - pose.deathT * 0.4);

  const P = (part, pv, r = 0, dy = 0, extra = null) => renderer.sprite(part, pv.x, pv.y - dy, { rot: r, ...o, ...(extra || {}) });
  const dirv = (a) => ({ x: Math.cos(a), y: Math.sin(a) });

  // front hand
  const sF = { x: RIG.shoulderFront.x, y: RIG.shoulderFront.y - lift };
  const reach = Math.max(-8, Math.min(18, wp.reach || 0));
  const aF = dirv(wp.arm);
  const hand = { x: sF.x + aF.x * (RIG.armLen + reach), y: sF.y + aF.y * (RIG.armLen + reach) };
  const bladeDir = dirv(wp.blade);

  // back hand: dual weapon, two-handed grip on the shaft, or drawing the bow string
  const sB = { x: RIG.shoulderBack.x, y: RIG.shoulderBack.y - lift };
  let backAng = leg * 0.6 + 0.25 + PI / 2, backLen = RIG.armLen;
  if (wp.dual) { backAng = wp.backArm; backLen = RIG.armLen + Math.max(-6, Math.min(16, wp.backReach || 0)); }
  else if (wp.twoHand || wp.bow) {
    const grip = wp.bow
      ? { x: hand.x - bladeDir.x * (5 + (wp.draw || 0) * 24), y: hand.y - bladeDir.y * (5 + (wp.draw || 0) * 24) }
      : { x: hand.x - bladeDir.x * 11, y: hand.y - bladeDir.y * 11 };
    backAng = Math.atan2(grip.y - sB.y, grip.x - sB.x);
    backLen = Math.min(RIG.armLen + 14, Math.hypot(grip.x - sB.x, grip.y - sB.y));
  }
  const aB = dirv(backAng);
  const backHand = { x: sB.x + aB.x * backLen, y: sB.y + aB.y * backLen };
  const armSy = (len) => Math.max(0.7, Math.min(1.7, len / RIG.armLen));

  if (parts.wings) drawWings(renderer, parts.wings, { x: -4, y: -54 - lift }, t, moving, !!pose.dashing, o);
  P(parts.scarf, RIG.scarf, Math.sin(t * 6) * 0.12 - (moving ? 0.2 : 0) - (pose.dashing ? 0.35 : 0), lift);
  if (wp.dual && weapon) renderer.sprite(weapon.off || weapon, backHand.x, backHand.y, { rot: wp.backBlade + PI / 2, sx: 0.95, sy: 0.95, ...o });
  P(parts.armBack, sB, backAng - PI / 2, 0, { sy: armSy(backLen) });
  P(parts.legBack, RIG.hipBack, -leg);
  P(parts.legFront, RIG.hipFront, leg);
  P(parts.body, RIG.body, 0, lift);
  P(parts.collar, { x: RIG.neck.x - 3, y: RIG.neck.y + 2 }, 0, lift);
  P(parts.head, RIG.neck, Math.sin(t * 1.7) * 0.03 + (pose.dashing ? 0.1 : 0), lift * 1.1);

  // weapon in the front hand
  let tipLen = 0;
  if (weapon) {
    if (wp.bow) {
      renderer.sprite(weapon, hand.x, hand.y, { rot: wp.blade, ...o });
      drawBowString(ctx, weapon, hand, wp, backHand, o.alpha);
    } else {
      renderer.sprite(weapon, hand.x, hand.y, { rot: wp.blade + PI / 2, sx: 1.05, sy: 1.05, ...o });
      tipLen = (weapon.tipAt ?? weapon.ay) * 1.05;
    }
    if (wp.glow > 0 && weapon.tip) {
      const tl = (weapon.tipAt ?? weapon.ay) * 1.05;
      const tip = { x: hand.x + bladeDir.x * tl, y: hand.y + bladeDir.y * tl };
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, 26);
      g.addColorStop(0, `rgba(255,240,190,${(0.9 * wp.glow).toFixed(3)})`); g.addColorStop(0.4, `${weapon.tip}`); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.globalAlpha = Math.min(1, wp.glow) * o.alpha; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 26, 0, PI * 2); ctx.fill(); ctx.restore();
    }
  }
  P(parts.armFront, sF, wp.arm - PI / 2, 0, { sy: armSy(RIG.armLen + reach) });
  ctx.restore();

  // world-space hand / tip for weapon trails
  const toWorld = (pt) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const rx = pt.x * c - pt.y * s, ry = pt.x * s + pt.y * c;
    return { x: pose.x + (pose.flip ? -1 : 1) * sc * rx, y: pose.y + sc * ry };
  };
  const tipR = { x: hand.x + bladeDir.x * tipLen, y: hand.y + bladeDir.y * tipLen };
  return { hand: toWorld(hand), tip: toWorld(tipR), len: tipLen * sc };
}

// Two wings from the upper back: the far one smaller and darker, both flapping around the root.
function drawWings(renderer, spr, root, t, moving, dashing, o) {
  const speed = dashing ? 14 : moving ? 8 : 2.6;
  const amp = dashing ? 0.08 : moving ? 0.2 : 0.09;
  const flap = Math.sin(t * speed) * amp;
  const base = dashing ? 0.35 : 0;
  const ctx = renderer.ctx;
  renderer.sprite(spr, root.x + 6, root.y + 1, { rot: base + 0.32 + flap * 1.2, sx: 0.78, sy: 0.82, alpha: (o.alpha ?? 1) * 0.8, flash: o.flash });
  if (spr.glow) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (o.alpha ?? 1) * (0.1 + 0.06 * Math.sin(t * 3));
    ctx.fillStyle = spr.glow; ctx.beginPath(); ctx.ellipse(root.x - 30, root.y - 30, 34, 26, -0.6, 0, PI * 2); ctx.fill(); ctx.restore();
  }
  renderer.sprite(spr, root.x, root.y, { rot: base + flap, alpha: o.alpha, flash: o.flash });
}

function drawBowString(ctx, bow, hand, wp, backHand, alpha) {
  const b = wp.blade, half = bow.limb || 30, back = bow.tipBack ?? 7;
  const nx = -Math.sin(b), ny = Math.cos(b);           // along the limbs
  const fx = Math.cos(b), fy = Math.sin(b);            // toward the target
  const top = { x: hand.x + nx * -half - fx * back, y: hand.y + ny * -half - fy * back };
  const bot = { x: hand.x + nx * half - fx * back, y: hand.y + ny * half - fy * back };
  const draw = wp.draw || 0;
  const pull = draw > 0.02 ? backHand : { x: hand.x - fx * back, y: hand.y - fy * back };
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = bow.string || '#efe2c4'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(pull.x, pull.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
  if (draw > 0.05) {
    // nocked arrow
    ctx.strokeStyle = '#6e4a30'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(pull.x, pull.y); ctx.lineTo(pull.x + fx * 40, pull.y + fy * 40); ctx.stroke();
    ctx.fillStyle = '#d7d1c4'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1;
    const hx = pull.x + fx * 40, hy = pull.y + fy * 40;
    ctx.beginPath(); ctx.moveTo(hx + fx * 8, hy + fy * 8); ctx.lineTo(hx - nx * 4, hy - ny * 4); ctx.lineTo(hx + nx * 4, hy + ny * 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
