// Buying and selling. Every transaction validates first and only then mutates a cloned state.
import { BALANCE } from '../config/balance.js';
import { SHOP_STOCK } from '../data/shop.js';
import { getItem, isEquipment } from '../data/items.js';
import { rarityOf, RARITIES } from '../data/rarity.js';
import { cloneState } from '../core/state.js';
import { addInPlace, canAdd, removeSlotInPlace, REASONS } from './inventory.js';

export function stockEntry(itemId, stock = SHOP_STOCK) {
  return stock.find((s) => s.itemId === itemId) || null;
}

export function isStockUnlocked(state, entry) {
  return !entry.requires || !!state.progress.cleared[entry.requires];
}

export function buy(state, itemId, qty = 1, stock = SHOP_STOCK) {
  const entry = stockEntry(itemId, stock);
  if (!entry || !getItem(itemId)) return { ok: false, reason: REASONS.UNKNOWN_ITEM };
  if (!Number.isInteger(qty) || qty <= 0 || qty > 99) return { ok: false, reason: REASONS.BAD_QTY };
  if (!isStockUnlocked(state, entry)) return { ok: false, reason: 'locked' };
  const cost = entry.price * qty;
  if (state.gold < cost) return { ok: false, reason: 'not_enough_gold', cost };
  if (!canAdd(state, itemId, qty)) return { ok: false, reason: REASONS.FULL };
  const next = cloneState(state);
  next.gold -= cost;
  const r = addInPlace(next, itemId, qty);
  if (!r.ok) return r; // defensive: canAdd already checked
  return { ok: true, state: next, cost };
}

// Gold the forge charges for one attempt on every level below `lvl` (the nominal price of getting a piece to +lvl).
// Mirrors upgradeCost() in upgrade.js; kept here so selling does not depend on the forge module.
export function forgeGoldSpent(rarity, lvl) {
  const u = BALANCE.upgrade, base = u.goldBase[rarity] || 0;
  let sum = 0;
  for (let L = 0; L < Math.min(lvl | 0, u.maxLevel); L++) sum += Math.round(base * (1 + L * u.goldGrowth));
  return sum;
}

// Equipment: base price of its tier, +50% of it per upgrade level (as before), plus (v9.3.1) a share of the forge gold
// already put into the piece — so enhancing is never wasted and a higher + always sells for more than before.
// Everything else sells at its listed price.
export function sellPrice(instance) {
  const def = instance && getItem(instance.id);
  if (!def) return 0;
  if (isEquipment(def)) {
    const e = BALANCE.economy;
    const lvl = Math.max(0, instance.lvl | 0);
    return Math.round(e.sellEquipBase[def.rarity] * (1 + e.sellUpgradeBonus * lvl) + e.sellRefundRate * forgeGoldSpent(def.rarity, lvl));
  }
  return def.sellPrice || 0;
}

export function sell(state, uid, qty = null) {
  const slot = state.inventory.slots.find((s) => s.uid === uid);
  if (!slot) return { ok: false, reason: REASONS.NOT_FOUND };
  if (slot.locked) return { ok: false, reason: 'locked' };   // v8.5.1 ★
  const take = qty == null ? slot.qty : qty;
  if (!Number.isInteger(take) || take <= 0 || take > slot.qty) return { ok: false, reason: REASONS.BAD_QTY };
  const each = sellPrice(slot);
  if (each <= 0) return { ok: false, reason: 'unsellable' };
  const next = cloneState(state);
  const r = removeSlotInPlace(next, uid, take);
  if (!r.ok) return r;
  const earned = each * take;
  next.gold += earned;
  return { ok: true, state: next, earned };
}

// Sells many inventory slots at once (whole stacks). All-or-nothing: if any uid is bad, nothing changes.
export function sellMany(state, uids) {
  const list = [...new Set(uids || [])];
  if (!list.length) return { ok: false, reason: REASONS.NOT_FOUND };
  let earned = 0, count = 0;
  for (const uid of list) {
    const slot = state.inventory.slots.find((s) => s.uid === uid);
    if (!slot) return { ok: false, reason: REASONS.NOT_FOUND };
    if (slot.locked) return { ok: false, reason: 'locked' };   // v8.5.1 ★: a starred piece never leaves in a bulk sale
    const each = sellPrice(slot);
    if (each <= 0) return { ok: false, reason: 'unsellable' };
    earned += each * slot.qty; count += slot.qty;
  }
  const next = cloneState(state);
  for (const uid of list) {
    const r = removeSlotInPlace(next, uid);
    if (!r.ok) return r;
  }
  next.gold += earned;
  return { ok: true, state: next, earned, count, slots: list.length };
}

// ---------------------------------------------------------------------------------------------------------
// v8.5.1 ขายด่วน (quick sell): pick tiers (ระดับ) and/or designs (ลาย = one specific item, every copy of it) and sell every match at once.
//   filter = { rarities: [id…], designs: [itemId…], cats: [category…], keepUpgraded: bool }
//   A piece matches when (its tier is picked AND its category is switched on) OR its design is picked.
//   Never matched: locked ★ pieces (counted as `lockedSkipped`), equipped pieces (they are not in the bag),
//   unsellable items, and — while keepUpgraded is on — equipment that has been upgraded (+1 or more; counted as `upgradedSkipped`).
export const QUICK_CATS = Object.freeze(['weapon', 'armor', 'charm', 'wings', 'material', 'consumable']);
export const QUICK_GEAR = Object.freeze(['weapon', 'armor', 'charm', 'wings']);   // switched on by default; supplies stay off until asked for
export const defaultQuickFilter = () => ({ rarities: [], designs: [], cats: [...QUICK_GEAR], keepUpgraded: true });

export function quickSellPlan(state, filter = {}) {
  const rar = new Set(filter.rarities || []), des = new Set(filter.designs || []), cats = new Set(filter.cats || QUICK_GEAR);
  const keepUp = filter.keepUpgraded !== false;
  const slots = [];
  let pieces = 0, gold = 0, lockedSkipped = 0, upgradedSkipped = 0;
  for (const it of state.inventory.slots) {
    const def = getItem(it.id);
    if (!def || sellPrice(it) <= 0) continue;
    const hit = (rar.has(def.rarity) && cats.has(def.category)) || des.has(it.id);
    if (!hit) continue;
    if (it.locked) { lockedSkipped += it.qty; continue; }
    if (keepUp && isEquipment(def) && (it.lvl || 0) > 0) { upgradedSkipped += 1; continue; }
    slots.push(it); pieces += it.qty; gold += sellPrice(it) * it.qty;
  }
  return { slots, uids: slots.map((s) => s.uid), pieces, gold, lockedSkipped, upgradedSkipped };
}

export function sellQuick(state, filter = {}) {
  const plan = quickSellPlan(state, filter);
  if (!plan.uids.length) return { ok: false, reason: 'nothing_to_sell', lockedSkipped: plan.lockedSkipped };
  const r = sellMany(state, plan.uids);
  return r.ok ? { ...r, lockedSkipped: plan.lockedSkipped, upgradedSkipped: plan.upgradedSkipped } : r;
}

// What the quick-sell panel offers: per tier (within the switched-on categories) and per design, counting only pieces that could be sold.
export function quickSellOptions(state, cats = QUICK_GEAR, keepUpgraded = true) {
  const catSet = new Set(cats);
  const tiers = Object.fromEntries(Object.keys(RARITIES).map((id) => [id, { id, pieces: 0, slots: 0, locked: 0 }]));
  const designs = new Map();
  for (const it of state.inventory.slots) {
    const def = getItem(it.id);
    if (!def || sellPrice(it) <= 0) continue;
    const upgraded = isEquipment(def) && (it.lvl || 0) > 0;
    let d = designs.get(it.id);
    if (!d) { d = { id: it.id, def, pieces: 0, locked: 0, upgraded: 0 }; designs.set(it.id, d); }
    const t = tiers[def.rarity] || tiers.common;
    if (it.locked) { d.locked += it.qty; if (catSet.has(def.category)) t.locked += it.qty; continue; }
    if (keepUpgraded && upgraded) { d.upgraded += 1; continue; }
    d.pieces += it.qty;
    if (catSet.has(def.category)) { t.pieces += it.qty; t.slots += 1; }
  }
  const catOrder = Object.fromEntries(QUICK_CATS.map((c, i) => [c, i]));
  const list = [...designs.values()].filter((d) => d.pieces + d.locked + d.upgraded > 0)
    .sort((a, b) => (catOrder[a.def.category] - catOrder[b.def.category]) || (rarityOf(b.def.rarity).order - rarityOf(a.def.rarity).order) || a.def.name.localeCompare(b.def.name, 'th'));
  return { tiers, designs: list };
}
