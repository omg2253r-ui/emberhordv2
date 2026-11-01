// Minimal tween manager. Tweens are plain objects; finished ones are removed in place (no per-frame allocation).
export const Ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

export function createTweens() {
  const list = [];
  return {
    add(target, to, dur, { ease = Ease.outQuad, delay = 0, onDone = null } = {}) {
      const from = {};
      for (const k in to) from[k] = target[k];
      const t = { target, from, to, dur: Math.max(0.0001, dur), t: -delay, ease, onDone, dead: false };
      list.push(t);
      return t;
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const tw = list[i];
        if (tw.dead) { list.splice(i, 1); continue; }
        tw.t += dt;
        if (tw.t < 0) continue;
        const p = Math.min(1, tw.t / tw.dur), e = tw.ease(p);
        for (const k in tw.to) tw.target[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
        if (p >= 1) { list.splice(i, 1); if (tw.onDone) tw.onDone(); }
      }
    },
    killTarget(target) { for (const tw of list) if (tw.target === target) tw.dead = true; },
    clear() { list.length = 0; },
    get count() { return list.length; },
  };
}
