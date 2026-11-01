// v8 monsters and bosses: the Shattered Mirror Abyss (z11), the Eclipse Throne (z12) and the shadow of the Boss Rush.
// Same contract as zoneBehaviours.js: every blow is telegraphed; the hard part is that the telegraphs come from
// places you are not looking (your own reflection, the far side of the arena, the spot you are about to step on).
import { BEHAVIOURS } from './enemies.js';
import { getEnemy } from '../data/enemies.js';

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
function steer(e, angle, speed, dt, k = 6) { const f = Math.min(1, dt * k); e.vx += (Math.cos(angle) * speed - e.vx) * f; e.vy += (Math.sin(angle) * speed - e.vy) * f; }
function stop(e, dt, k = 8) { steer(e, 0, 0, dt, k); }
function setState(e, s) { e.state = s; e.t = 0; e.hitThisAttack = false; }
const warnK = (e, k) => { e.warn = Math.max(0, Math.min(1, k)); };
function inArena(world, x, y, pad = 110) { const A = world.arena; return { x: Math.max(pad, Math.min(A.w - pad, x)), y: Math.max(pad + 40, Math.min(A.h - pad, y)) }; }
const mirrorOf = (world, p) => ({ x: world.arena.w - p.x, y: p.y });
function tryHit(e, world, mult = 1, extra = 0, kb = 320) {
  if (e.hitThisAttack) return;
  const p = world.player;
  if (!p || p.dead) return;
  if (dist(e, p) <= e.r + p.r + extra) { const a = toward(e, p); if (world.hitPlayer(e, mult, Math.cos(a) * kb, Math.sin(a) * kb)) e.hitThisAttack = true; }
}
function phaseOf(e) { return e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3; }

Object.assign(BEHAVIOURS, {
  // Mirror wisp: drifts at range; every few seconds it blinks to the other side of you (your reflection's side)
  // and fires a short fan of shards from there.
  mirror_wisp(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    if (e.state === 'idle') { setState(e, 'drift'); e.ai.dir = world.rng.next() < 0.5 ? 1 : -1; }
    if (e.state === 'drift') {
      const d = dist(e, p), a = toward(e, p);
      const want = d > P.keepAway + 60 ? a : d < P.keepAway - 60 ? a + Math.PI : a + (Math.PI / 2) * e.ai.dir;
      steer(e, want, e.type.speed, dt, 4);
      if (e.t >= P.blinkEvery) {
        // reappear on the far side of the hero, mirrored through them
        const to = inArena(world, p.x + (p.x - e.x) * 0.9, p.y + (p.y - e.y) * 0.9);
        world.fx?.ring(e.x, e.y - 20, 6, 50, '#bfe8ff', 0.3, 3);
        e.x = to.x; e.y = to.y; e.vx = e.vy = 0;
        world.fx?.ring(e.x, e.y - 20, 50, 6, '#ffffff', 0.3, 3);
        world.sfx('blink');
        setState(e, 'aim'); e.ai.a = toward(e, p);
        for (let i = -1; i <= 1; i++) world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: e.ai.a + i * P.spread, len: 420, width: 18, dur: P.aim, mult: 0, owner: e, tone: 'mirror' });
      }
    } else if (e.state === 'aim') {
      stop(e, dt, 10); warnK(e, e.t / P.aim);
      if (e.t >= P.aim) {
        e.warn = 0;
        for (let i = 0; i < P.shots; i++) world.shoot(e, { x: e.x, y: e.y - 20, angle: e.ai.a + (i - (P.shots - 1) / 2) * P.spread, speed: P.shotSpeed, r: 9, mult: 0.8, kind: 'shard' });
        world.sfx('bow'); setState(e, 'drift'); e.ai.dir *= -1;
      }
    }
  },

  // Glass golem: aims a charge (a long lane), charges, and every few steps of the way a shard sprouts behind it
  // that bursts a moment later — the lane stays dangerous after the golem has passed. Exposed after the charge.
  glass_charger(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    if (e.state === 'idle') setState(e, 'walk');
    if (e.state === 'walk') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.contactCd <= 0 && dist(e, p) < e.r + p.r + 6) { const a = toward(e, p); if (world.hitPlayer(e, 0.8, Math.cos(a) * 340, Math.sin(a) * 340)) e.contactCd = 1; }
      if (e.t > 1.4 && dist(e, p) < P.range) {
        setState(e, 'aim'); e.ai.a = toward(e, p);
        world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.a, len: P.chargeSpeed * P.chargeTime + 40, width: e.r * 2.2, dur: P.telegraph, mult: 0, owner: e, tone: 'mirror' });
        world.sfx('telegraph');
      }
    } else if (e.state === 'aim') {
      stop(e, dt, 10); warnK(e, e.t / P.telegraph);
      if (e.t >= P.telegraph) { setState(e, 'charge'); e.warn = 0; e.ai.drop = 0; world.sfx('dash'); }
    } else if (e.state === 'charge') {
      e.vx = Math.cos(e.ai.a) * P.chargeSpeed; e.vy = Math.sin(e.ai.a) * P.chargeSpeed;
      tryHit(e, world, 1.3, 4, 460);
      e.ai.drop -= dt;
      if (e.ai.drop <= 0) { e.ai.drop = P.shardEvery; world.strike({ shape: 'circle', x: e.x, y: e.y, r: P.shardR, dur: P.shardDelay, mult: 0.7, owner: e, tone: 'mirror' }); }
      if (e.t >= P.chargeTime) { setState(e, 'exposed'); world.shake(4, 0.2); }
    } else if (e.state === 'exposed') {
      stop(e, dt, 6);
      if (e.t >= P.exposed) setState(e, 'walk');
    }
  },

  // The queen's reflections: each one fires one telegraphed lane at the hero, then shatters. Fragile.
  mirror_image(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    e.ai.life = (e.ai.life ?? P.life) - dt;
    if (e.ai.life <= 0) { e.hp = 0; world.killEnemy?.(e); return; }
    if (e.state === 'idle') setState(e, 'drift');
    if (e.state === 'drift') {
      steer(e, toward(e, p) + Math.PI / 2, 120, dt, 3);
      if (e.t >= (e.ai.wait ??= 1.6 + world.rng.next() * 0.8)) { e.ai.wait = null; setState(e, 'aim'); e.ai.a = toward(e, p); world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: e.ai.a, len: P.len, width: P.width, dur: P.telegraph, mult: 0.9, owner: e, tone: 'mirror' }); world.sfx('telegraph'); }
    } else if (e.state === 'aim') {
      stop(e, dt, 10); warnK(e, e.t / P.telegraph);
      if (e.t >= P.telegraph + 0.2) { e.warn = 0; setState(e, 'drift'); }
    }
  },

  // ราชินีกระจกแตก. Phase 1: a slash lane, then the same lane again from the mirrored side of the arena.
  // Phase 2: + shatter rings (expanding bands, each with a gap you have to find) and her reflections.
  // Phase 3: + the kaleidoscope (six spokes that sweep round in steps) and she swaps places with a reflection.
  mirror_queen(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    const ph = phaseOf(e);
    if (ph !== e.ai.phase) {
      if (e.ai.phase) { world.announce(ph === 2 ? 'ราชินีแตกเงาออกมา!' : 'กระจกทั้งเหวสั่นสะเทือน!'); world.sfx('roar'); world.shake(10, 0.5); }
      e.ai.phase = ph;
    }
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    const A = world.arena;
    if (e.state === 'idle') { setState(e, 'glide'); e.ai.next = 0; }
    if (e.state === 'glide') {
      const a = toward(e, p) + Math.sin(world.time * 1.3) * 0.9;
      steer(e, dist(e, p) > 260 ? a : a + Math.PI * 0.6, e.type.speed, dt, 3);
      if (e.t >= 1.0 * k) {
        const pool = ph === 1 ? ['reflect', 'reflect', 'dash'] : ph === 2 ? ['reflect', 'rings', 'images', 'dash'] : ['reflect', 'rings', 'kaleido', 'swap', 'images'];
        setState(e, pool[e.ai.next % pool.length]); e.ai.next += 1; e.ai.step = 0;
      }
    } else if (e.state === 'reflect') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const a = toward(e, p);
        world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: a, len: P.slashLen, width: P.slashWidth, dur: P.slashTelegraph * k, mult: 1.15, owner: e, tone: 'mirror' });
        // the reflection of the same slash, cast from the mirrored point and aimed at where the hero stands now
        const m = mirrorOf(world, e), b = Math.atan2(p.y - m.y, p.x - m.x);
        world.strike({ shape: 'line', x: m.x, y: m.y - 20, angle: b, len: P.slashLen, width: P.slashWidth, dur: P.slashTelegraph * k + 0.4, mult: 1.15, owner: e, tone: 'mirror' });
        world.fx?.ring(m.x, m.y - 20, 10, 70, '#bfe8ff', 0.5, 5);
        e.ai.step = 1; world.sfx('telegraph');
      }
      warnK(e, e.t / (P.slashTelegraph * k));
      if (e.t >= P.slashTelegraph * k + 0.6) { e.warn = 0; world.sfx('swing'); setState(e, 'rest'); }
    } else if (e.state === 'rings') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        // each band has one gap (a cone-shaped hole) at a different angle; the bands land one after another
        for (let i = 0; i < P.rings; i++) {
          const r0 = 60 + i * P.ringStep, gap = world.rng.next() * TAU;
          for (let s = 0; s < 6; s++) {
            const a0 = gap + 0.55 + s * ((TAU - 1.1) / 6);
            world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: a0 + (TAU - 1.1) / 12, r: r0 + P.ringStep, arc: (TAU - 1.1) / 6 + 0.02, dur: P.ringTelegraph * k + i * 0.38, mult: 0.95, owner: e, tone: 'mirror', inner: r0 });
          }
        }
        e.ai.step = 1; world.sfx('cast');
      }
      warnK(e, e.t / (P.ringTelegraph * k));
      if (e.t >= P.ringTelegraph * k + P.rings * 0.38 + 0.3) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'images') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        for (let i = 0; i < P.images; i++) { const at = inArena(world, e.x + Math.cos(i * Math.PI + 0.6) * 240, e.y + Math.sin(i * Math.PI + 0.6) * 160); world.spawnEnemy('z_mirror_image', at.x, at.y); }
        e.ai.step = 1; world.sfx('blink'); world.announce('เงาสะท้อนของราชินีปรากฏ! ทุบให้แตกก่อนมันยิง');
      }
      if (e.t >= 0.9) setState(e, 'rest');
    } else if (e.state === 'kaleido') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const base = world.rng.next() * TAU, dir = world.rng.next() < 0.5 ? 1 : -1;
        for (let w = 0; w < 3; w++) for (let i = 0; i < P.spokes; i++) {
          world.strike({ shape: 'line', x: A.w / 2, y: A.h / 2, angle: base + dir * w * (Math.PI / P.spokes / 1.5) + (i / P.spokes) * TAU, len: P.spokeLen, width: 50, dur: P.spokeTelegraph * k + w * 0.55, mult: 1.0, owner: e, tone: 'mirror' });
        }
        e.ai.step = 1; world.sfx('roar'); world.announce('ลานกระจกหมุน! ดูทิศที่เส้นเลื่อนไป แล้วเลื่อนตาม');
      }
      if (e.t >= P.spokeTelegraph * k + 1.7) setState(e, 'rest');
    } else if (e.state === 'swap') {
      // trade places with a reflection (or appear mirrored): a fast thrust follows from the new spot
      const img = world.enemies?.find?.((x) => x.type.id === 'z_mirror_image' && !x.dead);
      if (e.ai.step === 0) {
        const to = img ? { x: img.x, y: img.y } : mirrorOf(world, e);
        if (img) { img.x = e.x; img.y = e.y; }
        world.fx?.ring(e.x, e.y - 30, 10, 90, '#bfe8ff', 0.4, 5);
        e.x = to.x; e.y = to.y; e.vx = e.vy = 0; world.sfx('blink');
        e.ai.a = toward(e, p);
        world.strike({ shape: 'line', x: e.x, y: e.y - 20, angle: e.ai.a, len: 560, width: e.r * 1.6, dur: 0.55, mult: 1.3, owner: e, tone: 'pierce', pierce: true, kb: 420 });
        e.ai.step = 1;
      }
      warnK(e, e.t / 0.55);
      if (e.t >= 0.55 && e.ai.step === 1) { e.ai.step = 2; e.warn = 0; }
      if (e.ai.step === 2 && e.t < 0.8) { e.vx = Math.cos(e.ai.a) * 900; e.vy = Math.sin(e.ai.a) * 900; }
      if (e.t >= 1.0) setState(e, 'rest');
    } else if (e.state === 'dash') {
      if (e.ai.step === 0) { e.ai.a = toward(e, p); e.ai.step = 1; world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.a, len: 520, width: e.r * 1.8, dur: 0.6 * k, mult: 1.1, owner: e, tone: 'mirror', kb: 380 }); }
      stop(e, dt, 10); warnK(e, e.t / (0.6 * k));
      if (e.t >= 0.6 * k && e.t < 0.6 * k + 0.4) { e.warn = 0; e.vx = Math.cos(e.ai.a) * 1100; e.vy = Math.sin(e.ai.a) * 1100; }
      if (e.t >= 0.6 * k + 0.6) setState(e, 'rest');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'glide');
    }
  },

  // Eclipse hound: circles, pounces along a marked lane, and where it lands a ring of sunfire bursts a beat later
  // (the safe spot is right next to it, inside the ring) — staying still after dodging the pounce is the mistake.
  eclipse_hound(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    if (e.state === 'idle') { setState(e, 'circle'); e.ai.dir = world.rng.next() < 0.5 ? 1 : -1; }
    if (e.state === 'circle') {
      const a = toward(e, p) + (Math.PI / 2) * e.ai.dir * (dist(e, p) < 200 ? 1.4 : 0.8);
      steer(e, a, e.type.speed, dt, 5);
      if (e.t >= P.circle) { setState(e, 'wind'); e.ai.a = toward(e, p); const len = Math.min(560, dist(e, p) + 60); e.ai.len = len; world.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: e.ai.a, len, width: 54, dur: P.telegraph, mult: 0, owner: e, tone: 'eclipse' }); world.sfx('telegraph'); }
    } else if (e.state === 'wind') {
      stop(e, dt, 12); warnK(e, e.t / P.telegraph);
      if (e.t >= P.telegraph) { setState(e, 'pounce'); e.warn = 0; }
    } else if (e.state === 'pounce') {
      const sp = Math.min(P.pounceSpeed, e.ai.len / P.pounceTime);
      e.vx = Math.cos(e.ai.a) * sp; e.vy = Math.sin(e.ai.a) * sp;
      tryHit(e, world, 1.1);
      if (e.t >= P.pounceTime) {
        world.strike({ shape: 'ring', x: e.x, y: e.y, r: P.ringR, inner: P.ringIn, dur: P.ringDelay, mult: 1.0, owner: e, tone: 'eclipse' });
        setState(e, 'rest');
      }
    } else if (e.state === 'rest') {
      stop(e, dt, 6);
      if (e.t >= P.rest) { setState(e, 'circle'); e.ai.dir *= -1; }
    }
  },

  // Corona priest: keeps away; marks the ground under a hero with a sun sigil that FOLLOWS them for a moment,
  // then locks and bursts (move after it locks). Between marks: three sun beams in a fan, landing one by one.
  corona_priest(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    if (e.state === 'idle') setState(e, 'keep');
    if (e.state === 'keep') {
      const d = dist(e, p), a = toward(e, p);
      steer(e, d < P.keepAway ? a + Math.PI : d > P.keepAway + 140 ? a : a + Math.PI / 2, e.type.speed, dt, 4);
      if (e.t >= P.cooldown) { setState(e, (e.ai.n = (e.ai.n || 0) + 1) % 2 ? 'mark' : 'beams'); e.ai.step = 0; }
    } else if (e.state === 'mark') {
      stop(e, dt, 8); warnK(e, e.t / (P.markTime + P.markLock));
      if (e.t < P.markTime) { e.ai.mx = p.x; e.ai.my = p.y; if (Math.random() < 0.3) world.particles?.spawn({ x: p.x + (Math.random() - 0.5) * 60, y: p.y, vx: 0, vy: -60, life: 0.5, size: 4, size2: 0.5, color: '#ffd27a', drag: 2, glow: true }); }
      else if (e.ai.step === 0) { e.ai.step = 1; world.strike({ shape: 'circle', x: e.ai.mx, y: e.ai.my, r: P.markR, dur: P.markLock, mult: 1.2, owner: e, tone: 'sun' }); world.sfx('telegraph'); }
      if (e.t >= P.markTime + P.markLock + 0.2) { e.warn = 0; setState(e, 'keep'); }
    } else if (e.state === 'beams') {
      stop(e, dt, 8);
      if (e.ai.step === 0) {
        const a = toward(e, p);
        for (let i = 0; i < P.beams; i++) world.strike({ shape: 'line', x: e.x, y: e.y - 30, angle: a + (i - 1) * 0.42, len: P.beamLen, width: P.beamWidth, dur: P.beamTelegraph + i * 0.32, mult: 0.95, owner: e, tone: 'sun' });
        e.ai.step = 1; world.sfx('cast');
      }
      warnK(e, e.t / P.beamTelegraph);
      if (e.t >= P.beamTelegraph + P.beams * 0.32) { e.warn = 0; setState(e, 'keep'); }
    }
  },

  // จักรพรรดิสุริยคราส: two stances that swap every few seconds (an aura shows which is coming).
  //   sun   solar flare (a cross of beams, then the same cross turned 45°) · sun drop (one huge circle on you,
  //         three small ones where you would dodge to)
  //   moon  crescents (three cone slashes, left-right-left, uneven rhythm) · moon step (vanishes, reappears behind)
  // Phase 3: total eclipse — the arena goes black except a path of three lights that appear one after another.
  eclipse_king(e, dt, world) {
    const P = e.type.ai_params, p = world.player;
    if (!p) return;
    const ph = phaseOf(e);
    if (ph !== e.ai.phase) {
      if (e.ai.phase) { world.announce(ph === 2 ? 'จักรพรรดิเรียกสุนัขคราส!' : 'คราสเต็มดวง!'); world.sfx('roar'); world.shake(12, 0.6); }
      if (ph === 2) for (let i = 0; i < 2; i++) world.spawnEnemy(P.summon, e.x + (i ? 180 : -180), e.y + 30);
      e.ai.phase = ph;
    }
    const k = ph === 3 ? 0.78 : ph === 2 ? 0.9 : 1;
    e.ai.stanceT = (e.ai.stanceT ?? P.stance) - dt;
    if (e.ai.stanceT <= 0) { e.ai.stanceT = P.stance; e.ai.moon = !e.ai.moon; world.fx?.callout(e.x, e.y - e.r * 2 - 30, e.ai.moon ? 'ท่าจันทร์' : 'ท่าตะวัน', e.ai.moon ? '#b8aaff' : '#ffd27a'); world.sfx('cast'); }
    const moon = !!e.ai.moon;
    if (e.state === 'idle') { setState(e, 'walk'); e.ai.next = 0; }
    if (e.state === 'walk') {
      steer(e, toward(e, p), e.type.speed, dt, 3);
      if (e.contactCd <= 0 && dist(e, p) < e.r + p.r) { const a = toward(e, p); if (world.hitPlayer(e, 0.7, Math.cos(a) * 360, Math.sin(a) * 360)) e.contactCd = 1; }
      if (e.t >= 1.0 * k) {
        const pool = moon ? ['crescent', 'moonstep', 'crescent'] : ['flare', 'drop', 'flare'];
        if (ph === 3 && (e.ai.totalCd ?? 0) <= 0) { setState(e, 'total'); e.ai.totalCd = 26; }
        else { setState(e, pool[e.ai.next % pool.length]); e.ai.next += 1; }
        e.ai.step = 0;
      }
    }
    if (e.ai.totalCd > 0) e.ai.totalCd -= dt;
    if (e.state === 'flare') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        const base = toward(e, p);
        for (let set = 0; set < 2; set++) for (let i = 0; i < 4; i++) world.strike({ shape: 'line', x: e.x, y: e.y - 30, angle: base + set * (Math.PI / 4) + (i * Math.PI) / 2, len: P.flareLen, width: P.flareWidth, dur: P.flareTelegraph * k + set * 0.55, mult: 1.15, owner: e, tone: 'sun' });
        e.ai.step = 1; world.sfx('telegraph');
      }
      warnK(e, e.t / (P.flareTelegraph * k));
      if (e.t >= P.flareTelegraph * k + 0.9) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'drop') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        world.strike({ shape: 'circle', x: p.x, y: p.y, r: P.dropR, dur: P.dropTelegraph * k, mult: 1.3, owner: e, tone: 'sun', meteor: true });
        // where a hero would dodge to: left, right and straight back from the king
        const a = toward(e, p);
        for (const off of [Math.PI / 2, -Math.PI / 2, 0]) {
          const at = inArena(world, p.x + Math.cos(a + off) * (P.dropR + 70), p.y + Math.sin(a + off) * (P.dropR + 70));
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: P.dropSmall, dur: P.dropTelegraph * k + 0.45, mult: 1.0, owner: e, tone: 'sun', meteor: true });
        }
        e.ai.step = 1; world.sfx('telegraph');
      }
      warnK(e, e.t / (P.dropTelegraph * k));
      if (e.t >= P.dropTelegraph * k + 0.8) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'crescent') {
      stop(e, dt, 10);
      const gaps = [0, 0.75, 1.3];
      while (e.ai.step < P.crescents && e.t >= gaps[e.ai.step] * k) {
        const a = toward(e, p) + (e.ai.step % 2 ? 0.5 : -0.5);
        world.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: a, r: P.crescentR, arc: P.crescentArc, dur: P.crescentTelegraph * k, mult: 1.1, owner: e, tone: 'moon' });
        e.ai.step += 1; world.sfx('telegraph');
      }
      warnK(e, 0.8);
      if (e.t >= (gaps[P.crescents - 1] + P.crescentTelegraph) * k + 0.4) { e.warn = 0; setState(e, 'rest'); }
    } else if (e.state === 'moonstep') {
      if (e.ai.step === 0) { e.ai.step = 1; e.untargetable = true; e.ai.z = 0; world.fx?.ring(e.x, e.y - 30, 10, 90, '#b8aaff', 0.4, 5); world.sfx('blink'); }
      stop(e, dt, 10);
      if (e.t >= 0.5 && e.ai.step === 1) {
        // reappears behind the hero (opposite the way they face / move)
        const a = Math.atan2(p.vy || 0, p.vx || 0) + Math.PI, mv = Math.hypot(p.vx || 0, p.vy || 0) > 40;
        const back = mv ? a : toward(p, e);
        const to = inArena(world, p.x + Math.cos(back) * 170, p.y + Math.sin(back) * 170);
        e.x = to.x; e.y = to.y; e.untargetable = false; e.ai.step = 2;
        world.strike({ shape: 'circle', x: e.x, y: e.y, r: 210, dur: 0.6 * k, mult: 1.2, owner: e, tone: 'moon', kb: 420 });
        world.fx?.ring(e.x, e.y - 30, 90, 10, '#b8aaff', 0.4, 5);
      }
      if (e.ai.step === 2) warnK(e, (e.t - 0.5) / (0.6 * k));
      if (e.t >= 0.5 + 0.6 * k + 0.3) { e.warn = 0; e.untargetable = false; setState(e, 'rest'); }
    } else if (e.state === 'total') {
      stop(e, dt, 10);
      if (e.ai.step === 0) {
        world.announce('คราสเต็มดวง! วิ่งตามแสงทั้งสามดวง'); world.sfx('roar'); world.shake(10, 0.8);
        world.darken?.(5.5);
        const A = world.arena;
        let at = inArena(world, p.x + (world.rng.next() - 0.5) * 300, p.y + (world.rng.next() - 0.5) * 200, 180);
        for (let i = 0; i < 3; i++) {
          const dur = 1.6 + i * 1.3;
          world.strike({ shape: 'ring', x: at.x, y: at.y, r: Math.hypot(A.w, A.h), inner: 130, dur, mult: 1.25, owner: e, tone: 'eclipse' });
          world.strike({ shape: 'circle', x: at.x, y: at.y, r: 130, dur, mult: 0, owner: e, tone: 'holy' });
          const a = world.rng.next() * TAU;
          at = inArena(world, at.x + Math.cos(a) * 330, at.y + Math.sin(a) * 230, 180);
        }
        e.ai.step = 1;
      }
      if (e.t >= 1.6 + 2 * 1.3 + 0.6) setState(e, 'rest');
    } else if (e.state === 'rest') {
      stop(e, dt, 5);
      if (e.t >= P.rest * k) setState(e, 'walk');
    }
  },

  // The shadow at the end of the Boss Rush. It fights as each boss of the rush in turn (their moves, at its own
  // strength), and on every change of face it throws a move of its own: a black-sun cross on the hero.
  rush_shadow(e, dt, world) {
    const own = e.ai._rsOwn || e.type.ai_params;
    const list = world.zone?.lineup || ['z_umbral_knight', 'z_ash_sovereign', 'z_seraph_warden', 'z_mirror_queen', 'z_eclipse_king'];
    if (!e.ai._rsBase) { e.ai._rsBase = e.type; e.ai._rsOwn = own; e.ai._rsI = -1; e.ai._rsT = 0; }
    e.ai._rsT -= dt;
    if (e.ai._rsT <= 0 && !(e.warn > 0)) {
      const i = (e.ai._rsI + 1) % list.length, def = getEnemy(list[i]);
      const base = e.ai._rsBase;
      if (def && BEHAVIOURS[def.ai]) {
        // wears that boss's pattern table; keeps its own body, strength, name and this behaviour
        e.type = Object.freeze({ ...base, ai_params: def.ai_params });
        e.ai = { _rsBase: base, _rsOwn: own, _rsI: i, _rsT: own.persona, _rsAi: def.ai };
        e.state = 'idle'; e.t = 0; e.untargetable = false;
        world.fx?.callout(e.x, e.y - e.r * 2 - 40, `เลียนแบบ: ${def.name}`, '#ffb648');
        world.sfx('blink'); world.shake(6, 0.3);
        const p = world.player;
        if (p) for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2 + Math.PI / 4; world.strike({ shape: 'line', x: p.x - 420 * Math.cos(a), y: p.y - 420 * Math.sin(a), angle: a, len: 840, width: 64, dur: 1.1, mult: 1.3, owner: e, tone: 'eclipse' }); }
      } else e.ai._rsT = own.persona;
    }
    const fn = e.ai._rsAi && BEHAVIOURS[e.ai._rsAi];
    if (fn) fn(e, dt, world);
  },
});
