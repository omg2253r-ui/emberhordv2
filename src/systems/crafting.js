// The chief's forge: exchange a piece for its blueprint, then craft it from its recipe.
// Pure functions in the style of shop.js: validate first, then mutate a cloned state; { ok, state } or { ok:false, reason }.
import { getItem, isEquipment, EQUIP_SLOTS } from '../data/items.js';
import { recipeFor, SECRET } from '../data/crafting.js';
import { cloneState } from '../core/state.js';
import { addInPlace, canAdd, countItem, removeInPlace, removeSlotInPlace, REASONS } from './inventory.js';

export const hasBlueprint = (state, id) => !!state.blueprints?.[id];
export const secretReady = (state) => SECRET.needs.every((m) => countItem(state, m) > 0);

// The secret blueprint is learned the first time both relics are carried together (kept even after crafting).
export function learnSecret(state) {
  if (hasBlueprint(state, SECRET.id) || !secretReady(state)) return { ok: false, reason: 'not_ready' };
  const next = cloneState(state);
  next.blueprints[SECRET.id] = true;
  return { ok: true, state: next };
}

export function exchangeForBlueprint(state, uid) {
  const slot = state.inventory.slots.find((s) => s.uid === uid);
  if (!slot) return { ok: false, reason: REASONS.NOT_FOUND };
  const def = getItem(slot.id);
  if (!def || !isEquipment(def) || def.noCraft) return { ok: false, reason: 'not_gear' };
  if (EQUIP_SLOTS.some((k) => state.equipment[k]?.uid === uid)) return { ok: false, reason: 'equipped' };
  if (slot.locked) return { ok: false, reason: 'locked' };
  if (hasBlueprint(state, def.id)) return { ok: false, reason: 'known' };
  const next = cloneState(state);
  const r = removeSlotInPlace(next, uid, 1);
  if (!r.ok) return r;
  next.blueprints[def.id] = true;
  return { ok: true, state: next, id: def.id };
}

// what is missing to craft id: [{ id, need, have }] (gold and sparks use ids 'gold' and 'spark')
export function missingFor(state, id) {
  const rc = recipeFor(id);
  if (!rc) return null;
  const out = [];
  if (state.gold < rc.gold) out.push({ id: 'gold', need: rc.gold, have: state.gold });
  if (state.sparks < rc.sparks) out.push({ id: 'spark', need: rc.sparks, have: state.sparks });
  for (const m of rc.mats) { const have = countItem(state, m.id); if (have < m.qty) out.push({ id: m.id, need: m.qty, have }); }
  return out;
}

export function craft(state, id) {
  const rc = recipeFor(id);
  if (!rc) return { ok: false, reason: REASONS.UNKNOWN_ITEM };
  if (!hasBlueprint(state, id)) return { ok: false, reason: 'no_blueprint' };
  const miss = missingFor(state, id);
  if (miss.length) return { ok: false, reason: 'missing', missing: miss };
  // the materials go before the new piece takes a slot, so a full bag can still craft when it frees a stack
  const next = cloneState(state);
  next.gold -= rc.gold; next.sparks -= rc.sparks;
  for (const m of rc.mats) { const r = removeInPlace(next, m.id, m.qty); if (!r.ok) return r; }
  if (!canAdd(next, id, 1)) return { ok: false, reason: REASONS.FULL };
  const r = addInPlace(next, id, 1);
  if (!r.ok) return r;
  next.stats.crafted = (next.stats.crafted || 0) + 1;
  return { ok: true, state: next, uid: r.added[0], cost: rc };
}
