// What players tell each other, and how untrusted data from other players is cleaned before use.
// Pure functions: unit-tested without a network.
import { getItem } from '../data/items.js';
import { getRace } from '../data/races.js';
import { getPet, PET_TEAM } from '../data/pets.js';
import { teamOf } from '../systems/pets.js';
import { getTitle, badgeTier } from '../data/titles.js';
import { cleanHeroName } from '../core/state.js';
import { cloneState } from '../core/state.js';
import { readAdvert } from './match.js';

export const PROTOCOL = 1;
export const PARTY_MAX = 4;
export const CHAT_MAX = 120;
export const REQUEST_TTL = 30000;
export const FRIENDS_MAX = 50;

const num = (v, lo, hi, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const str = (v, max) => (typeof v === 'string' ? Array.from(v.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')).slice(0, max).join('') : '');
export const ID_RE = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9_.:@+~=/-]{1,128}$/;   // peer labels and account ids (opaque)
export const idOk = (v) => typeof v === 'string' && ID_RE.test(v);

// ---------------------------------------------------------------- presence
// My public look + position, kept small (presence is limited to 4 KiB and sent ~30×/s).
export function lookOf(state) {
  return {
    n: state.story.name, lv: state.player.level,
    r: state.race?.id || null, a: state.equipment.armor?.id || null, w: state.equipment.weapon?.id || null,
    pt: state.pets ? teamOf(state)[0] || null : null,
    ps: state.pets ? teamOf(state) : [],
    tt: state.titles?.equipped || null,            // v7: the worn title
    tb: state.titles ? badgeTier(state) : 0,       // v7: honour badge tier
    wg: state.equipment.wings?.id || null,
    gt: state.guild?.tag || null,
    im: state.integrity === 'modified' ? 1 : 0,
  };
}

// Cleans a presence object from another player. Unknown ids become null so nothing can break rendering.
export function readPresence(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== PROTOCOL) return null;
  const w = getItem(raw.w);
  const a = getItem(raw.a);
  const wg = getItem(raw.wg);
  return {
    zone: str(raw.z, 24), x: num(raw.x, -100, 5000), y: num(raw.y, -100, 5000),
    flip: !!raw.f, moving: !!raw.m, dash: !!raw.d,
    name: cleanHeroName(str(raw.n, 40)), lv: Math.round(num(raw.lv, 1, 100, 1)),
    race: getRace(raw.r) ? raw.r : null,
    armor: a && a.category === 'armor' ? a.id : null,
    weapon: w && w.category === 'weapon' ? w.id : 'w_rust_blade',
    wings: wg && wg.category === 'wings' ? wg.id : null,
    pet: getPet(raw.pt) ? raw.pt : null,
    title: getTitle(raw.tt) ? raw.tt : null,
    badge: Math.round(num(raw.tb, 0, 20, 0)),
    pets: Array.isArray(raw.ps) ? raw.ps.filter((id) => typeof id === 'string' && getPet(id)).slice(0, PET_TEAM) : (getPet(raw.pt) ? [raw.pt] : []),
    party: idOk(raw.py) ? raw.py : null,
    uid: idOk(raw.u) ? raw.u : null,
    emote: str(raw.e, 16),
    busy: str(raw.b, 16),
    room: readAdvert(raw.pr),          // an open PvP room this player hosts
    gtag: typeof raw.gt === 'string' && /^[A-Z0-9ก-๙]{2,4}$/.test(raw.gt) ? raw.gt : null,
    modified: raw.im === 1,
  };
}

// ---------------------------------------------------------------- chat
export function cleanChat(text) {
  return str(String(text ?? ''), CHAT_MAX).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- friends (kept in the save)
export function addFriend(state, uid, name) {
  if (!idOk(uid)) return { ok: false, reason: 'bad_id' };
  const friends = state.social?.friends || {};
  if (friends[uid]) return { ok: false, reason: 'already_friend' };
  if (Object.keys(friends).length >= FRIENDS_MAX) return { ok: false, reason: 'friends_full' };
  const next = cloneState(state);
  next.social.friends[uid] = { name: cleanHeroName(name), at: Date.now() };
  return { ok: true, state: next };
}

export function removeFriend(state, uid) {
  if (!state.social?.friends?.[uid]) return { ok: false, reason: 'not_friend' };
  const next = cloneState(state);
  delete next.social.friends[uid];
  return { ok: true, state: next };
}

// The last name a friend was seen with is refreshed when they come online.
export function touchFriend(state, uid, name) {
  const f = state.social?.friends?.[uid];
  if (!f || f.name === cleanHeroName(name)) return null;
  const next = cloneState(state);
  next.social.friends[uid].name = cleanHeroName(name);
  return next;
}

// ---------------------------------------------------------------- party (session state, owned by the leader)
export function newParty(id, leader) {
  return { id, leader: leader.peer, members: [leader] };
}

export function partyAdd(party, member) {
  if (!party) return { ok: false, reason: 'no_party' };
  if (party.members.some((m) => m.peer === member.peer)) return { ok: false, reason: 'already_member' };
  if (party.members.length >= PARTY_MAX) return { ok: false, reason: 'party_full' };
  return { ok: true, party: { ...party, members: [...party.members, member] } };
}

export function partyRemove(party, peer) {
  if (!party || !party.members.some((m) => m.peer === peer)) return { ok: false, reason: 'not_member' };
  const members = party.members.filter((m) => m.peer !== peer);
  if (!members.length) return { ok: true, party: null };
  // the leader leaving hands the party to the longest-standing member
  const leader = party.leader === peer ? members[0].peer : party.leader;
  return { ok: true, party: { ...party, leader, members } };
}

// A roster message from another player is accepted from the party's leader (or from the leader I already follow,
// who may be handing the party to someone else) and only if well-formed. An empty member list disbands the party.
export function readRoster(data, fromPeer, trustedLeader = null) {
  if (!data || !idOk(data.pid) || !idOk(data.leader) || !Array.isArray(data.members)) return null;
  if (data.leader !== fromPeer && fromPeer !== trustedLeader) return null;
  const members = data.members.slice(0, PARTY_MAX).filter((m) => m && idOk(m.peer)).map((m) => ({ peer: m.peer, uid: idOk(m.uid) ? m.uid : null, name: cleanHeroName(str(m.name, 40)), lv: Math.round(num(m.lv, 1, 100, 1)) }));
  if (members.length && !members.some((m) => m.peer === data.leader)) return null;
  return { id: data.pid, leader: data.leader, members };
}

export function rid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
