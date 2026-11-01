// The ten gods of the Underworld Tower. Big boss illustrations (≈ 220 px tall), in the same ink-and-gradient
// style as the zone bosses. Each returns { svg, w, h, ax, ay }; the anchor is between the feet.
import { INK } from './palette.js';
import { GOD_ART_V2 } from './godArt2.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b, cx = 0.4, cy = 0.35, r = 0.8) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const glowEye = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${c}" opacity="0.25"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="${c}" ${O2}/><ellipse cx="${x}" cy="${y}" rx="${r * 0.35}" ry="${r * 0.5}" fill="#ffffff"/>`;
const W = 240, H = 250;
const spec = (defs, body) => ({ w: W, h: H, ax: 120, ay: 240, svg: S(W, H, defs, body) });

// 10 — the ferryman of the river of souls
function river() {
  return spec(rg('rb', '#5aa8c8', '#14303e') + lg('bt', '#3a2a24', '#1a120e') + rg('lt', '#e8ffff', '#7fe8ff'),
    `<ellipse cx="120" cy="236" rx="100" ry="12" fill="#7fe8ff" opacity="0.25"/>
     <path d="M20 200 Q120 236 220 200 L206 226 Q120 250 34 226 Z" fill="url(#bt)" ${O}/><path d="M34 214 Q120 236 206 214" stroke="#5a4a40" stroke-width="3" fill="none"/>
     <path d="M196 30 L150 214" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M196 30 L150 214" stroke="#8a6a4a" stroke-width="5" stroke-linecap="round"/>
     <path d="M146 210 C130 226 150 238 164 222 Z" fill="#8a6a4a" ${O2}/>
     <path d="M70 206 C60 150 74 96 120 80 C166 96 180 150 170 206 Z" fill="url(#rb)" ${O}/>
     <path d="M80 200 C76 160 86 120 104 100 M160 200 C164 160 154 120 136 100" stroke="#14303e" stroke-width="4" fill="none" opacity="0.6"/>
     <path d="M84 96 C80 54 100 28 120 26 C140 28 160 54 156 96 C146 110 94 110 84 96 Z" fill="url(#rb)" ${O}/>
     <path d="M96 92 C96 66 106 52 120 52 C134 52 144 66 144 92 Z" fill="#081418"/>
     ${glowEye(110, 76, 5, '#7fe8ff')}${glowEye(132, 76, 5, '#7fe8ff')}
     <path d="M150 120 C176 124 192 110 196 100" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M150 120 C176 124 192 110 196 100" stroke="#2a5a6a" stroke-width="6" fill="none" stroke-linecap="round"/>
     <path d="M54 130 L54 170" stroke="${INK}" stroke-width="3"/><circle cx="54" cy="180" r="14" fill="url(#lt)" ${O2}/><circle cx="54" cy="180" r="26" fill="#7fe8ff" opacity="0.2"/>
     <path d="M84 132 C66 128 58 132 54 130" stroke="#2a5a6a" stroke-width="7" fill="none" stroke-linecap="round"/>
     ${[[40, 190], [196, 186], [100, 228]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#e8ffff" opacity="0.7"/>`).join('')}`);
}
// 20 — the jailer of chains
function chains() {
  const link = (x, y, a) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5.5" transform="rotate(${a} ${x} ${y})" fill="none" stroke="${INK}" stroke-width="5"/><ellipse cx="${x}" cy="${y}" rx="9" ry="5.5" transform="rotate(${a} ${x} ${y})" fill="none" stroke="#b8b8c4" stroke-width="2.6"/>`;
  return spec(rg('cb', '#7a3a34', '#2a0e0c') + lg('ar', '#9a9aa8', '#3a3a44'),
    `<path d="M60 236 L78 170 L100 170 L96 236 Z M180 236 L162 170 L140 170 L144 236 Z" fill="#3a3a44" ${O}/>
     <path d="M48 176 C40 110 70 70 120 66 C170 70 200 110 192 176 Q120 196 48 176 Z" fill="url(#cb)" ${O}/>
     <path d="M70 96 L170 160 M170 96 L70 160" stroke="${INK}" stroke-width="10"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => link(76 + i * 15, 100 + i * 9.5, 30) + link(164 - i * 15, 100 + i * 9.5, -30)).join('')}
     <path d="M36 92 C20 120 22 160 34 190 M204 92 C220 120 218 160 206 190" stroke="${INK}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M36 92 C20 120 22 160 34 190 M204 92 C220 120 218 160 206 190" stroke="#6a2a24" stroke-width="16" fill="none" stroke-linecap="round"/>
     <rect x="16" y="180" width="34" height="24" rx="5" fill="url(#ar)" ${O2}/><rect x="190" y="180" width="34" height="24" rx="5" fill="url(#ar)" ${O2}/>
     ${[0, 1, 2, 3].map((i) => link(30 - i * 4, 214 + i * 9, 80) + link(210 + i * 4, 214 + i * 9, -80)).join('')}
     <path d="M80 70 C76 34 98 16 120 16 C142 16 164 34 160 70 C150 82 90 82 80 70 Z" fill="url(#ar)" ${O}/>
     <path d="M88 44 L152 44 M90 56 L150 56" stroke="${INK}" stroke-width="3"/><rect x="92" y="38" width="56" height="14" fill="#14141c"/>
     ${glowEye(108, 45, 5, '#ff3a3a')}${glowEye(132, 45, 5, '#ff3a3a')}
     <path d="M96 66 L100 76 L104 66 M116 66 L120 78 L124 66 M136 66 L140 76 L144 66" fill="#e8e0d0" ${O2}/>`);
}
// 30 — the furnace of hellfire
function hellfire() {
  return spec(rg('hb', '#ffcf5a', '#8e2c21') + rg('hc', '#fff3c4', '#ff5a1a'),
    `<circle cx="120" cy="120" r="110" fill="#ff5a1a" opacity="0.12"/>
     <path d="M60 236 C40 190 52 150 80 130 L160 130 C188 150 200 190 180 236 Z" fill="url(#hb)" ${O}/>
     <path d="M80 236 C70 210 84 190 100 186 C96 206 108 220 120 236 Z M160 236 C170 210 156 190 140 186 C144 206 132 220 120 236 Z" fill="#ffcf5a" opacity="0.8"/>
     <path d="M82 130 C40 120 20 90 26 60 C40 80 56 90 80 96 Z M158 130 C200 120 220 90 214 60 C200 80 184 90 160 96 Z" fill="url(#hb)" ${O}/>
     <path d="M70 150 C40 160 20 150 14 132 C30 138 46 136 64 128 Z M170 150 C200 160 220 150 226 132 C210 138 194 136 176 128 Z" fill="url(#hb)" ${O}/>
     <circle cx="20" cy="54" r="14" fill="url(#hc)" ${O2}/><circle cx="220" cy="54" r="14" fill="url(#hc)" ${O2}/>
     <path d="M84 132 C76 90 96 58 120 56 C144 58 164 90 156 132 Z" fill="url(#hb)" ${O}/>
     <path d="M86 60 C78 40 84 20 92 10 C96 26 102 30 106 22 C108 34 114 38 120 6 C126 38 132 34 134 22 C138 30 144 26 148 10 C156 20 162 40 154 60 Z" fill="url(#hc)" ${O}/>
     ${glowEye(106, 96, 7, '#fff3c4')}${glowEye(134, 96, 7, '#fff3c4')}
     <path d="M100 116 Q120 128 140 116 L136 124 Q120 132 104 124 Z" fill="#2a0a06" ${O2}/>
     <circle cx="120" cy="170" r="16" fill="url(#hc)" ${O2}/><circle cx="120" cy="170" r="30" fill="#ffcf5a" opacity="0.25"/>`);
}
// 40 — the silent shadow
function silence() {
  return spec(lg('sb', '#3a3450', '#08070c') + rg('sv', '#c8c8ff', '#3a3450'),
    `<ellipse cx="120" cy="238" rx="70" ry="8" fill="#000" opacity="0.4"/>
     <path d="M70 238 C76 190 74 140 86 100 C96 70 110 56 120 56 C130 56 144 70 154 100 C166 140 164 190 170 238 C150 226 140 236 120 228 C100 236 90 226 70 238 Z" fill="url(#sb)" ${O}/>
     <path d="M86 110 C60 130 50 160 48 196 L60 192 C64 166 72 146 90 134 Z M154 110 C180 130 190 160 192 196 L180 192 C176 166 168 146 150 134 Z" fill="url(#sb)" ${O}/>
     <path d="M90 60 C80 30 100 8 120 8 C140 8 160 30 150 60 C146 80 134 92 120 92 C106 92 94 80 90 60 Z" fill="url(#sv)" ${O}/>
     <path d="M86 46 C96 20 144 20 154 46 C150 34 136 28 120 28 C104 28 90 34 86 46 Z" fill="#14121c"/>
     <path d="M104 54 Q110 50 116 54 M124 54 Q130 50 136 54" stroke="#14121c" stroke-width="3" fill="none"/>
     <path d="M108 74 L132 74" stroke="#14121c" stroke-width="3"/><path d="M112 70 L112 78 M118 70 L118 78 M124 70 L124 78 M130 70 L130 78" stroke="#14121c" stroke-width="1.6"/>
     <path d="M150 140 C160 120 150 100 140 96 L132 104 C140 110 144 124 140 136 Z" fill="url(#sv)" ${O2}/><path d="M136 100 L134 78" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M136 100 L134 78" stroke="#c8c8ff" stroke-width="4" stroke-linecap="round"/>
     ${[[60, 80], [186, 70], [40, 140], [200, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#c8c8ff" opacity="0.6"/>`).join('')}`);
}
// 50 — the judge of souls
function judge() {
  const plate = (x, y) => `<path d="M${x} ${y - 46} L${x - 26} ${y} M${x} ${y - 46} L${x + 26} ${y}" stroke="${INK}" stroke-width="1.8"/><path d="M${x - 30} ${y} Q${x} ${y + 18} ${x + 30} ${y} Z" fill="#e0b45a" ${O2}/>`;
  return spec(lg('jr', '#3a3a50', '#14141c') + rg('jf', '#f0e0c8', '#b8a080'),
    `<ellipse cx="120" cy="34" rx="44" ry="10" fill="none" stroke="#e0b45a" stroke-width="5"/><ellipse cx="120" cy="34" rx="56" ry="16" fill="#ffe89a" opacity="0.2"/>
     <path d="M62 238 C62 180 70 120 92 96 L148 96 C170 120 178 180 178 238 Z" fill="url(#jr)" ${O}/>
     <path d="M120 100 L120 236 M100 120 L100 236 M140 120 L140 236" stroke="#e0b45a" stroke-width="2.4" opacity="0.7"/>
     <path d="M92 100 L20 110 L22 118 L94 114 Z M148 100 L220 110 L218 118 L146 114 Z" fill="#e0b45a" ${O2}/>
     ${plate(28, 168)}${plate(212, 168)}
     <path d="M94 96 C86 60 100 40 120 40 C140 40 154 60 146 96 Z" fill="url(#jf)" ${O}/>
     <path d="M96 66 L144 66 L142 78 L98 78 Z" fill="#14141c" ${O2}/>
     <path d="M108 90 Q120 96 132 90" stroke="#5a3a2a" stroke-width="2.4" fill="none"/>
     <path d="M110 112 L130 112 L126 130 L120 136 L114 130 Z" fill="#e0b45a" ${O2}/><circle cx="120" cy="121" r="3" fill="#fff"/>`);
}
// 60 — the serpent of the underworld
function serpent() {
  return spec(rg('pb', '#a8d070', '#1a3a2a') + lg('ph', '#c8e890', '#2a5a3a'),
    `<path d="M30 230 C10 200 30 170 70 176 C110 182 140 214 180 206 C214 200 226 172 210 150" stroke="${INK}" stroke-width="44" fill="none" stroke-linecap="round"/>
     <path d="M30 230 C10 200 30 170 70 176 C110 182 140 214 180 206 C214 200 226 172 210 150" stroke="url(#pb)" stroke-width="38" fill="none" stroke-linecap="round"/>
     <path d="M40 222 C30 204 40 188 66 190 C104 194 136 226 180 218" stroke="#e8ff9a" stroke-width="8" fill="none" opacity="0.7"/>
     ${[[60, 180], [100, 192], [140, 210], [190, 200]].map(([x, y]) => `<path d="M${x} ${y - 10} l7 7 l-7 7 l-7 -7 Z" fill="#e8ff9a" ${O2}/>`).join('')}
     <path d="M208 156 C200 120 160 110 130 120 C120 90 126 60 120 40" stroke="${INK}" stroke-width="40" fill="none" stroke-linecap="round"/><path d="M208 156 C200 120 160 110 130 120 C120 90 126 60 120 40" stroke="url(#pb)" stroke-width="34" fill="none" stroke-linecap="round"/>
     <path d="M76 66 C70 20 100 0 120 0 C140 0 170 20 164 66 C150 86 90 86 76 66 Z" fill="url(#ph)" ${O}/>
     <path d="M92 60 C92 36 106 22 120 22 C134 22 148 36 148 60" stroke="#e8ff9a" stroke-width="3" fill="none"/>
     <path d="M96 30 L90 12 L104 26 Z M144 30 L150 12 L136 26 Z M120 18 L120 0 L126 16 Z" fill="#f5c35a" ${O2}/>
     ${glowEye(106, 50, 6, '#e8ff9a')}${glowEye(134, 50, 6, '#e8ff9a')}
     <path d="M102 72 L108 86 L112 72 M128 72 L132 86 L138 72" fill="#ffffff" ${O2}/><path d="M118 80 L116 96 M122 80 L124 96" stroke="#c2412f" stroke-width="2.4"/>`);
}
// 70 — the clock of last breaths
function clock() {
  const tick = (i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${120 + Math.cos(a) * 46} ${130 + Math.sin(a) * 46} L${120 + Math.cos(a) * 54} ${130 + Math.sin(a) * 54}" stroke="${INK}" stroke-width="${i % 3 ? 2 : 4}"/>`; };
  return spec(rg('tb', '#fff3c4', '#8a6a3a') + lg('tm', '#c8a050', '#5a4a30'),
    `<path d="M70 238 L86 186 L154 186 L170 238 Z" fill="url(#tm)" ${O}/>
     <path d="M54 136 L18 60 L30 54 L70 120 Z M186 136 L222 60 L210 54 L170 120 Z" fill="#e8eef4" ${O2}/>
     <circle cx="120" cy="130" r="66" fill="url(#tm)" ${O}/><circle cx="120" cy="130" r="56" fill="url(#tb)" ${O2}/>
     ${Array.from({ length: 12 }, (_, i) => tick(i)).join('')}
     <path d="M120 130 L120 84" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M120 130 L152 150" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="120" cy="130" r="6" fill="#c2412f" ${O2}/>
     <path d="M90 66 C86 40 100 20 120 20 C140 20 154 40 150 66 Z" fill="url(#tm)" ${O}/>
     ${glowEye(108, 48, 5, '#fff3c4')}${glowEye(132, 48, 5, '#fff3c4')}
     <path d="M96 22 L92 4 L104 18 Z M144 22 L148 4 L136 18 Z" fill="#c8a050" ${O2}/>
     <path d="M24 236 L40 212 L56 236 Z M184 236 L200 212 L216 236 Z" fill="#fff3c4" opacity="0.6"/>`);
}
// 80 — the god of a thousand faces (the circling masks are drawn by the scene)
function masks() {
  return spec(lg('mr', '#5a2a5a', '#14081a') + rg('mm', '#ffffff', '#d8c8d8'),
    `<path d="M56 238 C50 170 66 110 96 84 L144 84 C174 110 190 170 184 238 C160 226 140 236 120 226 C100 236 80 226 56 238 Z" fill="url(#mr)" ${O}/>
     <path d="M96 84 C70 100 40 120 30 160 L42 164 C52 136 74 118 100 108 Z M144 84 C170 100 200 120 210 160 L198 164 C188 136 166 118 140 108 Z" fill="url(#mr)" ${O}/>
     <path d="M120 110 L120 230" stroke="#ff5a9a" stroke-width="2.4" opacity="0.6"/>
     <path d="M84 70 C80 30 100 10 120 10 C140 10 160 30 156 70 C150 92 134 100 120 100 C106 100 90 92 84 70 Z" fill="url(#mm)" ${O}/>
     <path d="M96 48 Q106 40 114 50 Q106 56 96 48 Z M126 50 Q134 40 144 48 Q134 56 126 50 Z" fill="#14081a"/>
     <path d="M100 76 Q120 92 140 76 Q120 84 100 76 Z" fill="#14081a"/>
     <path d="M84 70 C76 64 72 50 76 40 M156 70 C164 64 168 50 164 40" stroke="#ff5a9a" stroke-width="3" fill="none"/>
     <path d="M118 14 L120 30 L122 14 Z" fill="#ff5a9a"/>`);
}
// 90 — the giant of frozen hell
function frost() {
  return spec(rg('fb', '#e8f8ff', '#3a6a9a') + lg('fc', '#ffffff', '#7fb8e8'),
    `<path d="M50 238 L64 170 L104 170 L100 238 Z M190 238 L176 170 L136 170 L140 238 Z" fill="url(#fb)" ${O}/>
     <path d="M30 180 C20 110 60 66 120 62 C180 66 220 110 210 180 Q120 200 30 180 Z" fill="url(#fb)" ${O}/>
     <path d="M60 110 L80 140 L70 150 M180 110 L160 140 L170 150 M110 150 L130 150" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"/>
     <path d="M20 100 C4 130 6 170 16 196 L34 190 C30 164 32 136 44 112 Z M220 100 C236 130 234 170 224 196 L206 190 C210 164 208 136 196 112 Z" fill="url(#fb)" ${O}/>
     <path d="M84 70 C80 40 98 24 120 24 C142 24 160 40 156 70 C148 86 92 86 84 70 Z" fill="url(#fb)" ${O}/>
     <path d="M84 30 L90 0 L100 26 L110 -6 L120 22 L130 -6 L140 26 L150 0 L156 30 Z" fill="url(#fc)" ${O}/>
     ${glowEye(106, 54, 6, '#7fe8ff')}${glowEye(134, 54, 6, '#7fe8ff')}
     <path d="M92 76 L98 104 L104 80 L110 112 L116 82 L122 116 L128 82 L134 108 L140 80 L146 98 L150 76 Z" fill="url(#fc)" ${O2}/>`);
}
// 100 — the king of the underworld
function king() {
  return spec(lg('kc', '#c2412f', '#3a0a0a') + lg('ka', '#4a3a40', '#14080c') + rg('kg', '#ffe89a', '#c88a2a'),
    `<path d="M40 238 C30 170 50 110 80 90 L160 90 C190 110 210 170 200 238 Z" fill="url(#kc)" ${O}/>
     <path d="M70 238 L80 160 L160 160 L170 238 Z" fill="url(#ka)" ${O}/>
     <path d="M78 100 C70 130 76 150 84 170 L156 170 C164 150 170 130 162 100 Z" fill="url(#ka)" ${O}/>
     <path d="M100 120 L120 150 L140 120 L132 112 L120 128 L108 112 Z" fill="url(#kg)" ${O2}/>
     <path d="M78 98 L48 86 L40 104 L72 116 Z M162 98 L192 86 L200 104 L168 116 Z" fill="url(#ka)" ${O2}/><path d="M48 86 L34 70 L44 92 Z M192 86 L206 70 L196 92 Z" fill="#ff3a3a" ${O2}/>
     <path d="M206 30 L196 196" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M206 30 L196 196" stroke="#2a2430" stroke-width="7" stroke-linecap="round"/>
     <path d="M200 30 L212 30 L206 6 Z" fill="#ff3a3a" ${O2}/><path d="M188 150 L214 152" stroke="url(#kg)" stroke-width="8"/>
     <path d="M90 82 C86 50 100 34 120 34 C140 34 154 50 150 82 C144 94 96 94 90 82 Z" fill="url(#ka)" ${O}/>
     <path d="M88 44 L80 6 L98 30 L108 0 L120 26 L132 0 L142 30 L160 6 L152 44 Z" fill="url(#kg)" ${O}/><circle cx="120" cy="30" r="5" fill="#ff3a3a" ${O2}/>
     <path d="M86 46 C70 40 60 28 62 14 C70 24 78 30 90 34 Z M154 46 C170 40 180 28 178 14 C170 24 162 30 150 34 Z" fill="#e8dcc0" ${O2}/>
     ${glowEye(108, 64, 6, '#ff3a3a')}${glowEye(132, 64, 6, '#ff3a3a')}`);
}

export const GOD_ART = Object.freeze({
  t_god_river: river, t_god_chains: chains, t_god_hellfire: hellfire, t_god_silence: silence, t_god_judge: judge,
  t_god_serpent: serpent, t_god_time: clock, t_god_masks: masks, t_god_frost: frost, t_god_king: king,
  ...GOD_ART_V2,          // v7: the five that fight bare-handed, redrawn in more detail (art/godArt2.js)
});
