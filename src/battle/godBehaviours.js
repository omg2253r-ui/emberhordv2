// The ten gods of the Underworld Tower (floors 10…100). Hard, but every attack is read-able:
//   • every hit is telegraphed (a shape on the floor, or the boss flashes "!" before a parryable swing)
//   • PIERCING attacks (crimson telegraphs) ignore the shield and the hero's defence — dodge them, never block
//   • v8.6: no god is ever immune any more. Where one used to hide (submerged, burrowed, chained, on its throne) it can still
//     be hit and its health is worth several bars instead (data/bossGuard.js); the old immune windows survive as staggers
// Attacks are written as short timed scripts (plan → act) so each pattern stays readable.
// World API: see battle/zoneBehaviours.js, plus world.silence(t), world.chill(t), world.sin (judge), world.darkPulse(t).
import { BEHAVIOURS } from './enemies.js';
import { burnOutArmor } from './bossArmor.js';

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
function steer(e, angle, speed, dt, k = 6) { const f = Math.min(1, dt * k); e.vx += (Math.cos(angle) * speed - e.vx) * f; e.vy += (Math.sin(angle) * speed - e.vy) * f; }
const stop = (e, dt, k = 8) => steer(e, 0, 0, dt, k);
function setState(e, s) { e.state = s; e.t = 0; e.hitThisAttack = false; }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
function inArena(world, x, y, pad = 100) { const A = world.arena; return { x: Math.max(pad, Math.min(A.w - pad, x)), y: Math.max(pad + 40, Math.min(A.h - pad, y)) }; }
const rnd = (world) => world.rng.next();
// v8.6: a boss is worth several health bars (e.bars). Objectives and time windows are sized by ONE bar, so they stay as hard
// as they were however many bars the boss has.
const bar = (e) => e.maxHp / (e.bars || 1);

// ---------------------------------------------------------------- scripted attacks
// plan(e, [[time, fn], …], length): the god runs the script, then rests (rest = the opening for the hero)
function plan(e, steps, total, rest = 0.9) { e.ai.q = steps.sort((a, b) => a[0] - b[0]); e.ai.qi = 0; e.ai.total = total; e.ai.rest = rest; setState(e, 'act'); }
function runPlan(e, dt, world) {
  const q = e.ai.q || [];
  while (e.ai.qi < q.length && e.t >= q[e.ai.qi][0]) { const fn = q[e.ai.qi++][1]; fn(); }
  if (e.ai.move) e.ai.move(dt); else stop(e, dt, 6);
  if (e.t >= e.ai.total) { e.ai.move = null; e.warn = 0; setState(e, 'rest'); }
}
// parryable melee: everyone in the arc in front of the god is hit (each player may parry on their side)
function meleeArc(e, world, dir, range, arc, mult, kb = 380, extra = null) {
  const prev = world.player;
  for (const t of world.players) {
    if (!t || t.dead) continue;
    if (Math.hypot(t.x - e.x, t.y - e.y) > range + (t.r || 20) || Math.abs(angDiff(Math.atan2(t.y - e.y, t.x - e.x), dir)) > arc / 2) continue;
    world.player = t;
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    world.hitPlayer(e, mult, Math.cos(a) * kb, Math.sin(a) * kb, false, extra);
  }
  world.player = prev;
}
const tellArc = (world, e, dir, range, arc, dur, tone) => world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: dir, r: range, arc, dur, mult: 0, owner: e, tone });
// a swing the hero may parry: flash "!" for `tel` seconds, then strike
function swing(e, world, at, tel, range, arc, mult, tone, pierce = false) {
  const steps = [];
  steps.push([at, () => { e.ai.dir = toward(e, world.player); tellArc(world, e, e.ai.dir, range, arc, tel, pierce ? 'pierce' : tone); e.warn = 1; world.sfx('telegraph'); }]);
  steps.push([at + tel, () => { meleeArc(e, world, e.ai.dir, range, arc, mult, 380, pierce ? { unblockable: true, pierce: true } : null); e.warn = 0; world.sfx('swing'); steer(e, e.ai.dir, 380, 1, 1); }]);
  return steps;
}
const strike = (world, e, s) => world.strike({ owner: e, ...s });
function phaseOf(e) { const f = e.hp / e.maxHp; return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; }
function phaseChange(e, world, lines, onEnter) {
  const ph = phaseOf(e);
  if (ph !== e.ai.phase) {
    if (e.ai.phase) { world.announce(lines[ph] || ''); world.sfx('roar'); world.sfx('phase'); world.shake(14, 0.7); onEnter?.(ph); }
    e.ai.phase = ph;
  }
  return ph;
}
function choose(e, world, pool) {
  e.ai.last ||= [];
  const options = pool.filter((p) => !e.ai.last.includes(p));
  const pick = (options.length ? options : pool)[(rnd(world) * (options.length || pool.length)) | 0];
  e.ai.last = [pick, ...e.ai.last].slice(0, Math.min(2, pool.length - 1));
  return pick;
}
function summon(world, e, id, n, r = 200) {
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rnd(world); const at = inArena(world, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.7); world.spawnEnemy(id, at.x, at.y); }
}
// common loop: idle → stalk (approach) → pick an attack → act → rest
function godLoop(e, dt, world, { speed = 1, pick, rest = 0.9 }) {
  if (e.state === 'idle') { setState(e, 'stalk'); }
  if (e.state === 'act') { runPlan(e, dt, world); return; }
  if (e.state === 'rest') { stop(e, dt, 5); if (e.t >= (e.ai.rest ?? rest) / speed) setState(e, 'stalk'); return; }
  if (e.state === 'stalk') {
    const p = world.player;
    if (p) { const d = dist(e, p); if (d > 170) steer(e, toward(e, p), e.type.speed, dt, 3); else stop(e, dt, 4); }
    if (e.t >= 0.5 / speed) pick();
  }
}

Object.assign(BEHAVIOURS, {
  // ================================================================ 10 วาริยะ — river of souls
  // Submerges (drawn faint, but still hittable) and erupts from geysers; the current pushes everyone one way. When it surfaces it is
  // winded for a moment — that is the time to punish.
  god_river(e, dt, world) {
    const ph = phaseChange(e, world, { 2: 'แม่น้ำวิญญาณเชี่ยวกราก!', 3: 'วาริยะเรียกผู้จมน้ำ!' }, (n) => { if (n === 3) summon(world, e, e.type.ai_params.summon, 3); });
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ph === 1 ? ['oar', 'souls', 'current', 'submerge'] : ['oar', 'souls', 'current', 'submerge', 'whirl']);
      const p = world.player, steps = [];
      if (a === 'oar') {
        const n = ph === 3 ? 3 : 2;
        for (let i = 0; i < n; i++) steps.push(...swing(e, world, i * 0.75 * k, 0.55 * k, 175, 2.3, 1.5, 'ice'));
        plan(e, steps, n * 0.75 * k + 0.4);
      } else if (a === 'souls') {
        const n = 6 + ph * 2;
        steps.push([0.3, () => { for (let i = 0; i < n; i++) world.shoot(e, { x: e.x, y: e.y - 40, angle: (i / n) * TAU, speed: 190, r: 12, mult: 0.8, kind: 'orb', homing: 1.1, life: 5, tone: 'ice' }); world.sfx('cast'); }]);
        plan(e, steps, 1.2);
      } else if (a === 'current') {
        const right = rnd(world) < 0.5;
        steps.push([0, () => world.gust(right ? 0 : Math.PI, 2.6 * k, 300)]);
        for (let i = 0; i < 4; i++) steps.push([0.3 + i * 0.35 * k, () => { const A = world.arena; const x = 140 + rnd(world) * (A.w - 280); strike(world, e, { shape: 'line', x, y: 80, angle: Math.PI / 2, len: A.h - 120, width: 70, dur: 0.95 * k, mult: 1.1, tone: 'ice' }); }]);
        plan(e, steps, 2.4 * k);
      } else if (a === 'submerge') {
        const n = ph === 1 ? 3 : 4;
        steps.push([0, () => { e.untargetable = true; e.hidden = 1; world.sfx('roar'); world.particles.burst(e.x, e.y, 30, { color: ['#7fe8ff', '#2a4a6a'], speedMin: 80, speedMax: 260, life: 0.6, size: 4, drag: 3 }); }]);
        for (let i = 0; i < n; i++) steps.push([0.5 + i * 0.85 * k, () => { const t = world.player || p; strike(world, e, { shape: 'circle', x: t.x, y: t.y, r: 95, dur: 0.85 * k, mult: 1.4, tone: 'ice', kb: 520 }); e.ai.gx = t.x; e.ai.gy = t.y; }]);
        steps.push([0.5 + n * 0.85 * k + 0.1, () => {
          e.x = e.ai.gx; e.y = e.ai.gy; world.clampBody?.(e);
          e.untargetable = false; e.hidden = 0;
          strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 200, inner: 90, dur: 0.5, mult: 1.0, tone: 'ice' });
          world.fx.callout(e.x, e.y - 160, 'เหนื่อยหอบ!', '#9fffd8');
        }]);
        plan(e, steps, 0.5 + n * 0.85 * k + 0.4, 2.4);         // long rest after surfacing: the opening
      } else {
        steps.push([0, () => { world.pool({ x: e.x, y: e.y, r: 170, dur: 7, kind: 'ice', mult: 0, owner: e }); }]);
        for (let i = 0; i < 3; i++) steps.push([0.4 + i * 0.55 * k, () => strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 140 + i * 110, inner: 60 + i * 110, dur: 0.8 * k, mult: 1.2, tone: 'ice' })]);
        plan(e, steps, 2.0 * k);
      }
    } });
  },

  // ================================================================ 20 กาฬโลหิต — chains
  // Piercing chain lashes (crimson: cannot be blocked), a hook that drags you in, a cage you must read. At 66% and
  // 33% it chains itself to three anchors (it can still be hurt); breaking all three shakes it for 3 s (poise break).
  god_chains(e, dt, world) {
    const anchors = (e.ai.anchors || []).filter((a) => !a.dead);
    if (e.ai.anchors && !anchors.length) { e.ai.anchors = null; world.announce('โซ่ขาด! กาฬโลหิตเปิดช่องโหว่'); world.sfx('guardBreak'); e.brokenT = 3; }
    const ph = phaseChange(e, world, { 2: 'กาฬโลหิตล่ามตัวเองไว้กับหมุดโซ่ ทุบหมุดทั้งสามให้มันเสียหลัก!', 3: 'โซ่ทุกเส้นถูกปลดปล่อย!' }, (n) => {
      const A = world.arena;
      e.ai.anchors = [[0.2, 0.3], [0.8, 0.3], [0.5, 0.85]].map(([fx, fy]) => world.spawnEnemy('z_pylon', A.w * fx, A.h * fy)).filter(Boolean);
      for (const a of e.ai.anchors) { a.anchorOf = e.id; a.maxHp = a.hp = Math.round(bar(e) * 0.025); a.noReward = true; }
      if (n === 3) summon(world, e, e.type.ai_params.summon, 2);
    });
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ph === 1 ? ['lash', 'hook', 'cage', 'claws'] : ['lash', 'hook', 'cage', 'claws', 'whirl']);
      const p = world.player, steps = [];
      if (a === 'lash') {
        const n = ph === 1 ? 2 : 3;
        for (let i = 0; i < n; i++) steps.push([i * 0.5 * k, () => { const t = world.player || p; const d = toward(e, t) + (i - (n - 1) / 2) * 0.35; strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: d, len: 820, width: 46, dur: 0.75 * k, mult: 1.3, tone: 'pierce', pierce: true }); }]);
        plan(e, steps, n * 0.5 * k + 0.9);
      } else if (a === 'hook') {
        steps.push([0, () => { e.ai.dir = toward(e, world.player || p); strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: 640, width: 50, dur: 0.6 * k, mult: 0.5, tone: 'bone', kb: -900 }); }]);
        steps.push(...swing(e, world, 0.6 * k + 0.25, 0.42 * k, 170, 1.9, 1.6, 'bone'));
        plan(e, steps, 0.6 * k + 0.25 + 0.42 * k + 0.4);
      } else if (a === 'cage') {
        steps.push([0, () => { const t = world.player || p; e.ai.cx = t.x; e.ai.cy = t.y; strike(world, e, { shape: 'ring', x: t.x, y: t.y, r: 190, inner: 120, dur: 1.0 * k, mult: 1.3, tone: 'bone' }); }]);
        steps.push([1.0 * k + 0.2, () => strike(world, e, { shape: 'circle', x: e.ai.cx, y: e.ai.cy, r: 120, dur: 0.9 * k, mult: 1.6, tone: 'pierce', pierce: true })]);
        plan(e, steps, 2.3 * k);
      } else if (a === 'claws') {
        for (let i = 0; i < 3; i++) steps.push(...swing(e, world, i * 0.62 * k, 0.45 * k, 160, 1.7, 1.25, 'bone'));
        plan(e, steps, 3 * 0.62 * k + 0.3);
      } else {
        for (let i = 0; i < 8; i++) steps.push([0.2 + i * 0.12, () => strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: (i / 8) * TAU + e.t, len: 520, width: 40, dur: 0.8 * k, mult: 1.1, tone: 'bone' })]);
        plan(e, steps, 2.0 * k);
      }
    } });
  },

  // ================================================================ 30 มารีจิ — hellfire
  // A shield of fire (armour for every phase, see data/bossArmor.js) soaks the blows. After its great nova the shield burns
  // out for a few seconds; shoot it away yourself and it grows back 5 s later.
  god_hellfire(e, dt, world) {
    const ph = phaseChange(e, world, { 2: 'เตาไฟนรกลุกโชน!', 3: 'มารีจิกลืนทุกสิ่ง!' }, (n) => { if (n >= 2) summon(world, e, e.type.ai_params.summon, n === 3 ? 3 : 2); });
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    if (!e.ai.started) { e.ai.started = true; e.ai.count = 0; }
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      e.ai.count = (e.ai.count || 0) + 1;
      const a = e.ai.count % 3 === 0 ? 'nova' : choose(e, world, ph === 1 ? ['pillars', 'fireballs', 'claws'] : ['pillars', 'fireballs', 'claws', 'inferno']);
      const p = world.player, steps = [];
      if (a === 'nova') {
        steps.push([0, () => { world.announce('มารีจิรวบรวมไฟ…'); world.sfx('charge'); e.warn = 1; }]);
        for (let i = 0; i < 4; i++) steps.push([0.9 + i * 0.45 * k, () => strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 120 + i * 110, inner: 40 + i * 110, dur: 0.9 * k, mult: 1.5, tone: 'fire', fire: true })]);
        steps.push([0.9 + 4 * 0.45 * k + 0.9 * k, () => { burnOutArmor(e, 5); e.warn = 0; world.fx.callout(e.x, e.y - 170, 'โล่เพลิงมอด! ตีเลย!', '#ffe89a'); world.sfx('guardBreak'); }]);
        plan(e, steps, 0.9 + 4 * 0.45 * k + 0.9 * k + 0.2, 3.5);
      } else if (a === 'pillars') {
        const n = 6 + ph * 2;
        steps.push([0, () => { for (let i = 0; i < n; i++) { const t = i === 0 ? (world.player || p) : inArena(world, 120 + rnd(world) * (world.arena.w - 240), 160 + rnd(world) * (world.arena.h - 260)); strike(world, e, { shape: 'circle', x: t.x, y: t.y, r: 75, dur: (1.0 + i * 0.07) * k, mult: 1.3, fire: true, tone: 'fire', meteor: true, then: { pool: { kind: 'fire', r: 50, dur: 3, mult: 0.3 } } }); } world.sfx('roar'); }]);
        plan(e, steps, 1.8 * k);
      } else if (a === 'fireballs') {
        for (let v = 0; v < 3; v++) steps.push([v * 0.5 * k, () => { const base = toward(e, world.player || p); for (let i = 0; i < 5; i++) world.shoot(e, { x: e.x, y: e.y - 50, angle: base + (i - 2) * 0.2, speed: 330, r: 13, mult: 0.9, kind: 'orb', fire: true, tone: 'fire', life: 4 }); world.sfx('cast'); }]);
        plan(e, steps, 1.8 * k);
      } else if (a === 'claws') {
        for (let i = 0; i < 2; i++) steps.push(...swing(e, world, i * 0.7 * k, 0.5 * k, 180, 2.0, 1.5, 'fire'));
        plan(e, steps, 1.6 * k);
      } else {
        const left = rnd(world) < 0.5, A = world.arena;
        steps.push([0, () => strike(world, e, { shape: 'rect', x: left ? 40 : A.w / 2, y: 60, w: A.w / 2 - 40, h: A.h - 80, dur: 1.4 * k, mult: 1.8, fire: true, tone: 'fire' })]);
        steps.push([1.6 * k, () => strike(world, e, { shape: 'rect', x: left ? A.w / 2 : 40, y: 60, w: A.w / 2 - 40, h: A.h - 80, dur: 1.2 * k, mult: 1.8, fire: true, tone: 'fire' })]);
        plan(e, steps, 3.0 * k);
      }
    } });
  },

  // ================================================================ 40 สุญญตา — silence
  // Darkness, blink slashes from behind, a pulse that silences skills, and shadow copies: only the real one
  // casts a shadow on the floor.
  god_silence(e, dt, world) {
    if (e.clone) {
      // a copy: blinks and slashes, dies to one hit
      if (e.state === 'idle') setState(e, 'stalk');
      if (e.state === 'act') { runPlan(e, dt, world); return; }
      if (e.state === 'rest') { stop(e, dt); if (e.t > 1.4) setState(e, 'stalk'); return; }
      if (e.t > 1.2 + (e.id % 3) * 0.4) blinkSlash(e, world, 0.55, 0.8);
      return;
    }
    const ph = phaseChange(e, world, { 2: 'เงาของสุญญตาแตกออกเป็นหลายร่าง', 3: 'ความเงียบกลืนทั้งห้อง' }, (n) => {
      world.darkPulse(6);
      for (let i = 0; i < (n === 3 ? 4 : 3); i++) {
        const c = world.spawnEnemy(e.type.id, e.x + (i - 1) * 160, e.y + (i % 2 ? 80 : -80));
        if (c) { c.clone = true; c.noReward = true; c.maxHp = c.hp = 1; c.atk = e.atk * 0.6; }
      }
      // the real one swaps places with a copy
      const copies = world.enemiesOf?.(e.type.id).filter((x) => x.clone && !x.dead) || [];
      if (copies.length) { const c = copies[(rnd(world) * copies.length) | 0]; [e.x, c.x] = [c.x, e.x]; [e.y, c.y] = [c.y, e.y]; }
    });
    const k = ph === 3 ? 0.8 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ['blink', 'silence', 'lines', 'dark', 'blink2']);
      const steps = [];
      if (a === 'blink' || a === 'blink2') { blinkSlash(e, world, 0.48 * k, 1.5, a === 'blink2' ? 2 : 1); return; }
      if (a === 'silence') {
        steps.push([0, () => { strike(world, e, { shape: 'circle', x: e.x, y: e.y, r: 280, dur: 1.25 * k, mult: 0.6, tone: 'shadow', silence: 3 }); world.sfx('charge'); }]);
        plan(e, steps, 1.6 * k);
      } else if (a === 'lines') {
        const A = world.arena, vertical = rnd(world) < 0.5;
        for (let i = 0; i < 6; i++) steps.push([i * 0.22 * k, () => { const f = (i + 0.5) / 6; strike(world, e, vertical ? { shape: 'line', x: 60 + f * (A.w - 120), y: 70, angle: Math.PI / 2, len: A.h - 100, width: 60, dur: 0.9 * k, mult: 1.2, tone: 'shadow' } : { shape: 'line', x: 50, y: 110 + f * (A.h - 170), angle: 0, len: A.w - 100, width: 60, dur: 0.9 * k, mult: 1.2, tone: 'shadow' }); }]);
        plan(e, steps, 6 * 0.22 * k + 1.0);
      } else {
        steps.push([0, () => world.darkPulse(4)]);
        for (let i = 0; i < 6; i++) steps.push([0.4 + i * 0.3, () => world.shoot(e, { x: e.x, y: e.y - 40, angle: toward(e, world.player) + (rnd(world) - 0.5) * 0.6, speed: 280, r: 11, mult: 0.9, kind: 'orb', homing: 0.8, tone: 'shadow', life: 4 })]);
        plan(e, steps, 2.4);
      }
    } });
  },

  // ================================================================ 50 ยมทัณฑ์ — the scales
  // Every hit you take adds SIN; the verdict hits as hard as your sins (pierces). The scales tip: half the hall
  // is judged, then the other half. Clean play keeps the verdict small.
  god_judge(e, dt, world) {
    world.sinOn = true;
    const ph = phaseChange(e, world, { 2: 'ตาชั่งเอียงสองครั้ง', 3: 'คำพิพากษาสุดท้าย' }, (n) => summon(world, e, e.type.ai_params.summon, n === 3 ? 3 : 2));
    const k = ph === 3 ? 0.8 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ['verdict', 'tilt', 'swords', 'feathers']);
      const steps = [], A = world.arena;
      if (a === 'verdict') {
        steps.push([0, () => { const t = world.player; const sin = world.sin || 0; e.ai.sin = sin; world.fx.callout(e.x, e.y - 170, `บาป ${sin}`, '#e0b45a'); strike(world, e, { shape: 'circle', x: t.x, y: t.y, r: 130, dur: 1.1 * k, mult: 0.6 + 0.35 * sin, tone: 'pierce', pierce: true, holy: true }); world.sin = 0; }]);
        plan(e, steps, 1.5 * k);
      } else if (a === 'tilt') {
        const left = rnd(world) < 0.5, n = ph >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) { const side = (i % 2 === 0) === left; steps.push([i * 1.5 * k, () => strike(world, e, { shape: 'rect', x: side ? 40 : A.w / 2, y: 60, w: A.w / 2 - 40, h: A.h - 80, dur: 1.35 * k, mult: 1.7, tone: 'holy' })]); }
        plan(e, steps, n * 1.5 * k + 0.3);
      } else if (a === 'swords') {
        for (let i = 0; i < 3; i++) steps.push(...swing(e, world, i * 0.6 * k, 0.45 * k, 185, 2.0, 1.4, 'holy'));
        plan(e, steps, 3 * 0.6 * k + 0.3);
      } else {
        steps.push([0.2, () => { for (let i = 0; i < 16; i++) world.shoot(e, { x: e.x, y: e.y - 50, angle: (i / 16) * TAU, speed: 240, r: 10, mult: 0.8, kind: 'orb', tone: 'holy', life: 5, orbit: { cx: e.x, cy: e.y - 40, r0: 40, grow: 150, spin: 0.9 } }); world.sfx('cast'); }]);
        plan(e, steps, 1.6);
      }
    } });
  },

  // ================================================================ 60 พิษภุชงค์ — the serpent
  // Burrows (faint, still hittable) and bursts up under you, sweeps its tail (piercing), spits poison that floods the
  // floor. After a burst it is stuck for a breath.
  god_serpent(e, dt, world) {
    const ph = phaseChange(e, world, { 2: 'พิษท่วมขุมนรก', 3: 'ภุชงค์ลอกคราบ!' }, (n) => summon(world, e, e.type.ai_params.summon, n === 3 ? 4 : 2));
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ['burrow', 'tail', 'spit', 'lunge', 'flood']);
      const steps = [], A = world.arena;
      if (a === 'burrow') {
        const n = ph === 1 ? 2 : 3;
        steps.push([0, () => { e.untargetable = true; e.hidden = 1; world.sfx('slam'); }]);
        for (let i = 0; i < n; i++) steps.push([0.6 + i * 1.1 * k, () => { const t = world.player; e.ai.bx = t.x; e.ai.by = t.y; strike(world, e, { shape: 'circle', x: t.x, y: t.y, r: 115, dur: 0.9 * k, mult: 1.6, tone: 'pierce', pierce: true }); }]);
        steps.push([0.6 + n * 1.1 * k, () => { e.x = e.ai.bx; e.y = e.ai.by; world.clampBody?.(e); e.untargetable = false; e.hidden = 0; world.fx.callout(e.x, e.y - 170, 'ติดอยู่!', '#e8ff9a'); e.brokenT = Math.max(e.brokenT || 0, 1.6); }]);
        plan(e, steps, 0.6 + n * 1.1 * k + 0.2, 1.8);
      } else if (a === 'tail') {
        steps.push([0, () => { e.ai.dir = toward(e, world.player) + Math.PI; strike(world, e, { shape: 'cone', x: e.x, y: e.y - 10, angle: e.ai.dir, r: 250, arc: 3.6, dur: 0.75 * k, mult: 1.7, tone: 'pierce', pierce: true }); e.warn = 1; }]);
        plan(e, steps, 1.1 * k);
      } else if (a === 'spit') {
        for (let v = 0; v < 2 + ph; v++) steps.push([v * 0.45 * k, () => world.shoot(e, { x: e.x, y: e.y - 50, angle: toward(e, world.player) + (rnd(world) - 0.5) * 0.3, speed: 380, r: 14, mult: 0.9, kind: 'orb', tone: 'poison', life: 4, pool: { kind: 'poison', r: 80, dur: 6 } })]);
        plan(e, steps, (2 + ph) * 0.45 * k + 0.5);
      } else if (a === 'lunge') {
        steps.push([0, () => { e.ai.dir = toward(e, world.player); strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: 560, width: e.r * 2, dur: 0.65 * k, mult: 1.5, tone: 'poison' }); }]);
        steps.push([0.65 * k, () => { e.ai.move = (d) => { e.vx = Math.cos(e.ai.dir) * 950; e.vy = Math.sin(e.ai.dir) * 950; }; }]);
        steps.push([0.65 * k + 0.55, () => { e.ai.move = null; e.vx *= 0.1; e.vy *= 0.1; }]);
        plan(e, steps, 0.65 * k + 0.8);
      } else {
        steps.push([0, () => { for (let i = 0; i < 4 + ph; i++) { const at = inArena(world, 120 + rnd(world) * (A.w - 240), 160 + rnd(world) * (A.h - 260)); world.pool({ x: at.x, y: at.y, r: 110, dur: 9, kind: 'poison', mult: 0.35, owner: e }); } world.sfx('roar'); }]);
        plan(e, steps, 1.0);
      }
    } });
  },

  // ================================================================ 70 ราตรีกาล — the clock
  // Clock hands sweep the hall. REWIND: it channels inside a clock face and will heal back what you took in the
  // last six seconds — hit it hard enough during the channel to break it. Time-stop circles slow you.
  god_time(e, dt, world) {
    e.ai.hist ||= [];
    e.ai.histT = (e.ai.histT || 0) - dt;
    if (e.ai.histT <= 0) { e.ai.histT = 0.5; e.ai.hist.push(e.hp); if (e.ai.hist.length > 12) e.ai.hist.shift(); }
    const ph = phaseChange(e, world, { 2: 'เวลาเริ่มเดินถอยหลัง', 3: 'ราตรีกาลหยุดทุกเข็ม' }, (n) => summon(world, e, e.type.ai_params.summon, n === 3 ? 3 : 2));
    const k = ph === 3 ? 0.8 : ph === 2 ? 0.9 : 1;
    if (e.state === 'rewind') {
      stop(e, dt, 9);
      const dealt = e.ai.rewindHp - e.hp;
      if (dealt >= bar(e) * 0.035) { setState(e, 'rest'); e.ai.rest = 2.2; e.brokenT = 2.5; world.announce('ขัดจังหวะการย้อนเวลา!'); world.sfx('guardBreak'); return; }
      if (e.t >= 3.0 * k) {
        const back = e.ai.hist[0] ?? e.hp;
        if (back > e.hp) { world.fx.number(e.x, e.y - 160, `+${Math.round(back - e.hp)}`, 'heal'); e.hp = Math.min(e.maxHp, back); }
        world.announce('เวลาย้อนกลับ'); world.sfx('blink'); setState(e, 'rest'); e.ai.rest = 0.8;
      }
      return;
    }
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ph === 1 ? ['hands', 'stop', 'echo', 'bells'] : ['hands', 'stop', 'echo', 'bells', 'rewind']);
      const steps = [];
      if (a === 'rewind') {
        e.ai.rewindHp = e.hp;
        strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 150, inner: 140, dur: 3.0 * k, mult: 0, tone: 'sun' });
        world.announce('ราตรีกาลกำลังย้อนเวลา! ตีขัดจังหวะ');
        setState(e, 'rewind');
        return;
      }
      if (a === 'hands') {
        const base = rnd(world) * TAU, dir = rnd(world) < 0.5 ? 1 : -1, n = 12;
        for (let i = 0; i < n; i++) steps.push([i * 0.13 * k, () => { const ang = base + dir * i * 0.26; strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: ang, len: 900, width: 46, dur: 0.7 * k, mult: 1.2, tone: 'sun' }); strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: ang + Math.PI, len: 900, width: 46, dur: 0.7 * k, mult: 1.2, tone: 'sun' }); }]);
        plan(e, steps, n * 0.13 * k + 0.9);
      } else if (a === 'stop') {
        steps.push([0, () => { const t = world.player; strike(world, e, { shape: 'circle', x: t.x, y: t.y, r: 170, dur: 1.0 * k, mult: 0.7, tone: 'sun', chill: 3 }); }]);
        steps.push(...swing(e, world, 1.2 * k, 0.4 * k, 190, 2.2, 1.6, 'sun'));
        plan(e, steps, 1.2 * k + 0.4 * k + 0.4);
      } else if (a === 'echo') {
        const spots = [];
        steps.push([0, () => { for (let i = 0; i < 6; i++) { const t = i === 0 ? world.player : inArena(world, 120 + rnd(world) * (world.arena.w - 240), 160 + rnd(world) * (world.arena.h - 260)); spots.push({ x: t.x, y: t.y }); strike(world, e, { shape: 'circle', x: t.x, y: t.y, r: 85, dur: 1.0 * k, mult: 1.2, tone: 'sun' }); } }]);
        steps.push([1.6 * k, () => { world.fx.callout(e.x, e.y - 170, 'เสียงสะท้อน', '#fff3c4'); for (const s of spots) strike(world, e, { shape: 'circle', x: s.x, y: s.y, r: 85, dur: 0.6 * k, mult: 1.2, tone: 'sun' }); }]);
        plan(e, steps, 2.6 * k);
      } else {
        for (let i = 0; i < 3; i++) steps.push([i * 0.6 * k, () => strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 160 + i * 130, inner: 60 + i * 130, dur: 0.85 * k, mult: 1.2, tone: 'volt' })]);
        plan(e, steps, 2.4 * k);
      }
    } });
  },

  // ================================================================ 80 ทศพักตร์มาร — the masks
  // Masks circle the god; only the glowing one can be struck — hitting any other mask reflects the blow. A mirror
  // copy repeats its last attack a beat later.
  god_masks(e, dt, world) {
    // v9.3.2: slower spin (was 0.85 / 1.3 rad/s); nine masks circle the god and every third one is a white face that
    // can be struck — three spots, 120° apart (scene: drawMasks / applyHit read n + whites from here)
    e.ai.faceA = (e.ai.faceA || 0) + dt * (e.ai.phase === 3 ? 0.7 : 0.45);
    e.facesGuard = { a: e.ai.faceA, arc: 1.1, n: 9, whites: 3 };
    if (e.clone) { e.facesGuard = null; return BEHAVIOURS.god_masks_mirror(e, dt, world); }
    const ph = phaseChange(e, world, { 2: 'เงาสะท้อนตื่นขึ้น', 3: 'พันหน้าหมุนเร็วขึ้น!' }, (n) => {
      if (n === 2) { const c = world.spawnEnemy(e.type.id, e.x + 220, e.y); if (c) { c.clone = true; c.noReward = true; c.maxHp = c.hp = Math.round(bar(e) * 0.06); c.atk = e.atk * 0.7; c.mirrorOf = e; } }
      else summon(world, e, e.type.ai_params.summon, 3);
    });
    const k = ph === 3 ? 0.8 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ['laugh', 'masks', 'swap', 'claws']);
      e.ai.lastAttack = a;
      const steps = [];
      if (a === 'laugh') {
        for (let i = 0; i < 3; i++) steps.push([i * 0.5 * k, () => strike(world, e, { shape: 'cone', x: e.x, y: e.y - 10, angle: toward(e, world.player) + (i - 1) * 0.6, r: 420, arc: 0.7, dur: 0.75 * k, mult: 1.3, tone: 'shadow' })]);
        plan(e, steps, 1.9 * k);
      } else if (a === 'masks') {
        steps.push([0.2, () => { for (let i = 0; i < 10; i++) world.shoot(e, { x: e.x, y: e.y - 50, angle: (i / 10) * TAU, speed: 200, r: 13, mult: 0.9, kind: 'orb', tone: 'shadow', life: 5, orbit: { cx: e.x, cy: e.y - 40, r0: 60, grow: 120, spin: -1.1 } }); }]);
        plan(e, steps, 1.5);
      } else if (a === 'swap') {
        steps.push([0, () => { const t = world.player; e.ai.sx = 2 * t.x - e.x; e.ai.sy = 2 * t.y - e.y; e.hidden = 1; e.untargetable = true; }]);
        steps.push([0.5, () => { const at = inArena(world, e.ai.sx, e.ai.sy); e.x = at.x; e.y = at.y; e.hidden = 0; e.untargetable = false; }]);
        steps.push(...swing(e, world, 0.55, 0.42 * k, 190, 2.4, 1.5, 'shadow', ph === 3));
        plan(e, steps, 0.55 + 0.42 * k + 0.4);
      } else {
        for (let i = 0; i < 3; i++) steps.push(...swing(e, world, i * 0.55 * k, 0.4 * k, 175, 1.8, 1.3, 'shadow'));
        plan(e, steps, 3 * 0.55 * k + 0.3);
      }
    } });
  },
  // the mirror copy: follows the god's attacks one beat late
  god_masks_mirror(e, dt, world) {
    if (e.state === 'act') { runPlan(e, dt, world); return; }
    stop(e, dt);
    const m = e.mirrorOf;
    if (m && !m.dead && m.state === 'act' && e.t > 0.8) {
      const steps = [];
      if (m.ai.lastAttack === 'laugh') for (let i = 0; i < 3; i++) steps.push([0.5 + i * 0.5, () => strike(world, e, { shape: 'cone', x: e.x, y: e.y - 10, angle: toward(e, world.player) + (1 - i) * 0.6, r: 380, arc: 0.7, dur: 0.75, mult: 1.0, tone: 'shadow' })]);
      else steps.push(...swing(e, world, 0.5, 0.45, 170, 1.8, 1.0, 'shadow'));
      plan(e, steps, 2.2, 1.2);
    }
  },

  // ================================================================ 90 อสุรเหม — frozen hell
  // An ice shell must be shattered before its body can be hurt (and shattering it stuns the god). The blizzard
  // freezes anyone who stands still. Ice lances pierce.
  god_frost(e, dt, world) {
    if (!e.ai.started) { e.ai.started = true; e.shell = Math.round(bar(e) * 0.08); e.shellMax = e.shell; }
    const ph = phaseChange(e, world, { 2: 'น้ำแข็งงอกใหม่', 3: 'ขุมน้ำแข็งเปิดออก' }, (n) => { e.shell = Math.round(bar(e) * 0.1); e.shellMax = e.shell; summon(world, e, e.type.ai_params.summon, n === 3 ? 3 : 2); });
    if (e.ai.shellWasUp && !(e.shell > 0)) { e.ai.shellWasUp = false; e.brokenT = 3; world.announce('รังน้ำแข็งแตก!'); world.sfx('guardBreak'); e.ai.reshell = 22; }
    if (e.shell > 0) e.ai.shellWasUp = true;
    if (e.ai.reshell > 0) { e.ai.reshell -= dt; if (e.ai.reshell <= 0) { e.shell = Math.round(bar(e) * 0.06); e.shellMax = e.shell; world.fx.callout(e.x, e.y - 170, 'รังน้ำแข็งงอกใหม่', '#cfeaff'); } }
    // blizzard: standing still freezes
    if (e.ai.blizzT > 0) {
      e.ai.blizzT -= dt;
      const p = world.player;
      if (p && !p.dead) {
        e.ai.still = Math.hypot(p.vx || 0, p.vy || 0) < 40 ? (e.ai.still || 0) + dt : 0;
        if (e.ai.still > 1.4) { e.ai.still = 0; world.chill?.(1.2, true); world.hitPlayer(e, 0.6, 0, 0, false, { unblockable: true }); world.fx.callout(p.x, p.y - 120, 'แข็งทื่อ!', '#cfeaff'); }
      }
      if ((e.ai.gustT = (e.ai.gustT || 0) - dt) <= 0) { e.ai.gustT = 1.6; world.gust(rnd(world) * TAU, 1.2, 220); }
    }
    const k = ph === 3 ? 0.8 : ph === 2 ? 0.9 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const a = choose(e, world, ['lances', 'blizzard', 'spikes', 'claws', 'field']);
      const steps = [], A = world.arena;
      if (a === 'lances') {
        for (let i = 0; i < 5; i++) steps.push([i * 0.3 * k, () => { const t = world.player; const side = i % 4; const from = side === 0 ? { x: 50, y: t.y } : side === 1 ? { x: A.w - 50, y: t.y } : side === 2 ? { x: t.x, y: 60 } : { x: t.x, y: A.h - 30 }; strike(world, e, { shape: 'line', x: from.x, y: from.y, angle: Math.atan2(t.y - from.y, t.x - from.x), len: 1400, width: 40, dur: 0.8 * k, mult: 1.3, tone: 'pierce', pierce: true }); }]);
        plan(e, steps, 5 * 0.3 * k + 0.9);
      } else if (a === 'blizzard') {
        steps.push([0, () => { e.ai.blizzT = 7; world.announce('พายุหิมะ: อย่ายืนนิ่ง!'); world.darkPulse(2); }]);
        plan(e, steps, 1.0);
      } else if (a === 'spikes') {
        for (let i = 0; i < 4; i++) steps.push([i * 0.4 * k, () => strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 130 + i * 120, inner: 50 + i * 120, dur: 0.75 * k, mult: 1.3, tone: 'ice' })]);
        plan(e, steps, 2.4 * k);
      } else if (a === 'claws') {
        for (let i = 0; i < 2; i++) steps.push(...swing(e, world, i * 0.7 * k, 0.5 * k, 190, 2.2, 1.6, 'ice'));
        plan(e, steps, 1.7 * k);
      } else {
        steps.push([0, () => { for (let i = 0; i < 5; i++) { const at = inArena(world, 120 + rnd(world) * (A.w - 240), 160 + rnd(world) * (A.h - 260)); world.pool({ x: at.x, y: at.y, r: 130, dur: 10, kind: 'ice', mult: 0, owner: e }); } }]);
        plan(e, steps, 0.8);
      }
    } });
  },

  // ================================================================ 100 มหากาฬ — the king
  // Phase 1 borrows the first gods (oar, piercing lash, fire nova, blink). Phase 2 the middle ones (verdict,
  // clock hands, masks). Phase 3: the throne calls three shades of the gods; destroying them all shakes him (poise break).
  god_king(e, dt, world) {
    world.sinOn = true;
    const shades = (e.ai.shades || []).filter((s) => !s.dead);
    if (e.ai.shades && !shades.length) { e.ai.shades = null; e.brokenT = 3.5; world.announce('เงาเทพสลาย! มหากาฬเปิดช่องโหว่'); world.sfx('guardBreak'); e.ai.throneT = 24; }
    const ph = phaseChange(e, world, { 2: 'มหากาฬยืมพลังเทพทั้งเก้า', 3: 'บัลลังก์ขุมนรกตื่นขึ้น!' }, (n) => { if (n === 3) throne(e, world); });
    if (ph === 3 && !e.ai.shades && e.ai.throneT > 0) { e.ai.throneT -= dt; if (e.ai.throneT <= 0) throne(e, world); }
    const k = ph === 3 ? 0.74 : ph === 2 ? 0.86 : 1;
    godLoop(e, dt, world, { speed: 1 / k, pick: () => {
      const pool = ph === 1 ? ['oar', 'lash', 'nova', 'blink'] : ph === 2 ? ['verdict', 'hands', 'masks', 'lash', 'oar'] : ['lances', 'verdict', 'nova', 'hands', 'blink'];
      const a = choose(e, world, pool);
      const steps = [], p = world.player, A = world.arena;
      if (a === 'oar') { for (let i = 0; i < 3; i++) steps.push(...swing(e, world, i * 0.65 * k, 0.45 * k, 200, 2.4, 1.5, 'bone')); plan(e, steps, 3 * 0.65 * k + 0.3); }
      else if (a === 'lash') { for (let i = 0; i < 3; i++) steps.push([i * 0.4 * k, () => strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: toward(e, world.player) + (i - 1) * 0.3, len: 900, width: 48, dur: 0.75 * k, mult: 1.4, tone: 'pierce', pierce: true })]); plan(e, steps, 2.0 * k); }
      else if (a === 'nova') { for (let i = 0; i < 4; i++) steps.push([0.5 + i * 0.4 * k, () => strike(world, e, { shape: 'ring', x: e.x, y: e.y, r: 120 + i * 110, inner: 40 + i * 110, dur: 0.85 * k, mult: 1.5, fire: true, tone: 'fire' })]); plan(e, steps, 0.5 + 4 * 0.4 * k + 0.9); }
      else if (a === 'blink') { blinkSlash(e, world, 0.42 * k, 1.8, 2); return; }
      else if (a === 'verdict') { steps.push([0, () => { const sin = world.sin || 0; world.fx.callout(e.x, e.y - 180, `บาป ${sin}`, '#e0b45a'); strike(world, e, { shape: 'circle', x: p.x, y: p.y, r: 140, dur: 1.0 * k, mult: 0.7 + 0.35 * sin, tone: 'pierce', pierce: true }); world.sin = 0; }]); plan(e, steps, 1.4 * k); }
      else if (a === 'hands') { const base = rnd(world) * TAU; for (let i = 0; i < 10; i++) steps.push([i * 0.12 * k, () => { const ang = base + i * 0.3; strike(world, e, { shape: 'line', x: e.x, y: e.y - 10, angle: ang, len: 900, width: 46, dur: 0.65 * k, mult: 1.3, tone: 'sun' }); }]); plan(e, steps, 10 * 0.12 * k + 0.9); }
      else if (a === 'masks') { steps.push([0.2, () => { for (let i = 0; i < 12; i++) world.shoot(e, { x: e.x, y: e.y - 50, angle: (i / 12) * TAU, speed: 210, r: 12, mult: 1.0, kind: 'orb', tone: 'shadow', life: 5, orbit: { cx: e.x, cy: e.y - 40, r0: 60, grow: 130, spin: 1.0 } }); }]); plan(e, steps, 1.4); }
      else { for (let i = 0; i < 6; i++) steps.push([i * 0.25 * k, () => { const t = world.player; const side = i % 4; const from = side === 0 ? { x: 50, y: t.y } : side === 1 ? { x: A.w - 50, y: t.y } : side === 2 ? { x: t.x, y: 60 } : { x: t.x, y: A.h - 30 }; strike(world, e, { shape: 'line', x: from.x, y: from.y, angle: Math.atan2(t.y - from.y, t.x - from.x), len: 1400, width: 42, dur: 0.75 * k, mult: 1.4, tone: 'pierce', pierce: true }); }]); plan(e, steps, 6 * 0.25 * k + 0.9); }
    } });
  },
});

// blink behind the target and slash (parryable); n slashes in a row
function blinkSlash(e, world, tel, mult, n = 1) {
  const steps = [];
  for (let i = 0; i < n; i++) {
    const t0 = i * (tel + 0.6);
    steps.push([t0, () => { e.hidden = 1; e.untargetable = true; world.particles.burst(e.x, e.y - 40, 16, { color: ['#14121c', '#7a6aa8'], speedMin: 60, speedMax: 200, life: 0.4, size: 4, drag: 3 }); }]);
    steps.push([t0 + 0.35, () => {
      const p = world.player; const a = (p.flip ? 0 : Math.PI) + (world.rng.next() - 0.5) * 0.8;
      const at = inArena(world, p.x + Math.cos(a) * 130, p.y + Math.sin(a) * 60); e.x = at.x; e.y = at.y; e.hidden = 0; e.untargetable = false;
    }]);
    steps.push(...swing(e, world, t0 + 0.36, tel, 170, 2.0, mult, 'shadow'));
  }
  plan(e, steps, n * (tel + 0.6) + 0.3, 1.0);
}

// the king's last stand: three shades of the gods guard the throne (v8.6: they no longer make him immune)
function throne(e, world) {
  world.announce('ทำลายเงาเทพทั้งสามเพื่อให้มหากาฬเสียหลัก!');
  const A = world.arena;
  e.ai.shades = [[0.18, 0.35], [0.82, 0.35], [0.5, 0.82]].map(([fx, fy]) => world.spawnEnemy(e.type.ai_params.summon, A.w * fx, A.h * fy)).filter(Boolean);
  for (const s of e.ai.shades) { s.maxHp = s.hp = Math.round(bar(e) * 0.03); s.noReward = true; s.keyMinion = true; s.noRevive = true; }
}
