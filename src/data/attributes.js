// Attribute (สเตตัส) definitions. Every level after the first gives POINTS_PER_LEVEL points to spend freely.
// Each point adds the effects listed in `fx` (keys are summed in systems/attributes.js → attrBonuses and then
// consumed by computeStats, so the camp screen always equals what happens in battle).
export const POINTS_PER_LEVEL = 3;
export const ATTR_MAX = 150;          // points in one attribute: 297 points at level 100 means you must choose
export const ATTR_RESET_BASE = 120;   // gold; the full price grows with level

export const ATTRS = Object.freeze([
  { id: 'str', name: 'พลัง', en: 'STR', glyph: 'atk', color: '#ff6a5a', desc: 'ยิ่งแกร่ง ยิ่งฟันเจ็บ',
    fx: [{ k: 'atkFlat', v: 0.6, label: 'พลังโจมตี', kind: 'flat' }, { k: 'atkPct', v: 0.0015, label: 'พลังโจมตี', kind: 'pct' }] },
  { id: 'vit', name: 'ร่างกาย', en: 'VIT', glyph: 'hp', color: '#5ad08a', desc: 'ทนทาน อึดกว่าเดิม',
    fx: [{ k: 'hpFlat', v: 6, label: 'พลังชีวิต', kind: 'flat' }, { k: 'hpPct', v: 0.002, label: 'พลังชีวิต', kind: 'pct' }, { k: 'defFlat', v: 0.3, label: 'ป้องกัน', kind: 'flat' }] },
  { id: 'dex', name: 'ความแม่น', en: 'DEX', glyph: 'crit', color: '#f2c14e', desc: 'เล็งจุดตาย ตีหนักขึ้นตอนคริติคอล',
    fx: [{ k: 'crit', v: 0.0012, label: 'โอกาสคริติคอล', kind: 'pct' }, { k: 'critMult', v: 0.004, label: 'แรงคริติคอล', kind: 'mult' }] },
  { id: 'agi', name: 'ความคล่อง', en: 'AGI', glyph: 'spd', color: '#6fd6ff', desc: 'วิ่งไว หลบถี่ขึ้น',
    fx: [{ k: 'spd', v: 0.001, label: 'ความเร็ว', kind: 'pct' }, { k: 'dashCd', v: 0.001, label: 'คูลดาวน์การหลบ', kind: 'pctDown' }] },
  { id: 'int', name: 'ปัญญา', en: 'INT', glyph: 'star', color: '#b58cff', desc: 'สกิลแรงขึ้น ใช้ได้ถี่ขึ้น',
    fx: [{ k: 'skillPower', v: 0.003, label: 'พลังสกิล', kind: 'pct' }, { k: 'skillCd', v: 0.001, label: 'คูลดาวน์สกิล', kind: 'pctDown' }] },
]);

export const ATTR_IDS = Object.freeze(ATTRS.map((a) => a.id));
export const getAttr = (id) => ATTRS.find((a) => a.id === id) || null;
export const attrResetCost = (level) => ATTR_RESET_BASE + 20 * Math.max(1, level | 0);

const trim = (x, d) => String(+x.toFixed(d));
// "+0.6", "+0.15%", "×+0.004", "-0.1%" for `n` points of one effect
export function fxText(fx, n = 1) {
  const v = fx.v * n;
  if (fx.kind === 'flat') return `+${trim(v, 1)} ${fx.label}`;
  if (fx.kind === 'mult') return `+${trim(v, 3)} ${fx.label}`;
  if (fx.kind === 'pctDown') return `-${trim(v * 100, 2)}% ${fx.label}`;
  return `+${trim(v * 100, 2)}% ${fx.label}`;
}
