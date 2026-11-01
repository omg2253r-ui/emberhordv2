// Bloodlines (races). Rolled once for free when the hero awakens, re-rolled later with a Bloodstone from bosses.
// weight = chance out of 100. stats are fractions (hpPct 0.1 = +10% max HP) or flat crit/critMult/spd.
// skill = race active skill (key R), numbers used by src/battle/raceSkills.js.
// ability = always-on special, consumed by systems/stats.js (raceAbility) and the dungeon scene.
// look = how the hero's head is drawn (skin, hair, eyes and a trait: ears | horns | scales | leaves | marks).

import { RACES_V7 } from './races2.js';

const BASE_RACES = {
  hunter: {
    id: 'hunter', name: 'ชาวพราน', rarity: 'common', weight: 32, color: '#d9a84e',
    desc: 'ลูกหลานนักล่าแห่งป่าอำพัน ไม่โดดเด่นด้านใด แต่ไม่มีจุดอ่อน',
    lore: 'ก่อนป่าจะถูกเรียกว่าป่าหนาม ชาวพรานเดินตามรอยสัตว์ได้แม้ในคืนไร้จันทร์',
    stats: { hpPct: 0.08, atkPct: 0.05 },
    skill: { id: 'focus', name: 'สมาธินักล่า', icon: 'eye', cooldown: 18, duration: 5, haste: 0.3, crit: 0.25,
             desc: '5 วินาที: ท่าโจมตีเร็วขึ้น 30% และโอกาสคริติคอล +25%' },
    ability: { name: 'ตานักเก็บ', desc: 'ทองจากศัตรูและหีบ +20%', goldMult: 0.2 },
    look: { skin: '#f0d2ac', shade: '#d9a982', hair: '#3b2a24', eye: '#1a120e', trait: 'none' },
  },
  moon: {
    id: 'moon', name: 'เงาจันทร์', rarity: 'uncommon', weight: 22, color: '#9fb8ff',
    desc: 'เผ่าหูแหลมผู้เคลื่อนไหวไร้เสียง เก่งเรื่องการหลบและการโจมตีจากเงา',
    lore: 'คนเงาจันทร์เชื่อว่าเงาของตัวเองคือพี่น้องที่เกิดก่อนหนึ่งลมหายใจ',
    stats: { spd: 0.08, crit: 0.06 },
    skill: { id: 'shadow_step', name: 'ก้าวเงา', icon: 'lunge', cooldown: 10, power: 2.2, reach: 380,
             desc: 'วาร์ปไปข้างหลังศัตรูที่ใกล้ที่สุดแล้วฟันคริติคอลแน่นอน ×2.2 พร้อมอมตะชั่วครู่' },
    ability: { name: 'ฝีเท้าแมว', desc: 'ชาร์จหลบฟื้นเร็วขึ้น 25% และช่วงหลบสมบูรณ์กว้างขึ้น', dodgeCd: 0.25, perfectBonus: 0.06 },
    look: { skin: '#eadfd4', shade: '#c9b8b0', hair: '#cfd6e6', eye: '#4a7fd8', trait: 'ears' },
  },
  stone: {
    id: 'stone', name: 'ศิลาเขา', rarity: 'uncommon', weight: 18, color: '#b8a48a',
    desc: 'ร่างใหญ่ มีเขาหินงอกจากหน้าผาก ทนทานที่สุดในบรรดาสายเลือดทั้งหมด',
    lore: 'คนศิลาเขาเคยขุดเหมืองถ่านด้วยมือเปล่า ก่อนที่ใครจะคิดสร้างเตาหลอม',
    stats: { hpPct: 0.15, defPct: 0.2, spd: -0.04 },
    skill: { id: 'stone_skin', name: 'ผิวศิลา', icon: 'hide', cooldown: 20, duration: 5, reduce: 0.6,
             desc: '5 วินาที: รับความเสียหายลดลง 60% และไม่กระเด็นเมื่อโดนโจมตี' },
    ability: { name: 'กระดูกแกร่ง', desc: 'ความเสียหายจากกับดัก −35% · พลังชีวิตต่ำกว่า 30% ป้องกัน +50%', trapReduce: 0.35, lowHpDef: 0.5 },
    look: { skin: '#cdb9a0', shade: '#a8937c', hair: '#5a4a40', eye: '#e0b45a', trait: 'horns' },
  },
  sylvan: {
    id: 'sylvan', name: 'พงไพร', rarity: 'rare', weight: 14, color: '#8fd06a',
    desc: 'มีใบไม้งอกแทนเส้นผม ร่างกายฟื้นตัวเองได้ตลอดเวลาเหมือนต้นไม้',
    lore: 'พงไพรหลับยาวในฤดูแล้ง และตื่นขึ้นพร้อมฝนแรกเสมอ',
    stats: { hpPct: 0.1, spd: 0.04 },
    skill: { id: 'bloom', name: 'ดอกไม้ชุบชีวิต', icon: 'blood', cooldown: 22, duration: 4, heal: 0.3, radius: 170, slow: 0.5,
             desc: 'ฟื้นพลังชีวิต 30% ภายใน 4 วินาที และทำให้ศัตรูรอบตัวช้าลง 50%' },
    ability: { name: 'รากชีวิต', desc: 'ฟื้นพลังชีวิต 0.5% ต่อวินาทีตลอดเวลา', regen: 0.005 },
    look: { skin: '#e8ddb6', shade: '#c6b88c', hair: '#5d8a3e', eye: '#2f6a2a', trait: 'leaves' },
  },
  scale: {
    id: 'scale', name: 'เกล็ดถ่าน', rarity: 'rare', weight: 10, color: '#ff8a3d',
    desc: 'มีเกล็ดสีถ่านแดงบนแก้มและแขน พ่นไฟได้และทนความร้อน',
    lore: 'บางคนว่าเกล็ดถ่านคือลูกหลานของมังกรที่หลับอยู่ใต้เหมือง บางคนว่าเป็นแค่นิทาน',
    stats: { atkPct: 0.1, critMult: 0.2 },
    skill: { id: 'ember_breath', name: 'ลมหายใจถ่าน', icon: 'whirl', cooldown: 12, range: 190, arc: 70, ticks: 6, interval: 0.16, power: 0.45,
             desc: 'พ่นไฟเป็นรูปกรวยด้านหน้า 6 ครั้ง ครั้งละ ×0.45 และติดไฟ' },
    ability: { name: 'เกล็ดทนไฟ', desc: 'ความเสียหายจากไฟ (ลูกไฟ ช่องไฟ) −30% · การโจมตีมีโอกาส 15% ทำให้ติดไฟ', fireReduce: 0.3, ignite: 0.15 },
    look: { skin: '#ecc9a2', shade: '#cfa07a', hair: '#8e2c21', eye: '#ff8a3d', trait: 'scales' },
  },
  ash: {
    id: 'ash', name: 'สายเลือดเถ้า', rarity: 'legendary', weight: 4, color: '#ffd08a',
    desc: 'ลายเถ้าเรืองแสงทั่วร่าง สายเลือดที่หายไปพร้อมคืนเถ้าถล่ม',
    lore: 'ในบันทึกของดาวมีคำหนึ่งที่ถูกขีดฆ่าซ้ำหลายรอบ — "ผู้ไม่มอด"',
    stats: { atkPct: 0.12, hpPct: 0.05, crit: 0.08, critMult: 0.3 },
    skill: { id: 'ash_night', name: 'ราตรีเถ้า', icon: 'ward', cooldown: 24, duration: 6, dmg: 0.25, power: 1.6, radius: 170,
             desc: 'ระเบิดเถ้ารอบตัว ×1.6 แล้ว 6 วินาที: ความเสียหาย +25% และทุกการโจมตีทำให้ติดไฟ' },
    ability: { name: 'ผู้ไม่มอด', desc: 'ครั้งแรกในแต่ละดันเจี้ยนที่จะล้ม จะรอดด้วยพลังชีวิต 1 และอมตะ 1.5 วินาที', lastStand: true },
    look: { skin: '#dcbca4', shade: '#b8957c', hair: '#1c1412', eye: '#ffd08a', trait: 'marks' },
  },
};
// v7: thirty more bloodlines (data/races2.js)
export const RACES = Object.freeze({ ...BASE_RACES, ...RACES_V7 });

export const RACE_IDS = Object.freeze(Object.keys(RACES));
export const REROLL_ITEM = 'm_bloodstone';

export function getRace(id) {
  return Object.prototype.hasOwnProperty.call(RACES, id) ? RACES[id] : null;
}
