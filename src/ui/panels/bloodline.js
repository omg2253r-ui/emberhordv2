// Bloodline (race): current race card, re-roll with a Bloodstone, and the odds.
import { h, glyph, itemImg } from '../dom.js';
import { REROLL_ITEM } from '../../data/races.js';
import { countItem } from '../../systems/inventory.js';
import { raceCard, raceOddsTable } from '../raceUi.js';
import { getRace } from '../../data/races.js';
import { storeRace, swapRace, clearRaceSlot, RACE_SLOTS } from '../../systems/race.js';
import { confirmButton } from '../dom.js';

export function createBloodlinePanel(app) {
  return {
    id: 'bloodline', title: 'สายเลือด', icon: 'race',
    badge: () => !app.store.get().race?.id,
    render(body) {
      const st = app.store.get();
      const stones = countItem(st, REROLL_ITEM);
      if (!st.race?.id) {
        body.replaceChildren(
          h('div', { class: 'empty-note' }, 'สายเลือดยังหลับใหลอยู่ ปลุกครั้งแรกได้ฟรี'),
          h('button', { class: 'btn primary', type: 'button', 'data-action': 'open-awaken', onclick: () => app.openAwaken('first') }, glyph('dice'), 'ปลุกสายเลือด'),
          h('div', { class: 'eyebrow' }, 'โอกาสของแต่ละสายเลือด'), raceOddsTable());
        return;
      }
      const act = (r, msg) => { if (!r.ok) { app.toast(r.reason === 'already_stored' ? 'เผ่านี้อยู่ในช่องเก็บแล้ว' : 'ทำรายการไม่สำเร็จ', 'warn'); return; } app.store.commit(r.state, { reason: 'race' }); app.refreshHeroSprites(); app.audio.play('unlock'); app.toast(msg, 'ok'); app.rerender(); };
      const slots = h('div', { class: 'race-slots' }, Array.from({ length: RACE_SLOTS }, (_, i) => {
        const id = st.raceSlots?.[i], race = getRace(id);
        return h('article', { class: `race-slot ${race ? 'filled' : ''}`, 'data-race-slot': i, style: race ? { '--race': race.color } : null },
          h('small', { class: 'muted' }, `ช่องเก็บเผ่า ${i + 1}`),
          race ? h('b', {}, race.name) : h('b', { class: 'muted' }, 'ว่าง'),
          race ? h('small', { class: 'rs-desc' }, race.desc) : h('small', { class: 'faint' }, 'เก็บเผ่าปัจจุบันไว้ แล้วสุ่มเผ่าใหม่ได้โดยไม่เสียเผ่านี้'),
          h('div', { class: 'race-slot-actions' },
            race ? h('button', { class: 'btn sm primary', type: 'button', 'data-action': `race-swap-${i}`, onclick: () => act(swapRace(app.store.get(), i), `ใช้สายเลือด${race.name}แล้ว`) }, glyph('race'), 'ใช้เผ่านี้') : null,
            race ? confirmButton('เก็บเผ่าปัจจุบันทับ', 'กดอีกครั้ง: ทับช่องนี้', () => act(storeRace(app.store.get(), i), 'เก็บเผ่าไว้แล้ว'), 'btn sm')
              : h('button', { class: 'btn sm', type: 'button', 'data-action': `race-store-${i}`, onclick: () => act(storeRace(app.store.get(), i), 'เก็บเผ่าปัจจุบันไว้แล้ว ตอนนี้สุ่มเผ่าใหม่ได้เลย') }, glyph('down'), 'เก็บเผ่าปัจจุบัน'),
            race ? confirmButton('ล้าง', 'กดอีกครั้งเพื่อล้าง', () => act(clearRaceSlot(app.store.get(), i), 'ล้างช่องแล้ว'), 'btn sm ghost') : null));
      }));
      body.replaceChildren(
        raceCard(app, st.race.id),
        h('div', { class: 'eyebrow' }, 'คลังเผ่า (2 ช่อง)'), slots,
        h('div', { class: 'reroll-box' },
          h('div', { class: 'aw-cost' }, itemImg(REROLL_ITEM), h('span', {}, `ศิลาเปลี่ยนสายเลือด ${stones} ก้อน`), h('small', { class: 'faint' }, 'ได้จากบอสเท่านั้น (หมูป่าหลังหนาม 35% · โกเลมเตาหลอม 50%)')),
          h('button', { class: 'btn gold', type: 'button', 'data-action': 'open-reroll', disabled: stones < 1, title: stones < 1 ? 'ต้องมีศิลาเปลี่ยนสายเลือด' : '', onclick: () => app.openAwaken('reroll') }, glyph('dice'), 'สุ่มสายเลือดใหม่')),
        h('details', { class: 'odds-box', open: true },
          h('summary', {}, glyph('dice'), 'โอกาสของแต่ละสายเลือด'),
          h('div', { class: 'eyebrow' }, 'สุ่มใหม่จะไม่ได้เผ่าเดิม โอกาสคำนวณจากเผ่าที่เหลือ'),
          raceOddsTable(st.race.id, st.race.id)),
        h('small', { class: 'faint' }, `ปลุกและเปลี่ยนสายเลือดมาแล้ว ${st.race.rolls} ครั้ง`));
    },
  };
}
