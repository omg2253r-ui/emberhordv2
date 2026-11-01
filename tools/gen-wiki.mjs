// Builds wiki/data.json straight from the game's own data modules, so the wiki can never drift from the game.
// Run by tools/build-site.mjs on every deploy (or by hand: node tools/gen-wiki.mjs [outfile]).
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const imp = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);
const [items, wpn, bal, wbal, uniq, icons, craft, pets, skills, races, ults, zones, enemies, tower, bestiary,
  titles, arts, attrs, shop, rarity, change, dung, story] = await Promise.all([
  'data/items.js', 'data/weapons.js', 'data/balanceModel.js', 'data/weaponBalance.js', 'battle/uniques.js', 'art/icons.js',
  'data/crafting.js', 'data/pets.js', 'data/skills.js', 'data/races.js', 'data/ultimates.js', 'data/zones.js', 'data/enemies.js',
  'data/tower.js', 'data/bestiary.js', 'data/titles.js', 'data/artifacts.js', 'data/attributes.js', 'data/shop.js', 'data/rarity.js',
  'data/changelog.js', 'data/dungeons.js', 'data/story.js'].map(imp));

const { ITEMS } = items;
const safe = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch { return d; } };
const pct = (x) => (x * 100).toFixed(x < 0.01 ? 2 : 1).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1') + '%';
const nm = (id) => ITEMS[id]?.name || ENEMY[id]?.name || id;
const ENEMY = enemies.ALL_ENEMIES;
const R = rarity.RARITIES;
const rar = (id) => ({ r: id, rn: R[id]?.name || id, rc: R[id]?.color || '#999' });
const STATN = { ...items.STAT_NAMES, atk: 'ATK', def: 'DEF', hp: 'HP', crit: 'คริ', critMult: 'คริดาเมจ', spd: 'วิ่งเร็ว' };
const FXN = { hpPct: 'HP', atkPct: 'ATK', defPct: 'DEF', crit: 'คริติคอล', critMult: 'คริดาเมจ', spd: 'ความเร็ว', shieldPct: 'โล่', defFlat: 'DEF', healOnKill: 'ฟื้น HP เมื่อฆ่า', debuff: 'ดีบัฟ', guard: 'การกัน', counter: 'สวนกลับ', luck: 'โชค', goldPct: 'ทอง', xpPct: 'EXP' };
const fxLines = (o = {}) => Object.entries(o).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${FXN[k] || k} ${v > 0 ? '+' : ''}${Math.abs(v) < 5 ? Math.round(v * 1000) / 10 + '%' : v}`);
const statLines = (s = {}) => Object.entries(s).filter(([k]) => k !== 'unique').map(([k, v]) =>
  ['crit', 'critMult', 'spd', 'hpPct', 'atkPct'].includes(k) ? `${STATN[k] || k} ${k === 'critMult' ? '+' : ''}${Math.round(v * 100)}%` : `${STATN[k] || k} ${v}`);

// ---------- where does each item come from? (reverse index over every drop table in the game)
const where = {};
const addW = (id, text) => { (where[id] ||= []).push(text); };
const dropChance = (d, id) => { const tot = d.entries.reduce((a, e) => a + e.weight, 0); const e = d.entries.find((x) => x.id === id); return e ? d.chance * e.weight / tot : 0; };
const zoneName = (zid) => safe(() => zones.getZone(zid).name, zid);
const byItem = {};
for (const e of Object.values(ENEMY)) for (const d of e.drops || []) for (const en of d.entries) {
  const c = dropChance(d, en.id); if (!c) continue;
  const k = en.id + '|' + (e.boss ? 'B' : 'M') + '|' + (e.zone || '');
  const o = (byItem[k] ||= { id: en.id, boss: !!e.boss, zone: e.zone, names: [], c: 0 });
  o.names.push(e.name); o.c = Math.max(o.c, c);
}
for (const o of Object.values(byItem)) {
  const z = o.zone ? ` (${zoneName(o.zone)})` : '';
  addW(o.id, o.boss ? `บอส ${[...new Set(o.names)].join(', ')}${z} ดรอป ${pct(o.c)}` : `มอนสเตอร์${z ? 'ใน' + z : ''} ${[...new Set(o.names)].slice(0, 3).join(' · ')}${o.names.length > 3 ? ' และอีก' : ''} ดรอปได้ถึง ${pct(o.c)}`);
}
const bands = {};
for (let f = 1; f <= tower.TOWER.floors; f++) for (const kind of [tower.isGodFloor(f) ? 'เทพประจำชั้น' : tower.isEliteFloor(f) ? 'ผู้พิทักษ์ชั้นพิเศษ' : 'ชั้นทั่วไป']) {
  for (const d of safe(() => tower.floorDrops(f), [])) for (const en of d.entries) {
    const c = dropChance(d, en.id); if (!c) continue;
    const b = tower.bandOf(f), k = en.id + '|' + b + '|' + kind;
    const o = (bands[k] ||= { id: en.id, b, kind, lo: f, hi: f, c: 0 }); o.hi = f; o.c = Math.max(o.c, c);
  }
}
for (const o of Object.values(bands)) addW(o.id, `หอคอยขุมนรก ชั้น ${o.lo}–${o.hi} (${o.kind}) โอกาสสูงสุด ${pct(o.c)}`);
for (const s of shop.SHOP_STOCK) addW(s.itemId, `ร้านค้าในหมู่บ้าน ราคา ${s.price} ทอง`);
for (const it of Object.values(ITEMS)) if (it.src && !where[it.id]) addW(it.id, `ได้จากแหล่ง ${it.src}`);
const startKit = safe(() => Object.values(ITEMS).filter((i) => i.category === 'weapon').find((i) => i.id === 'w_rust_blade'));
if (startKit) addW(startKit.id, 'ติดตัวตั้งแต่เริ่มเกม');

// ---------- crafting (weapon recipes need a blueprint; everything else uses recipeFor)
const recipe = (id) => { const r = safe(() => craft.recipeFor(id)); return r ? { gold: r.gold, sparks: r.sparks || 0, mats: (r.mats || []).map((m) => [nm(m.id), m.qty]) } : null; };
const usedIn = {};
for (const id of Object.keys(ITEMS)) for (const m of recipe(id)?.mats || []) { const mid = Object.keys(ITEMS).find((k) => ITEMS[k].name === m[0]); if (mid) (usedIn[mid] ||= []).push(ITEMS[id].name); }

// ---------- items
const icon = (id) => safe(() => icons.svgDataUri(icons.itemIconSvg(id)), '');
const TIER_CUTS = [['SSS', 6000], ['SS', 3200], ['S', 1930], ['A', 1670], ['B', 1490], ['C', 1305], ['D', 1150], ['E', 1060], ['F', 0]]; // edit when the meta shifts
const W8 = { low: 0.2, mid: 0.3, max: 0.5 };
const geo = (id, m) => { const b = wbal.balOf(id)?.[m] ?? 1; return Math.exp(Object.entries(W8).reduce((a, [s, w]) => a + w * Math.log(bal.weaponIndex(id, s, m) * b), 0)); };
const weapons = Object.values(ITEMS).filter((d) => d.category === 'weapon').map((d) => ({ d, score: Math.round(Math.sqrt(geo(d.id, 'farm') * geo(d.id, 'pvp'))) }))
  .sort((a, b) => b.score - a.score);
const rkMed = {};
for (const g of Object.keys(R)) { const L = weapons.filter((w) => w.d.rarity === g).map((w) => w.score).sort((a, b) => a - b); if (L.length) rkMed[g] = L[Math.floor(L.length / 2)]; }
const order = Object.keys(R);
const tierOf = (s) => TIER_CUTS.find(([, lo]) => s >= lo)[0];
const tiers = TIER_CUTS.map(([t, lo]) => ({ t, lo, ids: [] }));
const W = {};
weapons.forEach(({ d, score }, i) => {
  const t = tierOf(score), ms = wpn.movesetFor(d), U = d.unique && uniq.UNIQUES[d.unique];
  const nxt = rkMed[order[order.indexOf(d.rarity) + 1]];
  const k = score >= rkMed[d.rarity] * 1.25 ? '🔥' : nxt && score >= nxt ? '💰' : '';
  tiers.find((x) => x.t === t).ids.push(d.id);
  const sc = (s) => bal.weaponIndex(d.id, s, 'farm');
  W[d.id] = { ...rar(d.rarity), n: d.name, ty: d.wtype, tier: t, k, score, rank: i + 1, svg: icon(d.id), desc: d.desc || '', stat: statLines(d.stats),
    reason: [`คะแนนความแรงรวม ${score} อันดับ ${i + 1} จาก ${weapons.length} อยู่ในเทียร์ ${t} คำนวณจากดาเมจต่อวินาทีของเกมจริง เฉลี่ยที่ตีบวก +0 / +10 / +20 และผสมโหมดฟาร์มกับ PvP พร้อมตัวคูณบาลานซ์ล่าสุด`,
      `ยิ่งตีบวกยิ่งแรง: +20 แรงกว่า +0 ราว ×${(sc('max') / sc('low')).toFixed(1)}`],
    unique: U ? { name: U.name, skill: U.skill, passive: U.passive, skillText: U.skillText } : null,
    moves: { combo: ms.combo.map((m) => m.name), charged: ms.charged?.name || ms.charged, dash: ms.dash?.name || ms.dash, branch: ms.branch?.name || ms.branch },
    craft: recipe(d.id), where: where[d.id] || ['ยังไม่มีข้อมูลแหล่งที่มา'] };
});
const types = Object.fromEntries(wpn.WEAPON_TYPE_IDS.map((id) => { const t = wpn.WEAPON_TYPES[id]; return [id, { id, name: t.name, desc: t.desc,
  combo: t.combo.map((m) => m.name), charged: t.charged?.name, dash: t.dash?.name, dual: !!t.dual, count: weapons.filter((w) => w.d.wtype === id).length }]; }));

const SLOT = items.SLOT_NAMES;
const catName = { armor: 'ชุดเกราะ', charm: 'เครื่องราง', wings: 'ปีก', material: 'วัตถุดิบ', consumable: 'ของใช้' };
const itemList = Object.values(ITEMS).filter((d) => d.category !== 'weapon').map((d) => ({ id: d.id, n: d.name, cat: d.category, catName: catName[d.category] || d.category,
  slot: SLOT[d.slot] || d.slot || null, ...rar(d.rarity), svg: icon(d.id), desc: d.desc || '', stat: statLines(d.stats),
  sell: d.sellPrice || null, where: where[d.id] || [], craft: recipe(d.id), usedIn: [...new Set(usedIn[d.id] || [])] }));

// ---------- the rest of the game
const petList = pets.PET_IDS.map((id) => { const p = pets.getPet(id); return { id, n: p.name, ...rar(p.rarity), role: p.role, desc: p.desc, ability: p.ability?.name,
  text: [1, pets.MAX_STARS].map((s) => safe(() => p.text(pets.petValues(p, s)), '')) , flying: !!p.flying }; });
const skillList = skills.SKILL_IDS.map((id) => { const s = skills.getSkill(id); return { id, n: s.name, ...rar(s.rarity), kind: s.kind, cat: s.cat, el: s.el || null, maxRank: s.maxRank,
  unlock: s.unlock?.level || null, lore: s.lore || '', ranks: Array.from({ length: s.maxRank }, (_, i) => safe(() => s.desc(skills.rankValues(s, i + 1)), '')),
  cd: s.cooldown || null }; });
const raceList = races.RACE_IDS.map((id) => { const r = races.getRace(id); return { id, n: r.name, ...rar(r.rarity), color: r.color, desc: r.desc, lore: r.lore,
  stats: fxLines(r.stats),
  skill: r.skill ? { name: r.skill.name, cd: r.skill.cooldown, text: r.skill.desc || r.skill.text || '' } : null }; });
const ultList = ults.ULT_IDS.map((id) => { const u = ults.getUlt(id); const t = ults.ULT_TIERS[u.tier]; return { id, n: u.name, tier: u.tier, tn: t?.name, rc: t?.color, el: u.el, wt: u.wt, desc: u.desc }; });
const zoneOf = (z) => ({ id: z.id, n: z.name, level: z.level, desc: z.desc, mech: z.mechanicText, boss: nm(z.boss), monsters: (z.monsters || []).map(nm), kind: z.raid ? 'raid' : 'zone', requires: z.requires || null });
const zoneList = [...zones.ZONES, ...zones.RAIDS].map(zoneOf);
const enemyList = Object.values(ENEMY).map((e) => ({ id: e.id, n: e.name, boss: !!e.boss, zone: e.zone ? zoneName(e.zone) : null, hp: e.hp, atk: e.atk, def: e.def, xp: e.xp, gold: e.gold,
  drops: [...new Set((e.drops || []).flatMap((d) => d.entries.map((x) => nm(x.id))))] }));
const bossList = bestiary.BOSSES.map((b) => ({ id: b.id, n: nm(b.id), epithet: b.epithet, el: b.el, phases: b.phases }));
const gods = tower.GODS.map((g) => ({ n: g.name, title: g.title, floor: g.floor, mech: g.mechanic, color: g.color }));
const affixes = tower.AFFIX_IDS.map((id) => ({ n: tower.AFFIXES[id].name, desc: tower.AFFIXES[id].desc, color: tower.AFFIXES[id].color }));
const artList = Object.values(arts.ARTIFACTS).map((a) => ({ id: a.id, n: a.name, ...rar(a.rarity), desc: a.desc, a: a.look?.a, b: a.look?.b, fx: fxLines(a.fx), kind: arts.KIND_INFO[arts.FX_KIND[Object.keys(a.fx || {})[0]]]?.name || '' }));
const titleList = titles.TITLES.map((t) => ({ id: t.id, n: t.name, tier: titles.TITLE_TIERS[t.t]?.name, rc: titles.TITLE_TIERS[t.t]?.color, how: t.how, bonus: safe(() => titles.titleBonusText(t.b || {}), '') }));
const attrList = attrs.ATTRS.map((a) => ({ n: a.name, en: a.en, color: a.color, desc: a.desc, fx: a.fx.map((f) => attrs.fxText(f, 1)) }));

const data = {
  version: change.GAME_VERSION, built: new Date().toISOString(),
  counts: {},
  weapons: { tiers, types, W, count: weapons.length }, items: itemList, pets: petList, skills: skillList, races: raceList, ults: ultList,
  zones: zoneList, enemies: enemyList, bosses: bossList, tower: { floors: tower.TOWER.floors, gods, affixes }, artifacts: artList, titles: titleList, attrs: attrList,
  shop: shop.SHOP_STOCK.map((s) => ({ n: nm(s.itemId), price: s.price, svg: icon(s.itemId) })),
  changelog: change.CHANGELOG.map((c) => ({ version: c.version, date: c.date, title: c.title, lead: c.lead, sections: (c.sections || []).map((s) => ({ title: s.title, items: s.items })) })),
};
data.counts = { weapons: weapons.length, items: itemList.length, pets: petList.length, skills: skillList.length, races: raceList.length, ults: ultList.length,
  zones: zoneList.length, enemies: enemyList.length, bosses: bossList.length, artifacts: artList.length, titles: titleList.length };

const out = process.argv[2] && !process.argv[2].startsWith('?') ? process.argv[2] : join(ROOT, 'wiki', 'data.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(data));
console.log(`wiki data v${data.version}:`, JSON.stringify(data.counts), '→', out);
