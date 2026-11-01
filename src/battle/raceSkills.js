// Bloodline active skill (key R). Numbers come from data/races.js.
import { getRace } from '../data/races.js';
import { nearestEnemy } from './moves.js';
import { castKit, tickKit } from './raceKit.js';

export function createRaceSkill(raceId, cdMult = 1) {
  const race = getRace(raceId);
  if (!race) return null;
  return { id: race.skill.id, race: race.id, name: race.skill.name, icon: race.skill.icon, v: race.skill, cd: 0, max: race.skill.cooldown * cdMult, color: race.color };
}

export function tickRaceSkill(s, dt, world = null) {
  if (s && s.cd > 0) s.cd = Math.max(0, s.cd - dt);
  if (s && world) tickKit(s, dt, world);
}

// Returns true when the skill fired.
export function castRaceSkill(world) {
  const s = world.raceSkill, p = world.player;
  if (!s || p.dead) return false;
  if (s.cd > 0) { world.sfx('error'); return false; }
  const v = s.v;
  // v7 bloodlines: the skill is a kit of steps (battle/raceKit.js)
  if (v.kit) {
    if (!castKit(world, s)) return false;
    s.cd = s.max;
    world.onSkillCast?.(s.id);
    return true;
  }
  switch (s.id) {
    case 'focus': {
      p.buffs.focusT = v.duration;
      world.fx.ring(p.x, p.y - 30, 20, 90, '#d9a84e', 0.5, 6);
      world.particles.burst(p.x, p.y - 40, 20, { color: ['#ffd889', '#d9a84e'], speedMin: 40, speedMax: 160, life: 0.6, size: 3, drag: 3, glow: true });
      world.sfx('levelup');
      break;
    }
    case 'shadow_step': {
      const e = nearestEnemy(world, p, v.reach);
      if (!e) { world.toast?.('ไม่มีศัตรูในระยะ', 'warn', 'race-range'); world.sfx('error'); return false; }
      world.particles.burst(p.x, p.y - 30, 20, { color: ['#4a5a8a', '#9fb8ff', '#1a1430'], speedMin: 60, speedMax: 200, life: 0.4, size: 4, drag: 3 });
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      p.x = e.x + Math.cos(a) * (e.r + p.r + 12); p.y = e.y + Math.sin(a) * (e.r + p.r + 12);
      world.clampBody?.(p);
      const back = Math.atan2(e.y - p.y, e.x - p.x);
      p.facing = back; p.flip = Math.cos(back) < 0; p.iframes = Math.max(p.iframes, 0.6);
      world.fx.slash(p.x, p.y - 18, back, 2.4, 80, 1.8, '#e8eeff', false, '#4a7fd8');
      world.playerStrike(e, v.power, { forceCrit: true, src: 'race', kx: Math.cos(back) * 260, ky: Math.sin(back) * 260, stun: 0.5 });
      world.particles.burst(p.x, p.y - 30, 20, { color: ['#4a5a8a', '#9fb8ff'], speedMin: 60, speedMax: 200, life: 0.4, size: 4, drag: 3 });
      world.hitStop(0.08); world.shake(5, 0.2); world.sfx('dash'); world.sfx('crit');
      break;
    }
    case 'stone_skin': {
      p.buffs.stoneT = v.duration;
      world.fx.ring(p.x, p.y - 30, 60, 24, '#b8a48a', 0.5, 8);
      world.particles.burst(p.x, p.y - 20, 24, { color: ['#8a8070', '#b8a48a', '#5b5450'], speedMin: 60, speedMax: 180, life: 0.5, size: 4, drag: 3, shape: 1 });
      world.sfx('slam'); world.shake(4, 0.2);
      break;
    }
    case 'bloom': {
      p.buffs.bloomT = v.duration;
      world.addSnare({ x: p.x, y: p.y, r: v.radius, t: 0, dur: v.duration, delay: 0.01, slow: v.slow, power: 0, struck: true, bloom: true });
      world.fx.ring(p.x, p.y - 10, 20, v.radius, '#8fd06a', 0.6, 6);
      world.particles.burst(p.x, p.y - 30, 30, { color: ['#8fd06a', '#d6f59a', '#f3a6c8'], speedMin: 40, speedMax: 160, life: 0.9, size: 3, drag: 2, grav: -80, glow: true });
      world.sfx('potion');
      break;
    }
    case 'ember_breath': {
      world.addCone({ from: () => (p.dead ? null : { x: p.x + Math.cos(p.facing) * 20, y: p.y - 42 + Math.sin(p.facing) * 10, dir: p.facing }),
        range: v.range, arc: (v.arc * Math.PI) / 180, ticks: v.ticks, interval: v.interval, power: v.power, src: 'race', t: 0, n: 0 });
      world.sfx('roar');
      break;
    }
    case 'ash_night': {
      p.buffs.ashT = v.duration;
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || Math.hypot(e.x - p.x, e.y - p.y) > v.radius + e.r) continue;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        world.playerStrike(e, v.power, { src: 'race', kx: Math.cos(a) * 360, ky: Math.sin(a) * 360, burn: true });
      }
      world.fx.ring(p.x, p.y - 20, 20, v.radius, '#ffd08a', 0.5, 12);
      world.fx.ring(p.x, p.y - 20, 10, v.radius * 0.7, '#1c1412', 0.4, 8);
      world.particles.burst(p.x, p.y - 30, 50, { color: ['#1c1412', '#ffd08a', '#ff8a3d', '#5a4a40'], speedMin: 120, speedMax: 380, life: 0.8, size: 5, drag: 3, glow: true });
      world.hitStop(0.08); world.shake(9, 0.4); world.sfx('roar');
      break;
    }
    default: return false;
  }
  s.cd = s.max;
  world.onSkillCast?.(s.id);
  return true;
}
