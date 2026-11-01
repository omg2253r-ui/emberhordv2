// Ember Crossing (หมู่บ้านทางแยกถ่าน): the online hub. Every player whose presence says zone "village" walks
// here; positions arrive as presence (~10×/s) and are smoothed. Tap or press E near someone to open their card
// (friend / party / duel). The gate at the bottom leads back to camp, the notice board explains the online rules.
import { drawHero } from '../battle/heroDraw.js';
import { getItem } from '../data/items.js';
import { getWeaponType } from '../data/weapons.js';
import { teamOf } from '../systems/pets.js';
import { drawTitleLine } from '../ui/nameplate.js';
import { badgeTier } from '../data/titles.js';
import { getPet } from '../data/pets.js';

export const VILLAGE = Object.freeze({
  w: 2000, h: 1300,
  spawn: { x: 1000, y: 1010 },
  fountain: { x: 1000, y: 640 },
  gate: { x: 1000, y: 1262 },
  ring: { x: 1640, y: 700 },
  board: { x: 760, y: 900 },
  rift: { x: 380, y: 1090 },
  chief: { x: 1240, y: 486 },
  speed: 270,
  sendEvery: 0.1,
  talkRange: 110,
});

const V = VILLAGE;
const V_RIFT = VILLAGE.rift;

// [sprite, x, y, collider] — colliders: {r} circle at the anchor, or {w, h} box whose bottom edge sits at the anchor.
const DECOR = [
  ['v_house_red', 520, 330, { w: 190, h: 90 }], ['v_house_gold', 1000, 300, { w: 190, h: 90 }], ['v_house_teal', 1480, 330, { w: 190, h: 90 }],
  ['v_stall_fruit', 330, 600, { w: 120, h: 40 }], ['v_stall_trinket', 330, 820, { w: 120, h: 40 }],
  ['v_banner_red', 1430, 560, { r: 12 }], ['v_banner_teal', 1850, 560, { r: 12 }], ['v_banner_red', 1430, 860, { r: 12 }], ['v_banner_teal', 1850, 860, { r: 12 }],
  ['v_board', V.board.x, V.board.y, { w: 110, h: 24 }],
  ['v_forge', V.chief.x + 120, V.chief.y - 6, { w: 150, h: 30 }],
  ['v_gate', V.gate.x, V.gate.y, null],
  ['lantern', 860, 1100, { r: 10 }], ['lantern', 1140, 1100, { r: 10 }], ['lantern', 700, 640, { r: 10 }], ['lantern', 1300, 640, { r: 10 }],
  ['v_rift', V_RIFT.x, V_RIFT.y, { w: 150, h: 24 }], ['crates', 160, 900, { r: 40 }], ['crates', 1760, 1080, { r: 40 }],
  ['tree0', 120, 300, { r: 30 }], ['tree1', 1880, 300, { r: 30 }], ['tree2', 160, 1150, { r: 30 }], ['tree0', 1850, 1180, { r: 30 }],
  ['tree1', 760, 160, { r: 30 }], ['tree2', 1240, 160, { r: 30 }], ['tree0', 1980, 760, { r: 30 }], ['tree1', 30, 720, { r: 30 }],
  ['bush', 640, 1180, { r: 24 }], ['bush', 1360, 1180, { r: 24 }], ['bush', 200, 470, { r: 24 }], ['bush', 1800, 450, { r: 24 }],
  ['flowers', 860, 520, null], ['flowers', 1150, 760, null], ['flowers', 470, 1050, null], ['flowers', 1550, 1020, null],
];

export function blocked(x, y, r = 18) {
  if (x < 60 + r || x > V.w - 60 - r || y < 360 + r * 0.5 || y > V.h - 40) return true;
  // fountain basin (ellipse)
  const fx = (x - V.fountain.x) / (104 + r), fy = (y - (V.fountain.y - 12)) / (40 + r * 0.6);
  if (fx * fx + fy * fy < 1) return true;
  for (const [, dx, dy, c] of DECOR) {
    if (!c) continue;
    if (c.r && Math.hypot(x - dx, y - dy) < c.r + r) return true;
    if (c.w && x > dx - c.w / 2 - r && x < dx + c.w / 2 + r && y > dy - c.h - r * 0.5 && y < dy + r * 0.5) return true;
  }
  if (Math.hypot(x - V.chief.x, (y - V.chief.y) * 1.6) < 26 + r) return true;
  // gate posts
  for (const px of [V.gate.x - 78, V.gate.x + 78]) if (Math.abs(x - px) < 16 + r && y > V.gate.y - 30) return true;
  return false;
}

export function createVillageScene(app) {
  const { renderer, input, sprites, audio } = app;
  const ctx = renderer.ctx;
  let w = null;
  let ground = null;

  function paintGround() {
    const c = document.createElement('canvas'); c.width = V.w; c.height = V.h;
    const g = c.getContext('2d');
    // dusk meadow
    const sky = g.createLinearGradient(0, 0, 0, V.h);
    sky.addColorStop(0, '#2a3a26'); sky.addColorStop(1, '#2f3d27');
    g.fillStyle = sky; g.fillRect(0, 0, V.w, V.h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = ['rgba(70,96,52,0.35)', 'rgba(36,52,30,0.4)', 'rgba(96,120,64,0.25)'][i % 3];
      const x = rnd() * V.w, y = rnd() * V.h; g.fillRect(x, y, 2 + rnd() * 5, 2 + rnd() * 4);
    }
    // back wall: a low stone wall behind the houses
    g.fillStyle = '#1f2a1c'; g.fillRect(0, 0, V.w, 220);
    // dirt paths
    g.strokeStyle = '#6b5a40'; g.lineCap = 'round';
    const path = (pts, wdt) => { g.lineWidth = wdt; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke(); };
    path([[V.fountain.x, V.fountain.y], [V.gate.x, V.h]], 150);
    path([[V.fountain.x, V.fountain.y], [300, 700]], 120);
    path([[V.fountain.x, V.fountain.y], [V.ring.x, V.ring.y]], 120);
    path([[520, 340], [V.fountain.x, V.fountain.y], [1480, 340]], 90);
    path([[V.fountain.x, V.fountain.y], [1000, 320]], 100);
    // cobbled plaza
    g.fillStyle = '#7a6b58'; g.beginPath(); g.ellipse(V.fountain.x, V.fountain.y + 30, 400, 260, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5a4c3c'; g.lineWidth = 6; g.stroke();
    for (let i = 0; i < 1300; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
      const x = V.fountain.x + Math.cos(a) * rr * 390, y = V.fountain.y + 30 + Math.sin(a) * rr * 250;
      g.fillStyle = ['#8a7a64', '#6d604f', '#93836b'][i % 3];
      g.strokeStyle = 'rgba(40,30,22,0.55)'; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(x - 9, y - 6, 16 + rnd() * 6, 10 + rnd() * 4, 3); g.fill(); g.stroke();
    }
    // the duel ring is part of the ground
    const ring = sprites.v_duel_ring;
    if (ring) g.drawImage(ring.canvas, V.ring.x - ring.ax * 1.3, V.ring.y - ring.ay * 1.3, ring.w * 1.3, ring.h * 1.3);
    g.font = '400 22px "Chonburi", serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(245,212,138,0.55)';
    g.fillText('ลานประลอง', V.ring.x, V.ring.y + 160);
    ground = c;
  }

  // ------------------------------------------------------------ remote players
  function syncRemote(dt) {
    const seen = new Set();
    for (const x of app.online.peers) {
      if (x.p.zone !== 'village') continue;
      seen.add(x.peer);
      let r = w.remote.get(x.peer);
      if (!r) { r = { peer: x.peer, x: x.p.x, y: x.p.y, walkT: 0, petX: x.p.x - 50, petY: x.p.y, fade: 0 }; w.remote.set(x.peer, r); }
      r.p = x.p; r.by = x.by;
      const k = Math.min(1, dt * 10);
      const jump = Math.hypot(x.p.x - r.x, x.p.y - r.y) > 400;   // teleport rather than skate across the map
      r.x = jump ? x.p.x : r.x + (x.p.x - r.x) * k;
      r.y = jump ? x.p.y : r.y + (x.p.y - r.y) * k;
      r.moving = x.p.moving; r.flip = x.p.flip; r.dash = x.p.dash;
      if (r.moving) r.walkT += dt * 10;
      r.fade = Math.min(1, r.fade + dt * 3);
      followPet(r, dt);
    }
    for (const k of [...w.remote.keys()]) if (!seen.has(k)) w.remote.delete(k);
  }

  // up to three pets trail behind each hero, each in its own spot
  const PET_SPOTS = [[54, 6], [86, -22], [78, 34]];
  function followPet(o, dt) {
    o.petPos ||= PET_SPOTS.map(() => ({ x: o.petX ?? o.x, y: o.petY ?? o.y }));
    PET_SPOTS.forEach(([dx, dy], i) => {
      const q = o.petPos[i], tx = o.x + (o.flip ? dx : -dx), ty = o.y + dy;
      const d = Math.hypot(tx - q.x, ty - q.y);
      if (d > 6) { const k = Math.min(1, dt * (4 - i * 0.6)); q.x += (tx - q.x) * k; q.y += (ty - q.y) * k; }
    });
    o.petX = o.petPos[0].x; o.petY = o.petPos[0].y;
  }

  // ------------------------------------------------------------ my hero
  function move(dt, intent) {
    const p = w.me;
    let mx = intent.mx, my = intent.my;
    if (w.walkTo) {
      const dx = w.walkTo.x - p.x, dy = w.walkTo.y - p.y, d = Math.hypot(dx, dy);
      if (d < 8 || mx || my) w.walkTo = null; else { mx = dx / d; my = dy / d; }
    }
    if (intent.dash && p.dashCd <= 0 && (mx || my)) { p.dashT = 0.18; p.dashCd = 0.6; p.dashDir = Math.atan2(my, mx); audio.play('dash'); }
    p.dashCd -= dt;
    let vx = mx * V.speed, vy = my * V.speed;
    if (p.dashT > 0) { p.dashT -= dt; vx = Math.cos(p.dashDir) * 720; vy = Math.sin(p.dashDir) * 720; }
    const nx = p.x + vx * dt, ny = p.y + vy * dt;
    if (!blocked(nx, p.y)) p.x = nx; else if (w.walkTo) w.walkTo = null;
    if (!blocked(p.x, ny)) p.y = ny; else if (w.walkTo) w.walkTo = null;
    p.moving = Math.hypot(vx, vy) > 10;
    if (p.moving) { p.walkT += dt * 10; if (Math.abs(vx) > 5) p.flip = vx < 0; }
    p.vx = vx;
    followPet(p, dt);
  }

  function publishMe(force) {
    const p = w.me;
    const snap = { z: 'village', x: Math.round(p.x), y: Math.round(p.y), f: p.flip ? 1 : 0, m: p.moving ? 1 : 0, d: p.dashT > 0 ? 1 : 0 };
    const key = `${snap.x},${snap.y},${snap.f},${snap.m},${snap.d}`;
    if (!force && key === w.lastKey) return;
    w.lastKey = key;
    app.online.publish(snap);
  }

  // ------------------------------------------------------------ interaction
  function nearestTarget() {
    const p = w.me;
    let best = null, bd = V.talkRange;
    for (const r of w.remote.values()) {
      const d = Math.hypot(r.x - p.x, r.y - p.y);
      if (d < bd) { bd = d; best = { kind: 'player', r }; }
    }
    if (best) return best;
    if (Math.hypot(p.x - V.gate.x, p.y - (V.gate.y - 40)) < 120) return { kind: 'gate' };
    if (Math.hypot(p.x - V.board.x, p.y - (V.board.y + 20)) < 110) return { kind: 'board' };
    if (Math.hypot((p.x - V.ring.x) / 1.6, p.y - V.ring.y) < 130) return { kind: 'ring' };
    if (Math.hypot(p.x - V.rift.x, p.y - (V.rift.y - 20)) < 130) return { kind: 'rift' };
    if (Math.hypot(p.x - V.chief.x, p.y - V.chief.y) < 120) return { kind: 'chief' };
    return null;
  }
  function labelFor(t) {
    if (!t) return null;
    if (t.kind === 'player') return `ดูข้อมูล ${t.r.p.name}`;
    if (t.kind === 'gate') return 'กลับค่าย';
    if (t.kind === 'ring') return 'ลานประลอง: ห้อง PvP';
    if (t.kind === 'rift') return 'ประตูมิติ: ดันเจี้ยนรวม';
    if (t.kind === 'chief') return 'คุยกับหัวหน้าหมู่บ้าน: แบบแปลนและตีอาวุธ';
    return 'อ่านกระดานประกาศ';
  }
  function activate(t) {
    if (!t) return;
    audio.play('click');
    if (t.kind === 'player') app.village.openPlayer(t.r.peer);
    else if (t.kind === 'gate') app.leaveVillage();
    else if (t.kind === 'ring') app.village.openRooms();
    else if (t.kind === 'rift') app.openZones();
    else if (t.kind === 'chief') app.openCrafting();
    else app.village.openBoard();
  }

  // tap / click on the map: on a hero opens the card, elsewhere walks there
  function onPointer(e) {
    if (!w || app.village.blocking()) return;
    const rect = renderer.ctx.canvas.getBoundingClientRect();
    const pt = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    let hit = null, bd = 60;
    for (const r of w.remote.values()) {
      const d = Math.hypot(r.x - pt.x, (r.y - 50) - pt.y);
      if (d < bd) { bd = d; hit = r; }
    }
    if (hit) { audio.play('click'); app.village.openPlayer(hit.peer); return; }
    if (Math.hypot(pt.x - V.board.x, pt.y - (V.board.y - 70)) < 80) { activate({ kind: 'board' }); return; }
    if (Math.hypot(pt.x - V.chief.x, pt.y - (V.chief.y - 70)) < 70) { activate({ kind: 'chief' }); return; }
    if (!blocked(pt.x, pt.y)) w.walkTo = { x: pt.x, y: pt.y, t: 0 };
  }

  // ------------------------------------------------------------ frame
  function update(dt) {
    if (!w) return;
    w.time += dt;
    const intent = input.poll();
    if (app.village.blocking()) { intent.mx = 0; intent.my = 0; intent.dash = false; intent.interact = false; }
    move(dt, intent);
    syncRemote(dt);
    w.sendAcc += dt;
    if (w.sendAcc >= V.sendEvery) { w.sendAcc = 0; publishMe(false); }
    w.heartbeat += dt;
    if (w.heartbeat > 5) { w.heartbeat = 0; publishMe(true); }
    w.target = nearestTarget();
    app.hud.setInteract(labelFor(w.target));
    if (intent.interact) activate(w.target);
    if (intent.pause) app.village.toggleMenu();
    // chat bubbles live 6 s
    for (const [k, b] of w.bubbles) if (w.time - b.t > 6) w.bubbles.delete(k);
    // ambience
    if (Math.random() < dt * 14) app.particles.spawn({ x: V.fountain.x + (Math.random() - 0.5) * 60, y: V.fountain.y - 80, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, life: 0.8, size: 2.2, size2: 0.4, color: '#bfe3ff', drag: 0.6, glow: true });
    if (Math.random() < dt * 3) app.particles.spawn({ x: Math.random() * V.w, y: 400 + Math.random() * (V.h - 400), vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 10, life: 3, size: 2.4, size2: 0.6, color: '#ffe89a', drag: 0.1, glow: true });
    app.particles.update(dt);
    renderer.update(dt);
    // camera follows the hero, clamped to the map
    const v = renderer.view, cam = renderer.cam;
    cam.zoom = Math.max(0.55, Math.min(1.05, app.touch ? Math.min(v.w / 560, v.h / 560) : Math.min(v.w / 1150, v.h / 720)));
    const halfW = v.w / 2 / cam.zoom, halfH = v.h / 2 / cam.zoom;
    const clamp = (val, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, val)));
    const tx = clamp(w.me.x, halfW, V.w - halfW), ty = clamp(w.me.y - 40, halfH, V.h - halfH);
    const k = Math.min(1, dt * 6);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }

  function partsFor(o, isMe) {
    if (isMe) return { parts: sprites.heroParts, weapon: sprites.weapon, type: getWeaponType(getItem(app.store.get().equipment.weapon.id)?.wtype) };
    const wid = getItem(o.p.weapon) ? o.p.weapon : 'w_rust_blade';
    return { parts: app.heroPartsFor(o.p.armor, o.p.race, o.p.wings), weapon: sprites['weapon_' + wid], type: getWeaponType(getItem(wid)?.wtype) };
  }

  function drawPets(o, ids) {
    (ids || []).forEach((petId, i) => {
      const pet = getPet(petId), q = o.petPos?.[i];
      if (!pet || !sprites[pet.sprite] || !q) return;
      const s = sprites[pet.sprite], fly = pet.flying;
      const z = fly ? 40 + Math.sin(w.time * 3 + o.x * 0.01 + i) * 6 : 0;
      ctx.fillStyle = 'rgba(12,8,6,0.3)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, s.w * 0.25, 5, 0, 0, Math.PI * 2); ctx.fill();
      renderer.sprite(s, q.x, q.y - z, { sx: 0.75 * (o.flip ? -1 : 1), sy: 0.75 });
    });
  }

  function drawPerson(o, isMe) {
    const { parts, weapon, type } = partsFor(o, isMe);
    ctx.globalAlpha = isMe ? 1 : o.fade;
    ctx.fillStyle = 'rgba(12,8,6,0.4)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawHero(renderer, parts, weapon, { x: o.x, y: o.y, flip: o.flip, time: w.time, walkT: o.walkT, moving: o.moving, type, scale: 0.9, dashing: isMe ? o.dashT > 0 : o.dash, vx: o.vx || 0, speed: V.speed, alpha: isMe ? 1 : o.fade });
    ctx.globalAlpha = 1;
  }

  function tag(o, isMe) {
    const st = app.store.get();
    const name = isMe ? st.story.name : o.p.name;
    const lv = isMe ? st.player.level : o.p.lv;
    const party = app.online.party;
    const inParty = !isMe && party && party.members.some((m) => m.peer === o.peer);
    const friend = !isMe && o.by && st.social.friends[o.by];
    ctx.font = '700 14px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const gtag = isMe ? st.guild?.tag : o.p.gtag;
    const label = `${gtag ? `[${gtag}] ` : ''}${name}  Lv.${lv}`;
    const y = o.y - 108;
    ctx.lineWidth = 4; ctx.strokeStyle = '#120c09';
    ctx.fillStyle = isMe ? '#f5d48a' : inParty ? '#9fe0a0' : friend ? '#bfe3ff' : '#f3e6c8';
    ctx.strokeText(label, o.x, y); ctx.fillText(label, o.x, y);
    const up = drawTitleLine(ctx, o.x, y - 16, isMe ? st.titles?.equipped : o.p.title, isMe ? badgeTier(st) : o.p.badge);
    if (!isMe && o.p.busy) { ctx.font = '600 11px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillStyle = '#ffb3a4'; ctx.strokeText(busyText(o.p.busy), o.x, y - 16 - up); ctx.fillText(busyText(o.p.busy), o.x, y - 16 - up); }
    // chat bubble
    const b = w.bubbles.get(isMe ? 'me' : o.peer);
    if (b) bubble(o.x, y - (o.p?.busy ? 34 : 20) - up, b.text, Math.min(1, (6 - (w.time - b.t)) * 2));
  }
  function busyText(b) { return b === 'duel' ? 'กำลังประลอง' : b === 'hunt' ? 'กำลังล่า' : b === 'trade' ? 'กำลังแลกเปลี่ยน' : ''; }

  function bubble(x, y, text, alpha) {
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = '600 14px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const words = Array.from(text);
    const lines = []; let cur = '';
    for (const ch of words) { if (ctx.measureText(cur + ch).width > 220) { lines.push(cur); cur = ch; } else cur += ch; if (lines.length === 3) break; }
    if (lines.length < 3 && cur) lines.push(cur);
    const wd = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20, ht = lines.length * 19 + 12;
    const bx = x - wd / 2, by = y - ht - 8;
    ctx.fillStyle = 'rgba(243,230,200,0.96)'; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, wd, ht, 8); ctx.moveTo(x - 6, by + ht); ctx.lineTo(x, by + ht + 8); ctx.lineTo(x + 6, by + ht); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1a10';
    lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 16 + i * 19));
    ctx.restore();
  }

  function render() {
    if (!w) return;
    const v = renderer.view;
    renderer.screenSpace();
    ctx.fillStyle = '#16200f'; ctx.fillRect(0, 0, v.w, v.h);
    renderer.worldSpace();
    if (!ground) paintGround();
    ctx.drawImage(ground, 0, 0);
    // walk-to marker
    if (w.walkTo) { ctx.strokeStyle = 'rgba(245,212,138,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(w.walkTo.x, w.walkTo.y, 16 + Math.sin(w.time * 8) * 3, 7, 0, 0, Math.PI * 2); ctx.stroke(); }
    // y-sorted world
    const list = [];
    for (const [key, x, y] of DECOR) if (sprites[key]) list.push({ y, draw: () => renderer.sprite(sprites[key], x, y) });
    list.push({ y: V.fountain.y + 10, draw: drawFountain });
    list.push({ y: V.chief.y, draw: drawChief });
    list.push({ y: w.me.y, draw: () => { drawPets(w.me, teamOf(app.store.get())); drawPerson(w.me, true); } });
    for (const r of w.remote.values()) list.push({ y: r.y, draw: () => { drawPets(r, r.p.pets); drawPerson(r, false); } });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.draw();
    // lantern glow
    ctx.globalCompositeOperation = 'lighter';
    for (const [key, x, y] of DECOR) {
      if (key !== 'lantern') continue;
      const g = ctx.createRadialGradient(x + 33, y - 110, 2, x + 33, y - 110, 70);
      g.addColorStop(0, 'rgba(255,210,140,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 33, y - 110, 70, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    app.particles.draw(ctx);
    tag(w.me, true);
    for (const r of w.remote.values()) tag(r, false);
    // highlight the current interaction target
    if (w.target?.kind === 'player') { const r = w.target.r; ctx.strokeStyle = 'rgba(245,212,138,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(r.x, r.y, 30, 11, 0, 0, Math.PI * 2); ctx.stroke(); }
    renderer.screenSpace();
    if (app.vignette) ctx.drawImage(app.vignette, 0, 0, v.w, v.h);
  }

  // the chief breathes, turns toward a nearby hero, and his forge glows
  function drawChief() {
    const c = V.chief, spr = sprites.v_chief;
    if (!spr) return;
    const fx = c.x + 120, fy = c.y - 40;
    const g = ctx.createRadialGradient(fx - 45, fy, 2, fx - 45, fy, 70);
    g.addColorStop(0, `rgba(255,150,70,${(0.35 + 0.12 * Math.sin(w.time * 5)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,120,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx - 45, fy, 70, 0, Math.PI * 2); ctx.fill();
    const face = w.me.x < c.x ? -1 : 1, breathe = 1 + Math.sin(w.time * 2) * 0.015;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(face, breathe); ctx.drawImage(spr.canvas, -spr.ax, -spr.ay, spr.w, spr.h); ctx.restore();
    if (Math.random() < 0.08) app.particles.spawn({ x: fx - 45 + (Math.random() - 0.5) * 30, y: fy + 4, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 40, life: 0.7, size: 2, size2: 0.4, color: '#ffcf5a', drag: 0.8, glow: true });
    ctx.font = '700 15px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,9,0.85)'; ctx.fillStyle = '#ffd08a';
    ctx.strokeText('หัวหน้าหมู่บ้าน', c.x, c.y - 178); ctx.fillText('หัวหน้าหมู่บ้าน', c.x, c.y - 178);
    if (w.target?.kind === 'chief') { ctx.strokeStyle = 'rgba(245,212,138,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, 36, 12, 0, 0, Math.PI * 2); ctx.stroke(); }
  }

  function drawFountain() {
    renderer.sprite(sprites.v_fountain, V.fountain.x, V.fountain.y + 10);
    // water shimmer
    ctx.fillStyle = `rgba(191,227,255,${0.15 + 0.1 * Math.sin(w.time * 3)})`;
    ctx.beginPath(); ctx.ellipse(V.fountain.x - 10, V.fountain.y - 18, 60, 12, 0, 0, Math.PI * 2); ctx.fill();
  }

  return {
    enter() {
      app.particles.clear();
      app.refreshHeroSprites();
      const at = { ...V.spawn };
      w = {
        time: 0, sendAcc: 0, heartbeat: 0, lastKey: '', target: null, walkTo: null, bubbles: new Map(), remote: new Map(),
        me: { x: at.x + (Math.random() - 0.5) * 360, y: at.y + (Math.random() - 0.5) * 60, flip: false, moving: false, walkT: 0, dashT: 0, dashCd: 0, vx: 0, petX: at.x - 50, petY: at.y },
        unsub: [],
      };
      w.unsub.push(app.online.on('chat', (line) => { if (line.ch === 'village' || line.ch === 'party') w.bubbles.set(line.me ? 'me' : line.peer, { text: line.text, t: w.time }); }));
      renderer.ctx.canvas.addEventListener('pointerdown', onPointer);
      renderer.cam.x = w.me.x; renderer.cam.y = w.me.y;
      input.setEnabled(true); input.reset();
      app.hud.showVillage();
      audio.music('village');
      publishMe(true);
    },
    exit() {
      if (w) for (const u of w.unsub) u();
      renderer.ctx.canvas.removeEventListener('pointerdown', onPointer);
      input.setEnabled(false); app.hud.hide(); app.hud.setMode('dungeon'); audio.stopMusic();
      w = null;
    },
    update, render,
    get world() { return w; },
    // read-only view for tests
    snapshot() {
      if (!w) return null;
      return { me: { x: Math.round(w.me.x), y: Math.round(w.me.y) }, remote: [...w.remote.values()].map((r) => ({ peer: r.peer, name: r.p.name, x: Math.round(r.x), y: Math.round(r.y), race: r.p.race, weapon: r.p.weapon })), target: w.target?.kind || null, bubbles: w.bubbles.size };
    },
    teleport(x, y) { if (w && !blocked(x, y)) { w.me.x = x; w.me.y = y; } },
  };
}
