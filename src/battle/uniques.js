// Unique weapon powers — a passive that works on every hit and a signature skill on the charged attack.
// They are deliberately strong in PvE. In PvP every number below is scaled down (UNIQUE_PVP_SCALE, world.pvp), so both
// players still win by reading, guarding and countering rather than by the weapon alone.
// v9.1: the Heaven Scythe and the Sovereign twins hit a little harder in PvE and a little softer in PvP than before
// (PvP scale 0.50 -> 0.42 / 0.40 on top of the larger PvE numbers: net PvP power is lower than in v9.0).
//
//   ดาบคู่ราชันมังกร (sovereign) — the secret twin blades
//     passive  "สองพี่น้องมังกร": every 5th landed hit (and every counter) releases a dragon echo: 80% of the
//              hit again on the target and everything within 130 px. Each hit adds a stack of "ลมหายใจราชัน"
//              (+3% damage, up to 10, fades 2.5 s after the last hit). A kill heals 6% max HP.
//     skill    "อัคนิ-นิมิต" (charged attack): two crossing blasts of fire and starlight, 150% each, around the target.
//   เคียวสวรรค์ (judgment) — the Heaven Scythe (v8.1: tuned to the same "broken" tier as the sovereign twins)
//     passive  "ตราพิพากษา": each hit brands the target (max 5; a counter lays 2 at once; brands last 10 s).
//              Every brand on a target makes it take +5% damage from you. The fifth brand detonates — a holy burst of
//              300%, always critical, that splashes 150 px and passes one brand to every other enemy in the blast.
//              A kill heals 6% max HP.
//     skill    "คำพิพากษาสวรรค์" (charged attack): every enemy within 300 px gets +3 brands, then ALL their brands
//              detonate at once (65% per brand, always critical), and a pillar of verdict falls on the target (120%, 160 px).
//   In PvP every number above is scaled by UNIQUE_PVP_SCALE (judgment 0.42, sovereign 0.40): burst/skill/verdict damage,
//   brand amp and heal all shrink with it, brands laid by the skill and by counters stay at 2 / 1, and no brand is passed on.
//   ดาบสุริยคราส (eclipse) — the secret blade (v8)
//     passive  "คราสสลับฟ้า": every 7th landed hit is a full eclipse — a ring of black sun around the target, 200%,
//              always critical, 150 px, and a kill within 3 s of it heals 4% max HP.
//     skill    "ตะวันดับ" (charged attack): everything within 240 px is dragged toward the target and struck twice (120%).
import { balOf } from '../data/weaponBalance.js';

export const UNIQUES = Object.freeze({
  sovereign: {
    name: 'สองพี่น้องมังกร', skill: 'อัคนิ-นิมิต', color: '#ff5a3a', color2: '#7fe8ff',
    passive: 'ทุกฮิตที่ 5 และทุกเคาน์เตอร์ ปลุกเงามังกรฟันซ้ำ 90% ใส่เป้าและรอบตัว · ทุกฮิตสะสมลมหายใจราชัน +3.5% ดาเมจ (สูงสุด 10 ชั้น) · ฆ่าศัตรูฟื้น 6.5% HP',
    skillText: 'ท่าชาร์จปล่อยระเบิดไฟและแสงดาวไขว้กัน 2 ครั้ง ครั้งละ 165%',
  },
  judgment: {
    name: 'ตราพิพากษา', skill: 'คำพิพากษาสวรรค์', color: '#fff3a0', color2: '#f5c35a',
    passive: 'ทุกฮิตประทับตราพิพากษา (สูงสุด 5 · เคาน์เตอร์ประทับ 2 ตรา · อยู่นาน 10 วิ) ตราละ +5.5% ดาเมจที่เป้าได้รับจากคุณ ตราที่ 5 ระเบิดแสงศักดิ์สิทธิ์ 330% คริติคอลเสมอ รัศมี 156 และส่งต่อ 1 ตราให้ศัตรูรอบข้าง · ฆ่าศัตรูฟื้น 6.5% HP',
    skillText: 'ท่าชาร์จประทับ +3 ตราให้ศัตรูทุกตัวในรัศมี 310 แล้วจุดระเบิดตราทั้งหมดพร้อมกัน ตราละ 72% คริติคอลเสมอ ตามด้วยเสาพิพากษาลงที่เป้า 130%',
  },
  sunwave: {
    name: 'คลื่นสุริยะ', skill: 'คลื่นดาบสุริยันตัดฟ้า', color: '#ffcf5a', color2: '#1a1424',
    passive: 'ทุกฮิตที่ 6 ปล่อยคลื่นดาบสั้นไปข้างหน้า 55% ตามทิศที่ผู้เล่นหันหน้า',
    skillText: 'ท่าชาร์จปล่อยคลื่นดาบกว้างไปข้างหน้าตามทิศที่หัน โดนทุกตัวบนแนว 110% (ระยะ 560)',
  },
  eclipse: {
    name: 'คราสสลับฟ้า', skill: 'ตะวันดับ', color: '#ffb648', color2: '#6a4aa8',
    passive: 'ทุกฮิตที่ 7 เกิดคราสเต็มดวง ระเบิดวงแหวนตะวันดำ 200% คริติคอลเสมอ รอบเป้า · ฆ่าศัตรูภายใน 3 วิหลังคราสฟื้น 4% HP',
    skillText: 'ท่าชาร์จดูดศัตรูรอบตัวเข้าหาเป้า แล้วฟาดซ้ำ 2 ครั้ง ครั้งละ 120%',
  },
});
export const WAVE = Object.freeze({ every: 6, len: 560, halfW: 90, skill: 1.1, passive: 0.55 });
export const PVP_SCALE = 0.5;
// PvP share of each unique's numbers (v9.1: per weapon; the two strongest PvE blades are cut harder in duels)
export const UNIQUE_PVP_SCALE = Object.freeze({ judgment: 0.42, sovereign: 0.40, eclipse: 0.46, sunwave: 0.5 });
export const ECL = Object.freeze({ every: 7, burst: 2.0, burstR: 150, healT: 3, heal: 0.04, pullR: 240, pull: 140, skillHit: 1.2 });
export const SOV = Object.freeze({ every: 5, echo: 0.9, echoR: 136, counterEcho: 1.5, stack: 0.035, maxStacks: 10, stackT: 2.6, heal: 0.065, blast: 1.65, blastR: 146 });
export const JUD = Object.freeze({
  max: 5, brandT: 10, amp: 0.055, burst: 3.3, burstR: 156, spread: 1, counterBrand: 2, heal: 0.065,
  skillAdd: 3, skillPer: 0.72, skillR: 310, verdict: 1.3, verdictR: 166,
});

export const uniqueOf = (p) => (p?.stats?.unique && UNIQUES[p.stats.unique] ? p.stats.unique : null);
const scale = (world, id) => (world.pvp ? (UNIQUE_PVP_SCALE[id] ?? PVP_SCALE) : 1);
function state(p) { return (p.uniq ||= { hits: 0, stacks: 0, stackT: 0, skillMove: null }); }

// called every frame (stack decay)
export function tickUnique(p, dt) {
  const u = p.uniq;
  if (!u) return;
  if (u.stackT > 0) { u.stackT -= dt; if (u.stackT <= 0) u.stacks = 0; }
  if (u.eclipseT > 0) u.eclipseT -= dt;
}

// live brand count on a target (brands fade JUD.brandT seconds after the last one was laid)
function brandOf(world, e) {
  if (!e || !(e.brand > 0)) return 0;
  const now = world?.time || 0;
  if (now - (e.brandAt ?? now) > JUD.brandT) { e.brand = 0; return 0; }
  return e.brand;
}

// extra damage multiplier for the next hit (sovereign stacks / judgment brands on the target `e`)
export function uniqueDamageMult(p, world, e = null) {
  const id = uniqueOf(p);
  // v9.1 balance pass: every weapon has a farm and a PvP damage multiplier (data/weaponBalance.js). All three damage
  // paths (dungeon, online zones, PvP) call this function, so the table applies everywhere with no other change.
  const bal = balOf(p?.stats?.weaponId);
  const wb = bal ? (world?.pvp ? bal.pvp : bal.farm) : 1;
  if (id === 'sovereign') return wb * (1 + (p.uniq?.stacks || 0) * SOV.stack * scale(world, id));
  if (id === 'judgment') return wb * (1 + brandOf(world, e) * JUD.amp * scale(world, id));
  return wb;
}

function around(world, at, r, also = null) {
  const out = also && !also.dead ? [also] : [];
  for (const t of world.enemies || []) if (t !== also && !t.dead && !t.untargetable && Math.hypot(t.x - at.x, t.y - at.y) <= r + (t.r || 20)) out.push(t);
  return out;
}
const strikeAll = (world, list, power, o = {}) => { for (const t of list) world.playerStrike(t, power, { ...o, src: 'unique' }); };

// After a landed hit. o: the hit options; returns nothing. Never recurses (its own hits are src 'unique').
export function uniqueAfterHit(world, p, e, o = {}) {
  const id = uniqueOf(p);
  if (!id || !e || o.src === 'unique' || o.src === 'burn' || o.src === 'pet') return;
  const k = scale(world, id), u = state(p);
  const charged = p.move?.kind === 'charged' && u.skillMove !== p.move;
  if (charged) u.skillMove = p.move;
  if (id === 'sunwave') {
    u.hits += 1;
    if (!charged && u.hits % WAVE.every !== 0) return;
    const f = charged ? 1 : 0.6, len = WAVE.len * f, hw = WAVE.halfW * (charged ? 1 : 0.75), a = p.facing ?? Math.atan2(e.y - p.y, e.x - p.x);
    const c = Math.cos(a), s = Math.sin(a), hit = [];
    for (const t of world.enemies || []) {
      if (t.dead || t.untargetable) continue;
      const dx = t.x - p.x, dy = t.y - p.y, fw = dx * c + dy * s, side = Math.abs(-dx * s + dy * c);
      if (fw > -20 && fw < len && side < hw + (t.r || 20)) hit.push(t);
    }
    strikeAll(world, hit, (charged ? WAVE.skill : WAVE.passive) * k);
    for (let i = 1; i <= 8; i++) { const d = len * i / 8; world.fx?.ring(p.x + c * d, p.y + s * d - 24, 6, hw * 0.6, i % 2 ? '#ffcf5a' : '#1a1424', 0.3, 4);
      world.particles?.burst(p.x + c * d, p.y + s * d - 24, 5, { color: ['#ffcf5a', '#ffffff', '#1a1424'], speedMin: 80, speedMax: 260, life: 0.3, size: 3, drag: 4, glow: true }); }
    if (charged) { world.fx?.callout(p.x, p.y - 140, UNIQUES.sunwave.skill, '#ffcf5a'); world.shake?.(7, 0.25); world.sfx?.('slam'); } else world.sfx?.('crit');
    return;
  }
  if (id === 'sovereign') {
    u.stacks = Math.min(SOV.maxStacks, u.stacks + 1); u.stackT = SOV.stackT;
    u.hits += 1;
    if (u.hits % SOV.every === 0 || o.counter) {
      const list = around(world, e, SOV.echoR, e);
      strikeAll(world, list, SOV.echo * k * (o.counter ? SOV.counterEcho : 1));
      world.fx?.ring(e.x, e.y - 30, 14, SOV.echoR, '#ff5a3a', 0.4, 6);
      world.fx?.ring(e.x, e.y - 30, 8, SOV.echoR * 0.8, '#7fe8ff', 0.5, 4);
      world.particles?.burst(e.x, e.y - 30, 18, { color: ['#ff5a3a', '#ffcf5a', '#7fe8ff', '#ffffff'], speedMin: 140, speedMax: 380, life: 0.4, size: 3, drag: 4, glow: true });
      world.sfx?.('crit');
    }
    if (charged) {
      for (const [dx, col] of [[-36, '#ff5a3a'], [36, '#7fe8ff']]) {
        const at = { x: e.x + dx, y: e.y };
        strikeAll(world, around(world, at, SOV.blastR, e), SOV.blast * k, { forceCrit: false });
        world.fx?.ring(at.x, at.y - 30, 16, SOV.blastR, col, 0.5, 8);
      }
      world.fx?.callout(p.x, p.y - 140, UNIQUES.sovereign.skill, '#ffcf5a');
      world.shake?.(7, 0.25);
    }
  } else if (id === 'eclipse') {
    u.hits += 1;
    if (charged) {
      const list = around(world, p, ECL.pullR, e);
      for (const t of list) {
        if (t !== e && !t.peer && !(t.type?.boss)) { const a = Math.atan2(e.y - t.y, e.x - t.x); t.vx = (t.vx || 0) + Math.cos(a) * ECL.pull * 3; t.vy = (t.vy || 0) + Math.sin(a) * ECL.pull * 3; }
      }
      strikeAll(world, list, ECL.skillHit * k); strikeAll(world, list, ECL.skillHit * k);
      world.fx?.ring(e.x, e.y - 30, 20, ECL.pullR, '#6a4aa8', 0.5, 8);
      world.fx?.ring(e.x, e.y - 30, 10, ECL.pullR * 0.6, '#ffb648', 0.55, 6);
      world.fx?.callout(p.x, p.y - 140, UNIQUES.eclipse.skill, '#ffb648');
      world.shake?.(8, 0.3); world.sfx?.('slam');
    }
    if (u.hits % ECL.every === 0) {
      strikeAll(world, around(world, e, ECL.burstR, e), ECL.burst * k, { forceCrit: true });
      u.eclipseT = ECL.healT;
      world.fx?.ring(e.x, e.y - 30, 30, ECL.burstR, '#1a1424', 0.5, 14);
      world.fx?.ring(e.x, e.y - 30, 26, ECL.burstR * 1.05, '#ffb648', 0.55, 5);
      world.particles?.burst(e.x, e.y - 40, 26, { color: ['#ffd27a', '#ffb648', '#6a4aa8', '#ffffff'], speedMin: 160, speedMax: 440, life: 0.5, size: 3.2, drag: 4, glow: true });
      world.fx?.callout(e.x, e.y - (e.r || 30) * 2 - 30, 'คราส!', '#ffb648');
      world.sfx?.('crit');
    }
  } else if (id === 'judgment') {
    if (charged) {
      // the verdict: brand everything nearby, then detonate every brand at once
      const add = Math.max(1, Math.round(JUD.skillAdd * Math.max(k, 0.5)));   // brands laid by the verdict: 2 in PvP, as before
      for (const t of around(world, p, JUD.skillR, e)) {
        const n = Math.min(JUD.max, brandOf(world, t) + add);
        t.brand = 0;
        world.playerStrike(t, JUD.skillPer * n * k, { src: 'unique', forceCrit: true });
        world.fx?.ring(t.x, t.y - 30, 10, 90, '#fff3a0', 0.45, 6);
      }
      strikeAll(world, around(world, e, JUD.verdictR, e), JUD.verdict * k, { forceCrit: true });
      world.fx?.ring(e.x, e.y - 30, 16, JUD.verdictR, '#ffffff', 0.5, 8);
      world.fx?.ring(p.x, p.y - 30, 18, JUD.skillR, '#f5c35a', 0.55, 5);
      world.particles?.burst(e.x, e.y - 40, 26, { color: ['#ffffff', '#fff3a0', '#f5c35a', '#7fe8ff'], speedMin: 180, speedMax: 460, life: 0.5, size: 3.2, drag: 4, glow: true });
      world.fx?.callout(p.x, p.y - 140, UNIQUES.judgment.skill, '#fff3a0');
      world.shake?.(8, 0.28); world.sfx?.('perfect');
      return;
    }
    // a counter lays two brands at once (one in PvP); an ordinary hit lays one
    const lay = o.counter ? Math.max(1, Math.round(JUD.counterBrand * k)) : 1;
    e.brand = Math.min(JUD.max, brandOf(world, e) + lay); e.brandAt = world.time || 0;
    if (e.brand >= JUD.max) {
      e.brand = 0;
      const list = around(world, e, JUD.burstR, e);
      strikeAll(world, list, JUD.burst * k, { forceCrit: true });
      // the blast hands one brand to everyone else it touched (PvE only — halved away in PvP)
      const pass = Math.floor(JUD.spread * k);
      if (pass > 0) for (const t of list) if (t !== e && !t.dead) { t.brand = Math.min(JUD.max - 1, brandOf(world, t) + pass); t.brandAt = world.time || 0; }
      world.fx?.ring(e.x, e.y - 30, 12, JUD.burstR, '#fff3a0', 0.5, 8);
      world.fx?.ring(e.x, e.y - 30, 8, JUD.burstR * 0.7, '#ffffff', 0.45, 5);
      world.particles?.burst(e.x, e.y - 40, 26, { color: ['#ffffff', '#fff3a0', '#f5c35a'], speedMin: 160, speedMax: 440, life: 0.45, size: 3, drag: 4, glow: true });
      world.fx?.callout(e.x, e.y - (e.r || 30) * 2 - 30, 'พิพากษา!', '#fff3a0');
      world.sfx?.('crit');
    }
  }
}

export function uniqueOnKill(p, world) {
  const id = uniqueOf(p);
  if (p.dead || (id !== 'sovereign' && id !== 'judgment' && !(id === 'eclipse' && p.uniq?.eclipseT > 0))) return 0;
  const heal = Math.round(p.maxHp * (id === 'eclipse' ? ECL.heal : id === 'judgment' ? JUD.heal : SOV.heal) * scale(world, id));
  p.hp = Math.min(p.maxHp, p.hp + heal);
  return heal;
}

// brands drawn over a target (small golden pips) and the sovereign stack ring around the hero
export function drawBrands(ctx, e, time) {
  if (!(e.brand > 0) || time - (e.brandAt ?? time) > JUD.brandT) return;
  const y = e.y - (e.r || 24) * 2 - 22;
  for (let i = 0; i < e.brand; i++) {
    const x = e.x + (i - (e.brand - 1) / 2) * 11;
    ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.arc(x, y, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = i === 4 ? '#ffffff' : '#fff3a0'; ctx.beginPath(); ctx.moveTo(x, y - 3.6); ctx.lineTo(x + 3.2, y); ctx.lineTo(x, y + 3.6); ctx.lineTo(x - 3.2, y); ctx.closePath(); ctx.fill();
  }
}
export function drawUniqueAura(ctx, p, time) {
  const id = uniqueOf(p);
  if (!id) return;
  const u = p.uniq;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (id === 'sovereign' && u?.stacks) {
    const k = u.stacks / SOV.maxStacks;
    for (let i = 0; i < u.stacks; i++) {
      const a = time * 2.4 + (i / SOV.maxStacks) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? 'rgba(127,232,255,0.8)' : 'rgba(255,90,58,0.8)';
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 34, p.y - 8 + Math.sin(a) * 12, 2.4 + k, 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'eclipse') {
    // a black sun with a gold corona hangs behind the hero; it fills toward the next eclipse
    const k = ((u?.hits || 0) % ECL.every) / ECL.every;
    ctx.strokeStyle = `rgba(255,182,72,${(0.3 + 0.4 * k).toFixed(3)})`; ctx.lineWidth = 2 + k * 2;
    ctx.beginPath(); ctx.arc(p.x, p.y - 96, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.05, k)); ctx.stroke();
  } else if (id === 'judgment') {
    ctx.strokeStyle = `rgba(255,243,160,${(0.25 + 0.15 * Math.sin(time * 3)).toFixed(3)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 96, 14, 4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// Artifact "debuff": a landed hit may sunder the enemy (it deals 20% less and moves slower for 3 s).
export const SUNDER = Object.freeze({ t: 3, dmg: 0.8, slow: 0.7 });
export function trySunder(p, e, rng, o = {}) {
  const ch = p.stats?.debuff || 0;
  if (!ch || !e || e.dead || o.src === 'burn' || o.src === 'pet' || o.src === 'unique' || rng.next() >= ch) return false;
  e.sunderT = SUNDER.t;
  if (!e.type?.boss) { e.slowMult = e.slowT > 0 ? Math.min(e.slowMult ?? 1, SUNDER.slow) : SUNDER.slow; e.slowT = Math.max(e.slowT || 0, SUNDER.t); }
  return true;
}
export const sunderMult = (e) => (e && e.sunderT > 0 ? SUNDER.dmg : 1);
// Artifact shield at the start of a room / wave.
export function roomShield(p) {
  const pct = p.stats?.shieldPct || 0;
  if (pct <= 0 || p.dead) return 0;
  p.shield = Math.max(p.shield || 0, Math.round(p.maxHp * pct)); p.shieldMax = Math.max(p.shieldMax || 0, p.shield); p.shieldT = 9999;
  return p.shield;
}
