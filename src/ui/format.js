// Display formatting for stats and reasons, shared by every panel.
import { STAT_NAMES, getItem } from '../data/items.js';

export const STAT_ORDER = ['atk', 'def', 'hp', 'crit', 'critMult', 'spd'];
export const STAT_GLYPH = { atk: 'atk', def: 'def', hp: 'hp', crit: 'crit', critMult: 'critMult', spd: 'spd' };

export function fmtStat(k, v, { total = false, sign = false } = {}) {
  const s = sign && v > 0 ? '+' : '';
  if (k === 'crit' || k === 'spd') return `${s}${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}%`;
  if (k === 'critMult') return total ? `×${v.toFixed(2)}` : `${s}${v.toFixed(2)}`;
  return `${s}${Math.round(v)}`;
}

export const statName = (k) => STAT_NAMES[k] || k;

export const REASON_TEXT = {
  not_enough_gold: 'ทองไม่พอ',
  inventory_full: 'กระเป๋าเต็ม',
  locked: 'ยังไม่ปลดล็อก',
  unknown_item: 'ไม่พบไอเทมนี้',
  bad_qty: 'จำนวนไม่ถูกต้อง',
  not_found: 'ไม่พบไอเทมนี้แล้ว',
  missing_resources: 'วัตถุดิบหรือทองไม่พอ',
  max_level: 'ตีบวกถึงขีดสุดแล้ว',
  weapon_required: 'ต้องถืออาวุธเสมอ เลือกอาวุธอื่นมาสวมแทนได้',
  unsellable: 'ไอเทมนี้ขายไม่ได้',
  locked: 'ไอเทมนี้ถูกล็อก ★ ไว้ ปลดล็อกก่อนจึงจะขายหรือแลกได้',
  nothing_to_sell: 'ไม่มีของที่ตรงกับที่เลือก (ของที่ล็อกไว้จะไม่ถูกขาย)',
  busy: 'กำลังดำเนินการอยู่',
  not_equipment: 'ไอเทมนี้สวมใส่ไม่ได้',
  not_enough_sparks: 'ประกายอำพันไม่พอ',
  no_bloodstone: 'ต้องมีศิลาเปลี่ยนสายเลือด (ได้จากบอส)',
  not_awakened: 'ยังไม่ได้ปลุกสายเลือด',
  already_awakened: 'ปลุกสายเลือดไปแล้ว',
  not_owned: 'ยังไม่มีสัตว์เลี้ยงตัวนี้',
  already_active: 'สัตว์เลี้ยงตัวนี้ร่วมทางอยู่แล้ว',
  team_full: 'ทีมสัตว์เลี้ยงเต็มแล้ว (3 ตัว) ให้ตัวใดตัวหนึ่งพักก่อน',
  unknown_pet: 'ไม่พบสัตว์เลี้ยงนี้',
  bad_count: 'จำนวนครั้งไม่ถูกต้อง',
  no_luck_potion: 'ไม่มียาโชคดีในกระเป๋า',
  luck_full: 'ยาโชคดีสะสมเวลาได้สูงสุด 15 นาที ดื่มอีกเมื่อเวลาเหลือน้อยลง',
};
export const reasonText = (r) => REASON_TEXT[r] || 'ทำรายการไม่สำเร็จ';

export const CATEGORY_NAME = { weapon: 'อาวุธ', armor: 'ชุดเกราะ', charm: 'เครื่องราง', wings: 'ปีก', material: 'วัตถุดิบ', consumable: 'ของใช้' };
export const itemName = (id) => (id === 'gold' ? 'ทอง' : id === 'spark' ? 'ประกายอำพัน' : getItem(id)?.name || id);

// Race stat bonuses as display lines: [label, value]
export function raceStatLines(stats) {
  const L = [];
  if (stats.hpPct) L.push(['พลังชีวิต', `${stats.hpPct > 0 ? '+' : ''}${Math.round(stats.hpPct * 100)}%`]);
  if (stats.atkPct) L.push(['พลังโจมตี', `+${Math.round(stats.atkPct * 100)}%`]);
  if (stats.defPct) L.push(['ป้องกัน', `+${Math.round(stats.defPct * 100)}%`]);
  if (stats.crit) L.push(['โอกาสคริติคอล', `+${Math.round(stats.crit * 100)}%`]);
  if (stats.critMult) L.push(['แรงคริติคอล', `+${stats.critMult.toFixed(2)}`]);
  if (stats.spd) L.push(['ความเร็ว', `${stats.spd > 0 ? '+' : ''}${Math.round(stats.spd * 100)}%`]);
  return L;
}
