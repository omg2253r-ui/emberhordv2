// Status panel (สเตตัส): spend attribute points on STR / VIT / DEX / AGI / INT. The numbers shown come from
// computeStats, the same function the battle uses, so what you see here is what you fight with.
import { h, glyph, confirmButton, fmt } from '../dom.js';
import { ATTRS, ATTR_MAX, POINTS_PER_LEVEL, attrResetCost, fxText } from '../../data/attributes.js';
import { attrPoints, attrValue, allocate, resetAttrs } from '../../systems/attributes.js';
import { computeStats } from '../../systems/stats.js';
import { STAT_ORDER, fmtStat, statName, STAT_GLYPH, reasonText } from '../format.js';

const REASONS = { no_attr_points: 'แต้มสเตตัสไม่พอ', attr_max: 'สเตตัสนี้เต็มแล้ว', nothing_to_reset: 'ยังไม่ได้แจกแต้มเลย', unknown_attr: 'ไม่พบสเตตัสนี้' };

export function createAttrsPanel(app) {
  function act(r, msg, sound = 'tab') {
    if (!r.ok) { app.toast(REASONS[r.reason] || reasonText(r.reason), 'warn'); app.audio.play('error'); return false; }
    app.store.commit(r.state, { reason: 'attrs' });
    if (msg) app.toast(msg, 'ok');
    app.audio.play(sound);
    app.rerender();
    return true;
  }

  function row(st, a, free) {
    const n = attrValue(st, a.id);
    const full = n >= ATTR_MAX;
    const addBtn = (label, amount) => h('button', {
      class: `btn sm ${free > 0 && !full ? 'gold' : ''}`, type: 'button', 'data-action': `attr-${a.id}-${amount}`,
      disabled: free <= 0 || full, 'aria-label': `เพิ่ม${a.name} ${label}`,
      onclick: () => { const r = allocate(app.store.get(), a.id, amount); act(r, null, 'click'); },
    }, label);
    return h('div', { class: 'attr-row', 'data-attr': a.id, style: { '--sc': a.color } },
      h('div', { class: 'attr-ic' }, glyph(a.glyph)),
      h('div', { class: 'attr-main' },
        h('div', { class: 'attr-head' }, h('b', {}, a.name), h('small', { class: 'muted' }, a.en), h('span', { class: 'attr-val num' }, `${n}`, h('small', { class: 'muted' }, `/${ATTR_MAX}`))),
        h('i', { class: 'sbar', 'aria-hidden': 'true' }, h('u', { style: { width: `${Math.round((n / ATTR_MAX) * 100)}%` } })),
        h('small', { class: 'attr-desc muted' }, a.desc),
        h('small', { class: 'attr-fx' }, `ต่อ 1 แต้ม: ${a.fx.map((f) => fxText(f, 1)).join(' · ')}`),
        n > 0 ? h('small', { class: 'attr-now' }, `ตอนนี้ได้: ${a.fx.map((f) => fxText(f, n)).join(' · ')}`) : null),
      h('div', { class: 'attr-btns' }, addBtn('+1', 1), addBtn('+5', 5), addBtn('MAX', 999)));
  }

  function render(body) {
    const st = app.store.get();
    const { total, spent, free } = attrPoints(st);
    const stats = computeStats(st);
    const map = { atk: stats.atk, def: stats.def, hp: stats.maxHp, crit: stats.crit, critMult: stats.critMult, spd: stats.spdBonus };
    const statGrid = h('div', { class: 'statgrid' }, STAT_ORDER.map((k) => h('div', { class: 'stat', 'data-stat': k }, glyph(STAT_GLYPH[k]), h('small', {}, statName(k)), h('b', {}, fmtStat(k, map[k], { total: true })))));
    const cost = attrResetCost(st.player.level);
    const resetBtn = confirmButton([glyph('back'), `รีเซ็ตแต้ม · ${fmt(cost)} ทอง`], `ยืนยัน: จ่าย ${fmt(cost)} ทอง คืนแต้มทั้งหมด`, () => {
      const r = resetAttrs(app.store.get());
      act(r, r.ok ? `คืนแต้มสเตตัส ${spent} แต้มแล้ว` : null, 'success');
    }, 'btn sm', { 'data-action': 'attr-reset', disabled: spent === 0 });

    body.replaceChildren(
      h('div', { class: 'attr-top' },
        h('div', { class: `attr-free ${free > 0 ? 'has' : ''}`, 'data-free': free }, h('small', { class: 'muted' }, 'แต้มสเตตัสคงเหลือ'), h('b', { class: 'num' }, fmt(free))),
        h('div', { class: 'attr-meta muted' }, h('small', {}, `ใช้แล้ว ${fmt(spent)} จาก ${fmt(total)} แต้ม`), h('small', {}, `ได้ ${POINTS_PER_LEVEL} แต้มทุกครั้งที่เลเวลอัป`))),
      statGrid,
      h('div', { class: 'attr-list' }, ATTRS.map((a) => row(st, a, free))),
      h('div', { class: 'attr-foot' }, resetBtn, h('small', { class: 'muted' }, `แต้มเต็มได้สเตตัสละ ${ATTR_MAX} แต้ม จึงต้องเลือกสายที่จะเสริม`)));
  }

  return { id: 'attrs', title: 'สเตตัส', icon: 'up', badge: () => attrPoints(app.store.get()).free > 0, render };
}
