// เกียรติยศ: achievements & titles (wear one; it shows above your name everywhere) and the leaderboards.
import { h, glyph } from '../dom.js';
import { TITLES, TITLE_TIERS, getTitle, badgeTier, BADGE_NAMES, BADGE_EVERY, titleBonusText } from '../../data/titles.js';
import { equipTitle } from '../../systems/titles.js';
import { getRace } from '../../data/races.js';
import { cloudError } from '../../net/cloud.js';

export const BOARD_INFO = Object.freeze([
  ['power', 'พลังรบ', (v) => v.toLocaleString('th-TH')],
  ['level', 'เลเวล', (v) => `Lv ${Math.floor(v / 1e7)}`],
  ['tower', 'หอคอยขุมนรก', (v) => (v >= 100 ? `ขุม ${Math.floor((v - 1) / 100)} · ชั้น ${((v - 1) % 100) + 1}` : `ชั้น ${v}`)],
  ['gods', 'ปราบเทพ', (v) => `${Math.floor(v / 1e6)} องค์ · ${v % 1e6} ครั้ง`],
  ['kills', 'กำจัดศัตรู', (v) => v.toLocaleString('th-TH')],
  ['pvp', 'ชนะ PvP', (v) => `${v} ครั้ง`],
  ['rift', 'รอยแยก', (v) => `คลื่น ${v}`],
  ['raids', 'ดันพิเศษ', (v) => `${v} ครั้ง`],
  ['zones', 'ดันเจี้ยนรวม', (v) => `${v} ครั้ง`],
  ['pets', 'สัตว์เลี้ยง', (v) => `${Math.floor(v / 100)} ตัว`],
  ['races', 'เผ่าที่เคยเป็น', (v) => `${v} เผ่า`],
  ['titles', 'ฉายา', (v) => `${v} ฉายา`],
  ['crafted', 'ตีอุปกรณ์', (v) => `${v} ชิ้น`],
  ['gold', 'ทอง', (v) => v.toLocaleString('th-TH')],
]);

export function createHonorPanel(app) {
  let tab = 'titles', board = 'power';
  const cache = new Map();          // board → { at, data }
  async function load(b, force = false) {
    const c = cache.get(b);
    if (!force && c && Date.now() - c.at < 30_000) return;
    cache.set(b, { at: Date.now(), data: c?.data || null, loading: true });
    const r = await app.cloud.ranks(b);
    cache.set(b, { at: Date.now(), data: r.error ? null : r, error: r.error || null });
    if (tab === 'ranks' && board === b) app.rerender();
  }
  return {
    id: 'honor', title: 'เกียรติยศ · อันดับ', short: 'เกียรติยศ', icon: 'crown',
    badge: () => { const st = app.store.get(); return Object.keys(st.titles?.owned || {}).length > 0 && !st.titles?.equipped; },
    render(body) {
      const st = app.store.get();
      const tabs = h('div', { class: 'craft-tabs honor-tabs' },
        h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(tab === 'titles'), 'data-honor-tab': 'titles', onclick: () => { tab = 'titles'; app.rerender(); } }, glyph('crown'), 'ฉายา'),
        h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(tab === 'ranks'), 'data-honor-tab': 'ranks', onclick: () => { tab = 'ranks'; load(board); app.rerender(); } }, glyph('star'), 'อันดับ'));
      if (tab === 'titles') {
        const owned = st.titles?.owned || {}, n = Object.keys(owned).length, tier = badgeTier(st);
        const worn = getTitle(st.titles?.equipped);
        const head = h('div', { class: 'honor-head' },
          h('div', { class: 'honor-badge', 'data-badge': tier }, glyph('crown'), h('b', {}, tier ? BADGE_NAMES[tier] || `ตราเกียรติยศ ${tier}` : 'ยังไม่มีตรา'), h('small', { class: 'muted' }, `ทุก ${BADGE_EVERY} ความสำเร็จ: พลังโจมตี ป้องกัน พลังชีวิต +1%`)),
          h('div', { class: 'honor-worn' }, h('small', { class: 'muted' }, 'ฉายาที่ใช้อยู่'), worn ? h('b', { style: { color: TITLE_TIERS[worn.t].color } }, worn.name) : h('b', { class: 'muted' }, 'ไม่ได้ใช้'), worn ? h('small', {}, titleBonusText(worn.b)) : null),
          h('small', { class: 'muted num' }, `ปลดล็อกแล้ว ${n}/${TITLES.length}`));
        const list = h('div', { class: 'title-list' }, TITLES.map((t) => {
          const got = !!owned[t.id], on = st.titles?.equipped === t.id, tierInfo = TITLE_TIERS[t.t];
          return h('div', { class: `title-row ${got ? 'got' : 'locked'} ${on ? 'on' : ''}`, 'data-title': t.id, style: { '--tc': tierInfo.color } },
            h('span', { class: 'tr-tier' }, tierInfo.name),
            h('div', { class: 'tr-main' }, h('b', {}, got ? t.name : '???'), h('small', { class: 'muted' }, t.how), h('small', { class: 'tr-bonus' }, titleBonusText(t.b))),
            got ? h('button', { class: `btn sm ${on ? '' : 'primary'}`, type: 'button', 'data-title-wear': t.id, onclick: () => {
              const r = equipTitle(app.store.get(), on ? null : t.id);
              if (!r.ok) return;
              app.store.commit(r.state, { reason: 'title' }); app.audio.play(on ? 'click' : 'unlock'); app.toast(on ? 'ถอดฉายาแล้ว' : `ใช้ฉายา "${t.name}"`, 'ok');
              app.refreshPresence?.();
            } }, on ? 'ถอด' : 'ใช้') : h('span', { class: 'tr-lock' }, glyph('lock')));
        }));
        body.replaceChildren(tabs, h('button', { class: 'btn sm gold', type: 'button', 'data-action': 'my-profile', onclick: () => app.openProfile() }, glyph('eye'), 'โปรไฟล์ของฉัน'), head, list);
        return;
      }
      // ---- leaderboards
      if (!app.cloud.available) {
        body.replaceChildren(tabs, h('div', { class: 'notice' }, 'อันดับใช้ได้เมื่อเปิดเกมจากเว็บ emberhold-online.netlify.app และสมัครเซฟออนไลน์ (คะแนนคำนวณจากเซฟในบัญชี เพื่อกันการโกง)'));
        return;
      }
      const c = cache.get(board);
      if (!c) load(board);
      const info = BOARD_INFO.find((b) => b[0] === board);
      const picker = h('div', { class: 'craft-tabs rank-boards' }, BOARD_INFO.map(([id, label]) => h('button', { class: 'btn sm', type: 'button', 'aria-selected': String(board === id), 'data-board': id, onclick: () => { board = id; load(id); app.rerender(); } }, label)));
      const acc = app.cloud.account();
      let table;
      if (!c || (c.loading && !c.data)) table = h('div', { class: 'empty-note' }, 'กำลังโหลดอันดับ…');
      else if (c.error) table = h('div', { class: 'notice' }, cloudError(c.error));
      else if (!c.data.entries.length) table = h('div', { class: 'empty-note' }, 'ยังไม่มีใครในตารางนี้ เป็นคนแรกเลย!');
      else table = h('ol', { class: 'rank-table', 'data-rank-board': board }, c.data.entries.slice(0, 100).map((e) => {
        const t = getTitle(e.t), race = getRace(e.r);
        return h('li', { class: `rank-row ${e.rank <= 3 ? 'top' + e.rank : ''}`, role: 'button', tabindex: '0', 'data-rank-account': e.a, title: 'ดูโปรไฟล์', onclick: () => app.openAccountProfile(e.a), onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); app.openAccountProfile(e.a); } } },
          h('b', { class: 'rk-no num' }, e.rank),
          h('div', { class: 'rk-who' }, t ? h('small', { class: 'rk-title', style: { color: TITLE_TIERS[t.t].color } }, t.name) : null, h('b', {}, e.n || e.a), h('small', { class: 'muted' }, `Lv ${e.lv}${race ? ` · ${race.name}` : ''} · ${e.a}`)),
          h('b', { class: 'rk-val num' }, info[2](e.v)));
      }));
      body.replaceChildren(tabs, picker,
        h('div', { class: 'rank-me muted' }, acc ? (c?.data?.me ? `อันดับของคุณ: ${c.data.me}` : 'คุณยังไม่ติด 100 อันดับแรกของตารางนี้') : 'สมัครเซฟออนไลน์เพื่อขึ้นตารางอันดับ'),
        table,
        h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', 'data-action': 'rank-refresh', onclick: () => { load(board, true); app.rerender(); } }, glyph('dice'), 'โหลดใหม่'), acc ? null : h('button', { class: 'btn sm primary', type: 'button', onclick: () => app.openAccount() }, glyph('globe'), 'สมัคร / เข้าสู่ระบบ')),
        h('small', { class: 'faint' }, 'แตะชื่อเพื่อดูโปรไฟล์ · คะแนนคำนวณบนเซิร์ฟเวอร์จากเซฟที่บันทึกขึ้นบัญชี เซฟที่ถูกแก้ไขนอกเกมจะไม่ขึ้นตาราง'));
    },
  };
}
