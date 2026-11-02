// One-time import of the OLD Netlify accounts + saves into this Worker's D1 (route: POST /api/migrate).
// Only active while the secret MIGRATE_KEY is set on the Worker; with no secret the route answers 404 (so it can be left in the code).
//
// Input  { dry?: boolean, records: [{ acct: {name, salt, hash, uid, created}, save: {save, updatedAt, at} | null }] }   (≤ 12 per call)
// What it does, per record:
//   · account name not on Cloudflare yet  → copies the account (same password salt/hash, so the player logs in with the SAME password)
//   · same account (same uid) already here → keeps the Cloudflare account; the save is replaced only if the Netlify one is NEWER
//   · name already used by someone else here → skipped and reported (never overwrites anyone)
//   · every copied save goes through updateBoards(), so the leaderboards (อันดับ) are computed with TODAY's rules
// Sessions are not copied (players simply log in again); the rankings/cards are rebuilt from the saves, not copied.
import { updateBoards } from '../netlify/lib/rank.mjs';
import { nameKey, NAME_RE, CODE_RE, sha, stampOf } from '../netlify/lib/cloud.mjs';

const MAX_BODY = 12 * 1024 * 1024, MAX_SAVE = 600 * 1024, MAX_RECORDS = 12;
const UID_RE = /^[a-f0-9]{24}$/, SALT_RE = /^[a-f0-9]{32}$/, HASH_RE = /^[a-f0-9]{64}$/;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const readJ = async (kv, k) => { const t = await kv.get(k); if (!t) return null; try { return JSON.parse(t); } catch { return null; } };
const same = (a, b) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

export async function handleMigrate(req, env, kv, now = Date.now()) {
  const key = String(env.MIGRATE_KEY || '');
  if (key.length < 24) return new Response('not found', { status: 404 });                    // switched off
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!same(req.headers.get('x-migrate-key') || '', key)) return json({ error: 'unauthorized' }, 401);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: 'too_big' }, 413);
  let b; try { b = JSON.parse(text); } catch { return json({ error: 'bad_json' }, 400); }
  if (!b || !Array.isArray(b.records) || b.records.length > MAX_RECORDS) return json({ error: 'bad_records' }, 400);
  const dry = !!b.dry;

  const results = [];
  for (const r of b.records) {
    const a = r?.acct, s = r?.save;
    const name = String(a?.name || '').normalize('NFC').trim();
    const res = { name, status: '', save: '' };
    results.push(res);
    if (!NAME_RE.test(name) || !UID_RE.test(a?.uid || '') || !SALT_RE.test(a?.salt || '') || !HASH_RE.test(a?.hash || '')) { res.status = 'invalid'; continue; }
    const code = s && typeof s.save === 'string' ? s.save : null;
    if (code && (code.length > MAX_SAVE || !CODE_RE.test(code))) { res.status = 'invalid'; res.save = 'bad_save'; continue; }

    const ak = 'acct/' + sha(nameKey(name));
    const cur = await readJ(kv, ak);
    if (cur && cur.uid !== a.uid) { res.status = 'name_taken'; continue; }
    if (!cur) {
      res.status = 'imported';
      if (!dry) await kv.set(ak, JSON.stringify({ name, salt: a.salt, hash: a.hash, uid: a.uid, created: Number(a.created) || now }));
    } else res.status = 'existing';

    if (!code) { res.save = 'none'; continue; }
    const curSave = await readJ(kv, 'save/' + a.uid);
    const stamp = stampOf(code) || Number(s.updatedAt) || 0;
    if (curSave && !(stamp > (Number(curSave.updatedAt) || 0))) { res.save = 'kept_cloudflare'; continue; }   // Cloudflare's copy is as new or newer
    res.save = curSave ? 'replaced_with_newer' : 'copied';
    if (!dry) {
      const at = Number(s.at) || now;
      await kv.set('save/' + a.uid, JSON.stringify({ save: code, updatedAt: stamp || at, at }));
      try { await updateBoards(kv, a.uid, name, code, at); } catch { res.save += '+boards_failed'; }
    }
  }
  const counts = {}; for (const x of results) counts[x.status] = (counts[x.status] || 0) + 1;
  return json({ ok: true, dry, counts, results });
}
