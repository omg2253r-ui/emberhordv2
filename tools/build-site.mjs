// Netlify build: copy only what the browser needs into dist/ (the game is plain ES modules, no bundling).
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'dist');
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const p of ['index.html', 'css', 'src', 'app']) await cp(join(ROOT, p), join(OUT, p), { recursive: true });
// the wiki (/wiki/) is rebuilt from the game's own source on every deploy, so it always matches the game
await import('./gen-wiki.mjs'); // writes wiki/data.json from src/data/*
await cp(join(ROOT, 'wiki'), join(OUT, 'wiki'), { recursive: true });
// mark the page as having the online hub (/api/hub, /api/docs), so the game connects instead of staying offline
const page = join(OUT, 'index.html');
await writeFile(page, (await readFile(page, 'utf8')).replace('<head>', '<head>\n  <meta name="emberhold-hub" content="/api">'));
// Cloudflare Pages (v8): the online code runs as dist/_worker.js (advanced mode); Netlify never gets this file
if (process.env.CF_PAGES) await cp(join(ROOT, 'cloudflare/_worker.js'), join(OUT, '_worker.js'));

// Cloudflare Workers (static assets): security headers for every page come from dist/_headers
await writeFile(join(OUT, '_headers'), `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
`);
console.log('Emberhold site built into dist/');
