// The canonical game state shape. Everything shown in the UI is derived from this object.
import { BALANCE } from '../config/balance.js';
import { SKILL_SLOTS } from '../data/skills.js';
import { ATTR_IDS } from '../data/attributes.js';

export const SAVE_VERSION = 7;
export const START_SPARKS = 10; // enough for one free pet summon
export const HERO_NAME_MAX = 16;
export const DEFAULT_HERO_NAME = 'นักล่า';

export function createNewState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    nextUid: 4,
    gold: 60,
    player: { level: 1, xp: 0 },
    equipment: {
      weapon: { uid: 1, id: 'w_rust_blade', qty: 1, lvl: 0 },
      armor:  { uid: 2, id: 'a_cloth_wrap', qty: 1, lvl: 0 },
      charm:  null,
      wings:  null,                                     // v6
    },
    inventory: {
      capacity: BALANCE.inventory.capacity,
      bagLevel: 0,                                      // v7: each level = +5 slots
      slots: [{ uid: 3, id: 'p_tonic', qty: 2, lvl: 0 }],
    },
    progress: { cleared: {}, clears: {} },
    stats: { kills: 0, runs: 0, upgradesWon: 0, upgradesLost: 0, crafted: 0, perfects: 0, parries: 0, bossKills: 0, ults: 0, bossRush: 0 },
    settings: { sfx: 0.8, music: 0.45, ui: 0.7, shake: true, fullscreen: false, landscape: false, quality: 'medium' },
    skills: { ranks: {}, slots: new Array(SKILL_SLOTS).fill(null) },
    attrs: Object.fromEntries(ATTR_IDS.map((id) => [id, 0])),   // v8.1: spent attribute points (STR/VIT/DEX/AGI/INT); free points = earned by level − spent
    story: { name: DEFAULT_HERO_NAME, flags: {}, seen: {}, lore: {} },
    race: { id: null, rolls: 0 },                       // v3: bloodline (null until the awakening)
    raceSlots: [null, null],                             // v7: two stored bloodlines to swap with the active one
    raceSeen: {},                                        // v7: every bloodline ever rolled (collection)
    sparks: START_SPARKS,                                // v3: Amber Sparks, the pet-summon currency
    pets: { owned: {}, active: [], pity: 0, summons: 0 },
    social: { friends: {} },                            // v4: friends by account id → { name, at }
    pvp: { wins: 0, losses: 0 },                        // v4: duel record
    zones: { cleared: {}, best: {} },                    // v5: online zones cleared (count) and best time (s)
    raids: {},                                           // v6: special dungeons { id: { last (ms of the last kill), kills } }
    blueprints: {},                                      // v6: blueprints the chief has drawn { itemId: true }
    artifacts: { owned: {}, slots: {} },                 // v6: artifacts { id: { lvl } } and the Cosmic Tree { slotId: artifactId }
    infinite: { day: '', used: 0, best: 0, runs: 0 },    // v6: Infinite Rift entries today and the deepest wave
    tower: { best: 0, asc: 0, bestAsc: 0, runs: 0, kills: 0, gods: {}, claimed: {}, deepest: 0 },   // v7: the Underworld Tower
    titles: { owned: {}, equipped: null },
    profile: { avatar: null, bio: '' },                  // v7: my profile picture (small data URL) and a line about me               // v7: achievements (id → time) and the worn title
    guild: null,                                         // v5: { id, name, tag } of my guild (the guild itself is a shared document)
    buffs: { luckUntil: 0 },                             // v8.2: Luck Potion — epoch ms when its effect ends
    dungeonRuns: {},                                     // v8.3: unfinished story dungeons { stageId: snapshot } (see systems/dungeonRun.js)
    integrity: 'ok',                                     // v6: 'modified' once a save was edited outside the game
  };
}

// Hero name typed by the player: trimmed, control characters removed, length capped. Rendered with textContent only.
export function cleanHeroName(raw) {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, HERO_NAME_MAX).join('') || DEFAULT_HERO_NAME;
}

// Deep copy used by every transaction so a failed operation never touches the original.
export function cloneState(state) {
  return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

export function takeUid(state) {
  const uid = state.nextUid;
  state.nextUid += 1;
  return uid;
}
