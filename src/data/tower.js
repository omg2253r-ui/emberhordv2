// หอคอยขุมนรก 100 ชั้น (The Underworld Tower). Solo. Every floor is its own fight: a different pair or trio of
// monsters, different elite affixes and a different land (the ten lands of the zones, one per ten floors).
// Every 5th floor holds an elite guardian; every 10th floor a god of the underworld who fights alone and summons.
// Past floor 100 the tower goes on: each ASCENSION (ขุมลึก) repeats the climb with stronger monsters, new affix
// rolls and better drops — there is no top.
//
// Progress per hero: state.tower = { best, asc, bestAsc, runs, kills, gods: { godId: kills }, claimed: { floorKey: 1 } }
//   best: highest floor cleared at the current ascension · asc: current ascension (0 = first climb)
import { ZONES, zoneStats } from './zones.js';
import { createRng } from '../core/rng.js';
import { TOWER_PARTS, ARMORS_V7 } from './items2.js';
import { WEAPONS_V7 } from './weapons2.js';
const ITEMS = { ...WEAPONS_V7, ...ARMORS_V7 };

export const TOWER = Object.freeze({
  floors: 100, checkpoint: 10, eliteEvery: 5, godEvery: 10,
  levelBase: 5, levelPerFloor: 0.4,          // floor 1 ≈ level 5, floor 100 ≈ level 45
  ascLevel: 12, ascHp: 0.55, ascAtk: 0.3,    // each ascension: +12 levels worth, then ×(1+0.55·A) HP, ×(1+0.3·A) attack
  waveRest: 1.4,
});

export const floorLevel = (f, asc = 0) => TOWER.levelBase + f * TOWER.levelPerFloor + asc * TOWER.ascLevel;
export const bandOf = (f) => Math.min(10, Math.max(1, Math.ceil(f / 10)));
export const isGodFloor = (f) => f % TOWER.godEvery === 0;
export const isEliteFloor = (f) => !isGodFloor(f) && f % TOWER.eliteEvery === 0;
export const landOfFloor = (f) => ZONES[bandOf(f) - 1];

// ------------------------------------------------------------------ elite affixes (battle/affixes.js runs them)
export const AFFIXES = Object.freeze({
  swift:     { name: 'ว่องไว', color: '#9ee0c8', desc: 'เคลื่อนที่และโจมตีเร็วขึ้น เตือนสั้นลง' },
  armored:   { name: 'เกราะหนา', color: '#b8c0cc', desc: 'ป้องกันสองเท่า ทุบด้วยท่าหนักจะเจาะได้' },
  vampiric:  { name: 'ดูดเลือด', color: '#e0503a', desc: 'ฟื้นพลังชีวิตจากดาเมจที่ทำได้' },
  volatile:  { name: 'ระเบิดตาย', color: '#ff8a3d', desc: 'ตายแล้วระเบิดเป็นวง (มีวงเตือน)' },
  splitting: { name: 'แยกร่าง', color: '#c8b8ff', desc: 'ตายแล้วแตกเป็นร่างเล็กสองตัว' },
  warded:    { name: 'โล่อมตะ', color: '#ffe89a', desc: 'กางโล่อมตะเป็นช่วงๆ รอจังหวะโล่หายแล้วค่อยตี (ถ้าเป็นบอสผู้พิทักษ์ จะได้เกราะประจำเฟสแทน)' },
  frenzied:  { name: 'คลั่ง', color: '#ff5a5a', desc: 'เลือดต่ำกว่า 40% จะแรงและเร็วขึ้นมาก' },
  piercing:  { name: 'เจาะเกราะ', color: '#ff3a6a', desc: 'การโจมตีทะลุโล่และไม่สนค่าป้องกัน ต้องหลบเท่านั้น' },
  regen:     { name: 'ฟื้นตัว', color: '#7fc77a', desc: 'ฟื้นพลังชีวิตเมื่อไม่โดนตีครู่หนึ่ง กดดันต่อเนื่อง' },
  molten:    { name: 'ลาวา', color: '#ff7a33', desc: 'ทิ้งบ่อไฟไว้ตามทาง' },
  frost:     { name: 'เยือกแข็ง', color: '#9fd8ff', desc: 'โดนตีแล้วช้าลง สะสมจนแข็งทื่อ' },
  giant:     { name: 'ยักษ์', color: '#c8a46a', desc: 'ตัวใหญ่ พลังชีวิตมาก ไม่สะดุ้ง' },
  shadow:    { name: 'เงา', color: '#7a6aa8', desc: 'หายตัวเป็นระยะ โผล่หลังเป้าหมาย' },
});
export const AFFIX_IDS = Object.freeze(Object.keys(AFFIXES));

// normal monsters the tower may field (zone boss parts like pylons and split children are left out)
const POOL = ZONES.flatMap((z) => z.monsters).filter((id, i, a) => a.indexOf(id) === i);

// ------------------------------------------------------------------ the ten gods of the underworld
export const GODS = Object.freeze([
  { id: 't_god_river', floor: 10, name: 'วาริยะ เทพแห่งแม่น้ำวิญญาณ', title: 'ผู้แจวเรือข้ามฝั่งสุดท้าย', ai: 'god_river', relic: 'm_hell1',
    color: '#7fe8ff', particles: ['#7fe8ff', '#2a4a6a', '#ffffff'], radius: 70, speed: 110, hpMul: 55, atkMul: 1.4, summon: 'z_bog_toad',
    mechanic: 'จมลงแม่น้ำ (ตัวจางลงแต่ยังโดนตี) แล้วโผล่พร้อมน้ำพุ · กระแสน้ำผลักไปข้างเดียว · พายแจวกวาดแพร์รี่ได้',
    lore: 'วาริยะแจวเรือพาวิญญาณข้ามแม่น้ำมาตั้งแต่ก่อนมีชื่อเรียก เขาไม่เคยถามว่าใครอยากไป เขาแค่ไม่ยอมให้ใครกลับ' },
  { id: 't_god_chains', floor: 20, name: 'กาฬโลหิต เทพแห่งโซ่ตรวน', title: 'ผู้คุมนักโทษนิรันดร์', ai: 'god_chains', relic: 'm_hell2',
    color: '#b8b8c4', particles: ['#b8b8c4', '#5a1a1a', '#e0503a'], radius: 66, speed: 100, hpMul: 62, atkMul: 1.45, summon: 'z_bone_lancer',
    mechanic: 'โซ่ล่ามดึงตัว · โซ่ฟาดเจาะเกราะ (กันไม่ได้) · ล่ามตัวเองกับหมุดโซ่ ทุบหมุดทั้งสามให้เสียหลัก',
    lore: 'ทุกโซ่ของกาฬโลหิตเคยล่ามใครไว้สักคน เขาจำชื่อนักโทษได้ทุกคน และไม่เคยลืมว่าใครหนีไปได้' },
  { id: 't_god_hellfire', floor: 30, name: 'มารีจิ เทพแห่งเปลวไฟนรก', title: 'เตาเผาที่ไม่มีวันมอด', ai: 'god_hellfire', relic: 'm_hell3',
    color: '#ff5a1a', particles: ['#ff5a1a', '#3a0e0a', '#ffcf5a'], radius: 68, speed: 120, hpMul: 68, atkMul: 1.5, summon: 'z_magma_hound',
    mechanic: 'โล่เปลวไฟเป็นเกราะประจำเฟส ดูดดาเมจก่อน หายไปหลังระเบิดวงใหญ่ (ช่องโหว่ 5 วินาที) · วงไฟซ้อนที่มีช่องให้ลอด · ทะเลเพลิง',
    lore: 'มารีจิไม่ได้เกลียดใคร เขาแค่หิว และสิ่งเดียวที่ทำให้อิ่มได้คือทุกอย่าง' },
  { id: 't_god_silence', floor: 40, name: 'สุญญตา เทพแห่งความเงียบ', title: 'เงาที่กลืนเสียง', ai: 'god_silence', relic: 'm_hell4',
    color: '#5a5a7a', particles: ['#5a5a7a', '#14121c', '#c8c8ff'], radius: 60, speed: 150, hpMul: 66, atkMul: 1.55, summon: 'z_shade_stalker',
    mechanic: 'แยกร่างเงา (มีร่างจริงร่างเดียว) · ปิดเสียง: ห้ามใช้สกิล 3 วินาที · ความมืดบดบังห้อง',
    lore: 'ในห้องของสุญญตาไม่มีเสียงสะท้อน คนที่หายไปในนั้นไม่ได้ตาย แค่ไม่มีใครได้ยินเสียงเรียกของพวกเขาอีก' },
  { id: 't_god_judge', floor: 50, name: 'ยมทัณฑ์ ผู้ชั่งวิญญาณ', title: 'ตาชั่งที่ไม่เคยเอียง', ai: 'god_judge', relic: 'm_hell5',
    color: '#e0b45a', particles: ['#e0b45a', '#2a2a3a', '#ffffff'], radius: 64, speed: 100, hpMul: 74, atkMul: 1.55, summon: 'z_feather_monk',
    mechanic: 'บาป: ทุกครั้งที่โดนตีจะสะสมบาป · คำตัดสินแรงตามบาป · ตาชั่งเอียง: ครึ่งห้องถูกพิพากษาสลับข้าง',
    lore: 'ยมทัณฑ์ไม่เคยลงโทษใคร เขาแค่ชั่ง แล้วปล่อยให้น้ำหนักของบาปทำงานเอง' },
  { id: 't_god_serpent', floor: 60, name: 'พิษภุชงค์ เทพอสรพิษ', title: 'งูที่กลืนแม่น้ำ', ai: 'god_serpent', relic: 'm_hell6',
    color: '#a8d070', particles: ['#a8d070', '#1a3a2a', '#e8ff9a'], radius: 72, speed: 160, hpMul: 80, atkMul: 1.6, summon: 'z_spore_puff',
    mechanic: 'มุดดิน (ตัวจางลงแต่ยังโดนตี) แล้วพุ่งขึ้นจุดที่เตือน · ฟาดหางเจาะเกราะ · บึงพิษค่อยๆ ท่วมห้อง',
    lore: 'พิษภุชงค์ลอกคราบทุกพันปี และทุกครั้งที่ลอก ขุมนรกก็ลึกลงอีกหนึ่งชั้น' },
  { id: 't_god_time', floor: 70, name: 'ราตรีกาล เทพนาฬิกาตาย', title: 'ผู้นับลมหายใจสุดท้าย', ai: 'god_time', relic: 'm_hell7',
    color: '#fff3c4', particles: ['#fff3c4', '#3a2a1a', '#c8a050'], radius: 64, speed: 110, hpMul: 86, atkMul: 1.65, summon: 'z_volt_drone',
    mechanic: 'เข็มนาฬิกากวาดรอบห้อง · ย้อนเวลา: ฟื้นเลือดกลับ ถ้าไม่ตีขัดในวงนาฬิกา · หยุดเวลาทำให้เราช้า',
    lore: 'นาฬิกาของราตรีกาลเดินถอยหลัง ทุกครั้งที่มันตี ใครสักคนในโลกเหลือเวลาน้อยลงหนึ่งวินาที' },
  { id: 't_god_masks', floor: 80, name: 'ทศพักตร์มาร เทพพันหน้า', title: 'ผู้ไม่มีหน้าจริง', ai: 'god_masks', relic: 'm_hell8',
    color: '#ff5a9a', particles: ['#ff5a9a', '#3a1a3a', '#ffd0e0'], radius: 66, speed: 130, hpMul: 92, atkMul: 1.7, summon: 'z_cinder_mage',
    mechanic: 'หน้ากากเก้าหน้าหมุนรอบตัว มีแค่หน้ากากสีขาว 3 หน้าที่ตีเข้า · หน้าผิดสะท้อนดาเมจกลับ · ร่างกระจกเลียนท่า',
    lore: 'ทศพักตร์มารเปลี่ยนหน้าทุกครั้งที่โกหก ไม่มีใครรู้ว่าหน้าแรกของมันเป็นอย่างไร รวมถึงตัวมันเอง' },
  { id: 't_god_frost', floor: 90, name: 'อสุรเหม เทพขุมน้ำแข็ง', title: 'ความหนาวที่ไม่มีก้น', ai: 'god_frost', relic: 'm_hell9',
    color: '#cfeaff', particles: ['#cfeaff', '#2a4a6a', '#ffffff'], radius: 72, speed: 100, hpMul: 100, atkMul: 1.75, summon: 'z_frost_slime',
    mechanic: 'รังน้ำแข็ง: โล่น้ำแข็งที่ต้องทุบแตกก่อน · หิมะเยือกแข็ง: ยืนนิ่งจะแข็งทื่อ · หอกน้ำแข็งเจาะเกราะ',
    lore: 'ขุมลึกที่สุดของนรกไม่ใช่ไฟ แต่เป็นน้ำแข็ง ที่นั่นแม้แต่ความเกลียดก็แข็งตัว' },
  { id: 't_god_king', floor: 100, name: 'มหากาฬ ราชันแห่งขุมนรก', title: 'บัลลังก์ที่ไม่มีวันว่าง', ai: 'god_king', relic: 'm_hell10',
    color: '#ff3a3a', particles: ['#ff3a3a', '#1a0a10', '#f5c35a'], radius: 78, speed: 120, hpMul: 120, atkMul: 1.85, summon: 'z_ash_revenant',
    mechanic: 'สามเฟส ยืมพลังเทพทั้งเก้า · เฟสสุดท้าย: บัลลังก์เรียกเงาเทพ ทำลายเงาให้หมดเพื่อให้เสียหลัก',
    lore: 'เทพทั้งเก้าคุกเข่าให้มหากาฬ ไม่ใช่เพราะกลัว แต่เพราะเขาคือคนเดียวที่เคยปีนออกจากขุมนรกได้ แล้วเลือกเดินกลับลงมา' },
]);
export const godOfFloor = (f) => GODS.find((g) => g.floor === ((f - 1) % 100) + 1) || null;

// god enemy definitions (merged into the online-zone enemy list for networking and art)
function godDef(g) {
  const base = zoneStats(floorLevel(g.floor));
  return [g.id, Object.freeze({
    id: g.id, name: g.name, sprite: g.id, zone: 'tower', boss: true, god: true, faces: true, particles: g.particles,
    hp: Math.round(base.hp * g.hpMul), atk: Math.round(base.atk * g.atkMul), def: Math.round(base.def * 1.7),
    speed: g.speed, radius: g.radius, mass: 16, xp: Math.round(base.xp * 26), gold: [base.gold[0] * 20, base.gold[1] * 20], sparks: 10 + g.floor / 5,
    interruptAt: 3.5, flying: false, ai: g.ai, ai_params: Object.freeze({ summon: g.summon, color: g.color }), drops: [],
  })];
}
export const TOWER_ENEMIES = Object.freeze(Object.fromEntries(GODS.map(godDef)));

// ------------------------------------------------------------------ floor plans
// Generated once, deterministically; no two floors share monsters + affixes + land. Tested in tests/unit/v7tower.test.mjs.
function planFor(f, rng) {
  const band = bandOf(f), land = landOfFloor(f);
  if (isGodFloor(f)) {
    const g = godOfFloor(f);
    return { floor: f, band, land: land.id, theme: land.theme, mechanic: land.mechanic, god: g.id, waves: [[[g.id, 1]]], affixes: [] };
  }
  // monsters: lean on this land's own beasts, mix in ones from other lands as the tower deepens
  const own = land.monsters.slice();
  const pick = () => POOL[(rng.next() * POOL.length) | 0];
  const types = new Set([own[(rng.next() * own.length) | 0]]);
  const want = band >= 6 ? 3 : 2;
  while (types.size < want) types.add(rng.next() < 0.45 ? own[(rng.next() * own.length) | 0] : pick());
  const list = [...types];
  const nAff = band <= 2 ? (rng.next() < 0.5 ? 1 : 0) : band <= 5 ? 1 + (rng.next() < 0.3 ? 1 : 0) : band <= 8 ? 2 : 2 + (rng.next() < 0.5 ? 1 : 0);
  const affixes = [];
  while (affixes.length < nAff) { const a = AFFIX_IDS[(rng.next() * AFFIX_IDS.length) | 0]; if (!affixes.includes(a)) affixes.push(a); }
  const per = 2 + Math.floor(band / 3);
  const waves = [];
  const nWaves = band >= 5 ? 3 : 2;
  for (let w = 0; w < nWaves; w++) waves.push(list.map((id, i) => [id, Math.max(1, per - ((i + w) % 2))]));
  const plan = { floor: f, band, land: land.id, theme: land.theme, mechanic: land.mechanic, god: null, waves, affixes, types: list };
  if (isEliteFloor(f)) {
    // an elite guardian: a boss of some land, wearing extra affixes
    const lands = ZONES.slice(0, Math.min(ZONES.length, band + 2));
    plan.elite = lands[(rng.next() * lands.length) | 0].boss;
    plan.waves.push([[plan.elite, 1]]);
  }
  return plan;
}
const PLANS = (() => {
  const out = [], seen = new Set();
  for (let f = 1; f <= TOWER.floors; f++) {
    let seed = 7919 * f, plan;
    for (let tries = 0; tries < 50; tries++) {
      plan = planFor(f, createRng(seed + tries * 104729));
      const sig = plan.god || `${plan.land}|${[...plan.types].sort().join(',')}|${[...plan.affixes].sort().join(',')}|${plan.elite || ''}`;
      if (!seen.has(sig)) { seen.add(sig); plan.sig = sig; break; }
    }
    out.push(Object.freeze(plan));
  }
  return out;
})();
// floor f (1..100) at ascension asc: ascensions re-roll the affixes so a repeat climb never plays the same
export function floorPlan(f, asc = 0) {
  const base = PLANS[Math.max(1, Math.min(TOWER.floors, f)) - 1];
  if (!asc || base.god) return asc && base.god ? { ...base, asc } : base;
  const rng = createRng(f * 31337 + asc * 977);
  const affixes = base.affixes.slice();
  const extra = Math.min(2, asc);
  while (affixes.length < base.affixes.length + extra && affixes.length < AFFIX_IDS.length) { const a = AFFIX_IDS[(rng.next() * AFFIX_IDS.length) | 0]; if (!affixes.includes(a)) affixes.push(a); }
  return { ...base, affixes, asc };
}

// co-op climb (up to 8 heroes): monsters and bosses scale with how many heroes are in the climb right now.
// 1 hero = the solo tuning; every extra hero adds health (to match the extra damage), a little attack, and a faster tempo.
export const TOWER_PARTY = Object.freeze({ max: 8, hp: 0.8, atk: 0.08, tempo: 0.035, reviveTime: 7, reviveHp: 0.5 });
export function towerPartyScale(n) {
  const k = Math.max(1, Math.min(TOWER_PARTY.max, Math.round(Number(n)) || 1)) - 1;
  return { hp: 1 + TOWER_PARTY.hp * k, atk: 1 + TOWER_PARTY.atk * k, tempo: 1 + TOWER_PARTY.tempo * k };
}

// how much stronger a monster is on floor f (relative to its home land)
export function towerScale(def, f, asc = 0) {
  if (def.god) {
    // gods are built for their own floor; ascensions lift them like everyone else
    const a = zoneStats(floorLevel(f, asc)), b = zoneStats(floorLevel(f));
    return { hp: (a.hp / b.hp) * (1 + TOWER.ascHp * asc), atk: (a.atk / b.atk) * (1 + TOWER.ascAtk * asc), def: a.def / b.def };
  }
  const home = ZONES.find((z) => z.id === def.zone);
  const from = zoneStats(home ? home.level : 10), to = zoneStats(floorLevel(f, asc));
  const elite = def.boss ? 0.55 : 1;           // land bosses as elite guardians are trimmed (they keep their full kit)
  return { hp: (to.hp / from.hp) * (1 + TOWER.ascHp * asc) * elite * 1.15, atk: (to.atk / from.atk) * (1 + TOWER.ascAtk * asc), def: to.def / from.def };
}

// ------------------------------------------------------------------ rewards
// Soulslike loot: little is certain, the rare things are rare, and deeper floors pay more.
const BAND_GEAR = Object.freeze({
  1: ['w_flamberge', 'w_kris_pair', 'w_featherwing_bow', 'w_jade_leaf_twins', 'a_river_ferryman', 'a_moss_ranger'],
  2: ['w_crimson_nodachi', 'w_tidebreaker', 'w_crescent_staff', 'w_war_halberd', 'w_sakura_scythe', 'a_chain_warden', 'a_ember_apprentice'],
  3: ['w_crystal_edge', 'w_executioner', 'w_rootheart_staff', 'w_twin_moon_scythe', 'a_hellfire_vest', 'a_bone_vanguard', 'a_wanderer_fur'],
  4: ['w_moonglass_katana', 'w_fang_hook', 'w_abyss_trident', 'a_silent_shroud', 'a_frost_lamellar'],
  5: ['w_dragonbone_blade', 'w_vertebra_bow', 'w_ribcage_reaper', 'a_judge_mantle', 'a_crystal_aegis'],
  6: ['w_bonesaw', 'w_obsidian_cleaver', 'w_serpent_staff', 'a_serpent_scale', 'a_rune_harness'],
  7: ['w_thunder_katana', 'w_storm_longbow', 'w_shadow_fangs', 'a_clockwork_plate', 'a_storm_knight'],
  8: ['w_needle_stiletto', 'w_serpent_glaive', 'a_thousand_mask', 'a_ash_monk'],
  9: ['w_soul_eye_staff', 'a_glacier_bastion', 'a_void_wrap'],
  10: ['w_sunblade', 'w_sun_moon_twins', 'a_netherking_regalia'],
});
export const bandGear = (b) => BAND_GEAR[Math.max(1, Math.min(10, b))];
// the ordinary rolls never give mythics: those come only from the 1.5% roll of the deepest gods (and a sliver on floors 91–99)
const plainGear = (b) => { const l = bandGear(b).filter((id) => ITEMS[id]?.rarity !== 'mythic'); return l.length ? l : bandGear(b - 1).filter((id) => ITEMS[id]?.rarity !== 'mythic'); };
const mythicGear = (b) => bandGear(b).filter((id) => ITEMS[id]?.rarity === 'mythic');
const MATS = (b) => [
  { id: 'm_iron_shard', weight: 4, qty: [2 + b, 4 + b * 2] }, { id: 'm_beast_hide', weight: 3, qty: [1 + b, 3 + b] },
  { id: 'm_thorn_core', weight: 2, qty: [1, 1 + Math.ceil(b / 3)] }, { id: 'm_ember_core', weight: b >= 3 ? 2 : 0, qty: [1, 1 + Math.ceil(b / 4)] },
].filter((x) => x.weight > 0);
// drop tables for the floor's reward chest (rolled with systems/loot.js rollDrops)
export function floorDrops(f, asc = 0) {
  const b = bandOf(f), luck = 1 + 0.25 * asc;
  const gear = (list, w = 1) => list.map((id) => ({ id, weight: w, qty: [1, 1] }));
  const relic = TOWER_PARTS['t' + b];
  if (isGodFloor(f)) {
    const g = godOfFloor(f);
    const out = [
      { chance: 1, entries: [{ id: g.relic, weight: 1, qty: [1 + asc, 3 + asc] }] },
      { chance: 1, entries: MATS(b) }, { chance: 1, entries: MATS(b) },
      { chance: Math.min(1, 0.3 * luck), entries: gear(plainGear(b)) },
      { chance: Math.min(1, 0.6 * luck), entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
    ];
    // the deepest gods guard the mythics: 1.5% a kill (more in the ascensions)
    if (mythicGear(b).length) out.push({ chance: Math.min(0.2, 0.015 * luck), entries: gear(mythicGear(b)) });
    return out;
  }
  const out = [{ chance: 0.85, entries: MATS(b) }, { chance: Math.min(0.5, 0.05 * luck * (isEliteFloor(f) ? 4 : 1)), entries: gear(plainGear(b)) }];
  if (mythicGear(b).length) out.push({ chance: Math.min(0.05, 0.002 * luck * (isEliteFloor(f) ? 3 : 1)), entries: gear(mythicGear(b)) });
  if (relic && b > 1) out.push({ chance: Math.min(0.6, 0.06 * luck * (isEliteFloor(f) ? 3 : 1)), entries: [{ id: TOWER_PARTS['t' + (b - 1)], weight: 1, qty: [1, 1] }] });
  if (b >= 3) out.push({ chance: Math.min(0.3, 0.03 * luck), entries: gear(bandGear(Math.max(1, b - 1))) });
  return out;
}
// gold / sparks / xp for clearing a floor (first clear pays much more; repeat clears still pay)
export function floorReward(f, asc = 0, first = false) {
  const L = floorLevel(f, asc), god = isGodFloor(f), elite = isEliteFloor(f);
  const k = god ? 8 : elite ? 3 : 1;
  return {
    gold: Math.round((30 + L * 6) * k * (first ? 3 : 1)),
    sparks: god ? (first ? 30 : 6) + asc * 4 : elite ? (first ? 6 : 1) : first && f % 3 === 0 ? 2 : 0,
    xp: Math.round((20 + L * 5) * k * (first ? 2 : 1)),
  };
}

// a zone-like object the co-op scene runs for floor f
export function towerZone(f, asc = 0) {
  const plan = floorPlan(f, asc), land = landOfFloor(f);
  const g = plan.god ? GODS.find((x) => x.id === plan.god) : null;
  return {
    id: 'tower', n: 30 + plan.band, tower: true, name: `หอคอยขุมนรก ชั้น ${f}${asc ? ` · ขุมลึก ${asc}` : ''}`,
    level: Math.round(floorLevel(f, asc)), tier: Math.min(3, Math.floor(plan.band / 3)), theme: land.theme, mechanic: plan.god ? 'none' : land.mechanic,
    mechanicText: g ? g.mechanic : `${land.name}: ${land.mechanicText}`, monsters: plan.types || [], boss: plan.god || plan.elite || null, rooms: ['floor'],
    desc: g ? g.lore : 'ทุกชั้นมีศัตรูและคำสาปไม่ซ้ำกัน', floor: f, asc, plan,
  };
}

export function towerProgress(state) {
  const t = state.tower || {};
  return { best: t.best || 0, asc: t.asc || 0, bestAsc: t.bestAsc || 0, runs: t.runs || 0, kills: t.kills || 0, gods: t.gods || {} };
}
// floors a hero may start from: floor 1, every checkpoint reached (11, 21, …), and the next uncleared floor
export function startFloors(state) {
  const { best } = towerProgress(state);
  const out = [1];
  for (let f = TOWER.checkpoint + 1; f <= Math.min(TOWER.floors, best + 1); f += TOWER.checkpoint) out.push(f);
  const next = Math.min(TOWER.floors, best + 1);
  if (!out.includes(next)) out.push(next);
  return out;
}
export function towerLock(state) {
  if (!state.progress?.cleared?.s1) return 'ผ่านป่าหนามสนธยาในเนื้อเรื่องก่อน';
  if ((state.player?.level || 1) < 5) return 'ต้องเลเวล 5 ขึ้นไป';
  return null;
}
// score for the leaderboard: ascension first, then floor
export const towerScore = (state) => { const t = towerProgress(state); return t.asc * 100 + t.best; };
