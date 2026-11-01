// Emberhold wiki renderer. All content comes from data.json, which tools/gen-wiki.mjs builds from the game's own source on every deploy.
const TC = { SSS: '#ff4d6d', SS: '#ff8a2b', S: '#ffc23a', A: '#a6d94a', B: '#4fcfa8', C: '#5aaeff', D: '#9a8cff', E: '#aaa8b4', F: '#7d7a86' };
const $ = (id) => document.getElementById(id);
const h = (t, a, ...k) => { const e = document.createElement(t); for (const x in a || {}) { if (x === 's') e.style.cssText = a[x]; else if (x in e && x !== 'list') e[x] = a[x]; else e.setAttribute(x, a[x]); } for (const c of k.flat(Infinity)) if (c != null && c !== false) e.append(c); return e; };
const num = (n) => Number(n).toLocaleString('en-US');
const lines = (a) => (a || []).filter(Boolean).map((x) => h('p', {}, x));
const pills = (a) => (a || []).map((x) => h('span', { className: 'pill' }, x));
let D = null, tab = 'weapons', wtype = null, last = null;

// ---- each tab turns records into tiles + a detail sheet: {id, name, sub, rc, svg?, glyph?, sections:[[title, nodes]], badges, desc}
const sec = (t, n) => (n && n.flat(Infinity).filter(Boolean).length ? [t, n] : null);
const craftNodes = (c) => c && c.mats ? [h('p', {}, h('b', {}, 'ค่าตี: '), num(c.gold) + ' ทอง' + (c.sparks ? ' · ' + num(c.sparks) + ' ประกาย' : '')), h('div', { className: 'ch' }, c.mats.map((m) => h('span', { className: 'b' }, m[0] + ' ×' + m[1])))] : null;
const T = {
  items: { name: 'ไอเทม', list: () => D.items.map((i) => ({ id: i.id, name: i.n, sub: i.catName, rc: i.rc, svg: i.svg, desc: i.desc, group: i.catName,
    badges: [i.rn, i.slot, i.sell && 'ขาย ' + num(i.sell) + ' ทอง'], sections: [sec('ค่าสถานะ', lines(i.stat)), sec('วิธีหา', [h('ul', {}, (i.where || []).map((x) => h('li', {}, x)))]), sec('วิธีคราฟ', craftNodes(i.craft)), sec('ใช้เป็นวัตถุดิบใน', pills(i.usedIn))] })) },
  pets: { name: 'สัตว์เลี้ยง', list: () => D.pets.map((p) => ({ id: p.id, name: p.n, sub: p.role, rc: p.rc, glyph: '🐾', desc: p.desc, group: p.rn,
    badges: [p.rn, p.role, p.flying && 'บิน'], sections: [sec('ความสามารถ: ' + (p.ability || ''), [h('p', {}, h('b', {}, '1 ดาว: '), p.text[0]), h('p', {}, h('b', {}, 'ดาวสูงสุด: '), p.text[1])])] })) },
  skills: { name: 'สกิล', list: () => D.skills.map((s) => ({ id: s.id, name: s.n, sub: s.kind === 'active' ? 'ใช้งาน' : 'ติดตัว', rc: s.rc, glyph: '✦', desc: s.lore, group: s.rn,
    badges: [s.rn, s.kind === 'active' ? 'สกิลใช้งาน' : 'สกิลติดตัว', s.el && 'ธาตุ ' + s.el, s.unlock && 'ปลดล็อกเลเวล ' + s.unlock, s.cd && 'คูลดาวน์ ' + s.cd.join('/') + ' วิ'], sections: [sec('แต่ละแรงค์', s.ranks.map((r, i) => h('p', {}, h('b', {}, 'แรงค์ ' + (i + 1) + ': '), r)))] })) },
  races: { name: 'เผ่า', list: () => D.races.map((r) => ({ id: r.id, name: r.n, sub: r.rn, rc: r.color, glyph: '☗', desc: r.desc, group: r.rn,
    badges: [r.rn, ...r.stats], sections: [sec('สกิลประจำเผ่า', r.skill && [h('p', {}, h('b', {}, r.skill.name), r.skill.cd ? ' · คูลดาวน์ ' + r.skill.cd + ' วิ' : ''), h('p', {}, r.skill.text)]), sec('ตำนาน', lines([r.lore]))] })) },
  ults: { name: 'อัลติเมท', list: () => D.ults.map((u) => ({ id: u.id, name: u.n, sub: u.tn, rc: u.rc, glyph: '⚡', desc: u.desc, group: 'ระดับ ' + u.tn, badges: [u.tn, u.el && 'ธาตุ ' + u.el, u.wt && 'อาวุธ ' + u.wt], sections: [] })) },
  zones: { name: 'ด่าน/เรด', list: () => D.zones.map((z) => ({ id: z.id, name: z.n, sub: 'เลเวล ' + z.level, rc: z.kind === 'raid' ? '#ff5f7a' : '#e0b45a', glyph: z.kind === 'raid' ? '☠' : '⚑', desc: z.desc, group: z.kind === 'raid' ? 'เรด' : 'โซน',
    badges: ['เลเวลแนะนำ ' + z.level, z.kind === 'raid' ? 'เรด' : 'โซน', 'บอส: ' + z.boss], sections: [sec('กลไกของด่าน', lines([z.mech])), sec('มอนสเตอร์', pills(z.monsters))] })) },
  enemies: { name: 'มอนสเตอร์/บอส', list: () => D.enemies.map((e) => { const b = D.bosses.find((x) => x.id === e.id); return { id: e.id, name: e.n, sub: e.boss ? 'บอส' : 'มอนสเตอร์', rc: e.boss ? '#ff8a2b' : '#9aa3ad', glyph: e.boss ? '☠' : '◆', desc: b ? b.epithet : '', group: e.boss ? 'บอส' : 'มอนสเตอร์',
    badges: [e.zone, 'HP ' + num(e.hp), 'ATK ' + e.atk, 'DEF ' + e.def, 'EXP ' + e.xp, e.gold && 'ทอง ' + e.gold.join('–')], sections: [sec('ดรอป', pills(e.drops)), sec('เฟสการต่อสู้', b && b.phases.map((p) => h('p', {}, h('b', {}, p[0] + ': '), p[1])))] }; }) },
  tower: { name: 'หอคอย', list: () => [...D.tower.gods.map((g) => ({ id: 'g' + g.floor, name: g.n, sub: 'ชั้น ' + g.floor, rc: g.color, glyph: '♛', desc: g.title, group: 'เทพประจำชั้น (หอคอย ' + D.tower.floors + ' ชั้น)', badges: ['ชั้น ' + g.floor], sections: [sec('กลไก', lines([g.mech]))] })),
    ...D.tower.affixes.map((a) => ({ id: 'a' + a.n, name: a.n, sub: 'ค่าเสริมศัตรู', rc: a.color, glyph: '✧', desc: a.desc, group: 'ค่าเสริมศัตรู (Affix)', badges: [], sections: [] }))] },
  artifacts: { name: 'อาร์ติแฟกต์', list: () => D.artifacts.map((a) => ({ id: a.id, name: a.n, sub: a.rn, rc: a.rc, glyph: '◈', desc: a.desc, group: a.rn, badges: [a.rn, a.kind], sections: [sec('ผลของอาร์ติแฟกต์', lines(a.fx))] })) },
  titles: { name: 'ฉายา', list: () => D.titles.map((t) => ({ id: t.id, name: t.n, sub: t.tier, rc: t.rc, glyph: '✪', desc: t.how, group: t.tier, badges: [t.tier, t.bonus], sections: [] })) },
  attrs: { name: 'แต้มสถานะ', list: () => D.attrs.map((a) => ({ id: a.en, name: a.n, sub: a.en, rc: a.color, glyph: a.en, desc: a.desc, group: 'ต่อ 1 แต้ม', badges: [], sections: [sec('ผลต่อ 1 แต้ม', lines(a.fx))] })) },
  shop: { name: 'ร้านค้า', list: () => D.shop.map((s) => ({ id: s.n, name: s.n, sub: num(s.price) + ' ทอง', rc: '#e0b45a', svg: s.svg, desc: '', group: 'สินค้าในร้านหมู่บ้าน', badges: ['ราคา ' + num(s.price) + ' ทอง'], sections: [] })) },
  log: { name: 'อัปเดตเกม', list: () => D.changelog.map((c) => ({ id: c.version, name: 'v' + c.version, sub: c.date, rc: '#ff7a1a', glyph: '↑', desc: c.title + ' — ' + c.lead, group: 'ประวัติเวอร์ชัน', badges: [c.date], sections: c.sections.map((s) => sec(s.title, [h('ul', {}, s.items.map((x) => h('li', {}, x)))])) })) },
};
const TABS = [['weapons', 'อาวุธ'], ...Object.entries(T).map(([k, v]) => [k, v.name])];

function drawBar() {
  const c = D.counts, n = { weapons: c.weapons, items: c.items, pets: c.pets, skills: c.skills, races: c.races, ults: c.ults, zones: c.zones, enemies: c.enemies, artifacts: c.artifacts, titles: c.titles };
  $('bar').replaceChildren(...TABS.map(([k, t]) => h('button', { className: 'tab', type: 'button', textContent: t + (n[k] ? ' ' + n[k] : ''), 'aria-pressed': String(k === tab), onclick: () => { tab = k; wtype = null; $('q').value = ''; draw(); scrollTo({ top: 0 }); } })));
}
const matches = (q, ...f) => !q || f.join(' ').toLowerCase().includes(q);
function draw() {
  drawBar(); $('tp').replaceChildren(); const o = $('out'), q = $('q').value.trim().toLowerCase(); o.replaceChildren();
  if (tab === 'weapons') return drawWeapons(o, q);
  const L = T[tab].list().filter((r) => matches(q, r.name, r.desc, r.sub, r.group, r.badges.join(' ')));
  if (!L.length) return o.append(h('p', { className: 'empty' }, 'ไม่พบรายการ'));
  const groups = [...new Set(L.map((r) => r.group))];
  for (const g of groups) { o.append(h('h3', { s: 'margin:14px 0 6px;font-size:16px' }, g), h('div', { className: 'grid' }, L.filter((r) => r.group === g).map((r) => tile(r)))); }
}
function tile(r) { return h('button', { className: 'tile', type: 'button', s: '--rc:' + r.rc, onclick: () => openRec(r) }, r.svg ? h('img', { src: r.svg, alt: '', loading: 'lazy' }) : h('div', { className: 'sw' }, r.glyph || '•'), r.name, h('small', {}, r.sub)); }
function show(...nodes) { last = document.activeElement; $('sh').replaceChildren(h('button', { className: 'x', type: 'button', id: 'xb', 'aria-label': 'ปิด', textContent: '✕', onclick: close }), ...nodes.flat(Infinity).filter(Boolean)); $('sc').classList.add('on'); document.body.style.overflow = 'hidden'; $('xb').focus(); }
function openRec(r) {
  show(h('div', { className: 'hd', s: '--rc:' + r.rc }, r.svg ? h('img', { src: r.svg, alt: r.name }) : h('div', { className: 'tile' }, h('div', { className: 'sw' }, r.glyph || '•')), h('div', {}, h('h2', {}, r.name), h('div', { className: 'bd' }, r.badges.filter(Boolean).map((b) => h('span', { className: 'b' }, b))))),
    r.desc ? h('p', { className: 'ds' }, r.desc) : null, r.sections.filter(Boolean).map(([t, n]) => [h('h3', {}, t), h('div', { className: 'lines' }, n)]));
}
function close() { $('sc').classList.remove('on'); document.body.style.overflow = ''; if (last && last.focus) last.focus(); }

// ---- weapons: tier list (kept from the original armory page)
function drawWeapons(o, q) {
  const W = D.weapons, p = $('tp');
  const tb = h('div', { className: 'bar', s: 'position:static;padding:0 0 6px' }, h('button', { className: 'tab', type: 'button', textContent: 'ทุกประเภท', 'aria-pressed': String(!wtype), onclick: () => { wtype = null; draw(); } }),
    ...Object.values(W.types).map((t) => h('button', { className: 'tab', type: 'button', textContent: t.name + ' ' + t.count, 'aria-pressed': String(wtype === t.id), onclick: () => { wtype = t.id; draw(); } })));
  p.append(tb);
  if (wtype) { const t = W.types[wtype]; p.append(h('div', { className: 'tp' }, h('h3', {}, t.name), h('p', {}, t.desc), h('p', {}, h('b', {}, 'ท่าต่อเนื่อง: '), t.combo.join(' → ')), h('p', {}, h('b', {}, 'ท่าชาร์จ: '), t.charged || '-'), h('p', {}, h('b', {}, 'ท่าสวนหลังกลิ้ง: '), t.dash || '-'), t.dual ? h('p', { className: 'note' }, 'อาวุธคู่') : null)); }
  p.append(h('p', { className: 'leg' }, '🔥 แรงเกินเทียร์ · 💰 คุ้มเกินความหายาก · แถบสีใต้ภาพคือความหายาก'));
  for (const t of W.tiers) {
    const ids = t.ids.filter((i) => (!wtype || W.W[i].ty === wtype) && matches(q, W.W[i].n, W.W[i].desc, W.W[i].rn));
    if (!ids.length) continue;
    o.append(h('div', { className: 'row' }, h('div', { className: 'lab', s: 'background:' + TC[t.t] + (t.t === 'F' ? ';color:#fff' : '') }, t.t), h('div', { className: 'tiles' }, ids.map((i) => { const w = W.W[i]; return h('button', { className: 'tile', type: 'button', s: '--rc:' + w.rc, onclick: () => openWeapon(i), 'aria-label': w.n + ' เทียร์ ' + w.tier }, w.k ? h('i', {}, w.k) : null, h('img', { src: w.svg, alt: '', loading: 'lazy' }), w.n); }))));
  }
}
function openWeapon(id) {
  const w = D.weapons.W[id], t = D.weapons.types[w.ty], mv = h('dl', { className: 'mv' });
  const add = (a, b) => { if (b && b.length) mv.append(h('dt', {}, a), h('dd', {}, Array.isArray(b) ? b.join(' → ') : b)); };
  add('ท่าต่อเนื่อง', w.moves.combo); add('ท่าชาร์จ', w.moves.charged); add('ท่าสวนหลังกลิ้ง', w.moves.dash); add('ท่าแตกแขนง', w.moves.branch);
  const u = w.unique;
  show(h('div', { className: 'hd', s: '--rc:' + w.rc }, h('img', { src: w.svg, alt: w.n }), h('div', {}, h('h2', {}, w.n), h('div', { className: 'bd' },
    h('span', { className: 'b tb', s: 'background:' + TC[w.tier] + (w.tier === 'F' ? ';color:#fff' : '') }, 'เทียร์ ' + w.tier), h('span', { className: 'b', s: 'border-color:' + w.rc }, w.rn),
    h('button', { className: 'b', type: 'button', textContent: 'ประเภท' + t.name, onclick: () => { close(); wtype = w.ty; draw(); } }), w.k ? h('span', { className: 'b' }, w.k) : null, ...w.stat.map((s) => h('span', { className: 'b' }, s))))),
    h('p', { className: 'ds' }, w.desc), h('h3', {}, 'ทำไมถึงได้เทียร์ ' + w.tier), lines(w.reason),
    h('h3', {}, 'ชื่อความสามารถ'), u ? h('div', { className: 'ab' }, h('b', {}, 'พลังเฉพาะ: ' + u.name), h('p', {}, u.passive), h('b', {}, 'สกิลเฉพาะ: ' + u.skill), h('p', {}, u.skillText), h('p', { className: 'note' }, 'ใน PvP พลังเฉพาะถูกลดสเกลลง')) : null, mv,
    h('h3', {}, 'วิธีคราฟ'), w.craft ? [h('p', {}, 'ต้องมีแบบแปลนก่อน: ได้อาวุธชิ้นนี้ 1 ชิ้นแล้วแลกเป็นแบบแปลนที่หัวหน้าหมู่บ้าน จากนั้นตีซ้ำได้ไม่จำกัด'), craftNodes(w.craft)] : h('p', {}, 'คราฟไม่ได้ ต้องได้จากการดรอปหรือรางวัลเท่านั้น'),
    h('h3', {}, 'วิธีหา'), h('ul', {}, w.where.map((x) => h('li', {}, x))));
}

$('sc').addEventListener('click', (e) => { if (e.target.id === 'sc') close(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
$('q').addEventListener('input', draw);

// ---- loading + live refresh: re-fetch data.json every few minutes; if the game was redeployed the page redraws by itself
function stamp(fresh) { const d = new Date(D.built).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); $('sub').replaceChildren('ข้อมูลตรงจากเกมเวอร์ชัน ', h('span', { className: 'ver' }, D.version), ` · อัปเดตล่าสุด ${d} · `, h('span', { className: 'live' }, fresh ? 'เพิ่งอัปเดตข้อมูลใหม่' : 'ซิงก์กับเกมอัตโนมัติ')); }
async function load(first) {
  try {
    const r = await fetch('data.json', { cache: 'no-cache' }); if (!r.ok) throw 0; const n = await r.json();
    if (D && D.built === n.built) return; const was = !!D; D = n; stamp(was); draw();
  } catch { if (first) { if (window.WIKI_DATA) { D = window.WIKI_DATA; stamp(false); draw(); } else $('sub').textContent = 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้'; } }
}
load(true); setInterval(() => load(false), 5 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) load(false); });
