// Bloodline UI pieces: race card, odds table, and the awakening / re-roll ceremony with a roulette reveal.
// The roll itself is a committed transaction (app.awakenRace / app.rerollRace); the roulette only presents it.
import { h, glyph, itemImg, pct, rarityClass, confirmButton } from './dom.js';
import { RACES, RACE_IDS, REROLL_ITEM, getRace } from '../data/races.js';
import { rarityOf } from '../data/rarity.js';
import { raceOdds } from '../systems/race.js';
import { countItem } from '../systems/inventory.js';
import { raceStatLines } from './format.js';

export function raceCard(app, raceId, { compact = false } = {}) {
  const r = getRace(raceId);
  if (!r) return h('div', { class: 'empty-note' }, 'ยังไม่ได้ปลุกสายเลือด');
  const rar = rarityOf(r.rarity);
  return h('div', { class: `race-card ${rarityClass(r.rarity)} ${compact ? 'compact' : ''}`, 'data-race': r.id, style: { '--race': r.color } },
    h('div', { class: 'rc-top' },
      h('img', { class: 'race-face', src: app.racePortraitUri(r.id), alt: '' }),
      h('div', {},
        h('div', { class: 'eyebrow' }, `สายเลือด · ${rar.name}`),
        h('h3', { class: 'rc-text' }, r.name),
        h('p', { class: 'muted' }, r.desc))),
    h('div', { class: 'race-stats' }, raceStatLines(r.stats).map(([k, v]) => h('span', { class: `chip ${v.startsWith('-') ? 'neg' : ''}` }, `${k} ${v}`))),
    h('div', { class: 'race-block' }, h('div', { class: 'rb-head' }, glyph(r.skill.icon), h('b', {}, `สกิลเผ่า: ${r.skill.name}`), h('span', { class: 'faint' }, `ปุ่ม R · คูลดาวน์ ${r.skill.cooldown} วินาที`)), h('p', {}, r.skill.desc)),
    h('div', { class: 'race-block' }, h('div', { class: 'rb-head' }, glyph('star'), h('b', {}, `ความสามารถพิเศษ: ${r.ability.name}`)), h('p', {}, r.ability.desc)),
    compact ? null : h('p', { class: 'lore-line' }, r.lore));
}

export function raceOddsTable(excludeId = null, highlight = null) {
  const odds = raceOdds(excludeId);
  return h('div', { class: 'odds-table', 'data-odds': excludeId ? 'reroll' : 'base' },
    RACE_IDS.map((id) => {
      const o = odds.find((x) => x.id === id);
      const r = RACES[id];
      return h('div', { class: `odds-row ${rarityClass(r.rarity)} ${o ? '' : 'off'} ${highlight === id ? 'hl' : ''}` },
        h('i', { class: 'dot', style: { background: r.color } }),
        h('span', { class: 'rc-text' }, r.name),
        h('span', { class: 'faint' }, rarityOf(r.rarity).name),
        h('b', { class: 'num' }, o ? pct(o.chance, o.chance < 0.1 ? 1 : 0) : 'เผ่าปัจจุบัน'));
    }));
}

export function createAwakenUi(root, app) {
  const layer = h('div', { class: 'story-layer awaken-layer' });
  root.append(layer);
  let open = false;

  // Roulette strip of portraits that decelerates onto the result.
  function roulette(resultId, excludeId, onEnd) {
    const pool = raceOdds(excludeId);
    const pick = () => { let r = Math.random(); for (const o of pool) { r -= o.chance; if (r < 0) return o.id; } return pool[pool.length - 1].id; };
    const ids = Array.from({ length: 28 }, pick);
    ids.push(resultId, pick(), pick());
    const strip = h('div', { class: 'rl-strip' }, ids.map((id) => h('div', { class: `rl-cell ${rarityClass(RACES[id].rarity)}`, style: { '--race': RACES[id].color } }, h('img', { src: app.racePortraitUri(id), alt: '' }), h('span', {}, RACES[id].name))));
    const win = h('div', { class: 'rl-window' }, strip, h('i', { class: 'rl-marker' }));
    const CELL = 96;
    requestAnimationFrame(() => {
      const target = 28 * CELL - (win.clientWidth / 2 - CELL / 2);
      const dur = app.reducedMotion ? 10 : 2400;
      strip.style.transition = `transform ${dur}ms cubic-bezier(.12,.75,.16,1)`;
      strip.style.transform = `translateX(${-target}px)`;
      let ticks = 0;
      const tick = setInterval(() => { if (ticks++ < 16) app.audio.play('click'); }, 120);
      setTimeout(() => { clearInterval(tick); onEnd(); }, dur + 120);
    });
    return win;
  }

  function show(content) {
    const back = h('div', { class: 'modal-back awaken-back', role: 'dialog', 'aria-modal': 'true' }, content);
    layer.replaceChildren(back);
    setTimeout(() => content.querySelector('button')?.focus({ preventScroll: true }), 30);
    return () => { layer.replaceChildren(); };
  }

  // mode 'first': the free awakening (cannot be skipped). mode 'reroll': spend a Bloodstone.
  function openCeremony(mode, onDone) {
    if (open) return;
    open = true;
    app.input.setEnabled(false);
    const st = app.store.get();
    const exclude = mode === 'reroll' ? st.race.id : null;
    const stage = h('div', { class: 'aw-stage' });
    // The hero's new look is applied only after the reveal, so the camp behind the roulette never spoils it.
    const finish = () => { close(); open = false; app.refreshHeroSprites(); onDone?.(); };
    const card = h('div', { class: 'modal panel awaken', 'data-modal': 'awaken', 'data-mode': mode },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, mode === 'first' ? 'พิธีปลุกสายเลือด' : 'เปลี่ยนสายเลือด'),
      h('h2', {}, mode === 'first' ? 'ถ่านในแขนส่องแสง' : 'ศิลาเปลี่ยนสายเลือด'),
      h('p', { class: 'muted aw-intro' }, mode === 'first'
        ? `ถ่านที่ฝังอยู่ในแขนของ${st.story.name}อุ่นขึ้นทีละน้อย... สายเลือดบรรพบุรุษที่หลับใหลกำลังจะตื่น การปลุกครั้งแรกไม่มีค่าใช้จ่าย`
        : `บดศิลา 1 ก้อนลงบนถ่านในแขน สายเลือดเดิม (${RACES[st.race.id].name}) จะถูกแทนที่ด้วยสายเลือดใหม่ที่ไม่ซ้ำเดิม`),
      stage);
    const close = show(card);

    const intro = () => {
      const btn = mode === 'first'
        ? h('button', { class: 'btn primary', type: 'button', 'data-action': 'awaken-roll' }, glyph('dice'), 'ปลุกสายเลือด')
        : confirmButton([glyph('dice'), 'ใช้ศิลา 1 ก้อน สุ่มใหม่'], 'กดอีกครั้ง: สายเลือดเดิมจะหายไป', () => roll(), 'btn primary');
      if (mode === 'first') btn.addEventListener('click', () => roll());
      else btn.setAttribute('data-action', 'reroll-roll');
      stage.replaceChildren(...[
        h('div', { class: 'eyebrow' }, mode === 'first' ? 'โอกาสของแต่ละสายเลือด' : 'โอกาสในการสุ่มครั้งนี้ (ไม่ซ้ำเผ่าเดิม)'),
        raceOddsTable(exclude),
        mode === 'reroll' ? h('div', { class: 'aw-cost' }, itemImg(REROLL_ITEM), h('span', {}, `ศิลาเปลี่ยนสายเลือด มีอยู่ ${countItem(app.store.get(), REROLL_ITEM)} ก้อน`)) : null,
        h('div', { class: 'actions' }, mode === 'reroll' ? h('button', { class: 'btn', type: 'button', 'data-action': 'awaken-cancel', onclick: finish }, 'ยกเลิก') : null, btn),
      ].filter(Boolean));
    };

    const roll = () => {
      const r = mode === 'first' ? app.awakenRace() : app.rerollRace();
      if (!r.ok) { finish(); return; }
      app.audio.play('summon');
      stage.replaceChildren(h('div', { class: 'eyebrow' }, 'กำลังปลุกสายเลือด...'), roulette(r.id, exclude, () => reveal(r.id)));
    };

    const reveal = (id) => {
      const rar = rarityOf(RACES[id].rarity);
      app.audio.play(rar.order >= 3 ? 'legendary' : 'success');
      stage.replaceChildren(
        h('div', { class: 'aw-reveal' }, raceCard(app, id)),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'awaken-accept', onclick: finish }, mode === 'first' ? 'รับสายเลือดนี้' : 'ตกลง')));
    };
    intro();
  }

  return { openCeremony, get busy() { return open; } };
}
