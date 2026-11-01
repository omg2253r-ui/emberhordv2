// Item definitions. `id` is the stable key; `name` is display only.
// category: weapon | armor | charm | wings | material | consumable
// rarity: common · uncommon · rare · epic · legendary · mythic   (secret: name and art hidden until owned)
// stats keys: atk, def, hp, crit, critMult, spd (spd is a fraction, 0.05 = +5% move speed)
// art: key used by src/art/icons.js to draw the icon (and the in-game weapon sprite).
// wtype (weapons only): moveset from src/data/weapons.js — sword | katana | dagger | greatsword | staff | bow | spear

import { WEAPONS_V7 } from './weapons2.js';
import { WEAPONS_V8, MATS_V8 } from './weapons3.js';
import { EGYPT_ITEMS } from './egypt.js';
import { ARMORS_V7, RELICS_V7 } from './items2.js';

const BASE_ITEMS = {
  // ---- weapons
  w_rust_blade:   { id: 'w_rust_blade', wtype: 'sword',   name: 'ดาบสนิมเก่า',       category: 'weapon', rarity: 'common',   stats: { atk: 8, crit: 0.03 },
                    art: { kind: 'blade', blade: '#a9a39a', edge: '#d7d1c4', guard: '#6d4a2c', grip: '#3b2a20' },
                    desc: 'ดาบเก่าที่ยังคมพอจะใช้ล่าได้' },
  w_hunter_saber: { id: 'w_hunter_saber', wtype: 'sword', name: 'ดาบนายพราน',        category: 'weapon', rarity: 'uncommon', stats: { atk: 13, crit: 0.05 },
                    art: { kind: 'saber', blade: '#c7ccd1', edge: '#f1f3f4', guard: '#b07a2e', grip: '#4a2f22' },
                    desc: 'ดาบโค้งเบามือ ฟันได้ไว' },
  w_thorn_edge:   { id: 'w_thorn_edge', wtype: 'sword',   name: 'ดาบคมหนาม',         category: 'weapon', rarity: 'rare',     stats: { atk: 19, crit: 0.08 },
                    art: { kind: 'thorn', blade: '#6f9a5b', edge: '#cfe3a8', guard: '#5a3a24', grip: '#2e2019' },
                    desc: 'หล่อจากหนามของหมูป่าหลังหนาม' },
  w_ember_fang:   { id: 'w_ember_fang', wtype: 'sword',   name: 'เขี้ยวอัคคี',         category: 'weapon', rarity: 'epic',     stats: { atk: 27, crit: 0.10, critMult: 0.2 },
                    art: { kind: 'fang', blade: '#c4492e', edge: '#ffc979', guard: '#2a1a14', grip: '#1c1210', glow: '#ff8a3d' },
                    desc: 'ยังอุ่นอยู่เสมอ แม้ในคืนที่หนาวที่สุด' },

  // ---- katana (ดาบซามูไร): fast 4-hit combo, charged iai dash
  w_ronin_katana:   { id: 'w_ronin_katana', wtype: 'katana', name: 'ดาบซามูไรพเนจร', category: 'weapon', rarity: 'uncommon', stats: { atk: 12, crit: 0.08 },
                      art: { kind: 'katana', blade: '#c9cfd6', edge: '#f4f6f8', guard: '#2a1a14', grip: '#6e2a22', wrap: '#e8d9b8' }, desc: 'คมบางเบา ชักออกจากฝักได้ในพริบตา' },
  w_mist_katana:    { id: 'w_mist_katana', wtype: 'katana', name: 'ดาบซามูไรสายหมอก', category: 'weapon', rarity: 'rare', stats: { atk: 17, crit: 0.12 },
                      art: { kind: 'katana', blade: '#b9d3d9', edge: '#f0fbff', guard: '#3a4a50', grip: '#24323a', wrap: '#9fc4cc' }, desc: 'ใบดาบเย็นเฉียบเหมือนหมอกยามเช้า' },
  w_moonfall_katana:{ id: 'w_moonfall_katana', wtype: 'katana', name: 'จันทร์ร่วง', category: 'weapon', rarity: 'epic', stats: { atk: 24, crit: 0.15, critMult: 0.25 },
                      art: { kind: 'katana', blade: '#dcd6ff', edge: '#ffffff', guard: '#e0b45a', grip: '#1c1430', wrap: '#7a62c8', glow: '#b9a8ff' }, desc: 'ว่ากันว่าฟันแสงจันทร์ให้ขาดได้' },
  // ---- dagger (ดาบเล็กคู่): 5-hit flurry, dodge-cancel anytime, backstab after a dodge
  w_twin_fangs:     { id: 'w_twin_fangs', wtype: 'dagger', name: 'มีดคู่เขี้ยวงู', category: 'weapon', rarity: 'uncommon', stats: { atk: 10, crit: 0.12 },
                      art: { kind: 'dagger', blade: '#b8bcc0', edge: '#eef0f2', guard: '#7a5a3c', grip: '#3b2a20' }, desc: 'สั้น เร็ว และไม่เคยปล่อยให้เหยื่อตั้งตัว' },
  w_venom_daggers:  { id: 'w_venom_daggers', wtype: 'dagger', name: 'มีดคู่หนามพิษ', category: 'weapon', rarity: 'rare', stats: { atk: 15, crit: 0.16 },
                      art: { kind: 'dagger', blade: '#7fae5c', edge: '#d6f0a8', guard: '#3a2a20', grip: '#2a1d16' }, desc: 'ปลายมีดชุบยางหนาม แผลจะชาไปครึ่งวัน' },
  w_cinder_talons:  { id: 'w_cinder_talons', wtype: 'dagger', name: 'กรงเล็บถ่าน', category: 'weapon', rarity: 'epic', stats: { atk: 21, crit: 0.2, critMult: 0.3 },
                      art: { kind: 'dagger', blade: '#d0532f', edge: '#ffd08a', guard: '#2a1a14', grip: '#1c1210', glow: '#ff8a3d' }, desc: 'ร้อนจนอากาศรอบคมบิดเบี้ยว' },
  // ---- greatsword (ดาบใหญ่): slow, huge arcs, cannot be knocked back mid-swing
  w_iron_cleaver:   { id: 'w_iron_cleaver', wtype: 'greatsword', name: 'ดาบใหญ่เหล็กทุบ', category: 'weapon', rarity: 'uncommon', stats: { atk: 16, def: 2 },
                      art: { kind: 'greatsword', blade: '#9ea4a8', edge: '#dfe3e6', guard: '#5a3a24', grip: '#3b2a20' }, desc: 'หนักจนต้องใช้สองมือ แต่ฟันทีเดียวเกลี้ยงลาน' },
  w_boar_breaker:   { id: 'w_boar_breaker', wtype: 'greatsword', name: 'ดาบใหญ่ทลายหมูป่า', category: 'weapon', rarity: 'rare', stats: { atk: 23, def: 3 },
                      art: { kind: 'greatsword', blade: '#7d8a5a', edge: '#d2e2a0', guard: '#6e4a30', grip: '#2e2019' }, desc: 'ตีจากหนามหลังของหมูป่า ยิ่งตียิ่งแข็ง' },
  w_furnace_cleaver:{ id: 'w_furnace_cleaver', wtype: 'greatsword', name: 'ดาบใหญ่เตาหลอม', category: 'weapon', rarity: 'epic', stats: { atk: 32, def: 5, hp: 20 },
                      art: { kind: 'greatsword', blade: '#4a3a34', edge: '#ff9a4a', guard: '#2a1a14', grip: '#1c1210', glow: '#ff8a3d' }, desc: 'แกนกลางยังคุไฟจากเตาหลอมลับ' },
  // ---- staff (คทาเวท): bolts, nova finisher, charged meteor, blink dodge
  w_ash_staff:      { id: 'w_ash_staff', wtype: 'staff', name: 'คทาไม้เถ้า', category: 'weapon', rarity: 'uncommon', stats: { atk: 13, hp: 10 },
                      art: { kind: 'staff', wood: '#7a5a3c', orb: '#ffb35a', trim: '#e0b45a' }, desc: 'ไม้จากต้นที่รอดจากคืนเถ้าถล่ม' },
  w_thorn_rod:      { id: 'w_thorn_rod', wtype: 'staff', name: 'คทาหนามมรกต', category: 'weapon', rarity: 'rare', stats: { atk: 19, hp: 15, crit: 0.05 },
                      art: { kind: 'staff', wood: '#4b6e33', orb: '#9fe27a', trim: '#cfe3a8' }, desc: 'เถาหนามพันรอบหินที่เรืองแสงสีเขียว' },
  w_ember_scepter:  { id: 'w_ember_scepter', wtype: 'staff', name: 'คทาอัคคีโบราณ', category: 'weapon', rarity: 'epic', stats: { atk: 27, crit: 0.08, critMult: 0.2 },
                      art: { kind: 'staff', wood: '#2a1a14', orb: '#ff6a2a', trim: '#e0b45a', glow: '#ffd08a' }, desc: 'ช่างของดาวเคยใช้มันจุดเตาหลอมทั้งเหมือง' },
  // ---- bow (ธนู): ranged, 3rd shot is a piercing volley, charged power shot
  w_hunter_bow:     { id: 'w_hunter_bow', wtype: 'bow', name: 'ธนูนายพราน', category: 'weapon', rarity: 'uncommon', stats: { atk: 12, spd: 0.03 },
                      art: { kind: 'bow', wood: '#8a5a36', string: '#efe2c4', trim: '#d9a84e' }, desc: 'คันธนูไม้ไผ่ดัดไฟ เบาและแม่นยำ' },
  w_thornstring_bow:{ id: 'w_thornstring_bow', wtype: 'bow', name: 'ธนูสายหนาม', category: 'weapon', rarity: 'rare', stats: { atk: 17, spd: 0.04, crit: 0.06 },
                      art: { kind: 'bow', wood: '#4b6e33', string: '#cfe3a8', trim: '#a3c46c' }, desc: 'สายธนูทำจากเถาหนามที่ไม่มีวันขาด' },
  w_sunfire_bow:    { id: 'w_sunfire_bow', wtype: 'bow', name: 'ธนูสุริยะถ่าน', category: 'weapon', rarity: 'epic', stats: { atk: 24, crit: 0.1, spd: 0.05 },
                      art: { kind: 'bow', wood: '#2a1a14', string: '#ffd08a', trim: '#e0b45a', glow: '#ff8a3d' }, desc: 'ลูกศรที่ยิงออกไปลุกเป็นไฟกลางอากาศ' },
  // ---- spear (หอก): long thrusts, wide sweep finisher, charged piercing rush
  w_boar_spear:     { id: 'w_boar_spear', wtype: 'spear', name: 'หอกล่าหมูป่า', category: 'weapon', rarity: 'uncommon', stats: { atk: 13, def: 1 },
                      art: { kind: 'spear', shaft: '#8a5a36', head: '#b8bcc0', edge: '#eef0f2', trim: '#b8382a' }, desc: 'ยาวพอจะแทงก่อนเขี้ยวหมูป่าจะถึงตัว' },
  w_thorn_pike:     { id: 'w_thorn_pike', wtype: 'spear', name: 'หอกยาวหนาม', category: 'weapon', rarity: 'rare', stats: { atk: 19, def: 2 },
                      art: { kind: 'spear', shaft: '#4a3a24', head: '#7fae5c', edge: '#d6f0a8', trim: '#a3c46c' }, desc: 'ปลายหอกแตกเป็นหนามสามแฉก' },
  w_ember_glaive:   { id: 'w_ember_glaive', wtype: 'spear', name: 'ง้าวอัคคี', category: 'weapon', rarity: 'epic', stats: { atk: 27, crit: 0.06 },
                      art: { kind: 'spear', shaft: '#2a1a14', head: '#d0532f', edge: '#ffd08a', trim: '#e0b45a', glow: '#ff8a3d' }, desc: 'ใบง้าวโค้งเหมือนเปลวไฟที่ถูกแช่แข็ง' },

  // ---- armor
  a_cloth_wrap:   { id: 'a_cloth_wrap',   name: 'ผ้าคลุมเดินป่า',      category: 'armor', rarity: 'common',   stats: { def: 4, hp: 20 },
                    art: { kind: 'cloak', main: '#3f6b67', trim: '#b8382a' }, desc: 'กันลม กันหนาม ได้บ้าง' },
  a_hide_vest:    { id: 'a_hide_vest',    name: 'เสื้อหนังสัตว์',      category: 'armor', rarity: 'uncommon', stats: { def: 8, hp: 35 },
                    art: { kind: 'vest', main: '#8a5a36', trim: '#d9a84e' }, desc: 'หนังหนาเย็บสองชั้น' },
  a_bark_mail:    { id: 'a_bark_mail',    name: 'เกราะเปลือกไม้หนาม',  category: 'armor', rarity: 'rare',     stats: { def: 13, hp: 55 },
                    art: { kind: 'bark', main: '#5d6b3a', trim: '#a3c46c' }, desc: 'เปลือกไม้แข็งที่ฟื้นตัวเองได้ช้าๆ' },
  a_lacquer_plate:{ id: 'a_lacquer_plate',name: 'เกราะรักดำ',          category: 'armor', rarity: 'epic',     stats: { def: 19, hp: 80, atk: 3 },
                    art: { kind: 'plate', main: '#231a17', trim: '#e0b45a' }, desc: 'ลงรักเก้าชั้น ปิดทองลายกนก' },

  // ---- charms
  c_moss_bead:    { id: 'c_moss_bead',    name: 'ลูกปัดมอส',           category: 'charm', rarity: 'uncommon', stats: { hp: 25, spd: 0.05 },
                    art: { kind: 'bead', main: '#6aa25a', trim: '#2e4a2a' }, desc: 'กลิ่นป่าหลังฝน ทำให้ก้าวเบา' },
  c_boar_tusk:    { id: 'c_boar_tusk',    name: 'เครื่องรางเขี้ยวหมูป่า', category: 'charm', rarity: 'rare',     stats: { crit: 0.08, critMult: 0.3 },
                    art: { kind: 'tusk', main: '#efe2c4', trim: '#8a3a2a' }, desc: 'เขี้ยวที่ไม่เคยหัก' },
  c_cinder_eye:   { id: 'c_cinder_eye',   name: 'ดวงตาถ่านแดง',        category: 'charm', rarity: 'epic',     stats: { atk: 6, crit: 0.1, critMult: 0.4 },
                    art: { kind: 'eye', main: '#ff7a33', trim: '#2a1a14' }, desc: 'มองเห็นจุดอ่อนในเปลวไฟ' },

  // ---- materials
  m_iron_shard:   { id: 'm_iron_shard',   name: 'เศษเหล็ก',            category: 'material', rarity: 'common',   sellPrice: 6,
                    art: { kind: 'shard', main: '#9aa3ad' }, desc: 'วัตถุดิบตีบวกขั้นพื้นฐาน' },
  m_beast_hide:   { id: 'm_beast_hide',   name: 'หนังสัตว์',           category: 'material', rarity: 'common',   sellPrice: 8,
                    art: { kind: 'hide', main: '#9b6a43' }, desc: 'ใช้ตีบวกตั้งแต่ +4 ขึ้นไป' },
  m_thorn_core:   { id: 'm_thorn_core',   name: 'แก่นหนาม',            category: 'material', rarity: 'rare',     sellPrice: 40,
                    art: { kind: 'core', main: '#7dbb5a', glow: '#d6f59a' }, desc: 'จำเป็นสำหรับตีบวกตั้งแต่ +7' },
  m_bloodstone:   { id: 'm_bloodstone',   name: 'ศิลาเปลี่ยนสายเลือด',  category: 'material', rarity: 'epic', special: 'reroll',
                    art: { kind: 'bloodstone', main: '#a8323a', glow: '#ff9a7a' }, desc: 'ได้จากบอสเท่านั้น ใช้สุ่มเผ่าใหม่ในแท็บสายเลือด (ขายไม่ได้)' },
  m_ember_core:   { id: 'm_ember_core',   name: 'แก่นถ่านอัคคี',        category: 'material', rarity: 'rare',     sellPrice: 55,
                    art: { kind: 'core', main: '#e0592f', glow: '#ffd08a' }, desc: 'ร้อนจนวางบนมือเปล่าไม่ได้' },

  // ---- legendary: one per online-zone boss (src/data/zones.js)
  w_tempest_saber:   { id: 'w_tempest_saber', wtype: 'sword', name: 'ดาบพายุราชันนก', category: 'weapon', rarity: 'legendary', stats: { atk: 36, crit: 0.12, critMult: 0.3, spd: 0.04 },
                       art: { kind: 'saber', blade: '#d9e8f6', edge: '#ffffff', guard: '#f5d48a', grip: '#34465e', glow: '#bfe3ff' }, desc: 'ขนนกพายุพันรอบด้าม ฟันแล้วลมตาม' },
  w_glacier_fang:    { id: 'w_glacier_fang', wtype: 'katana', name: 'เขี้ยวธารน้ำแข็ง', category: 'weapon', rarity: 'legendary', stats: { atk: 32, crit: 0.2, critMult: 0.35 },
                       art: { kind: 'katana', blade: '#bfe8ff', edge: '#ffffff', guard: '#2f5a80', grip: '#1a2a3a', wrap: '#e8f8ff', glow: '#bfe8ff' }, desc: 'เย็นจนอากาศรอบใบดาบกลายเป็นเกล็ด' },
  w_hydra_kiss:      { id: 'w_hydra_kiss', wtype: 'dagger', name: 'จุมพิตไฮดรา', category: 'weapon', rarity: 'legendary', stats: { atk: 28, crit: 0.25, critMult: 0.4 },
                       art: { kind: 'dagger', blade: '#b8e08a', edge: '#e8ff9a', guard: '#5a2f78', grip: '#24401e', glow: '#c27ff0' }, desc: 'สามคม สามพิษ ไม่มีใครได้แผลเดียว' },
  w_umbral_greatblade:{ id: 'w_umbral_greatblade', wtype: 'greatsword', name: 'มหาดาบจันทร์ดับ', category: 'weapon', rarity: 'legendary', stats: { atk: 42, def: 7, hp: 40 },
                       art: { kind: 'greatsword', blade: '#5a4f80', edge: '#e0b0ff', guard: '#2a2438', grip: '#0e0b16', glow: '#c27ff0' }, desc: 'ใบดาบดูดแสงรอบตัวจนมืดสนิท' },
  w_sunspire_staff:  { id: 'w_sunspire_staff', wtype: 'staff', name: 'คทายอดสุริยะ', category: 'weapon', rarity: 'legendary', stats: { atk: 36, crit: 0.1, critMult: 0.3 },
                       art: { kind: 'staff', wood: '#c8a46a', orb: '#7fe8ff', trim: '#f3dca0' }, desc: 'ดวงตาที่สามของสฟิงซ์ยังมองเห็นอยู่' },
  w_sporebloom_bow:  { id: 'w_sporebloom_bow', wtype: 'bow', name: 'ธนูบุปผาสปอร์', category: 'weapon', rarity: 'legendary', stats: { atk: 32, crit: 0.12, spd: 0.06 },
                       art: { kind: 'bow', wood: '#6a3a8a', string: '#9fffd8', trim: '#f0d0ff' }, desc: 'สายธนูเรืองแสงในความมืด' },
  w_thunder_lance:   { id: 'w_thunder_lance', wtype: 'spear', name: 'ทวนอัสนี', category: 'weapon', rarity: 'legendary', stats: { atk: 36, crit: 0.1, spd: 0.03 },
                       art: { kind: 'spear', shaft: '#4a5a70', head: '#ffe65a', edge: '#fff9c4', trim: '#7fe8ff' }, desc: 'ปลายทวนมีประกายไฟฟ้าวิ่งตลอดเวลา' },
  a_drakescale:      { id: 'a_drakescale', name: 'เกราะเกล็ดมังกรรอยแยก', category: 'armor', rarity: 'legendary', stats: { def: 26, hp: 110, atk: 5 },
                       art: { kind: 'plate', main: '#5a1a14', trim: '#ffb35a' }, desc: 'เกล็ดที่ไม่เคยไหม้แม้ในลาวา' },
  c_seraph_feather:  { id: 'c_seraph_feather', name: 'ขนนกเทวะ', category: 'charm', rarity: 'legendary', stats: { hp: 40, crit: 0.12, critMult: 0.5 },
                       art: { kind: 'bead', main: '#fff3c4', trim: '#e0b45a' }, desc: 'อุ่นเหมือนแสงแรกของวัน' },
  c_ember_crown:     { id: 'c_ember_crown', name: 'มงกุฎเถ้าถ่าน', category: 'charm', rarity: 'legendary', stats: { atk: 10, crit: 0.14, critMult: 0.6 },
                       art: { kind: 'eye', main: '#ff8a3d', trim: '#3a2a24' }, desc: 'มงกุฎของผู้ที่เผาป่าอำพัน ยังคุอยู่ข้างใน' },


  // ================================================================== v6: scythes, twin blades, raid gear, wings
  // ---- scythe (เคียว)
  w_reaper_hook:   { id: 'w_reaper_hook', wtype: 'scythe', name: 'เคียวเกี่ยวรวง', category: 'weapon', rarity: 'uncommon', stats: { atk: 14, crit: 0.03 }, src: 's1',
                     art: { kind: 'scythe', shaft: '#7a5a3c', blade: '#b8bcc0', edge: '#eef0f2', trim: '#b07a2e' }, desc: 'เคียวเกี่ยวข้าวที่ถูกตีใหม่ให้คมพอจะเกี่ยวอย่างอื่น' },
  w_thornreap:     { id: 'w_thornreap', wtype: 'scythe', name: 'เคียวหนามอสูร', category: 'weapon', rarity: 'rare', stats: { atk: 20, crit: 0.06 }, src: 's1',
                     art: { kind: 'scythe', shaft: '#4a3a24', blade: '#7fae5c', edge: '#d6f0a8', trim: '#a3c46c', gem: '#c4492e' }, desc: 'ใบเคียวงอกหนามเองทุกคืนข้างแรม' },
  w_ember_scythe:  { id: 'w_ember_scythe', wtype: 'scythe', name: 'เคียวถ่านจันทร์', category: 'weapon', rarity: 'epic', stats: { atk: 28, critMult: 0.25, crit: 0.05 }, src: 's2',
                     art: { kind: 'scythe', shaft: '#2a1a14', blade: '#d0532f', edge: '#ffd08a', trim: '#e0b45a', glow: '#ff8a3d', gem: '#ffd08a' }, desc: 'ตีจากถ่านในเหมืองร้าง ฟันแล้วทิ้งรอยไหม้รูปเสี้ยวจันทร์' },
  w_dusk_scythe:   { id: 'w_dusk_scythe', wtype: 'scythe', name: 'เคียวรัตติกาล', category: 'weapon', rarity: 'legendary', stats: { atk: 38, crit: 0.12, critMult: 0.3 }, src: 'z4',
                     art: { kind: 'scythe', shaft: '#1c1430', blade: '#5a4f80', edge: '#e0b0ff', trim: '#c27ff0', glow: '#c27ff0', gem: '#e0b0ff' }, desc: 'กลืนแสงที่ตกกระทบจนเห็นเพียงขอบคม' },
  w_heaven_scythe: { id: 'w_heaven_scythe', wtype: 'scythe', name: 'เคียวสวรรค์', category: 'weapon', rarity: 'mythic', stats: { atk: 54, crit: 0.2, critMult: 0.55, spd: 0.08, hp: 60 }, src: 'r3', unique: 'judgment',
                     art: { kind: 'scythe', shaft: '#f3dca0', blade: '#fff8ea', edge: '#ffffff', trim: '#f5c35a', glow: '#fff3a0', gem: '#7fe8ff' }, desc: 'เคียวของผู้ตัดสินแห่งฟากฟ้า ทุกคมที่ฟันคือคำพิพากษา' },
  // ---- twin blades (ดาบคู่)
  w_twin_sabers:   { id: 'w_twin_sabers', wtype: 'twinblades', name: 'ดาบคู่นักเดินทาง', category: 'weapon', rarity: 'uncommon', stats: { atk: 12, crit: 0.07 }, src: 's1',
                     art: { kind: 'twin', blade: '#c7ccd1', edge: '#f1f3f4', guard: '#b07a2e', grip: '#4a2f22' }, desc: 'สองเล่มที่ถูกตีจากเหล็กก้อนเดียวกัน' },
  w_twin_thorns:   { id: 'w_twin_thorns', wtype: 'twinblades', name: 'ดาบคู่หนามเลือด', category: 'weapon', rarity: 'rare', stats: { atk: 18, crit: 0.1 }, src: 's1',
                     art: { kind: 'twin', blade: '#8a3b2e', edge: '#f0a090', guard: '#5a3a24', grip: '#2e2019', rune: '#ffb3a4' }, desc: 'ยิ่งฟันเร็ว ยิ่งได้ยินเสียงหนามกรีดอากาศ' },
  w_twin_embers:   { id: 'w_twin_embers', wtype: 'twinblades', name: 'ดาบคู่อัคคีแฝด', category: 'weapon', rarity: 'epic', stats: { atk: 25, crit: 0.12, critMult: 0.2 }, src: 's2',
                     art: { kind: 'twin', blade: '#d0532f', edge: '#ffd08a', guard: '#2a1a14', grip: '#1c1210', glow: '#ff8a3d', rune: '#ffe2a0' }, desc: 'เล่มหนึ่งร้อน อีกเล่มร้อนกว่า' },
  w_twin_tempest:  { id: 'w_twin_tempest', wtype: 'twinblades', name: 'ดาบคู่พายุสลาตัน', category: 'weapon', rarity: 'legendary', stats: { atk: 34, crit: 0.15, spd: 0.04 }, src: 'z7',
                     art: { kind: 'twin', blade: '#bfe8ff', edge: '#ffffff', guard: '#2f5a80', grip: '#1a2a3a', glow: '#7fd0ff', rune: '#ffe65a' }, desc: 'ฟาดลงมาพร้อมเสียงฟ้าคำราม' },
  w_sovereign_twins: { id: 'w_sovereign_twins', wtype: 'twinblades', name: 'ดาบคู่ราชันมังกร', category: 'weapon', rarity: 'mythic', secret: true, stats: { atk: 54, crit: 0.2, critMult: 0.55, spd: 0.08, hp: 60 }, src: 'craft', unique: 'sovereign',
                     art: { kind: 'twin', blade: '#1a1418', edge: '#ff5a3a', guard: '#2a0e0a', grip: '#140c0c', glow: '#ff3a1a', rune: '#ffb35a',
                            off: { blade: '#e8f4ff', edge: '#7fe8ff', guard: '#f5d48a', grip: '#2a3850', glow: '#9fdcff', rune: '#ffffff' } },
                     desc: 'อสนีพิโรธในมือหนึ่ง เนตรพยากรณ์ในอีกมือ ความแค้นกับความหวังของสองพี่น้องมังกรที่ได้ร่วมทางกันอีกครั้ง' },

  // ---- armor (v6)
  a_wanderer_coat: { id: 'a_wanderer_coat', name: 'เสื้อคลุมนักพเนจร', category: 'armor', rarity: 'uncommon', stats: { def: 7, hp: 30, spd: 0.03 }, src: 's1',
                     art: { kind: 'coat', main: '#5a4a3a', trim: '#c9a46a' }, desc: 'ปกสูงกันลม กระเป๋าซ่อนอยู่เจ็ดใบ' },
  a_ronin_lamellar:{ id: 'a_ronin_lamellar', name: 'เกราะเกล็ดซามูไรพเนจร', category: 'armor', rarity: 'rare', stats: { def: 12, hp: 50, crit: 0.03 }, src: 's2',
                     art: { kind: 'lamellar', main: '#3a2e4a', trim: '#c2412f' }, desc: 'เกล็ดเหล็กร้อยด้วยเชือกแดง ขยับตัวได้ไม่ติดขัด' },
  a_moonlit_robe:  { id: 'a_moonlit_robe', name: 'อาภรณ์จันทรา', category: 'armor', rarity: 'rare', stats: { def: 9, hp: 40, crit: 0.04, critMult: 0.15 }, src: 'z2',
                     art: { kind: 'robe', main: '#2f4a6a', trim: '#e8f4ff' }, desc: 'ทอด้วยด้ายเงินที่เก็บได้ในคืนเดือนเพ็ญ' },
  a_iron_bastion:  { id: 'a_iron_bastion', name: 'เกราะป้อมเหล็กหนัก', category: 'armor', rarity: 'epic', stats: { def: 24, hp: 110, spd: -0.06 }, src: 'z7',
                     art: { kind: 'bastion', main: '#5a5650', trim: '#b8a890' }, desc: 'หนักเหมือนกำแพง ถ้ายืนนิ่งพอ ศัตรูจะเหนื่อยก่อน' },
  a_wolf_knight:   { id: 'a_wolf_knight', name: 'เกราะอัศวินหมาป่า', category: 'armor', rarity: 'epic', stats: { def: 17, hp: 80, atk: 4, crit: 0.04 }, src: 'z4',
                     art: { kind: 'knight', main: '#2e3440', trim: '#7f8fa6' }, desc: 'ผ้าคลุมขาดวิ่นของอัศวินที่ไม่เคยถอยแม้สักก้าว' },
  a_wrath_plate:   { id: 'a_wrath_plate', name: 'เกราะเกล็ดมังกรพิโรธ', category: 'armor', rarity: 'legendary', stats: { def: 28, hp: 130, atk: 8, critMult: 0.2 }, src: 'r1',
                     art: { kind: 'dragonplate', main: '#3a0e0a', trim: '#ff5a3a' }, desc: 'เกล็ดยังร้อนระอุราวกับความแค้นไม่เคยดับ' },
  a_seer_vestment: { id: 'a_seer_vestment', name: 'อาภรณ์ผู้หยั่งรู้', category: 'armor', rarity: 'legendary', stats: { def: 20, hp: 100, crit: 0.1, spd: 0.05 }, src: 'r2',
                     art: { kind: 'seer', main: '#1e2a4a', trim: '#9fdcff' }, desc: 'ลายดาวบนผ้าขยับตามอนาคตที่กำลังจะเกิด' },
  a_judgment_plate:{ id: 'a_judgment_plate', name: 'เกราะเทวาพิพากษา', category: 'armor', rarity: 'legendary', stats: { def: 30, hp: 140, crit: 0.05 }, src: 'r3',
                     art: { kind: 'seraph', main: '#efe6d0', trim: '#f5c35a' }, desc: 'สลักคำตัดสินไว้ทุกแผ่น อ่านออกเฉพาะผู้ที่ไม่มีความผิด' },

  // ---- charms (v6)
  c_wrath_fang:    { id: 'c_wrath_fang', name: 'เขี้ยวมังกรพิโรธ', category: 'charm', rarity: 'legendary', stats: { atk: 12, critMult: 0.45 }, src: 'r1',
                     art: { kind: 'tusk', main: '#ffb35a', trim: '#3a0e0a' }, desc: 'ยังร้อนเหมือนเพิ่งหลุดจากปาก' },
  c_prophecy_lens: { id: 'c_prophecy_lens', name: 'เลนส์แห่งนิมิต', category: 'charm', rarity: 'legendary', stats: { crit: 0.16, spd: 0.05 }, src: 'r2',
                     art: { kind: 'eye', main: '#7fe8ff', trim: '#1e2a4a' }, desc: 'มองผ่านแล้วเห็นการโจมตีล่วงหน้าหนึ่งลมหายใจ' },
  c_judgment_halo: { id: 'c_judgment_halo', name: 'วงรัศมีพิพากษา', category: 'charm', rarity: 'legendary', stats: { hp: 60, atk: 8, crit: 0.08 }, src: 'r3',
                     art: { kind: 'bead', main: '#fff3a0', trim: '#f5c35a' }, desc: 'ลอยเหนือศีรษะเองเมื่อผู้สวมยืนหยัดเพื่อสิ่งที่ถูก' },

  // ---- wings (ปีก) — a new equipment slot
  wg_ember_moth:   { id: 'wg_ember_moth', name: 'ปีกผีเสื้อถ่าน', category: 'wings', rarity: 'uncommon', stats: { spd: 0.03, hp: 10 }, src: 's2',
                     art: { kind: 'moth', main: '#8a4a2a', trim: '#ffb35a', glow: '#ff8a3d' }, desc: 'ผงถ่านบนปีกเรืองแสงทุกครั้งที่ขยับ' },
  wg_kinnaree:     { id: 'wg_kinnaree', name: 'ปีกกินรี', category: 'wings', rarity: 'rare', stats: { spd: 0.05, hp: 25 }, src: 'z1',
                     art: { kind: 'feather', main: '#f3e6c8', trim: '#e0b45a', glow: '#fff3c4' }, desc: 'ขนนกสีทองของกินรีในตำนาน เบาจนแทบไม่รู้สึก' },
  wg_ash_bat:      { id: 'wg_ash_bat', name: 'ปีกค้างคาวเถ้า', category: 'wings', rarity: 'rare', stats: { crit: 0.05, atk: 3 }, src: 'z4',
                     art: { kind: 'bat', main: '#3a2e34', trim: '#c27ff0', glow: '#c27ff0' }, desc: 'กางออกแล้วเงารอบตัวจะลึกขึ้นอีกชั้น' },
  wg_sky_crystal:  { id: 'wg_sky_crystal', name: 'ปีกผลึกนภา', category: 'wings', rarity: 'epic', stats: { crit: 0.06, spd: 0.05, hp: 20 }, src: 'z9',
                     art: { kind: 'crystal', main: '#9fdcff', trim: '#ffffff', glow: '#bfe8ff' }, desc: 'ผลึกแต่ละชิ้นสะท้อนท้องฟ้าคนละเวลา' },
  wg_wrath_dragon: { id: 'wg_wrath_dragon', name: 'ปีกมังกรพิโรธ', category: 'wings', rarity: 'legendary', stats: { atk: 9, critMult: 0.3, spd: 0.04 }, src: 'r1',
                     art: { kind: 'dragon', main: '#3a0e0a', trim: '#ff5a3a', glow: '#ff7a33' }, desc: 'พังผืดปีกยังมีลาวาไหลเวียน' },
  wg_prophecy:     { id: 'wg_prophecy', name: 'ปีกนัยน์พยากรณ์', category: 'wings', rarity: 'legendary', stats: { crit: 0.1, spd: 0.07 }, src: 'r2',
                     art: { kind: 'eye', main: '#1e2a4a', trim: '#9fdcff', glow: '#7fe8ff' }, desc: 'ลายบนปีกคือดวงตาที่ไม่เคยกะพริบ' },
  wg_seraph:       { id: 'wg_seraph', name: 'ปีกเทวาพิพากษา', category: 'wings', rarity: 'legendary', stats: { hp: 70, def: 6, crit: 0.05 }, src: 'r3',
                     art: { kind: 'seraph', main: '#fffaf0', trim: '#f5c35a', glow: '#fff3a0' }, desc: 'หกปีกที่กางออกพร้อมกันเหมือนบานประตูสวรรค์' },

  // ---- rare parts from the online zones (crafting)
  m_storm_quill:   { id: 'm_storm_quill', name: 'ขนนกพายุ', category: 'material', rarity: 'rare', sellPrice: 60, src: 'z1', art: { kind: 'core', main: '#d9e8f6', glow: '#ffffff' }, desc: 'ชิ้นส่วนจากราชันนกพายุ (ทุ่งหญ้าลมกรด) ใช้คราฟ' },
  m_frost_heart:   { id: 'm_frost_heart', name: 'แก่นน้ำแข็งนิรันดร์', category: 'material', rarity: 'rare', sellPrice: 65, src: 'z2', art: { kind: 'core', main: '#8fc4e8', glow: '#e8f8ff' }, desc: 'ชิ้นส่วนจากมังกรธารน้ำแข็ง ใช้คราฟ' },
  m_hydra_fang:    { id: 'm_hydra_fang', name: 'เขี้ยวไฮดรา', category: 'material', rarity: 'rare', sellPrice: 70, src: 'z3', art: { kind: 'shard', main: '#b8e08a' }, desc: 'ชิ้นส่วนจากไฮดราแห่งบึง ใช้คราฟ' },
  m_umbral_shard:  { id: 'm_umbral_shard', name: 'เศษเงาจันทร์ดับ', category: 'material', rarity: 'rare', sellPrice: 75, src: 'z4', art: { kind: 'core', main: '#5a4f80', glow: '#e0b0ff' }, desc: 'ชิ้นส่วนจากอัศวินจันทร์ดับ ใช้คราฟ' },
  m_sun_relic:     { id: 'm_sun_relic', name: 'วัตถุโบราณสุริยะ', category: 'material', rarity: 'rare', sellPrice: 80, src: 'z5', art: { kind: 'core', main: '#f3dca0', glow: '#7fe8ff' }, desc: 'ชิ้นส่วนจากสฟิงซ์ยักษ์ ใช้คราฟ' },
  m_spore_crown:   { id: 'm_spore_crown', name: 'มงกุฎสปอร์', category: 'material', rarity: 'rare', sellPrice: 85, src: 'z6', art: { kind: 'core', main: '#a86ad0', glow: '#9fffd8' }, desc: 'ชิ้นส่วนจากมารดาเห็ดราชินี ใช้คราฟ' },
  m_storm_coil:    { id: 'm_storm_coil', name: 'ขดลวดอัสนี', category: 'material', rarity: 'rare', sellPrice: 90, src: 'z7', art: { kind: 'shard', main: '#a8c0de' }, desc: 'ชิ้นส่วนจากไททันเทสลา ใช้คราฟ' },
  m_rift_scale:    { id: 'm_rift_scale', name: 'เกล็ดมังกรรอยแยก', category: 'material', rarity: 'epic', sellPrice: 110, src: 'z8', art: { kind: 'bloodstone', main: '#8e2c21', glow: '#ffb35a' }, desc: 'ชิ้นส่วนจากมังกรรอยแยก ใช้คราฟ' },
  m_halo_shard:    { id: 'm_halo_shard', name: 'เศษวงรัศมี', category: 'material', rarity: 'epic', sellPrice: 120, src: 'z9', art: { kind: 'core', main: '#fff3a0', glow: '#ffffff' }, desc: 'ชิ้นส่วนจากผู้พิทักษ์เทวะ ใช้คราฟ' },
  m_ash_crown_shard: { id: 'm_ash_crown_shard', name: 'เศษมงกุฎเถ้า', category: 'material', rarity: 'epic', sellPrice: 130, src: 'z10', art: { kind: 'shard', main: '#ff8a3d' }, desc: 'ชิ้นส่วนจากจักรพรรดิเถ้าถ่าน ใช้คราฟ' },
  // ---- special dungeon parts
  m_wrath_scale:   { id: 'm_wrath_scale', name: 'เกล็ดมังกรพิโรธ', category: 'material', rarity: 'epic', sellPrice: 160, src: 'r1', art: { kind: 'bloodstone', main: '#3a0e0a', glow: '#ff5a3a' }, desc: 'ร้อนจนต้องห่อด้วยหนังสามชั้น ใช้คราฟ' },
  m_prophecy_scale:{ id: 'm_prophecy_scale', name: 'เกล็ดดาราพยากรณ์', category: 'material', rarity: 'epic', sellPrice: 160, src: 'r2', art: { kind: 'bloodstone', main: '#1e2a4a', glow: '#9fdcff' }, desc: 'มีจุดแสงเหมือนกลุ่มดาวที่ยังไม่มีใครตั้งชื่อ ใช้คราฟ' },
  m_judgment_sigil:{ id: 'm_judgment_sigil', name: 'ตราประทับพิพากษา', category: 'material', rarity: 'epic', sellPrice: 180, src: 'r3', art: { kind: 'core', main: '#f5c35a', glow: '#fffaf0' }, desc: 'ตราที่ยังอุ่นด้วยอำนาจของผู้ตัดสิน ใช้คราฟ' },
  m_wrath_heart:   { id: 'm_wrath_heart', name: 'หัวใจแห่งความพิโรธ', category: 'material', rarity: 'mythic', special: 'relic', src: 'r1',
                     art: { kind: 'bloodstone', main: '#5a0e0a', glow: '#ff3a1a' }, desc: 'ยังเต้นอยู่ ช้า หนัก และเจ็บปวด (ขายไม่ได้)' },
  m_prophecy_eye:  { id: 'm_prophecy_eye', name: 'ดวงตามังกรแห่งคำพยากรณ์', category: 'material', rarity: 'mythic', special: 'relic', src: 'r2',
                     art: { kind: 'eye', main: '#7fe8ff', glow: '#ffffff' }, desc: 'มองแล้วจะเห็นตัวเองในอีกไม่กี่วินาทีข้างหน้า (ขายไม่ได้)' },

  // ---- consumables
  p_tonic:        { id: 'p_tonic',        name: 'ยาฟื้นพลัง',           category: 'consumable', rarity: 'common', sellPrice: 10,
                    art: { kind: 'potion', main: '#c93a2e' }, desc: 'ฟื้นพลังชีวิต 35% ใช้ระหว่างต่อสู้ (Q)' },
  p_luck:         { id: 'p_luck',         name: 'ยาโชคดี',              category: 'consumable', rarity: 'epic', sellPrice: 2500,
                    art: { kind: 'potion', main: '#5fe08a' }, desc: 'โชคดี ×2 นาน 5 นาที: สุ่มสัตว์เลี้ยงได้ของดีขึ้น ศัตรูดรอปของดีขึ้น และมีโอกาสได้ของเพิ่มตอนจบดัน ดื่มได้ที่แท็บอุปกรณ์ ดื่มซ้อนเพิ่มเวลาได้สูงสุด 15 นาที' },
};
// v7: thirty weapons with their own movesets, thirty armours, ten god relics
export const ITEMS = Object.freeze({ ...BASE_ITEMS, ...WEAPONS_V7, ...ARMORS_V7, ...RELICS_V7, ...WEAPONS_V8, ...MATS_V8, ...EGYPT_ITEMS });

export const EQUIP_SLOTS = Object.freeze(['weapon', 'armor', 'charm', 'wings']);
export const SLOT_NAMES = Object.freeze({ weapon: 'อาวุธ', armor: 'ชุดเกราะ', charm: 'เครื่องราง', wings: 'ปีก' });
export const STAT_NAMES = Object.freeze({ atk: 'พลังโจมตี', def: 'ป้องกัน', hp: 'พลังชีวิต', crit: 'โอกาสคริติคอล', critMult: 'แรงคริติคอล', spd: 'ความเร็ว' });

export function getItem(id) {
  return Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : null;
}

export function isEquipment(def) {
  return !!def && (def.category === 'weapon' || def.category === 'armor' || def.category === 'charm' || def.category === 'wings');
}

export function isStackable(def) {
  return !!def && (def.category === 'material' || def.category === 'consumable');
}
