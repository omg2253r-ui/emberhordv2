// Timed buffs on the hero from pets, bloodline skills and titles' procs. One slot per kind; a new buff of the
// same kind keeps the stronger value and the longer time.
//   haste (attack speed +x) · crit (+x chance) · dmg (+x damage) · reduce (−x damage taken) · speed (+x move)
//   lifesteal (heal x of damage dealt) · regen (x of max HP per second) · burn (every hit ignites, value ignored)
export const BUFF_KINDS = Object.freeze(['haste', 'crit', 'dmg', 'reduce', 'speed', 'lifesteal', 'regen', 'burn']);
const CAP = Object.freeze({ haste: 0.8, crit: 0.5, dmg: 1, reduce: 0.75, speed: 0.6, lifesteal: 0.25, regen: 0.08, burn: 1 });

export function addBuff(p, kind, value, t) {
  if (!p || !CAP[kind] || !(t > 0)) return;
  const b = (p.buffs.timed ||= {});
  const cur = b[kind];
  if (!cur || cur.t <= 0) b[kind] = { v: value, t };
  else { cur.v = Math.max(cur.v, value); cur.t = Math.max(cur.t, t); }
}
export function buffOf(p, kind) {
  const b = p?.buffs?.timed?.[kind];
  return b && b.t > 0 ? Math.min(CAP[kind], b.v) : 0;
}
export function tickBuffs(p, dt) {
  const b = p.buffs.timed;
  if (!b) return;
  for (const k of Object.keys(b)) { b[k].t -= dt; if (b[k].t <= 0) delete b[k]; }
  const regen = buffOf(p, 'regen');
  if (regen > 0 && !p.dead && p.hp < p.maxHp) {
    p.regenAcc = (p.regenAcc || 0) + p.maxHp * regen * dt;
    if (p.regenAcc >= 1) { const n = Math.floor(p.regenAcc); p.regenAcc -= n; p.hp = Math.min(p.maxHp, p.hp + n); }
  }
}
// icons for the HUD buff row
export const BUFF_ICONS = Object.freeze({ haste: 'dash', crit: 'crit', dmg: 'sword', reduce: 'def', speed: 'dash', lifesteal: 'blood', regen: 'potion', burn: 'ward' });
export function activeBuffs(p) { return Object.keys(p?.buffs?.timed || {}).filter((k) => buffOf(p, k) > 0 || (k === 'burn' && p.buffs.timed[k].t > 0)); }
