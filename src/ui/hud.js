// In-dungeon HUD. Layout rule: persistent info lives in the corners, the centre of the screen stays clear,
// controls sit along the bottom edge. DOM is only touched when a displayed value changes.
//   top-left: hero vitals · top-right: minimap, key, gold, pause · top-centre: boss bar / room title (transient)
//   bottom: hotbar (desktop) or joystick + action cluster (touch) · left edge: loot feed (toasts)
import { activeBuffs, BUFF_ICONS } from '../battle/buffs.js';
import { h, glyph, itemImg, skillImg, ultImg } from './dom.js';
import { ULT_TIERS } from '../data/ultimates.js';
import { countItem } from '../systems/inventory.js';
import { xpToNext } from '../config/balance.js';
import { SKILLS } from '../data/skills.js';
import { doorsOf } from '../systems/dungeon.js';
import { comboBonus } from '../systems/combat.js';
import { styleRank, styleProgress, styleBonus } from '../battle/style.js';
import { GUARD } from '../battle/guard.js';
import { applyLayout, loadLayout } from './hudLayout.js';

export function createHud(root, app) {
  const { input, store } = app;
  const el = h('div', { class: 'hud', hidden: true });

  // ---- top-left vitals
  const portrait = h('img', { class: 'hud-portrait', alt: '' });
  const lvBadge = h('span', { class: 'hud-lv num' }, '1');
  const nameTxt = h('span', { class: 'hud-name' });
  const hpFill = h('i', { class: 'fill' }), hpLag = h('i', { class: 'lag' }), hpShield = h('i', { class: 'shield' }), hpTxt = h('span', { class: 'txt num' });
  const xpFill = h('i');
  const buffRow = h('div', { class: 'buff-row' });
  // up to three pet chips (one per team member), each with its own cooldown sweep
  const petChips = [0, 1, 2].map(() => { const img = h('img', { alt: '' }); const el = h('div', { class: 'pet-chip', hidden: true }, img, h('i', { class: 'pet-cd' })); return { el, img }; });
  const petRow = h('div', { class: 'pet-row' }, petChips.map((c) => c.el));
  const vitals = h('div', { class: 'vitals' },
    h('div', { class: 'hud-face' }, portrait, lvBadge),
    h('div', { class: 'hud-bars' }, nameTxt, h('div', { class: 'hpbar' }, hpLag, hpFill, hpShield, hpTxt), h('div', { class: 'xpbar' }, xpFill), buffRow),
    petRow);

  // ---- top-right: minimap + meta
  const mapCanvas = h('canvas', { class: 'minimap-canvas', width: 260, height: 190, 'aria-label': 'แผนที่ดันเจี้ยน' });
  const keyTxt = h('span', { class: 'num' }, '0'), goldTxt = h('span', { class: 'num' }, '0');
  const pauseBtn = h('button', { class: 'hud-icon-btn', type: 'button', 'aria-label': 'หยุดเกมชั่วคราว', 'data-action': 'pause', onclick: () => app.pauseBattle() }, glyph('pause'));
  const bagBtn = h('button', { class: 'hud-icon-btn', type: 'button', 'aria-label': 'เปิดกระเป๋า (B)', title: 'กระเป๋า (B)', 'data-action': 'bag', onclick: () => app.openBag?.() }, glyph('bag'));
  const mapBox = h('button', { class: 'minimap', type: 'button', 'aria-label': 'ขยายหรือย่อแผนที่', onclick: () => mapBox.classList.toggle('big') }, mapCanvas);
  const meta = h('div', { class: 'hud-meta' },
    h('span', { class: 'meta-chip', title: 'กุญแจผนึก' }, glyph('key'), keyTxt),
    h('span', { class: 'meta-chip gold' }, itemImg('gold'), goldTxt));
  // combo counter lives under the minimap (right edge), away from the fight in the centre
  const comboNum = h('b', { class: 'num' }, '0'), comboBonusTxt = h('small', {});
  const rankLetter = h('b', { class: 'rank-letter' }, 'D'), rankFill = h('i'), rankName = h('small', {});
  const rankBox = h('div', { class: 'style-rank', hidden: true, 'aria-live': 'off', title: 'ระดับสไตล์: สลับท่า แพร์รี่ เคาน์เตอร์ และหลบสมบูรณ์เพื่อไต่ระดับ ถูกตีแล้วลดลงครึ่งหนึ่ง' }, rankLetter, h('div', { class: 'rank-meta' }, rankName, h('span', { class: 'rank-bar' }, rankFill)));
  const comboBox = h('div', { class: 'combo-box', hidden: true, 'aria-live': 'off' }, comboNum, h('span', {}, 'คอมโบ'), comboBonusTxt);
  const topRight = h('div', { class: 'hud-tr' }, h('div', { class: 'hud-tr-row' }, meta, bagBtn, pauseBtn), mapBox, comboBox, rankBox);

  // ---- top-centre
  const bossName = h('div', { class: 'nm' }), bossFill = h('i', { class: 'fill' }), bossLag = h('i', { class: 'lag' });
  const poiseFill = h('i');
  const poiseBar = h('div', { class: 'poisebar', title: 'ความมั่นคง: โจมตีต่อเนื่องจนหมดเพื่อทำให้บอสเสียหลัก' }, poiseFill);
  const armorFill = h('i'), armorTxt = h('span', { class: 'at' });
  const armorBar = h('div', { class: 'armorbar', hidden: true, title: 'เกราะประจำเฟส: ดาเมจถูกเกราะดูดก่อน พังเกราะให้หมดเพื่อทำให้บอสเสียหลัก เข้าเฟสใหม่เกราะจะฟื้น' }, armorFill, armorTxt);
  const bossbar = h('div', { class: 'bossbar', hidden: true }, bossName, h('div', { class: 'hpbar' }, bossLag, bossFill), armorBar, poiseBar);
  const roomName = h('div', { class: 'rt-name' }), roomSub = h('div', { class: 'rt-sub' });
  const roomTitle = h('div', { class: 'room-title', 'aria-live': 'polite' }, roomName, roomSub);
  const bannerBig = h('div', { class: 'big' }), bannerSmall = h('div', { class: 'small' });
  const banner = h('div', { class: 'banner', 'aria-live': 'polite' }, bannerBig, bannerSmall);

  // ---- controls
  const mkBtn = (cls, icon, action, key, label) => {
    const cd = h('canvas', { class: 'cd', width: 96, height: 96 });
    const b = h('button', { class: `act ${cls}`, type: 'button', 'aria-label': label, 'data-act': action }, h('span', { class: 'ic' }, glyph(icon)), cd, key ? h('span', { class: 'key' }, key) : null);
    const down = (e) => { e.preventDefault(); b.classList.add('down'); input.press(action); try { b.setPointerCapture(e.pointerId); } catch { /* capture is optional */ } };
    const up = () => { b.classList.remove('down'); input.release(action); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return { b, cd, ic: b.querySelector('.ic') };
  };
  const atk = mkBtn('attack', 'sword', 'attack', 'J', 'โจมตี');
  const dash = mkBtn('dash', 'dash', 'dash', 'K', 'พุ่งหลบ');
  const guardBtn = mkBtn('guard', 'def', 'guard', 'L', 'ป้องกัน (กดให้ทันจังหวะ = แพร์รี่)');
  const guardMeter = h('span', { class: 'guard-meter' }, h('i'));
  guardBtn.b.append(guardMeter);
  const pot = mkBtn('potion', 'potion', 'potion', 'Q', 'ใช้ยาฟื้นพลัง');
  const potCount = h('span', { class: 'count num' }, '0');
  pot.b.append(potCount);
  const skillBtns = [0, 1, 2].map((i) => mkBtn(`skill s${i}`, 'whirl', `skill${i}`, String(i + 1), `สกิลช่อง ${i + 1}`));
  const raceBtn = mkBtn('skill race', 'race', 'race', 'R', 'สกิลเผ่า');
  // v8: the ultimate — its emblem, a ring that fills with the gauge, and a glow when it is ready
  const ultBtn = mkBtn('skill ult', 'star', 'ult', 'G', 'ท่าไม้ตาย');
  const ultPct = h('span', { class: 'ult-pct num' }, '0%');
  ultBtn.b.append(ultPct);
  const dodgePips = h('span', { class: 'pips dodge-pips' }, h('i'), h('i'));
  dash.b.append(dodgePips);
  const comboPips = h('span', { class: 'pips combo-pips' });
  atk.b.append(comboPips);
  const interact = h('button', { class: 'interact-chip', type: 'button', hidden: true, 'data-action': 'interact' }, h('span', { class: 'k' }, app.touch ? glyph('hand') : 'E'), h('span', { class: 'lbl' }));
  const letGo = () => input.release('interact');
  interact.addEventListener('pointerdown', (e) => { e.preventDefault(); try { interact.setPointerCapture(e.pointerId); } catch { /* older browsers */ } input.press('interact'); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) interact.addEventListener(ev, letGo);
  const knob = h('div', { class: 'knob' });
  const stick = h('div', { class: 'stick', 'aria-hidden': 'true' }, knob);
  const cluster = h('div', { class: 'action-cluster' }, pot.b, ...skillBtns.map((s) => s.b), raceBtn.b, ultBtn.b, guardBtn.b, dash.b, atk.b);
  const flashEl = h('div', { class: 'hud-flash' });
  const controls = h('div', { class: 'controls' }, stick, interact, cluster);

  el.append(flashEl, vitals, topRight, bossbar, roomTitle, banner, controls);
  root.append(el);

  // ---- custom button layout (Settings → ปรับปุ่ม)
  const layoutEls = { stick, attack: atk.b, dash: dash.b, guard: guardBtn.b, potion: pot.b, skill0: skillBtns[0].b, skill1: skillBtns[1].b, skill2: skillBtns[2].b, race: raceBtn.b, ult: ultBtn.b };
  const relayout = () => applyLayout(el, layoutEls, loadLayout());
  relayout();
  addEventListener('resize', relayout);
  addEventListener('orientationchange', relayout);
  // where every control sits right now, in pixels (the HUD may be hidden: it is laid out invisibly to measure)
  function measure(useCustom) {
    const wasHidden = el.hidden, hiddenBtns = Object.values(layoutEls).filter((b) => b.hidden);
    el.style.visibility = 'hidden'; el.hidden = false; hiddenBtns.forEach((b) => { b.hidden = false; });
    if (!useCustom) applyLayout(el, layoutEls, null);
    const out = {};
    for (const [k, b] of Object.entries(layoutEls)) {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && getComputedStyle(b).display !== 'none') out[k] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: b.offsetWidth || r.width, h: b.offsetHeight || r.height };
    }
    relayout();
    hiddenBtns.forEach((b) => { b.hidden = true; }); el.hidden = wasHidden; el.style.visibility = '';
    return out;
  }

  // ---- joystick
  let stickId = null;
  const moveStick = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 10, len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / max, ny = dy / max, dead = Math.hypot(nx, ny) < 0.15;
    input.stick.x = dead ? 0 : nx; input.stick.y = dead ? 0 : ny; input.stick.active = true;
  };
  stick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch { /* capture is optional */ } moveStick(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = () => { stickId = null; knob.style.transform = ''; input.stick.active = false; input.stick.x = input.stick.y = 0; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  function drawCd(canvas, frac) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 96, 96);
    if (frac <= 0) return;
    c.fillStyle = 'rgba(10,6,4,0.66)';
    c.beginPath(); c.moveTo(48, 48); c.arc(48, 48, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.closePath(); c.fill();
  }

  // ---- minimap
  function drawMinimap(world) {
    const c = mapCanvas.getContext('2d');
    const W = mapCanvas.width, H = mapCanvas.height;
    c.clearRect(0, 0, W, H);
    const rooms = world.dungeon.rooms;
    const xs = rooms.map((r) => r.at[0]), ys = rooms.map((r) => r.at[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    const cw = Math.min(70, (W - 20) / cols), ch = Math.min(46, (H - 20) / rows);
    const ox = (W - cols * cw) / 2, oy = (H - rows * ch) / 2;
    const pos = (r) => ({ x: ox + (r.at[0] - minX) * cw, y: oy + (r.at[1] - minY) * ch });
    const visited = (r) => world.rooms.get(r.id).visited;
    const known = (r) => visited(r) || doorsOf(world.dungeon, r).some((d) => visited(world.dungeon.rooms.find((x) => x.id === d.to)));
    // corridors
    c.strokeStyle = 'rgba(224,180,90,0.55)'; c.lineWidth = 4;
    for (const r of rooms) {
      if (!visited(r)) continue;
      const a = pos(r);
      for (const d of doorsOf(world.dungeon, r)) {
        const n = world.dungeon.rooms.find((x) => x.id === d.to), b = pos(n);
        c.beginPath(); c.moveTo(a.x + cw / 2, a.y + ch / 2); c.lineTo(b.x + cw / 2, b.y + ch / 2); c.stroke();
      }
    }
    for (const r of rooms) {
      if (!known(r)) continue;
      const p = pos(r), rt = world.rooms.get(r.id), cur = world.room?.def.id === r.id;
      c.fillStyle = visited(r) ? (rt.cleared ? '#3a2b22' : '#4a2420') : 'rgba(23,17,14,0.85)';
      c.strokeStyle = cur ? '#f5d48a' : visited(r) ? '#8f6f37' : 'rgba(143,111,55,0.6)';
      c.lineWidth = cur ? 4 : 2;
      c.setLineDash(visited(r) ? [] : [5, 4]);
      c.beginPath(); c.roundRect(p.x + 5, p.y + 5, cw - 10, ch - 10, 5); c.fill(); c.stroke();
      c.setLineDash([]);
      const cx = p.x + cw / 2, cy = p.y + ch / 2;
      if (r.type === 'boss') {
        c.fillStyle = world.unsealed ? '#ef6a52' : '#a8a090'; c.strokeStyle = '#1a100c'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(cx, cy - 8); c.lineTo(cx + 8, cy); c.lineTo(cx, cy + 8); c.lineTo(cx - 8, cy); c.closePath(); c.fill(); c.stroke();
        if (!world.unsealed) { c.strokeStyle = '#2a1a14'; c.beginPath(); c.moveTo(cx - 4, cy - 4); c.lineTo(cx + 4, cy + 4); c.moveTo(cx + 4, cy - 4); c.lineTo(cx - 4, cy + 4); c.stroke(); }
      }
      else if (visited(r)) {
        if (r.chest && !rt.chestOpened) { c.fillStyle = r.chest.key ? '#f5d48a' : '#e0b45a'; c.fillRect(cx - 7, cy - 5, 14, 10); }
        else if (r.bonfire) { c.fillStyle = rt.bonfireUsed ? '#7d6d58' : '#ff8a3d'; c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill(); }
        else if (r.lore && !store.get().story.lore[r.lore.id]) { c.fillStyle = '#f3e6c8'; c.fillRect(cx - 5, cy - 6, 10, 12); }
      }
      if (cur) { c.fillStyle = '#f5d48a'; c.beginPath(); c.arc(cx, cy + ch * 0.22, 4, 0, Math.PI * 2); c.fill(); }
    }
  }

  const last = {};
  const setIf = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  let bannerTimer = 0, titleTimer = 0;

  return {
    measure, relayout,
    show(world) {
      el.hidden = false; for (const k of Object.keys(last)) delete last[k];
      bossbar.hidden = true;
      this.setMode(world.zone ? 'coop' : world.mode ? 'arena' : 'dungeon');
      mapBox.classList.remove('big');
      portrait.src = app.portraitUri('hero');
      nameTxt.textContent = store.get().story.name;
      world.skills.forEach((s, i) => {
        const btn = skillBtns[i];
        btn.b.hidden = !s;
        for (const c of [...btn.b.classList]) if (c.startsWith('r-')) btn.b.classList.remove(c);
        if (s) btn.b.classList.add(`r-${SKILLS[s.id].rarity || 'common'}`);
        if (s) { btn.ic.innerHTML = ''; btn.ic.append(skillImg(s.id)); btn.b.setAttribute('aria-label', `${SKILLS[s.id].name} (${i + 1})`); btn.b.title = `${SKILLS[s.id].name} · ปุ่ม ${i + 1}`; }
      });
      cluster.classList.toggle('no-skills', world.skills.every((s) => !s));
      const rs = world.raceSkill;
      raceBtn.b.hidden = !rs;
      if (rs) { raceBtn.ic.innerHTML = ''; raceBtn.ic.append(glyph(rs.icon)); raceBtn.b.style.setProperty('--race', rs.color); raceBtn.b.setAttribute('aria-label', `สกิลเผ่า: ${rs.name} (R)`); raceBtn.b.title = `${rs.name} · ปุ่ม R`; }
      const u = world.ult;
      ultBtn.b.hidden = !u;
      if (u) {
        ultBtn.ic.innerHTML = ''; ultBtn.ic.append(ultImg(u.id, 'ult-img', u.def.tier === 6));
        const tr = ULT_TIERS[u.def.tier];
        ultBtn.b.style.setProperty('--ut', tr.color);
        ultBtn.b.setAttribute('aria-label', `ท่าไม้ตาย: ${u.def.tier === 6 ? '???' : u.def.name} (G)`);
        ultBtn.b.title = `ท่าไม้ตาย ${u.def.name} · ระดับ ${tr.name} · ต้องสะสม ${u.need} แต้ม · ปุ่ม G`;
      }
      const type = world.player.wtype;
      atk.ic.innerHTML = ''; atk.ic.append(glyph(type.icon));
      atk.b.title = `${type.name}: กดรัว = คอมโบ ${type.combo.length} จังหวะ · กดค้าง = ${type.charged.name} · หลบแล้วโจมตี = ${type.dash.name}`;
      comboPips.replaceChildren(...type.combo.map(() => h('i')));
      const team = world.pets || (world.pet ? [world.pet] : []);
      petChips.forEach((c, i) => {
        const pt = team[i];
        c.el.hidden = !pt;
        if (pt) { c.img.src = app.petUri(pt.id); c.el.title = `${pt.pet.name}: ${pt.pet.ability.name}`; c.el.dataset.pet = pt.id; }
      });
      poiseFill.style.width = '100%';
    },
    flash(kind) { flashEl.className = `hud-flash ${kind}`; void flashEl.offsetWidth; flashEl.classList.add('go'); },
    setBossArmor(v, max, phase) {
      setIf('armor', `${Math.ceil(v)}|${max}|${phase}`, () => {
        armorBar.hidden = !(max > 0);
        armorFill.style.width = `${max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`;
        armorTxt.textContent = v > 0 ? `เกราะ${phase ? ` เฟส ${phase}` : ''} ${Math.ceil(v).toLocaleString('th-TH')} / ${max.toLocaleString('th-TH')}` : 'เกราะแตก!';
        armorBar.classList.toggle('down', !(v > 0));
      });
    },
    setPoise(v, broken) {
      setIf('poise', `${Math.round(v)}|${broken}`, () => { poiseFill.style.width = `${Math.max(0, Math.min(100, v))}%`; poiseBar.classList.toggle('broken', !!broken); });
    },
    hide() { el.hidden = true; endStick(); interact.hidden = true; },
    // while an ultimate plays the controls step back
    cinema(on) { el.classList.toggle('cinema', !!on); },
    // 'dungeon' (full HUD), 'arena' (no minimap / loot counters / potion), 'village' (stick + interact only)
    setMode(mode) { el.classList.toggle('mode-arena', mode === 'arena'); el.classList.toggle('mode-village', mode === 'village'); el.classList.toggle('mode-coop', mode === 'coop'); },
    showVillage() { el.hidden = false; for (const k of Object.keys(last)) delete last[k]; bossbar.hidden = true; interact.hidden = true; this.setMode('village'); },
    banner(big, small = '') {
      bannerBig.textContent = big; bannerSmall.textContent = small;
      banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
      clearTimeout(bannerTimer); bannerTimer = setTimeout(() => banner.classList.remove('show'), 2300);
    },
    roomTitle(name, sub = '') {
      roomName.textContent = name; roomSub.textContent = sub;
      roomTitle.classList.remove('show'); void roomTitle.offsetWidth; roomTitle.classList.add('show');
      clearTimeout(titleTimer); titleTimer = setTimeout(() => roomTitle.classList.remove('show'), 2600);
    },
    hurt() { vitals.classList.remove('hurt'); void vitals.offsetWidth; vitals.classList.add('hurt'); },
    // bars = how many health bars (หลอด) the boss is worth (data/bossGuard.js); the bar shows the one being emptied
    // and the name carries a ×N counter of the bars still standing
    setBoss(name, frac = 1, bars = 1) {
      if (!name) { bossbar.hidden = true; return; }
      bossbar.hidden = false;
      const f = Math.max(0, Math.min(1, frac));
      let shown = f, label = name;
      if (bars > 1) {
        const total = f * bars, left = Math.max(1, Math.ceil(total - 1e-6));
        shown = f <= 0 ? 0 : total - (left - 1);
        label = `${name}  ×${left}`;
        bossbar.dataset.bars = String(left);
      } else delete bossbar.dataset.bars;
      bossName.textContent = label;
      const w = `${shown * 100}%`;
      bossFill.style.width = w; bossLag.style.width = w;
    },
    setInteract(label) {
      setIf('interact', label || '', (v) => { interact.hidden = !v; if (!v) input.release('interact'); interact.querySelector('.lbl').textContent = v; });
    },
    minimap(world) { drawMinimap(world); },
    update(p, world) {
      const st = store.get();
      setIf('hp', `${Math.ceil(p.hp)}/${p.maxHp}|${p.shield}`, () => {
        const f = `${(p.hp / p.maxHp) * 100}%`;
        hpFill.style.width = f; hpLag.style.width = f;
        hpShield.style.width = `${Math.min(100, (p.shield / p.maxHp) * 100)}%`;
        hpTxt.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}${p.shield > 0 ? ` +${p.shield}` : ''}`;
      });
      setIf('lv', st.player.level, (v) => { lvBadge.textContent = v; });
      setIf('xp', st.player.xp, (v) => { xpFill.style.width = `${Math.min(100, (v / xpToNext(st.player.level)) * 100)}%`; });
      setIf('gold', st.gold, (v) => { goldTxt.textContent = v.toLocaleString('th-TH'); });
      setIf('keys', world.keys, (v) => { keyTxt.textContent = v; keyTxt.parentElement.classList.toggle('has', v > 0); });
      setIf('pot', countItem(st, 'p_tonic'), (v) => { potCount.textContent = v; pot.b.classList.toggle('empty', v === 0); });
      const q = Math.round((p.potionCd.left / p.potionCd.duration) * 40);
      setIf('cdQ', q, (v) => drawCd(pot.cd, v / 40));
      world.skills.forEach((s, i) => {
        if (!s) return;
        const f = Math.round((s.cd / (s.max || s.v.cooldown)) * 40);
        setIf('cdS' + i, f, (v) => { drawCd(skillBtns[i].cd, v / 40); skillBtns[i].b.classList.toggle('ready', v === 0); });
      });
      const u = world.ult;
      if (u) setIf('ult', `${Math.floor((u.val / u.need) * 40)}|${!!u.run}`, () => {
        const f = Math.min(1, u.val / u.need), c = ultBtn.cd.getContext('2d');
        c.clearRect(0, 0, 96, 96);
        c.lineWidth = 7; c.strokeStyle = 'rgba(6,8,18,0.7)'; c.beginPath(); c.arc(48, 48, 43, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = getComputedStyle(ultBtn.b).getPropertyValue('--ut') || '#ffb84a'; c.beginPath(); c.arc(48, 48, 43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); c.stroke();
        ultPct.textContent = `${Math.floor(f * 100)}%`;
        ultBtn.b.classList.toggle('ult-ready', f >= 1 && !u.run);
      });
      const rs = world.raceSkill;
      if (rs) setIf('cdR', Math.round((rs.cd / rs.max) * 40), (v) => { drawCd(raceBtn.cd, v / 40); raceBtn.b.classList.toggle('ready', v === 0); });
      // dodge charges: filled pips + refill sweep on the button
      setIf('dodges', p.dodges, (v) => { [...dodgePips.children].forEach((pip, i) => pip.classList.toggle('on', i < v)); dash.b.classList.toggle('empty', v === 0); });
      const refill = p.dodges < p.dodgeMax ? Math.round((p.dodgeRefill / (1.1 * (p.stats.dashCdMult || 1))) * 30) : 0;
      setIf('cdD', p.dodges === 0 ? refill : 0, (v) => drawCd(dash.cd, Math.min(1, v / 30)));
      // combo step of the current weapon
      const step = p.move?.kind === 'combo' ? p.move.step : p.comboTimer > 0 ? p.comboStep : -1;
      setIf('cstep', `${step}|${p.chargeReady}`, () => { [...comboPips.children].forEach((pip, i) => pip.classList.toggle('on', i <= step)); atk.b.classList.toggle('charged', p.chargeReady); });
      const c = world.combo;
      setIf('combo', c.n, (n) => {
        comboBox.hidden = n < 3;
        comboNum.textContent = n;
        const b = comboBonus(n);
        comboBonusTxt.textContent = b > 0 ? `ดาเมจ +${Math.round(b * 100)}%` : '';
        comboBox.classList.toggle('hot', b > 0);
        comboBox.classList.remove('bump'); void comboBox.offsetWidth; comboBox.classList.add('bump');
      });
      // guard meter, parry window and counter window on the shield button
      const g = p.guard;
      if (g) setIf('guard', `${Math.round(g.meter / 5)}|${g.guarding}|${g.breakT > 0}|${g.counterT > 0}`, () => {
        guardMeter.firstChild.style.height = `${(g.breakT > 0 ? 0 : g.meter / GUARD.meterMax) * 100}%`;
        guardBtn.b.classList.toggle('on', g.guarding); guardBtn.b.classList.toggle('broken', g.breakT > 0);
        atk.b.classList.toggle('counter', g.counterT > 0);
      });
      // style rank
      const sr = world.style;
      if (sr) setIf('style', `${sr.rank}|${Math.round(styleProgress(sr) * 20)}|${sr.pts > 0}`, () => {
        const r = styleRank(sr);
        rankBox.hidden = sr.pts <= 0;
        rankLetter.textContent = r.id; rankBox.style.setProperty('--rank', r.color);
        rankName.textContent = r.bonus > 0 ? `${r.name} · +${Math.round(r.bonus * 100)}%` : r.name;
        rankFill.style.width = `${Math.round(styleProgress(sr) * 100)}%`;
        rankBox.dataset.rank = r.id;
      });
      const bf = p.buffs, buffs = [];
      if (bf.focusT > 0) buffs.push('eye'); if (bf.stoneT > 0) buffs.push('hide'); if (bf.bloomT > 0) buffs.push('blood');
      if (bf.ashT > 0) buffs.push('ward'); if (bf.blessT > 0) buffs.push('crown'); if (p.empowerT > 0) buffs.push('crit');
      for (const k of activeBuffs(p)) { const g = BUFF_ICONS[k]; if (g && !buffs.includes(g)) buffs.push(g); }
      if (p.ward > 0 && !buffs.includes('shield')) buffs.push('shield');
      setIf('buffs', buffs.join(','), () => buffRow.replaceChildren(...buffs.map((g) => h('span', { class: `buff b-${g}` }, glyph(g)))));
      const team2 = world.pets || (world.pet ? [world.pet] : []);
      team2.forEach((pt, i) => { if (pt && pt.v.every && petChips[i]) setIf('petcd' + i, Math.round(Math.max(0, pt.cd) / pt.v.every * 10), (v) => petChips[i].el.style.setProperty('--cd', `${Math.min(100, v * 10)}%`)); });
    },
  };
}
