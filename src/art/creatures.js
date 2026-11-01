// Detailed enemy illustrations: layered gradients for volume, ink outlines, texture strokes and rim light.
// Each returns { svg, w, h, ax, ay } like the other sprite builders.
import { INK } from './palette.js';

const S = (w, h, defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const rg = (id, a, b, cx = 0.4, cy = 0.35, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const eye = (cx, cy, rx, ry, iris = INK) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff8ea" ${O2}/><circle cx="${cx + rx * 0.25}" cy="${cy + ry * 0.2}" r="${rx * 0.5}" fill="${iris}"/><circle cx="${cx + rx * 0.4}" cy="${cy - ry * 0.05}" r="${rx * 0.17}" fill="#fff"/><circle cx="${cx}" cy="${cy + ry * 0.45}" r="${rx * 0.09}" fill="#fff" opacity="0.8"/>`;

export function mossling() {
  return { w: 100, h: 94, ax: 50, ay: 87, svg: S(100, 94, rg('b', '#9cc565', '#3f612b') + lg('l', '#c9e48e', '#6f9a4a', 1, 1),
    `<path d="M52 27 Q48 15 53 7" fill="none" ${O}/>
     <path d="M53 10 C64 0 78 6 72 15 C64 18 57 16 53 10 Z" fill="url(#l)" ${O2}/><path d="M55 11 C62 9 67 10 71 13" stroke="#4b6e33" stroke-width="1.2" fill="none"/>
     <path d="M51 15 C41 6 30 11 35 18 C42 21 47 19 51 15 Z" fill="#6f9a4a" ${O2}/><path d="M49 15 C44 13 40 14 37 16" stroke="#3f612b" stroke-width="1.2" fill="none"/>
     <path d="M13 81 C8 50 29 26 50 26 C71 26 92 50 87 81 Q50 92 13 81 Z" fill="url(#b)" ${O}/>
     <path d="M22 44 C26 34 34 30 40 30 C36 34 33 38 33 42 C30 40 26 41 22 44 Z" fill="#c9e48e" opacity="0.55"/>
     <path d="M30 31 C34 26 42 25 46 28 C44 30 44 32 45 34 C40 32 35 32 30 31 Z M56 28 C62 24 70 27 72 31 C68 31 64 32 62 35 C61 32 58 30 56 28 Z" fill="#7da853" ${O2}/>
     <circle cx="34" cy="29" r="2" fill="#c9e48e"/><circle cx="66" cy="28" r="2" fill="#c9e48e"/>
     <path d="M16 78 Q50 89 84 78 C84 73 80 69 76 72 Q50 82 24 72 C19 70 16 73 16 78 Z" fill="#2f4a22" opacity="0.8"/>
     <path d="M78 54 C80 52 84 53 84 56 C84 58 81 59 79 58" fill="#c2412f" ${O2}/><path d="M80 58 L80 63" stroke="#f3e6c8" stroke-width="2"/>
     <circle cx="81" cy="54.5" r="0.9" fill="#f3e6c8"/><circle cx="83" cy="56" r="0.7" fill="#f3e6c8"/>
     <circle cx="24" cy="58" r="2.6" fill="#3f612b"/><circle cx="70" cy="68" r="2" fill="#3f612b"/><circle cx="30" cy="68" r="1.6" fill="#3f612b"/>
     <ellipse cx="62" cy="40" rx="3" ry="2" fill="#fff" opacity="0.5"/><ellipse cx="27" cy="50" rx="1.6" ry="1.2" fill="#fff" opacity="0.5"/>
     ${eye(40, 54, 8, 9)}${eye(61, 54, 8, 9)}
     <ellipse cx="32" cy="66" rx="4" ry="2.2" fill="#e5937a" opacity="0.55"/><ellipse cx="69" cy="66" rx="4" ry="2.2" fill="#e5937a" opacity="0.55"/>
     <path d="M45 67 Q50.5 72 56 67" fill="#3a2420" ${O2}/>`) };
}

export function thornImp() {
  const t = '#58733a';
  return { w: 92, h: 104, ax: 46, ay: 98, svg: S(92, 104, rg('s', '#b5603f', '#5e2419') + rg('e', '#fff3a0', '#e0a020', 0.5, 0.5, 0.5) + lg('h', '#8fae5a', '#3c5226'),
    `<path d="M66 78 C78 80 84 70 82 62 L78 66 L77 58 L72 64" fill="#7a3426" ${O2}/><path d="M80 58 L86 52 L82 62" fill="url(#h)" ${O2}/>
     <path d="M24 62 L10 54 L22 68 M22 74 L8 74 L22 80 M27 52 L19 40 L31 54" fill="url(#h)" ${O2}/>
     <path d="M31 87 L29 97 L41 97 L40 87 Z M51 87 L50 97 L62 97 L60 87 Z" fill="#3c271c" ${O2}/>
     <path d="M29 97 L27 100 M34 97 L33 100 M39 97 L39 100 M50 97 L49 100 M55 97 L55 100 M60 97 L61 100" stroke="${INK}" stroke-width="1.6"/>
     <path d="M24 90 C17 67 26 48 46 46 C66 48 74 67 67 90 Q46 97 24 90 Z" fill="url(#s)" ${O}/>
     <ellipse cx="47" cy="73" rx="12" ry="14" fill="#c9774e" opacity="0.75"/>
     <path d="M39 66 Q47 69 55 66 M39 72 Q47 75 55 72 M40 78 Q47 81 54 78" stroke="#8e3a28" stroke-width="1.4" fill="none"/>
     <path d="M66 62 C74 64 78 70 76 78 L70 75 L72 82 L65 77" fill="#7a3426" ${O2}/>
     <path d="M26 36 L4 26 L23 48 Z" fill="#8a3b2e" ${O}/><path d="M24 38 L11 31 L23 45 Z" fill="#d9846a"/>
     <path d="M66 36 L88 26 L69 48 Z" fill="#8a3b2e" ${O}/><path d="M68 38 L81 31 L69 45 Z" fill="#d9846a"/>
     <circle cx="46" cy="40" r="19" fill="url(#s)" ${O}/>
     <path d="M34 26 C29 15 33 6 41 4 C38 12 40 18 41 24 Z" fill="url(#h)" ${O2}/><path d="M35 18 L39 17 M34 12 L38 11" stroke="#3c5226" stroke-width="1.2"/>
     <path d="M58 26 C63 15 59 6 51 4 C54 12 52 18 51 24 Z" fill="url(#h)" ${O2}/><path d="M57 18 L53 17 M58 12 L54 11" stroke="#3c5226" stroke-width="1.2"/>
     <ellipse cx="39" cy="40" rx="6" ry="6.5" fill="url(#e)" ${O2}/><ellipse cx="54" cy="40" rx="6" ry="6.5" fill="url(#e)" ${O2}/>
     <ellipse cx="39.6" cy="40.5" rx="1.6" ry="4.4" fill="${INK}"/><ellipse cx="54.6" cy="40.5" rx="1.6" ry="4.4" fill="${INK}"/>
     <path d="M32 34 L44 36 M48 36 L60 34" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
     <path d="M35 50 Q46 57 57 50 Q46 54 35 50 Z" fill="${INK}" ${O2}/><path d="M39 51.5 L40.5 54.5 L42 52 M50 52 L51.5 54.5 L53 51.5" fill="#fff8ea"/>
     <path d="M30 30 C34 25 40 23 45 23" stroke="#e3a080" stroke-width="2" fill="none" opacity="0.7"/>`) };
}

export function thornbackBoar() {
  const spikes = [];
  for (let i = 0; i < 10; i++) {
    const x = 38 + i * 11.5, y = 50 - Math.sin((i / 9) * Math.PI) * 11, hgt = 20 + (i % 2) * 7 + Math.sin(i) * 3;
    spikes.push(`<path d="M${x - 7} ${y + 10} C${x - 3} ${y} ${x - 1} ${y - hgt * 0.6} ${x + 1} ${y - hgt} C${x + 4} ${y - hgt * 0.5} ${x + 6} ${y} ${x + 8} ${y + 10} Z" fill="url(#sp)" ${O2}/><path d="M${x + 0.5} ${y - hgt * 0.55} L${x + 1} ${y - hgt}" stroke="#d6eaa0" stroke-width="2.2" stroke-linecap="round"/>`);
  }
  const fur = [];
  for (let i = 0; i < 18; i++) { const x = 40 + (i % 9) * 13 + (i > 8 ? 6 : 0), y = 70 + (i > 8 ? 22 : 0); fur.push(`M${x} ${y} l7 -5`); }
  return { w: 214, h: 154, ax: 104, ay: 144, svg: S(214, 154,
    rg('b', '#8a5e44', '#3c271c', 0.45, 0.3, 0.8) + lg('sp', '#7c9c4c', '#3e5a26') + lg('hd', '#7d5540', '#4a3022') + rg('ey', '#fff3c4', '#ff5a2a', 0.5, 0.5, 0.5) + lg('tk', '#fff8ea', '#c9b48a'),
    `<path d="M28 98 C14 94 14 84 22 80" fill="none" ${O}/><path d="M22 80 L16 76 L20 84" fill="#3c271c" ${O2}/>
     <path d="M44 108 L46 138 L62 138 L60 108 Z M72 112 L72 140 L88 140 L88 112 Z M122 112 L122 140 L138 140 L138 112 Z M148 108 L146 138 L162 138 L164 108 Z" fill="#2c1d15" ${O}/>
     <path d="M44 136 L62 136 M72 138 L88 138 M122 138 L138 138 M146 136 L162 136" stroke="#5a4a40" stroke-width="3"/>
     ${spikes.join('')}
     <path d="M24 102 C18 66 48 44 98 44 C144 44 172 62 174 96 C174 116 154 126 100 126 C56 126 28 120 24 102 Z" fill="url(#b)" ${O}/>
     <path d="M30 106 C40 120 70 124 100 124 C140 124 162 116 170 104 C152 112 120 114 98 112 C70 112 46 110 30 106 Z" fill="#24170f" opacity="0.6"/>
     <path d="${fur.join(' ')}" stroke="#2c1d15" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.8"/>
     <path d="M46 62 C64 52 96 50 126 54" stroke="#a87a5a" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.6"/>
     <path d="M90 80 L104 96 M96 78 L108 92" stroke="#c0907a" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>
     <path d="M150 64 C180 58 200 78 198 100 C196 114 180 120 162 114 C150 108 146 86 150 64 Z" fill="url(#hd)" ${O}/>
     <path d="M156 62 L150 40 L170 60 Z" fill="#6d4834" ${O2}/><path d="M157 58 L154 47 L164 57 Z" fill="#c0907a"/>
     <ellipse cx="195" cy="98" rx="11" ry="13" fill="#b9826a" ${O}/><ellipse cx="197" cy="92" rx="4" ry="3" fill="#e0b0a0" opacity="0.6"/>
     <ellipse cx="195" cy="93" rx="2.2" ry="3.2" fill="${INK}"/><ellipse cx="195" cy="103" rx="2.2" ry="3.2" fill="${INK}"/>
     <path d="M178 110 C190 110 199 97 196 82 C190 93 186 101 172 104 Z" fill="url(#tk)" ${O2}/>
     <path d="M186 96 l3 -3 l1 4 l3 -2" stroke="#e0b45a" stroke-width="1.6" fill="none"/>
     <circle cx="173" cy="80" r="11" fill="#ff6a3a" opacity="0.28"/><circle cx="173" cy="80" r="5.6" fill="url(#ey)" ${O2}/><circle cx="174.5" cy="78.5" r="1.6" fill="#fff"/>
     <path d="M162 72 L182 74" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
     <path d="M164 92 L172 98 M166 88 L176 94" stroke="#3c271c" stroke-width="2" opacity="0.6"/>`) };
}

export function emberImp() {
  return { w: 92, h: 108, ax: 46, ay: 102, svg: S(92, 108, rg('s', '#8e3a28', '#2e1410') + lg('f', '#ffd889', '#c4492e') + rg('e', '#fff3c4', '#ffb020', 0.5, 0.5, 0.5),
    `<path d="M46 4 C54 14 59 20 54 31 C60 27 62 22 62 18 C69 29 64 40 56 44 L36 44 C27 40 23 29 30 18 C30 24 34 28 38 30 C34 20 40 13 46 4 Z" fill="url(#f)" ${O2}/>
     <path d="M46 16 C50 23 52 29 48 36 L44 36 C41 29 43 23 46 16 Z" fill="#fff3c4"/>
     <path d="M31 90 L29 101 L41 101 L40 90 Z M51 90 L50 101 L62 101 L60 90 Z" fill="#2a1a14" ${O2}/>
     <path d="M24 94 C17 71 26 53 46 51 C66 53 74 71 67 94 Q46 101 24 94 Z" fill="url(#s)" ${O}/>
     <path d="M35 66 L42 75 L37 84 M55 64 L50 73 L57 82 M46 58 L46 66" stroke="#ff8a3d" stroke-width="3" fill="none" stroke-linecap="round"/>
     <path d="M35 66 L42 75 L37 84 M55 64 L50 73 L57 82 M46 58 L46 66" stroke="#ffe0a0" stroke-width="1.1" fill="none" stroke-linecap="round"/>
     <path d="M26 41 L6 32 L23 52 Z M66 41 L86 32 L69 52 Z" fill="#5a2a22" ${O}/>
     <circle cx="46" cy="45" r="18" fill="url(#s)" ${O}/>
     <ellipse cx="39" cy="45" rx="5.5" ry="6" fill="url(#e)" ${O2}/><ellipse cx="53" cy="45" rx="5.5" ry="6" fill="url(#e)" ${O2}/>
     <ellipse cx="39.5" cy="45.5" rx="1.5" ry="4" fill="${INK}"/><ellipse cx="53.5" cy="45.5" rx="1.5" ry="4" fill="${INK}"/>
     <path d="M36 55 Q46 61 56 55 Q46 58 36 55 Z" fill="${INK}" ${O2}/>
     <path d="M68 72 C77 67 81 61 79 55" fill="none" stroke="#5a2a22" stroke-width="7" stroke-linecap="round"/>
     <circle cx="79" cy="50" r="9" fill="#ff8a3d" opacity="0.3"/><circle cx="79" cy="50" r="6" fill="url(#f)" ${O2}/><circle cx="79" cy="50" r="2.5" fill="#fff3c4"/>`) };
}

export function cinderBeetle() {
  return { w: 114, h: 88, ax: 57, ay: 82, svg: S(114, 88, rg('sh', '#6b5448', '#1e1512', 0.4, 0.3, 0.8) + lg('gl', '#ffe0a0', '#ff5a1a'),
    `<path d="M24 72 L12 84 M40 76 L33 86 M72 76 L79 86 M88 72 L100 84" ${O}/>
     <path d="M88 46 C101 44 109 52 107 61 C105 67 96 70 90 66" fill="#4e3a30" ${O}/>
     <path d="M100 50 C106 44 110 40 112 36 M102 58 C108 58 112 56 114 54" ${O2} fill="none"/>
     <circle cx="98" cy="55" r="3.4" fill="#ff8a3d"/><circle cx="98.6" cy="54.2" r="1.2" fill="#fff3c4"/>
     <path d="M12 62 C10 35 30 16 57 16 C82 16 98 35 96 62 C96 74 78 78 56 78 C31 78 12 74 12 62 Z" fill="url(#sh)" ${O}/>
     <path d="M55 18 L55 76" stroke="${INK}" stroke-width="3"/>
     <path d="M23 42 L33 48 L27 58 L37 64 M83 40 L75 48 L83 56 L73 64" stroke="url(#gl)" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M23 42 L33 48 L27 58 L37 64 M83 40 L75 48 L83 56 L73 64" stroke="#fff3c4" stroke-width="1" fill="none" stroke-linecap="round"/>
     <path d="M28 27 C36 21 47 19 52 20" stroke="#a08070" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.8"/>
     <path d="M62 22 C70 22 78 26 82 30" stroke="#8a7064" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.6"/>
     <path d="M18 66 Q56 74 92 66" stroke="#140e0b" stroke-width="3" fill="none" opacity="0.5"/>`) };
}

export function furnaceGolem() {
  return { w: 204, h: 196, ax: 102, ay: 188, svg: S(204, 196,
    lg('st', '#7a716b', '#3e3734') + lg('st2', '#8a807a', '#5b5450') + rg('fi', '#fff3c4', '#ff5a1a', 0.5, 0.75, 0.8) + lg('ru', '#f5d48a', '#a77a2c'),
    `<path d="M60 150 L58 188 L90 188 L90 150 Z M114 150 L114 188 L146 188 L144 150 Z" fill="#3a3330" ${O}/>
     <path d="M58 182 L90 182 M114 182 L146 182" stroke="#5b5450" stroke-width="4"/>
     <path d="M14 98 C6 120 12 144 30 150 L46 146 C40 128 42 110 50 98 Z" fill="url(#st2)" ${O}/>
     <path d="M190 98 C198 120 192 144 174 150 L158 146 C164 128 162 110 154 98 Z" fill="url(#st2)" ${O}/>
     <circle cx="28" cy="154" r="16" fill="#3a3330" ${O}/><circle cx="176" cy="154" r="16" fill="#3a3330" ${O}/>
     <path d="M20 150 L36 158 M168 158 L184 150" stroke="#5b5450" stroke-width="3"/>
     <path d="M40 62 C40 38 68 26 102 26 C136 26 164 38 164 62 L168 144 C168 160 138 166 102 166 C66 166 36 160 36 144 Z" fill="url(#st)" ${O}/>
     <path d="M44 70 L72 66 L76 88 L48 94 Z M130 66 L160 70 L156 96 L126 90 Z M60 124 L86 120 L88 146 L58 148 Z M118 122 L146 124 L144 148 L116 146 Z" fill="url(#st2)" ${O2}/>
     <path d="M50 76 L64 74 M136 76 L150 78 M66 132 L80 130 M124 132 L138 134" stroke="#9a908a" stroke-width="2" opacity="0.7"/>
     <path d="M48 104 C52 100 56 104 54 110 M150 108 C154 104 158 108 156 114" stroke="#5d6b3a" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>
     <path d="M72 96 C72 82 86 74 102 74 C118 74 132 82 132 96 L132 132 L72 132 Z" fill="#26201d" ${O}/>
     <path d="M78 130 C78 110 88 100 102 98 C116 100 126 110 126 130 Z" fill="url(#fi)"/>
     <path d="M72 106 L132 106 M72 118 L132 118 M88 76 L88 132 M102 74 L102 132 M116 76 L116 132" stroke="${INK}" stroke-width="3" opacity="0.85"/>
     <path d="M72 132 L132 132" ${O}/>
     <path d="M84 48 l6 -8 l6 8 l6 -8 l6 8 l6 -8" stroke="url(#ru)" stroke-width="3" fill="none" stroke-linecap="round"/>
     <path d="M68 24 C72 12 88 8 102 8 C116 8 132 12 136 24 Z" fill="#3a3330" ${O}/>
     <rect x="86" y="0" width="13" height="13" rx="2" fill="#3a3330" ${O2}/><rect x="107" y="2" width="11" height="11" rx="2" fill="#3a3330" ${O2}/>
     <ellipse cx="80" cy="54" rx="10" ry="6.5" fill="url(#fi)" ${O2}/><ellipse cx="124" cy="54" rx="10" ry="6.5" fill="url(#fi)" ${O2}/>
     <path d="M62 34 C76 28 92 26 104 26" stroke="#a09690" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"/>`) };
}
