// Title screen, camp shell (top bar + dock + panel sheet), result / pause / settings modals.
import { QUALITY, QUALITY_IDS, QUALITY_HELP, cleanQuality, suggestQuality } from '../config/quality.js';
import { h, glyph, itemImg, rarityClass, confirmButton, fmt } from './dom.js';
import { GAME_VERSION, hasUnseenNotes } from '../data/changelog.js';
import { getItem } from '../data/items.js';
import { getStage } from '../data/stages.js';
import { xpToNext } from '../config/balance.js';
import { createStagesPanel } from './panels/stages.js';
import { createGearPanel } from './panels/gear.js';
import { createForgePanel } from './panels/forge.js';
import { createShopPanel } from './panels/shop.js';
import { createSkillsPanel } from './panels/skills.js';
import { createJournalPanel } from './panels/journal.js';
import { createHonorPanel } from './panels/honor.js';
import { createBloodlinePanel } from './panels/bloodline.js';
import { createPetsPanel } from './panels/pets.js';
import { createAttrsPanel } from './panels/attrs.js';
import { POINTS_PER_LEVEL } from '../data/attributes.js';
import { currentGoal } from '../systems/story.js';
import { HERO_NAME_MAX } from '../core/state.js';
import { fsMode, isFullscreen, enterFullscreen, exitFullscreen, onFullscreenChange } from './fullscreen.js';

const LOGO = `<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="33" fill="#17110e" stroke="#e0b45a" stroke-width="2"/><circle cx="36" cy="36" r="27" fill="none" stroke="#8f6f37" stroke-width="1"/>
<path d="M36 12c6 9 14 14 14 25a14 14 0 0 1-28 0c0-7 4-11 7-15 0 6 3 9 6 10-2-8 0-14 1-20z" fill="#c2412f" stroke="#241712" stroke-width="2" stroke-linejoin="round"/>
<path d="M36 30c3 5 7 8 7 13a7 7 0 0 1-14 0c0-4 3-7 4-9 0 3 2 5 3 5 0-4 0-6 0-9z" fill="#f5d48a"/><path d="M22 58h28" stroke="#e0b45a" stroke-width="2.5" stroke-linecap="round"/></svg>`;

const unseen = () => (hasUnseenNotes() ? h('i', { class: 'new-dot', 'aria-label': 'มีอัปเดตใหม่' }) : null);

// the English line under each panel title (as on the game's design sheet)
const PANEL_EN = { stages: 'Hunt · Dungeons', gear: 'Equipment', attrs: 'Status · Attributes', skills: 'Weapon Skills', bloodline: 'Bloodline', pets: 'Pet / Familiar', forge: 'Upgrade / Enhance', shop: 'Shop', honor: 'Honor · Ranking', journal: 'Journal · Bestiary' };

export function createScreens(root, app) {
  // ------------------------------------------------------------ loading
  const loadBar = h('i');
  const loadMsg = h('div', { class: 'muted' }, 'กำลังวาดตัวละคร…');
  const loading = h('div', { class: 'layer' }, h('div', { class: 'screen-center' }, h('div', { class: 'loading' }, h('div', { class: 'logo' }, h('span', { class: 'mark', html: LOGO })), h('div', { class: 'bar' }, loadBar), loadMsg)));

  // ------------------------------------------------------------ title
  const titleNotice = h('div', { hidden: true });
  const acctBtn = h('button', { class: 'acct-btn', type: 'button', 'data-action': 'account', onclick: () => app.openAccount() });
  function updateAcct() {
    const a = app.cloud?.account?.();
    acctBtn.classList.toggle('on', !!a);
    acctBtn.replaceChildren(glyph(a ? 'check' : 'globe'), h('span', {}, a ? `บัญชี ${a.name} · เซฟออนไลน์เปิดอยู่` : 'เซฟออนไลน์: สมัคร / เข้าสู่ระบบ'));
  }
  const corruptRow = h('div', { class: 'corrupt-row', hidden: true },
    h('span', {}, 'เซฟเดิมที่อ่านไม่ได้ยังถูกเก็บไว้'),
    h('button', { class: 'link-btn', type: 'button', 'data-action': 'download-corrupt', onclick: () => app.downloadCorrupt() }, glyph('down'), 'ดาวน์โหลดเก็บไว้'));
  const titleSummary = h('div', { class: 'save-summary' });
  const continueBtn = h('button', { class: 'btn primary', type: 'button', 'data-action': 'continue', onclick: () => app.continueGame() }, 'เล่นต่อ');
  const newBtnHost = h('div', { style: { display: 'grid' } });
  const title = h('div', { class: 'layer', hidden: true },
    h('div', { class: 'screen-center' },
      h('div', { class: 'title-card panel' },
        h('div', { class: 'logo' }, h('span', { class: 'mark', html: LOGO }), h('h1', {}, 'EMBERHOLD'), h('div', { class: 'sub' }, 'นักล่าแห่งป่าหนาม')),
        h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)' } }, 'ล่าสัตว์ร้ายในป่าหนาม เก็บวัตถุดิบ แล้วกลับมาตีบวกอาวุธที่ค่ายริมกองไฟ'),
        titleNotice,
        h('div', { class: 'menu' }, continueBtn, newBtnHost),
        acctBtn,
        titleSummary,
        h('button', { class: 'link-btn', type: 'button', 'data-action': 'transfer-in', onclick: () => app.openSaveTransfer({ mode: 'import', hasSave: !continueBtn.hidden }) }, glyph('door'), 'ย้ายเซฟจากแอปหรือเครื่องอื่น'),
        corruptRow,
        h('button', { class: 'whats-new', type: 'button', 'data-action': 'whats-new', onclick: () => app.openPatchNotes() }, glyph('star'), `มีอะไรใหม่ · v${GAME_VERSION.replace(/\.0$/, '')}`, unseen()),
        h('small', { class: 'faint' }, 'เกมบันทึกอัตโนมัติในเบราว์เซอร์นี้'))));

  function showTitle({ hasSave, summary, notice, corrupt = false }) {
    corruptRow.hidden = !corrupt;
    updateAcct();
    for (const l of [loading, camp, title]) l.hidden = l !== title;
    app.audio.music('title');
    continueBtn.hidden = !hasSave;
    titleSummary.replaceChildren(...(summary ? [h('span', {}, `เลเวล ${summary.level}`), h('span', {}, `ทอง ${fmt(summary.gold)}`), h('span', {}, `ผ่านด่าน ${summary.cleared}`)] : []));
    titleNotice.hidden = !notice;
    if (notice) { titleNotice.className = 'notice'; titleNotice.textContent = notice; }
    newBtnHost.replaceChildren(hasSave
      ? confirmButton('เริ่มเกมใหม่', 'กดอีกครั้ง: ลบเซฟเดิมแล้วเริ่มใหม่', () => app.newGame(), 'btn')
      : h('button', { class: 'btn primary', type: 'button', 'data-action': 'new-game', onclick: () => app.newGame() }, 'เริ่มผจญภัย'));
    (hasSave ? continueBtn : newBtnHost.firstChild).focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ camp
  const panels = [createStagesPanel(app), createGearPanel(app), createAttrsPanel(app), createSkillsPanel(app), createBloodlinePanel(app), createPetsPanel(app), createForgePanel(app), createShopPanel(app), createHonorPanel(app), createJournalPanel(app)];
  let current = null;
  // the level badge doubles as my profile button: my picture (or bloodline portrait) behind the level number
  const lvNum = h('span', { class: 'lv-n' }, '1');
  const topAvatar = h('img', { class: 'lv-avatar', alt: '', draggable: 'false' });
  const lvBtn = h('button', { class: 'lv-num num', type: 'button', 'data-action': 'open-profile', 'aria-label': 'โปรไฟล์ของฉัน', onclick: () => app.openProfile() }, topAvatar, lvNum);
  const xpFill = h('i'), xpText = h('span', { class: 'name num' });
  const goalBtn = h('button', { class: 'goal-line', type: 'button', 'data-action': 'goal', onclick: () => openPanel('journal') }, glyph('crown'), h('span', {}));
  const goldPill = h('div', { class: 'gold-pill', 'aria-label': 'ทอง' }, itemImg('gold'), h('span', { class: 'num', 'data-gold': '' }, '0'));
  const settingsBtn = h('button', { class: 'btn icon', type: 'button', 'aria-label': 'ตั้งค่า', 'data-action': 'settings', onclick: () => openSettings() }, glyph('gear'));
  const topbar = h('div', { class: 'topbar' },
    h('div', { class: 'lv-badge' }, lvBtn, h('div', { class: 'lv-meta' }, xpText, h('div', { class: 'xpbar' }, xpFill), goalBtn)),
    goldPill, settingsBtn);
  const tabs = panels.map((p) => h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': 'false', 'data-tab': p.id, onclick: () => togglePanel(p.id) }, glyph(p.icon), h('span', {}, p.short || p.title), h('i', { class: 'dot', hidden: true })));
  const dock = h('nav', { class: 'dock', role: 'tablist', 'aria-label': 'เมนูค่าย' }, tabs);
  const sheetTitle = h('h2', {});
  const sheetBody = h('div', { class: 'sheet-body' });
  const sheet = h('section', { class: 'sheet panel', hidden: true, 'aria-live': 'polite' },
    h('div', { class: 'sheet-head' }, sheetTitle, h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'ปิด', 'data-action': 'close-sheet', onclick: () => closePanel(false) }, glyph('close'))),
    sheetBody);
  const camp = h('div', { class: 'layer', hidden: true }, topbar, sheet, dock);

  function renderPanel() {
    if (!current) return;
    const p = panels.find((x) => x.id === current);
    sheetTitle.replaceChildren(p.title, PANEL_EN[p.id] ? h('small', { class: 'en' }, PANEL_EN[p.id]) : '');
    try {
      p.render(sheetBody);
    } catch (err) {
      // v9.0.1: a panel that throws used to leave the PREVIOUS panel's content under the new title (pets tab showing a drop table).
      console.error(`panel ${p.id} failed to render`, err);
      sheetBody.replaceChildren(h('div', { class: 'notice warn', role: 'alert', 'data-panel-error': p.id },
        h('b', {}, `เปิดหน้า “${p.title}” ไม่สำเร็จ`),
        h('small', {}, 'เกิดข้อผิดพลาดตอนแสดงผล ข้อมูลของคุณไม่เสียหาย'), h('code', { class: 'err-detail', style: { display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', opacity: '.85' } }, `${err?.name || 'Error'}: ${err?.message || err}\n${String(err?.stack || '').split('\n').slice(1, 4).map((s) => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join('\n')}`),
        h('button', { class: 'btn small', type: 'button', 'data-action': 'panel-retry', onclick: () => renderPanel() }, 'ลองใหม่')));
    }
  }
  function openPanel(id, params) {
    const p = panels.find((x) => x.id === id);
    if (!p) return;
    if (current !== id) sheetBody.scrollTop = 0;
    current = id; p.open?.(params);
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
    sheet.hidden = false;
    sheet.style.animation = 'none'; void sheet.offsetWidth; sheet.style.animation = '';
    app.audio.play('tab');
    renderPanel();
  }
  function closePanel(silent = false) {
    current = null; sheet.hidden = true;
    tabs.forEach((t) => t.setAttribute('aria-selected', 'false'));
    if (!silent) app.audio.play('click');
  }
  function togglePanel(id) { if (current === id) closePanel(); else openPanel(id); }

  let lastGold = null;
  function renderTop(st) {
    lvNum.textContent = st.player.level;
    const av = st.profile?.avatar || app.portraitUri('hero');
    if (topAvatar.getAttribute('src') !== av) topAvatar.src = av;
    const need = xpToNext(st.player.level);
    xpText.replaceChildren(h('span', { class: 'xp-num' }, `XP ${st.player.xp}/${need}`), h('span', { class: 'xp-name' }, st.story.name)); // v9.0.1: the XP numbers used to be cut off by the ellipsis
    goalBtn.lastChild.textContent = currentGoal(st).text;
    panels.forEach((p, i) => { tabs[i].querySelector('.dot').hidden = !(p.badge && p.badge()); });
    xpFill.style.width = `${Math.min(100, (st.player.xp / need) * 100)}%`;
    goldPill.querySelector('[data-gold]').textContent = fmt(st.gold);
    if (lastGold != null && st.gold !== lastGold) { goldPill.classList.remove('bump'); void goldPill.offsetWidth; goldPill.classList.add('bump'); }
    lastGold = st.gold;
  }

  function showCamp(openId) {
    for (const l of [loading, title, camp]) l.hidden = l !== camp;
    document.body.classList.add('in-camp');
    lastGold = null;
    renderTop(app.store.get());
    if (openId) openPanel(openId); else if (current) renderPanel();
  }

  // ------------------------------------------------------------ modals
  const modalHost = h('div', { class: 'layer' });
  function modal(content, { onClose = null, dismissable = true } = {}) {
    const back = h('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' }, content);
    if (dismissable) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    const onKey = (e) => { if (e.key === 'Escape' && dismissable && modalHost.lastElementChild === back) close(); };   // v8.5.1: only the top-most window answers Esc
    window.addEventListener('keydown', onKey);
    function close() { window.removeEventListener('keydown', onKey); back.remove(); onClose?.(); }
    modalHost.append(back);
    setTimeout(() => content.querySelector('button')?.focus({ preventScroll: true }), 30);
    return close;
  }

  function fullscreenRows(s) {
    const mode = fsMode();
    if (mode === 'app') return [h('div', { class: 'setting', 'data-fs-mode': mode }, glyph('expand'), 'เต็มจอ', h('small', { class: 'muted' }, 'เปิดจากไอคอนบนหน้าจอโฮม เต็มจออยู่แล้ว'))];
    if (mode === 'homescreen') {
      const how = h('div', { class: 'fs-howto', hidden: true },
        h('b', {}, 'iPhone / iPad: เล่นเต็มจอไม่มีแถบเว็บ'),
        h('ol', {},
          h('li', {}, 'เปิดเกมใน Safari แล้วแตะปุ่ม "แชร์" (สี่เหลี่ยมมีลูกศรชี้ขึ้น)'),
          h('li', {}, 'เลือก "เพิ่มไปยังหน้าจอโฮม" แล้วกด "เพิ่ม"'),
          h('li', {}, 'เปิดเกมจากไอคอน Emberhold บนหน้าจอโฮม เกมจะเต็มจอทุกครั้ง')),
        h('small', { class: 'muted' }, 'เซฟเก่าในเบราว์เซอร์ไม่ย้ายไปไอคอนเอง ใช้ "บัญชีเกม · เซฟออนไลน์" หรือ "สำรองเซฟ / ย้ายเครื่อง" เพื่อเอาเซฟไปด้วย'));
      return [h('div', { class: 'setting', 'data-fs-mode': mode }, glyph('expand'), 'เต็มจอ (ไม่มีแถบเว็บ)',
        h('button', { class: 'btn small', type: 'button', 'data-action': 'fs-howto', onclick: () => { how.hidden = !how.hidden; } }, 'วิธีเปิด')), how];
    }
    if (mode === 'none') return [h('div', { class: 'setting', 'data-fs-mode': mode }, glyph('expand'), 'เต็มจอ', h('small', { class: 'muted' }, 'เปิดเกมจากเว็บไซต์ของเกมเพื่อใช้โหมดเต็มจอ'))];
    // the browser can go full screen: a switch that acts now and is remembered (next visit: full screen on first tap)
    const sw = h('input', { type: 'checkbox', class: 'switch', id: 'set-fullscreen', 'data-setting': 'fullscreen', 'aria-label': 'เต็มจอ' });
    sw.checked = isFullscreen() || !!s.fullscreen;
    const land = h('input', { type: 'checkbox', class: 'switch', id: 'set-landscape', 'aria-label': 'ล็อกแนวนอนตอนเต็มจอ' });
    land.checked = !!s.landscape;
    sw.addEventListener('change', async () => {
      const on = sw.checked;
      app.updateSettings({ fullscreen: on });
      app.rearmFullscreen?.();
      if (on) {
        const ok = await enterFullscreen({ landscape: app.touch && land.checked });
        if (!ok) app.toast('เบราว์เซอร์ไม่ยอมเปิดเต็มจอตอนนี้ แตะหน้าจอหนึ่งครั้งแล้วเกมจะเต็มจอเอง', 'info', 'fs');
      } else await exitFullscreen();
    });
    land.addEventListener('change', () => { app.updateSettings({ landscape: land.checked }); if (isFullscreen() && land.checked) screen.orientation?.lock?.('landscape').catch(() => {}); else if (!land.checked) { try { screen.orientation?.unlock?.(); } catch { /* not locked */ } } });
    const off = onFullscreenChange(() => { if (!sw.isConnected) { off(); return; } if (isFullscreen()) sw.checked = true; else if (!app.store.get().settings.fullscreen) sw.checked = false; });
    return [
      h('label', { class: 'setting', for: 'set-fullscreen', 'data-fs-mode': mode }, glyph('expand'), h('span', {}, 'เต็มจอ (ซ่อนแท็บและแถบเว็บ)', h('small', { class: 'muted setting-sub' }, 'จำไว้: เปิดเกมครั้งหน้าจะเต็มจอเมื่อแตะครั้งแรก · กด Esc หรือปัดขอบจอเพื่อออก')), sw),
      app.touch ? h('label', { class: 'setting', for: 'set-landscape' }, glyph('rotate'), 'ล็อกแนวนอนตอนเต็มจอ', land) : null,
    ].filter(Boolean);
  }

  function settingsRows() {
    const st = app.store.get();
    const s = st.settings;
    const sfx = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.sfx * 100), id: 'set-sfx', 'aria-label': 'ระดับเสียงเอฟเฟกต์' });
    const mus = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.music * 100), id: 'set-music', 'aria-label': 'ระดับเสียงดนตรี' });
    const uiv = h('input', { type: 'range', min: 0, max: 100, value: Math.round((s.ui ?? 0.7) * 100), id: 'set-ui', 'aria-label': 'ระดับเสียงเมนู' });
    const shake = h('input', { type: 'checkbox', class: 'switch', id: 'set-shake', 'aria-label': 'สั่นหน้าจอ' });
    shake.checked = s.shake;
    const apply = () => app.updateSettings({ sfx: sfx.value / 100, music: mus.value / 100, ui: uiv.value / 100, shake: shake.checked });
    // the sliders act while they move (so you hear the level), and are saved when let go
    const live = () => app.audio.setVolumes(sfx.value / 100, mus.value / 100, uiv.value / 100);
    for (const r of [sfx, mus, uiv]) r.addEventListener('input', live);
    sfx.addEventListener('change', () => { apply(); app.audio.play('hit'); });
    uiv.addEventListener('change', () => { apply(); app.audio.play('unlock'); });
    mus.addEventListener('change', apply);
    const nowPlaying = h('small', { class: 'muted now-playing', 'data-now-playing': '' }, app.audio.trackName ? `กำลังเล่น: ${app.audio.trackName}` : 'ดนตรีจะเริ่มเมื่อแตะหน้าจอครั้งแรก');
    shake.addEventListener('change', apply);
    const nameIn = h('input', { type: 'text', id: 'set-name', maxlength: String(HERO_NAME_MAX), value: st.story.name, 'aria-label': 'ชื่อนักล่า', class: 'text-in' });
    nameIn.addEventListener('change', () => app.renameHero(nameIn.value));
    // Full screen without the browser's tabs and address bar (see ui/fullscreen.js for how each device gets there)
    const fsRows = fullscreenRows(s);
    const layoutRow = h('div', { class: 'setting' }, glyph('hand'), 'ปุ่มในการต่อสู้: ย้ายตำแหน่ง / ขนาด',
      h('button', { class: 'btn small', type: 'button', 'data-action': 'edit-layout', onclick: () => app.openLayoutEditor() }, 'ปรับปุ่ม'));
    // คุณภาพกราฟิก: ต่ำ / กลาง / สูง (graphics only) (see config/quality.js)
    const curQ = cleanQuality(s.quality);
    const hint = (id) => QUALITY_HELP[id] + (id === suggestQuality() ? ' · แนะนำสำหรับเครื่องนี้' : '');
    const qHelp = h('small', { class: 'muted setting-sub', 'data-quality-help': '' }, hint(curQ));
    const qBtns = QUALITY_IDS.map((id) => h('button', { class: 'btn small', type: 'button', role: 'radio', 'data-quality': id, 'aria-checked': String(id === curQ), onclick: () => pickQuality(id) }, QUALITY[id].label));
    function pickQuality(id) {
      for (const b of qBtns) b.setAttribute('aria-checked', String(b.dataset.quality === id));
      qHelp.textContent = hint(id);
      app.updateSettings({ quality: id });
      app.audio.play('click');
    }
    const qualityRow = h('div', { class: 'setting setting-quality', 'data-setting': 'quality' }, glyph('gear'),
      h('span', {}, 'คุณภาพกราฟิก', qHelp),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'คุณภาพกราฟิก' }, ...qBtns));
    return [
      ...fsRows,
      qualityRow,
      layoutRow,
      h('label', { class: 'setting', for: 'set-name' }, glyph('talk'), 'ชื่อนักล่า', nameIn),
      h('label', { class: 'setting', for: 'set-music' }, glyph('music'), h('span', {}, 'ดนตรี', nowPlaying), mus),
      h('label', { class: 'setting', for: 'set-sfx' }, glyph('sound'), h('span', {}, 'เสียงเอฟเฟกต์', h('small', { class: 'muted setting-sub' }, 'การต่อสู้ ศัตรู และโลก')), sfx),
      h('label', { class: 'setting', for: 'set-ui' }, glyph('sound'), h('span', {}, 'เสียงเมนู', h('small', { class: 'muted setting-sub' }, 'ปุ่ม รางวัล และการแจ้งเตือน')), uiv),
      h('label', { class: 'setting', for: 'set-shake' }, glyph('shake'), 'สั่นหน้าจอเมื่อโดนโจมตี', shake),
    ];
  }

  const keysHelp = () => h('div', { class: 'keys' },
    h('kbd', {}, 'WASD / ลูกศร'), h('span', {}, 'เดิน'),
    h('kbd', {}, 'J / Space / คลิก'), h('span', {}, 'โจมตี: กดเป็นจังหวะ = คอมโบตามอาวุธ · กดค้างแล้วปล่อย = ท่าชาร์จ'),
    h('kbd', {}, 'K / Shift'), h('span', {}, 'หลบ (2 ชาร์จ) ยกเลิกท่าได้ · หลบตอนศัตรูกำลังโดน = หลบสมบูรณ์ · หลบแล้วโจมตี = ท่าหลังหลบ'),
    h('kbd', {}, 'Q'), h('span', {}, 'ใช้ยาฟื้นพลัง'),
    h('kbd', {}, '1 / 2 / 3'), h('span', {}, 'ใช้สกิลในช่อง 1–3 (หรือ U / I / O)'),
    h('kbd', {}, 'R / 4'), h('span', {}, 'สกิลเผ่า'),
    h('kbd', {}, 'E / F'), h('span', {}, 'เปิดหีบ อ่านเอกสาร พักที่กองไฟ ใช้กุญแจ'),
    h('kbd', {}, 'Esc / P'), h('span', {}, 'หยุดเกม'));

  function openSettings() {
    app.audio.play('click');
    let close;
    const content = h('div', { class: 'modal panel' },
      h('h2', {}, 'ตั้งค่า'),
      settingsRows(),
      keysHelp(),
      h('div', { class: 'settings-links' },
        h('button', { class: 'btn', type: 'button', 'data-action': 'open-account', onclick: () => { close(); app.openAccount(); } }, glyph('globe'), app.cloud?.account?.() ? `บัญชี ${app.cloud.account().name}` : 'บัญชีเกม · เซฟออนไลน์'),
        h('button', { class: 'btn', type: 'button', 'data-action': 'open-transfer', onclick: () => { close(); app.openSaveTransfer({ mode: 'both' }); } }, glyph('scroll'), 'สำรองเซฟ / ย้ายเครื่อง'),
        h('button', { class: 'btn', type: 'button', 'data-action': 'open-notes', onclick: () => { close(); app.openPatchNotes(); } }, glyph('star'), `ประกาศอัปเดต (v${GAME_VERSION})`),
        h('button', { class: 'btn', type: 'button', 'data-action': 'open-tutorial', onclick: () => { close(); app.openTutorial(); } }, glyph('book'), 'วิธีเล่น (บทสอน)')),
      h('div', { class: 'actions' },
        confirmButton('ลบเซฟและเริ่มใหม่', 'กดอีกครั้งเพื่อลบถาวร', () => { close(); app.deleteSave(); }, 'btn danger'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => close() }, 'เสร็จ')));
    close = modal(content);
  }

  function openPause() {
    let close;
    const content = h('div', { class: 'modal panel', 'data-modal': 'pause' },
      h('h2', {}, 'พักการล่า'),
      settingsRows(),
      keysHelp(),
      h('button', { class: 'btn gold', type: 'button', 'data-action': 'open-bag', onclick: () => app.openBag({ fromPause: true }) }, glyph('bag'), 'กระเป๋า · ล็อก ★ / ขายของ'),
      h('div', { class: 'actions' },
        confirmButton('ยกเลิกดันนี้', 'ยืนยัน: ทิ้งดันนี้และกลับค่าย (ของที่เก็บแล้วยังอยู่)', () => { close(); app.retreat(); }, 'btn danger'),
        h('button', { class: 'btn', type: 'button', 'data-action': 'rest-dungeon', onclick: () => { close(); app.restDungeon(); } }, glyph('door'), 'พักดัน · ต่อทีหลัง'),
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'resume', onclick: () => close() }, 'สู้ต่อ')),
      h('p', { class: 'muted', style: { margin: 0, fontSize: 'var(--step--1)', textAlign: 'center' } }, 'พักดัน: เซฟห้อง กุญแจ และพลังชีวิตไว้ แล้วกลับมาเล่นต่อได้ที่แท็บออกล่า'));
    close = modal(content, { onClose: () => app.resumeBattle() });
    return close;
  }

  function openResult(res) {
    const { outcome, run, stage, completion } = res;
    const titleText = outcome === 'victory' ? 'ล่าสำเร็จ' : outcome === 'defeat' ? 'พ่ายแพ้' : 'ถอนตัว';
    const sub = outcome === 'victory' ? stage.name : outcome === 'defeat' ? 'ของที่เก็บได้ระหว่างทางยังอยู่ในกระเป๋า' : 'กลับค่ายพร้อมของที่เก็บได้';
    let close;
    const nextStage = completion?.unlocked?.length ? getStage(completion.unlocked[0]) : null;
    const content = h('div', { class: 'modal panel', 'data-modal': 'result', 'data-outcome': outcome },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, stage.name),
      h('h2', { class: outcome === 'victory' ? '' : 'lose' }, titleText),
      h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, sub),
      completion?.firstClear ? h('div', { class: 'notice ok' }, `ผ่านด่านครั้งแรก รับโบนัส ${completion.bonusGold} ทอง และประกายอำพัน ${completion.bonusSparks} ${nextStage ? ` · ปลดล็อก ${nextStage.name}` : ''}`) : null,
      h('div', { class: 'kv' },
        h('div', {}, h('span', { class: 'muted' }, 'กำจัด'), h('b', {}, `${run.kills} ตัว`)),
        h('div', {}, h('span', { class: 'muted' }, 'เวลา'), h('b', {}, `${Math.floor(run.seconds / 60)}:${String(run.seconds % 60).padStart(2, '0')}`)),
        h('div', {}, h('span', { class: 'muted' }, 'ประสบการณ์'), h('b', {}, `+${run.xp}`)),
        h('div', {}, h('span', { class: 'muted' }, 'ทอง'), h('b', {}, `+${fmt(run.gold)}`)),
        run.totalRooms ? h('div', {}, h('span', { class: 'muted' }, 'สำรวจ'), h('b', {}, `${run.rooms}/${run.totalRooms} ห้อง`)) : null,
        run.totalRooms ? h('div', {}, h('span', { class: 'muted' }, 'หีบ · เอกสาร'), h('b', {}, `${run.chests} · ${run.lore}`)) : null,
        h('div', {}, h('span', { class: 'muted' }, 'คอมโบสูงสุด'), h('b', {}, `${run.bestCombo || 0} ฮิต`)),
        h('div', {}, h('span', { class: 'muted' }, 'หลบสมบูรณ์'), h('b', {}, `${run.perfects || 0} ครั้ง`)),
        run.sparks ? h('div', {}, h('span', { class: 'muted' }, 'ประกายอำพัน'), h('b', {}, `+${run.sparks}`)) : null),
      run.luckLoot ? h('div', { class: 'notice ok', 'data-luck-loot': '' }, `โบนัสยาโชคดี: ได้ของเพิ่มตอนจบดัน ${run.luckLoot.map((d) => `${getItem(d.id)?.name || d.id}${d.qty > 1 ? ' ×' + d.qty : ''}`).join(' · ')}`) : null,
      run.levelUps ? h('div', { class: 'notice ok' }, `เลเวลอัป ${run.levelUps} ครั้ง · ได้แต้มสเตตัส +${run.levelUps * POINTS_PER_LEVEL}`) : null,
      h('div', { class: 'eyebrow' }, `ของที่ได้ (${run.items.length} ชนิด)`),
      run.items.length
        ? h('div', { class: 'loot-grid' }, run.items.map((it, i) => {
          const def = getItem(it.id);
          return h('div', { class: `cell ${rarityClass(def.rarity)}`, title: def.name, style: { animationDelay: `${i * 60}ms` } }, itemImg(it.id), h('span', { class: 'qty' }, it.qty));
        }))
        : h('div', { class: 'empty-note' }, 'รอบนี้ไม่ได้ไอเทม'),
      res.saveOk ? null : h('div', { class: 'notice' }, 'บันทึกเกมไม่สำเร็จ (เบราว์เซอร์อาจปิดพื้นที่จัดเก็บ) ความคืบหน้าจะหายเมื่อปิดหน้า'),
      h('div', { class: 'actions' },
        // v8.4: every result window can start the same run again (the dungeon's own saved run was cleared when it ended)
        h('button', { class: outcome === 'victory' ? 'btn gold' : 'btn', type: 'button', 'data-action': 'again', onclick: () => { close(); app.startBattle(stage.id); } },
          glyph('sword'), outcome === 'victory' ? 'เล่นซ้ำด่านนี้' : outcome === 'defeat' ? 'ลองใหม่อีกครั้ง' : 'ล่าอีกครั้ง'),
        h('button', { class: 'btn primary', type: 'button', 'data-action': 'to-camp', onclick: () => { close(); app.goCamp(run.items.some((x) => getItem(x.id)?.category !== 'consumable') ? 'gear' : null); } }, 'กลับค่าย')));
    close = modal(content, { dismissable: false });
  }

  root.append(loading, title, camp, modalHost);

  return {
    loading: {
      progress(f, msg) { loadBar.style.width = `${Math.round(f * 100)}%`; if (msg) loadMsg.textContent = msg; },
      error(msg) { loadMsg.textContent = msg; loadMsg.style.color = 'var(--danger)'; },
    },
    showTitle, showCamp,
    hideAll() { for (const l of [loading, title, camp]) l.hidden = true; document.body.classList.remove('in-camp'); },
    refreshTitle: () => updateAcct(),
    openPanel, closePanel, rerender: renderPanel, renderTop, openPause, openResult, openSettings, modal,
    setBusy(b) { tabs.forEach((t) => { t.disabled = b; }); settingsBtn.disabled = b; },
    get currentPanel() { return current; },
    get campVisible() { return !camp.hidden; },
  };
}
