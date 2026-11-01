// Equip / unequip. Equipped instances live in state.equipment, not in the inventory.
import { getItem, isEquipment, EQUIP_SLOTS } from '../data/items.js';
import { cloneState } from '../core/state.js';
import { freeSlots, REASONS } from './inventory.js';

export function equip(state, uid) {
  const next = cloneState(state);
  const idx = next.inventory.slots.findIndex((s) => s.uid === uid);
  if (idx < 0) return { ok: false, reason: REASONS.NOT_FOUND };
  const inst = next.inventory.slots[idx];
  const def = getItem(inst.id);
  if (!isEquipment(def)) return { ok: false, reason: 'not_equipment' };
  const slot = def.category;
  const prev = next.equipment[slot];
  next.equipment[slot] = { uid: inst.uid, id: inst.id, qty: 1, lvl: inst.lvl, ...(inst.locked ? { locked: true } : {}) };
  if (prev) next.inventory.slots.splice(idx, 1, { ...prev, qty: 1 });   // swap in place
  else next.inventory.slots.splice(idx, 1);
  return { ok: true, state: next, slot };
}

export function unequip(state, slot) {
  if (!EQUIP_SLOTS.includes(slot)) return { ok: false, reason: 'bad_slot' };
  if (!state.equipment[slot]) return { ok: false, reason: REASONS.NOT_FOUND };
  if (slot === 'weapon') return { ok: false, reason: 'weapon_required' };
  if (freeSlots(state) < 1) return { ok: false, reason: REASONS.FULL };
  const next = cloneState(state);
  next.inventory.slots.push({ ...next.equipment[slot], qty: 1 });
  next.equipment[slot] = null;
  return { ok: true, state: next };
}

// Finds an equipment instance anywhere (equipped or bagged).
export function findInstance(state, uid) {
  for (const slot of EQUIP_SLOTS) {
    const e = state.equipment[slot];
    if (e && e.uid === uid) return { instance: e, where: 'equipped', slot };
  }
  const s = state.inventory.slots.find((x) => x.uid === uid);
  return s ? { instance: s, where: 'inventory' } : null;
}
