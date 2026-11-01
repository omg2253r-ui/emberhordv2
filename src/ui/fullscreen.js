// Full screen: the game fills the whole screen with no browser tabs or address bar.
//   • Desktop and Android browsers: the Fullscreen API (standard or the webkit-prefixed one older Safari/iPad use).
//   • iPhone Safari has no Fullscreen API for pages. The way there is "Add to Home Screen": the game then opens
//     from its own icon with no browser bar (app/manifest.webmanifest + the apple-mobile-web-app tags).
//   • "Auto" mode: browsers only allow full screen after a tap or key press, so the game enters it on the first
//     tap of the session. If the player leaves full screen on purpose, it stays out until they turn it on again.
const doc = typeof document !== 'undefined' ? document : null;
const el = () => doc?.documentElement;

export function fsSupported() {
  if (!doc) return false;
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}
export function isFullscreen() {
  if (!doc) return false;
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}
// opened from a home-screen icon (installed app): already without browser bars
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const mm = (q) => { try { return window.matchMedia(q).matches; } catch { return false; } };
  return mm('(display-mode: fullscreen)') || mm('(display-mode: standalone)') || window.navigator.standalone === true;
}
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPod|iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
// inside another page's frame (e.g. a preview): full screen is decided by that page
export function inFrame() { try { return window.self !== window.top; } catch { return true; } }

export async function enterFullscreen({ landscape = false } = {}) {
  const e = el();
  if (!e || isFullscreen()) return isFullscreen();
  try {
    if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: 'hide' });
    else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen();
    else return false;
  } catch { return false; }
  if (landscape) { try { await screen.orientation?.lock?.('landscape'); } catch { /* phones that cannot lock simply keep the current way up */ } }
  return true;
}
export async function exitFullscreen() {
  if (!isFullscreen()) return true;
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    try { screen.orientation?.unlock?.(); } catch { /* not locked */ }
    return true;
  } catch { return false; }
}
export function onFullscreenChange(fn) {
  if (!doc) return () => {};
  doc.addEventListener('fullscreenchange', fn); doc.addEventListener('webkitfullscreenchange', fn);
  return () => { doc.removeEventListener('fullscreenchange', fn); doc.removeEventListener('webkitfullscreenchange', fn); };
}

// what the settings row should say on this device
export function fsMode() {
  if (isStandalone()) return 'app';            // already full screen from the home-screen icon
  if (fsSupported()) return 'api';
  if (isIOS() && !inFrame()) return 'homescreen';
  return 'none';
}

// Auto full screen on the first tap/key of the session (when the player turned it on).
// `wanted()` reads the saved setting; returns a function that stops listening.
export function armAutoFullscreen(wanted, { landscape = () => false } = {}) {
  if (!doc || fsMode() !== 'api') return () => {};
  let userLeft = false, entered = false;
  const stopChange = onFullscreenChange(() => { if (!isFullscreen() && entered) userLeft = true; if (isFullscreen()) entered = true; });
  const tryEnter = () => {
    if (!wanted() || userLeft || isFullscreen()) return;
    enterFullscreen({ landscape: landscape() });
  };
  const opts = { capture: true };
  window.addEventListener('pointerup', tryEnter, opts);
  window.addEventListener('keyup', tryEnter, opts);
  return () => { stopChange(); window.removeEventListener('pointerup', tryEnter, opts); window.removeEventListener('keyup', tryEnter, opts); };
}
// turning the setting on again by hand clears "the player left on purpose"
export function resetAutoFullscreen(stop, wanted, opts) { stop?.(); return armAutoFullscreen(wanted, opts); }
