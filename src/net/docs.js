// Shared documents (guilds). Same small interface over two backends:
//   'claude' — the artifact's `db` capability (persistent, shared by everyone who can open the game)
//   'local'  — localStorage + storage events, shared by tabs of one browser (development and tests)
// doc(path) → { get(), set(data), update(data) (deep merge), onSnapshot(fn) → unsub }
// Everything read here was written by other players: callers validate it.

export function createClaudeDocs(db) {
  return {
    kind: 'claude',
    doc(path) {
      const ref = db.doc(path);
      return {
        async get() { const s = await ref.get(); return s.exists ? s.data() : null; },
        set: (data) => ref.set(data),
        async update(data) { try { await ref.update(data); } catch (e) { if (e?.code === 'invalid_argument') await ref.set(data); else throw e; } },
        onSnapshot(fn) { return ref.onSnapshot((s) => fn(s.exists ? s.data() : null), () => fn(null)); },
      };
    },
  };
}

const PREFIX = 'emberhold.docs.';
const merge = (a, b) => {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? merge(out[k], v) : v;
  return out;
};

export function createLocalDocs(storage = globalThis.localStorage) {
  const subs = new Map();   // path → Set(fn)
  const read = (path) => { try { const t = storage.getItem(PREFIX + path); return t ? JSON.parse(t) : null; } catch { return null; } };
  const write = (path, v) => {
    storage.setItem(PREFIX + path, JSON.stringify(v));
    for (const fn of subs.get(path) || []) queueMicrotask(() => fn(read(path)));
  };
  if (typeof addEventListener === 'function') {
    addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      const path = e.key.slice(PREFIX.length);
      for (const fn of subs.get(path) || []) fn(read(path));
    });
  }
  return {
    kind: 'local',
    doc(path) {
      return {
        async get() { return read(path); },
        async set(data) { write(path, data); },
        async update(data) { write(path, merge(read(path), data)); },
        onSnapshot(fn) {
          if (!subs.has(path)) subs.set(path, new Set());
          subs.get(path).add(fn);
          queueMicrotask(() => fn(read(path)));
          return () => subs.get(path)?.delete(fn);
        },
      };
    },
  };
}
