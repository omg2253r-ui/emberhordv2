// v9.3 Egypt (สุสานสุริยะ): hand-drawn 64x64 item illustrations for everything that drops in the pyramid.
//
//  1. EGYPT_ICONS — the six items that only exist in z13 (art.icon = 'egy_…' on the item in data/egypt.js).
//     These replace the item's icon everywhere: bag, shop, tooltip, drop on the ground.
//  2. egySkinIconSvg(id) — an Egyptian look for the shared loot pool (iron shard, hide, cores, gear …). Those items are also
//     dropped in other lands, so the new look is only used for the loot lying on the ground inside z13 (sprite key
//     `icon_egy_<id>`, picked by battle/drops.js); the bag icon stays the same so the other lands do not change.
//     (v9.3.2: the ground no longer uses these skins — loot lying in z13 shows the same icon as the bag / pickup toast.)
//  3. egyGoldSvg / egySparkSvg — the coin and the amber spark inside the pyramid.
//
// The sun sword (w_sun_yoru) and the bosses are not touched.
import { INK } from './palette.js';

const O = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
const Ot = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

const C = Object.freeze({
  gold: '#f5c35a', goldMid: '#e0b45a', goldDark: '#a77a2c', goldLight: '#fff3c4',
  lapis: '#2a55c8', lapisDark: '#1a3580', turq: '#34e3a4', turqDark: '#1f9c78',
  carn: '#c2412f', carnDark: '#7a2218', linen: '#efe6d0', linenDark: '#c9bd9c',
  sand: '#d9b26a', bronze: '#b0703a', bronzeDark: '#7a4a24', black: '#0b0912', cyan: '#7fe8ff',
});

// small reusable pieces ---------------------------------------------------------------
const ankh = (x, y, s, fill = C.gold) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-9" rx="5" ry="6.5" fill="none" stroke="${INK}" stroke-width="${6 / 1}" /><ellipse cx="0" cy="-9" rx="5" ry="6.5" fill="none" stroke="${fill}" stroke-width="3.4"/><path d="M0 -2.5 L0 13 M-7 3 L7 3" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M0 -2.5 L0 13 M-7 3 L7 3" stroke="${fill}" stroke-width="3.4" stroke-linecap="round"/></g>`;
const sunDisc = (x, y, r, fill = C.gold, ray = C.goldLight) => `<g>${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<path d="M${(x + Math.cos(a) * (r + 1)).toFixed(1)} ${(y + Math.sin(a) * (r + 1)).toFixed(1)} L${(x + Math.cos(a) * (r + 5)).toFixed(1)} ${(y + Math.sin(a) * (r + 5)).toFixed(1)}" stroke="${ray}" stroke-width="2.2" stroke-linecap="round"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${Ot}/></g>`;
const glyphs = (x, y, n, col, w = 3) => Array.from({ length: n }, (_, i) => `<path d="M${x + i * (w + 1.6)} ${y} l0 ${i % 2 ? 4 : 3} m-1 -2 l2 0" stroke="${col}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`).join('');
const glow = (col, r = 26, op = 0.26) => `<circle cx="32" cy="32" r="${r}" fill="${col}" opacity="${op}"/>`;

// 1 · Egypt-only items ------------------------------------------------------------------
export const EGYPT_ICONS = Object.freeze({
  // ตราสุสานสุริยะ: a gold cartouche (the oval rope that circles a pharaoh's name) with the sun disc inside
  egy_sigil: (a) => `${glow(a.glow || C.goldLight)}
    <rect x="14" y="6" width="36" height="50" rx="18" fill="${C.goldDark}" ${O}/>
    <rect x="16" y="6" width="32" height="46" rx="16" fill="${a.main || C.goldMid}" ${O}/>
    <rect x="21" y="11" width="22" height="36" rx="11" fill="${C.black}" ${O}/>
    <path d="M18 56 L46 56" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M18 56 L46 56" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/>
    ${sunDisc(32, 25, 5.2, C.gold, C.goldLight)}
    <path d="M26 33 C26 40 38 40 38 33" stroke="${C.carn}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M24 38 Q32 44 40 38" stroke="${C.turq}" stroke-width="1.6" fill="none"/>
    ${glyphs(25, 41, 5, C.sand, 2.6)}`,

  // ตราชั่งหัวใจแห่งอนูบิส: the scale where a heart is weighed against the feather of Ma'at
  egy_scale: (a) => `${glow(a.main || C.cyan)}
    <path d="M32 8 L32 52" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M32 8 L32 52" stroke="${C.gold}" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M10 15 L54 15" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M10 15 L54 15" stroke="${C.goldMid}" stroke-width="3" stroke-linecap="round"/>
    <path d="M10 15 L4 33 M10 15 L16 33 M54 15 L48 33 M54 15 L60 33" stroke="${INK}" stroke-width="1.8" fill="none"/>
    <path d="M3 33 Q10 43 17 33 Z" fill="${C.goldDark}" ${O}/><path d="M47 33 Q54 43 61 33 Z" fill="${C.goldDark}" ${O}/>
    <path d="M10 31 C5 26 6 22 10 20 C14 22 15 26 10 31 Z" fill="${C.carn}" ${O}/>
    <path d="M54 32 C51 27 53 21 57 15 C58 22 58 28 54 32 Z" fill="${C.linen}" ${O}/><path d="M55 30 L56 18" stroke="${C.linenDark}" stroke-width="1.2"/>
    <circle cx="32" cy="9" r="4" fill="${a.main || C.cyan}" ${O}/><rect x="22" y="52" width="20" height="6" rx="2.5" fill="${C.goldDark}" ${O}/>`,

  // เขี้ยวสงครามเซคเมท: a lioness fang bound in gold, the sun disc cut into the root
  egy_fang: (a) => `${glow(a.glow || C.goldLight, 27, 0.3)}
    <path d="M32 2 C46 18 48 38 40 56 L24 56 C16 38 18 18 32 2 Z" fill="${a.main || '#ff5a3a'}" opacity="0.28"/>
    <path d="M24 56 C17 40 19 18 36 3 C34 14 42 22 41 34 C43 42 40 50 38 56 Z" fill="${C.linen}" ${O}/>
    <path d="M30 52 C25 38 26 22 35 8 C34 18 38 26 37 36 C38 42 36 48 35 52 Z" fill="${a.main || '#ff5a3a'}" opacity="0.85"/>
    <path d="M33 12 C30 24 30 38 31 48" stroke="${C.goldLight}" stroke-width="1.6" fill="none"/>
    <path d="M20 50 L44 50 L42 58 L22 58 Z" fill="${C.goldMid}" ${O}/><path d="M22 54 L42 54" stroke="${C.goldDark}" stroke-width="1.6"/>
    ${sunDisc(32, 54, 2.6, C.carn, C.goldMid)}`,

  // ดวงตาสุริยเทพรา: the eye of Ra — a wedjat eye with the sun disc as its pupil
  egy_eye: (a) => `${glow(a.glow || '#ffffff', 28, 0.34)}
    <g>${Array.from({ length: 12 }, (_, i) => { const t = (i * Math.PI) / 6; return `<path d="M${(32 + Math.cos(t) * 20).toFixed(1)} ${(30 + Math.sin(t) * 18).toFixed(1)} L${(32 + Math.cos(t) * 27).toFixed(1)} ${(30 + Math.sin(t) * 25).toFixed(1)}" stroke="${C.gold}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`; }).join('')}</g>
    <path d="M6 30 Q32 6 58 30 Q32 52 6 30 Z" fill="${C.linen}" ${O}/>
    <path d="M8 30 Q32 10 56 30" stroke="${C.lapis}" stroke-width="3.4" fill="none"/>
    <circle cx="32" cy="30" r="11" fill="${a.main || C.gold}" ${O}/><circle cx="32" cy="30" r="6" fill="${C.black}"/><circle cx="29.6" cy="27.6" r="2" fill="#fff"/>
    <path d="M40 36 Q42 48 34 52 Q32 56 26 56" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M40 36 Q42 48 34 52 Q32 56 26 56" stroke="${C.lapis}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M6 30 L1 24 M58 30 L63 26" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,

  // เกราะฟาโรห์สุริยะ: linen body, a broad collar (usekh) of gold, lapis and turquoise rows, a cobra at the heart
  egy_pharaoh: (a) => `<path d="M17 12 L25 8 Q32 13 39 8 L47 12 L55 24 L49 30 L47 26 L47 57 Q32 61 17 57 L17 26 L15 30 L9 24 Z" fill="${a.main || C.linen}" ${O}/>
    <path d="M17 44 L47 44 M17 50 L47 50" stroke="${C.linenDark}" stroke-width="1.4"/>
    <path d="M18 56 Q32 60 46 56 L46 48 L18 48 Z" fill="${a.trim || C.gold}" opacity="0.9" ${O}/>
    <path d="M13 12 Q32 40 51 12 L47 10 Q32 32 17 10 Z" fill="${C.goldDark}" ${O}/>
    <path d="M16 13 Q32 38 48 13" stroke="${C.gold}" stroke-width="4.2" fill="none"/>
    <path d="M19 15 Q32 34 45 15" stroke="${C.lapis}" stroke-width="3.2" fill="none"/>
    <path d="M22 17 Q32 31 42 17" stroke="${C.turq}" stroke-width="2.6" fill="none"/>
    <path d="M25 19 Q32 28 39 19" stroke="${C.carn}" stroke-width="2.2" fill="none"/>
    <path d="M32 24 C29 26 29 31 32 33 C35 31 35 26 32 24 Z" fill="${C.goldMid}" ${Ot}/>
    <path d="M32 22 C30 18 33 15 33 12" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M32 22 C30 18 33 15 33 12" stroke="${C.turq}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="33" cy="11" r="2.4" fill="${C.carn}" ${Ot}/>
    <path d="M9 24 L16 28 M55 24 L48 28" stroke="${C.gold}" stroke-width="2.6"/>
    <path d="M22 36 L42 36" stroke="${C.goldDark}" stroke-width="1.6"/>${glyphs(22, 38, 6, C.goldDark, 2.6)}`,

  // ด้วงทองนำโชค: the sacred scarab, wings folded over its back, on a cord of gold beads
  egy_scarab: (a) => `${glow(a.main || C.goldLight, 24, 0.28)}
    <path d="M12 8 Q32 22 52 8" stroke="${INK}" stroke-width="4" fill="none"/><path d="M12 8 Q32 22 52 8" stroke="${C.goldDark}" stroke-width="1.8" fill="none"/>
    <circle cx="20" cy="15" r="2.6" fill="${C.gold}" ${Ot}/><circle cx="44" cy="15" r="2.6" fill="${C.gold}" ${Ot}/><circle cx="32" cy="19" r="2.6" fill="${C.turq}" ${Ot}/>
    <path d="M32 22 L32 26" stroke="${INK}" stroke-width="2.4"/>
    <path d="M24 34 C14 30 8 38 10 46 C14 54 26 52 30 46 Z" fill="${C.lapis}" ${O}/><path d="M40 34 C50 30 56 38 54 46 C50 54 38 52 34 46 Z" fill="${C.lapis}" ${O}/>
    <path d="M14 38 L26 44 M13 44 L26 48 M50 38 L38 44 M51 44 L38 48" stroke="${C.turq}" stroke-width="1.6"/>
    <ellipse cx="32" cy="42" rx="10" ry="13" fill="${a.main || '#fff3a0'}" ${O}/>
    <path d="M32 30 L32 54 M25 38 Q32 42 39 38" stroke="${C.goldDark}" stroke-width="1.6" fill="none"/>
    <path d="M25 31 Q32 24 39 31 Z" fill="${C.goldMid}" ${O}/><path d="M28 28 L26 24 M36 28 L38 24" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="32" cy="57" r="3" fill="${C.goldMid}" ${Ot}/>`,
});

// 2 · Egyptian look for the shared loot pool (ground drops inside z13) ------------------------
const khopesh = (blade = C.goldLight, edge = C.gold) => `<g transform="rotate(32 32 32)">
  <path d="M26 54 L26 22 C26 8 40 4 46 10 C40 8 34 12 34 22 L34 54 Z" fill="${blade}" ${O}/><path d="M30 50 L30 20 C30 14 34 11 38 11" stroke="${edge}" stroke-width="1.8" fill="none"/>
  <rect x="22" y="50" width="16" height="5" rx="2" fill="${C.goldDark}" ${O}/><rect x="27" y="55" width="6" height="7" rx="2" fill="${C.carn}" ${O}/></g>`;
const bladeHilt = (blade, tilt = 38) => `<g transform="rotate(${tilt} 32 32)"><path d="M28 46 L28 10 L32 3 L36 10 L36 46 Z" fill="${blade}" ${O}/><path d="M32 8 L32 44" stroke="${C.goldLight}" stroke-width="1.6"/><rect x="21" y="45" width="22" height="6" rx="2.5" fill="${C.goldMid}" ${O}/><rect x="29" y="51" width="6" height="9" rx="2" fill="${C.lapis}" ${O}/><circle cx="32" cy="61" r="2.6" fill="${C.gold}" ${O}/></g>`;

const SKIN = {
  m_iron_shard: () => `${glow(C.bronze, 22, 0.2)}<path d="M12 48 L20 22 L31 29 L26 52 Z" fill="${C.bronze}" ${O}/><path d="M28 52 L35 16 L50 26 L45 54 Z" fill="${C.sand}" ${O}/><path d="M16 44 L21 30 M38 24 L43 46" stroke="${C.bronzeDark}" stroke-width="2"/>${glyphs(34, 33, 4, C.bronzeDark, 2.4)}<path d="M36 20 L40 24" stroke="${C.goldLight}" stroke-width="2.4" stroke-linecap="round"/>`,
  m_beast_hide: () => `<path d="M12 14 Q22 8 32 12 Q42 8 52 14 L50 28 L56 36 L48 40 L50 52 Q32 58 14 52 L16 40 L8 36 L14 28 Z" fill="#c99a5a" ${O}/>${[[22, 24], [38, 22], [30, 34], [42, 40], [20, 44], [32, 48]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2.6" fill="${C.bronzeDark}" opacity="0.85"/>`).join('')}<path d="M18 12 L46 12" stroke="${C.gold}" stroke-width="3.6" stroke-linecap="round"/><path d="M18 12 L46 12" stroke="${INK}" stroke-width="1" stroke-dasharray="2 4"/><circle cx="32" cy="12" r="3.4" fill="${C.turq}" ${O}/>`,
  m_thorn_core: () => `${glow(C.turq, 24, 0.28)}<circle cx="32" cy="42" r="14" fill="${C.turq}" ${O}/><circle cx="32" cy="42" r="8" fill="${C.turqDark}" opacity="0.5"/><path d="M32 30 C22 28 14 20 12 10 C22 12 28 18 32 30 Z" fill="${C.linen}" ${O}/><path d="M32 30 C42 28 50 20 52 10 C42 12 36 18 32 30 Z" fill="${C.linen}" ${O}/><path d="M32 32 C26 24 26 12 32 4 C38 12 38 24 32 32 Z" fill="${C.carn}" ${O}/><path d="M32 12 L32 28" stroke="${C.goldLight}" stroke-width="1.6"/><path d="M25 38 Q28 33 33 35" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>`,
  m_ember_core: () => `${glow('#ff7a33', 26, 0.32)}${sunDisc(32, 32, 13, '#ff7a33', C.gold)}<circle cx="32" cy="32" r="8" fill="${C.carn}" ${Ot}/><path d="M32 22 C36 27 37 29 36 33 C35 36 29 36 28 33 C27 30 29 28 30 26 C31 28 31.6 28 32 27 Z" fill="${C.goldLight}" ${Ot}/>`,
  m_bloodstone: () => `${glow('#ff3a3a', 26, 0.3)}<path d="M32 4 C22 4 18 12 18 18 C18 24 24 28 30 28 L30 34 L20 34 L20 40 L30 40 L30 58 L34 58 L34 40 L44 40 L44 34 L34 34 L34 28 C40 28 46 24 46 18 C46 12 42 4 32 4 Z" fill="${C.goldMid}" ${O}/><path d="M32 9 C38 14 40 18 38 21 A6 6 0 0 1 26 21 C24 18 28 14 32 9 Z" fill="#ff3a3a" ${O}/><path d="M28 15 L30 12" stroke="#ffd0c0" stroke-width="2.6" stroke-linecap="round"/>`,
  // gear — weapons drawn by type, so each of the 14 drops reads differently
  w_ember_fang: () => khopesh(),
  w_moonfall_katana: () => `<g transform="rotate(40 32 32)"><path d="M29 48 C25 32 28 14 38 3 C37 16 38 32 36 48 Z" fill="${C.linen}" ${O}/><path d="M35 8 C34 22 34 34 34 44" stroke="${C.lapis}" stroke-width="1.8" fill="none"/><rect x="22" y="47" width="20" height="5" rx="2.5" fill="${C.goldMid}" ${O}/><path d="M32 52 L32 61" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M32 52 L32 61" stroke="${C.black}" stroke-width="3.6" stroke-linecap="round"/><path d="M28 62 L30 57 L34 57 L36 62" fill="${C.black}" ${Ot}/></g><path d="M10 16 A7 7 0 1 0 10 28 A5.4 5.4 0 1 1 10 16 Z" fill="${C.goldLight}" ${Ot}/>`,
  w_cinder_talons: () => `<g transform="rotate(35 32 32)"><path d="M29 46 L28 16 L32 6 L36 16 L35 46 Z" fill="${C.bronze}" ${O}/><path d="M32 10 L32 44" stroke="${C.goldLight}" stroke-width="1.4"/><rect x="24" y="45" width="16" height="5" rx="2" fill="${C.goldMid}" ${O}/><rect x="29" y="50" width="6" height="9" rx="2" fill="${C.carn}" ${O}/></g><g transform="rotate(-30 32 32) translate(10 12) scale(0.7)"><path d="M29 46 L28 16 L32 6 L36 16 L35 46 Z" fill="${C.sand}" ${O}/><rect x="24" y="45" width="16" height="5" rx="2" fill="${C.goldMid}" ${O}/><rect x="29" y="50" width="6" height="9" rx="2" fill="${C.lapis}" ${O}/></g>`,
  w_furnace_cleaver: () => `<g transform="rotate(38 32 32)"><path d="M24 48 L24 12 L32 2 L40 12 L40 48 Z" fill="${C.bronze}" ${O}/><path d="M32 6 L32 46" stroke="${C.goldLight}" stroke-width="2"/><path d="M27 20 L37 20 M27 30 L37 30" stroke="${C.bronzeDark}" stroke-width="1.8"/><path d="M16 46 L48 46 L44 53 L20 53 Z" fill="${C.goldMid}" ${O}/><circle cx="32" cy="49.5" r="3" fill="${C.turq}" ${Ot}/><rect x="29" y="53" width="6" height="8" rx="2" fill="${C.lapisDark}" ${O}/></g>`,
  w_ember_scepter: () => `<g transform="rotate(28 32 32)"><path d="M32 22 L32 62" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M32 22 L32 62" stroke="${C.goldMid}" stroke-width="3.6" stroke-linecap="round"/><path d="M26 16 C26 8 34 4 42 6 L40 11 C36 10 32 12 32 16 L32 24 L26 24 Z" fill="${C.sand}" ${O}/><circle cx="35" cy="9" r="1.4" fill="${INK}"/><path d="M27 60 L23 63 M37 60 L41 63" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="30" r="3" fill="${C.turq}" ${Ot}/></g>`,
  w_sunfire_bow: () => `<path d="M16 6 C40 12 48 26 48 32 C48 38 40 52 16 58" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M16 6 C40 12 48 26 48 32 C48 38 40 52 16 58" stroke="${C.goldMid}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M16 6 L16 58" stroke="${C.linen}" stroke-width="1.6"/><path d="M12 32 L50 32 L44 28 M50 32 L44 36" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>${sunDisc(48, 32, 3.6, C.carn, C.gold)}`,
  w_ember_glaive: () => `<g transform="rotate(36 32 32)"><path d="M32 2 C41 12 41 24 34 32 L30 32 C23 24 23 12 32 2 Z" fill="${C.bronze}" ${O}/><path d="M32 7 L32 30" stroke="${C.goldLight}" stroke-width="1.6"/><path d="M26 32 L38 32 L36 38 L28 38 Z" fill="${C.gold}" ${O}/><path d="M32 38 L32 62" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M32 38 L32 62" stroke="${C.carnDark}" stroke-width="3" stroke-linecap="round"/><path d="M26 36 C28 40 30 38 32 36 C34 38 36 40 38 36" stroke="${C.turq}" stroke-width="2" fill="none"/></g>`,
  w_ember_scythe: () => `<g transform="rotate(14 32 32)"><path d="M30 8 L34 62" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 8 L34 62" stroke="${C.goldMid}" stroke-width="3.6" stroke-linecap="round"/><path d="M31 10 C20 4 8 10 6 24 C14 16 22 16 30 22 Z" fill="${C.sand}" ${O}/><path d="M8 22 C14 16 22 16 29 20" stroke="${C.goldLight}" stroke-width="1.6" fill="none"/><path d="M31 10 C38 6 46 8 50 14 C44 12 38 14 34 18 Z" fill="${C.goldMid}" ${O}/></g>`,
  w_twin_embers: () => `<g transform="translate(-2 2) rotate(-38 32 32) scale(0.92)"><path d="M26 54 L26 22 C26 8 40 4 46 10 C40 8 34 12 34 22 L34 54 Z" fill="${C.goldLight}" ${O}/><rect x="22" y="50" width="16" height="5" rx="2" fill="${C.goldDark}" ${O}/><rect x="27" y="55" width="6" height="7" rx="2" fill="${C.carn}" ${O}/></g><g transform="translate(66 2) scale(-1 1) rotate(-38 32 32) scale(0.92)"><path d="M26 54 L26 22 C26 8 40 4 46 10 C40 8 34 12 34 22 L34 54 Z" fill="${C.sand}" ${O}/><rect x="22" y="50" width="16" height="5" rx="2" fill="${C.goldDark}" ${O}/><rect x="27" y="55" width="6" height="7" rx="2" fill="${C.lapis}" ${O}/></g>`,
  // armour — linen, gold and lapis in three weights
  a_lacquer_plate: () => armorBase(C.linen, C.gold) + `<path d="M22 20 Q32 26 42 20 L42 34 Q32 40 22 34 Z" fill="${C.goldMid}" ${O}/><path d="M26 25 Q32 29 38 25 M26 30 Q32 34 38 30" stroke="${C.lapis}" stroke-width="2" fill="none"/>`,
  a_iron_bastion: () => armorBase(C.bronze, C.goldMid) + `<path d="M20 18 Q32 24 44 18 L44 36 Q32 42 20 36 Z" fill="${C.sand}" ${O}/>${[24, 29, 34].map((y) => `<path d="M22 ${y} L42 ${y}" stroke="${C.bronzeDark}" stroke-width="1.6"/>`).join('')}<path d="M8 20 L18 12 L22 24 L12 30 Z M56 20 L46 12 L42 24 L52 30 Z" fill="${C.goldMid}" ${O}/><circle cx="32" cy="28" r="4.4" fill="${C.carn}" ${O}/>`,
  a_wolf_knight: () => armorBase('#4a4a52', C.cyan) + `<path d="M20 12 L18 2 L26 8 M44 12 L46 2 L38 8" fill="${C.black}" ${O}/><path d="M22 14 Q32 22 42 14 L40 30 Q32 36 24 30 Z" fill="${C.black}" ${O}/><path d="M26 22 L29 24 M38 22 L35 24" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/><path d="M30 28 L34 28 L32 32 Z" fill="${C.goldMid}" ${Ot}/><path d="M24 44 L40 44" stroke="${C.gold}" stroke-width="2.4"/>`,
  c_cinder_eye: () => `<circle cx="32" cy="34" r="20" fill="${C.goldDark}" ${O}/><circle cx="32" cy="34" r="14.5" fill="${C.gold}" ${O}/><path d="M18 34 Q32 22 46 34 Q32 46 18 34 Z" fill="${C.linen}" ${O}/><circle cx="32" cy="34" r="5.6" fill="${C.carn}" ${O}/><circle cx="32" cy="34" r="2.4" fill="${C.black}"/><path d="M36 38 Q37 44 31 46" stroke="${C.black}" stroke-width="2" fill="none"/><path d="M32 10 L32 14" ${O}/>`,
  wg_sky_crystal: () => `<g>${[0, 1, 2, 3, 4].map((i) => `<path d="M30 ${36 - i * 4} C${24 - i * 4} ${30 - i * 4} ${12 - i * 2} ${28 - i * 3} ${5 + i} ${32 - i * 3} C${14 - i} ${36 - i * 2} ${22} ${40 - i * 3} 30 ${42 - i * 4} Z" fill="${['#2a55c8', '#34e3a4', '#f5c35a', '#efe6d0', '#2a55c8'][i]}" ${Ot}/>`).join('')}</g><g transform="translate(64 0) scale(-1 1)">${[0, 1, 2, 3, 4].map((i) => `<path d="M30 ${36 - i * 4} C${24 - i * 4} ${30 - i * 4} ${12 - i * 2} ${28 - i * 3} ${5 + i} ${32 - i * 3} C${14 - i} ${36 - i * 2} ${22} ${40 - i * 3} 30 ${42 - i * 4} Z" fill="${['#2a55c8', '#34e3a4', '#f5c35a', '#efe6d0', '#2a55c8'][i]}" ${Ot}/>`).join('')}</g><circle cx="32" cy="38" r="4.4" fill="${C.carn}" ${O}/>`,
};
function armorBase(main, trim) {
  return `<path d="M18 12 L26 8 Q32 14 38 8 L46 12 L54 22 L48 28 L46 24 L46 56 Q32 60 18 56 L18 24 L16 28 L10 22 Z" fill="${main}" ${O}/><path d="M18 50 Q32 56 46 50" stroke="${trim}" stroke-width="3" fill="none"/>`;
}

export const EGY_SKIN_IDS = Object.freeze(Object.keys(SKIN));

export function egyIconSvg(key, art = {}) {
  const fn = EGYPT_ICONS[key];
  return fn ? wrap(fn(art)) : null;
}

export function egySkinIconSvg(id) {
  const fn = SKIN[id];
  return fn ? wrap(fn()) : null;
}

// 3 · coin and spark ------------------------------------------------------------------
export function egyGoldSvg() {   // a gold ring-coin (the deben) with an ankh cut into it
  return wrap(`<circle cx="32" cy="36" r="21" fill="${C.goldDark}" ${O}/><circle cx="32" cy="32" r="21" fill="${C.gold}" ${O}/>
    <circle cx="32" cy="32" r="14.5" fill="none" stroke="${C.goldDark}" stroke-width="2.4"/>
    ${ankh(32, 31, 0.72, C.goldDark)}
    <path d="M17 22 C19 18 23 15 27 14" stroke="#fff3c4" stroke-width="3" stroke-linecap="round" fill="none"/>`);
}
export function egySparkSvg() {   // the amber spark as a winged sun
  return wrap(`<circle cx="32" cy="32" r="26" fill="#ffb35a" opacity="0.24"/>
    <path d="M30 30 C22 22 10 24 4 30 C12 30 18 33 22 38 C14 36 8 38 6 42 C16 42 24 40 30 38 Z" fill="${C.lapis}" ${O}/>
    <path d="M34 30 C42 22 54 24 60 30 C52 30 46 33 42 38 C50 36 56 38 58 42 C48 42 40 40 34 38 Z" fill="${C.lapis}" ${O}/>
    <path d="M14 31 L28 34 M50 31 L36 34" stroke="${C.turq}" stroke-width="1.8"/>
    ${sunDisc(32, 32, 8.5, '#f5b041', '#ffe2a0')}<circle cx="32" cy="32" r="4.2" fill="#fff6dc"/>`);
}
