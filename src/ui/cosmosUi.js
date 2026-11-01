// จักรวาลอาร์ติแฟกต์ — the Cosmic Tree. A star at the top, roots branching down into slots; each slot glows in the
// colour of its affinity and a matching artifact is half again as strong. Tap a slot, then an artifact to set it.
import { h, glyph, artifactImg, clear } from './dom.js';
import { ARTIFACTS, getArtifact, TREE, getSlot, KIND_INFO, AFFINITY_BONUS, ART_LEVEL_MAX } from '../data/artifacts.js';
import { rarityOf } from '../data/rarity.js';
import { slotUnlocked, slotFilled, slotMatches, artifactEffect, artifactBonuses, placeArtifact, removeArtifact } from '../systems/artifacts.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const pctTxt = (v) => `${(Math.round(v * 1000) / 10).toString()}%`;
export function fxText(k, v) {
  switch (k) {
    case 'atkPct': return `พลังโจมตี +${pctTxt(v)}`;
    case 'defPct': return `ป้องกัน +${pctTxt(v)}`;
    case 'hpPct': return `พลังชีวิต +${pctTxt(v)}`;
    case 'defFlat': return `เกราะ +${Math.round(v)}`;
    case 'crit': return `โอกาสคริติคอล +${pctTxt(v)}`;
    case 'critMult': return `แรงคริติคอล +${pctTxt(v)}`;
    case 'spd': return `ความเร็ว +${pctTxt(v)}`;
    case 'shieldPct': return `โล่ต้นห้อง ${pctTxt(v)} ของพลังชีวิต`;
    case 'debuff': return `โอกาสทำลายเกราะศัตรู ${pctTxt(v)}`;
    case 'guard': return `การ์ดสึกช้าลง ${pctTxt(v)}`;
    case 'counter': return `เคาน์เตอร์แรงขึ้น ${pctTxt(v)}`;
    case 'healOnKill': return `ฆ่าแล้วฟื้น ${pctTxt(v)} ของพลังชีวิต`;
    default: return `${k} +${v}`;
  }
}
const el = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

export function openCosmos(app) {
  let close, sel = 'core';
  const tree = h('div', { class: 'cosmos-tree' });
  const side = h('div', { class: 'cosmos-side' });
  const totals = h('div', { class: 'cosmos-totals' });

  function rootPath(a, b) {
    // a root bends like a real one: down first, then out
    const my = a.y + (b.y - a.y) * 0.55;
    return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${a.y + (b.y - a.y) * 0.35} ${b.x} ${b.y}`;
  }

  function drawTree(st) {
    const svg = el('svg', { viewBox: '0 0 400 420', class: 'cosmos-svg', role: 'img', 'aria-label': 'ต้นไม้จักรวาล' });
    const defs = el('defs');
    defs.innerHTML = `<radialGradient id="cz-core" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8e0"/><stop offset="0.35" stop-color="#ffd08a" stop-opacity="0.9"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
      <filter id="cz-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`;
    svg.append(defs);
    // roots (drawn first): dim when the child is empty, lit in the slot colour when filled
    for (const s of TREE) {
      if (!s.parent) continue;
      const p = getSlot(s.parent), lit = slotFilled(st, s.id) && slotFilled(st, p.id);
      const col = KIND_INFO[s.aff].color;
      svg.append(el('path', { d: rootPath(p, s), fill: 'none', stroke: '#0a0712', 'stroke-width': 9, 'stroke-linecap': 'round' }));
      svg.append(el('path', { d: rootPath(p, s), fill: 'none', stroke: lit ? col : 'rgba(200,190,255,0.22)', 'stroke-width': lit ? 4 : 3, 'stroke-linecap': 'round', class: lit ? 'root lit' : 'root' }));
      if (lit) svg.append(el('path', { d: rootPath(p, s), fill: 'none', stroke: col, 'stroke-width': 8, opacity: 0.35, filter: 'url(#cz-glow)' }));
    }
    // the star at the top of the tree
    svg.append(el('circle', { cx: 200, cy: 72, r: 58, fill: 'url(#cz-core)', class: 'core-glow' }));
    for (const s of TREE) {
      const open = slotUnlocked(st, s.id), id = st.artifacts.slots[s.id], art = getArtifact(id);
      const col = KIND_INFO[s.aff].color, r = s.id === 'core' ? 30 : s.parent === 'core' ? 24 : 20;
      const g = el('g', { class: `slot ${open ? 'open' : 'locked'} ${sel === s.id ? 'sel' : ''} ${art ? 'filled' : ''}`, 'data-slot': s.id, tabindex: 0, role: 'button', 'aria-label': `ช่อง ${KIND_INFO[s.aff].name}${art ? ` ใส่ ${art.name}` : ''}${open ? '' : ' (ล็อก)'}` });
      g.append(el('circle', { cx: s.x, cy: s.y, r: r + 6, fill: 'none', stroke: col, 'stroke-width': sel === s.id ? 3 : 1.5, opacity: open ? 0.9 : 0.25, class: 'halo' }));
      g.append(el('circle', { cx: s.x, cy: s.y, r, fill: open ? 'rgba(14,10,28,0.92)' : 'rgba(10,8,16,0.85)', stroke: art ? rarityOf(art.rarity).color : col, 'stroke-width': 2.4, opacity: open ? 1 : 0.55 }));
      if (art) {
        const img = el('image', { x: s.x - r * 0.86, y: s.y - r * 0.86, width: r * 1.72, height: r * 1.72 });
        img.setAttribute('href', artifactImg(id).src);
        g.append(img);
        const lv = st.artifacts.owned[id]?.lvl || 1;
        if (lv > 1) { const t = el('text', { x: s.x + r * 0.72, y: s.y + r * 0.95, class: 'slot-lv' }); t.textContent = lv; g.append(t); }
      } else if (!open) {
        const t = el('text', { x: s.x, y: s.y + 4, class: 'slot-lock' }); t.textContent = `Lv${getSlot(s.id).level}`; g.append(t);
      } else {
        g.append(el('path', { d: `M${s.x - 6} ${s.y} L${s.x + 6} ${s.y} M${s.x} ${s.y - 6} L${s.x} ${s.y + 6}`, stroke: col, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.8 }));
      }
      const pick = () => { sel = s.id; app.audio.play('click'); draw(); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      svg.append(g);
    }
    clear(tree).append(h('div', { class: 'stars' }), svg);
  }

  function drawSide(st) {
    const slot = getSlot(sel), open = slotUnlocked(st, sel), curId = st.artifacts.slots[sel], cur = getArtifact(curId);
    const kind = KIND_INFO[slot.aff];
    const parentName = slot.parent ? KIND_INFO[getSlot(slot.parent).aff].name : '';
    const head = h('div', { class: 'cs-head', style: { '--kc': kind.color } },
      h('span', { class: 'cs-dot' }), h('div', {}, h('b', {}, slot.id === 'core' ? 'ดาวแกนกลาง' : slot.parent === 'core' ? `รากหลัก · ${kind.name}` : `ปลายราก · ${kind.name}`),
        h('small', { class: 'muted' }, slot.aff === 'any' ? 'ใส่ได้ทุกชนิด' : `อาร์ติแฟกต์สาย${kind.name}แรงขึ้น +${Math.round(AFFINITY_BONUS * 100)}% ในช่องนี้`)));
    const lockNote = open ? null : h('div', { class: 'notice' }, glyph('lock'), st.player.level < slot.level ? `ปลดล็อกที่เลเวล ${slot.level}` : `ใส่อาร์ติแฟกต์ในช่องราก "${parentName}" ก่อน`);
    const curBlock = cur ? h('div', { class: `cs-cur r-${cur.rarity}` }, artifactImg(curId),
      h('div', {}, h('b', { class: 'rc-text' }, cur.name), h('small', { class: 'muted' }, `${rarityOf(cur.rarity).name} · ระดับ ${st.artifacts.owned[curId]?.lvl || 1}/${ART_LEVEL_MAX}`),
        h('ul', { class: 'fx-list' }, Object.entries(artifactEffect(cur, st.artifacts.owned[curId]?.lvl || 1, slot)).map(([k, v]) => h('li', {}, fxText(k, v))))),
      h('button', { class: 'btn sm', type: 'button', 'data-action': 'art-remove', onclick: () => commit(removeArtifact(st, sel), 'ถอดอาร์ติแฟกต์แล้ว') }, 'ถอด')) : null;
    const owned = Object.keys(st.artifacts.owned).map(getArtifact).filter(Boolean)
      .sort((a, b) => rarityOf(b.rarity).order - rarityOf(a.rarity).order || a.name.localeCompare(b.name, 'th'));
    const where = (id) => Object.entries(st.artifacts.slots).find(([, v]) => v === id)?.[0];
    const list = owned.length ? h('div', { class: 'cs-list' }, owned.map((a) => {
      const lv = st.artifacts.owned[a.id].lvl, match = slotMatches(slot, a), at = where(a.id);
      return h('button', { class: `cs-item r-${a.rarity} ${match ? 'match' : ''} ${at === sel ? 'here' : ''}`, type: 'button', 'data-art': a.id, disabled: !open || at === sel,
        onclick: () => commit(placeArtifact(st, sel, a.id), `ใส่ ${a.name} แล้ว`) },
        artifactImg(a.id),
        h('span', { class: 'ci-text' }, h('b', { class: 'rc-text' }, a.name, lv > 1 ? ` ★${lv}` : ''),
          h('small', {}, Object.entries(artifactEffect(a, lv, slot)).map(([k, v]) => fxText(k, v)).join(' · ')),
          at && at !== sel ? h('small', { class: 'muted' }, 'ใส่อยู่ช่องอื่น (จะย้ายมา)') : null),
        match ? h('span', { class: 'chip ok' }, `+${Math.round(AFFINITY_BONUS * 100)}%`) : null);
    })) : h('div', { class: 'empty-note' }, 'ยังไม่มีอาร์ติแฟกต์ ได้จากรอยแยกไร้สิ้นสุดเท่านั้น');
    clear(side).append(head, lockNote || '', curBlock || '', h('div', { class: 'eyebrow' }, `อาร์ติแฟกต์ที่มี (${owned.length}/${Object.keys(ARTIFACTS).length})`), list);
  }

  function drawTotals(st) {
    const b = artifactBonuses(st);
    const rows = Object.entries(b).filter(([, v]) => v > 0);
    clear(totals).append(h('div', { class: 'eyebrow' }, 'พลังรวมจากต้นไม้จักรวาล'),
      rows.length ? h('div', { class: 'ct-grid' }, rows.map(([k, v]) => h('span', {}, fxText(k, v)))) : h('small', { class: 'muted' }, 'ยังไม่มีพลังจากอาร์ติแฟกต์'));
  }

  function commit(r, msg) {
    if (!r.ok) { app.toast(r.reason === 'locked' ? 'ช่องนี้ยังล็อกอยู่' : 'ทำรายการไม่สำเร็จ', 'warn'); app.audio.play('error'); return; }
    app.store.commit(r.state, { reason: 'artifact' });
    app.audio.play('unlock'); app.toast(msg, 'ok');
    app.refreshHeroSprites?.();
    draw();
  }

  function draw() { const st = app.store.get(); drawTree(st); drawSide(st); drawTotals(st); }

  const content = h('div', { class: 'modal panel cosmos-modal', 'data-modal': 'cosmos' },
    h('div', { class: 'cosmos-head' }, h('h2', {}, glyph('cosmos'), 'จักรวาลอาร์ติแฟกต์'),
      h('p', { class: 'muted' }, 'รากของดาวแตกแขนงลงสู่ช่องต่างๆ ช่องรากหลักเปิดที่เลเวล 8 ปลายรากเปิดที่เลเวล 16 และ 20 และต้องใส่ช่องที่อยู่เหนือกว่าก่อน ได้ซ้ำจะเพิ่มระดับ (สูงสุด 5)')),
    h('div', { class: 'cosmos-body' }, tree, side),
    totals,
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด')));
  draw();
  close = app.modal(content);
  return close;
}
