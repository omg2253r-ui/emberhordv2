// The rift board: the ten online zones with their level, mechanic, monsters, boss and rewards, and below them
// the special dungeons (ดันพิเศษ) — one great boss each, a story told in chapters, and the rarest drops in the game.
// Go alone, or open an expedition room (up to 4 players) that everyone online can join.
import { h, glyph, itemImg, pct } from './dom.js';
import { tipTarget } from './itemTip.js';
import { dropOdds } from '../systems/loot.js';
import { ZONES, PORTAL_ZONES, RAIDS, clearReward, getZone, raidCooldown, rushZone, RUSH } from '../data/zones.js';
import { getEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';

export function zoneLock(st, zone, now = Date.now()) {
  if (zone.raid || zone.rush) {
    const req = zone.requires || {};
    if (req.level && st.player.level < req.level) return `ต้องเลเวล ${req.level} ขึ้นไป`;
    if (req.zone && !st.zones.cleared[req.zone]) return `พิชิต${getZone(req.zone).name}ก่อน`;
    if (req.raid && !st.zones.cleared[req.raid]) return `ปราบ${getEnemy(getZone(req.raid).boss).name}ก่อน`;
    const cd = raidCooldown(st, zone.id, now);
    if (cd > 0) return `บอสยังหลับ ตื่นใน ${fmtClock(cd)}`;
    return null;
  }
  if (st.player.level < zone.level - 3) return `ต้องเลเวล ${zone.level - 3} ขึ้นไป`;
  if (zone.n === 1) return st.progress.cleared.s1 ? null : 'ผ่านป่าหนามสนธยาในเนื้อเรื่องก่อน';
  const prev = ZONES[zone.n - 2];
  return st.zones.cleared[prev.id] ? null : `พิชิต${prev.name}ก่อน`;
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function fmtClock(ms) {
  const s = Math.ceil(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// compact: the long tail of random gear folds into one "+N" chip so the card stays readable
function oddsRow(boss, compact = false) {
  const all = dropOdds(boss.drops).filter((d) => getItem(d.id)).sort((a, b) => b.chance - a.chance);
  const rare = (d) => ['epic', 'legendary', 'mythic'].includes(getItem(d.id).rarity);
  const shown = compact ? all.filter((d) => d.chance >= 0.1 || rare(d)) : all;
  const rest = all.length - shown.length;
  return h('div', { class: 'odds zone-odds' }, h('span', { class: 'muted' }, 'บอสดรอป'),
    shown.map((d) => tipTarget(h('span', {}, itemImg(d.id), h('span', { class: 'num' }, pct(d.chance, d.chance < 0.01 ? 2 : d.chance < 0.1 ? 1 : 0))), d.id, { chance: d.chance })),
    rest > 0 ? h('span', { class: 'muted', title: 'อุปกรณ์สุ่มระดับทั่วไปถึงหายาก' }, `+ อุปกรณ์สุ่มอีก ${rest} ชนิด`) : null);
}

function actions(app, z, lock, close) {
  const o = app.online;
  if (lock) return h('button', { class: 'btn', type: 'button', disabled: true, 'data-lock': z.id }, glyph(z.raid && /หลับ/.test(lock) ? 'clock' : 'lock'), lock);
  return h('div', { class: 'zone-actions' },
    h('button', { class: 'btn', type: 'button', 'data-action': 'zone-solo', onclick: () => { close(); app.startZoneSolo(z.id); } }, glyph('sword'), 'ลุยคนเดียว'),
    h('button', { class: 'btn primary', type: 'button', 'data-action': 'zone-party', disabled: !o.canSend(), title: o.canSend() ? '' : (o.online ? 'บัญชีนี้ดูอย่างเดียว' : o.reason),
      onclick: async () => { close(); await app.openExpedition(z.id); } }, glyph('people'), 'เปิดคณะสำรวจ (สูงสุด 4)'));
}

export { actions as zoneActions };

function zoneCard(app, st, z, close) {
  const lock = zoneLock(st, z);
  const cleared = st.zones.cleared[z.id] || 0;
  const boss = getEnemy(z.boss);
  const legendary = boss?.drops.flatMap((t) => t.entries).map((e) => getItem(e.id)).find((d) => d?.rarity === 'legendary');
  const rw = clearReward(z, !cleared);
  return h('article', { class: `zone-card ${lock ? 'locked' : ''} t-${z.theme}`, 'data-zone': z.id },
    h('div', { class: 'zone-top' },
      h('span', { class: 'zone-n num' }, z.n),
      h('div', { class: 'zone-title' }, h('h3', {}, z.name), h('small', { class: 'muted' }, `เลเวล ${z.level} · ${z.rooms.length} ห้อง`)),
      cleared ? h('span', { class: 'chip ok' }, glyph('check'), `พิชิต ${cleared}${st.zones.best[z.id] ? ` · ${fmtTime(st.zones.best[z.id])}` : ''}`) : null),
    h('p', { class: 'muted zone-desc' }, z.desc),
    h('div', { class: 'zone-mech' }, glyph('wind'), h('span', {}, z.mechanicText)),
    h('div', { class: 'zone-foes' },
      z.monsters.map((id) => h('span', { class: 'foe-chip' }, h('img', { alt: '', src: app.spriteUri(id) }), getEnemy(id).name)),
      h('span', { class: 'foe-chip boss' }, h('img', { alt: '', src: app.spriteUri(z.boss) }), `บอส: ${boss.name}`)),
    h('div', { class: 'zone-reward' },
      h('span', {}, itemImg('gold'), `${rw.gold}`), h('span', {}, itemImg('spark'), `${rw.sparks}`), h('span', { class: 'muted' }, `+${rw.xp} ประสบการณ์${cleared ? '' : ' (โบนัสครั้งแรก)'}`),
      legendary ? tipTarget(h('span', { class: 'leg' }, itemImg(legendary.id), legendary.name), legendary.id, { chance: dropOdds(boss.drops).find((d) => d.id === legendary.id)?.chance }) : null),
    oddsRow(boss),
    actions(app, z, lock, close));
}

// the story of a special dungeon, chapter by chapter
export function openLore(app, z) {
  const boss = getEnemy(z.boss);
  let close;
  const content = h('div', { class: 'modal panel lore-book', 'data-modal': 'lore' },
    h('div', { class: 'lore-head' }, h('img', { alt: '', src: app.spriteUri(z.boss) }), h('div', {}, h('small', { class: 'muted' }, 'บันทึกตำนาน'), h('h2', {}, boss.name))),
    h('ol', { class: 'lore-chapters' }, z.lore.map((c, i) => h('li', {}, h('h3', {}, h('span', { class: 'num' }, `บทที่ ${i + 1}`), c.t), h('p', {}, c.b)))),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด')));
  close = app.modal(content);
  return close;
}

// v8: the Boss Rush — today's five bosses, and a sixth door nobody describes
function rushCard(app, st, close) {
  const z = rushZone();
  const lock = zoneLock(st, z);
  const runs = st.stats?.bossRush || 0;
  const rw = clearReward(z, !st.zones.cleared[z.id]);
  return h('article', { class: `zone-card raid-card rush-card ${lock ? 'locked' : ''} t-arena`, 'data-zone': z.id },
    h('div', { class: 'zone-top' },
      h('span', { class: 'zone-n num' }, glyph('crown')),
      h('div', { class: 'zone-title' }, h('small', { class: 'raid-tag' }, glyph('sword'), 'โหมดท้าทาย'), h('h3', {}, z.name), h('small', { class: 'muted' }, `เลเวล ${z.level} · บอส ${z.lineup.length} ตนติดกัน · รายชื่อเปลี่ยนทุกวัน`)),
      runs ? h('span', { class: 'chip ok' }, glyph('check'), `ผ่าน ${runs} ครั้ง`) : null),
    h('p', { class: 'muted zone-desc' }, z.desc),
    h('div', { class: 'zone-foes rush-line', 'data-rush-line': '' },
      z.lineup.map((id, i) => h('span', { class: 'foe-chip boss' }, h('span', { class: 'num' }, i + 1), h('img', { alt: '', src: app.spriteUri(id) }), getEnemy(id).name)),
      h('span', { class: 'foe-chip secret-chip', title: 'ว่ากันว่าจะเปิดเมื่อไม่มีใครล้มเลยตลอดทาง' }, glyph('lock'), '6 · ???')),
    h('div', { class: 'zone-mech' }, glyph('wind'), h('span', {}, z.mechanicText)),
    h('div', { class: 'zone-reward' },
      h('span', {}, itemImg('gold'), `${rw.gold}`), h('span', {}, itemImg('spark'), `${rw.sparks}`), h('span', { class: 'muted' }, `+${rw.xp} ประสบการณ์${st.zones.cleared[z.id] ? '' : ' (โบนัสครั้งแรก)'}`),
      h('span', { class: 'secret-chip' }, glyph('lock'), 'รางวัลลับ ???')),
    actions(app, z, lock, close));
}

function raidCard(app, st, z, close) {
  const lock = zoneLock(st, z);
  const kills = st.raids?.[z.id]?.kills || 0;
  const boss = getEnemy(z.boss);
  const rw = clearReward(z, !st.zones.cleared[z.id]);
  const relic = dropOdds(boss.drops).map((d) => ({ ...d, def: getItem(d.id) })).find((d) => d.def && (d.def.rarity === 'mythic'));
  return h('article', { class: `zone-card raid-card ${lock ? 'locked' : ''} t-${z.theme}`, 'data-zone': z.id },
    h('div', { class: 'raid-hero' },
      h('img', { class: 'raid-boss', alt: '', src: app.spriteUri(z.boss) }),
      h('div', { class: 'zone-title' },
        h('small', { class: 'raid-tag' }, glyph('dragon'), 'ดันพิเศษ'),
        h('h3', {}, z.name),
        h('small', { class: 'muted' }, `บอส: ${boss.name} · เลเวล ${z.level}`),
        kills ? h('span', { class: 'chip ok' }, glyph('check'), `ปราบแล้ว ${kills} ครั้ง`) : null)),
    h('p', { class: 'muted zone-desc' }, z.desc),
    h('div', { class: 'zone-mech' }, glyph('wind'), h('span', {}, z.mechanicText)),
    z.respawnMs ? h('div', { class: 'zone-mech' }, glyph('clock'), h('span', {}, `ตื่นทุก ${z.respawnMs % 3600000 === 0 ? `${z.respawnMs / 3600000} ชั่วโมง` : `${Math.round(z.respawnMs / 60000)} นาที`}หลังถูกปราบ`)) : null,
    h('div', { class: 'zone-reward' },
      h('span', {}, itemImg('gold'), `${rw.gold}`), h('span', {}, itemImg('spark'), `${rw.sparks}`), h('span', { class: 'muted' }, `+${rw.xp} ประสบการณ์`),
      relic ? tipTarget(h('span', { class: 'mythic' }, itemImg(relic.id), relic.def.name, h('span', { class: 'num' }, ` ${pct(relic.chance, 1)}`)), relic.id, { chance: relic.chance }) : null,
      // the secret reward is never named here
      h('span', { class: 'secret-chip', title: 'ว่ากันว่าบางสิ่งจะเผยตัวเมื่อหัวใจกับดวงตาอยู่ด้วยกัน' }, glyph('lock'), 'รางวัลลับ ???')),
    oddsRow(boss, true),
    h('div', { class: 'raid-row' },
      h('button', { class: 'btn ghost', type: 'button', 'data-action': 'lore', onclick: () => openLore(app, z) }, glyph('book'), 'อ่านตำนาน'),
      actions(app, z, lock, close)));
}

export function openZoneBoard(app) {
  const st = app.store.get();
  let close;
  const content = h('div', { class: 'modal panel zone-board', 'data-modal': 'zones' },
    h('h2', {}, 'ประตูมิติ · ดันเจี้ยนรวม'),
    h('p', { class: 'muted', style: { margin: 0, textAlign: 'center', fontSize: 'var(--step--1)' } }, 'สิบสองโซน สิบสองแบบ มอนสเตอร์และกลไกไม่ซ้ำกัน ไปคนเดียวหรือพาเพื่อนไปได้ถึง 4 คน (ศัตรูแข็งขึ้นตามจำนวนคน) ของดรอปเป็นของใครของมัน'),
    h('div', { class: 'zone-list' }, PORTAL_ZONES.map((z) => zoneCard(app, st, z, () => close()))),
    h('h2', { class: 'raid-heading' }, glyph('dragon'), 'ดันพิเศษ'),
    h('p', { class: 'muted', style: { margin: 0, textAlign: 'center', fontSize: 'var(--step--1)' } }, 'บอสยักษ์หนึ่งตัว หนึ่งเรื่องราว ท่าโจมตีทุกท่ามีสัญญาณเตือน กรงเล็บและคมดาบ "แพร์รี่" ได้ ส่วนวงพื้นต้องหลบ'),
    h('div', { class: 'zone-list' }, RAIDS.map((z) => raidCard(app, st, z, () => close()))),
    h('h2', { class: 'raid-heading' }, glyph('crown'), 'ลานประลองเจ้าแห่งบอส'),
    h('div', { class: 'zone-list' }, rushCard(app, st, () => close())),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด')));
  close = app.modal(content);
  // live countdown on a sleeping boss
  const timer = setInterval(() => {
    if (!content.isConnected) { clearInterval(timer); return; }
    const now = Date.now(), cur = app.store.get();
    for (const z of RAIDS) {
      const b = content.querySelector(`[data-lock="${z.id}"]`);
      if (!b) continue;
      const lock = zoneLock(cur, z, now);
      if (!lock) { clearInterval(timer); close(); openZoneBoard(app); return; }
      b.lastChild.textContent = lock;
    }
  }, 1000);
  return close;
}
