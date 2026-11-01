// Illustrated skill icons (64×64 SVG): an element-coloured emblem with the skill's motif drawn in light over it,
// ink outlines like the rest of the game's art. Every skill gets its own picture from { m: motif, n: variant }.
import { EL } from '../battle/skillVfx.js';

const INK = '#141022';
const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(null, i, { length: n }));
const W = (body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}${body}</svg>`;
const ST = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;

function rays(n, r0, r1, col, w = 2.4, rot = 0) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    s += `<line x1="${(32 + Math.cos(a) * r0).toFixed(1)}" y1="${(32 + Math.sin(a) * r0).toFixed(1)}" x2="${(32 + Math.cos(a) * r1).toFixed(1)}" y2="${(32 + Math.sin(a) * r1).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return s;
}
function star(cx, cy, n, r0, r1, rot = -Math.PI / 2) {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r0 : r1; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `; }
  return d + 'Z';
}

// the motif for each kind of skill (c = element colours, n = variant)
const MOTIF = {
  nova: (c, n) => `${rays(n + 6, 12, 24, c.core, 2.6)}<circle cx="32" cy="32" r="9" fill="${c.core}" ${ST}/><circle cx="32" cy="32" r="20" fill="none" stroke="${c.core}" stroke-width="2" stroke-dasharray="4 3"/>`,
  ring: (c, n) => `${[22, 16, 10].map((r, i) => `<circle cx="32" cy="32" r="${r}" fill="none" stroke="${i ? c.glow : c.core}" stroke-width="${3 - i * 0.6}"/>`).join('')}<path d="${star(32, 32, 4, 3, 8)}" fill="${c.core}" ${ST}/>${rays(n, 24, 28, c.core, 2)}`,
  slam: (c, n) => `<path d="M14 46 L50 46" stroke="${c.core}" stroke-width="3"/><path d="M32 46 L24 56 M32 46 L40 56 M32 46 L32 58 M32 46 L18 52 M32 46 L46 52" stroke="${c.glow}" stroke-width="2"/><path d="M24 16 L40 16 L42 30 L36 40 L28 40 L22 30 Z" fill="${c.core}" ${ST}/><path d="M28 22 L36 22 M27 28 L37 28" stroke="${INK}" stroke-width="1.6"/>${n > 5 ? `<path d="M30 8 L34 8 L33 14 L31 14 Z" fill="${c.glow}"/>` : ''}`,
  whirl: (c) => `<path d="M32 10 A22 22 0 1 1 10 32" fill="none" stroke="${c.core}" stroke-width="4" stroke-linecap="round"/><path d="M32 18 A14 14 0 1 1 18 32" fill="none" stroke="${c.glow}" stroke-width="3" stroke-linecap="round"/><path d="M10 32 L5 26 L15 25 Z" fill="${c.core}" ${ST}/><path d="M27 37 L40 24 L43 27 L30 40 Z" fill="${c.core}" ${ST}/>`,
  dash: (c, n) => `${[0, 1, 2].map((i) => `<path d="M${10 + i * 2} ${22 + i * 10} L${30 + i * 2} ${22 + i * 10}" stroke="${c.glow}" stroke-width="${3 - i * 0.5}" stroke-linecap="round" opacity="${1 - i * 0.2}"/>`).join('')}<path d="M30 18 L52 32 L30 46 L36 32 Z" fill="${c.core}" ${ST}/>${n > 4 ? `<path d="M22 18 L34 32 L22 46" fill="none" stroke="${c.core}" stroke-width="2.4"/>` : ''}`,
  blink: (c, n) => `<circle cx="22" cy="34" r="10" fill="none" stroke="${c.glow}" stroke-width="2" stroke-dasharray="3 3"/><path d="M22 26 Q26 30 22 34 Q18 38 22 42" fill="none" stroke="${c.glow}" stroke-width="2"/><path d="M40 16 L46 22 L30 44 L24 46 L26 40 Z" fill="${c.core}" ${ST}/>${rays(n, 6, 10, c.core, 2).replace(/32/g, '44')}`,
  leap: (c) => `<path d="M12 50 Q32 2 52 50" fill="none" stroke="${c.glow}" stroke-width="2.6" stroke-dasharray="5 4"/><circle cx="32" cy="16" r="6" fill="${c.core}" ${ST}/><path d="M18 52 L46 52" stroke="${c.core}" stroke-width="3"/><path d="M32 52 L26 58 M32 52 L38 58" stroke="${c.core}" stroke-width="2"/>`,
  volley: (c, n) => `${range(Math.min(7, Math.max(3, Math.round(n / 2) + 2)) , (_, i, a) => { const ang = -0.6 + (1.2 * i) / (a.length - 1); const x2 = 32 + Math.cos(ang - Math.PI / 2) * 24, y2 = 34 + Math.sin(ang - Math.PI / 2) * 24; return `<path d="M32 50 L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c.core}" stroke-width="2.2"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3" fill="${c.core}" ${ST}/>`; }).join('')}<circle cx="32" cy="50" r="5" fill="${c.glow}" ${ST}/>`,
  orb: (c, n) => `${range(Math.max(2, Math.min(5, n)) , (_, i, a) => { const ang = (i / a.length) * Math.PI * 2; return `<circle cx="${(32 + Math.cos(ang) * 15).toFixed(1)}" cy="${(32 + Math.sin(ang) * 15).toFixed(1)}" r="6" fill="${c.core}" ${ST}/>`; }).join('')}<circle cx="32" cy="32" r="5" fill="${c.glow}"/>`,
  crescent: (c, n) => `<path d="M16 50 A26 26 0 0 1 48 14 A20 20 0 0 0 16 50 Z" fill="${c.core}" ${ST}/>${n > 1 ? `<path d="M10 40 A22 22 0 0 1 36 10" fill="none" stroke="${c.glow}" stroke-width="2.4"/>` : ''}${n > 2 ? `<path d="M26 56 A22 22 0 0 0 54 26" fill="none" stroke="${c.glow}" stroke-width="2.4"/>` : ''}`,
  beam: (c, n) => `<rect x="8" y="27" width="48" height="10" rx="5" fill="${c.glow}" opacity="0.8"/><rect x="8" y="30" width="48" height="4" rx="2" fill="${c.core}"/><circle cx="12" cy="32" r="8" fill="${c.core}" ${ST}/>${n > 2 ? `<rect x="8" y="14" width="40" height="4" rx="2" fill="${c.core}" transform="rotate(-14 12 32)"/><rect x="8" y="46" width="40" height="4" rx="2" fill="${c.core}" transform="rotate(14 12 32)"/>` : ''}`,
  meteor: (c, n) => `${Array.from({ length: Math.min(4, Math.max(1, Math.round(n / 3))) }, (_, i) => { const x = 40 - i * 9, y = 36 - i * 7; return `<path d="M${x} ${y} L${x + 18} ${y - 22}" stroke="${c.glow}" stroke-width="${6 - i}" stroke-linecap="round" opacity="0.8"/><circle cx="${x}" cy="${y}" r="${7 - i}" fill="${c.core}" ${ST}/>`; }).join('')}<path d="M10 54 Q32 46 54 54" fill="none" stroke="${c.core}" stroke-width="2.4"/>`,
  pillar: (c, n) => `${range(Math.max(1, Math.min(3, n)) , (_, i, a) => { const x = 32 + (i - (a.length - 1) / 2) * 14; return `<rect x="${x - 4}" y="6" width="8" height="44" rx="3" fill="${c.core}" ${ST}/><ellipse cx="${x}" cy="52" rx="9" ry="3.5" fill="${c.glow}"/>`; }).join('')}`,
  storm: (c, n) => `<path d="M14 26 Q14 14 26 16 Q30 8 40 12 Q52 12 50 24 Q56 30 46 32 L18 32 Q8 30 14 26 Z" fill="${c.core}" ${ST}/><path d="M28 34 L22 46 L30 44 L26 56" fill="none" stroke="${c.glow}" stroke-width="3" stroke-linejoin="round"/>${n > 3 ? `<path d="M42 34 L38 42 L44 41 L41 50" fill="none" stroke="${c.glow}" stroke-width="2.4"/>` : ''}`,
  cone: (c, n) => `<path d="M10 32 L54 12 Q58 32 54 52 Z" fill="${c.glow}" opacity="0.85" ${ST}/><path d="M10 32 L48 22 Q50 32 48 42 Z" fill="${c.core}"/>${rays(Math.max(2, n), 0, 0, c.core)}<circle cx="10" cy="32" r="5" fill="${c.core}" ${ST}/>`,
  chain: (c, n) => `${range(Math.min(5, Math.max(3, n)) , (_, i, a) => { const x = 10 + (i * 44) / (a.length - 1), y = 32 + (i % 2 ? -12 : 12); return `<circle cx="${x}" cy="${y}" r="5" fill="${c.core}" ${ST}/>`; }).join('')}<path d="M10 44 L21 20 L32 44 L43 20 L54 44" fill="none" stroke="${c.glow}" stroke-width="2.6" stroke-linejoin="round"/>`,
  field: (c, n) => `<ellipse cx="32" cy="40" rx="24" ry="12" fill="${c.glow}" opacity="0.55" ${ST}/><ellipse cx="32" cy="40" rx="15" ry="7" fill="none" stroke="${c.core}" stroke-width="2" stroke-dasharray="4 3"/>${Array.from({ length: 4 + (n % 3) }, (_, i) => `<circle cx="${18 + i * 7}" cy="${30 - (i % 2) * 8}" r="2.4" fill="${c.core}"/>`).join('')}<path d="M32 12 L35 22 L32 30 L29 22 Z" fill="${c.core}" ${ST}/>`,
  vortex: (c) => `<path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16 a20 20 0 1 1 -20 -20" fill="none" stroke="${c.core}" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="${INK}"/>`,
  buff: (c, n) => (BUFF[n] || BUFF[0])(c),
  clock: (c) => `<circle cx="32" cy="32" r="21" fill="${c.core}" ${ST}/><path d="M32 18 L32 32 L42 38" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M48 12 L54 18 M10 18 L16 12" stroke="${c.glow}" stroke-width="3" stroke-linecap="round"/>${rays(12, 17, 20, INK, 1.6)}`,
  shield: (c, n) => `<path d="M32 8 L52 16 Q52 42 32 56 Q12 42 12 16 Z" fill="${c.core}" ${ST}/><path d="M32 15 L45 20 Q45 39 32 49 Z" fill="${c.glow}" opacity="0.8"/>${n > 3 ? `<path d="M22 24 L42 40 M42 24 L22 40" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>` : ''}`,
  heal: (c, n) => `<path d="M32 52 C10 38 10 18 24 16 C29 16 32 20 32 22 C32 20 35 16 40 16 C54 18 54 38 32 52 Z" fill="${c.core}" ${ST}/><path d="M32 26 L32 42 M24 34 L40 34" stroke="${c.deep}" stroke-width="4" stroke-linecap="round"/>${n > 4 ? rays(6, 25, 29, c.glow, 2) : ''}`,
  counter: (c, n) => `<path d="M14 14 L50 50" stroke="${c.core}" stroke-width="5" stroke-linecap="round"/><path d="M50 14 L14 50" stroke="${c.glow}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="32" r="7" fill="${c.core}" ${ST}/>${n > 3 ? rays(8, 20, 26, c.core, 2) : ''}`,
  orbit: (c, n) => `<circle cx="32" cy="32" r="18" fill="none" stroke="${c.glow}" stroke-width="2" stroke-dasharray="5 4"/>${range(Math.max(3, Math.min(4, n)) , (_, i, a) => { const ang = (i / a.length) * Math.PI * 2; const x = 32 + Math.cos(ang) * 18, y = 32 + Math.sin(ang) * 18; return `<path d="M${x.toFixed(1)} ${(y - 7).toFixed(1)} L${(x + 3).toFixed(1)} ${(y + 4).toFixed(1)} L${(x - 3).toFixed(1)} ${(y + 4).toFixed(1)} Z" fill="${c.core}" ${ST} transform="rotate(${(ang * 180 / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('')}<circle cx="32" cy="32" r="6" fill="${c.core}" ${ST}/>`,
  totem: (c) => `<path d="M24 56 L26 16 L38 16 L40 56 Z" fill="${c.deep}" ${ST}/><rect x="21" y="30" width="22" height="7" fill="${c.glow}" ${ST}/><circle cx="32" cy="12" r="7" fill="${c.core}" ${ST}/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<line x1="${(32 + Math.cos(a) * 9).toFixed(1)}" y1="${(12 + Math.sin(a) * 9).toFixed(1)}" x2="${(32 + Math.cos(a) * 13).toFixed(1)}" y2="${(12 + Math.sin(a) * 13).toFixed(1)}" stroke="${c.core}" stroke-width="2" stroke-linecap="round"/>`; }).join('')}`,
  clone: (c) => `<circle cx="22" cy="18" r="6" fill="${c.glow}" opacity="0.7"/><path d="M14 54 L16 28 L28 28 L30 54 Z" fill="${c.glow}" opacity="0.7"/><circle cx="40" cy="18" r="7" fill="${c.core}" ${ST}/><path d="M31 54 L33 28 L47 28 L49 54 Z" fill="${c.core}" ${ST}/>`,
  flurry: (c, n) => `${Array.from({ length: Math.min(5, Math.max(3, Math.round(n / 2))) }, (_, i) => `<path d="M${12 + i * 3} ${46 - i * 6} L${50 - i * 2} ${16 + i * 5}" stroke="${i % 2 ? c.glow : c.core}" stroke-width="${3.6 - i * 0.4}" stroke-linecap="round"/>`).join('')}`,
  spikes: (c, n) => `${Array.from({ length: 4 }, (_, i) => { const x = 12 + i * 13, h = 18 + ((i + n) % 3) * 8; return `<path d="M${x - 5} 54 L${x} ${54 - h} L${x + 5} 54 Z" fill="${i % 2 ? c.glow : c.core}" ${ST}/>`; }).join('')}<path d="M6 54 L58 54" stroke="${c.core}" stroke-width="2.4"/>`,
  wave: (c) => `<path d="M6 46 Q16 18 32 26 Q22 30 26 40 Q36 30 46 34 Q56 38 58 46 Z" fill="${c.core}" ${ST}/><path d="M10 52 Q32 44 54 52" fill="none" stroke="${c.glow}" stroke-width="2.4"/>`,
  hook: (c) => `<path d="M12 12 L36 36" stroke="${c.core}" stroke-width="3" stroke-dasharray="4 3"/><path d="M36 36 Q50 36 50 48 Q50 56 42 56 Q36 56 36 50" fill="none" stroke="${c.core}" stroke-width="4" stroke-linecap="round"/><path d="M36 50 L32 44 L40 46 Z" fill="${c.core}" ${ST}/>`,
  trap: (c, n) => `<ellipse cx="32" cy="40" rx="20" ry="9" fill="${c.deep}" ${ST}/><path d="${star(32, 40, 5, 4, 12)}" fill="${c.glow}" ${ST}/>${Array.from({ length: n + 3 }, (_, i) => { const a = -Math.PI + (i / (n + 2)) * Math.PI; return `<line x1="${(32 + Math.cos(a) * 14).toFixed(1)}" y1="${(30 + Math.sin(a) * 10).toFixed(1)}" x2="${(32 + Math.cos(a) * 22).toFixed(1)}" y2="${(30 + Math.sin(a) * 16).toFixed(1)}" stroke="${c.core}" stroke-width="2" stroke-linecap="round"/>`; }).join('')}`,
  mark: (c, n) => `<circle cx="32" cy="32" r="18" fill="none" stroke="${c.core}" stroke-width="3"/><circle cx="32" cy="32" r="5" fill="${c.core}"/>${rays(4, 10, 26, c.core, 3, Math.PI / 4)}${n > 1 ? `<circle cx="32" cy="32" r="24" fill="none" stroke="${c.glow}" stroke-width="1.6" stroke-dasharray="3 3"/>` : ''}`,
  execute: (c, n) => `<path d="M14 50 L44 12 L52 12 L52 20 L20 52 Z" fill="${c.core}" ${ST}/><path d="M12 44 L22 54" stroke="${INK}" stroke-width="3"/><path d="M8 54 L14 48" stroke="${c.deep}" stroke-width="5" stroke-linecap="round"/>${n > 2 ? `<path d="${star(46, 46, 4, 3, 9)}" fill="${c.glow}" ${ST}/>` : ''}`,
};

// buffs: a different emblem for each
const BUFF = {
  0: (c) => `<path d="${star(32, 32, 5, 9, 22)}" fill="${c.core}" ${ST}/>`,
  1: (c) => `<path d="M32 12 C40 24 46 30 46 40 A14 14 0 0 1 18 40 C18 30 24 24 32 12 Z" fill="${c.core}" ${ST}/><path d="M20 18 L14 8 L24 14 M44 18 L50 8 L40 14" fill="${c.glow}" ${ST}/><path d="M26 40 L30 44 L38 34" fill="none" stroke="${c.deep}" stroke-width="3"/>`,
  2: (c) => `<path d="M8 32 Q32 12 56 32 Q32 52 8 32 Z" fill="${c.core}" ${ST}/><circle cx="32" cy="32" r="8" fill="${c.deep}" ${ST}/><path d="M32 18 L32 46 M18 32 L46 32" stroke="${c.glow}" stroke-width="1.6"/>`,
  3: (c) => `<path d="M16 12 L48 12 L48 40 Q48 50 32 56 Q16 50 16 40 Z" fill="${c.core}" ${ST}/>${[[22, 18], [42, 18], [22, 44], [42, 44], [32, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${c.deep}"/>`).join('')}`,
  4: (c) => `<path d="M18 50 L18 22 L30 22 L30 40 L46 44 L46 50 Z" fill="${c.core}" ${ST}/><path d="M30 24 Q44 14 54 18 Q46 22 44 28 Q38 26 30 30 Z" fill="${c.glow}" ${ST}/>`,
  6: (c) => `<path d="M32 26 L36 34 L32 44 L28 34 Z" fill="${c.core}" ${ST}/><path d="M28 30 Q16 18 6 26 Q12 30 12 36 Q18 32 24 38 Z M36 30 Q48 18 58 26 Q52 30 52 36 Q46 32 40 38 Z" fill="${c.core}" ${ST}/>`,
  7: (c) => `<path d="M14 40 L22 40 L40 52 L40 12 L22 24 L14 24 Z" fill="${c.core}" ${ST}/><path d="M46 22 Q52 32 46 42 M50 16 Q60 32 50 48" fill="none" stroke="${c.glow}" stroke-width="2.6" stroke-linecap="round"/>`,
  8: (c) => `<path d="M30 54 L30 22 L32 10 L34 22 L34 54 Z" fill="${c.core}" ${ST}/><rect x="24" y="44" width="16" height="4" fill="${c.deep}" ${ST}/><path d="M26 30 Q22 22 28 16 Q28 22 32 24 Q34 16 40 14 Q36 22 38 30" fill="${c.glow}" ${ST}/>`,
};

// passives: each one has its own emblem
const PAS = {
  1: 'M32 10 L36 26 L54 30 L36 34 L32 54 L28 34 L10 30 L28 26 Z',                     // glass cannon (burst)
  2: 'M12 40 Q12 18 32 14 Q52 18 52 40 Q32 50 12 40 Z M20 36 L44 36 M24 28 L40 28',         // shell
  3: 'M32 54 C14 40 12 22 24 16 C28 14 32 18 32 22 C32 18 36 14 40 16 C52 22 50 40 32 54 Z M26 30 L38 30',  // blood heart
  4: 'M16 48 L48 16 M40 16 L48 16 L48 24',                                                // dagger strike
  5: 'M32 12 C44 12 50 22 50 30 C50 40 42 44 38 44 L38 52 L26 52 L26 44 C22 44 14 40 14 30 C14 22 20 12 32 12 Z', // mind
  6: 'M20 12 L44 12 L32 30 L44 52 L20 52 L32 30 Z',                                      // hourglass
  7: 'M32 54 C18 50 16 36 24 26 C24 32 28 34 30 34 C26 24 32 14 38 10 C38 20 48 24 46 38 C46 48 40 54 32 54 Z', // ember
  8: 'M18 20 L26 44 L30 24 L34 24 L38 44 L46 20 Z',                                     // fangs
  9: 'M32 52 L32 22 M32 32 C24 32 20 24 22 16 C28 16 32 22 32 32 M32 40 C40 40 44 32 42 24 C36 24 32 30 32 40', // sprout
  10: 'M14 40 L30 40 L36 28 L50 28 M24 48 L40 48 M18 32 L28 32',                          // swift
  11: 'M20 14 L44 14 L44 34 Q44 48 32 54 Q20 48 20 34 Z M26 26 L38 26',                   // will
  12: 'M32 10 C20 22 20 34 32 54 C44 34 44 22 32 10 Z M32 22 L32 38',                    // last breath (flame)
  13: 'M32 14 m-14 0 a14 6 0 1 0 28 0 a14 6 0 1 0 -28 0 M18 14 L18 46 a14 6 0 0 0 28 0 L46 14', // coins
  14: 'M12 44 L22 24 L32 40 L42 18 L52 36',                                              // combo zigzag
  15: 'M14 50 L50 14 M50 50 L14 14 M24 14 L14 14 L14 24',                                // parry
  16: 'M20 50 Q14 30 30 22 Q40 18 44 10 M30 50 Q30 38 42 32 Q50 28 52 20',              // dance
  17: 'M18 30 L46 30 L46 46 Q32 54 18 46 Z M22 30 L22 20 M30 30 L30 16 M38 30 L38 18 M46 30 L46 22', // fist
  18: 'M32 12 L36 26 L50 22 L40 32 L50 42 L36 38 L32 52 L28 38 L14 42 L24 32 L14 22 L28 26 Z', // thorns
  19: 'M22 12 L42 12 L42 54 L22 54 Z M28 8 L36 8 M26 40 L38 40 M26 30 L38 30 M26 20 L38 20', // battery
  20: 'M14 32 Q32 12 50 32 Q32 52 14 32 Z M32 26 L32 38',                                // bloodlust eye
  21: 'M14 50 L22 18 L32 26 L42 14 L50 50 Z',                                            // stone
  22: 'M14 22 L50 22 L50 46 L14 46 Z M24 30 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M40 38 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', // dice
  23: 'M10 32 Q32 12 54 32 Q32 52 10 32 Z M32 24 L32 40 M24 32 L40 32',                  // hunter eye
  24: 'M32 52 C22 46 16 36 20 24 C24 30 28 30 30 28 C26 20 30 12 36 8 C36 16 44 20 44 30 C50 26 50 20 48 16 C56 28 50 46 32 52 Z', // phoenix
  25: 'M16 16 L48 48 M32 10 L32 22 M10 32 L22 32 M42 32 L54 32',                        // executioner
  26: 'M32 10 L36 28 L54 32 L36 36 L32 54 L28 36 L10 32 L28 28 Z M32 22 L32 42',         // resonance
  30: 'M10 32 Q32 14 54 32 Q32 50 10 32 Z',                                               // hawk eye
  31: 'M32 52 C16 40 14 24 26 18 C30 18 32 22 32 24 C32 22 34 18 38 18 C50 24 48 40 32 52 Z', // hunter blood
  32: 'M12 26 Q32 16 52 26 M12 36 Q32 26 52 36 M12 46 Q32 36 52 46',                      // wind step
  33: 'M16 16 L48 16 L48 48 L16 48 Z M16 30 L48 30 M30 16 L30 48',                        // thick hide
};

const LINE_PAS = new Set([4, 10, 14, 15, 16, 25, 32]);

export function skillIconSvg(skill) {
  const c = EL[skill?.el] || EL.fire;
  const m = skill?.art?.m || 'nova', n = skill?.art?.n || 1;
  const id = `g${(skill?.id || 'x').replace(/[^a-z0-9]/gi, '')}`;
  const defs = `<defs><radialGradient id="${id}" cx="0.42" cy="0.36" r="0.75"><stop offset="0" stop-color="${c.glow}"/><stop offset="0.55" stop-color="${c.deep}"/><stop offset="1" stop-color="#0b0e1c"/></radialGradient></defs>`;
  const back = `<clipPath id="${id}c"><circle cx="32" cy="32" r="29.5"/></clipPath><circle cx="32" cy="32" r="30" fill="url(#${id})"/><circle cx="32" cy="32" r="28.5" fill="none" stroke="${c.core}" stroke-opacity="0.35" stroke-width="1.2"/>`;
  let body;
  if (m === 'pas') body = LINE_PAS.has(n)
    ? `<path d="${PAS[n]}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${PAS[n]}" fill="none" stroke="${c.core}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${PAS[n] || PAS[1]}" fill="${c.core}" fill-opacity="0.92" fill-rule="evenodd" ${ST}/>`;
  else body = (MOTIF[m] || MOTIF.nova)(c, n);
  return W(`${back}<g clip-path="url(#${id}c)">${body}</g>`, defs);
}

// ultimate emblems: the picture follows the ultimate's signature (a dragon, a phoenix, a falling blade …)
const SIG = {
  dragon: (c) => `<path d="M10 46 C18 30 30 50 38 36 C44 26 40 18 48 14" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M10 46 C18 30 30 50 38 36 C44 26 40 18 48 14" fill="none" stroke="${c.core}" stroke-width="5.5" stroke-linecap="round"/><path d="M44 10 L56 14 L48 20 Z" fill="${c.glow}" ${ST}/><path d="M46 12 L40 4 M50 11 L48 3" stroke="${c.core}" stroke-width="2"/><circle cx="50" cy="14" r="1.6" fill="${INK}"/>`,
  phoenix: (c) => `<path d="M32 40 C22 30 10 30 6 18 C16 22 24 22 30 30 C30 20 34 14 32 6 C38 14 38 22 34 30 C40 22 48 22 58 18 C54 30 42 30 32 40 Z" fill="${c.core}" ${ST}/><path d="M32 40 C30 48 26 54 20 58 M32 40 C34 48 38 54 44 58 M32 40 L32 58" stroke="${c.glow}" stroke-width="2.4" fill="none"/>`,
  bigblade: (c) => `<path d="M32 58 L26 46 L27 14 L37 14 L38 46 Z" fill="#f2f6ff" ${ST}/><path d="M32 52 L32 16" stroke="${c.glow}" stroke-width="2"/><path d="M16 14 Q32 8 48 14 L46 18 Q32 13 18 18 Z" fill="${c.deep}" ${ST}/><rect x="29" y="2" width="6" height="12" fill="#3a2a40" ${ST}/>`,
  moon: (c) => `<path d="M40 8 A24 24 0 1 0 40 56 A18 18 0 1 1 40 8 Z" fill="${c.core}" ${ST}/><circle cx="22" cy="24" r="2.5" fill="${c.glow}"/><circle cx="18" cy="36" r="3" fill="${c.glow}"/>`,
  sun: (c) => `${rays(12, 16, 27, c.glow, 3)}<circle cx="32" cy="32" r="13" fill="${c.core}" ${ST}/>`,
  lotus: (c) => `${[-60, -30, 0, 30, 60].map((a) => `<path d="M32 48 Q${32 + Math.sin(a * Math.PI / 180) * 26} ${34 - Math.cos(a * Math.PI / 180) * 16} 32 ${48 - 30 * Math.cos(a * Math.PI / 360)}" fill="${c.core}" ${ST} transform="rotate(${a} 32 48)"/>`).join('')}<ellipse cx="32" cy="50" rx="20" ry="4" fill="${c.glow}"/>`,
  wolves: (c) => `<path d="M14 44 L20 16 L28 28 L36 28 L44 16 L50 44 L40 54 L24 54 Z" fill="${c.core}" ${ST}/><path d="M24 38 L28 40 M40 38 L36 40" stroke="${INK}" stroke-width="2.6"/><path d="M28 48 L32 51 L36 48" fill="none" stroke="${INK}" stroke-width="2"/>`,
  hammer: (c) => `<rect x="10" y="10" width="34" height="18" rx="3" fill="${c.core}" ${ST} transform="rotate(-30 27 19)"/><path d="M30 26 L48 56" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M30 26 L48 56" stroke="#8a6a4a" stroke-width="4.5" stroke-linecap="round"/>`,
  chains: (c) => `${[0, 1, 2, 3].map((i) => `<ellipse cx="${14 + i * 12}" cy="${46 - i * 10}" rx="8" ry="5" fill="none" stroke="${INK}" stroke-width="6" transform="rotate(-40 ${14 + i * 12} ${46 - i * 10})"/><ellipse cx="${14 + i * 12}" cy="${46 - i * 10}" rx="8" ry="5" fill="none" stroke="${i % 2 ? c.glow : c.core}" stroke-width="3" transform="rotate(-40 ${14 + i * 12} ${46 - i * 10})"/>`).join('')}`,
  galaxy: (c) => `<path d="M32 32 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 1 1 7 7 a12 12 0 1 1 -12 -12 a18 18 0 1 1 18 18" fill="none" stroke="${c.core}" stroke-width="2.8" stroke-linecap="round"/>${[[14, 14], [50, 18], [46, 50], [16, 48]].map(([x, y]) => `<path d="${star(x, y, 4, 1.4, 4)}" fill="${c.glow}"/>`).join('')}`,
  blossom: (c) => `${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="32" cy="18" rx="7" ry="12" fill="#ffc8de" ${ST} transform="rotate(${a} 32 32)"/>`).join('')}<circle cx="32" cy="32" r="6" fill="${c.glow}" ${ST}/>`,
  claws: (c) => `${[-1, 0, 1].map((i) => `<path d="M${14 + i * 12} 10 Q${28 + i * 10} 30 ${30 + i * 12} 56" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${14 + i * 12} 10 Q${28 + i * 10} 30 ${30 + i * 12} 56" fill="none" stroke="${c.core}" stroke-width="4" stroke-linecap="round"/>`).join('')}`,
  clock: (c) => MOTIF.clock(c),
  eye: (c) => `<path d="M6 32 Q32 8 58 32 Q32 56 6 32 Z" fill="#f8f4ff" ${ST}/><circle cx="32" cy="32" r="10" fill="${c.glow}" ${ST}/><ellipse cx="32" cy="32" rx="2.6" ry="8" fill="${INK}"/>${rays(7, 25, 30, c.core, 2, -Math.PI)}`,
  gate: (c) => `<ellipse cx="32" cy="32" rx="18" ry="24" fill="#05030c" stroke="${c.core}" stroke-width="3"/><ellipse cx="32" cy="32" rx="12" ry="17" fill="none" stroke="${c.glow}" stroke-width="1.6" stroke-dasharray="4 3"/><path d="M32 12 L36 30 L32 52 L28 30 Z" fill="${c.core}" ${ST}/>`,
  roots: (c) => `<path d="M32 58 L32 30 M32 40 Q20 36 14 22 M32 36 Q44 30 50 16 M32 30 Q30 18 34 8" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M32 58 L32 30 M32 40 Q20 36 14 22 M32 36 Q44 30 50 16 M32 30 Q30 18 34 8" fill="none" stroke="${c.core}" stroke-width="3.5" stroke-linecap="round"/>`,
  serpent: (c) => `<path d="M8 50 Q18 30 30 44 Q42 58 50 38 Q56 24 46 14" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M8 50 Q18 30 30 44 Q42 58 50 38 Q56 24 46 14" fill="none" stroke="${c.glow}" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="14" r="6" fill="${c.core}" ${ST}/>`,
  thundergod: (c) => `<path d="M12 40 L16 18 L24 30 L32 12 L40 30 L48 18 L52 40 Z" fill="${c.core}" ${ST}/><path d="M34 40 L28 50 L34 50 L30 60" fill="none" stroke="${c.glow}" stroke-width="3"/>`,
};
const STEP_MOTIF = { dash: 'dash', blink: 'blink', spin: 'whirl', leap: 'leap', beam: 'beam', rain: 'meteor', pillars: 'pillar', nova: 'nova', cross: 'counter', barrage: 'volley', vortex: 'vortex' };

export function ultIconSvg(def, tierColor = '#ffb84a', secret = false) {
  const c = EL[def?.el] || EL.star;
  const id = `u${(def?.id || 'x').replace(/[^a-z0-9]/gi, '')}${secret ? 's' : ''}`;
  const defs = `<defs><radialGradient id="${id}" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="${secret ? '#ff9fb0' : c.glow}"/><stop offset="0.45" stop-color="${secret ? '#a0203a' : c.deep}"/><stop offset="1" stop-color="#07081a"/></radialGradient><clipPath id="${id}c"><circle cx="32" cy="32" r="27"/></clipPath></defs>`;
  const ring = `<circle cx="32" cy="32" r="29" fill="url(#${id})"/>`;
  const rim = `<circle cx="32" cy="32" r="29" fill="none" stroke="${tierColor}" stroke-width="3"/><circle cx="32" cy="32" r="25" fill="none" stroke="${tierColor}" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="2 3"/>`;
  if (secret) return W(`${ring}<path d="M32 14 L36 28 L50 32 L36 36 L32 50 L28 36 L14 32 L28 28 Z" fill="#1a0610" stroke="${tierColor}" stroke-width="2"/><text x="32" y="38" text-anchor="middle" font-size="16" font-weight="700" fill="${tierColor}" font-family="sans-serif">?</text>${rim}`, defs);
  const sig = def?.seq?.find((st) => st.k === 'sig' && st.kind !== 'thundergod' && st.kind !== 'clock') || def?.seq?.find((st) => st.k === 'sig');
  const main = sig ? null : def?.seq?.find((st) => st.k !== 'charge' && st.k !== 'finish');
  const body = sig ? (SIG[sig.kind] || SIG.sun)(c) : (MOTIF[STEP_MOTIF[main?.k] || 'nova'] || MOTIF.nova)(c, 5);
  return W(`${ring}<g clip-path="url(#${id}c)">${body}</g>${rim}`, defs);
}
