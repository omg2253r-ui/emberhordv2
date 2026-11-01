// คลังท่าไม้ตาย: every ultimate of the five known tiers with what it does and which weapons can carry it, a live stage
// that plays the chosen one on a training dummy, how the gauge fills (farming and PvP) and the odds for each rarity of
// weapon. The sixth tier is listed only as three sealed ??? cards.
import { h, glyph, ultImg } from './dom.js';
import { createRenderer } from '../engine/renderer.js';
import { ULTIMATES, ULT_TIERS, ULT_NEED, ULT_GAIN, ultsOfTier, getUlt } from '../data/ultimates.js';
import { ULT_CHANCE, SECRET_CHANCE, ultOdds, equippedUlt } from '../systems/ultimate.js';
import { WEAPON_TYPES } from '../data/weapons.js';
import { rarityOf } from '../data/rarity.js';
import { createUltState, unleash, updateUlt, drawUltScreen } from '../battle/ultimate.js';
import { createSkillRuntime } from '../battle/skillCast.js';
import { createParticles } from '../engine/particles.js';
import { createFx } from '../battle/fx.js';
import { createPlayer } from '../battle/player.js';
import { computeStats } from '../systems/stats.js';
import { drawHero } from '../battle/heroDraw.js';
import { playerPose } from '../battle/weaponPose.js';
import { createShot, updateShots, drawShot } from '../battle/playerShots.js';
import { EL } from '../battle/skillVfx.js';

const EL_NAME = { fire: 'ไฟ', ice: 'น้ำแข็ง', volt: 'สายฟ้า', wind: 'ลม', earth: 'ดิน', shadow: 'เงา', holy: 'แสง', poison: 'พิษ', blood: 'โลหิต', void: 'ความว่าง', nature: 'พฤกษา', water: 'น้ำ', star: 'ดารา', arcane: 'เวท', steel: 'เหล็ก' };
const RAR = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const pct = (v) => (v >= 0.1 ? `${Math.round(v * 100)}%` : v >= 0.01 ? `${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(2)}%`);

export function openUltCodex(app, focus = null) {
  const st = app.store.get();
  const mine = equippedUlt(st);
  let tier = focus ? getUlt(focus)?.tier || 1 : mine ? Math.min(5, getUlt(mine).tier) : 1;
  let sel = focus || (mine && getUlt(mine).tier < 6 ? mine : ultsOfTier(tier)[0]);
  const stage = h('canvas', { class: 'uc-stage', 'aria-label': 'ตัวอย่างท่าไม้ตาย' });
  const preview = createPreview(app, stage);
  const listEl = h('div', { class: 'uc-grid' });
  const infoEl = h('div', { class: 'uc-info' });
  const tabs = h('div', { class: 'uc-tabs', role: 'tablist' });

  function renderTabs() {
    tabs.replaceChildren(...ULT_TIERS.slice(1).map((t) => h('button', { class: `fchip ${tier === t.n ? 'on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(tier === t.n), 'data-tier': t.n, style: { '--ut': t.color },
      onclick: () => { tier = t.n; if (!t.secret) { sel = ultsOfTier(t.n)[0]; preview.play(sel); } render(); } }, t.secret ? '???' : `ระดับ ${t.n} · ${t.name}`, ' ', h('small', { class: 'num' }, ultsOfTier(t.n).length))));
  }
  function card(id) {
    const u = ULTIMATES[id], tr = ULT_TIERS[u.tier], secret = !!tr.secret;
    return h('button', { class: `uc-card ${sel === id && !secret ? 'sel' : ''} ${secret ? 'secret' : ''} ${mine === id ? 'mine' : ''}`, type: 'button', 'data-ult': secret ? '???' : id, style: { '--ut': tr.color },
      disabled: secret, onclick: () => { if (secret) return; sel = id; preview.play(id); render(); } },
      ultImg(id, 'ult-img', secret),
      h('b', {}, secret ? '???' : u.name),
      h('small', {}, secret ? 'ระดับลับ' : `ธาตุ${EL_NAME[u.el] || ''}`),
      mine === id && !secret ? h('span', { class: 'uc-mine' }, 'อาวุธของคุณ') : null);
  }
  function info() {
    const u = getUlt(sel);
    if (!u || ULT_TIERS[u.tier].secret) return h('p', { class: 'muted' }, 'ท่าไม้ตายระดับลับมีเพียงสามท่า ไม่มีใครบอกได้ว่าคืออะไร มีแต่คนดวงดีที่ได้เห็นเอง');
    const tr = ULT_TIERS[u.tier];
    const wt = u.wt ? u.wt.map((k) => WEAPON_TYPES[k]?.name || k).join(' · ') : 'อาวุธทุกประเภท';
    return h('div', { class: 'uc-detail', style: { '--ut': tr.color, '--el': (EL[u.el] || EL.fire).glow } },
      h('div', { class: 'uc-dh' }, ultImg(u.id, 'ult-img big'), h('div', {}, h('div', { class: 'uc-name' }, u.name), h('div', { class: 'uc-tags' }, h('span', { class: 'ut-tag' }, `ระดับ ${tr.name}`), h('span', { class: 'chip' }, `ธาตุ${EL_NAME[u.el] || ''}`), h('span', { class: 'chip' }, `${u.seq.length} จังหวะ`)))),
      h('p', {}, u.desc),
      h('div', { class: 'uc-facts' },
        h('div', {}, h('small', {}, 'สะสมแต้ม (ล่า / PvP)'), h('b', { class: 'num' }, `${ULT_NEED.pve[u.tier]} / ${ULT_NEED.pvp[u.tier]}`)),
        h('div', {}, h('small', {}, 'ติดมากับ'), h('b', {}, wt))),
      h('button', { class: 'btn small', type: 'button', 'data-action': 'ult-replay', onclick: () => preview.play(u.id) }, glyph('rotate'), ' เล่นท่าอีกครั้ง'));
  }
  function render() {
    renderTabs();
    listEl.replaceChildren(...ultsOfTier(tier).map(card));
    infoEl.replaceChildren(info());
  }

  const gainRows = h('div', { class: 'uc-how' },
    h('div', { class: 'eyebrow' }, 'สะสมแต้มไม้ตาย'),
    h('ul', {},
      h('li', {}, `ล่าบอสและมอน: ตีมอน +${ULT_GAIN.mob} · ตีบอส +${ULT_GAIN.boss} · หลบสมบูรณ์หรือแพร์รี่ +${ULT_GAIN.perfect}`),
      h('li', {}, `PvP: ตีโดน +${ULT_GAIN.pvpHit} · โดนตี +${ULT_GAIN.pvpHurt} · หลบสมบูรณ์หรือแพร์รี่ +${ULT_GAIN.pvpPerfect} (แต้มติดข้ามยกได้ในแมตช์เดียวกัน)`),
      h('li', {}, `แต้มที่ต้องใช้ ระดับ 1–5: ล่า ${ULT_NEED.pve.slice(1, 6).join(' / ')} · PvP ${ULT_NEED.pvp.slice(1, 6).join(' / ')} · ระดับลับ ???`),
      h('li', {}, 'ล่าคนเดียว: เวลาหยุดให้มอนสเตอร์ระหว่างท่าไม้ตาย · ใน PvP ท่าไม้ตายแรงลดลงเกือบครึ่ง')),
    h('div', { class: 'eyebrow' }, 'โอกาสที่อาวุธจะมีท่าไม้ตาย (สุ่มตอนได้อาวุธ)'),
    h('div', { class: 'uc-odds' }, h('div', { class: 'uo-row head' }, h('span', {}, 'ความหายาก'), h('span', {}, 'มีไม้ตาย'), ...[1, 2, 3, 4, 5].map((n) => h('span', {}, `ระดับ ${n}`)), h('span', {}, '???')),
      RAR.map((r) => { const o = ultOdds(r); const rr = rarityOf(r); return h('div', { class: `uo-row r-${r}` }, h('span', { class: 'rc-text' }, rr.name), h('span', { class: 'num' }, pct(ULT_CHANCE[r])), ...o.tiers.map((t) => h('span', { class: 'num' }, t ? pct(t) : '–')), h('span', { class: 'num' }, SECRET_CHANCE[r] ? '?' : '–')); }),
      h('small', { class: 'faint' }, 'อาวุธธรรมดาไม่มีท่าไม้ตาย · ระดับลับมีโอกาสน้อยมาก และอาวุธลับบางชิ้นมีมาแน่นอน')));

  let close;
  const content = h('div', { class: 'modal panel ult-codex', 'data-modal': 'ult-codex' },
    h('div', { class: 'bs-head' }, h('h2', {}, 'คลังท่าไม้ตาย'), h('div', { class: 'bs-sub' }, h('span', {}, `50 ท่าใน 5 ระดับ · และอีก 3 ท่าที่ยังไม่มีใครรู้`), mine ? h('span', { class: 'chip' }, `อาวุธที่ถือ: ${getUlt(mine).tier === 6 ? '???' : getUlt(mine).name}`) : h('span', { class: 'chip' }, 'อาวุธที่ถือไม่มีท่าไม้ตาย'))),
    stage, infoEl, tabs, listEl, gainRows,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'ult-codex-close', onclick: () => close() }, 'ปิด')));
  render();
  close = app.modal(content, { onClose: () => preview.stop() });
  requestAnimationFrame(() => preview.play(sel));
  return close;
}

// ------------------------------------------------------------------ a little stage that plays one ultimate
function createPreview(app, canvas) {
  const r = createRenderer(canvas);
  const particles = createParticles(260);
  const W = 900, H = 460;
  let w = null, raf = 0, last = 0, t0 = performance.now(), loopAt = 0, playing = null;
  function makeWorld() {
    const stats = computeStats(app.store.get());
    const p = createPlayer(stats, 260, 330);
    const dummy = { x: 620, y: 320, r: 34, hp: 1e9, maxHp: 1e9, dead: false, type: { boss: true, mass: 99 }, flash: 0, vx: 0, vy: 0, dummy: true };
    const wd = {
      player: p, enemies: [dummy], arena: { w: W, h: H }, pvp: false, time: 0, sk: createSkillRuntime(), fx: createFx(), particles, shots: [], ultFreezes: false,
      sfx: (n, o) => app.audio.play(n, o), shake: () => {}, hitStop: () => {},
      clampBody: (b) => { b.x = Math.max(60, Math.min(W - 60, b.x)); b.y = Math.max(120, Math.min(H - 30, b.y)); },
      playerStrike: (e, power) => { e.flash = 1; wd.fx.number(e.x, e.y - 90, Math.round(power * (stats.atk || 10)), 'hit'); return null; },
      firePlayerShot: (o) => wd.shots.push(createShot(o)),
    };
    return wd;
  }
  function frame() {
    if (!canvas.isConnected) { stop(); return; }
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000, dt = Math.min(0.05, t - last); last = t;
    if (!w) return;
    w.time += dt;
    updateUlt(w, dt);
    const p = w.player;
    if (p.act) { p.act.t += dt; if (p.act.t >= p.act.dur) p.act = null; }
    if (p.spinT > 0) p.spinT -= dt;
    w.sk.update(dt, w); w.fx.update(dt); particles.update(dt); updateShots(w.shots, dt, w);
    for (const e of w.enemies) { if (e.flash > 0) e.flash -= dt * 4; e.vx = e.vy = 0; }
    if (!w.ult.run && playing && t > loopAt) { loopAt = Infinity; setTimeout(() => { if (playing && canvas.isConnected) play(playing); }, 900); }
    draw();
  }
  function draw() {
    r.resize(); r.screenSpace();
    const ctx = r.ctx, vw = r.view.w, vh = r.view.h;
    const g = ctx.createLinearGradient(0, 0, 0, vh); g.addColorStop(0, '#0d1230'); g.addColorStop(1, '#05060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    const k = Math.min(vw / W, vh / H), ox = (vw - W * k) / 2, oy = (vh - H * k) / 2;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k);
    // floor
    ctx.fillStyle = 'rgba(80,100,200,0.12)'; ctx.beginPath(); ctx.ellipse(W / 2, 330, 400, 90, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(140,160,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(W / 2, 330, 400, 90, 0, 0, Math.PI * 2); ctx.stroke();
    const p = w.player, d = w.enemies[0];
    w.sk.drawGround(ctx, w.time);
    // the training dummy
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(d.x, d.y);
    ctx.fillStyle = '#5a4030'; ctx.strokeStyle = '#140f22'; ctx.lineWidth = 3;
    ctx.fillRect(-6, -90, 12, 90); ctx.strokeRect(-6, -90, 12, 90);
    ctx.fillStyle = d.flash > 0 ? '#fff3c4' : '#c8a070'; ctx.beginPath(); ctx.ellipse(0, -70, 26, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -118, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7a2a20'; ctx.beginPath(); ctx.arc(0, -70, 12, 0, Math.PI * 2); ctx.moveTo(-6, -70); ctx.lineTo(6, -70); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawHero(r, app.sprites.heroParts, app.sprites.weapon, { x: p.x, y: p.y - (p.leapZ || 0), flip: p.flip, time: w.time, walkT: 0, moving: false, wp: playerPose(p, w.time), type: p.wtype, scale: 0.95 });
    for (const s of w.shots) drawShot(ctx, s, w.time);
    w.sk.drawAir(ctx, w.time);
    particles.draw(ctx);
    w.fx.drawWorld(ctx); w.fx.drawNumbers(ctx);
    ctx.restore();
    drawUltScreen(ctx, w, { w: vw, h: vh }, (c, x, y, sc) => drawHero(r, app.sprites.heroParts, app.sprites.weapon, { x, y, flip: false, time: w.time, walkT: 0, moving: false, type: w.player.wtype, scale: sc * 0.8, wp: { arm: -1.1, blade: -2.5, reach: 8, lean: -0.12, glow: 1 } }));
  }
  function play(id) {
    playing = id;
    w = makeWorld();
    w.ult = createUltState(id, false);
    if (!w.ult) return;
    w.ult.val = w.ult.need;
    unleash(w);
    loopAt = (performance.now() - t0) / 1000 + 0.5;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; playing = null; }
  return { play, stop };
}
