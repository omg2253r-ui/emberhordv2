// หัวหน้าหมู่บ้าน — the chief's forge. Two pages:
//   แบบแปลน: hand over a piece of gear, he draws its blueprint (the piece is used up)
//   ตีอาวุธ: every blueprint you know, its recipe (have / need), and the craft button
// The secret blueprint is shown only as a sealed scroll with a riddle until both relics are carried together.
import { h, glyph, itemImg, fmt, rarityClass, confirmButton, clear, lockMark } from './dom.js';
import { tipTarget } from './itemTip.js';
import { getItem, isEquipment, EQUIP_SLOTS } from '../data/items.js';
import { rarityOf, RARITIES } from '../data/rarity.js';
import { recipeFor, SECRET, CRAFTABLE } from '../data/crafting.js';
import { hasBlueprint, exchangeForBlueprint, craft, missingFor, learnSecret, secretReady } from '../systems/crafting.js';
import { countItem } from '../systems/inventory.js';
import { CATEGORY_NAME, reasonText } from './format.js';
import { uniqueBlock } from './itemCard.js';
import { getWeaponType } from '../data/weapons.js';

const REASONS = { equipped: 'ถอดชิ้นนี้ออกก่อนจึงจะแลกได้', known: 'มีแบบแปลนชิ้นนี้แล้ว', not_gear: 'แลกได้เฉพาะอาวุธ ชุดเกราะ เครื่องราง และปีก', no_blueprint: 'ยังไม่มีแบบแปลน', missing: 'วัตถุดิบหรือทองไม่พอ' };
const why = (r) => REASONS[r] || reasonText(r);
const byRarity = (a, b) => rarityOf(getItem(b).rarity).order - rarityOf(getItem(a).rarity).order || getItem(a).name.localeCompare(getItem(b).name, 'th');
const kindName = (def) => (def.category === 'weapon' ? getWeaponType(def.wtype).name : CATEGORY_NAME[def.category]);

export function openCrafting(app) {
  let tab = 'craft', close, filter = 'all';
  // the chief recognises the relics the moment both are in the bag
  let revealed = false;
  { const r = learnSecret(app.store.get()); if (r.ok) { app.store.commit(r.state, { reason: 'secret-blueprint' }); revealed = true; } }

  const body = h('div', { class: 'craft-body' });
  const tabs = h('div', { class: 'craft-tabs', role: 'tablist' },
    ['craft', 'exchange'].map((k) => h('button', { type: 'button', role: 'tab', class: 'btn sm', 'data-ctab': k, onclick: () => { tab = k; app.audio.play('click'); draw(); } },
      glyph(k === 'craft' ? 'anvil' : 'scroll'), k === 'craft' ? 'ตีอาวุธ' : 'แลกแบบแปลน')));
  const filters = h('div', { class: 'craft-filter' },
    [['all', 'ทั้งหมด'], ['weapon', 'อาวุธ'], ['armor', 'เกราะ'], ['charm', 'เครื่องราง'], ['wings', 'ปีก']].map(([k, t]) =>
      h('button', { type: 'button', class: 'chip-btn', 'data-cf': k, onclick: () => { filter = k; draw(); } }, t)));

  function costRow(st, rc) {
    const chip = (id, need, have) => {
      const ok = have >= need;
      const el = h('span', { class: `cost ${ok ? 'ok' : 'short'}` }, itemImg(id), h('span', { class: 'num' }, id === 'gold' || id === 'spark' ? fmt(need) : `${Math.min(have, need)}/${need}`));
      return id === 'gold' || id === 'spark' ? el : tipTarget(el, id);
    };
    return h('div', { class: 'craft-cost' }, chip('gold', rc.gold, st.gold), rc.sparks ? chip('spark', rc.sparks, st.sparks) : null, rc.mats.map((m) => chip(m.id, m.qty, countItem(st, m.id))));
  }

  function recipeCard(st, id) {
    const def = getItem(id), rc = recipeFor(id), miss = missingFor(st, id);
    const owned = countItem(st, id) + EQUIP_SLOTS.filter((k) => st.equipment[k]?.id === id).length;
    return h('article', { class: `craft-card ${rarityClass(def.rarity)} ${miss.length ? 'short' : 'ready'}`, 'data-recipe': id },
      h('div', { class: 'cc-top' },
        tipTarget(h('div', { class: 'art' }, itemImg(id)), id),
        h('div', { class: 'cc-name' }, h('b', { class: 'rc-text' }, def.name), h('small', { class: 'muted' }, `${kindName(def)} · ${rarityOf(def.rarity).name}${owned ? ` · มีอยู่ ${owned}` : ''}`))),
      def.unique ? uniqueBlock(def) : null,
      costRow(st, rc),
      h('button', { class: `btn ${miss.length ? '' : 'primary'}`, type: 'button', 'data-action': 'craft', disabled: miss.length > 0, onclick: () => doCraft(id) }, glyph('hammer'), miss.length ? 'วัตถุดิบยังไม่ครบ' : 'ตีชิ้นนี้'));
  }

  function secretCard(st) {
    return h('article', { class: 'craft-card secret', 'data-recipe': 'secret' },
      h('div', { class: 'cc-top' }, h('div', { class: 'art sealed' }, glyph('lock')),
        h('div', { class: 'cc-name' }, h('b', {}, 'แบบแปลนที่ถูกผนึก'), h('small', { class: 'muted' }, 'เทพตำนาน · ???'))),
      h('p', { class: 'riddle' }, SECRET.hint),
      h('div', { class: 'craft-cost' }, SECRET.needs.map((m) => tipTarget(h('span', { class: `cost ${countItem(st, m) ? 'ok' : 'short'}` }, itemImg(m), h('span', {}, countItem(st, m) ? 'มีแล้ว' : 'ยังไม่มี')), m))));
  }

  async function doCraft(id) {
    await app.store.exclusive('craft', async () => {
      const r = craft(app.store.get(), id);
      if (!r.ok) { app.toast(why(r.reason), 'warn'); app.audio.play('error'); return; }
      app.store.commit(r.state, { reason: 'craft' });
      app.audio.play('forge'); setTimeout(() => app.audio.play('success'), 280);
      const def = getItem(id);
      app.toast(`หัวหน้าตี ${def.name} เสร็จแล้ว`, 'ok');
      if (def.rarity === 'mythic' || def.rarity === 'legendary') app.hud?.banner?.(def.name, 'ถูกตีขึ้นจากเตาของหัวหน้าหมู่บ้าน');
      draw();
    });
  }
  async function doExchange(uid) {
    await app.store.exclusive('craft', async () => {
      const r = exchangeForBlueprint(app.store.get(), uid);
      if (!r.ok) { app.toast(why(r.reason), 'warn'); app.audio.play('error'); return; }
      app.store.commit(r.state, { reason: 'blueprint' });
      app.audio.play('success');
      app.toast(`ได้แบบแปลน ${getItem(r.id).name}`, 'ok');
      draw();
    });
  }

  function draw() {
    const st = app.store.get();
    for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.ctab === tab));
    for (const b of filters.children) b.classList.toggle('on', b.dataset.cf === filter);
    const keep = (id) => filter === 'all' || getItem(id).category === filter;
    clear(body);
    if (tab === 'craft') {
      const known = CRAFTABLE.filter((id) => hasBlueprint(st, id) && keep(id)).sort(byRarity);
      const total = CRAFTABLE.filter((id) => !getItem(id).secret).length;
      body.append(h('p', { class: 'muted craft-note' }, `แบบแปลนที่มี ${CRAFTABLE.filter((id) => hasBlueprint(st, id)).length} / ${total}${hasBlueprint(st, SECRET.id) ? ' + 1 แบบแปลนลับ' : ''} · นำอาวุธหรือชุดที่ได้มาแลกเป็นแบบแปลนได้ที่หน้า "แลกแบบแปลน"`));
      const grid = h('div', { class: 'craft-grid' });
      if (!hasBlueprint(st, SECRET.id) && (filter === 'all' || filter === 'weapon')) grid.append(secretCard(st));
      for (const id of known) grid.append(recipeCard(st, id));
      if (!known.length) grid.append(h('p', { class: 'empty-note muted' }, 'ยังไม่มีแบบแปลน ลองนำอาวุธที่ไม่ใช้แล้วมาแลกดูสิ'));
      body.append(grid);
    } else {
      const items = st.inventory.slots.filter((s) => isEquipment(getItem(s.id)) && keep(s.id)).sort((a, b) => byRarity(a.id, b.id));
      body.append(h('p', { class: 'muted craft-note' }, 'หัวหน้าจะรื้อชิ้นที่ให้เพื่อวาดแบบแปลน ชิ้นนั้นจะหายไป (ระดับตีบวกไม่ถูกเก็บไว้) ชิ้นที่สวมอยู่ต้องถอดก่อน'));
      const grid = h('div', { class: 'craft-grid' });
      for (const s of items) {
        const def = getItem(s.id), known = hasBlueprint(st, s.id);
        grid.append(h('article', { class: `craft-card ${rarityClass(def.rarity)} ${known ? 'known' : ''}`, 'data-exchange': s.uid },
          h('div', { class: 'cc-top' }, tipTarget(h('div', { class: 'art' }, itemImg(s.id), s.lvl ? h('span', { class: 'lvl-tag' }, `+${s.lvl}`) : null), s.id),
            h('div', { class: 'cc-name' }, h('b', { class: 'rc-text' }, def.name), h('small', { class: 'muted' }, `${kindName(def)} · ${rarityOf(def.rarity).name}`))),
          known ? h('span', { class: 'chip ok' }, glyph('check'), 'มีแบบแปลนแล้ว')
            : s.locked ? h('span', { class: 'chip', 'data-locked': '' }, lockMark(), 'ล็อก ★ ไว้ · ปลดล็อกในกระเป๋าก่อนจึงจะแลกได้')
            : confirmButton([glyph('scroll'), 'แลกเป็นแบบแปลน'], s.lvl ? `ยืนยัน (+${s.lvl} จะหายไป)` : 'กดอีกครั้งเพื่อยืนยัน', () => doExchange(s.uid), 'btn')));
      }
      if (!items.length) grid.append(h('p', { class: 'empty-note muted' }, 'ไม่มีอุปกรณ์ในกระเป๋าให้แลก'));
      body.append(grid);
    }
  }

  const content = h('div', { class: 'modal panel craft-modal', 'data-modal': 'craft' },
    h('div', { class: 'craft-head' },
      h('img', { alt: '', class: 'chief-face', src: app.spriteUri('v_chief') }),
      h('div', {}, h('small', { class: 'muted' }, 'โรงตีของหมู่บ้าน'), h('h2', {}, 'หัวหน้าหมู่บ้าน'),
        h('p', { class: 'chief-line' }, revealed ? '"หัวใจที่ยังเต้น กับดวงตาที่ยังมองเห็น... ในที่สุดก็มาอยู่ด้วยกัน ข้าวาดแบบแปลนนั้นให้เจ้าแล้ว"'
          : '"เอาของที่เจ้าได้มาให้ข้าดู ข้าจะวาดแบบแปลนไว้ แล้วตีขึ้นใหม่ให้กี่ชิ้นก็ได้ ขอแค่วัตถุดิบครบ"'))),
    tabs, filters, body,
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด')));
  draw();
  close = app.modal(content);
  if (revealed) { app.audio.play('levelup'); app.toast('ได้รับแบบแปลนลับ!', 'ok'); }
  return close;
}
