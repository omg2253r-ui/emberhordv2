// D1 (Cloudflare SQLite) adapters: the same kv / docs interfaces the Netlify Blobs versions expose (see netlify/lib/hub.mjs, docs.mjs).
var SCHEMA = [
  "CREATE TABLE IF NOT EXISTS kv (ns TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (ns, k))",
  "CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, v TEXT NOT NULL, ver INTEGER NOT NULL)"
];
var ready = /* @__PURE__ */ new WeakMap();
function ensureSchema(db) {
  if (!ready.has(db)) ready.set(db, db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => {
    ready.delete(db);
    throw e;
  }));
  return ready.get(db);
}
export function kv(db, ns) {
  return {
    async get(k) {
      await ensureSchema(db);
      const r = await db.prepare("SELECT v FROM kv WHERE ns = ? AND k = ?").bind(ns, k).first();
      return r ? r.v : null;
    },
    async set(k, v) {
      await ensureSchema(db);
      await db.prepare("INSERT INTO kv (ns, k, v) VALUES (?, ?, ?) ON CONFLICT(ns, k) DO UPDATE SET v = excluded.v").bind(ns, k, String(v)).run();
    },
    async delete(k) {
      await ensureSchema(db);
      await db.prepare("DELETE FROM kv WHERE ns = ? AND k = ?").bind(ns, k).run();
    },
    async list(prefix = "") {
      await ensureSchema(db);
      const r = await db.prepare("SELECT k FROM kv WHERE ns = ? AND k >= ? AND k < ? ORDER BY k").bind(ns, prefix, prefix + "\uFFFF").all();
      return (r.results || []).map((x) => x.k);
    }
  };
}
export function docs(db) {
  return {
    async getVersioned(k) {
      await ensureSchema(db);
      const r = await db.prepare("SELECT v, ver FROM docs WHERE k = ?").bind(k).first();
      return r ? { text: r.v, etag: String(r.ver) } : null;
    },
    async put(k, text, { ifMatch, ifNew } = {}) {
      await ensureSchema(db);
      let r;
      if (ifMatch) r = await db.prepare("UPDATE docs SET v = ?, ver = ver + 1 WHERE k = ? AND ver = ?").bind(text, k, Number(ifMatch) || -1).run();
      else if (ifNew) r = await db.prepare("INSERT OR IGNORE INTO docs (k, v, ver) VALUES (?, ?, 1)").bind(k, text).run();
      else r = await db.prepare("INSERT INTO docs (k, v, ver) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ver = docs.ver + 1").bind(k, text).run();
      return (r?.meta?.changes ?? 1) > 0;
    }
  };
}
