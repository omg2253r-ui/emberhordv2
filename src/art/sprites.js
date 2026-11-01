// Hand-authored vector illustrations for characters, enemies and scenery.
// Each function returns { svg, w, h, ax, ay }: size in world px and the anchor (feet) point.
import { PAL, OUT, OUT_THIN, INK } from './palette.js';

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- hunter
export function weapon(art) {
  const g = art.glow ? `<path d="M10 4 C16 18 16 36 12 46 L8 46 C4 36 4 18 10 4 Z" fill="${art.glow}" opacity="0.35"/>` : '';
  let blade;
  switch (art.kind) {
    case 'saber': blade = `<path d="M9 46 C5 32 7 16 15 3 C15 18 15 32 13 46 Z" fill="${art.blade}" ${OUT_THIN}/><path d="M13 8 C12 20 12 32 12 44" stroke="${art.edge}" stroke-width="1.6" fill="none"/>`; break;
    case 'thorn': blade = `<path d="M7 46 L7 14 L4 18 L7 9 L10 2 L13 9 L16 18 L13 14 L13 46 Z" fill="${art.blade}" ${OUT_THIN}/><path d="M7 28 L3 25 L7 34 M13 24 L17 21 L13 30" stroke="${INK}" stroke-width="1.6" fill="${art.blade}"/><path d="M10 8 L10 44" stroke="${art.edge}" stroke-width="1.6"/>`; break;
    case 'fang': blade = `${g}<path d="M7 46 C4 30 6 14 13 2 C12 10 16 14 14 22 C17 26 14 34 13 46 Z" fill="${art.blade}" ${OUT_THIN}/><path d="M12 8 C11 20 11 32 11 44" stroke="${art.edge}" stroke-width="1.8" fill="none"/>`; break;
    default: blade = `<path d="M7 46 L7 9 L10 2 L13 9 L13 46 Z" fill="${art.blade}" ${OUT_THIN}/><path d="M10 7 L10 44" stroke="${art.edge}" stroke-width="1.6"/><path d="M8 20 L9 22 M12 33 L11 35" stroke="#7a5a3c" stroke-width="1.4" opacity="0.8"/>`;
  }
  return { w: 20, h: 64, ax: 10, ay: 58, svg: svg(20, 64, `
    ${blade}
    <rect x="2" y="45" width="16" height="5" rx="2" fill="${art.guard}" ${OUT_THIN}/>
    <rect x="7.5" y="50" width="5" height="10" rx="1.5" fill="${art.grip}" ${OUT_THIN}/>
    <circle cx="10" cy="61" r="2.6" fill="${art.guard}" ${OUT_THIN}/>
  `) };
}

// ---------------------------------------------------------------- enemies
export function tree(seed = 0) {
  const c1 = ['#2f4a2c', '#33502e', '#2c4530'][seed % 3], c2 = '#3f6236', c3 = '#5b8244';
  return { w: 170, h: 210, ax: 85, ay: 200, svg: svg(170, 210, `
    <path d="M74 200 C76 170 74 150 70 130 L100 130 C96 150 94 170 98 200 Z" fill="${PAL.bark}" ${OUT}/>
    <path d="M78 196 C80 170 79 150 76 134" stroke="${PAL.barkDark}" stroke-width="4" fill="none"/>
    <circle cx="52" cy="112" r="38" fill="${c1}" ${OUT}/>
    <circle cx="118" cy="110" r="40" fill="${c1}" ${OUT}/>
    <circle cx="85" cy="70" r="52" fill="${c2}" ${OUT}/>
    <circle cx="62" cy="58" r="20" fill="${c3}" opacity="0.6"/>
    <circle cx="104" cy="48" r="14" fill="${c3}" opacity="0.5"/>
    <circle cx="40" cy="104" r="12" fill="${c2}" opacity="0.7"/>
  `) };
}

export function bush() {
  return { w: 90, h: 60, ax: 45, ay: 56, svg: svg(90, 60, `
    <circle cx="26" cy="36" r="18" fill="#3a5a30" ${OUT}/>
    <circle cx="64" cy="36" r="18" fill="#3a5a30" ${OUT}/>
    <circle cx="45" cy="26" r="21" fill="#4a6e38" ${OUT}/>
    <path d="M10 54 Q45 60 80 54 L80 48 Q45 54 10 48 Z" fill="#2e4a28"/>
    <circle cx="38" cy="18" r="6" fill="#6f9a4a" opacity="0.6"/>
    <circle cx="70" cy="30" r="3" fill="${PAL.vermilion}" ${OUT_THIN}/><circle cx="22" cy="32" r="3" fill="${PAL.vermilion}" ${OUT_THIN}/>
  `) };
}

export function stone() {
  return { w: 70, h: 46, ax: 35, ay: 42, svg: svg(70, 46, `
    <path d="M6 40 C4 26 14 10 32 8 C52 6 66 20 64 36 Q36 46 6 40 Z" fill="#6c6f62" ${OUT}/>
    <path d="M10 38 Q36 44 62 36 C62 32 58 30 54 33 Q34 38 14 33 Z" fill="#4a4d43" opacity="0.8"/>
    <path d="M22 18 C28 13 38 12 44 14" stroke="#9a9d8c" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M40 22 C46 26 50 24 52 30" stroke="#6f9a4a" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.8"/>
  `) };
}

export function mushroom() {
  return { w: 40, h: 40, ax: 20, ay: 38, svg: svg(40, 40, `
    <path d="M15 37 C15 30 16 24 17 20 L24 20 C25 24 26 30 26 37 Z" fill="${PAL.cream}" ${OUT_THIN}/>
    <path d="M4 22 C4 10 14 4 21 4 C30 4 37 12 37 22 Q20 26 4 22 Z" fill="${PAL.vermilion}" ${OUT_THIN}/>
    <circle cx="14" cy="13" r="2.6" fill="${PAL.cream}"/><circle cx="25" cy="10" r="2" fill="${PAL.cream}"/><circle cx="30" cy="17" r="1.8" fill="${PAL.cream}"/>
  `) };
}

export function grass() {
  return { w: 40, h: 28, ax: 20, ay: 26, svg: svg(40, 28, `
    <path d="M6 26 C8 16 6 10 4 6 C10 12 12 18 13 26 Z" fill="#5f8a3e"/>
    <path d="M14 26 C16 14 18 8 20 2 C21 10 22 18 22 26 Z" fill="#78a24c"/>
    <path d="M22 26 C24 18 28 12 34 8 C30 16 30 20 30 26 Z" fill="#5f8a3e"/>
  `) };
}

export function flowers() {
  return { w: 36, h: 24, ax: 18, ay: 22, svg: svg(36, 24, `
    <path d="M8 22 L9 12 M18 22 L18 8 M28 22 L27 13" stroke="#4b6e33" stroke-width="2"/>
    <circle cx="9" cy="11" r="3.5" fill="${PAL.gold}" ${OUT_THIN}/><circle cx="18" cy="7" r="3.5" fill="${PAL.cream}" ${OUT_THIN}/><circle cx="27" cy="12" r="3.5" fill="#d98aa0" ${OUT_THIN}/>
  `) };
}

export function log() {
  return { w: 120, h: 50, ax: 60, ay: 44, svg: svg(120, 50, `
    <rect x="10" y="14" width="98" height="28" rx="14" fill="${PAL.bark}" ${OUT}/>
    <path d="M22 22 L90 22 M30 33 L96 33" stroke="${PAL.barkDark}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="102" cy="28" rx="10" ry="14" fill="#b88a5a" ${OUT}/>
    <ellipse cx="102" cy="28" rx="5" ry="7" fill="none" stroke="${PAL.bark}" stroke-width="2"/>
    <path d="M40 14 C42 6 50 4 54 8 C52 12 46 14 40 14 Z" fill="${PAL.moss}" ${OUT_THIN}/>
  `) };
}

// ---------------------------------------------------------------- camp
export function tent() {
  return { w: 220, h: 170, ax: 110, ay: 160, svg: svg(220, 170, `
    <path d="M110 12 L16 158 L204 158 Z" fill="#8a5a36" ${OUT}/>
    <path d="M110 12 L16 158 L70 158 Z" fill="#6e452a"/>
    <path d="M110 12 L80 158 L140 158 Z" fill="#2a1d18" ${OUT}/>
    <path d="M110 40 L94 158 L110 158 Z" fill="${PAL.vermilion}" ${OUT_THIN}/>
    <path d="M30 136 L190 136" stroke="${PAL.gold}" stroke-width="5" opacity="0.85"/>
    <path d="M30 136 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 M130 136 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8" stroke="${PAL.goldDark}" stroke-width="2.5" fill="none"/>
    <path d="M110 12 L110 0" ${OUT}/><path d="M110 2 L126 8 L110 12 Z" fill="${PAL.vermilion}" ${OUT_THIN}/>
  `) };
}

export function anvil() {
  return { w: 110, h: 80, ax: 55, ay: 76, svg: svg(110, 80, `
    <path d="M36 76 L42 52 L68 52 L74 76 Z" fill="#3b2a22" ${OUT}/>
    <path d="M10 30 C24 30 30 24 30 18 L92 18 L100 26 L84 34 L80 46 L32 46 C30 38 20 34 10 34 Z" fill="#5b5f66" ${OUT}/>
    <path d="M32 22 L90 22" stroke="#9aa3ad" stroke-width="4" stroke-linecap="round"/>
    <rect x="34" y="46" width="44" height="8" rx="2" fill="#41454b" ${OUT_THIN}/>
    <path d="M66 4 L92 4 L92 14 L66 14 Z" fill="#7a5a3c" ${OUT_THIN} transform="rotate(-20 79 9)"/>
    <path d="M70 12 L58 40" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  `) };
}

export function crates() {
  return { w: 100, h: 80, ax: 50, ay: 76, svg: svg(100, 80, `
    <rect x="8" y="34" width="46" height="42" rx="3" fill="#9a6a3e" ${OUT}/>
    <path d="M8 34 L54 76 M54 34 L8 76" stroke="#6e452a" stroke-width="3"/>
    <rect x="50" y="44" width="40" height="32" rx="3" fill="#8a5a36" ${OUT}/>
    <path d="M50 58 L90 58" stroke="#6e452a" stroke-width="3"/>
    <rect x="22" y="12" width="34" height="24" rx="3" fill="#a87848" ${OUT}/>
    <circle cx="39" cy="24" r="5" fill="${PAL.gold}" ${OUT_THIN}/>
  `) };
}

export function lantern() {
  return { w: 50, h: 150, ax: 25, ay: 146, svg: svg(50, 150, `
    <path d="M25 146 L25 26" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M25 26 L42 26" ${OUT}/>
    <path d="M36 28 L48 28 L46 52 L38 52 Z" fill="${PAL.gold}" ${OUT_THIN}/>
    <rect x="38" y="32" width="8" height="16" rx="2" fill="#ffe2a0"/>
  `) };
}

// ---------------------------------------------------------------- stage 2: Cinder Mine
export function deadTree() {
  return { w: 140, h: 200, ax: 70, ay: 196, svg: svg(140, 200, `
    <path d="M60 196 C62 160 58 120 54 90 C40 80 26 70 18 50 C30 60 44 66 54 70 C52 50 46 34 40 16 C52 30 60 50 64 70 C70 52 80 36 96 26 C88 42 78 60 74 82 C88 74 104 70 120 58 C110 76 92 88 76 100 C76 130 78 166 82 196 Z" fill="#2c2420" ${OUT}/>
    <path d="M64 190 C66 160 64 130 62 104" stroke="#4a3a30" stroke-width="4" fill="none"/>
  `) };
}

export function rockPile() {
  return { w: 130, h: 90, ax: 65, ay: 86, svg: svg(130, 90, `
    <path d="M10 84 C6 64 18 44 40 40 C50 24 72 20 88 30 C108 30 124 50 120 84 Z" fill="#4a423c" ${OUT}/>
    <path d="M40 40 C44 56 40 70 30 84 M88 30 C84 50 90 66 100 84" stroke="#2c2622" stroke-width="3" fill="none"/>
    <path d="M30 50 C40 44 50 44 56 46 M76 36 C86 34 96 36 102 40" stroke="#6e6560" stroke-width="4" stroke-linecap="round" fill="none"/>
  `) };
}

export function emberRock() {
  return { w: 70, h: 50, ax: 35, ay: 46, svg: svg(70, 50, `
    <path d="M6 44 C4 30 14 12 32 10 C52 8 66 22 64 40 Q36 50 6 44 Z" fill="#3e3632" ${OUT}/>
    <path d="M22 18 L30 28 L24 36 L34 42 M44 16 L40 26 L48 34" stroke="#ff7a33" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M22 18 L30 28 L24 36 L34 42 M44 16 L40 26 L48 34" stroke="#ffd08a" stroke-width="1" fill="none" stroke-linecap="round"/>
  `) };
}
