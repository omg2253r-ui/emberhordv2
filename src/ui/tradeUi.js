// Trade window: my offer (picked from the bag + gold) on the left, the other player's offer on the right.
// Lock → both locked → confirm → both confirmed the same deal → each save applies it (src/online/tradeLink.js).
import { h, glyph, itemImg, rarityClass, fmt, lockMark } from './dom.js';
import { getItem, isStackable } from '../data/items.js';
import { sortedSlots } from '../systems/inventory.js';
import { makeOffer, TRADE_SLOTS, TRADE_GOLD_MAX } from '../online/trade.js';

const REASON = {
  not_locked: 'ทั้งสองฝ่ายต้องล็อกข้อเสนอก่อน', inventory_full: 'กระเป๋าของคุณไม่พอรับของ', item_changed: 'ของในข้อเสนอของคุณเปลี่ยนไป',
  not_enough_gold: 'ทองไม่พอ', too_many: `ใส่ได้สูงสุด ${TRADE_SLOTS} ช่อง`, bad_qty: 'จำนวนไม่ถูกต้อง', not_found: 'ไม่พบไอเทมนี้ในกระเป๋า',
  partner_left: 'อีกฝ่ายออกจากการแลกเปลี่ยน', cancelled: 'ยกเลิกการแลกเปลี่ยนแล้ว', bad_item: 'ของที่ได้รับไม่ถูกต้อง', locked: 'ไอเทมนี้ถูกล็อก ★ ไว้ ปลดล็อกก่อนจึงจะแลกได้',
};

export function openTradeUi(app, link) {
  let picks = [];              // [{ uid, qty }]
  let gold = 0;
  const body = h('div', { class: 'trade-body' });
  const statusEl = h('div', { class: 'trade-status' });
  const lockBtn = h('button', { class: 'btn', type: 'button', 'data-action': 'trade-lock', onclick: () => { link.lock(!link.state.myLock); app.audio.play('click'); } });
  const okBtn = h('button', { class: 'btn primary', type: 'button', 'data-action': 'trade-confirm', onclick: () => {
    const r = link.confirm();
    if (!r.ok) { app.toast(REASON[r.reason] || 'ยืนยันไม่สำเร็จ', 'warn', 'trade'); app.audio.play('error'); } else app.audio.play('success');
  } }, glyph('check'), 'ยืนยันแลก');
  const cancelBtn = h('button', { class: 'btn danger', type: 'button', 'data-action': 'trade-cancel', onclick: () => link.cancel() }, 'ยกเลิก');
  const content = h('div', { class: 'modal panel trade-modal', 'data-modal': 'trade' },
    h('h2', {}, `แลกเปลี่ยนกับ ${link.partner.name}`), body, statusEl, h('div', { class: 'actions' }, cancelBtn, lockBtn, okBtn));

  function pushOffer() {
    const r = makeOffer(app.store.get(), picks, gold);
    if (!r.ok) { app.toast(REASON[r.reason] || 'ข้อเสนอไม่ถูกต้อง', 'warn', 'trade'); return false; }
    link.setOffer(r.offer);
    return true;
  }

  function offerList(offer, editable) {
    if (!offer.it.length && !offer.g) return h('div', { class: 'empty-note' }, editable ? 'แตะของในกระเป๋าด้านล่างเพื่อใส่ในข้อเสนอ' : 'ยังไม่ได้ใส่ของ');
    return h('div', { class: 'trade-items' },
      offer.it.map((i) => {
        const def = getItem(i.id);
        const pick = editable ? picks.find((p) => p.uid === i.u) : null;
        const slot = editable ? app.store.get().inventory.slots.find((s) => s.uid === i.u) : null;
        return h('div', { class: `trade-item ${rarityClass(def.rarity)}`, 'data-item': i.id },
          itemImg(i.id), h('span', { class: 'nm rc-text' }, def.name, i.l ? ` +${i.l}` : ''),
          editable && isStackable(def) && slot && slot.qty > 1
            ? h('input', { type: 'number', class: 'text-in qty-in', min: '1', max: String(slot.qty), value: String(pick.qty), 'aria-label': `จำนวน ${def.name}`,
              onchange: (e) => { pick.qty = Math.max(1, Math.min(slot.qty, Math.floor(+e.target.value || 1))); pushOffer(); } })
            : h('b', { class: 'num' }, `×${i.q}`),
          editable ? h('button', { class: 'btn icon ghost small', type: 'button', 'aria-label': `เอา ${def.name} ออก`, onclick: () => { picks = picks.filter((p) => p.uid !== i.u); pushOffer(); } }, glyph('close')) : null);
      }),
      offer.g ? h('div', { class: 'trade-item gold' }, itemImg('gold'), h('span', { class: 'nm' }, 'ทอง'), h('b', { class: 'num' }, fmt(offer.g))) : null);
  }

  function render() {
    const s = link.state;
    const st = app.store.get();
    if (s.closed) return;
    const used = new Set(picks.map((p) => p.uid));
    const bag = sortedSlots(st).filter((x) => !used.has(x.uid));
    const goldIn = h('input', { type: 'number', class: 'text-in', min: '0', max: String(Math.min(st.gold, TRADE_GOLD_MAX)), value: String(gold), 'aria-label': 'ทองที่เสนอ', 'data-trade-gold': '',
      disabled: s.myLock || s.applied, onchange: (e) => { gold = Math.max(0, Math.min(st.gold, TRADE_GOLD_MAX, Math.floor(+e.target.value || 0))); pushOffer(); } });
    body.replaceChildren(
      h('div', { class: 'trade-cols' },
        h('section', { class: `trade-side ${s.myLock ? 'locked' : ''}` },
          h('div', { class: 'trade-head' }, h('b', {}, 'ข้อเสนอของคุณ'), s.myLock ? h('span', { class: 'chip ok' }, glyph('lock'), 'ล็อกแล้ว') : null, s.myOk ? h('span', { class: 'chip ok' }, glyph('check'), 'ยืนยันแล้ว') : null),
          offerList(s.mine, !s.myLock && !s.applied),
          h('label', { class: 'trade-gold' }, itemImg('gold'), 'ทอง', goldIn, h('small', { class: 'muted' }, `มี ${fmt(st.gold)}`))),
        h('section', { class: `trade-side theirs ${s.theirLock ? 'locked' : ''}` },
          h('div', { class: 'trade-head' }, h('b', {}, `ข้อเสนอของ ${link.partner.name}`), s.theirLock ? h('span', { class: 'chip ok' }, glyph('lock'), 'ล็อกแล้ว') : null, s.theirOk ? h('span', { class: 'chip ok' }, glyph('check'), 'ยืนยันแล้ว') : null),
          s.seenPartner ? offerList(s.theirs, false) : h('div', { class: 'empty-note' }, 'รออีกฝ่ายเปิดหน้าต่างแลกเปลี่ยน…'))),
      !s.myLock && !s.applied
        ? h('div', {}, h('div', { class: 'eyebrow' }, `กระเป๋า (แตะเพื่อใส่ · สูงสุด ${TRADE_SLOTS} ช่อง)`),
          h('div', { class: 'grid trade-bag' }, bag.length ? bag.map((x) => {
            const def = getItem(x.id);
            return h('button', { class: `cell ${rarityClass(def.rarity)}${x.locked ? ' is-locked' : ''}`, type: 'button', title: x.locked ? `${def.name} (ล็อก ★ แลกไม่ได้)` : def.name, 'data-uid': String(x.uid), 'data-item': x.id, disabled: !!x.locked,
              onclick: () => {
                if (picks.length >= TRADE_SLOTS) { app.toast(REASON.too_many, 'warn', 'trade'); return; }
                picks.push({ uid: x.uid, qty: x.qty });
                if (pushOffer()) app.audio.play('click'); else picks.pop();
              } }, itemImg(x.id), x.locked ? lockMark() : null, x.lvl ? h('span', { class: 'lvl-tag' }, `+${x.lvl}`) : null, x.qty > 1 ? h('span', { class: 'qty' }, x.qty) : null);
          }) : h('div', { class: 'empty-note' }, 'กระเป๋าว่าง (ของที่สวมใส่อยู่แลกไม่ได้)')))
        : null);
    const check = link.check();
    lockBtn.replaceChildren(glyph('lock'), s.myLock ? 'ปลดล็อก' : 'ล็อกข้อเสนอ');
    lockBtn.disabled = s.applied;
    okBtn.disabled = !(s.myLock && s.theirLock) || !!s.myOk || s.applied || !check.ok;
    cancelBtn.disabled = s.applied;
    statusEl.className = `trade-status ${check.ok ? '' : 'warn'}`;
    statusEl.textContent = s.applied ? 'แลกเปลี่ยนสำเร็จ กำลังปิด…'
      : !check.ok ? REASON[check.reason] || 'ยังแลกไม่ได้'
      : s.myOk ? `รอ ${link.partner.name} ยืนยัน…`
      : s.myLock && s.theirLock ? 'ทั้งสองฝ่ายล็อกแล้ว ตรวจของให้ดีแล้วกดยืนยัน'
      : s.myLock ? `รอ ${link.partner.name} ล็อกข้อเสนอ…`
      : 'ใส่ของและทองที่จะให้ แล้วกดล็อกข้อเสนอ (ถ้าข้อเสนอฝ่ายไหนเปลี่ยน การล็อกจะถูกยกเลิก)';
  }

  const close = app.modal(content, { dismissable: false });
  const off = link.on((s) => {
    if (s.closed) {
      off(); close();
      const r = s.result;
      if (r?.ok) { app.toast(`แลกเปลี่ยนกับ ${link.partner.name} สำเร็จ`, 'ok'); app.audio.play('buy'); }
      else app.toast(REASON[r?.reason] || 'การแลกเปลี่ยนถูกยกเลิก', r?.reason === 'cancelled' ? 'info' : 'warn', 'trade');
      app.onTradeClosed?.();
      return;
    }
    render();
  });
  render();
  return { close: () => link.cancel() };
}
