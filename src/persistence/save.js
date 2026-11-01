// Save/load with validation. Storage is injected so tests can use an in-memory map.
import { cleanQuality } from '../config/quality.js';
import { avatarOk, cleanBio } from '../systems/profile.js';
import { BALANCE } from '../config/balance.js';
import { getItem, isEquipment, EQUIP_SLOTS } from '../data/items.js';
import { getStage } from '../data/stages.js';
import { createNewState, SAVE_VERSION, cleanHeroName } from '../core/state.js';
import { SKILLS, SKILL_SLOTS } from '../data/skills.js';
import { LORE, SCENES } from '../data/story.js';
import { getRace } from '../data/races.js';
import { getPet, MAX_STARS, PITY, PET_TEAM } from '../data/pets.js';
import { GODS } from '../data/tower.js';
import { getTitle } from '../data/titles.js';
import { START_SPARKS } from '../core/state.js';
import { ID_RE, FRIENDS_MAX } from '../online/protocol.js';
import { getZone, isRaid } from '../data/zones.js';
import { getArtifact, getSlot, ART_LEVEL_MAX } from '../data/artifacts.js';
import { isGuildId, cleanGuildName, cleanTag } from '../online/guild.js';
import { ATTR_IDS, ATTR_MAX } from '../data/attributes.js';
import { LUCK } from '../data/luck.js';
import { cleanRuns } from '../systems/dungeonRun.js';
import { attrTotal } from '../systems/attributes.js';
import { sign, verify, deviceKey } from './integrity.js';

// Plausibility caps: no legitimate save comes near these, edited ones are clamped to them.
export const CAPS = Object.freeze({ gold: 999_999_999_999, sparks: 999_999, counter: 99_999_999 });


export const SAVE_KEY = 'emberhold.save';
export const CORRUPT_KEY = 'emberhold.save.corrupt';
const BASE_KEY = SAVE_KEY;

const num = (v, d, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const int = (v, d, min, max) => Math.round(num(v, d, min, max));

// Turns any parsed object into a valid state. Unknown items are dropped and reported.
export function sanitize(raw) {
  const warnings = [];
  const fresh = createNewState();
  if (!raw || typeof raw !== 'object') throw new Error('save is not an object');
  if (typeof raw.version !== 'number') throw new Error('save has no version');
  if (raw.version > SAVE_VERSION) throw new Error(`save version ${raw.version} is newer than this game (${SAVE_VERSION})`);

  const s = createNewState(num(raw.createdAt, Date.now()));
  s.updatedAt = num(raw.updatedAt, Date.now());
  s.gold = int(raw.gold, 0, 0, CAPS.gold);
  s.player.level = int(raw.player?.level, 1, 1, BALANCE.player.maxLevel);
  s.player.xp = int(raw.player?.xp, 0, 0, 1e9);
  // v8.1: attribute points. Older saves have none; an edited save can never hold more than its level has earned.
  s.attrs = Object.fromEntries(ATTR_IDS.map((id) => [id, 0]));
  let attrBudget = attrTotal(s.player.level);
  for (const id of ATTR_IDS) { const take = Math.min(int(raw.attrs?.[id], 0, 0, ATTR_MAX), attrBudget); s.attrs[id] = take; attrBudget -= take; }
  s.buffs = { luckUntil: Math.round(num(raw.buffs?.luckUntil, 0, 0, Date.now() + LUCK.maxMs)) };   // v8.2: a save can never hold more luck time than the potion cap
  s.dungeonRuns = cleanRuns(raw.dungeonRuns);                       // v8.3: unfinished dungeons (anything that no longer fits the map is dropped)
  s.stats = { ...fresh.stats };
  for (const k of Object.keys(fresh.stats)) s.stats[k] = int(raw.stats?.[k], 0, 0, CAPS.counter);
  s.settings = {
    sfx: num(raw.settings?.sfx, fresh.settings.sfx, 0, 1),
    music: num(raw.settings?.music, fresh.settings.music, 0, 1),
    ui: num(raw.settings?.ui, fresh.settings.ui, 0, 1),
    shake: typeof raw.settings?.shake === 'boolean' ? raw.settings.shake : true,
    fullscreen: raw.settings?.fullscreen === true,
    landscape: raw.settings?.landscape === true,
    quality: cleanQuality(raw.settings?.quality),
  };

  const usedUids = new Set();
  let maxUid = 0;
  const cleanInstance = (it, label) => {
    if (!it || typeof it !== 'object') return null;
    const def = getItem(it.id);
    if (!def) { warnings.push(`ลบไอเทมที่ไม่รู้จัก (${String(it.id)}) จาก${label}`); return null; }
    let uid = int(it.uid, 0, 1, 1e9);
    if (!uid || usedUids.has(uid)) uid = 0; // re-assigned below
    const inst = { uid, id: def.id, qty: isEquipment(def) ? 1 : int(it.qty, 1, 1, BALANCE.inventory.maxStack), lvl: isEquipment(def) ? int(it.lvl, 0, 0, BALANCE.upgrade.maxLevel) : 0 };
    if (it.locked === true) inst.locked = true;   // v8.5.1: ★ lock
    if (uid) { usedUids.add(uid); maxUid = Math.max(maxUid, uid); }
    return inst;
  };

  for (const slot of EQUIP_SLOTS) {
    const inst = cleanInstance(raw.equipment?.[slot], 'ช่องสวมใส่');
    s.equipment[slot] = inst && getItem(inst.id).category === slot ? inst : null;
  }
  if (!s.equipment.weapon) { s.equipment.weapon = { uid: 0, id: 'w_rust_blade', qty: 1, lvl: 0 }; warnings.push('ไม่พบอาวุธในเซฟ จึงให้ดาบสนิมเก่าแทน'); }

  const slots = Array.isArray(raw.inventory?.slots) ? raw.inventory.slots : [];
  s.inventory.bagLevel = int(raw.inventory?.bagLevel, 0, 0, BALANCE.bag.maxLevel);
  s.inventory.capacity = BALANCE.inventory.capacity + BALANCE.bag.step * s.inventory.bagLevel;
  s.inventory.slots = [];
  for (const it of slots) {
    const inst = cleanInstance(it, 'กระเป๋า');
    if (!inst) continue;
    if (s.inventory.slots.length >= s.inventory.capacity) { warnings.push('กระเป๋าเกินความจุ ไอเทมส่วนเกินถูกตัดออก'); break; }
    s.inventory.slots.push(inst);
  }

  // Assign uids to anything that lacked a valid unique one.
  let nextUid = Math.max(maxUid + 1, int(raw.nextUid, 1, 1, 1e9));
  for (const slot of EQUIP_SLOTS) if (s.equipment[slot] && !s.equipment[slot].uid) s.equipment[slot].uid = nextUid++;
  for (const it of s.inventory.slots) if (!it.uid) it.uid = nextUid++;
  s.nextUid = nextUid;

  s.progress = { cleared: {}, clears: {} };
  for (const [id, v] of Object.entries(raw.progress?.cleared || {})) if (v === true && getStage(id)) s.progress.cleared[id] = true;
  for (const [id, v] of Object.entries(raw.progress?.clears || {})) if (getStage(id)) s.progress.clears[id] = int(v, 0, 0, 1e9);

  // v2: skills + story. A v1 save gets defaults, plus the memory flags of bosses it already beat.
  const rawSkills = raw.skills || {};
  s.skills.ranks = {};
  for (const [id, r] of Object.entries(rawSkills.ranks || {})) {
    if (SKILLS[id]) s.skills.ranks[id] = int(r, 0, 0, SKILLS[id].maxRank);
    else warnings.push(`ลบสกิลที่ไม่รู้จัก (${String(id)})`);
  }
  s.skills.slots = new Array(SKILL_SLOTS).fill(null);
  (Array.isArray(rawSkills.slots) ? rawSkills.slots : []).slice(0, SKILL_SLOTS).forEach((id, i) => {
    if (id && SKILLS[id]?.kind === 'active' && s.skills.ranks[id] > 0 && !s.skills.slots.includes(id)) s.skills.slots[i] = id;
  });
  const rawStory = raw.story || {};
  s.story.name = cleanHeroName(rawStory.name);
  for (const k of ['flags', 'seen', 'lore']) {
    s.story[k] = {};
    for (const [id, v] of Object.entries(rawStory[k] || {})) {
      if (v !== true) continue;
      if (k === 'lore' && !LORE[id]) continue;
      if (k === 'seen' && !SCENES[id]) continue;
      s.story[k][id] = true;
    }
  }
  if (raw.version < 2) {
    // Older saves meet the story from the prologue; scenes for bosses already beaten replay at camp (see systems/story.js).
    warnings.push('อัปเดตเซฟเป็นเวอร์ชันใหม่: เพิ่มระบบสกิลและเนื้อเรื่อง');
  }
  // v3: bloodline, Amber Sparks and pets. Older saves awaken their bloodline for free at camp
  // and get starting sparks plus a little extra for every stage they already cleared.
  if (raw.version < 3) {
    s.race = { id: null, rolls: 0 };
    s.sparks = START_SPARKS + 10 * Object.keys(s.progress.cleared).length;
    warnings.push('อัปเดตเซฟเป็นเวอร์ชันใหม่: เพิ่มสายเลือด สัตว์เลี้ยง และอาวุธใหม่ (ได้ประกายอำพันเริ่มต้น)');
  } else {
    const rid = raw.race?.id ?? null;
    s.race = { id: getRace(rid) ? rid : null, rolls: int(raw.race?.rolls, 0, 0, 1e6) };
    if (rid != null && !getRace(rid)) warnings.push(`เผ่าที่ไม่รู้จัก (${String(rid)}) — ปลุกสายเลือดใหม่ได้ฟรี`);
    s.sparks = int(raw.sparks, 0, 0, CAPS.sparks);
  }
  s.raceSlots = [0, 1].map((i) => { const id = raw.raceSlots?.[i]; return getRace(id) && id !== s.race.id ? id : null; });
  if (s.raceSlots[0] && s.raceSlots[0] === s.raceSlots[1]) s.raceSlots[1] = null;
  s.raceSeen = {};
  for (const id of [...Object.keys(raw.raceSeen || {}), s.race.id, ...s.raceSlots]) if (getRace(id)) s.raceSeen[id] = true;
  s.pets = { owned: {}, active: [], pity: 0, summons: 0 };
  for (const [id, v] of Object.entries(raw.pets?.owned || {})) {
    if (!getPet(id)) { warnings.push(`ลบสัตว์เลี้ยงที่ไม่รู้จัก (${String(id)})`); continue; }
    s.pets.owned[id] = { stars: int(v?.stars, 1, 1, MAX_STARS) };
  }
  // v7: a team of up to PET_TEAM pets (older saves kept one id)
  const act = raw.pets?.active;
  for (const id of Array.isArray(act) ? act : act ? [act] : []) if (typeof id === 'string' && s.pets.owned[id] && !s.pets.active.includes(id) && s.pets.active.length < PET_TEAM) s.pets.active.push(id);
  s.pets.pity = int(raw.pets?.pity, 0, 0, PITY - 1);
  s.pets.summons = int(raw.pets?.summons, 0, 0, 1e9);

  // v4: online — friends (account id → last seen name) and the duel record.
  s.social = { friends: {} };
  let nFriends = 0;
  for (const [uid, f] of Object.entries(raw.social?.friends || {})) {
    if (!ID_RE.test(uid) || !f || typeof f !== 'object' || nFriends >= FRIENDS_MAX) continue;
    s.social.friends[uid] = { name: cleanHeroName(f.name), at: num(f.at, 0, 0, 1e15) };
    nFriends++;
  }
  s.pvp = { wins: int(raw.pvp?.wins, 0, 0, 1e9), losses: int(raw.pvp?.losses, 0, 0, 1e9) };
  // v5: online zones
  s.zones = { cleared: {}, best: {} };
  for (const [id, v] of Object.entries(raw.zones?.cleared || {})) if (getZone(id)) s.zones.cleared[id] = int(v, 0, 0, 1e9);
  for (const [id, v] of Object.entries(raw.zones?.best || {})) if (getZone(id) && typeof v === 'number' && v > 0) s.zones.best[id] = int(v, 1, 1, 1e7);
  s.artifacts = { owned: {}, slots: {} };
  for (const [id, v] of Object.entries(raw.artifacts?.owned || {})) if (getArtifact(id) && v && typeof v === 'object') s.artifacts.owned[id] = { lvl: int(v.lvl, 1, 1, ART_LEVEL_MAX) };
  for (const [slot, id] of Object.entries(raw.artifacts?.slots || {})) if (getSlot(slot) && s.artifacts.owned[id] && !Object.values(s.artifacts.slots).includes(id)) s.artifacts.slots[slot] = id;
  s.infinite = { day: typeof raw.infinite?.day === 'string' ? raw.infinite.day.slice(0, 12) : '', used: int(raw.infinite?.used, 0, 0, 99), best: int(raw.infinite?.best, 0, 0, 1e6), runs: int(raw.infinite?.runs, 0, 0, 1e9) };
  // v7: the Underworld Tower and titles
  const tw = raw.tower || {};
  s.tower = { best: int(tw.best, 0, 0, 100), asc: int(tw.asc, 0, 0, 999), bestAsc: int(tw.bestAsc, 0, 0, 999), runs: int(tw.runs, 0, 0, 1e9), kills: int(tw.kills, 0, 0, 1e12), gods: {}, claimed: {}, deepest: int(tw.deepest, 0, 0, 1e6) };
  s.tower.bestAsc = Math.max(s.tower.bestAsc, s.tower.asc);
  s.tower.deepest = Math.min(s.tower.deepest, s.tower.asc * 100 + 100);
  for (const g of GODS) if (tw.gods?.[g.id]) s.tower.gods[g.id] = int(tw.gods[g.id], 0, 0, 1e9);
  let nClaim = 0;
  for (const k of Object.keys(tw.claimed || {})) if (/^\d{1,3}:\d{1,3}$/.test(k) && nClaim++ < 20000) s.tower.claimed[k] = 1;
  s.titles = { owned: {}, equipped: null };
  for (const [id, at] of Object.entries(raw.titles?.owned || {})) if (getTitle(id)) s.titles.owned[id] = num(at, 0, 0, 9e15);
  s.titles.equipped = getTitle(raw.titles?.equipped) && s.titles.owned[raw.titles.equipped] ? raw.titles.equipped : null;
  s.profile = { avatar: avatarOk(raw.profile?.avatar) ? raw.profile.avatar : null, bio: cleanBio(raw.profile?.bio) };
  s.blueprints = {};
  for (const [id, v] of Object.entries(raw.blueprints || {})) if (v === true && isEquipment(getItem(id))) s.blueprints[id] = true;
  s.raids = {};
  for (const [id, v] of Object.entries(raw.raids || {})) if (isRaid(id) && v && typeof v === 'object') s.raids[id] = { last: int(v.last, 0, 0, 9e15), kills: int(v.kills, 0, 0, 1e9) };
  const g = raw.guild;
  s.guild = g && isGuildId(g.id) && cleanGuildName(g.name) && cleanTag(g.tag) ? { id: g.id, name: cleanGuildName(g.name), tag: cleanTag(g.tag) } : null;

  s.integrity = raw.integrity === 'modified' ? 'modified' : 'ok';

  // Skill points can never exceed what the level grants (protects against edited saves).
  let spent = Object.values(s.skills.ranks).reduce((a, r) => a + r, 0);
  if (spent > s.player.level - 1) { s.skills.ranks = {}; s.skills.slots.fill(null); warnings.push('แต้มสกิลเกินเลเวล จึงคืนแต้มทั้งหมด'); spent = 0; }

  return { state: s, warnings };
}

export function serialize(state) {
  return JSON.stringify({ ...state, version: SAVE_VERSION, updatedAt: Date.now() });
}

// `slot` keeps a separate save (used by the multi-tab online tests: ?slot=b).
// Saves are signed (src/persistence/integrity.js). On load:
//   genuine            → used as is
//   unsigned, v ≤ 5     → a save from before signing: accepted once and signed on the next save
//   anything else       → edited outside the game: the last genuine copy (.bak) is restored, or, without one,
//                         the edited save is kept but marked 'modified' (no trading or PvP with it)
export function createSaveStore(storage, slot = '') {
  const SAVE_KEY = slot ? `${BASE_KEY}.${slot}` : BASE_KEY;
  const CORRUPT_KEY = SAVE_KEY + '.corrupt';
  const BAK_KEY = SAVE_KEY + '.bak';
  const key = () => deviceKey(storage);
  const read = (k) => { try { return storage.getItem(k); } catch { return null; } };
  return {
    exists() {
      try { return storage.getItem(SAVE_KEY) != null; } catch { return false; }
    },
    // Returns { state, warnings, integrity } | { state:null, error } | { state:null } when no save.
    load() {
      let text;
      try { text = storage.getItem(SAVE_KEY); } catch (e) { return { state: null, error: 'ไม่สามารถอ่านพื้นที่บันทึกของเบราว์เซอร์ได้' }; }
      // the main copy is gone but the backup written beside it survived: use the backup
      if (text == null) { const bak = read(BAK_KEY); if (bak == null) return { state: null }; text = bak; }
      try {
        const v = verify(text, key());
        const raw = JSON.parse(v.payload);
        if (v.status === 'genuine' || (v.status === 'unsigned' && typeof raw?.version === 'number' && raw.version < 6)) return { ...sanitize(raw), integrity: v.status };
        // edited outside the game
        const bak = read(BAK_KEY);
        const b = bak ? verify(bak, key()) : null;
        if (b?.status === 'genuine') {
          const res = sanitize(JSON.parse(b.payload));
          res.warnings.unshift('พบการแก้ไขเซฟจากภายนอกเกม จึงย้อนกลับไปใช้เซฟล่าสุดที่ถูกต้อง');
          return { ...res, integrity: 'restored' };
        }
        const res = sanitize(raw);
        res.state.integrity = 'modified';
        res.warnings.unshift('พบการแก้ไขเซฟจากภายนอกเกม เซฟนี้ถูกทำเครื่องหมายไว้ (แลกเปลี่ยนและ PvP ไม่ได้)');
        return { ...res, integrity: 'modified' };
      } catch (e) {
        try { storage.setItem(CORRUPT_KEY, text); storage.removeItem(SAVE_KEY); } catch { /* storage unavailable; nothing else to do */ }
        // the backup written beside it may still be whole
        const bak = read(BAK_KEY);
        if (bak && bak !== text) {
          try {
            const b = verify(bak, key());
            if (b.status === 'genuine') {
              const res = sanitize(JSON.parse(b.payload));
              res.warnings.unshift('เซฟหลักเสียหาย จึงใช้สำเนาสำรองล่าสุดแทน');
              return { ...res, integrity: 'restored' };
            }
          } catch { /* the backup is damaged too */ }
        }
        return { state: null, error: `ไฟล์เซฟเสียหาย (${e.message}) สำเนาเดิมถูกเก็บไว้แยกแล้ว` };
      }
    },
    save(state) {
      try {
        const text = sign(serialize(state), key());
        storage.setItem(SAVE_KEY, text);
        storage.setItem(BAK_KEY, text);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    // a save that could not be read is kept aside (never deleted): the title screen offers it for download
    corrupt() { return read(CORRUPT_KEY); },
    clear() {
      try { storage.removeItem(SAVE_KEY); storage.removeItem(BAK_KEY); } catch { /* ignore: nothing to clear */ }
    },
    // development hosts only (tests patch saves, then re-sign them): see main.js
    resign(k) {
      const t = read(k);
      if (t == null) return false;
      const v = verify(t, key());
      storage.setItem(k, sign(v.payload, key()));
      return true;
    },
  };
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

// localStorage can throw on access (private mode, blocked storage). Fall back to memory.
export function browserStorage() {
  try {
    const t = '__eh_probe__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return { storage: window.localStorage, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}
