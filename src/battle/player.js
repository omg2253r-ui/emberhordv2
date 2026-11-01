// The hunter: movement, weapon combos (tap), charged attacks (hold), dodge charges with dodge-cancel,
// dodge attacks and perfect dodges. Moves come from data/weapons.js; hits are resolved in battle/moves.js.
import { BALANCE } from '../config/balance.js';
import { getWeaponType, movesetFor, canDodgeCancel } from '../data/weapons.js';
import { getItem } from '../data/items.js';
import { createCooldown, cooldownTick } from '../systems/combat.js';
import { startMove, resolveMove, updateRush, aimDirection } from './moves.js';
import { createGuardState, updateGuard, guardHit, GUARD } from './guard.js';
import { tickBuffs, buffOf } from './buffs.js';
import { fireCounter, shieldBroke } from './skillCast.js';
import { elOf, hexA } from './skillVfx.js';

export { aimDirection };

const C = BALANCE.combat;

export function createPlayer(stats, x, y) {
  const D = C.dash;
  return {
    x, y, vx: 0, vy: 0, r: BALANCE.player.radius,
    stats, hp: stats.maxHp, maxHp: stats.maxHp,
    wtype: stats.weaponId && getItem(stats.weaponId)?.moves ? movesetFor(getItem(stats.weaponId)) : getWeaponType(stats.wtype),
    facing: 0, flip: false,
    move: null, comboStep: -1, comboTimer: 0, buffered: false,
    holdT: 0, charge: 0, charging: false, chargeReady: false, chargeDir: null,
    dodges: D.charges, dodgeMax: D.charges, dodgeRefill: 0,
    dashT: 0, dashMax: D.duration, dashDx: 0, dashDy: 0, sinceDash: 99, dashAttackUsed: true, blink: false,
    perfectT: 0, perfectUsed: false, empowerT: 0,
    potionCd: createCooldown(C.potion.cooldown),
    iframes: 0, flash: 0, dead: false, deathT: 0, walkT: 0, moving: false, swings: 0,
    shield: 0, shieldMax: 0, shieldT: 0, lunge: null, rush: null, spinT: 0,
    buffs: { focusT: 0, stoneT: 0, bloomT: 0, ashT: 0, blessT: 0, bless: 0 },
    ghosts: [], ghostT: 0, trail: [],
    moveCounts: { combo: 0, charged: 0, dash: 0 },
    guard: createGuardState(),
  };
}

export function applyStats(player, stats) {
  const ratio = player.hp / player.maxHp;
  player.stats = stats;
  player.maxHp = stats.maxHp;
  player.hp = Math.max(1, Math.round(stats.maxHp * ratio));
}

// Attack-speed multiplier from buffs (race "focus").
export function hasteOf(p) {
  return 1 + (p.buffs.focusT > 0 ? 0.3 : 0) + buffOf(p, 'haste');
}

function startDash(p, intent, world) {
  const D = C.dash;
  let dx = intent.mx, dy = intent.my;
  if (Math.hypot(dx, dy) < 0.2) { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
  const l = Math.hypot(dx, dy) || 1;
  p.dashDx = dx / l; p.dashDy = dy / l;
  p.blink = p.wtype.dodge === 'blink';
  p.dashMax = p.blink ? D.blinkDuration : D.duration;
  p.dashT = p.dashMax;
  p.iframes = Math.max(p.iframes, p.dashMax + 0.06);
  p.perfectT = D.perfectWindow + (p.stats.perfectBonus || 0);
  p.perfectUsed = false;
  p.sinceDash = 0; p.dashAttackUsed = false;
  if (p.dodges === p.dodgeMax) p.dodgeRefill = D.cooldown * (p.stats.dashCdMult || 1);
  p.dodges -= 1;
  // dodge-cancel: drop whatever the hero was doing
  p.move = null; p.buffered = false; p.charging = false; p.charge = 0; p.chargeReady = false; p.holdT = 0;
  if (Math.abs(p.dashDx) > 0.15) p.flip = p.dashDx < 0;
  p.facing = Math.atan2(p.dashDy, p.dashDx);
  world.onPlayerDash(p.blink);
}

export function updatePlayer(p, intent, dt, world) {
  const D = C.dash;
  cooldownTick(p.potionCd, dt);
  if (p.iframes > 0) p.iframes -= dt;
  if (p.flash > 0) p.flash -= dt * 5;
  if (p.comboTimer > 0) { p.comboTimer -= dt; if (p.comboTimer <= 0 && !p.move) p.comboStep = -1; }
  if (p.spinT > 0) p.spinT -= dt;
  if (p.perfectT > 0) p.perfectT -= dt;
  if (p.empowerT > 0) p.empowerT -= dt;
  if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
  for (const k of ['focusT', 'stoneT', 'bloomT', 'ashT', 'blessT']) if (p.buffs[k] > 0) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
  tickBuffs(p, dt);
  // v8 skill side effects: rooted / slowed / exposed after some casts, a counter stance, a cast pose
  if (p.rootT > 0) p.rootT -= dt;
  if (p.flawSlowT > 0) p.flawSlowT -= dt;
  if (p.exposeT > 0) p.exposeT -= dt;
  if (p.counterT > 0) p.counterT -= dt;
  if (p.act) { p.act.t += dt; if (p.act.t >= p.act.dur) p.act = null; }
  if (p.stats.lowHpRegen > 0 && !p.dead && p.hp < p.maxHp * 0.3) {
    p.lowRegenAcc = (p.lowRegenAcc || 0) + p.maxHp * p.stats.lowHpRegen * dt;
    if (p.lowRegenAcc >= 1) { const n = Math.floor(p.lowRegenAcc); p.lowRegenAcc -= n; p.hp = Math.min(p.maxHp, p.hp + n); }
  }
  p.sinceDash += dt;
  // dodge charges refill one at a time
  if (p.dodges < p.dodgeMax) {
    p.dodgeRefill -= dt;
    if (p.dodgeRefill <= 0) { p.dodges += 1; p.dodgeRefill = p.dodges < p.dodgeMax ? D.cooldown * (p.stats.dashCdMult || 1) : 0; }
  }
  // afterimages fade
  for (let i = p.ghosts.length - 1; i >= 0; i--) { p.ghosts[i].t -= dt; if (p.ghosts[i].t <= 0) p.ghosts.splice(i, 1); }
  if (p.dead) { p.deathT += dt; return; }

  // --- guard / parry: a broken guard or a parried attacker is stuck for a moment
  if (updateGuard(p, intent, dt, world)) {
    p.move = null; p.buffered = false; p.charging = false; p.charge = 0; p.chargeReady = false;
    p.vx *= Math.max(0, 1 - dt * 8); p.vy *= Math.max(0, 1 - dt * 8);
    p.x += p.vx * dt; p.y += p.vy * dt; world.clampBody?.(p);
    p.moving = false;
    return;
  }

  // --- skill lunge / rush moves: committed dashes that hit everything they pass
  if (p.lunge) { updateLunge(p, dt, world); return; }
  if (p.rush) {
    if (!updateRush(p, dt, world)) { p.rush = null; finishActive(p, world); }
    p.moving = true; p.walkT += dt * 14;
    return;
  }

  if (intent.potion) world.usePotion();

  // --- dodge (and dodge-cancel)
  if (intent.dash && p.dodges > 0 && p.dashT <= 0 && !(p.rootT > 0) && canDodgeCancel(p.wtype, p.move?.phase)) startDash(p, intent, world);

  // --- attack input: tap = combo, attack during/after a dodge = dodge attack, hold = charge
  const haste = hasteOf(p);
  if (intent.attack && p.guard.guarding) p.guard.guarding = false;      // attacking lowers the shield (a counter if the window is open)
  if (intent.attack) {
    p.swings += 1;
    // dodge attack: during the dodge, or within a short window after it ends
    const dashAttack = !p.dashAttackUsed && (p.dashT > 0 || p.sinceDash < p.dashMax + C.attack.dashAttackWindow) && (!p.move || p.move.kind === 'combo' && p.move.phase === 'windup');
    if (dashAttack) {
      p.dashAttackUsed = true; p.dashT = 0;
      startMove(p, 'dash', 0, intent, world);
    } else if (!p.move) {
      const len = p.wtype.combo.length;
      // a beat of rhythm (not a mash) after the 2nd hit or later opens the weapon's branch finisher
      const waited = C.attack.comboWindow - p.comboTimer;
      if (p.wtype.branch && p.comboTimer > 0 && p.comboStep >= 1 && waited >= C.attack.branchDelay) startMove(p, 'branch', 0, intent, world);
      else {
        const step = p.comboTimer > 0 && p.comboStep >= 0 ? (p.comboStep + 1) % len : 0;
        startMove(p, 'combo', step, intent, world);
      }
    } else p.buffered = true;
    p.holdT = 0;
  }
  if (intent.attackHeld && !p.move && p.dashT <= 0) {
    p.holdT += dt;
    if (p.holdT >= C.attack.chargeDelay) {
      if (!p.charging) { p.charging = true; p.charge = 0; world.onChargeStart?.(); }
      p.charge += dt * haste;
      p.chargeDir = aimDirection(p, intent, world, p.wtype.ranged ? 600 : undefined);
      if (!p.chargeReady && p.charge >= p.wtype.chargeTime) { p.chargeReady = true; world.onChargeReady?.(); }
    }
  } else if (!intent.attackHeld) {
    if (p.charging && p.chargeReady && !p.move) startMove(p, 'charged', 0, intent, world);
    p.charging = false; p.charge = 0; p.chargeReady = false; p.holdT = 0;
  }

  // --- current move
  if (p.move) updateMove(p, dt * haste, intent, world);

  // --- movement
  const moveMult = p.guard.guarding ? GUARD.moveMult : p.move ? p.wtype.moveMult : p.charging ? 0.5 : 1;
  if (p.dashT > 0) {
    p.dashT -= dt;
    const mult = p.blink ? D.blinkSpeedMult : D.speedMult;
    p.vx = p.dashDx * p.stats.speed * mult;
    p.vy = p.dashDy * p.stats.speed * mult;
    p.ghostT -= dt;
    if (p.ghostT <= 0) { p.ghostT = 0.035; p.ghosts.push({ x: p.x, y: p.y, flip: p.flip, t: 0.22, max: 0.22, walkT: p.walkT }); }
    if (p.blink) world.particles.spawn({ x: p.x + (Math.random() - 0.5) * 20, y: p.y - 30 + (Math.random() - 0.5) * 40, vx: 0, vy: -30, life: 0.35, size: 4, size2: 0.5, color: Math.random() < 0.5 ? '#ffd08a' : '#ff8a3d', drag: 2, glow: true });
    else if (Math.random() < 0.8) world.particles.spawn({ x: p.x + (Math.random() - 0.5) * 16, y: p.y - 10, vx: -p.vx * 0.1, vy: -p.vy * 0.1, life: 0.3, size: 7, size2: 1, color: 'rgba(243,230,200,0.55)', drag: 6 });
    if (p.dashT <= 0) { p.vx *= 0.35; p.vy *= 0.35; }
  } else if (p.move && p.move.stepLeft > 0 && p.move.phase !== 'recover') {
    // committed forward step of the attack (snappy, eases out)
    const v = p.move.stepSpeed;
    p.vx = Math.cos(p.move.dir) * v + intent.mx * p.stats.speed * moveMult * 0.3;
    p.vy = Math.sin(p.move.dir) * v + intent.my * p.stats.speed * moveMult * 0.3;
    p.move.stepLeft -= v * dt;
  } else {
    const speed = p.rootT > 0 ? 0 : p.stats.speed * moveMult * (1 + buffOf(p, 'speed')) * (p.flawSlowT > 0 ? p.flawSlow || 1 : 1);
    const tx = intent.mx * speed, ty = intent.my * speed;
    const k = Math.min(1, dt * (Math.hypot(intent.mx, intent.my) > 0.1 ? 16 : 11));
    p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (world.clampBody) world.clampBody(p);
  else {
    const m = 34;
    p.x = Math.max(m, Math.min(world.arena.w - m, p.x));
    p.y = Math.max(m + 20, Math.min(world.arena.h - m, p.y));
  }
  p.moving = Math.hypot(p.vx, p.vy) > 30;
  if (p.moving) p.walkT += dt * (8 + Math.hypot(p.vx, p.vy) / 120);
  if (!p.move && !p.charging && Math.hypot(intent.mx, intent.my) > 0.2 && p.dashT <= 0) {
    p.facing = Math.atan2(intent.my, intent.mx);
    if (Math.abs(intent.mx) > 0.15) p.flip = intent.mx < 0;
  }
}

function updateMove(p, dt, intent, world) {
  const m = p.move, d = m.def;
  m.t += dt;
  if (m.phase === 'windup' && m.t >= d.windup) {
    m.phase = 'active'; m.t -= d.windup;
    resolveMove(p, world);
    if (p.rush) return;
  }
  if (m.phase === 'active' && m.t >= d.active) finishActive(p, world);
  if (p.move && p.move.phase === 'recover') {
    const canChain = m.kind === 'combo' || m.kind === 'dash' || m.kind === 'branch';
    if (p.buffered && canChain && m.t >= d.recover * d.cancel) {
      p.buffered = false;
      const len = p.wtype.combo.length;
      const step = m.kind === 'combo' ? (m.step + 1) % len : 0;
      startMove(p, 'combo', step, intent, world);
      return;
    }
    if (m.t >= d.recover) {
      p.move = null;
      if (m.kind === 'combo' && m.step < p.wtype.combo.length - 1) { p.comboStep = m.step; p.comboTimer = C.attack.comboWindow; }
      else if (m.kind === 'dash' || m.kind === 'branch') { p.comboStep = -1; p.comboTimer = 0; }
      else { p.comboStep = -1; p.comboTimer = 0; }
      if (p.buffered) { p.buffered = false; startMove(p, 'combo', p.comboStep >= 0 ? p.comboStep + 1 : 0, intent, world); }
    }
  }
}

function finishActive(p) {
  if (!p.move) return;
  p.move.phase = 'recover'; p.move.t = 0;
}

function updateLunge(p, dt, world) {
  const L = p.lunge;
  L.t -= dt;
  p.vx = Math.cos(L.dir) * L.speed; p.vy = Math.sin(L.dir) * L.speed;
  p.x += p.vx * dt; p.y += p.vy * dt;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || L.hit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r + 26) continue;
    L.hit.add(e);
    world.playerStrike(e, L.power, { kx: Math.cos(L.dir) * 260, ky: Math.sin(L.dir) * 260, src: 'skill' });
  }
  world.particles.spawn({ x: p.x, y: p.y - 30, vx: -p.vx * 0.05, vy: -p.vy * 0.05, life: 0.3, size: 9, size2: 1, color: L.el ? hexA(elOf(L.el).glow, 0.6) : 'rgba(255,170,90,0.6)', drag: 6, glow: true });
  world.clampBody?.(p);
  if (L.t <= 0) { p.lunge = null; p.vx *= 0.2; p.vy *= 0.2; }
  p.moving = true; p.walkT += dt * 14;
}

// True when an attack meets the first moments of a dodge (or a dash-through move): a perfect dodge.
export function inPerfectWindow(p) {
  return !p.dead && p.iframes > 0 && p.perfectT > 0 && (p.dashT > 0 || !!p.rush) && !p.perfectUsed;
}

// Damage to the hero. Returns true when it landed. opts: { unblockable, attacker } — attacker gets staggered by a parry.
export function damagePlayer(p, amount, kx, ky, world, opts = {}) {
  if (p.dead || p.iframes > 0) return false;
  // a counter stance (skills) turns the blow into a blast
  if (p.counterT > 0 && !opts.tick) { p.iframes = Math.max(p.iframes, 0.4); fireCounter(world, p); return false; }
  if (p.exposeT > 0) amount = Math.round(amount * (1 + (p.expose || 0)));
  if (p.stats.dmgTaken) amount = Math.max(1, Math.round(amount * (1 + p.stats.dmgTaken)));
  // a pet's ward charm cancels the hit outright
  if (p.ward > 0 && !opts.unblockableWard) {
    p.ward -= 1; p.iframes = Math.max(p.iframes, 0.35);
    world.fx.callout?.(p.x, p.y - 110, 'กำบัง!', '#e8d8b0'); world.fx.ring(p.x, p.y - 30, 30, 70, '#e8d8b0', 0.4, 5);
    world.sfx?.('block');
    return false;
  }
  const gh = guardHit(p, amount, kx, ky, opts);
  if (gh.kind === 'parry') {
    p.iframes = Math.max(p.iframes, 0.22);
    world.onParry?.(opts.attacker || null);
    return false;
  }
  if (gh.kind === 'block' || gh.kind === 'break') {
    amount = gh.amount; kx *= 0.25; ky *= 0.25;
    if (gh.kind === 'break') world.onGuardBreak?.(); else world.onBlock?.();
  }
  if (p.buffs.stoneT > 0) { amount = Math.max(1, Math.round(amount * (1 - (world.raceSkill?.v.reduce || 0.6)))); kx = 0; ky = 0; }
  const red = buffOf(p, 'reduce');
  if (red > 0) amount = Math.max(1, Math.round(amount * (1 - red)));
  // thorns (pets): melee attackers get hurt back
  if (p.stats.thorns > 0 && opts.attacker && !opts.attacker.dead && opts.attacker.hp != null && Math.hypot(opts.attacker.x - p.x, opts.attacker.y - p.y) < 220) world.petStrike?.(opts.attacker, p.stats.thorns, { thorns: true });
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed; amount -= absorbed;
    world.fx.number(p.x, p.y - 84, `โล่ −${absorbed}`, 'info');
    if (p.shield <= 0 && p.shieldNova) shieldBroke(world, p);
    if (amount <= 0) { p.iframes = C.hurtIFrames * 0.5; return true; }
  }
  p.hp = Math.max(0, p.hp - amount);
  p.iframes = C.hurtIFrames; p.flash = 1;
  // super armor: heavy weapons keep swinging instead of being shoved
  const armored = p.wtype.armor && p.move && p.move.phase !== 'recover';
  if (!armored) {
    p.vx += kx; p.vy += ky;
    if (p.move && p.move.phase === 'windup') { p.move = null; p.buffered = false; }
    p.charging = false; p.charge = 0; p.chargeReady = false;
  }
  world.fx.number(p.x, p.y - 70, amount, 'player');
  if (p.hp <= 0 && p.stats.lastStand && !world.lastStandUsed) {
    world.lastStandUsed = true;
    p.hp = 1; p.iframes = 1.5;
    world.onLastStand?.();
    return true;
  }
  // phoenix pet: once per dungeon the hero rises again at half health
  if (p.hp <= 0 && p.rebirth && !world.rebirthUsed) {
    world.rebirthUsed = true;
    p.hp = Math.round(p.maxHp * 0.5); p.iframes = 2;
    world.fx.callout?.(p.x, p.y - 130, 'เถ้าคืนชีพ!', '#ffcf5a');
    world.fx.ring(p.x, p.y - 30, 20, 160, '#ffcf5a', 0.7, 10);
    world.particles?.burst(p.x, p.y - 40, 40, { color: ['#ffcf5a', '#ff7a33', '#fff3c4'], speedMin: 80, speedMax: 300, life: 0.8, size: 4, drag: 2, grav: -120, glow: true });
    world.sfx?.('levelup');
    return true;
  }
  if (p.hp <= 0) { p.dead = true; p.deathT = 0; p.move = null; world.onPlayerDeath(); }
  return true;
}
