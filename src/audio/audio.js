// The game's audio: music (audio/music.js + data/music.js), sound effects (audio/sfx.js) and the three volume
// sliders. Audio starts after the first tap or key press, as browsers require.
import { createEngine } from './engine.js';
import { createMusic } from './music.js';
import { SOUND_BANK } from './sfx.js';
import { TRACKS } from '../data/music.js';

export function createAudio() {
  let E = null, music = null;
  let vol = { sfx: 0.8, music: 0.45, ui: 0.7 };
  let wanted = null;                // the track asked for before audio could start
  let wantedIntensity = 1;
  const lastPlayed = new Map();

  function ensure() {
    if (E) { if (E.ctx.state === 'suspended') E.ctx.resume(); return true; }
    E = createEngine();
    if (!E) return false;
    applyVolumes();
    music = createMusic(E);
    music.setIntensity(wantedIntensity);
    if (wanted) music.play(wanted, { fade: 1.2 });
    return true;
  }
  function applyVolumes() {
    if (!E) return;
    const now = E.ctx.currentTime;
    E.sfxBus.gain.setTargetAtTime(vol.sfx, now, 0.05);
    E.musicBus.gain.setTargetAtTime(vol.music * 0.5, now, 0.05);
    E.uiBus.gain.setTargetAtTime(vol.ui, now, 0.05);
  }

  // old scene calls: startMusic('camp' | 'battle')
  const LEGACY = { camp: 'camp', battle: 'z_gale' };

  return {
    unlock: ensure,
    play(name, opts) {
      const s = SOUND_BANK[name];
      if (!E || !s) return;
      const [bus] = s;
      if ((bus === 'ui' ? vol.ui : vol.sfx) <= 0) return;
      // throttle identical sounds so ten hits in one frame do not clip
      const t = performance.now();
      if (t - (lastPlayed.get(name) || 0) < 35) return;
      lastPlayed.set(name, t);
      s[1](E, bus === 'ui' ? E.uiBus : E.sfxBus, E.ctx.currentTime + 0.005, opts);
    },
    setVolumes(sfx, mus, ui = vol.ui) { vol = { sfx, music: mus, ui }; applyVolumes(); },
    // music
    music(id, opts) { if (!TRACKS[id]) id = 'camp'; wanted = id; if (music) music.play(id, opts); },
    pushMusic(id) { if (!TRACKS[id]) return; if (music) music.push(id); else wanted = id; },
    popMusic() { music?.pop(); },
    setIntensity(n) { wantedIntensity = n; music?.setIntensity(n); },
    startMusic(mood = 'camp') { this.music(LEGACY[mood] || mood); },
    stopMusic() { wanted = null; music?.stop(); },
    get track() { return music?.current || wanted; },
    get trackName() { const id = music?.current || wanted; return id ? TRACKS[id]?.name || '' : ''; },
    get intensity() { return music?.intensity ?? wantedIntensity; },
    suspend() { if (E && E.ctx.state === 'running') E.ctx.suspend(); },
    resume() { if (E && E.ctx.state === 'suspended') E.ctx.resume(); },
    get ready() { return !!E; },
  };
}
