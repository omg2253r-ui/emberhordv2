// Ultimates in battle: the gauge, the anime-style cut-in and the choreography (data/ultimates.js seq).
// One runner for the dungeon, the online zones and PvP. In a solo PvE fight time stops for the monsters while the
// ultimate plays (the cinematic belongs to the hero); with other players around nothing is frozen. Damage goes
// through world.playerStrike (src 'skill'); on other screens the same ultimate is replayed as visuals only.
import './ultVfx.js';
import { getUlt, ULT_TIERS, ULT_GAIN } from '../data/ultimates.js';
import { ultNeed } from '../systems/ultimate.js';
import { elOf, hexA } from './skillVfx.js';
import { addBuff } from './buffs.js';

const TAU = Math.PI * 2;
export const ULT_PVP_SCALE = 0.55;          // ultimates are a match's climax, not a one-shot

// ------------------------------------------------------------------ gauge
export function createUltState(id, pvp = false) {
  const def = getUlt(id);
  if (!def) return null;
  return { id, def, need: ultNeed(id, pvp), val: 0, run: null, readyShown: false, pvp };
}
export function gainUlt(w, amount) {
  const u = w.ult;
  if (!u || u.run || !(amount > 0)) return;
  const before = u.val;
  u.val = Math.min(u.need, u.val + amount * (1 + (w.player?.stats?.ultGain || 0)));
  if (before < u.need && u.val >= u.need && !u.readyShown) { u.readyShown = true; w.onUltReady?.(u); }
}
export const ultReady = (w) => !!(w.ult && !w.ult.run && w.ult.val >= w.ult.need && !w.player?.dead);
export { ULT_GAIN };

// ------------------------------------------------------------------ helpers
const live = (w) => (w.enemies || []).filter((e) => !e.dead && !(e.spawning > 0) && !e.untargetable && e.x != null);
function nearest(w, x, y, max = 9999) { let b = null, d = max; for (const e of live(w)) { const dd = Math.hypot(e.x - x, e.y - y); if (dd < d) { d = dd; b = e; } } return b; }
const within = (w, x, y, r) => live(w).filter((e) => Math.hypot(e.x - x, e.y - y) <= r + (e.r || 20));

// ------------------------------------------------------------------ start
// Starts the local hero's ultimate. Returns the message to share with the others, or null.
export function unleash(w) {
  if (!ultReady(w)) return null;
  const u = w.ult, p = w.player;
  const t = nearest(w, p.x, p.y, 900);
  const tx = t ? t.x : p.x + Math.cos(p.facing) * 220, ty = t ? t.y : p.y + Math.sin(p.facing) * 120;
  u.val = 0; u.readyShown = false;
  u.run = makeRun(w, u.def, { x: p.x, y: p.y, tx, ty, target: t, ghost: false, freeze: !!w.ultFreezes });
  w.onUltStart?.(u.def);
  return { id: u.id, x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(tx), ty: Math.round(ty) };
}
// Someone else's ultimate: the same show, no damage, nothing frozen.
export function replayUlt(w, msg, who = '') {
  const def = msg && getUlt(String(msg.id || ''));
  if (!def || !w.sk) return;
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  (w.ghostUlts ||= []).push(makeRun(w, def, { x: num(msg.x, 0), y: num(msg.y, 0), tx: num(msg.tx, 0), ty: num(msg.ty, 0), target: null, ghost: true, freeze: false, who }));
  if (w.ghostUlts.length > 3) w.ghostUlts.shift();
}

function makeRun(w, def, o) {
  return { def, el: def.el, tier: ULT_TIERS[def.tier], steps: def.seq, i: -1, st: 0, t: 0, ev: [], dur: 0, done: false, flashT: 0, cutT: 0, ...o, cut: o.ghost ? 1.3 : 1.15 };
}

// ------------------------------------------------------------------ update
// Advances the hero's ultimate and the replays. Returns true while the monsters should stand frozen.
export function updateUlt(w, dt) {
  if (w.ghostUlts) for (let i = w.ghostUlts.length - 1; i >= 0; i--) { step(w, w.ghostUlts[i], dt); if (w.ghostUlts[i].done) w.ghostUlts.splice(i, 1); }
  const r = w.ult?.run;
  if (!r) return false;
  const p = w.player;
  p.iframes = Math.max(p.iframes, 0.25);
  step(w, r, dt);
  if (r.done || p.dead) { w.ult.run = null; p.act = null; p.spinT = 0; p.leapZ = 0; w.onUltEnd?.(); return false; }
  return r.freeze;
}

function step(w, r, dt) {
  r.t += dt; r.cutT += dt; if (r.flashT > 0) r.flashT -= dt;
  if (r.i < 0 || r.st >= r.dur) {
    r.i += 1; r.st = 0;
    if (r.i >= r.steps.length) { r.done = true; return; }
    r.ev = []; r.dur = 0;
    begin(w, r, r.steps[r.i]);
  }
  r.st += dt;
  for (const ev of r.ev) if (!ev.done && r.st >= ev.at) { ev.done = true; try { ev.fn(); } catch { /* a target vanished mid-show */ } }
  r.tick?.(dt);
}

// a blow of the ultimate on everything in a circle
function blow(w, r, x, y, rad, power, o = {}) {
  if (r.ghost) return;
  const k = (w.pvp ? ULT_PVP_SCALE : 1);
  for (const e of within(w, x, y, rad)) {
    const a = Math.atan2(e.y - y, e.x - x), kb = o.kb ?? 260;
    w.playerStrike(e, Math.min(13, power * k), { src: 'skill', kx: Math.cos(a) * kb, ky: Math.sin(a) * kb, forceCrit: !!o.crit });
  }
}
function target(w, r) {
  if (!r.ghost) {
    if (!r.target || r.target.dead) r.target = nearest(w, w.player.x, w.player.y, 900);
    if (r.target) { r.tx = r.target.x; r.ty = r.target.y; }
  }
  return { x: r.tx, y: r.ty };
}
function hero(w, r) { return r.ghost ? { x: r.x, y: r.y } : w.player; }

// ------------------------------------------------------------------ step kinds
function begin(w, r, s) {
  const fx = w.sk.fx, el = s.el || r.el, C = elOf(el), p = hero(w, r), real = !r.ghost ? w.player : null;
  const at = (t, fn) => r.ev.push({ at: t, fn, done: false });
  const T = target(w, r);
  r.tick = null;
  switch (s.k) {
    case 'charge': {
      r.dur = s.t;
      fx.add({ type: 'gather', x: p.x, y: p.y, el, dur: s.t + 0.1, follow: real });
      fx.add({ type: 'rune', x: p.x, y: p.y, r: 120, el, dur: s.t + 0.4, sides: 7 });
      if (real) real.act = { anim: 'castBig', dir: Math.atan2(T.y - p.y, T.x - p.x), t: 0, dur: s.t + 0.1, glow: true };
      w.sfx?.('charge'); w.sfx?.('godIntro');
      break;
    }
    case 'dash': {
      const n = s.n || 1, each = 0.16;
      r.dur = n * each + 0.12;
      for (let i = 0; i < n; i++) at(i * each, () => {
        const t2 = target(w, r), from = { x: real ? real.x : r.x, y: real ? real.y : r.y };
        const ang = Math.atan2(t2.y - from.y, t2.x - from.x), dist = Math.max(s.dist || 320, Math.hypot(t2.x - from.x, t2.y - from.y) + 120);
        const to = { x: from.x + Math.cos(ang) * dist, y: from.y + Math.sin(ang) * dist };
        if (real) { real.x = to.x; real.y = to.y; w.clampBody?.(real); real.facing = ang; real.flip = Math.cos(ang) < 0; real.act = { anim: 'thrust', dir: ang, t: 0, dur: each }; to.x = real.x; to.y = real.y; }
        fx.add({ type: 'trail', x: from.x, y: from.y - 26, x2: to.x, y2: to.y - 26, el, dur: 0.5, w: 54 });
        fx.add({ type: 'flash', x: t2.x, y: t2.y - 30, r: 110, el, dur: 0.25, rays: 10 });
        blow(w, r, (from.x + to.x) / 2, (from.y + to.y) / 2, Math.hypot(to.x - from.x, to.y - from.y) / 2 + 30, s.power, { kb: 120 });
        w.sfx?.('dash'); w.sfx?.('crit'); w.shake?.(6, 0.15);
      });
      break;
    }
    case 'blink': {
      const n = s.n || 3, each = 0.12;
      r.dur = n * each + 0.15;
      for (let i = 0; i < n; i++) at(i * each, () => {
        const t2 = target(w, r), a = (i / n) * TAU + (i % 2 ? 0.6 : 0);
        const x = t2.x + Math.cos(a) * 70, y = t2.y + Math.sin(a) * 36;
        fx.add({ type: 'phantom', x: real ? real.x : x, y: real ? real.y : y, el, dur: 0.35 });
        if (real) { real.x = x; real.y = y; w.clampBody?.(real); real.facing = Math.atan2(t2.y - y, t2.x - x); real.flip = Math.cos(real.facing) < 0; real.act = { anim: i % 2 ? 'slashUp' : 'slash', dir: real.facing, t: 0, dur: each * 1.3 }; }
        fx.add({ type: 'slashes', x: t2.x, y: t2.y - 30, r: 90, n: 2, el, dur: 0.3 });
        blow(w, r, t2.x, t2.y, 90, s.power, { kb: 40 });
        w.sfx?.('blink'); w.sfx?.('hit');
      });
      break;
    }
    case 'spin': {
      r.dur = s.t;
      fx.add({ type: 'orbit', x: p.x, y: p.y, el, dur: s.t, n: 4, r: s.r * 0.75, follow: real, motif: 'blade', spin: 16 });
      let acc = 0;
      r.tick = (dt) => { if (real) real.spinT = 0.2; acc += dt; if (acc >= (s.gap || 0.16)) { acc = 0; const h = hero(w, r); fx.add({ type: 'shock', x: h.x, y: h.y - 16, r: s.r, el, dur: 0.25, band: 14, streaks: 8 }); blow(w, r, h.x, h.y, s.r, s.power, { kb: 120 }); w.sfx?.('swing', { power: 1.3 }); } };
      break;
    }
    case 'leap': {
      const dur = 0.38;
      r.dur = dur + 0.25;
      const from = { x: p.x, y: p.y };
      r.tick = () => {
        const k = Math.min(1, r.st / dur), t2 = target(w, r);
        if (real) { real.x = from.x + (t2.x - from.x) * k; real.y = from.y + (t2.y + 10 - from.y) * k; real.leapZ = Math.sin(k * Math.PI) * 120; real.act = { anim: 'overhead', dir: Math.atan2(t2.y - from.y, t2.x - from.x), t: k * 0.3, dur: 0.5 }; }
      };
      at(dur, () => {
        const t2 = target(w, r); if (real) real.leapZ = 0;
        fx.add({ type: 'shock', x: t2.x, y: t2.y - 6, r: s.r, el, dur: 0.45, band: 40 });
        fx.add({ type: 'crack', x: t2.x, y: t2.y, r: s.r * 1.3, el, dur: 1.3, n: 10 });
        fx.add({ type: 'flash', x: t2.x, y: t2.y - 20, r: s.r, el, dur: 0.3, rays: 14 });
        w.particles?.burst(t2.x, t2.y - 10, 40, { color: C.spark, speedMin: 120, speedMax: 460, life: 0.7, size: 4, drag: 3, grav: 500, glow: true });
        blow(w, r, t2.x, t2.y, s.r, s.power, { kb: 420 });
        w.shake?.(12, 0.35); w.hitStop?.(0.08); w.sfx?.('slam');
      });
      break;
    }
    case 'beam': {
      r.dur = s.t + 0.2;
      const ang = Math.atan2(T.y - p.y, T.x - p.x);
      fx.add({ type: 'beam', x: p.x + Math.cos(ang) * 30, y: p.y - 34, a: ang, len: s.len, w: s.w, el, dur: s.t + 0.15 });
      if (real) real.act = { anim: 'castBig', dir: ang, t: 0, dur: s.t + 0.2, glow: true };
      for (let i = 0; i < s.ticks; i++) at((i * s.t) / s.ticks, () => {
        if (r.ghost) return;
        for (const e of live(w)) {
          const dx = e.x - p.x, dy = e.y - p.y, along = dx * Math.cos(ang) + dy * Math.sin(ang), across = -dx * Math.sin(ang) + dy * Math.cos(ang);
          if (along < 0 || along > s.len || Math.abs(across) > s.w + (e.r || 20)) continue;
          w.playerStrike(e, Math.min(13, s.power * (w.pvp ? ULT_PVP_SCALE : 1)), { src: 'skill', kx: Math.cos(ang) * 80, ky: Math.sin(ang) * 80 });
        }
        w.shake?.(5, 0.12);
      });
      w.sfx?.('cast', { power: 2 });
      break;
    }
    case 'rain': {
      r.dur = s.t + 0.6;
      for (let i = 0; i < s.n; i++) at((i * s.t) / s.n, () => {
        const t2 = target(w, r), ang = Math.random() * TAU, d = Math.random() * (s.spread || 160);
        const x = t2.x + Math.cos(ang) * d, y = t2.y + Math.sin(ang) * d * 0.6, fall = s.kind === 'bolt' ? 0.18 : 0.45;
        if (s.kind === 'meteor' || s.kind === 'star') fx.add({ type: 'meteor', tx: x, ty: y - 10, el, dur: fall, size: s.kind === 'star' ? 12 : 22, rock: s.kind === 'meteor', mark: s.r });
        else if (s.kind === 'bolt') fx.add({ type: 'bolt', x: x + 30, y: y - 560, x2: x, y2: y - 10, el, dur: 0.3, w: 5, segs: 12, jit: 34 });
        else fx.add({ type: 'fall', kind: s.kind, tx: x, ty: y, el, dur: fall, mark: s.r * 0.8 });
        r.ev.push({ at: r.st + fall, done: false, fn: () => {
          fx.add({ type: 'shock', x, y: y - 6, r: s.r, el, dur: 0.35, band: 20, streaks: 10 });
          if (s.kind === 'meteor') fx.add({ type: 'crack', x, y, r: s.r, el, dur: 1.0, n: 6 });
          w.particles?.burst(x, y - 10, 10, { color: C.spark, speedMin: 80, speedMax: 300, life: 0.4, size: 3, drag: 3, grav: 300, glow: true });
          blow(w, r, x, y, s.r, s.power, { kb: 160 });
          w.sfx?.(s.kind === 'bolt' ? 'crit' : 'hit');
          if (i % 3 === 0) w.shake?.(5, 0.12);
        } });
      });
      break;
    }
    case 'pillars': {
      r.dur = 0.9;
      const foes = r.ghost ? [T] : live(w).filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 700);
      if (!foes.length) foes.push(T);
      foes.slice(0, 10).forEach((e, i) => {
        const x = e.x, y = e.y;
        fx.add({ type: 'rune', x, y, r: s.r, el, dur: 0.7, sides: 5 });
        at(0.35 + i * 0.03, () => { fx.add({ type: 'pillar', x, y, w: s.r * 0.7, el, dur: 0.55, h: 600 }); fx.add({ type: 'shock', x, y: y - 6, r: s.r, el, dur: 0.35 }); blow(w, r, x, y, s.r, s.power, { kb: 80 }); w.sfx?.('crit'); });
      });
      break;
    }
    case 'nova': {
      r.dur = 0.55;
      fx.add({ type: 'shock', x: p.x, y: p.y - 12, r: s.r, el, dur: 0.5, band: 46, streaks: 24 });
      fx.add({ type: 'flash', x: p.x, y: p.y - 30, r: s.r, el, dur: 0.35, rays: 18 });
      fx.add({ type: 'crack', x: p.x, y: p.y, r: s.r, el, dur: 1.2, n: 12 });
      w.particles?.burst(p.x, p.y - 30, 50, { color: C.spark, speedMin: 160, speedMax: 520, life: 0.7, size: 4, drag: 3, glow: true });
      blow(w, r, p.x, p.y, s.r, s.power, { kb: 380 });
      if (s.heal && real) { const n = Math.round(real.maxHp * s.heal); real.hp = Math.min(real.maxHp, real.hp + n); w.fx?.number(real.x, real.y - 110, `+${n}`, 'heal'); }
      w.shake?.(10, 0.3); w.sfx?.('slam');
      break;
    }
    case 'cross': {
      r.dur = 0.55;
      fx.add({ type: 'xcut', tx: T.x, ty: T.y, r: s.r, el, dur: 0.55 });
      if (real) { real.act = { anim: 'iai', dir: Math.atan2(T.y - real.y, T.x - real.x), t: 0, dur: 0.4 }; }
      at(0.14, () => { blow(w, r, T.x, T.y, s.r * 0.6, s.power / 2, { kb: 60, crit: true }); w.sfx?.('crit'); });
      at(0.28, () => { blow(w, r, T.x, T.y, s.r * 0.6, s.power / 2, { kb: 300, crit: true }); w.sfx?.('crit'); w.shake?.(9, 0.25); w.hitStop?.(0.08); });
      break;
    }
    case 'barrage': {
      r.dur = s.t + 0.2;
      for (let i = 0; i < s.n; i++) at((i * s.t) / s.n, () => {
        const h = hero(w, r), t2 = target(w, r), base = Math.atan2(t2.y - h.y, t2.x - h.x), ang = base + (Math.random() - 0.5) * 0.4;
        if (s.kind === 'crescent') {
          const speed = 820, life = 0.75;
          const f = fx.add({ type: 'arcwave', x: h.x, y: h.y - 30, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 70, th: 20, el, dur: life });
          if (!r.ghost) { const hit = new Set(); w.sk.act({ max: life + 0.1, step: (dtt, a) => { for (const e of live(w)) { if (hit.has(e) || Math.hypot(e.x - f.x, e.y - 30 - f.y) > 70 + (e.r || 20)) continue; hit.add(e); w.playerStrike(e, Math.min(13, s.power * (w.pvp ? ULT_PVP_SCALE : 1)), { src: 'skill', kx: Math.cos(ang) * 200, ky: Math.sin(ang) * 200 }); } return a.t < life; } }); }
        } else if (!r.ghost) {
          const c = elOf(el), n = parseInt(c.glow.slice(1), 16);
          w.firePlayerShot({ kind: s.kind === 'orb' ? 'orb' : s.kind === 'arrow' ? 'arrow' : 'bolt', x: h.x + Math.cos(ang) * 20, y: h.y - 34, angle: ang, speed: s.kind === 'orb' ? 520 : 980, r: s.kind === 'orb' ? 13 : 8, power: Math.min(13, s.power * (w.pvp ? ULT_PVP_SCALE : 1)), homing: s.kind === 'orb' ? 4 : 1, src: 'skill', life: 1.4, tint: [`${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`, c.core] });
        }
        if (real) real.act = { anim: real.wtype?.id === 'bow' ? 'shoot' : 'cast', dir: Math.atan2(T.y - real.y, T.x - real.x), t: 0, dur: 0.12 };
        w.sfx?.(s.kind === 'arrow' ? 'bow' : 'cast', { power: 1.2 });
      });
      break;
    }
    case 'vortex': {
      r.dur = s.t + 0.3;
      fx.add({ type: 'vortex', x: T.x, y: T.y, r: s.r, el, dur: s.t + 0.2, arms: 6 });
      let acc = 0;
      r.tick = (dt) => {
        if (!r.ghost) for (const e of within(w, T.x, T.y, s.r * 1.3)) if (!e.type?.boss && !e.peer) { const a = Math.atan2(T.y - e.y, T.x - e.x); e.vx = (e.vx || 0) + Math.cos(a) * 700 * dt; e.vy = (e.vy || 0) + Math.sin(a) * 700 * dt; }
        acc += dt; if (acc >= 0.25 && r.st < s.t) { acc = 0; blow(w, r, T.x, T.y, s.r, s.power, { kb: -120 }); }
      };
      at(s.t, () => { fx.add({ type: 'shock', x: T.x, y: T.y - 8, r: s.r * 1.4, el, dur: 0.5, band: 50 }); fx.add({ type: 'flash', x: T.x, y: T.y - 20, r: s.r * 1.2, el, dur: 0.35, rays: 18 }); blow(w, r, T.x, T.y, s.r * 1.4, s.end || 2, { kb: 420 }); w.shake?.(12, 0.4); w.sfx?.('slam'); });
      break;
    }
    case 'sig': {
      r.dur = s.t;
      const k = s.kind, scale = s.s || 1;
      const base = { el, dur: s.t, s: scale, x: p.x, y: p.y, tx: T.x, ty: T.y, seed: Math.random() * 6 };
      if (k === 'dragon') fx.add({ type: 'dragon', ...base, x: s.mirror ? T.x + 500 : p.x - 140, y: s.mirror ? T.y - 120 : p.y, breath: !!s.breath });
      else if (k === 'phoenix') fx.add({ type: 'phoenix', ...base });
      else if (k === 'bigblade') fx.add({ type: 'bigblade', ...base, fall: s.t * 0.45 });
      else if (k === 'moon') fx.add({ type: 'moon', ...base, dir: s.dir || 0 });
      else if (k === 'sun') fx.add({ type: 'sun', ...base, black: !!s.black });
      else if (k === 'lotus') fx.add({ type: 'lotus', ...base });
      else if (k === 'wolves') fx.add({ type: 'wolves', ...base, n: s.n || 5 });
      else if (k === 'hammer') fx.add({ type: 'hammer', ...base });
      else if (k === 'chains') fx.add({ type: 'chains', ...base, n: s.n || 6 });
      else if (k === 'galaxy') fx.add({ type: 'galaxy', ...base });
      else if (k === 'blossom') fx.add({ type: 'blossom', ...base });
      else if (k === 'claws') fx.add({ type: 'claws', ...base, sets: s.sets || 2 });
      else if (k === 'clock') { fx.add({ type: 'clock', ...base }); if (real && !w.pvp) addBuff(real, 'haste', 0.4, 4); }
      else if (k === 'eye') fx.add({ type: 'eye', ...base });
      else if (k === 'gate') fx.add({ type: 'gate', ...base, x: p.x, y: p.y, n: s.n || 7 });
      else if (k === 'roots') fx.add({ type: 'roots', ...base, n: s.n || 7 });
      else if (k === 'serpent') fx.add({ type: 'serpent', ...base });
      else if (k === 'thundergod') fx.add({ type: 'thundergod', ...base, follow: real });
      if (real && ['bigblade', 'hammer', 'moon', 'phoenix', 'dragon'].includes(k)) real.act = { anim: 'castBig', dir: Math.atan2(T.y - real.y, T.x - real.x), t: 0, dur: Math.min(1, s.t), glow: true };
      w.sfx?.(['dragon', 'phoenix', 'wolves'].includes(k) ? 'roar' : 'cast', { power: 1.8 });
      // blows while it lasts (impact-heavy signatures land late)
      const hits = s.hits || 0, late = ['bigblade', 'hammer', 'phoenix', 'sun'].includes(k);
      for (let i = 0; i < hits; i++) {
        const tt = late ? s.t * (0.45 + (0.45 * i) / Math.max(1, hits)) : s.t * (0.15 + (0.75 * i) / Math.max(1, hits));
        at(tt, () => {
          const t2 = target(w, r), rad = s.r || (late ? 210 : 160);
          if (k === 'gate' && !r.ghost) { const h = hero(w, r), a = Math.atan2(t2.y - (h.y - 170), t2.x - h.x); const c = elOf(el), n = parseInt(c.glow.slice(1), 16); w.firePlayerShot({ kind: 'spear', x: h.x + (i - hits / 2) * 40, y: h.y - 170, angle: a, speed: 1100, r: 12, power: Math.min(13, s.power * (w.pvp ? ULT_PVP_SCALE : 1)), pierce: 3, src: 'skill', life: 1, tint: [`${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`, c.core] }); return; }
          if (late) { fx.add({ type: 'shock', x: t2.x, y: t2.y - 8, r: rad, el, dur: 0.5, band: 50 }); fx.add({ type: 'crack', x: t2.x, y: t2.y, r: rad * 1.3, el, dur: 1.3, n: 12 }); fx.add({ type: 'flash', x: t2.x, y: t2.y - 30, r: rad, el, dur: 0.35, rays: 16 }); w.shake?.(14, 0.45); w.hitStop?.(0.1); w.sfx?.('slam'); }
          else { fx.add({ type: 'flash', x: t2.x, y: t2.y - 30, r: 80, el, dur: 0.2 }); w.sfx?.('crit'); w.shake?.(4, 0.1); }
          blow(w, r, t2.x, t2.y, rad, s.power, { kb: late ? 400 : 120 });
        });
      }
      if (s.pull) { r.tick = (dt) => { if (r.ghost) return; for (const e of within(w, T.x, T.y, 280)) if (!e.type?.boss && !e.peer) { const a = Math.atan2(T.y - e.y, T.x - e.x); e.vx = (e.vx || 0) + Math.cos(a) * s.pull * dt; e.vy = (e.vy || 0) + Math.sin(a) * s.pull * dt; } }; }
      break;
    }
    case 'finish': {
      r.dur = 0.8;
      at(0.05, () => {
        const t2 = target(w, r);
        r.flashT = 0.45;
        fx.add({ type: 'shock', x: t2.x, y: t2.y - 8, r: s.r, el, dur: 0.6, band: 60, streaks: 30 });
        fx.add({ type: 'flash', x: t2.x, y: t2.y - 40, r: s.r * 1.4, el, dur: 0.5, rays: 24 });
        fx.add({ type: 'pillar', x: t2.x, y: t2.y, w: s.r * 0.5, el, dur: 0.6, h: 700 });
        fx.add({ type: 'crack', x: t2.x, y: t2.y, r: s.r * 1.4, el, dur: 1.6, n: 14 });
        w.particles?.burst(t2.x, t2.y - 30, 80, { color: C.spark, speedMin: 200, speedMax: 700, life: 0.9, size: 5, drag: 2.5, glow: true });
        blow(w, r, t2.x, t2.y, s.r, s.power, { kb: 520, crit: true });
        if (s.heal && real) { const n = Math.round(real.maxHp * s.heal); real.hp = Math.min(real.maxHp, real.hp + n); w.fx?.number(real.x, real.y - 110, `+${n}`, 'heal'); }
        w.shake?.(18, 0.6); w.hitStop?.(0.12); w.sfx?.('shatter'); w.sfx?.('slam');
      });
      break;
    }
    default: r.dur = 0.1;
  }
}

// ------------------------------------------------------------------ screen: letterbox, cut-in and the white flash
// drawHeroAt(ctx, x, y, scale) draws the hero big for the cut-in (the scene passes it; null for replays).
export function drawUltScreen(ctx, w, view, drawHeroAt) {
  const runs = [];
  if (w.ult?.run) runs.push(w.ult.run);
  for (const g of w.ghostUlts || []) runs.push(g);
  for (const r of runs) {
    const C = elOf(r.el), tier = r.tier || ULT_TIERS[1];
    if (!r.ghost) {
      // letterbox while the hero's ultimate plays
      const bars = Math.min(1, r.t / 0.25) * Math.min(1, (totalDur(r) - r.t) / 0.3 + 0.2), bh = view.h * 0.09 * Math.max(0, bars);
      ctx.fillStyle = 'rgba(2,3,10,0.92)'; ctx.fillRect(0, 0, view.w, bh); ctx.fillRect(0, view.h - bh, view.w, bh);
    }
    // the cut-in
    if (r.cutT < r.cut) {
      const k = r.cutT / r.cut, inn = Math.min(1, k / 0.18), out = k > 0.82 ? (k - 0.82) / 0.18 : 0;
      const small = r.ghost;
      const H = small ? Math.min(120, view.h * 0.16) : Math.min(260, view.h * 0.34), cy = small ? H * 0.75 + 10 : view.h * 0.45;
      const slide = (1 - easeOut(inn)) * view.w * 0.6 - out * view.w * 0.8;
      ctx.save();
      if (!small) { ctx.fillStyle = `rgba(4,4,14,${(0.5 * (1 - out)).toFixed(3)})`; ctx.fillRect(0, 0, view.w, view.h); }
      ctx.translate(slide, 0);
      // skewed band
      ctx.beginPath(); ctx.moveTo(-40, cy - H / 2 + 24); ctx.lineTo(view.w + 40, cy - H / 2 - 24); ctx.lineTo(view.w + 40, cy + H / 2 - 24); ctx.lineTo(-40, cy + H / 2 + 24); ctx.closePath();
      const g = ctx.createLinearGradient(0, cy - H / 2, 0, cy + H / 2);
      g.addColorStop(0, hexA(C.deep, 0.95)); g.addColorStop(0.5, hexA(C.glow, 0.85)); g.addColorStop(1, hexA(C.deep, 0.95));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // speed lines
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const y = cy - H / 2 + ((i * 37) % H), x = ((r.cutT * 2600 + i * 173) % (view.w + 400)) - 200; ctx.beginPath(); ctx.moveTo(view.w - x, y); ctx.lineTo(view.w - x - 120 - (i % 4) * 40, y); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(view.w * 0.28, cy, 0, view.w * 0.28, cy, H);
      gg.addColorStop(0, hexA(C.core, 0.7)); gg.addColorStop(1, hexA(C.glow, 0));
      ctx.fillStyle = gg; ctx.fillRect(0, cy - H, view.w, H * 2);
      ctx.globalCompositeOperation = 'source-over';
      if (drawHeroAt && !small) drawHeroAt(ctx, view.w * 0.27, cy + H * 0.42, H / 120);
      ctx.restore();
      ctx.strokeStyle = hexA(C.core, 0.9); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-40, cy - H / 2 + 24); ctx.lineTo(view.w + 40, cy - H / 2 - 24); ctx.moveTo(-40, cy + H / 2 + 24); ctx.lineTo(view.w + 40, cy + H / 2 - 24); ctx.stroke();
      // names
      ctx.textAlign = small ? 'center' : 'left'; ctx.textBaseline = 'middle';
      const tx = small ? view.w / 2 : view.w * 0.45;
      ctx.font = `700 ${small ? 12 : 16}px "Bai Jamjuree", system-ui, sans-serif`;
      ctx.fillStyle = tier.color; ctx.strokeStyle = 'rgba(4,4,14,0.9)'; ctx.lineWidth = 4;
      const sub = `${small && r.who ? `${r.who} · ` : ''}ท่าไม้ตาย · ระดับ ${tier.name}`;
      ctx.strokeText(sub, tx, cy - (small ? 18 : 42)); ctx.fillText(sub, tx, cy - (small ? 18 : 42));
      const fs = small ? 24 : Math.min(64, view.w / 11);
      ctx.font = `400 ${fs}px "Chonburi", serif`;
      ctx.lineWidth = small ? 5 : 9; ctx.strokeStyle = 'rgba(4,4,14,0.92)'; ctx.fillStyle = '#ffffff';
      ctx.strokeText(r.def.name, tx, cy + (small ? 8 : 10)); ctx.fillText(r.def.name, tx, cy + (small ? 8 : 10));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(C.glow, 0.5); ctx.fillText(r.def.name, tx, cy + (small ? 8 : 10));
      ctx.restore();
    }
    if (r.flashT > 0 && !r.ghost) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, r.flashT * 1.9).toFixed(3)})`; ctx.fillRect(0, 0, view.w, view.h); }
  }
}
function totalDur(r) {
  let d = 0;
  for (const s of r.steps) d += s.k === 'charge' ? s.t : s.k === 'dash' ? (s.n || 1) * 0.16 + 0.12 : s.k === 'blink' ? (s.n || 3) * 0.12 + 0.15 : s.k === 'spin' || s.k === 'sig' ? s.t : s.k === 'leap' ? 0.63 : s.k === 'beam' || s.k === 'barrage' ? s.t + 0.2 : s.k === 'rain' ? s.t + 0.6 : s.k === 'vortex' ? s.t + 0.3 : s.k === 'finish' ? 0.8 : 0.55;
  return d;
}
export const ultDuration = (def) => totalDur({ steps: def.seq });
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Wires a world for ultimates. o: { app, audio, id (the weapon's ultimate), pvp, freezes (solo PvE), net(msg) }
export function installUlt(w, o) {
  w.ult = createUltState(o.id, !!o.pvp);
  w.ultFreezes = !!o.freezes;
  w.onUltReady = (u) => { o.app.hud.banner('ท่าไม้ตายพร้อม!', `${u.def.tier === 6 ? '???' : u.def.name} · กด G หรือปุ่มไม้ตาย`); o.audio.play('unlock'); };
  w.onUltStart = () => { o.app.hud.cinema?.(true); o.audio.play('legendary'); };
  w.onUltEnd = () => o.app.hud.cinema?.(false);
  w.ultEvent = (kind) => {
    if (!w.ult) return;
    const g = o.pvp ? { hit: ULT_GAIN.pvpHit, hurt: ULT_GAIN.pvpHurt, perfect: ULT_GAIN.pvpPerfect, parry: ULT_GAIN.pvpPerfect } : { mob: ULT_GAIN.mob, boss: ULT_GAIN.boss, perfect: ULT_GAIN.perfect, parry: ULT_GAIN.perfect };
    gainUlt(w, g[kind] || 0);
  };
  w.tryUlt = () => { const m = unleash(w); if (m) { o.net?.(m); o.onUse?.(); } return !!m; };
}
