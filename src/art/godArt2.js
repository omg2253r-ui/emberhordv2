// The tower gods that fight with their bodies (not a weapon), redrawn with more detail: the chained jailer,
// the hellfire furnace, the underworld serpent, the clock of last breaths and the frozen giant.
// Same canvas as art/gods.js: 240 × 250, anchor between the feet (120, 240).
import { INK } from './palette.js';

const W = 240, H = 250;
const S = (defs, body) => ({ w: W, h: H, ax: 120, ay: 240, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}<radialGradient id="eg"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#ffffff" stop-opacity="0.8"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>${body}</svg>` });
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b, cx = 0.4, cy = 0.3, r = 0.8) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const lg = (id, a, b, x2 = 0, y2 = 1, m = null) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/>${m ? `<stop offset="0.5" stop-color="${m}"/>` : ''}<stop offset="1" stop-color="${b}"/></linearGradient>`;
const glowC = (id, c) => `<radialGradient id="${id}"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const eye = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r * 3}" fill="${c}" opacity="0.28"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.75}" fill="${c}" ${O2}/><circle cx="${x - r * 0.3}" cy="${y - r * 0.25}" r="${r * 0.35}" fill="#fff"/>`;
const link = (x, y, a, c = '#b8b8c4') => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5.5" transform="rotate(${a} ${x} ${y})" fill="none" stroke="${INK}" stroke-width="5.4"/><ellipse cx="${x}" cy="${y}" rx="9" ry="5.5" transform="rotate(${a} ${x} ${y})" fill="none" stroke="${c}" stroke-width="2.8"/><path d="M${x - 4} ${y - 3} q3 -2 6 0" transform="rotate(${a} ${x} ${y})" stroke="#ffffff" stroke-width="1" fill="none" opacity="0.7"/>`;

// 20 — กาฬโลหิต: a hulking jailer in rusted iron, wrapped in crossed chains, shackles on both fists
function chains() {
  const plate = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#ir)" ${O2}/><circle cx="${x + 5}" cy="${y + 5}" r="1.8" fill="#d8d8e0"/><circle cx="${x + w - 5}" cy="${y + 5}" r="1.8" fill="#d8d8e0"/>`;
  return S(rg('bd', '#9a4a40', '#2a0a0a', 0.4, 0.25) + lg('ir', '#c8c8d4', '#3a3a46', 1, 1, '#7a7a88') + glowC('gl', '#ff3a3a') + lg('rs', '#6a3a2a', '#2a140c', 1, 1),
    `<ellipse cx="120" cy="240" rx="96" ry="9" fill="#000" opacity="0.4"/>
     <path d="M66 238 L76 176 L104 176 L100 238 Z M174 238 L164 176 L136 176 L140 238 Z" fill="url(#ir)" ${O}/>
     ${plate(64, 222, 40, 16)}${plate(136, 222, 40, 16)}
     <path d="M42 180 C30 112 64 70 120 66 C176 70 210 112 198 180 Q120 204 42 180 Z" fill="url(#bd)" ${O}/>
     <path d="M60 170 C54 130 70 100 96 90" stroke="#c86a5a" stroke-width="3" fill="none" opacity="0.6"/>
     ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => link(68 + i * 15, 92 + i * 11, 35) + link(172 - i * 15, 92 + i * 11, -35)).join('')}
     <circle cx="120" cy="140" r="14" fill="url(#ir)" ${O}/><circle cx="120" cy="140" r="22" fill="url(#gl)" opacity="0.6"/><path d="M114 140 L126 140 M120 134 L120 146" stroke="#ff3a3a" stroke-width="3"/>
     <path d="M40 86 C18 116 16 160 30 196" stroke="${INK}" stroke-width="30" fill="none" stroke-linecap="round"/><path d="M40 86 C18 116 16 160 30 196" stroke="url(#rs)" stroke-width="24" fill="none" stroke-linecap="round"/>
     <path d="M200 86 C222 116 224 160 210 196" stroke="${INK}" stroke-width="30" fill="none" stroke-linecap="round"/><path d="M200 86 C222 116 224 160 210 196" stroke="url(#rs)" stroke-width="24" fill="none" stroke-linecap="round"/>
     ${plate(26, 64, 34, 30)}${plate(180, 64, 34, 30)}
     <path d="M14 186 C10 210 30 222 46 212 C56 204 52 190 46 186 Z M226 186 C230 210 210 222 194 212 C184 204 188 190 194 186 Z" fill="#5a2a24" ${O}/>
     <rect x="12" y="176" width="40" height="16" rx="4" fill="url(#ir)" ${O2}/><rect x="188" y="176" width="40" height="16" rx="4" fill="url(#ir)" ${O2}/>
     ${[0, 1, 2, 3, 4].map((i) => link(26 - i * 3, 222 + i * 8, 80) + link(214 + i * 3, 222 + i * 8, -80)).join('')}
     <path d="M78 74 C72 36 94 14 120 14 C146 14 168 36 162 74 C152 88 88 88 78 74 Z" fill="url(#ir)" ${O}/>
     <path d="M84 44 L156 44 L154 58 L86 58 Z" fill="#0a0810" ${O2}/>
     ${eye(104, 51, 5, '#ff4a4a')}${eye(136, 51, 5, '#ff4a4a')}
     <path d="M120 16 L120 42" stroke="#5a5a68" stroke-width="3"/><path d="M90 26 C96 20 108 16 118 16" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.6"/>
     ${[92, 104, 116, 128, 140].map((x) => `<path d="M${x} 66 l4 10 l4 -10" fill="#e8e0d0" ${O2}/>`).join('')}
     <path d="M70 14 L82 30 M170 14 L158 30" stroke="#b8b8c4" stroke-width="4" stroke-linecap="round"/>`);
}

// 30 — มารีจิ: a furnace-bodied god of hellfire, horns of flame, a blazing core, fire in both hands
function hellfire() {
  const flame = (x, y, s, c1, c2) => `<path d="M${x} ${y} C${x - 12 * s} ${y - 14 * s} ${x - 6 * s} ${y - 30 * s} ${x} ${y - 44 * s} C${x + 2 * s} ${y - 30 * s} ${x + 10 * s} ${y - 26 * s} ${x + 8 * s} ${y - 36 * s} C${x + 18 * s} ${y - 22 * s} ${x + 14 * s} ${y - 8 * s} ${x} ${y} Z" fill="${c1}" ${O2}/><path d="M${x} ${y - 4 * s} C${x - 5 * s} ${y - 12 * s} ${x - 2 * s} ${y - 22 * s} ${x + 1 * s} ${y - 28 * s} C${x + 6 * s} ${y - 18 * s} ${x + 6 * s} ${y - 10 * s} ${x} ${y - 4 * s} Z" fill="${c2}"/>`;
  return S(rg('hb', '#ffb35a', '#5a1208', 0.45, 0.3) + rg('core', '#fff8d0', '#ff5a1a', 0.5, 0.5, 0.6) + lg('st', '#6a4a3a', '#1a0c08', 1, 1) + glowC('gl', '#ff8a3d'),
    `<circle cx="120" cy="130" r="112" fill="url(#gl)" opacity="0.35"/>
     <ellipse cx="120" cy="240" rx="80" ry="8" fill="#000" opacity="0.4"/>
     <path d="M62 238 C48 196 56 160 82 138 L158 138 C184 160 192 196 178 238 Z" fill="url(#st)" ${O}/>
     ${[[74, 236], [92, 238], [148, 238], [166, 236]].map(([x, y]) => flame(x, y, 0.8, '#ff7a33', '#ffd27a')).join('')}
     <path d="M80 140 C40 128 22 98 28 66 C42 86 58 94 82 100 Z M160 140 C200 128 218 98 212 66 C198 86 182 94 158 100 Z" fill="url(#hb)" ${O}/>
     <path d="M70 156 C42 166 24 156 18 138 C34 144 50 142 66 134 Z M170 156 C198 166 216 156 222 138 C206 144 190 142 174 134 Z" fill="url(#hb)" ${O}/>
     <circle cx="22" cy="58" r="18" fill="url(#core)" ${O2}/><circle cx="218" cy="58" r="18" fill="url(#core)" ${O2}/>
     ${flame(22, 44, 0.7, '#ff9a3d', '#fff3c4')}${flame(218, 44, 0.7, '#ff9a3d', '#fff3c4')}
     <path d="M82 140 C72 96 94 60 120 58 C146 60 168 96 158 140 Z" fill="url(#hb)" ${O}/>
     ${[96, 112, 128, 144].map((x) => `<path d="M${x} 72 L${x + 2} 132" stroke="#5a1208" stroke-width="2" opacity="0.5"/>`).join('')}
     <path d="M84 62 C72 40 80 16 92 4 C94 22 100 28 106 20 C108 32 114 36 120 2 C126 36 132 32 134 20 C140 28 146 22 148 4 C160 16 168 40 156 62 Z" fill="#ff7a33" ${O}/>
     <path d="M92 56 C88 40 94 26 100 18 C102 32 110 36 120 14 C130 36 138 32 140 18 C146 26 152 40 148 56 Z" fill="#ffd27a"/>
     ${eye(104, 96, 4.5, '#fff3c4')}${eye(136, 96, 4.5, '#fff3c4')}
     <path d="M98 116 Q120 132 142 116 L138 126 Q120 138 102 126 Z" fill="#2a0a06" ${O2}/>${[108, 120, 132].map((x) => `<path d="M${x - 3} 120 l3 6 l3 -6" fill="#ffd27a"/>`).join('')}
     <circle cx="120" cy="178" r="34" fill="url(#gl)"/><circle cx="120" cy="178" r="18" fill="url(#core)" ${O2}/>
     <path d="M100 168 L92 162 M140 168 L148 162 M120 156 L120 148" stroke="#ffd27a" stroke-width="3" stroke-linecap="round"/>`);
}

// 60 — พิษภุชงค์: a cobra god coiled on a pool of venom, hood spread, crowned with golden spines
function serpent() {
  const coil = 'M30 228 C8 200 30 168 74 176 C114 184 140 214 182 206 C216 198 228 168 208 146';
  const neck = 'M208 150 C198 118 160 112 132 120 C118 90 126 64 120 44';
  return S(lg('pb', '#b8e080', '#1a3a20', 1, 0, '#5a9a4a') + rg('hood', '#c8e890', '#1e3a22', 0.5, 0.4) + rg('pool', '#9ad060', '#0e1e0a', 0.5, 0.4) + glowC('gl', '#d6ff9a'),
    `<ellipse cx="120" cy="230" rx="116" ry="16" fill="url(#pool)" ${O}/>
     ${[[40, 228, 5], [80, 236, 4], [190, 234, 6], [214, 226, 3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#d6ff9a" stroke-width="1.6"/>`).join('')}
     <path d="${coil}" stroke="${INK}" stroke-width="46" fill="none" stroke-linecap="round"/><path d="${coil}" stroke="url(#pb)" stroke-width="40" fill="none" stroke-linecap="round"/>
     <path d="${coil}" stroke="#e8ffb0" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="2 10" transform="translate(0 8)" opacity="0.8"/>
     ${[[56, 176], [96, 186], [138, 206], [186, 200]].map(([x, y]) => `<path d="M${x} ${y - 12} l8 8 l-8 8 l-8 -8 Z" fill="#f5c35a" ${O2}/>`).join('')}
     <path d="${neck}" stroke="${INK}" stroke-width="40" fill="none" stroke-linecap="round"/><path d="${neck}" stroke="url(#pb)" stroke-width="34" fill="none" stroke-linecap="round"/>
     <path d="M120 44 C84 40 62 70 70 104 C88 96 104 92 120 96 C136 92 152 96 170 104 C178 70 156 40 120 44 Z" fill="url(#hood)" ${O}/>
     <path d="M88 64 C96 56 108 54 120 56 C132 54 144 56 152 64" stroke="#f5c35a" stroke-width="3" fill="none"/><path d="M84 84 C96 76 108 74 120 76 C132 74 144 76 156 84" stroke="#d6ff9a" stroke-width="2" fill="none" opacity="0.7"/>
     <path d="M96 40 C92 14 108 2 120 2 C132 2 148 14 144 40 C138 56 102 56 96 40 Z" fill="url(#hood)" ${O}/>
     ${[[100, 10, -18], [112, 2, -6], [128, 2, 6], [140, 10, 18]].map(([x, y, d]) => `<path d="M${x - 4} ${y + 6} L${x + d * 0.4} ${y - 12} L${x + 4} ${y + 6} Z" fill="#f5c35a" ${O2}/>`).join('')}
     ${eye(108, 28, 5, '#e8ff9a')}${eye(132, 28, 5, '#e8ff9a')}
     <path d="M110 46 L114 58 L118 46 M122 46 L126 58 L130 46" fill="#ffffff" ${O2}/><path d="M118 54 L116 70 M122 54 L124 70" stroke="#c2412f" stroke-width="2.4"/>
     <circle cx="120" cy="96" r="18" fill="url(#gl)" opacity="0.5"/>`);
}

// 70 — ราตรีกาล: an owl-faced clock god, a dial for a body, blade hands, an hourglass at its feet
function clock() {
  const tick = (i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; return `<path d="M${120 + Math.cos(a) * 46} ${132 + Math.sin(a) * 46} L${120 + Math.cos(a) * 56} ${132 + Math.sin(a) * 56}" stroke="${INK}" stroke-width="${i % 3 ? 2 : 4}"/>`; };
  const num = ['XII', 'III', 'VI', 'IX'];
  return S(rg('face', '#fffbe8', '#c8a868', 0.45, 0.4) + lg('br', '#f0d080', '#5a3a14', 1, 1, '#c8a050') + lg('bl', '#ffffff', '#8aa0bc', 1, 0) + glowC('gl', '#fff3c4'),
    `<ellipse cx="120" cy="240" rx="78" ry="8" fill="#000" opacity="0.4"/>
     <path d="M84 238 L92 198 L148 198 L156 238 Z" fill="url(#br)" ${O}/>
     <path d="M104 236 L136 236 L122 222 L136 206 L104 206 L118 222 Z" fill="#fff3c4" opacity="0.7" ${O2}/>
     <path d="M58 140 L14 52 L28 44 L74 124 Z M182 140 L226 52 L212 44 L166 124 Z" fill="url(#bl)" ${O}/>
     <path d="M22 54 L62 128 M218 54 L178 128" stroke="#ffffff" stroke-width="1.6" opacity="0.8"/>
     <circle cx="120" cy="132" r="78" fill="url(#gl)" opacity="0.4"/>
     <circle cx="120" cy="132" r="70" fill="url(#br)" ${O}/><circle cx="120" cy="132" r="60" fill="url(#face)" ${O2}/>
     ${Array.from({ length: 12 }, (_, i) => tick(i)).join('')}
     ${num.map((t, i) => { const a = (i / 4) * Math.PI * 2 - Math.PI / 2; return `<text x="${120 + Math.cos(a) * 36}" y="${136 + Math.sin(a) * 36}" text-anchor="middle" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#5a3a14">${t}</text>`; }).join('')}
     <path d="M120 132 L120 82" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M120 132 L156 152" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
     <circle cx="120" cy="132" r="7" fill="#c2412f" ${O2}/><circle cx="118" cy="130" r="2" fill="#fff"/>
     <path d="M86 70 C82 40 98 20 120 20 C142 20 158 40 154 70 Z" fill="url(#br)" ${O}/>
     <path d="M96 22 L88 2 L106 18 Z M144 22 L152 2 L134 18 Z" fill="url(#br)" ${O2}/>
     <circle cx="106" cy="48" r="11" fill="#fff8e0" ${O2}/><circle cx="134" cy="48" r="11" fill="#fff8e0" ${O2}/>
     ${eye(106, 48, 5, '#ffcf5a')}${eye(134, 48, 5, '#ffcf5a')}
     <path d="M116 58 L120 66 L124 58 Z" fill="#c8a050" ${O2}/>`);
}

// 90 — อสุรเหม: a frost giant of crystal and ice, a crown of shards, a beard of icicles
function frost() {
  const shard = (x, y, h, w = 8) => `<path d="M${x - w} ${y} L${x} ${y - h} L${x + w} ${y} Z" fill="url(#cr)" ${O2}/><path d="M${x - 1} ${y - h + 4} L${x + 1} ${y - 3}" stroke="#ffffff" stroke-width="1.4"/>`;
  return S(rg('fb', '#f2fbff', '#2f5a88', 0.4, 0.25) + lg('cr', '#ffffff', '#6aa8d8', 1, 1) + glowC('gl', '#7fe8ff'),
    `<ellipse cx="120" cy="240" rx="100" ry="9" fill="#000" opacity="0.4"/>
     <path d="M52 238 L66 168 L106 168 L102 238 Z M188 238 L174 168 L134 168 L138 238 Z" fill="url(#fb)" ${O}/>
     ${shard(60, 238, 14)}${shard(180, 238, 14)}
     <path d="M28 182 C16 110 58 64 120 60 C182 64 224 110 212 182 Q120 204 28 182 Z" fill="url(#fb)" ${O}/>
     <path d="M54 110 L76 142 L66 152 M186 110 L164 142 L174 152 M98 160 L120 172 L142 160" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7"/>
     <circle cx="120" cy="130" r="26" fill="url(#gl)" opacity="0.6"/><path d="M120 112 L130 130 L120 148 L110 130 Z" fill="#bff6ff" ${O2}/>
     ${shard(44, 86, 34, 10)}${shard(196, 86, 34, 10)}${shard(30, 104, 22)}${shard(210, 104, 22)}
     <path d="M18 100 C2 130 4 172 14 198 L34 192 C30 166 32 136 44 112 Z M222 100 C238 130 236 172 226 198 L206 192 C210 166 208 136 196 112 Z" fill="url(#fb)" ${O}/>
     <path d="M6 192 C2 214 20 226 36 218 C46 210 44 196 38 192 Z M234 192 C238 214 220 226 204 218 C194 210 196 196 202 192 Z" fill="url(#fb)" ${O}/>
     <path d="M84 72 C80 42 98 26 120 26 C142 26 160 42 156 72 C148 88 92 88 84 72 Z" fill="url(#fb)" ${O}/>
     <path d="M82 32 L88 2 L100 26 L110 -4 L120 22 L130 -4 L140 26 L152 2 L158 32 Z" fill="url(#cr)" ${O}/>
     ${eye(106, 54, 6, '#7fe8ff')}${eye(134, 54, 6, '#7fe8ff')}
     <path d="M98 44 L114 48 M142 44 L126 48" stroke="${INK}" stroke-width="3"/>
     <path d="M90 76 L96 108 L104 80 L110 116 L116 82 L122 120 L128 82 L134 112 L140 80 L146 102 L152 76 Z" fill="url(#cr)" ${O2}/>`);
}

export const GOD_ART_V2 = Object.freeze({ t_god_chains: chains, t_god_hellfire: hellfire, t_god_serpent: serpent, t_god_time: clock, t_god_frost: frost });
