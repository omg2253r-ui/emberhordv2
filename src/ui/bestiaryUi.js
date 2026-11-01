// สมุดบอส: every boss on a dark card lit in its element's colours (lightning, ice, fire, shadow, holy light …),
// numbered with its epithet under the name. A card opens the boss's page: a live stage where it shows its moves,
// difficulty, recommended level, health, the phases of its attack pattern, and what it drops, with the odds.
import { h, glyph, itemImg } from './dom.js';
import { tipTarget } from './itemTip.js';
import { createRenderer } from '../engine/renderer.js';
import { drawRig, spriteMotion, animOf } from '../battle/rigDraw.js';
import { drawBossBackdrop, drawElementFx, drawVignette } from '../battle/elementFx.js';
import { BOSSES, bossInfo, bossBeaten, bossBars } from '../data/bestiary.js';
import { getItem } from '../data/items.js';

const PCT = (p) => (p >= 0.995 ? '100%' : p >= 0.1 ? `${Math.round(p * 100)}%` : p >= 0.01 ? `${(p * 100).toFixed(1)}%` : `${(p * 100).toFixed(2)}%`);
const STAR = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)) + (n % 1 ? ` ${n}` : '');

// draws a boss (jointed or a single picture) standing on the ground line, fitting the box
function drawBossFigure(app, r, id, x, groundY, maxH, maxW, t, pose = null) {
  const R = app.rigs[id];
  if (R) {
    const k = Math.min(maxH / 225, maxW / 200);
    const e = pose?.e || { id: 7, anim: { wind: 0, swing: -1, cast: -1, lastWarn: 0, lt: null, cur: null } };
    drawRig(r, R, e, { x, y: groundY, flip: false, scale: k, time: t, moving: false, walkT: 0, aim: 0.15, alpha: 1, flash: 0 });
    return;
  }
  const s = app.sprites[id];
  if (!s) return;
  const k = Math.min(maxH / s.h, maxW / s.w);
  const m = pose?.e ? spriteMotion(pose.e, pose.e.anim, t, 1) : { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 };
  r.sprite(s, x + m.dx * k, groundY + m.dy * k, { sx: k * m.sx, sy: k * m.sy, rot: m.rot });
}

function cardCanvas(app, entry, info, n) {
  const c = h('canvas', { class: 'bc-art', 'aria-hidden': 'true' });
  const draw = () => {
    if (!c.isConnected) return;
    const r = createRenderer(c); r.resize(); r.screenSpace();
    const W = r.view.w, H = r.view.h, ctx = r.ctx;
    drawBossBackdrop(ctx, info.el, W, H, 3.7 + n * 1.3, { groundY: 0.76, glowY: 0.42 });
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.76, W * 0.3, 7, 0, 0, Math.PI * 2); ctx.fill();
    drawBossFigure(app, r, entry.id, W / 2, H * 0.76, H * 0.7, W * 0.96, 1.2 + n);
    drawElementFx(ctx, info.el, { x: 0, y: H * 0.3, w: W, h: H * 0.7 }, 5.1 + n, 0.55);
    drawVignette(ctx, W, H);
  };
  requestAnimationFrame(draw);
  c.redraw = draw;
  return c;
}

export function openBestiary(app) {
  let close;
  const st = app.store.get();
  const beaten = BOSSES.filter((b) => bossBeaten(st, b.id)).length;
  const cards = [];
  const grid = h('div', { class: 'bc-grid' }, BOSSES.map((b, i) => {
    const info = bossInfo(b);
    if (!info) return null;
    const won = bossBeaten(st, b.id);
    const art = cardCanvas(app, b, info, i);
    cards.push(art);
    return h('button', { class: `boss-card ${won ? 'won' : ''}`, type: 'button', 'data-boss': b.id, style: { '--bc': info.el.c1, '--bg': info.el.glow }, onclick: () => openBoss(app, b, i + 1) },
      art,
      won ? h('span', { class: 'bc-won' }, glyph('check'), 'ปราบแล้ว') : null,
      h('span', { class: 'bc-stars', 'aria-label': `ความยาก ${info.stars} ดาว` }, '★'.repeat(Math.round(info.stars))),
      h('div', { class: 'bc-plate' }, h('b', {}, `${i + 1}. ${info.def.name}`), h('small', {}, b.epithet)));
  }));
  // jointed bosses are drawn part by part the first time: repaint their cards when they are ready
  Promise.all(BOSSES.map((b) => app.ensureRig?.(b.id))).then(() => cards.forEach((c) => c.redraw()));
  const content = h('div', { class: 'modal panel bestiary', 'data-modal': 'bestiary' },
    h('div', { class: 'bs-head' },
      h('h2', {}, 'บอสทั้งหมดในเกม'),
      h('div', { class: 'bs-sub' }, h('span', {}, 'เหล่าผู้พิทักษ์แห่งโลกที่ถูกลืม'), h('span', { class: 'chip num' }, `ปราบแล้ว ${beaten}/${BOSSES.length}`))),
    grid,
    h('blockquote', { class: 'bs-quote' }, '“ทุกบอส… ไม่ใช่แค่ศัตรู', h('br'), 'แต่คือบททดสอบของผู้กล้า”'),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'bestiary-close', onclick: () => close() }, 'ปิด')));
  close = app.modal(content);
  return close;
}

// ------------------------------------------------------------------ one boss
function openBoss(app, entry, n) {
  app.audio.play('open');
  const info = bossInfo(entry);
  const st = app.store.get();
  const stage = h('canvas', { class: 'bd-stage', 'aria-label': `${info.def.name} กำลังแสดงท่าโจมตี` });
  const r = createRenderer(stage);
  const e = { id: n, anim: { wind: 0, swing: -1, cast: -1, lastWarn: 0, lt: null, cur: null }, vx: 0, vy: 0 };
  app.ensureRig?.(entry.id);
  const t0 = performance.now();
  let raf = 0, last = 0;
  // showcase loop: rest → wind up → strike → rest → spell
  function frame() {
    if (!stage.isConnected) { cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000, dt = Math.min(0.05, t - last); last = t;
    const cyc = t % 6;
    const a = animOf(e);
    a.wind = cyc > 1.2 && cyc < 2.0 ? Math.min(1, a.wind + dt * 5) : Math.max(0, a.wind - dt * 6);
    if (cyc >= 2.0 && cyc - dt < 2.0) a.swing = 0;
    if (cyc >= 4.0 && cyc - dt < 4.0) a.cast = 0;
    if (a.swing >= 0) { a.swing += dt / 0.3; if (a.swing > 1.6) a.swing = -1; }
    if (a.cast >= 0) { a.cast += dt / 0.55; if (a.cast > 1.3) a.cast = -1; }
    a.dt = dt; a.lt = t;
    r.resize(); r.screenSpace();
    const W = r.view.w, H = r.view.h, ctx = r.ctx;
    drawBossBackdrop(ctx, info.el, W, H, t, { groundY: 0.88 });
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.88, Math.min(W * 0.25, 120), 9, 0, 0, Math.PI * 2); ctx.fill();
    drawBossFigure(app, r, entry.id, W / 2, H * 0.88, H * 0.8, W * 0.8, t, { e });
    drawElementFx(ctx, info.el, { x: W * 0.1, y: H * 0.2, w: W * 0.8, h: H * 0.7 }, t + 3, 0.7);
    drawVignette(ctx, W, H);
  }
  requestAnimationFrame(frame);

  const where = info.god ? `ชั้น ${info.god.floor}` : info.zone ? (info.zone.raid ? 'ดันเจี้ยนพิเศษ' : info.zone.story ? 'เนื้อเรื่อง' : `ดินแดน ${info.zone.n}`) : 'เนื้อเรื่อง';
  const phases = h('ol', { class: 'bd-phases' }, entry.phases.map(([range, text], i) =>
    h('li', { class: `ph-${i + 1}` }, h('b', {}, `${i === entry.phases.length - 1 && entry.phases.length > 2 ? 'เฟสสุดท้าย' : `เฟส ${i + 1}`} (${range})`), h('span', {}, text))));
  const loot = info.drops.filter((d) => getItem(d.id)).slice(0, 10);
  const drops = h('div', { class: 'bd-drops' }, loot.map((d) => {
    const def = getItem(d.id);
    const cell = h('span', { class: `cell r-${def.rarity}`, 'data-item-id': def.id }, itemImg(def.id));
    return h('div', { class: `bd-drop r-${def.rarity}` }, tipTarget(cell, def.id), h('div', {}, h('b', { class: 'rc-text' }, def.name), h('small', { class: 'num' }, `โอกาส ${PCT(d.chance)}`)));
  }));
  let close;
  const content = h('div', { class: 'modal panel boss-page', 'data-modal': 'boss', 'data-boss': entry.id, style: { '--bc': info.el.c1, '--bg': info.el.glow } },
    h('div', { class: 'bp-head' },
      h('small', { class: 'bp-where' }, `${n}. ${info.where}`),
      h('h2', {}, info.def.name),
      h('div', { class: 'bp-epithet' }, entry.epithet)),
    stage,
    h('div', { class: 'bp-facts' },
      h('div', {}, h('small', {}, 'ความยาก'), h('b', { class: 'bp-stars' }, STAR(info.stars))),
      h('div', {}, h('small', {}, 'เลเวลที่แนะนำ'), h('b', { class: 'num' }, `${info.level}+`)),
      h('div', {}, h('small', {}, 'เลือดบอส (เดี่ยว)'), h('b', { class: 'num' }, (info.def.hp * bossBars(entry.id)).toLocaleString('th-TH'))),
      bossBars(entry.id) > 1 ? h('div', {}, h('small', {}, 'จำนวนหลอดเลือด'), h('b', { class: 'num' }, `×${bossBars(entry.id)}`)) : null,   // v8.6: by difficulty and rewards, up to ×100
      info.armor ? h('div', {}, h('small', {}, 'เกราะรวมทุกเฟส'), h('b', { class: 'num' }, info.armor.reduce((a, b) => a + b, 0).toLocaleString('th-TH'))) : null,
      h('div', {}, h('small', {}, 'ธาตุ'), h('b', { style: { color: info.el.glow } }, info.el.name)),
      h('div', {}, h('small', {}, 'พบที่'), h('b', {}, where)),
      h('div', {}, h('small', {}, 'สถานะ'), h('b', {}, bossBeaten(st, entry.id) ? 'ปราบแล้ว' : 'ยังไม่เคยชนะ'))),
    h('div', { class: 'bp-cols' },
      h('section', {}, h('div', { class: 'eyebrow' }, 'แพทเทิร์นการโจมตี'), phases,
        (info.trial || info.armor) ? h('div', { class: 'bd-trial' }, h('b', {}, 'บททดสอบเพิ่มเติม'),
          info.armor ? h('span', {}, `เกราะประจำเฟส (วงเหล็กรอบตัว): ${info.armor.map((a, i) => `เฟส ${i + 1} = ${a.toLocaleString('th-TH')}`).join(' · ')} — ดาเมจถูกเกราะดูดก่อน พังเกราะแล้วบอสจะเสียหลัก เข้าเฟสใหม่เกราะฟื้นเต็ม`) : null,
          info.trial?.pierce ? h('span', {}, 'เมื่อโกรธ (หรือเข้าเฟส 2) การโจมตีจะเจาะเกราะ วงเตือนสีแดงเข้ม: กันไม่ได้ ต้องหลบ') : null) : null),
      h('section', {}, h('div', { class: 'eyebrow' }, 'ของดรอปหลัก (ต่อการปราบ 1 ครั้ง)'), drops)),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'boss-close', onclick: () => close() }, 'กลับ')));
  close = app.modal(content);
}
