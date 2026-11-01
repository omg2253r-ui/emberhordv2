// The hunter as a jointed character: each part is its own illustration with a pivot (anchor),
// so legs, arms, head and scarf can move independently. All parts face right; the rig flips for left.
// Rig space: origin (0,0) at the feet, y grows downward, total height ≈ 100.
import { PAL, INK } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}
const grad = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// Pivot positions in rig space (where each part attaches).
export const RIG = Object.freeze({
  hipBack: { x: -5, y: -31 }, hipFront: { x: 6, y: -31 },
  body: { x: 0, y: -31 },
  neck: { x: 3, y: -63 },
  shoulderBack: { x: -7, y: -56 }, shoulderFront: { x: 9, y: -55 },
  scarf: { x: -5, y: -61 },
  armLen: 21,
});

// Bloodline traits drawn onto the head (rig head space, before the 10px headroom shift).
// Face: centre (30, 26.5), eyes (28.5, 27) and (37.5, 27), mouth (35, 34.5); the hood's crown is near (26, 2).
// v7 traits take their colour from look.tc; a race may stack a second trait (look.trait2).
function oneTrait(trait, look, front) {
  const skin = look.skin, hair = look.hair, tc = look.tc || '#ffd08a', dk = shade(tc, 0.6);
  switch (trait) {
    case 'ears': return `<path d="M17 16 L2 3 L12 21 Z" fill="${skin}" ${O2}/><path d="M14 15 L6 7.5" stroke="${look.shade}" stroke-width="1.4"/>`;
    case 'horns': return `<path d="M20 7 C16 -3 6 -5 1 1 C8 0 12 4 14 10 Z" fill="${look.tc && look.trait2 ? '#d8ccb6' : '#ebe0cc'}" ${O2}/><path d="M6 -1 C9 0 11 2 12 5" stroke="#b8a890" stroke-width="1.2" fill="none"/>
      <path d="M33 5 C34 -4 42 -6 48 -3 C42 -1 39 3 38 8 Z" fill="#d8ccb6" ${O2}/>`;
    case 'scales': return `<path d="M19 29 q2 -2.4 4 0 q2 -2.4 4 0 M20.5 33 q2 -2.4 4 0 M41 30 q1.6 -2 3.2 0" stroke="${INK}" stroke-width="1" fill="#c4492e"/>
      <path d="M12 13 L7 9 L13 11 Z M16 9 L13 3 L18 7 Z" fill="#c4492e" ${O2}/>`;
    case 'leaves': return `<path d="M20 6 C14 -2 20 -8 26 -2 C26 2 24 5 20 6 Z" fill="#6aa25a" ${O2}/><path d="M28 4 C28 -6 36 -8 40 -2 C38 2 33 4 28 4 Z" fill="#8fd06a" ${O2}/>
      <path d="M11 11 C3 8 2 1 8 -1 C11 2 12 6 11 11 Z" fill="#4b8a3a" ${O2}/><path d="M22 0 L23 4 M33 -2 L32 2" stroke="#2e5a22" stroke-width="1"/>
      <path d="M19 19 C22 13 30 12 38 15" stroke="${hair}" stroke-width="2.4" fill="none"/>`;
    case 'marks': return `<path d="M35 30 L38.5 35.5 L36.5 38 M22.5 27 L21 33" stroke="#ffd08a" stroke-width="1.6" fill="none"/>
      <path d="M28 16 L30 19 L33 16" stroke="#ffd08a" stroke-width="1.3" fill="none"/>
      <circle cx="37.5" cy="27" r="4" fill="#ffd08a" opacity="0.25"/><circle cx="28.5" cy="27" r="4" fill="#ffd08a" opacity="0.2"/>`;
    // ---------------------------------------------------------------- v7
    case 'tusks': return front ? `<path d="M33 35.5 C36 37 39 35 38.5 30.5 C37.6 33 36 34 33.6 34 Z" fill="${tc}" ${O2}/><path d="M24 35 C22 37 20 36 20 32 C21 33.6 22.4 34 24 34 Z" fill="${tc}" ${O2}/>` : '';
    case 'feathers': return `<path d="M17 8 C8 2 2 -6 4 -10 C10 -6 14 0 19 5 Z" fill="${tc}" ${O2}/><path d="M22 4 C18 -4 18 -12 22 -14 C25 -8 25 -2 25 3 Z" fill="${shade(tc, 0.85)}" ${O2}/><path d="M13 12 C4 10 -2 4 -1 0 C6 2 11 6 15 10 Z" fill="${shade(tc, 1.1)}" ${O2}/>
      <path d="M6 -6 L17 6 M21 -10 L23 2 M2 1 L14 10" stroke="${dk}" stroke-width="0.9"/>`;
    case 'catears': return `<path d="M17 8 C14 0 14 -6 18 -8 C22 -6 25 -1 24 5 Z" fill="${hair}" ${O2}/><path d="M18 3 C17 -1 18 -4 19.5 -5 C21 -3 22 0 21.6 3.6 Z" fill="#f0b0a0"/>
      <path d="M31 4 C31 -3 34 -8 38 -8 C41 -5 41 1 38 7 Z" fill="${hair}" ${O2}/><path d="M33 3 C33.4 -1 35 -4 37 -5 C38.4 -2 38 1 37 4 Z" fill="#f0b0a0"/>`;
    case 'mushroom': return `<path d="M3 12 C2 -2 14 -10 28 -10 C42 -10 52 -2 50 10 C42 6 34 5 26 5 C17 5 9 7 3 12 Z" fill="${tc}" ${O}/>
      <circle cx="16" cy="-2" r="2.8" fill="#fff3e8"/><circle cx="30" cy="-6" r="3.4" fill="#fff3e8"/><circle cx="42" cy="0" r="2.4" fill="#fff3e8"/><circle cx="24" cy="2" r="1.8" fill="#fff3e8"/>`;
    case 'bunny': return `<path d="M18 7 C12 -6 12 -18 17 -20 C22 -16 23 -4 22 5 Z" fill="${tc}" ${O2}/><path d="M17.5 2 C15 -8 15.5 -14 17 -16 C19 -12 19.6 -4 19.4 1 Z" fill="#f0b0c0"/>
      <path d="M27 4 C26 -10 30 -20 35 -19 C38 -14 34 -4 31 5 Z" fill="${tc}" ${O2}/><path d="M28.6 1 C28.6 -8 31 -14 33 -15 C34 -11 32 -4 30.6 1 Z" fill="#f0b0c0"/>`;
    case 'fins': return `<path d="M16 16 L2 4 L4 10 L-1 10 L5 16 L0 20 L12 21 Z" fill="${tc}" ${O2}/><path d="M14 16 L4 8 M13 18 L3 14" stroke="${dk}" stroke-width="1"/>
      ${front ? `<path d="M40 33 q2 -1.2 3 0.4 M40.4 35.4 q2 -1.2 3 0.4" stroke="${dk}" stroke-width="1" fill="none"/>` : ''}`;
    case 'crystal': return `<path d="M14 9 L8 -6 L18 5 Z" fill="${tc}" ${O2}/><path d="M22 4 L22 -14 L28 2 Z" fill="${shade(tc, 1.15)}" ${O2}/><path d="M32 4 L38 -10 L37 6 Z" fill="${tc}" ${O2}/>
      <path d="M22 -10 L24 1 M9 -3 L15 6" stroke="#ffffff" stroke-width="1" opacity="0.8"/>`;
    case 'thorns': return `<path d="M6 12 C12 4 22 1 32 2 C40 3 46 8 48 13" stroke="${tc}" stroke-width="3" fill="none"/>
      <path d="M9 8 L5 2 L12 6 M16 4 L14 -3 L19 3 M25 2 L25 -5 L28 2 M34 2 L37 -4 L37 3 M42 6 L47 1 L44 8" stroke="${tc}" stroke-width="1.8" fill="${dk}" stroke-linejoin="round"/>`;
    case 'icicles': return `<path d="M6 12 C12 3 22 0 32 1 C41 2 47 7 49 12" stroke="#ffffff" stroke-width="3" fill="none"/>
      <path d="M10 6 L8 -6 L14 4 Z M19 2 L19 -10 L24 1 Z M29 1 L32 -12 L34 1 Z M39 3 L44 -7 L44 6 Z" fill="${tc}" ${O2}/>
      <path d="M8 18 L7 25 L10 19 Z M46 20 L48 27 L49 20 Z" fill="${tc}" ${O2}/>`;
    case 'bolts': return `<path d="M14 9 L8 -4 L14 0 L11 -10 L20 4 Z" fill="${tc}" ${O2}/><path d="M24 3 L22 -12 L27 -4 L28 -16 L32 2 Z" fill="${tc}" ${O2}/><path d="M35 4 L40 -8 L40 -1 L46 -9 L42 7 Z" fill="${tc}" ${O2}/>`;
    case 'antlers': return `<path d="M18 6 L12 -8 M14 -3 L6 -6 M12 -8 L14 -14 M12 -8 L7 -14 M31 3 L36 -10 M34 -5 L42 -7 M36 -10 L34 -16 M36 -10 L41 -15" stroke="${INK}" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      <path d="M18 6 L12 -8 M14 -3 L6 -6 M12 -8 L14 -14 M12 -8 L7 -14 M31 3 L36 -10 M34 -5 L42 -7 M36 -10 L34 -16 M36 -10 L41 -15" stroke="${tc}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    case 'antennae': return `<path d="M22 4 C20 -4 14 -10 8 -12 M31 3 C34 -5 40 -10 47 -11" stroke="${INK}" stroke-width="1.4" fill="none"/>
      <path d="M8 -12 C10 -9 14 -6 18 -1 C12 -3 8 -6 6 -9 Z M47 -11 C44 -8 40 -5 36 -1 C42 -3 46 -6 49 -8 Z" fill="${tc}" ${O2}/>`;
    case 'tentacles': return `<path d="M8 14 C2 18 -2 26 2 34 C4 30 6 26 10 24" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M8 14 C2 18 -2 26 2 34 C4 30 6 26 10 24" stroke="${tc}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M6 22 C0 28 0 38 6 42" stroke="${INK}" stroke-width="4.4" fill="none" stroke-linecap="round"/><path d="M6 22 C0 28 0 38 6 42" stroke="${shade(tc, 0.85)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <circle cx="1.5" cy="30" r="0.9" fill="#fff"/><circle cx="2.4" cy="36" r="0.9" fill="#fff"/>`;
    case 'flame': return `<path d="M8 12 C2 4 6 -6 10 -10 C10 -4 14 -2 16 -6 C16 -12 22 -18 26 -18 C24 -12 28 -8 30 -12 C34 -8 34 -4 36 -8 C42 -4 46 2 46 10 C40 4 30 2 22 3 C16 4 11 7 8 12 Z" fill="${tc}" ${O2}/>
      <path d="M14 6 C12 0 14 -4 16 -2 C18 -6 22 -10 24 -8 C24 -4 28 -2 30 -4 C34 0 36 2 38 6 C30 2 22 2 14 6 Z" fill="#fff3c4" opacity="0.85"/>`;
    case 'gem': return front ? `<path d="M33 12 L36 16 L33 20.5 L30 16 Z" fill="${tc}" ${O2}/><path d="M31.6 15.6 L33 13.6" stroke="#ffffff" stroke-width="1"/><circle cx="33" cy="16.4" r="5" fill="${tc}" opacity="0.2"/>` : '';
    case 'stripes': return front ? `<path d="M41 29 L45 29.6 M40.5 32 L44.6 33.2 M19 29 L22 29.6 M19.6 32.4 L22.4 32.8 M31 14 L32 18 M35 14.4 L35.2 18" stroke="${tc}" stroke-width="1.8" stroke-linecap="round"/>` : '';
    case 'halo': return `<ellipse cx="27" cy="-6" rx="14" ry="3.6" fill="none" stroke="${INK}" stroke-width="3.8"/><ellipse cx="27" cy="-6" rx="14" ry="3.6" fill="none" stroke="${tc}" stroke-width="2.2"/><ellipse cx="27" cy="-6" rx="18" ry="6" fill="${tc}" opacity="0.18"/>`;
    case 'thirdeye': return front ? `<ellipse cx="33" cy="16.5" rx="2.2" ry="3.2" fill="#fff" ${O2}/><ellipse cx="33.3" cy="16.8" rx="1.3" ry="2" fill="${tc}"/><circle cx="33.6" cy="15.9" r="0.5" fill="#fff"/><circle cx="33" cy="16.5" r="5.6" fill="${tc}" opacity="0.16"/>` : '';
    case 'ramhorns': return `<path d="M17 9 C10 4 2 6 2 14 C2 20 8 22 12 18 C14 15 12 12 9 13" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M17 9 C10 4 2 6 2 14 C2 20 8 22 12 18 C14 15 12 12 9 13" stroke="#c8b49a" stroke-width="3.8" fill="none" stroke-linecap="round"/>
      <path d="M29 3 C30 -4 38 -8 44 -4 C40 -3 37 0 36 5 Z" fill="#c8b49a" ${O2}/><path d="M5 10 l2 2 M3 15 l3 0" stroke="#8a7a64" stroke-width="1"/>`;
    case 'unihorn': return `<path d="M30 6 L37 -16 L35 7 Z" fill="${tc}" ${O2}/><path d="M31.5 2 L35.5 0.6 M32.4 -3.4 L36 -4.6 M33.4 -8.6 L36.4 -9.6" stroke="${shade(tc, 0.7)}" stroke-width="1"/><circle cx="36" cy="-12" r="5" fill="${tc}" opacity="0.25"/>`;
    case 'skullcap': return `<path d="M4 18 C2 4 14 -6 27 -6 C40 -6 50 4 48 16 C42 12 36 11 28 11 C18 11 10 13 4 18 Z" fill="${tc}" ${O}/>
      <ellipse cx="22" cy="3" rx="4" ry="3.4" fill="${INK}"/><ellipse cx="35" cy="2" rx="4" ry="3.4" fill="${INK}"/><circle cx="22" cy="3" r="1.2" fill="${look.eye}"/><circle cx="35" cy="2" r="1.2" fill="${look.eye}"/>
      <path d="M12 13 l1.6 3 l1.6 -3 l1.6 3 l1.6 -3 M38 12 l1.6 3 l1.6 -3 l1.6 3" stroke="${INK}" stroke-width="1" fill="#fff"/>`;
    case 'headwings': return `<path d="M15 14 C6 6 -2 6 -4 10 C2 11 2 14 -2 16 C4 17 4 19 1 21 C8 21 12 19 15 17 Z" fill="${tc}" ${O2}/><path d="M13 15 L0 11 M12 16 L1 18" stroke="${shade(tc, 0.7)}" stroke-width="0.9"/>`;
    case 'starcrown': {
      const st = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${tc}" ${O2}/>`;
      return st(14, -2, 4) + st(26, -9, 5) + st(39, -3, 4) + (front ? `<circle cx="40" cy="31" r="0.9" fill="${tc}"/><circle cx="42" cy="29" r="0.7" fill="${tc}"/><circle cx="21" cy="31" r="0.8" fill="${tc}"/>` : '');
    }
    case 'blossom': return [[12, 6, 4.4], [22, -1, 5], [35, 1, 4.6], [44, 9, 3.6]].map(([x, y, r]) =>
      `<g>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(x + Math.cos(a * Math.PI / 180) * r * 0.6).toFixed(1)}" cy="${(y + Math.sin(a * Math.PI / 180) * r * 0.6).toFixed(1)}" r="${(r * 0.5).toFixed(1)}" fill="${tc}" stroke="${INK}" stroke-width="0.9"/>`).join('')}<circle cx="${x}" cy="${y}" r="${(r * 0.32).toFixed(1)}" fill="#ffe65a"/></g>`).join('')
      + `<path d="M7 12 C14 6 24 3 34 4" stroke="#5d8a3e" stroke-width="1.6" fill="none"/>`;
    case 'runes': return front ? `<path d="M41 28 L44 31 L41 34 M19.5 27 L22 30 L19.5 33 M30 14 L33 17.6 L36 14 M27 40 L33 40" stroke="${tc}" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="33" cy="16" r="5" fill="${tc}" opacity="0.18"/>` : '';
    case 'mask': return front ? `<path d="M16 19 C22 16 34 15 44 18 C45 22 44 25 42 27 C38 25 33 25 30 27 C26 25 21 25 17 27 C15.6 25 15.4 22 16 19 Z" fill="${tc}" ${O2}/>
      <ellipse cx="28.5" cy="22" rx="2.6" ry="1.5" fill="${look.eye}"/><ellipse cx="37.5" cy="22" rx="2.4" ry="1.4" fill="${look.eye}"/><path d="M22 18 L24 15 M40 17.6 L42 15" stroke="${look.eye}" stroke-width="1"/>` : '';
    case 'dragon': return `<path d="M18 8 C10 2 2 -4 -6 -4 C0 0 4 4 8 12 Z" fill="${tc}" ${O2}/><path d="M28 3 C24 -4 18 -12 10 -14 C16 -8 20 -2 22 5 Z" fill="${shade(tc, 0.85)}" ${O2}/>
      <path d="M2 -2 L6 4 M14 -9 L18 0" stroke="${dk}" stroke-width="1"/>
      ${front ? `<path d="M40 31 q1.6 -2 3.2 0 q1.6 -2 3.2 0 M20 31 q1.6 -2 3.2 0" stroke="${INK}" stroke-width="0.9" fill="${tc}"/>` : ''}`;
    default: return '';
  }
}
// traits that sit behind the face are drawn first, the ones on the face after it
const ON_FACE = new Set(['tusks', 'gem', 'stripes', 'thirdeye', 'runes', 'mask', 'marks', 'scales']);
function headTrait(look) {
  return [look.trait, look.trait2].filter(Boolean).map((t) => oneTrait(t, look, true)).join('');
}
export const TRAITS_V7 = Object.freeze(['tusks', 'feathers', 'catears', 'mushroom', 'bunny', 'fins', 'crystal', 'thorns', 'icicles', 'bolts', 'antlers', 'antennae', 'tentacles', 'flame', 'gem', 'stripes', 'halo', 'thirdeye', 'ramhorns', 'unihorn', 'skullcap', 'headwings', 'starcrown', 'blossom', 'runes', 'mask', 'dragon']);
void ON_FACE;

export const DEFAULT_LOOK = Object.freeze({ skin: '#f6dcb6', shade: PAL.skinShade, hair: '#3b2a24', eye: INK, trait: 'none' });

// Armour details layered over the cloth: chest plates, lamellar rows, coat tails, robes, sashes, pauldrons.
// Each kind reads differently in silhouette at play size while keeping the same jointed rig.
const PLATED = new Set(['plate', 'bastion', 'knight', 'dragonplate', 'seraph', 'lamellar']);
function armorDetail(kind, c) {
  const { main, trim, dark, light, trimDark, trimLight } = c;
  const metal = kind === 'seraph' ? '#fffaf0' : kind === 'dragonplate' ? shade(main, 1.5) : kind === 'knight' ? '#9aa6b8' : kind === 'bastion' ? '#8a8680' : shade(main, 1.8);
  const metalDark = shade(metal, 0.62);
  let body = '', arm = '';
  if (kind === 'plate' || kind === 'bastion' || kind === 'knight' || kind === 'dragonplate' || kind === 'seraph') {
    body += `<path d="M11 12 Q23 7 35 12 L34 29 Q23 32 12 29 Z" fill="${metal}" ${O2}/>
      <path d="M13 13.5 Q23 10 33 13.5" stroke="${shade(metal, 1.2)}" stroke-width="1.4" fill="none"/>
      <path d="M23 10 L23 30" stroke="${metalDark}" stroke-width="1.3"/>
      <path d="M12 21 Q23 24 34 21" stroke="${metalDark}" stroke-width="1.2" fill="none"/>`;
    arm += `<path d="M0.6 7.5 C-0.2 2 3.8 0.6 8 0.6 C12.2 0.6 16.2 2 15.4 7.5 Q8 10 0.6 7.5 Z" fill="${metal}" ${O2}/>
      <path d="M2.5 5 Q8 3 13.5 5" stroke="${shade(metal, 1.25)}" stroke-width="1.1" fill="none"/>`;
  }
  if (kind === 'bastion') {
    body += `<path d="M8 13 L14 10 L15 30 L9 29 Z M38 13 L32 10 L31 30 L37 29 Z" fill="${metalDark}" ${O2}/>
      <circle cx="23" cy="19" r="4" fill="${trim}" ${O2}/><circle cx="23" cy="19" r="1.6" fill="${metalDark}"/>`;
    arm += `<path d="M2 8.5 L14 8.5 L13 11 L3 11 Z" fill="${metalDark}" ${O2}/>`;
  }
  if (kind === 'knight') {
    body += `<path d="M19 26 L27 26 L28 44 L23 46 L18 44 Z" fill="${trim}" ${O2}/>
      <path d="M23 30 L25.5 34 L23 38 L20.5 34 Z" fill="${trimLight}" ${O2}/>`;
  }
  if (kind === 'dragonplate') {
    body += `<path d="M14 15 q2 -2.6 4 0 q2 -2.6 4 0 q2 -2.6 4 0 q2 -2.6 4 0 M15 20 q2 -2.6 4 0 q2 -2.6 4 0 q2 -2.6 4 0 q2 -2.6 4 0" stroke="${metalDark}" stroke-width="1.2" fill="none"/>
      <path d="M23 21 L26 25 L23 29 L20 25 Z" fill="${trim}" ${O2}/><circle cx="23" cy="25" r="1.4" fill="${trimLight}"/>`;
    arm += `<path d="M10.5 2 L15.5 -0.5 L13.6 4.6 Z M5 2.2 L2.4 -0.4 L2.6 4.4 Z" fill="${trimDark}" ${O2}/>`;
  }
  if (kind === 'seraph') {
    body += `<path d="M15 16 C18 19 20 19 23 16 C26 19 28 19 31 16" stroke="${trim}" stroke-width="1.4" fill="none"/>
      <path d="M23 22 L24.6 25 L23 28 L21.4 25 Z" fill="${trim}"/>`;
    arm += `<path d="M2 7 C0 10 1 14 3 15 M14 7 C16 10 15 14 13 15" stroke="${trim}" stroke-width="1.2" fill="none"/>`;
  }
  if (kind === 'lamellar') {
    for (const y of [14, 18.5, 23, 27.5]) body += `<path d="M11.5 ${y} Q23 ${y + 2.6} 34.5 ${y}" stroke="${trimDark}" stroke-width="1.2" fill="none"/>`;
    for (const x of [15, 19, 23, 27, 31]) body += `<path d="M${x} 13 L${x} 30" stroke="${shade(main, 0.5)}" stroke-width="0.9" opacity="0.8"/>`;
    arm += `<path d="M2.5 9 L13.5 9 M3 12 L13 12" stroke="${trimDark}" stroke-width="1.1"/>`;
  }
  if (kind === 'coat') {
    body += `<path d="M9 35 L6.5 45 L15 45.5 L17.5 36.5 Z M37 35 L39.5 45 L31 45.5 L28.5 36.5 Z" fill="${dark}" ${O2}/>
      <path d="M17 12 L23 20 L29 12" stroke="${trim}" stroke-width="1.8" fill="none"/>
      <circle cx="23" cy="23" r="1.2" fill="${trim}"/><circle cx="23" cy="27" r="1.2" fill="${trim}"/>`;
  }
  if (kind === 'robe' || kind === 'seer') {
    body += `<path d="M12 11 L35 31 L32 33 L10 14 Z" fill="${trim}" opacity="0.9" ${O2}/>
      <path d="M8 40 Q23 45 38 40" stroke="${trimLight}" stroke-width="1.6" fill="none"/>`;
    if (kind === 'seer') body += `<path d="M28 18 L29.2 21 L32 21.4 L29.8 23.2 L30.6 26 L28 24.4 L25.4 26 L26.2 23.2 L24 21.4 L26.8 21 Z" fill="${trimLight}" ${O2}/>
      <circle cx="17" cy="38" r="1.3" fill="${trimLight}"/><circle cx="23" cy="40" r="1.3" fill="${trimLight}"/><circle cx="29" cy="38" r="1.3" fill="${trimLight}"/>`;
    arm += `<path d="M3 15 L13 15 L14.5 20 L1.5 20 Z" fill="${dark}" ${O2}/>`;
  }
  return { body, arm, plated: PLATED.has(kind) };
}

// v7 armours: built from parts (chest · shoulder · skirt · emblem · arm) in main / trim / accent colours.
// Body space: chest ≈ x 11–35, y 10–31 · belt y 31–36 · skirt y 36–46. Arm space: sleeve y 1–17, cuff y 15–19.
function forgeArmor(a, c) {
  const { main, trim, dark, trimDark, trimLight } = c;
  const acc = a.accent || trimLight, accD = shade(acc, 0.65);
  let body = '', arm = '';
  switch (a.chest) {
    case 'plate': body += `<path d="M11 12 Q23 7 35 12 L34 29 Q23 32 12 29 Z" fill="${shade(main, 1.5)}" ${O2}/><path d="M13 13.5 Q23 10 33 13.5" stroke="${shade(main, 1.9)}" stroke-width="1.4" fill="none"/><path d="M23 10 L23 30" stroke="${shade(main, 0.8)}" stroke-width="1.3"/><path d="M12 21 Q23 24 34 21" stroke="${shade(main, 0.8)}" stroke-width="1.2" fill="none"/>`; break;
    case 'scale': for (const [y, n] of [[14, 5], [18.5, 6], [23, 6], [27.5, 5]]) { const x0 = 23 - n * 2.2; for (let i = 0; i < n; i++) body += `<path d="M${x0 + i * 4.4} ${y} q2.2 4 4.4 0" fill="${i % 2 ? trim : trimDark}" stroke="${INK}" stroke-width="0.9"/>`; } break;
    case 'chain': for (let y = 13; y < 30; y += 3.2) for (let x = 13 + ((y / 3.2) % 2) * 1.6; x < 34; x += 3.4) body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="none" stroke="${acc}" stroke-width="0.8"/>`; body += `<path d="M12 12 Q23 9 34 12" stroke="${trim}" stroke-width="2" fill="none"/>`; break;
    case 'robe': body += `<path d="M12 11 L35 31 L32 33 L10 14 Z" fill="${trim}" opacity="0.9" ${O2}/><path d="M8 40 Q23 45 38 40" stroke="${trimLight}" stroke-width="1.6" fill="none"/>`; break;
    case 'harness': body += `<path d="M13 12 L33 30 M33 12 L13 30" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M13 12 L33 30 M33 12 L13 30" stroke="${trim}" stroke-width="2.6" stroke-linecap="round"/><rect x="20" y="18" width="6" height="6" rx="1" fill="${acc}" ${O2}/>`; break;
    case 'bone': for (const y of [14, 18.5, 23, 27.5]) body += `<path d="M13 ${y} Q23 ${y + 3} 33 ${y}" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M13 ${y} Q23 ${y + 3} 33 ${y}" stroke="${trim}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`; body += `<path d="M23 11 L23 31" stroke="${trim}" stroke-width="2.4"/>`; break;
    case 'crystal': body += `<path d="M14 13 L20 11 L22 20 L16 24 Z" fill="${acc}" ${O2}/><path d="M24 11 L32 13 L31 22 L25 20 Z" fill="${trim}" ${O2}/><path d="M17 25 L23 21 L29 24 L23 31 Z" fill="${shade(acc, 1.15)}" ${O2}/><path d="M18 14 L19 19 M27 13 L29 17" stroke="#ffffff" stroke-width="1" opacity="0.8"/>`; break;
    case 'leaf': for (const [x, y, r] of [[15, 15, -30], [23, 13, 0], [31, 15, 30], [17, 23, -20], [29, 23, 20], [23, 26, 0]]) body += `<path d="M${x} ${y - 4} C${x + 4} ${y - 2} ${x + 4} ${y + 3} ${x} ${y + 5} C${x - 4} ${y + 3} ${x - 4} ${y - 2} ${x} ${y - 4} Z" fill="${trim}" transform="rotate(${r} ${x} ${y})" ${O2}/>`; break;
    case 'fur': body += `<path d="M9 14 Q12 8 16 12 Q19 7 23 11 Q27 7 30 12 Q34 8 37 14 Q34 18 30 15 Q27 19 23 15 Q19 19 16 15 Q12 18 9 14 Z" fill="${acc}" ${O2}/>`; for (const [x, y] of [[16, 22], [24, 24], [30, 21], [20, 28], [28, 28]]) body += `<path d="M${x} ${y} l1.5 2.5 M${x + 2} ${y} l1.5 2.5" stroke="${shade(main, 0.5)}" stroke-width="0.9"/>`; break;
    case 'lamellar': for (const y of [14, 18.5, 23, 27.5]) body += `<path d="M11.5 ${y} Q23 ${y + 2.6} 34.5 ${y}" stroke="${trimDark}" stroke-width="1.2" fill="none"/>`; for (const x of [15, 19, 23, 27, 31]) body += `<path d="M${x} 13 L${x} 30" stroke="${shade(main, 0.5)}" stroke-width="0.9" opacity="0.8"/>`; break;
    default: break;
  }
  switch (a.skirt) {
    case 'tails': body += `<path d="M9 35 L6.5 45 L15 45.5 L17.5 36.5 Z M37 35 L39.5 45 L31 45.5 L28.5 36.5 Z" fill="${dark}" ${O2}/>`; break;
    case 'kilt': for (const x of [10, 15, 20, 25, 30, 35]) body += `<path d="M${x} 36 L${x - 1} 44 L${x + 4} 44 L${x + 4} 36 Z" fill="${x % 10 === 0 ? trim : trimDark}" stroke="${INK}" stroke-width="0.8"/>`; break;
    case 'robe': body += `<path d="M19 36 L18 45 L28 45 L27 36 Z" fill="${trim}" ${O2}/><path d="M23 37 L23 44" stroke="${acc}" stroke-width="1.2"/>`; break;
    case 'tassets': body += `<path d="M8 35 L16 36 L15 44 L7 43 Z M38 35 L30 36 L31 44 L39 43 Z" fill="${shade(main, 1.4)}" ${O2}/><path d="M8.5 39 L15.5 40 M37.5 39 L30.5 40" stroke="${shade(main, 0.8)}" stroke-width="1"/>`; break;
    case 'fringe': for (let x = 10; x <= 36; x += 3) body += `<path d="M${x} 36 L${x - 0.6} 45" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M${x} 36 L${x - 0.6} 45" stroke="${x % 6 === 4 ? acc : trim}" stroke-width="1.3" stroke-linecap="round"/>`; break;
    default: break;
  }
  const em = (d) => { body += d; };
  switch (a.emblem) {
    case 'sun': em(`<circle cx="23" cy="20" r="3.2" fill="${acc}" ${O2}/><path d="M23 14.6 L23 16 M23 24 L23 25.4 M17.6 20 L19 20 M27 20 L28.4 20 M19.2 16.2 L20.2 17.2 M26.8 16.2 L25.8 17.2" stroke="${acc}" stroke-width="1.4"/>`); break;
    case 'moon': em(`<path d="M25 15.5 A5 5 0 1 0 25 24.5 A4 4 0 1 1 25 15.5 Z" fill="${acc}" ${O2}/>`); break;
    case 'skull': em(`<path d="M19.5 19 C19.5 15 26.5 15 26.5 19 L26 22 L24.5 22 L24.5 24 L21.5 24 L21.5 22 L20 22 Z" fill="${acc}" ${O2}/><circle cx="21.6" cy="19.2" r="0.9" fill="${INK}"/><circle cx="24.4" cy="19.2" r="0.9" fill="${INK}"/>`); break;
    case 'eye': em(`<path d="M18 20 Q23 15 28 20 Q23 25 18 20 Z" fill="#fff" ${O2}/><circle cx="23" cy="20" r="1.8" fill="${acc}"/><circle cx="23" cy="20" r="0.8" fill="${INK}"/>`); break;
    case 'rune': em(`<path d="M20 16 L23 24 L26 16 M21 20 L25 20" stroke="${acc}" stroke-width="1.6" fill="none"/><circle cx="23" cy="20" r="5.4" fill="${acc}" opacity="0.18"/>`); break;
    case 'star': em(`<path d="M23 15 L24.4 18.6 L28.2 18.8 L25.2 21.2 L26.2 24.8 L23 22.8 L19.8 24.8 L20.8 21.2 L17.8 18.8 L21.6 18.6 Z" fill="${acc}" ${O2}/>`); break;
    case 'flame': em(`<path d="M23 15 C26 18 27 20 26.4 22.4 C25.8 24.4 20.2 24.4 19.6 22.4 C19 20.4 20.4 19 21.4 17.6 C21.8 19 22.6 19.4 23 18.6 Z" fill="${acc}" ${O2}/>`); break;
    case 'leaf': em(`<path d="M23 15 C27 17 27 22 23 25 C19 22 19 17 23 15 Z" fill="${acc}" ${O2}/><path d="M23 16 L23 24" stroke="${accD}" stroke-width="0.9"/>`); break;
    case 'wave': em(`<path d="M17.5 19 q2.75 -3 5.5 0 q2.75 3 5.5 0 M17.5 22.5 q2.75 -3 5.5 0 q2.75 3 5.5 0" stroke="${acc}" stroke-width="1.6" fill="none"/>`); break;
    case 'chain': em(`<ellipse cx="20.5" cy="20" rx="2.6" ry="1.6" fill="none" stroke="${acc}" stroke-width="1.4"/><ellipse cx="25.5" cy="20" rx="2.6" ry="1.6" fill="none" stroke="${acc}" stroke-width="1.4"/>`); break;
    default: break;
  }
  switch (a.shoulder) {
    case 'round': arm += `<path d="M0.6 7.5 C-0.2 2 3.8 0.6 8 0.6 C12.2 0.6 16.2 2 15.4 7.5 Q8 10 0.6 7.5 Z" fill="${shade(main, 1.45)}" ${O2}/><path d="M2.5 5 Q8 3 13.5 5" stroke="${shade(main, 1.8)}" stroke-width="1.1" fill="none"/>`; break;
    case 'spike': arm += `<path d="M0.6 7.5 C-0.2 2 3.8 0.6 8 0.6 C12.2 0.6 16.2 2 15.4 7.5 Q8 10 0.6 7.5 Z" fill="${trimDark}" ${O2}/><path d="M3 3 L1 -3 L6 1.6 Z M9 1 L10 -5 L12.6 2 Z" fill="${acc}" ${O2}/>`; break;
    case 'feather': arm += `<path d="M1 7 C-3 2 0 -3 4 -2 C4 2 6 4 8 6 Z M8 6 C7 0 10 -4 14 -2 C13 2 13 4 15 7 Z" fill="${acc}" ${O2}/><path d="M2 -1 L6 5 M11 -2 L12 5" stroke="${accD}" stroke-width="0.8"/>`; break;
    case 'horn': arm += `<path d="M0.6 7.5 C-0.2 2 3.8 0.6 8 0.6 C12.2 0.6 16.2 2 15.4 7.5 Q8 10 0.6 7.5 Z" fill="${shade(main, 1.3)}" ${O2}/><path d="M11 2 C13 -3 17 -5 19 -4 C17 -2 15 1 14 4 Z" fill="${acc}" ${O2}/>`; break;
    case 'fur': arm += `<path d="M-1 6 Q1 0 4 3 Q6 -1 9 2 Q12 -1 14 3 Q17 2 17 7 Q12 10 8 9 Q3 10 -1 6 Z" fill="${acc}" ${O2}/>`; break;
    case 'crystal': arm += `<path d="M1 7 L3 -3 L6 6 Z M7 6 L10 -5 L12 6 Z M12 7 L16 0 L15 8 Z" fill="${acc}" ${O2}/><path d="M9.6 -2 L10.4 3" stroke="#fff" stroke-width="0.8" opacity="0.8"/>`; break;
    case 'layered': arm += `<path d="M0.4 6 C0 1.6 4 0.4 8 0.4 C12 0.4 16 1.6 15.6 6 Q8 8.4 0.4 6 Z" fill="${shade(main, 1.4)}" ${O2}/><path d="M0.6 9.6 C0.4 6.4 4 5.6 8 5.6 C12 5.6 15.6 6.4 15.4 9.6 Q8 12 0.6 9.6 Z" fill="${trim}" ${O2}/>`; break;
    default: break;
  }
  switch (a.arm) {
    case 'bracer': arm += `<path d="M3 11 L13 11 L12.8 15 L3.2 15 Z" fill="${trim}" ${O2}/><path d="M5 13 L11 13" stroke="${acc}" stroke-width="0.9"/>`; break;
    case 'spiked': arm += `<path d="M13 9 L17 8 L13.4 11 Z M13.2 13 L17 13 L13 15 Z" fill="${acc}" ${O2}/>`; break;
    case 'wide': arm += `<path d="M3 13 L13 13 L16 21 L0 21 Z" fill="${dark}" ${O2}/><path d="M0.5 20 L15.5 20" stroke="${trim}" stroke-width="1.4"/>`; break;
    case 'chain': for (let y = 4; y < 15; y += 3) arm += `<path d="M4 ${y} q4 1.6 8 0" stroke="${acc}" stroke-width="0.9" fill="none"/>`; break;
    default: break;
  }
  return { body, arm, plated: ['plate', 'scale', 'crystal', 'lamellar', 'bone'].includes(a.chest) };
}

export function heroParts(armor = {}, look = DEFAULT_LOOK) {
  const { main = PAL.teal, trim = PAL.vermilion, kind = 'cloak' } = armor;
  const dark = shade(main, 0.62), light = shade(main, 1.3), hood = shade(main, 0.82);
  const trimDark = shade(trim, 0.7), trimLight = shade(trim, 1.25);
  const det = kind === 'forge' ? forgeArmor(armor, { main, trim, dark, light, trimDark, trimLight }) : armorDetail(kind, { main, trim, dark, light, trimDark, trimLight });
  const boot = '#3a2a22', bootHi = '#5a4234';

  // Leg + boot, pivot at the hip (top centre). Length ≈ 30.
  const leg = (tone) => ({
    w: 18, h: 34, ax: 9, ay: 2, svg: S(18, 34, grad('g', shade(dark, tone), shade(dark, tone * 0.8)),
      `<path d="M4 2 L14 2 L13 18 L5 18 Z" fill="url(#g)" ${O2}/>
       <path d="M3 17 L14 17 L15 27 C17 28 17.5 31 16 32 L2.5 32 C1.5 30 2 27 3 26 Z" fill="${tone < 1 ? shade(boot, 0.8) : boot}" ${O}/>
       <path d="M4 21 L13 21 M4.5 24.5 L13.5 24.5" stroke="${bootHi}" stroke-width="1.4"/>
       <path d="M3 31 L16 31" stroke="#1c1310" stroke-width="2"/>`),
  });

  // Torso + cloak skirt + belt, pivot at the hip centre.
  const body = {
    w: 46, h: 46, ax: 23, ay: 34, svg: S(46, 46,
      grad('c', light, dark) + grad('cs', main, shade(main, 0.5), 1, 0),
      `<path d="M6 42 C4 28 9 10 23 6 C37 10 42 28 40 42 Q23 46 6 42 Z" fill="url(#c)" ${O}/>
       <path d="M6 42 C5 30 9 14 20 8 L18 44 Q11 44 6 42 Z" fill="${dark}" opacity="0.55"/>
       <path d="M30 14 C34 22 35 32 34 42" stroke="${light}" stroke-width="1.6" fill="none" opacity="0.7"/>
       <path d="M14 22 C13 30 13 36 14 42 M24 24 L24 43" stroke="${dark}" stroke-width="1.4" fill="none" opacity="0.8"/>
       <path d="M8 31 Q23 36 38 31 L38 36 Q23 41 8 36 Z" fill="${PAL.barkDark}" ${O2}/>
       <rect x="19.5" y="31.5" width="7" height="6" rx="1.2" fill="${PAL.gold}" ${O2}/>
       <rect x="21.5" y="33.3" width="3" height="2.4" fill="${PAL.goldDark}"/>
       <path d="M31 35 L37 35 L36.5 42 L31.5 42 Z" fill="#6e4a30" ${O2}/>
       <path d="M31.5 37.5 L36.5 37.5" stroke="${PAL.gold}" stroke-width="1"/>
       <path d="M13 9 Q23 15 33 9" stroke="${trimDark}" stroke-width="2.5" fill="none"/>${det.body}`),
  };

  // Hood + face, pivot at the neck. Eyes look right. 22px of headroom on top and 8px behind for horns, ears, halos and wings.
  const head = {
    w: 62, h: 72, ax: 32, ay: 68, svg: S(62, 72,
      `<radialGradient id="h" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${shade(hood, 1.25)}"/><stop offset="1" stop-color="${shade(hood, 0.7)}"/></radialGradient>
       <radialGradient id="f" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="${look.skin}"/><stop offset="1" stop-color="${look.shade}"/></radialGradient>`,
      `<g transform="translate(8 22)"><path d="M10 14 L1 4 L8 22 Z" fill="${hood}" ${O}/>
       <path d="M4 26 C2 12 12 2 26 2 C40 2 49 12 48 26 C47 38 38 46 25 46 C12 46 5 38 4 26 Z" fill="url(#h)" ${O}/>
       <path d="M14 24 C14 15 21 10 30 10 C39 10 45 17 45 26 C45 36 38 42 30 42 C21 42 14 34 14 24 Z" fill="${shade(hood, 0.45)}"/>
       <path d="M17 26 C17 18 23 13 31 13 C38 13 43 19 43 26 C43 35 37 40 30 40 C22 40 17 34 17 26 Z" fill="url(#f)" ${O2}/>
       <path d="M18 19 C22 13 30 12 38 15 C34 15 31 17 29 20 C27 17 22 17 18 19 Z" fill="${look.hair}"/>
       <path d="M25 22.5 L30 21.6 M35 21.4 L39.5 22.4" stroke="${look.hair === '#cfd6e6' ? '#8a90a0' : look.hair}" stroke-width="1.6"/>
       <ellipse cx="28.5" cy="27" rx="2.4" ry="3.3" fill="${look.eye}"/><ellipse cx="37.5" cy="27" rx="2.2" ry="3.2" fill="${look.eye}"/>
       <ellipse cx="28.5" cy="28" rx="1.2" ry="1.6" fill="${INK}"/><ellipse cx="37.5" cy="28" rx="1.1" ry="1.5" fill="${INK}"/>
       <circle cx="29.3" cy="25.8" r="1" fill="#fff"/><circle cx="38.2" cy="25.8" r="0.9" fill="#fff"/>
       <ellipse cx="38" cy="33" rx="3" ry="1.7" fill="#e5937a" opacity="0.6"/><ellipse cx="23" cy="32" rx="2.6" ry="1.5" fill="#e5937a" opacity="0.45"/>
       <path d="M33 34.5 Q35 35.6 37 34.4" stroke="#8a4a3a" stroke-width="1.3" fill="none"/>
       <path d="M8 22 C9 13 15 7 22 5" stroke="${shade(hood, 1.5)}" stroke-width="2" fill="none" opacity="0.6"/>
       <path d="M22 44 Q31 47 40 42" stroke="${INK}" stroke-width="2" fill="none"/>${headTrait(look)}</g>`),
  };

  // Arm (sleeve + glove), pivot at the shoulder, hand at the bottom (length ≈ 21).
  const arm = (tone) => ({
    w: 16, h: 28, ax: 8, ay: 3, svg: S(16, 28, grad('a', shade(main, tone * 1.1), shade(dark, tone)),
      `<path d="M2.5 3 C2.5 1 13.5 1 13.5 3 L12.5 17 L3.5 17 Z" fill="url(#a)" ${O2}/>
       <path d="M3 15 L13 15 L12.5 19 L3.5 19 Z" fill="${trimDark}" ${O2}/>
       <circle cx="8" cy="22.5" r="4.6" fill="#6e4a30" ${O2}/>
       <path d="M5.5 21 Q8 19.6 10.5 21" stroke="#9a6a44" stroke-width="1.2" fill="none"/>${tone < 1 ? det.arm.replace(/fill="#([0-9a-f]{6})"/g, (m, hx) => `fill="${shade('#' + hx, 0.78)}"`) : det.arm}`),
  });

  // Scarf tail streaming back, pivot at the neck back.
  const scarf = {
    w: 40, h: 24, ax: 37, ay: 5, svg: S(40, 24, grad('s', trimLight, trimDark, 1, 0.3),
      `<path d="M37 3 C28 2 18 6 6 4 C9 9 14 12 20 12 C14 14 8 17 2 16 C9 22 24 18 37 9 Z" fill="url(#s)" ${O}/>
       <path d="M30 6 C24 7 18 9 12 8 M28 10 C22 12 16 14 10 15" stroke="${trimDark}" stroke-width="1.4" fill="none"/>
       <path d="M6 4 L2 1.5 M6 5 L1 6 M2 16 L-1 18 M3 16.5 L0 13.5" stroke="${trim}" stroke-width="1.6" stroke-linecap="round"/>`),
  };

  // Scarf wrap around the neck (drawn over the body, under the head).
  const collar = {
    w: 34, h: 14, ax: 17, ay: 4, svg: S(34, 14, grad('k', trimLight, trimDark),
      `<path d="M2 3 Q17 12 32 3 Q31 12 17 13 Q3 12 2 3 Z" fill="url(#k)" ${O}/>
       <path d="M8 7 Q17 11 26 7" stroke="${trimLight}" stroke-width="1.5" fill="none" opacity="0.8"/>`),
  };

  return { legBack: leg(0.75), legFront: leg(1), body, head, armBack: arm(0.72), armFront: arm(1), scarf, collar };
}

function portraitTrait(look) {
  const extra = [look.trait, look.trait2].filter((t) => t && TRAITS_V7.includes(t)).map((t) => oneTrait(t, look, true)).join('');
  const scaled = extra ? `<g transform="translate(8.5 7.1) scale(2.45)">${extra}</g>` : '';
  return portraitTraitBase(look) + scaled + (look.trait2 && !TRAITS_V7.includes(look.trait2) ? portraitTraitBase({ ...look, trait: look.trait2 }) : '');
}
function portraitTraitBase(look) {
  switch (look.trait) {
    case 'ears': return `<path d="M50 60 L10 28 L42 80 Z" fill="${look.skin}" ${O}/><path d="M42 60 L20 40" stroke="${look.shade}" stroke-width="3"/>`;
    case 'horns': return `<path d="M58 32 C48 6 22 2 10 14 C28 12 38 24 44 40 Z" fill="#ebe0cc" ${O}/><path d="M20 12 C30 12 38 18 44 28" stroke="#b8a890" stroke-width="2.4" fill="none"/>
      <path d="M102 30 C112 6 136 2 150 12 C132 12 122 22 116 38 Z" fill="#d8ccb6" ${O}/>`;
    case 'scales': return `<path d="M56 86 q4 -5 8 0 q4 -5 8 0 M60 94 q4 -5 8 0 M104 88 q4 -5 8 0" stroke="${INK}" stroke-width="2" fill="#c4492e"/>
      <path d="M36 46 L22 36 L38 40 Z M44 34 L36 18 L50 28 Z" fill="#c4492e" ${O}/>`;
    case 'leaves': return `<path d="M62 22 C48 2 62 -8 76 6 C76 14 70 20 62 22 Z" fill="#6aa25a" ${O}/><path d="M86 16 C86 -6 106 -8 114 6 C108 14 98 16 86 16 Z" fill="#8fd06a" ${O}/>
      <path d="M40 34 C20 28 16 10 30 6 C38 14 42 24 40 34 Z" fill="#4b8a3a" ${O}/>`;
    case 'marks': return `<circle cx="72" cy="76" r="11" fill="#ffd08a" opacity="0.22"/><circle cx="98" cy="76" r="11" fill="#ffd08a" opacity="0.22"/>
      <path d="M104 86 L112 98 L106 104 M62 84 L58 98 M78 50 L84 56 L90 50" stroke="#ffd08a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    default: return '';
  }
}

// The hero's dialogue / HUD portrait, drawn for the current bloodline.
export function heroPortrait(look = DEFAULT_LOOK) {
  const P = (defs, body) => S(160, 160, defs, body);
  return P(`<radialGradient id="bg" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="#3b2e26"/><stop offset="1" stop-color="#17110e"/></radialGradient>` + grad('cl', '#4f8580', '#22403d') + `<radialGradient id="fc" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="${look.skin}"/><stop offset="1" stop-color="${look.shade}"/></radialGradient>`,
    `<rect width="160" height="160" fill="url(#bg)"/>
     <path d="M20 160 C24 120 50 104 80 104 C110 104 136 120 140 160 Z" fill="url(#cl)" ${O}/>
     <path d="M44 112 Q80 134 116 112 Q112 132 80 136 Q48 132 44 112 Z" fill="#c2412f" ${O}/>
     <path d="M30 70 C28 36 50 16 80 16 C110 16 132 36 130 70 C128 98 108 116 80 116 C52 116 32 98 30 70 Z" fill="#355f5b" ${O}/>
     <path d="M44 72 C44 48 60 34 82 34 C102 34 118 48 118 72 C118 96 102 108 82 108 C60 108 44 96 44 72 Z" fill="#1d3533"/>
     <path d="M50 74 C50 52 64 40 84 40 C102 40 114 54 114 74 C114 96 100 104 84 104 C64 104 50 94 50 74 Z" fill="url(#fc)" ${O2}/>
     <path d="M52 58 C60 42 80 38 100 46 C90 46 82 52 78 58 C72 52 62 52 52 58 Z" fill="${look.hair}"/>
     <ellipse cx="72" cy="76" rx="5" ry="7" fill="${look.eye}"/><ellipse cx="98" cy="76" rx="5" ry="7" fill="${look.eye}"/>
     <ellipse cx="72" cy="78" rx="2.6" ry="3.6" fill="${INK}"/><ellipse cx="98" cy="78" rx="2.6" ry="3.6" fill="${INK}"/>
     <circle cx="73.5" cy="73.5" r="2" fill="#fff"/><circle cx="99.5" cy="73.5" r="2" fill="#fff"/>
     <path d="M64 64 L78 62 M92 62 L104 64" stroke="${look.hair === '#cfd6e6' ? '#8a90a0' : look.hair}" stroke-width="3" stroke-linecap="round"/>
     <path d="M80 94 Q86 96 92 93" stroke="#8a4a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
     <path d="M40 140 C52 134 58 146 70 140" stroke="#ff8a3d" stroke-width="3" fill="none" opacity="0.7"/>${portraitTrait(look)}`);
}

// Portrait busts for dialogue (160×160).
export function portraits() {
  const P = (defs, body) => S(160, 160, defs, body);
  const bg = (a, b) => `<radialGradient id="bg" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  return {
    hero: heroPortrait(DEFAULT_LOOK),
    lek: P(bg('#3a2a20', '#140e0b') + grad('ap', '#6e4a30', '#3c271c'),
      `<rect width="160" height="160" fill="url(#bg)"/>
       <path d="M14 160 C18 118 46 102 80 102 C114 102 142 118 146 160 Z" fill="#4a3a30" ${O}/>
       <path d="M50 112 L110 112 L116 160 L44 160 Z" fill="url(#ap)" ${O}/>
       <path d="M44 74 C42 44 58 24 82 24 C106 24 120 44 118 74 C116 100 100 114 80 114 C60 114 46 100 44 74 Z" fill="#d6a47e" ${O}/>
       <path d="M50 52 C56 30 104 26 114 50" stroke="#e8c09a" stroke-width="5" fill="none" opacity="0.6"/>
       <path d="M48 84 C52 112 66 128 80 130 C96 128 110 112 114 84 C106 96 96 100 80 100 C64 100 54 96 48 84 Z" fill="#e8e2d6" ${O}/>
       <path d="M60 104 L64 120 M80 106 L80 126 M98 104 L94 120" stroke="#c9c1b0" stroke-width="2"/>
       <path d="M62 64 L76 66 M88 66 L102 63" stroke="#e8e2d6" stroke-width="5" stroke-linecap="round"/>
       <path d="M64 74 Q70 70 76 74 M88 74 Q94 70 100 74" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M70 90 Q82 86 94 90" stroke="#b8b0a0" stroke-width="5" fill="none" stroke-linecap="round"/>
       <path d="M100 48 C108 52 110 60 106 68" stroke="#a8603e" stroke-width="4" fill="none" opacity="0.7"/>
       <circle cx="50" cy="78" r="6" fill="#c08c68" ${O2}/>`),
    dao: P(bg('#4a2a1e', '#160d0a') + `<radialGradient id="ey" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#ff8a3d"/></radialGradient>`,
      `<rect width="160" height="160" fill="url(#bg)"/>
       <circle cx="80" cy="70" r="70" fill="#ff8a3d" opacity="0.12"/>
       <path d="M18 160 C22 120 50 104 80 104 C110 104 138 120 142 160 Z" fill="#3a2a24" ${O}/>
       <path d="M52 112 L108 112 L112 160 L48 160 Z" fill="#6e4a30" ${O}/>
       <path d="M40 112 Q80 140 120 112 Q116 136 80 140 Q44 136 40 112 Z" fill="#c2412f" ${O}/>
       <path d="M44 60 C40 30 60 14 82 14 C108 14 124 32 120 62 C130 80 124 100 112 106 C112 84 108 70 102 62 Z" fill="#2a1a14" ${O}/>
       <circle cx="80" cy="12" r="12" fill="#2a1a14" ${O}/>
       <path d="M50 72 C50 50 64 38 82 38 C100 38 112 52 112 72 C112 94 98 106 82 106 C64 106 50 94 50 72 Z" fill="#e8c09a" ${O2}/>
       <path d="M50 66 C52 50 62 40 76 38 C70 46 68 56 70 64 C62 60 56 62 50 66 Z" fill="#2a1a14"/>
       <ellipse cx="72" cy="76" rx="5" ry="6" fill="url(#ey)"/><ellipse cx="96" cy="76" rx="5" ry="6" fill="url(#ey)"/>
       <path d="M66 66 L78 67 M90 67 L102 65" stroke="#2a1a14" stroke-width="2.6" stroke-linecap="round"/>
       <path d="M78 94 Q84 97 90 94" stroke="#8a4a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
       <path d="M58 88 C62 86 64 90 60 92 M104 84 C108 86 106 90 102 88" stroke="#5a4a40" stroke-width="2" opacity="0.6"/>
       <path d="M34 150 C40 140 46 146 52 136 M108 136 C114 146 120 140 126 150" stroke="#ffb35a" stroke-width="3" fill="none" opacity="0.8"/>`),
    golem: P(bg('#3a3330', '#120d0b'),
      `<rect width="160" height="160" fill="url(#bg)"/>
       <path d="M18 160 L26 70 C28 40 52 24 80 24 C108 24 132 40 134 70 L142 160 Z" fill="#5b5450" ${O}/>
       <path d="M36 62 L64 58 L66 80 L38 84 Z M96 58 L124 62 L122 84 L94 80 Z" fill="#6e6560" ${O2}/>
       <ellipse cx="58" cy="70" rx="10" ry="6" fill="#ff8a3d" ${O2}/><ellipse cx="102" cy="70" rx="10" ry="6" fill="#ff8a3d" ${O2}/>
       <ellipse cx="58" cy="70" rx="4" ry="2.5" fill="#fff3c4"/><ellipse cx="102" cy="70" rx="4" ry="2.5" fill="#fff3c4"/>
       <path d="M52 100 C52 88 64 82 80 82 C96 82 108 88 108 100 L108 140 L52 140 Z" fill="#3a3330" ${O}/>
       <path d="M58 138 C58 116 68 104 80 100 C92 104 102 116 102 138 Z" fill="#ff8a3d"/>
       <path d="M68 138 C68 124 74 116 80 112 C86 116 92 124 92 138 Z" fill="#ffd08a"/>
       <path d="M52 104 L108 104 M52 118 L108 118" stroke="${INK}" stroke-width="3"/>`),
  };
}
