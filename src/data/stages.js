// Stage (map) metadata. Each stage is an explorable dungeon defined in data/dungeons.js.
// `requires` names the stage that must be cleared first (null = open from the start).

export const STAGES = Object.freeze([
  {
    id: 's1', name: 'ป่าหนามสนธยา', theme: 'thornwood', requires: null, recommendedLevel: 1,
    desc: 'ป่าที่เคยเป็นป่าอำพัน ลานบูชาเก่าซ่อนอยู่หลังประตูผนึก หากุญแจจากผู้เฝ้า แล้วเผชิญหน้ากับหมูป่าหลังหนาม',
  },
  {
    id: 's2', name: 'เหมืองถ่านร้าง', theme: 'cinder', requires: 's1', recommendedLevel: 5,
    desc: 'เหมืองที่ไฟใต้ดินไม่เคยดับ มีช่องไฟและหินถล่ม ภูตถ่านแดงยิงลูกไฟจากระยะไกล ฟันลูกไฟทิ้งได้ด้วยดาบ',
  },
]);

export function getStage(id) {
  return STAGES.find((s) => s.id === id) || null;
}
