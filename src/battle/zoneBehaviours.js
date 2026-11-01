// Attack patterns of the online-zone monsters and bosses. Every attack is telegraphed: delayed area strikes
// (world.strike) show their shape before they land, projectiles are visible and dodgeable, ground pools linger.
// The scene (src/scenes/coopScene.js) supplies the world API:
//   world.player   — this enemy's current target (any party member)    world.players — everyone still standing
//   world.hitPlayer(e, mult, kx, ky, fire)  contact damage on the target
//   world.strike({ shape: circle|line|cone|ring|rect, ..., dur, mult, owner, fire, kb, tone })
//   world.pool({ x, y, r, dur, kind: poison|fire|ice|web|sand, mult })
//   world.shoot(e, { x, y, angle, speed, r, mult, kind, homing, pierce, life, pool })
//   world.gust(angle, dur, force) · world.spawnEnemy(id, x, y) · world.announce(text) · world.sfx / shake / fx / particles
import { BEHAVIOURS } from './enemies.js';
import './raidBehaviours.js';   // the three special-dungeon bosses
import './godBehaviours.js';    // v7: the ten gods of the Underworld Tower
import './zoneBehaviours2.js';  // v8: the mirror abyss, the eclipse throne and the Boss Rush shadow

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
function steer(e, angle, speed, dt, k = 6) {
  const f = Math.min(1, dt * k);
  e.vx += (Math.cos(angle) * speed - e.vx) * f; e.vy += (Math.sin(angle) * speed - e.vy) * f;
}
function stop(e, dt, k = 8) { steer(e, 0, 0, dt, k); }
function setState(e, s) { e.state = s; e.t = 0; e.hitThisAttack = false; }
function tryHit(e, world, mult = 1, extra = 0, kb = 320) {
  if (e.hitThisAttack) return;
  const p = world.player;
  if (!p || p.dead) return;
  if (dist(e, p) <= e.r + p.r + extra) { const a = toward(e, p); if (world.hitPlayer(e, mult, Math.cos(a) * kb, Math.sin(a) * kb)) e.hitThisAttack = true; }
}
function inArena(world, x, y, pad = 90) {
  const A = world.arena;
  return { x: Math.max(pad, Math.min(A.w - pad, x)), y: Math.max(pad + 40, Math.min(A.h - pad, y)) };
}
function randomPlayer(world) {
  const ps = world.players;
  return ps.length ? ps[(world.rng.next() * ps.length) | 0] : world.player;
}
function enrage(e, world, text, then) {
  if (e.enraged || e.hp > e.maxHp * 0.5) return;
  e.enraged = true; world.sfx('roar'); world.shake(10, 0.5); world.announce(text);
  then?.();
}
const telegraphWarn = (e, k) => { e.warn = Math.max(0, Math.min(1, k)); };

// ===================================================================== monsters
Object.assign(BEHAVIOURS, {
  // Gust sprite: three quick zigzag dashes, then a telegraphed straight dart through the target.
  zigzag(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') { setState(e, 'zig'); e.ai.n = 0; e.ai.side = 1; }
    if (e.state === 'zig') {
      const a = toward(e, p) + e.ai.side * 0.9;
      steer(e, a, P.dashSpeed, dt, 14);
      if (e.t >= P.dashTime) {
        e.ai.n += 1; e.ai.side *= -1; e.t = 0;
        if (e.ai.n >= P.dashes) { setState(e, 'windup'); e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: P.dartSpeed * P.dartTime, width: 40, dur: P.windup, mult: 0, owner: e, tone: 'wind' }); world.sfx('telegraph'); }
      }
    } else if (e.state === 'windup') {
      stop(e, dt, 12); telegraphWarn(e, e.t / P.windup);
      if (e.t >= P.windup) { setState(e, 'dart'); e.warn = 0; }
    } else if (e.state === 'dart') {
      e.vx = Math.cos(e.ai.dir) * P.dartSpeed; e.vy = Math.sin(e.ai.dir) * P.dartSpeed;
      tryHit(e, world, 1);
      if (e.t >= P.dartTime) setState(e, 'rest');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest) { setState(e, 'zig'); e.ai.n = 0; }
    }
  },

  // Seed spitter: rooted plant firing aimed 3-shot spreads; after a few volleys it burrows and pops up near someone.
  turret_burrow(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    e.vx = 0; e.vy = 0;
    if (e.state === 'idle') { setState(e, 'aim'); e.ai.v = 0; }
    if (e.state === 'aim') {
      telegraphWarn(e, e.t / P.windup);
      if (e.t >= P.windup) {
        e.warn = 0;
        const a = toward(e, p);
        for (let i = 0; i < P.shots; i++) world.shoot(e, { x: e.x, y: e.y - 36, angle: a + (i - (P.shots - 1) / 2) * P.spread, speed: P.shotSpeed, r: 9, mult: 0.8, kind: 'seed' });
        world.sfx('bow'); e.ai.v += 1; setState(e, e.ai.v >= P.volleys ? 'burrow' : 'gap');
      }
    } else if (e.state === 'gap') {
      if (e.t >= P.gap) setState(e, 'aim');
    } else if (e.state === 'burrow') {
      e.hidden = Math.min(1, e.t / 0.3); e.untargetable = true;
      if (e.t >= P.burrowTime) {
        const t = randomPlayer(world), a = world.rng.next() * TAU;
        const at = inArena(world, t.x + Math.cos(a) * 170, t.y + Math.sin(a) * 120);
        e.x = at.x; e.y = at.y;
        world.strike({ shape: 'circle', x: at.x, y: at.y - 6, r: P.emergeRadius, dur: 0.7, mult: 0.9, owner: e, tone: 'earth' });
        setState(e, 'emerge');
      }
    } else if (e.state === 'emerge') {
      if (e.t >= 0.7) { e.hidden = 0; e.untargetable = false; e.ai.v = 0; setState(e, 'gap'); world.particles.burst(e.x, e.y, 14, { color: ['#6b5638', '#8a7350', '#6f9a4a'], speedMin: 80, speedMax: 220, life: 0.5, size: 5, drag: 3 }); }
    }
  },

  // Ice archer: keeps far away, shows its aim line, then fires a fast piercing shard that leaves ice on the ground.
  sniper(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const d = dist(e, p), a = toward(e, p);
    if (e.state === 'idle') { setState(e, 'kite'); e.ai.cd = 1 + world.rng.next(); e.ai.side = world.rng.next() < 0.5 ? 1 : -1; }
    if (e.state === 'kite') {
      e.ai.cd -= dt;
      let move = a + e.ai.side * Math.PI / 2;
      if (d > P.keepAway + 80) move = a; else if (d < P.keepAway - 80) move = a + Math.PI;
      steer(e, move, e.type.speed, dt, 4);
      if (e.ai.cd <= 0) { setState(e, 'aim'); e.ai.dir = a; world.strike({ shape: 'line', x: e.x, y: e.y - 30, angle: a, len: 900, width: 18, dur: P.aim, mult: 0, owner: e, tone: 'ice' }); world.sfx('telegraph'); }
    } else if (e.state === 'aim') {
      stop(e, dt, 10); telegraphWarn(e, e.t / P.aim);
      if (e.t >= P.aim) {
        e.warn = 0;
        world.shoot(e, { x: e.x, y: e.y - 30, angle: e.ai.dir, speed: P.shotSpeed, r: 10, mult: 1.15, kind: 'shard', pierce: true, pool: { kind: 'ice', r: 60, dur: 3.5 } });
        world.sfx('bow'); setState(e, 'recover'); e.ai.cd = P.cooldown;
      }
    } else if (e.state === 'recover') {
      steer(e, a + Math.PI, e.type.speed * 0.6, dt, 4);
      if (e.t >= 0.5) setState(e, 'kite');
    }
  },

  // Bog toad: telegraphed tongue lash that PULLS whoever it catches, then a hop slam.
  tongue(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const d = dist(e, p);
    if (e.state === 'idle') setState(e, 'approach');
    if (e.state === 'approach') {
      steer(e, toward(e, p), e.type.speed, dt, 4);
      if (d < P.range) { setState(e, 'windup'); e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: e.ai.dir, len: P.range + 40, width: P.tongueWidth, dur: P.windup, mult: 0.7, owner: e, kb: P.pull, tone: 'poison' }); world.sfx('telegraph'); }
    } else if (e.state === 'windup') {
      stop(e, dt, 10); telegraphWarn(e, e.t / P.windup); e.sx = 1 + 0.1 * e.warn; e.sy = 1 - 0.1 * e.warn;
      if (e.t >= P.windup) { e.warn = 0; setState(e, 'lick'); world.sfx('dash'); }
    } else if (e.state === 'lick') {
      if (e.t >= 0.35) { setState(e, 'hop'); e.ai.dir = toward(e, p); }
    } else if (e.state === 'hop') {
      steer(e, e.ai.dir, P.hopSpeed, dt, 12);
      e.ai.z = Math.sin(Math.min(1, e.t / P.hopTime) * Math.PI) * 30;
      if (e.t >= P.hopTime) { e.ai.z = 0; world.strike({ shape: 'circle', x: e.x, y: e.y, r: 80, dur: 0.05, mult: 0.9, owner: e, tone: 'poison' }); world.shake(4, 0.15); setState(e, 'rest'); }
    } else if (e.state === 'rest') {
      stop(e, dt, 6);
      if (e.t >= P.rest) setState(e, 'approach');
    }
  },

  // Spore puff: drifts to the nearest player, swells, bursts into a poison cloud and leaves a toxic pool.
  bomber(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'drift');
    if (e.state === 'drift') {
      steer(e, toward(e, p) + Math.sin(world.time * 2 + e.x) * 0.4, e.type.speed, dt, 2.5);
      e.ai.z = 16 + Math.sin(world.time * 3 + e.y) * 6;
      if (dist(e, p) < P.trigger) { setState(e, 'swell'); world.strike({ shape: 'circle', x: e.x, y: e.y, r: P.blast, dur: P.swell, mult: 1.2, owner: e, tone: 'poison' }); world.sfx('telegraph'); }
    } else if (e.state === 'swell') {
      stop(e, dt, 10); telegraphWarn(e, e.t / P.swell);
      e.sx = e.sy = 1 + 0.45 * e.warn;
      if (e.t >= P.swell) {
        world.pool({ x: e.x, y: e.y, r: P.poolR, dur: P.poolT, kind: 'poison', mult: 0.25 });
        world.particles.burst(e.x, e.y - 20, 30, { color: ['#c27ff0', '#e8ff9a', '#b07ad0'], speedMin: 80, speedMax: 260, life: 0.8, size: 6, drag: 2.5 });
        world.selfDestruct(e);
      }
    }
  },

  // Shade stalker: fades out, reappears behind its target and slashes in a wide arc.
  blink_assassin(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'fade');
    if (e.state === 'fade') {
      e.hidden = Math.min(0.85, e.t / 0.4);
      steer(e, toward(e, p) + 0.7, e.type.speed, dt, 3);
      if (e.t >= P.fade) {
        const back = (p.flip ? 1 : -1);
        const at = inArena(world, p.x + back * 80, p.y + 10);
        e.x = at.x; e.y = at.y; e.hidden = 0.2;
        e.ai.dir = toward(e, p);
        world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: e.ai.dir, r: P.slashRange, arc: P.slashArc, dur: P.windup, mult: 1.1, owner: e, tone: 'shadow' });
        world.particles.burst(e.x, e.y - 30, 16, { color: ['#3a3450', '#9a8ad0'], speedMin: 60, speedMax: 200, life: 0.4, size: 4, drag: 3 });
        world.sfx('blink'); setState(e, 'strike');
      }
    } else if (e.state === 'strike') {
      stop(e, dt, 12); telegraphWarn(e, e.t / P.windup); e.hidden = 0;
      if (e.t >= P.windup) { e.warn = 0; world.sfx('swing'); setState(e, 'recover'); }
    } else if (e.state === 'recover') {
      steer(e, toward(e, p) + Math.PI, e.type.speed * 0.5, dt, 4);
      if (e.t >= P.recover) setState(e, 'fade');
    }
  },

  // Bone lancer: lines up, shows a long thrust lane, then rushes along it.
  lancer(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'approach');
    if (e.state === 'approach') {
      steer(e, toward(e, p), e.type.speed, dt, 4);
      if (dist(e, p) < P.range) {
        setState(e, 'windup'); e.ai.dir = toward(e, p); e.ai.sx = e.x; e.ai.sy = e.y;
        world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: P.thrustLen, width: P.thrustWidth, dur: P.windup + P.thrustTime * 0.5, mult: 1.2, owner: e, tone: 'bone' });
        world.sfx('telegraph');
      }
    } else if (e.state === 'windup') {
      stop(e, dt, 12); telegraphWarn(e, e.t / P.windup);
      if (e.t >= P.windup) { e.warn = 0; setState(e, 'thrust'); world.sfx('dash'); }
    } else if (e.state === 'thrust') {
      const sp = P.thrustLen / P.thrustTime;
      e.vx = Math.cos(e.ai.dir) * sp; e.vy = Math.sin(e.ai.dir) * sp;
      if (e.t >= P.thrustTime) { setState(e, 'recover'); e.vx *= 0.1; e.vy *= 0.1; }
    } else if (e.state === 'recover') {
      stop(e, dt, 5);
      if (e.t >= P.recover) setState(e, 'approach');
    }
  },

  // Sand burrower: travels underground (only a dust trail shows), erupts under its target, then spits sand.
  burrower(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'dig');
    if (e.state === 'dig') {
      e.hidden = Math.min(1, e.t / 0.3); e.untargetable = e.hidden > 0.6;
      steer(e, toward(e, p), e.type.speed, dt, 5);
      if (world.rng.next() < dt * 30) world.particles.spawn({ x: e.x + (world.rng.next() - 0.5) * 30, y: e.y, vx: 0, vy: -30, life: 0.6, size: 7, size2: 2, color: '#c8a060', drag: 2 });
      if (e.t >= P.travel || dist(e, p) < 40) {
        e.ai.tx = p.x; e.ai.ty = p.y;
        world.strike({ shape: 'circle', x: p.x, y: p.y, r: P.emergeRadius, dur: P.emergeTelegraph, mult: 1.2, owner: e, tone: 'earth' });
        setState(e, 'rise');
      }
    } else if (e.state === 'rise') {
      stop(e, dt, 10);
      if (e.t >= P.emergeTelegraph) {
        e.x = e.ai.tx; e.y = e.ai.ty; e.hidden = 0; e.untargetable = false;
        world.particles.burst(e.x, e.y, 22, { color: ['#c8a060', '#f0d89a', '#6a4a24'], speedMin: 100, speedMax: 300, life: 0.6, size: 6, drag: 3, shape: 1 });
        world.shake(5, 0.2); setState(e, 'exposed');
        const a0 = world.rng.next() * TAU;
        for (let i = 0; i < P.spitCount; i++) world.shoot(e, { x: e.x, y: e.y - 20, angle: a0 + (i / P.spitCount) * TAU, speed: P.spitSpeed, r: 8, mult: 0.6, kind: 'sand' });
      }
    } else if (e.state === 'exposed') {
      stop(e, dt, 6);
      if (e.t >= P.exposed) setState(e, 'dig');
    }
  },

  // Scarab: circles its target in a swarm, then dives in on a short telegraph.
  swarm(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') { setState(e, 'orbit'); e.ai.ang = world.rng.next() * TAU; e.ai.dirSign = world.rng.next() < 0.5 ? 1 : -1; }
    if (e.state === 'orbit') {
      e.ai.ang += dt * 2.2 * e.ai.dirSign;
      const tx = p.x + Math.cos(e.ai.ang) * P.orbit, ty = p.y + Math.sin(e.ai.ang) * P.orbit * 0.7;
      steer(e, Math.atan2(ty - e.y, tx - e.x), e.type.speed, dt, 6);
      e.ai.z = 12;
      if (e.t >= P.orbitTime * (0.7 + world.rng.next() * 0.02 * 30)) { setState(e, 'windup'); e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y, angle: e.ai.dir, len: P.dashSpeed * P.dashTime, width: 26, dur: P.windup, mult: 0, owner: e, tone: 'earth' }); }
    } else if (e.state === 'windup') {
      stop(e, dt, 12); telegraphWarn(e, e.t / P.windup);
      if (e.t >= P.windup) { e.warn = 0; setState(e, 'dive'); }
    } else if (e.state === 'dive') {
      e.vx = Math.cos(e.ai.dir) * P.dashSpeed; e.vy = Math.sin(e.ai.dir) * P.dashSpeed;
      tryHit(e, world, 0.8, 4, 200);
      if (e.t >= P.dashTime) setState(e, 'orbit');
    }
  },

  // Cap bouncer: aims (telegraph lane), launches and ricochets off the walls, then sits dizzy.
  ricochet(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'aim');
    if (e.state === 'aim') {
      stop(e, dt, 8);
      if (e.t < dt * 1.5) { e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: 600, width: 46, dur: P.windup, mult: 0, owner: e, tone: 'spore' }); world.sfx('telegraph'); }
      telegraphWarn(e, e.t / P.windup); e.sy = 1 - 0.25 * e.warn; e.sx = 1 + 0.2 * e.warn;
      if (e.t >= P.windup) { e.warn = 0; setState(e, 'fly'); e.ai.b = 0; e.vx = Math.cos(e.ai.dir) * P.speed; e.vy = Math.sin(e.ai.dir) * P.speed; world.sfx('dash'); }
    } else if (e.state === 'fly') {
      const A = world.arena, pad = (world.wallPad || 60) + e.r;
      let bounced = false;
      if (e.x < pad && e.vx < 0) { e.vx = -e.vx; bounced = true; }
      if (e.x > A.w - pad && e.vx > 0) { e.vx = -e.vx; bounced = true; }
      if (e.y < pad + 30 && e.vy < 0) { e.vy = -e.vy; bounced = true; }
      if (e.y > A.h - pad && e.vy > 0) { e.vy = -e.vy; bounced = true; }
      if (bounced) { e.ai.b += 1; e.hitThisAttack = false; world.sfx('slam'); world.shake(3, 0.1); }
      e.ai.z = Math.abs(Math.sin(e.t * 9)) * 18;
      tryHit(e, world, 1, 4);
      if (e.ai.b > P.bounces || e.t > P.travel) { setState(e, 'dizzy'); e.vx *= 0.2; e.vy *= 0.2; e.ai.z = 0; }
    } else if (e.state === 'dizzy') {
      stop(e, dt, 4); e.sx = 1 + 0.08 * Math.sin(world.time * 14);
      if (e.t >= P.dizzy) setState(e, 'aim');
    }
  },

  // Mycel weaver: keeps its distance and throws sticky webs where you are going to be.
  weaver(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const d = dist(e, p), a = toward(e, p);
    if (e.state === 'idle') { setState(e, 'kite'); e.ai.cd = 1; e.ai.side = 1; }
    if (e.state === 'kite') {
      e.ai.cd -= dt;
      let move = a + e.ai.side * Math.PI / 2;
      if (d > P.keepAway + 70) move = a; else if (d < P.keepAway - 70) move = a + Math.PI;
      steer(e, move, e.type.speed, dt, 4);
      if (world.rng.next() < dt * 0.5) e.ai.side *= -1;
      if (e.ai.cd <= 0) {
        const lead = 0.6;
        const tx = p.x + (p.vx || 0) * lead, ty = p.y + (p.vy || 0) * lead;
        world.strike({ shape: 'circle', x: tx, y: ty, r: P.webRadius, dur: P.webTelegraph, mult: 0.5, owner: e, tone: 'spore', then: { pool: { kind: 'web', r: P.webRadius, dur: P.webT, mult: 0 } } });
        world.shoot(e, { x: e.x, y: e.y - 20, angle: a, speed: P.strandSpeed, r: 7, mult: 0.6, kind: 'spore' });
        world.sfx('cast'); e.ai.cd = P.webEvery;
      }
    }
  },

  // Volt drone: orbits at range and fires a telegraphed zap line through its target.
  orbit_zapper(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') { setState(e, 'orbit'); e.ai.ang = world.rng.next() * TAU; e.ai.cd = P.zapEvery * world.rng.next(); }
    if (e.state === 'orbit') {
      e.ai.ang += dt * 1.1;
      const tx = p.x + Math.cos(e.ai.ang) * P.orbit, ty = p.y + Math.sin(e.ai.ang) * P.orbit * 0.75;
      steer(e, Math.atan2(ty - e.y, tx - e.x), e.type.speed, dt, 4);
      e.ai.z = 24; e.ai.cd -= dt;
      if (e.ai.cd <= 0) {
        e.ai.dir = toward(e, p);
        world.strike({ shape: 'line', x: e.x, y: e.y - 24, angle: e.ai.dir, len: dist(e, p) + 160, width: P.zapWidth, dur: P.zapTelegraph, mult: 1, owner: e, tone: 'volt' });
        world.sfx('telegraph'); setState(e, 'zap');
      }
    } else if (e.state === 'zap') {
      stop(e, dt, 10); telegraphWarn(e, e.t / P.zapTelegraph);
      if (e.t >= P.zapTelegraph) { e.warn = 0; e.ai.cd = P.zapEvery; world.sfx('crit'); setState(e, 'orbit'); }
    }
  },

  // Iron brute: shield up front (hits from the front barely scratch it), slow walk, telegraphed overhead smash.
  shielded(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    e.guarding = e.state !== 'recover';
    if (e.state === 'idle') setState(e, 'walk');
    if (e.state === 'walk') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      e.ai.face = toward(e, p);
      if (dist(e, p) < P.smashRange + e.r) {
        setState(e, 'windup');
        const fx = e.x + Math.cos(e.ai.face) * 60, fy = e.y + Math.sin(e.ai.face) * 50;
        world.strike({ shape: 'circle', x: fx, y: fy, r: P.smashRadius, dur: P.windup, mult: 1.4, owner: e, tone: 'volt' });
        world.sfx('telegraph');
      }
    } else if (e.state === 'windup') {
      stop(e, dt, 10); telegraphWarn(e, e.t / P.windup); e.sy = 1 + 0.12 * e.warn;
      if (e.t >= P.windup) { e.warn = 0; world.shake(8, 0.25); world.sfx('slam'); setState(e, 'recover'); }
    } else if (e.state === 'recover') {
      stop(e, dt, 6);
      if (e.t >= P.recover) setState(e, 'walk');
    }
  },

  // Magma hound: runs circles around its target leaving fire behind, then pounces.
  trailblazer(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') { setState(e, 'circle'); e.ai.ang = toward(p, e); e.ai.sign = world.rng.next() < 0.5 ? 1 : -1; e.ai.trail = 0; }
    if (e.state === 'circle') {
      e.ai.ang += dt * 2.4 * e.ai.sign;
      const tx = p.x + Math.cos(e.ai.ang) * 220, ty = p.y + Math.sin(e.ai.ang) * 160;
      steer(e, Math.atan2(ty - e.y, tx - e.x), e.type.speed, dt, 5);
      e.ai.trail -= dt;
      if (e.ai.trail <= 0) { e.ai.trail = P.trailEvery; world.pool({ x: e.x, y: e.y, r: P.trailR, dur: P.trailT, kind: 'fire', mult: 0.3 }); }
      if (e.t >= P.circle) { setState(e, 'windup'); e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y, angle: e.ai.dir, len: P.pounceSpeed * P.pounceTime, width: 50, dur: P.pounceTelegraph, mult: 0, owner: e, tone: 'fire' }); world.sfx('telegraph'); }
    } else if (e.state === 'windup') {
      stop(e, dt, 12); telegraphWarn(e, e.t / P.pounceTelegraph);
      if (e.t >= P.pounceTelegraph) { e.warn = 0; setState(e, 'pounce'); world.sfx('roar'); }
    } else if (e.state === 'pounce') {
      e.vx = Math.cos(e.ai.dir) * P.pounceSpeed; e.vy = Math.sin(e.ai.dir) * P.pounceSpeed;
      e.ai.z = Math.sin(Math.min(1, e.t / P.pounceTime) * Math.PI) * 26;
      tryHit(e, world, 1.2, 6);
      if (e.t >= P.pounceTime) { e.ai.z = 0; setState(e, 'idle'); }
    }
  },

  // Cinder mortar: lobs shells at you and around you; each landing spot is marked well before impact.
  mortar(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const d = dist(e, p), a = toward(e, p);
    if (e.state === 'idle') { setState(e, 'reposition'); e.ai.cd = 1; }
    if (e.state === 'reposition') {
      e.ai.cd -= dt;
      steer(e, d < P.keepAway ? a + Math.PI : a + Math.PI / 2, e.type.speed, dt, 3);
      if (e.ai.cd <= 0) {
        stop(e, dt, 20);
        for (let i = 0; i < P.shells; i++) {
          const t = i === 0 ? p : randomPlayer(world);
          const ox = i === 0 ? 0 : (world.rng.next() - 0.5) * P.scatter * 2, oy = i === 0 ? 0 : (world.rng.next() - 0.5) * P.scatter * 2;
          const at = inArena(world, t.x + ox, t.y + oy, 70);
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.blast, dur: P.telegraph + i * 0.18, mult: 1.1, owner: e, fire: true, tone: 'fire', arc: { x: e.x, y: e.y - 50 } });
        }
        world.sfx('slam'); e.ai.cd = P.cooldown; setState(e, 'recoil');
      }
    } else if (e.state === 'recoil') {
      stop(e, dt, 8); e.sy = 0.9;
      if (e.t >= 0.6) setState(e, 'reposition');
    }
  },

  // Feather monk: guard stance (blue) answers any hit with a counter ring; otherwise a three-palm combo.
  counter(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'approach');
    if (e.ai.countered) {
      e.ai.countered = false; e.guarding = false;
      world.strike({ shape: 'circle', x: e.x, y: e.y - 10, r: P.counterRadius, dur: 0.32, mult: 1.2, owner: e, tone: 'holy' });
      world.fx.callout(e.x, e.y - 90, 'สวนกลับ!', '#bfe3ff'); world.sfx('perfect');
      setState(e, 'recover');
      return;
    }
    if (e.state === 'approach') {
      e.guarding = false;
      steer(e, toward(e, p), e.type.speed, dt, 4);
      if (dist(e, p) < P.palmRange + 40) { setState(e, world.rng.next() < 0.45 ? 'guard' : 'palms'); e.ai.n = 0; }
    } else if (e.state === 'guard') {
      stop(e, dt, 10); e.guarding = true;
      if (e.t >= P.guard) { e.guarding = false; setState(e, 'palms'); e.ai.n = 0; }
    } else if (e.state === 'palms') {
      stop(e, dt, 10);
      const due = P.windup + e.ai.n * P.palmGap;
      if (e.ai.n < P.palms && e.t >= due - P.windup && !e.ai.queued) {
        e.ai.queued = true;
        const dir = toward(e, p);
        world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: dir, r: P.palmRange, arc: P.palmArc, dur: P.windup, mult: 0.7, owner: e, tone: 'holy' });
      }
      if (e.t >= due) { e.ai.n += 1; e.ai.queued = false; world.sfx('swing'); if (e.ai.n >= P.palms) setState(e, 'recover'); }
    } else if (e.state === 'recover') {
      stop(e, dt, 6);
      if (e.t >= 0.9) setState(e, 'approach');
    }
  },

  // Cloud ray: glides from one side of the arena to the other along a marked lane; lightning follows its wake.
  glider(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'line');
    if (e.state === 'line') {
      stop(e, dt, 6); e.ai.z = 30;
      if (e.t < dt * 1.5) {
        e.ai.dir = toward(e, p);
        const len = 1600;
        world.strike({ shape: 'line', x: e.x, y: e.y, angle: e.ai.dir, len, width: P.trailWidth, dur: P.telegraph, mult: 0, owner: e, tone: 'volt' });
        world.sfx('telegraph');
      }
      telegraphWarn(e, e.t / P.telegraph);
      if (e.t >= P.telegraph) { e.warn = 0; setState(e, 'glide'); e.ai.sx = e.x; e.ai.sy = e.y; }
    } else if (e.state === 'glide') {
      e.vx = Math.cos(e.ai.dir) * P.glideSpeed; e.vy = Math.sin(e.ai.dir) * P.glideSpeed;
      tryHit(e, world, 0.9, 6);
      const A = world.arena, pad = 80;
      if (e.x < pad || e.x > A.w - pad || e.y < pad + 20 || e.y > A.h - pad || e.t > 3) {
        const len = Math.hypot(e.x - e.ai.sx, e.y - e.ai.sy);
        world.strike({ shape: 'line', x: e.ai.sx, y: e.ai.sy - 10, angle: e.ai.dir, len, width: P.trailWidth, dur: P.trailDelay, mult: 0.9, owner: e, tone: 'volt' });
        setState(e, 'rest'); e.vx *= 0.1; e.vy *= 0.1;
      }
    } else if (e.state === 'rest') {
      stop(e, dt, 4);
      if (e.t >= P.rest) setState(e, 'line');
    }
  },

  // Ash revenant: two-swing combo; the first time it falls it crumbles to ash and rises again.
  revenant(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'ash') {
      stop(e, dt, 10); e.hidden = 0.5; e.untargetable = true;
      if (e.t >= P.reviveTime) { e.hidden = 0; e.untargetable = false; e.hp = Math.round(e.maxHp * 0.5); world.fx.ring(e.x, e.y - 20, 10, 90, '#ff8a3d', 0.5, 6); world.sfx('roar'); setState(e, 'approach'); }
      return;
    }
    if (e.state === 'idle') setState(e, 'approach');
    if (e.state === 'approach') {
      steer(e, toward(e, p), e.type.speed, dt, 4);
      if (dist(e, p) < P.range + 30) { setState(e, 'combo'); e.ai.n = 0; e.ai.queued = false; }
    } else if (e.state === 'combo') {
      stop(e, dt, 10);
      const due = P.windup + e.ai.n * (P.windup + P.gap);
      if (!e.ai.queued) { e.ai.queued = true; world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: toward(e, p), r: P.range, arc: P.arc, dur: P.windup, mult: 1, owner: e, tone: 'fire' }); }
      telegraphWarn(e, 1 - (due - e.t) / P.windup);
      if (e.t >= due) { e.ai.n += 1; e.ai.queued = false; e.warn = 0; world.sfx('swing'); if (e.ai.n >= P.swings) setState(e, 'recover'); }
    } else if (e.state === 'recover') {
      stop(e, dt, 6);
      if (e.t >= P.recover) setState(e, 'approach');
    }
  },

  // Cinder mage: three slow homing orbs; blinks away when someone gets close.
  homing_caster(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const d = dist(e, p), a = toward(e, p);
    if (e.state === 'idle') { setState(e, 'kite'); e.ai.cd = 1.2; }
    if (e.state === 'kite') {
      e.ai.cd -= dt;
      steer(e, d > P.keepAway ? a : a + Math.PI / 2, e.type.speed, dt, 4);
      if (d < P.blinkRange) {
        const at = inArena(world, e.x - Math.cos(a) * 300, e.y - Math.sin(a) * 220);
        world.particles.burst(e.x, e.y - 30, 12, { color: ['#ffcf5a', '#5a2a24'], speedMin: 60, speedMax: 180, life: 0.4, size: 3, drag: 3, glow: true });
        e.x = at.x; e.y = at.y; world.sfx('blink'); e.ai.cd = Math.max(e.ai.cd, 0.6);
      }
      if (e.ai.cd <= 0) { setState(e, 'cast'); world.sfx('telegraph'); }
    } else if (e.state === 'cast') {
      stop(e, dt, 10); telegraphWarn(e, e.t / P.windup);
      if (e.t >= P.windup) {
        e.warn = 0;
        for (let i = 0; i < P.orbs; i++) world.shoot(e, { x: e.x, y: e.y - 50, angle: a + (i - 1) * 0.6, speed: P.orbSpeed, r: 11, mult: 0.85, kind: 'orb', homing: P.homing, life: 4.5, fire: true });
        world.sfx('cast'); e.ai.cd = P.cooldown; setState(e, 'kite');
      }
    }
  },

  // Tesla pylon: does nothing on its own; the titan arcs lightning between pylons.
  pylon(e) { e.vx = 0; e.vy = 0; },
});

// ===================================================================== bosses
Object.assign(BEHAVIOURS, {
  // Storm Roc: three crossing dive lanes, feather fans, a drifting tornado; faster and gustier when enraged.
  storm_roc(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.75 : 1;
    enrage(e, world, 'ราชันนกพายุโกรธจัด!', () => world.gust(world.rng.next() * TAU, 1.4, 260));
    if (e.state === 'idle') { setState(e, 'hover'); e.ai.next = 0; }
    e.ai.z = e.state === 'dive' ? 6 : 40 + Math.sin(world.time * 2) * 8;
    if (e.state === 'hover') {
      const t = p, tx = t.x + Math.cos(world.time * 0.7) * 260, ty = t.y - 160;
      const at = inArena(world, tx, ty, 120);
      steer(e, Math.atan2(at.y - e.y, at.x - e.x), e.type.speed, dt, 2);
      if (e.t >= 1.4 * k) {
        const move = ['dive', 'fan', 'tornado'][e.ai.next % 3]; e.ai.next += 1;
        setState(e, move); e.ai.n = 0; e.ai.armed = false;
      }
    } else if (e.state === 'dive') {
      // a lane is shown, then the roc rushes along it; three in a row
      if (!e.ai.armed) {
        const t = randomPlayer(world);
        e.ai.dir = toward(e, t); e.ai.armed = true; e.ai.go = 0;
        world.strike({ shape: 'line', x: e.x, y: e.y, angle: e.ai.dir, len: 1100, width: 110, dur: P.diveTelegraph * k, mult: 1.3, owner: e, tone: 'wind', follow: true });
        world.sfx('telegraph');
      }
      if (e.ai.go === 0) { stop(e, dt, 10); telegraphWarn(e, e.t / (P.diveTelegraph * k)); if (e.t >= P.diveTelegraph * k) { e.ai.go = 1; e.t = 0; e.warn = 0; world.sfx('roar'); } }
      else {
        e.vx = Math.cos(e.ai.dir) * P.diveSpeed; e.vy = Math.sin(e.ai.dir) * P.diveSpeed;
        const A = world.arena, pad = 90;
        if (e.t > 1.1 || e.x < pad || e.x > A.w - pad || e.y < pad || e.y > A.h - pad) {
          e.vx *= 0.1; e.vy *= 0.1; e.ai.n += 1; e.ai.armed = false; e.t = 0;
          if (e.ai.n >= P.dives) setState(e, 'rest');
        }
      }
    } else if (e.state === 'fan') {
      stop(e, dt, 8); telegraphWarn(e, e.t / (0.6 * k));
      if (e.t >= 0.6 * k && e.ai.n < 2) {
        const a = toward(e, p) + (e.ai.n ? P.fanSpread / P.fanCount / 2 : 0);
        for (let i = 0; i < P.fanCount; i++) world.shoot(e, { x: e.x, y: e.y - 60, angle: a - P.fanSpread / 2 + (P.fanSpread * i) / (P.fanCount - 1), speed: P.shotSpeed, r: 10, mult: 0.75, kind: 'feather' });
        world.sfx('bow'); e.ai.n += 1; e.t = 0.25 * k; e.warn = 0;
      }
      if (e.ai.n >= 2 && e.t >= 0.9) setState(e, 'rest');
    } else if (e.state === 'tornado') {
      stop(e, dt, 8); telegraphWarn(e, e.t / (0.8 * k));
      if (e.t >= 0.8 * k) {
        e.warn = 0;
        world.shoot(e, { x: e.x, y: e.y, angle: toward(e, p), speed: 120, r: 46, mult: 0.9, kind: 'tornado', homing: 0.9, life: P.tornadoLife, pierce: true, ground: true });
        if (e.enraged) world.shoot(e, { x: e.x, y: e.y, angle: toward(e, p) + Math.PI / 2, speed: 120, r: 46, mult: 0.9, kind: 'tornado', homing: 0.7, life: P.tornadoLife, pierce: true, ground: true });
        world.sfx('roar'); setState(e, 'rest');
      }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'hover');
    }
  },

  // Glacier Wyrm: dives under the ice and erupts under a player, breathes a frost cone, sprays a ring of shards.
  glacier_wyrm(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'ธารน้ำแข็งแตกร้าว!');
    if (e.state === 'idle') { setState(e, 'walk'); e.ai.next = 0; }
    if (e.state === 'walk') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.contactCd <= 0 && dist(e, p) < e.r + p.r) { const a = toward(e, p); if (world.hitPlayer(e, 0.6, Math.cos(a) * 300, Math.sin(a) * 300)) e.contactCd = 1; }
      if (e.t >= 1.3 * k) { setState(e, ['burrow', 'breath', 'ring'][e.ai.next % 3]); e.ai.next += 1; e.ai.n = 0; }
    } else if (e.state === 'burrow') {
      e.hidden = Math.min(1, e.t / 0.4); e.untargetable = true; stop(e, dt, 8);
      if (e.t >= P.burrowTime * k) {
        const t = randomPlayer(world);
        e.ai.tx = t.x; e.ai.ty = t.y;
        world.strike({ shape: 'circle', x: t.x, y: t.y, r: P.emergeRadius, dur: P.emergeTelegraph * k, mult: 1.4, owner: e, tone: 'ice' });
        setState(e, 'emerge');
      }
    } else if (e.state === 'emerge') {
      if (e.t >= P.emergeTelegraph * k) {
        e.x = e.ai.tx; e.y = e.ai.ty; e.hidden = 0; e.untargetable = false; world.shake(10, 0.35); world.sfx('slam');
        world.particles.burst(e.x, e.y, 30, { color: ['#e8f8ff', '#8fc4e8', '#ffffff'], speedMin: 120, speedMax: 340, life: 0.7, size: 6, drag: 3, shape: 1 });
        e.ai.n += 1;
        if (e.enraged && e.ai.n < 2) setState(e, 'burrow'); else setState(e, 'rest');
      }
    } else if (e.state === 'breath') {
      stop(e, dt, 10);
      if (e.t < dt * 1.5) { e.ai.dir = toward(e, p); world.strike({ shape: 'cone', x: e.x, y: e.y - 30, angle: e.ai.dir, r: P.breathRange, arc: P.breathArc, dur: P.breathTelegraph * k, mult: 1.3, owner: e, tone: 'ice', then: { pool: { kind: 'ice', r: 110, dur: 4, along: true } } }); world.sfx('telegraph'); }
      telegraphWarn(e, e.t / (P.breathTelegraph * k));
      if (e.t >= P.breathTelegraph * k + 0.3) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'ring') {
      stop(e, dt, 10); telegraphWarn(e, e.t / (0.8 * k));
      if (e.t >= 0.8 * k) {
        e.warn = 0;
        const n = P.ringCount + (e.enraged ? 6 : 0), off = world.rng.next() * TAU;
        for (let i = 0; i < n; i++) world.shoot(e, { x: e.x, y: e.y - 50, angle: off + (i / n) * TAU, speed: P.shotSpeed, r: 10, mult: 0.7, kind: 'shard' });
        world.sfx('crit'); setState(e, 'rest');
      }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'walk');
    }
  },

  // Hydra of the Mire: three heads spit in turn; it sinks and resurfaces with rings of toxic waves.
  hydra(e, dt, world) {
    const P = e.type.ai_params;
    e.vx = 0; e.vy = 0;
    const k = e.enraged ? 0.75 : 1;
    enrage(e, world, 'ไฮดราแตกพิษ!', () => { for (let i = 0; i < 3; i++) world.spawnEnemy(P.summon, e.x + (i - 1) * 140, e.y + 120); });
    if (e.state === 'idle') { setState(e, 'spit'); e.ai.n = 0; e.ai.cycle = 0; }
    if (e.state === 'spit') {
      if (e.t >= P.spitEvery * k) {
        e.t = 0;
        const t = randomPlayer(world), head = e.ai.n % 3, hx = e.x + (head - 1) * 60, hy = e.y - 110 - (head === 1 ? 20 : 0);
        world.shoot(e, { x: hx, y: hy, angle: Math.atan2(t.y - 20 - hy, t.x - hx), speed: P.spitSpeed, r: 12, mult: 0.8, kind: 'poison', pool: { kind: 'poison', r: 55, dur: 3 } });
        world.sfx('dash'); e.ai.n += 1;
        if (e.ai.n >= P.volley) { setState(e, 'submerge'); e.ai.n = 0; }
      }
    } else if (e.state === 'submerge') {
      e.hidden = Math.min(1, e.t / 0.5); e.untargetable = true;
      if (e.t >= P.submergeTime * k) {
        const t = randomPlayer(world), a = world.rng.next() * TAU;
        const at = inArena(world, t.x + Math.cos(a) * 200, t.y + Math.sin(a) * 150, 160);
        e.x = at.x; e.y = at.y; e.hidden = 0; e.untargetable = false;
        world.shake(8, 0.3); world.sfx('slam');
        P.waveRadii.forEach((r, i) => world.strike({ shape: 'ring', x: e.x, y: e.y, r, inner: r - 70, dur: P.waveTelegraph + i * P.waveGap, mult: 1, owner: e, tone: 'poison' }));
        setState(e, 'waves');
      }
    } else if (e.state === 'waves') {
      if (e.t >= P.waveTelegraph + P.waveRadii.length * P.waveGap) setState(e, 'spit');
    }
  },

  // Umbral Knight: three chained shadow slashes (Z pattern), a darkness pulse, shadow clones when enraged.
  umbral_knight(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'เงาจันทร์ดับคลั่ง!', () => { world.spawnEnemy(P.summon, e.x - 120, e.y); world.spawnEnemy(P.summon, e.x + 120, e.y); });
    if (e.state === 'idle') { setState(e, 'stalk'); e.ai.next = 0; }
    if (e.state === 'stalk') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.t >= 1.2 * k) {
        if (e.ai.next % 2 === 0) { setState(e, 'slashes'); e.ai.n = 0; e.ai.armed = false; }
        else { setState(e, 'pulse'); world.strike({ shape: 'circle', x: e.x, y: e.y - 10, r: P.pulseRadius, dur: P.pulseTelegraph * k, mult: 1.3, owner: e, tone: 'shadow' }); world.sfx('telegraph'); }
        e.ai.next += 1;
      }
    } else if (e.state === 'slashes') {
      if (!e.ai.armed) {
        const t = randomPlayer(world);
        // step behind the target, then slash through
        if (e.ai.n === 0) { const at = inArena(world, t.x - Math.cos(toward(e, t)) * 260, t.y - Math.sin(toward(e, t)) * 200); world.particles.burst(e.x, e.y - 40, 20, { color: ['#2a2438', '#c27ff0'], speedMin: 60, speedMax: 200, life: 0.4, size: 5, drag: 3 }); e.x = at.x; e.y = at.y; world.sfx('blink'); }
        e.ai.dir = toward(e, t); e.ai.armed = true; e.ai.go = false; e.t = 0;
        world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: P.slashLen, width: P.slashWidth, dur: P.slashTelegraph * k, mult: 1.3, owner: e, tone: 'shadow' });
        world.sfx('telegraph');
      }
      if (!e.ai.go) { stop(e, dt, 12); telegraphWarn(e, e.t / (P.slashTelegraph * k)); if (e.t >= P.slashTelegraph * k) { e.ai.go = true; e.t = 0; e.warn = 0; world.sfx('swing'); } }
      else {
        const sp = P.slashLen / 0.22;
        e.vx = Math.cos(e.ai.dir) * sp; e.vy = Math.sin(e.ai.dir) * sp;
        if (e.t >= 0.22) { e.vx *= 0.1; e.vy *= 0.1; e.ai.n += 1; e.ai.armed = false; if (e.ai.n >= P.slashes) setState(e, 'rest'); }
      }
    } else if (e.state === 'pulse') {
      stop(e, dt, 10); telegraphWarn(e, e.t / (P.pulseTelegraph * k));
      if (e.t >= P.pulseTelegraph * k) { e.warn = 0; world.shake(10, 0.4); world.sfx('slam'); world.darkPulse?.(2.5); setState(e, 'rest'); }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'stalk');
    }
  },

  // Sphinx Colossus: a sweeping beam (rotating lane), sand pillars on a grid, two beams when enraged.
  sphinx(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    e.vx = 0; e.vy = 0;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'ดวงตาแห่งทะเลทรายลืมขึ้น!');
    if (e.state === 'idle') { setState(e, 'gaze'); e.ai.next = 0; }
    if (e.state === 'gaze') {
      if (e.t >= 1.1 * k) { setState(e, e.ai.next % 2 ? 'pillars' : 'beam'); e.ai.next += 1; e.ai.step = 0; }
    } else if (e.state === 'beam') {
      // the beam sweeps across an arc: each step is its own lane, shown ahead of time in sequence
      if (e.ai.step === 0) { e.ai.base = toward(e, p) - (P.beamSweep / 2) * (e.ai.next % 4 < 2 ? 1 : -1); e.ai.sign = e.ai.next % 4 < 2 ? 1 : -1; }
      const every = 0.12;
      while (e.ai.step < P.beamSteps && e.t >= e.ai.step * every) {
        const a = e.ai.base + e.ai.sign * (P.beamSweep * e.ai.step) / (P.beamSteps - 1);
        for (const off of e.enraged ? [0, Math.PI] : [0]) world.strike({ shape: 'line', x: e.x, y: e.y - 60, angle: a + off, len: P.beamLen, width: P.beamWidth, dur: P.beamTelegraph * k, mult: 1, owner: e, tone: 'sun' });
        e.ai.step += 1;
      }
      telegraphWarn(e, Math.min(1, e.t / (P.beamTelegraph * k)));
      if (e.t >= P.beamTelegraph * k + P.beamSteps * every) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'pillars') {
      if (e.t < dt * 1.5) {
        const A = world.arena;
        for (let i = 0; i < P.pillarCount; i++) {
          const t = i < world.players.length ? world.players[i] : { x: 140 + world.rng.next() * (A.w - 280), y: 200 + world.rng.next() * (A.h - 320) };
          world.strike({ shape: 'circle', x: t.x, y: t.y, r: P.pillarRadius, dur: P.pillarTelegraph * k + i * 0.08, mult: 1.2, owner: e, tone: 'earth', then: { pool: { kind: 'sand', r: P.pillarRadius, dur: 3, mult: 0 } } });
        }
        world.sfx('telegraph');
      }
      if (e.t >= P.pillarTelegraph * k + 0.6) setState(e, 'rest');
    } else if (e.state === 'rest') {
      if (e.t >= P.rest * k) setState(e, 'gaze');
    }
  },

  // Mother Morel: a rotating spiral of spores, a rain of spore bursts, and mushroom children.
  morel(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'ราชินีเห็ดแตกสปอร์!', () => { for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 160 : -160), e.y + 60); });
    e.ai.z = 34 + Math.sin(world.time * 1.8) * 8;
    if (e.state === 'idle') { setState(e, 'drift'); e.ai.next = 0; }
    if (e.state === 'drift') {
      const at = inArena(world, world.arena.w / 2 + Math.cos(world.time * 0.5) * 220, world.arena.h / 2 - 40 + Math.sin(world.time * 0.7) * 120, 160);
      steer(e, Math.atan2(at.y - e.y, at.x - e.x), e.type.speed, dt, 2);
      if (e.t >= 1.3 * k) { setState(e, e.ai.next % 2 ? 'rain' : 'spiral'); e.ai.next += 1; e.ai.acc = 0; e.ai.rot = world.rng.next() * TAU; }
    } else if (e.state === 'spiral') {
      stop(e, dt, 6);
      e.ai.acc += dt;
      while (e.ai.acc >= P.spiralRate * k) {
        e.ai.acc -= P.spiralRate * k; e.ai.rot += 0.23;
        const arms = P.spiralArms + (e.enraged ? 1 : 0);
        for (let i = 0; i < arms; i++) world.shoot(e, { x: e.x, y: e.y - 70, angle: e.ai.rot + (i / arms) * TAU, speed: P.spiralSpeed, r: 9, mult: 0.55, kind: 'spore' });
      }
      if (e.t >= P.spiralTime) setState(e, 'rest');
    } else if (e.state === 'rain') {
      stop(e, dt, 6);
      if (e.t < dt * 1.5) {
        for (let i = 0; i < P.rainCount; i++) {
          const t = i < world.players.length ? world.players[i] : null;
          const at = t ? { x: t.x, y: t.y } : inArena(world, 120 + world.rng.next() * (world.arena.w - 240), 180 + world.rng.next() * (world.arena.h - 300));
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.rainRadius, dur: P.rainTelegraph * k + i * 0.07, mult: 0.9, owner: e, tone: 'spore', then: { pool: { kind: 'poison', r: P.rainRadius * 0.8, dur: 2.5, mult: 0.2 } } });
        }
        world.sfx('telegraph');
      }
      if (e.t >= P.rainTelegraph * k + 1) setState(e, 'rest');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'drift');
    }
  },

  // Tesla Titan: plants pylons, arcs lightning between them, sends out expanding shock rings, overloads up close.
  tesla(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'ไททันโอเวอร์โหลด!');
    const pylons = () => world.enemies.filter((x) => x.id === 'z_pylon' && !x.dead);
    if (e.state === 'idle') { setState(e, 'plant'); e.ai.next = 0; }
    if (e.state === 'plant') {
      stop(e, dt, 8);
      const have = pylons().length;
      const A = world.arena;
      for (let i = have; i < P.pylons; i++) { const a = (i / P.pylons) * TAU + world.rng.next(); const at = inArena(world, A.w / 2 + Math.cos(a) * 330, A.h / 2 + Math.sin(a) * 230, 120); world.spawnEnemy('z_pylon', at.x, at.y); }
      setState(e, 'walk');
    } else if (e.state === 'walk') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.contactCd <= 0 && dist(e, p) < e.r + p.r) { const a = toward(e, p); if (world.hitPlayer(e, 0.6, Math.cos(a) * 300, Math.sin(a) * 300)) e.contactCd = 1; }
      if (e.t >= 1.3 * k) {
        const moves = ['chain', 'rings', dist(e, p) < P.overloadRadius + 60 ? 'overload' : 'chain'];
        setState(e, moves[e.ai.next % 3]); e.ai.next += 1;
        if (e.state === 'chain' && !pylons().length) setState(e, 'plant');
      }
    } else if (e.state === 'chain') {
      stop(e, dt, 8);
      if (e.t < dt * 1.5) {
        const nodes = [e, ...pylons()];
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i], b = nodes[(i + 1) % nodes.length];
          if (a === b) continue;
          world.strike({ shape: 'line', x: a.x, y: a.y - 30, angle: Math.atan2(b.y - a.y, b.x - a.x), len: Math.hypot(b.x - a.x, b.y - a.y), width: P.chainWidth, dur: P.chainTelegraph * k, mult: 1.1, owner: e, tone: 'volt' });
        }
        world.sfx('telegraph');
      }
      telegraphWarn(e, e.t / (P.chainTelegraph * k));
      if (e.t >= P.chainTelegraph * k + 0.2) { e.warn = 0; world.sfx('crit'); setState(e, 'rest'); }
    } else if (e.state === 'rings') {
      stop(e, dt, 8);
      if (e.t < dt * 1.5) { P.ringRadii.forEach((r, i) => world.strike({ shape: 'ring', x: e.x, y: e.y, r, inner: r - 60, dur: P.ringTelegraph * k + i * P.ringGap, mult: 0.95, owner: e, tone: 'volt' })); world.sfx('telegraph'); }
      if (e.t >= P.ringTelegraph * k + P.ringRadii.length * P.ringGap) setState(e, 'rest');
    } else if (e.state === 'overload') {
      stop(e, dt, 10);
      if (e.t < dt * 1.5) { world.strike({ shape: 'circle', x: e.x, y: e.y - 10, r: P.overloadRadius, dur: 0.9 * k, mult: 1.5, owner: e, tone: 'volt' }); world.sfx('telegraph'); }
      telegraphWarn(e, e.t / (0.9 * k));
      if (e.t >= 0.9 * k) { e.warn = 0; world.shake(10, 0.4); setState(e, 'rest'); }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'walk');
    }
  },

  // Rift Drake: sweeping fire breath, meteor shower, a charge; when enraged it takes to the sky and rains fire.
  drake(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'มังกรรอยแยกบินขึ้นฟ้า!', () => { setState(e, 'flight'); });
    if (e.state === 'idle') { setState(e, 'prowl'); e.ai.next = 0; }
    if (e.state === 'prowl') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.t >= 1.2 * k) { setState(e, ['breath', 'charge', 'meteors'][e.ai.next % 3]); e.ai.next += 1; e.ai.step = 0; }
    } else if (e.state === 'breath') {
      stop(e, dt, 8);
      if (e.ai.step === 0) { e.ai.base = toward(e, p) - 0.8; e.ai.sign = 1; }
      const every = 0.13;
      while (e.ai.step < P.breathSteps && e.t >= e.ai.step * every) {
        const a = e.ai.base + e.ai.sign * (1.6 * e.ai.step) / (P.breathSteps - 1);
        world.strike({ shape: 'cone', x: e.x, y: e.y - 40, angle: a, r: P.breathRange, arc: P.breathArc / 2, dur: P.breathTelegraph * k, mult: 0.9, owner: e, fire: true, tone: 'fire' });
        e.ai.step += 1;
      }
      telegraphWarn(e, e.t / (P.breathTelegraph * k));
      if (e.t >= P.breathTelegraph * k + P.breathSteps * every) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'charge') {
      if (e.ai.step === 0) { e.ai.dir = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.dir, len: P.chargeSpeed * P.chargeTime, width: e.r * 2, dur: 0.8 * k, mult: 1.3, owner: e, tone: 'fire' }); world.sfx('telegraph'); e.ai.step = 1; }
      if (e.ai.step === 1) { stop(e, dt, 10); telegraphWarn(e, e.t / (0.8 * k)); if (e.t >= 0.8 * k) { e.ai.step = 2; e.t = 0; e.warn = 0; world.sfx('roar'); } }
      else if (e.ai.step === 2) {
        e.vx = Math.cos(e.ai.dir) * P.chargeSpeed; e.vy = Math.sin(e.ai.dir) * P.chargeSpeed;
        if (world.rng.next() < dt * 20) world.pool({ x: e.x, y: e.y, r: 40, dur: 2.5, kind: 'fire', mult: 0.3 });
        if (e.t >= P.chargeTime) { e.vx *= 0.15; e.vy *= 0.15; setState(e, 'rest'); }
      }
    } else if (e.state === 'meteors' || e.state === 'flight') {
      const flying = e.state === 'flight';
      if (flying) { e.untargetable = e.t < 3.2; e.hidden = e.t < 3.2 ? 0.6 : 0; e.ai.z = e.t < 3.2 ? 120 : 0; }
      stop(e, dt, 6);
      if (e.t < dt * 1.5 || (flying && Math.abs(e.t - 1.6) < dt)) {
        const n = P.meteorCount + (flying ? 4 : 0);
        for (let i = 0; i < n; i++) {
          const t = i < world.players.length ? world.players[i] : null;
          const at = t ? { x: t.x, y: t.y } : inArena(world, 120 + world.rng.next() * (world.arena.w - 240), 180 + world.rng.next() * (world.arena.h - 300));
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.meteorRadius, dur: P.meteorTelegraph * k + i * 0.09, mult: 1, owner: e, fire: true, tone: 'fire', then: { pool: { kind: 'fire', r: P.meteorRadius * 0.7, dur: 2.5, mult: 0.3 } }, meteor: true });
        }
        world.sfx('roar');
      }
      if (e.t >= (flying ? 3.4 : P.meteorTelegraph * k + 1.2)) { e.untargetable = false; e.hidden = 0; e.ai.z = 0; setState(e, 'rest'); }
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'prowl');
    }
  },

  // Seraph Warden: cross beams (+ then ×), spinning blade wheels, a burst of petals with gaps to slip through.
  seraph(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const k = e.enraged ? 0.8 : 1;
    enrage(e, world, 'ปีกเทวะกางเต็ม!');
    e.ai.z = 30 + Math.sin(world.time * 2) * 6;
    if (e.state === 'idle') { setState(e, 'glide'); e.ai.next = 0; }
    if (e.state === 'glide') {
      const at = inArena(world, p.x + Math.cos(world.time) * 240, p.y - 140, 140);
      steer(e, Math.atan2(at.y - e.y, at.x - e.x), e.type.speed, dt, 2);
      if (e.t >= 1.2 * k) { setState(e, ['cross', 'wheels', 'petals'][e.ai.next % 3]); e.ai.next += 1; e.ai.step = 0; }
    } else if (e.state === 'cross') {
      stop(e, dt, 8);
      const sets = e.enraged ? [0, Math.PI / 4] : [e.ai.next % 2 ? Math.PI / 4 : 0];
      if (e.ai.step === 0) {
        sets.forEach((off, si) => { for (let i = 0; i < 4; i++) world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: off + (i * Math.PI) / 2, len: P.beamLen, width: P.beamWidth, dur: P.beamTelegraph * k + si * 0.6, mult: 1.1, owner: e, tone: 'holy' }); });
        e.ai.step = 1; world.sfx('telegraph');
      }
      telegraphWarn(e, e.t / (P.beamTelegraph * k));
      if (e.t >= P.beamTelegraph * k + sets.length * 0.6) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'wheels') {
      stop(e, dt, 8);
      if (e.t < dt * 1.5) { for (let i = 0; i < P.wheels; i++) world.shoot(e, { x: e.x, y: e.y - 30, angle: (i / P.wheels) * TAU, speed: 0, r: 24, mult: 0.9, kind: 'wheel', life: P.wheelLife, pierce: true, orbit: { cx: e.x, cy: e.y - 30, r0: 40, grow: 70, spin: 1.6 * (e.enraged ? 1.3 : 1) } }); world.sfx('cast'); }
      if (e.t >= 1.4) setState(e, 'rest');
    } else if (e.state === 'petals') {
      stop(e, dt, 8); telegraphWarn(e, e.t / (0.7 * k));
      if (e.t >= 0.7 * k && e.ai.step < 3) {
        const n = P.petalCount, off = e.ai.step * 0.16 + world.rng.next() * 0.1;
        for (let i = 0; i < n; i++) { if (i % 5 === e.ai.step) continue; world.shoot(e, { x: e.x, y: e.y - 40, angle: off + (i / n) * TAU, speed: P.petalSpeed, r: 9, mult: 0.6, kind: 'petal' }); }
        world.sfx('bow'); e.ai.step += 1; e.t = 0.45 * k; e.warn = 0;
      }
      if (e.ai.step >= 3 && e.t >= 1) setState(e, 'rest');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'glide');
    }
  },

  // Ash Sovereign: three phases. Sword waves → + summons and homing orbs → + the arena closes in with fire rings.
  sovereign(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const phase = e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3;
    if (phase !== e.ai.phase) {
      if (e.ai.phase) { world.announce(phase === 2 ? 'จักรพรรดิเรียกวิญญาณเถ้า!' : 'บัลลังก์ลุกเป็นไฟ!'); world.sfx('roar'); world.shake(12, 0.6); }
      if (phase === 2) for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 160 : -160), e.y + 40);
      if (phase === 3) { e.enraged = true; for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 200 : -200), e.y); }
      e.ai.phase = phase;
    }
    const k = phase === 3 ? 0.75 : phase === 2 ? 0.88 : 1;
    if (e.state === 'idle') { setState(e, 'advance'); e.ai.next = 0; }
    if (e.state === 'advance') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.contactCd <= 0 && dist(e, p) < e.r + p.r) { const a = toward(e, p); if (world.hitPlayer(e, 0.6, Math.cos(a) * 320, Math.sin(a) * 320)) e.contactCd = 1; }
      if (e.t >= 1.1 * k) {
        const pool = phase === 1 ? ['waves'] : phase === 2 ? ['waves', 'orbs'] : ['waves', 'orbs', 'closing'];
        setState(e, pool[e.ai.next % pool.length]); e.ai.next += 1; e.ai.step = 0;
      }
    } else if (e.state === 'waves') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const base = toward(e, p), n = P.waveFan + (phase === 3 ? 2 : 0);
        for (let i = 0; i < n; i++) world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: base - P.waveSpread / 2 + (P.waveSpread * i) / (n - 1), len: P.waveLen, width: P.waveWidth, dur: P.waveTelegraph * k + (i % 2) * 0.35, mult: 1.15, owner: e, fire: true, tone: 'fire' });
        e.ai.step = 1; world.sfx('telegraph');
      }
      telegraphWarn(e, e.t / (P.waveTelegraph * k));
      if (e.t >= P.waveTelegraph * k + 0.5) { e.warn = 0; world.sfx('swing'); setState(e, 'rest'); }
    } else if (e.state === 'orbs') {
      stop(e, dt, 10); telegraphWarn(e, e.t / (0.7 * k));
      if (e.t >= 0.7 * k) {
        e.warn = 0;
        for (let i = 0; i < P.orbCount; i++) world.shoot(e, { x: e.x, y: e.y - 60, angle: (i / P.orbCount) * TAU, speed: P.orbSpeed, r: 12, mult: 0.8, kind: 'orb', homing: 1.2, life: 5, fire: true });
        world.sfx('cast'); setState(e, 'rest');
      }
    } else if (e.state === 'closing') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const A = world.arena, cx = A.w / 2, cy = A.h / 2;
        [560, 470, 380].forEach((r, i) => world.strike({ shape: 'ring', x: cx, y: cy, r: r + 400, inner: r, dur: P.ringTelegraph + i * 0.7, mult: 1.2, owner: e, fire: true, tone: 'fire' }));
        e.ai.step = 1; world.sfx('roar'); world.announce('วงไฟบีบเข้ามา! เข้ากลางสนาม');
      }
      if (e.t >= P.ringTelegraph + 2.2) setState(e, 'rest');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'advance');
    }
  },
});

export const ZONE_BEHAVIOURS_READY = true;
