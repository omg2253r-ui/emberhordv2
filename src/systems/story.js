// Story progression: which scene plays when, current goal, lore discovery. Pure functions.
import { SCENES, LORE, GOALS, SPEAKERS } from '../data/story.js';
import { cloneState } from '../core/state.js';
import { BALANCE } from '../config/balance.js';

// Scenes that play when arriving at camp, in priority order.
const CAMP_QUEUE = [
  { id: 'prologue', when: () => true },
  { id: 's1_boss_post', when: (st) => st.progress.cleared.s1 },     // older saves that beat the boss before the story existed
  { id: 'camp_after_s1', when: (st) => st.story.seen.s1_boss_post },
  { id: 'mem_ward', when: (st) => st.story.lore.l_daoletter },
  { id: 's2_boss_post', when: (st) => st.progress.cleared.s2 },
  { id: 'camp_after_s2', when: (st) => st.story.seen.s2_boss_post },
];

export function nextCampScene(state) {
  for (const q of CAMP_QUEUE) if (!state.story.seen[q.id] && q.when(state)) return q.id;
  return null;
}

// Dungeon moments: 'enter' | 'boss_pre' | 'boss_post'
export function dungeonScene(state, stageId, moment) {
  const id = `${stageId}_${moment}`;
  return SCENES[id] && !state.story.seen[id] ? id : null;
}

export function markSeen(state, sceneId) {
  const sc = SCENES[sceneId];
  if (!sc) return { ok: false, reason: 'unknown_scene' };
  const next = cloneState(state);
  next.story.seen[sceneId] = true;
  for (const [k, v] of Object.entries(sc.sets || {})) next.story.flags[k] = v;
  return { ok: true, state: next, sets: sc.sets || {} };
}

export function discoverLore(state, loreId) {
  const l = LORE[loreId];
  if (!l) return { ok: false, reason: 'unknown_lore' };
  const isNew = !state.story.lore[loreId];
  const next = cloneState(state);
  next.story.lore[loreId] = true;
  const sparks = isNew ? BALANCE.sparks.loreFirst : 0;   // first read of a document rewards Amber Sparks
  next.sparks = (next.sparks || 0) + sparks;
  return { ok: true, state: next, isNew, sparks, scene: l.scene && !state.story.seen[l.scene] ? l.scene : null };
}

export function currentGoal(state) {
  return GOALS.find((g) => g.when(state)) || GOALS[GOALS.length - 1];
}

const fill = (text, state) => text.replaceAll('{name}', state.story.name);

// Lines ready to display: conditions resolved and the hero's name filled in.
export function sceneLines(state, sceneId) {
  const sc = SCENES[sceneId];
  if (!sc) return [];
  return sc.lines.filter((l) => {
    if (!l.if) return true;
    const [kind, id] = l.if.split(':');
    return kind === 'lore' ? !!state.story.lore[id] : !!state.story.flags[id];
  }).map((l) => ({ ...l, t: fill(l.t, state), who: fill(SPEAKERS[l.s].name, state), portrait: SPEAKERS[l.s].portrait }));
}

export function loreText(state, loreId) {
  const l = LORE[loreId];
  return l ? { title: l.title, text: l.text.map((p) => fill(p, state)), thought: l.thought ? fill(l.thought, state) : '' } : null;
}

export function loreProgress(state, stageId) {
  const ids = Object.keys(LORE).filter((id) => LORE[id].stage === stageId);
  return { found: ids.filter((id) => state.story.lore[id]).length, total: ids.length };
}
