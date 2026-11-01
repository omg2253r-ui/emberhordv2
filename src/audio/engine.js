// The sound engine: one AudioContext, the mixing buses and the instruments that both the music and the sound
// effects play. Everything is synthesized (no audio files), so the game stays small and works offline.
//
//   master ── compressor ── destination
//     ├─ music bus  (+ reverb send)      ← tracks from audio/music.js
//     ├─ sfx bus    (+ small reverb)     ← combat and world sounds
//     └─ ui bus                          ← menus, buttons, chimes
export function createEngine() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  const ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = ctx.createGain(); master.gain.value = 0.9;
  comp.connect(master); master.connect(ctx.destination);

  // a soft hall from three damped feedback echoes (far cheaper than a convolution, which matters on phones)
  const reverb = ctx.createGain();
  const reverbOut = ctx.createGain(); reverbOut.gain.value = 0.32;
  for (const [t, fb] of [[0.089, 0.56], [0.131, 0.52], [0.173, 0.48]]) {
    const d = ctx.createDelay(1); d.delayTime.value = t;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.value = fb;
    reverb.connect(d); d.connect(lp); lp.connect(g); g.connect(d); lp.connect(reverbOut);
  }
  reverbOut.connect(comp);

  const bus = (v, send) => {
    const g = ctx.createGain(); g.gain.value = v; g.connect(comp);
    const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(reverb);
    return g;
  };
  const musicBus = bus(0.45 * 0.5, 0.35), sfxBus = bus(0.8, 0.08), uiBus = bus(0.7, 0.04);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  return { ctx, master, comp, reverb, musicBus, sfxBus, uiBus, noiseBuf };
}

// ------------------------------------------------------------------------------------------- primitives
// Every helper schedules at an absolute time `at` (seconds on ctx.currentTime) and cleans up after itself.
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function env(g, at, { a = 0.005, peak = 0.3, d = 0.2, s = 0, hold = 0, r = 0.08 } = {}) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a);
  if (s > 0) {
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), at + a + d);
    g.gain.setValueAtTime(Math.max(0.0002, peak * s), at + a + d + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d + hold + r);
    return at + a + d + hold + r;
  }
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  return at + a + d;
}

export function osc(E, dest, at, { type = 'sine', f = 440, f2 = null, glide = null, detune = 0, dur = 0.2, vol = 0.2, a = 0.005, s = 0, hold = 0, r = 0.08, vib = 0, vibRate = 5.5 }) {
  const { ctx } = E;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f, at);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + (glide ?? dur));
  let lfo = null;
  if (vib) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = vibRate; lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(f * vib, at + Math.min(0.35, dur)); lfo.connect(lg); lg.connect(o.frequency); lfo.start(at); }
  const end = env(g, at, { a, peak: vol, d: s ? Math.min(0.12, dur) : dur, s, hold, r });
  o.connect(g); g.connect(dest);
  o.start(at); o.stop(end + 0.05); if (lfo) lfo.stop(end + 0.05);
  return g;
}

export function noise(E, dest, at, { dur = 0.15, vol = 0.3, type = 'bandpass', f = 1200, f2 = null, q = 1.2, a = 0.005 }) {
  const { ctx } = E;
  const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = E.noiseBuf; flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, at);
  if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(30, f2), at + dur);
  const end = env(g, at, { a, peak: vol, d: dur });
  s.connect(flt); flt.connect(g); g.connect(dest);
  s.start(at, Math.random() * 1.2); s.stop(end + 0.05);
}

// ------------------------------------------------------------------------------------------- instruments
// Each takes (E, dest, at, freq, dur, vol) and plays one note.
export const INSTRUMENTS = {
  // plucked string (lute, harp): bright attack that darkens quickly
  pluck(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2.001;
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(Math.min(9000, f * 9), at); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), at + 0.25);
    const end = env(g, at, { a: 0.003, peak: vol, d: Math.max(0.35, dur * 1.6) });
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest);
    o.start(at); o2.start(at); o.stop(end + 0.05); o2.stop(end + 0.05);
  },
  harp(E, dest, at, f, dur, vol) {
    osc(E, dest, at, { type: 'triangle', f, dur: Math.max(0.8, dur * 2), vol, a: 0.004 });
    osc(E, dest, at, { type: 'sine', f: f * 2, dur: 0.5, vol: vol * 0.25, a: 0.004 });
  },
  // bells and chimes: inharmonic partials, long ring
  bell(E, dest, at, f, dur, vol) {
    osc(E, dest, at, { type: 'sine', f, dur: Math.max(1.2, dur * 2.5), vol, a: 0.002 });
    osc(E, dest, at, { type: 'sine', f: f * 2.756, dur: 0.7, vol: vol * 0.35, a: 0.002 });
    osc(E, dest, at, { type: 'sine', f: f * 5.404, dur: 0.3, vol: vol * 0.15, a: 0.002 });
  },
  glass(E, dest, at, f, dur, vol) {
    osc(E, dest, at, { type: 'sine', f: f * 2, dur: Math.max(1.4, dur * 3), vol: vol * 0.8, a: 0.002 });
    osc(E, dest, at, { type: 'sine', f: f * 3.01, dur: 0.9, vol: vol * 0.3, a: 0.002, detune: 7 });
  },
  // breathy flute: sine with vibrato + a puff of air
  flute(E, dest, at, f, dur, vol) {
    osc(E, dest, at, { type: 'sine', f, dur, vol, a: 0.06, s: 0.8, hold: Math.max(0, dur - 0.15), r: 0.15, vib: 0.008, vibRate: 5 });
    osc(E, dest, at, { type: 'triangle', f: f * 2, dur, vol: vol * 0.12, a: 0.08, s: 0.7, hold: Math.max(0, dur - 0.15), r: 0.12 });
    noise(E, dest, at, { dur: 0.12, vol: vol * 0.25, f: f * 2, q: 3 });
  },
  // bowed strings (a small section): slow swell, vibrato, detuned pair
  strings(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 6); lp.connect(dest);
    for (const d of [-8, 7]) osc(E, lp, at, { type: 'sawtooth', f, detune: d, dur, vol: vol * 0.5, a: 0.18, s: 0.85, hold: Math.max(0, dur - 0.3), r: 0.35, vib: 0.006, vibRate: 5.2 });
  },
  // low brass: the filter opens as the note speaks
  brass(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 9;
    lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.setValueAtTime(f * 1.2, at); lp.frequency.exponentialRampToValueAtTime(Math.min(5000, f * 7), at + 0.12); lp.frequency.exponentialRampToValueAtTime(f * 3, at + dur);
    const end = env(g, at, { a: 0.05, peak: vol, d: 0.1, s: 0.75, hold: Math.max(0, dur - 0.2), r: 0.2 });
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
    o.start(at); o2.start(at); o.stop(end + 0.05); o2.stop(end + 0.05);
  },
  // wordless choir "aah": saws through two vowel formants
  choir(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const g = ctx.createGain(); g.connect(dest);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
    f1.connect(g); f2.connect(g);
    for (const d of [-11, 0, 12]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      const end = env(og, at, { a: 0.35, peak: vol * 0.9, d: 0.2, s: 0.9, hold: Math.max(0, dur - 0.5), r: 0.5 });
      o.connect(og); og.connect(f1); og.connect(f2); o.start(at); o.stop(end + 0.05);
    }
  },
  // warm pad: detuned saws behind a gentle lowpass
  pad(E, dest, at, f, dur, vol, { cutoff = 1400 } = {}) {
    const { ctx } = E;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.6; lp.connect(dest);
    for (const d of [-12, 0, 10]) osc(E, lp, at, { type: 'sawtooth', f, detune: d, dur, vol: vol * 0.4, a: 0.6, s: 0.9, hold: Math.max(0, dur - 1.0), r: 0.9 });
  },
  organ(E, dest, at, f, dur, vol) {
    for (const [m, v] of [[1, 1], [2, 0.5], [3, 0.25], [0.5, 0.4]]) osc(E, dest, at, { type: 'sine', f: f * m, dur, vol: vol * v * 0.5, a: 0.04, s: 0.9, hold: Math.max(0, dur - 0.1), r: 0.25 });
  },
  // bass voices
  bass(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3; lp.connect(dest);
    osc(E, lp, at, { type: 'sawtooth', f, dur, vol, a: 0.008, s: 0.6, hold: Math.max(0, dur - 0.12), r: 0.08 });
    osc(E, dest, at, { type: 'sine', f, dur, vol: vol * 0.7, a: 0.008, s: 0.7, hold: Math.max(0, dur - 0.12), r: 0.08 });
  },
  softbass(E, dest, at, f, dur, vol) { osc(E, dest, at, { type: 'triangle', f, dur, vol, a: 0.02, s: 0.7, hold: Math.max(0, dur - 0.15), r: 0.15 }); },
  // a reedy shawm / desert pipe
  reed(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(4000, f * 3); bp.Q.value = 1.2; bp.connect(dest);
    osc(E, bp, at, { type: 'square', f, dur, vol: vol * 1.4, a: 0.03, s: 0.8, hold: Math.max(0, dur - 0.12), r: 0.1, vib: 0.01, vibRate: 6 });
  },
  // a gritty synth lead for the forge / sky machines
  saw(E, dest, at, f, dur, vol) {
    const { ctx } = E;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(f * 8, at); lp.frequency.exponentialRampToValueAtTime(f * 2, at + dur); lp.connect(dest);
    osc(E, lp, at, { type: 'sawtooth', f, dur, vol, a: 0.01, s: 0.6, hold: Math.max(0, dur - 0.1), r: 0.1 });
  },
};

// ------------------------------------------------------------------------------------------- drums
export const DRUMS = {
  kick(E, dest, at, v) { osc(E, dest, at, { type: 'sine', f: 150, f2: 42, glide: 0.16, dur: 0.28, vol: 0.55 * v, a: 0.002 }); noise(E, dest, at, { dur: 0.02, vol: 0.1 * v, type: 'highpass', f: 3000 }); },
  snare(E, dest, at, v) { osc(E, dest, at, { type: 'triangle', f: 210, f2: 150, dur: 0.1, vol: 0.18 * v }); noise(E, dest, at, { dur: 0.16, vol: 0.28 * v, type: 'bandpass', f: 2200, q: 0.8 }); },
  hat(E, dest, at, v) { noise(E, dest, at, { dur: 0.04, vol: 0.12 * v, type: 'highpass', f: 7500, q: 0.7 }); },
  openhat(E, dest, at, v) { noise(E, dest, at, { dur: 0.22, vol: 0.1 * v, type: 'highpass', f: 6500, q: 0.7 }); },
  taiko(E, dest, at, v) { osc(E, dest, at, { type: 'sine', f: 95, f2: 48, glide: 0.3, dur: 0.6, vol: 0.6 * v, a: 0.003 }); noise(E, dest, at, { dur: 0.25, vol: 0.2 * v, type: 'lowpass', f: 400, f2: 90 }); },
  tom(E, dest, at, v) { osc(E, dest, at, { type: 'sine', f: 160, f2: 90, glide: 0.2, dur: 0.3, vol: 0.4 * v, a: 0.003 }); },
  frame(E, dest, at, v) { noise(E, dest, at, { dur: 0.1, vol: 0.22 * v, type: 'bandpass', f: 380, q: 1.5 }); osc(E, dest, at, { type: 'sine', f: 120, f2: 85, dur: 0.15, vol: 0.18 * v }); },
  shaker(E, dest, at, v) { noise(E, dest, at, { dur: 0.06, vol: 0.08 * v, type: 'bandpass', f: 5200, q: 1.4, a: 0.012 }); },
  clap(E, dest, at, v) { for (let i = 0; i < 3; i++) noise(E, dest, at + i * 0.012, { dur: 0.09, vol: 0.18 * v, type: 'bandpass', f: 1400, q: 1 }); },
  anvil(E, dest, at, v) { for (const [m, k] of [[1, 1], [2.76, 0.5], [4.1, 0.3]]) osc(E, dest, at, { type: 'sine', f: 760 * m, dur: 0.4 - k * 0.1, vol: 0.12 * v * k, a: 0.001 }); noise(E, dest, at, { dur: 0.03, vol: 0.18 * v, type: 'highpass', f: 4000 }); },
  cymbal(E, dest, at, v) { noise(E, dest, at, { dur: 1.4, vol: 0.12 * v, type: 'highpass', f: 5000, q: 0.5, a: 0.01 }); },
  gong(E, dest, at, v) { for (const [m, k] of [[1, 1], [1.48, 0.6], [2.3, 0.4], [3.1, 0.25]]) osc(E, dest, at, { type: 'sine', f: 62 * m, dur: 3.2, vol: 0.3 * v * k, a: 0.01 }); noise(E, dest, at, { dur: 1.6, vol: 0.12 * v, type: 'bandpass', f: 600, f2: 200, q: 0.7 }); },
};
