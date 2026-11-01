// Online zone run (ดันเจี้ยนรวม): up to 4 players fight through 2 rooms and a boss room of one of the ten zones.
// The host (whoever opened the run) simulates the monsters and the zone mechanic and shares them:
//   • presence `en` — every monster's position, HP and pose (absolute state, ~12×/s)
//   • presence `rs` — room index and phase (fight / clear / victory / defeat)
//   • 'match' events — strikes, pools, projectiles, gusts, contact hits, damage numbers, kills (batched ~10×/s)
// Every player simulates their own hero, resolves telegraphed strikes / pools / projectiles against their own hero,
// and reports their hits on monsters to the host. Loot is personal: each player rolls their own drops on a kill.
// Alone (or offline) the same scene runs with the local player as host and nobody else in the room.
import { bossElement, bossTrial, bossBars } from '../data/bestiary.js';
import { drawElementFx } from '../battle/elementFx.js';
import { tickAnim, noteSwing, noteCast, drawRig, spriteMotion, hexA } from '../battle/rigDraw.js';
import { drawCritterAt, critterHeight } from '../battle/critterDraw.js';
import { zoneTrack, bossTrackFor, bossIntensity } from '../data/music.js';
import { BALANCE } from '../config/balance.js';
import { uniqueAfterHit, uniqueDamageMult, uniqueOnKill, tickUnique, drawBrands, drawUniqueAura, trySunder, sunderMult, roomShield } from '../battle/uniques.js';
import { getItem } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';
import { getEnemy } from '../data/enemies.js';
import { ZONE_ROOM, PARTY_HP_SCALE, clearReward, zoneStats, getZone } from '../data/zones.js';
import { ZONE_ENEMY_IDS } from '../data/enemies.js';
import { cloneState } from '../core/state.js';
import { computeDamage, comboBonus } from '../systems/combat.js';
import { rollDrops, rollGold } from '../systems/loot.js';
import { addItem, removeItem, countItem, canAdd, addInPlace } from '../systems/inventory.js';
import { luckMult } from '../systems/luck.js';
import { computeStats } from '../systems/stats.js';
import { grantXpInPlace } from '../systems/progression.js';
import { slottedSkills } from '../systems/skills.js';
import { createPlayer, updatePlayer, damagePlayer, applyStats, inPerfectWindow } from '../battle/player.js';
import { bossHitScale } from '../battle/bossScale.js';
import { createEnemy, updateEnemy, separate } from '../battle/enemies.js';
import '../battle/zoneBehaviours.js';
import { createDrop, updateDrop, drawDrop } from '../battle/drops.js';
import { createFx } from '../battle/fx.js';
import { createSkillBar, tickSkills, castSkill, updateSnares, drawSnares, replaySkill } from '../battle/skills.js';
import { createSkillRuntime } from '../battle/skillCast.js';
import { passiveStrikeMult, comboScale } from '../battle/skillHooks.js';
import { installUlt, updateUlt, drawUltScreen, replayUlt } from '../battle/ultimate.js';
import { equippedUlt } from '../systems/ultimate.js';
import { bossTricks, delayedSwing, trickLevelFor } from '../battle/tricks.js';
import { drawHero } from '../battle/heroDraw.js';
import { drawGuard } from '../battle/guard.js';
import { installDefenseHooks } from '../battle/defense.js';
import { createStyle, styleEvent, styleHurt, styleTick, styleBonus, hitKind } from '../battle/style.js';
import { playerPose } from '../battle/weaponPose.js';
import { createShot, updateShots, drawShot, updateZones, drawZones, updateCones } from '../battle/playerShots.js';
import { applyBurn, applyMark, poiseHit, tickStatus, drawStatus } from '../battle/status.js';
import { createRaceSkill, tickRaceSkill, castRaceSkill } from '../battle/raceSkills.js';
import { drawKitGround, drawKitAir } from '../battle/raceKit.js';
import { createPetTeam, updatePet, drawPet, drawPetGround } from '../battle/pets.js';
import { activePets } from '../systems/pets.js';
import { buffOf } from '../battle/buffs.js';
import { drawTitleLine } from '../ui/nameplate.js';
import { atkCap, POWER_CAP, CRIT_CAP, CRIT_MULT_CAP, createHitGate } from '../online/fairplay.js';
const allyGate = createHitGate(14, 1000);
import { createEffects, updateEffects, addStrike, addPool, addShot, addGust, drawPools, drawStrikes, drawShots, drawGusts } from '../battle/strikes.js';
import { createMechanic, ZONE_FLAGS, drawMechanicFloor } from '../battle/zoneMechanics.js';
import { fighterPresence, updateRemoteFighter } from '../online/pvp.js';
import { lookOf, readPresence, PROTOCOL } from '../online/protocol.js';
import { paintZoneRoom } from './zoneBackdrop.js';
import { INFINITE, infiniteZone, landOf, waveScale, waveSpawns, waveCoins, killCoins } from '../data/infinite.js';
import { rollArtifact, grantArtifactsInPlace } from '../systems/artifacts.js';
import { getArtifact } from '../data/artifacts.js';
import '../battle/godBehaviours.js';
import { TOWER, TOWER_PARTY, towerPartyScale, towerZone, towerScale, floorDrops, floorReward, isGodFloor, isEliteFloor, godOfFloor, AFFIX_IDS, AFFIXES } from '../data/tower.js';
const AFFIXES_TXT = Object.fromEntries(Object.entries(AFFIXES).map(([k, v]) => [k, v.name]));
import { initBossArmor, tickBossArmor, breakBossArmor, drawBossArmor } from '../battle/bossArmor.js';
import { openBossGuard, bossHiddenAlpha } from '../battle/bossGuard.js';
import { SHADOW_ELITE_HP } from '../data/bossGuard.js';
import { applyAffixes, tickAffixes, tempoOf, affixHitOpts, affixAfterHit, affixOnHurt, affixOnDeath, drawAffixes, drawInvuln } from '../battle/affixes.js';

const CB = BALANCE.combat;
const A = ZONE_ROOM;
const GONE_AFTER = 4;
const REVIVE_TIME = 2.5, REVIVE_RANGE = 85;
const TOWER_REVIVE_RANGE = 120;      // the tower with friends: hold the button beside a downed hero for TOWER_PARTY.reviveTime seconds
const SEND_EVERY = 0.05;           // presence ~20×/s (v9.4: was ~12×/s — a friend's hero and the host's monsters moved in visible steps)
const EVENTS_EVERY = 0.05;         // batched events (hits, skills, damage numbers) ~20×/s; urgent ones pull the next send forward (see queue)
const URGENT_EVENTS = new Set(['hit', 'dmg', 'kill', 'hurt', 'sk', 'ult', 's', 'b']);
const EVENT_BYTES = 3300;
const PORTAL = { x: A.w - 140, y: A.h / 2 + 20, r: 80 };
const ENTRY = { x: 170, y: A.h / 2 + 20 };

const AFFIX_NAME = Object.fromEntries(AFFIX_IDS.map((a) => [a, AFFIXES_TXT[a]]));
const num = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

export function createCoopScene(app) {
  const { renderer, input, store, audio, sprites, rng } = app;
  const ctx = renderer.ctx;
  let w = null;

  // ------------------------------------------------------------ world
  function makeWorld({ room, zone, host, roster, title }) {
    const st = store.get();
    const stats = computeStats(st);
    const me = app.online.me.peer || 'me';
    const party = Math.max(1, roster.length);
    const wd = {
      room, zone, host, amHost: host === me || !host, me, roster: [...roster], party, title,
      arena: { w: A.w, h: A.h }, wallPad: A.wall, flags: ZONE_FLAGS[zone.mechanic] || {},
      rng, time: 0, stopT: 0, slowT: 0, phase: 'waiting', phaseT: 0, ri: 0, rphase: 'fight', wave: -1, queue: [],
      player: createPlayer(stats, ENTRY.x, ENTRY.y), enemies: [], views: new Map(), allies: new Map(), drops: [],
      fxs: createEffects(), fx: createFx(), particles: app.particles,
      skills: createSkillBar(slottedSkills(st)), raceSkill: createRaceSkill(st.race?.id, stats.skillCdMult),
      pets: [], pet: null,
      shots: [], zones: [], cones: [], snares: [], sk: createSkillRuntime(),
      combo: { n: 0, t: 0, best: 0 }, style: createStyle(), parries: 0, counters: 0, perfects: 0, breaks: 0, keys: 0, lastStandUsed: false, vacuum: false,
      run: { gold: 0, sparks: 0, xp: 0, kills: 0, items: new Map(), levelUps: 0, start: performance.now(), bestCombo: 0, perfects: 0 },
      ended: false, paused: false, outbox: [], evAcc: 0, sendAcc: 0, nextId: 1, reviveT: 0, darkT: 0, slide: { vx: 0, vy: 0 },
      floor: null, unsub: [], lastRs: '', hostGone: 0, mech: null, seenHost: false, lastFullWarn: -10, statusMods: { slow: 1, ice: false },
      look: lookOf(st), seenRooms: new Set(),
      inf: zone.infinite ? { wave: 0, coins: 0, arts: [], cleared: false, best: st.infinite?.best || 0 } : null,
      tower: zone.tower ? { floor: zone.floor, asc: zone.asc || 0, start: zone.floor, cleared: 0, gold: 0, xp: 0, sparks: 0, gods: [], deepest: 0 } : null,
      sin: 0, sinOn: false, trickLevel: trickLevelFor(zone),
    };
    wd.pets = createPetTeam(activePets(st), ENTRY.x, ENTRY.y, wd.player);
    wd.pet = wd.pets[0] || null;
    wd.mech = wd.amHost ? createMechanic(zone, wd) : null;
    for (const peer of roster) if (peer !== me) wd.allies.set(peer, { peer, r: BALANCE.player.radius, goneT: 0, seen: false, x: null, y: null, hp: 1, maxHp: 1, vx: 0, vy: 0, name: '…' });
    installWorldApi(wd);
    return wd;
  }

  // The API the shared combat code and the zone behaviours call.
  function installWorldApi(wd) {
    const p = wd.player;
    wd.sfx = (n, o) => audio.play(n, o);
    wd.shake = (m, t) => renderer.shake(m, t);
    wd.hitStop = (t) => { wd.stopT = Math.max(wd.stopT, Math.min(0.08, t)); };
    wd.screenToWorld = (sx, sy) => renderer.screenToWorld(sx, sy);
    wd.toast = (...a) => app.toast(...a);
    wd.announce = (text) => { app.hud.banner(text, ''); if (wd.amHost) queue(['ann', String(text).slice(0, 60)]); };
    wd.clampBody = (b) => { b.x = Math.max(A.wall + b.r, Math.min(A.w - A.wall - b.r, b.x)); b.y = Math.max(A.wall + b.r + 20, Math.min(A.h - A.wall + 10, b.y)); };
    wd.cutProjectiles = (cx, cy, dir, range, arc) => 0;
    // the void jelly pet swallows monster shots near the hero (each client resolves shots against its own hero)
    wd.eatShots = (x, y, r, max) => {
      let n = 0;
      for (const sh of wd.fxs.shots) { if (n >= max || sh.life <= 0 || Math.hypot(sh.x - x, sh.y - y) > r + sh.r) continue; sh.life = 0; sh.pool = null; n++; }
      return n;
    };
    wd.addSnare = (z) => wd.snares.push(z);
    wd.netSkill = (m) => queue(['sk', m]);
    wd.addHazard = (h) => wd.strike({ shape: h.type === 'line' ? 'line' : 'circle', x: h.x, y: h.y, r: h.r, angle: h.angle, len: h.len, width: h.width, dur: h.dur, mult: 0, owner: h.owner });
    wd.addCone = (c) => wd.cones.push(c);
    wd.addZone = (z) => { wd.zones.push({ ...z, t: 0, done: false }); audio.play('cast', { power: 1.6 }); };
    wd.firePlayerShot = (o) => wd.shots.push(createShot(o));
    wd.usePotion = () => usePotion();
    wd.collect = (d) => collect(d);
    wd.onPlayerSwing = (def, kind) => {
      const t = p.wtype.id;
      if (t === 'bow') audio.play('bow', { power: kind === 'charged' ? 1.6 : 1 });
      else if (t === 'staff') audio.play('cast', { power: kind === 'charged' ? 1.6 : def.power });
      else audio.play('swing', { power: Math.min(1.8, 0.7 + def.power * 0.45) });
    };
    wd.onPlayerDash = (blink) => audio.play(blink ? 'blink' : 'dash');
    wd.onChargeReady = () => audio.play('charge');
    wd.onLastStand = () => { app.hud.banner('ผู้ไม่มอด', 'รอดจากความตาย'); audio.play('roar'); };
    wd.onPlayerDeath = () => { audio.play('defeat'); renderer.shake(10, 0.5); if (wd.party > 1) app.hud.banner('ถูกล้ม', wd.tower ? `รอเพื่อนมากดชุบ ${TOWER_PARTY.reviveTime} วินาที` : 'ให้เพื่อนยืนข้างตัวเพื่อชุบชีวิต'); };
    installDefenseHooks(wd, { audio, renderer, app, stagger: (e) => {
      if (!e || e.dead || !wd.amHost) return;
      if (e.type.boss) { if (poiseHit(e, 5)) onPoiseBreak(e); }
      else { e.hitstun = Math.max(e.hitstun || 0, 1.1); e.warn = 0; }
    } });
    // v8: alone, time stops for the monsters while the ultimate plays; with a party it does not
    installUlt(wd, { app, audio, id: equippedUlt(store.get()), pvp: false, freezes: wd.party === 1 && wd.amHost, onUse: () => { const n = cloneState(store.get()); n.stats.ults = (n.stats.ults || 0) + 1; store.commit(n, { reason: 'ult', persist: false }); }, net: (m) => queue(['ult', m]) });
    wd.perfectDodge = () => {
      wd.rankUp?.(styleEvent(wd.style, 'perfect'));
      if (p.perfectUsed || p.dead) return;
      p.perfectUsed = true; wd.slowT = CB.perfect.slowmo; p.empowerT = CB.perfect.empowerT; p.dodges = Math.min(p.dodgeMax, p.dodges + 1);
      wd.perfects += 1; wd.run.perfects += 1;
      wd.ultEvent?.('perfect');
      wd.fx.callout(p.x, p.y - 120, 'หลบสมบูรณ์!', '#bfe3ff'); wd.fx.ring(p.x, p.y - 30, 20, 120, '#bfe3ff', 0.5, 6);
      audio.play('perfect'); app.hud.flash?.('perfect');
    };

    // --- my hits on monsters (host: apply now; others: report to the host)
    wd.playerStrike = (e, power, o = {}) => {
      if (!e || e.dead || e.spawning > 0 || e.untargetable) return null;
      const st = p.stats, b = p.buffs;
      let mult = power * passiveStrikeMult(p, e) * (1 + comboBonus(wd.combo.n) * comboScale(p) + styleBonus(wd.style) + (b.blessT > 0 ? b.bless : 0) + (b.ashT > 0 && wd.raceSkill ? wd.raceSkill.v.dmg : 0) + buffOf(p, 'dmg') + (st.titleDmg || 0));
      if (o.src === 'skill' || o.src === 'race') mult *= st.skillPower || 1;
      mult *= uniqueDamageMult(p, wd, e);
      const empowered = p.empowerT > 0 && (o.src === 'melee' || o.src === 'proj' || o.src === undefined);
      if (empowered) { mult *= 1 + CB.perfect.empowerPower; p.empowerT = 0; }
      const crit = st.crit + (o.critBonus || 0) + (b.focusT > 0 && wd.raceSkill ? wd.raceSkill.v.crit || 0 : 0) + buffOf(p, 'crit');
      const counts = o.src !== 'burn' && o.src !== 'pet';
      if (counts) { bumpCombo(); wd.rankUp(styleEvent(wd.style, hitKind(p, o))); wd.ultEvent?.(e.type?.boss ? 'boss' : 'mob'); }
      const pkt = { atk: st.atk, crit: Math.min(0.75, crit), critMult: st.critMult, forceCrit: !!(o.forceCrit || empowered), power: mult, heavy: o.src === 'skill' || o.src === 'race' ? Math.max(power, 1.2) : power, kx: o.kx || 0, ky: o.ky || 0, stun: o.counter ? Math.max(o.stun || 0, 0.8) : o.stun || 0, burn: !!(o.burn || b.ashT > 0 || buffOf(p, 'burn') > 0 || (st.ignite > 0 && rng.next() < st.ignite)), src: o.src || 'melee' };
      if (o.mark) { pkt.mark = o.mark; pkt.markT = o.markT || 3; }
      if (o.slow) { pkt.slow = o.slow; pkt.slowT = o.slowT || 1.5; }
      const ls = buffOf(p, 'lifesteal') + (st.lifesteal || 0);
      if (ls > 0 && counts && !p.dead) { p.lsAcc = (p.lsAcc || 0) + st.atk * mult * 0.5 * ls; if (p.lsAcc >= 1) { const hl = Math.floor(p.lsAcc); p.lsAcc -= hl; p.hp = Math.min(p.maxHp, p.hp + hl); } }
      if (wd.amHost) { const r = applyHit(e, pkt, wd.me); uniqueAfterHit(wd, p, e, o); if (trySunder(p, e, rng, o)) wd.fx.callout(e.x, e.y - (e.r || 24) * 2 - 20, 'ทำลายเกราะ', '#9fffd8'); return r; }
      queue(['hit', e.id, pkt]);
      uniqueAfterHit(wd, p, e, o);
      e.flash = 1;
      wd.particles.burst(e.x, e.y - e.r, 6, { color: ['#fff8ea', '#f3e6c8'], speedMin: 80, speedMax: 240, life: 0.25, size: 2.5, drag: 5, glow: true });
      audio.play('hit');
      return { amount: 0, crit: false };
    };
    wd.petStrike = (e, power, o = {}) => wd.playerStrike(e, power, { ...o, src: 'pet' });

    // --- monster side (host only); `wd.player` is the monster's current target while its behaviour runs
    wd.hitPlayer = (e, mult, kx, ky, fire = false, extra = null) => {
      const t = wd.player;
      if (!t || t.dead) return false;
      mult *= sunderMult(e);
      const ax = affixHitOpts(e);
      noteSwing(e);
      if (t === p) { const ok = hurtMe(e, mult, kx, ky, fire, false, { attacker: e, ...(ax || {}), ...(extra || {}) }); if (ok) affixAfterHit(e, wd); return ok; }
      queue(['hurt', t.peer, Math.round(mult * 100) / 100, Math.round(e.atk), Math.round(kx), Math.round(ky), fire ? 1 : 0]);
      return true;
    };
    wd.strike = (s) => {
      const atk = Math.round(s.owner?.atk ?? 10);
      if (s.owner?.affixes?.includes('piercing') && s.mult > 0) s = { ...s, pierce: true, tone: 'pierce' };
      if (s.owner && s.mult > 0 && !(s.owner.warn > 0)) noteCast(s.owner);
      addStrike(wd.fxs, { ...s, owner: { atk, crit: 0, critMult: 1.5 } });
      if (s.tone === 'pierce') audio.play('pierceWarn');
      queue(['s', packStrike(s, atk)]);
    };
    wd.pool = (pl) => {
      const atk = Math.round(pl.owner?.atk ?? wd.zoneAtk ?? 10);
      addPool(wd.fxs, { ...pl, owner: { atk, crit: 0, critMult: 1 } });
      queue(['p', { x: Math.round(pl.x), y: Math.round(pl.y), r: pl.r, dur: pl.dur, kind: pl.kind, mult: pl.mult || 0, atk }]);
    };
    wd.shoot = (e, o) => {
      const atk = Math.round(e?.atk ?? 10);
      if (e) noteCast(e);
      const tgt = o.homing ? (wd.player === p ? wd.me : wd.player?.peer) : null;
      addShot(wd.fxs, { ...o, owner: { atk, crit: 0, critMult: 1.5 }, target: tgt === wd.me ? 'me' : tgt });
      queue(['b', { ...o, x: Math.round(o.x), y: Math.round(o.y), angle: Math.round(o.angle * 1000) / 1000, atk, target: tgt, pool: o.pool || null, orbit: o.orbit || null }]);
    };
    wd.gust = (angle, dur, force) => { addGust(wd.fxs, { angle, dur, force }); queue(['g', Math.round(angle * 1000) / 1000, dur, force]); };
    wd.darkPulse = (t) => { wd.darkT = Math.max(wd.darkT, t); queue(['dark', t]); };
    wd.spawnEnemy = (id, x, y) => spawnEnemy(id, x, y);
    // v8: a reflection that runs out of time shatters (no loot). v9.3: a caller can ask for the loot to be paid
    // (the Egypt puzzle warden falls on its own and drops its purse) — before, the second argument was dropped here.
    wd.killEnemy = (e, rewarded = false) => killEnemy(e, rewarded === true);
    wd.enemyDef = (id) => getEnemy(id);                        // v8: the Boss Rush shadow borrows other bosses' moves
    wd.enemiesOf = (typeId) => wd.enemies.filter((x) => x.type.id === typeId);
    // god mechanics on my hero: silence (no skills), chill (slow; `freeze` = stuck for the time)
    wd.silence = (t) => { p.silenceT = Math.max(p.silenceT || 0, t); wd.fx.callout(p.x, p.y - 120, 'ถูกปิดเสียง!', '#c8c8ff'); audio.play('silenced'); };
    wd.chill = (t, freeze = false) => { p.chillT = Math.max(p.chillT || 0, t); if (freeze) { p.stunT = Math.max(p.stunT || 0, Math.min(1.2, t)); audio.play('frozen'); } };
    wd.selfDestruct = (e) => { killEnemy(e, false); };
    wd.damageEnemy = (e, dmg, kx, ky, opt = {}) => damageEnemy(e, dmg, kx, ky, opt);
    wd.trapHitEnemy = () => {};
    Object.defineProperty(wd, 'players', { get: () => targets() });
  }

  // ------------------------------------------------------------ outgoing events (host and my hits)
  function queue(ev) { if (w && w.party > 1) { w.outbox.push(ev); if (URGENT_EVENTS.has(ev[0])) w.evAcc = Math.max(w.evAcc, EVENTS_EVERY * 0.6); } }
  function flush() {
    if (!w.outbox.length) return;
    let batch = [], size = 0;
    for (const ev of w.outbox) {
      const s = JSON.stringify(ev).length;
      if (size + s > EVENT_BYTES && batch.length) { w.room.emit('match', { k: 'ev', l: batch }); batch = []; size = 0; }
      batch.push(ev); size += s;
    }
    if (batch.length) w.room.emit('match', { k: 'ev', l: batch });
    w.outbox.length = 0;
  }
  function packStrike(s, atk) {
    const r = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : undefined);
    return { shape: s.shape, x: r(s.x), y: r(s.y), r: r(s.r), inner: r(s.inner), angle: r(s.angle), len: r(s.len), width: r(s.width), arc: typeof s.arc === 'number' ? r(s.arc) : undefined,
      lob: s.arc && typeof s.arc === 'object' ? { x: r(s.arc.x), y: r(s.arc.y) } : undefined, w: r(s.w), h: r(s.h),
      dur: r(s.dur), mult: r(s.mult), fire: s.fire ? 1 : 0, kb: r(s.kb), tone: s.tone, meteor: s.meteor ? 1 : 0, then: s.then || undefined, atk,
      pierce: s.pierce ? 1 : undefined, silence: r(s.silence), chill: r(s.chill), pct: r(s.pct) };
  }

  // ------------------------------------------------------------ incoming events
  function onMessage(m) {
    if (!w || m.sameTab) return;
    const d = m.data || {};
    if (d.k !== 'ev' || !Array.isArray(d.l)) return;
    const fromHost = m.peer === w.host;
    const fromMember = w.allies.has(m.peer);
    if (!fromHost && !fromMember) return;
    for (const ev of d.l.slice(0, 120)) {
      if (!Array.isArray(ev)) continue;
      const [k] = ev;
      if (k === 'sk') { if (ev[1] && typeof ev[1] === 'object') replaySkill(w, ev[1]); continue; }
      if (k === 'ult') { if (ev[1] && typeof ev[1] === 'object') replayUlt(w, ev[1], w.allies.get(m.peer)?.name || ''); continue; }
      if (k === 'rv') {
        // a friend is holding the revive button beside me
        const a = w.allies.get(m.peer), me = w.player;
        if (w.tower && ev[1] === w.me && me.dead && a && a.seen && !a.ko && a.x != null && Math.hypot(a.x - me.x, a.y - me.y) < TOWER_REVIVE_RANGE * 1.8) { w.rescueGrace = 0.7; w.rescuer = m.peer; }
        continue;
      }
      if (k === 'hit' && w.amHost && fromMember) {
        const e = w.enemies.find((x) => x.id === ev[1]);
        if (e) applyHit(e, ev[2] || {}, m.peer);
        continue;
      }
      if (!fromHost || w.amHost) continue;
      if (k === 's') receiveStrike(ev[1]);
      else if (k === 'p') { const pl = ev[1] || {}; addPool(w.fxs, { x: num(pl.x, 0, A.w), y: num(pl.y, 0, A.h), r: num(pl.r, 10, 300, 60), dur: num(pl.dur, 0.2, 30, 3), kind: pl.kind, mult: num(pl.mult, 0, 2), owner: { atk: num(pl.atk, 0, 20000, 10), crit: 0, critMult: 1 } }); }
      else if (k === 'b') receiveShot(ev[1]);
      else if (k === 'g') addGust(w.fxs, { angle: num(ev[1], -10, 10), dur: num(ev[2], 0.2, 4, 1.2), force: num(ev[3], 0, 600, 240) });
      else if (k === 'dark') w.darkT = Math.max(w.darkT, num(ev[1], 0, 10));
      else if (k === 'ann') app.hud.banner(String(ev[1] || '').slice(0, 60), '');
      else if (k === 'hurt' && ev[1] === w.me) hurtMe({ atk: num(ev[3], 0, 20000, 10), crit: 0, critMult: 1.5 }, num(ev[2], 0, 5, 1), num(ev[4], -900, 900), num(ev[5], -900, 900), !!ev[6]);
      else if (k === 'dmg') { const v = w.views.get(ev[1]); if (v) { w.fx.number(v.x, v.y - v.r * 2 - 10, Math.max(1, ev[2] | 0), ev[3] ? 'crit' : 'hit'); v.flash = 1; } }
      else if (k === 'kill') onKill(ev[1], ev[2], num(ev[3], 0, A.w), num(ev[4], 0, A.h), !!ev[5]);
      else if (k === 'spawn') { w.fx.ring(num(ev[2], 0, A.w), num(ev[3], 0, A.h) - 10, 10, 60, '#e0b45a', 0.5, 4); audio.play('spawn'); }
    }
  }
  function receiveStrike(s) {
    if (!s || typeof s !== 'object' || !['circle', 'ring', 'line', 'cone', 'rect'].includes(s.shape)) return;
    if (s.tone === 'pierce') audio.play('pierceWarn');
    const pool = s.then?.pool;
    addStrike(w.fxs, {
      shape: s.shape, x: num(s.x, -500, 4000), y: num(s.y, -500, 4000), r: num(s.r, 0, 4000), inner: num(s.inner, 0, 4000), angle: num(s.angle, -20, 20), len: num(s.len, 0, 3000), width: num(s.width, 0, 600),
      arc: s.lob ? { x: num(s.lob.x, -500, 3000), y: num(s.lob.y, -500, 3000) } : num(s.arc, 0, 7), w: num(s.w, 0, 3000), h: num(s.h, 0, 3000),
      dur: num(s.dur, 0.05, 6, 1), mult: num(s.mult, 0, 4), fire: !!s.fire, kb: s.kb == null ? undefined : num(s.kb, -900, 900), tone: typeof s.tone === 'string' ? s.tone.slice(0, 10) : 'fire', meteor: !!s.meteor,
      then: pool ? { pool: { kind: String(pool.kind || 'poison').slice(0, 8), r: num(pool.r, 10, 300, 60), dur: num(pool.dur, 0.2, 20, 3), mult: num(pool.mult, 0, 2) } } : undefined,
      pierce: !!s.pierce, silence: num(s.silence, 0, 6), chill: num(s.chill, 0, 6), pct: num(s.pct, 0, 0.95),
      owner: { atk: num(s.atk, 0, 20000, 10), crit: 0, critMult: 1.5 },
    });
  }
  function receiveShot(o) {
    if (!o || typeof o !== 'object') return;
    addShot(w.fxs, {
      x: num(o.x, -200, 3000), y: num(o.y, -200, 3000), angle: num(o.angle, -20, 20), speed: num(o.speed, 0, 1500, 300), r: num(o.r, 2, 80, 10), mult: num(o.mult, 0, 4, 1),
      kind: typeof o.kind === 'string' ? o.kind.slice(0, 10) : 'orb', homing: num(o.homing, 0, 5), pierce: !!o.pierce, life: num(o.life, 0.2, 10, 4), fire: !!o.fire, ground: !!o.ground,
      pool: o.pool ? { kind: String(o.pool.kind || 'poison').slice(0, 8), r: num(o.pool.r, 10, 300, 60), dur: num(o.pool.dur, 0.2, 20, 3) } : null,
      orbit: o.orbit ? { cx: num(o.orbit.cx, 0, 3000), cy: num(o.orbit.cy, 0, 3000), r0: num(o.orbit.r0, 0, 500), grow: num(o.orbit.grow, -200, 400), spin: num(o.orbit.spin, -10, 10) } : null,
      target: o.target === w.me ? 'me' : typeof o.target === 'string' ? o.target : null, owner: { atk: num(o.atk, 0, 20000, 10), crit: 0, critMult: 1.5 },
    });
  }

  // ------------------------------------------------------------ monsters (host)
  // v8.6 เลือดหลายหลอด: how many health bars a boss is worth here. The tower's elite guardians (by floor) and the endless
  // mode's boss waves (by wave) are already scaled by their own rules, so only the gods and the lands' own bosses use it.
  function barsOf(def) { return def.boss && (def.god || !(w.zone.tower || w.zone.infinite)) ? bossBars(def.id) : 1; }

  // heroes in the climb right now: me and every friend still connected (downed ones count: they can be revived)
  function partyNow() { let n = 1; for (const a of w.allies.values()) if (a.seen && a.goneT < GONE_AFTER) n++; return Math.min(TOWER_PARTY.max, n); }
  // (re)scale a monster to the present party; safe to call again when someone joins/leaves: health keeps its share
  function applyPartyScale(e) {
    const to = towerPartyScale(partyNow()), from = e.pf || { hp: 1, atk: 1, tempo: 1 };
    const r = to.hp / from.hp;
    e.maxHp = Math.round(e.maxHp * r); e.hp = Math.max(1, Math.round(e.hp * r));
    e.atk = Math.round(e.atk * to.atk / from.atk);
    e.pf = to;
  }

  function spawnEnemy(id, x, y) {
    const def = getEnemy(id);
    if (!def) return null;
    const e = createEnemy(id, x, y, 1);
    app.ensureRig(def.id);
    e.id = w.nextId++;
    e.ti = ZONE_ENEMY_IDS.indexOf(def.id);
    e.maxHp = e.hp = Math.round(def.hp * (w.tower ? 1 : 1 + PARTY_HP_SCALE * (w.party - 1)) * (w.zone.raid && !def.boss ? 1.8 : 1));
    if (w.zone.raid && !def.boss) e.atk = Math.round(e.atk * 1.25);   // a raid boss's summons fight at the raid's level
    e.bars = barsOf(def);      // v8.6: boss health = base × bars, by difficulty and rewards (data/bestiary.js); mechanics with a clock read the health of ONE bar
    if (e.bars > 1) e.maxHp = e.hp = Math.round(e.maxHp * e.bars);
    if (w.inf) { const k = waveScale(w.inf.wave); e.maxHp = e.hp = Math.round(e.maxHp * k.hp); e.atk = Math.round(e.atk * k.atk); }
    if (w.zone.rush && def.zone !== 'rush') {
      // v8 Boss Rush: every boss fights at the rush's level, whatever land it comes from
      const from = zoneStats(getZone(def.zone)?.level || w.zone.level), to = zoneStats(w.zone.level);
      e.maxHp = e.hp = Math.round(e.maxHp * to.hp / from.hp); e.atk = Math.round(e.atk * to.atk / from.atk); e.def = Math.round((e.def || 0) * to.def / from.def);
    }
    let wantArmor = false;      // v8.0.2: bosses that used to ward themselves (invulnerable) now carry armour per phase
    if (w.tower) {
      const k = towerScale(def, w.tower.floor, w.tower.asc);
      e.maxHp = e.hp = Math.round(e.maxHp * k.hp); e.atk = Math.round(e.atk * k.atk); e.def = Math.round((e.def || 0) * k.def);
      const plan = w.zone.plan;
      if (!def.god && id !== 'z_pylon') {
        const aff = plan.affixes.slice();
        // the elite guardian carries one more curse
        if (def.boss && plan.elite === id) { const extra = AFFIX_IDS[(w.tower.floor * 7 + w.tower.asc * 3) % AFFIX_IDS.length]; if (!aff.includes(extra) && extra !== 'splitting') aff.push(extra); }
        wantArmor = def.boss && aff.includes('warded');
        if (def.boss && aff.includes('shadow')) e.maxHp = e.hp = Math.round(e.maxHp * SHADOW_ELITE_HP);   // v8.6: its blink no longer makes it immune, so it is a little tougher instead
        applyAffixes(e, aff.filter((a) => !(def.boss && (a === 'splitting' || a === 'warded'))));
      }
    }
    if (w.tower) applyPartyScale(e);      // co-op climb: health, attack and tempo by the heroes in the climb now
    // land and raid bosses: their trial (see data/bestiary.js bossTrial): armour for every phase (shoot it away to
    // break the boss's stance), and crimson armour-piercing blows once they are enraged
    const trial = def.boss && !w.tower && !w.inf && !w.spawningCopy ? bossTrial(w.zone) : null;
    if (trial) { e.trial = trial; if (trial.ward) wantArmor = true; }
    if (def.god && def.ai === 'god_hellfire') wantArmor = true;
    if (wantArmor && def.boss && !w.spawningCopy) initBossArmor(e, w.zone.raid ? 'raid' : def.god ? 'god' : 'land');
    e.zid = def.id;
    w.enemies.push(e);
    w.fx.ring(x, y - 10, 10, 60, '#e0b45a', 0.5, 4);
    audio.play('spawn');
    queue(['spawn', e.id, Math.round(x), Math.round(y)]);
    if (def.boss && !w.spawningCopy) { app.hud.setBoss(def.name, 1, e.bars); audio.play(def.god ? 'godIntro' : 'roar'); renderer.shake(8, 0.5); bossMusic(def, 1); }
    return e;
  }

  function applyHit(e, pkt, from) {
    if (e.dead || e.untargetable) return null;
    // Egypt puzzle statues only answer an ordinary attack (melee / ranged): skills, ultimates, bloodline moves, pets, burn ticks and
    // weapon echoes pass through them, so a wide skill can never light the wrong statue
    if (e.type.ai === 'egypt_glyph' && pkt.src !== 'melee' && pkt.src !== 'proj' && pkt.src !== undefined) return null;
    // immune: a ward, a god's shield or chains (show it, but at most a few times a second)
    if (e.invuln > 0) {
      if (!(e.immuneMsgT > w.time)) { e.immuneMsgT = w.time + 0.35; w.fx.number(e.x, e.y - e.r * 2 - 14, 'ไร้ผล', 'info'); audio.play('immune'); }
      return null;
    }
    // the masked god: only the white faces (three of them, evenly spaced) can be struck; other masks throw the blow back
    if (e.facesGuard && from === w.me) {
      const hitFrom = Math.atan2(w.player.y - e.y, w.player.x - e.x);
      const step = Math.PI * 2 / (e.facesGuard.whites || 1);
      let off = (((hitFrom - e.facesGuard.a) % step) + step) % step;     // angle to the white mask before this point, 0..step
      if (off > step / 2) off -= step;                                    // → distance to the nearest white mask, -step/2..step/2
      if (Math.abs(off) > e.facesGuard.arc / 2) {
        if (!(e.immuneMsgT > w.time)) {
          e.immuneMsgT = w.time + 0.5; w.fx.number(e.x, e.y - e.r * 2 - 14, 'สะท้อน!', 'info'); audio.play('parry');
          hurtMe({ atk: Math.max(1, Math.round(num(pkt.atk, 0, 1e4) * 0.35)), crit: 0, critMult: 1 }, 1, 0, 0, false, true);
        }
        return null;
      }
    }
    if (from !== w.me && !allyGate.allow(from)) return null;      // flood of hit reports from one ally
    const lv = from === w.me ? null : w.allies.get(from)?.lv;
    const power = num(pkt.power, 0, POWER_CAP), atk = num(pkt.atk, 0, from === w.me ? 1e4 : atkCap(lv));
    if (!(power > 0) || !(atk > 0)) return null;
    let mult = power;
    if (e.markT > 0) mult *= 1 + (e.mark || 0);
    if (e.brokenT > 0) mult *= 1 + CB.poise.breakBonus;
    // shields: a guarded front takes much less; the feather monk answers with a counter
    if (e.type.guardFront && e.guarding) {
      const hitFrom = Math.atan2((from === w.me ? w.player.y : w.allies.get(from)?.y ?? e.y) - e.y, (from === w.me ? w.player.x : w.allies.get(from)?.x ?? e.x) - e.x);
      let d = hitFrom - (e.ai.face ?? 0); while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < 1.2) { mult *= 1 - e.type.guardFront; w.fx.number(e.x, e.y - e.r * 2 - 26, 'โล่!', 'info'); }
    }
    if (e.type.ai === 'counter' && e.guarding) { mult *= 0.3; e.ai.countered = true; }
    const dmg = computeDamage({ atk, crit: num(pkt.crit, 0, CRIT_CAP), critMult: num(pkt.critMult, 1, CRIT_MULT_CAP, 1.5), forceCrit: !!pkt.forceCrit }, e, rng, mult);
    affixOnHurt(e);
    // a shell (ice cocoon) takes the blows first; the body is untouched until it breaks
    if (e.shell > 0) {
      e.shell = Math.max(0, e.shell - dmg.amount);
      w.fx.number(e.x, e.y - e.r * 2 - 10, dmg.amount, 'info'); e.flash = 0.6;
      audio.play(e.shell <= 0 ? 'shatter' : 'shellHit');
      if (e.shell <= 0) { w.particles.burst(e.x, e.y - e.r, 40, { color: ['#cfeaff', '#ffffff', '#7fb8e8'], speedMin: 120, speedMax: 380, life: 0.7, size: 5, drag: 3, shape: 1 }); renderer.shake(10, 0.4); }
      return dmg;
    }
    damageEnemy(e, dmg, num(pkt.kx, -900, 900), num(pkt.ky, -900, 900), { power: num(pkt.heavy, 0, 5, 1), src: pkt.src });
    if (!e.dead) {
      if (pkt.stun && !e.type.boss) e.hitstun = Math.max(e.hitstun, num(pkt.stun, 0, 2));
      if (pkt.src !== 'burn' && poiseHit(e, num(pkt.heavy, 0, 5, 1))) onPoiseBreak(e);
      if (pkt.burn && pkt.src !== 'burn') applyBurn(e);
      if (pkt.mark) applyMark(e, num(pkt.mark, 0, 0.6), num(pkt.markT, 0, 6, 3));
      if (pkt.slow) { const sl = num(pkt.slow, 0.2, 1, 1); e.slowT = Math.max(e.slowT || 0, num(pkt.slowT, 0, 4, 1)); e.slowMult = e.type.boss ? Math.min(1, sl + 0.3) : sl; }
    }
    return dmg;
  }

  // boss armour: every kind of damage (blows, burn, skills) soaks into it before the body is hurt
  function breakArmor(e) {
    breakBossArmor(e);
    e.poise = 0; e.brokenT = CB.poise.breakStun;
    w.fx.callout(e.x, e.y - e.r * 2 - 58, 'เกราะแตก!', '#ffe89a');
    w.particles.burst(e.x, e.y - e.r, 36, { color: ['#e6ecf5', '#9fb0c8', '#ffe89a'], speedMin: 120, speedMax: 380, life: 0.7, size: 5, drag: 3, shape: 1 });
    renderer.shake(10, 0.4); audio.play('shatter');
    onPoiseBreak(e);
  }

  function damageEnemy(e, dmg, kx, ky, opt = {}) {
    if (e.dead) return;
    if (e.armor > 0 && dmg.amount > 0) {
      const soak = Math.min(e.armor, dmg.amount);
      e.armor -= soak;
      w.fx.number(e.x, e.y - e.r * 2 - 10, soak, 'info'); e.flash = 0.6;
      queue(['dmg', e.id, soak, 0]);
      if (opt.src !== 'burn' && e.armor > 0) audio.play('shellHit');
      if (e.armor <= 0) { e.armor = 0; breakArmor(e); }
      if (dmg.amount - soak <= 0) return;
      dmg = { ...dmg, amount: dmg.amount - soak };
    }
    e.hp = Math.max(0, e.hp - dmg.amount);
    e.flash = opt.src === 'burn' ? 0.4 : 1;
    e.vx += kx / e.type.mass; e.vy += ky / e.type.mass;
    if (!e.type.boss && opt.src !== 'burn' && !e.superArmor) {
      if ((opt.power ?? 1) >= (e.type.interruptAt ?? 1.2)) { e.hitstun = Math.max(e.hitstun, 0.2); if (e.state === 'windup') { e.state = 'recover'; e.t = 0; e.warn = 0; } }
      else if (!(e.flinchCd > 0)) { e.hitstun = Math.max(e.hitstun, 0.07); e.flinchCd = 0.5; }
    }
    w.fx.number(e.x, e.y - e.r * 2 - 10, dmg.amount, dmg.crit ? 'crit' : opt.src === 'burn' ? 'burn' : 'hit');
    if (opt.src !== 'burn') w.particles.burst(e.x, e.y - e.r, dmg.crit ? 14 : 7, { color: dmg.crit ? ['#ffcf5a', '#fff3c4', '#ff8a3d'] : ['#fff8ea', '#f3e6c8'], speedMin: 90, speedMax: 300, life: 0.3, size: dmg.crit ? 3.5 : 2.5, drag: 5, glow: true });
    if (opt.src !== 'burn') audio.play(dmg.crit ? 'crit' : 'hit');
    queue(['dmg', e.id, dmg.amount, dmg.crit ? 1 : 0]);
    if (e.type.boss && !e.clone) { app.hud.setBoss(e.type.name, e.hp / e.maxHp, e.bars || 1); audio.setIntensity(bossIntensity(e.hp / e.maxHp)); }
    if (e.hp <= 0) {
      if (e.type.revive && !e.revived && !e.noRevive) { e.revived = true; e.hp = 1; e.state = 'ash'; e.t = 0; e.warn = 0; w.fx.callout(e.x, e.y - 90, 'ลุกจากเถ้า…', '#ff8a3d'); return; }
      killEnemy(e, !e.noReward);
    }
  }

  function onPoiseBreak(e) {
    w.breaks += 1;
    e.state = 'rest'; e.t = 0; e.warn = 0; if (e.ai) e.ai.z = 0;
    for (let i = w.fxs.strikes.length - 1; i >= 0; i--) if (w.fxs.strikes[i].ownerId === e.id) w.fxs.strikes.splice(i, 1);
    w.fx.callout(e.x, e.y - e.r * 2 - 40, 'เสียหลัก!', '#f5d48a');
    audio.play('crit'); renderer.shake(8, 0.3);
  }

  function killEnemy(e, rewarded) {
    if (e.dead) return;
    e.dead = true; e.deathT = 0;
    if (w.amHost) { w.spawningCopy = true; affixOnDeath(e, w); w.spawningCopy = false; }
    if (e.clone || e.noReward) { w.particles.burst(e.x, e.y - e.r, 24, { color: e.type.particles || ['#7a6aa8', '#14121c'], speedMin: 80, speedMax: 260, life: 0.5, size: 4, drag: 3 }); audio.play('enemyDie'); queue(['kill', e.id, e.ti, Math.round(e.x), Math.round(e.y), 0]); w.views.delete(e.id); return; }
    if (e.type.split) for (let i = 0; i < e.type.split.count; i++) spawnEnemy(e.type.split.id, e.x + (i ? 40 : -40), e.y + 10);
    queue(['kill', e.id, e.ti, Math.round(e.x), Math.round(e.y), rewarded ? 1 : 0]);
    onKill(e.id, e.ti, e.x, e.y, rewarded);
  }

  // Everyone (host included) runs this when a monster dies: effects, and MY personal rewards.
  function onKill(id, ti, x, y, rewarded) {
    const def = getEnemy(ZONE_ENEMY_IDS[ti]);
    const v = w.views.get(id);
    // rewards only once, and only for a monster that was really in this room (a host cannot mint kills)
    w.paidKills ||= new Set();
    const known = w.amHost ? w.enemies.some((e) => e.id === id) : !!v;     // the host knows its own monsters; a client its views
    const real = known && !w.paidKills.has(id);
    if (real) w.paidKills.add(id);
    if (v && !v.dead) { v.dead = true; v.deathT = 0; }
    if (!def) return;
    if (!real) rewarded = false;
    audio.play('enemyDie');
    w.particles.burst(x, y - (def.radius || 20), def.boss ? 60 : 16, { color: def.particles || ['#8a3b2e', '#5d6b3a', '#b5603f'], speedMin: 80, speedMax: def.boss ? 420 : 240, life: 0.7, size: def.boss ? 6 : 4, drag: 3, shape: 1 });
    if (def.boss) { renderer.shake(14, 0.6); app.hud.setBoss(null); if (!w.enemies.some((x) => !x.dead && x.type?.boss && !x.clone && x.id !== id)) zoneMusic(); }
    if (w.tower && rewarded) w.tower.kills = (w.tower.kills || 0) + 1;
    if (w.tower && def.god && rewarded) w.tower.gods.push(def.id);
    if (def.boss && rewarded) w.run.bossKills = (w.run.bossKills || 0) + 1;
    if (!rewarded || w.player.dead) return;
    const p = w.player;
    { const hl = uniqueOnKill(p, w); if (hl) w.fx.number(p.x, p.y - 110, `+${hl}`, 'heal'); }
    if (w.inf) {
      // the Infinite Rift pays only coins (held until the run ends) and artifacts
      const c = killCoins(w.inf.wave, def.boss); w.inf.coins += c; w.run.kills += 1;
      w.fx.number(x, y - 60, `+${c}`, 'info'); audio.play('gold');
      if (p.stats.healOnKill > 0) { const heal = Math.round(p.maxHp * p.stats.healOnKill); p.hp = Math.min(p.maxHp, p.hp + heal); }
      infHud();
      return;
    }
    if (p.stats.healOnKill > 0) { const heal = Math.round(p.maxHp * p.stats.healOnKill); p.hp = Math.min(p.maxHp, p.hp + heal); w.fx.number(p.x, p.y - 96, `+${heal}`, 'heal'); }
    const next = cloneState(store.get());
    next.stats.kills += 1;
    const levels = grantXpInPlace(next, def.xp);
    store.commit(next, { reason: 'kill', persist: false });
    w.run.xp += def.xp; w.run.kills += 1;
    if (levels > 0) {
      w.run.levelUps += levels;
      applyStats(p, computeStats(next));
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
      audio.play('levelup'); app.hud.banner(`เลเวล ${next.player.level}`, 'ได้แต้มสกิล 1 แต้ม · แต้มสเตตัส 3 แต้ม');
    }
    const gold = Math.round(rollGold(def.gold, rng) * (p.stats.goldMult || 1));
    if (def.sparks) w.drops.push(createDrop('spark', 'spark', def.sparks, x, y, rng));
    const coins = Math.min(4, Math.max(1, Math.round(gold / 10)));
    for (let i = 0; i < coins; i++) w.drops.push(createDrop('gold', 'gold', Math.max(1, Math.round(gold / coins)), x, y, rng));
    for (const d of rollDrops(def.drops, rng, luckMult(store.get()))) w.drops.push(createDrop('item', d.id, d.qty, x, y, rng));   // v8.2: Luck Potion
  }

  // Who the monsters can go after: me and every party member still standing here.
  function targets() {
    const list = [];
    if (!w.player.dead) list.push(w.player);
    for (const a of w.allies.values()) if (a.seen && a.goneT < GONE_AFTER && !a.ko && a.x != null) list.push(a);
    return list;
  }
  function pickTarget(e, list) {
    const cur = e.ai.tgt && list.includes(e.ai.tgt) ? e.ai.tgt : null;
    if (cur && (e.ai.tgtT || 0) > 0) return cur;
    let best = list[0], bd = Infinity;
    for (const t of list) { const d = Math.hypot(t.x - e.x, t.y - e.y) * (t === cur ? 0.8 : 1); if (d < bd) { bd = d; best = t; } }
    e.ai.tgt = best; e.ai.tgtT = 2 + rng.next();
    return best;
  }

  // ------------------------------------------------------------ my hero
  function hurtMe(owner, mult, kx, ky, fire = false, tick = false, opts = {}) {
    const p = w.player;
    if (p.dead || w.rphase === 'victory') return false;
    // a hidden tab stops my frame loop; invulnerability still runs out in real time
    const gap = (performance.now() - (w.lastTick || performance.now())) / 1000;
    if (gap > 0.1) { p.iframes = Math.max(0, p.iframes - gap); w.lastTick = performance.now(); }
    if (p.iframes > 0 && !tick) { if (inPerfectWindow(p)) w.perfectDodge(); return false; }
    const st = p.stats;
    // piercing: through the shield and through armour
    const def = opts.pierce ? 0 : st.def * (st.lowHpDef && p.hp < p.maxHp * 0.3 ? 1 + st.lowHpDef : 1);
    let amount = computeDamage(owner, { def }, rng, mult).amount;
    amount = bossHitScale(amount, owner, st, p.maxHp, w.zone?.level);   // v9.2: a boss hits harder the stronger this hero is (its health is untouched)
    // v8: a boss's lethal moves take a share of the hero's health, whatever the armour
    if (opts.pct > 0) amount = Math.max(amount, Math.round(p.maxHp * Math.min(0.95, opts.pct)));
    if (opts.pierce && !tick) { opts = { ...opts, unblockable: true }; w.fx.callout(p.x, p.y - 140, 'เจาะเกราะ!', '#ff3a6a'); audio.play('pierced'); }
    if (fire && st.fireReduce) amount = Math.max(1, Math.round(amount * (1 - st.fireReduce)));
    if (tick) {
      p.hp = Math.max(0, p.hp - amount);
      w.fx.number(p.x, p.y - 70, amount, 'player');
      if (p.hp <= 0) { p.dead = true; p.deathT = 0; p.move = null; w.onPlayerDeath(); }
      return true;
    }
    if (!damagePlayer(p, amount, kx, ky, w, opts)) return false;
    if (opts.silence) w.silence(opts.silence);
    if (opts.chill) { w.chill(opts.chill); w.fx.callout(p.x, p.y - 120, 'เวลาหยุดนิ่ง', '#fff3c4'); }
    if (opts.frost) { p.frost = (p.frost || 0) + 1; p.chillT = Math.max(p.chillT || 0, 1.6); if (p.frost >= 4) { p.frost = 0; w.chill(1, true); w.fx.callout(p.x, p.y - 120, 'แข็งทื่อ!', '#cfeaff'); } }
    if (w.sinOn) { w.sin = Math.min(12, (w.sin || 0) + 1); w.fx.number(p.x + 30, p.y - 100, `บาป ${w.sin}`, 'info'); }
    if (!(p.guard.blockFx > 0.2)) styleHurt(w.style);
    if (w.combo.n >= 5) w.fx.callout(p.x, p.y - 120, 'คอมโบขาด', '#ff9a8a');
    w.combo.n = 0;
    audio.play('hurt'); renderer.shake(7, 0.22); app.hud.hurt();
    w.particles.burst(p.x, p.y - 30, 10, { color: ['#c2412f', '#ff6b57'], speedMin: 80, speedMax: 220, life: 0.4, size: 3, drag: 4 });
    return true;
  }

  function bumpCombo() {
    w.combo.n += 1; w.combo.t = 0;
    if (w.combo.n > w.combo.best) w.combo.best = w.combo.n;
    if (w.combo.n > w.run.bestCombo) w.run.bestCombo = w.combo.n;
    for (const t of CB.combo.tiers) if (w.combo.n === t.at) { audio.play('wave'); w.fx.callout(w.player.x, w.player.y - 120, `คอมโบ ${t.at}! ดาเมจ +${Math.round(t.bonus * 100)}%`, '#ffd08a'); }
  }

  function usePotion() {
    const p = w.player;
    if (p.potionCd.left > 0) { app.toast(`ยาพร้อมใช้ในอีก ${p.potionCd.left.toFixed(1)} วินาที`, 'warn', 'potion-cd'); audio.play('error'); return; }
    const st = store.get();
    if (countItem(st, 'p_tonic') <= 0) { app.toast('ไม่มียาฟื้นพลังในกระเป๋า', 'warn', 'potion-none'); audio.play('error'); return; }
    if (p.hp >= p.maxHp) { app.toast('พลังชีวิตเต็มอยู่แล้ว', 'info', 'potion-full'); return; }
    const r = removeItem(st, 'p_tonic', 1);
    if (!r.ok) return;
    store.commit(r.state, { reason: 'potion', persist: false });
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * CB.potion.healPct));
    p.potionCd.left = CB.potion.cooldown;
    w.fx.number(p.x, p.y - 80, `+${p.hp - before}`, 'heal');
    audio.play('potion');
  }

  // Picks up everything lying on the ground and empties the list. Returns the drops that could not be taken
  // (bag full) so the caller can decide what to do with them instead of losing them silently.
  function sweepDrops() {
    const left = [];
    for (const d of w.drops) if (!collect(d)) left.push(d);
    w.drops.length = 0;
    return left;
  }

  function collect(d) {
    const st = store.get();
    if (d.kind === 'spark' || d.kind === 'gold') {
      const next = cloneState(st);
      if (d.kind === 'spark') { next.sparks = (next.sparks || 0) + d.qty; w.run.sparks += d.qty; audio.play('pickup', { rarity: 3 }); }
      else { next.gold += d.qty; w.run.gold += d.qty; audio.play('gold'); }
      store.commit(next, { reason: d.kind, persist: false });
      w.fx.number(w.player.x + 18, w.player.y - 90, d.kind === 'spark' ? `ประกาย +${d.qty}` : `+${d.qty}`, 'info');
      return true;
    }
    const r = addItem(st, d.id, d.qty);
    if (!r.ok) {
      if (w.time - w.lastFullWarn > 3) { app.toast('กระเป๋าเต็ม ขายหรือใช้ของก่อนเก็บเพิ่ม', 'warn', 'bag-full'); audio.play('error'); w.lastFullWarn = w.time; }
      return false;
    }
    store.commit(r.state, { reason: 'loot', persist: false });
    w.run.items.set(d.id, (w.run.items.get(d.id) || 0) + d.qty);
    const def = getItem(d.id), rar = rarityOf(def.rarity);
    app.toast(`${def.name} ×${d.qty}`, 'loot', null, { itemId: d.id, rarity: def.rarity });
    audio.play('pickup', { rarity: rar.order });
    return true;
  }

  // ------------------------------------------------------------ rooms (host decides, everyone follows `rs`)
  function startRoom(ri) {
    w.ri = ri; w.rphase = 'fight'; w.phaseT = 0; w.wave = -1; w.queue.length = 0;
    w.enemies.length = 0; w.views.clear();
    w.fxs.strikes.length = 0; w.fxs.pools.length = 0; w.fxs.shots.length = 0; w.fxs.gusts.length = 0;
    w.sk?.clear();
    const p = w.player;
    // walking into a new room picks up whatever was left behind and wakes downed heroes.
    // Loot the bag cannot hold is not thrown away: it is laid down again at the new room's entrance (see below).
    const leftBehind = sweepDrops();
    if (p.dead && !(w.tower && w.party > 1)) { p.dead = false; p.deathT = 0; p.hp = Math.round(p.maxHp * 0.5); p.iframes = 1.5; }
    roomShield(p);
    p.x = ENTRY.x + (rng.next() - 0.5) * 40; p.y = ENTRY.y + (rng.next() - 0.5) * 160; p.vx = p.vy = 0;
    leftBehind.forEach((d, i) => {   // a ring of loot just ahead of the hero, waiting until there is room in the bag
      const a = (i / Math.max(1, leftBehind.length)) * Math.PI * 2;
      d.state = 'rest'; d.z = 0; d.vz = 0; d.vx = d.vy = 0; d.t = 0; d.blockedUntil = w.time + 3;
      d.x = Math.max(20, Math.min(A.w - 20, p.x + 120 + Math.cos(a) * 50)); d.y = Math.max(40, Math.min(A.h - 20, p.y + Math.sin(a) * 50));
      w.drops.push(d);
    });
    if (leftBehind.length) app.toast(`กระเป๋าเต็ม — ของ ${leftBehind.length} ชิ้นที่เก็บไม่ได้ถูกวางไว้ที่ทางเข้าห้องนี้`, 'warn', 'bag-left');
    for (const pt of w.pets) { pt.x = p.x - 40 - pt.slot * 30; pt.y = p.y - pt.slot * 10; pt.dash = null; pt.fx.length = 0; }
    w.floor = paintZoneRoom(w.zone.theme, A, ri * 31 + w.zone.n * 7);
    if (w.zone.rush) {
      // a breath between bosses; the sixth door (only reached when nobody fell) holds the shadow
      if (ri > 0 && !p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
      if (ri >= w.zone.rooms.length) w.zone.rooms.push([[w.zone.secretBoss, 1]]);
    }
    if (w.zone.nested && ri >= w.zone.rooms.length && !w.nestedOpen) { w.nestedOpen = true; w.zone = { ...w.zone, rooms: [...w.zone.rooms, ...w.zone.nested] }; }   // v9: the dungeon inside the dungeon
    const def = w.zone.rooms[ri];
    if (w.inf) { infHud(); if (w.amHost) { w.mech?.reset(ri); publishRs(); } return; }
    if (w.tower) { towerHud(); if (w.amHost) { w.mech?.reset(ri); publishRs(); } return; }
    if (w.zone.rush) app.hud.roomTitle(ri >= (w.zone.lineup?.length || 5) ? `${w.zone.name} · ประตูที่หก ???` : `${w.zone.name} · บอส ${ri + 1}/${w.zone.lineup.length}`, `${getEnemy(def?.[0]?.[0])?.name || ''}${ri >= (w.zone.lineup?.length || 5) ? '' : ' · ' + w.zone.mechanicText}`);
    else app.hud.roomTitle(def === 'boss' ? `ห้องบอส · ${w.zone.name}` : `${w.zone.name} · ห้อง ${ri + 1}/${w.zone.rooms.length}`, w.zone.mechanicText);
    if (w.amHost) { w.mech?.reset(ri); publishRs(); }
  }

  function nextWave() {
    if (w.inf) return infNextWave();
    if (w.tower) return towerNextWave();
    const def = w.zone.rooms[w.ri];
    const waves = def === 'boss' ? [[[w.zone.boss, 1]]] : [def.slice(0, Math.ceil(def.length / 2)), def.slice(Math.ceil(def.length / 2))];
    w.wave += 1;
    if (w.wave >= waves.length) return false;
    let i = 0;
    for (const [id, count] of waves[w.wave]) for (let c = 0; c < count; c++) {
      const boss = getEnemy(id)?.boss;
      const x = boss ? A.w * 0.62 : A.w * (0.45 + rng.next() * 0.42), y = boss ? A.h * 0.48 : A.h * (0.25 + rng.next() * 0.55);
      w.queue.push({ id, x, y, delay: 0.25 + i * 0.18 });
      i++;
    }
    return true;
  }

  function hostRoomFlow(dt) {
    for (let i = w.queue.length - 1; i >= 0; i--) { const q = w.queue[i]; q.delay -= dt; if (q.delay <= 0) { spawnEnemy(q.id, q.x, q.y); w.queue.splice(i, 1); } }
    const everyoneDown = targets().length === 0 && w.phaseT > 1;
    if (everyoneDown && w.inf) { finish('fallen'); return; }
    if (everyoneDown && w.rphase !== 'defeat' && w.rphase !== 'victory') { w.rphase = 'defeat'; w.phaseT = 0; publishRs(); onPhase('defeat'); return; }
    // "nobody fell" (Boss Rush shadow, Egypt hidden stair) is remembered for the whole run, not just checked at the end
    if ((w.zone.rush || w.zone.nested) && !w.rushFell && [...w.allies.values()].some((a) => a.seen && a.ko)) w.rushFell = true;
    if ((w.zone.rush || w.zone.nested) && w.player.dead) w.rushFell = true;
    if (w.rphase === 'fight') {
      const alive = w.queue.length > 0 || w.enemies.some((e) => !e.dead && e.zid !== 'z_pylon');
      if (w.inf) {
        if (!alive && w.phaseT > 0.6 && !w.inf.cleared) infCleared();
        else if (w.inf.cleared && w.phaseT > 0.6 + INFINITE.restBetween) { w.inf.cleared = false; nextWave(); w.phaseT = 0; roomShield(w.player); }
        return;
      }
      if (!alive && w.phaseT > 0.6) {
        w.enemies.forEach((e) => { if (e.zid === 'z_pylon' && !e.dead) killEnemy(e, false); });
        if (!nextWave()) {
          if (w.tower) { towerCleared(); return; }
          let last = w.ri >= w.zone.rooms.length - 1;
          if (last && w.zone.rush && !w.rushFell && !w.rushSecret && w.zone.secretBoss) {
            // nobody fell: a sixth door opens
            w.rushSecret = true; last = false;
            w.zone.rooms.push([[w.zone.secretBoss, 1]]);
            w.announce('ไม่มีใครล้มเลย… ประตูที่หกเปิดออก');
          }
          if (last && w.zone.nested && !w.nestedOpen && !w.rushFell && !w.player.dead) {
            // nobody fell: a hidden stair opens under the pyramid
            w.nestedOpen = true; last = false;
            w.zone = { ...w.zone, rooms: [...w.zone.rooms, ...w.zone.nested] };
            w.announce('ไม่มีใครล้มเลย… บันไดลับใต้ปิรามิดเปิดออก');
          }
          w.rphase = last ? 'victory' : 'clear'; w.phaseT = 0; publishRs(); onPhase(w.rphase);
        } else w.phaseT = 0;
      }
    } else if (w.rphase === 'clear') {
      // the portal opens: everyone standing walks in (or 10 s after the first one does)
      const standing = targets();
      const inside = standing.filter((t) => Math.hypot(t.x - PORTAL.x, t.y - PORTAL.y) < PORTAL.r);
      if (inside.length) w.portalT = (w.portalT || 0) + dt; else w.portalT = 0;
      if (standing.length && (inside.length === standing.length || w.portalT > 10)) { w.portalT = 0; if (w.tower) towerNextFloor(); else { startRoom(w.ri + 1); nextWave(); } }
    }
  }

  // ------------------------------------------------------------ the Infinite Rift
  function infHud() {
    if (!w.inf) return;
    const land = landOf(Math.max(1, w.inf.wave));
    app.hud.roomTitle(`รอยแยกไร้สิ้นสุด · คลื่นที่ ${Math.max(1, w.inf.wave)}`, `${land.name} · เหรียญสะสม ${w.inf.coins.toLocaleString('th-TH')} · อาร์ติแฟกต์ ${w.inf.arts.length}${w.inf.best ? ` · สถิติ ${w.inf.best}` : ''}`);
  }
  function infNextWave() {
    w.inf.wave += 1;
    const wave = w.inf.wave;
    // every five waves the rift shifts into the next land: new floor, new hazards, new monsters
    if (wave > 1 && (wave - 1) % INFINITE.band === 0) {
      w.zone = infiniteZone(wave);
      w.flags = ZONE_FLAGS[w.zone.mechanic] || {};
      w.floor = paintZoneRoom(w.zone.theme, A, wave * 13 + w.zone.n);
      w.mech = createMechanic(w.zone, w); w.mech.reset(0);
      w.fxs.pools.length = 0;
      app.hud.banner(`รอยแยกเปลี่ยนเป็น ${landOf(wave).name}`, w.zone.mechanicText);
      audio.play('wave');
    } else if (wave % INFINITE.band === 0) { app.hud.banner(`คลื่นที่ ${wave} · ผู้พิทักษ์`, getEnemy(landOf(wave).boss)?.name || ''); audio.play('roar'); }
    else app.hud.banner(`คลื่นที่ ${wave}`, '');
    let i = 0;
    for (const [id, count] of waveSpawns(wave)) for (let c = 0; c < count; c++) {
      const boss = getEnemy(id)?.boss;
      const x = boss ? A.w * 0.62 : A.w * (0.4 + rng.next() * 0.48), y = boss ? A.h * 0.48 : A.h * (0.22 + rng.next() * 0.6);
      w.queue.push({ id, x, y, delay: 0.3 + i * 0.2 }); i++;
    }
    infHud();
    return true;
  }
  function infCleared() {
    w.inf.cleared = true; w.phaseT = 0;
    const wave = w.inf.wave, coins = waveCoins(wave);
    w.inf.coins += coins;
    const p = w.player;
    w.fx.callout(p.x, p.y - 140, `ผ่านคลื่นที่ ${wave} +${coins} เหรียญ`, '#ffd08a');
    if (wave % INFINITE.artifactEvery === 0 || rng.next() < INFINITE.artifactChance) {
      const id = rollArtifact(rng, wave);
      w.inf.arts.push(id);
      const art = getArtifact(id), rar = rarityOf(art.rarity);
      app.toast(`อาร์ติแฟกต์: ${art.name}`, 'loot', null, { rarity: art.rarity });
      w.fx.callout(p.x, p.y - 166, art.name, rar.color);
      audio.play('pickup', { rarity: rar.order });
    } else audio.play('unlock');
    // a breath between waves
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08));
    infHud();
  }

  // ------------------------------------------------------------ the Underworld Tower
  function towerHud() {
    const T = w.tower, plan = w.zone.plan;
    const g = plan.god ? godOfFloor(T.floor) : null;
    const curse = plan.affixes.length ? ` · คำสาป: ${plan.affixes.map((a) => AFFIX_NAME[a]).join(', ')}` : '';
    app.hud.roomTitle(`หอคอยขุมนรก ชั้น ${T.floor}/${TOWER.floors}${T.asc ? ` · ขุมลึก ${T.asc}` : ''}${w.party > 1 ? ` · ${partyNow()} คน` : ''}`, g ? `${g.name} — ${g.mechanic}` : `${w.zone.mechanicText}${curse}${isEliteFloor(T.floor) ? ' · ผู้พิทักษ์ชั้น' : ''}`);
  }
  function towerNextWave() {
    const plan = w.zone.plan;
    w.wave += 1;
    if (w.wave >= plan.waves.length) return false;
    let i = 0;
    const last = w.wave === plan.waves.length - 1;
    if (plan.god && w.wave === 0) { const g = godOfFloor(w.tower.floor); app.hud.banner(g.name, g.title); }
    else if (last && plan.elite) app.hud.banner('ผู้พิทักษ์ชั้น', getEnemy(plan.elite)?.name || '');
    else if (w.wave > 0) app.hud.banner(`ระลอกที่ ${w.wave + 1}/${plan.waves.length}`, '');
    for (const [id, count] of plan.waves[w.wave]) for (let c = 0; c < count; c++) {
      const boss = getEnemy(id)?.boss;
      const x = boss ? A.w * 0.62 : A.w * (0.42 + rng.next() * 0.45), y = boss ? A.h * 0.48 : A.h * (0.22 + rng.next() * 0.6);
      w.queue.push({ id, x, y, delay: 0.35 + i * 0.2 }); i++;
    }
    return true;
  }
  // a floor is won: pay it out at once (the climb is kept even if the hero falls on the next floor)
  function towerCleared() {
    const T = w.tower, f = T.floor, asc = T.asc;
    if (T.paid === `${asc}:${f}`) return;       // each hero is paid for a floor once, whoever reports it first
    T.paid = `${asc}:${f}`;
    const st = store.get(), next = cloneState(st);
    const tw = next.tower;
    const key = `${asc}:${f}`;
    const first = !tw.claimed[key];
    tw.claimed[key] = 1;
    const rw = floorReward(f, asc, first);
    next.gold += rw.gold; next.sparks += rw.sparks;
    const lv = grantXpInPlace(next, rw.xp);
    if (asc === tw.asc) tw.best = Math.max(tw.best, f);
    let ascended = false;
    if (f >= TOWER.floors && asc === tw.asc) { tw.asc += 1; tw.best = 0; tw.bestAsc = Math.max(tw.bestAsc || 0, tw.asc); ascended = true; }
    tw.kills = (tw.kills || 0) + (T.kills || 0); T.kills = 0;
    for (const g of T.gods.splice(0)) tw.gods[g] = (tw.gods[g] || 0) + 1;
    tw.deepest = Math.max(tw.deepest || 0, asc * 100 + f);
    store.commit(next, { reason: 'tower-floor' });
    w.run.gold += rw.gold; w.run.sparks += rw.sparks; w.run.xp += rw.xp; w.run.levelUps += lv;
    T.cleared += 1; T.deepest = Math.max(T.deepest, f); T.gold += rw.gold; T.sparks += rw.sparks; T.xp += rw.xp;
    // the floor's chest: its loot flies to the hero
    const c = { x: A.w * 0.5, y: A.h * 0.55 };
    for (const d of rollDrops(floorDrops(f, asc), rng, luckMult(store.get()))) w.drops.push(createDrop('item', d.id, d.qty, c.x, c.y, rng));
    w.vacuum = true;
    const p = w.player;
    if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.15));        // a breath before the next floor
    w.fx.callout(p.x, p.y - 150, `ผ่านชั้น ${f}${first ? ' ครั้งแรก' : ''} +${rw.gold} ทอง`, '#ffd08a');
    if (!w.amHost) return;        // friends follow the host's phase (see followHost) and show their own banner
    w.rphase = 'clear'; w.phaseT = 0; publishRs();
    audio.play(isGodFloor(f) ? 'victory' : 'unlock');
    app.hud.banner(ascended ? `พิชิตขุมนรก! เปิดขุมลึก ${asc + 1}` : `ผ่านชั้น ${f}`, f >= TOWER.floors ? 'ประตูสู่ขุมที่ลึกกว่าเปิดแล้ว' : 'เดินเข้าประตูเพื่อขึ้นชั้นถัดไป หรือกดหยุดเพื่อกลับค่าย');
  }
  // music: the land's track, the boss's (or god's) when one is in the room, harder as its health falls
  function zoneMusic() { if (!w) return; audio.setIntensity(1); audio.music(zoneTrack(w.zone)); }
  function bossMusic(def, f) { if (!w) return; audio.music(bossTrackFor(w.zone, def.id)); audio.setIntensity(bossIntensity(f)); }

  function towerNextFloor() {
    const T = w.tower;
    if (T.floor >= TOWER.floors) { T.asc += 1; T.floor = 1; } else T.floor += 1;
    w.zone = towerZone(T.floor, T.asc);
    w.flags = ZONE_FLAGS[w.zone.mechanic] || {};
    w.mech = createMechanic(w.zone, w);
    w.sin = 0; w.sinOn = false;
    startRoom(0); nextWave();
  }

  const rsOf = () => (w.tower ? { ri: w.ri, ph: w.rphase, wv: w.wave, fl: w.tower.floor, as: w.tower.asc } : { ri: w.ri, ph: w.rphase, wv: w.wave });
  function publishRs() { w.room.presence({ rs: rsOf() }); }

  // phase changes are shown the same way for the host and everyone else
  function onPhase(ph) {
    if (ph === 'clear') { audio.play(w.tower ? 'floorClear' : 'unlock'); app.hud.banner('ห้องนี้สงบแล้ว', 'เดินเข้าประตูมิติทางขวาเพื่อไปต่อ'); w.vacuum = true; }
    else if (ph === 'victory') { audio.play('victory'); app.hud.banner('พิชิตโซน!', w.zone.name); w.vacuum = true; }
    else if (ph === 'defeat') { audio.play('defeat'); app.hud.banner('คณะสำรวจล้มทั้งหมด', ''); }
  }

  // The host left mid-run: the next friend in the roster (still connected) takes over the monsters, the room flow and the
  // zone mechanic, so the climb goes on. Every client picks the same successor from the same roster order.
  function migrateHost() {
    (w.deadHosts ||= new Set()).add(w.host);
    const alive = (peer) => peer === w.me || (() => { const a = w.allies.get(peer); return !!a && a.seen && a.goneT < GONE_AFTER; })();
    const next = w.roster.find((peer) => !w.deadHosts.has(peer) && alive(peer));
    if (!next) return false;
    w.host = next; w.lastRs = ''; w.seenHost = false;
    if (next !== w.me) { app.toast(`${w.allies.get(next)?.name || 'เพื่อน'} รับหน้าที่เจ้าของห้องต่อ`, 'info', 'host'); return true; }
    // I am the host now: rebuild the monsters from what I last saw of them
    w.amHost = true;
    w.mech = createMechanic(w.zone, w);
    const seen = [...w.views.values()].filter((v) => !v.dead && !v.clone);
    w.views.clear(); w.enemies = []; w.queue.length = 0;
    if (w.phase === 'waiting') { w.phase = 'run'; startRoom(0); nextWave(); }
    else {
      w.phase = 'run';
      if (Number.isFinite(w.hostWave)) w.wave = w.hostWave;
      if (w.rphase === 'fight') for (const v of seen) {
        const e = spawnEnemy(v.type.id, v.x, v.y);
        if (e) e.hp = Math.max(1, Math.round(e.maxHp * Math.min(1, v.hp / Math.max(1, v.maxHp))));
      }
      w.mech?.reset(w.ri); publishRs();
    }
    app.hud.banner('เจ้าของห้องออกไป', 'คุณรับหน้าที่คุมสนามต่อ');
    return true;
  }

  function followHost(dt) {
    const hostP = w.room.peers().find((x) => x.peer === w.host);
    const ally = w.allies.get(w.host);
    if (!hostP || ally?.goneT > GONE_AFTER) {
      if ((ally?.seen || w.phaseT > 20) && (ally?.goneT ?? 99) > GONE_AFTER) { if (!migrateHost()) finish('host_left'); }
      return;
    }
    w.seenHost = true;
    const raw = hostP.presence || {};
    // monsters as the host sees them
    if (Array.isArray(raw.en)) readEnemies(raw.en, dt);
    const rs = raw.rs;
    if (rs && typeof rs === 'object') {
      if (Number.isFinite(rs.wv)) w.hostWave = rs.wv | 0;
      const key = `${rs.ri}|${rs.ph}|${rs.fl ?? ''}|${rs.as ?? ''}`;
      if (key !== w.lastRs) {
        w.lastRs = key;
        if (w.tower && Number.isFinite(rs.fl) && (rs.fl | 0) >= 1 && ((rs.fl | 0) !== w.tower.floor || (rs.as | 0) !== w.tower.asc)) {
          // the party climbed to another floor: pay the one I leave (if I missed its end), then go there
          towerCleared();
          w.tower.floor = Math.min(TOWER.floors, rs.fl | 0); w.tower.asc = Math.max(0, Math.min(999, rs.as | 0));
          w.zone = towerZone(w.tower.floor, w.tower.asc); w.flags = ZONE_FLAGS[w.zone.mechanic] || {};
          w.sin = 0; w.sinOn = false; w.phase = 'run'; startRoom(0);
        }
        if (w.zone.nested && (rs.ri | 0) >= w.zone.rooms.length && !w.nestedOpen) { w.nestedOpen = true; w.zone = { ...w.zone, rooms: [...w.zone.rooms, ...w.zone.nested] }; }
        const ri = Math.max(0, Math.min(w.zone.rooms.length - 1, rs.ri | 0));
        if (ri !== w.ri || w.phase === 'waiting') { w.phase = 'run'; startRoom(ri); }
        if (['clear', 'victory', 'defeat'].includes(rs.ph) && w.rphase !== rs.ph) { w.rphase = rs.ph; w.phaseT = 0; if (w.tower && rs.ph === 'clear') towerCleared(); onPhase(rs.ph); }
        else if (rs.ph === 'fight') w.rphase = 'fight';
      }
    }
  }

  function readEnemies(list, dt) {
    const seen = new Set();
    // v9.4: the host's monsters are reported ~20×/s; between reports they keep moving at the speed seen in the last two (≤0.12 s)
    const nowMs = performance.now();
    const fresh = list !== w.enRef;
    if (fresh) w.enRef = list;
    for (const row of list.slice(0, 60)) {
      if (!Array.isArray(row)) continue;
      const [id, ti, x, y, hp, maxHp, warn, flags, hidden, z, armor, armorMax, armorPhase, puz] = row;
      const def = getEnemy(ZONE_ENEMY_IDS[ti]);
      if (!def || typeof id !== 'number') continue;
      seen.add(id);
      let v = w.views.get(id);
      if (!v) { v = { id, type: def, r: def.radius, x, y, sx: 1, sy: 1, ai: {}, spawning: 0, dead: false, flash: 0, isView: true }; w.views.set(id, v); app.ensureRig(def.id); }
      const ntx = num(x, 0, A.w), nty = num(y, 0, A.h);
      if (fresh) {
        const dtS = v.pAt ? (nowMs - v.pAt) / 1000 : 0;
        if (dtS > 0.015 && dtS < 0.6 && v.tx != null && Math.hypot(ntx - v.tx, nty - v.ty) < 220) {
          const vx = (ntx - v.tx) / dtS, vy = (nty - v.ty) / dtS, sp = Math.hypot(vx, vy), f = sp > 700 ? 700 / sp : 1;
          v.evx = vx * f; v.evy = vy * f;
        } else { v.evx = 0; v.evy = 0; }
        v.pAt = nowMs;
      }
      v.tx = ntx; v.ty = nty;
      const ahead = v.pAt ? Math.min(0.12, Math.max(0, (nowMs - v.pAt) / 1000)) : 0;
      const k = 1 - Math.exp(-dt * 18);
      v.x += (v.tx + (v.evx || 0) * ahead - v.x) * k; v.y += (v.ty + (v.evy || 0) * ahead - v.y) * k;
      v.hp = num(hp, 0, 1e10); v.maxHp = num(maxHp, 1, 1e10, 1); v.warn = num(warn, 0, 10) / 10;
      v.flip = !!(flags & 1); v.guarding = !!(flags & 2); v.untargetable = !!(flags & 4); v.invuln = flags & 8 ? 1 : 0; v.clone = !!(flags & 16); v.hidden = num(hidden, 0, 10) / 10; v.ai.z = num(z, 0, 300);
      v.armor = num(armor, 0, 1e10); v.armorMax = num(armorMax, 0, 1e10); v.armorPhase = num(armorPhase, 0, 3);
      v.puz = typeof puz === 'string' ? (/^\d{3}[0-2]{0,9}$/.test(puz) ? puz : 0) : num(puz, 0, 99);
      if (def.boss && !v.clone) { app.hud.setBoss(def.name, v.hp / v.maxHp, barsOf(def)); app.hud.setBossArmor?.(v.armor, v.armorMax, v.armorPhase); bossMusic(def, v.hp / v.maxHp); }
    }
    for (const [id, v] of w.views) if (!seen.has(id) && !v.dead) { v.dead = true; v.deathT = 0; }
  }

  function packEnemies() {
    return w.enemies.filter((e) => !e.dead || e.deathT < 0.05).slice(0, 40).map((e) => [
      e.id, e.ti, Math.round(e.x), Math.round(e.y), Math.ceil(e.hp), e.maxHp, Math.round((e.warn || 0) * 10),
      (e.flip ? 1 : 0) | (e.guarding ? 2 : 0) | (e.untargetable ? 4 : 0) | (e.invuln > 0 ? 8 : 0) | (e.clone ? 16 : 0), Math.round((e.hidden || 0) * 10), Math.round(e.ai?.z || 0),
      Math.ceil(e.armor || 0), e.armorMax || 0, e.armorPhase || 0,
      e.puz || 0,          // v9.2: the Egypt puzzle marks (colour, number, lit, progress) so every player sees the same thing
    ]);
  }

  // ------------------------------------------------------------ allies
  function readAllies(dt) {
    const peers = w.room.peers();
    const byPeer = new Map(peers.map((x) => [x.peer, x]));
    for (const a of w.allies.values()) {
      const x = byPeer.get(a.peer);
      const raw = x?.presence;
      if (!raw || raw.v !== PROTOCOL || x.sameTab) { a.goneT += dt; continue; }
      a.goneT = 0; a.seen = true;
      const px = a.x, py = a.y;
      updateRemoteFighter(a, raw, dt);
      if (px != null && dt > 0) { a.vx = (a.x - px) / dt; a.vy = (a.y - py) / dt; }
      const c = readPresence(raw);
      a.name = c?.name || 'นักล่า'; a.title = c?.title || null; a.badge = c?.badge || 0; a.look = c ? { a: c.armor, r: c.race, w: c.weapon, pet: c.pet, wg: c.wings } : a.look; a.lv = c?.lv || a.lv;
      a.ko = raw.st === 'ko'; a.dead = a.ko;
      a.rp = a.ko ? num(raw.rp, 0, 1, 0) : 0;
      if (a.newActive) remoteSwingFx(a);
    }
  }

  function remoteSwingFx(r) {
    const d = r.move?.def; if (!d) return;
    const t = r.wtype.trail, h = d.hit;
    if (h.shape === 'arc') {
      if (['thrust', 'stab', 'stabB'].includes(d.anim)) w.fx.thrust(r.x, r.y - 18, r.move.dir, h.range, t.color, t.glow, d.power);
      else w.fx.slash(r.x, r.y - 18, r.move.dir, (h.arc * Math.PI) / 180, h.range * 0.82, d.power * t.width, t.color, d.anim === 'slashUp' || d.anim === 'heavyUp', t.glow);
    } else if (h.shape === 'circle') {
      const ox = r.x + Math.cos(r.move.dir) * (h.forward || 0), oy = r.y - 10 + Math.sin(r.move.dir) * (h.forward || 0);
      w.fx.ring(ox, oy, 12, h.r, t.glow, 0.42, 8);
    }
  }

  // A downed hero gets back up when a friend stands beside them long enough.
  // The tower with friends: a downed hero shows a "+"; a friend beside them holds the revive button for 7 seconds
  // (the rescuer sends a heartbeat, the downed hero's own client counts it) and they rise with half their health.
  function towerRevive(dt, intent) {
    const p = w.player;
    w.rescueLabel = null;
    if (p.dead) {
      w.rescueGrace = Math.max(0, (w.rescueGrace || 0) - dt);
      w.reviveT = w.rescueGrace > 0 ? w.reviveT + dt : Math.max(0, w.reviveT - dt * 0.5);
      if (w.reviveT >= TOWER_PARTY.reviveTime) {
        w.reviveT = 0; w.rescueGrace = 0; p.dead = false; p.deathT = 0; p.hp = Math.max(1, Math.round(p.maxHp * TOWER_PARTY.reviveHp)); p.iframes = 2;
        w.fx.ring(p.x, p.y - 30, 10, 140, '#9fe0a0', 0.8, 6); audio.play('levelup'); app.hud.banner('ลุกขึ้นสู้ต่อ!', 'เพื่อนชุบชีวิตให้ เลือดเหลือครึ่งหนึ่ง');
      }
      return;
    }
    w.reviveT = 0; w.rescueGrace = 0;
    let best = null, bd = TOWER_REVIVE_RANGE;
    for (const a of w.allies.values()) {
      if (!a.seen || !a.ko || a.goneT >= GONE_AFTER || a.x == null) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) { w.rvAcc = 0; return; }
    const left = Math.max(1, Math.ceil((1 - (best.rp || 0)) * TOWER_PARTY.reviveTime));
    w.rescueLabel = intent.interactHeld ? `กำลังชุบ ${best.name}… ${left}` : `กดค้างเพื่อชุบ ${best.name}`;
    if (intent.interactHeld) {
      w.rvAcc = (w.rvAcc || 0) + dt;
      if (w.rvAcc >= 0.2) { w.rvAcc = 0; queue(['rv', best.peer]); }
    } else w.rvAcc = 0.2;       // first heartbeat goes out the moment the button goes down
  }

  function reviveCheck(dt, intent) {
    const p = w.player;
    if (w.tower && w.party > 1) { towerRevive(dt, intent); return; }
    if (!p.dead || w.party < 2) { w.reviveT = 0; return; }
    const helper = [...w.allies.values()].some((a) => a.seen && !a.ko && a.goneT < GONE_AFTER && a.x != null && Math.hypot(a.x - p.x, a.y - p.y) < REVIVE_RANGE);
    w.reviveT = helper ? w.reviveT + dt : Math.max(0, w.reviveT - dt * 0.5);
    if (w.reviveT >= REVIVE_TIME) {
      w.reviveT = 0; p.dead = false; p.deathT = 0; p.hp = Math.round(p.maxHp * 0.4); p.iframes = 2;
      w.fx.ring(p.x, p.y - 30, 10, 120, '#9fe0a0', 0.7, 6); audio.play('levelup'); app.hud.banner('กลับมาสู้ต่อ!', 'เพื่อนช่วยพยุงขึ้น');
    }
  }

  // ------------------------------------------------------------ end
  function finish(outcome) {
    if (w.ended) return;
    w.ended = true;
    input.setEnabled(false);
    const lost = sweepDrops();
    if (lost.length) app.toast(`กระเป๋าเต็ม — ของ ${lost.length} ชิ้นเก็บไม่ได้และหายไป`, 'warn', 'bag-lost');
    const next = cloneState(store.get());
    next.stats.runs += 1;
    next.stats.perfects = (next.stats.perfects || 0) + (w.run.perfects || 0);
    next.stats.parries = (next.stats.parries || 0) + (w.parries || 0);
    next.stats.bossKills = (next.stats.bossKills || 0) + (w.run.bossKills || 0);
    let reward = null;
    if (w.inf) {
      // death and leaving both pay everything gathered
      next.gold += w.inf.coins; w.run.gold += w.inf.coins;
      const got = grantArtifactsInPlace(next, w.inf.arts);
      const reached = Math.max(0, w.inf.wave - (w.inf.cleared ? 0 : 1));
      next.infinite.best = Math.max(next.infinite.best || 0, reached); next.infinite.runs = (next.infinite.runs || 0) + 1;
      reward = { infinite: { wave: reached, best: next.infinite.best, coins: w.inf.coins, arts: got } };
    }
    if (w.tower) {
      next.tower.runs = (next.tower.runs || 0) + 1;
      reward = { tower: { start: w.tower.start, reached: w.tower.floor, cleared: w.tower.cleared, deepest: w.tower.deepest, asc: w.tower.asc, gold: w.tower.gold, sparks: w.tower.sparks, xp: w.tower.xp, best: next.tower.best, nowAsc: next.tower.asc } };
    }
    if (outcome === 'victory' && !w.inf && !w.tower) {
      const first = !next.zones.cleared[w.zone.id];
      reward = clearReward(w.zone, first);
      next.zones.cleared[w.zone.id] = (next.zones.cleared[w.zone.id] || 0) + 1;
      if (w.zone.raid) { const r = next.raids[w.zone.id] || { last: 0, kills: 0 }; next.raids[w.zone.id] = { last: Date.now(), kills: r.kills + 1 }; }
      if (w.zone.rush) next.stats.bossRush = (next.stats.bossRush || 0) + 1;
      const secs = Math.round((performance.now() - w.run.start) / 1000);
      if (!next.zones.best[w.zone.id] || secs < next.zones.best[w.zone.id]) next.zones.best[w.zone.id] = secs;
      next.gold += reward.gold; next.sparks += reward.sparks;
      // v8.2 Luck Potion: one more roll of the boss's drop table at the end of the run, with luck
      const lm = luckMult(store.get());
      if (lm > 1) {
        const bossDef = getEnemy(w.zone.boss || w.zone.lineup?.[w.zone.lineup.length - 1]);
        const got = [];
        for (const d of bossDef?.drops ? rollDrops(bossDef.drops, rng, lm) : []) {
          if (!canAdd(next, d.id, d.qty) || !addInPlace(next, d.id, d.qty).ok) continue;
          got.push(d); w.run.items.set(d.id, (w.run.items.get(d.id) || 0) + d.qty);
        }
        if (got.length) reward.luckLoot = got;
      }
      w.run.levelUps += grantXpInPlace(next, reward.xp);
      w.run.gold += reward.gold; w.run.sparks += reward.sparks; w.run.xp += reward.xp;
      reward.first = first;
    }
    const save = store.commit(next, { reason: 'zone-end' });
    app.onZoneEnd({
      outcome, zone: w.zone, reward, saveOk: save.ok, party: w.party,
      run: { gold: w.run.gold, sparks: w.run.sparks, xp: w.run.xp, kills: w.run.kills, levelUps: w.run.levelUps, bestCombo: w.run.bestCombo, perfects: w.run.perfects,
             items: [...w.run.items.entries()].map(([id, qty]) => ({ id, qty })), seconds: Math.round((performance.now() - w.run.start) / 1000) },
    });
  }

  // ------------------------------------------------------------ frame
  function update(dt) {
    if (!w || w.ended) return;
    w.lastTick = performance.now();
    const intent = input.poll();
    if (intent.pause) { app.leaveZone(); }
    if (w.stopT > 0) { w.stopT -= dt; renderer.update(dt); return; }
    if (w.slowT > 0) w.slowT -= dt;
    const edt = w.slowT > 0 ? dt * CB.perfect.timeScale : dt;
    w.time += edt; w.phaseT += dt;
    if (w.darkT > 0) w.darkT -= dt;
    w.fx.update(dt); w.particles.update(edt); renderer.update(dt);
    tickSkills(w.skills, dt); tickRaceSkill(w.raceSkill, dt, w);

    readAllies(dt);
    if (w.amHost) {
      if (w.phase === 'waiting') {
        const all = [...w.allies.values()];
        if (all.every((a) => a.seen) || w.phaseT > 12) { w.phase = 'run'; startRoom(0); nextWave(); }
      }
    } else followHost(dt);
    if (w.ended) return;

    // my hero
    const p = w.player;
    const prevX = p.x, prevY = p.y;
    if (!p.dead) {
      if (p.silenceT > 0) p.silenceT -= dt;
      if (p.chillT > 0) p.chillT -= dt;
      if (p.stunT > 0) { p.stunT -= dt; intent.attack = intent.dash = intent.race = false; intent.skill = -1; intent.mx = intent.my = 0; intent.attackHeld = false; }
      if (p.silenceT > 0 && (intent.skill >= 0 || intent.race)) { if (!(w.silMsg > w.time)) { w.silMsg = w.time + 1; app.toast('ถูกปิดเสียง ใช้สกิลไม่ได้ชั่วครู่', 'warn', 'silence'); } intent.skill = -1; intent.race = false; }
      if (intent.ult) w.tryUlt();
      if (w.ult?.run) Object.assign(intent, { skill: -1, race: false, attack: false, attackHeld: false, dash: false, mx: 0, my: 0, potion: false, guard: false });
      if (intent.skill >= 0) castSkill(w.skills, intent.skill, w);
      if (intent.race) castRaceSkill(w);
      w.enemies = w.amHost ? w.enemies : [...w.views.values()].filter((v) => !v.dead && !v.untargetable);
      updatePlayer(p, intent, dt, w);
      tickUnique(p, dt);
      // zone ground: sand and webs slow, ice keeps you sliding
      const mods = { ...w.statusMods, slow: Math.min(w.statusMods.slow, p.chillT > 0 ? 0.55 : 1) };
      if (mods.slow < 1 && !(p.dashT > 0)) { p.x = prevX + (p.x - prevX) * mods.slow; p.y = prevY + (p.y - prevY) * mods.slow; }
      if ((w.flags.slippery || mods.ice) && !(p.dashT > 0)) {
        const vx = (p.x - prevX) / Math.max(dt, 1e-3), vy = (p.y - prevY) / Math.max(dt, 1e-3);
        const k = Math.min(1, dt * 3.2);
        w.slide.vx += (vx - w.slide.vx) * k; w.slide.vy += (vy - w.slide.vy) * k;
        p.x = prevX + w.slide.vx * dt; p.y = prevY + w.slide.vy * dt;
      } else { w.slide.vx = (p.x - prevX) / Math.max(dt, 1e-3); w.slide.vy = (p.y - prevY) / Math.max(dt, 1e-3); }
      w.clampBody(p);
      let regen = p.stats.regen || 0;
      if (p.buffs.bloomT > 0 && w.raceSkill) regen += w.raceSkill.v.heal / w.raceSkill.v.duration;
      if (regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regen * dt);
    } else p.deathT += dt;
    p.vx = (p.x - prevX) / Math.max(dt, 1e-3); p.vy = (p.y - prevY) / Math.max(dt, 1e-3);
    w.sk.update(dt, w);
    reviveCheck(dt, intent);
    w.combo.t += dt; styleTick(w.style, dt);
    if (w.combo.n > 0 && w.combo.t > CB.combo.resetAfter) w.combo.n = 0;

    // monsters (host simulates; their target is set per monster)
    const frozen = updateUlt(w, dt);
    if (w.amHost && w.phase === 'run' && !frozen) {
      if (w.tower && partyNow() !== w.scaleN) { w.scaleN = partyNow(); for (const e of w.enemies) if (!e.dead && e.pf) applyPartyScale(e); }
      const list = targets();
      for (const e of w.enemies) {
        if (list.length && !e.dead) { e.ai.tgtT = (e.ai.tgtT || 0) - edt; w.player = pickTarget(e, list); }
        tickAffixes(e, edt, w);
        tickBossArmor(e, edt, w);
        e.paused = !e.dead && (bossTricks(e, edt, w, w.trickLevel) || delayedSwing(e, edt, w, w.trickLevel));
        updateEnemy(e, edt * tempoOf(e) * (e.pf?.tempo || 1), w);
        openBossGuard(e);       // v8.6: bosses are never untouchable (see battle/bossGuard.js)
        if (e.trial?.pierce && !e.trialPierce && !e.dead && (e.enraged || (e.ai?.phase || 1) >= 2)) {
          e.trialPierce = true; e.affixes = [...(e.affixes || []), 'piercing'];
          w.announce(`${e.type.name} เริ่มโจมตีเจาะเกราะ! วงสีแดงเข้ม = ต้องหลบ ห้ามกัน`); audio.play('pierceWarn');
        }
        w.player = p;
        tickStatus(e, edt, w);
      }
      separate(w.enemies);
      for (let i = w.enemies.length - 1; i >= 0; i--) if (w.enemies[i].dead && w.enemies[i].deathT > 0.6) w.enemies.splice(i, 1);
      w.mech?.update(edt, list);
      hostRoomFlow(dt);
      const boss = w.enemies.find((e) => e.type.boss && !e.dead);
      if (boss) { app.hud.setPoise?.(boss.poise ?? CB.poise.max, boss.brokenT > 0); app.hud.setBossArmor?.(boss.armor || 0, boss.armorMax || 0, boss.armorPhase || 0); }
    } else {
      for (const v of w.views.values()) { if (v.flash > 0) v.flash -= dt * 6; if (v.dead) v.deathT += dt; }
      for (const [id, v] of w.views) if (v.dead && v.deathT > 0.6) w.views.delete(id);
    }

    // effects against my own hero
    w.statusMods = updateEffects(w.fxs, edt, {
      me: p, arena: A, particles: w.particles, sfx: (n) => audio.play(n), shake: (m, t) => renderer.shake(m, t),
      hurt: (owner, mult, kx, ky, fire, tick, x) => hurtMe(owner, mult, kx, ky, fire, tick, { unblockable: true, ...(x || {}) }),
      posOf: (peer) => w.allies.get(peer) || null,
    });
    for (let i = w.drops.length - 1; i >= 0; i--) if (!updateDrop(w.drops[i], dt, w)) w.drops.splice(i, 1);
    if (w.vacuum && w.drops.length === 0) w.vacuum = false;
    updateSnares(w.snares, edt, w);
    updateShots(w.shots, dt, w);
    updateZones(w.zones, dt, w);
    updateCones(w.cones, dt, w);
    if (!p.dead) for (const pt of w.pets) updatePet(pt, dt, w);

    // the end: solo death ends the run at once; victory waits for the loot to fly in
    if (w.party === 1 && p.dead && p.deathT > 1.6 && w.rphase !== 'victory') { finish('defeat'); return; }
    if (w.rphase === 'victory' && w.phaseT > 2.4 && w.drops.length === 0) { finish('victory'); return; }
    if (w.rphase === 'victory' && w.phaseT > 6) { finish('victory'); return; }
    if (w.rphase === 'defeat' && w.phaseT > 2) { finish('defeat'); return; }

    // network
    w.sendAcc += dt;
    if (w.sendAcc >= (w.party > 4 ? SEND_EVERY * 1.35 : SEND_EVERY) && w.party > 1) {
      w.sendAcc = 0;
      const pres = fighterPresence(p, w.look, p.dead ? 'ko' : w.phase === 'waiting' ? 'ready' : 'fight');
      if (w.amHost) { pres.en = packEnemies(); pres.rs = rsOf(); }
      if (w.tower && p.dead) pres.rp = Math.round(Math.min(1, w.reviveT / TOWER_PARTY.reviveTime) * 100) / 100;
      w.room.presence(pres);
    }
    w.evAcc += dt;
    if (w.evAcc >= EVENTS_EVERY) { w.evAcc = 0; flush(); }

    // in the portal?
    w.inPortal = w.rphase === 'clear' && Math.hypot(p.x - PORTAL.x, p.y - PORTAL.y) < PORTAL.r;
    app.hud.setInteract(w.rescueLabel || w.rphase === 'clear' ? (w.rescueLabel || (w.inPortal ? (w.party > 1 ? 'รอเพื่อนเข้าประตู…' : 'กำลังเข้าประตู…') : 'เดินเข้าประตูมิติทางขวา')) : null);
    camera(dt);
    app.hud.update(p, w);
  }

  function camera(dt) {
    const cam = renderer.cam, v = renderer.view, p = w.player;
    const landscape = app.touch && v.w > v.h;
    const top = landscape ? 50 : app.touch ? 130 : 60, bottom = landscape ? 8 : app.touch ? 240 : 76;
    // v8: rooms are bigger than the screen; the camera keeps the old framing (about 1280×820 of the room in view)
    // and follows the hero instead of shrinking everything to fit
    const byH = (v.h - top - bottom) / 820, byW = v.w / 1280;
    cam.zoom = Math.max(0.5, Math.min(1.2, v.w < v.h ? byH : Math.min(byW, byH)));
    const hw = v.w / 2 / cam.zoom, hh = (v.h - top - bottom) / 2 / cam.zoom, shiftY = (top - bottom) / 2 / cam.zoom;
    const tx = A.w <= hw * 2 ? A.w / 2 : Math.max(hw, Math.min(A.w - hw, p.x));
    const ty = (A.h - A.wall * 2 <= hh * 2 ? A.h / 2 : Math.max(hh + A.wall / 2, Math.min(A.h - hh - A.wall / 2, p.y - 30))) - shiftY;
    const k = Math.min(1, dt * 7);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  }

  // ------------------------------------------------------------ drawing
  function drawShadow(x, y, rx) { ctx.fillStyle = 'rgba(12,8,6,0.38)'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }

  function drawEnemy(e) {
    const s = sprites[e.type.sprite];
    if (!s) return;
    const anim = tickAnim(e, w.time);
    const R = app.rigs[e.type.id];
    const z = e.ai?.z || 0;
    const spawnK = e.spawning > 0 ? 1 - e.spawning / 0.7 : 1;
    const hid = bossHiddenAlpha(e, e.hidden);
    if (!e.clone) drawShadow(e.x, e.y, e.r * (1 - z / 160) * spawnK * (1 - hid * 0.6));     // shadow copies cast none: that is how the real one is found
    if (hid >= 0.95) return;
    if (e.type.ai === 'egypt_glyph' && !e.dead) drawGlyphPad(e);
    const alpha = (e.dead ? Math.max(0, 1 - (e.deathT || 0) / 0.5) : spawnK) * (1 - hid * 0.85);
    const scale = (e.type.boss ? 1.0 : 0.72) * (e.type.scale || 1) * (e.sizeK || 1);
    const CR = !R && !e.type.boss ? app.critters[e.type.id] : null;    // v8: small monsters move part by part
    const rigK = R ? R.def.scale * (e.type.scale || 1) * (e.sizeK || 1) : CR ? CR.def.scale * (e.type.scale || 1) * (e.sizeK || 1) : 0;
    const tall = R ? 215 * rigK : CR ? critterHeight(CR) * rigK : s.h * scale;    // how tall the monster stands (for the marks above it)
    if (e.affixes) drawAffixes(ctx, e, w.time, tall + z);
    if (e.facesGuard && !e.dead) drawMasks(e, tall);
    if (e.ai?.anchors) for (const a of e.ai.anchors) if (!a.dead) {
      // the chains that hold the jailer's shield, one to each anchor
      ctx.save(); ctx.strokeStyle = 'rgba(184,184,196,0.75)'; ctx.lineWidth = 4; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -w.time * 40;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - tall * 0.5); ctx.lineTo(a.x, a.y - 30); ctx.stroke(); ctx.restore();
    }
    const flash = e.flash > 0 ? e.flash : (e.warn ? 0.18 + 0.25 * Math.abs(Math.sin(w.time * 22)) : 0);
    const tgt = w.player;
    const el = e.type.boss && !e.dead ? bossElement(e.type.id) : null;
    if (el && hid < 0.5) drawBossAura(e, el, tall, z);
    if (R) {
      // a jointed fighter: faces its target, winds up, swings the weapon in its hand, casts from the tip
      const face = tgt && !e.dead ? (tgt.x < e.x ? -1 : 1) : (anim.face || 1);
      anim.face = face;
      const sp = Math.hypot(e.vx || 0, e.vy || 0);
      anim.walkT = (anim.walkT || 0) + (anim.dt || 0) * Math.min(14, sp / 14);
      const aim = tgt ? Math.max(-0.9, Math.min(0.9, Math.atan2((tgt.y - 40) - (e.y - 140 * rigK), Math.abs(tgt.x - e.x) || 1))) : 0;
      drawRig(renderer, R, e, { x: e.x, y: e.y - z, flip: face < 0, scale: rigK * spawnK, time: w.time + (e.id || 0) * 0.37, moving: sp > 25, walkT: anim.walkT, aim, alpha, flash, hurt: e.flash > 0.4 ? 1 : 0, deathT: e.dead ? (e.deathT || 0) : null });
    } else if (CR) {
      drawCritterAt(renderer, CR, e, anim, { z, scale: rigK * spawnK, alpha, flash, target: tgt, time: w.time });
    } else {
      const m = spriteMotion(e, anim, w.time, e.type.faces && e.flip ? -1 : 1);
      renderer.sprite(s, e.x + m.dx, e.y - z + m.dy, { flip: e.type.faces ? e.flip : false, rot: m.rot, sx: (e.sx || 1) * scale * spawnK * m.sx, sy: (e.sy || 1) * scale * spawnK * m.sy, flash, alpha });
    }
    if (el && hid < 0.5) drawElementFx(ctx, el, { x: e.x - tall * 0.75, y: e.y - z - tall * 1.1, w: tall * 1.5, h: tall * 1.15 }, w.time + (e.id || 0), 0.55);
    if (!e.isView) drawStatus(ctx, e, w.time, tall + z);
    drawInvuln(ctx, e, w.time, tall + z);
    drawBossArmor(ctx, e, w.time, tall + z);
    if (e.shell > 0 && !e.dead) {
      // the ice cocoon and how much of it is left
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#cfeaff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - tall * 0.45, e.r + 26, tall * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      const bw = 120, by = e.y - tall - 30;
      ctx.fillStyle = 'rgba(20,12,9,0.8)'; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 8);
      ctx.fillStyle = '#cfeaff'; ctx.fillRect(e.x - bw / 2, by, bw * (e.shell / (e.shellMax || e.shell)), 6);
    }
    if (e.guarding && !e.dead) {
      ctx.save(); ctx.strokeStyle = e.type.ai === 'counter' ? 'rgba(191,227,255,0.85)' : 'rgba(255,207,90,0.8)'; ctx.lineWidth = 4;
      const a = e.ai?.face ?? (e.flip ? Math.PI : 0);
      ctx.beginPath(); if (e.type.ai === 'counter') ctx.ellipse(e.x, e.y - 40, 40, 52, 0, 0, Math.PI * 2); else ctx.arc(e.x, e.y - 30, e.r + 16, a - 0.9, a + 0.9); ctx.stroke(); ctx.restore();
    }
    if (e.warn > 0 && !e.dead) {
      const hy = e.y - tall - 12 - z;
      ctx.fillStyle = '#e0503a'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 3; ctx.font = '900 22px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('!', e.x, hy); ctx.fillText('!', e.x, hy);
    }
    if (!e.type.boss && !e.dead && e.hp < e.maxHp) {
      const bw = e.r * 1.8, by = e.y - tall - 4 - z;
      ctx.fillStyle = 'rgba(20,12,9,0.8)'; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#c2412f'; ctx.fillRect(e.x - bw / 2, by, bw * (e.hp / e.maxHp), 4);
    }
    drawBrands(ctx, e, w.time);
    if (e.type.ai === 'egypt_glyph' && !e.dead) drawGlyphMark(e, tall);
    else if (e.type.ai === 'egypt_warden' && !e.dead) drawWardenGuide(e, tall);
  }

  // ------------------------------------------------------------ v9.2 Egypt puzzle marks
  // Each statue has a colour AND a number (so it is readable without telling red from green); the one that lights up gets a
  // pillar of light, a ring and a big number. The warden shows how many strikes are needed and how many are done.
  const GLYPH_COL = ['#ff6b57', '#5fb0ff', '#6fe08a'];
  function glyphState(e) { const n = typeof e.puz === 'number' ? e.puz : 0; return { gi: Math.max(0, ((n % 10) || 1) - 1), lit: n % 20 >= 10, hint: n >= 20 }; }
  function drawGlyphPad(e) {
    const { gi, lit, hint } = glyphState(e), col = GLYPH_COL[gi] || '#ffcf5a', t = w.time;
    ctx.save();
    ctx.globalAlpha = lit ? 0.95 : 0.5;
    ctx.fillStyle = hexA(col, lit ? 0.55 : 0.22); ctx.strokeStyle = col; ctx.lineWidth = lit ? 6 : 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, e.r + 34, (e.r + 34) * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (hint) {   // the helping pulse: "hit this one next"
      const k = 0.5 + 0.5 * Math.sin(t * 7);
      ctx.globalAlpha = 0.4 + 0.5 * k; ctx.lineWidth = 5; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, e.r + 52 + 10 * k, (e.r + 52 + 10 * k) * 0.46, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function drawGlyphMark(e, tall) {
    const { gi, lit, hint } = glyphState(e), col = GLYPH_COL[gi] || '#ffcf5a', t = w.time;
    if (lit) {   // a pillar of light over the statue
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, e.y - tall - 260, 0, e.y + 10);
      g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.7, hexA(col, 0.55)); g.addColorStop(1, hexA(col, 0.85));
      ctx.fillStyle = g; ctx.fillRect(e.x - e.r - 8, e.y - tall - 260, (e.r + 8) * 2, tall + 270);
      ctx.restore();
    }
    const by = e.y - tall - 30 - (hint ? 4 * Math.sin(t * 7) : 0), br = lit ? 25 : 19;
    ctx.save();
    ctx.fillStyle = lit ? col : hexA(col, 0.8); ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(e.x, by, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a100c'; ctx.font = `900 ${lit ? 30 : 24}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(gi + 1), e.x, by + 1);
    if (hint) { ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 4; ctx.font = '900 20px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.strokeText('ฟันตรงนี้!', e.x, by - br - 8); ctx.fillText('ฟันตรงนี้!', e.x, by - br - 8); }
    ctx.restore();
  }
  function drawWardenGuide(e, tall) {
    const s = typeof e.puz === 'string' ? e.puz : null;
    if (!s) return;
    const m = +s[0], done = +s[1], n = +s[2], shown = s.slice(3);
    if (!n || m === 3) return;
    const label = m === 1 ? 'ดูลำดับแสง…' : m === 2 ? 'ถึงตาเจ้า! ฟันตามลำดับ' : 'เตรียมตัว';
    const x = e.x, y = e.y - tall - 56, gap = 34, x0 = x - ((n - 1) * gap) / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 22px system-ui, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = m === 2 ? '#fff3c4' : '#ffcf5a';
    ctx.strokeText(label, x, y - 30); ctx.fillText(label, x, y - 30);
    for (let i = 0; i < n; i++) {
      const c = i < shown.length ? GLYPH_COL[+shown[i]] : null, px = x0 + i * gap;
      ctx.beginPath(); ctx.arc(px, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = c || 'rgba(20,12,9,0.7)'; ctx.fill(); ctx.strokeStyle = m === 2 && i === done ? '#fff3c4' : '#1a100c'; ctx.lineWidth = m === 2 && i === done ? 4 : 3; ctx.stroke();
      if (c) { ctx.fillStyle = '#1a100c'; ctx.font = '900 15px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(String(+shown[i] + 1), px, y + 1); ctx.textBaseline = 'alphabetic'; }
    }
    ctx.restore();
  }
  // boss aura: a soft glow of its colour behind it, brighter while it winds up
  function drawBossAura(e, el, tall, z = 0) {
    const col = el.c1, k = 0.55 + 0.45 * (e.anim?.wind || 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.x, e.y - z - tall * 0.5, 4, e.x, e.y - z - tall * 0.5, tall * 0.75);
    g.addColorStop(0, hexA(col, 0.22 * k)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(e.x - tall, e.y - z - tall * 1.3, tall * 2, tall * 1.6);
    ctx.restore();
  }

  // the masked god: nine masks circle it (v9.3.2: bigger, slower); the three white ones are the only places a blow lands
  function drawMasks(e, h) {
    const fg = e.facesGuard, n = fg.n || 9, every = Math.round(n / (fg.whites || 1)), cy = e.y - h * 0.5, R = e.r + 58, S = 1.9;
    for (let i = 0; i < n; i++) {
      const a = fg.a + (i / n) * Math.PI * 2, open = i % every === 0;
      const x = e.x + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.55;
      ctx.save();
      if (open) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 2, x, y, 30 * S); g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30 * S, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillStyle = open ? '#ffffff' : '#3a1a3a'; ctx.strokeStyle = open ? '#d8d4e8' : '#1a100c'; ctx.lineWidth = 2 * S * 0.7;
      ctx.beginPath(); ctx.ellipse(x, y, 11 * S, 14 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = open ? '#ff5a9a' : '#ff5a9a88';
      ctx.fillRect(x - 6 * S, y - 4 * S, 4 * S, 3 * S); ctx.fillRect(x + 2 * S, y - 4 * S, 4 * S, 3 * S);
      ctx.fillStyle = open ? '#c9c2dc' : '#2a102a'; ctx.beginPath(); ctx.ellipse(x, y + 6 * S, 3.5 * S, 2.2 * S, 0, 0, Math.PI * 2); ctx.fill();   // the mouth
      ctx.restore();
    }
  }

  function drawMe(p) {
    drawShadow(p.x, p.y, 22);
    if (p.charging && p.charge > 0) {
      const k = Math.min(1, p.charge / p.wtype.chargeTime);
      ctx.save(); ctx.strokeStyle = p.chargeReady ? '#fff3c4' : 'rgba(224,180,90,0.85)'; ctx.lineWidth = p.chargeReady ? 5 : 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 36, 13, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
    }
    const blink = p.iframes > 0 && !p.dead && p.dashT <= 0 && Math.floor(w.time * 20) % 2 === 0;
    const base = { flip: p.flip, time: w.time, walkT: p.walkT, moving: p.moving, wp: playerPose(p, w.time), type: p.wtype, scale: 0.95, vx: p.vx, speed: p.stats.speed };
    for (const g of p.ghosts) drawHero(renderer, sprites.heroParts, sprites.weapon, { ...base, x: g.x, y: g.y, flip: g.flip, walkT: g.walkT, dashing: true, flash: 0.85, alpha: 0.28 * (g.t / g.max) });
    drawHero(renderer, sprites.heroParts, sprites.weapon, { ...base, x: p.x, y: p.y - (p.leapZ || 0), dashing: p.dashT > 0 || !!p.lunge || !!p.rush, flash: p.flash > 0 ? p.flash : 0, alpha: p.blink && p.dashT > 0 ? 0.12 : blink ? 0.45 : 1, deathT: p.dead ? p.deathT : null });
    drawGuard(ctx, p, w.time);
    drawUniqueAura(ctx, p, w.time);
    if (p.dead && w.party > 1) { if (w.tower) downMark(p.x, p.y, w.reviveT / TOWER_PARTY.reviveTime); else reviveRing(p, w.reviveT / REVIVE_TIME); }
  }

  function drawAlly(a) {
    if (a.x == null) return;
    const look = a.look || {};
    drawShadow(a.x, a.y, 22);
    ctx.strokeStyle = 'rgba(159,224,160,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(a.x, a.y, 26, 10, 0, 0, Math.PI * 2); ctx.stroke();
    drawHero(renderer, app.heroPartsFor(look.a, look.r, look.wg), sprites['weapon_' + (getItem(look.w)?.id || 'w_rust_blade')], {
      x: a.x, y: a.y, flip: a.flip, time: w.time, walkT: a.walkT, moving: a.moving, wp: playerPose(a, w.time), type: a.wtype, scale: 0.95,
      dashing: a.dashT > 0 || !!a.rush, alpha: a.goneT > GONE_AFTER ? 0.35 : 1, deathT: a.ko ? 0.5 : null, vx: a.vx || 0, speed: 230,
    });
    ctx.font = '700 14px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = '#9fe0a0';
    ctx.strokeText(a.name, a.x, a.y - 112); ctx.fillText(a.name, a.x, a.y - 112);
    drawTitleLine(ctx, a.x, a.y - 128, a.title, a.badge);
    if (a.ko && w.tower) downMark(a.x, a.y, a.rp || 0);
    const frac = Math.max(0, a.hp / (a.maxHp || 1));
    ctx.fillStyle = 'rgba(20,12,9,0.85)'; ctx.fillRect(a.x - 35, a.y - 104, 70, 8); ctx.fillStyle = '#7fc77a'; ctx.fillRect(a.x - 34, a.y - 103, 68 * frac, 6);
    if (a.ko) { ctx.fillStyle = '#ffb3a4'; ctx.font = '700 12px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillText('ล้ม — ยืนข้างๆ เพื่อช่วย', a.x, a.y - 124); }
  }

  // a green "+" floating over a downed hero; a ring around it fills while friends revive them
  function downMark(x, y, k) {
    const cy = y - 82 + Math.sin(w.time * 4) * 4;
    ctx.save(); ctx.translate(x, cy);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34); g.addColorStop(0, 'rgba(120,255,160,0.5)'); g.addColorStop(1, 'rgba(120,255,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const a = 6, b = 17;
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#10331a'; ctx.fillStyle = '#6df08a';
    ctx.beginPath();
    ctx.moveTo(-a, -b); ctx.lineTo(a, -b); ctx.lineTo(a, -a); ctx.lineTo(b, -a); ctx.lineTo(b, a); ctx.lineTo(a, a);
    ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.lineTo(-a, a); ctx.lineTo(-b, a); ctx.lineTo(-b, -a); ctx.lineTo(-a, -a);
    ctx.closePath(); ctx.stroke(); ctx.fill();
    if (k > 0.01) {
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,12,9,0.7)'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#9fe0a0'; ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); ctx.stroke();
    }
    ctx.restore();
  }
  function reviveRing(p, k) {
    ctx.save(); ctx.strokeStyle = 'rgba(20,12,9,0.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y - 60, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#9fe0a0'; ctx.beginPath(); ctx.arc(p.x, p.y - 60, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); ctx.stroke(); ctx.restore();
  }

  function drawPortal() {
    if (w.rphase !== 'clear') return;
    const t = w.time;
    ctx.save(); ctx.translate(PORTAL.x, PORTAL.y - 50);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(${i % 2 ? '191,227,255' : '224,180,90'},${0.7 - i * 0.12})`; ctx.lineWidth = 6 - i;
      ctx.beginPath(); ctx.ellipse(0, 0, 46 + i * 8 + Math.sin(t * 3 + i) * 3, 74 + i * 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70); g.addColorStop(0, 'rgba(255,243,196,0.75)'); g.addColorStop(1, 'rgba(95,168,236,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 50, 76, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.4) w.particles.spawn({ x: PORTAL.x + (Math.random() - 0.5) * 80, y: PORTAL.y - 20, vx: 0, vy: -60, life: 0.9, size: 3, size2: 0.5, color: '#bfe3ff', drag: 0.5, glow: true });
  }

  function render() {
    if (!w) return;
    const v = renderer.view;
    renderer.screenSpace();
    ctx.fillStyle = '#0e0a08'; ctx.fillRect(0, 0, v.w, v.h);
    renderer.worldSpace();
    if (!w.floor) w.floor = paintZoneRoom(w.zone.theme, A, w.zone.n * 7);
    ctx.drawImage(w.floor, 0, 0);
    drawMechanicFloor(ctx, w.zone, w.time);
    drawPools(ctx, w.fxs, w.time);
    drawStrikes(ctx, w.fxs, w.time);
    drawZones(ctx, w.zones, w.time);
    drawSnares(ctx, w.snares, w.time);
    w.sk.drawGround(ctx, w.time);
    drawPetGround(renderer, w.pets, w.time);
    drawKitGround(renderer, w.raceSkill, w.time);
    drawPortal();
    for (const d of w.drops) drawDrop(ctx, d, sprites, w.time);   // v9.3.2: ground loot uses the same icon as the bag / pickup toast (no separate egy_ skin) so what drops is what you get
    const list = [];
    const enemies = w.amHost ? w.enemies : [...w.views.values()];
    for (const e of enemies) list.push({ y: e.y, f: () => drawEnemy(e) });
    for (const a of w.allies.values()) if (a.seen) list.push({ y: a.y ?? 0, f: () => drawAlly(a) });
    list.push({ y: w.player.y, f: () => drawMe(w.player) });
    if (!w.player.dead) for (const pt of w.pets) list.push({ y: pt.y, f: () => drawPet(renderer, pt, sprites, w.time) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();
    drawShots(ctx, w.fxs, w.time);
    drawKitAir(renderer, w.raceSkill, w.player, w.time);
    for (const s of w.shots) drawShot(ctx, s, w.time);
    w.sk.drawAir(ctx, w.time);
    w.fx.drawWorld(ctx);
    w.particles.draw(ctx);
    drawGusts(ctx, w.fxs, A, w.time);
    w.fx.drawNumbers(ctx);
    // darkness: only the light around heroes (and lanterns) cuts through
    const dark = w.flags.dark ? 0.86 : w.darkT > 0 ? Math.min(0.8, w.darkT) : 0;
    if (dark > 0) drawDarkness(dark);
    renderer.screenSpace();
    if (app.vignette) ctx.drawImage(app.vignette, 0, 0, v.w, v.h);
    drawPartyList();
    drawUltScreen(ctx, w, v, heroCutIn);
    if (w.phase === 'waiting') {
      ctx.font = '700 20px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f3e6c8';
      ctx.fillText('รอเพื่อนร่วมทีมเข้าโซน…', v.w / 2, v.h * 0.35);
    }
  }

  function heroCutIn(c, x, y, sc) {
    const p = w.player;
    drawHero(renderer, sprites.heroParts, sprites.weapon, { x, y, flip: false, time: w.time, walkT: 0, moving: false, type: p.wtype, scale: sc, wp: { arm: -1.1, blade: -2.5, reach: 8, lean: -0.12, glow: 1, twoHand: !!p.wtype.twoHanded, dual: !!p.wtype.dual, backArm: -0.6, backBlade: -2.2, bow: p.wtype.id === 'bow', draw: 0.6 } });
  }

  let darkCanvas = null;
  function drawDarkness(alpha) {
    const v = renderer.view;
    if (!darkCanvas) darkCanvas = document.createElement('canvas');
    if (darkCanvas.width !== Math.round(v.w / 2) || darkCanvas.height !== Math.round(v.h / 2)) { darkCanvas.width = Math.max(1, Math.round(v.w / 2)); darkCanvas.height = Math.max(1, Math.round(v.h / 2)); }
    const g = darkCanvas.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, darkCanvas.width, darkCanvas.height);
    g.fillStyle = `rgba(6,4,10,${alpha})`; g.fillRect(0, 0, darkCanvas.width, darkCanvas.height);
    g.globalCompositeOperation = 'destination-out';
    const cam = renderer.cam;
    const toScreen = (x, y) => ({ x: ((x - cam.x) * cam.zoom + v.w / 2) / 2, y: ((y - cam.y) * cam.zoom + v.h / 2) / 2 });
    const light = (x, y, r) => {
      const s = toScreen(x, y), rr = (r * cam.zoom) / 2;
      const grad = g.createRadialGradient(s.x, s.y, rr * 0.3, s.x, s.y, rr);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(s.x, s.y, rr, 0, Math.PI * 2); g.fill();
    };
    light(w.player.x, w.player.y - 30, 300);
    for (const a of w.allies.values()) if (a.x != null) light(a.x, a.y - 30, 220);
    for (const s of w.fxs.strikes) if (s.mult > 0) light(s.x, s.y, Math.max(80, s.r || 0) + 40);
    for (const s of w.fxs.shots) light(s.x, s.y, 70);
    if (w.rphase === 'clear') light(PORTAL.x, PORTAL.y - 40, 200);
    renderer.screenSpace();
    ctx.drawImage(darkCanvas, 0, 0, v.w, v.h);
    renderer.worldSpace();
  }

  function drawPartyList() {
    if (w.party < 2) return;
    const v = renderer.view;
    const x0 = app.touch && v.w < v.h ? 12 : 14, y0 = app.touch && v.w < v.h ? 128 : 84;
    let y = y0;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const a of w.allies.values()) {
      ctx.fillStyle = 'rgba(15,11,9,0.7)'; ctx.fillRect(x0, y - 11, 150, 22);
      ctx.font = '700 12px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillStyle = a.ko ? '#ffb3a4' : a.goneT > GONE_AFTER ? '#7d6d58' : '#9fe0a0';
      ctx.fillText(a.name || '…', x0 + 6, y);
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(x0 + 84, y - 4, 60, 8);
      ctx.fillStyle = a.ko ? '#5a3a30' : '#7fc77a'; ctx.fillRect(x0 + 84, y - 4, 60 * Math.max(0, (a.hp || 0) / (a.maxHp || 1)), 8);
      y += 26;
    }
    ctx.textBaseline = 'alphabetic';
  }

  return {
    enter(params) {
      app.particles.clear();
      app.refreshHeroSprites();
      w = makeWorld(params);
      for (const id of [...(w.zone.monsters || []), w.zone.boss].filter(Boolean)) app.ensureRig(id);     // jointed fighters drawn ahead
      w.unsub.push(params.room.on('match', onMessage));
      input.setEnabled(true); input.reset();
      app.hud.show(w); app.hud.setMode('coop');
      zoneMusic();
      params.room.presence({ ...fighterPresence(w.player, w.look, 'ready'), en: null, rs: null });
      if (w.amHost && w.party === 1) { w.phase = 'run'; startRoom(0); nextWave(); }
    },
    exit() {
      if (w) { for (const u of w.unsub) u(); w.room.leave?.(); }
      input.setEnabled(false); app.hud.hide(); app.hud.setMode('dungeon'); app.hud.setBoss(null); audio.stopMusic();
      w = null;
    },
    update, render,
    get world() { return w; },
    retreat() { if (w && !w.ended) finish('retreat'); },
    // tests on a dev host only (wired in main.js): put the bosses at a share of their health
    devWound(f) { if (!w || !w.amHost) return false; for (const e of w.enemies) if (e.type.boss && !e.dead) e.hp = Math.max(1, Math.round(e.maxHp * f)); return true; },
    snapshot() {
      if (!w) return null;
      const enemies = w.amHost ? w.enemies : [...w.views.values()];
      return {
        zone: w.zone.id, host: w.amHost, party: w.party, phase: w.phase, room: w.ri, rphase: w.rphase, ended: w.ended,
        me: { x: Math.round(w.player.x), y: Math.round(w.player.y), hp: Math.ceil(w.player.hp), maxHp: w.player.maxHp, dead: w.player.dead },
        enemies: enemies.filter((e) => !e.dead).map((e) => ({ id: e.id, affixes: e.affixes || [], type: e.type.id, x: Math.round(e.x), y: Math.round(e.y), hp: Math.ceil(e.hp), maxHp: e.maxHp, untargetable: !!e.untargetable, boss: !!e.type.boss, state: e.state, phase: e.ai?.phase || 0 })),
        allies: [...w.allies.values()].map((a) => ({ name: a.name, x: Math.round(a.x || 0), y: Math.round(a.y || 0), ko: !!a.ko, seen: a.seen })),
        strikes: w.fxs.strikes.length, pools: w.fxs.pools.length, shots: w.fxs.shots.length, portal: { x: PORTAL.x, y: PORTAL.y }, kills: w.run.kills,
        inf: w.inf ? { wave: w.inf.wave, coins: w.inf.coins, arts: w.inf.arts.length, land: w.zone.theme } : null,
        tower: w.tower ? { floor: w.tower.floor, asc: w.tower.asc, cleared: w.tower.cleared, affixes: w.zone.plan.affixes, god: w.zone.plan.god, rphase: w.rphase } : null,
        bosses: enemies.filter((e) => e.type.boss && !e.dead).map((e) => ({ id: e.type.id, invuln: e.invuln > 0, untargetable: !!e.untargetable, shell: e.shell || 0, phase: e.ai?.phase || 0, hp: Math.ceil(e.hp), maxHp: e.maxHp, clone: !!e.clone })),
      };
    },
  };
}
