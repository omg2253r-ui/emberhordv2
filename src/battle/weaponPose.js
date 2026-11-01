// Weapon-specific body language. Turns the player's move state into joint angles for heroDraw.
// Angles are in rig space (hero faces right, y down): 0 = forward, -PI/2 = up, +PI/2 = down.
//   arm = direction the front arm points, blade = direction the weapon tip points,
//   reach = extra hand travel along the arm, lean = body tilt, back = back-arm override (dual wield / bow string).

const PI = Math.PI;
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);       // fast start, soft landing
const easeIn = (t) => Math.pow(Math.min(1, Math.max(0, t)), 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Resting pose for each weapon type, with a breathing sway.
export function idlePose(type, t, moving, leg) {
  const sway = Math.sin(t * 2.4) * 0.04;
  const run = moving ? -leg * 0.35 : 0;
  switch (type.id) {
    case 'greatsword': return { arm: 1.1 + run * 0.3, blade: -2.25 + sway, reach: 0, lean: 0, twoHand: true };
    case 'staff': return { arm: 1.25 + run, blade: -PI / 2 + 0.16 + sway, reach: 0, lean: 0 };
    case 'bow': return { arm: 1.35 + run, blade: 0.35 + sway, reach: 0, lean: 0, bow: true, draw: 0 };
    case 'spear': return { arm: 1.0 + run * 0.4, blade: -0.75 + sway, reach: 0, lean: 0, twoHand: true };
    case 'dagger': return { arm: 1.3 + run, blade: -0.5 + sway, reach: 0, lean: 0, dual: true, backArm: 1.5 - run, backBlade: -0.2 };
    case 'katana': return { arm: 1.45 + run, blade: -0.15 + sway, reach: 0, lean: 0 };
    // scythe rests over the shoulder, blade hanging behind; twin blades low and crossed, ready to cut
    case 'scythe': return { arm: 1.0 + run * 0.3, blade: -2.0 + sway, reach: 0, lean: 0, twoHand: true };
    case 'twinblades': return { arm: 1.2 + run, blade: 0.35 + sway, reach: 0, lean: 0.02, dual: true, backArm: 1.45 - run, backBlade: 0.7 - sway };
    default: return { arm: 1.37 + run, blade: -1.02 + sway, reach: 0, lean: 0 };
  }
}

// Charging stance: the weapon gathers power, glowing when ready.
function chargePose(type, base, k) {
  switch (type.id) {
    case 'katana': return { arm: lerp(1.4, 2.3, k), blade: lerp(-0.2, 2.6, k), reach: -4 * k, lean: 0.12 * k, crouch: 4 * k };
    case 'greatsword': return { arm: lerp(1.1, -1.9, k), blade: lerp(-2.2, -2.9, k), reach: 0, lean: -0.1 * k, twoHand: true, crouch: 3 * k };
    case 'staff': return { arm: lerp(1.2, -1.2, k), blade: -PI / 2 + 0.05, reach: 2 * k, lean: -0.05 * k };
    case 'bow': return { arm: base, blade: base, reach: 0, lean: 0, bow: true, draw: 0.35 + 0.65 * k };
    case 'spear': return { arm: base + PI, blade: base, reach: -12 * k, lean: -0.08 * k, twoHand: true, crouch: 3 * k };
    case 'dagger': return { arm: lerp(1.3, -1.6, k), blade: lerp(-0.5, -2.4, k), reach: 0, lean: 0, dual: true, backArm: lerp(1.5, -1.3, k), backBlade: -2.2 };
    case 'scythe': return { arm: lerp(1.0, 2.6, k), blade: lerp(-2.0, 3.6, k), reach: -4 * k, lean: 0.14 * k, twoHand: true, crouch: 5 * k };
    case 'twinblades': return { arm: lerp(1.2, 2.5, k), blade: lerp(0.35, 2.9, k), reach: -3 * k, lean: 0.12 * k, crouch: 4 * k, dual: true, backArm: lerp(1.45, 2.8, k), backBlade: lerp(0.7, 3.2, k) };
    default: return { arm: lerp(1.37, -2.4, k), blade: lerp(-1.0, -2.9, k), reach: 0, lean: -0.06 * k, crouch: 2 * k };
  }
}

// One frame of an attack. `ph` = 'windup' | 'active' | 'recover', `k` = 0..1 inside that phase.
function movePose(type, anim, base, ph, k) {
  const w = ph === 'windup' ? ease(k) : 1;
  const a = ph === 'active' ? ease(k) : ph === 'recover' ? 1 : 0;
  const settle = ph === 'recover' ? easeIn(k) : 0;
  const two = !!type.twoHanded;
  switch (anim) {
    case 'slash': case 'slashUp': case 'heavy': case 'heavyUp': {
      const big = anim === 'heavy' || anim === 'heavyUp';
      const up = anim === 'slashUp' || anim === 'heavyUp' ? -1 : 1;
      const from = base - up * (big ? 2.1 : 1.35), to = base + up * (big ? 1.5 : 1.2);
      const blade = ph === 'windup' ? lerp(base - up * 0.6, from, w) : lerp(from, to, a);
      return { arm: blade + up * 0.15, blade, reach: a * 4 - settle * 4, lean: (big ? 0.14 : 0.08) * (a - w * 0.6) * up, twoHand: two };
    }
    case 'overhead': {
      const from = base - 2.4, to = base + 1.1;
      const blade = ph === 'windup' ? lerp(base - 1.0, from, w) : lerp(from, to, a);
      return { arm: blade, blade, reach: a * 6, lean: 0.18 * a - 0.12 * w * (1 - a), crouch: 4 * a * (1 - settle), twoHand: two };
    }
    case 'thrust': {
      const pull = ph === 'windup' ? -10 * w : ph === 'active' ? lerp(-10, 16, a) : lerp(16, 4, settle);
      return { arm: base, blade: base, reach: pull, lean: 0.1 * Math.max(0, pull) / 16, twoHand: two };
    }
    case 'spin': {
      const blade = ph === 'windup' ? base - 0.8 * w : base - 0.8 + a * PI * 2.2;
      return { arm: blade, blade, reach: 6 * a, lean: 0, twoHand: two };
    }
    case 'iai': {
      const blade = ph === 'windup' ? lerp(2.4, 2.7, w) : lerp(2.7, base - 0.35, a);
      return { arm: ph === 'windup' ? 2.2 : lerp(2.2, base, a), blade, reach: 12 * a, lean: 0.25 * a, crouch: 6 };
    }
    case 'stab': case 'stabB': {
      const p = ph === 'windup' ? -6 * w : ph === 'active' ? lerp(-6, 14, a) : lerp(14, 2, settle);
      if (anim === 'stab') return { arm: base, blade: base, reach: p, lean: 0.06, dual: true, backArm: 1.6, backBlade: -0.4 };
      return { arm: 1.5, blade: -0.3, reach: 0, lean: 0.06, dual: true, backArm: base, backBlade: base, backReach: p };
    }
    case 'cross': {
      const sweep = ph === 'windup' ? -1.1 * w : lerp(-1.1, 1.2, a);
      return { arm: base + sweep, blade: base + sweep, reach: 6 * a, lean: 0.1 * a, dual: true, backArm: base - sweep, backBlade: base - sweep, backReach: 6 * a };
    }
    // twin blades: the front blade and the back blade cut in turn, the idle one held ready
    case 'dslash': case 'dslashB': {
      const up = anim === 'dslashB' ? -1 : 1;
      const from = base - up * 1.4, to = base + up * 1.25;
      const sweep = ph === 'windup' ? lerp(base - up * 0.5, from, w) : lerp(from, to, a);
      if (anim === 'dslash') return { arm: sweep + up * 0.12, blade: sweep, reach: a * 5 - settle * 4, lean: 0.08 * (a - w * 0.5), dual: true, backArm: 1.6, backBlade: 0.6 };
      return { arm: 1.45, blade: 0.3, reach: 0, lean: 0.08 * (a - w * 0.5), dual: true, backArm: sweep - up * 0.1, backBlade: sweep, backReach: a * 6 - settle * 4 };
    }
    case 'twinSpin': {
      const spin = ph === 'windup' ? -0.7 * w : -0.7 + a * PI * 2.4;
      return { arm: base + spin, blade: base + spin, reach: 6 * a, lean: 0.1 * a, crouch: 3 * a, dual: true, backArm: base + spin + PI, backBlade: base + spin + PI, backReach: 6 * a };
    }
    case 'throw': {
      const blade = ph === 'windup' ? lerp(-0.4, -2.4, w) : lerp(-2.4, base + 0.4, a);
      return { arm: blade, blade, reach: 4 * a, lean: 0.1 * a, dual: true, backArm: blade + 0.3, backBlade: blade + 0.3 };
    }
    case 'cast': {
      const arm = ph === 'windup' ? lerp(1.2, base - 0.9, w) : lerp(base - 0.9, base - 0.2, a);
      return { arm, blade: ph === 'windup' ? -PI / 2 + 0.1 : lerp(-PI / 2 + 0.1, base - 0.5, a), reach: 8 * a, lean: 0.06 * a, glow: ph === 'windup' ? w : 1 - settle };
    }
    case 'castBig': {
      const arm = ph === 'windup' ? lerp(1.2, -1.5, w) : lerp(-1.5, base + 0.2, a);
      return { arm, blade: ph === 'windup' ? -PI / 2 : lerp(-PI / 2, base, a), reach: 4 * a, lean: -0.1 * w + 0.2 * a, crouch: 4 * a, twoHand: true, glow: 1 - settle };
    }
    case 'shoot': {
      const draw = ph === 'windup' ? 0.2 + 0.8 * w : ph === 'active' ? 1 - a : 0;
      return { arm: base, blade: base, reach: ph === 'recover' ? -3 * (1 - settle) : 0, lean: -0.04 * draw, bow: true, draw };
    }
    default: return { arm: base, blade: base, reach: 0, lean: 0 };
  }
}

// Full pose for the player this frame.
export function playerPose(p, time) {
  const type = p.wtype;
  const leg = p.moving ? Math.sin(p.walkT) * 0.55 : 0;
  const idle = idlePose(type, time, p.moving, leg);
  const toLocal = (dir) => (p.flip ? PI - dir : dir);
  let pose = idle;
  if (p.rush) pose = movePose(type, p.move?.def.anim || 'thrust', toLocal(p.rush.dir), 'active', 1);
  else if (p.move) {
    const m = p.move;
    const k = m.phase === 'windup' ? m.t / m.def.windup : m.phase === 'active' ? m.t / m.def.active : m.t / m.def.recover;
    pose = movePose(type, m.def.anim, toLocal(m.dir), m.phase, k);
    // blend back to the resting pose in the last part of the recover
    if (m.phase === 'recover' && k > 0.55) pose = blend(pose, idle, (k - 0.55) / 0.45);
  } else if (p.charging) {
    const aim = toLocal(p.chargeDir ?? p.facing);
    pose = chargePose(type, aim, Math.min(1, p.charge / type.chargeTime));
    pose.glow = p.chargeReady ? 1 : 0.4 * (p.charge / type.chargeTime);
  } else if (p.lunge) pose = movePose(type, 'thrust', toLocal(p.lunge.dir), 'active', 1);
  else if (p.spinT > 0) pose = movePose(type, 'spin', 0, 'active', 1 - p.spinT / 0.35);
  else if (p.act) {
    // v8: skill and ultimate casts borrow the attack animations (windup → strike → settle)
    const k = Math.min(1, p.act.t / (p.act.dur || 0.3));
    const ph = k < 0.3 ? 'windup' : k < 0.55 ? 'active' : 'recover';
    const kk = ph === 'windup' ? k / 0.3 : ph === 'active' ? (k - 0.3) / 0.25 : (k - 0.55) / 0.45;
    pose = movePose(type, p.act.anim || 'cast', toLocal(p.act.dir ?? p.facing), ph, kk);
    if (p.act.glow) pose.glow = 1;
    if (ph === 'recover' && kk > 0.5) pose = blend(pose, idle, (kk - 0.5) / 0.5);
  }
  // fill dual/bow flags from the weapon type so they never drop out mid-blend
  if (type.dual && pose.dual == null) { pose.dual = true; pose.backArm ??= idle.backArm; pose.backBlade ??= idle.backBlade; }
  if (type.id === 'bow') { pose.bow = true; pose.draw ??= 0; }
  if (type.twoHanded && pose.twoHand == null) pose.twoHand = true;
  return pose;
}

function angLerp(a, b, t) {
  let d = b - a;
  while (d > PI) d -= PI * 2;
  while (d < -PI) d += PI * 2;
  return a + d * t;
}

function blend(a, b, t) {
  const e = t * t * (3 - 2 * t);
  const out = { ...a };
  for (const k of ['arm', 'blade', 'backArm', 'backBlade']) if (a[k] != null && b[k] != null) out[k] = angLerp(a[k], b[k], e);
  for (const k of ['reach', 'lean', 'crouch', 'draw', 'glow', 'backReach']) out[k] = lerp(a[k] || 0, b[k] || 0, e);
  return out;
}
