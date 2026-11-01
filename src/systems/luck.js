// Luck Potion state: `state.buffs.luckUntil` (epoch ms). Everything that rolls loot or pets asks luckMult(state)
// at the moment it rolls, so the effect starts and ends exactly with the timer (even in the middle of a dungeon).
import { LUCK } from '../data/luck.js';
import { countItem, removeItem } from './inventory.js';

export function luckLeftMs(state, now = Date.now()) {
  const until = state?.buffs?.luckUntil;
  if (typeof until !== 'number' || !Number.isFinite(until)) return 0;
  return Math.max(0, Math.min(LUCK.maxMs, until - now));
}

export const luckActive = (state, now = Date.now()) => luckLeftMs(state, now) > 0;
export const luckMult = (state, now = Date.now()) => (luckActive(state, now) ? LUCK.mult : 1);

// "4:32"
export function fmtLuckTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function drinkLuck(state, now = Date.now()) {
  if (countItem(state, LUCK.itemId) <= 0) return { ok: false, reason: 'no_luck_potion' };
  const left = luckLeftMs(state, now);
  if (left + LUCK.durationMs > LUCK.maxMs) return { ok: false, reason: 'luck_full' };   // never waste a potion
  const r = removeItem(state, LUCK.itemId, 1);
  if (!r.ok) return r;
  const next = r.state;
  next.buffs = { ...(next.buffs || {}), luckUntil: now + left + LUCK.durationMs };
  return { ok: true, state: next, leftMs: left + LUCK.durationMs };
}
