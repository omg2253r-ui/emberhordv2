// v8.5.1 กระเป๋าในดัน: open the bag while hunting (HUD button, key B, or the pause menu) to ★ lock pieces,
// sell one piece, or quick-sell a whole tier / design — without going back to camp. The caller decides whether the game
// is paused while this window is open (solo hunts pause; online zones cannot).
import { h, glyph, itemImg, rarityClass, confirmButton, fmt, lockMark } from './dom.js';
import { getItem } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';
import { sortedSlots, setLock } from '../systems/inventory.js';
import { sell, sellPrice } from '../systems/shop.js';
import { createQuickSell, newQuickSellUi } from './quickSell.js';
import { CATEGORY_NAME, reasonText } from './format.js';

export function openDungeonBag(app, { onClose = null } = {}) {
  let selected = null;
  const qsUi = newQuickSellUi();
  qsUi.open = true;
  const body = h('div', { class: 'dbag-body' });
  let close;

  function commit(r, msg, sound = 'click') {
    if (!r.ok) { app.toast(reasonText(r.reason), 'warn'); app.audio.play('error'); return false; }
    app.store.commit(r.state, { reason: 'bag' });
    if (msg) app.toast(msg, 'ok');
    app.audio.play(sound);
    return true;
  }

  function detailOf(st, it) {
    const def = getItem(it.id);
    const each = sellPrice(it), total = each * it.qty;
    const lockBtn = h('button', { class: `btn lock-toggle${it.locked ? ' on' : ''}`, type: 'button', 'data-action': 'toggle-lock', 'aria-pressed': String(!!it.locked),
      onclick: () => { const r = setLock(app.store.get(), it.uid); if (commit(r, r.ok ? (r.locked ? `ล็อก ★ ${def.name} แล้ว` : `ปลดล็อก ${def.name} แล้ว`) : null, 'tab')) draw(); } },
      glyph('star'), it.locked ? 'ปลดล็อก' : 'ล็อก ★');
    let sellBtn = null;
    if (each > 0) {
      sellBtn = it.locked
        ? h('span', { class: 'chip', 'data-locked-note': '' }, 'ล็อกอยู่ · ขายไม่ได้')
        : confirmButton([glyph('sell'), it.qty > 1 ? `ขายทั้งหมด ${fmt(total)} ทอง` : `ขาย ${fmt(total)} ทอง`], 'กดอีกครั้งเพื่อยืนยัน', () => {
          const r = sell(app.store.get(), it.uid);
          if (commit(r, `ขายได้ ${fmt(r.earned || 0)} ทอง`, 'buy')) { selected = null; draw(); }
        }, 'btn danger', { 'data-action': 'sell-one' });
    } else sellBtn = h('span', { class: 'chip' }, 'ขายไม่ได้');
    return h('div', { class: `dbag-detail ${rarityClass(def.rarity)}`, 'data-detail': it.uid },
      h('div', { class: 'dd-art' }, itemImg(it.id), it.lvl ? h('span', { class: 'lvl-tag' }, `+${it.lvl}`) : null),
      h('div', { class: 'dd-info' },
        h('b', { class: 'rc-text' }, def.name, it.lvl ? ` +${it.lvl}` : ''),
        h('small', { class: 'muted' }, `${CATEGORY_NAME[def.category]} · ${rarityOf(def.rarity).name}${it.qty > 1 ? ` · มี ${it.qty}` : ''}${each > 0 ? ` · ชิ้นละ ${fmt(each)} ทอง` : ''}`),
        def.desc ? h('small', { class: 'dd-desc' }, def.desc) : null),
      h('div', { class: 'dd-actions' }, lockBtn, sellBtn));
  }

  function draw() {
    const st = app.store.get();
    const items = sortedSlots(st);
    if (selected && !items.some((i) => i.uid === selected)) selected = null;
    const cells = items.map((it) => {
      const def = getItem(it.id);
      return h('button', { class: `cell ${rarityClass(def.rarity)}${it.uid === selected ? ' selected' : ''}${it.locked ? ' is-locked' : ''}`, type: 'button', 'data-uid': it.uid,
        'aria-label': `${def.name}${it.lvl ? ' +' + it.lvl : ''}${it.qty > 1 ? ' จำนวน ' + it.qty : ''}${it.locked ? ' ล็อกไว้' : ''}`,
        onclick: () => { selected = it.uid === selected ? null : it.uid; app.audio.play('click'); draw(); } },
        itemImg(it.id), it.locked ? lockMark() : null, it.qty > 1 ? h('span', { class: 'qty' }, it.qty) : null, it.lvl ? h('span', { class: 'lvl-tag' }, `+${it.lvl}`) : null);
    });
    for (let i = items.length; i < st.inventory.capacity; i++) cells.push(h('div', { class: 'cell empty', 'aria-hidden': 'true' }));
    const sel = selected && items.find((i) => i.uid === selected);
    body.replaceChildren(
      h('div', { class: 'bag-head' },
        h('span', { class: 'eyebrow' }, 'กระเป๋า'),
        h('span', { class: 'muted num', 'data-bag-count': '' }, `${items.length}/${st.inventory.capacity}`),
        h('span', { class: 'price' }, itemImg('gold'), h('span', { class: 'num', 'data-bag-gold': '' }, fmt(st.gold)))),
      h('div', { class: 'grid dbag-grid' }, cells),
      sel ? detailOf(st, sel) : h('div', { class: 'empty-note' }, 'แตะไอเทมเพื่อล็อก ★ หรือขาย · ของที่สวมอยู่ต้องถอดที่ค่ายก่อน'),
      createQuickSell(app, qsUi, { onSold: draw }));
  }

  draw();
  const content = h('div', { class: 'modal panel dungeon-bag', 'data-modal': 'dungeon-bag', role: 'dialog', 'aria-label': 'กระเป๋า' },
    h('h2', {}, glyph('bag'), 'กระเป๋า'),
    body,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'bag-close', onclick: () => close() }, 'ปิดกระเป๋า')));
  close = app.modal(content, { onClose });
  return close;
}
