// Skill and ultimate visual effects. Pure drawing: nothing here deals damage (see battle/skillCast.js).
// Every effect is a small record { type, t, dur, ... } in a list; update() ages them, drawGround() paints what lies
// on the floor (runes, shockwaves, fields, cracks) under the characters and drawAir() what flies or shines above them
// (beams, bolts, meteors, slashes, auras). The same effects are replayed on other players' screens from a cast message.

const TAU = Math.PI * 2;
export const EL = Object.freeze({
  fire: { core: '#fff1c2', glow: '#ff8a3d', deep: '#c2412f', spark: ['#ffcf5a', '#ff8a3d', '#fff3c4'] },
  ice: { core: '#f4fdff', glow: '#8fd6ff', deep: '#3a7fbf', spark: ['#e8f8ff', '#bfe8ff', '#8fd6ff'] },
  volt: { core: '#ffffe6', glow: '#ffe65a', deep: '#7a6cff', spark: ['#fff9c4', '#ffe65a', '#c8d8ff'] },
  wind: { core: '#f6fffb', glow: '#9fe6cf', deep: '#3f9c86', spark: ['#e6fff6', '#cdf3e6', '#9fe6cf'] },
  earth: { core: '#fff0c8', glow: '#d8a85a', deep: '#6b4a2a', spark: ['#f0d89a', '#c8a060', '#8a6a3a'] },
  shadow: { core: '#f0d8ff', glow: '#9a6aff', deep: '#2a1a48', spark: ['#c8a8ff', '#9a6aff', '#5a3a9a'] },
  holy: { core: '#ffffff', glow: '#fff0a0', deep: '#e0b45a', spark: ['#ffffff', '#fff3c4', '#ffe08a'] },
  poison: { core: '#f3ffd0', glow: '#a8e05a', deep: '#6a3a9a', spark: ['#e8ff9a', '#b07ad0', '#a8e05a'] },
  blood: { core: '#ffe0e0', glow: '#ff4a5a', deep: '#7a0a1a', spark: ['#ff8a8a', '#ff4a5a', '#c2142a'] },
  void: { core: '#e8e0ff', glow: '#7a5aff', deep: '#0a0618', spark: ['#c8b8ff', '#7a5aff', '#ffffff'] },
  nature: { core: '#f0ffd8', glow: '#7fd06a', deep: '#2f6a2a', spark: ['#c9e48e', '#7fd06a', '#f3a6c8'] },
  water: { core: '#f0fbff', glow: '#5ac8ff', deep: '#1a4a8a', spark: ['#bfe8ff', '#5ac8ff', '#ffffff'] },
  star: { core: '#ffffff', glow: '#b8d0ff', deep: '#4a3a9a', spark: ['#ffffff', '#d8e4ff', '#ffe8a8'] },
  arcane: { core: '#fff0ff', glow: '#ff7ad8', deep: '#6a2a8a', spark: ['#ffd0f0', '#ff7ad8', '#c8a8ff'] },
  steel: { core: '#ffffff', glow: '#cfe0f0', deep: '#5a6a80', spark: ['#ffffff', '#e0ecf8', '#a8b8cc'] },
});
export const elOf = (k) => EL[k] || EL.fire;

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIn = (t) => t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
// a little deterministic noise so remote screens draw the same jagged bolts and cracks
function rnd(seed) { let s = (seed * 9301 + 49297) % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

export function createSkillFx() {
  const list = [];
  return {
    list,
    add(o) {
      if (list.length > 160) list.shift();
      const e = { t: 0, dur: 0.6, seed: (Math.random() * 1e6) | 0, ...o };
      list.push(e);
      return e;
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.t += dt;
        if (e.follow) { e.x = e.follow.x + (e.fx || 0); e.y = e.follow.y + (e.fy || 0); }
        if (e.type === 'meteor' || e.type === 'arcwave' || e.type === 'orb') { e.x += (e.vx || 0) * dt; e.y += (e.vy || 0) * dt; }
        if (e.t >= e.dur || e.kill) list.splice(i, 1);
      }
    },
    drawGround(ctx, time) { for (const e of list) if (GROUND[e.type]) GROUND[e.type](ctx, e, time); },
    drawAir(ctx, time) { for (const e of list) if (AIR[e.type]) AIR[e.type](ctx, e, time); },
    clear() { list.length = 0; },
  };
}

// ------------------------------------------------------------------ ground layer
const GROUND = {
  // expanding shockwave: bright band, a soft inner flash and radial streaks
  shock(ctx, e) {
    const C = elOf(e.el), k = clamp01(e.t / e.dur), r = (e.r0 || 10) + (e.r - (e.r0 || 10)) * ease(k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const band = Math.max(4, (e.band || 26) * (1 - k * 0.6));
    const g = ctx.createRadialGradient(e.x, e.y, Math.max(0, r - band), e.x, e.y, r + 2);
    g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(0.7, hexA(C.glow, 0.55 * (1 - k))); g.addColorStop(1, hexA(C.core, 0.9 * (1 - k)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r + 2, 0, TAU); ctx.fill();
    if (k < 0.35) { ctx.globalAlpha = (0.35 - k) / 0.35 * 0.6; ctx.fillStyle = C.core; ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.55, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    const n = e.streaks ?? 14, R = rnd(e.seed);
    ctx.strokeStyle = hexA(C.core, 0.8 * (1 - k)); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R() * 0.4, l = 10 + R() * 26;
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * (r - l), e.y + Math.sin(a) * (r - l)); ctx.lineTo(e.x + Math.cos(a) * (r + 6), e.y + Math.sin(a) * (r + 6)); ctx.stroke();
    }
    ctx.restore();
  },
  // magic circle: two counter-rotating rings of runes and a star polygon
  rune(ctx, e, time) {
    const C = elOf(e.el), k = e.t / e.dur, a = Math.min(1, e.t / 0.18) * Math.min(1, (e.dur - e.t) / 0.25);
    const r = e.r * (0.7 + 0.3 * ease(e.t / 0.3));
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, e.flat ?? 0.62); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, hexA(C.glow, 0.28)); g.addColorStop(0.75, hexA(C.glow, 0.1)); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.core; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.stroke();
    const sides = e.sides || 6, spin = time * (e.spin ?? 0.8) + k;
    ctx.strokeStyle = C.glow; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) { const ang = spin + (i * 2 * TAU) / sides; const px = Math.cos(ang) * r * 0.8, py = Math.sin(ang) * r * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    // rune ticks around the rim
    ctx.save(); ctx.rotate(-spin * 1.4);
    ctx.fillStyle = C.core;
    const n = Math.max(8, Math.round(r / 7));
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU; ctx.save(); ctx.rotate(ang); ctx.translate(r * 0.91, 0); ctx.fillRect(-1.5, -4 - (i % 3) * 1.5, 3, 8 + (i % 3) * 3); ctx.restore(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.stroke();
    ctx.restore();
  },
  // a lasting area: soft disc, drifting motes and a pulsing rim
  field(ctx, e, time) {
    const C = elOf(e.el), a = Math.min(1, e.t / 0.25) * Math.min(1, (e.dur - e.t) / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(e.x, e.y, e.r * 0.15, e.x, e.y, e.r);
    g.addColorStop(0, hexA(C.glow, 0.32)); g.addColorStop(1, hexA(C.deep, 0.12));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(C.core, 0.45 + 0.25 * Math.sin(time * 6)); ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]); ctx.lineDashOffset = -time * 40;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const R = rnd(e.seed);
    for (let i = 0; i < 14; i++) {
      const ang = R() * TAU + time * (0.3 + R() * 0.6) * (i % 2 ? 1 : -1), rr = e.r * (0.15 + 0.8 * R());
      const y = e.y + Math.sin(ang) * rr - ((time * 30 + i * 13) % 26);
      ctx.fillStyle = C.spark[i % C.spark.length]; ctx.beginPath(); ctx.arc(e.x + Math.cos(ang) * rr, y, 2 + (i % 3), 0, TAU); ctx.fill();
    }
    if (e.motif === 'ice') for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU + 0.3; spike(ctx, e.x + Math.cos(ang) * e.r * 0.6, e.y + Math.sin(ang) * e.r * 0.6, 14 + (i % 3) * 6, C); }
    if (e.motif === 'thorn') for (let i = 0; i < 10; i++) { const ang = (i / 10) * TAU; thorn(ctx, e.x + Math.cos(ang) * e.r * 0.7, e.y + Math.sin(ang) * e.r * 0.7, 18, C); }
    if (e.motif === 'flame') for (let i = 0; i < 9; i++) { const ang = (i / 9) * TAU + time * 0.4; tongue(ctx, e.x + Math.cos(ang) * e.r * 0.65, e.y + Math.sin(ang) * e.r * 0.65, 20 + 8 * Math.sin(time * 9 + i), C); }
    ctx.restore();
  },
  // ground cracks radiating from a point (slams, quakes, meteor craters)
  crack(ctx, e) {
    const C = elOf(e.el), k = e.t / e.dur, a = Math.min(1, (1 - k) * 2);
    const R = rnd(e.seed), n = e.n || 7;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      let ang = (e.a ?? 0) + (e.spread ?? TAU) * (i / n - (e.spread ? 0.5 : 0)) + (R() - 0.5) * 0.4, x = e.x, y = e.y;
      const len = e.r * (0.6 + R() * 0.5) * ease(e.t / 0.15);
      const pts = [[x, y]];
      for (let s = 0; s < 5; s++) { ang += (R() - 0.5) * 0.7; x += Math.cos(ang) * len / 5; y += Math.sin(ang) * len / 5 * 0.7; pts.push([x, y]); }
      ctx.strokeStyle = 'rgba(12,8,6,0.75)'; ctx.lineWidth = 5; path(ctx, pts); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA(C.glow, 0.85); ctx.lineWidth = 2; path(ctx, pts); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  },
  // a ribbon left behind by a dash
  trail(ctx, e) {
    const C = elOf(e.el), k = e.t / e.dur;
    const dx = e.x2 - e.x, dy = e.y2 - e.y, len = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
    const w = (e.w || 34) * (1 - k * 0.7);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(0.7, hexA(C.glow, 0.55 * (1 - k))); g.addColorStop(1, hexA(C.core, 0.9 * (1 - k)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -w / 2, len, -w * 0.3); ctx.lineTo(len, w * 0.3); ctx.quadraticCurveTo(len * 0.5, w / 2, 0, 0); ctx.fill();
    ctx.strokeStyle = hexA(C.core, 0.9 * (1 - k)); ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(len * 0.15, i * w * 0.18); ctx.lineTo(len, i * w * 0.12); ctx.stroke(); }
    ctx.restore();
  },
  // a spiral of arms swirling into the centre
  vortex(ctx, e, time) {
    const C = elOf(e.el), a = Math.min(1, e.t / 0.2) * Math.min(1, (e.dur - e.t) / 0.3);
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.7); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r);
    g.addColorStop(0, hexA(C.deep, 0.85)); g.addColorStop(0.5, hexA(C.deep, 0.4)); g.addColorStop(1, hexA(C.deep, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const arms = e.arms || 4;
    for (let i = 0; i < arms; i++) {
      ctx.strokeStyle = hexA(i % 2 ? C.glow : C.core, 0.75); ctx.lineWidth = 3;
      ctx.beginPath();
      for (let s = 0; s <= 30; s++) { const f = s / 30; const ang = time * 4 + (i / arms) * TAU + f * 5; const rr = e.r * (1 - f); const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.fillStyle = '#000'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.9;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.16, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = C.core; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.17, 0, TAU); ctx.stroke();
    ctx.restore();
  },
  // spikes erupting along a line, one after another
  spikes(ctx, e) {
    const C = elOf(e.el), n = e.n || 8, step = e.len / n;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const tt = e.t - i * (e.gap || 0.05);
      if (tt < 0) continue;
      const k = clamp01(tt / 0.12), fade = clamp01((e.dur - e.t) / 0.3);
      const x = e.x + Math.cos(e.a) * step * (i + 0.5), y = e.y + Math.sin(e.a) * step * (i + 0.5);
      ctx.globalAlpha = fade;
      const hgt = (e.h || 46) * k * (0.8 + 0.4 * ((i * 7) % 3) / 2);
      if (e.motif === 'ice') spike(ctx, x, y, hgt, C); else thorn(ctx, x, y, hgt, C);
      if (e.motif !== 'ice') spike(ctx, x + 10, y + 4, hgt * 0.6, C);
    }
    ctx.restore();
  },
  // a mine or trap sigil
  sigil(ctx, e, time) {
    const C = elOf(e.el), a = Math.min(1, e.t / 0.2) * Math.min(1, (e.dur - e.t) / 0.3), pulse = 0.5 + 0.5 * Math.sin(time * 8);
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.6); ctx.globalAlpha = a;
    ctx.strokeStyle = hexA(C.glow, 0.5 + pulse * 0.4); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.stroke();
    ctx.rotate(time * 1.5);
    ctx.beginPath(); for (let i = 0; i <= 4; i++) { const ang = (i / 4) * TAU; const px = Math.cos(ang) * e.r * 0.7, py = Math.sin(ang) * e.r * 0.7; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(C.core, 0.4 + pulse * 0.5); ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

// ------------------------------------------------------------------ air layer
const AIR = {
  flash(ctx, e) {
    const C = elOf(e.el), k = e.t / e.dur;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
    g.addColorStop(0, hexA(C.core, 0.95 * (1 - k))); g.addColorStop(0.4, hexA(C.glow, 0.5 * (1 - k))); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    if (e.rays) {
      ctx.strokeStyle = hexA(C.core, 0.7 * (1 - k)); ctx.lineWidth = 3;
      for (let i = 0; i < e.rays; i++) { const a = (i / e.rays) * TAU + e.seed; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * e.r * 0.2, e.y + Math.sin(a) * e.r * 0.2); ctx.lineTo(e.x + Math.cos(a) * e.r * (0.8 + k), e.y + Math.sin(a) * e.r * (0.8 + k)); ctx.stroke(); }
    }
    ctx.restore();
  },
  // a beam: flickering core, wide glow, end flare and rings travelling along it
  beam(ctx, e, time) {
    const C = elOf(e.el), k = e.t / e.dur, grow = ease(e.t / 0.08), fade = Math.min(1, (e.dur - e.t) / 0.2);
    const L = e.len * grow, W = e.w * (0.85 + 0.15 * Math.sin(time * 50)) * fade;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -W, 0, W);
    g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(0.5, hexA(C.glow, 0.7)); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(0, -W, L, W * 2);
    ctx.fillStyle = hexA(C.core, 0.95); ctx.fillRect(0, -W * 0.22, L, W * 0.44);
    // travelling rings
    ctx.strokeStyle = hexA(C.core, 0.6); ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const x = ((time * 900 + i * L / 5) % L); ctx.beginPath(); ctx.ellipse(x, 0, 5, W * 0.9, 0, 0, TAU); ctx.stroke(); }
    // muzzle and end flare
    const fl = (x, s) => { const gg = ctx.createRadialGradient(x, 0, 0, x, 0, s); gg.addColorStop(0, hexA(C.core, 0.95 * fade)); gg.addColorStop(1, hexA(C.glow, 0)); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, 0, s, 0, TAU); ctx.fill(); };
    fl(0, W * 1.6); fl(L, W * 2.2);
    ctx.restore();
    if (k > 0.98) e.kill = true;
  },
  // jagged lightning between two points, with side branches (redrawn every few frames)
  bolt(ctx, e, time) {
    const C = elOf(e.el), fade = 1 - e.t / e.dur;
    const R = rnd(e.seed + Math.floor(time * 24));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = jag(e.x, e.y, e.x2, e.y2, e.segs || 9, e.jit || 26, R);
    ctx.strokeStyle = hexA(C.glow, 0.45 * fade); ctx.lineWidth = (e.w || 4) * 3.5; path(ctx, pts); ctx.stroke();
    ctx.strokeStyle = hexA(C.core, fade); ctx.lineWidth = e.w || 4; path(ctx, pts); ctx.stroke();
    for (let b = 0; b < 2; b++) {
      const i = 2 + Math.floor(R() * (pts.length - 4)); const [bx, by] = pts[i];
      const ang = Math.atan2(e.y2 - e.y, e.x2 - e.x) + (R() - 0.5) * 2.2, l = 30 + R() * 40;
      const bp = jag(bx, by, bx + Math.cos(ang) * l, by + Math.sin(ang) * l, 4, 10, R);
      ctx.strokeStyle = hexA(C.core, 0.7 * fade); ctx.lineWidth = 1.6; path(ctx, bp); ctx.stroke();
    }
    ctx.restore();
  },
  // a pillar of light (judgment, heals, impacts from above)
  pillar(ctx, e, time) {
    const C = elOf(e.el), k = e.t / e.dur, grow = ease(e.t / 0.12), fade = Math.min(1, (e.dur - e.t) / 0.3);
    const W = e.w * (1 - k * 0.4), H = e.h || 520;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(e.x - W, 0, e.x + W, 0);
    g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(0.5, hexA(C.glow, 0.75 * fade)); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(e.x - W, e.y - H * grow, W * 2, H * grow);
    ctx.fillStyle = hexA(C.core, 0.9 * fade); ctx.fillRect(e.x - W * 0.2, e.y - H * grow, W * 0.4, H * grow);
    ctx.fillStyle = hexA(C.core, 0.7 * fade);
    for (let i = 0; i < 6; i++) { const yy = e.y - ((time * 500 + i * 90) % H); ctx.fillRect(e.x - W * 0.6 + (i % 3) * W * 0.5, yy, 2, 18); }
    ctx.restore();
  },
  // a falling rock or star with a burning tail; explodes on landing (the caster adds the blast)
  meteor(ctx, e) {
    const C = elOf(e.el), k = easeIn(clamp01(e.t / e.dur));
    const H = e.h || 520, DX = e.dx ?? H * 0.45;
    const sx = e.tx + DX * (1 - k), sy = e.ty - H * (1 - k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const tail = 150;
    const ang = Math.atan2(H, -DX);
    ctx.translate(sx, sy); ctx.rotate(ang);
    const g = ctx.createLinearGradient(-tail, 0, 0, 0);
    g.addColorStop(0, hexA(C.glow, 0)); g.addColorStop(1, hexA(C.glow, 0.85));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-tail, 0); ctx.lineTo(0, -(e.size || 18)); ctx.lineTo(0, e.size || 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.core; ctx.beginPath(); ctx.arc(0, 0, (e.size || 18) * 0.8, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (e.rock) { ctx.fillStyle = '#3a2a24'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(2, 0, (e.size || 18) * 0.6, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    // landing marker
    ctx.save(); ctx.strokeStyle = hexA(C.glow, 0.6); ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.ellipse(e.tx, e.ty, (e.mark || 40) * (0.5 + k * 0.5), (e.mark || 40) * 0.5 * (0.5 + k * 0.5), 0, 0, TAU); ctx.stroke(); ctx.restore();
  },
  // a crescent wave flying forward
  arcwave(ctx, e) {
    const C = elOf(e.el), fade = Math.min(1, (e.dur - e.t) / 0.15), a = Math.atan2(e.vy, e.vx);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
    const R = e.r || 60, th = (e.th || 18);
    for (const [col, s, al] of [[C.glow, 1.4, 0.45], [C.core, 1, 0.95]]) {
      ctx.fillStyle = hexA(col, al * fade);
      ctx.beginPath(); ctx.arc(-R * 0.6, 0, R, -1.1, 1.1); ctx.arc(-R * 0.6 - th * s, 0, R - th * 0.2, 1.1, -1.1, true); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  // a glowing orb (homing spirits, fire orbs) — moved by the caster
  orb(ctx, e, time) {
    const C = elOf(e.el), r = (e.r || 12) * (1 + 0.12 * Math.sin(time * 14 + e.seed));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 2.4);
    g.addColorStop(0, hexA(C.core, 0.95)); g.addColorStop(0.35, hexA(C.glow, 0.7)); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r * 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  },
  // blades or orbs circling an anchor
  orbit(ctx, e, time) {
    const C = elOf(e.el), n = e.n || 4, a0 = time * (e.spin || 4), fade = Math.min(1, (e.dur - e.t) / 0.3) * Math.min(1, e.t / 0.2);
    ctx.save(); ctx.globalAlpha = fade;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, x = e.x + Math.cos(a) * e.r, y = e.y - 26 + Math.sin(a) * e.r * 0.55;
      if (e.motif === 'blade') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(C.glow, 0.5); ctx.beginPath(); ctx.ellipse(0, 0, 9, 26, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = C.core; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(5, 6); ctx.lineTo(0, 12); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 18); g.addColorStop(0, hexA(C.core, 0.95)); g.addColorStop(1, hexA(C.glow, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  },
  // flame / frost / sound cone with flickering tongues
  cone(ctx, e, time) {
    const C = elOf(e.el), grow = ease(e.t / 0.12), fade = Math.min(1, (e.dur - e.t) / 0.25);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.globalCompositeOperation = 'lighter';
    const R = e.r * grow, A = e.arc / 2;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, hexA(C.core, 0.85 * fade)); g.addColorStop(0.5, hexA(C.glow, 0.55 * fade)); g.addColorStop(1, hexA(C.deep, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -A, A); ctx.closePath(); ctx.fill();
    const R2 = rnd(e.seed);
    for (let i = 0; i < 9; i++) {
      const ang = -A + (i / 8) * A * 2 + (R2() - 0.5) * 0.1, l = R * (0.6 + 0.4 * Math.abs(Math.sin(time * 12 + i)));
      ctx.strokeStyle = hexA(i % 2 ? C.core : C.glow, 0.6 * fade); ctx.lineWidth = 6 - (i % 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(ang) * l * 0.5, Math.sin(ang) * l * 0.5 + Math.sin(time * 20 + i) * 8, Math.cos(ang) * l, Math.sin(ang) * l); ctx.stroke();
    }
    ctx.restore();
  },
  // several crossing cuts at one point (flurries)
  slashes(ctx, e) {
    const C = elOf(e.el), n = e.n || 5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const R = rnd(e.seed);
    for (let i = 0; i < n; i++) {
      const tt = e.t - i * (e.gap || 0.05); if (tt < 0 || tt > 0.22) { R(); R(); continue; }
      const k = tt / 0.22, a = R() * Math.PI, L = (e.r || 70) * (0.7 + R() * 0.5);
      const cx = e.x + Math.cos(a + 1.3) * 10, cy = e.y + Math.sin(a + 1.3) * 10;
      ctx.strokeStyle = hexA(C.glow, 0.6 * (1 - k)); ctx.lineWidth = 12 * (1 - k);
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * L * ease(k), cy - Math.sin(a) * L * ease(k)); ctx.lineTo(cx + Math.cos(a) * L * ease(k), cy + Math.sin(a) * L * ease(k)); ctx.stroke();
      ctx.strokeStyle = hexA(C.core, 1 - k); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * L * ease(k), cy - Math.sin(a) * L * ease(k)); ctx.lineTo(cx + Math.cos(a) * L * ease(k), cy + Math.sin(a) * L * ease(k)); ctx.stroke();
    }
    ctx.restore();
  },
  // a sweeping arc of steel (big swings in skills and ultimates)
  arc(ctx, e) {
    const C = elOf(e.el), k = clamp01(e.t / e.dur), sweep = e.arc * ease(k * 1.6), fade = 1 - k;
    const a0 = e.a - e.arc / 2 * (e.rev ? -1 : 1), dir = e.rev ? -1 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [col, w, al] of [[C.glow, e.th * 1.8, 0.5], [C.core, e.th, 0.95]]) {
      ctx.strokeStyle = hexA(col, al * fade); ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, a0 + dir * Math.max(0, sweep - 1.4), a0 + dir * sweep, dir < 0); ctx.stroke();
    }
    ctx.restore();
  },
  // a burning / glowing aura around the hero for buffs
  aura(ctx, e, time) {
    const C = elOf(e.el), fade = Math.min(1, e.t / 0.2) * Math.min(1, (e.dur - e.t) / 0.4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade * 0.8;
    const x = e.x, y = e.y - 34;
    const g = ctx.createRadialGradient(x, y, 6, x, y, 54);
    g.addColorStop(0, hexA(C.glow, 0.3)); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 40, 58, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const ph = (time * 1.6 + i / 7) % 1, ang = (i / 7) * TAU;
      ctx.fillStyle = hexA(C.spark[i % C.spark.length], 1 - ph);
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 22, y + 30 - ph * 70, 3 * (1 - ph) + 1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },
  // a hexagon shield bubble
  dome(ctx, e, time) {
    const C = elOf(e.el), fade = Math.min(1, e.t / 0.15) * Math.min(1, (e.dur - e.t) / 0.3);
    const x = e.x, y = e.y - 34, R = e.r || 52;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    const g = ctx.createRadialGradient(x, y, R * 0.6, x, y, R);
    g.addColorStop(0, hexA(C.glow, 0.05)); g.addColorStop(1, hexA(C.glow, 0.4));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R, R * 1.15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA(C.core, 0.35 + 0.2 * Math.sin(time * 5)); ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const hx = x + i * 16 + (j % 2) * 8, hy = y + j * 14;
      if (Math.hypot((hx - x) / R, (hy - y) / (R * 1.15)) > 0.9) continue;
      hex(ctx, hx, hy, 8);
    }
    ctx.strokeStyle = hexA(C.core, 0.8); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, R, R * 1.15, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  },
  // a sigil floating over a marked target
  mark(ctx, e, time) {
    const C = elOf(e.el), fade = Math.min(1, e.t / 0.15) * Math.min(1, (e.dur - e.t) / 0.3);
    const x = e.x, y = e.y - (e.h || 90);
    ctx.save(); ctx.translate(x, y); ctx.rotate(time * 2); ctx.globalAlpha = fade; ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = C.glow; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -22); ctx.stroke(); }
    ctx.fillStyle = C.core; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    ctx.restore();
  },
  // a totem pole planted in the ground
  totem(ctx, e, time) {
    const C = elOf(e.el), up = ease(e.t / 0.25), fade = Math.min(1, (e.dur - e.t) / 0.3);
    const x = e.x, y = e.y, H = 70 * up;
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(10,6,4,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, 20, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a3428'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 7, y - H); ctx.lineTo(x + 7, y - H); ctx.lineTo(x + 9, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.deep; ctx.fillRect(x - 11, y - H * 0.55, 22, 10); ctx.strokeRect(x - 11, y - H * 0.55, 22, 10);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - H - 6, 0, x, y - H - 6, 26);
    g.addColorStop(0, hexA(C.core, 0.95)); g.addColorStop(0.4, hexA(C.glow, 0.6 + 0.3 * Math.sin(time * 10))); g.addColorStop(1, hexA(C.glow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - H - 6, 26, 0, TAU); ctx.fill();
    ctx.restore();
  },
  // a shadowy afterimage of the hero (clones, mirages)
  phantom(ctx, e, time) {
    const C = elOf(e.el), fade = Math.min(1, e.t / 0.15) * Math.min(1, (e.dur - e.t) / 0.3);
    if (e.draw) { e.draw(ctx, e, fade); return; }
    ctx.save(); ctx.globalAlpha = 0.55 * fade; ctx.globalCompositeOperation = 'lighter';
    const x = e.x, y = e.y;
    const g = ctx.createLinearGradient(x, y - 90, x, y);
    g.addColorStop(0, hexA(C.core, 0.9)); g.addColorStop(1, hexA(C.glow, 0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - 72, 12, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 14, y - 58); ctx.lineTo(x + 14, y - 58); ctx.lineTo(x + 10, y - 20); ctx.lineTo(x + 14, y); ctx.lineTo(x - 14, y); ctx.lineTo(x - 10, y - 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA(C.core, 0.9); ctx.lineWidth = 4; ctx.lineCap = 'round';
    const sw = Math.sin(time * 12 + e.seed) * 1.4;
    ctx.beginPath(); ctx.moveTo(x + 10, y - 50); ctx.lineTo(x + 10 + Math.cos(sw) * 50, y - 50 + Math.sin(sw) * 50); ctx.stroke();
    ctx.restore();
  },
  // big name of a skill floating up from the caster (helps reading what just happened)
  label(ctx, e) {
    const k = e.t / e.dur, a = Math.min(1, e.t / 0.12) * Math.min(1, (e.dur - e.t) / 0.3);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${e.size || 17}px "Bai Jamjuree", system-ui, sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,10,22,0.9)'; ctx.fillStyle = e.color || '#fff3c4';
    const y = e.y - 140 - k * 22;
    ctx.strokeText(e.text, e.x, y); ctx.fillText(e.text, e.x, y);
    ctx.restore();
  },
};

// other modules (ultimates) add their own effect types
export function registerFx(type, layer, fn) { (layer === 'ground' ? GROUND : AIR)[type] = fn; }

// ------------------------------------------------------------------ small shapes
function spike(ctx, x, y, h, C) {
  ctx.save(); ctx.fillStyle = C.glow; ctx.strokeStyle = C.deep; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - h * 0.22, y); ctx.lineTo(x, y - h); ctx.lineTo(x + h * 0.22, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(x - h * 0.05, y - 2); ctx.lineTo(x, y - h * 0.92); ctx.lineTo(x + h * 0.06, y - 2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function thorn(ctx, x, y, h, C) {
  ctx.save(); ctx.fillStyle = C.deep; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - h * 0.2, y); ctx.quadraticCurveTo(x - h * 0.05, y - h * 0.6, x + h * 0.1, y - h); ctx.quadraticCurveTo(x + h * 0.08, y - h * 0.5, x + h * 0.2, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.glow; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(x + h * 0.02, y - h * 0.5, x + h * 0.09, y - h * 0.94); ctx.stroke();
  ctx.restore();
}
function tongue(ctx, x, y, h, C) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x, y, x, y - h); g.addColorStop(0, hexA(C.glow, 0.85)); g.addColorStop(1, hexA(C.core, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - h * 0.25, y); ctx.quadraticCurveTo(x - h * 0.2, y - h * 0.6, x, y - h); ctx.quadraticCurveTo(x + h * 0.2, y - h * 0.6, x + h * 0.25, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function hex(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
function path(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); }
function jag(x1, y1, x2, y2, n, jit, R) {
  const pts = [[x1, y1]], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  for (let i = 1; i < n; i++) { const f = i / n, o = (R() - 0.5) * jit * 2 * Math.sin(f * Math.PI); pts.push([x1 + dx * f + nx * o, y1 + dy * f + ny * o]); }
  pts.push([x2, y2]);
  return pts;
}
export function hexA(hex6, a) {
  const h = String(hex6).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
