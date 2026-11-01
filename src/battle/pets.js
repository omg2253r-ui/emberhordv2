// The companions in a dungeon: up to three follow the hero (each in its own spot), and use their ability on a
// timer. Numbers come from data/pets.js + data/pets2.js (scaled by stars in systems/pets.js → activePets).
// Lingering effects (mines, lava trails, orbit, holy ground, rain) live on the pet itself, so every scene that
// runs pets gets them by calling updatePet / drawPetGround / drawPet.
import { nearestEnemy } from './moves.js';
import { addBuff } from './buffs.js';

// where each team member walks, relative to the hero's back (flipped with the hero)
const SLOTS = [{ dx: -62, dy: 8 }, { dx: -96, dy: -26 }, { dx: -84, dy: 44 }];

export function createPetEntity(active, x, y, slot = 0) {
  if (!active) return null;
  const s = SLOTS[slot] || SLOTS[0];
  return {
    id: active.id, pet: active.pet, v: active.v, stars: active.stars, slot,
    x: x + s.dx, y: y + s.dy, r: 14, vx: 0, vy: 0, z: active.pet.flying ? 34 : 0, t: 0, cd: Math.min(2, active.v.every || 0) + slot * 0.4,
    flip: false, state: 'follow', dash: null, hop: 0, target: null, glow: 0,
    fx: [], used: false, eaten: 0, eatT: 0, orbitA: slot * 2.1, lastTrail: 0,
  };
}
export function createPetTeam(list, x, y, player = null) {
  const team = (list || []).map((a, i) => createPetEntity(a, x, y, i)).filter(Boolean);
  if (player) player.rebirth = team.some((p) => p.v.kind === 'rebirth');
  return team;
}

const anyEnemy = (world) => world.enemies.some((e) => !e.dead && e.spawning <= 0);
const alive = (world) => world.enemies.filter((e) => !e.dead && e.spawning <= 0 && !e.untargetable && e.type.ai !== 'egypt_glyph');   // pets leave the puzzle statues alone
const burst = (world, x, y, n, color, o = {}) => world.particles.burst(x, y, n, { color, speedMin: 40, speedMax: 180, life: 0.45, size: 3, drag: 3, glow: true, ...o });

// ---------------------------------------------------------------- lingering effects
// { kind: 'mine'|'trail'|'field'|'ring'|'rain'|'beam'|'chain', x, y, r, t, life, ... }
function updateEffects(pet, dt, world) {
  const p = world.player, v = pet.v;
  for (let i = pet.fx.length - 1; i >= 0; i--) {
    const f = pet.fx[i];
    f.t += dt;
    if (f.kind === 'mine') {
      if (!f.armed && f.t > 0.5) f.armed = true;
      const trip = f.armed && alive(world).some((e) => Math.hypot(e.x - f.x, e.y - f.y) < f.r * 0.8 + e.r);
      if (trip || f.t > f.life) {
        for (const e of alive(world)) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) world.petStrike(e, v.power, { slow: v.slow, slowT: 2.2, kx: 0, ky: 0 });
        world.fx.ring(f.x, f.y, 6, f.r, '#bff0e8', 0.4, 6); burst(world, f.x, f.y, 14, ['#7fd0c0', '#e8fff8']);
        pet.fx.splice(i, 1); continue;
      }
    } else if (f.kind === 'trail') {
      f.tick = (f.tick || 0) - dt;
      if (f.tick <= 0) {
        f.tick = 0.5;
        for (const e of alive(world)) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r * 0.6) world.petStrike(e, v.power, { burn: true, kx: 0, ky: 0 });
      }
    } else if (f.kind === 'field') {
      // holy ground (qilin) or rain (whale): affects the hero standing inside, and enemies inside
      f.tick = (f.tick || 0) - dt;
      const inside = !p.dead && Math.hypot(p.x - f.x, p.y - f.y) < f.r;
      if (f.reduce && inside) addBuff(p, 'reduce', f.reduce, 0.25);
      if (f.tick <= 0) {
        f.tick = 1;
        if (f.healPct && (inside || f.follow) && !p.dead && p.hp < p.maxHp) {
          const heal = Math.max(1, Math.round(p.maxHp * f.healPct));
          p.hp = Math.min(p.maxHp, p.hp + heal); world.fx.number(p.x, p.y - 96, `+${heal}`, 'heal');
        }
        if (f.slow) for (const e of alive(world)) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) world.petStrike(e, 0.05, { slow: f.slow, slowT: 1.2, kx: 0, ky: 0 });
      }
      if (f.follow) { f.x = p.x; f.y = p.y; }
    } else if (f.kind === 'ring') {
      // expanding wave (titan quake): strikes enemies as the edge passes them
      if (f.t >= f.delay && !f.done) {
        f.done = true;
        for (const e of alive(world)) {
          const d = Math.hypot(e.x - f.x, e.y - f.y);
          if (d < f.r + e.r && d > f.inner - e.r) { const a = Math.atan2(e.y - f.y, e.x - f.x); world.petStrike(e, f.power, { stun: f.stun, kx: Math.cos(a) * 160, ky: Math.sin(a) * 160 }); }
        }
        world.fx.ring(f.x, f.y, f.inner, f.r, f.color, 0.35, 8); world.shake?.(4, 0.15);
      }
    } else if (f.kind === 'rain') {
      if (f.t >= f.delay && !f.done) {
        f.done = true;
        for (const e of alive(world)) if (Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) world.petStrike(e, f.power, { kx: 0, ky: 0 });
        world.fx.ring(f.x, f.y, 4, f.r, f.color, 0.3, 6); burst(world, f.x, f.y - 10, 12, [f.color, '#ffffff']);
      }
    }
    if (f.t >= f.life) pet.fx.splice(i, 1);
  }
}

// ---------------------------------------------------------------- the frame
export function updatePet(pet, dt, world) {
  if (!pet) return;
  const p = world.player, v = pet.v;
  pet.t += dt;
  if (pet.glow > 0) pet.glow -= dt * 2;
  updateEffects(pet, dt, world);

  // --- movement: a dash toward a target, an orbit around the hero, or follow its spot behind the hero
  if (pet.dash) {
    const D = pet.dash;
    D.t += dt;
    const k = Math.min(1, D.t / D.dur);
    const e = D.target;
    const tx = !e || e.dead ? D.x1 : e.x - Math.cos(D.a) * e.r, ty = !e || e.dead ? D.y1 : e.y;
    pet.x = D.x0 + (tx - D.x0) * k; pet.y = D.y0 + (ty - D.y0) * k;
    if (k >= 1 && !D.hit) {
      D.hit = true;
      D.onHit?.();
    }
    if (D.t > D.dur + (D.hold || 0.12)) pet.dash = null;
  } else if (v.kind === 'orbit') {
    pet.orbitA += dt * v.speed;
    const tx = p.x + Math.cos(pet.orbitA) * v.radius, ty = p.y - 6 + Math.sin(pet.orbitA) * v.radius * 0.6;
    pet.vx = (tx - pet.x) / Math.max(dt, 1e-3); pet.vy = (ty - pet.y) / Math.max(dt, 1e-3);
    pet.x = tx; pet.y = ty; pet.flip = Math.sin(pet.orbitA) > 0;
  } else {
    const s = SLOTS[pet.slot] || SLOTS[0];
    let gx = p.x + (p.flip ? -s.dx : s.dx), gy = p.y + s.dy + (pet.pet.flying ? -6 : 0);
    // the moss mouse scurries off to loot that is lying around
    if (pet.id === 'mossmouse') {
      const d = world.drops?.find((x) => x.state === 'rest');
      if (d) { gx = d.x; gy = d.y + 6; }
    }
    const dx = gx - pet.x, dy = gy - pet.y, dist = Math.hypot(dx, dy);
    const want = dist > 30 ? Math.min(560, dist * 4.2) : 0;
    const tvx = dist > 1 ? (dx / dist) * want : 0, tvy = dist > 1 ? (dy / dist) * want : 0;
    const k = Math.min(1, dt * 7);
    pet.vx += (tvx - pet.vx) * k; pet.vy += (tvy - pet.vy) * k;
    pet.x += pet.vx * dt; pet.y += pet.vy * dt;
    if (dist > 600) { pet.x = p.x + s.dx; pet.y = p.y + s.dy; }   // fell far behind (room change)
    if (Math.abs(pet.vx) > 12) pet.flip = pet.vx < 0;
    else pet.flip = p.x < pet.x;
  }
  if (!pet.pet.flying && Math.hypot(pet.vx, pet.vy) > 40) pet.hop += dt * 16;
  if (v.kind !== 'orbit') world.clampBody?.(pet);

  // --- always-on parts of some abilities
  if (v.kind === 'trail' && Math.hypot(pet.vx, pet.vy) > 30 && pet.t - pet.lastTrail > v.every) {
    pet.lastTrail = pet.t;
    pet.fx.push({ kind: 'trail', x: pet.x, y: pet.y, r: v.r, t: 0, life: v.life });
  }
  if (v.kind === 'orbit') {
    pet.cd -= dt;
    if (pet.cd <= 0) {
      let hit = false;
      for (const e of alive(world)) if (Math.hypot(e.x - pet.x, e.y - e.r * 0.5 - pet.y) < e.r + 22) { world.petStrike(e, v.power, { burn: true, kx: Math.cos(pet.orbitA + 1.57) * 120, ky: Math.sin(pet.orbitA + 1.57) * 120 }); hit = true; }
      pet.cd = hit ? v.hitEvery : 0.05;
      if (hit) { pet.glow = 0.8; burst(world, pet.x, pet.y - pet.z, 6, ['#f5d48a', '#fff3c4']); }
    }
    return;
  }
  if (v.kind === 'guardian') {
    if (!world.guardianUsed && !p.dead && p.hp > 0 && p.hp / p.maxHp < v.below) {
      world.guardianUsed = true;
      const heal = Math.round(p.maxHp * v.healPct);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const sh = Math.round(p.maxHp * v.shieldPct);
      p.shield = Math.max(p.shield, sh); p.shieldMax = Math.max(p.shieldMax, sh); p.shieldT = Math.max(p.shieldT, 8);
      p.iframes = Math.max(p.iframes, 0.8);
      pet.x = p.x - 20; pet.y = p.y + 4; pet.glow = 1.5;
      world.fx.number(p.x, p.y - 96, `+${heal}`, 'heal'); world.fx.callout?.(p.x, p.y - 130, 'อ้อมกอดหิน!', '#9fffd8');
      world.fx.ring(p.x, p.y - 30, 20, 110, '#9fffd8', 0.6, 8); world.sfx?.('potion');
    }
    return;
  }
  if (v.kind === 'absorb') {
    pet.eatT -= dt;
    if (pet.eatT <= 0) { pet.eaten = 0; pet.eatT = 6; }
    if (pet.eaten < v.max && world.eatShots) {
      const n = world.eatShots(p.x, p.y - 20, v.r, v.max - pet.eaten);
      if (n > 0) { pet.eaten += n; pet.glow = 1; world.fx.ring(p.x, p.y - 20, 10, v.r, '#9fffd8', 0.35, 4); world.sfx?.('block'); }
    }
    return;
  }

  // --- timed abilities
  if (v.kind === 'passive' || v.kind === 'trail') return;
  pet.cd -= dt;
  if (pet.cd > 0) return;
  if (cast(pet, world) === false) return;
  // a hero on a long combo makes the drake breathe twice as often
  const fast = pet.id === 'drake' && world.combo?.n >= 20;
  pet.cd = v.every * (fast ? 0.5 : 1);
}

// Uses the ability once. Returns false when there was nothing to do (it tries again shortly).
function cast(pet, world) {
  const p = world.player, v = pet.v;
  const fighting = anyEnemy(world);
  const wait = (t = 0.3) => { pet.cd = t; return false; };
  const from = { x: pet.x, y: pet.y - pet.z };
  switch (v.kind) {
    case 'heal': {
      if (p.hp >= p.maxHp || p.dead) return wait(0.5);
      const heal = Math.max(1, Math.round(p.maxHp * v.healPct));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      world.fx.number(p.x, p.y - 96, `+${heal}`, 'heal');
      burst(world, pet.x, pet.y - pet.z, 10, ['#ffd889', '#fff3c4'], { speedMin: 30, speedMax: 100, life: 0.6, drag: 2, grav: -60 });
      pet.glow = 1;
      return true;
    }
    case 'shield': {
      if (!fighting) return wait(0.5);
      const amt = Math.round(p.maxHp * v.shieldPct);
      if (p.shield < amt) { p.shield = amt; p.shieldMax = amt; }
      p.shieldT = Math.max(p.shieldT, v.duration);
      world.fx.ring(p.x, p.y - 30, 50, 22, '#b8a48a', 0.4, 6);
      pet.glow = 1;
      return true;
    }
    case 'bless': {
      if (!fighting) return wait(0.5);
      p.buffs.blessT = v.duration; p.buffs.bless = v.atkPct;
      world.fx.ring(p.x, p.y - 40, 10, 60, '#ffb35a', 0.5, 5);
      burst(world, p.x, p.y - 50, 14, ['#ffb35a', '#fff3c4'], { speedMin: 30, speedMax: 120, life: 0.6, drag: 2, grav: -60 });
      pet.glow = 1;
      return true;
    }
    case 'bolt': {
      const e = nearestEnemy(world, pet, v.range);
      if (!e) return wait();
      const a = Math.atan2(e.y - e.r - from.y, e.x - pet.x);
      world.firePlayerShot({ kind: 'feather', x: from.x, y: from.y, angle: a, speed: 560, r: 8, pierce: 0, homing: 4, power: v.power, src: 'pet', kb: 60 });
      pet.flip = Math.cos(a) < 0; pet.glow = 0.6;
      return true;
    }
    case 'bite': case 'venom': {
      const e = nearestEnemy(world, pet, v.range);
      if (!e) return wait();
      const a = Math.atan2(e.y - pet.y, e.x - pet.x);
      const venom = v.kind === 'venom';
      pet.dash = { t: 0, dur: 0.18, x0: pet.x, y0: pet.y, x1: e.x, y1: e.y, a, target: e, hit: false,
        onHit: () => {
          if (e.dead) return;
          world.petStrike(e, v.power, { kx: Math.cos(a) * 120, ky: Math.sin(a) * 120, mark: v.mark, markT: v.markT, burn: venom });
          burst(world, e.x, e.y - e.r, 10, venom ? ['#e8ff9a', '#4a9a6a'] : ['#c8d2f4', '#ffffff'], { speedMin: 60, speedMax: 200, life: 0.3 });
        } };
      pet.flip = Math.cos(a) < 0;
      return true;
    }
    case 'breath': {
      const e = nearestEnemy(world, pet, v.range + 60);
      if (!e) return wait();
      const arc = (v.arc * Math.PI) / 180;
      world.addCone({ from: () => (e.dead && world.enemies.indexOf(e) < 0 ? null : { x: pet.x, y: pet.y - pet.z - 10, dir: Math.atan2(e.y - e.r - (pet.y - pet.z - 10), e.x - pet.x) }),
        range: v.range, arc, ticks: v.ticks, interval: 0.2, power: v.power, src: 'pet', t: 0, n: 0 });
      pet.flip = e.x < pet.x; pet.glow = 1;
      return true;
    }
    // ---------------------------------------------------------------- v7
    case 'spit': case 'fan': case 'foxfire': {
      const e = nearestEnemy(world, pet, v.kind === 'foxfire' ? 520 : 420);
      if (!e) return wait();
      const base = Math.atan2(e.y - e.r - from.y, e.x - pet.x);
      const n = v.count;
      for (let i = 0; i < n; i++) {
        let a, o;
        if (v.kind === 'foxfire') { a = (i / n) * Math.PI * 2; o = { kind: 'bolt', speed: 300, r: 8, pierce: 0, homing: 5, life: 2.2, tint: ['127,159,255', '#e8eeff'] }; }
        else if (v.kind === 'fan') { a = base + (n > 1 ? ((i / (n - 1)) - 0.5) * (v.spread * Math.PI / 180) : 0); o = { kind: 'bolt', speed: 760, r: 7, pierce: 2, homing: 0, tint: ['255,208,240', '#fff3a0'] }; }
        else { a = base + (n > 1 ? ((i / (n - 1)) - 0.5) * (v.spread * Math.PI / 180) : 0); o = { kind: 'bolt', speed: 480, r: 9, pierce: 0, homing: 1, burn: v.burn, tint: ['255,120,50', '#ffd08a'] }; }
        world.firePlayerShot({ x: from.x, y: from.y, angle: a, power: v.power, src: 'pet', kb: 50, ...o });
      }
      pet.flip = Math.cos(base) < 0; pet.glow = 0.8;
      return true;
    }
    case 'ward': {
      if (!fighting) return wait(0.5);
      if ((p.ward || 0) >= v.charges) return wait(0.5);
      p.ward = v.charges;
      world.fx.ring(p.x, p.y - 30, 10, 46, '#e8d8b0', 0.45, 5); world.fx.callout?.(p.x, p.y - 110, 'กรวดกำบัง', '#e8d8b0');
      pet.glow = 1;
      return true;
    }
    case 'mine': {
      // lobs a sticky glob under the nearest enemy (or in front of the hero); it bursts when anyone steps on it
      const e = nearestEnemy(world, p, 340);
      if (!e) return wait(0.5);
      const a = world.rng.next() * Math.PI * 2;
      pet.fx.push({ kind: 'mine', x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 10, r: v.r, t: 0, life: 7, armed: false });
      pet.fx.push({ kind: 'beam', x: pet.x, y: pet.y - pet.z, x2: e.x, y2: e.y, w: 5, t: 0, life: 0.25, color: '#7fd0c0', curl: true });
      pet.glow = 0.6;
      return true;
    }
    case 'vortex': {
      const e = nearestEnemy(world, pet, 360);
      if (!e) return wait();
      const cx = e.x, cy = e.y;
      for (const o of alive(world)) {
        const d = Math.hypot(o.x - cx, o.y - cy);
        if (d > v.r + o.r) continue;
        const a = Math.atan2(cy - o.y, cx - o.x);
        const pull = o.type?.boss ? v.pull * 0.2 : v.pull * Math.min(1, d / 80);
        world.petStrike(o, v.power, { kx: Math.cos(a) * pull, ky: Math.sin(a) * pull });
      }
      world.fx.ring(cx, cy, v.r, 10, '#7a8a4a', 0.45, 6);
      pet.flip = cx < pet.x; pet.glow = 1;
      return true;
    }
    case 'chain': {
      let e = nearestEnemy(world, pet, v.range);
      if (!e) return wait();
      const hit = new Set();
      let x0 = from.x, y0 = from.y;
      for (let j = 0; j <= v.jumps && e; j++) {
        hit.add(e);
        world.petStrike(e, v.power * (j ? 0.8 : 1), { kx: 0, ky: 0, stun: 0.15 });
        pet.fx.push({ kind: 'beam', x: x0, y: y0, x2: e.x, y2: e.y - e.r, w: 4, t: 0, life: 0.25, color: '#fff07a', zig: true });
        burst(world, e.x, e.y - e.r, 8, ['#fff07a', '#9fb8ff']);
        x0 = e.x; y0 = e.y - e.r;
        const cur = e;
        e = nearestEnemy(world, cur, 220, (o) => !hit.has(o));
      }
      pet.glow = 1;
      return true;
    }
    case 'crit': case 'haste': {
      if (!fighting) return wait(0.5);
      if (v.kind === 'crit') addBuff(p, 'crit', v.crit, v.duration); else addBuff(p, 'haste', v.haste, v.duration);
      world.fx.ring(p.x, p.y - 40, 10, 56, v.kind === 'crit' ? '#ff8a3d' : '#9ee0c8', 0.5, 5);
      burst(world, p.x, p.y - 50, 12, v.kind === 'crit' ? ['#ff8a3d', '#c8bca8'] : ['#9ee0c8', '#ffffff'], { grav: -60 });
      pet.glow = 1;
      return true;
    }
    case 'nova': {
      // the fox kit jumps to the hero's side and bursts: everything crowding the hero is chilled and pushed off
      if (!alive(world).some((e) => Math.hypot(e.x - p.x, e.y - p.y) < v.r + e.r + 20)) return wait();
      pet.x = p.x + (p.flip ? 26 : -26); pet.y = p.y + 6;
      for (const e of alive(world)) {
        if (Math.hypot(e.x - p.x, e.y - p.y) > v.r + e.r) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        world.petStrike(e, v.power, { slow: v.slow, slowT: v.slowT, kx: Math.cos(a) * 160, ky: Math.sin(a) * 160 });
      }
      world.fx.ring(p.x, p.y - 10, 10, v.r, '#bfe8ff', 0.45, 8);
      burst(world, p.x, p.y - 10, 22, ['#e8f8ff', '#8fd0f0', '#ffffff'], { speedMin: 100, speedMax: 260 });
      pet.glow = 1;
      return true;
    }
    case 'stomp': case 'ambush': {
      let e;
      if (v.kind === 'ambush') { const list = alive(world).filter((o) => Math.hypot(o.x - p.x, o.y - p.y) < 520); e = list.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; }
      else e = nearestEnemy(world, pet, 380);
      if (!e) return wait();
      const a = Math.atan2(e.y - pet.y, e.x - pet.x);
      if (v.kind === 'ambush') { burst(world, pet.x, pet.y - 10, 14, ['#2a2438', '#c27ff0']); pet.x = e.x + Math.cos(a) * (e.r + 20); pet.y = e.y + Math.sin(a) * (e.r + 10); }
      pet.dash = { t: 0, dur: v.kind === 'ambush' ? 0.08 : 0.32, x0: pet.x, y0: pet.y, x1: e.x, y1: e.y, a, target: e, hit: false, hold: 0.2,
        onHit: () => {
          if (v.kind === 'ambush') {
            if (e.dead) return;
            const low = e.hp / e.maxHp < 0.3;
            world.petStrike(e, v.power * (low ? 1 + v.execute : 1), { kx: Math.cos(a) * 200, ky: Math.sin(a) * 200, stun: 0.3 });
            world.fx.slash?.(e.x, e.y - e.r, a + Math.PI, 2.2, 60, 1.4, '#e0b0ff', false, '#c27ff0');
            burst(world, e.x, e.y - e.r, 14, ['#c27ff0', '#2a2438', '#ffe65a']);
          } else {
            for (const o of alive(world)) {
              if (Math.hypot(o.x - pet.x, o.y - pet.y) > v.r + o.r) continue;
              const b = Math.atan2(o.y - pet.y, o.x - pet.x);
              world.petStrike(o, v.power, { stun: v.stun, kx: Math.cos(b) * 200, ky: Math.sin(b) * 200 });
            }
            world.fx.ring(pet.x, pet.y, 10, v.r, '#ffd83a', 0.4, 8); world.shake?.(4, 0.15);
            burst(world, pet.x, pet.y - 6, 18, ['#ffd83a', '#ffffff', '#e8e2d0'], { speedMin: 80, speedMax: 240 });
          }
        } };
      pet.flip = Math.cos(a) < 0; pet.glow = 1;
      return true;
    }
    case 'leech': {
      const e = nearestEnemy(world, pet, v.range);
      if (!e) return wait();
      world.petStrike(e, v.power, { kx: 0, ky: 0 });
      if (!p.dead && p.hp < p.maxHp) { const heal = Math.max(1, Math.round(p.maxHp * v.healPct)); p.hp = Math.min(p.maxHp, p.hp + heal); world.fx.number(p.x, p.y - 96, `+${heal}`, 'heal'); }
      pet.fx.push({ kind: 'beam', x: from.x, y: from.y, x2: e.x, y2: e.y - e.r, t: 0, life: 0.3, color: '#e0503a' });
      burst(world, e.x, e.y - e.r, 8, ['#e0503a', '#8a1a2a']);
      pet.flip = e.x < pet.x; pet.glow = 0.8;
      return true;
    }
    case 'beam': case 'pierce': {
      const e = nearestEnemy(world, pet, v.len);
      if (!e) return wait();
      const a = Math.atan2(e.y - pet.y, e.x - pet.x);
      const hit = (x0, y0) => {
        for (const o of alive(world)) {
          const dx = o.x - x0, dy = o.y - y0, along = dx * Math.cos(a) + dy * Math.sin(a), across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
          if (along < -o.r || along > v.len + o.r || across > v.width / 2 + o.r) continue;
          world.petStrike(o, v.power, { kx: Math.cos(a) * 160, ky: Math.sin(a) * 160 });
        }
      };
      if (v.kind === 'beam') {
        hit(pet.x, pet.y);
        pet.fx.push({ kind: 'beam', x: from.x, y: from.y, x2: from.x + Math.cos(a) * v.len, y2: from.y + Math.sin(a) * v.len, w: v.width, t: 0, life: 0.35, color: '#7fd0ff' });
      } else {
        const x0 = pet.x, y0 = pet.y;
        pet.dash = { t: 0, dur: 0.22, x0, y0, x1: x0 + Math.cos(a) * v.len, y1: y0 + Math.sin(a) * v.len, a, target: null, hit: false, hold: 0.05, onHit: () => hit(x0, y0) };
        pet.fx.push({ kind: 'beam', x: x0, y: y0 - pet.z, x2: x0 + Math.cos(a) * v.len, y2: y0 - pet.z + Math.sin(a) * v.len, w: v.width * 0.6, t: 0, life: 0.4, color: '#ffe65a' });
      }
      pet.flip = Math.cos(a) < 0; pet.glow = 1;
      world.sfx?.('dash');
      return true;
    }
    case 'rain': {
      const e = nearestEnemy(world, pet, 460);
      if (!e) return wait();
      for (let i = 0; i < v.count; i++) {
        const a = (i / v.count) * Math.PI * 2 + world.rng.next(), d = i === 0 ? 0 : 40 + world.rng.next() * 60;
        pet.fx.push({ kind: 'rain', x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d * 0.7, r: v.r, power: v.power, t: 0, delay: 0.45 + i * 0.12, life: 0.75 + i * 0.12, color: '#fff3a0' });
      }
      pet.glow = 1;
      return true;
    }
    case 'howl': {
      if (!alive(world).some((e) => Math.hypot(e.x - p.x, e.y - p.y) < v.r + 80)) return wait(0.5);
      for (const e of alive(world)) {
        if (Math.hypot(e.x - p.x, e.y - p.y) > v.r + e.r) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        world.petStrike(e, 0.1, { stun: v.stun, kx: Math.cos(a) * 260, ky: Math.sin(a) * 260 });
      }
      addBuff(p, 'reduce', v.reduce, v.duration);
      world.fx.ring(pet.x, pet.y - 20, 10, v.r, '#9fffd8', 0.5, 6); world.fx.callout?.(pet.x, pet.y - 70, 'หอน!', '#9fffd8');
      world.sfx?.('roar');
      pet.glow = 1;
      return true;
    }
    case 'drizzle': case 'sanctuary': {
      if (!fighting) return wait(0.5);
      const holy = v.kind === 'sanctuary';
      pet.fx.push({ kind: 'field', x: p.x, y: p.y, r: v.r, t: 0, life: holy ? v.duration : 3, healPct: holy ? v.healPct : v.healPct / 3, reduce: holy ? v.reduce : 0, slow: holy ? 0 : v.slow, follow: !holy, color: holy ? '#f5d48a' : '#c8e8ff', tick: 0 });
      pet.glow = 1.2;
      world.sfx?.(holy ? 'levelup' : 'potion');
      return true;
    }
    case 'rebirth': {
      // a ring of phoenix fire around the hero
      if (!alive(world).some((e) => Math.hypot(e.x - p.x, e.y - p.y) < v.r + e.r + 20)) return wait(0.5);
      for (const e of alive(world)) if (Math.hypot(e.x - p.x, e.y - p.y) < v.r + e.r) world.petStrike(e, v.power, { burn: true, kx: 0, ky: 0 });
      world.fx.ring(p.x, p.y - 10, 20, v.r, '#ffcf5a', 0.45, 8);
      burst(world, p.x, p.y - 10, 22, ['#ff7a33', '#ffcf5a', '#fff3c4'], { speedMin: 100, speedMax: 240 });
      pet.glow = 1;
      return true;
    }
    case 'grasp': {
      const list = alive(world).filter((e) => Math.hypot(e.x - pet.x, e.y - pet.y) < v.range).sort((a, b) => Math.hypot(a.x - pet.x, a.y - pet.y) - Math.hypot(b.x - pet.x, b.y - pet.y)).slice(0, v.count);
      if (!list.length) return wait();
      for (const e of list) {
        const a = Math.atan2(pet.y - e.y, pet.x - e.x);
        world.petStrike(e, v.power, { stun: v.stun, kx: Math.cos(a) * 140, ky: Math.sin(a) * 140 });
        pet.fx.push({ kind: 'beam', x: pet.x, y: pet.y - pet.z, x2: e.x, y2: e.y - e.r * 0.6, w: 8, t: 0, life: 0.6, color: '#7fe8ff', curl: true });
      }
      pet.glow = 1;
      return true;
    }
    case 'quake': {
      if (!alive(world).some((e) => Math.hypot(e.x - pet.x, e.y - pet.y) < v.r + 80)) return wait(0.5);
      const step = v.r / 3;
      for (let i = 0; i < 3; i++) pet.fx.push({ kind: 'ring', x: pet.x, y: pet.y, inner: i * step, r: (i + 1) * step, power: v.power, stun: v.stun, t: 0, delay: 0.15 + i * 0.28, life: 0.5 + i * 0.28, color: '#ff5a3a' });
      world.shake?.(5, 0.25); world.sfx?.('slam');
      pet.glow = 1;
      return true;
    }
    default: return true;
  }
}

// ---------------------------------------------------------------- drawing
// ground effects go under everyone (call before the y-sorted bodies)
export function drawPetGround(renderer, pets, time) {
  const ctx = renderer.ctx;
  for (const pet of pets || []) {
    if (!pet) continue;
    for (const f of pet.fx) {
      const fade = Math.min(1, (f.life - f.t) / 0.4);
      ctx.save();
      if (f.kind === 'mine') {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = f.armed ? 'rgba(127,208,192,0.55)' : 'rgba(127,208,192,0.3)';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(232,255,248,0.8)'; ctx.lineWidth = 2; ctx.stroke();
        if (f.armed) { ctx.strokeStyle = `rgba(191,240,232,${(0.25 + 0.2 * Math.sin(time * 8)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (f.kind === 'trail') {
        ctx.globalAlpha = 0.6 * fade; ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r);
        g.addColorStop(0, 'rgba(255,179,90,0.8)'); g.addColorStop(1, 'rgba(194,65,47,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      } else if (f.kind === 'field') {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = f.reduce ? 'rgba(245,212,138,0.16)' : 'rgba(200,232,255,0.14)';
        ctx.strokeStyle = f.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (!f.reduce) { ctx.strokeStyle = 'rgba(200,232,255,0.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 10; i++) { const a = i * 2.4 + time * 0.7, d = (i * 37 % f.r), y0 = ((time * 300 + i * 50) % 120); ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * d, f.y - 120 + y0); ctx.lineTo(f.x + Math.cos(a) * d - 3, f.y - 108 + y0); ctx.stroke(); } }
        else for (let i = 0; i < 6; i++) { const a = time * 0.8 + i * Math.PI / 3; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * f.r * 0.8, f.y + Math.sin(a) * f.r * 0.48, 3, 0, Math.PI * 2); ctx.fill(); }
      } else if ((f.kind === 'rain' || f.kind === 'ring') && !f.done) {
        const k = Math.min(1, f.t / f.delay);
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = f.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (f.kind === 'ring' ? 1 : k), f.r * 0.6 * (f.kind === 'ring' ? 1 : k), 0, 0, Math.PI * 2); ctx.stroke();
        if (f.kind === 'rain') { ctx.fillStyle = f.color; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(f.x + (1 - k) * 60, f.y - (1 - k) * 300, 7, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  }
}

export function drawPet(renderer, pet, sprites, time) {
  if (!pet) return;
  const ctx = renderer.ctx, s = sprites[pet.pet.sprite];
  if (!s) return;
  const fly = pet.pet.flying;
  const bob = fly ? Math.sin(time * 4 + pet.id.length + pet.slot) * 5 : -Math.abs(Math.sin(pet.hop)) * 5;
  const z = (fly ? pet.z : 0) - bob;
  // beams (water jet, drain, eagle dive, tentacles) — drawn with the pet so they stay above the floor
  for (const f of pet.fx) {
    if (f.kind !== 'beam') continue;
    const fade = Math.max(0, 1 - f.t / f.life);
    ctx.save(); ctx.globalAlpha = fade; ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = f.color; ctx.lineCap = 'round'; ctx.lineWidth = (f.w || 6) * (0.5 + 0.5 * fade);
    ctx.beginPath(); ctx.moveTo(f.x, f.y);
    if (f.curl) ctx.quadraticCurveTo((f.x + f.x2) / 2 + Math.sin(time * 9) * 30, (f.y + f.y2) / 2 - 40, f.x2, f.y2);
    else if (f.zig) { for (let k = 1; k < 6; k++) { const q = k / 6; ctx.lineTo(f.x + (f.x2 - f.x) * q + (Math.random() - 0.5) * 16, f.y + (f.y2 - f.y) * q + (Math.random() - 0.5) * 16); } ctx.lineTo(f.x2, f.y2); }
    else ctx.lineTo(f.x2, f.y2);
    ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(12,8,6,0.3)';
  ctx.beginPath(); ctx.ellipse(pet.x, pet.y, s.w * 0.32 * (fly ? 0.7 : 1), 5, 0, 0, Math.PI * 2); ctx.fill();
  const lit = pet.id === 'firefly' || pet.id === 'lantern' || pet.pet.art?.glow;
  if (pet.glow > 0 || lit) {
    const g = Math.max(pet.glow, lit ? 0.35 + 0.15 * Math.sin(time * 5) : 0);
    const col = pet.pet.art?.c3 ? hexRgb(pet.pet.art.c3) : '255,216,137';
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(pet.x, pet.y - z - s.h * 0.4, 2, pet.x, pet.y - z - s.h * 0.4, 46);
    gr.addColorStop(0, `rgba(${col},${(0.5 * Math.min(1, g)).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pet.x, pet.y - z - s.h * 0.4, 46, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const flap = fly ? 1 + Math.sin(time * 22) * 0.05 : 1;
  renderer.sprite(s, pet.x, pet.y - z, { flip: pet.flip, sx: 0.9 * flap, sy: 0.9 / flap });
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }
