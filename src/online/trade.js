// Player-to-player trade rules. Pure functions, unit-tested without a network.
// An offer is what one side puts on the table: gold plus up to TRADE_SLOTS inventory stacks (equipped gear cannot
// be offered). Each side applies the trade to its own save when both have confirmed the SAME pair of offers.
import { BALANCE } from '../config/balance.js';
import { getItem, isEquipment } from '../data/items.js';
import { cloneState } from '../core/state.js';
import { addInPlace, removeSlotInPlace } from '../systems/inventory.js';

export const TRADE_SLOTS = 6;
export const TRADE_GOLD_MAX = 1_000_000;

const int = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo);

// picks: [{ uid, qty }] from MY inventory → the offer I publish.
export function makeOffer(state, picks, gold) {
  const items = [];
  const seen = new Set();
  for (const p of picks || []) {
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    const slot = state.inventory.slots.find((s) => s.uid === p.uid);
    if (!slot) return { ok: false, reason: 'not_found' };
    if (slot.locked) return { ok: false, reason: 'locked' };
    const qty = Number.isInteger(p.qty) ? p.qty : slot.qty;
    if (qty <= 0 || qty > slot.qty) return { ok: false, reason: 'bad_qty' };
    items.push({ u: slot.uid, id: slot.id, q: qty, l: slot.lvl || 0 });
  }
  if (items.length > TRADE_SLOTS) return { ok: false, reason: 'too_many' };
  const g = Number.isInteger(gold) ? gold : 0;
  if (g < 0 || g > Math.min(TRADE_GOLD_MAX, state.gold)) return { ok: false, reason: 'not_enough_gold' };
  return { ok: true, offer: { g, it: items } };
}

// Cleans an offer received from the other player. Unknown items make the whole offer invalid.
export function readOffer(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.it) || raw.it.length > TRADE_SLOTS) return null;
  const it = [];
  for (const x of raw.it) {
    const def = getItem(x?.id);
    if (!def) return null;
    const eq = isEquipment(def);
    it.push({ u: int(x.u, 0, 1e9), id: def.id, q: eq ? 1 : int(x.q, 1, BALANCE.inventory.maxStack), l: eq ? int(x.l, 0, BALANCE.upgrade.maxLevel) : 0 });
  }
  return { g: int(raw.g, 0, TRADE_GOLD_MAX), it };
}

export const emptyOffer = () => ({ g: 0, it: [] });

// Same text on both sides for the same pair of offers: the inviter's offer first.
export function tradeKey(tid, hostOffer, guestOffer) {
  const o = (x) => `${x.g}:${x.it.map((i) => `${i.u}.${i.id}.${i.q}.${i.l}`).join(',')}`;
  return `${tid}|${o(hostOffer)}|${o(guestOffer)}`;
}

// Gives my offer and receives theirs in one transaction. Fails without touching the save if anything is missing
// or my bag cannot hold what I receive.
export function applyTrade(state, give, receive) {
  const next = cloneState(state);
  if (give.g > next.gold) return { ok: false, reason: 'not_enough_gold' };
  for (const i of give.it) {
    const slot = next.inventory.slots.find((s) => s.uid === i.u);
    if (!slot || slot.id !== i.id || slot.qty < i.q) return { ok: false, reason: 'item_changed' };
    if (slot.locked) return { ok: false, reason: 'locked' };
    const r = removeSlotInPlace(next, i.u, i.q);
    if (!r.ok) return { ok: false, reason: 'item_changed' };
  }
  next.gold -= give.g;
  for (const i of receive.it) {
    const r = addInPlace(next, i.id, i.q, i.l);
    if (!r.ok) return { ok: false, reason: r.reason === 'inventory_full' ? 'inventory_full' : 'bad_item' };
  }
  next.gold = Math.min(999_999_999_999, next.gold + receive.g);
  return { ok: true, state: next };
}

// Would this trade go through for me right now? (checked before I may confirm)
export function checkTrade(state, give, receive) {
  const r = applyTrade(state, give, receive);
  return r.ok ? { ok: true } : r;
}
