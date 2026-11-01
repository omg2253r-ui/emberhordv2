// Boss illustrations, second edition: the land bosses that are beasts and machines, redrawn with more detail
// (feathers, scales, ice crystals, runes, glowing cores) in the game's ink-outline style. The humanoid bosses are
// jointed fighters (art/rig.js). Each returns { svg, w, h, ax, ay } with the anchor between the feet.
import { INK } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b, cx = 0.4, cy = 0.35, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const lg = (id, a, b, x2 = 0, y2 = 1, mid = null) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/>${mid ? `<stop offset="0.5" stop-color="${mid}"/>` : ''}<stop offset="1" stop-color="${b}"/></linearGradient>`;
const glow = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const eyeGlow = (x, y, r, c, slit = false) => `<circle cx="${x}" cy="${y}" r="${r * 2.8}" fill="url(#eg)" opacity="0.85"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${c}" ${O2}/>${slit ? `<ellipse cx="${x}" cy="${y}" rx="${r * 0.25}" ry="${r * 0.7}" fill="${INK}"/>` : `<circle cx="${x - r * 0.25}" cy="${y - r * 0.25}" r="${r * 0.35}" fill="#ffffff"/>`}`;
const bolt = (x, y, s, c) => `<path d="M${x} ${y} l${6 * s} ${10 * s} l${-4 * s} ${2 * s} l${8 * s} ${12 * s}" fill="none" stroke="${c}" stroke-width="${2.6 * s}" stroke-linejoin="round" stroke-linecap="round"/>`;
const spec = (w, h, ax, ay, defs, body) => ({ w, h, ax, ay, svg: S(w, h, defs, body) });

// ราชันนกพายุ — wings spread wide, layered feathers, lightning at the tips
function stormRoc() {
  // one wing (left side); the right wing is its mirror image
  const wing = `<path d="M92 104 C70 64 34 40 4 44 C14 52 18 58 16 66 C4 70 0 80 2 88 C14 86 22 90 22 98 C12 102 10 110 12 118 C26 112 38 114 44 120 C38 126 38 134 42 138 C58 128 76 124 96 128 Z" fill="url(#wf)" ${O}/>
    <path d="M90 108 C72 80 46 62 22 58 M86 114 C66 96 40 84 14 82 M84 120 C64 110 42 104 18 104 M86 126 C70 122 56 122 44 128" stroke="#2a3a52" stroke-width="2.2" fill="none"/>
    <path d="M92 104 C82 86 70 74 54 66 C62 80 66 92 70 104 C62 100 52 98 44 98 C56 106 66 112 74 118 Z" fill="url(#wc)" ${O2}/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${60 - i * 8} ${80 + i * 3} q4 6 10 4" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.6"/>`).join('')}
    <path d="M10 48 C30 46 52 56 70 72" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.55"/>`;
  return spec(240, 220, 120, 204, rg('bd', '#e8f2ff', '#5a7698', 0.45, 0.3) + lg('wf', '#d9e8f6', '#34465e', 1, 1, '#8aa6c8') + lg('wc', '#f2f8ff', '#6a86a8', 1, 1) + glow('eg', '#9fe0ff') + lg('gd', '#fff3c4', '#c8902a'),
    `<g>${wing}</g><g transform="translate(240,0) scale(-1,1)">${wing}</g>
     ${bolt(14, 26, 1.2, '#fff07a')}${bolt(210, 24, 1.2, '#fff07a')}${bolt(2, 96, 0.9, '#bfe3ff')}${bolt(224, 92, 0.9, '#bfe3ff')}
     <path d="M100 186 L94 202 M106 188 L104 204 M134 188 L136 204 M140 186 L146 202" stroke="url(#gd)" stroke-width="5" stroke-linecap="round"/>
     <path d="M100 186 L94 202 M106 188 L104 204 M134 188 L136 204 M140 186 L146 202" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>
     <path d="M86 112 C84 82 100 66 120 66 C140 66 156 82 154 112 C152 152 140 184 120 188 C100 184 88 152 86 112 Z" fill="url(#bd)" ${O}/>
     ${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<path d="M${104 + c * 11 - (r % 2) * 5} ${110 + r * 16} q5.5 8 11 0" fill="none" stroke="#7a94b4" stroke-width="2"/>`).join('')).join('')}
     <path d="M96 92 C98 80 106 74 112 72" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"/>
     <path d="M98 58 C96 38 108 26 120 26 C134 26 146 38 142 58 C140 70 100 70 98 58 Z" fill="url(#bd)" ${O}/>
     <path d="M104 30 C96 12 108 2 114 0 C112 10 116 18 120 24 C122 12 132 4 138 6 C132 14 132 22 128 28" fill="url(#gd)" ${O2}/>
     <path d="M112 54 L120 74 L128 54 C124 50 116 50 112 54 Z" fill="url(#gd)" ${O2}/><path d="M118 70 L120 74" stroke="${INK}" stroke-width="2"/>
     ${eyeGlow(108, 46, 4.6, '#bfe3ff')}${eyeGlow(132, 46, 4.6, '#bfe3ff')}
     <path d="M100 40 L114 44 M140 40 L126 44" stroke="${INK}" stroke-width="2.6"/>`);
}

// มังกรธารน้ำแข็ง — an ice serpent rising from a frozen pool, crystal fins along its neck
function glacierWyrm() {
  const C = 'M120 200 C108 168 160 150 156 118 C152 88 116 84 122 56 C126 38 140 30 152 28';
  const fins = Array.from({ length: 6 }, (_, i) => { const t = i / 5; const x = 158 - 34 * Math.sin(t * 3.1) - t * 18, y = 172 - t * 128; return `<path d="M${x - 2} ${y} L${x - 30 - i} ${y - 18 - i * 2} L${x + 10} ${y - 10} Z" fill="url(#cr)" ${O2}/><path d="M${x - 4} ${y - 4} L${x - 22 - i} ${y - 16 - i * 2}" stroke="#ffffff" stroke-width="1.2" opacity="0.8"/>`; }).join('');
  return spec(260, 220, 130, 208, lg('bd', '#e8f8ff', '#2f5a80', 1, 0, '#8fc4e8') + lg('cr', '#ffffff', '#6aa8d8', 1, 1) + rg('ice', '#f2fbff', '#5a90b8', 0.5, 0.3, 0.8) + glow('eg', '#bfe8ff') + rg('hd', '#f2fbff', '#3a6a90', 0.4, 0.3),
    `<ellipse cx="130" cy="196" rx="124" ry="20" fill="url(#ice)" ${O}/>
     <path d="M22 196 Q130 210 238 196" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.8"/>
     ${fins}
     <path d="${C}" fill="none" stroke="${INK}" stroke-width="40" stroke-linecap="round"/>
     <path d="${C}" fill="none" stroke="url(#bd)" stroke-width="34" stroke-linecap="round"/>
     <path d="${C}" fill="none" stroke="#e8f8ff" stroke-width="10" stroke-linecap="round" stroke-dasharray="3 9" opacity="0.9" transform="translate(6 2)"/>
     <path d="M114 196 C104 170 148 152 146 122" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.6"/>
     ${[[34, 190, 18], [62, 186, 26], [200, 186, 24], [226, 192, 16], [92, 194, 14], [160, 196, 12]].map(([x, y, hgt]) => `<path d="M${x - 8} ${y} L${x - 2} ${y - hgt} L${x + 8} ${y} Z" fill="url(#cr)" ${O2}/><path d="M${x - 2} ${y - hgt + 4} L${x} ${y - 4}" stroke="#ffffff" stroke-width="1.4"/>`).join('')}
     <path d="M136 20 C146 4 176 2 198 12 C214 20 216 36 204 44 C190 52 162 52 146 44 C134 38 130 28 136 20 Z" fill="url(#hd)" ${O}/>
     <path d="M198 30 C208 32 216 40 208 46 C198 50 182 48 174 44 Z" fill="#e8f8ff" ${O2}/>
     ${[180, 188, 196, 203].map((x) => `<path d="M${x} 44 l2.5 6 l2.5 -6" fill="#ffffff" stroke="${INK}" stroke-width="1"/>`).join('')}
     <path d="M142 16 L128 -4 L154 12 Z M158 10 L154 -6 L170 8 Z" fill="url(#cr)" ${O2}/>
     <path d="M150 22 C160 16 172 14 182 16" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.7"/>
     ${eyeGlow(172, 26, 5, '#bfe8ff', true)}
     <path d="M216 34 C228 28 238 34 246 30 M214 42 C228 42 234 50 244 48" stroke="#e8f8ff" stroke-width="2.6" fill="none" opacity="0.8" stroke-linecap="round"/>`);
}

// ไฮดราแห่งบึง — five heads on long necks rising out of a poisoned mound
function hydra() {
  const neck = (x0, y0, x1, y1, bend) => `<path d="M${x0} ${y0} C${x0 + bend} ${(y0 + y1) / 2 + 20} ${x1 - bend} ${(y0 + y1) / 2 - 10} ${x1} ${y1}" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round"/><path d="M${x0} ${y0} C${x0 + bend} ${(y0 + y1) / 2 + 20} ${x1 - bend} ${(y0 + y1) / 2 - 10} ${x1} ${y1}" fill="none" stroke="url(#nk)" stroke-width="18" stroke-linecap="round"/><path d="M${x0 + 4} ${y0} C${x0 + bend + 4} ${(y0 + y1) / 2 + 20} ${x1 - bend + 4} ${(y0 + y1) / 2 - 10} ${x1 + 4} ${y1}" fill="none" stroke="#d6f0a8" stroke-width="3" stroke-dasharray="4 6" opacity="0.7"/>`;
  const head = (x, y, f, big = 1) => {
    const s = f, k = big;
    return `<g transform="translate(${x} ${y}) scale(${s * k} ${k})">
      <path d="M-12 6 C-16 -10 -4 -20 12 -20 C28 -20 40 -12 42 -2 C42 6 34 10 24 10 L4 12 C-4 12 -10 10 -12 6 Z" fill="url(#hd)" ${O}/>
      <path d="M8 2 C18 8 32 8 42 0 L40 8 C30 14 16 14 6 8 Z" fill="#2a1410" ${O2}/>
      ${[14, 22, 30].map((xx) => `<path d="M${xx} 3 l2 5 l2 -5" fill="#fff8ea" stroke="${INK}" stroke-width="0.8"/>`).join('')}
      <path d="M-8 -12 L-20 -26 L-2 -16 Z M2 -18 L-4 -32 L10 -20 Z" fill="#c27ff0" ${O2}/>
      <circle cx="16" cy="-9" r="8" fill="url(#eg)" opacity="0.85"/><ellipse cx="16" cy="-9" rx="4" ry="3.4" fill="#e8ff9a" ${O2}/><ellipse cx="16" cy="-9" rx="1" ry="2.8" fill="${INK}"/>
    </g>`;
  };
  return spec(260, 220, 130, 208, lg('nk', '#8ac060', '#2e5222', 1, 0) + rg('hd', '#b8e08a', '#3a6a2a', 0.4, 0.3) + rg('md', '#7aa85a', '#1e3618', 0.5, 0.2, 0.9) + glow('eg', '#e8ff9a') + rg('pool', '#9ad060', '#1a3010', 0.5, 0.4, 0.8),
    `<ellipse cx="130" cy="198" rx="126" ry="20" fill="url(#pool)" ${O}/>
     ${[[40, 196, 7], [70, 202, 5], [196, 200, 6], [220, 194, 4], [160, 206, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#e8ff9a" stroke-width="1.6" opacity="0.8"/>`).join('')}
     ${neck(80, 170, 36, 92, -30)}${neck(108, 160, 74, 44, -10)}${neck(152, 160, 186, 44, 10)}${neck(180, 170, 224, 92, 30)}${neck(130, 156, 130, 26, 0)}
     <path d="M28 196 C24 160 60 140 96 146 C112 132 148 132 164 146 C200 140 236 160 232 196 Q130 214 28 196 Z" fill="url(#md)" ${O}/>
     ${[[70, 160], [106, 150], [150, 150], [190, 162], [130, 176], [88, 182], [176, 184]].map(([x, y]) => `<path d="M${x - 8} ${y + 8} L${x} ${y - 10} L${x + 8} ${y + 8} Z" fill="#c27ff0" ${O2}/><path d="M${x - 1} ${y - 6} L${x + 2} ${y + 4}" stroke="#f0d0ff" stroke-width="1.4"/>`).join('')}
     <path d="M48 176 C70 162 96 162 116 168" stroke="#b8e08a" stroke-width="3" fill="none" opacity="0.6"/>
     ${head(36, 92, -1)}${head(74, 44, -1)}${head(186, 44, 1)}${head(224, 92, 1)}${head(130, 26, 1, 1.15)}`);
}

// สฟิงซ์ยักษ์ — a golden stone king: striped headdress, sun-core, carved runes
function sphinx() {
  return spec(260, 260, 130, 250, lg('st', '#f6e2a8', '#8a6a38', 1, 1, '#d8b878') + lg('dk', '#c8a46a', '#4a3418', 1, 1) + lg('bl', '#5ab0d8', '#123a5a', 0, 1) + glow('eg', '#7fe8ff') + glow('core', '#7fe8ff'),
    `<path d="M70 216 L62 248 L104 248 L106 216 Z M154 216 L156 248 L198 248 L190 216 Z" fill="url(#dk)" ${O}/>
     <path d="M66 248 L104 248 M156 248 L194 248" stroke="#f6e2a8" stroke-width="2" opacity="0.6"/>
     <path d="M40 96 L18 186 L34 200 L60 196 L72 112 Z M220 96 L242 186 L226 200 L200 196 L188 112 Z" fill="url(#st)" ${O}/>
     <path d="M14 186 C10 210 30 222 48 214 C62 206 62 192 56 186 Z M246 186 C250 210 230 222 212 214 C198 206 198 192 204 186 Z" fill="url(#dk)" ${O}/>
     ${[[26, 140], [34, 160], [230, 140], [222, 160]].map(([x, y]) => `<path d="M${x - 6} ${y} L${x + 6} ${y}" stroke="${INK}" stroke-width="2"/>`).join('')}
     <path d="M52 92 L66 222 L194 222 L208 92 L176 74 L84 74 Z" fill="url(#st)" ${O}/>
     <path d="M84 74 L96 222 M176 74 L164 222" stroke="#8a6a38" stroke-width="2" opacity="0.6"/>
     ${[110, 130, 150, 170, 190].map((y, i) => `<path d="M${74 + i * 1.5} ${y} L${186 - i * 1.5} ${y}" stroke="#a8844a" stroke-width="1.8" stroke-dasharray="${i % 2 ? '10 4 2 4' : '3 3 12 3'}"/>`).join('')}
     <circle cx="130" cy="132" r="40" fill="url(#core)" opacity="0.7"/>
     <circle cx="130" cy="132" r="22" fill="url(#bl)" ${O}/><circle cx="130" cy="132" r="13" fill="#bff6ff" ${O2}/><circle cx="126" cy="128" r="4" fill="#ffffff"/>
     ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${130 + Math.cos(a) * 25} ${132 + Math.sin(a) * 25} L${130 + Math.cos(a) * 33} ${132 + Math.sin(a) * 33}" stroke="#f6e2a8" stroke-width="3" stroke-linecap="round"/>`; }).join('')}
     <path d="M80 36 L180 36 L198 88 L62 88 Z" fill="url(#bl)" ${O}/>
     ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${84 + i * 16} 38 L${70 + i * 20} 86" stroke="#e0b45a" stroke-width="5"/>`).join('')}
     <path d="M96 30 L164 30 L170 80 L90 80 Z" fill="url(#st)" ${O}/>
     <path d="M104 50 L122 50 M138 50 L156 50" stroke="${INK}" stroke-width="3"/>
     ${eyeGlow(113, 58, 6, '#7fe8ff')}${eyeGlow(147, 58, 6, '#7fe8ff')}
     <path d="M118 72 L142 72" stroke="${INK}" stroke-width="2.4"/>
     <path d="M110 30 L118 6 L130 22 L142 6 L150 30 Z" fill="url(#bl)" ${O2}/><circle cx="130" cy="16" r="4" fill="#7fe8ff" ${O2}/>
     <path d="M100 34 C98 46 98 60 100 74" stroke="#fff8e0" stroke-width="2.6" fill="none" opacity="0.7"/>`);
}

// มารดาเห็ดราชินี — a floating mushroom queen: spotted cap, glowing ring and eye, luminous tendrils
function morel() {
  const tendril = (i) => { const x = 58 + i * 14; return `<path d="M${x} 112 C${x - 10} 140 ${x + 12} 160 ${x - 2} 196" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${x} 112 C${x - 10} 140 ${x + 12} 160 ${x - 2} 196" fill="none" stroke="url(#td)" stroke-width="5" stroke-linecap="round"/><circle cx="${x - 2}" cy="198" r="7" fill="url(#gl)"/><circle cx="${x - 2}" cy="198" r="3" fill="#e8fff4"/>`; };
  return spec(200, 220, 100, 212, rg('cap', '#f6dcff', '#5a2480', 0.4, 0.25, 0.85) + lg('td', '#c8fff0', '#3a8a78', 0, 1) + glow('gl', '#9fffd8') + glow('eg', '#9fffd8') + rg('und', '#e8c8ff', '#7a4aa0'),
    `${[0, 1, 2, 3, 4, 5].map(tendril).join('')}
     <path d="M30 104 C40 116 160 116 170 104 C160 94 40 94 30 104 Z" fill="url(#und)" ${O2}/>
     ${Array.from({ length: 13 }, (_, i) => `<path d="M${40 + i * 10} 102 L${44 + i * 10} 112" stroke="#9a6ac0" stroke-width="1.6"/>`).join('')}
     <path d="M16 100 C8 46 50 10 100 10 C150 10 192 46 184 100 C150 112 50 112 16 100 Z" fill="url(#cap)" ${O}/>
     ${[[50, 44, 11], [84, 28, 8], [124, 30, 12], [158, 56, 9], [38, 78, 6], [74, 64, 7], [140, 82, 6], [104, 54, 5]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="#fbeaff" opacity="0.9" ${O2}/>`).join('')}
     <path d="M30 70 C34 46 54 28 76 22" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.6"/>
     <ellipse cx="100" cy="86" rx="92" ry="16" fill="none" stroke="url(#gl)" stroke-width="10" opacity="0.6"/>
     <ellipse cx="100" cy="86" rx="92" ry="16" fill="none" stroke="#9fffd8" stroke-width="3"/>
     ${eyeGlow(100, 74, 12, '#9fffd8', true)}`);
}

// ไททันเทสลา — a steel titan with copper coils, an arc of lightning, and a reactor heart
function tesla() {
  const coil = (x, y) => `<rect x="${x - 12}" y="${y - 34}" width="24" height="40" rx="5" fill="url(#cu)" ${O}/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${x - 12} ${y - 28 + i * 8} L${x + 12} ${y - 24 + i * 8}" stroke="#ffd49a" stroke-width="2"/>`).join('')}<circle cx="${x}" cy="${y - 40}" r="9" fill="url(#bulb)" ${O2}/>`;
  return spec(260, 260, 130, 250, lg('st', '#c8daf0', '#1e2a3c', 1, 1, '#6a82a0') + lg('dk', '#5a6a80', '#121822', 1, 1) + lg('cu', '#ffb070', '#7a3a14', 1, 0) + glow('bulb', '#fff07a') + glow('core', '#7fe8ff') + glow('eg', '#7fe8ff'),
    `<path d="M74 214 L66 248 L108 248 L108 214 Z M152 214 L152 248 L194 248 L186 214 Z" fill="url(#dk)" ${O}/>
     <path d="M36 96 L16 184 L40 196 L64 190 L74 112 Z M224 96 L244 184 L220 196 L196 190 L186 112 Z" fill="url(#st)" ${O}/>
     <rect x="8" y="182" width="48" height="36" rx="8" fill="url(#dk)" ${O}/><rect x="204" y="182" width="48" height="36" rx="8" fill="url(#dk)" ${O}/>
     ${[18, 30, 42, 214, 226, 238].map((x) => `<path d="M${x} 188 L${x} 212" stroke="#8aa0bc" stroke-width="2"/>`).join('')}
     <path d="M54 90 L66 220 L194 220 L206 90 L176 70 L84 70 Z" fill="url(#st)" ${O}/>
     <path d="M70 100 L190 100 M74 190 L186 190" stroke="#2a3446" stroke-width="3"/>
     ${[[80, 110], [180, 110], [80, 180], [180, 180]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#a8c0de" ${O2}/>`).join('')}
     <circle cx="130" cy="145" r="44" fill="url(#core)" opacity="0.7"/>
     <circle cx="130" cy="145" r="24" fill="#1a2a40" ${O}/><circle cx="130" cy="145" r="15" fill="#7fe8ff" ${O2}/><circle cx="130" cy="145" r="7" fill="#ffffff"/>
     ${[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return `<path d="M${130 + Math.cos(a) * 26} ${145 + Math.sin(a) * 26} L${130 + Math.cos(a) * 36} ${145 + Math.sin(a) * 36}" stroke="#7fe8ff" stroke-width="3"/>`; }).join('')}
     ${coil(56, 88)}${coil(204, 88)}
     <path d="M56 48 C90 20 110 50 130 30 C150 50 170 20 204 48" fill="none" stroke="#fff07a" stroke-width="3" stroke-linejoin="round"/><path d="M56 48 C90 20 110 50 130 30 C150 50 170 20 204 48" fill="none" stroke="#ffffff" stroke-width="1.2"/>
     <path d="M96 30 L164 30 L170 74 L90 74 Z" fill="url(#st)" ${O}/>
     <path d="M100 44 L160 44 L156 58 L104 58 Z" fill="#0a1424" ${O2}/>
     ${eyeGlow(116, 51, 5, '#7fe8ff')}${eyeGlow(144, 51, 5, '#7fe8ff')}
     <path d="M110 66 L150 66" stroke="#2a3446" stroke-width="3"/><path d="M100 34 C98 46 98 58 100 70" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.6"/>
     ${bolt(20, 60, 1.1, '#fff07a')}${bolt(232, 62, 1.1, '#fff07a')}`);
}

// มังกรรอยแยก — a lava drake: cracked hide glowing from inside, horns, spikes, wings, a burning tail
function riftDrake() {
  return spec(260, 200, 130, 188, rg('bd', '#e0593f', '#3a0c08', 0.55, 0.3, 0.8) + lg('lg', '#a83020', '#2a0806', 1, 1) + lg('wg', '#7a1a14', '#2a0806', 1, 1) + glow('eg', '#ffe89a') + glow('fire', '#ffb35a') + lg('hn', '#f6e8c8', '#8a6a48', 1, 1),
    `<path d="M40 96 C10 90 0 64 12 44 C18 58 26 62 36 60 C26 46 30 30 44 22 C42 40 50 54 62 70 Z" fill="url(#fire)" opacity="0.9"/>
     <path d="M44 104 C26 104 14 92 18 76 C26 86 34 90 48 90" fill="url(#lg)" ${O}/>
     <path d="M98 74 C84 30 52 18 30 26 C46 32 52 42 54 50 C40 46 30 52 28 60 C46 58 60 64 74 80 Z" fill="url(#wg)" ${O}/>
     <path d="M52 34 L82 70 M40 52 L74 78" stroke="#c4492e" stroke-width="2"/>
     <path d="M62 140 L54 184 L76 184 L84 146 Z M92 144 L90 184 L110 184 L112 146 Z M162 142 L160 184 L180 184 L182 140 Z M190 136 L196 184 L216 184 L208 132 Z" fill="url(#lg)" ${O}/>
     ${[[54, 184], [90, 184], [160, 184], [196, 184]].map(([x, y]) => `<path d="M${x} ${y} l4 -6 l4 6 l4 -6 l4 6" fill="#f6e8c8" stroke="${INK}" stroke-width="1.2"/>`).join('')}
     <path d="M46 108 C44 78 82 64 128 66 C170 66 210 78 210 108 C210 136 184 150 128 150 C76 150 46 138 46 108 Z" fill="url(#bd)" ${O}/>
     <path d="M70 92 L84 106 L80 122 M116 82 L124 100 L114 118 L122 136 M160 88 L152 104 L164 120 M190 102 L182 118" stroke="#ffcf5a" stroke-width="3" fill="none" stroke-linecap="round"/>
     <path d="M70 92 L84 106 L80 122 M116 82 L124 100 L114 118 L122 136 M160 88 L152 104 L164 120 M190 102 L182 118" stroke="#ffffff" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.8"/>
     <path d="M64 136 Q128 156 196 132" stroke="#2a0806" stroke-width="3" fill="none" opacity="0.6"/>
     ${[70, 88, 106, 124, 142, 160, 178].map((x, i) => `<path d="M${x - 7} ${70 - (i % 2) * 2} L${x} ${50 - (i % 3) * 6} L${x + 7} ${70 - (i % 2) * 2} Z" fill="url(#hn)" ${O2}/>`).join('')}
     <path d="M190 74 C206 54 236 56 250 72 C258 84 252 98 236 100 C220 102 202 96 194 88 Z" fill="url(#bd)" ${O}/>
     <path d="M234 90 Q246 94 256 86" fill="#2a1410" ${O2}/>${[238, 245].map((x) => `<path d="M${x} 90 l2 5 l2 -5" fill="#fff8ea" stroke="${INK}" stroke-width="0.8"/>`).join('')}
     <path d="M206 62 C204 40 218 26 230 24 C224 34 224 44 222 58 Z M222 64 C232 46 248 42 256 46 C246 52 242 60 236 68 Z" fill="url(#hn)" ${O2}/>
     ${eyeGlow(222, 76, 5, '#ffe89a', true)}
     <path d="M80 82 C96 72 118 70 136 72" stroke="#ff9a7a" stroke-width="2.4" fill="none" opacity="0.7"/>`);
}

export const BOSS_ART = Object.freeze({
  z_storm_roc: stormRoc, z_glacier_wyrm: glacierWyrm, z_hydra_mire: hydra, z_sphinx_colossus: sphinx,
  z_mother_morel: morel, z_tesla_titan: tesla, z_rift_drake: riftDrake,
});
