// The worn title (and the honour badge) drawn above a hero's name on the canvas — village, zones and PvP.
import { getTitle, TITLE_TIERS } from '../data/titles.js';

// draws at (x, y) = the baseline above the name; returns how much height it used
export function drawTitleLine(ctx, x, y, titleId, badge = 0) {
  const t = getTitle(titleId);
  if (!t && !badge) return 0;
  ctx.save();
  ctx.font = '700 11.5px "Bai Jamjuree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const text = t ? `« ${t.name} »` : '';
  const tw = text ? ctx.measureText(text).width : 0;
  const bx = x - tw / 2 - (badge ? 12 : 0);
  if (badge) {
    // a small gem with the tier number
    ctx.fillStyle = '#f5c35a'; ctx.strokeStyle = '#120c09'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, y - 13); ctx.lineTo(bx + 7, y - 6); ctx.lineTo(bx, y + 1); ctx.lineTo(bx - 7, y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = '800 9px system-ui, sans-serif'; ctx.fillStyle = '#3a1a0a'; ctx.fillText(String(badge), bx, y - 3);
    ctx.font = '700 11.5px "Bai Jamjuree", system-ui, sans-serif';
  }
  if (t) {
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#120c09'; ctx.fillStyle = TITLE_TIERS[t.t].color;
    ctx.strokeText(text, x + (badge ? 6 : 0), y); ctx.fillText(text, x + (badge ? 6 : 0), y);
  }
  ctx.restore();
  return 15;
}
