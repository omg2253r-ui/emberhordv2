// Sound effects, sorted by what they belong to. Each entry: [bus, play(E, out, at, opts)].
//   ui      menus, buttons, rewards screens (the "เสียงเมนู" slider)
//   sfx     the fight and the world (the "เสียงเอฟเฟกต์" slider)
// Combat cues that teach the player how to survive have their own unmistakable sound:
//   pierceWarn  a hissing, rising ring: a crimson (armour-piercing) attack is coming: dodge, do not block
//   immune      a hollow clang: the boss cannot be hurt right now: wait for the opening
//   shellHit / shatter: an ice or stone shell taking hits, then breaking
import { osc, noise } from './engine.js';

const scale = [0, 2, 4, 7, 9];
const note = (n, base = 293.66) => base * Math.pow(2, (Math.floor(n / 5) * 12 + scale[((n % 5) + 5) % 5]) / 12);

// shorthand: tone / hiss at an offset from `at`
const T = (E, out, at) => (o) => osc(E, out, at + (o.t || 0), o);
const N = (E, out, at) => (o) => noise(E, out, at + (o.t || 0), o);

export const SOUND_BANK = {
  // ------------------------------------------------------------------ ui
  click: ['ui', (E, o, at) => T(E, o, at)({ type: 'triangle', f: 880, f2: 660, dur: 0.06, vol: 0.12 })],
  tab: ['ui', (E, o, at) => { const t = T(E, o, at); t({ type: 'triangle', f: 520, dur: 0.07, vol: 0.12 }); t({ type: 'triangle', f: 780, t: 0.04, dur: 0.08, vol: 0.1 }); }],
  open: ['ui', (E, o, at) => { N(E, o, at)({ dur: 0.16, vol: 0.06, f: 700, f2: 2400, q: 0.8 }); T(E, o, at)({ type: 'triangle', f: 660, t: 0.05, dur: 0.1, vol: 0.06 }); }],
  error: ['ui', (E, o, at) => { const t = T(E, o, at); t({ type: 'square', f: 220, dur: 0.1, vol: 0.08 }); t({ type: 'square', f: 165, t: 0.1, dur: 0.14, vol: 0.08 }); }],
  gold: ['ui', (E, o, at) => { const t = T(E, o, at); t({ type: 'triangle', f: 1568, dur: 0.08, vol: 0.12 }); t({ type: 'triangle', f: 2093, t: 0.06, dur: 0.12, vol: 0.1 }); }],
  buy: ['ui', (E, o, at) => { const t = T(E, o, at); t({ type: 'triangle', f: 1568, dur: 0.08, vol: 0.12 }); t({ type: 'triangle', f: 2093, t: 0.06, dur: 0.12, vol: 0.1 }); t({ type: 'triangle', f: 660, t: 0.12, dur: 0.1, vol: 0.1 }); }],
  levelup: ['ui', (E, o, at) => [0, 2, 4, 5, 7].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n + 5), t: i * 0.08, dur: 0.3, vol: 0.16 }))],
  forge: ['ui', (E, o, at) => { [1, 2.76, 5.4].forEach((m, i) => T(E, o, at)({ type: 'sine', f: 520 * m, dur: 0.5 - i * 0.12, vol: 0.12 / (i + 1) })); N(E, o, at)({ dur: 0.05, vol: 0.25, type: 'highpass', f: 3000 }); }],
  success: ['ui', (E, o, at) => { [0, 4, 7, 12].forEach((s, i) => T(E, o, at)({ type: 'triangle', f: 392 * Math.pow(2, s / 12), t: i * 0.09, dur: 0.4, vol: 0.16 })); T(E, o, at)({ type: 'sine', f: 1568, t: 0.36, dur: 0.8, vol: 0.08 }); }],
  fail: ['ui', (E, o, at) => { T(E, o, at)({ type: 'sawtooth', f: 220, f2: 110, dur: 0.4, vol: 0.1 }); N(E, o, at)({ dur: 0.3, vol: 0.18, type: 'lowpass', f: 600, f2: 120 }); }],
  unlock: ['ui', (E, o, at) => { [0, 7, 12, 16].forEach((s, i) => T(E, o, at)({ type: 'triangle', f: 523.25 * Math.pow(2, s / 12), t: i * 0.07, dur: 0.5, vol: 0.13 })); T(E, o, at)({ type: 'sine', f: 2093, t: 0.3, dur: 1.1, vol: 0.06 }); N(E, o, at)({ t: 0.28, dur: 0.6, vol: 0.05, type: 'highpass', f: 6000 }); }],
  summon: ['ui', (E, o, at) => [0, 4, 7, 11, 14].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n + 7), t: i * 0.07, dur: 0.35, vol: 0.13 }))],
  legendary: ['ui', (E, o, at) => { [0, 4, 7, 12, 16, 19].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n + 5), t: i * 0.09, dur: 0.6, vol: 0.15 })); T(E, o, at)({ type: 'sine', f: 2093, t: 0.5, dur: 1, vol: 0.08 }); }],
  victory: ['ui', (E, o, at) => { [0, 2, 4, 7, 9, 12].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n + 3), t: i * 0.11, dur: 0.45, vol: 0.15 })); T(E, o, at)({ type: 'sine', f: note(15), t: 0.7, dur: 1.4, vol: 0.08 }); }],
  defeat: ['ui', (E, o, at) => { [7, 4, 2, 0].forEach((n, i) => T(E, o, at)({ type: 'sine', f: note(n), t: i * 0.22, dur: 0.6, vol: 0.14 })); T(E, o, at)({ type: 'sine', f: 62, t: 0.9, dur: 2.2, vol: 0.2 }); }],

  // ------------------------------------------------------------------ the hero
  swing: ['sfx', (E, o, at, p) => N(E, o, at)({ dur: 0.13, vol: 0.22 * (p?.power || 1), f: 2600, f2: 700, q: 0.9 })],
  dash: ['sfx', (E, o, at) => N(E, o, at)({ dur: 0.2, vol: 0.2, f: 900, f2: 3000, q: 0.7 })],
  blink: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 1200, f2: 300, dur: 0.14, vol: 0.12 }); N(E, o, at)({ dur: 0.12, vol: 0.12, type: 'highpass', f: 3000 }); }],
  bow: ['sfx', (E, o, at, p) => { T(E, o, at)({ type: 'triangle', f: 320 * (p?.power || 1), f2: 140, dur: 0.12, vol: 0.18 }); N(E, o, at)({ dur: 0.08, vol: 0.16, type: 'highpass', f: 2600 }); }],
  cast: ['sfx', (E, o, at, p) => { T(E, o, at)({ type: 'sine', f: 520, f2: 980 * Math.min(1.6, p?.power || 1), dur: 0.16, vol: 0.14 }); N(E, o, at)({ dur: 0.14, vol: 0.12, f: 1800, f2: 4200, q: 2 }); }],
  charge: ['sfx', (E, o, at) => { const t = T(E, o, at); t({ type: 'triangle', f: 660, dur: 0.08, vol: 0.12 }); t({ type: 'triangle', f: 990, t: 0.06, dur: 0.14, vol: 0.12 }); }],
  potion: ['sfx', (E, o, at) => { for (let i = 0; i < 4; i++) T(E, o, at)({ type: 'sine', f: 400 + i * 120, f2: 700 + i * 140, t: i * 0.05, dur: 0.12, vol: 0.12 }); }],
  perfect: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 1760, f2: 880, dur: 0.5, vol: 0.14 }); T(E, o, at)({ type: 'triangle', f: 440, t: 0.02, dur: 0.4, vol: 0.12 }); N(E, o, at)({ dur: 0.3, vol: 0.12, f: 3000, f2: 600, q: 0.8 }); }],
  guard: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'triangle', f: 520, f2: 760, dur: 0.07, vol: 0.07 }); N(E, o, at)({ dur: 0.06, vol: 0.05, type: 'highpass', f: 2400 }); }],
  block: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'square', f: 260, f2: 180, dur: 0.08, vol: 0.09 }); N(E, o, at)({ dur: 0.1, vol: 0.16, f: 1800, f2: 900, q: 2 }); }],
  guardBreak: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sawtooth', f: 200, f2: 70, dur: 0.35, vol: 0.13 }); N(E, o, at)({ dur: 0.35, vol: 0.2, type: 'lowpass', f: 1200, f2: 200 }); }],
  parry: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'triangle', f: 1320, f2: 1980, dur: 0.12, vol: 0.16 }); T(E, o, at)({ type: 'sine', f: 2640, t: 0.03, dur: 0.45, vol: 0.09 }); N(E, o, at)({ dur: 0.16, vol: 0.2, type: 'highpass', f: 3200 }); }],
  counter: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sawtooth', f: 330, f2: 990, dur: 0.14, vol: 0.12 }); N(E, o, at)({ dur: 0.2, vol: 0.18, f: 900, f2: 3000, q: 1.5 }); }],
  clash: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'square', f: 880, f2: 660, dur: 0.1, vol: 0.11 }); N(E, o, at)({ dur: 0.12, vol: 0.22, type: 'highpass', f: 2800 }); }],
  hurt: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'square', f: 140, f2: 80, dur: 0.18, vol: 0.16 }); N(E, o, at)({ dur: 0.12, vol: 0.2, f: 900 }); }],
  pierced: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sawtooth', f: 330, f2: 90, dur: 0.3, vol: 0.14 }); N(E, o, at)({ dur: 0.22, vol: 0.26, type: 'bandpass', f: 2600, f2: 500, q: 3 }); T(E, o, at)({ type: 'sine', f: 60, dur: 0.35, vol: 0.3 }); }],
  frozen: ['sfx', (E, o, at) => { for (let i = 0; i < 4; i++) T(E, o, at)({ type: 'sine', f: 2400 + i * 380, t: i * 0.03, dur: 0.4, vol: 0.05 }); N(E, o, at)({ dur: 0.3, vol: 0.12, type: 'highpass', f: 4000 }); }],
  silenced: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 880, f2: 110, dur: 0.6, vol: 0.12 }); N(E, o, at)({ dur: 0.5, vol: 0.06, type: 'lowpass', f: 900, f2: 100 }); }],

  // ------------------------------------------------------------------ hits and monsters
  hit: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 170, f2: 60, dur: 0.14, vol: 0.45 }); N(E, o, at)({ dur: 0.05, vol: 0.25, type: 'highpass', f: 2000 }); }],
  crit: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 190, f2: 55, dur: 0.18, vol: 0.5 }); T(E, o, at)({ type: 'triangle', f: 1480, f2: 1200, t: 0.01, dur: 0.22, vol: 0.18 }); N(E, o, at)({ dur: 0.08, vol: 0.3, type: 'highpass', f: 3000 }); }],
  enemyDie: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'triangle', f: 420, f2: 90, dur: 0.28, vol: 0.25 }); N(E, o, at)({ dur: 0.2, vol: 0.18, f: 600, f2: 200 }); }],
  spawn: ['sfx', (E, o, at) => N(E, o, at)({ dur: 0.25, vol: 0.1, f: 300, f2: 900, q: 3 })],
  telegraph: ['sfx', (E, o, at) => T(E, o, at)({ type: 'sawtooth', f: 110, f2: 160, dur: 0.35, vol: 0.07 })],
  pierceWarn: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sawtooth', f: 220, f2: 660, dur: 0.45, vol: 0.07 }); T(E, o, at)({ type: 'sine', f: 1760, t: 0.05, dur: 0.5, vol: 0.06, vib: 0.03, vibRate: 14 }); N(E, o, at)({ dur: 0.4, vol: 0.09, type: 'bandpass', f: 3200, f2: 6000, q: 4 }); }],
  immune: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'square', f: 196, dur: 0.18, vol: 0.06 }); T(E, o, at)({ type: 'sine', f: 784, f2: 740, dur: 0.5, vol: 0.09 }); T(E, o, at)({ type: 'sine', f: 1175, dur: 0.35, vol: 0.05 }); }],
  shellHit: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 1900 + Math.random() * 300, dur: 0.12, vol: 0.07 }); N(E, o, at)({ dur: 0.06, vol: 0.12, type: 'highpass', f: 5000 }); }],
  shatter: ['sfx', (E, o, at) => { for (let i = 0; i < 7; i++) T(E, o, at)({ type: 'sine', f: 1500 + Math.random() * 2500, t: i * 0.025, dur: 0.3, vol: 0.06 }); N(E, o, at)({ dur: 0.5, vol: 0.3, type: 'highpass', f: 2500, f2: 6000 }); T(E, o, at)({ type: 'sine', f: 90, f2: 40, dur: 0.4, vol: 0.3 }); }],
  roar: ['sfx', (E, o, at) => { N(E, o, at)({ dur: 0.7, vol: 0.35, type: 'lowpass', f: 500, f2: 150, q: 2 }); T(E, o, at)({ type: 'sawtooth', f: 90, f2: 55, dur: 0.7, vol: 0.12 }); }],
  slam: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 90, f2: 30, dur: 0.45, vol: 0.6 }); N(E, o, at)({ dur: 0.35, vol: 0.35, type: 'lowpass', f: 400, f2: 80 }); }],
  godIntro: ['sfx', (E, o, at) => {
    for (const [m, k] of [[1, 1], [1.48, 0.6], [2.3, 0.4], [3.1, 0.25]]) T(E, o, at)({ type: 'sine', f: 55 * m, dur: 3.5, vol: 0.32 * k, a: 0.01 });
    N(E, o, at)({ dur: 2.2, vol: 0.14, type: 'bandpass', f: 600, f2: 150, q: 0.7 });
    [0, 3, 7].forEach((s, i) => T(E, o, at)({ type: 'sawtooth', f: 110 * Math.pow(2, s / 12), t: 0.4 + i * 0.05, dur: 2.2, vol: 0.035, a: 0.6, vib: 0.004 }));
  }],
  phase: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sawtooth', f: 55, f2: 110, dur: 1.2, vol: 0.12, a: 0.2 }); N(E, o, at)({ dur: 1.2, vol: 0.12, type: 'lowpass', f: 200, f2: 1600, q: 2 }); }],

  // ------------------------------------------------------------------ the world
  pickup: ['sfx', (E, o, at, p) => {
    const r = p?.rarity ?? 0;
    const notes = r >= 2 ? [5, 7, 9, 10] : r === 1 ? [5, 7, 9] : [7, 9];
    notes.forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n), t: i * 0.06, dur: 0.18 + r * 0.05, vol: 0.14 }));
    if (r >= 2) T(E, o, at)({ type: 'sine', f: note(12), t: notes.length * 0.06, dur: 0.6, vol: 0.12 });
  }],
  wave: ['sfx', (E, o, at) => [0, 3, 5].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n), t: i * 0.1, dur: 0.25, vol: 0.13 }))],
  floorClear: ['sfx', (E, o, at) => { [0, 4, 7, 11, 14].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n, 220), t: i * 0.08, dur: 0.6, vol: 0.12 })); for (const [m, k] of [[1, 1], [2.76, 0.4]]) T(E, o, at)({ type: 'sine', f: 330 * m, t: 0.45, dur: 1.6, vol: 0.12 * k }); }],
  chest: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'square', f: 140, f2: 90, dur: 0.12, vol: 0.06 }); N(E, o, at)({ dur: 0.25, vol: 0.12, type: 'lowpass', f: 900, f2: 300 }); [0, 4, 7].forEach((n, i) => T(E, o, at)({ type: 'triangle', f: note(n + 5), t: 0.15 + i * 0.06, dur: 0.3, vol: 0.1 })); }],
  portal: ['sfx', (E, o, at) => { T(E, o, at)({ type: 'sine', f: 220, f2: 880, dur: 0.8, vol: 0.1, vib: 0.02, vibRate: 8 }); N(E, o, at)({ dur: 0.8, vol: 0.1, f: 400, f2: 3000, q: 3 }); }],
};

export const SOUND_NAMES = Object.freeze(Object.keys(SOUND_BANK));
