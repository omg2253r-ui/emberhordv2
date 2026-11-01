// v8 weapons: the two new lands' legendaries and one secret blade.
//   w_prism_rapier     ราชินีกระจกแตก (z11) — thrusts that split into reflected light
//   w_eclipse_halberd  จักรพรรดิสุริยคราส (z12) — a halberd that swings sun and moon in turn
//   w_eclipse_blade    ??? — a sword nobody is told about. It is only ever carried by the shadow that waits at the end
//                      of the Boss Rush, and only on a run where nobody fell. Its ultimate is always a secret one.
// Same move format as data/weapons2.js (every weapon has its own combo, charged, dodge and branch moves).
const arc = (range, deg) => ({ shape: 'arc', range, arc: deg });
const circ = (r, forward = 0) => ({ shape: 'circle', r, forward });
const proj = (kind, speed, r, o = {}) => ({ shape: 'proj', kind, speed, r, pierce: 0, count: 1, spread: 0, ...o });
const rush = (dist, width) => ({ shape: 'rush', dist, width });
const zone = (r, delay, reach) => ({ shape: 'zone', r, delay, reach });
const mv = (name, anim, t, power, hit, extra = {}) => ({ name, anim, windup: t[0], active: t[1], recover: t[2], cancel: t[3], power, hit, ...extra });
const W = (id, wtype, name, rarity, src, stats, art, desc, moves, extra = {}) => ({ id, wtype, name, category: 'weapon', rarity, src, stats, art: { kind: 'forge', ...art }, desc, moves, ...extra });

export const WEAPONS_V8 = Object.freeze({
  w_prism_rapier: W('w_prism_rapier', 'sword', 'เรเปียร์ปริซึม', 'legendary', 'z11', { atk: 58, crit: 0.16, critMult: 0.3 },
    { form: 'prismrapier', blade: '#d8f0ff', edge: '#ffffff', guard: '#7fa8d8', grip: '#1e2a3a', glow: '#7fe8ff' },
    'ดาบเรียวที่ราชินีกระจกใช้ส่องเงาตัวเอง ทุกการแทงแตกเป็นแสงสะท้อนหลายเส้น', {
      combo: [
        mv('แทงสะท้อน', 'thrust', [0.05, 0.06, 0.16, 0.32], 0.85, arc(132, 30), { kb: 110, step: 22, critBonus: 0.08 }),
        mv('แทงคู่เงา', 'thrust', [0.05, 0.06, 0.16, 0.32], 0.5, arc(132, 36), { multi: 2, kb: 90, step: 22 }),
        mv('กวาดกระจก', 'slash', [0.07, 0.08, 0.2, 0.36], 1.0, arc(112, 150), { kb: 160, step: 12, slow: 0.3 }),
        mv('ปริซึมแตก', 'thrust', [0.1, 0.08, 0.3, 0.6], 1.1, proj('shard', 880, 9, { count: 4, spread: 26, pierce: 1 }), { critBonus: 0.15, shake: 3 }),
      ],
      charged: mv('ลำแสงหักเห', 'thrust', [0.05, 0.1, 0.32, 0.6], 1.6, proj('bigArrow', 1400, 11, { count: 3, spread: 18, pierce: 99 }), { critBonus: 0.3, shake: 5 }),
      dash: mv('ทะลุกระจก', 'thrust', [0.02, 0.1, 0.22, 0.45], 1.3, rush(210, 36), { kb: 140, teleport: 'behind', critBonus: 0.2 }),
      branch: mv('กรงแสงสะท้อน', 'spin', [0.07, 0.14, 0.3, 0.6], 0.7, circ(126), { multi: 3, kb: 60, slow: 0.5, hitStop: 0.06 }),
    }),
  w_eclipse_halberd: W('w_eclipse_halberd', 'spear', 'ง้าวสุริยจันทรา', 'legendary', 'z12', { atk: 62, crit: 0.1, critMult: 0.25, hp: 60 },
    { form: 'eclipsehalberd', head: '#2a2238', edge: '#ffd27a', shaft: '#3a2a20', trim: '#ffb648', glow: '#ffd27a' },
    'ง้าวที่จักรพรรดิสุริยคราสใช้แบ่งกลางวันกับกลางคืน ฟันแรงเป็นแสง ฟันหลังเป็นเงา', {
      combo: [
        mv('ฟันตะวัน', 'slash', [0.08, 0.09, 0.22, 0.38], 1.0, arc(150, 110), { kb: 170, step: 14, burn: true }),
        mv('ฟันจันทร์', 'slashUp', [0.08, 0.09, 0.22, 0.38], 1.0, arc(150, 110), { kb: 170, step: 14, slow: 0.35 }),
        mv('แทงคราส', 'thrust', [0.07, 0.07, 0.24, 0.4], 1.2, arc(190, 26), { kb: 220, step: 26, mark: 0.1 }),
        mv('จันทร์เสี้ยวกวาด', 'spin', [0.12, 0.14, 0.34, 0.7], 1.5, circ(170), { kb: 280, shake: 5, hitStop: 0.07 }),
      ],
      charged: mv('สุริยคราสเต็มดวง', 'overhead', [0.08, 0.1, 0.4, 0.7], 2.4, zone(150, 0.35, 220), { burn: true, stun: 0.6, shake: 8 }),
      dash: mv('พุ่งข้ามขอบฟ้า', 'thrust', [0.03, 0.14, 0.26, 0.5], 1.5, rush(240, 50), { kb: 200 }),
      branch: mv('กลางวันกลางคืน', 'slash', [0.07, 0.1, 0.3, 0.6], 0.9, arc(160, 200), { multi: 2, kb: 140, burn: true, slow: 0.3, hitStop: 0.06 }),
    }),
  w_eclipse_blade: W('w_eclipse_blade', 'greatsword', 'ดาบสุริยคราส', 'mythic', 'rush', { atk: 92, crit: 0.18, critMult: 0.6, hp: 120, def: 10 },
    { form: 'eclipseblade', blade: '#1a1424', edge: '#ffd27a', guard: '#e0b45a', grip: '#2a1410', glow: '#ffb648' },
    'ดาบดำสนิทที่มีวงแสงอาทิตย์ล้อมรอบ ไม่มีบันทึกไหนบอกว่ามันมาจากไหน มีแต่เงาที่รออยู่สุดทางของลานประลองเจ้าแห่งบอส', {
      combo: [
        mv('คราสแรก', 'heavy', [0.1, 0.1, 0.24, 0.42], 1.3, arc(132, 150), { kb: 240, step: 18, burn: true }),
        mv('คราสย้อน', 'heavyUp', [0.1, 0.1, 0.24, 0.42], 1.3, arc(132, 150), { kb: 240, step: 18, slow: 0.3 }),
        mv('วงแหวนดับแสง', 'spin', [0.12, 0.16, 0.3, 0.55], 1.0, circ(160), { multi: 2, kb: 180, hitStop: 0.06 }),
        mv('ตะวันดับ', 'overhead', [0.16, 0.12, 0.42, 0.8], 2.6, zone(170, 0.3, 160), { stun: 0.8, burn: true, shake: 10, hitStop: 0.1 }),
      ],
      charged: mv('คราสเต็มดวง', 'overhead', [0.08, 0.12, 0.46, 0.8], 3.6, proj('bigArrow', 1100, 22, { count: 5, spread: 40, pierce: 99 }), { critBonus: 0.3, burn: true, shake: 12, hitStop: 0.12 }),
      dash: mv('เงาข้ามตะวัน', 'thrust', [0.02, 0.14, 0.28, 0.5], 1.9, rush(260, 70), { kb: 260, teleport: 'behind', forceCrit: true }),
      branch: mv('แสงสุดท้าย', 'heavy', [0.1, 0.12, 0.36, 0.7], 0.9, arc(170, 240), { multi: 4, kb: 160, burn: true, mark: 0.15, hitStop: 0.08, shake: 6 }),
    }, { secret: true, secretUlt: true, unique: 'eclipse', noCraft: true }),
});

// the rare parts the two new lands' bosses leave (village chief recipes use them like the other land parts)
export const MATS_V8 = Object.freeze({
  m_mirror_shard: { id: 'm_mirror_shard', name: 'เศษกระจกราชินี', category: 'material', rarity: 'epic', sellPrice: 150, src: 'z11', art: { kind: 'shard', main: '#bfe8ff' }, desc: 'ชิ้นส่วนจากราชินีกระจกแตก ใช้คราฟ' },
  m_eclipse_core: { id: 'm_eclipse_core', name: 'แกนสุริยคราส', category: 'material', rarity: 'epic', sellPrice: 170, src: 'z12', art: { kind: 'core', main: '#ffb648', glow: '#6a4aa8' }, desc: 'ชิ้นส่วนจากจักรพรรดิสุริยคราส ใช้คราฟ' },
});
