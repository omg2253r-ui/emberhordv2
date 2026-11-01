// Graphics quality (ตั้งค่า → คุณภาพกราฟิก): ต่ำ / กลาง / สูง.
// This setting changes how the game is DRAWN on this device and nothing else: canvas resolution, particle count,
// glow (additive blending) and screen-shake strength. It never changes who you see, who you can play with, or
// what is sent over the network — every player stays visible and playable together at every level.
// Everything is a pure lookup so scenes can read it every frame.

export const QUALITY_IDS = Object.freeze(['low', 'medium', 'high']);
export const DEFAULT_QUALITY = 'medium';

export const QUALITY = Object.freeze({
  low: Object.freeze({
    id: 'low', label: 'ต่ำ',
    maxDpr: 1,        // canvas pixel ratio cap (biggest saving on phones: 1/4 of the pixels vs 2×)
    particles: 0.3,   // share of particles spawned
    glow: false,      // additive ("lighter") blending is the costliest canvas operation
    shake: 0.5,       // screen-shake strength multiplier
  }),
  medium: Object.freeze({ id: 'medium', label: 'กลาง', maxDpr: 1.5, particles: 0.65, glow: true, shake: 1 }),
  high: Object.freeze({ id: 'high', label: 'สูง', maxDpr: 2, particles: 1, glow: true, shake: 1 }),
});

export const QUALITY_HELP = Object.freeze({
  low: 'เบาที่สุด: ภาพคมน้อยลง เอฟเฟกต์น้อย ปิดแสงเรือง — เหมาะกับมือถือเครื่องเก่า',
  medium: 'สมดุล: เอฟเฟกต์ครบแต่เบากว่าเดิม',
  high: 'สวยที่สุด: เอฟเฟกต์เต็ม ภาพคมสุด',
});

export const cleanQuality = (v) => (QUALITY_IDS.includes(v) ? v : DEFAULT_QUALITY);

let current = QUALITY[DEFAULT_QUALITY];
const listeners = new Set();

export function getQuality() { return current; }

export function setQuality(id) {
  const next = QUALITY[cleanQuality(id)];
  if (next === current) return current;
  current = next;
  for (const fn of listeners) { try { fn(current); } catch (e) { console.error(e); } }
  return current;
}

export function onQualityChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// A hint for the settings screen: weaker devices are offered "ต่ำ". Never applied without the player choosing it.
export function suggestQuality(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const cores = Number(nav.hardwareConcurrency) || 4;
  const mem = Number(nav.deviceMemory) || 4;
  if (cores <= 4 || mem <= 2) return 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'medium';
}
