// v9 Egypt companions. Each borrows the body plan of an existing pet (so the art always draws) and an existing ability kind.
import { PETS_V7 } from './pets2.js';
const all = Object.values(PETS_V7);
const planOf = (plan) => all.find((p) => p.art?.plan === plan);
const kindOf = (kind) => all.find((p) => p.ability?.kind === kind);
const make = (id, name, rarity, role, desc, plan, colors, kind, abName) => {
  const a = planOf(plan), b = kindOf(kind);
  if (!a || !b) return null;
  return [id, { id, name, rarity, role, sprite: 'pet_' + id, desc, art: { ...a.art, ...colors }, ability: { ...b.ability, name: abName }, text: b.text }];
};
export const PETS_EGYPT = Object.freeze(Object.fromEntries([
  make('jackal_cub', 'ลูกหมาป่าอนูบิส', 'rare', 'ซุ่มโจมตี', 'ลูกหมาป่าดำที่เฝ้าหลุมฝังศพ ซุ่มกัดจุดอ่อนของศัตรูที่บาดเจ็บ', 'quad', { c1: '#2a3048', c2: '#e0b45a', c3: '#7fe8ff' }, 'ambush', 'เขี้ยวเงาสุสาน'),
  make('gold_scarab', 'ด้วงทองสุริยะ', 'epic', 'โจมตีรอบตัว', 'ด้วงทองที่เชื่อว่าพาตะวันขึ้นทุกเช้า บินวนรอบเจ้านายตัดทุกสิ่งที่เข้าใกล้', 'insect', { c1: '#e0b45a', c2: '#fff3c4', c3: '#7fe8ff' }, 'orbit', 'ปีกทองวนตะวัน'),
  make('horus_hawk', 'เหยี่ยวดวงตาฮอรัส', 'epic', 'ยิงแสง', 'เหยี่ยวที่มองเห็นทุกสิ่งจากฟ้า ยิงลูกแสงเป็นพัดใส่ศัตรู', 'bird', { c1: '#2a3048', c2: '#e8f6ff', c3: '#ffcf5a' }, 'fan', 'ขนเหยี่ยวแสงตะวัน'),
  make('uraeus_cobra', 'งูเห่าอูราอุส', 'legendary', 'ศักดิ์สิทธิ์', 'งูเห่าบนมงกุฎฟาโรห์ ขดตัวเป็นวงศักดิ์สิทธิ์ที่ลดความเสียหายและฟื้นพลังให้เจ้านาย', 'serpent', { c1: '#e0b45a', c2: '#fff3c4', c3: '#ff5a3a' }, 'sanctuary', 'วงอูราอุสคุ้มภัย'),
].filter(Boolean)));
