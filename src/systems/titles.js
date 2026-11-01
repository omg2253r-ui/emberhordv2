// Achievements → titles. Pure transactions on the save.
import { TITLES, getTitle, badgeTier } from '../data/titles.js';
import { cloneState } from '../core/state.js';

// Unlocks every achievement the save now meets. Returns { state, unlocked: [ids] } (state unchanged when none).
export function checkTitles(state, now = Date.now()) {
  const owned = state.titles?.owned || {};
  const fresh = TITLES.filter((t) => !owned[t.id] && safe(t, state)).map((t) => t.id);
  if (!fresh.length) return { state, unlocked: [] };
  const next = cloneState(state);
  next.titles ||= { owned: {}, equipped: null };
  for (const id of fresh) next.titles.owned[id] = now;
  return { state: next, unlocked: fresh };
}
function safe(t, s) { try { return !!t.test(s); } catch { return false; } }

export function equipTitle(state, id) {
  if (id !== null && !getTitle(id)) return { ok: false, reason: 'unknown_title' };
  if (id !== null && !state.titles?.owned?.[id]) return { ok: false, reason: 'title_locked' };
  const next = cloneState(state);
  next.titles ||= { owned: {}, equipped: null };
  next.titles.equipped = id;
  return { ok: true, state: next };
}

// the worn title's bonus + the honour badge (+1% attack / defence / HP per tier)
export function titleBonuses(state) {
  const b = { atkPct: 0, hpPct: 0, defPct: 0, crit: 0, critMult: 0, spd: 0, goldMult: 0, skillPower: 0 };
  const t = getTitle(state.titles?.equipped);
  if (t && state.titles.owned?.[t.id]) for (const [k, v] of Object.entries(t.b)) b[k] += v;
  const tier = badgeTier(state);
  b.atkPct += tier * 0.01; b.defPct += tier * 0.01; b.hpPct += tier * 0.01;
  return b;
}
