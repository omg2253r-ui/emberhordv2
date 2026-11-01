// Camp: an animated dusk campsite behind the menus (tent, campfire, Lek's forge, the hunter idling).
import { drawHero } from '../battle/heroDraw.js';
import { getItem } from '../data/items.js';
import { getWeaponType } from '../data/weapons.js';
import { getPet } from '../data/pets.js';

export function createCampScene(app) {
  const { renderer, sprites, audio } = app;
  const ctx = renderer.ctx;
  let t = 0;
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.45, p: Math.random() * 6, s: 0.6 + Math.random() * 1.2 });
  let sky = null, skyKey = '';

  function paintSky(w, h) {
    const key = `${w}x${h}`;
    if (key === skyKey) return;
    skyKey = key;
    sky = document.createElement('canvas');
    sky.width = Math.max(1, Math.round(w)); sky.height = Math.max(1, Math.round(h));
    const g = sky.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#191428'); grad.addColorStop(0.45, '#3b2a3c'); grad.addColorStop(0.7, '#8a4a34'); grad.addColorStop(0.78, '#c47a3e'); grad.addColorStop(1, '#2a2116');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // layered forest silhouettes
    const layers = [['#2c2230', 0.58, 70], ['#221a22', 0.64, 50], ['#17120f', 0.7, 36]];
    for (const [col, base, amp] of layers) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w + 20; x += 16) {
        const y = h * base - Math.abs(Math.sin(x * 0.013 + base * 9)) * amp - Math.abs(Math.sin(x * 0.041 + base)) * amp * 0.5;
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.fill();
    }
    g.fillStyle = '#231b14'; g.fillRect(0, h * 0.7, w, h * 0.3);
    const gg = g.createLinearGradient(0, h * 0.7, 0, h);
    gg.addColorStop(0, '#3a2c1c'); gg.addColorStop(1, '#16110c');
    g.fillStyle = gg; g.fillRect(0, h * 0.7, w, h * 0.3);
  }

  function render() {
    const v = renderer.view;
    renderer.screenSpace();
    paintSky(v.w, v.h);
    ctx.drawImage(sky, 0, 0, v.w, v.h);
    for (const s of stars) {
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 * s.s + s.p));
      ctx.fillStyle = '#f3e6c8'; ctx.fillRect(s.x * v.w, s.y * v.h, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // Scene composition: centred on the left on wide screens (panels sit on the right).
    const wide = v.w > 900;
    const groundY = v.h * (wide ? 0.82 : 0.5);
    const cx = wide ? v.w * 0.32 : v.w * 0.5;
    const sc = Math.max(0.55, Math.min(1.25, (wide ? v.h : v.h * 0.6) / 620));
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(sc, sc);

    const fireX = 40, fireY = 10;
    // firelight on the ground
    const flick = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
    const light = ctx.createRadialGradient(fireX, fireY, 10, fireX, fireY, 340 * flick);
    light.addColorStop(0, 'rgba(255,170,80,0.45)'); light.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(fireX, fireY, 360, 150, 0, 0, Math.PI * 2); ctx.fill();

    renderer.sprite(sprites.tent, -230, -10, { sx: 1.1, sy: 1.1 });
    renderer.sprite(sprites.lantern, -95, 0);
    renderer.sprite(sprites.crates, 290, 18);
    renderer.sprite(sprites.anvil, 190, 30);
    renderer.sprite(sprites.tree0, 380, -40, { sx: 1.1, sy: 1.1, flip: true });
    // lantern glow
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(-62, -110, 2, -62, -110, 50);
    lg.addColorStop(0, 'rgba(255,220,150,0.6)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(-62, -110, 50, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // campfire logs + flames
    ctx.fillStyle = '#4a3020'; ctx.strokeStyle = '#241712'; ctx.lineWidth = 3;
    for (const a of [-0.35, 0.35]) { ctx.save(); ctx.translate(fireX, fireY + 4); ctx.rotate(a); ctx.beginPath(); ctx.roundRect(-34, -6, 68, 12, 6); ctx.fill(); ctx.stroke(); ctx.restore(); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#6c6f62'; ctx.beginPath(); ctx.ellipse(fireX + Math.cos(i) * 40, fireY + 8 + Math.sin(i) * 10, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    const flames = [['#c2412f', 1], ['#ff8a3d', 0.75], ['#ffd889', 0.45]];
    for (const [col, k] of flames) {
      ctx.fillStyle = col; ctx.beginPath();
      const hgt = 70 * k * (0.9 + 0.12 * Math.sin(t * 11 * k));
      ctx.moveTo(fireX - 26 * k, fireY);
      ctx.quadraticCurveTo(fireX - 30 * k, fireY - hgt * 0.5, fireX + Math.sin(t * 7) * 6 * k, fireY - hgt);
      ctx.quadraticCurveTo(fireX + 30 * k, fireY - hgt * 0.5, fireX + 26 * k, fireY);
      ctx.closePath(); ctx.fill();
    }
    if (Math.random() < 0.3) app.particles.spawn({ x: fireX + (Math.random() - 0.5) * 30, y: fireY - 40, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, life: 1.2, size: 2, size2: 0.5, color: '#ffb35a', drag: 0.5, glow: true });
    app.particles.draw(ctx);

    // the hunter, warming up by the fire
    ctx.fillStyle = 'rgba(12,8,6,0.4)'; ctx.beginPath(); ctx.ellipse(-60, 34, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
    const st = app.store.get();
    const type = getWeaponType(getItem(st.equipment.weapon?.id)?.wtype);
    drawHero(renderer, sprites.heroParts, sprites.weapon, { x: -60, y: 34, flip: false, time: t, walkT: 0, moving: false, type, scale: 1.25 });
    // the companion pet rests (or hovers) beside the hunter
    const pet = getPet(st.pets?.active);
    if (pet && sprites[pet.sprite]) {
      const s = sprites[pet.sprite], fly = pet.flying;
      const px = -150, py = 46, z = fly ? 46 + Math.sin(t * 3) * 6 : 0;
      ctx.fillStyle = 'rgba(12,8,6,0.35)'; ctx.beginPath(); ctx.ellipse(px, py, s.w * 0.3, 6, 0, 0, Math.PI * 2); ctx.fill();
      const breathe = fly ? 1 : 1 + Math.sin(t * 2.2) * 0.03;
      renderer.sprite(s, px, py - z, { sx: 1.05 * breathe, sy: 1.05 / breathe });
    }
    // Lek at his anvil, hammer resting on his shoulder
    ctx.fillStyle = 'rgba(12,8,6,0.4)'; ctx.beginPath(); ctx.ellipse(262, 46, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    renderer.sprite(sprites.lek, 262, 46 + Math.sin(t * 1.6) * 0.6, { sx: -1.1, sy: 1.1 });
    ctx.restore();

    if (app.vignette) ctx.drawImage(app.vignette, 0, 0, v.w, v.h);
  }

  return {
    enter() { app.particles.clear(); audio.music('camp'); app.refreshHeroSprites(); },
    exit() { audio.stopMusic(); },
    update(dt) { t += dt; app.particles.update(dt); },
    render,
  };
}
