// Pet illustrations (face right, anchor at the feet / hover point). Also reused as 2x portraits in the UI.
import { INK } from './palette.js';
import { forgePet } from './petForge.js';
import { PETS_V7 } from '../data/pets2.js';
import { PETS_EGYPT } from '../data/pets3.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b) => `<radialGradient id="${id}" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const eye = (x, y, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.38}" fill="#fff"/>`;

export function petFirefly() {
  return { w: 44, h: 40, ax: 22, ay: 36, svg: S(44, 40, rg('ab', '#fff3c4', '#f2a83a'),
    `<circle cx="16" cy="24" r="14" fill="#ffd889" opacity="0.25"/>
     <ellipse cx="25" cy="12" rx="9" ry="6" fill="#e9f3ff" opacity="0.7" ${O2} transform="rotate(-25 25 12)"/>
     <ellipse cx="19" cy="11" rx="8" ry="5" fill="#d8e8ff" opacity="0.6" ${O2} transform="rotate(-50 19 11)"/>
     <ellipse cx="15" cy="24" rx="9" ry="7.5" fill="url(#ab)" ${O}/>
     <path d="M9 20 Q15 23 21 20 M9 26 Q15 29 21 26" stroke="#c97a22" stroke-width="1.2" fill="none"/>
     <circle cx="28" cy="20" r="6.5" fill="#3a2a24" ${O}/>${eye(30, 19, 2)}
     <path d="M31 14 C33 9 36 8 38 9 M28 14 C28 9 30 7 32 7" stroke="${INK}" stroke-width="1.4" fill="none"/>`) };
}

export function petMossmouse() {
  return { w: 54, h: 42, ax: 27, ay: 40, svg: S(54, 42, rg('fur', '#c8b090', '#7a6248'),
    `<path d="M6 30 C0 26 2 16 8 18" stroke="#8a6a50" stroke-width="2.4" fill="none" stroke-linecap="round"/>
     <path d="M8 32 C8 20 18 14 28 14 C38 14 44 22 44 30 C44 36 38 38 28 38 C18 38 8 38 8 32 Z" fill="url(#fur)" ${O}/>
     <path d="M12 22 C14 14 22 10 30 12 C26 14 24 18 26 22 C22 20 16 20 12 22 Z" fill="#6aa25a" ${O2}/>
     <circle cx="17" cy="15" r="2.4" fill="#8fd06a"/><circle cx="24" cy="12" r="2" fill="#a5c76c"/>
     <circle cx="34" cy="14" r="6" fill="#d9b8a0" ${O}/><circle cx="34" cy="14" r="3" fill="#e8a0a0"/>
     <path d="M38 22 C44 20 50 24 50 28 C48 31 44 31 40 30 Z" fill="#c8b090" ${O2}/>
     <circle cx="50" cy="27.5" r="1.8" fill="#e06a6a"/>${eye(42, 24, 2.2)}
     <path d="M47 30 L53 31 M47 29 L52 27" stroke="${INK}" stroke-width="0.8"/>
     <path d="M16 38 L16 41 M34 38 L34 41" stroke="${INK}" stroke-width="2.4"/>`) };
}

export function petOwl() {
  return { w: 46, h: 50, ax: 23, ay: 48, svg: S(46, 50, rg('ch', '#ffd08a', '#e0592f'),
    `<path d="M4 26 C0 34 4 42 12 44 C8 36 8 30 10 24 Z M42 26 C46 34 42 42 34 44 C38 36 38 30 36 24 Z" fill="#3a3330" ${O2}/>
     <path d="M8 28 C6 12 14 4 23 4 C32 4 40 12 38 28 C38 40 32 46 23 46 C14 46 8 40 8 28 Z" fill="#4a3f3a" ${O}/>
     <path d="M15 30 C15 24 19 22 23 22 C27 22 31 24 31 30 C31 38 27 42 23 42 C19 42 15 38 15 30 Z" fill="url(#ch)"/>
     <path d="M18 30 Q23 33 28 30 M18 35 Q23 38 28 35" stroke="#b5401f" stroke-width="1.2" fill="none"/>
     <path d="M10 8 L14 14 M36 8 L32 14" stroke="${INK}" stroke-width="2.4"/>
     <circle cx="17" cy="17" r="6" fill="#f5d48a" ${O2}/><circle cx="29" cy="17" r="6" fill="#f5d48a" ${O2}/>
     ${eye(18, 17, 3)}${eye(30, 17, 3)}
     <path d="M21.5 21 L23 25 L24.5 21 Z" fill="#e0b45a" ${O2}/>
     <path d="M19 46 L19 49 M27 46 L27 49" stroke="#e0b45a" stroke-width="2.4"/>`) };
}

export function petTurtle() {
  return { w: 58, h: 40, ax: 29, ay: 38, svg: S(58, 40, rg('sh', '#9c9488', '#5b5450'),
    `<path d="M44 26 C50 22 56 24 56 28 C56 32 52 34 46 32 Z" fill="#8fae7a" ${O}/>${eye(51, 27, 1.9)}
     <path d="M10 34 L8 38 M20 35 L20 39 M36 35 L36 39 M46 34 L48 38" stroke="#6a8a5a" stroke-width="4" stroke-linecap="round"/>
     <path d="M4 32 C4 14 16 4 28 4 C42 4 50 14 50 32 Z" fill="url(#sh)" ${O}/>
     <path d="M14 32 L18 18 L28 12 L38 18 L42 32 M18 18 L10 26 M38 18 L46 26 M28 12 L28 4" stroke="${INK}" stroke-width="1.4" fill="none" opacity="0.6"/>
     <path d="M12 12 C16 6 24 4 30 6 C26 8 22 10 20 14 Z" fill="#6aa25a" opacity="0.85"/>
     <circle cx="34" cy="10" r="2" fill="#8fd06a"/>
     <path d="M2 32 L52 32" ${O}/>`) };
}

export function petGecko() {
  return { w: 64, h: 32, ax: 32, ay: 30, svg: S(64, 32, rg('gk', '#9ee0c8', '#3f8a78'),
    `<path d="M14 20 C8 22 4 18 6 12 C8 8 12 10 10 14 C9 16 11 18 14 17" stroke="#3f8a78" stroke-width="3.4" fill="none" stroke-linecap="round"/>
     <path d="M4 10 C2 6 6 2 10 4 M2 16 C-1 14 1 10 4 11" stroke="#cfeee4" stroke-width="1.4" fill="none" opacity="0.8"/>
     <path d="M14 18 C18 12 30 12 40 14 C46 12 54 12 60 16 C60 21 54 22 48 21 C40 24 24 25 14 18 Z" fill="url(#gk)" ${O}/>
     <path d="M24 16 L26 14 M30 15 L32 13 M36 15 L38 13" stroke="#e0f5ec" stroke-width="1.4"/>
     ${eye(53, 16, 2.2)}
     <path d="M22 22 L18 28 M30 23 L32 29 M40 22 L38 28 M46 21 L50 27" stroke="#3f8a78" stroke-width="2.6" stroke-linecap="round"/>`) };
}

export function petFox() {
  return { w: 64, h: 50, ax: 32, ay: 48, svg: S(64, 50, rg('fx', '#e8eeff', '#8f9fd0') + rg('tl', '#ffffff', '#a8b4e0'),
    `<path d="M14 32 C2 30 0 16 8 10 C10 18 14 22 20 24 Z" fill="url(#tl)" ${O}/>
     <path d="M4 14 C6 12 8 12 9 13" stroke="#fff" stroke-width="2" fill="none"/>
     <path d="M14 34 C14 24 24 20 34 20 C42 20 46 26 46 32 C46 38 40 40 30 40 C20 40 14 40 14 34 Z" fill="url(#fx)" ${O}/>
     <path d="M38 22 C38 14 44 10 50 12 C56 14 60 20 60 24 C56 26 50 28 44 27 Z" fill="url(#fx)" ${O}/>
     <path d="M42 14 L41 4 L48 11 Z M50 12 L54 3 L56 14 Z" fill="#c8d2f4" ${O2}/>
     <path d="M57 23 L62 24 L58 26 Z" fill="${INK}"/>${eye(51, 18, 2.2)}
     <path d="M26 26 C24 30 26 34 30 34 C27 32 26 29 28 27 Z" fill="#7a8ad8"/>
     <path d="M20 40 L20 46 M28 40 L28 46 M36 40 L36 46 M42 39 L43 45" stroke="#8f9fd0" stroke-width="3.6" stroke-linecap="round"/>
     <path d="M20 46 L20 47 M28 46 L28 47 M36 46 L36 47 M43 45 L43 46" ${O2}/>`) };
}

export function petLantern() {
  return { w: 42, h: 54, ax: 21, ay: 52, svg: S(42, 54, rg('ln', '#fff3c4', '#ff8a3d'),
    `<circle cx="21" cy="28" r="20" fill="#ffb35a" opacity="0.22"/>
     <path d="M15 4 L27 4 L25 9 L17 9 Z" fill="#3a2a24" ${O2}/>
     <path d="M8 26 C8 14 14 9 21 9 C28 9 34 14 34 26 C34 38 28 44 21 44 C14 44 8 38 8 26 Z" fill="url(#ln)" ${O}/>
     <path d="M14 11 C11 20 11 34 14 42 M28 11 C31 20 31 34 28 42 M21 9 L21 44" stroke="#c2412f" stroke-width="1.2" fill="none" opacity="0.6"/>
     <circle cx="16.5" cy="25" r="2.2" fill="${INK}"/><circle cx="25.5" cy="25" r="2.2" fill="${INK}"/>
     <path d="M18 31 Q21 34 24 31" stroke="${INK}" stroke-width="1.4" fill="none"/>
     <path d="M15 44 L27 44 L25 48 L17 48 Z" fill="#3a2a24" ${O2}/>
     <path d="M21 48 C18 50 18 52 21 53 C24 52 24 50 21 48 Z" fill="#ff8a3d"/>`) };
}

export function petDrake() {
  return { w: 66, h: 58, ax: 33, ay: 56, svg: S(66, 58, rg('dk', '#ffe2a0', '#c98a2a') + rg('wg', '#ffd08a', '#8e4a22'),
    `<path d="M22 22 C14 6 4 6 2 12 C8 14 10 20 12 26 C8 26 6 30 8 32 C14 30 18 30 22 30 Z" fill="url(#wg)" ${O}/>
     <path d="M6 12 L12 26 M4 20 L10 28" stroke="#5a2a14" stroke-width="1" opacity="0.7"/>
     <path d="M16 44 C6 46 2 40 4 34 C8 38 12 40 18 40 Z" fill="#d9a03a" ${O2}/>
     <path d="M14 40 C14 28 24 22 34 22 C42 22 48 30 48 38 C48 46 40 50 30 50 C22 50 14 48 14 40 Z" fill="url(#dk)" ${O}/>
     <path d="M22 38 Q30 42 40 38 M24 44 Q31 47 38 44" stroke="#a86a1a" stroke-width="1.2" fill="none"/>
     <path d="M40 26 C40 16 48 10 56 12 C62 14 64 22 62 28 C58 32 50 32 44 30 Z" fill="url(#dk)" ${O}/>
     <path d="M48 12 L46 4 L52 10 Z M56 12 L60 5 L60 14 Z" fill="#7a5a3c" ${O2}/>
     <circle cx="61" cy="25" r="1.2" fill="${INK}"/>${eye(54, 20, 2.4)}
     <path d="M30 22 L32 17 L35 22 M36 22 L39 18 L40 23" fill="#c2412f" ${O2}/>
     <path d="M22 50 L22 55 M38 49 L39 55" stroke="#c98a2a" stroke-width="4" stroke-linecap="round"/>
     <path d="M22 55 L22 56 M39 55 L39 56" ${O2}/>`) };
}

// v7 pets are drawn from their body plan + parts (art/petForge.js)
// (v9 Egyptian companions need pictures too — without them the pets panel threw and the pets were invisible in a fight)
const forged = Object.fromEntries([...Object.values(PETS_V7), ...Object.values(PETS_EGYPT)].map((p) => [p.sprite, () => forgePet(p.art)]));
export const PET_ART = Object.freeze({
  pet_firefly: petFirefly, pet_mossmouse: petMossmouse, pet_owl: petOwl, pet_turtle: petTurtle,
  pet_gecko: petGecko, pet_fox: petFox, pet_lantern: petLantern, pet_drake: petDrake,
  ...forged,
});
