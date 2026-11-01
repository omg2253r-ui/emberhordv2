// Pet summoning, collection and the passive bonuses of the active pet. Pure, atomic transactions.
import { PETS, PET_IDS, TIER_ODDS, SUMMON_COST, PITY, MAX_STARS, DUPLICATE_REFUND, PET_TEAM, getPet, petValues } from '../data/pets.js';
import { cloneState } from '../core/state.js';
import { luckMult } from './luck.js';

const ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Luck Potion: rare, epic and legendary odds are multiplied by `luck`; common takes the difference but keeps at
// least 10%. (×2 → rare 57.6%, epic 27%, legendary 5.4%.)
export function tierOdds(luck = 1) {
  if (!(luck > 1)) return { ...TIER_ODDS };
  const boosted = Object.fromEntries(Object.entries(TIER_ODDS).map(([t, p]) => [t, t === 'common' ? p : p * luck]));
  const rest = Object.entries(boosted).filter(([t]) => t !== 'common').reduce((a, [, p]) => a + p, 0);
  const room = 0.9, k = rest > room ? room / rest : 1;
  const out = {};
  let sum = 0;
  for (const [t, p] of Object.entries(boosted)) if (t !== 'common') { out[t] = p * k; sum += out[t]; }
  return { common: Math.max(0.1, 1 - sum), ...out };
}

function pickTier(r, guaranteed, luck = 1) {
  const tiers = Object.entries(tierOdds(luck)).filter(([t]) => !guaranteed || ORDER[t] >= ORDER.epic);
  const total = tiers.reduce((a, [, p]) => a + p, 0);
  let x = r * total;
  for (const [t, p] of tiers) { x -= p; if (x < 0) return t; }
  return tiers[tiers.length - 1][0];
}

// Rolls one pet. `pity` = summons since the last epic-or-better (before this one).
export function rollPet(rng, pity, luck = 1) {
  const guaranteed = pity + 1 >= PITY;
  const tier = pickTier(rng.next(), guaranteed, luck);
  const ids = PET_IDS.filter((id) => PETS[id].rarity === tier);
  const id = ids[Math.min(ids.length - 1, Math.floor(rng.next() * ids.length))];
  return { id, tier, guaranteed };
}

export function summonCost(count) { return SUMMON_COST * count; }

export function summonPets(state, rng, count = 1, now = Date.now()) {
  if (!Number.isInteger(count) || count < 1 || count > 10) return { ok: false, reason: 'bad_count' };
  const cost = summonCost(count);
  if (state.sparks < cost) return { ok: false, reason: 'not_enough_sparks', cost };
  const next = cloneState(state);
  next.sparks -= cost;
  const results = [];
  const luck = luckMult(state, now);
  for (let i = 0; i < count; i++) {
    const roll = rollPet(rng, next.pets.pity, luck);
    next.pets.summons += 1;
    next.pets.pity = ORDER[roll.tier] >= ORDER.epic ? 0 : next.pets.pity + 1;
    const owned = next.pets.owned[roll.id];
    let refund = 0, stars = 1, isNew = false;
    if (!owned) { next.pets.owned[roll.id] = { stars: 1 }; isNew = true; }
    else if (owned.stars < MAX_STARS) { owned.stars += 1; stars = owned.stars; }
    else { refund = DUPLICATE_REFUND; next.sparks += refund; stars = owned.stars; }
    if (isNew && teamOf(next).length === 0) next.pets.active = [roll.id]; // the first pet joins right away
    results.push({ id: roll.id, tier: roll.tier, stars, isNew, refund, guaranteed: roll.guaranteed });
  }
  return { ok: true, state: next, results, cost, luck };
}

// The pets that follow the hero (up to PET_TEAM). Older saves kept one id as a string.
export function teamOf(state) {
  const a = state.pets?.active;
  const list = Array.isArray(a) ? a : a ? [a] : [];
  const out = [];
  for (const id of list) if (getPet(id) && state.pets.owned?.[id] && !out.includes(id) && out.length < PET_TEAM) out.push(id);
  return out;
}

// Adds a pet to the team, or sends it back to camp when it is already following.
export function togglePet(state, id) {
  if (!getPet(id)) return { ok: false, reason: 'unknown_pet' };
  if (!state.pets.owned[id]) return { ok: false, reason: 'not_owned' };
  const team = teamOf(state);
  const next = cloneState(state);
  if (team.includes(id)) { next.pets.active = team.filter((x) => x !== id); return { ok: true, state: next, joined: false }; }
  if (team.length >= PET_TEAM) return { ok: false, reason: 'team_full' };
  next.pets.active = [...team, id];
  return { ok: true, state: next, joined: true };
}

// One pet alone (null = everyone rests at camp). Kept for older callers and tests.
export function setActivePet(state, id) {
  if (id !== null && !getPet(id)) return { ok: false, reason: 'unknown_pet' };
  if (id !== null && !state.pets.owned[id]) return { ok: false, reason: 'not_owned' };
  const team = teamOf(state);
  if (id !== null && team.length === 1 && team[0] === id) return { ok: false, reason: 'already_active' };
  const next = cloneState(state);
  next.pets.active = id === null ? [] : [id];
  return { ok: true, state: next };
}

function petEntry(state, id) {
  const pet = getPet(id);
  const stars = state.pets.owned[id].stars;
  return { id, pet, stars, v: petValues(pet, stars) };
}
export function activePets(state) { return teamOf(state).map((id) => petEntry(state, id)); }
// The leader (first pet): shown to other players in the village.
export function activePet(state) { return activePets(state)[0] || null; }

// Passive effects of every pet in the team for computeStats. Each bonus has a ceiling so three pets of the same
// kind cannot break the game.
export const PASSIVE_CAPS = Object.freeze({ magnet: 2.5, goldMult: 0.6, skillCd: 0.35, skillPower: 0.5, allPct: 0.18, perfectRefund: 2.5, dodgeCd: 0.35, spd: 0.15, critPct: 0.1, defPct: 0.2, thorns: 1.2 });
export function petPassives(state) {
  const b = Object.fromEntries(Object.keys(PASSIVE_CAPS).map((k) => [k, 0]));
  for (const a of activePets(state)) for (const k of Object.keys(b)) if (typeof a.v[k] === 'number') b[k] += a.v[k];
  for (const k of Object.keys(b)) b[k] = Math.round(Math.min(PASSIVE_CAPS[k], b[k]) * 1000) / 1000;
  return b;
}

export function pityLeft(state) {
  return Math.max(1, PITY - state.pets.pity);
}
