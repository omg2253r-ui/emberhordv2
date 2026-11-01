// Stage select with enemy list and drop odds per kill.
import { h, glyph, itemImg, pct, confirmButton } from '../dom.js';
import { INFINITE, entriesLeft } from '../../data/infinite.js';
import { towerProgress, towerLock, TOWER, GODS } from '../../data/tower.js';
import { STAGES } from '../../data/stages.js';
import { getEnemy } from '../../data/enemies.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { dungeonEnemies } from '../../systems/dungeon.js';
import { getRun, runSummary } from '../../systems/dungeonRun.js';
import { loreProgress } from '../../systems/story.js';
import { dropOdds } from '../../systems/loot.js';
import { isStageUnlocked } from '../../systems/progression.js';
import { tipTarget } from '../itemTip.js';
import { getItem } from '../../data/items.js';
import { PORTAL_ZONES, STORY_ZONES } from '../../data/zones.js';
import { zoneActions } from '../zonesUi.js';

// A story land: the same card shape as a stage, built from the land's own data (rooms, bosses, drop odds).
function storyLandCard(app, st, z) {
  const lock = app.zoneLock(z.id);
  const cleared = st.zones.cleared[z.id] || 0;
  const lvlGap = z.level - st.player.level;
  const bossIds = z.rooms.flatMap((r) => (r === 'boss' ? [z.boss] : r.map(([id]) => id))).filter((id) => getEnemy(id)?.boss);
  const secretId = z.nested?.[0]?.[0]?.[0];                                  // the hidden room's warden (its own purse)
  const foes = [...bossIds.map((id) => ({ id, tag: ' (บอส)' })), ...(secretId && getEnemy(secretId) ? [{ id: secretId, tag: ' (ห้องลับ)' }] : [])];
  const own = (d) => getItem(d.id)?.src === z.id;                          // the land's own relics, armour and charm
  return h('article', { class: `stage story-land ${lock ? 'locked' : ''}`, 'data-stage': z.id },
    h('div', { class: 'stage-top' },
      h('h3', {}, z.name),
      h('span', { class: `chip ${lvlGap > 3 ? 'warn' : ''}` }, `แนะนำเลเวล ${z.level}`),
      cleared ? h('span', { class: 'chip ok' }, glyph('check'), `ผ่านแล้ว ${cleared} ครั้ง${st.zones.best[z.id] ? ` · ดีที่สุด ${Math.floor(st.zones.best[z.id] / 60)}:${String(st.zones.best[z.id] % 60).padStart(2, '0')}` : ''}`) : null),
    h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, z.desc),
    h('div', { class: 'stage-facts' },
      h('span', { class: 'chip' }, glyph('door'), `${z.rooms.length} ห้อง`),
      h('span', { class: 'chip' }, glyph('skull'), `เทพ ${bossIds.length} องค์`),
      h('span', { class: 'chip' }, glyph('people'), 'ลุยคนเดียวหรือไปด้วยกันได้ถึง 4 คน')),
    h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, glyph('wind'), ' ', z.mechanicText),
    h('div', { class: 'foes' }, foes.map(({ id, tag }) => {
      const e = getEnemy(id);
      const all = dropOdds(e.drops).filter((d) => getItem(d.id)).sort((a, b) => b.chance - a.chance);
      const odds = all.filter((d) => d.chance >= 0.1 || own(d)), rest = all.length - odds.length;
      return h('div', { class: 'foe' },
        h('b', {}, e.name, tag),
        h('span', { class: 'muted num' }, `ทอง ${e.gold[0]}–${e.gold[1]}`),
        h('div', { class: 'odds' }, odds.map((o) =>
          tipTarget(h('span', {}, itemImg(o.id), h('span', { class: 'num' }, pct(o.chance, o.chance < 0.01 ? 2 : o.chance < 0.1 ? 1 : 0))), o.id, { chance: o.chance })),
          rest > 0 ? h('span', { class: 'muted', title: 'อุปกรณ์สุ่มระดับทั่วไปถึงตำนาน' }, `+ อุปกรณ์สุ่มอีก ${rest} ชนิด`) : null));
    })),
    h('small', { class: 'faint' }, 'ตัวเลขคือโอกาสที่ไอเทมนั้นดรอป (แสดงของที่ดรอปบ่อยกับของเฉพาะสุสาน) · กดค้างที่ไอเทมเพื่อดูว่าคืออะไร ใช้ทำอะไร'),
    lock
      ? h('button', { class: 'btn', type: 'button', disabled: true, 'data-lock': z.id }, glyph('lock'), lock)
      : zoneActions(app, z, null, () => {}));
}

export function createStagesPanel(app) {
  return {
    id: 'stages', title: 'ออกล่า', icon: 'map',
    render(body) {
      const st = app.store.get();
      const o = app.online;
      const others = o.peers.length, inVillage = o.peers.filter((x) => x.p.zone === 'village').length;
      const onlineCard = h('article', { class: `stage online-zone ${o.online ? '' : 'locked'}`, 'data-stage': 'village' },
        h('div', { class: 'stage-top' },
          h('h3', {}, 'หมู่บ้านทางแยกถ่าน'),
          h('span', { class: `chip ${o.online ? 'ok' : 'warn'}` }, glyph('globe'), o.online ? `ออนไลน์ ${others + 1} คน` : 'ออฟไลน์')),
        h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, 'ลานกลางที่นักล่าทุกคนมาเจอกัน คุยกัน เพิ่มเพื่อน ตั้งปาร์ตี้ และท้าดวล 1v1 แบบชนะ 2 ใน 3 ยก'),
        h('div', { class: 'stage-facts' },
          h('span', { class: 'chip' }, glyph('people'), `ในหมู่บ้าน ${inVillage} คน`),
          h('span', { class: 'chip' }, glyph('friend'), `เพื่อน ${Object.keys(st.social.friends).length}`),
          h('span', { class: 'chip' }, glyph('duel'), `ดวล ชนะ ${st.pvp.wins} · แพ้ ${st.pvp.losses}`)),
        o.online
          ? (o.canSend() ? null : h('div', { class: 'notice' }, 'บัญชีนี้ดูได้อย่างเดียว: เดินและเห็นคนอื่นได้ แต่ส่งแชทหรือคำขอไม่ได้ ขอสิทธิ์ผู้ร่วมโต้ตอบจากเจ้าของเกม'))
          : h('div', { class: 'notice' }, o.reason),
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'enter-village', disabled: !o.online, onclick: () => app.enterVillage() }, glyph('globe'), 'เข้าหมู่บ้าน'));
      const zonesCleared = PORTAL_ZONES.filter((z) => st.zones.cleared[z.id]).length;
      const riftCard = h('article', { class: 'stage online-zone rift', 'data-stage': 'zones' },
        h('div', { class: 'stage-top' }, h('h3', {}, 'ประตูมิติ · ดันเจี้ยนรวม'), h('span', { class: 'chip ok' }, `พิชิต ${zonesCleared}/${PORTAL_ZONES.length} โซน`)),
        h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, 'สิบสองโซนที่ไม่ซ้ำกันทั้งกลไก มอนสเตอร์ และบอส ลุยคนเดียวหรือเปิดคณะสำรวจให้คนอื่นเข้าร่วมได้ถึง 4 คน บอสทุกตัวมีอาวุธระดับตำนาน'),
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'open-zones', onclick: () => app.openZones() }, glyph('door'), 'เปิดประตูมิติ'));
      const infLock = app.infiniteLock();
      const left = entriesLeft(st);
      const owned = Object.keys(st.artifacts?.owned || {}).length;
      const infCard = h('article', { class: `stage online-zone infinite ${infLock ? 'locked' : ''}`, 'data-stage': 'infinite' },
        h('div', { class: 'stage-top' }, h('h3', {}, glyph('infinity'), 'รอยแยกไร้สิ้นสุด'),
          h('span', { class: `chip ${left ? 'ok' : ''}`, 'data-entries': left }, `สิทธิ์วันนี้ ${left}/${INFINITE.entriesPerDay}`)),
        h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, 'คลื่นศัตรูไม่มีที่สิ้นสุด ทุก 5 คลื่นรอยแยกเปลี่ยนดินแดนและมีผู้พิทักษ์ ได้เฉพาะเหรียญและอาร์ติแฟกต์ ตายหรือออกเมื่อไหร่ก็รับรางวัลที่สะสมไว้ทั้งหมด'),
        h('div', { class: 'inf-meta' }, h('span', {}, glyph('crown'), `สถิติ ${st.infinite?.best || 0} คลื่น`), h('span', {}, glyph('cosmos'), `อาร์ติแฟกต์ ${owned} ชนิด`)),
        h('div', { class: 'zone-actions' },
          h('button', { class: 'btn', type: 'button', 'data-action': 'open-cosmos', onclick: () => app.openCosmos() }, glyph('cosmos'), 'จักรวาลอาร์ติแฟกต์'),
          h('button', { class: 'btn primary', type: 'button', 'data-action': 'start-infinite', disabled: !!infLock, title: infLock || '', onclick: () => app.startInfinite() }, glyph(infLock ? 'lock' : 'infinity'), infLock || 'เข้ารอยแยก')));
      const tp = towerProgress(st), tLock = towerLock(st);
      const towerCard = h('article', { class: `stage online-zone tower ${tLock ? 'locked' : ''}`, 'data-stage': 'tower' },
        h('div', { class: 'stage-top' }, h('h3', {}, glyph('skull'), 'หอคอยขุมนรก 100 ชั้น'), h('span', { class: 'chip ok' }, `ชั้น ${tp.best}/${TOWER.floors}${tp.asc ? ` · ขุมลึก ${tp.asc}` : ''}`)),
        h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, 'ลุยคนเดียว ทุกชั้นมีศัตรูและคำสาปไม่ซ้ำกัน ทุก 10 ชั้นมีเทพแห่งขุมนรกที่สู้ตัวต่อตัวและเรียกสมุน ผ่านชั้น 100 แล้วจะเปิดขุมที่ลึกกว่าไม่มีที่สิ้นสุด'),
        h('div', { class: 'inf-meta' }, h('span', {}, glyph('skull'), `เทพที่ปราบ ${Object.keys(tp.gods).length}/${GODS.length}`), h('span', {}, glyph('crown'), `ปีนแล้ว ${tp.runs} ครั้ง`)),
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'open-tower', disabled: !!tLock, title: tLock || '', onclick: () => app.openTower() }, glyph(tLock ? 'lock' : 'skull'), tLock || 'เข้าหอคอย'));
      body.replaceChildren(
        h('div', { class: 'eyebrow zone-head' }, 'โซนออนไลน์'), onlineCard, riftCard,
        h('div', { class: 'eyebrow zone-head' }, 'โหมดพิเศษ'), towerCard, infCard,
        h('button', { class: 'btn gold book-btn', type: 'button', 'data-action': 'open-bestiary', onclick: () => app.openBestiary() }, glyph('skull'), 'สมุดบอส · ดูบอสทั้งหมด แพทเทิร์น และของดรอป'),
        h('div', { class: 'eyebrow zone-head' }, 'เนื้อเรื่อง'),
        ...STAGES.map((stage) => {
        const open = isStageUnlocked(st, stage);
        const clears = st.progress.clears[stage.id] || 0;
        const dg = DUNGEONS[stage.id];
        const foeIds = dungeonEnemies(dg);
        const lp = loreProgress(st, stage.id);
        const traps = new Set(dg.rooms.flatMap((r) => (r.traps || []).map((t) => t.kind)));
        const trapNames = { spikes: 'หนามพื้น', dart: 'ป้อมยิงหนาม', vent: 'ช่องไฟ', rocks: 'หินถล่ม' };
        const lvlGap = stage.recommendedLevel - st.player.level;
        const saved = open ? runSummary(getRun(st, stage.id), stage.id) : null;      // v8.3: an unfinished run of this dungeon
        const savedText = saved ? [
          `ค้างอยู่ที่ \"${saved.roomName}\"`, `สำรวจแล้ว ${saved.visited}/${saved.total} ห้อง`, `พลังชีวิต ${saved.hpPct}%`,
          saved.unsealed ? 'ผนึกห้องบอสสลายแล้ว' : saved.keys > 0 ? 'ถือกุญแจผนึกอยู่' : null,
        ].filter(Boolean).join(' · ') : '';
        return h('article', { class: `stage ${open ? '' : 'locked'}`, 'data-stage': stage.id },
          h('div', { class: 'stage-top' },
            h('h3', {}, stage.name),
            h('span', { class: `chip ${lvlGap > 1 ? 'warn' : ''}` }, `แนะนำเลเวล ${stage.recommendedLevel}`),
            clears ? h('span', { class: 'chip ok' }, glyph('check'), `ผ่านแล้ว ${clears} ครั้ง`) : null),
          h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, stage.desc),
          h('div', { class: 'stage-facts' },
            h('span', { class: 'chip' }, glyph('door'), `${dg.rooms.length} ห้อง`),
            h('span', { class: 'chip' }, glyph('book'), `เอกสาร ${lp.found}/${lp.total}`),
            h('span', { class: 'chip warn' }, `กับดัก: ${[...traps].map((k) => trapNames[k] || k).join(' · ')}`)),
          h('div', { class: 'foes' }, foeIds.map((id) => {
            const e = getEnemy(id);
            return h('div', { class: 'foe' },
              h('b', {}, e.name, e.boss ? ' (บอส)' : ''),
              h('span', { class: 'muted num' }, `ทอง ${e.gold[0]}–${e.gold[1]}`),
              h('div', { class: 'odds' }, dropOdds(e.drops).sort((a, b) => b.chance - a.chance).map((o) =>
                tipTarget(h('span', {}, itemImg(o.id), h('span', { class: 'num' }, pct(o.chance, o.chance < 0.1 ? 1 : 0))), o.id, { chance: o.chance }))));
          })),
          h('small', { class: 'faint' }, 'ตัวเลขคือโอกาสที่ไอเทมนั้นดรอปต่อการกำจัดศัตรูหนึ่งตัว · กดค้างที่ไอเทมเพื่อดูว่าคืออะไร ใช้ทำอะไร และขายได้เท่าไหร่'),
          saved ? h('div', { class: 'notice ok', 'data-saved-run': stage.id }, h('b', {}, 'มีดันที่ค้างอยู่'), h('div', {}, savedText)) : null,
          open
            ? (saved
              ? h('div', { class: 'zone-actions' },
                h('button', { class: 'btn primary', type: 'button', 'data-action': 'continue-stage', onclick: () => app.startBattle(stage.id, { resume: true }) }, glyph('sword'), 'ต่อดันที่ค้าง'),
                confirmButton('เริ่มใหม่', 'ยืนยัน: ทิ้งดันที่ค้างและเริ่มใหม่', () => app.startBattle(stage.id), 'btn'))
              : h('button', { class: 'btn primary', type: 'button', 'data-action': 'start-stage', onclick: () => app.startBattle(stage.id) }, glyph('sword'), clears ? 'ล่าอีกครั้ง' : 'ออกล่า'))
            : h('button', { class: 'btn', type: 'button', disabled: true }, glyph('lock'), `ผ่าน ${STAGES.find((s) => s.id === stage.requires)?.name} ก่อน`));
      }),
        // v9: story lands (the Egypt tomb) are played like a zone run (solo or with an expedition) but listed here
        ...STORY_ZONES.map((z) => storyLandCard(app, st, z)));
    },
  };
}
