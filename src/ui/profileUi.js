// โปรไฟล์: a player's page. The hero stands on a lit stage wearing what they wear (armour, weapon, wings, bloodline)
// with their pet team, and around it: picture, title, guild, gear with upgrade levels, artifacts, pets, stats and
// records. My own page also lets me set my picture and a line about me.
import { h, glyph, itemImg, artifactImg } from './dom.js';
import { tipTarget } from './itemTip.js';
import { createRenderer } from '../engine/renderer.js';
import { drawHero } from '../battle/heroDraw.js';
import { getItem, EQUIP_SLOTS, SLOT_NAMES } from '../data/items.js';
import { getWeaponType } from '../data/weapons.js';
import { getPet } from '../data/pets.js';
import { getRace } from '../data/races.js';
import { getArtifact } from '../data/artifacts.js';
import { getTitle, TITLE_TIERS, BADGE_NAMES } from '../data/titles.js';
import { publicCard, readCard, setAvatar, setBio, AVATAR_PX, AVATAR_MAX, BIO_MAX } from '../systems/profile.js';

const RARITY_GLOW = { common: '#c9b48a', uncommon: '#7fd08a', rare: '#6fb4ff', epic: '#c58aff', legendary: '#ffb648', mythic: '#ff5f7a' };

// ------------------------------------------------------------------ picture → small square image
export async function makeAvatar(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('not_image');
  if (file.size > 20 * 1024 * 1024) throw new Error('too_big');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('not_image')); i.src = url; });
    const c = document.createElement('canvas'); c.width = c.height = AVATAR_PX;
    const g = c.getContext('2d');
    const s = Math.min(img.naturalWidth, img.naturalHeight);          // centre square crop
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, AVATAR_PX, AVATAR_PX);
    for (const [type, q] of [['image/webp', 0.86], ['image/webp', 0.7], ['image/jpeg', 0.82], ['image/webp', 0.5], ['image/jpeg', 0.6], ['image/jpeg', 0.42]]) {
      const d = c.toDataURL(type, q);
      if (d.startsWith(`data:${type}`) && d.length <= AVATAR_MAX) return d;
    }
    throw new Error('too_big');
  } finally { URL.revokeObjectURL(url); }
}

// ------------------------------------------------------------------ the lit stage with the hero
function heroStage(app, card, self) {
  const canvas = h('canvas', { class: 'pf-stage', 'aria-label': `ตัวละครของ ${card.name}` });
  const r = createRenderer(canvas);
  const race = getRace(card.race);
  const wid = card.eq.weapon?.[0] || 'w_rust_blade';
  const type = getWeaponType(getItem(wid)?.wtype);
  const t0 = performance.now();
  const rim = TITLE_TIERS[getTitle(card.title)?.t]?.color || RARITY_GLOW[getItem(card.eq.armor?.[0])?.rarity] || '#e0b45a';
  const motes = Array.from({ length: 22 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, v: 0.02 + Math.random() * 0.05, p: i }));
  let raf = 0;
  function frame() {
    if (!canvas.isConnected) { cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(frame);
    r.resize(); r.screenSpace();
    const { ctx } = r, W = r.view.w, H = r.view.h, t = (performance.now() - t0) / 1000;
    // backdrop: dusk sky, a warm key light from the upper left, a coloured rim light behind the hero
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1d1420'); sky.addColorStop(0.65, '#2a1c16'); sky.addColorStop(1, '#140e0b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, gy = H * 0.86, sc = Math.min(2.1, H / 148);
    const key = ctx.createRadialGradient(W * 0.18, -H * 0.1, 10, W * 0.18, -H * 0.1, H * 1.2); key.addColorStop(0, 'rgba(255,214,150,0.28)'); key.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = key; ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(cx, gy - 60 * sc, 4, cx, gy - 60 * sc, 95 * sc); halo.addColorStop(0, rim + '55'); halo.addColorStop(0.6, rim + '18'); halo.addColorStop(1, rim + '00');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    // god rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.22 + Math.sin(t * 0.3 + i) * 0.03; ctx.fillStyle = `rgba(255,220,160,${0.035 + 0.015 * Math.sin(t + i)})`; ctx.beginPath(); ctx.moveTo(W * 0.1, -10); ctx.lineTo(W * 0.1 + Math.cos(a) * H * 2, Math.sin(-a) * H * 2); ctx.lineTo(W * 0.1 + Math.cos(a + 0.08) * H * 2, Math.sin(-a - 0.08) * H * 2); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // floor: a stone dais with the contact shadow
    const fl = ctx.createLinearGradient(0, gy - 10, 0, H); fl.addColorStop(0, '#3a2a1f'); fl.addColorStop(1, '#1a120d');
    ctx.fillStyle = fl; ctx.beginPath(); ctx.ellipse(cx, gy + 6, 120 * sc * 0.75, 20 * sc * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rim + '66'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, gy + 6, 120 * sc * 0.75, 20 * sc * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(cx, gy, 26 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
    // pets on either side
    (card.pets || []).forEach(([id], i) => {
      const pet = getPet(id), s = pet && app.sprites[pet.sprite];
      if (!s) return;
      const side = i === 0 ? -1 : i === 1 ? 1 : -1.6;
      const px = cx + side * 62 * sc * 0.75, fly = pet.flying;
      const py = gy + (i === 2 ? -6 : 4) - (fly ? 30 * sc * 0.6 + Math.sin(t * 2.6 + i) * 6 : Math.abs(Math.sin(t * 3 + i)) * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, gy + 4, s.w * 0.22 * sc * 0.6, 4, 0, 0, Math.PI * 2); ctx.fill();
      r.sprite(s, px, py, { sx: sc * 0.62 * (side > 0 ? -1 : 1), sy: sc * 0.62 });
    });
    // the hero, breathing, weapon in hand
    const parts = self ? app.sprites.heroParts : app.heroPartsFor(card.eq.armor?.[0] || null, card.race, card.eq.wings?.[0] || null);
    const weapon = self ? app.sprites.weapon : app.sprites['weapon_' + wid];
    if (parts) drawHero(r, parts, weapon, { x: cx, y: gy, flip: false, time: t, walkT: 0, moving: false, type, scale: sc, vx: 0, speed: 1 });
    // embers drifting up through the light
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) { const y = ((m.y - t * m.v) % 1 + 1) % 1; const x = m.x + Math.sin(t * 0.8 + m.p) * 0.02; ctx.fillStyle = `rgba(255,${170 + (m.p % 5) * 12},90,${0.25 + 0.25 * Math.sin(t * 2 + m.p)})`; ctx.beginPath(); ctx.arc(x * W, y * H, m.s, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // vignette
    const vg = ctx.createRadialGradient(cx, H * 0.55, H * 0.3, cx, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (race) { ctx.font = '600 12px "Bai Jamjuree", sans-serif'; ctx.fillStyle = 'rgba(243,230,200,0.7)'; ctx.textAlign = 'right'; ctx.fillText(`สายเลือด ${race.name}`, W - 10, H - 10); }
  }
  queueMicrotask(frame);
  return canvas;
}

// ------------------------------------------------------------------ the page
export function openProfile(app, { card: rawCard = null, self = false, source = '' } = {}) {
  const card = self ? readCard(publicCard(app.store.get())) : rawCard;
  if (!card) { app.toast('เปิดโปรไฟล์ไม่สำเร็จ', 'warn'); return null; }
  let close;
  const title = getTitle(card.title);
  const race = getRace(card.race);
  const pic = h('img', { class: 'pf-pic', alt: '', src: card.avatar || (race ? app.racePortraitUri(card.race) : app.portraitUri('hero')) });

  const gear = h('div', { class: 'pf-gear' }, EQUIP_SLOTS.map((slot) => {
    const e = card.eq[slot], def = e && getItem(e[0]);
    if (!def) return h('div', { class: 'pf-slot empty', 'data-slot': slot }, h('span', { class: 'cell empty' }), h('div', {}, h('small', { class: 'muted' }, SLOT_NAMES[slot]), h('b', { class: 'muted' }, 'ว่าง')));
    const cell = h('span', { class: `cell r-${def.rarity}`, 'data-item-id': def.id }, itemImg(def.id), e[1] ? h('span', { class: 'lvl-tag' }, `+${e[1]}`) : null);
    return h('div', { class: 'pf-slot', 'data-slot': slot }, tipTarget(cell, def.id), h('div', {}, h('small', { class: 'muted' }, SLOT_NAMES[slot]), h('b', { class: 'rc-text', style: { color: RARITY_GLOW[def.rarity] } }, def.name, e[1] ? ` +${e[1]}` : '')));
  }));

  const arts = card.arts.length
    ? h('div', { class: 'pf-arts' }, card.arts.map(([id, lvl]) => { const a = getArtifact(id); return h('div', { class: `pf-art r-${a.rarity}`, title: `${a.name} ระดับ ${lvl}`, 'data-artifact': id }, artifactImg(id), h('small', {}, `Lv${lvl}`)); }))
    : h('small', { class: 'muted' }, 'ยังไม่ได้วางอาร์ติแฟกต์บนต้นไม้จักรวาล');
  const pets = card.pets.length
    ? h('div', { class: 'pf-pets' }, card.pets.map(([id, stars]) => { const p = getPet(id); return h('div', { class: `pf-pet r-${p.rarity}`, 'data-pet': id }, h('img', { src: app.petUri(id), alt: '' }), h('b', {}, p.name), h('small', { class: 'stars' }, '★'.repeat(stars))); }))
    : h('small', { class: 'muted' }, 'ไม่ได้พาสัตว์เลี้ยงออกมา');
  const S = card.st, R = card.rec;
  const stats = h('div', { class: 'pf-stats' },
    h('div', { class: 'pf-power' }, h('small', { class: 'muted' }, 'พลังรบ'), h('b', { class: 'num' }, S.power.toLocaleString('th-TH'))),
    ...[['atk', 'พลังโจมตี', S.atk], ['def', 'ป้องกัน', S.def], ['hp', 'พลังชีวิต', S.hp], ['crit', 'คริติคอล', `${S.crit}% ×${S.critMult}`]].map(([g, l, v]) => h('div', { class: 'stat' }, glyph(g), h('small', {}, l), h('b', { class: 'num' }, typeof v === 'number' ? v.toLocaleString('th-TH') : v))));
  const rec = h('div', { class: 'kv pf-rec' },
    ...[
      ['หอคอยขุมนรก', R.tower ? `ชั้น ${R.tower}${R.asc ? ` · ขุมลึก ${R.asc}` : ''}` : 'ยังไม่ปีน'], ['เทพที่ปราบ', `${R.gods}/10`], ['ดวล PvP', `ชนะ ${R.pvpW} · แพ้ ${R.pvpL}`],
      ['กำจัดศัตรู', R.kills.toLocaleString('th-TH')], ['รอยแยก', `คลื่น ${R.rift}`], ['ดันพิเศษ', `${R.raids} ครั้ง`], ['ดันเจี้ยนรวม', `${R.zones} ครั้ง`],
      ['ฉายา', `${R.titles}`], ['เผ่าที่เคยเป็น', `${R.races}`], ['สัตว์เลี้ยง', `${card.petCount} ตัว`], ['กระเป๋า', `${R.bag} ช่อง`],
    ].map(([k, v]) => h('div', {}, h('span', { class: 'muted' }, k), h('b', {}, v))));

  // my own page: picture and a line about me
  let mine = null;
  if (self) {
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true, 'data-avatar-file': '' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; file.value = '';
      if (!f) return;
      try {
        const d = await makeAvatar(f);
        const r = setAvatar(app.store.get(), d);
        if (!r.ok) throw new Error('bad');
        app.store.commit(r.state, { reason: 'profile' }); app.audio.play('success'); app.toast('เปลี่ยนรูปโปรไฟล์แล้ว', 'ok');
        app.cloud?.syncSoon?.(); close(); openProfile(app, { self: true });
      } catch (e) { app.audio.play('error'); app.toast(e.message === 'too_big' ? 'รูปใหญ่เกินไป ลองรูปอื่น' : 'ใช้ไฟล์นี้เป็นรูปไม่ได้ (เลือกไฟล์รูปภาพ)', 'warn'); }
    });
    const bio = h('input', { type: 'text', class: 'text-in', maxlength: String(BIO_MAX), value: app.store.get().profile?.bio || '', placeholder: 'แนะนำตัวสั้นๆ (เห็นโดยผู้เล่นอื่น)', 'aria-label': 'แนะนำตัว', 'data-bio': '' });
    bio.addEventListener('change', () => { const r = setBio(app.store.get(), bio.value); app.store.commit(r.state, { reason: 'profile' }); app.toast('บันทึกคำแนะนำตัวแล้ว', 'ok'); app.cloud?.syncSoon?.(); });
    mine = h('div', { class: 'pf-mine' },
      file,
      h('button', { class: 'btn sm primary', type: 'button', 'data-action': 'avatar-pick', onclick: () => file.click() }, glyph('eye'), 'เปลี่ยนรูปโปรไฟล์'),
      app.store.get().profile?.avatar ? h('button', { class: 'btn sm', type: 'button', 'data-action': 'avatar-clear', onclick: () => { const r = setAvatar(app.store.get(), null); app.store.commit(r.state, { reason: 'profile' }); app.toast('ใช้รูปสายเลือดแทนแล้ว', 'ok'); close(); openProfile(app, { self: true }); } }, 'ใช้รูปสายเลือด') : null,
      bio,
      h('small', { class: 'faint' }, 'รูปถูกย่อเป็น 128×128 และเก็บไว้ในเซฟของคุณ ผู้เล่นที่เปิดดูโปรไฟล์จะเห็นรูปนี้ เลือกรูปที่เหมาะสม'));
  }

  const content = h('div', { class: 'modal panel profile', 'data-modal': 'profile', 'data-self': self ? '1' : '0' },
    h('div', { class: 'pf-head' }, pic,
      h('div', { class: 'pf-id' },
        title ? h('small', { class: 'pf-title', style: { color: TITLE_TIERS[title.t].color } }, title.name) : null,
        h('h2', {}, card.gtag ? h('span', { class: 'muted' }, `[${card.gtag}] `) : null, card.name),
        h('div', { class: 'muted' }, `Lv ${card.lv} · ${race ? race.name : 'ยังไม่ปลุกสายเลือด'}${card.gname ? ` · กิลด์ ${card.gname}` : ''}`),
        card.badge ? h('span', { class: 'chip' }, glyph('crown'), BADGE_NAMES[card.badge] || `ตราเกียรติยศ ${card.badge}`) : null,
        card.modified ? h('span', { class: 'chip warn' }, 'เซฟถูกแก้ไขนอกเกม') : null,
        card.bio ? h('p', { class: 'pf-bio' }, card.bio) : null)),
    heroStage(app, card, self),
    mine,
    h('div', { class: 'eyebrow' }, 'อุปกรณ์ที่สวม'), gear,
    h('div', { class: 'eyebrow' }, 'สถานะ'), stats,
    h('div', { class: 'eyebrow' }, 'อาร์ติแฟกต์ (ต้นไม้จักรวาล)'), arts,
    h('div', { class: 'eyebrow' }, 'ทีมสัตว์เลี้ยง'), pets,
    h('div', { class: 'eyebrow' }, 'สถิติ'), rec,
    source ? h('small', { class: 'faint' }, source) : null,
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', 'data-action': 'profile-close', onclick: () => close() }, 'ปิด')));
  close = app.modal(content);
  return close;
}
