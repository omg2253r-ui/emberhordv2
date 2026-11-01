// v8 critters: every small monster is rebuilt from separate parts (body, head, jaw, wings, shell, cap, fists…)
// so src/battle/critterDraw.js can walk them on real legs, flap real wings, open jaws on the wind-up and
// squash jelly bodies on a spring. Legs, tails, tentacles and stems are drawn live on the canvas (so they bend);
// the painted parts here share the game's look: key light from the upper left, ink outline, coloured rim.
//
// Canonical space: the critter faces right, y grows down, the ground is y = 0. A part's ax/ay is the joint it
// hangs from; `meta` carries extra points (eyes to blink, a muzzle to glow) in the part's own pixels.
import { INK } from './palette.js';

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexOf = (a) => '#' + a.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
export const mixC = (a, b, t) => { const x = rgb(a), y = rgb(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); };
const lite = (c, t = 0.35) => mixC(c, '#fff4dc', t);
const dark = (c, t = 0.45) => mixC(c, '#0c0710', t);

const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const lit = (id, c) => `<linearGradient id="${id}" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="${lite(c, 0.38)}"/><stop offset="0.5" stop-color="${c}"/><stop offset="1" stop-color="${dark(c, 0.5)}"/></linearGradient>`;
const orb = (id, c) => `<radialGradient id="${id}" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="${lite(c, 0.45)}"/><stop offset="0.55" stop-color="${c}"/><stop offset="1" stop-color="${dark(c, 0.5)}"/></radialGradient>`;
const glowG = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const part = (w, h, ax, ay, defs, body, meta) => ({ w, h, ax, ay, svg: svg(w, h, defs, body), meta });
const rim = (d, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>`;
const shine = (x, y, rx, ry = rx * 0.55, rot = -20) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="0.42"/>`;
const eyeS = (x, y, r, c, slit = false) => slit
  ? `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.05}" fill="url(#eg)" ${O2}/><ellipse cx="${x + r * 0.15}" cy="${y}" rx="${r * 0.26}" ry="${r * 0.8}" fill="${INK}"/><circle cx="${x + r * 0.4}" cy="${y - r * 0.35}" r="${r * 0.22}" fill="#fff"/>`
  : `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.1}" fill="#fff8ea" ${O2}/><circle cx="${x + r * 0.28}" cy="${y + r * 0.15}" r="${r * 0.55}" fill="${c}"/><circle cx="${x + r * 0.28}" cy="${y + r * 0.15}" r="${r * 0.3}" fill="${INK}"/><circle cx="${x + r * 0.48}" cy="${y - r * 0.15}" r="${r * 0.2}" fill="#fff"/>`;
const eyeDefs = (c) => `<radialGradient id="eg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8d0"/><stop offset="1" stop-color="${c}"/></radialGradient>`;

// ======================================================================= QUAD (hounds, boars)
function quadBody(c, f) {
  const w = 128, h = 76, ax = 64, ay = 40;
  const spikes = f.spikes ? Array.from({ length: 6 }, (_, i) => { const x = 34 + i * 12, y = 20 - Math.sin((i / 5) * Math.PI) * 6, hh = 14 + (i % 2) * 6; return `<path d="M${x - 6} ${y + 8} Q${x} ${y - hh * 0.4} ${x + 2} ${y - hh} Q${x + 4} ${y - hh * 0.3} ${x + 7} ${y + 8} Z" fill="url(#sp)" ${O2}/>`; }).join('') : '';
  const cracks = f.cracks ? `<path d="M40 40 L50 48 L46 58 M76 34 L70 44 L80 52 M60 30 L62 40" stroke="${c.glow}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M40 40 L50 48 L46 58 M76 34 L70 44 L80 52" stroke="#fff3c4" stroke-width="1.1" fill="none"/>` : '';
  const mane = f.mane ? `<path d="M92 22 C88 10 100 6 104 14 C110 6 122 12 116 22 C124 26 120 38 110 36 L94 36 C84 34 84 24 92 22 Z" fill="url(#mn)" ${O2}/>` : '';
  const corona = f.corona ? `<path d="M30 30 C46 12 86 10 104 26" fill="none" stroke="${c.glow}" stroke-width="5" opacity="0.65"/><path d="M30 30 C46 12 86 10 104 26" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"/>` : '';
  return part(w, h, ax, ay, lit('b', c.main) + lit('sp', c.accent) + lit('mn', c.accent),
    `${spikes}
     <path d="M12 44 C10 22 38 12 66 14 C96 14 118 24 118 44 C118 62 98 70 64 70 C34 70 14 64 12 44 Z" fill="url(#b)" ${O}/>
     <path d="M20 54 C34 66 92 68 110 54 C100 60 70 62 64 62 C46 62 30 60 20 54 Z" fill="${c.belly || lite(c.main, 0.25)}" opacity="0.75"/>
     ${cracks}${mane}${corona}
     ${rim('M24 30 C40 18 80 16 104 26', c.glow)}
     <path d="M30 44 l8 -4 M44 50 l9 -4 M84 50 l8 -5 M96 42 l7 -4" stroke="${dark(c.main, 0.4)}" stroke-width="2" stroke-linecap="round"/>
     ${shine(46, 26, 12)}`);
}
function quadHead(c, f) {
  const w = 84, h = 70, ax = 16, ay = 40;
  const horns = f.horns ? `<path d="M30 18 C30 4 42 -2 50 2 C42 6 40 12 40 22 Z" fill="${lite(c.accent, 0.3)}" ${O2}/>` : '';
  const ears = f.ears !== false ? `<path d="M26 22 L22 4 L40 18 Z" fill="${dark(c.main, 0.2)}" ${O2}/><path d="M28 18 L26 9 L35 17 Z" fill="${lite(c.accent, 0.2)}"/>` : '';
  return part(w, h, ax, ay, lit('h', c.main) + eyeDefs(c.glow),
    `${ears}${horns}
     <path d="M10 40 C8 22 26 14 44 16 C60 18 72 26 80 36 C82 42 78 46 70 48 L40 52 C24 54 12 50 10 40 Z" fill="url(#h)" ${O}/>
     <path d="M70 32 C76 32 80 36 80 38 C78 40 74 40 70 38 Z" fill="${INK}"/>
     ${eyeS(44, 30, 6, c.glow, true)}
     <path d="M36 22 L52 26" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
     ${rim('M18 26 C26 18 40 16 52 18', c.glow)}
     ${shine(30, 26, 6)}`, { eyes: [[44, 30, 6.5]], nose: [78, 38] });
}
function toadBody(c) {
  return part(118, 74, 56, 46, orb('b', c.main),
    `<path d="M8 50 C4 24 30 10 58 10 C88 10 112 26 110 50 C108 66 84 72 58 72 C30 72 10 66 8 50 Z" fill="url(#b)" ${O}/>
     <path d="M18 58 C34 70 86 70 102 58 C90 64 70 66 58 66 C44 66 28 64 18 58 Z" fill="${c.belly}" opacity="0.8"/>
     ${[[34, 26, 5], [60, 20, 6], [82, 30, 4], [46, 40, 3.5], [72, 44, 4.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark(c.main, 0.25)}" ${O2} opacity="0.85"/>`).join('')}
     ${rim('M18 34 C30 18 50 12 70 12', c.light)}
     ${shine(40, 22, 10)}`);
}
function toadHead(c) {
  return part(86, 66, 14, 44, orb('h', c.main) + eyeDefs('#e8c34a'),
    `<path d="M6 46 C4 30 18 22 40 22 C62 22 80 30 82 44 C80 54 66 58 44 58 C22 58 8 54 6 46 Z" fill="url(#h)" ${O}/>
     <circle cx="30" cy="20" r="12" fill="url(#h)" ${O}/><circle cx="54" cy="20" r="12" fill="url(#h)" ${O}/>
     ${eyeS(30, 18, 7.5, '#e8c34a', true)}${eyeS(54, 18, 7.5, '#e8c34a', true)}
     <path d="M14 46 Q44 54 80 44" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
     <circle cx="74" cy="36" r="1.8" fill="${INK}"/>
     ${shine(42, 32, 8)}`, { eyes: [[30, 18, 8], [54, 18, 8]] });
}
function quadJaw(c) {
  return part(64, 26, 6, 6, lit('j', dark(c.main, 0.15)),
    `<path d="M4 4 L56 6 C60 10 56 16 48 18 L12 18 C6 16 2 10 4 4 Z" fill="url(#j)" ${O2}/>
     <path d="M16 6 l3 6 l3 -6 M30 6 l3 6 l3 -6 M44 6 l3 5 l3 -5" fill="#fff8ea" stroke="${INK}" stroke-width="1.2"/>`);
}

// ======================================================================= BIPED (imps, moss folk)
function bipedBody(c, f) {
  const w = 74, h = 70, ax = 37, ay = 62;
  const belly = `<ellipse cx="38" cy="44" rx="15" ry="16" fill="${c.belly || lite(c.main, 0.3)}" opacity="0.8"/>`;
  const lines = f.flameLines ? `<path d="M28 34 L34 42 L30 50 M48 32 L43 40 L49 48" stroke="${c.glow}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M28 34 L34 42 L30 50 M48 32 L43 40 L49 48" stroke="#fff3c4" stroke-width="1" fill="none"/>`
    : `<path d="M30 40 Q38 43 46 40 M30 46 Q38 49 46 46" stroke="${dark(c.main, 0.35)}" stroke-width="1.6" fill="none"/>`;
  const thorns = f.thorns ? `<path d="M10 40 L0 34 L10 48 M12 52 L2 54 L12 58" fill="${c.accent}" ${O2}/>` : '';
  const moss = f.moss ? `<path d="M14 30 C20 22 30 20 36 22 C32 26 30 30 30 34 C24 32 18 32 14 30 Z M44 22 C52 20 60 24 62 30 C56 30 52 32 50 34 C48 30 46 26 44 22 Z" fill="${c.accent}" ${O2}/>` : '';
  return part(w, h, ax, ay, lit('b', c.main),
    `${thorns}
     <path d="M12 60 C4 38 16 18 37 16 C58 18 70 38 62 60 Q37 70 12 60 Z" fill="url(#b)" ${O}/>
     ${belly}${lines}${moss}
     ${rim('M18 30 C24 22 32 18 40 18', c.glow)}
     ${shine(26, 30, 7)}`);
}
function bipedHead(c, f) {
  const w = 90, h = 84, ax = 45, ay = 72;
  let crown = '';
  if (f.horns === 'thorn') crown = `<path d="M30 30 C24 16 28 6 36 2 C34 12 36 20 38 28 Z M60 30 C66 16 62 6 54 2 C56 12 54 20 52 28 Z" fill="url(#hn)" ${O2}/>`;
  else if (f.horns) crown = `<path d="M32 30 C28 20 30 12 36 8 C36 16 38 22 40 28 Z M58 30 C62 20 60 12 54 8 C54 16 52 22 50 28 Z" fill="url(#hn)" ${O2}/>`;
  if (f.flameHead) crown = '';                          // drawn live (it flickers)
  const ears = f.ears ? `<path d="M22 46 L0 34 L18 58 Z" fill="${dark(c.main, 0.15)}" ${O}/><path d="M20 47 L8 40 L18 55 Z" fill="${lite(c.accent, 0.3)}"/><path d="M68 46 L90 34 L72 58 Z" fill="${dark(c.main, 0.15)}" ${O}/><path d="M70 47 L82 40 L72 55 Z" fill="${lite(c.accent, 0.3)}"/>` : '';
  const sprout = f.sprout ? `<path d="M45 30 Q43 20 46 12" fill="none" ${O}/><path d="M46 14 C56 4 70 8 66 18 C58 22 50 20 46 14 Z" fill="url(#hn)" ${O2}/><path d="M45 18 C36 10 26 14 30 22 C36 24 42 22 45 18 Z" fill="${c.accent}" ${O2}/>` : '';
  return part(w, h, ax, ay, lit('h', c.main) + lit('hn', c.accent) + eyeDefs(c.glow),
    `${ears}${crown}${sprout}
     <circle cx="45" cy="52" r="22" fill="url(#h)" ${O}/>
     ${f.round ? '' : `<path d="M30 44 L41 47 M49 47 L60 44" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`}
     ${eyeS(37, 53, 6.2, c.glow, !f.round)}${eyeS(54, 53, 6.2, c.glow, !f.round)}
     <path d="M36 64 Q45 70 54 64 Q45 67 36 64 Z" fill="${INK}" ${O2}/>${f.fangs !== false ? `<path d="M39 65 l1.5 3 l1.5 -2.5 M48 65.5 l1.5 2.5 l1.5 -3" fill="#fff8ea"/>` : ''}
     ${f.blush ? `<ellipse cx="29" cy="62" rx="4" ry="2.2" fill="#e5937a" opacity="0.55"/><ellipse cx="61" cy="62" rx="4" ry="2.2" fill="#e5937a" opacity="0.55"/>` : ''}
     ${rim('M28 38 C34 32 42 30 50 31', c.glow)}
     ${shine(36, 40, 6)}`, { eyes: [[37, 53, 6.8], [54, 53, 6.8]], crown: [45, 30] });
}
function batWing(c) {
  return part(78, 64, 8, 10, lit('w', dark(c.main, 0.1)),
    `<path d="M6 8 C30 2 56 6 74 20 C66 22 62 26 62 32 C54 30 48 34 46 42 C40 38 32 40 28 48 C22 40 14 34 6 30 Z" fill="url(#w)" ${O}/>
     <path d="M8 10 L62 30 M8 12 L46 40 M8 14 L28 46" stroke="${dark(c.main, 0.4)}" stroke-width="2" fill="none"/>
     ${rim('M10 8 C30 4 50 8 70 18', c.glow)}`);
}

// ======================================================================= GOLEM (brutes, mortars)
function golemBody(c, f) {
  const w = 120, h = 104, ax = 60, ay = 92;
  const core = `<circle cx="60" cy="50" r="12" fill="url(#cg)"/><circle cx="60" cy="50" r="7" fill="${c.glow}" ${O2}/><circle cx="60" cy="50" r="3" fill="#fff8ea"/>`;
  const barrel = f.barrel ? `<path d="M22 40 L6 12 L28 2 L42 32 Z" fill="url(#m)" ${O}/><path d="M10 18 L32 8" stroke="${c.accent}" stroke-width="3"/><ellipse cx="17" cy="7" rx="12" ry="5" transform="rotate(-24 17 7)" fill="${INK}"/><ellipse cx="17" cy="7" rx="6" ry="2.4" transform="rotate(-24 17 7)" fill="${c.glow}" opacity="0.8"/>` : '';
  const crystal = f.crystal ? `<path d="M34 20 L40 -2 L48 18 Z M68 16 L78 -6 L86 18 Z M52 14 L58 2 L62 14 Z" fill="url(#cr)" ${O2}/><path d="M40 2 L43 16 M78 -2 L80 14" stroke="#fff" stroke-width="1.5" opacity="0.8"/>` : '';
  return part(w, h, ax, ay, lit('b', c.main) + lit('m', c.light) + glowG('cg', c.glow) + lit('cr', c.accent),
    `${barrel}${crystal}
     <path d="M16 88 C8 56 18 22 60 18 C102 22 112 56 104 88 Q60 100 16 88 Z" fill="url(#b)" ${O}/>
     <path d="M28 36 L52 30 L56 44 L30 50 Z M68 30 L92 36 L90 50 L64 44 Z" fill="url(#m)" ${O2} opacity="0.9"/>
     <path d="M22 70 L98 70" stroke="${dark(c.main, 0.4)}" stroke-width="3"/>
     <path d="M34 70 L34 88 M60 70 L60 92 M86 70 L86 88" stroke="${dark(c.main, 0.4)}" stroke-width="2"/>
     ${core}
     ${rim('M24 40 C30 26 44 20 60 20', c.glow)}
     ${shine(36, 30, 9)}`, { core: [60, 50] });
}
function golemHead(c, f) {
  return part(60, 46, 30, 40, lit('h', c.main) + glowG('eg2', c.glow),
    `<path d="M8 38 C4 18 16 6 30 6 C44 6 56 18 52 38 Z" fill="url(#h)" ${O}/>
     <rect x="12" y="20" width="36" height="9" rx="3" fill="${INK}"/>
     <ellipse cx="22" cy="24.5" rx="5" ry="3" fill="${c.glow}"/><ellipse cx="38" cy="24.5" rx="5" ry="3" fill="${c.glow}"/>
     ${f.horns ? `<path d="M10 14 L2 2 L16 10 Z M50 14 L58 2 L44 10 Z" fill="${c.accent}" ${O2}/>` : ''}
     ${rim('M12 16 C18 10 24 8 30 8', c.glow)}`, { visor: [30, 24] });
}
function golemFist(c, f) {
  const shield = f.shield ? `<path d="M2 -26 L34 -22 L36 30 L18 44 L0 30 Z" transform="translate(6 30)" fill="url(#sh)" ${O}/><path d="M22 10 L22 60 M8 30 L36 32" transform="translate(0 0)" stroke="${c.accent}" stroke-width="3" opacity="0.8"/>` : '';
  return part(52, 82, 22, 14, lit('f', c.light) + lit('sh', c.light),
    `${shield || `<path d="M8 30 C2 14 12 4 24 4 C38 4 48 14 44 30 C46 44 36 52 24 52 C12 52 4 44 8 30 Z" fill="url(#f)" ${O}/><path d="M14 22 L36 22 M14 32 L38 32 M16 42 L36 42" stroke="${dark(c.light, 0.4)}" stroke-width="2"/>`}`);
}

// ======================================================================= BUG (beetles, scarabs, spiders)
function bugShell(c, f) {
  const w = 118, h = 72, ax = 58, ay = 52;
  const glow = f.cracks ? `<path d="M26 34 L36 40 L30 50 M90 32 L82 40 L90 48" stroke="${c.glow}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M26 34 L36 40 L30 50 M90 32 L82 40 L90 48" stroke="#fff3c4" stroke-width="1" fill="none"/>` : '';
  const dots = f.dots ? `<circle cx="38" cy="30" r="5" fill="${c.accent}" ${O2}/><circle cx="74" cy="26" r="6" fill="${c.accent}" ${O2}/><circle cx="56" cy="44" r="4" fill="${c.accent}" ${O2}/>` : '';
  const hairs = f.spider ? `<path d="M20 40 l-6 -3 M28 24 l-4 -6 M48 16 l0 -7 M70 16 l3 -7 M90 24 l6 -5" stroke="${INK}" stroke-width="1.6"/>` : '';
  const pattern = f.spider ? `<path d="M58 22 L50 34 L58 46 L66 34 Z" fill="${c.glow}" opacity="0.8" ${O2}/>` : `<path d="M58 14 L58 66" stroke="${INK}" stroke-width="2.6"/>`;
  return part(w, h, ax, ay, lit('s', c.main),
    `${hairs}
     <path d="M8 52 C6 26 30 12 58 12 C88 12 110 26 108 52 C108 62 90 66 58 66 C28 66 8 62 8 52 Z" fill="url(#s)" ${O}/>
     ${pattern}${glow}${dots}
     <path d="M14 56 Q58 68 102 56" stroke="${dark(c.main, 0.5)}" stroke-width="3" fill="none" opacity="0.6"/>
     ${rim('M18 34 C26 22 44 14 58 14', c.glow)}
     ${shine(36, 24, 12, 5)}`);
}
function bugHead(c, f) {
  const horn = f.horn ? `<path d="M30 10 C36 -4 48 -6 54 -2 C46 2 42 8 40 16 Z" fill="${lite(c.accent, 0.2)}" ${O2}/>` : '';
  const eyes = f.spider ? `${[[26, 12, 3.2], [34, 10, 3.6], [30, 18, 2.6], [38, 17, 2.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.glow}" ${O2}/><circle cx="${x + 0.8}" cy="${y - 0.8}" r="${r * 0.35}" fill="#fff"/>`).join('')}` : `<circle cx="30" cy="16" r="5" fill="${c.glow}" ${O2}/><circle cx="31" cy="15" r="1.8" fill="#fff"/>`;
  return part(56, 38, 6, 22, lit('h', dark(c.main, 0.1)),
    `${horn}
     <path d="M4 22 C2 10 14 4 28 4 C42 4 50 12 48 22 C46 30 36 34 24 34 C12 34 6 30 4 22 Z" fill="url(#h)" ${O}/>
     ${eyes}
     ${f.antennae !== false ? `<path d="M34 6 C40 -2 46 -6 52 -6 M28 6 C30 -4 34 -8 38 -10" fill="none" ${O2}/>` : ''}
     ${rim('M10 12 C16 6 24 4 32 5', c.glow)}`, { eyes: [] });
}

// ======================================================================= BLOB (slimes, bouncers, mosslings)
function blobBody(c, f) {
  const w = 108, h = 92, ax = 54, ay = 88;
  const crystals = f.crystals ? `<path d="M30 36 L36 8 L44 34 Z M58 30 L66 0 L74 30 Z M78 40 L88 18 L90 44 Z" fill="url(#cr)" ${O2}/><path d="M36 10 L40 32 M66 4 L68 28" stroke="#fff" stroke-width="1.5" opacity="0.7"/>` : '';
  const spots = f.spots ? `<circle cx="26" cy="62" r="3" fill="${dark(c.main, 0.35)}"/><circle cx="80" cy="70" r="2.4" fill="${dark(c.main, 0.35)}"/><circle cx="34" cy="74" r="2" fill="${dark(c.main, 0.35)}"/>` : '';
  const jelly = f.jelly ? `<ellipse cx="54" cy="64" rx="26" ry="16" fill="#ffffff" opacity="0.14"/><circle cx="42" cy="66" r="4" fill="#fff" opacity="0.25"/><circle cx="66" cy="58" r="3" fill="#fff" opacity="0.2"/>` : '';
  return part(w, h, ax, ay, orb('b', c.main) + lit('cr', c.accent),
    `${crystals}
     <path d="M10 84 C4 54 26 30 54 30 C82 30 104 54 98 84 Q54 96 10 84 Z" fill="url(#b)" ${O}/>
     <path d="M14 82 Q54 93 94 82 C94 77 88 74 84 76 Q54 86 24 76 C19 74 14 77 14 82 Z" fill="${dark(c.main, 0.4)}" opacity="0.6"/>
     ${jelly}${spots}
     ${rim('M20 52 C28 38 40 32 54 32', c.glow)}
     ${shine(34, 46, 8)}`, { eyes: [[42, 60, 8], [66, 60, 8]] });
}
function blobCap(c) {
  return part(118, 54, 59, 44, orb('a', c.accent),
    `<path d="M6 46 C8 12 110 12 112 46 C88 54 30 54 6 46 Z" fill="url(#a)" ${O}/>
     ${[[28, 28, 7], [56, 22, 9], [84, 30, 6], [42, 40, 4], [72, 42, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${lite(c.accent, 0.55)}" opacity="0.9"/>`).join('')}
     ${rim('M14 34 C30 18 70 14 100 26', '#ffffff')}`);
}
function leafSprout(c) {
  return part(60, 40, 30, 36, lit('l', c.accent),
    `<path d="M30 36 Q28 24 31 14" fill="none" ${O}/>
     <path d="M31 16 C42 4 56 8 52 18 C44 22 36 20 31 16 Z" fill="url(#l)" ${O2}/><path d="M34 16 C40 13 46 14 50 16" stroke="${dark(c.accent, 0.4)}" stroke-width="1.2" fill="none"/>
     <path d="M30 20 C20 12 8 16 12 24 C18 26 26 24 30 20 Z" fill="${dark(c.accent, 0.1)}" ${O2}/>`);
}

// ======================================================================= FLOATER (wisps, puffs, drones)
function floaterBody(c, f) {
  const w = 90, h = 90, ax = 45, ay = 45;
  const mech = f.mech ? `<path d="M18 46 L72 46" stroke="${INK}" stroke-width="2.4"/><rect x="34" y="18" width="22" height="8" rx="3" fill="${dark(c.main, 0.3)}" ${O2}/><circle cx="45" cy="52" r="12" fill="url(#cg)"/><circle cx="45" cy="52" r="7" fill="${c.glow}" ${O2}/>` : '';
  const face = f.mech ? '' : `${eyeS(36, 46, 6, c.glow)}${eyeS(54, 46, 6, c.glow)}<path d="M38 58 Q45 63 52 58" fill="none" ${O2}/>`;
  const crystal = f.crystal ? `<path d="M45 8 L66 40 L45 82 L24 40 Z" fill="url(#b)" ${O}/><path d="M45 8 L45 82 M24 40 L66 40" stroke="#ffffff" stroke-width="1.6" opacity="0.6"/>` : `<circle cx="45" cy="45" r="30" fill="url(#b)" ${O}/>`;
  const puffs = f.puff ? `${[[22, 30, 10], [66, 28, 11], [44, 16, 12], [20, 56, 9], [70, 56, 9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#b)" ${O2}/>`).join('')}` : '';
  return part(w, h, ax, ay, orb('b', c.main) + glowG('cg', c.glow) + eyeDefs(c.glow),
    `${puffs}${crystal}${mech}${f.crystal ? `<circle cx="45" cy="44" r="7" fill="${c.glow}" ${O2}/><circle cx="46" cy="42" r="2.5" fill="#fff"/>` : face}
     ${rim('M24 30 C30 20 38 16 46 16', c.glow)}
     ${shine(34, 32, 7)}`, { eyes: f.mech || f.crystal ? [] : [[36, 46, 6.5], [54, 46, 6.5]] });
}

// ======================================================================= FLYER (rays, birds)
function flyerBody(c, f) {
  return part(100, 54, 50, 30, lit('b', c.main) + eyeDefs(c.glow),
    `<path d="M6 30 C14 14 40 8 62 12 C82 16 96 24 98 30 C96 38 82 44 62 46 C40 48 14 44 6 30 Z" fill="url(#b)" ${O}/>
     <path d="M20 36 C40 44 74 44 92 34" fill="none" stroke="${lite(c.main, 0.4)}" stroke-width="5" opacity="0.6"/>
     ${eyeS(80, 24, 4.6, c.glow, true)}
     ${f.horns ? `<path d="M90 24 C98 14 100 8 96 2 M86 22 C90 12 90 6 86 2" fill="none" ${O2}/>` : ''}
     ${rim('M18 22 C34 12 56 10 76 14', c.glow)}
     ${shine(44, 20, 10, 4)}`, { eyes: [[80, 24, 5]] });
}
function flyerWing(c) {
  return part(96, 52, 10, 8, lit('w', c.light),
    `<path d="M6 6 C30 2 66 8 92 26 C76 30 62 38 54 48 C44 40 26 34 6 30 Z" fill="url(#w)" ${O}/>
     <path d="M10 10 L70 24 M10 16 L54 40 M10 22 L34 34" stroke="${dark(c.light, 0.35)}" stroke-width="1.6" fill="none"/>
     ${rim('M12 6 C40 4 66 10 88 24', '#ffffff')}`);
}

// ======================================================================= PLANT (seed spitters)
function plantHead(c) {
  return part(84, 74, 42, 66, orb('h', c.main) + lit('p', c.accent) + eyeDefs(c.glow),
    `${Array.from({ length: 7 }, (_, i) => { const a = -Math.PI + (i / 6) * Math.PI, x = 42 + Math.cos(a) * 30, y = 40 + Math.sin(a) * 30; return `<ellipse cx="${x}" cy="${y}" rx="13" ry="8" transform="rotate(${(a * 180) / Math.PI} ${x} ${y})" fill="url(#p)" ${O2}/>`; }).join('')}
     <circle cx="42" cy="42" r="24" fill="url(#h)" ${O}/>
     <ellipse cx="48" cy="46" rx="11" ry="9" fill="${INK}"/><ellipse cx="50" cy="48" rx="6" ry="4" fill="${c.glow}" opacity="0.7"/>
     ${eyeS(32, 34, 4.5, c.glow, true)}
     ${rim('M24 30 C30 22 38 20 46 20', c.glow)}`, { eyes: [[32, 34, 5]], mouth: [48, 46] });
}

// ======================================================================= the cast
// kind decides the skeleton; f adds features; scale matches the old single-picture size.
export const CRITTERS = Object.freeze({
  mossling: { kind: 'blob', scale: 0.72, c: { main: '#6f9a4a', light: '#c9e48e', dark: '#2f4a22', accent: '#a5c76c', glow: '#3a2a1e' }, f: { sprout: true, spots: true, feet: true, blush: true } },
  thorn_imp: { kind: 'biped', scale: 0.74, c: { main: '#8a3b2e', light: '#d9846a', dark: '#4a1c14', accent: '#7c9c4c', glow: '#ffcf5a', belly: '#c9774e' }, f: { horns: 'thorn', ears: true, thorns: true, tail: '#7a3426' } },
  ember_imp: { kind: 'biped', scale: 0.74, c: { main: '#6a2a20', light: '#c4492e', dark: '#2e1410', accent: '#ff8a3d', glow: '#ffb020', belly: '#a03a24' }, f: { flameHead: true, ears: true, flameLines: true, emberHand: true, wings: true, tail: '#5a2a22' } },
  cinder_beetle: { kind: 'bug', scale: 0.74, c: { main: '#4e3a30', light: '#a08070', dark: '#1e1512', accent: '#ff8a3d', glow: '#ff8a3d' }, f: { cracks: true } },
  z_gust_sprite: { kind: 'floater', scale: 0.74, c: { main: '#9fd6c4', light: '#e6fff6', dark: '#3f8a78', accent: '#cdf3e6', glow: '#2a5a4e' }, f: { streamers: 3, ring: true, wind: true } },
  z_seed_spitter: { kind: 'plant', scale: 0.78, c: { main: '#6f9a4a', light: '#d6ef8a', dark: '#3f612b', accent: '#e8c34a', glow: '#ffcf5a' }, f: {} },
  z_frost_slime: { kind: 'blob', scale: 0.74, c: { main: '#8fd0f0', light: '#e2f6ff', dark: '#3a7aa8', accent: '#bfe8ff', glow: '#24384e' }, f: { crystals: true, jelly: true } },
  z_frost_mote: { kind: 'blob', scale: 0.74, c: { main: '#a8dcf4', light: '#f2fbff', dark: '#4a8ab8', accent: '#bfe8ff', glow: '#24384e' }, f: { crystals: true, jelly: true } },
  z_bog_toad: { kind: 'quad', scale: 0.8, c: { main: '#6a8a3a', light: '#b8d070', dark: '#2e4220', accent: '#c27ff0', glow: '#e8ff9a', belly: '#c8d890' }, f: { toad: true, ears: false, spots: true } },
  z_spore_puff: { kind: 'floater', scale: 0.74, c: { main: '#b07ad0', light: '#ecd2ff', dark: '#5a2f78', accent: '#d6a4f0', glow: '#5a2f78' }, f: { puff: true, streamers: 4, spores: '#e8ff9a' } },
  z_sand_burrower: { kind: 'bug', scale: 0.78, c: { main: '#c8a060', light: '#f0d89a', dark: '#6a4a24', accent: '#8a5a2a', glow: '#ffcf5a' }, f: { horn: true } },
  z_scarab: { kind: 'bug', scale: 0.74, c: { main: '#2f6a6a', light: '#7fd0c0', dark: '#123030', accent: '#f5d48a', glow: '#ffcf5a' }, f: { wings: true, dots: true } },
  z_cap_bouncer: { kind: 'blob', scale: 0.74, c: { main: '#e8d0c0', light: '#fff0e8', dark: '#8a6a5a', accent: '#d06a8a', glow: '#3a2420' }, f: { cap: true, feet: true } },
  z_mycel_weaver: { kind: 'bug', scale: 0.74, c: { main: '#6a5aa8', light: '#c8b8ff', dark: '#2a2050', accent: '#9fffd8', glow: '#9fffd8' }, f: { spider: true, antennae: false } },
  z_volt_drone: { kind: 'floater', scale: 0.72, c: { main: '#5a6a80', light: '#c8d8ea', dark: '#232c38', accent: '#ffe65a', glow: '#fff07a' }, f: { mech: true, ring: true, rotor: true } },
  z_iron_brute: { kind: 'golem', scale: 0.62, c: { main: '#6a6f78', light: '#b8c0cc', dark: '#2a2e34', accent: '#ffcf5a', glow: '#ffe65a' }, f: { shield: true } },
  z_cinder_mortar: { kind: 'golem', scale: 0.6, c: { main: '#5a4a44', light: '#9a847a', dark: '#241c18', accent: '#ff7a33', glow: '#ff8a3d' }, f: { barrel: true, squat: true } },
  z_magma_hound: { kind: 'quad', scale: 0.74, c: { main: '#6a2a1e', light: '#c4492e', dark: '#2a100c', accent: '#ff8a3d', glow: '#ffcf5a', belly: '#8e3a28' }, f: { spikes: true, cracks: true, tailFire: true } },
  z_cloud_ray: { kind: 'flyer', scale: 0.82, c: { main: '#a8c8e8', light: '#f4faff', dark: '#4a6a8a', accent: '#ffe65a', glow: '#ffe65a' }, f: { tail: true } },
  // v8 lands
  z_mirror_wisp: { kind: 'floater', scale: 0.74, c: { main: '#b8d8f0', light: '#ffffff', dark: '#4a6a90', accent: '#e8f4ff', glow: '#7fe8ff' }, f: { crystal: true, ring: true, shards: true } },
  z_glass_golem: { kind: 'golem', scale: 0.62, c: { main: '#7a9ab8', light: '#d8ecff', dark: '#2a3a50', accent: '#bfe8ff', glow: '#7fe8ff' }, f: { crystal: true, horns: true } },
  z_eclipse_hound: { kind: 'quad', scale: 0.76, c: { main: '#2a2238', light: '#5a4a78', dark: '#0e0a16', accent: '#ffb648', glow: '#ffd27a', belly: '#3a3050' }, f: { corona: true, mane: true, horns: true, tailFire: true } },
});
export const critterOf = (id) => (Object.prototype.hasOwnProperty.call(CRITTERS, id) ? CRITTERS[id] : null);

// every painted part a critter needs
export function critterParts(def) {
  const { c, f } = def;
  switch (def.kind) {
    case 'quad': return f.toad ? { body: toadBody(c), head: toadHead(c), jaw: quadJaw({ ...c, main: c.belly }) } : { body: quadBody(c, f), head: quadHead(c, f), jaw: quadJaw(c) };
    case 'biped': return { body: bipedBody(c, f), head: bipedHead(c, f), ...(f.wings ? { wing: batWing(c) } : {}) };
    case 'golem': return { body: golemBody(c, f), head: golemHead(c, f), fist: golemFist(c, {}), ...(f.shield ? { shield: golemFist(c, f) } : {}) };
    case 'bug': return { shell: bugShell(c, f), head: bugHead(c, f) };
    case 'blob': return { body: blobBody(c, f), ...(f.cap ? { cap: blobCap(c) } : {}), ...(f.sprout ? { sprout: leafSprout(c) } : {}) };
    case 'floater': return { body: floaterBody(c, f) };
    case 'flyer': return { body: flyerBody(c, f), wing: flyerWing(c) };
    case 'plant': return { head: plantHead(c) };
    default: return {};
  }
}
