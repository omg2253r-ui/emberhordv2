// Boss armour (เกราะประจำเฟส). Replaces the old golden "invulnerable for a moment" ward: a boss now carries a pool of
// armour for every health phase (100–66%, 66–33%, 33–0%). Blows soak into the armour first; when it is gone the boss
// loses its footing (poise break, +30% damage) and the body takes the rest. Entering the next phase restores it.
// pct = share of the boss's max HP, one entry per phase. regen = seconds until the armour grows back after it is
// broken (0 = only when the next phase begins).
export const ARMOR = Object.freeze({
  land: { pct: [0.10, 0.12, 0.14], regen: 0 },                                        // land bosses (from land 3) and tower elite guardians
  raid: { pct: [0.12, 0.15, 0.18], regen: 0 },                                        // the three raid bosses
  god:  { pct: [0.08, 0.10, 0.12], regen: 5, back: 'โล่เพลิงคืนมา' },                     // Marichi's shield of fire: grows back 5 s after it breaks
});
export const armorSpec = (kind) => ARMOR[kind] || ARMOR.land;
export const armorPlan = (maxHp, kind) => armorSpec(kind).pct.map((p) => Math.max(1, Math.round(maxHp * p)));
