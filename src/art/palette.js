// Shared art palette. "Ink & lacquer": warm ink outlines, muted forest greens, vermilion and gold leaf.
export const INK = '#241712';
export const PAL = Object.freeze({
  ink: INK,
  inkSoft: '#3a2a22',
  cream: '#f3e6c8',
  skin: '#f0cfa6',
  skinShade: '#d9a982',
  vermilion: '#c2412f',
  vermilionDark: '#8e2c21',
  gold: '#e0b45a',
  goldDark: '#a77a2c',
  teal: '#3f6b67',
  tealDark: '#2a4a48',
  moss: '#6f9a4a',
  mossDark: '#4b6e33',
  mossLight: '#a5c76c',
  bark: '#5a3b2a',
  barkDark: '#3c271c',
  ground: '#3b4a2c',
  groundLight: '#4f6136',
  groundDark: '#2c3822',
  danger: '#e0503a',
  white: '#fff8ea',
});

// Outline attributes used by every drawing so the whole game shares one line weight.
export const OUT = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
export const OUT_THIN = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
