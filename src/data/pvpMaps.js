// PvP arenas (v8): five places built for duelling, each with its own cover and its own danger. Every match picks one
// from its channel name, so both players (and anyone watching) always stand in the same place.
//   solids  pillars (circle: x, y, r) and walls (rect: x, y, w, h) — block movement and shots, good to break line of sight
//   hazards lava (rect / circle): burns 4% of max HP every half second · void (circle): fall in = back to your corner,
//           −12% HP · ice (rect): slippery, a run keeps sliding
// Positions are fractions of the arena; the spawn columns (outer 18% left and right) are always clear.
export const PVP_ARENA = Object.freeze({
  '1v1': { w: 1560, h: 980, wall: 70 },
  '2v2': { w: 1860, h: 1120, wall: 70 },
  '3v3': { w: 2160, h: 1260, wall: 70 },
});

export const PVP_MAPS = Object.freeze([
  { id: 'colosseum', name: 'โคลอสเซียมถ่านเพลิง', desc: 'ลานกว้างคลาสสิก เสาหินสี่ต้นให้หลบหลังได้',
    floor: ['#6b5a48', '#3a2e25'], edge: '#2a221d', accent: 'rgba(224,180,90,0.35)',
    solids: [{ k: 'pillar', x: 0.36, y: 0.32, r: 0.032 }, { k: 'pillar', x: 0.64, y: 0.32, r: 0.032 }, { k: 'pillar', x: 0.36, y: 0.72, r: 0.032 }, { k: 'pillar', x: 0.64, y: 0.72, r: 0.032 }],
    hazards: [] },
  { id: 'ruins', name: 'ซากวิหารร้าง', desc: 'กำแพงพังเป็นช่วงๆ ใช้บังลูกศรและเวท ไล่ล่ากันรอบกำแพง',
    floor: ['#5a6070', '#262a36'], edge: '#1c1f28', accent: 'rgba(170,190,255,0.3)',
    solids: [{ k: 'wall', x: 0.3, y: 0.22, w: 0.12, h: 0.05 }, { k: 'wall', x: 0.58, y: 0.22, w: 0.12, h: 0.05 }, { k: 'wall', x: 0.47, y: 0.42, w: 0.06, h: 0.2 },
      { k: 'wall', x: 0.3, y: 0.76, w: 0.12, h: 0.05 }, { k: 'wall', x: 0.58, y: 0.76, w: 0.12, h: 0.05 }, { k: 'pillar', x: 0.37, y: 0.5, r: 0.025 }, { k: 'pillar', x: 0.63, y: 0.5, r: 0.025 }],
    hazards: [] },
  { id: 'lava', name: 'สะพานลาวา', desc: 'ธารลาวาไหลผ่านกลางสนาม ข้ามได้แค่สะพานสามสาย ยืนในลาวา = ไหม้',
    floor: ['#5a3a2a', '#24120c'], edge: '#1a0c08', accent: 'rgba(255,138,61,0.4)',
    solids: [{ k: 'rock', x: 0.3, y: 0.3, r: 0.03 }, { k: 'rock', x: 0.7, y: 0.7, r: 0.03 }],
    hazards: [{ k: 'lava', x: 0.43, y: 0.06, w: 0.14, h: 0.18 }, { k: 'lava', x: 0.43, y: 0.32, w: 0.14, h: 0.14 }, { k: 'lava', x: 0.43, y: 0.56, w: 0.14, h: 0.14 }, { k: 'lava', x: 0.43, y: 0.78, w: 0.14, h: 0.16 }] },
  { id: 'sky', name: 'ลานเทวาลัยลอยฟ้า', desc: 'ลานหินลอยกลางเมฆ มีหลุมว่างเปล่าให้ร่วงลงไป ระวังเท้าระหว่างหลบ',
    floor: ['#c8d0e0', '#5a6a88'], edge: '#3a4660', accent: 'rgba(255,243,160,0.45)',
    solids: [{ k: 'pillar', x: 0.5, y: 0.2, r: 0.028 }, { k: 'pillar', x: 0.5, y: 0.82, r: 0.028 }],
    hazards: [{ k: 'void', x: 0.36, y: 0.5, r: 0.06 }, { k: 'void', x: 0.64, y: 0.5, r: 0.06 }, { k: 'void', x: 0.5, y: 0.5, r: 0.045 }] },
  { id: 'frost', name: 'ทะเลสาบน้ำแข็ง', desc: 'ใจกลางเป็นน้ำแข็งลื่น วิ่งแล้วไถลต่อ แท่งน้ำแข็งให้บังตัว',
    floor: ['#8fb8d8', '#2a4a68'], edge: '#1c3048', accent: 'rgba(220,240,255,0.5)',
    solids: [{ k: 'crystal', x: 0.33, y: 0.38, r: 0.026 }, { k: 'crystal', x: 0.67, y: 0.62, r: 0.026 }, { k: 'crystal', x: 0.5, y: 0.25, r: 0.022 }, { k: 'crystal', x: 0.5, y: 0.75, r: 0.022 }],
    hazards: [{ k: 'ice', x: 0.28, y: 0.2, w: 0.44, h: 0.6 }] },
]);

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function pickPvpMap(channel) { return PVP_MAPS[hash(String(channel || 'duel')) % PVP_MAPS.length]; }

// the map laid out in world coordinates for an arena size
export function layoutMap(map, A) {
  const sx = (v) => v * A.w, sy = (v) => v * A.h, sr = (v) => v * Math.min(A.w, A.h) * 1.6;
  return {
    id: map.id, name: map.name, map,
    solids: map.solids.map((s) => (s.k === 'wall' ? { k: s.k, x: sx(s.x), y: sy(s.y), w: sx(s.w), h: sy(s.h) } : { k: s.k, x: sx(s.x), y: sy(s.y), r: sr(s.r) })),
    hazards: map.hazards.map((z) => (z.r != null ? { k: z.k, x: sx(z.x), y: sy(z.y), r: sr(z.r) } : { k: z.k, x: sx(z.x), y: sy(z.y), w: sx(z.w), h: sy(z.h) })),
  };
}

// pushes a body out of every solid; returns true if it touched one
export function resolveSolids(L, b) {
  let hit = false;
  for (const s of L.solids) {
    if (s.k === 'wall') {
      const cx = Math.max(s.x, Math.min(s.x + s.w, b.x)), cy = Math.max(s.y, Math.min(s.y + s.h, b.y));
      const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), rr = b.r || 20;
      if (d < rr) {
        hit = true;
        if (d > 0.01) { b.x = cx + (dx / d) * rr; b.y = cy + (dy / d) * rr; }
        else { const l = b.x - s.x, r = s.x + s.w - b.x, t = b.y - s.y, bt = s.y + s.h - b.y, m = Math.min(l, r, t, bt); if (m === l) b.x = s.x - rr; else if (m === r) b.x = s.x + s.w + rr; else if (m === t) b.y = s.y - rr; else b.y = s.y + s.h + rr; }
      }
    } else {
      const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy), min = s.r + (b.r || 20) * 0.8;
      if (d < min) { hit = true; const k = d > 0.01 ? min / d : 1; b.x = s.x + dx * k; b.y = s.y + (d > 0.01 ? dy * k : min); }
    }
  }
  return hit;
}
export function pointInSolid(L, x, y) {
  for (const s of L.solids) {
    if (s.k === 'wall') { if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true; }
    else if (Math.hypot(x - s.x, y - s.y) < s.r) return true;
  }
  return false;
}
export function hazardAt(L, x, y) {
  for (const z of L.hazards) {
    if (z.r != null ? Math.hypot(x - z.x, (y - z.y) * 1.4) < z.r : x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
  }
  return null;
}
