// The skill engine: turns a skill definition (data/skills.js + data/skillbook.js) into hits, hero movement and
// effects. One code path for the dungeon, the online zones and PvP: damage always goes through
// world.playerStrike (src 'skill'), shots through world.firePlayerShot, and visuals into world.sk (a runtime made by
// createSkillRuntime). A cast on another player's screen is replayed with `ghost: true`: same visuals, no damage.
//
// Each skill names a `cast` type and fixed options in `opt`; the numbers that grow with rank (power, radius, …) are
// rank arrays on the skill itself. A hidden `flaw` (self damage, rooted, exposed, slowed, a dodge charge) is the price
// some skills pay; the skill card never lists it.
import { createSkillFx, elOf } from './skillVfx.js';
import { inArc } from '../systems/combat.js';
import { addBuff } from './buffs.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ runtime (one per world)
export function createSkillRuntime() {
  const fx = createSkillFx();
  const acts = [];
  return {
    fx, acts,
    act(a) { acts.push({ t: 0, ...a }); },
    update(dt, w) {
      fx.update(dt);
      for (let i = acts.length - 1; i >= 0; i--) {
        const a = acts[i];
        a.t += dt;
        let keep = true;
        try { keep = a.step(dt, a, w) !== false; } catch { keep = false; }
        if (!keep || a.t > (a.max ?? 12)) acts.splice(i, 1);
      }
    },
    drawGround(ctx, time) { fx.drawGround(ctx, time); },
    drawAir(ctx, time) { fx.drawAir(ctx, time); },
    clear() { fx.clear(); acts.length = 0; },
  };
}

// ------------------------------------------------------------------ helpers
const live = (w) => (w.enemies || []).filter((e) => !e.dead && !(e.spawning > 0) && !e.untargetable && e.x != null);
function nearest(w, x, y, max = 9999, skip = null) {
  let best = null, bd = max;
  for (const e of live(w)) { if (skip && skip.has(e)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
  return best;
}
const within = (w, x, y, r) => live(w).filter((e) => Math.hypot(e.x - x, e.y - y) <= r + (e.r || 20));
function burst(w, x, y, n, el, o = {}) {
  const C = elOf(el);
  w.particles?.burst(x, y, n, { color: C.spark, speedMin: o.min ?? 80, speedMax: o.max ?? 320, life: o.life ?? 0.5, size: o.size ?? 3.5, drag: o.drag ?? 3, grav: o.grav ?? 0, glow: true, shape: o.shape });
}
function opts(v, o, extra = {}) {
  const r = { src: 'skill', ...extra };
  if (o.burn) r.burn = true;
  if (o.slow) { r.slow = o.slow; r.slowT = o.slowT || 1.6; }
  if (v.slow) { r.slow = v.slow; r.slowT = v.slowT || o.slowT || 1.6; }
  if (o.stun || v.stun) r.stun = v.stun || o.stun;
  if (o.mark || v.mark) { r.mark = v.mark || o.mark; r.markT = v.markT || o.markT || 3; }
  if (o.critBonus) r.critBonus = o.critBonus;
  if (o.forceCrit) r.forceCrit = true;
  return r;
}

// the context a cast runs in
function ctxFor(w, p, skill, v, msg) {
  const ghost = !!msg;
  const x = ghost ? msg.x : p.x, y = ghost ? msg.y : p.y;
  let a = ghost ? msg.a : p.facing;
  let tgt = ghost ? null : nearest(w, x, y, skill.opt?.reach ?? 460);
  if (!ghost && tgt) a = Math.atan2(tgt.y - y, tgt.x - x);
  const tx = ghost ? msg.tx : tgt ? tgt.x : x + Math.cos(a) * 160, ty = ghost ? msg.ty : tgt ? tgt.y : y + Math.sin(a) * 160;
  const C = {
    w, p, ghost, skill, v, o: skill.opt || {}, el: skill.el || 'fire', x, y, a, tgt, tx, ty, fx: w.sk.fx,
    hit(e, mult, ex = {}) { if (ghost || !e || e.dead) return null; return w.playerStrike(e, mult, opts(v, C.o, ex)); },
    push(e, from, kb) { const ang = Math.atan2(e.y - from.y, e.x - from.x); return { kx: Math.cos(ang) * kb, ky: Math.sin(ang) * kb }; },
  };
  return C;
}

// ------------------------------------------------------------------ cast types
const CAST = {
  // radial burst around the hero (one or more pulses)
  nova(C) {
    const { v, o, el } = C, n = o.pulses || 1;
    for (let i = 0; i < n; i++) {
      const go = () => {
        const x = C.ghost ? C.x : C.p.x, y = (C.ghost ? C.y : C.p.y) - 14;
        const r = v.radius * (o.grow ? 1 + i * o.grow : 1);
        C.fx.add({ type: 'shock', x, y, r, r0: 16, el, dur: 0.42, band: 30, streaks: 18 });
        C.fx.add({ type: 'flash', x, y, r: r * 0.7, el, dur: 0.25, rays: o.rays || 0 });
        if (o.rune) C.fx.add({ type: 'rune', x, y: y + 14, r: r * 0.9, el, dur: 0.6, sides: o.rune });
        if (o.crack) C.fx.add({ type: 'crack', x, y: y + 14, r, el, dur: 0.9, n: 8 });
        burst(C.w, x, y, 26, el, { max: 380 });
        for (const e of within(C.w, x, y, r)) C.hit(e, v.power, C.push(e, { x, y }, o.kb ?? 300));
        if (v.heal && !C.ghost) heal(C, v.heal);
        C.w.sfx?.(o.sound || 'crit');
        if (i === 0) { C.w.shake?.(o.shake ?? 6, 0.22); C.w.hitStop?.(0.05); }
      };
      if (i === 0) go(); else C.w.sk.act({ step: (dt, a) => { if (a.t >= i * (o.gap || 0.3)) { go(); return false; } } });
    }
    if (!C.ghost) { C.p.spinT = o.spin === false ? 0 : 0.35; }
  },

  // a committed dash that cuts everything on the way (optionally exploding where it ends)
  dash(C) {
    const { v, o, el, p } = C;
    const dist = v.distance || 260, dur = o.time || 0.22;
    if (C.ghost) { C.fx.add({ type: 'trail', x: C.x, y: C.y - 26, x2: C.tx, y2: C.ty - 26, el, dur: 0.4, w: 40 }); return; }
    const sx = p.x, sy = p.y;
    p.lunge = { t: dur, dir: C.a, speed: dist / dur, power: v.power, hit: new Set(), el };
    p.iframes = Math.max(p.iframes, dur + 0.08);
    p.facing = C.a; p.flip = Math.cos(C.a) < 0;
    C.w.sfx?.('dash'); C.w.sfx?.('swing', { power: 1.6 });
    C.w.sk.act({ step: (dt, a) => {
      if (p.lunge && a.t < 2) return true;
      C.fx.add({ type: 'trail', x: sx, y: sy - 26, x2: p.x, y2: p.y - 26, el, dur: 0.45, w: 44 });
      if (o.end) {
        C.fx.add({ type: 'shock', x: p.x, y: p.y - 10, r: o.end, el, dur: 0.4 }); C.fx.add({ type: 'flash', x: p.x, y: p.y - 20, r: o.end * 0.8, el, dur: 0.3, rays: 10 });
        burst(C.w, p.x, p.y - 20, 30, el);
        for (const e of within(C.w, p.x, p.y, o.end)) C.hit(e, v.power * (o.endMult || 1), C.push(e, p, 360));
        C.w.shake?.(8, 0.25); C.w.sfx?.('slam');
      }
      if (o.zap) for (const e of within(C.w, (sx + p.x) / 2, (sy + p.y) / 2, Math.hypot(p.x - sx, p.y - sy) / 2 + 60)) { C.fx.add({ type: 'bolt', x: p.x, y: p.y - 30, x2: e.x, y2: e.y - 30, el, dur: 0.25 }); C.hit(e, v.power * 0.5); }
      if (o.trailField) addField(C, { x: (sx + p.x) / 2, y: (sy + p.y) / 2, r: Math.max(70, Math.hypot(p.x - sx, p.y - sy) / 2), dur: o.trailField, tick: 0.5, power: v.power * 0.18, motif: o.motif });
      return false;
    } });
  },

  // several dashes in a row, each one at the nearest foe
  multidash(C) {
    const { v, o, el, p } = C;
    const n = o.count || 3, dur = 0.16;
    if (C.ghost) { C.fx.add({ type: 'trail', x: C.x, y: C.y - 26, x2: C.tx, y2: C.ty - 26, el, dur: 0.5, w: 30 }); return; }
    let left = n, last = { x: p.x, y: p.y };
    const go = () => {
      const t = nearest(C.w, p.x, p.y, 420);
      const dir = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.facing + (n - left) * 0.9;
      p.lunge = { t: dur, dir, speed: (v.distance || 220) / dur, power: v.power, hit: new Set(), el };
      p.iframes = Math.max(p.iframes, dur + 0.1); p.facing = dir; p.flip = Math.cos(dir) < 0;
      C.w.sfx?.('dash'); left -= 1;
    };
    go();
    C.w.sk.act({ step: () => {
      if (p.lunge) return true;
      C.fx.add({ type: 'trail', x: last.x, y: last.y - 26, x2: p.x, y2: p.y - 26, el, dur: 0.35, w: 30 });
      last = { x: p.x, y: p.y };
      if (left > 0) { go(); return true; }
      return false;
    } });
  },

  // vanish and reappear behind the nearest foe with a sure critical
  blink(C) {
    const { v, o, el, p } = C;
    if (C.ghost) { C.fx.add({ type: 'phantom', x: C.x, y: C.y, el, dur: 0.5 }); C.fx.add({ type: 'flash', x: C.tx, y: C.ty - 30, r: 90, el, dur: 0.3, rays: 8 }); C.fx.add({ type: 'slashes', x: C.tx, y: C.ty - 30, r: 70, n: 3, el, dur: 0.4 }); return; }
    const t = C.tgt && Math.hypot(C.tgt.x - p.x, C.tgt.y - p.y) < (v.range || 420) ? C.tgt : null;
    C.fx.add({ type: 'phantom', x: p.x, y: p.y, el, dur: 0.55 });
    if (t) {
      const back = Math.atan2(t.y - p.y, t.x - p.x);
      p.x = t.x + Math.cos(back) * ((t.r || 20) + 34); p.y = t.y + Math.sin(back) * ((t.r || 20) + 20);
      C.w.clampBody?.(p);
      p.facing = back + Math.PI; p.flip = Math.cos(p.facing) < 0;
      C.fx.add({ type: 'slashes', x: t.x, y: t.y - 30, r: 80, n: o.cuts || 3, el, dur: 0.45 });
      C.hit(t, v.power, { forceCrit: true, kx: Math.cos(p.facing) * 200, ky: Math.sin(p.facing) * 200 });
    } else { p.x += Math.cos(p.facing) * 180; p.y += Math.sin(p.facing) * 180; C.w.clampBody?.(p); }
    C.fx.add({ type: 'flash', x: p.x, y: p.y - 30, r: 90, el, dur: 0.3, rays: 8 });
    burst(C.w, p.x, p.y - 30, 18, el);
    p.iframes = Math.max(p.iframes, 0.25);
    p.act = { anim: 'iai', dir: p.facing, t: 0, dur: 0.35 };
    C.w.sfx?.('blink'); C.w.sfx?.('crit');
  },

  // jump between several foes, striking each
  mirage(C) {
    const { v, o, el, p } = C;
    if (C.ghost) { for (let i = 0; i < 3; i++) C.fx.add({ type: 'phantom', x: C.tx + Math.cos(i * 2.1) * 60, y: C.ty + Math.sin(i * 2.1) * 30, el, dur: 0.7 }); C.fx.add({ type: 'slashes', x: C.tx, y: C.ty - 30, r: 90, n: 6, el, dur: 0.6 }); return; }
    const hit = new Set();
    let n = o.count || 4;
    C.fx.add({ type: 'phantom', x: p.x, y: p.y, el, dur: 0.5 });
    p.iframes = Math.max(p.iframes, n * 0.14 + 0.3);
    C.w.sk.act({ step: (dt, a) => {
      if (a.t < (o.gap || 0.13) * (o.count - n)) return true;
      const t = nearest(C.w, p.x, p.y, 520, hit) || nearest(C.w, p.x, p.y, 520);
      if (!t || n <= 0) return false;
      hit.add(t); n -= 1;
      const ang = Math.random() * TAU;
      C.fx.add({ type: 'phantom', x: p.x, y: p.y, el, dur: 0.35 });
      p.x = t.x + Math.cos(ang) * 50; p.y = t.y + Math.sin(ang) * 26; C.w.clampBody?.(p);
      p.facing = Math.atan2(t.y - p.y, t.x - p.x); p.flip = Math.cos(p.facing) < 0;
      p.act = { anim: n % 2 ? 'slash' : 'slashUp', dir: p.facing, t: 0, dur: 0.14 };
      C.fx.add({ type: 'slashes', x: t.x, y: t.y - 30, r: 70, n: 2, el, dur: 0.3 });
      C.hit(t, v.power, { kx: Math.cos(p.facing) * 120, ky: Math.sin(p.facing) * 120 });
      C.w.sfx?.('blink');
      return n > 0;
    } });
  },

  // a fan (or ring) of projectiles
  volley(C) {
    const { v, o, el } = C;
    const n = v.count || o.count || 5, spread = o.spread ?? 0.9, base = C.a;
    if (C.ghost) return;           // the shots themselves are shared as 'shot' messages in PvP
    const C2 = tintOf(el);
    for (let i = 0; i < n; i++) {
      const go = () => {
        const p = C.p;
        const ang = o.radial ? (i / n) * TAU + base : n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1) + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0);
        C.w.firePlayerShot({ kind: o.kind || 'bolt', x: p.x + Math.cos(ang) * 24, y: p.y - 30 + Math.sin(ang) * 10, angle: ang, speed: o.speed || 640, r: o.r || 9, power: v.power, pierce: o.pierce || 0, homing: o.homing || 0,
          src: 'skill', life: o.life || 1.2, kb: o.kb || 120, burn: !!o.burn, slow: o.slow || 0, mark: o.mark || 0, tint: C2, forceCrit: !!o.forceCrit });
      };
      if (!o.stagger) go(); else C.w.sk.act({ step: (dt, a) => { if (a.t >= i * o.stagger) { go(); return false; } } });
    }
    C.fx.add({ type: 'flash', x: C.p.x + Math.cos(base) * 30, y: C.p.y - 30, r: 60, el, dur: 0.2, rays: 6 });
    C.w.sfx?.(o.sound || 'bow', { power: 1.4 });
    C.p.act = { anim: o.anim || 'cast', dir: base, t: 0, dur: 0.3 };
  },

  // a straight beam (instant, or ticking while it lasts)
  beam(C) {
    const { v, o, el } = C;
    const n = o.beams || 1, ticks = o.ticks || 1, gap = o.gap || 0.2;
    for (let b = 0; b < n; b++) {
      const ang = C.a + (n > 1 ? (b - (n - 1) / 2) * (o.fan || 0.35) : 0);
      const ox = C.ghost ? C.x : C.p.x, oy = (C.ghost ? C.y : C.p.y) - 30;
      C.fx.add({ type: 'beam', x: ox + Math.cos(ang) * 20, y: oy + Math.sin(ang) * 8, a: ang, len: v.length || 520, w: o.width || 22, el, dur: ticks * gap + 0.25, follow: o.follow && !C.ghost ? C.p : null, fx: Math.cos(ang) * 20, fy: -30 });
      if (C.ghost) continue;
      const hitOnce = new Set();
      for (let i = 0; i < ticks; i++) C.w.sk.act({ step: (dt, a) => {
        if (a.t < i * gap) return true;
        const px = (o.follow ? C.p.x : ox), py = (o.follow ? C.p.y - 30 : oy);
        for (const e of live(C.w)) {
          if (!o.ticks && hitOnce.has(e)) continue;
          const dx = e.x - px, dy = e.y - 30 - py, along = dx * Math.cos(ang) + dy * Math.sin(ang), across = -dx * Math.sin(ang) + dy * Math.cos(ang);
          if (along < 0 || along > (v.length || 520) || Math.abs(across) > (o.width || 22) + (e.r || 20)) continue;
          hitOnce.add(e);
          C.hit(e, v.power / ticks * (o.tickBoost || 1), { kx: Math.cos(ang) * 90, ky: Math.sin(ang) * 90 });
          burst(C.w, e.x, e.y - 30, 6, el, { max: 200, life: 0.3 });
        }
        return false;
      } });
    }
    C.w.sfx?.('cast', { power: 1.8 }); C.w.shake?.(4, 0.2);
    if (!C.ghost) C.p.act = { anim: 'castBig', dir: C.a, t: 0, dur: Math.max(0.35, ticks * gap) };
  },

  // things falling from the sky onto targets
  meteor(C) {
    const { v, o, el } = C;
    const n = v.count || o.count || 1, delay = o.delay || 0.7;
    const pts = [];
    const foes = C.ghost ? [] : live(C.w).sort((a, b) => Math.hypot(a.x - C.p.x, a.y - C.p.y) - Math.hypot(b.x - C.p.x, b.y - C.p.y));
    for (let i = 0; i < n; i++) {
      let x, y;
      if (o.each && foes.length) { const e = foes[i % foes.length]; x = e.x; y = e.y; }
      else if (o.around) { const ang = Math.random() * TAU, d = 40 + Math.random() * (o.around); x = (C.ghost ? C.x : C.p.x) + Math.cos(ang) * d; y = (C.ghost ? C.y : C.p.y) + Math.sin(ang) * d * 0.7; }
      else { const s = o.spread || 0; x = C.tx + (n > 1 ? (Math.random() - 0.5) * s * 2 : 0); y = C.ty + (n > 1 ? (Math.random() - 0.5) * s : 0); }
      pts.push([x, y]);
    }
    pts.forEach(([x, y], i) => {
      const at = i * (o.stagger || 0);
      C.w.sk.act({ step: (dt, a) => {
        if (a.t < at) return true;
        if (!a.spawned) {
          a.spawned = true;
          if (o.pillar) C.fx.add({ type: 'rune', x, y, r: v.radius, el, dur: delay + 0.3, sides: 5 });
          else C.fx.add({ type: 'meteor', tx: x, ty: y - 10, el, dur: delay, size: o.size || 18, rock: !!o.rock, mark: v.radius });
        }
        if (a.t < at + delay) return true;
        if (o.pillar) C.fx.add({ type: 'pillar', x, y, w: v.radius * 0.6, el, dur: 0.5 });
        if (o.bolt) C.fx.add({ type: 'bolt', x: x + 40, y: y - 520, x2: x, y2: y - 10, el, dur: 0.3, w: 5, segs: 12, jit: 30 });
        C.fx.add({ type: 'shock', x, y: y - 6, r: v.radius, el, dur: 0.4 });
        C.fx.add({ type: 'flash', x, y: y - 20, r: v.radius * 0.9, el, dur: 0.3, rays: 10 });
        if (!o.pillar && !o.bolt) C.fx.add({ type: 'crack', x, y, r: v.radius, el, dur: 1.1 });
        burst(C.w, x, y - 20, 22, el, { grav: 300 });
        for (const e of within(C.w, x, y, v.radius)) C.hit(e, v.power, C.push(e, { x, y }, 260));
        C.w.shake?.(o.shake ?? 7, 0.25); C.w.sfx?.(o.bolt ? 'crit' : 'slam');
        return false;
      } });
    });
    C.w.sfx?.('cast', { power: 1.4 });
    if (!C.ghost) C.p.act = { anim: 'castBig', dir: C.a, t: 0, dur: 0.4 };
  },

  // a cone in front (breath, roar, frost)
  cone(C) {
    const { v, o, el } = C;
    const ticks = o.ticks || 1, gap = o.gap || 0.18, arc = o.arc || 1.1, r = v.radius || 260;
    C.fx.add({ type: 'cone', x: (C.ghost ? C.x : C.p.x) + Math.cos(C.a) * 16, y: (C.ghost ? C.y : C.p.y) - 26, a: C.a, r, arc, el, dur: ticks * gap + 0.3, follow: !C.ghost ? C.p : null, fx: Math.cos(C.a) * 16, fy: -26 });
    if (C.ghost) return;
    for (let i = 0; i < ticks; i++) C.w.sk.act({ step: (dt, a) => {
      if (a.t < i * gap) return true;
      for (const e of live(C.w)) if (inArc(C.p.x, C.p.y - 20, C.a, r, arc, e.x, e.y - 20, e.r || 20)) C.hit(e, v.power / ticks, C.push(e, C.p, o.kb ?? 60));
      return false;
    } });
    C.w.sfx?.(o.sound || 'cast', { power: 1.6 }); C.w.shake?.(3, 0.3);
    C.p.act = { anim: 'cast', dir: C.a, t: 0, dur: ticks * gap + 0.2 };
  },

  // lightning (or chains) jumping from foe to foe
  chain(C) {
    const { v, o, el } = C;
    if (C.ghost) { C.fx.add({ type: 'bolt', x: C.x, y: C.y - 40, x2: C.tx, y2: C.ty - 30, el, dur: 0.35, w: 4 }); return; }
    const hit = new Set();
    let from = { x: C.p.x, y: C.p.y - 40 }, left = v.jumps || o.jumps || 4, mult = 1;
    C.w.sk.act({ step: (dt, a) => {
      if (a.next != null && a.t < a.next) return true;
      const t = nearest(C.w, from.x, from.y + 40, v.range || o.range || 300, hit);
      if (!t || left <= 0) return false;
      hit.add(t); left -= 1;
      C.fx.add({ type: 'bolt', x: from.x, y: from.y, x2: t.x, y2: t.y - 30, el, dur: 0.28, w: o.w || 4, jit: o.chainLook ? 6 : 24 });
      C.fx.add({ type: 'flash', x: t.x, y: t.y - 30, r: 46, el, dur: 0.2 });
      C.hit(t, v.power * mult, { kx: 0, ky: 0 });
      if (o.lifesteal && !C.ghost) heal(C, o.lifesteal);
      mult *= o.falloff ?? 0.9;
      from = { x: t.x, y: t.y - 30 };
      a.next = a.t + (o.gap ?? 0.07);
      C.w.sfx?.('hit');
      return left > 0;
    } });
    C.w.sfx?.('crit'); C.p.act = { anim: 'cast', dir: C.a, t: 0, dur: 0.3 };
  },

  // a lasting area: damage ticks, slows, heals or pulls
  field(C) {
    const { v, o, el } = C;
    const at = o.at === 'target' ? { x: C.tx, y: C.ty } : { x: C.ghost ? C.x : C.p.x, y: C.ghost ? C.y : C.p.y };
    addField(C, { x: at.x, y: at.y, r: v.radius, dur: v.duration || o.dur || 4, tick: o.tick || 0.5, power: v.power || 0, heal: v.heal || 0, reduce: o.reduce || 0, pull: o.pull || 0,
      follow: o.follow && !C.ghost ? C.p : null, motif: o.motif, zap: o.zap, end: o.end ? v.power * o.end : 0 });
    C.w.sfx?.('cast', { power: 1.2 });
    if (!C.ghost) C.p.act = { anim: 'cast', dir: C.a, t: 0, dur: 0.3 };
  },

  // a timed buff on the hero
  buff(C) {
    const { v, o, el } = C;
    const dur = v.duration || o.dur || 6;
    C.fx.add({ type: 'aura', x: C.x, y: C.y, el, dur, follow: C.ghost ? null : C.p });
    C.fx.add({ type: 'shock', x: C.x, y: C.y - 10, r: 120, el, dur: 0.4, band: 18 });
    burst(C.w, C.x, C.y - 40, 24, el, { grav: -160, max: 160 });
    C.w.sfx?.(o.sound || 'levelup');
    if (C.ghost) return;
    const p = C.p;
    for (const k of ['dmg', 'crit', 'haste', 'speed', 'reduce', 'lifesteal', 'regen']) if (v[k] || o[k]) addBuff(p, k, v[k] || o[k], dur);
    if (o.burnHits) addBuff(p, 'burn', 1, dur);
    if (o.refresh) { for (const s of C.w.skills || []) if (s && s.id !== C.skill.id) s.cd = Math.max(0, s.cd * (1 - o.refresh)); if (C.w.raceSkill) C.w.raceSkill.cd *= 1 - o.refresh; }
    if (o.dodges) p.dodges = p.dodgeMax;
    if (o.guard && p.guard) p.guard.meter = 100;
  },

  // a barrier that soaks damage
  shield(C) {
    const { v, o, el } = C;
    const dur = v.duration || o.dur || 5;
    C.fx.add({ type: 'dome', x: C.x, y: C.y, el, dur, follow: C.ghost ? null : C.p, r: 56 });
    C.fx.add({ type: 'shock', x: C.x, y: C.y - 20, r: 110, el, dur: 0.4, band: 16 });
    C.w.sfx?.('potion');
    if (C.ghost) return;
    const p = C.p;
    p.shield = Math.round(p.maxHp * (v.shieldPct || 0.25)); p.shieldMax = p.shield; p.shieldT = dur;
    if (v.heal) heal(C, v.heal);
    if (o.breakNova) p.shieldNova = { r: o.breakNova, power: v.power || 1, el };
  },

  // healing (instant + a regeneration that lingers)
  heal(C) {
    const { v, o, el } = C;
    C.fx.add({ type: 'pillar', x: C.x, y: C.y, w: 50, el, dur: 0.7, h: 300 });
    C.fx.add({ type: 'rune', x: C.x, y: C.y, r: 80, el, dur: 0.9, sides: 4 });
    burst(C.w, C.x, C.y - 40, 26, el, { grav: -200, max: 140 });
    C.w.sfx?.('potion');
    if (C.ghost) return;
    if (v.heal) heal(C, v.heal);
    if (v.regen) addBuff(C.p, 'regen', v.regen, o.dur || 3);
    if (o.nova) for (const e of within(C.w, C.p.x, C.p.y, o.nova)) C.hit(e, v.power || 0.8, C.push(e, C.p, 260));
    if (o.nova) C.fx.add({ type: 'shock', x: C.x, y: C.y - 10, r: o.nova, el, dur: 0.4 });
  },

  // blades or spirits circling the hero
  orbit(C) {
    const { v, o, el } = C;
    const dur = v.duration || o.dur || 5, n = v.count || o.count || 4, r = o.r || 90;
    C.fx.add({ type: 'orbit', x: C.x, y: C.y, el, dur, n, r, follow: C.ghost ? null : C.p, motif: o.motif || 'blade', spin: o.spin || 4 });
    C.w.sfx?.('swing', { power: 1.2 });
    if (C.ghost) return;
    C.w.sk.act({ max: dur + 0.2, step: (dt, a) => {
      a.acc = (a.acc || 0) + dt;
      if (a.acc >= (o.gap || 0.35)) {
        a.acc = 0;
        if (o.shoot) { const t = nearest(C.w, C.p.x, C.p.y, o.shoot); if (t) { const ang = Math.atan2(t.y - C.p.y, t.x - C.p.x); C.w.firePlayerShot({ kind: o.kind || 'bolt', x: C.p.x, y: C.p.y - 40, angle: ang, speed: 720, r: 8, power: v.power, src: 'skill', life: 0.9, tint: tintOf(el), homing: 2 }); } }
        else for (const e of within(C.w, C.p.x, C.p.y, r + 30)) C.hit(e, v.power, C.push(e, C.p, 120));
      }
      return a.t < dur;
    } });
  },

  // a totem that shoots or pulses by itself
  totem(C) {
    const { v, o, el } = C;
    const dur = v.duration || o.dur || 6;
    const x = (C.ghost ? C.x : C.p.x) + Math.cos(C.a) * 60, y = (C.ghost ? C.y : C.p.y) + Math.sin(C.a) * 30;
    C.fx.add({ type: 'totem', x, y, el, dur });
    C.w.sfx?.('slam');
    if (C.ghost) return;
    const C2 = tintOf(el);
    C.w.sk.act({ max: dur + 0.2, step: (dt, a) => {
      a.acc = (a.acc || 0) + dt;
      if (a.acc >= (o.gap || 0.8)) {
        a.acc = 0;
        if (o.pulse) { C.fx.add({ type: 'shock', x, y: y - 10, r: o.pulse, el, dur: 0.35, band: 16 }); for (const e of within(C.w, x, y, o.pulse)) C.hit(e, v.power, { kx: 0, ky: 0 }); }
        else { const t = nearest(C.w, x, y, o.range || 460); if (t) { const ang = Math.atan2(t.y - 30 - (y - 76), t.x - x); C.w.firePlayerShot({ kind: o.kind || 'bolt', x, y: y - 76, angle: ang, speed: o.speed || 700, r: o.shotR || 9, power: v.power, src: 'skill', life: 1, slow: o.slow || 0, tint: C2 }); C.fx.add({ type: 'flash', x, y: y - 76, r: 40, el, dur: 0.15 }); } }
      }
      return a.t < dur;
    } });
  },

  // a shadow of the hero that keeps fighting for a while
  clone(C) {
    const { v, o, el } = C;
    const dur = v.duration || o.dur || 4;
    const pos = { x: (C.ghost ? C.x : C.p.x) + Math.cos(C.a + 1.2) * 50, y: (C.ghost ? C.y : C.p.y) + Math.sin(C.a + 1.2) * 30 };
    const ph = C.fx.add({ type: 'phantom', x: pos.x, y: pos.y, el, dur });
    C.w.sfx?.('blink');
    if (C.ghost) return;
    C.w.sk.act({ max: dur + 0.2, step: (dt, a) => {
      const t = nearest(C.w, pos.x, pos.y, 520);
      if (t) { const d = Math.hypot(t.x - pos.x, t.y - pos.y); if (d > 60) { pos.x += (t.x - pos.x) / d * 260 * dt; pos.y += (t.y - pos.y) / d * 260 * dt; } ph.x = pos.x; ph.y = pos.y; }
      a.acc = (a.acc || 0) + dt;
      if (a.acc >= (o.gap || 0.45)) {
        a.acc = 0;
        C.fx.add({ type: 'slashes', x: pos.x + 30, y: pos.y - 30, r: 60, n: 2, el, dur: 0.3 });
        for (const e of within(C.w, pos.x, pos.y, v.radius || 90)) C.hit(e, v.power, C.push(e, pos, 140));
      }
      return a.t < dur;
    } });
  },

  // a fast series of cuts in front
  flurry(C) {
    const { v, o, el } = C;
    const hits = v.hits || o.hits || 6, gap = o.gap || 0.08, range = o.range || 130;
    for (let i = 0; i < hits; i++) C.w.sk.act({ step: (dt, a) => {
      if (a.t < i * gap) return true;
      const px = C.ghost ? C.x : C.p.x, py = C.ghost ? C.y : C.p.y;
      const cx = px + Math.cos(C.a) * range * 0.55, cy = py - 28 + Math.sin(C.a) * range * 0.4;
      C.fx.add({ type: 'slashes', x: cx, y: cy, r: range * 0.5, n: 1, el, dur: 0.24 });
      if (!C.ghost) {
        C.p.act = { anim: i % 2 ? 'slashUp' : 'slash', dir: C.a, t: 0, dur: gap * 1.6 };
        for (const e of live(C.w)) if (inArc(px, py - 20, C.a, range, o.arc || 1.8, e.x, e.y - 20, e.r || 20)) C.hit(e, v.power, { kx: Math.cos(C.a) * 50, ky: Math.sin(C.a) * 50 });
        C.w.sfx?.('swing', { power: 1 });
      }
      return false;
    } });
  },

  // spin like a top, moving, cutting everything around
  cyclone(C) {
    const { v, o, el } = C;
    const dur = v.duration || o.dur || 1.6, r = v.radius || 110;
    const ring = C.fx.add({ type: 'orbit', x: C.x, y: C.y, el, dur, n: 3, r: r * 0.8, follow: C.ghost ? null : C.p, motif: 'blade', spin: 14 });
    if (C.ghost) return;
    C.w.sk.act({ max: dur + 0.2, step: (dt, a) => {
      C.p.spinT = 0.2;
      a.acc = (a.acc || 0) + dt;
      if (a.acc >= (o.gap || 0.22)) { a.acc = 0; C.fx.add({ type: 'shock', x: C.p.x, y: C.p.y - 16, r, el, dur: 0.25, band: 12, streaks: 8 }); for (const e of within(C.w, C.p.x, C.p.y, r)) C.hit(e, v.power, C.push(e, C.p, 160)); C.w.sfx?.('swing', { power: 1.1 }); }
      return a.t < dur;
    } });
    if (o.speed) addBuff(C.p, 'speed', o.speed, dur);
    void ring;
  },

  // leap onto the target and crash down
  leap(C) {
    const { v, o, el, p } = C;
    if (C.ghost) { C.fx.add({ type: 'trail', x: C.x, y: C.y - 60, x2: C.tx, y2: C.ty - 30, el, dur: 0.5, w: 30 }); C.w.sk.act({ step: (dt, a) => { if (a.t < 0.35) return true; C.fx.add({ type: 'shock', x: C.tx, y: C.ty - 6, r: v.radius, el, dur: 0.45 }); C.fx.add({ type: 'crack', x: C.tx, y: C.ty, r: v.radius, el, dur: 1 }); return false; } }); return; }
    const sx = p.x, sy = p.y, tx = Math.max(60, Math.min((C.w.arena?.w || 2000) - 60, C.tx)), ty = C.ty;
    const dur = 0.36;
    p.iframes = Math.max(p.iframes, dur + 0.15);
    p.act = { anim: 'overhead', dir: Math.atan2(ty - sy, tx - sx), t: 0, dur: dur + 0.15 };
    C.w.sk.act({ step: (dt, a) => {
      const k = Math.min(1, a.t / dur);
      p.x = sx + (tx - sx) * k; p.y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 0; p.vx = p.vy = 0;
      p.leapZ = Math.sin(k * Math.PI) * 90;
      if (k < 1) return true;
      p.leapZ = 0; C.w.clampBody?.(p);
      C.fx.add({ type: 'shock', x: p.x, y: p.y - 6, r: v.radius, el, dur: 0.45, band: 34 });
      C.fx.add({ type: 'flash', x: p.x, y: p.y - 20, r: v.radius, el, dur: 0.3, rays: 12 });
      C.fx.add({ type: 'crack', x: p.x, y: p.y, r: v.radius * 1.2, el, dur: 1.2, n: 9 });
      burst(C.w, p.x, p.y - 10, 34, el, { grav: 400 });
      for (const e of within(C.w, p.x, p.y, v.radius)) C.hit(e, v.power, C.push(e, p, 420));
      C.w.shake?.(10, 0.35); C.w.hitStop?.(0.08); C.w.sfx?.('slam');
      return false;
    } });
  },

  // a line of spikes (or a crashing wave) travelling forward
  wave(C) {
    const { v, o, el } = C;
    const len = v.length || 480, ox = C.ghost ? C.x : C.p.x, oy = C.ghost ? C.y : C.p.y, ang = C.a, speed = o.speed || 1100;
    if (o.motif === 'water') C.fx.add({ type: 'arcwave', x: ox, y: oy - 20, vx: Math.cos(ang) * speed * 0.6, vy: Math.sin(ang) * speed * 0.6, r: o.width || 90, th: 30, el, dur: len / (speed * 0.6) });
    else C.fx.add({ type: 'spikes', x: ox, y: oy, a: ang, len, n: Math.round(len / 55), gap: 55 / speed, el, dur: len / speed + 0.6, motif: o.motif, h: o.h || 50 });
    C.w.sfx?.('slam'); C.w.shake?.(5, 0.3);
    if (C.ghost) return;
    const hit = new Set();
    C.w.sk.act({ step: (dt, a) => {
      const front = Math.min(len, a.t * (o.motif === 'water' ? speed * 0.6 : speed));
      for (const e of live(C.w)) {
        if (hit.has(e)) continue;
        const dx = e.x - ox, dy = e.y - oy, along = dx * Math.cos(ang) + dy * Math.sin(ang), across = -dx * Math.sin(ang) + dy * Math.cos(ang);
        if (along < 0 || along > front || Math.abs(across) > (o.width || 50) + (e.r || 20)) continue;
        hit.add(e);
        C.hit(e, v.power, { kx: Math.cos(ang) * (o.kb ?? 160), ky: Math.sin(ang) * (o.kb ?? 160) - (o.motif === 'water' ? 0 : 120) });
      }
      return front < len;
    } });
    C.p.act = { anim: 'overhead', dir: ang, t: 0, dur: 0.3 };
  },

  // crescent waves of light flying out (they cut what they cross)
  crescent(C) {
    const { v, o, el } = C;
    const n = v.count || o.count || 1, speed = o.speed || 760, life = (v.length || 520) / speed;
    for (let i = 0; i < n; i++) {
      const ang = C.a + (n > 1 ? (i - (n - 1) / 2) * (o.fan || 0.3) : 0);
      const sx = (C.ghost ? C.x : C.p.x) + Math.cos(ang) * 30, sy = (C.ghost ? C.y : C.p.y) - 30 + Math.sin(ang) * 10;
      const fx = C.fx.add({ type: 'arcwave', x: sx, y: sy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: o.r || 60, th: o.th || 18, el, dur: life });
      if (C.ghost) continue;
      const hit = new Set();
      C.w.sk.act({ max: life + 0.1, step: (dt, a) => {
        for (const e of live(C.w)) { if (hit.has(e) || Math.hypot(e.x - fx.x, e.y - 30 - fx.y) > (o.r || 60) + (e.r || 20)) continue; hit.add(e); C.hit(e, v.power, { kx: Math.cos(ang) * 200, ky: Math.sin(ang) * 200 }); burst(C.w, e.x, e.y - 30, 8, el); }
        return a.t < life;
      } });
    }
    C.w.sfx?.('swing', { power: 1.8 });
    if (!C.ghost) C.p.act = { anim: 'slash', dir: C.a, t: 0, dur: 0.3 };
  },

  // hook the nearest foe and drag it in
  hook(C) {
    const { v, o, el, p } = C;
    if (C.ghost) { C.fx.add({ type: 'bolt', x: C.x, y: C.y - 30, x2: C.tx, y2: C.ty - 30, el: 'steel', dur: 0.35, w: 3, jit: 4 }); return; }
    const t = C.tgt && Math.hypot(C.tgt.x - p.x, C.tgt.y - p.y) < (v.range || 420) ? C.tgt : null;
    if (!t) { C.fx.add({ type: 'beam', x: p.x, y: p.y - 30, a: p.facing, len: v.range || 420, w: 4, el: 'steel', dur: 0.25 }); return; }
    C.fx.add({ type: 'bolt', x: p.x, y: p.y - 30, x2: t.x, y2: t.y - 30, el: 'steel', dur: 0.35, w: 3, jit: 4 });
    const ang = Math.atan2(p.y - t.y, p.x - t.x);
    const d = Math.max(0, Math.hypot(p.x - t.x, p.y - t.y) - 60);
    C.hit(t, v.power, { kx: Math.cos(ang) * Math.min(900, d * 3.2), ky: Math.sin(ang) * Math.min(900, d * 3.2), stun: o.stun || 0.6 });
    C.fx.add({ type: 'flash', x: t.x, y: t.y - 30, r: 50, el, dur: 0.2 });
    C.w.sfx?.('parry');
    p.act = { anim: 'throw', dir: C.a, t: 0, dur: 0.3 };
  },

  // mines around the hero, set off by foes walking in
  trap(C) {
    const { v, o, el } = C;
    const n = v.count || o.count || 3, dur = o.dur || 8, arm = 0.5;
    const base = { x: C.ghost ? C.x : C.p.x, y: C.ghost ? C.y : C.p.y };
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + C.a, x = base.x + Math.cos(ang) * 90, y = base.y + Math.sin(ang) * 55;
      const sig = C.fx.add({ type: 'sigil', x, y, r: v.radius * 0.5, el, dur });
      if (C.ghost) continue;
      C.w.sk.act({ max: dur + 0.1, step: (dt, a) => {
        if (a.t < arm) return true;
        if (!within(C.w, x, y, v.radius * 0.5).length) return a.t < dur;
        sig.kill = true;
        C.fx.add({ type: 'shock', x, y: y - 6, r: v.radius, el, dur: 0.4 }); C.fx.add({ type: 'flash', x, y: y - 20, r: v.radius, el, dur: 0.3, rays: 10 });
        burst(C.w, x, y - 20, 24, el);
        for (const e of within(C.w, x, y, v.radius)) C.hit(e, v.power, C.push(e, { x, y }, 320));
        C.w.sfx?.('slam'); C.w.shake?.(5, 0.2);
        return false;
      } });
    }
    C.w.sfx?.('telegraph');
  },

  // a stance: the next blow that would land is turned into a counter-blast
  counter(C) {
    const { v, o, el } = C;
    C.fx.add({ type: 'dome', x: C.x, y: C.y, el, dur: v.duration || 1.2, follow: C.ghost ? null : C.p, r: 50 });
    C.w.sfx?.('guard');
    if (C.ghost) return;
    C.p.counterT = v.duration || 1.2; C.p.counterSkill = { r: v.radius || 160, power: v.power, el };
  },

  // brand the nearest foe: it takes more damage (and maybe bursts later)
  mark(C) {
    const { v, o, el } = C;
    if (C.ghost) { C.fx.add({ type: 'mark', x: C.tx, y: C.ty, el, dur: v.duration || 4 }); return; }
    const t = C.tgt;
    if (!t) return;
    C.fx.add({ type: 'mark', x: t.x, y: t.y, el, dur: v.duration || 4, follow: t, h: (t.r || 24) * 2 + 50 });
    C.fx.add({ type: 'bolt', x: C.p.x, y: C.p.y - 40, x2: t.x, y2: t.y - 40, el, dur: 0.25, w: 2 });
    C.hit(t, v.power, { mark: v.mark || 0.3, markT: v.duration || 4, burn: !!o.burn });
    if (o.burst) C.w.sk.act({ step: (dt, a) => { if (a.t < (v.duration || 4)) return !t.dead; C.fx.add({ type: 'shock', x: t.x, y: t.y - 10, r: o.burst, el, dur: 0.4 }); C.fx.add({ type: 'flash', x: t.x, y: t.y - 30, r: o.burst, el, dur: 0.3, rays: 8 }); for (const e of within(C.w, t.x, t.y, o.burst)) C.hit(e, v.power * (o.burstMult || 2), C.push(e, t, 260)); C.w.sfx?.('crit'); return false; } });
    C.w.sfx?.('telegraph');
  },

  // one devastating cut on the nearest foe, crueller on the wounded
  execute(C) {
    const { v, o, el, p } = C;
    if (C.ghost) { C.fx.add({ type: 'slashes', x: C.tx, y: C.ty - 30, r: 120, n: 2, el, dur: 0.45 }); C.fx.add({ type: 'flash', x: C.tx, y: C.ty - 30, r: 120, el, dur: 0.3, rays: 14 }); return; }
    const t = C.tgt && Math.hypot(C.tgt.x - p.x, C.tgt.y - p.y) < (o.range || 220) ? C.tgt : null;
    p.act = { anim: 'iai', dir: C.a, t: 0, dur: 0.45 };
    if (!t) { C.fx.add({ type: 'arc', x: p.x, y: p.y - 30, a: C.a, arc: 2, r: 100, th: 10, el, dur: 0.3 }); return; }
    const low = t.hp != null && t.maxHp ? t.hp / t.maxHp < (o.low || 0.3) : false;
    C.fx.add({ type: 'slashes', x: t.x, y: t.y - 30, r: 130, n: 2, el, dur: 0.45 });
    C.fx.add({ type: 'flash', x: t.x, y: t.y - 30, r: 130, el, dur: 0.35, rays: 14 });
    C.hit(t, v.power * (low ? (o.bonus || 2) : 1), { forceCrit: low, kx: Math.cos(C.a) * 300, ky: Math.sin(C.a) * 300 });
    C.w.shake?.(low ? 12 : 6, 0.3); C.w.hitStop?.(low ? 0.12 : 0.05); C.w.sfx?.('crit');
    if (low) C.fx.add({ type: 'label', x: t.x, y: t.y + 40, text: 'ประหาร!', color: '#ff9a8a', dur: 0.9, size: 22 });
  },

  // smash the ground in front
  slam(C) {
    const { v, o, el } = C;
    const fwd = o.fwd ?? 80;
    const x = (C.ghost ? C.x : C.p.x) + Math.cos(C.a) * fwd, y = (C.ghost ? C.y : C.p.y) + Math.sin(C.a) * fwd * 0.6;
    const go = () => {
      C.fx.add({ type: 'shock', x, y: y - 6, r: v.radius, el, dur: 0.45, band: 36 });
      C.fx.add({ type: 'crack', x, y, r: v.radius * 1.3, el, dur: 1.2, n: 9 });
      C.fx.add({ type: 'flash', x, y: y - 16, r: v.radius * 0.8, el, dur: 0.3, rays: 10 });
      if (o.line) C.fx.add({ type: 'spikes', x, y, a: C.a, len: o.line, n: 7, gap: 0.04, el, dur: 0.8, motif: o.motif });
      burst(C.w, x, y - 10, 30, el, { grav: 420 });
      if (!C.ghost) {
        for (const e of within(C.w, x, y, v.radius)) C.hit(e, v.power, C.push(e, { x, y }, o.kb ?? 380));
        if (o.line) for (const e of live(C.w)) { const dx = e.x - x, dy = e.y - y, al = dx * Math.cos(C.a) + dy * Math.sin(C.a), ac = -dx * Math.sin(C.a) + dy * Math.cos(C.a); if (al > 0 && al < o.line && Math.abs(ac) < 40 + (e.r || 20)) C.hit(e, v.power * 0.6, { kx: 0, ky: -80 }); }
      }
      C.w.shake?.(9, 0.3); C.w.hitStop?.(0.06); C.w.sfx?.('slam');
    };
    if (C.ghost) { go(); return; }
    C.p.act = { anim: 'overhead', dir: C.a, t: 0, dur: 0.4 };
    C.w.sk.act({ step: (dt, a) => { if (a.t < (o.wind || 0.18)) return true; go(); return false; } });
  },

  // the old thorn snare (kept as it was)
  snare(C) {
    const { v } = C;
    if (C.ghost) { C.fx.add({ type: 'field', x: C.tx, y: C.ty, r: v.radius, el: 'nature', dur: v.duration, motif: 'thorn' }); return; }
    const t = C.tgt;
    const x = t ? t.x : C.p.x + Math.cos(C.p.facing) * 150, y = t ? t.y : C.p.y + Math.sin(C.p.facing) * 150;
    C.w.addSnare({ x, y, r: v.radius, t: 0, dur: v.duration, delay: 0.22, slow: v.slow, power: v.power, struck: false });
    C.fx.add({ type: 'rune', x, y, r: v.radius, el: 'nature', dur: 0.6, sides: 5 });
    C.w.sfx?.('telegraph');
  },
};

// shot tint in the format playerShots.js draws: ['r,g,b' of the glow, core colour]
function tintOf(el) {
  const c = elOf(el), n = parseInt(c.glow.slice(1), 16);
  return [`${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`, c.core];
}

function heal(C, pct) {
  const p = C.p, n = Math.max(1, Math.round(p.maxHp * pct));
  p.hp = Math.min(p.maxHp, p.hp + n);
  C.w.fx?.number(p.x, p.y - 100, `+${n}`, 'heal');
}

// a lasting area (fields, vortices, burning trails)
function addField(C, f) {
  const fxe = C.fx.add({ type: f.pull ? 'vortex' : 'field', x: f.x, y: f.y, r: f.r, el: C.el, dur: f.dur, follow: f.follow, motif: f.motif, arms: 5 });
  if (C.ghost) return;
  C.w.sk.act({ max: f.dur + 0.3, step: (dt, a) => {
    const x = f.follow ? f.follow.x : f.x, y = f.follow ? f.follow.y : f.y;
    if (f.pull) for (const e of within(C.w, x, y, f.r * 1.2)) if (!e.type?.boss && !e.peer) { const ang = Math.atan2(y - e.y, x - e.x); e.vx = (e.vx || 0) + Math.cos(ang) * f.pull * dt; e.vy = (e.vy || 0) + Math.sin(ang) * f.pull * dt; }
    if (f.reduce && Math.hypot(C.p.x - x, C.p.y - y) < f.r) addBuff(C.p, 'reduce', f.reduce, 0.3);
    a.acc = (a.acc || 0) + dt;
    if (a.acc >= f.tick) {
      a.acc = 0;
      if (f.power > 0) {
        const foes = within(C.w, x, y, f.r);
        if (f.zap) { const t = foes[0]; if (t) { C.fx.add({ type: 'bolt', x, y: y - 120, x2: t.x, y2: t.y - 30, el: C.el, dur: 0.2 }); C.hit(t, f.power); } }
        else for (const e of foes) C.hit(e, f.power, f.pull && e.peer ? C.push(e, { x: x * 2 - e.x, y: y * 2 - e.y }, 200) : { kx: 0, ky: 0 });
      }
      if (f.heal && Math.hypot(C.p.x - x, C.p.y - y) < f.r) heal(C, f.heal);
    }
    if (a.t >= f.dur) {
      if (f.end) { C.fx.add({ type: 'shock', x, y: y - 8, r: f.r * 1.3, el: C.el, dur: 0.5 }); C.fx.add({ type: 'flash', x, y: y - 20, r: f.r, el: C.el, dur: 0.4, rays: 16 }); for (const e of within(C.w, x, y, f.r * 1.3)) C.hit(e, f.end, C.push(e, { x, y }, 420)); C.w.shake?.(10, 0.4); C.w.sfx?.('slam'); }
      return false;
    }
    void fxe;
    return true;
  } });
}

// ------------------------------------------------------------------ hidden prices
function payFlaw(w, p, flaw) {
  if (!flaw) return;
  if (flaw.selfDmg) { const n = Math.round(p.maxHp * flaw.selfDmg); p.hp = Math.max(1, p.hp - n); w.fx?.number(p.x, p.y - 80, n, 'player'); }
  if (flaw.root) p.rootT = Math.max(p.rootT || 0, flaw.root);
  if (flaw.slow) { p.flawSlowT = Math.max(p.flawSlowT || 0, flaw.slowT || 2); p.flawSlow = flaw.slow; }
  if (flaw.expose) { p.exposeT = Math.max(p.exposeT || 0, flaw.exposeT || 2.5); p.expose = flaw.expose; }
  if (flaw.dodge && p.dodges > 0) { if (p.dodges === p.dodgeMax) p.dodgeRefill = 1.1 * (p.stats.dashCdMult || 1); p.dodges -= 1; }
}

// ------------------------------------------------------------------ entry points
// Cast a slotted skill for the local hero. Returns the cast message to share (or null when nothing happened).
export function castSpec(w, p, skill, v) {
  const fn = CAST[skill.cast];
  if (!fn) return null;
  if (skill.flaw?.minHp && p.hp <= p.maxHp * skill.flaw.minHp) return null;
  const C = ctxFor(w, p, skill, v, null);
  fn(C);
  payFlaw(w, p, skill.flaw);
  C.fx.add({ type: 'label', x: p.x, y: p.y, text: skill.name, color: elOf(skill.el).glow, dur: 0.9 });
  return { id: skill.id, x: Math.round(C.x), y: Math.round(C.y), a: Math.round(C.a * 100) / 100, tx: Math.round(C.tx), ty: Math.round(C.ty) };
}

// Replay someone else's cast (visuals only).
export function replaySpec(w, skill, v, msg) {
  const fn = CAST[skill.cast];
  if (!fn || !w.sk) return;
  const num = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
  const m = { x: num(msg.x, 0), y: num(msg.y, 0), a: num(msg.a, 0), tx: num(msg.tx, 0), ty: num(msg.ty, 0) };
  const C = ctxFor(w, null, skill, v, m);
  fn(C);
  C.fx.add({ type: 'label', x: m.x, y: m.y, text: skill.name, color: elOf(skill.el).glow, dur: 0.9 });
}

// A counter stance turning a blow into a blast (called from damagePlayer).
export function fireCounter(w, p) {
  const c = p.counterSkill; p.counterT = 0;
  if (!c || !w.sk) return;
  w.sk.fx.add({ type: 'shock', x: p.x, y: p.y - 14, r: c.r, el: c.el, dur: 0.4, band: 30 });
  w.sk.fx.add({ type: 'flash', x: p.x, y: p.y - 30, r: c.r, el: c.el, dur: 0.3, rays: 12 });
  w.sk.fx.add({ type: 'label', x: p.x, y: p.y, text: 'สวนกลับ!', color: elOf(c.el).glow, dur: 0.8 });
  for (const e of within(w, p.x, p.y, c.r)) { const ang = Math.atan2(e.y - p.y, e.x - p.x); w.playerStrike(e, c.power, { src: 'skill', forceCrit: true, kx: Math.cos(ang) * 420, ky: Math.sin(ang) * 420 }); }
  w.sfx?.('counter'); w.shake?.(8, 0.25);
}

// A barrier that bursts when it breaks.
export function shieldBroke(w, p) {
  const c = p.shieldNova; p.shieldNova = null;
  if (!c || !w.sk) return;
  w.sk.fx.add({ type: 'shock', x: p.x, y: p.y - 14, r: c.r, el: c.el, dur: 0.4 });
  for (const e of within(w, p.x, p.y, c.r)) { const ang = Math.atan2(e.y - p.y, e.x - p.x); w.playerStrike(e, c.power, { src: 'skill', kx: Math.cos(ang) * 380, ky: Math.sin(ang) * 380 }); }
  w.sfx?.('shatter');
}
export const CAST_TYPES = Object.freeze(Object.keys(CAST));
