// Artifact rules: bonuses from the Cosmic Tree, placing/removing, granting drops. Pure, like the other systems.
import { ARTIFACTS, getArtifact, TREE, getSlot, FX_KIND, ART_CAPS, ART_LEVEL_MAX, ART_LEVEL_STEP, AFFINITY_BONUS, ART_DROP } from '../data/artifacts.js';
import { rarityOf } from '../data/rarity.js';
import { cloneState } from '../core/state.js';

const EMPTY = Object.freeze(Object.fromEntries(Object.keys(ART_CAPS).map((k) => [k, 0])));

export const levelMult = (lvl) => 1 + ART_LEVEL_STEP * (Math.max(1, Math.min(ART_LEVEL_MAX, lvl | 0)) - 1);
export function slotMatches(slot, art) {
  if (!slot || !art) return false;
  if (slot.aff === 'any') return false;
  return Object.keys(art.fx).some((k) => FX_KIND[k] === slot.aff);
}
export function slotFilled(state, id) { return !!state.artifacts?.slots?.[id]; }
export function slotUnlocked(state, id) {
  const s = getSlot(id);
  if (!s) return false;
  if (state.player.level < s.level) return false;
  return !s.parent || slotFilled(state, s.parent);
}

// What one placed artifact gives in a slot.
export function artifactEffect(art, lvl, slot) {
  const m = levelMult(lvl) * (slotMatches(slot, art) ? 1 + AFFINITY_BONUS : 1);
  return Object.fromEntries(Object.entries(art.fx).map(([k, v]) => [k, v * m]));
}

export function artifactBonuses(state) {
  const out = { ...EMPTY };
  const A = state.artifacts;
  if (!A) return out;
  for (const s of TREE) {
    const id = A.slots?.[s.id];
    const art = getArtifact(id);
    if (!art || !slotUnlocked(state, s.id)) continue;
    const fx = artifactEffect(art, A.owned?.[id]?.lvl || 1, s);
    for (const [k, v] of Object.entries(fx)) out[k] += v;
  }
  for (const k of Object.keys(out)) out[k] = Math.min(ART_CAPS[k], Math.round(out[k] * 1000) / 1000);
  return out;
}

export function placeArtifact(state, slotId, artId) {
  if (!getSlot(slotId)) return { ok: false, reason: 'bad_slot' };
  if (!slotUnlocked(state, slotId)) return { ok: false, reason: 'locked' };
  if (!getArtifact(artId) || !state.artifacts.owned[artId]) return { ok: false, reason: 'not_owned' };
  const next = cloneState(state);
  for (const [k, v] of Object.entries(next.artifacts.slots)) if (v === artId) delete next.artifacts.slots[k];   // one artifact, one slot
  next.artifacts.slots[slotId] = artId;
  return { ok: true, state: next };
}

// Taking an artifact out also frees everything rooted below that slot.
export function removeArtifact(state, slotId) {
  if (!slotFilled(state, slotId)) return { ok: false, reason: 'empty' };
  const next = cloneState(state);
  const drop = (id) => { delete next.artifacts.slots[id]; for (const c of TREE.filter((s) => s.parent === id)) drop(c.id); };
  drop(slotId);
  return { ok: true, state: next };
}

// New artifacts join the collection; duplicates level it up; past the top level they turn into coins.
export function grantArtifactsInPlace(state, ids) {
  const out = [];
  for (const id of ids) {
    const art = getArtifact(id);
    if (!art) continue;
    const cur = state.artifacts.owned[id];
    if (!cur) { state.artifacts.owned[id] = { lvl: 1 }; out.push({ id, kind: 'new', lvl: 1 }); }
    else if (cur.lvl < ART_LEVEL_MAX) { cur.lvl += 1; out.push({ id, kind: 'level', lvl: cur.lvl }); }
    else { const gold = 400 * (rarityOf(art.rarity).order + 1); state.gold += gold; out.push({ id, kind: 'coins', gold }); }
  }
  return out;
}

// Which artifact drops: by rarity weight, the odds of rarer ones grow with the wave.
export function rollArtifact(rng, wave = 1) {
  const boost = Math.min(3, 1 + wave / 25);
  const byR = Object.entries(ART_DROP).map(([r, w]) => [r, r === 'common' ? w / boost : r === 'uncommon' ? w : w * boost]);
  const total = byR.reduce((a, [, w]) => a + w, 0);
  let x = rng.next() * total, rar = 'common';
  for (const [r, w] of byR) { x -= w; if (x <= 0) { rar = r; break; } }
  const pool = Object.values(ARTIFACTS).filter((a) => a.rarity === rar);
  return pool[(rng.next() * pool.length) | 0].id;
}
