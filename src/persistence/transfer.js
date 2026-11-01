// Moving a save between browsers / apps / devices. Saves live in each browser's own storage, so a hero made in
// LINE's in-app browser is not there when the same link opens in Chrome. A transfer code carries the whole save:
//   EMB1.<base64url of the save JSON>.<check>
// The check is a SHA-256 over the save with a transfer pepper, so a typo or an edited code is refused. An imported
// save is cleaned (sanitize) and re-signed for this browser like any save the game writes.
import { sha256 } from './integrity.js';
import { sanitize, serialize } from './save.js';

const PREFIX = 'EMB1';
const PEPPER = 'emberhold/transfer/v1';
const check = (payload) => sha256(`${PEPPER}|${payload}`).slice(0, 32);

function toB64url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function exportCode(state) {
  const payload = serialize(state);
  return `${PREFIX}.${toB64url(payload)}.${check(payload)}`;
}

// → { ok, state, warnings } | { ok:false, reason }
export function importCode(input) {
  const text = String(input || '').replace(/\s+/g, '');
  if (!text) return { ok: false, reason: 'empty' };
  let payload;
  if (text.startsWith(PREFIX + '.')) {
    const [, body, sig] = text.split('.');
    if (!body || !sig) return { ok: false, reason: 'broken' };
    try { payload = fromB64url(body); } catch { return { ok: false, reason: 'broken' }; }
    if (check(payload) !== sig) return { ok: false, reason: 'tampered' };
  } else return { ok: false, reason: 'not_code' };
  let raw;
  try { raw = JSON.parse(payload); } catch { return { ok: false, reason: 'broken' }; }
  try {
    const r = sanitize(raw);
    r.state.integrity = 'ok';
    return { ok: true, state: r.state, warnings: r.warnings };
  } catch (e) { return { ok: false, reason: 'broken', detail: e.message }; }
}

export const IMPORT_REASON = Object.freeze({
  empty: 'ยังไม่ได้ใส่รหัสเซฟ',
  not_code: 'นี่ไม่ใช่รหัสเซฟของ Emberhold (ต้องขึ้นต้นด้วย EMB1.)',
  broken: 'รหัสเซฟไม่ครบหรือเสียหาย ลองคัดลอกใหม่ทั้งหมดอีกครั้ง',
  tampered: 'รหัสเซฟถูกแก้ไข หรือคัดลอกมาไม่ครบ จึงนำเข้าไม่ได้',
});
