// v8.5.1 ขายด่วน: sell every unlocked piece of a chosen tier (ระดับ) and/or a chosen design (ลาย = one specific item).
// Used by the shop's sell tab and by the in-dungeon bag. The caller keeps `ui` (the picks) between renders:
//   const ui = newQuickSellUi();            // { rar:Set, des:Set, cats:Set, keepUp:true, open:false }
//   el = createQuickSell(app, ui, { onSold }) // a <details> element; it redraws itself when a chip is tapped
import { h, glyph, itemImg, fmt, confirmButton } from './dom.js';
import { RARITIES } from '../data/rarity.js';
import { QUICK_GEAR, quickSellPlan, quickSellOptions, sellQuick } from '../systems/shop.js';
import { CATEGORY_NAME, reasonText } from './format.js';

const CAT_ORDER = ['weapon', 'armor', 'charm', 'wings', 'material', 'consumable'];

export const newQuickSellUi = () => ({ rar: new Set(), des: new Set(), cats: new Set(QUICK_GEAR), keepUp: true, open: false });

const filterOf = (ui) => ({ rarities: [...ui.rar], designs: [...ui.des], cats: [...ui.cats], keepUpgraded: ui.keepUp });

export function createQuickSell(app, ui, { onSold = null } = {}) {
  const body = h('div', { class: 'qs-body' });
  const root = h('details', { class: 'qs', 'data-quicksell': '', open: ui.open },
    h('summary', {}, glyph('sell'), h('b', {}, 'ขายด่วน'), h('small', { class: 'muted' }, 'เลือกขายทั้งระดับ หรือทั้งลายไอเทม')),
    body);
  root.addEventListener('toggle', () => { ui.open = root.open; });

  function draw() {
    const st = app.store.get();
    // designs that no longer exist in the bag (sold elsewhere) drop out of the picks
    const opts = quickSellOptions(st, [...ui.cats], ui.keepUp);
    const have = new Set(opts.designs.filter((d) => d.pieces > 0).map((d) => d.id));
    for (const id of [...ui.des]) if (!have.has(id)) ui.des.delete(id);

    const toggle = (set, key) => { if (set.has(key)) set.delete(key); else set.add(key); app.audio.play('click'); draw(); };

    const tierChips = Object.values(RARITIES).sort((a, b) => b.order - a.order).map((r) => {
      const t = opts.tiers[r.id];
      const on = ui.rar.has(r.id);
      return h('button', { class: `qs-chip${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), 'data-qs-tier': r.id, style: { '--rc': r.color }, disabled: !on && t.pieces === 0, onclick: () => toggle(ui.rar, r.id) },
        h('i', { class: 'qs-dot', 'aria-hidden': 'true' }), r.name, h('span', { class: 'num qs-n' }, t.pieces));
    });
    const catChips = CAT_ORDER.map((c) => {
      const on = ui.cats.has(c);
      return h('button', { class: `qs-chip cat${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), 'data-qs-cat': c, onclick: () => toggle(ui.cats, c) }, CATEGORY_NAME[c]);
    });
    const designList = opts.designs.filter((d) => d.pieces > 0);
    const designTiles = designList.map((d) => {
      const on = ui.des.has(d.id);
      return h('button', { class: `qs-design r-${d.def.rarity}${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), 'data-qs-design': d.id, title: d.def.name, onclick: () => toggle(ui.des, d.id) },
        h('span', { class: 'qs-art' }, itemImg(d.id)),
        h('span', { class: 'qs-nm rc-text' }, d.def.name),
        h('span', { class: 'qs-sub num' }, `×${d.pieces}${d.locked ? ` · ★${d.locked}` : ''}`));
    });

    const filter = filterOf(ui);
    const plan = quickSellPlan(st, filter);
    const none = !ui.rar.size && !ui.des.size;
    const notes = [];
    if (plan.lockedSkipped) notes.push(`ข้ามของล็อก ★ ${fmt(plan.lockedSkipped)} ชิ้น`);
    if (plan.upgradedSkipped) notes.push(`ข้ามของตีบวก ${fmt(plan.upgradedSkipped)} ชิ้น`);

    const doSell = () => {
      const r = sellQuick(app.store.get(), filterOf(ui));
      if (!r.ok) { app.toast(reasonText(r.reason), 'warn'); app.audio.play('error'); draw(); return; }
      ui.des.clear();
      app.store.commit(r.state, { reason: 'sell' });
      app.audio.play('buy');
      app.toast(`ขายด่วน ${fmt(r.count)} ชิ้น ได้ ${fmt(r.earned)} ทอง${r.lockedSkipped ? ` (เก็บของล็อก ★ ${fmt(r.lockedSkipped)} ชิ้นไว้)` : ''}`, 'ok');
      draw();
      onSold?.();
    };
    const sellBtn = plan.uids.length
      ? confirmButton([glyph('sell'), `ขาย ${fmt(plan.pieces)} ชิ้น · ${fmt(plan.gold)} ทอง`], `ยืนยัน: ขาย ${fmt(plan.pieces)} ชิ้น รับ ${fmt(plan.gold)} ทอง`, doSell, 'btn danger', { 'data-qs-sell': '' })
      : h('button', { class: 'btn danger', type: 'button', disabled: true, 'data-qs-sell': '' }, none ? 'เลือกระดับหรือลายก่อน' : 'ไม่มีของที่ตรงกัน');

    body.replaceChildren(
      h('div', { class: 'qs-group' }, h('div', { class: 'qs-label' }, 'ระดับ', h('small', { class: 'muted' }, 'ตัวเลข = ชิ้นที่ขายได้')), h('div', { class: 'qs-chips' }, tierChips)),
      h('div', { class: 'qs-group' }, h('div', { class: 'qs-label' }, 'ประเภทที่รวมในการขายตามระดับ', h('small', { class: 'muted' }, 'วัตถุดิบและของใช้ปิดไว้ก่อน')), h('div', { class: 'qs-chips' }, catChips)),
      h('div', { class: 'qs-group' }, h('div', { class: 'qs-label' }, 'ลายไอเทม', h('small', { class: 'muted' }, 'แตะลายที่ไม่อยากได้ ขายทุกชิ้นของลายนั้น')),
        designTiles.length ? h('div', { class: 'qs-designs' }, designTiles) : h('div', { class: 'empty-note' }, 'ไม่มีไอเทมที่ขายได้ในกระเป๋า')),
      h('label', { class: 'qs-opt' },
        (() => { const cb = h('input', { type: 'checkbox', class: 'sell-check', 'data-qs-keepup': '' }); cb.checked = ui.keepUp; cb.addEventListener('change', () => { ui.keepUp = cb.checked; app.audio.play('click'); draw(); }); return cb; })(),
        h('span', {}, 'ไม่ขายอุปกรณ์ที่ตีบวกแล้ว (+1 ขึ้นไป)')),
      h('div', { class: 'qs-foot' },
        h('div', { class: 'qs-sum' },
          h('span', {}, plan.uids.length ? `จะขาย ${fmt(plan.uids.length)} รายการ (${fmt(plan.pieces)} ชิ้น)` : 'ยังไม่มีของที่จะขาย'),
          h('span', { class: 'price' }, itemImg('gold'), h('span', { class: 'num' }, fmt(plan.gold)))),
        notes.length ? h('small', { class: 'muted qs-notes' }, glyph('star'), notes.join(' · ')) : null,
        sellBtn));
  }

  draw();
  return root;
}
