// Netlify build: copy only what the browser needs into dist/ (the game is plain ES modules, no bundling).
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_HEADERS } from '../cloudflare/headers.mjs';

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
// Cloudflare Workers (static assets): security headers for every page come from dist/_headers
await writeFile(join(OUT, '_headers'), '/*\n' + Object.entries(SITE_HEADERS).map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n');
console.log('Emberhold site built into dist/');
