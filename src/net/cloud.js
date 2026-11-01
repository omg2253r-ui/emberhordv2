// เซฟออนไลน์ — the client side of /api/cloud. One account keeps one hero for every app, browser and phone.
// The session token (never the password) is kept in this browser; the save itself travels as a transfer code.
//
//   cloud.account()            → { name, synced } | null
//   cloud.register(name, pass, code?) / cloud.login(name, pass) / cloud.logout()
//   cloud.pull()               → { save, updatedAt }
//   cloud.push(code, { force, keepalive }) → { updatedAt } | { conflict, updatedAt, save }
//   cloud.markSynced(t)        remembers which cloud version this browser last saw (conflict detection)
const KEY = 'emberhold.cloud';

export const CLOUD_ERRORS = Object.freeze({
  no_card: 'ยังไม่มีโปรไฟล์ของบัญชีนี้บนเซิร์ฟเวอร์ (เจ้าของต้องบันทึกเซฟออนไลน์ก่อน)',
  bad_name: 'ชื่อบัญชีต้องยาว 3–20 ตัว ใช้ตัวอักษร ตัวเลข _ . - ได้ (ห้ามเว้นวรรค)',
  bad_pass: 'รหัสผ่านต้องยาว 6–64 ตัว',
  name_taken: 'ชื่อบัญชีนี้มีคนใช้แล้ว ลองชื่ออื่น',
  wrong: 'ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง',
  locked: 'ใส่รหัสผิดหลายครั้ง บัญชีถูกพักไว้ 10 นาที',
  session: 'การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  rate_limited: 'ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่',
  bad_save: 'ข้อมูลเซฟไม่ถูกต้อง',
  board: 'ไม่พบตารางอันดับนี้',
  too_big: 'เซฟใหญ่เกินไป',
  network: 'ต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่',
});
export const cloudError = (e) => CLOUD_ERRORS[e] || 'ทำรายการไม่สำเร็จ';

export function cloudAvailable() {
  return typeof document !== 'undefined' && !!document.querySelector('meta[name="emberhold-hub"]');
}

export function createCloud({ storage, base = '/api/cloud', fetchImpl = (...a) => fetch(...a) } = {}) {
  let acct = null;
  try { const v = JSON.parse(storage.getItem(KEY) || 'null'); if (v && /^[a-f0-9]{48}$/.test(v.token || '')) acct = v; } catch { acct = null; }
  const keep = () => { try { if (acct) storage.setItem(KEY, JSON.stringify(acct)); else storage.removeItem(KEY); } catch { /* storage blocked */ } };

  async function call(body, { keepalive = false } = {}) {
    let r;
    try { r = await fetchImpl(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive }); }
    catch { return { error: 'network' }; }
    let data = {};
    try { data = await r.json(); } catch { data = { error: 'network' }; }
    if (data.error === 'session') { acct = null; keep(); }
    return data;
  }

  return {
    account: () => (acct ? { name: acct.name, synced: acct.synced || 0, at: acct.at || 0, hash: acct.h || '' } : null),
    async register(name, pass, save = null) {
      const d = await call({ op: 'register', name, pass, save });
      if (d.token) { acct = { token: d.token, name: d.name, synced: d.updatedAt || 0, at: Date.now() }; keep(); }
      return d;
    },
    async login(name, pass) {
      const d = await call({ op: 'login', name, pass });
      if (d.token) { acct = { token: d.token, name: d.name, synced: 0, at: Date.now() }; keep(); }
      return d;
    },
    async logout() {
      const t = acct?.token;
      acct = null; keep();
      if (t) await call({ op: 'logout', token: t });
    },
    async pull() { return acct ? call({ op: 'pull', token: acct.token }) : { error: 'session' }; },
    // leaderboards: open to everyone; with an account, my own place is returned too
    async ranks(board) { return call({ op: 'ranks', board, token: acct?.token || undefined }); },
    async card(account) { return call({ op: 'card', account }); },
    async push(save, { force = false, keepalive = false } = {}) {
      if (!acct) return { error: 'session' };
      const d = await call({ op: 'push', token: acct.token, save, base: acct.synced || 0, force }, { keepalive });
      if (d.updatedAt && !d.conflict) { acct.synced = d.updatedAt; acct.at = Date.now(); keep(); }   // the caller records the content hash
      return d;
    },
    // t: the cloud copy's stamp this browser now matches · h: hash of that hero's content (to tell real changes from visits)
    markSynced(t, h = undefined) { if (acct) { acct.synced = t; if (h !== undefined) acct.h = h; acct.at = Date.now(); keep(); } },
  };
}
