// Item icons (64x64 illustrations) and UI glyphs (24x24 line icons, currentColor).
import { PAL, INK } from './palette.js';
import { getItem } from '../data/items.js';
import { weaponIconBody } from './weapons.js';
import { wingSprite } from './wings.js';
import { egyIconSvg } from './egyptIcons.js';

const O = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

function bladeIcon(a) {
  let blade;
  switch (a.kind) {
    case 'saber': blade = `<path d="M30 44 C26 30 28 16 38 4 C38 18 38 32 35 44 Z" fill="${a.blade}" ${O}/><path d="M36 9 C35 22 35 32 34 42" stroke="${a.edge}" stroke-width="2" fill="none"/>`; break;
    case 'thorn': blade = `<path d="M28 44 L28 13 L24 18 L28 8 L32 1 L36 8 L40 18 L36 13 L36 44 Z" fill="${a.blade}" ${O}/><path d="M28 28 L23 24 L28 34 M36 22 L41 18 L36 30" stroke="${INK}" stroke-width="2" fill="${a.blade}"/><path d="M32 7 L32 42" stroke="${a.edge}" stroke-width="2"/>`; break;
    case 'fang': blade = `<path d="M32 2 C40 18 40 34 34 44 L30 44 C24 34 24 18 32 2 Z" fill="${a.glow}" opacity="0.4"/><path d="M28 44 C24 28 26 12 35 1 C34 9 39 13 36 22 C40 26 36 34 36 44 Z" fill="${a.blade}" ${O}/><path d="M34 7 C33 20 33 32 33 42" stroke="${a.edge}" stroke-width="2.2" fill="none"/>`; break;
    default: blade = `<path d="M28 44 L28 8 L32 1 L36 8 L36 44 Z" fill="${a.blade}" ${O}/><path d="M32 6 L32 42" stroke="${a.edge}" stroke-width="2"/>`;
  }
  return `<g transform="rotate(40 32 32) translate(0 4)">${blade}
    <rect x="21" y="43" width="22" height="6" rx="2.5" fill="${a.guard}" ${O}/>
    <rect x="29" y="49" width="6" height="10" rx="2" fill="${a.grip}" ${O}/>
    <circle cx="32" cy="60" r="3" fill="${a.guard}" ${O}/></g>`;
}

// v7 armours: the same parts as on the hero, drawn big
function forgeArmorIcon(a) {
  const base = `<path d="M18 12 L26 8 Q32 14 38 8 L46 12 L54 22 L48 28 L46 24 L46 56 Q32 60 18 56 L18 24 L16 28 L10 22 Z" fill="${a.main}" ${O}/>`;
  const acc = a.accent || a.trim;
  const chest = {
    plate: `<path d="M22 18 Q32 24 42 18 L42 36 Q32 42 22 36 Z" fill="${a.trim}" opacity="0.9" ${O}/>`,
    scale: [22, 28, 34, 40].map((y) => [24, 30, 36].map((x) => `<path d="M${x} ${y} q3 6 6 0" fill="${a.trim}" stroke="${INK}" stroke-width="1.3"/>`).join('')).join(''),
    chain: [20, 26, 32, 38, 44].map((y) => [24, 30, 36, 42].map((x) => `<circle cx="${x - (y % 12 ? 0 : 3)}" cy="${y}" r="2.2" fill="none" stroke="${acc}" stroke-width="1.3"/>`).join('')).join(''),
    robe: `<path d="M20 16 L46 50 L42 54 L18 22 Z" fill="${a.trim}" ${O}/>`,
    harness: `<path d="M22 16 L42 50 M42 16 L22 50" stroke="${a.trim}" stroke-width="5"/><rect x="28" y="29" width="8" height="8" rx="1.5" fill="${acc}" ${O}/>`,
    bone: [22, 30, 38, 46].map((y) => `<path d="M21 ${y} Q32 ${y + 5} 43 ${y}" stroke="${a.trim}" stroke-width="4" fill="none" stroke-linecap="round"/>`).join(''),
    crystal: `<path d="M22 18 L30 16 L32 30 L24 34 Z" fill="${acc}" ${O}/><path d="M34 16 L42 19 L40 32 L34 29 Z" fill="${a.trim}" ${O}/><path d="M26 38 L32 32 L38 36 L32 46 Z" fill="${acc}" ${O}/>`,
    leaf: [[24, 22], [32, 20], [40, 22], [28, 32], [36, 32], [32, 42]].map(([x, y]) => `<path d="M${x} ${y - 5} C${x + 5} ${y - 2} ${x + 5} ${y + 4} ${x} ${y + 6} C${x - 5} ${y + 4} ${x - 5} ${y - 2} ${x} ${y - 5} Z" fill="${a.trim}" ${O}/>`).join(''),
    fur: `<path d="M14 18 Q18 10 24 15 Q28 8 32 14 Q36 8 40 15 Q46 10 50 18 Q44 24 32 22 Q20 24 14 18 Z" fill="${acc}" ${O}/>`,
    lamellar: [20, 27, 34, 41, 48].map((y) => `<path d="M19 ${y} Q32 ${y + 4} 45 ${y}" stroke="${a.trim}" stroke-width="2.4" fill="none"/>`).join(''),
  }[a.chest] || '';
  const shoulder = { spike: `<path d="M12 14 L6 4 L16 10 Z M52 14 L58 4 L48 10 Z" fill="${acc}" ${O}/>`, horn: `<path d="M50 12 C54 4 60 2 62 4 C58 6 56 10 54 16 Z" fill="${acc}" ${O}/>`, feather: `<path d="M12 18 C4 12 6 4 12 4 C12 10 16 12 18 14 Z M52 18 C60 12 58 4 52 4 C52 10 48 12 46 14 Z" fill="${acc}" ${O}/>`,
    crystal: `<path d="M10 20 L12 6 L18 16 Z M54 20 L52 6 L46 16 Z" fill="${acc}" ${O}/>`, fur: `<circle cx="13" cy="16" r="6" fill="${acc}" ${O}/><circle cx="51" cy="16" r="6" fill="${acc}" ${O}/>`,
    layered: `<path d="M8 22 L18 12 L22 22 Z M56 22 L46 12 L42 22 Z" fill="${a.trim}" ${O}/>`, round: `<circle cx="14" cy="17" r="6" fill="${a.trim}" ${O}/><circle cx="50" cy="17" r="6" fill="${a.trim}" ${O}/>` }[a.shoulder] || '';
  const emblem = a.emblem && a.emblem !== 'none' ? `<circle cx="32" cy="30" r="5" fill="${acc}" ${O}/>` : '';
  return base + chest + shoulder + emblem;
}

function armorIcon(a) {
  if (a.kind === 'forge') return forgeArmorIcon(a);
  const base = `<path d="M18 12 L26 8 Q32 14 38 8 L46 12 L54 22 L48 28 L46 24 L46 56 Q32 60 18 56 L18 24 L16 28 L10 22 Z" fill="${a.main}" ${O}/>`;
  const extra = {
    cloak: `<path d="M26 8 Q32 18 38 8 L36 20 Q32 24 28 20 Z" fill="${a.trim}" ${O}/><path d="M32 22 L32 54" stroke="${INK}" stroke-width="2" opacity="0.5"/>`,
    vest: `<path d="M24 24 L40 24 M22 34 L42 34 M22 44 L42 44" stroke="${a.trim}" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M32 12 L32 56" stroke="${INK}" stroke-width="2"/>`,
    bark: `<path d="M20 22 L28 28 L20 34 M44 22 L36 28 L44 34 M22 42 L32 48 L42 42" stroke="${a.trim}" stroke-width="3" fill="none"/>`,
    plate: `<path d="M22 20 Q32 26 42 20 L42 30 Q32 36 22 30 Z" fill="${a.trim}" opacity="0.9" ${O}/><path d="M26 40 C30 36 34 44 38 40 M26 48 C30 44 34 52 38 48" stroke="${a.trim}" stroke-width="2.5" fill="none"/>`,
    coat: `<path d="M26 8 L32 22 L38 8" stroke="${a.trim}" stroke-width="3" fill="none"/><circle cx="32" cy="30" r="2" fill="${a.trim}"/><circle cx="32" cy="38" r="2" fill="${a.trim}"/><path d="M18 50 L14 60 L26 60 L28 52 M46 50 L50 60 L38 60 L36 52" fill="${a.main}" ${O}/>`,
    lamellar: [20, 27, 34, 41, 48].map((y) => `<path d="M19 ${y} Q32 ${y + 4} 45 ${y}" stroke="${a.trim}" stroke-width="2.4" fill="none"/>`).join('') + `<path d="M24 18 L24 54 M32 18 L32 56 M40 18 L40 54" stroke="${INK}" stroke-width="1.2" opacity="0.5"/>`,
    robe: `<path d="M20 16 L46 50 L42 54 L18 22 Z" fill="${a.trim}" ${O}/><path d="M18 52 Q32 58 46 52" stroke="${a.trim}" stroke-width="2.5" fill="none"/>`,
    seer: `<path d="M20 16 L46 50 L42 54 L18 22 Z" fill="${a.trim}" opacity="0.85" ${O}/><path d="M38 22 L40 28 L46 28 L41 32 L43 38 L38 34 L33 38 L35 32 L30 28 L36 28 Z" fill="#ffffff" ${O}/>`,
    bastion: `<path d="M20 18 Q32 24 44 18 L44 34 Q32 40 20 34 Z" fill="#8a8680" ${O}/><circle cx="32" cy="28" r="5" fill="${a.trim}" ${O}/><path d="M8 20 L18 12 L22 24 L12 30 Z M56 20 L46 12 L42 24 L52 30 Z" fill="#6a6660" ${O}/>`,
    knight: `<path d="M20 18 Q32 24 44 18 L44 32 Q32 38 20 32 Z" fill="#9aa6b8" ${O}/><path d="M28 34 L36 34 L37 56 L32 60 L27 56 Z" fill="${a.trim}" ${O}/><path d="M32 38 L35 43 L32 48 L29 43 Z" fill="#fff" opacity="0.8"/>`,
    dragonplate: `<path d="M20 18 Q32 24 44 18 L44 34 Q32 40 20 34 Z" fill="#5a1a14" ${O}/><path d="M22 24 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0 M22 30 q3 -3 6 0 q3 -3 6 0 q3 -3 6 0" stroke="${INK}" stroke-width="1.5" fill="none"/><path d="M32 36 L36 42 L32 48 L28 42 Z" fill="${a.trim}" ${O}/><path d="M12 14 L6 4 L16 10 Z M52 14 L58 4 L48 10 Z" fill="${a.trim}" ${O}/>`,
    seraph: `<path d="M20 18 Q32 24 44 18 L44 34 Q32 40 20 34 Z" fill="#fffaf0" ${O}/><path d="M24 26 C27 30 29 30 32 26 C35 30 37 30 40 26" stroke="${a.trim}" stroke-width="2.4" fill="none"/><ellipse cx="32" cy="6" rx="10" ry="3" fill="none" stroke="${a.trim}" stroke-width="2.5"/>`,
  }[a.kind] || '';
  return base + extra;
}

function charmIcon(a) {
  if (a.kind === 'bead') return `<path d="M14 14 Q32 30 50 14" stroke="${PAL.barkDark}" stroke-width="2" fill="none"/>
    <circle cx="20" cy="22" r="6" fill="${a.main}" ${O}/><circle cx="32" cy="28" r="7" fill="${a.main}" ${O}/><circle cx="44" cy="22" r="6" fill="${a.main}" ${O}/>
    <path d="M32 35 L32 44" ${O}/><path d="M26 44 L38 44 L34 56 L30 56 Z" fill="${a.trim}" ${O}/><circle cx="29" cy="25" r="2" fill="#fff" opacity="0.6"/>`;
  if (a.kind === 'tusk') return `<path d="M20 10 Q32 18 44 10" stroke="${PAL.barkDark}" stroke-width="2" fill="none"/>
    <path d="M28 16 C18 26 18 44 30 56 C28 44 32 30 38 18 Z" fill="${a.main}" ${O}/><path d="M24 30 L34 26 M24 38 L32 36" stroke="${a.trim}" stroke-width="2.5"/>`;
  return `<circle cx="32" cy="34" r="20" fill="${PAL.goldDark}" ${O}/><circle cx="32" cy="34" r="14" fill="${a.trim}" ${O}/>
    <path d="M20 34 Q32 22 44 34 Q32 46 20 34 Z" fill="${a.main}" ${O}/><circle cx="32" cy="34" r="4.5" fill="${INK}"/><circle cx="30" cy="32" r="1.4" fill="#fff"/>
    <path d="M32 10 L32 14" ${O}/>`;
}

function materialIcon(a) {
  // relics of the underworld gods: a cracked sigil coin with a burning core
  if (a.kind === 'relic') return `<circle cx="32" cy="32" r="26" fill="${a.main}" opacity="0.22"/>
    <circle cx="32" cy="32" r="20" fill="#2a1a20" ${O}/><circle cx="32" cy="32" r="14" fill="none" stroke="${a.main}" stroke-width="2.4"/>
    <path d="M32 18 L36 30 L46 32 L36 34 L32 46 L28 34 L18 32 L28 30 Z" fill="${a.main}" ${O}/><circle cx="32" cy="32" r="3.4" fill="#ffffff"/>
    <path d="M44 16 L40 24 L46 26" stroke="${a.main}" stroke-width="1.6" fill="none" opacity="0.8"/>`;
  if (a.kind === 'shard') return `<path d="M14 46 L22 22 L32 30 L28 50 Z" fill="${a.main}" ${O}/><path d="M30 50 L36 16 L48 26 L44 52 Z" fill="#b8c0c8" ${O}/><path d="M38 22 L42 44" stroke="#e8edf1" stroke-width="2"/><path d="M18 40 L22 28" stroke="#d3d9de" stroke-width="2"/>`;
  if (a.kind === 'hide') return `<path d="M14 16 Q22 10 32 14 Q42 10 50 16 L48 28 L54 36 L46 40 L48 52 Q32 56 16 52 L18 40 L10 36 L16 28 Z" fill="${a.main}" ${O}/><path d="M22 24 C26 28 24 34 28 36 M38 22 C40 30 36 34 42 40" stroke="#6e452a" stroke-width="2.5" fill="none"/>`;
  if (a.kind === 'bloodstone') return `<circle cx="32" cy="34" r="24" fill="${a.glow}" opacity="0.25"/>
    <path d="M32 6 L46 18 L50 38 L38 56 L26 56 L14 38 L18 18 Z" fill="${a.main}" ${O}/>
    <path d="M32 6 L32 56 M18 18 L46 18 M14 38 L50 38" stroke="${INK}" stroke-width="1.4" opacity="0.45"/>
    <path d="M32 22 C36 28 40 31 40 36 A8 8 0 0 1 24 36 C24 31 28 28 32 22 Z" fill="${a.glow}" ${O}/>
    <path d="M22 16 L28 10" stroke="#ffd0c0" stroke-width="3" stroke-linecap="round"/>`;
  return `<circle cx="32" cy="32" r="22" fill="${a.glow}" opacity="0.3"/><path d="M32 10 L48 24 L44 46 L32 54 L20 46 L16 24 Z" fill="${a.main}" ${O}/><path d="M32 10 L32 54 M16 24 L48 24 M20 46 L44 46" stroke="${INK}" stroke-width="1.5" opacity="0.5"/><path d="M24 20 L30 14" stroke="${a.glow}" stroke-width="3" stroke-linecap="round"/>`;
}

function potionIcon(a) {
  return `<rect x="26" y="6" width="12" height="8" rx="2" fill="#a87848" ${O}/><path d="M27 14 L27 22 C16 26 12 34 14 44 C16 54 24 58 32 58 C40 58 48 54 50 44 C52 34 48 26 37 22 L37 14 Z" fill="#d9e4e6" ${O}/>
    <path d="M15 40 C20 36 44 36 49 40 C48 52 40 56 32 56 C24 56 16 52 15 40 Z" fill="${a.main}"/><circle cx="24" cy="32" r="3" fill="#fff" opacity="0.7"/>
    <path d="M27 14 L27 22 C16 26 12 34 14 44 C16 54 24 58 32 58 C40 58 48 54 50 44 C52 34 48 26 37 22 L37 14" fill="none" ${O}/>`;
}

export function itemIconSvg(id) {
  const def = getItem(id);
  if (!def) return wrap(`<rect x="12" y="12" width="40" height="40" rx="6" fill="#555" ${O}/><path d="M26 26 L38 38 M38 26 L26 38" ${O}/>`);
  const a = def.art;
  if (a && a.icon) { const egy = egyIconSvg(a.icon, a); if (egy) return egy; }   // v9.3: items drawn by hand for the Egypt dungeon
  switch (def.category) {
    case 'weapon': return wrap(weaponIconBody(a) ?? bladeIcon(a));
    case 'armor': return wrap(armorIcon(a));
    case 'charm': return wrap(charmIcon(a));
    case 'material': return wrap(materialIcon(a));
    case 'consumable': return wrap(potionIcon(a));
    case 'wings': return wingsIcon(a);
    default: return wrap('');
  }
}

// a pair of wings: the wing sprite twice, mirrored, around a small glowing core
function wingsIcon(a) {
  const spr = wingSprite(a);
  const defs = (spr.svg.match(/<defs>([\s\S]*?)<\/defs>/) || [])[1] || '';
  const body = (spr.svg.match(/<\/defs>([\s\S]*?)<\/svg>/) || [])[1] || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>
    <circle cx="32" cy="40" r="14" fill="${a.glow || a.trim}" opacity="0.28"/>
    <g transform="translate(32 50) scale(0.34) translate(${-spr.ax} ${-spr.ay})">${body}</g>
    <g transform="translate(32 50) scale(-0.34 0.34) translate(${-spr.ax} ${-spr.ay})">${body}</g>
    <circle cx="32" cy="46" r="4" fill="${a.trim}" ${O}/></svg>`;
}

export function goldIconSvg() {
  return wrap(`<ellipse cx="32" cy="36" rx="20" ry="18" fill="${PAL.goldDark}" ${O}/><ellipse cx="32" cy="32" rx="20" ry="18" fill="${PAL.gold}" ${O}/>
    <ellipse cx="32" cy="32" rx="12" ry="10" fill="none" stroke="${PAL.goldDark}" stroke-width="2.5"/><path d="M28 28 L36 36 M36 28 L28 36" stroke="${PAL.goldDark}" stroke-width="2.5"/>
    <path d="M18 24 C20 20 24 18 28 17" stroke="#fff3c4" stroke-width="3" stroke-linecap="round" fill="none"/>`);
}

// Amber Spark: the pet-summon currency.
export function sparkIconSvg() {
  return wrap(`<circle cx="32" cy="32" r="26" fill="#ffb35a" opacity="0.22"/>
    <path d="M32 4 L39 24 L60 32 L39 40 L32 60 L25 40 L4 32 L25 24 Z" fill="#f5b041" ${O}/>
    <path d="M32 14 L36 28 L50 32 L36 36 L32 50 L28 36 L14 32 L28 28 Z" fill="#ffe2a0"/>
    <circle cx="32" cy="32" r="5" fill="#fff6dc"/>`);
}

// ---- UI glyphs (line icons drawn with currentColor)
const G = (p) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const UI = Object.freeze({
  atk: G('<path d="M14.5 3.5 20.5 3.5 20.5 9.5 9 21 3 15Z"/><path d="M6 12l6 6"/>'),
  def: G('<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="M12 7v10"/>'),
  hp: G('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>'),
  crit: G('<path d="M12 2.5 14 9l6.5.5-5 4 1.8 6.5L12 16.3 6.7 20l1.8-6.5-5-4L10 9Z"/>'),
  critMult: G('<path d="M4 20 20 4"/><path d="M14 4h6v6"/><path d="M4 14v6h6"/>'),
  spd: G('<path d="M4 16c4 0 6-8 10-8h6"/><path d="M4 11h5M4 20h9"/><path d="M17 5l3 3-3 3"/>'),
  gold: G('<ellipse cx="12" cy="12" rx="8" ry="7"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>'),
  bag: G('<path d="M6 8h12l-1 12H7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  hammer: G('<path d="M14 4l6 6-3 3-6-6Z"/><path d="M11 7 3.5 14.5a2 2 0 0 0 0 3l3 3a2 2 0 0 0 3 0L17 13"/>'),
  map: G('<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2Z"/><path d="M9 4v14M15 6v14"/>'),
  shop: G('<path d="M4 9l2-5h12l2 5"/><path d="M4 9h16v2a3 3 0 0 1-5.3 2A3 3 0 0 1 12 14a3 3 0 0 1-2.7-1A3 3 0 0 1 4 11Z"/><path d="M6 14v6h12v-6"/>'),
  gear: G('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  pause: G('<path d="M8 5v14M16 5v14"/>'),
  close: G('<path d="M6 6l12 12M18 6 6 18"/>'),
  lock: G('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: G('<path d="M5 12l5 5 9-10"/>'),
  up: G('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: G('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  dash: G('<path d="M3 12h10M6 8h8M6 16h8"/><path d="M14 6l6 6-6 6"/>'),
  potion: G('<path d="M10 3h4M10 3v5L6 14a5 5 0 0 0 4.5 7h3A5 5 0 0 0 18 14l-4-6V3"/><path d="M7.5 15h9"/>'),
  sword: G('<path d="M14.5 3.5 20.5 3.5 20.5 9.5 9 21 3 15Z"/><path d="M6 12l6 6"/>'),
  sound: G('<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  music: G('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  shake: G('<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M3 9v6M21 9v6"/>'),
  expand: G('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  rotate: G('<rect x="4" y="8" width="16" height="10" rx="2"/><path d="M8 4h6a4 4 0 0 1 4 4"/><path d="M16 6l2 2-2 2"/>'),
  back: G('<path d="M15 5l-7 7 7 7"/>'),
  sell: G('<path d="M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8"/>'),
  equip: G('<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  skull: G('<path d="M5 11a7 7 0 1 1 14 0c0 2.5-1.2 4-3 5v3H8v-3c-1.8-1-3-2.5-3-5Z"/><circle cx="9.5" cy="11" r="1.5"/><circle cx="14.5" cy="11" r="1.5"/>'),
  crown: G('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5Z"/>'),
  whirl: G('<path d="M12 4a8 8 0 1 1-7.5 5.2"/><path d="M12 8a4 4 0 1 1-3.8 2.8"/><path d="M4.5 4.5v4.7h4.7"/>'),
  lunge: G('<path d="M3 17l9-9"/><path d="M12 8l3-3 4 4-3 3"/><path d="M3 12h4M5 20h6"/>'),
  snare: G('<circle cx="12" cy="13" r="7"/><path d="M12 6l-2-3M5.5 9.5 3 8M18.5 9.5 21 8M8 19l-2 2M16 19l2 2"/><path d="M9 13l2 2 4-4"/>'),
  ward: G('<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="M12 8c1.5 1.8 3 3 3 5a3 3 0 0 1-6 0c0-1 .5-2 1-2.5 0 1 .6 1.6 1.2 1.6 0-1.6-.2-2.8.8-4.1Z"/>'),
  eye: G('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  blood: G('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>'),
  wind: G('<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>'),
  hide: G('<path d="M5 4h14l1 6-3 10H7L4 10Z"/><path d="M8 9l8 0M9 13h6"/>'),
  key: G('<circle cx="8" cy="8" r="4.5"/><path d="M11.2 11.2 20 20M16 16l2-2M18.5 18.5l2-2"/>'),
  book: G('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5M8 7h7M8 11h7"/>'),
  talk: G('<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/>'),
  hand: G('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.5-1.6L8 13"/>'),
  door: G('<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M3 21h18M14 12h.01"/>'),
  skip: G('<path d="M5 5l8 7-8 7Z"/><path d="M15 5v14"/>'),
  katana: G('<path d="M20 3c-4 6-9 11-15 15"/><path d="M4 17l3 3"/><path d="M3.5 20.5l2-2"/>'),
  dagger: G('<path d="M7 4l5 9M17 4l-5 9"/><path d="M9.5 13.5l5 0M12 13v7"/>'),
  greatsword: G('<path d="M12 2l3 3v11H9V5Z"/><path d="M6 16h12M12 16v6"/>'),
  staff: G('<circle cx="15" cy="6" r="3"/><path d="M13 8 5 21"/><path d="M18 3l2-1M19 7h2"/>'),
  bow: G('<path d="M6 3c8 3 12 9 12 9s-4 6-12 9"/><path d="M6 3v18"/><path d="M4 12h15l-3-2M19 12l-3 2"/>'),
  spear: G('<path d="M20 4l-3 7-2-2Z"/><path d="M15 9 4 20"/><path d="M14 12l-3-3"/>'),
  paw: G('<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5a2.5 2.5 0 0 1-4 1.5A2.5 2.5 0 0 1 8 17Z"/>'),
  dna: G('<path d="M7 3c0 6 10 6 10 12s-10 6-10 6"/><path d="M17 3c0 6-10 6-10 12"/><path d="M8.5 7h7M8.5 17h7"/>'),
  spark: G('<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2Z"/>'),
  star: G('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8 6.7 19.6l1-5.8-4.2-4.1 5.9-.9Z"/>'),
  dice: G('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>'),
  race: G('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6Z"/><path d="M9 11c1-2 5-2 6 0M9.5 15c1.5 1 3.5 1 5 0"/>'),
  people: G('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.4 5.5 5.8"/>'),
  friend: G('<circle cx="10" cy="8" r="3.4"/><path d="M3.5 20c0-3.8 2.9-6.3 6.5-6.3 1.6 0 3 .5 4.1 1.3"/><path d="M18 13v7M14.5 16.5h7"/>'),
  party: G('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/><circle cx="17.5" cy="18" r="2.5"/><circle cx="11" cy="18" r="2.5"/>'),
  duel: G('<path d="M4 4l10 10M14 14l2.5-.5L20 17l-3 3-3.5-3.5Z"/><path d="M20 4 10 14M10 14l-2.5-.5L4 17l3 3 3.5-3.5Z"/>'),
  send: G('<path d="M4 12 20 4l-4 16-4-7Z"/><path d="M12 13 20 4"/>'),
  globe: G('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 3.5 6 3.5 9s-1 6-3.5 9c-2.5-3-3.5-6-3.5-9s1-6 3.5-9Z"/>'),
  chat: G('<path d="M4 5h16v11H9l-5 4Z"/><circle cx="8.5" cy="10.5" r=".6"/><circle cx="12" cy="10.5" r=".6"/><circle cx="15.5" cy="10.5" r=".6"/>'),
  scythe: G('<path d="M7 21 15 4"/><path d="M15 4c-4.5-.8-9 1.2-11 5 3.2-1.5 6.6-1.8 9.8-.6"/>'),
  twinblades: G('<path d="M4 20 15 6l2-3 .5 3.5L6 21"/><path d="M20 20 9 6 7 3l-.5 3.5L18 21"/>'),
  wings: G('<path d="M12 9c-2-4-6-5-9-4 1 4 3 7 9 9"/><path d="M12 9c2-4 6-5 9-4-1 4-3 7-9 9"/><path d="M5 9.5c1.5.5 3 1.5 4 3M19 9.5c-1.5.5-3 1.5-4 3"/>'),
  dragon: G('<path d="M4 17c2-6 6-10 12-10 2 0 3.5 1 4 2.5L17 10l2 2-4 .5c-1 3-4 5-8 5"/><path d="M9 8 7 4l4 3M14 7l1-4 1.5 4"/><circle cx="16.5" cy="9" r=".6"/>'),
  infinity: G('<path d="M12 12c-2-3-4-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2 0 4-1.5 6-4.5s4-4.5 6-4.5a4.5 4.5 0 0 1 0 9c-2 0-4-1.5-6-4.5Z"/>'),
  cosmos: G('<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)"/><path d="M19 4.5v2M18 5.5h2M5 18v1.6M4.2 18.8h1.6"/>'),
  clock: G('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'),
  scroll: G('<path d="M7 4h11v13a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2v-1h11v1a2 2 0 0 0 2 2"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M9 8h6M9 11h6M9 14h3"/>'),
  anvil: G('<path d="M3 8h13c0 3 2 4 5 4v1H16l-2 3H9l-2-3H5c-1.2 0-2-1-2-2Z"/><path d="M8 16l-2 4h12l-2-4"/>'),
  shield: G('<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z"/><path d="M8 11.5l3 3 5-6"/>'),
  exit: G('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
});

export const svgDataUri = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
