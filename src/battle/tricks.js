// v8 boss tricks: patterns that are hard to read but never unfair — every one is telegraphed, just not the way the
// player expects. They run on the host on top of each boss's own behaviour (the behaviour waits while a trick plays).
//   feint     a huge warning circle that is a lie: it cancels with a flash ("หลอก!") and a fast crimson lunge follows
//   delay     a slam aimed where you stand that holds its swing longer than any normal attack, then a quick follow-up
//   combo     three strikes in different shapes with uneven gaps, each aimed where you are at that moment
//   grab      a short crimson lunge; if it catches you it takes half your health
//   execute   ท่าประหาร: a long cast and the whole arena is condemned except one circle of light (or the spot right
//             under the boss); it takes 85% of your health and pierces armour — run to the light, or dodge through
//             it at the last moment
// level: 0 none · 1 feint/delay · 2 + combo · 3 + grab and execute
const TAU = Math.PI * 2;

export function trickLevelFor(zone, stageId = null) {
  if (stageId) return stageId === 's1' ? 1 : 2;
  if (!zone) return 1;
  if (zone.raid || zone.tower || zone.infinite || zone.rush || zone.n >= 11) return 3;
  return zone.n >= 6 ? 3 : zone.n >= 3 ? 2 : 1;
}

const calm = (e) => !(e.warn > 0) && !e.untargetable && !e.dodging && !(e.ai?.z > 4) && e.state !== 'submerge' && e.state !== 'dig' && !e.clone && !e.dead;

// Returns true while a trick is playing (the boss's own behaviour waits).
export function bossTricks(e, dt, w, level) {
  if (!level || !e.type?.boss) return false;
  const T = e.trickState || (e.trickState = { cd: 5 + w.rng.next() * 3, exCd: 18 + w.rng.next() * 8, cur: null });
  if (e.dead || e.spawning > 0 || e.brokenT > 0 || e.hitstun > 0.5) { T.cur = null; return false; }
  if (T.cur) { runTrick(e, dt, w, T); return true; }
  T.cd -= dt; T.exCd -= dt;
  const p = w.player;
  if (!p || p.dead || !calm(e)) return false;
  // the execution: once the boss is hurt, every half minute or so
  if (level >= 3 && T.exCd <= 0 && e.hp < e.maxHp * 0.6) { start(e, w, T, 'execute'); T.exCd = 28 + w.rng.next() * 8; T.cd = Math.max(T.cd, 6); return true; }
  if (T.cd > 0) return false;
  const pool = ['feint', 'delay'];
  if (level >= 2) pool.push('combo');
  if (level >= 3) pool.push('grab', 'combo');
  start(e, w, T, pool[Math.floor(w.rng.next() * pool.length)]);
  T.cd = (level >= 3 ? 6 : 8) + w.rng.next() * 4;
  return true;
}

function start(e, w, T, kind) {
  T.cur = { kind, t: 0, step: 0, ev: [] };
  const at = (time, fn) => T.cur.ev.push({ at: time, fn, done: false });
  const p = () => w.player || { x: e.x, y: e.y };
  e.vx = e.vy = 0;
  switch (kind) {
    case 'feint': {
      // a slow, huge warning that never lands…
      w.strike({ shape: 'circle', x: e.x, y: e.y - 10, r: 300, dur: 0.6, mult: 0, tone: 'fire', owner: e });
      e.warn = 0.6;
      w.sfx('telegraph');
      at(0.6, () => {
        w.fx.callout(e.x, e.y - e.r * 2 - 40, 'หลอก!', '#ff6a8a'); w.sfx('pierceWarn'); w.shake(4, 0.15);
        const t = p(), a = Math.atan2(t.y - e.y, t.x - e.x), len = Math.min(620, Math.hypot(t.x - e.x, t.y - e.y) + 180);
        T.cur.lunge = { a, len, x0: e.x, y0: e.y };
        w.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: a, len, width: e.r * 1.6, dur: 0.45, mult: 1.7, tone: 'pierce', pierce: true, kb: 520, owner: e });
      });
      at(1.05, () => { T.cur.dash = 0.22; });
      T.cur.end = 1.4;
      break;
    }
    case 'delay': {
      const t = p(), hold = 1.15 + w.rng.next() * 0.55;
      w.strike({ shape: 'circle', x: t.x, y: t.y, r: 150, dur: hold, mult: 1.5, tone: 'earth', kb: 380, owner: e });
      e.warn = 0.4; w.sfx('telegraph');
      at(hold, () => { w.shake(8, 0.25); w.sfx('slam'); const t2 = p(); w.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: Math.atan2(t2.y - e.y, t2.x - e.x), r: 380, arc: 1.2, dur: 0.5, mult: 1.2, tone: 'fire', owner: e }); });
      T.cur.end = hold + 0.6;
      break;
    }
    case 'combo': {
      let time = 0;
      const shapes = ['cone', 'line', 'circle'];
      for (let i = 0; i < 3; i++) {
        const gap = 0.3 + w.rng.next() * 0.35, kind2 = shapes[(i + Math.floor(w.rng.next() * 3)) % 3];
        at(time, () => {
          const t = p(), a = Math.atan2(t.y - e.y, t.x - e.x);
          if (kind2 === 'cone') w.strike({ shape: 'cone', x: e.x, y: e.y - 10, angle: a, r: 340, arc: 1.4, dur: 0.5, mult: 1.1, tone: 'shadow', owner: e });
          else if (kind2 === 'line') w.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: a, len: 560, width: 70, dur: 0.45, mult: 1.2, tone: 'volt', owner: e });
          else w.strike({ shape: 'circle', x: t.x, y: t.y, r: 120, dur: 0.55, mult: 1.2, tone: 'fire', owner: e });
          w.sfx('telegraph'); e.warn = 0.8;
        });
        time += 0.5 + gap;
      }
      T.cur.end = time + 0.2;
      break;
    }
    case 'grab': {
      const t = p(), a = Math.atan2(t.y - e.y, t.x - e.x), len = Math.min(520, Math.hypot(t.x - e.x, t.y - e.y) + 120);
      w.strike({ shape: 'line', x: e.x, y: e.y - 10, angle: a, len, width: e.r * 1.4, dur: 0.6, mult: 0, pct: 0.5, tone: 'pierce', pierce: true, kb: 200, owner: e });
      w.sfx('pierceWarn'); e.warn = 1;
      w.fx.callout(e.x, e.y - e.r * 2 - 40, 'จับทุ่ม!', '#ff6a8a');
      T.cur.lunge = { a, len, x0: e.x, y0: e.y };
      at(0.6, () => { T.cur.dash = 0.2; });
      T.cur.end = 1.0;
      break;
    }
    case 'execute': {
      // the one safe spot: a circle of light somewhere away from the hero (or, half the time, right under the boss)
      const t = p(), A = w.arena, pad = 140;
      let sx = e.x, sy = e.y, safeR = e.r + 70;
      if (w.rng.next() < 0.55) {
        for (let i = 0; i < 8; i++) {
          const x = pad + w.rng.next() * (A.w - pad * 2), y = pad + 40 + w.rng.next() * (A.h - pad * 2 - 40);
          if (Math.hypot(x - t.x, y - t.y) > 260) { sx = x; sy = y; break; }
        }
        safeR = 115;
      }
      const cast = 2.6;
      w.announce('ท่าประหาร! วิ่งเข้าวงแสง หรือหลบให้ทันจังหวะ');
      w.sfx('roar'); w.sfx('pierceWarn'); w.shake(6, 0.6);
      w.strike({ shape: 'ring', x: sx, y: sy, r: 3200, inner: safeR, dur: cast, mult: 0, pct: 0.85, pierce: true, tone: 'pierce', kb: 0, owner: e });
      w.strike({ shape: 'circle', x: sx, y: sy, r: safeR, dur: cast, mult: 0, tone: 'holy', owner: e });
      e.warn = 1;       // v8.6: no longer immune while it casts (bosses are never untouchable, see battle/bossGuard.js)
      at(cast, () => { w.shake(16, 0.7); w.sfx('slam'); w.sfx('shatter'); });
      T.cur.end = cast + 0.6;
      break;
    }
    default: T.cur.end = 0.1;
  }
}

function runTrick(e, dt, w, T) {
  const c = T.cur;
  c.t += dt;
  e.vx *= 0.8; e.vy *= 0.8;
  for (const ev of c.ev) if (!ev.done && c.t >= ev.at) { ev.done = true; try { ev.fn(); } catch { /* target left */ } }
  if (c.dash > 0 && c.lunge) {
    // the boss follows its own lunge line
    const sp = c.lunge.len / 0.22;
    e.x += Math.cos(c.lunge.a) * sp * dt; e.y += Math.sin(c.lunge.a) * sp * dt;
    w.clampBody?.(e);
    c.dash -= dt;
    if (w.particles && Math.random() < 0.6) w.particles.spawn({ x: e.x, y: e.y - e.r, vx: -Math.cos(c.lunge.a) * 120, vy: -Math.sin(c.lunge.a) * 120, life: 0.4, size: 10, size2: 2, color: 'rgba(255,60,100,0.6)', drag: 4, glow: true });
  }
  if (e.warn > 0) e.warn = Math.max(0, e.warn - dt * 0.6);
  if (c.t >= c.end) { T.cur = null; e.warn = 0; }
}

// Mobs (and bosses) sometimes hold a telegraphed swing a moment longer — the classic delayed attack. Generic: it pauses
// the behaviour's clock while the warning is up, so any attack with a wind-up can be delayed.
export function delayedSwing(e, dt, w, level) {
  if (!level || e.dead) return false;
  if (!(e.warn > 0)) { e.holdDone = false; return false; }
  if (e.holdT > 0) { e.holdT -= dt; e.vx *= 0.85; e.vy *= 0.85; return true; }
  if (!e.holdDone && e.warn > 0.55) {
    e.holdDone = true;
    const chance = (e.type.boss ? 0.3 : 0.22) + level * 0.05;
    if (w.rng.next() < chance) { e.holdT = (e.type.boss ? 0.35 : 0.2) + w.rng.next() * (e.type.boss ? 0.35 : 0.25); return true; }
  }
  return false;
}
export { TAU };
