// Guard, parry and counter — the heart of Emberhold's defence.
//
//   hold GUARD (L / C / right mouse / shield button): an energy shield faces where the hero looks. Hits from the
//     front lose 75% of their damage but wear the guard meter down; at zero the guard breaks (short stagger).
//   PARRY: raise the guard just before a hit lands (first 0.2 s of the guard) — no damage, the attacker is
//     knocked off balance, and the hero gets a COUNTER window.
//   COUNTER: attacking inside the window turns the next move into a counter: ×2.2 power, always critical.
//   Ground blasts and lingering hazards (red telegraphs, pools) cannot be guarded — read them and dodge.
//   Mashing guard does not work: re-raising it within 0.35 s of lowering it gives no parry window.
export const GUARD = Object.freeze({
  parryWindow: 0.2,
  relock: 0.35,
  frontArc: 1.75,          // radians each side of facing that the shield covers (≈100°)
  reduce: 0.75,
  drainBase: 9,
  drainScale: 230,         // meter drained = base + share of max HP the hit was worth × scale
  meterMax: 100,
  regen: 32,               // per second, after regenDelay without guarding
  regenDelay: 0.6,
  breakStun: 0.85,
  counterT: 1.15,
  counterPower: 2.2,
  moveMult: 0.42,
  parryRefund: 30,
  pvpParryStagger: 0.65,
});

export function createGuardState() {
  return { guarding: false, guardT: 0, releasedT: 9, meter: GUARD.meterMax, idleT: 9, breakT: 0, staggerT: 0, counterT: 0, parryFx: 0, blockFx: 0, armed: false };
}

// Called every frame from updatePlayer. Returns true while the hero cannot act (guard broken / staggered).
export function updateGuard(p, intent, dt, world) {
  const g = p.guard;
  if (g.parryFx > 0) g.parryFx -= dt;
  if (g.blockFx > 0) g.blockFx -= dt;
  if (g.counterT > 0) g.counterT -= dt;
  if (g.staggerT > 0) { g.staggerT -= dt; g.guarding = false; return true; }
  if (g.breakT > 0) {
    g.breakT -= dt; g.guarding = false;
    if (g.breakT <= 0) g.meter = GUARD.meterMax * 0.5;
    return true;
  }
  const want = !!intent.guard && !p.dead && p.dashT <= 0 && !p.rush && !p.lunge;
  if (want && !g.guarding) {
    g.guarding = true; g.guardT = 0;
    g.armed = g.releasedT >= GUARD.relock;           // a fresh raise gets a parry window; a mashed one does not
    // raising the guard cancels a wind-up or a charge, never a committed active frame
    if (p.move && p.move.phase !== 'active') { p.move = null; p.buffered = false; }
    p.charging = false; p.charge = 0; p.chargeReady = false; p.holdT = 0;
    world.onGuardUp?.();
  } else if (!want && g.guarding) {
    g.guarding = false; g.releasedT = 0;
  }
  if (g.guarding) { g.guardT += dt; g.idleT = 0; }
  else {
    g.releasedT += dt; g.idleT += dt;
    if (g.idleT > GUARD.regenDelay) g.meter = Math.min(GUARD.meterMax, g.meter + GUARD.regen * dt);
  }
  return false;
}

export const inParryWindow = (p) => p.guard.guarding && p.guard.armed && p.guard.guardT <= GUARD.parryWindow;

// Is a hit coming along knockback (kx, ky) in front of the shield? (no knockback = treat as frontal)
export function facesShield(p, kx, ky, src = null) {
  let from;
  if (src && Number.isFinite(src.x) && Number.isFinite(src.y)) from = Math.atan2(src.y - p.y, src.x - p.x);   // where the attacker stands
  else if (!kx && !ky) return true;
  else from = Math.atan2(-ky, -kx);                     // knockback points away from the attacker
  let d = from - p.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= GUARD.frontArc;
}

// Decide what a hit does against the guard. Returns { kind: 'parry' | 'block' | 'break' | null, amount }.
export function guardHit(p, amount, kx, ky, opts = {}) {
  const g = p.guard;
  if (!g || !g.guarding || opts.unblockable || !facesShield(p, kx, ky, opts.from || opts.attacker)) return { kind: null, amount };
  if (inParryWindow(p)) {
    g.parryFx = 0.45; g.counterT = GUARD.counterT; g.armed = false;
    g.meter = Math.min(GUARD.meterMax, g.meter + GUARD.parryRefund);
    return { kind: 'parry', amount: 0 };
  }
  const drain = (GUARD.drainBase + (amount / Math.max(1, p.maxHp)) * GUARD.drainScale) * (1 - Math.min(0.6, p.stats?.guardPower || 0));
  g.meter -= drain; g.blockFx = 0.25;
  const left = Math.max(1, Math.round(amount * (1 - GUARD.reduce)));
  if (g.meter <= 0) {
    g.meter = 0; g.guarding = false; g.breakT = GUARD.breakStun; g.releasedT = 0;
    return { kind: 'break', amount: left };
  }
  return { kind: 'block', amount: left };
}

// The shield as drawn in the world (energy crescent + gilded buckler rim), plus parry / break flashes.
export function drawGuard(ctx, p, time) {
  const g = p.guard;
  if (!g) return;
  const show = g.guarding || g.parryFx > 0 || g.blockFx > 0;
  const cx = p.x, cy = p.y - 34;
  if (show) {
    const a = p.facing;
    const raise = g.guarding ? Math.min(1, g.guardT / 0.08) : 0.6;
    const fresh = inParryWindow(p);
    const r = 46;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    // inner glow
    const grad = ctx.createRadialGradient(r * 0.6, 0, 4, r * 0.6, 0, r * 0.9);
    grad.addColorStop(0, fresh ? 'rgba(255,248,220,0.55)' : 'rgba(255,214,140,0.32)');
    grad.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.05, 1.05); ctx.arc(0, 0, r - 16, 1.05, -1.05, true); ctx.closePath(); ctx.fill();
    // crescent edge
    ctx.globalAlpha = 0.55 + 0.35 * raise;
    ctx.strokeStyle = fresh ? '#fff6dc' : '#f5d48a';
    ctx.lineWidth = fresh ? 5 : 3.5;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.0, 1.0); ctx.stroke();
    // runes along the rim (rotate slowly)
    ctx.fillStyle = '#ffe2a0';
    for (let i = -2; i <= 2; i++) {
      const t = i * 0.4 + Math.sin(time * 3 + i) * 0.03;
      ctx.beginPath(); ctx.arc(Math.cos(t) * (r - 7), Math.sin(t) * (r - 7), 2.2, 0, Math.PI * 2); ctx.fill();
    }
    if (g.blockFx > 0) {
      ctx.globalAlpha = g.blockFx * 3;
      ctx.lineWidth = 8; ctx.strokeStyle = '#ffd08a';
      ctx.beginPath(); ctx.arc(0, 0, r + 4, -0.7, 0.7); ctx.stroke();
    }
    ctx.restore();
  }
  if (g.parryFx > 0) {
    const k = g.parryFx / 0.45;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,248,220,${(k * 0.9).toFixed(3)})`;
    ctx.lineWidth = 6 * k + 1;
    ctx.beginPath(); ctx.arc(cx, cy, 30 + (1 - k) * 70, 0, Math.PI * 2); ctx.stroke();
    // eight-point star burst
    ctx.translate(cx + Math.cos(p.facing) * 40, cy + Math.sin(p.facing) * 40);
    ctx.fillStyle = `rgba(255,236,180,${k.toFixed(3)})`;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(26 * k + 6, 0); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // guard meter: a thin arc under the hero, only while it is not full
  if (g.meter < GUARD.meterMax - 0.5 || g.breakT > 0) {
    const frac = g.breakT > 0 ? 0 : g.meter / GUARD.meterMax;
    ctx.save();
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,12,9,0.7)';
    ctx.beginPath(); ctx.arc(p.x, p.y + 2, 30, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.strokeStyle = g.breakT > 0 ? '#ef6a52' : frac < 0.3 ? '#ff9a5a' : '#f5d48a';
    ctx.beginPath(); ctx.arc(p.x, p.y + 2, 30, Math.PI * 0.85 - Math.PI * 0.7 * frac, Math.PI * 0.85); ctx.stroke();
    ctx.restore();
  }
  if (g.counterT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, g.counterT * 3);
    ctx.font = '700 13px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = '#ffe2a0';
    ctx.strokeText('เคาน์เตอร์!', p.x, p.y - 128); ctx.fillText('เคาน์เตอร์!', p.x, p.y - 128);
    ctx.restore();
  }
}
