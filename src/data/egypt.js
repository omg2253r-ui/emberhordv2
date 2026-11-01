// v9 Egypt (r4 สุสานสุริยะ): materials, gear and the secret katana, cloned from the raid items' own shape.
export const EGYPT_ITEMS = Object.freeze({
  m_egypt_sigil:{ id: 'm_egypt_sigil', name: 'ตราสุสานสุริยะ', category: 'material', rarity: 'epic', sellPrice: 180, src: 'z13', art: { kind: 'core', icon: 'egy_sigil', main: '#e0b45a', glow: '#fff3c4' }, desc: 'ตราทองจากสุสานของฟาโรห์ ใช้คราฟ' },
  m_anubis_scale:{ id: 'm_anubis_scale', name: 'ตราชั่งหัวใจแห่งอนูบิส', category: 'material', rarity: 'legendary', sellPrice: 600, src: 'z13', art: { kind: 'core', icon: 'egy_scale', main: '#7fe8ff', glow: '#e8f6ff' }, desc: 'ตราชั่งที่เคยชั่งหัวใจนับพันดวง ส่วนแรกของดาบสุริยะ' },
  m_sekhmet_fang:{ id: 'm_sekhmet_fang', name: 'เขี้ยวสงครามเซคเมท', category: 'material', rarity: 'legendary', sellPrice: 600, src: 'z13', art: { kind: 'core', icon: 'egy_fang', main: '#ff5a3a', glow: '#ffcf5a' }, desc: 'เขี้ยวสิงโตสงครามที่ยังร้อนระอุ ส่วนที่สองของดาบสุริยะ' },
  m_ra_eye:{ id: 'm_ra_eye', name: 'ดวงตาสุริยเทพรา', category: 'material', rarity: 'legendary', sellPrice: 600, src: 'z13', art: { kind: 'core', icon: 'egy_eye', main: '#ffcf5a', glow: '#ffffff' }, desc: 'ดวงตาที่ส่องแสงมาตั้งแต่ก่อนมีวัน ส่วนที่สามของดาบสุริยะ' },
  a_pharaoh_plate:{ id: 'a_pharaoh_plate', name: 'เกราะฟาโรห์สุริยะ', category: 'armor', rarity: 'legendary', stats: { def: 34, hp: 160, crit: 0.05 }, src: 'z13',
                     art: { kind: 'forge', icon: 'egy_pharaoh', main: '#efe6d0', trim: '#2a55c8', accent: '#f5c35a', chest: 'plate', shoulder: 'layered', skirt: 'kilt', emblem: 'eye', arm: 'bracer' }, desc: 'เกราะทองของฟาโรห์ผู้ไม่เคยพ่ายในสุสาน' },
  c_scarab_charm: { id: 'c_scarab_charm', name: 'ด้วงทองนำโชค', category: 'charm', rarity: 'legendary', stats: { hp: 70, atk: 9, crit: 0.08 }, src: 'z13',
                     art: { kind: 'bead', icon: 'egy_scarab', main: '#fff3a0', trim: '#f5c35a' }, desc: 'ด้วงทองที่ชาวอียิปต์เชื่อว่าพาตะวันขึ้นทุกเช้า' },
  w_sun_yoru: { id: 'w_sun_yoru', wtype: 'katana', name: 'ยอรุสุริยะ', category: 'weapon', rarity: 'mythic', stats: { atk: 66, crit: 0.16, critMult: 0.5, spd: 0.06, hp: 70 }, src: 'z13', unique: 'sunwave',
                     art: { kind: 'yoru', blade: '#0b0912', bevel: '#262244', edge: '#9fb4ff', gold: '#f5c35a', goldDark: '#b07a2e', linen: '#efe6d0', gem: '#34e3a4', lapis: '#2a55c8', glow: '#ffcf5a' }, desc: 'ดาบยาวสีดำที่มีฝักยาวคล้ายดาบโยรุ ฟันครั้งเดียวคลื่นดาบก็ตัดผ่านทั้งแถว' },
});
