// v7 items: thirty armours and the ten relics of the underworld gods (tower bosses, data/tower.js).
// Armour art is built from parts (art/hero.js → armorDetail 'forge'): chest · shoulder · skirt · emblem · arm,
// with main / trim / accent colours. No two armours share the same parts and colours.
//   chest:    plate scale chain robe harness bone crystal leaf fur lamellar
//   shoulder: none round spike feather horn fur crystal layered
//   skirt:    none tails kilt robe tassets fringe
//   emblem:   none sun moon skull eye rune star flame leaf wave chain
//   arm:      plain bracer spiked wide chain
const A = (id, name, rarity, src, stats, art, desc) => ({ id, name, category: 'armor', rarity, src, stats, art: { kind: 'forge', ...art }, desc });

export const ARMORS_V7 = Object.freeze({
  // tower band 1–2
  a_river_ferryman: A('a_river_ferryman', 'เสื้อคลุมคนแจวเรือวิญญาณ', 'rare', 't1', { def: 11, hp: 50, spd: 0.03 },
    { chest: 'robe', shoulder: 'none', skirt: 'robe', emblem: 'wave', arm: 'wide', main: '#2a3a4a', trim: '#7fe8ff', accent: '#c8e8ff' }, 'คนแจวเรือข้ามแม่น้ำวิญญาณใส่ชุดนี้มาพันปี ไม่เคยเปียก'),
  a_chain_warden: A('a_chain_warden', 'เกราะผู้คุมโซ่', 'rare', 't2', { def: 14, hp: 60 },
    { chest: 'chain', shoulder: 'round', skirt: 'tassets', emblem: 'chain', arm: 'chain', main: '#5a5a62', trim: '#8e2c21', accent: '#b8b8c4' }, 'ทุกห่วงโซ่บนเกราะเคยล่ามใครบางคนไว้'),
  a_moss_ranger: A('a_moss_ranger', 'ชุดพรานมอส', 'uncommon', 't1', { def: 8, hp: 36, spd: 0.04 },
    { chest: 'leaf', shoulder: 'feather', skirt: 'fringe', emblem: 'leaf', arm: 'bracer', main: '#3a5a2a', trim: '#a5c76c', accent: '#d6f59a' }, 'พรางตัวในป่าได้ดีจนนกมาเกาะไหล่'),
  a_ember_apprentice: A('a_ember_apprentice', 'ชุดฝึกหัดช่างถ่าน', 'uncommon', 't2', { def: 9, hp: 40, atk: 2 },
    { chest: 'harness', shoulder: 'none', skirt: 'kilt', emblem: 'flame', arm: 'bracer', main: '#6a3a24', trim: '#ff8a3d', accent: '#ffd08a' }, 'มีรอยไหม้ทุกจุดที่ประกายไฟเคยกระเด็นใส่'),
  // band 3–4
  a_hellfire_vest: A('a_hellfire_vest', 'เกราะไฟนรกขุมสาม', 'epic', 't3', { def: 19, hp: 85, atk: 5 },
    { chest: 'scale', shoulder: 'spike', skirt: 'tassets', emblem: 'flame', arm: 'spiked', main: '#5a1a10', trim: '#ff5a1a', accent: '#ffcf5a' }, 'ยังร้อนจนจับมือเปล่าไม่ได้'),
  a_silent_shroud: A('a_silent_shroud', 'ผ้าคลุมไร้เสียง', 'epic', 't4', { def: 15, hp: 70, crit: 0.06, spd: 0.05 },
    { chest: 'robe', shoulder: 'layered', skirt: 'tails', emblem: 'eye', arm: 'wide', main: '#1a1a24', trim: '#5a5a7a', accent: '#c8c8ff' }, 'ผู้สวมเดินผ่านห้องโถงหินโดยไม่มีเสียงสะท้อน'),
  a_bone_vanguard: A('a_bone_vanguard', 'เกราะกระดูกกองหน้า', 'epic', 't3', { def: 21, hp: 90 },
    { chest: 'bone', shoulder: 'horn', skirt: 'fringe', emblem: 'skull', arm: 'spiked', main: '#3a2a20', trim: '#e8dcc0', accent: '#9fffd8' }, 'กระดูกเหล่านี้เคยเป็นของนักรบที่ไม่ยอมล้ม'),
  a_frost_lamellar: A('a_frost_lamellar', 'เกราะเกล็ดน้ำแข็ง', 'epic', 't4', { def: 22, hp: 80, critMult: 0.1 },
    { chest: 'lamellar', shoulder: 'crystal', skirt: 'tassets', emblem: 'star', arm: 'bracer', main: '#4a6a8a', trim: '#e8f8ff', accent: '#9fd8ff' }, 'เกล็ดน้ำแข็งเรียงกันแน่นเหมือนเกราะซามูไร'),
  a_wanderer_fur: A('a_wanderer_fur', 'เสื้อขนสัตว์นักเดินทาง', 'rare', 't3', { def: 13, hp: 65, spd: 0.02 },
    { chest: 'fur', shoulder: 'fur', skirt: 'kilt', emblem: 'none', arm: 'plain', main: '#6a4a30', trim: '#e8d8b0', accent: '#a07850' }, 'อุ่นพอจะนอนกลางหิมะได้หนึ่งคืน'),
  // band 5–6
  a_judge_mantle: A('a_judge_mantle', 'เสื้อคลุมผู้ชั่งวิญญาณ', 'legendary', 't5', { def: 26, hp: 120, crit: 0.05 },
    { chest: 'plate', shoulder: 'layered', skirt: 'robe', emblem: 'eye', arm: 'bracer', main: '#2a2a3a', trim: '#e0b45a', accent: '#ffffff' }, 'ลายตาชั่งบนอกเอียงไปทางเดียวกับใจผู้สวม'),
  a_serpent_scale: A('a_serpent_scale', 'เกราะเกล็ดภุชงค์', 'legendary', 't6', { def: 27, hp: 115, spd: 0.04 },
    { chest: 'scale', shoulder: 'round', skirt: 'tails', emblem: 'wave', arm: 'chain', main: '#1a3a2a', trim: '#a8d070', accent: '#e8ff9a' }, 'ลอกจากคราบของเทพอสรพิษ ยังลื่นเหมือนมีชีวิต'),
  a_crystal_aegis: A('a_crystal_aegis', 'เกราะผลึกพิทักษ์', 'legendary', 't5', { def: 32, hp: 110, spd: -0.04 },
    { chest: 'crystal', shoulder: 'crystal', skirt: 'none', emblem: 'star', arm: 'bracer', main: '#3a5a7a', trim: '#bfe8ff', accent: '#ffffff' }, 'แสงหักเหผ่านเกราะจนศัตรูเล็งไม่ถูก'),
  a_rune_harness: A('a_rune_harness', 'สายรัดอักขระนักล่า', 'epic', 't6', { def: 18, hp: 80, atk: 6, crit: 0.05 },
    { chest: 'harness', shoulder: 'spike', skirt: 'fringe', emblem: 'rune', arm: 'spiked', main: '#2a1a14', trim: '#c27ff0', accent: '#e0b0ff' }, 'อักขระเรืองแสงทุกครั้งที่ผู้สวมฆ่าเหยื่อ'),
  // band 7–8
  a_clockwork_plate: A('a_clockwork_plate', 'เกราะเฟืองนาฬิกาตาย', 'legendary', 't7', { def: 30, hp: 130, spd: 0.05 },
    { chest: 'plate', shoulder: 'round', skirt: 'tassets', emblem: 'sun', arm: 'chain', main: '#5a4a30', trim: '#c8a050', accent: '#fff3c4' }, 'เฟืองในเกราะเดินถอยหลังเสมอ'),
  a_thousand_mask: A('a_thousand_mask', 'อาภรณ์พันหน้า', 'legendary', 't8', { def: 24, hp: 110, crit: 0.1, critMult: 0.2 },
    { chest: 'robe', shoulder: 'feather', skirt: 'tails', emblem: 'moon', arm: 'wide', main: '#3a1a3a', trim: '#ff5a9a', accent: '#ffd0e0' }, 'ทุกครั้งที่มองกระจก ผู้สวมจะเห็นหน้าคนอื่น'),
  a_storm_knight: A('a_storm_knight', 'เกราะอัศวินพายุ', 'legendary', 't7', { def: 31, hp: 125, atk: 6 },
    { chest: 'plate', shoulder: 'spike', skirt: 'kilt', emblem: 'star', arm: 'spiked', main: '#3a4a6a', trim: '#ffe65a', accent: '#fff9c4' }, 'สายฟ้าวิ่งตามรอยต่อของเกราะไม่หยุด'),
  a_ash_monk: A('a_ash_monk', 'จีวรพระเถ้า', 'epic', 't8', { def: 20, hp: 100, crit: 0.04, spd: 0.06 },
    { chest: 'robe', shoulder: 'none', skirt: 'fringe', emblem: 'sun', arm: 'wide', main: '#8a5a3a', trim: '#ffd08a', accent: '#fff3c4' }, 'ห่มไว้ข้างหนึ่ง ปล่อยแขนอีกข้างว่างไว้สำหรับฝ่ามือ'),
  // band 9–10
  a_glacier_bastion: A('a_glacier_bastion', 'ป้อมธารน้ำแข็งนรก', 'mythic', 't9', { def: 44, hp: 190, spd: -0.05 },
    { chest: 'crystal', shoulder: 'layered', skirt: 'tassets', emblem: 'moon', arm: 'bracer', main: '#2a4a6a', trim: '#e8f8ff', accent: '#7fe8ff' }, 'ความหนาวจากขุมนรกที่ลึกที่สุด แช่แข็งแม้แต่เวลา'),
  a_netherking_regalia: A('a_netherking_regalia', 'ฉลองพระองค์ราชันขุมนรก', 'mythic', 't10', { def: 46, hp: 200, atk: 10, crit: 0.08, critMult: 0.25 },
    { chest: 'plate', shoulder: 'horn', skirt: 'robe', emblem: 'skull', arm: 'spiked', main: '#1a0a10', trim: '#ff3a3a', accent: '#f5c35a' }, 'มหากาฬสวมชุดนี้ตอนนั่งบนบัลลังก์ ตอนนี้มันเลือกเจ้าของใหม่แล้ว'),
  a_void_wrap: A('a_void_wrap', 'ผ้าพันห้วงว่าง', 'legendary', 't9', { def: 28, hp: 140, spd: 0.07, crit: 0.06 },
    { chest: 'harness', shoulder: 'layered', skirt: 'tails', emblem: 'eye', arm: 'chain', main: '#14121c', trim: '#7a4aff', accent: '#b89aff' }, 'ผ้าที่ไม่มีเงา และไม่สะท้อนแสงใดๆ'),
  // zones, raids and the shop
  a_gale_vest: A('a_gale_vest', 'เสื้อกั๊กลมกรด', 'uncommon', 'z1', { def: 7, hp: 32, spd: 0.05 },
    { chest: 'lamellar', shoulder: 'feather', skirt: 'none', emblem: 'none', arm: 'plain', main: '#5a8a7a', trim: '#e6fff6', accent: '#c6ece2' }, 'เบาจนลมแทบพัดปลิว'),
  a_marsh_waders: A('a_marsh_waders', 'ชุดลุยบึง', 'rare', 'z3', { def: 12, hp: 55 },
    { chest: 'fur', shoulder: 'round', skirt: 'fringe', emblem: 'leaf', arm: 'bracer', main: '#4a5a3a', trim: '#c27ff0', accent: '#e8ff9a' }, 'กันพิษได้ถึงเอว ส่วนเหนือเอวต้องระวังเอง'),
  a_dune_wrap: A('a_dune_wrap', 'ผ้าพันกายทะเลทราย', 'rare', 'z5', { def: 11, hp: 52, crit: 0.04 },
    { chest: 'robe', shoulder: 'none', skirt: 'kilt', emblem: 'sun', arm: 'wide', main: '#c8a46a', trim: '#7fd0c0', accent: '#f3dca0' }, 'กันแดดกันทราย และซ่อนอาวุธได้สามเล่ม'),
  a_spore_coat: A('a_spore_coat', 'เสื้อคลุมเห็ดเรืองแสง', 'rare', 'z6', { def: 12, hp: 58, spd: 0.02 },
    { chest: 'leaf', shoulder: 'round', skirt: 'tails', emblem: 'star', arm: 'plain', main: '#5a3a6a', trim: '#9fffd8', accent: '#f0d0ff' }, 'เรืองแสงอ่อนๆ ในที่มืด ไม่ต้องพกตะเกียง'),
  a_foundry_plate: A('a_foundry_plate', 'เกราะโรงหลอม', 'epic', 'z7', { def: 20, hp: 85, spd: -0.03 },
    { chest: 'plate', shoulder: 'layered', skirt: 'kilt', emblem: 'chain', arm: 'bracer', main: '#5a5650', trim: '#ffcf5a', accent: '#ffe65a' }, 'หมุดย้ำทุกตัวตีด้วยค้อนสายฟ้า'),
  a_magma_scale: A('a_magma_scale', 'เกราะเกล็ดลาวา', 'epic', 'z8', { def: 21, hp: 88, atk: 4 },
    { chest: 'scale', shoulder: 'horn', skirt: 'fringe', emblem: 'flame', arm: 'chain', main: '#3a1a14', trim: '#ff7a33', accent: '#ffb35a' }, 'ระหว่างเกล็ดมีลาวาไหลเบาๆ'),
  a_sky_vestment: A('a_sky_vestment', 'อาภรณ์ฟ้า', 'epic', 'z9', { def: 18, hp: 82, crit: 0.05, spd: 0.04 },
    { chest: 'robe', shoulder: 'feather', skirt: 'robe', emblem: 'sun', arm: 'bracer', main: '#e8f0ff', trim: '#5fa8ec', accent: '#ffe65a' }, 'สวมแล้วตัวเบาเหมือนเดินบนเมฆ'),
  a_ashen_guard: A('a_ashen_guard', 'เกราะองครักษ์เถ้า', 'epic', 'z10', { def: 23, hp: 95, critMult: 0.1 },
    { chest: 'lamellar', shoulder: 'spike', skirt: 'tassets', emblem: 'skull', arm: 'spiked', main: '#3a3330', trim: '#e0b45a', accent: '#ff8a3d' }, 'องครักษ์ของบัลลังก์เถ้าไม่เคยถอดเกราะนี้'),
  a_traveler_tunic: A('a_traveler_tunic', 'เสื้อนักเดินทาง', 'common', 'shop', { def: 5, hp: 26 },
    { chest: 'harness', shoulder: 'none', skirt: 'none', emblem: 'none', arm: 'plain', main: '#6a5a4a', trim: '#c9a46a', accent: '#e8d8b0' }, 'ทนทาน ราคาไม่แพง ซ่อมได้ทุกหมู่บ้าน'),
  a_militia_mail: A('a_militia_mail', 'เกราะโซ่อาสา', 'uncommon', 'shop', { def: 9, hp: 38 },
    { chest: 'chain', shoulder: 'none', skirt: 'kilt', emblem: 'none', arm: 'chain', main: '#7a7a82', trim: '#5a3a24', accent: '#c8c8d0' }, 'เกราะมาตรฐานของอาสาสมัครเฝ้าค่าย'),
});

// relics of the ten underworld gods (tower bosses) — crafting parts and drops
const R = (id, name, rarity, desc, color) => ({ id, name, category: 'material', rarity, sellPrice: { rare: 60, epic: 120, legendary: 240, mythic: 600 }[rarity], art: { kind: 'relic', main: color }, desc });
export const RELICS_V7 = Object.freeze({
  m_hell1: R('m_hell1', 'น้ำตาแม่น้ำวิญญาณ', 'rare', 'หยดน้ำที่ไม่เคยแห้ง จากเทพผู้แจวเรือข้ามแม่น้ำวิญญาณ (ชั้น 10)', '#7fe8ff'),
  m_hell2: R('m_hell2', 'ข้อโซ่ตรวนนิรันดร์', 'rare', 'ห่วงโซ่ของกาฬโลหิต หนักเกินขนาดของมัน (ชั้น 20)', '#b8b8c4'),
  m_hell3: R('m_hell3', 'ถ่านไฟนรก', 'epic', 'ถ่านที่ไม่มีวันมอด จากมารีจิ เทพเปลวไฟนรก (ชั้น 30)', '#ff5a1a'),
  m_hell4: R('m_hell4', 'เศษเงาไร้เสียง', 'epic', 'ความมืดที่ตกตะกอนจากสุญญตา (ชั้น 40)', '#5a5a7a'),
  m_hell5: R('m_hell5', 'จานตาชั่งวิญญาณ', 'epic', 'ชิ้นส่วนตาชั่งของยมทัณฑ์ (ชั้น 50)', '#e0b45a'),
  m_hell6: R('m_hell6', 'เกล็ดภุชงค์นรก', 'legendary', 'เกล็ดที่ลอกจากเทพอสรพิษ (ชั้น 60)', '#a8d070'),
  m_hell7: R('m_hell7', 'เข็มนาฬิกามรณะ', 'legendary', 'เข็มที่ราตรีกาลใช้นับเวลาที่เหลือของทุกชีวิต (ชั้น 70)', '#fff3c4'),
  m_hell8: R('m_hell8', 'หน้ากากพันหน้า', 'legendary', 'หน้ากากหนึ่งในพันของทศพักตร์มาร (ชั้น 80)', '#ff5a9a'),
  m_hell9: R('m_hell9', 'ผลึกขุมน้ำแข็ง', 'mythic', 'ความหนาวที่ลึกที่สุดจากอสุรเหม (ชั้น 90)', '#cfeaff'),
  m_hell10: R('m_hell10', 'มงกุฎมหากาฬ', 'mythic', 'มงกุฎของราชันแห่งขุมนรก (ชั้น 100)', '#ff3a3a'),
});
export const TOWER_PARTS = Object.freeze({ t1: 'm_hell1', t2: 'm_hell2', t3: 'm_hell3', t4: 'm_hell4', t5: 'm_hell5', t6: 'm_hell6', t7: 'm_hell7', t8: 'm_hell8', t9: 'm_hell9', t10: 'm_hell10' });
