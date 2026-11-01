// v7 weapon illustrations: thirty silhouettes, one per weapon (art.form). Each keeps its family's canvas,
// grip anchor and proportions so the existing weapon poses hold it correctly.
import { INK, PAL } from './palette.js';

const T = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const T1 = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
const glowOf = (a, d, o = 0.38) => (a.glow ? `<path d="${d}" fill="${a.glow}" opacity="${o}"/>` : '');

// family canvases (w, h, anchor) — identical to art/weapons.js and art/sprites.js
export const FAMILY = Object.freeze({
  sword: { w: 20, h: 64, ax: 10, ay: 58, icon: 0.95 },
  katana: { w: 15, h: 84, ax: 7.5, ay: 70, icon: 0.95 },
  dagger: { w: 12, h: 38, ax: 6, ay: 29, icon: 1.3 },
  greatsword: { w: 30, h: 112, ax: 15, ay: 95, icon: 0.66 },
  staff: { w: 22, h: 110, ax: 11, ay: 70, icon: 0.74 },
  bow: { w: 30, h: 76, ax: 24, ay: 38, icon: 0.78 },
  spear: { w: 18, h: 132, ax: 9, ay: 92, icon: 0.62 },
  scythe: { w: 66, h: 142, ax: 51, ay: 104, icon: 0.48 },
  twinblades: { w: 14, h: 92, ax: 7, ay: 79, icon: 0.66 },
});

const swordHilt = (a, guard = 'bar') => (guard === 'disc'
  ? `<ellipse cx="10" cy="47.5" rx="9" ry="3.6" fill="${a.guard}" ${T1}/><circle cx="10" cy="47.5" r="2.2" fill="${a.glow || a.edge}"/>`
  : guard === 'wing' ? `<path d="M1 44 Q10 50 19 44 L18 49 Q10 52 2 49 Z" fill="${a.guard}" ${T1}/>`
    : `<rect x="2" y="45" width="16" height="5" rx="2" fill="${a.guard}" ${T1}/>`)
  + `<rect x="7.5" y="50" width="5" height="10" rx="1.5" fill="${a.grip}" ${T1}/><circle cx="10" cy="61" r="2.6" fill="${a.guard}" ${T1}/>`;
const katanaHilt = (a, tsuba) => `${tsuba}<rect x="5" y="63.5" width="5" height="17" rx="1.6" fill="${a.grip}" ${T1}/>
  <path d="M5 66 L10 69 M10 66 L5 69 M5 71 L10 74 M10 71 L5 74 M5 76 L10 79 M10 76 L5 79" stroke="${a.wrap}" stroke-width="1.2"/>
  <rect x="4.6" y="80" width="5.8" height="2.6" rx="1" fill="${PAL.gold}" ${T1}/>`;
const daggerHilt = (a) => `<rect x="4" y="25" width="4" height="9" rx="1.4" fill="${a.grip}" ${T1}/>`;
const greatHilt = (a) => `<rect x="11.5" y="87" width="7" height="19" rx="2" fill="${a.grip}" ${T}/>
  <path d="M11.5 92 L18.5 92 M11.5 97 L18.5 97 M11.5 102 L18.5 102" stroke="${PAL.barkDark}" stroke-width="1.2"/><circle cx="15" cy="108" r="3.4" fill="${a.guard}" ${T}/>`;
const staffShaft = (a) => `<path d="M9 108 L8.5 26 L13.5 26 L13 108 Z" fill="${a.wood}" ${T}/><path d="M10.5 30 L10.5 104" stroke="#ffffff" stroke-width="0.8" opacity="0.18"/><rect x="7.5" y="64" width="7" height="12" rx="2" fill="${PAL.barkDark}" ${T1}/>`;
const orb = (a, cx = 11, cy = 13, r = 6.2) => `<radialGradient id="orb" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.45" stop-color="${a.orb}"/><stop offset="1" stop-color="${INK}"/></radialGradient>
  <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="${a.glow || a.orb}" opacity="0.28"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#orb)" ${T1}/><circle cx="${cx - 2}" cy="${cy - 2}" r="1.6" fill="#fff" opacity="0.8"/>`;
const spearShaft = (a) => `<path d="M7.5 130 L7.5 30 L10.5 30 L10.5 130 Z" fill="${a.shaft}" ${T1}/><path d="M7.5 84 L10.5 84 M7.5 100 L10.5 100" stroke="${a.trim}" stroke-width="3"/><circle cx="9" cy="130" r="2.4" fill="${a.trim}" ${T1}/>`;
const scytheShaft = (a) => `<path d="M48.5 140 L48.5 18 L53.5 18 L53.5 140 Z" fill="${a.shaft}" ${T}/><path d="M48.5 70 L53.5 70 M48.5 74 L53.5 74 M48.5 100 L53.5 100 M48.5 104 L53.5 104" stroke="${a.trim}" stroke-width="1.6"/><path d="M48 136 L54 136 L53 141 L49 141 Z" fill="${a.trim}" ${T1}/>`;
const twinHilt = (a) => `<path d="M0.5 70 Q7 74 13.5 70 L13 74 Q7 77 1 74 Z" fill="${a.guard}" ${T1}/><rect x="5" y="75" width="4" height="13" rx="1.4" fill="${a.grip}" ${T1}/><circle cx="7" cy="89.5" r="2" fill="${a.guard}" ${T1}/>`;

const FORMS = {
  // ---------------------------------------------------------------- swords
  flamberge: (a) => `${glowOf(a, 'M10 2 C17 16 16 36 13 46 L7 46 C4 36 3 16 10 2 Z')}
    <path d="M7 46 C5 42 9 40 7 36 C5 32 9 30 7 26 C5 22 9 20 7 16 C6 12 8 6 10 2 C12 6 14 12 13 16 C11 20 15 22 13 26 C11 30 15 32 13 36 C11 40 15 42 13 46 Z" fill="${a.blade}" ${T1}/>
    <path d="M10 6 C11 18 9 30 10 44" stroke="${a.edge}" stroke-width="1.3" fill="none"/>${swordHilt(a, 'wing')}`,
  crystalsword: (a) => `${glowOf(a, 'M10 0 L18 12 L14 46 L6 46 L2 12 Z')}
    <path d="M10 1 L16 10 L13 46 L7 46 L4 10 Z" fill="${a.blade}" ${T1}/><path d="M10 1 L10 46 M4 10 L16 10 M5.5 28 L14.5 28" stroke="#ffffff" stroke-width="0.9" opacity="0.8"/>
    <path d="M10 10 L13 28 L10 46" fill="${a.glow}" opacity="0.35"/>${swordHilt(a, 'disc')}`,
  bonesaw: (a) => `${glowOf(a, 'M8 46 L8 6 L14 2 L16 46 Z', 0.3)}
    <path d="M7 46 L7 8 C7 4 10 2 13 3 L13 8 L16 10 L13 13 L16 16 L13 19 L16 22 L13 25 L16 28 L13 31 L16 34 L13 37 L16 40 L13 43 L13 46 Z" fill="${a.blade}" ${T1}/>
    <circle cx="9.5" cy="14" r="1.2" fill="${INK}" opacity="0.5"/><circle cx="9.5" cy="26" r="1.2" fill="${INK}" opacity="0.5"/><circle cx="9.5" cy="38" r="1.2" fill="${INK}" opacity="0.5"/>${swordHilt(a)}`,
  sunblade: (a) => `<circle cx="10" cy="16" r="11" fill="${a.glow}" opacity="0.3"/>
    <path d="M10 1 C17 10 17 30 13.5 46 L6.5 46 C3 30 3 10 10 1 Z" fill="${a.blade}" ${T1}/><path d="M10 5 L10 44" stroke="${a.edge}" stroke-width="1.6"/>
    <circle cx="10" cy="22" r="3" fill="${a.glow}" ${T1}/>${swordHilt(a, 'disc')}<path d="M1 47.5 L-1 47.5 M19 47.5 L21 47.5 M10 41 L10 40" stroke="${a.glow}" stroke-width="1.4"/>`,
  // ---------------------------------------------------------------- katana
  crimsonkatana: (a) => `${glowOf(a, 'M7 2 C12 20 11 42 9 60 L5 60 C6 42 7 20 7 2 Z', 0.3)}
    <path d="M6 60 C6 40 7 20 9 3 C11 6 11.5 9 11 12 C10 28 9.5 44 9 60 Z" fill="${a.blade}" ${T1}/>
    <path d="M9.4 10 C8.6 14 9.8 16 9 20 C8.2 24 9.6 26 8.8 30 C8 34 9.4 36 8.6 40 C8 44 9 48 8.4 56" stroke="${a.glow}" stroke-width="1.2" fill="none"/>
    ${katanaHilt(a, `<g>${[0, 72, 144, 216, 288].map((d) => `<circle cx="${(7.5 + Math.cos(d * Math.PI / 180) * 3.2).toFixed(1)}" cy="${(61.5 + Math.sin(d * Math.PI / 180) * 2).toFixed(1)}" r="2.2" fill="${a.guard}" stroke="${INK}" stroke-width="0.9"/>`).join('')}<circle cx="7.5" cy="61.5" r="1.2" fill="#ffe65a"/></g>`)}`,
  moonkatana: (a) => `${glowOf(a, 'M7 0 C14 20 12 42 10 60 L4 60 C5 42 6 20 7 0 Z', 0.45)}
    <path d="M6 60 C6 40 7 20 9 3 C11 6 11.5 9 11 12 C10 28 9.5 44 9 60 Z" fill="${a.blade}" opacity="0.85" ${T1}/>
    <path d="M9.6 8 C9 26 8.6 42 8.4 58" stroke="${a.edge}" stroke-width="1.4" fill="none"/>
    ${katanaHilt(a, `<path d="M1.5 61 A6 6 0 1 0 13.5 61 A5 4 0 1 1 1.5 61 Z" fill="${a.guard}" ${T1}/>`)}`,
  thunderkatana: (a) => `${glowOf(a, 'M7 2 C12 20 11 42 9 60 L5 60 C6 42 7 20 7 2 Z')}
    <path d="M6 60 C6 40 7 20 9 3 C11 6 11.5 9 11 12 C10 28 9.5 44 9 60 Z" fill="${a.blade}" ${T1}/>
    <path d="M9.6 9 L7.6 18 L9.8 20 L7.6 32 L9.6 34 L7.8 46" stroke="${a.glow}" stroke-width="1.3" fill="none"/>
    ${katanaHilt(a, `<rect x="2" y="59.5" width="11" height="4" rx="0.6" fill="${a.guard}" ${T1}/><path d="M3 61.5 L12 61.5" stroke="${a.glow}" stroke-width="0.9"/>`)}`,
  // ---------------------------------------------------------------- daggers
  kris: (a) => `${glowOf(a, 'M6 0 C11 8 10 16 9 22 L3 22 C2 16 1 8 6 0 Z', 0.4)}
    <path d="M4 22 C2 19 5 17 4 14 C3 11 6 9 5 6 C5 4 5.6 2 6 1 C7 3 8 5 7.6 7 C7 10 9.6 12 8.2 15 C7.4 18 9.8 19 8.4 22 Z" fill="${a.blade}" ${T1}/>
    <path d="M1 22 L11 22 L9 25 L3 25 Z" fill="${a.guard}" ${T1}/>${daggerHilt(a)}<path d="M3 34 Q6 37 9 34" fill="${a.guard}" ${T1}/>`,
  fanghook: (a) => `${glowOf(a, 'M2 22 C0 10 6 0 12 2 C8 6 8 14 9 22 Z', 0.4)}
    <path d="M3.5 22 C2 12 6 3 11.5 2 C8.6 5 8 9 8.4 14 C8.6 17 9 20 8.5 22 Z" fill="${a.blade}" ${T1}/><path d="M9.4 5 C7.6 9 7.4 14 7.6 20" stroke="${a.edge}" stroke-width="1" fill="none"/>
    <path d="M1 22 L11 22 L10 25 L2 25 Z" fill="${a.guard}" ${T1}/>${daggerHilt(a)}<circle cx="6" cy="35.4" r="2.4" fill="none" stroke="${a.guard}" stroke-width="1.8"/>`,
  needle: (a) => `${glowOf(a, 'M6 0 L8 22 L4 22 Z', 0.5)}
    <path d="M5 22 L6 0.5 L7 22 Z" fill="${a.blade}" ${T1}/><path d="M2 22 L10 22 L9 24 L3 24 Z" fill="${a.guard}" ${T1}/>${daggerHilt(a)}
    <circle cx="6" cy="35.6" r="2.6" fill="none" stroke="${a.guard}" stroke-width="1.6"/><circle cx="6" cy="22.8" r="0.8" fill="${a.glow}"/>`,
  // ---------------------------------------------------------------- greatswords
  executioner: (a) => `${glowOf(a, 'M3 4 L27 4 L27 80 L3 80 Z', 0.25)}
    <path d="M4 80 L4 6 L26 4 L26 80 Z" fill="${a.blade}" ${T}/><circle cx="15" cy="16" r="4.4" fill="#1a120e" ${T1}/>
    <path d="M6 10 L6 78" stroke="${a.edge}" stroke-width="1.6"/><path d="M10 40 L14 42 M18 60 L20 63" stroke="#6b5a4c" stroke-width="1.4" opacity="0.6"/>
    <path d="M1 80 L29 80 L28 86 L2 86 Z" fill="${a.guard}" ${T}/>${greatHilt(a)}`,
  dragonbone: (a) => `${glowOf(a, 'M15 2 L25 18 L22 80 L8 80 L6 18 Z', 0.3)}
    <path d="M8 80 L7 18 L4 22 L7 12 L5 14 L10 4 L15 1 L20 6 L24 12 L22 14 L25 20 L22 18 L22 80 Z" fill="${a.blade}" ${T}/>
    ${[24, 36, 48, 60, 72].map((y) => `<path d="M8 ${y} L22 ${y - 3}" stroke="${INK}" stroke-width="1.3" opacity="0.5"/><path d="M22 ${y - 3} L27 ${y - 6} L22 ${y}" fill="${a.blade}" ${T1}/>`).join('')}
    <path d="M15 8 L15 78" stroke="${a.glow}" stroke-width="1.2" opacity="0.7"/>
    <path d="M1 80 Q15 86 29 80 L28 86 Q15 91 2 86 Z" fill="${a.guard}" ${T}/>${greatHilt(a)}`,
  obsidian: (a) => `${glowOf(a, 'M15 1 L26 20 L24 80 L6 80 L4 20 Z', 0.3)}
    <path d="M6 80 L5 22 L9 12 L12 14 L15 2 L19 10 L22 8 L25 22 L24 80 Z" fill="${a.blade}" ${T}/>
    <path d="M10 22 L14 30 L11 38 L16 46 L12 56 L17 64 L14 76 M19 18 L18 28 L21 34" stroke="${a.edge}" stroke-width="1.5" fill="none"/>
    <path d="M1 80 L29 80 L26 87 L4 87 Z" fill="${a.guard}" ${T}/>${greatHilt(a)}`,
  tidebreaker: (a) => `${glowOf(a, 'M15 2 L26 14 L24 80 L6 80 L5 14 Z', 0.3)}
    <path d="M7 80 L7 16 L15 2 L23 12 L23 30 C27 32 27 38 23 40 L23 80 Z" fill="${a.blade}" ${T}/>
    <path d="M9 24 q3 -3 6 0 q3 3 6 0 M9 46 q3 -3 6 0 q3 3 6 0 M9 66 q3 -3 6 0 q3 3 6 0" stroke="${a.edge}" stroke-width="1.4" fill="none"/>
    <path d="M1 80 Q15 86 29 80 L28 86 Q15 91 2 86 Z" fill="${a.guard}" ${T}/>${greatHilt(a)}`,
  // ---------------------------------------------------------------- staves
  crescentstaff: (a) => `${staffShaft(a)}<path d="M2 18 C0 8 6 0 14 1 C8 4 6 10 7 16 C9 22 15 24 20 20 C18 26 10 28 5 25 Z" fill="${a.trim}" ${T1}/>${orb(a, 12, 12, 5.4)}`,
  serpentstaff: (a) => `${staffShaft(a)}<path d="M11 44 C3 40 3 32 11 30 C19 28 19 22 11 20" stroke="${INK}" stroke-width="5" fill="none"/><path d="M11 44 C3 40 3 32 11 30 C19 28 19 22 11 20" stroke="${a.trim}" stroke-width="3.2" fill="none"/>
    <path d="M6 20 C6 14 16 14 16 20 L14 24 L8 24 Z" fill="${a.trim}" ${T1}/><circle cx="9" cy="18" r="0.9" fill="#ffe65a"/><circle cx="13" cy="18" r="0.9" fill="#ffe65a"/>${orb(a, 11, 11, 5)}`,
  rootstaff: (a) => `${staffShaft(a)}<path d="M8.5 26 C4 22 2 16 4 8 M13.5 26 C18 22 20 16 18 8 M10 26 C8 20 8 14 10 6 M12 26 C14 20 14 14 13 6" stroke="${a.wood}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M4 8 L2 4 M18 8 L20 3" stroke="${a.wood}" stroke-width="1.6"/><path d="M3 12 C0 10 0 6 3 6 C4 8 4 10 3 12 Z M19 14 C22 12 22 8 19 8 C18 10 18 12 19 14 Z" fill="${a.trim}" ${T1}/>${orb(a, 11, 14, 5.6)}`,
  eyestaff: (a) => `${staffShaft(a)}<path d="M3 24 C1 16 4 6 6 4 L8 14 Z M19 24 C21 16 18 6 16 4 L14 14 Z" fill="${a.trim}" ${T1}/>
    <circle cx="11" cy="13" r="10" fill="${a.glow}" opacity="0.3"/><ellipse cx="11" cy="13" rx="7" ry="6" fill="#f8f0f0" ${T1}/><circle cx="11" cy="13" r="3.6" fill="${a.orb}"/><ellipse cx="11" cy="13" rx="1.2" ry="2.6" fill="${INK}"/>
    <path d="M5 9 L3 7 M17 9 L19 7 M11 7 L11 4" stroke="${a.trim}" stroke-width="1.2"/>`,
  // ---------------------------------------------------------------- bows (grip at 24,38; tips at 6,3 and 6,73)
  featherbow: (a) => `${a.glow ? `<path d="M6 4 C26 20 26 56 6 72" stroke="${a.glow}" stroke-width="8" fill="none" opacity="0.3"/>` : ''}
    <path d="M6 3 C14 6 22 18 24 30 C25 35 25 41 24 46 C22 58 14 70 6 73" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M6 3 C14 6 22 18 24 30 C25 35 25 41 24 46 C22 58 14 70 6 73" stroke="${a.wood}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    ${[[12, 9, -40], [18, 17, -55], [21, 25, -70], [12, 67, 40], [18, 59, 55], [21, 51, 70]].map(([x, y, r]) => `<path d="M${x} ${y} C${x + 8} ${y - 2} ${x + 10} ${y + 2} ${x + 9} ${y + 4} C${x + 6} ${y + 3} ${x + 3} ${y + 2} ${x} ${y} Z" fill="${a.trim}" transform="rotate(${r} ${x} ${y})" ${T1}/>`).join('')}
    <rect x="20.5" y="31" width="7" height="14" rx="2" fill="${PAL.barkDark}" ${T1}/>`,
  bonebow: (a) => `<path d="M6 3 C14 6 22 18 24 30 C25 35 25 41 24 46 C22 58 14 70 6 73" stroke="${INK}" stroke-width="6.4" fill="none" stroke-linecap="round"/>
    ${[[7, 4], [11, 7], [15, 11], [18, 16], [21, 21], [23, 26], [23, 50], [21, 55], [18, 60], [15, 65], [11, 69], [7, 72]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="2" fill="${a.wood}" ${T1}/>`).join('')}
    <path d="M6 3 C10 4 12 4 14 2 M6 73 C10 72 12 72 14 74" stroke="${a.wood}" stroke-width="2" fill="none"/>
    <rect x="20.5" y="29" width="7" height="18" rx="2" fill="${a.trim}" ${T1}/><circle cx="24" cy="38" r="2" fill="${a.glow}"/>`,
  stormbow: (a) => `${a.glow ? `<path d="M6 4 L24 24 L24 52 L6 72" stroke="${a.glow}" stroke-width="8" fill="none" opacity="0.3"/>` : ''}
    <path d="M6 3 L16 10 L22 22 L25 32 L25 44 L22 54 L16 66 L6 73" stroke="${INK}" stroke-width="6" fill="none" stroke-linejoin="round"/><path d="M6 3 L16 10 L22 22 L25 32 L25 44 L22 54 L16 66 L6 73" stroke="${a.wood}" stroke-width="3.6" fill="none" stroke-linejoin="round"/>
    <path d="M14 12 L18 16 L15 17 L20 24 M14 64 L18 60 L15 59 L20 52" stroke="${a.trim}" stroke-width="1.4" fill="none"/>
    <rect x="21" y="31" width="7" height="14" rx="1" fill="#2a2a3a" ${T1}/>`,
  // ---------------------------------------------------------------- spears
  trident: (a) => `${glowOf(a, 'M9 0 C16 10 16 22 9 32 C2 22 2 10 9 0 Z', 0.35)}${spearShaft(a)}
    <path d="M7 30 L7 14 L9 4 L11 14 L11 30 Z" fill="${a.head}" ${T1}/><path d="M7 26 C2 24 1 18 2 8 L4 12 L5 22 L7 23 Z M11 26 C16 24 17 18 16 8 L14 12 L13 22 L11 23 Z" fill="${a.head}" ${T1}/>
    <path d="M3 30 L15 30 L14 33 L4 33 Z" fill="${a.trim}" ${T1}/>`,
  halberd: (a) => `${spearShaft(a)}<path d="M8 4 L9 0 L10 4 L10.5 22 L7.5 22 Z" fill="${a.head}" ${T1}/>
    <path d="M10.5 10 C18 8 20 16 18 26 C16 22 13 22 10.5 22 Z" fill="${a.head}" ${T1}/><path d="M7.5 14 L3 12 L4 16 L7.5 18 Z" fill="${a.head}" ${T1}/>
    <path d="M17 12 C18 16 18 20 17 24" stroke="${a.edge}" stroke-width="1.2" fill="none"/><path d="M6.5 22 L11.5 22 L11.5 30 L6.5 30 Z" fill="${a.trim}" ${T1}/>`,
  serpentglaive: (a) => `${glowOf(a, 'M9 0 C20 10 18 24 10 32 C4 24 4 10 9 0 Z', 0.35)}${spearShaft(a)}
    <path d="M8 30 C4 24 10 20 6 14 C3 10 8 4 10 1 C12 6 14 8 13 12 C11 16 15 20 12 24 C10 26 12 28 11 30 Z" fill="${a.head}" ${T1}/>
    <path d="M10 4 C10 10 8 14 9 22" stroke="${a.edge}" stroke-width="1" fill="none"/><path d="M4 30 L14 30 L13 34 L5 34 Z" fill="${a.trim}" ${T1}/><circle cx="9" cy="32" r="1.4" fill="${a.glow}"/>`,
  // ---------------------------------------------------------------- scythes (grip at 51,104; blade from the top)
  twinscythe: (a) => `${glowOf(a, 'M50 20 C40 2 14 -2 2 12 C18 10 33 16 42 32 Z')}${scytheShaft(a)}
    <path d="M49 24 C42 7 21 2 3 13 C16 11 30 14 39 28 C42 31 46 30 49 24 Z" fill="${a.blade}" ${T}/>
    <path d="M53 24 C56 12 62 8 66 10 C62 14 60 20 60 28 C57 30 55 28 53 24 Z" fill="${a.blade}" ${T1}/>
    <path d="M44 20 C36 10 22 7 9 11" stroke="${a.edge}" stroke-width="1.6" fill="none"/><circle cx="51" cy="20" r="4" fill="${a.trim}" ${T1}/>`,
  ribscythe: (a) => `${glowOf(a, 'M50 20 C40 2 14 -2 2 12 C18 10 33 16 42 32 Z', 0.3)}${scytheShaft(a)}
    <path d="M49 24 C42 7 21 2 3 13 C16 11 30 14 39 28 C42 31 46 30 49 24 Z" fill="${a.blade}" ${T}/>
    ${[[14, 9], [22, 7], [30, 7], [38, 10]].map(([x, y]) => `<path d="M${x} ${y} C${x - 2} ${y + 8} ${x + 2} ${y + 12} ${x + 4} ${y + 13}" stroke="${INK}" stroke-width="3" fill="none"/><path d="M${x} ${y} C${x - 2} ${y + 8} ${x + 2} ${y + 12} ${x + 4} ${y + 13}" stroke="${a.blade}" stroke-width="1.6" fill="none"/>`).join('')}
    <circle cx="51" cy="18" r="5" fill="${a.blade}" ${T1}/><circle cx="49.6" cy="17" r="1.1" fill="${INK}"/><circle cx="52.4" cy="17" r="1.1" fill="${INK}"/>`,
  sakurascythe: (a) => `${glowOf(a, 'M50 20 C40 2 14 -2 2 12 C18 10 33 16 42 32 Z', 0.35)}${scytheShaft(a)}
    <path d="M49 24 C42 7 21 2 3 13 C16 11 30 14 39 28 C42 31 46 30 49 24 Z" fill="${a.blade}" ${T}/><path d="M44 20 C36 10 22 7 9 11" stroke="${a.edge}" stroke-width="1.6" fill="none"/>
    ${[[51, 50], [51, 82], [51, 120], [24, 12]].map(([x, y]) => `<g>${[0, 72, 144, 216, 288].map((d) => `<circle cx="${(x + Math.cos(d * Math.PI / 180) * 2.6).toFixed(1)}" cy="${(y + Math.sin(d * Math.PI / 180) * 2.6).toFixed(1)}" r="1.8" fill="${a.trim}" stroke="${INK}" stroke-width="0.7"/>`).join('')}<circle cx="${x}" cy="${y}" r="1" fill="#ffe65a"/></g>`).join('')}`,
  // ---------------------------------------------------------------- twin blades (each hand)
  leaftwins: (a) => `${glowOf(a, 'M7 0 C14 16 13 50 9 70 L5 70 C1 50 0 16 7 0 Z', 0.35)}
    <path d="M4.5 70 C2 54 1.5 30 4 16 C5 8 6 4 7 1.5 C8 4 9 8 10 16 C12.5 30 12 54 9.5 70 Z" fill="${a.blade}" ${T1}/>
    <path d="M7 4 L7 68 M7 20 L4 24 M7 32 L10 36 M7 44 L4 48 M7 56 L10 60" stroke="${a.edge}" stroke-width="0.9"/>${twinHilt(a)}`,
  sunmoontwins: (a) => `${glowOf(a, 'M7 0 C13 14 13 52 10 70 L4 70 C1 52 1 14 7 0 Z', 0.4)}
    <path d="M4.5 70 L4.5 9 L7 1.5 L9.5 9 L9.5 70 Z" fill="${a.blade}" ${T1}/><path d="M7 5 L7 68" stroke="${a.edge}" stroke-width="1.1"/>
    <circle cx="7" cy="36" r="3.4" fill="${a.glow}" ${T1}/>${twinHilt(a)}`,
  shadowtwins: (a) => `${glowOf(a, 'M3 70 C0 40 4 10 12 0 C10 20 12 50 11 70 Z', 0.35)}
    <path d="M4.5 70 C3 46 5 20 11 2 C10 18 10.5 40 9.5 70 Z" fill="${a.blade}" ${T1}/><path d="M10 8 C8.6 24 8.4 46 8 66" stroke="${a.edge}" stroke-width="1" fill="none"/>
    <path d="M6 30 L4 33 M6 50 L4 53" stroke="${a.edge}" stroke-width="0.9"/>${twinHilt(a)}`,
  // ---------------------------------------------------------------- v8
  prismrapier: (a) => `${glowOf(a, 'M10 0 L13 46 L7 46 Z', 0.4)}
    <path d="M10 0 L12.4 46 L7.6 46 Z" fill="${a.blade}" ${T1}/><path d="M10 2 L10 45" stroke="${a.edge}" stroke-width="0.9"/>
    <path d="M8.4 14 L11.6 18 M8.6 26 L11.4 30 M8.8 38 L11.2 42" stroke="${a.glow}" stroke-width="1.2" opacity="0.9"/>
    <path d="M1 46 C1 40 6 38 10 42 C14 38 19 40 19 46 C16 52 4 52 1 46 Z" fill="${a.guard}" ${T1}/><path d="M4 46 C6 43 9 43 10 45 C11 43 14 43 16 46" stroke="#ffffff" stroke-width="0.9" fill="none" opacity="0.7"/>
    <rect x="7.5" y="50" width="5" height="10" rx="1.5" fill="${a.grip}" ${T1}/><path d="M10 61 L13 64 L10 67 L7 64 Z" fill="${a.glow}" ${T1}/>`,
  eclipsehalberd: (a) => `<circle cx="10" cy="14" r="12" fill="${a.glow}" opacity="0.25"/>${spearShaft(a)}
    <path d="M8 2 L9 -2 L10 2 L10.5 24 L7.5 24 Z" fill="${a.edge}" ${T1}/>
    <path d="M10.5 8 C22 6 24 20 18 30 C17 24 14 22 10.5 24 Z" fill="${a.head}" ${T1}/><path d="M18 10 C21 16 21 22 18 28" stroke="${a.edge}" stroke-width="1.6" fill="none"/>
    <path d="M7.5 8 C-2 10 -3 20 2 28 C3 22 5 22 7.5 22 Z" fill="${a.edge}" ${T1}/><circle cx="3.5" cy="16" r="2" fill="${a.head}"/>
    <path d="M6.5 24 L11.5 24 L11.5 32 L6.5 32 Z" fill="${a.trim}" ${T1}/>`,
  eclipseblade: (a) => `<circle cx="15" cy="30" r="17" fill="none" stroke="${a.glow}" stroke-width="5" opacity="0.35"/>
    <path d="M15 1 L26 16 L23 84 L7 84 L4 16 Z" fill="${a.blade}" ${T}/>
    <path d="M15 4 L24 17 L21.5 82" stroke="${a.edge}" stroke-width="1.6" fill="none"/><path d="M15 4 L6 17 L8.5 82" stroke="${a.edge}" stroke-width="0.9" fill="none" opacity="0.6"/>
    <circle cx="15" cy="30" r="9" fill="#05030a" stroke="${a.edge}" stroke-width="2.4"/><circle cx="15" cy="30" r="12.5" fill="none" stroke="${a.glow}" stroke-width="1.4" stroke-dasharray="3 2.4"/>
    <path d="M15 44 L15 78" stroke="${a.glow}" stroke-width="1.2" opacity="0.6"/>
    <path d="M0 84 C4 80 10 80 15 84 C20 80 26 80 30 84 L28 89 L2 89 Z" fill="${a.guard}" ${T1}/>${greatHilt(a)}`,
};

export const WEAPON_FORMS = Object.freeze(Object.keys(FORMS));
const FORM_FAMILY = {
  flamberge: 'sword', crystalsword: 'sword', bonesaw: 'sword', sunblade: 'sword',
  crimsonkatana: 'katana', moonkatana: 'katana', thunderkatana: 'katana',
  kris: 'dagger', fanghook: 'dagger', needle: 'dagger',
  executioner: 'greatsword', dragonbone: 'greatsword', obsidian: 'greatsword', tidebreaker: 'greatsword',
  crescentstaff: 'staff', serpentstaff: 'staff', rootstaff: 'staff', eyestaff: 'staff',
  featherbow: 'bow', bonebow: 'bow', stormbow: 'bow',
  trident: 'spear', halberd: 'spear', serpentglaive: 'spear',
  twinscythe: 'scythe', ribscythe: 'scythe', sakurascythe: 'scythe',
  leaftwins: 'twinblades', sunmoontwins: 'twinblades', shadowtwins: 'twinblades',
  prismrapier: 'sword', eclipsehalberd: 'spear', eclipseblade: 'greatsword',
};
export const familyOfForm = (form) => FORM_FAMILY[form] || 'sword';
export function forgeBody(a) { return (FORMS[a.form] || FORMS.flamberge)(a); }
export function forgeSprite(a, svg) {
  const fam = FAMILY[familyOfForm(a.form)];
  const out = { w: fam.w, h: fam.h, ax: fam.ax, ay: fam.ay, svg: svg(fam.w, fam.h, forgeBody(a)) };
  if (familyOfForm(a.form) === 'staff') out.meta = { tip: a.orb, tipAt: 57 };
  if (familyOfForm(a.form) === 'bow') out.meta = { limb: 35, tipBack: 18, string: a.string };
  return out;
}
