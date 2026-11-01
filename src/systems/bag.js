// ขยายกระเป๋า: each expansion adds 5 slots; every expansion costs more than the last, with no end.
// cost(n) = base × growth^n + linear × n (n = expansions already bought), rounded to a tidy number.
import { BALANCE } from '../config/balance.js';
import { cloneState } from '../core/state.js';

const tidy = (v) => { if (v < 1000) return Math.round(v / 10) * 10; const p = Math.pow(10, Math.floor(Math.log10(v)) - 2); return Math.round(v / p) * p; };

export function bagLevel(state) { return state.inventory.bagLevel || 0; }
export function bagCost(level) {
  const B = BALANCE.bag;
  return tidy(B.base * Math.pow(B.growth, level) + B.linear * level);
}
export function nextBag(state) {
  const lv = bagLevel(state);
  const max = lv >= BALANCE.bag.maxLevel;
  return { level: lv, capacity: state.inventory.capacity, next: state.inventory.capacity + BALANCE.bag.step, cost: max ? null : bagCost(lv), max };
}
export function upgradeBag(state) {
  const n = nextBag(state);
  if (n.max) return { ok: false, reason: 'bag_max' };
  if (state.gold < n.cost) return { ok: false, reason: 'not_enough_gold', cost: n.cost };
  const next = cloneState(state);
  next.gold -= n.cost;
  next.inventory.bagLevel = n.level + 1;
  next.inventory.capacity += BALANCE.bag.step;
  return { ok: true, state: next, cost: n.cost, capacity: next.inventory.capacity };
}
