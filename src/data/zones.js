// The ten online zones (ดันเจี้ยนรวม): each has its own ground, a zone mechanic that changes how you move and dodge,
// two monsters with their own attack patterns, and a boss. Runs are 3 rooms: two fight rooms and the boss room.
// Up to 4 players go in together (or one alone); enemy HP grows with the party size.
//
// Enemy stats come from the zone level (zoneStats) times per-monster multipliers, so balance lives in one place.


export const ZONE_ROOM = Object.freeze({ w: 1600, h: 1040, wall: 60 });   // v8: bigger (was 1240×820) — room to move and to read patterns
export const PARTY_HP_SCALE = 0.6;     // +60% enemy HP per extra player

// Base numbers for a normal monster at zone level L (a boss multiplies these).
export function zoneStats(level) {
  // v8: tougher (was hp 34 + 9L, atk 9 + 1.7L, def 2 + 0.65L)
  return { hp: 40 + level * 11, atk: 10 + level * 2, def: 2 + level * 0.75, xp: 6 + level * 2.2, gold: [4 + level, 8 + level * 2] };
}

// Shared drop pools by tier (0..3). Existing items only, plus each boss's own legendary.
const MAT = [
  [{ id: 'm_iron_shard', weight: 6, qty: [1, 3] }, { id: 'm_beast_hide', weight: 3, qty: [1, 2] }, { id: 'p_tonic', weight: 1, qty: [1, 1] }],
  [{ id: 'm_iron_shard', weight: 5, qty: [2, 3] }, { id: 'm_beast_hide', weight: 4, qty: [1, 2] }, { id: 'm_thorn_core', weight: 1, qty: [1, 1] }, { id: 'p_tonic', weight: 1, qty: [1, 1] }],
  [{ id: 'm_iron_shard', weight: 4, qty: [2, 4] }, { id: 'm_beast_hide', weight: 4, qty: [2, 3] }, { id: 'm_thorn_core', weight: 2, qty: [1, 1] }, { id: 'm_ember_core', weight: 1, qty: [1, 1] }],
  [{ id: 'm_iron_shard', weight: 3, qty: [3, 5] }, { id: 'm_beast_hide', weight: 3, qty: [2, 4] }, { id: 'm_thorn_core', weight: 2, qty: [1, 2] }, { id: 'm_ember_core', weight: 2, qty: [1, 1] }],
];
const GEAR = [
  [{ id: 'w_hunter_saber', weight: 1, qty: [1, 1] }, { id: 'w_ronin_katana', weight: 1, qty: [1, 1] }, { id: 'w_twin_fangs', weight: 1, qty: [1, 1] }, { id: 'a_hide_vest', weight: 1, qty: [1, 1] }, { id: 'c_moss_bead', weight: 1, qty: [1, 1] },
   { id: 'w_reaper_hook', weight: 1, qty: [1, 1] }, { id: 'w_twin_sabers', weight: 1, qty: [1, 1] }, { id: 'a_wanderer_coat', weight: 1, qty: [1, 1] }],
  [{ id: 'w_thorn_edge', weight: 1, qty: [1, 1] }, { id: 'w_mist_katana', weight: 1, qty: [1, 1] }, { id: 'w_venom_daggers', weight: 1, qty: [1, 1] }, { id: 'w_boar_breaker', weight: 1, qty: [1, 1] }, { id: 'w_thorn_rod', weight: 1, qty: [1, 1] }, { id: 'w_thornstring_bow', weight: 1, qty: [1, 1] }, { id: 'w_thorn_pike', weight: 1, qty: [1, 1] }, { id: 'a_bark_mail', weight: 1, qty: [1, 1] }, { id: 'c_boar_tusk', weight: 1, qty: [1, 1] },
   { id: 'w_thornreap', weight: 1, qty: [1, 1] }, { id: 'w_twin_thorns', weight: 1, qty: [1, 1] }, { id: 'a_ronin_lamellar', weight: 1, qty: [1, 1] }, { id: 'a_moonlit_robe', weight: 1, qty: [1, 1] }, { id: 'wg_kinnaree', weight: 1, qty: [1, 1] }, { id: 'wg_ash_bat', weight: 1, qty: [1, 1] }],
  [{ id: 'w_ember_fang', weight: 1, qty: [1, 1] }, { id: 'w_moonfall_katana', weight: 1, qty: [1, 1] }, { id: 'w_cinder_talons', weight: 1, qty: [1, 1] }, { id: 'w_furnace_cleaver', weight: 1, qty: [1, 1] }, { id: 'w_ember_scepter', weight: 1, qty: [1, 1] }, { id: 'w_sunfire_bow', weight: 1, qty: [1, 1] }, { id: 'w_ember_glaive', weight: 1, qty: [1, 1] }, { id: 'a_lacquer_plate', weight: 1, qty: [1, 1] }, { id: 'c_cinder_eye', weight: 1, qty: [1, 1] },
   { id: 'w_ember_scythe', weight: 1, qty: [1, 1] }, { id: 'w_twin_embers', weight: 1, qty: [1, 1] }, { id: 'a_iron_bastion', weight: 1, qty: [1, 1] }, { id: 'a_wolf_knight', weight: 1, qty: [1, 1] }, { id: 'wg_sky_crystal', weight: 1, qty: [1, 1] }],
];
// Each zone boss leaves a rare part used by the village chief's recipes (src/data/crafting.js).
export const ZONE_PARTS = Object.freeze({ z1: 'm_storm_quill', z2: 'm_frost_heart', z3: 'm_hydra_fang', z4: 'm_umbral_shard', z5: 'm_sun_relic', z6: 'm_spore_crown', z7: 'm_storm_coil', z8: 'm_rift_scale', z9: 'm_halo_shard', z10: 'm_ash_crown_shard', z11: 'm_mirror_shard', z12: 'm_eclipse_core', z13: 'm_egypt_sigil' });
// Extra legendaries some bosses also guard.
const BOSS_EXTRA = Object.freeze({ z4: 'w_dusk_scythe', z7: 'w_twin_tempest' });
// v7: each land also has its own armour (bosses drop it; its monsters, rarely)
const ZONE_ARMOR = Object.freeze({ z1: 'a_gale_vest', z3: 'a_marsh_waders', z5: 'a_dune_wrap', z6: 'a_spore_coat', z7: 'a_foundry_plate', z8: 'a_magma_scale', z9: 'a_sky_vestment', z10: 'a_ashen_guard' });
function monsterDrops(tier, zoneId) {
  const out = [
    { chance: 0.55, entries: MAT[tier] },
    { chance: 0.03 + tier * 0.01, entries: GEAR[Math.min(2, tier)] },
  ];
  if (ZONE_PARTS[zoneId]) out.push({ chance: 0.04, entries: [{ id: ZONE_PARTS[zoneId], weight: 1, qty: [1, 1] }] });
  if (ZONE_ARMOR[zoneId]) out.push({ chance: 0.006, entries: [{ id: ZONE_ARMOR[zoneId], weight: 1, qty: [1, 1] }] });
  return out;
}
function bossDrops(tier, legendary, zoneId) {
  const out = [
    { chance: 1, entries: MAT[tier] }, { chance: 1, entries: MAT[tier] },
    { chance: 0.6, entries: GEAR[Math.min(2, tier)] },
    { chance: 0.25 + tier * 0.05, entries: GEAR[2] },
    { chance: 0.12 + tier * 0.03, entries: [{ id: legendary, weight: 1, qty: [1, 1] }] },
    { chance: 0.4, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
  ];
  if (ZONE_PARTS[zoneId]) out.push({ chance: 0.85, entries: [{ id: ZONE_PARTS[zoneId], weight: 1, qty: [1, 3] }] });
  if (BOSS_EXTRA[zoneId]) out.push({ chance: 0.08 + tier * 0.02, entries: [{ id: BOSS_EXTRA[zoneId], weight: 1, qty: [1, 1] }] });
  if (ZONE_ARMOR[zoneId]) out.push({ chance: 0.1 + tier * 0.02, entries: [{ id: ZONE_ARMOR[zoneId], weight: 1, qty: [1, 1] }] });
  return out;
}

// ------------------------------------------------------------------ zones
export const ZONES = Object.freeze([
  { id: 'z1', n: 1, name: 'ทุ่งหญ้าลมกรด', level: 6, tier: 0, theme: 'gale', mechanic: 'gale',
    desc: 'ทุ่งหญ้ากว้างที่ลมพัดแรงจนผลักคนล้ม สายลมกรรโชกจะเตือนทิศก่อนพัด ยืนหลบหลังหินหรือพุ่งสวนลมไว้',
    mechanicText: 'ลมกรรโชก: ลูกศรบอกทิศ 1.2 วินาที แล้วผลักทุกคนไปทางนั้น',
    monsters: ['z_gust_sprite', 'z_seed_spitter'], boss: 'z_storm_roc',
    rooms: [[['z_gust_sprite', 3], ['z_seed_spitter', 2]], [['z_seed_spitter', 2], ['z_gust_sprite', 3], ['z_gust_sprite', 2]], 'boss'] },
  { id: 'z2', n: 2, name: 'ถ้ำผลึกน้ำแข็ง', level: 8, tier: 0, theme: 'frost', mechanic: 'ice',
    desc: 'พื้นน้ำแข็งลื่นจนหยุดเดินไม่ได้ทันที หินย้อยน้ำแข็งร่วงจากเพดานเป็นระยะ',
    mechanicText: 'พื้นลื่น: เดินแล้วไถลต่อ · หินย้อยร่วงตรงจุดที่มีวงเตือน',
    monsters: ['z_frost_slime', 'z_ice_archer'], boss: 'z_glacier_wyrm',
    rooms: [[['z_frost_slime', 3], ['z_ice_archer', 1]], [['z_ice_archer', 2], ['z_frost_slime', 3], ['z_ice_archer', 1]], 'boss'] },
  { id: 'z3', n: 3, name: 'บึงพิษ', level: 10, tier: 1, theme: 'marsh', mechanic: 'toxic',
    desc: 'หนองน้ำที่เดือดปุดๆ แอ่งพิษผุดขึ้นมาเรื่อยๆ ยืนแช่นานพลังชีวิตจะค่อยๆ ลด',
    mechanicText: 'แอ่งพิษ: ผุดขึ้นทุก 5 วินาที ยืนในแอ่ง = ติดพิษ',
    monsters: ['z_bog_toad', 'z_spore_puff'], boss: 'z_hydra_mire',
    rooms: [[['z_bog_toad', 2], ['z_spore_puff', 3]], [['z_spore_puff', 3], ['z_bog_toad', 2], ['z_bog_toad', 1], ['z_spore_puff', 2]], 'boss'] },
  { id: 'z4', n: 4, name: 'ซากปราสาทเงา', level: 12, tier: 1, theme: 'shadow', mechanic: 'dark',
    desc: 'ความมืดกลืนทุกอย่างนอกรัศมีตะเกียงของคุณ มือเงาโผล่จากพื้นใต้เท้า เพื่อนร่วมทีมช่วยส่องทางได้',
    mechanicText: 'ความมืด: มองเห็นเฉพาะรอบตัวและเพื่อน · มือเงาผุดใต้เท้าทุก 4 วินาที',
    monsters: ['z_shade_stalker', 'z_bone_lancer'], boss: 'z_umbral_knight',
    rooms: [[['z_bone_lancer', 2], ['z_shade_stalker', 2]], [['z_shade_stalker', 2], ['z_bone_lancer', 2], ['z_shade_stalker', 2]], 'boss'] },
  { id: 'z5', n: 5, name: 'ทะเลทรายเงาแดด', level: 14, tier: 1, theme: 'dunes', mechanic: 'sun',
    desc: 'ทรายดูดทำให้เดินช้า และลำแสงอาทิตย์จะกวาดผ่านสนามเป็นแนวยาว',
    mechanicText: 'ทรายดูด: เดินช้าลงครึ่งหนึ่ง · ลำแสงแดดแผดเผาเป็นแนวทุก 6 วินาที',
    monsters: ['z_sand_burrower', 'z_scarab'], boss: 'z_sphinx_colossus',
    rooms: [[['z_scarab', 4], ['z_sand_burrower', 2]], [['z_sand_burrower', 2], ['z_scarab', 5], ['z_sand_burrower', 2]], 'boss'] },
  { id: 'z6', n: 6, name: 'ป่าเห็ดเรืองแสง', level: 16, tier: 2, theme: 'glow', mechanic: 'spores',
    desc: 'เห็ดยักษ์พ่นสปอร์เป็นจังหวะ ทุกดอกพ่นพร้อมกันเป็นรอบ ต้องอ่านจังหวะให้ออก',
    mechanicText: 'เห็ดยักษ์: พ่นสปอร์เป็นวงทุก 4 วินาที (เห็ดเรืองแสงก่อนพ่น)',
    monsters: ['z_cap_bouncer', 'z_mycel_weaver'], boss: 'z_mother_morel',
    rooms: [[['z_cap_bouncer', 3], ['z_mycel_weaver', 1]], [['z_mycel_weaver', 2], ['z_cap_bouncer', 3], ['z_mycel_weaver', 2]], 'boss'] },
  { id: 'z7', n: 7, name: 'โรงหลอมสายฟ้า', level: 18, tier: 2, theme: 'foundry', mechanic: 'storm',
    desc: 'ฟ้าผ่าลงในโรงหลอมไม่หยุด จุดที่จะโดนผ่าจะมีวงไฟฟ้าเตือนก่อน',
    mechanicText: 'ฟ้าผ่า: ผ่าลงใกล้ผู้เล่นทุก 2.5 วินาที',
    monsters: ['z_volt_drone', 'z_iron_brute'], boss: 'z_tesla_titan',
    rooms: [[['z_volt_drone', 3], ['z_iron_brute', 1]], [['z_iron_brute', 2], ['z_volt_drone', 3], ['z_iron_brute', 1]], 'boss'] },
  { id: 'z8', n: 8, name: 'หุบเขาลาวา', level: 20, tier: 2, theme: 'magma', mechanic: 'geysers',
    desc: 'ปล่องลาวาปะทุทีละจุดวนไปรอบสนาม ทิ้งพื้นไฟไว้ชั่วครู่',
    mechanicText: 'ปล่องลาวา: ปะทุวนเป็นลำดับ ทิ้งพื้นไฟ 3 วินาที',
    monsters: ['z_magma_hound', 'z_cinder_mortar'], boss: 'z_rift_drake',
    rooms: [[['z_magma_hound', 3], ['z_cinder_mortar', 1]], [['z_cinder_mortar', 2], ['z_magma_hound', 3], ['z_cinder_mortar', 1]], 'boss'] },
  { id: 'z9', n: 9, name: 'สวนลอยฟ้า', level: 22, tier: 3, theme: 'sky', mechanic: 'void',
    desc: 'สวนบนเกาะลอยฟ้า แผ่นพื้นบางช่องจะพังลงสู่ความว่างเปล่าชั่วคราว อย่ายืนบนแผ่นที่กะพริบ',
    mechanicText: 'พื้นพัง: แผ่นพื้นกะพริบ 1.4 วินาทีแล้วพัง ใครยืนอยู่จะร่วง',
    monsters: ['z_feather_monk', 'z_cloud_ray'], boss: 'z_seraph_warden',
    rooms: [[['z_feather_monk', 2], ['z_cloud_ray', 2]], [['z_cloud_ray', 2], ['z_feather_monk', 2], ['z_cloud_ray', 2]], 'boss'] },
  { id: 'z10', n: 10, name: 'บัลลังก์คืนเถ้า', level: 25, tier: 3, theme: 'throne', mechanic: 'ashstorm',
    desc: 'ห้องบัลลังก์ของผู้ที่ทำให้ป่าอำพันกลายเป็นเถ้า พายุเถ้าบดบังสายตาเป็นระลอก และเถ้าถ่านร่วงลงมาไม่หยุด',
    mechanicText: 'พายุเถ้า: มืดลงเป็นระลอก · ถ่านร่วงตามตัวผู้เล่น',
    monsters: ['z_ash_revenant', 'z_cinder_mage'], boss: 'z_ash_sovereign',
    rooms: [[['z_ash_revenant', 2], ['z_cinder_mage', 2]], [['z_cinder_mage', 2], ['z_ash_revenant', 3], ['z_cinder_mage', 1]], 'boss'] },
  // v8: two lands past the Ashen Throne
  { id: 'z11', n: 11, name: 'เหวกระจกแตก', level: 28, tier: 3, theme: 'mirror', mechanic: 'mirror',
    desc: 'เหวลึกที่ผนังทุกด้านเป็นกระจกแตก เงาสะท้อนของคุณยืนอยู่อีกฝั่งของสนาม และมันยิงแสงตอบกลับมาหาคุณเสมอ',
    mechanicText: 'เงาสะท้อน: แสงพุ่งจากเงาของคุณฝั่งตรงข้ามสนามเข้าหาตัวคุณ (มีเส้นเตือนก่อน) · บางครั้งมาเป็นกากบาท',
    monsters: ['z_mirror_wisp', 'z_glass_golem'], boss: 'z_mirror_queen',
    rooms: [[['z_mirror_wisp', 3], ['z_glass_golem', 1]], [['z_glass_golem', 2], ['z_mirror_wisp', 3], ['z_mirror_wisp', 2]], [['z_mirror_wisp', 2], ['z_glass_golem', 2], ['z_mirror_wisp', 2]], 'boss'] },
  { id: 'z12', n: 12, name: 'บัลลังก์สุริยคราส', level: 31, tier: 3, theme: 'eclipse', mechanic: 'eclipse',
    desc: 'ห้องบัลลังก์บนยอดฟ้าที่ดวงอาทิตย์ถูกกลืนครึ่งดวง เมื่อคราสเต็มดวง ทั้งสนามจะมืดสนิทเหลือเพียงลำแสงเดียว',
    mechanicText: 'สุริยคราส: ทุก 14 วินาทีความมืดกลืนสนาม เหลือวงแสงอาทิตย์วงเดียว ยืนนอกแสง = โดนเผา',
    monsters: ['z_eclipse_hound', 'z_corona_priest'], boss: 'z_eclipse_king',
    rooms: [[['z_eclipse_hound', 3], ['z_corona_priest', 1]], [['z_corona_priest', 2], ['z_eclipse_hound', 3], ['z_eclipse_hound', 2]], [['z_eclipse_hound', 2], ['z_corona_priest', 2], ['z_eclipse_hound', 2]], 'boss'] },
  // v9: a story land — it lives in the เนื้อเรื่อง list of the hunt tab, not on the rift board (story: true)
  { id: 'z13', n: 13, story: true, name: 'สุสานสุริยะแห่งฟาโรห์', level: 33, tier: 3, theme: 'dunes', mechanic: 'tomb',
    desc: 'ปิรามิดที่ฝังเทพเจ้าสามองค์ไว้ใต้ทราย ระหว่างทางมีปริศนารูปปั้นปิดประตู ถ้าไม่มีใครล้มเลย บันไดลับใต้ปิรามิดจะเปิดออก',
    mechanicText: 'ปริศนารูปปั้น: รูปปั้น 3 ตัวมีเลขและสีต่างกัน (1 แดง · 2 น้ำเงิน · 3 เขียว) เรืองแสงทีละตัว จำลำดับแล้วฟันตามด้วยโจมตีธรรมดา · ผิดไม่เสียเลือด แค่ดูใหม่ · ยืนนิ่งนานรูปปั้นถัดไปจะกะพริบบอกใบ้ · เทพแต่ละองค์มีท่าที่มีวงเตือนให้หลบ',
    monsters: ['z_eclipse_hound', 'z_corona_priest'], boss: 'r_ra_god',
    rooms: [[['z_egypt_warden', 1]], [['r_anubis', 1]], [['z_egypt_warden2', 1]], [['r_sekhmet', 1]], [['z_egypt_warden3', 1]], 'boss'],
    // the dungeon inside the dungeon: opens only if nobody fell, after Ra
    nested: [[['z_egypt_warden_secret', 1]]],
  },
]);
// The rift board (ประตูมิติ) lists the portal lands; story lands (v9 Egypt) are listed under เนื้อเรื่อง instead.
// Both are still entries of ZONES, so ids, saves, rankings and expedition rooms work the same for either.
export const PORTAL_ZONES = Object.freeze(ZONES.filter((z) => !z.story));
export const STORY_ZONES = Object.freeze(ZONES.filter((z) => z.story));

// ------------------------------------------------------------------ special dungeons (ดันพิเศษ)
// One arena, one boss, a story. Same co-op rules as the zones (solo or up to 4). The Wrath Dragon wakes again
// thirty minutes after it falls (per hero). Their rarest drops are relics that, together, reveal a secret blueprint.
export const RAIDS = Object.freeze([
  { id: 'r1', n: 11, raid: true, name: 'รังมังกรพิโรธ', level: 24, tier: 3, theme: 'wrath', mechanic: 'eruption', respawnMs: 30 * 60 * 1000,
    requires: { zone: 'z6', level: 20 },
    desc: 'ปล่องภูเขาไฟที่หลับใหลมาพันปี ทุกสามสิบนาทีหัวใจใต้ลาวาจะเต้นแรงพอให้มังกรตื่นขึ้นอีกครั้ง',
    mechanicText: 'ลาวาปะทุ: รอยแยกบนพื้นเรืองแสงก่อนพ่นเพลิง · บอสยิ่งเจ็บยิ่งเร็ว',
    monsters: [], boss: 'r_wrath_dragon', rooms: ['boss'],
    lore: [
      { t: 'อัคนิวาร ผู้เฝ้าเปลวไฟ', b: 'นานมาแล้ว ป่าหนามมีผู้พิทักษ์สองพี่น้อง อัคนิวารเฝ้าไฟที่ทำให้ป่าอบอุ่นในฤดูหนาว ส่วนน้องสาวนิมิตราเฝ้าดวงดาวที่บอกฤดูกาล ทั้งสองไม่เคยห่างกันเกินหนึ่งเสียงคำราม' },
      { t: 'คืนที่ไฟถูกขัง', b: 'คืนหนึ่งนิมิตราเห็นนิมิต ไฟของพี่ชายจะเผาป่าทั้งผืน เธอจึงผนึกเปลวไฟของเขาไว้ใต้ภูเขาโดยไม่บอกเหตุผล อัคนิวารตื่นขึ้นในความมืด เชื่อว่าน้องสาวทรยศเพราะอยากครองป่าคนเดียว' },
      { t: 'หัวใจที่ไม่ยอมดับ', b: 'ความแค้นทำให้หัวใจของเขาร้อนขึ้นทุกปี จนลาวาเริ่มไหลออกมาเอง เขาตื่นทุกสามสิบนาทีเพื่อตามหาน้องสาว และเผาทุกอย่างที่ขวางทาง ถ้าใครเอาหัวใจนั้นออกมาได้ บางทีความแค้นอาจได้พัก' },
    ] },
  { id: 'r2', n: 12, raid: true, name: 'หอดาวมังกรแห่งคำพยากรณ์', level: 26, tier: 3, theme: 'prophecy', mechanic: 'starfall',
    requires: { raid: 'r1', level: 23 },
    desc: 'หอคอยลอยฟ้าที่ดาวทุกดวงคือคำทำนายที่ยังไม่เกิด นิมิตรามองเห็นการโจมตีของคุณก่อนที่คุณจะคิดเสียอีก',
    mechanicText: 'ดาวตก: วงเตือนเล็งไปยังตำแหน่งที่คุณ "กำลังจะไป" · เงานิมิตเลียนแบบท่าล่าสุดของบอส',
    monsters: [], boss: 'r_prophecy_dragon', rooms: ['boss'],
    lore: [
      { t: 'นิมิตรา ผู้มองเห็นวันพรุ่งนี้', b: 'เธอรู้ตั้งแต่แรกว่าการผนึกพี่ชายจะทำให้เขาเกลียดเธอ แต่ในทุกอนาคตที่เธอเห็น หากไม่ผนึก ป่าจะไหม้และพี่ชายจะตายในกองเพลิงนั้นด้วย' },
      { t: 'ราคาของการรู้ล่วงหน้า', b: 'ทุกครั้งที่มองอนาคต ดวงตาของเธอจะขุ่นลง เธอจึงขังตัวเองในหอดาวเพื่อเฝ้าดูผนึกจากที่ไกล และไม่ยอมให้ใครเข้ามาใกล้พอจะถามว่าทำไม' },
      { t: 'คำทำนายสุดท้าย', b: 'นิมิตสุดท้ายของเธอคือดาบสองเล่ม เล่มหนึ่งตีจากหัวใจของพี่ เล่มหนึ่งจากดวงตาของเธอ เมื่อทั้งสองอยู่ในมือเดียวกัน ความแค้นกับความหวังจะได้เดินเคียงกันอีกครั้ง' },
    ] },
  { id: 'r3', n: 13, raid: true, name: 'ลานพิพากษาแห่งฟากฟ้า', level: 28, tier: 3, theme: 'judgment', mechanic: 'verdict',
    requires: { raid: 'r2', zone: 'z10', level: 26 },
    desc: 'ลานหินขาวเหนือเมฆที่เทพแห่งคำพิพากษาชั่งน้ำหนักทุกชีวิต ใครแบกบาปมากเกินจะถูกเสาแสงตัดสิน',
    mechanicText: 'คำตัดสิน: ช่องพื้นบางช่องถูกพิพากษา (ยืนผิดช่อง = โดนเสาแสง) · ฟันดาบศักดิ์สิทธิ์ต้องแพร์รี่ให้ทัน',
    monsters: [], boss: 'r_judgment_god', rooms: ['boss'],
    lore: [
      { t: 'ผู้ที่ชั่งน้ำหนักฟ้า', b: 'เมื่อสองพี่น้องมังกรทะเลาะกันจนป่าแทบไหม้ เทพแห่งคำพิพากษาลงมาตัดสิน ไม่เข้าข้างใคร เพราะความยุติธรรมของเขาไม่มีหัวใจให้เอนเอียง' },
      { t: 'เคียวที่ไม่เคยพลาด', b: 'เคียวสวรรค์ของเขาตัดได้ทุกอย่าง ยกเว้นสิ่งที่ถูกต้องจริงๆ ว่ากันว่ามีเพียงหนึ่งในพันคนที่จะได้เห็นมันหลุดจากมือเทพ' },
    ] },
]);
// ------------------------------------------------------------------ v8: ลานประลองเจ้าแห่งบอส (Boss Rush)
// Five land bosses back to back (a new line-up every day, the same for everyone that day), each at the rush's
// level, with a short breath between them. If nobody in the party fell, a sixth door opens — and something waits
// there that is not written down anywhere.
export const RUSH = Object.freeze({ id: 'rush', bosses: 5, level: 32, requires: { zone: 'z10', level: 28 } });
const RUSH_POOL = ['z_storm_roc', 'z_glacier_wyrm', 'z_hydra_mire', 'z_umbral_knight', 'z_sphinx_colossus', 'z_mother_morel', 'z_tesla_titan', 'z_rift_drake', 'z_seraph_warden', 'z_ash_sovereign', 'z_mirror_queen', 'z_eclipse_king'];
export const rushDay = (now = Date.now()) => Math.floor(now / 86400000);
export function rushLineup(day = rushDay()) {
  const pool = RUSH_POOL.slice();
  let h = (day * 2654435761) >>> 0;
  const out = [];
  for (let i = 0; i < RUSH.bosses; i++) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  // always end on one of the strongest
  out.sort((a, b) => RUSH_POOL.indexOf(a) - RUSH_POOL.indexOf(b));
  return out;
}
export function rushZone(day = rushDay()) {
  const line = rushLineup(day);
  return {
    id: RUSH.id, n: 30, rush: true, name: 'ลานประลองเจ้าแห่งบอส', level: RUSH.level, tier: 3, theme: 'arena', mechanic: 'none',
    requires: RUSH.requires,
    desc: 'ลานประลองที่ผู้คุมทุกดินแดนถูกเรียกมาสู้ทีละตน ไม่มีลูกน้อง ไม่มีพัก มีแต่บอสต่อบอส รายชื่อบอสเปลี่ยนทุกวัน',
    mechanicText: 'บอสห้าตนติดกัน ทุกตนแกร่งเท่าระดับลาน · ฟื้น 25% ระหว่างบอส',
    monsters: [], boss: line[line.length - 1], lineup: line, secretBoss: 'z_rush_shadow',
    rooms: line.map((id) => [[id, 1]]),
  };
}
const ALL_AREAS = [...ZONES, ...RAIDS];
export function getZone(id) { if (id === RUSH.id) return rushZone(); return ALL_AREAS.find((z) => z.id === id) || null; }
export const isRaid = (id) => RAIDS.some((r) => r.id === id);
export const isRush = (id) => id === RUSH.id;
export const zoneOfEnemy = (id) => ALL_AREAS.find((z) => z.boss === id || z.monsters.includes(id)) || null;
// Wrath Dragon timer: ms until it wakes again for this hero (0 = awake).
export function raidCooldown(state, raidId, now = Date.now()) {
  const r = RAIDS.find((x) => x.id === raidId);
  const last = state.raids?.[raidId]?.last || 0;
  // capped at one full respawn so a clock set far back cannot lock the raid for ever
  return r?.respawnMs && last ? Math.max(0, Math.min(r.respawnMs, last + r.respawnMs - now)) : 0;
}

// Zone clear rewards (once per run, for everyone who reaches the end).
export function clearReward(zone, first) {
  if (zone.rush) return { gold: 4000 + (first ? 6000 : 0), sparks: first ? 120 : 40, xp: 1500 };
  if (zone.raid) return { gold: 900 + zone.level * 40 + (first ? 1500 : 0), sparks: first ? 60 : 18, xp: 300 + zone.level * 25 };
  return { gold: 80 + zone.level * 12 + (first ? 150 : 0), sparks: first ? 12 : 3, xp: 40 + zone.level * 8 };
}

// ------------------------------------------------------------------ enemies
// m: multipliers on zoneStats. ai: behaviour in src/battle/zoneBehaviours.js.
function mk(id, zoneIdx, name, o) {
  const z = ZONES[zoneIdx];
  const base = zoneStats(z.level);
  const boss = !!o.boss;
  const hpM = o.hp ?? 1, atkM = o.atk ?? 1;
  return [id, Object.freeze({
    id, name, sprite: id, zone: z.id, boss, faces: o.faces ?? true, particles: o.particles,
    hp: Math.round(base.hp * hpM * (boss ? 16 : 1)), atk: Math.round(base.atk * atkM * (boss ? 1.25 : 1)), def: Math.round(base.def * (o.def ?? 1) * (boss ? 1.4 : 1)),
    speed: o.speed, radius: o.radius, mass: o.mass ?? (boss ? 8 : 1), xp: Math.round(base.xp * (boss ? 14 : o.xp ?? 1)),
    gold: boss ? [base.gold[0] * 10, base.gold[1] * 10] : base.gold, sparks: boss ? 4 + z.tier * 2 : 0,
    interruptAt: o.interruptAt, scale: o.scale, flying: !!o.flying, split: o.split || null, guardFront: o.guardFront || 0, revive: !!o.revive,
    ai: o.ai, ai_params: Object.freeze(o.p || {}),
    drops: boss ? bossDrops(z.tier, o.legendary, z.id) : monsterDrops(z.tier, z.id),
  })];
}

function mkRaid(id, raidIdx, name, o) {
  const z = RAIDS[raidIdx];
  const base = zoneStats(z.level);
  return [id, Object.freeze({
    id, name, sprite: id, zone: z.id, boss: true, raid: true, faces: true, particles: o.particles,
    hp: Math.round(base.hp * o.hpMul), atk: Math.round(base.atk * o.atkMul), def: Math.round(base.def * 1.6),
    speed: o.speed, radius: o.radius, mass: 14, xp: Math.round(base.xp * 22), gold: [base.gold[0] * 18, base.gold[1] * 18], sparks: 14,
    interruptAt: 3, flying: !!o.flying, ai: o.ai, ai_params: Object.freeze(o.p || {}), drops: o.drops,
  })];
}

export const ZONE_ENEMIES = Object.freeze(Object.fromEntries([
  // 1 Gale Meadow
  mk('z_gust_sprite', 0, 'ภูตลมกรด', { ai: 'zigzag', speed: 150, radius: 18, hp: 0.8, particles: ['#cdf3e6', '#9fd6c4', '#ffffff'], flying: true, faces: false,
    p: { dashes: 3, dashSpeed: 420, dashTime: 0.22, windup: 0.5, dartSpeed: 620, dartTime: 0.35, rest: 0.7 } }),
  mk('z_seed_spitter', 0, 'บุปผาพ่นเมล็ด', { ai: 'turret_burrow', speed: 0, radius: 22, hp: 1.1, mass: 99, particles: ['#6f9a4a', '#d6ef8a', '#e8c34a'], faces: false,
    p: { windup: 0.6, shots: 3, spread: 0.35, shotSpeed: 330, volleys: 3, gap: 1.3, burrowTime: 1.0, emergeRadius: 70 } }),
  mk('z_storm_roc', 0, 'ราชันนกพายุ', { boss: true, ai: 'storm_roc', speed: 120, radius: 60, particles: ['#d9e8f6', '#8aa6c8', '#f5d48a'], flying: true, legendary: 'w_tempest_saber',
    p: { diveTelegraph: 0.8, diveSpeed: 900, dives: 3, fanCount: 9, fanSpread: 1.1, shotSpeed: 360, tornadoLife: 6, rest: 1.1 } }),
  // 2 Frost Crystal Cave
  mk('z_frost_slime', 1, 'สไลม์ผลึกน้ำแข็ง', { ai: 'hopper', speed: 70, radius: 24, hp: 1.2, particles: ['#bfe8ff', '#8fd0f0', '#ffffff'], faces: false, split: { id: 'z_frost_mote', count: 2 },
    p: { hopEvery: 1.1, hopTime: 0.4, hopSpeed: 300, contactRange: 36 } }),
  mk('z_frost_mote', 1, 'ผลึกน้ำแข็งน้อย', { ai: 'hopper', speed: 90, radius: 14, hp: 0.35, xp: 0.3, scale: 0.6, particles: ['#bfe8ff', '#ffffff'], faces: false,
    p: { hopEvery: 0.7, hopTime: 0.3, hopSpeed: 340, contactRange: 26 } }),
  mk('z_ice_archer', 1, 'พลธนูน้ำแข็ง', { ai: 'sniper', speed: 95, radius: 20, hp: 0.9, particles: ['#bfe8ff', '#5f8fb8', '#ffffff'],
    p: { keepAway: 360, aim: 0.95, shotSpeed: 720, pierce: true, pool: 'ice', cooldown: 2.2 } }),
  mk('z_glacier_wyrm', 1, 'มังกรธารน้ำแข็ง', { boss: true, ai: 'glacier_wyrm', speed: 110, radius: 62, particles: ['#e8f8ff', '#8fc4e8', '#ffffff'], faces: true, legendary: 'w_glacier_fang',
    p: { burrowTime: 1.4, emergeTelegraph: 0.95, emergeRadius: 140, breathTelegraph: 0.8, breathRange: 380, breathArc: 0.9, ringCount: 16, shotSpeed: 300, rest: 1.0 } }),
  // 3 Venom Marsh
  mk('z_bog_toad', 2, 'คางคกบึงพิษ', { ai: 'tongue', speed: 80, radius: 26, hp: 1.3, particles: ['#b8d070', '#6a8a3a', '#c27ff0'], faces: false,
    p: { range: 330, windup: 0.75, tongueWidth: 34, pull: -520, hopSpeed: 360, hopTime: 0.35, rest: 0.9 } }),
  mk('z_spore_puff', 2, 'พองสปอร์', { ai: 'bomber', speed: 70, radius: 20, hp: 0.6, particles: ['#ecd2ff', '#b07ad0', '#e8ff9a'], faces: false, flying: true,
    p: { trigger: 110, swell: 0.95, blast: 120, poolR: 90, poolT: 4 } }),
  mk('z_hydra_mire', 2, 'ไฮดราแห่งบึง', { boss: true, ai: 'hydra', speed: 0, radius: 70, mass: 99, particles: ['#b8e08a', '#5a8a4a', '#c27ff0'], faces: false, legendary: 'w_hydra_kiss',
    p: { spitEvery: 0.55, spitSpeed: 380, volley: 6, submergeTime: 1.6, waveTelegraph: 0.8, waveRadii: [130, 240, 350], waveGap: 0.55, summon: 'z_spore_puff' } }),
  // 4 Shadow Ruins
  mk('z_shade_stalker', 3, 'นักฆ่าเงา', { ai: 'blink_assassin', speed: 120, radius: 20, hp: 0.9, atk: 1.2, particles: ['#9a8ad0', '#3a3450', '#c27ff0'],
    p: { fade: 1.6, windup: 0.5, slashRange: 120, slashArc: 1.6, recover: 0.8 } }),
  mk('z_bone_lancer', 3, 'อัศวินกระดูกทวน', { ai: 'lancer', speed: 85, radius: 22, hp: 1.3, particles: ['#f3ead2', '#c8bca0', '#8e2c21'], interruptAt: 1.6,
    p: { range: 260, windup: 0.8, thrustLen: 360, thrustWidth: 44, thrustTime: 0.28, recover: 1.0 } }),
  mk('z_umbral_knight', 3, 'อัศวินจันทร์ดับ', { boss: true, ai: 'umbral_knight', speed: 140, radius: 52, particles: ['#e0b0ff', '#2a2438', '#c27ff0'], legendary: 'w_umbral_greatblade',
    p: { slashTelegraph: 0.7, slashLen: 420, slashWidth: 70, slashes: 3, pulseRadius: 260, pulseTelegraph: 1.0, summon: 'z_shade_stalker', rest: 1.0 } }),
  // 5 Sunscorch Dunes
  mk('z_sand_burrower', 4, 'ด้วงมุดทราย', { ai: 'burrower', speed: 170, radius: 24, hp: 1.2, particles: ['#f0d89a', '#c8a060', '#6a4a24'], interruptAt: 1.5,
    p: { travel: 1.6, emergeTelegraph: 0.8, emergeRadius: 85, spitCount: 5, spitSpeed: 300, exposed: 1.8 } }),
  mk('z_scarab', 4, 'แมลงปีกแข็งเทอร์ควอยซ์', { ai: 'swarm', speed: 210, radius: 14, hp: 0.45, xp: 0.5, scale: 0.75, particles: ['#7fd0c0', '#2f6a6a', '#f5d48a'], flying: true,
    p: { orbit: 140, orbitTime: 2.2, dashSpeed: 560, dashTime: 0.3, windup: 0.35 } }),
  mk('z_sphinx_colossus', 4, 'สฟิงซ์ยักษ์แห่งเนินทราย', { boss: true, ai: 'sphinx', speed: 60, radius: 70, mass: 99, particles: ['#f3dca0', '#c8a46a', '#7fe8ff'], faces: false, legendary: 'w_sunspire_staff',
    p: { beamTelegraph: 1.0, beamLen: 760, beamWidth: 46, beamSweep: 2.2, beamSteps: 11, pillarCount: 6, pillarRadius: 70, pillarTelegraph: 1.0, rest: 1.2 } }),
  // 6 Glowcap Grove
  mk('z_cap_bouncer', 5, 'เห็ดเด้ง', { ai: 'ricochet', speed: 0, radius: 24, hp: 1.1, particles: ['#ffd0e0', '#d06a8a', '#ff7aa8'], faces: false,
    p: { windup: 0.7, speed: 560, bounces: 3, travel: 2.4, dizzy: 1.3 } }),
  mk('z_mycel_weaver', 5, 'แมงมุมใยเรืองแสง', { ai: 'weaver', speed: 120, radius: 20, hp: 0.9, particles: ['#c8b8ff', '#6a5aa8', '#9fffd8'],
    p: { keepAway: 260, webEvery: 2.6, webTelegraph: 0.9, webRadius: 75, webT: 4, strandSpeed: 260 } }),
  mk('z_mother_morel', 5, 'มารดาเห็ดราชินี', { boss: true, ai: 'morel', speed: 70, radius: 64, particles: ['#f0d0ff', '#a86ad0', '#9fffd8'], faces: false, flying: true, legendary: 'w_sporebloom_bow',
    p: { spiralTime: 3.2, spiralRate: 0.09, spiralArms: 3, spiralSpeed: 230, rainCount: 9, rainRadius: 70, rainTelegraph: 1.0, summon: 'z_cap_bouncer', rest: 1.2 } }),
  // 7 Thunder Foundry
  mk('z_volt_drone', 6, 'โดรนสายฟ้า', { ai: 'orbit_zapper', speed: 160, radius: 18, hp: 0.8, particles: ['#fff07a', '#5a6a80', '#c8d8ea'], faces: false, flying: true,
    p: { orbit: 200, zapEvery: 2.1, zapTelegraph: 0.65, zapWidth: 26 } }),
  mk('z_iron_brute', 6, 'ยักษ์เหล็กถือโล่', { ai: 'shielded', speed: 70, radius: 30, hp: 1.8, atk: 1.2, mass: 4, particles: ['#b8c0cc', '#6a6f78', '#ffcf5a'], guardFront: 0.8, interruptAt: 2.2,
    p: { smashRange: 110, smashRadius: 95, windup: 0.9, recover: 1.1 } }),
  mk('z_tesla_titan', 6, 'ไททันเทสลา', { boss: true, ai: 'tesla', speed: 80, radius: 66, particles: ['#a8c0de', '#4a5a70', '#ffe65a'], faces: false, legendary: 'w_thunder_lance',
    p: { pylons: 3, chainTelegraph: 0.9, chainWidth: 30, ringTelegraph: 0.7, ringRadii: [150, 260, 370, 480], ringGap: 0.45, overloadRadius: 200, rest: 1.0 } }),
  mk('z_pylon', 6, 'เสานำไฟฟ้า', { ai: 'pylon', speed: 0, radius: 22, hp: 0.9, mass: 99, xp: 0.2, particles: ['#ffe65a', '#4a5a70'], faces: false, p: {} }),
  // 8 Magma Rift
  mk('z_magma_hound', 7, 'สุนัขลาวา', { ai: 'trailblazer', speed: 230, radius: 22, hp: 1.0, particles: ['#ff8a3d', '#6a2a1e', '#ffcf5a'],
    p: { circle: 2.0, trailEvery: 0.22, trailR: 34, trailT: 2.4, pounceTelegraph: 0.55, pounceSpeed: 700, pounceTime: 0.3 } }),
  mk('z_cinder_mortar', 7, 'ป้อมปืนครกถ่าน', { ai: 'mortar', speed: 50, radius: 26, hp: 1.3, mass: 6, particles: ['#ff7a33', '#5a4a44', '#ffcf5a'],
    p: { shells: 3, scatter: 110, telegraph: 1.15, blast: 70, cooldown: 2.6, keepAway: 320 } }),
  mk('z_rift_drake', 7, 'มังกรรอยแยก', { boss: true, ai: 'drake', speed: 130, radius: 64, particles: ['#ffb35a', '#8e2c21', '#ffe89a'], legendary: 'a_drakescale',
    p: { breathTelegraph: 0.8, breathSteps: 7, breathArc: 0.7, breathRange: 420, meteorCount: 10, meteorRadius: 75, meteorTelegraph: 1.1, chargeSpeed: 760, chargeTime: 0.7, rest: 1.0 } }),
  // 9 Sky Gardens
  mk('z_feather_monk', 8, 'นักพรตขนนก', { ai: 'counter', speed: 130, radius: 20, hp: 1.1, particles: ['#ffffff', '#e8e0c8', '#5fa8ec'],
    p: { guard: 1.6, counterRadius: 130, palmRange: 110, palmArc: 1.2, palms: 3, palmGap: 0.32, windup: 0.4 } }),
  mk('z_cloud_ray', 8, 'กระเบนเมฆ', { ai: 'glider', speed: 0, radius: 26, hp: 1.0, particles: ['#f4faff', '#a8c8e8', '#ffe65a'], flying: true,
    p: { telegraph: 0.9, glideSpeed: 560, trailDelay: 0.45, trailWidth: 40, rest: 1.4 } }),
  mk('z_seraph_warden', 8, 'ผู้พิทักษ์เทวะ', { boss: true, ai: 'seraph', speed: 110, radius: 58, particles: ['#fff3a0', '#f3e6c8', '#e0b45a'], flying: true, legendary: 'c_seraph_feather',
    p: { beamTelegraph: 0.85, beamLen: 900, beamWidth: 50, wheels: 4, wheelLife: 5, petalCount: 20, petalSpeed: 250, rest: 1.0 } }),
  // 10 Ashen Throne
  mk('z_ash_revenant', 9, 'วิญญาณเถ้า', { ai: 'revenant', speed: 110, radius: 22, hp: 1.1, atk: 1.15, particles: ['#ff8a3d', '#4a4440', '#8a827a'], revive: true,
    p: { range: 120, windup: 0.45, arc: 1.6, swings: 2, gap: 0.35, recover: 0.9, reviveTime: 3 } }),
  mk('z_cinder_mage', 9, 'จอมเวทถ่าน', { ai: 'homing_caster', speed: 100, radius: 20, hp: 0.9, particles: ['#ffcf5a', '#5a2a24', '#ffb35a'],
    p: { keepAway: 300, windup: 0.75, orbs: 3, orbSpeed: 210, homing: 1.7, cooldown: 2.6, blinkRange: 160 } }),
  mk('z_ash_sovereign', 9, 'จักรพรรดิเถ้าถ่าน', { boss: true, ai: 'sovereign', speed: 120, radius: 60, particles: ['#ff8a3d', '#3a2a24', '#e0b45a'], legendary: 'c_ember_crown',
    p: { waveTelegraph: 0.75, waveLen: 640, waveWidth: 56, waveFan: 5, waveSpread: 0.9, orbCount: 6, orbSpeed: 230, ringTelegraph: 1.2, rest: 0.9, summon: 'z_ash_revenant' } }),
  // 11 Shattered Mirror Abyss (v8)
  mk('z_mirror_wisp', 10, 'ภูตกระจกเงา', { ai: 'mirror_wisp', speed: 120, radius: 18, hp: 0.85, particles: ['#e8f4ff', '#7fe8ff', '#ffffff'], flying: true, faces: false,
    p: { blinkEvery: 2.8, aim: 0.75, shots: 3, spread: 0.22, shotSpeed: 520, keepAway: 280 } }),
  mk('z_glass_golem', 10, 'โกเลมแก้วร้าว', { ai: 'glass_charger', speed: 70, radius: 30, hp: 1.9, atk: 1.2, mass: 5, particles: ['#d8ecff', '#7a9ab8', '#7fe8ff'], interruptAt: 2.4,
    p: { range: 520, telegraph: 0.95, chargeSpeed: 720, chargeTime: 0.7, shardEvery: 0.09, shardR: 46, shardDelay: 0.55, exposed: 1.4 } }),
  mk('z_mirror_image', 10, 'ภาพสะท้อน', { ai: 'mirror_image', speed: 150, radius: 40, hp: 0.6, xp: 0.2, particles: ['#e8f4ff', '#7fe8ff', '#ffffff'],
    p: { telegraph: 0.8, len: 640, width: 46, life: 9 } }),
  mk('z_mirror_queen', 10, 'ราชินีกระจกแตก', { boss: true, ai: 'mirror_queen', speed: 150, radius: 52, particles: ['#e8f4ff', '#7fe8ff', '#b88aff'], legendary: 'w_prism_rapier',
    p: { slashTelegraph: 0.75, slashLen: 760, slashWidth: 54, ringTelegraph: 0.9, ringStep: 120, rings: 4, spokes: 6, spokeTelegraph: 0.8, spokeLen: 900, rest: 0.85, images: 2 } }),
  // 12 Eclipse Throne (v8)
  mk('z_eclipse_hound', 11, 'สุนัขคราส', { ai: 'eclipse_hound', speed: 240, radius: 22, hp: 1.05, atk: 1.1, particles: ['#ffd27a', '#2a2238', '#ffb648'],
    p: { circle: 1.8, telegraph: 0.6, pounceSpeed: 760, pounceTime: 0.32, ringDelay: 0.65, ringR: 150, ringIn: 60, rest: 0.8 } }),
  mk('z_corona_priest', 11, 'นักบวชรัศมีตะวัน', { ai: 'corona_priest', speed: 95, radius: 20, hp: 1.0, particles: ['#ffd27a', '#5a2a14', '#fff3c4'],
    p: { keepAway: 320, markTime: 1.1, markLock: 0.6, markR: 90, beams: 3, beamTelegraph: 0.8, beamLen: 600, beamWidth: 40, cooldown: 2.4 } }),
  mk('z_eclipse_king', 11, 'จักรพรรดิสุริยคราส', { boss: true, ai: 'eclipse_king', speed: 135, radius: 58, particles: ['#ffd27a', '#2a2238', '#ffb648'], legendary: 'w_eclipse_halberd',
    p: { flareTelegraph: 0.85, flareLen: 900, flareWidth: 56, dropR: 150, dropSmall: 80, dropTelegraph: 1.0, crescentR: 300, crescentArc: 1.9, crescentTelegraph: 0.55, crescents: 3, stance: 11, rest: 0.8, summon: 'z_eclipse_hound' } }),
  // special dungeons (stats from the raid level; hpMul is the boss multiplier)
  mkRaid('r_wrath_dragon', 0, 'อัคนิวาร มังกรพิโรธ', { ai: 'wrath_dragon', hpMul: 120, atkMul: 1.5, speed: 150, radius: 74, particles: ['#ff5a1a', '#4a120c', '#ffcf5a'], flying: false,
    drops: [
      { chance: 1, entries: [{ id: 'm_wrath_scale', weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: MAT[3] }, { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: 'a_wrath_plate', weight: 2, qty: [1, 1] }, { id: 'c_wrath_fang', weight: 2, qty: [1, 1] }, { id: 'wg_wrath_dragon', weight: 1, qty: [1, 1] }] },
      { chance: 0.005, entries: [{ id: 'm_wrath_heart', weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
    ],
    p: { breathTelegraph: 0.75, breathSteps: 9, breathArc: 0.7, breathRange: 460, clawRange: 150, clawArc: 1.6, clawTelegraph: 0.42, tailArc: 1.4, diveSpeed: 980, diveTime: 0.55, diveTelegraph: 0.9,
      rainCount: 12, rainRadius: 78, rainTelegraph: 1.05, crackCount: 4, crackWidth: 70, rest: 0.85, summon: 'z_magma_hound' } }),
  mkRaid('r_prophecy_dragon', 1, 'นิมิตรา มังกรแห่งคำพยากรณ์', { ai: 'prophecy_dragon', hpMul: 130, atkMul: 1.45, speed: 140, radius: 72, particles: ['#7fe8ff', '#26305a', '#ffffff'], flying: true,
    drops: [
      { chance: 1, entries: [{ id: 'm_prophecy_scale', weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: MAT[3] }, { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: 'a_seer_vestment', weight: 2, qty: [1, 1] }, { id: 'c_prophecy_lens', weight: 2, qty: [1, 1] }, { id: 'wg_prophecy', weight: 1, qty: [1, 1] }] },
      { chance: 0.005, entries: [{ id: 'm_prophecy_eye', weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
    ],
    p: { lead: 0.75, starCount: 7, starRadius: 70, starTelegraph: 1.0, beamCount: 3, beamLen: 980, beamWidth: 46, beamTelegraph: 0.9, beamSpin: 0.55, orbCount: 14, orbSpeed: 240,
      echoDelay: 2.4, clawRange: 140, clawArc: 1.5, clawTelegraph: 0.4, rest: 0.9, summon: 'z_cloud_ray' } }),
  mkRaid('r_judgment_god', 2, 'เทพแห่งคำพิพากษา', { ai: 'judgment_god', hpMul: 145, atkMul: 1.55, speed: 120, radius: 66, particles: ['#fff3a0', '#f5c35a', '#ffffff'], flying: true,
    drops: [
      { chance: 1, entries: [{ id: 'm_judgment_sigil', weight: 1, qty: [1, 3] }] },
      { chance: 1, entries: MAT[3] }, { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: 'a_judgment_plate', weight: 2, qty: [1, 1] }, { id: 'c_judgment_halo', weight: 2, qty: [1, 1] }, { id: 'wg_seraph', weight: 1, qty: [1, 1] }] },
      { chance: 0.001, entries: [{ id: 'w_heaven_scythe', weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] },
    ],
    p: { slashRange: 190, slashArc: 2.0, slashTelegraph: 0.5, slashes: 3, slashGap: 0.38, gridTelegraph: 1.25, pillarRadius: 64, pillarCount: 6, scaleTelegraph: 1.4, swordRain: 16, swordTelegraph: 1.1,
      rest: 0.8, summon: 'z_feather_monk' } }),
  // v9 Egypt puzzle rooms
  mk('z_egypt_glyph', 12, 'รูปปั้นสุริยะ', { ai: 'egypt_glyph', speed: 0, radius: 34, hp: 400, atk: 0.2, mass: 99, particles: ['#e0b45a', '#fff3c4', '#7fe8ff'], p: {} }),
  mk('z_egypt_warden', 12, 'ผู้เฝ้าประตูสุสาน', { ai: 'egypt_warden', speed: 0, radius: 40, hp: 0.9, atk: 0.4, mass: 99, particles: ['#e0b45a', '#fff3c4', '#7fe8ff'],
    p: { glyphs: 3, start: 1, rounds: 3 } }),
  mk('z_egypt_warden2', 12, 'ผู้เฝ้าประตูแห่งตาชั่ง', { ai: 'egypt_warden', speed: 0, radius: 40, hp: 0.9, atk: 0.4, mass: 99, particles: ['#e0b45a', '#fff3c4', '#7fe8ff'],
    p: { glyphs: 3, start: 2, rounds: 2 } }),
  mk('z_egypt_warden3', 12, 'ผู้เฝ้าประตูแห่งเพลิง', { ai: 'egypt_warden', speed: 0, radius: 40, hp: 0.9, atk: 0.4, mass: 99, particles: ['#e0b45a', '#fff3c4', '#7fe8ff'],
    p: { glyphs: 3, start: 2, rounds: 3 } }),
  (() => {   // the hidden room's warden: the longest sequence, and the richest purse
    const [id, d] = mk('z_egypt_warden_secret', 12, 'ผู้เฝ้าห้องฝังพระศพ', { ai: 'egypt_warden', speed: 0, radius: 44, hp: 1.2, atk: 0.5, mass: 99, particles: ['#ffcf5a', '#ffffff', '#6a4aa8'], p: { glyphs: 3, start: 2, rounds: 3 } });
    return [id, Object.freeze({ ...d, drops: [
      { chance: 1, entries: [{ id: 'm_egypt_sigil', weight: 1, qty: [3, 6] }] }, { chance: 1, entries: MAT[3] }, { chance: 1, entries: MAT[3] },
      { chance: 0.6, entries: GEAR[2] }, { chance: 0.1, entries: [{ id: 'a_pharaoh_plate', weight: 1, qty: [1, 1] }, { id: 'c_scarab_charm', weight: 1, qty: [1, 1] }] },
      { chance: 0.8, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 2] }] } ] })];
  })(),
  // v9 Egypt (z13, story): three gods, three rooms, 5% each for a part of the secret katana
  ...[
    ['r_anubis', 'อนูบิส เทพแห่งตาชั่งหัวใจ', { ai: 'anubis_god', hp: 2.4, atk: 1.2, speed: 140, radius: 62, particles: ['#7fe8ff', '#1a2438', '#e0b45a'] }, 'm_anubis_scale'],
    ['r_sekhmet', 'เซคเมท สิงโตแห่งสงคราม', { ai: 'sekhmet_god', hp: 2.4, atk: 1.25, speed: 165, radius: 64, particles: ['#ff5a3a', '#4a120c', '#ffcf5a'] }, 'm_sekhmet_fang'],
    ['r_ra_god', 'รา สุริยเทพแห่งดวงตะวัน', { ai: 'ra_god', hp: 2.9, atk: 1.2, speed: 120, radius: 68, flying: true, particles: ['#ffcf5a', '#ffffff', '#ff9a33'] }, 'm_ra_eye'],
  ].map(([id, name, o, relic]) => {
    const [i, d] = mk(id, 12, name, { boss: true, interruptAt: 3, legendary: 'a_pharaoh_plate', p: { rest: 0.85 }, ...o });
    return [i, Object.freeze({ ...d, drops: [
      { chance: 1, entries: [{ id: 'm_egypt_sigil', weight: 1, qty: [1, 3] }] }, { chance: 1, entries: MAT[3] }, { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: 'a_pharaoh_plate', weight: 1, qty: [1, 1] }, { id: 'c_scarab_charm', weight: 1, qty: [1, 1] }] },
      { chance: 0.05, entries: [{ id: relic, weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: 'm_bloodstone', weight: 1, qty: [1, 1] }] } ] })];
  }),
  // v8: the shadow at the end of the Boss Rush (only when nobody fell). It wears the moves of the bosses it beat.
  ['z_rush_shadow', Object.freeze({ id: 'z_rush_shadow', name: 'เงาแห่งเจ้าแห่งบอส', sprite: 'z_rush_shadow', zone: 'rush', boss: true, faces: true, particles: ['#ffb648', '#1a1424', '#6a4aa8'],
    hp: Math.round(zoneStats(34).hp * 150), atk: Math.round(zoneStats(34).atk * 1.6), def: Math.round(zoneStats(34).def * 1.7), speed: 150, radius: 56, mass: 14, xp: Math.round(zoneStats(34).xp * 30),
    gold: [zoneStats(34).gold[0] * 25, zoneStats(34).gold[1] * 25], sparks: 30, interruptAt: 3, flying: false, ai: 'rush_shadow', ai_params: Object.freeze({ persona: 10, rest: 0.7 }),
    drops: [
      { chance: 1, entries: [{ id: 'm_bloodstone', weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: [{ id: 'm_mirror_shard', weight: 1, qty: [2, 4] }, { id: 'm_eclipse_core', weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: MAT[3] }, { chance: 0.6, entries: GEAR[2] },
      { chance: 0.04, entries: [{ id: 'w_eclipse_blade', weight: 1, qty: [1, 1] }] },
    ] })],
]));
