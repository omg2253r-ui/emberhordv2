// Floors of the ten online zones, painted once per room into an offscreen canvas.
// Each theme has its own palette, ground pattern and border, so every zone reads differently at a glance.
import { createRng } from '../core/rng.js';

const TAU = Math.PI * 2;
export const ZONE_THEMES = Object.freeze({
  gale:    { base: '#4f6b3a', light: '#7fa356', dark: '#33472a', wall: '#2b3a22', accent: '#cdf3e6', pattern: 'grass' },
  frost:   { base: '#5c7e96', light: '#a9d4ec', dark: '#33495e', wall: '#22303c', accent: '#e8f8ff', pattern: 'ice' },
  marsh:   { base: '#3d4a2e', light: '#5e6e3a', dark: '#232c1a', wall: '#1c2214', accent: '#b07ad0', pattern: 'marsh' },
  shadow:  { base: '#2e2a38', light: '#4a4258', dark: '#1a1720', wall: '#121016', accent: '#9a8ad0', pattern: 'tiles' },
  dunes:   { base: '#c8a466', light: '#e8cc8e', dark: '#9a7a44', wall: '#7a5c34', accent: '#3f8fb0', pattern: 'dunes' },
  glow:    { base: '#2a2440', light: '#3e3460', dark: '#18142a', wall: '#100c1c', accent: '#9fffd8', pattern: 'moss' },
  foundry: { base: '#4a4e56', light: '#6a707a', dark: '#2c3036', wall: '#1c1f24', accent: '#ffe65a', pattern: 'plates' },
  magma:   { base: '#2a1c18', light: '#4a3028', dark: '#160e0c', wall: '#0e0806', accent: '#ff7a33', pattern: 'lava' },
  sky:     { base: '#d8d2c0', light: '#f4f0e4', dark: '#a8a08a', wall: '#7fa8d0', accent: '#e0b45a', pattern: 'marble' },
  throne:  { base: '#2e2220', light: '#4a3430', dark: '#1a1210', wall: '#0e0a08', accent: '#c2412f', pattern: 'throne' },
  wrath:   { base: '#2a1410', light: '#4a2216', dark: '#140806', wall: '#0a0403', accent: '#ff5a1a', pattern: 'crater' },
  prophecy:{ base: '#1c2140', light: '#2e3866', dark: '#0e1024', wall: '#070814', accent: '#7fe8ff', pattern: 'observatory' },
  judgment:{ base: '#d8cfb4', light: '#f6f0dc', dark: '#a89c78', wall: '#5a4a2a', accent: '#f5c35a', pattern: 'court' },
  mirror:  { base: '#3a4a60', light: '#8aaac8', dark: '#1e2838', wall: '#0e1420', accent: '#bfe8ff', pattern: 'glass' },
  eclipse: { base: '#241c2c', light: '#4a3a50', dark: '#120c18', wall: '#08050c', accent: '#ffb648', pattern: 'eclipse' },
  arena:   { base: '#5a4a3c', light: '#7a6650', dark: '#3a2e24', wall: '#1e1610', accent: '#e0b45a', pattern: 'arena' },
});

export function paintZoneRoom(theme, A, seed = 1) {
  const th = ZONE_THEMES[theme] || ZONE_THEMES.gale;
  const rng = createRng(seed * 977 + 13);
  const c = document.createElement('canvas'); c.width = A.w; c.height = A.h;
  const g = c.getContext('2d');
  g.fillStyle = th.base; g.fillRect(0, 0, A.w, A.h);
  for (let i = 0; i < 50; i++) {
    const x = rng.next() * A.w, y = rng.next() * A.h, r = 60 + rng.next() * 170;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const col = rng.next() < 0.5 ? th.light : th.dark;
    grad.addColorStop(0, col + '77'); grad.addColorStop(1, col + '00');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  PATTERNS[th.pattern]?.(g, A, th, rng);
  // walls: a dark rim with a soft inner shadow
  g.fillStyle = th.wall;
  g.fillRect(0, 0, A.w, A.wall); g.fillRect(0, A.h - A.wall / 2, A.w, A.wall / 2); g.fillRect(0, 0, A.wall / 2, A.h); g.fillRect(A.w - A.wall / 2, 0, A.wall / 2, A.h);
  const sh = g.createLinearGradient(0, A.wall, 0, A.wall + 40); sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(A.wall / 2, A.wall, A.w - A.wall, 40);
  g.strokeStyle = th.accent + '55'; g.lineWidth = 3; g.strokeRect(A.wall / 2 + 4, A.wall + 2, A.w - A.wall - 8, A.h - A.wall * 1.5 - 6);
  return c;
}

const PATTERNS = {
  grass(g, A, th, rng) {
    g.lineCap = 'round';
    for (let i = 0; i < 2400; i++) {
      const x = rng.next() * A.w, y = rng.next() * A.h, h = 6 + rng.next() * 10;
      g.strokeStyle = ['#6f8f45', '#89ad5a', '#4a6334'][i % 3]; g.lineWidth = 1.5 + rng.next();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5 + rng.next() * 4, y - h); g.stroke();       // all bent by the wind
    }
    for (let i = 0; i < 14; i++) { const x = rng.next() * A.w, y = 100 + rng.next() * (A.h - 160); g.strokeStyle = 'rgba(230,255,246,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 40, y - 10, x + 80, y + 10, x + 130, y); g.stroke(); }
    for (let i = 0; i < 7; i++) { const x = 80 + rng.next() * (A.w - 160), y = 120 + rng.next() * (A.h - 220); g.fillStyle = '#6b6a5e'; g.strokeStyle = '#2a2a24'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 16 + rng.next() * 12, 10 + rng.next() * 6, 0, 0, TAU); g.fill(); g.stroke(); }
  },
  ice(g, A, th, rng) {
    for (let y = A.wall; y < A.h; y += 90) for (let x = 0; x < A.w; x += 120) {
      g.fillStyle = `rgba(232,248,255,${0.05 + rng.next() * 0.1})`; g.fillRect(x + 4, y + 4, 112, 82);
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) { let x = rng.next() * A.w, y = rng.next() * A.h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rng.next() - 0.5) * 70; y += (rng.next() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 10; i++) {
      const x = 60 + rng.next() * (A.w - 120), y = rng.next() < 0.5 ? A.wall + 20 : A.h - 40;
      g.fillStyle = '#bfe8ff'; g.strokeStyle = '#2f5a80'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x - 4, y - 40 - rng.next() * 20); g.lineTo(x + 6, y - 10); g.lineTo(x + 12, y - 30); g.lineTo(x + 18, y); g.closePath(); g.fill(); g.stroke();
    }
  },
  marsh(g, A, th, rng) {
    for (let i = 0; i < 16; i++) {
      const x = rng.next() * A.w, y = 100 + rng.next() * (A.h - 160), r = 40 + rng.next() * 70;
      g.fillStyle = 'rgba(40,60,40,0.55)'; g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(110,140,80,0.35)'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.12, r * 0.5, r * 0.22, 0, 0, TAU); g.fill();
    }
    for (let i = 0; i < 22; i++) { const x = rng.next() * A.w, y = rng.next() * A.h; g.fillStyle = '#4f7a3a'; g.strokeStyle = '#1c2a14'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 9, 0.3, TAU - 0.3); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke(); }
    g.strokeStyle = '#6a7a3a'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 60; i++) { const x = rng.next() * A.w, y = A.wall + 10 + (rng.next() < 0.5 ? 0 : A.h - A.wall * 1.6) + rng.next() * 40; g.beginPath(); g.moveTo(x, y + 26); g.lineTo(x + (rng.next() - 0.5) * 8, y); g.stroke(); }
  },
  tiles(g, A, th, rng) {
    for (let y = A.wall; y < A.h; y += 64) for (let x = ((y / 64) % 2) * 32; x < A.w; x += 64) {
      g.fillStyle = rng.next() < 0.15 ? '#24202c' : ['#38324a', '#332e42', '#3d3650'][(rng.next() * 3) | 0];
      g.fillRect(x + 2, y + 2, 60, 60);
      if (rng.next() < 0.12) { g.strokeStyle = 'rgba(10,8,14,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 8, y + 10); g.lineTo(x + 30, y + 34); g.lineTo(x + 52, y + 30); g.stroke(); }
    }
    for (let i = 0; i < 6; i++) { const x = 100 + rng.next() * (A.w - 200), y = 150 + rng.next() * (A.h - 260); g.fillStyle = '#4a4258'; g.strokeStyle = '#121016'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 26, 14, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#5a5070'; g.fillRect(x - 18, y - 30, 36, 26); g.strokeRect(x - 18, y - 30, 36, 26); }
  },
  dunes(g, A, th, rng) {
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const y = A.wall + (i / 40) * (A.h - A.wall), amp = 8 + rng.next() * 10;
      g.strokeStyle = i % 2 ? 'rgba(154,122,68,0.35)' : 'rgba(255,240,200,0.3)'; g.lineWidth = 3;
      g.beginPath(); for (let x = 0; x <= A.w; x += 30) g.lineTo(x, y + Math.sin(x * 0.012 + i) * amp); g.stroke();
    }
    for (let i = 0; i < 5; i++) { const x = 100 + rng.next() * (A.w - 200), y = 150 + rng.next() * (A.h - 260); g.fillStyle = '#e8d2a0'; g.strokeStyle = '#6a5030'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 20, 8, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#d8c090'; g.fillRect(x - 6, y - 26, 12, 22); g.strokeRect(x - 6, y - 26, 12, 22); }
  },
  moss(g, A, th, rng) {
    for (let i = 0; i < 300; i++) { const x = rng.next() * A.w, y = rng.next() * A.h; g.fillStyle = `rgba(159,255,216,${0.08 + rng.next() * 0.3})`; g.beginPath(); g.arc(x, y, 1 + rng.next() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 24; i++) { const x = rng.next() * A.w, y = rng.next() * A.h; g.fillStyle = ['#d06a8a', '#a86ad0', '#6a5aa8'][i % 3]; g.strokeStyle = '#100c1c'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y - 6, 10, 6, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#e8d8c8'; g.fillRect(x - 2, y - 6, 4, 8); }
  },
  plates(g, A, th, rng) {
    for (let y = A.wall; y < A.h; y += 80) for (let x = 0; x < A.w; x += 100) {
      g.fillStyle = ['#50555e', '#4a4e56', '#565b64'][(rng.next() * 3) | 0]; g.fillRect(x + 2, y + 2, 96, 76);
      g.fillStyle = '#2c3036'; for (const [dx, dy] of [[8, 8], [90, 8], [8, 70], [90, 70]]) { g.beginPath(); g.arc(x + dx, y + dy, 3, 0, TAU); g.fill(); }
    }
    g.strokeStyle = '#8a7a3a'; g.lineWidth = 6;
    for (const y of [A.h * 0.38, A.h * 0.72]) { g.beginPath(); g.moveTo(0, y); g.lineTo(A.w, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,230,90,0.18)'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const x = rng.next() * A.w, y = rng.next() * A.h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, y + 8); g.lineTo(x + 8, y + 18); g.lineTo(x + 30, y + 30); g.stroke(); }
  },
  lava(g, A, th, rng) {
    g.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      let x = rng.next() * A.w, y = rng.next() * A.h;
      g.strokeStyle = 'rgba(255,122,51,0.75)'; g.lineWidth = 3 + rng.next() * 3; g.shadowColor = '#ff7a33'; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng.next() - 0.5) * 120; y += (rng.next() - 0.5) * 80; g.lineTo(x, y); } g.stroke();
    }
    g.shadowBlur = 0;
    for (let i = 0; i < 18; i++) { const x = rng.next() * A.w, y = rng.next() * A.h; g.fillStyle = '#3a2a24'; g.strokeStyle = '#0e0806'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 14 + rng.next() * 16, 9 + rng.next() * 8, 0, 0, TAU); g.fill(); g.stroke(); }
  },
  marble(g, A, th, rng) {
    for (let y = A.wall; y < A.h; y += 100) for (let x = 0; x < A.w; x += 100) {
      g.fillStyle = (x / 100 + y / 100) % 2 ? '#e8e2d2' : '#d0c8b4'; g.fillRect(x, y, 100, 100);
      g.strokeStyle = 'rgba(160,150,120,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + rng.next() * 100, y); g.bezierCurveTo(x + 30, y + 40, x + 70, y + 60, x + rng.next() * 100, y + 100); g.stroke();
    }
    g.strokeStyle = '#e0b45a'; g.lineWidth = 4; g.beginPath(); g.ellipse(A.w / 2, A.h / 2 + 20, 300, 200, 0, 0, TAU); g.stroke();
    // the edge of the floating island: clouds below
    for (let i = 0; i < 30; i++) { const x = rng.next() * A.w, y = A.h - 20 + rng.next() * 30; g.fillStyle = 'rgba(244,250,255,0.8)'; g.beginPath(); g.arc(x, y, 20 + rng.next() * 24, 0, TAU); g.fill(); }
  },
  // รังมังกรพิโรธ: basalt crater — scorched rings around the centre, sparse cooled rock, embers
  crater(g, A, th, rng) {
    const cx = A.w / 2, cy = A.h / 2 + 30;
    for (const [r, a] of [[420, 0.22], [300, 0.28], [180, 0.34]]) { g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 26; g.beginPath(); g.ellipse(cx, cy, r, r * 0.62, 0, 0, TAU); g.stroke(); }
    const glow = g.createRadialGradient(cx, cy, 10, cx, cy, 240); glow.addColorStop(0, 'rgba(255,110,40,0.32)'); glow.addColorStop(1, 'rgba(255,110,40,0)');
    g.fillStyle = glow; g.beginPath(); g.ellipse(cx, cy, 260, 170, 0, 0, TAU); g.fill();
    for (let i = 0; i < 14; i++) { const x = 90 + rng.next() * (A.w - 180), y = A.wall + 40 + rng.next() * (A.h - A.wall - 80); if (Math.hypot(x - cx, (y - cy) * 1.5) < 260) continue; g.fillStyle = '#1e100c'; g.strokeStyle = '#050202'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 18, y + 8); g.lineTo(x - 8, y - 12); g.lineTo(x + 12, y - 10); g.lineTo(x + 20, y + 8); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = 'rgba(255,120,50,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 8, y - 12); g.lineTo(x + 2, y + 6); g.stroke(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,${120 + (rng.next() * 80) | 0},60,${0.15 + rng.next() * 0.3})`; g.beginPath(); g.arc(rng.next() * A.w, rng.next() * A.h, 1 + rng.next() * 1.8, 0, TAU); g.fill(); }
  },
  // หอดาว: midnight stone floor, a star chart inlaid in silver, constellations joined by thin lines
  observatory(g, A, th, rng) {
    const cx = A.w / 2, cy = A.h / 2 + 20;
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(220,240,255,${0.08 + rng.next() * 0.35})`; g.beginPath(); g.arc(rng.next() * A.w, rng.next() * A.h, 0.6 + rng.next() * 1.6, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(127,232,255,0.28)'; g.lineWidth = 3;
    for (const r of [360, 250]) { g.beginPath(); g.ellipse(cx, cy, r, r * 0.66, 0, 0, TAU); g.stroke(); }
    g.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a) * 250, cy + Math.sin(a) * 165); g.lineTo(cx + Math.cos(a) * 360, cy + Math.sin(a) * 238); g.stroke(); }
    for (let k = 0; k < 5; k++) {
      let x = 120 + rng.next() * (A.w - 240), y = A.wall + 60 + rng.next() * (A.h - A.wall - 120);
      g.strokeStyle = 'rgba(200,240,255,0.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y);
      const pts = [[x, y]];
      for (let j = 0; j < 4; j++) { x += (rng.next() - 0.5) * 120; y += (rng.next() - 0.5) * 80; g.lineTo(x, y); pts.push([x, y]); }
      g.stroke(); g.fillStyle = '#e8fbff'; for (const [px, py] of pts) { g.beginPath(); g.arc(px, py, 2.4, 0, TAU); g.fill(); }
    }
  },
  // ลานพิพากษา: white marble court, gold inlay, a great balance sigil in the centre
  court(g, A, th, rng) {
    for (let y = A.wall; y < A.h; y += 110) for (let x = 0; x < A.w; x += 110) {
      g.fillStyle = (x / 110 + y / 110) % 2 ? '#efe7d0' : '#ddd3b8'; g.fillRect(x, y, 110, 110);
      g.strokeStyle = 'rgba(150,130,90,0.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + rng.next() * 110, y); g.bezierCurveTo(x + 30, y + 40, x + 80, y + 60, x + rng.next() * 110, y + 110); g.stroke();
    }
    const cx = A.w / 2, cy = A.h / 2 + 20;
    g.strokeStyle = '#d9a83a'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, 300, 200, 0, 0, TAU); g.stroke();
    g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy, 270, 178, 0, 0, TAU); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy - 120); g.lineTo(cx, cy + 90); g.moveTo(cx - 120, cy - 70); g.lineTo(cx + 120, cy - 70); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 120, cy - 70); g.lineTo(cx + s * 150, cy); g.lineTo(cx + s * 90, cy); g.closePath(); g.stroke(); }
    g.fillStyle = 'rgba(255,240,180,0.35)'; g.beginPath(); g.ellipse(cx, cy, 120, 80, 0, 0, TAU); g.fill();
  },
  throne(g, A, th, rng) {
    g.fillStyle = '#5a1c18'; g.fillRect(A.w / 2 - 110, A.wall, 220, A.h);
    g.strokeStyle = '#e0b45a'; g.lineWidth = 4; g.beginPath(); g.moveTo(A.w / 2 - 100, A.wall); g.lineTo(A.w / 2 - 100, A.h); g.moveTo(A.w / 2 + 100, A.wall); g.lineTo(A.w / 2 + 100, A.h); g.stroke();
    for (let y = A.wall + 40; y < A.h; y += 90) { g.fillStyle = '#e0b45a'; g.beginPath(); g.moveTo(A.w / 2, y - 14); g.lineTo(A.w / 2 + 14, y); g.lineTo(A.w / 2, y + 14); g.lineTo(A.w / 2 - 14, y); g.closePath(); g.fill(); }
    for (let i = 0; i < 200; i++) { const x = rng.next() * A.w, y = rng.next() * A.h; g.fillStyle = `rgba(160,150,140,${0.1 + rng.next() * 0.2})`; g.beginPath(); g.arc(x, y, 1 + rng.next() * 2.5, 0, TAU); g.fill(); }
    for (const x of [140, A.w - 140]) for (const y of [200, A.h - 160]) { g.fillStyle = '#3a2e2a'; g.strokeStyle = '#0e0a08'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 30, 16, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(x - 20, y - 70, 40, 66); g.strokeRect(x - 20, y - 70, 40, 66); g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(x, y - 78, 10, 0, TAU); g.fill(); }
  },
  // v8: broken mirror floor — big glass plates with cracks that catch the light
  glass(g, A, th, rng) {
    for (let i = 0; i < 26; i++) {
      const cx = A.wall + rng.next() * (A.w - A.wall * 2), cy = A.wall + rng.next() * (A.h - A.wall * 2), n = 5 + ((rng.next() * 3) | 0), r = 60 + rng.next() * 90;
      g.beginPath();
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + rng.next() * 0.5, rr = r * (0.6 + rng.next() * 0.5); if (k) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); else g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); }
      g.closePath();
      const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, 'rgba(232,246,255,0.16)'); gr.addColorStop(0.5, 'rgba(140,180,220,0.05)'); gr.addColorStop(1, 'rgba(232,246,255,0.12)');
      g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(232,246,255,0.35)'; g.lineWidth = 1.6; g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { let x = rng.next() * A.w, y = rng.next() * A.h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng.next() - 0.5) * 90; y += (rng.next() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  },
  // v8: the eclipse throne — a dark marble floor with gold sun rays from the middle
  eclipse(g, A, th, rng) {
    const cx = A.w / 2, cy = A.h / 2 + 20;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.strokeStyle = i % 2 ? 'rgba(255,182,72,0.08)' : 'rgba(255,210,122,0.14)'; g.lineWidth = i % 2 ? 18 : 6;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * A.w, cy + Math.sin(a) * A.w); g.stroke();
    }
    for (let y = A.wall; y < A.h; y += 110) for (let x = 0; x < A.w; x += 110) { g.strokeStyle = 'rgba(10,6,14,0.35)'; g.lineWidth = 2; g.strokeRect(x, y, 110, 110); }
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,210,122,${0.05 + rng.next() * 0.12})`; g.beginPath(); g.arc(rng.next() * A.w, rng.next() * A.h, 1 + rng.next() * 2, 0, TAU); g.fill(); }
  },
  // v8: the Boss Rush arena — sand inside a ring of stone tiers
  arena(g, A, th, rng) {
    const cx = A.w / 2, cy = A.h / 2 + 20;
    g.strokeStyle = 'rgba(224,180,90,0.3)'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(cx, cy, A.w * 0.38, A.h * 0.34, 0, 0, TAU); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, A.w * 0.12, A.h * 0.1, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(40,28,18,${(0.05 + rng.next() * 0.1).toFixed(2)})`; g.fillRect(rng.next() * A.w, rng.next() * A.h, 3 + rng.next() * 5, 2 + rng.next() * 3); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.fillStyle = '#e0b45a'; g.globalAlpha = 0.35; g.beginPath(); g.arc(cx + Math.cos(a) * A.w * 0.38, cy + Math.sin(a) * A.h * 0.34, 10, 0, TAU); g.fill(); g.globalAlpha = 1; }
  },
};
