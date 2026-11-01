import { ZONE_ENEMIES } from './zones.js';
import { TOWER_ENEMIES } from './tower.js';

// Enemy definitions. (v8: the story monsters are 20% tougher and hit 15% harder)
// Drop tables use explicit rolls:
//   each roll first passes `chance` (0..1), then picks ONE entry by weight.
// The loot system validates these tables at boot and in unit tests.
// interruptAt: minimum move power that cancels this enemy's attack wind-up (default 1.2; lighter hits only flinch it).
// sparks: Amber Sparks dropped by bosses.

export const ENEMIES = Object.freeze({
  mossling: {
    id: 'mossling', name: 'มอสลิง', sprite: 'mossling', particles: ['#6f9a4a', '#a5c76c', '#4b6e33'],
    hp: 41, atk: 12, def: 2, speed: 78, radius: 22, mass: 1, xp: 6, gold: [2, 5],
    ai: 'hopper', ai_params: { hopEvery: 0.95, hopTime: 0.35, hopSpeed: 280, contactRange: 34 },
    drops: [
      { chance: 0.45, entries: [
        { id: 'm_iron_shard', weight: 6, qty: [1, 2] },
        { id: 'm_beast_hide', weight: 2, qty: [1, 1] },
        { id: 'p_tonic',      weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.03, entries: [{ id: 'c_moss_bead', weight: 1, qty: [1, 1] }] },
    ],
  },
  thorn_imp: {
    id: 'thorn_imp', name: 'ภูตหนาม', sprite: 'thorn_imp', particles: ['#8a3b2e', '#5d6b3a', '#b5603f'],
    hp: 34, atk: 15, def: 1, speed: 118, radius: 18, mass: 0.8, xp: 8, gold: [3, 7],
    ai: 'skirmisher', ai_params: { strikeRange: 80, windup: 0.42, lungeTime: 0.2, lungeSpeed: 450, recover: 0.5 },
    drops: [
      { chance: 0.5, entries: [
        { id: 'm_iron_shard', weight: 4, qty: [1, 2] },
        { id: 'm_beast_hide', weight: 4, qty: [1, 1] },
      ] },
      { chance: 0.06, entries: [
        { id: 'w_hunter_saber', weight: 1, qty: [1, 1] },
        { id: 'a_hide_vest',    weight: 1, qty: [1, 1] },
        { id: 'w_reaper_hook',  weight: 1, qty: [1, 1] },
        { id: 'w_twin_sabers',  weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.02, entries: [{ id: 'm_thorn_core', weight: 1, qty: [1, 1] }] },
    ],
  },
  thornback_boar: {
    id: 'thornback_boar', name: 'หมูป่าหลังหนาม', sprite: 'thornback_boar', boss: true, faces: true, particles: ['#5a3b2a', '#58733a', '#c9df8c'],
    hp: 672, atk: 26, def: 8, speed: 92, radius: 50, mass: 6, xp: 120, gold: [60, 90], sparks: 5,
    ai: 'boar', ai_params: { chargeTelegraph: 0.85, chargeSpeed: 540, chargeTime: 0.9, quakeTelegraph: 1.0, quakeRadius: 150, quakeMult: 1.3, restTime: 1.2 },
    drops: [
      { chance: 1, entries: [{ id: 'm_thorn_core', weight: 1, qty: [1, 2] }] },
      { chance: 1, entries: [{ id: 'm_iron_shard', weight: 1, qty: [4, 6] }] },
      { chance: 0.4, entries: [
        { id: 'w_thorn_edge', weight: 2, qty: [1, 1] },
        { id: 'a_bark_mail',  weight: 2, qty: [1, 1] },
        { id: 'c_boar_tusk',  weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.3, entries: [
        { id: 'w_mist_katana', weight: 1, qty: [1, 1] }, { id: 'w_venom_daggers', weight: 1, qty: [1, 1] },
        { id: 'w_boar_breaker', weight: 1, qty: [1, 1] }, { id: 'w_thorn_rod', weight: 1, qty: [1, 1] },
        { id: 'w_thornstring_bow', weight: 1, qty: [1, 1] }, { id: 'w_thorn_pike', weight: 1, qty: [1, 1] },
        { id: 'w_thornreap', weight: 1, qty: [1, 1] }, { id: 'w_twin_thorns', weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.12, entries: [{ id: 'a_wanderer_coat', weight: 2, qty: [1, 1] }, { id: 'a_ronin_lamellar', weight: 1, qty: [1, 1] }] },
      { chance: 0.35, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
    ],
  },

  // ---------------------------------------------------------------- stage 2: Cinder Mine
  ember_imp: {
    id: 'ember_imp', name: 'ภูตถ่านแดง', sprite: 'ember_imp', particles: ['#c4492e', '#ff8a3d', '#3a2420'],
    hp: 60, atk: 22, def: 3, speed: 96, radius: 18, mass: 0.8, xp: 14, gold: [6, 11],
    ai: 'caster', ai_params: { keepAway: 250, windup: 0.6, shotSpeed: 320, shotRadius: 11, cooldown: 1.45 },
    drops: [
      { chance: 0.55, entries: [
        { id: 'm_iron_shard', weight: 5, qty: [1, 3] },
        { id: 'm_beast_hide', weight: 2, qty: [1, 2] },
        { id: 'p_tonic',      weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.08, entries: [{ id: 'm_ember_core', weight: 1, qty: [1, 1] }] },
      { chance: 0.03, entries: [{ id: 'w_thorn_edge', weight: 1, qty: [1, 1] }, { id: 'a_bark_mail', weight: 1, qty: [1, 1] }] },
      { chance: 0.025, entries: [{ id: 'w_mist_katana', weight: 1, qty: [1, 1] }, { id: 'w_thorn_rod', weight: 1, qty: [1, 1] }, { id: 'w_thornstring_bow', weight: 1, qty: [1, 1] }] },
    ],
  },
  cinder_beetle: {
    id: 'cinder_beetle', name: 'ด้วงเปลือกถ่าน', sprite: 'cinder_beetle', faces: true, particles: ['#3a2a24', '#ff7a33', '#6b4a3a'],
    hp: 108, atk: 24, def: 10, speed: 70, radius: 24, mass: 2.2, xp: 16, gold: [5, 10], interruptAt: 1.8,
    // Re-uses the skirmisher behaviour from stage 1 with slower, heavier numbers.
    ai: 'skirmisher', ai_params: { strikeRange: 95, windup: 0.62, lungeTime: 0.35, lungeSpeed: 400, recover: 0.75 },
    drops: [
      { chance: 0.6, entries: [
        { id: 'm_iron_shard', weight: 3, qty: [2, 3] },
        { id: 'm_beast_hide', weight: 4, qty: [1, 2] },
      ] },
      { chance: 0.06, entries: [{ id: 'm_ember_core', weight: 1, qty: [1, 1] }] },
      { chance: 0.025, entries: [{ id: 'w_venom_daggers', weight: 1, qty: [1, 1] }, { id: 'w_boar_breaker', weight: 1, qty: [1, 1] }, { id: 'w_thorn_pike', weight: 1, qty: [1, 1] }] },
    ],
  },
  furnace_golem: {
    id: 'furnace_golem', name: 'โกเลมเตาหลอม', sprite: 'furnace_golem', boss: true, particles: ['#5b5450', '#ff8a3d', '#ffd08a'],
    hp: 1380, atk: 34, def: 14, speed: 70, radius: 56, mass: 9, xp: 260, gold: [140, 190], sparks: 8,
    ai: 'golem', ai_params: { slamTelegraph: 1.0, slamRadius: 115, slamMult: 1.3, ringTelegraph: 0.9, ringCount: 12, shotSpeed: 260, restTime: 1.1, summon: 'ember_imp' },
    drops: [
      { chance: 1, entries: [{ id: 'm_ember_core', weight: 1, qty: [1, 2] }] },
      { chance: 1, entries: [{ id: 'm_thorn_core', weight: 1, qty: [1, 1] }] },
      { chance: 1, entries: [{ id: 'm_iron_shard', weight: 1, qty: [6, 9] }] },
      { chance: 0.35, entries: [
        { id: 'w_ember_fang',    weight: 2, qty: [1, 1] },
        { id: 'a_lacquer_plate', weight: 2, qty: [1, 1] },
        { id: 'c_cinder_eye',    weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.3, entries: [
        { id: 'w_moonfall_katana', weight: 1, qty: [1, 1] }, { id: 'w_cinder_talons', weight: 1, qty: [1, 1] },
        { id: 'w_furnace_cleaver', weight: 1, qty: [1, 1] }, { id: 'w_ember_scepter', weight: 1, qty: [1, 1] },
        { id: 'w_sunfire_bow', weight: 1, qty: [1, 1] }, { id: 'w_ember_glaive', weight: 1, qty: [1, 1] },
        { id: 'w_ember_scythe', weight: 1, qty: [1, 1] }, { id: 'w_twin_embers', weight: 1, qty: [1, 1] },
      ] },
      { chance: 0.15, entries: [{ id: 'wg_ember_moth', weight: 2, qty: [1, 1] }, { id: 'a_ronin_lamellar', weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
    ],
  },
});

export function getEnemy(id) {
  if (Object.prototype.hasOwnProperty.call(ENEMIES, id)) return ENEMIES[id];
  if (Object.prototype.hasOwnProperty.call(ZONE_ENEMIES, id)) return ZONE_ENEMIES[id];
  return Object.prototype.hasOwnProperty.call(TOWER_ENEMIES, id) ? TOWER_ENEMIES[id] : null;
}

// Online-zone monsters live in data/zones.js; their index in this list is how the network names them.
export const ZONE_ENEMY_IDS = Object.freeze([...Object.keys(ZONE_ENEMIES), ...Object.keys(TOWER_ENEMIES)]);
export const ALL_ENEMIES = Object.freeze({ ...ENEMIES, ...ZONE_ENEMIES, ...TOWER_ENEMIES });
