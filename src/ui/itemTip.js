// Item tooltip: press and hold (touch or mouse), tap, hover with a mouse, or focus with the keyboard on any
// element made with tipTarget() to see what the item is, what it is for, and what the merchant pays for it.
// One floating card is shared by the whole page; it never blocks the game loop and closes on the next tap.
import { h, itemImg, fmt, pct } from './dom.js';
import { getItem, isEquipment, SLOT_NAMES } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';
import { getWeaponType } from '../data/weapons.js';
import { SHOP_STOCK } from '../data/shop.js';
import { BALANCE } from '../config/balance.js';
import { REROLL_ITEM } from '../data/races.js';
import { itemStats } from '../systems/stats.js';
import { sellPrice } from '../systems/shop.js';
import { STAT_ORDER, fmtStat, statName, CATEGORY_NAME } from './format.js';

const HOLD_MS = 380;
const HOVER_MS = 220;
const MOVE_CANCEL = 10;

// ------------------------------------------------------------------ what the card says (pure: tested)
export function itemInfo(id, state = null) {
  const def = getItem(id);
  if (!def) return null;
  const rar = rarityOf(def.rarity);
  const uses = [];
  let stats = null;
  if (isEquipment(def)) {
    stats = itemStats({ id, lvl: 0 });
    if (def.category === 'weapon') {
      const t = getWeaponType(def.wtype);
      uses.push(`สวมเป็นอาวุธ (${t.name}) — ${t.desc}`);
    } else uses.push(`สวมในช่อง${SLOT_NAMES[def.category]} เพิ่มค่าสถานะตามตัวเลขด้านล่าง`);
    uses.push(`ตีบวกได้ถึง +${BALANCE.upgrade.maxLevel} ที่โรงตีเหล็ก ค่าสถานะเพิ่ม ${Math.round(BALANCE.upgrade.statGrowthPerLevel * 100)}% ต่อขั้น (+11 ขึ้นไป ${Math.round(BALANCE.upgrade.statGrowthHigh * 100)}%)`);
  } else if (def.category === 'consumable') {
    uses.push('พกติดตัวเข้าด่าน แล้วกดใช้ระหว่างต่อสู้');
  } else if (def.category === 'material') {
    const bands = BALANCE.upgrade.materials.filter((b) => b.items.some((m) => m.id === id));
    if (bands.length) {
      const lo = Math.min(...bands.map((b) => b.minLevel)), hi = Math.max(...bands.map((b) => b.maxLevel));
      uses.push(`วัตถุดิบตีบวกอุปกรณ์ ตอนอุปกรณ์อยู่ระดับ +${lo} ถึง +${hi} (ตีขึ้นเป็น +${lo + 1} ถึง +${hi + 1})`);
    }
    if (id === REROLL_ITEM) uses.push('ใช้สุ่มสายเลือดใหม่ในแท็บสายเลือด');
    if (!uses.length) uses.push('ยังไม่มีสูตรที่ใช้ เก็บไว้ขายแลกทองได้');
  }
  const shop = SHOP_STOCK.find((s) => s.itemId === id);
  const each = sellPrice({ id, lvl: 0 });
  const owned = state ? countOwned(state, id) : null;
  return {
    id, name: def.name, rarity: def.rarity, rarityName: rar.name,
    kind: def.category === 'weapon' ? getWeaponType(def.wtype).name : CATEGORY_NAME[def.category],
    desc: def.desc || '', uses, stats,
    sell: each > 0 ? { each, grows: isEquipment(def) } : null,
    buy: shop ? shop.price : null, owned,
  };
}

function countOwned(state, id) {
  let n = 0;
  for (const s of state.inventory?.slots || []) if (s && s.id === id) n += s.qty || 1;
  for (const e of Object.values(state.equipment || {})) if (e && e.id === id) n += 1;
  return n;
}

function card(info, extra) {
  const statRows = info.stats ? STAT_ORDER.filter((k) => info.stats[k]).map((k) => h('div', { class: 'tip-stat' }, h('span', { class: 'muted' }, statName(k)), h('b', { class: 'num' }, fmtStat(k, info.stats[k], { sign: true })))) : [];
  return h('div', { class: `tip-card r-${info.rarity}`, 'data-tip-for': info.id },
    h('div', { class: 'tip-head' }, h('div', { class: 'tip-art' }, itemImg(info.id)),
      h('div', {}, h('b', { class: 'rc-text' }, info.name), h('small', { class: 'muted' }, `${info.kind} · ${info.rarityName}`))),
    info.desc ? h('p', { class: 'tip-desc' }, info.desc) : null,
    statRows.length ? h('div', { class: 'tip-stats' }, statRows) : null,
    h('div', { class: 'tip-sec' }, h('span', { class: 'eyebrow' }, 'ใช้ทำอะไร'), h('ul', {}, info.uses.map((u) => h('li', {}, u)))),
    h('div', { class: 'tip-money' },
      h('div', { 'data-tip-sell': info.sell ? String(info.sell.each) : '0' }, h('span', { class: 'muted' }, 'ขายให้พ่อค้า'),
        info.sell ? h('b', {}, itemImg('gold'), `${fmt(info.sell.each)}${info.sell.grows ? ` (ตีบวกแล้วราคาขึ้น คืนทอง ${Math.round(BALANCE.economy.sellRefundRate * 100)}% ของค่าตี)` : ' ต่อชิ้น'}`) : h('b', { class: 'off' }, 'ขายไม่ได้')),
      info.buy ? h('div', {}, h('span', { class: 'muted' }, 'ร้านขาย'), h('b', {}, itemImg('gold'), fmt(info.buy))) : null,
      extra?.chance != null ? h('div', {}, h('span', { class: 'muted' }, 'โอกาสดรอปต่อตัว'), h('b', {}, pct(extra.chance, extra.chance < 0.1 ? 1 : 0))) : null,
      info.owned != null ? h('div', {}, h('span', { class: 'muted' }, 'มีอยู่'), h('b', {}, `${info.owned} ชิ้น`)) : null));
}

// ------------------------------------------------------------------ the floating card
let tipEl = null, anchor = null, pinned = false, getState = () => null, lastTouch = 0;
// after a finger touches the screen, browsers may also report a "mouse" there: that is not a hover
const realHover = (e) => e.pointerType === 'mouse' && Date.now() - lastTouch > 1000 && !(globalThis.matchMedia?.('(hover: none)').matches);
if (typeof document !== 'undefined') document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') lastTouch = Date.now(); }, true);

export function setTipState(fn) { getState = fn; }

function ensureEl() {
  if (tipEl) return tipEl;
  tipEl = h('div', { class: 'item-tip', role: 'tooltip', id: 'item-tip', hidden: true });
  document.body.append(tipEl);
  // a tap anywhere else closes a pinned card
  document.addEventListener('pointerdown', (e) => { if (!tipEl.hidden && !tipEl.contains(e.target) && !(anchor && anchor.contains(e.target))) hideTip(true); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tipEl.hidden) hideTip(true); });
  // the card follows its item while lists scroll; it closes once the item leaves the screen or is removed
  const follow = () => {
    if (tipEl.hidden || !anchor) return;
    const r = anchor.getBoundingClientRect();
    if (!anchor.isConnected || r.bottom < 0 || r.top > innerHeight || r.width === 0) hideTip(true); else place(anchor);
  };
  addEventListener('resize', follow);
  document.addEventListener('scroll', follow, true);
  return tipEl;
}

function place(target) {
  const r = target.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight, m = 8;
  tipEl.style.left = '0px'; tipEl.style.top = '0px';
  const w = tipEl.offsetWidth, ht = tipEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(m, Math.min(vw - w - m, x));
  let y = r.top - ht - 10;
  let below = false;
  if (y < m) { y = r.bottom + 10; below = true; }
  if (y + ht > vh - m) y = Math.max(m, vh - ht - m);
  tipEl.style.left = `${Math.round(x)}px`; tipEl.style.top = `${Math.round(y)}px`;
  tipEl.classList.toggle('below', below);
}

export function showTip(target, id, extra, pin = false) {
  const info = itemInfo(id, getState());
  if (!info) return;
  ensureEl();
  if (anchor && anchor !== target) anchor.removeAttribute('aria-describedby');
  anchor = target; pinned = pin;
  tipEl.replaceChildren(card(info, extra));
  tipEl.hidden = false;
  tipEl.classList.remove('show');
  place(target);
  requestAnimationFrame(() => tipEl?.classList.add('show'));
  target.setAttribute('aria-describedby', 'item-tip');
}

export function hideTip(force = false) {
  if (!tipEl || tipEl.hidden || (pinned && !force)) return;
  tipEl.hidden = true; tipEl.classList.remove('show');
  anchor?.removeAttribute('aria-describedby');
  anchor = null; pinned = false;
}

export const tipVisibleFor = () => (tipEl && !tipEl.hidden ? tipEl.firstChild?.dataset.tipFor || null : null);

// Wrap an item icon (or anything) so it explains itself. extra: { chance }
export function tipTarget(el, id, extra = null) {
  el.classList.add('tip-target');
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
  el.dataset.tipItem = id;
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', `${getItem(id)?.name || id} — กดค้างเพื่อดูรายละเอียด`);
  let timer = 0, sx = 0, sy = 0, held = false, holding = false;
  const clear = () => { clearTimeout(timer); timer = 0; holding = false; };
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    sx = e.clientX; sy = e.clientY; held = false;
    clear();
    holding = true;
    timer = setTimeout(() => { timer = 0; holding = false; held = true; navigator.vibrate?.(12); showTip(el, id, extra, true); }, HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => { if (holding && Math.hypot(e.clientX - sx, e.clientY - sy) > MOVE_CANCEL) clear(); });
  el.addEventListener('pointerup', () => {
    // a short tap also opens it (and a second tap closes it)
    if (holding && !held) { clear(); if (anchor === el && !tipEl.hidden && pinned) hideTip(true); else showTip(el, id, extra, true); }
    clear();
  });
  el.addEventListener('pointercancel', clear);
  el.addEventListener('pointerenter', (e) => { if (realHover(e)) { clear(); timer = setTimeout(() => { timer = 0; showTip(el, id, extra, false); }, HOVER_MS); } });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { clear(); if (anchor === el) hideTip(false); } });
  el.addEventListener('contextmenu', (e) => e.preventDefault());       // no "save image" sheet on long press
  el.addEventListener('focus', () => { if (el.matches(':focus-visible')) showTip(el, id, extra, false); });   // keyboard only; touch waits for the hold
  el.addEventListener('blur', () => { if (anchor === el) hideTip(true); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (anchor === el && !tipEl?.hidden && pinned) hideTip(true); else showTip(el, id, extra, true); } });
  return el;
}
