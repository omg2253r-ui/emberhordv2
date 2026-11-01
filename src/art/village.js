// Ember Crossing (หมู่บ้านทางแยกถ่าน) — the online hub: fountain, houses, market stalls, the duel ring, the gate home.
import { PAL, INK } from './palette.js';

const S = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

export function fountain() {
  return { w: 220, h: 170, ax: 110, ay: 150, svg: S(220, 170, `
    <ellipse cx="110" cy="128" rx="104" ry="36" fill="#6b6460" ${O}/>
    <ellipse cx="110" cy="122" rx="92" ry="28" fill="#3f6b80" ${O2}/>
    <ellipse cx="100" cy="118" rx="60" ry="14" fill="#6fa7c0" opacity="0.6"/>
    <path d="M6 128 L6 140 C30 168 190 168 214 140 L214 128" fill="#5b5450" ${O}/>
    <path d="M20 146 L20 156 M60 156 L60 164 M110 158 L110 166 M160 156 L160 164 M200 146 L200 156" stroke="#3a3330" stroke-width="2"/>
    <path d="M92 122 L96 70 L124 70 L128 122 Z" fill="#8a8078" ${O}/>
    <ellipse cx="110" cy="70" rx="34" ry="10" fill="#8a8078" ${O}/>
    <path d="M100 66 C100 40 120 40 120 66" fill="#c2412f" ${O2}/>
    <path d="M110 30 C116 38 120 44 120 52 A10 10 0 0 1 100 52 C100 44 104 38 110 30 Z" fill="#ffb35a" ${O2}/>
    <path d="M110 40 C113 45 114 48 114 52 A4 4 0 0 1 106 52 C106 48 108 45 110 40 Z" fill="#fff3c4"/>
    <path d="M86 74 C70 82 66 100 70 116 M134 74 C150 82 154 100 150 116" stroke="#bfe3ff" stroke-width="3" fill="none" opacity="0.8"/>
  `) };
}

export function house(roof = '#8e2c21') {
  return { w: 240, h: 230, ax: 120, ay: 220, svg: S(240, 230, `
    <path d="M30 120 L30 216 L210 216 L210 120 Z" fill="#c9a87a" ${O}/>
    <path d="M30 150 L210 150 M30 184 L210 184" stroke="#a88660" stroke-width="2"/>
    <path d="M60 120 L60 216 M180 120 L180 216" stroke="#6e4a30" stroke-width="7"/>
    <path d="M8 128 L120 30 L232 128 L212 132 L120 54 L28 132 Z" fill="${roof}" ${O}/>
    <path d="M28 132 L120 54 L212 132 L196 112 L120 46 L44 112 Z" fill="${roof}" opacity="0.7"/>
    <path d="M120 30 L120 18" ${O}/><circle cx="120" cy="14" r="5" fill="${PAL.gold}" ${O2}/>
    <path d="M100 216 L100 160 Q120 146 140 160 L140 216 Z" fill="#4a2f22" ${O}/>
    <circle cx="132" cy="190" r="2.5" fill="${PAL.gold}"/>
    <rect x="72" y="158" width="20" height="22" fill="#ffd889" ${O2}/><rect x="150" y="158" width="20" height="22" fill="#ffd889" ${O2}/>
    <path d="M82 158 L82 180 M72 169 L92 169 M160 158 L160 180 M150 169 L170 169" stroke="${INK}" stroke-width="1.5"/>
    <path d="M18 216 L222 216" ${O}/>
  `) };
}

export function stall(cloth = '#c2412f', goods = 'fruit') {
  const items = goods === 'fruit'
    ? `<circle cx="58" cy="96" r="8" fill="#e0592f" ${O2}/><circle cx="74" cy="98" r="8" fill="#ffb35a" ${O2}/><circle cx="90" cy="96" r="8" fill="#8fd06a" ${O2}/><circle cx="106" cy="98" r="8" fill="#e0592f" ${O2}/><circle cx="122" cy="96" r="8" fill="#ffd889" ${O2}/>`
    : `<rect x="52" y="86" width="14" height="16" rx="2" fill="#9fb8ff" ${O2}/><path d="M78 102 L84 82 L90 102 Z" fill="#c27ff0" ${O2}/><rect x="100" y="88" width="12" height="14" fill="#7fc77a" ${O2}/><circle cx="128" cy="95" r="7" fill="#f5d48a" ${O2}/>`;
  return { w: 180, h: 160, ax: 90, ay: 150, svg: S(180, 160, `
    <path d="M24 46 L24 148 M156 46 L156 148" stroke="#6e4a30" stroke-width="7" stroke-linecap="round"/>
    <path d="M12 52 L90 18 L168 52 Z" fill="${cloth}" ${O}/>
    <path d="M12 52 Q25 64 38 52 Q51 64 64 52 Q77 64 90 52 Q103 64 116 52 Q129 64 142 52 Q155 64 168 52" fill="#f3e6c8" ${O2}/>
    <rect x="36" y="104" width="108" height="40" fill="#8a5a36" ${O}/>
    <path d="M36 118 L144 118 M36 130 L144 130" stroke="#6e4a30" stroke-width="2"/>
    <path d="M40 104 L140 104" ${O}/>${items}
  `) };
}

export function gate() {
  return { w: 220, h: 230, ax: 110, ay: 220, svg: S(220, 230, `
    <path d="M20 220 L20 70 L44 70 L44 220 Z M176 220 L176 70 L200 70 L200 220 Z" fill="#7a5a3c" ${O}/>
    <path d="M6 76 Q110 20 214 76 L214 54 Q110 0 6 54 Z" fill="#2a1a14" ${O}/>
    <path d="M24 60 Q110 18 196 60" stroke="${PAL.gold}" stroke-width="3" fill="none"/>
    <rect x="70" y="40" width="80" height="26" rx="4" fill="#17110e" ${O2}/>
    <path d="M86 53 L134 53" stroke="${PAL.gold}" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 96 L36 96 M30 140 L36 140 M186 96 L192 96 M186 140 L192 140" stroke="#4a3426" stroke-width="3"/>
    <circle cx="32" cy="110" r="9" fill="#ffd889" opacity="0.9" ${O2}/><circle cx="188" cy="110" r="9" fill="#ffd889" opacity="0.9" ${O2}/>
  `) };
}

export function banner(color = '#c2412f') {
  return { w: 60, h: 190, ax: 30, ay: 184, svg: S(60, 190, `
    <path d="M28 184 L28 10" stroke="#5a3a24" stroke-width="6" stroke-linecap="round"/>
    <circle cx="28" cy="8" r="6" fill="${PAL.gold}" ${O2}/>
    <path d="M30 22 L56 22 L56 92 L43 82 L30 92 Z" fill="${color}" ${O}/>
    <path d="M43 40 C47 46 49 50 49 54 A6 6 0 0 1 37 54 C37 50 39 46 43 40 Z" fill="#f5d48a"/>
    <ellipse cx="28" cy="184" rx="14" ry="4" fill="#3a2a20"/>
  `) };
}

export function duelRing() {
  // flat ground decoration, drawn under everything
  return { w: 360, h: 200, ax: 180, ay: 100, svg: S(360, 200, `
    <ellipse cx="180" cy="100" rx="172" ry="92" fill="#8a7350" opacity="0.55" stroke="#5a4630" stroke-width="5"/>
    <ellipse cx="180" cy="100" rx="150" ry="78" fill="none" stroke="${PAL.gold}" stroke-width="3" stroke-dasharray="14 10" opacity="0.8"/>
    <path d="M180 38 L180 162 M60 100 L300 100" stroke="#5a4630" stroke-width="2" opacity="0.6"/>
    <path d="M160 92 L200 108 M200 92 L160 108" stroke="#c2412f" stroke-width="5" stroke-linecap="round"/>
  `) };
}

export function pillar() {
  // arena corner column with a lit brazier
  return { w: 70, h: 170, ax: 35, ay: 160, svg: S(70, 170, `
    <ellipse cx="35" cy="160" rx="30" ry="8" fill="#2a201a"/>
    <path d="M12 160 L12 148 L58 148 L58 160 Z" fill="#6b6460" ${O}/>
    <path d="M18 148 L20 52 L50 52 L52 148 Z" fill="#8a8078" ${O}/>
    <path d="M27 60 L27 140 M35 58 L35 142 M43 60 L43 140" stroke="#6b6460" stroke-width="2"/>
    <path d="M10 52 L60 52 L54 40 L16 40 Z" fill="#6b6460" ${O}/>
    <path d="M16 40 Q35 50 54 40" fill="#3a2a20" ${O2}/>
    <path d="M35 6 C42 16 46 22 46 30 A11 11 0 0 1 24 30 C24 22 28 16 35 6 Z" fill="#ff8a3d" ${O2}/>
    <path d="M35 18 C38 23 40 26 40 30 A5 5 0 0 1 30 30 C30 26 32 23 35 18 Z" fill="#fff3c4"/>
  `) };
}

export function noticeBoard() {
  return { w: 150, h: 150, ax: 75, ay: 144, svg: S(150, 150, `
    <path d="M28 144 L28 30 M122 144 L122 30" stroke="#6e4a30" stroke-width="8" stroke-linecap="round"/>
    <rect x="14" y="26" width="122" height="78" rx="4" fill="#8a5a36" ${O}/>
    <path d="M10 26 L75 6 L140 26 Z" fill="#4a2f22" ${O}/>
    <rect x="26" y="36" width="40" height="30" fill="#f3e6c8" ${O2} transform="rotate(-4 46 51)"/>
    <rect x="76" y="38" width="46" height="34" fill="#e8d6ae" ${O2} transform="rotate(3 99 55)"/>
    <rect x="40" y="70" width="44" height="26" fill="#f3e6c8" ${O2}/>
    <path d="M32 46 L58 44 M32 54 L54 52 M82 48 L114 50 M82 56 L110 58 M46 78 L78 78 M46 86 L70 86" stroke="#6e4a30" stroke-width="2"/>
    <circle cx="46" cy="38" r="3" fill="#c2412f"/><circle cx="99" cy="40" r="3" fill="#c2412f"/><circle cx="62" cy="72" r="3" fill="#c2412f"/>
  `) };
}

export function riftGate() {
  // the rift to the online zones: an old stone arch around a swirling portal
  return { w: 200, h: 240, ax: 100, ay: 230, svg: S(200, 240, `
    <ellipse cx="100" cy="226" rx="92" ry="12" fill="#2a201a"/>
    <path d="M22 226 L22 96 C22 30 178 30 178 96 L178 226 L148 226 L148 100 C148 62 52 62 52 100 L52 226 Z" fill="#7a7068" ${O}/>
    <path d="M30 120 L44 120 M30 160 L44 160 M30 200 L44 200 M156 120 L170 120 M156 160 L170 160 M156 200 L170 200 M60 52 L68 64 M140 52 L132 64 M100 40 L100 54" stroke="#4a423c" stroke-width="3"/>
    <ellipse cx="100" cy="146" rx="46" ry="78" fill="#2a3a6a" ${O2}/>
    <ellipse cx="100" cy="146" rx="36" ry="64" fill="#3f6fb8"/>
    <path d="M100 90 C130 100 130 140 100 146 C70 152 70 192 100 202" fill="none" stroke="#bfe3ff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
    <path d="M78 110 C96 118 92 136 78 140 M122 156 C104 164 108 182 122 186" fill="none" stroke="#e8f8ff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <circle cx="100" cy="146" r="10" fill="#fff3c4"/>
    <path d="M86 20 L100 4 L114 20 L100 34 Z" fill="${PAL.gold}" ${O2}/>
  `) };
}


// หัวหน้าหมู่บ้าน — the old smith-chief: long ember-red robe over a leather apron, white beard, a hammer-headed staff
export function chief() {
  return { w: 120, h: 170, ax: 60, ay: 162, svg: S(120, 170, `
    <ellipse cx="60" cy="160" rx="34" ry="8" fill="rgba(0,0,0,0.35)"/>
    <path d="M96 22 L96 158" stroke="#5a3a24" stroke-width="7" stroke-linecap="round"/>
    <path d="M96 22 L96 158" stroke="${INK}" stroke-width="2" fill="none" opacity="0.5"/>
    <path d="M82 14 L110 14 L110 30 L82 30 Z" fill="#8a8078" ${O2}/>
    <path d="M84 18 L108 18" stroke="#c9c0b4" stroke-width="2"/>
    <path d="M30 70 C24 100 22 130 20 156 L100 156 C98 130 96 100 90 70 Z" fill="#8e2c21" ${O}/>
    <path d="M44 74 L40 156 L80 156 L76 74 Z" fill="#6e4a30" ${O2}/>
    <path d="M48 100 L72 100 M47 122 L73 122" stroke="#4a2f22" stroke-width="2"/>
    <circle cx="60" cy="110" r="3.2" fill="${PAL.gold}" ${O2}/>
    <path d="M30 76 C20 90 18 108 26 118 L36 114 C32 102 34 90 40 82 Z" fill="#a8382a" ${O2}/>
    <path d="M90 76 C98 84 100 94 98 104 L90 106 C90 96 88 88 84 82 Z" fill="#a8382a" ${O2}/>
    <circle cx="94" cy="104" r="6" fill="#e8b48a" ${O2}/>
    <circle cx="26" cy="118" r="6" fill="#e8b48a" ${O2}/>
    <path d="M38 52 C38 34 82 34 82 52 L82 62 C82 72 72 80 60 80 C48 80 38 72 38 62 Z" fill="#e8b48a" ${O}/>
    <path d="M40 60 C40 92 52 104 60 106 C68 104 80 92 80 60 C74 70 66 72 60 72 C54 72 46 70 40 60 Z" fill="#f4efe6" ${O2}/>
    <path d="M50 64 C54 60 58 62 60 64 C62 62 66 60 70 64" fill="none" stroke="#d8d0c4" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 52 L54 50 M66 50 L74 52" stroke="#f4efe6" stroke-width="4" stroke-linecap="round"/>
    <path d="M49 55 L52 55 M68 55 L71 55" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M26 40 C30 20 90 20 94 40 C80 34 40 34 26 40 Z" fill="#c9a24a" ${O}/>
    <path d="M42 30 C46 14 74 14 78 30" fill="#b08a3a" ${O2}/>
    <path d="M44 30 L76 30" stroke="#8e2c21" stroke-width="3"/>
  `) };
}
export function forge() {
  // the chief's open-air forge: anvil, coals, a rack of blueprints
  return { w: 170, h: 120, ax: 85, ay: 112, svg: S(170, 120, `
    <ellipse cx="85" cy="110" rx="80" ry="9" fill="rgba(0,0,0,0.35)"/>
    <path d="M110 108 L110 60 L160 60 L160 108 Z" fill="#6e4a30" ${O}/>
    <path d="M116 66 L154 66 L154 102 L116 102 Z" fill="#f0e2c0" ${O2}/>
    <path d="M122 74 L148 74 M122 82 L144 82 M122 90 L148 90" stroke="#3f6fb8" stroke-width="2"/>
    <path d="M10 108 L18 84 L62 84 L70 108 Z" fill="#3a2e2a" ${O}/>
    <ellipse cx="40" cy="84" rx="26" ry="7" fill="#ff7a33" ${O2}/>
    <ellipse cx="40" cy="83" rx="16" ry="4" fill="#ffcf5a"/>
    <path d="M58 56 L104 56 C104 64 94 68 86 68 L80 68 L80 84 L92 96 L56 96 L68 84 L68 68 L64 68 C60 68 58 62 58 56 Z" fill="#5a5450" ${O}/>
    <path d="M62 58 L100 58" stroke="#8a8078" stroke-width="2"/>
  `) };
}

export const VILLAGE_ART = Object.freeze({
  v_chief: chief, v_forge: forge,
  v_pillar: pillar, v_board: noticeBoard, v_rift: riftGate,
  v_fountain: fountain, v_house_red: () => house('#8e2c21'), v_house_teal: () => house('#2f5a57'), v_house_gold: () => house('#8f6f37'),
  v_stall_fruit: () => stall('#c2412f', 'fruit'), v_stall_trinket: () => stall('#2f5a57', 'trinket'),
  v_gate: gate, v_banner_red: () => banner('#c2412f'), v_banner_teal: () => banner('#2f5a57'), v_duel_ring: duelRing,
});
