// Online UI: the village bar (status, players, friends, party), chat, incoming request cards (shown at camp and in
// the village), player cards and the notice board. Everything a button does goes through app.online
// (src/online/online.js); nothing here is decorative.
import { h, glyph, itemImg, confirmButton } from './dom.js';
import { getItem } from '../data/items.js';
import { getRace } from '../data/races.js';
import { getPet } from '../data/pets.js';
import { removeFriend, CHAT_MAX, PARTY_MAX, REQUEST_TTL } from '../online/protocol.js';
import { MODES, TEAM_INFO, teamOf } from '../online/match.js';
import { getZone } from '../data/zones.js';
import { renderGuild } from './guildUi.js';

const REASONS = {
  offline: 'ยังไม่ได้เชื่อมต่อออนไลน์', not_here: 'ผู้เล่นคนนี้ออกไปแล้ว', already_sent: 'ส่งคำขอไปแล้ว รอคำตอบอยู่',
  already_friend: 'เป็นเพื่อนกันอยู่แล้ว', not_leader: 'เฉพาะหัวหน้าปาร์ตี้ที่ชวนคนเพิ่มได้', party_full: `ปาร์ตี้เต็มแล้ว (${PARTY_MAX} คน)`,
  already_member: 'อยู่ในปาร์ตี้เดียวกันแล้ว', save_modified: 'เซฟของคุณถูกแก้ไขจากภายนอก จึงดวลหรือแลกเปลี่ยนไม่ได้', their_save_modified: 'เซฟของผู้เล่นนี้ถูกแก้ไขจากภายนอก', busy: 'ผู้เล่นกำลังดวลหรือออกล่าอยู่', no_account: 'ผู้เล่นคนนี้ไม่มีบัญชีให้เพิ่มเป็นเพื่อน',
  view_only: 'บัญชีของคุณดูได้อย่างเดียว ส่งคำขอไม่ได้', too_fast: 'ส่งแชทเร็วเกินไป รอสักครู่', no_party: 'ยังไม่มีปาร์ตี้', expired: 'คำขอหมดเวลาแล้ว',
  room_full: 'ห้องเต็มหรือเริ่มเล่นแล้ว', join_failed: 'เข้าห้องไม่สำเร็จ ลองใหม่อีกครั้ง', not_full: 'ผู้เล่นยังไม่ครบทั้งสองทีม', not_ready: 'ยังมีผู้เล่นที่ไม่กดพร้อม', team_full: 'ทีมนั้นเต็มแล้ว', bad_mode: 'รูปแบบห้องไม่ถูกต้อง',
  zone_locked: 'ยังเข้าโซนนี้ไม่ได้', tower_locked: 'ยังเข้าหอคอยไม่ได้', floor_locked: 'ยังเริ่มจากชั้นนี้ไม่ได้', no_guild: 'คุณยังไม่มีกิลด์', has_guild: 'ผู้เล่นคนนี้อยู่ในกิลด์แล้ว',
  friends_full: 'รายชื่อเพื่อนเต็มแล้ว', bad_id: 'ผู้เล่นคนนี้ไม่มีบัญชีให้เพิ่มเป็นเพื่อน', empty: 'พิมพ์ข้อความก่อนส่ง',
};
const KIND_TEXT = { friend: 'ขอเป็นเพื่อน', party: 'ชวนเข้าปาร์ตี้', duel: 'ท้าดวล 1v1', trade: 'ขอแลกเปลี่ยนของ', guild: 'ชวนเข้ากิลด์' };
const ZONE_TEXT = { village: 'ในหมู่บ้าน', camp: 'อยู่ที่ค่าย', hunt: 'กำลังออกล่า', arena: 'กำลังดวล' };

export function createVillageUi(root, app) {
  const online = () => app.online;
  let drawer = null;            // 'players' | 'friends' | 'party' | null
  let modalClose = null;
  let chatOpen = !app.touch;    // phones open the chat on demand
  let channel = 'village';

  // ------------------------------------------------------------ village bar
  const statusDot = h('i', { class: 'dot' });
  const statusTxt = h('span', {});
  const countPlayers = h('b', { class: 'num' }, '0'), countParty = h('b', { class: 'num' }, '0');
  const drawerBtn = (id, icon, label, count) => h('button', { class: 'vbtn', type: 'button', 'data-v': id, 'aria-pressed': 'false', onclick: () => toggleDrawer(id) }, glyph(icon), h('span', { class: 'lbl' }, label), count || null);
  const btnPlayers = drawerBtn('players', 'people', 'ผู้เล่น', countPlayers);
  const btnFriends = drawerBtn('friends', 'friend', 'เพื่อน');
  const btnParty = drawerBtn('party', 'party', 'ปาร์ตี้', countParty);
  const countRooms = h('b', { class: 'num', hidden: true }, '0');
  const btnRooms = drawerBtn('rooms', 'duel', 'ห้อง', countRooms);
  const btnGuild = drawerBtn('guild', 'crown', 'กิลด์');
  const btnChat = h('button', { class: 'vbtn chat-toggle', type: 'button', 'data-v': 'chat', onclick: () => setChatOpen(!chatOpen) }, glyph('chat'), h('span', { class: 'lbl' }, 'แชท'));
  const bar = h('header', { class: 'vbar' },
    h('button', { class: 'btn icon', type: 'button', 'aria-label': 'กลับค่าย', title: 'กลับค่าย', 'data-action': 'leave-village', onclick: () => app.leaveVillage() }, glyph('back')),
    h('div', { class: 'vtitle' }, h('h2', {}, 'หมู่บ้านทางแยกถ่าน'), h('div', { class: 'vstatus' }, statusDot, statusTxt)),
    h('div', { class: 'vbtns' }, btnRooms, btnPlayers, btnFriends, btnParty, btnGuild, btnChat));

  // ------------------------------------------------------------ side drawer
  const drawerTitle = h('h3', {});
  const drawerBody = h('div', { class: 'vdrawer-body' });
  const drawerEl = h('aside', { class: 'vdrawer panel', hidden: true },
    h('div', { class: 'vdrawer-head' }, drawerTitle, h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'ปิด', onclick: () => toggleDrawer(null) }, glyph('close'))),
    drawerBody);

  function toggleDrawer(id) {
    drawer = drawer === id ? null : id;
    for (const b of [btnRooms, btnPlayers, btnFriends, btnParty, btnGuild]) b.setAttribute('aria-pressed', String(b.dataset.v === drawer));
    drawerEl.hidden = !drawer;
    app.audio.play(drawer ? 'tab' : 'click');
    renderDrawer();
  }

  const portrait = (race) => h('img', { class: 'vface', alt: '', src: app.racePortraitUri(race || 'hunter') });
  const zoneOf = (p) => (p.busy === 'duel' ? 'arena' : p.busy === 'hunt' ? 'hunt' : p.zone || 'camp');

  function renderDrawer() {
    if (!drawer) return;
    const o = online();
    if (drawer === 'players') {
      drawerTitle.textContent = `ผู้เล่นออนไลน์ (${o.peers.length})`;
      const friends = app.store.get().social.friends;
      drawerBody.replaceChildren(...(o.peers.length ? o.peers.map((x) => h('div', { class: 'vrow', 'data-peer': x.peer },
        portrait(x.p.race),
        h('div', { class: 'vrow-main' }, h('b', {}, x.p.gtag ? `[${x.p.gtag}] ` : '', x.p.name, friends[x.by] ? h('span', { class: 'tag friend' }, 'เพื่อน') : null), h('small', { class: 'muted' }, `Lv.${x.p.lv} · ${ZONE_TEXT[zoneOf(x.p)]}`)),
        h('button', { class: 'btn small', type: 'button', 'data-action': 'view-player', onclick: () => openPlayer(x.peer) }, 'ดู')))
        : [h('div', { class: 'empty-note' }, o.online ? 'ยังไม่มีผู้เล่นคนอื่นออนไลน์ ชวนเพื่อนเปิดเกมนี้แล้วจะเห็นกันที่นี่' : o.reason)]));
    } else if (drawer === 'friends') {
      const friends = Object.entries(app.store.get().social.friends);
      drawerTitle.textContent = `เพื่อน (${friends.length})`;
      const onlineBy = new Map(o.peers.map((x) => [x.by, x]));
      friends.sort((a, b) => (onlineBy.has(b[0]) - onlineBy.has(a[0])) || a[1].name.localeCompare(b[1].name, 'th'));
      drawerBody.replaceChildren(...(friends.length ? friends.map(([uid, f]) => {
        const here = onlineBy.get(uid);
        return h('div', { class: `vrow ${here ? '' : 'off'}`, 'data-friend': uid },
          portrait(here?.p.race),
          h('div', { class: 'vrow-main' }, h('b', {}, here?.p.name || f.name), h('small', { class: here ? 'ok' : 'muted' }, here ? `ออนไลน์ · ${ZONE_TEXT[zoneOf(here.p)]}` : 'ออฟไลน์')),
          here ? h('button', { class: 'btn small', type: 'button', onclick: () => openPlayer(here.peer) }, 'ดู') : null,
          confirmButton('ลบ', 'ยืนยันลบ', () => {
            const r = removeFriend(app.store.get(), uid);
            if (r.ok) { app.store.commit(r.state, { reason: 'friend-remove' }); app.toast(`ลบ ${f.name} ออกจากเพื่อนแล้ว`, 'ok'); renderDrawer(); }
          }, 'btn small ghost'));
      }) : [h('div', { class: 'empty-note' }, 'ยังไม่มีเพื่อน แตะผู้เล่นในหมู่บ้านแล้วกด "เพิ่มเพื่อน" รายชื่อเพื่อนบันทึกไว้ในเซฟ')]));
    } else if (drawer === 'rooms') {
      renderRooms();
    } else if (drawer === 'guild') {
      const onlineByUid = new Map(o.peers.filter((x) => x.by).map((x) => [x.by, x]));
      drawerTitle.textContent = renderGuild(drawerBody, app, { portrait, onlineByUid, openPlayer });
    } else if (drawer === 'party') {
      const party = o.party;
      drawerTitle.textContent = party ? `ปาร์ตี้ (${party.members.length}/${PARTY_MAX})` : 'ปาร์ตี้';
      if (!party) {
        drawerBody.replaceChildren(h('div', { class: 'empty-note' }, `ยังไม่มีปาร์ตี้ แตะผู้เล่นแล้วกด "ชวนเข้าปาร์ตี้" (สูงสุด ${PARTY_MAX} คน) สมาชิกจะเห็นชื่อกันเป็นสีเขียวและคุยในช่องแชทปาร์ตี้ได้`));
        return;
      }
      const leader = party.leader === o.me.peer;
      drawerBody.replaceChildren(
        ...party.members.map((m) => {
          const here = o.peers.find((x) => x.peer === m.peer);
          const isMe = m.peer === o.me.peer;
          return h('div', { class: 'vrow', 'data-member': m.peer },
            portrait(isMe ? app.store.get().race?.id : here?.p.race),
            h('div', { class: 'vrow-main' }, h('b', {}, isMe ? `${m.name} (คุณ)` : m.name, m.peer === party.leader ? h('span', { class: 'tag lead' }, glyph('crown'), 'หัวหน้า') : null),
              h('small', { class: 'muted' }, `Lv.${m.lv}${here ? ' · ' + ZONE_TEXT[zoneOf(here.p)] : isMe ? '' : ' · ไม่อยู่ในห้อง'}`)),
            leader && !isMe ? h('button', { class: 'btn small ghost', type: 'button', 'data-action': 'kick', onclick: () => { online().kick(m.peer); app.audio.play('click'); } }, 'เชิญออก') : null);
        }),
        h('div', { class: 'actions' }, h('button', { class: 'btn small danger', type: 'button', 'data-action': 'leave-party', onclick: () => { online().leaveParty(); app.toast('ออกจากปาร์ตี้แล้ว', 'ok'); } }, 'ออกจากปาร์ตี้')));
    }
  }

  // ------------------------------------------------------------ PvP rooms
  let newMode = '1v1';
  function renderRooms() {
    const R = app.rooms, cur = R.current, o = online();
    if (cur) {
      drawerTitle.textContent = cur.title;
      const meP = o.me.peer;
      const myTeam = teamOf(cur.roster, meP);
      const size = MODES[cur.mode].size;
      const col = (t) => h('div', { class: `room-team t-${t}`, 'data-team': t },
        h('div', { class: 'room-team-head', style: { '--team': TEAM_INFO[t].color } }, h('b', {}, MODES[cur.mode].coop ? 'สมาชิก' : TEAM_INFO[t].name), h('small', { class: 'num' }, `${cur.roster[t].length}/${size}`)),
        ...Array.from({ length: size }, (_, i) => {
          const peer = cur.roster[t][i];
          if (!peer) return h('div', { class: 'room-seat empty' }, 'ว่าง');
          const m = cur.members.get(peer);
          const ready = peer === cur.host || cur.ready[peer];
          return h('div', { class: `room-seat ${peer === meP ? 'me' : ''}`, 'data-seat': peer }, portrait(m?.race), h('span', { class: 'nm' }, m?.name || '…'),
            peer === cur.host ? h('span', { class: 'tag lead' }, glyph('crown'), 'เจ้าของ') : ready ? h('span', { class: 'tag party' }, glyph('check'), 'พร้อม') : h('span', { class: 'tag' }, 'รอ'));
        }),
        myTeam !== t && !MODES[cur.mode].coop ? h('button', { class: 'btn small', type: 'button', 'data-action': `pick-${t}`, disabled: cur.roster[t].length >= size, onclick: () => { R.pick(t); app.audio.play('click'); } }, myTeam ? 'ย้ายมาทีมนี้' : 'นั่งทีมนี้') : null);
      const can = R.canStartNow();
      const coop = !!MODES[cur.mode].coop;
      const zone = coop ? getZone(cur.zone) : null;
      drawerBody.replaceChildren(
        coop
          ? h('div', { class: 'room-meta' }, h('span', { class: 'chip' }, glyph('people'), `${MODES[cur.mode].tower ? 'ผู้ปีนหอคอย' : 'คณะสำรวจ'} ${cur.roster.a.length}/${size}`), zone ? h('span', { class: 'chip warn' }, `${zone.name} · เลเวล ${zone.level}`) : null, MODES[cur.mode].tower ? h('span', { class: 'chip warn' }, glyph('skull'), `เริ่มชั้น ${cur.floor || 1}${cur.asc ? ` · ขุมลึก ${cur.asc}` : ''}`) : null)
          : h('div', { class: 'room-meta' }, h('span', { class: 'chip' }, glyph('duel'), MODES[cur.mode].name), h('span', { class: 'chip' }, 'ชนะ 2 ใน 3 ยก')),
        coop ? h('div', { class: 'room-teams single' }, col('a')) : h('div', { class: 'room-teams' }, col('a'), col('b')),
        cur.amHost
          ? h('button', { class: 'btn primary', type: 'button', 'data-action': 'room-start', disabled: !can.ok, onclick: () => { const r = R.start(); if (!r.ok) app.toast(REASONS[r.reason] || 'เริ่มไม่ได้', 'warn'); } }, glyph(coop ? 'sword' : 'duel'), can.ok ? (MODES[cur.mode].tower ? 'เริ่มปีนหอคอย' : coop ? 'ออกสำรวจ' : 'เริ่มการประลอง') : REASONS[can.reason] || 'รอผู้เล่น')
          : h('button', { class: `btn ${cur.ready[meP] ? '' : 'primary'}`, type: 'button', 'data-action': 'room-ready', disabled: !myTeam, onclick: () => { R.setReady(!cur.ready[meP]); app.audio.play('click'); } }, glyph('check'), cur.ready[meP] ? 'ยกเลิกพร้อม' : 'พร้อม'),
        h('button', { class: 'btn small danger', type: 'button', 'data-action': 'room-leave', onclick: () => { R.leave(); app.audio.play('click'); } }, 'ออกจากห้อง'),
        h('small', { class: 'faint' }, MODES[cur.mode].tower ? 'ศัตรูและบอสแรงขึ้นตามจำนวนคน (สูงสุด 8) ของดรอปเป็นของใครของมัน ล้มแล้วเพื่อนกดค้าง 7 วินาทีเพื่อชุบ ฟื้นมาเลือดครึ่งหนึ่ง และรอบจะจบเมื่อทุกคนล้ม' : coop ? 'ศัตรูแข็งขึ้นตามจำนวนคน ของดรอปเป็นของใครของมัน ล้มแล้วให้เพื่อนยืนข้างๆ เพื่อชุบชีวิต' : 'ไม่มีสัตว์เลี้ยงและห้ามใช้ยา ดาเมจผู้เล่นเหลือ 45% ผลแพ้ชนะของทีมบันทึกลงสถิติดวลของทุกคน'));
      return;
    }
    const rooms = R.list();
    drawerTitle.textContent = `ห้อง PvP และคณะสำรวจ (${rooms.length})`;
    const titleIn = h('input', { type: 'text', class: 'text-in', maxlength: '24', placeholder: 'ชื่อห้อง (ไม่ใส่ก็ได้)', 'aria-label': 'ชื่อห้อง', 'data-room-title': '' });
    drawerBody.replaceChildren(
      h('button', { class: 'btn', type: 'button', 'data-action': 'open-zones', onclick: () => app.openZones() }, glyph('door'), 'ประตูมิติ: ดันเจี้ยนรวม 12 โซน'),
      h('div', { class: 'room-create' },
        h('div', { class: 'vchs room-modes', role: 'radiogroup', 'aria-label': 'รูปแบบ' }, Object.values(MODES).filter((m) => !m.coop).map((m) => h('button', { class: 'vch', type: 'button', role: 'radio', 'data-mode': m.id, 'aria-pressed': String(m.id === newMode), 'aria-checked': String(m.id === newMode), onclick: () => { newMode = m.id; renderRooms(); } }, m.id))),
        titleIn,
        h('button', { class: 'btn primary small', type: 'button', 'data-action': 'room-create', onclick: async () => {
          const r = await R.create(newMode, titleIn.value);
          if (!r.ok) { app.toast(REASONS[r.reason] || 'สร้างห้องไม่สำเร็จ', 'warn'); app.audio.play('error'); } else app.audio.play('success');
        } }, glyph('duel'), 'สร้างห้อง')),
      ...(rooms.length ? rooms.map((ad) => h('div', { class: 'vrow', 'data-room': ad.id },
        h('span', { class: 'room-mode' }, ad.mode === 'tower' ? 'หอคอย' : ad.zone ? 'สำรวจ' : ad.mode),
        h('div', { class: 'vrow-main' }, h('b', {}, ad.title), h('small', { class: 'muted' }, `${ad.hostName} · ${ad.players}/${ad.max} คน${ad.mode === 'tower' ? ` · ชั้น ${ad.floor}${ad.asc ? ` ขุมลึก ${ad.asc}` : ''}` : ad.zone ? ` · ${getZone(ad.zone)?.name}` : ''}${ad.playing ? ' · กำลังเล่น' : ''}`)),
        ad.watch
          ? h('button', { class: 'btn small primary', type: 'button', 'data-action': 'room-watch', onclick: () => { app.audio.play('click'); app.watchMatch(ad); } }, glyph('eye'), 'ชม')
          : h('button', { class: 'btn small', type: 'button', 'data-action': 'room-join', disabled: ad.playing || ad.players >= ad.max, onclick: async () => {
            const r = await R.join(ad);
            if (!r.ok) { app.toast(r.detail || REASONS[r.reason] || 'เข้าห้องไม่สำเร็จ', 'warn'); app.audio.play('error'); } else app.audio.play('click');
          } }, 'เข้าร่วม')))
        : [h('div', { class: 'empty-note' }, 'ยังไม่มีห้องเปิดอยู่ สร้างห้อง 1v1, 2v2 หรือ 3v3 หรือเปิดคณะสำรวจจากประตูมิติ แล้วชวนเพื่อนมาร่วม')]));
  }

  // ------------------------------------------------------------ chat
  const log = h('div', { class: 'vlog', 'aria-live': 'polite' });
  const chIn = h('input', { type: 'text', class: 'text-in', maxlength: String(CHAT_MAX), placeholder: 'พิมพ์ข้อความ…', 'aria-label': 'ข้อความแชท', enterkeyhint: 'send', 'data-chat': '' });
  const chBtns = ['village', 'party', 'guild'].map((c) => h('button', { class: 'vch', type: 'button', 'data-ch': c, 'aria-pressed': String(c === channel), onclick: () => setChannel(c) }, { village: 'หมู่บ้าน', party: 'ปาร์ตี้', guild: 'กิลด์' }[c]));
  const form = h('form', { class: 'vsend', onsubmit: (e) => { e.preventDefault(); sendChat(); } },
    h('div', { class: 'vchs' }, chBtns), chIn,
    h('button', { class: 'btn icon primary', type: 'submit', 'aria-label': 'ส่งข้อความ', 'data-action': 'send-chat' }, glyph('send')));
  const chat = h('section', { class: 'vchat' }, log, form);

  function setChannel(c) {
    if (c === 'party' && !online().party) { app.toast(REASONS.no_party, 'warn', 'chat'); return; }
    if (c === 'guild' && !app.guild.current) { app.toast(REASONS.no_guild, 'warn', 'chat'); return; }
    channel = c;
    chBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ch === c)));
    chIn.focus();
  }
  function setChatOpen(v) {
    chatOpen = v;
    chat.classList.toggle('open', v);
    btnChat.setAttribute('aria-pressed', String(v));
    if (v && app.touch) setTimeout(() => chIn.focus(), 30);
  }
  async function sendChat() {
    if (!online().canSend()) { app.toast(online().online ? REASONS.view_only : online().reason, 'warn', 'chat'); return; }
    const r = channel === 'guild' ? await app.guild.sendChat(chIn.value) : await online().sendChat(chIn.value, channel);
    if (!r.ok) { if (r.reason !== 'empty') app.toast(REASONS[r.reason] || 'ส่งไม่สำเร็จ', 'warn', 'chat'); return; }
    chIn.value = '';
    if (app.touch) chIn.blur();
  }
  function addLine(line) {
    const el = h('div', { class: `vline ${line.ch} ${line.me ? 'me' : ''}` },
      line.ch === 'party' ? h('span', { class: 'chn' }, '[ปาร์ตี้]') : line.ch === 'guild' ? h('span', { class: 'chn g' }, '[กิลด์]') : null,
      h('b', {}, line.name), h('span', {}, ': ', line.text));
    log.append(el);
    while (log.children.length > 30) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    log.classList.remove('idle'); clearTimeout(addLine.t); addLine.t = setTimeout(() => log.classList.add('idle'), 12000);
  }

  // desktop: Enter focuses the chat, Esc leaves it
  window.addEventListener('keydown', (e) => {
    if (layer.hidden) return;
    if (e.key === 'Enter' && document.activeElement !== chIn && !modalClose) { e.preventDefault(); setChatOpen(true); chIn.focus(); }
    else if (e.key === 'Escape' && document.activeElement === chIn) { chIn.blur(); }
  });

  // ------------------------------------------------------------ requests (camp + village)
  const reqHost = h('div', { class: 'vreqs', 'aria-live': 'polite' });
  const reqLayer = h('div', { class: 'layer req-layer', hidden: true }, reqHost);
  function renderRequests() {
    const reqs = online().requests;
    reqHost.replaceChildren(...reqs.slice(-3).map((r) => {
      const left = Math.max(0, REQUEST_TTL - (Date.now() - r.at));
      return h('div', { class: `vreq panel k-${r.kind}`, 'data-req': r.rid, 'data-kind': r.kind },
        glyph(r.kind === 'duel' ? 'duel' : r.kind === 'party' ? 'party' : r.kind === 'trade' ? 'bag' : r.kind === 'guild' ? 'crown' : 'friend'),
        h('div', { class: 'vreq-main' }, h('b', {}, r.from.name), h('small', {}, `Lv.${r.from.lv} · ${KIND_TEXT[r.kind]}${r.kind === 'guild' && r.gname ? ` ${r.gname}` : ''}`),
          h('i', { class: 'timer', style: { animationDuration: `${left}ms` } })),
        h('button', { class: 'btn small', type: 'button', 'data-action': 'decline', onclick: () => answer(r, false) }, 'ปฏิเสธ'),
        h('button', { class: 'btn small primary', type: 'button', 'data-action': 'accept', onclick: () => answer(r, true) }, 'รับ'));
    }));
  }
  function answer(r, yes) {
    if (yes && (r.kind === 'duel' || r.kind === 'trade') && !app.canStartDuel()) { app.toast('จบการล่า การดวล หรือการแลกเปลี่ยนที่ทำอยู่ก่อน', 'warn'); return; }
    const res = online().respond(r.rid, yes);
    app.audio.play(yes ? 'success' : 'click');
    if (!res.ok) { app.toast(REASONS[res.reason] || 'ตอบคำขอไม่สำเร็จ', 'warn'); return; }
    if (yes && r.kind === 'friend') app.toast(`${r.from.name} เป็นเพื่อนแล้ว`, 'ok');
    if (yes && r.kind === 'party') app.toast(`เข้าปาร์ตี้ของ ${r.from.name}`, 'ok');
  }

  // ------------------------------------------------------------ player card
  function openPlayer(peer) {
    const o = online();
    const x = o.peers.find((p) => p.peer === peer);
    if (!x) { app.toast(REASONS.not_here, 'warn'); return; }
    const p = x.p;
    const race = getRace(p.race), weapon = getItem(p.weapon), armor = getItem(p.armor), pet = getPet(p.pet);
    const st = app.store.get();
    const uid = x.by;
    const isFriend = !!(uid && st.social.friends[uid]);
    const party = o.party;
    const sameParty = party && party.members.some((m) => m.peer === peer);
    const act = (kind, label, icon, disabledReason) => h('button', {
      class: `btn ${kind === 'duel' ? 'primary' : ''}`, type: 'button', 'data-action': `req-${kind}`, disabled: !!disabledReason, title: disabledReason || '',
      onclick: () => {
        if (!o.canSend()) { app.toast(o.online ? REASONS.view_only : o.reason, 'warn'); return; }
        if ((kind === 'duel' || kind === 'trade') && !app.canStartDuel()) { app.toast('จบการล่า การดวล หรือการแลกเปลี่ยนที่ทำอยู่ก่อน', 'warn'); return; }
        const r = o.request(kind, peer);
        if (!r.ok) { app.toast(REASONS[r.reason] || 'ส่งคำขอไม่สำเร็จ', 'warn'); app.audio.play('error'); return; }
        app.audio.play('click');
        app.toast(`ส่งคำขอ${KIND_TEXT[kind].replace('ขอ', '')}ถึง ${p.name} แล้ว`, 'ok');
        closeModal();
      },
    }, glyph(icon), label);
    const content = h('div', { class: 'modal panel player-card', 'data-modal': 'player', 'data-peer': peer },
      h('div', { class: 'pc-head' }, portrait(p.race),
        h('div', {}, h('h2', {}, p.name), h('div', { class: 'muted' }, `Lv.${p.lv} · ${race ? race.name : 'ยังไม่ปลุกสายเลือด'} · ${ZONE_TEXT[zoneOf(p)]}`),
          isFriend ? h('span', { class: 'tag friend' }, 'เพื่อน') : null, p.modified ? h('span', { class: 'tag warn' }, 'เซฟถูกแก้ไข') : null, sameParty ? h('span', { class: 'tag party' }, 'ปาร์ตี้เดียวกัน') : null)),
      h('div', { class: 'pc-gear' },
        weapon ? h('div', { class: 'pc-item' }, itemImg(weapon.id), h('span', {}, weapon.name)) : null,
        armor ? h('div', { class: 'pc-item' }, itemImg(armor.id), h('span', {}, armor.name)) : null,
        pet ? h('div', { class: 'pc-item' }, h('img', { class: 'item-img', alt: '', src: app.petUri(pet.id) }), h('span', {}, pet.name)) : null),
      h('button', { class: 'btn gold pc-profile', type: 'button', 'data-action': 'view-profile', onclick: () => { closeModal(); app.openPeerProfile(peer); } }, glyph('eye'), 'ดูโปรไฟล์ อุปกรณ์ และสัตว์เลี้ยง'),
      h('div', { class: 'pc-actions' },
        act('friend', isFriend ? 'เป็นเพื่อนแล้ว' : 'เพิ่มเพื่อน', 'friend', isFriend ? REASONS.already_friend : !uid ? REASONS.no_account : null),
        act('party', 'ชวนเข้าปาร์ตี้', 'party', sameParty ? REASONS.already_member : party && party.leader !== o.me.peer ? REASONS.not_leader : party && party.members.length >= PARTY_MAX ? REASONS.party_full : null),
        act('trade', 'แลกเปลี่ยน', 'bag', p.modified ? REASONS.their_save_modified : p.busy ? REASONS.busy : null),
        act('guild', 'ชวนเข้ากิลด์', 'crown', !app.guild.current ? REASONS.no_guild : p.gtag ? REASONS.has_guild : !uid ? REASONS.no_account : null),
        act('duel', 'ขอดวล 1v1', 'duel', p.modified ? REASONS.their_save_modified : p.busy ? REASONS.busy : null)),
      h('small', { class: 'faint' }, 'การดวล: ชนะ 2 ใน 3 ยก ใช้อาวุธ สกิล และสกิลเผ่าของตัวเอง ไม่มีสัตว์เลี้ยงและห้ามใช้ยา ผลแพ้ชนะบันทึกในเซฟ'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => closeModal() }, 'ปิด')));
    openModal(content);
    // the card follows the player: when they finish a duel, join a guild or leave, the buttons update
    const cardKey = (y) => (y ? [y.p.name, y.p.lv, y.p.busy, y.p.zone, y.p.gtag, y.p.race, y.p.weapon, y.p.armor, y.p.pet, y.p.py].join('|') : 'gone');
    const shown = cardKey(x);
    const off = o.on('peers', (list) => {
      if (!content.isConnected) { off(); return; }
      const y = list.find((q) => q.peer === peer);
      if (cardKey(y) === shown) return;
      off();
      if (y) openPlayer(peer); else { closeModal(); app.toast(REASONS.not_here, 'info'); }
    });
  }

  function openBoard() {
    const st = app.store.get();
    const content = h('div', { class: 'modal panel', 'data-modal': 'board' },
      h('h2', {}, 'กระดานประกาศ'),
      h('div', { class: 'kv' },
        h('div', {}, h('span', { class: 'muted' }, 'ดวลชนะ'), h('b', {}, `${st.pvp.wins} ครั้ง`)),
        h('div', {}, h('span', { class: 'muted' }, 'ดวลแพ้'), h('b', {}, `${st.pvp.losses} ครั้ง`)),
        h('div', {}, h('span', { class: 'muted' }, 'เพื่อน'), h('b', {}, `${Object.keys(st.social.friends).length} คน`)),
        h('div', {}, h('span', { class: 'muted' }, 'ออนไลน์ตอนนี้'), h('b', {}, `${online().peers.length + 1} คน`))),
      h('ul', { class: 'board-list' },
        h('li', {}, 'เดินด้วยปุ่มทิศ / จอยสติก หรือแตะพื้นเพื่อเดินไปตรงนั้น'),
        h('li', {}, 'แตะผู้เล่น (หรือเดินเข้าใกล้แล้วกด E) เพื่อดูข้อมูล เพิ่มเพื่อน ชวนเข้าปาร์ตี้ หรือขอดวล'),
        h('li', {}, 'กด Enter เพื่อพิมพ์แชท เลือกช่อง "หมู่บ้าน" หรือ "ปาร์ตี้" ข้อความจะลอยเหนือหัวด้วย'),
        h('li', {}, 'คำขอทุกแบบหมดเวลาใน 30 วินาที ผู้เล่นที่กำลังล่าหรือดวลจะรับคำขอดวลไม่ได้'),
        h('li', {}, 'การดวลชนะ 2 ใน 3 ยก ดาเมจลดลงเหลือ 45% ของปกติ หลบสมบูรณ์ใช้ได้เหมือนในดันเจี้ยน')),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: () => closeModal() }, 'รับทราบ')));
    openModal(content);
  }

  function openModal(content) { closeModal(); modalClose = app.modal(content, { onClose: () => { modalClose = null; } }); }
  function closeModal() { if (modalClose) { const c = modalClose; modalClose = null; c(); } }

  // ------------------------------------------------------------ status
  function renderStatus() {
    const o = online();
    const inVillage = o.peers.filter((x) => x.p.zone === 'village').length;
    statusDot.className = `dot ${o.online ? (o.canSend() ? 'on' : 'warn') : 'off'}`;
    statusTxt.textContent = !o.online ? o.reason
      : `${o.mode === 'local' ? 'โหมดทดสอบในเครื่อง · ' : ''}${inVillage + 1} คนในหมู่บ้าน · ออนไลน์ ${o.peers.length + 1}${o.canSend() ? '' : ' · ดูอย่างเดียว'}`;
    countPlayers.textContent = o.peers.length;
    countParty.textContent = o.party ? o.party.members.length : 0;
    countParty.hidden = !o.party;
    const nRooms = app.rooms ? app.rooms.list().length : 0;
    countRooms.textContent = nRooms; countRooms.hidden = !nRooms;
  }

  const layer = h('div', { class: 'layer village-ui', hidden: true }, bar, drawerEl, chat);
  root.append(layer, reqLayer);
  setChatOpen(chatOpen);

  // live updates
  let wiredTo = null;
  function wire() {
    if (!app.online || wiredTo === app.online) return;
    wiredTo = app.online;
    const o = app.online;
    // presence changes many times a second while people walk; lists only redraw when what they show changed
    let listKey = '';
    o.on('peers', (list) => {
      renderStatus();
      const key = list.map((x) => [x.peer, x.p.name, x.p.lv, zoneOf(x.p), x.p.race, x.p.room ? `${x.p.room.id}.${x.p.room.players}.${x.p.room.playing}` : ''].join(':')).join('|');
      if (key !== listKey) { listKey = key; renderDrawer(); }
    });
    o.on('party', () => { renderStatus(); if (drawer === 'party') renderDrawer(); if (!o.party && channel === 'party') setChannel('village'); });
    o.on('chat', addLine);
    o.on('requests', renderRequests);
    o.on('status', renderStatus);
    o.on('answer', (a) => {
      const verb = { friend: 'คำขอเป็นเพื่อน', party: 'คำชวนเข้าปาร์ตี้', duel: 'คำท้าดวล', trade: 'คำขอแลกเปลี่ยน', guild: 'คำชวนเข้ากิลด์' }[a.kind];
      if (a.accepted) app.toast(`${a.from.name} รับ${verb}แล้ว`, 'ok');
      else app.toast(`${a.from.name} ปฏิเสธ${verb}`, 'info');
      app.audio.play(a.accepted ? 'success' : 'click');
    });
  }

  return {
    wire,
    watchRooms() { app.rooms.on(() => { if (drawer === 'rooms') renderRooms(); renderStatus(); }); app.guild.on(() => { if (drawer === 'guild') renderDrawer(); }); },
    openRooms() { if (drawer !== 'rooms') toggleDrawer('rooms'); },
    rewire() { wire(); renderStatus(); renderRequests(); renderDrawer(); },
    show() { wire(); layer.hidden = false; renderStatus(); renderDrawer(); log.classList.remove('idle'); },
    hide() { layer.hidden = true; closeModal(); if (document.activeElement === chIn) chIn.blur(); },
    showRequests(v) { wire(); reqLayer.hidden = !v; if (v) renderRequests(); },
    openPlayer, openBoard,
    // movement is paused while typing or reading a card
    blocking: () => !!modalClose || document.activeElement === chIn,
    toggleMenu() { if (!modalClose && drawer) toggleDrawer(null); },
    get visible() { return !layer.hidden; },
  };
}
