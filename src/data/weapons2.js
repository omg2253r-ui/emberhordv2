// v7 weapons: thirty new pieces. Each one keeps its family's grip and dodge (sword, katana, dagger, greatsword,
// staff, bow, spear, scythe, twin blades) but has ITS OWN combo string, charged move, dodge attack and branch
// finisher — no two weapons in the game swing the same way (checked by tests/unit/v7gear.test.mjs).
// Art: `art.kind: 'forge'` + `art.form` (src/art/weaponForge.js) — every weapon has its own silhouette.
//
// extra move options (battle/moves.js): multi (hits the same targets n times), burn, slow, mark,
//   pull (negative kb), teleport 'behind', hop, stun, critBonus, forceCrit.
// src: 't1'…'t10' = the tower band that drops it (floors 1–10 … 91–100), see data/tower.js.
const arc = (range, deg) => ({ shape: 'arc', range, arc: deg });
const circ = (r, forward = 0) => ({ shape: 'circle', r, forward });
const proj = (kind, speed, r, o = {}) => ({ shape: 'proj', kind, speed, r, pierce: 0, count: 1, spread: 0, ...o });
const rush = (dist, width) => ({ shape: 'rush', dist, width });
const zone = (r, delay, reach) => ({ shape: 'zone', r, delay, reach });
// move(name, anim, [windup, active, recover, cancel], power, hit, extra)
const mv = (name, anim, t, power, hit, extra = {}) => ({ name, anim, windup: t[0], active: t[1], recover: t[2], cancel: t[3], power, hit, ...extra });

const W = (id, wtype, name, rarity, src, stats, art, desc, moves) => ({ id, wtype, name, category: 'weapon', rarity, src, stats, art: { kind: 'forge', ...art }, desc, moves });

export const WEAPONS_V7 = Object.freeze({
  // ---------------------------------------------------------------- swords
  w_flamberge: W('w_flamberge', 'sword', 'ดาบเปลวคลื่น', 'rare', 't1', { atk: 22, crit: 0.06 },
    { form: 'flamberge', blade: '#d8d0c4', edge: '#fff3e0', guard: '#8e2c21', grip: '#2a1a14', glow: '#ff8a3d' },
    'คมดาบเป็นคลื่นเหมือนเปลวไฟ ทุกแผลที่เปิดจะไหม้ต่อ', {
      combo: [
        mv('คลื่นเปลวซ้าย', 'slash', [0.07, 0.08, 0.2, 0.35], 0.9, arc(96, 120), { kb: 120, step: 14, burn: true }),
        mv('คลื่นเปลวขวา', 'slashUp', [0.07, 0.08, 0.2, 0.35], 0.95, arc(96, 120), { kb: 120, step: 14 }),
        mv('เปลวขึ้นฟ้า', 'heavyUp', [0.09, 0.09, 0.24, 0.4], 1.1, arc(104, 140), { kb: 200, step: 18, burn: true }),
        mv('สาดคลื่นไฟ', 'overhead', [0.12, 0.1, 0.34, 0.7], 1.6, proj('bolt', 520, 14, { count: 3, spread: 30, pierce: 1 }), { burn: true, shake: 4 }),
      ],
      charged: mv('เปลวคลื่นหมุน', 'spin', [0.06, 0.18, 0.3, 0.6], 2.2, circ(140), { kb: 300, burn: true, hitStop: 0.08, shake: 6 }),
      dash: mv('ฟันผ่านเปลว', 'thrust', [0.03, 0.12, 0.24, 0.5], 1.5, rush(160, 40), { kb: 160, burn: true }),
      branch: mv('คลื่นเปลวซ้อน', 'slash', [0.06, 0.1, 0.3, 0.6], 0.8, arc(110, 150), { multi: 3, kb: 160, burn: true, hitStop: 0.06 }),
    }),
  w_crystal_edge: W('w_crystal_edge', 'sword', 'ดาบผลึกแก้วใส', 'epic', 't3', { atk: 33, crit: 0.1, critMult: 0.15 },
    { form: 'crystalsword', blade: '#bfe8ff', edge: '#ffffff', guard: '#5a7a9a', grip: '#1e2a3a', glow: '#9fd8ff' },
    'ผลึกที่ไม่เคยแตก แต่แสงที่หักเหในตัวมันตัดได้ทุกอย่าง', {
      combo: [
        mv('แทงผลึก', 'thrust', [0.06, 0.07, 0.18, 0.35], 0.95, arc(120, 40), { kb: 140, step: 20, critBonus: 0.1 }),
        mv('ฟันหักเห', 'slash', [0.06, 0.08, 0.2, 0.35], 1.0, arc(100, 130), { kb: 140, step: 14 }),
        mv('ปริซึมแตกกระจาย', 'overhead', [0.1, 0.08, 0.34, 0.7], 1.2, proj('bolt', 760, 9, { count: 5, spread: 60, pierce: 2 }), { shake: 3 }),
      ],
      charged: mv('ลำแสงผลึก', 'thrust', [0.05, 0.08, 0.34, 0.6], 2.6, proj('bigArrow', 1300, 12, { pierce: 99 }), { critBonus: 0.25, shake: 5 }),
      dash: mv('ผลึกสะท้อน', 'slashUp', [0.02, 0.08, 0.22, 0.5], 1.4, arc(118, 160), { kb: 220, step: 50, slow: 0.6 }),
      branch: mv('กรงผลึก', 'spin', [0.08, 0.14, 0.32, 0.6], 1.6, circ(120), { kb: 0, slow: 0.4, stun: 0.6, hitStop: 0.07 }),
    }),
  w_bonesaw: W('w_bonesaw', 'sword', 'ดาบเลื่อยกระดูก', 'legendary', 't6', { atk: 47, crit: 0.08, hp: 40 },
    { form: 'bonesaw', blade: '#e8dcc0', edge: '#f8f0e0', guard: '#5a2a24', grip: '#2a1410', glow: '#e0503a' },
    'ฟันเลื่อยจากกระดูกเทพโซ่ตรวน ทุกครั้งที่ลากจะฉีกเกราะ', {
      combo: [
        mv('เลื่อยฉีก', 'slash', [0.08, 0.1, 0.22, 0.38], 0.55, arc(98, 120), { multi: 2, kb: 60, step: 10, mark: 0.08 }),
        mv('เลื่อยย้อน', 'slashUp', [0.08, 0.1, 0.22, 0.38], 0.55, arc(98, 120), { multi: 2, kb: 60, step: 10, mark: 0.08 }),
        mv('กระดูกบด', 'heavy', [0.14, 0.12, 0.34, 0.7], 1.9, arc(112, 170), { kb: 340, step: 24, stun: 0.5, hitStop: 0.08, shake: 6 }),
      ],
      charged: mv('ลากเลื่อยวงใหญ่', 'spin', [0.06, 0.22, 0.34, 0.65], 0.7, circ(132), { multi: 4, kb: 120, mark: 0.15, hitStop: 0.06, shake: 5 }),
      dash: mv('เลื่อยพุ่ง', 'thrust', [0.03, 0.14, 0.26, 0.5], 1.4, rush(190, 48), { kb: 120, mark: 0.12 }),
      branch: mv('ถอนกระดูก', 'heavyUp', [0.1, 0.12, 0.34, 0.65], 2.3, arc(118, 150), { kb: -220, stun: 0.7, hitStop: 0.09, shake: 6 }),
    }),
  w_sunblade: W('w_sunblade', 'sword', 'ดาบตะวันเที่ยง', 'mythic', 't10', { atk: 66, crit: 0.14, critMult: 0.35, hp: 80 },
    { form: 'sunblade', blade: '#fff3c4', edge: '#ffffff', guard: '#e0b45a', grip: '#5a2a14', glow: '#ffcf5a' },
    'แสงเที่ยงวันที่มหากาฬกลืนไว้ในขุมนรก ได้กลับคืนสู่มือมนุษย์', {
      combo: [
        mv('รุ่งอรุณ', 'slashUp', [0.06, 0.08, 0.18, 0.35], 1.0, arc(104, 130), { kb: 150, step: 16 }),
        mv('ตะวันฉาย', 'slash', [0.06, 0.08, 0.18, 0.35], 1.05, arc(104, 130), { kb: 150, step: 16, burn: true }),
        mv('แสงสาด', 'thrust', [0.06, 0.06, 0.2, 0.35], 0.9, proj('bolt', 700, 11, { count: 3, spread: 24, homing: 2 }), {}),
        mv('เที่ยงวัน', 'overhead', [0.12, 0.1, 0.32, 0.7], 2.1, circ(150, 50), { kb: 380, burn: true, stun: 0.5, hitStop: 0.09, shake: 8 }),
      ],
      charged: mv('สุริยะคราส', 'castBig', [0.06, 0.06, 0.4, 0.6], 3.6, zone(170, 0.5, 460), { kb: 400, stun: 0.8, shake: 10 }),
      dash: mv('อาทิตย์อุทัย', 'heavyUp', [0.02, 0.12, 0.26, 0.5], 1.7, rush(220, 56), { kb: 220, burn: true, critBonus: 0.2 }),
      branch: mv('วงตะวัน', 'spin', [0.06, 0.16, 0.3, 0.6], 2.4, circ(150), { kb: 320, burn: true, hitStop: 0.08, shake: 6 }),
    }),
  // ---------------------------------------------------------------- katana
  w_crimson_nodachi: W('w_crimson_nodachi', 'katana', 'โนดาจิกลีบโลหิต', 'rare', 't2', { atk: 24, crit: 0.1 },
    { form: 'crimsonkatana', blade: '#e8eef4', edge: '#ffffff', guard: '#c2412f', grip: '#2a1418', wrap: '#e0503a', glow: '#ff5a7a' },
    'ทุกครั้งที่ชักดาบ กลีบดอกไม้สีเลือดจะร่วงตาม', {
      combo: [
        mv('กลีบที่หนึ่ง', 'slash', [0.05, 0.06, 0.15, 0.35], 0.75, arc(102, 110), { kb: 80, step: 14 }),
        mv('กลีบที่สอง', 'slashUp', [0.05, 0.06, 0.15, 0.35], 0.75, arc(102, 110), { kb: 80, step: 14 }),
        mv('กลีบที่สาม', 'slash', [0.05, 0.06, 0.15, 0.35], 0.8, arc(102, 110), { kb: 80, step: 14 }),
        mv('กลีบที่สี่', 'thrust', [0.05, 0.06, 0.16, 0.35], 0.85, arc(124, 44), { kb: 120, step: 26 }),
        mv('พายุกลีบโลหิต', 'iai', [0.08, 0.14, 0.32, 0.7], 1.5, rush(150, 50), { kb: 160, critBonus: 0.2, hitStop: 0.06 }),
      ],
      charged: mv('ร้อยกลีบร่วง', 'iai', [0.04, 0.2, 0.32, 0.6], 0.6, circ(136), { multi: 5, kb: 60, critBonus: 0.15, hitStop: 0.08, shake: 5 }),
      dash: mv('สวนกลีบ', 'slash', [0.02, 0.08, 0.22, 0.5], 1.5, arc(116, 150), { kb: 180, step: 46, critBonus: 0.3 }),
      branch: mv('กลีบเดียวปลิดชีพ', 'iai', [0.12, 0.1, 0.34, 0.6], 2.4, arc(130, 60), { forceCrit: true, kb: 240, hitStop: 0.1 }),
    }),
  w_moonglass_katana: W('w_moonglass_katana', 'katana', 'ดาบแก้วจันทร์', 'epic', 't4', { atk: 36, crit: 0.12, spd: 0.04 },
    { form: 'moonkatana', blade: '#cfe0ff', edge: '#ffffff', guard: '#9fb8ff', grip: '#1a1e3a', wrap: '#cfd6e6', glow: '#9fb8ff' },
    'ใบดาบใสจนมองเห็นดวงจันทร์ผ่านมัน เงาของมันฟันได้เอง', {
      combo: [
        mv('จันทร์เสี้ยวซ้าย', 'slash', [0.05, 0.06, 0.16, 0.35], 0.85, arc(104, 140), { kb: 90, step: 14 }),
        mv('จันทร์เสี้ยวขวา', 'slashUp', [0.05, 0.06, 0.16, 0.35], 0.85, arc(104, 140), { kb: 90, step: 14 }),
        mv('เงาจันทร์', 'iai', [0.07, 0.12, 0.26, 0.6], 1.25, rush(140, 44), { kb: 120, critBonus: 0.15 }),
      ],
      charged: mv('จันทร์เพ็ญ', 'spin', [0.05, 0.16, 0.32, 0.6], 2.6, circ(150), { kb: 260, slow: 0.5, hitStop: 0.09, shake: 6 }),
      dash: mv('เงาข้างหลัง', 'slash', [0.02, 0.07, 0.22, 0.5], 1.9, arc(96, 140), { teleport: 'behind', forceCrit: true, kb: 160, hitStop: 0.06 }),
      branch: mv('จันทร์ซ้อนจันทร์', 'iai', [0.06, 0.14, 0.3, 0.6], 1.1, rush(180, 48), { multi: 2, kb: 140, critBonus: 0.25, hitStop: 0.07 }),
    }),
  w_thunder_katana: W('w_thunder_katana', 'katana', 'ดาบอสนีชักฟ้า', 'legendary', 't7', { atk: 50, crit: 0.14, critMult: 0.2 },
    { form: 'thunderkatana', blade: '#e8eef8', edge: '#fff9c4', guard: '#3a3a4a', grip: '#14141c', wrap: '#ffe65a', glow: '#ffe65a' },
    'ฟ้าผ่าลงมาตรงที่มันชี้ เร็วจนเสียงตามไม่ทัน', {
      combo: [
        mv('ประกายหนึ่ง', 'slash', [0.04, 0.05, 0.13, 0.3], 0.72, arc(100, 110), { kb: 70, step: 12, stun: 0.1 }),
        mv('ประกายสอง', 'slashUp', [0.04, 0.05, 0.13, 0.3], 0.72, arc(100, 110), { kb: 70, step: 12, stun: 0.1 }),
        mv('สายฟ้าฟาด', 'overhead', [0.08, 0.06, 0.3, 0.65], 1.7, zone(90, 0.25, 260), { kb: 220, stun: 0.5, shake: 5 }),
      ],
      charged: mv('ชักดาบอสนี', 'iai', [0.03, 0.16, 0.3, 0.6], 3.0, rush(280, 50), { kb: 200, stun: 0.6, critBonus: 0.25, hitStop: 0.1, shake: 7 }),
      dash: mv('ฟ้าแลบ', 'iai', [0.02, 0.1, 0.22, 0.5], 1.4, rush(150, 40), { kb: 120, stun: 0.3 }),
      branch: mv('สามสายฟ้า', 'castBig', [0.08, 0.05, 0.3, 0.6], 1.0, proj('bolt', 900, 10, { count: 3, spread: 30, pierce: 3 }), { stun: 0.3, shake: 4 }),
    }),
  // ---------------------------------------------------------------- daggers
  w_kris_pair: W('w_kris_pair', 'dagger', 'กริชคู่คลื่นพิษ', 'rare', 't1', { atk: 19, crit: 0.12 },
    { form: 'kris', blade: '#b8b0a0', edge: '#e8ff9a', guard: '#5a3a24', grip: '#2a1a10', glow: '#a8d070' },
    'คมคดเคี้ยวเหมือนงู แผลเล็กแต่พิษไหลไม่หยุด', {
      combo: [
        mv('แทงคด', 'stab', [0.03, 0.05, 0.11, 0.3], 0.5, arc(78, 90), { kb: 40, step: 10, burn: true }),
        mv('แทงเลื้อย', 'stabB', [0.03, 0.05, 0.11, 0.3], 0.5, arc(78, 90), { kb: 40, step: 10 }),
        mv('กริชวน', 'cross', [0.05, 0.06, 0.2, 0.55], 1.1, circ(90), { kb: 160, burn: true, hitStop: 0.04 }),
      ],
      charged: mv('ฝนกริช', 'throw', [0.05, 0.05, 0.3, 0.6], 0.6, proj('knife', 700, 9, { count: 7, spread: 70 }), { burn: true }),
      dash: mv('กริชลอบ', 'stab', [0.02, 0.06, 0.22, 0.5], 2.0, arc(84, 110), { teleport: 'behind', burn: true, forceCrit: true, kb: 140 }),
      branch: mv('พิษสามรอย', 'stab', [0.04, 0.08, 0.24, 0.55], 0.6, arc(84, 120), { multi: 3, kb: 60, burn: true, hitStop: 0.05 }),
    }),
  w_fang_hook: W('w_fang_hook', 'dagger', 'มีดเขี้ยวเกี่ยว', 'epic', 't4', { atk: 31, crit: 0.14, spd: 0.04 },
    { form: 'fanghook', blade: '#3a3440', edge: '#e0b0ff', guard: '#5a4a6a', grip: '#1a1420', glow: '#c27ff0' },
    'โค้งเหมือนเขี้ยว เกี่ยวศัตรูเข้ามาหาก่อนจะปิดฉาก', {
      combo: [
        mv('เกี่ยวเข้า', 'stab', [0.03, 0.05, 0.12, 0.3], 0.55, arc(96, 120), { kb: -160, step: 8 }),
        mv('ฉีกออก', 'stabB', [0.03, 0.05, 0.12, 0.3], 0.6, arc(80, 110), { kb: 120, step: 10 }),
        mv('เกี่ยวคู่', 'cross', [0.04, 0.05, 0.14, 0.3], 0.65, arc(96, 140), { kb: -200, step: 8 }),
        mv('เขี้ยวปิดฉาก', 'cross', [0.06, 0.07, 0.26, 0.6], 1.4, arc(88, 160), { kb: 240, critBonus: 0.2, hitStop: 0.05, shake: 3 }),
      ],
      charged: mv('ตะขอเหวี่ยง', 'throw', [0.05, 0.05, 0.3, 0.6], 1.5, proj('knife', 640, 12, { pierce: 99 }), { kb: -360, stun: 0.4 }),
      dash: mv('เขี้ยวทะลุ', 'stab', [0.02, 0.1, 0.22, 0.5], 1.6, rush(150, 36), { kb: 100, critBonus: 0.25 }),
      branch: mv('วงเขี้ยว', 'cross', [0.04, 0.12, 0.26, 0.55], 1.7, circ(104), { kb: -260, stun: 0.4, hitStop: 0.06 }),
    }),
  w_needle_stiletto: W('w_needle_stiletto', 'dagger', 'เข็มมรณะ', 'legendary', 't8', { atk: 45, crit: 0.2, critMult: 0.45 },
    { form: 'needle', blade: '#f0f4f8', edge: '#ffffff', guard: '#c8a050', grip: '#2a2420', glow: '#fff3c4' },
    'เข็มของเทพนาฬิกาตาย แทงทีเดียวเวลาของเหยื่อหยุดนิ่ง', {
      combo: [
        mv('จุดชีพจร', 'stab', [0.03, 0.04, 0.1, 0.28], 0.45, arc(88, 50), { kb: 20, step: 8, critBonus: 0.15 }),
        mv('จุดชีพจรซ้ำ', 'stabB', [0.03, 0.04, 0.1, 0.28], 0.45, arc(88, 50), { kb: 20, step: 8, critBonus: 0.15 }),
        mv('จุดชีพจรสาม', 'stab', [0.03, 0.04, 0.1, 0.28], 0.45, arc(88, 50), { kb: 20, step: 8, critBonus: 0.15 }),
        mv('จุดตาย', 'stab', [0.08, 0.05, 0.28, 0.6], 1.6, arc(96, 40), { forceCrit: true, stun: 0.7, kb: 80, hitStop: 0.07 }),
      ],
      charged: mv('ฝนเข็ม', 'throw', [0.05, 0.05, 0.3, 0.6], 0.45, proj('knife', 980, 6, { count: 9, spread: 30, pierce: 1 }), { critBonus: 0.2 }),
      dash: mv('เข็มหยุดเวลา', 'stab', [0.02, 0.05, 0.22, 0.5], 1.9, arc(84, 90), { teleport: 'behind', stun: 1.0, forceCrit: true, kb: 40 }),
      branch: mv('พันเข็ม', 'stab', [0.04, 0.1, 0.24, 0.55], 0.32, arc(92, 60), { multi: 6, kb: 10, critBonus: 0.2, hitStop: 0.06 }),
    }),
  // ---------------------------------------------------------------- greatswords
  w_executioner: W('w_executioner', 'greatsword', 'ดาบเพชฌฆาต', 'epic', 't3', { atk: 38, critMult: 0.25, spd: -0.04 },
    { form: 'executioner', blade: '#8a8680', edge: '#d8d4cc', guard: '#3a2a24', grip: '#1c1410', glow: '#e0503a' },
    'ไม่มีปลายแหลม ไม่จำเป็นต้องมี', {
      combo: [
        mv('ตัดสิน', 'overhead', [0.24, 0.14, 0.4, 0.45], 2.1, arc(126, 100), { kb: 360, step: 20, hitStop: 0.08, shake: 6 }),
        mv('ประหาร', 'overhead', [0.3, 0.16, 0.52, 0.75], 3.2, arc(132, 80), { kb: 460, step: 26, stun: 0.6, critBonus: 0.15, hitStop: 0.12, shake: 10 }),
      ],
      charged: mv('ลานประหาร', 'overhead', [0.12, 0.16, 0.5, 0.7], 4.0, circ(170, 70), { kb: 500, stun: 0.9, hitStop: 0.14, shake: 13 }),
      dash: mv('กวาดเพชฌฆาต', 'heavy', [0.06, 0.14, 0.36, 0.6], 2.0, arc(140, 200), { kb: 380, hitStop: 0.08, shake: 6 }),
      branch: mv('คำพิพากษาซ้ำ', 'heavyUp', [0.18, 0.14, 0.44, 0.7], 2.6, arc(136, 170), { kb: 420, forceCrit: true, hitStop: 0.11, shake: 9 }),
    }),
  w_dragonbone_blade: W('w_dragonbone_blade', 'greatsword', 'ดาบกระดูกมังกรแตก', 'legendary', 't5', { atk: 44, hp: 60, def: 4 },
    { form: 'dragonbone', blade: '#e8dcc0', edge: '#fff6e0', guard: '#6a3a24', grip: '#2a1a10', glow: '#ff8a3d' },
    'กระดูกสันหลังมังกรที่ยังมีไฟคุอยู่ข้างใน', {
      combo: [
        mv('สันกระดูก', 'heavy', [0.18, 0.12, 0.32, 0.4], 1.5, arc(128, 170), { kb: 300, step: 20, hitStop: 0.07, shake: 5 }),
        mv('หางมังกร', 'spin', [0.16, 0.16, 0.34, 0.45], 1.6, circ(136), { kb: 320, hitStop: 0.07, shake: 5 }),
        mv('เขี้ยวมังกร', 'heavyUp', [0.16, 0.12, 0.34, 0.45], 1.7, arc(130, 180), { kb: 320, step: 20, burn: true, hitStop: 0.07, shake: 5 }),
        mv('ลมหายใจกระดูก', 'overhead', [0.26, 0.12, 0.5, 0.75], 1.0, proj('bolt', 560, 16, { count: 5, spread: 50, pierce: 2 }), { burn: true, shake: 7 }),
      ],
      charged: mv('มังกรตื่น', 'overhead', [0.12, 0.16, 0.5, 0.7], 3.4, circ(200, 30), { kb: 480, burn: true, stun: 0.7, hitStop: 0.13, shake: 13 }),
      dash: mv('พุ่งกระดูก', 'heavy', [0.05, 0.16, 0.34, 0.6], 1.9, rush(200, 70), { kb: 320 }),
      branch: mv('ไฟในกระดูก', 'heavyUp', [0.16, 0.12, 0.44, 0.7], 2.4, circ(150, 60), { kb: 420, burn: true, stun: 0.6, hitStop: 0.11, shake: 10 }),
    }),
  w_obsidian_cleaver: W('w_obsidian_cleaver', 'greatsword', 'ดาบหินภูเขาไฟดำ', 'legendary', 't6', { atk: 52, crit: 0.06, critMult: 0.3 },
    { form: 'obsidian', blade: '#2a2430', edge: '#ff5a3a', guard: '#5a4a6a', grip: '#14101c', glow: '#ff5a3a' },
    'แตกเป็นรอยลาวาทุกครั้งที่ฟัน แล้วประสานกลับเหมือนเดิม', {
      combo: [
        mv('ผ่าลาวา', 'overhead', [0.2, 0.12, 0.38, 0.45], 1.9, circ(110, 70), { kb: 340, burn: true, step: 18, hitStop: 0.08, shake: 7 }),
        mv('แตกเป็นแนว', 'heavy', [0.18, 0.12, 0.34, 0.45], 1.2, proj('bigArrow', 820, 14, { pierce: 99 }), { burn: true, shake: 4 }),
        mv('ภูเขาไฟปะทุ', 'overhead', [0.28, 0.14, 0.5, 0.75], 2.8, zone(150, 0.4, 300), { kb: 420, stun: 0.6, shake: 11 }),
      ],
      charged: mv('แผ่นดินแยกลาวา', 'overhead', [0.12, 0.08, 0.5, 0.7], 1.3, proj('bigArrow', 700, 18, { count: 3, spread: 40, pierce: 99 }), { burn: true, shake: 10 }),
      dash: mv('ไถลาวา', 'heavy', [0.06, 0.16, 0.36, 0.6], 1.8, rush(180, 70), { kb: 280, burn: true }),
      branch: mv('หินเดือด', 'spin', [0.12, 0.18, 0.4, 0.7], 2.2, circ(150), { kb: 380, burn: true, hitStop: 0.1, shake: 8 }),
    }),
  w_tidebreaker: W('w_tidebreaker', 'greatsword', 'ดาบผ่ากระแสน้ำ', 'epic', 't2', { atk: 30, hp: 40 },
    { form: 'tidebreaker', blade: '#5f9fc8', edge: '#e8f8ff', guard: '#2a4a6a', grip: '#14202a', glow: '#7fe8ff' },
    'ฟาดลงผืนน้ำแล้วคลื่นแยกเป็นสองฝั่ง', {
      combo: [
        mv('คลื่นเข้า', 'heavy', [0.2, 0.12, 0.32, 0.4], 1.5, arc(132, 190), { kb: -260, step: 18, hitStop: 0.07, shake: 5 }),
        mv('คลื่นซัด', 'heavyUp', [0.18, 0.12, 0.34, 0.45], 1.7, arc(132, 190), { kb: 420, step: 18, hitStop: 0.07, shake: 5 }),
        mv('น้ำวน', 'spin', [0.2, 0.2, 0.44, 0.75], 1.0, circ(150), { multi: 2, kb: -200, slow: 0.6, hitStop: 0.09, shake: 7 }),
      ],
      charged: mv('สึนามิ', 'heavy', [0.1, 0.1, 0.5, 0.7], 2.6, proj('bigArrow', 600, 26, { pierce: 99 }), { kb: 480, stun: 0.5, shake: 9 }),
      dash: mv('ทวนกระแส', 'heavy', [0.06, 0.16, 0.36, 0.6], 1.7, rush(200, 74), { kb: -160, slow: 0.6 }),
      branch: mv('คลื่นยักษ์ซ้อน', 'overhead', [0.22, 0.14, 0.48, 0.75], 2.6, circ(170, 60), { kb: 460, slow: 0.5, stun: 0.6, hitStop: 0.11, shake: 10 }),
    }),
  // ---------------------------------------------------------------- staves
  w_crescent_staff: W('w_crescent_staff', 'staff', 'คทาจันทร์เสี้ยว', 'rare', 't2', { atk: 23, crit: 0.06, hp: 20 },
    { form: 'crescentstaff', wood: '#3a3a5a', trim: '#cfd6e6', orb: '#9fb8ff', glow: '#9fb8ff' },
    'เสี้ยวจันทร์อุ้มดวงแก้วไว้ แสงของมันวกกลับหาศัตรูเสมอ', {
      combo: [
        mv('เสี้ยวแสง', 'cast', [0.09, 0.04, 0.2, 0.4], 0.6, proj('bolt', 560, 9, { count: 2, spread: 24, homing: 3.5 }), {}),
        mv('เสี้ยวแสงคู่', 'cast', [0.09, 0.04, 0.2, 0.4], 0.6, proj('bolt', 560, 9, { count: 2, spread: 24, homing: 3.5 }), {}),
        mv('จันทร์ครึ่งดวง', 'castBig', [0.14, 0.05, 0.36, 0.7], 1.1, proj('bolt', 480, 14, { count: 5, spread: 140, homing: 2, pierce: 1 }), { slow: 0.7 }),
      ],
      charged: mv('จันทราคราส', 'castBig', [0.08, 0.04, 0.42, 0.6], 2.6, zone(150, 0.7, 420), { kb: 200, slow: 0.4, stun: 0.8, shake: 7 }),
      dash: mv('วาร์ปจันทร์', 'cast', [0.03, 0.04, 0.26, 0.5], 0.9, circ(110), { kb: 220, slow: 0.6 }),
      branch: mv('วงจันทร์', 'castBig', [0.12, 0.05, 0.36, 0.6], 0.55, proj('bolt', 380, 10, { count: 12, spread: 330, homing: 1 }), {}),
    }),
  w_serpent_staff: W('w_serpent_staff', 'staff', 'คทาภุชงค์คาบแก้ว', 'legendary', 't6', { atk: 46, crit: 0.08, critMult: 0.25 },
    { form: 'serpentstaff', wood: '#2a4a3a', trim: '#7fae3a', orb: '#e8ff9a', glow: '#a8d070' },
    'งูบนคทาไม่ได้ตาย มันแค่รอให้เจ้าของสั่ง', {
      combo: [
        mv('พิษพ่น', 'cast', [0.08, 0.04, 0.18, 0.4], 0.75, proj('bolt', 620, 10, { homing: 4 }), { burn: true }),
        mv('เขี้ยวพิษ', 'cast', [0.08, 0.04, 0.18, 0.4], 0.75, proj('bolt', 620, 10, { homing: 4 }), { burn: true }),
        mv('งูฉก', 'castBig', [0.06, 0.08, 0.24, 0.45], 1.3, rush(170, 40), { burn: true, kb: 160 }),
        mv('บึงพิษ', 'castBig', [0.16, 0.06, 0.4, 0.7], 1.8, zone(130, 0.35, 380), { burn: true, slow: 0.6, kb: 80, shake: 5 }),
      ],
      charged: mv('ภุชงค์เก้าเศียร', 'castBig', [0.08, 0.04, 0.42, 0.6], 0.75, proj('bolt', 520, 11, { count: 9, spread: 80, homing: 3 }), { burn: true, shake: 5 }),
      dash: mv('เลื้อยหนี', 'cast', [0.03, 0.04, 0.26, 0.5], 0.8, proj('bolt', 640, 9, { count: 3, spread: 50, homing: 3 }), { burn: true, hop: 70 }),
      branch: mv('รัดพิษ', 'castBig', [0.12, 0.08, 0.36, 0.6], 1.6, circ(130), { kb: -260, burn: true, stun: 0.5, hitStop: 0.06 }),
    }),
  w_rootheart_staff: W('w_rootheart_staff', 'staff', 'คทารากหัวใจป่า', 'epic', 't3', { atk: 32, hp: 70, def: 4 },
    { form: 'rootstaff', wood: '#5a3a24', trim: '#6aa25a', orb: '#9fffd8', glow: '#8fd06a' },
    'รากไม้โอบหัวใจป่าไว้ ร่ายเวทแล้วรากจะแทงขึ้นจากพื้น', {
      combo: [
        mv('รากแทง', 'cast', [0.1, 0.05, 0.2, 0.4], 0.95, zone(60, 0.2, 340), { kb: 120, stun: 0.2 }),
        mv('รากแทงซ้ำ', 'cast', [0.1, 0.05, 0.2, 0.4], 0.95, zone(60, 0.2, 340), { kb: 120, stun: 0.2 }),
        mv('ป่าพัน', 'castBig', [0.16, 0.06, 0.38, 0.7], 1.5, circ(160), { kb: -180, slow: 0.5, hitStop: 0.06, shake: 4 }),
      ],
      charged: mv('ต้นไม้โลก', 'castBig', [0.08, 0.06, 0.42, 0.6], 3.0, zone(180, 0.6, 400), { kb: 360, stun: 1.0, shake: 9 }),
      dash: mv('ใบไม้ปลิว', 'cast', [0.03, 0.04, 0.26, 0.5], 0.6, proj('feather', 700, 8, { count: 5, spread: 60, homing: 2 }), {}),
      branch: mv('รากสามแนว', 'castBig', [0.12, 0.05, 0.36, 0.6], 1.1, proj('bigArrow', 560, 14, { count: 3, spread: 50, pierce: 99 }), { stun: 0.3 }),
    }),
  w_soul_eye_staff: W('w_soul_eye_staff', 'staff', 'คทาเนตรพันวิญญาณ', 'mythic', 't9', { atk: 60, crit: 0.12, critMult: 0.35, hp: 60 },
    { form: 'eyestaff', wood: '#1a1428', trim: '#c27ff0', orb: '#ff5a7a', glow: '#c27ff0' },
    'ดวงตาที่ทศพักตร์มารควักออกมาเอง เห็นทุกที่ที่วิญญาณซ่อน', {
      combo: [
        mv('จ้องมอง', 'cast', [0.07, 0.04, 0.16, 0.38], 0.8, proj('bolt', 720, 10, { homing: 5, pierce: 1 }), { mark: 0.1 }),
        mv('จ้องมองซ้ำ', 'cast', [0.07, 0.04, 0.16, 0.38], 0.8, proj('bolt', 720, 10, { homing: 5, pierce: 1 }), { mark: 0.1 }),
        mv('สามเนตร', 'cast', [0.08, 0.04, 0.2, 0.4], 0.7, proj('bolt', 680, 10, { count: 3, spread: 40, homing: 4 }), { mark: 0.1 }),
        mv('ลืมตาขุมนรก', 'castBig', [0.14, 0.08, 0.38, 0.7], 2.2, circ(170), { kb: 340, stun: 0.6, mark: 0.2, hitStop: 0.08, shake: 7 }),
      ],
      charged: mv('พันเนตรลืมตา', 'castBig', [0.08, 0.04, 0.44, 0.6], 0.5, proj('bolt', 420, 10, { count: 16, spread: 345, homing: 4 }), { mark: 0.15, shake: 6 }),
      dash: mv('เนตรหลบ', 'cast', [0.03, 0.04, 0.24, 0.5], 1.6, zone(110, 0.3, 360), { kb: 260, stun: 0.4 }),
      branch: mv('ตาเดียวเพ่ง', 'castBig', [0.14, 0.06, 0.36, 0.6], 3.0, proj('bigArrow', 1400, 14, { pierce: 99 }), { forceCrit: true, shake: 6 }),
    }),
  // ---------------------------------------------------------------- bows
  w_featherwing_bow: W('w_featherwing_bow', 'bow', 'ธนูปีกขนนก', 'rare', 't1', { atk: 20, crit: 0.08, spd: 0.05 },
    { form: 'featherbow', wood: '#d8c8a0', trim: '#f4f6ff', string: '#ffffff', glow: '#d8e8ff' },
    'ลูกศรจากธนูนี้เลี้ยวตามลมได้', {
      combo: [
        mv('ศรลม', 'shoot', [0.07, 0.03, 0.18, 0.4], 0.75, proj('arrow', 900, 7, { homing: 2.5 }), {}),
        mv('ศรลมคู่', 'shoot', [0.08, 0.03, 0.2, 0.4], 0.55, proj('arrow', 900, 7, { count: 2, spread: 8, homing: 2.5 }), {}),
        mv('ศรลมสาม', 'shoot', [0.08, 0.03, 0.2, 0.4], 0.5, proj('arrow', 900, 7, { count: 3, spread: 14, homing: 2.5 }), {}),
        mv('ขนนกพายุ', 'shoot', [0.14, 0.03, 0.34, 0.7], 0.42, proj('feather', 760, 8, { count: 8, spread: 90, homing: 3 }), {}),
      ],
      charged: mv('ศรเหยี่ยว', 'shoot', [0.04, 0.04, 0.36, 0.6], 2.4, proj('bigArrow', 1100, 12, { pierce: 3, homing: 3 }), { critBonus: 0.2, shake: 4 }),
      dash: mv('ศรกลางอากาศ', 'shoot', [0.03, 0.03, 0.24, 0.5], 0.7, proj('arrow', 960, 7, { count: 3, spread: 30, homing: 2 }), { hop: 120 }),
      branch: mv('ลมหมุนศร', 'shoot', [0.1, 0.04, 0.32, 0.6], 0.5, proj('arrow', 820, 7, { count: 10, spread: 340, homing: 2 }), {}),
    }),
  w_vertebra_bow: W('w_vertebra_bow', 'bow', 'ธนูกระดูกสันหลัง', 'epic', 't5', { atk: 36, critMult: 0.3 },
    { form: 'bonebow', wood: '#e8dcc0', trim: '#8e2c21', string: '#c2412f', glow: '#e0503a' },
    'ทำจากกระดูกเหยื่อของกาฬโลหิต สายธนูเป็นเส้นเลือดที่ยังเต้น', {
      combo: [
        mv('ศรกระดูก', 'shoot', [0.09, 0.03, 0.22, 0.4], 1.0, proj('arrow', 1000, 8, { pierce: 1 }), { mark: 0.08 }),
        mv('ศรกระดูกซ้ำ', 'shoot', [0.09, 0.03, 0.22, 0.4], 1.0, proj('arrow', 1000, 8, { pierce: 1 }), { mark: 0.08 }),
        mv('ศรหัก', 'shoot', [0.16, 0.03, 0.36, 0.7], 0.9, proj('arrow', 900, 8, { count: 2, spread: 4, pierce: 2 }), { stun: 0.4, mark: 0.12 }),
      ],
      charged: mv('ศรกระดูกสันหลัง', 'shoot', [0.05, 0.04, 0.4, 0.6], 3.4, proj('bigArrow', 1400, 14, { pierce: 99 }), { stun: 0.5, mark: 0.2, shake: 6 }),
      dash: mv('ยิงกระดูกถอย', 'shoot', [0.03, 0.03, 0.24, 0.5], 1.2, proj('arrow', 980, 8, { pierce: 2 }), { hop: 110, mark: 0.1 }),
      branch: mv('ฝนกระดูก', 'shoot', [0.12, 0.04, 0.4, 0.6], 1.6, zone(120, 0.5, 520), { kb: 200, mark: 0.15, shake: 5 }),
    }),
  w_storm_longbow: W('w_storm_longbow', 'bow', 'ธนูยาวพายุฟ้าคำราม', 'legendary', 't7', { atk: 49, crit: 0.12, spd: 0.04 },
    { form: 'stormbow', wood: '#5a6a80', trim: '#ffe65a', string: '#fff9c4', glow: '#ffe65a' },
    'สายธนูทำจากสายฟ้า ปล่อยมือทีไรฟ้าร้องตามมา', {
      combo: [
        mv('ศรฟ้าแลบ', 'shoot', [0.06, 0.03, 0.16, 0.38], 0.7, proj('arrow', 1200, 7, { pierce: 2 }), { stun: 0.15 }),
        mv('ศรฟ้าแลบซ้ำ', 'shoot', [0.06, 0.03, 0.16, 0.38], 0.7, proj('arrow', 1200, 7, { pierce: 2 }), { stun: 0.15 }),
        mv('ศรฟ้าแลบสาม', 'shoot', [0.06, 0.03, 0.16, 0.38], 0.7, proj('arrow', 1200, 7, { pierce: 2 }), { stun: 0.15 }),
        mv('ฟ้าผ่า', 'shoot', [0.16, 0.04, 0.36, 0.7], 2.0, zone(100, 0.25, 520), { stun: 0.7, kb: 200, shake: 6 }),
      ],
      charged: mv('พายุคำราม', 'shoot', [0.05, 0.04, 0.4, 0.6], 0.9, proj('bigArrow', 1200, 11, { count: 5, spread: 36, pierce: 99 }), { stun: 0.4, shake: 7 }),
      dash: mv('สายฟ้าถอย', 'shoot', [0.03, 0.03, 0.24, 0.5], 1.0, proj('arrow', 1100, 7, { count: 3, spread: 16, pierce: 1 }), { hop: 100, stun: 0.2 }),
      branch: mv('ฟ้าลั่นสามครั้ง', 'shoot', [0.12, 0.04, 0.36, 0.6], 1.1, zone(150, 0.4, 520), { multi: 2, stun: 0.6, shake: 7 }),
    }),
  // ---------------------------------------------------------------- spears
  w_abyss_trident: W('w_abyss_trident', 'spear', 'ตรีศูลห้วงสมุทร', 'epic', 't4', { atk: 34, hp: 30, crit: 0.06 },
    { form: 'trident', shaft: '#2a4a5a', head: '#7fe8ff', edge: '#ffffff', trim: '#3a7aa8', glow: '#7fe8ff' },
    'สามง่ามจากใต้แม่น้ำวิญญาณ แทงทีเดียวได้สามแผล', {
      combo: [
        mv('สามง่าม', 'thrust', [0.08, 0.07, 0.2, 0.35], 0.42, arc(150, 40), { multi: 3, kb: 120, step: 20 }),
        mv('สามง่ามซ้ำ', 'thrust', [0.08, 0.07, 0.2, 0.35], 0.42, arc(150, 40), { multi: 3, kb: 120, step: 20 }),
        mv('ดึงสมุทร', 'heavy', [0.12, 0.1, 0.3, 0.7], 1.3, arc(160, 160), { kb: -320, slow: 0.6, hitStop: 0.06, shake: 4 }),
      ],
      charged: mv('ตรีศูลพุ่ง', 'throw', [0.05, 0.05, 0.36, 0.6], 2.6, proj('bigArrow', 1000, 16, { pierce: 99 }), { slow: 0.5, shake: 6 }),
      dash: mv('คลื่นทะลวง', 'thrust', [0.04, 0.14, 0.3, 0.5], 1.9, rush(220, 50), { kb: 280, slow: 0.6 }),
      branch: mv('วังวนสมุทร', 'spin', [0.12, 0.16, 0.32, 0.6], 1.6, circ(160), { kb: -280, slow: 0.5, hitStop: 0.07, shake: 5 }),
    }),
  w_war_halberd: W('w_war_halberd', 'spear', 'ง้าวศึกโซ่ตรวน', 'rare', 't2', { atk: 26, def: 3 },
    { form: 'halberd', shaft: '#3a2a20', head: '#9aa0a8', edge: '#e8eef4', trim: '#5a4a40', glow: '#c8d0dc' },
    'ครึ่งหอกครึ่งขวาน ใช้ทั้งแทงและสับ', {
      combo: [
        mv('แทงง้าว', 'thrust', [0.08, 0.07, 0.2, 0.35], 1.0, arc(156, 36), { kb: 200, step: 18 }),
        mv('สับง้าว', 'overhead', [0.14, 0.1, 0.3, 0.4], 1.6, arc(140, 70), { kb: 300, step: 16, stun: 0.3, hitStop: 0.07, shake: 5 }),
        mv('ตะของ้าว', 'heavy', [0.1, 0.1, 0.24, 0.4], 0.9, arc(150, 140), { kb: -280, step: 10 }),
        mv('กวาดง้าว', 'spin', [0.14, 0.14, 0.36, 0.7], 1.6, circ(150), { kb: 320, hitStop: 0.07, shake: 5 }),
      ],
      charged: mv('ง้าวผ่าแผ่นดิน', 'overhead', [0.08, 0.14, 0.4, 0.7], 3.0, circ(130, 110), { kb: 420, stun: 0.7, hitStop: 0.1, shake: 9 }),
      dash: mv('กระโดดสับ', 'overhead', [0.06, 0.1, 0.3, 0.5], 2.1, circ(100, 80), { kb: 300, step: 120, stun: 0.4, shake: 6 }),
      branch: mv('ง้าวสองจังหวะ', 'heavyUp', [0.1, 0.12, 0.34, 0.6], 1.2, arc(160, 150), { multi: 2, kb: 260, hitStop: 0.07, shake: 5 }),
    }),
  w_serpent_glaive: W('w_serpent_glaive', 'spear', 'ง้าวภุชงค์เลื้อย', 'legendary', 't8', { atk: 51, crit: 0.1, spd: 0.04 },
    { form: 'serpentglaive', shaft: '#1a3a2a', head: '#a8d070', edge: '#e8ff9a', trim: '#e0b45a', glow: '#a8d070' },
    'ใบมีดโค้งเลื้อยเหมือนงู ฟันแล้วพิษไหลตามรอย', {
      combo: [
        mv('งูเลื้อยซ้าย', 'slash', [0.07, 0.07, 0.18, 0.35], 0.9, arc(150, 120), { kb: 120, step: 16, burn: true }),
        mv('งูเลื้อยขวา', 'slashUp', [0.07, 0.07, 0.18, 0.35], 0.9, arc(150, 120), { kb: 120, step: 16, burn: true }),
        mv('งูฉกตรง', 'thrust', [0.06, 0.08, 0.2, 0.35], 1.1, arc(176, 30), { kb: 220, step: 30 }),
        mv('งูขดวง', 'spin', [0.12, 0.16, 0.34, 0.7], 1.7, circ(160), { kb: 280, burn: true, hitStop: 0.07, shake: 5 }),
      ],
      charged: mv('ภุชงค์ทะยาน', 'thrust', [0.04, 0.18, 0.34, 0.6], 2.8, rush(260, 56), { kb: 280, burn: true, hitStop: 0.08, shake: 6 }),
      dash: mv('ฉกจากเงา', 'thrust', [0.02, 0.08, 0.26, 0.5], 1.9, arc(150, 40), { teleport: 'behind', burn: true, forceCrit: true, kb: 160 }),
      branch: mv('เขี้ยวคู่ภุชงค์', 'slash', [0.08, 0.1, 0.3, 0.6], 1.0, arc(164, 160), { multi: 2, burn: true, kb: 200, hitStop: 0.07 }),
    }),
  // ---------------------------------------------------------------- scythes
  w_twin_moon_scythe: W('w_twin_moon_scythe', 'scythe', 'เคียวจันทร์คู่', 'epic', 't3', { atk: 35, crit: 0.08, spd: 0.03 },
    { form: 'twinscythe', shaft: '#2a2438', blade: '#d8d0ff', edge: '#ffffff', trim: '#9f7fff', glow: '#b8a0ff' },
    'ใบเคียวสองด้าน หมุนครั้งเดียวเกี่ยวได้ทั้งหน้าและหลัง', {
      combo: [
        mv('เกี่ยวหน้า', 'heavy', [0.1, 0.1, 0.22, 0.36], 1.1, arc(140, 200), { kb: -140, step: 16, hitStop: 0.05 }),
        mv('เกี่ยวหลัง', 'spin', [0.1, 0.12, 0.24, 0.38], 1.1, circ(140), { kb: 160, hitStop: 0.05 }),
        mv('เกี่ยวหน้า', 'heavyUp', [0.1, 0.1, 0.22, 0.36], 1.15, arc(140, 200), { kb: -140, step: 16, hitStop: 0.05 }),
        mv('จันทร์คู่หมุน', 'spin', [0.12, 0.18, 0.36, 0.7], 0.85, circ(160), { multi: 3, kb: 220, hitStop: 0.08, shake: 6 }),
      ],
      charged: mv('คืนจันทร์คู่', 'spin', [0.06, 0.24, 0.4, 0.65], 1.5, circ(210), { multi: 2, kb: -260, stun: 0.5, hitStop: 0.1, shake: 9 }),
      dash: mv('เคียวพุ่งคู่', 'heavy', [0.04, 0.14, 0.3, 0.55], 1.7, rush(200, 70), { kb: 200, critBonus: 0.15 }),
      branch: mv('จันทร์ผ่า', 'overhead', [0.14, 0.12, 0.4, 0.65], 2.1, proj('bigArrow', 700, 22, { count: 2, spread: 180, pierce: 99 }), { shake: 6 }),
    }),
  w_ribcage_reaper: W('w_ribcage_reaper', 'scythe', 'เคียวซี่โครงยมทัณฑ์', 'legendary', 't5', { atk: 46, hp: 50, critMult: 0.2 },
    { form: 'ribscythe', shaft: '#3a2a20', blade: '#e8dcc0', edge: '#fff6e0', trim: '#5a2a24', glow: '#9fffd8' },
    'ทำจากซี่โครงของผู้ที่ตาชั่งยมทัณฑ์ตัดสินว่าหนักเกินไป', {
      combo: [
        mv('ชั่งวิญญาณ', 'heavy', [0.12, 0.1, 0.26, 0.38], 1.2, arc(146, 200), { kb: -180, step: 18, hitStop: 0.05, shake: 3 }),
        mv('ซี่โครงหนีบ', 'heavyUp', [0.11, 0.12, 0.26, 0.38], 1.3, arc(146, 200), { kb: -220, stun: 0.3, hitStop: 0.05, shake: 3 }),
        mv('ดึงวิญญาณออก', 'overhead', [0.16, 0.1, 0.4, 0.7], 2.2, arc(156, 120), { kb: -340, mark: 0.2, hitStop: 0.08, shake: 6 }),
      ],
      charged: mv('ตาชั่งพลิก', 'spin', [0.06, 0.2, 0.4, 0.65], 3.0, circ(196), { kb: -300, stun: 0.6, mark: 0.2, hitStop: 0.1, shake: 9 }),
      dash: mv('วิญญาณหลุด', 'heavy', [0.03, 0.08, 0.3, 0.55], 1.9, arc(140, 160), { teleport: 'behind', kb: -200, forceCrit: true }),
      branch: mv('ยมทัณฑ์', 'overhead', [0.14, 0.12, 0.4, 0.65], 1.8, zone(140, 0.45, 340), { kb: -300, stun: 0.8, mark: 0.25, shake: 8 }),
    }),
  w_sakura_scythe: W('w_sakura_scythe', 'scythe', 'เคียวซากุระร่วง', 'rare', 't2', { atk: 25, crit: 0.08 },
    { form: 'sakurascythe', shaft: '#5a2a24', blade: '#ffd0e0', edge: '#ffffff', trim: '#ff7aa8', glow: '#ffb0d0' },
    'ทุกครั้งที่เกี่ยว กลีบซากุระจะปลิวตามแรงลม', {
      combo: [
        mv('ลมกลีบ', 'heavy', [0.1, 0.1, 0.24, 0.36], 1.0, arc(138, 200), { kb: -120, step: 16 }),
        mv('กลีบปลิว', 'heavyUp', [0.1, 0.1, 0.24, 0.36], 0.6, proj('feather', 720, 9, { count: 5, spread: 70, homing: 2 }), {}),
        mv('ร่วงทั้งต้น', 'spin', [0.12, 0.16, 0.34, 0.7], 1.8, circ(150), { kb: 260, hitStop: 0.07, shake: 5 }),
      ],
      charged: mv('พายุซากุระ', 'spin', [0.06, 0.2, 0.4, 0.65], 0.55, circ(190), { multi: 5, kb: -100, hitStop: 0.1, shake: 7 }),
      dash: mv('กลีบไล่ลม', 'heavy', [0.04, 0.14, 0.3, 0.55], 1.6, rush(190, 60), { kb: 180 }),
      branch: mv('ฝนกลีบ', 'overhead', [0.12, 0.1, 0.38, 0.65], 0.5, proj('feather', 620, 9, { count: 12, spread: 330, homing: 3 }), {}),
    }),
  // ---------------------------------------------------------------- twin blades
  w_jade_leaf_twins: W('w_jade_leaf_twins', 'twinblades', 'ดาบคู่ใบหยก', 'rare', 't1', { atk: 21, crit: 0.08, spd: 0.04 },
    { form: 'leaftwins', blade: '#7fd0a0', edge: '#e8fff0', guard: '#3a6a3a', grip: '#1a2a1a', glow: '#9fffd8' },
    'สองใบหยกที่ร่วงจากต้นเดียวกัน ฟันสลับกันเหมือนใบไม้ต้องลม', {
      combo: [
        mv('ใบซ้าย', 'dslash', [0.04, 0.06, 0.12, 0.3], 0.6, arc(104, 130), { kb: 60, step: 12 }),
        mv('ใบขวา', 'dslashB', [0.04, 0.06, 0.12, 0.3], 0.6, arc(104, 130), { kb: 60, step: 12 }),
        mv('ใบคู่', 'cross', [0.05, 0.06, 0.13, 0.32], 0.7, arc(108, 140), { kb: 80, step: 14 }),
        mv('ใบปลิว', 'dslash', [0.05, 0.05, 0.2, 0.5], 0.4, proj('feather', 780, 8, { count: 4, spread: 40, homing: 2 }), {}),
      ],
      charged: mv('พายุใบหยก', 'twinSpin', [0.04, 0.24, 0.34, 0.6], 0.6, circ(130), { multi: 5, kb: 100, hitStop: 0.08, shake: 5 }),
      dash: mv('ใบไม้ลอยลม', 'cross', [0.02, 0.08, 0.22, 0.5], 1.4, arc(118, 160), { kb: 180, step: 60, critBonus: 0.15 }),
      branch: mv('หยกแตก', 'twinSpin', [0.05, 0.16, 0.3, 0.6], 1.9, circ(120, 10), { kb: 240, slow: 0.6, hitStop: 0.07, shake: 4 }),
    }),
  w_sun_moon_twins: W('w_sun_moon_twins', 'twinblades', 'ดาบคู่สุริยันจันทรา', 'mythic', 't10', { atk: 63, crit: 0.18, critMult: 0.4, spd: 0.06 },
    { form: 'sunmoontwins', blade: '#fff3c4', edge: '#ffffff', guard: '#e0b45a', grip: '#5a2a14', glow: '#ffcf5a',
      off: { blade: '#cfd6ff', edge: '#ffffff', guard: '#9fb8ff', grip: '#1a1e3a', glow: '#9fb8ff' } },
    'กลางวันกับกลางคืนที่มหากาฬขังไว้คนละขุม ได้พบกันอีกครั้งในมือเดียว', {
      combo: [
        mv('ตะวันกรีด', 'dslash', [0.04, 0.06, 0.12, 0.3], 0.7, arc(110, 140), { kb: 70, step: 12, burn: true }),
        mv('จันทร์กรีด', 'dslashB', [0.04, 0.06, 0.12, 0.3], 0.7, arc(110, 140), { kb: 70, step: 12, slow: 0.7 }),
        mv('สุริยคราส', 'cross', [0.05, 0.06, 0.13, 0.32], 0.85, arc(114, 150), { kb: 90, step: 14, burn: true }),
        mv('จันทรคราส', 'cross', [0.05, 0.06, 0.13, 0.32], 0.85, arc(114, 150), { kb: 90, step: 14, slow: 0.6 }),
        mv('ทิวาราตรี', 'twinSpin', [0.07, 0.14, 0.3, 0.65], 1.9, circ(130), { kb: 260, burn: true, hitStop: 0.08, shake: 5 }),
      ],
      charged: mv('ฟ้าสองดวง', 'twinSpin', [0.04, 0.26, 0.34, 0.6], 2.0, rush(280, 60), { multi: 2, kb: 200, critBonus: 0.2, hitStop: 0.1, shake: 8 }),
      dash: mv('รุ่งสางพลบค่ำ', 'cross', [0.02, 0.08, 0.22, 0.5], 1.8, arc(124, 170), { teleport: 'behind', forceCrit: true, kb: 180 }),
      branch: mv('สุริยันจันทราบรรจบ', 'twinSpin', [0.06, 0.16, 0.3, 0.6], 1.3, proj('bolt', 640, 11, { count: 8, spread: 330, homing: 3 }), { burn: true }),
    }),
  w_shadow_fangs: W('w_shadow_fangs', 'twinblades', 'ดาบคู่เขี้ยวเงา', 'legendary', 't7', { atk: 48, crit: 0.16, spd: 0.05 },
    { form: 'shadowtwins', blade: '#2a2438', edge: '#e0b0ff', guard: '#5a4a7a', grip: '#14101c', glow: '#c27ff0' },
    'โค้งเหมือนเขี้ยว ดำเหมือนเงาที่สุญญตาทิ้งไว้', {
      combo: [
        mv('เงากัด', 'dslash', [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv('เงากัดซ้ำ', 'dslashB', [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv('เงาสาม', 'dslash', [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv('เงาสี่', 'dslashB', [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv('เงาห้า', 'cross', [0.04, 0.06, 0.12, 0.3], 0.65, arc(104, 140), { kb: 60, step: 12, critBonus: 0.05 }),
        mv('เงาหก', 'cross', [0.04, 0.06, 0.12, 0.3], 0.65, arc(104, 140), { kb: 60, step: 12, critBonus: 0.05 }),
        mv('เงาเจ็ดกลืนกิน', 'twinSpin', [0.06, 0.14, 0.3, 0.65], 1.7, circ(120), { kb: -200, mark: 0.15, hitStop: 0.07, shake: 4 }),
      ],
      charged: mv('ร้อยเงา', 'twinSpin', [0.04, 0.24, 0.32, 0.6], 0.5, rush(240, 56), { multi: 5, kb: 80, mark: 0.15, hitStop: 0.1, shake: 7 }),
      dash: mv('เงาหลังคอ', 'cross', [0.02, 0.07, 0.22, 0.5], 2.0, arc(110, 150), { teleport: 'behind', forceCrit: true, kb: 120 }),
      branch: mv('เขี้ยวเงาประสาน', 'cross', [0.05, 0.1, 0.28, 0.6], 0.9, arc(120, 170), { multi: 3, kb: 100, critBonus: 0.15, hitStop: 0.08 }),
    }),
});
