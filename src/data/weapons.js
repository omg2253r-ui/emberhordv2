// Weapon types and their movesets. Every weapon item names its type with `wtype`.
//
// A move runs three phases: windup (anticipation, can be dodge-cancelled) → active (the hit happens at its start)
// → recover. Pressing attack during a move buffers the next combo step; it starts once `cancel` of the recover
// has passed. Holding attack after a move charges the `charged` move; attacking during or right after a dodge
// performs the `dash` move.
//
// hit shapes:
//   arc    { range, arc (deg) }                       — melee sweep in front of the hero
//   circle { r, forward }                             — ring centred `forward` px ahead (0 = on the hero)
//   proj   { kind, speed, r, pierce, count, spread, homing } — player projectiles
//   rush   { dist, width }                            — the hero dashes and hits everything passed through
//   zone   { r, delay, reach }                        — delayed blast at the target (up to `reach` px away)
// optional: step (px moved forward), kb, hitStop, shake, critBonus, forceCrit, stun (s), teleport 'behind', hop (px back)

const arc = (range, deg) => ({ shape: 'arc', range, arc: deg });

export const WEAPON_TYPES = Object.freeze({
  sword: {
    id: 'sword', name: 'ดาบ', icon: 'sword', chargeTime: 0.5, moveMult: 0.45, cancelFrom: 'windup', dodge: 'roll',
    trail: { color: '#f3e6c8', glow: '#e0b45a', width: 1 },
    desc: 'สมดุลทุกด้าน คอมโบ 3 จังหวะ ปิดท้ายด้วยฟันหนัก',
    combo: [
      { name: 'ฟันเฉียง', anim: 'slash', windup: 0.07, active: 0.08, recover: 0.2, cancel: 0.35, power: 1, hit: arc(92, 120), kb: 140, step: 16 },
      { name: 'ฟันย้อน', anim: 'slashUp', windup: 0.06, active: 0.08, recover: 0.2, cancel: 0.35, power: 1.05, hit: arc(92, 120), kb: 150, step: 16 },
      { name: 'ฟันผ่า', anim: 'overhead', windup: 0.12, active: 0.1, recover: 0.34, cancel: 0.7, power: 1.7, hit: arc(112, 150), kb: 320, step: 34, hitStop: 0.07, shake: 5 },
    ],
    charged: { name: 'ฟันหมุนวน', anim: 'spin', windup: 0.06, active: 0.16, recover: 0.3, cancel: 0.6, power: 2.4, hit: { shape: 'circle', r: 128, forward: 0 }, kb: 360, hitStop: 0.08, shake: 7 },
    dash: { name: 'ฟันสวน', anim: 'thrust', windup: 0.03, active: 0.1, recover: 0.24, cancel: 0.5, power: 1.6, hit: arc(124, 70), kb: 260, step: 90, hitStop: 0.06 },
  },
  katana: {
    id: 'katana', name: 'ดาบซามูไร', icon: 'katana', chargeTime: 0.55, moveMult: 0.5, cancelFrom: 'windup', dodge: 'roll',
    trail: { color: '#f4f6ff', glow: '#9fb8ff', width: 0.8 },
    desc: 'ฟันเร็ว 4 จังหวะ ชาร์จเพื่อชักดาบพุ่งทะลุแนวศัตรู',
    combo: [
      { name: 'ฟันพริบตา', anim: 'slash', windup: 0.05, active: 0.06, recover: 0.15, cancel: 0.35, power: 0.8, hit: arc(98, 100), kb: 90, step: 14 },
      { name: 'ฟันย้อนแสง', anim: 'slashUp', windup: 0.05, active: 0.06, recover: 0.15, cancel: 0.35, power: 0.85, hit: arc(98, 100), kb: 90, step: 14 },
      { name: 'แทงตรง', anim: 'thrust', windup: 0.05, active: 0.06, recover: 0.16, cancel: 0.35, power: 0.9, hit: arc(118, 50), kb: 120, step: 24 },
      { name: 'จันทร์เสี้ยว', anim: 'overhead', windup: 0.1, active: 0.08, recover: 0.32, cancel: 0.7, power: 1.6, hit: arc(112, 170), kb: 280, step: 20, hitStop: 0.06, shake: 4 },
    ],
    charged: { name: 'ชักดาบสายฟ้า', anim: 'iai', windup: 0.04, active: 0.18, recover: 0.32, cancel: 0.6, power: 2.8, hit: { shape: 'rush', dist: 230, width: 46 }, kb: 200, hitStop: 0.09, shake: 6, critBonus: 0.2 },
    dash: { name: 'สวนดาบ', anim: 'slash', windup: 0.02, active: 0.08, recover: 0.22, cancel: 0.5, power: 1.4, hit: arc(110, 150), kb: 200, step: 40, critBonus: 0.3, hitStop: 0.05 },
  },
  dagger: {
    id: 'dagger', name: 'ดาบเล็กคู่', icon: 'dagger', chargeTime: 0.45, moveMult: 0.7, cancelFrom: 'any', dodge: 'roll', dual: true,
    trail: { color: '#eef0f2', glow: '#c27ff0', width: 0.6 },
    desc: 'แทงรัว 5 จังหวะ หลบยกเลิกท่าได้ทุกเมื่อ หลบแล้วโจมตี = วาร์ปไปแทงข้างหลัง',
    combo: [
      { name: 'แทงซ้าย', anim: 'stab', windup: 0.03, active: 0.05, recover: 0.11, cancel: 0.3, power: 0.55, hit: arc(76, 90), kb: 50, step: 10 },
      { name: 'แทงขวา', anim: 'stabB', windup: 0.03, active: 0.05, recover: 0.11, cancel: 0.3, power: 0.55, hit: arc(76, 90), kb: 50, step: 10 },
      { name: 'กรีดซ้าย', anim: 'stab', windup: 0.03, active: 0.05, recover: 0.11, cancel: 0.3, power: 0.6, hit: arc(78, 100), kb: 50, step: 10 },
      { name: 'กรีดขวา', anim: 'stabB', windup: 0.03, active: 0.05, recover: 0.11, cancel: 0.3, power: 0.6, hit: arc(78, 100), kb: 50, step: 10 },
      { name: 'กากบาท', anim: 'cross', windup: 0.06, active: 0.06, recover: 0.26, cancel: 0.6, power: 1.3, hit: arc(86, 150), kb: 220, step: 18, hitStop: 0.05, shake: 3 },
    ],
    charged: { name: 'พายุมีด', anim: 'throw', windup: 0.05, active: 0.05, recover: 0.3, cancel: 0.6, power: 0.8, hit: { shape: 'proj', kind: 'knife', speed: 760, r: 9, pierce: 0, count: 5, spread: 44 } },
    dash: { name: 'แทงข้างหลัง', anim: 'stab', windup: 0.02, active: 0.06, recover: 0.22, cancel: 0.5, power: 2.2, hit: arc(84, 110), kb: 180, teleport: 'behind', forceCrit: true, hitStop: 0.07, shake: 4 },
  },
  greatsword: {
    id: 'greatsword', name: 'ดาบใหญ่', icon: 'greatsword', chargeTime: 0.6, moveMult: 0.35, cancelFrom: 'recover', dodge: 'roll', armor: true, twoHanded: true,
    trail: { color: '#ffe2b8', glow: '#ff8a3d', width: 1.6 },
    desc: 'ช้าแต่หนัก ไม่สะดุ้งขณะเหวี่ยง จังหวะสามทุบพื้นเป็นวงกว้าง',
    combo: [
      { name: 'เหวี่ยงตัด', anim: 'heavy', windup: 0.2, active: 0.12, recover: 0.34, cancel: 0.4, power: 1.6, hit: arc(124, 170), kb: 300, step: 22, hitStop: 0.07, shake: 5 },
      { name: 'เหวี่ยงย้อน', anim: 'heavyUp', windup: 0.18, active: 0.12, recover: 0.36, cancel: 0.4, power: 1.8, hit: arc(124, 180), kb: 320, step: 22, hitStop: 0.07, shake: 5 },
      { name: 'ทุบปฐพี', anim: 'overhead', windup: 0.3, active: 0.14, recover: 0.52, cancel: 0.75, power: 3, hit: { shape: 'circle', r: 132, forward: 62 }, kb: 420, step: 26, hitStop: 0.11, shake: 10, stun: 0.5 },
    ],
    charged: { name: 'ปฐพีแยก', anim: 'overhead', windup: 0.12, active: 0.16, recover: 0.5, cancel: 0.7, power: 3.6, hit: { shape: 'circle', r: 196, forward: 30 }, kb: 480, hitStop: 0.13, shake: 13, stun: 0.8 },
    dash: { name: 'ฟาดกวาด', anim: 'spin', windup: 0.06, active: 0.14, recover: 0.36, cancel: 0.6, power: 1.8, hit: { shape: 'circle', r: 128, forward: 0 }, kb: 340, hitStop: 0.07, shake: 6 },
  },
  staff: {
    id: 'staff', name: 'คทาเวท', icon: 'staff', chargeTime: 0.7, moveMult: 0.55, cancelFrom: 'windup', dodge: 'blink', ranged: true,
    trail: { color: '#ffd08a', glow: '#ff8a3d', width: 0.9 },
    desc: 'ยิงลูกเวทติดตามเป้า ปิดคอมโบด้วยวงไฟรอบตัว ชาร์จเรียกอุกกาบาต หลบเป็นการวาร์ป',
    combo: [
      { name: 'ประกายไฟ', anim: 'cast', windup: 0.1, active: 0.04, recover: 0.22, cancel: 0.4, power: 0.9, hit: { shape: 'proj', kind: 'bolt', speed: 620, r: 10, pierce: 0, count: 1, spread: 0, homing: 3 } },
      { name: 'ประกายคู่', anim: 'cast', windup: 0.1, active: 0.04, recover: 0.22, cancel: 0.4, power: 0.9, hit: { shape: 'proj', kind: 'bolt', speed: 620, r: 10, pierce: 0, count: 1, spread: 0, homing: 3 } },
      { name: 'วงอัคคี', anim: 'castBig', windup: 0.16, active: 0.06, recover: 0.4, cancel: 0.7, power: 1.8, hit: { shape: 'circle', r: 142, forward: 0 }, kb: 300, hitStop: 0.06, shake: 5 },
    ],
    charged: { name: 'อุกกาบาตถ่าน', anim: 'castBig', windup: 0.08, active: 0.04, recover: 0.42, cancel: 0.6, power: 3.4, hit: { shape: 'zone', r: 122, delay: 0.55, reach: 420 }, kb: 360, shake: 9, stun: 0.6 },
    dash: { name: 'ประกายวาร์ป', anim: 'cast', windup: 0.03, active: 0.04, recover: 0.26, cancel: 0.5, power: 0.75, hit: { shape: 'proj', kind: 'bolt', speed: 680, r: 9, pierce: 0, count: 3, spread: 36, homing: 2.5 } },
  },
  bow: {
    id: 'bow', name: 'ธนู', icon: 'bow', chargeTime: 0.6, moveMult: 0.75, cancelFrom: 'windup', dodge: 'roll', ranged: true,
    trail: { color: '#efe2c4', glow: '#7fc77a', width: 0.5 },
    desc: 'ยิงระยะไกลขณะเคลื่อนที่ได้ ลูกที่สามยิง 3 ดอกทะลุ ชาร์จเป็นลูกศรทะลวง',
    combo: [
      { name: 'ยิงเร็ว', anim: 'shoot', windup: 0.08, active: 0.03, recover: 0.2, cancel: 0.4, power: 0.85, hit: { shape: 'proj', kind: 'arrow', speed: 940, r: 7, pierce: 0, count: 1, spread: 0 } },
      { name: 'ยิงซ้ำ', anim: 'shoot', windup: 0.08, active: 0.03, recover: 0.2, cancel: 0.4, power: 0.85, hit: { shape: 'proj', kind: 'arrow', speed: 940, r: 7, pierce: 0, count: 1, spread: 0 } },
      { name: 'สามศร', anim: 'shoot', windup: 0.14, active: 0.03, recover: 0.34, cancel: 0.7, power: 0.75, hit: { shape: 'proj', kind: 'arrow', speed: 980, r: 7, pierce: 1, count: 3, spread: 16 } },
    ],
    charged: { name: 'ศรทะลวงฟ้า', anim: 'shoot', windup: 0.04, active: 0.04, recover: 0.36, cancel: 0.6, power: 3, hit: { shape: 'proj', kind: 'bigArrow', speed: 1300, r: 12, pierce: 99, count: 1, spread: 0 }, shake: 5, hitStop: 0.04 },
    dash: { name: 'ยิงถอย', anim: 'shoot', windup: 0.03, active: 0.03, recover: 0.24, cancel: 0.5, power: 1, hit: { shape: 'proj', kind: 'arrow', speed: 960, r: 7, pierce: 0, count: 2, spread: 10 }, hop: 90 },
  },
  spear: {
    id: 'spear', name: 'หอก', icon: 'spear', chargeTime: 0.55, moveMult: 0.45, cancelFrom: 'windup', dodge: 'roll', twoHanded: true,
    trail: { color: '#f3e6c8', glow: '#e0503a', width: 0.7 },
    desc: 'แทงไกลที่สุดในบรรดาอาวุธระยะประชิด จังหวะสามกวาดรอบตัว ชาร์จพุ่งทะลวง',
    combo: [
      { name: 'แทงพุ่ง', anim: 'thrust', windup: 0.08, active: 0.07, recover: 0.2, cancel: 0.35, power: 1, hit: arc(152, 36), kb: 200, step: 20 },
      { name: 'แทงซ้ำ', anim: 'thrust', windup: 0.08, active: 0.07, recover: 0.2, cancel: 0.35, power: 1.05, hit: arc(152, 36), kb: 200, step: 20 },
      { name: 'กวาดหอก', anim: 'spin', windup: 0.12, active: 0.12, recover: 0.32, cancel: 0.7, power: 1.4, hit: { shape: 'circle', r: 138, forward: 0 }, kb: 300, hitStop: 0.06, shake: 4 },
    ],
    charged: { name: 'หอกทะลวง', anim: 'thrust', windup: 0.04, active: 0.18, recover: 0.32, cancel: 0.6, power: 2.6, hit: { shape: 'rush', dist: 200, width: 52 }, kb: 320, hitStop: 0.08, shake: 6 },
    dash: { name: 'กระโดดแทง', anim: 'thrust', windup: 0.06, active: 0.1, recover: 0.28, cancel: 0.5, power: 2, hit: { shape: 'circle', r: 96, forward: 70 }, kb: 280, step: 120, hitStop: 0.07, shake: 6 },
  },
  // Scythe: the widest reach of any blade. Reaping sweeps pull enemies in (negative knockback), the third hit
  // spins the blade around the hero, charge turns the spin into a storm.
  scythe: {
    id: 'scythe', name: 'เคียว', icon: 'scythe', chargeTime: 0.6, moveMult: 0.45, cancelFrom: 'windup', dodge: 'roll', twoHanded: true,
    trail: { color: '#efe6ff', glow: '#a97bff', width: 1.3 },
    desc: 'กวาดกว้างที่สุด ฟันแรกดึงศัตรูเข้าหาตัว จังหวะสามหมุนเคียวรอบตัว ชาร์จเป็นพายุเคียว',
    combo: [
      { name: 'เกี่ยววิญญาณ', anim: 'heavy', windup: 0.12, active: 0.1, recover: 0.26, cancel: 0.38, power: 1.15, hit: arc(138, 200), kb: -160, step: 18, hitStop: 0.05, shake: 3 },
      { name: 'เกี่ยวย้อน', anim: 'heavyUp', windup: 0.11, active: 0.1, recover: 0.26, cancel: 0.38, power: 1.25, hit: arc(138, 200), kb: 200, step: 18, hitStop: 0.05, shake: 3 },
      { name: 'วงเคียวมรณะ', anim: 'spin', windup: 0.12, active: 0.16, recover: 0.36, cancel: 0.7, power: 2.0, hit: { shape: 'circle', r: 152, forward: 0 }, kb: 320, hitStop: 0.08, shake: 6 },
    ],
    charged: { name: 'พายุเคียว', anim: 'spin', windup: 0.06, active: 0.2, recover: 0.4, cancel: 0.65, power: 3.0, hit: { shape: 'circle', r: 196, forward: 0 }, kb: -240, hitStop: 0.1, shake: 9, stun: 0.5 },
    dash: { name: 'เคียวพุ่ง', anim: 'heavy', windup: 0.04, active: 0.14, recover: 0.3, cancel: 0.55, power: 1.7, hit: { shape: 'rush', dist: 190, width: 64 }, kb: 220, hitStop: 0.06 },
  },
  // Twin blades: two long swords. Six alternating slashes, any dodge cancels, charge = a sixteen-cut flurry dash.
  twinblades: {
    id: 'twinblades', name: 'ดาบคู่', icon: 'twinblades', chargeTime: 0.5, moveMult: 0.62, cancelFrom: 'any', dodge: 'roll', dual: true,
    trail: { color: '#f4f6ff', glow: '#7fd0ff', width: 0.9 },
    desc: 'ฟันสลับซ้ายขวา 6 จังหวะ หลบยกเลิกได้ทุกเมื่อ ชาร์จเป็นพายุฟันพุ่งทะลวง',
    combo: [
      { name: 'กรีดซ้าย', anim: 'dslash', windup: 0.04, active: 0.06, recover: 0.12, cancel: 0.3, power: 0.62, hit: arc(104, 130), kb: 70, step: 12 },
      { name: 'กรีดขวา', anim: 'dslashB', windup: 0.04, active: 0.06, recover: 0.12, cancel: 0.3, power: 0.62, hit: arc(104, 130), kb: 70, step: 12 },
      { name: 'ไขว้คู่', anim: 'cross', windup: 0.05, active: 0.06, recover: 0.13, cancel: 0.32, power: 0.75, hit: arc(108, 140), kb: 90, step: 14 },
      { name: 'กรีดซ้ายลึก', anim: 'dslash', windup: 0.04, active: 0.06, recover: 0.12, cancel: 0.3, power: 0.7, hit: arc(108, 130), kb: 80, step: 12 },
      { name: 'กรีดขวาลึก', anim: 'dslashB', windup: 0.04, active: 0.06, recover: 0.12, cancel: 0.3, power: 0.7, hit: arc(108, 130), kb: 80, step: 12 },
      { name: 'คู่ดาบหมุนเหิน', anim: 'twinSpin', windup: 0.07, active: 0.14, recover: 0.3, cancel: 0.65, power: 1.6, hit: { shape: 'circle', r: 116, forward: 0 }, kb: 260, hitStop: 0.07, shake: 4 },
    ],
    charged: { name: 'พายุสิบหกคม', anim: 'twinSpin', windup: 0.04, active: 0.26, recover: 0.34, cancel: 0.6, power: 3.1, hit: { shape: 'rush', dist: 250, width: 56 }, kb: 180, hitStop: 0.1, shake: 7, critBonus: 0.15 },
    dash: { name: 'สวนคู่ดาบ', anim: 'cross', windup: 0.02, active: 0.08, recover: 0.22, cancel: 0.5, power: 1.5, hit: arc(118, 160), kb: 200, step: 60, hitStop: 0.05, critBonus: 0.2 },
  },
});

// ------------------------------------------------------------------ branch finishers
// A delayed press — let the combo breathe for a beat (0.18–0.6 s after a move ends, from the 2nd hit on) —
// swaps the next hit for the weapon's branch finisher. Rhythm, not mashing, opens it.
const BRANCH = {
  sword: { name: 'ฟันเสยฟ้า', anim: 'heavyUp', windup: 0.08, active: 0.1, recover: 0.32, cancel: 0.6, power: 1.9, hit: arc(118, 150), kb: 260, step: 30, stun: 0.55, hitStop: 0.08, shake: 5 },
  katana: { name: 'สามเงาจันทร์', anim: 'iai', windup: 0.05, active: 0.14, recover: 0.3, cancel: 0.6, power: 1.75, hit: { shape: 'rush', dist: 170, width: 44 }, kb: 160, hitStop: 0.07, critBonus: 0.25 },
  dagger: { name: 'เกลียวมีดคู่', anim: 'cross', windup: 0.04, active: 0.1, recover: 0.26, cancel: 0.55, power: 1.6, hit: { shape: 'circle', r: 96, forward: 0 }, kb: 200, hitStop: 0.05, shake: 3, critBonus: 0.15 },
  greatsword: { name: 'กระแทกปฐพีซ้อน', anim: 'overhead', windup: 0.22, active: 0.14, recover: 0.48, cancel: 0.75, power: 2.7, hit: { shape: 'circle', r: 150, forward: 80 }, kb: 460, step: 30, stun: 0.7, hitStop: 0.12, shake: 11 },
  staff: { name: 'วงแหวนประกาย', anim: 'castBig', windup: 0.12, active: 0.05, recover: 0.36, cancel: 0.6, power: 0.7, hit: { shape: 'proj', kind: 'bolt', speed: 560, r: 9, pierce: 0, count: 8, spread: 315, homing: 1.5 } },
  bow: { name: 'ศรกระจายพายุ', anim: 'shoot', windup: 0.12, active: 0.04, recover: 0.32, cancel: 0.6, power: 0.72, hit: { shape: 'proj', kind: 'arrow', speed: 1000, r: 7, pierce: 1, count: 5, spread: 46 }, shake: 3 },
  spear: { name: 'แทงทะลวงสามชั้น', anim: 'thrust', windup: 0.1, active: 0.09, recover: 0.3, cancel: 0.6, power: 1.95, hit: arc(178, 30), kb: 380, step: 36, hitStop: 0.07, shake: 4 },
  scythe: { name: 'ตัดดวงจันทร์', anim: 'overhead', windup: 0.14, active: 0.12, recover: 0.4, cancel: 0.65, power: 2.2, hit: arc(150, 130), kb: 300, step: 26, stun: 0.6, hitStop: 0.09, shake: 6 },
  twinblades: { name: 'คู่ดาบกรีดวงเดือน', anim: 'twinSpin', windup: 0.05, active: 0.16, recover: 0.3, cancel: 0.6, power: 2.0, hit: { shape: 'circle', r: 118, forward: 10 }, kb: 240, hitStop: 0.07, shake: 4, critBonus: 0.1 },
};
for (const [id, b] of Object.entries(BRANCH)) if (WEAPON_TYPES[id]) Object.defineProperty(WEAPON_TYPES[id], 'branch', { value: Object.freeze(b), enumerable: true });

export const WEAPON_TYPE_IDS = Object.freeze(Object.keys(WEAPON_TYPES));

export function getWeaponType(id) {
  return Object.prototype.hasOwnProperty.call(WEAPON_TYPES, id) ? WEAPON_TYPES[id] : WEAPON_TYPES.sword;
}

// Cancel rules: 'windup' = windup + recover can be dodge-cancelled, 'any' = always, 'recover' = recover only.
export function canDodgeCancel(type, phase) {
  if (!phase) return true;
  if (type.cancelFrom === 'any') return true;
  if (phase === 'recover') return true;
  return type.cancelFrom === 'windup' && phase === 'windup';
}

// v7: a weapon item may carry its own moveset (data/weapons2.js `moves`). The family keeps its grip, dodge,
// trail and animations; the combo string, charged move, dodge attack and branch finisher are the weapon's own.
const movesetCache = new Map();
export function movesetFor(def) {
  const base = getWeaponType(def?.wtype);
  if (!def?.moves) return base;
  if (!movesetCache.has(def.id)) {
    const m = def.moves;
    const t = { ...base, id: base.id, combo: m.combo || base.combo, charged: m.charged || base.charged, dash: m.dash || base.dash,
      desc: def.desc, own: def.id, trail: def.art?.glow ? { ...base.trail, glow: def.art.glow, color: def.art.edge || base.trail.color } : base.trail };
    Object.defineProperty(t, 'branch', { value: m.branch || base.branch, enumerable: true });
    movesetCache.set(def.id, Object.freeze(t));
  }
  return movesetCache.get(def.id);
}
