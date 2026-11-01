// PvP match (1v1 duel, 2v2, 3v3): best of 3 rounds, last team standing wins a round. Everyone fights with the full
// kit (weapon combos, charge, dodge + perfect dodge, skills, bloodline skill); pets stay home, no potions.
// Each client simulates its own hero and shares it as presence in the match room; attackers report hits, the
// victim applies them with its own defence and dodge window (src/online/pvp.js). The room host owns the round
// state and shares it as presence too (`mt`), so a late or dropped message never desyncs the score.
import { BALANCE } from '../config/balance.js';
import { uniqueAfterHit, uniqueDamageMult, uniqueOnKill, tickUnique, drawBrands, drawUniqueAura } from '../battle/uniques.js';
import { computeStats } from '../systems/stats.js';
import { slottedSkills } from '../systems/skills.js';
import { cloneState } from '../core/state.js';
import { createPlayer, updatePlayer, damagePlayer, inPerfectWindow } from '../battle/player.js';
import { createFx } from '../battle/fx.js';
import { createSkillBar, tickSkills, castSkill, updateSnares, drawSnares, replaySkill } from '../battle/skills.js';
import { createSkillRuntime } from '../battle/skillCast.js';
import { passiveStrikeMult } from '../battle/skillHooks.js';
import { installUlt, updateUlt, drawUltScreen, replayUlt } from '../battle/ultimate.js';
import { equippedUlt } from '../systems/ultimate.js';
import { createRaceSkill, tickRaceSkill, castRaceSkill } from '../battle/raceSkills.js';
import { drawKitGround, drawKitAir } from '../battle/raceKit.js';
import { buffOf } from '../battle/buffs.js';
import { drawTitleLine } from '../ui/nameplate.js';
import { badgeTier } from '../data/titles.js';
import { createShot, updateShots, drawShot, updateZones, drawZones, updateCones } from '../battle/playerShots.js';
import { drawHero } from '../battle/heroDraw.js';
import { drawGuard, GUARD } from '../battle/guard.js';
import { installDefenseHooks } from '../battle/defense.js';
import { createStyle, styleEvent, styleHurt, styleTick, hitKind } from '../battle/style.js';
import { playerPose } from '../battle/weaponPose.js';
import { PVP, hitPacket, resolveHit, fighterPresence, updateRemoteFighter } from '../online/pvp.js';
import { createHitGate } from '../online/fairplay.js';
const hitGate = createHitGate(12, 1000);
import { lookOf, readPresence, PROTOCOL } from '../online/protocol.js';
import { getMode, teamOf, roundOutcome, matchWinner, spawnFor, TEAM_INFO, ROUNDS_TO_WIN } from '../online/match.js';
import { getItem } from '../data/items.js';
import { PVP_ARENA, pickPvpMap, layoutMap, resolveSolids, pointInSolid, hazardAt } from '../data/pvpMaps.js';

const CB = BALANCE.combat;
export const ARENAS = PVP_ARENA;   // v8: far bigger arenas, five maps (data/pvpMaps.js)
const GONE_AFTER = 3;        // seconds without presence = left the match
const WAIT_LIMIT = 20;       // seconds the host waits for everyone to arrive
const SHOT_KINDS = ['arrow', 'bigArrow', 'bolt', 'knife', 'feather', 'shard', 'spear', 'star', 'wolf', 'orb'];
// Weapon clash: both players' melee swings meet at the same moment → a button-mash duel; the winner's weapon lands.
export const CLASH = Object.freeze({ window: 0.18, duration: 2.4, settle: 1.2, power: 2.8, maxRate: 14, range: 230, cooldown: 4 });

export function createMatchScene(app) {
  const { renderer, input, store, audio, sprites, rng } = app;
  const ctx = renderer.ctx;
  let w = null;
  let floor = null, floorKey = '';

  const meId = () => app.online.me.peer;

  function makeWorld({ room, mode, host, roster, title, spectate = false, channel = null }) {
    const st = store.get();
    const stats = computeStats(st);
    const p = createPlayer(stats, 0, 0);
    const A = ARENAS[mode] || ARENAS['1v1'];
    const me = meId();
    const map = layoutMap(pickPvpMap(channel || title || mode), A);
    const wd = {
      room, mode, size: getMode(mode).size, host, amHost: host === me && !spectate, roster, title, A, me, team: (!spectate && teamOf(roster, me)) || 'a', spectate: !!spectate, channel,
      rng, time: 0, stopT: 0, slowT: 0, pvp: true, player: p, enemies: [], fighters: new Map(), fx: createFx(), particles: app.particles,
      skills: createSkillBar(slottedSkills(st)), raceSkill: createRaceSkill(st.race?.id, stats.skillCdMult), pet: null,
      shots: [], zones: [], cones: [], snares: [], ghostShots: [], sk: createSkillRuntime(), combo: { n: 0, t: 0, best: 0 }, style: createStyle(), keys: 0, perfects: 0, kos: 0,
      clash: null, lastClashAt: -99, struckAt: new Map(), clashes: 0, clashWins: 0, parries: 0, counters: 0,
      phase: 'waiting', phaseT: 0, round: 0, score: { a: 0, b: 0 }, ended: false, paused: false, hostGone: 0, lastMt: '',
      unsub: [], lastStandUsed: false, look: lookOf(st), arena: A, map, hazT: 0, iceV: { x: 0, y: 0 },
    };
    for (const t of ['a', 'b']) for (const peer of roster[t]) if (peer !== me) wd.fighters.set(peer, { peer, team: t, r: BALANCE.player.radius, goneT: 0, seen: false, x: null, y: null, hp: 1, maxHp: 1 });
    // --- the world API the shared combat code calls
    wd.sfx = (n, o) => audio.play(n, o);
    wd.shake = (m, t) => renderer.shake(m, t);
    wd.hitStop = (t) => { wd.stopT = Math.max(wd.stopT, Math.min(0.06, t)); };
    wd.screenToWorld = (sx, sy) => renderer.screenToWorld(sx, sy);
    wd.toast = (...a) => app.toast(...a);
    wd.clampBody = (b) => { resolveSolids(map, b); b.x = Math.max(A.wall + b.r, Math.min(A.w - A.wall - b.r, b.x)); b.y = Math.max(A.wall + b.r + 10, Math.min(A.h - A.wall, b.y)); };
    wd.shotBlocked = (x, y) => pointInSolid(map, x, y);
    wd.cutProjectiles = () => 0;
    wd.addSnare = (z) => wd.snares.push(z);
    wd.netSkill = (m) => send({ k: 'sk', ...m });
    wd.addHazard = () => {};
    wd.addCone = (c) => wd.cones.push(c);
    wd.addZone = (z) => { wd.zones.push({ ...z, t: 0, done: false }); audio.play('cast', { power: 1.6 }); send({ k: 'zone', x: Math.round(z.x), y: Math.round(z.y), r: z.r, delay: z.delay }); };
    wd.firePlayerShot = (o) => {
      wd.shots.push(createShot(o));
      send({ k: 'shot', kind: o.kind, x: Math.round(o.x), y: Math.round(o.y), a: Math.round(o.angle * 100) / 100, sp: o.speed, r: o.r });
    };
    wd.usePotion = () => { app.toast('ห้ามใช้ยาระหว่างประลอง', 'warn', 'pvp-potion'); audio.play('error'); };
    wd.onPlayerSwing = (def, kind) => {
      const t = p.wtype.id;
      if (t === 'bow') audio.play('bow', { power: kind === 'charged' ? 1.6 : 1 });
      else if (t === 'staff') audio.play('cast', { power: kind === 'charged' ? 1.6 : def.power });
      else audio.play('swing', { power: Math.min(1.8, 0.7 + def.power * 0.45) });
    };
    wd.onPlayerDash = (blink) => audio.play(blink ? 'blink' : 'dash');
    wd.onChargeReady = () => audio.play('charge');
    wd.onLastStand = () => { app.hud.banner('ผู้ไม่มอด', 'รอดจากหมัดสุดท้าย'); audio.play('roar'); };
    wd.onPlayerDeath = () => { audio.play('defeat'); app.hud.banner('ถูกล้ม', wd.size > 1 ? 'รอเพื่อนร่วมทีม' : ''); };
    // Hits I land become hit reports to that opponent.
    wd.playerStrike = (e, power, o = {}) => {
      if (!e.peer || e.team === wd.team || wd.phase !== 'fight' || o.src === 'burn') return null;
      const empowered = p.empowerT > 0 && (o.src === 'melee' || o.src === 'proj');
      if (empowered) p.empowerT = 0;
      const pkt = hitPacket(p.stats, power * passiveStrikeMult(p, e) * (empowered ? 1 + CB.perfect.empowerPower : 1) * uniqueDamageMult(p, wd, e) * (1 + buffOf(p, 'dmg') + (p.stats.titleDmg || 0)), { ...o, critBonus: (o.critBonus || 0) + buffOf(p, 'crit'), forceCrit: o.forceCrit || empowered }, p);
      pkt.to = e.peer;
      if (o.src === 'melee' || o.src === undefined) wd.struckAt.set(e.peer, wd.time);
      send(pkt);
      wd.combo.n += 1; wd.combo.t = 0; wd.combo.best = Math.max(wd.combo.best, wd.combo.n);
      wd.rankUp(styleEvent(wd.style, hitKind(p, o)));
      uniqueAfterHit(wd, p, e, o);
      wd.particles.burst(e.x, e.y - 30, 8, { color: ['#fff8ea', '#f3e6c8'], speedMin: 90, speedMax: 260, life: 0.25, size: 2.5, drag: 5, glow: true });
      audio.play('hit');
      return { amount: 0, crit: false };
    };
    wd.petStrike = () => null;
    // a parried opponent is told: on their side they lose their swing and stagger
    installDefenseHooks(wd, { audio, renderer, app, stagger: (f) => { if (f?.peer) send({ k: 'parried', to: f.peer }); } });
    if (!spectate) installUlt(wd, { app, audio, id: equippedUlt(st), pvp: true, freezes: false, onUse: () => { const n = cloneState(store.get()); n.stats.ults = (n.stats.ults || 0) + 1; store.commit(n, { reason: 'ult', persist: false }); }, net: (m) => send({ k: 'ult', ...m }) });
    return wd;
  }

  function send(data) { w?.room.emit('match', data); }
  function setMt(mt) { w.room.presence({ mt }); w.lastMt = JSON.stringify(mt); }

  // ------------------------------------------------------------ messages from the match room
  function onMessage(m) {
    if (!w || m.sameTab) return;
    const f = w.fighters.get(m.peer);
    if (!f) return;                                    // only seated players talk in this room
    const d = m.data || {};
    const p = w.player;
    if (w.spectate) {
      // a viewer sees the blows land (the struck player reports them), the shots fly and the spells fall
      if (d.k === 'sk') { replaySkill(w, d); return; }
      if (d.k === 'ult') { replayUlt(w, d, f.name || ''); return; }
      if (d.k === 'struck') { w.fx.number(f.x, f.y - 80, Math.max(1, d.amount | 0), d.crit ? 'crit' : 'hit'); if (d.crit) renderer.shake(3, 0.1); }
      else if (d.k === 'shot') { const a = Number(d.a) || 0, sp = Math.min(1600, Number(d.sp) || 600); w.ghostShots.push({ ...createShot({ kind: SHOT_KINDS.includes(d.kind) ? d.kind : 'bolt', x: +d.x || 0, y: +d.y || 0, angle: a, speed: sp, r: Math.min(14, +d.r || 8), power: 0 }), life: 1.1 }); }
      else if (d.k === 'zone') w.zones.push({ x: +d.x || 0, y: +d.y || 0, r: Math.min(220, +d.r || 100), delay: Math.min(1.5, +d.delay || 0.5), power: 0, opts: {}, t: 0, done: false, ghost: true });
      return;
    }
    const foe = f.team !== w.team;
    if (d.k === 'sk') { replaySkill(w, d); return; }
    if (d.k === 'ult') { replayUlt(w, d, f.name || ''); if (foe) audio.play('pierceWarn'); return; }
    if (d.k === 'forfeit') { f.left = true; f.goneT = 99; f.seen = true; f.ko = true; return; }   // they left: down for the rest of the match
    if (d.k === 'hit' && foe && d.to === w.me && w.phase === 'fight' && !p.dead) {
      // the winner's strike can arrive before my own count of the clash is settled: it settles it
      if (d.src === 'clash' && w.clash && w.clash.peer === m.peer) { w.clash.theirs = Math.max(w.clash.theirs, w.clash.mine + 1); w.clash.theirFinal = true; finishClash(); }
      const clashWin = d.src === 'clash' && w.clashResult?.peer === m.peer && w.clashResult.lost;
      if (w.clash && !clashWin) return;                  // locked in a clash: nothing else lands
      // a hidden tab stops my frame loop; invulnerability frames still run out in real time (no hiding in the tab bar)
      const gap = (performance.now() - (w.lastTick || performance.now())) / 1000;
      if (gap > 0.1) { p.iframes = Math.max(0, p.iframes - gap); w.lastTick = performance.now(); }
      if (p.iframes > 0 && !clashWin) {
        if (inPerfectWindow(p)) perfectDodge();
        send({ k: 'miss', to: m.peer });
        return;
      }
      if (!hitGate.allow(m.peer)) return;                // a flood of hit reports is ignored
      // both melee swings met at the same moment: weapons clash instead of either landing
      if (!clashWin && canClash(m.peer, f, d)) { beginClash(m.peer, null); return; }
      const r = resolveHit(d, p.stats, p, rng, f.lv);
      if (!r) return;
      if (clashWin) { p.iframes = 0; w.clashResult = null; }
      if (damagePlayer(p, r.amount, r.kx, r.ky, w, { attacker: f, from: { x: +d.fx, y: +d.fy }, unblockable: clashWin })) {
        audio.play('hurt'); renderer.shake(6, 0.2); app.hud.hurt();
        w.combo.n = 0;
        if (!(p.guard.blockFx > 0.2)) styleHurt(w.style);
        send({ k: 'struck', to: m.peer, amount: r.amount, crit: r.crit });
        w.ultEvent?.('hurt');
      }
    } else if (d.k === 'parried' && d.to === w.me && foe) {
      // my swing was parried: I lose it and stagger
      p.move = null; p.buffered = false; p.guard.staggerT = GUARD.pvpParryStagger;
      w.fx.callout(p.x, p.y - 128, 'โดนแพร์รี่!', '#ff9a8a'); audio.play('guardBreak'); renderer.shake(5, 0.2);
    } else if (d.k === 'clash' && d.to === w.me && foe && w.phase === 'fight') {
      beginClash(m.peer, typeof d.id === 'string' ? d.id.slice(0, 16) : null);
    } else if ((d.k === 'clashN' || d.k === 'clashEnd') && d.to === w.me && w.clash && w.clash.peer === m.peer && d.id === w.clash.id) {
      const cap = Math.ceil(CLASH.maxRate * CLASH.duration);
      w.clash.theirs = Math.max(w.clash.theirs, Math.max(0, Math.min(cap, d.n | 0)));
      if (d.k === 'clashEnd') w.clash.theirFinal = true;
    } else if (d.k === 'struck' && d.to === w.me) {
      w.ultEvent?.('hit');
      w.fx.number(f.x, f.y - 80, Math.max(1, d.amount | 0), d.crit ? 'crit' : 'hit');
      if (d.crit) renderer.shake(4, 0.12);
    } else if (d.k === 'miss' && d.to === w.me) {
      w.fx.number(f.x, f.y - 80, 'หลบ', 'info');
    } else if (d.k === 'shot' && foe) {
      const a = Number(d.a) || 0, sp = Math.min(1600, Number(d.sp) || 600);
      w.ghostShots.push({ ...createShot({ kind: SHOT_KINDS.includes(d.kind) ? d.kind : 'bolt', x: +d.x || 0, y: +d.y || 0, angle: a, speed: sp, r: Math.min(14, +d.r || 8), power: 0 }), life: 1.1 });
    } else if (d.k === 'zone' && foe) {
      w.zones.push({ x: +d.x || 0, y: +d.y || 0, r: Math.min(220, +d.r || 100), delay: Math.min(1.5, +d.delay || 0.5), power: 0, opts: {}, t: 0, done: false, ghost: true });
    }
  }

  // ------------------------------------------------------------ weapon clash
  function canClash(peer, f, d) {
    const p = w.player, m = p.move;
    if (w.clash || w.time - w.lastClashAt < CLASH.cooldown || !m || p.wtype.ranged) return false;
    if (!(d.src === 'melee' || d.src === undefined) || f.wtype?.ranged) return false;
    const swinging = m.kind !== 'charged' && (m.phase === 'active' || (m.phase === 'recover' && m.t < 0.1) || (m.phase === 'windup' && m.t > m.def.windup * 0.6));
    const iStruck = w.time - (w.struckAt.get(peer) ?? -99) < CLASH.window;
    return swinging && (iStruck || m.phase === 'windup') && Math.hypot(f.x - p.x, f.y - p.y) < CLASH.range;
  }
  function beginClash(peer, id) {
    const f = w.fighters.get(peer);
    if (!f) return;
    if (w.clash) {
      // both sides found the clash at once: keep the smaller id so both agree
      if (w.clash.peer === peer && id && id < w.clash.id) w.clash.id = id;
      return;
    }
    const cid = id || Math.random().toString(36).slice(2, 10);
    const p = w.player;
    w.clash = { peer, id: cid, t: 0, mine: 0, theirs: 0, theirFinal: false, sentEnd: false, sendT: 0, presses: [], mx: (p.x + f.x) / 2, my: (p.y + f.y) / 2 };
    w.lastClashAt = w.time; w.clashes += 1;
    p.move = null; p.buffered = false; p.charging = false; p.dashT = 0; p.vx = p.vy = 0;
    p.facing = Math.atan2(f.y - p.y, f.x - p.x); p.flip = Math.cos(p.facing) < 0;
    if (!id) send({ k: 'clash', to: peer, id: cid });
    audio.play('clash'); renderer.shake(9, 0.3); w.hitStop(0.06);
  }
  function updateClash(dt, intent) {
    const c = w.clash, p = w.player;
    c.t += dt;
    p.iframes = Math.max(p.iframes, 0.2);
    if (c.t <= CLASH.duration && intent.attack) {
      // human mashing tops out around 12–14 presses per second: anything faster is not counted
      c.presses = c.presses.filter((t) => c.t - t < 1);
      if (c.presses.length < CLASH.maxRate) { c.presses.push(c.t); c.mine += 1; if (c.mine % 3 === 0) audio.play('clash'); w.particles.burst(c.mx, c.my - 40, 4, { color: ['#fff8ea', '#ffd08a'], speedMin: 120, speedMax: 320, life: 0.3, size: 2.5, drag: 4, glow: true }); }
    }
    c.sendT += dt;
    if (c.t <= CLASH.duration && c.sendT >= 0.25) { c.sendT = 0; send({ k: 'clashN', to: c.peer, id: c.id, n: c.mine }); }
    if (c.t > CLASH.duration && !c.sentEnd) { c.sentEnd = true; send({ k: 'clashEnd', to: c.peer, id: c.id, n: c.mine }); }
    if (c.t > CLASH.duration && (c.theirFinal || c.t > CLASH.duration + CLASH.settle)) finishClash();
  }
  function finishClash() {
    const c = w.clash, p = w.player, f = w.fighters.get(c.peer);
    w.clash = null;
    const won = c.mine > c.theirs, lost = c.mine < c.theirs;
    w.clashResult = { peer: c.peer, lost };
    if (won) {
      w.clashWins += 1;
      app.hud.banner('ชนะการปะทะ!', `${c.mine} ต่อ ${c.theirs}`);
      audio.play('counter'); renderer.shake(12, 0.35);
      const pkt = hitPacket(p.stats, CLASH.power, { forceCrit: true, src: 'clash', kx: Math.cos(p.facing) * 520, ky: Math.sin(p.facing) * 520 }, p);
      pkt.to = c.peer;
      send(pkt);
      w.rankUp(styleEvent(w.style, 'counter'));
      if (f) w.fx.slash(f.x, f.y - 30, p.facing, Math.PI * 0.9, 120, 3, p.wtype.trail.color, false, p.wtype.trail.glow);
    } else if (lost) {
      app.hud.banner('แพ้การปะทะ', `${c.mine} ต่อ ${c.theirs}`);
      p.iframes = 0;
    } else {
      app.hud.banner('เสมอ!', 'ต่างฝ่ายต่างกระเด็นออก');
      p.vx = -Math.cos(p.facing) * 520; p.vy = -Math.sin(p.facing) * 520;
    }
    p.iframes = won ? 0.4 : 0;
  }
  function drawClash(v) {
    const c = w.clash;
    if (!c) return;
    const k = Math.min(1, c.t / 0.2);
    const total = Math.max(1, c.mine + c.theirs);
    const share = c.mine / total;
    const bw = Math.min(520, v.w - 60), bx = (v.w - bw) / 2, by = v.h * 0.2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,6,4,0.55)'; ctx.fillRect(0, by - 70, v.w, 140);
    ctx.font = '400 40px "Chonburi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = '#f5d48a';
    const left = Math.max(0, CLASH.duration - c.t);
    ctx.strokeText(left > 0 ? 'กดโจมตีรัวๆ!' : 'วัดกำลัง…', v.w / 2, by - 38); ctx.fillText(left > 0 ? 'กดโจมตีรัวๆ!' : 'วัดกำลัง…', v.w / 2, by - 38);
    // tug-of-war bar: my side gold, theirs vermilion, sparks where they meet
    ctx.fillStyle = '#c2412f'; ctx.fillRect(bx, by, bw, 16);
    ctx.fillStyle = '#e0b45a'; ctx.fillRect(bx, by, bw * share, 16);
    ctx.strokeStyle = '#f3e6c8'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 16);
    const sx = bx + bw * share;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const a = w.time * 20 + i; ctx.fillStyle = 'rgba(255,240,200,0.8)'; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * 10, by + 8 + Math.sin(a * 1.3) * 10, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '700 18px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillStyle = '#f3e6c8';
    ctx.fillText(`${c.mine}`, bx - 22, by + 8); ctx.fillText(`${c.theirs}`, bx + bw + 22, by + 8);
    ctx.fillStyle = 'rgba(243,230,200,0.8)'; ctx.font = '600 13px "Bai Jamjuree", system-ui, sans-serif';
    ctx.fillText(`ปะทะ! รัวปุ่มโจมตีให้มากกว่าคู่ต่อสู้ · ${left.toFixed(1)} วิ`, v.w / 2, by + 36);
    ctx.restore();
  }
  function drawClashWorld() {
    const c = w.clash;
    if (!c) return;
    const p = w.player, f = w.fighters.get(c.peer);
    if (!f) return;
    const mx = (p.x + f.x) / 2, my = (p.y + f.y) / 2 - 46;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin(w.time * 30);
    const g = ctx.createRadialGradient(mx, my, 2, mx, my, 60);
    g.addColorStop(0, `rgba(255,248,220,${(0.9 * pulse).toFixed(3)})`); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 60, 0, Math.PI * 2); ctx.fill();
    // crossed blades
    ctx.lineCap = 'round';
    for (const [from, col] of [[p, p.wtype.trail.glow], [f, f.wtype?.trail?.glow || '#ffb3a4']]) {
      ctx.strokeStyle = col; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(from.x, from.y - 40); ctx.lineTo(mx + (mx - from.x) * 0.25, my - 18 + Math.sin(w.time * 40) * 3); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.5) w.particles.spawn({ x: mx, y: my, vx: (Math.random() - 0.5) * 420, vy: -Math.random() * 300, life: 0.35, size: 2.5, size2: 0.5, color: Math.random() < 0.5 ? '#fff3c4' : '#ffb35a', drag: 3, glow: true });
  }

  function perfectDodge() {
    const p = w.player;
    if (p.perfectUsed) return;
    p.perfectUsed = true; p.empowerT = CB.perfect.empowerT; p.dodges = Math.min(p.dodgeMax, p.dodges + 1);
    w.rankUp(styleEvent(w.style, 'perfect'));
    w.slowT = 0.25; w.perfects += 1;
    w.ultEvent?.('perfect');
    w.fx.callout(p.x, p.y - 120, 'หลบสมบูรณ์!', '#bfe3ff');
    w.fx.ring(p.x, p.y - 30, 20, 120, '#bfe3ff', 0.5, 6);
    audio.play('perfect'); app.hud.flash?.('perfect');
  }

  // ------------------------------------------------------------ rounds
  function mySeat() { return Math.max(0, w.roster[w.team].indexOf(w.me)); }
  function resetFighter() {
    const p = w.player, at = spawnFor(w.team, mySeat(), w.size, w.A);
    p.x = at.x; p.y = at.y; p.vx = p.vy = 0; p.hp = p.maxHp; p.dead = false; p.deathT = 0; p.move = null; p.shield = 0; p.rush = null;
    p.dodges = p.dodgeMax; p.iframes = 0; p.flip = w.team === 'b'; p.facing = w.team === 'b' ? Math.PI : 0;
    w.shots.length = 0; w.ghostShots.length = 0; w.zones.length = 0; w.cones.length = 0; w.snares.length = 0; w.combo.n = 0;
    w.lastStandUsed = false; w.clash = null; w.clashResult = null;
    if (w.ult?.run) { w.ult.run = null; app.hud.cinema?.(false); }
    p.guard.guarding = false; p.guard.breakT = 0; p.guard.staggerT = 0; p.guard.meter = GUARD.meterMax; p.guard.counterT = 0;
  }

  function startRound(n) {
    if (!w || w.ended) return;
    w.round = n; w.phase = 'countdown'; w.phaseT = 0;
    resetFighter();
    app.hud.banner(`ยกที่ ${n}`, n === 1 ? `${w.map.name} · ${scoreText()}` : scoreText());
    audio.play('wave');
  }

  function endRound(winTeam, score) {
    if (w.phase === 'roundEnd' || w.ended) return;
    w.phase = 'roundEnd'; w.phaseT = 0;
    w.score = { ...score };
    const mine = winTeam === w.team;
    if (w.spectate) { app.hud.banner(winTeam === 'draw' ? 'เสมอ' : `${TEAM_INFO[winTeam].name} ชนะยกนี้`, `${w.score.a} - ${w.score.b}`); audio.play('wave'); return; }
    app.hud.banner(winTeam === 'draw' ? 'เสมอ' : mine ? 'ชนะยกนี้' : 'เสียยกนี้', scoreText());
    audio.play(winTeam === 'draw' ? 'wave' : mine ? 'victory' : 'defeat');
  }

  function scoreText() {
    const other = w.team === 'a' ? 'b' : 'a';
    return `${TEAM_INFO[w.team].name} ${w.score[w.team]} - ${w.score[other]} ${TEAM_INFO[other].name}`;
  }

  // Who is still standing: me from my own hero, others from their presence (gone = down).
  function aliveMap() {
    const alive = { [w.me]: !w.player.dead };
    for (const f of w.fighters.values()) alive[f.peer] = f.seen && f.goneT < GONE_AFTER && !f.ko && f.hp > 0;
    return alive;
  }

  function finishMatch(result, why) {
    if (!w || w.ended) return;
    w.ended = true; w.phase = 'done';
    input.setEnabled(false);
    if (w.amHost) app.online.publish({ pr: null });
    if (w.spectate) { app.onSpectateEnd({ title: w.title, winner: w.lastWin || null, score: { ...w.score } }); return; }
    if (result === 'win' || result === 'lose') {
      const next = cloneState(store.get());
      if (result === 'win') next.pvp.wins += 1; else next.pvp.losses += 1;
      store.commit(next, { reason: 'pvp' });
    }
    const other = w.team === 'a' ? 'b' : 'a';
    const names = (t) => w.roster[t].map((peer) => (peer === w.me ? store.get().story.name : w.fighters.get(peer)?.name || 'นักล่า'));
    app.onMatchEnd({
      result, why, mode: w.mode, title: w.title,
      score: { me: w.score[w.team], them: w.score[other] }, team: w.team,
      allies: names(w.team), opponents: names(other), opponent: { name: names(other).join(', ') },
      perfects: w.perfects, bestCombo: w.combo.best,
    });
  }

  // ------------------------------------------------------------ frame
  let sendAcc = 0;
  function readFighters(dt) {
    const peers = w.room.peers();
    const byPeer = new Map(peers.map((x) => [x.peer, x]));
    let hostMt = null;
    for (const f of w.fighters.values()) {
      if (f.left) { f.goneT = 99; continue; }        // forfeited: out for good, even while their page is still open
      const x = byPeer.get(f.peer);
      const raw = x?.presence;
      if (!raw || raw.v !== PROTOCOL || x.sameTab) { f.goneT += dt; continue; }
      f.goneT = 0; f.seen = true;
      updateRemoteFighter(f, raw, dt);
      const c = readPresence(raw);
      f.name = c?.name || 'นักล่า'; f.title = c?.title || null; f.badge = c?.badge || 0; f.look = c ? { a: c.armor, r: c.race, w: c.weapon, wg: c.wings } : f.look; f.lv = c?.lv || f.lv;
      f.ko = raw.st === 'ko';
      f.dead = f.ko || f.hp <= 0; f.spawning = 0;
      f.type = { boss: false, mass: 1.4, radius: 20 }; f.def = 0;
      if (f.peer === w.host) hostMt = raw.mt || null;
      if (f.newActive && f.team !== w.team) remoteSwingFx(f);
      else if (f.newActive) remoteSwingFx(f, 0.5);
    }
    return hostMt;
  }

  function hostFlow() {
    const alive = aliveMap();
    // a whole side left the match (forfeit or closed the game): it ends now
    if (w.phase !== 'waiting') {
      const goneSide = ['a', 'b'].find((t) => w.roster[t].length && w.roster[t].every((peer) => peer !== w.me && (w.fighters.get(peer)?.goneT || 0) > GONE_AFTER));
      if (goneSide) { const winner = goneSide === 'a' ? 'b' : 'a'; setMt({ st: 'done', sc: w.score, win: winner }); finishMatch(winner === w.team ? 'win' : 'lose', 'forfeit'); return; }
    }
    if (w.phase === 'waiting') {
      const all = [...w.fighters.values()];
      const ready = all.every((f) => f.seen && f.status === 'ready');
      const others = all.filter((f) => f.team !== w.team && f.seen);
      if ((ready && w.phaseT > 0.6) || (w.phaseT > WAIT_LIMIT && others.length)) { setMt({ st: 'countdown', rd: 1, sc: w.score }); startRound(1); }
      else if (w.phaseT > WAIT_LIMIT) { setMt({ st: 'done', sc: w.score, win: null }); finishMatch('cancel', 'no_show'); }
    } else if (w.phase === 'countdown' && w.phaseT >= PVP.countdown) {
      w.phase = 'fight'; w.phaseT = 0; setMt({ st: 'fight', rd: w.round, sc: w.score }); fightBanner();
    } else if (w.phase === 'fight') {
      const out = roundOutcome(w.roster, alive);
      if (out) {
        const sc = { ...w.score };
        if (out !== 'draw') sc[out] += 1;
        setMt({ st: 'roundEnd', rd: w.round, sc, rw: out });
        endRound(out, sc);
      }
    } else if (w.phase === 'roundEnd' && w.phaseT > 2.4) {
      const win = matchWinner(w.score);
      // nobody left on one side for good (everyone there closed the game): end now
      const gone = (t) => w.roster[t].every((peer) => peer !== w.me && (w.fighters.get(peer)?.goneT || 0) > GONE_AFTER);
      const forfeit = gone('a') ? 'b' : gone('b') ? 'a' : null;
      if (win || forfeit) {
        const winner = win || forfeit;
        setMt({ st: 'done', sc: w.score, win: winner });
        finishMatch(winner === w.team ? 'win' : 'lose', win ? 'score' : 'forfeit');
        return;
      }
      setMt({ st: 'countdown', rd: w.round + 1, sc: w.score });
      startRound(w.round + 1);
    }
    // a side that emptied out mid-round loses that round at once (handled by aliveMap: gone = down)
  }

  function followHost(mt) {
    const hostF = w.fighters.get(w.host);
    if (!hostF || hostF.goneT > GONE_AFTER) {
      if (hostF?.seen || w.phaseT > WAIT_LIMIT) {
        w.hostGone += 1;
        // the host left: in a duel that is a forfeit, in a team match the room is closed without a result
        if (w.size === 1) finishMatch('win', 'forfeit'); else finishMatch('cancel', 'host_left');
      }
      return;
    }
    if (!mt || typeof mt !== 'object') return;
    const key = JSON.stringify(mt);
    if (key === w.lastMt) return;
    w.lastMt = key;
    const rd = Math.max(0, Math.min(9, mt.rd | 0));
    const sc = { a: Math.max(0, Math.min(ROUNDS_TO_WIN, mt.sc?.a | 0)), b: Math.max(0, Math.min(ROUNDS_TO_WIN, mt.sc?.b | 0)) };
    if (mt.st === 'countdown' && rd !== w.round) { w.score = sc; startRound(rd); }
    else if (mt.st === 'fight' && rd !== w.round) { w.score = sc; startRound(rd); w.phaseT = PVP.countdown; }
    else if (mt.st === 'fight' && w.phase === 'countdown') { w.phase = 'fight'; w.phaseT = 0; fightBanner(); }
    else if (mt.st === 'roundEnd') endRound(['a', 'b', 'draw'].includes(mt.rw) ? mt.rw : 'draw', sc);
    else if (mt.st === 'done') {
      w.score = sc; w.lastWin = mt.win === 'a' || mt.win === 'b' ? mt.win : null;
      if (mt.win === 'a' || mt.win === 'b') finishMatch(mt.win === w.team ? 'win' : 'lose', 'score');
      else finishMatch('cancel', 'no_show');
    }
  }

  function fightBanner() { app.hud.banner('สู้!', ''); audio.play('roar'); }

  function update(dt) {
    if (!w) return;
    w.lastTick = performance.now();
    const intent = input.poll();
    if (intent.pause && !w.ended) app.leaveMatch();
    const p = w.player;
    w.phaseT += dt;
    if (w.slowT > 0) w.slowT -= dt;
    if (w.stopT > 0) w.stopT -= dt;
    w.time += dt;
    w.fx.update(dt); w.particles.update(dt); renderer.update(dt);

    const mt = readFighters(dt);
    w.enemies = w.phase === 'fight' ? [...w.fighters.values()].filter((f) => f.team !== w.team && f.seen && !f.dead && f.goneT < GONE_AFTER && f.x != null) : [];
    if (w.amHost) hostFlow(); else followHost(mt);
    if (w.ended) return;
    // non-hosts run their own countdown so the fight starts without waiting for another message
    if (!w.amHost && w.phase === 'countdown' && w.phaseT >= PVP.countdown) { w.phase = 'fight'; w.phaseT = 0; fightBanner(); }
    if (w.spectate) { spectateFrame(dt); return; }

    // my hero
    const fighting = w.phase === 'fight' && !p.dead;
    tickSkills(w.skills, dt); tickRaceSkill(w.raceSkill, dt, w);
    if (w.clash) updateClash(dt, intent);
    const locked = !!w.clash;
    if (fighting && !locked && intent.ult) w.tryUlt?.();
    updateUlt(w, dt);
    const busy = !!w.ult?.run;
    const myIntent = fighting && !locked && !busy ? intent : { ...intent, attack: false, attackHeld: false, dash: false, skill: -1, race: false, potion: false, guard: false, mx: 0, my: 0 };
    if (fighting && !locked && !busy && intent.skill >= 0) castSkill(w.skills, intent.skill, w);
    if (fighting && !locked && !busy && intent.race) castRaceSkill(w);
    if (w.phase !== 'fight') { myIntent.mx = 0; myIntent.my = 0; }
    const x0 = p.x, y0 = p.y;
    updatePlayer(p, myIntent, dt, w);
    tickUnique(p, dt);
    mapGround(p, x0, y0, dt);
    w.clampBody(p);
    w.combo.t += dt; if (w.combo.n > 0 && w.combo.t > CB.combo.resetAfter) w.combo.n = 0;
    styleTick(w.style, dt);
    updateShots(w.shots, dt, w);
    updateZones(w.zones.filter((z) => !z.ghost), dt, w);
    for (let i = w.zones.length - 1; i >= 0; i--) {
      const z = w.zones[i];
      if (z.ghost) { z.t += dt; if (z.t > z.delay + 0.35) w.zones.splice(i, 1); else if (!z.done && z.t >= z.delay) { z.done = true; renderer.shake(6, 0.2); audio.play('slam'); } }
      else if (z.t >= z.delay + 0.35) w.zones.splice(i, 1);
    }
    updateCones(w.cones, dt, w);
    updateSnares(w.snares, dt, w);
    w.sk.update(dt, w);
    const A = w.A;
    for (let i = w.ghostShots.length - 1; i >= 0; i--) {
      const s = w.ghostShots[i]; s.t += dt; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0 || Math.hypot(s.x - p.x, s.y - (p.y - 30)) < s.r + p.r || s.x < 0 || s.y < 0 || s.x > A.w || s.y > A.h || pointInSolid(w.map, s.x, s.y)) w.ghostShots.splice(i, 1);
    }

    // share my fighter ~15×/s (presence shares the room's ~40 msg/s budget with hit and shot events)
    sendAcc += dt;
    if (sendAcc >= 0.066) { sendAcc = 0; w.room.presence({ ...fighterPresence(p, w.look, w.phase === 'waiting' ? 'ready' : p.dead ? 'ko' : 'fight'), gd: p.guard.guarding ? 1 : 0, cl: w.clash ? 1 : 0 }); }

    camera(dt);
    app.hud.update(p, w);
    const foes = [...w.fighters.values()].filter((f) => f.team !== w.team && f.seen);
    const hp = foes.reduce((n, f) => n + Math.max(0, f.goneT > GONE_AFTER ? 0 : f.hp), 0), max = foes.reduce((n, f) => n + (f.maxHp || 1), 0);
    if (max) app.hud.setBoss(w.size === 1 ? `${foes[0]?.name || 'คู่ดวล'} · ${w.score[w.team]} - ${w.score[w.team === 'a' ? 'b' : 'a']}` : scoreText(), hp / max);
    // the music drives harder when either side is close to falling
    const low = Math.min(max ? hp / max : 1, p.hp / (p.maxHp || 1));
    audio.setIntensity(low <= 0.2 ? 3 : low <= 0.45 ? 2 : 1);
  }

  // a viewer: no hero of their own; the camera frames the fighters, the music follows the closest call
  function spectateFrame(dt) {
    w.sk.update(dt, w);
    updateUlt(w, dt);
    for (let i = w.zones.length - 1; i >= 0; i--) { const z = w.zones[i]; z.t += dt; if (z.t > z.delay + 0.35) w.zones.splice(i, 1); else if (!z.done && z.t >= z.delay) { z.done = true; audio.play('slam'); } }
    for (let i = w.ghostShots.length - 1; i >= 0; i--) { const s = w.ghostShots[i]; s.t += dt; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0 || pointInSolid(w.map, s.x, s.y)) w.ghostShots.splice(i, 1); }
    camera(dt);
    const seen = [...w.fighters.values()].filter((f) => f.seen && f.goneT < GONE_AFTER);
    const low = seen.length ? Math.min(...seen.map((f) => Math.max(0, f.hp) / (f.maxHp || 1))) : 1;
    audio.setIntensity(low <= 0.2 ? 3 : low <= 0.45 ? 2 : 1);
  }

  // the map under my feet: lava burns, the void drops me back to my corner, ice keeps a run sliding
  function mapGround(p, x0, y0, dt) {
    const z = w.phase === 'fight' && !p.dead ? hazardAt(w.map, p.x, p.y) : null;
    const airborne = (p.leapZ || 0) > 6;
    if (z?.k === 'ice' && dt > 0) {
      const vx = (p.x - x0) / dt, vy = (p.y - y0) / dt;
      if (p.dashT > 0 || p.rush) { w.iceV.x = vx; w.iceV.y = vy; }
      else { const k = Math.min(1, dt * 2.2); w.iceV.x += (vx - w.iceV.x) * k; w.iceV.y += (vy - w.iceV.y) * k; p.x = x0 + w.iceV.x * dt; p.y = y0 + w.iceV.y * dt; }
      if (Math.hypot(w.iceV.x, w.iceV.y) > 140 && Math.random() < 0.3) w.particles.spawn({ x: p.x, y: p.y, vx: -w.iceV.x * 0.1, vy: -20, life: 0.4, size: 3, size2: 0.5, color: '#e6f4ff', drag: 3 });
    } else { w.iceV.x = (p.x - x0) / Math.max(dt, 1e-3); w.iceV.y = (p.y - y0) / Math.max(dt, 1e-3); }
    w.hazT = Math.max(0, w.hazT - dt);
    if (!z || airborne) return;
    if (z.k === 'lava' && w.hazT <= 0) {
      w.hazT = 0.5;
      hazardHurt(p, Math.max(1, Math.round(p.maxHp * 0.04)), 'ลาวา');
      w.particles.burst(p.x, p.y - 10, 8, { color: ['#ff8a3d', '#ffd08a', '#c2412f'], speedMin: 60, speedMax: 200, life: 0.4, size: 3, drag: 3, grav: -200, glow: true });
      audio.play('burn');
    } else if (z.k === 'void' && !(p.dashT > 0) && !p.rush) {
      const at = spawnFor(w.team, mySeat(), w.size, w.A);
      w.fx.ring(p.x, p.y - 10, 10, 90, '#9a8cff', 0.5, 6);
      p.x = at.x; p.y = at.y; p.vx = p.vy = 0; w.iceV.x = w.iceV.y = 0;
      hazardHurt(p, Math.max(1, Math.round(p.maxHp * 0.12)), 'ร่วงหลุม!');
      if (!p.dead) p.iframes = Math.max(p.iframes, 1);
      audio.play('blink'); renderer.shake(5, 0.2);
    }
  }
  // the map's own damage: no block, no dodge window, it simply happens to whoever stands there
  function hazardHurt(p, amount, label) {
    if (p.dead) return;
    p.hp = Math.max(0, p.hp - amount); p.flash = 1;
    w.fx.number(p.x, p.y - 70, amount, 'player');
    w.fx.callout(p.x, p.y - 120, label, '#ff9a6a');
    if (p.hp <= 0 && p.stats.lastStand && !w.lastStandUsed) { w.lastStandUsed = true; p.hp = 1; p.iframes = 1.5; w.onLastStand(); return; }
    if (p.hp <= 0) { p.dead = true; p.deathT = 0; p.move = null; w.onPlayerDeath(); }
  }

  function camera(dt) {
    const cam = renderer.cam, v = renderer.view, A = w.A, p = w.player;
    const landscape = app.touch && v.w > v.h;
    const top = landscape ? 50 : app.touch ? 130 : 96, bottom = landscape ? 10 : app.touch ? 240 : 80;
    const fit = Math.min(v.w / (A.w + 40), (v.h - top - bottom) / (A.h + 20));
    if (fit >= 0.8) {
      cam.zoom = Math.min(1.3, fit);
      cam.x = A.w / 2; cam.y = A.h / 2 - (top - bottom) / 2 / cam.zoom;
      return;
    }
    // v8 arenas are bigger than the screen: follow the action (both fighters framed in a duel)
    const short = Math.min(v.w, v.h - top - bottom);
    cam.zoom = Math.max(0.55, Math.min(1, short / 720));
    let mx = p.x, my = p.y;
    const foe = w.size === 1 ? [...w.fighters.values()][0] : null;
    if (w.spectate) { const fs = [...w.fighters.values()].filter((f) => f.seen && f.x != null); if (fs.length) { mx = fs.reduce((a, f) => a + f.x, 0) / fs.length; my = fs.reduce((a, f) => a + f.y, 0) / fs.length; } }
    else if (foe && foe.x != null) { mx = (p.x + foe.x) / 2; my = (p.y + foe.y) / 2; }
    if (!w.spectate) {
      // never lose my own hero off the edge of the screen
      const hx = Math.max(60, v.w / 2 / cam.zoom - 140), hy = Math.max(60, (v.h - top - bottom) / 2 / cam.zoom - 120);
      mx = Math.max(p.x - hx, Math.min(p.x + hx, mx)); my = Math.max(p.y - hy, Math.min(p.y + hy, my));
    }
    const halfW = v.w / 2 / cam.zoom, halfH = (v.h - top - bottom) / 2 / cam.zoom;
    const tx = A.w < halfW * 2 ? A.w / 2 : Math.max(halfW - 20, Math.min(A.w - halfW + 20, mx));
    const cy = A.h < halfH * 2 ? A.h / 2 : Math.max(halfH - 20, Math.min(A.h - halfH + 20, my - 30));
    const k = Math.min(1, dt * 6);
    cam.x += (tx - cam.x) * k; cam.y += (cy - (top - bottom) / 2 / cam.zoom - cam.y) * k;
  }

  function heroCutIn(c, x, y, sc) {
    const p = w.player;
    drawHero(renderer, sprites.heroParts, sprites.weapon, { x, y, flip: false, time: w.time, walkT: 0, moving: false, type: p.wtype, scale: sc, wp: { arm: -1.1, blade: -2.5, reach: 8, lean: -0.12, glow: 1, twoHand: !!p.wtype.twoHanded, dual: !!p.wtype.dual, backArm: -0.6, backBlade: -2.2, bow: p.wtype.id === 'bow', draw: 0.6 } });
  }

  function remoteSwingFx(r, alpha = 1) {
    const d = r.move?.def; if (!d) return;
    const t = r.wtype.trail, h = d.hit;
    if (h.shape === 'arc') {
      if (['thrust', 'stab', 'stabB'].includes(d.anim)) w.fx.thrust(r.x, r.y - 18, r.move.dir, h.range, t.color, t.glow, d.power * alpha);
      else w.fx.slash(r.x, r.y - 18, r.move.dir, (h.arc * Math.PI) / 180, h.range * 0.82, d.power * t.width * alpha, t.color, d.anim === 'slashUp' || d.anim === 'heavyUp', t.glow);
    } else if (h.shape === 'circle') {
      const ox = r.x + Math.cos(r.move.dir) * (h.forward || 0), oy = r.y - 10 + Math.sin(r.move.dir) * (h.forward || 0);
      w.fx.ring(ox, oy, 12, h.r, t.glow, 0.42, 8);
    }
    audio.play('swing', { power: Math.min(1.6, 0.6 + d.power * 0.4) * alpha });
  }

  // ------------------------------------------------------------ drawing
  function paintFloor(A, L) {
    const M = L.map;
    const c = document.createElement('canvas'); c.width = A.w; c.height = A.h;
    const g = c.getContext('2d');
    g.fillStyle = M.edge; g.fillRect(0, 0, A.w, A.h);
    const grad = g.createRadialGradient(A.w / 2, A.h / 2, 40, A.w / 2, A.h / 2, A.w * 0.62);
    grad.addColorStop(0, M.floor[0]); grad.addColorStop(1, M.floor[1]);
    g.fillStyle = grad; g.fillRect(A.wall, A.wall, A.w - A.wall * 2, A.h - A.wall * 2);
    let seed = 3 + M.id.length * 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // flagstones: a grid of slabs with uneven edges, darker grout
    const slab = M.id === 'frost' ? 0 : 64;
    if (slab) {
      g.strokeStyle = 'rgba(10,8,6,0.22)'; g.lineWidth = 2;
      for (let y = A.wall; y < A.h - A.wall; y += slab) { g.beginPath(); g.moveTo(A.wall, y); g.lineTo(A.w - A.wall, y + (rnd() - 0.5) * 3); g.stroke(); }
      for (let y = A.wall, r = 0; y < A.h - A.wall; y += slab, r++) for (let x = A.wall + (r % 2) * slab / 2; x < A.w - A.wall; x += slab) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y + slab); g.stroke(); }
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(20,14,10,${(0.05 + rnd() * 0.1).toFixed(2)})`; g.fillRect(A.wall + rnd() * (A.w - A.wall * 2), A.wall + rnd() * (A.h - A.wall * 2), 3 + rnd() * 6, 2 + rnd() * 3); }
    // team halves, faintly tinted
    g.fillStyle = 'rgba(224,89,63,0.06)'; g.fillRect(A.wall, A.wall, A.w / 2 - A.wall, A.h - A.wall * 2);
    g.fillStyle = 'rgba(95,191,168,0.06)'; g.fillRect(A.w / 2, A.wall, A.w / 2 - A.wall, A.h - A.wall * 2);
    g.strokeStyle = M.accent; g.lineWidth = 6;
    g.beginPath(); g.ellipse(A.w / 2, A.h / 2 + 20, A.w * 0.36, A.h * 0.32, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.ellipse(A.w / 2, A.h / 2 + 20, A.w * 0.12, A.h * 0.1, 0, 0, Math.PI * 2); g.stroke();
    // map-specific ground
    if (M.id === 'frost') {
      for (const z of L.hazards) if (z.k === 'ice') {
        const ig = g.createLinearGradient(z.x, z.y, z.x + z.w, z.y + z.h);
        ig.addColorStop(0, 'rgba(230,246,255,0.55)'); ig.addColorStop(0.5, 'rgba(170,215,245,0.4)'); ig.addColorStop(1, 'rgba(230,246,255,0.55)');
        g.fillStyle = ig; roundRect(g, z.x, z.y, z.w, z.h, 60); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; roundRect(g, z.x, z.y, z.w, z.h, 60); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
        for (let i = 0; i < 26; i++) { const x = z.x + rnd() * z.w, y = z.y + rnd() * z.h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) g.lineTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 80); g.stroke(); }
      }
    } else if (M.id === 'lava') {
      // bridges over the lava river: planks between the pools
      for (let i = 0; i + 1 < L.hazards.length; i++) {
        const a = L.hazards[i], b = L.hazards[i + 1], y0 = a.y + a.h, y1 = b.y;
        g.fillStyle = '#4a3424'; g.fillRect(a.x - 24, y0 - 6, a.w + 48, y1 - y0 + 12);
        for (let x = a.x - 24; x < a.x + a.w + 24; x += 22) { g.fillStyle = ['#6a4a30', '#7a5636', '#5e4029'][Math.floor(rnd() * 3)]; g.fillRect(x + 1, y0 - 4, 20, y1 - y0 + 8); }
        g.strokeStyle = '#2a1a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(a.x - 24, y0 - 6); g.lineTo(a.x + a.w + 24, y0 - 6); g.moveTo(a.x - 24, y1 + 6); g.lineTo(a.x + a.w + 24, y1 + 6); g.stroke();
      }
      // scorched cracks
      g.strokeStyle = 'rgba(255,120,40,0.25)'; g.lineWidth = 2;
      for (let i = 0; i < 40; i++) { let x = A.wall + rnd() * (A.w - A.wall * 2), y = A.wall + rnd() * (A.h - A.wall * 2); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    } else if (M.id === 'sky') {
      // the edge of a floating island: clouds below the walls
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(rnd() * A.w, rnd() < 0.5 ? rnd() * A.wall : A.h - rnd() * A.wall, 60 + rnd() * 80, 20 + rnd() * 20, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(255,243,160,0.25)'; g.lineWidth = 2;
      for (let r = 120; r < A.h * 0.5; r += 90) { g.beginPath(); g.ellipse(A.w / 2, A.h / 2, r * 1.5, r, 0, 0, Math.PI * 2); g.stroke(); }
    } else if (M.id === 'ruins') {
      g.fillStyle = 'rgba(60,140,90,0.14)';
      for (let i = 0; i < 60; i++) { g.beginPath(); g.ellipse(A.wall + rnd() * (A.w - A.wall * 2), A.wall + rnd() * (A.h - A.wall * 2), 20 + rnd() * 40, 8 + rnd() * 14, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    }
    // the stone rim
    const stones = M.id === 'frost' ? ['#8aa6bc', '#9ab4c8', '#7a96ac'] : M.id === 'sky' ? ['#d8dce6', '#c8ccd8', '#e6e8ee'] : M.id === 'lava' ? ['#4a3a32', '#5a463c', '#3e302a'] : ['#6b6460', '#77706a', '#5f5854'];
    const block = (x, y, bw, bh) => { g.fillStyle = stones[Math.abs(Math.round(x * 7 + y * 3)) % 3]; g.fillRect(x + 1, y + 1, bw - 2, bh - 2); g.strokeStyle = M.edge; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, bw - 2, bh - 2); };
    for (let y = 0; y < A.wall; y += 20) for (let x = (y / 20) % 2 ? -24 : 0; x < A.w; x += 48) { block(x, y, 48, 20); block(x, A.h - A.wall + y, 48, 20); }
    for (let x = 0; x < A.wall; x += 35) for (let y = A.wall; y < A.h - A.wall; y += 20) { block(x, y, 35, 20); block(A.w - A.wall + x, y, 35, 20); }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(A.wall, A.wall, A.w - A.wall * 2, 14);
    g.strokeStyle = M.edge; g.lineWidth = 4; g.strokeRect(A.wall, A.wall, A.w - A.wall * 2, A.h - A.wall * 2);
    for (const [x, col] of [[A.w * 0.25, TEAM_INFO.a.color], [A.w * 0.75, TEAM_INFO.b.color]]) {
      g.fillStyle = col; g.strokeStyle = '#1a100c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x - 26, 4); g.lineTo(x + 26, 4); g.lineTo(x + 26, 54); g.lineTo(x, 44); g.lineTo(x - 26, 54); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f5d48a'; g.beginPath(); g.arc(x, 24, 7, 0, Math.PI * 2); g.fill();
    }
    // shadows of the cover pieces
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (const o of L.solids) { if (o.k === 'wall') g.fillRect(o.x + 6, o.y + o.h - 4, o.w, 16); else { g.beginPath(); g.ellipse(o.x + 6, o.y + 4, o.r * 1.05, o.r * 0.5, 0, 0, Math.PI * 2); g.fill(); } }
    return c;
  }
  function roundRect(g, x, y, ww, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); }

  // living hazards on top of the floor: lava breathes and bubbles, the void swirls
  function drawHazards(t) {
    for (const z of w.map.hazards) {
      if (z.k === 'lava') {
        ctx.save();
        const lg = ctx.createLinearGradient(z.x, z.y, z.x + z.w, z.y);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + z.y * 0.01);
        lg.addColorStop(0, '#7a1c0c'); lg.addColorStop(0.5, `rgb(${230 + 25 * pulse | 0},${110 + 40 * pulse | 0},40)`); lg.addColorStop(1, '#7a1c0c');
        ctx.fillStyle = lg; roundRect(ctx, z.x, z.y, z.w, z.h, 18); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const fy = z.y + ((t * 40 + i * 47) % z.h), fx = z.x + z.w * (0.2 + 0.6 * ((i * 0.37) % 1)) + Math.sin(t * 3 + i) * 10;
          ctx.fillStyle = `rgba(255,220,120,${0.25 + 0.2 * Math.sin(t * 5 + i)})`; ctx.beginPath(); ctx.ellipse(fx, fy, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = '#2a0e06'; ctx.lineWidth = 4; roundRect(ctx, z.x, z.y, z.w, z.h, 18); ctx.stroke();
        if (Math.random() < 0.08) w.particles.spawn({ x: z.x + Math.random() * z.w, y: z.y + Math.random() * z.h, vx: 0, vy: -40, life: 0.8, size: 3, size2: 0.5, color: '#ffb35a', drag: 1, grav: -60, glow: true });
      } else if (z.k === 'void') {
        ctx.save();
        const vg = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
        vg.addColorStop(0, '#02010a'); vg.addColorStop(0.7, '#120a30'); vg.addColorStop(1, 'rgba(60,40,140,0)');
        ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r / 1.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(180,160,255,0.5)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const a = t * (0.8 + i * 0.3) + i * 2; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * (0.4 + i * 0.2), z.r * (0.4 + i * 0.2) / 1.4, 0, a, a + 2.2); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(230,220,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r / 1.4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else if (z.k === 'ice' && Math.random() < 0.05) {
        w.particles.spawn({ x: z.x + Math.random() * z.w, y: z.y + Math.random() * z.h, vx: 0, vy: 0, life: 0.6, size: 3, size2: 0.2, color: '#ffffff', drag: 1, glow: true });
      }
    }
  }
  // cover: pillars, broken walls, rocks and crystals, drawn standing (sorted with the fighters)
  function drawSolid(o) {
    const M = w.map.map;
    ctx.save();
    if (o.k === 'wall') {
      const hgt = 70;
      ctx.fillStyle = '#3c4050'; ctx.fillRect(o.x, o.y - hgt, o.w, o.h + hgt);
      ctx.fillStyle = '#6a7080'; ctx.fillRect(o.x, o.y - hgt, o.w, o.h);
      ctx.strokeStyle = '#1c1f28'; ctx.lineWidth = 3; ctx.strokeRect(o.x, o.y - hgt, o.w, o.h + hgt);
      ctx.strokeStyle = 'rgba(20,22,30,0.5)'; ctx.lineWidth = 2;
      for (let y = o.y - hgt + o.h + 18; y < o.y + o.h; y += 18) { ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x + o.w, y); ctx.stroke(); }
      for (let x = o.x + 30; x < o.x + o.w; x += 44) { ctx.beginPath(); ctx.moveTo(x, o.y - hgt + o.h); ctx.lineTo(x, o.y + o.h); ctx.stroke(); }
      // a broken top edge
      ctx.fillStyle = M.edge; ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.6, o.y - hgt); ctx.lineTo(o.x + o.w * 0.7, o.y - hgt + 14); ctx.lineTo(o.x + o.w * 0.82, o.y - hgt); ctx.closePath(); ctx.fill();
    } else {
      const r = o.r, hgt = o.k === 'pillar' ? r * 3.2 : o.k === 'crystal' ? r * 2.6 : r * 1.3;
      if (o.k === 'crystal') {
        const cg = ctx.createLinearGradient(o.x - r, 0, o.x + r, 0);
        cg.addColorStop(0, '#9fd2f0'); cg.addColorStop(0.5, '#eaf8ff'); cg.addColorStop(1, '#6aa8d0');
        ctx.fillStyle = cg; ctx.strokeStyle = '#2a4a68'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(o.x - r, o.y); ctx.lineTo(o.x - r * 0.7, o.y - hgt * 0.7); ctx.lineTo(o.x, o.y - hgt); ctx.lineTo(o.x + r * 0.6, o.y - hgt * 0.75); ctx.lineTo(o.x + r, o.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - r * 0.2, o.y - 6); ctx.lineTo(o.x, o.y - hgt + 6); ctx.stroke();
      } else if (o.k === 'rock') {
        ctx.fillStyle = '#4a3a32'; ctx.strokeStyle = '#1a0c08'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(o.x - r, o.y); ctx.quadraticCurveTo(o.x - r * 1.1, o.y - hgt, o.x - r * 0.2, o.y - hgt * 1.1); ctx.quadraticCurveTo(o.x + r * 1.1, o.y - hgt, o.x + r, o.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,120,40,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - r * 0.4, o.y - 4); ctx.lineTo(o.x - r * 0.1, o.y - hgt * 0.6); ctx.lineTo(o.x + r * 0.3, o.y - hgt * 0.8); ctx.stroke();
      } else {
        const sky = M.id === 'sky';
        const pg = ctx.createLinearGradient(o.x - r, 0, o.x + r, 0);
        pg.addColorStop(0, sky ? '#b8bcc8' : '#5f5854'); pg.addColorStop(0.45, sky ? '#f2f2f6' : '#8a827a'); pg.addColorStop(1, sky ? '#9aa0b0' : '#4a4440');
        ctx.fillStyle = pg; ctx.strokeStyle = M.edge; ctx.lineWidth = 3;
        ctx.fillRect(o.x - r * 0.78, o.y - hgt, r * 1.56, hgt); ctx.strokeRect(o.x - r * 0.78, o.y - hgt, r * 1.56, hgt);
        ctx.fillStyle = sky ? '#e6e8ee' : '#77706a';
        ctx.fillRect(o.x - r, o.y - hgt - 12, r * 2, 14); ctx.strokeRect(o.x - r, o.y - hgt - 12, r * 2, 14);
        ctx.fillRect(o.x - r, o.y - 12, r * 2, 14); ctx.strokeRect(o.x - r, o.y - 12, r * 2, 14);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(o.x + i * r * 0.4, o.y - hgt + 4); ctx.lineTo(o.x + i * r * 0.4, o.y - 14); ctx.stroke(); }
        if (sky) { ctx.fillStyle = 'rgba(255,243,160,0.8)'; ctx.beginPath(); ctx.arc(o.x, o.y - hgt - 22, 6 + Math.sin(w.time * 3) * 1.5, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.restore();
  }

  function drawFighter(f, isMe) {
    const team = isMe ? w.team : f.team;
    const col = TEAM_INFO[team].color;
    ctx.fillStyle = 'rgba(12,8,6,0.4)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.75; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, 26, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    const look = isMe ? null : (f.look || {});
    const parts = isMe ? sprites.heroParts : app.heroPartsFor(look.a, look.r, look.wg);
    const weapon = isMe ? sprites.weapon : sprites['weapon_' + (getItem(look.w)?.id || 'w_rust_blade')];
    const down = isMe ? f.dead : (f.dead || f.goneT > GONE_AFTER);
    drawHero(renderer, parts, weapon, {
      x: f.x, y: f.y - (isMe ? f.leapZ || 0 : 0), flip: f.flip, time: w.time, walkT: f.walkT, moving: f.moving, wp: playerPose(f, w.time), type: f.wtype, scale: 0.95,
      dashing: f.dashT > 0 || !!f.rush, flash: f.flash || 0, alpha: f.blink && f.dashT > 0 ? 0.15 : (!isMe && f.goneT > GONE_AFTER ? 0.4 : 1), deathT: down ? (f.deathT || 0.4) : null, vx: f.vx || 0, speed: 230,
    });
    if (!isMe) drawBrands(ctx, f, w.time);
    if (isMe) { drawGuard(ctx, f, w.time); drawUniqueAura(ctx, f, w.time); }
    else if (f.gd && !down) drawGuard(ctx, { x: f.x, y: f.y, facing: f.facing, guard: { guarding: true, guardT: 1, armed: false, parryFx: 0, blockFx: 0, meter: GUARD.meterMax, counterT: 0, breakT: 0 } }, w.time);
    const name = isMe ? store.get().story.name : (f.name || 'นักล่า');
    ctx.font = '700 15px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = isMe ? '#f5d48a' : team === w.team ? '#9fe0a0' : '#ffb3a4';
    ctx.strokeText(name, f.x, f.y - 112); ctx.fillText(name, f.x, f.y - 112);
    { const st0 = store.get(); drawTitleLine(ctx, f.x, f.y - 129, isMe ? st0.titles?.equipped : f.title, isMe ? badgeTier(st0) : f.badge); }
    const bw = 70, frac = Math.max(0, f.hp / (f.maxHp || 1));
    ctx.fillStyle = 'rgba(20,12,9,0.85)'; ctx.fillRect(f.x - bw / 2 - 1, f.y - 104, bw + 2, 8);
    ctx.fillStyle = team === w.team ? '#7fc77a' : '#c2412f'; ctx.fillRect(f.x - bw / 2, f.y - 103, bw * frac, 6);
  }

  function render() {
    if (!w) return;
    const v = renderer.view, A = w.A;
    renderer.screenSpace();
    ctx.fillStyle = '#120d0b'; ctx.fillRect(0, 0, v.w, v.h);
    renderer.worldSpace();
    const key = `${A.w}x${A.h}:${w.map.id}`;
    if (key !== floorKey) { floor = paintFloor(A, w.map); floorKey = key; }
    ctx.drawImage(floor, 0, 0);
    drawHazards(w.time);
    for (const [x, y] of [[A.wall, A.wall], [A.w - A.wall, A.wall]]) renderer.sprite(sprites.v_pillar, x, y + 40, {});
    drawZones(ctx, w.zones, w.time);
    drawSnares(ctx, w.snares, w.time);
    w.sk.drawGround(ctx, w.time);
    drawKitGround(renderer, w.raceSkill, w.time);
    const list = w.spectate ? [] : [{ f: w.player, me: true }];
    for (const f of w.fighters.values()) if (f.seen && f.x != null) list.push({ f, me: false });
    for (const o of w.map.solids) list.push({ f: { y: o.k === 'wall' ? o.y + o.h : o.y }, solid: o });
    list.sort((a, b) => a.f.y - b.f.y);
    for (const o of list) if (o.solid) drawSolid(o.solid); else drawFighter(o.f, o.me);
    for (const [x, y] of [[A.wall, A.h - A.wall], [A.w - A.wall, A.h - A.wall]]) renderer.sprite(sprites.v_pillar, x, y + 40, {});
    drawKitAir(renderer, w.raceSkill, w.player, w.time);
    for (const s of w.shots) drawShot(ctx, s, w.time);
    for (const s of w.ghostShots) drawShot(ctx, s, w.time);
    drawClashWorld();
    w.sk.drawAir(ctx, w.time);
    w.fx.drawWorld(ctx);
    w.particles.draw(ctx);
    w.fx.drawNumbers(ctx);
    renderer.screenSpace();
    if (app.vignette) ctx.drawImage(app.vignette, 0, 0, v.w, v.h);
    drawClash(v);
    drawUltScreen(ctx, w, v, w.spectate ? null : heroCutIn);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (w.phase === 'countdown') {
      const n = Math.max(1, Math.ceil(PVP.countdown - w.phaseT));
      ctx.font = '400 72px "Chonburi", serif';
      ctx.lineWidth = 8; ctx.strokeStyle = '#1a100c'; ctx.fillStyle = '#f5d48a';
      ctx.strokeText(String(n), v.w / 2, v.h * 0.4); ctx.fillText(String(n), v.w / 2, v.h * 0.4);
    } else if (w.phase === 'waiting') {
      ctx.font = '700 20px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillStyle = '#f3e6c8';
      const here = [...w.fighters.values()].filter((f) => f.seen).length + (w.spectate ? 0 : 1), all = w.fighters.size + (w.spectate ? 0 : 1);
      ctx.fillText(`รอผู้เล่นเข้าสนาม ${here}/${all}…`, v.w / 2, v.h * 0.35);
    }
    if (w.spectate) {
      ctx.font = '700 15px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillStyle = '#c8d2ff'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,7,16,0.85)';
      const txt = `กำลังชม · ${TEAM_INFO.a.name} ${w.score.a} - ${w.score.b} ${TEAM_INFO.b.name} · กด Esc เพื่อออก`;
      ctx.strokeText(txt, v.w / 2, 26); ctx.fillText(txt, v.w / 2, 26);
    } else if (w.phase === 'fight' && w.player.dead && w.size > 1) {
      ctx.font = '700 16px "Bai Jamjuree", system-ui, sans-serif'; ctx.fillStyle = '#ffb3a4';
      ctx.fillText('คุณถูกล้ม — รอจบยก', v.w / 2, v.h * 0.3);
    }
  }

  return {
    enter(params) {
      app.particles.clear();
      app.refreshHeroSprites();
      w = makeWorld(params);
      resetFighter();
      w.unsub.push(params.room.on('match', onMessage));
      audio.music('duel'); audio.setIntensity(1);
      if (w.spectate) {
        input.setEnabled(true); input.reset();         // only Esc / pause is read (to stop watching)
        app.hud.hide();
        params.room.presence({ v: PROTOCOL, spec: 1, n: store.get().story.name });
        return;
      }
      input.setEnabled(true); input.reset();
      app.hud.show(w); app.hud.setMode('arena');
      params.room.presence({ ...fighterPresence(w.player, w.look, 'ready'), mt: null });
      // the host lists the match while it runs, so others in the village can watch it
      if (w.amHost && w.channel) {
        const id = w.channel.replace(/[^a-z0-9]/g, '').slice(-16);
        if (id.length >= 4) app.online.publish({ pr: { i: id, m: w.mode, t: w.title, n: w.roster.a.length + w.roster.b.length, p: 1, ch: w.channel, ro: w.roster } });
      }
    },
    exit() {
      if (w) { if (w.amHost) app.online.publish({ pr: null }); for (const u of w.unsub) u(); w.room.leave(); }
      input.setEnabled(false); app.hud.hide(); app.hud.setMode('dungeon'); audio.stopMusic();
      w = null;
    },
    update, render,
    get world() { return w; },
    // I give up: I record a loss; the others see my hero leave (down for the rest of the match)
    forfeit() { if (!w || w.ended || w.spectate) return; send({ k: 'forfeit' }); finishMatch('lose', 'forfeit'); },
    stopWatching() { if (w?.spectate && !w.ended) finishMatch('cancel', 'left'); },
    snapshot() {
      if (!w) return null;
      return {
        mode: w.mode, map: w.map.id, arena: { w: w.A.w, h: w.A.h }, phase: w.phase, round: w.round, score: { ...w.score }, team: w.team, host: w.amHost, ended: w.ended, spectate: !!w.spectate,
        me: { x: Math.round(w.player.x), y: Math.round(w.player.y), hp: Math.ceil(w.player.hp), maxHp: w.player.maxHp, dead: w.player.dead },
        fighters: [...w.fighters.values()].map((f) => ({ peer: f.peer, team: f.team, name: f.name || null, x: Math.round(f.x || 0), y: Math.round(f.y || 0), hp: f.hp, maxHp: f.maxHp, ko: !!f.ko, seen: f.seen })),
        remote: (() => { const f = [...w.fighters.values()].find((x) => x.team !== w.team && x.seen); return f ? { x: Math.round(f.x || 0), y: Math.round(f.y || 0), hp: f.hp, maxHp: f.maxHp } : null; })(),
        perfects: w.perfects, clash: w.clash ? { mine: w.clash.mine, theirs: w.clash.theirs, t: Math.round(w.clash.t * 10) / 10 } : null, clashes: w.clashes, clashWins: w.clashWins, parries: w.parries || 0,
        guard: { guarding: w.player.guard.guarding, meter: Math.round(w.player.guard.meter), stagger: w.player.guard.staggerT > 0 },
      };
    },
  };
}
