// บัญชีเกม · เซฟออนไลน์ — sign up / log in once, and the same hero follows the player into any app or phone.
// Also the chooser shown when the account and this browser hold different heroes.
import { h, glyph } from './dom.js';
import { cloudError } from '../net/cloud.js';
import { importCode } from '../persistence/transfer.js';

const when = (t) => { try { return t ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; } catch { return '—'; } };
const heroLine = (st) => (st ? `${st.story.name || 'ไม่มีชื่อ'} · เลเวล ${st.player.level} · ทอง ${st.gold.toLocaleString('th-TH')}` : 'ไม่มีตัวละคร');

export function openAccount(app) {
  let close, tab = 'login';
  const c = app.cloud;
  const body = h('div', { class: 'acct-body' });
  const status = h('p', { class: 'st-status', role: 'status' });
  const say = (t, k = '') => { status.textContent = t; status.className = `st-status ${k}`; };

  function draw() {
    const acc = c.account();
    body.replaceChildren();
    if (!c.available) {
      body.append(h('p', { class: 'notice' }, 'เซฟออนไลน์ใช้ได้เมื่อเปิดเกมจากเว็บ emberhold-online.netlify.app ในหน้านี้ใช้ "สำรองเซฟ / ย้ายเครื่อง" ด้วยรหัสเซฟแทนได้'));
      return;
    }
    if (acc) {
      body.append(
        h('div', { class: 'acct-card' }, h('span', { class: 'acct-ic' }, glyph('check')),
          h('div', {}, h('b', {}, acc.name), h('small', { class: 'muted' }, `ซิงก์ล่าสุด ${when(acc.at)} · บันทึกขึ้นบัญชีอัตโนมัติระหว่างเล่น`))),
        h('p', { class: 'muted acct-help' }, 'เปิดเกมจากแอปไหนหรือเครื่องไหนก็ได้ แล้วเข้าสู่ระบบด้วยบัญชีนี้ ตัวละครเดียวกันจะตามมา'),
        h('div', { class: 'st-row' },
          h('button', { class: 'btn primary', type: 'button', 'data-action': 'cloud-sync', onclick: async () => { say('กำลังบันทึกขึ้นบัญชี…'); const r = await app.cloudSyncNow(); say(r.ok ? 'บันทึกขึ้นบัญชีแล้ว' : (r.message || cloudError(r.error)), r.ok ? 'ok' : 'warn'); draw(); } }, glyph('up'), 'บันทึกขึ้นบัญชีตอนนี้'),
          h('button', { class: 'btn', type: 'button', 'data-action': 'cloud-logout', onclick: async () => { await app.cloudLogout(); say('ออกจากระบบแล้ว ตัวละครยังอยู่ในบัญชี และในเครื่องนี้', 'ok'); draw(); } }, glyph('exit'), 'ออกจากระบบ')));
      return;
    }
    const name = h('input', { class: 'acct-in', type: 'text', autocomplete: 'username', maxlength: 20, placeholder: 'ชื่อบัญชี (3–20 ตัว)', 'data-cloud-name': '', 'aria-label': 'ชื่อบัญชี' });
    const pass = h('input', { class: 'acct-in', type: 'password', autocomplete: tab === 'login' ? 'current-password' : 'new-password', maxlength: 64, placeholder: 'รหัสผ่าน (อย่างน้อย 6 ตัว)', 'data-cloud-pass': '', 'aria-label': 'รหัสผ่าน' });
    const pass2 = tab === 'register' ? h('input', { class: 'acct-in', type: 'password', autocomplete: 'new-password', maxlength: 64, placeholder: 'ยืนยันรหัสผ่าน', 'data-cloud-pass2': '', 'aria-label': 'ยืนยันรหัสผ่าน' }) : null;
    const go = h('button', { class: 'btn primary', type: 'submit', 'data-action': tab === 'login' ? 'cloud-login' : 'cloud-register' }, glyph(tab === 'login' ? 'door' : 'check'), tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครและบันทึกตัวละคร');
    const form = h('form', { class: 'acct-form', onsubmit: async (e) => {
      e.preventDefault();
      if (pass2 && pass.value !== pass2.value) { say('รหัสผ่านสองช่องไม่ตรงกัน', 'warn'); return; }
      go.disabled = true; say(tab === 'login' ? 'กำลังเข้าสู่ระบบ…' : 'กำลังสมัคร…');
      const r = tab === 'login' ? await app.cloudLogin(name.value, pass.value) : await app.cloudRegister(name.value, pass.value);
      go.disabled = false;
      if (!r.ok) { say(r.message || cloudError(r.error), 'warn'); app.audio.play('error'); return; }
      if (r.choose) { close(); return; }                 // the hero chooser takes over
      say(r.message || 'เรียบร้อย', 'ok'); app.audio.play('unlock');
      draw();
    } }, name, pass, pass2, go);
    body.append(
      h('div', { class: 'craft-tabs acct-tabs' },
        h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(tab === 'login'), 'data-acct-tab': 'login', onclick: () => { tab = 'login'; draw(); } }, 'เข้าสู่ระบบ'),
        h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(tab === 'register'), 'data-acct-tab': 'register', onclick: () => { tab = 'register'; draw(); } }, 'สมัครบัญชีใหม่')),
      h('p', { class: 'muted acct-help' }, tab === 'register'
        ? (app.hasLocalHero() ? `ตัวละครในเครื่องนี้ (${heroLine(app.store.get())}) จะถูกบันทึกขึ้นบัญชีทันที` : 'สมัครแล้วเริ่มเล่น ตัวละครจะบันทึกขึ้นบัญชีอัตโนมัติ')
        : 'เข้าสู่ระบบแล้วตัวละครในบัญชีจะโหลดมาที่เครื่องนี้'),
      form,
      h('small', { class: 'faint' }, 'ห้ามใช้รหัสผ่านเดียวกับบัญชีอื่น เช่น Facebook หรืออีเมล · ลืมรหัสผ่านแล้วกู้คืนไม่ได้ ให้จดไว้'));
    setTimeout(() => name.focus({ preventScroll: true }), 30);
  }

  const content = h('div', { class: 'modal panel account-modal', 'data-modal': 'account' },
    h('h2', {}, glyph('globe'), 'บัญชีเกม · เซฟออนไลน์'),
    h('p', { class: 'notice' }, 'สมัครครั้งเดียว เล่นได้ทุกแอปทุกเครื่อง: LINE, Chrome, Safari, คอม หรือมือถือเครื่องใหม่ ตัวละครเดียวกันตามมาเสมอ'),
    body, status,
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด')));
  draw();
  close = app.modal(content);
  return close;
}

// The account and this browser hold different heroes: the player picks which one to keep.
export function openHeroChooser(app, { cloudCode, cloudAt, local, reason = 'login' }) {
  let close;
  const cloudState = importCode(cloudCode).state;
  const card = (title, st, at, act, label, cls) => h('article', { class: `choose-card ${cls}`, 'data-choose': act },
    h('small', { class: 'muted' }, title), h('b', {}, heroLine(st)), h('small', { class: 'muted' }, `บันทึกเมื่อ ${when(at)}`),
    h('button', { class: `btn ${cls === 'cloud' ? 'primary' : ''}`, type: 'button', 'data-action': `keep-${act}`, onclick: async () => { close(); await app.cloudChoose(act, { cloudCode, cloudAt }); } }, label));
  const content = h('div', { class: 'modal panel chooser-modal', 'data-modal': 'hero-chooser' },
    h('h2', {}, 'เลือกตัวละครที่จะเล่นต่อ'),
    h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, reason === 'conflict'
      ? 'มีการเล่นจากเครื่องหรือแอปอื่นระหว่างนี้ เซฟสองที่ไม่ตรงกัน เลือกอันที่ต้องการเก็บ อีกอันจะถูกแทนที่'
      : 'บัญชีนี้มีตัวละครอยู่แล้ว และเครื่องนี้ก็มีตัวละครอีกตัว เลือกอันที่ต้องการเล่นต่อ'),
    h('div', { class: 'choose-grid' },
      card('ในบัญชี', cloudState, cloudAt, 'cloud', 'เล่นตัวละครในบัญชี', 'cloud'),
      card('ในเครื่องนี้', local, local?.updatedAt, 'local', 'ใช้ตัวในเครื่องนี้ (ทับในบัญชี)', 'local')));
  close = app.modal(content, { dismissable: false });
  return close;
}
