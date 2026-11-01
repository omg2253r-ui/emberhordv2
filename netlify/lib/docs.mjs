// Shared documents (guilds) for hosts without the claude.ai `db` capability.
//   GET  /api/docs?path=guilds/<id>              → { data }   (data null when missing)
//   POST /api/docs { op, gid, uid, ukey, ...args }  — one guild action, checked against netlify/lib/guildRules.mjs
// The player id must be proven with its key (verifyUid). Concurrent actions retry with a compare-and-set.
//
// store: getVersioned(key) → { text, etag } | null · put(key, text, { ifMatch, ifNew }) → boolean (false = lost race)

import { applyGuildOp, isGid, isUid } from './guildRules.mjs';
import { verifyUid } from './hub.mjs';

const PATH_RE = /^guilds\/g[a-z0-9]{6,16}$/;
const MAX_DOC = 32 * 1024;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export function mergeDoc(a, b) {
  const out = a && typeof a === 'object' && !Array.isArray(a) ? { ...a } : {};
  for (const [k, v] of Object.entries(b || {})) {
    if (v === null) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = mergeDoc(out[k], v);
    else out[k] = v;
  }
  return out;
}

const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

const RATE = new Map();
function limited(key, max, windowMs, now) {
  const r = RATE.get(key);
  if (!r || now - r.t > windowMs) { RATE.set(key, { n: 1, t: now }); if (RATE.size > 5000) RATE.clear(); return false; }
  return ++r.n > max;
}

// authKV: the hub's key/value store, where player ids and their key hashes live (see verifyUid in hub.mjs)
export async function handleDocs(req, store, authKV = null, ctx = {}) {
  const url = new URL(req.url);
  const now = Date.now();
  if (ctx.ip && limited('ip:' + ctx.ip, 600, 10_000, now)) return json({ error: 'rate_limited' }, 429);
  if (req.method === 'GET') {
    const path = url.searchParams.get('path') || '';
    if (!PATH_RE.test(path)) return json({ error: 'bad_path' }, 400);
    const cur = await store.getVersioned(path);
    return json({ data: publicView(parse(cur?.text)) });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const text = await req.text();
  if (text.length > 4096) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'bad_request' }, 400); }
  const { op, gid, uid, ukey } = body || {};
  if (!isGid(gid) || !isUid(uid) || typeof op !== 'string') return json({ error: 'bad_request' }, 400);
  if (limited('uid:' + uid, 30, 60_000, now)) return json({ error: 'rate_limited' }, 429);
  if (!authKV || !(await verifyUid(authKV, uid, ukey))) return json({ error: 'not_owner' }, 403);
  const path = `guilds/${gid}`;
  for (let tries = 0; tries < 10; tries++) {
    if (tries) await new Promise((r) => setTimeout(r, Math.random() * 25 * tries));
    const cur = await store.getVersioned(path);
    const r = applyGuildOp(parse(cur?.text), op, uid, body, now);
    if (!r.ok) return json({ error: r.reason }, 409);
    const out = JSON.stringify(r.doc || { disbanded: true });
    if (out.length > MAX_DOC) return json({ error: 'too_large' }, 413);
    if (await store.put(path, out, cur ? { ifMatch: cur.etag } : { ifNew: true })) return json({ ok: true, data: publicView(r.doc) });
  }
  return json({ error: 'busy' }, 409);
}

// A disbanded guild reads as { disbanded: true }; nothing in a guild document is secret.
function publicView(doc) { return doc && !doc.disbanded ? doc : doc ? { disbanded: true } : null; }

// Netlify Blobs → the interface above. Conditional writes (onlyIfMatch / onlyIfNew) are used when the installed
// @netlify/blobs supports them; an older version simply writes (last write wins).
export function blobsDocs(blobStore) {
  return {
    async getVersioned(k) {
      const r = await blobStore.getWithMetadata(k, { type: 'text' });
      return r ? { text: r.data, etag: r.etag } : null;
    },
    async put(k, text, { ifMatch, ifNew } = {}) {
      const opts = ifMatch ? { onlyIfMatch: ifMatch } : ifNew ? { onlyIfNew: true } : {};
      const r = await blobStore.set(k, text, opts);
      return !(r && r.modified === false);
    },
  };
}

export function memoryDocs() {
  const m = new Map();
  let v = 0;
  return {
    map: m,
    async getVersioned(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, text, { ifMatch, ifNew } = {}) {
      const cur = m.get(k);
      if (ifNew && cur) return false;
      if (ifMatch && cur?.etag !== ifMatch) return false;
      m.set(k, { text, etag: String(++v) });
      return true;
    },
  };
}
