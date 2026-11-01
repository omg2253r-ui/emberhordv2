// Jointed fighters: the humanoid monsters and bosses are built from separate parts (legs, robe, torso, head,
// arms with hands, cape, wings, and the weapon held IN the hand) so they can wind up, swing, thrust and cast.
// Every part is painted with the same lighting: a warm key light from the upper left (gradient + highlight),
// shadow on the far side, a coloured rim light on the back edge, and the ink outline the whole game shares.
//
// Rig space (canonical, the fighter faces right, y grows down, feet at y = 0):
//   hips y −84 · waist y −80 · shoulders y −140 (front +20, back −20) · neck y −146 · arm length 64
// Each part spec: { w, h, ax, ay, svg }. ax/ay is the joint the part hangs from.
import { INK } from './palette.js';

export const RIG2 = Object.freeze({
  hipFront: { x: 11, y: -84 }, hipBack: { x: -11, y: -84 },
  waist: { x: 0, y: -80 }, neck: { x: 3, y: -146 },
  shoulderFront: { x: 21, y: -138 }, shoulderBack: { x: -19, y: -138 },
  capeAt: { x: -8, y: -144 }, armLen: 64, legLen: 84,
});

// ------------------------------------------------------------------ colour helpers
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (a) => '#' + a.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lite = (c, t = 0.35) => mix(c, '#fff4dc', t);
const dark = (c, t = 0.45) => mix(c, '#0c0710', t);

const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
// key-lit fill: light upper left → base → shadow lower right
const lit = (id, c, x2 = 0.9, y2 = 1) => `<linearGradient id="${id}" x1="0.1" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${lite(c, 0.32)}"/><stop offset="0.45" stop-color="${c}"/><stop offset="1" stop-color="${dark(c, 0.5)}"/></linearGradient>`;
const metalG = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="${dark(c, 0.3)}"/><stop offset="0.35" stop-color="${lite(c, 0.65)}"/><stop offset="0.55" stop-color="${c}"/><stop offset="1" stop-color="${dark(c, 0.55)}"/></linearGradient>`;
const glowG = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const spec = (w, h, ax, ay, defs, body) => ({ w, h, ax, ay, svg: svg(w, h, defs, body) });

// ------------------------------------------------------------------ legs (hip at the top)
function leg(c, kind, front) {
  const main = kind === 'plate' ? c.metal : c.cloth;
  const boot = kind === 'bone' ? c.bone : dark(c.metal, 0.25);
  return spec(40, 98, 20, 6, lit('lg', main) + metalG('bt', boot),
    `<path d="M9 4 C8 30 10 56 12 74 L28 74 C30 56 32 30 31 4 Z" fill="url(#lg)" ${O}/>
     ${kind === 'plate' ? `<path d="M10 34 Q20 40 30 34 L29 46 Q20 50 11 46 Z" fill="${lite(c.metal, 0.25)}" ${O2}/>` : `<path d="M24 8 C26 30 26 52 25 72" stroke="${dark(main, 0.4)}" stroke-width="3" fill="none" opacity="0.6"/>`}
     <path d="M7 72 L31 72 L33 84 C34 92 30 95 26 95 L4 95 C2 95 2 90 5 88 Z" fill="url(#bt)" ${O}/>
     <path d="M9 77 L29 77" stroke="${lite(boot, 0.5)}" stroke-width="2" opacity="0.7"/>
     ${front ? `<path d="M30 10 C31 30 30 52 28 72" stroke="${c.rim}" stroke-width="1.6" fill="none" opacity="0.65"/>` : ''}`);
}

// ------------------------------------------------------------------ torso (waist at the bottom centre)
function torso(c, kind) {
  const base = kind === 'plate' ? c.metal : c.main;
  const defs = lit('tb', base) + metalG('mt', c.metal) + glowG('gm', c.glow) + lit('cl', c.cloth);
  let body;
  if (kind === 'plate') {
    body = `<path d="M26 92 C24 72 18 50 12 32 C22 20 36 16 48 16 C60 16 74 20 84 32 C78 50 72 72 70 92 Z" fill="url(#tb)" ${O}/>
      <path d="M48 20 L48 70" stroke="${dark(base, 0.4)}" stroke-width="3"/><path d="M46 20 C40 34 38 50 40 66" stroke="${lite(base, 0.5)}" stroke-width="2.4" fill="none" opacity="0.8"/>
      ${[52, 62, 72].map((y, i) => `<path d="M${26 + i} ${y} Q48 ${y + 7} ${70 - i} ${y}" stroke="${INK}" stroke-width="2.4" fill="none"/><path d="M${27 + i} ${y + 2.5} Q48 ${y + 9} ${69 - i} ${y + 2.5}" stroke="${lite(base, 0.35)}" stroke-width="1.4" fill="none" opacity="0.7"/>`).join('')}
      <path d="M20 34 C30 42 38 44 48 44 C58 44 66 42 76 34" stroke="${c.trim}" stroke-width="4" fill="none"/>
      <circle cx="48" cy="40" r="13" fill="url(#gm)" opacity="0.8"/><path d="M48 32 L54 40 L48 48 L42 40 Z" fill="${c.glow}" ${O2}/>
      <rect x="24" y="82" width="48" height="10" rx="3" fill="${dark(c.cloth, 0.2)}" ${O2}/><rect x="42" y="81" width="12" height="12" rx="2" fill="url(#mt)" ${O2}/>
      <path d="M82 34 C76 52 72 72 70 90" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`;
  } else {
    // robe / vestment / cloak: cloth body with a layered collar
    const stole = kind === 'vest' ? `<path d="M36 18 L42 92 M60 18 L54 92" stroke="${c.trim}" stroke-width="7"/><path d="M36 18 L42 92 M60 18 L54 92" stroke="${lite(c.trim, 0.4)}" stroke-width="2" opacity="0.8"/>${[34, 54, 74].map((y) => `<path d="M${38 + y * 0.05} ${y} l3 4 l-3 4 l-3 -4 Z M${58 - y * 0.05} ${y} l3 4 l-3 4 l-3 -4 Z" fill="${c.glow}"/>`).join('')}` : '';
    body = `<path d="M24 92 C22 70 16 48 12 32 C22 20 36 16 48 16 C60 16 74 20 84 32 C80 48 74 70 72 92 Z" fill="url(#tb)" ${O}/>
      <path d="M30 20 L48 52 L66 20" fill="${dark(base, 0.35)}" ${O2}/><path d="M34 21 L48 46 L62 21" fill="${c.cloth}" opacity="0.9"/>
      <path d="M22 40 C30 60 30 78 28 90 M74 40 C66 60 66 78 68 90" stroke="${dark(base, 0.45)}" stroke-width="3" fill="none" opacity="0.7"/>
      ${stole}
      <path d="M24 78 Q48 86 72 78 L72 88 Q48 96 24 88 Z" fill="${c.trim}" ${O2}/><circle cx="48" cy="84" r="5" fill="${c.glow}" ${O2}/>
      <path d="M82 34 C77 52 73 72 72 90" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`;
  }
  return spec(96, 96, 48, 92, defs, body);
}

// ------------------------------------------------------------------ robe skirt (waist at the top)
function skirt(c) {
  return spec(116, 92, 58, 4, lit('sk', c.main, 1, 1),
    `<path d="M34 2 L82 2 C92 30 102 60 110 86 Q58 96 6 86 C14 60 24 30 34 2 Z" fill="url(#sk)" ${O}/>
     ${[30, 48, 66, 84].map((x, i) => `<path d="M${x + (i - 1.5) * 2} 10 C${x + (i - 1.5) * 8} 40 ${x + (i - 1.5) * 14} 64 ${x + (i - 1.5) * 18} 88" stroke="${dark(c.main, 0.45)}" stroke-width="2.4" fill="none" opacity="0.7"/>`).join('')}
     <path d="M8 84 Q58 94 108 84" stroke="${c.trim}" stroke-width="5" fill="none"/><path d="M10 80 Q58 90 106 80" stroke="${lite(c.trim, 0.4)}" stroke-width="1.6" fill="none" opacity="0.8"/>
     <path d="M84 6 C94 34 102 60 108 82" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.6"/>`);
}

// ------------------------------------------------------------------ cape (upper back at the top)
function cape(c) {
  const inner = c.capeIn || dark(c.trim, 0.3);
  return spec(120, 158, 60, 8, lit('cp', c.cape || c.main, 1, 1),
    `<path d="M42 4 C70 2 88 10 96 26 C104 70 112 110 116 150 Q86 140 60 152 Q32 140 4 150 C10 104 20 62 26 24 C30 12 36 6 42 4 Z" fill="${inner}" ${O}/>
     <path d="M44 6 C68 4 84 12 90 28 C96 70 102 108 106 142 Q84 134 62 144 Q40 134 18 142 C22 102 30 62 34 28 C36 16 40 8 44 6 Z" fill="url(#cp)"/>
     ${[40, 60, 80].map((x) => `<path d="M${x} 20 C${x - 4} 70 ${x - 2} 110 ${x} 140" stroke="${dark(c.cape || c.main, 0.45)}" stroke-width="2.4" fill="none" opacity="0.6"/>`).join('')}`);
}

// ------------------------------------------------------------------ arms (shoulder at the top; the hand is 64 below)
function arm(c, kind, front) {
  const sleeve = kind === 'plate' ? c.metal : kind === 'bone' ? c.bone : c.main;
  const hand = kind === 'bone' ? c.bone : kind === 'plate' ? dark(c.metal, 0.15) : c.skin;
  const pauldron = kind === 'plate' ? `<path d="M2 14 C2 0 34 0 34 14 C34 24 26 26 18 26 C10 26 2 24 2 14 Z" fill="url(#pa)" ${O}/><path d="M6 12 C10 4 24 4 30 10" stroke="${lite(c.metal, 0.6)}" stroke-width="2" fill="none"/><path d="M4 18 Q18 24 32 18" stroke="${c.trim}" stroke-width="2.4" fill="none"/>`
    : kind === 'bone' ? '' : `<path d="M4 12 C4 2 32 2 32 12 L30 22 Q18 26 6 22 Z" fill="${dark(sleeve, 0.15)}" ${O2}/>`;
  const fore = kind === 'bone'
    ? `<path d="M14 10 L14 56 M22 10 L22 56" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M14 10 L14 56 M22 10 L22 56" stroke="${c.bone}" stroke-width="3.5" stroke-linecap="round"/><circle cx="18" cy="34" r="5" fill="${c.bone}" ${O2}/>`
    : `<path d="M7 10 C6 26 8 42 10 58 L26 58 C28 42 30 26 29 10 Z" fill="url(#am)" ${O}/>
       <path d="M8 40 L28 40" stroke="${c.trim}" stroke-width="3"/>${front ? `<path d="M28 14 C29 30 28 44 26 56" stroke="${c.rim}" stroke-width="1.6" fill="none" opacity="0.7"/>` : ''}`;
  return spec(36, 80, 18, 8, lit('am', sleeve) + metalG('pa', c.metal),
    `${fore}
     <path d="M8 56 C6 64 8 72 14 74 L24 74 C30 72 31 64 28 56 Z" fill="${hand}" ${O}/><path d="M11 60 Q18 64 26 60" stroke="${dark(hand, 0.3)}" stroke-width="1.6" fill="none"/>
     ${pauldron}`);
}

// ------------------------------------------------------------------ heads (neck at the bottom centre)
function head(c, kind) {
  const defs = lit('hd', c.headMain || c.metal) + glowG('ge', c.glow) + metalG('hm', c.metal) + lit('sk', c.skin);
  const eyes = (y, dx = 9, col = c.glow, r = 3.4) => `<circle cx="${42 - dx}" cy="${y}" r="${r * 2.6}" fill="url(#ge)" opacity="0.8"/><circle cx="${42 + dx}" cy="${y}" r="${r * 2.6}" fill="url(#ge)" opacity="0.8"/><ellipse cx="${42 - dx}" cy="${y}" rx="${r}" ry="${r * 0.75}" fill="${col}"/><ellipse cx="${42 + dx}" cy="${y}" rx="${r}" ry="${r * 0.75}" fill="${col}"/><ellipse cx="${42 - dx}" cy="${y}" rx="${r * 0.4}" ry="${r * 0.4}" fill="#fff"/><ellipse cx="${42 + dx}" cy="${y}" rx="${r * 0.4}" ry="${r * 0.4}" fill="#fff"/>`;
  const horns = c.horns ? `<path d="M22 30 C10 22 6 6 14 -2 C14 10 20 18 28 22 Z" fill="${c.hornCol || '#d8ccb6'}" ${O2}/><path d="M60 28 C74 20 80 4 72 -4 C72 8 66 16 56 20 Z" fill="${c.hornCol || '#d8ccb6'}" ${O2}/>` : '';
  const crown = c.crown ? `<path d="M22 22 L24 6 L32 16 L40 2 L48 16 L56 6 L60 22 Z" fill="url(#hm)" ${O2}/><circle cx="40" cy="12" r="3.2" fill="${c.glow}" ${O2}/>` : '';
  let body;
  switch (kind) {
    case 'helm': body = `${horns}<path d="M14 50 C12 24 26 10 42 10 C58 10 72 24 70 50 L66 74 Q42 82 18 74 Z" fill="url(#hd)" ${O}/>
      <path d="M42 12 L42 74" stroke="${dark(c.metal, 0.4)}" stroke-width="3"/><path d="M28 18 C22 28 20 40 21 54" stroke="${lite(c.metal, 0.6)}" stroke-width="2.6" fill="none"/>
      <path d="M18 42 L66 42 L64 52 L20 52 Z" fill="#0b0810" ${O2}/>${eyes(47, 10, c.glow, 3)}
      ${[60, 66, 72].map((y) => `<path d="M30 ${y} L54 ${y}" stroke="${INK}" stroke-width="2"/>`).join('')}${crown}
      <path d="M68 30 C70 44 68 60 64 72" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    case 'hood': body = `<path d="M10 78 C8 46 18 16 44 4 C64 18 76 44 74 78 Q42 86 10 78 Z" fill="url(#hd)" ${O}/>
      <path d="M22 72 C20 50 28 32 42 26 C56 32 64 50 62 72 Z" fill="#07050b" ${O2}/>${eyes(50, 9)}
      <path d="M44 6 C60 20 70 44 70 74" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.6"/><path d="M16 60 C14 40 22 22 38 10" stroke="${lite(c.headMain || c.main, 0.4)}" stroke-width="2.4" fill="none" opacity="0.7"/>`; break;
    case 'skull': body = `${horns}<path d="M16 46 C14 22 28 10 42 10 C58 10 70 22 68 46 C68 56 62 60 60 66 L56 78 L28 78 L24 66 C20 60 16 56 16 46 Z" fill="url(#hd)" ${O}/>
      <ellipse cx="31" cy="44" rx="8" ry="9" fill="#0b0810" ${O2}/><ellipse cx="53" cy="44" rx="8" ry="9" fill="#0b0810" ${O2}/>${eyes(45, 11, c.glow, 2.6)}
      <path d="M40 54 L44 54 L42 60 Z" fill="#0b0810"/>${[32, 38, 44, 50].map((x) => `<path d="M${x} 66 L${x} 76" stroke="${INK}" stroke-width="1.8"/>`).join('')}
      <path d="M26 20 C22 28 20 36 21 46" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.6"/>`; break;
    case 'seraph': body = `<path d="M18 50 C16 26 28 14 42 14 C58 14 68 26 66 50 C66 64 56 74 42 76 C28 74 18 64 18 50 Z" fill="url(#sk)" ${O}/>
      <path d="M14 44 C14 18 30 4 44 6 C62 8 72 24 70 46 C64 34 56 28 44 28 C30 28 22 34 14 44 Z" fill="${c.hair || '#f6e7b8'}" ${O2}/>
      <path d="M28 50 Q33 47 38 50 M46 50 Q51 47 56 50" stroke="${INK}" stroke-width="2.2" fill="none"/><path d="M38 64 Q42 66 46 64" stroke="${INK}" stroke-width="1.8" fill="none"/>
      <path d="M40 30 L44 30 L42 40 Z" fill="${c.glow}"/><path d="M64 40 C66 52 62 64 54 72" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    case 'mask': body = `<path d="M10 78 C8 44 20 14 42 8 C64 14 76 44 74 78 Q42 86 10 78 Z" fill="url(#hd)" ${O}/>
      <path d="M22 40 C22 24 32 16 42 16 C54 16 62 24 62 40 C62 58 54 70 42 72 C30 70 22 58 22 40 Z" fill="#f5efe6" ${O}/>
      <path d="M26 40 Q32 34 38 40 Q32 44 26 40 Z M46 40 Q52 34 58 40 Q52 44 46 40 Z" fill="#0b0810"/>${eyes(40, 10, c.glow, 1.8)}
      <path d="M32 58 Q42 66 52 58" stroke="${INK}" stroke-width="2.4" fill="none"/><path d="M42 18 L42 30" stroke="${c.glow}" stroke-width="2.4"/><path d="M24 50 Q20 58 24 64 M60 50 Q64 58 60 64" stroke="${c.glow}" stroke-width="2" fill="none"/>`; break;
    case 'demon': body = `${horns}<path d="M18 50 C16 26 28 14 42 14 C58 14 68 26 66 50 C66 64 56 76 42 78 C28 76 18 64 18 50 Z" fill="url(#sk)" ${O}/>
      <path d="M24 42 L36 46 M60 42 L48 46" stroke="${INK}" stroke-width="3"/>${eyes(48, 9, c.glow, 3.2)}
      <path d="M32 64 L36 60 L40 64 L44 60 L48 64 L52 60" stroke="${INK}" stroke-width="2" fill="none"/>${crown}
      <path d="M64 42 C66 56 60 68 52 74" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    case 'blind': body = `<path d="M18 48 C16 24 28 12 42 12 C58 12 68 24 66 48 C66 64 56 76 42 78 C28 76 18 64 18 48 Z" fill="url(#sk)" ${O}/>
      <path d="M16 40 L68 40 L67 52 L17 52 Z" fill="#14101c" ${O2}/><path d="M18 44 L66 44" stroke="${c.trim}" stroke-width="2"/>
      <path d="M34 66 L50 66" stroke="${INK}" stroke-width="2.6"/><path d="M26 22 C22 28 20 34 21 40" stroke="#ffffff" stroke-width="2.2" fill="none" opacity="0.5"/>
      <path d="M64 50 C64 62 58 72 50 76" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    case 'stitch': body = `<path d="M18 50 C14 22 28 8 42 8 C58 8 70 22 66 50 C64 66 54 78 42 78 C30 78 20 66 18 50 Z" fill="url(#sk)" ${O}/>
      <ellipse cx="32" cy="44" rx="6" ry="7" fill="#0b0810"/><ellipse cx="52" cy="44" rx="6" ry="7" fill="#0b0810"/>${eyes(45, 10, c.glow, 1.6)}
      <path d="M28 62 L56 62" stroke="${INK}" stroke-width="2.4"/>${[31, 36, 41, 46, 51].map((x) => `<path d="M${x} 57 L${x + 2} 67" stroke="${INK}" stroke-width="1.8"/>`).join('')}
      <path d="M28 16 C22 26 20 36 22 46" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.4"/>`; break;
    case 'jackal': body = `<path d="M22 32 L14 -6 L36 20 Z" fill="url(#hd)" ${O}/><path d="M62 32 L70 -6 L48 20 Z" fill="url(#hd)" ${O}/>
      <path d="M19 46 C17 24 30 12 42 12 C54 12 67 24 65 46 C65 60 58 70 52 78 L32 78 C26 70 19 60 19 46 Z" fill="url(#hd)" ${O}/>
      <path d="M30 50 L54 50 L50 76 L34 76 Z" fill="url(#sk)" ${O2}/><path d="M38 54 L46 54 L42 61 Z" fill="#0b0810"/>${eyes(40, 10, c.glow, 3)}
      <path d="M6 36 L19 40 L19 78 L8 78 Z M78 36 L65 40 L65 78 L76 78 Z" fill="${c.trim}" ${O2}/><path d="M12 48 L19 50 M12 58 L19 60 M72 48 L65 50 M72 58 L65 60" stroke="${INK}" stroke-width="2"/>
      <path d="M62 30 C64 44 62 58 56 70" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    case 'lioness': body = `<circle cx="22" cy="24" r="9" fill="url(#hd)" ${O}/><circle cx="62" cy="24" r="9" fill="url(#hd)" ${O}/>
      <path d="M8 78 C6 40 18 14 42 8 C66 14 78 40 76 78 Q42 86 8 78 Z" fill="${c.trim}" ${O}/>${[30, 40, 50, 60, 70].map((y) => `<path d="M10 ${y} L24 ${y + 2} M74 ${y} L60 ${y + 2}" stroke="${INK}" stroke-width="2"/>`).join('')}
      <path d="M22 44 C22 26 32 16 42 16 C52 16 62 26 62 44 C62 60 54 72 42 74 C30 72 22 60 22 44 Z" fill="url(#sk)" ${O}/>
      <path d="M26 38 L38 42 M58 38 L46 42" stroke="${INK}" stroke-width="3"/>${eyes(44, 9, c.glow, 3)}<path d="M38 56 L46 56 L42 62 Z" fill="#0b0810"/><path d="M42 62 L42 66 M34 68 Q42 72 50 68" stroke="${INK}" stroke-width="2" fill="none"/>
      <path d="M42 16 C40 8 44 2 42 -2" stroke="${c.glow}" stroke-width="3" fill="none"/><path d="M66 30 C68 46 64 62 56 72" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    case 'sundisk': body = `<circle cx="42" cy="6" r="20" fill="url(#ge)" opacity="0.9"/><circle cx="42" cy="6" r="14" fill="${c.glow}" ${O}/><circle cx="42" cy="6" r="8" fill="#ffffff" opacity="0.6"/>
      <path d="M8 78 C6 44 18 20 42 14 C66 20 78 44 76 78 Q42 86 8 78 Z" fill="${c.trim}" ${O}/>${[34, 44, 54, 64].map((y) => `<path d="M10 ${y} L24 ${y + 2} M74 ${y} L60 ${y + 2}" stroke="${INK}" stroke-width="2"/>`).join('')}
      <path d="M22 48 C22 30 32 22 42 22 C52 22 62 30 62 48 C62 62 54 72 42 74 C30 72 22 62 22 48 Z" fill="url(#sk)" ${O}/>
      <path d="M40 46 C28 50 28 64 38 70 L44 58 Z" fill="#e0a030" ${O}/>${eyes(44, 11, c.glow, 3.2)}<path d="M26 40 L38 44 M58 40 L46 44" stroke="${INK}" stroke-width="2.6"/>
      <path d="M66 36 C68 50 64 62 56 72" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.7"/>`; break;
    default: body = `<path d="M10 78 C8 46 20 18 42 8 C62 18 76 46 74 78 Q42 86 10 78 Z" fill="url(#hd)" ${O}/>
      <path d="M24 74 C24 52 30 40 42 36 C54 40 60 52 60 74 Z" fill="url(#sk)" ${O2}/><path d="M22 48 C30 42 54 42 62 48 L60 56 C52 52 32 52 24 56 Z" fill="#0b0810" opacity="0.85"/>${eyes(52, 8, c.glow, 2.6)}
      <path d="M44 10 C60 22 70 46 70 74" stroke="${c.rim}" stroke-width="2" fill="none" opacity="0.6"/>`;
  }
  return spec(84, 86, 42, 82, defs, body);
}

// ------------------------------------------------------------------ wings (between the shoulder blades)
function wings(c, kind) {
  const col = kind === 'bone' ? c.bone : c.wing || '#f6f0e2';
  const one = `<path d="M110 76 C128 42 168 12 214 6 C204 22 200 34 206 44 C192 46 184 52 188 62 C174 62 166 68 170 78 C156 78 146 82 148 92 C134 90 120 86 110 84 Z" fill="url(#wg)" ${O}/>
    <path d="M116 74 C140 50 170 30 204 16 M120 80 C146 64 170 54 196 48 M124 84 C146 76 162 72 180 70" stroke="${dark(col, 0.25)}" stroke-width="2" fill="none" opacity="0.8"/>
    <path d="M118 70 C138 44 168 22 200 12" stroke="#ffffff" stroke-width="1.6" fill="none" opacity="0.7"/>`;
  return spec(220, 150, 110, 76, lit('wg', col, 1, 1),
    `<g opacity="0.92">${one}</g><g transform="translate(220,0) scale(-1,1)" opacity="0.8">${one}</g>
     <circle cx="110" cy="78" r="10" fill="${c.glow}" opacity="0.45"/>`);
}

// ------------------------------------------------------------------ weapons (grip at the anchor, the tip points up)
// meta.tip: distance from the grip to the tip (for trails), meta.kind: how the fighter holds and swings it
function weapon(c, kind) {
  const m = c.wMetal || c.metal, g = c.glow;
  const defs = metalG('wm', m) + glowG('wg', g) + lit('wd', c.wood || '#6a4a32');
  const grip = (x, y1, y2) => `<rect x="${x - 4}" y="${y1}" width="8" height="${y2 - y1}" rx="3" fill="${c.grip || '#3a2420'}" ${O2}/>${Array.from({ length: Math.floor((y2 - y1) / 6) }, (_, i) => `<path d="M${x - 4} ${y1 + 3 + i * 6} L${x + 4} ${y1 + 6 + i * 6}" stroke="${lite(c.grip || '#3a2420', 0.3)}" stroke-width="1.4"/>`).join('')}`;
  const w = (W, H, ax, ay, tip, hold, body) => ({ ...spec(W, H, ax, ay, defs, body), meta: { tip, hold } });
  switch (kind) {
    case 'greatsword': return w(44, 200, 22, 158, 154, 'heavy',
      `${grip(22, 146, 176)}<circle cx="22" cy="182" r="8" fill="url(#wm)" ${O2}/><circle cx="22" cy="182" r="3" fill="${g}"/>
       <path d="M2 136 Q22 146 42 136 L40 146 Q22 150 4 146 Z" fill="url(#wm)" ${O2}/><circle cx="22" cy="142" r="4" fill="${g}" ${O2}/>
       <path d="M12 136 L13 18 L22 4 L31 18 L32 136 Z" fill="url(#wm)" ${O}/><path d="M22 10 L22 132" stroke="${dark(m, 0.45)}" stroke-width="2.6"/>
       <path d="M15 128 L16 20 L22 9" stroke="${lite(m, 0.8)}" stroke-width="1.6" fill="none"/><path d="M30 128 L29 20 L22 9" stroke="${g}" stroke-width="1.4" fill="none" opacity="0.85"/>
       ${[40, 70, 100].map((y) => `<path d="M19 ${y} l3 -5 l3 5 l-3 5 Z" fill="${g}" opacity="0.8"/>`).join('')}`);
    case 'longsword': return w(34, 148, 17, 116, 112, 'blade',
      `${grip(17, 106, 128)}<circle cx="17" cy="133" r="6" fill="url(#wm)" ${O2}/>
       <path d="M1 100 Q17 108 33 100 L31 108 Q17 112 3 108 Z" fill="url(#wm)" ${O2}/>
       <path d="M10 100 L11 16 L17 4 L23 16 L24 100 Z" fill="url(#wm)" ${O}/><path d="M17 10 L17 96" stroke="${dark(m, 0.4)}" stroke-width="2"/>
       <path d="M12 94 L13 18 L17 9" stroke="${lite(m, 0.8)}" stroke-width="1.4" fill="none"/><path d="M22 94 L21 18 L17 9" stroke="${g}" stroke-width="1.2" fill="none" opacity="0.8"/>`);
    case 'spear': return w(34, 236, 17, 160, 156, 'thrust',
      `<rect x="13" y="40" width="8" height="190" rx="3" fill="url(#wd)" ${O2}/>${[70, 110, 150, 190].map((y) => `<path d="M13 ${y} L21 ${y + 4}" stroke="${c.trim}" stroke-width="2"/>`).join('')}
       <path d="M10 44 L24 44 L22 52 L12 52 Z" fill="url(#wm)" ${O2}/>
       <path d="M17 2 C28 16 28 32 20 44 L14 44 C6 32 6 16 17 2 Z" fill="url(#wm)" ${O}/><path d="M17 8 L17 40" stroke="${dark(m, 0.4)}" stroke-width="1.8"/><path d="M20 12 C24 22 23 32 19 40" stroke="${g}" stroke-width="1.4" fill="none"/>
       <path d="M8 52 Q4 60 10 66 M26 52 Q30 60 24 66" stroke="${c.trim}" stroke-width="2.6" fill="none"/>`);
    case 'staff': return w(52, 214, 26, 140, 132, 'cast',
      `<path d="M23 40 C21 90 22 150 24 210 L30 210 C31 150 30 90 29 40 Z" fill="url(#wd)" ${O2}/>${[90, 140].map((y) => `<rect x="20" y="${y}" width="12" height="7" rx="2" fill="url(#wm)" ${O2}/>`).join('')}
       <path d="M26 44 C10 40 6 20 14 8 C16 20 20 26 26 28 C32 26 36 20 38 8 C46 20 42 40 26 44 Z" fill="url(#wm)" ${O}/>
       <circle cx="26" cy="22" r="20" fill="url(#wg)" opacity="0.85"/><circle cx="26" cy="22" r="9" fill="${g}" ${O2}/><circle cx="23" cy="19" r="3" fill="#ffffff"/>`);
    case 'sceptre': return w(56, 180, 28, 130, 120, 'cast',
      `<path d="M25 46 L24 172 L32 172 L31 46 Z" fill="url(#wm)" ${O2}/>${[70, 110, 150].map((y) => `<path d="M24 ${y} L32 ${y}" stroke="${c.trim}" stroke-width="3"/>`).join('')}
       <circle cx="28" cy="26" r="24" fill="url(#wg)" opacity="0.9"/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="M28 26 L${(28 + Math.cos(a) * 22).toFixed(1)} ${(26 + Math.sin(a) * 22).toFixed(1)}" stroke="${g}" stroke-width="2.4"/>`; }).join('')}
       <circle cx="28" cy="26" r="11" fill="url(#wm)" ${O}/><circle cx="28" cy="26" r="5" fill="${g}"/><path d="M18 44 Q28 52 38 44" stroke="${INK}" stroke-width="2.4" fill="url(#wm)"/>`);
    case 'scales': return w(80, 190, 40, 140, 120, 'cast',
      `<path d="M37 30 L36 182 L44 182 L43 30 Z" fill="url(#wm)" ${O2}/><path d="M6 32 Q40 22 74 32" stroke="${INK}" stroke-width="5" fill="none"/><path d="M6 32 Q40 22 74 32" stroke="${m}" stroke-width="3" fill="none"/>
       <path d="M8 32 L2 64 M8 32 L16 64 M72 32 L64 64 M72 32 L78 64" stroke="${lite(m, 0.4)}" stroke-width="1.4"/>
       <path d="M0 64 Q9 74 18 64 Z M62 64 Q71 74 80 64 Z" fill="url(#wm)" ${O2}/><circle cx="40" cy="20" r="14" fill="url(#wg)"/><path d="M40 10 L46 20 L40 30 L34 20 Z" fill="${g}" ${O2}/>`);
    case 'oar': return w(48, 240, 24, 150, 150, 'heavy',
      `<rect x="20" y="50" width="8" height="186" rx="3" fill="url(#wd)" ${O2}/><path d="M12 232 L36 232" stroke="${INK}" stroke-width="4"/>
       <path d="M24 4 C40 12 42 40 34 58 L14 58 C6 40 8 12 24 4 Z" fill="url(#wd)" ${O}/><path d="M24 10 L24 54" stroke="${dark(c.wood || '#6a4a32', 0.4)}" stroke-width="2"/>
       <path d="M17 18 C14 28 14 40 17 50" stroke="${g}" stroke-width="2" fill="none" opacity="0.8"/>${[20, 34].map((y) => `<circle cx="30" cy="${y}" r="2.4" fill="${g}"/>`).join('')}`);
    case 'fan': return w(96, 84, 48, 76, 66, 'blade',
      `${Array.from({ length: 9 }, (_, i) => { const a = -Math.PI * 0.9 + (i / 8) * Math.PI * 0.8; const x = 48 + Math.cos(a) * 66, y = 76 + Math.sin(a) * 66; return `<path d="M48 76 L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${INK}" stroke-width="4"/>`; }).join('')}
       <path d="M48 76 L${(48 + Math.cos(-Math.PI * 0.9) * 62).toFixed(1)} ${(76 + Math.sin(-Math.PI * 0.9) * 62).toFixed(1)} A62 62 0 0 1 ${(48 + Math.cos(-Math.PI * 0.1) * 62).toFixed(1)} ${(76 + Math.sin(-Math.PI * 0.1) * 62).toFixed(1)} Z" fill="${c.fan || '#2a1030'}" ${O}/>
       <path d="M${(48 + Math.cos(-Math.PI * 0.85) * 52).toFixed(1)} ${(76 + Math.sin(-Math.PI * 0.85) * 52).toFixed(1)} A52 52 0 0 1 ${(48 + Math.cos(-Math.PI * 0.15) * 52).toFixed(1)} ${(76 + Math.sin(-Math.PI * 0.15) * 52).toFixed(1)}" stroke="${g}" stroke-width="3" fill="none"/>
       ${Array.from({ length: 9 }, (_, i) => { const a = -Math.PI * 0.9 + (i / 8) * Math.PI * 0.8; return `<path d="M${(48 + Math.cos(a) * 60).toFixed(1)} ${(76 + Math.sin(a) * 60).toFixed(1)} L${(48 + Math.cos(a) * 70).toFixed(1)} ${(76 + Math.sin(a) * 70).toFixed(1)}" stroke="${lite(m, 0.6)}" stroke-width="3" stroke-linecap="round"/>`; }).join('')}
       <circle cx="48" cy="76" r="6" fill="url(#wm)" ${O2}/>`);
    case 'bow': return w(40, 160, 12, 80, 70, 'bow',
      `<path d="M12 8 C40 30 44 130 12 152" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M12 8 C40 30 44 130 12 152" stroke="${m}" stroke-width="5" fill="none" stroke-linecap="round"/>
       <path d="M14 14 C34 34 38 70 36 80" stroke="${lite(m, 0.7)}" stroke-width="1.6" fill="none"/>${grip(14, 70, 90)}
       <circle cx="12" cy="8" r="4" fill="${g}" ${O2}/><circle cx="12" cy="152" r="4" fill="${g}" ${O2}/>`);
    case 'icestaff': return w(60, 220, 30, 150, 140, 'cast',
      `<path d="M27 50 C25 100 26 160 28 216 L34 216 C35 160 34 100 33 50 Z" fill="url(#wd)" ${O2}/>${[100, 150].map((y) => `<rect x="24" y="${y}" width="12" height="7" rx="2" fill="url(#wm)" ${O2}/>`).join('')}
       <circle cx="30" cy="28" r="26" fill="url(#wg)" opacity="0.8"/>
       <path d="M30 2 L40 26 L30 52 L20 26 Z" fill="${lite(g, 0.4)}" ${O}/><path d="M30 2 L30 52 M20 26 L40 26" stroke="#ffffff" stroke-width="1.6" opacity="0.8"/>
       <path d="M18 20 L10 8 L16 32 Z M42 20 L50 8 L44 32 Z" fill="${g}" ${O2}/><path d="M22 48 L18 60 L28 52 Z M38 48 L42 60 L32 52 Z" fill="${g}" ${O2}/>`);
    case 'none': return w(12, 12, 6, 6, 8, 'cast', '');
    default: return w(20, 20, 10, 10, 0, 'blade', '');
  }
}
// a glowing orb of the god's element, held in the back hand
function orb(c) {
  return spec(56, 56, 28, 10, glowG('og', c.glow) + `<radialGradient id="oc" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="${lite(c.glow, 0.3)}"/><stop offset="1" stop-color="${dark(c.glow, 0.35)}"/></radialGradient>`,
    `<circle cx="28" cy="30" r="26" fill="url(#og)" opacity="0.85"/><circle cx="28" cy="30" r="13" fill="url(#oc)" ${O2}/>
     <path d="M20 26 Q28 18 36 26 M22 36 Q28 42 34 36" stroke="#ffffff" stroke-width="1.4" fill="none" opacity="0.8"/>`);
}
// the ferryman's lantern (held in the back hand)
function lantern(c) {
  return spec(40, 70, 20, 4, glowG('lg', c.glow) + metalG('lm', c.metal),
    `<path d="M20 4 L20 18" stroke="${INK}" stroke-width="2.4"/><circle cx="20" cy="44" r="26" fill="url(#lg)" opacity="0.8"/>
     <path d="M10 22 L30 22 L32 30 L32 58 L8 58 L8 30 Z" fill="${c.glow}" opacity="0.55" ${O2}/><path d="M8 30 L32 30 M8 50 L32 50 M14 22 L14 58 M26 22 L26 58" stroke="url(#lm)" stroke-width="3"/>
     <path d="M8 58 L32 58 L28 64 L12 64 Z" fill="url(#lm)" ${O2}/><circle cx="20" cy="42" r="5" fill="#ffffff"/>`);
}
// the river god's boat (drawn under him)
function boat(c) {
  return spec(260, 60, 130, 22, lit('bt', c.wood || '#5a3a26', 1, 1),
    `<path d="M4 18 Q130 34 256 18 L238 46 Q130 62 22 46 Z" fill="url(#bt)" ${O}/><path d="M18 30 Q130 44 242 30" stroke="${dark(c.wood || '#5a3a26', 0.4)}" stroke-width="3" fill="none"/>
     <path d="M10 20 Q130 36 250 20" stroke="${lite(c.wood || '#5a3a26', 0.4)}" stroke-width="2" fill="none"/><path d="M4 18 C0 8 6 2 12 4" stroke="${INK}" stroke-width="3" fill="none"/>`);
}

// ------------------------------------------------------------------ build one fighter
// r: { body: plate|robe|vest|cloak|bone, head, weapon, skirt, cape, wings, lantern, boat, c: colours }
export function rigParts(r) {
  const c = { rim: '#ffe6a8', trim: '#c8a050', metal: '#8a8a98', glow: '#ffd27a', skin: '#e8c8a8', cloth: '#3a2a2a', bone: '#e8dcc0', ...r.c };
  const limb = r.body === 'plate' ? 'plate' : r.body === 'bone' ? 'bone' : 'cloth';
  const parts = {
    legBack: leg(c, limb, false), legFront: leg(c, limb, true),
    torso: torso(c, r.body === 'bone' ? 'plate' : r.body),
    head: head(c, r.head),
    armBack: arm(c, limb, false), armFront: arm(c, limb, true),
    weapon: weapon(c, r.weapon),
  };
  if (r.skirt) parts.skirt = skirt(c);
  if (r.cape) parts.cape = cape(c);
  if (r.wings) parts.wings = wings(c, r.wings);
  if (r.lantern) parts.lantern = lantern(c);
  if (r.orb) parts.lantern = orb(c);
  if (r.boat) parts.boat = boat(c);
  return parts;
}

// ------------------------------------------------------------------ the cast
// scale: how tall the fighter stands (1 ≈ 215 px). hold: how the weapon is used (from the weapon).
export const RIGS = Object.freeze({
  // the tower gods
  t_god_river: { scale: 1.08, body: 'robe', head: 'hood', weapon: 'icestaff', skirt: true, cape: true, orb: true, c: { main: '#2f6f86', headMain: '#245a6c', cape: '#1e4a5e', capeIn: '#0c2230', cloth: '#14303e', trim: '#7fe8ff', glow: '#9ff0ff', rim: '#bff6ff', metal: '#9ab8c4', wood: '#3a5060' } },
  t_god_silence: { scale: 1.1, body: 'robe', head: 'stitch', weapon: 'staff', skirt: true, cape: true, c: { main: '#2a2840', cape: '#1a1828', cloth: '#14121c', trim: '#7a6aa8', glow: '#c8c8ff', rim: '#d8d8ff', skin: '#9a9ab8', metal: '#6a6a88', wood: '#2a2436' } },
  t_god_judge: { scale: 1.12, body: 'vest', head: 'blind', weapon: 'scales', skirt: true, cape: true, halo: true, c: { main: '#1e2238', cape: '#2a1a14', cloth: '#14121c', trim: '#e0b45a', glow: '#ffe08a', rim: '#ffefc4', skin: '#e8d0b0', metal: '#e0b45a' } },
  t_god_masks: { scale: 1.08, body: 'robe', head: 'mask', weapon: 'none', skirt: true, cape: true, c: { main: '#4a1a4a', headMain: '#2a0e2a', cape: '#3a1040', capeIn: '#14061a', cloth: '#1a0a1a', trim: '#b86aff', glow: '#c88aff', rim: '#e0b8ff', metal: '#c8a8c8', skin: '#e8e0f0' } },
  t_god_king: { scale: 1.18, body: 'plate', head: 'demon', weapon: 'greatsword', cape: true, c: { main: '#2a1416', metal: '#3a2a30', cape: '#8a1a1a', capeIn: '#3a0a0a', cloth: '#1a0a0c', trim: '#e0b45a', glow: '#ff3a3a', rim: '#ff9a7a', skin: '#3a2026', horns: true, hornCol: '#e8dcc0', crown: true, wMetal: '#b8a8b0' } },
  // raid and land bosses
  z_umbral_knight: { scale: 1.06, body: 'plate', head: 'helm', weapon: 'greatsword', cape: true, c: { metal: '#3a3450', cape: '#4a2a7a', capeIn: '#1a1030', cloth: '#1a1424', trim: '#9a7ad8', glow: '#b88aff', rim: '#d8c0ff', horns: true, hornCol: '#7a5ab8', wMetal: '#8a80b0' } },
  z_seraph_warden: { scale: 1.06, body: 'plate', head: 'seraph', weapon: 'longsword', wings: 'feather', halo: true, c: { main: '#e8dcc0', cloth: '#c8b48a', trim: '#e0b45a', glow: '#ffe8a0', rim: '#fff6d0', skin: '#f6e2c8', metal: '#efe4c8', wMetal: '#f0c860', wing: '#fbf6ea', hair: '#f6e7b8' } },
  z_ash_sovereign: { scale: 1.08, body: 'robe', head: 'demon', weapon: 'staff', cape: true, skirt: true, c: { main: '#5a1a14', metal: '#4a3028', cape: '#a02818', capeIn: '#3a0e08', cloth: '#2a1410', trim: '#e0b45a', glow: '#ff3a2a', rim: '#ffb090', skin: '#5a2a24', crown: true, wMetal: '#d8a070', wood: '#3a2018' } },
  r_judgment_god: { scale: 1.15, body: 'vest', head: 'seraph', weapon: 'sceptre', skirt: true, wings: 'feather', halo: true, c: { main: '#f6efe0', cloth: '#e0d0b0', trim: '#e0b45a', glow: '#fff0a8', rim: '#ffffff', skin: '#f2dcc0', metal: '#e0b45a', wing: '#fffaf0', hair: '#fff3c4' } },
  r_anubis: { scale: 1.2, body: 'vest', head: 'jackal', weapon: 'scales', skirt: true, c: { main: '#2a3048', headMain: '#1a2030', cloth: '#1a2438', trim: '#e0b45a', glow: '#7fe8ff', rim: '#e8f6ff', skin: '#3a4260', metal: '#e0b45a' } },
  r_sekhmet: { scale: 1.2, body: 'vest', head: 'lioness', weapon: 'longsword', skirt: true, c: { main: '#b8502a', cloth: '#7a2a14', trim: '#e0b45a', glow: '#ffcf5a', rim: '#ffe0a0', skin: '#d8a060', metal: '#e0b45a' } },
  r_ra_god: { scale: 1.25, body: 'vest', head: 'sundisk', weapon: 'sceptre', skirt: true, wings: 'feather', halo: true, c: { main: '#f0d27a', cloth: '#e0b45a', trim: '#fff3c4', glow: '#ffcf5a', rim: '#ffffff', skin: '#d8a060', metal: '#e0b45a', wing: '#ffe9a8' } },
  // v8 lands and the Boss Rush
  z_mirror_queen: { scale: 1.04, body: 'robe', head: 'mask', weapon: 'longsword', skirt: true, cape: true, c: { main: '#7a98c0', headMain: '#dceaf8', cape: '#4a3a7a', capeIn: '#1a1430', cloth: '#2a3450', trim: '#bfe8ff', glow: '#7fe8ff', rim: '#ffffff', metal: '#c8e0f4', skin: '#eaf4ff', wMetal: '#e8f4ff', crown: true } },
  z_mirror_image: { scale: 0.62, body: 'robe', head: 'mask', weapon: 'longsword', skirt: true, c: { main: '#a8c8e8', headMain: '#f2f8ff', cloth: '#5a7898', trim: '#e8f4ff', glow: '#bfe8ff', rim: '#ffffff', metal: '#e8f4ff', skin: '#f4faff', wMetal: '#ffffff' } },
  z_eclipse_king: { scale: 1.1, body: 'plate', head: 'demon', weapon: 'greatsword', cape: true, c: { metal: '#2a2238', cape: '#5a2a14', capeIn: '#1a0a06', cloth: '#14101c', trim: '#ffb648', glow: '#ffd27a', rim: '#ffe0a0', skin: '#3a2a3a', horns: true, hornCol: '#ffd27a', crown: true, wMetal: '#ffd27a' } },
  z_rush_shadow: { scale: 1.12, body: 'plate', head: 'helm', weapon: 'greatsword', cape: true, c: { metal: '#1a1424', cape: '#2a1a3a', capeIn: '#05030a', cloth: '#0e0a14', trim: '#ffb648', glow: '#ffb648', rim: '#b88aff', horns: true, hornCol: '#ffb648', wMetal: '#1a1424' } },
  z_corona_priest: { scale: 0.56, body: 'robe', head: 'cowl', weapon: 'sceptre', skirt: true, c: { main: '#7a3a1a', headMain: '#5a2a10', cloth: '#3a1a08', trim: '#ffd27a', glow: '#fff3c4', rim: '#ffe0a0', skin: '#d8a070', metal: '#e0b45a' } },
  // humanoid soldiers of the lands
  z_ice_archer: { scale: 0.56, body: 'cloak', head: 'hood', weapon: 'bow', c: { main: '#3a5a7a', headMain: '#2a4a6a', cloth: '#1a2a3a', trim: '#bfe3ff', glow: '#bfe3ff', rim: '#e8f6ff', metal: '#9ad0f0' } },
  z_shade_stalker: { scale: 0.56, body: 'cloak', head: 'hood', weapon: 'longsword', c: { main: '#2a2440', headMain: '#1a1630', cloth: '#14101c', trim: '#7a6aa8', glow: '#b8a0ff', rim: '#c8b8ff', metal: '#7a7090' } },
  z_bone_lancer: { scale: 0.56, body: 'bone', head: 'skull', weapon: 'spear', c: { main: '#8a7a68', metal: '#a89880', cloth: '#5a4a3a', trim: '#c2412f', glow: '#ff6a4a', rim: '#ffe0c0', bone: '#e8dcc0', headMain: '#efe4cc', wood: '#6a5a48' } },
  z_feather_monk: { scale: 0.56, body: 'robe', head: 'skull', weapon: 'staff', skirt: true, c: { main: '#c8b490', headMain: '#f2ead8', cloth: '#8a7458', trim: '#6fb4ff', glow: '#bfe3ff', rim: '#ffffff', metal: '#a8b8c8' } },
  z_ash_revenant: { scale: 0.56, body: 'plate', head: 'helm', weapon: 'longsword', c: { metal: '#3a2a26', cloth: '#1a100c', trim: '#c2412f', glow: '#ff7a33', rim: '#ffb080', wMetal: '#9a8a80' } },
  z_cinder_mage: { scale: 0.56, body: 'robe', head: 'cowl', weapon: 'staff', skirt: true, c: { main: '#4a1e14', headMain: '#3a160e', cloth: '#2a0e08', trim: '#ff8a3d', glow: '#ffb648', rim: '#ffd08a', skin: '#c89070', metal: '#a07050' } },
});
export const rigOf = (id) => (Object.prototype.hasOwnProperty.call(RIGS, id) ? RIGS[id] : null);
