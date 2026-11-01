// Active skills in battle. Numbers come from data/skills.js via systems/skills.js (slottedSkills).
// Damage goes through world.playerStrike (src 'skill'), so skill-power bonuses and combos apply.
import { castSpec, replaySpec } from './skillCast.js';
import { getSkill, rankValues } from '../data/skills.js';

export function createSkillBar(slotted) {
  return slotted.map((s) => (s ? { ...s, cd: 0 } : null));
}

export function tickSkills(bar, dt) {
  for (const s of bar) if (s && s.cd > 0) s.cd = Math.max(0, s.cd - dt);
}

// Returns true when the skill fired (false on cooldown / nothing to do).
// v8: every skill is data (data/skills.js + data/skillbook.js) run by battle/skillCast.js; the cast is shared with
// the other players (world.netSkill) so they see the same effects.
export function castSkill(bar, index, world) {
  const s = bar[index];
  const p = world.player;
  if (!s || p.dead) return false;
  if (s.cd > 0) { world.sfx('error'); return false; }
  if (!world.sk) return false;
  const msg = castSpec(world, p, s.skill, s.v);
  if (!msg) { world.sfx('error'); return false; }
  s.max = s.v.cooldown * (p.stats.skillCdMult || 1);
  s.cd = s.max;
  world.onSkillCast?.(s.id);
  world.netSkill?.({ ...msg, rk: s.rank });
  return true;
}

// Another player's cast, replayed as visuals only (their hits arrive as hit reports).
export function replaySkill(world, msg) {
  const skill = msg && typeof msg.id === 'string' ? getSkill(msg.id) : null;
  if (!skill || skill.kind !== 'active') return;
  replaySpec(world, skill, rankValues(skill, Math.max(1, Math.min(3, msg.rk | 0 || 1))), msg);
}

// Snare zones: strike once after a short delay, then slow everything inside until they expire.
export function updateSnares(snares, dt, world) {
  for (let i = snares.length - 1; i >= 0; i--) {
    const z = snares[i];
    z.t += dt;
    if (!z.struck && z.t >= z.delay) {
      z.struck = true;
      world.shake(4, 0.15); world.sfx('hit');
      world.particles.burst(z.x, z.y, 22, { color: ['#7da853', '#c9e48e', '#3f612b'], speedMin: 60, speedMax: 220, life: 0.5, size: 4, drag: 3, shape: 1 });
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r) continue;
        world.playerStrike(e, z.power, { src: 'skill', kx: 0, ky: 0 });
      }
    }
    if (z.struck) for (const e of world.enemies) {
      if (e.dead || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r) continue;
      e.slowT = 0.2; e.slowMult = e.type.boss ? Math.min(1, z.slow + 0.3) : z.slow;
    }
    if (z.t >= z.delay + z.dur) snares.splice(i, 1);
  }
}

export function drawSnares(ctx, snares, time) {
  for (const z of snares) {
    const k = Math.min(1, z.t / z.delay);
    const fade = Math.min(1, (z.delay + z.dur - z.t) / 0.4);
    ctx.save();
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = z.bloom ? '#8fd06a' : '#3f612b'; ctx.fillStyle = z.bloom ? 'rgba(143,208,106,0.14)' : 'rgba(111,154,74,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (z.struck && z.bloom) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + time * 0.2, rr = z.r * (0.35 + 0.55 * ((i * 37) % 10) / 10);
        const x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr * 0.6, b = 4 + 1.5 * Math.sin(time * 3 + i);
        ctx.fillStyle = i % 3 ? '#f3a6c8' : '#fff3c4';
        for (let k = 0; k < 5; k++) { const pa = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(pa) * b, y + Math.sin(pa) * b * 0.7, b * 0.7, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#e0b45a'; ctx.beginPath(); ctx.arc(x, y, b * 0.55, 0, Math.PI * 2); ctx.fill();
      }
    } else if (z.struck) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + time * 0.3, rr = z.r * (0.4 + 0.5 * ((i * 37) % 10) / 10);
        const x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr * 0.6;
        ctx.fillStyle = '#58733a'; ctx.strokeStyle = '#1a120e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x - 2, y - 14, x + 1, y - 24); ctx.quadraticCurveTo(x + 3, y - 12, x + 5, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
