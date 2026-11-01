// Custom battle-button layout (ปรับปุ่ม). Each control can be dragged anywhere on the screen and resized.
// A layout is kept per device and orientation (touch portrait, touch landscape, mouse) in this browser only.
//   layout = { [key]: { x, y, s } }   x, y: centre as a share of the screen (0–1) · s: size multiplier
import { h, glyph } from './dom.js';

export const LAYOUT_KEYS = Object.freeze(['stick', 'attack', 'dash', 'guard', 'potion', 'skill0', 'skill1', 'skill2', 'race', 'ult']);
export const LAYOUT_NAMES = Object.freeze({ stick: 'จอยเดิน', attack: 'โจมตี', dash: 'หลบ', guard: 'โล่', potion: 'ยา', skill0: 'สกิล 1', skill1: 'สกิล 2', skill2: 'สกิล 3', race: 'สกิลเผ่า', ult: 'ไม้ตาย' });
const ICON = { stick: 'dash', attack: 'sword', dash: 'dash', guard: 'def', potion: 'potion', skill0: 'whirl', skill1: 'lunge', skill2: 'ward', race: 'race', ult: 'star' };
const STORE = 'emberhold.hudLayout';
export const SIZE_MIN = 0.6, SIZE_MAX = 1.7;

export function layoutMode() {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (!touch) return 'mouse';
  return innerWidth > innerHeight ? 'touch-l' : 'touch-p';
}
function readAll() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } }
export function loadLayout(mode = layoutMode()) {
  const v = readAll()[mode];
  if (!v || typeof v !== 'object') return null;
  const out = {};
  for (const k of LAYOUT_KEYS) {
    const e = v[k];
    if (e && [e.x, e.y, e.s].every(Number.isFinite)) out[k] = { x: clamp(e.x, 0.02, 0.98), y: clamp(e.y, 0.02, 0.98), s: clamp(e.s, SIZE_MIN, SIZE_MAX) };
  }
  return Object.keys(out).length ? out : null;
}
export function saveLayout(layout, mode = layoutMode()) {
  const all = readAll();
  if (layout) all[mode] = layout; else delete all[mode];
  try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* storage blocked: the layout lasts for this visit only */ }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Puts the elements where the layout says (or back to the stylesheet's places when there is none).
export function applyLayout(hudEl, els, layout) {
  hudEl.classList.toggle('hud-custom', !!layout);
  for (const k of LAYOUT_KEYS) {
    const el = els[k];
    if (!el) continue;
    const e = layout?.[k];
    if (e) { el.dataset.custom = '1'; el.style.left = `${e.x * 100}vw`; el.style.top = `${e.y * 100}dvh`; el.style.setProperty('--s', e.s); }
    else { delete el.dataset.custom; el.style.left = ''; el.style.top = ''; el.style.removeProperty('--s'); }
  }
}

// The editor: replicas of every control over a dimmed arena; drag to move, pick one and slide to resize.
// measure(useCustom) → { key: { cx, cy, w, h } } in pixels, from the real HUD.
export function openLayoutEditor(app, { measure, onSaved }) {
  const mode = layoutMode();
  const keys = LAYOUT_KEYS.filter((k) => mode !== 'mouse' || k !== 'stick');
  const base = measure(false);                     // the stylesheet's own places and sizes
  const current = loadLayout(mode);
  const W = () => innerWidth, H = () => innerHeight;
  const pos = {};
  for (const k of keys) {
    const b = base[k] || { cx: W() / 2, cy: H() / 2, w: 56, h: 56 };
    const c = current?.[k];
    pos[k] = c ? { x: c.x, y: c.y, s: c.s } : { x: b.cx / W(), y: b.cy / H(), s: 1 };
  }
  let sel = 'attack', drag = null;
  const reps = {};
  const stage = h('div', { class: 'layout-stage' });
  const size = h('input', { type: 'range', min: SIZE_MIN, max: SIZE_MAX, step: 0.05, value: pos[sel].s, 'aria-label': 'ขนาดปุ่ม', 'data-layout-size': '' });
  const selName = h('b', {});
  const place = (k) => {
    const r = reps[k], b = base[k] || { w: 56, h: 56 }, p = pos[k];
    r.style.left = `${p.x * W()}px`; r.style.top = `${p.y * H()}px`;
    r.style.width = `${b.w * p.s}px`; r.style.height = `${b.h * p.s}px`;
    r.classList.toggle('sel', k === sel);
  };
  const select = (k) => { sel = k; size.value = pos[k].s; selName.textContent = LAYOUT_NAMES[k]; for (const x of keys) place(x); };
  for (const k of keys) {
    const r = h('button', { class: `layout-rep k-${k}`, type: 'button', 'data-rep': k, 'aria-label': `ย้ายปุ่ม ${LAYOUT_NAMES[k]}` }, glyph(ICON[k]), h('small', {}, LAYOUT_NAMES[k]));
    r.addEventListener('pointerdown', (e) => {
      e.preventDefault(); select(k);
      drag = { k, id: e.pointerId, dx: e.clientX - pos[k].x * W(), dy: e.clientY - pos[k].y * H() };
      try { r.setPointerCapture(e.pointerId); } catch { /* optional */ }
    });
    r.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      // the stage covers the whole screen, so positions are shares of the screen exactly as in battle
      pos[k].x = clamp((e.clientX - drag.dx) / W(), 0.03, 0.97);
      pos[k].y = clamp((e.clientY - drag.dy) / H(), 0.03, 0.97);
      place(k);
    });
    const end = () => { drag = null; };
    r.addEventListener('pointerup', end); r.addEventListener('pointercancel', end);
    // keyboard: arrows move, +/- resize
    r.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowLeft') pos[k].x = clamp(pos[k].x - step, 0.03, 0.97);
      else if (e.key === 'ArrowRight') pos[k].x = clamp(pos[k].x + step, 0.03, 0.97);
      else if (e.key === 'ArrowUp') pos[k].y = clamp(pos[k].y - step, 0.03, 0.97);
      else if (e.key === 'ArrowDown') pos[k].y = clamp(pos[k].y + step, 0.03, 0.97);
      else if (e.key === '+' || e.key === '=') pos[k].s = clamp(pos[k].s + 0.05, SIZE_MIN, SIZE_MAX);
      else if (e.key === '-') pos[k].s = clamp(pos[k].s - 0.05, SIZE_MIN, SIZE_MAX);
      else return;
      e.preventDefault(); select(k);
    });
    reps[k] = r; stage.append(r);
  }
  size.addEventListener('input', () => { pos[sel].s = clamp(Number(size.value), SIZE_MIN, SIZE_MAX); place(sel); });
  let close;
  const done = (layout) => { saveLayout(layout, mode); onSaved?.(layout); close(); };
  const bar = h('div', { class: 'layout-bar' },
    h('div', { class: 'layout-sel' }, h('small', { class: 'muted' }, 'ปุ่มที่เลือก'), selName),
    h('label', { class: 'layout-size' }, h('span', {}, 'ขนาด'), size),
    h('div', { class: 'layout-actions' },
      h('button', { class: 'btn sm', type: 'button', 'data-action': 'layout-reset', onclick: () => { for (const k of keys) { const b = base[k]; pos[k] = b ? { x: b.cx / W(), y: b.cy / H(), s: 1 } : pos[k]; } select(sel); } }, 'ค่าเริ่มต้น'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => close() }, 'ยกเลิก'),
      h('button', { class: 'btn sm primary', type: 'button', 'data-action': 'layout-save', onclick: () => {
        // an untouched layout equals the default: store nothing so future default changes still apply
        const same = keys.every((k) => { const b = base[k]; return !b || (Math.abs(pos[k].x - b.cx / W()) < 0.004 && Math.abs(pos[k].y - b.cy / H()) < 0.004 && Math.abs(pos[k].s - 1) < 0.01); });
        done(same ? null : Object.fromEntries(keys.map((k) => [k, { ...pos[k] }])));
      } }, 'บันทึก')));
  const hint = h('p', { class: 'layout-hint' }, mode === 'mouse' ? 'ลากปุ่มไปวางตรงไหนก็ได้ เลือกปุ่มแล้วเลื่อนแถบเพื่อปรับขนาด (ลูกศรเลื่อนทีละนิด, + / − ปรับขนาด)' : 'ลากปุ่มไปวางตรงไหนก็ได้ แตะเลือกปุ่มแล้วเลื่อนแถบเพื่อปรับขนาด · ตั้งแยกกันระหว่างจอแนวตั้งและแนวนอน');
  const panel = h('div', { class: 'layout-panel' }, hint, bar);
  const content = h('div', { class: 'layout-editor', 'data-modal': 'layout' }, stage, panel);
  close = app.modal(content, { dismissable: false });
  select(sel);
  return close;
}
