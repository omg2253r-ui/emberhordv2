// Inventory rules: capacity, stacking, adding/removing. All functions are pure:
// they return { ok, state } with a NEW state, or { ok:false, reason } and leave the input untouched.
import { BALANCE } from '../config/balance.js';
import { getItem, isStackable, isEquipment } from '../data/items.js';
import { cloneState, takeUid } from '../core/state.js';

export const REASONS = Object.freeze({
  UNKNOWN_ITEM: 'unknown_item',
  BAD_QTY: 'bad_qty',
  FULL: 'inventory_full',
  NOT_ENOUGH: 'not_enough',
  NOT_FOUND: 'not_found',
});

export function countItem(state, id) {
  let n = 0;
  for (const s of state.inventory.slots) if (s.id === id) n += s.qty;
  return n;
}

export function freeSlots(state) {
  return state.inventory.capacity - state.inventory.slots.length;
}

// How many new slots adding `qty` of `id` would need (0 if it fits on existing stacks).
export function slotsNeeded(state, id, qty) {
  const def = getItem(id);
  if (!def) return Infinity;
  if (!isStackable(def)) return qty;
  const max = BALANCE.inventory.maxStack;
  let room = 0;
  for (const s of state.inventory.slots) if (s.id === id) room += max - s.qty;
  const rest = Math.max(0, qty - room);
  return Math.ceil(rest / max);
}

export function canAdd(state, id, qty = 1) {
  return Number.isInteger(qty) && qty > 0 && slotsNeeded(state, id, qty) <= freeSlots(state);
}

// Mutating helper used inside transactions that already cloned the state.
export function addInPlace(state, id, qty = 1, lvl = 0) {
  const def = getItem(id);
  if (!def) return { ok: false, reason: REASONS.UNKNOWN_ITEM };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: REASONS.BAD_QTY };
  if (!canAdd(state, id, qty)) return { ok: false, reason: REASONS.FULL };
  const added = [];
  if (isStackable(def)) {
    const max = BALANCE.inventory.maxStack;
    let left = qty;
    for (const s of state.inventory.slots) {
      if (left <= 0) break;
      if (s.id !== id || s.qty >= max) continue;
      const put = Math.min(max - s.qty, left);
      s.qty += put; left -= put; added.push(s.uid);
    }
    while (left > 0) {
      const put = Math.min(max, left);
      const slot = { uid: takeUid(state), id, qty: put, lvl: 0 };
      state.inventory.slots.push(slot); left -= put; added.push(slot.uid);
    }
  } else {
    for (let i = 0; i < qty; i++) {
      const slot = { uid: takeUid(state), id, qty: 1, lvl: isEquipment(def) ? Math.max(0, lvl | 0) : 0 };
      state.inventory.slots.push(slot); added.push(slot.uid);
    }
  }
  return { ok: true, added };
}

export function addItem(state, id, qty = 1, lvl = 0) {
  const next = cloneState(state);
  const r = addInPlace(next, id, qty, lvl);
  return r.ok ? { ok: true, state: next, added: r.added } : r;
}

// v8.5.1 ล็อก (★): a starred item is protected from selling (one by one, bulk, quick-sell), trading and blueprint exchange.
// The flag lives on the item instance itself (`locked: true`), so it follows the piece between the bag and the equipment slots.
export const isLocked = (inst) => !!(inst && inst.locked);

export function findAnywhere(state, uid) {
  for (const e of Object.values(state.equipment || {})) if (e && e.uid === uid) return e;
  return state.inventory.slots.find((s) => s.uid === uid) || null;
}

// on = true / false to set, null to flip. Works on bagged and equipped pieces.
export function setLock(state, uid, on = null) {
  if (!findAnywhere(state, uid)) return { ok: false, reason: REASONS.NOT_FOUND };
  const next = cloneState(state);
  const inst = findAnywhere(next, uid);
  const want = on == null ? !inst.locked : !!on;
  if (want) inst.locked = true; else delete inst.locked;
  return { ok: true, state: next, locked: want };
}

// Removes qty of a stackable id, taking unlocked stacks first, then the smallest stacks.
export function removeInPlace(state, id, qty) {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, reason: REASONS.BAD_QTY };
  if (countItem(state, id) < qty) return { ok: false, reason: REASONS.NOT_ENOUGH };
  let left = qty;
  const stacks = state.inventory.slots.filter((s) => s.id === id).sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || a.qty - b.qty);
  for (const s of stacks) {
    if (left <= 0) break;
    const take = Math.min(s.qty, left);
    s.qty -= take; left -= take;
  }
  state.inventory.slots = state.inventory.slots.filter((s) => s.qty > 0);
  return { ok: true };
}

export function removeItem(state, id, qty) {
  const next = cloneState(state);
  const r = removeInPlace(next, id, qty);
  return r.ok ? { ok: true, state: next } : r;
}

export function findSlot(state, uid) {
  return state.inventory.slots.find((s) => s.uid === uid) || null;
}

export function removeSlotInPlace(state, uid, qty = null) {
  const idx = state.inventory.slots.findIndex((s) => s.uid === uid);
  if (idx < 0) return { ok: false, reason: REASONS.NOT_FOUND };
  const slot = state.inventory.slots[idx];
  const take = qty == null ? slot.qty : qty;
  if (!Number.isInteger(take) || take <= 0) return { ok: false, reason: REASONS.BAD_QTY };
  if (take > slot.qty) return { ok: false, reason: REASONS.NOT_ENOUGH };
  slot.qty -= take;
  if (slot.qty === 0) state.inventory.slots.splice(idx, 1);
  return { ok: true, removed: { ...slot, qty: take } };
}

// Sorted view for display: equipment first by rarity, then materials, then consumables.
export function sortedSlots(state) {
  const catOrder = { weapon: 0, armor: 1, charm: 2, wings: 3, consumable: 4, material: 5 };
  const rOrder = { mythic: -1, legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  return [...state.inventory.slots].sort((a, b) => {
    const da = getItem(a.id), db = getItem(b.id);
    if (!da || !db) return 0;
    return (catOrder[da.category] - catOrder[db.category]) || (rOrder[da.rarity] - rOrder[db.rarity]) || (b.lvl - a.lvl) || (a.uid - b.uid);
  });
}
