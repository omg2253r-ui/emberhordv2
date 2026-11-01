// Guilds: a named group with a tag, roles (leader / officer / member), a notice board, a member list with who is
// online, and its own chat channel. The guild lives in a shared document (src/net/docs.js) so it survives
// sessions; each member's save keeps { id, name, tag } so the game knows which guild to load.
// There is no server referee: every client checks the rules below before it writes, and validates what it reads.
import { cloneState, cleanHeroName } from '../core/state.js';
import { ID_RE, cleanChat } from './protocol.js';

export const GUILD_COST = 300;
export const GUILD_MAX = 30;
export const NOTICE_MAX = 140;
export const ROLES = Object.freeze({ leader: 3, officer: 2, member: 1 });
export const ROLE_NAME = Object.freeze({ leader: 'หัวหน้า', officer: 'รองหัวหน้า', member: 'สมาชิก' });
const GID_RE = /^g[a-z0-9]{6,16}$/;

const strip = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
export function cleanGuildName(raw) { const s = Array.from(strip(raw)).slice(0, 16).join(''); return Array.from(s).length >= 3 ? s : null; }
export function cleanTag(raw) { const s = strip(raw).replace(/[^A-Za-z0-9ก-๙]/g, ''); const a = Array.from(s).slice(0, 4).join(''); return Array.from(a).length >= 2 ? a.toUpperCase() : null; }
export function isGuildId(v) { return typeof v === 'string' && GID_RE.test(v); }

// A guild document as written by anyone: keep only well-formed fields.
export function readGuild(raw) {
  if (!raw || typeof raw !== 'object' || raw.disbanded) return null;
  const name = cleanGuildName(raw.name), tag = cleanTag(raw.tag);
  if (!name || !tag || !ID_RE.test(raw.leader || '')) return null;
  const members = {};
  let n = 0;
  for (const [uid, m] of Object.entries(raw.members || {})) {
    if (!m || typeof m !== 'object' || !ID_RE.test(uid) || n >= GUILD_MAX) continue;
    members[uid] = { name: cleanHeroName(m.name), role: ROLES[m.role] ? m.role : 'member', at: typeof m.at === 'number' ? m.at : 0 };
    n++;
  }
  if (!members[raw.leader]) return null;
  members[raw.leader].role = 'leader';
  for (const [uid, m] of Object.entries(members)) if (m.role === 'leader' && uid !== raw.leader) m.role = 'officer';
  return { name, tag, notice: Array.from(strip(raw.notice)).slice(0, NOTICE_MAX).join(''), leader: raw.leader, members, created: typeof raw.created === 'number' ? raw.created : 0 };
}

// What may `uid` do to `target` in guild `g`?
export function can(g, uid, action, target = null) {
  const me = g?.members[uid];
  if (!me) return false;
  const r = ROLES[me.role], t = target ? g.members[target] : null;
  switch (action) {
    case 'invite': return true;
    case 'notice': return r >= ROLES.officer;
    case 'kick': return !!t && target !== uid && r > ROLES[t.role] && r >= ROLES.officer;
    case 'promote': return !!t && me.role === 'leader' && t.role === 'member';
    case 'demote': return !!t && me.role === 'leader' && t.role === 'officer';
    default: return false;
  }
}

// The member who takes over when the leader leaves: an officer first, then the longest-standing member.
export function successor(g, leaving) {
  const rest = Object.entries(g.members).filter(([uid]) => uid !== leaving);
  if (!rest.length) return null;
  rest.sort((a, b) => (ROLES[b[1].role] - ROLES[a[1].role]) || (a[1].at - b[1].at));
  return rest[0][0];
}

// ------------------------------------------------------------------ session
export function createGuildSession(app) {
  const subs = new Set();
  let docs = null, unsub = null, gid = null, data = null, room = null, roomGid = null, loading = false;
  const changed = () => { for (const fn of subs) fn(data); };
  const uid = () => app.online.me.uid;
  const ref = (id) => docs.doc(`guilds/${id}`);

  function setSaveGuild(g) {
    const next = cloneState(app.store.get());
    next.guild = g ? { id: g.id, name: g.name, tag: g.tag } : null;
    app.store.commit(next, { reason: 'guild' });
    app.online.refreshLook();
  }

  function watch(id) {
    unsub?.(); unsub = null; data = null;
    gid = id;
    if (!id || !docs) { joinRoom(null); changed(); return; }
    loading = true;
    unsub = ref(id).onSnapshot((raw) => {
      loading = false;
      const g = readGuild(raw);
      const me = uid();
      if (!g || (me && !g.members[me])) {
        // disbanded, or I was removed
        const was = app.store.get().guild;
        data = null;
        if (was?.id === id) { setSaveGuild(null); app.toast(g ? `คุณไม่ได้อยู่ในกิลด์ ${was.name} แล้ว` : `กิลด์ ${was.name} ถูกยุบแล้ว`, 'info', 'guild'); }
        joinRoom(null); changed();
        return;
      }
      data = { id, ...g };
      const st = app.store.get();
      if (st.guild?.name !== g.name || st.guild?.tag !== g.tag) setSaveGuild(data);
      joinRoom(id);
      changed();
    });
  }

  async function joinRoom(id) {
    if (roomGid === id) return;
    room?.leave?.(); room = null; roomGid = id;
    if (!id || !app.online.online) return;
    const r = await app.online.net.join('guild-' + id).catch(() => null);
    if (roomGid !== id) { r?.leave?.(); return; }
    room = r;
    room?.on('chat', (m) => {
      const t = cleanChat(m.data?.text); if (!t) return;
      const who = m.sameTab ? app.store.get().story.name : (data?.members[m.by]?.name || 'สมาชิก');
      app.online.addChat({ ch: 'guild', peer: m.peer, name: who, text: t, me: m.sameTab, at: Date.now() });
    });
  }

  async function write(id, patch) {
    try { await ref(id).update(patch); return { ok: true }; }
    catch { return { ok: false, reason: 'write_failed' }; }
  }
  // Where the server referees guilds (Netlify), every change is a named action it checks; elsewhere the browser writes.
  const serverOps = () => typeof docs?.guildOp === 'function';
  const op = (name, id, args) => docs.guildOp(name, id, args).catch(() => ({ ok: false, reason: 'write_failed' }));

  return {
    // called when the network is ready (and again if it changes)
    attach(store) { docs = store; watch(app.store.get().guild?.id || null); },
    get available() { return !!docs && !!uid(); },
    get current() { return data; },
    get loading() { return loading; },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },

    async create(rawName, rawTag) {
      if (!this.available) return { ok: false, reason: 'unavailable' };
      if (data) return { ok: false, reason: 'already_in_guild' };
      const name = cleanGuildName(rawName), tag = cleanTag(rawTag);
      if (!name) return { ok: false, reason: 'bad_name' };
      if (!tag) return { ok: false, reason: 'bad_tag' };
      const st = app.store.get();
      if (st.gold < GUILD_COST) return { ok: false, reason: 'not_enough_gold' };
      const id = 'g' + Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
      const me = uid();
      if (serverOps()) { const r = await op('create', id, { name, tag, hero: st.story.name }); if (!r.ok) return r; }
      else {
        try { await ref(id).set({ name, tag, notice: '', leader: me, created: Date.now(), members: { [me]: { name: st.story.name, role: 'leader', at: Date.now() } } }); }
        catch { return { ok: false, reason: 'write_failed' }; }
      }
      const next = cloneState(app.store.get());
      next.gold -= GUILD_COST;
      next.guild = { id, name, tag };
      app.store.commit(next, { reason: 'guild' });
      app.online.refreshLook();
      watch(id);
      return { ok: true };
    },

    async join(id) {
      if (!this.available || !isGuildId(id)) return { ok: false, reason: 'unavailable' };
      if (data) return { ok: false, reason: 'already_in_guild' };
      const g = readGuild(await ref(id).get().catch(() => null));
      if (!g) return { ok: false, reason: 'no_guild' };
      if (Object.keys(g.members).length >= GUILD_MAX) return { ok: false, reason: 'guild_full' };
      const r = serverOps() ? await op('join', id, { hero: app.store.get().story.name })
        : await write(id, { members: { [uid()]: { name: app.store.get().story.name, role: 'member', at: Date.now() } } });
      if (!r.ok) return r;
      setSaveGuild({ id, name: g.name, tag: g.tag });
      watch(id);
      return { ok: true, name: g.name };
    },

    async leave() {
      if (!data) return { ok: false, reason: 'no_guild' };
      const me = uid(), id = data.id;
      if (serverOps()) { const r = await op('leave', id); if (!r.ok) return r; }
      else if (data.leader === me) {
        const next = successor(data, me);
        if (!next) { try { await ref(id).set({ disbanded: true, name: data.name, tag: data.tag, leader: me, members: {} }); } catch { return { ok: false, reason: 'write_failed' }; } }
        else { const r = await write(id, { leader: next, members: { [me]: null, [next]: { ...data.members[next], role: 'leader' } } }); if (!r.ok) return r; }
      } else {
        const r = await write(id, { members: { [me]: null } });
        if (!r.ok) return r;
      }
      setSaveGuild(null);
      watch(null);
      return { ok: true };
    },

    async kick(target) {
      if (!can(data, uid(), 'kick', target)) return { ok: false, reason: 'not_allowed' };
      if (serverOps()) return op('kick', data.id, { target });
      return write(data.id, { members: { [target]: null } });
    },
    async promote(target) {
      if (!can(data, uid(), 'promote', target)) return { ok: false, reason: 'not_allowed' };
      if (serverOps()) return op('promote', data.id, { target });
      return write(data.id, { members: { [target]: { ...data.members[target], role: 'officer' } } });
    },
    async demote(target) {
      if (!can(data, uid(), 'demote', target)) return { ok: false, reason: 'not_allowed' };
      if (serverOps()) return op('demote', data.id, { target });
      return write(data.id, { members: { [target]: { ...data.members[target], role: 'member' } } });
    },
    async setNotice(text) {
      if (!can(data, uid(), 'notice')) return { ok: false, reason: 'not_allowed' };
      const notice = Array.from(strip(text)).slice(0, NOTICE_MAX).join('');
      if (serverOps()) return op('notice', data.id, { text: notice });
      return write(data.id, { notice });
    },
    // Before an invitation is sent: the server only lets invited players join.
    async invite(targetUid) {
      if (!data) return { ok: false, reason: 'no_guild' };
      if (!serverOps()) return { ok: true };
      return op('invite', data.id, { target: targetUid });
    },
    async sendChat(text) {
      const t = cleanChat(text);
      if (!t) return { ok: false, reason: 'empty' };
      if (!room) return { ok: false, reason: 'no_guild' };
      await room.emit('chat', { text: t });
      return { ok: true };
    },
    can: (action, target) => can(data, uid(), action, target),
  };
}
