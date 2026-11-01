// Dungeon scene: explore connected rooms, fight in locked rooms, dodge traps, open chests, read documents,
// find the seal key and defeat the boss. Game rules come from src/systems/*; this file handles flow and drawing.
import { tickAnim, noteSwing, noteCast, spriteMotion, hexA } from '../battle/rigDraw.js';
import { drawCritterAt, critterHeight } from '../battle/critterDraw.js';
import { bossElement, bossBars } from '../data/bestiary.js';
import { drawElementFx } from '../battle/elementFx.js';
import { STAGE_TRACK, bossIntensity } from '../data/music.js';
import { BALANCE } from '../config/balance.js';
import { uniqueAfterHit, uniqueDamageMult, uniqueOnKill, tickUnique, drawBrands, drawUniqueAura, trySunder, sunderMult, roomShield } from '../battle/uniques.js';
import { getStage } from '../data/stages.js';
import { getItem } from '../data/items.js';
import { rarityOf } from '../data/rarity.js';
import { ROOM, TRAP_DAMAGE, CHEST_LOOT, getDungeon } from '../data/dungeons.js';
import { LORE } from '../data/story.js';
import { cloneState } from '../core/state.js';
import { computeDamage, comboBonus } from '../systems/combat.js';
import { rollDrops, rollGold } from '../systems/loot.js';
import { addItem, removeItem, countItem, canAdd, addInPlace } from '../systems/inventory.js';
import { luckMult } from '../systems/luck.js';
import { getEnemy } from '../data/enemies.js';
import { computeStats } from '../systems/stats.js';
import { grantXpInPlace, completeStageInPlace } from '../systems/progression.js';
import { slottedSkills } from '../systems/skills.js';
import { dungeonScene as storyMoment } from '../systems/story.js';
import { doorsOf, roomById, startRoom, doorRect, entryPoint, OPPOSITE } from '../systems/dungeon.js';
import { buildSnapshot, getRun, setRunInPlace, clearRunInPlace } from '../systems/dungeonRun.js';
import { createPlayer, updatePlayer, damagePlayer, applyStats, inPerfectWindow } from '../battle/player.js';
import { bossHitScale } from '../battle/bossScale.js';
import { createEnemy, updateEnemy, separate } from '../battle/enemies.js';
import { createDrop, updateDrop, drawDrop } from '../battle/drops.js';
import { spawnPoints } from '../battle/waves.js';
import { createFx, drawTelegraph } from '../battle/fx.js';
import { createProjectile, updateProjectiles, cutProjectiles, drawProjectile } from '../battle/projectiles.js';
import { createTraps, updateTraps, drawTrapsFloor, drawTrapsTop } from '../battle/traps.js';
import { createSkillBar, tickSkills, castSkill, updateSnares, drawSnares } from '../battle/skills.js';
import { createSkillRuntime } from '../battle/skillCast.js';
import { passiveStrikeMult, comboScale } from '../battle/skillHooks.js';
import { installUlt, updateUlt, drawUltScreen } from '../battle/ultimate.js';
import { equippedUlt } from '../systems/ultimate.js';
import { bossTricks, delayedSwing, trickLevelFor } from '../battle/tricks.js';
import { createEffects, updateEffects, addStrike, addPool, addShot, addGust, drawPools, drawStrikes, drawShots, drawGusts } from '../battle/strikes.js';
import { tickAffixes } from '../battle/affixes.js';
import '../battle/zoneBehaviours.js';
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
import { paintRoom, decorateRoom, THEMES } from './backdrop.js';

const INTERACT_RANGE = 86;
const CB = BALANCE.combat;

export function createDungeonScene(app) {
  const { renderer, input, store, audio, sprites, rng } = app;
  const ctx = renderer.ctx;
  let world = null;
  const sortBuf = [];

  // ---------------------------------------------------------------- run setup
  function makeWorld(stageId, resume = null) {
    const stage = getStage(stageId);
    const dungeon = getDungeon(stageId);
    const stats = computeStats(store.get());
    const w = {
      stage, dungeon, theme: THEMES[stage.theme], themeKey: stage.theme, rng,
      arena: { w: ROOM.w, h: ROOM.h }, wallPad: ROOM.wall,
      rooms: new Map(dungeon.rooms.map((r) => [r.id, { def: r, visited: false, cleared: !(r.waves && r.waves.length), wave: -1, queue: [], chestOpened: false, bonfireUsed: false, canvas: null, decor: null }])),
      room: null, player: createPlayer(stats, 0, 0),
      enemies: [], drops: [], hazards: [], projectiles: [], traps: [], snares: [],
      fx: createFx(), particles: app.particles,
      skills: createSkillBar(slottedSkills(store.get())),
      raceSkill: createRaceSkill(store.get().race?.id, stats.skillCdMult),
      pets: [],
      shots: [], zones: [], cones: [], sk: createSkillRuntime(),
      combo: { n: 0, t: 0, best: 0 }, style: createStyle(), slowT: 0, perfects: 0, lastStandUsed: false, breaks: 0, parries: 0, counters: 0,
      keys: 0, unsealed: false, time: 0, stopT: 0, phase: 'explore', phaseT: 0, vacuum: false,
      paused: false, ended: false, fade: 0, fadeDir: 0, pendingRoom: null, interactTarget: null,
      run: { gold: 0, sparks: 0, xp: 0, kills: 0, items: new Map(), levelUps: 0, start: performance.now(), rooms: 0, chests: 0, lore: 0, bestCombo: 0, perfects: 0 },
      lastFullWarn: -10, embers: [],
      fxs: createEffects(), darkT: 0, trickLevel: trickLevelFor(null, stageId === 's1' ? 's1' : 's2'),
    };
    w.pets = createPetTeam(activePets(store.get()), 0, 0, w.player);
    w.pet = w.pets[0] || null;
    for (let i = 0; i < 22; i++) w.embers.push({ x: rng.next() * ROOM.w, y: rng.next() * ROOM.h, p: rng.next() * 6, s: 0.5 + rng.next() });

    // ---- world API used by entities, traps and skills
    w.sfx = (n, o) => audio.play(n, o);
    w.shake = (m, t) => renderer.shake(m, t);
    w.hitStop = (t) => { w.stopT = Math.max(w.stopT, t); };
    w.screenToWorld = (sx, sy) => renderer.screenToWorld(sx, sy);
    w.announce = (text, sub = '') => app.hud.banner(text, sub);
    w.addHazard = (h) => { w.hazards.push({ ...h, t: 0 }); };
    w.addSnare = (z) => { w.snares.push(z); };
    w.fireProjectile = (owner, x, y, angle, speed, r, mult) => { w.projectiles.push(createProjectile(owner, x, y, angle, speed, r, mult)); };
    w.fireTrapDart = (x, y, angle, speed) => { const pr = createProjectile({ atk: 0 }, x, y, angle, speed, 8, 1); pr.trap = 'dart'; w.projectiles.push(pr); };
    w.cutProjectiles = (cx, cy, dir, range, arc) => cutProjectiles(w.projectiles, cx, cy, dir, range, arc, w);
    // the void jelly pet swallows enemy shots near the hero
    w.eatShots = (x, y, r, max) => {
      let n = 0;
      for (const pr of w.projectiles) { if (n >= max || pr.dead || Math.hypot(pr.x - x, pr.y - y) > r + pr.r) continue; pr.dead = true; n++; w.particles.burst(pr.x, pr.y, 8, { color: ['#9fffd8', '#6a4aa8'], speedMin: 40, speedMax: 140, life: 0.3, size: 2.5, drag: 4, glow: true }); }
      return n;
    };
    w.clampBody = (b) => clampToRoom(w, b);
    w.toast = (...a) => app.toast(...a);
    w.firePlayerShot = (o) => { w.shots.push(createShot(o)); };
    w.addZone = (z) => { w.zones.push({ ...z, t: 0, done: false }); audio.play('cast', { power: 1.6 }); };
    w.addCone = (c) => { w.cones.push(c); };
    // v8: the online zones' telegraphed strikes, pools, shots and gusts also work in dungeon rooms
    // (so zone monsters, the new bosses and the boss tricks can fight here too)
    w.strike = (s) => {
      if (s.owner && s.mult > 0 && !(s.owner.warn > 0)) noteCast(s.owner);
      addStrike(w.fxs, { ...s, owner: { atk: Math.round(s.owner?.atk ?? 10), crit: 0, critMult: 1.5 } });
      if (s.tone === 'pierce') audio.play('pierceWarn');
    };
    w.pool = (pl) => addPool(w.fxs, { ...pl, owner: { atk: Math.round(pl.owner?.atk ?? 10), crit: 0, critMult: 1 } });
    w.shoot = (e, o) => addShot(w.fxs, { ...o, owner: { atk: Math.round(e?.atk ?? 10), crit: 0, critMult: 1.5 }, target: o.homing ? 'me' : null });
    w.gust = (angle, dur, force) => addGust(w.fxs, { angle, dur, force });
    w.darkPulse = (t) => { w.darkT = Math.max(w.darkT, t); };
    w.enemiesOf = (typeId) => w.enemies.filter((x) => x.type.id === typeId);
    w.silence = (t) => { w.player.silenceT = Math.max(w.player.silenceT || 0, t); audio.play('silenced'); };
    w.chill = (t, freeze = false) => { const p = w.player; p.chillT = Math.max(p.chillT || 0, t); if (freeze) { p.stunT = Math.max(p.stunT || 0, Math.min(1.2, t)); audio.play('frozen'); } };
    w.selfDestruct = (e) => { e.hp = 0; e.noReward = true; w.damageEnemy(e, { amount: 1, crit: false }, 0, 0, { src: 'burn' }); };
    Object.defineProperty(w, 'players', { get: () => (w.player.dead ? [] : [w.player]) });

    // Every hit the hero (or their skills) lands goes through here: combo, buffs, marks, crits, poise, ignite.
    w.playerStrike = (e, power, o = {}) => {
      if (e.dead || e.spawning > 0) return null;
      const p = w.player, st = p.stats, b = p.buffs;
      const counts = o.src !== 'burn' && o.src !== 'pet';
      let mult = power * passiveStrikeMult(p, e) * (1 + comboBonus(w.combo.n) * comboScale(p) + styleBonus(w.style) + (b.blessT > 0 ? b.bless : 0) + (b.ashT > 0 && w.raceSkill ? w.raceSkill.v.dmg : 0) + buffOf(p, 'dmg') + (st.titleDmg || 0));
      if (o.src === 'skill' || o.src === 'race') mult *= st.skillPower || 1;
      if (e.markT > 0) mult *= 1 + (e.mark || 0);
      if (e.brokenT > 0) mult *= 1 + CB.poise.breakBonus;
      mult *= uniqueDamageMult(p, w, e);
      const empowered = p.empowerT > 0 && (o.src === 'melee' || o.src === 'proj' || o.src === undefined);
      if (empowered) { mult *= 1 + CB.perfect.empowerPower; p.empowerT = 0; }
      const crit = st.crit + (o.critBonus || 0) + (b.focusT > 0 && w.raceSkill ? w.raceSkill.v.crit || 0 : 0) + buffOf(p, 'crit');
      const dmg = computeDamage({ atk: st.atk, crit, critMult: st.critMult, forceCrit: o.forceCrit || empowered }, e, rng, mult);
      w.damageEnemy(e, dmg, o.kx || 0, o.ky || 0, { power: o.src === 'skill' || o.src === 'race' ? Math.max(power, 1.2) : power, src: o.src });
      if (counts) { w.rankUp(styleEvent(w.style, hitKind(p, o))); w.ultEvent?.(e.type.boss ? 'boss' : 'mob'); }
      if (o.counter && !e.dead && !e.type.boss) e.hitstun = Math.max(e.hitstun || 0, 0.8);
      uniqueAfterHit(w, p, e, o);
      if (trySunder(p, e, rng, o)) w.fx.callout(e.x, e.y - (e.r || 24) * 2 - 20, 'ทำลายเกราะ', '#9fffd8');
      if (e.dead) { if (counts) { bumpCombo(); const hl = uniqueOnKill(p, w); if (hl) w.fx.number(p.x, p.y - 96, `+${hl}`, 'heal'); } return dmg; }
      if (o.stun && !e.type.boss) e.hitstun = Math.max(e.hitstun, o.stun);
      if (o.src !== 'burn' && poiseHit(e, power)) onPoiseBreak(e);
      if (counts) bumpCombo();
      if (o.src !== 'burn' && (o.burn || b.ashT > 0 || buffOf(p, 'burn') > 0 || (st.ignite > 0 && rng.next() < st.ignite))) applyBurn(e);
      if (o.mark) applyMark(e, o.mark, o.markT || 3);
      if (o.slow) { e.slowT = Math.max(e.slowT || 0, o.slowT || 1.5); e.slowMult = e.type.boss ? Math.min(1, o.slow + 0.3) : o.slow; }
      const ls = buffOf(p, 'lifesteal') + (st.lifesteal || 0);
      if (ls > 0 && counts && !p.dead) { p.lsAcc = (p.lsAcc || 0) + dmg.amount * ls; if (p.lsAcc >= 1) { const hl = Math.floor(p.lsAcc); p.lsAcc -= hl; p.hp = Math.min(p.maxHp, p.hp + hl); } }
      return dmg;
    };
    // Pet hits scale with the hero's attack but never crit and don't build combo.
    w.petStrike = (e, power, o = {}) => {
      if (e.dead || e.spawning > 0) return null;
      const dmg = computeDamage({ atk: w.player.stats.atk, crit: 0 }, e, rng, power);
      w.damageEnemy(e, dmg, o.kx || 0, o.ky || 0, { power, src: 'pet' });
      if (!e.dead && o.mark) applyMark(e, o.mark, o.markT || 3);
      if (!e.dead && o.burn) applyBurn(e);
      if (!e.dead && o.stun && !e.type.boss) e.hitstun = Math.max(e.hitstun || 0, o.stun);
      if (!e.dead && o.slow) { e.slowT = Math.max(e.slowT || 0, o.slowT || 1.5); e.slowMult = e.type.boss ? Math.min(1, o.slow + 0.3) : o.slow; }
      if (!e.dead) poiseHit(e, power * 0.5) && onPoiseBreak(e);
      return dmg;
    };
    function bumpCombo() {
      w.combo.n += 1; w.combo.t = 0;
      if (w.combo.n > w.combo.best) w.combo.best = w.combo.n;
      if (w.combo.n > w.run.bestCombo) w.run.bestCombo = w.combo.n;
      for (const t of CB.combo.tiers) if (w.combo.n === t.at) { audio.play('wave'); w.fx.callout(w.player.x, w.player.y - 120, `คอมโบ ${t.at}! ดาเมจ +${Math.round(t.bonus * 100)}%`, '#ffd08a'); }
    }
    function onPoiseBreak(e) {
      w.breaks += 1;
      e.state = 'rest'; e.t = 0; e.warn = 0; if (e.ai) e.ai.z = 0;
      for (let i = w.hazards.length - 1; i >= 0; i--) if (w.hazards[i].owner === e) w.hazards.splice(i, 1);
      w.fx.callout(e.x, e.y - e.r * 2 - 40, 'เสียหลัก!', '#f5d48a');
      w.fx.ring(e.x, e.y - e.r, 10, e.r * 2.4, '#f5d48a', 0.6, 8);
      audio.play('crit'); renderer.shake(8, 0.3); w.hitStop(0.12);
      app.hud.setPoise?.(0, true);
    }
    // Perfect dodge: an enemy attack meets the first moments of a dodge.
    w.perfectDodge = () => {
      const p = w.player;
      if (p.perfectUsed || p.dead) return;
      p.perfectUsed = true;
      w.rankUp(styleEvent(w.style, 'perfect'));
      w.slowT = CB.perfect.slowmo; p.empowerT = CB.perfect.empowerT;
      p.dodges = Math.min(p.dodgeMax, p.dodges + 1);
      w.perfects += 1; w.run.perfects += 1;
      w.ultEvent?.('perfect');
      const refund = p.stats.perfectRefund || 0;
      if (refund > 0) { for (const sk of w.skills) if (sk) sk.cd = Math.max(0, sk.cd - refund); if (w.raceSkill) w.raceSkill.cd = Math.max(0, w.raceSkill.cd - refund); }
      w.fx.callout(p.x, p.y - 120, 'หลบสมบูรณ์!', '#bfe3ff');
      w.fx.ring(p.x, p.y - 30, 20, 120, '#bfe3ff', 0.5, 6);
      audio.play('perfect');
      app.hud.flash?.('perfect');
    };

    // a parried monster loses its attack and its footing; a boss loses a big chunk of poise
    installDefenseHooks(w, { audio, renderer, app, stagger: (e) => {
      if (!e || e.dead) return;
      if (e.type.boss) { if (poiseHit(e, 5)) onPoiseBreak(e); }
      else { e.hitstun = Math.max(e.hitstun || 0, 1.1); e.state = 'rest'; e.t = 0; e.warn = 0; }
      for (let i = w.hazards.length - 1; i >= 0; i--) if (w.hazards[i].owner === e && w.hazards[i].melee) w.hazards.splice(i, 1);
    } });
    installUlt(w, { app, audio, id: equippedUlt(store.get()), pvp: false, freezes: true, onUse: () => { const n = cloneState(store.get()); n.stats.ults = (n.stats.ults || 0) + 1; store.commit(n, { reason: 'ult', persist: false }); } });

    w.spawnEnemy = (id, x, y) => {
      const e = createEnemy(id, x, y, w.room?.def.scale || 1);
      if (e.type.boss) { e.maxHp = e.hp = Math.round(e.maxHp * bossBars(id)); }     // v8.6: เลือดหลายหลอด
      w.enemies.push(e);
      app.ensureRig?.(e.type.id);
      w.fx.ring(x, y - 10, 10, 60, '#e0b45a', 0.5, 4);
      w.particles.burst(x, y - 10, 10, { color: ['#e0b45a', '#f3e6c8'], speedMin: 40, speedMax: 140, life: 0.5, size: 3, drag: 3, glow: true });
      audio.play('spawn');
      if (e.type.boss) { app.hud.setBoss(e.type.name, 1, bossBars(id)); audio.play('roar'); renderer.shake(8, 0.5); audio.music('boss'); audio.setIntensity(1); }
      return e;
    };

    w.damageEnemy = (e, dmg, kx, ky, opt = {}) => {
      if (e.dead) return;
      e.hp = Math.max(0, e.hp - dmg.amount);
      e.flash = opt.src === 'burn' ? 0.4 : 1;
      e.vx += kx / e.type.mass; e.vy += ky / e.type.mass;
      // Heavy hits (finishers, charged and dodge attacks, skills) interrupt an attack wind-up.
      // Light hits only make the enemy flinch briefly, at most every half second — so enemies keep attacking mid-combo.
      if (!e.type.boss && opt.src !== 'burn') {
        if ((opt.power ?? 1) >= (e.type.interruptAt ?? 1.2)) { e.hitstun = Math.max(e.hitstun, 0.2); if (e.state === 'windup') { e.state = 'recover'; e.t = 0; e.warn = 0; } }
        else if (!(e.flinchCd > 0)) { e.hitstun = Math.max(e.hitstun, 0.07); e.flinchCd = 0.5; }
      }
      w.fx.number(e.x, e.y - e.type.radius * 2 - 10, dmg.amount, dmg.crit ? 'crit' : opt.src === 'burn' ? 'burn' : opt.src === 'pet' ? 'pet' : 'hit');
      if (opt.src !== 'burn') w.particles.burst(e.x, e.y - e.r, dmg.crit ? 14 : 7, { color: dmg.crit ? ['#ffcf5a', '#fff3c4', '#ff8a3d'] : ['#fff8ea', '#f3e6c8'], speedMin: 90, speedMax: 300, life: 0.3, size: dmg.crit ? 3.5 : 2.5, drag: 5, glow: true });
      if (opt.src !== 'burn') audio.play(dmg.crit ? 'crit' : 'hit');
      if (dmg.crit) renderer.shake(5, 0.15);
      if (e.type.boss) { app.hud.setBoss(e.type.name, e.hp / e.maxHp, bossBars(e.type.id)); audio.setIntensity(bossIntensity(e.hp / e.maxHp)); }
      if (e.hp <= 0) killEnemy(e);
    };

    w.trapHitEnemy = (e) => {
      const amount = Math.max(1, Math.round(e.maxHp * (e.type.boss ? 0.03 : 0.12)));
      w.damageEnemy(e, { amount, crit: false }, 0, -80);
    };

    w.hitPlayer = (e, mult, kx, ky, fire = false) => {
      const p = w.player;
      if (e && e.type) noteSwing(e);
      if (p.dead || w.phase === 'victory') return false;
      if (p.iframes > 0) { if (inPerfectWindow(p)) w.perfectDodge(); return false; }
      const st = p.stats;
      const def = st.def * (st.lowHpDef && p.hp < p.maxHp * 0.3 ? 1 + st.lowHpDef : 1);
      let amount = computeDamage(e, { def }, rng, mult * sunderMult(e)).amount;
      amount = bossHitScale(amount, e, st, p.maxHp, w.stage?.recommendedLevel);   // v9.2: a boss hits harder the stronger the hero is (its health is untouched)
      if (fire && st.fireReduce) amount = Math.max(1, Math.round(amount * (1 - st.fireReduce)));
      return hurtPlayer(amount, kx, ky, { attacker: e });
    };

    // Traps deal a share of max HP so they stay fair at every level.
    w.trapHit = (kind, kx, ky) => {
      const p = w.player;
      if (p.dead || p.iframes > 0 || w.phase === 'victory') return false;
      const fire = kind === 'vent' ? 1 - (p.stats.fireReduce || 0) : 1;
      const amount = Math.max(1, Math.round(p.maxHp * TRAP_DAMAGE[kind] * (1 - (p.stats.trapReduce || 0)) * fire));
      return hurtPlayer(amount, kx, ky, { unblockable: kind !== 'dart' });
    };

    w.usePotion = () => usePotion(w);
    w.collect = (d) => collect(w, d);
    w.onPlayerSwing = (def, kind) => {
      const t = w.player.wtype.id;
      if (t === 'bow') audio.play('bow', { power: kind === 'charged' ? 1.6 : 1 });
      else if (t === 'staff') audio.play('cast', { power: kind === 'charged' ? 1.6 : def.power });
      else audio.play('swing', { power: Math.min(1.8, 0.7 + def.power * 0.45) });
    };
    w.onPlayerDash = (blink) => audio.play(blink ? 'blink' : 'dash');
    w.onChargeReady = () => { audio.play('charge'); w.fx.ring(w.player.x, w.player.y - 30, 40, 14, '#fff3c4', 0.25, 4); };
    w.onLastStand = () => { app.hud.banner('ผู้ไม่มอด', 'สายเลือดเถ้าพาให้รอดจากความตาย'); audio.play('roar'); w.fx.ring(w.player.x, w.player.y - 30, 10, 140, '#ffd08a', 0.7, 8); };
    w.onPlayerDeath = () => { w.phase = 'defeat'; w.phaseT = 0; audio.play('defeat'); renderer.shake(10, 0.5); saveRun('defeat'); };   // v8.3: a dead hero has no run to resume
    if (resume) applyResume(w, resume);
    return w;
  }

  // v8.3 Resume a dungeon: put the rooms, key, HP and run counters back as the snapshot kept them
  // (gold, XP, items and kills are already in the normal save, so nothing is paid out twice).
  function applyResume(w, snap) {
    for (const [id, r] of Object.entries(snap.rooms)) {
      const rt = w.rooms.get(id);
      if (!rt) continue;
      rt.visited = !!r.vis;
      if (r.clr) rt.cleared = true;
      rt.wave = r.wave ?? -1;
      rt.chestOpened = !!r.chest;
      rt.bonfireUsed = !!r.fire;
    }
    w.keys = snap.keys; w.unsealed = snap.unsealed;
    w.player.hp = Math.max(1, Math.round(w.player.maxHp * snap.hp));
    const r = snap.run;
    Object.assign(w.run, {
      gold: r.gold, sparks: r.sparks, xp: r.xp, kills: r.kills, levelUps: r.levelUps, rooms: r.rooms, chests: r.chests, lore: r.lore,
      bestCombo: r.bestCombo, perfects: r.perfects, bossKills: r.bossKills, items: new Map(Object.entries(r.items)),
      start: performance.now() - r.secs * 1000,         // play time carries over; time spent away does not count
    });
    w.parries = r.parries;
  }

  // a telegraphed strike / pool / shot from the zone effects reaches the hero
  function fxHurt(owner, mult, kx, ky, fire, tick, opts) {
    const w = world, p = w.player;
    if (p.dead || w.phase === 'victory') return false;
    if (p.iframes > 0 && !tick) { if (inPerfectWindow(p)) w.perfectDodge(); return false; }
    const st = p.stats;
    const def = opts.pierce ? 0 : st.def;
    let amount = computeDamage(owner, { def }, rng, mult).amount;
    amount = bossHitScale(amount, owner, st, p.maxHp, w.stage?.recommendedLevel);
    if (opts.pct > 0) amount = Math.max(amount, Math.round(p.maxHp * Math.min(0.95, opts.pct)));
    if (fire && st.fireReduce) amount = Math.max(1, Math.round(amount * (1 - st.fireReduce)));
    if (tick) { p.hp = Math.max(0, p.hp - amount); w.fx.number(p.x, p.y - 70, amount, 'player'); if (p.hp <= 0) { p.dead = true; p.deathT = 0; p.move = null; w.onPlayerDeath(); } return true; }
    if (opts.pierce) { w.fx.callout(p.x, p.y - 140, 'เจาะเกราะ!', '#ff3a6a'); audio.play('pierced'); }
    const ok = hurtPlayer(amount, kx, ky, { unblockable: true, ...opts });
    if (ok && opts.silence) w.silence(opts.silence);
    if (ok && opts.chill) w.chill(opts.chill);
    return ok;
  }

  function hurtPlayer(amount, kx, ky, opts = {}) {
    const w = world, p = w.player;
    if (!damagePlayer(p, amount, kx, ky, w, opts)) return false;
    if (!p.guard.blockFx || p.guard.blockFx < 0.2) styleHurt(w.style);
    if (w.combo.n >= 5) w.fx.callout(p.x, p.y - 120, 'คอมโบขาด', '#ff9a8a');
    w.combo.n = 0;
    audio.play('hurt');
    renderer.shake(7, 0.22);
    app.hud.hurt();
    w.particles.burst(p.x, p.y - 30, 10, { color: ['#c2412f', '#ff6b57'], speedMin: 80, speedMax: 220, life: 0.4, size: 3, drag: 4 });
    return true;
  }

  function usePotion(w) {
    const p = w.player;
    if (p.potionCd.left > 0) { app.toast(`ยาพร้อมใช้ในอีก ${p.potionCd.left.toFixed(1)} วินาที`, 'warn', 'potion-cd'); audio.play('error'); return; }
    const st = store.get();
    if (countItem(st, 'p_tonic') <= 0) { app.toast('ไม่มียาฟื้นพลังในกระเป๋า', 'warn', 'potion-none'); audio.play('error'); return; }
    if (p.hp >= p.maxHp) { app.toast('พลังชีวิตเต็มอยู่แล้ว', 'info', 'potion-full'); return; }
    const r = removeItem(st, 'p_tonic', 1);
    if (!r.ok) return;
    store.commit(r.state, { reason: 'potion', persist: false });
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * BALANCE.combat.potion.healPct));
    p.potionCd.left = BALANCE.combat.potion.cooldown;
    w.fx.number(p.x, p.y - 80, `+${p.hp - before}`, 'heal');
    w.particles.burst(p.x, p.y - 30, 18, { color: ['#8fe27a', '#d6f59a'], speedMin: 30, speedMax: 120, life: 0.8, size: 3, drag: 2, grav: -120, glow: true });
    audio.play('potion');
  }

  function collect(w, d) {
    const st = store.get();
    if (d.kind === 'spark') {
      const next = cloneState(st);
      next.sparks = (next.sparks || 0) + d.qty;
      store.commit(next, { reason: 'sparks', persist: false });
      w.run.sparks += d.qty;
      audio.play('pickup', { rarity: 3 });
      w.fx.number(w.player.x - 18, w.player.y - 96, `ประกาย +${d.qty}`, 'info');
      return true;
    }
    if (d.kind === 'gold') {
      const next = cloneState(st);
      next.gold += d.qty;
      store.commit(next, { reason: 'gold', persist: false });
      w.run.gold += d.qty;
      audio.play('gold');
      w.fx.number(w.player.x + 18, w.player.y - 90, `+${d.qty}`, 'info');
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
    if (rar.order >= 2) w.fx.ring(w.player.x, w.player.y - 30, 10, 70, rar.color, 0.6, 5);
    return true;
  }

  function dropLoot(x, y, goldRange, drops, sparks = 0) {
    const w = world;
    const gold = Math.round(rollGold(goldRange, rng) * (w.player.stats.goldMult || 1));
    if (sparks > 0) w.drops.push(createDrop('spark', 'spark', sparks, x, y, rng));
    const coins = Math.min(4, Math.max(1, Math.round(gold / 8)));
    let left = gold;
    for (let i = 0; i < coins; i++) {
      const q = i === coins - 1 ? left : Math.max(1, Math.floor(gold / coins));
      left -= q;
      if (q > 0) w.drops.push(createDrop('gold', 'gold', q, x, y, rng));
    }
    for (const d of rollDrops(drops, rng, luckMult(store.get()))) w.drops.push(createDrop('item', d.id, d.qty, x, y, rng));   // v8.2: Luck Potion
  }

  function killEnemy(e) {
    const w = world;
    if (e.rewarded) return;           // reward exactly once per enemy
    e.rewarded = true; e.dead = true; e.deathT = 0;
    audio.play('enemyDie');
    w.particles.burst(e.x, e.y - e.r, e.type.boss ? 60 : 16, { color: e.type.particles || ['#8a3b2e', '#5d6b3a', '#b5603f'], speedMin: 80, speedMax: e.type.boss ? 420 : 240, life: 0.7, size: e.type.boss ? 6 : 4, drag: 3, shape: 1 });
    if (e.type.boss) { renderer.shake(14, 0.6); w.hitStop(0.18); app.hud.setBoss(null); audio.setIntensity(1); audio.music(STAGE_TRACK[w.themeKey] || 's1'); }
    const p = w.player;
    if (p.stats.healOnKill > 0 && !p.dead) {
      const heal = Math.round(p.maxHp * p.stats.healOnKill);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      w.fx.number(p.x, p.y - 96, `+${heal}`, 'heal');
    }
    const next = cloneState(store.get());
    next.stats.kills += 1;
    const levels = grantXpInPlace(next, e.type.xp);
    store.commit(next, { reason: 'kill', persist: false });
    w.run.xp += e.type.xp; w.run.kills += 1;
    if (levels > 0) {
      w.run.levelUps += levels;
      applyStats(p, computeStats(next));
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
      audio.play('levelup');
      app.hud.banner(`เลเวล ${next.player.level}`, 'ได้แต้มสกิล 1 แต้ม · แต้มสเตตัส 3 แต้ม · ฟื้นพลังชีวิต 25%');
      w.fx.ring(p.x, p.y - 30, 10, 110, '#e0b45a', 0.8, 6);
      w.particles.burst(p.x, p.y - 40, 30, { color: ['#e0b45a', '#fff3c4'], speedMin: 60, speedMax: 240, life: 0.9, size: 3, drag: 2, grav: -60, glow: true });
    }
    dropLoot(e.x, e.y - 10, e.type.gold, e.type.drops, e.type.sparks || 0);
  }

  // ---------------------------------------------------------------- rooms
  function roomObjects(rt) {
    const d = rt.def, W = ROOM.w, H = ROOM.h, out = [];
    if (d.chest) out.push({ kind: 'chest', x: d.chest.x * W, y: d.chest.y * H, def: d.chest });
    if (d.lore) out.push({ kind: 'lore', x: d.lore.x * W, y: d.lore.y * H, id: d.lore.id });
    if (d.bonfire) out.push({ kind: 'bonfire', x: d.bonfire.x * W, y: d.bonfire.y * H });
    return out;
  }

  function enterRoom(roomId, viaDir, resume = null) {
    const w = world;
    const rt = w.rooms.get(roomId);
    w.room = rt;
    w.sk?.clear();
    if (w.fxs) { w.fxs.strikes.length = 0; w.fxs.pools.length = 0; w.fxs.shots.length = 0; w.fxs.gusts.length = 0; }
    w.enemies.length = 0; w.hazards.length = 0; w.projectiles.length = 0; w.snares.length = 0; w.drops.length = 0;
    w.shots.length = 0; w.zones.length = 0; w.cones.length = 0; w.slowT = 0;
    w.fx.clear(); w.particles.clear();
    roomShield(w.player);
    w.doors = doorsOf(w.dungeon, rt.def);
    if (!rt.canvas) {
      const seed = rt.def.at[0] * 31 + rt.def.at[1] * 17 + w.stage.id.charCodeAt(1);
      rt.canvas = paintRoom(w.themeKey, w.doors, seed);
      rt.decor = decorateRoom(w.themeKey, rt.def, seed);
    }
    w.solids = rt.decor.filter((s) => s.solidR > 0).map((s) => ({ x: s.x, y: s.y - 6, r: s.solidR }));
    w.objects = roomObjects(rt);
    for (const o of w.objects) if (o.kind !== 'lore') w.solids.push({ x: o.x, y: o.y - 6, r: o.kind === 'chest' ? 34 : 40 });
    w.traps = createTraps(rt.def);
    const inside = (v, max) => Math.max(ROOM.wall + 70, Math.min(max - ROOM.wall - 70, v));
    const at = resume ? { x: inside(resume.x, ROOM.w), y: inside(resume.y, ROOM.h) }       // v8.3: back where the hero stood
      : viaDir ? entryPoint(OPPOSITE[viaDir]) : { x: ROOM.w / 2, y: ROOM.h - ROOM.wall - 90 };
    w.player.x = at.x; w.player.y = at.y; w.player.vx = w.player.vy = 0;
    w.player.trail.length = 0; w.player.ghosts.length = 0;
    for (const pt of w.pets) { pt.x = at.x - 40 - pt.slot * 30; pt.y = at.y + 12 - pt.slot * 10; pt.vx = pt.vy = 0; pt.dash = null; pt.fx.length = 0; }
    const first = !rt.visited;
    rt.visited = true;
    if (first) w.run.rooms += 1;
    renderer.cam.x = w.player.x; renderer.cam.y = ROOM.h / 2;
    app.hud.roomTitle(rt.def.name, roomSubtitle(rt));
    app.hud.minimap(w);
    if (!rt.cleared) {
      w.phase = 'locked'; w.phaseT = 0;
      if (resume?.foes?.length) queueFoes(rt, resume.foes);        // v8.3: only the enemies that were still alive
      if (rt.def.type === 'boss' && !resume) {
        const sc = storyMoment(store.get(), w.stage.id, 'boss_pre');
        if (sc) { w.paused = true; app.playScene(sc, () => { w.paused = false; input.reset(); }); }
      }
    } else {
      w.phase = 'explore';
    }
    saveRun(resume ? 'resume' : 'room');        // v8.3: every room entered is a checkpoint of the run
  }

  // v8.3: enemies left over from a saved fight come back with the HP they had, spread out like a normal wave
  function queueFoes(rt, foes) {
    const w = world;
    const boss = rt.def.type === 'boss';
    const pts = boss ? foes.map(() => ({ x: ROOM.w / 2, y: ROOM.h * 0.38 })) : spawnPoints(foes.length, { w: ROOM.w, h: ROOM.h }, w.player, rng)
      .map((p) => ({ x: Math.max(ROOM.wall + 80, Math.min(ROOM.w - ROOM.wall - 80, p.x)), y: Math.max(ROOM.wall + 80, Math.min(ROOM.h - ROOM.wall - 60, p.y)) }));
    foes.forEach((f, i) => {
      rt.queue.push({ enemy: f.id, x: pts[i].x, y: pts[i].y, delay: boss ? 0.6 : 0.4 + i * 0.22, hp: f.hp });
      w.fx.ring(pts[i].x, pts[i].y, 40, 8, '#e0b45a', 0.9, 3);
    });
  }

  function restoreFoeHp(e, frac) {
    e.hp = Math.max(1, Math.round(e.maxHp * frac));
    if (e.type.boss) { app.hud.setBoss(e.type.name, e.hp / e.maxHp, bossBars(e.type.id)); audio.setIntensity(bossIntensity(e.hp / e.maxHp)); }
  }

  // v8.3: writes the resumable snapshot of this run into the save (persisted). A finished run (boss down / hero dead)
  // has nothing to resume, so its snapshot is removed instead.
  function saveRun(reason) {
    const w = world;
    if (!w || w.ended) return null;
    const next = cloneState(store.get());
    if (w.phase === 'victory' || w.phase === 'defeat') clearRunInPlace(next, w.stage.id);
    else setRunInPlace(next, w.stage.id, buildSnapshot(w));
    return store.commit(next, { reason });
  }

  function roomSubtitle(rt) {
    if (rt.def.type === 'boss') return 'บอส';
    if (!rt.cleared) return 'ประตูปิด — กำจัดศัตรูให้หมด';
    if (rt.def.traps?.length) return 'ระวังกับดัก';
    if (rt.def.type === 'rest') return 'จุดพัก';
    return '';
  }

  function startRoomWave(rt) {
    const w = world;
    rt.wave += 1;
    const wave = rt.def.waves[rt.wave];
    if (!wave) return false;
    const total = wave.reduce((a, s) => a + s.count, 0);
    const boss = rt.def.type === 'boss';
    const pts = boss ? [{ x: ROOM.w / 2, y: ROOM.h * 0.38 }] : spawnPoints(total, { w: ROOM.w, h: ROOM.h }, w.player, rng)
      .map((p) => ({ x: Math.max(ROOM.wall + 80, Math.min(ROOM.w - ROOM.wall - 80, p.x)), y: Math.max(ROOM.wall + 80, Math.min(ROOM.h - ROOM.wall - 60, p.y)) }));
    let i = 0;
    for (const s of wave) for (let n = 0; n < s.count; n++) {
      const p = pts[i++];
      rt.queue.push({ enemy: s.enemy, x: p.x, y: p.y, delay: boss ? 0.6 : 0.2 + n * 0.22 });
      w.fx.ring(p.x, p.y, 40, 8, '#e0b45a', 0.9, 3);
    }
    if (rt.def.waves.length > 1) app.hud.roomTitle(rt.def.name, `ระลอก ${rt.wave + 1}/${rt.def.waves.length}`);
    return true;
  }

  function roomCleared(rt) {
    const w = world;
    rt.cleared = true;
    w.phase = 'explore'; w.phaseT = 0;
    w.vacuum = true;
    w.projectiles.length = 0;
    audio.play('wave');
    saveRun('checkpoint');                  // v8.3: room cleared, saved again once the loot is picked up (see update)
    w.snapDirty = true;
    app.hud.roomTitle(rt.def.name, 'ห้องปลอดภัย · ประตูเปิดแล้ว');
    app.hud.minimap(w);
  }

  // Keeps bodies inside the room walls, except through an open door gap.
  function clampToRoom(w, b) {
    const { w: W, h: H, wall, door } = ROOM;
    const r = b.r * 0.8;
    const isPlayer = b === w.player;
    const open = (dir) => isPlayer && w.doors?.some((d) => d.dir === dir) && doorState(w, dir) === 'open';
    const inX = Math.abs(b.x - W / 2) < door / 2 - r * 0.5, inY = Math.abs(b.y - H / 2) < door / 2 - r * 0.2;
    const minX = (inY && open('W')) ? -40 : wall + r, maxX = (inY && open('E')) ? W + 40 : W - wall - r;
    const minY = (inX && open('N')) ? -40 : wall + r + 6, maxY = (inX && open('S')) ? H + 40 : H - wall - 4;
    b.x = Math.max(minX, Math.min(maxX, b.x));
    b.y = Math.max(minY, Math.min(maxY, b.y));
  }

  function doorState(w, dir) {
    const d = w.doors.find((x) => x.dir === dir);
    if (!d) return 'none';
    if (!w.room.cleared) return 'locked';
    const target = w.rooms.get(d.to);
    if (target.def.type === 'boss' && !w.unsealed) return 'sealed';
    return 'open';
  }

  function checkDoors(w) {
    const p = w.player, { w: W, h: H } = ROOM;
    let dir = null;
    if (p.y < 4) dir = 'N'; else if (p.y > H - 2) dir = 'S'; else if (p.x < 4) dir = 'W'; else if (p.x > W - 4) dir = 'E';
    if (!dir) return;
    const d = w.doors.find((x) => x.dir === dir);
    if (!d || doorState(w, dir) !== 'open') return;
    // pick up whatever is still lying around before leaving
    for (const drop of w.drops) collect(w, drop);
    w.drops.length = 0;
    w.pendingRoom = { id: d.to, dir };
    w.fadeDir = 1;
    audio.play('click');
  }

  // ---------------------------------------------------------------- interactables
  function findInteract(w) {
    const p = w.player;
    let best = null, bd = INTERACT_RANGE;
    for (const o of w.objects) {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bd) { bd = d; best = o; }
    }
    // the sealed boss door
    for (const d of w.doors) {
      if (doorState(w, d.dir) !== 'sealed') continue;
      const r = doorRect(d.dir);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (Math.hypot(cx - p.x, cy - p.y) < INTERACT_RANGE + 50) best = { kind: 'seal', x: cx, y: cy, dir: d.dir };
    }
    return best;
  }

  function interactLabel(w, o) {
    if (!o) return null;
    const rt = w.room;
    if (o.kind === 'chest') return rt.chestOpened ? null : (rt.cleared ? 'เปิดหีบ' : 'กำจัดศัตรูก่อนเปิดหีบ');
    if (o.kind === 'lore') return store.get().story.lore[o.id] ? `อ่านอีกครั้ง: ${LORE[o.id].title}` : `อ่าน: ${LORE[o.id].title}`;
    if (o.kind === 'bonfire') return rt.bonfireUsed ? 'กองไฟมอดแล้ว' : 'พักที่กองไฟ (ฟื้นพลัง + บันทึก)';
    if (o.kind === 'seal') return w.keys > 0 ? 'ใช้กุญแจผนึก' : 'ประตูถูกผนึก — ต้องหากุญแจ';
    return null;
  }

  function doInteract(w, o) {
    const rt = w.room;
    if (o.kind === 'chest') {
      if (rt.chestOpened) return;
      if (!rt.cleared) { app.toast('ต้องกำจัดศัตรูในห้องก่อน', 'warn', 'chest-locked'); audio.play('error'); return; }
      rt.chestOpened = true; w.run.chests += 1;
      const loot = CHEST_LOOT[o.def.loot];
      audio.play('chest'); audio.play('pickup', { rarity: o.def.key ? 2 : 1 });
      w.particles.burst(o.x, o.y - 30, 26, { color: ['#ffd889', '#fff3c4', '#e0b45a'], speedMin: 60, speedMax: 220, life: 0.8, size: 3, drag: 2, grav: -60, glow: true });
      const tier = o.def.loot.split('_')[1];
      dropLoot(o.x, o.y - 20, loot.gold, loot.drops, BALANCE.sparks.chest[tier] || 0);
      w.vacuum = true; w.snapDirty = true;
      if (o.def.key) {
        w.keys += 1;
        app.toast('ได้กุญแจผนึก — ใช้เปิดประตูห้องบอส', 'ok', null, { glyph: 'key', duration: 3500 });
        audio.play('success');
        app.hud.minimap(w);
      }
    } else if (o.kind === 'lore') {
      w.paused = true; input.reset();
      const isNew = !store.get().story.lore[o.id];
      if (isNew) w.run.lore += 1;
      app.openLore(o.id, () => { w.paused = false; input.reset(); app.hud.minimap(w); });
    } else if (o.kind === 'bonfire') {
      if (rt.bonfireUsed) { app.toast('กองไฟนี้ใช้ไปแล้วในรอบนี้', 'info', 'bonfire'); return; }
      rt.bonfireUsed = true;
      const p = w.player, heal = Math.round(p.maxHp * 0.6);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      w.fx.number(p.x, p.y - 80, `+${heal}`, 'heal');
      w.particles.burst(o.x, o.y - 20, 30, { color: ['#ffd889', '#ff8a3d'], speedMin: 40, speedMax: 160, life: 1, size: 3, drag: 2, grav: -100, glow: true });
      audio.play('potion');
      saveRun('bonfire');
      app.toast('พักที่กองไฟ ฟื้นพลังชีวิต 60% และบันทึกแล้ว', 'ok');
    } else if (o.kind === 'seal') {
      if (w.keys <= 0) { app.toast('ประตูถูกผนึก ต้องหากุญแจผนึกในดันเจี้ยนก่อน', 'warn', 'sealed'); audio.play('error'); return; }
      w.keys -= 1; w.unsealed = true; w.snapDirty = true;
      audio.play('success'); renderer.shake(8, 0.4);
      w.fx.ring(o.x, o.y, 10, 140, '#f5d48a', 0.7, 8);
      w.particles.burst(o.x, o.y, 40, { color: ['#f5d48a', '#e0b45a', '#fff3c4'], speedMin: 80, speedMax: 300, life: 0.8, size: 4, drag: 2, glow: true });
      app.toast('ผนึกสลายแล้ว ห้องบอสเปิด', 'ok');
      app.hud.minimap(w);
    }
  }

  // ---------------------------------------------------------------- flow
  function finish(outcome) {
    const w = world;
    if (w.ended) return;
    w.ended = true;
    input.setEnabled(false);
    const next = cloneState(store.get());
    next.stats.runs += 1;
    next.stats.perfects = (next.stats.perfects || 0) + (w.run.perfects || 0);
    next.stats.parries = (next.stats.parries || 0) + (w.parries || 0);
    next.stats.bossKills = (next.stats.bossKills || 0) + (w.run.bossKills || 0);
    let completion = null;
    if (outcome === 'victory') completion = completeStageInPlace(next, w.stage.id);
    // v8.2 Luck Potion: while it is active the dungeon's end pays one more roll of the boss's drop table, with luck
    let luckLoot = [];
    const lm = outcome === 'victory' ? luckMult(store.get()) : 1;
    if (lm > 1) {
      const bossRoom = w.dungeon.rooms.find((r) => r.type === 'boss');
      const bossDef = getEnemy(bossRoom?.waves?.[0]?.[0]?.enemy);
      for (const d of bossDef?.drops ? rollDrops(bossDef.drops, rng, lm) : []) {
        if (!canAdd(next, d.id, d.qty) || !addInPlace(next, d.id, d.qty).ok) continue;
        luckLoot.push(d);
        w.run.items.set(d.id, (w.run.items.get(d.id) || 0) + d.qty);
      }
    }
    clearRunInPlace(next, w.stage.id);          // v8.3: the run is over (won, lost or abandoned): nothing left to resume
    const save = store.commit(next, { reason: 'stage-end' });
    app.onBattleEnd({
      outcome, stage: w.stage, completion, saveOk: save.ok,
      run: { gold: w.run.gold + (completion?.bonusGold || 0), bonusGold: completion?.bonusGold || 0, sparks: w.run.sparks + (completion?.bonusSparks || 0), bestCombo: w.run.bestCombo, perfects: w.run.perfects, xp: w.run.xp, kills: w.run.kills, levelUps: w.run.levelUps,
             rooms: w.run.rooms, totalRooms: w.dungeon.rooms.length, chests: w.run.chests, lore: w.run.lore, luckLoot: luckLoot.length ? luckLoot : null,
             items: [...w.run.items.entries()].map(([id, qty]) => ({ id, qty })), seconds: Math.round((performance.now() - w.run.start) / 1000) },
    });
  }

  function update(dt) {
    const w = world;
    if (!w || w.ended) return;
    const intent = input.poll();
    if (intent.pause && !w.paused && w.phase !== 'victory' && w.phase !== 'defeat') { app.pauseBattle(); return; }
    if (w.paused) { app.hud.update(w.player, w); return; }

    // room transition fade
    if (w.fadeDir !== 0) {
      w.fade += w.fadeDir * dt / 0.2;
      if (w.fadeDir > 0 && w.fade >= 1) { w.fade = 1; enterRoom(w.pendingRoom.id, w.pendingRoom.dir); w.pendingRoom = null; w.fadeDir = -1; }
      else if (w.fadeDir < 0 && w.fade <= 0) { w.fade = 0; w.fadeDir = 0; }
      app.hud.update(w.player, w);
      if (w.fadeDir > 0) return;
    }

    if (w.stopT > 0) { w.stopT -= dt; renderer.update(dt); return; }
    // perfect-dodge slow motion: the world slows down, the hero does not
    if (w.slowT > 0) w.slowT -= dt;
    const edt = w.slowT > 0 ? dt * CB.perfect.timeScale : dt;
    w.time += edt; w.phaseT += dt;
    w.fx.update(dt); w.particles.update(edt); renderer.update(dt);
    tickSkills(w.skills, dt);
    tickRaceSkill(w.raceSkill, dt, w);

    const p = w.player;
    if (w.phase !== 'defeat') {
      // v8: the ultimate takes over the hero while it plays
      if (intent.ult) w.tryUlt();
      if (w.ult?.run) Object.assign(intent, { skill: -1, race: false, attack: false, attackHeld: false, dash: false, mx: 0, my: 0, potion: false, guard: false, interact: false });
      // zone-style effects: stunned (frozen solid), silenced (no skills), chilled or caught in webs/sand (slower)
      if (p.silenceT > 0) p.silenceT -= dt;
      if (p.chillT > 0) p.chillT -= dt;
      if (p.stunT > 0) { p.stunT -= dt; Object.assign(intent, { attack: false, attackHeld: false, dash: false, race: false, skill: -1, mx: 0, my: 0 }); }
      if (p.silenceT > 0) { intent.skill = -1; intent.race = false; }
      if (intent.skill >= 0) castSkill(w.skills, intent.skill, w);
      if (intent.race) castRaceSkill(w);
      const prevX = p.x, prevY = p.y;
      updatePlayer(p, intent, dt, w);
      const slow = Math.min(w.statusMods?.slow ?? 1, p.chillT > 0 ? 0.55 : 1);
      if (slow < 1 && !(p.dashT > 0)) { p.x = prevX + (p.x - prevX) * slow; p.y = prevY + (p.y - prevY) * slow; }
      w.sk.update(dt, w);
      tickUnique(p, dt);
      clampToRoom(w, p);
      // sustain: bloodline regeneration and the bloom heal-over-time
      if (!p.dead) {
        let regen = p.stats.regen || 0;
        if (p.buffs.bloomT > 0 && w.raceSkill) regen += w.raceSkill.v.heal / w.raceSkill.v.duration;
        if (regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regen * dt);
      }
    } else p.deathT += dt;
    w.combo.t += dt;
    if (w.combo.n > 0 && w.combo.t > CB.combo.resetAfter) w.combo.n = 0;
    styleTick(w.style, dt);

    const rt = w.room;
    for (let i = rt.queue.length - 1; i >= 0; i--) { const q = rt.queue[i]; q.delay -= edt; if (q.delay <= 0) { const e = w.spawnEnemy(q.enemy, q.x, q.y); if (q.hp > 0 && q.hp < 1) restoreFoeHp(e, q.hp); rt.queue.splice(i, 1); } }
    const frozen = updateUlt(w, dt);
    if (!frozen) for (const e of w.enemies) {
      if (e.affixes) tickAffixes(e, edt, w);
      e.paused = !e.dead && (bossTricks(e, edt, w, w.trickLevel) || delayedSwing(e, edt, w, w.trickLevel));
      updateEnemy(e, edt, w); tickStatus(e, edt, w);
    }
    separate(w.enemies);
    resolveSolids(w);
    for (let i = w.enemies.length - 1; i >= 0; i--) if (w.enemies[i].dead && w.enemies[i].deathT > 0.6) w.enemies.splice(i, 1);
    for (let i = w.hazards.length - 1; i >= 0; i--) { const h = w.hazards[i]; h.t += edt; if (h.t >= h.dur || (h.owner && h.owner.dead)) w.hazards.splice(i, 1); }
    for (let i = w.drops.length - 1; i >= 0; i--) if (!updateDrop(w.drops[i], dt, w)) w.drops.splice(i, 1);
    if (w.vacuum && w.drops.length === 0) w.vacuum = false;
    if (w.snapDirty && w.phase === 'explore' && w.drops.length === 0 && w.fadeDir === 0) { w.snapDirty = false; saveRun('run-checkpoint'); }   // v8.3: loot is in the bag → save the room's new state
    if (!frozen) w.statusMods = updateEffects(w.fxs, edt, {
      me: w.player, arena: w.arena, particles: w.particles, sfx: (n) => audio.play(n), shake: (m, t) => renderer.shake(m, t),
      hurt: (owner, mult, kx, ky, fire, tick, x) => fxHurt(owner, mult, kx, ky, fire, tick, x || {}),
      posOf: () => null,
    });
    if (w.darkT > 0) w.darkT -= dt;
    updateProjectilesWithTraps(w, frozen ? 0 : edt);
    updateTraps(w.traps, frozen ? 0 : edt, w);
    updateSnares(w.snares, edt, w);
    updateShots(w.shots, dt, w);
    updateZones(w.zones, dt, w);
    updateCones(w.cones, dt, w);
    if (w.phase !== 'defeat') for (const pt of w.pets) updatePet(pt, dt, w);
    const boss = w.enemies.find((e) => e.type.boss && !e.dead);
    if (boss) app.hud.setPoise?.(boss.poise ?? CB.poise.max, boss.brokenT > 0);

    // room combat flow
    if (w.phase === 'locked') {
      const alive = rt.queue.length > 0 || w.enemies.some((e) => !e.dead);
      if (!alive && w.phaseT > 0.7) {
        if (!startRoomWave(rt)) {
          if (rt.def.type === 'boss') { w.phase = 'victory'; w.phaseT = 0; rt.cleared = true; w.vacuum = true; audio.play('victory'); app.hud.banner('ชนะ!', 'เก็บของที่ดรอปทั้งหมด'); saveRun('boss-down'); }
          else roomCleared(rt);
        } else w.phaseT = 0;
      }
    } else if (w.phase === 'explore') {
      checkDoors(w);
      const o = findInteract(w);
      w.interactTarget = o;
      app.hud.setInteract(interactLabel(w, o));
      if (intent.interact && o) doInteract(w, o);
    } else if (w.phase === 'victory') {
      const pending = w.drops.filter((d) => d.blockedUntil <= w.time).length;
      if (!w.postShown && ((w.phaseT > 1.2 && pending === 0) || w.phaseT > 4)) {
        w.postShown = true;
        const sc = storyMoment(store.get(), w.stage.id, 'boss_post');
        if (sc) { w.paused = true; app.playScene(sc, () => finish('victory')); } else finish('victory');
      }
    } else if (w.phase === 'defeat') {
      if (w.phaseT > 1.8) finish('defeat');
    }
    if (w.phase !== 'explore') { w.interactTarget = null; app.hud.setInteract(null); }

    // camera: fit the walkable floor into the band between the top HUD and the bottom controls,
    // so the HUD covers walls or empty space, never the fight. Wide rooms on narrow screens follow the hero.
    const cam = renderer.cam, v = renderer.view;
    // phones in landscape keep their controls at the sides, so the room can use (almost) the full height
    const landscape = app.touch && v.w > v.h;
    const top = landscape ? 50 : app.touch ? 130 : 60, bottom = landscape ? 8 : app.touch ? 240 : 76;
    const byH = (v.h - top - bottom) / (ROOM.h - ROOM.wall * 2 + 60);
    const byW = v.w / (ROOM.w + 40);
    cam.zoom = Math.max(0.5, Math.min(1.25, v.w < v.h ? byH : Math.min(byW, byH)));
    const hw = v.w / 2 / cam.zoom, hh = (v.h - top - bottom) / 2 / cam.zoom;
    const shiftY = (top - bottom) / 2 / cam.zoom; // centre of the free band, in world units
    const tx = ROOM.w <= hw * 2 ? ROOM.w / 2 : Math.max(hw, Math.min(ROOM.w - hw, p.x));
    const ty = (ROOM.h - ROOM.wall * 2 <= hh * 2 ? ROOM.h / 2 : Math.max(hh + ROOM.wall / 2, Math.min(ROOM.h - hh - ROOM.wall / 2, p.y - 30))) - shiftY;
    const k = Math.min(1, dt * 7);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;

    app.hud.update(p, w);
  }

  function updateProjectilesWithTraps(w, dt) {
    // trap darts use the share-of-max-HP rule; enemy shots use the normal damage formula
    const realHit = w.hitPlayer;
    w.hitPlayer = (owner, mult, kx, ky, fire) => (owner && owner.atk === 0 ? w.trapHit('dart', kx, ky) : realHit(owner, mult, kx, ky, fire));
    updateProjectiles(w.projectiles, dt, w);
    w.hitPlayer = realHit;
  }

  function resolveSolids(w) {
    const bodies = [w.player, ...w.enemies.filter((e) => !e.dead)];
    for (const s of w.solids) for (const b of bodies) {
      const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy), min = s.r + b.r * 0.7;
      if (d > 0 && d < min) { b.x = s.x + (dx / d) * min; b.y = s.y + (dy / d) * min; }
    }
  }

  // ---------------------------------------------------------------- drawing
  function drawShadow(x, y, rx) {
    ctx.fillStyle = 'rgba(12,8,6,0.38)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlayer(p) {
    const w = world;
    drawShadow(p.x, p.y, 22);
    // charge ring at the feet
    if (p.charging && p.charge > 0) {
      const k = Math.min(1, p.charge / p.wtype.chargeTime);
      ctx.save();
      ctx.strokeStyle = p.chargeReady ? `rgba(255,243,196,${(0.75 + 0.25 * Math.sin(w.time * 20)).toFixed(3)})` : 'rgba(224,180,90,0.85)';
      ctx.lineWidth = p.chargeReady ? 5 : 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 36, 13, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      ctx.restore();
    }
    if (p.empowerT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(191,227,255,${(0.4 + 0.3 * Math.sin(w.time * 14)).toFixed(3)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, 30, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (p.buffs.stoneT > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(184,164,138,0.8)'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 40, 40, 52, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (p.shield > 0) {
      const a = 0.25 + 0.15 * Math.sin(w.time * 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y - 40, 10, p.x, p.y - 40, 62);
      g.addColorStop(0, 'rgba(255,216,137,0)'); g.addColorStop(0.75, `rgba(255,170,90,${a})`); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 40, 62, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const blink = p.iframes > 0 && !p.dead && p.dashT <= 0 && !p.lunge && !p.rush && Math.floor(w.time * 20) % 2 === 0;
    const wp = playerPose(p, w.time);
    const base = { flip: p.flip, time: w.time, walkT: p.walkT, moving: p.moving, wp, type: p.wtype, scale: 0.95, vx: p.vx, speed: p.stats.speed };
    // afterimages from dodges and rushes
    for (const g of p.ghosts) {
      const k = g.t / g.max;
      drawHero(renderer, sprites.heroParts, sprites.weapon, { ...base, x: g.x, y: g.y, flip: g.flip, walkT: g.walkT, dashing: true, flash: 0.85, alpha: 0.28 * k });
    }
    const hidden = p.blink && p.dashT > 0;   // staff blink: the hero vanishes into sparks
    const at = drawHero(renderer, sprites.heroParts, sprites.weapon, {
      ...base, x: p.x, y: p.y - (p.leapZ || 0), dashing: p.dashT > 0 || !!p.lunge || !!p.rush, flash: p.flash > 0 ? p.flash : (p.empowerT > 0 ? 0.12 : 0),
      alpha: hidden ? 0.12 : blink ? 0.45 : 1, deathT: p.dead ? p.deathT : null,
    });
    drawTrail(p, at, w.time);
    drawGuard(ctx, p, w.time);
    drawUniqueAura(ctx, p, w.time);
  }

  // Weapon trail: a ribbon between the hand and the blade tip over the last few frames of a swing.
  function drawTrail(p, at, time) {
    const swinging = (p.move && (p.move.phase === 'active' || (p.move.phase === 'recover' && p.move.t < 0.06) || (p.move.phase === 'windup' && p.move.def.anim === 'spin'))) || p.rush || p.spinT > 0 || p.lunge;
    if (swinging && at.len > 20 && !p.wtype.ranged) p.trail.push({ hx: at.hand.x, hy: at.hand.y, tx: at.tip.x, ty: at.tip.y, t: time });
    while (p.trail.length && (time - p.trail[0].t > 0.11 || p.trail.length > 14)) p.trail.shift();
    if (!swinging && p.trail.length && time - p.trail[p.trail.length - 1].t > 0.05) p.trail.length = 0;
    const n = p.trail.length;
    if (n < 2) return;
    const col = p.wtype.trail;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < n; i++) {
      const a = p.trail[i - 1], b = p.trail[i];
      const k = i / n;
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = i > n - 3 ? col.color : col.glow;
      ctx.beginPath();
      // inner edge sits part-way up the blade so the ribbon hugs the cutting edge
      const ia = { x: a.hx + (a.tx - a.hx) * 0.35, y: a.hy + (a.ty - a.hy) * 0.35 }, ib = { x: b.hx + (b.tx - b.hx) * 0.35, y: b.hy + (b.ty - b.hy) * 0.35 };
      ctx.moveTo(ia.x, ia.y); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(ib.x, ib.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const s = sprites[e.type.sprite];
    const z = e.ai.z || 0;
    const spawnK = e.spawning > 0 ? 1 - e.spawning / 0.7 : 1;
    drawShadow(e.x, e.y, e.r * (1 - z / 120) * spawnK);
    const alpha = e.dead ? Math.max(0, 1 - e.deathT / 0.5) : spawnK;
    const deathSquash = e.dead ? 1 + e.deathT * 0.8 : 1;
    const flip = e.type.faces ? e.flip : false;
    const scale = e.type.boss ? 1.0 : 0.72;
    const anim = tickAnim(e, world.time);
    const CR = !e.type.boss ? app.critters?.[e.type.id] : null;       // v8: small monsters move part by part
    const crK = CR ? CR.def.scale * (e.type.scale || 1) : 0;
    const m = spriteMotion(e, anim, world.time, flip ? -1 : 1);       // breathing, wind-up, lunge, recoil
    const el = e.type.boss && !e.dead ? bossElement(e.type.id) : null, tall = CR ? critterHeight(CR) * crK : s.h * scale;
    if (el) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(e.x, e.y - z - tall * 0.5, 4, e.x, e.y - z - tall * 0.5, tall * 0.8);
      g.addColorStop(0, hexA(el.c1, 0.2 + 0.15 * (e.anim?.wind || 0))); g.addColorStop(1, hexA(el.c1, 0));
      ctx.fillStyle = g; ctx.fillRect(e.x - tall, e.y - z - tall * 1.3, tall * 2, tall * 1.6); ctx.restore();
    }
    const flashK = e.flash > 0 ? e.flash : (e.warn ? 0.18 + 0.25 * Math.abs(Math.sin(world.time * 22)) : 0);
    if (CR) drawCritterAt(renderer, CR, e, anim, { z, scale: crK * spawnK, alpha, flash: flashK, target: world.player, time: world.time });
    else renderer.sprite(s, e.x + m.dx, e.y - z + m.dy, { flip, rot: m.rot, sx: e.sx * scale * spawnK * deathSquash * m.sx, sy: e.sy * scale * spawnK / deathSquash * m.sy, flash: flashK, alpha });
    if (el) drawElementFx(ctx, el, { x: e.x - tall * 0.75, y: e.y - z - tall * 1.1, w: tall * 1.5, h: tall * 1.15 }, world.time, 0.55);
    drawStatus(ctx, e, world.time, tall + z);
    if (e.slowT > 0 && !e.dead) {
      ctx.strokeStyle = 'rgba(111,154,74,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.1, e.r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.warn > 0 && !e.dead) {
      const hy = e.y - tall - 12 - z;
      ctx.fillStyle = '#e0503a'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 3;
      ctx.font = '900 22px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('!', e.x, hy); ctx.fillText('!', e.x, hy);
    }
    if (!e.type.boss && !e.dead && e.hp < e.maxHp) {
      const bw = e.r * 1.8, by = e.y - tall - 4 - z;
      ctx.fillStyle = 'rgba(20,12,9,0.8)'; ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#c2412f'; ctx.fillRect(e.x - bw / 2, by, bw * (e.hp / e.maxHp), 4);
    }
    drawBrands(ctx, e, world.time);
  }

  function drawObject(o) {
    const w = world, rt = w.room;
    if (o.kind === 'chest') {
      const rich = !!(o.def.key || o.def.loot.endsWith('rare'));
      const s = sprites[rt.chestOpened ? (rich ? 'chest_rich_open' : 'chest_open') : (rich ? 'chest_rich' : 'chest')];
      if (!rt.chestOpened && rt.cleared) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(o.x, o.y - 30, 4, o.x, o.y - 30, 70);
        g.addColorStop(0, `rgba(255,216,137,${0.25 + 0.12 * Math.sin(w.time * 3)})`); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y - 30, 70, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      drawShadow(o.x, o.y - 2, 40);
      renderer.sprite(s, o.x, o.y, {});
    } else if (o.kind === 'lore') {
      const key = o.id === 'l_altar' ? 'altar' : o.id === 'l_notice' ? 'signpost' : o.id === 'l_daoletter' ? 'pedestal' : o.id === 'l_warden' ? 'signpost' : 'desk';
      drawShadow(o.x, o.y, key === 'altar' ? 56 : 34);
      renderer.sprite(sprites[key], o.x, o.y, {});
      if (!store.get().story.lore[o.id]) {
        const y = o.y - sprites[key].h - 14 + Math.sin(w.time * 3) * 4;
        ctx.fillStyle = '#f5d48a'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(o.x, y + 10); ctx.lineTo(o.x - 8, y); ctx.lineTo(o.x + 8, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (o.kind === 'bonfire') {
      renderer.sprite(sprites.bonfire, o.x, o.y, {});
      {
        const used = rt.bonfireUsed, k = used ? 0.45 : 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(o.x, o.y - 20, 4, o.x, o.y - 20, 150 * k);
        g.addColorStop(0, `rgba(255,170,80,${0.35 * k})`); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y - 20, 150 * k, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        for (const [col, f] of [['#c2412f', 1], ['#ff8a3d', 0.72], ['#ffd889', 0.42]]) {
          const hgt = 56 * f * k * (0.9 + 0.12 * Math.sin(w.time * 11 * f));
          ctx.fillStyle = col; ctx.beginPath();
          ctx.moveTo(o.x - 20 * f, o.y - 8); ctx.quadraticCurveTo(o.x - 24 * f, o.y - 8 - hgt * 0.5, o.x + Math.sin(w.time * 7) * 5 * f, o.y - 8 - hgt);
          ctx.quadraticCurveTo(o.x + 24 * f, o.y - 8 - hgt * 0.5, o.x + 20 * f, o.y - 8); ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  function drawDoors(w) {
    for (const d of w.doors) {
      const st = doorState(w, d.dir), r = doorRect(d.dir);
      if (st === 'open') {
        // soft pull of light toward the exit
        ctx.fillStyle = 'rgba(255,216,137,0.07)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        continue;
      }
      if (st === 'sealed') {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        renderer.sprite(sprites.boss_seal, cx, cy, { sx: 0.8, sy: 0.8 });
        if (w.keys > 0) { ctx.strokeStyle = `rgba(245,212,138,${0.5 + 0.4 * Math.sin(w.time * 5)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.stroke(); }
        continue;
      }
      // locked: bars of thorn (forest) or iron (mine)
      const vertical = d.dir === 'N' || d.dir === 'S';
      ctx.save();
      ctx.strokeStyle = w.themeKey === 'cinder' ? '#7a716b' : '#4b6e33';
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      const n = 6;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        if (vertical) { const x = r.x + (i + 0.5) * (r.w / n); ctx.moveTo(x, r.y + 4); ctx.lineTo(x + Math.sin(i) * 4, r.y + r.h - 4); }
        else { const y = r.y + (i + 0.5) * (r.h / n); ctx.moveTo(r.x + 4, y); ctx.lineTo(r.x + r.w - 4, y + Math.sin(i) * 4); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(224,80,58,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.restore();
    }
  }

  function render() {
    const w = world;
    if (!w || !w.room) return;
    const v = renderer.view;
    renderer.screenSpace();
    ctx.fillStyle = w.themeKey === 'cinder' ? '#120d0b' : '#0f140d'; ctx.fillRect(0, 0, v.w, v.h);
    renderer.worldSpace();
    ctx.drawImage(w.room.canvas, 0, 0);
    drawTrapsFloor(ctx, w.traps, w.time);
    for (const s of w.room.decor) if (!s.tall) renderer.sprite(sprites[s.key], s.x, s.y, { sx: s.s, sy: s.s, flip: s.flip });
    drawDoors(w);
    for (const h of w.hazards) drawTelegraph(ctx, h, w.time);
    drawPools(ctx, w.fxs, w.time);
    drawStrikes(ctx, w.fxs, w.time);
    drawSnares(ctx, w.snares, w.time);
    w.sk.drawGround(ctx, w.time);
    drawZones(ctx, w.zones, w.time);
    drawPetGround(renderer, w.pets, w.time);
    drawKitGround(renderer, w.raceSkill, w.time);

    sortBuf.length = 0;
    for (const s of w.room.decor) if (s.tall) sortBuf.push(s);
    for (const o of w.objects) sortBuf.push(o);
    for (const e of w.enemies) sortBuf.push(e);
    for (const d of w.drops) sortBuf.push(d);
    sortBuf.push(w.player);
    for (const pt of w.pets) sortBuf.push(pt);
    sortBuf.sort((a, b) => a.y - b.y);
    for (const o of sortBuf) {
      if (o === w.player) drawPlayer(o);
      else if (o.pet && o.slot != null && w.pets.includes(o)) drawPet(renderer, o, sprites, w.time);
      else if (o.type) drawEnemy(o);
      else if (o.kind === 'gold' || o.kind === 'item') drawDrop(ctx, o, sprites, w.time);
      else if (o.kind) drawObject(o);
      else renderer.sprite(sprites[o.key], o.x, o.y, { sx: o.s, sy: o.s, flip: o.flip });
    }
    drawTrapsTop(ctx, w.traps, w.time, sprites);
    drawShots(ctx, w.fxs, w.time);
    w.sk.drawAir(ctx, w.time);
    for (const pr of w.projectiles) drawProjectile(ctx, pr, w.time);
    drawKitAir(renderer, w.raceSkill, w.player, w.time);
    for (const sh of w.shots) drawShot(ctx, sh, w.time);
    w.fx.drawWorld(ctx);
    w.particles.draw(ctx);
    // floating motes (fireflies in the forest, embers in the mine)
    ctx.globalCompositeOperation = 'lighter';
    const col = w.themeKey === 'cinder' ? '255,150,80' : '255,216,137';
    for (const f of w.embers) {
      const a = 0.3 + 0.3 * Math.sin(w.time * 2 * f.s + f.p);
      ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(f.x + Math.sin(w.time * 0.5 + f.p) * 20, f.y + (w.themeKey === 'cinder' ? -((w.time * 20 * f.s) % 200) : Math.cos(w.time * 0.4 + f.p) * 14), 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // world-anchored interaction hint
    if (w.interactTarget && w.phase === 'explore') {
      const o = w.interactTarget;
      const y = o.y - (o.kind === 'seal' ? 70 : 110) + Math.sin(w.time * 4) * 3;
      ctx.fillStyle = 'rgba(245,212,138,0.95)'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(o.x, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a100c'; ctx.font = '800 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(app.touch ? '!' : 'E', o.x, y + 1);
    }
    w.fx.drawNumbers(ctx);

    renderer.screenSpace();
    ctx.fillStyle = w.theme.tint; ctx.fillRect(0, 0, v.w, v.h);
    if (app.vignette) ctx.drawImage(app.vignette, 0, 0, v.w, v.h);
    drawOffscreenArrows(w);
    if (w.player.hp / w.player.maxHp < 0.3 && !w.player.dead) {
      ctx.fillStyle = `rgba(194,65,47,${(0.1 + 0.08 * Math.sin(w.time * 6)).toFixed(3)})`;
      ctx.fillRect(0, 0, v.w, v.h);
    }
    if (w.slowT > 0) {
      // perfect dodge: cool, desaturated world with a bright rim
      const k = Math.min(1, w.slowT / 0.15);
      ctx.fillStyle = `rgba(120,160,210,${(0.14 * k).toFixed(3)})`; ctx.fillRect(0, 0, v.w, v.h);
      ctx.strokeStyle = `rgba(191,227,255,${(0.5 * k).toFixed(3)})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, v.w - 8, v.h - 8);
    }
    drawUltScreen(ctx, w, v, heroCutIn);
    if (w.fade > 0) { ctx.fillStyle = `rgba(8,5,4,${w.fade.toFixed(3)})`; ctx.fillRect(0, 0, v.w, v.h); }
  }
  // the hero, big, for the ultimate's cut-in (screen space)
  function heroCutIn(c, x, y, sc) {
    const p = world.player;
    drawHero(renderer, sprites.heroParts, sprites.weapon, { x, y, flip: false, time: world.time, walkT: 0, moving: false, type: p.wtype, scale: sc, wp: { arm: -1.1, blade: -2.5, reach: 8, lean: -0.12, glow: 1, twoHand: !!p.wtype.twoHanded, dual: !!p.wtype.dual, backArm: -0.6, backBlade: -2.2, bow: p.wtype.id === 'bow', draw: 0.6 } });
  }

  function drawOffscreenArrows(w) {
    const v = renderer.view, cam = renderer.cam, m = 26;
    for (const e of w.enemies) {
      if (e.dead) continue;
      const sx = (e.x - cam.x) * cam.zoom + v.w / 2, sy = (e.y - 30 - cam.y) * cam.zoom + v.h / 2;
      if (sx > 0 && sx < v.w && sy > 0 && sy < v.h) continue;
      const cx = v.w / 2, cy = v.h / 2, a = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((v.w / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (v.h / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
      ctx.save(); ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k); ctx.rotate(a);
      ctx.fillStyle = e.type.boss ? '#ef6a52' : 'rgba(239,106,82,0.85)'; ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2;
      const sz = e.type.boss ? 14 : 9;
      ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, -sz * 0.8); ctx.lineTo(-sz * 0.3, 0); ctx.lineTo(-sz * 0.7, sz * 0.8); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  return {
    enter({ stageId, resume }) {
      app.particles.clear();
      app.refreshHeroSprites();
      const snap = resume ? getRun(store.get(), stageId) : null;     // v8.3: continue a saved run (falls back to a new one)
      world = makeWorld(stageId, snap);
      input.setEnabled(true); input.reset();
      app.hud.show(world);
      enterRoom(snap ? snap.room : startRoom(world.dungeon).id, null, snap);
      audio.music(STAGE_TRACK[world.themeKey] || 's1'); audio.setIntensity(1);
      if (snap) { app.toast('ต่อดันจากจุดที่ค้างไว้', 'ok'); return; }
      const sc = storyMoment(store.get(), stageId, 'enter');
      if (sc) { world.paused = true; app.playScene(sc, () => { if (world) { world.paused = false; input.reset(); } }); }
    },
    exit() {
      input.setEnabled(false);
      app.hud.hide();
      audio.stopMusic();
      world = null;
    },
    update, render,
    pause() { if (world) { world.paused = true; input.reset(); } },
    resume() { if (world) { world.paused = false; input.reset(); } },
    retreat() { if (world && !world.ended) finish('retreat'); },
    // v8.3: the tab is being hidden / closed: pick up what lies on the floor and keep the run resumable
    checkpoint() {
      const w = world;
      if (!w || w.ended || w.phase === 'victory' || w.phase === 'defeat') return;
      for (const d of w.drops) collect(w, d);
      w.drops.length = 0;
      saveRun('hidden');
    },
    // v8.3: "พักดัน": save the run and leave without ending it (no result screen, the run does not count yet)
    rest() {
      const w = world;
      if (!w || w.ended || w.phase === 'victory' || w.phase === 'defeat') return null;
      for (const d of w.drops) collect(w, d);
      w.drops.length = 0;
      const save = saveRun('rest');
      w.ended = true;
      input.setEnabled(false);
      return { stage: w.stage, saveOk: save?.ok !== false };
    },
    castFromUi(i) { if (world && !world.paused && world.phase !== 'defeat') castSkill(world.skills, i, world); },
    raceFromUi() { if (world && !world.paused && world.phase !== 'defeat') castRaceSkill(world); },
    interactFromUi() { if (world && world.phase === 'explore' && world.interactTarget) doInteract(world, world.interactTarget); },
    get world() { return world; },
  };
}
