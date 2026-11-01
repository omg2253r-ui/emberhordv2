// Companion pets, summoned with Amber Sparks (ประกายอำพัน). One pet follows the hero into dungeons.
// Summon odds: pick a tier by TIER_ODDS, then one pet of that tier uniformly. Every PITY-th summon without an
// epic-or-better pet is guaranteed epic-or-better (the tier is re-picked from epic/legendary by their odds).
// Duplicates add a star (max MAX_STARS, +STAR_BONUS to the pet's numbers per star); past max they refund sparks.
//
// ability kinds (src/battle/pets.js):
//   heal   { every, healPct }                 bolt  { every, power, range }
//   shield { every, shieldPct, duration }     bite  { every, power, mark, markT, range }
//   bless  { every, atkPct, duration }        breath{ every, power, ticks, range, arc }
// passive (src/systems/pets.js → computeStats): magnet, goldMult, skillCd, skillPower, allPct (+ v7: dodgeCd, spd, critPct, defPct, thorns)
// v7: up to PET_TEAM pets follow the hero at once; thirty more pets live in data/pets2.js.
import { PETS_V7 } from './pets2.js';
import { PETS_EGYPT } from './pets3.js';

export const SUMMON_COST = 10;
export const PITY = 10;
export const MAX_STARS = 5;
export const STAR_BONUS = 0.15;
export const DUPLICATE_REFUND = 4;
export const PET_TEAM = 3;
export const TIER_ODDS = Object.freeze({ common: 0.5, rare: 0.32, epic: 0.15, legendary: 0.03 });

const BASE_PETS = {
  firefly: {
    id: 'firefly', name: 'หิ่งห้อยทอง', rarity: 'common', role: 'ฟื้นฟู', sprite: 'pet_firefly', flying: true,
    desc: 'ส่องแสงอุ่นที่ปิดแผลเล็กๆ ให้เจ้านายเป็นระยะ',
    ability: { kind: 'heal', name: 'แสงอุ่น', every: 6, healPct: 0.025 },
    text: (v) => `ทุก ${v.every} วินาที ฟื้นพลังชีวิต ${(v.healPct * 100).toFixed(1)}%`,
  },
  mossmouse: {
    id: 'mossmouse', name: 'หนูมอส', rarity: 'common', role: 'เก็บของ', sprite: 'pet_mossmouse',
    desc: 'ชอบของแวววาว วิ่งเก็บทุกอย่างที่หล่นอยู่บนพื้น',
    ability: { kind: 'passive', name: 'มือไว', magnet: 0.8, goldMult: 0.1 },
    text: (v) => `ระยะดูดของ +${Math.round(v.magnet * 100)}% · ทอง +${Math.round(v.goldMult * 100)}%`,
  },
  owl: {
    id: 'owl', name: 'นกเค้าถ่าน', rarity: 'rare', role: 'ช่วยโจมตี', sprite: 'pet_owl', flying: true,
    desc: 'บินวนเหนือหัวแล้วยิงขนไฟใส่ศัตรูที่ใกล้ที่สุด',
    ability: { kind: 'bolt', name: 'ขนไฟ', every: 1.6, power: 0.55, range: 420 },
    text: (v) => `ทุก ${v.every} วินาที ยิงขนไฟ ×${v.power.toFixed(2)} ใส่ศัตรูใกล้สุด`,
  },
  turtle: {
    id: 'turtle', name: 'เต่าศิลา', rarity: 'rare', role: 'ป้องกัน', sprite: 'pet_turtle',
    desc: 'กระดองหินของมันแบ่งพลังป้องกันให้เจ้านายได้',
    ability: { kind: 'shield', name: 'กระดองแบ่งปัน', every: 12, shieldPct: 0.1, duration: 6 },
    text: (v) => `ทุก ${v.every} วินาที ให้โล่ ${Math.round(v.shieldPct * 100)}% ของพลังชีวิตสูงสุด นาน ${v.duration} วินาที`,
  },
  gecko: {
    id: 'gecko', name: 'กิ้งก่าวายุ', rarity: 'rare', role: 'เสริมสกิล', sprite: 'pet_gecko',
    desc: 'วิ่งเร็วจนลมหมุนตาม ทำให้เจ้านายร่ายสกิลได้ถี่ขึ้น',
    ability: { kind: 'passive', name: 'ลมเร่ง', skillCd: 0.12, perfectRefund: 1 },
    text: (v) => `คูลดาวน์สกิล −${Math.round(v.skillCd * 100)}% · หลบสมบูรณ์ลดคูลดาวน์สกิล ${v.perfectRefund.toFixed(1)} วินาที`,
  },
  fox: {
    id: 'fox', name: 'จิ้งจอกจันทรา', rarity: 'epic', role: 'ช่วยโจมตี', sprite: 'pet_fox',
    desc: 'พุ่งกัดศัตรูแล้วทิ้งรอยจันทร์ ทำให้เป้าหมายรับความเสียหายมากขึ้น',
    ability: { kind: 'bite', name: 'รอยจันทร์', every: 1.3, power: 0.7, mark: 0.15, markT: 3, range: 360 },
    text: (v) => `ทุก ${v.every} วินาที กัด ×${v.power.toFixed(2)} และทำเครื่องหมาย: เป้ารับดาเมจ +${Math.round(v.mark * 100)}% นาน ${v.markT} วินาที`,
  },
  lantern: {
    id: 'lantern', name: 'ภูตตะเกียง', rarity: 'epic', role: 'บัพ', sprite: 'pet_lantern', flying: true,
    desc: 'ดวงไฟเล็กๆ จากโรงตีเหล็กของดาว ปลุกเปลวไฟในอาวุธของเจ้านาย',
    ability: { kind: 'bless', name: 'พรเปลวไฟ', every: 10, atkPct: 0.2, duration: 4, skillPower: 0.15 },
    text: (v) => `ทุก ${v.every} วินาที พลังโจมตี +${Math.round(v.atkPct * 100)}% นาน ${v.duration} วินาที · สกิลแรงขึ้น ${Math.round(v.skillPower * 100)}%`,
  },
  drake: {
    id: 'drake', name: 'มังกรเถ้าทอง', rarity: 'legendary', role: 'ช่วยโจมตี + ค่าสถานะ', sprite: 'pet_drake', flying: true,
    desc: 'มังกรน้อยที่ฟักจากถ่านศักดิ์สิทธิ์ พ่นไฟใส่ศัตรูและแบ่งพลังให้เจ้านาย',
    ability: { kind: 'breath', name: 'ไฟเถ้าทอง', every: 3, power: 0.5, ticks: 3, range: 220, arc: 60, allPct: 0.06 },
    text: (v) => `ทุก ${v.every} วินาที พ่นไฟ ${v.ticks} ครั้ง ×${v.power.toFixed(2)} · พลังโจมตี/ป้องกัน/พลังชีวิต +${Math.round(v.allPct * 100)}%`,
  },
};
export const PETS = Object.freeze({ ...BASE_PETS, ...PETS_V7, ...PETS_EGYPT });

export const PET_IDS = Object.freeze(Object.keys(PETS));

export function getPet(id) {
  return Object.prototype.hasOwnProperty.call(PETS, id) ? PETS[id] : null;
}

// Numeric fields scale with stars; timing fields (every, duration, markT, ticks, range, arc) stay fixed.
const FIXED = new Set(['kind', 'name', 'every', 'duration', 'markT', 'ticks', 'range', 'arc', 'r', 'count', 'jumps', 'len', 'width', 'radius', 'speed', 'hitEvery', 'charges', 'below', 'slowT', 'spread', 'life', 'pull', 'slow', 'stun', 'max', 'burn']);
export function petValues(pet, stars = 1) {
  const m = 1 + STAR_BONUS * (Math.max(1, Math.min(MAX_STARS, stars)) - 1);
  const out = {};
  for (const [k, v] of Object.entries(pet.ability)) out[k] = FIXED.has(k) || typeof v !== 'number' ? v : Math.round(v * m * 1000) / 1000;
  return out;
}

// Exact chance of each pet on a normal (non-pity) summon.
export function petOdds() {
  const out = {};
  for (const [tier, p] of Object.entries(TIER_ODDS)) {
    const ids = PET_IDS.filter((id) => PETS[id].rarity === tier);
    for (const id of ids) out[id] = p / ids.length;
  }
  return out;
}
