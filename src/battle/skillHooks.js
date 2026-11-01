// v8 skill passives that depend on the moment of the hit (not on fixed stats): shared by every scene's playerStrike.
//   lowHpDmg   — more damage while the hero is below 40% HP (เลือดคลั่ง)
//   lowFoeDmg  — more damage to foes below 30% HP; highFoeDmg — less (or more) to foes above 70% (เพชฌฆาต)
//   comboPct   — the combo bonus grows (เซียนคอมโบ)
export function passiveStrikeMult(p, e) {
  const st = p?.stats;
  if (!st) return 1;
  let m = 1;
  if (st.lowHpDmg && p.hp < p.maxHp * 0.4) m += st.lowHpDmg;
  if (e && e.maxHp > 0 && e.hp != null) {
    const f = e.hp / e.maxHp;
    if (st.lowFoeDmg && f < 0.3) m += st.lowFoeDmg;
    if (st.highFoeDmg && f > 0.7) m += st.highFoeDmg;
  }
  return Math.max(0.5, m);
}
export const comboScale = (p) => 1 + (p?.stats?.comboPct || 0);
