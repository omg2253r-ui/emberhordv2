// Journal: current goal, recovered memories, documents found per map, replay of past scenes, talk to Lek.
import { h, glyph } from '../dom.js';
import { LORE, MEMORIES, SCENES, LEK_TALK, LEK_BLOODLINE } from '../../data/story.js';
import { getRace } from '../../data/races.js';
import { STAGES } from '../../data/stages.js';
import { currentGoal, loreProgress } from '../../systems/story.js';

export function createJournalPanel(app) {
  return {
    id: 'journal', title: 'บันทึก', icon: 'book',
    badge: () => false,
    render(body) {
      const st = app.store.get();
      const goal = currentGoal(st);
      const mems = MEMORIES.map((m) => {
        const got = !!st.story.flags[m.flag];
        return h('div', { class: `mem ${got ? '' : 'locked'}` }, h('b', {}, got ? m.title : 'ความทรงจำที่ยังขาดหาย'), h('p', {}, got ? m.text : 'สำรวจต่อเพื่อให้ความทรงจำกลับมา'));
      });
      const docs = STAGES.map((stage) => {
        const pr = loreProgress(st, stage.id);
        const ids = Object.keys(LORE).filter((id) => LORE[id].stage === stage.id);
        return h('section', { class: 'doc-group' },
          h('div', { class: 'doc-head' }, h('span', {}, stage.name), h('span', { class: 'chip num' }, `${pr.found}/${pr.total}`)),
          ids.map((id) => (st.story.lore[id]
            ? h('button', { class: 'doc found', type: 'button', 'data-doc': id, onclick: () => app.openLore(id, () => app.rerender()) }, glyph('book'), LORE[id].title)
            : h('div', { class: 'doc' }, glyph('lock'), `ยังไม่พบ — สำรวจ${stage.name}`))));
      });
      const seen = Object.keys(SCENES).filter((id) => st.story.seen[id]);
      body.replaceChildren(...[
        h('div', { class: 'goal-card' }, h('div', { class: 'eyebrow' }, 'เป้าหมายตอนนี้'), h('p', { 'data-goal': goal.id }, goal.text)),
        h('button', { class: 'btn gold book-btn', type: 'button', 'data-action': 'open-bestiary', onclick: () => app.openBestiary() }, glyph('skull'), 'สมุดบอส · บอสทั้งหมดในเกม'),
        h('button', { class: 'btn gold book-btn', type: 'button', 'data-action': 'open-ult-codex', onclick: () => app.openUltCodex() }, glyph('star'), 'คลังท่าไม้ตาย · ท่าไม้ตายทั้งหมดในเกม'),
        h('div', { class: 'lek-row' },
          h('img', { class: 'lek-face', src: app.portraitUri('lek'), alt: '' }),
          h('div', {}, h('b', {}, 'ลุงเหล็ก'), h('p', { 'data-lek': '' }, LEK_TALK[goal.id] || LEK_TALK.g4))),
        getRace(st.race?.id) ? h('div', { class: 'lek-row' },
          h('img', { class: 'lek-face', src: app.racePortraitUri(st.race.id), alt: '' }),
          h('div', {}, h('b', {}, `สายเลือด${getRace(st.race.id).name}`), h('p', { 'data-lek-race': '' }, `ลุงเหล็ก: "${LEK_BLOODLINE[st.race.id]}"`))) : null,
        h('div', { class: 'eyebrow' }, 'ความทรงจำ'), h('div', { class: 'mems' }, mems),
        h('div', { class: 'eyebrow' }, 'เอกสารที่พบ'), ...docs,
        seen.length ? h('div', { class: 'eyebrow' }, 'ฉากที่ผ่านมา') : null,
        seen.length ? h('div', { class: 'replays' }, seen.map((id) => h('button', { class: 'btn small', type: 'button', 'data-replay': id, onclick: () => app.replayScene(id) }, SCENES[id].title))) : null,
      ].filter(Boolean));
    },
  };
}
