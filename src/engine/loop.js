// requestAnimationFrame loop with a clamped delta and automatic pause when the tab is hidden.
export function createLoop(step) {
  let last = 0, raf = 0, running = false;
  let onHidden = null;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    step(dt, t / 1000);
  }
  function onVis() {
    if (document.hidden) { cancelAnimationFrame(raf); last = 0; if (onHidden) onHidden(); }
    else if (running) { last = 0; raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', onVis);
  return {
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    onHidden(fn) { onHidden = fn; },
  };
}
