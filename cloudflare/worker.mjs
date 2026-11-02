// Emberhold on Cloudflare: /api/hub, /api/docs, /api/cloud (D1), /api/rt (Durable Object relay) and the static game (ASSETS).
// Everything else — game rules, saves, rankings — is imported from src/ and netlify/lib/, so a deploy always uses the CURRENT code.
import { handleHub } from '../netlify/lib/hub.mjs';
import { handleDocs } from '../netlify/lib/docs.mjs';
import { handleCloud } from '../netlify/lib/cloud.mjs';
import { kv, docs } from './d1.mjs';
import { handleRt, RelayHub } from './relay.mjs';
import { handleMigrate } from './migrate.mjs';
import { SITE_HEADERS } from './headers.mjs';

export { RelayHub };

const SITE = SITE_HEADERS;
function withHeaders(res, extra = {}) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SITE, ...extra })) out.headers.set(k, v);
  return out;
}
const noDb = () => new Response(JSON.stringify({ ok: false, reason: "no_database" }), { status: 503, headers: { "content-type": "application/json" } });
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    let ip = req.headers.get("cf-connecting-ip") || "";
    // The Netlify site forwards /api/cloud and /api/docs here (netlify/lib/proxy.mjs). With the shared secret PROXY_KEY it
    // also says which player IP the request came from, so rate limits stay per player instead of one bucket for Netlify.
    const pk = req.headers.get("x-emberhold-proxy-key") || "";
    if (env.PROXY_KEY && pk.length === String(env.PROXY_KEY).length && [...pk].reduce((d, c, i) => d | c.charCodeAt(0) ^ String(env.PROXY_KEY).charCodeAt(i), 0) === 0) {
      const fwd = (req.headers.get("x-emberhold-ip") || "").trim();
      if (/^[0-9a-fA-F:.]{3,45}$/.test(fwd)) ip = fwd;
    }
    if (url.pathname === "/api/rt") return handleRt(req, env);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) return withHeaders(noDb(), { "cache-control": "no-store" });
      let res;
      try {
        if (url.pathname === "/api/hub") res = await handleHub(req, kv(env.DB, "hub"), Date.now(), { ip });
        else if (url.pathname === "/api/docs") res = await handleDocs(req, docs(env.DB), kv(env.DB, "hub"), { ip });
        else if (url.pathname === "/api/cloud") res = await handleCloud(req, kv(env.DB, "cloud"), Date.now(), { ip });
        else if (url.pathname === "/api/migrate") res = await handleMigrate(req, env, kv(env.DB, "cloud"));
        else res = new Response("not found", { status: 404 });
      } catch (e) {
        res = new Response(JSON.stringify({ ok: false, reason: "server_error" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      return withHeaders(res, { "cache-control": "no-store" });
    }
    return withHeaders(await env.ASSETS.fetch(req));
  }
};
