// Hand-designed dungeon maps. Rooms sit on a grid; neighbouring rooms get a door unless either
// side lists that wall in `walls`. Positions inside a room are fractions (0..1) of ROOM size.
//
// Room types: start | fight | trap | treasure | lore | rest | key | boss
// waves:  list of waves, each a list of { enemy, count }. Doors lock until every wave is cleared.
// scale:  multiplies enemy HP and attack in that room (deeper rooms are a little harder).
// traps:  spikes {x,y,w,h,period,offset} | dart {x,y,dir,period,offset} | vent {x,y,w,h,period,offset} | rocks {every}
// chest:  { x, y, loot, key? }   lore: { x, y, id }   bonfire: { x, y }

export const ROOM = Object.freeze({ w: 1320, h: 900, wall: 64, door: 150 });   // v8: bigger rooms (was 1100 × 760)

export const TRAP_DAMAGE = Object.freeze({ spikes: 0.13, dart: 0.09, vent: 0.15, rocks: 0.17 }); // fraction of max HP (v8: harder)
export const TRAP_TIMING = Object.freeze({
  spikes: { warn: 0.6, up: 0.55 },
  vent: { warn: 0.75, up: 0.9 },
  dart: { warn: 0.5, speed: 380 },
  rocks: { warn: 0.9, radius: 70 },
});

export const CHEST_LOOT = Object.freeze({
  s1_small: { gold: [20, 40], drops: [
    { chance: 1, entries: [{ id: 'm_iron_shard', weight: 1, qty: [2, 4] }] },
    { chance: 0.6, entries: [{ id: 'p_tonic', weight: 1, qty: [1, 1] }, { id: 'm_beast_hide', weight: 1, qty: [1, 2] }] },
  ] },
  s1_key: { gold: [15, 25], drops: [{ chance: 1, entries: [{ id: 'p_tonic', weight: 1, qty: [1, 1] }] }] },
  s1_rare: { gold: [40, 70], drops: [
    { chance: 1, entries: [{ id: 'm_thorn_core', weight: 1, qty: [1, 1] }] },
    { chance: 0.5, entries: [{ id: 'w_hunter_saber', weight: 2, qty: [1, 1] }, { id: 'a_hide_vest', weight: 2, qty: [1, 1] }, { id: 'c_moss_bead', weight: 1, qty: [1, 1] }] },
  ] },
  s2_small: { gold: [40, 70], drops: [
    { chance: 1, entries: [{ id: 'm_iron_shard', weight: 2, qty: [3, 5] }, { id: 'm_beast_hide', weight: 1, qty: [2, 3] }] },
    { chance: 0.6, entries: [{ id: 'p_tonic', weight: 1, qty: [1, 2] }] },
  ] },
  s2_key: { gold: [30, 50], drops: [{ chance: 1, entries: [{ id: 'p_tonic', weight: 1, qty: [1, 2] }] }] },
  s2_rare: { gold: [80, 130], drops: [
    { chance: 1, entries: [{ id: 'm_ember_core', weight: 1, qty: [1, 2] }] },
    { chance: 0.25, entries: [{ id: 'w_ember_fang', weight: 1, qty: [1, 1] }, { id: 'a_lacquer_plate', weight: 1, qty: [1, 1] }, { id: 'c_cinder_eye', weight: 1, qty: [1, 1] }] },
  ] },
});

export const DUNGEONS = Object.freeze({
  s1: {
    rooms: [
      { id: 'gate', at: [0, 2], type: 'start', name: 'ทางเข้าป่า', lore: { x: 0.3, y: 0.38, id: 'l_notice' } },
      { id: 'fork', at: [1, 2], type: 'fight', name: 'ทางแยกมอส', scale: 1.0,
        waves: [[{ enemy: 'mossling', count: 3 }], [{ enemy: 'mossling', count: 2 }, { enemy: 'thorn_imp', count: 1 }]] },
      { id: 'camp', at: [1, 3], type: 'rest', name: 'กองไฟนักล่า', bonfire: { x: 0.5, y: 0.5 }, lore: { x: 0.78, y: 0.32, id: 'l_warden' } },
      { id: 'corridor', at: [0, 1], type: 'trap', name: 'ทางเดินหนาม',
        traps: [
          { kind: 'spikes', x: 0.12, y: 0.26, w: 0.76, h: 0.13, period: 2.6, offset: 0 },
          { kind: 'spikes', x: 0.12, y: 0.6, w: 0.76, h: 0.13, period: 2.6, offset: 1.3 },
          { kind: 'dart', x: 0.02, y: 0.47, dir: 0, period: 2.4, offset: 0.3 },
          { kind: 'dart', x: 0.98, y: 0.82, dir: 180, period: 2.4, offset: 1.5 },
        ] },
      { id: 'shrine', at: [0, 0], type: 'lore', name: 'ศาลรอยไหม้', walls: ['E'], scale: 1.05,
        waves: [[{ enemy: 'thorn_imp', count: 2 }]], lore: { x: 0.5, y: 0.42, id: 'l_altar' },
        traps: [{ kind: 'spikes', x: 0.2, y: 0.65, w: 0.2, h: 0.12, period: 2.2, offset: 0.5 }, { kind: 'spikes', x: 0.6, y: 0.65, w: 0.2, h: 0.12, period: 2.2, offset: 1.6 }] },
      { id: 'warden', at: [1, 1], type: 'key', name: 'ลานผู้เฝ้า', scale: 1.1,
        waves: [[{ enemy: 'thorn_imp', count: 2 }, { enemy: 'mossling', count: 2 }], [{ enemy: 'thorn_imp', count: 3 }]],
        chest: { x: 0.5, y: 0.36, loot: 's1_key', key: true } },
      { id: 'cache', at: [2, 1], type: 'treasure', name: 'หีบของพราน',
        chest: { x: 0.5, y: 0.3, loot: 's1_rare' },
        traps: [
          { kind: 'spikes', x: 0.3, y: 0.42, w: 0.4, h: 0.12, period: 2.0, offset: 0 },
          { kind: 'dart', x: 0.02, y: 0.3, dir: 0, period: 2.2, offset: 0.8 },
        ] },
      { id: 'thicket', at: [2, 2], type: 'fight', name: 'พงหนามซุ่ม', scale: 1.1,
        waves: [[{ enemy: 'thorn_imp', count: 3 }, { enemy: 'mossling', count: 1 }]],
        traps: [{ kind: 'spikes', x: 0.4, y: 0.42, w: 0.2, h: 0.16, period: 2.4, offset: 0.6 }],
        chest: { x: 0.82, y: 0.3, loot: 's1_small' } },
      { id: 'altar', at: [1, 0], type: 'boss', name: 'ลานบูชา', walls: ['W'], scale: 1.0,
        waves: [[{ enemy: 'thornback_boar', count: 1 }]] },
    ],
  },
  s2: {
    rooms: [
      { id: 'adit', at: [1, 2], type: 'start', name: 'ปากเหมือง', walls: ['N'] },
      { id: 'lamp', at: [0, 2], type: 'rest', name: 'ห้องตะเกียง', bonfire: { x: 0.5, y: 0.55 }, lore: { x: 0.25, y: 0.3, id: 'l_worklog' } },
      { id: 'vents', at: [0, 1], type: 'trap', name: 'ทางเดินช่องไฟ', scale: 1.0,
        traps: [
          { kind: 'vent', x: 0.1, y: 0.22, w: 0.8, h: 0.12, period: 3.0, offset: 0 },
          { kind: 'vent', x: 0.1, y: 0.44, w: 0.8, h: 0.12, period: 3.0, offset: 1.0 },
          { kind: 'vent', x: 0.1, y: 0.66, w: 0.8, h: 0.12, period: 3.0, offset: 2.0 },
        ] },
      { id: 'study', at: [0, 0], type: 'lore', name: 'ห้องทำงานของดาว', walls: ['E'], scale: 1.1,
        waves: [[{ enemy: 'ember_imp', count: 2 }, { enemy: 'cinder_beetle', count: 1 }]],
        lore: { x: 0.5, y: 0.35, id: 'l_daoletter' },
        traps: [{ kind: 'vent', x: 0.15, y: 0.62, w: 0.25, h: 0.14, period: 2.6, offset: 0.4 }, { kind: 'vent', x: 0.6, y: 0.62, w: 0.25, h: 0.14, period: 2.6, offset: 1.7 }] },
      { id: 'tracks', at: [2, 2], type: 'fight', name: 'รางเลื่อนร้าง', scale: 1.0,
        waves: [[{ enemy: 'cinder_beetle', count: 2 }, { enemy: 'ember_imp', count: 1 }], [{ enemy: 'ember_imp', count: 2 }]],
        traps: [{ kind: 'rocks', every: 3.2 }] },
      { id: 'office', at: [2, 1], type: 'fight', name: 'สำนักงานเหมือง', scale: 1.1,
        waves: [[{ enemy: 'ember_imp', count: 3 }], [{ enemy: 'cinder_beetle', count: 2 }, { enemy: 'ember_imp', count: 1 }]],
        lore: { x: 0.8, y: 0.3, id: 'l_lek' }, chest: { x: 0.2, y: 0.3, loot: 's2_small' } },
      { id: 'carts', at: [2, 0], type: 'treasure', name: 'โกดังถ่าน', walls: ['W'], scale: 1.1,
        lore: { x: 0.25, y: 0.35, id: 'l_ledger' }, chest: { x: 0.72, y: 0.3, loot: 's2_rare' },
        traps: [{ kind: 'rocks', every: 2.6 }, { kind: 'vent', x: 0.55, y: 0.45, w: 0.35, h: 0.12, period: 2.4, offset: 0.6 }] },
      { id: 'crucible', at: [1, 1], type: 'key', name: 'บ่อหลอม', scale: 1.15,
        waves: [[{ enemy: 'cinder_beetle', count: 2 }, { enemy: 'ember_imp', count: 2 }], [{ enemy: 'ember_imp', count: 3 }, { enemy: 'cinder_beetle', count: 1 }]],
        chest: { x: 0.5, y: 0.36, loot: 's2_key', key: true } },
      { id: 'foundry', at: [1, 0], type: 'boss', name: 'โรงหลอมลับ', scale: 1.0,
        waves: [[{ enemy: 'furnace_golem', count: 1 }]] },
    ],
  },
});

export function getDungeon(stageId) {
  return DUNGEONS[stageId] || null;
}
