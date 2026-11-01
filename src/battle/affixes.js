// Elite affixes (คำสาปของมอนสเตอร์) for the Underworld Tower: each changes how a monster must be fought.
// Host-side only (the co-op scene runs monsters on the host). Names and colours: data/tower.js AFFIXES.
import { AFFIXES } from '../data/tower.js';

const TAU = Math.PI * 2;

export function applyAffixes(e, list = []) {
  e.affixes = list.filter((a) => AFFIXES[a]);
  e.tempo = 1;
  for (const a of e.affixes) {
    if (a === 'swift') e.tempo *= 1.3;
    if (a === 'armored') e.def = Math.round((e.def || 0) * 2 + 4);
    if (a === 'giant') { e.maxHp = e.hp = Math.round(e.maxHp * 1.7); e.r = Math.round(e.r * 1.2); e.superArmor = true; e.sizeK = 1.25; }
    if (a === 'warded') e.wardCycle = 3 + Math.random() * 3;
  }
  e.lastHurtAt = 0;
  return e;
}
export const hasAffix = (e, a) => !!e?.affixes?.includes(a);
export const tempoOf = (e) => (e.tempo || 1) * (e.frenzy ? 1.35 : 1);

// every frame, before the monster's own behaviour
export function tickAffixes(e, dt, world) {
  if (!e.affixes?.length || e.dead) return;
  e.affixT = (e.affixT || 0) + dt;
  if (e.invuln > 0) e.invuln = Math.max(0, e.invuln - dt);
  // warded: a golden shell for 2.2 s every ~7 s — wait it out, then strike (bosses carry armour per phase instead, see bossArmor.js)
  if (hasAffix(e, 'warded') && !e.type?.boss) {
    e.wardCycle -= dt;
    if (e.wardCycle <= 0) { e.wardCycle = 7; e.invuln = 2.2; world.fx.ring(e.x, e.y - e.r, e.r, e.r + 30, '#ffe89a', 0.5, 6); world.sfx?.('guard'); }
  }
  if (hasAffix(e, 'frenzied') && !e.frenzy && e.hp < e.maxHp * 0.4) {
    e.frenzy = true; e.atk = Math.round(e.atk * 1.3);
    world.fx.callout(e.x, e.y - e.r * 2 - 30, 'คลั่ง!', '#ff5a5a'); world.sfx?.('roar');
  }
  if (hasAffix(e, 'regen') && e.affixT - (e.lastHurtAt || 0) > 3 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
  if (hasAffix(e, 'molten')) {
    e.moltenT = (e.moltenT || 0) - dt;
    if (e.moltenT <= 0 && Math.hypot(e.vx || 0, e.vy || 0) > 30) { e.moltenT = 1.1; world.pool({ x: e.x, y: e.y, r: 42, dur: 3.2, kind: 'fire', mult: 0.3, owner: e }); }
  }
  // shadow: fades out, then reappears behind its target
  if (hasAffix(e, 'shadow')) {
    e.shadowT = (e.shadowT ?? 4 + Math.random() * 3) - dt;
    if (e.shadowT <= 0 && !e.blinkT) { e.blinkT = 0.8; e.hidden = 1; if (!e.type?.boss) e.invuln = Math.max(e.invuln || 0, 0.8); }   // a boss that blinks stays hittable (more health instead)
    if (e.blinkT > 0) {
      e.blinkT -= dt;
      if (e.blinkT <= 0) {
        const p = world.player;
        if (p) { const a = Math.atan2(p.y - e.y, p.x - e.x); e.x = p.x + Math.cos(a) * (e.r + 50); e.y = p.y + Math.sin(a) * 30; world.clampBody?.(e); }
        e.hidden = 0; e.blinkT = 0; e.shadowT = 6 + Math.random() * 3;
        world.particles.burst(e.x, e.y - e.r, 16, { color: ['#7a6aa8', '#14121c'], speedMin: 60, speedMax: 200, life: 0.4, size: 4, drag: 3 });
      }
    }
  }
}

// a monster with these affixes hits differently
export function affixHitOpts(e) {
  if (!e?.affixes?.length) return null;
  const o = {};
  if (hasAffix(e, 'piercing')) { o.unblockable = true; o.pierce = true; }
  if (hasAffix(e, 'frost')) o.frost = true;
  return Object.keys(o).length ? o : null;
}
export function affixAfterHit(e, world) {
  if (hasAffix(e, 'vampiric') && !e.dead) {
    const n = Math.round(e.maxHp * 0.05);
    e.hp = Math.min(e.maxHp, e.hp + n);
    world.fx.number(e.x, e.y - e.r * 2 - 20, `+${n}`, 'heal');
  }
}
export function affixOnHurt(e) { e.lastHurtAt = e.affixT || 0; }

// on death: explode or split
export function affixOnDeath(e, world) {
  if (!e.affixes?.length) return;
  if (hasAffix(e, 'volatile')) world.strike({ shape: 'circle', x: e.x, y: e.y, r: 110 + e.r, dur: 0.9, mult: 1.4, owner: e, fire: true, tone: 'fire' });
  if (hasAffix(e, 'splitting') && !e.splitChild) {
    for (let i = 0; i < 2; i++) {
      const c = world.spawnEnemy(e.type.id, e.x + (i ? 36 : -36), e.y + 8);
      if (!c) continue;
      applyAffixes(c, e.affixes.filter((a) => a !== 'splitting' && a !== 'giant'));
      c.splitChild = true; c.maxHp = c.hp = Math.max(1, Math.round(e.maxHp * 0.35)); c.sizeK = 0.75;
    }
  }
}

// drawn under the monster: a coloured aura ring per affix, and the affix names above elites
export function drawAffixes(ctx, e, time, h) {
  if (!e.affixes?.length || e.dead) return;
  e.affixes.forEach((a, i) => {
    const c = AFFIXES[a].color;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = c; ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -time * 30 * (i % 2 ? -1 : 1);
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r + 8 + i * 6, (e.r + 8 + i * 6) * 0.45, 0, 0, TAU); ctx.stroke(); ctx.restore();
  });
  const label = e.affixes.map((a) => AFFIXES[a].name).join(' · ');
  ctx.save(); ctx.font = '700 11px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,10,8,0.85)'; ctx.fillStyle = AFFIXES[e.affixes[0]].color;
  ctx.strokeText(label, e.x, e.y - h - 18); ctx.fillText(label, e.x, e.y - h - 18); ctx.restore();
}

// the golden shell of an invulnerable monster (the warded curse on ordinary monsters; bosses are never immune, see bossGuard.js)
export function drawInvuln(ctx, e, time, h) {
  if (!(e.invuln > 0) || e.dead) return;
  const k = 0.5 + 0.2 * Math.sin(time * 10);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = Math.max(e.r + 18, h * 0.55), cy = e.y - h * 0.45;
  const g = ctx.createRadialGradient(e.x, cy, r * 0.6, e.x, cy, r);
  g.addColorStop(0, 'rgba(255,232,154,0)'); g.addColorStop(1, `rgba(255,232,154,${(0.45 * k).toFixed(3)})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255,243,196,${(0.8 * k).toFixed(3)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x, cy, r, 0, TAU); ctx.stroke();
  ctx.restore();
}
