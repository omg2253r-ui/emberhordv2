// Equipment slots, derived stats, and the bag.
import { h, glyph, itemImg, rarityClass, confirmButton, fmt, lockMark } from '../dom.js';
import { getItem, isEquipment, EQUIP_SLOTS, SLOT_NAMES } from '../../data/items.js';
import { computeStats } from '../../systems/stats.js';
import { sortedSlots, setLock } from '../../systems/inventory.js';
import { equip, unequip, findInstance } from '../../systems/equipment.js';
import { sell, sellPrice } from '../../systems/shop.js';
import { STAT_ORDER, fmtStat, statName, STAT_GLYPH, reasonText } from '../format.js';
import { itemCard, itemArt } from '../itemCard.js';
import { nextBag, upgradeBag } from '../../systems/bag.js';
import { LUCK } from '../../data/luck.js';
import { drinkLuck, luckLeftMs, fmtLuckTime } from '../../systems/luck.js';

export function createGearPanel(app) {
  let selected = null; // uid

  function act(result, okMsg, sound = 'click') {
    if (!result.ok) { app.toast(reasonText(result.reason), 'warn'); app.audio.play('error'); return false; }
    app.store.commit(result.state, { reason: 'gear' });
    if (okMsg) app.toast(okMsg, 'ok');
    app.audio.play(sound);
    return true;
  }

  // ขยายกระเป๋า: +5 ช่อง ราคาขึ้นทุกครั้ง
  function bagButton(st) {
    const n = nextBag(st);
    if (n.max) return h('span', { class: 'chip', 'data-bag-max': '' }, 'กระเป๋าใหญ่สุดแล้ว');
    const short = st.gold < n.cost;
    return confirmButton([glyph('bag'), `ขยาย +5 · ${fmt(n.cost)} ทอง`], `ยืนยัน: จ่าย ${fmt(n.cost)} ทอง ขยายเป็น ${n.next} ช่อง`, () => {
      const r = upgradeBag(app.store.get());
      if (act(r, r.ok ? `กระเป๋าขยายเป็น ${r.capacity} ช่อง` : null, 'success')) app.rerender();
    }, `btn sm ${short ? '' : 'gold'} bag-up`, { 'data-action': 'bag-upgrade', 'data-cost': n.cost, title: short ? `ต้องมีทอง ${fmt(n.cost)}` : '' });
  }

  return {
    id: 'gear', title: 'อุปกรณ์', icon: 'bag',
    open(params) { if (params?.uid) selected = params.uid; },
    render(body) {
      const st = app.store.get();
      const stats = computeStats(st);
      if (selected && !findInstance(st, selected)) selected = null;

      const slots = h('div', { class: 'slots' }, EQUIP_SLOTS.map((slot) => {
        const inst = st.equipment[slot];
        const def = inst && getItem(inst.id);
        return h('button', { class: `slot ${def ? rarityClass(def.rarity) : ''} ${inst && inst.uid === selected ? 'selected' : ''}`, type: 'button', 'data-slot': slot,
          onclick: () => { if (inst) { selected = inst.uid; app.audio.play('click'); app.rerender(); } } },
          h('span', { class: 'lbl' }, SLOT_NAMES[slot]),
          inst ? (() => { const a = itemArt(inst); if (inst.locked) a.append(lockMark()); return a; })() : h('div', { class: 'art', style: { opacity: 0.25 } }, glyph(slot === 'charm' ? 'crown' : slot === 'armor' ? 'def' : slot === 'wings' ? 'wings' : 'sword')),
          h('span', { class: 'nm rc-text' }, def ? def.name : 'ว่าง'));
      }));

      const statGrid = h('div', { class: 'statgrid' }, STAT_ORDER.map((k) => {
        const map = { atk: stats.atk, def: stats.def, hp: stats.maxHp, crit: stats.crit, critMult: stats.critMult, spd: stats.spdBonus };
        // the bar is a soft scale (value / (value + a typical mid-game value)): it shows growth, it never fills
        const REF = { atk: 60, def: 45, hp: 700, crit: 0.2, critMult: 1.2, spd: 0.25 };
        const v = k === 'critMult' ? Math.max(0, map[k] - 1) : Math.max(0, map[k] || 0);
        const pct = Math.round((v / (v + REF[k])) * 100);
        return h('div', { class: 'stat', 'data-stat': k }, glyph(STAT_GLYPH[k]), h('small', {}, statName(k)), h('b', {}, fmtStat(k, map[k], { total: true })), h('i', { class: 'sbar', 'aria-hidden': 'true' }, h('u', { style: { width: `${pct}%` } })));
      }));

      const items = sortedSlots(st);
      const cells = [];
      for (const it of items) {
        const def = getItem(it.id);
        cells.push(h('button', { class: `cell ${rarityClass(def.rarity)} ${it.uid === selected ? 'selected' : ''}${it.locked ? ' is-locked' : ''}`, type: 'button', 'data-uid': it.uid, 'aria-label': `${def.name}${it.lvl ? ' +' + it.lvl : ''}${it.qty > 1 ? ' จำนวน ' + it.qty : ''}${it.locked ? ' ล็อกไว้' : ''}`,
          onclick: () => { selected = it.uid; app.audio.play('click'); app.rerender(); } },
          itemImg(it.id), it.locked ? lockMark() : null, it.qty > 1 ? h('span', { class: 'qty' }, it.qty) : null, it.lvl ? h('span', { class: 'lvl-tag' }, `+${it.lvl}`) : null));
      }
      for (let i = items.length; i < st.inventory.capacity; i++) cells.push(h('div', { class: 'cell empty', 'aria-hidden': 'true' }));

      let detail = h('div', { class: 'empty-note' }, 'แตะไอเทมเพื่อดูรายละเอียด สวมใส่ หรือขาย');
      const found = selected && findInstance(st, selected);
      if (found) {
        const inst = found.instance, def = getItem(inst.id);
        const actions = [];
        if (found.where === 'equipped') {
          if (found.slot !== 'weapon') actions.push(h('button', { class: 'btn', type: 'button', 'data-action': 'unequip', onclick: () => act(unequip(st, found.slot), `ถอด ${def.name} แล้ว`) }, 'ถอดออก'));
          actions.push(h('button', { class: 'btn gold', type: 'button', 'data-action': 'to-forge', onclick: () => app.openPanel('forge', { uid: inst.uid }) }, glyph('hammer'), 'ตีบวก'));
        } else if (isEquipment(def)) {
          actions.push(h('button', { class: 'btn primary', type: 'button', 'data-action': 'equip', onclick: () => { if (act(equip(st, inst.uid), `สวม ${def.name} แล้ว`, 'tab')) app.refreshHeroSprites(); } }, glyph('equip'), 'สวมใส่'));
          actions.push(h('button', { class: 'btn gold', type: 'button', 'data-action': 'to-forge', onclick: () => app.openPanel('forge', { uid: inst.uid }) }, glyph('hammer'), 'ตีบวก'));
        }
        if (def.id === LUCK.itemId && found.where === 'inventory') {
          const on = luckLeftMs(st) > 0;
          actions.push(h('button', { class: 'btn gold', type: 'button', 'data-action': 'drink-luck', onclick: () => {
            const r = drinkLuck(app.store.get());
            if (act(r, r.ok ? `ดื่มยาโชคดี! โชคดี ×${LUCK.mult} เหลือ ${fmtLuckTime(r.leftMs)}` : null, 'success')) app.rerender();
          } }, glyph('potion'), on ? 'ดื่มต่อเวลา +5 นาที' : 'ดื่มยาโชคดี'));
          if (on) actions.push(h('span', { class: 'chip', 'data-luck-note': '' }, 'เหลือ ', h('b', { class: 'num', 'data-luck-left': '' }, fmtLuckTime(luckLeftMs(st)))));
        }
        // v8.5.1 ★ ล็อก: protects this piece from every kind of selling (and trading); works on worn pieces too
        actions.push(h('button', { class: `btn lock-toggle${inst.locked ? ' on' : ''}`, type: 'button', 'data-action': 'toggle-lock', 'aria-pressed': String(!!inst.locked),
          onclick: () => { const r = setLock(app.store.get(), inst.uid); if (act(r, r.ok ? (r.locked ? `ล็อก ★ ${def.name} แล้ว จะไม่ถูกขาย` : `ปลดล็อก ${def.name} แล้ว`) : null, 'tab')) app.rerender(); } },
          glyph('star'), inst.locked ? 'ปลดล็อก' : 'ล็อก ★'));
        if (found.where === 'inventory' && inst.locked && sellPrice(inst) > 0) {
          actions.push(h('span', { class: 'chip', 'data-locked-note': '' }, 'ล็อกอยู่ · ขายไม่ได้'));
        } else if (found.where === 'inventory' && sellPrice(inst) > 0) {
          const total = sellPrice(inst) * inst.qty;
          const label = inst.qty > 1 ? `ขายทั้งหมด ${fmt(total)} ทอง` : `ขาย ${fmt(total)} ทอง`;
          actions.push(confirmButton([glyph('sell'), label], 'กดอีกครั้งเพื่อยืนยัน', () => {
            const r = sell(app.store.get(), inst.uid);
            if (act(r, `ขายได้ ${fmt(r.earned || 0)} ทอง`, 'buy')) selected = null;
          }, 'btn danger'));
        }
        detail = itemCard(st, inst, { equipped: found.where === 'equipped', actions });
      }

      body.replaceChildren(
        slots, statGrid, detail,
        h('div', { class: 'bag-head' }, h('span', { class: 'eyebrow' }, 'กระเป๋า'), h('span', { class: 'muted num', 'data-bag-count': '' }, `${items.length}/${st.inventory.capacity}`),
          h('button', { class: 'btn sm', type: 'button', 'data-action': 'quick-sell', onclick: () => app.openPanel('shop', { mode: 'sell' }) }, glyph('sell'), 'ขายด่วน'), bagButton(st)),
        h('div', { class: 'grid' }, cells));
    },
  };
}
