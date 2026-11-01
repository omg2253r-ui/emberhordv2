// The three special-dungeon bosses. Hard, readable, fair: every attack is telegraphed, melee claws and holy
// slashes can be PARRIED (they go through world.hitPlayer with the boss as attacker — a parry staggers the boss and
// opens a counter), while ground blasts must be dodged. Each boss speeds up as it loses health.
// World API: see src/battle/zoneBehaviours.js.
import { BEHAVIOURS } from './enemies.js';
import { TILE } from './zoneMechanics.js';

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
function steer(e, angle, speed, dt, k = 6) { const f = Math.min(1, dt * k); e.vx += (Math.cos(angle) * speed - e.vx) * f; e.vy += (Math.sin(angle) * speed - e.vy) * f; }
const stop = (e, dt, k = 8) => steer(e, 0, 0, dt, k);
function setState(e, s) { e.state = s; e.t = 0; e.ai.step = 0; e.hitThisAttack = false; }
const warn = (e, k) => { e.warn = Math.max(0, Math.min(1, k)); };
function inArena(world, x, y, pad = 100) { const A = world.arena; return { x: Math.max(pad, Math.min(A.w - pad, x)), y: Math.max(pad + 40, Math.min(A.h - pad, y)) }; }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

// Parryable melee: everyone inside the arc in front of the boss is struck (each player can parry it on their side).
function meleeArc(e, world, dir, range, arc, mult, kb = 380, fire = false) {
  const prev = world.player;
  for (const t of world.players) {
    if (!t || t.dead) continue;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d > range + (t.r || 20) || Math.abs(angDiff(Math.atan2(t.y - e.y, t.x - e.x), dir)) > arc / 2) continue;
    world.player = t;
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    world.hitPlayer(e, mult, Math.cos(a) * kb, Math.sin(a) * kb, fire);
  }
  world.player = prev;
}
// telegraph for a melee arc (shows the shape, deals nothing itself)
const arcTell = (world, e, dir, range, arc, dur, tone) => world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: dir, r: range, arc, dur, mult: 0, owner: e, tone });

function phaseOf(e, cuts = [0.66, 0.33]) { const f = e.hp / e.maxHp; return f > cuts[0] ? 1 : f > cuts[1] ? 2 : 3; }
function phaseChange(e, world, lines, onEnter) {
  const ph = phaseOf(e);
  if (ph !== e.ai.phase) {
    if (e.ai.phase) { world.announce(lines[ph] || ''); world.sfx('roar'); world.shake(14, 0.7); onEnter?.(ph); }
    e.ai.phase = ph;
  }
  return ph;
}

Object.assign(BEHAVIOURS, {
  // ------------------------------------------------------------------ อัคนิวาร มังกรพิโรธ
  // Phase 1: claw combo (parry!), fire breath sweep, tail ring, dive.  Phase 2 "พิโรธ": + fire rain, lava cracks.
  // Phase 3 "หัวใจลุกเป็นไฟ": + heart pulses (expanding rings with a gap), two magma hounds, everything faster.
  wrath_dragon(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const ph = phaseChange(e, world, { 2: 'อัคนิวารพิโรธ! ลาวาเริ่มแยกผืนดิน', 3: 'หัวใจมังกรลุกเป็นไฟ!' }, (n) => {
      if (n === 3) for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 220 : -220), e.y + 60);
    });
    const k = ph === 3 ? 0.72 : ph === 2 ? 0.86 : 1;
    if (ph === 3) e.enraged = true;
    if (e.state === 'idle') { setState(e, 'stalk'); e.ai.next = 0; }
    if (e.state === 'stalk') {
      steer(e, toward(e, p), e.type.speed * (ph === 3 ? 1.25 : 1), dt, 3);
      if (e.t >= 0.9 * k) {
        const close = dist(e, p) < P.clawRange + 60;
        const pool = ph === 1 ? ['claws', 'breath', 'tail', 'dive'] : ph === 2 ? ['claws', 'breath', 'rain', 'cracks', 'dive', 'tail'] : ['claws', 'pulse', 'rain', 'cracks', 'breath', 'dive'];
        let pick = pool[e.ai.next % pool.length]; e.ai.next += 1;
        if (close && e.ai.next % 2 === 0) pick = 'claws';
        setState(e, pick);
      }
    } else if (e.state === 'claws') {
      // two (three when enraged) telegraphed swipes; each one is parryable
      const swipes = ph === 3 ? 3 : 2, tel = P.clawTelegraph * k;
      if (e.ai.step === 0) { e.ai.dir = toward(e, p); arcTell(world, e, e.ai.dir, P.clawRange, P.clawArc, tel, 'fire'); world.sfx('telegraph'); e.ai.step = 1; }
      stop(e, dt, 9); warn(e, e.t / tel);
      if (e.t >= tel) {
        meleeArc(e, world, e.ai.dir, P.clawRange, P.clawArc, 1.5, 360, true);
        world.sfx('swing'); e.warn = 0; e.ai.done = (e.ai.done || 0) + 1;
        steer(e, e.ai.dir, 420, 1, 1);
        if (e.ai.done >= swipes) { e.ai.done = 0; setState(e, 'rest'); }
        else { e.t = 0; e.ai.dir = toward(e, p); arcTell(world, e, e.ai.dir, P.clawRange, P.clawArc, tel * 0.85, 'fire'); }
      }
    } else if (e.state === 'breath') {
      stop(e, dt, 8);
      if (e.ai.step === 0) { e.ai.base = toward(e, p) - 0.9; e.ai.sign = world.rng.next() < 0.5 ? 1 : -1; if (e.ai.sign < 0) e.ai.base += 1.8; e.ai.step = 1; e.ai.n = 0; world.sfx('roar'); }
      const every = 0.12 * k;
      while (e.ai.n < P.breathSteps && e.t >= e.ai.n * every) {
        const a = e.ai.base + e.ai.sign * (1.8 * e.ai.n) / (P.breathSteps - 1);
        world.strike({ shape: 'cone', x: e.x, y: e.y - 40, angle: a, r: P.breathRange, arc: P.breathArc, dur: P.breathTelegraph * k, mult: 1.1, owner: e, fire: true, tone: 'fire', then: e.ai.n % 3 === 0 ? { pool: { kind: 'fire', r: 60, dur: 2.5, mult: 0.3 } } : undefined });
        e.ai.n += 1;
      }
      warn(e, e.t / (P.breathTelegraph * k));
      if (e.t >= P.breathTelegraph * k + P.breathSteps * every) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'tail') {
      stop(e, dt, 9);
      if (e.ai.step === 0) { world.strike({ shape: 'ring', x: e.x, y: e.y, r: 260, inner: 70, dur: 0.85 * k, mult: 1.3, owner: e, tone: 'fire', kb: 420 }); world.sfx('telegraph'); e.ai.step = 1; }
      warn(e, e.t / (0.85 * k));
      if (e.t >= 0.85 * k + 0.3) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'dive') {
      if (e.ai.step === 0) { e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: P.diveSpeed * P.diveTime, width: e.r * 2.2, dur: P.diveTelegraph * k, mult: 1.6, owner: e, fire: true, tone: 'fire' }); world.sfx('telegraph'); e.ai.step = 1; }
      if (e.ai.step === 1) { stop(e, dt, 10); warn(e, e.t / (P.diveTelegraph * k)); if (e.t >= P.diveTelegraph * k) { e.ai.step = 2; e.t = 0; e.warn = 0; world.sfx('roar'); } }
      else if (e.ai.step === 2) {
        e.vx = Math.cos(e.ai.dir) * P.diveSpeed; e.vy = Math.sin(e.ai.dir) * P.diveSpeed;
        if (world.rng.next() < dt * 24) world.pool({ x: e.x, y: e.y, r: 46, dur: 3, kind: 'fire', mult: 0.35 });
        if (e.t >= P.diveTime) { e.vx *= 0.1; e.vy *= 0.1; setState(e, ph >= 2 ? 'tail' : 'rest'); }
      }
    } else if (e.state === 'rain') {
      stop(e, dt, 6);
      if (e.ai.step === 0) {
        const n = P.rainCount + (ph === 3 ? 6 : 0);
        for (let i = 0; i < n; i++) {
          const t = i < world.players.length ? world.players[i] : null;
          const at = t ? { x: t.x, y: t.y } : inArena(world, 120 + world.rng.next() * (world.arena.w - 240), 180 + world.rng.next() * (world.arena.h - 300));
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.rainRadius, dur: P.rainTelegraph * k + i * 0.08, mult: 1.2, owner: e, fire: true, tone: 'fire', meteor: true, then: { pool: { kind: 'fire', r: P.rainRadius * 0.6, dur: 2.5, mult: 0.3 } } });
        }
        world.sfx('roar'); e.ai.step = 1;
      }
      if (e.t >= P.rainTelegraph * k + 1.4) setState(e, 'rest');
    } else if (e.state === 'cracks') {
      stop(e, dt, 8);
      // the ground splits along lines across the arena, one after another — read the order, step between them
      if (e.ai.step === 0) {
        const A = world.arena, vertical = world.rng.next() < 0.5;
        for (let i = 0; i < P.crackCount; i++) {
          const f = (i + 0.5 + (world.rng.next() - 0.5) * 0.4) / P.crackCount;
          const s = vertical ? { x: 60 + f * (A.w - 120), y: 80, angle: Math.PI / 2, len: A.h - 140 } : { x: 60, y: 120 + f * (A.h - 200), angle: 0, len: A.w - 120 };
          world.strike({ shape: 'line', ...s, width: P.crackWidth, dur: (0.9 + i * 0.45) * k, mult: 1.3, owner: e, fire: true, tone: 'fire', then: { pool: { kind: 'fire', r: 40, dur: 1.5, mult: 0.25 } } });
        }
        world.sfx('telegraph'); e.ai.step = 1;
      }
      if (e.t >= (0.9 + P.crackCount * 0.45) * k + 0.3) setState(e, 'rest');
    } else if (e.state === 'pulse') {
      stop(e, dt, 10);
      // three expanding rings from the heart: stand in the gap between them
      if (e.ai.step === 0) { [0, 1, 2].forEach((i) => world.strike({ shape: 'ring', x: e.x, y: e.y, r: 150 + i * 150, inner: 60 + i * 150, dur: 0.8 + i * 0.55, mult: 1.25, owner: e, fire: true, tone: 'fire' })); world.sfx('roar'); world.announce('หัวใจเต้น!'); e.ai.step = 1; }
      warn(e, e.t / 0.8);
      if (e.t >= 2.2) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'stalk');
    }
  },

  // ------------------------------------------------------------------ นิมิตรา มังกรแห่งคำพยากรณ์
  // She aims where you WILL be (position + velocity), sweeps rotating star beams, spirals of star orbs with gaps,
  // and repeats her last pattern as an echo. Phase 2: clones (cloud rays) and four-arm beams. Phase 3: "the
  // unavoidable future" — the whole arena but a circle next to her is struck, forcing a close fight with her claws.
  prophecy_dragon(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const ph = phaseChange(e, world, { 2: 'นิมิตราเห็นอนาคตของคุณแล้ว', 3: 'อนาคตที่หลีกเลี่ยงไม่ได้!' }, (n) => {
      if (n === 2) for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 240 : -240), e.y);
    });
    const k = ph === 3 ? 0.74 : ph === 2 ? 0.87 : 1;
    if (ph === 3) e.enraged = true;
    e.ai.z = 28 + Math.sin(world.time * 2.2) * 8;
    const future = (t, lead) => ({ x: t.x + (t.vx || 0) * lead, y: t.y + (t.vy || 0) * lead });
    if (e.state === 'idle') { setState(e, 'glide'); e.ai.next = 0; }
    if (e.state === 'glide') {
      const at = inArena(world, p.x + Math.cos(world.time * 0.8) * 260, p.y - 150, 140);
      steer(e, Math.atan2(at.y - e.y, at.x - e.x), e.type.speed, dt, 2.2);
      if (e.t >= 1.0 * k) {
        const pool = ph === 1 ? ['stars', 'beams', 'orbs', 'claws'] : ph === 2 ? ['stars', 'beams', 'echo', 'orbs', 'claws'] : ['future', 'claws', 'stars', 'beams', 'claws', 'echo'];
        let pick = pool[e.ai.next % pool.length]; e.ai.next += 1;
        if (pick === 'echo' && !e.ai.last) pick = 'stars';
        if (pick !== 'echo' && pick !== 'claws') e.ai.last = pick;
        setState(e, pick === 'echo' ? e.ai.last : pick);
        if (pick === 'echo') { e.ai.echo = true; world.announce('เสียงสะท้อนจากอนาคต'); } else e.ai.echo = false;
      }
    } else if (e.state === 'stars') {
      stop(e, dt, 6);
      if (e.ai.step === 0) {
        const lead = P.lead * (ph === 1 ? 1 : 1.3);
        let i = 0;
        for (const t of world.players) for (let j = 0; j < 2; j++) {
          const at = inArena(world, future(t, lead * (j + 1) * 0.6).x, future(t, lead * (j + 1) * 0.6).y, 60);
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.starRadius, dur: P.starTelegraph * k + i * 0.1, mult: 1.2, owner: e, tone: 'ice', meteor: true }); i++;
        }
        for (let n = i; n < P.starCount; n++) { const at = inArena(world, 120 + world.rng.next() * (world.arena.w - 240), 180 + world.rng.next() * (world.arena.h - 300)); world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.starRadius, dur: P.starTelegraph * k + n * 0.1, mult: 1.1, owner: e, tone: 'ice', meteor: true }); }
        world.sfx('cast'); e.ai.step = 1;
      }
      if (e.t >= P.starTelegraph * k + 1.2) setState(e, 'rest');
    } else if (e.state === 'beams') {
      stop(e, dt, 8);
      const arms = ph === 1 ? P.beamCount : P.beamCount + 1, pulses = 4;
      const gap = 0.5 * k;
      while (e.ai.step < pulses && e.t >= e.ai.step * gap) {
        const off = (e.ai.base ?? (e.ai.base = toward(e, p))) + e.ai.step * P.beamSpin * (e.ai.echo ? -1 : 1);
        for (let i = 0; i < arms; i++) world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: off + (i * TAU) / arms, len: P.beamLen, width: P.beamWidth, dur: P.beamTelegraph * k, mult: 1.2, owner: e, tone: 'ice' });
        e.ai.step += 1; world.sfx('telegraph');
      }
      warn(e, Math.min(1, e.t / (P.beamTelegraph * k)));
      if (e.t >= pulses * gap + P.beamTelegraph * k + 0.2) { e.warn = 0; e.ai.base = undefined; setState(e, 'rest'); }
    } else if (e.state === 'orbs') {
      stop(e, dt, 8); warn(e, e.t / (0.6 * k));
      if (e.t >= 0.6 * k && e.ai.step < 3) {
        const n = P.orbCount, off = e.ai.step * 0.22 + world.time * 0.3;
        for (let i = 0; i < n; i++) { if ((i + e.ai.step * 2) % 7 === 0) continue; world.shoot(e, { x: e.x, y: e.y - 50, angle: off + (i / n) * TAU, speed: P.orbSpeed, r: 10, mult: 0.75, kind: 'orb', life: 5 }); }
        world.sfx('cast'); e.ai.step += 1; e.t = 0.6 * k - 0.42 * k; e.warn = 0;
      }
      if (e.ai.step >= 3 && e.t >= 0.6 * k) setState(e, 'rest');
    } else if (e.state === 'claws') {
      const tel = P.clawTelegraph * k;
      if (e.ai.step === 0) { steer(e, toward(e, p), 600, 1, 1); e.ai.dir = toward(e, p); arcTell(world, e, e.ai.dir, P.clawRange, P.clawArc, tel, 'ice'); world.sfx('telegraph'); e.ai.step = 1; }
      stop(e, dt, 6); warn(e, e.t / tel);
      if (e.t >= tel) {
        meleeArc(e, world, e.ai.dir, P.clawRange, P.clawArc, 1.45, 340);
        world.sfx('swing'); e.warn = 0; e.ai.done = (e.ai.done || 0) + 1;
        if (e.ai.done >= (ph === 3 ? 3 : 2)) { e.ai.done = 0; setState(e, 'rest'); }
        else { e.t = 0; e.ai.dir = toward(e, p); arcTell(world, e, e.ai.dir, P.clawRange, P.clawArc, tel * 0.85, 'ice'); }
      }
    } else if (e.state === 'future') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const A = world.arena;
        // everything outside a safe circle beside the dragon is struck
        const safe = inArena(world, e.x + Math.cos(world.time) * 120, e.y + 110, 140);
        world.strike({ shape: 'ring', x: safe.x, y: safe.y, r: Math.hypot(A.w, A.h), inner: 150, dur: 2.2, mult: 1.7, owner: e, tone: 'ice' });
        world.announce('เข้าวงแสงใกล้นิมิตรา!'); world.sfx('roar'); e.ai.step = 1;
      }
      warn(e, e.t / 2.2);
      if (e.t >= 2.5) { e.warn = 0; setState(e, 'claws'); }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'glide');
    }
  },

  // ------------------------------------------------------------------ เทพแห่งคำพิพากษา
  // Holy slash chains (parry them!), the verdict grid (half the floor is judged, then the other half), light
  // pillars on everyone, a rain of swords with gaps. Phase 2 summons feather monks; phase 3 "คำพิพากษาสุดท้าย"
  // closes the arena with rings while the slash chains grow to five.
  judgment_god(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const ph = phaseChange(e, world, { 2: 'เทพเรียกผู้รับใช้มาเป็นพยาน', 3: 'คำพิพากษาสุดท้าย!' }, (n) => {
      if (n === 2) for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 200 : -200), e.y + 40);
    });
    const k = ph === 3 ? 0.74 : ph === 2 ? 0.86 : 1;
    if (ph === 3) e.enraged = true;
    e.ai.z = 34 + Math.sin(world.time * 1.6) * 6;
    if (e.state === 'idle') { setState(e, 'drift'); e.ai.next = 0; }
    if (e.state === 'drift') {
      steer(e, toward(e, p), e.type.speed, dt, 2.5);
      if (e.t >= 0.95 * k) {
        const pool = ph === 1 ? ['slashes', 'grid', 'pillars', 'slashes', 'swords'] : ph === 2 ? ['slashes', 'grid', 'swords', 'pillars', 'slashes'] : ['final', 'slashes', 'grid', 'slashes', 'swords', 'pillars'];
        setState(e, pool[e.ai.next % pool.length]); e.ai.next += 1;
      }
    } else if (e.state === 'slashes') {
      // a chain of telegraphed sword slashes: dodge them, or parry each for a stagger and a counter
      const n = ph === 3 ? 5 : ph === 2 ? 4 : P.slashes, tel = (e.ai.done ? P.slashGap : P.slashTelegraph) * k;
      if (e.ai.step === 0) { steer(e, toward(e, p), 700, 1, 1); e.ai.dir = toward(e, p); arcTell(world, e, e.ai.dir, P.slashRange, P.slashArc, tel, 'holy'); world.sfx('telegraph'); e.ai.step = 1; }
      stop(e, dt, 7); warn(e, e.t / tel);
      if (e.t >= tel) {
        meleeArc(e, world, e.ai.dir, P.slashRange, P.slashArc, 1.4, 340);
        world.sfx('swing'); world.shake(4, 0.12); e.warn = 0; e.ai.done = (e.ai.done || 0) + 1;
        if (e.ai.done >= n) { e.ai.done = 0; setState(e, 'rest'); }
        else { e.t = 0; e.ai.dir = toward(e, p) + (e.ai.done % 2 ? 0.5 : -0.5); arcTell(world, e, e.ai.dir, P.slashRange, P.slashArc, P.slashGap * k, 'holy'); }
      }
    } else if (e.state === 'grid') {
      stop(e, dt, 8);
      if (e.ai.step === 0) {
        const { cols, rows, x0, y0, w: cw, h: rh } = TILE;
        const first = world.rng.next() < 0.5 ? 0 : 1;
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
          const odd = (c + r) % 2 === first;
          world.strike({ shape: 'rect', x: x0 + c * cw, y: y0 + r * rh, w: cw, h: rh, dur: (odd ? P.gridTelegraph : P.gridTelegraph + 1.1) * k, mult: 1.3, kb: 0, owner: e, tone: 'holy' });
        }
        world.sfx('telegraph'); world.announce('คำตัดสินลงบนพื้น'); e.ai.step = 1;
      }
      if (e.t >= (P.gridTelegraph + 1.4) * k) setState(e, 'rest');
    } else if (e.state === 'pillars') {
      stop(e, dt, 6);
      if (e.ai.step === 0) {
        let i = 0;
        for (const t of world.players) { world.strike({ shape: 'circle', x: t.x, y: t.y, r: P.pillarRadius, dur: 1.0 * k, mult: 1.35, owner: e, tone: 'holy' }); i++; }
        for (; i < P.pillarCount; i++) { const at = inArena(world, 120 + world.rng.next() * (world.arena.w - 240), 180 + world.rng.next() * (world.arena.h - 300)); world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.pillarRadius, dur: (1.0 + i * 0.12) * k, mult: 1.3, owner: e, tone: 'holy' }); }
        world.sfx('cast'); e.ai.step = 1;
      }
      // a second wave on where everyone moved to
      if (e.ai.step === 1 && e.t >= 1.2 * k) { for (const t of world.players) world.strike({ shape: 'circle', x: t.x, y: t.y, r: P.pillarRadius, dur: 0.85 * k, mult: 1.35, owner: e, tone: 'holy' }); e.ai.step = 2; }
      if (e.t >= 2.4 * k) setState(e, 'rest');
    } else if (e.state === 'swords') {
      stop(e, dt, 8);
      if (e.ai.step === 0) {
        const A = world.arena, n = P.swordRain + (ph - 1) * 4;
        const lane = (world.rng.next() * 5) | 0;
        for (let i = 0; i < n; i++) {
          const col = i % 6; if (col === lane) continue;
          const x = 140 + col * ((A.w - 280) / 5) + (world.rng.next() - 0.5) * 60, y = 180 + world.rng.next() * (A.h - 300);
          world.strike({ shape: 'line', x, y: y - 90, angle: Math.PI / 2, len: 180, width: 34, dur: (P.swordTelegraph + (i % 4) * 0.15) * k, mult: 1.2, owner: e, tone: 'holy' });
        }
        world.sfx('telegraph'); e.ai.step = 1;
      }
      if (e.t >= (P.swordTelegraph + 0.9) * k) setState(e, 'rest');
    } else if (e.state === 'final') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const A = world.arena, cx = A.w / 2, cy = A.h / 2;
        [560, 420, 290].forEach((r, i) => world.strike({ shape: 'ring', x: cx, y: cy, r: r + 700, inner: r, dur: 1.3 + i * 0.75, mult: 1.4, owner: e, tone: 'holy' }));
        world.announce('ลานพิพากษาบีบเข้ามา! เข้ากลางลาน'); world.sfx('roar'); e.ai.step = 1;
      }
      if (e.t >= 3.6) setState(e, 'slashes');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'drift');
    }
  },
});

// v9 Egypt: three gods. Each attack list is new to the game (half-arena scales, trailing footprints, crossing lanes...).
function egyptGod(attacks, pools, lines) {
  return function (e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const ph = phaseChange(e, world, lines);
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    if (ph === 3) e.enraged = true;
    if (e.state === 'idle') { setState(e, 'drift'); e.ai.next = 0; }
    if (e.state === 'drift') {
      steer(e, toward(e, p), e.type.speed, dt, 2.5);
      if (e.t >= 0.9 * k) { const pool = pools[ph - 1]; e.ai.cur = pool[e.ai.next++ % pool.length]; setState(e, 'atk'); }
    } else if (e.state === 'atk') {
      const A = attacks[e.ai.cur];
      stop(e, dt, 8);
      if (e.ai.step === 0) { e.ai.dur = A.go(e, world, k, ph); e.ai.step = 1; world.sfx('telegraph'); }
      if (A.tick) A.tick(e, dt, world, k);
      if (e.t >= e.ai.dur) setState(e, 'rest');
    } else if (e.state === 'rest') { stop(e, dt, 5); if (e.t >= P.rest * k) setState(e, 'drift'); }
  };
}
const rngPick = (world, n) => (world.rng.next() * n) | 0;
const ANUBIS = {
  scales: { go(e, world, k, ph) {   // one half of the hall is judged: the red half blasts, so stand on the other
    const A = world.arena, side = rngPick(world, 2);
    world.announce('ตาชั่งเอียง! ฝั่งสีแดงจะระเบิด ย้ายไปอีกฝั่ง');
    world.strike({ shape: 'line', x: A.w * (side ? 0.75 : 0.25), y: 0, angle: Math.PI / 2, len: A.h, width: A.w / 2, dur: 1.8 * k, mult: 1.4, owner: e, tone: 'holy' });
    return 2.6 * k; } },
  jackal: { go(e, world, k, ph) {   // a volley of lunging lanes aimed where everyone stands, one after another
    const n = 2 + ph;
    for (let i = 0; i < n; i++) for (const t of world.players) { const a = Math.atan2(t.y - e.y, t.x - e.x); world.strike({ shape: 'line', x: e.x, y: e.y, angle: a, len: 1000, width: 64, dur: (0.85 + i * 0.5) * k, mult: 1.35, owner: e, tone: 'holy' }); }
    return (0.85 + n * 0.5 + 0.5) * k; } },
  spears: { go(e, world, k, ph) {   // a spiral of spears that opens outward from the god
    const n = 12 + ph * 4;
    for (let i = 0; i < n; i++) { const a = i * 2.4, d = 90 + i * 34, at = inArena(world, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 60); world.strike({ shape: 'circle', x: at.x, y: at.y, r: 56, dur: (0.7 + i * 0.1) * k, mult: 1.3, owner: e, tone: 'holy' }); }
    return (0.7 + n * 0.1 + 0.5) * k; } },
};
const SEKHMET = {
  claws: { go(e, world, k, ph) {   // three fans of war-claws, each one turned a little further
    const a = toward(e, world.player);
    for (let i = -1; i <= 1; i++) world.strike({ shape: 'cone', x: e.x, y: e.y, angle: a + i * 0.9, r: 380, arc: 0.8, dur: (0.7 + (i + 1) * 0.4) * k, mult: 1.4, owner: e, tone: 'fire' });
    return 2.2 * k; } },
  prints: { go(e, world, k) { e.ai.fp = 0; return 3.8 * k; },   // wherever you stand a moment, fire follows
    tick(e, dt, world, k) { e.ai.fp = (e.ai.fp || 0) - dt; if (e.ai.fp > 0 || e.t > 3.2 * k) return; e.ai.fp = 0.32;
      for (const t of world.players) if (!t.dead) world.strike({ shape: 'circle', x: t.x, y: t.y, r: 72, dur: 1.0, mult: 1.25, owner: e, tone: 'fire' }); } },
  plague: { go(e, world, k, ph) {   // rings spread outward from her: stand in the gap between two waves
    const n = 3 + (ph > 1 ? 1 : 0);
    for (let i = 0; i < n; i++) world.strike({ shape: 'ring', x: e.x, y: e.y, r: 200 + i * 150, inner: 130 + i * 150, dur: (0.9 + i * 0.6) * k, mult: 1.35, owner: e, tone: 'fire' });
    world.announce('ลมหายใจเพลิงแผ่ออกเป็นวง'); return (0.9 + n * 0.6 + 0.6) * k; } },
};
const RA = {
  beams: { go(e, world, k, ph) {   // crossing sunbeams that turn step by step around him
    const base = toward(e, world.player);
    for (let s = 0; s < 4; s++) for (let j = 0; j < 4; j += (ph > 1 ? 1 : 2)) world.strike({ shape: 'line', x: e.x, y: e.y, angle: base + s * 0.4 + j * Math.PI / 2, len: 1200, width: 50, dur: (0.8 + s * 0.45) * k, mult: 1.35, owner: e, tone: 'holy' });
    return (0.8 + 4 * 0.45 + 0.6) * k; } },
  barque: { go(e, world, k) {   // the sun-barque sweeps the hall in rows: stand in the one open lane
    const A = world.arena, row = rngPick(world, 5);
    world.announce('เรือสุริยะแล่นผ่าน! ยืนในแถวที่ว่าง');
    for (let i = 0; i < 5; i++) if (i !== row) world.strike({ shape: 'line', x: 0, y: (i + 0.5) * A.h / 5, angle: 0, len: A.w, width: A.h / 5, dur: 1.8 * k, mult: 1.3, owner: e, tone: 'holy' });
    return 2.6 * k; } },
  scarabs: { go(e, world, k, ph) {   // a swarm of scarab bursts, the first ones aimed at the players
    const n = 14 + ph * 4, A = world.arena;
    for (let i = 0; i < n; i++) { const t = world.players[i % world.players.length]; const at = i < world.players.length ? { x: t.x, y: t.y } : inArena(world, 120 + world.rng.next() * (A.w - 240), 160 + world.rng.next() * (A.h - 260));
      world.strike({ shape: 'circle', x: at.x, y: at.y, r: 62, dur: (0.9 + i * 0.09) * k, mult: 1.3, owner: e, tone: 'holy' }); }
    return (0.9 + n * 0.09 + 0.5) * k; } },
};
Object.assign(BEHAVIOURS, {
  anubis_god: egyptGod(ANUBIS, [['scales', 'jackal', 'spears'], ['jackal', 'scales', 'spears', 'jackal'], ['scales', 'spears', 'jackal', 'scales']], { 2: 'อนูบิสเรียกเงาหมาป่า', 3: 'หัวใจของเจ้าหนักเกินไป!' }),
  sekhmet_god: egyptGod(SEKHMET, [['claws', 'prints', 'plague'], ['prints', 'claws', 'plague', 'claws'], ['plague', 'prints', 'claws', 'prints']], { 2: 'เซคเมทคำรามด้วยเพลิง', 3: 'สงครามไม่มีวันจบ!' }),
  ra_god: egyptGod(RA, [['beams', 'scarabs', 'barque'], ['barque', 'beams', 'scarabs', 'barque'], ['beams', 'barque', 'scarabs', 'beams']], { 2: 'ตะวันเคลื่อนสู่จุดสูงสุด', 3: 'รุ่งอรุณแห่งการพิพากษา!' }),
});

// v9 Egypt puzzle rooms (made gentler and clearer in 9.2): three statues, each with its own colour and number
// (1 red · 2 blue · 3 green), light up one after another; hit them with your ordinary attack in the same order.
// A wrong strike just replays the same sequence (no damage, no clock). Each round is one light longer, and the first
// rounds are short (see `start` / `rounds` of the wardens in data/zones.js). If you stand still for a while the next
// statue to hit pulses to help you. When the last round is right the warden falls by itself and the door opens.
// Only ordinary attacks count (melee / ranged): skills, ultimates, pets, burn and weapon echoes pass through the statues,
// so a wide skill can never light the wrong statue by accident. One strike = one answer, even if it pierces several.
//
// What the screen shows is carried by `e.puz` (the scene draws it, and sends it to the other players):
//   statue  number  (index + 1) + 10 when lit + 20 when it is the helping pulse
//   warden  string  mode(0 wait · 1 watch · 2 your turn · 3 done) + progress + length + the colours already shown, e.g. "20302"
export const PUZZLE = Object.freeze({ step: 1.0, lit: 0.85, firstWait: 1.6, retryWait: 0.9, hintAfter: 5, grace: 0.35 });
const GLYPH_SPOTS = (world) => { const A = world.arena, cx = A.w / 2, cy = A.h / 2; return [{ x: cx, y: cy - 290 }, { x: cx + 380, y: cy }, { x: cx, y: cy + 290 }]; };
BEHAVIOURS.egypt_glyph = function (e, dt, world) {
  if (e.home) { e.x = e.home.x; e.y = e.home.y; }
  e.vx = e.vy = 0; e.ai.cd = (e.ai.cd || 0) - dt;
  if (e.lit > 0) e.lit -= dt;
  if (e.hp < e.maxHp) { e.hp = e.maxHp; if (e.ai.cd <= 0) { e.hitSeen = (e.hitSeen || 0) + 1; e.ai.cd = 0.3; } }   // a strike only counts, it never breaks the statue
  e.puz = ((e.gi | 0) + 1) + (e.lit > 0 ? 10 : 0) + (e.hint ? 20 : 0);
};
function wardenMark(e) {
  const a = e.ai, seq = a.seq || [];
  const m = { wait: 0, show: 1, input: 2, done: 3 }[a.mode] ?? 0;
  const i = m === 2 ? a.i : 0, n = m === 3 ? 0 : seq.length;
  const shown = m === 1 ? seq.slice(0, a.si).join('') : m === 2 ? seq.slice(0, a.i).join('') : '';
  e.puz = `${m}${Math.min(9, i)}${Math.min(9, n)}${shown}`;
  if (a.g) for (let gi = 0; gi < a.g.length; gi++) if (a.g[gi]) a.g[gi].hint = m === 2 && (a.idle || 0) > PUZZLE.hintAfter && seq[a.i] === gi;
}
function wardenStep(e, dt, world) {
  const P = e.type.ai_params, a = e.ai, A = world.arena;
  stop(e, dt, 8); a.pt = (a.pt || 0) + dt;
  const go = (m) => { a.mode = m; a.pt = 0; };
  const light = (g) => { if (!g || !g.home) return; g.flash = 1; g.lit = PUZZLE.lit; world.fx.ring(g.home.x, g.home.y - 30, 20, 130, '#ffcf5a', 0.7, 7); world.particles.burst(g.home.x, g.home.y - 40, 16, { color: ['#ffcf5a', '#fff3c4'], speedMin: 60, speedMax: 220, life: 0.5, size: 4, drag: 3, glow: true }); world.sfx('telegraph'); };
  const spawnGlyph = (x, y, gi) => { const g = world.spawnEnemy('z_egypt_glyph', x, y); if (g) { g.home = { x, y }; g.gi = gi; g.hitSeen = 0; g.noReward = true; } return g; };
  const newSeq = () => { a.seq = Array.from({ length: P.start + a.round }, () => rngPick(world, P.glyphs)); };
  if (!a.mode) {
    e.x = A.w / 2; e.y = A.h / 2; e.untargetable = true; a.round = 0;
    a.g = GLYPH_SPOTS(world).slice(0, P.glyphs).map((s, gi) => spawnGlyph(s.x, s.y, gi));
    world.announce('ปริศนา: รูปปั้นเรืองแสงทีละตัว จำลำดับแล้วฟันตาม'); go('wait');
  }
  if (a.mode === 'wait' && a.pt > (a.retry ? PUZZLE.retryWait : PUZZLE.firstWait)) { if (!a.keep) newSeq(); a.keep = false; a.retry = false; a.si = 0; go('show'); }
  else if (a.mode === 'show') {
    if (a.si < a.seq.length && a.pt >= a.si * PUZZLE.step) { light(a.g[a.seq[a.si]]); a.si++; }
    if (a.si >= a.seq.length && a.pt > a.seq.length * PUZZLE.step + 0.5) {
      world.announce(`ถึงตาเจ้า! ฟันรูปปั้นตามลำดับ (${a.seq.length} ครั้ง)`); a.seen = a.g.map((g) => (g ? g.hitSeen || 0 : 0)); a.i = 0; a.grace = 0; a.idle = 0; go('input');
    }
  }
  // safety: a statue that somehow dies (one huge blow) is raised again where it stood, so the puzzle can never lock the room
  if (a.g && a.mode && a.mode !== 'done') {
    for (let gi = 0; gi < a.g.length; gi++) {
      const g = a.g[gi];
      if (g && g.dead) {
        const n = spawnGlyph(g.home.x, g.home.y, gi);
        if (n) { n.hitSeen = g.hitSeen || 0; a.g[gi] = n; }
      }
    }
  }
  if (a.mode === 'input') {
    a.grace -= dt; a.idle = (a.idle || 0) + dt;
    const fresh = [];
    for (let gi = 0; gi < a.g.length; gi++) { const g = a.g[gi]; if (g && (g.hitSeen || 0) > a.seen[gi]) { a.seen[gi] = g.hitSeen; fresh.push(gi); } }
    if (!fresh.length || a.grace > 0) return;                 // right after a correct strike, a piercing shot or a sweep that also grazes a neighbour is ignored
    a.idle = 0;
    if (!fresh.includes(a.seq[a.i])) {                        // wrong statue: no damage, the same sequence is shown again
      world.announce('ผิดลำดับ ไม่เป็นไร! ดูใหม่อีกครั้ง'); world.sfx('parry'); a.keep = true; a.retry = true; go('wait'); return;
    }
    const g = a.g[a.seq[a.i]]; a.i++; a.grace = PUZZLE.grace; light(g); world.sfx('crit');
    if (a.i >= a.seq.length) {
      a.round++;
      if (a.round >= P.rounds) {
        for (const x of a.g) if (x && !x.dead) world.killEnemy(x);
        world.announce('ประตูเปิดแล้ว!'); world.sfx('roar'); go('done');
        e.untargetable = false; e.hp = 0; world.killEnemy(e, true);      // the warden falls on its own (its loot is paid like any kill)
      } else { world.announce(`ถูกต้อง! รอบที่ ${a.round + 1} จาก ${P.rounds} ยาวขึ้นอีกหนึ่งครั้ง`); a.keep = false; go('wait'); }
    }
  }
}
BEHAVIOURS.egypt_warden = function (e, dt, world) { wardenStep(e, dt, world); wardenMark(e); };

export const RAID_BEHAVIOURS_READY = true;
