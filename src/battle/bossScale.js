// v9.2 — บอสตีแรงขึ้นตามความสามารถของผู้เล่น (เลือดบอสไม่ถูกแตะ)
//
// The harder a hero is (attack × crit, health and armour together), the harder a boss hits that hero. Only the boss's
// DAMAGE changes: its health, its armour and the damage the hero deals to it stay exactly as before.
//
//   power   = sqrt( attack-per-hit × effective-health )          effective-health = maxHp ÷ defence multiplier
//   ref     = the same number for a hero with no gear at the content's own level (baseStats(level))
//   k       = (power ÷ ref) ^ EXPONENT, never below 1 (a weaker hero meets the v9.1 numbers) and never above CAP
//
// A hero in gear that fits the land lands at about ×1.2–×1.3; a hero far past the land (high level, +20 gear, full
// attributes) is pushed towards CAP. One blow can never take more than HIT_SHARE of max HP *because of* this scaling.
// Everything tunable is here; the battle scenes only call bossHitScale().
import { BALANCE } from '../config/balance.js';
import { baseStats } from '../systems/stats.js';
import { defenseMultiplier } from '../systems/combat.js';

export const BOSS_SCALE = Object.freeze({
  exponent: 0.5,      // how fast damage follows power
  cap: 3.0,           // highest multiplier
  hitShare: 0.5,      // the scaled part of one hit never lifts it above this share of max HP
});

// one number for "how able is this hero" (also shown nowhere in the UI, only used for the boss multiplier)
export function heroPower(s) {
  if (!s) return 0;
  const crit = Math.min(BALANCE.combat.critChanceCap, s.crit || 0);
  const offence = Math.max(1, s.atk || 1) * (1 + crit * Math.max(0, (s.critMult || 1.5) - 1));
  const hp = Math.max(1, s.maxHp ?? s.hp ?? 1);
  return Math.sqrt(offence * (hp / defenseMultiplier(s.def || 0)));
}

// the power of a hero who wears nothing but the level's own stats, at the level of the content being fought
export function levelReference(level) {
  const b = baseStats(Math.max(1, Math.round(level || 1)));
  return heroPower({ atk: b.atk, crit: b.crit, critMult: b.critMult, maxHp: b.hp, def: b.def });
}

// the multiplier on a boss's damage against this hero (1 = unchanged)
export function bossScaleFor(stats, contentLevel) {
  const ref = levelReference(contentLevel);
  if (!(ref > 0)) return 1;
  const r = heroPower(stats) / ref;
  const k = Math.pow(Math.max(1, r), BOSS_SCALE.exponent);
  return Math.min(BOSS_SCALE.cap, Math.max(1, k));
}

// apply it to one blow that has already been computed (amount after armour). `owner` is whoever hit; only bosses scale.
export function bossHitScale(amount, owner, stats, maxHp, contentLevel) {
  if (!owner || !owner.type || !owner.type.boss) return amount;
  const k = bossScaleFor(stats, contentLevel);
  if (k <= 1.0001) return amount;
  const scaled = Math.round(amount * k);
  // the scaling alone never takes more than hitShare of max HP in one blow (a blow that was already bigger stays as it was)
  return Math.max(amount, Math.min(scaled, Math.round(maxHp * BOSS_SCALE.hitShare)));
}
