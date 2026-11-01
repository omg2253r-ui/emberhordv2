// ประกาศอัปเดต — the patch-notes window. Opens by itself once after an update (when the player returns to camp),
// and any time from the title screen ("มีอะไรใหม่") or Settings. Older versions fold underneath.
import { h, glyph } from './dom.js';
import { CHANGELOG, GAME_VERSION, markSeen } from '../data/changelog.js';

const fmtDate = (iso) => { try { return new Date(`${iso}T12:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } };

function entryBody(e) {
  return h('div', { class: 'pn-sections' }, e.sections.map((s) => h('section', { class: 'pn-sec' },
    h('h3', {}, h('span', { class: 'pn-ic' }, glyph(s.icon)), s.title),
    h('ul', {}, s.items.map((t) => h('li', {}, t))))));
}

export function openPatchNotes(app, { onClose } = {}) {
  const [now, ...older] = CHANGELOG;
  let close;
  const content = h('div', { class: 'modal panel patch-notes', 'data-modal': 'patch-notes', 'data-version': now.version, role: 'dialog', 'aria-label': `ประกาศอัปเดตเวอร์ชัน ${now.version}` },
    h('header', { class: 'pn-head' },
      h('div', { class: 'pn-badge' }, h('small', {}, 'อัปเดต'), h('b', { class: 'num' }, `v${now.version.replace(/\.0$/, '')}`)),
      h('div', { class: 'pn-title' }, h('small', { class: 'muted' }, `ประกาศอัปเดต · ${fmtDate(now.date)}`), h('h2', {}, now.title), h('p', {}, now.lead))),
    h('div', { class: 'pn-scroll' },
      entryBody(now),
      older.length ? h('details', { class: 'pn-older' }, h('summary', {}, `อัปเดตก่อนหน้า (${older.length})`),
        older.map((e) => h('div', { class: 'pn-old' }, h('div', { class: 'pn-old-head' }, h('b', {}, `v${e.version.replace(/\.0$/, '')} · ${e.title}`), h('small', { class: 'muted' }, fmtDate(e.date))), h('p', { class: 'muted' }, e.lead), entryBody(e)))) : null),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'notes-close', onclick: () => close() }, 'เข้าใจแล้ว ไปผจญภัยต่อ')));
  close = app.modal(content, { onClose: () => { markSeen(GAME_VERSION); onClose?.(); } });
  app.audio?.play?.('unlock');
  return close;
}
