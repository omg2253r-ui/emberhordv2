// Story presentation: dialogue box, document reader and hero naming.
// The dialogue sits along the bottom edge so the scene above stays visible.
import { h, glyph } from './dom.js';
import { sceneLines, loreText, markSeen, discoverLore } from '../systems/story.js';
import { SCENES } from '../data/story.js';
import { storyTrack } from '../data/music.js';
import { SKILLS } from '../data/skills.js';
import { HERO_NAME_MAX, cleanHeroName } from '../core/state.js';

export function createStoryUi(root, app) {
  const layer = h('div', { class: 'story-layer' });
  root.append(layer);
  const queue = [];
  let busy = false;

  // ---------------------------------------------------------------- dialogue
  function playScene(sceneId, onDone) {
    if (busy) { queue.push([sceneId, onDone]); return; }
    const lines = sceneLines(app.store.get(), sceneId);
    if (!lines.length) { finishScene(sceneId, onDone); return; }
    busy = true;
    app.input.setEnabled(false);
    app.audio.pushMusic(storyTrack(sceneId));
    let i = 0, shown = 0, full = '', timer = 0, closed = false;

    const portrait = h('img', { class: 'dlg-portrait', alt: '' });
    const who = h('div', { class: 'dlg-who' });
    const text = h('p', { class: 'dlg-text' });
    const hint = h('div', { class: 'dlg-hint' }, app.touch ? 'แตะเพื่อไปต่อ' : 'คลิก / Space เพื่อไปต่อ');
    const title = h('div', { class: 'dlg-title' }, SCENES[sceneId].title);
    const skip = h('button', { class: 'dlg-skip', type: 'button', 'data-action': 'skip-scene' }, 'ข้ามฉาก', glyph('skip'));
    const box = h('div', { class: 'dlg-box', role: 'dialog', 'aria-live': 'polite', 'data-scene': sceneId },
      h('div', { class: 'dlg-face' }, portrait), h('div', { class: 'dlg-body' }, h('div', { class: 'dlg-head' }, who, title), text, hint), skip);
    const shade = h('div', { class: 'dlg-shade' });
    const wrap = h('div', { class: 'dlg' }, shade, box);
    layer.append(wrap);

    function render() {
      const l = lines[i];
      box.className = `dlg-box s-${l.s}${l.memory ? ' memory' : ''}${l.thought ? ' thought' : ''}`;
      box.dataset.scene = sceneId;
      if (l.portrait) { portrait.src = app.portraitUri(l.portrait); portrait.hidden = false; } else portrait.hidden = true;
      box.classList.toggle('no-face', !l.portrait);
      who.textContent = l.thought ? `${l.who} (ในใจ)` : l.memory ? `${l.who} (ความทรงจำ)` : l.who;
      full = l.t; shown = 0; text.textContent = '';
      clearInterval(timer);
      const step = app.reducedMotion ? full.length : 2;
      timer = setInterval(() => {
        shown = Math.min(full.length, shown + step);
        text.textContent = full.slice(0, shown);
        if (shown >= full.length) clearInterval(timer);
      }, 28);
      app.audio.play('click');
    }
    function advance() {
      if (closed) return;
      if (shown < full.length) { clearInterval(timer); shown = full.length; text.textContent = full; return; }
      i += 1;
      if (i >= lines.length) close(); else render();
    }
    function close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 200);
      busy = false;
      app.audio.popMusic();
      finishScene(sceneId, onDone);
      if (queue.length) { const [id, cb] = queue.shift(); playScene(id, cb); }
    }
    function onKey(e) {
      if (['Space', 'Enter', 'KeyE', 'KeyJ', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); advance(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    }
    box.addEventListener('click', (e) => { if (!skip.contains(e.target)) advance(); });
    shade.addEventListener('click', advance);
    skip.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    window.addEventListener('keydown', onKey, true);
    render();
  }

  function finishScene(sceneId, onDone) {
    const before = app.store.get();
    const r = markSeen(before, sceneId);
    if (r.ok) {
      app.store.commit(r.state, { reason: 'story' });
      for (const flag of Object.keys(r.sets)) {
        if (before.story.flags[flag]) continue; // replays do not announce again
        const unlocked = Object.values(SKILLS).filter((s) => s.unlock.flag === flag);
        for (const s of unlocked) app.toast(`ปลดล็อกสกิล «${s.name}» — เรียนได้ที่เมนูสกิล`, 'ok', null, { glyph: s.icon, duration: 4200 });
      }
    }
    if (!busy) app.input.setEnabled(app.inBattle());
    onDone?.();
  }

  // ---------------------------------------------------------------- document reader
  function openLore(loreId, onDone) {
    const d = discoverLore(app.store.get(), loreId);
    if (!d.ok) { onDone?.(); return; }
    app.store.commit(d.state, { reason: 'lore' });
    if (d.isNew) app.toast(`บันทึกเอกสารลงสมุดแล้ว · ประกายอำพัน +${d.sparks}`, 'ok', null, { glyph: 'book' });
    const t = loreText(app.store.get(), loreId);
    app.input.setEnabled(false);
    const closeBtn = h('button', { class: 'btn primary', type: 'button', 'data-action': 'close-lore' }, 'ปิด');
    const card = h('article', { class: 'lore-card', role: 'dialog', 'aria-modal': 'true', 'data-lore': loreId },
      h('div', { class: 'eyebrow' }, 'เอกสารที่พบ'),
      h('h2', {}, t.title),
      t.text.map((p) => h('p', {}, p)),
      t.thought ? h('p', { class: 'lore-thought' }, `${app.store.get().story.name}: ${t.thought}`) : null,
      h('div', { class: 'actions' }, closeBtn));
    const back = h('div', { class: 'modal-back lore-back' }, card);
    layer.append(back);
    setTimeout(() => closeBtn.focus({ preventScroll: true }), 30);
    app.audio.play('tab');
    const onKey = (e) => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    function close() {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
      app.input.setEnabled(app.inBattle());
      if (d.scene) playScene(d.scene, onDone); else onDone?.();
    }
    closeBtn.addEventListener('click', close);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  }

  // ---------------------------------------------------------------- naming
  function askName(onDone) {
    const input = h('input', { id: 'hero-name', type: 'text', maxlength: String(HERO_NAME_MAX), autocomplete: 'off', placeholder: 'เช่น ริน', 'aria-label': 'ชื่อนักล่า' });
    const confirm = h('button', { class: 'btn primary', type: 'button', 'data-action': 'confirm-name' }, 'เริ่มเรื่อง');
    const chips = ['ริน', 'คราม', 'ภูผา', 'ดารา'].map((n) => h('button', { class: 'chip-btn', type: 'button', onclick: () => { input.value = n; input.focus(); } }, n));
    const form = h('form', { class: 'modal panel name-card', 'data-modal': 'name' },
      h('div', { class: 'eyebrow', style: { textAlign: 'center' } }, 'นักล่าแห่งเอมเบอร์โฮลด์'),
      h('h2', {}, 'ตั้งชื่อนักล่า'),
      h('p', { class: 'muted', style: { margin: 0, textAlign: 'center' } }, 'ชื่อนี้จะปรากฏในบทสนทนาและจดหมายตลอดเรื่อง'),
      input, h('div', { class: 'chip-row' }, chips), confirm);
    const back = h('div', { class: 'modal-back' }, form);
    layer.append(back);
    setTimeout(() => input.focus(), 50);
    form.addEventListener('submit', (e) => { e.preventDefault(); done(); });
    confirm.addEventListener('click', done);
    function done() {
      const name = cleanHeroName(input.value);
      back.remove();
      onDone(name);
    }
  }

  return { playScene, openLore, askName, get busy() { return busy; } };
}
