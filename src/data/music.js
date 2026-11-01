// The soundtrack, written as small scores that audio/music.js plays live (all synthesized).
//
// A track: { name, bpm, root (MIDI note of the key), mode, meter (16 = 4/4 in 16ths, 12 = 6/8 in 8th triplets),
//   prog (chord roots as scale degrees, one per bar), layers, ambient, swing, vol }
// Layers:
//   pad   { inst, vol, oct, voicing: chord tones as scale steps above the chord root, every: bars per chord }
//   bass / arp { inst, vol, oct, pat }   pat: one char per step: digit = chord tone ('1' root, '3' third, '5' fifth,
//                                         '7' seventh, '8' octave, '0' octave below), '-' hold, '.' rest
//   lead  { inst, vol, oct, mel: bars of space-separated scale degrees ('.' rest, '-' hold) } or gen: {…} (composed
//         from the track's own seed: chord tones on strong beats, steps in between, a phrase and its answer)
//   drums { vol, pat: { kick, snare, hat, openhat, taiko, tom, frame, shaker, clap, anvil, cymbal, gong } } 'x' / 'o' soft
// Any layer: min / max (only at that fight intensity: 1 normal, 2 boss half health, 3 last phase), enter (after N
// bars), on ('x.' per block of the progression: play / rest), boost (louder when intense), double (octave voice).
export const MODES = Object.freeze({
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
});

// ------------------------------------------------------------------------------------------- rhythm kit
const R = {
  k4: 'x...x...x...x...', k2: 'x.......x.......', kRock: 'x.....x...x.....', kDrive: 'x..x..x.x...x...', kHalf: 'x...............',
  s24: '....x.......x...', sBk: '....x..x....x.x.', sRoll: '....x.......xoxx', s3: '........x.......',
  h8: 'x.x.x.x.x.x.x.x.', h16: 'xoxoxoxoxoxoxoxo', hOff: '..x...x...x...x.', hTick: 'xoxooxoxxoxooxox',
  tWar: 'x..x..x.x.x.x...', tSlow: 'x.......x..x....', tHeart: 'x..x............', fFolk: 'x..x..x.x..x.x..',
};
const bar12 = { kick: 'x.....x.....', frame: 'x..o..x..o.o', shaker: 'xoxoxoxoxoxo' };

// ------------------------------------------------------------------------------------------- shared shapes
// a boss arrangement in the key of a place: driving ostinato, war drums, and more layers as the fight turns
function bossTrack(name, { root, mode, bpm, prog = [0, 5, 6, 4], lead = 'brass', ambient = null, extra = [], drums = {} }) {
  return {
    name, bpm, root, mode, meter: 16, prog, ambient, vol: 1,
    layers: [
      { kind: 'pad', inst: 'strings', vol: 0.07, voicing: [0, 2, 4] },
      { kind: 'bass', inst: 'bass', vol: 0.15, oct: -1, pat: '1.1.1.18.1.1.15.' },
      { kind: 'arp', inst: 'pluck', vol: 0.045, oct: 1, pat: '1358135813581358', min: 2 },
      { kind: 'lead', inst: lead, vol: 0.085, oct: 1, gen: { density: 'medium', lo: 0, hi: 9, legato: 0.5 } },
      { kind: 'pad', inst: 'choir', vol: 0.06, voicing: [0, 4, 7], oct: 1, min: 2 },
      { kind: 'drums', vol: 0.1, pat: { taiko: R.tWar, snare: R.s24, hat: R.h8, ...drums } },
      { kind: 'drums', vol: 0.1, pat: { cymbal: ['x...............', '................', '................', '................'], kick: R.kDrive }, min: 2 },
      { kind: 'drums', vol: 0.1, pat: { snare: R.sRoll, tom: '..........x.x.x.' }, min: 3 },
      ...extra,
    ],
  };
}
// the gods of the tower: each has its key, tempo, voice and the sound of its realm
function godTrack(name, { root, mode, bpm, lead, arp = 'pluck', ambient, prog = [0, 1, 0, 6], drums = {}, choir = true, extra = [] }) {
  return {
    name, bpm, root, mode, meter: 16, prog, ambient, vol: 1,
    layers: [
      { kind: 'pad', inst: 'organ', vol: 0.045, voicing: [0, 4], oct: -1 },
      ...(choir ? [{ kind: 'pad', inst: 'choir', vol: 0.06, voicing: [0, 2, 4], oct: 1 }] : []),
      { kind: 'bass', inst: 'bass', vol: 0.15, oct: -1, pat: '1..1..1.1..1.5.0' },
      { kind: 'arp', inst: arp, vol: 0.05, oct: 1, pat: '1.5.8.5.3.5.8.5.' },
      { kind: 'lead', inst: lead, vol: 0.085, oct: 1, gen: { density: 'medium', lo: -1, hi: 8, legato: 0.6 }, enter: 4 },
      { kind: 'drums', vol: 0.1, pat: { taiko: R.tWar, gong: ['x...............', '................', '................', '................'], ...drums } },
      { kind: 'drums', vol: 0.1, pat: { snare: R.sBk, hat: R.h16, kick: R.kDrive }, min: 2 },
      { kind: 'lead', inst: 'brass', vol: 0.07, oct: 0, gen: { density: 'sparse', lo: 0, hi: 7, legato: 0.9, seed: 7 }, min: 3 },
      ...extra,
    ],
  };
}

// ------------------------------------------------------------------------------------------- the tracks
export const TRACKS = {
  title: {
    name: 'เถ้าแห่งเอมเบอร์โฮลด์', bpm: 72, root: 50, mode: 'aeolian', meter: 16, prog: [0, 5, 2, 6], ambient: 'wind',
    layers: [
      { kind: 'pad', inst: 'strings', vol: 0.06, voicing: [0, 2, 4] },
      { kind: 'arp', inst: 'harp', vol: 0.06, oct: 0, pat: '1.5.8.5.3.5.8.5.' },
      { kind: 'bass', inst: 'softbass', vol: 0.12, oct: -1, pat: '1-------5-------' },
      { kind: 'lead', inst: 'choir', vol: 0.06, oct: 1, mel: ['4 - - 3 2 - 0 -', '2 - 3 4 5 - - -', '4 - - 2 4 - 6 -', '7 - - - - - . .', '9 - - 8 7 - 5 -', '4 - 5 6 7 - - -', '6 - 5 4 2 - 3 -', '0 - - - - - . .'], enter: 4 },
      { kind: 'drums', vol: 0.08, pat: { taiko: R.kHalf, gong: ['x...............', '................', '................', '................', '................', '................', '................', '................'] }, enter: 4 },
    ],
  },
  camp: {
    name: 'กองไฟพักแรม', bpm: 80, root: 50, mode: 'dorian', meter: 12, prog: [0, 3, 0, 4], ambient: 'camp',
    layers: [
      { kind: 'arp', inst: 'pluck', vol: 0.07, pat: '1..5..8..5..' },
      { kind: 'bass', inst: 'softbass', vol: 0.11, oct: -1, pat: '1.....5.....' },
      { kind: 'pad', inst: 'pad', vol: 0.045, voicing: [0, 2, 4], cutoff: 900 },
      { kind: 'lead', inst: 'flute', vol: 0.07, oct: 1, gen: { density: 'sparse', lo: 0, hi: 8, legato: 0.7 }, enter: 4, on: 'xx.x' },
      { kind: 'drums', vol: 0.07, pat: { frame: 'x.....o..o..' }, enter: 8 },
    ],
  },
  village: {
    name: 'ตลาดเมืองท่า', bpm: 108, root: 55, mode: 'mixolydian', meter: 16, prog: [0, 6, 3, 0], ambient: 'crowd', swing: 0.08,
    layers: [
      { kind: 'arp', inst: 'pluck', vol: 0.06, pat: '1.3.5.3.1.3.5.3.', double: 'harp' },
      { kind: 'bass', inst: 'softbass', vol: 0.12, oct: -1, pat: '1...5...1...5.5.' },
      { kind: 'lead', inst: 'reed', vol: 0.05, oct: 1, gen: { density: 'medium', lo: 0, hi: 9, legato: 0.4 }, on: 'xxx.' },
      { kind: 'drums', vol: 0.09, pat: { frame: R.fFolk, shaker: R.h8, clap: R.s24 } },
    ],
  },
  story: {
    name: 'บันทึกที่ยังเขียนไม่จบ', bpm: 66, root: 53, mode: 'lydian', meter: 16, prog: [0, 1, 5, 4], ambient: null,
    layers: [
      { kind: 'pad', inst: 'pad', vol: 0.05, voicing: [0, 2, 4], cutoff: 1100 },
      { kind: 'arp', inst: 'harp', vol: 0.05, pat: '1...5...8...5...' },
      { kind: 'lead', inst: 'flute', vol: 0.055, oct: 1, gen: { density: 'sparse', lo: 0, hi: 7, legato: 0.8 }, enter: 2 },
    ],
  },
  story_tense: {
    name: 'ก่อนพายุ', bpm: 80, root: 45, mode: 'harmonic', meter: 16, prog: [0, 5, 3, 4], ambient: 'hall',
    layers: [
      { kind: 'pad', inst: 'strings', vol: 0.06, voicing: [0, 2, 4] },
      { kind: 'bass', inst: 'bass', vol: 0.11, oct: -1, pat: '1.1.1.1.1.1.1.1.' },
      { kind: 'lead', inst: 'brass', vol: 0.06, oct: 0, gen: { density: 'sparse', lo: 0, hi: 7, legato: 0.9 } },
      { kind: 'drums', vol: 0.08, pat: { taiko: R.tSlow } },
    ],
  },
  memory: {
    name: 'ความทรงจำเลือนราง', bpm: 60, root: 52, mode: 'aeolian', meter: 16, prog: [0, 5, 3, 4],
    layers: [
      { kind: 'pad', inst: 'pad', vol: 0.05, voicing: [0, 2, 4], cutoff: 800 },
      { kind: 'arp', inst: 'glass', vol: 0.04, pat: '1...5...8...5...' },
      { kind: 'lead', inst: 'bell', vol: 0.035, oct: 1, gen: { density: 'sparse', lo: 0, hi: 7, legato: 0.8 }, enter: 2 },
    ],
  },
  // the campaign
  s1: {
    name: 'ป่าหนามสนธยา', bpm: 96, root: 52, mode: 'aeolian', meter: 16, prog: [0, 6, 5, 6], ambient: 'wind',
    layers: [
      { kind: 'arp', inst: 'pluck', vol: 0.055, pat: '1.5.8.5.1.5.9.5.' },
      { kind: 'bass', inst: 'softbass', vol: 0.12, oct: -1, pat: '1.....1...5.....' },
      { kind: 'pad', inst: 'pad', vol: 0.04, voicing: [0, 2, 4], cutoff: 1000 },
      { kind: 'lead', inst: 'flute', vol: 0.065, oct: 1, gen: { density: 'medium', lo: 0, hi: 8, legato: 0.6 }, on: 'x.xx' },
      { kind: 'drums', vol: 0.08, pat: { frame: 'x..x....x.x.....', shaker: R.hOff } },
    ],
  },
  s2: {
    name: 'เหมืองถ่านร้าง', bpm: 100, root: 45, mode: 'phrygian', meter: 16, prog: [0, 1, 0, 6], ambient: 'cave',
    layers: [
      { kind: 'bass', inst: 'bass', vol: 0.13, oct: -1, pat: '1..1..1.1..1.2..' },
      { kind: 'arp', inst: 'pluck', vol: 0.045, oct: 1, pat: '1.3.5.3.1.3.5.3.' },
      { kind: 'lead', inst: 'reed', vol: 0.05, oct: 1, gen: { density: 'medium', lo: 0, hi: 7, legato: 0.5 }, on: 'xx.x' },
      { kind: 'drums', vol: 0.09, pat: { anvil: 'x.......x.......', kick: R.kRock, frame: R.hOff } },
    ],
  },
  boss: bossTrack('ผู้พิทักษ์แห่งเถ้า', { root: 50, mode: 'harmonic', bpm: 132 }),

  // the ten lands of the expedition (zones), each with its own boss arrangement
  z_gale: {
    name: 'ทุ่งหญ้าลมกรด', bpm: 120, root: 57, mode: 'dorian', meter: 16, prog: [0, 3, 6, 4], ambient: 'gale',
    layers: [
      { kind: 'arp', inst: 'pluck', vol: 0.05, pat: '1358135813581358' },
      { kind: 'bass', inst: 'softbass', vol: 0.12, oct: -2, pat: '1...1.5.1...5.8.' },
      { kind: 'lead', inst: 'flute', vol: 0.07, oct: 1, gen: { density: 'dense', lo: 0, hi: 9, legato: 0.3 } },
      { kind: 'drums', vol: 0.09, pat: { frame: R.fFolk, shaker: R.h16 } },
    ],
  },
  z_frost: {
    name: 'ถ้ำผลึกน้ำแข็ง', bpm: 88, root: 47, mode: 'aeolian', meter: 16, prog: [0, 5, 3, 4], ambient: 'cave',
    layers: [
      { kind: 'arp', inst: 'glass', vol: 0.04, pat: '1.5.8.9.8.5.3.5.' },
      { kind: 'pad', inst: 'pad', vol: 0.045, voicing: [0, 2, 4, 6], cutoff: 1000 },
      { kind: 'bass', inst: 'softbass', vol: 0.11, oct: -1, pat: '1-------5---1---' },
      { kind: 'lead', inst: 'bell', vol: 0.04, oct: 1, gen: { density: 'sparse', lo: 0, hi: 9, legato: 0.5 } },
      { kind: 'drums', vol: 0.07, pat: { kick: R.k2, hat: R.hOff } },
    ],
  },
  z_marsh: {
    name: 'บึงพิษ', bpm: 92, root: 55, mode: 'phrygian', meter: 16, prog: [0, 1, 6, 0], ambient: 'marsh', swing: 0.1,
    layers: [
      { kind: 'bass', inst: 'softbass', vol: 0.13, oct: -2, pat: '1..1....1..2....' },
      { kind: 'arp', inst: 'pluck', vol: 0.045, pat: '1...3.5...3.5...' },
      { kind: 'lead', inst: 'reed', vol: 0.05, oct: 0, gen: { density: 'medium', lo: 0, hi: 7, legato: 0.6 } },
      { kind: 'drums', vol: 0.08, pat: { frame: 'x..x....x..x....', shaker: R.h8 } },
    ],
  },
  z_shadow: {
    name: 'ซากปราสาทเงา', bpm: 104, root: 48, mode: 'harmonic', meter: 16, prog: [0, 5, 3, 4], ambient: 'hall',
    layers: [
      { kind: 'pad', inst: 'organ', vol: 0.05, voicing: [0, 2, 4] },
      { kind: 'arp', inst: 'strings', vol: 0.035, oct: 1, pat: '1.3.5.8.5.3.1.3.' },
      { kind: 'bass', inst: 'bass', vol: 0.12, oct: -1, pat: '1...1...1...5...' },
      { kind: 'lead', inst: 'choir', vol: 0.055, oct: 1, gen: { density: 'sparse', lo: 0, hi: 7, legato: 0.9 } },
      { kind: 'drums', vol: 0.08, pat: { tom: R.tSlow, snare: R.s3 } },
    ],
  },
  z_dunes: {
    name: 'ทะเลทรายเงาแดด', bpm: 112, root: 52, mode: 'phrygdom', meter: 16, prog: [0, 1, 0, 6], ambient: 'desert',
    layers: [
      { kind: 'bass', inst: 'softbass', vol: 0.12, oct: -1, pat: '1..1..1.1..5.1..' },
      { kind: 'arp', inst: 'pluck', vol: 0.05, pat: '1.2.3.2.1.2.3.5.' },
      { kind: 'lead', inst: 'reed', vol: 0.06, oct: 1, gen: { density: 'dense', lo: 0, hi: 8, legato: 0.4 } },
      { kind: 'drums', vol: 0.09, pat: { frame: 'x..x..x...x.x...', tom: '......x.......x.', shaker: R.h8 } },
    ],
  },
  z_glow: {
    name: 'ป่าเห็ดเรืองแสง', bpm: 96, root: 53, mode: 'lydian', meter: 16, prog: [0, 1, 5, 4], ambient: 'glow',
    layers: [
      { kind: 'arp', inst: 'bell', vol: 0.035, oct: 1, pat: '1.5.3.8.5.3.9.5.' },
      { kind: 'bass', inst: 'softbass', vol: 0.11, oct: -1, pat: '1.....5.1.......' },
      { kind: 'pad', inst: 'pad', vol: 0.04, voicing: [0, 2, 4], cutoff: 1300 },
      { kind: 'lead', inst: 'glass', vol: 0.04, oct: 1, gen: { density: 'medium', lo: 0, hi: 9, legato: 0.5 } },
      { kind: 'drums', vol: 0.07, pat: { shaker: R.h8, kick: R.k2 } },
    ],
  },
  z_foundry: {
    name: 'โรงหลอมสายฟ้า', bpm: 126, root: 50, mode: 'phrygian', meter: 16, prog: [0, 0, 1, 6], ambient: 'forge',
    layers: [
      { kind: 'bass', inst: 'bass', vol: 0.14, oct: -1, pat: '1.1.18..1.1.12..' },
      { kind: 'arp', inst: 'saw', vol: 0.035, oct: 1, pat: '1.5.1.5.1.5.2.5.' },
      { kind: 'lead', inst: 'saw', vol: 0.05, oct: 1, gen: { density: 'medium', lo: 0, hi: 8, legato: 0.5 }, on: 'x.xx' },
      { kind: 'drums', vol: 0.1, pat: { kick: R.k4, anvil: '..x...x...x...xx', hat: R.h16 } },
    ],
  },
  z_magma: {
    name: 'หุบเขาลาวา', bpm: 116, root: 47, mode: 'harmonic', meter: 16, prog: [0, 5, 6, 4], ambient: 'magma',
    layers: [
      { kind: 'bass', inst: 'bass', vol: 0.15, oct: -1, pat: '1..1..1.1...5...' },
      { kind: 'pad', inst: 'strings', vol: 0.05, voicing: [0, 2, 4] },
      { kind: 'lead', inst: 'brass', vol: 0.07, oct: 0, gen: { density: 'medium', lo: 0, hi: 8, legato: 0.7 } },
      { kind: 'drums', vol: 0.1, pat: { taiko: R.tWar, snare: R.s24 } },
    ],
  },
  z_sky: {
    name: 'สวนลอยฟ้า', bpm: 112, root: 55, mode: 'lydian', meter: 16, prog: [0, 1, 4, 3], ambient: 'sky',
    layers: [
      { kind: 'arp', inst: 'harp', vol: 0.045, pat: '1358135813581358' },
      { kind: 'pad', inst: 'strings', vol: 0.045, voicing: [0, 2, 4] },
      { kind: 'bass', inst: 'softbass', vol: 0.11, oct: -1, pat: '1...5...8...5...' },
      { kind: 'lead', inst: 'strings', vol: 0.06, oct: 1, gen: { density: 'medium', lo: 0, hi: 9, legato: 0.8 } },
      { kind: 'drums', vol: 0.07, pat: { hat: R.h8, kick: R.k2 } },
    ],
  },
  z_throne: {
    name: 'บัลลังก์คืนเถ้า', bpm: 100, root: 50, mode: 'harmonic', meter: 16, prog: [0, 5, 1, 4], ambient: 'hall',
    layers: [
      { kind: 'pad', inst: 'choir', vol: 0.06, voicing: [0, 2, 4] },
      { kind: 'pad', inst: 'organ', vol: 0.04, voicing: [0, 4], oct: -1 },
      { kind: 'bass', inst: 'bass', vol: 0.13, oct: -1, pat: '1.......1...5...' },
      { kind: 'lead', inst: 'brass', vol: 0.07, oct: 0, gen: { density: 'sparse', lo: 0, hi: 8, legato: 0.9 } },
      { kind: 'drums', vol: 0.09, pat: { taiko: R.tSlow, gong: ['x...............', '................', '................', '................'] } },
    ],
  },
  // v8 lands
  z_mirror: {
    name: 'เหวกระจกแตก', bpm: 104, root: 54, mode: 'dorian', meter: 16, prog: [0, 3, 5, 4], ambient: 'hall',
    layers: [
      { kind: 'arp', inst: 'glass', vol: 0.045, pat: '1.3.5.8.5.3.1.3.' },
      { kind: 'pad', inst: 'strings', vol: 0.045, voicing: [0, 2, 4] },
      { kind: 'bass', inst: 'softbass', vol: 0.12, oct: -1, pat: '1.......1...5...' },
      { kind: 'lead', inst: 'bell', vol: 0.055, oct: 1, gen: { density: 'sparse', lo: 0, hi: 9, legato: 0.7 } },
      { kind: 'drums', vol: 0.07, pat: { hat: R.h8, kick: R.k2 } },
    ],
  },
  z_eclipse: {
    name: 'บัลลังก์สุริยคราส', bpm: 108, root: 49, mode: 'harmonic', meter: 16, prog: [0, 5, 3, 4], ambient: 'hall',
    layers: [
      { kind: 'pad', inst: 'choir', vol: 0.06, voicing: [0, 2, 4] },
      { kind: 'pad', inst: 'organ', vol: 0.035, voicing: [0, 4], oct: -1 },
      { kind: 'bass', inst: 'bass', vol: 0.13, oct: -1, pat: '1...1...5...1.5.' },
      { kind: 'lead', inst: 'brass', vol: 0.065, oct: 0, gen: { density: 'medium', lo: 0, hi: 8, legato: 0.85 } },
      { kind: 'drums', vol: 0.09, pat: { taiko: R.tWar, gong: ['x...............', '................', '................', '................'] } },
    ],
  },
  // special dungeons (raids), the endless rift, the arena and the tower
  r_wrath: bossTrack('รังมังกรพิโรธ', { root: 50, mode: 'phrygdom', bpm: 140, prog: [0, 1, 0, 6], ambient: 'magma', drums: { kick: R.kDrive } }),
  r_prophecy: bossTrack('หอดาวแห่งคำพยากรณ์', { root: 52, mode: 'harmonic', bpm: 120, lead: 'choir', ambient: 'void', extra: [{ kind: 'arp', inst: 'bell', vol: 0.03, oct: 2, pat: '1...5...8...5...' }] }),
  r_judgment: bossTrack('ลานพิพากษาฟากฟ้า', { root: 57, mode: 'harmonic', bpm: 128, lead: 'organ', ambient: 'hall', extra: [{ kind: 'pad', inst: 'choir', vol: 0.05, voicing: [0, 2, 4], oct: 1 }] }),
  rift: {
    name: 'รอยแยกไร้ที่สิ้นสุด', bpm: 110, root: 47, mode: 'locrian', meter: 16, prog: [0, 1, 5, 4], ambient: 'void',
    layers: [
      { kind: 'arp', inst: 'glass', vol: 0.035, pat: '1.5.8.5.2.5.8.5.' },
      { kind: 'bass', inst: 'saw', vol: 0.08, oct: -1, pat: '1.1.1.1.1.1.2.2.' },
      { kind: 'lead', inst: 'bell', vol: 0.035, oct: 1, gen: { density: 'medium', lo: 0, hi: 8, legato: 0.5 } },
      { kind: 'drums', vol: 0.09, pat: { kick: R.k4, hat: R.hOff, clap: R.s24 } },
      { kind: 'pad', inst: 'choir', vol: 0.05, voicing: [0, 4], min: 2 },
    ],
  },
  duel: {
    name: 'ลานประลอง', bpm: 150, root: 52, mode: 'aeolian', meter: 16, prog: [0, 5, 6, 4], ambient: 'crowd',
    layers: [
      { kind: 'bass', inst: 'bass', vol: 0.14, oct: -1, pat: '1.1.1.1.8.1.1.5.' },
      { kind: 'arp', inst: 'saw', vol: 0.03, oct: 1, pat: '1.5.8.5.1.5.8.5.' },
      { kind: 'lead', inst: 'brass', vol: 0.075, oct: 1, gen: { density: 'medium', lo: 0, hi: 9, legato: 0.5 } },
      { kind: 'drums', vol: 0.1, pat: { kick: R.k4, snare: R.s24, hat: R.h16 } },
      { kind: 'pad', inst: 'strings', vol: 0.05, voicing: [0, 2, 4], min: 2 },
      { kind: 'drums', vol: 0.1, pat: { taiko: R.tWar, cymbal: ['x...............', '................'] }, min: 2 },
    ],
  },
  tower: {
    name: 'หอคอยขุมนรก', bpm: 92, root: 45, mode: 'phrygian', meter: 16, prog: [0, 1, 0, 6], ambient: 'abyss',
    layers: [
      { kind: 'pad', inst: 'choir', vol: 0.05, voicing: [0, 2, 4] },
      { kind: 'bass', inst: 'bass', vol: 0.13, oct: -1, pat: '1..1..1.....1.2.' },
      { kind: 'arp', inst: 'bell', vol: 0.03, oct: 1, pat: '1.......5...2...' },
      { kind: 'lead', inst: 'reed', vol: 0.045, oct: 0, gen: { density: 'sparse', lo: 0, hi: 7, legato: 0.7 }, on: 'x.xx' },
      { kind: 'drums', vol: 0.09, pat: { frame: R.tSlow, taiko: R.tHeart } },
      { kind: 'drums', vol: 0.09, pat: { snare: R.s24, hat: R.h8 }, min: 2 },
    ],
  },
  // the ten gods
  g_river: godTrack('วาริยะ เทพแม่น้ำวิญญาณ', { root: 47, mode: 'aeolian', bpm: 120, lead: 'flute', arp: 'glass', ambient: 'drip' }),
  g_chains: godTrack('กาฬโลหิต ผู้ล่ามโซ่', { root: 54, mode: 'phrygian', bpm: 132, lead: 'brass', ambient: 'forge', drums: { anvil: '..x...x...x...x.' } }),
  g_hellfire: godTrack('อัคนีกาล เทพเพลิงนรก', { root: 50, mode: 'phrygdom', bpm: 144, lead: 'reed', ambient: 'magma', prog: [0, 1, 0, 1] }),
  g_silence: godTrack('มูกะ เทพแห่งความเงียบ', { root: 48, mode: 'locrian', bpm: 90, lead: 'glass', arp: 'bell', ambient: 'void', choir: false, drums: { taiko: R.tHeart } }),
  g_judge: godTrack('ยมพิพากษ์', { root: 57, mode: 'harmonic', bpm: 126, lead: 'organ', arp: 'harp', ambient: 'hall', prog: [0, 5, 3, 4] }),
  g_serpent: godTrack('นาคาธร อสรพิษใต้พิภพ', { root: 52, mode: 'phrygdom', bpm: 136, lead: 'reed', ambient: 'desert', drums: { frame: R.fFolk } }),
  g_time: godTrack('กาลนิรันดร์', { root: 55, mode: 'aeolian', bpm: 120, lead: 'bell', arp: 'glass', ambient: 'hall', drums: { hat: R.hTick } }),
  g_masks: godTrack('พันหน้ากาก', { root: 49, mode: 'dorian', bpm: 130, lead: 'pluck', arp: 'harp', ambient: 'crowd', prog: [0, 3, 0, 4] }),
  g_frost: godTrack('หิมวันต์ เทพน้ำแข็ง', { root: 47, mode: 'harmonic', bpm: 118, lead: 'glass', arp: 'bell', ambient: 'blizzard', prog: [0, 5, 3, 4] }),
  g_king: godTrack('ราชาขุมนรก', { root: 50, mode: 'harmonic', bpm: 150, lead: 'brass', ambient: 'abyss', prog: [0, 5, 1, 4], extra: [{ kind: 'pad', inst: 'strings', vol: 0.05, voicing: [0, 2, 4] }, { kind: 'arp', inst: 'pluck', vol: 0.04, oct: 1, pat: '1358135813581358', min: 2 }] }),
};
// boss versions of the ten lands (same key and colour as the land, a fight arrangement on top)
const ZONE_BOSS = { gale: 'flute', frost: 'bell', marsh: 'reed', shadow: 'choir', dunes: 'reed', glow: 'glass', foundry: 'saw', magma: 'brass', sky: 'strings', throne: 'brass', mirror: 'glass', eclipse: 'brass' };
for (const [theme, lead] of Object.entries(ZONE_BOSS)) {
  const z = TRACKS[`z_${theme}`];
  TRACKS[`zb_${theme}`] = bossTrack(`${z.name}: ผู้คุมดินแดน`, { root: z.root, mode: z.mode, bpm: z.bpm + 16, prog: z.prog, lead, ambient: z.ambient });
}
// loudness: measured in the browser (RMS of each track at its usual intensity) and evened out, so walking from the
// camp into a land or a boss fight changes the mood, not the volume knob (bosses stay a little louder on purpose)
const LEVEL = { title: 1.3, camp: 2.1, village: 1.6, story: 2.4, story_tense: 0.75, memory: 2.4, s1: 1.4, s2: 0.95, boss: 0.8,
  z_gale: 1.5, z_frost: 1.15, z_marsh: 2.2, z_shadow: 1.2, z_dunes: 1.4, z_glow: 1.75, z_foundry: 0.78, z_magma: 0.6, z_sky: 1.5, z_throne: 1.15, z_mirror: 1.4, z_eclipse: 1.1,
  rift: 1.35, duel: 1.6, tower: 1.25 };
for (const [id, t] of Object.entries(TRACKS)) t.vol = LEVEL[id] ?? (id.startsWith('g_') ? 0.95 : 0.82);
Object.freeze(TRACKS);

// where each place's music comes from
export const GOD_TRACK = Object.freeze({ t_god_river: 'g_river', t_god_chains: 'g_chains', t_god_hellfire: 'g_hellfire', t_god_silence: 'g_silence', t_god_judge: 'g_judge', t_god_serpent: 'g_serpent', t_god_time: 'g_time', t_god_masks: 'g_masks', t_god_frost: 'g_frost', t_god_king: 'g_king' });
export const RAID_TRACK = Object.freeze({ wrath: 'r_wrath', prophecy: 'r_prophecy', judgment: 'r_judgment' });
export const STAGE_TRACK = Object.freeze({ thornwood: 's1', cinder: 's2' });
export function zoneTrack(zone) {
  if (!zone) return 'camp';
  if (zone.tower) return 'tower';
  if (zone.infinite || zone.id === 'infinite') return 'rift';
  if (zone.rush) return 'duel';
  if (RAID_TRACK[zone.theme]) return RAID_TRACK[zone.theme];
  return TRACKS[`z_${zone.theme}`] ? `z_${zone.theme}` : 'z_gale';
}
// the music when a boss of this zone shows up
export function bossTrackFor(zone, bossId) {
  if (GOD_TRACK[bossId]) return GOD_TRACK[bossId];
  if (bossId === 'z_rush_shadow') return 'g_king';
  if (zone && RAID_TRACK[zone.theme]) return RAID_TRACK[zone.theme];
  if (zone && TRACKS[`zb_${zone.theme}`]) return `zb_${zone.theme}`;
  return 'boss';
}
// how hard the music drives: 1 normal · 2 the boss is below half health · 3 its last stand
export const bossIntensity = (f) => (f <= 0.25 ? 3 : f <= 0.5 ? 2 : 1);
export function storyTrack(sceneId) {
  if (/^mem_/.test(sceneId)) return 'memory';
  if (/boss_pre|prologue/.test(sceneId)) return 'story_tense';
  return 'story';
}

// ------------------------------------------------------------------------------------------- melodies
function hash(s) { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const RHYTHMS = {
  16: {
    sparse: ['x.......x.......', 'x...........x...', 'x.......x...x...', 'x.....x.........'],
    medium: ['x...x...x.x.x...', 'x..x..x.x...x...', 'x.x.x...x...x.x.', 'x...x.x.x...x...', 'x..x..x...x.x...'],
    dense: ['x.x.x.x.x.x.x.x.', 'xx.xx.x.x.xx.x..', 'x.xxx.x.x.x.xxx.', 'x.x.xx.xx.x.x.x.'],
  },
  12: {
    sparse: ['x.....x.....', 'x........x..', 'x.....x..x..'],
    medium: ['x..x..x..x..', 'x.xx..x..x..', 'x..x.xx.....', 'x.....x.xx..'],
    dense: ['x.xx.xx.xx.x', 'xxx.xxx.xx.x', 'x.xx.xx.x.xx'],
  },
};
// the melody of a lead layer: an array of bars, each an array of `meter` tokens
export function trackMelody(t, L, index = 0) {
  const meter = t.meter;
  const parse = (bar) => {
    const toks = bar.trim().split(/\s+/);
    const per = Math.max(1, Math.round(meter / toks.length));
    const out = [];
    for (const tok of toks) { out.push(tok); for (let i = 1; i < per; i++) out.push(tok === '.' ? '.' : '-'); }
    while (out.length < meter) out.push('.');
    return out.slice(0, meter);
  };
  if (L.mel) return L.mel.map(parse);
  const g = L.gen || {};
  const r = rng(hash(`${t.name}|${index}|${g.seed || 0}`));
  const pool = RHYTHMS[meter === 12 ? 12 : 16][g.density || 'medium'];
  const lo = g.lo ?? 0, hi = g.hi ?? 9, legato = g.legato ?? 0.5;
  const P = t.prog.length;
  const bars = [];
  let prev = Math.round((lo + hi) / 2);
  const chordTones = (bar) => { const c = t.prog[bar % P]; const out = []; for (let o = -14; o <= 21; o += 7) for (const k of [0, 2, 4]) { const d = c + k + o; if (d >= lo && d <= hi) out.push(d); } return out; };
  const nearest = (list, x) => list.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a), list[0] ?? x);
  const strong = (s) => s % (meter === 12 ? 6 : 8) === 0;
  function makeBar(bar, rhythm, cadence) {
    const tones = chordTones(bar);
    const out = new Array(meter).fill('.');
    const hits = [];
    for (let s = 0; s < meter; s++) if (rhythm[s] === 'x') hits.push(s);
    hits.forEach((s, i) => {
      let d;
      if (cadence && i === hits.length - 1) d = nearest(tones.filter((x) => ((x % 7) + 7) % 7 === 0).length ? tones.filter((x) => ((x % 7) + 7) % 7 === 0) : tones, prev);
      else if (strong(s) || r() < 0.3) d = nearest(tones, prev + (r() < 0.5 ? -1 : 1));
      else { const step = r() < 0.75 ? 1 : 2; d = prev + (r() < 0.5 ? -step : step); if (d < lo) d = lo + 1; if (d > hi) d = hi - 1; }
      out[s] = String(d); prev = d;
      // hold the note into the gap after it?
      const nextHit = hits[i + 1] ?? meter;
      if (r() < legato || (cadence && i === hits.length - 1)) for (let k = s + 1; k < nextHit; k++) out[k] = '-';
    });
    return out;
  }
  // phrase A (P bars) and its answer A' (same rhythm, new notes, ends home)
  const rhythms = Array.from({ length: P }, (_, i) => (i === P - 1 ? pool[0] : pool[(r() * pool.length) | 0]));
  for (let b = 0; b < P; b++) bars.push(makeBar(b, rhythms[b], false));
  for (let b = 0; b < P; b++) bars.push(b < 2 && P > 2 ? bars[b].slice() : makeBar(b, rhythms[b], b === P - 1));
  return bars;
}
