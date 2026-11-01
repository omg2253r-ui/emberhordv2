// Merchant: buy supplies and gear, sell what you don't need.
import { h, glyph, itemImg, rarityClass, confirmButton, fmt } from '../dom.js';
import { SHOP_STOCK } from '../../data/shop.js';
import { getItem, isStackable, isEquipment } from '../../data/items.js';
import { rarityOf } from '../../data/rarity.js';
import { buy, sellMany, sellPrice, isStockUnlocked } from '../../systems/shop.js';
import { sortedSlots, canAdd, setLock } from '../../systems/inventory.js';
import { createQuickSell, newQuickSellUi } from '../quickSell.js';
import { getStage } from '../../data/stages.js';
import { reasonText, CATEGORY_NAME } from '../format.js';
import { itemStats } from '../../systems/stats.js';
import { fmtStat, statName } from '../format.js';

export function createShopPanel(app) {
  let mode = 'buy';
  const qty = new Map();
  const picked = new Set(); // uids ticked in sell mode
  const qsUi = newQuickSellUi(); // v8.5.1: picks of the quick-sell box (kept while the panel re-renders)

  function statSummary(id) {
    const s = itemStats({ id, lvl: 0 });
    return Object.entries(s).map(([k, v]) => `${statName(k)} ${fmtStat(k, v, { sign: true })}`).join(' · ');
  }

  return {
    id: 'shop', title: 'ร้านค้า', icon: 'shop',
    open(params) { if (params?.mode) mode = params.mode; },
    render(body) {
      const st = app.store.get();
      const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'โหมดร้านค้า' },
        h('button', { type: 'button', 'aria-pressed': String(mode === 'buy'), 'data-mode': 'buy', onclick: () => { mode = 'buy'; app.audio.play('tab'); app.rerender(); } }, 'ซื้อ'),
        h('button', { type: 'button', 'aria-pressed': String(mode === 'sell'), 'data-mode': 'sell', onclick: () => { mode = 'sell'; app.audio.play('tab'); app.rerender(); } }, 'ขาย'));

      let rows;
      if (mode === 'buy') {
        rows = SHOP_STOCK.map((entry) => {
          const def = getItem(entry.itemId);
          const open = isStockUnlocked(st, entry);
          const stack = isStackable(def);
          const n = stack ? (qty.get(entry.itemId) || 1) : 1;
          const cost = entry.price * n;
          const short = st.gold < cost;
          const full = !canAdd(st, entry.itemId, n);
          const stepper = stack ? h('div', { class: 'stepper' },
            h('button', { type: 'button', 'aria-label': 'ลดจำนวน', disabled: n <= 1, onclick: () => { qty.set(entry.itemId, Math.max(1, n - 1)); app.audio.play('click'); app.rerender(); } }, '−'),
            h('span', { class: 'num', 'data-qty': entry.itemId }, n),
            h('button', { type: 'button', 'aria-label': 'เพิ่มจำนวน', disabled: n >= 10, onclick: () => { qty.set(entry.itemId, Math.min(10, n + 1)); app.audio.play('click'); app.rerender(); } }, '+')) : null;
          const reason = !open ? `ปลดล็อกหลังผ่าน ${getStage(entry.requires)?.name}` : short ? 'ทองไม่พอ' : full ? 'กระเป๋าเต็ม' : null;
          const buyBtn = h('button', { class: 'btn primary small', type: 'button', 'data-buy': entry.itemId, disabled: !!reason, title: reason || '' }, open ? 'ซื้อ' : glyph('lock'));
          buyBtn.addEventListener('click', () => {
            if (buyBtn.disabled) return;
            buyBtn.disabled = true; // guards a double click before the re-render
            const r = buy(app.store.get(), entry.itemId, n);
            if (!r.ok) { app.toast(reasonText(r.reason), 'warn'); app.audio.play('error'); app.rerender(); return; }
            app.store.commit(r.state, { reason: 'buy' });
            app.audio.play('buy');
            app.toast(`ซื้อ ${def.name} ×${n} (−${fmt(r.cost)} ทอง)`, 'ok');
          });
          return h('div', { class: `row ${rarityClass(def.rarity)}` },
            h('div', { class: 'art' }, itemImg(def.id)),
            h('div', { class: 'info' }, h('b', { class: 'rc-text' }, def.name),
              h('small', {}, isEquipment(def) ? statSummary(def.id) : def.desc),
              reason ? h('small', { style: { color: 'var(--danger)' } }, reason) : null),
            h('div', { class: 'buy' }, h('span', { class: `price ${short && open ? 'short' : ''}` }, itemImg('gold'), h('span', { class: 'num' }, fmt(cost))), stepper, buyBtn));
        });
      } else {
        const items = sortedSlots(st).filter((it) => sellPrice(it) > 0);
        const byUid = new Map(items.map((it) => [it.uid, it]));
        for (const uid of [...picked]) if (!byUid.has(uid) || byUid.get(uid).locked) picked.delete(uid); // sold, gone elsewhere, or locked ★ since
        const isRisky = (it) => { const d = getItem(it.id), r = rarityOf(d.rarity); return isEquipment(d) && (r.order >= 2 || it.lvl > 0); };

        const bar = h('div', { class: 'sell-bar' });
        const rowEls = new Map();
        const refreshBar = () => {
          const chosen = [...picked].map((u) => byUid.get(u)).filter(Boolean);
          const total = chosen.reduce((a, it) => a + sellPrice(it) * it.qty, 0);
          const pieces = chosen.reduce((a, it) => a + it.qty, 0);
          const sellable = items.filter((it) => !it.locked);
          const allOn = sellable.length > 0 && chosen.length === sellable.length;
          const doSellPicked = () => {
            const res = sellMany(app.store.get(), [...picked]);
            if (!res.ok) { app.toast(reasonText(res.reason), 'warn'); app.audio.play('error'); app.rerender(); return; }
            picked.clear();
            app.store.commit(res.state, { reason: 'sell' });
            app.audio.play('buy');
            app.toast(`ขาย ${fmt(res.count)} ชิ้น ได้ ${fmt(res.earned)} ทอง`, 'ok');
          };
          const sellBtn = !chosen.length
            ? h('button', { class: 'btn danger', type: 'button', disabled: true, 'data-sell-picked': '' }, 'ขายที่เลือก')
            : chosen.some(isRisky)
              ? confirmButton(`ขายที่เลือก ${fmt(total)} ทอง`, 'มีของหายาก/ของอัปเกรด กดอีกครั้งเพื่อยืนยัน', doSellPicked, 'btn danger', { 'data-sell-picked': '' })
              : h('button', { class: 'btn danger', type: 'button', 'data-sell-picked': '', onclick: (e) => { e.currentTarget.disabled = true; doSellPicked(); } }, `ขายที่เลือก ${fmt(total)} ทอง`);
          bar.replaceChildren(
            h('div', { class: 'sell-sum' },
              h('span', {}, chosen.length ? `เลือก ${fmt(chosen.length)} รายการ (${fmt(pieces)} ชิ้น)` : 'ยังไม่ได้เลือก'),
              h('span', { class: 'price' }, itemImg('gold'), h('span', { class: 'num' }, fmt(total)))),
            h('div', { class: 'sell-actions' },
              h('button', { class: 'btn small', type: 'button', 'data-select-all': '', disabled: !sellable.length, onclick: () => { if (allOn) picked.clear(); else sellable.forEach((it) => picked.add(it.uid)); app.audio.play('click'); syncRows(); refreshBar(); } }, allOn ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'),
              sellBtn));
        };
        const syncRows = () => {
          for (const [uid, el] of rowEls) {
            const on = picked.has(uid);
            el.classList.toggle('picked', on);
            el.setAttribute('aria-checked', String(on));
            const cb = el.querySelector('input[type=checkbox]'); if (cb) cb.checked = on;
          }
        };
        const toggle = (uid) => { if (byUid.get(uid)?.locked) { app.toast('ไอเทมนี้ล็อก ★ ไว้ ปลดล็อกก่อนจึงจะเลือกขายได้', 'warn', 'locked'); return; } if (picked.has(uid)) picked.delete(uid); else picked.add(uid); app.audio.play('click'); syncRows(); refreshBar(); };

        rows = items.length ? items.map((it) => {
          const def = getItem(it.id);
          const each = sellPrice(it);
          const cb = h('input', { type: 'checkbox', class: 'sell-check', 'data-pick': it.uid, 'aria-label': `เลือกขาย ${def.name}`, disabled: !!it.locked });
          cb.checked = picked.has(it.uid);
          const star = h('button', { class: `lock-btn${it.locked ? ' on' : ''}`, type: 'button', 'data-lock': it.uid, 'aria-pressed': String(!!it.locked), 'aria-label': `${it.locked ? 'ปลดล็อก' : 'ล็อก'} ${def.name}`, title: it.locked ? 'ปลดล็อก' : 'ล็อก ★ กันเผลอขาย',
            onclick: (e) => { e.stopPropagation(); const r = setLock(app.store.get(), it.uid); if (r.ok) { picked.delete(it.uid); app.store.commit(r.state, { reason: 'lock' }); app.audio.play('click'); } } }, glyph('star'));
          const row = h('div', { class: `row sell-row ${rarityClass(def.rarity)}${picked.has(it.uid) ? ' picked' : ''}${it.locked ? ' is-locked' : ''}`, role: 'checkbox', 'aria-checked': String(picked.has(it.uid)), tabindex: '0' },
            h('div', { class: 'art' }, itemImg(def.id), it.lvl ? h('span', { class: 'lvl-tag' }, `+${it.lvl}`) : null),
            h('div', { class: 'info' }, h('b', { class: 'rc-text' }, def.name, it.lvl ? ` +${it.lvl}` : ''), h('small', {}, `${CATEGORY_NAME[def.category]} · มี ${it.qty} · ชิ้นละ ${fmt(each)} ทอง${it.qty > 1 ? ` · รวม ${fmt(each * it.qty)}` : ''}${it.locked ? ' · ล็อก ★' : ''}`)),
            h('div', { class: 'buy' }, star, cb));
          cb.addEventListener('click', (e) => e.stopPropagation());
          cb.addEventListener('change', () => toggle(it.uid));
          row.addEventListener('click', () => toggle(it.uid));
          row.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(it.uid); } });
          rowEls.set(it.uid, row);
          return row;
        }) : [h('div', { class: 'empty-note' }, 'ไม่มีของที่ขายได้ (ของที่สวมอยู่ต้องถอดก่อนจึงจะขายได้)')];
        refreshBar();
        body.replaceChildren(seg, items.length ? createQuickSell(app, qsUi) : null, h('div', { class: 'rows' }, rows), bar);
        return;
      }
      body.replaceChildren(seg, h('div', { class: 'rows' }, rows));
    },
  };
}
