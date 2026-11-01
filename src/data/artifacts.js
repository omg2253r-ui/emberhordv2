// Artifacts (อาร์ติแฟกต์): relics that fall only in the Infinite Rift. They sit in the Cosmic Tree — a star at the
// top whose roots branch downward into slots. A slot's affinity strengthens a matching artifact by half again.
// Duplicates merge into the same artifact and raise its level (1–5, +25% effect per level).
//
// Effect keys (all go through computeStats, so the HUD always equals gameplay):
//   atkPct defPct hpPct crit critMult spd   — the usual stats (percent unless noted)
//   defFlat      — flat armour
//   shieldPct    — a shield of this share of max HP at the start of every room / wave
//   debuff       — chance on hit to sunder the enemy: it deals 20% less and moves slower for 3 s
//   guard        — the guard meter drains this much slower
//   counter      — counters hit this much harder
//   healOnKill   — share of max HP healed on a kill
export const ART_LEVEL_MAX = 5;
export const ART_LEVEL_STEP = 0.25;
export const AFFINITY_BONUS = 0.5;

export const ARTIFACTS = Object.freeze({
  ar_meteor_shard:  { id: 'ar_meteor_shard', name: 'เศษดาวตก', rarity: 'common', fx: { crit: 0.02 }, look: { shape: 'shard', a: '#ffd08a', b: '#ff8a3d' }, desc: 'ยังอุ่นอยู่ราวกับเพิ่งร่วงจากฟ้าเมื่อคืน' },
  ar_shadow_quartz: { id: 'ar_shadow_quartz', name: 'ผลึกเกราะเงา', rarity: 'common', fx: { defFlat: 8 }, look: { shape: 'prism', a: '#9a8ad0', b: '#3a3450' }, desc: 'แสงที่ผ่านเข้าไปไม่เคยออกมาอีก' },
  ar_moon_dew:      { id: 'ar_moon_dew', name: 'หยดน้ำค้างจันทร์', rarity: 'common', fx: { hpPct: 0.04 }, look: { shape: 'drop', a: '#e8f8ff', b: '#7fc0ef' }, desc: 'เก็บได้เฉพาะคืนที่จันทร์เต็มดวง' },
  ar_comet_fang:    { id: 'ar_comet_fang', name: 'เขี้ยวดาวหาง', rarity: 'uncommon', fx: { atkPct: 0.03 }, look: { shape: 'fang', a: '#bfe3ff', b: '#5fa8ec' }, desc: 'หางของมันยังลากแสงตามทุกการเหวี่ยง' },
  ar_nebula_seed:   { id: 'ar_nebula_seed', name: 'เมล็ดเนบิวลา', rarity: 'uncommon', fx: { shieldPct: 0.05 }, look: { shape: 'orb', a: '#ffb3e6', b: '#7a4ad0' }, desc: 'ห่อหุ้มผู้ถือด้วยหมอกดาวบางเบา' },
  ar_gravity_net:   { id: 'ar_gravity_net', name: 'ตาข่ายแรงโน้มถ่วง', rarity: 'uncommon', fx: { debuff: 0.06 }, look: { shape: 'ring', a: '#9fffd8', b: '#2f5a57' }, desc: 'ศัตรูที่โดนจะรู้สึกว่าร่างกายหนักขึ้นสิบเท่า' },
  ar_solar_scale:   { id: 'ar_solar_scale', name: 'เกล็ดสุริยะ', rarity: 'rare', fx: { critMult: 0.12 }, look: { shape: 'scale', a: '#fff3c4', b: '#f5b041' }, desc: 'ลอกออกมาจากผิวดวงอาทิตย์ดวงเล็ก' },
  ar_polar_vane:    { id: 'ar_polar_vane', name: 'ใบพัดดาวเหนือ', rarity: 'rare', fx: { spd: 0.04 }, look: { shape: 'star', a: '#e6fff6', b: '#5fc0a0' }, desc: 'ชี้ทางเสมอ แม้ในความมืดที่ลึกที่สุด' },
  ar_quasar_tear:   { id: 'ar_quasar_tear', name: 'น้ำตาควอซาร์', rarity: 'rare', fx: { healOnKill: 0.015 }, look: { shape: 'drop', a: '#ffffff', b: '#c27ff0' }, desc: 'ทุกการพ่ายแพ้ของศัตรูคือแสงที่ไหลกลับมาหาเรา' },
  ar_saturn_ring:   { id: 'ar_saturn_ring', name: 'โล่วงแหวนเสาร์', rarity: 'epic', fx: { shieldPct: 0.08, guard: 0.15 }, look: { shape: 'planet', a: '#f0d89a', b: '#a8743a' }, desc: 'วงแหวนหมุนรอบตัวผู้ถือ ปัดสิ่งที่พุ่งเข้ามาให้เฉียงออก' },
  ar_galaxy_compass:{ id: 'ar_galaxy_compass', name: 'เข็มทิศกาแล็กซี', rarity: 'epic', fx: { debuff: 0.08, crit: 0.02 }, look: { shape: 'spiral', a: '#bfe3ff', b: '#3f6fb8' }, desc: 'ชี้ไปยังจุดอ่อนของทุกสิ่ง' },
  ar_pulsar_heart:  { id: 'ar_pulsar_heart', name: 'หัวใจพัลซาร์', rarity: 'epic', fx: { counter: 0.15, atkPct: 0.02 }, look: { shape: 'heart', a: '#ff9a8a', b: '#c2412f' }, desc: 'เต้นเป็นจังหวะเดียวกับการสวนกลับ' },
  ar_supernova_core:{ id: 'ar_supernova_core', name: 'แกนซูเปอร์โนวา', rarity: 'legendary', fx: { atkPct: 0.06, crit: 0.03 }, look: { shape: 'nova', a: '#fff3c4', b: '#ff5a1a' }, desc: 'พลังที่เหลือจากดาวที่ระเบิดเมื่อพันล้านปีก่อน' },
  ar_blackhole_mirror:{ id: 'ar_blackhole_mirror', name: 'กระจกหลุมดำ', rarity: 'legendary', fx: { counter: 0.25, guard: 0.15 }, look: { shape: 'void', a: '#e0b0ff', b: '#120e1c' }, desc: 'ทุกสิ่งที่ส่งมา จะถูกส่งกลับไปแรงกว่าเดิม' },
  ar_cosmic_crown:  { id: 'ar_cosmic_crown', name: 'มงกุฎจักรวาล', rarity: 'mythic', fx: { atkPct: 0.05, defPct: 0.05, hpPct: 0.05, crit: 0.04 }, look: { shape: 'crown', a: '#ffffff', b: '#ff5f7a' }, desc: 'ผู้สวมไม่ได้ครองจักรวาล จักรวาลต่างหากที่เลือกผู้สวม' },
});
export const getArtifact = (id) => (Object.prototype.hasOwnProperty.call(ARTIFACTS, id) ? ARTIFACTS[id] : null);

// what kind of effect an artifact mainly gives (for slot affinity and colour)
export const FX_KIND = Object.freeze({ atkPct: 'atk', critMult: 'atk', defPct: 'def', defFlat: 'def', hpPct: 'def', crit: 'crit', debuff: 'crit', spd: 'crit', shieldPct: 'shield', guard: 'shield', counter: 'shield', healOnKill: 'def' });
export const KIND_INFO = Object.freeze({
  any: { name: 'ทุกชนิด', color: '#ffffff' }, atk: { name: 'พลังโจมตี', color: '#ff8a5a' }, def: { name: 'ความทนทาน', color: '#9fe0a0' },
  crit: { name: 'คริติคอลและดีบัฟ', color: '#c9a2f5' }, shield: { name: 'โล่และการสวนกลับ', color: '#7fc0ef' },
});

// The Cosmic Tree: a star at the top, four roots, two tips per root. x/y in a 400×420 view box.
export const TREE = Object.freeze([
  { id: 'core', x: 200, y: 72, parent: null, aff: 'any', level: 1 },
  { id: 'b_atk', x: 70, y: 190, parent: 'core', aff: 'atk', level: 8 },
  { id: 'b_def', x: 158, y: 214, parent: 'core', aff: 'def', level: 8 },
  { id: 'b_crit', x: 242, y: 214, parent: 'core', aff: 'crit', level: 8 },
  { id: 'b_shield', x: 330, y: 190, parent: 'core', aff: 'shield', level: 8 },
  { id: 'l_atk1', x: 28, y: 318, parent: 'b_atk', aff: 'atk', level: 16 }, { id: 'l_atk2', x: 78, y: 372, parent: 'b_atk', aff: 'atk', level: 20 },
  { id: 'l_def1', x: 126, y: 318, parent: 'b_def', aff: 'def', level: 16 }, { id: 'l_def2', x: 174, y: 372, parent: 'b_def', aff: 'def', level: 20 },
  { id: 'l_crit1', x: 274, y: 318, parent: 'b_crit', aff: 'crit', level: 16 }, { id: 'l_crit2', x: 226, y: 372, parent: 'b_crit', aff: 'crit', level: 20 },
  { id: 'l_shield1', x: 372, y: 318, parent: 'b_shield', aff: 'shield', level: 16 }, { id: 'l_shield2', x: 322, y: 372, parent: 'b_shield', aff: 'shield', level: 20 },
]);
export const getSlot = (id) => TREE.find((s) => s.id === id) || null;

// totals are capped so artifacts stay a boost, never the whole hero (and fair play caps still hold)
export const ART_CAPS = Object.freeze({ atkPct: 0.5, defPct: 0.5, hpPct: 0.5, crit: 0.15, critMult: 0.6, spd: 0.12, defFlat: 120, shieldPct: 0.3, debuff: 0.3, guard: 0.4, counter: 0.6, healOnKill: 0.05 });

// drop odds by rarity in the Infinite Rift (later waves shift the odds upward)
export const ART_DROP = Object.freeze({ common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 1.8, mythic: 0.2 });
