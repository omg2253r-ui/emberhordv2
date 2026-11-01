// Creatures of the ten online zones. A small illustration kit (body archetypes + features) keeps every monster in
// the same ink-and-gradient style as src/art/creatures.js while letting each one get its own silhouette and colours.
// Each builder returns { svg, w, h, ax, ay }.
import { BOSS_ART } from './bossArt.js';
import { INK } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b, cx = 0.4, cy = 0.35, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const eye = (cx, cy, rx, ry, iris = INK, glow = null) => glow
  ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${glow}" ${O2}/><ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.35}" ry="${ry * 0.75}" fill="#fff8ea"/>`
  : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff8ea" ${O2}/><circle cx="${cx + rx * 0.25}" cy="${cy + ry * 0.2}" r="${rx * 0.5}" fill="${iris}"/><circle cx="${cx + rx * 0.4}" cy="${cy - ry * 0.05}" r="${rx * 0.17}" fill="#fff"/>`;
const mouth = (cx, cy, w, fangs = false) => `<path d="M${cx - w} ${cy} Q${cx} ${cy + w * 0.7} ${cx + w} ${cy}" fill="#2a1410" ${O2}/>` + (fangs ? `<path d="M${cx - w * 0.5} ${cy + 1} l2 5 l2 -5 M${cx + w * 0.5 - 4} ${cy + 1} l2 5 l2 -5" fill="#fff8ea" stroke="${INK}" stroke-width="1"/>` : '');
// Bosses are the same drawing at twice the size (a group transform keeps colours and ids intact).
const scaled = (k, w, h, ax, ay, defs, body) => ({ w: w * k, h: h * k, ax: ax * k, ay: ay * k, svg: S(w * k, h * k, defs, k === 1 ? body : `<g transform="scale(${k})">${body}</g>`) });
const shine = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="#fff" opacity="0.45"/>`;

// --------------------------------------------------------------------- archetypes
// c: { main, dark, light, accent, eye, glow }
function blob(c, o = {}) {
  const w = 110, h = 100;
  const spikes = o.spikes ? Array.from({ length: 5 }, (_, i) => { const x = 22 + i * 16; return `<path d="M${x - 6} ${40 - (i % 2) * 4} L${x} ${18 - (i % 2) * 6} L${x + 6} ${40 - (i % 2) * 4}" fill="${c.accent}" ${O2}/>`; }).join('') : '';
  const crystals = o.crystals ? `<path d="M30 40 L36 12 L44 38 Z M58 34 L66 4 L74 34 Z M78 44 L88 22 L90 48 Z" fill="${c.light}" ${O2}/><path d="M36 14 L40 36 M66 8 L68 32" stroke="#fff" stroke-width="1.5" opacity="0.7"/>` : '';
  const cap = o.cap ? `<path d="M6 52 C8 18 102 18 104 52 C80 60 30 60 6 52 Z" fill="url(#a)" ${O}/>${[[26, 34, 7], [52, 28, 9], [78, 36, 6], [40, 46, 4], [68, 48, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.light}" opacity="0.9"/>`).join('')}` : '';
  return { w, h, ax: 55, ay: 93, svg: S(w, h, rg('b', c.light, c.dark) + rg('a', c.accent, c.dark), `
    ${spikes}${crystals}
    <path d="M12 86 C6 56 28 32 55 32 C82 32 104 56 98 86 Q55 98 12 86 Z" fill="url(#b)" ${O}/>
    <path d="M16 84 Q55 95 94 84 C94 79 88 76 84 78 Q55 88 26 78 C21 76 16 79 16 84 Z" fill="${c.dark}" opacity="0.6"/>
    ${cap}
    ${shine(36, 48, 6)}
    ${eye(42, 62, 8, 9, INK, c.glow)}${eye(68, 62, 8, 9, INK, c.glow)}
    ${mouth(55, 76, 8, o.fangs)}`) };
}

function bird(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 120, h = 110;
  return scaled(k, w, h, w / 2, h - 8, rg('b', c.light, c.dark) + lg('w', c.accent, c.dark, 1, 1), `
    <path d="M60 58 C40 30 14 26 4 34 C16 40 20 46 22 52 C14 52 8 56 6 62 C22 62 36 64 52 70 Z" fill="url(#w)" ${O}/>
    <path d="M60 58 C80 30 106 26 116 34 C104 40 100 46 98 52 C106 52 112 56 114 62 C98 62 84 64 68 70 Z" fill="url(#w)" ${O}/>
    <path d="M20 44 L44 58 M18 56 L46 64 M100 44 L76 58 M102 56 L74 64" stroke="${c.dark}" stroke-width="2"/>
    <path d="M50 92 L46 102 M54 92 L54 102 M66 92 L66 102 M70 92 L74 102" stroke="${c.accent}" stroke-width="3"/>
    <ellipse cx="60" cy="72" rx="20" ry="24" fill="url(#b)" ${O}/>
    <ellipse cx="60" cy="80" rx="11" ry="13" fill="${c.light}" opacity="0.7"/>
    <circle cx="60" cy="44" r="14" fill="url(#b)" ${O}/>
    <path d="M56 50 L60 60 L64 50 Z" fill="${c.accent}" ${O2}/>
    ${o.crest ? `<path d="M52 32 C50 20 56 14 60 12 C60 20 62 26 64 32 C66 22 72 18 76 18 C72 26 70 30 66 34" fill="${c.accent}" ${O2}/>` : ''}
    ` + eye(52, 44, 4, 5, INK, c.glow) + eye(68, 44, 4, 5, INK, c.glow));
}

function beast(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 130, h = 100;
  const horns = o.horns ? `<path d="M92 28 C96 12 108 8 114 10 C106 16 104 22 102 32 Z M80 26 C80 12 88 4 94 4 C90 12 90 18 90 28 Z" fill="${c.light}" ${O2}/>` : '';
  const mane = o.mane ? `<path d="M74 30 C70 20 78 14 84 18 C86 10 96 10 98 18 C106 16 110 26 104 32 C110 38 104 48 96 46 L76 46 C68 46 66 36 74 30 Z" fill="${c.accent}" ${O2}/>` : '';
  const tail = o.tailFire ? `<path d="M22 54 C10 50 4 40 8 30 C12 38 16 40 20 40 C16 32 18 24 24 20 C24 30 28 36 32 44 Z" fill="${c.glow || c.accent}" ${O2}/>` : `<path d="M24 52 C12 50 6 42 8 34 C14 40 20 44 28 46" fill="none" ${O}/>`;
  return scaled(k, w, h, w / 2, h - 6, rg('b', c.light, c.dark, 0.5, 0.3) + lg('l', c.main, c.dark), `
    ${tail}
    <path d="M30 70 L26 92 L36 92 L40 72 Z M46 72 L44 92 L54 92 L56 72 Z" fill="url(#l)" ${O2}/>
    <path d="M82 70 L80 92 L90 92 L92 70 Z M96 68 L98 92 L108 92 L104 66 Z" fill="url(#l)" ${O2}/>
    <path d="M24 56 C24 38 44 32 70 34 C92 34 104 42 104 58 C104 72 90 78 66 78 C40 78 24 72 24 56 Z" fill="url(#b)" ${O}/>
    ${o.spikes ? `<path d="M36 38 L40 26 L46 36 L52 22 L58 34 L64 20 L70 34" fill="${c.accent}" ${O2}/>` : ''}
    <path d="M30 64 Q60 74 98 62" stroke="${c.dark}" stroke-width="2" fill="none" opacity="0.7"/>
    ${mane}${horns}
    <path d="M84 30 C96 22 116 26 122 40 C126 50 120 58 108 58 C96 58 86 52 84 42 Z" fill="url(#b)" ${O}/>
    <path d="M112 50 Q118 54 124 46" fill="#2a1410" ${O2}/>
    <circle cx="118" cy="42" r="2" fill="${INK}"/>
    ` + eye(104, 38, 4, 5, INK, c.glow));
}

function humanoid(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 110, h = 125;
  const weapon = o.weapon === 'lance' ? `<path d="M86 22 L98 4 L96 26 Z" fill="${c.light}" ${O2}/><path d="M94 22 L74 108" ${O}/>`
    : o.weapon === 'staff' ? `<path d="M88 108 L94 30" ${O}/><circle cx="94" cy="26" r="8" fill="${c.glow || c.accent}" ${O2}/>`
    : o.weapon === 'blade' ? `<path d="M84 70 L104 18 L108 22 L90 74 Z" fill="${c.light}" ${O2}/><path d="M80 72 L92 76" ${O}/>`
    : '';
  const halo = o.halo ? `<ellipse cx="55" cy="10" rx="16" ry="4" fill="none" stroke="${c.glow || '#ffe89a'}" stroke-width="3"/>` : '';
  const wings = o.wings ? `<path d="M40 50 C20 34 4 40 2 56 C10 54 16 58 18 66 C24 60 32 60 40 64 Z M70 50 C90 34 106 40 108 56 C100 54 94 58 92 66 C86 60 78 60 70 64 Z" fill="${c.light}" ${O2}/>` : '';
  const hood = o.hood ? `<path d="M36 34 C36 14 74 14 74 34 L72 46 L38 46 Z" fill="${c.dark}" ${O2}/>` : `<circle cx="55" cy="32" r="15" fill="url(#s)" ${O}/>`;
  const face = o.hood ? '' : `<path d="M44 40 Q55 46 66 40" fill="none" ${O2}/>`;
  const cape = o.cape ? `<path d="M38 54 C24 70 18 100 14 118 L96 118 C92 100 86 70 72 54 Z" fill="${c.accent}" opacity="0.9" ${O2}/>` : '';
  const horns = o.horns ? `<path d="M38 26 C26 20 22 8 26 2 C30 12 36 16 42 20 Z M72 26 C84 20 88 8 84 2 C80 12 74 16 68 20 Z" fill="${c.light}" ${O2}/>` : '';
  const crown = o.crown ? `<path d="M40 22 L42 8 L48 16 L55 4 L62 16 L68 8 L70 22 Z" fill="${c.accent}" ${O2}/><circle cx="55" cy="12" r="2.5" fill="${c.glow || '#fff3a0'}"/>` : '';
  const pauldrons = o.armor ? `<path d="M28 58 C30 48 44 46 46 54 L40 66 C34 66 30 64 28 58 Z M82 58 C80 48 66 46 64 54 L70 66 C76 66 80 64 82 58 Z" fill="${c.light}" ${O2}/>` : '';
  return scaled(k, w, h, w / 2, h - 5, rg('s', c.light, c.main) + lg('r', c.main, c.dark), `
    ${cape}${wings}${weapon}
    <path d="M40 104 L36 120 L48 120 L50 104 Z M60 104 L62 120 L74 120 L70 104 Z" fill="${c.dark}" ${O2}/>
    <path d="M30 108 C30 76 36 52 55 50 C74 52 80 76 80 108 Q55 114 30 108 Z" fill="url(#r)" ${O}/>
    <path d="M42 60 L55 104 L68 60" fill="none" stroke="${c.accent}" stroke-width="3"/>
    <path d="M32 62 C22 72 20 86 24 96 L32 94 C30 84 32 76 38 70 Z M78 62 C88 72 90 86 86 96 L78 94 C80 84 78 76 72 70 Z" fill="url(#r)" ${O2}/>
    <circle cx="27" cy="97" r="5" fill="${c.light}" ${O2}/><circle cx="83" cy="97" r="5" fill="${c.light}" ${O2}/>
    ${pauldrons}${hood}${horns}${crown}${face}${halo}
    ` + (o.hood ? eye(49, 34, 3, 2.5, INK, c.glow || '#bfe3ff') + eye(61, 34, 3, 2.5, INK, c.glow || '#bfe3ff') : eye(49, 30, 3.5, 4, INK, c.glow) + eye(61, 30, 3.5, 4, INK, c.glow)));
}

function serpent(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 130, h = 110, heads = o.heads || 1;
  const head = (x, y, flip) => `<path d="M${x} ${y + 30} C${x - 6} ${y + 14} ${x} ${y} ${x + (flip ? -12 : 12)} ${y - 4}" fill="none" stroke="url(#b)" stroke-width="14" stroke-linecap="round"/>
    <path d="M${x + (flip ? -12 : 12)} ${y - 4} C${x + (flip ? -28 : 28)} ${y - 10} ${x + (flip ? -34 : 34)} ${y} ${x + (flip ? -30 : 30)} ${y + 8} C${x + (flip ? -20 : 20)} ${y + 12} ${x + (flip ? -10 : 10)} ${y + 8} ${x + (flip ? -6 : 6)} ${y + 4} Z" fill="url(#b)" ${O2}/>
    <path d="M${x + (flip ? -30 : 30)} ${y + 6} L${x + (flip ? -22 : 22)} ${y + 6}" stroke="${INK}" stroke-width="2"/>
    <circle cx="${x + (flip ? -18 : 18)}" cy="${y - 2}" r="3" fill="${c.glow || '#fff3a0'}" stroke="${INK}" stroke-width="1.5"/>`;
  const heads3 = heads === 3 ? head(36, 22, true) + head(84, 22, false) + head(60, 10, false) : head(60, 18, false);
  return scaled(k, w, h, w / 2, h - 6, rg('b', c.light, c.dark), `
    <path d="M10 98 C4 76 26 64 48 72 C66 78 84 62 106 70 C124 76 126 98 108 102 Q60 110 10 98 Z" fill="url(#b)" ${O}/>
    <path d="M30 84 C40 74 56 90 70 80 C80 72 92 78 98 86" fill="none" stroke="${c.light}" stroke-width="3" opacity="0.6"/>
    <path d="M22 92 Q60 100 104 92" stroke="${c.accent}" stroke-width="3" fill="none" stroke-dasharray="6 6"/>
    ${o.fins ? `<path d="M40 80 L46 66 L54 80 M66 82 L72 68 L80 82" fill="${c.accent}" ${O2}/>` : ''}
    ${heads3}
    `);
}

function insect(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 110, h = 86;
  return scaled(k, w, h, w / 2, h - 6, rg('b', c.light, c.dark, 0.4, 0.3), `
    <path d="M30 60 L14 74 M36 66 L24 82 M74 66 L86 82 M80 60 L96 74 M44 68 L40 82 M66 68 L70 82" ${O}/>
    ${o.wings ? `<ellipse cx="38" cy="34" rx="22" ry="12" fill="${c.light}" opacity="0.55" ${O2} transform="rotate(-20 38 34)"/><ellipse cx="72" cy="34" rx="22" ry="12" fill="${c.light}" opacity="0.55" ${O2} transform="rotate(20 72 34)"/>` : ''}
    <ellipse cx="55" cy="56" rx="32" ry="20" fill="url(#b)" ${O}/>
    <path d="M55 36 L55 76" stroke="${c.dark}" stroke-width="2.5"/>
    <path d="M32 50 Q44 46 52 50 M58 50 Q66 46 78 50" stroke="${c.accent}" stroke-width="2.5" fill="none"/>
    <circle cx="86" cy="56" r="12" fill="url(#b)" ${O2}/>
    <path d="M94 48 C102 40 108 42 110 46 M94 52 C104 50 108 54 108 58" fill="none" ${O2}/>
    ${o.horn ? `<path d="M90 46 L104 24 L98 48 Z" fill="${c.accent}" ${O2}/>` : ''}
    ` + eye(88, 54, 3.5, 4, INK, c.glow));
}

function golem(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 130, h = 130;
  const shield = o.shield ? `<path d="M96 56 C112 58 118 76 112 96 C106 106 96 108 92 104 Z" fill="${c.light}" ${O}/><path d="M100 66 L106 92" stroke="${c.accent}" stroke-width="3"/>` : '';
  const core = `<circle cx="65" cy="66" r="9" fill="${c.glow || c.accent}" ${O2}/><circle cx="65" cy="66" r="4" fill="#fff8ea"/>`;
  return scaled(k, w, h, w / 2, h - 5, lg('r', c.light, c.dark, 1, 1), `
    <path d="M40 104 L36 124 L56 124 L56 104 Z M74 104 L74 124 L94 124 L90 104 Z" fill="${c.dark}" ${O2}/>
    <path d="M26 50 L18 92 L34 96 L40 58 Z M104 50 L112 92 L96 96 L90 58 Z" fill="url(#r)" ${O}/>
    <path d="M30 48 L36 106 L94 106 L100 48 L82 38 L48 38 Z" fill="url(#r)" ${O}/>
    <path d="M44 56 L58 50 M72 82 L86 76 M40 90 L52 96" stroke="${c.dark}" stroke-width="2.5"/>
    ${core}${shield}
    <path d="M48 20 L82 20 L86 40 L44 40 Z" fill="url(#r)" ${O}/>
    ${o.crown ? `<path d="M46 20 L50 6 L58 16 L65 2 L72 16 L80 6 L84 20 Z" fill="${c.accent}" ${O2}/>` : ''}
    <path d="M52 30 L60 30 M70 30 L78 30" stroke="${c.glow || '#ffcf5a'}" stroke-width="4" stroke-linecap="round"/>
    `);
}

function floater(c, o = {}) {
  const k = o.boss ? 2 : 1, w = 100, h = 110;
  const tentacles = Array.from({ length: 5 }, (_, i) => `<path d="M${30 + i * 10} 64 C${26 + i * 10} 78 ${36 + i * 10} 86 ${30 + i * 10} 100" fill="none" stroke="${c.accent}" stroke-width="4" stroke-linecap="round"/>`).join('');
  const ring = o.ring ? `<ellipse cx="50" cy="44" rx="44" ry="10" fill="none" stroke="${c.glow || c.accent}" stroke-width="3" opacity="0.8"/>` : '';
  return scaled(k, w, h, w / 2, h - 4, rg('b', c.light, c.dark, 0.4, 0.3), `
    ${o.tentacles !== false ? tentacles : ''}
    <path d="M14 56 C10 24 34 8 50 8 C66 8 90 24 86 56 C80 66 20 66 14 56 Z" fill="url(#b)" ${O}/>
    ${ring}
    <ellipse cx="38" cy="24" rx="7" ry="4" fill="#fff" opacity="0.5"/>
    ` + eye(50, 40, 10, 11, INK, c.glow));
}

function plant(c, o = {}) {
  const w = 100, h = 110;
  return { w, h, ax: 50, ay: 104, svg: S(w, h, rg('b', c.light, c.dark) + lg('l', c.accent, c.dark), `
    <path d="M20 104 C18 92 30 86 50 86 C70 86 82 92 80 104 Z" fill="#4a3426" ${O2}/>
    <path d="M50 88 C46 70 52 60 50 50" fill="none" stroke="${c.dark}" stroke-width="6" stroke-linecap="round"/>
    <path d="M48 76 C30 70 20 78 18 86 C30 86 40 84 48 80 Z M52 70 C70 62 82 70 84 78 C72 80 60 78 52 74 Z" fill="url(#l)" ${O2}/>
    <path d="M22 40 C18 18 40 8 50 8 C60 8 82 18 78 40 C76 56 24 56 22 40 Z" fill="url(#b)" ${O}/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${26 + i * 10} 14 L${30 + i * 10} 2 L${34 + i * 10} 14" fill="${c.accent}" ${O2}/>`).join('')}
    <ellipse cx="50" cy="38" rx="16" ry="11" fill="#2a1410" ${O2}/>
    <ellipse cx="50" cy="38" rx="8" ry="5" fill="${c.glow || '#ffcf5a'}"/>`) };
}

// Tesla pylon: a lightning rod the titan plants in the ground.
function pylon() {
  return { w: 70, h: 150, ax: 35, ay: 144, svg: S(70, 150, lg('m', '#a8c0de', '#2a3442'), `
    <ellipse cx="35" cy="144" rx="28" ry="7" fill="#1a1f26"/>
    <path d="M14 144 L20 120 L50 120 L56 144 Z" fill="#3a4250" ${O}/>
    <path d="M26 120 L30 30 L40 30 L44 120 Z" fill="url(#m)" ${O}/>
    <path d="M18 70 L52 70 M20 96 L50 96 M22 46 L48 46" stroke="#ffe65a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="35" cy="22" r="12" fill="#fff07a" ${O2}/><circle cx="35" cy="22" r="5" fill="#ffffff"/>
    <path d="M22 10 L14 2 M48 10 L56 2 M35 6 L35 -2" stroke="#fff07a" stroke-width="3" stroke-linecap="round"/>`) };
}

// --------------------------------------------------------------------- the zone bestiary

// ------------------------------------------------------------------ special dungeon bosses (v6)
// A great dragon: spread wings, long neck, horned head, tail. c: { main, light, dark, accent, glow, belly }
// o.wrath: lava cracks and a burning mane · o.prophecy: star scales, crystal horns and an eye on the brow
function greatDragon(c, o = {}) {
  const w = 300, h = 220;
  const cracks = o.wrath ? `<path d="M96 120 L110 132 L104 146 M150 112 L160 126 L176 128 M196 132 L186 148" stroke="${c.glow}" stroke-width="3" fill="none" opacity="0.95"/>
    <path d="M96 120 L110 132 L104 146 M150 112 L160 126 L176 128 M196 132 L186 148" stroke="#fff3c4" stroke-width="1" fill="none"/>` : '';
  const stars = o.prophecy ? [[100, 118], [126, 104], [150, 126], [176, 110], [204, 128], [138, 142], [118, 134]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.8 : 2.8}" fill="#ffffff" opacity="0.9"/>`).join('') +
    `<path d="M100 118 L126 104 L150 126 L176 110 L204 128" stroke="${c.glow}" stroke-width="0.9" fill="none" opacity="0.6"/>` : '';
  const mane = o.wrath ? `<path d="M206 70 C200 52 212 40 222 46 C222 34 236 30 242 40 C250 32 262 40 258 52 C266 56 262 70 252 70 Z" fill="${c.glow}" ${O2}/><path d="M214 66 C214 56 222 52 228 56 C232 48 242 50 242 60" stroke="#fff3c4" stroke-width="2" fill="none"/>` : '';
  const horns = o.prophecy
    ? `<path d="M238 44 L246 10 L252 42 Z M226 46 L224 16 L234 42 Z" fill="${c.accent}" ${O2}/><path d="M246 14 L248 36" stroke="#ffffff" stroke-width="1.4"/>`
    : `<path d="M236 46 C238 26 250 16 262 14 C254 22 250 32 248 48 Z M224 48 C220 32 226 20 234 16 C230 26 232 36 234 48 Z" fill="${c.accent}" ${O2}/><path d="M258 16 L252 22" stroke="${c.dark}" stroke-width="2"/>`;
  const brow = o.prophecy ? `<ellipse cx="252" cy="58" rx="7" ry="4" fill="${c.glow}" ${O2}/><circle cx="252" cy="58" r="2.2" fill="${INK}"/><circle cx="251" cy="57" r="0.9" fill="#fff"/>` : '';
  const wingFill = o.prophecy ? 'url(#wgp)' : 'url(#wg)';
  const wing = (dx, flip, tone) => `<g transform="translate(${dx} 0) ${flip ? 'scale(-1 1) translate(-300 0)' : ''}" opacity="${tone}">
      <path d="M150 96 C130 52 96 22 46 12 C58 30 60 44 54 58 C46 52 34 52 24 58 C38 66 42 80 38 94 C28 92 18 96 12 104 C40 110 70 118 104 126 C124 122 142 112 150 96 Z" fill="${wingFill}" ${O}/>
      <path d="M150 96 C120 70 90 40 46 12 M150 96 C110 82 80 70 54 58 M150 96 C110 96 70 96 38 94" stroke="${c.dark}" stroke-width="3" fill="none"/>
      <path d="M46 12 L40 4 M54 58 L48 50 M38 94 L30 88" stroke="${c.light}" stroke-width="3" stroke-linecap="round"/></g>`;
  const defs = rg('db', c.light, c.dark, 0.45, 0.3, 0.8) + lg('dl', c.main, c.dark) + lg('wg', c.main, c.dark, 1, 1) + lg('bl', c.belly || c.light, c.main) +
    `<linearGradient id="wgp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.main}"/><stop offset="0.6" stop-color="${c.dark}"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0.8"/></linearGradient>`;
  return { w, h, ax: w / 2, ay: h - 8, svg: S(w, h, defs, `
    ${wing(-8, false, 0.85)}
    <path d="M70 150 C40 150 18 140 8 120 C24 128 40 130 56 126 C40 120 30 110 28 98 C44 112 62 120 84 122 Z" fill="url(#dl)" ${O}/>
    ${o.wrath ? `<path d="M8 120 C2 110 4 98 12 92 C12 102 16 108 22 112 Z" fill="${c.glow}" ${O2}/>` : `<path d="M8 120 L-2 118 L6 110 Z" fill="${c.accent}" ${O2}/>`}
    <path d="M100 160 L92 206 L112 206 L120 164 Z M190 160 L196 206 L216 206 L208 158 Z" fill="url(#dl)" ${O}/>
    <path d="M92 206 l-4 6 M100 206 l0 7 M108 206 l4 6 M196 206 l-4 6 M204 206 l0 7 M212 206 l4 6" stroke="${c.accent}" stroke-width="3" stroke-linecap="round"/>
    <path d="M78 130 C78 96 120 84 160 86 C200 88 226 100 226 132 C226 160 196 172 154 172 C110 172 78 160 78 130 Z" fill="url(#db)" ${O}/>
    <path d="M102 150 C130 164 176 166 206 150 C200 160 180 168 154 168 C128 168 110 162 102 150 Z" fill="url(#bl)" opacity="0.9"/>
    <path d="M110 92 L114 80 L120 90 L126 76 L132 88 L140 74 L146 88 L154 76 L160 90" fill="${c.accent}" ${O2}/>
    ${cracks}${stars}
    <path d="M196 106 C206 84 214 70 226 60 L246 72 C234 82 226 98 218 120 Z" fill="url(#db)" ${O}/>
    ${mane}
    <path d="M222 52 C236 38 264 40 278 54 C290 66 286 80 270 82 L246 84 C232 82 220 72 222 52 Z" fill="url(#db)" ${O}/>
    <path d="M262 76 L286 72 C288 80 280 88 268 88 Z" fill="${c.dark}" ${O2}/>
    <path d="M266 78 l3 6 l3 -6 l3 6 l3 -6" fill="#fff8ea" stroke="${INK}" stroke-width="1"/>
    ${horns}${brow}
    <circle cx="280" cy="64" r="2" fill="${INK}"/>
    ${eye(256, 64, 5, 4, INK, c.glow)}
    ${wing(12, false, 1)}
    `) };
}

// The God of Judgment: tall, robed, blindfolded, six wings, a halo of scales and a great verdict blade.
function judgeGod(c) {
  const w = 260, h = 270;
  const wingSet = [[-1, 0], [-1, 1], [-1, 2]].map(([, i]) => {
    const y = 70 + i * 34, len = 110 - i * 18;
    return `<path d="M120 ${y} C${120 - len * 0.5} ${y - 50 + i * 8} ${120 - len} ${y - 30 + i * 6} ${120 - len - 10} ${y + 8} C${120 - len * 0.7} ${y - 4} ${120 - len * 0.4} ${y + 8} 120 ${y + 22} Z" fill="url(#jw)" ${O2}/>
      <path d="M140 ${y} C${140 + len * 0.5} ${y - 50 + i * 8} ${140 + len} ${y - 30 + i * 6} ${140 + len + 10} ${y + 8} C${140 + len * 0.7} ${y - 4} ${140 + len * 0.4} ${y + 8} 140 ${y + 22} Z" fill="url(#jw)" ${O2}/>`;
  }).join('');
  return { w, h, ax: w / 2, ay: h - 6, svg: S(w, h, rg('jr', c.light, c.main, 0.5, 0.25, 0.85) + lg('jw', '#ffffff', c.main) + lg('jc', c.accent, c.dark), `
    ${wingSet}
    <ellipse cx="130" cy="36" rx="46" ry="12" fill="none" stroke="${c.glow}" stroke-width="5"/>
    <ellipse cx="130" cy="36" rx="46" ry="12" fill="none" stroke="#fffaf0" stroke-width="1.6"/>
    <path d="M84 36 L76 50 L92 50 Z M176 36 L168 50 L184 50 Z" fill="${c.accent}" ${O2}/>
    <path d="M84 50 L84 56 M176 50 L176 56" stroke="${c.accent}" stroke-width="2"/>
    <path d="M86 262 C86 190 96 118 130 108 C164 118 174 190 174 262 Z" fill="url(#jr)" ${O}/>
    <path d="M104 262 C106 200 114 140 130 124 C146 140 154 200 156 262" fill="none" stroke="${c.accent}" stroke-width="3"/>
    <path d="M118 150 L130 166 L142 150 L130 186 Z" fill="${c.glow}" ${O2}/>
    <path d="M96 126 C78 140 74 170 80 196 L92 192 C88 172 92 154 104 140 Z M164 126 C182 140 186 170 180 196 L168 192 C172 172 168 154 156 140 Z" fill="url(#jr)" ${O2}/>
    <path d="M194 40 L202 34 L208 222 L198 222 Z" fill="url(#jc)" ${O2}/>
    <path d="M182 220 L222 220 L220 230 L184 230 Z" fill="${c.accent}" ${O2}/>
    <path d="M203 38 L203 216" stroke="#ffffff" stroke-width="1.4" opacity="0.8"/>
    <circle cx="202" cy="32" r="8" fill="${c.glow}" ${O2}/>
    <circle cx="180" cy="196" r="7" fill="${c.light}" ${O2}/>
    <circle cx="130" cy="84" r="22" fill="url(#jr)" ${O}/>
    <path d="M108 80 L152 80 L152 90 L108 90 Z" fill="${c.dark}" ${O2}/>
    <path d="M112 85 L148 85" stroke="${c.glow}" stroke-width="1.6"/>
    <path d="M118 98 Q130 104 142 98" fill="none" ${O2}/>
    <path d="M108 72 C110 58 150 58 152 72" fill="${c.accent}" ${O2}/>
    `) };
}

export const ZONE_ART = Object.freeze({
  // 1 Gale Meadow
  z_gust_sprite: () => floater({ main: '#9fd6c4', light: '#e6fff6', dark: '#3f8a78', accent: '#cdf3e6', glow: '#ffffff' }, { tentacles: false, ring: true }),
  z_seed_spitter: () => plant({ main: '#6f9a4a', light: '#d6ef8a', dark: '#3f612b', accent: '#e8c34a', glow: '#ffcf5a' }),
  z_storm_roc: () => bird({ main: '#8aa6c8', light: '#d9e8f6', dark: '#34465e', accent: '#f5d48a', glow: '#bfe3ff' }, { boss: true, crest: true }),
  // 2 Frost Crystal Cave
  z_frost_slime: () => blob({ main: '#8fd0f0', light: '#e2f6ff', dark: '#3a7aa8', accent: '#bfe8ff' }, { crystals: true }),
  z_frost_mote: () => blob({ main: '#a8dcf4', light: '#f2fbff', dark: '#4a8ab8', accent: '#bfe8ff' }, { crystals: true }),
  z_ice_archer: () => humanoid({ main: '#5f8fb8', light: '#d6ecff', dark: '#24384e', accent: '#bfe8ff', glow: '#bfe8ff' }, { hood: true, weapon: 'lance' }),
  z_glacier_wyrm: () => serpent({ main: '#8fc4e8', light: '#e8f8ff', dark: '#2f5a80', accent: '#ffffff', glow: '#bfe8ff' }, { boss: true, fins: true }),
  // 3 Venom Marsh
  z_bog_toad: () => blob({ main: '#6a8a3a', light: '#b8d070', dark: '#2e4220', accent: '#c27ff0' }, { fangs: false }),
  z_spore_puff: () => floater({ main: '#b07ad0', light: '#ecd2ff', dark: '#5a2f78', accent: '#d6a4f0', glow: '#e8ff9a' }, { tentacles: false }),
  z_hydra_mire: () => serpent({ main: '#5a8a4a', light: '#b8e08a', dark: '#24401e', accent: '#c27ff0', glow: '#e8ff9a' }, { boss: true, heads: 3, fins: true }),
  // 4 Shadow Ruins
  z_shade_stalker: () => humanoid({ main: '#3a3450', light: '#6a6090', dark: '#151222', accent: '#9a8ad0', glow: '#c27ff0' }, { hood: true, weapon: 'blade' }),
  z_bone_lancer: () => humanoid({ main: '#c8bca0', light: '#f3ead2', dark: '#6a604a', accent: '#8e2c21' }, { weapon: 'lance', armor: true }),
  z_umbral_knight: () => humanoid({ main: '#2a2438', light: '#5a4f80', dark: '#0e0b16', accent: '#4a2f78', glow: '#e0b0ff' }, { boss: true, hood: true, horns: true, armor: true, cape: true, weapon: 'blade' }),
  // 5 Sunscorch Dunes
  z_sand_burrower: () => insect({ main: '#c8a060', light: '#f0d89a', dark: '#6a4a24', accent: '#8a5a2a' }, { horn: true }),
  z_scarab: () => insect({ main: '#2f6a6a', light: '#7fd0c0', dark: '#123030', accent: '#f5d48a', glow: '#ffcf5a' }, { wings: true }),
  z_sphinx_colossus: () => golem({ main: '#c8a46a', light: '#f3dca0', dark: '#6a5030', accent: '#3f8fb0', glow: '#7fe8ff' }, { boss: true, crown: true }),
  // 6 Glowcap Grove
  z_cap_bouncer: () => blob({ main: '#d06a8a', light: '#ffd0e0', dark: '#6a2a40', accent: '#ff7aa8' }, { cap: true }),
  z_mycel_weaver: () => insect({ main: '#6a5aa8', light: '#c8b8ff', dark: '#2a2050', accent: '#9fffd8', glow: '#9fffd8' }, {}),
  z_mother_morel: () => floater({ main: '#a86ad0', light: '#f0d0ff', dark: '#4a2470', accent: '#9fffd8', glow: '#9fffd8' }, { boss: true, ring: true }),
  // 7 Thunder Foundry
  z_volt_drone: () => floater({ main: '#5a6a80', light: '#c8d8ea', dark: '#232c38', accent: '#ffe65a', glow: '#fff07a' }, { tentacles: false, ring: true }),
  z_iron_brute: () => golem({ main: '#6a6f78', light: '#b8c0cc', dark: '#2a2e34', accent: '#ffcf5a', glow: '#ffe65a' }, { shield: true }),
  z_pylon: pylon,
  z_tesla_titan: () => golem({ main: '#4a5a70', light: '#a8c0de', dark: '#1a2230', accent: '#ffe65a', glow: '#7fe8ff' }, { boss: true, crown: false, shield: false }),
  // 8 Magma Rift
  z_magma_hound: () => beast({ main: '#6a2a1e', light: '#c4492e', dark: '#2a100c', accent: '#ff8a3d', glow: '#ffcf5a' }, { tailFire: true, spikes: true }),
  z_cinder_mortar: () => golem({ main: '#5a4a44', light: '#9a847a', dark: '#241c18', accent: '#ff7a33', glow: '#ff8a3d' }, {}),
  z_rift_drake: () => beast({ main: '#8e2c21', light: '#e0593f', dark: '#3a100c', accent: '#ffb35a', glow: '#ffe89a' }, { boss: true, horns: true, spikes: true, tailFire: true }),
  // 9 Sky Gardens
  z_feather_monk: () => humanoid({ main: '#e8e0c8', light: '#ffffff', dark: '#8a7a5a', accent: '#5fa8ec', glow: '#bfe3ff' }, { wings: true, weapon: 'staff' }),
  z_egypt_glyph: () => humanoid({ main: '#c8a466', light: '#f2dca0', dark: '#7a5c34', accent: '#e0b45a', glow: '#fff3c4' }, { wings: false, weapon: 'staff' }),
  z_egypt_warden: () => humanoid({ main: '#d8b878', light: '#fff3c4', dark: '#7a5c34', accent: '#7fe8ff', glow: '#e8f6ff' }, { wings: false, weapon: 'staff' }),
  z_egypt_warden2: () => humanoid({ main: '#c8a466', light: '#f2dca0', dark: '#5a4a2a', accent: '#7fe8ff', glow: '#e8f6ff' }, { wings: false, weapon: 'staff' }),
  z_egypt_warden3: () => humanoid({ main: '#c8643a', light: '#ffcf5a', dark: '#6a2a1c', accent: '#ff5a3a', glow: '#ffcf5a' }, { wings: false, weapon: 'staff' }),
  z_egypt_warden_secret: () => humanoid({ main: '#2a2238', light: '#ffcf5a', dark: '#120c18', accent: '#ffcf5a', glow: '#ffffff' }, { wings: false, weapon: 'staff' }),
  z_cloud_ray: () => bird({ main: '#a8c8e8', light: '#f4faff', dark: '#4a6a8a', accent: '#ffe65a', glow: '#ffffff' }, {}),
  z_seraph_warden: () => humanoid({ main: '#f3e6c8', light: '#ffffff', dark: '#8f6f37', accent: '#e0b45a', glow: '#fff3a0' }, { boss: true, wings: true, halo: true, armor: true, weapon: 'lance' }),
  // 10 Ashen Throne
  z_ash_revenant: () => humanoid({ main: '#4a4440', light: '#8a827a', dark: '#1a1614', accent: '#c2412f', glow: '#ff8a3d' }, { hood: true, weapon: 'blade' }),
  z_cinder_mage: () => humanoid({ main: '#5a2a24', light: '#b0503a', dark: '#200c0a', accent: '#ffb35a', glow: '#ffcf5a' }, { hood: true, weapon: 'staff' }),
  z_ash_sovereign: () => humanoid({ main: '#3a2a24', light: '#8a5a44', dark: '#120a08', accent: '#8e2c21', glow: '#ff8a3d' }, { boss: true, crown: true, armor: true, cape: true, weapon: 'blade' }),
  // special dungeons
  // v8 lands
  z_mirror_wisp: () => floater({ main: '#b8d8f0', light: '#ffffff', dark: '#4a6a90', accent: '#e8f4ff', glow: '#7fe8ff' }, { tentacles: false, ring: true }),
  z_glass_golem: () => golem({ main: '#7a9ab8', light: '#d8ecff', dark: '#2a3a50', accent: '#bfe8ff', glow: '#7fe8ff' }, {}),
  z_mirror_image: () => humanoid({ main: '#c8e0f4', light: '#ffffff', dark: '#6a8aa8', accent: '#7fe8ff', glow: '#bfe8ff' }, { hood: true, weapon: 'blade' }),
  z_mirror_queen: () => humanoid({ main: '#9ab8d8', light: '#f4faff', dark: '#3a4a68', accent: '#b88aff', glow: '#7fe8ff' }, { boss: true, crown: true, cape: true, weapon: 'blade' }),
  z_eclipse_hound: () => beast({ main: '#2a2238', light: '#5a4a78', dark: '#0e0a16', accent: '#ffb648', glow: '#ffd27a' }, { horns: true, tailFire: true }),
  z_corona_priest: () => humanoid({ main: '#7a3a1a', light: '#e0a050', dark: '#2a1208', accent: '#ffd27a', glow: '#fff3c4' }, { hood: true, weapon: 'staff', halo: true }),
  z_eclipse_king: () => humanoid({ main: '#2a2238', light: '#6a5a88', dark: '#0e0a16', accent: '#ffb648', glow: '#ffd27a' }, { boss: true, crown: true, armor: true, cape: true, weapon: 'lance' }),
  z_rush_shadow: () => humanoid({ main: '#14101c', light: '#3a3050', dark: '#05030a', accent: '#ffb648', glow: '#ffb648' }, { boss: true, hood: true, horns: true, armor: true, cape: true, weapon: 'blade' }),
  r_wrath_dragon: () => greatDragon({ main: '#4a120c', light: '#9a2a1a', dark: '#1a0606', accent: '#2a0e0a', glow: '#ff5a1a', belly: '#c2412f' }, { wrath: true }),
  r_prophecy_dragon: () => greatDragon({ main: '#26305a', light: '#5a70b0', dark: '#0c1028', accent: '#bfe8ff', glow: '#7fe8ff', belly: '#9fb8ff' }, { prophecy: true }),
  r_judgment_god: () => judgeGod({ main: '#d8ccb0', light: '#fffaf0', dark: '#4a3a2a', accent: '#f5c35a', glow: '#fff3a0' }),
  r_anubis: () => judgeGod({ main: '#2a3048', light: '#1a2438', dark: '#e0b45a', accent: '#7fe8ff', glow: '#e8f6ff' }),
  r_sekhmet: () => judgeGod({ main: '#c8643a', light: '#8a3a1c', dark: '#e0b45a', accent: '#ff5a3a', glow: '#ffcf5a' }),
  r_ra_god: () => judgeGod({ main: '#f0d27a', light: '#e0b45a', dark: '#fff3c4', accent: '#ffcf5a', glow: '#ffffff' }),
  // v7: the beast and machine bosses, redrawn in more detail (art/bossArt.js)
  ...BOSS_ART,
});
