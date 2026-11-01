// หอคอยขุมนรก: progress, where to start, what waits on the next floor (monsters, curses, the god), and loot.
import { h, glyph, itemImg, rarityClass } from './dom.js';
import { TOWER, GODS, AFFIXES, floorPlan, floorLevel, towerProgress, startFloors, towerLock, bandGear, bandOf, isGodFloor, isEliteFloor, landOfFloor, godOfFloor } from '../data/tower.js';
import { getEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { tipTarget } from './itemTip.js';

export function openTower(app) {
  let close, pick = null;
  const body = h('div', { class: 'tower-body' });
  function draw() {
    const st = app.store.get();
    const t = towerProgress(st);
    const floors = startFloors(st);
    if (pick == null || !floors.includes(pick)) pick = floors[floors.length - 1];
    const plan = floorPlan(pick, t.asc), land = landOfFloor(pick);
    const g = plan.god ? godOfFloor(pick) : null;
    const lock = towerLock(st);
    const foes = (plan.types || []).map((id) => getEnemy(id)).filter(Boolean);
    body.replaceChildren(
      h('div', { class: 'tower-stats' },
        h('div', {}, h('small', { class: 'muted' }, 'ชั้นที่ผ่าน'), h('b', { class: 'num', 'data-tower-best': t.best }, `${t.best}/${TOWER.floors}`)),
        h('div', {}, h('small', { class: 'muted' }, 'ขุมลึก'), h('b', { class: 'num' }, t.asc)),
        h('div', {}, h('small', { class: 'muted' }, 'เทพที่ปราบ'), h('b', { class: 'num' }, `${Object.keys(t.gods).length}/${GODS.length}`)),
        h('div', {}, h('small', { class: 'muted' }, 'ปีนแล้ว'), h('b', { class: 'num' }, `${t.runs} ครั้ง`))),
      h('div', { class: 'eyebrow' }, 'เริ่มจากชั้น'),
      h('div', { class: 'craft-tabs tower-floors' }, floors.map((f) => h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(f === pick), 'data-tower-start': f, onclick: () => { pick = f; draw(); } }, `ชั้น ${f}`))),
      h('article', { class: `tower-floor ${g ? 'god' : isEliteFloor(pick) ? 'elite' : ''}`, 'data-floor': pick },
        h('div', { class: 'tf-head' }, h('b', {}, `ชั้น ${pick}`), h('span', { class: 'chip' }, land.name), h('span', { class: 'chip' }, `ระดับศัตรู ${Math.round(floorLevel(pick, t.asc))}`), g ? h('span', { class: 'chip warn' }, glyph('skull'), 'เทพขุมนรก') : isEliteFloor(pick) ? h('span', { class: 'chip warn' }, glyph('crown'), 'ผู้พิทักษ์') : null),
        g ? h('div', { class: 'tf-god' }, h('img', { src: app.spriteUri(g.id), alt: '' }), h('div', {}, h('b', { class: 'rc-text', style: { color: g.color } }, g.name), h('small', { class: 'muted' }, g.title), h('p', {}, g.mechanic), h('p', { class: 'lore-line' }, g.lore)))
          : h('div', { class: 'tf-foes' }, foes.map((e) => h('span', { class: 'chip' }, h('img', { class: 'mini-foe', src: app.spriteUri(e.id), alt: '' }), e.name)), plan.elite ? h('span', { class: 'chip warn' }, glyph('crown'), getEnemy(plan.elite)?.name) : null),
        plan.affixes.length ? h('div', { class: 'tf-curses' }, h('small', { class: 'muted' }, 'คำสาปของชั้นนี้'), plan.affixes.map((a) => h('div', { class: 'tf-curse' }, h('i', { style: { background: AFFIXES[a].color } }), h('b', {}, AFFIXES[a].name), h('span', { class: 'muted' }, AFFIXES[a].desc)))) : h('small', { class: 'muted' }, g ? '' : 'ชั้นนี้ไม่มีคำสาป'),
        h('div', { class: 'tf-loot' }, h('small', { class: 'muted' }, `ของจากชั้น ${(bandOf(pick) - 1) * 10 + 1}–${bandOf(pick) * 10}`), h('div', { class: 'tf-loot-row' }, bandGear(bandOf(pick)).map((id) => { const d = getItem(id); return tipTarget(h('span', { class: `cell r-${d.rarity}`, title: d.name, 'data-item-id': id }, itemImg(id)), id); })))),
      h('div', { class: 'notice' }, h('b', {}, 'กฎของหอคอย: '), 'ลุยคนเดียวตายแล้วจบรอบ หรือเปิดห้องชวนเพื่อนได้สูงสุด 8 คน (ศัตรูและบอสแรงขึ้นตามจำนวนคน · ล้มแล้วเพื่อนกดค้าง 7 วินาทีเพื่อชุบ ฟื้นมาเลือดครึ่งหนึ่ง · จบรอบเมื่อทุกคนล้ม) ชั้นที่ผ่านแล้วนับไว้เสมอ · วงเตือนสีแดงเข้ม = ', h('b', { style: { color: '#ff3a6a' } }, 'เจาะเกราะ'), ' (ยกโล่กันไม่ได้และไม่สนค่าป้องกัน ต้องหลบ) · มอนสเตอร์ธรรมดาที่มีวงแสงทองรอบตัว = อมตะชั่วคราว รอจังหวะ (บอสไม่มีช่วงอมตะ ตีโดนตลอด แต่แลกด้วยเลือดหลายหลอด) · ผ่านชั้น 100 แล้วจะเปิดขุมลึกที่ยากขึ้นเรื่อยๆ ไม่มีที่สิ้นสุด'),
      h('div', { class: 'tower-gods' }, GODS.map((x) => h('span', { class: `tower-god ${t.gods[x.id] ? 'done' : ''}`, title: `${x.floor}: ${x.name}`, style: { '--gc': x.color } }, h('img', { src: app.spriteUri(x.id), alt: '' }), h('small', {}, x.floor)))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด'),
        h('button', { class: 'btn', type: 'button', 'data-action': 'tower-room', disabled: !!lock, title: lock || '', onclick: () => { close(); app.openTowerRoom(pick); } }, glyph('people'), 'เปิดห้องเล่นกับเพื่อน (สูงสุด 8)'),
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'tower-start', disabled: !!lock, title: lock || '', onclick: () => { close(); app.startTower(pick); } }, glyph(lock ? 'lock' : 'up'), lock || `เริ่มปีนชั้น ${pick}`)));
  }
  const content = h('div', { class: 'modal panel tower-modal', 'data-modal': 'tower' }, h('h2', {}, glyph('skull'), 'หอคอยขุมนรก 100 ชั้น'), body);
  draw();
  close = app.modal(content);
  return close;
}

export function towerResult(app, res, { onClose }) {
  const t = res.reward.tower;
  let close, replaying = false;
  // v8.4: climb again from the floor this run started on (falls back to the nearest start floor still on offer)
  const st = app.store.get(), lock = towerLock(st), starts = startFloors(st);
  const again = starts.includes(t.start) ? t.start : starts.filter((f) => f <= t.start).pop() || 1;
  const multi = res.party > 1;
  const content = h('div', { class: 'modal panel tower-result', 'data-modal': 'zone-result', 'data-outcome': 'tower', 'data-reached': t.deepest },
    h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, `หอคอยขุมนรก${t.asc ? ` · ขุมลึก ${t.asc}` : ''}${multi ? ` · ${res.party} คน` : ''}`),
    h('h2', { class: res.outcome === 'defeat' ? 'lose' : '' }, res.outcome === 'defeat' ? (multi ? 'ทุกคนล้มในหอคอย' : 'ล้มลงในหอคอย') : 'ออกจากหอคอย'),
    h('div', { class: 'inf-wave' }, h('small', { class: 'muted' }, 'ผ่านรอบนี้'), h('b', { class: 'num' }, t.cleared), h('small', { class: 'muted' }, t.cleared ? `ชั้น ${t.start}–${t.deepest}` : `เริ่มชั้น ${t.start}`)),
    h('div', { class: 'notice ok' }, `ทอง ${t.gold.toLocaleString('th-TH')} · ประกายอำพัน ${t.sparks} · ประสบการณ์ ${t.xp.toLocaleString('th-TH')}`),
    h('div', { class: 'kv' },
      h('div', {}, h('span', { class: 'muted' }, 'สถิติขุมนี้'), h('b', {}, `ชั้น ${t.best}`)),
      h('div', {}, h('span', { class: 'muted' }, 'ขุมลึกปัจจุบัน'), h('b', {}, t.nowAsc)),
      h('div', {}, h('span', { class: 'muted' }, 'กำจัด'), h('b', {}, `${res.run.kills} ตัว`)),
      h('div', {}, h('span', { class: 'muted' }, 'เวลา'), h('b', {}, `${Math.floor(res.run.seconds / 60)}:${String(res.run.seconds % 60).padStart(2, '0')}`))),
    h('div', { class: 'eyebrow' }, `ของที่ได้ (${res.run.items.length} ชนิด)`),
    res.run.items.length ? h('div', { class: 'loot-grid' }, res.run.items.map((it) => { const def = getItem(it.id); return h('div', { class: `cell r-${def.rarity}`, title: def.name }, itemImg(it.id), h('span', { class: 'qty' }, it.qty)); })) : h('div', { class: 'empty-note' }, 'รอบนี้ไม่ได้ไอเทม'),
    res.saveOk ? null : h('div', { class: 'notice' }, 'บันทึกเกมไม่สำเร็จ'),
    h('div', { class: 'actions' },
      h('button', { class: res.outcome === 'defeat' ? 'btn' : 'btn gold', type: 'button', 'data-action': 'replay', 'data-floor': again, disabled: !!lock, title: lock || '',
        onclick: () => { replaying = true; close(); if (multi) app.openTowerRoom(again); else app.startTower(again); } },
        glyph(lock ? 'lock' : 'up'), lock || (multi ? `เปิดห้องใหม่จากชั้น ${again}` : `ปีนอีกครั้งจากชั้น ${again}`)),
      h('button', { class: 'btn primary', type: 'button', 'data-action': 'zone-done', onclick: () => close() }, 'กลับค่าย')));
  close = app.modal(content, { dismissable: false, onClose: () => { if (!replaying) onClose(); } });
}
