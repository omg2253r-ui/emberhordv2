// The music player: plays a track from data/music.js (a little score: chords, bass line, arpeggio, melody, drums,
// an ambient bed) with a look-ahead scheduler, crossfades between tracks and follows the fight's intensity.
import { INSTRUMENTS, DRUMS, midiHz, noise, osc } from './engine.js';
import { TRACKS, MODES, trackMelody } from '../data/music.js';

const LOOKAHEAD = 0.3, TICK = 70, FADE = 1.6;

export function createMusic(E) {
  let cur = null;                 // the playing track instance
  let intensity = 1;
  const stack = [];               // pushMusic / popMusic (story scenes over the level's music)

  function degreeMidi(t, deg, oct = 0) {
    const sc = MODES[t.mode] || MODES.aeolian, n = sc.length;
    const o = Math.floor(deg / n), i = ((deg % n) + n) % n;
    return t.root + 12 * (o + oct) + sc[i];
  }

  function start(id, opts = {}) {
    const t = TRACKS[id] || TRACKS.camp;
    const out = E.ctx.createGain();
    out.gain.setValueAtTime(0.0001, E.ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(t.vol ?? 1, E.ctx.currentTime + (opts.fade ?? FADE));
    out.connect(E.musicBus);
    const inst = { id, t, out, bar: 0, step: 0, next: E.ctx.currentTime + 0.12, stop: false, timer: 0, amb: null, mel: new Map() };
    t.layers.forEach((L, i) => { if (L.kind === 'lead') inst.mel.set(i, trackMelody(t, L, i)); });
    inst.amb = startAmbient(E, t.ambient, out);
    tick(inst);
    return inst;
  }

  function stopInst(inst, fade = FADE) {
    if (!inst || inst.stop) return;
    inst.stop = true; clearTimeout(inst.timer);
    const now = E.ctx.currentTime;
    try { inst.out.gain.cancelScheduledValues(now); inst.out.gain.setValueAtTime(Math.max(0.0001, inst.out.gain.value), now); inst.out.gain.exponentialRampToValueAtTime(0.0001, now + fade); } catch { /* closed */ }
    setTimeout(() => { inst.amb?.stop(); try { inst.out.disconnect(); } catch { /* gone */ } }, (fade + 0.4) * 1000);
  }

  function swap(id, fade = FADE) {
    if (cur && cur.id === id && !cur.stop) return;
    stopInst(cur, fade);
    cur = start(id, { fade });
  }

  const spb = (t) => 60 / t.bpm / (t.meter === 12 ? 3 : 4);    // seconds per step (16ths, or triplet 8ths in 12/8)

  function tick(inst) {
    if (inst.stop) return;
    const { t } = inst;
    while (inst.next < E.ctx.currentTime + LOOKAHEAD) {
      playStep(inst, inst.next);
      const sw = (t.swing || 0) * (inst.step % 2 ? -1 : 1);
      inst.next += spb(t) * (1 + sw);
      inst.step += 1;
      if (inst.step >= t.meter) { inst.step = 0; inst.bar += 1; }
    }
    inst.timer = setTimeout(() => tick(inst), TICK);
  }

  function layerOn(L, inst) {
    if (L.min && intensity < L.min) return false;
    if (L.max && intensity > L.max) return false;
    if (L.enter && inst.bar < L.enter) return false;
    if (L.on) { const block = Math.floor(inst.bar / inst.t.prog.length); if (L.on[block % L.on.length] !== 'x') return false; }
    return true;
  }

  function playStep(inst, at) {
    const { t, step } = inst;
    const chord = t.prog[inst.bar % t.prog.length];
    const s = spb(t);
    t.layers.forEach((L, li) => {
      if (!layerOn(L, inst)) return;
      const vol = (L.vol || 0.1) * (L.boost && intensity >= 2 ? L.boost : 1);
      const human = at + (Math.random() - 0.5) * (t.humanize ?? 0.006);
      if (L.kind === 'pad') {
        const every = L.every || 1;
        if (step !== 0 || inst.bar % every) return;
        const dur = s * t.meter * every;
        for (const v of (L.voicing || [0, 2, 4])) {
          const f = midiHz(degreeMidi(t, chord + v, L.oct || 0));
          (INSTRUMENTS[L.inst] || INSTRUMENTS.pad)(E, inst.out, at, f, dur, vol, L);
        }
        return;
      }
      if (L.kind === 'drums') {
        for (const [name, pat] of Object.entries(L.pat)) {
          const p = Array.isArray(pat) ? pat[inst.bar % pat.length] : pat;
          const c = p[step % p.length];
          if (c === 'x' || c === 'o') DRUMS[name]?.(E, inst.out, human, (c === 'x' ? 1 : 0.45) * vol * 10);
        }
        return;
      }
      // pitched patterns: bass / arp use chord tones, lead uses its melody
      let pat, base;
      if (L.kind === 'lead') { const m = inst.mel.get(li); pat = m[inst.bar % m.length]; base = 0; }
      else { pat = Array.isArray(L.pat) ? L.pat[inst.bar % L.pat.length] : L.pat; base = chord; }
      const tok = pat[step % pat.length];
      if (tok == null || tok === '.' || tok === '-') return;
      let len = 1;
      while (pat[(step + len) % pat.length] === '-' && step + len < pat.length) len++;
      const deg = L.kind === 'lead' ? Number(tok) : (tok === '0' ? base - 7 : base + Number(tok) - 1);
      if (!Number.isFinite(deg)) return;
      const f = midiHz(degreeMidi(t, deg, L.oct || 0));
      (INSTRUMENTS[L.inst] || INSTRUMENTS.pluck)(E, inst.out, human, f, s * len * 0.95, vol);
      if (L.double) (INSTRUMENTS[L.double] || INSTRUMENTS.pluck)(E, inst.out, human, f * 2, s * len * 0.95, vol * 0.4);
    });
  }

  return {
    // while a story scene plays over the level, a new level track waits underneath until the scene ends
    play(id, { fade } = {}) {
      if (stack.length) { stack[0] = id; return; }
      swap(id, fade);
    },
    stop(fade = 1.0) { if (stack.length) { stack[0] = null; return; } stopInst(cur, fade); cur = null; },
    push(id) { stack.push(cur ? cur.id : null); swap(id, 1.0); },
    pop() {
      if (!stack.length) return;
      const prev = stack.pop();
      if (prev) swap(prev, 1.2); else { stopInst(cur, 1.0); cur = null; }
    },
    setIntensity(n) { intensity = Math.max(0, Math.min(3, n | 0)); },
    get intensity() { return intensity; },
    get current() { return cur && !cur.stop ? cur.id : null; },
  };
}

// ------------------------------------------------------------------------------------------- ambient beds
// Quiet, endless sounds of the place (wind, fire, dripping caves …) that sit under the music.
function startAmbient(E, kind, out) {
  if (!kind) return null;
  const { ctx } = E;
  const g = ctx.createGain(); g.gain.value = 1; g.connect(out);
  const nodes = [], timers = new Set();
  let stopped = false;
  const loopNoise = (type, f, q, vol, lfoRate = 0, lfoDepth = 0) => {
    const s = ctx.createBufferSource(); s.buffer = E.noiseBuf; s.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const ng = ctx.createGain(); ng.gain.value = vol;
    s.connect(flt); flt.connect(ng); ng.connect(g); s.start();
    nodes.push(s);
    if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(flt.frequency); l.start(); nodes.push(l); }
    return ng;
  };
  const drone = (f, vol, type = 'sine') => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; og.gain.value = vol; o.connect(og); og.connect(g); o.start(); nodes.push(o); };
  // occasional events: fn(at) is called at random intervals
  const sprinkle = (every, fn) => {
    let h = 0;
    const go = () => { timers.delete(h); if (stopped) return; fn(ctx.currentTime + 0.05); h = setTimeout(go, every * (0.4 + Math.random() * 1.2) * 1000); timers.add(h); };
    h = setTimeout(go, every * 500); timers.add(h);
  };
  switch (kind) {
    case 'wind': loopNoise('bandpass', 600, 0.8, 0.05, 0.13, 320); break;
    case 'gale': loopNoise('bandpass', 800, 0.7, 0.07, 0.21, 500); loopNoise('highpass', 3000, 0.5, 0.012, 0.3, 800); break;
    case 'blizzard': loopNoise('highpass', 2400, 0.4, 0.035, 0.17, 900); loopNoise('bandpass', 500, 0.8, 0.04, 0.1, 260); break;
    case 'cave': loopNoise('lowpass', 220, 0.7, 0.04); sprinkle(1.6, (at) => osc(E, g, at, { type: 'sine', f: 1400 + Math.random() * 900, f2: 700, dur: 0.18, vol: 0.03 })); break;
    case 'fire': loopNoise('lowpass', 300, 0.6, 0.05); sprinkle(0.25, (at) => noise(E, g, at, { dur: 0.02 + Math.random() * 0.03, vol: 0.05 + Math.random() * 0.05, type: 'highpass', f: 2500 + Math.random() * 3000 })); break;
    case 'camp': loopNoise('lowpass', 260, 0.6, 0.03); sprinkle(0.4, (at) => noise(E, g, at, { dur: 0.02, vol: 0.04 * Math.random(), type: 'highpass', f: 3000 })); sprinkle(5, (at) => { const f = 2600 + Math.random() * 1600; for (let i = 0; i < 3; i++) osc(E, g, at + i * 0.09, { type: 'sine', f, f2: f * 1.25, dur: 0.06, vol: 0.012 }); }); break;
    case 'birds': loopNoise('bandpass', 900, 0.5, 0.012, 0.1, 200); sprinkle(2.2, (at) => { const f = 2400 + Math.random() * 2200; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) osc(E, g, at + i * 0.11, { type: 'sine', f, f2: f * (Math.random() < 0.5 ? 1.3 : 0.8), dur: 0.08, vol: 0.016 }); }); break;
    case 'marsh': loopNoise('lowpass', 340, 0.9, 0.035); sprinkle(0.9, (at) => osc(E, g, at, { type: 'sine', f: 180 + Math.random() * 200, f2: 500 + Math.random() * 400, dur: 0.09, vol: 0.03 })); sprinkle(4, (at) => osc(E, g, at, { type: 'square', f: 90 + Math.random() * 30, dur: 0.18, vol: 0.01 })); break;
    case 'drip': loopNoise('lowpass', 180, 0.8, 0.035); sprinkle(1.4, (at) => osc(E, g, at, { type: 'sine', f: 1800 + Math.random() * 1200, f2: 900, dur: 0.12, vol: 0.025 })); break;
    case 'desert': loopNoise('bandpass', 1400, 0.4, 0.03, 0.07, 700); break;
    case 'glow': drone(110, 0.012); sprinkle(1.1, (at) => osc(E, g, at, { type: 'sine', f: 1200 + Math.random() * 1600, dur: 0.6, vol: 0.012 })); break;
    case 'forge': drone(55, 0.02, 'sawtooth'); loopNoise('lowpass', 160, 1, 0.05); sprinkle(2.5, (at) => noise(E, g, at, { dur: 0.25, vol: 0.03, type: 'bandpass', f: 4000, f2: 1200, q: 6 })); break;
    case 'magma': loopNoise('lowpass', 120, 1.2, 0.07, 0.08, 40); sprinkle(1.2, (at) => noise(E, g, at, { dur: 0.3, vol: 0.04, type: 'lowpass', f: 300, f2: 80 })); break;
    case 'sky': loopNoise('bandpass', 1100, 0.4, 0.02, 0.05, 500); sprinkle(3, (at) => osc(E, g, at, { type: 'sine', f: 2093 * (Math.random() < 0.5 ? 1 : 1.5), dur: 1.4, vol: 0.01 })); break;
    case 'void': drone(41.2, 0.03); drone(61.7, 0.015); loopNoise('bandpass', 400, 2, 0.02, 0.05, 250); break;
    case 'hall': loopNoise('lowpass', 200, 0.6, 0.03); drone(73.4, 0.01, 'triangle'); break;
    case 'crowd': loopNoise('bandpass', 700, 0.5, 0.02, 0.4, 150); sprinkle(1.5, (at) => noise(E, g, at, { dur: 0.25, vol: 0.012, type: 'bandpass', f: 900 + Math.random() * 700, q: 4 })); break;
    case 'abyss': drone(36.7, 0.04, 'triangle'); loopNoise('lowpass', 140, 1, 0.05, 0.05, 50); sprinkle(4, (at) => osc(E, g, at, { type: 'sawtooth', f: 73.4, f2: 55, dur: 1.4, vol: 0.012 })); break;
    default: break;
  }
  return { stop() { stopped = true; for (const h of timers) clearTimeout(h); timers.clear(); for (const n of nodes) { try { n.stop(); } catch { /* stopped */ } } try { g.disconnect(); } catch { /* gone */ } } };
}
