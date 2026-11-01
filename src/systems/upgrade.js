// Equipment upgrading at the forge.
// Rules: cost is paid on every attempt; on success level +1; on failure the level stays the same, except from
// +12 up (v8; +15 in v7) where a failure drops the item one level (never destroyed). Odds and the risk are shown before each attempt.
import { BALANCE } from '../config/balance.js';
import { getItem, isEquipment } from '../data/items.js';
import { cloneState } from '../core/state.js';
import { countItem, removeInPlace } from './inventory.js';
import { findInstance } from './equipment.js';
import { itemStats } from './stats.js';

export function upgradeCost(instance) {
  const def = instance && getItem(instance.id);
  if (!isEquipment(def)) return null;
  const u = BALANCE.upgrade;
  const L = instance.lvl || 0;
  if (L >= u.maxLevel) return null;
  const band = u.materials.find((b) => L >= b.minLevel && L <= b.maxLevel);
  const offset = L - band.minLevel;
  return {
    fromLevel: L,
    toLevel: L + 1,
    gold: Math.round(u.goldBase[def.rarity] * (1 + L * u.goldGrowth)),
    materials: band.items.map((m) => ({ id: m.id, qty: m.base + m.perLevel * offset })),
    successRate: u.successRate[L],
    downgrade: L >= (u.downgradeFrom ?? Infinity),
  };
}

// What the player is missing for the next attempt (empty list = can attempt).
export function missingFor(state, cost) {
  const missing = [];
  if (state.gold < cost.gold) missing.push({ id: 'gold', need: cost.gold, have: state.gold });
  for (const m of cost.materials) {
    const have = countItem(state, m.id);
    if (have < m.qty) missing.push({ id: m.id, need: m.qty, have });
  }
  return missing;
}

export function previewUpgrade(state, uid) {
  const found = findInstance(state, uid);
  if (!found) return { ok: false, reason: 'not_found' };
  const cost = upgradeCost(found.instance);
  if (!cost) return { ok: false, reason: isEquipment(getItem(found.instance.id)) ? 'max_level' : 'not_equipment' };
  return {
    ok: true,
    cost,
    missing: missingFor(state, cost),
    before: itemStats(found.instance),
    after: itemStats({ ...found.instance, lvl: cost.toLevel }),
  };
}

// Atomic: either everything is paid and the roll applied, or nothing changes.
export function attemptUpgrade(state, uid, rng) {
  const p = previewUpgrade(state, uid);
  if (!p.ok) return p;
  if (p.missing.length) return { ok: false, reason: 'missing_resources', missing: p.missing };
  const next = cloneState(state);
  next.gold -= p.cost.gold;
  for (const m of p.cost.materials) {
    const r = removeInPlace(next, m.id, m.qty);
    if (!r.ok) return { ok: false, reason: 'missing_resources' }; // cannot happen after missingFor, kept as guard
  }
  const success = rng.next() < p.cost.successRate;
  const inst = findInstance(next, uid).instance;
  let dropped = false;
  if (success) { inst.lvl = p.cost.toLevel; next.stats.upgradesWon += 1; }
  else { next.stats.upgradesLost += 1; if (p.cost.downgrade) { inst.lvl = Math.max(0, inst.lvl - 1); dropped = true; } }
  return { ok: true, success, dropped, state: next, cost: p.cost, before: p.before, after: success ? p.after : dropped ? itemStats(inst) : p.before };
}
