// Guild rules enforced by the server (Netlify). The browser checks the same rules (src/online/guild.js) to show the
// right buttons, but only what passes here is ever written: a modified game cannot promote itself, kick the leader,
// join without an invitation, or rewrite someone else's guild.
//
// Document: { name, tag, notice, leader, created, members: { uid: { name, role, at } }, invites: { uid: expiresAt } }

export const GUILD_MAX = 30;
export const NOTICE_MAX = 140;
export const INVITE_TTL = 10 * 60_000;
const ROLES = { leader: 3, officer: 2, member: 1 };
const GID_RE = /^g[a-z0-9]{6,16}$/;
const UID_RE = /^u[a-z0-9]{14}$/;

const strip = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
export const cleanGuildName = (raw) => { const s = Array.from(strip(raw)).slice(0, 16).join(''); return Array.from(s).length >= 3 ? s : null; };
export const cleanTag = (raw) => { const a = Array.from(strip(raw).replace(/[^A-Za-z0-9ก-๙]/g, '')).slice(0, 4).join(''); return Array.from(a).length >= 2 ? a.toUpperCase() : null; };
export const cleanHero = (raw) => Array.from(strip(raw)).slice(0, 16).join('') || 'นักล่า';
export const isGid = (v) => typeof v === 'string' && GID_RE.test(v);
export const isUid = (v) => typeof v === 'string' && UID_RE.test(v);

function successor(g, leaving) {
  const rest = Object.entries(g.members).filter(([u]) => u !== leaving);
  if (!rest.length) return null;
  rest.sort((a, b) => (ROLES[b[1].role] - ROLES[a[1].role]) || (a[1].at - b[1].at));
  return rest[0][0];
}

// Applies one action. Returns { ok, doc } (doc null = delete the guild) or { ok: false, reason }.
export function applyGuildOp(doc, op, actor, args, now = Date.now()) {
  const g = doc && !doc.disbanded ? structuredClone(doc) : null;
  if (op === 'create') {
    if (g) return { ok: false, reason: 'exists' };
    const name = cleanGuildName(args.name), tag = cleanTag(args.tag);
    if (!name) return { ok: false, reason: 'bad_name' };
    if (!tag) return { ok: false, reason: 'bad_tag' };
    return { ok: true, doc: { name, tag, notice: '', leader: actor, created: now, members: { [actor]: { name: cleanHero(args.hero), role: 'leader', at: now } }, invites: {} } };
  }
  if (!g) return { ok: false, reason: 'no_guild' };
  g.members ||= {}; g.invites ||= {};
  for (const [u, t] of Object.entries(g.invites)) if (!(t > now)) delete g.invites[u];
  const me = g.members[actor];
  const target = args.target;
  const them = isUid(target) ? g.members[target] : null;

  switch (op) {
    case 'invite': {
      if (!me) return { ok: false, reason: 'not_member' };
      if (!isUid(target) || them) return { ok: false, reason: 'bad_target' };
      if (Object.keys(g.invites).length >= 50) return { ok: false, reason: 'too_many_invites' };
      g.invites[target] = now + INVITE_TTL;
      return { ok: true, doc: g };
    }
    case 'join': {
      if (me) return { ok: false, reason: 'already_in_guild' };
      if (!(g.invites[actor] > now)) return { ok: false, reason: 'not_invited' };
      if (Object.keys(g.members).length >= GUILD_MAX) return { ok: false, reason: 'guild_full' };
      delete g.invites[actor];
      g.members[actor] = { name: cleanHero(args.hero), role: 'member', at: now };
      return { ok: true, doc: g };
    }
    case 'leave': {
      if (!me) return { ok: false, reason: 'not_member' };
      if (g.leader === actor) {
        const next = successor(g, actor);
        if (!next) return { ok: true, doc: null };
        g.leader = next; g.members[next].role = 'leader';
      }
      delete g.members[actor];
      return { ok: true, doc: g };
    }
    case 'kick': {
      if (!me || !them || target === actor) return { ok: false, reason: 'not_allowed' };
      if (!(ROLES[me.role] >= ROLES.officer && ROLES[me.role] > ROLES[them.role])) return { ok: false, reason: 'not_allowed' };
      delete g.members[target];
      return { ok: true, doc: g };
    }
    case 'promote':
    case 'demote': {
      if (!me || me.role !== 'leader' || !them) return { ok: false, reason: 'not_allowed' };
      if (op === 'promote' ? them.role !== 'member' : them.role !== 'officer') return { ok: false, reason: 'not_allowed' };
      them.role = op === 'promote' ? 'officer' : 'member';
      return { ok: true, doc: g };
    }
    case 'notice': {
      if (!me || ROLES[me.role] < ROLES.officer) return { ok: false, reason: 'not_allowed' };
      g.notice = Array.from(strip(args.text)).slice(0, NOTICE_MAX).join('');
      return { ok: true, doc: g };
    }
    case 'rename': {
      if (!me) return { ok: false, reason: 'not_member' };
      me.name = cleanHero(args.hero);
      return { ok: true, doc: g };
    }
    default: return { ok: false, reason: 'bad_op' };
  }
}
