// Detail card for one item instance, with stat comparison against what is equipped.
import { h, itemImg, rarityClass, glyph, ultImg } from './dom.js';
import { ultOf, ultNeed } from '../systems/ultimate.js';
import { getUlt, ULT_TIERS } from '../data/ultimates.js';
import { getItem, isEquipment } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';
import { itemStats } from '../systems/stats.js';
import { STAT_ORDER, fmtStat, statName, CATEGORY_NAME } from './format.js';
import { getWeaponType } from '../data/weapons.js';
import { UNIQUES } from '../battle/uniques.js';

// A unique weapon's passive and signature skill (both halved in PvP).
export function uniqueBlock(def) {
  const u = def && UNIQUES[def.unique];
  if (!u) return null;
  return h('div', { class: 'unique-block', style: { '--u1': u.color, '--u2': u.color2 } },
    h('div', { class: 'ub-row' }, h('span', { class: 'ub-k' }, 'พาสซีฟเฉพาะ'), h('b', {}, u.name)), h('p', {}, u.passive),
    h('div', { class: 'ub-row' }, h('span', { class: 'ub-k' }, 'สกิลเฉพาะ'), h('b', {}, u.skill)), h('p', {}, u.skillText),
    h('small', { class: 'faint' }, 'ใน PvP พลังพิเศษทั้งหมดเหลือครึ่งหนึ่ง'));
}

// v8: the ultimate this very weapon carries (decided when it was found)
export function ultBlock(state, inst) {
  const id = ultOf(state, inst);
  if (!id) return h('div', { class: 'ult-block none', 'data-ult': '' }, h('span', { class: 'muted small' }, 'อาวุธชิ้นนี้ไม่มีท่าไม้ตาย (ยิ่งหายาก ยิ่งมีโอกาสได้)'));
  const u = getUlt(id), tr = ULT_TIERS[u.tier], secret = !!tr.secret;
  return h('div', { class: 'ult-block', 'data-ult': id, style: { '--ut': tr.color } },
    ultImg(id, 'ult-img', secret),
    h('div', { class: 'ub-text' },
      h('div', { class: 'ub-row' }, h('span', { class: 'ub-k' }, 'ท่าไม้ตาย'), h('b', {}, secret ? '???' : u.name), h('span', { class: 'ut-tag' }, `ระดับ ${tr.name}`)),
      h('p', {}, secret ? 'ไม่มีใครรู้ว่าท่านี้คืออะไร ลองปลดปล่อยดูเอง' : u.desc),
      h('small', { class: 'faint' }, `สะสม ${ultNeed(id)} แต้มในการล่า · ${ultNeed(id, true)} แต้มใน PvP · ปุ่ม G`)));
}

// How a weapon type plays: combo chain, charged move and dodge attack.
export function movesetBlock(wtype) {
  const t = getWeaponType(wtype);
  return h('div', { class: 'moveset', 'data-wtype': t.id },
    h('div', { class: 'ms-head' }, glyph(t.icon), h('b', {}, t.name), h('span', { class: 'muted' }, t.desc)),
    h('div', { class: 'ms-row' }, h('span', { class: 'ms-k' }, 'กดรัว'), h('span', { class: 'ms-chain' }, t.combo.map((m, i) => h('span', { class: `ms-step ${i === t.combo.length - 1 ? 'fin' : ''}` }, m.name)))),
    h('div', { class: 'ms-row' }, h('span', { class: 'ms-k' }, 'กดค้าง'), h('span', {}, t.charged.name)),
    h('div', { class: 'ms-row' }, h('span', { class: 'ms-k' }, 'หลบ+โจมตี'), h('span', {}, t.dash.name)),
    t.armor ? h('small', { class: 'faint' }, 'ไม่กระเด็นและไม่ถูกขัดจังหวะระหว่างเหวี่ยง') : null,
    t.cancelFrom === 'any' ? h('small', { class: 'faint' }, 'หลบยกเลิกท่าได้ทุกจังหวะ') : null);
}

export function itemArt(inst, size = '') {
  const def = getItem(inst.id);
  return h('div', { class: `art ${size}` }, itemImg(inst.id), inst.lvl > 0 ? h('span', { class: 'lvl-tag' }, `+${inst.lvl}`) : null);
}

export function statLines(stats, compareTo = null) {
  const keys = STAT_ORDER.filter((k) => stats[k] != null || (compareTo && compareTo[k] != null));
  return h('div', { class: 'statlines' }, keys.map((k) => {
    const v = stats[k] || 0;
    let delta = null;
    if (compareTo) {
      const d = v - (compareTo[k] || 0);
      if (Math.abs(d) > 1e-6) delta = h('span', { class: `delta ${d > 0 ? 'up' : 'down'}` }, ` (${fmtStat(k, d, { sign: true })})`);
    }
    return h('div', { class: 'statline' }, h('span', { class: 'muted' }, statName(k)), h('span', { class: 'num' }, fmtStat(k, v, { sign: true }), delta));
  }));
}

export function itemCard(state, inst, { equipped = false, actions = [] } = {}) {
  const def = getItem(inst.id);
  const rar = rarityOf(def.rarity);
  let body;
  if (isEquipment(def)) {
    const cur = state.equipment[def.category];
    const compare = !equipped && cur ? itemStats(cur) : null;
    body = [
      statLines(itemStats(inst), compare),
      compare ? h('small', { class: 'faint' }, `ตัวเลขในวงเล็บ เทียบกับ ${getItem(cur.id).name}${cur.lvl ? ' +' + cur.lvl : ''} ที่สวมอยู่`) : null,
      uniqueBlock(def),
      def.category === 'weapon' ? ultBlock(state, inst) : null,
      def.category === 'weapon' ? movesetBlock(def.wtype) : null,
    ];
  } else {
    body = [h('div', { class: 'muted' }, `มีอยู่ ${inst.qty} ชิ้น`)];
  }
  return h('div', { class: `detail ${rarityClass(def.rarity)}` },
    h('div', { class: 'detail-top' }, itemArt(inst),
      h('div', {},
        h('h3', { class: 'rc-text' }, def.name, inst.lvl ? ` +${inst.lvl}` : ''),
        h('div', { class: 'muted', style: { fontSize: 'var(--step--1)' } }, `${def.category === 'weapon' ? getWeaponType(def.wtype).name : CATEGORY_NAME[def.category]} · ${rar.name}${equipped ? ' · สวมอยู่' : ''}`))),
    h('div', { style: { fontSize: 'var(--step--1)' } }, def.desc),
    body,
    actions.length ? h('div', { class: 'actions' }, actions) : null);
}
