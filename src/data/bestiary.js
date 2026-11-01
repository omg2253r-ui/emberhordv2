// สมุดบอส: every boss of the game in one book. Name and level come from the monster itself; this file adds the
// epithet under the name, the element (colour and the effects drawn around it), and the attack pattern of each
// health phase, written from what its behaviour really does (battle/*Behaviours.js, battle/enemies.js).
import { getEnemy } from './enemies.js';
import { ZONES, RAIDS } from './zones.js';
import { STAGES } from './stages.js';
import { GODS, floorPlan, floorLevel, floorDrops } from './tower.js';
import { dropOdds } from '../systems/loot.js';
import { armorPlan } from './bossArmor.js';
import { getItem } from './items.js';
import { rarityOf } from './rarity.js';

// element → colours for the card and the effects around the boss in battle
export const ELEMENTS = Object.freeze({
  nature: { name: 'ธรรมชาติ', c1: '#6f9a4a', c2: '#2a3a1c', glow: '#c9df8c', fx: 'leaves' },
  forge: { name: 'เพลิงหลอม', c1: '#ff8a3d', c2: '#2a1410', glow: '#ffd08a', fx: 'embers' },
  storm: { name: 'พายุ', c1: '#6fa8ff', c2: '#101a3a', glow: '#d9ecff', fx: 'lightning' },
  ice: { name: 'น้ำแข็ง', c1: '#8fd0f0', c2: '#0e2234', glow: '#e8f8ff', fx: 'snow' },
  poison: { name: 'พิษ', c1: '#8ad050', c2: '#14240e', glow: '#d6ff9a', fx: 'bubbles' },
  shadow: { name: 'เงา', c1: '#9a6aff', c2: '#160e2a', glow: '#e0b0ff', fx: 'shadow' },
  sun: { name: 'ทะเลทราย', c1: '#f0c060', c2: '#2a1e0c', glow: '#fff0b0', fx: 'sand' },
  spore: { name: 'สปอร์', c1: '#c08aff', c2: '#1e1030', glow: '#9fffd8', fx: 'spores' },
  thunder: { name: 'สายฟ้า', c1: '#5a8aff', c2: '#0c1428', glow: '#fff07a', fx: 'lightning' },
  magma: { name: 'ลาวา', c1: '#ff5a2a', c2: '#2a0c06', glow: '#ffcf5a', fx: 'embers' },
  holy: { name: 'ศักดิ์สิทธิ์', c1: '#f5d48a', c2: '#2a2414', glow: '#fffbe0', fx: 'rays' },
  ash: { name: 'เถ้า', c1: '#e04a2a', c2: '#1e0a08', glow: '#ff9a5a', fx: 'embers' },
  wrath: { name: 'โทสะ', c1: '#ff3a2a', c2: '#2a0606', glow: '#ffb35a', fx: 'embers' },
  star: { name: 'ดวงดาว', c1: '#4a6aff', c2: '#08102a', glow: '#bfe3ff', fx: 'stars' },
  water: { name: 'วิญญาณน้ำ', c1: '#3ac0e8', c2: '#06202a', glow: '#bff6ff', fx: 'drops' },
  chain: { name: 'โซ่เลือด', c1: '#c0303a', c2: '#200608', glow: '#ff6a6a', fx: 'embers' },
  void: { name: 'ความเงียบ', c1: '#7a6aa8', c2: '#0a0814', glow: '#c8c8ff', fx: 'shadow' },
  serpent: { name: 'อสรพิษ', c1: '#7ac050', c2: '#0c1a0a', glow: '#d6ff9a', fx: 'bubbles' },
  time: { name: 'กาลเวลา', c1: '#e8d8a0', c2: '#1a160c', glow: '#fff3c4', fx: 'stars' },
  mask: { name: 'มายา', c1: '#ff5a9a', c2: '#1e0818', glow: '#ffb8d8', fx: 'shadow' },
  king: { name: 'ขุมนรก', c1: '#ff2a3a', c2: '#1a0408', glow: '#ff9a7a', fx: 'embers' },
});

// order of the book: the story, the ten lands, the special dungeons, the tower
export const BOSSES = Object.freeze([
  { id: 'thornback_boar', epithet: 'ราชาแห่งป่าหนาม ผู้ปกป้องผืนดิน', el: 'nature',
    phases: [['100–50%', 'ไล่ตาม แล้วพุ่งชนตามแนววงเตือน · กระทืบพื้นเป็นวงรอบตัว'], ['50–0%', 'โกรธจัด: ทุกท่าเร็วขึ้นราวหนึ่งในสี่ ช่วงพักสั้นลง']] },
  { id: 'furnace_golem', epithet: 'ผู้พิทักษ์ซากอารยธรรมเตาหลอม', el: 'forge',
    phases: [['100–50%', 'ทุบพื้นตรงที่คุณยืน (วงเตือน) · ปล่อยลูกไฟ 12 ลูกเป็นวงรอบตัว'], ['50–0%', 'เรียกภูตถ่านมาช่วย · ทุกท่าเร็วขึ้น']] },
  { id: 'z_storm_roc', epithet: 'ผู้ครอบครองพลังแห่งท้องฟ้า', el: 'storm',
    phases: [['100–50%', 'พุ่งดิ่ง 3 แนวไขว้กัน · สะบัดขนนก 9 เส้นเป็นรูปพัด · พายุหมุนลอยตามช้าๆ'], ['50–0%', 'โกรธจัด: ลมกรรโชก เร็วขึ้น และปล่อยพายุหมุนไล่ตาม']] },
  { id: 'z_glacier_wyrm', epithet: 'เจ้าแห่งมหาสมุทรน้ำแข็ง', el: 'ice',
    phases: [['100–50%', 'มุดใต้น้ำแข็งแล้วโผล่ใต้ตัวคุณ · พ่นลมเยือกแข็งเป็นกรวย · ยิงเกล็ดน้ำแข็ง 16 ทิศ'], ['50–0%', 'น้ำแข็งแตก: มุดซ้ำสองรอบติด เกล็ดน้ำแข็งเพิ่มเป็น 22 ทิศ']] },
  { id: 'z_hydra_mire', epithet: 'สมบัติแห่งความโลภไม่สิ้นสุด', el: 'poison',
    phases: [['100–50%', 'สามหัวพ่นพิษสลับกัน · ดำลงบึงแล้วโผล่พร้อมคลื่นพิษ 3 วง (ยืนในช่องว่าง)'], ['50–0%', 'แตกพิษ: เรียกพองสปอร์ 3 ตัว ทุกท่าเร็วขึ้น']] },
  { id: 'z_umbral_knight', epithet: 'ผู้ควบคุมความมืดมิด', el: 'shadow',
    phases: [['100–50%', 'ฟันเงาสามครั้งต่อเนื่องเป็นรูปตัว Z · คลื่นความมืดรอบตัว'], ['50–0%', 'คลั่ง: เรียกนักฆ่าเงาสองตัว ฟันเร็วขึ้น']] },
  { id: 'z_sphinx_colossus', epithet: 'จักรกลแห่งยุคสาบสูญ', el: 'sun',
    phases: [['100–50%', 'ลำแสงกวาดเป็นวงหมุน · เสาทรายผุดเป็นตาราง 6 จุด'], ['50–0%', 'ดวงตาลืมขึ้น: ลำแสงสองเส้นกวาดสวนกัน']] },
  { id: 'z_mother_morel', epithet: 'ผู้มาเยือนจากต่างดาวแห่งป่าเห็ด', el: 'spore',
    phases: [['100–50%', 'สปอร์หมุนเป็นเกลียว 3 แขน · ฝนสปอร์ 9 จุด · เรียกลูกเห็ดเด้ง'], ['50–0%', 'แตกสปอร์: เกลียวเพิ่มเป็น 4 แขน เรียกลูกเพิ่ม']] },
  { id: 'z_tesla_titan', epithet: 'เครื่องจักรแห่งความหนาวเย็นไฟฟ้า', el: 'thunder',
    phases: [['100–50%', 'ปักเสานำไฟฟ้า แล้วโยงสายฟ้าระหว่างเสา (ทำลายเสาได้) · วงช็อกขยายออก 4 ชั้น · ระเบิดรอบตัวเมื่อเข้าใกล้'], ['50–0%', 'โอเวอร์โหลด: ทุกท่าเร็วขึ้น ช่วงพักสั้นลง']] },
  { id: 'z_rift_drake', epithet: 'พลังแห่งไฟที่ไม่อาจหยุดยั้ง', el: 'magma',
    phases: [['100–50%', 'พ่นไฟกวาด 7 จังหวะ · ฝนอุกกาบาต 10 ลูก · พุ่งชน'], ['50–0%', 'บินขึ้นฟ้า: ตีไม่ได้ชั่วครู่ แล้วโปรยไฟลงทั้งลาน']] },
  { id: 'z_seraph_warden', epithet: 'ผู้ส่งสารแห่งแสง', el: 'holy',
    phases: [['100–50%', 'ลำแสงไขว้รูป + แล้ว × · ล้อดาบหมุน 4 วง · กลีบแสง 20 กลีบมีช่องให้ลอด'], ['50–0%', 'เร็วขึ้นทุกท่า ช่วงพักสั้นลง']] },
  { id: 'z_ash_sovereign', epithet: 'ผู้ปกครองแห่งความตาย', el: 'ash',
    phases: [['100–66%', 'คลื่นดาบเถ้าพุ่งเป็นแนว · เดินบดเข้าหา'], ['66–33%', 'เรียกวิญญาณเถ้า + ลูกไฟติดตามตัว'], ['33–0%', 'บัลลังก์ลุกไฟ: วงเพลิงบีบลานเข้ามา ทุกท่าเร็วขึ้น']] },
  { id: 'r_wrath_dragon', epithet: 'ไฟแห่งการทำลายล้าง', el: 'wrath',
    phases: [['100–66%', 'กรงเล็บต่อเนื่อง (แพร์รี่ได้) · พ่นไฟกวาด · หางฟาดเป็นวง · พุ่งดิ่ง'], ['66–33%', 'พิโรธ: + ฝนไฟ และพื้นลาวาแตกเป็นแนวตามลำดับ'], ['33–0%', 'หัวใจลุกเป็นไฟ: วงหัวใจขยาย 3 ชั้น (ยืนในช่อง) + สุนัขลาวาสองตัว ทุกอย่างเร็วขึ้น']] },
  { id: 'r_prophecy_dragon', epithet: 'พลังน้ำแข็งแห่งดวงดาวที่ไม่มีวันสิ้นสุด', el: 'star',
    phases: [['100–66%', 'เล็งไปยังจุดที่คุณ "กำลังจะไป" · ลำแสงดาวหมุน · เกลียวลูกดาวมีช่อง · เลียนท่าล่าสุดซ้ำ'], ['66–33%', 'เงานิมิต (กระเบนเมฆ) + ลำแสงสี่แขน'], ['33–0%', 'อนาคตที่หลีกเลี่ยงไม่ได้: ทั้งลานถูกโจมตี ยกเว้นวงแสงข้างตัวบอส']] },
  { id: 'r_judgment_god', epithet: 'ผู้ตัดสินชะตากรรม', el: 'holy',
    phases: [['100–66%', 'ฟันดาบศักดิ์สิทธิ์ต่อเนื่อง (แพร์รี่ได้) · ตารางคำตัดสิน: ครึ่งพื้นถูกพิพากษา · เสาแสงลงทุกคน'], ['66–33%', 'เรียกนักพรตขนนกมาเป็นพยาน · ฝนดาบมีช่องว่าง'], ['33–0%', 'คำพิพากษาสุดท้าย: วงแสงบีบลาน ฟันต่อเนื่องเพิ่มเป็น 5 ครั้ง']] },
  { id: 'r_anubis', epithet: 'ผู้ชั่งหัวใจแห่งปรโลก', el: 'holy',
    phases: [['100–66%', 'ตาชั่งผ่าครึ่งลาน: ฝั่งที่ระเบิดทีหลังปลอดภัยชั่วคราว · เงาหมาป่าพุ่งตามทุกคน · หอกก้นหอยขยายออกจากตัว'], ['66–33%', 'เร็วขึ้น · หมาป่าพุ่งหลายรอบ'], ['33–0%', 'หัวใจของเจ้าหนักเกินไป: ทุกท่าถี่ขึ้น']] },
  { id: 'r_sekhmet', epithet: 'สิงโตเพลิงแห่งสงคราม', el: 'fire',
    phases: [['100–66%', 'กรงเล็บสามพัดเรียงกัน · รอยเท้าไฟตามตำแหน่งที่ยืนนิ่ง · วงเพลิงแผ่ออกจากตัวเธอ'], ['66–33%', 'วงเพลิงเพิ่มเป็นสี่ชั้น'], ['33–0%', 'สงครามไม่มีวันจบ: ท่าถี่และเร็วขึ้น']] },
  { id: 'r_ra_god', epithet: 'สุริยเทพผู้ส่องทุกสิ่ง', el: 'holy',
    phases: [['100–66%', 'ลำแสงสุริยะหมุนไขว้ · ด้วงสุริยะระเบิดตามตัวผู้เล่น · เรือสุริยะแล่นผ่านสองรอบ ต้องหาช่องที่ว่างทั้งคู่'], ['66–33%', 'ลำแสงครบสี่ทิศ'], ['33–0%', 'รุ่งอรุณแห่งการพิพากษา: ทุกท่าถี่ขึ้น']] },
  { id: 't_god_river', epithet: 'ผู้แจวเรือข้ามฝั่งสุดท้าย', el: 'water',
    phases: [['100–66%', 'พายแจวกวาด 2 ครั้ง (แพร์รี่ได้) · วิญญาณติดตามตัว · กระแสน้ำผลักทั้งห้อง · ดำลงน้ำ (ตัวจางลงแต่ยังโดนตี) แล้วโผล่พร้อมน้ำพุ'], ['66–33%', 'แม่น้ำเชี่ยว: + น้ำวนเป็นวงซ้อน ทุกท่าเร็วขึ้น'], ['33–0%', 'เรียกผู้จมน้ำ 3 ตัว พายแจว 3 ครั้ง · หลังโผล่จากน้ำจะเหนื่อยหอบ = จังหวะตี']] },
  { id: 't_god_chains', epithet: 'ผู้คุมนักโทษนิรันดร์', el: 'chain',
    phases: [['100–66%', 'โซ่ฟาดเจาะเกราะ (สีแดงเข้ม กันไม่ได้) · ตะขอดึงตัว · กรงโซ่'], ['66–33%', 'ล่ามตัวเองกับหมุดโซ่สามต้น: ทุบหมุดครบแล้วเสียหลัก 3 วินาที (ตีตัวได้ตลอด)'], ['33–0%', 'ล่ามหมุดอีกรอบ แล้วปลดโซ่ทุกเส้น ฟาดถี่ขึ้น']] },
  { id: 't_god_hellfire', epithet: 'เตาเผาที่ไม่มีวันมอด', el: 'magma',
    phases: [['100–66%', 'โล่เพลิงเป็นเกราะดูดดาเมจ · ระเบิดวงใหญ่แล้วโล่ดับ 5 วินาที = ช่องตี (ยิงเกราะให้แตกเองก็คืนตัวใน 5 วินาที) · วงไฟซ้อนมีช่องลอด'], ['66–33%', 'เตาไฟลุกโชน: เรียกลูกน้อง 2 ตัว + ทะเลเพลิง'], ['33–0%', 'กลืนทุกสิ่ง: เรียก 3 ตัว ทุกท่าเร็วขึ้น']] },
  { id: 't_god_silence', epithet: 'เงาที่กลืนเสียง', el: 'void',
    phases: [['100–66%', 'ความมืดบดบังห้อง · วาร์ปฟันจากด้านหลัง · คลื่นปิดเสียง (ห้ามใช้สกิล 3 วินาที)'], ['66–33%', 'แยกร่างเงา: มีร่างจริงร่างเดียว (มีเงาบนพื้น)'], ['33–0%', 'ความเงียบกลืนทั้งห้อง: ปิดเสียงถี่ขึ้น']] },
  { id: 't_god_judge', epithet: 'ตาชั่งที่ไม่เคยเอียง', el: 'holy',
    phases: [['100–66%', 'ทุกครั้งที่โดนตีจะสะสม "บาป" · คำตัดสินแรงตามบาปและเจาะเกราะ · ตาชั่งเอียง: ครึ่งห้องถูกพิพากษา'], ['66–33%', 'ตาชั่งเอียงสองครั้งสลับข้าง + เรียกพยาน 2 ตัว'], ['33–0%', 'คำพิพากษาสุดท้าย: เรียก 3 ตัว คำตัดสินถี่ขึ้น']] },
  { id: 't_god_serpent', epithet: 'งูที่กลืนแม่น้ำ', el: 'serpent',
    phases: [['100–66%', 'มุดดิน (ตัวจางลงแต่ยังโดนตี) แล้วพุ่งขึ้นใต้จุดเตือน · ฟาดหางเจาะเกราะ · ถ่มพิษ'], ['66–33%', 'พิษท่วม: บึงพิษค่อยๆ ขยาย + ลูกน้อง 2 ตัว'], ['33–0%', 'ลอกคราบ: ลูกน้อง 4 ตัว ทุกท่าเร็วขึ้น']] },
  { id: 't_god_time', epithet: 'ผู้นับลมหายใจสุดท้าย', el: 'time',
    phases: [['100–66%', 'เข็มนาฬิกากวาดรอบห้อง · หยุดเวลาทำให้ช้า'], ['66–33%', 'ย้อนเวลา: ร่ายในหน้าปัดนาฬิกา ถ้าไม่ตีขัดจะฟื้นเลือดที่เสียไป + ลูกน้อง 2 ตัว'], ['33–0%', 'หยุดทุกเข็ม: เข็มกวาดเร็วขึ้น ลูกน้อง 3 ตัว']] },
  { id: 't_god_masks', epithet: 'ผู้ไม่มีหน้าจริง', el: 'mask',
    phases: [['100–66%', 'หน้ากากเก้าหน้าหมุนรอบตัว ตีเข้าได้เฉพาะหน้ากากสีขาว 3 หน้า · หน้าผิดสะท้อนดาเมจกลับ'], ['66–33%', 'เงาสะท้อนตื่น: ร่างกระจกเลียนท่าโจมตี'], ['33–0%', 'พันหน้าหมุนเร็วขึ้น ต้องอ่านจังหวะหน้าเรืองแสง']] },
  { id: 't_god_frost', epithet: 'ความหนาวที่ไม่มีก้น', el: 'ice',
    phases: [['100–66%', 'รังน้ำแข็ง: ต้องทุบโล่ให้แตกก่อน (แตกแล้วบอสมึน) · หิมะเยือกแข็ง ยืนนิ่งจะแข็งทื่อ · หอกน้ำแข็งเจาะเกราะ'], ['66–33%', 'น้ำแข็งงอกใหม่ (โล่ 10% ของเลือด) + ลูกน้อง 2 ตัว'], ['33–0%', 'ขุมน้ำแข็งเปิด: โล่ใหม่ ลูกน้อง 3 ตัว']] },
  { id: 't_god_king', epithet: 'บัลลังก์ที่ไม่มีวันว่าง', el: 'king',
    phases: [['100–66%', 'ยืมพลังเทพแรกๆ: พายแจว โซ่เจาะเกราะ ระเบิดเพลิง วาร์ปฟัน'], ['66–33%', 'ยืมพลังเทพกลาง: คำตัดสิน มุดดิน เข็มนาฬิกา'], ['33–0%', 'บัลลังก์ขุมนรก: เรียกเงาเทพ ทำลายเงาให้หมดเพื่อให้เสียหลัก (ตีตัวได้ตลอด)']] },
]);

const BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

// The trial of a land or raid boss (on top of its own attacks): from land 3 it carries armour for every health phase
// (data/bossArmor.js: soaks the damage first; breaking it shakes the boss's stance); from land 4, and in every raid, once it
// is enraged its blows pierce armour and shields (crimson warnings). Tower gods have their own rules.
export function bossTrial(zone) {
  if (!zone || zone.tower || zone.infinite) return null;
  if (zone.raid) return { ward: true, pierce: true };
  const n = zone.n || 0;
  if (n < 3) return null;
  return { ward: true, pierce: n >= 4 };
}
export const bossElement = (id) => (BY_ID[id] ? ELEMENTS[BY_ID[id].el] : null);

// ------------------------------------------------------------------ เลือดหลายหลอด (v8.6)
// No boss is ever immune any more (see battle/bossGuard.js). Instead its health bar is worth N bars (หลอด), from 1 up to
// MAX_BARS, by how hard the boss is and how rich its rewards are:
//   difficulty  the boss's level, 1 … 45 (45 = the king of the tower)                      weight 60%
//   reward      expected "rarity points" per kill: every drop's chance × 2.2^tier (common 0 … mythic 5),
//               from the poorest boss (REWARD_LO) to the richest (REWARD_HI)                  weight 40%
// bars = 1 + (MAX_BARS - 1) × score^1.5, rounded; the curve keeps early bosses at a few bars and saves the top for the
// last gods and the raids. Tune MAX_BARS / the weights / the exponent here: the battle, the HUD and the book follow.
export const MAX_BARS = 100;
const LEVEL_TOP = 45, REWARD_LO = 13, REWARD_HI = 70, W_DIFF = 0.6, W_REWARD = 0.4, CURVE = 1.5;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
export function rewardPoints(drops) {
  let ev = 0;
  for (const o of drops) ev += o.chance * Math.pow(2.2, rarityOf(getItem(o.id)?.rarity).order);
  return ev;
}
export function barsFor(level, drops) {
  const score = W_DIFF * clamp01((level - 1) / (LEVEL_TOP - 1)) + W_REWARD * clamp01((rewardPoints(drops) - REWARD_LO) / (REWARD_HI - REWARD_LO));
  return Math.max(1, Math.min(MAX_BARS, Math.round(1 + (MAX_BARS - 1) * Math.pow(score, CURVE))));
}
const BARS = new Map();
export function bossBars(id) {
  if (BARS.has(id)) return BARS.get(id);
  const def = getEnemy(id);
  let n = 1;
  if (def?.boss) {
    if (def.zone === 'rush') n = barsFor(34, dropOdds(def.drops || []));      // the shadow at the end of the Boss Rush fights at level 34
    else { const f = bossFacts({ id }); if (f) n = barsFor(f.level, f.drops); }
  }
  BARS.set(id, n);
  return n;
}

// where the boss lives, how hard, and what it guards
function bossFacts(entry) {
  const def = getEnemy(entry.id);
  if (!def) return null;
  const zone = [...ZONES, ...RAIDS].find((z) => z.boss === entry.id);
  const stage = !zone ? STAGES.find((s) => s.boss === entry.id || (s.bossId === entry.id)) : null;
  const god = GODS.find((g) => g.id === entry.id);
  let level, where, drops;
  if (god) { level = Math.round(floorLevel(god.floor)); where = `หอคอยขุมนรก ชั้น ${god.floor}`; drops = dropOdds(floorDrops(god.floor, 0)); }
  else if (zone) { level = zone.level; where = zone.raid ? `ดันเจี้ยนพิเศษ: ${zone.name}` : zone.story ? `เนื้อเรื่อง: ${zone.name}` : `ดินแดน ${zone.n}: ${zone.name}`; drops = dropOdds(def.drops || []); }
  else { const s = stage || STAGES[entry.id === 'furnace_golem' ? 1 : 0]; level = s?.recommendedLevel || 1; where = `เนื้อเรื่อง: ${s?.name || ''}`; drops = dropOdds(def.drops || []); }
  const stars = Math.max(1, Math.min(5, Math.round((1 + level / 9) * 2) / 2));
  return { def, zone, god, level, where, stars, drops };
}

export function bossInfo(entry) {
  const f = bossFacts(entry);
  if (!f) return null;
  const { def, zone, god, level, where, stars, drops } = f;
  const trial = bossTrial(zone);
  // armour per phase (solo HP, the same numbers the battle uses)
  const armor = trial?.ward ? armorPlan(def.hp * bossBars(entry.id), zone.raid ? 'raid' : 'land') : god?.ai === 'god_hellfire' ? armorPlan(def.hp, 'god') : null;
  return { def, level, where, stars, drops: drops.sort((a, b) => a.chance - b.chance), el: ELEMENTS[entry.el] || ELEMENTS.nature, god, zone, trial, armor };
}

// has this hero beaten it?
export function bossBeaten(state, id) {
  if (GODS.some((g) => g.id === id)) return !!state.tower?.gods?.[id];
  const zone = [...ZONES, ...RAIDS].find((z) => z.boss === id);
  if (zone?.raid) return (state.raids?.[zone.id]?.kills || 0) > 0;
  if (zone) return (state.zones?.cleared?.[zone.id] || 0) > 0;
  if (id === 'thornback_boar') return !!state.progress?.cleared?.s1;
  if (id === 'furnace_golem') return !!state.progress?.cleared?.s2;
  return false;
}
export { floorPlan };
