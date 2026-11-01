// Bloodline rolls. Pure, atomic transactions: validate → clone → mutate → return { ok, state, ... }.
import { RACES, RACE_IDS, REROLL_ITEM, getRace } from '../data/races.js';
import { cloneState } from '../core/state.js';
import { countItem, removeInPlace } from './inventory.js';

// Chances for one roll. A re-roll never returns the current race, so the remaining weights are re-normalised.
export function raceOdds(excludeId = null) {
  const ids = RACE_IDS.filter((id) => id !== excludeId);
  const total = ids.reduce((a, id) => a + RACES[id].weight, 0);
  return ids.map((id) => ({ id, chance: RACES[id].weight / total }));
}

export function rollRaceId(rng, excludeId = null) {
  const odds = raceOdds(excludeId);
  let r = rng.next();
  for (const o of odds) { r -= o.chance; if (r < 0) return o.id; }
  return odds[odds.length - 1].id;
}

// The free first roll (new hero, or an older save that predates bloodlines).
export function awakenRace(state, rng) {
  if (state.race?.id) return { ok: false, reason: 'already_awakened' };
  const next = cloneState(state);
  const id = rollRaceId(rng);
  next.race = { id, rolls: (state.race?.rolls || 0) + 1 };
  next.raceSeen = { ...(next.raceSeen || {}), [id]: true };
  return { ok: true, state: next, id };
}

export function canReroll(state) {
  if (!state.race?.id) return { ok: false, reason: 'not_awakened' };
  if (countItem(state, REROLL_ITEM) < 1) return { ok: false, reason: 'no_bloodstone' };
  return { ok: true };
}

export function rerollRace(state, rng) {
  const c = canReroll(state);
  if (!c.ok) return c;
  const next = cloneState(state);
  const r = removeInPlace(next, REROLL_ITEM, 1);
  if (!r.ok) return r;
  const from = state.race.id;
  const id = rollRaceId(rng, from);
  next.race = { id, rolls: state.race.rolls + 1 };
  next.raceSeen = { ...(next.raceSeen || {}), [id]: true };
  return { ok: true, state: next, id, from };
}

// Race storage (2 slots): keep the current bloodline in a slot, roll a new one, swap back whenever.
export const RACE_SLOTS = 2;
export function storeRace(state, i) {
  if (!state.race?.id) return { ok: false, reason: 'not_awakened' };
  if (!(i >= 0 && i < RACE_SLOTS)) return { ok: false, reason: 'bad_slot' };
  const next = cloneState(state);
  next.raceSlots = [...(next.raceSlots || [null, null])];
  if (next.raceSlots.includes(state.race.id)) return { ok: false, reason: 'already_stored' };
  next.raceSlots[i] = state.race.id;
  return { ok: true, state: next };
}
// the stored bloodline becomes active; the active one takes its place in the slot
export function swapRace(state, i) {
  const slot = state.raceSlots?.[i];
  if (!getRace(slot)) return { ok: false, reason: 'empty_slot' };
  const next = cloneState(state);
  next.raceSlots = [...next.raceSlots];
  next.raceSlots[i] = state.race?.id && state.race.id !== slot ? state.race.id : null;
  next.race = { id: slot, rolls: state.race?.rolls || 0 };
  return { ok: true, state: next };
}
export function clearRaceSlot(state, i) {
  if (!state.raceSlots?.[i]) return { ok: false, reason: 'empty_slot' };
  const next = cloneState(state);
  next.raceSlots = [...next.raceSlots]; next.raceSlots[i] = null;
  return { ok: true, state: next };
}

const NO_STATS = Object.freeze({ hpPct: 0, atkPct: 0, defPct: 0, crit: 0, critMult: 0, spd: 0 });

export function raceStats(state) {
  const race = getRace(state.race?.id);
  return race ? { ...NO_STATS, ...race.stats } : { ...NO_STATS };
}

export function raceAbility(state) {
  return getRace(state.race?.id)?.ability || {};
}

export function raceOf(state) {
  return getRace(state.race?.id);
}
