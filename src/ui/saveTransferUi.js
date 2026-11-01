// สำรอง / ย้ายเซฟ — export the save as a code or a file, import one from another browser, app or phone.
// Saves live in each browser separately (LINE's in-app browser, Chrome and Safari each keep their own), so this is
// how a player keeps a hero when they switch apps or devices.
import { h, glyph } from './dom.js';
import { exportCode, importCode, IMPORT_REASON } from '../persistence/transfer.js';

async function copyText(text, area) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* clipboard blocked (sandbox / old browser) */ }
  try { area.focus(); area.select(); return document.execCommand('copy'); } catch { return false; }
}
function download(name, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}

// mode: 'both' (from Settings, a hero is loaded) | 'import' (from the title screen)
export function openSaveTransfer(app, { mode = 'both', hasSave = false } = {}) {
  let close;
  const st = app.store.get();
  const hasHero = mode === 'both';
  const confirmReplace = hasHero || hasSave;
  const code = hasHero ? exportCode(st) : '';
  const codeArea = h('textarea', { class: 'st-code', readonly: true, rows: 3, 'data-export-code': '', 'aria-label': 'รหัสเซฟ' }, code);
  const status = h('p', { class: 'st-status', role: 'status' });
  const say = (text, kind = '') => { status.textContent = text; status.className = `st-status ${kind}`; };

  const exportBlock = hasHero ? h('section', { class: 'st-block' },
    h('h3', {}, glyph('scroll'), 'สำรองเซฟของตัวละครนี้'),
    h('p', { class: 'muted' }, `${st.story.name} · เลเวล ${st.player.level} · ทอง ${st.gold.toLocaleString('th-TH')} — คัดลอกรหัสนี้หรือบันทึกเป็นไฟล์เก็บไว้ แล้วนำไปวางในแอปหรือเครื่องอื่นได้`),
    codeArea,
    h('div', { class: 'st-row' },
      h('button', { class: 'btn primary', type: 'button', 'data-action': 'copy-save', onclick: async () => { say(await copyText(code, codeArea) ? 'คัดลอกรหัสแล้ว เก็บไว้ในโน้ตหรือส่งให้ตัวเองในแชทได้เลย' : 'คัดลอกอัตโนมัติไม่ได้ กดค้างที่รหัสแล้วเลือกคัดลอกเอง', 'ok'); } }, glyph('check'), 'คัดลอกรหัส'),
      h('button', { class: 'btn', type: 'button', 'data-action': 'download-save', onclick: () => say(download(`emberhold-${st.story.name || 'save'}-lv${st.player.level}.txt`, code) ? 'บันทึกไฟล์แล้ว (ดูในโฟลเดอร์ดาวน์โหลด)' : 'บันทึกไฟล์ไม่ได้ในเบราว์เซอร์นี้ ใช้ปุ่มคัดลอกรหัสแทน', 'ok') }, glyph('down'), 'บันทึกเป็นไฟล์'))) : null;

  const pasteArea = h('textarea', { class: 'st-code', rows: 3, placeholder: 'วางรหัสเซฟที่ขึ้นต้นด้วย EMB1. ตรงนี้', 'data-import-code': '', 'aria-label': 'วางรหัสเซฟ' });
  const fileInput = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true, onchange: async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try { pasteArea.value = (await f.text()).trim(); say(`อ่านไฟล์ ${f.name} แล้ว กด "นำเข้าเซฟนี้" เพื่อยืนยัน`); } catch { say('อ่านไฟล์ไม่ได้', 'warn'); }
  } });
  let armed = false;
  const importBtn = h('button', { class: 'btn primary', type: 'button', 'data-action': 'import-save', onclick: () => {
    const r = importCode(pasteArea.value);
    if (!r.ok) { say(IMPORT_REASON[r.reason] || 'นำเข้าไม่สำเร็จ', 'warn'); app.audio.play('error'); armed = false; importBtn.lastChild.textContent = 'นำเข้าเซฟนี้'; return; }
    if (confirmReplace && !armed) {
      armed = true; importBtn.lastChild.textContent = `กดอีกครั้ง: แทนที่ ${st.story.name || 'เซฟเดิม'} ด้วย ${r.state.story.name} เลเวล ${r.state.player.level}`;
      say('เซฟที่เล่นอยู่ในแอปนี้จะถูกแทนที่ ถ้ายังต้องการเก็บไว้ ให้คัดลอกรหัสด้านบนก่อน', 'warn');
      return;
    }
    close();
    app.importSave(r.state, r.warnings);
  } }, glyph('up'), h('span', {}, 'นำเข้าเซฟนี้'));
  const importBlock = h('section', { class: 'st-block' },
    h('h3', {}, glyph('door'), hasHero ? 'นำเซฟจากที่อื่นเข้ามา' : 'ย้ายเซฟจากแอปหรือเครื่องอื่น'),
    h('p', { class: 'muted' }, 'ในเครื่องหรือแอปที่มีตัวละครอยู่ ให้เปิด ตั้งค่า → สำรองเซฟ แล้วคัดลอกรหัส จากนั้นนำมาวางที่นี่'),
    pasteArea,
    h('div', { class: 'st-row' }, importBtn, h('button', { class: 'btn', type: 'button', 'data-action': 'pick-save-file', onclick: () => fileInput.click() }, glyph('bag'), 'เลือกไฟล์เซฟ'), fileInput));

  const content = h('div', { class: 'modal panel save-transfer', 'data-modal': 'save-transfer' },
    h('h2', {}, hasHero ? 'สำรองและย้ายเซฟ' : 'ย้ายเซฟเข้ามา'),
    h('p', { class: 'notice' }, 'เซฟเก็บอยู่ในเบราว์เซอร์ของแต่ละแอป (LINE, Chrome, Safari แยกกัน) ถ้าจะเปลี่ยนแอปหรือเปลี่ยนเครื่อง ให้สำรองรหัสเซฟไว้ก่อน'),
    exportBlock, importBlock, status,
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'ปิด')));
  close = app.modal(content);
  return close;
}
