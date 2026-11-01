// Enemy entities and their behaviours. Every attack is telegraphed (wind-up flash or danger zone)
// so the player can always react. New behaviours plug in through BEHAVIOURS without touching the scene.
import { getEnemy } from '../data/enemies.js';
import { BALANCE } from '../config/balance.js';

export function createEnemy(id, x, y, levelScale = 1) {
  const def = getEnemy(id);
  if (!def) throw new Error(`unknown enemy "${id}"`);
  // v9.1: a little easier everywhere (BALANCE.pve) — one place covers story, zones, raids, tower, rift and online hunts
  const E = BALANCE.pve || {}, hpK = (def.boss ? E.bossHp : E.monHp) ?? 1, atkK = (def.boss ? E.bossAtk : E.monAtk) ?? 1;
  const hp = Math.max(1, Math.round(def.hp * levelScale * hpK));
  return {
    type: def, id, x, y, vx: 0, vy: 0, r: def.radius,
    hp, maxHp: hp,
    atk: def.atk * levelScale * atkK, def: def.def, crit: 0, critMult: 1.5,
    state: 'idle', t: 0, flash: 0, dead: false, deathT: 0, rewarded: false,
    spawning: 0.7, flip: false, sx: 1, sy: 1, hitstun: 0, hitThisAttack: false,
    ai: {}, contactCd: 0, enraged: false,
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);

function steer(e, angle, speed, dt, k = 6) {
  const tx = Math.cos(angle) * speed, ty = Math.sin(angle) * speed;
  const f = Math.min(1, dt * k);
  e.vx += (tx - e.vx) * f; e.vy += (ty - e.vy) * f;
}

function setState(e, s) { e.state = s; e.t = 0; e.hitThisAttack = false; }

// Contact damage during an attack — at most once per attack.
function tryHit(e, world, mult = 1, range = 0) {
  if (e.hitThisAttack) return;
  const p = world.player;
  if (dist(e, p) <= e.r + p.r + range) {
    const a = toward(e, p);
    if (world.hitPlayer(e, mult, Math.cos(a) * 320, Math.sin(a) * 320)) e.hitThisAttack = true;
  }
}

export const BEHAVIOURS = {
  // Bouncy blob: waits, then hops at the player. Hurts on landing contact.
  hopper(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') { setState(e, 'wait'); e.ai.wait = P.hopEvery * (0.6 + world.rng.next() * 0.8); }
    if (e.state === 'wait') {
      steer(e, toward(e, p), e.type.speed * 0.35, dt);
      e.sy = 1 - 0.12 * Math.min(1, e.t / e.ai.wait); e.sx = 2 - e.sy;
      if (e.t >= e.ai.wait) { setState(e, 'hop'); e.ai.dir = toward(e, p); }
    } else if (e.state === 'hop') {
      steer(e, e.ai.dir, P.hopSpeed, dt, 12);
      const k = e.t / P.hopTime;
      e.sy = 1.15 - 0.15 * k; e.sx = 2 - e.sy;
      e.ai.z = Math.sin(Math.min(1, k) * Math.PI) * 26;
      tryHit(e, world, 1, P.contactRange - e.r - p.r);
      if (e.t >= P.hopTime) { setState(e, 'wait'); e.ai.wait = P.hopEvery * (0.6 + world.rng.next() * 0.8); e.ai.z = 0; e.sx = 1.25; e.sy = 0.78; world.particles.burst(e.x, e.y, 5, { color: ['#4b6e33', '#a5c76c'], speedMin: 30, speedMax: 90, life: 0.35, size: 3, drag: 4 }); }
    }
  },

  // Quick melee goblin: approaches, flashes a wind-up, then lunges in a locked direction.
  skirmisher(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (e.state === 'idle') setState(e, 'approach');
    if (e.state === 'approach') {
      const d = dist(e, p);
      const a = toward(e, p) + Math.sin(world.time * 2 + e.x) * 0.35;
      steer(e, a, e.type.speed, dt);
      if (d < P.strikeRange + e.r + p.r) { setState(e, 'windup'); e.ai.dir = toward(e, p); world.sfx('telegraph'); }
    } else if (e.state === 'windup') {
      steer(e, 0, 0, dt, 10);
      e.ai.dir = toward(e, p) * 0.15 + e.ai.dir * 0.85; // slight tracking only early
      e.warn = Math.min(1, e.t / P.windup);
      e.sx = 1 + 0.15 * e.warn; e.sy = 1 - 0.12 * e.warn;
      if (e.t >= P.windup) { setState(e, 'lunge'); e.warn = 0; }
    } else if (e.state === 'lunge') {
      steer(e, e.ai.dir, P.lungeSpeed, dt, 20);
      e.sx = 0.85; e.sy = 1.15;
      tryHit(e, world, 1);
      if (e.t >= P.lungeTime) setState(e, 'recover');
    } else if (e.state === 'recover') {
      steer(e, toward(e, p) + Math.PI, e.type.speed * 0.4, dt);
      e.sx += (1 - e.sx) * dt * 8; e.sy += (1 - e.sy) * dt * 8;
      if (e.t >= P.recover) setState(e, 'approach');
    }
  },

  // Boss: chase → telegraphed charge → rest → telegraphed ground quake. Faster when enraged (< 50% hp).
  boar(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    const speedUp = e.enraged ? 0.75 : 1;
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true; world.sfx('roar'); world.shake(10, 0.5);
      world.announce('หมูป่าคลั่ง!');
      for (let i = 0; i < 2; i++) world.spawnEnemy('mossling', e.x + (i ? 90 : -90), e.y + 40);
    }
    if (e.state === 'idle') { setState(e, 'chase'); e.ai.next = 'charge'; }
    if (e.state === 'chase') {
      steer(e, toward(e, p), e.type.speed * (e.enraged ? 1.25 : 1), dt, 3);
      if (e.contactCd <= 0 && dist(e, p) < e.r + p.r) {
        const a = toward(e, p);
        if (world.hitPlayer(e, 0.6, Math.cos(a) * 260, Math.sin(a) * 260)) e.contactCd = 1;
      }
      if (e.t > 1.6 * speedUp) {
        if (e.ai.next === 'charge') {
          setState(e, 'chargeWind'); e.ai.dir = toward(e, p);
          world.addHazard({ type: 'line', x: e.x, y: e.y - 20, angle: e.ai.dir, len: P.chargeSpeed * P.chargeTime, width: e.r * 2, dur: P.chargeTelegraph * speedUp, owner: e });
          world.sfx('telegraph');
        } else {
          setState(e, 'quakeWind');
          world.addHazard({ type: 'circle', x: e.x, y: e.y - 10, r: P.quakeRadius, dur: P.quakeTelegraph * speedUp, owner: e });
          world.sfx('telegraph');
        }
      }
    } else if (e.state === 'chargeWind') {
      steer(e, 0, 0, dt, 8);
      e.sx = 1 + 0.08 * Math.sin(world.time * 40); e.sy = 0.95;
      e.warn = Math.min(1, e.t / (P.chargeTelegraph * speedUp));
      if (e.t >= P.chargeTelegraph * speedUp) { setState(e, 'charge'); e.warn = 0; world.sfx('roar'); }
    } else if (e.state === 'charge') {
      e.vx = Math.cos(e.ai.dir) * P.chargeSpeed; e.vy = Math.sin(e.ai.dir) * P.chargeSpeed;
      tryHit(e, world, 1.2);
      if (world.time % 0.05 < dt) world.particles.burst(e.x, e.y, 2, { color: ['#6b5638', '#8a7350'], speedMin: 20, speedMax: 80, life: 0.5, size: 6, drag: 3 });
      const pad = (world.wallPad || 30) + 8;
      const hitWall = e.x < e.r + pad || e.x > world.arena.w - e.r - pad || e.y < e.r + pad || e.y > world.arena.h - e.r - pad;
      if (e.t >= P.chargeTime || hitWall) {
        setState(e, 'rest'); e.ai.next = 'quake'; e.vx *= 0.2; e.vy *= 0.2;
        if (hitWall) { world.shake(8, 0.3); world.sfx('slam'); e.ai.restExtra = 0.8; } else e.ai.restExtra = 0;
      }
    } else if (e.state === 'rest') {
      steer(e, 0, 0, dt, 5);
      e.sx += (1 - e.sx) * dt * 6; e.sy += (1 - e.sy) * dt * 6;
      if (e.t >= (P.restTime + (e.ai.restExtra || 0)) * speedUp) setState(e, e.ai.next === 'quake' ? 'chase' : 'chase');
    } else if (e.state === 'quakeWind') {
      steer(e, 0, 0, dt, 8);
      const k = Math.min(1, e.t / (P.quakeTelegraph * speedUp));
      e.warn = k; e.sy = 1 + 0.15 * k; e.sx = 1 - 0.08 * k; e.ai.z = 22 * k;
      if (e.t >= P.quakeTelegraph * speedUp) {
        e.ai.z = 0; e.sx = 1.3; e.sy = 0.75; e.warn = 0;
        world.shake(12, 0.4); world.sfx('slam');
        world.fx.ring(e.x, e.y - 10, 20, P.quakeRadius, '#ffb27a', 0.45, 8);
        world.particles.burst(e.x, e.y, 26, { color: ['#6b5638', '#8a7350', '#4b6e33'], speedMin: 120, speedMax: 320, life: 0.6, size: 6, drag: 3.5, shape: 1 });
        if (dist(e, p) <= P.quakeRadius + p.r) {
          const a = toward(e, p);
          world.hitPlayer(e, P.quakeMult, Math.cos(a) * 420, Math.sin(a) * 420);
        }
        setState(e, 'rest'); e.ai.next = 'charge'; e.ai.restExtra = 0;
      }
    }
  },
};

// Ranged caster: keeps its distance, flashes a wind-up, then throws a fireball at the player.
BEHAVIOURS.caster = function caster(e, dt, world) {
  const P = e.type.ai_params, p = world.player;
  if (e.state === 'idle') { setState(e, 'kite'); e.ai.cd = 0.8 + world.rng.next(); e.ai.side = world.rng.next() < 0.5 ? 1 : -1; }
  const d = dist(e, p), a = toward(e, p);
  if (e.state === 'kite') {
    e.ai.cd -= dt;
    let move = a + e.ai.side * Math.PI / 2;                 // strafe around the player
    if (d > P.keepAway + 70) move = a;                     // close in
    else if (d < P.keepAway - 70) move = a + Math.PI;      // back off
    steer(e, move, e.type.speed, dt, 4);
    if (world.rng.next() < dt * 0.4) e.ai.side *= -1;
    if (e.ai.cd <= 0 && d < 560) { setState(e, 'windup'); world.sfx('telegraph'); }
  } else if (e.state === 'windup') {
    steer(e, 0, 0, dt, 10);
    e.warn = Math.min(1, e.t / P.windup);
    if (e.t >= P.windup) {
      e.warn = 0;
      world.fireProjectile(e, e.x + Math.cos(a) * 20, e.y - 40, Math.atan2(p.y - 30 - (e.y - 40), p.x - e.x), P.shotSpeed, P.shotRadius, 1);
      world.sfx('dash');
      setState(e, 'recover'); e.ai.cd = P.cooldown * (0.8 + world.rng.next() * 0.4);
    }
  } else if (e.state === 'recover') {
    steer(e, a + Math.PI, e.type.speed * 0.5, dt, 4);
    if (e.t >= 0.4) setState(e, 'kite');
  }
};

// Boss: telegraphed slam where the player stands, then a ring of fireballs. Summons casters when enraged.
BEHAVIOURS.golem = function golem(e, dt, world) {
  const P = e.type.ai_params, p = world.player;
  const k = e.enraged ? 0.75 : 1;
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true; world.sfx('roar'); world.shake(10, 0.5); world.announce('เตาหลอมลุกโชน!');
    for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 120 : -120), e.y + 30);
  }
  if (e.state === 'idle') { setState(e, 'walk'); e.ai.next = 'slam'; }
  if (e.state === 'walk') {
    steer(e, toward(e, p), e.type.speed * (e.enraged ? 1.3 : 1), dt, 3);
    if (e.contactCd <= 0 && dist(e, p) < e.r + p.r) {
      const a = toward(e, p);
      if (world.hitPlayer(e, 0.6, Math.cos(a) * 300, Math.sin(a) * 300)) e.contactCd = 1;
    }
    if (e.t > 1.5 * k) {
      if (e.ai.next === 'slam') {
        setState(e, 'slamWind'); e.ai.tx = p.x; e.ai.ty = p.y;
        world.addHazard({ type: 'circle', x: p.x, y: p.y - 10, r: P.slamRadius, dur: P.slamTelegraph * k, owner: e });
      } else {
        setState(e, 'ringWind');
      }
      world.sfx('telegraph');
    }
  } else if (e.state === 'slamWind') {
    steer(e, 0, 0, dt, 8);
    e.warn = Math.min(1, e.t / (P.slamTelegraph * k)); e.sy = 1 + 0.12 * e.warn; e.sx = 1 - 0.06 * e.warn;
    if (e.t >= P.slamTelegraph * k) {
      e.warn = 0; e.sx = 1.25; e.sy = 0.8;
      world.shake(12, 0.4); world.sfx('slam');
      world.fx.ring(e.ai.tx, e.ai.ty - 10, 20, P.slamRadius, '#ffb27a', 0.45, 8);
      world.particles.burst(e.ai.tx, e.ai.ty - 10, 24, { color: ['#5b5450', '#ff8a3d', '#3a3330'], speedMin: 120, speedMax: 300, life: 0.6, size: 6, drag: 3.5, shape: 1 });
      if (Math.hypot(p.x - e.ai.tx, p.y - e.ai.ty) <= P.slamRadius + p.r) {
        const a = Math.atan2(p.y - e.ai.ty, p.x - e.ai.tx);
        world.hitPlayer(e, P.slamMult, Math.cos(a) * 420, Math.sin(a) * 420);
      }
      setState(e, 'rest'); e.ai.next = 'ring';
    }
  } else if (e.state === 'ringWind') {
    steer(e, 0, 0, dt, 8);
    e.warn = Math.min(1, e.t / (P.ringTelegraph * k));
    if (e.t >= P.ringTelegraph * k) {
      e.warn = 0;
      const n = P.ringCount + (e.enraged ? 4 : 0), off = world.rng.next() * Math.PI;
      for (let i = 0; i < n; i++) world.fireProjectile(e, e.x, e.y - 60, off + (i / n) * Math.PI * 2, P.shotSpeed, 12, 0.7);
      world.sfx('roar');
      setState(e, 'rest'); e.ai.next = 'slam';
    }
  } else if (e.state === 'rest') {
    steer(e, 0, 0, dt, 5);
    if (e.t >= P.restTime * k) setState(e, 'walk');
  }
};

export function updateEnemy(e, dt, world) {
  if (e.flash > 0) e.flash -= dt * 6;
  if (e.contactCd > 0) e.contactCd -= dt;
  if (e.flinchCd > 0) e.flinchCd -= dt;
  if (e.dead) { e.deathT += dt; return; }
  if (e.spawning > 0) { e.spawning = Math.max(0, e.spawning - dt); return; }
  if (e.brokenT > 0) {
    // poise broken: the boss staggers in place (timer runs in battle/status.js)
    e.vx *= Math.max(0, 1 - 6 * dt); e.vy *= Math.max(0, 1 - 6 * dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.sx = 1 + 0.06 * Math.sin(world.time * 30); e.sy = 1 - 0.05 * Math.sin(world.time * 30); e.ai.z = 0; e.warn = 0;
    if (world.clampBody) world.clampBody(e);
    return;
  }
  if (e.hitstun > 0) {
    e.hitstun -= dt;
  } else if (!e.paused) {
    // (v8: a boss trick or a held swing pauses the behaviour — battle/tricks.js)
    e.t += dt;
    const fn = BEHAVIOURS[e.type.ai];
    if (fn) fn(e, dt, world);
  }
  // friction (knockback decays)
  const fr = e.hitstun > 0 ? 6 : 0;
  if (fr) { e.vx *= Math.max(0, 1 - fr * dt); e.vy *= Math.max(0, 1 - fr * dt); }
  let sm = 1;
  if (e.slowT > 0) { e.slowT -= dt; sm = e.slowMult ?? 1; }
  if (e.sunderT > 0) e.sunderT -= dt;
  e.x += e.vx * dt * sm; e.y += e.vy * dt * sm;
  if (world.clampBody) world.clampBody(e);
  e.x = Math.max(e.r + 20, Math.min(world.arena.w - e.r - 20, e.x));
  e.y = Math.max(e.r + 30, Math.min(world.arena.h - 20, e.y));
  if (Math.abs(e.vx) > 8) e.flip = e.vx < 0;
  if (e.state !== 'hop' && e.state !== 'quakeWind') { e.sx += (1 - e.sx) * Math.min(1, dt * 5); e.sy += (1 - e.sy) * Math.min(1, dt * 5); }
}

// Pushes overlapping living enemies apart so they don't stack into one blob.
export function separate(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.dead || a.spawning > 0) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (b.dead || b.spawning > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.r + b.r) * 0.9;
      if (d > 0 && d < min) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        const ma = a.type.mass, mb = b.type.mass, t = ma + mb;
        a.x -= nx * push * (mb / t) * 2; a.y -= ny * push * (mb / t) * 2;
        b.x += nx * push * (ma / t) * 2; b.y += ny * push * (ma / t) * 2;
      }
    }
  }
}
