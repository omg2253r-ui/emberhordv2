// Skill panel (v8, 100 skills): the three battle slots on top, then filters (kind, "can learn now", search), a grid
// of skill tiles (picture, name, rank) and one detail card for the chosen skill with everything about it: what it
// does now and at the next rank, its cooldown, how to unlock it (with progress), learn and slot buttons.
import { h, confirmButton, skillImg, glyph, ultImg } from '../dom.js';
import { equippedUlt } from '../../systems/ultimate.js';
import { getUlt, ULT_TIERS } from '../../data/ultimates.js';
import { SKILLS, SKILL_SLOTS, SKILL_RESET_COST, SKILL_CATS, rankValues } from '../../data/skills.js';
import { skillPoints, isUnlocked, unlockText, unlockProgress, rankOf, learn, equipSkill, unequipSkill, resetSkills } from '../../systems/skills.js';
import { reasonText } from '../format.js';
import { rarityOf } from '../../data/rarity.js';
import { EL } from '../../battle/skillVfx.js';

const REASONS = { skill_locked: 'ยังไม่ปลดล็อก', skill_max: 'ระดับสูงสุดแล้ว', no_points: 'แต้มสกิลไม่พอ', nothing_to_reset: 'ยังไม่ได้เรียนสกิลใด' };
const EL_NAME = { fire: 'ไฟ', ice: 'น้ำแข็ง', volt: 'สายฟ้า', wind: 'ลม', earth: 'ดิน', shadow: 'เงา', holy: 'แสง', poison: 'พิษ', blood: 'โลหิต', void: 'ความว่าง', nature: 'พฤกษา', water: 'น้ำ', star: 'ดารา', arcane: 'เวท', steel: 'เหล็ก' };
const CAT_NAME = Object.fromEntries(SKILL_CATS.map((c) => [c.id, c.name]));
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export function createSkillsPanel(app) {
  // what the player is looking at survives re-renders (learning a rank re-renders the panel)
  const view = { cat: 'all', open: false, q: '', sel: null };

  function act(r, msg, sound = 'tab') {
    if (!r.ok) { app.toast(REASONS[r.reason] || reasonText(r.reason), 'warn'); app.audio.play('error'); return; }
    app.store.commit(r.state, { reason: 'skills' });
    if (msg) app.toast(msg, 'ok');
    app.audio.play(sound);
  }

  function pips(rank, max) { return h('span', { class: 'pips', 'aria-label': `ระดับ ${rank}/${max}` }, Array.from({ length: max }, (_, i) => h('i', { class: i < rank ? 'on' : '' }))); }

  function tile(st, s) {
    const rank = rankOf(st, s.id), open = isUnlocked(st, s.id), rar = rarityOf(s.rarity);
    const slot = st.skills.slots.indexOf(s.id);
    return h('button', {
      class: `skill-card skill-tile r-${rar.id} ${open ? '' : 'locked'} ${rank > 0 ? 'learned' : ''} ${rank >= s.maxRank ? 'maxed' : ''} ${view.sel === s.id ? 'sel' : ''}`,
      type: 'button', 'data-skill': s.id, 'data-rarity': rar.id, 'aria-pressed': String(view.sel === s.id), title: s.name,
      onclick: () => { view.sel = s.id; app.audio.play('click'); render(bodyRef); bodyRef.querySelector('.skill-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    },
    h('span', { class: 'st-ic' }, skillImg(s.id), open ? null : h('span', { class: 'st-lock' }, glyph('lock')), slot >= 0 ? h('b', { class: 'st-slot num' }, slot + 1) : null),
    h('span', { class: 'st-name' }, s.name),
    s.kind === 'active' ? pips(rank, s.maxRank) : h('span', { class: 'st-pas' }, rank > 0 ? `ติดตัว ${rank}/${s.maxRank}` : 'ติดตัว'));
  }

  function detail(st, s) {
    const rank = rankOf(st, s.id), open = isUnlocked(st, s.id), pts = skillPoints(st).free, rar = rarityOf(s.rarity);
    const cur = rank > 0 ? s.desc(rankValues(s, rank)) : null;
    const next = rank < s.maxRank ? s.desc(rankValues(s, rank + 1)) : null;
    const cdTxt = s.kind === 'active' ? `คูลดาวน์ ${rankValues(s, Math.max(1, rank)).cooldown} วินาที` : 'ติดตัว (ทำงานตลอด)';
    const [have, need] = unlockProgress(st, s);
    const actions = [];
    if (open && rank < s.maxRank) {
      actions.push(h('button', { class: 'btn primary', type: 'button', 'data-learn': s.id, disabled: pts <= 0, onclick: () => act(learn(app.store.get(), s.id), rank === 0 ? `เรียน «${s.name}» แล้ว` : `«${s.name}» ระดับ ${rank + 1}`, 'levelup') },
        rank === 0 ? 'เรียน (1 แต้ม)' : `เพิ่มเป็นระดับ ${rank + 1} (1 แต้ม)`));
    }
    if (s.kind === 'active' && rank > 0) {
      const slots = st.skills.slots;
      actions.push(h('div', { class: 'slot-pick', role: 'group', 'aria-label': 'ใส่ช่องสกิล' }, h('span', { class: 'muted small' }, 'ใส่ช่อง:'), Array.from({ length: SKILL_SLOTS }, (_, i) =>
        h('button', { class: `slot-chip ${slots[i] === s.id ? 'on' : ''}`, type: 'button', 'data-equip': `${s.id}:${i}`, 'aria-pressed': String(slots[i] === s.id),
          onclick: () => (slots[i] === s.id ? act(unequipSkill(app.store.get(), i), null, 'click') : act(equipSkill(app.store.get(), s.id, i), `ใส่ «${s.name}» ช่อง ${i + 1}`, 'click')) }, `${i + 1}`))));
    }
    const el = EL[s.el] || EL.fire;
    return h('section', { class: `skill-detail r-${rar.id} ${open ? '' : 'locked'}`, 'data-detail': s.id, style: { '--el': el.glow } },
      h('div', { class: 'sd-head' },
        h('span', { class: 'sd-ic' }, skillImg(s.id)),
        h('div', { class: 'sd-meta' },
          h('div', { class: 'sd-name' }, h('b', {}, s.name), h('span', { class: 'rar-tag' }, rar.name)),
          h('div', { class: 'sd-tags' }, h('span', { class: 'chip' }, CAT_NAME[s.cat] || 'สกิล'), h('span', { class: 'chip el' }, `ธาตุ${EL_NAME[s.el] || ''}`), h('span', { class: 'chip' }, cdTxt)),
          h('div', { class: 'sd-rank' }, pips(rank, s.maxRank), h('span', { class: 'muted small' }, rank > 0 ? `ระดับ ${rank}/${s.maxRank}` : 'ยังไม่ได้เรียน')))),
      cur ? h('p', { class: 'skill-desc' }, h('span', { class: 'tag' }, 'ตอนนี้'), cur) : null,
      next ? h('p', { class: 'skill-desc next' }, h('span', { class: 'tag' }, rank === 0 ? 'ระดับ 1' : `ระดับ ${rank + 1}`), next) : null,
      open ? h('p', { class: 'skill-lore' }, s.lore)
        : h('div', { class: 'sd-unlock' }, h('span', {}, glyph('lock'), ' ', unlockText(s)), need > 1 ? h('span', { class: 'sd-prog' }, h('i', { style: { width: `${Math.min(100, (have / need) * 100)}%` } }), h('b', { class: 'num' }, `${Math.min(have, need)}/${need}`)) : null),
      actions.length ? h('div', { class: 'actions' }, actions) : null);
  }

  // the ultimate of the weapon in hand, with the way into the codex
  function ultRow(st) {
    const id = equippedUlt(st), u = id ? getUlt(id) : null, tr = u ? ULT_TIERS[u.tier] : null;
    return h('div', { class: 'ult-row', style: tr ? { '--ut': tr.color } : {} },
      u ? ultImg(id, 'ult-img', !!tr.secret) : h('span', { class: 'ult-none' }, glyph('star')),
      h('div', { class: 'ur-text' }, h('small', {}, 'ท่าไม้ตายของอาวุธที่ถือ (ปุ่ม G)'), h('b', {}, u ? (tr.secret ? '???' : u.name) : 'อาวุธนี้ไม่มีท่าไม้ตาย'), u ? h('span', { class: 'ut-tag' }, `ระดับ ${tr.name}`) : null),
      h('button', { class: 'btn small', type: 'button', 'data-action': 'open-ult-codex', onclick: () => app.openUltCodex() }, 'คลังท่าไม้ตาย'));
  }

  let bodyRef = null;
  function render(body) {
    bodyRef = body;
    const st = app.store.get();
    const pts = skillPoints(st);
    const all = Object.values(SKILLS);
    const q = view.q.trim().toLowerCase();
    const shown = all.filter((s) => (view.cat === 'all' || s.cat === view.cat) && (!view.open || isUnlocked(st, s.id)) && (!q || s.name.toLowerCase().includes(q)))
      .sort((a, b) => (isUnlocked(st, b.id) - isUnlocked(st, a.id)) || (rankOf(st, b.id) > 0) - (rankOf(st, a.id) > 0) || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    if (!view.sel || !SKILLS[view.sel]) view.sel = shown[0]?.id || null;
    const learned = all.filter((s) => rankOf(st, s.id) > 0).length, unlocked = all.filter((s) => isUnlocked(st, s.id)).length;

    const slotRow = h('div', { class: 'skill-slots' }, st.skills.slots.map((id, i) => h('button', { class: `skill-slot ${id ? 'on' : ''} ${id ? `r-${SKILLS[id].rarity}` : ''}`, type: 'button', 'data-slot-skill': i,
      onclick: () => { if (id) { view.sel = id; render(body); } } },
      h('span', { class: 'n' }, app.touch ? `ช่อง ${i + 1}` : `ปุ่ม ${i + 1}`),
      id ? skillImg(id, 'skill-img big') : h('span', { class: 'skill-ic empty' }),
      h('span', { class: 'nm' }, id ? SKILLS[id].name : 'ว่าง'),
      id ? h('span', { class: 'muted small' }, `${rankValues(SKILLS[id], rankOf(st, id)).cooldown} วิ`) : null)));

    const chips = h('div', { class: 'skill-filters', role: 'tablist' },
      SKILL_CATS.map((c) => h('button', { class: `fchip ${view.cat === c.id ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(view.cat === c.id), 'data-cat': c.id,
        onclick: () => { view.cat = c.id; view.sel = null; render(body); } }, c.name, ' ', h('small', { class: 'num' }, c.id === 'all' ? all.length : all.filter((s) => s.cat === c.id).length))),
      h('button', { class: `fchip ${view.open ? 'on' : ''}`, type: 'button', 'data-filter': 'open', 'aria-pressed': String(view.open), onclick: () => { view.open = !view.open; view.sel = null; render(body); } }, 'เฉพาะที่ปลดล็อกแล้ว'));
    const search = h('input', { class: 'skill-search', type: 'search', placeholder: 'ค้นหาชื่อสกิล', value: view.q, 'aria-label': 'ค้นหาสกิล', 'data-skill-search': '',
      oninput: (e) => { view.q = e.target.value; const pos = e.target.selectionStart; view.sel = null; render(body); const n = body.querySelector('[data-skill-search]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* not all inputs */ } } });

    const sel = view.sel ? SKILLS[view.sel] : null;
    body.replaceChildren(
      h('div', { class: 'points-bar' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'แต้มสกิล'), h('b', { class: 'num big-num', 'data-points': '' }, pts.free), h('span', { class: 'muted' }, ` / ${pts.total} · ได้ 1 แต้มทุกเลเวล`)),
        h('div', { class: 'muted small' }, `ปลดล็อก ${unlocked}/${all.length} · เรียนแล้ว ${learned}`),
        pts.spent > 0 ? confirmButton(`รีเซ็ต (${SKILL_RESET_COST} ทอง)`, 'ยืนยันรีเซ็ต', () => act(resetSkills(app.store.get()), 'คืนแต้มสกิลทั้งหมดแล้ว'), 'btn small') : null),
      h('div', { class: 'eyebrow' }, 'ช่องสกิลในการต่อสู้'), slotRow,
      ultRow(st),
      h('div', { class: 'skill-tools' }, chips, search),
      sel ? detail(st, sel) : h('p', { class: 'muted' }, 'ไม่พบสกิลที่ตรงกับตัวกรอง'),
      h('div', { class: 'skill-grid' }, shown.map((s) => tile(st, s))));
  }

  return {
    id: 'skills', title: 'สกิล', icon: 'whirl',
    badge: () => skillPoints(app.store.get()).free > 0,
    render,
  };
}
