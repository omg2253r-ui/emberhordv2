// Player level, XP and stage unlocks.
import { BALANCE, xpToNext } from '../config/balance.js';
import { STAGES, getStage } from '../data/stages.js';
import { cloneState } from '../core/state.js';

// Mutating version used inside the battle (state already owned by the run).
export function grantXpInPlace(state, amount) {
  if (!(amount > 0)) return 0;
  let gained = 0;
  state.player.xp += Math.round(amount);
  while (state.player.level < BALANCE.player.maxLevel && state.player.xp >= xpToNext(state.player.level)) {
    state.player.xp -= xpToNext(state.player.level);
    state.player.level += 1;
    gained += 1;
  }
  if (state.player.level >= BALANCE.player.maxLevel) state.player.xp = 0;
  return gained;
}

export function grantXp(state, amount) {
  const next = cloneState(state);
  const levelsGained = grantXpInPlace(next, amount);
  return { ok: true, state: next, levelsGained };
}

export function isStageUnlocked(state, stage) {
  return !stage.requires || !!state.progress.cleared[stage.requires];
}

export function completeStageInPlace(state, stageId) {
  const stage = getStage(stageId);
  if (!stage) return { ok: false, reason: 'unknown_stage' };
  const firstClear = !state.progress.cleared[stageId];
  state.progress.cleared[stageId] = true;
  state.progress.clears[stageId] = (state.progress.clears[stageId] || 0) + 1;
  const bonusGold = firstClear ? BALANCE.firstClearBonusGold : 0;
  const bonusSparks = firstClear ? BALANCE.sparks.firstClear : 0;
  state.gold += bonusGold;
  state.sparks = (state.sparks || 0) + bonusSparks;
  const unlocked = STAGES.filter((s) => s.requires === stageId).map((s) => s.id);
  return { ok: true, firstClear, bonusGold, bonusSparks, unlocked: firstClear ? unlocked : [] };
}
