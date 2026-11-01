// Weapon illustrations: in-hand sprites (blade pointing up, anchor = where the hand grips) and 64×64 item icons.
// Swords keep the original blade shapes in sprites.js; every other weapon type is drawn here.
import { INK, PAL } from './palette.js';
import { weapon as swordSprite } from './sprites.js';
import { forgeSprite, forgeBody, FAMILY, familyOfForm } from './weaponForge.js';

const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const T = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const T1 = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;

function katanaBody(a) {
  const glow = a.glow ? `<path d="M7 2 C12 20 11 42 9 60 L5 60 C6 42 7 20 7 2 Z" fill="${a.glow}" opacity="0.4"/>` : '';
  return `${glow}<path d="M6 60 C6 40 7 20 9 3 C11 6 11.5 9 11 12 C10 28 9.5 44 9 60 Z" fill="${a.blade}" ${T1}/>
    <path d="M9.6 8 C9 26 8.6 42 8.4 58" stroke="${a.edge}" stroke-width="1.2" fill="none"/>
    <path d="M6.6 50 L8.8 50" stroke="${INK}" stroke-width="0.8" opacity="0.5"/>
    <ellipse cx="7.5" cy="61.5" rx="6" ry="2.4" fill="${a.guard}" ${T1}/>
    <rect x="5" y="63.5" width="5" height="17" rx="1.6" fill="${a.grip}" ${T1}/>
    <path d="M5 66 L10 69 M10 66 L5 69 M5 71 L10 74 M10 71 L5 74 M5 76 L10 79 M10 76 L5 79" stroke="${a.wrap}" stroke-width="1.2"/>
    <rect x="4.6" y="80" width="5.8" height="2.6" rx="1" fill="${PAL.gold}" ${T1}/>`;
}
function daggerBody(a) {
  const glow = a.glow ? `<path d="M6 0 C10 8 10 16 8 22 L4 22 C2 16 2 8 6 0 Z" fill="${a.glow}" opacity="0.45"/>` : '';
  return `${glow}<path d="M3.5 22 C3 14 4 7 6 1 C8 7 9 14 8.5 22 Z" fill="${a.blade}" ${T1}/>
    <path d="M6 4 L6 21" stroke="${a.edge}" stroke-width="1"/>
    <path d="M1 22 L11 22 L10 25 L2 25 Z" fill="${a.guard}" ${T1}/>
    <rect x="4" y="25" width="4" height="9" rx="1.4" fill="${a.grip}" ${T1}/>
    <circle cx="6" cy="35" r="1.8" fill="${a.guard}" ${T1}/>`;
}
function greatswordBody(a) {
  const glow = a.glow ? `<path d="M15 2 L24 14 L22 80 L8 80 L6 14 Z" fill="${a.glow}" opacity="0.35"/>` : '';
  return `${glow}<path d="M7 80 L7 14 L15 2 L23 14 L23 80 Z" fill="${a.blade}" ${T}/>
    <path d="M15 6 L15 78" stroke="${INK}" stroke-width="1.2" opacity="0.45"/>
    <path d="M9 16 L9 78 M21 16 L21 78" stroke="${a.edge}" stroke-width="1.4" opacity="0.9"/>
    <path d="M11 30 L13 33 M18 52 L16 55" stroke="#6b5a4c" stroke-width="1.4" opacity="0.6"/>
    <path d="M1 80 Q15 86 29 80 L28 86 Q15 91 2 86 Z" fill="${a.guard}" ${T}/>
    <rect x="11.5" y="87" width="7" height="19" rx="2" fill="${a.grip}" ${T}/>
    <path d="M11.5 92 L18.5 92 M11.5 97 L18.5 97 M11.5 102 L18.5 102" stroke="${PAL.barkDark}" stroke-width="1.2"/>
    <circle cx="15" cy="108" r="3.4" fill="${a.guard}" ${T}/>`;
}
function staffBody(a) {
  return `<radialGradient id="orb" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.45" stop-color="${a.orb}"/><stop offset="1" stop-color="${INK}"/></radialGradient>
    <circle cx="11" cy="13" r="10" fill="${a.glow || a.orb}" opacity="0.28"/>
    <path d="M9 108 L8.5 26 L13.5 26 L13 108 Z" fill="${a.wood}" ${T}/>
    <path d="M10.5 30 L10.5 104" stroke="#ffffff" stroke-width="0.8" opacity="0.18"/>
    <path d="M4 22 C2 12 6 3 11 2 C16 3 20 12 18 22 C15 18 13 16 11 16 C9 16 7 18 4 22 Z" fill="${a.trim}" ${T1}/>
    <circle cx="11" cy="13" r="6.2" fill="url(#orb)" ${T1}/>
    <circle cx="9" cy="11" r="1.6" fill="#fff" opacity="0.8"/>
    <path d="M7.5 34 L14.5 36 M7.5 40 L14.5 42" stroke="${a.trim}" stroke-width="1.6"/>
    <rect x="7.5" y="64" width="7" height="12" rx="2" fill="${PAL.barkDark}" ${T1}/>`;
}
// Bow faces right: grip at the anchor, limbs curve forward, tips behind (string drawn in code).
function bowBody(a) {
  const glow = a.glow ? `<path d="M6 4 C26 20 26 56 6 72" stroke="${a.glow}" stroke-width="8" fill="none" opacity="0.35"/>` : '';
  return `${glow}<path d="M6 3 C14 6 22 18 24 30 C25 35 25 41 24 46 C22 58 14 70 6 73" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M6 3 C14 6 22 18 24 30 C25 35 25 41 24 46 C22 58 14 70 6 73" stroke="${a.wood}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M9 7 C16 12 20 20 22 28 M9 69 C16 64 20 56 22 48" stroke="${a.trim}" stroke-width="1.2" fill="none" opacity="0.9"/>
    <rect x="20.5" y="31" width="7" height="14" rx="2" fill="${PAL.barkDark}" ${T1}/>
    <circle cx="6" cy="3.5" r="2" fill="${a.trim}" ${T1}/><circle cx="6" cy="72.5" r="2" fill="${a.trim}" ${T1}/>`;
}
function spearBody(a) {
  const glow = a.glow ? `<path d="M9 0 C16 10 16 22 9 32 C2 22 2 10 9 0 Z" fill="${a.glow}" opacity="0.4"/>` : '';
  return `${glow}<path d="M7.5 130 L7.5 30 L10.5 30 L10.5 130 Z" fill="${a.shaft}" ${T1}/>
    <path d="M9 2 C14 9 15 18 12 28 L6 28 C3 18 4 9 9 2 Z" fill="${a.head}" ${T1}/>
    <path d="M9 5 L9 27" stroke="${a.edge}" stroke-width="1.1"/>
    <path d="M4 28 L14 28 L12.5 33 L5.5 33 Z" fill="${PAL.gold}" ${T1}/>
    <path d="M6 33 C3 40 4 46 2 52 M12 33 C15 40 14 46 16 52" stroke="${a.trim}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M7.5 84 L10.5 84 M7.5 100 L10.5 100" stroke="${PAL.barkDark}" stroke-width="3"/>
    <circle cx="9" cy="130" r="2.4" fill="${PAL.gold}" ${T1}/>`;
}

// Scythe: shaft with bound grips; a long crescent blade sweeps off the top, a back spike balances it.
// a: { shaft, blade, edge, trim, glow?, gem? }
function scytheBody(a) {
  const glow = a.glow ? `<path d="M50 20 C40 2 14 -2 2 12 C18 10 33 16 42 32 Z" fill="${a.glow}" opacity="0.38"/><circle cx="51" cy="16" r="9" fill="${a.glow}" opacity="0.3"/>` : '';
  return `${glow}<path d="M48.5 140 L48.5 18 L53.5 18 L53.5 140 Z" fill="${a.shaft}" ${T}/>
    <path d="M50 22 L50 136" stroke="#ffffff" stroke-width="0.8" opacity="0.16"/>
    <path d="M49 24 C42 7 21 2 3 13 C16 11 30 14 39 28 C42 31 46 30 49 24 Z" fill="${a.blade}" ${T}/>
    <path d="M44 20 C36 10 22 7 9 11" stroke="${a.edge}" stroke-width="1.6" fill="none"/>
    <path d="M30 16 C33 19 35 22 37 26" stroke="${INK}" stroke-width="1" opacity="0.4" fill="none"/>
    <path d="M53 22 L64 11 L58 27 Z" fill="${a.blade}" ${T1}/>
    <path d="M46 26 L56 26 L55 33 L47 33 Z" fill="${a.trim}" ${T1}/>
    <circle cx="51" cy="18" r="4" fill="${a.gem || a.trim}" ${T1}/><circle cx="50" cy="16.8" r="1.2" fill="#fff" opacity="0.7"/>
    <path d="M48.5 70 L53.5 70 M48.5 74 L53.5 74 M48.5 100 L53.5 100 M48.5 104 L53.5 104" stroke="${a.trim}" stroke-width="1.6"/>
    <path d="M48 136 L54 136 L53 141 L49 141 Z" fill="${a.trim}" ${T1}/>`;
}
// Twin blade: one long, slim sword (the off-hand blade uses its own art when it differs).
// a: { blade, edge, guard, grip, glow? }
function twinBody(a) {
  const glow = a.glow ? `<path d="M7 0 C13 14 13 52 10 70 L4 70 C1 52 1 14 7 0 Z" fill="${a.glow}" opacity="0.4"/>` : '';
  return `${glow}<path d="M4.5 70 L4.5 9 L7 1.5 L9.5 9 L9.5 70 Z" fill="${a.blade}" ${T1}/>
    <path d="M7 5 L7 68" stroke="${a.edge}" stroke-width="1.1"/>
    <path d="M5.3 20 L8.7 20 M5.3 46 L8.7 46" stroke="${INK}" stroke-width="0.7" opacity="0.35"/>
    ${a.rune ? `<path d="M7 26 L5.6 30 L7 34 L8.4 30 Z M7 50 L5.6 54 L7 58 L8.4 54 Z" fill="${a.rune}"/>` : ''}
    <path d="M0.5 70 Q7 74 13.5 70 L13 74 Q7 77 1 74 Z" fill="${a.guard}" ${T1}/>
    <rect x="5" y="75" width="4" height="13" rx="1.4" fill="${a.grip}" ${T1}/>
    <path d="M5 78 L9 80 M5 82 L9 84" stroke="${a.guard}" stroke-width="0.9"/>
    <circle cx="7" cy="89.5" r="2" fill="${a.guard}" ${T1}/>`;
}

// Yoru-style black greatsword with an Egyptian dress: a long, slightly curved jet-black blade engraved with gold glyphs,
// a winged-sun cross guard set with three green jewels, a linen-bandaged grip and a round jewel pommel. Anchor = middle of the grip.
// a: { blade, bevel, edge, gold, goldDark?, linen?, gem, lapis?, glow? }
function yoruBody(a) {
  const g = a.gold, gd = a.goldDark || '#b07a2e', lin = a.linen || '#efe6d0', gem = a.gem, lap = a.lapis || '#2a55c8';
  const glow = a.glow ? `<path d="M10.5 90 C9.5 62 11 34 21.5 2 C24.6 26 23.6 62 21.5 90 Z" fill="${a.glow}" stroke="${a.glow}" stroke-width="4.5" stroke-linejoin="round" opacity="0.3"/>` : '';
  const jewel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${gem}" stroke="${INK}" stroke-width="0.9"/><circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.35}" fill="#ffffff" opacity="0.75"/>`;
  const wraps = [100, 104, 108, 112, 116].map((y) => `M13.4 ${y} L18.6 ${y + 3}`).join(' ');
  return `${glow}
    <path d="M10.5 90 C9.5 62 11 34 21.5 2 C24.6 26 23.6 62 21.5 90 Z" fill="${a.blade}" ${T}/>
    <path d="M12 88 C11 62 12.6 36 20.6 6 C19.2 36 17.4 62 16.8 88 Z" fill="${a.bevel}" opacity="0.9"/>
    <path d="M21 5 C23.8 28 23 62 21.2 88" stroke="${g}" stroke-width="1.2" fill="none"/>
    <path d="M11.2 86 C10.4 62 11.8 36 20.6 8" stroke="${a.edge}" stroke-width="0.9" fill="none" opacity="0.85"/>
    <g stroke="${g}" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
      <path d="M13.2 77 C14.6 75.2 17.8 75.2 19.2 77 C17.8 78.8 14.6 78.8 13.2 77 Z"/><circle cx="16.2" cy="77" r="0.7" fill="${g}"/><path d="M15.6 78.6 L15 81 M16.8 78.6 C17.8 80 18.8 80.4 19.4 80.2"/>
      <circle cx="16.8" cy="58" r="1.5"/><path d="M16.8 59.5 L16.8 65 M14.9 61 L18.7 61"/>
      <path d="M14.6 45 l1.6 -1.6 l1.6 1.6 l1.6 -1.6 M14.8 48 l1.6 -1.6 l1.6 1.6 l1.6 -1.6"/>
      <circle cx="18.6" cy="30" r="1.2"/><path d="M18.6 27.4 L18.6 26.6 M16 30 L15.2 30 M21.2 30 L22 30"/>
    </g>
    <path d="M9.6 88 L23.4 88 L22.6 92 L10.4 92 Z" fill="${g}" ${T1}/><path d="M11.2 89 L11.2 91.4 M14 89 L14 91.4 M17 89 L17 91.4 M20 89 L20 91.4" stroke="${lap}" stroke-width="1.3"/>
    <path d="M0.8 94 C3.6 88.6 9.4 89.4 12.4 91.6 L19.6 91.6 C22.6 89.4 28.4 88.6 31.2 94 C28.4 94.4 26.4 97.6 22 98.6 L10 98.6 C5.6 97.6 3.6 94.4 0.8 94 Z" fill="${g}" ${T1}/>
    <path d="M3 94 C6 91.6 9 92.4 11 94 M29 94 C26 91.6 23 92.4 21 94 M5.4 95.8 C7.4 94.4 9.6 95 11 96.2 M26.6 95.8 C24.6 94.4 22.4 95 21 96.2" stroke="${gd}" stroke-width="0.9" fill="none"/>
    <circle cx="16" cy="94.4" r="5.4" fill="${g}" ${T1}/><circle cx="16" cy="94.4" r="3.2" fill="${gd}" opacity="0.45"/>${jewel(16, 94.4, 2.5)}
    ${jewel(6.6, 95, 1.7)}${jewel(25.4, 95, 1.7)}
    <path d="M13.2 98.6 L18.8 98.6 L18.8 118 L13.2 118 Z" fill="${lin}" ${T1}/>
    <path d="${wraps}" stroke="${gd}" stroke-width="1" opacity="0.8"/><path d="M13.2 99.6 L18.8 99.6 M13.2 117 L18.8 117" stroke="${g}" stroke-width="1.4"/>
    <path d="M12.4 118 L19.6 118 L18.4 121.4 L13.6 121.4 Z" fill="${g}" ${T1}/>
    <circle cx="16" cy="125" r="4.8" fill="${g}" ${T1}/>${jewel(16, 125, 3.2)}`;
}

// In-hand sprite spec for any weapon item art.
export function weaponSprite(a) {
  switch (a.kind) {
    case 'forge': return forgeSprite(a, svg);
    case 'katana': return { w: 15, h: 84, ax: 7.5, ay: 70, svg: svg(15, 84, katanaBody(a)) };
    case 'dagger': return { w: 12, h: 38, ax: 6, ay: 29, svg: svg(12, 38, daggerBody(a)) };
    case 'greatsword': return { w: 30, h: 112, ax: 15, ay: 95, svg: svg(30, 112, greatswordBody(a)) };
    case 'staff': return { w: 22, h: 110, ax: 11, ay: 70, svg: svg(22, 110, staffBody(a)), meta: { tip: a.orb, tipAt: 57 } };
    case 'bow': return { w: 30, h: 76, ax: 24, ay: 38, svg: svg(30, 76, bowBody(a)), meta: { limb: 35, tipBack: 18, string: a.string } };
    case 'spear': return { w: 18, h: 132, ax: 9, ay: 92, svg: svg(18, 132, spearBody(a)) };
    case 'scythe': return { w: 66, h: 142, ax: 51, ay: 104, svg: svg(66, 142, scytheBody(a)) };
    case 'twin': return { w: 14, h: 92, ax: 7, ay: 79, svg: svg(14, 92, twinBody(a)) };
    case 'yoru': return { w: 32, h: 130, ax: 16, ay: 108, svg: svg(32, 130, yoruBody(a)) };
    default: return swordSprite(a);
  }
}

// 64×64 icon body (inside a 64-unit square), drawn diagonally like the sword icons.
export function weaponIconBody(a) {
  const fit = (w, h, body, s) => `<g transform="translate(32 32) rotate(40) scale(${s}) translate(${-w / 2} ${-h / 2})">${body}</g>`;
  switch (a.kind) {
    case 'forge': {
      const famId = familyOfForm(a.form), f = FAMILY[famId];
      if (famId === 'twinblades') {
        const off = a.off ? { ...a, ...a.off } : a;
        return `${fit(f.w, f.h, forgeBody(off), f.icon).replace('rotate(40)', 'rotate(-38)').replace('translate(32 32)', 'translate(30 33)')}${fit(f.w, f.h, forgeBody(a), f.icon).replace('translate(32 32)', 'translate(34 33)')}`;
      }
      if (famId === 'dagger') return `${fit(f.w, f.h, forgeBody(a), f.icon).replace('rotate(40)', 'rotate(28)').replace('translate(32 32)', 'translate(24 34)')}${fit(f.w, f.h, forgeBody(a), f.icon).replace('rotate(40)', 'rotate(-28)').replace('translate(32 32)', 'translate(40 34)')}`;
      if (famId === 'bow') return `<g transform="translate(32 32) rotate(-35) scale(0.78) translate(-15 -38)">${forgeBody(a)}<path d="M6 3.5 L6 72.5" stroke="${a.string}" stroke-width="1.4"/></g>`;
      if (famId === 'scythe') return `<g transform="translate(34 34) rotate(28) scale(0.48) translate(-46 -72)">${forgeBody(a)}</g>`;
      return fit(f.w, f.h, forgeBody(a), f.icon);
    }
    case 'katana': return fit(15, 84, katanaBody(a), 0.95);
    case 'dagger': return `${fit(12, 38, daggerBody(a), 1.3).replace('rotate(40)', 'rotate(28)').replace('translate(32 32)', 'translate(24 34)')}${fit(12, 38, daggerBody(a), 1.3).replace('rotate(40)', 'rotate(-28)').replace('translate(32 32)', 'translate(40 34)')}`;
    case 'greatsword': return fit(30, 112, greatswordBody(a), 0.66);
    case 'staff': return fit(22, 110, staffBody(a), 0.74);
    case 'bow': return `<g transform="translate(32 32) rotate(-35) scale(0.78) translate(-15 -38)">${bowBody(a)}<path d="M6 3.5 L6 72.5" stroke="${a.string}" stroke-width="1.4"/></g>`;
    case 'spear': return fit(18, 132, spearBody(a), 0.62);
    case 'scythe': return `<g transform="translate(34 34) rotate(28) scale(0.48) translate(-46 -72)">${scytheBody(a)}</g>`;
    case 'yoru': return fit(32, 130, yoruBody(a), 0.62);
    case 'twin': {
      const off = a.off || a;
      return `${fit(14, 92, twinBody(off), 0.66).replace('rotate(40)', 'rotate(-38)').replace('translate(32 32)', 'translate(30 33)')}${fit(14, 92, twinBody(a), 0.66).replace('translate(32 32)', 'translate(34 33)')}`;
    }
    default: return null;
  }
}
