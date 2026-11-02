// Cloud saves (เซฟออนไลน์): one account → one hero, whatever app, browser or phone opens the game.
//
// POST /api/cloud  { op, ... }
//   register { name, pass, save? }  → { token, name, updatedAt }     create an account (optionally with the hero in hand)
//   login    { name, pass }         → { token, name, save, updatedAt } the hero kept online (save may be null)
//   push     { token, save, base }  → { updatedAt } | { conflict, updatedAt }   upload the newest save
//   pull     { token }              → { save, updatedAt }
//   logout   { token }              → { ok }
//   ranks    { board, token? }      → { board, entries, me }        leaderboards (scores computed from the pushed saves)
//   card     { account }            → { card }                      a player's public profile (built from their save)
//
// Saves travel as transfer codes (EMB1.<base64>.<check>) — the game checks and cleans them on load like any save.
// Passwords are never stored: scrypt(pass, salt). Sessions are random tokens, stored hashed, valid 180 days.
// Failed logins lock an account for 10 minutes after 8 tries; requests are also limited per IP.
//
// Keys (Netlify Blobs store "emberhold-cloud"):
//   acct/<sha256(name)>  { name, salt, hash, uid, created }
//   sess/<sha256(token)> { uid, name, exp }
//   save/<uid>           { save, updatedAt, at }
//   card/<uid>           the public profile card (systems/profile.js publicCard), rebuilt on every push
//   fail/<sha256(name)>  { n, t }
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { updateBoards, readBoard } from './rank.mjs';

const MAX_BODY = 700 * 1024;
const MAX_SAVE = 600 * 1024;
const SESSION_MS = 180 * 24 * 3600 * 1000;
const LOCK_AFTER = 8, LOCK_MS = 10 * 60 * 1000;
export const NAME_RE = /^[\p{L}\p{M}\p{N}_.-]{3,20}$/u;
export const CODE_RE = /^EMB1\.[A-Za-z0-9_-]{16,}\.[0-9a-f]{32}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
export const nameKey = (name) => String(name || '').normalize('NFC').trim().toLowerCase();
const kdf = (pass, salt) => new Promise((res, rej) => scrypt(String(pass).normalize('NFC'), salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
const readJ = async (kv, k) => { const t = await kv.get(k); if (!t) return null; try { return JSON.parse(t); } catch { return null; } };
// the moment a save was written, from inside the code (the game stamps updatedAt on every save)
export function stampOf(code) {
  try { const body = code.split('.')[1]; const text = Buffer.from(body, 'base64url').toString('utf8'); const v = JSON.parse(text).updatedAt; return Number.isFinite(v) ? v : 0; } catch { return 0; }
}

const RATE = new Map();
function limited(key, max, windowMs, now) {
  const r = RATE.get(key);
  if (!r || now - r.t > windowMs) { RATE.set(key, { n: 1, t: now }); if (RATE.size > 5000) RATE.clear(); return false; }
  r.n += 1;
  return r.n > max;
}

async function session(kv, token, now) {
  if (!TOKEN_RE.test(token || '')) return null;
  const s = await readJ(kv, 'sess/' + sha(token));
  return s && s.exp > now ? s : null;
}
async function newSession(kv, uid, name, now) {
  const token = randomBytes(24).toString('hex');
  await kv.set('sess/' + sha(token), JSON.stringify({ uid, name, exp: now + SESSION_MS }));
  return token;
}

export async function handleCloud(req, kv, now = Date.now(), ctx = {}) {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (ctx.ip && limited('ip:' + ctx.ip, 60, 60_000, now)) return json({ error: 'rate_limited' }, 429);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: 'too_big' }, 413);
  let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: 'bad_json' }, 400);
  const save = b.save == null ? null : String(b.save);
  if (save && (save.length > MAX_SAVE || !CODE_RE.test(save))) return json({ error: 'bad_save' }, 400);

  if (b.op === 'ranks') {
    const sess = b.token ? await session(kv, b.token, now) : null;
    const r = await readBoard(kv, String(b.board || ''), sess?.uid || null);
    return r ? json(r) : json({ error: 'board' }, 400);
  }
  if (b.op === 'card') {
    const name = String(b.account || '').normalize('NFC').trim();
    if (!NAME_RE.test(name)) return json({ error: 'bad_name' }, 400);
    const acct = await readJ(kv, 'acct/' + sha(nameKey(name)));
    const card = acct ? await readJ(kv, 'card/' + acct.uid) : null;
    return card ? json({ card }) : json({ error: 'no_card' }, 404);
  }
  if (b.op === 'register' || b.op === 'login') {
    const name = String(b.name || '').normalize('NFC').trim(), pass = String(b.pass || '');
    if (!NAME_RE.test(name)) return json({ error: 'bad_name' }, 400);
    if (pass.length < 6 || pass.length > 64) return json({ error: 'bad_pass' }, 400);
    const ak = sha(nameKey(name));
    if (b.op === 'register') {
      if (ctx.ip && limited('reg:' + ctx.ip, 5, 3600_000, now)) return json({ error: 'rate_limited' }, 429);
      if (await kv.get('acct/' + ak)) return json({ error: 'name_taken' }, 409);
      const salt = randomBytes(16).toString('hex');
      const uid = randomBytes(12).toString('hex');
      await kv.set('acct/' + ak, JSON.stringify({ name, salt, hash: await kdf(pass, salt), uid, created: now }));
      let updatedAt = 0;
      if (save) { updatedAt = stampOf(save) || now; await kv.set('save/' + uid, JSON.stringify({ save, updatedAt, at: now })); try { await updateBoards(kv, uid, name, save, now); } catch { /* boards are best-effort */ } }
      return json({ token: await newSession(kv, uid, name, now), name, updatedAt });
    }
    // login
    const fail = (await readJ(kv, 'fail/' + ak)) || { n: 0, t: 0 };
    if (fail.n >= LOCK_AFTER && now - fail.t < LOCK_MS) return json({ error: 'locked', retryIn: Math.ceil((LOCK_MS - (now - fail.t)) / 1000) }, 429);
    const acct = await readJ(kv, 'acct/' + ak);
    const ok = acct && timingSafeEqual(Buffer.from(await kdf(pass, acct.salt), 'hex'), Buffer.from(acct.hash, 'hex'));
    if (!ok) {
      await kv.set('fail/' + ak, JSON.stringify({ n: (now - fail.t < LOCK_MS ? fail.n : 0) + 1, t: now }));
      return json({ error: 'wrong' }, 401);
    }
    if (fail.n) await kv.delete('fail/' + ak);
    const s = await readJ(kv, 'save/' + acct.uid);
    return json({ token: await newSession(kv, acct.uid, acct.name, now), name: acct.name, save: s?.save || null, updatedAt: s?.updatedAt || 0 });
  }

  const sess = await session(kv, b.token, now);
  if (!sess) return json({ error: 'session' }, 401);
  if (limited('uid:' + sess.uid, 40, 60_000, now)) return json({ error: 'rate_limited' }, 429);
  if (b.op === 'pull') {
    const s = await readJ(kv, 'save/' + sess.uid);
    return json({ save: s?.save || null, updatedAt: s?.updatedAt || 0, name: sess.name });
  }
  if (b.op === 'push') {
    if (!save) return json({ error: 'bad_save' }, 400);
    const cur = await readJ(kv, 'save/' + sess.uid);
    const updatedAt = stampOf(save) || now;
    // another device saved something newer since this one last synced: let the player choose
    const base = Number(b.base) || 0;
    if (cur && cur.updatedAt > base && cur.updatedAt !== updatedAt && !b.force) return json({ conflict: true, updatedAt: cur.updatedAt, save: cur.save });
    await kv.set('save/' + sess.uid, JSON.stringify({ save, updatedAt, at: now }));
    try { await updateBoards(kv, sess.uid, sess.name, save, now); } catch { /* the save is kept even if the boards could not be written */ }
    return json({ updatedAt });
  }
  if (b.op === 'logout') { await kv.delete('sess/' + sha(b.token)); return json({ ok: true }); }
  return json({ error: 'op' }, 400);
}
