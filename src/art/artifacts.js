// Artifact icons (64×64): a glowing relic floating over a small starfield disc, one silhouette per shape.
import { INK } from './palette.js';

const O = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const SHAPES = {
  shard: (a, b) => `<path d="M24 50 L30 14 L40 20 L44 46 Z" fill="${b}" ${O}/><path d="M30 14 L34 48 M40 20 L36 30" stroke="${a}" stroke-width="2"/>`,
  prism: (a, b) => `<path d="M32 10 L48 40 L32 54 L16 40 Z" fill="${b}" ${O}/><path d="M32 10 L32 54 M16 40 L48 40" stroke="${a}" stroke-width="1.8" opacity="0.8"/><path d="M32 10 L48 40 L32 40 Z" fill="${a}" opacity="0.35"/>`,
  drop: (a, b) => `<path d="M32 10 C40 24 46 30 46 40 A14 14 0 0 1 18 40 C18 30 24 24 32 10 Z" fill="${b}" ${O}/><path d="M26 36 C26 30 29 26 31 23" stroke="${a}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  fang: (a, b) => `<path d="M24 12 C38 16 46 30 40 54 C36 40 30 30 20 24 Z" fill="${b}" ${O}/><path d="M28 18 C36 24 40 34 39 46" stroke="${a}" stroke-width="2" fill="none"/>`,
  orb: (a, b) => `<circle cx="32" cy="32" r="16" fill="${b}" ${O}/><circle cx="32" cy="32" r="9" fill="${a}" opacity="0.7"/><path d="M22 26 A12 12 0 0 1 30 18" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  ring: (a, b) => `<circle cx="32" cy="32" r="17" fill="none" stroke="${INK}" stroke-width="8"/><circle cx="32" cy="32" r="17" fill="none" stroke="${b}" stroke-width="5"/><path d="M15 32 L49 32 M32 15 L32 49 M20 20 L44 44 M44 20 L20 44" stroke="${a}" stroke-width="1.2" opacity="0.8"/><circle cx="32" cy="32" r="4" fill="${a}" ${O}/>`,
  scale: (a, b) => `<path d="M32 12 C46 18 48 34 32 52 C16 34 18 18 32 12 Z" fill="${b}" ${O}/><path d="M24 28 Q32 34 40 28 M26 38 Q32 42 38 38" stroke="${a}" stroke-width="2" fill="none"/>`,
  star: (a, b) => `<path d="M32 8 L37 26 L56 32 L37 38 L32 56 L27 38 L8 32 L27 26 Z" fill="${b}" ${O}/><path d="M32 16 L34.5 29.5 L48 32 L34.5 34.5 L32 48 L29.5 34.5 L16 32 L29.5 29.5 Z" fill="${a}"/>`,
  planet: (a, b) => `<circle cx="32" cy="32" r="13" fill="${b}" ${O}/><ellipse cx="32" cy="34" rx="24" ry="7" fill="none" stroke="${INK}" stroke-width="5" transform="rotate(-18 32 34)"/><ellipse cx="32" cy="34" rx="24" ry="7" fill="none" stroke="${a}" stroke-width="2.6" transform="rotate(-18 32 34)"/>`,
  spiral: (a, b) => `<circle cx="32" cy="32" r="18" fill="${b}" ${O}/><path d="M32 32 C36 30 36 24 30 24 C24 24 22 32 26 37 C31 43 41 41 43 33 C45 24 38 16 30 17" stroke="${a}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  heart: (a, b) => `<path d="M32 52 C14 40 12 28 18 22 C24 16 30 20 32 26 C34 20 40 16 46 22 C52 28 50 40 32 52 Z" fill="${b}" ${O}/><path d="M22 28 C22 24 25 22 28 23" stroke="${a}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  nova: (a, b) => `${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M32 32 L${(32 + Math.cos(i * Math.PI / 4) * 26).toFixed(1)} ${(32 + Math.sin(i * Math.PI / 4) * 26).toFixed(1)}" stroke="${b}" stroke-width="${i % 2 ? 2 : 4}" stroke-linecap="round"/>`).join('')}<circle cx="32" cy="32" r="12" fill="${b}" ${O}/><circle cx="32" cy="32" r="6" fill="${a}"/>`,
  void: (a, b) => `<circle cx="32" cy="32" r="18" fill="${a}" opacity="0.45"/><circle cx="32" cy="32" r="14" fill="${b}" ${O}/><ellipse cx="32" cy="32" rx="22" ry="5" fill="none" stroke="${a}" stroke-width="2" transform="rotate(20 32 32)"/>`,
  crown: (a, b) => `<path d="M14 46 L12 22 L22 32 L32 14 L42 32 L52 22 L50 46 Z" fill="${b}" ${O}/><path d="M14 46 L50 46 L48 52 L16 52 Z" fill="${a}" ${O}/><circle cx="32" cy="34" r="3.4" fill="${a}" ${O}/><circle cx="22" cy="38" r="2" fill="#fff"/><circle cx="42" cy="38" r="2" fill="#fff"/>`,
};

export function artifactIconSvg(art) {
  const L = art?.look || { shape: 'orb', a: '#fff', b: '#888' };
  const body = (SHAPES[L.shape] || SHAPES.orb)(L.a, L.b);
  const stars = [[10, 14], [52, 10], [56, 46], [8, 50], [46, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff" opacity="0.8"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="ag" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${L.a}" stop-opacity="0.55"/><stop offset="1" stop-color="${L.b}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="32" cy="32" r="30" fill="url(#ag)"/>${stars}${body}</svg>`;
}
