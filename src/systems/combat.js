// Pure combat math. No rendering, no timers here.
import { BALANCE } from '../config/balance.js';

export function defenseMultiplier(def) {
  const k = BALANCE.combat.defenseK;
  return k / (k + Math.max(0, def || 0));
}

// attacker: { atk, crit?, critMult?, forceCrit? }  defender: { def }
// Returns { amount, crit }. `mult` scales the hit (combo finisher, boss slam, ...).
export function computeDamage(attacker, defender, rng, mult = 1) {
  const c = BALANCE.combat;
  const variance = 1 + (rng.next() * 2 - 1) * c.variance;
  let raw = Math.max(0, attacker.atk) * mult * variance;
  const roll = rng.next();
  const crit = !!attacker.forceCrit || (!!attacker.crit && roll < Math.min(c.critChanceCap, attacker.crit));
  if (crit) raw *= attacker.critMult || 1.5;
  const amount = Math.max(c.minDamage, Math.round(raw * defenseMultiplier(defender.def)));
  return { amount, crit };
}

// Expected (average) damage, for UI previews.
export function expectedDamage(attacker, defender, mult = 1) {
  const critPart = 1 + Math.min(BALANCE.combat.critChanceCap, attacker.crit || 0) * ((attacker.critMult || 1.5) - 1);
  return Math.max(BALANCE.combat.minDamage, attacker.atk * mult * critPart * defenseMultiplier(defender.def));
}

// Is `target` inside a swing arc? Angles in radians, positions in world px.
export function inArc(ox, oy, facing, range, arcRad, tx, ty, tRadius = 0) {
  const dx = tx - ox, dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist - tRadius > range) return false;
  if (dist < tRadius + 6) return true; // overlapping: always hits
  let d = Math.atan2(dy, dx) - facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const slack = Math.asin(Math.min(1, tRadius / Math.max(dist, 1)));
  return Math.abs(d) <= arcRad / 2 + slack;
}

// Cooldown helper (data only; the battle loop ticks it).
export function createCooldown(duration) {
  return { duration, left: 0 };
}
export function cooldownReady(cd) { return cd.left <= 0; }
export function cooldownStart(cd, duration = cd.duration) { cd.left = duration; }
export function cooldownTick(cd, dt) { if (cd.left > 0) cd.left = Math.max(0, cd.left - dt); }

// Damage bonus from the current combo count (BALANCE.combat.combo.tiers).
export function comboBonus(n) {
  let b = 0;
  for (const t of BALANCE.combat.combo.tiers) if (n >= t.at) b = t.bonus;
  return b;
}
