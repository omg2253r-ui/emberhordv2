// Wings (ปีก): one wing per sprite, drawn twice behind the hero (the far one darker and smaller) and flapped by
// rotating around the root. Root (anchor) sits at the bottom-right of the sprite, at the hero's upper back; the
// wing sweeps up and back (to the left, since every rig part faces right).
import { INK } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
const W = 96, H = 92, AX = 88, AY = 84;
const grad = (id, a, b) => `<linearGradient id="${id}" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// a fan of feathers from the root; long = primary feathers at the tip
function feathers(main, trim, n = 7, tipCol = trim) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (-0.35 - (i / (n - 1)) * 1.25);       // from up-left to left
    const len = 52 + i * 4.5;
    const ex = AX + Math.cos(Math.PI + a) * len, ey = AY + Math.sin(Math.PI + a) * len * 0.9;
    const mx = AX + Math.cos(Math.PI + a) * len * 0.5, my = AY + Math.sin(Math.PI + a) * len * 0.45;
    const nx = -Math.sin(Math.PI + a) * 7, ny = Math.cos(Math.PI + a) * 7;
    out += `<path d="M${AX - 4} ${AY - 6} Q${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} Q${(mx - nx * 0.4).toFixed(1)} ${(my - ny * 0.4).toFixed(1)} ${AX - 2} ${AY - 2} Z" fill="${i % 2 ? main : 'url(#g)'}" ${O2}/>`;
    out += `<path d="M${(ex + (AX - ex) * 0.18).toFixed(1)} ${(ey + (AY - ey) * 0.18).toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}" stroke="${tipCol}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return out;
}

export function wingSprite(art = {}) {
  const main = art.main || '#f3e6c8', trim = art.trim || '#e0b45a', glow = art.glow || trim;
  let body = '';
  switch (art.kind) {
    case 'moth':
      body = `<path d="M${AX} ${AY} C70 40 40 4 14 10 C2 22 8 44 30 54 C44 60 62 66 ${AX} ${AY} Z" fill="url(#g)" ${O}/>
        <path d="M${AX} ${AY} C66 70 40 66 26 76 C20 86 34 92 50 88 C64 86 78 84 ${AX} ${AY} Z" fill="${main}" ${O}/>
        <circle cx="34" cy="30" r="9" fill="${trim}" ${O2}/><circle cx="34" cy="30" r="4" fill="${INK}"/><circle cx="32.5" cy="28.5" r="1.4" fill="#fff"/>
        <circle cx="44" cy="80" r="4" fill="${trim}" ${O2}/>
        <path d="M${AX} ${AY} C66 52 46 30 22 18 M${AX} ${AY} C64 64 46 54 22 44" stroke="${glow}" stroke-width="1.5" fill="none" opacity="0.8"/>`;
      break;
    case 'bat':
    case 'dragon': {
      const spikes = art.kind === 'dragon';
      body = `<path d="M${AX} ${AY} L58 18 L10 8 C18 22 14 30 6 40 C20 40 24 46 22 58 C34 52 42 56 46 68 C56 60 66 66 70 78 Z" fill="url(#g)" ${O}/>
        <path d="M${AX} ${AY} L58 18 L10 8 M58 18 L6 40 M58 18 L22 58 M58 18 L46 68" stroke="${shade2(main)}" stroke-width="${spikes ? 3.2 : 2.4}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M58 18 L52 4 L62 14 Z" fill="${shade2(main)}" ${O2}/>
        ${spikes ? `<path d="M10 8 L3 2 L12 4 Z M6 40 L0 38 L6 35 Z M22 58 L17 64 L25 60 Z" fill="${trim}" ${O2}/>
          <path d="M70 70 C56 48 40 34 18 22 M66 76 C54 64 40 60 26 56" stroke="${glow}" stroke-width="1.6" fill="none" opacity="0.85"/>` : `<path d="M60 60 C48 46 36 40 22 34" stroke="${trim}" stroke-width="1.3" fill="none" opacity="0.7"/>`}`;
      break;
    }
    case 'crystal':
      body = `<path d="M${AX} ${AY} L60 52 L30 4 L44 46 Z" fill="url(#g)" ${O}/>
        <path d="M${AX} ${AY} L56 60 L8 30 L46 62 Z" fill="${main}" opacity="0.92" ${O}/>
        <path d="M${AX} ${AY} L58 70 L16 66 L54 76 Z" fill="url(#g)" ${O}/>
        <path d="M30 4 L52 50 M8 30 L52 62 M16 66 L56 72" stroke="${trim}" stroke-width="1.6" opacity="0.9"/>
        <path d="M36 16 L40 26 M18 34 L26 40" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`;
      break;
    case 'eye':
      body = `<path d="M${AX} ${AY} C72 44 50 10 18 6 C10 20 6 34 10 48 C22 46 30 52 30 62 C44 58 58 66 ${AX} ${AY} Z" fill="url(#g)" ${O}/>
        <ellipse cx="36" cy="30" rx="11" ry="7" fill="${trim}" ${O2}/><circle cx="36" cy="30" r="4.6" fill="${glow}"/><circle cx="36" cy="30" r="2" fill="${INK}"/>
        ${[[22, 16], [50, 22], [20, 42], [56, 46], [44, 58], [64, 34]].map(([x, y]) => `<path d="M${x} ${y - 3} L${x + 1} ${y - 1} L${x + 3} ${y} L${x + 1} ${y + 1} L${x} ${y + 3} L${x - 1} ${y + 1} L${x - 3} ${y} L${x - 1} ${y - 1} Z" fill="#ffffff" opacity="0.9"/>`).join('')}
        <path d="M${AX} ${AY} C70 54 50 34 18 10" stroke="${trim}" stroke-width="1.4" fill="none" opacity="0.7"/>`;
      break;
    case 'seraph':
      body = feathers(main, trim, 9, trim) + `<path d="M${AX} ${AY} C74 66 64 52 56 40" stroke="${glow}" stroke-width="2" fill="none" opacity="0.8"/>`;
      break;
    case 'feather':
    default:
      body = feathers(main, trim, 7, trim);
  }
  return { w: W, h: H, ax: AX, ay: AY, glow, svg: S(W, H, grad('g', main, shadeHex(main, 1.25)), body) };
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}
const shade2 = (hex) => shadeHex(hex, 0.6);
