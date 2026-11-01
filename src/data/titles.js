// Achievements and titles (ตราความสำเร็จ · ฉายา). Every achievement unlocks a title. The hero wears ONE title:
// its bonus applies and everyone sees it above the name (village, zones, PvP, rankings). Every five achievements
// also raise the honour badge (ตราเกียรติยศ): +1% attack, defence and HP per tier, shown next to the name.
// Checks read the save only, so they cannot drift from what the hero really did.
import { RACES } from './races.js';
import { PETS } from './pets.js';
import { ITEMS } from './items.js';
import { ZONES, RAIDS } from './zones.js';
import { GODS } from './tower.js';

const cnt = (o) => Object.keys(o || {}).length;
const towerDeep = (s) => s.tower?.deepest || 0;            // asc * 100 + floor
const gods = (s) => Object.keys(s.tower?.gods || {}).length;
const ownsRarity = (s, r) => [s.equipment?.weapon, s.equipment?.armor, s.equipment?.charm, s.equipment?.wings, ...(s.inventory?.slots || [])].some((x) => x && ITEMS[x.id]?.rarity === r);
const maxUpgrade = (s) => Math.max(0, ...[s.equipment?.weapon, s.equipment?.armor, s.equipment?.charm, s.equipment?.wings, ...(s.inventory?.slots || [])].filter(Boolean).map((x) => x.lvl || 0));
const fiveStar = (s) => Object.values(s.pets?.owned || {}).some((p) => p.stars >= 5);

// t: tier colour (bronze, silver, gold, ember, mythic) · b: bonus while the title is worn
export const TITLES = Object.freeze([
  // ---- the climb
  { id: 'lv10', name: 'นักล่าฝึกหัด', t: 1, how: 'ถึงเลเวล 10', test: (s) => s.player.level >= 10, b: { hpPct: 0.02 } },
  { id: 'lv20', name: 'นักล่าเจนสนาม', t: 2, how: 'ถึงเลเวล 20', test: (s) => s.player.level >= 20, b: { atkPct: 0.03 } },
  { id: 'lv30', name: 'ยอดนักล่าแห่งป่าหนาม', t: 3, how: 'ถึงเลเวล 30', test: (s) => s.player.level >= 30, b: { atkPct: 0.04, hpPct: 0.04 } },
  { id: 'kill100', name: 'ผู้ล้างรัง', t: 1, how: 'กำจัดศัตรู 500 ตัว', test: (s) => s.stats.kills >= 500, b: { crit: 0.01 } },
  { id: 'kill2k', name: 'ผู้ไม่รู้จักเหนื่อย', t: 2, how: 'กำจัดศัตรู 5,000 ตัว', test: (s) => s.stats.kills >= 5000, b: { atkPct: 0.03 } },
  { id: 'kill20k', name: 'ฝันร้ายของมอนสเตอร์', t: 4, how: 'กำจัดศัตรู 50,000 ตัว', test: (s) => s.stats.kills >= 50000, b: { atkPct: 0.05, critMult: 0.1 } },
  // ---- the story and the lands
  { id: 'story1', name: 'ผู้ฝ่าป่าหนาม', t: 1, how: 'ผ่านป่าหนามสนธยา', test: (s) => !!s.progress?.cleared?.s1, b: { spd: 0.02 } },
  { id: 'story2', name: 'ผู้ดับเตาหลอม', t: 2, how: 'ผ่านเหมืองถ่านเพลิง', test: (s) => !!s.progress?.cleared?.s2, b: { defPct: 0.03 } },
  { id: 'zones3', name: 'นักสำรวจประตูมิติ', t: 1, how: 'พิชิตดันเจี้ยนรวม 5 โซน', test: (s) => cnt(s.zones?.cleared) >= 5, b: { goldMult: 0.05 } },
  { id: 'zones10', name: 'ผู้เดินทางสิบดินแดน', t: 3, how: 'พิชิตดันเจี้ยนรวมครบ 10 โซน', test: (s) => ZONES.every((z) => s.zones?.cleared?.[z.id]), b: { hpPct: 0.05, defPct: 0.03 } },
  { id: 'wrath', name: 'ผู้ดับไฟพิโรธ', t: 3, how: 'ปราบอัคนิวาร มังกรพิโรธ', test: (s) => (s.raids?.r1?.kills || 0) > 0, b: { critMult: 0.12 } },
  { id: 'prophecy', name: 'ผู้หลุดพ้นคำพยากรณ์', t: 3, how: 'ปราบนิมิตรา มังกรแห่งคำพยากรณ์', test: (s) => (s.raids?.r2?.kills || 0) > 0, b: { crit: 0.03 } },
  { id: 'judgment', name: 'ผู้รอดคำพิพากษา', t: 4, how: 'ปราบเทพแห่งคำพิพากษา', test: (s) => (s.raids?.r3?.kills || 0) > 0, b: { defPct: 0.06, hpPct: 0.03 } },
  { id: 'raids', name: 'ผู้พิชิตสามมังกรฟ้า', t: 4, how: 'ปราบบอสดันพิเศษครบทั้งสาม 25 ครั้งต่อตัว', test: (s) => RAIDS.every((r) => (s.raids?.[r.id]?.kills || 0) >= 25), b: { atkPct: 0.05, crit: 0.02 } },
  // ---- the tower
  { id: 'tower10', name: 'ผู้ข้ามแม่น้ำวิญญาณ', t: 1, how: 'ผ่านหอคอยขุมนรกชั้น 10', test: (s) => towerDeep(s) >= 10, b: { hpPct: 0.03 } },
  { id: 'tower30', name: 'ผู้ลุยไฟนรก', t: 2, how: 'ผ่านหอคอยขุมนรกชั้น 30', test: (s) => towerDeep(s) >= 30, b: { atkPct: 0.03, hpPct: 0.02 } },
  { id: 'tower50', name: 'ผู้ผ่านตาชั่ง', t: 3, how: 'ผ่านหอคอยขุมนรกชั้น 50', test: (s) => towerDeep(s) >= 50, b: { defPct: 0.05, critMult: 0.08 } },
  { id: 'tower70', name: 'ผู้หยุดเข็มนาฬิกา', t: 3, how: 'ผ่านหอคอยขุมนรกชั้น 70', test: (s) => towerDeep(s) >= 70, b: { atkPct: 0.05, spd: 0.03 } },
  { id: 'tower100', name: 'ผู้โค่นบัลลังก์ขุมนรก', t: 5, how: 'ผ่านหอคอยขุมนรกชั้น 100', test: (s) => towerDeep(s) >= 100, b: { atkPct: 0.07, hpPct: 0.07, crit: 0.03 } },
  { id: 'asc3', name: 'ผู้ดำดิ่งสามขุม', t: 5, how: 'ไปถึงขุมลึก 3', test: (s) => (s.tower?.bestAsc || 0) >= 3, b: { atkPct: 0.08, critMult: 0.2 } },
  { id: 'gods5', name: 'ผู้สังหารเทพ', t: 4, how: 'ปราบเทพแห่งขุมนรก 5 องค์', test: (s) => gods(s) >= 5, b: { critMult: 0.15, atkPct: 0.03 } },
  { id: 'gods10', name: 'มหากาฬคนใหม่', t: 5, how: 'ปราบเทพแห่งขุมนรกครบ 10 องค์', test: (s) => gods(s) >= GODS.length, b: { atkPct: 0.06, defPct: 0.06, hpPct: 0.06 } },
  // ---- companions and blood
  { id: 'pets10', name: 'มิตรของสรรพสัตว์', t: 1, how: 'มีสัตว์เลี้ยง 15 ชนิด', test: (s) => cnt(s.pets?.owned) >= 15, b: { goldMult: 0.06 } },
  { id: 'pets25', name: 'ผู้เลี้ยงฝูงอสูร', t: 3, how: 'มีสัตว์เลี้ยง 30 ชนิด', test: (s) => cnt(s.pets?.owned) >= 30, b: { skillPower: 0.08 } },
  { id: 'petsAll', name: 'ราชาแห่งสัตว์เลี้ยง', t: 5, how: 'มีสัตว์เลี้ยงครบทุกชนิด', test: (s) => cnt(s.pets?.owned) >= Object.keys(PETS).length, b: { skillPower: 0.12, hpPct: 0.04 } },
  { id: 'pet5star', name: 'คู่หูห้าดาว', t: 2, how: 'มีสัตว์เลี้ยงห้าดาว 1 ตัว', test: fiveStar, b: { skillPower: 0.05 } },
  { id: 'races10', name: 'สายเลือดผสม', t: 2, how: 'เคยเป็น 15 เผ่า', test: (s) => cnt(s.raceSeen) >= 15, b: { hpPct: 0.03 } },
  { id: 'races25', name: 'ผู้จดจำบรรพชน', t: 3, how: 'เคยเป็น 30 เผ่า', test: (s) => cnt(s.raceSeen) >= 30, b: { atkPct: 0.03, defPct: 0.03 } },
  { id: 'racesAll', name: 'สายเลือดทั้งปวง', t: 5, how: 'เคยเป็นครบทุกเผ่า', test: (s) => cnt(s.raceSeen) >= Object.keys(RACES).length, b: { atkPct: 0.05, hpPct: 0.05, crit: 0.02 } },
  { id: 'raceLegend', name: 'เลือดตำนาน', t: 3, how: 'ได้สายเลือดระดับตำนาน', test: (s) => Object.keys(s.raceSeen || {}).some((id) => RACES[id]?.rarity === 'legendary'), b: { critMult: 0.1 } },
  // ---- the forge and the bag
  { id: 'craft1', name: 'ลูกศิษย์หัวหน้าหมู่บ้าน', t: 1, how: 'สั่งตีอุปกรณ์ 1 ชิ้น', test: (s) => s.stats.crafted >= 1, b: { defPct: 0.02 } },
  { id: 'craft25', name: 'ช่างตีเหล็กแห่งค่าย', t: 3, how: 'สั่งตีอุปกรณ์ 60 ชิ้น', test: (s) => s.stats.crafted >= 60, b: { defPct: 0.05 } },
  { id: 'up10', name: 'ผู้ตีบวกสิบ', t: 2, how: 'ตีบวกอุปกรณ์ถึง +12', test: (s) => maxUpgrade(s) >= 12, b: { atkPct: 0.03 } },
  { id: 'up15', name: 'ผู้ไม่กลัวเตาแตก', t: 3, how: 'ตีบวกอุปกรณ์ถึง +15', test: (s) => maxUpgrade(s) >= 15, b: { atkPct: 0.04, critMult: 0.08 } },
  { id: 'up20', name: 'ช่างตีเทพ', t: 5, how: 'ตีบวกอุปกรณ์ถึง +20', test: (s) => maxUpgrade(s) >= 20, b: { atkPct: 0.07, defPct: 0.04 } },
  { id: 'mythic', name: 'ผู้ถือของเทพตำนาน', t: 4, how: 'ครอบครองอุปกรณ์ระดับเทพตำนาน', test: (s) => ownsRarity(s, 'mythic'), b: { crit: 0.03, critMult: 0.1 } },
  { id: 'rich', name: 'เศรษฐีแห่งค่ายถ่าน', t: 2, how: 'มีทอง 1,000,000', test: (s) => s.gold >= 1000000, b: { goldMult: 0.12 } },
  // ---- skill and nerve
  { id: 'pvp10', name: 'ผู้ท้าดวล', t: 2, how: 'ชนะ PvP 25 ครั้ง', test: (s) => (s.pvp?.wins || 0) >= 25, b: { atkPct: 0.02, crit: 0.01 } },
  { id: 'pvp50', name: 'แชมป์ลานประลอง', t: 4, how: 'ชนะ PvP 100 ครั้ง', test: (s) => (s.pvp?.wins || 0) >= 100, b: { atkPct: 0.04, crit: 0.02 } },
  { id: 'rift25', name: 'ผู้จ้องรอยแยก', t: 2, how: 'รอดรอยแยกไร้สิ้นสุดถึงคลื่น 35', test: (s) => (s.infinite?.best || 0) >= 35, b: { hpPct: 0.04 } },
  { id: 'rift60', name: 'ผู้กลืนรอยแยก', t: 4, how: 'รอดรอยแยกไร้สิ้นสุดถึงคลื่น 80', test: (s) => (s.infinite?.best || 0) >= 80, b: { hpPct: 0.06, defPct: 0.03 } },
  { id: 'perfect500', name: 'เงาที่จับไม่ได้', t: 3, how: 'หลบสมบูรณ์ 1,000 ครั้ง', test: (s) => (s.stats.perfects || 0) >= 1000, b: { spd: 0.04, crit: 0.02 } },
  { id: 'parry300', name: 'โล่ที่ไม่เคยพลาด', t: 3, how: 'แพร์รี่ 600 ครั้ง', test: (s) => (s.stats.parries || 0) >= 600, b: { defPct: 0.04, critMult: 0.1 } },
  { id: 'arts15', name: 'ผู้ปลูกต้นไม้จักรวาล', t: 3, how: 'มีอาร์ติแฟกต์ 15 ชิ้น', test: (s) => cnt(s.artifacts?.owned) >= 15, b: { skillPower: 0.06, hpPct: 0.02 } },
  // ---- v8: skills, ultimates, the boss arena, the secret weapon
  { id: 'skills30', name: 'คัมภีร์เดินได้', t: 3, how: 'เรียนสกิล 30 ชนิด', test: (s) => cnt(s.skills?.ranks) >= 30, b: { skillPower: 0.06 } },
  { id: 'ult100', name: 'ผู้ปลดปล่อยไม้ตาย', t: 3, how: 'ใช้ท่าไม้ตาย 100 ครั้ง', test: (s) => (s.stats.ults || 0) >= 100, b: { critMult: 0.1, skillPower: 0.04 } },
  { id: 'bossrush', name: 'ผู้รอดลานเจ้าบอส', t: 4, how: 'ผ่านลานประลองเจ้าแห่งบอส', test: (s) => (s.stats.bossRush || 0) >= 1, b: { atkPct: 0.05, hpPct: 0.04 } },
  { id: 'eclipse', name: 'ผู้ถือคราสแห่งสุริยะ', t: 5, how: 'ครอบครองอาวุธลับ', test: (s) => [s.equipment?.weapon, ...(s.inventory?.slots || [])].some((x) => x && x.id === 'w_eclipse_blade'), b: { atkPct: 0.06, crit: 0.03, critMult: 0.12 } },
]);
export const TITLE_TIERS = Object.freeze({ 1: { name: 'สำริด', color: '#c8905a' }, 2: { name: 'เงิน', color: '#cfd6e6' }, 3: { name: 'ทอง', color: '#f5c35a' }, 4: { name: 'ถ่านเพลิง', color: '#ff7a3a' }, 5: { name: 'เทพตำนาน', color: '#ff5f7a' } });
const BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));
export const getTitle = (id) => BY_ID[id] || null;
export const BADGE_EVERY = 5;
export const badgeTier = (state) => Math.floor(Object.keys(state.titles?.owned || {}).filter((id) => BY_ID[id]).length / BADGE_EVERY);
export const BADGE_NAMES = Object.freeze(['', 'ตราเกียรติยศ I', 'ตราเกียรติยศ II', 'ตราเกียรติยศ III', 'ตราเกียรติยศ IV', 'ตราเกียรติยศ V', 'ตราเกียรติยศ VI', 'ตราเกียรติยศ VII', 'ตราเกียรติยศ VIII']);

const STAT_TXT = { atkPct: 'พลังโจมตี', hpPct: 'พลังชีวิต', defPct: 'ป้องกัน', crit: 'โอกาสคริติคอล', critMult: 'แรงคริติคอล', spd: 'ความเร็ว', goldMult: 'ทอง', skillPower: 'พลังสกิล' };
export const titleBonusText = (b) => Object.entries(b).map(([k, v]) => `${STAT_TXT[k] || k} +${Math.round(v * 100)}%`).join(' · ');
