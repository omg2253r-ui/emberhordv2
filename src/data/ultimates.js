// Ultimates (ท่าไม้ตาย, v8): 50 in five tiers that the codex shows, plus 3 in a secret sixth tier shown only as ???.
// A weapon may carry one — the chance and the tier depend on its rarity, and which one it is was decided the moment
// that weapon was found (systems/ultimate.js). The gauge fills by landing blows (PvE: monsters +1, bosses +2,
// perfect dodge / parry +5; PvP: a blow that lands +4, a blow taken +2, a perfect dodge / parry +6); when it is
// full the ultimate can be unleashed.
//
// seq: the choreography, run in order by battle/ultimate.js. Step kinds:
//   charge {t}                         gather power (the cut-in plays over it)
//   dash {n, power, dist}              dash through the target n times
//   blink {n, power}                   vanish and slash around the target n times
//   spin {t, power, r, gap}            spin in place, cutting around
//   leap {power, r}                    leap onto the target and crash down
//   beam {power, len, w, ticks, t}     a great beam at the target
//   rain {kind, n, power, r, spread, t} things fall on the target area (meteor · sword · arrow · star · bolt · feather)
//   pillars {power, r}                 pillars of light on every foe nearby
//   nova {power, r}                    a burst around the hero
//   cross {power, r}                   a giant X cut on the target
//   barrage {kind, n, power, t}        a storm of shots at the target
//   vortex {r, t, power, end}          pull everything in, then burst
//   sig {kind, power, hits, t, ...}    the signature apparition (dragon, phoenix, bigblade, moon, sun, lotus, wolves,
//                                      hammer, chains, galaxy, blossom, claws, clock, eye, gate, roots, serpent,
//                                      thundergod) — it deals `hits` blows of `power` while it lasts
//   finish {power, r}                  the last explosion, the screen goes white
// power = one blow, as a multiple of attack (before the hero's bonuses). wt: weapon types that can carry it (null = all).

export const ULT_TIERS = Object.freeze([
  null,
  { n: 1, name: 'ธรรมดา', color: '#9fb3c8', glow: '#cfe0ff' },
  { n: 2, name: 'หายาก', color: '#5fd0a0', glow: '#b8ffe0' },
  { n: 3, name: 'ยอดเยี่ยม', color: '#6f9cff', glow: '#cfe0ff' },
  { n: 4, name: 'ตำนาน', color: '#c58bff', glow: '#f0d8ff' },
  { n: 5, name: 'เทพนิยาย', color: '#ffb84a', glow: '#fff0c0' },
  { n: 6, name: '???', color: '#ff5f7a', glow: '#ffd0dc', secret: true },
]);
// gauge needed to unleash, by tier (farming vs. PvP — see systems/ultimate.js for the reasoning)
export const ULT_NEED = Object.freeze({ pve: [0, 70, 100, 130, 170, 220, 280], pvp: [0, 50, 70, 90, 120, 160, 200] });
export const ULT_GAIN = Object.freeze({ mob: 1, boss: 2, perfect: 5, pvpHit: 4, pvpHurt: 2, pvpPerfect: 6 });

const U = (id, tier, name, el, wt, seq, desc) => [id, Object.freeze({ id, tier, name, el, wt: wt ? Object.freeze(wt) : null, seq: Object.freeze(seq.map((s) => Object.freeze(s))), desc })];

export const ULTIMATES = Object.freeze(Object.fromEntries([
  // ================================================================= tier 1
  U('ult_flash_cut', 1, 'ดาบสายฟ้าแลบ', 'volt', null,
    [{ k: 'charge', t: 0.5 }, { k: 'dash', n: 2, power: 1.6, dist: 360 }, { k: 'finish', power: 1.8, r: 150 }],
    'พุ่งผ่าศัตรูไปกลับสองรอบเร็วเท่าสายฟ้า แล้วจุดระเบิดประกายไฟฟ้า'),
  U('ult_ember_spin', 1, 'พายุเพลิงหมุน', 'fire', null,
    [{ k: 'charge', t: 0.4 }, { k: 'spin', t: 1.2, power: 0.75, r: 150, gap: 0.15 }, { k: 'nova', power: 2.2, r: 200 }],
    'หมุนตัวเป็นทอร์นาโดเพลิงก่อนระเบิดคลื่นไฟออกรอบตัว'),
  U('ult_frost_lotus', 1, 'บัวน้ำแข็งบาน', 'ice', null,
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'lotus', power: 1.1, hits: 3, t: 1.0, r: 180 }, { k: 'nova', power: 1.8, r: 180 }],
    'ดอกบัวน้ำแข็งบานใต้เท้าศัตรู กลีบคมบาดซ้ำ แล้วแตกเป็นเกล็ดหิมะ'),
  U('ult_gale_arrows', 1, 'ห่าฝนศรวายุ', 'wind', ['bow'],
    [{ k: 'charge', t: 0.4 }, { k: 'barrage', kind: 'arrow', n: 10, power: 0.55, t: 0.7 }, { k: 'rain', kind: 'arrow', n: 10, power: 0.6, r: 60, spread: 160, t: 0.8 }],
    'ยิงศรต่อเนื่องเป็นสาย แล้วยิงขึ้นฟ้าให้ร่วงลงเป็นห่าฝน'),
  U('ult_stone_fist', 1, 'หมัดภูผา', 'earth', null,
    [{ k: 'charge', t: 0.5 }, { k: 'leap', power: 2.4, r: 170 }, { k: 'nova', power: 1.6, r: 220 }],
    'กระโดดทุ่มทั้งตัวลงใส่ศัตรู แผ่นดินแตกออกเป็นวง'),
  U('ult_shadow_cross', 1, 'กากบาทเงา', 'shadow', null,
    [{ k: 'charge', t: 0.4 }, { k: 'blink', n: 2, power: 1.4 }, { k: 'cross', power: 2.4, r: 150 }],
    'หายตัวฟันสองครั้ง แล้วทิ้งรอยกากบาทเงาขนาดใหญ่ไว้บนตัวศัตรู'),
  U('ult_holy_bell', 1, 'ระฆังแสง', 'holy', null,
    [{ k: 'charge', t: 0.5 }, { k: 'pillars', power: 1.8, r: 90 }, { k: 'nova', power: 1.6, r: 200 }],
    'เสียงระฆังสวรรค์เรียกเสาแสงลงบนศัตรูทุกตัว'),
  U('ult_venom_bloom', 1, 'ดอกพิษบาน', 'poison', null,
    [{ k: 'charge', t: 0.4 }, { k: 'vortex', r: 180, t: 1.0, power: 0.4, end: 2.2 }, { k: 'nova', power: 1.2, r: 220 }],
    'ดูดศัตรูเข้าหาดอกไม้พิษที่บานกลางสนาม แล้วพ่นละอองพิษระเบิด'),
  U('ult_tide_slash', 1, 'คลื่นฟันวารี', 'water', null,
    [{ k: 'charge', t: 0.4 }, { k: 'dash', n: 1, power: 1.8, dist: 320 }, { k: 'barrage', kind: 'crescent', n: 3, power: 1.2, t: 0.5 }],
    'พุ่งฟันพร้อมสะบัดคลื่นน้ำเป็นใบมีดสามสาย'),
  U('ult_star_spark', 1, 'ประกายดาวตก', 'star', null,
    [{ k: 'charge', t: 0.5 }, { k: 'rain', kind: 'star', n: 8, power: 0.8, r: 70, spread: 170, t: 0.9 }, { k: 'finish', power: 1.6, r: 160 }],
    'ดาวดวงเล็กแปดดวงร่วงลงรอบศัตรู ก่อนรวมกันระเบิด'),

  // ================================================================= tier 2
  U('ult_thunder_tiger', 2, 'เสือฟ้าคำราม', 'volt', null,
    [{ k: 'charge', t: 0.5 }, { k: 'blink', n: 2, power: 1.4 }, { k: 'sig', kind: 'claws', power: 1.6, hits: 2, t: 0.8, sets: 2 }, { k: 'finish', power: 2.4, r: 170 }],
    'วิญญาณเสือสายฟ้ากระโจนตะปบสองครั้ง รอยกรงเล็บผ่าลงเป็นสายฟ้า'),
  U('ult_phoenix_kick', 2, 'ลูกเตะนกเพลิง', 'fire', null,
    [{ k: 'charge', t: 0.5 }, { k: 'leap', power: 2.0, r: 160 }, { k: 'sig', kind: 'phoenix', power: 2.4, hits: 1, t: 0.9, s: 0.8 }, { k: 'nova', power: 1.6, r: 200 }],
    'กระโดดเตะลงพร้อมนกเพลิงที่พุ่งตามลงมาจากฟ้า'),
  U('ult_ice_coffin', 2, 'โลงน้ำแข็ง', 'ice', null,
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'roots', power: 1.2, hits: 3, t: 1.0, el: 'ice' }, { k: 'finish', power: 3.0, r: 170 }],
    'แท่งน้ำแข็งผุดล้อมศัตรูเป็นโลงศพ แล้วแตกละเอียดพร้อมกัน'),
  U('ult_wolf_pack', 2, 'ฝูงหมาป่าวิญญาณ', 'wind', null,
    [{ k: 'charge', t: 0.4 }, { k: 'sig', kind: 'wolves', power: 1.3, hits: 4, t: 1.1, n: 5 }, { k: 'dash', n: 1, power: 2.4, dist: 380 }],
    'เรียกฝูงหมาป่าวิญญาณวิ่งทะลวง แล้วพุ่งตามไปเป็นตัวสุดท้าย'),
  U('ult_quake_hammer', 2, 'ค้อนธรณีสะเทือน', 'earth', ['greatsword', 'spear', 'staff', 'scythe', 'sword'],
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'hammer', power: 4.2, hits: 1, t: 1.0 }, { k: 'nova', power: 1.6, r: 240 }],
    'ค้อนยักษ์จากแผ่นดินหวดลงที่ศัตรู พื้นทั้งสนามสะเทือน'),
  U('ult_night_blades', 2, 'ใบมีดราตรี', 'shadow', ['dagger', 'twinblades', 'katana'],
    [{ k: 'charge', t: 0.4 }, { k: 'blink', n: 5, power: 1.0 }, { k: 'cross', power: 2.6, r: 160 }],
    'หายเข้าความมืดฟันห้าทิศ ก่อนปรากฏตัวด้านหลังพร้อมกากบาทสุดท้าย'),
  U('ult_sun_spear', 2, 'หอกสุริยะทะลวง', 'holy', ['spear', 'staff', 'bow'],
    [{ k: 'charge', t: 0.7 }, { k: 'beam', power: 1.1, len: 760, w: 46, ticks: 6, t: 1.0 }],
    'รวมแสงอาทิตย์ไว้ที่ปลายอาวุธแล้วแทงออกเป็นลำแสงยาวสุดสนาม'),
  U('ult_blood_moon', 2, 'จันทร์โลหิต', 'blood', null,
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'moon', power: 2.2, hits: 2, t: 1.1 }, { k: 'blink', n: 3, power: 1.0 }],
    'จันทร์สีเลือดลอยขึ้นหลังศัตรูแล้วหมุนกรีด ก่อนเจ้าจะไล่ฟันซ้ำ'),
  U('ult_lightning_rain', 2, 'ห่าฟ้าผ่า', 'volt', ['staff', 'bow', 'spear'],
    [{ k: 'charge', t: 0.6 }, { k: 'rain', kind: 'bolt', n: 10, power: 0.9, r: 80, spread: 200, t: 1.0 }, { k: 'finish', power: 1.8, r: 180 }],
    'ชูอาวุธเรียกฟ้าผ่าลงสิบสายรอบตัวศัตรู'),
  U('ult_petal_dance', 2, 'ระบำกลีบซากุระ', 'nature', ['katana', 'sword', 'twinblades'],
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'blossom', power: 0.6, hits: 4, t: 1.0 }, { k: 'blink', n: 4, power: 1.0 }, { k: 'finish', power: 1.8, r: 160 }],
    'พายุกลีบดอกไม้หมุนรอบศัตรู ทุกกลีบคือคมดาบ'),

  // ================================================================= tier 3
  U('ult_azure_dragon', 3, 'มังกรครามทะยาน', 'water', null,
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'dragon', power: 1.8, hits: 5, t: 1.4 }, { k: 'finish', power: 3.0, r: 200 }],
    'มังกรวารีสีครามทะยานจากใต้เท้า พุ่งทะลุศัตรูแล้วม้วนตัวขึ้นฟ้า'),
  U('ult_crimson_dragon', 3, 'มังกรเพลิงผลาญ', 'fire', null,
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'dragon', power: 1.6, hits: 4, t: 1.3, breath: true }, { k: 'rain', kind: 'meteor', n: 5, power: 1.6, r: 110, spread: 180, t: 1.0 }],
    'มังกรเพลิงพ่นไฟเป็นทาง ทิ้งลูกไฟร่วงตามหลัง'),
  U('ult_heaven_blade', 3, 'ดาบสวรรค์ร่วง', 'holy', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'bigblade', power: 6.0, hits: 1, t: 1.1 }, { k: 'nova', power: 2.0, r: 260 }],
    'ดาบยักษ์จากสรวงสวรรค์ร่วงลงปักกลางตัวศัตรู'),
  U('ult_galaxy_spin', 3, 'วังวนดาราจักร', 'star', null,
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'galaxy', power: 0.6, hits: 8, t: 1.6, pull: 600 }, { k: 'finish', power: 3.4, r: 230 }],
    'ดาราจักรหมุนใต้สนาม ดูดศัตรูเข้ากลางวนแล้วระเบิดเป็นดาว'),
  U('ult_thousand_arrows', 3, 'ศรพันดอก', 'wind', ['bow'],
    [{ k: 'charge', t: 0.5 }, { k: 'barrage', kind: 'arrow', n: 18, power: 0.5, t: 0.9 }, { k: 'rain', kind: 'arrow', n: 20, power: 0.55, r: 60, spread: 230, t: 1.0 }, { k: 'finish', power: 2.0, r: 170 }],
    'ยิงศรต่อเนื่องจนท้องฟ้ามืด ลูกศรนับพันร่วงลงมา'),
  U('ult_storm_king', 3, 'ราชาพายุอสุนี', 'volt', null,
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'thundergod', power: 0, hits: 0, t: 0.6 }, { k: 'rain', kind: 'bolt', n: 9, power: 1.1, r: 90, spread: 200, t: 1.0 }, { k: 'finish', power: 2.6, r: 200 }],
    'มงกุฎสายฟ้าปรากฏเหนือหัว ฟ้าผ่าตามคำสั่งราชาพายุ'),
  U('ult_frost_moon', 3, 'จันทร์น้ำแข็งผ่าฟ้า', 'ice', null,
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'moon', power: 2.4, hits: 2, t: 1.1 }, { k: 'cross', power: 3.2, r: 170 }],
    'จันทร์เสี้ยวน้ำแข็งขึ้นกลางฟ้าแล้วผ่าลงเป็นกากบาท'),
  U('ult_void_gate', 3, 'ประตูความว่าง', 'void', null,
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'gate', power: 0.7, hits: 7, t: 1.2, n: 7 }, { k: 'vortex', r: 200, t: 0.9, power: 0.4, end: 2.6 }],
    'ประตูมิติเจ็ดบานเปิดด้านหลัง ดาบความว่างพุ่งออกมาไม่หยุด'),
  U('ult_root_prison', 3, 'กรงรากพฤกษา', 'nature', null,
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'roots', power: 1.4, hits: 3, t: 1.0 }, { k: 'spin', t: 1.0, power: 0.8, r: 170, gap: 0.16 }],
    'รากไม้หนามผุดขังศัตรู แล้วหมุนดาบบดให้แหลก'),
  U('ult_scythe_harvest', 3, 'เก็บเกี่ยววิญญาณ', 'shadow', ['scythe'],
    [{ k: 'charge', t: 0.5 }, { k: 'spin', t: 1.4, power: 0.9, r: 220, gap: 0.16 }, { k: 'sig', kind: 'moon', power: 3.0, hits: 1, t: 0.9 }],
    'เหวี่ยงเคียวหมุนเก็บเกี่ยวทุกชีวิตรอบตัว ก่อนจันทร์เงาตัดลงครั้งสุดท้าย'),

  // ================================================================= tier 4
  U('ult_twin_dragons', 4, 'มังกรคู่หยินหยาง', 'arcane', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'dragon', power: 1.8, hits: 4, t: 1.3, el: 'fire' }, { k: 'sig', kind: 'dragon', power: 1.8, hits: 4, t: 1.3, el: 'ice', mirror: true }, { k: 'finish', power: 4.0, r: 240 }],
    'มังกรไฟและมังกรน้ำแข็งพันเกลียวกันพุ่งทะลวง แล้วระเบิดเป็นหยินหยาง'),
  U('ult_phoenix_rebirth', 4, 'ฟีนิกซ์คืนชีพ', 'fire', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'phoenix', power: 5.0, hits: 1, t: 1.0, s: 1.3 }, { k: 'rain', kind: 'feather', n: 12, power: 0.8, r: 70, spread: 220, t: 0.9 }, { k: 'nova', power: 2.4, r: 260, heal: 0.15 }],
    'ฟีนิกซ์ยักษ์ดิ่งลงจากฟ้า ขนนกเพลิงโปรยลงมาและเยียวยาเจ้า'),
  U('ult_starfall', 4, 'ดาวตกพันดวง', 'star', null,
    [{ k: 'charge', t: 0.7 }, { k: 'rain', kind: 'meteor', n: 14, power: 1.4, r: 110, spread: 260, t: 1.6 }, { k: 'finish', power: 4.0, r: 260 }],
    'เปิดท้องฟ้าให้ดาวตกนับไม่ถ้วนพุ่งลงสนาม'),
  U('ult_sky_swords', 4, 'ฝนดาบฟ้า', 'steel', null,
    [{ k: 'charge', t: 0.6 }, { k: 'rain', kind: 'sword', n: 16, power: 0.9, r: 60, spread: 220, t: 1.2 }, { k: 'sig', kind: 'bigblade', power: 5.0, hits: 1, t: 1.0 }],
    'ดาบนับร้อยตกจากฟ้า แล้วดาบเล่มใหญ่ที่สุดปักปิดท้าย'),
  U('ult_eclipse', 4, 'สุริยคราส', 'void', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'sun', power: 0.8, hits: 4, t: 1.4, black: true }, { k: 'vortex', r: 230, t: 0.9, power: 0.5, end: 3.4 }, { k: 'finish', power: 3.0, r: 260 }],
    'ดวงอาทิตย์สีดำลงมาบดบังสนาม ดูดแสงทุกอย่างแล้วระเบิด'),
  U('ult_kraken', 4, 'อสูรทะเลลึก', 'water', null,
    [{ k: 'charge', t: 0.6 }, { k: 'sig', kind: 'serpent', power: 1.3, hits: 6, t: 1.6 }, { k: 'vortex', r: 220, t: 0.8, power: 0.5, end: 3.6 }],
    'อสรพิษทะเลลึกม้วนตัวขึ้นรอบศัตรู ลากทุกอย่างลงวังวน'),
  U('ult_titan_wrath', 4, 'โทสะไททัน', 'earth', null,
    [{ k: 'charge', t: 0.6 }, { k: 'leap', power: 2.6, r: 180 }, { k: 'leap', power: 2.6, r: 180 }, { k: 'sig', kind: 'hammer', power: 5.0, hits: 1, t: 1.0, s: 1.3 }, { k: 'nova', power: 2.0, r: 280 }],
    'กระโดดทุบสองครั้งแล้วยกค้อนไททันฟาดลงทั้งสนาม'),
  U('ult_thunder_emperor', 4, 'จักรพรรดิอสนี', 'volt', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'thundergod', power: 0, hits: 0, t: 0.5 }, { k: 'beam', power: 1.2, len: 800, w: 56, ticks: 8, t: 1.2 }, { k: 'rain', kind: 'bolt', n: 8, power: 1.2, r: 90, spread: 200, t: 0.8 }],
    'จักรพรรดิฟ้าปล่อยลำแสงอสนีกวาดสนาม แล้วฟ้าผ่าซ้ำทุกจุด'),
  U('ult_hundred_flowers', 4, 'ร้อยบุปผาประหาร', 'nature', null,
    [{ k: 'charge', t: 0.6 }, { k: 'blink', n: 8, power: 1.0 }, { k: 'sig', kind: 'blossom', power: 0.7, hits: 5, t: 1.1 }, { k: 'cross', power: 4.0, r: 190 }],
    'ฟันแปดทิศจนกลีบดอกไม้ร่วงเต็มสนาม ทุกกลีบคือแผล'),
  U('ult_frozen_time', 4, 'หยุดเวลาน้ำแข็ง', 'ice', null,
    [{ k: 'charge', t: 0.5 }, { k: 'sig', kind: 'clock', power: 0, hits: 0, t: 0.8 }, { k: 'blink', n: 6, power: 1.2 }, { k: 'finish', power: 4.2, r: 230 }],
    'นาฬิกายักษ์หยุดเวลาทั้งสนาม เจ้าเดินฟันศัตรูทีละตัวก่อนเวลาเดินอีกครั้ง'),

  // ================================================================= tier 5
  U('ult_dragon_emperor', 5, 'จักรพรรดิมังกรเทวะ', 'holy', null,
    [{ k: 'charge', t: 0.8 }, { k: 'sig', kind: 'dragon', power: 2.2, hits: 6, t: 1.6, s: 1.5, breath: true }, { k: 'rain', kind: 'star', n: 12, power: 1.2, r: 90, spread: 240, t: 1.0 }, { k: 'finish', power: 6.0, r: 300 }],
    'มังกรทองคำแห่งสวรรค์ลงมาตามคำเรียก ทั้งสนามกลายเป็นแสง'),
  U('ult_world_ender', 5, 'วันสิ้นโลก', 'fire', null,
    [{ k: 'charge', t: 0.8 }, { k: 'sig', kind: 'sun', power: 1.0, hits: 4, t: 1.2 }, { k: 'rain', kind: 'meteor', n: 18, power: 1.4, r: 120, spread: 280, t: 1.6 }, { k: 'finish', power: 6.0, r: 320 }],
    'ดวงอาทิตย์ดวงที่สองลงมาพร้อมอุกกาบาตทั้งฟ้า วันสุดท้ายของศัตรู'),
  U('ult_god_eye', 5, 'เนตรเทพสวรรค์', 'holy', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'eye', power: 0, hits: 0, t: 0.7 }, { k: 'beam', power: 1.3, len: 900, w: 70, ticks: 10, t: 1.4 }, { k: 'pillars', power: 3.0, r: 110 }],
    'ดวงตาของเทพเปิดกลางฟ้า มองที่ใด แสงพิพากษาตกที่นั่น'),
  U('ult_thousand_cuts', 5, 'พันดาบไร้เงา', 'steel', ['sword', 'katana', 'dagger', 'twinblades', 'greatsword', 'scythe'],
    [{ k: 'charge', t: 0.6 }, { k: 'blink', n: 12, power: 1.1 }, { k: 'cross', power: 4.0, r: 200 }, { k: 'finish', power: 5.0, r: 260 }],
    'เร็วจนไม่มีเงา ฟันสิบสองครั้งในลมหายใจเดียว แผลทั้งหมดเปิดพร้อมกัน'),
  U('ult_abyss_gate', 5, 'ประตูขุมนรก', 'void', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'gate', power: 0.9, hits: 9, t: 1.3, n: 9 }, { k: 'sig', kind: 'chains', power: 1.5, hits: 2, t: 0.8, n: 8 }, { k: 'vortex', r: 260, t: 1.0, power: 0.6, end: 4.0 }, { k: 'finish', power: 4.0, r: 300 }],
    'ประตูขุมนรกเก้าบานเปิดออก โซ่ตรวนดึงศัตรูลงไปในความมืด'),
  U('ult_heaven_storm', 5, 'พายุฟ้าสะท้าน', 'volt', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'thundergod', power: 0, hits: 0, t: 0.6 }, { k: 'rain', kind: 'bolt', n: 16, power: 1.2, r: 100, spread: 280, t: 1.5 }, { k: 'finish', power: 6.0, r: 300 }],
    'ท้องฟ้าทั้งผืนแตกเป็นสายฟ้า ไม่มีที่ไหนปลอดภัย'),
  U('ult_moon_requiem', 5, 'บทเพลงจันทรา', 'star', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'moon', power: 2.4, hits: 2, t: 1.0 }, { k: 'sig', kind: 'moon', power: 2.4, hits: 2, t: 1.0, dir: 2.1 }, { k: 'sig', kind: 'moon', power: 2.4, hits: 2, t: 1.0, dir: 4.2 }, { k: 'finish', power: 5.0, r: 280 }],
    'จันทร์สามดวงร้องเพลงศพ กรีดสนามสามครั้งก่อนเงียบลง'),
  U('ult_foxfire', 5, 'อัคคีจิ้งจอกเก้าหาง', 'arcane', null,
    [{ k: 'charge', t: 0.7 }, { k: 'barrage', kind: 'orb', n: 9, power: 1.8, t: 1.0 }, { k: 'blink', n: 6, power: 1.2 }, { k: 'finish', power: 5.4, r: 280 }],
    'ไฟจิ้งจอกเก้าดวงไล่ล่าศัตรูเอง แล้วเจ้าปิดฉากด้วยเปลวไฟสีม่วง'),
  U('ult_world_tree', 5, 'พฤกษาแห่งโลก', 'nature', null,
    [{ k: 'charge', t: 0.8 }, { k: 'sig', kind: 'roots', power: 1.6, hits: 4, t: 1.2, n: 10, s: 1.4 }, { k: 'sig', kind: 'lotus', power: 1.4, hits: 3, t: 1.0, s: 1.4 }, { k: 'finish', power: 5.6, r: 300 }],
    'รากของต้นไม้แห่งโลกทะลุขึ้นจากพื้น ดอกไม้แห่งชีวิตบานแล้วระเบิด'),
  U('ult_blood_king', 5, 'ราชันโลหิต', 'blood', null,
    [{ k: 'charge', t: 0.7 }, { k: 'sig', kind: 'moon', power: 2.6, hits: 2, t: 1.0 }, { k: 'blink', n: 8, power: 1.2 }, { k: 'nova', power: 4.0, r: 300, heal: 0.2 }],
    'ราชันแห่งเลือดฟันทุกชีวิตในสนาม แล้วดูดเลือดทั้งหมดกลับเข้ากาย'),

  // ================================================================= tier 6 (secret: the codex shows ???)
  U('ult_genesis', 6, 'ปฐมกาล', 'arcane', null,
    [{ k: 'charge', t: 0.9 }, { k: 'sig', kind: 'clock', power: 0, hits: 0, t: 0.7 }, { k: 'sig', kind: 'galaxy', power: 0.9, hits: 8, t: 1.4, pull: 700, s: 1.3 }, { k: 'sig', kind: 'dragon', power: 2.4, hits: 6, t: 1.4, s: 1.6, el: 'star' }, { k: 'finish', power: 8.0, r: 360 }],
    'ย้อนเวลากลับไปก่อนดวงดาวถือกำเนิด แล้วสร้างจักรวาลใหม่ทับศัตรู'),
  U('ult_twilight_of_gods', 6, 'อวสานแห่งเทพ', 'fire', null,
    [{ k: 'charge', t: 0.9 }, { k: 'sig', kind: 'gate', power: 1.0, hits: 9, t: 1.2, n: 9, el: 'void' }, { k: 'rain', kind: 'meteor', n: 20, power: 1.5, r: 130, spread: 300, t: 1.6 }, { k: 'sig', kind: 'phoenix', power: 6.0, hits: 1, t: 1.0, s: 1.5 }, { k: 'finish', power: 8.0, r: 360 }],
    'ประตูนรกเปิด ฟ้าถล่ม และนกเพลิงตัวสุดท้ายดิ่งลงปิดฉากยุคของเทพ'),
  U('ult_amber_heart', 6, 'หัวใจอำพันนิรันดร์', 'holy', null,
    [{ k: 'charge', t: 0.9 }, { k: 'sig', kind: 'dragon', power: 2.2, hits: 5, t: 1.3, el: 'fire', breath: true }, { k: 'sig', kind: 'dragon', power: 2.2, hits: 5, t: 1.3, el: 'star', mirror: true }, { k: 'sig', kind: 'bigblade', power: 9.0, hits: 1, t: 1.2, s: 1.4 }, { k: 'finish', power: 8.0, r: 380, heal: 0.3 }],
    'สองพี่น้องมังกรกลับมาพร้อมกัน ดาบที่ตีจากหัวใจและดวงตาของพวกเขาร่วงลงจากฟ้า'),
]));

export const ULT_IDS = Object.freeze(Object.keys(ULTIMATES));
export const ultsOfTier = (t) => ULT_IDS.filter((id) => ULTIMATES[id].tier === t);
export const getUlt = (id) => (Object.prototype.hasOwnProperty.call(ULTIMATES, id) ? ULTIMATES[id] : null);
