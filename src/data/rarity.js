export const RARITIES = Object.freeze({
  common:    { id: 'common',    name: 'ธรรมดา',   order: 0, color: '#c9bfa9' },
  uncommon:  { id: 'uncommon',  name: 'ประณีต',   order: 1, color: '#7fc77a' },
  rare:      { id: 'rare',      name: 'หายาก',    order: 2, color: '#5fa8ec' },
  epic:      { id: 'epic',      name: 'ล้ำค่า',    order: 3, color: '#c27ff0' },
  legendary: { id: 'legendary', name: 'ตำนาน',    order: 4, color: '#f2b544' },
  mythic:    { id: 'mythic',    name: 'เทพตำนาน', order: 5, color: '#ff5f7a' },
});

export function rarityOf(id) {
  return RARITIES[id] || RARITIES.common;
}
