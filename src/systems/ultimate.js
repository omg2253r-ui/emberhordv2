// Which ultimate a weapon carries. It is decided by the weapon itself — its rarity, its type and the moment it was
// found (the hero's save and the weapon's own number) — so the same weapon always has the same ultimate, nobody can
// re-roll it by reloading, and an edited save cannot pick one (the result is recomputed, never stored).
//
// How hard the gauge is to fill (data/ultimates.js ULT_NEED), and why:
//   Farming: a hero lands about 2–3 blows a second. Monsters give 1 a blow, bosses 2, a perfect dodge or parry 5.
//   A tier-1 ultimate (70) comes about once a room; a tier-3 (130) roughly once per boss fight (≈25 s of hitting a
//   boss); a tier-5 (220) about once per zone run, and the secret tier (280) is a run's one big moment.
//   PvP: rounds are short and blows rarer (≈1 landed a second). A blow that lands gives 4, a blow taken 2 (so the
//   one being beaten can turn it around), a parry or perfect dodge 6. A tier-1 (50) is ready around 12 s into a round,
//   a tier-3 (90) after ~20 s, a tier-5 (160) late in the first round or early in the second — the gauge carries over
//   between rounds of the same match, so the strongest ultimates are a match's climax rather than an opener.
import { getItem } from '../data/items.js';
import { ULTIMATES, ULT_IDS, ULT_NEED, ULT_TIERS, ultsOfTier, getUlt } from '../data/ultimates.js';

export const ULT_CHANCE = Object.freeze({ common: 0, uncommon: 0.08, rare: 0.2, epic: 0.4, legendary: 0.7, mythic: 1 });
const TIER_W = Object.freeze({
  uncommon: [70, 30, 0, 0, 0], rare: [45, 35, 20, 0, 0], epic: [22, 30, 30, 18, 0], legendary: [0, 18, 34, 30, 18], mythic: [0, 0, 25, 40, 35],
});
// the secret tier: only for the lucky
export const SECRET_CHANCE = Object.freeze({ common: 0, uncommon: 0, rare: 0.0005, epic: 0.0015, legendary: 0.004, mythic: 0.012 });

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFrom(seed) {
  let a = seed || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fits = (u, wtype) => !u.wt || u.wt.includes(wtype);

// The ultimate of one weapon instance { uid, id } in this hero's save (null = the weapon has none).
export function ultOf(state, inst) {
  const def = inst && getItem(inst.id);
  if (!def || def.category !== 'weapon') return null;
  const rnd = rngFrom(hash(`${state?.createdAt || 0}:${inst.uid}:${def.id}`));
  if (def.secretUlt) { const list = ultsOfTier(6); return list[Math.floor(rnd() * list.length)]; }
  const chance = ULT_CHANCE[def.rarity] || 0;
  if (!(rnd() < chance)) return null;
  if (rnd() < (SECRET_CHANCE[def.rarity] || 0)) { const list = ultsOfTier(6); return list[Math.floor(rnd() * list.length)]; }
  const w = TIER_W[def.rarity] || TIER_W.uncommon;
  let roll = rnd() * w.reduce((a, b) => a + b, 0), tier = 1;
  for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll < 0) { tier = i + 1; break; } }
  for (let t = tier; t >= 1; t--) {
    const list = ultsOfTier(t).filter((id) => fits(ULTIMATES[id], def.wtype));
    if (list.length) return list[Math.floor(rnd() * list.length)];
  }
  return null;
}
export const equippedUlt = (state) => ultOf(state, state?.equipment?.weapon);
export const ultNeed = (id, pvp = false) => { const u = getUlt(id); return u ? ULT_NEED[pvp ? 'pvp' : 'pve'][u.tier] : 0; };
export const tierOf = (id) => ULT_TIERS[getUlt(id)?.tier || 1];
// how many of each tier a weapon of this rarity can roll (for the codex and tooltips)
export function ultOdds(rarity) {
  const c = ULT_CHANCE[rarity] || 0, w = TIER_W[rarity];
  if (!c || !w) return null;
  const sum = w.reduce((a, b) => a + b, 0);
  return { chance: c, tiers: w.map((x) => x / sum) };
}
export { ULT_IDS };
