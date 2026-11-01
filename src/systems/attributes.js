// Attribute points: earned per level, spent on STR / VIT / DEX / AGI / INT. Pure, atomic transactions like the
// other systems. Free points are always derived (earned by level − spent), so they can never drift out of sync.
import { ATTRS, ATTR_IDS, ATTR_MAX, POINTS_PER_LEVEL, getAttr, attrResetCost } from '../data/attributes.js';
import { cloneState } from '../core/state.js';

export const emptyAttrs = () => Object.fromEntries(ATTR_IDS.map((id) => [id, 0]));

export const attrTotal = (level) => Math.max(0, (level | 0) - 1) * POINTS_PER_LEVEL;

export function attrPoints(state) {
  const total = attrTotal(state.player.level);
  const a = state.attrs || {};
  const spent = ATTR_IDS.reduce((sum, id) => sum + (a[id] | 0), 0);
  return { total, spent, free: Math.max(0, total - spent) };
}

export const attrValue = (state, id) => (state.attrs?.[id] | 0);

// Sum of every attribute's effects → { atkFlat, atkPct, hpFlat, hpPct, defFlat, crit, critMult, spd, dashCd, skillPower, skillCd }
export function attrBonuses(state) {
  const out = { atkFlat: 0, atkPct: 0, hpFlat: 0, hpPct: 0, defFlat: 0, crit: 0, critMult: 0, spd: 0, dashCd: 0, skillPower: 0, skillCd: 0 };
  for (const a of ATTRS) {
    const n = attrValue(state, a.id);
    if (n > 0) for (const fx of a.fx) out[fx.k] += fx.v * n;
  }
  return out;
}

// Spend `n` points (default 1) on one attribute; spends fewer if that is all that is left or the cap is near.
export function allocate(state, id, n = 1) {
  if (!getAttr(id)) return { ok: false, reason: 'unknown_attr' };
  const { free } = attrPoints(state);
  if (free <= 0) return { ok: false, reason: 'no_attr_points' };
  const have = attrValue(state, id);
  if (have >= ATTR_MAX) return { ok: false, reason: 'attr_max' };
  const add = Math.min(Math.max(1, n | 0), free, ATTR_MAX - have);
  const next = cloneState(state);
  next.attrs = { ...emptyAttrs(), ...(next.attrs || {}) };
  next.attrs[id] = have + add;
  return { ok: true, state: next, added: add };
}

export function resetAttrs(state) {
  const { spent } = attrPoints(state);
  if (spent === 0) return { ok: false, reason: 'nothing_to_reset' };
  const cost = attrResetCost(state.player.level);
  if (state.gold < cost) return { ok: false, reason: 'not_enough_gold' };
  const next = cloneState(state);
  next.gold -= cost;
  next.attrs = emptyAttrs();
  return { ok: true, state: next, cost };
}
