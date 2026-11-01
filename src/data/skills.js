// Skill definitions. Each rank's numbers are listed per rank (index 0 = rank 1).
// unlock: { level } or { flag } — flags come from the story (memories the hero gets back); v8 adds { boss }, { tower },
// { zone }, { raid } and { pvp } (see systems/skills.js isUnlocked).
// Actives go into one of SKILL_SLOTS slots and are cast in battle; passives apply automatically.
// rarity: how rare (and how strong at max rank) a skill is — shown as the colour of its frame everywhere.
// v8: actives name a `cast` type (battle/skillCast.js); `cat` and `el` sort and colour them; `art` draws the icon.
// The eight first skills live here; the other 92 are in data/skillbook.js (100 in all).
import { SKILLBOOK } from './skillbook.js';

export const SKILL_SLOTS = 3;
export const SKILL_RESET_COST = 80;

const FIRST = {
  // ---------------------------------------------------------------- actives
  ember_whirl: {
    id: 'ember_whirl', rarity: 'rare', kind: 'active', name: 'วงเพลิง', icon: 'whirl', maxRank: 3, cat: 'area', el: 'fire', art: { m: 'whirl', n: 1 },
    unlock: { level: 2 }, cast: 'nova', opt: { kb: 320, rays: 8 },
    cooldown: [6, 5.5, 5], power: [1.6, 1.9, 2.3], radius: [120, 130, 145],
    desc: (r) => `หมุนตัวฟันรอบทิศ สร้างความเสียหาย ${pctx(r.power)} ของพลังโจมตี ในรัศมี ${r.radius} กระเด็นศัตรูออก`,
    lore: 'ท่าแรกที่พี่ดาวสอน ตอนที่ไฟในเตายังลุกโชน',
  },
  fang_lunge: {
    id: 'fang_lunge', rarity: 'uncommon', kind: 'active', name: 'พุ่งเขี้ยว', icon: 'lunge', maxRank: 3, cat: 'move', el: 'fire', art: { m: 'dash', n: 1 },
    unlock: { level: 4 }, cast: 'dash', opt: {},
    cooldown: [5, 4.5, 4], power: [1.4, 1.7, 2.0], distance: [250, 280, 310],
    desc: (r) => `พุ่งทะลุไปข้างหน้า ${r.distance} หน่วย อมตะระหว่างพุ่ง ทุกตัวที่ผ่านโดน ${pctx(r.power)}`,
    lore: 'ฝีเท้าของนักล่าที่ไม่ยอมหยุดวิ่งตามรอยพี่สาว',
  },
  thorn_snare: {
    id: 'thorn_snare', rarity: 'epic', kind: 'active', name: 'กรงหนาม', icon: 'snare', maxRank: 3, cat: 'ctrl', el: 'nature', art: { m: 'field', n: 2 },
    unlock: { flag: 'mem_thorns' }, cast: 'snare', opt: {},
    cooldown: [9, 8, 7], power: [0.8, 1.0, 1.25], radius: [110, 125, 140], slow: [0.5, 0.45, 0.4], duration: [2.5, 3, 3.5],
    desc: (r) => `เรียกรากหนามรอบศัตรูที่ใกล้ที่สุด ทำความเสียหาย ${pctx(r.power)} และทำให้ช้าลงเหลือ ${Math.round(r.slow * 100)}% นาน ${r.duration} วินาที`,
    lore: 'หนามในป่าเชื่อฟังถ่านครึ่งดวงในตัวเจ้า — ปลดล็อกเมื่อความทรงจำแรกกลับมา',
  },
  hearth_ward: {
    id: 'hearth_ward', rarity: 'legendary', kind: 'active', name: 'โล่ถ่านอุ่น', icon: 'ward', maxRank: 3, cat: 'def', el: 'fire', art: { m: 'shield', n: 1 },
    unlock: { flag: 'mem_ward' }, cast: 'shield', opt: {},
    cooldown: [16, 14, 12], shieldPct: [0.25, 0.35, 0.45], duration: [5, 5, 6],
    desc: (r) => `เกราะไออุ่นดูดซับความเสียหาย ${Math.round(r.shieldPct * 100)}% ของพลังชีวิตสูงสุด นาน ${r.duration} วินาที`,
    lore: 'ไออุ่นจากผ้าพันคอสีแดงที่พี่ถักให้ — ปลดล็อกเมื่ออ่านจดหมายของดาว',
  },
  // ---------------------------------------------------------------- passives
  hawk_eye: {
    id: 'hawk_eye', rarity: 'common', kind: 'passive', name: 'ตาเหยี่ยว', icon: 'eye', maxRank: 3, cat: 'pas', el: 'wind', art: { m: 'pas', n: 30 },
    unlock: { level: 2 }, crit: [0.04, 0.08, 0.12],
    desc: (r) => `โอกาสคริติคอล +${Math.round(r.crit * 100)}%`,
    lore: 'นักล่าเห็นรอยหนามที่ขาดก่อนคนอื่นเสมอ',
  },
  hunter_blood: {
    id: 'hunter_blood', rarity: 'uncommon', kind: 'passive', name: 'เลือดนักล่า', icon: 'blood', maxRank: 3, cat: 'pas', el: 'blood', art: { m: 'pas', n: 31 },
    unlock: { level: 3 }, healOnKill: [0.02, 0.03, 0.04],
    desc: (r) => `ฟื้นพลังชีวิต ${Math.round(r.healOnKill * 100)}% ของสูงสุดทุกครั้งที่กำจัดศัตรู`,
    lore: 'ไฟในตัวเจ้ากินเถ้าของสิ่งที่มันเผา',
  },
  wind_step: {
    id: 'wind_step', rarity: 'rare', kind: 'passive', name: 'ฝีเท้าลม', icon: 'wind', maxRank: 3, cat: 'pas', el: 'wind', art: { m: 'pas', n: 32 },
    unlock: { level: 3 }, dashCd: [0.1, 0.2, 0.3], spd: [0.03, 0.06, 0.09],
    desc: (r) => `คูลดาวน์พุ่งหลบ −${Math.round(r.dashCd * 100)}% ความเร็ว +${Math.round(r.spd * 100)}%`,
    lore: 'ทางเดินในป่าหนามเปลี่ยนทุกคืน คนที่ช้าจะติดอยู่ข้างใน',
  },
  thick_hide: {
    id: 'thick_hide', rarity: 'uncommon', kind: 'passive', name: 'หนังหนา', icon: 'hide', maxRank: 3, cat: 'pas', el: 'earth', art: { m: 'pas', n: 33 },
    unlock: { level: 4 }, hpPct: [0.06, 0.12, 0.18], trapReduce: [0.15, 0.3, 0.45],
    desc: (r) => `พลังชีวิตสูงสุด +${Math.round(r.hpPct * 100)}% ความเสียหายจากกับดัก −${Math.round(r.trapReduce * 100)}%`,
    lore: 'แผลเป็นจากกับดักในดันเจี้ยน สอนให้ระวังมากกว่าคำเตือนใด',
  },
};

export const SKILLS = Object.freeze({ ...FIRST, ...SKILLBOOK });
export const SKILL_IDS = Object.freeze(Object.keys(SKILLS));

// how the skill panel groups them
export const SKILL_CATS = Object.freeze([
  { id: 'all', name: 'ทั้งหมด' },
  { id: 'atk', name: 'โจมตี' },
  { id: 'area', name: 'วงกว้าง' },
  { id: 'move', name: 'เคลื่อนที่' },
  { id: 'ctrl', name: 'ควบคุม' },
  { id: 'def', name: 'ป้องกัน' },
  { id: 'sup', name: 'เสริมพลัง' },
  { id: 'pas', name: 'ติดตัว' },
]);

function pctx(v) { return `${Math.round(v * 100)}%`; }

export function getSkill(id) {
  return Object.prototype.hasOwnProperty.call(SKILLS, id) ? SKILLS[id] : null;
}

// Numbers for a given rank (1-based) as a flat object, e.g. { cooldown: 5.5, power: 1.9, radius: 130 }.
export function rankValues(skill, rank) {
  const out = {};
  const i = Math.max(0, Math.min(skill.maxRank, rank) - 1);
  for (const [k, v] of Object.entries(skill)) if (Array.isArray(v)) out[k] = v[i];
  return out;
}
