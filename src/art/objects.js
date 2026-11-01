// Interactive dungeon objects and NPCs.
import { INK, PAL } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rg = (id, a, b) => `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;

export function chest(open = false, rich = false) {
  const band = rich ? '#e0b45a' : '#9aa3ad';
  const lid = open
    ? `<path d="M10 30 L12 6 C30 0 58 0 76 6 L78 30 Z" fill="url(#w)" ${O}/><path d="M14 26 L15 9 C32 4 56 4 73 9 L74 26 Z" fill="#2a1a14"/>
       <path d="M18 34 L70 34 L64 40 L24 40 Z" fill="url(#gl)" opacity="0.9"/>`
    : `<path d="M8 40 C8 22 24 14 44 14 C64 14 80 22 80 40 Z" fill="url(#w)" ${O}/>
       <path d="M8 40 C8 22 24 14 44 14 C64 14 80 22 80 40" fill="none" stroke="#c99a68" stroke-width="2" opacity="0.5"/>
       <path d="M26 17 L26 40 M62 17 L62 40" stroke="${band}" stroke-width="5"/>`;
  return { w: 88, h: 74, ax: 44, ay: 70, svg: S(88, 74, lg('w', '#a8743e', '#5a3a22') + rg('gl', '#fff3c4', 'rgba(255,180,80,0)'),
    `<path d="M8 38 L80 38 L78 68 L10 68 Z" fill="url(#w)" ${O}/>
     <path d="M12 48 L76 48 M12 58 L76 58" stroke="#4a2f1c" stroke-width="1.6" opacity="0.7"/>
     <path d="M26 38 L26 68 M62 38 L62 68" stroke="${band}" stroke-width="5"/>
     <path d="M26 38 L26 68 M62 38 L62 68" stroke="${INK}" stroke-width="1" opacity="0.5"/>
     ${lid}
     <rect x="38" y="${open ? 38 : 34}" width="12" height="13" rx="2" fill="${band}" ${O2}/><circle cx="44" cy="${open ? 44 : 40}" r="2" fill="${INK}"/>`) };
}

export function bonfireBase() {
  return { w: 100, h: 50, ax: 50, ay: 40, svg: S(100, 50, '',
    `<ellipse cx="50" cy="38" rx="44" ry="11" fill="#1c140f" opacity="0.6"/>
     <path d="M16 36 L84 22" stroke="#5a3a22" stroke-width="11" stroke-linecap="round"/><path d="M16 22 L84 36" stroke="#6e452a" stroke-width="11" stroke-linecap="round"/>
     <path d="M16 36 L84 22 M16 22 L84 36" stroke="${INK}" stroke-width="1.5" opacity="0.6"/>
     ${[0, 1, 2, 3, 4, 5, 6].map((i) => { const a = (i / 7) * Math.PI * 2; return `<ellipse cx="${50 + Math.cos(a) * 40}" cy="${32 + Math.sin(a) * 10}" rx="9" ry="6" fill="#6c6f62" ${O2}/>`; }).join('')}`) };
}

export function signpost() {
  return { w: 70, h: 100, ax: 35, ay: 96, svg: S(70, 100, lg('w', '#9a6a3e', '#5a3a22'),
    `<rect x="31" y="40" width="8" height="58" fill="url(#w)" ${O2}/>
     <path d="M6 14 L64 10 L66 46 L4 50 Z" fill="url(#w)" ${O}/>
     <path d="M14 18 L56 16 L57 42 L13 44 Z" fill="#efe2c4" ${O2}/>
     <path d="M18 24 L50 22 M18 30 L52 28 M18 36 L44 35" stroke="#5a4a40" stroke-width="2"/>
     <circle cx="35" cy="14" r="2.6" fill="#9aa3ad" ${O2}/>`) };
}

export function altar() {
  return { w: 120, h: 90, ax: 60, ay: 84, svg: S(120, 90, lg('s', '#8a8578', '#4e4a42') + rg('g', '#ffb35a', 'rgba(255,120,40,0)'),
    `<path d="M10 82 L18 54 L102 54 L110 82 Z" fill="url(#s)" ${O}/>
     <path d="M22 54 L28 22 L92 22 L98 54 Z" fill="url(#s)" ${O}/>
     <path d="M58 22 L54 34 L62 42 L56 54" stroke="${INK}" stroke-width="3" fill="none"/>
     <ellipse cx="60" cy="22" rx="16" ry="5" fill="#2a1a14" ${O2}/>
     <circle cx="60" cy="20" r="14" fill="url(#g)"/>
     <path d="M34 34 c2 -4 6 -4 7 0 l1 8 l-9 0 Z" fill="#2a1a14" opacity="0.7"/>
     <path d="M76 36 c1 -2 3 -2 4 0 l1 5 l-5 0 Z" fill="#2a1a14" opacity="0.7"/>
     <path d="M30 70 L44 70 M76 70 L90 70" stroke="#a8a090" stroke-width="2"/>`) };
}

export function desk() {
  return { w: 110, h: 80, ax: 55, ay: 76, svg: S(110, 80, lg('w', '#8a5a36', '#4a2f1c'),
    `<path d="M10 36 L100 36 L96 46 L14 46 Z" fill="url(#w)" ${O}/>
     <path d="M16 46 L18 76 M92 46 L90 76" stroke="#3c271c" stroke-width="6" stroke-linecap="round"/>
     <path d="M30 22 L62 18 L66 34 L32 38 Z" fill="#efe2c4" ${O2}/>
     <path d="M36 25 L58 22 M36 30 L60 27" stroke="#5a4a40" stroke-width="1.6"/>
     <rect x="72" y="20" width="12" height="16" rx="2" fill="#e0b45a" ${O2}/><path d="M78 20 L78 12" stroke="#ffb35a" stroke-width="3"/>
     <circle cx="78" cy="10" r="4" fill="#ffd889" opacity="0.8"/>`) };
}

export function pedestalLetter() {
  return { w: 70, h: 90, ax: 35, ay: 86, svg: S(70, 90, lg('s', '#6e6560', '#3a3330') + rg('g', '#ffd08a', 'rgba(255,120,40,0)'),
    `<circle cx="35" cy="30" r="28" fill="url(#g)" opacity="0.8"/>
     <path d="M16 86 L20 50 L50 50 L54 86 Z" fill="url(#s)" ${O}/>
     <path d="M12 50 L58 50 L56 42 L14 42 Z" fill="#5b5450" ${O2}/>
     <path d="M20 40 L48 34 L50 22 L22 28 Z" fill="#f3e6c8" ${O2}/>
     <path d="M26 30 L44 26 M26 34 L40 31" stroke="#c2412f" stroke-width="1.6"/>
     <path d="M36 20 L38 14" stroke="#c2412f" stroke-width="3" stroke-linecap="round"/>`) };
}

export function dartTurret() {
  return { w: 64, h: 64, ax: 32, ay: 32, svg: S(64, 64, lg('s', '#7d7a6e', '#43403a'),
    `<path d="M8 10 C8 4 56 4 56 10 L58 54 C58 60 6 60 6 54 Z" fill="url(#s)" ${O}/>
     <path d="M16 22 L26 26 M48 22 L38 26" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
     <circle cx="21" cy="30" r="4" fill="#3c5226"/><circle cx="43" cy="30" r="4" fill="#3c5226"/>
     <ellipse cx="32" cy="44" rx="9" ry="6" fill="#1a120e" ${O2}/>
     <path d="M10 14 C18 20 22 12 30 16 M54 14 C46 20 42 12 34 16" stroke="#58733a" stroke-width="3" fill="none"/>`) };
}

export function bossSeal() {
  return { w: 120, h: 120, ax: 60, ay: 60, svg: S(120, 120, rg('g', '#f5d48a', '#a77a2c') + lg('s', '#6e6a60', '#2e2a26'),
    `<circle cx="60" cy="60" r="54" fill="url(#s)" ${O}/>
     <circle cx="60" cy="60" r="42" fill="none" stroke="url(#g)" stroke-width="3"/>
     <path d="M60 22 L68 50 L98 60 L68 70 L60 98 L52 70 L22 60 L52 50 Z" fill="none" stroke="url(#g)" stroke-width="3" stroke-linejoin="round"/>
     <circle cx="60" cy="60" r="9" fill="#c2412f" ${O2}/>
     <path d="M30 36 l6 6 M84 84 l6 6 M90 36 l-6 6 M36 84 l-6 6" stroke="#f5d48a" stroke-width="2"/>`) };
}

export function lekNpc() {
  return { w: 90, h: 118, ax: 45, ay: 113, svg: S(90, 118, lg('ap', '#7d5540', '#3c271c') + lg('sk', '#e0b08a', '#b07a58'),
    `<rect x="27" y="92" width="14" height="20" rx="4" fill="#2c1d15" ${O2}/><rect x="49" y="92" width="14" height="20" rx="4" fill="#2c1d15" ${O2}/>
     <path d="M18 96 C16 70 24 52 45 50 C66 52 74 70 72 96 Q45 102 18 96 Z" fill="#4a3a30" ${O}/>
     <path d="M28 56 L62 56 L66 98 L24 98 Z" fill="url(#ap)" ${O2}/>
     <path d="M34 66 L56 66" stroke="#a87a5a" stroke-width="2"/>
     <path d="M68 62 C78 66 82 74 80 84" fill="none" stroke="#4a3a30" stroke-width="9" stroke-linecap="round"/>
     <path d="M74 80 L84 96" stroke="#5a3a22" stroke-width="5" stroke-linecap="round"/>
     <rect x="76" y="92" width="18" height="10" rx="2" fill="#6e6a60" ${O2} transform="rotate(-30 85 97)"/>
     <circle cx="45" cy="34" r="17" fill="url(#sk)" ${O}/>
     <path d="M30 38 C32 54 40 60 45 60 C52 60 58 54 60 38 C56 44 52 46 45 46 C38 46 34 44 30 38 Z" fill="#e8e2d6" ${O2}/>
     <path d="M36 30 L43 31 M48 31 L55 30" stroke="#e8e2d6" stroke-width="3" stroke-linecap="round"/>
     <path d="M37 35 Q40 33 43 35 M48 35 Q51 33 54 35" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
     <path d="M34 22 C38 18 50 18 56 22" stroke="#f0c8a0" stroke-width="3" fill="none" opacity="0.7"/>`) };
}

export const KEY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5d48a"/><stop offset="1" stop-color="#a77a2c"/></linearGradient></defs>
  <circle cx="22" cy="22" r="14" fill="url(#k)" stroke="${INK}" stroke-width="3"/><circle cx="22" cy="22" r="5" fill="#2a1a14"/>
  <path d="M31 31 L56 56 M44 44 L50 38 M50 50 L56 44" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M31 31 L56 56 M44 44 L50 38 M50 50 L56 44" stroke="url(#k)" stroke-width="5" stroke-linecap="round"/></svg>`;
