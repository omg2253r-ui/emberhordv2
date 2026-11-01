// Drop tables: validation, rolling and odds display.
import { getItem } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';

// Returns an array of human-readable problems. Empty array = valid.
export function validateDropTable(drops, label = 'table') {
  const errors = [];
  if (!Array.isArray(drops)) return [`${label}: drops must be an array`];
  drops.forEach((roll, i) => {
    const where = `${label}[${i}]`;
    if (typeof roll.chance !== 'number' || !(roll.chance >= 0 && roll.chance <= 1)) errors.push(`${where}: chance must be within 0..1`);
    if (!Array.isArray(roll.entries) || roll.entries.length === 0) { errors.push(`${where}: needs at least one entry`); return; }
    let total = 0;
    roll.entries.forEach((e, j) => {
      const w = `${where}.entries[${j}]`;
      if (!getItem(e.id)) errors.push(`${w}: unknown item id "${e.id}"`);
      if (!(typeof e.weight === 'number' && e.weight > 0)) errors.push(`${w}: weight must be > 0`);
      else total += e.weight;
      const q = e.qty || [1, 1];
      if (!(Number.isInteger(q[0]) && Number.isInteger(q[1]) && q[0] >= 1 && q[1] >= q[0])) errors.push(`${w}: qty must be [min>=1, max>=min]`);
    });
    // Normalised entry probabilities must sum to exactly 1 (within float error).
    const sum = roll.entries.reduce((a, e) => a + (e.weight > 0 ? e.weight / total : 0), 0);
    if (total > 0 && Math.abs(sum - 1) > 1e-9) errors.push(`${where}: probabilities sum to ${sum}`);
  });
  return errors;
}

// luck > 1 (Luck Potion): every roll's chance is multiplied (capped at 100%) and rare-or-better entries weigh
// `luck` times more inside their roll, so you get drops more often and the drops are better.
const entryWeight = (e, luck) => (luck > 1 && rarityOf(getItem(e.id)?.rarity).order >= 2 ? e.weight * luck : e.weight);

export function rollDrops(drops, rng, luck = 1) {
  const out = [];
  for (const roll of drops) {
    if (rng.next() >= Math.min(1, roll.chance * (luck > 1 ? luck : 1))) continue;
    const total = roll.entries.reduce((a, e) => a + entryWeight(e, luck), 0);
    let r = rng.next() * total;
    let picked = roll.entries[roll.entries.length - 1];
    for (const e of roll.entries) { r -= entryWeight(e, luck); if (r < 0) { picked = e; break; } }
    const [mn, mx] = picked.qty || [1, 1];
    out.push({ id: picked.id, qty: mn + Math.floor(rng.next() * (mx - mn + 1)) });
  }
  return out;
}

export function rollGold([min, max], rng) {
  return min + Math.floor(rng.next() * (max - min + 1));
}

// Probability that at least one of each item drops from one kill.
export function dropOdds(drops) {
  const miss = new Map();
  for (const roll of drops) {
    const total = roll.entries.reduce((a, e) => a + e.weight, 0);
    for (const e of roll.entries) {
      const p = roll.chance * (e.weight / total);
      miss.set(e.id, (miss.has(e.id) ? miss.get(e.id) : 1) * (1 - p));
    }
  }
  return [...miss.entries()].map(([id, m]) => ({ id, chance: 1 - m }));
}
