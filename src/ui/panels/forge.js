// Forge: pick a piece of equipment, see the exact cost and odds, strike.
import { h, glyph, itemImg, rarityClass, fmt, pct } from '../dom.js';
import { getItem, EQUIP_SLOTS, isEquipment } from '../../data/items.js';
import { BALANCE } from '../../config/balance.js';
import { previewUpgrade, attemptUpgrade } from '../../systems/upgrade.js';
import { countItem } from '../../systems/inventory.js';
import { findInstance } from '../../systems/equipment.js';
import { statLines, itemArt } from '../itemCard.js';
import { itemName, reasonText } from '../format.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createForgePanel(app) {
  let selected = null;
  let lastResult = null; // { uid, success, level }

  function allEquipment(st) {
    const list = [];
    for (const s of EQUIP_SLOTS) if (st.equipment[s]) list.push({ inst: st.equipment[s], equipped: true });
    for (const it of st.inventory.slots) if (isEquipment(getItem(it.id))) list.push({ inst: it, equipped: false });
    return list;
  }

  async function strike(stage, uid) {
    return app.store.exclusive('forge', async () => {
      const st = app.store.get();
      const pre = previewUpgrade(st, uid);
      if (!pre.ok || pre.missing.length) { app.toast(reasonText(pre.ok ? 'missing_resources' : pre.reason), 'warn'); app.audio.play('error'); return { ok: false }; }
      // Roll and commit first (atomic), then play the reveal. Reloading mid-animation cannot duplicate or lose the result.
      const r = attemptUpgrade(st, uid, app.rng);
      if (!r.ok) { app.toast(reasonText(r.reason), 'warn'); app.audio.play('error'); return r; }
      app.store.commit(r.state, { reason: 'upgrade', silent: true });
      app.setUiBusy(true);
      stage.classList.add('striking');
      const res = stage.querySelector('.result');
      res.className = 'result'; res.textContent = '';
      for (let i = 0; i < 3; i++) { app.audio.play('forge'); sparks(stage); await wait(330); }
      stage.classList.remove('striking');
      const def = getItem(r.state ? findInstance(r.state, uid).instance.id : '');
      lastResult = { uid, success: r.success, level: r.success ? r.cost.toLevel : r.dropped ? r.cost.fromLevel - 1 : r.cost.fromLevel };
      if (r.success) {
        app.audio.play('success');
        app.toast(`${def.name} +${r.cost.toLevel} สำเร็จ`, 'ok');
        for (let i = 0; i < 2; i++) sparks(stage, 18);
      } else {
        app.audio.play('fail');
        app.toast(r.dropped ? `ตีบวกล้มเหลว ${def.name} ตกระดับเป็น +${r.cost.fromLevel - 1}` : `ตีบวกล้มเหลว ${def.name} ยังคงเป็น +${r.cost.fromLevel}`, 'warn');
      }
      app.setUiBusy(false);
      if (findInstance(app.store.get(), uid)?.where === 'equipped') app.refreshHeroSprites();
      return r;
    });
  }

  function sparks(stage, n = 10) {
    const rect = stage.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const s = h('i', { class: 'spark' });
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
      s.style.left = `${rect.width / 2}px`; s.style.top = `${rect.height * 0.42}px`;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d - 20}px`);
      stage.append(s); setTimeout(() => s.remove(), 650);
    }
  }

  return {
    id: 'forge', title: 'โรงตีเหล็ก', short: 'ตีเหล็ก', icon: 'hammer',
    open(params) { if (params?.uid) { selected = params.uid; lastResult = null; } },
    render(body) {
      if (app.store.isLocked('forge')) return; // never redraw mid-animation
      const st = app.store.get();
      const list = allEquipment(st);
      if (!selected || !findInstance(st, selected)) selected = list[0]?.inst.uid ?? null;
      if (!selected) { body.replaceChildren(h('div', { class: 'chief-link' }, h('b', {}, 'หัวหน้าหมู่บ้าน'), h('button', { class: 'btn', type: 'button', 'data-action': 'open-craft', onclick: () => app.openCrafting() }, glyph('anvil'), 'คุยกับหัวหน้า'))); return; }

      const picker = h('div', { class: 'forge-pick', role: 'listbox', 'aria-label': 'เลือกอุปกรณ์' }, list.map(({ inst, equipped }) => {
        const def = getItem(inst.id);
        return h('button', { class: `cell ${rarityClass(def.rarity)} ${inst.uid === selected ? 'selected' : ''}`, type: 'button', role: 'option', 'aria-selected': String(inst.uid === selected), 'data-uid': inst.uid,
          'aria-label': `${def.name} +${inst.lvl}${equipped ? ' (สวมอยู่)' : ''}`,
          onclick: () => { selected = inst.uid; lastResult = null; app.audio.play('click'); app.rerender(); } },
          itemImg(inst.id), inst.lvl ? h('span', { class: 'lvl-tag' }, `+${inst.lvl}`) : null, equipped ? h('span', { class: 'eq', html: '' }, glyph('equip')) : null);
      }));

      if (!selected) { body.replaceChildren(h('div', { class: 'empty-note' }, 'ยังไม่มีอุปกรณ์ให้ตีบวก')); return; }
      const found = findInstance(st, selected);
      const inst = found.instance, def = getItem(inst.id);
      const pre = previewUpgrade(st, selected);

      const resultText = lastResult && lastResult.uid === selected
        ? h('div', { class: `result ${lastResult.success ? 'win' : 'lose'}` }, lastResult.success ? `สำเร็จ! +${lastResult.level}` : `ล้มเหลว · คงเดิม +${lastResult.level}`)
        : h('div', { class: 'result' });
      const stage = h('div', { class: `anvil-stage ${rarityClass(def.rarity)}`, 'data-forge-stage': '' },
        itemArt(inst),
        h('div', { class: 'rc-text', style: { fontWeight: 700 } }, def.name, ` +${inst.lvl}`, h('span', { class: 'muted', style: { fontWeight: 400 } }, ` / +${BALANCE.upgrade.maxLevel}`)),
        resultText);

      if (!pre.ok) {
        body.replaceChildren(picker, stage, h('div', { class: 'notice ok' }, pre.reason === 'max_level' ? `${def.name} ตีบวกถึง +${BALANCE.upgrade.maxLevel} แล้ว` : reasonText(pre.reason)));
        return;
      }
      const c = pre.cost;
      const costRows = [
        h('div', { class: 'cost' }, itemImg('gold'), h('span', {}, 'ทอง'),
          h('span', { class: `have num ${st.gold >= c.gold ? 'enough' : 'short'}` }, `${fmt(st.gold)} / ${fmt(c.gold)}`)),
        ...c.materials.map((m) => {
          const have = countItem(st, m.id);
          return h('div', { class: 'cost' }, itemImg(m.id), h('span', {}, itemName(m.id)), h('span', { class: `have num ${have >= m.qty ? 'enough' : 'short'}` }, `${have} / ${m.qty}`));
        }),
      ];
      const canStrike = pre.missing.length === 0;
      const btn = h('button', { class: 'btn primary', type: 'button', 'data-action': 'strike', disabled: !canStrike, 'aria-disabled': String(!canStrike) },
        glyph('hammer'), `ตีบวกเป็น +${c.toLevel}`);
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        await strike(stage, selected);
        app.rerender(); // after the lock is released, show the new state
      });

      body.replaceChildren(...[
        picker, stage,
        h('div', { class: 'eyebrow' }, `ค่าสถานะ +${c.fromLevel} → +${c.toLevel}`),
        statLines(pre.after, pre.before),
        h('div', { class: 'rate' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', { class: 'muted' }, 'โอกาสสำเร็จ'), h('b', { class: 'num', 'data-rate': c.successRate }, pct(c.successRate))),
          h('div', { class: 'track' }, h('i', { style: { width: pct(c.successRate) } })),
          c.downgrade ? h('small', { class: 'notice warn', 'data-downgrade': '' }, `+${BALANCE.upgrade.downgradeFrom} ขึ้นไป: ถ้าล้มเหลวอุปกรณ์จะตกลง 1 ระดับ (ไม่แตก) วัตถุดิบและทองจะถูกใช้ไป`)
            : c.successRate < 1 ? h('small', { class: 'faint' }, 'ถ้าล้มเหลว วัตถุดิบและทองจะถูกใช้ไป แต่ระดับอุปกรณ์จะไม่ลดลง') : null),
        h('div', { class: 'eyebrow' }, 'ค่าใช้จ่าย'),
        h('div', { class: 'costs' }, costRows),
        canStrike ? null : h('div', { class: 'notice' }, 'ยังขาด: ', pre.missing.map((m) => `${itemName(m.id)} ${m.need - m.have}`).join(', '), ' · หาได้จากการออกล่าหรือซื้อที่ร้านค้า'),
        btn,
        h('div', { class: 'chief-link' }, h('img', { alt: '', src: app.spriteUri('v_chief') }),
          h('div', {}, h('b', {}, 'หัวหน้าหมู่บ้าน'), h('small', { class: 'muted' }, 'แลกอุปกรณ์เป็นแบบแปลน แล้วตีอาวุธ ชุดเกราะ และปีกขึ้นใหม่')),
          h('button', { class: 'btn', type: 'button', 'data-action': 'open-craft', onclick: () => app.openCrafting() }, glyph('anvil'), 'คุยกับหัวหน้า'))].filter(Boolean));
    },
  };
}
