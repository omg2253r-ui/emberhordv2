// บทสอนผู้เล่น — a short, skippable walkthrough of the whole game.
// New heroes are asked once (right after the first camp story and bloodline awakening): "teach me?" → yes shows the
// pages, no ends it. Returning players can open the same pages any time from Settings ("วิธีเล่น").
// "Asked once" is the story flag `tut_pending`, set only by a brand-new game, so old saves are never interrupted.
import { h, glyph } from './dom.js';
import { cloneState } from '../core/state.js';

export const TUT_FLAG = 'tut_pending';
export const tutorialPending = (st) => st?.story?.flags?.[TUT_FLAG] === true;
export function markTutorialPending(state) { state.story.flags[TUT_FLAG] = true; return state; }

function clearPending(app) {
  const st = app.store.get();
  if (!tutorialPending(st)) return;
  const next = cloneState(st);
  delete next.story.flags[TUT_FLAG];
  app.store.commit(next, { reason: 'tutorial' });
}

// One page = icon + title + a few one-line points. Keep each point short: this is a quick guide, not a manual.
function pages(app) {
  const touch = !!app.touch;
  return [
    { icon: 'map', title: 'เป้าหมายของเกม', lines: [
      'ออกล่าสัตว์ร้ายและบอสในดัน เก็บของที่ดรอป',
      'กลับค่าย เปลี่ยนอุปกรณ์ ตีบวก ฝึกสกิล แล้วออกล่าที่ยากขึ้น',
      'เก่งขึ้นเรื่อยๆ เพื่อผ่านด่านใหม่ๆ และเปิดเนื้อเรื่อง',
    ] },
    { icon: 'sword', title: 'การต่อสู้', lines: touch ? [
      'ใช้ปุ่มบนหน้าจอ: เดิน โจมตี หลบ และสกิล',
      'โจมตีเป็นจังหวะ = คอมโบ · กดค้างแล้วปล่อย = ท่าชาร์จ',
      'หลบตอนศัตรูกำลังโจมตี = หลบสมบูรณ์ · ใช้ยาฟื้นพลังเมื่อเลือดต่ำ',
      'ย้ายหรือปรับขนาดปุ่มได้ที่ ตั้งค่า → ปรับปุ่ม',
    ] : [
      'WASD / ลูกศร = เดิน · J / Space / คลิก = โจมตี',
      'โจมตีเป็นจังหวะ = คอมโบ · กดค้างแล้วปล่อย = ท่าชาร์จ',
      'K / Shift = หลบ (หลบตอนศัตรูกำลังโจมตี = หลบสมบูรณ์)',
      'Q = ยาฟื้นพลัง · 1 / 2 / 3 = สกิล · R = สกิลเผ่า',
    ] },
    { icon: 'door', title: 'ระหว่างอยู่ในดัน', lines: [
      touch ? 'แตะปุ่มโต้ตอบเมื่อเข้าใกล้ เพื่อเปิดหีบ อ่านเอกสาร หรือพักที่กองไฟ' : 'E / F = เปิดหีบ อ่านเอกสาร ใช้กุญแจ พักที่กองไฟ',
      'กองไฟฟื้นพลังชีวิตและบันทึกให้ (ใช้ได้ครั้งเดียวต่อรอบ)',
      'ถ้าแพ้ ของที่เก็บได้ระหว่างทางยังอยู่ในกระเป๋า',
      'หยุดเกมแล้วเลือก "พักดัน" ได้ เพื่อกลับมาเล่นต่อทีหลัง',
    ] },
    { icon: 'bag', title: 'เมื่อกลับถึงค่าย', lines: [
      'แท็บด้านล่างคือเมนูทั้งหมดของค่าย',
      'ออกล่า = เลือกด่าน · อุปกรณ์ = สวมอาวุธ เกราะ ปีก',
      'ร้านค้า = ซื้อขายของ · บันทึก = เป้าหมายตอนนี้และสมุดบอส',
      'แถบด้านบนบอกเป้าหมายถัดไป แตะเพื่อดูรายละเอียด',
    ] },
    { icon: 'up', title: 'ทำให้แข็งแกร่งขึ้น', lines: [
      'เลเวลอัปทุกครั้งได้แต้มสเตตัส 3 แต้ม นำไปแจกที่แท็บสเตตัส',
      'สกิล = เรียนและอัปเกรดสกิลอาวุธ แล้วใส่ช่อง 1–3',
      'ตีเหล็ก = ตีบวกอุปกรณ์ ล้มเหลวจะเสียวัตถุดิบกับทอง และที่ระดับสูงอุปกรณ์จะตกลง 1 ระดับ',
      'หัวหน้าหมู่บ้านทำอาวุธจากพิมพ์เขียวให้',
    ] },
    { icon: 'paw', title: 'สายเลือดและสัตว์เลี้ยง', lines: [
      'สายเลือด = เผ่าของฮีโร่ ให้พลังและสกิลเผ่าเฉพาะตัว',
      'สัตว์เลี้ยง = ใช้ประกายอำพันเสก แล้วส่งไปสู้เคียงข้างได้เป็นทีม',
      'ประกายอำพันได้จากการผ่านด่านครั้งแรกและกิจกรรมต่างๆ',
    ] },
    { icon: 'globe', title: 'ยังมีอีกมาก', lines: [
      'หมู่บ้านออนไลน์ · หอคอย · รอยแยกไร้สิ้นสุด · จักรวาลอาร์ติแฟกต์ เปิดให้เล่นเมื่อไปไกลขึ้น',
      'สมัครบัญชีเกมเพื่อเก็บเซฟออนไลน์ ที่ ตั้งค่า → บัญชีเกม',
      'อยากดูบทสอนนี้อีก เปิดได้ที่ ตั้งค่า → วิธีเล่น',
    ] },
  ];
}

// The paged guide. Used by the offer below (yes) and by Settings.
export function openTutorial(app, { onClose } = {}) {
  const list = pages(app);
  let i = 0, close;
  const icon = h('span', { class: 'tut-ic' });
  const title = h('h3', { class: 'tut-title' });
  const body = h('ul', { class: 'tut-lines' });
  const count = h('small', { class: 'muted tut-count num' });
  const dots = list.map((_, k) => h('i', { class: 'tut-dot', 'aria-hidden': 'true' }));
  const back = h('button', { class: 'btn', type: 'button', 'data-action': 'tutorial-back', onclick: () => go(i - 1) }, 'ย้อนกลับ');
  const next = h('button', { class: 'btn primary', type: 'button', 'data-action': 'tutorial-next', onclick: () => { if (i >= list.length - 1) close(); else go(i + 1); } });
  const skip = h('button', { class: 'link-btn tut-skip', type: 'button', 'data-action': 'tutorial-skip', onclick: () => close() }, 'ข้าม');

  function go(n) {
    i = Math.max(0, Math.min(list.length - 1, n));
    const p = list[i];
    icon.replaceChildren(glyph(p.icon));
    title.textContent = p.title;
    body.replaceChildren(...p.lines.map((t) => h('li', {}, t)));
    count.textContent = `${i + 1} / ${list.length}`;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    back.disabled = i === 0;
    next.textContent = i >= list.length - 1 ? 'เข้าใจแล้ว' : 'ถัดไป';
    skip.hidden = i >= list.length - 1;
    app.audio?.play?.('click');
  }

  const content = h('div', { class: 'modal panel tutorial', 'data-modal': 'tutorial', role: 'dialog', 'aria-label': 'วิธีเล่น' },
    h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, 'วิธีเล่น'),
    h('div', { class: 'tut-card' }, icon, title, body),
    h('div', { class: 'tut-nav' }, h('div', { class: 'tut-dots' }, dots), count),
    h('div', { class: 'actions' }, back, next),
    skip);
  close = app.modal(content, { onClose });
  go(0);
  app.audio?.play?.('unlock');
  return close;
}

// New heroes only: asks first, and only teaches when the player says yes. Calls `then` when everything is finished
// (answered "no", or the guide was closed) — also right away when there is nothing to ask.
export function offerTutorial(app, then) {
  if (!tutorialPending(app.store.get())) { then?.(); return false; }
  let yes = false, close;
  const answer = (v) => { yes = v; clearPending(app); close(); };
  const content = h('div', { class: 'modal panel tutorial-offer', 'data-modal': 'tutorial-offer', role: 'dialog', 'aria-label': 'ให้สอนวิธีเล่นไหม' },
    h('h2', {}, 'ให้สอนวิธีเล่นไหม'),
    h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, 'สั้นๆ ไม่ถึงหนึ่งนาที อธิบายตั้งแต่การต่อสู้ไปจนถึงแนวทางของเกม'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', 'data-action': 'tutorial-no', onclick: () => answer(false) }, 'ไม่ต้อง'),
      h('button', { class: 'btn primary', type: 'button', 'data-action': 'tutorial-yes', onclick: () => answer(true) }, 'สอนเลย')),
    h('small', { class: 'faint', style: { textAlign: 'center' } }, 'เปิดดูทีหลังได้ที่ ตั้งค่า → วิธีเล่น'));
  close = app.modal(content, { dismissable: false, onClose: () => { if (yes) openTutorial(app, { onClose: then }); else then?.(); } });
  app.audio?.play?.('unlock');
  return true;
}
