// Crafting with the village chief (หัวหน้าหมู่บ้าน).
//
//   1. Bring him a piece of gear you own — he takes it apart and draws its BLUEPRINT (the piece is used up).
//   2. With a blueprint, he forges that piece again, any time, from a recipe of gold, sparks and materials.
//
// Recipes are computed from the piece itself so every weapon, armour, charm and pair of wings in the game has one:
//   gold & sparks  — by rarity (a forge job costs roughly what a few runs of that tier pay)
//   base metal     — iron for weapons, hide for armour, cores for charms, feathers of the zones for wings
//   its homeland   — the part dropped where the piece is found (a zone part, a raid scale, or the story cores)
//   rarer pieces   — more of everything, plus bloodstone for legendaries
// Two pieces have hand-written recipes: the Heaven Scythe and the secret twin blades. The secret blueprint is never
// shown by name: the chief only recognises it when you carry both the Heart of Wrath and the Prophecy Eye.
import { ITEMS, getItem, isEquipment } from './items.js';
import { ZONE_PARTS } from './zones.js';
import { TOWER_PARTS } from './items2.js';

export const CRAFT_RARITY = Object.freeze({
  common:    { gold: 150,    sparks: 0,    base: 4,  home: 0, extra: 0 },
  uncommon:  { gold: 450,    sparks: 4,    base: 8,  home: 1, extra: 0 },
  rare:      { gold: 1600,   sparks: 15,   base: 12, home: 2, extra: 1 },
  epic:      { gold: 5500,   sparks: 50,   base: 18, home: 4, extra: 2 },
  legendary: { gold: 18000,  sparks: 160,  base: 26, home: 7, extra: 4 },
  mythic:    { gold: 150000, sparks: 1500, base: 40, home: 20, extra: 8 },
});

// where a piece comes from → what its homeland gives
const RAID_PARTS = Object.freeze({ r1: 'm_wrath_scale', r2: 'm_prophecy_scale', r3: 'm_judgment_sigil' });
function homePart(src) {
  if (ZONE_PARTS[src]) return ZONE_PARTS[src];
  if (RAID_PARTS[src]) return RAID_PARTS[src];
  if (TOWER_PARTS[src]) return TOWER_PARTS[src];       // v7: gear of the tower carries its god's relic
  if (src === 's2') return 'm_ember_core';
  return 'm_thorn_core';
}
const BASE = Object.freeze({ weapon: 'm_iron_shard', armor: 'm_beast_hide', charm: 'm_thorn_core', wings: 'm_storm_quill' });
const SECOND = Object.freeze({ weapon: 'm_beast_hide', armor: 'm_iron_shard', charm: 'm_ember_core', wings: 'm_beast_hide' });

export const SPECIAL_RECIPES = Object.freeze({
  w_sun_yoru: {
    gold: 200000, sparks: 2000,
    mats: [['m_anubis_scale', 1], ['m_sekhmet_fang', 1], ['m_ra_eye', 1], ['m_egypt_sigil', 30], ['m_sun_relic', 8], ['m_bloodstone', 3]],
  },
  w_sovereign_twins: {
    gold: 250000, sparks: 2500,
    mats: [['m_wrath_heart', 1], ['m_prophecy_eye', 1], ['m_wrath_scale', 30], ['m_prophecy_scale', 30], ['m_judgment_sigil', 8],
           ['m_ash_crown_shard', 6], ['m_rift_scale', 6], ['m_halo_shard', 6], ['m_storm_coil', 6], ['m_bloodstone', 3]],
  },
  w_heaven_scythe: {
    gold: 180000, sparks: 1800,
    mats: [['m_judgment_sigil', 40], ['m_halo_shard', 12], ['m_ash_crown_shard', 8], ['m_sun_relic', 8], ['m_bloodstone', 3]],
  },
});
// the secret blueprint: revealed (and kept for ever) once both relics are in the bag at the same time
export const SECRET = Object.freeze({ id: 'w_sovereign_twins', needs: ['m_wrath_heart', 'm_prophecy_eye'],
  hint: 'หัวหน้ากระซิบ: "นำหัวใจที่ยังเต้นและดวงตาที่ยังมองเห็นมาพร้อมกัน แล้วข้าจะวาดสิ่งที่ไม่เคยมีใครเห็นให้"' });

export function recipeFor(id) {
  const def = getItem(id);
  if (!def || !isEquipment(def) || def.noCraft) return null;     // v8: the eclipse blade is never forged
  if (SPECIAL_RECIPES[id]) return { id, ...SPECIAL_RECIPES[id], mats: SPECIAL_RECIPES[id].mats.map(([m, n]) => ({ id: m, qty: n })) };
  const r = CRAFT_RARITY[def.rarity] || CRAFT_RARITY.common;
  const cat = def.category;
  const mats = new Map();
  const add = (m, n) => { if (n > 0 && getItem(m)) mats.set(m, (mats.get(m) || 0) + n); };
  add(BASE[cat] || 'm_iron_shard', r.base);
  add(SECOND[cat] || 'm_beast_hide', Math.ceil(r.base / 2));
  add(homePart(def.src), r.home);
  if (r.extra) add(def.rarity === 'rare' ? 'm_thorn_core' : 'm_ember_core', r.extra);
  if (def.rarity === 'legendary') add('m_bloodstone', 1);
  if (def.rarity === 'mythic') add('m_bloodstone', 2);
  return { id, gold: r.gold, sparks: r.sparks, mats: [...mats.entries()].map(([m, n]) => ({ id: m, qty: n })) };
}

// everything that can be crafted (all gear in the game)
export const CRAFTABLE = Object.freeze(Object.values(ITEMS).filter((d) => isEquipment(d) && !d.noCraft).map((d) => d.id));
