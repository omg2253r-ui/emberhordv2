// Player profiles (โปรไฟล์): my own picture and a short line about me, and the public "card" other players see:
// the hero as they look (armour, weapon, wings, bloodline), artifacts on the Cosmic Tree, the pet team, stats and
// records. The card is built from the save (by the player's own game when shown in the village, and by the server
// from the uploaded save for the leaderboards) and is always cleaned by readCard before it is shown.
import { getItem, EQUIP_SLOTS } from '../data/items.js';
import { getRace } from '../data/races.js';
import { getPet, PET_TEAM } from '../data/pets.js';
import { getArtifact } from '../data/artifacts.js';
import { getTitle, badgeTier } from '../data/titles.js';
import { computeStats } from './stats.js';
import { teamOf } from './pets.js';
import { cleanHeroName, cloneState } from '../core/state.js';

export const AVATAR_PX = 128;
export const AVATAR_MAX = 28 * 1024;         // characters of the data URL
export const BIO_MAX = 80;
const AVATAR_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

export const avatarOk = (v) => typeof v === 'string' && v.length <= AVATAR_MAX && AVATAR_RE.test(v);
export function cleanBio(v) {
  return Array.from(String(v ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, BIO_MAX).join('');
}

// ------------------------------------------------------------------ my profile
export function setAvatar(state, dataUrl) {
  if (dataUrl !== null && !avatarOk(dataUrl)) return { ok: false, reason: 'bad_avatar' };
  const next = cloneState(state);
  next.profile = { ...(next.profile || {}), avatar: dataUrl };
  return { ok: true, state: next };
}
export function setBio(state, text) {
  const next = cloneState(state);
  next.profile = { ...(next.profile || {}), bio: cleanBio(text) };
  return { ok: true, state: next };
}

// power: one number to compare heroes (the same formula as the leaderboard)
export function powerOf(stats) { return Math.round(stats.atk * 3 + stats.def * 2.5 + stats.maxHp * 0.35 + stats.crit * 400 + (stats.critMult - 1.5) * 60); }

// ------------------------------------------------------------------ the public card
export function publicCard(state) {
  const t = computeStats(state);
  const eq = {};
  for (const s of EQUIP_SLOTS) { const it = state.equipment[s]; if (it) eq[s] = [it.id, it.lvl || 0]; }
  const arts = [];
  for (const [slot, id] of Object.entries(state.artifacts?.slots || {})) if (getArtifact(id)) arts.push([id, state.artifacts.owned?.[id]?.lvl || 1, slot]);
  const team = teamOf(state).map((id) => [id, state.pets?.owned?.[id]?.stars || 1]);
  const raids = Object.values(state.raids || {}).reduce((a, r) => a + (r?.kills || 0), 0);
  const zones = Object.values(state.zones?.cleared || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  return {
    v: 1,
    n: state.story.name, lv: state.player.level, r: state.race?.id || null,
    tt: state.titles?.equipped || null, tb: state.titles ? badgeTier(state) : 0,
    gt: state.guild?.tag || null, gn: state.guild?.name || null,
    av: avatarOk(state.profile?.avatar) ? state.profile.avatar : null,
    bio: cleanBio(state.profile?.bio),
    eq, arts: arts.slice(0, 24), pets: team, petCount: Object.keys(state.pets?.owned || {}).length,
    st: { power: powerOf(t), atk: Math.round(t.atk), def: Math.round(t.def), hp: Math.round(t.maxHp), crit: Math.round(t.crit * 1000) / 10, critMult: Math.round(t.critMult * 100) / 100 },
    rec: {
      tower: state.tower?.deepest || 0, asc: state.tower?.bestAsc || 0, gods: Object.keys(state.tower?.gods || {}).length,
      pvpW: state.pvp?.wins || 0, pvpL: state.pvp?.losses || 0, kills: state.stats?.kills || 0, rift: state.infinite?.best || 0,
      raids, zones, titles: Object.keys(state.titles?.owned || {}).length, races: Object.keys(state.raceSeen || {}).length,
      bag: state.inventory?.capacity || 30,
    },
    mod: state.integrity === 'modified' ? 1 : 0,
  };
}

const num = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const int = (v, lo, hi) => Math.round(num(v, lo, hi, lo));
// A card from another player (or the server): every id is checked, every number clamped, the picture validated.
export function readCard(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  const eq = {};
  for (const s of EQUIP_SLOTS) {
    const e = raw.eq?.[s];
    if (!Array.isArray(e)) continue;
    const def = getItem(e[0]);
    if (def && def.category === s) eq[s] = [def.id, int(e[1], 0, 99)];
  }
  if (!eq.weapon) eq.weapon = ['w_rust_blade', 0];
  const arts = (Array.isArray(raw.arts) ? raw.arts : []).filter((a) => Array.isArray(a) && getArtifact(a[0])).slice(0, 24).map((a) => [a[0], int(a[1], 1, 9), typeof a[2] === 'string' ? a[2].slice(0, 24) : '']);
  const pets = (Array.isArray(raw.pets) ? raw.pets : []).filter((p) => Array.isArray(p) && getPet(p[0])).slice(0, PET_TEAM).map((p) => [p[0], int(p[1], 1, 5)]);
  const st = raw.st || {}, rec = raw.rec || {};
  const gt = typeof raw.gt === 'string' && /^[A-Z0-9ก-๙]{2,4}$/.test(raw.gt) ? raw.gt : null;
  return {
    name: cleanHeroName(String(raw.n || '')) || 'นักล่า', lv: int(raw.lv, 1, 100),
    race: getRace(raw.r) ? raw.r : null, title: getTitle(raw.tt) ? raw.tt : null, badge: int(raw.tb, 0, 20),
    gtag: gt, gname: gt && typeof raw.gn === 'string' ? cleanBio(raw.gn).slice(0, 16) : null,
    avatar: avatarOk(raw.av) ? raw.av : null, bio: cleanBio(raw.bio),
    eq, arts, pets, petCount: int(raw.petCount, 0, 999),
    st: { power: int(st.power, 0, 1e7), atk: int(st.atk, 0, 1e6), def: int(st.def, 0, 1e6), hp: int(st.hp, 0, 1e7), crit: num(st.crit, 0, 100, 0), critMult: num(st.critMult, 1, 10, 1.5) },
    rec: {
      tower: int(rec.tower, 0, 1e6), asc: int(rec.asc, 0, 999), gods: int(rec.gods, 0, 99), pvpW: int(rec.pvpW, 0, 1e7), pvpL: int(rec.pvpL, 0, 1e7),
      kills: int(rec.kills, 0, 1e9), rift: int(rec.rift, 0, 1e5), raids: int(rec.raids, 0, 1e7), zones: int(rec.zones, 0, 1e7),
      titles: int(rec.titles, 0, 999), races: int(rec.races, 0, 999), bag: int(rec.bag, 0, 1e5),
    },
    modified: raw.mod === 1,
  };
}
