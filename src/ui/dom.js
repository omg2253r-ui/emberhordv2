// Tiny DOM helpers shared by every UI module.
import { UI, itemIconSvg, goldIconSvg, sparkIconSvg, svgDataUri } from '../art/icons.js';
import { artifactIconSvg } from '../art/artifacts.js';
import { getArtifact } from '../data/artifacts.js';
import { getItem } from '../data/items.js';
import { skillIconSvg, ultIconSvg } from '../art/skillIcons.js';
import { getUlt, ULT_TIERS } from '../data/ultimates.js';
import { getSkill } from '../data/skills.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function glyph(name) {
  return h('span', { class: 'gi', html: UI[name] || '' });
}

const iconCache = new Map();
export function itemImg(id, alt = '') {
  if (!iconCache.has(id)) iconCache.set(id, svgDataUri(id === 'gold' ? goldIconSvg() : id === 'spark' ? sparkIconSvg() : itemIconSvg(id)));
  const def = id === 'gold' || id === 'spark' ? null : getItem(id);
  return h('img', { class: 'item-img', src: iconCache.get(id), alt: alt || (def ? def.name : id === 'spark' ? 'ประกายอำพัน' : 'เหรียญทอง'), draggable: 'false' });
}

const skillCache = new Map();
export function skillImg(id, cls = 'skill-img') {
  if (!skillCache.has(id)) skillCache.set(id, svgDataUri(skillIconSvg(getSkill(id))));
  return h('img', { class: cls, src: skillCache.get(id), alt: getSkill(id)?.name || '', draggable: 'false' });
}
export function skillUri(id) { if (!skillCache.has(id)) skillCache.set(id, svgDataUri(skillIconSvg(getSkill(id)))); return skillCache.get(id); }

const ultCache = new Map();
export function ultUri(id, secret = false) {
  const k = `${id}|${secret}`;
  if (!ultCache.has(k)) { const d = getUlt(id); ultCache.set(k, svgDataUri(ultIconSvg(d, (ULT_TIERS[d?.tier] || ULT_TIERS[1]).color, secret))); }
  return ultCache.get(k);
}
export function ultImg(id, cls = 'ult-img', secret = false) { return h('img', { class: cls, src: ultUri(id, secret), alt: secret ? '???' : getUlt(id)?.name || '', draggable: 'false' }); }

const artCache = new Map();
export function artifactImg(id) {
  const art = getArtifact(id);
  if (!artCache.has(id)) artCache.set(id, svgDataUri(artifactIconSvg(art)));
  return h('img', { class: 'item-img art-img', src: artCache.get(id), alt: art ? art.name : '', draggable: 'false' });
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

export const fmt = (n) => Math.round(n).toLocaleString('th-TH');
export const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;

// A button that needs a second press to confirm (the viewer frame blocks window.confirm()).
export function confirmButton(label, confirmLabel, onConfirm, cls = 'btn', attrs = {}) {
  let armed = false, timer = 0;
  const btn = h('button', { ...attrs, class: cls, type: 'button' }, label);
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true; btn.classList.add('confirming');
      btn.replaceChildren(...[confirmLabel].flat());
      timer = setTimeout(() => { armed = false; btn.classList.remove("confirming"); btn.replaceChildren(...[label].flat()); }, 3000);
      return;
    }
    clearTimeout(timer); armed = false; btn.classList.remove('confirming');
    onConfirm();
  });
  return btn;
}

export function rarityClass(id) { return 'r-' + id; }

// v8.5.1 ล็อก ★: the small star shown on a protected piece (the same mark everywhere: bag cells, sell rows, trade, dungeon bag)
export function lockMark() { return h('span', { class: 'lock-mark', title: 'ล็อก ★ ไว้ ขายหรือแลกไม่ได้', role: 'img', 'aria-label': 'ล็อกไว้' }, glyph('star')); }
