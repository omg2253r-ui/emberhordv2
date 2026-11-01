// Balance model (v9.1). Pure functions only — used by the offline balance pass AND by the village tier list, so what
// the tier list says is always computed from the same numbers the game plays with.
//
// A weapon's real strength is  gear stats × upgrade level × attribute points × its moveset.  This file measures all
// four together:
//   weaponIndex(id, scenario)  → damage-per-second index in the chosen mode ('farm' = packs and bosses, 'pvp' = duels)
//   SCENARIOS                  → the three build points the balance pass checks (no upgrade/no points, mid, +20/max points)
import { ITEMS } from './items.js';
import { movesetFor } from './weapons.js';
import { BALANCE } from '../config/balance.js';
import { upgradeMultiplier, baseStats } from '../systems/stats.js';
import { ATTRS, ATTR_MAX } from './attributes.js';
import { SOV, JUD, ECL, WAVE, UNIQUE_PVP_SCALE } from '../battle/uniques.js';

// ------------------------------------------------------------------ build scenarios
// attrs = { str, dex, ... } points spent. The "max" build puts every point into STR and DEX (the two damage stats).
export const SCENARIOS = Object.freeze({
  low: { id: 'low', name: 'ตีบวก +0 · ไม่ลงแต้ม', level: 20, lvl: 0, attrs: {} },
  mid: { id: 'mid', name: 'ตีบวก +10 · ลงแต้มครึ่งทาง', level: 60, lvl: 10, attrs: { str: 60, dex: 40 } },
  max: { id: 'max', name: 'ตีบวก +20 · แต้มเต็ม', level: 100, lvl: 20, attrs: { str: ATTR_MAX, dex: 147 } },
});

function attrFx(attrs) {
  const out = { atkFlat: 0, atkPct: 0, crit: 0, critMult: 0, spd: 0 };
  for (const a of ATTRS) {
    const n = attrs[a.id] || 0;
    if (!n) continue;
    for (const fx of a.fx) if (fx.k in out) out[fx.k] += fx.v * n;
  }
  return out;
}

// the hero's attack / crit at a scenario with a given weapon (armor and charm are held constant so only the weapon varies)
export function heroAt(def, sc) {
  const b = baseStats(sc.level);
  const m = upgradeMultiplier(sc.lvl);
  const ws = def.stats || {};
  const fx = attrFx(sc.attrs || {});
  const atk = (b.atk + (ws.atk || 0) * m + fx.atkFlat) * (1 + fx.atkPct);
  const crit = Math.min(BALANCE.combat.critChanceCap, b.crit + (ws.crit || 0) * m + fx.crit);
  const critMult = Math.max(1.1, b.critMult + (ws.critMult || 0) * m + fx.critMult);
  const spd = (ws.spd || 0) * m + fx.spd;
  return { atk, crit, critMult, spd, hp: (ws.hp || 0) * m, def: (ws.def || 0) * m };
}

// ------------------------------------------------------------------ moveset → damage units per second
// How much of a move's power lands on ONE target, and how much extra it gains against a pack.
function shapeFactors(hit = {}) {
  switch (hit.shape) {
    case 'proj': {
      const c = hit.count || 1, s = hit.spread || 0, hm = hit.homing || 0;
      // homing shots bend back onto the target, so a wide fan still lands most of its bolts
      const fan = (s <= 24 ? 0.85 : s <= 70 ? 0.55 : 0.28) * (hm >= 3 ? 2.4 : hm >= 1.5 ? 1.5 : 1);
      const onOne = c <= 1 ? 1 : c * Math.min(0.95, fan);
      const pack = (hit.pierce || 0) >= 3 ? 1.9 : (hit.pierce || 0) >= 1 ? 1.45 : 1.15;
      return { one: onOne, pack: Math.min(2.4, pack * (1 + Math.min(1, s / 140) * 0.6)) };
    }
    case 'arc': return { one: 1, pack: 1 + (hit.arc || 90) / 360 * 1.7 + (hit.range || 90) / 220 * 0.35 };
    case 'circle': return { one: 1, pack: 1.7 + (hit.r || 120) / 220 };
    case 'rush': return { one: 1, pack: 1.55 + Math.min(1, (hit.dist || 200) / 400) * 0.3 };
    case 'zone': return { one: 0.9, pack: 1.45 + (hit.r || 100) / 260 };
    default: return { one: 1, pack: 1.2 };
  }
}
// duels: slow, telegraphed shapes are easy to read and dodge (zones, big wind-ups), quick narrow ones land more often
function pvpLand(m) {
  const wind = m.windup || 0.1;
  let k = 1 - Math.min(0.4, Math.max(0, wind - 0.07) * 1.4);
  if (m.hit?.shape === 'zone') k *= 0.62;
  if (m.hit?.shape === 'proj') k *= (m.hit.homing ? 0.9 : 0.78);
  if (m.hit?.shape === 'rush') k *= 0.85;
  return Math.max(0.3, k);
}

const moveUnits = (m, mode) => {
  const f = shapeFactors(m.hit);
  const crit = m.forceCrit ? 1 : null;
  const hits = (m.multi || 1) * (mode === 'pvp' ? f.one * pvpLand(m) : f.one * (1 + (f.pack - 1) * 0.55));
  return { units: (m.power || 1) * hits, crit, critBonus: m.critBonus || 0, stun: m.stun || 0, slow: m.slow || 0, mark: m.mark || 0, burn: m.burn ? 1 : 0, shake: m.shake || 0 };
};

// sustained damage units per second of the weapon's combo loop, plus a charged-move burst bonus
export function moveProfile(def, mode = 'farm') {
  const ms = movesetFor(def);
  const combo = ms.combo || [];
  let units = 0, time = 0, critSum = 0, critW = 0, ctl = 0;
  combo.forEach((m, i) => {
    const u = moveUnits(m, mode);
    units += u.units;
    time += i < combo.length - 1 ? Math.max(m.windup + m.active, m.cancel || 0.3) : m.windup + m.active + m.recover + 0.12;
    critSum += u.critBonus * u.units; critW += u.units;
    ctl += (u.stun ? 0.5 : 0) + (u.slow ? 0.3 : 0) + (u.mark ? 0.25 : 0) + (u.burn ? 0.35 : 0);
  });
  const comboDps = time > 0 ? units / time : 0;
  const ch = ms.charged ? moveUnits(ms.charged, mode) : { units: 0 };
  const chTime = ms.charged ? (ms.chargeTime || 0.55) + ms.charged.windup + ms.charged.active + ms.charged.recover : 1;
  const chargedDps = chTime > 0 ? ch.units / chTime : 0;
  const dash = ms.dash ? moveUnits(ms.dash, mode) : { units: 0 };
  // players loop combo most of the time, fire the charged move on openings and the dash move out of dodges
  const dps = comboDps * 0.68 + chargedDps * 0.22 + (dash.units / ((ms.dash?.windup || 0.05) + (ms.dash?.active || 0.1) + (ms.dash?.recover || 0.25))) * 0.10;
  return { dps, comboDps, chargedDps, critBonus: critW ? critSum / critW : 0, control: ctl / Math.max(1, combo.length), cycle: time };
}

// ------------------------------------------------------------------ unique weapon powers (their numbers live in battle/uniques.js)
// Expected extra damage of each unique as a share of the plain hits, for PvE ('farm') and PvP. The PvP numbers apply the
// per-unique PvP scale, so changing a constant in uniques.js moves the weapon's rating (and its tier) with it.
export function uniqueShares() {
  const farm = {}, pvp = {};
  const critShare = (cm) => cm / (1 + 0.6 * (cm - 1));      // a forced crit vs an average hit at a typical crit rate
  const cm = 3.4;
  // sovereign: an echo every 5th hit (+ a bigger pack bonus), breath stacks (+3% each, ~7 held on average)
  for (const [mode, k, pack] of [['farm', 1, 1.2], ['pvp', UNIQUE_PVP_SCALE.sovereign, 1]]) {
    const out = mode === 'farm' ? farm : pvp;
    out.sovereign = (SOV.echo * k / SOV.every) * pack + SOV.stack * 7 * k + 0.05 * k;
    // judgment: ~2.6 brands held (+5% each) and a forced-crit burst every 5th hit
    const kj = UNIQUE_PVP_SCALE.judgment;
    const kk = mode === 'farm' ? 1 : kj;
    out.judgment = JUD.amp * 2.6 * kk + (JUD.burst * kk * critShare(cm) / JUD.max) * (mode === 'farm' ? 1.1 : 1) + 0.08 * kk;
    const ke = mode === 'farm' ? 1 : UNIQUE_PVP_SCALE.eclipse;
    out.eclipse = (ECL.burst * ke * critShare(cm) / ECL.every) * (mode === 'farm' ? 1.15 : 1) + 0.10 * ke;
    const kw = mode === 'farm' ? 1 : UNIQUE_PVP_SCALE.sunwave;
    out.sunwave = (WAVE.passive * kw / WAVE.every) * (mode === 'farm' ? 1.4 : 1) + 0.06 * kw;
  }
  return { farm, pvp };
}
const SHARES = uniqueShares();
export const UNIQUE_SHARE = { farm: SHARES.farm, pvp: SHARES.pvp };

// ------------------------------------------------------------------ type-level feel (reach, safety, mobility)
const TYPE_FEEL = Object.freeze({
  //            farm uptime   pvp uptime (closing the gap / being dodged)
  sword:      { farm: 1.00, pvp: 1.00 },
  katana:     { farm: 1.00, pvp: 1.03 },
  dagger:     { farm: 0.95, pvp: 1.00 },
  greatsword: { farm: 0.98, pvp: 0.88 },     // armoured swings are strong vs mobs, slow to land on a duelist
  staff:      { farm: 1.08, pvp: 0.92 },
  bow:        { farm: 1.10, pvp: 0.90 },
  spear:      { farm: 1.00, pvp: 1.04 },
  scythe:     { farm: 1.02, pvp: 0.96 },
  twinblades: { farm: 1.00, pvp: 1.02 },
});

// ------------------------------------------------------------------ weapon index
// Expected damage index for a weapon at a scenario. Higher = stronger. `mode` is 'farm' or 'pvp'.
export function weaponIndex(id, scenarioId = 'max', mode = 'farm') {
  const def = typeof id === 'string' ? ITEMS[id] : id;
  if (!def || def.category !== 'weapon') return 0;
  const sc = SCENARIOS[scenarioId] || SCENARIOS.max;
  const hero = heroAt(def, sc);
  const prof = moveProfile(def, mode);
  const crit = Math.min(BALANCE.combat.critChanceCap, hero.crit + prof.critBonus * 0.6);
  const critFactor = 1 + crit * (hero.critMult - 1);
  const feel = (TYPE_FEEL[def.wtype] || TYPE_FEEL.sword)[mode === 'pvp' ? 'pvp' : 'farm'];
  const speedFactor = 1 + hero.spd * 0.5;                       // movement helps landing hits more than it adds damage
  const uniq = 1 + ((mode === 'pvp' ? UNIQUE_SHARE.pvp : UNIQUE_SHARE.farm)[def.unique] || 0);
  const ctl = 1 + Math.min(0.25, prof.control * 0.12);
  // pvp damage is applied against the victim's defence: flat atk matters a little less than in PvE, crit a little more
  const base = mode === 'pvp' ? Math.pow(hero.atk, 0.92) * 3.2 : hero.atk;
  // survivability a weapon brings along (hp/def on the weapon) counts as a small share
  const bulk = 1 + (hero.hp / 900 + hero.def / 320) * 0.35;
  return base * critFactor * prof.dps * feel * speedFactor * uniq * ctl * bulk;
}

export const allWeapons = () => Object.values(ITEMS).filter((d) => d.category === 'weapon');
