// Save integrity: every save written by the game carries a signature over its exact text. Editing the save in
// the browser's storage (gold, levels, items…) breaks the signature, and the game then falls back to the last
// genuine save, or keeps the edited one marked as "modified" (no trading or PvP with it).
//
// Honest limits: the game runs entirely in the player's browser, so a determined person who reads the source can
// still forge a signature. This stops casual edits (DevTools → Local Storage, save editors) and makes forged
// progress identifiable; the online server additionally referees guilds and identities on its own.

// ---------------------------------------------------------------- SHA-256 (synchronous, UTF-8)
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text) {
  const bytes = new TextEncoder().encode(String(text));
  const len = bytes.length;
  const blocks = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(blocks);
  buf.set(bytes);
  buf[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(blocks - 4, bits >>> 0);
  dv.setUint32(blocks - 8, Math.floor(bits / 0x100000000));
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < blocks; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}

// ---------------------------------------------------------------- signing
const PEPPER = 'emberhold/save/v6';
const SIG_RE = /,"_sig":"([0-9a-f]{64})"\}$/;

// device key: a random value kept beside the saves; a save copied from another browser is not "genuine" here
export function deviceKey(storage) {
  const K_ = 'emberhold.dk';
  try {
    let k = storage.getItem(K_);
    if (!/^[a-z0-9]{32}$/.test(k || '')) {
      k = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
      storage.setItem(K_, k);
    }
    return k;
  } catch { return 'nokey'; }
}

const sigOf = (payload, key) => sha256(`${PEPPER}|${key}|${payload}`);

// payload: the save JSON (an object literal, ending in "}") → the same JSON with a "_sig" field appended
export function sign(payload, key) {
  return payload.slice(0, -1) + `,"_sig":"${sigOf(payload, key)}"}`;
}

// → { payload, status: 'genuine' | 'unsigned' | 'modified' }
export function verify(text, key) {
  const m = SIG_RE.exec(text);
  if (!m) return { payload: text, status: /"_sig"/.test(text) ? 'modified' : 'unsigned' };
  const payload = text.slice(0, m.index) + '}';
  return { payload, status: sigOf(payload, key) === m[1] ? 'genuine' : 'modified' };
}
