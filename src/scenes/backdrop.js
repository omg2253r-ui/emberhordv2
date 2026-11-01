// Paints the arena floor once into an offscreen canvas and scatters scenery for a stage theme.
import { createRng } from '../core/rng.js';

export const THEMES = {
  thornwood: {
    base: '#3a4a2b', light: '#55693a', dark: '#26321d', path: '#6b5a3c', pathEdge: '#4d4130',
    strokes: ['#4f6436', '#5f7a3f', '#334427'], leaves: ['#8a5a2a', '#a8742e', '#6f8a3a'],
    tint: 'rgba(40,24,60,0.16)', fog: 'rgba(255,190,120,0.06)', ambient: '#ffd889',
    border: { top: ['tree0', 'tree1', 'tree2'], side: ['tree0', 'tree1', 'tree2'], bottom: ['bush'] },
    scatter: [['grass', 30], ['flowers', 10], ['mushroom', 7], ['stone', 3], ['log', 2]],
    flat: ['grass', 'flowers', 'mushroom'], solid: { stone: 26, log: 34 },
  },
  cinder: {
    base: '#2e2622', light: '#4a3a30', dark: '#1c1714', path: '#5a4030', pathEdge: '#3e2c22',
    strokes: ['#3a302a', '#4a3e34', '#2a221e'], leaves: ['#ff7a33', '#c4492e', '#5b5450'],
    tint: 'rgba(80,24,10,0.14)', fog: 'rgba(255,120,60,0.06)', ambient: '#ff9a4a',
    border: { top: ['deadTree', 'rockPile'], side: ['rockPile', 'deadTree'], bottom: ['emberRock'] },
    scatter: [['emberRock', 6], ['stone', 4], ['rockPile', 2]],
    flat: [], solid: { stone: 26, emberRock: 24, rockPile: 44 },
  },
};

export function paintGround(themeKey, arena, seed = 7) {
  const th = THEMES[themeKey];
  const rng = createRng(seed);
  const c = document.createElement('canvas');
  c.width = arena.w; c.height = arena.h;
  const g = c.getContext('2d');
  g.fillStyle = th.base; g.fillRect(0, 0, arena.w, arena.h);
  // painterly light / shadow blotches
  for (let i = 0; i < 60; i++) {
    const x = rng.next() * arena.w, y = rng.next() * arena.h, r = 60 + rng.next() * 180;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const col = rng.next() < 0.5 ? th.light : th.dark;
    grad.addColorStop(0, col + '88'); grad.addColorStop(1, col + '00');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // worn clearing in the middle (where fights happen)
  g.save();
  g.translate(arena.w / 2, arena.h / 2 + 20);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i === 0 ? th.pathEdge + '66' : th.path + (i === 1 ? '55' : '44');
    g.beginPath(); g.ellipse(0, 0, arena.w * (0.36 - i * 0.07), arena.h * (0.3 - i * 0.06), 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // grass strokes
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = rng.next() * arena.w, y = rng.next() * arena.h;
    const dx = arena.w / 2 - x, dy = arena.h / 2 - y;
    const inClearing = (dx * dx) / (arena.w * 0.3) ** 2 + (dy * dy) / (arena.h * 0.25) ** 2 < 1;
    if (inClearing && rng.next() < 0.75) continue;
    g.strokeStyle = th.strokes[(rng.next() * th.strokes.length) | 0];
    g.lineWidth = 1.5 + rng.next() * 1.5;
    const h = 5 + rng.next() * 9, lean = (rng.next() - 0.5) * 6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - h); g.stroke();
  }
  // fallen leaves and pebbles
  for (let i = 0; i < 260; i++) {
    const x = rng.next() * arena.w, y = rng.next() * arena.h;
    g.fillStyle = th.leaves[(rng.next() * th.leaves.length) | 0];
    g.save(); g.translate(x, y); g.rotate(rng.next() * 6);
    g.beginPath(); g.ellipse(0, 0, 4 + rng.next() * 3, 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  for (let i = 0; i < 120; i++) {
    g.fillStyle = rng.next() < 0.5 ? '#6c6f62' : '#55584b';
    g.beginPath(); g.arc(rng.next() * arena.w, rng.next() * arena.h, 1.5 + rng.next() * 2.5, 0, Math.PI * 2); g.fill();
  }
  // darken the edges so the playfield reads as a clearing
  const v = g.createRadialGradient(arena.w / 2, arena.h / 2, Math.min(arena.w, arena.h) * 0.35, arena.w / 2, arena.h / 2, Math.max(arena.w, arena.h) * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,8,6,0.5)');
  g.fillStyle = v; g.fillRect(0, 0, arena.w, arena.h);
  return c;
}

// Scenery objects. `tall` ones are depth-sorted with characters; flat ones draw under everything.
export function scatterScenery(themeKey, arena, seed = 11) {
  const th = THEMES[themeKey];
  const rng = createRng(seed);
  const items = [];
  // Border: tall pieces on top/left/right, low pieces along the bottom so characters are never hidden.
  const B = th.border, pick = (arr) => arr[(rng.next() * arr.length) | 0];
  for (let x = -30; x < arena.w + 60; x += 90 + rng.next() * 50) items.push({ key: pick(B.top), x, y: 30 + rng.next() * 30, tall: true, s: 0.9 + rng.next() * 0.35, flip: rng.next() < 0.5 });
  for (let y = 120; y < arena.h; y += 110 + rng.next() * 50) {
    items.push({ key: pick(B.side), x: -10 + rng.next() * 20, y, tall: true, s: 0.85 + rng.next() * 0.3, flip: false });
    items.push({ key: pick(B.side), x: arena.w + 10 - rng.next() * 20, y, tall: true, s: 0.85 + rng.next() * 0.3, flip: true });
  }
  for (let x = 20; x < arena.w; x += 70 + rng.next() * 40) items.push({ key: pick(B.bottom), x, y: arena.h + 12, tall: true, s: 0.9 + rng.next() * 0.3, flip: rng.next() < 0.5 });
  // Scatter inside, mostly away from the clearing centre
  for (const [key, n] of th.scatter) {
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do {
        x = 90 + rng.next() * (arena.w - 180); y = 120 + rng.next() * (arena.h - 200);
        tries++;
      } while (tries < 10 && ((x - arena.w / 2) ** 2) / (arena.w * 0.28) ** 2 + ((y - arena.h / 2) ** 2) / (arena.h * 0.24) ** 2 < 1 && key !== 'grass' && key !== 'flowers');
      const flat = th.flat.includes(key);
      const sc = 0.8 + rng.next() * 0.4;
      items.push({ key, x, y, tall: !flat, s: sc, flip: rng.next() < 0.5, solidR: th.solid[key] ? th.solid[key] * sc : 0 });
    }
  }
  return items;
}

// ---------------------------------------------------------------- dungeon rooms
import { ROOM } from '../data/dungeons.js';
import { doorRect } from '../systems/dungeon.js';

// Paints one room (floor + walls with door gaps) into an offscreen canvas.
export function paintRoom(themeKey, doors, seed = 1) {
  const th = THEMES[themeKey];
  const { w: W, h: H, wall } = ROOM;
  const floor = paintGround(themeKey, { w: W, h: H }, seed);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(floor, 0, 0);
  const rng = createRng(seed * 7 + 3);

  // inner shadow along the walls
  const sh = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; };
  g.fillStyle = sh(0, wall, 0, wall + 70); g.fillRect(0, wall, W, 70);
  g.fillStyle = sh(wall, 0, wall + 50, 0); g.fillRect(wall, 0, 50, H);
  g.fillStyle = sh(W - wall, 0, W - wall - 50, 0); g.fillRect(W - wall - 50, 0, 50, H);

  // wall band
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H); g.rect(wall, wall, W - wall * 2, H - wall * 2);
  for (const d of doors) { const r = doorRect(d.dir); g.rect(r.x, r.y, r.w, r.h); }
  g.clip('evenodd');
  if (themeKey === 'cinder') {
    g.fillStyle = '#2c2522'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const x = rng.next() * W, y = rng.next() * H, r = 10 + rng.next() * 26;
      g.fillStyle = ['#3e3632', '#352e2a', '#4a413c', '#26201d'][(rng.next() * 4) | 0];
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, rng.next() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#1a1412'; g.lineWidth = 2;
    for (let i = 0; i < 70; i++) { const x = rng.next() * W, y = rng.next() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng.next() - 0.5) * 30, y + (rng.next() - 0.5) * 30); g.stroke(); }
    g.strokeStyle = 'rgba(255,122,51,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const x = rng.next() * W, y = rng.next() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 6); g.lineTo(x + 4, y + 14); g.stroke(); }
    // timber supports
    g.fillStyle = '#5a3a22'; g.strokeStyle = '#1a120e'; g.lineWidth = 3;
    for (let x = 120; x < W - 60; x += 220) { g.fillRect(x, 0, 18, wall); g.strokeRect(x, 0, 18, wall); g.fillRect(x, H - wall, 18, wall); g.strokeRect(x, H - wall, 18, wall); }
  } else {
    g.fillStyle = '#1d2a18'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 520; i++) {
      const x = rng.next() * W, y = rng.next() * H, r = 8 + rng.next() * 18;
      g.fillStyle = ['#2c4227', '#34502c', '#253a20', '#3f6236'][(rng.next() * 4) | 0];
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#4a3420'; g.lineWidth = 2.2;
    for (let i = 0; i < 160; i++) {
      const x = rng.next() * W, y = rng.next() * H, a = rng.next() * 6, l = 14 + rng.next() * 20;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      g.fillStyle = '#9fb86a'; g.beginPath(); g.arc(x + Math.cos(a) * l, y + Math.sin(a) * l, 1.6, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#c2412f';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rng.next() * W, rng.next() * H, 2.4, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
  // ink rim where wall meets floor
  g.strokeStyle = 'rgba(10,6,4,0.85)'; g.lineWidth = 4;
  g.strokeRect(wall, wall, W - wall * 2, H - wall * 2);
  // door thresholds
  for (const d of doors) {
    const r = doorRect(d.dir);
    g.fillStyle = themeKey === 'cinder' ? '#3a2c22' : '#5a4a30';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    if (d.dir === 'N') g.fillRect(r.x, r.y, r.w, 14); else if (d.dir === 'S') g.fillRect(r.x, r.y + r.h - 14, r.w, 14);
    else if (d.dir === 'W') g.fillRect(r.x, r.y, 14, r.h); else g.fillRect(r.x + r.w - 14, r.y, 14, r.h);
  }
  return c;
}

// Decorative props inside a room, kept away from the centre lane, objects and traps.
export function decorateRoom(themeKey, roomDef, seed = 1) {
  const rng = createRng(seed * 13 + 1);
  const { w: W, h: H, wall } = ROOM;
  const items = [];
  const avoid = [roomDef.chest, roomDef.lore, roomDef.bonfire].filter(Boolean).map((o) => ({ x: o.x * W, y: o.y * H }));
  for (const t of roomDef.traps || []) if (t.w) avoid.push({ x: (t.x + t.w / 2) * W, y: (t.y + t.h / 2) * H, r: Math.max(t.w * W, t.h * H) / 2 + 40 });
  const free = (x, y) => avoid.every((a) => Math.hypot(a.x - x, a.y - y) > (a.r || 110)) && Math.abs(x - W / 2) > 120 && Math.abs(y - H / 2) > 90;
  const pool = themeKey === 'cinder'
    ? [['emberRock', 3, true], ['stone', 2, true], ['rockPile', 1, true]]
    : [['grass', 10, false], ['flowers', 4, false], ['mushroom', 3, false], ['stone', 2, true], ['bush', 1, true]];
  const solids = { stone: 24, emberRock: 22, rockPile: 40, bush: 30 };
  for (const [key, n, tall] of pool) for (let i = 0; i < n; i++) {
    for (let k = 0; k < 12; k++) {
      const x = wall + 50 + rng.next() * (W - wall * 2 - 100), y = wall + 60 + rng.next() * (H - wall * 2 - 100);
      if (!free(x, y)) continue;
      const s = 0.75 + rng.next() * 0.35;
      items.push({ key, x, y, tall, s, flip: rng.next() < 0.5, solidR: tall && solids[key] ? solids[key] * s : 0 });
      avoid.push({ x, y, r: 70 });
      break;
    }
  }
  // tall pieces peeking over the north wall give the room depth
  const north = themeKey === 'cinder' ? ['deadTree', 'rockPile'] : ['tree0', 'tree1', 'tree2'];
  for (let x = 40; x < W; x += 120 + rng.next() * 60) {
    if (Math.abs(x - W / 2) < ROOM.door * 0.8) continue;
    items.push({ key: north[(rng.next() * north.length) | 0], x, y: wall - 6, tall: true, s: 0.75 + rng.next() * 0.25, flip: rng.next() < 0.5, solidR: 0, backdrop: true });
  }
  return items;
}
