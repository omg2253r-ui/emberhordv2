// Notification queue. Keys de-duplicate repeated messages (e.g. "bag full").
import { h, glyph, itemImg, rarityClass } from './dom.js';

export function createToasts(root) {
  const box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  root.append(box);
  const active = new Map();
  const MAX = 3;

  return function toast(text, kind = 'info', key = null, opts = {}) {
    if (key && active.has(key)) { const el = active.get(key); el.firstChild && el.lastChild && (el.lastChild.textContent = text); return; }
    const icon = opts.itemId ? itemImg(opts.itemId) : glyph(opts.glyph || (kind === 'warn' ? 'lock' : kind === 'ok' ? 'check' : 'crown'));
    const el = h('div', { class: `toast ${kind} ${opts.rarity ? rarityClass(opts.rarity) : ''}` }, icon, h('span', {}, text));
    if (opts.rarity) el.querySelector('span').classList.add('rc-text');
    box.append(el);
    if (key) active.set(key, el);
    while (box.children.length > MAX) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); if (key) active.delete(key); }, 300); }, opts.duration || 2200);
  };
}
