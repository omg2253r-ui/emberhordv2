// Holds the one current state, notifies subscribers, and persists on commit.
export function createStore(initialState, saveStore) {
  let state = initialState;
  const listeners = new Set();
  const locks = new Set();
  let lastSave = { ok: true };

  return {
    get: () => state,
    // Replace state with a new one produced by a pure system function.
    commit(next, { reason = '', persist = true } = {}) {
      state = next;
      if (persist && saveStore) lastSave = saveStore.save(state);
      for (const fn of listeners) fn(state, reason);
      return lastSave;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    lastSave: () => lastSave,
    // Prevents the same action from running twice at once (rapid clicks during an animation).
    async exclusive(key, fn) {
      if (locks.has(key)) return { ok: false, reason: 'busy' };
      locks.add(key);
      try { return await fn(); } finally { locks.delete(key); }
    },
    isLocked: (key) => locks.has(key),
  };
}
