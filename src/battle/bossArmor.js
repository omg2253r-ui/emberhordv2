// Boss armour runtime (host side) + its drawing. Numbers and kinds live in data/bossArmor.js.
import { armorSpec } from '../data/bossArmor.js';

const TAU = Math.PI * 2;
const hpPhase = (e) => { const f = e.hp / e.maxHp; return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; };
const planFor = (e, ph) => e.armorPlan[Math.min(Math.max(1, ph), e.armorPlan.length) - 1];

// called once, after the boss's final max HP is known
export function initBossArmor(e, kind) {
  const spec = armorSpec(kind);
  // armour that grows back on a clock (Marichi's shield of fire) is sized by ONE health bar; the rest by the whole boss
  const base = spec.regen > 0 ? e.maxHp / (e.bars || 1) : e.maxHp;
  e.armorPlan = spec.pct.map((p) => Math.max(1, Math.round(base * p)));
  e.armorRegen = spec.regen || 0; e.armorBack = spec.back || null; e.armorRegenT = 0;
  e.armorPhase = 1; e.armorMax = e.armorPlan[0]; e.armor = e.armorMax;
}

function refill(e, world, text) {
  e.armorMax = planFor(e, e.armorPhase); e.armor = e.armorMax; e.armorRegenT = 0;
  world.fx.ring(e.x, e.y - e.r, e.r, e.r + 34, '#c8d4e6', 0.5, 6); world.fx.callout(e.x, e.y - e.r * 2 - 40, text, '#c8d4e6'); world.sfx?.('guard');
}

// every frame (host): a new phase brings a fresh layer of armour; a broken one may grow back
export function tickBossArmor(e, dt, world) {
  if (!e.armorPlan || e.dead) return;
  const ph = Math.max(e.armorPhase, e.ai?.phase || hpPhase(e));
  const up = ph > e.armorPhase;
  if (up) e.armorPhase = ph;
  if (e.armorRegenT > 0) { e.armorRegenT -= dt; if (e.armorRegenT <= 0) refill(e, world, e.armorBack || 'เกราะฟื้น!'); return; }
  if (up) refill(e, world, `เกราะเฟส ${ph} ฟื้น!`);
}

// the armour has been shot away by the hero's blows
export function breakBossArmor(e) { e.armor = 0; if (e.armorRegen > 0) e.armorRegenT = e.armorRegen; }
// a boss move strips its own armour (Marichi's great nova)
export function burnOutArmor(e, secs) { e.armor = 0; e.armorRegenT = secs; }

// the steel rim around the boss and how much armour is left (works for views of other players' bosses too)
export function drawBossArmor(ctx, e, time, tall) {
  if (!(e.armor > 0) || e.dead) return;
  const max = e.armorMax || e.armor, k = 0.5 + 0.15 * Math.sin(time * 6);
  ctx.save(); ctx.strokeStyle = `rgba(200,212,230,${(0.25 + 0.5 * k).toFixed(3)})`; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.ellipse(e.x, e.y - tall * 0.45, e.r + 22, tall * 0.6, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const bw = 140, by = e.y - tall - 30;
  ctx.fillStyle = 'rgba(20,12,9,0.8)'; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 8);
  ctx.fillStyle = '#b8c4d8'; ctx.fillRect(e.x - bw / 2, by, bw * Math.max(0, Math.min(1, e.armor / max)), 6);
  ctx.font = '700 10px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(15,10,8,0.85)'; ctx.fillStyle = '#e6ecf5';
  const label = `เกราะ ${Math.ceil(e.armor).toLocaleString('th-TH')}`;
  ctx.strokeText(label, e.x, by - 4); ctx.fillText(label, e.x, by - 4);
  ctx.restore();
}
