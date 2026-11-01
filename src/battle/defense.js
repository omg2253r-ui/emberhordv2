// World hooks for guard / parry / counter, shared by the dungeon, the online zones and PvP.
// opts.stagger(attacker): what a parry does to the monster that attacked (scene specific; optional)
import { styleEvent } from './style.js';

export function installDefenseHooks(w, { audio, renderer, app, stagger = null }) {
  const callout = (txt, color) => w.fx.callout(w.player.x, w.player.y - 128, txt, color);
  const rankUp = (r) => { if (r) { w.fx.callout(w.player.x, w.player.y - 150, `สไตล์ ${r.id}!`, r.color); audio.play('wave'); } };
  w.rankUp = rankUp;
  w.onGuardUp = () => audio.play('guard');
  w.onBlock = () => {
    const p = w.player;
    audio.play('block');
    w.particles.burst(p.x + Math.cos(p.facing) * 40, p.y - 34 + Math.sin(p.facing) * 40, 8, { color: ['#ffe2a0', '#f5d48a'], speedMin: 120, speedMax: 300, life: 0.25, size: 2.5, drag: 5, glow: true });
    rankUp(styleEvent(w.style, 'block'));
  };
  w.onGuardBreak = () => {
    callout('การ์ดแตก!', '#ff9a8a');
    audio.play('guardBreak'); renderer.shake(8, 0.25);
  };
  w.onParry = (attacker) => {
    const p = w.player;
    callout('แพร์รี่!', '#fff3c4');
    audio.play('parry'); renderer.shake(6, 0.18);
    w.hitStop?.(0.1); w.slowT = Math.max(w.slowT || 0, 0.22);
    w.particles.burst(p.x + Math.cos(p.facing) * 42, p.y - 34 + Math.sin(p.facing) * 42, 22, { color: ['#fff8ea', '#ffe2a0', '#f5b041'], speedMin: 180, speedMax: 460, life: 0.4, size: 3, drag: 4, glow: true });
    w.parries = (w.parries || 0) + 1;
    w.ultEvent?.('parry');
    if (attacker && stagger) stagger(attacker);
    rankUp(styleEvent(w.style, 'parry'));
    app.hud?.flash?.('perfect');
  };
  w.onCounter = () => {
    const p = w.player;
    callout('เคาน์เตอร์!', '#ffd08a');
    audio.play('counter');
    w.fx.ring(p.x, p.y - 30, 16, 120, '#ffd08a', 0.45, 7);
    w.counters = (w.counters || 0) + 1;
  };
}
