// Emberhold's online hub for hosts without a realtime platform (Netlify).
//
// Netlify Functions cannot hold a websocket open, so the game talks peer-to-peer over WebRTC data channels and
// uses this hub only to (1) see who is online and (2) pass small "mail" between two players: WebRTC offers and
// answers while a connection is being set up, and game messages for the few pairs whose networks cannot connect
// directly (strict NAT). Clients call it every few seconds; nothing here is held in memory between calls.
//
// Storage is a tiny key/value interface so the same code runs on Netlify Blobs and in the local test server:
//   store.get(key) → string|null · store.set(key, string) · store.delete(key) · store.list(prefix) → [key]
//
// Keys:
//   live/<world>/<bucket>/<peer>  heartbeat; a peer is online while it has a key in the current or previous bucket
//   box/<peer>/<time>-<rand>      mail for <peer>; deleted as soon as <peer> reads it
// Everything a client sends is checked for shape and size; the content is passed through untouched and the
// receiving game validates it like any other message from another player.

import { createHash } from 'node:crypto';

export const BUCKET_MS = 10_000;
export const MAIL_TTL_MS = 120_000;
export const PEER_RE = /^[a-z0-9]{8,24}$/;
export const WORLD_RE = /^[a-z0-9]{1,16}$/;
const MAX_BODY = 256 * 1024;
const MAX_TARGETS = 40;
const MAX_ITEMS = 300;
const MAX_MAIL = 96 * 1024;
const MAX_READ = 60;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const rand = () => Math.random().toString(36).slice(2, 8);
const stamp = (t) => t.toString(36).padStart(9, '0');

async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

// ------------------------------------------------------------------ abuse limits (best effort, per function instance)
const RATE = new Map();          // key → { n, t }
function limited(key, max, windowMs, now) {
  const r = RATE.get(key);
  if (!r || now - r.t > windowMs) { RATE.set(key, { n: 1, t: now }); if (RATE.size > 5000) RATE.clear(); return false; }
  r.n += 1;
  return r.n > max;
}

const UID_RE = /^u[a-z0-9]{14}$/;
export const KEY_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const hash = (s) => createHash('sha256').update(String(s)).digest('hex');
// live key: live/<world>/<bucket>/<peer>~<uid or _>~<16 hex of the peer key's hash>
const liveKey = (world, bucket, peer, uid, h) => `live/${world}/${bucket}/${peer}~${uid || '_'}~${h}`;
export function parseLive(k) {
  const [peer, uid, h] = k.slice(k.lastIndexOf('/') + 1).split('~');
  return PEER_RE.test(peer || '') ? { peer, uid: UID_RE.test(uid || '') ? uid : null, h: h || '', key: k } : null;
}

// Does `ukey` prove ownership of `uid`? The first browser to present a uid becomes its owner.
export async function verifyUid(store, uid, ukey) {
  if (!UID_RE.test(uid || '') || !KEY_RE.test(ukey || '')) return false;
  const uh = hash('uid:' + ukey);
  const stored = await store.get(`auth/uid/${uid}`);
  if (!stored) { await store.set(`auth/uid/${uid}`, uh); return true; }
  return stored === uh;
}

// Roster listing is the costly part of every poll (two list calls on Blobs). A warm function instance can reuse a
// listing for a second or so (ctx.cacheMs, set by the Netlify function; tests leave it off): with many players polling
// every few seconds that removes most of the list calls. This peer's own heartbeat is added to the cached listing so
// it is not written again on the next poll.
const LIVE_CACHE = new Map();    // "<world>/<bucket>" → { at, keys:Set }
async function listLive(store, world, bucket, now, cacheMs) {
  const id = `${world}/${bucket}`;
  const hit = cacheMs > 0 ? LIVE_CACHE.get(id) : null;
  if (hit && now - hit.at >= 0 && now - hit.at < cacheMs) return [...hit.keys];
  const keys = await store.list(`live/${world}/${bucket}/`);
  if (cacheMs > 0) {
    LIVE_CACHE.set(id, { at: now, keys: new Set(keys) });
    if (LIVE_CACHE.size > 12) for (const k of [...LIVE_CACHE.keys()].slice(0, LIVE_CACHE.size - 12)) LIVE_CACHE.delete(k);
  }
  return keys;
}
const cacheAdd = (world, bucket, key) => LIVE_CACHE.get(`${world}/${bucket}`)?.keys.add(key);
const cacheDrop = (key) => { for (const c of LIVE_CACHE.values()) c.keys.delete(key); };

// ctx: { ip } when known; { cacheMs } to reuse roster listings briefly
export async function handleHub(req, store, now = Date.now(), ctx = {}) {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (ctx.ip && limited('ip:' + ctx.ip, 900, 10_000, now)) return json({ error: 'rate_limited' }, 429);
  const body = await readBody(req);
  if (!body) return json({ error: 'bad_request' }, 400);
  const world = WORLD_RE.test(body.world || '') ? body.world : null;
  const peer = PEER_RE.test(body.peer || '') ? body.peer : null;
  const key = KEY_RE.test(body.key || '') ? body.key : null;
  if (!world || !peer || !key) return json({ error: 'bad_request' }, 400);
  if (limited('peer:' + peer, 40, 10_000, now)) return json({ error: 'rate_limited' }, 429);
  const bucket = Math.floor(now / BUCKET_MS);
  const myHash = hash('peer:' + key).slice(0, 16);

  // who is online (also: is this peer id already held by someone else?)
  const cacheMs = Number(ctx.cacheMs) > 0 ? Number(ctx.cacheMs) : 0;
  const [cur, prev] = await Promise.all([listLive(store, world, bucket, now, cacheMs), listLive(store, world, bucket - 1, now, cacheMs)]);
  const entries = [...cur, ...prev].map(parseLive).filter(Boolean);
  const mine = entries.filter((e) => e.peer === peer);
  if (mine.some((e) => e.h !== myHash)) return json({ error: 'peer_taken' }, 403);

  if (body.leave) {
    await Promise.all(mine.map((e) => { cacheDrop(e.key); return store.delete(e.key); }));
    return json({ ok: true });
  }

  // the player's lasting id: whoever first presented it owns it (its key's hash is kept)
  let uid = null;
  const wantUid = UID_RE.test(body.uid || '') && KEY_RE.test(body.ukey || '') ? body.uid : null;
  if (wantUid) {
    if (mine.some((e) => e.uid === wantUid) || await verifyUid(store, wantUid, body.ukey)) uid = wantUid;
  }

  // heartbeat (one key per bucket)
  const k = liveKey(world, bucket, peer, uid, myHash);
  if (!cur.includes(k)) {
    await store.set(k, String(now));
    cacheAdd(world, bucket, k);
    await Promise.all(mine.filter((e) => e.key.startsWith(`live/${world}/${bucket}/`) && e.key !== k).map((e) => { cacheDrop(e.key); return store.delete(e.key); }));
  }

  // outgoing mail ("from" is this authenticated peer, never what the client says)
  const writes = [];
  for (const s of Array.isArray(body.send) ? body.send.slice(0, MAX_TARGETS) : []) {
    if (!s || !PEER_RE.test(s.to || '') || s.to === peer || !Array.isArray(s.items) || !s.items.length) continue;
    const text = JSON.stringify({ from: peer, items: s.items.slice(0, MAX_ITEMS) });
    if (text.length > MAX_MAIL) continue;
    writes.push(store.set(`box/${s.to}/${stamp(now)}-${rand()}`, text));
  }
  await Promise.all(writes);

  const seen = new Map();
  for (const e of entries) if (e.peer !== peer && (!seen.has(e.peer) || (e.uid && !seen.get(e.peer).uid))) seen.set(e.peer, e);
  const peers = [...seen.values()].map((e) => ({ p: e.peer, u: e.uid }));

  // my mail, oldest first
  const keys = (await store.list(`box/${peer}/`)).sort().slice(0, MAX_READ);
  const mail = [];
  const texts = await Promise.all(keys.map((k2) => store.get(k2)));
  await Promise.all(keys.map((k2) => store.delete(k2)));
  for (const t of texts) {
    if (!t) continue;
    try { const m = JSON.parse(t); if (m && PEER_RE.test(m.from || '') && Array.isArray(m.items)) mail.push(m); } catch { /* skip */ }
  }

  // now and then, clear heartbeats and mail nobody will read
  if (body.sweep || Math.random() < 0.03) await sweep(store, world, now).catch(() => {});

  return json({ peers, mail, now, uid, more: keys.length === MAX_READ });
}

export async function sweep(store, world, now = Date.now()) {
  const bucket = Math.floor(now / BUCKET_MS);
  const dead = [];
  for (const k of await store.list(`live/${world}/`)) {
    const b = Number(k.split('/')[2]);
    if (!(b >= bucket - 1)) dead.push(k);
  }
  for (const k of await store.list('box/')) {
    const t = parseInt(k.split('/')[2], 36);
    if (!(now - t < MAIL_TTL_MS)) dead.push(k);
  }
  await Promise.all(dead.slice(0, 500).map((k) => store.delete(k)));
  return dead.length;
}

// Netlify Blobs → the interface above
export function blobsKV(blobStore) {
  return {
    get: (k) => blobStore.get(k, { type: 'text' }),
    set: (k, v) => blobStore.set(k, v),
    delete: (k) => blobStore.delete(k),
    async list(prefix) {
      const out = [];
      const res = await blobStore.list({ prefix });
      for (const b of res.blobs || []) out.push(b.key);
      return out;
    },
  };
}

// In-memory store with the same interface (local test server and unit tests)
export function memoryKV() {
  const m = new Map();
  return {
    map: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async set(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
  };
}
