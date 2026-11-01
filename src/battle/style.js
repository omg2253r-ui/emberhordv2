// Style rank: rewards fighting with variety and defence, not button mashing.
// Points come from landing hits (more when the move kind changes), counters, parries and perfect dodges; getting
// hit halves them, idling bleeds them. The rank adds damage (up to +22% at SS) and is shown beside the combo count.
export const RANKS = Object.freeze([
  { id: 'D', at: 0, bonus: 0, color: '#b3a185', name: 'เริ่มต้น' },
  { id: 'C', at: 120, bonus: 0.03, color: '#9fd8a0', name: 'คล่อง' },
  { id: 'B', at: 300, bonus: 0.06, color: '#7fc0ef', name: 'เฉียบ' },
  { id: 'A', at: 560, bonus: 0.1, color: '#c9a2f5', name: 'ดุดัน' },
  { id: 'S', at: 880, bonus: 0.15, color: '#f5c35a', name: 'ไร้เทียมทาน' },
  { id: 'SS', at: 1280, bonus: 0.22, color: '#ff7a5a', name: 'ตำนาน' },
]);
const MAX = 1700;
const POINTS = { branch: 34, combo: 10, charged: 32, dash: 26, skill: 22, proj: 9, race: 24, counter: 90, parry: 70, perfect: 60, block: 6, break: 80, kill: 12 };

export function createStyle() { return { pts: 0, idle: 0, recent: [], rank: 0, best: 0 }; }

export function styleEvent(s, kind) {
  if (!s) return null;
  const base = POINTS[kind] ?? 8;
  // variety: a kind not used in the last four events counts half again; spamming one kind counts less
  const fresh = !s.recent.includes(kind);
  const spam = s.recent.length >= 4 && s.recent.every((k) => k === kind);
  const gain = base * (fresh ? 1.5 : spam ? 0.5 : 1);
  s.recent.push(kind); if (s.recent.length > 4) s.recent.shift();
  s.pts = Math.min(MAX, s.pts + gain);
  s.idle = 0;
  return bump(s);
}

export function styleHurt(s) { if (!s) return; s.pts *= 0.5; s.recent.length = 0; s.rank = rankIndex(s.pts); }

export function styleTick(s, dt) {
  if (!s) return;
  s.idle += dt;
  if (s.idle > 2.5 && s.pts > 0) { s.pts = Math.max(0, s.pts - dt * (55 + s.rank * 25)); s.rank = rankIndex(s.pts); }
}

function rankIndex(pts) { let i = 0; for (let k = 0; k < RANKS.length; k++) if (pts >= RANKS[k].at) i = k; return i; }

// returns the new rank when it went up (for a callout), else null
function bump(s) {
  const i = rankIndex(s.pts);
  const up = i > s.rank;
  s.rank = i; s.best = Math.max(s.best, i);
  return up ? RANKS[i] : null;
}

export const styleRank = (s) => RANKS[s ? s.rank : 0];
export const styleBonus = (s) => (s ? RANKS[s.rank].bonus : 0);
export function styleProgress(s) {
  if (!s) return 0;
  const cur = RANKS[s.rank], next = RANKS[s.rank + 1];
  return next ? (s.pts - cur.at) / (next.at - cur.at) : 1;
}
// what kind of event a landed hit is
export function hitKind(p, o) {
  if (o.counter) return 'counter';
  if (o.src === 'skill' || o.src === 'race') return o.src;
  return p.move?.kind || (o.src === 'proj' ? 'proj' : 'combo');
}
