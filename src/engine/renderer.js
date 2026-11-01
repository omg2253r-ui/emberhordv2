// Canvas 2D renderer with a camera, device-pixel-ratio handling and screen shake.
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const cam = { x: 0, y: 0, zoom: 1, shake: 0, shakeTime: 0, ox: 0, oy: 0 };
  const view = { w: 1, h: 1, dpr: 1 };
  let shakeEnabled = true;
  let maxDpr = 2, shakeScale = 1;

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    view.w = Math.max(1, canvas.clientWidth);
    view.h = Math.max(1, canvas.clientHeight);
    const W = Math.round(view.w * view.dpr), H = Math.round(view.h * view.dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }

  function update(dt) {
    if (cam.shakeTime > 0) {
      cam.shakeTime -= dt;
      const m = cam.shake * Math.max(0, cam.shakeTime) / 0.25;
      cam.ox = (Math.random() * 2 - 1) * m;
      cam.oy = (Math.random() * 2 - 1) * m;
    } else { cam.ox = 0; cam.oy = 0; }
  }

  function shake(mag = 6, time = 0.25) {
    if (!shakeEnabled) return;
    mag *= shakeScale;
    if (mag >= cam.shake * Math.max(0, cam.shakeTime) / 0.25) { cam.shake = mag; cam.shakeTime = time; }
  }

  function worldSpace() {
    const z = cam.zoom * view.dpr;
    ctx.setTransform(z, 0, 0, z, view.dpr * (view.w / 2 + cam.ox) - cam.x * z, view.dpr * (view.h / 2 + cam.oy) - cam.y * z);
  }
  function screenSpace() { ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); }

  // Draws a rasterized sprite at its anchor. o: { rot, sx, sy, alpha, flash, flip }
  function sprite(s, x, y, o = {}) {
    const sx = (o.sx ?? 1) * (o.flip ? -1 : 1), sy = o.sy ?? 1;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(sx, sy);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
    if (o.flash > 0) { ctx.globalAlpha = (o.alpha ?? 1) * Math.min(1, o.flash); ctx.drawImage(s.white, -s.ax, -s.ay, s.w, s.h); }
    ctx.restore();
  }

  function screenToWorld(px, py) {
    return { x: (px - view.w / 2) / cam.zoom + cam.x, y: (py - view.h / 2) / cam.zoom + cam.y };
  }

  // "low" quality: additive blending ('lighter') is the costliest canvas operation and ~120 effects use it, so it is
  // switched to normal blending for this context instead of editing every effect.
  function setGlow(on) {
    if (on) { delete ctx.globalCompositeOperation; return; }          // back to the built-in accessor
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalCompositeOperation');
    if (!desc) return;
    Object.defineProperty(ctx, 'globalCompositeOperation', {
      configurable: true, enumerable: true,
      get() { return desc.get.call(ctx); },
      set(v) { desc.set.call(ctx, v === 'lighter' ? 'source-over' : v); },
    });
  }

  return {
    ctx, cam, view, resize, update, shake, worldSpace, screenSpace, sprite, screenToWorld,
    setShakeEnabled(v) { shakeEnabled = !!v; },
    setGlow,
    setShakeScale(v) { shakeScale = Math.max(0, Math.min(1, v)); },
    setMaxDpr(v) { const n = Math.max(1, Math.min(2, v)); if (n !== maxDpr) { maxDpr = n; resize(); } },
  };
}
