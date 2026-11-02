import { DurableObject } from 'cloudflare:workers';
import { WORLD_RE, PEER_RE, KEY_RE, BUCKET_MS, hash, parseLive } from '../netlify/lib/hub.mjs';
import { kv } from './d1.mjs';

// cloudflare/relay.mjs (v9.4) — real-time relay between players.
// The hub above is a mailbox in D1 that pages poll every second or more: fine for "who is online", far too slow for
// playing together. This Durable Object keeps one WebSocket per player and forwards messages straight to the
// addressed player (a few tens of ms). It stores nothing and never reads game data: it only moves {to, items} →
// {from, items}. A page proves it owns its peer id by the same key the hub checks (see handleRt).
var RT_PEER_RE = /^[a-z0-9]{8,24}$/;
export class RelayHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = /* @__PURE__ */ new Map();
  }
  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected_websocket", { status: 426 });
    const peer = req.headers.get("x-rt-peer") || "";
    const h = req.headers.get("x-rt-h") || "";
    if (!RT_PEER_RE.test(peer) || !h) return new Response("bad_request", { status: 400 });
    const old = this.ctx.getWebSockets(peer);
    for (const o of old) {
      const a = o.deserializeAttachment();
      if (a && a.h !== h) return new Response("peer_taken", { status: 403 });
    }
    for (const o of old) {
      try {
        o.close(1000, "replaced");
      } catch {
      }
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [peer]);
    server.serializeAttachment({ peer, h });
    const others = [];
    for (const s of this.ctx.getWebSockets()) {
      if (s === server) continue;
      const a = s.deserializeAttachment();
      if (a && a.peer !== peer && !others.includes(a.peer) && others.length < 200) others.push(a.peer);
    }
    try {
      server.send(JSON.stringify({ ev: "peers", list: others }));
    } catch {
    }
    this.tell({ ev: "join", peer }, peer);
    return new Response(null, { status: 101, webSocket: client });
  }
  tell(msg, exceptPeer) {
    const text = JSON.stringify(msg);
    for (const s of this.ctx.getWebSockets()) {
      const a = s.deserializeAttachment();
      if (!a || a.peer === exceptPeer) continue;
      try {
        s.send(text);
      } catch {
      }
    }
  }
  webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > 96 * 1024) return;
    const a = ws.deserializeAttachment();
    if (!a) return;
    const now = Date.now();
    let r = this.rate.get(a.peer);
    if (!r || now - r.t > 1e3) {
      if (this.rate.size > 500) this.rate.clear();
      r = { t: now, n: 0 };
      this.rate.set(a.peer, r);
    }
    if (++r.n > 400) return;
    let o;
    try {
      o = JSON.parse(msg);
    } catch {
      return;
    }
    if (!o || typeof o.to !== "string" || !RT_PEER_RE.test(o.to) || o.to === a.peer || !Array.isArray(o.items) || !o.items.length) return;
    const out = JSON.stringify({ from: a.peer, items: o.items.slice(0, 300) });
    for (const t of this.ctx.getWebSockets(o.to)) {
      try {
        t.send(out);
      } catch {
      }
    }
  }
  gone(ws) {
    const a = ws.deserializeAttachment();
    try {
      ws.close(1000, "bye");
    } catch {
    }
    if (!a) return;
    const stillHere = this.ctx.getWebSockets(a.peer).some((s) => s !== ws && s.readyState === 1);
    if (!stillHere) this.tell({ ev: "leave", peer: a.peer }, a.peer);
  }
  webSocketClose(ws) {
    this.gone(ws);
  }
  webSocketError(ws) {
    this.gone(ws);
  }
}
export async function handleRt(req, env) {
  const no = (status, reason) => new Response(reason, { status });
  if (req.headers.get("Upgrade") !== "websocket") return no(426, "expected_websocket");
  if (!env.RELAY || !env.DB) return no(501, "no_relay");
  try {
    const u = new URL(req.url);
    const world = u.searchParams.get("world") || "";
    const peer = u.searchParams.get("peer") || "";
    const key = u.searchParams.get("key") || "";
    if (!WORLD_RE.test(world) || !PEER_RE.test(peer) || !KEY_RE.test(key)) return no(400, "bad_request");
    const store = kv(env.DB, "hub");
    const myHash = hash("peer:" + key).slice(0, 16);
    const bucket = Math.floor(Date.now() / BUCKET_MS);
    const [cur, prev] = await Promise.all([store.list(`live/${world}/${bucket}/`), store.list(`live/${world}/${bucket - 1}/`)]);
    const mine = [...cur, ...prev].map(parseLive).filter(Boolean).filter((e) => e.peer === peer);
    if (!mine.length || mine.some((e) => e.h !== myHash)) return no(403, "peer_unknown");
    const stub = env.RELAY.get(env.RELAY.idFromName("rt:" + world));
    const fwd = new Request(req);
    fwd.headers.set("x-rt-peer", peer);
    fwd.headers.set("x-rt-h", myHash);
    return await stub.fetch(fwd);
  } catch {
    return no(500, "server_error");
  }
}
