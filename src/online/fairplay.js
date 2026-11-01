// Fair play: limits every client applies to what OTHER players report. A modified game can claim anything in a
// packet; these caps make sure a claim can never exceed what the strongest legitimate hero of that level could do.
//   atkCap(level)  — attack a hero of that level can reach with the best gear at +max, bloodline, pet and artifacts
//   POWER_CAP      — the strongest single hit any move or skill makes (after its own bonuses)
//   createHitGate  — at most N reported hits per second from one player (no packet floods)
import { ITEMS } from '../data/items.js';
import { BALANCE } from '../config/balance.js';
import { baseStats, upgradeMultiplier } from '../systems/stats.js';

const best = (cat, k) => Math.max(0, ...Object.values(ITEMS).filter((d) => d.category === cat).map((d) => d.stats?.[k] || 0));
const GEAR_ATK = (best('weapon', 'atk') + best('armor', 'atk') + best('charm', 'atk')) * upgradeMultiplier(BALANCE.upgrade.maxLevel);
export const ATK_PCT_CAP = 2.3;          // bloodline + pet + artifacts + STR points + buffs, generously rounded up
export const POWER_CAP = 14;
export const CRIT_CAP = 0.75;
export const CRIT_MULT_CAP = 5;

export function atkCap(level) {
  const lv = Math.max(1, Math.min(BALANCE.player.maxLevel, Number(level) || BALANCE.player.maxLevel));
  return Math.ceil((baseStats(lv).atk + GEAR_ATK) * ATK_PCT_CAP);
}

export function createHitGate(max = 12, windowMs = 1000) {
  const seen = new Map();     // peer → timestamps
  return {
    allow(peer, now = Date.now()) {
      const list = (seen.get(peer) || []).filter((t) => now - t < windowMs);
      if (list.length >= max) { seen.set(peer, list); return false; }
      list.push(now); seen.set(peer, list);
      return true;
    },
    reset() { seen.clear(); },
  };
}

// The hero's own stats sanity (used when a save is loaded or before stats go out to others).
export function plausibleStats(stats, level) {
  return stats.atk <= atkCap(level) && stats.crit <= CRIT_CAP + 1e-9 && stats.critMult <= CRIT_MULT_CAP;
}
