// Rasterizes the vector illustrations once into offscreen canvases (plus a white silhouette for hit flashes).
export const ART_SCALE = 2; // rasterize at 2x world size so sprites stay crisp on high-DPI screens

// Studio lighting baked into a creature's picture: a warm key light from the upper left (a soft gradient and a
// bright rim on the edges that face it), a cool bounce rim on the far edges, and shade toward the ground.
export function bakeLight(canvas, scale = 1, opts = true) {
  const W = canvas.width, H = canvas.height, g = canvas.getContext('2d');
  const o = typeof opts === 'object' ? opts : {};
  const d = Math.max(1, Math.round(2.4 * scale));
  const band = (color, dx, dy, alpha) => {
    const m = document.createElement('canvas'); m.width = W; m.height = H;
    const mg = m.getContext('2d');
    mg.drawImage(canvas, 0, 0); mg.globalCompositeOperation = 'source-in'; mg.fillStyle = color; mg.fillRect(0, 0, W, H);
    mg.globalCompositeOperation = 'destination-out'; mg.drawImage(canvas, dx, dy);
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alpha; g.drawImage(m, 0, 0); g.restore();
  };
  g.save(); g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(0, 0, W * 0.75, H);
  lg.addColorStop(0, 'rgba(255,236,200,0.20)'); lg.addColorStop(0.42, 'rgba(255,236,200,0)'); lg.addColorStop(0.7, 'rgba(14,8,26,0.06)'); lg.addColorStop(1, 'rgba(14,8,26,0.32)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.restore();
  band(o.key || '#fff0cc', d, d, 0.55);
  band(o.rim || '#8ab8ff', -d, -d * 0.6, o.boss ? 0.55 : 0.32);
  if (o.boss) {
    // painterly grain inside the shapes, then bloom: the brightest parts (eyes, gems, fire) glow past their edges
    const n = document.createElement('canvas'); n.width = 96; n.height = 96;
    const ng = n.getContext('2d'), img = ng.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) { const v = 110 + Math.random() * 60; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 26; }
    ng.putImageData(img, 0, 0);
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
    if ('filter' in g) {
      const b = document.createElement('canvas'); b.width = W; b.height = H;
      const bg = b.getContext('2d');
      bg.filter = `brightness(0.5) contrast(3.4) saturate(1.5) blur(${Math.round(5 * scale)}px)`;
      bg.drawImage(canvas, 0, 0);
      if (bg.filter !== 'none') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.75; g.drawImage(b, 0, 0); g.restore(); }
    }
  }
}

export function rasterize(spec, scale = ART_SCALE) {
  const W = Math.ceil(spec.w * scale), H = Math.ceil(spec.h * scale);
  const scaled = spec.svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${W}" height="${H}"`);
  const img = new Image();
  img.decoding = 'async';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(scaled);
  return img.decode().then(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.getContext('2d').drawImage(img, 0, 0, W, H);
    if (spec.light) bakeLight(canvas, scale, spec.light);
    const white = document.createElement('canvas');
    white.width = W; white.height = H;
    const w = white.getContext('2d');
    w.drawImage(canvas, 0, 0);
    w.globalCompositeOperation = 'source-in';
    w.fillStyle = '#fff8ea';
    w.fillRect(0, 0, W, H);
    return { canvas, white, w: spec.w, h: spec.h, ax: spec.ax, ay: spec.ay, ...(spec.meta || {}) };
  });
}

export async function rasterizeAll(specs) {
  const keys = Object.keys(specs);
  const out = {};
  const results = await Promise.all(keys.map((k) => rasterize(specs[k]).catch((e) => {
    throw new Error(`ภาพ "${k}" โหลดไม่สำเร็จ: ${e.message || e}`);
  })));
  keys.forEach((k, i) => { out[k] = results[i]; });
  return out;
}
