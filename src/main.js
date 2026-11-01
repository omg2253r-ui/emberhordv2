// Entry point: builds the app context, rasterizes art, restores the save and runs the scene loop.
import { castSpec } from './battle/skillCast.js';
import { createUltState } from './battle/ultimate.js';
import { getSkill as getSkillDef, rankValues as skillRankValues } from './data/skills.js';
import { BOSSES, ELEMENTS } from './data/bestiary.js';
import { openBestiary } from './ui/bestiaryUi.js';
import { openUltCodex } from './ui/ultCodexUi.js';
import { rigOf, rigParts } from './art/rig.js';
import { critterOf, critterParts } from './art/critterRig.js';
import { openProfile } from './ui/profileUi.js';
import { readCard } from './systems/profile.js';
import { createRenderer } from './engine/renderer.js';
import { getQuality, setQuality, cleanQuality } from './config/quality.js';
import { createInput } from './engine/input.js';
import { createLoop } from './engine/loop.js';
import { createParticles } from './engine/particles.js';
import { rasterize } from './engine/assets.js';
import { createAudio } from './audio/audio.js';
import { createRng } from './core/rng.js';
import { createStore } from './core/store.js';
import { createNewState, cloneState } from './core/state.js';
import { createSaveStore, browserStorage } from './persistence/save.js';
import { ITEMS, getItem } from './data/items.js';
import { ENEMIES } from './data/enemies.js';
import { validateDropTable } from './systems/loot.js';
import * as ART from './art/sprites.js';
import * as CREATURES from './art/creatures.js';
import * as OBJ from './art/objects.js';
import { heroParts, portraits, heroPortrait, DEFAULT_LOOK } from './art/hero.js';
import { itemIconSvg, goldIconSvg, sparkIconSvg, svgDataUri } from './art/icons.js';
import { EGY_SKIN_IDS, egySkinIconSvg, egyGoldSvg, egySparkSvg } from './art/egyptIcons.js';
import { weaponSprite } from './art/weapons.js';
import { wingSprite } from './art/wings.js';
import { PET_ART } from './art/pets.js';
import { GOD_ART } from './art/gods.js';
import { RACES } from './data/races.js';
import { createStoryUi } from './ui/storyUi.js';
import { createAwakenUi } from './ui/raceUi.js';
import { awakenRace, rerollRace } from './systems/race.js';
import { nextCampScene } from './systems/story.js';
import { doorsOf } from './systems/dungeon.js';
import { cleanHeroName } from './core/state.js';
import { createScreens } from './ui/screens.js';
import { setTipState } from './ui/itemTip.js';
import { createHud } from './ui/hud.js';
import { createToasts } from './ui/toast.js';
import { createCampScene } from './scenes/campScene.js';
import { createDungeonScene } from './scenes/dungeonScene.js';
import { createVillageScene } from './scenes/villageScene.js';
import { createMatchScene } from './scenes/matchScene.js';
import { createCoopScene } from './scenes/coopScene.js';
import { ZONE_ART } from './art/zoneCreatures.js';
import { getZone } from './data/zones.js';
import { ALL_ENEMIES } from './data/enemies.js';
import { openZoneBoard, zoneLock } from './ui/zonesUi.js';
import { openCrafting } from './ui/craftUi.js';
import { openPatchNotes } from './ui/patchNotes.js';
import { openSaveTransfer } from './ui/saveTransferUi.js';
import { openLayoutEditor } from './ui/hudLayout.js';
import { openAccount, openHeroChooser } from './ui/accountUi.js';
import { createCloud, cloudAvailable, cloudError } from './net/cloud.js';
import { exportCode, importCode } from './persistence/transfer.js';
import { sha256 } from './persistence/integrity.js';
import { hasUnseenNotes, markSeen } from './data/changelog.js';
import { openCosmos } from './ui/cosmosUi.js';
import { INFINITE, infiniteZone, entriesLeft, dayKey } from './data/infinite.js';
import { towerZone, towerLock, startFloors } from './data/tower.js';
import { openTower, towerResult } from './ui/towerUi.js';
import { checkTitles } from './systems/titles.js';
import { getTitle } from './data/titles.js';
import { getArtifact } from './data/artifacts.js';
import { createGuildSession } from './online/guild.js';
import { createRooms } from './online/rooms.js';
import { createTradeLink } from './online/tradeLink.js';
import { openTradeUi } from './ui/tradeUi.js';
import { MODES, TEAM_INFO } from './online/match.js';
import { createVillageUi } from './ui/villageUi.js';
import { VILLAGE_ART } from './art/village.js';
import { createNet } from './net/net.js';
import { createOnline } from './online/online.js';
import { lookOf } from './online/protocol.js';
import { h, itemImg, glyph, artifactImg } from './ui/dom.js';
import { luckLeftMs, fmtLuckTime } from './systems/luck.js';
import { LUCK } from './data/luck.js';
import { armAutoFullscreen } from './ui/fullscreen.js';
import { openDungeonBag } from './ui/dungeonBag.js';
import { offerTutorial, openTutorial, markTutorialPending } from './ui/tutorial.js';

const canvas = document.getElementById('scene');
const uiRoot = document.getElementById('ui');

const params = new URLSearchParams(location.search);
// Development hosts only: a fixed RNG seed (?seed=) and save re-signing for the automated tests. On the public
// site a seed would let players predict drops and summons, so it is ignored there.
const DEV_HOST = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const seed = (DEV_HOST && Number(params.get('seed'))) || ((crypto.getRandomValues(new Uint32Array(1))[0] ^ Date.now()) >>> 0);
// ?net=local joins other tabs of this browser (development and tests), ?net=off stays offline.
const netMode = params.get('net') === 'local' ? 'local' : params.get('net') === 'mesh' ? 'mesh' : params.get('net') === 'off' ? 'offline' : 'auto';
// ?slot=b keeps a separate save, so two test tabs can be two different heroes.
const saveSlot = /^[a-z0-9]{1,8}$/.test(params.get('slot') || '') ? params.get('slot') : '';

const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
const particles = createParticles();
const { storage, persistent } = browserStorage();
const saves = createSaveStore(storage, saveSlot);
// every local save is noted so the cloud copy can follow it (see "cloud saves" below)
const rawSave = saves.save.bind(saves);
saves.save = (st) => { const r = rawSave(st); if (r.ok) cloudTouch(); return r; };
const store = createStore(createNewState(), saves);
setTipState(() => store.get());
const rng = createRng(seed);

const app = {
  renderer, input, audio, particles, rng, store, sprites: {}, vignette: null,
  gameActive: false, // true once the player pressed New Game or Continue
  touch: window.matchMedia('(pointer: coarse)').matches,
  toast: () => {},
};
app.toast = createToasts(uiRoot);
const screens = createScreens(uiRoot, app);
app.hud = createHud(uiRoot, app);
const story = createStoryUi(uiRoot, app);
const awaken = createAwakenUi(uiRoot, app);
app.rooms = createRooms(app);
app.guild = createGuildSession(app);
app.village = createVillageUi(uiRoot, app);
app.village.watchRooms();
// Until the network answers, the game is an offline single-player game; online features light up after.
app.online = createOnline(app, offlineNetPlaceholder());
function offlineNetPlaceholder() {
  const dead = { emit: async () => {}, on: () => () => {}, presence: async () => {}, peers: () => [], onPeers: () => () => {}, connected: () => false, leave: async () => {} };
  return { kind: 'offline', mode: 'offline', online: false, reason: 'กำลังเชื่อมต่อ…', me: { peer: 'me', id: null }, canSend: false, lobby: dead, join: async () => dead, onSendRefused: () => () => {}, close() {} };
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
app.reducedMotion = reducedMotion.matches;
const PORTRAITS = portraits();
const portraitCache = new Map();
// 'hero' resolves to the portrait of the current bloodline.
app.portraitUri = (key) => {
  const rid = key === 'hero' ? store.get().race?.id : null;
  const race = rid && RACES[rid] ? rid : null;   // an unknown race id falls back to the default hero portrait
  const k = race ? `hero_${race}` : key;
  if (!portraitCache.has(k)) portraitCache.set(k, svgDataUri(race ? heroPortrait(RACES[race].look) : (PORTRAITS[key] || PORTRAITS.hero)));
  return portraitCache.get(k);
};
const spriteUriCache = new Map();
app.spriteUri = (key) => {
  if (!spriteUriCache.has(key)) spriteUriCache.set(key, svgDataUri((ZONE_ART[key] || GOD_ART[key] || PET_ART[key] || VILLAGE_ART[key])?.().svg || ''));
  return spriteUriCache.get(key);
};
const petUriCache = new Map();
app.petUri = (id) => {
  if (!petUriCache.has(id)) {
    // v9.0.1: an id without art (removed / renamed pet in an old save) shows a placeholder instead of throwing and breaking the whole panel
    const art = PET_ART['pet_' + id];
    let svg = '';
    try { svg = art ? art().svg : ''; } catch (err) { console.error('pet art failed', id, err); }
    petUriCache.set(id, svgDataUri(svg || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#232a4a" stroke="#7492ff" stroke-width="2"/><text x="32" y="42" text-anchor="middle" font-size="28" fill="#aab8f0">?</text></svg>'));
  }
  return petUriCache.get(id);
};
app.racePortraitUri = (raceId) => {
  const k = `race_${raceId}`;
  if (!portraitCache.has(k)) portraitCache.set(k, svgDataUri(heroPortrait(RACES[raceId]?.look || DEFAULT_LOOK)));
  return portraitCache.get(k);
};
// Quality (ต่ำ/กลาง/สูง): canvas resolution, particles, glow, shake and the network profile follow one setting.
function applyQuality(id) {
  const q = setQuality(cleanQuality(id));
  renderer.setMaxDpr(q.maxDpr);
  renderer.setShakeScale(q.shake);
  particles.setScale(reducedMotion.matches ? Math.min(0.4, q.particles) : q.particles);
  particles.setGlow(q.glow && !reducedMotion.matches);
  renderer.setGlow(q.glow);
  buildVignette?.();
}
app.applyQuality = applyQuality;

// ---------------------------------------------------------------- art
function iconSpec(svg) {
  return { svg: svg.replace('<svg ', '<svg width="64" height="64" '), w: 64, h: 64, ax: 32, ay: 32 };
}
const ARMOR_LOOK = (def) => (def ? { ...def.art, main: def.art.main === "#231a17" ? "#2e2420" : def.art.main, trim: def.art.trim === "#e0b45a" ? "#c2412f" : def.art.trim } : {});
function artSpecs() {
  const specs = {
    mossling: CREATURES.mossling(), thorn_imp: CREATURES.thornImp(), thornback_boar: CREATURES.thornbackBoar(),
    ember_imp: CREATURES.emberImp(), cinder_beetle: CREATURES.cinderBeetle(), furnace_golem: CREATURES.furnaceGolem(),
    tree0: ART.tree(0), tree1: ART.tree(1), tree2: ART.tree(2), bush: ART.bush(), stone: ART.stone(), mushroom: ART.mushroom(),
    grass: ART.grass(), flowers: ART.flowers(), log: ART.log(), tent: ART.tent(), anvil: ART.anvil(), crates: ART.crates(), lantern: ART.lantern(),
    deadTree: ART.deadTree(), rockPile: ART.rockPile(), emberRock: ART.emberRock(),
    chest: OBJ.chest(false), chest_open: OBJ.chest(true), chest_rich: OBJ.chest(false, true), chest_rich_open: OBJ.chest(true, true),
    bonfire: OBJ.bonfireBase(), signpost: OBJ.signpost(), altar: OBJ.altar(), desk: OBJ.desk(), pedestal: OBJ.pedestalLetter(),
    dart_turret: OBJ.dartTurret(), boss_seal: OBJ.bossSeal(), lek: OBJ.lekNpc(),
    icon_gold: iconSpec(goldIconSvg()), icon_spark: iconSpec(sparkIconSvg()),
  };
  for (const [k, fn] of Object.entries(PET_ART)) specs[k] = fn();
  for (const [k, fn] of Object.entries(VILLAGE_ART)) specs[k] = fn();
  for (const [k, fn] of Object.entries(ZONE_ART)) specs[k] = { ...fn(), light: true };
  for (const [k, fn] of Object.entries(GOD_ART)) specs[k] = fn();
  for (const k of ['mossling', 'thorn_imp', 'thornback_boar', 'ember_imp', 'cinder_beetle', 'furnace_golem']) specs[k] = { ...specs[k], light: true };
  // bosses: rim light in their element's colour, grain and bloom (see engine/assets.js bakeLight)
  for (const b of BOSSES) if (specs[b.id]) specs[b.id] = { ...specs[b.id], light: { key: '#fff0cc', rim: ELEMENTS[b.el]?.glow || '#ffd08a', boss: true } };
  for (const k of Object.keys(PET_ART)) specs[k] = { ...specs[k], light: true };
  for (const def of Object.values(ITEMS)) {
    specs['icon_' + def.id] = iconSpec(itemIconSvg(def.id));
    if (def.category === 'weapon') specs['weapon_' + def.id] = weaponSprite(def.art);
    if (def.category === 'weapon' && def.art.off) specs['weapon_' + def.id + '_off'] = weaponSprite({ ...def.art, ...def.art.off });
    if (def.category === 'wings') specs['wings_' + def.id] = wingSprite(def.art);
  }
  // v9.3: Egyptian look for the loot that lies on the ground inside the pyramid (z13), see battle/drops.js
  specs.icon_egy_gold = iconSpec(egyGoldSvg()); specs.icon_egy_spark = iconSpec(egySparkSvg());
  for (const id of EGY_SKIN_IDS) specs['icon_egy_' + id] = iconSpec(egySkinIconSvg(id));
  // the plain hero; armour looks and bloodline heads are drawn when first needed (app.ensureHero)
  for (const [part, spec] of Object.entries(heroParts({}))) specs[`hero_none_${part}`] = spec;
  return specs;
}

async function loadArt() {
  const specs = artSpecs();
  const keys = Object.keys(specs);
  let done = 0;
  await Promise.all(keys.map(async (k) => {
    try { app.sprites[k] = await rasterize(specs[k]); }
    catch (e) { throw new Error(`วาดภาพ "${k}" ไม่สำเร็จ (${e.message || e})`); }
    done++; screens.loading.progress(done / keys.length);
  }));
  // twin blades with a different off-hand blade carry it on the main sprite
  for (const def of Object.values(ITEMS)) if (def.category === 'weapon' && app.sprites['weapon_' + def.id + '_off']) app.sprites['weapon_' + def.id].off = app.sprites['weapon_' + def.id + '_off'];
}

// Jointed monsters (art/rig.js): drawn part by part the first time they are needed.
const rigPending = new Map();
app.rigs = {};
app.critters = {};
// v8 critters (art/critterRig.js): the small monsters, part by part, drawn the first time they appear
function ensureCritter(id) {
  const def = critterOf(id);
  if (!def) return Promise.resolve(null);
  if (app.critters[id]) return Promise.resolve(app.critters[id]);
  if (!rigPending.has(id)) {
    const specs = critterParts(def);
    rigPending.set(id, Promise.all(Object.entries(specs).map(([k, sp]) => rasterize({ ...sp, light: { key: '#fff0cc', rim: def.c.light } }).then((img) => [k, img])))
      .then((list) => { app.critters[id] = { parts: Object.fromEntries(list), def }; return app.critters[id]; })
      .catch(() => null));
  }
  return rigPending.get(id);
}
app.ensureRig = (id) => {
  const def = rigOf(id);
  if (!def) return ensureCritter(id);
  if (app.rigs[id]) return Promise.resolve(app.rigs[id]);
  if (!rigPending.has(id)) {
    const specs = rigParts(def);
    rigPending.set(id, Promise.all(Object.entries(specs).map(([k, sp]) => rasterize({ ...sp, light: k === 'weapon' ? { key: '#ffffff', rim: def.c.glow } : { key: '#fff0cc', rim: def.c.rim || '#8ab8ff' } }).then((img) => [k, img])))
      .then((list) => { const parts = Object.fromEntries(list); app.rigs[id] = { parts, def, hold: specs.weapon.meta.hold, tip: specs.weapon.meta.tip }; return app.rigs[id]; })
      .catch(() => null));
  }
  return rigPending.get(id);
};

const HERO_PARTS = ['legBack', 'legFront', 'body', 'head', 'armBack', 'armFront', 'scarf', 'collar'];
// v7: 40+ armours × 36 bloodlines is too many pictures to draw at boot. Each armour look and each
// armour+bloodline head is drawn the first time it is needed and kept; until then the plain parts stand in.
const pending = new Map();
const partsCache = new Map();
function lazySprite(key, make) {
  if (app.sprites[key]) return Promise.resolve(app.sprites[key]);
  if (!pending.has(key)) {
    pending.set(key, rasterize(make()).then((img) => { app.sprites[key] = img; partsCache.clear(); return img; }).catch(() => null));
  }
  return pending.get(key);
}
function armorLookOf(armorId) { const def = armorId && getItem(armorId); return def && def.category === 'armor' ? ARMOR_LOOK(def) : null; }
app.ensureHero = (armorId, raceId) => {
  const look = armorLookOf(armorId);
  const id = look ? armorId : 'none';
  const jobs = [];
  if (look) for (const part of HERO_PARTS) jobs.push(lazySprite(`hero_${id}_${part}`, () => heroParts(look)[part]));
  const race = raceId && RACES[raceId];
  if (race) jobs.push(lazySprite(`hero_${id}_head_${raceId}`, () => heroParts(look || {}, race.look).head));
  return Promise.all(jobs);
};
function assembleParts(armorId, raceId, wingsId) {
  const look = armorId && app.sprites[`hero_${armorId}_body`] ? armorId : 'none';
  const parts = Object.fromEntries(HERO_PARTS.map((p) => [p, app.sprites[`hero_${look}_${p}`] || app.sprites[`hero_none_${p}`]]));
  if (raceId && app.sprites[`hero_${look}_head_${raceId}`]) parts.head = app.sprites[`hero_${look}_head_${raceId}`];
  else if (raceId && app.sprites[`hero_none_head_${raceId}`]) parts.head = app.sprites[`hero_none_head_${raceId}`];
  parts.wings = (wingsId && app.sprites['wings_' + wingsId]) || null;
  return parts;
}
app.refreshHeroSprites = () => {
  const st = store.get();
  const apply = () => {
    const s2 = store.get();
    app.sprites.heroParts = assembleParts(s2.equipment.armor?.id, s2.race?.id, s2.equipment.wings?.id);
    app.sprites.weapon = app.sprites['weapon_' + s2.equipment.weapon.id];
  };
  apply();
  app.ensureHero(st.equipment.armor?.id, st.race?.id).then(apply);
};

// Sprite set for another player's hero (their armour colours and bloodline head).
app.heroPartsFor = (armorId, raceId, wingsId = null) => {
  const key = `${armorId || ''}|${raceId || ''}|${wingsId || ''}`;
  if (!partsCache.has(key)) {
    partsCache.set(key, assembleParts(armorId, raceId, wingsId));
    app.ensureHero(armorId, raceId);          // drawn in the background; the cache is rebuilt when it lands
  }
  return partsCache.get(key);
};

// The Infinite Rift's payout: deepest wave, coins, every artifact (new, levelled up, or turned into coins).
function infiniteResult(res) {
  const inf = res.reward.infinite;
  let close, replaying = false;
  const lock = app.infiniteLock();                       // v8.4: today's entries may be used up
  const label = (r) => (r.kind === 'new' ? 'ใหม่!' : r.kind === 'level' ? `ระดับ ${r.lvl}` : `+${r.gold} เหรียญ`);
  const content = h('div', { class: 'modal panel inf-result', 'data-modal': 'zone-result', 'data-outcome': 'infinite', 'data-wave': inf.wave },
    h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, 'รอยแยกไร้สิ้นสุด'),
    h('h2', {}, res.outcome === 'fallen' ? 'ล้มลงในรอยแยก' : 'ออกจากรอยแยก'),
    h('div', { class: 'inf-wave' }, h('small', { class: 'muted' }, 'ไปได้ถึงคลื่น'), h('b', { class: 'num' }, inf.wave), inf.wave >= inf.best && inf.wave > 0 ? h('span', { class: 'chip ok' }, 'สถิติใหม่') : h('small', { class: 'muted' }, `สถิติ ${inf.best}`)),
    h('div', { class: 'notice ok' }, `ได้รับ ${inf.coins.toLocaleString('th-TH')} เหรียญ · อาร์ติแฟกต์ ${inf.arts.length} ชิ้น`),
    inf.arts.length ? h('div', { class: 'inf-arts' }, inf.arts.map((r) => { const a = getArtifact(r.id); return h('div', { class: `inf-art r-${a.rarity}` }, artifactImg(r.id), h('b', { class: 'rc-text' }, a.name), h('small', {}, label(r))); })) : h('div', { class: 'empty-note' }, 'รอบนี้ยังไม่ได้อาร์ติแฟกต์ ลึกขึ้นอีกนิด ทุก 5 คลื่นมีผู้พิทักษ์ที่ถืออาร์ติแฟกต์เสมอ'),
    h('div', { class: 'kv' },
      h('div', {}, h('span', { class: 'muted' }, 'กำจัด'), h('b', {}, `${res.run.kills} ตัว`)),
      h('div', {}, h('span', { class: 'muted' }, 'เวลา'), h('b', {}, `${Math.floor(res.run.seconds / 60)}:${String(res.run.seconds % 60).padStart(2, '0')}`)),
      h('div', {}, h('span', { class: 'muted' }, 'คอมโบสูงสุด'), h('b', {}, `${res.run.bestCombo} ฮิต`)),
      h('div', {}, h('span', { class: 'muted' }, 'สิทธิ์ที่เหลือวันนี้'), h('b', {}, `${entriesLeft(store.get())} / ${INFINITE.entriesPerDay}`))),
    res.saveOk ? null : h('div', { class: 'notice' }, 'บันทึกเกมไม่สำเร็จ'),
    h('div', { class: 'actions' },
      inf.arts.length ? h('button', { class: 'btn', type: 'button', 'data-action': 'to-cosmos', onclick: () => { close(); setTimeout(() => app.openCosmos(), 50); } }, glyph('cosmos'), 'ใส่อาร์ติแฟกต์') : null,
      h('button', { class: 'btn gold', type: 'button', 'data-action': 'replay', disabled: !!lock, title: lock || '',
        onclick: () => { const why = app.infiniteLock(); if (why) { app.toast(why, 'warn'); return; } replaying = true; close(); app.startInfinite(zoneFrom); } },
        glyph(lock ? 'lock' : 'infinity'), lock || 'เข้ารอยแยกอีกครั้ง'),
      h('button', { class: 'btn primary', type: 'button', 'data-action': 'zone-done', onclick: () => close() }, zoneFrom === 'village' ? 'กลับหมู่บ้าน' : 'กลับค่าย')));
  close = screens.modal(content, { dismissable: false, onClose: () => { if (replaying) return; if (zoneFrom === 'village' && app.online.online) app.enterVillage(); else arriveCamp(null); } });
}

function buildVignette() {
  const v = renderer.view;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(v.w / 2)); c.height = Math.max(1, Math.round(v.h / 2));
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.6);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(8,5,4,0.6)');
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  app.vignette = c;
}

// ---------------------------------------------------------------- scenes
const scenes = { camp: createCampScene(app), battle: createDungeonScene(app), village: createVillageScene(app), match: createMatchScene(app), coop: createCoopScene(app) };
let scene = null, sceneName = '';
const ZONE = { camp: { z: 'camp', b: null }, battle: { z: 'hunt', b: 'hunt' }, village: { z: 'village', b: null }, match: { z: 'arena', b: 'duel' }, coop: { z: 'hunt', b: 'hunt' } };
function switchScene(name, params) {
  if (scene) scene.exit();
  scene = scenes[name]; sceneName = name;
  scene.enter(params || {});
  if (app.gameActive) app.online.publish(ZONE[name]);
  // friend / party / duel requests can be answered at camp and in the village
  app.village.showRequests(name === 'camp' || name === 'village');
}

// ---------------------------------------------------------------- app actions (used by UI)
// Plays any story scenes waiting at camp, one after another, then opens the requested panel.
function runCampStory(then) {
  const id = nextCampScene(store.get());
  if (id) app.playScene(id, () => { screens.renderTop(store.get()); screens.rerender(); runCampStory(then); });
  else then?.();
}

// After the camp story, a hero without a bloodline awakens it (new heroes, and saves from before v3).
function ensureBloodline(then) {
  if (store.get().race?.id) { then?.(); return; }
  awaken.openCeremony('first', () => { screens.renderTop(store.get()); screens.rerender(); then?.(); });
}

function arriveCamp(panel) {
  switchScene('camp');
  audio.music('camp');
  if (!titleTimer) titleTimer = setTimeout(checkAchievements, 900);
  const waiting = !!nextCampScene(store.get()) || !store.get().race?.id;
  screens.showCamp(waiting ? null : panel);
  // บทสอน: a brand-new hero is asked once, after the first story and the bloodline awakening (see ui/tutorial.js)
  if (waiting) { screens.closePanel(true); runCampStory(() => ensureBloodline(() => offerTutorial(app, () => { if (panel) screens.openPanel(panel); }))); }
  else if (!hasUnseenNotes()) offerTutorial(app);   // left the game before answering: ask again, but never over the patch notes
}

// ------------------------------------------------------------ cloud saves (เซฟออนไลน์)
// One account → one hero in every app and browser. Local saves stay the source of truth while playing; the cloud
// copy follows them (debounced, and right away when the page is hidden). When another device saved something
// newer, the player chooses which hero to keep.
const cloud = createCloud({ storage: saveSlot ? memoryCloudStorage() : storage });
const cloudOn = cloudAvailable();
let cloudTimer = null, cloudDirty = 0, cloudPushing = false, cloudHold = false;
function memoryCloudStorage() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
// what the hero is, ignoring when it was saved: a visit that changed nothing does not count as progress
const contentHash = (st) => sha256(JSON.stringify({ ...st, updatedAt: 0 }));
function cloudTouch() {
  if (!cloudOn || !cloud.account() || cloudHold) return;
  const now = Date.now();
  if (!cloudDirty) cloudDirty = now;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => cloudPush(), Math.max(0, Math.min(8000, 30000 - (now - cloudDirty))));
}
async function cloudPush({ force = false, keepalive = false } = {}) {
  clearTimeout(cloudTimer); cloudTimer = null;
  if (!cloudOn || !cloud.account() || cloudHold || !saves.exists()) return { ok: false, error: 'session' };
  if (cloudPushing && !keepalive) { cloudTouch(); return { ok: false, error: 'rate_limited' }; }
  cloudDirty = 0;
  const st = store.get(), hsh = contentHash(st);
  if (!force && hsh === cloud.account().hash) return { ok: true };          // nothing new since the last sync
  cloudPushing = true;
  const code = exportCode(st);
  const r = await cloud.push(code, { force, keepalive: keepalive && code.length < 60000 });
  cloudPushing = false;
  if (r.updatedAt && !r.conflict) cloud.markSynced(r.updatedAt, hsh);
  if (r.conflict) {
    // nothing played here since the last sync: simply take the newer hero from the account
    if (contentHash(store.get()) === cloud.account()?.hash) { adoptCloud(r.save, r.updatedAt, 'โหลดเซฟล่าสุดจากบัญชีแล้ว'); return { ok: true }; }
    cloudHold = true;
    openHeroChooser(app, { cloudCode: r.save, cloudAt: r.updatedAt, local: store.get(), reason: 'conflict' });
    return { ok: false, message: 'พบเซฟใหม่กว่าจากเครื่องอื่น เลือกตัวละครที่จะเก็บ' };
  }
  if (r.error) { if (r.error === 'session') app.toast(cloudError('session'), 'warn'); return { ok: false, error: r.error }; }
  return { ok: true };
}
document.addEventListener('visibilitychange', () => { if (document.hidden && cloudDirty) cloudPush({ keepalive: true }); });
function adoptCloud(code, at, note) {
  const r = importCode(code);
  if (!r.ok) { app.toast('เซฟในบัญชีอ่านไม่ได้', 'warn'); return false; }
  app.importSave(r.state, r.warnings, note);
  cloud.markSynced(at, contentHash(store.get()));
  return true;
}

Object.assign(app, {
  openPanel: (id, p) => screens.openPanel(id, p),
  rerender: () => screens.rerender(),
  setUiBusy: (b) => screens.setBusy(b),
  playScene: (id, done) => story.playScene(id, done),
  replayScene: (id) => story.playScene(id, () => screens.rerender()),
  openLore: (id, done) => story.openLore(id, done),
  modal: (content, opts) => screens.modal(content, opts),
  openAwaken: (mode) => awaken.openCeremony(mode, () => screens.rerender()),
  awakenRace() {
    const r = awakenRace(store.get(), rng);
    if (!r.ok) { app.toast('ปลุกสายเลือดไปแล้ว', 'warn'); return r; }
    store.commit(r.state, { reason: 'race' });
    return r;
  },
  rerollRace() {
    const r = rerollRace(store.get(), rng);
    if (!r.ok) { app.toast(r.reason === 'no_bloodstone' ? 'ต้องมีศิลาเปลี่ยนสายเลือด (ได้จากบอส)' : 'สุ่มสายเลือดไม่สำเร็จ', 'warn'); audio.play('error'); return r; }
    store.commit(r.state, { reason: 'race' });
    return r;
  },
  canStartDuel: () => (sceneName === 'camp' || sceneName === 'village') && !story.busy && !awaken.busy && !trade,
  enterVillage() {
    if (!app.online.online) { app.toast(app.online.reason, 'warn', 'net'); audio.play('error'); return; }
    audio.unlock();
    screens.hideAll();
    app.village.show();
    switchScene('village');
  },
  leaveVillage() { app.rooms.leave(); app.village.hide(); arriveCamp(null); },
  // A 1v1 duel accepted from a player card: a match room with the inviter as host on team A.
  startDuel({ room, opponent, host }) {
    const me = app.online.me.peer;
    const roster = host ? { a: [me], b: [opponent.peer] } : { a: [opponent.peer], b: [me] };
    app.startMatch({ roomName: room, mode: '1v1', host: host ? me : opponent.peer, roster, title: `ดวลกับ ${opponent.name}` });
  },
  async startMatch({ room, roomName, mode, host, roster, title }) {
    if (!app.canStartDuel() && !room) return;
    let ch = room;
    if (!ch) {
      try { ch = await app.online.net.join(roomName); }
      catch { app.toast('เข้าสนามประลองไม่ได้ ลองใหม่อีกครั้ง', 'warn'); return; }
    }
    app.village.hide(); screens.hideAll(); closeTrade();
    matchFrom = sceneName === 'village' ? 'village' : 'camp';
    switchScene('match', { room: ch, mode, host, roster, title, channel: roomName || ch.name || null });
  },
  // ชมการต่อสู้: join a match in progress as a viewer (no hero, no input; it ends with the match)
  async watchMatch(ad) {
    if (!ad?.watch || !app.online.online) return;
    if (sceneName === 'match') return;
    let ch;
    try { ch = await app.online.net.join(ad.watch.ch); }
    catch { app.toast('เข้าชมไม่ได้ ลองใหม่อีกครั้ง', 'warn'); return; }
    await app.rooms?.leave?.();
    app.village.hide(); screens.hideAll(); closeTrade();
    matchFrom = sceneName === 'village' ? 'village' : 'camp';
    switchScene('match', { room: ch, mode: ad.mode, host: ad.host, roster: ad.watch.roster, title: ad.title, spectate: true, channel: ad.watch.ch });
  },
  onSpectateEnd(res) {
    let close;
    const content = h('div', { class: 'modal panel', 'data-modal': 'spectate-result' },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, `ชมการประลอง · ${res.title}`),
      h('h2', {}, res.winner ? `${TEAM_INFO[res.winner].name} ชนะ` : 'การประลองจบลง'),
      h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, `${TEAM_INFO.a.name} ${res.score.a} - ${res.score.b} ${TEAM_INFO.b.name}`),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'spectate-done', onclick: () => close() }, matchFrom === 'village' ? 'กลับหมู่บ้าน' : 'กลับค่าย')));
    close = screens.modal(content, { dismissable: false, onClose: () => { if (matchFrom === 'village' && app.online.online) app.enterVillage(); else arriveCamp(null); } });
  },
  onMatchEnd(res) {
    const duel = res.mode === '1v1';
    const title = res.result === 'win' ? (duel ? 'ชนะการดวล' : 'ทีมชนะ') : res.result === 'lose' ? (duel ? 'แพ้การดวล' : 'ทีมแพ้') : 'ยกเลิกการประลอง';
    const why = { forfeit: res.result === 'win' ? 'ฝ่ายตรงข้ามออกจากสนาม' : 'คุณยอมแพ้', no_show: 'ผู้เล่นไม่เข้าสนามภายใน 20 วินาที', host_left: 'เจ้าของห้องออกจากสนาม', score: 'ชนะ 2 ใน 3 ยก' }[res.why] || '';
    const st = store.get();
    let close;
    const content = h('div', { class: 'modal panel', 'data-modal': 'duel-result', 'data-result': res.result },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, duel ? `ดวลกับ ${res.opponents.join(', ') || 'คู่ดวล'}` : `${MODES[res.mode].name} · ${TEAM_INFO[res.team].name}`),
      h('h2', { class: res.result === 'win' ? '' : 'lose' }, title),
      h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, why),
      duel ? null : h('p', { class: 'muted', style: { margin: 0, textAlign: 'center', fontSize: 'var(--step--1)' } }, `ทีมคุณ: ${res.allies.join(', ')} · ฝ่ายตรงข้าม: ${res.opponents.join(', ')}`),
      h('div', { class: 'kv' },
        h('div', {}, h('span', { class: 'muted' }, 'ผลยก'), h('b', {}, `${res.score.me} - ${res.score.them}`)),
        h('div', {}, h('span', { class: 'muted' }, 'คอมโบสูงสุด'), h('b', {}, `${res.bestCombo} ฮิต`)),
        h('div', {}, h('span', { class: 'muted' }, 'หลบสมบูรณ์'), h('b', {}, `${res.perfects} ครั้ง`)),
        h('div', {}, h('span', { class: 'muted' }, 'สถิติประลอง'), h('b', {}, `ชนะ ${st.pvp.wins} · แพ้ ${st.pvp.losses}`))),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'duel-done', onclick: () => close() }, matchFrom === 'village' ? 'กลับหมู่บ้าน' : 'กลับค่าย')));
    close = screens.modal(content, { dismissable: false, onClose: () => { if (matchFrom === 'village' && app.online.online) app.enterVillage(); else arriveCamp(null); } });
  },
  leaveMatch() {
    const m = scenes.match;
    if (sceneName !== 'match' || !m.world || m.world.ended || matchConfirm) return;
    if (m.world.spectate) { m.stopWatching(); return; }
    let close;
    const content = h('div', { class: 'modal panel', 'data-modal': 'forfeit' },
      h('h2', {}, 'ยอมแพ้?'),
      h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, 'ออกจากสนามตอนนี้นับเป็นแพ้ ฝ่ายตรงข้ามได้เปรียบทันที'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn danger', type: 'button', 'data-action': 'forfeit', onclick: () => { close(); m.forfeit(); } }, 'ยอมแพ้'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => close() }, 'สู้ต่อ')));
    matchConfirm = true;
    close = screens.modal(content, { onClose: () => { matchConfirm = false; } });
  },
  // ---- online zones
  openZones() { audio.play('click'); openZoneBoard(app); },
  openCrafting() { audio.play('click'); openCrafting(app); },
  openCosmos() { audio.play('click'); openCosmos(app); },
  infiniteLock() {
    const st = store.get();
    if (!st.progress.cleared.s1) return 'ผ่านป่าหนามสนธยาในเนื้อเรื่องก่อน';
    if (st.player.level < 6) return 'ต้องเลเวล 6 ขึ้นไป';
    if (entriesLeft(st) <= 0) return 'วันนี้ใช้สิทธิ์ครบแล้ว กลับมาใหม่พรุ่งนี้';
    return null;
  },
  startInfinite(from = null) {
    const lock = app.infiniteLock();
    if (lock) { app.toast(lock, 'warn'); return; }
    // the entry is spent the moment the rift opens
    const next = cloneState(store.get()), day = dayKey();
    if (next.infinite.day !== day) { next.infinite.day = day; next.infinite.used = 0; }
    next.infinite.used += 1;
    store.commit(next, { reason: 'infinite-entry' });
    const dead = { name: 'solo', emit: async () => {}, on: () => () => {}, presence: async () => {}, peers: () => [], onPeers: () => () => {}, connected: () => false, leave: async () => {} };
    audio.unlock();
    app.village.hide(); screens.hideAll(); closeTrade();
    zoneFrom = from || (sceneName === 'village' ? 'village' : 'camp');   // v8.4: a replay returns to the place the first run came from
    switchScene('coop', { room: dead, zone: infiniteZone(1), host: app.online.me.peer || 'me', roster: [app.online.me.peer || 'me'], title: 'รอยแยกไร้สิ้นสุด' });
  },
  // ---- the Underworld Tower (solo)
  openTower() { audio.play('click'); openTower(app); },
  openBestiary() { audio.play('open'); return openBestiary(app); },
  openUltCodex(focus) { audio.play('open'); return openUltCodex(app, focus); },
  // โปรไฟล์: mine (no argument) or another player's card
  openProfile(opts = null) { audio.play('open'); return openProfile(app, opts || { self: true }); },
  async openPeerProfile(peer) {
    const r = await app.online.requestCard(peer);
    if (!r.ok) { app.toast(r.reason === 'no_answer' ? 'ผู้เล่นคนนี้ไม่ตอบ (อาจกำลังสู้หรือออกไปแล้ว)' : 'เปิดโปรไฟล์ไม่สำเร็จ', 'warn'); return; }
    app.openProfile({ card: r.card, source: 'ข้อมูลจากเกมของผู้เล่นคนนี้ขณะออนไลน์' });
  },
  async openAccountProfile(account) {
    const r = await cloud.card(account);
    const card = r.card ? readCard(r.card) : null;
    if (!card) { app.toast(cloudError(r.error || 'no_card'), 'warn'); return; }
    app.openProfile({ card, source: 'สร้างโดยเซิร์ฟเวอร์จากเซฟออนไลน์ล่าสุดของบัญชีนี้' });
  },
  startTower(floor) {
    const st = store.get();
    const lock = towerLock(st);
    if (lock) { app.toast(lock, 'warn'); return; }
    if (!startFloors(st).includes(floor)) { app.toast('ยังเริ่มจากชั้นนี้ไม่ได้', 'warn'); return; }
    const dead = { name: 'solo', emit: async () => {}, on: () => () => {}, presence: async () => {}, peers: () => [], onPeers: () => () => {}, connected: () => false, leave: async () => {} };
    audio.unlock();
    app.village.hide(); screens.hideAll(); closeTrade();
    zoneFrom = 'camp';
    switchScene('coop', { room: dead, zone: towerZone(floor, st.tower?.asc || 0), host: app.online.me.peer || 'me', roster: [app.online.me.peer || 'me'], title: 'หอคอยขุมนรก' });
  },
  // The tower with friends (up to 8): a room in the village list, like a PvP room. Everyone climbs together from the room's floor.
  async openTowerRoom(floor) {
    const st = store.get(), lock = towerLock(st);
    if (lock) { app.toast(lock, 'warn'); return; }
    if (!startFloors(st).includes(floor)) { app.toast('ยังเริ่มจากชั้นนี้ไม่ได้', 'warn'); return; }
    if (sceneName !== 'village') { if (!app.online.online) { app.toast('ต้องออนไลน์ก่อนจึงจะเปิดห้องเล่นกับเพื่อนได้', 'warn'); return; } app.enterVillage(); }
    const r = await app.rooms.create('tower', '', 'tower', { floor });
    if (!r.ok) { app.toast(r.detail || (r.reason === 'view_only' ? 'บัญชีนี้ดูได้อย่างเดียว' : 'เปิดห้องหอคอยไม่สำเร็จ'), 'warn'); return; }
    app.village.openRooms();
  },
  startTowerRoom({ room, floor, asc, host, roster, title }) {
    const st = store.get(), lock = towerLock(st);
    if (lock) { app.toast(lock, 'warn'); room.leave?.(); return; }
    audio.unlock();
    app.village.hide(); screens.hideAll(); closeTrade();
    zoneFrom = 'village';
    switchScene('coop', { room, zone: towerZone(floor, asc), host, roster, title });
  },
  zoneLock: (id) => { const z = getZone(id); return z ? zoneLock(store.get(), z) : 'ไม่พบโซน'; },
  startZoneSolo(zoneId, from = null) {
    const z = getZone(zoneId);
    if (!z || zoneLock(store.get(), z)) return;
    const dead = { name: 'solo', emit: async () => {}, on: () => () => {}, presence: async () => {}, peers: () => [], onPeers: () => () => {}, connected: () => false, leave: async () => {} };
    app.startZone({ room: dead, zoneId, host: app.online.me.peer || 'me', roster: [app.online.me.peer || 'me'], title: z.name, from });
  },
  // An expedition room in the lobby that others join from the room list (village).
  async openExpedition(zoneId) {
    if (sceneName !== 'village') { if (!app.online.online) return; app.enterVillage(); }
    const r = await app.rooms.create('coop', '', zoneId);
    if (!r.ok) { app.toast(r.reason === 'view_only' ? 'บัญชีนี้ดูได้อย่างเดียว' : 'เปิดคณะสำรวจไม่สำเร็จ', 'warn'); return; }
    app.village.openRooms();
  },
  startZone({ room, zoneId, host, roster, title, from = null }) {
    const zone = getZone(zoneId);
    if (!zone) return;
    if (zoneLock(store.get(), zone)) { app.toast(`ยังเข้า${zone.name}ไม่ได้: ${zoneLock(store.get(), zone)}`, 'warn'); room.leave?.(); return; }
    audio.unlock();
    app.village.hide(); screens.hideAll(); closeTrade();
    zoneFrom = from || (sceneName === 'village' ? 'village' : 'camp');
    switchScene('coop', { room, zone, host, roster, title });
  },
  onZoneEnd(res) {
    app.hud.hide();
    const { outcome, zone, reward, run } = res;
    if (reward?.infinite) { infiniteResult(res); return; }
    if (reward?.tower) { towerResult(app, res, { onClose: () => { if (zoneFrom === 'village' && app.online.online) app.enterVillage(); else arriveCamp(null); } }); return; }
    // v8.4: a solo run can be started again from its result window; a shared expedition room cannot be restarted by one player
    const canReplay = !(res.party > 1) && outcome !== 'host_left';
    const replayLock = canReplay ? app.zoneLock(zone.id) : null;     // raid bosses sleep after a kill: the button shows the wait
    let replaying = false;
    const title = outcome === 'victory' ? 'พิชิตโซน!' : outcome === 'defeat' ? 'คณะสำรวจล้ม' : outcome === 'host_left' ? 'หัวหน้าคณะออกไป' : 'ถอนตัว';
    let close;
    const content = h('div', { class: 'modal panel', 'data-modal': 'zone-result', 'data-outcome': outcome },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, `${zone.name}${res.party > 1 ? ` · ${res.party} คน` : ''}`),
      h('h2', { class: outcome === 'victory' ? '' : 'lose' }, title),
      reward?.luckLoot ? h('div', { class: 'notice ok', 'data-luck-loot': '' }, `โบนัสยาโชคดี: ได้ของเพิ่มตอนจบ ${reward.luckLoot.map((d) => `${getItem(d.id)?.name || d.id}${d.qty > 1 ? ' ×' + d.qty : ''}`).join(' · ')}`) : null,
      reward ? h('div', { class: 'notice ok' }, `รางวัลพิชิต${reward.first ? 'ครั้งแรก' : ''}: ${reward.gold} ทอง · ประกายอำพัน ${reward.sparks} · ประสบการณ์ ${reward.xp}`) : h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, 'ของที่เก็บได้ระหว่างทางยังอยู่ในกระเป๋า'),
      h('div', { class: 'kv' },
        h('div', {}, h('span', { class: 'muted' }, 'กำจัด'), h('b', {}, `${run.kills} ตัว`)),
        h('div', {}, h('span', { class: 'muted' }, 'เวลา'), h('b', {}, `${Math.floor(run.seconds / 60)}:${String(run.seconds % 60).padStart(2, '0')}`)),
        h('div', {}, h('span', { class: 'muted' }, 'ทอง'), h('b', {}, `+${run.gold}`)),
        h('div', {}, h('span', { class: 'muted' }, 'ประสบการณ์'), h('b', {}, `+${run.xp}`)),
        h('div', {}, h('span', { class: 'muted' }, 'คอมโบสูงสุด'), h('b', {}, `${run.bestCombo} ฮิต`)),
        h('div', {}, h('span', { class: 'muted' }, 'หลบสมบูรณ์'), h('b', {}, `${run.perfects} ครั้ง`))),
      run.levelUps ? h('div', { class: 'notice ok' }, `เลเวลอัป ${run.levelUps} ครั้ง · ได้แต้มสเตตัส +${run.levelUps * 3}`) : null,
      h('div', { class: 'eyebrow' }, `ของที่ได้ (${run.items.length} ชนิด)`),
      run.items.length ? h('div', { class: 'loot-grid' }, run.items.map((it) => { const def = getItem(it.id); return h('div', { class: `cell r-${def.rarity}`, title: def.name }, itemImg(it.id), h('span', { class: 'qty' }, it.qty)); })) : h('div', { class: 'empty-note' }, 'รอบนี้ไม่ได้ไอเทม'),
      res.saveOk ? null : h('div', { class: 'notice' }, 'บันทึกเกมไม่สำเร็จ'),
      h('div', { class: 'actions' },
        canReplay ? h('button', { class: outcome === 'victory' ? 'btn gold' : 'btn', type: 'button', 'data-action': 'replay', disabled: !!replayLock, title: replayLock || '',
          onclick: () => { const why = app.zoneLock(zone.id); if (why) { app.toast(why, 'warn'); return; } replaying = true; close(); app.startZoneSolo(zone.id, zoneFrom); } },
          glyph(replayLock ? 'lock' : 'door'), replayLock || (outcome === 'victory' ? `เล่นซ้ำ${zone.name}` : 'ลองใหม่อีกครั้ง')) : null,
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'zone-done', onclick: () => close() }, zoneFrom === 'village' ? 'กลับหมู่บ้าน' : 'กลับค่าย')));
    close = screens.modal(content, { dismissable: false, onClose: () => { if (replaying) return; if (zoneFrom === 'village' && app.online.online) app.enterVillage(); else arriveCamp(null); } });
  },
  leaveZone() {
    const c = scenes.coop;
    if (sceneName !== 'coop' || !c.world || c.world.ended || zoneConfirm) return;
    let close;
    const content = h('div', { class: 'modal panel', 'data-modal': 'zone-pause' },
      h('h2', {}, 'พักการสำรวจ'),
      c.world.inf ? h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, `ออกตอนนี้ได้รับเหรียญ ${c.world.inf.coins.toLocaleString('th-TH')} และอาร์ติแฟกต์ ${c.world.inf.arts.length} ชิ้นที่สะสมไว้ทั้งหมด`) :
      h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, c.world.party > 1 ? 'เกมไม่หยุดระหว่างเล่นกับเพื่อน ถอนตัวแล้วของที่เก็บได้ยังอยู่ แต่ไม่ได้รางวัลพิชิต' : 'ถอนตัวแล้วของที่เก็บได้ยังอยู่ แต่ไม่ได้รางวัลพิชิต'),
      settingsBlock(),
      h('div', { class: 'actions' },
        h('button', { class: 'btn danger', type: 'button', 'data-action': 'zone-retreat', onclick: () => { close(); c.retreat(); } }, 'ถอนตัว'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => close() }, 'สู้ต่อ')));
    zoneConfirm = true;
    close = screens.modal(content, { onClose: () => { zoneConfirm = false; } });
  },
  // A trade accepted from a player card: both open the trade window in a 'trade-<id>' room.
  async startTrade({ room, partner, host, rid }) {
    if (trade || !app.canStartDuel()) return;
    let ch;
    try { ch = await app.online.net.join(room); }
    catch { app.toast('เปิดการแลกเปลี่ยนไม่ได้ ลองใหม่อีกครั้ง', 'warn'); return; }
    const link = createTradeLink(app, { ch, tid: rid, host, partner });
    trade = { link, ui: null };
    app.online.publish({ b: 'trade' });
    trade.ui = openTradeUi(app, link);
  },
  onTradeClosed() { trade = null; if (app.gameActive) app.online.publish({ b: ZONE[sceneName]?.b ?? null }); },
  inBattle: () => sceneName === 'battle' && !!scenes.battle.world && !scenes.battle.world.ended && !scenes.battle.world.paused,
  continueGame() {
    audio.unlock();
    app.gameActive = true;
    const storyWaiting = !!nextCampScene(store.get()) || !store.get().race?.id;
    arriveCamp(null);
    // after an update: the patch notes, once (not over a story scene that is about to play)
    if (hasUnseenNotes() && !storyWaiting) setTimeout(() => app.openPatchNotes(), 200);
  },
  openPatchNotes(opts) { return openPatchNotes(app, opts); },
  openTutorial(opts) { return openTutorial(app, opts); },
  openSaveTransfer(opts) { return openSaveTransfer(app, opts); },
  openLayoutEditor() { audio.play('click'); return openLayoutEditor(app, { measure: (c) => app.hud.measure(c), onSaved: () => { app.hud.relayout(); app.toast('บันทึกตำแหน่งปุ่มแล้ว', 'ok'); } }); },
  // ---- cloud saves
  cloud: { get available() { return cloudOn; }, account: () => cloud.account(), ranks: (board) => cloud.ranks(board), card: (account) => cloud.card(account), syncSoon: () => cloudTouch?.() },
  hasLocalHero: () => saves.exists(),
  openAccount() { audio.play('click'); return openAccount(app); },
  async cloudRegister(name, pass) {
    const local = saves.exists() ? exportCode(store.get()) : null;
    const d = await cloud.register(name, pass, local);
    if (!d.token) return { ok: false, error: d.error };
    if (local) cloud.markSynced(d.updatedAt, contentHash(store.get()));
    screens.refreshTitle?.();
    return { ok: true, message: local ? `สมัครบัญชี ${d.name} แล้ว บันทึกตัวละครขึ้นบัญชีเรียบร้อย` : `สมัครบัญชี ${d.name} แล้ว เริ่มเล่นได้เลย ตัวละครจะบันทึกขึ้นบัญชีเอง` };
  },
  async cloudLogin(name, pass) {
    const d = await cloud.login(name, pass);
    if (!d.token) return { ok: false, error: d.error, message: d.error === 'locked' ? `ใส่รหัสผิดหลายครั้ง ลองใหม่ในอีก ${Math.ceil((d.retryIn || 600) / 60)} นาที` : null };
    screens.refreshTitle?.();
    const hasLocal = saves.exists();
    if (!d.save) {
      if (!hasLocal) return { ok: true, message: `เข้าสู่ระบบ ${d.name} แล้ว บัญชียังไม่มีตัวละคร เริ่มเล่นได้เลย` };
      const r = await cloudPush({ force: true });
      return { ok: true, message: r.ok ? 'เข้าสู่ระบบแล้ว บันทึกตัวละครในเครื่องนี้ขึ้นบัญชีเรียบร้อย' : 'เข้าสู่ระบบแล้ว' };
    }
    if (!hasLocal) { adoptCloud(d.save, d.updatedAt, `โหลดตัวละครจากบัญชี ${d.name} แล้ว`); return { ok: true, choose: true }; }
    const cs = importCode(d.save).state, local = store.get();
    // the same hero (same creation time): keep whichever was saved later, no question needed
    if (cs && cs.createdAt === local.createdAt) {
      if ((cs.updatedAt || 0) >= (local.updatedAt || 0)) { adoptCloud(d.save, d.updatedAt, 'โหลดเซฟล่าสุดจากบัญชีแล้ว'); return { ok: true, choose: true }; }
      cloud.markSynced(d.updatedAt, '');
      const r = await cloudPush({ force: true });
      return { ok: true, message: r.ok ? 'เข้าสู่ระบบแล้ว เซฟในเครื่องนี้ใหม่กว่า จึงบันทึกขึ้นบัญชีแทน' : 'เข้าสู่ระบบแล้ว' };
    }
    openHeroChooser(app, { cloudCode: d.save, cloudAt: d.updatedAt, local, reason: 'login' });
    return { ok: true, choose: true };
  },
  async cloudChoose(which, { cloudCode, cloudAt }) {
    cloudHold = false;
    if (which === 'cloud') { adoptCloud(cloudCode, cloudAt, 'เล่นต่อด้วยตัวละครในบัญชี'); return; }
    cloud.markSynced(cloudAt, '');
    const r = await cloudPush({ force: true });
    app.toast(r.ok ? 'บันทึกตัวละครในเครื่องนี้ขึ้นบัญชีแล้ว' : 'ยังบันทึกขึ้นบัญชีไม่ได้ จะลองใหม่อัตโนมัติ', r.ok ? 'ok' : 'warn');
  },
  async cloudSyncNow() { return cloudPush(); },
  async cloudLogout() { if (cloudDirty) await cloudPush(); await cloud.logout(); screens.refreshTitle?.(); },
  // a save brought in with a transfer code: it replaces this browser's save and the game continues with it
  importSave(state, warnings = [], note = null) {
    audio.unlock();
    store.commit(state, { reason: 'import' });
    const r = saves.save(store.get());
    if (!r.ok) { app.toast('บันทึกเซฟที่นำเข้าไม่สำเร็จ', 'warn'); return; }
    markSeen();
    app.gameActive = true;
    app.refreshHeroSprites();
    screens.hideAll?.();
    arriveCamp(null);
    app.toast(note || `ย้ายเซฟของ ${state.story.name} เลเวล ${state.player.level} เข้ามาแล้ว${warnings.length ? ' (ซ่อมแซมบางส่วน)' : ''}`, 'ok');
  },
  downloadCorrupt() {
    const text = saves.corrupt();
    if (!text) return;
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = h('a', { href: url, download: 'emberhold-save-damaged.txt' }); document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { app.toast('ดาวน์โหลดไม่ได้ในเบราว์เซอร์นี้', 'warn'); }
  },
  newGame() {
    audio.unlock();
    story.askName((name) => {
      app.gameActive = true;
      saves.clear();
      const fresh = createNewState();
      fresh.story.name = name;
      markTutorialPending(fresh);                   // new players only: ask once whether to teach (ui/tutorial.js)
      store.commit(fresh, { reason: 'new-game' });
      markSeen();                                   // a new hero starts on this version: nothing to announce
      app.refreshHeroSprites();
      arriveCamp('stages');
    });
  },
  renameHero(raw) {
    const next = cloneState(store.get());
    next.story.name = cleanHeroName(raw);
    store.commit(next, { reason: 'rename' });
    app.toast(`เปลี่ยนชื่อเป็น ${next.story.name} แล้ว`, 'ok');
  },
  // opts.resume: continue the saved run of this dungeon (v8.3) instead of starting a new one
  startBattle(stageId, opts = {}) {
    audio.unlock();
    screens.hideAll();
    switchScene('battle', { stageId, resume: !!opts.resume });
  },
  // v8.3 "พักดัน": save the unfinished dungeon and go back to camp; it can be continued from the hunt tab
  restDungeon() {
    scenes.battle.resume();
    const r = scenes.battle.rest();
    if (!r) return;
    app.hud.hide();
    arriveCamp('stages');
    if (r.saveOk) app.toast(`พัก${r.stage.name}ไว้แล้ว กลับมาต่อได้ที่แท็บออกล่า`, 'ok');
    else app.toast('บันทึกดันไม่สำเร็จ (เบราว์เซอร์อาจปิดพื้นที่จัดเก็บ) ดันที่ค้างจะหายเมื่อปิดหน้า', 'warn');
  },
  onBattleEnd(result) {
    app.hud.hide();
    screens.openResult(result);
  },
  goCamp(panel) { arriveCamp(panel); },
  pauseBattle() {
    if (sceneName === 'match') { app.leaveMatch(); return; }
    if (sceneName === 'coop') { app.leaveZone(); return; }
    const w = scenes.battle.world;
    if (sceneName !== 'battle' || !w || w.paused || w.ended || story.busy || awaken.busy) return;
    scenes.battle.pause();
    audio.play('click');
    screens.openPause();
  },
  resumeBattle() { if (sceneName === 'battle') scenes.battle.resume(); },
  // v8.5.1 กระเป๋าในดัน: ★ lock / sell / quick-sell while hunting. Solo hunts pause while the window is open; online zones cannot pause.
  // fromPause: opened from the pause menu, which already holds the pause (and resumes the game when it closes).
  openBag({ fromPause = false } = {}) {
    if (bagOpen) return;
    if (sceneName !== 'battle' && sceneName !== 'coop') { if (sceneName === 'match') app.toast('เปิดกระเป๋าไม่ได้ระหว่างดวล', 'warn', 'bag'); return; }
    let paused = false;
    if (sceneName === 'battle' && !fromPause) {
      const w = scenes.battle.world;
      if (!w || w.paused || w.ended || story.busy || awaken.busy) return;
      scenes.battle.pause(); paused = true;
    }
    bagOpen = true;
    audio.play('click');
    openDungeonBag(app, { onClose: () => { bagOpen = false; if (paused && sceneName === 'battle') scenes.battle.resume(); } });
  },
  retreat() { scenes.battle.resume(); scenes.battle.retreat(); },
  updateSettings(s) {
    const next = cloneState(store.get());
    next.settings = { ...next.settings, ...s };
    store.commit(next, { reason: 'settings' });
    audio.setVolumes(next.settings.sfx, next.settings.music, next.settings.ui);
    renderer.setShakeEnabled(next.settings.shake && !reducedMotion.matches);
    applyQuality(next.settings.quality);
  },
  deleteSave() {
    app.gameActive = false;
    saves.clear();
    store.commit(createNewState(), { reason: 'reset', persist: false });
    app.refreshHeroSprites();
    screens.showTitle({ hasSave: false, summary: null, notice: null });
    app.toast('ลบเซฟแล้ว', 'ok');
  },
});

let bagOpen = false;
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyB' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('.modal-back')) return;   // a window is already open
  if (sceneName === 'battle' || sceneName === 'coop') { e.preventDefault(); app.openBag(); }
});
let matchFrom = 'village', matchConfirm = false, trade = null, zoneFrom = 'camp', zoneConfirm = false;
const settingsBlock = () => null;
function closeTrade() { if (trade) trade.ui?.close(); }
let lastLook = '';
// achievements: checked a moment after progress changes (titles never interrupt a fight; they wait for the camp)
let titleTimer = 0;
function checkAchievements() {
  titleTimer = 0;
  if (!app.gameActive) return;
  const r = checkTitles(store.get());
  if (!r.unlocked.length) return;
  store.commit(r.state, { reason: 'titles' });
  for (const id of r.unlocked.slice(0, 4)) { const t = getTitle(id); app.toast(`ความสำเร็จ: ${t.name}`, 'loot', null, { rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'][t.t] || 'rare' }); }
  if (r.unlocked.length > 4) app.toast(`และอีก ${r.unlocked.length - 4} ความสำเร็จ`, 'ok');
  audio.play('legendary');
}
app.refreshPresence = () => { lastLook = ''; app.online.refreshLook?.(); };
// v8.2 Luck Potion badge: one chip above every screen (camp, village, dungeons, zones, tower…) with the time left.
// It also keeps every [data-luck-left] label in open panels ticking.
const luckChip = h('div', { class: 'luck-chip', hidden: true, role: 'status', 'data-luck-chip': '' }, glyph('star'), h('b', {}, `โชคดี ×${LUCK.mult}`), h('span', { class: 'num', 'data-luck-left': '' }, '0:00'));
uiRoot.append(luckChip);
let luckWas = false;
function tickLuck() {
  const left = app.gameActive ? luckLeftMs(store.get()) : 0;
  const on = left > 0;
  luckChip.hidden = !on;
  document.body.classList.toggle('luck-on', on);
  luckChip.classList.toggle('low', on && left < 30000);
  if (on) { const t = fmtLuckTime(left); for (const el of document.querySelectorAll('[data-luck-left]')) if (el.textContent !== t) el.textContent = t; }
  if (luckWas && !on && app.gameActive) { app.toast('ยาโชคดีหมดฤทธิ์แล้ว', 'info'); }
  luckWas = on;
}
setInterval(tickLuck, 500);
store.subscribe(() => tickLuck());
store.subscribe((st, reason) => {
  if (reason !== 'titles' && !titleTimer && sceneName !== 'battle' && sceneName !== 'coop' && sceneName !== 'match') titleTimer = setTimeout(checkAchievements, 400);
  if (screens.campVisible) { screens.renderTop(st); screens.rerender(); }
  // other players see my new gear, bloodline, pet and name right away
  const look = JSON.stringify(lookOf(st));
  if (app.gameActive && look !== lastLook) { lastLook = look; app.online.refreshLook(); }
});

// Connects in the background; the game never waits for the network.
async function connectOnline() {
  let net;
  try {
    net = await Promise.race([createNet({ mode: netMode, localId: saveSlot ? `local-${saveSlot}` : null, slot: saveSlot, rtc: params.get('rtc') !== 'off', ice: params.get('ice') || '' }), new Promise((r) => setTimeout(() => r(null), 12000))]);
  } catch { net = null; }
  if (!net) net = await createNet({ mode: 'offline' });
  if (net.mode === 'offline' && netMode === 'auto' && net.reason) { /* reason is shown where online features live */ }
  app.online.destroy?.();
  app.online = createOnline(app, net);
  app.online.on('duel', (ev) => app.startDuel(ev));
  app.online.on('trade', (ev) => app.startTrade(ev));
  app.online.on('guild', async (ev) => {
    const r = await app.guild.join(ev.gid);
    if (r.ok) { app.toast(`เข้าร่วมกิลด์ ${r.name} แล้ว`, 'ok'); audio.play('success'); }
    else app.toast(r.reason === 'already_in_guild' ? 'คุณอยู่ในกิลด์อื่นอยู่แล้ว' : r.reason === 'guild_full' ? 'กิลด์เต็มแล้ว' : r.reason === 'not_invited' ? 'คำเชิญหมดอายุแล้ว' : 'เข้ากิลด์ไม่สำเร็จ', 'warn');
  });
  app.guild.attach(net.docs || null);
  let countKey = '';
  app.online.on('peers', (list) => {
    const key = `${list.length}|${list.filter((x) => x.p.zone === 'village').length}`;
    if (key !== countKey) { countKey = key; if (screens.campVisible && screens.currentPanel === 'stages') screens.rerender(); }
  });
  app.village.rewire();
  if (app.gameActive) app.online.publish(ZONE[sceneName] || ZONE.camp);
  if (screens.campVisible) screens.rerender();
}

// ---------------------------------------------------------------- lifecycle
function resize() { renderer.resize(); buildVignette(); }
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
reducedMotion.addEventListener?.('change', () => applyQuality(store.get().settings.quality));

const loop = createLoop((dt) => {
  if (!scene) return;
  scene.update(dt);
  scene.render();
});
loop.onHidden(() => {
  // Persist whatever was picked up so far and pause the fight while the tab is hidden.
  if (sceneName === 'battle') scenes.battle.checkpoint();          // v8.3: keep the dungeon run resumable
  if (app.gameActive) saves.save(store.get());
  if (cloudDirty) cloudPush({ keepalive: true });
  if (sceneName === 'battle') app.pauseBattle();
  audio.suspend();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) audio.resume(); });

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  // v9.0.2: show the real error text so a phone screenshot is enough to find the cause (no console on mobile)
  const where = e.filename ? ` @ ${String(e.filename).split('/').slice(-2).join('/')}:${e.lineno || '?'}` : '';
  app.toast(`เกิดข้อผิดพลาดในเกม: ${String(e.error?.message || e.message || 'unknown').slice(0, 140)}${where}`, 'warn', 'err');
});

// Read-only hook for automated tests and debugging. It does not change game state.
window.__EMBERHOLD = {
  get state() { return JSON.parse(JSON.stringify(store.get())); },
  ...(DEV_HOST ? { devResign: (key) => saves.resign(key), devWound: (f) => scenes.coop.devWound(f),
    devApp: () => app, devWorld: () => scenes[sceneName]?.world || null,
    // casts any skill in the current fight (tests): 'ok' | 'none' | 'err:…'
    devCast: (id, rank = 3) => {
      const w = scenes[sceneName]?.world, sk = getSkillDef(id);
      if (!w || !sk || sk.kind !== 'active') return 'no';
      try { return castSpec(w, w.player, sk, skillRankValues(sk, rank)) ? 'ok' : 'none'; } catch (e) { return `err:${e.message}`; }
    },
    // fills the gauge (optionally with another ultimate) and unleashes it: 'ok' | 'none' | 'fail'
    devUlt: (id) => {
      const w = scenes[sceneName]?.world;
      if (!w || !w.tryUlt) return 'no';
      if (id) { w.ult = createUltState(id, !!w.pvp); app.hud.show(w); }
      if (!w.ult) return 'none';
      w.ult.val = w.ult.need;
      try { return w.tryUlt() ? 'ok' : 'fail'; } catch (e) { return `err:${e.message}`; }
    },
    devUltState: () => { const u = scenes[sceneName]?.world?.ult; return u ? { id: u.id, val: u.val, need: u.need, run: !!u.run } : null; },
    devSkillFx: () => { const w = scenes[sceneName]?.world; return w?.sk ? { fx: w.sk.fx.list.length, acts: w.sk.acts.length } : null; },
  } : {}),
  get scene() { return sceneName; },
  get audio() { return { ready: audio.ready, track: audio.track, name: audio.trackName, intensity: audio.intensity }; },
  get battle() {
    const w = scenes.battle.world;
    if (!w || sceneName !== 'battle' || !w.room) return null;
    const rt = w.room;
    return {
      phase: w.phase, stage: w.stage.id, paused: w.paused, ended: w.ended, fading: w.fadeDir !== 0,
      room: { id: rt.def.id, type: rt.def.type, cleared: rt.cleared, chestOpened: rt.chestOpened, bonfireUsed: rt.bonfireUsed },
      keys: w.keys, unsealed: w.unsealed,
      doors: w.doors.map((d) => ({ dir: d.dir, to: d.to })),
      objects: w.objects.map((o) => ({ kind: o.kind, x: Math.round(o.x), y: Math.round(o.y), id: o.id || null, key: !!o.def?.key })),
      interact: w.interactTarget ? w.interactTarget.kind : null,
      visited: [...w.rooms.values()].filter((r) => r.visited).map((r) => r.def.id),
      rooms: w.dungeon.rooms.map((r) => ({ id: r.id, type: r.type, doors: doorsOf(w.dungeon, r).map((d) => ({ dir: d.dir, to: d.to })), cleared: w.rooms.get(r.id).cleared, key: !!r.chest?.key })),
      enemies: w.enemies.filter((e) => !e.dead).map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, state: e.state, warn: Math.round((e.warn || 0) * 100) / 100, spawning: e.spawning > 0 })),
      player: { x: Math.round(w.player.x), y: Math.round(w.player.y), hp: Math.ceil(w.player.hp), maxHp: w.player.maxHp, dead: w.player.dead, swings: w.player.swings, potionCd: w.player.potionCd.left, shield: w.player.shield,
                wtype: w.player.wtype.id, move: w.player.move ? { kind: w.player.move.kind, step: w.player.move.step, phase: w.player.move.phase, name: w.player.move.def.name } : null,
                dodges: w.player.dodges, moveCounts: { ...w.player.moveCounts }, charging: w.player.charging, chargeReady: w.player.chargeReady, empowered: w.player.empowerT > 0, rush: !!w.player.rush,
                buffs: { ...w.player.buffs }, atk: w.player.stats.atk, speed: w.player.stats.speed },
      skills: w.skills.map((s) => (s ? { id: s.id, cd: s.cd } : null)),
      raceSkill: w.raceSkill ? { id: w.raceSkill.id, cd: w.raceSkill.cd } : null,
      pet: w.pet ? { id: w.pet.id, x: Math.round(w.pet.x), y: Math.round(w.pet.y), cd: w.pet.cd } : null,
      pets: (w.pets || []).map((pt) => ({ id: pt.id, x: Math.round(pt.x), y: Math.round(pt.y), cd: pt.cd, fx: pt.fx.length })),
      ward: w.player.ward || 0, timed: Object.keys(w.player.buffs.timed || {}),
      combo: { ...w.combo }, perfects: w.perfects, breaks: w.breaks, slowmo: w.slowT > 0,
      boss: (() => { const b = w.enemies.find((e) => e.type.boss && !e.dead); return b ? { poise: Math.round(b.poise ?? 100), broken: b.brokenT > 0, hp: b.hp } : null; })(),
      traps: w.traps.length, drops: w.drops.length, projectiles: w.projectiles.length, shots: w.shots.length, zones: w.zones.length,
    };
  },
  get online() {
    const o = app.online;
    return { mode: o.mode, online: o.online, canSend: o.canSend(), me: o.me, peers: o.peers.map((x) => ({ peer: x.peer, by: x.by, name: x.p.name, zone: x.p.zone, busy: x.p.busy, race: x.p.race, weapon: x.p.weapon })),
             requests: o.requests.map((r) => ({ rid: r.rid, kind: r.kind, from: r.from.name })), party: o.party ? { leader: o.party.leader, members: o.party.members.map((m) => m.name) } : null, chat: o.chat.map((c) => ({ ch: c.ch, name: c.name, text: c.text, me: c.me })), links: o.net?.stats?.() || null };
  },
  get village() { return sceneName === 'village' ? scenes.village.snapshot() : null; },
  get arena() { return sceneName === 'match' ? scenes.match.snapshot() : null; },
  get coop() { return sceneName === 'coop' ? scenes.coop.snapshot() : null; },
  get guild() { const g = app.guild.current; return g ? { id: g.id, name: g.name, tag: g.tag, notice: g.notice, leader: g.leader, members: Object.fromEntries(Object.entries(g.members).map(([k, m]) => [k, { name: m.name, role: m.role }])) } : null; },
  get room() { const c = app.rooms.current; return c ? { id: c.id, mode: c.mode, host: c.amHost, roster: c.roster, ready: { ...c.ready } } : null; },
  get rooms() { return app.rooms.list(); },
  get trade() { if (!trade) return null; const s = trade.link.state; return { mine: s.mine, theirs: s.theirs, myLock: s.myLock, theirLock: s.theirLock, applied: s.applied }; },
  get camera() { return { x: Math.round(renderer.cam.x), y: Math.round(renderer.cam.y), zoom: Math.round(renderer.cam.zoom * 1000) / 1000 }; },
  get dialogue() { return story.busy; },
  get awakening() { return awaken.busy; },
  persistent,
  seed,
};

async function boot() {
  resize();
  // Validate content at boot so broken data fails loudly instead of silently mis-dropping.
  const problems = Object.values(ALL_ENEMIES).flatMap((e) => validateDropTable(e.drops, e.id));
  if (problems.length) console.error('Drop table problems:', problems);

  screens.loading.progress(0, 'กำลังวาดตัวละครและฉาก…');
  try { await loadArt(); }
  catch (e) { screens.loading.error(`${e.message} ลองรีโหลดหน้า`); console.error(e); return; }
  try { await document.fonts?.ready; } catch { /* fonts are optional */ }

  let loaded = saves.load();
  let notice = loaded.error || null;
  // signed in: the account may hold a newer save made in another app or on another device
  let pendingChoice = null;
  if (cloudOn && cloud.account()) {
    const d = await Promise.race([cloud.pull(), new Promise((r) => setTimeout(() => r({ error: 'network' }), 5000))]);
    if (d?.save) {
      const acc = cloud.account(), synced = acc?.synced || 0;
      const localChanged = !!loaded.state && contentHash(loaded.state) !== acc?.hash;
      if (d.updatedAt > synced) {
        if (!loaded.state || !localChanged) {
          const r = importCode(d.save);
          if (r.ok) {
            store.commit(r.state, { reason: 'import-cloud' });
            cloud.markSynced(d.updatedAt, contentHash(store.get()));
            loaded = { state: store.get(), warnings: [] };
            notice = 'โหลดเซฟล่าสุดจากบัญชีแล้ว';
          }
        } else pendingChoice = { cloudCode: d.save, cloudAt: d.updatedAt };
      }
    }
  }
  if (loaded.state) {
    store.commit(loaded.state, { reason: 'load', persist: false });
    if (loaded.warnings?.length) notice = `ซ่อมแซมเซฟแล้ว: ${loaded.warnings.join(' · ')}`;
  }
  if (!persistent) notice = (notice ? notice + ' · ' : '') + 'เบราว์เซอร์นี้ไม่อนุญาตให้บันทึก ความคืบหน้าจะหายเมื่อปิดหน้า';
  const st = store.get();
  audio.setVolumes(st.settings.sfx, st.settings.music, st.settings.ui);
  renderer.setShakeEnabled(st.settings.shake && !reducedMotion.matches);
  applyQuality(st.settings.quality);
  app.refreshHeroSprites();
  // full screen on the first tap of the visit, when the player turned it on in the settings
  const fsOpts = [() => !!store.get().settings.fullscreen, { landscape: () => app.touch && !!store.get().settings.landscape }];
  let stopFs = armAutoFullscreen(...fsOpts);
  app.rearmFullscreen = () => { stopFs(); stopFs = armAutoFullscreen(...fsOpts); };

  switchScene('camp');
  loop.start();
  connectOnline();
  screens.showTitle({
    hasSave: !!loaded.state,
    summary: loaded.state ? { level: st.player.level, gold: st.gold, cleared: Object.keys(st.progress.cleared).length } : null,
    notice,
    corrupt: !!saves.corrupt(),
  });
  if (pendingChoice) { cloudHold = true; openHeroChooser(app, { ...pendingChoice, local: loaded.state, reason: 'conflict' }); }
}

boot();
