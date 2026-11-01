// The Infinite Rift (รอยแยกไร้สิ้นสุด): endless waves until you fall or leave. Only coins and artifacts can be
// earned here — no experience, no gear, no materials — and everything earned is paid out when the run ends
// (death or leaving both pay). Three entries a day. Every five waves the rift shifts to the land of the next
// zone (its floor, its hazards and its monsters) and a boss from that land guards the fifth wave.
import { ZONES } from './zones.js';

export const INFINITE = Object.freeze({
  id: 'inf', entriesPerDay: 3,
  band: 5,                 // waves per land
  hpGrow: 0.12, atkGrow: 0.055,
  coinsPerKill: 14, coinsPerWave: 40, coinGrow: 0.08,
  artifactEvery: 5,        // a boss wave always pays an artifact
  artifactChance: 0.12,    // any other cleared wave may too
  restBetween: 2.2,        // seconds between waves
});

export const dayKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function entriesLeft(state, now = Date.now()) {
  const inf = state.infinite || {};
  return inf.day === dayKey(now) ? Math.max(0, INFINITE.entriesPerDay - (inf.used || 0)) : INFINITE.entriesPerDay;
}

// the land the rift shows for wave w (1-based)
export function landOf(wave) { return ZONES[Math.floor((Math.max(1, wave) - 1) / INFINITE.band) % ZONES.length]; }
export function waveScale(wave) { const k = Math.max(0, wave - 1); return { hp: 1 + INFINITE.hpGrow * k, atk: 1 + INFINITE.atkGrow * k }; }
export function waveCoins(wave) { return Math.round(INFINITE.coinsPerWave * (1 + INFINITE.coinGrow * (wave - 1))); }
export function killCoins(wave, boss = false) { return Math.round(INFINITE.coinsPerKill * (1 + INFINITE.coinGrow * (wave - 1)) * (boss ? 12 : 1)); }

// a zone-like object the co-op scene can run
export function infiniteZone(wave = 1) {
  const land = landOf(wave);
  return {
    id: INFINITE.id, n: 20 + land.n, infinite: true, name: 'รอยแยกไร้สิ้นสุด', level: land.level, tier: land.tier,
    theme: land.theme, mechanic: land.mechanic, mechanicText: `${land.name}: ${land.mechanicText}`,
    monsters: land.monsters, boss: land.boss, rooms: ['endless'], land: land.id,
    desc: 'คลื่นศัตรูไม่มีที่สิ้นสุด ยิ่งลึกยิ่งแกร่ง ได้เฉพาะเหรียญและอาร์ติแฟกต์',
  };
}

// what wave w spawns: [[id, count], ...]
export function waveSpawns(wave) {
  const land = landOf(wave);
  if (wave % INFINITE.band === 0) return [[land.boss, 1], [land.monsters[0], Math.min(3, 1 + Math.floor(wave / 15))]];
  const n = Math.min(8, 3 + Math.floor(wave / 3));
  const a = Math.ceil(n / 2), b = n - a;
  return [[land.monsters[0], a], [land.monsters[1], b]];
}
