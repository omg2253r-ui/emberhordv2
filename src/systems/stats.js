// Derives the player's combat stats from level + equipment. The HUD, the equipment panel
// and the battle simulation all call computeStats, so displayed stats always equal gameplay stats.
import { BALANCE } from '../config/balance.js';
import { getItem, EQUIP_SLOTS } from '../data/items.js';
import { passiveBonuses, PASSIVE_KEYS } from './skills.js';
import { raceStats, raceAbility } from './race.js';
import { petPassives } from './pets.js';
import { artifactBonuses } from './artifacts.js';
import { titleBonuses } from './titles.js';
import { attrBonuses } from './attributes.js';

const STAT_KEYS = ['atk', 'def', 'hp', 'crit', 'critMult', 'spd'];

export function upgradeMultiplier(lvl) {
  const L = Math.max(0, lvl | 0), u = BALANCE.upgrade;
  return 1 + u.statGrowthPerLevel * Math.min(10, L) + (u.statGrowthHigh ?? u.statGrowthPerLevel) * Math.max(0, L - 10);
}

// Stats of one equipment instance at its upgrade level.
export function itemStats(instance) {
  const def = instance && getItem(instance.id);
  if (!def || !def.stats) return {};
  const m = upgradeMultiplier(instance.lvl);
  const out = {};
  for (const k of STAT_KEYS) {
    if (def.stats[k] == null) continue;
    const v = def.stats[k] * m;
    out[k] = (k === 'atk' || k === 'def' || k === 'hp') ? Math.round(v) : Math.round(v * 1000) / 1000;
  }
  return out;
}

export function baseStats(level) {
  const p = BALANCE.player;
  const l = Math.max(1, level | 0) - 1;
  return {
    hp: Math.round(p.baseHp + p.hpPerLevel * l),
    atk: Math.round(p.baseAtk + p.atkPerLevel * l),
    def: Math.round(p.baseDef + p.defPerLevel * l),
    crit: p.baseCrit,
    critMult: p.baseCritMult,
    spd: 0,
  };
}

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

// Level + gear + passive skills + bloodline + active pet. Percent bonuses apply after flat ones.
export function computeStats(state) {
  const s = baseStats(state.player.level);
  for (const slot of EQUIP_SLOTS) {
    const it = itemStats(state.equipment[slot]);
    for (const k of Object.keys(it)) s[k] = (s[k] || 0) + it[k];
  }
  const pb = state.skills ? passiveBonuses(state) : Object.fromEntries(PASSIVE_KEYS.map((k) => [k, 0]));
  const rs = raceStats(state), ra = raceAbility(state);
  const pp = state.pets ? petPassives(state) : { magnet: 0, goldMult: 0, skillCd: 0, skillPower: 0, allPct: 0, perfectRefund: 0, dodgeCd: 0, spd: 0, critPct: 0, defPct: 0, thorns: 0 };
  const art = state.artifacts ? artifactBonuses(state) : null;
  const tb = titleBonuses(state);
  const ab = attrBonuses(state);   // v8.1 attribute points
  s.crit += pb.crit + rs.crit + (art?.crit || 0) + pp.critPct + tb.crit; s.spd += pb.spd + rs.spd + (art?.spd || 0) + pp.spd + tb.spd; s.critMult += rs.critMult + (art?.critMult || 0) + tb.critMult + pb.critMult;
  s.def += (art?.defFlat || 0) + ab.defFlat; s.atk += ab.atkFlat; s.hp += ab.hpFlat; s.crit += ab.crit; s.critMult += ab.critMult; s.spd += ab.spd;
  const weapon = getItem(state.equipment.weapon?.id);
  return {
    maxHp: Math.max(1, Math.round(s.hp * Math.max(0.3, 1 + pb.hpPct + rs.hpPct + pp.allPct + (art?.hpPct || 0) + tb.hpPct + ab.hpPct))),
    atk: Math.max(1, Math.round(s.atk * Math.max(0.3, 1 + rs.atkPct + pp.allPct + (art?.atkPct || 0) + tb.atkPct + pb.atkPct + ab.atkPct))),
    def: Math.max(0, Math.round(s.def * Math.max(0.2, 1 + rs.defPct + pp.allPct + pp.defPct + (art?.defPct || 0) + tb.defPct + pb.defPct))),
    crit: Math.max(0, Math.min(BALANCE.combat.critChanceCap, r3(s.crit))),
    critMult: r2(Math.max(1.1, s.critMult)),
    speed: Math.round(BALANCE.player.baseSpeed * Math.max(0.5, 1 + s.spd)),
    spdBonus: r3(s.spd),
    // dodge / traps / sustain
    dashCdMult: r2(Math.max(0.3, (1 - pb.dashCd) * (1 - (ra.dodgeCd || 0)) * (1 - pp.dodgeCd) * (1 - ab.dashCd))),
    perfectBonus: (ra.perfectBonus || 0) + pb.perfectBonus,
    trapReduce: Math.min(0.8, r3(pb.trapReduce + (ra.trapReduce || 0))),
    healOnKill: pb.healOnKill + (art?.healOnKill || 0) + (ra.healOnKill || 0),
    // artifacts
    shieldPct: (art?.shieldPct || 0) + (ra.shieldPct || 0), debuff: (art?.debuff || 0) + (ra.debuff || 0) + pb.debuff, guardPower: (art?.guard || 0) + (ra.guardPower || 0) + pb.guardPower, counterBonus: (art?.counter || 0) + (ra.counterBonus || 0) + pb.counterBonus,
    regen: (ra.regen || 0) + pb.regen,
    lowHpDef: ra.lowHpDef || 0,
    fireReduce: ra.fireReduce || 0,
    ignite: (ra.ignite || 0) + pb.ignite,
    lastStand: !!ra.lastStand || pb.lastStand > 0,
    // v8 skill passives
    lifesteal: r3(pb.lifesteal), dmgTaken: r3(Math.max(-0.5, pb.dmgTaken)), comboPct: r2(pb.comboPct), lowHpDmg: r2(pb.lowHpDmg), lowHpRegen: r3(pb.lowHpRegen),
    lowFoeDmg: r2(pb.lowFoeDmg), highFoeDmg: r2(pb.highFoeDmg), ultGain: r2(pb.ultGain),
    // economy / skills (bloodline + pet)
    goldMult: r2(1 + (ra.goldMult || 0) + pp.goldMult + tb.goldMult + pb.goldMult),
    magnetMult: r2(1 + pp.magnet + (ra.magnet || 0)),
    skillCdMult: r2(Math.max(0.4, (1 - pp.skillCd) * (1 - (ra.skillCd || 0)) * (1 - pb.skillCd) * (1 - ab.skillCd))),
    skillPower: r2(Math.max(0.5, 1 + pp.skillPower + (ra.skillPower || 0) + tb.skillPower + pb.skillPower + ab.skillPower)),
    perfectRefund: pp.perfectRefund + pb.perfectRefund,
    thorns: pp.thorns + pb.thorns,
    wtype: weapon?.wtype || 'sword',
    weaponId: weapon?.id || null,
    unique: weapon?.unique || null,
  };
}

// Simple score for comparing gear in the UI ("better/worse" arrows).
export function gearScore(stats) {
  return (stats.atk || 0) * 3 + (stats.def || 0) * 2.5 + (stats.hp || 0) * 0.35
    + (stats.crit || 0) * 120 + (stats.critMult || 0) * 40 + (stats.spd || 0) * 150;
}
