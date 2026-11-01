// Skill points, learning, slotting and passive bonuses. Pure, atomic transactions like the other systems.
import { SKILLS, SKILL_SLOTS, SKILL_RESET_COST, getSkill, rankValues } from '../data/skills.js';
import { cloneState } from '../core/state.js';

export function rankOf(state, id) {
  return state.skills.ranks[id] || 0;
}

// One point per level after the first.
export function skillPoints(state) {
  const total = Math.max(0, state.player.level - 1);
  const spent = Object.values(state.skills.ranks).reduce((a, r) => a + r, 0);
  return { total, spent, free: Math.max(0, total - spent) };
}

const ZONE_NAMES = { z1: 'ทุ่งหญ้าลมกรด', z2: 'ถ้ำผลึกน้ำแข็ง', z3: 'บึงพิษ', z4: 'ซากปราสาทเงา', z5: 'ทะเลทรายเงาแดด', z6: 'ป่าเห็ดเรืองแสง', z7: 'โรงหลอมสายฟ้า', z8: 'หุบเขาลาวา', z9: 'สวนลอยฟ้า', z10: 'บัลลังก์คืนเถ้า', z11: 'เหวกระจกแตก', z12: 'บัลลังก์สุริยคราส', z13: 'สุสานสุริยะแห่งฟาโรห์' };
const RAID_NAMES = { r1: 'รังมังกรพิโรธ', r2: 'หอดาวมังกรแห่งคำพยากรณ์', r3: 'ลานพิพากษาแห่งฟากฟ้า' };

// v8: how far the hero is toward a skill's unlock (current, needed) — also used to show progress on locked cards
export function unlockProgress(state, skill) {
  const u = skill.unlock || {};
  if (u.level != null) return [state.player.level, u.level];
  if (u.flag) return [state.story.flags[u.flag] ? 1 : 0, 1];
  if (u.boss != null) return [state.stats?.bossKills || 0, u.boss];
  if (u.tower != null) return [state.tower?.best || 0, u.tower];
  if (u.zone) return [state.zones?.cleared?.[u.zone] ? 1 : 0, 1];
  if (u.raid) return [state.raids?.[u.raid]?.kills ? 1 : 0, 1];
  if (u.pvp != null) return [state.pvp?.wins || 0, u.pvp];
  return [1, 1];
}

export function isUnlocked(state, id) {
  const s = getSkill(id);
  if (!s) return false;
  const [have, need] = unlockProgress(state, s);
  return have >= need;
}

export function unlockText(skill) {
  const u = skill.unlock || {};
  if (u.flag === 'mem_thorns') return 'ปลดล็อกเมื่อความทรงจำแรกกลับมา (ด่านป่าหนาม)';
  if (u.flag === 'mem_ward') return 'ปลดล็อกเมื่อพบจดหมายของดาว (เหมืองถ่านร้าง)';
  if (u.boss != null) return `ปลดล็อกเมื่อปราบบอสครบ ${u.boss} ตัว`;
  if (u.tower != null) return `ปลดล็อกเมื่อขึ้นหอคอยขุมนรกถึงชั้น ${u.tower}`;
  if (u.zone) return `ปลดล็อกเมื่อผ่านดินแดน ${ZONE_NAMES[u.zone] || u.zone}`;
  if (u.raid) return `ปลดล็อกเมื่อผ่านดันพิเศษ ${RAID_NAMES[u.raid] || u.raid}`;
  if (u.pvp != null) return `ปลดล็อกเมื่อชนะการดวล ${u.pvp} ครั้ง`;
  return `ปลดล็อกที่เลเวล ${u.level}`;
}

export function canLearn(state, id) {
  const s = getSkill(id);
  if (!s) return { ok: false, reason: 'unknown_skill' };
  if (!isUnlocked(state, id)) return { ok: false, reason: 'skill_locked' };
  if (rankOf(state, id) >= s.maxRank) return { ok: false, reason: 'skill_max' };
  if (skillPoints(state).free <= 0) return { ok: false, reason: 'no_points' };
  return { ok: true };
}

export function learn(state, id) {
  const c = canLearn(state, id);
  if (!c.ok) return c;
  const next = cloneState(state);
  const r = (next.skills.ranks[id] || 0) + 1;
  next.skills.ranks[id] = r;
  // A newly learned active skill goes into the first empty slot automatically.
  if (r === 1 && SKILLS[id].kind === 'active' && !next.skills.slots.includes(id)) {
    const empty = next.skills.slots.indexOf(null);
    if (empty >= 0) next.skills.slots[empty] = id;
  }
  return { ok: true, state: next, rank: r };
}

export function equipSkill(state, id, slot) {
  const s = getSkill(id);
  if (!s || s.kind !== 'active') return { ok: false, reason: 'not_active' };
  if (!Number.isInteger(slot) || slot < 0 || slot >= SKILL_SLOTS) return { ok: false, reason: 'bad_slot' };
  if (rankOf(state, id) <= 0) return { ok: false, reason: 'not_learned' };
  const next = cloneState(state);
  const prev = next.skills.slots.indexOf(id);
  if (prev >= 0) next.skills.slots[prev] = next.skills.slots[slot]; // swap
  next.skills.slots[slot] = id;
  return { ok: true, state: next };
}

export function unequipSkill(state, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SKILL_SLOTS || !state.skills.slots[slot]) return { ok: false, reason: 'bad_slot' };
  const next = cloneState(state);
  next.skills.slots[slot] = null;
  return { ok: true, state: next };
}

export function resetSkills(state) {
  if (skillPoints(state).spent === 0) return { ok: false, reason: 'nothing_to_reset' };
  if (state.gold < SKILL_RESET_COST) return { ok: false, reason: 'not_enough_gold' };
  const next = cloneState(state);
  next.gold -= SKILL_RESET_COST;
  next.skills.ranks = {};
  next.skills.slots = new Array(SKILL_SLOTS).fill(null);
  return { ok: true, state: next, cost: SKILL_RESET_COST };
}

// Sum of passive effects, consumed by computeStats.
export const PASSIVE_KEYS = Object.freeze(['crit', 'hpPct', 'spd', 'dashCd', 'trapReduce', 'healOnKill', 'atkPct', 'defPct', 'critMult', 'skillPower', 'skillCd', 'ignite', 'lifesteal', 'regen',
  'dmgTaken', 'lastStand', 'goldMult', 'comboPct', 'guardPower', 'counterBonus', 'perfectBonus', 'perfectRefund', 'thorns', 'debuff', 'lowHpDmg', 'lowHpRegen', 'lowFoeDmg', 'highFoeDmg', 'ultGain']);
export function passiveBonuses(state) {
  const b = Object.fromEntries(PASSIVE_KEYS.map((k) => [k, 0]));
  for (const [id, rank] of Object.entries(state.skills.ranks)) {
    const s = getSkill(id);
    if (!s || s.kind !== 'passive' || rank <= 0) continue;
    const v = rankValues(s, rank);
    for (const k of Object.keys(b)) if (v[k] != null) b[k] += v[k];
  }
  return b;
}

// Active skills currently slotted, with their numbers, for the battle.
export function slottedSkills(state) {
  return state.skills.slots.map((id) => (id && rankOf(state, id) > 0 ? { id, rank: rankOf(state, id), skill: SKILLS[id], v: rankValues(SKILLS[id], rankOf(state, id)) } : null));
}
