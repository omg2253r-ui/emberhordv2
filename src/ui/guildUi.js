// The guild drawer content: create a guild, or see your guild's notice, members (online or not), roles and actions.
import { h, glyph, confirmButton, itemImg } from './dom.js';
import { GUILD_COST, GUILD_MAX, NOTICE_MAX, ROLE_NAME } from '../online/guild.js';

const REASON = {
  unavailable: 'ระบบกิลด์ต้องเชื่อมต่อออนไลน์ก่อน', already_in_guild: 'คุณอยู่ในกิลด์แล้ว', bad_name: 'ชื่อกิลด์ 3–16 ตัวอักษร',
  bad_tag: 'ตัวย่อ 2–4 ตัว (ตัวอักษรหรือตัวเลข)', not_enough_gold: `ต้องมีทอง ${GUILD_COST}`, write_failed: 'บันทึกกิลด์ไม่สำเร็จ (บัญชีอาจดูได้อย่างเดียว)',
  no_guild: 'ไม่พบกิลด์นี้แล้ว', guild_full: `กิลด์เต็มแล้ว (${GUILD_MAX} คน)`, not_allowed: 'ตำแหน่งของคุณทำแบบนี้ไม่ได้', not_invited: 'คำเชิญหมดอายุแล้ว ขอให้สมาชิกกิลด์ชวนใหม่', not_owner: 'ยืนยันตัวตนผู้เล่นไม่สำเร็จ', not_member: 'คุณไม่ได้อยู่ในกิลด์นี้แล้ว', rate_limited: 'ทำรายการถี่เกินไป รอสักครู่',
};
export const guildReason = (r) => REASON[r] || 'ทำรายการไม่สำเร็จ';

export function renderGuild(body, app, { portrait, onlineByUid, openPlayer }) {
  const G = app.guild, g = G.current, st = app.store.get();
  const act = async (p, okMsg) => { const r = await p; if (!r.ok) { app.toast(guildReason(r.reason), 'warn', 'guild'); app.audio.play('error'); } else if (okMsg) { app.toast(okMsg, 'ok'); app.audio.play('success'); } return r; };
  if (!G.available) {
    body.replaceChildren(h('div', { class: 'empty-note' }, REASON.unavailable));
    return `กิลด์`;
  }
  if (!g) {
    if (st.guild && G.loading) { body.replaceChildren(h('div', { class: 'empty-note' }, 'กำลังโหลดกิลด์…')); return 'กิลด์'; }
    const nameIn = h('input', { type: 'text', class: 'text-in', maxlength: '16', placeholder: 'ชื่อกิลด์ (3–16 ตัว)', 'aria-label': 'ชื่อกิลด์', 'data-guild-name': '' });
    const tagIn = h('input', { type: 'text', class: 'text-in tag-in', maxlength: '4', placeholder: 'ตัวย่อ', 'aria-label': 'ตัวย่อกิลด์', 'data-guild-tag': '' });
    body.replaceChildren(
      h('div', { class: 'empty-note' }, 'ยังไม่มีกิลด์ สร้างกิลด์ของตัวเอง หรือให้สมาชิกกิลด์แตะตัวคุณแล้วกด "ชวนเข้ากิลด์"'),
      h('div', { class: 'room-create guild-create' },
        h('b', {}, 'ก่อตั้งกิลด์'), nameIn, tagIn,
        h('button', { class: 'btn primary small', type: 'button', 'data-action': 'guild-create', disabled: st.gold < GUILD_COST,
          onclick: () => act(G.create(nameIn.value, tagIn.value), 'ก่อตั้งกิลด์แล้ว') }, glyph('crown'), 'ก่อตั้ง ', itemImg('gold'), String(GUILD_COST))));
    return 'กิลด์';
  }
  const me = app.online.me.uid;
  const members = Object.entries(g.members).sort((a, b) => (b[1].role === 'leader') - (a[1].role === 'leader') || (b[1].role === 'officer') - (a[1].role === 'officer') || ((onlineByUid.has(b[0])) - (onlineByUid.has(a[0]))) || a[1].name.localeCompare(b[1].name, 'th'));
  const noticeIn = G.can('notice') ? h('textarea', { class: 'text-in notice-in', maxlength: String(NOTICE_MAX), rows: '2', 'aria-label': 'ประกาศกิลด์', 'data-guild-notice': '' }, g.notice) : null;
  body.replaceChildren(
    h('div', { class: 'guild-head' }, h('span', { class: 'guild-tag' }, g.tag), h('div', {}, h('b', {}, g.name), h('small', { class: 'muted' }, `${members.length}/${GUILD_MAX} คน · ออนไลน์ ${members.filter(([u]) => onlineByUid.has(u) || u === me).length}`))),
    noticeIn
      ? h('div', { class: 'guild-notice' }, noticeIn, h('button', { class: 'btn small', type: 'button', 'data-action': 'guild-notice', onclick: () => act(G.setNotice(noticeIn.value), 'อัปเดตประกาศแล้ว') }, 'บันทึกประกาศ'))
      : h('div', { class: 'guild-notice read' }, g.notice || 'ยังไม่มีประกาศ'),
    ...members.map(([uid, m]) => {
      const here = onlineByUid.get(uid);
      const isMe = uid === me;
      return h('div', { class: `vrow ${here || isMe ? '' : 'off'}`, 'data-gmember': uid },
        portrait(here?.p.race || (isMe ? st.race?.id : null)),
        h('div', { class: 'vrow-main' }, h('b', {}, isMe ? `${m.name} (คุณ)` : here?.p.name || m.name, h('span', { class: `tag ${m.role === 'leader' ? 'lead' : m.role === 'officer' ? 'party' : ''}` }, ROLE_NAME[m.role])),
          h('small', { class: here || isMe ? 'ok' : 'muted' }, here || isMe ? 'ออนไลน์' : 'ออฟไลน์')),
        here && !isMe ? h('button', { class: 'btn small', type: 'button', onclick: () => openPlayer(here.peer) }, 'ดู') : null,
        G.can('promote', uid) ? h('button', { class: 'btn small ghost', type: 'button', 'data-action': 'guild-promote', onclick: () => act(G.promote(uid), `${m.name} เป็นรองหัวหน้าแล้ว`) }, 'เลื่อน') : null,
        G.can('demote', uid) ? h('button', { class: 'btn small ghost', type: 'button', 'data-action': 'guild-demote', onclick: () => act(G.demote(uid), `${m.name} เป็นสมาชิกแล้ว`) }, 'ลด') : null,
        G.can('kick', uid) ? confirmButton('เชิญออก', 'ยืนยัน', () => act(G.kick(uid), `เชิญ ${m.name} ออกแล้ว`), 'btn small ghost') : null);
    }),
    h('div', { class: 'actions' }, confirmButton(g.leader === me && members.length === 1 ? 'ยุบกิลด์' : 'ออกจากกิลด์', 'กดอีกครั้งเพื่อยืนยัน', () => act(G.leave(), 'ออกจากกิลด์แล้ว'), 'btn small danger')));
  return `กิลด์ [${g.tag}]`;
}
