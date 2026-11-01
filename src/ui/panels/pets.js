// Pets: summon with Amber Sparks (odds + pity shown), the collection with stars, and choosing who comes along.
import { h, glyph, itemImg, pct, rarityClass, fmt } from '../dom.js';
import { PETS, PET_IDS, SUMMON_COST, PITY, MAX_STARS, DUPLICATE_REFUND, TIER_ODDS, PET_TEAM, petOdds, petValues } from '../../data/pets.js';
import { rarityOf } from '../../data/rarity.js';
import { summonPets, togglePet, teamOf, pityLeft, tierOdds } from '../../systems/pets.js';
import { luckMult, luckLeftMs, fmtLuckTime } from '../../systems/luck.js';
import { reasonText } from '../format.js';

const stars = (n) => h('span', { class: 'stars', 'aria-label': `${n} ดาว` }, Array.from({ length: MAX_STARS }, (_, i) => h('i', { class: i < n ? 'on' : '' }, glyph('star'))));

export function createPetsPanel(app) {
  let filter = 'all';
  function toggle(id) {
    const r = togglePet(app.store.get(), id);
    if (!r.ok) { app.toast(reasonText(r.reason), 'warn'); app.audio.play('error'); return; }
    app.store.commit(r.state, { reason: 'pet' });
    app.toast(r.joined ? `${PETS[id].name} จะร่วมออกล่าด้วย` : `${PETS[id].name} พักที่ค่าย`, r.joined ? 'ok' : 'info');
    app.audio.play(r.joined ? 'tab' : 'click');
  }
  function summon(count) {
    app.store.exclusive('summon', () => {
      const r = summonPets(app.store.get(), app.rng, count);
      if (!r.ok) { app.toast(reasonText(r.reason), 'warn'); app.audio.play('error'); return; }
      app.store.commit(r.state, { reason: 'summon' });
      showResults(r.results);
    });
  }

  function showResults(results) {
    const best = Math.max(...results.map((x) => rarityOf(PETS[x.id].rarity).order));
    app.audio.play(best >= 4 ? 'legendary' : 'summon');
    let close;
    const cards = results.map((x, i) => {
      const pet = PETS[x.id], rar = rarityOf(pet.rarity);
      return h('div', { class: `pet-reveal ${rarityClass(pet.rarity)}`, style: { animationDelay: `${i * 160}ms` }, 'data-pet': x.id },
        h('div', { class: 'pr-glow' }),
        h('img', { src: app.petUri(x.id), alt: '' }),
        h('b', { class: 'rc-text' }, pet.name),
        h('span', { class: 'faint' }, rar.name),
        x.isNew ? h('span', { class: 'tag new' }, 'ใหม่!') : x.refund ? h('span', { class: 'tag' }, `ดาวเต็ม คืน ${x.refund} ประกาย`) : h('span', { class: 'tag' }, `ดาว ${x.stars}`),
        x.guaranteed ? h('small', { class: 'faint' }, 'การันตี') : null);
    });
    const content = h('div', { class: 'modal panel', 'data-modal': 'summon' },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, 'ผลการอัญเชิญ'),
      h('div', { class: `pet-reveals n${results.length}` }, cards),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'summon-ok', onclick: () => close() }, 'ตกลง')));
    close = app.modal(content, { onClose: () => app.rerender() });
  }

  return {
    id: 'pets', title: 'สัตว์เลี้ยง', icon: 'paw',
    badge: () => app.store.get().sparks >= SUMMON_COST,
    render(body) {
      const st = app.store.get();
      const odds = petOdds();
      const left = pityLeft(st);
      const lm = luckMult(st);
      const can1 = st.sparks >= SUMMON_COST, can5 = st.sparks >= SUMMON_COST * 5;
      const summonBox = h('div', { class: 'summon-box' },
        h('div', { class: 'sb-top' },
          h('div', { class: 'spark-pill' }, itemImg('spark'), h('b', { class: 'num', 'data-sparks': '' }, fmt(st.sparks)), h('span', { class: 'muted' }, 'ประกายอำพัน')),
          h('div', { class: 'pity' }, glyph('star'), h('span', {}, left === 1 ? 'ครั้งถัดไปการันตีระดับล้ำค่าขึ้นไป' : `การันตีระดับล้ำค่าขึ้นไปภายใน ${left} ครั้ง`))),
        h('div', { class: 'sb-actions' },
          h('button', { class: 'btn primary', type: 'button', 'data-summon': '1', disabled: !can1, onclick: () => summon(1) }, h('span', {}, 'อัญเชิญ ×1'), h('small', {}, itemImg('spark'), `${SUMMON_COST}`)),
          h('button', { class: 'btn gold', type: 'button', 'data-summon': '5', disabled: !can5, onclick: () => summon(5) }, h('span', {}, 'อัญเชิญ ×5'), h('small', {}, itemImg('spark'), `${SUMMON_COST * 5}`))),
        h('small', { class: 'faint' }, `ได้ประกายจากบอส หีบ เอกสารที่อ่านครั้งแรก และการผ่านด่านครั้งแรก · ได้ซ้ำ = ดาว +1 (สูงสุด ${MAX_STARS} ดาว ความสามารถ +15% ต่อดาว) · ดาวเต็มแล้วคืน ${DUPLICATE_REFUND} ประกาย`));

      const tiers = Object.entries(tierOdds(lm)).map(([t, p]) => h('span', { class: `chip ${rarityClass(t)}` }, h('span', { class: 'rc-text' }, rarityOf(t).name), ` ${pct(p)}`));
      const oddsBox = h('details', { class: 'odds-box' },
        h('summary', {}, glyph('dice'), 'โอกาสในการอัญเชิญ'),
        h('div', { class: 'chips' }, tiers),
        h('div', { class: 'odds-table' }, PET_IDS.map((id) => h('div', { class: `odds-row ${rarityClass(PETS[id].rarity)}` },
          h('img', { class: 'mini-pet', src: app.petUri(id), alt: '' }), h('span', { class: 'rc-text' }, PETS[id].name), h('span', { class: 'faint' }, PETS[id].role), h('b', { class: 'num' }, pct(odds[id], 2))))),
        h('small', { class: 'faint' }, `ทุกการอัญเชิญครั้งที่ ${PITY} ที่ยังไม่ได้ระดับล้ำค่าขึ้นไป จะได้ระดับล้ำค่า (${pct(TIER_ODDS.epic / (TIER_ODDS.epic + TIER_ODDS.legendary))}) หรือตำนาน (${pct(TIER_ODDS.legendary / (TIER_ODDS.epic + TIER_ODDS.legendary))}) แน่นอน`));

      const team = teamOf(st);
      const teamBox = h('div', { class: 'pet-team', 'data-pet-team': '' },
        h('div', { class: 'bag-head' }, h('span', { class: 'eyebrow' }, 'ทีมที่ร่วมออกล่า'), h('span', { class: 'muted num' }, `${team.length}/${PET_TEAM}`)),
        h('div', { class: 'pet-team-slots' }, Array.from({ length: PET_TEAM }, (_, i) => {
          const id = team[i];
          if (!id) return h('div', { class: 'pet-slot empty' }, glyph('paw'), h('small', { class: 'faint' }, 'ว่าง'));
          const pet = PETS[id];
          return h('div', { class: `pet-slot ${rarityClass(pet.rarity)}`, 'data-team-slot': id },
            h('img', { src: app.petUri(id), alt: '' }), h('b', { class: 'rc-text' }, pet.name), h('small', { class: 'faint' }, pet.ability.name),
            h('button', { class: 'btn small', type: 'button', 'data-pet-rest': id, onclick: () => toggle(id) }, 'ให้พัก'));
        })),
        h('small', { class: 'faint' }, `พาสัตว์เลี้ยงไปได้พร้อมกัน ${PET_TEAM} ตัว ความสามารถทำงานพร้อมกันทุกตัว (โบนัสค่าสถานะแต่ละชนิดมีเพดาน)`));
      const filters = [['all', 'ทั้งหมด'], ['owned', 'มีแล้ว'], ['missing', 'ยังไม่พบ']];
      const filterRow = h('div', { class: 'craft-tabs pet-filter' }, filters.map(([k, label]) => h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(filter === k), 'data-pet-filter': k, onclick: () => { filter = k; app.rerender(); } }, label)));
      const ids = PET_IDS.filter((id) => filter === 'all' || (filter === 'owned' ? !!st.pets.owned[id] : !st.pets.owned[id]));
      const grid = h('div', { class: 'pet-grid' }, ids.map((id) => {
        const pet = PETS[id], own = st.pets.owned[id], active = team.includes(id);
        if (!own) return h('div', { class: `pet-card locked ${rarityClass(pet.rarity)}`, 'data-pet': id },
          h('img', { src: app.petUri(id), alt: '', class: 'silhouette' }), h('b', {}, 'ยังไม่พบ'), h('span', { class: 'faint' }, `${rarityOf(pet.rarity).name} · ${pet.role}`));
        const v = petValues(pet, own.stars);
        return h('div', { class: `pet-card ${rarityClass(pet.rarity)} ${active ? 'active' : ''}`, 'data-pet': id },
          h('img', { src: app.petUri(id), alt: '' }),
          h('b', { class: 'rc-text' }, pet.name), stars(own.stars),
          h('span', { class: 'faint' }, `${rarityOf(pet.rarity).name} · ${pet.role}`),
          h('p', { class: 'pet-ab' }, h('b', {}, `${pet.ability.name}: `), pet.text(v)),
          active
            ? h('button', { class: 'btn small', type: 'button', 'data-pet-rest': id, onclick: () => toggle(id) }, 'ให้พักที่ค่าย')
            : h('button', { class: `btn ${team.length >= PET_TEAM ? '' : 'primary'} small`, type: 'button', 'data-pet-use': id, onclick: () => toggle(id) }, glyph('paw'), team.length >= PET_TEAM ? 'ทีมเต็ม' : 'พาออกล่า'));
      }));
      const owned = Object.keys(st.pets.owned).length;
      const luckNote = lm > 1 ? h('div', { class: 'notice ok', 'data-luck-note': '' }, 'ยาโชคดีทำงานอยู่ (เหลือ ', h('b', { class: 'num', 'data-luck-left': '' }, fmtLuckTime(luckLeftMs(st))), `): โอกาสได้สัตว์เลี้ยงระดับหายากขึ้นไปสูงขึ้นเกือบ ${lm} เท่า`) : null;
      body.replaceChildren(...[summonBox, luckNote, teamBox, oddsBox].filter(Boolean),   // checkpoint3: a null luckNote used to print the word "null"
        h('div', { class: 'bag-head' }, h('span', { class: 'eyebrow' }, 'สัตว์เลี้ยงของข้า'), h('span', { class: 'muted num' }, `${owned}/${PET_IDS.length}`)),
        filterRow, grid);
    },
  };
}
