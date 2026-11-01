// Unified input: keyboard, mouse/pointer on the canvas, and on-screen touch controls.
// Gameplay reads `intent` only, so all devices behave the same.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'attack', Space: 'attack', KeyK: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash', KeyQ: 'potion', Escape: 'pause', KeyP: 'pause',
  KeyL: 'guard', KeyC: 'guard',
  Digit1: 'skill0', Digit2: 'skill1', Digit3: 'skill2', KeyU: 'skill0', KeyI: 'skill1', KeyO: 'skill2', KeyE: 'interact', KeyF: 'interact', KeyR: 'race', Digit4: 'race', KeyG: 'ult', Digit5: 'ult',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();     // edge-triggered this frame
  const intent = { mx: 0, my: 0, attack: false, attackHeld: false, dash: false, potion: false, pause: false, aim: null, skill: -1, interact: false, interactHeld: false, race: false, guard: false, ult: false };
  const stick = { active: false, x: 0, y: 0 };  // virtual joystick (-1..1)
  const virtualHeld = new Set();
  let enabled = false;
  let pointerAim = null;

  const isTyping = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  function onKeyDown(e) {
    const a = KEYMAP[e.code];
    if (!a || isTyping(e)) return;
    if (enabled) e.preventDefault();
    if (!held.has(a)) pressed.add(a);
    held.add(a);
  }
  function onKeyUp(e) { const a = KEYMAP[e.code]; if (a) held.delete(a); }
  function onBlur() { held.clear(); virtualHeld.clear(); stick.active = false; stick.x = stick.y = 0; }
  function onPointerDown(e) {
    if (!enabled || e.pointerType === 'touch') return;
    if (e.button === 2) { virtualHeld.add('guard'); return; }        // right mouse button: guard
    if (e.button !== 0) return;
    pointerAim = { sx: e.offsetX, sy: e.offsetY };
    pressed.add('attack'); virtualHeld.add('attack');
  }
  function onPointerUp(e) { if (e.pointerType !== 'touch') { if (e.button === 2) virtualHeld.delete('guard'); else virtualHeld.delete('attack'); } }
  function onContextMenu(e) { if (enabled) e.preventDefault(); }
  function onPointerMove(e) { if (e.pointerType !== 'touch' && virtualHeld.has('attack')) pointerAim = { sx: e.offsetX, sy: e.offsetY }; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    intent, stick,
    setEnabled(v) { enabled = v; if (!v) onBlur(); },
    // Touch buttons call these
    press(action) { pressed.add(action); virtualHeld.add(action); },
    release(action) { virtualHeld.delete(action); },
    // Build this frame's intent
    poll() {
      let mx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      let my = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      if (stick.active) { mx = stick.x; my = stick.y; }
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      intent.mx = mx; intent.my = my;
      intent.attack = pressed.has('attack');
      intent.attackHeld = held.has('attack') || virtualHeld.has('attack');
      intent.dash = pressed.has('dash');
      intent.potion = pressed.has('potion');
      intent.pause = pressed.has('pause');
      intent.skill = pressed.has('skill0') ? 0 : pressed.has('skill1') ? 1 : pressed.has('skill2') ? 2 : -1;
      intent.interact = pressed.has('interact');
      intent.interactHeld = held.has('interact') || virtualHeld.has('interact');   // revive: hold for 7 seconds
      intent.race = pressed.has('race');
      intent.ult = pressed.has('ult');
      intent.guard = held.has('guard') || virtualHeld.has('guard');
      intent.aim = pointerAim; pointerAim = virtualHeld.has('attack') ? pointerAim : null;
      pressed.clear();
      return intent;
    },
    reset() { onBlur(); pressed.clear(); },
    destroy() {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur); canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}
