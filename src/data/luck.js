// Luck Potion (ยาโชคดี): while it lasts, luck counts double. It is real time (it keeps running in camp, the
// village and every dungeon), drinking another one while it is active adds time up to MAX_MS.
export const LUCK = Object.freeze({
  itemId: 'p_luck',
  price: 25000,                // gold, in the camp shop
  mult: 2,                     // luck multiplier
  durationMs: 5 * 60 * 1000,   // one potion
  maxMs: 15 * 60 * 1000,       // most time that can be stored at once
});
