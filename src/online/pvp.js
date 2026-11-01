// PvP rules shared by duels (and later team matches): damage scaling, hit validation, remote-pose decoding.
// Each player is authoritative over their OWN hero: attackers report hits, the victim applies them with its own
// defense, dodge window and invulnerability — so a dodge that looked good on your screen always counts.
import { computeDamage } from '../systems/combat.js';
import { getWeaponType, movesetFor } from '../data/weapons.js';
import { getItem } from '../data/items.js';
import { PROTOCOL } from './protocol.js';
import { atkCap, POWER_CAP, CRIT_CAP, CRIT_MULT_CAP } from './fairplay.js';

export const PVP = Object.freeze({
  damageScale: 0.45,    // player attacks are tuned for monsters; PvP hits land softer
  roundsToWin: 2,
  countdown: 3,
  maxHitRange: 320,     // a melee hit claimed from farther than this is ignored
  arena: { w: 1000, h: 640, wall: 60 },
});

const num = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

// The attacker's side of a hit, as sent over the network.
export function hitPacket(stats, power, o, from) {
  return {
    k: 'hit', power: Math.round(power * 1000) / 1000, atk: stats.atk, crit: Math.min(0.75, stats.crit + (o.critBonus || 0)), critMult: stats.critMult,
    forceCrit: !!o.forceCrit, kx: Math.round(o.kx || 0), ky: Math.round(o.ky || 0), src: o.src || 'melee', fx: Math.round(from.x), fy: Math.round(from.y),
  };
}

// The victim's side: validate, then compute damage with MY defense. Returns null for an invalid packet.
// attackerLevel: the level the attacker shows; their attack is capped at what that level can legitimately reach.
export function resolveHit(packet, myStats, me, rng, attackerLevel = null) {
  if (!packet || packet.k !== 'hit') return null;
  const power = num(packet.power, 0, POWER_CAP);
  const atk = num(packet.atk, 0, atkCap(attackerLevel));
  if (!(power > 0) || !(atk > 0)) return null;
  const ranged = packet.src === 'proj' || packet.src === 'race' || packet.src === 'skill';
  if (!ranged && Math.hypot(num(packet.fx, -1e4, 1e4) - me.x, num(packet.fy, -1e4, 1e4) - me.y) > PVP.maxHitRange) return null;
  const dmg = computeDamage({ atk, crit: num(packet.crit, 0, CRIT_CAP), critMult: num(packet.critMult, 1, CRIT_MULT_CAP, 1.5), forceCrit: !!packet.forceCrit }, { def: myStats.def }, rng, power);
  return { amount: Math.max(1, Math.round(dmg.amount * PVP.damageScale)), crit: dmg.crit, kx: num(packet.kx, -800, 800), ky: num(packet.ky, -800, 800) };
}

// My fighter state, sent ~20×/s as presence in the match room.
export function fighterPresence(p, look, status) {
  const m = p.move;
  return {
    v: PROTOCOL, st: status, x: Math.round(p.x), y: Math.round(p.y), f: p.flip ? 1 : 0, m: p.moving ? 1 : 0, wk: Math.round(p.walkT * 10) / 10,
    fc: Math.round(p.facing * 100) / 100,
    mv: m ? { k: m.kind, s: m.step, ph: m.phase, t: Math.round(m.t * 1000) / 1000, d: Math.round(m.dir * 100) / 100 } : null,
    ch: p.charging ? Math.round(p.charge * 100) / 100 : 0, cr: p.chargeReady ? 1 : 0,
    ds: p.dashT > 0 ? 1 : 0, bl: p.blink ? 1 : 0, rs: p.rush ? 1 : 0,
    hp: Math.ceil(p.hp), mhp: p.maxHp, sh: p.shield || 0,
    ...look,
  };
}

// A remote fighter as a pose-able proxy (same fields playerPose/heroDraw read from a real player).
export function updateRemoteFighter(r, raw, dt) {
  const w = getItem(raw?.w);
  const type = w?.moves ? movesetFor(w) : getWeaponType(w?.wtype);
  if (r.wtype !== type) r.wtype = type;
  if (raw) {
    r.tx = num(raw.x, 0, 3000, r.tx ?? 500); r.ty = num(raw.y, 0, 3000, r.ty ?? 300);
    r.flip = !!raw.f; r.moving = !!raw.m; r.walkTarget = num(raw.wk, 0, 1e6, 0);
    r.facing = num(raw.fc, -10, 10, 0);
    r.hp = num(raw.hp, 0, 1e5, r.hp ?? 100); r.maxHp = num(raw.mhp, 1, 1e5, r.maxHp ?? 100); r.shield = num(raw.sh, 0, 1e5, 0);
    r.charging = num(raw.ch, 0, 5, 0) > 0; r.charge = num(raw.ch, 0, 5, 0); r.chargeReady = !!raw.cr; r.chargeDir = r.facing;
    r.dashT = raw.ds ? 0.1 : 0; r.blink = !!raw.bl; r.rush = raw.rs ? { dir: r.facing } : null;
    r.status = typeof raw.st === 'string' ? raw.st : 'fight';
    r.gd = raw.gd === 1; r.cl = raw.cl === 1;
    const mv = raw.mv;
    if (mv && ['combo', 'charged', 'dash', 'branch'].includes(mv.k)) {
      const def = mv.k === 'charged' ? type.charged : mv.k === 'dash' ? type.dash : mv.k === 'branch' ? (type.branch || type.combo[0]) : type.combo[Math.max(0, Math.min(type.combo.length - 1, mv.s | 0))];
      const phase = ['windup', 'active', 'recover'].includes(mv.ph) ? mv.ph : 'recover';
      const key = `${mv.k}:${mv.s}:${phase}`;
      r.newActive = phase === 'active' && r.moveKey !== key;
      r.moveKey = key;
      r.move = { kind: mv.k, step: mv.s | 0, def, phase, t: num(mv.t, 0, 2, 0), dir: num(mv.d, -10, 10, 0) };
    } else { r.move = null; r.moveKey = null; r.newActive = false; }
  }
  // smooth toward the latest reported position (presence arrives ~20×/s)
  const k = Math.min(1, dt * 14);
  r.x = r.x == null ? r.tx : r.x + (r.tx - r.x) * k;
  r.y = r.y == null ? r.ty : r.y + (r.ty - r.y) * k;
  r.walkT = r.moving ? (r.walkT || 0) + dt * 10 : (r.walkT || 0);
  return r;
}
