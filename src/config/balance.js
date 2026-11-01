// Every tunable number lives here. Systems read from this file instead of using magic numbers.

export const BALANCE = Object.freeze({
  player: {
    baseHp: 100, hpPerLevel: 12,
    baseAtk: 6, atkPerLevel: 1.5,
    baseDef: 2, defPerLevel: 0.8,
    baseSpeed: 230,            // world px / second
    baseCrit: 0.05,
    baseCritMult: 1.5,
    maxLevel: 100,
    xpCurveBase: 40, xpCurveExp: 1.4,
    radius: 20,
  },
  combat: {
    defenseK: 30,              // damage multiplier = K / (K + def)
    variance: 0.1,             // +/- 10%
    minDamage: 1,
    critChanceCap: 0.75,
    // Weapon movesets live in data/weapons.js. comboWindow = time after a move ends in which the next tap continues the chain.
    attack: { comboWindow: 0.62, branchDelay: 0.2, chargeDelay: 0.16, dashAttackWindow: 0.28 },
    // Dodge: charges refill one at a time. A hit that lands in the first `perfectWindow` seconds of a dodge = perfect dodge.
    dash: { duration: 0.18, speedMult: 3.1, cooldown: 1.1, charges: 2, perfectWindow: 0.16, blinkDuration: 0.12, blinkSpeedMult: 3.9 },
    perfect: { slowmo: 0.55, timeScale: 0.3, empowerT: 2.5, empowerPower: 0.3 },
    // Chain hits without getting hurt; the counter resets after `resetAfter` seconds without a hit.
    combo: { resetAfter: 3, tiers: [{ at: 10, bonus: 0.05 }, { at: 25, bonus: 0.1 }, { at: 50, bonus: 0.2 }] },
    // Bosses have poise: hits wear it down (perHit × move power); at zero the boss is stunned and takes extra damage.
    poise: { max: 100, perHit: 7, regenDelay: 2.5, regenRate: 14, breakStun: 2.2, breakBonus: 0.3 },
    burn: { ticks: 4, interval: 0.5, power: 0.12 },
    hurtIFrames: 0.6,
    potion: { healPct: 0.35, cooldown: 6 },
    autoAimRange: 280,
  },
  // v9.1 ปรับให้ต่อสู้สบายขึ้นนิดนึง: ทุกมอนและบอสในเกม (เนื้อเรื่อง โซน เรด หอคอย รอยแยก) เลือดและพลังโจมตีลดลงเล็กน้อย
  // ใช้ที่เดียวใน battle/enemies.js (createEnemy) · ไม่กระทบ PvP
  pve: { monHp: 0.92, monAtk: 0.9, bossHp: 0.9, bossAtk: 0.88 },
  inventory: { capacity: 30, maxStack: 99 },
  // ขยายกระเป๋า: +5 ช่องต่อครั้ง ราคาสูงขึ้นทุกครั้งไม่มีที่สิ้นสุด (cost of the n-th expansion, n from 0)
  bag: { step: 5, base: 400, growth: 1.15, linear: 300, maxLevel: 400 },
  pickup: { magnetRadius: 90, collectRadius: 26, flySpeed: 620 },
  upgrade: {
    maxLevel: 20,
    statGrowthPerLevel: 0.12,                     // +12% of base stats per level up to +10
    statGrowthHigh: 0.08,                         // v7: +8% per level from +11 to +20
    successRate: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.22, 0.19, 0.16, 0.13, 0.11, 0.09, 0.07, 0.05, 0.04], // index = current level (v8: harder)
    downgradeFrom: 12,                            // v8: a failed attempt from +12 up drops the item one level (was +15)
    goldBase: { common: 30, uncommon: 50, rare: 80, epic: 130, legendary: 200, mythic: 320 },
    goldGrowth: 0.75,                              // cost *= 1 + L * growth (v8: was 0.6)
    // Materials by current level band. qty grows with level inside the band.
    materials: [
      { minLevel: 0, maxLevel: 3, items: [{ id: 'm_iron_shard', base: 2, perLevel: 1 }] },
      { minLevel: 4, maxLevel: 6, items: [{ id: 'm_iron_shard', base: 4, perLevel: 1 }, { id: 'm_beast_hide', base: 1, perLevel: 1 }] },
      { minLevel: 7, maxLevel: 9, items: [{ id: 'm_iron_shard', base: 6, perLevel: 1 }, { id: 'm_beast_hide', base: 3, perLevel: 1 }, { id: 'm_thorn_core', base: 1, perLevel: 0 }] },
      // v7: beyond +10 the forge needs bloodstones from bosses, then relics of the Underworld Tower's gods
      { minLevel: 10, maxLevel: 14, items: [{ id: 'm_iron_shard', base: 10, perLevel: 2 }, { id: 'm_thorn_core', base: 2, perLevel: 0 }, { id: 'm_bloodstone', base: 1, perLevel: 0 }] },
      { minLevel: 15, maxLevel: 17, items: [{ id: 'm_iron_shard', base: 20, perLevel: 3 }, { id: 'm_bloodstone', base: 2, perLevel: 0 }, { id: 'm_hell1', base: 2, perLevel: 1 }] },
      { minLevel: 18, maxLevel: 19, items: [{ id: 'm_iron_shard', base: 30, perLevel: 5 }, { id: 'm_bloodstone', base: 3, perLevel: 0 }, { id: 'm_hell3', base: 2, perLevel: 1 }] },
    ],
  },
  economy: {
    // v9.3.1: epic (purple) gear sells for 50% more (was 160)
    sellEquipBase: { common: 8, uncommon: 30, rare: 75, epic: 240, legendary: 300, mythic: 900 },
    sellUpgradeBonus: 0.5,     // sell price = base * (1 + lvl * bonus) ...
    // v9.3.1: ... PLUS this share of the forge gold it took to reach that level (one attempt per level counted; failed
    // attempts and materials are never refunded, so forging always stays a net cost: at +10 the whole sale is ~23% of
    // what a player really spends once failures are counted, ~4-5% at +20).
    sellRefundRate: 0.25,
  },
  firstClearBonusGold: 100,
  // Amber Sparks (pet summons). Boss kills give the `sparks` listed on the enemy.
  sparks: { chest: { small: 1, key: 2, rare: 3 }, loreFirst: 2, firstClear: 10 },
});

export function xpToNext(level) {
  const p = BALANCE.player;
  return Math.round(p.xpCurveBase * Math.pow(level, p.xpCurveExp));
}
