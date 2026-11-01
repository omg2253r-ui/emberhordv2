// Pet illustrations built from a body plan + parts, so every v7 pet has its own silhouette and markings.
// All pets face right; the anchor is at the feet (walkers) or under the body (flyers). Used for the in-game
// sprite and, scaled up, for the UI portraits.
//
//   art = { plan, c1 (body), c2 (belly / second tone), c3 (accent / glow), eye, ...parts for that plan }
//   plans: quad · bird · serpent · blob · insect · fish · golem · wisp · hopper · crab
import { INK } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b) => `<radialGradient id="${id}" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const eye = (x, y, r = 2.4, col = INK) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.38}" fill="#fff"/>`;
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}
const glowAura = (cx, cy, r, col, o = 0.22) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${o}"/>`;

// ---------------------------------------------------------------- shared parts
function pattern(kind, a, area) {
  const { x0, x1, y0, y1 } = area, d = shade(a.c1, 0.6);
  switch (kind) {
    case 'stripes': { let s = ''; for (let x = x0 + 4; x < x1 - 2; x += 6) s += `<path d="M${x} ${y0 + 1} q2 ${(y1 - y0) / 2} 0 ${y1 - y0 - 2}" stroke="${d}" stroke-width="1.6" fill="none"/>`; return s; }
    case 'spots': return [[0.25, 0.35], [0.55, 0.3], [0.4, 0.65], [0.75, 0.55]].map(([fx, fy]) => `<circle cx="${x0 + (x1 - x0) * fx}" cy="${y0 + (y1 - y0) * fy}" r="1.9" fill="${a.c3}" opacity="0.85"/>`).join('');
    case 'runes': return `<path d="M${x0 + 6} ${y0 + 4} l3 4 l-3 4 M${x0 + 14} ${y0 + 3} l0 9 M${x0 + 20} ${y0 + 5} l4 0 l-2 6" stroke="${a.c3}" stroke-width="1.3" fill="none"/>`;
    case 'ribs': { let s = ''; for (let x = x0 + 6; x < x1 - 4; x += 5) s += `<path d="M${x} ${y0 + 2} q-2 4 0 ${y1 - y0 - 4}" stroke="${shade(a.c2, 0.85)}" stroke-width="1.5" fill="none"/>`; return s; }
    case 'cracks': return `<path d="M${x0 + 5} ${y0 + 3} l4 5 l-2 4 l5 3 M${x1 - 8} ${y0 + 2} l-3 6 l3 3" stroke="${a.c3}" stroke-width="1.4" fill="none"/>`;
    case 'stars': return [[0.2, 0.3], [0.5, 0.55], [0.8, 0.35]].map(([fx, fy]) => { const x = x0 + (x1 - x0) * fx, y = y0 + (y1 - y0) * fy; return `<path d="M${x} ${y - 2.4} L${x + 0.8} ${y - 0.8} L${x + 2.4} ${y} L${x + 0.8} ${y + 0.8} L${x} ${y + 2.4} L${x - 0.8} ${y + 0.8} L${x - 2.4} ${y} L${x - 0.8} ${y - 0.8} Z" fill="${a.c3}"/>`; }).join('');
    default: return '';
  }
}

// ---------------------------------------------------------------- quadruped (dogs, cats, rams, foxes, qilin)
function quad(a) {
  const W = 64, H = 50;
  const body = a.build === 'slim' ? `M8 31 C9 24 20 22 34 23 C44 23 49 27 49 31 C49 36 40 37 30 37 C18 37 8 36 8 31 Z`
    : a.build === 'stocky' ? `M12 33 C9 19 22 14 34 15 C46 16 51 24 49 33 C48 41 40 42 30 42 C20 42 12 41 12 33 Z`
    : `M12 32 C12 22 22 18 34 19 C44 20 48 26 48 32 C48 39 40 40 30 40 C20 40 12 39 12 32 Z`;
  let back = '', front = '';
  if (a.wool) front += [[18, 18], [25, 15], [32, 14], [39, 16], [44, 21], [16, 25]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="${a.c2}" ${O2}/>`).join('');
  // tails (behind the body)
  switch (a.tail) {
    case 'bushy': back += `<path d="M14 28 C4 24 2 12 8 8 C10 14 14 20 19 24 Z" fill="${a.c1}" ${O}/><path d="M6 10 C8 8 10 9 9 12" fill="${a.c2}"/>`; break;
    case 'flame': back += `<path d="M14 28 C6 26 3 18 6 10 C8 14 10 14 10 10 C14 14 16 20 19 24 Z" fill="${a.c3}" ${O2}/><path d="M10 24 C8 20 8 17 9 15 C11 18 13 20 15 23 Z" fill="#fff3c4"/>`; break;
    case 'thin': back += `<path d="M14 28 C6 28 4 20 8 14 C9 12 11 13 10 15" stroke="${a.c1}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M14 28 C6 28 4 20 8 14" stroke="${INK}" stroke-width="0.8" fill="none" opacity="0.4"/>`; break;
    case 'nine': for (let i = 0; i < 9; i++) { const ang = -150 + i * 15; back += `<path d="M16 28 Q${8 + Math.cos(ang * Math.PI / 180) * 4} ${18 + Math.sin(ang * Math.PI / 180) * 4} ${16 + Math.cos(ang * Math.PI / 180) * 16} ${28 + Math.sin(ang * Math.PI / 180) * 16}" stroke="${i % 2 ? a.c2 : a.c1}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`; } back += `<path d="M5 18 L3 16 M8 12 L7 9 M13 9 L13 6" stroke="${a.c3}" stroke-width="2" stroke-linecap="round"/>`; break;
    case 'bone': back += `<path d="M14 28 C10 26 7 22 6 17" stroke="${a.c2}" stroke-width="2.4" fill="none"/>` + [[12, 26], [9, 23], [7, 19]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="${a.c2}" ${O2}/>`).join(''); break;
    case 'crystal': back += `<path d="M15 27 L4 18 L10 26 Z M15 29 L2 28 L11 31 Z M16 25 L10 12 L14 24 Z" fill="${a.c3}" ${O2}/>`; break;
    default: break;
  }
  // legs
  const leg = (x, tone) => `<path d="M${x - 2.6} 37 L${x + 2.6} 37 L${x + 2.2} 46 L${x - 2.2} 46 Z" fill="${shade(a.c1, tone)}" ${O2}/><path d="M${x - 2.8} 46 L${x + 3.2} 46" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  back += leg(18, 0.75) + leg(38, 0.75);
  const legs = leg(23, 1) + leg(43, 1);
  // mane / spikes along the neck
  if (a.mane) front += `<path d="M38 18 L40 12 L42 17 L45 10 L46 17 L50 12 L49 19 Z" fill="${a.mane === true ? a.c3 : a.mane}" ${O2}/>`;
  // head
  const hx = 50, hy = 22;
  let head = `<circle cx="${hx}" cy="${hy}" r="9" fill="url(#qb)" ${O}/><ellipse cx="${hx + 8}" cy="${hy + 3}" rx="5.6" ry="3.8" fill="${a.c2}" ${O2}/><circle cx="${hx + 12.6}" cy="${hy + 1.8}" r="1.6" fill="${INK}"/>`;
  head += eye(hx + 3, hy - 2, 2.3, a.eye || INK);
  switch (a.ears) {
    case 'pointy': head += `<path d="M${hx - 7} ${hy - 4} L${hx - 7} ${hy - 15} L${hx - 1} ${hy - 7} Z" fill="${a.c1}" ${O2}/><path d="M${hx - 1} ${hy - 8} L${hx + 3} ${hy - 17} L${hx + 6} ${hy - 7} Z" fill="${a.c1}" ${O2}/><path d="M${hx + 1} ${hy - 9} L${hx + 3} ${hy - 13} L${hx + 4.5} ${hy - 9}" fill="${a.c3}"/>`; break;
    case 'round': head += `<circle cx="${hx - 5}" cy="${hy - 8}" r="4" fill="${a.c1}" ${O2}/><circle cx="${hx + 3}" cy="${hy - 10}" r="4" fill="${a.c1}" ${O2}/><circle cx="${hx + 3}" cy="${hy - 10}" r="1.8" fill="${a.c2}"/>`; break;
    case 'droop': head += `<path d="M${hx - 4} ${hy - 7} C${hx - 12} ${hy - 6} ${hx - 12} ${hy + 4} ${hx - 8} ${hy + 6} C${hx - 6} ${hy} ${hx - 3} ${hy - 3} ${hx - 1} ${hy - 6} Z" fill="${shade(a.c1, 0.8)}" ${O2}/>`; break;
    default: break;
  }
  switch (a.horns) {
    case 'curl': head += `<path d="M${hx - 3} ${hy - 7} C${hx - 12} ${hy - 12} ${hx - 14} ${hy - 1} ${hx - 7} ${hy} C${hx - 4} ${hy - 1} ${hx - 5} ${hy - 4} ${hx - 8} ${hy - 4}" stroke="${a.c3}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M${hx - 3} ${hy - 7} C${hx - 12} ${hy - 12} ${hx - 14} ${hy - 1} ${hx - 7} ${hy}" stroke="${INK}" stroke-width="0.9" fill="none" opacity="0.55"/>`; break;
    case 'antler': head += `<path d="M${hx - 2} ${hy - 8} L${hx - 6} ${hy - 20} M${hx - 5} ${hy - 16} L${hx - 11} ${hy - 19} M${hx - 6} ${hy - 20} L${hx - 3} ${hy - 25} M${hx + 3} ${hy - 9} L${hx + 6} ${hy - 21} M${hx + 5} ${hy - 17} L${hx + 11} ${hy - 19} M${hx + 6} ${hy - 21} L${hx + 4} ${hy - 26}" stroke="${a.c3}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; break;
    case 'single': head += `<path d="M${hx + 2} ${hy - 8} L${hx + 9} ${hy - 22} L${hx + 6} ${hy - 7} Z" fill="${a.c3}" ${O2}/><path d="M${hx + 3.5} ${hy - 11} L${hx + 7} ${hy - 12} M${hx + 4.5} ${hy - 15} L${hx + 7.6} ${hy - 16}" stroke="${INK}" stroke-width="0.8" opacity="0.5"/>`; break;
    case 'nubs': head += `<path d="M${hx - 4} ${hy - 8} L${hx - 5} ${hy - 13} L${hx - 1} ${hy - 9} Z M${hx + 2} ${hy - 9} L${hx + 3} ${hy - 14} L${hx + 6} ${hy - 9} Z" fill="${a.c3}" ${O2}/>`; break;
    default: break;
  }
  if (a.skull) head += `<path d="M${hx - 4} ${hy - 3} Q${hx} ${hy - 9} ${hx + 6} ${hy - 4}" stroke="${a.c2}" stroke-width="2" fill="none"/><path d="M${hx + 5} ${hy + 4} l1 2 l1 -2 l1 2" stroke="#fff" stroke-width="1" fill="none"/>`;
  const aura = a.glow ? glowAura(34, 28, 26, a.c3, 0.18) : '';
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('qb', shade(a.c1, 1.25), shade(a.c1, 0.8)),
    `${aura}${back}<path d="${body}" fill="url(#qb)" ${O}/><ellipse cx="31" cy="35.5" rx="12" ry="3.4" fill="${a.c2}" opacity="0.85"/>${pattern(a.pat, a, { x0: 16, x1: 44, y0: 21, y1: 33 })}${legs}${front}${head}`) };
}

// ---------------------------------------------------------------- birds and bats
function bird(a) {
  const W = 54, H = 52;
  let back = '', front = '';
  // wing (behind the body)
  switch (a.wing) {
    case 'bat': back += `<path d="M24 26 C16 8 4 6 1 14 C6 14 7 18 5 22 C10 20 12 24 10 28 C16 25 20 28 24 30 Z" fill="${shade(a.c1, 0.7)}" ${O}/><path d="M5 14 L18 24 M5 22 L19 27" stroke="${INK}" stroke-width="0.9" opacity="0.5"/>`; break;
    case 'flame': back += `<path d="M24 26 C18 10 8 4 2 8 C8 10 9 14 6 18 C11 17 12 21 9 25 C15 24 19 27 24 30 Z" fill="${a.c3}" ${O2}/><path d="M20 24 C16 16 12 12 8 11 C12 15 14 19 15 23 Z" fill="#fff3c4" opacity="0.8"/>`; break;
    case 'storm': back += `<path d="M24 24 C16 6 6 2 1 6 C8 9 4 12 9 14 C3 16 8 20 12 20 C8 24 16 26 24 30 Z" fill="${shade(a.c1, 0.85)}" ${O}/><path d="M10 8 L14 13 L11 14 L16 20" stroke="${a.c3}" stroke-width="1.6" fill="none"/>`; break;
    default: back += `<path d="M24 26 C18 10 8 6 3 10 C7 13 6 16 9 18 C6 20 9 24 12 24 C10 27 16 29 24 30 Z" fill="${shade(a.c1, 0.8)}" ${O}/><path d="M8 13 Q15 16 20 24 M9 19 Q15 22 20 27" stroke="${shade(a.c1, 0.55)}" stroke-width="1" fill="none"/>`;
  }
  // tail feathers
  if (a.tailF === 'long') back += `<path d="M18 36 C10 42 4 46 1 50 C8 49 13 46 18 42 Z M20 38 C14 46 12 50 12 51 C17 48 20 44 22 40 Z" fill="${a.c3}" ${O2}/>`;
  else if (a.tailF === 'fan') back += `<path d="M20 36 L6 34 L8 38 L4 41 L10 42 L8 46 L20 40 Z" fill="${a.c2}" ${O2}/>`;
  // body + head
  const body = `<ellipse cx="28" cy="31" rx="13" ry="12" fill="url(#bb)" ${O}/><ellipse cx="31" cy="35" rx="8" ry="6.5" fill="${a.c2}" opacity="0.9"/>`;
  const hx = 37, hy = 18;
  let head = `<circle cx="${hx}" cy="${hy}" r="8.5" fill="url(#bb)" ${O}/>${eye(hx + 3, hy - 1, 2.4, a.eye || INK)}`;
  head += a.beak === 'hook' ? `<path d="M${hx + 7} ${hy - 1} C${hx + 13} ${hy - 1} ${hx + 14} ${hy + 4} ${hx + 11} ${hy + 6} C${hx + 10} ${hy + 3} ${hx + 9} ${hy + 2} ${hx + 7} ${hy + 3} Z" fill="${a.c3}" ${O2}/>`
    : a.beak === 'fang' ? `<path d="M${hx + 6} ${hy + 3} L${hx + 7} ${hy + 7} L${hx + 8} ${hy + 3} M${hx + 3} ${hy + 4} L${hx + 4} ${hy + 7} L${hx + 5} ${hy + 4}" fill="#fff" ${O2}/>`
    : `<path d="M${hx + 7} ${hy} L${hx + 14} ${hy + 2} L${hx + 7} ${hy + 4} Z" fill="${a.c3}" ${O2}/>`;
  if (a.crest === 'plume') head += `<path d="M${hx - 3} ${hy - 7} C${hx - 6} ${hy - 16} ${hx - 1} ${hy - 20} ${hx + 2} ${hy - 16} C${hx} ${hy - 14} ${hx} ${hy - 11} ${hx + 1} ${hy - 8} Z" fill="${a.c3}" ${O2}/>`;
  else if (a.crest === 'ears') head += `<path d="M${hx - 5} ${hy - 5} L${hx - 7} ${hy - 15} L${hx - 1} ${hy - 8} Z M${hx + 1} ${hy - 8} L${hx + 3} ${hy - 17} L${hx + 6} ${hy - 7} Z" fill="${shade(a.c1, 0.8)}" ${O2}/>`;
  else if (a.crest === 'crown') head += `<path d="M${hx - 5} ${hy - 7} L${hx - 4} ${hy - 14} L${hx - 1} ${hy - 10} L${hx + 2} ${hy - 15} L${hx + 4} ${hy - 9} L${hx + 6} ${hy - 13} L${hx + 6} ${hy - 6} Z" fill="${a.c3}" ${O2}/>`;
  else if (a.crest === 'flame') head += `<path d="M${hx - 4} ${hy - 7} C${hx - 8} ${hy - 14} ${hx - 2} ${hy - 22} ${hx} ${hy - 15} C${hx + 2} ${hy - 20} ${hx + 7} ${hy - 14} ${hx + 4} ${hy - 7} Z" fill="${a.c3}" ${O2}/><path d="M${hx - 1} ${hy - 8} C${hx - 2} ${hy - 12} ${hx} ${hy - 14} ${hx + 1} ${hy - 11}" stroke="#fff3c4" stroke-width="1.4" fill="none"/>`;
  // front wing over the body
  front += a.wing === 'bat'
    ? `<path d="M26 28 C30 20 38 22 40 30 C36 28 34 32 32 34 C30 31 28 30 26 28 Z" fill="${shade(a.c1, 0.85)}" ${O2}/>`
    : `<path d="M22 28 C26 22 36 24 38 32 C32 34 26 36 20 34 Z" fill="${shade(a.c1, a.wing === 'flame' ? 1.1 : 0.9)}" ${O2}/><path d="M24 31 Q30 30 35 32" stroke="${shade(a.c1, 0.55)}" stroke-width="1" fill="none"/>`;
  const legs = a.perch ? `<path d="M26 42 L25 48 M33 42 L34 48" stroke="${a.c3}" stroke-width="2.2" stroke-linecap="round"/>` : '';
  const aura = a.glow ? glowAura(28, 28, 24, a.c3, 0.2) : '';
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('bb', shade(a.c1, 1.3), shade(a.c1, 0.75)),
    `${aura}${back}${legs}${body}${pattern(a.pat, a, { x0: 18, x1: 36, y0: 22, y1: 34 })}${front}${head}`) };
}

// ---------------------------------------------------------------- serpents (snakes, salamanders, eels)
function serpent(a) {
  const W = 68, H = 42;
  const coil = `M6 34 C14 40 24 40 30 34 C36 28 44 28 50 32`;
  let s = `<path d="${coil}" stroke="${INK}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="${coil}" stroke="url(#sb)" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M8 36 C15 40 24 40 30 35" stroke="${a.c2}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  if (a.pat === 'bands') for (const x of [12, 20, 28, 38]) s += `<path d="M${x} ${x < 30 ? 33 : 28} l1.5 8" stroke="${a.c3}" stroke-width="2.2"/>`;
  else if (a.pat === 'diamonds') for (const x of [12, 22, 36]) s += `<path d="M${x} 34 l2.5 -2.5 l2.5 2.5 l-2.5 2.5 Z" fill="${a.c3}"/>`;
  else if (a.pat === 'lava') s += `<path d="M12 35 l3 -2 l2 3 M24 34 l3 2 l2 -3 M38 31 l2 -2 l3 2" stroke="${a.c3}" stroke-width="1.8" fill="none"/>`;
  if (a.legs) s += `<path d="M14 38 L12 42 M26 37 L28 42 M40 33 L38 38" stroke="${shade(a.c1, 0.7)}" stroke-width="3" stroke-linecap="round"/>`;
  if (a.fins) s += `<path d="M30 30 C30 22 36 20 40 24 C38 26 36 28 36 30 Z" fill="${a.c3}" ${O2} opacity="0.95"/>`;
  // neck rises into the head
  s += `<path d="M48 32 C52 28 52 20 54 16" stroke="${INK}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M48 32 C52 28 52 20 54 16" stroke="url(#sb)" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  if (a.hood) s += `<path d="M48 22 C42 14 46 4 54 6 C62 4 66 14 60 22 Z" fill="${shade(a.c1, 0.8)}" ${O2}/><path d="M50 14 Q54 10 58 14" stroke="${a.c3}" stroke-width="1.6" fill="none"/>`;
  s += `<ellipse cx="57" cy="14" rx="8" ry="6" fill="url(#sb)" ${O}/>${eye(59, 12, 2.1, a.eye || INK)}<path d="M64 15 L68 14 M64 15 L68 17" stroke="${a.c3}" stroke-width="1"/>`;
  if (a.horns) s += `<path d="M53 9 L50 2 L56 8 Z" fill="${a.c3}" ${O2}/>`;
  if (a.tentacles) s += `<path d="M6 34 C2 30 2 24 6 22 M10 38 C6 40 2 40 0 36" stroke="${a.c1}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('sb', shade(a.c1, 1.3), shade(a.c1, 0.75)), `${a.glow ? glowAura(34, 28, 26, a.c3, 0.18) : ''}${s}`) };
}

// ---------------------------------------------------------------- blobs, slimes, jellies, krakens
function blob(a) {
  const W = 52, H = 50;
  let back = '', front = '';
  if (a.tentacles) for (let i = 0; i < a.tentacles; i++) { const x = 12 + (i * 28) / Math.max(1, a.tentacles - 1); back += `<path d="M${x} 36 C${x - 3} 42 ${x + 3} 44 ${x} 49" stroke="${shade(a.c1, 0.85)}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`; }
  const dome = a.drip
    ? `M6 38 C4 22 14 10 26 10 C38 10 48 22 46 38 C42 41 40 37 37 40 C34 43 31 39 27 41 C23 43 20 39 16 41 C12 43 9 39 6 38 Z`
    : `M6 38 C4 22 14 10 26 10 C38 10 48 22 46 38 Q26 44 6 38 Z`;
  front += `<path d="${dome}" fill="url(#lb)" ${O} ${a.clear ? 'fill-opacity="0.82"' : ''}/>`;
  front += `<path d="M13 22 C15 16 20 13 25 13" stroke="#fff" stroke-width="2.2" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  if (a.core) front += `<circle cx="26" cy="28" r="5" fill="${a.c3}" opacity="0.9"/><circle cx="26" cy="28" r="2.4" fill="#fff"/>`;
  front += eye(31, 26, 2.5, a.eye || INK) + eye(21, 26, 2.3, a.eye || INK);
  front += a.mouth === 'fang' ? `<path d="M23 33 L24 36 L25 33 M27 33 L28 36 L29 33" fill="#fff" ${O2}/>` : `<path d="M23 32 Q26 35 29 32" stroke="${INK}" stroke-width="1.3" fill="none"/>`;
  if (a.crown) front += `<path d="M17 13 L18 5 L22 10 L26 3 L30 10 L34 5 L35 13 Z" fill="${a.c3}" ${O2}/>`;
  if (a.spikes) front += `<path d="M10 22 L4 18 L9 26 Z M42 22 L48 18 L43 26 Z M26 10 L26 3 L29 10 Z" fill="${a.c3}" ${O2}/>`;
  if (a.leaf) front += `<path d="M26 11 C24 4 28 0 33 2 C33 6 30 10 26 11 Z" fill="${a.c3}" ${O2}/><path d="M26 11 L29 5" stroke="${shade(a.c3, 0.6)}" stroke-width="1"/>`;
  if (a.motes) front += [[6, 12], [44, 8], [48, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${a.c3}" opacity="0.8"/>`).join('');
  return { w: W, h: H, ax: W / 2, ay: a.tentacles ? H - 4 : 42, svg: S(W, H, rg('lb', shade(a.c1, 1.35), shade(a.c1, 0.7)), `${a.glow ? glowAura(26, 26, 24, a.c3, 0.2) : ''}${back}${front}`) };
}

// ---------------------------------------------------------------- insects (beetles, moths, scarabs)
function insect(a) {
  const W = 56, H = 46;
  let s = '';
  if (a.form === 'moth') {
    s += `<path d="M26 22 C14 6 2 8 2 18 C2 26 12 28 24 26 Z" fill="${a.c2}" ${O}/><path d="M26 26 C14 30 6 38 10 42 C16 44 22 36 26 30 Z" fill="${shade(a.c2, 0.85)}" ${O}/>`;
    s += `<circle cx="11" cy="17" r="4" fill="${a.c3}" opacity="0.9" ${O2}/><circle cx="11" cy="17" r="1.6" fill="${INK}"/><path d="M6 24 Q14 24 22 24" stroke="${shade(a.c2, 0.6)}" stroke-width="1" fill="none"/>`;
    s += `<ellipse cx="30" cy="25" rx="7" ry="10" fill="url(#ib)" ${O}/><path d="M25 22 Q30 24 35 22 M25 27 Q30 29 35 27" stroke="${shade(a.c1, 0.6)}" stroke-width="1" fill="none"/>`;
    s += `<circle cx="36" cy="14" r="6" fill="url(#ib)" ${O}/>${eye(38, 13, 2, a.eye || INK)}`;
    s += `<path d="M36 9 C36 3 40 1 44 3 M39 10 C42 6 46 6 48 9" stroke="${INK}" stroke-width="1.3" fill="none"/><path d="M44 3 l-1 3 l3 -1 Z M48 9 l-3 0 l1 3 Z" fill="${a.c3}" ${O2}/>`;
    return { w: W, h: H, ax: W / 2, ay: 40, svg: S(W, H, rg('ib', shade(a.c1, 1.3), shade(a.c1, 0.7)), `${a.glow ? glowAura(24, 22, 22, a.c3, 0.22) : ''}${s}`) };
  }
  // beetle / scarab: shell in two halves
  s += `<path d="M8 34 L4 40 M16 36 L14 42 M26 36 L28 42 M34 35 L38 40" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  s += `<path d="M6 32 C6 18 16 12 28 12 C38 12 44 20 44 30 C44 36 36 38 26 38 C14 38 6 37 6 32 Z" fill="url(#ib)" ${O}/>`;
  s += `<path d="M26 13 L25 37" stroke="${INK}" stroke-width="1.4" opacity="0.7"/><path d="M12 20 C16 16 22 15 25 15" stroke="#fff" stroke-width="1.8" fill="none" opacity="0.45"/>`;
  s += pattern(a.pat, a, { x0: 9, x1: 42, y0: 16, y1: 34 });
  s += `<path d="M42 24 C46 20 52 22 52 28 C52 32 48 34 43 32 Z" fill="${shade(a.c1, 0.6)}" ${O}/>${eye(48, 26, 1.9, a.eye || INK)}`;
  if (a.horn === 'rhino') s += `<path d="M49 22 C50 14 54 10 56 9 C55 14 54 18 52 23 Z" fill="${a.c3}" ${O2}/>`;
  else if (a.horn === 'pincer') s += `<path d="M51 30 C56 30 56 36 52 37 M51 25 C56 22 56 18 53 17" stroke="${a.c3}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  else s += `<path d="M47 22 C47 16 50 12 53 12 M49 23 C51 18 55 16 56 18" stroke="${INK}" stroke-width="1.3" fill="none"/><circle cx="53" cy="12" r="1.6" fill="${a.c3}"/>`;
  if (a.sun) s += `<circle cx="26" cy="24" r="5" fill="${a.c3}" ${O2}/><path d="M26 16 L26 18 M18 24 L20 24 M32 24 L34 24 M20 18 L21.5 19.5 M32 18 L30.5 19.5" stroke="${a.c3}" stroke-width="1.6"/>`;
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('ib', shade(a.c1, 1.35), shade(a.c1, 0.65)), `${a.glow ? glowAura(26, 26, 24, a.c3, 0.2) : ''}${s}`) };
}

// ---------------------------------------------------------------- floating fish and whales
function fish(a) {
  const big = a.form === 'whale';
  const W = big ? 74 : 60, H = big ? 46 : 40;
  let s = '';
  if (big) {
    s += `<path d="M8 22 C2 14 2 8 6 6 C8 12 12 16 16 18 C14 22 12 26 8 30 C4 30 2 26 8 22 Z" fill="${shade(a.c1, 0.85)}" ${O}/>`;
    s += `<path d="M14 24 C14 12 30 6 46 8 C60 10 70 18 70 26 C70 34 58 38 44 38 C28 38 14 34 14 24 Z" fill="url(#fb)" ${O}/>`;
    s += `<path d="M20 30 C30 36 48 37 66 30 C60 36 50 38 40 38 C30 38 24 35 20 30 Z" fill="${a.c2}"/>`;
    for (const x of [34, 40, 46, 52]) s += `<path d="M${x} 31 L${x + 1} 37" stroke="${shade(a.c2, 0.75)}" stroke-width="1.2"/>`;
    s += `<path d="M40 30 C40 36 46 40 48 44 C44 42 40 40 36 36 Z" fill="${shade(a.c1, 0.8)}" ${O2}/>${eye(60, 22, 2.4, a.eye || INK)}`;
    s += `<path d="M48 8 C48 2 54 0 56 4 M52 7 C54 2 60 2 60 6" stroke="${a.c3}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    if (a.clouds) s += `<path d="M18 12 C16 8 22 6 24 9 C26 6 32 8 30 12 Z" fill="#ffffff" opacity="0.85" ${O2}/>`;
  } else {
    s += `<path d="M10 20 L2 10 L4 20 L2 30 Z" fill="${a.c3}" ${O}/>`;
    s += `<path d="M8 20 C10 10 22 4 34 4 C46 4 56 12 56 20 C56 28 46 34 34 34 C22 34 10 30 8 20 Z" fill="url(#fb)" ${O}/>`;
    s += `<path d="M26 5 C28 0 36 0 40 4" fill="${a.c3}" ${O2}/><path d="M30 33 C30 38 36 40 38 38 C36 36 36 34 36 33 Z" fill="${a.c3}" ${O2}/>`;
    s += `<path d="M14 24 C24 30 40 31 54 24 C48 31 40 34 34 34 C24 34 18 30 14 24 Z" fill="${a.c2}"/>`;
    if (a.pat === 'coral') s += `<path d="M20 14 l3 3 l-1 4 M26 10 l2 4 l3 -1 M32 14 l2 3" stroke="${a.c3}" stroke-width="1.6" fill="none"/>`;
    else s += pattern(a.pat, a, { x0: 16, x1: 44, y0: 10, y1: 24 });
    s += `<path d="M40 18 C42 22 42 26 40 28" stroke="${shade(a.c1, 0.55)}" stroke-width="1.4" fill="none"/>${eye(48, 16, 2.4, a.eye || INK)}<path d="M54 22 Q52 24 54 25" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
    if (a.lure) s += `<path d="M46 6 C50 0 56 -2 58 4" stroke="${INK}" stroke-width="1.2" fill="none"/><circle cx="58" cy="5" r="2.6" fill="${a.c3}"/>`;
  }
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('fb', shade(a.c1, 1.3), shade(a.c1, 0.7)), `${a.glow ? glowAura(W / 2, 22, 24, a.c3, 0.18) : ''}${s}`) };
}

// ---------------------------------------------------------------- golems (stone, moss, obsidian)
function golem(a) {
  const W = 56, H = 58;
  let s = `<path d="M15 44 L13 55 L22 55 L22 44 Z M33 44 L33 55 L42 55 L40 44 Z" fill="${shade(a.c1, 0.75)}" ${O}/>`;
  s += `<path d="M8 22 L4 40 L12 42 L15 26 Z M47 22 L52 40 L44 42 L41 26 Z" fill="${shade(a.c1, 0.85)}" ${O}/>`;
  s += `<path d="M12 18 L44 18 L46 44 L10 44 Z" fill="url(#gb)" ${O}/>`;
  s += `<path d="M16 8 L40 8 L42 20 L14 20 Z" fill="url(#gb)" ${O}/>`;
  s += `<rect x="20" y="12" width="5" height="3" fill="${a.c3}"/><rect x="31" y="12" width="5" height="3" fill="${a.c3}"/>`;
  s += `<circle cx="28" cy="30" r="5.5" fill="${a.c3}" ${O2}/><circle cx="28" cy="30" r="2.6" fill="#fff" opacity="0.85"/>`;
  s += pattern(a.pat, a, { x0: 12, x1: 44, y0: 20, y1: 42 });
  if (a.moss) s += `<path d="M14 8 C16 3 24 2 26 6 C30 2 38 3 42 8 Z" fill="${a.moss}" ${O2}/><path d="M10 20 C12 16 18 16 20 19" fill="${a.moss}" ${O2}/><circle cx="40" cy="22" r="2" fill="#ffd0e0"/>`;
  if (a.shards) s += `<path d="M18 8 L20 0 L24 8 Z M30 8 L34 -1 L37 8 Z M44 20 L52 14 L46 24 Z" fill="${a.c3}" ${O2}/>`;
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('gb', shade(a.c1, 1.25), shade(a.c1, 0.7)), `${a.glow ? glowAura(28, 30, 26, a.c3, 0.2) : ''}${s}`) };
}

// ---------------------------------------------------------------- wisps and sprites (floating light)
function wisp(a) {
  const W = 46, H = 54;
  let s = glowAura(23, 22, 20, a.c3, 0.28);
  if (a.ribbons) s += `<path d="M18 34 C12 42 14 48 8 52 M28 34 C34 42 30 48 36 52" stroke="${a.c2}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (a.form === 'prism') {
    s += `<path d="M23 4 L38 22 L23 40 L8 22 Z" fill="url(#wb)" ${O}/><path d="M23 4 L23 40 M8 22 L38 22" stroke="#fff" stroke-width="1" opacity="0.6"/>`;
    s += `<path d="M23 4 L31 22 L23 40" fill="${shade(a.c1, 0.75)}" opacity="0.5"/>`;
  } else {
    s += `<path d="M23 40 C10 40 6 28 10 18 C12 12 16 10 16 4 C20 8 22 10 24 6 C28 10 30 6 32 4 C34 12 40 18 38 28 C36 36 30 40 23 40 Z" fill="url(#wb)" ${O}/>`;
    s += `<path d="M23 36 C16 36 14 30 16 24 C18 28 20 26 21 22 C24 26 28 26 30 24 C32 30 28 36 23 36 Z" fill="#fff3c4" opacity="0.7"/>`;
  }
  s += eye(27, 24, 2.2, a.eye || INK) + eye(19, 24, 2, a.eye || INK);
  if (a.orbit) s += [[4, 18], [42, 14], [40, 36]].map(([x, y]) => `<path d="M${x} ${y - 3} L${x + 3} ${y} L${x} ${y + 3} L${x - 3} ${y} Z" fill="${a.c3}" ${O2}/>`).join('');
  return { w: W, h: H, ax: W / 2, ay: 46, svg: S(W, H, rg('wb', shade(a.c1, 1.4), shade(a.c1, 0.8)), s) };
}

// ---------------------------------------------------------------- hoppers (rabbits, frogs)
function hopper(a) {
  const W = 54, H = 50;
  let s = '';
  if (a.form === 'frog') {
    s += `<path d="M8 42 C2 42 2 36 8 34 L16 36 Z M44 42 C50 42 50 36 44 34 L36 36 Z" fill="${shade(a.c1, 0.8)}" ${O2}/>`;
    s += `<path d="M8 36 C6 24 14 18 26 18 C38 18 46 24 44 36 C40 42 12 42 8 36 Z" fill="url(#hb)" ${O}/>`;
    s += `<path d="M14 38 C20 41 32 41 38 38" stroke="${a.c2}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    s += `<circle cx="18" cy="17" r="6" fill="url(#hb)" ${O}/><circle cx="34" cy="17" r="6" fill="url(#hb)" ${O}/>${eye(19, 16, 2.8, a.eye || INK)}${eye(35, 16, 2.8, a.eye || INK)}`;
    s += `<path d="M18 30 Q26 34 36 29" stroke="${INK}" stroke-width="1.5" fill="none"/>`;
    s += pattern(a.pat, a, { x0: 12, x1: 40, y0: 21, y1: 30 });
    if (a.leaf) s += `<path d="M24 12 C22 4 30 0 34 4 C32 8 28 10 24 12 Z" fill="${a.c3}" ${O2}/>`;
    return { w: W, h: H, ax: W / 2, ay: H - 6, svg: S(W, H, rg('hb', shade(a.c1, 1.3), shade(a.c1, 0.7)), s) };
  }
  // rabbit / hare sitting upright
  s += `<path d="M12 40 C4 40 4 32 12 32 Z" fill="${a.c2}" ${O2}/>`;
  s += `<path d="M14 44 C10 32 16 22 26 22 C36 22 40 32 38 44 Z" fill="url(#hb)" ${O}/>`;
  s += `<ellipse cx="28" cy="38" rx="7" ry="5" fill="${a.c2}" opacity="0.9"/>`;
  s += `<path d="M32 44 C36 44 42 44 44 42 C42 40 38 40 34 40 Z" fill="${shade(a.c1, 0.8)}" ${O2}/>`;
  s += `<circle cx="32" cy="18" r="8" fill="url(#hb)" ${O}/>${eye(35, 17, 2.2, a.eye || INK)}<circle cx="39.5" cy="20" r="1.4" fill="#e8a0a0"/>`;
  s += `<path d="M27 12 C24 0 28 -4 31 2 C32 6 31 10 30 12 Z" fill="${a.c1}" ${O2}/><path d="M33 11 C34 0 39 -2 40 4 C40 8 37 10 35 12 Z" fill="${a.c1}" ${O2}/><path d="M29 10 C28 4 29 2 30 4 M36 9 C37 4 38 3 38 5" stroke="${a.c3}" stroke-width="1.6" fill="none"/>`;
  if (a.leaf) s += `<path d="M14 26 C6 22 6 14 12 12 C14 16 16 20 18 24 Z" fill="${a.c3}" ${O2}/><path d="M12 14 L16 23" stroke="${shade(a.c3, 0.6)}" stroke-width="1"/>`;
  return { w: W, h: H, ax: W / 2, ay: H - 5, svg: S(W, H, rg('hb', shade(a.c1, 1.3), shade(a.c1, 0.75)), s) };
}

// ---------------------------------------------------------------- crabs
function crab(a) {
  const W = 62, H = 42;
  let s = '';
  for (const [x, d] of [[16, -1], [22, -1], [38, 1], [44, 1]]) s += `<path d="M${x} 30 L${x + d * 6} 38 L${x + d * 8} 40" stroke="${shade(a.c1, 0.7)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M14 24 C6 18 4 10 10 6 C12 10 14 12 18 12 C16 16 16 20 18 22 Z" fill="${a.c1}" ${O}/><path d="M48 24 C56 18 58 10 52 6 C50 10 48 12 44 12 C46 16 46 20 44 22 Z" fill="${a.c1}" ${O}/>`;
  s += `<path d="M10 6 L14 4 M52 6 L48 4" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<path d="M12 28 C12 18 20 14 31 14 C42 14 50 18 50 28 C50 33 42 35 31 35 C20 35 12 33 12 28 Z" fill="url(#cb)" ${O}/>`;
  s += pattern(a.pat, a, { x0: 16, x1: 46, y0: 17, y1: 30 });
  if (a.shell === 'pebble') s += `<ellipse cx="24" cy="12" rx="6" ry="4" fill="${a.c2}" ${O2}/><ellipse cx="36" cy="11" rx="5" ry="3.4" fill="${shade(a.c2, 0.85)}" ${O2}/>`;
  else if (a.shell === 'crystal') s += `<path d="M24 15 L26 5 L30 15 Z M32 14 L36 3 L38 15 Z" fill="${a.c3}" ${O2}/>`;
  s += `<path d="M26 16 L25 10 M36 16 L37 10" stroke="${INK}" stroke-width="1.4"/>${eye(25, 9, 2.3, a.eye || INK)}${eye(37, 9, 2.3, a.eye || INK)}`;
  return { w: W, h: H, ax: W / 2, ay: H - 3, svg: S(W, H, rg('cb', shade(a.c1, 1.3), shade(a.c1, 0.7)), s) };
}

const PLANS = { quad, bird, serpent, blob, insect, fish, golem, wisp, hopper, crab };
export const PET_PLANS = Object.freeze(Object.keys(PLANS));

export function forgePet(art) {
  const f = PLANS[art.plan] || blob;
  return f(art);
}
