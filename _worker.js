import { Buffer } from 'node:buffer';
import { DurableObject } from "cloudflare:workers";

// <define:__SITE_HEADERS__>
var define_SITE_HEADERS_default = { "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'none'", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()", "Cross-Origin-Opener-Policy": "same-origin" };

// netlify/lib/hub.mjs
import { createHash } from "node:crypto";
var BUCKET_MS = 1e4;
var MAIL_TTL_MS = 12e4;
var PEER_RE = /^[a-z0-9]{8,24}$/;
var WORLD_RE = /^[a-z0-9]{1,16}$/;
var MAX_BODY = 256 * 1024;
var MAX_TARGETS = 40;
var MAX_ITEMS = 300;
var MAX_MAIL = 96 * 1024;
var MAX_READ = 60;
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
var rand = () => Math.random().toString(36).slice(2, 8);
var stamp = (t) => t.toString(36).padStart(9, "0");
async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}
var RATE = /* @__PURE__ */ new Map();
function limited(key, max, windowMs, now) {
  const r = RATE.get(key);
  if (!r || now - r.t > windowMs) {
    RATE.set(key, { n: 1, t: now });
    if (RATE.size > 5e3) RATE.clear();
    return false;
  }
  r.n += 1;
  return r.n > max;
}
var UID_RE = /^u[a-z0-9]{14}$/;
var KEY_RE = /^[A-Za-z0-9_-]{20,64}$/;
var hash = (s) => createHash("sha256").update(String(s)).digest("hex");
var liveKey = (world, bucket, peer, uid, h) => `live/${world}/${bucket}/${peer}~${uid || "_"}~${h}`;
function parseLive(k) {
  const [peer, uid, h] = k.slice(k.lastIndexOf("/") + 1).split("~");
  return PEER_RE.test(peer || "") ? { peer, uid: UID_RE.test(uid || "") ? uid : null, h: h || "", key: k } : null;
}
async function verifyUid(store, uid, ukey) {
  if (!UID_RE.test(uid || "") || !KEY_RE.test(ukey || "")) return false;
  const uh = hash("uid:" + ukey);
  const stored = await store.get(`auth/uid/${uid}`);
  if (!stored) {
    await store.set(`auth/uid/${uid}`, uh);
    return true;
  }
  return stored === uh;
}
async function handleHub(req, store, now = Date.now(), ctx = {}) {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (ctx.ip && limited("ip:" + ctx.ip, 900, 1e4, now)) return json({ error: "rate_limited" }, 429);
  const body = await readBody(req);
  if (!body) return json({ error: "bad_request" }, 400);
  const world = WORLD_RE.test(body.world || "") ? body.world : null;
  const peer = PEER_RE.test(body.peer || "") ? body.peer : null;
  const key = KEY_RE.test(body.key || "") ? body.key : null;
  if (!world || !peer || !key) return json({ error: "bad_request" }, 400);
  if (limited("peer:" + peer, 40, 1e4, now)) return json({ error: "rate_limited" }, 429);
  const bucket = Math.floor(now / BUCKET_MS);
  const myHash = hash("peer:" + key).slice(0, 16);
  const [cur, prev] = await Promise.all([store.list(`live/${world}/${bucket}/`), store.list(`live/${world}/${bucket - 1}/`)]);
  const entries = [...cur, ...prev].map(parseLive).filter(Boolean);
  const mine = entries.filter((e) => e.peer === peer);
  if (mine.some((e) => e.h !== myHash)) return json({ error: "peer_taken" }, 403);
  if (body.leave) {
    await Promise.all(mine.map((e) => store.delete(e.key)));
    return json({ ok: true });
  }
  let uid = null;
  const wantUid = UID_RE.test(body.uid || "") && KEY_RE.test(body.ukey || "") ? body.uid : null;
  if (wantUid) {
    if (mine.some((e) => e.uid === wantUid) || await verifyUid(store, wantUid, body.ukey)) uid = wantUid;
  }
  const k = liveKey(world, bucket, peer, uid, myHash);
  if (!cur.includes(k)) {
    await store.set(k, String(now));
    await Promise.all(mine.filter((e) => e.key.startsWith(`live/${world}/${bucket}/`) && e.key !== k).map((e) => store.delete(e.key)));
  }
  const writes = [];
  for (const s of Array.isArray(body.send) ? body.send.slice(0, MAX_TARGETS) : []) {
    if (!s || !PEER_RE.test(s.to || "") || s.to === peer || !Array.isArray(s.items) || !s.items.length) continue;
    const text = JSON.stringify({ from: peer, items: s.items.slice(0, MAX_ITEMS) });
    if (text.length > MAX_MAIL) continue;
    writes.push(store.set(`box/${s.to}/${stamp(now)}-${rand()}`, text));
  }
  await Promise.all(writes);
  const seen = /* @__PURE__ */ new Map();
  for (const e of entries) if (e.peer !== peer && (!seen.has(e.peer) || e.uid && !seen.get(e.peer).uid)) seen.set(e.peer, e);
  const peers = [...seen.values()].map((e) => ({ p: e.peer, u: e.uid }));
  const keys = (await store.list(`box/${peer}/`)).sort().slice(0, MAX_READ);
  const mail = [];
  const texts = await Promise.all(keys.map((k2) => store.get(k2)));
  await Promise.all(keys.map((k2) => store.delete(k2)));
  for (const t of texts) {
    if (!t) continue;
    try {
      const m = JSON.parse(t);
      if (m && PEER_RE.test(m.from || "") && Array.isArray(m.items)) mail.push(m);
    } catch {
    }
  }
  if (body.sweep || Math.random() < 0.03) await sweep(store, world, now).catch(() => {
  });
  return json({ peers, mail, now, uid, more: keys.length === MAX_READ });
}
async function sweep(store, world, now = Date.now()) {
  const bucket = Math.floor(now / BUCKET_MS);
  const dead = [];
  for (const k of await store.list(`live/${world}/`)) {
    const b = Number(k.split("/")[2]);
    if (!(b >= bucket - 1)) dead.push(k);
  }
  for (const k of await store.list("box/")) {
    const t = parseInt(k.split("/")[2], 36);
    if (!(now - t < MAIL_TTL_MS)) dead.push(k);
  }
  await Promise.all(dead.slice(0, 500).map((k) => store.delete(k)));
  return dead.length;
}

// netlify/lib/guildRules.mjs
var GUILD_MAX = 30;
var NOTICE_MAX = 140;
var INVITE_TTL = 10 * 6e4;
var ROLES = { leader: 3, officer: 2, member: 1 };
var GID_RE = /^g[a-z0-9]{6,16}$/;
var UID_RE2 = /^u[a-z0-9]{14}$/;
var strip = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
var cleanGuildName = (raw) => {
  const s = Array.from(strip(raw)).slice(0, 16).join("");
  return Array.from(s).length >= 3 ? s : null;
};
var cleanTag = (raw) => {
  const a = Array.from(strip(raw).replace(/[^A-Za-z0-9ก-๙]/g, "")).slice(0, 4).join("");
  return Array.from(a).length >= 2 ? a.toUpperCase() : null;
};
var cleanHero = (raw) => Array.from(strip(raw)).slice(0, 16).join("") || "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32";
var isGid = (v) => typeof v === "string" && GID_RE.test(v);
var isUid = (v) => typeof v === "string" && UID_RE2.test(v);
function successor(g, leaving) {
  const rest = Object.entries(g.members).filter(([u]) => u !== leaving);
  if (!rest.length) return null;
  rest.sort((a, b) => ROLES[b[1].role] - ROLES[a[1].role] || a[1].at - b[1].at);
  return rest[0][0];
}
function applyGuildOp(doc, op, actor, args, now = Date.now()) {
  const g = doc && !doc.disbanded ? structuredClone(doc) : null;
  if (op === "create") {
    if (g) return { ok: false, reason: "exists" };
    const name = cleanGuildName(args.name), tag = cleanTag(args.tag);
    if (!name) return { ok: false, reason: "bad_name" };
    if (!tag) return { ok: false, reason: "bad_tag" };
    return { ok: true, doc: { name, tag, notice: "", leader: actor, created: now, members: { [actor]: { name: cleanHero(args.hero), role: "leader", at: now } }, invites: {} } };
  }
  if (!g) return { ok: false, reason: "no_guild" };
  g.members ||= {};
  g.invites ||= {};
  for (const [u, t] of Object.entries(g.invites)) if (!(t > now)) delete g.invites[u];
  const me = g.members[actor];
  const target = args.target;
  const them = isUid(target) ? g.members[target] : null;
  switch (op) {
    case "invite": {
      if (!me) return { ok: false, reason: "not_member" };
      if (!isUid(target) || them) return { ok: false, reason: "bad_target" };
      if (Object.keys(g.invites).length >= 50) return { ok: false, reason: "too_many_invites" };
      g.invites[target] = now + INVITE_TTL;
      return { ok: true, doc: g };
    }
    case "join": {
      if (me) return { ok: false, reason: "already_in_guild" };
      if (!(g.invites[actor] > now)) return { ok: false, reason: "not_invited" };
      if (Object.keys(g.members).length >= GUILD_MAX) return { ok: false, reason: "guild_full" };
      delete g.invites[actor];
      g.members[actor] = { name: cleanHero(args.hero), role: "member", at: now };
      return { ok: true, doc: g };
    }
    case "leave": {
      if (!me) return { ok: false, reason: "not_member" };
      if (g.leader === actor) {
        const next = successor(g, actor);
        if (!next) return { ok: true, doc: null };
        g.leader = next;
        g.members[next].role = "leader";
      }
      delete g.members[actor];
      return { ok: true, doc: g };
    }
    case "kick": {
      if (!me || !them || target === actor) return { ok: false, reason: "not_allowed" };
      if (!(ROLES[me.role] >= ROLES.officer && ROLES[me.role] > ROLES[them.role])) return { ok: false, reason: "not_allowed" };
      delete g.members[target];
      return { ok: true, doc: g };
    }
    case "promote":
    case "demote": {
      if (!me || me.role !== "leader" || !them) return { ok: false, reason: "not_allowed" };
      if (op === "promote" ? them.role !== "member" : them.role !== "officer") return { ok: false, reason: "not_allowed" };
      them.role = op === "promote" ? "officer" : "member";
      return { ok: true, doc: g };
    }
    case "notice": {
      if (!me || ROLES[me.role] < ROLES.officer) return { ok: false, reason: "not_allowed" };
      g.notice = Array.from(strip(args.text)).slice(0, NOTICE_MAX).join("");
      return { ok: true, doc: g };
    }
    case "rename": {
      if (!me) return { ok: false, reason: "not_member" };
      me.name = cleanHero(args.hero);
      return { ok: true, doc: g };
    }
    default:
      return { ok: false, reason: "bad_op" };
  }
}

// netlify/lib/docs.mjs
var PATH_RE = /^guilds\/g[a-z0-9]{6,16}$/;
var MAX_DOC = 32 * 1024;
var json2 = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
var parse = (t) => {
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
};
var RATE2 = /* @__PURE__ */ new Map();
function limited2(key, max, windowMs, now) {
  const r = RATE2.get(key);
  if (!r || now - r.t > windowMs) {
    RATE2.set(key, { n: 1, t: now });
    if (RATE2.size > 5e3) RATE2.clear();
    return false;
  }
  return ++r.n > max;
}
async function handleDocs(req, store, authKV = null, ctx = {}) {
  const url = new URL(req.url);
  const now = Date.now();
  if (ctx.ip && limited2("ip:" + ctx.ip, 600, 1e4, now)) return json2({ error: "rate_limited" }, 429);
  if (req.method === "GET") {
    const path2 = url.searchParams.get("path") || "";
    if (!PATH_RE.test(path2)) return json2({ error: "bad_path" }, 400);
    const cur = await store.getVersioned(path2);
    return json2({ data: publicView(parse(cur?.text)) });
  }
  if (req.method !== "POST") return json2({ error: "method_not_allowed" }, 405);
  const text = await req.text();
  if (text.length > 4096) return json2({ error: "too_large" }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json2({ error: "bad_request" }, 400);
  }
  const { op, gid, uid, ukey } = body || {};
  if (!isGid(gid) || !isUid(uid) || typeof op !== "string") return json2({ error: "bad_request" }, 400);
  if (limited2("uid:" + uid, 30, 6e4, now)) return json2({ error: "rate_limited" }, 429);
  if (!authKV || !await verifyUid(authKV, uid, ukey)) return json2({ error: "not_owner" }, 403);
  const path = `guilds/${gid}`;
  for (let tries = 0; tries < 10; tries++) {
    if (tries) await new Promise((r4) => setTimeout(r4, Math.random() * 25 * tries));
    const cur = await store.getVersioned(path);
    const r = applyGuildOp(parse(cur?.text), op, uid, body, now);
    if (!r.ok) return json2({ error: r.reason }, 409);
    const out = JSON.stringify(r.doc || { disbanded: true });
    if (out.length > MAX_DOC) return json2({ error: "too_large" }, 413);
    if (await store.put(path, out, cur ? { ifMatch: cur.etag } : { ifNew: true })) return json2({ ok: true, data: publicView(r.doc) });
  }
  return json2({ error: "busy" }, 409);
}
function publicView(doc) {
  return doc && !doc.disbanded ? doc : doc ? { disbanded: true } : null;
}

// netlify/lib/cloud.mjs
import { createHash as createHash2, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// src/data/weapons2.js
var arc = (range, deg) => ({ shape: "arc", range, arc: deg });
var circ = (r, forward = 0) => ({ shape: "circle", r, forward });
var proj = (kind, speed, r, o = {}) => ({ shape: "proj", kind, speed, r, pierce: 0, count: 1, spread: 0, ...o });
var rush = (dist, width) => ({ shape: "rush", dist, width });
var zone = (r, delay, reach) => ({ shape: "zone", r, delay, reach });
var mv = (name, anim, t, power, hit, extra = {}) => ({ name, anim, windup: t[0], active: t[1], recover: t[2], cancel: t[3], power, hit, ...extra });
var W = (id, wtype, name, rarity, src, stats, art, desc, moves) => ({ id, wtype, name, category: "weapon", rarity, src, stats, art: { kind: "forge", ...art }, desc, moves });
var WEAPONS_V7 = Object.freeze({
  // ---------------------------------------------------------------- swords
  w_flamberge: W(
    "w_flamberge",
    "sword",
    "\u0E14\u0E32\u0E1A\u0E40\u0E1B\u0E25\u0E27\u0E04\u0E25\u0E37\u0E48\u0E19",
    "rare",
    "t1",
    { atk: 22, crit: 0.06 },
    { form: "flamberge", blade: "#d8d0c4", edge: "#fff3e0", guard: "#8e2c21", grip: "#2a1a14", glow: "#ff8a3d" },
    "\u0E04\u0E21\u0E14\u0E32\u0E1A\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F \u0E17\u0E38\u0E01\u0E41\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E08\u0E30\u0E44\u0E2B\u0E21\u0E49\u0E15\u0E48\u0E2D",
    {
      combo: [
        mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E0B\u0E49\u0E32\u0E22", "slash", [0.07, 0.08, 0.2, 0.35], 0.9, arc(96, 120), { kb: 120, step: 14, burn: true }),
        mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E02\u0E27\u0E32", "slashUp", [0.07, 0.08, 0.2, 0.35], 0.95, arc(96, 120), { kb: 120, step: 14 }),
        mv("\u0E40\u0E1B\u0E25\u0E27\u0E02\u0E36\u0E49\u0E19\u0E1F\u0E49\u0E32", "heavyUp", [0.09, 0.09, 0.24, 0.4], 1.1, arc(104, 140), { kb: 200, step: 18, burn: true }),
        mv("\u0E2A\u0E32\u0E14\u0E04\u0E25\u0E37\u0E48\u0E19\u0E44\u0E1F", "overhead", [0.12, 0.1, 0.34, 0.7], 1.6, proj("bolt", 520, 14, { count: 3, spread: 30, pierce: 1 }), { burn: true, shake: 4 })
      ],
      charged: mv("\u0E40\u0E1B\u0E25\u0E27\u0E04\u0E25\u0E37\u0E48\u0E19\u0E2B\u0E21\u0E38\u0E19", "spin", [0.06, 0.18, 0.3, 0.6], 2.2, circ(140), { kb: 300, burn: true, hitStop: 0.08, shake: 6 }),
      dash: mv("\u0E1F\u0E31\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E1B\u0E25\u0E27", "thrust", [0.03, 0.12, 0.24, 0.5], 1.5, rush(160, 40), { kb: 160, burn: true }),
      branch: mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E0B\u0E49\u0E2D\u0E19", "slash", [0.06, 0.1, 0.3, 0.6], 0.8, arc(110, 150), { multi: 3, kb: 160, burn: true, hitStop: 0.06 })
    }
  ),
  w_crystal_edge: W(
    "w_crystal_edge",
    "sword",
    "\u0E14\u0E32\u0E1A\u0E1C\u0E25\u0E36\u0E01\u0E41\u0E01\u0E49\u0E27\u0E43\u0E2A",
    "epic",
    "t3",
    { atk: 33, crit: 0.1, critMult: 0.15 },
    { form: "crystalsword", blade: "#bfe8ff", edge: "#ffffff", guard: "#5a7a9a", grip: "#1e2a3a", glow: "#9fd8ff" },
    "\u0E1C\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E41\u0E15\u0E01 \u0E41\u0E15\u0E48\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E2B\u0E31\u0E01\u0E40\u0E2B\u0E43\u0E19\u0E15\u0E31\u0E27\u0E21\u0E31\u0E19\u0E15\u0E31\u0E14\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07",
    {
      combo: [
        mv("\u0E41\u0E17\u0E07\u0E1C\u0E25\u0E36\u0E01", "thrust", [0.06, 0.07, 0.18, 0.35], 0.95, arc(120, 40), { kb: 140, step: 20, critBonus: 0.1 }),
        mv("\u0E1F\u0E31\u0E19\u0E2B\u0E31\u0E01\u0E40\u0E2B", "slash", [0.06, 0.08, 0.2, 0.35], 1, arc(100, 130), { kb: 140, step: 14 }),
        mv("\u0E1B\u0E23\u0E34\u0E0B\u0E36\u0E21\u0E41\u0E15\u0E01\u0E01\u0E23\u0E30\u0E08\u0E32\u0E22", "overhead", [0.1, 0.08, 0.34, 0.7], 1.2, proj("bolt", 760, 9, { count: 5, spread: 60, pierce: 2 }), { shake: 3 })
      ],
      charged: mv("\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E1C\u0E25\u0E36\u0E01", "thrust", [0.05, 0.08, 0.34, 0.6], 2.6, proj("bigArrow", 1300, 12, { pierce: 99 }), { critBonus: 0.25, shake: 5 }),
      dash: mv("\u0E1C\u0E25\u0E36\u0E01\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19", "slashUp", [0.02, 0.08, 0.22, 0.5], 1.4, arc(118, 160), { kb: 220, step: 50, slow: 0.6 }),
      branch: mv("\u0E01\u0E23\u0E07\u0E1C\u0E25\u0E36\u0E01", "spin", [0.08, 0.14, 0.32, 0.6], 1.6, circ(120), { kb: 0, slow: 0.4, stun: 0.6, hitStop: 0.07 })
    }
  ),
  w_bonesaw: W(
    "w_bonesaw",
    "sword",
    "\u0E14\u0E32\u0E1A\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01",
    "legendary",
    "t6",
    { atk: 47, crit: 0.08, hp: 40 },
    { form: "bonesaw", blade: "#e8dcc0", edge: "#f8f0e0", guard: "#5a2a24", grip: "#2a1410", glow: "#e0503a" },
    "\u0E1F\u0E31\u0E19\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E40\u0E17\u0E1E\u0E42\u0E0B\u0E48\u0E15\u0E23\u0E27\u0E19 \u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E25\u0E32\u0E01\u0E08\u0E30\u0E09\u0E35\u0E01\u0E40\u0E01\u0E23\u0E32\u0E30",
    {
      combo: [
        mv("\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22\u0E09\u0E35\u0E01", "slash", [0.08, 0.1, 0.22, 0.38], 0.55, arc(98, 120), { multi: 2, kb: 60, step: 10, mark: 0.08 }),
        mv("\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22\u0E22\u0E49\u0E2D\u0E19", "slashUp", [0.08, 0.1, 0.22, 0.38], 0.55, arc(98, 120), { multi: 2, kb: 60, step: 10, mark: 0.08 }),
        mv("\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E1A\u0E14", "heavy", [0.14, 0.12, 0.34, 0.7], 1.9, arc(112, 170), { kb: 340, step: 24, stun: 0.5, hitStop: 0.08, shake: 6 })
      ],
      charged: mv("\u0E25\u0E32\u0E01\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22\u0E27\u0E07\u0E43\u0E2B\u0E0D\u0E48", "spin", [0.06, 0.22, 0.34, 0.65], 0.7, circ(132), { multi: 4, kb: 120, mark: 0.15, hitStop: 0.06, shake: 5 }),
      dash: mv("\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E22\u0E1E\u0E38\u0E48\u0E07", "thrust", [0.03, 0.14, 0.26, 0.5], 1.4, rush(190, 48), { kb: 120, mark: 0.12 }),
      branch: mv("\u0E16\u0E2D\u0E19\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "heavyUp", [0.1, 0.12, 0.34, 0.65], 2.3, arc(118, 150), { kb: -220, stun: 0.7, hitStop: 0.09, shake: 6 })
    }
  ),
  w_sunblade: W(
    "w_sunblade",
    "sword",
    "\u0E14\u0E32\u0E1A\u0E15\u0E30\u0E27\u0E31\u0E19\u0E40\u0E17\u0E35\u0E48\u0E22\u0E07",
    "mythic",
    "t10",
    { atk: 66, crit: 0.14, critMult: 0.35, hp: 80 },
    { form: "sunblade", blade: "#fff3c4", edge: "#ffffff", guard: "#e0b45a", grip: "#5a2a14", glow: "#ffcf5a" },
    "\u0E41\u0E2A\u0E07\u0E40\u0E17\u0E35\u0E48\u0E22\u0E07\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C\u0E01\u0E25\u0E37\u0E19\u0E44\u0E27\u0E49\u0E43\u0E19\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01 \u0E44\u0E14\u0E49\u0E01\u0E25\u0E31\u0E1A\u0E04\u0E37\u0E19\u0E2A\u0E39\u0E48\u0E21\u0E37\u0E2D\u0E21\u0E19\u0E38\u0E29\u0E22\u0E4C",
    {
      combo: [
        mv("\u0E23\u0E38\u0E48\u0E07\u0E2D\u0E23\u0E38\u0E13", "slashUp", [0.06, 0.08, 0.18, 0.35], 1, arc(104, 130), { kb: 150, step: 16 }),
        mv("\u0E15\u0E30\u0E27\u0E31\u0E19\u0E09\u0E32\u0E22", "slash", [0.06, 0.08, 0.18, 0.35], 1.05, arc(104, 130), { kb: 150, step: 16, burn: true }),
        mv("\u0E41\u0E2A\u0E07\u0E2A\u0E32\u0E14", "thrust", [0.06, 0.06, 0.2, 0.35], 0.9, proj("bolt", 700, 11, { count: 3, spread: 24, homing: 2 }), {}),
        mv("\u0E40\u0E17\u0E35\u0E48\u0E22\u0E07\u0E27\u0E31\u0E19", "overhead", [0.12, 0.1, 0.32, 0.7], 2.1, circ(150, 50), { kb: 380, burn: true, stun: 0.5, hitStop: 0.09, shake: 8 })
      ],
      charged: mv("\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30\u0E04\u0E23\u0E32\u0E2A", "castBig", [0.06, 0.06, 0.4, 0.6], 3.6, zone(170, 0.5, 460), { kb: 400, stun: 0.8, shake: 10 }),
      dash: mv("\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E2D\u0E38\u0E17\u0E31\u0E22", "heavyUp", [0.02, 0.12, 0.26, 0.5], 1.7, rush(220, 56), { kb: 220, burn: true, critBonus: 0.2 }),
      branch: mv("\u0E27\u0E07\u0E15\u0E30\u0E27\u0E31\u0E19", "spin", [0.06, 0.16, 0.3, 0.6], 2.4, circ(150), { kb: 320, burn: true, hitStop: 0.08, shake: 6 })
    }
  ),
  // ---------------------------------------------------------------- katana
  w_crimson_nodachi: W(
    "w_crimson_nodachi",
    "katana",
    "\u0E42\u0E19\u0E14\u0E32\u0E08\u0E34\u0E01\u0E25\u0E35\u0E1A\u0E42\u0E25\u0E2B\u0E34\u0E15",
    "rare",
    "t2",
    { atk: 24, crit: 0.1 },
    { form: "crimsonkatana", blade: "#e8eef4", edge: "#ffffff", guard: "#c2412f", grip: "#2a1418", wrap: "#e0503a", glow: "#ff5a7a" },
    "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E0A\u0E31\u0E01\u0E14\u0E32\u0E1A \u0E01\u0E25\u0E35\u0E1A\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E2A\u0E35\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E08\u0E30\u0E23\u0E48\u0E27\u0E07\u0E15\u0E32\u0E21",
    {
      combo: [
        mv("\u0E01\u0E25\u0E35\u0E1A\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E36\u0E48\u0E07", "slash", [0.05, 0.06, 0.15, 0.35], 0.75, arc(102, 110), { kb: 80, step: 14 }),
        mv("\u0E01\u0E25\u0E35\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E2D\u0E07", "slashUp", [0.05, 0.06, 0.15, 0.35], 0.75, arc(102, 110), { kb: 80, step: 14 }),
        mv("\u0E01\u0E25\u0E35\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21", "slash", [0.05, 0.06, 0.15, 0.35], 0.8, arc(102, 110), { kb: 80, step: 14 }),
        mv("\u0E01\u0E25\u0E35\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E35\u0E48", "thrust", [0.05, 0.06, 0.16, 0.35], 0.85, arc(124, 44), { kb: 120, step: 26 }),
        mv("\u0E1E\u0E32\u0E22\u0E38\u0E01\u0E25\u0E35\u0E1A\u0E42\u0E25\u0E2B\u0E34\u0E15", "iai", [0.08, 0.14, 0.32, 0.7], 1.5, rush(150, 50), { kb: 160, critBonus: 0.2, hitStop: 0.06 })
      ],
      charged: mv("\u0E23\u0E49\u0E2D\u0E22\u0E01\u0E25\u0E35\u0E1A\u0E23\u0E48\u0E27\u0E07", "iai", [0.04, 0.2, 0.32, 0.6], 0.6, circ(136), { multi: 5, kb: 60, critBonus: 0.15, hitStop: 0.08, shake: 5 }),
      dash: mv("\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E35\u0E1A", "slash", [0.02, 0.08, 0.22, 0.5], 1.5, arc(116, 150), { kb: 180, step: 46, critBonus: 0.3 }),
      branch: mv("\u0E01\u0E25\u0E35\u0E1A\u0E40\u0E14\u0E35\u0E22\u0E27\u0E1B\u0E25\u0E34\u0E14\u0E0A\u0E35\u0E1E", "iai", [0.12, 0.1, 0.34, 0.6], 2.4, arc(130, 60), { forceCrit: true, kb: 240, hitStop: 0.1 })
    }
  ),
  w_moonglass_katana: W(
    "w_moonglass_katana",
    "katana",
    "\u0E14\u0E32\u0E1A\u0E41\u0E01\u0E49\u0E27\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
    "epic",
    "t4",
    { atk: 36, crit: 0.12, spd: 0.04 },
    { form: "moonkatana", blade: "#cfe0ff", edge: "#ffffff", guard: "#9fb8ff", grip: "#1a1e3a", wrap: "#cfd6e6", glow: "#9fb8ff" },
    "\u0E43\u0E1A\u0E14\u0E32\u0E1A\u0E43\u0E2A\u0E08\u0E19\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E14\u0E27\u0E07\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E31\u0E19 \u0E40\u0E07\u0E32\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E1F\u0E31\u0E19\u0E44\u0E14\u0E49\u0E40\u0E2D\u0E07",
    {
      combo: [
        mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E0B\u0E49\u0E32\u0E22", "slash", [0.05, 0.06, 0.16, 0.35], 0.85, arc(104, 140), { kb: 90, step: 14 }),
        mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E02\u0E27\u0E32", "slashUp", [0.05, 0.06, 0.16, 0.35], 0.85, arc(104, 140), { kb: 90, step: 14 }),
        mv("\u0E40\u0E07\u0E32\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", "iai", [0.07, 0.12, 0.26, 0.6], 1.25, rush(140, 44), { kb: 120, critBonus: 0.15 })
      ],
      charged: mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E1E\u0E47\u0E0D", "spin", [0.05, 0.16, 0.32, 0.6], 2.6, circ(150), { kb: 260, slow: 0.5, hitStop: 0.09, shake: 6 }),
      dash: mv("\u0E40\u0E07\u0E32\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E07", "slash", [0.02, 0.07, 0.22, 0.5], 1.9, arc(96, 140), { teleport: "behind", forceCrit: true, kb: 160, hitStop: 0.06 }),
      branch: mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E0B\u0E49\u0E2D\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", "iai", [0.06, 0.14, 0.3, 0.6], 1.1, rush(180, 48), { multi: 2, kb: 140, critBonus: 0.25, hitStop: 0.07 })
    }
  ),
  w_thunder_katana: W(
    "w_thunder_katana",
    "katana",
    "\u0E14\u0E32\u0E1A\u0E2D\u0E2A\u0E19\u0E35\u0E0A\u0E31\u0E01\u0E1F\u0E49\u0E32",
    "legendary",
    "t7",
    { atk: 50, crit: 0.14, critMult: 0.2 },
    { form: "thunderkatana", blade: "#e8eef8", edge: "#fff9c4", guard: "#3a3a4a", grip: "#14141c", wrap: "#ffe65a", glow: "#ffe65a" },
    "\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32\u0E25\u0E07\u0E21\u0E32\u0E15\u0E23\u0E07\u0E17\u0E35\u0E48\u0E21\u0E31\u0E19\u0E0A\u0E35\u0E49 \u0E40\u0E23\u0E47\u0E27\u0E08\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21\u0E44\u0E21\u0E48\u0E17\u0E31\u0E19",
    {
      combo: [
        mv("\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E2B\u0E19\u0E36\u0E48\u0E07", "slash", [0.04, 0.05, 0.13, 0.3], 0.72, arc(100, 110), { kb: 70, step: 12, stun: 0.1 }),
        mv("\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E2A\u0E2D\u0E07", "slashUp", [0.04, 0.05, 0.13, 0.3], 0.72, arc(100, 110), { kb: 70, step: 12, stun: 0.1 }),
        mv("\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E1F\u0E32\u0E14", "overhead", [0.08, 0.06, 0.3, 0.65], 1.7, zone(90, 0.25, 260), { kb: 220, stun: 0.5, shake: 5 })
      ],
      charged: mv("\u0E0A\u0E31\u0E01\u0E14\u0E32\u0E1A\u0E2D\u0E2A\u0E19\u0E35", "iai", [0.03, 0.16, 0.3, 0.6], 3, rush(280, 50), { kb: 200, stun: 0.6, critBonus: 0.25, hitStop: 0.1, shake: 7 }),
      dash: mv("\u0E1F\u0E49\u0E32\u0E41\u0E25\u0E1A", "iai", [0.02, 0.1, 0.22, 0.5], 1.4, rush(150, 40), { kb: 120, stun: 0.3 }),
      branch: mv("\u0E2A\u0E32\u0E21\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32", "castBig", [0.08, 0.05, 0.3, 0.6], 1, proj("bolt", 900, 10, { count: 3, spread: 30, pierce: 3 }), { stun: 0.3, shake: 4 })
    }
  ),
  // ---------------------------------------------------------------- daggers
  w_kris_pair: W(
    "w_kris_pair",
    "dagger",
    "\u0E01\u0E23\u0E34\u0E0A\u0E04\u0E39\u0E48\u0E04\u0E25\u0E37\u0E48\u0E19\u0E1E\u0E34\u0E29",
    "rare",
    "t1",
    { atk: 19, crit: 0.12 },
    { form: "kris", blade: "#b8b0a0", edge: "#e8ff9a", guard: "#5a3a24", grip: "#2a1a10", glow: "#a8d070" },
    "\u0E04\u0E21\u0E04\u0E14\u0E40\u0E04\u0E35\u0E49\u0E22\u0E27\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E07\u0E39 \u0E41\u0E1C\u0E25\u0E40\u0E25\u0E47\u0E01\u0E41\u0E15\u0E48\u0E1E\u0E34\u0E29\u0E44\u0E2B\u0E25\u0E44\u0E21\u0E48\u0E2B\u0E22\u0E38\u0E14",
    {
      combo: [
        mv("\u0E41\u0E17\u0E07\u0E04\u0E14", "stab", [0.03, 0.05, 0.11, 0.3], 0.5, arc(78, 90), { kb: 40, step: 10, burn: true }),
        mv("\u0E41\u0E17\u0E07\u0E40\u0E25\u0E37\u0E49\u0E2D\u0E22", "stabB", [0.03, 0.05, 0.11, 0.3], 0.5, arc(78, 90), { kb: 40, step: 10 }),
        mv("\u0E01\u0E23\u0E34\u0E0A\u0E27\u0E19", "cross", [0.05, 0.06, 0.2, 0.55], 1.1, circ(90), { kb: 160, burn: true, hitStop: 0.04 })
      ],
      charged: mv("\u0E1D\u0E19\u0E01\u0E23\u0E34\u0E0A", "throw", [0.05, 0.05, 0.3, 0.6], 0.6, proj("knife", 700, 9, { count: 7, spread: 70 }), { burn: true }),
      dash: mv("\u0E01\u0E23\u0E34\u0E0A\u0E25\u0E2D\u0E1A", "stab", [0.02, 0.06, 0.22, 0.5], 2, arc(84, 110), { teleport: "behind", burn: true, forceCrit: true, kb: 140 }),
      branch: mv("\u0E1E\u0E34\u0E29\u0E2A\u0E32\u0E21\u0E23\u0E2D\u0E22", "stab", [0.04, 0.08, 0.24, 0.55], 0.6, arc(84, 120), { multi: 3, kb: 60, burn: true, hitStop: 0.05 })
    }
  ),
  w_fang_hook: W(
    "w_fang_hook",
    "dagger",
    "\u0E21\u0E35\u0E14\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27",
    "epic",
    "t4",
    { atk: 31, crit: 0.14, spd: 0.04 },
    { form: "fanghook", blade: "#3a3440", edge: "#e0b0ff", guard: "#5a4a6a", grip: "#1a1420", glow: "#c27ff0" },
    "\u0E42\u0E04\u0E49\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27 \u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E2B\u0E32\u0E01\u0E48\u0E2D\u0E19\u0E08\u0E30\u0E1B\u0E34\u0E14\u0E09\u0E32\u0E01",
    {
      combo: [
        mv("\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E40\u0E02\u0E49\u0E32", "stab", [0.03, 0.05, 0.12, 0.3], 0.55, arc(96, 120), { kb: -160, step: 8 }),
        mv("\u0E09\u0E35\u0E01\u0E2D\u0E2D\u0E01", "stabB", [0.03, 0.05, 0.12, 0.3], 0.6, arc(80, 110), { kb: 120, step: 10 }),
        mv("\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E04\u0E39\u0E48", "cross", [0.04, 0.05, 0.14, 0.3], 0.65, arc(96, 140), { kb: -200, step: 8 }),
        mv("\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E1B\u0E34\u0E14\u0E09\u0E32\u0E01", "cross", [0.06, 0.07, 0.26, 0.6], 1.4, arc(88, 160), { kb: 240, critBonus: 0.2, hitStop: 0.05, shake: 3 })
      ],
      charged: mv("\u0E15\u0E30\u0E02\u0E2D\u0E40\u0E2B\u0E27\u0E35\u0E48\u0E22\u0E07", "throw", [0.05, 0.05, 0.3, 0.6], 1.5, proj("knife", 640, 12, { pierce: 99 }), { kb: -360, stun: 0.4 }),
      dash: mv("\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E17\u0E30\u0E25\u0E38", "stab", [0.02, 0.1, 0.22, 0.5], 1.6, rush(150, 36), { kb: 100, critBonus: 0.25 }),
      branch: mv("\u0E27\u0E07\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27", "cross", [0.04, 0.12, 0.26, 0.55], 1.7, circ(104), { kb: -260, stun: 0.4, hitStop: 0.06 })
    }
  ),
  w_needle_stiletto: W(
    "w_needle_stiletto",
    "dagger",
    "\u0E40\u0E02\u0E47\u0E21\u0E21\u0E23\u0E13\u0E30",
    "legendary",
    "t8",
    { atk: 45, crit: 0.2, critMult: 0.45 },
    { form: "needle", blade: "#f0f4f8", edge: "#ffffff", guard: "#c8a050", grip: "#2a2420", glow: "#fff3c4" },
    "\u0E40\u0E02\u0E47\u0E21\u0E02\u0E2D\u0E07\u0E40\u0E17\u0E1E\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E15\u0E32\u0E22 \u0E41\u0E17\u0E07\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E27\u0E25\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E2B\u0E22\u0E37\u0E48\u0E2D\u0E2B\u0E22\u0E38\u0E14\u0E19\u0E34\u0E48\u0E07",
    {
      combo: [
        mv("\u0E08\u0E38\u0E14\u0E0A\u0E35\u0E1E\u0E08\u0E23", "stab", [0.03, 0.04, 0.1, 0.28], 0.45, arc(88, 50), { kb: 20, step: 8, critBonus: 0.15 }),
        mv("\u0E08\u0E38\u0E14\u0E0A\u0E35\u0E1E\u0E08\u0E23\u0E0B\u0E49\u0E33", "stabB", [0.03, 0.04, 0.1, 0.28], 0.45, arc(88, 50), { kb: 20, step: 8, critBonus: 0.15 }),
        mv("\u0E08\u0E38\u0E14\u0E0A\u0E35\u0E1E\u0E08\u0E23\u0E2A\u0E32\u0E21", "stab", [0.03, 0.04, 0.1, 0.28], 0.45, arc(88, 50), { kb: 20, step: 8, critBonus: 0.15 }),
        mv("\u0E08\u0E38\u0E14\u0E15\u0E32\u0E22", "stab", [0.08, 0.05, 0.28, 0.6], 1.6, arc(96, 40), { forceCrit: true, stun: 0.7, kb: 80, hitStop: 0.07 })
      ],
      charged: mv("\u0E1D\u0E19\u0E40\u0E02\u0E47\u0E21", "throw", [0.05, 0.05, 0.3, 0.6], 0.45, proj("knife", 980, 6, { count: 9, spread: 30, pierce: 1 }), { critBonus: 0.2 }),
      dash: mv("\u0E40\u0E02\u0E47\u0E21\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E27\u0E25\u0E32", "stab", [0.02, 0.05, 0.22, 0.5], 1.9, arc(84, 90), { teleport: "behind", stun: 1, forceCrit: true, kb: 40 }),
      branch: mv("\u0E1E\u0E31\u0E19\u0E40\u0E02\u0E47\u0E21", "stab", [0.04, 0.1, 0.24, 0.55], 0.32, arc(92, 60), { multi: 6, kb: 10, critBonus: 0.2, hitStop: 0.06 })
    }
  ),
  // ---------------------------------------------------------------- greatswords
  w_executioner: W(
    "w_executioner",
    "greatsword",
    "\u0E14\u0E32\u0E1A\u0E40\u0E1E\u0E0A\u0E0C\u0E06\u0E32\u0E15",
    "epic",
    "t3",
    { atk: 38, critMult: 0.25, spd: -0.04 },
    { form: "executioner", blade: "#8a8680", edge: "#d8d4cc", guard: "#3a2a24", grip: "#1c1410", glow: "#e0503a" },
    "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1B\u0E25\u0E32\u0E22\u0E41\u0E2B\u0E25\u0E21 \u0E44\u0E21\u0E48\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35",
    {
      combo: [
        mv("\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19", "overhead", [0.24, 0.14, 0.4, 0.45], 2.1, arc(126, 100), { kb: 360, step: 20, hitStop: 0.08, shake: 6 }),
        mv("\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23", "overhead", [0.3, 0.16, 0.52, 0.75], 3.2, arc(132, 80), { kb: 460, step: 26, stun: 0.6, critBonus: 0.15, hitStop: 0.12, shake: 10 })
      ],
      charged: mv("\u0E25\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23", "overhead", [0.12, 0.16, 0.5, 0.7], 4, circ(170, 70), { kb: 500, stun: 0.9, hitStop: 0.14, shake: 13 }),
      dash: mv("\u0E01\u0E27\u0E32\u0E14\u0E40\u0E1E\u0E0A\u0E0C\u0E06\u0E32\u0E15", "heavy", [0.06, 0.14, 0.36, 0.6], 2, arc(140, 200), { kb: 380, hitStop: 0.08, shake: 6 }),
      branch: mv("\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E0B\u0E49\u0E33", "heavyUp", [0.18, 0.14, 0.44, 0.7], 2.6, arc(136, 170), { kb: 420, forceCrit: true, hitStop: 0.11, shake: 9 })
    }
  ),
  w_dragonbone_blade: W(
    "w_dragonbone_blade",
    "greatsword",
    "\u0E14\u0E32\u0E1A\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E15\u0E01",
    "legendary",
    "t5",
    { atk: 44, hp: 60, def: 4 },
    { form: "dragonbone", blade: "#e8dcc0", edge: "#fff6e0", guard: "#6a3a24", grip: "#2a1a10", glow: "#ff8a3d" },
    "\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E2A\u0E31\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E21\u0E31\u0E07\u0E01\u0E23\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E21\u0E35\u0E44\u0E1F\u0E04\u0E38\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E49\u0E32\u0E07\u0E43\u0E19",
    {
      combo: [
        mv("\u0E2A\u0E31\u0E19\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "heavy", [0.18, 0.12, 0.32, 0.4], 1.5, arc(128, 170), { kb: 300, step: 20, hitStop: 0.07, shake: 5 }),
        mv("\u0E2B\u0E32\u0E07\u0E21\u0E31\u0E07\u0E01\u0E23", "spin", [0.16, 0.16, 0.34, 0.45], 1.6, circ(136), { kb: 320, hitStop: 0.07, shake: 5 }),
        mv("\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E21\u0E31\u0E07\u0E01\u0E23", "heavyUp", [0.16, 0.12, 0.34, 0.45], 1.7, arc(130, 180), { kb: 320, step: 20, burn: true, hitStop: 0.07, shake: 5 }),
        mv("\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "overhead", [0.26, 0.12, 0.5, 0.75], 1, proj("bolt", 560, 16, { count: 5, spread: 50, pierce: 2 }), { burn: true, shake: 7 })
      ],
      charged: mv("\u0E21\u0E31\u0E07\u0E01\u0E23\u0E15\u0E37\u0E48\u0E19", "overhead", [0.12, 0.16, 0.5, 0.7], 3.4, circ(200, 30), { kb: 480, burn: true, stun: 0.7, hitStop: 0.13, shake: 13 }),
      dash: mv("\u0E1E\u0E38\u0E48\u0E07\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "heavy", [0.05, 0.16, 0.34, 0.6], 1.9, rush(200, 70), { kb: 320 }),
      branch: mv("\u0E44\u0E1F\u0E43\u0E19\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "heavyUp", [0.16, 0.12, 0.44, 0.7], 2.4, circ(150, 60), { kb: 420, burn: true, stun: 0.6, hitStop: 0.11, shake: 10 })
    }
  ),
  w_obsidian_cleaver: W(
    "w_obsidian_cleaver",
    "greatsword",
    "\u0E14\u0E32\u0E1A\u0E2B\u0E34\u0E19\u0E20\u0E39\u0E40\u0E02\u0E32\u0E44\u0E1F\u0E14\u0E33",
    "legendary",
    "t6",
    { atk: 52, crit: 0.06, critMult: 0.3 },
    { form: "obsidian", blade: "#2a2430", edge: "#ff5a3a", guard: "#5a4a6a", grip: "#14101c", glow: "#ff5a3a" },
    "\u0E41\u0E15\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E2D\u0E22\u0E25\u0E32\u0E27\u0E32\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E1F\u0E31\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E1B\u0E23\u0E30\u0E2A\u0E32\u0E19\u0E01\u0E25\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E14\u0E34\u0E21",
    {
      combo: [
        mv("\u0E1C\u0E48\u0E32\u0E25\u0E32\u0E27\u0E32", "overhead", [0.2, 0.12, 0.38, 0.45], 1.9, circ(110, 70), { kb: 340, burn: true, step: 18, hitStop: 0.08, shake: 7 }),
        mv("\u0E41\u0E15\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E19\u0E27", "heavy", [0.18, 0.12, 0.34, 0.45], 1.2, proj("bigArrow", 820, 14, { pierce: 99 }), { burn: true, shake: 4 }),
        mv("\u0E20\u0E39\u0E40\u0E02\u0E32\u0E44\u0E1F\u0E1B\u0E30\u0E17\u0E38", "overhead", [0.28, 0.14, 0.5, 0.75], 2.8, zone(150, 0.4, 300), { kb: 420, stun: 0.6, shake: 11 })
      ],
      charged: mv("\u0E41\u0E1C\u0E48\u0E19\u0E14\u0E34\u0E19\u0E41\u0E22\u0E01\u0E25\u0E32\u0E27\u0E32", "overhead", [0.12, 0.08, 0.5, 0.7], 1.3, proj("bigArrow", 700, 18, { count: 3, spread: 40, pierce: 99 }), { burn: true, shake: 10 }),
      dash: mv("\u0E44\u0E16\u0E25\u0E32\u0E27\u0E32", "heavy", [0.06, 0.16, 0.36, 0.6], 1.8, rush(180, 70), { kb: 280, burn: true }),
      branch: mv("\u0E2B\u0E34\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E14", "spin", [0.12, 0.18, 0.4, 0.7], 2.2, circ(150), { kb: 380, burn: true, hitStop: 0.1, shake: 8 })
    }
  ),
  w_tidebreaker: W(
    "w_tidebreaker",
    "greatsword",
    "\u0E14\u0E32\u0E1A\u0E1C\u0E48\u0E32\u0E01\u0E23\u0E30\u0E41\u0E2A\u0E19\u0E49\u0E33",
    "epic",
    "t2",
    { atk: 30, hp: 40 },
    { form: "tidebreaker", blade: "#5f9fc8", edge: "#e8f8ff", guard: "#2a4a6a", grip: "#14202a", glow: "#7fe8ff" },
    "\u0E1F\u0E32\u0E14\u0E25\u0E07\u0E1C\u0E37\u0E19\u0E19\u0E49\u0E33\u0E41\u0E25\u0E49\u0E27\u0E04\u0E25\u0E37\u0E48\u0E19\u0E41\u0E22\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E2D\u0E07\u0E1D\u0E31\u0E48\u0E07",
    {
      combo: [
        mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E02\u0E49\u0E32", "heavy", [0.2, 0.12, 0.32, 0.4], 1.5, arc(132, 190), { kb: -260, step: 18, hitStop: 0.07, shake: 5 }),
        mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E0B\u0E31\u0E14", "heavyUp", [0.18, 0.12, 0.34, 0.45], 1.7, arc(132, 190), { kb: 420, step: 18, hitStop: 0.07, shake: 5 }),
        mv("\u0E19\u0E49\u0E33\u0E27\u0E19", "spin", [0.2, 0.2, 0.44, 0.75], 1, circ(150), { multi: 2, kb: -200, slow: 0.6, hitStop: 0.09, shake: 7 })
      ],
      charged: mv("\u0E2A\u0E36\u0E19\u0E32\u0E21\u0E34", "heavy", [0.1, 0.1, 0.5, 0.7], 2.6, proj("bigArrow", 600, 26, { pierce: 99 }), { kb: 480, stun: 0.5, shake: 9 }),
      dash: mv("\u0E17\u0E27\u0E19\u0E01\u0E23\u0E30\u0E41\u0E2A", "heavy", [0.06, 0.16, 0.36, 0.6], 1.7, rush(200, 74), { kb: -160, slow: 0.6 }),
      branch: mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E22\u0E31\u0E01\u0E29\u0E4C\u0E0B\u0E49\u0E2D\u0E19", "overhead", [0.22, 0.14, 0.48, 0.75], 2.6, circ(170, 60), { kb: 460, slow: 0.5, stun: 0.6, hitStop: 0.11, shake: 10 })
    }
  ),
  // ---------------------------------------------------------------- staves
  w_crescent_staff: W(
    "w_crescent_staff",
    "staff",
    "\u0E04\u0E17\u0E32\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27",
    "rare",
    "t2",
    { atk: 23, crit: 0.06, hp: 20 },
    { form: "crescentstaff", wood: "#3a3a5a", trim: "#cfd6e6", orb: "#9fb8ff", glow: "#9fb8ff" },
    "\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E2D\u0E38\u0E49\u0E21\u0E14\u0E27\u0E07\u0E41\u0E01\u0E49\u0E27\u0E44\u0E27\u0E49 \u0E41\u0E2A\u0E07\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E27\u0E01\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2A\u0E21\u0E2D",
    {
      combo: [
        mv("\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E41\u0E2A\u0E07", "cast", [0.09, 0.04, 0.2, 0.4], 0.6, proj("bolt", 560, 9, { count: 2, spread: 24, homing: 3.5 }), {}),
        mv("\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E41\u0E2A\u0E07\u0E04\u0E39\u0E48", "cast", [0.09, 0.04, 0.2, 0.4], 0.6, proj("bolt", 560, 9, { count: 2, spread: 24, homing: 3.5 }), {}),
        mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E04\u0E23\u0E36\u0E48\u0E07\u0E14\u0E27\u0E07", "castBig", [0.14, 0.05, 0.36, 0.7], 1.1, proj("bolt", 480, 14, { count: 5, spread: 140, homing: 2, pierce: 1 }), { slow: 0.7 })
      ],
      charged: mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E32\u0E04\u0E23\u0E32\u0E2A", "castBig", [0.08, 0.04, 0.42, 0.6], 2.6, zone(150, 0.7, 420), { kb: 200, slow: 0.4, stun: 0.8, shake: 7 }),
      dash: mv("\u0E27\u0E32\u0E23\u0E4C\u0E1B\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", "cast", [0.03, 0.04, 0.26, 0.5], 0.9, circ(110), { kb: 220, slow: 0.6 }),
      branch: mv("\u0E27\u0E07\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", "castBig", [0.12, 0.05, 0.36, 0.6], 0.55, proj("bolt", 380, 10, { count: 12, spread: 330, homing: 1 }), {})
    }
  ),
  w_serpent_staff: W(
    "w_serpent_staff",
    "staff",
    "\u0E04\u0E17\u0E32\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C\u0E04\u0E32\u0E1A\u0E41\u0E01\u0E49\u0E27",
    "legendary",
    "t6",
    { atk: 46, crit: 0.08, critMult: 0.25 },
    { form: "serpentstaff", wood: "#2a4a3a", trim: "#7fae3a", orb: "#e8ff9a", glow: "#a8d070" },
    "\u0E07\u0E39\u0E1A\u0E19\u0E04\u0E17\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E32\u0E22 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E23\u0E2D\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E2A\u0E31\u0E48\u0E07",
    {
      combo: [
        mv("\u0E1E\u0E34\u0E29\u0E1E\u0E48\u0E19", "cast", [0.08, 0.04, 0.18, 0.4], 0.75, proj("bolt", 620, 10, { homing: 4 }), { burn: true }),
        mv("\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E1E\u0E34\u0E29", "cast", [0.08, 0.04, 0.18, 0.4], 0.75, proj("bolt", 620, 10, { homing: 4 }), { burn: true }),
        mv("\u0E07\u0E39\u0E09\u0E01", "castBig", [0.06, 0.08, 0.24, 0.45], 1.3, rush(170, 40), { burn: true, kb: 160 }),
        mv("\u0E1A\u0E36\u0E07\u0E1E\u0E34\u0E29", "castBig", [0.16, 0.06, 0.4, 0.7], 1.8, zone(130, 0.35, 380), { burn: true, slow: 0.6, kb: 80, shake: 5 })
      ],
      charged: mv("\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C\u0E40\u0E01\u0E49\u0E32\u0E40\u0E28\u0E35\u0E22\u0E23", "castBig", [0.08, 0.04, 0.42, 0.6], 0.75, proj("bolt", 520, 11, { count: 9, spread: 80, homing: 3 }), { burn: true, shake: 5 }),
      dash: mv("\u0E40\u0E25\u0E37\u0E49\u0E2D\u0E22\u0E2B\u0E19\u0E35", "cast", [0.03, 0.04, 0.26, 0.5], 0.8, proj("bolt", 640, 9, { count: 3, spread: 50, homing: 3 }), { burn: true, hop: 70 }),
      branch: mv("\u0E23\u0E31\u0E14\u0E1E\u0E34\u0E29", "castBig", [0.12, 0.08, 0.36, 0.6], 1.6, circ(130), { kb: -260, burn: true, stun: 0.5, hitStop: 0.06 })
    }
  ),
  w_rootheart_staff: W(
    "w_rootheart_staff",
    "staff",
    "\u0E04\u0E17\u0E32\u0E23\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1B\u0E48\u0E32",
    "epic",
    "t3",
    { atk: 32, hp: 70, def: 4 },
    { form: "rootstaff", wood: "#5a3a24", trim: "#6aa25a", orb: "#9fffd8", glow: "#8fd06a" },
    "\u0E23\u0E32\u0E01\u0E44\u0E21\u0E49\u0E42\u0E2D\u0E1A\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1B\u0E48\u0E32\u0E44\u0E27\u0E49 \u0E23\u0E48\u0E32\u0E22\u0E40\u0E27\u0E17\u0E41\u0E25\u0E49\u0E27\u0E23\u0E32\u0E01\u0E08\u0E30\u0E41\u0E17\u0E07\u0E02\u0E36\u0E49\u0E19\u0E08\u0E32\u0E01\u0E1E\u0E37\u0E49\u0E19",
    {
      combo: [
        mv("\u0E23\u0E32\u0E01\u0E41\u0E17\u0E07", "cast", [0.1, 0.05, 0.2, 0.4], 0.95, zone(60, 0.2, 340), { kb: 120, stun: 0.2 }),
        mv("\u0E23\u0E32\u0E01\u0E41\u0E17\u0E07\u0E0B\u0E49\u0E33", "cast", [0.1, 0.05, 0.2, 0.4], 0.95, zone(60, 0.2, 340), { kb: 120, stun: 0.2 }),
        mv("\u0E1B\u0E48\u0E32\u0E1E\u0E31\u0E19", "castBig", [0.16, 0.06, 0.38, 0.7], 1.5, circ(160), { kb: -180, slow: 0.5, hitStop: 0.06, shake: 4 })
      ],
      charged: mv("\u0E15\u0E49\u0E19\u0E44\u0E21\u0E49\u0E42\u0E25\u0E01", "castBig", [0.08, 0.06, 0.42, 0.6], 3, zone(180, 0.6, 400), { kb: 360, stun: 1, shake: 9 }),
      dash: mv("\u0E43\u0E1A\u0E44\u0E21\u0E49\u0E1B\u0E25\u0E34\u0E27", "cast", [0.03, 0.04, 0.26, 0.5], 0.6, proj("feather", 700, 8, { count: 5, spread: 60, homing: 2 }), {}),
      branch: mv("\u0E23\u0E32\u0E01\u0E2A\u0E32\u0E21\u0E41\u0E19\u0E27", "castBig", [0.12, 0.05, 0.36, 0.6], 1.1, proj("bigArrow", 560, 14, { count: 3, spread: 50, pierce: 99 }), { stun: 0.3 })
    }
  ),
  w_soul_eye_staff: W(
    "w_soul_eye_staff",
    "staff",
    "\u0E04\u0E17\u0E32\u0E40\u0E19\u0E15\u0E23\u0E1E\u0E31\u0E19\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    "mythic",
    "t9",
    { atk: 60, crit: 0.12, critMult: 0.35, hp: 60 },
    { form: "eyestaff", wood: "#1a1428", trim: "#c27ff0", orb: "#ff5a7a", glow: "#c27ff0" },
    "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E17\u0E35\u0E48\u0E17\u0E28\u0E1E\u0E31\u0E01\u0E15\u0E23\u0E4C\u0E21\u0E32\u0E23\u0E04\u0E27\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E40\u0E2D\u0E07 \u0E40\u0E2B\u0E47\u0E19\u0E17\u0E38\u0E01\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E0B\u0E48\u0E2D\u0E19",
    {
      combo: [
        mv("\u0E08\u0E49\u0E2D\u0E07\u0E21\u0E2D\u0E07", "cast", [0.07, 0.04, 0.16, 0.38], 0.8, proj("bolt", 720, 10, { homing: 5, pierce: 1 }), { mark: 0.1 }),
        mv("\u0E08\u0E49\u0E2D\u0E07\u0E21\u0E2D\u0E07\u0E0B\u0E49\u0E33", "cast", [0.07, 0.04, 0.16, 0.38], 0.8, proj("bolt", 720, 10, { homing: 5, pierce: 1 }), { mark: 0.1 }),
        mv("\u0E2A\u0E32\u0E21\u0E40\u0E19\u0E15\u0E23", "cast", [0.08, 0.04, 0.2, 0.4], 0.7, proj("bolt", 680, 10, { count: 3, spread: 40, homing: 4 }), { mark: 0.1 }),
        mv("\u0E25\u0E37\u0E21\u0E15\u0E32\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01", "castBig", [0.14, 0.08, 0.38, 0.7], 2.2, circ(170), { kb: 340, stun: 0.6, mark: 0.2, hitStop: 0.08, shake: 7 })
      ],
      charged: mv("\u0E1E\u0E31\u0E19\u0E40\u0E19\u0E15\u0E23\u0E25\u0E37\u0E21\u0E15\u0E32", "castBig", [0.08, 0.04, 0.44, 0.6], 0.5, proj("bolt", 420, 10, { count: 16, spread: 345, homing: 4 }), { mark: 0.15, shake: 6 }),
      dash: mv("\u0E40\u0E19\u0E15\u0E23\u0E2B\u0E25\u0E1A", "cast", [0.03, 0.04, 0.24, 0.5], 1.6, zone(110, 0.3, 360), { kb: 260, stun: 0.4 }),
      branch: mv("\u0E15\u0E32\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E1E\u0E48\u0E07", "castBig", [0.14, 0.06, 0.36, 0.6], 3, proj("bigArrow", 1400, 14, { pierce: 99 }), { forceCrit: true, shake: 6 })
    }
  ),
  // ---------------------------------------------------------------- bows
  w_featherwing_bow: W(
    "w_featherwing_bow",
    "bow",
    "\u0E18\u0E19\u0E39\u0E1B\u0E35\u0E01\u0E02\u0E19\u0E19\u0E01",
    "rare",
    "t1",
    { atk: 20, crit: 0.08, spd: 0.05 },
    { form: "featherbow", wood: "#d8c8a0", trim: "#f4f6ff", string: "#ffffff", glow: "#d8e8ff" },
    "\u0E25\u0E39\u0E01\u0E28\u0E23\u0E08\u0E32\u0E01\u0E18\u0E19\u0E39\u0E19\u0E35\u0E49\u0E40\u0E25\u0E35\u0E49\u0E22\u0E27\u0E15\u0E32\u0E21\u0E25\u0E21\u0E44\u0E14\u0E49",
    {
      combo: [
        mv("\u0E28\u0E23\u0E25\u0E21", "shoot", [0.07, 0.03, 0.18, 0.4], 0.75, proj("arrow", 900, 7, { homing: 2.5 }), {}),
        mv("\u0E28\u0E23\u0E25\u0E21\u0E04\u0E39\u0E48", "shoot", [0.08, 0.03, 0.2, 0.4], 0.55, proj("arrow", 900, 7, { count: 2, spread: 8, homing: 2.5 }), {}),
        mv("\u0E28\u0E23\u0E25\u0E21\u0E2A\u0E32\u0E21", "shoot", [0.08, 0.03, 0.2, 0.4], 0.5, proj("arrow", 900, 7, { count: 3, spread: 14, homing: 2.5 }), {}),
        mv("\u0E02\u0E19\u0E19\u0E01\u0E1E\u0E32\u0E22\u0E38", "shoot", [0.14, 0.03, 0.34, 0.7], 0.42, proj("feather", 760, 8, { count: 8, spread: 90, homing: 3 }), {})
      ],
      charged: mv("\u0E28\u0E23\u0E40\u0E2B\u0E22\u0E35\u0E48\u0E22\u0E27", "shoot", [0.04, 0.04, 0.36, 0.6], 2.4, proj("bigArrow", 1100, 12, { pierce: 3, homing: 3 }), { critBonus: 0.2, shake: 4 }),
      dash: mv("\u0E28\u0E23\u0E01\u0E25\u0E32\u0E07\u0E2D\u0E32\u0E01\u0E32\u0E28", "shoot", [0.03, 0.03, 0.24, 0.5], 0.7, proj("arrow", 960, 7, { count: 3, spread: 30, homing: 2 }), { hop: 120 }),
      branch: mv("\u0E25\u0E21\u0E2B\u0E21\u0E38\u0E19\u0E28\u0E23", "shoot", [0.1, 0.04, 0.32, 0.6], 0.5, proj("arrow", 820, 7, { count: 10, spread: 340, homing: 2 }), {})
    }
  ),
  w_vertebra_bow: W(
    "w_vertebra_bow",
    "bow",
    "\u0E18\u0E19\u0E39\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E2A\u0E31\u0E19\u0E2B\u0E25\u0E31\u0E07",
    "epic",
    "t5",
    { atk: 36, critMult: 0.3 },
    { form: "bonebow", wood: "#e8dcc0", trim: "#8e2c21", string: "#c2412f", glow: "#e0503a" },
    "\u0E17\u0E33\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E40\u0E2B\u0E22\u0E37\u0E48\u0E2D\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E2C\u0E42\u0E25\u0E2B\u0E34\u0E15 \u0E2A\u0E32\u0E22\u0E18\u0E19\u0E39\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E40\u0E15\u0E49\u0E19",
    {
      combo: [
        mv("\u0E28\u0E23\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "shoot", [0.09, 0.03, 0.22, 0.4], 1, proj("arrow", 1e3, 8, { pierce: 1 }), { mark: 0.08 }),
        mv("\u0E28\u0E23\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E0B\u0E49\u0E33", "shoot", [0.09, 0.03, 0.22, 0.4], 1, proj("arrow", 1e3, 8, { pierce: 1 }), { mark: 0.08 }),
        mv("\u0E28\u0E23\u0E2B\u0E31\u0E01", "shoot", [0.16, 0.03, 0.36, 0.7], 0.9, proj("arrow", 900, 8, { count: 2, spread: 4, pierce: 2 }), { stun: 0.4, mark: 0.12 })
      ],
      charged: mv("\u0E28\u0E23\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E2A\u0E31\u0E19\u0E2B\u0E25\u0E31\u0E07", "shoot", [0.05, 0.04, 0.4, 0.6], 3.4, proj("bigArrow", 1400, 14, { pierce: 99 }), { stun: 0.5, mark: 0.2, shake: 6 }),
      dash: mv("\u0E22\u0E34\u0E07\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E16\u0E2D\u0E22", "shoot", [0.03, 0.03, 0.24, 0.5], 1.2, proj("arrow", 980, 8, { pierce: 2 }), { hop: 110, mark: 0.1 }),
      branch: mv("\u0E1D\u0E19\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01", "shoot", [0.12, 0.04, 0.4, 0.6], 1.6, zone(120, 0.5, 520), { kb: 200, mark: 0.15, shake: 5 })
    }
  ),
  w_storm_longbow: W(
    "w_storm_longbow",
    "bow",
    "\u0E18\u0E19\u0E39\u0E22\u0E32\u0E27\u0E1E\u0E32\u0E22\u0E38\u0E1F\u0E49\u0E32\u0E04\u0E33\u0E23\u0E32\u0E21",
    "legendary",
    "t7",
    { atk: 49, crit: 0.12, spd: 0.04 },
    { form: "stormbow", wood: "#5a6a80", trim: "#ffe65a", string: "#fff9c4", glow: "#ffe65a" },
    "\u0E2A\u0E32\u0E22\u0E18\u0E19\u0E39\u0E17\u0E33\u0E08\u0E32\u0E01\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32 \u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E21\u0E37\u0E2D\u0E17\u0E35\u0E44\u0E23\u0E1F\u0E49\u0E32\u0E23\u0E49\u0E2D\u0E07\u0E15\u0E32\u0E21\u0E21\u0E32",
    {
      combo: [
        mv("\u0E28\u0E23\u0E1F\u0E49\u0E32\u0E41\u0E25\u0E1A", "shoot", [0.06, 0.03, 0.16, 0.38], 0.7, proj("arrow", 1200, 7, { pierce: 2 }), { stun: 0.15 }),
        mv("\u0E28\u0E23\u0E1F\u0E49\u0E32\u0E41\u0E25\u0E1A\u0E0B\u0E49\u0E33", "shoot", [0.06, 0.03, 0.16, 0.38], 0.7, proj("arrow", 1200, 7, { pierce: 2 }), { stun: 0.15 }),
        mv("\u0E28\u0E23\u0E1F\u0E49\u0E32\u0E41\u0E25\u0E1A\u0E2A\u0E32\u0E21", "shoot", [0.06, 0.03, 0.16, 0.38], 0.7, proj("arrow", 1200, 7, { pierce: 2 }), { stun: 0.15 }),
        mv("\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32", "shoot", [0.16, 0.04, 0.36, 0.7], 2, zone(100, 0.25, 520), { stun: 0.7, kb: 200, shake: 6 })
      ],
      charged: mv("\u0E1E\u0E32\u0E22\u0E38\u0E04\u0E33\u0E23\u0E32\u0E21", "shoot", [0.05, 0.04, 0.4, 0.6], 0.9, proj("bigArrow", 1200, 11, { count: 5, spread: 36, pierce: 99 }), { stun: 0.4, shake: 7 }),
      dash: mv("\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E16\u0E2D\u0E22", "shoot", [0.03, 0.03, 0.24, 0.5], 1, proj("arrow", 1100, 7, { count: 3, spread: 16, pierce: 1 }), { hop: 100, stun: 0.2 }),
      branch: mv("\u0E1F\u0E49\u0E32\u0E25\u0E31\u0E48\u0E19\u0E2A\u0E32\u0E21\u0E04\u0E23\u0E31\u0E49\u0E07", "shoot", [0.12, 0.04, 0.36, 0.6], 1.1, zone(150, 0.4, 520), { multi: 2, stun: 0.6, shake: 7 })
    }
  ),
  // ---------------------------------------------------------------- spears
  w_abyss_trident: W(
    "w_abyss_trident",
    "spear",
    "\u0E15\u0E23\u0E35\u0E28\u0E39\u0E25\u0E2B\u0E49\u0E27\u0E07\u0E2A\u0E21\u0E38\u0E17\u0E23",
    "epic",
    "t4",
    { atk: 34, hp: 30, crit: 0.06 },
    { form: "trident", shaft: "#2a4a5a", head: "#7fe8ff", edge: "#ffffff", trim: "#3a7aa8", glow: "#7fe8ff" },
    "\u0E2A\u0E32\u0E21\u0E07\u0E48\u0E32\u0E21\u0E08\u0E32\u0E01\u0E43\u0E15\u0E49\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13 \u0E41\u0E17\u0E07\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27\u0E44\u0E14\u0E49\u0E2A\u0E32\u0E21\u0E41\u0E1C\u0E25",
    {
      combo: [
        mv("\u0E2A\u0E32\u0E21\u0E07\u0E48\u0E32\u0E21", "thrust", [0.08, 0.07, 0.2, 0.35], 0.42, arc(150, 40), { multi: 3, kb: 120, step: 20 }),
        mv("\u0E2A\u0E32\u0E21\u0E07\u0E48\u0E32\u0E21\u0E0B\u0E49\u0E33", "thrust", [0.08, 0.07, 0.2, 0.35], 0.42, arc(150, 40), { multi: 3, kb: 120, step: 20 }),
        mv("\u0E14\u0E36\u0E07\u0E2A\u0E21\u0E38\u0E17\u0E23", "heavy", [0.12, 0.1, 0.3, 0.7], 1.3, arc(160, 160), { kb: -320, slow: 0.6, hitStop: 0.06, shake: 4 })
      ],
      charged: mv("\u0E15\u0E23\u0E35\u0E28\u0E39\u0E25\u0E1E\u0E38\u0E48\u0E07", "throw", [0.05, 0.05, 0.36, 0.6], 2.6, proj("bigArrow", 1e3, 16, { pierce: 99 }), { slow: 0.5, shake: 6 }),
      dash: mv("\u0E04\u0E25\u0E37\u0E48\u0E19\u0E17\u0E30\u0E25\u0E27\u0E07", "thrust", [0.04, 0.14, 0.3, 0.5], 1.9, rush(220, 50), { kb: 280, slow: 0.6 }),
      branch: mv("\u0E27\u0E31\u0E07\u0E27\u0E19\u0E2A\u0E21\u0E38\u0E17\u0E23", "spin", [0.12, 0.16, 0.32, 0.6], 1.6, circ(160), { kb: -280, slow: 0.5, hitStop: 0.07, shake: 5 })
    }
  ),
  w_war_halberd: W(
    "w_war_halberd",
    "spear",
    "\u0E07\u0E49\u0E32\u0E27\u0E28\u0E36\u0E01\u0E42\u0E0B\u0E48\u0E15\u0E23\u0E27\u0E19",
    "rare",
    "t2",
    { atk: 26, def: 3 },
    { form: "halberd", shaft: "#3a2a20", head: "#9aa0a8", edge: "#e8eef4", trim: "#5a4a40", glow: "#c8d0dc" },
    "\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E2D\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E02\u0E27\u0E32\u0E19 \u0E43\u0E0A\u0E49\u0E17\u0E31\u0E49\u0E07\u0E41\u0E17\u0E07\u0E41\u0E25\u0E30\u0E2A\u0E31\u0E1A",
    {
      combo: [
        mv("\u0E41\u0E17\u0E07\u0E07\u0E49\u0E32\u0E27", "thrust", [0.08, 0.07, 0.2, 0.35], 1, arc(156, 36), { kb: 200, step: 18 }),
        mv("\u0E2A\u0E31\u0E1A\u0E07\u0E49\u0E32\u0E27", "overhead", [0.14, 0.1, 0.3, 0.4], 1.6, arc(140, 70), { kb: 300, step: 16, stun: 0.3, hitStop: 0.07, shake: 5 }),
        mv("\u0E15\u0E30\u0E02\u0E2D\u0E07\u0E49\u0E32\u0E27", "heavy", [0.1, 0.1, 0.24, 0.4], 0.9, arc(150, 140), { kb: -280, step: 10 }),
        mv("\u0E01\u0E27\u0E32\u0E14\u0E07\u0E49\u0E32\u0E27", "spin", [0.14, 0.14, 0.36, 0.7], 1.6, circ(150), { kb: 320, hitStop: 0.07, shake: 5 })
      ],
      charged: mv("\u0E07\u0E49\u0E32\u0E27\u0E1C\u0E48\u0E32\u0E41\u0E1C\u0E48\u0E19\u0E14\u0E34\u0E19", "overhead", [0.08, 0.14, 0.4, 0.7], 3, circ(130, 110), { kb: 420, stun: 0.7, hitStop: 0.1, shake: 9 }),
      dash: mv("\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E2A\u0E31\u0E1A", "overhead", [0.06, 0.1, 0.3, 0.5], 2.1, circ(100, 80), { kb: 300, step: 120, stun: 0.4, shake: 6 }),
      branch: mv("\u0E07\u0E49\u0E32\u0E27\u0E2A\u0E2D\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30", "heavyUp", [0.1, 0.12, 0.34, 0.6], 1.2, arc(160, 150), { multi: 2, kb: 260, hitStop: 0.07, shake: 5 })
    }
  ),
  w_serpent_glaive: W(
    "w_serpent_glaive",
    "spear",
    "\u0E07\u0E49\u0E32\u0E27\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C\u0E40\u0E25\u0E37\u0E49\u0E2D\u0E22",
    "legendary",
    "t8",
    { atk: 51, crit: 0.1, spd: 0.04 },
    { form: "serpentglaive", shaft: "#1a3a2a", head: "#a8d070", edge: "#e8ff9a", trim: "#e0b45a", glow: "#a8d070" },
    "\u0E43\u0E1A\u0E21\u0E35\u0E14\u0E42\u0E04\u0E49\u0E07\u0E40\u0E25\u0E37\u0E49\u0E2D\u0E22\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E07\u0E39 \u0E1F\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E1E\u0E34\u0E29\u0E44\u0E2B\u0E25\u0E15\u0E32\u0E21\u0E23\u0E2D\u0E22",
    {
      combo: [
        mv("\u0E07\u0E39\u0E40\u0E25\u0E37\u0E49\u0E2D\u0E22\u0E0B\u0E49\u0E32\u0E22", "slash", [0.07, 0.07, 0.18, 0.35], 0.9, arc(150, 120), { kb: 120, step: 16, burn: true }),
        mv("\u0E07\u0E39\u0E40\u0E25\u0E37\u0E49\u0E2D\u0E22\u0E02\u0E27\u0E32", "slashUp", [0.07, 0.07, 0.18, 0.35], 0.9, arc(150, 120), { kb: 120, step: 16, burn: true }),
        mv("\u0E07\u0E39\u0E09\u0E01\u0E15\u0E23\u0E07", "thrust", [0.06, 0.08, 0.2, 0.35], 1.1, arc(176, 30), { kb: 220, step: 30 }),
        mv("\u0E07\u0E39\u0E02\u0E14\u0E27\u0E07", "spin", [0.12, 0.16, 0.34, 0.7], 1.7, circ(160), { kb: 280, burn: true, hitStop: 0.07, shake: 5 })
      ],
      charged: mv("\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C\u0E17\u0E30\u0E22\u0E32\u0E19", "thrust", [0.04, 0.18, 0.34, 0.6], 2.8, rush(260, 56), { kb: 280, burn: true, hitStop: 0.08, shake: 6 }),
      dash: mv("\u0E09\u0E01\u0E08\u0E32\u0E01\u0E40\u0E07\u0E32", "thrust", [0.02, 0.08, 0.26, 0.5], 1.9, arc(150, 40), { teleport: "behind", burn: true, forceCrit: true, kb: 160 }),
      branch: mv("\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E04\u0E39\u0E48\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C", "slash", [0.08, 0.1, 0.3, 0.6], 1, arc(164, 160), { multi: 2, burn: true, kb: 200, hitStop: 0.07 })
    }
  ),
  // ---------------------------------------------------------------- scythes
  w_twin_moon_scythe: W(
    "w_twin_moon_scythe",
    "scythe",
    "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E04\u0E39\u0E48",
    "epic",
    "t3",
    { atk: 35, crit: 0.08, spd: 0.03 },
    { form: "twinscythe", shaft: "#2a2438", blade: "#d8d0ff", edge: "#ffffff", trim: "#9f7fff", glow: "#b8a0ff" },
    "\u0E43\u0E1A\u0E40\u0E04\u0E35\u0E22\u0E27\u0E2A\u0E2D\u0E07\u0E14\u0E49\u0E32\u0E19 \u0E2B\u0E21\u0E38\u0E19\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E44\u0E14\u0E49\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E25\u0E30\u0E2B\u0E25\u0E31\u0E07",
    {
      combo: [
        mv("\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E2B\u0E19\u0E49\u0E32", "heavy", [0.1, 0.1, 0.22, 0.36], 1.1, arc(140, 200), { kb: -140, step: 16, hitStop: 0.05 }),
        mv("\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E2B\u0E25\u0E31\u0E07", "spin", [0.1, 0.12, 0.24, 0.38], 1.1, circ(140), { kb: 160, hitStop: 0.05 }),
        mv("\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E2B\u0E19\u0E49\u0E32", "heavyUp", [0.1, 0.1, 0.22, 0.36], 1.15, arc(140, 200), { kb: -140, step: 16, hitStop: 0.05 }),
        mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E04\u0E39\u0E48\u0E2B\u0E21\u0E38\u0E19", "spin", [0.12, 0.18, 0.36, 0.7], 0.85, circ(160), { multi: 3, kb: 220, hitStop: 0.08, shake: 6 })
      ],
      charged: mv("\u0E04\u0E37\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E04\u0E39\u0E48", "spin", [0.06, 0.24, 0.4, 0.65], 1.5, circ(210), { multi: 2, kb: -260, stun: 0.5, hitStop: 0.1, shake: 9 }),
      dash: mv("\u0E40\u0E04\u0E35\u0E22\u0E27\u0E1E\u0E38\u0E48\u0E07\u0E04\u0E39\u0E48", "heavy", [0.04, 0.14, 0.3, 0.55], 1.7, rush(200, 70), { kb: 200, critBonus: 0.15 }),
      branch: mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E1C\u0E48\u0E32", "overhead", [0.14, 0.12, 0.4, 0.65], 2.1, proj("bigArrow", 700, 22, { count: 2, spread: 180, pierce: 99 }), { shake: 6 })
    }
  ),
  w_ribcage_reaper: W(
    "w_ribcage_reaper",
    "scythe",
    "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E0B\u0E35\u0E48\u0E42\u0E04\u0E23\u0E07\u0E22\u0E21\u0E17\u0E31\u0E13\u0E11\u0E4C",
    "legendary",
    "t5",
    { atk: 46, hp: 50, critMult: 0.2 },
    { form: "ribscythe", shaft: "#3a2a20", blade: "#e8dcc0", edge: "#fff6e0", trim: "#5a2a24", glow: "#9fffd8" },
    "\u0E17\u0E33\u0E08\u0E32\u0E01\u0E0B\u0E35\u0E48\u0E42\u0E04\u0E23\u0E07\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E22\u0E21\u0E17\u0E31\u0E13\u0E11\u0E4C\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E27\u0E48\u0E32\u0E2B\u0E19\u0E31\u0E01\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B",
    {
      combo: [
        mv("\u0E0A\u0E31\u0E48\u0E07\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", "heavy", [0.12, 0.1, 0.26, 0.38], 1.2, arc(146, 200), { kb: -180, step: 18, hitStop: 0.05, shake: 3 }),
        mv("\u0E0B\u0E35\u0E48\u0E42\u0E04\u0E23\u0E07\u0E2B\u0E19\u0E35\u0E1A", "heavyUp", [0.11, 0.12, 0.26, 0.38], 1.3, arc(146, 200), { kb: -220, stun: 0.3, hitStop: 0.05, shake: 3 }),
        mv("\u0E14\u0E36\u0E07\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E2D\u0E2D\u0E01", "overhead", [0.16, 0.1, 0.4, 0.7], 2.2, arc(156, 120), { kb: -340, mark: 0.2, hitStop: 0.08, shake: 6 })
      ],
      charged: mv("\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E1E\u0E25\u0E34\u0E01", "spin", [0.06, 0.2, 0.4, 0.65], 3, circ(196), { kb: -300, stun: 0.6, mark: 0.2, hitStop: 0.1, shake: 9 }),
      dash: mv("\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E2B\u0E25\u0E38\u0E14", "heavy", [0.03, 0.08, 0.3, 0.55], 1.9, arc(140, 160), { teleport: "behind", kb: -200, forceCrit: true }),
      branch: mv("\u0E22\u0E21\u0E17\u0E31\u0E13\u0E11\u0E4C", "overhead", [0.14, 0.12, 0.4, 0.65], 1.8, zone(140, 0.45, 340), { kb: -300, stun: 0.8, mark: 0.25, shake: 8 })
    }
  ),
  w_sakura_scythe: W(
    "w_sakura_scythe",
    "scythe",
    "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E0B\u0E32\u0E01\u0E38\u0E23\u0E30\u0E23\u0E48\u0E27\u0E07",
    "rare",
    "t2",
    { atk: 25, crit: 0.08 },
    { form: "sakurascythe", shaft: "#5a2a24", blade: "#ffd0e0", edge: "#ffffff", trim: "#ff7aa8", glow: "#ffb0d0" },
    "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27 \u0E01\u0E25\u0E35\u0E1A\u0E0B\u0E32\u0E01\u0E38\u0E23\u0E30\u0E08\u0E30\u0E1B\u0E25\u0E34\u0E27\u0E15\u0E32\u0E21\u0E41\u0E23\u0E07\u0E25\u0E21",
    {
      combo: [
        mv("\u0E25\u0E21\u0E01\u0E25\u0E35\u0E1A", "heavy", [0.1, 0.1, 0.24, 0.36], 1, arc(138, 200), { kb: -120, step: 16 }),
        mv("\u0E01\u0E25\u0E35\u0E1A\u0E1B\u0E25\u0E34\u0E27", "heavyUp", [0.1, 0.1, 0.24, 0.36], 0.6, proj("feather", 720, 9, { count: 5, spread: 70, homing: 2 }), {}),
        mv("\u0E23\u0E48\u0E27\u0E07\u0E17\u0E31\u0E49\u0E07\u0E15\u0E49\u0E19", "spin", [0.12, 0.16, 0.34, 0.7], 1.8, circ(150), { kb: 260, hitStop: 0.07, shake: 5 })
      ],
      charged: mv("\u0E1E\u0E32\u0E22\u0E38\u0E0B\u0E32\u0E01\u0E38\u0E23\u0E30", "spin", [0.06, 0.2, 0.4, 0.65], 0.55, circ(190), { multi: 5, kb: -100, hitStop: 0.1, shake: 7 }),
      dash: mv("\u0E01\u0E25\u0E35\u0E1A\u0E44\u0E25\u0E48\u0E25\u0E21", "heavy", [0.04, 0.14, 0.3, 0.55], 1.6, rush(190, 60), { kb: 180 }),
      branch: mv("\u0E1D\u0E19\u0E01\u0E25\u0E35\u0E1A", "overhead", [0.12, 0.1, 0.38, 0.65], 0.5, proj("feather", 620, 9, { count: 12, spread: 330, homing: 3 }), {})
    }
  ),
  // ---------------------------------------------------------------- twin blades
  w_jade_leaf_twins: W(
    "w_jade_leaf_twins",
    "twinblades",
    "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E43\u0E1A\u0E2B\u0E22\u0E01",
    "rare",
    "t1",
    { atk: 21, crit: 0.08, spd: 0.04 },
    { form: "leaftwins", blade: "#7fd0a0", edge: "#e8fff0", guard: "#3a6a3a", grip: "#1a2a1a", glow: "#9fffd8" },
    "\u0E2A\u0E2D\u0E07\u0E43\u0E1A\u0E2B\u0E22\u0E01\u0E17\u0E35\u0E48\u0E23\u0E48\u0E27\u0E07\u0E08\u0E32\u0E01\u0E15\u0E49\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19 \u0E1F\u0E31\u0E19\u0E2A\u0E25\u0E31\u0E1A\u0E01\u0E31\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E43\u0E1A\u0E44\u0E21\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E25\u0E21",
    {
      combo: [
        mv("\u0E43\u0E1A\u0E0B\u0E49\u0E32\u0E22", "dslash", [0.04, 0.06, 0.12, 0.3], 0.6, arc(104, 130), { kb: 60, step: 12 }),
        mv("\u0E43\u0E1A\u0E02\u0E27\u0E32", "dslashB", [0.04, 0.06, 0.12, 0.3], 0.6, arc(104, 130), { kb: 60, step: 12 }),
        mv("\u0E43\u0E1A\u0E04\u0E39\u0E48", "cross", [0.05, 0.06, 0.13, 0.32], 0.7, arc(108, 140), { kb: 80, step: 14 }),
        mv("\u0E43\u0E1A\u0E1B\u0E25\u0E34\u0E27", "dslash", [0.05, 0.05, 0.2, 0.5], 0.4, proj("feather", 780, 8, { count: 4, spread: 40, homing: 2 }), {})
      ],
      charged: mv("\u0E1E\u0E32\u0E22\u0E38\u0E43\u0E1A\u0E2B\u0E22\u0E01", "twinSpin", [0.04, 0.24, 0.34, 0.6], 0.6, circ(130), { multi: 5, kb: 100, hitStop: 0.08, shake: 5 }),
      dash: mv("\u0E43\u0E1A\u0E44\u0E21\u0E49\u0E25\u0E2D\u0E22\u0E25\u0E21", "cross", [0.02, 0.08, 0.22, 0.5], 1.4, arc(118, 160), { kb: 180, step: 60, critBonus: 0.15 }),
      branch: mv("\u0E2B\u0E22\u0E01\u0E41\u0E15\u0E01", "twinSpin", [0.05, 0.16, 0.3, 0.6], 1.9, circ(120, 10), { kb: 240, slow: 0.6, hitStop: 0.07, shake: 4 })
    }
  ),
  w_sun_moon_twins: W(
    "w_sun_moon_twins",
    "twinblades",
    "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E31\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E32",
    "mythic",
    "t10",
    { atk: 63, crit: 0.18, critMult: 0.4, spd: 0.06 },
    {
      form: "sunmoontwins",
      blade: "#fff3c4",
      edge: "#ffffff",
      guard: "#e0b45a",
      grip: "#5a2a14",
      glow: "#ffcf5a",
      off: { blade: "#cfd6ff", edge: "#ffffff", guard: "#9fb8ff", grip: "#1a1e3a", glow: "#9fb8ff" }
    },
    "\u0E01\u0E25\u0E32\u0E07\u0E27\u0E31\u0E19\u0E01\u0E31\u0E1A\u0E01\u0E25\u0E32\u0E07\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C\u0E02\u0E31\u0E07\u0E44\u0E27\u0E49\u0E04\u0E19\u0E25\u0E30\u0E02\u0E38\u0E21 \u0E44\u0E14\u0E49\u0E1E\u0E1A\u0E01\u0E31\u0E19\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E19\u0E21\u0E37\u0E2D\u0E40\u0E14\u0E35\u0E22\u0E27",
    {
      combo: [
        mv("\u0E15\u0E30\u0E27\u0E31\u0E19\u0E01\u0E23\u0E35\u0E14", "dslash", [0.04, 0.06, 0.12, 0.3], 0.7, arc(110, 140), { kb: 70, step: 12, burn: true }),
        mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E01\u0E23\u0E35\u0E14", "dslashB", [0.04, 0.06, 0.12, 0.3], 0.7, arc(110, 140), { kb: 70, step: 12, slow: 0.7 }),
        mv("\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A", "cross", [0.05, 0.06, 0.13, 0.32], 0.85, arc(114, 150), { kb: 90, step: 14, burn: true }),
        mv("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E04\u0E23\u0E32\u0E2A", "cross", [0.05, 0.06, 0.13, 0.32], 0.85, arc(114, 150), { kb: 90, step: 14, slow: 0.6 }),
        mv("\u0E17\u0E34\u0E27\u0E32\u0E23\u0E32\u0E15\u0E23\u0E35", "twinSpin", [0.07, 0.14, 0.3, 0.65], 1.9, circ(130), { kb: 260, burn: true, hitStop: 0.08, shake: 5 })
      ],
      charged: mv("\u0E1F\u0E49\u0E32\u0E2A\u0E2D\u0E07\u0E14\u0E27\u0E07", "twinSpin", [0.04, 0.26, 0.34, 0.6], 2, rush(280, 60), { multi: 2, kb: 200, critBonus: 0.2, hitStop: 0.1, shake: 8 }),
      dash: mv("\u0E23\u0E38\u0E48\u0E07\u0E2A\u0E32\u0E07\u0E1E\u0E25\u0E1A\u0E04\u0E48\u0E33", "cross", [0.02, 0.08, 0.22, 0.5], 1.8, arc(124, 170), { teleport: "behind", forceCrit: true, kb: 180 }),
      branch: mv("\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E31\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E32\u0E1A\u0E23\u0E23\u0E08\u0E1A", "twinSpin", [0.06, 0.16, 0.3, 0.6], 1.3, proj("bolt", 640, 11, { count: 8, spread: 330, homing: 3 }), { burn: true })
    }
  ),
  w_shadow_fangs: W(
    "w_shadow_fangs",
    "twinblades",
    "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E40\u0E07\u0E32",
    "legendary",
    "t7",
    { atk: 48, crit: 0.16, spd: 0.05 },
    { form: "shadowtwins", blade: "#2a2438", edge: "#e0b0ff", guard: "#5a4a7a", grip: "#14101c", glow: "#c27ff0" },
    "\u0E42\u0E04\u0E49\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27 \u0E14\u0E33\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E0D\u0E0D\u0E15\u0E32\u0E17\u0E34\u0E49\u0E07\u0E44\u0E27\u0E49",
    {
      combo: [
        mv("\u0E40\u0E07\u0E32\u0E01\u0E31\u0E14", "dslash", [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv("\u0E40\u0E07\u0E32\u0E01\u0E31\u0E14\u0E0B\u0E49\u0E33", "dslashB", [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv("\u0E40\u0E07\u0E32\u0E2A\u0E32\u0E21", "dslash", [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv("\u0E40\u0E07\u0E32\u0E2A\u0E35\u0E48", "dslashB", [0.03, 0.05, 0.11, 0.28], 0.55, arc(100, 130), { kb: 50, step: 10, critBonus: 0.05 }),
        mv("\u0E40\u0E07\u0E32\u0E2B\u0E49\u0E32", "cross", [0.04, 0.06, 0.12, 0.3], 0.65, arc(104, 140), { kb: 60, step: 12, critBonus: 0.05 }),
        mv("\u0E40\u0E07\u0E32\u0E2B\u0E01", "cross", [0.04, 0.06, 0.12, 0.3], 0.65, arc(104, 140), { kb: 60, step: 12, critBonus: 0.05 }),
        mv("\u0E40\u0E07\u0E32\u0E40\u0E08\u0E47\u0E14\u0E01\u0E25\u0E37\u0E19\u0E01\u0E34\u0E19", "twinSpin", [0.06, 0.14, 0.3, 0.65], 1.7, circ(120), { kb: -200, mark: 0.15, hitStop: 0.07, shake: 4 })
      ],
      charged: mv("\u0E23\u0E49\u0E2D\u0E22\u0E40\u0E07\u0E32", "twinSpin", [0.04, 0.24, 0.32, 0.6], 0.5, rush(240, 56), { multi: 5, kb: 80, mark: 0.15, hitStop: 0.1, shake: 7 }),
      dash: mv("\u0E40\u0E07\u0E32\u0E2B\u0E25\u0E31\u0E07\u0E04\u0E2D", "cross", [0.02, 0.07, 0.22, 0.5], 2, arc(110, 150), { teleport: "behind", forceCrit: true, kb: 120 }),
      branch: mv("\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E40\u0E07\u0E32\u0E1B\u0E23\u0E30\u0E2A\u0E32\u0E19", "cross", [0.05, 0.1, 0.28, 0.6], 0.9, arc(120, 170), { multi: 3, kb: 100, critBonus: 0.15, hitStop: 0.08 })
    }
  )
});

// src/data/weapons3.js
var arc2 = (range, deg) => ({ shape: "arc", range, arc: deg });
var circ2 = (r, forward = 0) => ({ shape: "circle", r, forward });
var proj2 = (kind, speed, r, o = {}) => ({ shape: "proj", kind, speed, r, pierce: 0, count: 1, spread: 0, ...o });
var rush2 = (dist, width) => ({ shape: "rush", dist, width });
var zone2 = (r, delay, reach) => ({ shape: "zone", r, delay, reach });
var mv2 = (name, anim, t, power, hit, extra = {}) => ({ name, anim, windup: t[0], active: t[1], recover: t[2], cancel: t[3], power, hit, ...extra });
var W2 = (id, wtype, name, rarity, src, stats, art, desc, moves, extra = {}) => ({ id, wtype, name, category: "weapon", rarity, src, stats, art: { kind: "forge", ...art }, desc, moves, ...extra });
var WEAPONS_V8 = Object.freeze({
  w_prism_rapier: W2(
    "w_prism_rapier",
    "sword",
    "\u0E40\u0E23\u0E40\u0E1B\u0E35\u0E22\u0E23\u0E4C\u0E1B\u0E23\u0E34\u0E0B\u0E36\u0E21",
    "legendary",
    "z11",
    { atk: 58, crit: 0.16, critMult: 0.3 },
    { form: "prismrapier", blade: "#d8f0ff", edge: "#ffffff", guard: "#7fa8d8", grip: "#1e2a3a", glow: "#7fe8ff" },
    "\u0E14\u0E32\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E27\u0E17\u0E35\u0E48\u0E23\u0E32\u0E0A\u0E34\u0E19\u0E35\u0E01\u0E23\u0E30\u0E08\u0E01\u0E43\u0E0A\u0E49\u0E2A\u0E48\u0E2D\u0E07\u0E40\u0E07\u0E32\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07 \u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E41\u0E17\u0E07\u0E41\u0E15\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E2A\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E2B\u0E25\u0E32\u0E22\u0E40\u0E2A\u0E49\u0E19",
    {
      combo: [
        mv2("\u0E41\u0E17\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19", "thrust", [0.05, 0.06, 0.16, 0.32], 0.85, arc2(132, 30), { kb: 110, step: 22, critBonus: 0.08 }),
        mv2("\u0E41\u0E17\u0E07\u0E04\u0E39\u0E48\u0E40\u0E07\u0E32", "thrust", [0.05, 0.06, 0.16, 0.32], 0.5, arc2(132, 36), { multi: 2, kb: 90, step: 22 }),
        mv2("\u0E01\u0E27\u0E32\u0E14\u0E01\u0E23\u0E30\u0E08\u0E01", "slash", [0.07, 0.08, 0.2, 0.36], 1, arc2(112, 150), { kb: 160, step: 12, slow: 0.3 }),
        mv2("\u0E1B\u0E23\u0E34\u0E0B\u0E36\u0E21\u0E41\u0E15\u0E01", "thrust", [0.1, 0.08, 0.3, 0.6], 1.1, proj2("shard", 880, 9, { count: 4, spread: 26, pierce: 1 }), { critBonus: 0.15, shake: 3 })
      ],
      charged: mv2("\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E2B\u0E31\u0E01\u0E40\u0E2B", "thrust", [0.05, 0.1, 0.32, 0.6], 1.6, proj2("bigArrow", 1400, 11, { count: 3, spread: 18, pierce: 99 }), { critBonus: 0.3, shake: 5 }),
      dash: mv2("\u0E17\u0E30\u0E25\u0E38\u0E01\u0E23\u0E30\u0E08\u0E01", "thrust", [0.02, 0.1, 0.22, 0.45], 1.3, rush2(210, 36), { kb: 140, teleport: "behind", critBonus: 0.2 }),
      branch: mv2("\u0E01\u0E23\u0E07\u0E41\u0E2A\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19", "spin", [0.07, 0.14, 0.3, 0.6], 0.7, circ2(126), { multi: 3, kb: 60, slow: 0.5, hitStop: 0.06 })
    }
  ),
  w_eclipse_halberd: W2(
    "w_eclipse_halberd",
    "spear",
    "\u0E07\u0E49\u0E32\u0E27\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E08\u0E31\u0E19\u0E17\u0E23\u0E32",
    "legendary",
    "z12",
    { atk: 62, crit: 0.1, critMult: 0.25, hp: 60 },
    { form: "eclipsehalberd", head: "#2a2238", edge: "#ffd27a", shaft: "#3a2a20", trim: "#ffb648", glow: "#ffd27a" },
    "\u0E07\u0E49\u0E32\u0E27\u0E17\u0E35\u0E48\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A\u0E43\u0E0A\u0E49\u0E41\u0E1A\u0E48\u0E07\u0E01\u0E25\u0E32\u0E07\u0E27\u0E31\u0E19\u0E01\u0E31\u0E1A\u0E01\u0E25\u0E32\u0E07\u0E04\u0E37\u0E19 \u0E1F\u0E31\u0E19\u0E41\u0E23\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E2A\u0E07 \u0E1F\u0E31\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E07\u0E32",
    {
      combo: [
        mv2("\u0E1F\u0E31\u0E19\u0E15\u0E30\u0E27\u0E31\u0E19", "slash", [0.08, 0.09, 0.22, 0.38], 1, arc2(150, 110), { kb: 170, step: 14, burn: true }),
        mv2("\u0E1F\u0E31\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", "slashUp", [0.08, 0.09, 0.22, 0.38], 1, arc2(150, 110), { kb: 170, step: 14, slow: 0.35 }),
        mv2("\u0E41\u0E17\u0E07\u0E04\u0E23\u0E32\u0E2A", "thrust", [0.07, 0.07, 0.24, 0.4], 1.2, arc2(190, 26), { kb: 220, step: 26, mark: 0.1 }),
        mv2("\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E01\u0E27\u0E32\u0E14", "spin", [0.12, 0.14, 0.34, 0.7], 1.5, circ2(170), { kb: 280, shake: 5, hitStop: 0.07 })
      ],
      charged: mv2("\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A\u0E40\u0E15\u0E47\u0E21\u0E14\u0E27\u0E07", "overhead", [0.08, 0.1, 0.4, 0.7], 2.4, zone2(150, 0.35, 220), { burn: true, stun: 0.6, shake: 8 }),
      dash: mv2("\u0E1E\u0E38\u0E48\u0E07\u0E02\u0E49\u0E32\u0E21\u0E02\u0E2D\u0E1A\u0E1F\u0E49\u0E32", "thrust", [0.03, 0.14, 0.26, 0.5], 1.5, rush2(240, 50), { kb: 200 }),
      branch: mv2("\u0E01\u0E25\u0E32\u0E07\u0E27\u0E31\u0E19\u0E01\u0E25\u0E32\u0E07\u0E04\u0E37\u0E19", "slash", [0.07, 0.1, 0.3, 0.6], 0.9, arc2(160, 200), { multi: 2, kb: 140, burn: true, slow: 0.3, hitStop: 0.06 })
    }
  ),
  w_eclipse_blade: W2(
    "w_eclipse_blade",
    "greatsword",
    "\u0E14\u0E32\u0E1A\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A",
    "mythic",
    "rush",
    { atk: 92, crit: 0.18, critMult: 0.6, hp: 120, def: 10 },
    { form: "eclipseblade", blade: "#1a1424", edge: "#ffd27a", guard: "#e0b45a", grip: "#2a1410", glow: "#ffb648" },
    "\u0E14\u0E32\u0E1A\u0E14\u0E33\u0E2A\u0E19\u0E34\u0E17\u0E17\u0E35\u0E48\u0E21\u0E35\u0E27\u0E07\u0E41\u0E2A\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E25\u0E49\u0E2D\u0E21\u0E23\u0E2D\u0E1A \u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E2B\u0E19\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E21\u0E31\u0E19\u0E21\u0E32\u0E08\u0E32\u0E01\u0E44\u0E2B\u0E19 \u0E21\u0E35\u0E41\u0E15\u0E48\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E23\u0E2D\u0E2D\u0E22\u0E39\u0E48\u0E2A\u0E38\u0E14\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E25\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E25\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1A\u0E2D\u0E2A",
    {
      combo: [
        mv2("\u0E04\u0E23\u0E32\u0E2A\u0E41\u0E23\u0E01", "heavy", [0.1, 0.1, 0.24, 0.42], 1.3, arc2(132, 150), { kb: 240, step: 18, burn: true }),
        mv2("\u0E04\u0E23\u0E32\u0E2A\u0E22\u0E49\u0E2D\u0E19", "heavyUp", [0.1, 0.1, 0.24, 0.42], 1.3, arc2(132, 150), { kb: 240, step: 18, slow: 0.3 }),
        mv2("\u0E27\u0E07\u0E41\u0E2B\u0E27\u0E19\u0E14\u0E31\u0E1A\u0E41\u0E2A\u0E07", "spin", [0.12, 0.16, 0.3, 0.55], 1, circ2(160), { multi: 2, kb: 180, hitStop: 0.06 }),
        mv2("\u0E15\u0E30\u0E27\u0E31\u0E19\u0E14\u0E31\u0E1A", "overhead", [0.16, 0.12, 0.42, 0.8], 2.6, zone2(170, 0.3, 160), { stun: 0.8, burn: true, shake: 10, hitStop: 0.1 })
      ],
      charged: mv2("\u0E04\u0E23\u0E32\u0E2A\u0E40\u0E15\u0E47\u0E21\u0E14\u0E27\u0E07", "overhead", [0.08, 0.12, 0.46, 0.8], 3.6, proj2("bigArrow", 1100, 22, { count: 5, spread: 40, pierce: 99 }), { critBonus: 0.3, burn: true, shake: 12, hitStop: 0.12 }),
      dash: mv2("\u0E40\u0E07\u0E32\u0E02\u0E49\u0E32\u0E21\u0E15\u0E30\u0E27\u0E31\u0E19", "thrust", [0.02, 0.14, 0.28, 0.5], 1.9, rush2(260, 70), { kb: 260, teleport: "behind", forceCrit: true }),
      branch: mv2("\u0E41\u0E2A\u0E07\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22", "heavy", [0.1, 0.12, 0.36, 0.7], 0.9, arc2(170, 240), { multi: 4, kb: 160, burn: true, mark: 0.15, hitStop: 0.08, shake: 6 })
    },
    { secret: true, secretUlt: true, unique: "eclipse", noCraft: true }
  )
});
var MATS_V8 = Object.freeze({
  m_mirror_shard: { id: "m_mirror_shard", name: "\u0E40\u0E28\u0E29\u0E01\u0E23\u0E30\u0E08\u0E01\u0E23\u0E32\u0E0A\u0E34\u0E19\u0E35", category: "material", rarity: "epic", sellPrice: 150, src: "z11", art: { kind: "shard", main: "#bfe8ff" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E23\u0E32\u0E0A\u0E34\u0E19\u0E35\u0E01\u0E23\u0E30\u0E08\u0E01\u0E41\u0E15\u0E01 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_eclipse_core: { id: "m_eclipse_core", name: "\u0E41\u0E01\u0E19\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A", category: "material", rarity: "epic", sellPrice: 170, src: "z12", art: { kind: "core", main: "#ffb648", glow: "#6a4aa8" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" }
});

// src/data/items2.js
var A = (id, name, rarity, src, stats, art, desc) => ({ id, name, category: "armor", rarity, src, stats, art: { kind: "forge", ...art }, desc });
var ARMORS_V7 = Object.freeze({
  // tower band 1–2
  a_river_ferryman: A(
    "a_river_ferryman",
    "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E04\u0E25\u0E38\u0E21\u0E04\u0E19\u0E41\u0E08\u0E27\u0E40\u0E23\u0E37\u0E2D\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    "rare",
    "t1",
    { def: 11, hp: 50, spd: 0.03 },
    { chest: "robe", shoulder: "none", skirt: "robe", emblem: "wave", arm: "wide", main: "#2a3a4a", trim: "#7fe8ff", accent: "#c8e8ff" },
    "\u0E04\u0E19\u0E41\u0E08\u0E27\u0E40\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E32\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E43\u0E2A\u0E48\u0E0A\u0E38\u0E14\u0E19\u0E35\u0E49\u0E21\u0E32\u0E1E\u0E31\u0E19\u0E1B\u0E35 \u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E40\u0E1B\u0E35\u0E22\u0E01"
  ),
  a_chain_warden: A(
    "a_chain_warden",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E1C\u0E39\u0E49\u0E04\u0E38\u0E21\u0E42\u0E0B\u0E48",
    "rare",
    "t2",
    { def: 14, hp: 60 },
    { chest: "chain", shoulder: "round", skirt: "tassets", emblem: "chain", arm: "chain", main: "#5a5a62", trim: "#8e2c21", accent: "#b8b8c4" },
    "\u0E17\u0E38\u0E01\u0E2B\u0E48\u0E27\u0E07\u0E42\u0E0B\u0E48\u0E1A\u0E19\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E04\u0E22\u0E25\u0E48\u0E32\u0E21\u0E43\u0E04\u0E23\u0E1A\u0E32\u0E07\u0E04\u0E19\u0E44\u0E27\u0E49"
  ),
  a_moss_ranger: A(
    "a_moss_ranger",
    "\u0E0A\u0E38\u0E14\u0E1E\u0E23\u0E32\u0E19\u0E21\u0E2D\u0E2A",
    "uncommon",
    "t1",
    { def: 8, hp: 36, spd: 0.04 },
    { chest: "leaf", shoulder: "feather", skirt: "fringe", emblem: "leaf", arm: "bracer", main: "#3a5a2a", trim: "#a5c76c", accent: "#d6f59a" },
    "\u0E1E\u0E23\u0E32\u0E07\u0E15\u0E31\u0E27\u0E43\u0E19\u0E1B\u0E48\u0E32\u0E44\u0E14\u0E49\u0E14\u0E35\u0E08\u0E19\u0E19\u0E01\u0E21\u0E32\u0E40\u0E01\u0E32\u0E30\u0E44\u0E2B\u0E25\u0E48"
  ),
  a_ember_apprentice: A(
    "a_ember_apprentice",
    "\u0E0A\u0E38\u0E14\u0E1D\u0E36\u0E01\u0E2B\u0E31\u0E14\u0E0A\u0E48\u0E32\u0E07\u0E16\u0E48\u0E32\u0E19",
    "uncommon",
    "t2",
    { def: 9, hp: 40, atk: 2 },
    { chest: "harness", shoulder: "none", skirt: "kilt", emblem: "flame", arm: "bracer", main: "#6a3a24", trim: "#ff8a3d", accent: "#ffd08a" },
    "\u0E21\u0E35\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E17\u0E38\u0E01\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E44\u0E1F\u0E40\u0E04\u0E22\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E43\u0E2A\u0E48"
  ),
  // band 3–4
  a_hellfire_vest: A(
    "a_hellfire_vest",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E44\u0E1F\u0E19\u0E23\u0E01\u0E02\u0E38\u0E21\u0E2A\u0E32\u0E21",
    "epic",
    "t3",
    { def: 19, hp: 85, atk: 5 },
    { chest: "scale", shoulder: "spike", skirt: "tassets", emblem: "flame", arm: "spiked", main: "#5a1a10", trim: "#ff5a1a", accent: "#ffcf5a" },
    "\u0E22\u0E31\u0E07\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E19\u0E08\u0E31\u0E1A\u0E21\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49"
  ),
  a_silent_shroud: A(
    "a_silent_shroud",
    "\u0E1C\u0E49\u0E32\u0E04\u0E25\u0E38\u0E21\u0E44\u0E23\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E07",
    "epic",
    "t4",
    { def: 15, hp: 70, crit: 0.06, spd: 0.05 },
    { chest: "robe", shoulder: "layered", skirt: "tails", emblem: "eye", arm: "wide", main: "#1a1a24", trim: "#5a5a7a", accent: "#c8c8ff" },
    "\u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21\u0E40\u0E14\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E2B\u0E49\u0E2D\u0E07\u0E42\u0E16\u0E07\u0E2B\u0E34\u0E19\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19"
  ),
  a_bone_vanguard: A(
    "a_bone_vanguard",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E01\u0E2D\u0E07\u0E2B\u0E19\u0E49\u0E32",
    "epic",
    "t3",
    { def: 21, hp: 90 },
    { chest: "bone", shoulder: "horn", skirt: "fringe", emblem: "skull", arm: "spiked", main: "#3a2a20", trim: "#e8dcc0", accent: "#9fffd8" },
    "\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E40\u0E2B\u0E25\u0E48\u0E32\u0E19\u0E35\u0E49\u0E40\u0E04\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E2D\u0E07\u0E19\u0E31\u0E01\u0E23\u0E1A\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E25\u0E49\u0E21"
  ),
  a_frost_lamellar: A(
    "a_frost_lamellar",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E01\u0E25\u0E47\u0E14\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07",
    "epic",
    "t4",
    { def: 22, hp: 80, critMult: 0.1 },
    { chest: "lamellar", shoulder: "crystal", skirt: "tassets", emblem: "star", arm: "bracer", main: "#4a6a8a", trim: "#e8f8ff", accent: "#9fd8ff" },
    "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E40\u0E23\u0E35\u0E22\u0E07\u0E01\u0E31\u0E19\u0E41\u0E19\u0E48\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E01\u0E23\u0E32\u0E30\u0E0B\u0E32\u0E21\u0E39\u0E44\u0E23"
  ),
  a_wanderer_fur: A(
    "a_wanderer_fur",
    "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E02\u0E19\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E19\u0E31\u0E01\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07",
    "rare",
    "t3",
    { def: 13, hp: 65, spd: 0.02 },
    { chest: "fur", shoulder: "fur", skirt: "kilt", emblem: "none", arm: "plain", main: "#6a4a30", trim: "#e8d8b0", accent: "#a07850" },
    "\u0E2D\u0E38\u0E48\u0E19\u0E1E\u0E2D\u0E08\u0E30\u0E19\u0E2D\u0E19\u0E01\u0E25\u0E32\u0E07\u0E2B\u0E34\u0E21\u0E30\u0E44\u0E14\u0E49\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E04\u0E37\u0E19"
  ),
  // band 5–6
  a_judge_mantle: A(
    "a_judge_mantle",
    "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E04\u0E25\u0E38\u0E21\u0E1C\u0E39\u0E49\u0E0A\u0E31\u0E48\u0E07\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    "legendary",
    "t5",
    { def: 26, hp: 120, crit: 0.05 },
    { chest: "plate", shoulder: "layered", skirt: "robe", emblem: "eye", arm: "bracer", main: "#2a2a3a", trim: "#e0b45a", accent: "#ffffff" },
    "\u0E25\u0E32\u0E22\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E1A\u0E19\u0E2D\u0E01\u0E40\u0E2D\u0E35\u0E22\u0E07\u0E44\u0E1B\u0E17\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E43\u0E08\u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21"
  ),
  a_serpent_scale: A(
    "a_serpent_scale",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E01\u0E25\u0E47\u0E14\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C",
    "legendary",
    "t6",
    { def: 27, hp: 115, spd: 0.04 },
    { chest: "scale", shoulder: "round", skirt: "tails", emblem: "wave", arm: "chain", main: "#1a3a2a", trim: "#a8d070", accent: "#e8ff9a" },
    "\u0E25\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E04\u0E23\u0E32\u0E1A\u0E02\u0E2D\u0E07\u0E40\u0E17\u0E1E\u0E2D\u0E2A\u0E23\u0E1E\u0E34\u0E29 \u0E22\u0E31\u0E07\u0E25\u0E37\u0E48\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E21\u0E35\u0E0A\u0E35\u0E27\u0E34\u0E15"
  ),
  a_crystal_aegis: A(
    "a_crystal_aegis",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E1C\u0E25\u0E36\u0E01\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C",
    "legendary",
    "t5",
    { def: 32, hp: 110, spd: -0.04 },
    { chest: "crystal", shoulder: "crystal", skirt: "none", emblem: "star", arm: "bracer", main: "#3a5a7a", trim: "#bfe8ff", accent: "#ffffff" },
    "\u0E41\u0E2A\u0E07\u0E2B\u0E31\u0E01\u0E40\u0E2B\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E01\u0E23\u0E32\u0E30\u0E08\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E25\u0E47\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01"
  ),
  a_rune_harness: A(
    "a_rune_harness",
    "\u0E2A\u0E32\u0E22\u0E23\u0E31\u0E14\u0E2D\u0E31\u0E01\u0E02\u0E23\u0E30\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32",
    "epic",
    "t6",
    { def: 18, hp: 80, atk: 6, crit: 0.05 },
    { chest: "harness", shoulder: "spike", skirt: "fringe", emblem: "rune", arm: "spiked", main: "#2a1a14", trim: "#c27ff0", accent: "#e0b0ff" },
    "\u0E2D\u0E31\u0E01\u0E02\u0E23\u0E30\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21\u0E06\u0E48\u0E32\u0E40\u0E2B\u0E22\u0E37\u0E48\u0E2D"
  ),
  // band 7–8
  a_clockwork_plate: A(
    "a_clockwork_plate",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E1F\u0E37\u0E2D\u0E07\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E15\u0E32\u0E22",
    "legendary",
    "t7",
    { def: 30, hp: 130, spd: 0.05 },
    { chest: "plate", shoulder: "round", skirt: "tassets", emblem: "sun", arm: "chain", main: "#5a4a30", trim: "#c8a050", accent: "#fff3c4" },
    "\u0E40\u0E1F\u0E37\u0E2D\u0E07\u0E43\u0E19\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E14\u0E34\u0E19\u0E16\u0E2D\u0E22\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E2A\u0E21\u0E2D"
  ),
  a_thousand_mask: A(
    "a_thousand_mask",
    "\u0E2D\u0E32\u0E20\u0E23\u0E13\u0E4C\u0E1E\u0E31\u0E19\u0E2B\u0E19\u0E49\u0E32",
    "legendary",
    "t8",
    { def: 24, hp: 110, crit: 0.1, critMult: 0.2 },
    { chest: "robe", shoulder: "feather", skirt: "tails", emblem: "moon", arm: "wide", main: "#3a1a3a", trim: "#ff5a9a", accent: "#ffd0e0" },
    "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E21\u0E2D\u0E07\u0E01\u0E23\u0E30\u0E08\u0E01 \u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21\u0E08\u0E30\u0E40\u0E2B\u0E47\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19"
  ),
  a_storm_knight: A(
    "a_storm_knight",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E2D\u0E31\u0E28\u0E27\u0E34\u0E19\u0E1E\u0E32\u0E22\u0E38",
    "legendary",
    "t7",
    { def: 31, hp: 125, atk: 6 },
    { chest: "plate", shoulder: "spike", skirt: "kilt", emblem: "star", arm: "spiked", main: "#3a4a6a", trim: "#ffe65a", accent: "#fff9c4" },
    "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E27\u0E34\u0E48\u0E07\u0E15\u0E32\u0E21\u0E23\u0E2D\u0E22\u0E15\u0E48\u0E2D\u0E02\u0E2D\u0E07\u0E40\u0E01\u0E23\u0E32\u0E30\u0E44\u0E21\u0E48\u0E2B\u0E22\u0E38\u0E14"
  ),
  a_ash_monk: A(
    "a_ash_monk",
    "\u0E08\u0E35\u0E27\u0E23\u0E1E\u0E23\u0E30\u0E40\u0E16\u0E49\u0E32",
    "epic",
    "t8",
    { def: 20, hp: 100, crit: 0.04, spd: 0.06 },
    { chest: "robe", shoulder: "none", skirt: "fringe", emblem: "sun", arm: "wide", main: "#8a5a3a", trim: "#ffd08a", accent: "#fff3c4" },
    "\u0E2B\u0E48\u0E21\u0E44\u0E27\u0E49\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07 \u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E41\u0E02\u0E19\u0E2D\u0E35\u0E01\u0E02\u0E49\u0E32\u0E07\u0E27\u0E48\u0E32\u0E07\u0E44\u0E27\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1D\u0E48\u0E32\u0E21\u0E37\u0E2D"
  ),
  // band 9–10
  a_glacier_bastion: A(
    "a_glacier_bastion",
    "\u0E1B\u0E49\u0E2D\u0E21\u0E18\u0E32\u0E23\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E19\u0E23\u0E01",
    "mythic",
    "t9",
    { def: 44, hp: 190, spd: -0.05 },
    { chest: "crystal", shoulder: "layered", skirt: "tassets", emblem: "moon", arm: "bracer", main: "#2a4a6a", trim: "#e8f8ff", accent: "#7fe8ff" },
    "\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E19\u0E32\u0E27\u0E08\u0E32\u0E01\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E17\u0E35\u0E48\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E41\u0E0A\u0E48\u0E41\u0E02\u0E47\u0E07\u0E41\u0E21\u0E49\u0E41\u0E15\u0E48\u0E40\u0E27\u0E25\u0E32"
  ),
  a_netherking_regalia: A(
    "a_netherking_regalia",
    "\u0E09\u0E25\u0E2D\u0E07\u0E1E\u0E23\u0E30\u0E2D\u0E07\u0E04\u0E4C\u0E23\u0E32\u0E0A\u0E31\u0E19\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01",
    "mythic",
    "t10",
    { def: 46, hp: 200, atk: 10, crit: 0.08, critMult: 0.25 },
    { chest: "plate", shoulder: "horn", skirt: "robe", emblem: "skull", arm: "spiked", main: "#1a0a10", trim: "#ff3a3a", accent: "#f5c35a" },
    "\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C\u0E2A\u0E27\u0E21\u0E0A\u0E38\u0E14\u0E19\u0E35\u0E49\u0E15\u0E2D\u0E19\u0E19\u0E31\u0E48\u0E07\u0E1A\u0E19\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C \u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E21\u0E31\u0E19\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E41\u0E25\u0E49\u0E27"
  ),
  a_void_wrap: A(
    "a_void_wrap",
    "\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E27\u0E48\u0E32\u0E07",
    "legendary",
    "t9",
    { def: 28, hp: 140, spd: 0.07, crit: 0.06 },
    { chest: "harness", shoulder: "layered", skirt: "tails", emblem: "eye", arm: "chain", main: "#14121c", trim: "#7a4aff", accent: "#b89aff" },
    "\u0E1C\u0E49\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E07\u0E32 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E41\u0E2A\u0E07\u0E43\u0E14\u0E46"
  ),
  // zones, raids and the shop
  a_gale_vest: A(
    "a_gale_vest",
    "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E01\u0E31\u0E4A\u0E01\u0E25\u0E21\u0E01\u0E23\u0E14",
    "uncommon",
    "z1",
    { def: 7, hp: 32, spd: 0.05 },
    { chest: "lamellar", shoulder: "feather", skirt: "none", emblem: "none", arm: "plain", main: "#5a8a7a", trim: "#e6fff6", accent: "#c6ece2" },
    "\u0E40\u0E1A\u0E32\u0E08\u0E19\u0E25\u0E21\u0E41\u0E17\u0E1A\u0E1E\u0E31\u0E14\u0E1B\u0E25\u0E34\u0E27"
  ),
  a_marsh_waders: A(
    "a_marsh_waders",
    "\u0E0A\u0E38\u0E14\u0E25\u0E38\u0E22\u0E1A\u0E36\u0E07",
    "rare",
    "z3",
    { def: 12, hp: 55 },
    { chest: "fur", shoulder: "round", skirt: "fringe", emblem: "leaf", arm: "bracer", main: "#4a5a3a", trim: "#c27ff0", accent: "#e8ff9a" },
    "\u0E01\u0E31\u0E19\u0E1E\u0E34\u0E29\u0E44\u0E14\u0E49\u0E16\u0E36\u0E07\u0E40\u0E2D\u0E27 \u0E2A\u0E48\u0E27\u0E19\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E40\u0E2D\u0E27\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E30\u0E27\u0E31\u0E07\u0E40\u0E2D\u0E07"
  ),
  a_dune_wrap: A(
    "a_dune_wrap",
    "\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E01\u0E32\u0E22\u0E17\u0E30\u0E40\u0E25\u0E17\u0E23\u0E32\u0E22",
    "rare",
    "z5",
    { def: 11, hp: 52, crit: 0.04 },
    { chest: "robe", shoulder: "none", skirt: "kilt", emblem: "sun", arm: "wide", main: "#c8a46a", trim: "#7fd0c0", accent: "#f3dca0" },
    "\u0E01\u0E31\u0E19\u0E41\u0E14\u0E14\u0E01\u0E31\u0E19\u0E17\u0E23\u0E32\u0E22 \u0E41\u0E25\u0E30\u0E0B\u0E48\u0E2D\u0E19\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E44\u0E14\u0E49\u0E2A\u0E32\u0E21\u0E40\u0E25\u0E48\u0E21"
  ),
  a_spore_coat: A(
    "a_spore_coat",
    "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E04\u0E25\u0E38\u0E21\u0E40\u0E2B\u0E47\u0E14\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07",
    "rare",
    "z6",
    { def: 12, hp: 58, spd: 0.02 },
    { chest: "leaf", shoulder: "round", skirt: "tails", emblem: "star", arm: "plain", main: "#5a3a6a", trim: "#9fffd8", accent: "#f0d0ff" },
    "\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E2D\u0E48\u0E2D\u0E19\u0E46 \u0E43\u0E19\u0E17\u0E35\u0E48\u0E21\u0E37\u0E14 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E1E\u0E01\u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07"
  ),
  a_foundry_plate: A(
    "a_foundry_plate",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21",
    "epic",
    "z7",
    { def: 20, hp: 85, spd: -0.03 },
    { chest: "plate", shoulder: "layered", skirt: "kilt", emblem: "chain", arm: "bracer", main: "#5a5650", trim: "#ffcf5a", accent: "#ffe65a" },
    "\u0E2B\u0E21\u0E38\u0E14\u0E22\u0E49\u0E33\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E15\u0E35\u0E14\u0E49\u0E27\u0E22\u0E04\u0E49\u0E2D\u0E19\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32"
  ),
  a_magma_scale: A(
    "a_magma_scale",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E01\u0E25\u0E47\u0E14\u0E25\u0E32\u0E27\u0E32",
    "epic",
    "z8",
    { def: 21, hp: 88, atk: 4 },
    { chest: "scale", shoulder: "horn", skirt: "fringe", emblem: "flame", arm: "chain", main: "#3a1a14", trim: "#ff7a33", accent: "#ffb35a" },
    "\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E40\u0E01\u0E25\u0E47\u0E14\u0E21\u0E35\u0E25\u0E32\u0E27\u0E32\u0E44\u0E2B\u0E25\u0E40\u0E1A\u0E32\u0E46"
  ),
  a_sky_vestment: A(
    "a_sky_vestment",
    "\u0E2D\u0E32\u0E20\u0E23\u0E13\u0E4C\u0E1F\u0E49\u0E32",
    "epic",
    "z9",
    { def: 18, hp: 82, crit: 0.05, spd: 0.04 },
    { chest: "robe", shoulder: "feather", skirt: "robe", emblem: "sun", arm: "bracer", main: "#e8f0ff", trim: "#5fa8ec", accent: "#ffe65a" },
    "\u0E2A\u0E27\u0E21\u0E41\u0E25\u0E49\u0E27\u0E15\u0E31\u0E27\u0E40\u0E1A\u0E32\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E14\u0E34\u0E19\u0E1A\u0E19\u0E40\u0E21\u0E06"
  ),
  a_ashen_guard: A(
    "a_ashen_guard",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E2D\u0E07\u0E04\u0E23\u0E31\u0E01\u0E29\u0E4C\u0E40\u0E16\u0E49\u0E32",
    "epic",
    "z10",
    { def: 23, hp: 95, critMult: 0.1 },
    { chest: "lamellar", shoulder: "spike", skirt: "tassets", emblem: "skull", arm: "spiked", main: "#3a3330", trim: "#e0b45a", accent: "#ff8a3d" },
    "\u0E2D\u0E07\u0E04\u0E23\u0E31\u0E01\u0E29\u0E4C\u0E02\u0E2D\u0E07\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E40\u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E16\u0E2D\u0E14\u0E40\u0E01\u0E23\u0E32\u0E30\u0E19\u0E35\u0E49"
  ),
  a_traveler_tunic: A(
    "a_traveler_tunic",
    "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07",
    "common",
    "shop",
    { def: 5, hp: 26 },
    { chest: "harness", shoulder: "none", skirt: "none", emblem: "none", arm: "plain", main: "#6a5a4a", trim: "#c9a46a", accent: "#e8d8b0" },
    "\u0E17\u0E19\u0E17\u0E32\u0E19 \u0E23\u0E32\u0E04\u0E32\u0E44\u0E21\u0E48\u0E41\u0E1E\u0E07 \u0E0B\u0E48\u0E2D\u0E21\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19"
  ),
  a_militia_mail: A(
    "a_militia_mail",
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E42\u0E0B\u0E48\u0E2D\u0E32\u0E2A\u0E32",
    "uncommon",
    "shop",
    { def: 9, hp: 38 },
    { chest: "chain", shoulder: "none", skirt: "kilt", emblem: "none", arm: "chain", main: "#7a7a82", trim: "#5a3a24", accent: "#c8c8d0" },
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E2D\u0E32\u0E2A\u0E32\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E40\u0E1D\u0E49\u0E32\u0E04\u0E48\u0E32\u0E22"
  )
});
var R = (id, name, rarity, desc, color) => ({ id, name, category: "material", rarity, sellPrice: { rare: 60, epic: 120, legendary: 240, mythic: 600 }[rarity], art: { kind: "relic", main: color }, desc });
var RELICS_V7 = Object.freeze({
  m_hell1: R("m_hell1", "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", "rare", "\u0E2B\u0E22\u0E14\u0E19\u0E49\u0E33\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E41\u0E2B\u0E49\u0E07 \u0E08\u0E32\u0E01\u0E40\u0E17\u0E1E\u0E1C\u0E39\u0E49\u0E41\u0E08\u0E27\u0E40\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E32\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13 (\u0E0A\u0E31\u0E49\u0E19 10)", "#7fe8ff"),
  m_hell2: R("m_hell2", "\u0E02\u0E49\u0E2D\u0E42\u0E0B\u0E48\u0E15\u0E23\u0E27\u0E19\u0E19\u0E34\u0E23\u0E31\u0E19\u0E14\u0E23\u0E4C", "rare", "\u0E2B\u0E48\u0E27\u0E07\u0E42\u0E0B\u0E48\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E2C\u0E42\u0E25\u0E2B\u0E34\u0E15 \u0E2B\u0E19\u0E31\u0E01\u0E40\u0E01\u0E34\u0E19\u0E02\u0E19\u0E32\u0E14\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19 (\u0E0A\u0E31\u0E49\u0E19 20)", "#b8b8c4"),
  m_hell3: R("m_hell3", "\u0E16\u0E48\u0E32\u0E19\u0E44\u0E1F\u0E19\u0E23\u0E01", "epic", "\u0E16\u0E48\u0E32\u0E19\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E21\u0E2D\u0E14 \u0E08\u0E32\u0E01\u0E21\u0E32\u0E23\u0E35\u0E08\u0E34 \u0E40\u0E17\u0E1E\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E19\u0E23\u0E01 (\u0E0A\u0E31\u0E49\u0E19 30)", "#ff5a1a"),
  m_hell4: R("m_hell4", "\u0E40\u0E28\u0E29\u0E40\u0E07\u0E32\u0E44\u0E23\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E07", "epic", "\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E17\u0E35\u0E48\u0E15\u0E01\u0E15\u0E30\u0E01\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E2A\u0E38\u0E0D\u0E0D\u0E15\u0E32 (\u0E0A\u0E31\u0E49\u0E19 40)", "#5a5a7a"),
  m_hell5: R("m_hell5", "\u0E08\u0E32\u0E19\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", "epic", "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E22\u0E21\u0E17\u0E31\u0E13\u0E11\u0E4C (\u0E0A\u0E31\u0E49\u0E19 50)", "#e0b45a"),
  m_hell6: R("m_hell6", "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C\u0E19\u0E23\u0E01", "legendary", "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E17\u0E35\u0E48\u0E25\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E17\u0E1E\u0E2D\u0E2A\u0E23\u0E1E\u0E34\u0E29 (\u0E0A\u0E31\u0E49\u0E19 60)", "#a8d070"),
  m_hell7: R("m_hell7", "\u0E40\u0E02\u0E47\u0E21\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E21\u0E23\u0E13\u0E30", "legendary", "\u0E40\u0E02\u0E47\u0E21\u0E17\u0E35\u0E48\u0E23\u0E32\u0E15\u0E23\u0E35\u0E01\u0E32\u0E25\u0E43\u0E0A\u0E49\u0E19\u0E31\u0E1A\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E02\u0E2D\u0E07\u0E17\u0E38\u0E01\u0E0A\u0E35\u0E27\u0E34\u0E15 (\u0E0A\u0E31\u0E49\u0E19 70)", "#fff3c4"),
  m_hell8: R("m_hell8", "\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E32\u0E01\u0E1E\u0E31\u0E19\u0E2B\u0E19\u0E49\u0E32", "legendary", "\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E32\u0E01\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E43\u0E19\u0E1E\u0E31\u0E19\u0E02\u0E2D\u0E07\u0E17\u0E28\u0E1E\u0E31\u0E01\u0E15\u0E23\u0E4C\u0E21\u0E32\u0E23 (\u0E0A\u0E31\u0E49\u0E19 80)", "#ff5a9a"),
  m_hell9: R("m_hell9", "\u0E1C\u0E25\u0E36\u0E01\u0E02\u0E38\u0E21\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07", "mythic", "\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E19\u0E32\u0E27\u0E17\u0E35\u0E48\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E08\u0E32\u0E01\u0E2D\u0E2A\u0E38\u0E23\u0E40\u0E2B\u0E21 (\u0E0A\u0E31\u0E49\u0E19 90)", "#cfeaff"),
  m_hell10: R("m_hell10", "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C", "mythic", "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E02\u0E2D\u0E07\u0E23\u0E32\u0E0A\u0E31\u0E19\u0E41\u0E2B\u0E48\u0E07\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01 (\u0E0A\u0E31\u0E49\u0E19 100)", "#ff3a3a")
});
var TOWER_PARTS = Object.freeze({ t1: "m_hell1", t2: "m_hell2", t3: "m_hell3", t4: "m_hell4", t5: "m_hell5", t6: "m_hell6", t7: "m_hell7", t8: "m_hell8", t9: "m_hell9", t10: "m_hell10" });

// src/data/items.js
var BASE_ITEMS = {
  // ---- weapons
  w_rust_blade: {
    id: "w_rust_blade",
    wtype: "sword",
    name: "\u0E14\u0E32\u0E1A\u0E2A\u0E19\u0E34\u0E21\u0E40\u0E01\u0E48\u0E32",
    category: "weapon",
    rarity: "common",
    stats: { atk: 8, crit: 0.03 },
    art: { kind: "blade", blade: "#a9a39a", edge: "#d7d1c4", guard: "#6d4a2c", grip: "#3b2a20" },
    desc: "\u0E14\u0E32\u0E1A\u0E40\u0E01\u0E48\u0E32\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E04\u0E21\u0E1E\u0E2D\u0E08\u0E30\u0E43\u0E0A\u0E49\u0E25\u0E48\u0E32\u0E44\u0E14\u0E49"
  },
  w_hunter_saber: {
    id: "w_hunter_saber",
    wtype: "sword",
    name: "\u0E14\u0E32\u0E1A\u0E19\u0E32\u0E22\u0E1E\u0E23\u0E32\u0E19",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 13, crit: 0.05 },
    art: { kind: "saber", blade: "#c7ccd1", edge: "#f1f3f4", guard: "#b07a2e", grip: "#4a2f22" },
    desc: "\u0E14\u0E32\u0E1A\u0E42\u0E04\u0E49\u0E07\u0E40\u0E1A\u0E32\u0E21\u0E37\u0E2D \u0E1F\u0E31\u0E19\u0E44\u0E14\u0E49\u0E44\u0E27"
  },
  w_thorn_edge: {
    id: "w_thorn_edge",
    wtype: "sword",
    name: "\u0E14\u0E32\u0E1A\u0E04\u0E21\u0E2B\u0E19\u0E32\u0E21",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 19, crit: 0.08 },
    art: { kind: "thorn", blade: "#6f9a5b", edge: "#cfe3a8", guard: "#5a3a24", grip: "#2e2019" },
    desc: "\u0E2B\u0E25\u0E48\u0E2D\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E2B\u0E25\u0E31\u0E07\u0E2B\u0E19\u0E32\u0E21"
  },
  w_ember_fang: {
    id: "w_ember_fang",
    wtype: "sword",
    name: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2D\u0E31\u0E04\u0E04\u0E35",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 27, crit: 0.1, critMult: 0.2 },
    art: { kind: "fang", blade: "#c4492e", edge: "#ffc979", guard: "#2a1a14", grip: "#1c1210", glow: "#ff8a3d" },
    desc: "\u0E22\u0E31\u0E07\u0E2D\u0E38\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E40\u0E2A\u0E21\u0E2D \u0E41\u0E21\u0E49\u0E43\u0E19\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E32\u0E27\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14"
  },
  // ---- katana (ดาบซามูไร): fast 4-hit combo, charged iai dash
  w_ronin_katana: {
    id: "w_ronin_katana",
    wtype: "katana",
    name: "\u0E14\u0E32\u0E1A\u0E0B\u0E32\u0E21\u0E39\u0E44\u0E23\u0E1E\u0E40\u0E19\u0E08\u0E23",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 12, crit: 0.08 },
    art: { kind: "katana", blade: "#c9cfd6", edge: "#f4f6f8", guard: "#2a1a14", grip: "#6e2a22", wrap: "#e8d9b8" },
    desc: "\u0E04\u0E21\u0E1A\u0E32\u0E07\u0E40\u0E1A\u0E32 \u0E0A\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E1D\u0E31\u0E01\u0E44\u0E14\u0E49\u0E43\u0E19\u0E1E\u0E23\u0E34\u0E1A\u0E15\u0E32"
  },
  w_mist_katana: {
    id: "w_mist_katana",
    wtype: "katana",
    name: "\u0E14\u0E32\u0E1A\u0E0B\u0E32\u0E21\u0E39\u0E44\u0E23\u0E2A\u0E32\u0E22\u0E2B\u0E21\u0E2D\u0E01",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 17, crit: 0.12 },
    art: { kind: "katana", blade: "#b9d3d9", edge: "#f0fbff", guard: "#3a4a50", grip: "#24323a", wrap: "#9fc4cc" },
    desc: "\u0E43\u0E1A\u0E14\u0E32\u0E1A\u0E40\u0E22\u0E47\u0E19\u0E40\u0E09\u0E35\u0E22\u0E1A\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E2B\u0E21\u0E2D\u0E01\u0E22\u0E32\u0E21\u0E40\u0E0A\u0E49\u0E32"
  },
  w_moonfall_katana: {
    id: "w_moonfall_katana",
    wtype: "katana",
    name: "\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E23\u0E48\u0E27\u0E07",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 24, crit: 0.15, critMult: 0.25 },
    art: { kind: "katana", blade: "#dcd6ff", edge: "#ffffff", guard: "#e0b45a", grip: "#1c1430", wrap: "#7a62c8", glow: "#b9a8ff" },
    desc: "\u0E27\u0E48\u0E32\u0E01\u0E31\u0E19\u0E27\u0E48\u0E32\u0E1F\u0E31\u0E19\u0E41\u0E2A\u0E07\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E43\u0E2B\u0E49\u0E02\u0E32\u0E14\u0E44\u0E14\u0E49"
  },
  // ---- dagger (ดาบเล็กคู่): 5-hit flurry, dodge-cancel anytime, backstab after a dodge
  w_twin_fangs: {
    id: "w_twin_fangs",
    wtype: "dagger",
    name: "\u0E21\u0E35\u0E14\u0E04\u0E39\u0E48\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E07\u0E39",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 10, crit: 0.12 },
    art: { kind: "dagger", blade: "#b8bcc0", edge: "#eef0f2", guard: "#7a5a3c", grip: "#3b2a20" },
    desc: "\u0E2A\u0E31\u0E49\u0E19 \u0E40\u0E23\u0E47\u0E27 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E43\u0E2B\u0E49\u0E40\u0E2B\u0E22\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E49\u0E07\u0E15\u0E31\u0E27"
  },
  w_venom_daggers: {
    id: "w_venom_daggers",
    wtype: "dagger",
    name: "\u0E21\u0E35\u0E14\u0E04\u0E39\u0E48\u0E2B\u0E19\u0E32\u0E21\u0E1E\u0E34\u0E29",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 15, crit: 0.16 },
    art: { kind: "dagger", blade: "#7fae5c", edge: "#d6f0a8", guard: "#3a2a20", grip: "#2a1d16" },
    desc: "\u0E1B\u0E25\u0E32\u0E22\u0E21\u0E35\u0E14\u0E0A\u0E38\u0E1A\u0E22\u0E32\u0E07\u0E2B\u0E19\u0E32\u0E21 \u0E41\u0E1C\u0E25\u0E08\u0E30\u0E0A\u0E32\u0E44\u0E1B\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19"
  },
  w_cinder_talons: {
    id: "w_cinder_talons",
    wtype: "dagger",
    name: "\u0E01\u0E23\u0E07\u0E40\u0E25\u0E47\u0E1A\u0E16\u0E48\u0E32\u0E19",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 21, crit: 0.2, critMult: 0.3 },
    art: { kind: "dagger", blade: "#d0532f", edge: "#ffd08a", guard: "#2a1a14", grip: "#1c1210", glow: "#ff8a3d" },
    desc: "\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E19\u0E2D\u0E32\u0E01\u0E32\u0E28\u0E23\u0E2D\u0E1A\u0E04\u0E21\u0E1A\u0E34\u0E14\u0E40\u0E1A\u0E35\u0E49\u0E22\u0E27"
  },
  // ---- greatsword (ดาบใหญ่): slow, huge arcs, cannot be knocked back mid-swing
  w_iron_cleaver: {
    id: "w_iron_cleaver",
    wtype: "greatsword",
    name: "\u0E14\u0E32\u0E1A\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E17\u0E38\u0E1A",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 16, def: 2 },
    art: { kind: "greatsword", blade: "#9ea4a8", edge: "#dfe3e6", guard: "#5a3a24", grip: "#3b2a20" },
    desc: "\u0E2B\u0E19\u0E31\u0E01\u0E08\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E2A\u0E2D\u0E07\u0E21\u0E37\u0E2D \u0E41\u0E15\u0E48\u0E1F\u0E31\u0E19\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E01\u0E25\u0E35\u0E49\u0E22\u0E07\u0E25\u0E32\u0E19"
  },
  w_boar_breaker: {
    id: "w_boar_breaker",
    wtype: "greatsword",
    name: "\u0E14\u0E32\u0E1A\u0E43\u0E2B\u0E0D\u0E48\u0E17\u0E25\u0E32\u0E22\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 23, def: 3 },
    art: { kind: "greatsword", blade: "#7d8a5a", edge: "#d2e2a0", guard: "#6e4a30", grip: "#2e2019" },
    desc: "\u0E15\u0E35\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E32\u0E21\u0E2B\u0E25\u0E31\u0E07\u0E02\u0E2D\u0E07\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32 \u0E22\u0E34\u0E48\u0E07\u0E15\u0E35\u0E22\u0E34\u0E48\u0E07\u0E41\u0E02\u0E47\u0E07"
  },
  w_furnace_cleaver: {
    id: "w_furnace_cleaver",
    wtype: "greatsword",
    name: "\u0E14\u0E32\u0E1A\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 32, def: 5, hp: 20 },
    art: { kind: "greatsword", blade: "#4a3a34", edge: "#ff9a4a", guard: "#2a1a14", grip: "#1c1210", glow: "#ff8a3d" },
    desc: "\u0E41\u0E01\u0E19\u0E01\u0E25\u0E32\u0E07\u0E22\u0E31\u0E07\u0E04\u0E38\u0E44\u0E1F\u0E08\u0E32\u0E01\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21\u0E25\u0E31\u0E1A"
  },
  // ---- staff (คทาเวท): bolts, nova finisher, charged meteor, blink dodge
  w_ash_staff: {
    id: "w_ash_staff",
    wtype: "staff",
    name: "\u0E04\u0E17\u0E32\u0E44\u0E21\u0E49\u0E40\u0E16\u0E49\u0E32",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 13, hp: 10 },
    art: { kind: "staff", wood: "#7a5a3c", orb: "#ffb35a", trim: "#e0b45a" },
    desc: "\u0E44\u0E21\u0E49\u0E08\u0E32\u0E01\u0E15\u0E49\u0E19\u0E17\u0E35\u0E48\u0E23\u0E2D\u0E14\u0E08\u0E32\u0E01\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21"
  },
  w_thorn_rod: {
    id: "w_thorn_rod",
    wtype: "staff",
    name: "\u0E04\u0E17\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E21\u0E23\u0E01\u0E15",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 19, hp: 15, crit: 0.05 },
    art: { kind: "staff", wood: "#4b6e33", orb: "#9fe27a", trim: "#cfe3a8" },
    desc: "\u0E40\u0E16\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E1E\u0E31\u0E19\u0E23\u0E2D\u0E1A\u0E2B\u0E34\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E2A\u0E35\u0E40\u0E02\u0E35\u0E22\u0E27"
  },
  w_ember_scepter: {
    id: "w_ember_scepter",
    wtype: "staff",
    name: "\u0E04\u0E17\u0E32\u0E2D\u0E31\u0E04\u0E04\u0E35\u0E42\u0E1A\u0E23\u0E32\u0E13",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 27, crit: 0.08, critMult: 0.2 },
    art: { kind: "staff", wood: "#2a1a14", orb: "#ff6a2a", trim: "#e0b45a", glow: "#ffd08a" },
    desc: "\u0E0A\u0E48\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27\u0E40\u0E04\u0E22\u0E43\u0E0A\u0E49\u0E21\u0E31\u0E19\u0E08\u0E38\u0E14\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21\u0E17\u0E31\u0E49\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07"
  },
  // ---- bow (ธนู): ranged, 3rd shot is a piercing volley, charged power shot
  w_hunter_bow: {
    id: "w_hunter_bow",
    wtype: "bow",
    name: "\u0E18\u0E19\u0E39\u0E19\u0E32\u0E22\u0E1E\u0E23\u0E32\u0E19",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 12, spd: 0.03 },
    art: { kind: "bow", wood: "#8a5a36", string: "#efe2c4", trim: "#d9a84e" },
    desc: "\u0E04\u0E31\u0E19\u0E18\u0E19\u0E39\u0E44\u0E21\u0E49\u0E44\u0E1C\u0E48\u0E14\u0E31\u0E14\u0E44\u0E1F \u0E40\u0E1A\u0E32\u0E41\u0E25\u0E30\u0E41\u0E21\u0E48\u0E19\u0E22\u0E33"
  },
  w_thornstring_bow: {
    id: "w_thornstring_bow",
    wtype: "bow",
    name: "\u0E18\u0E19\u0E39\u0E2A\u0E32\u0E22\u0E2B\u0E19\u0E32\u0E21",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 17, spd: 0.04, crit: 0.06 },
    art: { kind: "bow", wood: "#4b6e33", string: "#cfe3a8", trim: "#a3c46c" },
    desc: "\u0E2A\u0E32\u0E22\u0E18\u0E19\u0E39\u0E17\u0E33\u0E08\u0E32\u0E01\u0E40\u0E16\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E02\u0E32\u0E14"
  },
  w_sunfire_bow: {
    id: "w_sunfire_bow",
    wtype: "bow",
    name: "\u0E18\u0E19\u0E39\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30\u0E16\u0E48\u0E32\u0E19",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 24, crit: 0.1, spd: 0.05 },
    art: { kind: "bow", wood: "#2a1a14", string: "#ffd08a", trim: "#e0b45a", glow: "#ff8a3d" },
    desc: "\u0E25\u0E39\u0E01\u0E28\u0E23\u0E17\u0E35\u0E48\u0E22\u0E34\u0E07\u0E2D\u0E2D\u0E01\u0E44\u0E1B\u0E25\u0E38\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E44\u0E1F\u0E01\u0E25\u0E32\u0E07\u0E2D\u0E32\u0E01\u0E32\u0E28"
  },
  // ---- spear (หอก): long thrusts, wide sweep finisher, charged piercing rush
  w_boar_spear: {
    id: "w_boar_spear",
    wtype: "spear",
    name: "\u0E2B\u0E2D\u0E01\u0E25\u0E48\u0E32\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 13, def: 1 },
    art: { kind: "spear", shaft: "#8a5a36", head: "#b8bcc0", edge: "#eef0f2", trim: "#b8382a" },
    desc: "\u0E22\u0E32\u0E27\u0E1E\u0E2D\u0E08\u0E30\u0E41\u0E17\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E08\u0E30\u0E16\u0E36\u0E07\u0E15\u0E31\u0E27"
  },
  w_thorn_pike: {
    id: "w_thorn_pike",
    wtype: "spear",
    name: "\u0E2B\u0E2D\u0E01\u0E22\u0E32\u0E27\u0E2B\u0E19\u0E32\u0E21",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 19, def: 2 },
    art: { kind: "spear", shaft: "#4a3a24", head: "#7fae5c", edge: "#d6f0a8", trim: "#a3c46c" },
    desc: "\u0E1B\u0E25\u0E32\u0E22\u0E2B\u0E2D\u0E01\u0E41\u0E15\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E32\u0E21\u0E41\u0E09\u0E01"
  },
  w_ember_glaive: {
    id: "w_ember_glaive",
    wtype: "spear",
    name: "\u0E07\u0E49\u0E32\u0E27\u0E2D\u0E31\u0E04\u0E04\u0E35",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 27, crit: 0.06 },
    art: { kind: "spear", shaft: "#2a1a14", head: "#d0532f", edge: "#ffd08a", trim: "#e0b45a", glow: "#ff8a3d" },
    desc: "\u0E43\u0E1A\u0E07\u0E49\u0E32\u0E27\u0E42\u0E04\u0E49\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E41\u0E0A\u0E48\u0E41\u0E02\u0E47\u0E07"
  },
  // ---- armor
  a_cloth_wrap: {
    id: "a_cloth_wrap",
    name: "\u0E1C\u0E49\u0E32\u0E04\u0E25\u0E38\u0E21\u0E40\u0E14\u0E34\u0E19\u0E1B\u0E48\u0E32",
    category: "armor",
    rarity: "common",
    stats: { def: 4, hp: 20 },
    art: { kind: "cloak", main: "#3f6b67", trim: "#b8382a" },
    desc: "\u0E01\u0E31\u0E19\u0E25\u0E21 \u0E01\u0E31\u0E19\u0E2B\u0E19\u0E32\u0E21 \u0E44\u0E14\u0E49\u0E1A\u0E49\u0E32\u0E07"
  },
  a_hide_vest: {
    id: "a_hide_vest",
    name: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E15\u0E27\u0E4C",
    category: "armor",
    rarity: "uncommon",
    stats: { def: 8, hp: 35 },
    art: { kind: "vest", main: "#8a5a36", trim: "#d9a84e" },
    desc: "\u0E2B\u0E19\u0E31\u0E07\u0E2B\u0E19\u0E32\u0E40\u0E22\u0E47\u0E1A\u0E2A\u0E2D\u0E07\u0E0A\u0E31\u0E49\u0E19"
  },
  a_bark_mail: {
    id: "a_bark_mail",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E2B\u0E19\u0E32\u0E21",
    category: "armor",
    rarity: "rare",
    stats: { def: 13, hp: 55 },
    art: { kind: "bark", main: "#5d6b3a", trim: "#a3c46c" },
    desc: "\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E41\u0E02\u0E47\u0E07\u0E17\u0E35\u0E48\u0E1F\u0E37\u0E49\u0E19\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E44\u0E14\u0E49\u0E0A\u0E49\u0E32\u0E46"
  },
  a_lacquer_plate: {
    id: "a_lacquer_plate",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E23\u0E31\u0E01\u0E14\u0E33",
    category: "armor",
    rarity: "epic",
    stats: { def: 19, hp: 80, atk: 3 },
    art: { kind: "plate", main: "#231a17", trim: "#e0b45a" },
    desc: "\u0E25\u0E07\u0E23\u0E31\u0E01\u0E40\u0E01\u0E49\u0E32\u0E0A\u0E31\u0E49\u0E19 \u0E1B\u0E34\u0E14\u0E17\u0E2D\u0E07\u0E25\u0E32\u0E22\u0E01\u0E19\u0E01"
  },
  // ---- charms
  c_moss_bead: {
    id: "c_moss_bead",
    name: "\u0E25\u0E39\u0E01\u0E1B\u0E31\u0E14\u0E21\u0E2D\u0E2A",
    category: "charm",
    rarity: "uncommon",
    stats: { hp: 25, spd: 0.05 },
    art: { kind: "bead", main: "#6aa25a", trim: "#2e4a2a" },
    desc: "\u0E01\u0E25\u0E34\u0E48\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E25\u0E31\u0E07\u0E1D\u0E19 \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E01\u0E49\u0E32\u0E27\u0E40\u0E1A\u0E32"
  },
  c_boar_tusk: {
    id: "c_boar_tusk",
    name: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E32\u0E07\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32",
    category: "charm",
    rarity: "rare",
    stats: { crit: 0.08, critMult: 0.3 },
    art: { kind: "tusk", main: "#efe2c4", trim: "#8a3a2a" },
    desc: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2B\u0E31\u0E01"
  },
  c_cinder_eye: {
    id: "c_cinder_eye",
    name: "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E16\u0E48\u0E32\u0E19\u0E41\u0E14\u0E07",
    category: "charm",
    rarity: "epic",
    stats: { atk: 6, crit: 0.1, critMult: 0.4 },
    art: { kind: "eye", main: "#ff7a33", trim: "#2a1a14" },
    desc: "\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E38\u0E14\u0E2D\u0E48\u0E2D\u0E19\u0E43\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F"
  },
  // ---- materials
  m_iron_shard: {
    id: "m_iron_shard",
    name: "\u0E40\u0E28\u0E29\u0E40\u0E2B\u0E25\u0E47\u0E01",
    category: "material",
    rarity: "common",
    sellPrice: 6,
    art: { kind: "shard", main: "#9aa3ad" },
    desc: "\u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E02\u0E31\u0E49\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19"
  },
  m_beast_hide: {
    id: "m_beast_hide",
    name: "\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E15\u0E27\u0E4C",
    category: "material",
    rarity: "common",
    sellPrice: 8,
    art: { kind: "hide", main: "#9b6a43" },
    desc: "\u0E43\u0E0A\u0E49\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48 +4 \u0E02\u0E36\u0E49\u0E19\u0E44\u0E1B"
  },
  m_thorn_core: {
    id: "m_thorn_core",
    name: "\u0E41\u0E01\u0E48\u0E19\u0E2B\u0E19\u0E32\u0E21",
    category: "material",
    rarity: "rare",
    sellPrice: 40,
    art: { kind: "core", main: "#7dbb5a", glow: "#d6f59a" },
    desc: "\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48 +7"
  },
  m_bloodstone: {
    id: "m_bloodstone",
    name: "\u0E28\u0E34\u0E25\u0E32\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14",
    category: "material",
    rarity: "epic",
    special: "reroll",
    art: { kind: "bloodstone", main: "#a8323a", glow: "#ff9a7a" },
    desc: "\u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E1A\u0E2D\u0E2A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E43\u0E0A\u0E49\u0E2A\u0E38\u0E48\u0E21\u0E40\u0E1C\u0E48\u0E32\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E19\u0E41\u0E17\u0E47\u0E1A\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14 (\u0E02\u0E32\u0E22\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49)"
  },
  m_ember_core: {
    id: "m_ember_core",
    name: "\u0E41\u0E01\u0E48\u0E19\u0E16\u0E48\u0E32\u0E19\u0E2D\u0E31\u0E04\u0E04\u0E35",
    category: "material",
    rarity: "rare",
    sellPrice: 55,
    art: { kind: "core", main: "#e0592f", glow: "#ffd08a" },
    desc: "\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E19\u0E27\u0E32\u0E07\u0E1A\u0E19\u0E21\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49"
  },
  // ---- legendary: one per online-zone boss (src/data/zones.js)
  w_tempest_saber: {
    id: "w_tempest_saber",
    wtype: "sword",
    name: "\u0E14\u0E32\u0E1A\u0E1E\u0E32\u0E22\u0E38\u0E23\u0E32\u0E0A\u0E31\u0E19\u0E19\u0E01",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 36, crit: 0.12, critMult: 0.3, spd: 0.04 },
    art: { kind: "saber", blade: "#d9e8f6", edge: "#ffffff", guard: "#f5d48a", grip: "#34465e", glow: "#bfe3ff" },
    desc: "\u0E02\u0E19\u0E19\u0E01\u0E1E\u0E32\u0E22\u0E38\u0E1E\u0E31\u0E19\u0E23\u0E2D\u0E1A\u0E14\u0E49\u0E32\u0E21 \u0E1F\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E25\u0E21\u0E15\u0E32\u0E21"
  },
  w_glacier_fang: {
    id: "w_glacier_fang",
    wtype: "katana",
    name: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E18\u0E32\u0E23\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 32, crit: 0.2, critMult: 0.35 },
    art: { kind: "katana", blade: "#bfe8ff", edge: "#ffffff", guard: "#2f5a80", grip: "#1a2a3a", wrap: "#e8f8ff", glow: "#bfe8ff" },
    desc: "\u0E40\u0E22\u0E47\u0E19\u0E08\u0E19\u0E2D\u0E32\u0E01\u0E32\u0E28\u0E23\u0E2D\u0E1A\u0E43\u0E1A\u0E14\u0E32\u0E1A\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E01\u0E25\u0E47\u0E14"
  },
  w_hydra_kiss: {
    id: "w_hydra_kiss",
    wtype: "dagger",
    name: "\u0E08\u0E38\u0E21\u0E1E\u0E34\u0E15\u0E44\u0E2E\u0E14\u0E23\u0E32",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 28, crit: 0.25, critMult: 0.4 },
    art: { kind: "dagger", blade: "#b8e08a", edge: "#e8ff9a", guard: "#5a2f78", grip: "#24401e", glow: "#c27ff0" },
    desc: "\u0E2A\u0E32\u0E21\u0E04\u0E21 \u0E2A\u0E32\u0E21\u0E1E\u0E34\u0E29 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E44\u0E14\u0E49\u0E41\u0E1C\u0E25\u0E40\u0E14\u0E35\u0E22\u0E27"
  },
  w_umbral_greatblade: {
    id: "w_umbral_greatblade",
    wtype: "greatsword",
    name: "\u0E21\u0E2B\u0E32\u0E14\u0E32\u0E1A\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E14\u0E31\u0E1A",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 42, def: 7, hp: 40 },
    art: { kind: "greatsword", blade: "#5a4f80", edge: "#e0b0ff", guard: "#2a2438", grip: "#0e0b16", glow: "#c27ff0" },
    desc: "\u0E43\u0E1A\u0E14\u0E32\u0E1A\u0E14\u0E39\u0E14\u0E41\u0E2A\u0E07\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E08\u0E19\u0E21\u0E37\u0E14\u0E2A\u0E19\u0E34\u0E17"
  },
  w_sunspire_staff: {
    id: "w_sunspire_staff",
    wtype: "staff",
    name: "\u0E04\u0E17\u0E32\u0E22\u0E2D\u0E14\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 36, crit: 0.1, critMult: 0.3 },
    art: { kind: "staff", wood: "#c8a46a", orb: "#7fe8ff", trim: "#f3dca0" },
    desc: "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E2A\u0E1F\u0E34\u0E07\u0E0B\u0E4C\u0E22\u0E31\u0E07\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E2D\u0E22\u0E39\u0E48"
  },
  w_sporebloom_bow: {
    id: "w_sporebloom_bow",
    wtype: "bow",
    name: "\u0E18\u0E19\u0E39\u0E1A\u0E38\u0E1B\u0E1C\u0E32\u0E2A\u0E1B\u0E2D\u0E23\u0E4C",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 32, crit: 0.12, spd: 0.06 },
    art: { kind: "bow", wood: "#6a3a8a", string: "#9fffd8", trim: "#f0d0ff" },
    desc: "\u0E2A\u0E32\u0E22\u0E18\u0E19\u0E39\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E43\u0E19\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14"
  },
  w_thunder_lance: {
    id: "w_thunder_lance",
    wtype: "spear",
    name: "\u0E17\u0E27\u0E19\u0E2D\u0E31\u0E2A\u0E19\u0E35",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 36, crit: 0.1, spd: 0.03 },
    art: { kind: "spear", shaft: "#4a5a70", head: "#ffe65a", edge: "#fff9c4", trim: "#7fe8ff" },
    desc: "\u0E1B\u0E25\u0E32\u0E22\u0E17\u0E27\u0E19\u0E21\u0E35\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E44\u0E1F\u0E1F\u0E49\u0E32\u0E27\u0E34\u0E48\u0E07\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32"
  },
  a_drakescale: {
    id: "a_drakescale",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E01\u0E25\u0E47\u0E14\u0E21\u0E31\u0E07\u0E01\u0E23\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01",
    category: "armor",
    rarity: "legendary",
    stats: { def: 26, hp: 110, atk: 5 },
    art: { kind: "plate", main: "#5a1a14", trim: "#ffb35a" },
    desc: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E41\u0E21\u0E49\u0E43\u0E19\u0E25\u0E32\u0E27\u0E32"
  },
  c_seraph_feather: {
    id: "c_seraph_feather",
    name: "\u0E02\u0E19\u0E19\u0E01\u0E40\u0E17\u0E27\u0E30",
    category: "charm",
    rarity: "legendary",
    stats: { hp: 40, crit: 0.12, critMult: 0.5 },
    art: { kind: "bead", main: "#fff3c4", trim: "#e0b45a" },
    desc: "\u0E2D\u0E38\u0E48\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E41\u0E2A\u0E07\u0E41\u0E23\u0E01\u0E02\u0E2D\u0E07\u0E27\u0E31\u0E19"
  },
  c_ember_crown: {
    id: "c_ember_crown",
    name: "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E40\u0E16\u0E49\u0E32\u0E16\u0E48\u0E32\u0E19",
    category: "charm",
    rarity: "legendary",
    stats: { atk: 10, crit: 0.14, critMult: 0.6 },
    art: { kind: "eye", main: "#ff8a3d", trim: "#3a2a24" },
    desc: "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E40\u0E1C\u0E32\u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19 \u0E22\u0E31\u0E07\u0E04\u0E38\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E49\u0E32\u0E07\u0E43\u0E19"
  },
  // ================================================================== v6: scythes, twin blades, raid gear, wings
  // ---- scythe (เคียว)
  w_reaper_hook: {
    id: "w_reaper_hook",
    wtype: "scythe",
    name: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E23\u0E27\u0E07",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 14, crit: 0.03 },
    src: "s1",
    art: { kind: "scythe", shaft: "#7a5a3c", blade: "#b8bcc0", edge: "#eef0f2", trim: "#b07a2e" },
    desc: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E02\u0E49\u0E32\u0E27\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E35\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E2B\u0E49\u0E04\u0E21\u0E1E\u0E2D\u0E08\u0E30\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2D\u0E37\u0E48\u0E19"
  },
  w_thornreap: {
    id: "w_thornreap",
    wtype: "scythe",
    name: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E2B\u0E19\u0E32\u0E21\u0E2D\u0E2A\u0E39\u0E23",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 20, crit: 0.06 },
    src: "s1",
    art: { kind: "scythe", shaft: "#4a3a24", blade: "#7fae5c", edge: "#d6f0a8", trim: "#a3c46c", gem: "#c4492e" },
    desc: "\u0E43\u0E1A\u0E40\u0E04\u0E35\u0E22\u0E27\u0E07\u0E2D\u0E01\u0E2B\u0E19\u0E32\u0E21\u0E40\u0E2D\u0E07\u0E17\u0E38\u0E01\u0E04\u0E37\u0E19\u0E02\u0E49\u0E32\u0E07\u0E41\u0E23\u0E21"
  },
  w_ember_scythe: {
    id: "w_ember_scythe",
    wtype: "scythe",
    name: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E16\u0E48\u0E32\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 28, critMult: 0.25, crit: 0.05 },
    src: "s2",
    art: { kind: "scythe", shaft: "#2a1a14", blade: "#d0532f", edge: "#ffd08a", trim: "#e0b45a", glow: "#ff8a3d", gem: "#ffd08a" },
    desc: "\u0E15\u0E35\u0E08\u0E32\u0E01\u0E16\u0E48\u0E32\u0E19\u0E43\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E23\u0E49\u0E32\u0E07 \u0E1F\u0E31\u0E19\u0E41\u0E25\u0E49\u0E27\u0E17\u0E34\u0E49\u0E07\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E23\u0E39\u0E1B\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C"
  },
  w_dusk_scythe: {
    id: "w_dusk_scythe",
    wtype: "scythe",
    name: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E23\u0E31\u0E15\u0E15\u0E34\u0E01\u0E32\u0E25",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 38, crit: 0.12, critMult: 0.3 },
    src: "z4",
    art: { kind: "scythe", shaft: "#1c1430", blade: "#5a4f80", edge: "#e0b0ff", trim: "#c27ff0", glow: "#c27ff0", gem: "#e0b0ff" },
    desc: "\u0E01\u0E25\u0E37\u0E19\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E15\u0E01\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E08\u0E19\u0E40\u0E2B\u0E47\u0E19\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E02\u0E2D\u0E1A\u0E04\u0E21"
  },
  w_heaven_scythe: {
    id: "w_heaven_scythe",
    wtype: "scythe",
    name: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C",
    category: "weapon",
    rarity: "mythic",
    stats: { atk: 50, crit: 0.16, critMult: 0.5, spd: 0.05 },
    src: "r3",
    unique: "judgment",
    art: { kind: "scythe", shaft: "#f3dca0", blade: "#fff8ea", edge: "#ffffff", trim: "#f5c35a", glow: "#fff3a0", gem: "#7fe8ff" },
    desc: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E41\u0E2B\u0E48\u0E07\u0E1F\u0E32\u0E01\u0E1F\u0E49\u0E32 \u0E17\u0E38\u0E01\u0E04\u0E21\u0E17\u0E35\u0E48\u0E1F\u0E31\u0E19\u0E04\u0E37\u0E2D\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32"
  },
  // ---- twin blades (ดาบคู่)
  w_twin_sabers: {
    id: "w_twin_sabers",
    wtype: "twinblades",
    name: "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E19\u0E31\u0E01\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07",
    category: "weapon",
    rarity: "uncommon",
    stats: { atk: 12, crit: 0.07 },
    src: "s1",
    art: { kind: "twin", blade: "#c7ccd1", edge: "#f1f3f4", guard: "#b07a2e", grip: "#4a2f22" },
    desc: "\u0E2A\u0E2D\u0E07\u0E40\u0E25\u0E48\u0E21\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E35\u0E08\u0E32\u0E01\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E01\u0E49\u0E2D\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19"
  },
  w_twin_thorns: {
    id: "w_twin_thorns",
    wtype: "twinblades",
    name: "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E2B\u0E19\u0E32\u0E21\u0E40\u0E25\u0E37\u0E2D\u0E14",
    category: "weapon",
    rarity: "rare",
    stats: { atk: 18, crit: 0.1 },
    src: "s1",
    art: { kind: "twin", blade: "#8a3b2e", edge: "#f0a090", guard: "#5a3a24", grip: "#2e2019", rune: "#ffb3a4" },
    desc: "\u0E22\u0E34\u0E48\u0E07\u0E1F\u0E31\u0E19\u0E40\u0E23\u0E47\u0E27 \u0E22\u0E34\u0E48\u0E07\u0E44\u0E14\u0E49\u0E22\u0E34\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2B\u0E19\u0E32\u0E21\u0E01\u0E23\u0E35\u0E14\u0E2D\u0E32\u0E01\u0E32\u0E28"
  },
  w_twin_embers: {
    id: "w_twin_embers",
    wtype: "twinblades",
    name: "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E2D\u0E31\u0E04\u0E04\u0E35\u0E41\u0E1D\u0E14",
    category: "weapon",
    rarity: "epic",
    stats: { atk: 25, crit: 0.12, critMult: 0.2 },
    src: "s2",
    art: { kind: "twin", blade: "#d0532f", edge: "#ffd08a", guard: "#2a1a14", grip: "#1c1210", glow: "#ff8a3d", rune: "#ffe2a0" },
    desc: "\u0E40\u0E25\u0E48\u0E21\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E23\u0E49\u0E2D\u0E19 \u0E2D\u0E35\u0E01\u0E40\u0E25\u0E48\u0E21\u0E23\u0E49\u0E2D\u0E19\u0E01\u0E27\u0E48\u0E32"
  },
  w_twin_tempest: {
    id: "w_twin_tempest",
    wtype: "twinblades",
    name: "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E1E\u0E32\u0E22\u0E38\u0E2A\u0E25\u0E32\u0E15\u0E31\u0E19",
    category: "weapon",
    rarity: "legendary",
    stats: { atk: 34, crit: 0.15, spd: 0.04 },
    src: "z7",
    art: { kind: "twin", blade: "#bfe8ff", edge: "#ffffff", guard: "#2f5a80", grip: "#1a2a3a", glow: "#7fd0ff", rune: "#ffe65a" },
    desc: "\u0E1F\u0E32\u0E14\u0E25\u0E07\u0E21\u0E32\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1F\u0E49\u0E32\u0E04\u0E33\u0E23\u0E32\u0E21"
  },
  w_sovereign_twins: {
    id: "w_sovereign_twins",
    wtype: "twinblades",
    name: "\u0E14\u0E32\u0E1A\u0E04\u0E39\u0E48\u0E23\u0E32\u0E0A\u0E31\u0E19\u0E21\u0E31\u0E07\u0E01\u0E23",
    category: "weapon",
    rarity: "mythic",
    secret: true,
    stats: { atk: 54, crit: 0.2, critMult: 0.55, spd: 0.08, hp: 60 },
    src: "craft",
    unique: "sovereign",
    art: {
      kind: "twin",
      blade: "#1a1418",
      edge: "#ff5a3a",
      guard: "#2a0e0a",
      grip: "#140c0c",
      glow: "#ff3a1a",
      rune: "#ffb35a",
      off: { blade: "#e8f4ff", edge: "#7fe8ff", guard: "#f5d48a", grip: "#2a3850", glow: "#9fdcff", rune: "#ffffff" }
    },
    desc: "\u0E2D\u0E2A\u0E19\u0E35\u0E1E\u0E34\u0E42\u0E23\u0E18\u0E43\u0E19\u0E21\u0E37\u0E2D\u0E2B\u0E19\u0E36\u0E48\u0E07 \u0E40\u0E19\u0E15\u0E23\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C\u0E43\u0E19\u0E2D\u0E35\u0E01\u0E21\u0E37\u0E2D \u0E04\u0E27\u0E32\u0E21\u0E41\u0E04\u0E49\u0E19\u0E01\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E27\u0E31\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07\u0E21\u0E31\u0E07\u0E01\u0E23\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49\u0E23\u0E48\u0E27\u0E21\u0E17\u0E32\u0E07\u0E01\u0E31\u0E19\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07"
  },
  // ---- armor (v6)
  a_wanderer_coat: {
    id: "a_wanderer_coat",
    name: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E04\u0E25\u0E38\u0E21\u0E19\u0E31\u0E01\u0E1E\u0E40\u0E19\u0E08\u0E23",
    category: "armor",
    rarity: "uncommon",
    stats: { def: 7, hp: 30, spd: 0.03 },
    src: "s1",
    art: { kind: "coat", main: "#5a4a3a", trim: "#c9a46a" },
    desc: "\u0E1B\u0E01\u0E2A\u0E39\u0E07\u0E01\u0E31\u0E19\u0E25\u0E21 \u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E0B\u0E48\u0E2D\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E40\u0E08\u0E47\u0E14\u0E43\u0E1A"
  },
  a_ronin_lamellar: {
    id: "a_ronin_lamellar",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E01\u0E25\u0E47\u0E14\u0E0B\u0E32\u0E21\u0E39\u0E44\u0E23\u0E1E\u0E40\u0E19\u0E08\u0E23",
    category: "armor",
    rarity: "rare",
    stats: { def: 12, hp: 50, crit: 0.03 },
    src: "s2",
    art: { kind: "lamellar", main: "#3a2e4a", trim: "#c2412f" },
    desc: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E23\u0E49\u0E2D\u0E22\u0E14\u0E49\u0E27\u0E22\u0E40\u0E0A\u0E37\u0E2D\u0E01\u0E41\u0E14\u0E07 \u0E02\u0E22\u0E31\u0E1A\u0E15\u0E31\u0E27\u0E44\u0E14\u0E49\u0E44\u0E21\u0E48\u0E15\u0E34\u0E14\u0E02\u0E31\u0E14"
  },
  a_moonlit_robe: {
    id: "a_moonlit_robe",
    name: "\u0E2D\u0E32\u0E20\u0E23\u0E13\u0E4C\u0E08\u0E31\u0E19\u0E17\u0E23\u0E32",
    category: "armor",
    rarity: "rare",
    stats: { def: 9, hp: 40, crit: 0.04, critMult: 0.15 },
    src: "z2",
    art: { kind: "robe", main: "#2f4a6a", trim: "#e8f4ff" },
    desc: "\u0E17\u0E2D\u0E14\u0E49\u0E27\u0E22\u0E14\u0E49\u0E32\u0E22\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E14\u0E49\u0E43\u0E19\u0E04\u0E37\u0E19\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E40\u0E1E\u0E47\u0E0D"
  },
  a_iron_bastion: {
    id: "a_iron_bastion",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E1B\u0E49\u0E2D\u0E21\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E2B\u0E19\u0E31\u0E01",
    category: "armor",
    rarity: "epic",
    stats: { def: 24, hp: 110, spd: -0.06 },
    src: "z7",
    art: { kind: "bastion", main: "#5a5650", trim: "#b8a890" },
    desc: "\u0E2B\u0E19\u0E31\u0E01\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E01\u0E33\u0E41\u0E1E\u0E07 \u0E16\u0E49\u0E32\u0E22\u0E37\u0E19\u0E19\u0E34\u0E48\u0E07\u0E1E\u0E2D \u0E28\u0E31\u0E15\u0E23\u0E39\u0E08\u0E30\u0E40\u0E2B\u0E19\u0E37\u0E48\u0E2D\u0E22\u0E01\u0E48\u0E2D\u0E19"
  },
  a_wolf_knight: {
    id: "a_wolf_knight",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E2D\u0E31\u0E28\u0E27\u0E34\u0E19\u0E2B\u0E21\u0E32\u0E1B\u0E48\u0E32",
    category: "armor",
    rarity: "epic",
    stats: { def: 17, hp: 80, atk: 4, crit: 0.04 },
    src: "z4",
    art: { kind: "knight", main: "#2e3440", trim: "#7f8fa6" },
    desc: "\u0E1C\u0E49\u0E32\u0E04\u0E25\u0E38\u0E21\u0E02\u0E32\u0E14\u0E27\u0E34\u0E48\u0E19\u0E02\u0E2D\u0E07\u0E2D\u0E31\u0E28\u0E27\u0E34\u0E19\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E16\u0E2D\u0E22\u0E41\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E01\u0E49\u0E32\u0E27"
  },
  a_wrath_plate: {
    id: "a_wrath_plate",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E01\u0E25\u0E47\u0E14\u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18",
    category: "armor",
    rarity: "legendary",
    stats: { def: 28, hp: 130, atk: 8, critMult: 0.2 },
    src: "r1",
    art: { kind: "dragonplate", main: "#3a0e0a", trim: "#ff5a3a" },
    desc: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E22\u0E31\u0E07\u0E23\u0E49\u0E2D\u0E19\u0E23\u0E30\u0E2D\u0E38\u0E23\u0E32\u0E27\u0E01\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E41\u0E04\u0E49\u0E19\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E14\u0E31\u0E1A"
  },
  a_seer_vestment: {
    id: "a_seer_vestment",
    name: "\u0E2D\u0E32\u0E20\u0E23\u0E13\u0E4C\u0E1C\u0E39\u0E49\u0E2B\u0E22\u0E31\u0E48\u0E07\u0E23\u0E39\u0E49",
    category: "armor",
    rarity: "legendary",
    stats: { def: 20, hp: 100, crit: 0.1, spd: 0.05 },
    src: "r2",
    art: { kind: "seer", main: "#1e2a4a", trim: "#9fdcff" },
    desc: "\u0E25\u0E32\u0E22\u0E14\u0E32\u0E27\u0E1A\u0E19\u0E1C\u0E49\u0E32\u0E02\u0E22\u0E31\u0E1A\u0E15\u0E32\u0E21\u0E2D\u0E19\u0E32\u0E04\u0E15\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E30\u0E40\u0E01\u0E34\u0E14"
  },
  a_judgment_plate: {
    id: "a_judgment_plate",
    name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E17\u0E27\u0E32\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32",
    category: "armor",
    rarity: "legendary",
    stats: { def: 30, hp: 140, crit: 0.05 },
    src: "r3",
    art: { kind: "seraph", main: "#efe6d0", trim: "#f5c35a" },
    desc: "\u0E2A\u0E25\u0E31\u0E01\u0E04\u0E33\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E44\u0E27\u0E49\u0E17\u0E38\u0E01\u0E41\u0E1C\u0E48\u0E19 \u0E2D\u0E48\u0E32\u0E19\u0E2D\u0E2D\u0E01\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E1C\u0E34\u0E14"
  },
  // ---- charms (v6)
  c_wrath_fang: {
    id: "c_wrath_fang",
    name: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18",
    category: "charm",
    rarity: "legendary",
    stats: { atk: 12, critMult: 0.45 },
    src: "r1",
    art: { kind: "tusk", main: "#ffb35a", trim: "#3a0e0a" },
    desc: "\u0E22\u0E31\u0E07\u0E23\u0E49\u0E2D\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E2B\u0E25\u0E38\u0E14\u0E08\u0E32\u0E01\u0E1B\u0E32\u0E01"
  },
  c_prophecy_lens: {
    id: "c_prophecy_lens",
    name: "\u0E40\u0E25\u0E19\u0E2A\u0E4C\u0E41\u0E2B\u0E48\u0E07\u0E19\u0E34\u0E21\u0E34\u0E15",
    category: "charm",
    rarity: "legendary",
    stats: { crit: 0.16, spd: 0.05 },
    src: "r2",
    art: { kind: "eye", main: "#7fe8ff", trim: "#1e2a4a" },
    desc: "\u0E21\u0E2D\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27\u0E40\u0E2B\u0E47\u0E19\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08"
  },
  c_judgment_halo: {
    id: "c_judgment_halo",
    name: "\u0E27\u0E07\u0E23\u0E31\u0E28\u0E21\u0E35\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32",
    category: "charm",
    rarity: "legendary",
    stats: { hp: 60, atk: 8, crit: 0.08 },
    src: "r3",
    art: { kind: "bead", main: "#fff3a0", trim: "#f5c35a" },
    desc: "\u0E25\u0E2D\u0E22\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E28\u0E35\u0E23\u0E29\u0E30\u0E40\u0E2D\u0E07\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21\u0E22\u0E37\u0E19\u0E2B\u0E22\u0E31\u0E14\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01"
  },
  // ---- wings (ปีก) — a new equipment slot
  wg_ember_moth: {
    id: "wg_ember_moth",
    name: "\u0E1B\u0E35\u0E01\u0E1C\u0E35\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E16\u0E48\u0E32\u0E19",
    category: "wings",
    rarity: "uncommon",
    stats: { spd: 0.03, hp: 10 },
    src: "s2",
    art: { kind: "moth", main: "#8a4a2a", trim: "#ffb35a", glow: "#ff8a3d" },
    desc: "\u0E1C\u0E07\u0E16\u0E48\u0E32\u0E19\u0E1A\u0E19\u0E1B\u0E35\u0E01\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E02\u0E22\u0E31\u0E1A"
  },
  wg_kinnaree: {
    id: "wg_kinnaree",
    name: "\u0E1B\u0E35\u0E01\u0E01\u0E34\u0E19\u0E23\u0E35",
    category: "wings",
    rarity: "rare",
    stats: { spd: 0.05, hp: 25 },
    src: "z1",
    art: { kind: "feather", main: "#f3e6c8", trim: "#e0b45a", glow: "#fff3c4" },
    desc: "\u0E02\u0E19\u0E19\u0E01\u0E2A\u0E35\u0E17\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E01\u0E34\u0E19\u0E23\u0E35\u0E43\u0E19\u0E15\u0E33\u0E19\u0E32\u0E19 \u0E40\u0E1A\u0E32\u0E08\u0E19\u0E41\u0E17\u0E1A\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01"
  },
  wg_ash_bat: {
    id: "wg_ash_bat",
    name: "\u0E1B\u0E35\u0E01\u0E04\u0E49\u0E32\u0E07\u0E04\u0E32\u0E27\u0E40\u0E16\u0E49\u0E32",
    category: "wings",
    rarity: "rare",
    stats: { crit: 0.05, atk: 3 },
    src: "z4",
    art: { kind: "bat", main: "#3a2e34", trim: "#c27ff0", glow: "#c27ff0" },
    desc: "\u0E01\u0E32\u0E07\u0E2D\u0E2D\u0E01\u0E41\u0E25\u0E49\u0E27\u0E40\u0E07\u0E32\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E08\u0E30\u0E25\u0E36\u0E01\u0E02\u0E36\u0E49\u0E19\u0E2D\u0E35\u0E01\u0E0A\u0E31\u0E49\u0E19"
  },
  wg_sky_crystal: {
    id: "wg_sky_crystal",
    name: "\u0E1B\u0E35\u0E01\u0E1C\u0E25\u0E36\u0E01\u0E19\u0E20\u0E32",
    category: "wings",
    rarity: "epic",
    stats: { crit: 0.06, spd: 0.05, hp: 20 },
    src: "z9",
    art: { kind: "crystal", main: "#9fdcff", trim: "#ffffff", glow: "#bfe8ff" },
    desc: "\u0E1C\u0E25\u0E36\u0E01\u0E41\u0E15\u0E48\u0E25\u0E30\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E17\u0E49\u0E2D\u0E07\u0E1F\u0E49\u0E32\u0E04\u0E19\u0E25\u0E30\u0E40\u0E27\u0E25\u0E32"
  },
  wg_wrath_dragon: {
    id: "wg_wrath_dragon",
    name: "\u0E1B\u0E35\u0E01\u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18",
    category: "wings",
    rarity: "legendary",
    stats: { atk: 9, critMult: 0.3, spd: 0.04 },
    src: "r1",
    art: { kind: "dragon", main: "#3a0e0a", trim: "#ff5a3a", glow: "#ff7a33" },
    desc: "\u0E1E\u0E31\u0E07\u0E1C\u0E37\u0E14\u0E1B\u0E35\u0E01\u0E22\u0E31\u0E07\u0E21\u0E35\u0E25\u0E32\u0E27\u0E32\u0E44\u0E2B\u0E25\u0E40\u0E27\u0E35\u0E22\u0E19"
  },
  wg_prophecy: {
    id: "wg_prophecy",
    name: "\u0E1B\u0E35\u0E01\u0E19\u0E31\u0E22\u0E19\u0E4C\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C",
    category: "wings",
    rarity: "legendary",
    stats: { crit: 0.1, spd: 0.07 },
    src: "r2",
    art: { kind: "eye", main: "#1e2a4a", trim: "#9fdcff", glow: "#7fe8ff" },
    desc: "\u0E25\u0E32\u0E22\u0E1A\u0E19\u0E1B\u0E35\u0E01\u0E04\u0E37\u0E2D\u0E14\u0E27\u0E07\u0E15\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E01\u0E30\u0E1E\u0E23\u0E34\u0E1A"
  },
  wg_seraph: {
    id: "wg_seraph",
    name: "\u0E1B\u0E35\u0E01\u0E40\u0E17\u0E27\u0E32\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32",
    category: "wings",
    rarity: "legendary",
    stats: { hp: 70, def: 6, crit: 0.05 },
    src: "r3",
    art: { kind: "seraph", main: "#fffaf0", trim: "#f5c35a", glow: "#fff3a0" },
    desc: "\u0E2B\u0E01\u0E1B\u0E35\u0E01\u0E17\u0E35\u0E48\u0E01\u0E32\u0E07\u0E2D\u0E2D\u0E01\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E1A\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C"
  },
  // ---- rare parts from the online zones (crafting)
  m_storm_quill: { id: "m_storm_quill", name: "\u0E02\u0E19\u0E19\u0E01\u0E1E\u0E32\u0E22\u0E38", category: "material", rarity: "rare", sellPrice: 60, src: "z1", art: { kind: "core", main: "#d9e8f6", glow: "#ffffff" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E23\u0E32\u0E0A\u0E31\u0E19\u0E19\u0E01\u0E1E\u0E32\u0E22\u0E38 (\u0E17\u0E38\u0E48\u0E07\u0E2B\u0E0D\u0E49\u0E32\u0E25\u0E21\u0E01\u0E23\u0E14) \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_frost_heart: { id: "m_frost_heart", name: "\u0E41\u0E01\u0E48\u0E19\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E19\u0E34\u0E23\u0E31\u0E19\u0E14\u0E23\u0E4C", category: "material", rarity: "rare", sellPrice: 65, src: "z2", art: { kind: "core", main: "#8fc4e8", glow: "#e8f8ff" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E21\u0E31\u0E07\u0E01\u0E23\u0E18\u0E32\u0E23\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_hydra_fang: { id: "m_hydra_fang", name: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E44\u0E2E\u0E14\u0E23\u0E32", category: "material", rarity: "rare", sellPrice: 70, src: "z3", art: { kind: "shard", main: "#b8e08a" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E44\u0E2E\u0E14\u0E23\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1A\u0E36\u0E07 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_umbral_shard: { id: "m_umbral_shard", name: "\u0E40\u0E28\u0E29\u0E40\u0E07\u0E32\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E14\u0E31\u0E1A", category: "material", rarity: "rare", sellPrice: 75, src: "z4", art: { kind: "core", main: "#5a4f80", glow: "#e0b0ff" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E2D\u0E31\u0E28\u0E27\u0E34\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E14\u0E31\u0E1A \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_sun_relic: { id: "m_sun_relic", name: "\u0E27\u0E31\u0E15\u0E16\u0E38\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30", category: "material", rarity: "rare", sellPrice: 80, src: "z5", art: { kind: "core", main: "#f3dca0", glow: "#7fe8ff" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E2A\u0E1F\u0E34\u0E07\u0E0B\u0E4C\u0E22\u0E31\u0E01\u0E29\u0E4C \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_spore_crown: { id: "m_spore_crown", name: "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E2A\u0E1B\u0E2D\u0E23\u0E4C", category: "material", rarity: "rare", sellPrice: 85, src: "z6", art: { kind: "core", main: "#a86ad0", glow: "#9fffd8" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E21\u0E32\u0E23\u0E14\u0E32\u0E40\u0E2B\u0E47\u0E14\u0E23\u0E32\u0E0A\u0E34\u0E19\u0E35 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_storm_coil: { id: "m_storm_coil", name: "\u0E02\u0E14\u0E25\u0E27\u0E14\u0E2D\u0E31\u0E2A\u0E19\u0E35", category: "material", rarity: "rare", sellPrice: 90, src: "z7", art: { kind: "shard", main: "#a8c0de" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E44\u0E17\u0E17\u0E31\u0E19\u0E40\u0E17\u0E2A\u0E25\u0E32 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_rift_scale: { id: "m_rift_scale", name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E21\u0E31\u0E07\u0E01\u0E23\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01", category: "material", rarity: "epic", sellPrice: 110, src: "z8", art: { kind: "bloodstone", main: "#8e2c21", glow: "#ffb35a" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E21\u0E31\u0E07\u0E01\u0E23\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_halo_shard: { id: "m_halo_shard", name: "\u0E40\u0E28\u0E29\u0E27\u0E07\u0E23\u0E31\u0E28\u0E21\u0E35", category: "material", rarity: "epic", sellPrice: 120, src: "z9", art: { kind: "core", main: "#fff3a0", glow: "#ffffff" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C\u0E40\u0E17\u0E27\u0E30 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_ash_crown_shard: { id: "m_ash_crown_shard", name: "\u0E40\u0E28\u0E29\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E40\u0E16\u0E49\u0E32", category: "material", rarity: "epic", sellPrice: 130, src: "z10", art: { kind: "shard", main: "#ff8a3d" }, desc: "\u0E0A\u0E34\u0E49\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E08\u0E32\u0E01\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E40\u0E16\u0E49\u0E32\u0E16\u0E48\u0E32\u0E19 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  // ---- special dungeon parts
  m_wrath_scale: { id: "m_wrath_scale", name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18", category: "material", rarity: "epic", sellPrice: 160, src: "r1", art: { kind: "bloodstone", main: "#3a0e0a", glow: "#ff5a3a" }, desc: "\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E48\u0E2D\u0E14\u0E49\u0E27\u0E22\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E32\u0E21\u0E0A\u0E31\u0E49\u0E19 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_prophecy_scale: { id: "m_prophecy_scale", name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E14\u0E32\u0E23\u0E32\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C", category: "material", rarity: "epic", sellPrice: 160, src: "r2", art: { kind: "bloodstone", main: "#1e2a4a", glow: "#9fdcff" }, desc: "\u0E21\u0E35\u0E08\u0E38\u0E14\u0E41\u0E2A\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E01\u0E25\u0E38\u0E48\u0E21\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E15\u0E31\u0E49\u0E07\u0E0A\u0E37\u0E48\u0E2D \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_judgment_sigil: { id: "m_judgment_sigil", name: "\u0E15\u0E23\u0E32\u0E1B\u0E23\u0E30\u0E17\u0E31\u0E1A\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32", category: "material", rarity: "epic", sellPrice: 180, src: "r3", art: { kind: "core", main: "#f5c35a", glow: "#fffaf0" }, desc: "\u0E15\u0E23\u0E32\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E2D\u0E38\u0E48\u0E19\u0E14\u0E49\u0E27\u0E22\u0E2D\u0E33\u0E19\u0E32\u0E08\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19 \u0E43\u0E0A\u0E49\u0E04\u0E23\u0E32\u0E1F" },
  m_wrath_heart: {
    id: "m_wrath_heart",
    name: "\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E34\u0E42\u0E23\u0E18",
    category: "material",
    rarity: "mythic",
    special: "relic",
    src: "r1",
    art: { kind: "bloodstone", main: "#5a0e0a", glow: "#ff3a1a" },
    desc: "\u0E22\u0E31\u0E07\u0E40\u0E15\u0E49\u0E19\u0E2D\u0E22\u0E39\u0E48 \u0E0A\u0E49\u0E32 \u0E2B\u0E19\u0E31\u0E01 \u0E41\u0E25\u0E30\u0E40\u0E08\u0E47\u0E1A\u0E1B\u0E27\u0E14 (\u0E02\u0E32\u0E22\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49)"
  },
  m_prophecy_eye: {
    id: "m_prophecy_eye",
    name: "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C",
    category: "material",
    rarity: "mythic",
    special: "relic",
    src: "r2",
    art: { kind: "eye", main: "#7fe8ff", glow: "#ffffff" },
    desc: "\u0E21\u0E2D\u0E07\u0E41\u0E25\u0E49\u0E27\u0E08\u0E30\u0E40\u0E2B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E43\u0E19\u0E2D\u0E35\u0E01\u0E44\u0E21\u0E48\u0E01\u0E35\u0E48\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 (\u0E02\u0E32\u0E22\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49)"
  },
  // ---- consumables
  p_tonic: {
    id: "p_tonic",
    name: "\u0E22\u0E32\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07",
    category: "consumable",
    rarity: "common",
    sellPrice: 10,
    art: { kind: "potion", main: "#c93a2e" },
    desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 35% \u0E43\u0E0A\u0E49\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E15\u0E48\u0E2D\u0E2A\u0E39\u0E49 (Q)"
  }
};
var ITEMS = Object.freeze({ ...BASE_ITEMS, ...WEAPONS_V7, ...ARMORS_V7, ...RELICS_V7, ...WEAPONS_V8, ...MATS_V8 });
var EQUIP_SLOTS = Object.freeze(["weapon", "armor", "charm", "wings"]);
var SLOT_NAMES = Object.freeze({ weapon: "\u0E2D\u0E32\u0E27\u0E38\u0E18", armor: "\u0E0A\u0E38\u0E14\u0E40\u0E01\u0E23\u0E32\u0E30", charm: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E32\u0E07", wings: "\u0E1B\u0E35\u0E01" });
var STAT_NAMES = Object.freeze({ atk: "\u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35", def: "\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19", hp: "\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15", crit: "\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25", critMult: "\u0E41\u0E23\u0E07\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25", spd: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27" });
function getItem(id) {
  return Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : null;
}
function isEquipment(def) {
  return !!def && (def.category === "weapon" || def.category === "armor" || def.category === "charm" || def.category === "wings");
}

// src/data/races2.js
var RACES_V7 = Object.freeze({
  // ---------------------------------------------------------------- uncommon
  tusk: {
    id: "tusk",
    name: "\u0E0A\u0E32\u0E27\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E1B\u0E48\u0E32",
    rarity: "uncommon",
    weight: 8,
    color: "#9aa860",
    desc: "\u0E23\u0E48\u0E32\u0E07\u0E01\u0E33\u0E22\u0E33 \u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E07\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E01\u0E23\u0E32\u0E21 \u0E1E\u0E38\u0E48\u0E07\u0E0A\u0E19\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E02\u0E27\u0E32\u0E07\u0E2D\u0E22\u0E39\u0E48",
    lore: "\u0E0A\u0E32\u0E27\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E1B\u0E48\u0E32\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E48\u0E32\u0E01\u0E32\u0E23\u0E16\u0E2D\u0E22\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2B\u0E31\u0E01\u0E44\u0E1B\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E0B\u0E35\u0E48",
    stats: { hpPct: 0.12, atkPct: 0.06, spd: -0.02 },
    skill: {
      id: "k_tusk",
      name: "\u0E1E\u0E38\u0E48\u0E07\u0E1A\u0E14\u0E02\u0E22\u0E35\u0E49",
      icon: "hammer",
      cooldown: 12,
      kit: [{ type: "dash", dist: 170, width: 64, power: 1.6, stun: 0.5 }],
      desc: "\u0E1E\u0E38\u0E48\u0E07\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 170 \u0E2B\u0E19\u0E48\u0E27\u0E22 \u0E0A\u0E19\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E43\u0E19\u0E41\u0E19\u0E27 \xD71.6 \u0E41\u0E25\u0E30\u0E2A\u0E15\u0E31\u0E19 0.5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E2B\u0E19\u0E31\u0E07\u0E2B\u0E19\u0E32", desc: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01 \u221220% \xB7 \u0E06\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 1%", trapReduce: 0.2, healOnKill: 0.01 },
    look: { skin: "#b8b088", shade: "#948a64", hair: "#3a3020", eye: "#2a1a0a", trait: "tusks", tc: "#f3ead2" }
  },
  feather: {
    id: "feather",
    name: "\u0E0A\u0E32\u0E27\u0E02\u0E19\u0E19\u0E01",
    rarity: "uncommon",
    weight: 8,
    color: "#d8e8ff",
    desc: "\u0E21\u0E35\u0E02\u0E19\u0E19\u0E01\u0E07\u0E2D\u0E01\u0E41\u0E17\u0E19\u0E1C\u0E21\u0E1A\u0E32\u0E07\u0E40\u0E2A\u0E49\u0E19 \u0E15\u0E31\u0E27\u0E40\u0E1A\u0E32\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E25\u0E21",
    lore: "\u0E40\u0E14\u0E47\u0E01\u0E0A\u0E32\u0E27\u0E02\u0E19\u0E19\u0E01\u0E08\u0E30\u0E44\u0E14\u0E49\u0E02\u0E19\u0E19\u0E01\u0E40\u0E2A\u0E49\u0E19\u0E41\u0E23\u0E01\u0E43\u0E19\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E27\u0E34\u0E48\u0E07\u0E0A\u0E19\u0E30\u0E25\u0E21\u0E44\u0E14\u0E49",
    stats: { spd: 0.1, crit: 0.02 },
    skill: {
      id: "k_feather",
      name: "\u0E25\u0E21\u0E02\u0E19\u0E19\u0E01",
      icon: "wind",
      cooldown: 14,
      kit: [{ type: "iframes", t: 0.4 }, { type: "buff", t: 5, speed: 0.35 }, { type: "volley", count: 5, spread: 50, power: 0.5, speed: 700, tint: ["230,240,255", "#ffffff"] }],
      desc: "\u0E02\u0E19\u0E19\u0E01 5 \u0E40\u0E2A\u0E49\u0E19 \xD70.5 \u0E1E\u0E38\u0E48\u0E07\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E41\u0E25\u0E49\u0E27\u0E27\u0E34\u0E48\u0E07\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 35% \u0E19\u0E32\u0E19 5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 (\u0E2D\u0E21\u0E15\u0E30\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E39\u0E48)"
    },
    ability: { name: "\u0E15\u0E31\u0E27\u0E40\u0E1A\u0E32", desc: "\u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 15% \xB7 \u0E23\u0E30\u0E22\u0E30\u0E14\u0E39\u0E14\u0E02\u0E2D\u0E07 +30%", dodgeCd: 0.15, magnet: 0.3 },
    look: { skin: "#f3e2cc", shade: "#d6bfa4", hair: "#e8f0ff", eye: "#4a7fd8", trait: "feathers", tc: "#d8e8ff" }
  },
  catfolk: {
    id: "catfolk",
    name: "\u0E0A\u0E32\u0E27\u0E41\u0E21\u0E27\u0E1B\u0E48\u0E32",
    rarity: "uncommon",
    weight: 8,
    color: "#e0a060",
    desc: "\u0E2B\u0E39\u0E41\u0E21\u0E27\u0E01\u0E25\u0E21\u0E46 \u0E1A\u0E19\u0E2B\u0E31\u0E27 \u0E40\u0E25\u0E47\u0E1A\u0E04\u0E21\u0E1E\u0E2D\u0E08\u0E30\u0E02\u0E48\u0E27\u0E19\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E2B\u0E25\u0E47\u0E01",
    lore: "\u0E0A\u0E32\u0E27\u0E41\u0E21\u0E27\u0E1B\u0E48\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E15\u0E01\u0E08\u0E32\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E39\u0E07 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E22\u0E2D\u0E21\u0E23\u0E31\u0E1A\u0E27\u0E48\u0E32\u0E40\u0E04\u0E22\u0E15\u0E01\u0E40\u0E0A\u0E48\u0E19\u0E01\u0E31\u0E19",
    stats: { crit: 0.08, spd: 0.04 },
    skill: {
      id: "k_catfolk",
      name: "\u0E01\u0E23\u0E07\u0E40\u0E25\u0E47\u0E1A\u0E2A\u0E32\u0E21\u0E2A\u0E32\u0E22",
      icon: "hand",
      cooldown: 9,
      kit: [{ type: "claws", n: 3, range: 130, arc: 110, power: 0.7, gap: 0.12 }],
      desc: "\u0E02\u0E48\u0E27\u0E19\u0E23\u0E31\u0E27 3 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E14\u0E49\u0E32\u0E19\u0E2B\u0E19\u0E49\u0E32 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30 \xD70.7"
    },
    ability: { name: "\u0E2A\u0E31\u0E0D\u0E0A\u0E32\u0E15\u0E0D\u0E32\u0E13\u0E41\u0E21\u0E27", desc: "\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19 \xB7 \u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 10%", perfectBonus: 0.05, dodgeCd: 0.1 },
    look: { skin: "#f0d0a8", shade: "#d4ae84", hair: "#c87a3a", eye: "#7fae3a", trait: "catears", tc: "#c87a3a" }
  },
  mushroom: {
    id: "mushroom",
    name: "\u0E0A\u0E32\u0E27\u0E40\u0E2B\u0E47\u0E14",
    rarity: "uncommon",
    weight: 8,
    color: "#c88ad0",
    desc: "\u0E2A\u0E27\u0E21\u0E2B\u0E21\u0E27\u0E01\u0E40\u0E2B\u0E47\u0E14\u0E17\u0E35\u0E48\u0E07\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E40\u0E2D\u0E07 \u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E2A\u0E1B\u0E2D\u0E23\u0E4C\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E21\u0E36\u0E19\u0E07\u0E07",
    lore: "\u0E0A\u0E32\u0E27\u0E40\u0E2B\u0E47\u0E14\u0E19\u0E31\u0E1A\u0E2D\u0E32\u0E22\u0E38\u0E08\u0E32\u0E01\u0E08\u0E33\u0E19\u0E27\u0E19\u0E08\u0E38\u0E14\u0E1A\u0E19\u0E2B\u0E21\u0E27\u0E01 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E08\u0E33\u0E19\u0E27\u0E19\u0E1B\u0E35",
    stats: { hpPct: 0.1, defPct: 0.05 },
    skill: {
      id: "k_mushroom",
      name: "\u0E1D\u0E38\u0E48\u0E19\u0E2A\u0E1B\u0E2D\u0E23\u0E4C",
      icon: "spark",
      cooldown: 16,
      kit: [{ type: "field", r: 150, t: 4, power: 0.2, every: 0.5, slow: 0.6, color: "#c88ad0" }],
      desc: "\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E2A\u0E1B\u0E2D\u0E23\u0E4C\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E27\u0E07\u0E42\u0E14\u0E19 \xD70.2 \u0E17\u0E38\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E41\u0E25\u0E30\u0E0A\u0E49\u0E32\u0E25\u0E07"
    },
    ability: { name: "\u0E2A\u0E1B\u0E2D\u0E23\u0E4C\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07", desc: "\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A 10% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07 \xB7 \u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.3%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35", debuff: 0.1, regen: 3e-3 },
    look: { skin: "#efe0c8", shade: "#cdb898", hair: "#6a4a3a", eye: "#3a2a20", trait: "mushroom", tc: "#c84a4a" }
  },
  bunny: {
    id: "bunny",
    name: "\u0E0A\u0E32\u0E27\u0E01\u0E23\u0E30\u0E15\u0E48\u0E32\u0E22\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
    rarity: "uncommon",
    weight: 8,
    color: "#f0e0f0",
    desc: "\u0E2B\u0E39\u0E22\u0E32\u0E27\u0E2A\u0E2D\u0E07\u0E02\u0E49\u0E32\u0E07 \u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E44\u0E14\u0E49\u0E2A\u0E39\u0E07\u0E08\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E2B\u0E22\u0E35\u0E22\u0E1A\u0E14\u0E27\u0E07\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
    lore: "\u0E0A\u0E32\u0E27\u0E01\u0E23\u0E30\u0E15\u0E48\u0E32\u0E22\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E1B\u0E25\u0E39\u0E01\u0E02\u0E49\u0E32\u0E27\u0E1A\u0E19\u0E40\u0E19\u0E34\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E31\u0E19\u0E2B\u0E32\u0E1E\u0E23\u0E30\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19",
    stats: { spd: 0.08, crit: 0.03 },
    skill: {
      id: "k_bunny",
      name: "\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
      icon: "up",
      cooldown: 11,
      kit: [{ type: "leap", reach: 320, r: 95, power: 1.3, stun: 0.4 }],
      desc: "\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E25\u0E07\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E08\u0E38\u0E14\u0E25\u0E07 \xD71.3"
    },
    ability: { name: "\u0E02\u0E32\u0E2A\u0E1B\u0E23\u0E34\u0E07", desc: "\u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 20% \xB7 \u0E17\u0E2D\u0E07 +5%", dodgeCd: 0.2, goldMult: 0.05 },
    look: { skin: "#f6e6dc", shade: "#dcc4b8", hair: "#f4f0f8", eye: "#c25a8a", trait: "bunny", tc: "#f4f0f8" }
  },
  gill: {
    id: "gill",
    name: "\u0E0A\u0E32\u0E27\u0E40\u0E07\u0E37\u0E2D\u0E01\u0E1A\u0E36\u0E07",
    rarity: "uncommon",
    weight: 8,
    color: "#5fb8b0",
    desc: "\u0E21\u0E35\u0E04\u0E23\u0E35\u0E1A\u0E41\u0E17\u0E19\u0E2B\u0E39 \u0E2B\u0E32\u0E22\u0E43\u0E08\u0E43\u0E15\u0E49\u0E19\u0E49\u0E33\u0E44\u0E14\u0E49 \u0E40\u0E23\u0E35\u0E22\u0E01\u0E04\u0E25\u0E37\u0E48\u0E19\u0E44\u0E14\u0E49\u0E14\u0E49\u0E27\u0E22\u0E21\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E48\u0E32",
    lore: "\u0E0A\u0E32\u0E27\u0E40\u0E07\u0E37\u0E2D\u0E01\u0E1A\u0E36\u0E07\u0E23\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E15\u0E49\u0E19\u0E49\u0E33 \u0E40\u0E2A\u0E35\u0E22\u0E07\u0E44\u0E1B\u0E44\u0E01\u0E25\u0E01\u0E27\u0E48\u0E32\u0E1A\u0E19\u0E1A\u0E01\u0E40\u0E08\u0E47\u0E14\u0E40\u0E17\u0E48\u0E32",
    stats: { hpPct: 0.08, defPct: 0.04 },
    skill: {
      id: "k_gill",
      name: "\u0E04\u0E25\u0E37\u0E48\u0E19\u0E0B\u0E31\u0E14",
      icon: "wind",
      cooldown: 13,
      kit: [{ type: "blast", r: 170, power: 0.9, kb: 460 }],
      desc: "\u0E04\u0E25\u0E37\u0E48\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD70.9 \u0E1C\u0E25\u0E31\u0E01\u0E28\u0E31\u0E15\u0E23\u0E39\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E2D\u0E2D\u0E01\u0E44\u0E1B\u0E44\u0E01\u0E25"
    },
    ability: { name: "\u0E1C\u0E34\u0E27\u0E25\u0E37\u0E48\u0E19", desc: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01 \u221230% \xB7 \u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.2%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35", trapReduce: 0.3, regen: 2e-3 },
    look: { skin: "#b8dcd0", shade: "#94bcb0", hair: "#2f6a6a", eye: "#1a3a5a", trait: "fins", tc: "#5fb8b0" }
  },
  // ---------------------------------------------------------------- rare
  crystal: {
    id: "crystal",
    name: "\u0E0A\u0E32\u0E27\u0E1C\u0E25\u0E36\u0E01",
    rarity: "rare",
    weight: 5,
    color: "#9fd8ff",
    desc: "\u0E1C\u0E25\u0E36\u0E01\u0E43\u0E2A\u0E07\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E28\u0E35\u0E23\u0E29\u0E30 \u0E1C\u0E34\u0E27\u0E41\u0E02\u0E47\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E2B\u0E34\u0E19",
    lore: "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E0A\u0E32\u0E27\u0E1C\u0E25\u0E36\u0E01\u0E42\u0E01\u0E23\u0E18 \u0E1C\u0E25\u0E36\u0E01\u0E1A\u0E19\u0E2B\u0E31\u0E27\u0E08\u0E30\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E35\u0E40\u0E25\u0E37\u0E2D\u0E14",
    stats: { defPct: 0.15, critMult: 0.2 },
    skill: {
      id: "k_crystal",
      name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E1C\u0E25\u0E36\u0E01",
      icon: "def",
      cooldown: 18,
      kit: [{ type: "shield", pct: 0.3, t: 6 }, { type: "blast", r: 120, power: 0.6, slow: 0.6 }],
      desc: "\u0E44\u0E14\u0E49\u0E42\u0E25\u0E48 30% \u0E02\u0E2D\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 \u0E19\u0E32\u0E19 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E30\u0E40\u0E28\u0E29\u0E1C\u0E25\u0E36\u0E01\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD70.6 \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E0A\u0E49\u0E32\u0E25\u0E07"
    },
    ability: { name: "\u0E1C\u0E25\u0E36\u0E01\u0E23\u0E31\u0E1A\u0E41\u0E23\u0E07", desc: "\u0E40\u0E01\u0E08\u0E42\u0E25\u0E48\u0E25\u0E14\u0E0A\u0E49\u0E32\u0E25\u0E07 30%", guardPower: 0.3 },
    look: { skin: "#e0ecf4", shade: "#b8ccdc", hair: "#5a7a9a", eye: "#3a8ad0", trait: "crystal", tc: "#9fd8ff" }
  },
  thorn: {
    id: "thorn",
    name: "\u0E0A\u0E32\u0E27\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E2B\u0E19\u0E32\u0E21",
    rarity: "rare",
    weight: 5,
    color: "#6aa25a",
    desc: "\u0E2B\u0E19\u0E32\u0E21\u0E07\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E23\u0E2D\u0E1A\u0E28\u0E35\u0E23\u0E29\u0E30 \u0E22\u0E34\u0E48\u0E07\u0E16\u0E39\u0E01\u0E15\u0E35\u0E22\u0E34\u0E48\u0E07\u0E2A\u0E27\u0E19\u0E41\u0E23\u0E07",
    lore: "\u0E23\u0E32\u0E0A\u0E32\u0E02\u0E2D\u0E07\u0E0A\u0E32\u0E27\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E2B\u0E19\u0E32\u0E21\u0E04\u0E37\u0E2D\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E21\u0E35\u0E41\u0E1C\u0E25\u0E40\u0E1B\u0E47\u0E19\u0E21\u0E32\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14",
    stats: { atkPct: 0.08, hpPct: 0.06 },
    skill: {
      id: "k_thorn",
      name: "\u0E2B\u0E19\u0E32\u0E21\u0E01\u0E23\u0E30\u0E08\u0E32\u0E22",
      icon: "snare",
      cooldown: 12,
      kit: [{ type: "volley", count: 12, ring: true, power: 0.45, speed: 600, pierce: 1, tint: ["106,162,90", "#d6f59a"] }],
      desc: "\u0E2B\u0E19\u0E32\u0E21 12 \u0E14\u0E2D\u0E01\u0E1E\u0E38\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \u0E14\u0E2D\u0E01\u0E25\u0E30 \xD70.45 \u0E17\u0E30\u0E25\u0E38\u0E44\u0E14\u0E49 1 \u0E15\u0E31\u0E27"
    },
    ability: { name: "\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E27\u0E19", desc: "\u0E15\u0E35\u0E2A\u0E27\u0E19\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 25% \xB7 \u0E42\u0E2D\u0E01\u0E32\u0E2A 8% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07", counterBonus: 0.25, debuff: 0.08 },
    look: { skin: "#e4d8b8", shade: "#c4b490", hair: "#3a5a2a", eye: "#4a8a3a", trait: "thorns", tc: "#5a7a3a" }
  },
  frost: {
    id: "frost",
    name: "\u0E0A\u0E32\u0E27\u0E2B\u0E34\u0E21\u0E30",
    rarity: "rare",
    weight: 5,
    color: "#cfeaff",
    desc: "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E25\u0E30\u0E25\u0E32\u0E22 \u0E1E\u0E32\u0E22\u0E38\u0E2B\u0E34\u0E21\u0E30\u0E40\u0E14\u0E34\u0E19\u0E15\u0E32\u0E21\u0E44\u0E1B\u0E17\u0E38\u0E01\u0E17\u0E35\u0E48",
    lore: "\u0E0A\u0E32\u0E27\u0E2B\u0E34\u0E21\u0E30\u0E40\u0E01\u0E34\u0E14\u0E43\u0E19\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E32\u0E27\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E1B\u0E35 \u0E41\u0E25\u0E30\u0E15\u0E32\u0E22\u0E43\u0E19\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E38\u0E48\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14",
    stats: { defPct: 0.1, hpPct: 0.08 },
    skill: {
      id: "k_frost",
      name: "\u0E1E\u0E32\u0E22\u0E38\u0E2B\u0E34\u0E21\u0E30",
      icon: "wind",
      cooldown: 18,
      kit: [{ type: "field", r: 180, t: 5, power: 0.25, every: 0.4, slow: 0.45, color: "#cfeaff", follow: true }],
      desc: "\u0E1E\u0E32\u0E22\u0E38\u0E2B\u0E34\u0E21\u0E30\u0E2B\u0E21\u0E38\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E27\u0E07\u0E42\u0E14\u0E19 \xD70.25 \u0E17\u0E38\u0E01 0.4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E41\u0E25\u0E30\u0E0A\u0E49\u0E32\u0E25\u0E07\u0E21\u0E32\u0E01"
    },
    ability: { name: "\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E40\u0E22\u0E47\u0E19", desc: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E44\u0E1F \u221220% \xB7 \u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 30% \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +30%", fireReduce: 0.2, lowHpDef: 0.3 },
    look: { skin: "#eef4fa", shade: "#c8d6e4", hair: "#f4faff", eye: "#5ab8e8", trait: "icicles", tc: "#cfeaff" }
  },
  storm: {
    id: "storm",
    name: "\u0E0A\u0E32\u0E27\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32",
    rarity: "rare",
    weight: 5,
    color: "#ffe65a",
    desc: "\u0E1C\u0E21\u0E15\u0E31\u0E49\u0E07\u0E0A\u0E31\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32 \u0E41\u0E04\u0E48\u0E08\u0E31\u0E1A\u0E21\u0E37\u0E2D\u0E01\u0E47\u0E0A\u0E47\u0E2D\u0E15\u0E41\u0E25\u0E49\u0E27",
    lore: "\u0E0A\u0E32\u0E27\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E15\u0E31\u0E49\u0E07\u0E0A\u0E37\u0E48\u0E2D\u0E25\u0E39\u0E01\u0E15\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1F\u0E49\u0E32\u0E23\u0E49\u0E2D\u0E07\u0E43\u0E19\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E40\u0E01\u0E34\u0E14",
    stats: { atkPct: 0.06, spd: 0.06 },
    skill: {
      id: "k_storm",
      name: "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E41\u0E15\u0E01\u0E01\u0E34\u0E48\u0E07",
      icon: "spark",
      cooldown: 10,
      kit: [{ type: "chain", jumps: 5, power: 1.1, range: 420 }],
      desc: "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32 \xD71.1 \u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E15\u0E48\u0E2D\u0E44\u0E14\u0E49\u0E2D\u0E35\u0E01 5 \u0E15\u0E31\u0E27"
    },
    ability: { name: "\u0E1B\u0E23\u0E30\u0E2A\u0E32\u0E17\u0E44\u0E27", desc: "\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19 \xB7 \u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2A\u0E01\u0E34\u0E25 \u22128%", perfectBonus: 0.04, skillCd: 0.08 },
    look: { skin: "#f3e6cc", shade: "#d6c4a4", hair: "#ffe65a", eye: "#4a6aff", trait: "bolts", tc: "#ffe65a" }
  },
  antler: {
    id: "antler",
    name: "\u0E0A\u0E32\u0E27\u0E01\u0E27\u0E32\u0E07\u0E1B\u0E48\u0E32",
    rarity: "rare",
    weight: 5,
    color: "#c8a06a",
    desc: "\u0E40\u0E02\u0E32\u0E01\u0E27\u0E32\u0E07\u0E41\u0E15\u0E01\u0E01\u0E34\u0E48\u0E07\u0E07\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E28\u0E35\u0E23\u0E29\u0E30 \u0E43\u0E08\u0E14\u0E35\u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E41\u0E1E\u0E49\u0E01\u0E32\u0E23\u0E1E\u0E38\u0E48\u0E07\u0E0A\u0E19",
    lore: "\u0E40\u0E02\u0E32\u0E02\u0E2D\u0E07\u0E0A\u0E32\u0E27\u0E01\u0E27\u0E32\u0E07\u0E1B\u0E48\u0E32\u0E1C\u0E25\u0E31\u0E14\u0E17\u0E38\u0E01\u0E24\u0E14\u0E39\u0E2B\u0E19\u0E32\u0E27 \u0E41\u0E25\u0E30\u0E40\u0E02\u0E32\u0E40\u0E01\u0E48\u0E32\u0E08\u0E30\u0E16\u0E39\u0E01\u0E1D\u0E31\u0E07\u0E44\u0E27\u0E49\u0E43\u0E15\u0E49\u0E15\u0E49\u0E19\u0E44\u0E21\u0E49",
    stats: { hpPct: 0.1, spd: 0.04 },
    skill: {
      id: "k_antler",
      name: "\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E02\u0E32\u0E1B\u0E48\u0E32",
      icon: "lunge",
      cooldown: 13,
      kit: [{ type: "dash", dist: 260, width: 70, power: 1.8, kb: 500 }, { type: "heal", pct: 0.08 }],
      desc: "\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E02\u0E32\u0E44\u0E1B\u0E44\u0E01\u0E25 260 \u0E2B\u0E19\u0E48\u0E27\u0E22 \xD71.8 \u0E01\u0E23\u0E30\u0E41\u0E17\u0E01\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19 \u0E41\u0E25\u0E30\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 8%"
    },
    ability: { name: "\u0E1B\u0E48\u0E32\u0E04\u0E37\u0E19\u0E01\u0E33\u0E25\u0E31\u0E07", desc: "\u0E06\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 1.5%", healOnKill: 0.015 },
    look: { skin: "#ecd6b4", shade: "#ccb08c", hair: "#6a4a2a", eye: "#3a2a1a", trait: "antlers", tc: "#c8a06a" }
  },
  moth: {
    id: "moth",
    name: "\u0E0A\u0E32\u0E27\u0E1C\u0E35\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E23\u0E32\u0E15\u0E23\u0E35",
    rarity: "rare",
    weight: 5,
    color: "#b8a0d8",
    desc: "\u0E2B\u0E19\u0E27\u0E14\u0E02\u0E19\u0E19\u0E38\u0E48\u0E21\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E1C\u0E35\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E01\u0E25\u0E32\u0E07\u0E04\u0E37\u0E19 \u0E1D\u0E38\u0E48\u0E19\u0E08\u0E32\u0E01\u0E1C\u0E21\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E2B\u0E25\u0E31\u0E1A",
    lore: "\u0E0A\u0E32\u0E27\u0E1C\u0E35\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E23\u0E32\u0E15\u0E23\u0E35\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E08\u0E38\u0E14\u0E44\u0E1F \u0E40\u0E1E\u0E23\u0E32\u0E30\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E08\u0E30\u0E1A\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E32\u0E21\u0E31\u0E19",
    stats: { crit: 0.05, critMult: 0.15 },
    skill: {
      id: "k_moth",
      name: "\u0E1D\u0E38\u0E48\u0E19\u0E19\u0E34\u0E17\u0E23\u0E32",
      icon: "eye",
      cooldown: 17,
      kit: [{ type: "blast", r: 200, power: 0.3, stun: 1.6, kb: 0 }],
      desc: "\u0E42\u0E1B\u0E23\u0E22\u0E1D\u0E38\u0E48\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD70.3 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E2B\u0E25\u0E31\u0E1A\u0E44\u0E1B 1.6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 (\u0E1A\u0E2D\u0E2A\u0E44\u0E21\u0E48\u0E2B\u0E25\u0E31\u0E1A)"
    },
    ability: { name: "\u0E1D\u0E38\u0E48\u0E19\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07", desc: "\u0E42\u0E2D\u0E01\u0E32\u0E2A 12% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07 \xB7 \u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 8%", debuff: 0.12, dodgeCd: 0.08 },
    look: { skin: "#ece2ec", shade: "#ccbccc", hair: "#5a4a6a", eye: "#d8b0ff", trait: "antennae", tc: "#b8a0d8" }
  },
  tide: {
    id: "tide",
    name: "\u0E0A\u0E32\u0E27\u0E17\u0E30\u0E40\u0E25\u0E25\u0E36\u0E01",
    rarity: "rare",
    weight: 5,
    color: "#3a7aa8",
    desc: "\u0E1C\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E27\u0E14\u0E1B\u0E25\u0E32\u0E2B\u0E21\u0E36\u0E01 \u0E25\u0E32\u0E01\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E2B\u0E32\u0E15\u0E31\u0E27\u0E44\u0E14\u0E49",
    lore: "\u0E0A\u0E32\u0E27\u0E17\u0E30\u0E40\u0E25\u0E25\u0E36\u0E01\u0E02\u0E36\u0E49\u0E19\u0E1D\u0E31\u0E48\u0E07\u0E1B\u0E35\u0E25\u0E30\u0E04\u0E23\u0E31\u0E49\u0E07 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E39\u0E27\u0E48\u0E32\u0E14\u0E27\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E22\u0E31\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E48\u0E32",
    stats: { hpPct: 0.12, defPct: 0.06 },
    skill: {
      id: "k_tide",
      name: "\u0E2B\u0E19\u0E27\u0E14\u0E01\u0E23\u0E30\u0E41\u0E2A\u0E19\u0E49\u0E33",
      icon: "snare",
      cooldown: 14,
      kit: [{ type: "pull", r: 260, force: 520, power: 0.6 }, { type: "mark", r: 260, mark: 0.2, t: 4 }],
      desc: "\u0E14\u0E36\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32 \xD70.6 \u0E41\u0E25\u0E30\u0E17\u0E33\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22: \u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 +20% \u0E19\u0E32\u0E19 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E01\u0E32\u0E22\u0E19\u0E49\u0E33", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.3%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01 \u221215%", regen: 3e-3, trapReduce: 0.15 },
    look: { skin: "#c8d8e0", shade: "#a4b8c4", hair: "#3a5a8a", eye: "#7fe8ff", trait: "tentacles", tc: "#4a6a9a" }
  },
  ember: {
    id: "ember",
    name: "\u0E0A\u0E32\u0E27\u0E40\u0E1B\u0E25\u0E27\u0E16\u0E48\u0E32\u0E19",
    rarity: "rare",
    weight: 5,
    color: "#ff7a33",
    desc: "\u0E1C\u0E21\u0E25\u0E38\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E08\u0E23\u0E34\u0E07\u0E46 \u0E08\u0E38\u0E14\u0E44\u0E1F\u0E15\u0E34\u0E14\u0E17\u0E38\u0E01\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E41\u0E15\u0E30",
    lore: "\u0E0A\u0E32\u0E27\u0E40\u0E1B\u0E25\u0E27\u0E16\u0E48\u0E32\u0E19\u0E01\u0E25\u0E31\u0E27\u0E1D\u0E19\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32\u0E2A\u0E34\u0E48\u0E07\u0E43\u0E14 \u0E41\u0E15\u0E48\u0E01\u0E47\u0E0A\u0E2D\u0E1A\u0E40\u0E15\u0E49\u0E19\u0E23\u0E33\u0E01\u0E25\u0E32\u0E07\u0E1D\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14",
    stats: { atkPct: 0.1, critMult: 0.1 },
    skill: {
      id: "k_ember",
      name: "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E1B\u0E25\u0E27",
      icon: "whirl",
      cooldown: 15,
      kit: [{ type: "blast", r: 140, power: 1.2, burn: true }, { type: "buff", t: 6, burn: 1 }],
      desc: "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E44\u0E1F\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD71.2 \u0E41\u0E25\u0E49\u0E27 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E15\u0E34\u0E14\u0E44\u0E1F"
    },
    ability: { name: "\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E44\u0E1F", desc: "\u0E42\u0E2D\u0E01\u0E32\u0E2A 20% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E15\u0E34\u0E14\u0E44\u0E1F \xB7 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E44\u0E1F \u221240%", ignite: 0.2, fireReduce: 0.4 },
    look: { skin: "#f0cca4", shade: "#d4a87c", hair: "#ff7a33", eye: "#ffcf5a", trait: "flame", tc: "#ff7a33" }
  },
  gem: {
    id: "gem",
    name: "\u0E0A\u0E32\u0E27\u0E2D\u0E31\u0E0D\u0E21\u0E13\u0E35",
    rarity: "rare",
    weight: 5,
    color: "#ff5f9a",
    desc: "\u0E2D\u0E31\u0E0D\u0E21\u0E13\u0E35\u0E1D\u0E31\u0E07\u0E01\u0E25\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E1C\u0E32\u0E01 \u0E2B\u0E31\u0E01\u0E40\u0E2B\u0E41\u0E2A\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E33\u0E17\u0E30\u0E25\u0E27\u0E07",
    lore: "\u0E2D\u0E31\u0E0D\u0E21\u0E13\u0E35\u0E02\u0E2D\u0E07\u0E0A\u0E32\u0E27\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E0B\u0E49\u0E33\u0E2A\u0E35 \u0E1E\u0E48\u0E2D\u0E04\u0E49\u0E32\u0E17\u0E38\u0E01\u0E40\u0E21\u0E37\u0E2D\u0E07\u0E08\u0E36\u0E07\u0E08\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E44\u0E14\u0E49",
    stats: { critMult: 0.3, crit: 0.04 },
    skill: {
      id: "k_gem",
      name: "\u0E1B\u0E23\u0E34\u0E0B\u0E36\u0E21\u0E40\u0E08\u0E47\u0E14\u0E2A\u0E35",
      icon: "star",
      cooldown: 11,
      kit: [{ type: "volley", count: 7, spread: 70, power: 0.6, speed: 900, pierce: 3, tint: ["255,95,154", "#ffe0f0"] }],
      desc: "\u0E41\u0E2A\u0E07 7 \u0E2A\u0E32\u0E22\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E1E\u0E31\u0E14 \xD70.6 \u0E17\u0E30\u0E25\u0E38\u0E44\u0E14\u0E49 3 \u0E15\u0E31\u0E27"
    },
    ability: { name: "\u0E15\u0E32\u0E40\u0E07\u0E34\u0E19", desc: "\u0E17\u0E2D\u0E07 +25% \xB7 \u0E23\u0E30\u0E22\u0E30\u0E14\u0E39\u0E14\u0E02\u0E2D\u0E07 +50%", goldMult: 0.25, magnet: 0.5 },
    look: { skin: "#f0dcd0", shade: "#d4bcb0", hair: "#4a2a4a", eye: "#ff5f9a", trait: "gem", tc: "#ff5f9a" }
  },
  wildling: {
    id: "wildling",
    name: "\u0E0A\u0E32\u0E27\u0E25\u0E32\u0E22\u0E1E\u0E22\u0E31\u0E04\u0E06\u0E4C",
    rarity: "rare",
    weight: 5,
    color: "#ff9a3a",
    desc: "\u0E25\u0E32\u0E22\u0E40\u0E2A\u0E37\u0E2D\u0E1A\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E25\u0E30\u0E41\u0E02\u0E19 \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E14\u0E37\u0E2D\u0E14\u0E14\u0E32\u0E25\u0E08\u0E30\u0E14\u0E39\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39",
    lore: "\u0E25\u0E32\u0E22\u0E1A\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E0A\u0E32\u0E27\u0E25\u0E32\u0E22\u0E1E\u0E22\u0E31\u0E04\u0E06\u0E4C\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E43\u0E04\u0E23 \u0E43\u0E0A\u0E49\u0E41\u0E17\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E14\u0E49",
    stats: { atkPct: 0.12, crit: 0.04 },
    skill: {
      id: "k_wildling",
      name: "\u0E42\u0E17\u0E2A\u0E30\u0E1E\u0E22\u0E31\u0E04\u0E06\u0E4C",
      icon: "blood",
      cooldown: 20,
      kit: [{ type: "buff", t: 6, dmg: 0.3, haste: 0.2, lifesteal: 0.06 }],
      desc: "6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E14\u0E32\u0E40\u0E21\u0E08 +30% \u0E15\u0E35\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 20% \u0E41\u0E25\u0E30\u0E14\u0E39\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14 6% \u0E02\u0E2D\u0E07\u0E14\u0E32\u0E40\u0E21\u0E08"
    },
    ability: { name: "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E41\u0E17\u0E49", desc: "\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19 \xB7 \u0E2A\u0E01\u0E34\u0E25\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 10%", perfectBonus: 0.03, skillPower: 0.1 },
    look: { skin: "#f4d0a0", shade: "#d8ac78", hair: "#f08a2a", eye: "#e8b020", trait: "stripes", tc: "#2a1a10" }
  },
  // ---------------------------------------------------------------- epic
  seraph: {
    id: "seraph",
    name: "\u0E0A\u0E32\u0E27\u0E23\u0E31\u0E28\u0E21\u0E35",
    rarity: "epic",
    weight: 2.5,
    color: "#fff3a0",
    desc: "\u0E27\u0E07\u0E23\u0E31\u0E28\u0E21\u0E35\u0E25\u0E2D\u0E22\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E28\u0E35\u0E23\u0E29\u0E30 \u0E41\u0E2A\u0E07\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E0A\u0E33\u0E23\u0E30\u0E17\u0E31\u0E49\u0E07\u0E1A\u0E32\u0E14\u0E41\u0E1C\u0E25\u0E41\u0E25\u0E30\u0E28\u0E31\u0E15\u0E23\u0E39",
    lore: "\u0E27\u0E07\u0E23\u0E31\u0E28\u0E21\u0E35\u0E02\u0E2D\u0E07\u0E0A\u0E32\u0E27\u0E19\u0E35\u0E49\u0E08\u0E30\u0E2B\u0E23\u0E35\u0E48\u0E25\u0E07\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E42\u0E01\u0E2B\u0E01 \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E01\u0E25\u0E49\u0E32\u0E42\u0E01\u0E2B\u0E01",
    stats: { hpPct: 0.1, defPct: 0.1, crit: 0.04 },
    skill: {
      id: "k_seraph",
      name: "\u0E41\u0E2A\u0E07\u0E0A\u0E33\u0E23\u0E30",
      icon: "crown",
      cooldown: 22,
      kit: [{ type: "heal", pct: 0.25 }, { type: "blast", r: 180, power: 1, kb: 300 }, { type: "buff", t: 4, reduce: 0.3 }],
      desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 25% \u0E41\u0E2A\u0E07\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD71.0 \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 \u221230% \u0E19\u0E32\u0E19 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E1E\u0E23\u0E15\u0E49\u0E19\u0E2B\u0E49\u0E2D\u0E07", desc: "\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E49\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49\u0E42\u0E25\u0E48 15% \xB7 \u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.2%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35", shieldPct: 0.15, regen: 2e-3 },
    look: { skin: "#f8ecdc", shade: "#e0ccb4", hair: "#f5d48a", eye: "#c89a3a", trait: "halo", tc: "#ffe89a" }
  },
  oracle: {
    id: "oracle",
    name: "\u0E0A\u0E32\u0E27\u0E40\u0E19\u0E15\u0E23\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21",
    rarity: "epic",
    weight: 2.5,
    color: "#9f7fff",
    desc: "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21\u0E01\u0E25\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E1C\u0E32\u0E01\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E38\u0E14\u0E15\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E17\u0E38\u0E01\u0E2A\u0E34\u0E48\u0E07",
    lore: "\u0E15\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2B\u0E25\u0E31\u0E1A \u0E0A\u0E32\u0E27\u0E40\u0E19\u0E15\u0E23\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21\u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E1D\u0E31\u0E19",
    stats: { crit: 0.1, critMult: 0.2 },
    skill: {
      id: "k_oracle",
      name: "\u0E15\u0E32\u0E2B\u0E22\u0E31\u0E48\u0E07\u0E23\u0E39\u0E49",
      icon: "eye",
      cooldown: 20,
      kit: [{ type: "mark", r: 420, mark: 0.25, t: 6 }, { type: "buff", t: 6, crit: 0.35 }],
      desc: "\u0E17\u0E33\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E49\u0E2D\u0E07: \u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 +25% \u0E41\u0E25\u0E30\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E40\u0E23\u0E32 +35% \u0E19\u0E32\u0E19 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E40\u0E2B\u0E47\u0E19\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32", desc: "\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E21\u0E32\u0E01 \xB7 \u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 10%", perfectBonus: 0.08, dodgeCd: 0.1 },
    look: { skin: "#ece0f0", shade: "#ccbcd4", hair: "#3a2a5a", eye: "#9f7fff", trait: "thirdeye", tc: "#9f7fff" }
  },
  oni: {
    id: "oni",
    name: "\u0E0A\u0E32\u0E27\u0E42\u0E2D\u0E19\u0E34",
    rarity: "epic",
    weight: 2.5,
    color: "#e0503a",
    desc: "\u0E40\u0E02\u0E32\u0E42\u0E04\u0E49\u0E07\u0E41\u0E25\u0E30\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E22\u0E31\u0E01\u0E29\u0E4C \u0E17\u0E38\u0E1A\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27\u0E28\u0E31\u0E15\u0E23\u0E39\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E49\u0E2D\u0E07",
    lore: "\u0E42\u0E2D\u0E19\u0E34\u0E17\u0E35\u0E48\u0E43\u0E08\u0E14\u0E35\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E01\u0E47\u0E22\u0E31\u0E07\u0E17\u0E38\u0E1A\u0E42\u0E15\u0E4A\u0E30\u0E1E\u0E31\u0E07\u0E40\u0E27\u0E25\u0E32\u0E2B\u0E31\u0E27\u0E40\u0E23\u0E32\u0E30",
    stats: { atkPct: 0.16, hpPct: 0.1, spd: -0.05 },
    skill: {
      id: "k_oni",
      name: "\u0E01\u0E33\u0E1B\u0E31\u0E49\u0E19\u0E22\u0E31\u0E01\u0E29\u0E4C",
      icon: "hammer",
      cooldown: 16,
      kit: [{ type: "buff", t: 3, reduce: 0.4 }, { type: "blast", r: 165, power: 2.2, stun: 0.9, kb: 520 }],
      desc: "\u0E17\u0E38\u0E1A\u0E1E\u0E37\u0E49\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD72.2 \u0E2A\u0E15\u0E31\u0E19 0.9 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 \u221240% \u0E19\u0E32\u0E19 3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E22\u0E34\u0E48\u0E07\u0E40\u0E08\u0E47\u0E1A\u0E22\u0E34\u0E48\u0E07\u0E41\u0E01\u0E23\u0E48\u0E07", desc: "\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 30% \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +40% \xB7 \u0E15\u0E35\u0E2A\u0E27\u0E19\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 20%", lowHpDef: 0.4, counterBonus: 0.2 },
    look: { skin: "#e8a090", shade: "#c47a6a", hair: "#2a1a1a", eye: "#ffcf5a", trait: "ramhorns", trait2: "tusks", tc: "#f3ead2" }
  },
  unicorn: {
    id: "unicorn",
    name: "\u0E0A\u0E32\u0E27\u0E40\u0E02\u0E32\u0E40\u0E14\u0E35\u0E22\u0E27",
    rarity: "epic",
    weight: 2.5,
    color: "#f4d0ff",
    desc: "\u0E40\u0E02\u0E32\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E1B\u0E25\u0E48\u0E07\u0E41\u0E2A\u0E07\u0E01\u0E25\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E1C\u0E32\u0E01 \u0E1E\u0E38\u0E48\u0E07\u0E17\u0E30\u0E25\u0E27\u0E07\u0E14\u0E31\u0E48\u0E07\u0E2B\u0E2D\u0E01\u0E41\u0E2A\u0E07",
    lore: "\u0E40\u0E02\u0E32\u0E02\u0E2D\u0E07\u0E0A\u0E32\u0E27\u0E40\u0E02\u0E32\u0E40\u0E14\u0E35\u0E22\u0E27\u0E23\u0E31\u0E01\u0E29\u0E32\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E1E\u0E34\u0E29 \u0E22\u0E01\u0E40\u0E27\u0E49\u0E19\u0E1E\u0E34\u0E29\u0E02\u0E2D\u0E07\u0E04\u0E27\u0E32\u0E21\u0E42\u0E25\u0E20",
    stats: { hpPct: 0.08, atkPct: 0.08, spd: 0.05 },
    skill: {
      id: "k_unicorn",
      name: "\u0E2B\u0E2D\u0E01\u0E41\u0E2A\u0E07",
      icon: "spear",
      cooldown: 12,
      kit: [{ type: "iframes", t: 0.5 }, { type: "dash", dist: 320, width: 50, power: 2.2 }],
      desc: "\u0E1E\u0E38\u0E48\u0E07\u0E17\u0E30\u0E25\u0E27\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E15\u0E23\u0E07 320 \u0E2B\u0E19\u0E48\u0E27\u0E22 \xD72.2 \u0E2D\u0E21\u0E15\u0E30\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1E\u0E38\u0E48\u0E07"
    },
    ability: { name: "\u0E41\u0E2A\u0E07\u0E0A\u0E33\u0E23\u0E30", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.2%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E06\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1F\u0E37\u0E49\u0E19 1%", regen: 2e-3, healOnKill: 0.01 },
    look: { skin: "#f8eef4", shade: "#e0ccd8", hair: "#f4d0ff", eye: "#a06ad0", trait: "unihorn", tc: "#fff3f8" }
  },
  bone: {
    id: "bone",
    name: "\u0E0A\u0E32\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E32\u0E01\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01",
    rarity: "epic",
    weight: 2.5,
    color: "#e8e0c8",
    desc: "\u0E2A\u0E27\u0E21\u0E01\u0E30\u0E42\u0E2B\u0E25\u0E01\u0E1A\u0E23\u0E23\u0E1E\u0E1A\u0E38\u0E23\u0E38\u0E29\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E21\u0E27\u0E01 \u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E02\u0E2D\u0E07\u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32\u0E22\u0E31\u0E07\u0E04\u0E2D\u0E22\u0E1B\u0E01\u0E1B\u0E49\u0E2D\u0E07",
    lore: "\u0E01\u0E30\u0E42\u0E2B\u0E25\u0E01\u0E1A\u0E19\u0E2B\u0E31\u0E27\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E02\u0E2D\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E41\u0E15\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E02\u0E2D\u0E07\u0E1B\u0E39\u0E48\u0E17\u0E27\u0E14\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E44\u0E1B\u0E44\u0E2B\u0E19",
    stats: { atkPct: 0.1, crit: 0.06 },
    skill: {
      id: "k_bone",
      name: "\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E1A\u0E23\u0E23\u0E1E\u0E0A\u0E19",
      icon: "skull",
      cooldown: 18,
      kit: [{ type: "orbit", n: 3, r: 95, t: 7, power: 0.5, every: 0.3, color: "#9fffd8" }],
      desc: "\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13 3 \u0E14\u0E27\u0E07\u0E2B\u0E21\u0E38\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 7 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E43\u0E04\u0E23\u0E42\u0E14\u0E19\u0E23\u0E31\u0E1A \xD70.5"
    },
    ability: { name: "\u0E01\u0E34\u0E19\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", desc: "\u0E06\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 3%", healOnKill: 0.03 },
    look: { skin: "#d8c8b0", shade: "#b8a48c", hair: "#1a1410", eye: "#9fffd8", trait: "skullcap", tc: "#efe6d0" }
  },
  sylph: {
    id: "sylph",
    name: "\u0E0A\u0E32\u0E27\u0E1B\u0E35\u0E01\u0E25\u0E21",
    rarity: "epic",
    weight: 2.5,
    color: "#bff0e0",
    desc: "\u0E1B\u0E35\u0E01\u0E40\u0E25\u0E47\u0E01\u0E46 \u0E17\u0E35\u0E48\u0E02\u0E21\u0E31\u0E1A \u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E17\u0E48\u0E32\u0E21\u0E01\u0E25\u0E32\u0E07\u0E1E\u0E32\u0E22\u0E38\u0E43\u0E1A\u0E21\u0E35\u0E14",
    lore: "\u0E0A\u0E32\u0E27\u0E1B\u0E35\u0E01\u0E25\u0E21\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E49\u0E32\u0E19 \u0E1A\u0E49\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32\u0E04\u0E37\u0E2D\u0E17\u0E34\u0E28\u0E17\u0E35\u0E48\u0E25\u0E21\u0E1E\u0E31\u0E14\u0E44\u0E1B",
    stats: { spd: 0.12, crit: 0.05 },
    skill: {
      id: "k_sylph",
      name: "\u0E1E\u0E32\u0E22\u0E38\u0E43\u0E1A\u0E21\u0E35\u0E14",
      icon: "wind",
      cooldown: 15,
      kit: [{ type: "orbit", n: 5, r: 125, t: 4, power: 0.35, every: 0.2, color: "#bff0e0" }, { type: "buff", t: 4, speed: 0.3 }],
      desc: "\u0E43\u0E1A\u0E21\u0E35\u0E14\u0E25\u0E21 5 \u0E43\u0E1A\u0E2B\u0E21\u0E38\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xD70.35 \u0E41\u0E25\u0E30\u0E27\u0E34\u0E48\u0E07\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 30%"
    },
    ability: { name: "\u0E15\u0E31\u0E27\u0E25\u0E21", desc: "\u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 25% \xB7 \u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19", dodgeCd: 0.25, perfectBonus: 0.04 },
    look: { skin: "#eef6f2", shade: "#cde0d8", hair: "#8ad0b8", eye: "#2a8a6a", trait: "headwings", tc: "#e8fff8" }
  },
  star: {
    id: "star",
    name: "\u0E0A\u0E32\u0E27\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27",
    rarity: "epic",
    weight: 2.5,
    color: "#fff07a",
    desc: "\u0E14\u0E32\u0E27\u0E14\u0E27\u0E07\u0E40\u0E25\u0E47\u0E01\u0E25\u0E2D\u0E22\u0E27\u0E19\u0E23\u0E2D\u0E1A\u0E28\u0E35\u0E23\u0E29\u0E30 \u0E40\u0E23\u0E35\u0E22\u0E01\u0E14\u0E32\u0E27\u0E15\u0E01\u0E25\u0E07\u0E21\u0E32\u0E44\u0E14\u0E49",
    lore: "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E14\u0E32\u0E27\u0E15\u0E01 \u0E0A\u0E32\u0E27\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27\u0E08\u0E30\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E0D\u0E32\u0E15\u0E34\u0E04\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E01\u0E25\u0E31\u0E1A\u0E1A\u0E49\u0E32\u0E19",
    stats: { atkPct: 0.08, critMult: 0.25 },
    skill: {
      id: "k_star",
      name: "\u0E14\u0E32\u0E27\u0E15\u0E01",
      icon: "star",
      cooldown: 16,
      kit: [{ type: "meteor", count: 6, r: 90, delay: 0.6, power: 1.3, reach: 420 }],
      desc: "\u0E14\u0E32\u0E27 6 \u0E14\u0E27\u0E07\u0E15\u0E01\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \u0E14\u0E27\u0E07\u0E25\u0E30 \xD71.3"
    },
    ability: { name: "\u0E41\u0E2A\u0E07\u0E14\u0E32\u0E27\u0E19\u0E33\u0E17\u0E32\u0E07", desc: "\u0E2A\u0E01\u0E34\u0E25\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 15% \xB7 \u0E23\u0E30\u0E22\u0E30\u0E14\u0E39\u0E14\u0E02\u0E2D\u0E07 +30%", skillPower: 0.15, magnet: 0.3 },
    look: { skin: "#f0e8dc", shade: "#d0c4b4", hair: "#2a3a6a", eye: "#fff07a", trait: "starcrown", tc: "#fff07a" }
  },
  blossom: {
    id: "blossom",
    name: "\u0E0A\u0E32\u0E27\u0E1A\u0E38\u0E1B\u0E1C\u0E32",
    rarity: "epic",
    weight: 2.5,
    color: "#ffb0d0",
    desc: "\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E1A\u0E32\u0E19\u0E1A\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E1C\u0E21 \u0E17\u0E35\u0E48\u0E43\u0E14\u0E17\u0E35\u0E48\u0E40\u0E14\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E27\u0E19",
    lore: "\u0E0A\u0E32\u0E27\u0E1A\u0E38\u0E1B\u0E1C\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E41\u0E01\u0E48 \u0E40\u0E1E\u0E35\u0E22\u0E07\u0E41\u0E15\u0E48\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E1A\u0E19\u0E2B\u0E31\u0E27\u0E08\u0E30\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E35\u0E44\u0E1B\u0E15\u0E32\u0E21\u0E24\u0E14\u0E39",
    stats: { hpPct: 0.14, defPct: 0.04 },
    skill: {
      id: "k_blossom",
      name: "\u0E2A\u0E27\u0E19\u0E1A\u0E38\u0E1B\u0E1C\u0E32",
      icon: "blood",
      cooldown: 20,
      kit: [{ type: "field", r: 160, t: 6, power: 0.1, every: 0.6, slow: 0.7, heal: 0.03, color: "#ffb0d0" }],
      desc: "\u0E2A\u0E27\u0E19\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E22\u0E37\u0E19\u0E43\u0E19\u0E27\u0E07\u0E1F\u0E37\u0E49\u0E19 3%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E27\u0E07\u0E0A\u0E49\u0E32\u0E25\u0E07\u0E41\u0E25\u0E30\u0E42\u0E14\u0E19 \xD70.1"
    },
    ability: { name: "\u0E01\u0E25\u0E34\u0E48\u0E19\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.4%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E06\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1F\u0E37\u0E49\u0E19 1%", regen: 4e-3, healOnKill: 0.01 },
    look: { skin: "#f8e4dc", shade: "#e0c4bc", hair: "#5a8a4a", eye: "#c25a8a", trait: "blossom", tc: "#ffb0d0" }
  },
  // ---------------------------------------------------------------- legendary
  abyss: {
    id: "abyss",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E2B\u0E49\u0E27\u0E07\u0E25\u0E36\u0E01",
    rarity: "legendary",
    weight: 1,
    color: "#7a4aff",
    desc: "\u0E2D\u0E31\u0E01\u0E02\u0E23\u0E30\u0E2A\u0E35\u0E21\u0E48\u0E27\u0E07\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E17\u0E31\u0E48\u0E27\u0E23\u0E48\u0E32\u0E07 \u0E41\u0E25\u0E30\u0E2B\u0E19\u0E27\u0E14\u0E08\u0E32\u0E01\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E01\u0E49\u0E19",
    lore: "\u0E43\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E25\u0E36\u0E01\u0E44\u0E21\u0E48\u0E21\u0E35\u0E41\u0E2A\u0E07 \u0E41\u0E15\u0E48\u0E21\u0E35\u0E04\u0E19\u0E23\u0E2D\u0E04\u0E2D\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E40\u0E2A\u0E21\u0E2D",
    stats: { atkPct: 0.15, critMult: 0.3, crit: 0.06 },
    skill: {
      id: "k_abyss",
      name: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E2B\u0E49\u0E27\u0E07\u0E25\u0E36\u0E01",
      icon: "cosmos",
      cooldown: 20,
      kit: [{ type: "pull", r: 300, force: 700, power: 0.8 }, { type: "field", r: 130, t: 3, power: 0.5, every: 0.3, color: "#7a4aff" }],
      desc: "\u0E40\u0E1B\u0E34\u0E14\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E14\u0E39\u0E14\u0E17\u0E38\u0E01\u0E2A\u0E34\u0E48\u0E07\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32 \xD70.8 \u0E41\u0E25\u0E49\u0E27\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E01\u0E31\u0E14\u0E01\u0E34\u0E19 \xD70.5 \u0E17\u0E38\u0E01 0.3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E19\u0E32\u0E19 3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E01\u0E25\u0E37\u0E19\u0E01\u0E34\u0E19", desc: "\u0E42\u0E2D\u0E01\u0E32\u0E2A 15% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07 \xB7 \u0E06\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 2%", debuff: 0.15, healOnKill: 0.02 },
    look: { skin: "#cfc4dc", shade: "#aa9cbc", hair: "#1a1030", eye: "#b89aff", trait: "runes", trait2: "tentacles", tc: "#9f7fff" }
  },
  dragonkin: {
    id: "dragonkin",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E17\u0E49",
    rarity: "legendary",
    weight: 1,
    color: "#f5c35a",
    desc: "\u0E40\u0E02\u0E32\u0E21\u0E31\u0E07\u0E01\u0E23\u0E01\u0E27\u0E32\u0E14\u0E44\u0E1B\u0E14\u0E49\u0E32\u0E19\u0E2B\u0E25\u0E31\u0E07 \u0E40\u0E01\u0E25\u0E47\u0E14\u0E17\u0E2D\u0E07\u0E1A\u0E19\u0E41\u0E01\u0E49\u0E21 \u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E04\u0E37\u0E2D\u0E44\u0E1F\u0E02\u0E2D\u0E07\u0E1A\u0E23\u0E23\u0E1E\u0E1A\u0E38\u0E23\u0E38\u0E29",
    lore: "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E2A\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E21\u0E31\u0E07\u0E01\u0E23\u0E15\u0E31\u0E27\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22 \u2014 \u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32\u0E41\u0E04\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E08\u0E33\u0E44\u0E14\u0E49",
    stats: { atkPct: 0.14, hpPct: 0.1, critMult: 0.2 },
    skill: {
      id: "k_dragonkin",
      name: "\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E17\u0E49",
      icon: "dragon",
      cooldown: 16,
      kit: [{ type: "buff", t: 2, reduce: 0.25 }, { type: "cone", range: 260, arc: 80, ticks: 8, interval: 0.14, power: 0.55 }],
      desc: "\u0E1E\u0E48\u0E19\u0E44\u0E1F\u0E21\u0E31\u0E07\u0E01\u0E23\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E27\u0E22\u0E01\u0E27\u0E49\u0E32\u0E07 8 \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30 \xD70.55 \u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1E\u0E48\u0E19\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 \u221225%"
    },
    ability: { name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E21\u0E31\u0E07\u0E01\u0E23", desc: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E44\u0E1F \u221250% \xB7 \u0E15\u0E35\u0E2A\u0E27\u0E19\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 30%", fireReduce: 0.5, counterBonus: 0.3 },
    look: { skin: "#f0d4b0", shade: "#d0b08c", hair: "#6a1a10", eye: "#f5c35a", trait: "dragon", tc: "#f5c35a" }
  },
  celestial: {
    id: "celestial",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C",
    rarity: "legendary",
    weight: 1,
    color: "#ffe89a",
    desc: "\u0E2D\u0E31\u0E01\u0E02\u0E23\u0E30\u0E17\u0E2D\u0E07\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E1A\u0E19\u0E1C\u0E34\u0E27 \u0E27\u0E07\u0E23\u0E31\u0E28\u0E21\u0E35\u0E04\u0E39\u0E48\u0E25\u0E2D\u0E22\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E28\u0E35\u0E23\u0E29\u0E30",
    lore: "\u0E25\u0E32\u0E19\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E40\u0E04\u0E22\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E2A\u0E2D\u0E07\u0E04\u0E19 \u0E04\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E25\u0E07\u0E21\u0E32\u0E40\u0E14\u0E34\u0E19\u0E1A\u0E19\u0E14\u0E34\u0E19",
    stats: { hpPct: 0.12, defPct: 0.12, crit: 0.05, atkPct: 0.06 },
    skill: {
      id: "k_celestial",
      name: "\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C",
      icon: "crown",
      cooldown: 18,
      kit: [{ type: "heal", pct: 0.12 }, { type: "volley", count: 16, ring: true, power: 0.6, speed: 500, homing: 3, tint: ["255,232,154", "#ffffff"] }],
      desc: "\u0E14\u0E32\u0E1A\u0E41\u0E2A\u0E07 16 \u0E40\u0E25\u0E48\u0E21\u0E1E\u0E38\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E41\u0E25\u0E49\u0E27\u0E44\u0E25\u0E48\u0E15\u0E32\u0E21\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E40\u0E25\u0E48\u0E21\u0E25\u0E30 \xD70.6 \u0E41\u0E25\u0E30\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 12%"
    },
    ability: { name: "\u0E42\u0E25\u0E48\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C", desc: "\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E49\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49\u0E42\u0E25\u0E48 20% \xB7 \u0E40\u0E01\u0E08\u0E42\u0E25\u0E48\u0E25\u0E14\u0E0A\u0E49\u0E32\u0E25\u0E07 30%", shieldPct: 0.2, guardPower: 0.3 },
    look: { skin: "#f8eedc", shade: "#e0d0b4", hair: "#fff3c4", eye: "#e0b45a", trait: "runes", trait2: "halo", tc: "#ffe89a" }
  },
  voidwalker: {
    id: "voidwalker",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E44\u0E23\u0E49\u0E40\u0E07\u0E32",
    rarity: "legendary",
    weight: 1,
    color: "#5a5a7a",
    desc: "\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E32\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E1B\u0E34\u0E14\u0E14\u0E27\u0E07\u0E15\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E07\u0E32\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19 \u0E1B\u0E23\u0E32\u0E01\u0E0F\u0E2B\u0E25\u0E31\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E25\u0E30\u0E15\u0E31\u0E27",
    lore: "\u0E04\u0E19\u0E44\u0E23\u0E49\u0E40\u0E07\u0E32\u0E40\u0E14\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E41\u0E2A\u0E07\u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07\u0E44\u0E14\u0E49\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E2B\u0E31\u0E19\u0E21\u0E32\u0E21\u0E2D\u0E07",
    stats: { crit: 0.12, spd: 0.08, atkPct: 0.08 },
    skill: {
      id: "k_voidwalker",
      name: "\u0E01\u0E49\u0E32\u0E27\u0E44\u0E23\u0E49\u0E40\u0E07\u0E32",
      icon: "lunge",
      cooldown: 14,
      kit: [{ type: "blink", reach: 420, power: 1.6, count: 3 }],
      desc: "\u0E27\u0E32\u0E23\u0E4C\u0E1B\u0E44\u0E1B\u0E1F\u0E31\u0E19\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39 3 \u0E15\u0E31\u0E27\u0E15\u0E34\u0E14\u0E01\u0E31\u0E19 \u0E15\u0E31\u0E27\u0E25\u0E30 \xD71.6 \u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19"
    },
    ability: { name: "\u0E44\u0E23\u0E49\u0E23\u0E48\u0E2D\u0E07\u0E23\u0E2D\u0E22", desc: "\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19\u0E21\u0E32\u0E01 \xB7 \u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 20%", perfectBonus: 0.08, dodgeCd: 0.2 },
    look: { skin: "#d8d4dc", shade: "#b4b0bc", hair: "#14121c", eye: "#e0e0ff", trait: "mask", tc: "#2a2838" }
  },
  titan: {
    id: "titan",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E44\u0E17\u0E17\u0E31\u0E19",
    rarity: "legendary",
    weight: 1,
    color: "#c84a3a",
    desc: "\u0E23\u0E48\u0E32\u0E07\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E17\u0E48\u0E32\u0E1B\u0E23\u0E30\u0E15\u0E39 \u0E2D\u0E31\u0E01\u0E02\u0E23\u0E30\u0E41\u0E14\u0E07\u0E1A\u0E19\u0E40\u0E02\u0E32 \u0E17\u0E38\u0E01\u0E01\u0E49\u0E32\u0E27\u0E2A\u0E30\u0E40\u0E17\u0E37\u0E2D\u0E19\u0E41\u0E1C\u0E48\u0E19\u0E14\u0E34\u0E19",
    lore: "\u0E44\u0E17\u0E17\u0E31\u0E19\u0E04\u0E19\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E2B\u0E25\u0E31\u0E1A\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E15\u0E49\u0E20\u0E39\u0E40\u0E02\u0E32 \u0E2A\u0E48\u0E27\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E04\u0E37\u0E2D\u0E25\u0E39\u0E01\u0E2B\u0E25\u0E32\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E15\u0E37\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48",
    stats: { hpPct: 0.25, defPct: 0.2, atkPct: 0.06, spd: -0.06 },
    skill: {
      id: "k_titan",
      name: "\u0E1B\u0E10\u0E1E\u0E35\u0E2A\u0E30\u0E40\u0E17\u0E37\u0E2D\u0E19\u0E2A\u0E32\u0E21\u0E0A\u0E31\u0E49\u0E19",
      icon: "hammer",
      cooldown: 18,
      kit: [{ type: "blast", r: 140, power: 1.5, stun: 0.8, kb: 300 }, { type: "blast", delay: 0.4, r: 230, power: 1.2, kb: 300 }, { type: "blast", delay: 0.8, r: 320, power: 0.9, kb: 300 }],
      desc: "\u0E41\u0E1C\u0E48\u0E19\u0E14\u0E34\u0E19\u0E44\u0E2B\u0E27 3 \u0E23\u0E30\u0E25\u0E2D\u0E01\u0E02\u0E22\u0E32\u0E22\u0E2D\u0E2D\u0E01 \xD71.5, \xD71.2 \u0E41\u0E25\u0E30 \xD70.9 \u0E23\u0E30\u0E25\u0E2D\u0E01\u0E41\u0E23\u0E01\u0E2A\u0E15\u0E31\u0E19"
    },
    ability: { name: "\u0E01\u0E32\u0E22\u0E20\u0E39\u0E1C\u0E32", desc: "\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 30% \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +60% \xB7 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01 \u221250%", lowHpDef: 0.6, trapReduce: 0.5 },
    look: { skin: "#c8b4a0", shade: "#a49080", hair: "#3a2a20", eye: "#ff5a3a", trait: "horns", trait2: "runes", tc: "#ff5a3a" }
  },
  phoenix: {
    id: "phoenix",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E19\u0E01\u0E40\u0E1E\u0E25\u0E34\u0E07",
    rarity: "legendary",
    weight: 1,
    color: "#ff8a3d",
    desc: "\u0E1C\u0E21\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E02\u0E19\u0E19\u0E01\u0E40\u0E1E\u0E25\u0E34\u0E07 \u0E1E\u0E38\u0E48\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E34\u0E49\u0E07\u0E17\u0E32\u0E07\u0E44\u0E1F\u0E44\u0E27\u0E49\u0E40\u0E1A\u0E37\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E07",
    lore: "\u0E19\u0E01\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E15\u0E32\u0E22 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E40\u0E1C\u0E32\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E16\u0E49\u0E32\u0E41\u0E25\u0E49\u0E27\u0E23\u0E2D\u0E43\u0E2B\u0E49\u0E21\u0E35\u0E04\u0E19\u0E40\u0E23\u0E35\u0E22\u0E01\u0E0A\u0E37\u0E48\u0E2D",
    stats: { atkPct: 0.12, hpPct: 0.08, critMult: 0.2 },
    skill: {
      id: "k_phoenix",
      name: "\u0E1B\u0E35\u0E01\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E1E\u0E34\u0E42\u0E23\u0E18",
      icon: "wings",
      cooldown: 15,
      kit: [{ type: "dash", dist: 240, width: 80, power: 1.6, burn: true }, { type: "field", r: 110, t: 4, power: 0.35, every: 0.4, burn: true, color: "#ff8a3d" }],
      desc: "\u0E1E\u0E38\u0E48\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39 \xD71.6 \u0E15\u0E34\u0E14\u0E44\u0E1F \u0E41\u0E25\u0E49\u0E27\u0E17\u0E34\u0E49\u0E07\u0E17\u0E30\u0E40\u0E25\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E15\u0E23\u0E07\u0E08\u0E38\u0E14\u0E2B\u0E22\u0E38\u0E14 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
    },
    ability: { name: "\u0E44\u0E1F\u0E44\u0E21\u0E48\u0E21\u0E2D\u0E14", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.3%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E42\u0E2D\u0E01\u0E32\u0E2A 15% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E15\u0E34\u0E14\u0E44\u0E1F", regen: 3e-3, ignite: 0.15 },
    look: { skin: "#f4d4b0", shade: "#d8b08c", hair: "#ff8a3d", eye: "#ffcf5a", trait: "flame", trait2: "feathers", tc: "#ffb35a" }
  }
});

// src/data/races.js
var BASE_RACES = {
  hunter: {
    id: "hunter",
    name: "\u0E0A\u0E32\u0E27\u0E1E\u0E23\u0E32\u0E19",
    rarity: "common",
    weight: 32,
    color: "#d9a84e",
    desc: "\u0E25\u0E39\u0E01\u0E2B\u0E25\u0E32\u0E19\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19 \u0E44\u0E21\u0E48\u0E42\u0E14\u0E14\u0E40\u0E14\u0E48\u0E19\u0E14\u0E49\u0E32\u0E19\u0E43\u0E14 \u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E08\u0E38\u0E14\u0E2D\u0E48\u0E2D\u0E19",
    lore: "\u0E01\u0E48\u0E2D\u0E19\u0E1B\u0E48\u0E32\u0E08\u0E30\u0E16\u0E39\u0E01\u0E40\u0E23\u0E35\u0E22\u0E01\u0E27\u0E48\u0E32\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21 \u0E0A\u0E32\u0E27\u0E1E\u0E23\u0E32\u0E19\u0E40\u0E14\u0E34\u0E19\u0E15\u0E32\u0E21\u0E23\u0E2D\u0E22\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E44\u0E14\u0E49\u0E41\u0E21\u0E49\u0E43\u0E19\u0E04\u0E37\u0E19\u0E44\u0E23\u0E49\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
    stats: { hpPct: 0.08, atkPct: 0.05 },
    skill: {
      id: "focus",
      name: "\u0E2A\u0E21\u0E32\u0E18\u0E34\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32",
      icon: "eye",
      cooldown: 18,
      duration: 5,
      haste: 0.3,
      crit: 0.25,
      desc: "5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E17\u0E48\u0E32\u0E42\u0E08\u0E21\u0E15\u0E35\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 30% \u0E41\u0E25\u0E30\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +25%"
    },
    ability: { name: "\u0E15\u0E32\u0E19\u0E31\u0E01\u0E40\u0E01\u0E47\u0E1A", desc: "\u0E17\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E28\u0E31\u0E15\u0E23\u0E39\u0E41\u0E25\u0E30\u0E2B\u0E35\u0E1A +20%", goldMult: 0.2 },
    look: { skin: "#f0d2ac", shade: "#d9a982", hair: "#3b2a24", eye: "#1a120e", trait: "none" }
  },
  moon: {
    id: "moon",
    name: "\u0E40\u0E07\u0E32\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C",
    rarity: "uncommon",
    weight: 22,
    color: "#9fb8ff",
    desc: "\u0E40\u0E1C\u0E48\u0E32\u0E2B\u0E39\u0E41\u0E2B\u0E25\u0E21\u0E1C\u0E39\u0E49\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E44\u0E23\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E07 \u0E40\u0E01\u0E48\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2B\u0E25\u0E1A\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E08\u0E32\u0E01\u0E40\u0E07\u0E32",
    lore: "\u0E04\u0E19\u0E40\u0E07\u0E32\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E48\u0E32\u0E40\u0E07\u0E32\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E04\u0E37\u0E2D\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E40\u0E01\u0E34\u0E14\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08",
    stats: { spd: 0.08, crit: 0.06 },
    skill: {
      id: "shadow_step",
      name: "\u0E01\u0E49\u0E32\u0E27\u0E40\u0E07\u0E32",
      icon: "lunge",
      cooldown: 10,
      power: 2.2,
      reach: 380,
      desc: "\u0E27\u0E32\u0E23\u0E4C\u0E1B\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E41\u0E25\u0E49\u0E27\u0E1F\u0E31\u0E19\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19 \xD72.2 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2D\u0E21\u0E15\u0E30\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E39\u0E48"
    },
    ability: { name: "\u0E1D\u0E35\u0E40\u0E17\u0E49\u0E32\u0E41\u0E21\u0E27", desc: "\u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 25% \u0E41\u0E25\u0E30\u0E0A\u0E48\u0E27\u0E07\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19", dodgeCd: 0.25, perfectBonus: 0.06 },
    look: { skin: "#eadfd4", shade: "#c9b8b0", hair: "#cfd6e6", eye: "#4a7fd8", trait: "ears" }
  },
  stone: {
    id: "stone",
    name: "\u0E28\u0E34\u0E25\u0E32\u0E40\u0E02\u0E32",
    rarity: "uncommon",
    weight: 18,
    color: "#b8a48a",
    desc: "\u0E23\u0E48\u0E32\u0E07\u0E43\u0E2B\u0E0D\u0E48 \u0E21\u0E35\u0E40\u0E02\u0E32\u0E2B\u0E34\u0E19\u0E07\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E1C\u0E32\u0E01 \u0E17\u0E19\u0E17\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E43\u0E19\u0E1A\u0E23\u0E23\u0E14\u0E32\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14",
    lore: "\u0E04\u0E19\u0E28\u0E34\u0E25\u0E32\u0E40\u0E02\u0E32\u0E40\u0E04\u0E22\u0E02\u0E38\u0E14\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E16\u0E48\u0E32\u0E19\u0E14\u0E49\u0E27\u0E22\u0E21\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E48\u0E32 \u0E01\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E43\u0E04\u0E23\u0E08\u0E30\u0E04\u0E34\u0E14\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21",
    stats: { hpPct: 0.15, defPct: 0.2, spd: -0.04 },
    skill: {
      id: "stone_skin",
      name: "\u0E1C\u0E34\u0E27\u0E28\u0E34\u0E25\u0E32",
      icon: "hide",
      cooldown: 20,
      duration: 5,
      reduce: 0.6,
      desc: "5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E23\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E25\u0E14\u0E25\u0E07 60% \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E42\u0E14\u0E19\u0E42\u0E08\u0E21\u0E15\u0E35"
    },
    ability: { name: "\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E41\u0E01\u0E23\u0E48\u0E07", desc: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01 \u221235% \xB7 \u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 30% \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +50%", trapReduce: 0.35, lowHpDef: 0.5 },
    look: { skin: "#cdb9a0", shade: "#a8937c", hair: "#5a4a40", eye: "#e0b45a", trait: "horns" }
  },
  sylvan: {
    id: "sylvan",
    name: "\u0E1E\u0E07\u0E44\u0E1E\u0E23",
    rarity: "rare",
    weight: 14,
    color: "#8fd06a",
    desc: "\u0E21\u0E35\u0E43\u0E1A\u0E44\u0E21\u0E49\u0E07\u0E2D\u0E01\u0E41\u0E17\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E1C\u0E21 \u0E23\u0E48\u0E32\u0E07\u0E01\u0E32\u0E22\u0E1F\u0E37\u0E49\u0E19\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E44\u0E14\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E15\u0E49\u0E19\u0E44\u0E21\u0E49",
    lore: "\u0E1E\u0E07\u0E44\u0E1E\u0E23\u0E2B\u0E25\u0E31\u0E1A\u0E22\u0E32\u0E27\u0E43\u0E19\u0E24\u0E14\u0E39\u0E41\u0E25\u0E49\u0E07 \u0E41\u0E25\u0E30\u0E15\u0E37\u0E48\u0E19\u0E02\u0E36\u0E49\u0E19\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E1D\u0E19\u0E41\u0E23\u0E01\u0E40\u0E2A\u0E21\u0E2D",
    stats: { hpPct: 0.1, spd: 0.04 },
    skill: {
      id: "bloom",
      name: "\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E0A\u0E38\u0E1A\u0E0A\u0E35\u0E27\u0E34\u0E15",
      icon: "blood",
      cooldown: 22,
      duration: 4,
      heal: 0.3,
      radius: 170,
      slow: 0.5,
      desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 30% \u0E20\u0E32\u0E22\u0E43\u0E19 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E30\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E0A\u0E49\u0E32\u0E25\u0E07 50%"
    },
    ability: { name: "\u0E23\u0E32\u0E01\u0E0A\u0E35\u0E27\u0E34\u0E15", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 0.5% \u0E15\u0E48\u0E2D\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32", regen: 5e-3 },
    look: { skin: "#e8ddb6", shade: "#c6b88c", hair: "#5d8a3e", eye: "#2f6a2a", trait: "leaves" }
  },
  scale: {
    id: "scale",
    name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E16\u0E48\u0E32\u0E19",
    rarity: "rare",
    weight: 10,
    color: "#ff8a3d",
    desc: "\u0E21\u0E35\u0E40\u0E01\u0E25\u0E47\u0E14\u0E2A\u0E35\u0E16\u0E48\u0E32\u0E19\u0E41\u0E14\u0E07\u0E1A\u0E19\u0E41\u0E01\u0E49\u0E21\u0E41\u0E25\u0E30\u0E41\u0E02\u0E19 \u0E1E\u0E48\u0E19\u0E44\u0E1F\u0E44\u0E14\u0E49\u0E41\u0E25\u0E30\u0E17\u0E19\u0E04\u0E27\u0E32\u0E21\u0E23\u0E49\u0E2D\u0E19",
    lore: "\u0E1A\u0E32\u0E07\u0E04\u0E19\u0E27\u0E48\u0E32\u0E40\u0E01\u0E25\u0E47\u0E14\u0E16\u0E48\u0E32\u0E19\u0E04\u0E37\u0E2D\u0E25\u0E39\u0E01\u0E2B\u0E25\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E07\u0E01\u0E23\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E1A\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E15\u0E49\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07 \u0E1A\u0E32\u0E07\u0E04\u0E19\u0E27\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E04\u0E48\u0E19\u0E34\u0E17\u0E32\u0E19",
    stats: { atkPct: 0.1, critMult: 0.2 },
    skill: {
      id: "ember_breath",
      name: "\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E16\u0E48\u0E32\u0E19",
      icon: "whirl",
      cooldown: 12,
      range: 190,
      arc: 70,
      ticks: 6,
      interval: 0.16,
      power: 0.45,
      desc: "\u0E1E\u0E48\u0E19\u0E44\u0E1F\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E39\u0E1B\u0E01\u0E23\u0E27\u0E22\u0E14\u0E49\u0E32\u0E19\u0E2B\u0E19\u0E49\u0E32 6 \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30 \xD70.45 \u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E44\u0E1F"
    },
    ability: { name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E17\u0E19\u0E44\u0E1F", desc: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E44\u0E1F (\u0E25\u0E39\u0E01\u0E44\u0E1F \u0E0A\u0E48\u0E2D\u0E07\u0E44\u0E1F) \u221230% \xB7 \u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A 15% \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E15\u0E34\u0E14\u0E44\u0E1F", fireReduce: 0.3, ignite: 0.15 },
    look: { skin: "#ecc9a2", shade: "#cfa07a", hair: "#8e2c21", eye: "#ff8a3d", trait: "scales" }
  },
  ash: {
    id: "ash",
    name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E40\u0E16\u0E49\u0E32",
    rarity: "legendary",
    weight: 4,
    color: "#ffd08a",
    desc: "\u0E25\u0E32\u0E22\u0E40\u0E16\u0E49\u0E32\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E17\u0E31\u0E48\u0E27\u0E23\u0E48\u0E32\u0E07 \u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21",
    lore: '\u0E43\u0E19\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27\u0E21\u0E35\u0E04\u0E33\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E02\u0E35\u0E14\u0E06\u0E48\u0E32\u0E0B\u0E49\u0E33\u0E2B\u0E25\u0E32\u0E22\u0E23\u0E2D\u0E1A \u2014 "\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E21\u0E2D\u0E14"',
    stats: { atkPct: 0.12, hpPct: 0.05, crit: 0.08, critMult: 0.3 },
    skill: {
      id: "ash_night",
      name: "\u0E23\u0E32\u0E15\u0E23\u0E35\u0E40\u0E16\u0E49\u0E32",
      icon: "ward",
      cooldown: 24,
      duration: 6,
      dmg: 0.25,
      power: 1.6,
      radius: 170,
      desc: "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E16\u0E49\u0E32\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \xD71.6 \u0E41\u0E25\u0E49\u0E27 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22 +25% \u0E41\u0E25\u0E30\u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E15\u0E34\u0E14\u0E44\u0E1F"
    },
    ability: { name: "\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E21\u0E2D\u0E14", desc: "\u0E04\u0E23\u0E31\u0E49\u0E07\u0E41\u0E23\u0E01\u0E43\u0E19\u0E41\u0E15\u0E48\u0E25\u0E30\u0E14\u0E31\u0E19\u0E40\u0E08\u0E35\u0E49\u0E22\u0E19\u0E17\u0E35\u0E48\u0E08\u0E30\u0E25\u0E49\u0E21 \u0E08\u0E30\u0E23\u0E2D\u0E14\u0E14\u0E49\u0E27\u0E22\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 1 \u0E41\u0E25\u0E30\u0E2D\u0E21\u0E15\u0E30 1.5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35", lastStand: true },
    look: { skin: "#dcbca4", shade: "#b8957c", hair: "#1c1412", eye: "#ffd08a", trait: "marks" }
  }
};
var RACES = Object.freeze({ ...BASE_RACES, ...RACES_V7 });
var RACE_IDS = Object.freeze(Object.keys(RACES));
function getRace(id) {
  return Object.prototype.hasOwnProperty.call(RACES, id) ? RACES[id] : null;
}

// src/data/pets2.js
var pct = (v) => Math.round(v * 100);
var PETS_V7 = Object.freeze({
  // ---------------------------------------------------------------- common
  ember_pup: {
    id: "ember_pup",
    name: "\u0E25\u0E39\u0E01\u0E2B\u0E21\u0E32\u0E16\u0E48\u0E32\u0E19",
    rarity: "common",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35",
    sprite: "pet_ember_pup",
    desc: "\u0E25\u0E39\u0E01\u0E2B\u0E21\u0E32\u0E15\u0E31\u0E27\u0E2D\u0E38\u0E48\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E48\u0E32\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E30\u0E40\u0E01\u0E47\u0E14\u0E44\u0E1F",
    art: { plan: "quad", c1: "#c4492e", c2: "#f3d0a0", c3: "#ffb35a", ears: "droop", tail: "flame", pat: "spots", build: "stocky" },
    ability: { kind: "spit", name: "\u0E40\u0E2B\u0E48\u0E32\u0E2A\u0E30\u0E40\u0E01\u0E47\u0E14\u0E44\u0E1F", every: 2.2, power: 0.34, count: 2, spread: 18, burn: true },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1E\u0E48\u0E19\u0E2A\u0E30\u0E40\u0E01\u0E47\u0E14\u0E44\u0E1F ${v.count} \u0E25\u0E39\u0E01 \xD7${v.power.toFixed(2)} \u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E44\u0E1F`
  },
  pebble_crab: {
    id: "pebble_crab",
    name: "\u0E1B\u0E39\u0E01\u0E23\u0E27\u0E14",
    rarity: "common",
    role: "\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19",
    sprite: "pet_pebble_crab",
    desc: "\u0E41\u0E1A\u0E01\u0E01\u0E23\u0E27\u0E14\u0E44\u0E27\u0E49\u0E1A\u0E19\u0E2B\u0E25\u0E31\u0E07 \u0E41\u0E25\u0E49\u0E27\u0E42\u0E22\u0E19\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E43\u0E0A\u0E49\u0E1A\u0E31\u0E07\u0E2B\u0E21\u0E31\u0E14",
    art: { plan: "crab", c1: "#c8784a", c2: "#a8a094", c3: "#e8d8b0", shell: "pebble", pat: "none" },
    ability: { kind: "ward", name: "\u0E01\u0E23\u0E27\u0E14\u0E01\u0E33\u0E1A\u0E31\u0E07", every: 14, charges: 1 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E43\u0E2B\u0E49\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E32\u0E07\u0E01\u0E23\u0E27\u0E14: \u0E01\u0E31\u0E19\u0E01\u0E32\u0E23\u0E42\u0E14\u0E19\u0E15\u0E35\u0E04\u0E23\u0E31\u0E49\u0E07\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E44\u0E14\u0E49 ${v.charges} \u0E04\u0E23\u0E31\u0E49\u0E07`
  },
  dew_slime: {
    id: "dew_slime",
    name: "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E19\u0E49\u0E33\u0E04\u0E49\u0E32\u0E07",
    rarity: "common",
    role: "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21",
    sprite: "pet_dew_slime",
    desc: "\u0E2B\u0E22\u0E14\u0E40\u0E21\u0E37\u0E2D\u0E01\u0E40\u0E2B\u0E19\u0E35\u0E22\u0E27\u0E44\u0E27\u0E49\u0E15\u0E32\u0E21\u0E17\u0E32\u0E07 \u0E43\u0E04\u0E23\u0E40\u0E2B\u0E22\u0E35\u0E22\u0E1A\u0E08\u0E30\u0E15\u0E34\u0E14\u0E2B\u0E19\u0E36\u0E1A",
    art: { plan: "blob", c1: "#7fd0c0", c2: "#bff0e8", c3: "#e8fff8", drip: true, leaf: true, clear: true },
    ability: { kind: "mine", name: "\u0E40\u0E21\u0E37\u0E2D\u0E01\u0E40\u0E2B\u0E19\u0E35\u0E22\u0E27", every: 4, power: 0.42, r: 70, slow: 0.5 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1B\u0E32\u0E40\u0E21\u0E37\u0E2D\u0E01\u0E43\u0E15\u0E49\u0E40\u0E17\u0E49\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39: \u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14 \xD7${v.power.toFixed(2)} \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E02\u0E49\u0E32\u0E43\u0E01\u0E25\u0E49 \u0E41\u0E25\u0E30\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E0A\u0E49\u0E32\u0E25\u0E07`
  },
  mud_frog: {
    id: "mud_frog",
    name: "\u0E01\u0E1A\u0E42\u0E04\u0E25\u0E19",
    rarity: "common",
    role: "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21",
    sprite: "pet_mud_frog",
    desc: "\u0E25\u0E34\u0E49\u0E19\u0E22\u0E32\u0E27\u0E40\u0E2B\u0E19\u0E35\u0E22\u0E27\u0E2B\u0E19\u0E36\u0E1A \u0E15\u0E27\u0E31\u0E14\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27\u0E25\u0E32\u0E01\u0E28\u0E31\u0E15\u0E23\u0E39\u0E21\u0E32\u0E01\u0E2D\u0E07\u0E23\u0E27\u0E21\u0E01\u0E31\u0E19",
    art: { plan: "hopper", form: "frog", c1: "#7a8a4a", c2: "#d8d0a0", c3: "#5d8a3e", pat: "spots", leaf: true },
    ability: { kind: "vortex", name: "\u0E25\u0E34\u0E49\u0E19\u0E15\u0E27\u0E31\u0E14", every: 7, r: 170, pull: 300, power: 0.2 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E14\u0E36\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E23\u0E2D\u0E1A\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E21\u0E32\u0E23\u0E27\u0E21\u0E01\u0E31\u0E19 \xD7${v.power.toFixed(2)}`
  },
  spark_beetle: {
    id: "spark_beetle",
    name: "\u0E14\u0E49\u0E27\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22",
    rarity: "common",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35",
    sprite: "pet_spark_beetle",
    flying: true,
    desc: "\u0E1B\u0E35\u0E01\u0E41\u0E02\u0E47\u0E07\u0E2A\u0E30\u0E2A\u0E21\u0E44\u0E1F\u0E1F\u0E49\u0E32\u0E2A\u0E16\u0E34\u0E15 \u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E2D\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E40\u0E25\u0E47\u0E01\u0E46",
    art: { plan: "insect", form: "beetle", c1: "#3a5aa8", c2: "#9fb8ff", c3: "#fff07a", pat: "stripes" },
    ability: { kind: "chain", name: "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E41\u0E15\u0E01\u0E01\u0E34\u0E48\u0E07", every: 2.4, power: 0.38, jumps: 2, range: 300 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32 \xD7${v.power.toFixed(2)} \u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E15\u0E48\u0E2D\u0E2D\u0E35\u0E01 ${v.jumps} \u0E15\u0E31\u0E27`
  },
  leaf_hare: {
    id: "leaf_hare",
    name: "\u0E01\u0E23\u0E30\u0E15\u0E48\u0E32\u0E22\u0E43\u0E1A\u0E44\u0E21\u0E49",
    rarity: "common",
    role: "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27",
    sprite: "pet_leaf_hare",
    desc: "\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E19\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E2A\u0E21\u0E2D \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E40\u0E17\u0E49\u0E32\u0E44\u0E27\u0E15\u0E32\u0E21\u0E44\u0E1B\u0E14\u0E49\u0E27\u0E22",
    art: { plan: "hopper", form: "rabbit", c1: "#d8c8a0", c2: "#fff6e0", c3: "#6aa25a", leaf: true },
    ability: { kind: "passive", name: "\u0E40\u0E17\u0E49\u0E32\u0E44\u0E27", dodgeCd: 0.12, spd: 0.05 },
    text: (v) => `\u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E1F\u0E37\u0E49\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 ${pct(v.dodgeCd)}% \xB7 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27 +${pct(v.spd)}%`
  },
  coin_magpie: {
    id: "coin_magpie",
    name: "\u0E19\u0E01\u0E01\u0E32\u0E07\u0E40\u0E02\u0E19\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D",
    rarity: "common",
    role: "\u0E17\u0E2D\u0E07 + \u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25",
    sprite: "pet_coin_magpie",
    flying: true,
    desc: "\u0E0A\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E41\u0E27\u0E27\u0E27\u0E32\u0E27 \u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E38\u0E14\u0E2D\u0E48\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E1E\u0E2D\u0E46 \u0E01\u0E31\u0E1A\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D\u0E17\u0E35\u0E48\u0E15\u0E01\u0E1E\u0E37\u0E49\u0E19",
    art: { plan: "bird", c1: "#2a2e3a", c2: "#f4f6ff", c3: "#f5c35a", beak: "normal", tailF: "long", wing: "feather" },
    ability: { kind: "passive", name: "\u0E15\u0E32\u0E41\u0E2B\u0E25\u0E21", goldMult: 0.12, critPct: 0.025 },
    text: (v) => `\u0E17\u0E2D\u0E07 +${pct(v.goldMult)}% \xB7 \u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +${(v.critPct * 100).toFixed(1)}%`
  },
  ash_moth: {
    id: "ash_moth",
    name: "\u0E1C\u0E35\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E01\u0E25\u0E32\u0E07\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32",
    rarity: "common",
    role: "\u0E1A\u0E31\u0E1E\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25",
    sprite: "pet_ash_moth",
    flying: true,
    desc: "\u0E1C\u0E07\u0E40\u0E16\u0E49\u0E32\u0E08\u0E32\u0E01\u0E1B\u0E35\u0E01\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E28\u0E31\u0E15\u0E23\u0E39\u0E21\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E04\u0E21\u0E14\u0E32\u0E1A",
    art: { plan: "insect", form: "moth", c1: "#6a5a50", c2: "#c8bca8", c3: "#ff8a3d" },
    ability: { kind: "crit", name: "\u0E1C\u0E07\u0E40\u0E16\u0E49\u0E32\u0E1E\u0E23\u0E32\u0E07", every: 9, crit: 0.12, duration: 4 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +${pct(v.crit)}% \u0E19\u0E32\u0E19 ${v.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  // ---------------------------------------------------------------- rare
  frost_kit: {
    id: "frost_kit",
    name: "\u0E25\u0E39\u0E01\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01\u0E2B\u0E34\u0E21\u0E30",
    rarity: "rare",
    role: "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21",
    sprite: "pet_frost_kit",
    desc: "\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E30\u0E2D\u0E2D\u0E07\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07 \u0E17\u0E38\u0E01\u0E2A\u0E34\u0E48\u0E07\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E21\u0E31\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E07\u0E0A\u0E49\u0E32\u0E25\u0E07",
    art: { plan: "quad", c1: "#e8f4ff", c2: "#ffffff", c3: "#8fd0f0", ears: "pointy", tail: "bushy", pat: "none", eye: "#3a7ab8" },
    ability: { kind: "nova", name: "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E2B\u0E34\u0E21\u0E30", every: 5, power: 0.34, r: 140, slow: 0.55, slowT: 2 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E02\u0E49\u0E32\u0E1B\u0E23\u0E30\u0E0A\u0E34\u0E14 \u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E21\u0E32\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E2B\u0E34\u0E21\u0E30\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E40\u0E23\u0E32 \xD7${v.power.toFixed(2)} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E0A\u0E49\u0E32\u0E25\u0E07 ${v.slowT} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  thunder_ram: {
    id: "thunder_ram",
    name: "\u0E41\u0E01\u0E30\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32",
    rarity: "rare",
    role: "\u0E2A\u0E15\u0E31\u0E19",
    sprite: "pet_thunder_ram",
    desc: "\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E02\u0E32\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E25\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E08\u0E30\u0E21\u0E35\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32\u0E15\u0E32\u0E21\u0E21\u0E32",
    art: { plan: "quad", c1: "#e8e2d0", c2: "#ffffff", c3: "#ffd83a", ears: "droop", horns: "curl", tail: "thin", pat: "none", build: "stocky", wool: true },
    ability: { kind: "stomp", name: "\u0E01\u0E23\u0E30\u0E17\u0E38\u0E49\u0E07\u0E1F\u0E49\u0E32", every: 5, power: 0.62, r: 100, stun: 0.6 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E17\u0E38\u0E1A\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22 \xD7${v.power.toFixed(2)} \u0E2A\u0E15\u0E31\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${v.stun} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  blood_bat: {
    id: "blood_bat",
    name: "\u0E04\u0E49\u0E32\u0E07\u0E04\u0E32\u0E27\u0E42\u0E25\u0E2B\u0E34\u0E15",
    rarity: "rare",
    role: "\u0E14\u0E39\u0E14\u0E1E\u0E25\u0E31\u0E07",
    sprite: "pet_blood_bat",
    flying: true,
    desc: "\u0E01\u0E31\u0E14\u0E40\u0E1A\u0E32\u0E46 \u0E41\u0E15\u0E48\u0E17\u0E38\u0E01\u0E2B\u0E22\u0E14\u0E17\u0E35\u0E48\u0E14\u0E39\u0E14\u0E21\u0E32\u0E08\u0E30\u0E04\u0E37\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22",
    art: { plan: "bird", c1: "#4a2a3a", c2: "#8a4a5a", c3: "#e0503a", wing: "bat", beak: "fang", crest: "ears", eye: "#ff5a5a" },
    ability: { kind: "leech", name: "\u0E14\u0E39\u0E14\u0E42\u0E25\u0E2B\u0E34\u0E15", every: 2.5, power: 0.42, healPct: 0.01, range: 320 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E14\u0E39\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14 \xD7${v.power.toFixed(2)} \u0E41\u0E25\u0E30\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 ${(v.healPct * 100).toFixed(1)}%`
  },
  coral_fish: {
    id: "coral_fish",
    name: "\u0E1B\u0E25\u0E32\u0E1B\u0E30\u0E01\u0E32\u0E23\u0E31\u0E07\u0E25\u0E2D\u0E22\u0E1F\u0E49\u0E32",
    rarity: "rare",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35",
    sprite: "pet_coral_fish",
    flying: true,
    desc: "\u0E27\u0E48\u0E32\u0E22\u0E43\u0E19\u0E2D\u0E32\u0E01\u0E32\u0E28\u0E44\u0E14\u0E49 \u0E41\u0E25\u0E30\u0E1E\u0E48\u0E19\u0E25\u0E33\u0E19\u0E49\u0E33\u0E41\u0E23\u0E07\u0E1E\u0E2D\u0E08\u0E30\u0E40\u0E08\u0E32\u0E30\u0E2B\u0E34\u0E19",
    art: { plan: "fish", c1: "#ff9a7a", c2: "#ffe0d0", c3: "#ff5a8a", pat: "coral" },
    ability: { kind: "beam", name: "\u0E25\u0E33\u0E19\u0E49\u0E33\u0E17\u0E30\u0E25\u0E27\u0E07", every: 3.5, power: 0.78, len: 380, width: 34 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1E\u0E48\u0E19\u0E25\u0E33\u0E19\u0E49\u0E33\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E15\u0E23\u0E07 \xD7${v.power.toFixed(2)} \u0E17\u0E30\u0E25\u0E38\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27`
  },
  iron_beetle: {
    id: "iron_beetle",
    name: "\u0E14\u0E49\u0E27\u0E07\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E2B\u0E25\u0E47\u0E01",
    rarity: "rare",
    role: "\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 + \u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19",
    sprite: "pet_iron_beetle",
    desc: "\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E01\u0E41\u0E02\u0E47\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E42\u0E25\u0E48 \u0E43\u0E04\u0E23\u0E15\u0E35\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E08\u0E30\u0E42\u0E14\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A",
    art: { plan: "insect", form: "beetle", c1: "#7a8090", c2: "#c8ccd4", c3: "#e0b45a", horn: "rhino", pat: "ribs" },
    ability: { kind: "passive", name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E2B\u0E19\u0E32\u0E21", defPct: 0.08, thorns: 0.4 },
    text: (v) => `\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +${pct(v.defPct)}% \xB7 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E15\u0E35\u0E40\u0E23\u0E32\u0E43\u0E19\u0E23\u0E30\u0E22\u0E30\u0E1B\u0E23\u0E30\u0E0A\u0E34\u0E14\u0E42\u0E14\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19 \xD7${v.thorns.toFixed(2)}`
  },
  jade_snake: {
    id: "jade_snake",
    name: "\u0E07\u0E39\u0E2B\u0E22\u0E01",
    rarity: "rare",
    role: "\u0E1E\u0E34\u0E29",
    sprite: "pet_jade_snake",
    desc: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E21\u0E35\u0E1E\u0E34\u0E29\u0E40\u0E22\u0E47\u0E19\u0E40\u0E22\u0E35\u0E22\u0E1A \u0E40\u0E2B\u0E22\u0E37\u0E48\u0E2D\u0E08\u0E30\u0E2D\u0E48\u0E2D\u0E19\u0E41\u0E23\u0E07\u0E25\u0E07\u0E17\u0E35\u0E25\u0E30\u0E19\u0E49\u0E2D\u0E22",
    art: { plan: "serpent", c1: "#4a9a6a", c2: "#c8f0d0", c3: "#e8ff9a", pat: "diamonds", eye: "#e8ff9a" },
    ability: { kind: "venom", name: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2B\u0E22\u0E01", every: 1.8, power: 0.34, range: 300 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E09\u0E01\u0E14\u0E49\u0E27\u0E22\u0E1E\u0E34\u0E29 \xD7${v.power.toFixed(2)} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E15\u0E34\u0E14\u0E1E\u0E34\u0E29\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07`
  },
  star_owlet: {
    id: "star_owlet",
    name: "\u0E25\u0E39\u0E01\u0E19\u0E01\u0E2E\u0E39\u0E01\u0E14\u0E32\u0E27",
    rarity: "rare",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35\u0E27\u0E07\u0E01\u0E27\u0E49\u0E32\u0E07",
    sprite: "pet_star_owlet",
    flying: true,
    desc: "\u0E40\u0E23\u0E35\u0E22\u0E01\u0E14\u0E32\u0E27\u0E14\u0E27\u0E07\u0E40\u0E25\u0E47\u0E01\u0E46 \u0E43\u0E2B\u0E49\u0E15\u0E01\u0E43\u0E2A\u0E48\u0E1D\u0E39\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39",
    art: { plan: "bird", c1: "#2f3a6a", c2: "#c8d2f4", c3: "#fff3a0", crest: "ears", beak: "hook", wing: "feather", pat: "stars", glow: true },
    ability: { kind: "rain", name: "\u0E1D\u0E19\u0E14\u0E32\u0E27", every: 6, power: 0.5, count: 4, r: 60 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E14\u0E32\u0E27 ${v.count} \u0E14\u0E27\u0E07\u0E15\u0E01\u0E23\u0E2D\u0E1A\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E14\u0E27\u0E07\u0E25\u0E30 \xD7${v.power.toFixed(2)}`
  },
  moss_golem: {
    id: "moss_golem",
    name: "\u0E42\u0E01\u0E40\u0E25\u0E21\u0E21\u0E2D\u0E2A",
    rarity: "rare",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E0A\u0E35\u0E27\u0E34\u0E15",
    sprite: "pet_moss_golem",
    desc: "\u0E22\u0E37\u0E19\u0E19\u0E34\u0E48\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E01\u0E49\u0E2D\u0E19\u0E2B\u0E34\u0E19 \u0E41\u0E15\u0E48\u0E08\u0E30\u0E01\u0E23\u0E30\u0E42\u0E08\u0E19\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E42\u0E2D\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E44\u0E27\u0E49\u0E22\u0E32\u0E21\u0E43\u0E01\u0E25\u0E49\u0E15\u0E32\u0E22",
    art: { plan: "golem", c1: "#8a8478", c2: "#b8b0a0", c3: "#9fffd8", moss: "#6aa25a", pat: "cracks" },
    ability: { kind: "guardian", name: "\u0E2D\u0E49\u0E2D\u0E21\u0E01\u0E2D\u0E14\u0E2B\u0E34\u0E19", below: 0.3, healPct: 0.3, shieldPct: 0.15 },
    text: (v) => `\u0E04\u0E23\u0E31\u0E49\u0E07\u0E41\u0E23\u0E01\u0E43\u0E19\u0E41\u0E15\u0E48\u0E25\u0E30\u0E14\u0E31\u0E19\u0E40\u0E08\u0E35\u0E49\u0E22\u0E19\u0E17\u0E35\u0E48\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 ${pct(v.below)}%: \u0E1F\u0E37\u0E49\u0E19 ${pct(v.healPct)}% \u0E41\u0E25\u0E30\u0E44\u0E14\u0E49\u0E42\u0E25\u0E48 ${pct(v.shieldPct)}%`
  },
  wind_ferret: {
    id: "wind_ferret",
    name: "\u0E1E\u0E31\u0E07\u0E1E\u0E2D\u0E19\u0E25\u0E21",
    rarity: "rare",
    role: "\u0E1A\u0E31\u0E1E\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E42\u0E08\u0E21\u0E15\u0E35",
    sprite: "pet_wind_ferret",
    desc: "\u0E27\u0E34\u0E48\u0E07\u0E27\u0E19\u0E23\u0E2D\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E08\u0E19\u0E40\u0E01\u0E34\u0E14\u0E25\u0E21\u0E2B\u0E21\u0E38\u0E19 \u0E41\u0E02\u0E19\u0E40\u0E1A\u0E32\u0E08\u0E19\u0E1F\u0E31\u0E19\u0E44\u0E14\u0E49\u0E16\u0E35\u0E48\u0E02\u0E36\u0E49\u0E19",
    art: { plan: "quad", c1: "#c8a070", c2: "#f3e6c8", c3: "#9ee0c8", ears: "round", tail: "thin", pat: "stripes", build: "slim" },
    ability: { kind: "haste", name: "\u0E25\u0E21\u0E2B\u0E21\u0E38\u0E19", every: 10, haste: 0.25, duration: 4 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E42\u0E08\u0E21\u0E15\u0E35 +${pct(v.haste)}% \u0E19\u0E32\u0E19 ${v.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  // ---------------------------------------------------------------- epic
  lava_salamander: {
    id: "lava_salamander",
    name: "\u0E0B\u0E32\u0E25\u0E32\u0E41\u0E21\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E25\u0E32\u0E27\u0E32",
    rarity: "epic",
    role: "\u0E44\u0E1F\u0E1E\u0E37\u0E49\u0E19",
    sprite: "pet_lava_salamander",
    desc: "\u0E17\u0E38\u0E01\u0E01\u0E49\u0E32\u0E27\u0E17\u0E35\u0E48\u0E40\u0E14\u0E34\u0E19\u0E17\u0E34\u0E49\u0E07\u0E23\u0E2D\u0E22\u0E25\u0E32\u0E27\u0E32\u0E44\u0E27\u0E49 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E15\u0E32\u0E21\u0E21\u0E32\u0E08\u0E30\u0E44\u0E2B\u0E21\u0E49",
    art: { plan: "serpent", c1: "#8e2c21", c2: "#ffb35a", c3: "#ffd08a", pat: "lava", legs: true, fins: true, glow: true },
    ability: { kind: "trail", name: "\u0E23\u0E2D\u0E22\u0E25\u0E32\u0E27\u0E32", every: 0.35, power: 0.22, r: 34, life: 2.6 },
    text: (v) => `\u0E40\u0E14\u0E34\u0E19\u0E17\u0E34\u0E49\u0E07\u0E23\u0E2D\u0E22\u0E25\u0E32\u0E27\u0E32: \u0E28\u0E31\u0E15\u0E23\u0E39\u0E1A\u0E19\u0E23\u0E2D\u0E22\u0E42\u0E14\u0E19 \xD7${v.power.toFixed(2)} \u0E17\u0E38\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E44\u0E1F`
  },
  storm_eagle: {
    id: "storm_eagle",
    name: "\u0E2D\u0E34\u0E19\u0E17\u0E23\u0E35\u0E1E\u0E32\u0E22\u0E38",
    rarity: "epic",
    role: "\u0E1E\u0E38\u0E48\u0E07\u0E17\u0E30\u0E25\u0E27\u0E07",
    sprite: "pet_storm_eagle",
    flying: true,
    desc: "\u0E1E\u0E38\u0E48\u0E07\u0E25\u0E07\u0E17\u0E30\u0E25\u0E38\u0E1D\u0E39\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E23\u0E47\u0E27\u0E40\u0E17\u0E48\u0E32\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32 \u0E41\u0E25\u0E49\u0E27\u0E1A\u0E34\u0E19\u0E27\u0E01\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E40\u0E01\u0E32\u0E30\u0E44\u0E2B\u0E25\u0E48",
    art: { plan: "bird", c1: "#5a6a80", c2: "#e8f0ff", c3: "#ffe65a", wing: "storm", beak: "hook", crest: "plume", tailF: "fan" },
    ability: { kind: "pierce", name: "\u0E14\u0E34\u0E48\u0E07\u0E1E\u0E32\u0E22\u0E38", every: 3.2, power: 0.9, len: 300, width: 44 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1E\u0E38\u0E48\u0E07\u0E17\u0E30\u0E25\u0E38\u0E41\u0E19\u0E27\u0E28\u0E31\u0E15\u0E23\u0E39 \xD7${v.power.toFixed(2)} \u0E41\u0E25\u0E49\u0E27\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32`
  },
  prism_sprite: {
    id: "prism_sprite",
    name: "\u0E20\u0E39\u0E15\u0E1B\u0E23\u0E34\u0E0B\u0E36\u0E21",
    rarity: "epic",
    role: "\u0E22\u0E34\u0E07\u0E17\u0E30\u0E25\u0E38",
    sprite: "pet_prism_sprite",
    flying: true,
    desc: "\u0E2B\u0E31\u0E01\u0E40\u0E2B\u0E41\u0E2A\u0E07\u0E2D\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E33\u0E17\u0E30\u0E25\u0E27\u0E07\u0E2B\u0E25\u0E32\u0E22\u0E2A\u0E32\u0E22",
    art: { plan: "wisp", form: "prism", c1: "#c8e8ff", c2: "#ffd0f0", c3: "#fff3a0", orbit: true },
    ability: { kind: "fan", name: "\u0E41\u0E2A\u0E07\u0E2B\u0E31\u0E01\u0E40\u0E2B", every: 3, power: 0.42, count: 3, spread: 46 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E22\u0E34\u0E07\u0E41\u0E2A\u0E07 ${v.count} \u0E2A\u0E32\u0E22 \xD7${v.power.toFixed(2)} \u0E17\u0E30\u0E25\u0E38\u0E28\u0E31\u0E15\u0E23\u0E39`
  },
  shadow_cat: {
    id: "shadow_cat",
    name: "\u0E41\u0E21\u0E27\u0E40\u0E07\u0E32",
    rarity: "epic",
    role: "\u0E1B\u0E25\u0E34\u0E14\u0E0A\u0E35\u0E1E",
    sprite: "pet_shadow_cat",
    desc: "\u0E2B\u0E32\u0E22\u0E15\u0E31\u0E27\u0E44\u0E1B\u0E43\u0E19\u0E40\u0E07\u0E32 \u0E41\u0E25\u0E49\u0E27\u0E42\u0E1C\u0E25\u0E48\u0E2B\u0E25\u0E31\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E1A\u0E32\u0E14\u0E40\u0E08\u0E47\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14",
    art: { plan: "quad", c1: "#2a2438", c2: "#5a4a7a", c3: "#c27ff0", ears: "pointy", tail: "thin", eye: "#ffe65a", pat: "none", glow: true, build: "slim" },
    ability: { kind: "ambush", name: "\u0E40\u0E07\u0E32\u0E1B\u0E25\u0E34\u0E14\u0E0A\u0E35\u0E1E", every: 4, power: 1.1, execute: 0.5 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E27\u0E32\u0E23\u0E4C\u0E1B\u0E44\u0E1B\u0E15\u0E30\u0E1B\u0E1A\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E19\u0E49\u0E2D\u0E22\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \xD7${v.power.toFixed(2)} (\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 30% \u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 ${pct(v.execute)}%)`
  },
  sun_scarab: {
    id: "sun_scarab",
    name: "\u0E41\u0E21\u0E25\u0E07\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30",
    rarity: "epic",
    role: "\u0E42\u0E04\u0E08\u0E23\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27",
    sprite: "pet_sun_scarab",
    flying: true,
    desc: "\u0E42\u0E04\u0E08\u0E23\u0E23\u0E2D\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E14\u0E27\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E14\u0E27\u0E07\u0E40\u0E25\u0E47\u0E01 \u0E43\u0E04\u0E23\u0E40\u0E02\u0E49\u0E32\u0E43\u0E01\u0E25\u0E49\u0E08\u0E30\u0E44\u0E2B\u0E21\u0E49",
    art: { plan: "insect", form: "beetle", c1: "#2f6a6a", c2: "#7fd0c0", c3: "#f5d48a", sun: true, horn: "pincer", glow: true },
    ability: { kind: "orbit", name: "\u0E27\u0E07\u0E42\u0E04\u0E08\u0E23\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30", power: 0.3, radius: 86, speed: 3.2, hitEvery: 0.35 },
    text: (v) => `\u0E42\u0E04\u0E08\u0E23\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E27\u0E25\u0E32 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E42\u0E14\u0E19\u0E23\u0E31\u0E1A \xD7${v.power.toFixed(2)}`
  },
  bone_hound: {
    id: "bone_hound",
    name: "\u0E2B\u0E21\u0E32\u0E42\u0E04\u0E23\u0E07\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01",
    rarity: "epic",
    role: "\u0E02\u0E39\u0E48\u0E02\u0E27\u0E31\u0E0D",
    sprite: "pet_bone_hound",
    desc: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2B\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E42\u0E25\u0E01\u0E2B\u0E25\u0E31\u0E07\u0E04\u0E27\u0E32\u0E21\u0E15\u0E32\u0E22 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E16\u0E36\u0E07\u0E01\u0E31\u0E1A\u0E15\u0E31\u0E27\u0E41\u0E02\u0E47\u0E07",
    art: { plan: "quad", c1: "#d8ccb6", c2: "#f3ead2", c3: "#9fffd8", ears: "pointy", tail: "bone", pat: "ribs", skull: true, eye: "#9fffd8", build: "slim" },
    ability: { kind: "howl", name: "\u0E2B\u0E2D\u0E19\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", every: 12, r: 190, stun: 0.7, reduce: 0.2, duration: 4 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E0A\u0E30\u0E07\u0E31\u0E01 ${v.stun} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E40\u0E23\u0E32\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 \u2212${pct(v.reduce)}% \u0E19\u0E32\u0E19 ${v.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  cloud_whale: {
    id: "cloud_whale",
    name: "\u0E27\u0E32\u0E2C\u0E40\u0E21\u0E06",
    rarity: "epic",
    role: "\u0E1F\u0E37\u0E49\u0E19\u0E1F\u0E39 + \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21",
    sprite: "pet_cloud_whale",
    flying: true,
    desc: "\u0E25\u0E2D\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E2B\u0E31\u0E27\u0E41\u0E25\u0E49\u0E27\u0E42\u0E1B\u0E23\u0E22\u0E1D\u0E19\u0E2D\u0E38\u0E48\u0E19\u0E46 \u0E25\u0E07\u0E21\u0E32",
    art: { plan: "fish", form: "whale", c1: "#8fb8e8", c2: "#f4faff", c3: "#c8e8ff", clouds: true },
    ability: { kind: "drizzle", name: "\u0E1D\u0E19\u0E42\u0E1B\u0E23\u0E22", every: 10, healPct: 0.05, r: 200, slow: 0.65 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1D\u0E19\u0E15\u0E01 3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E1F\u0E37\u0E49\u0E19 ${pct(v.healPct)}% \u0E41\u0E25\u0E30\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E23\u0E31\u0E28\u0E21\u0E35\u0E0A\u0E49\u0E32\u0E25\u0E07`
  },
  void_jelly: {
    id: "void_jelly",
    name: "\u0E41\u0E21\u0E07\u0E01\u0E30\u0E1E\u0E23\u0E38\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E27\u0E48\u0E32\u0E07",
    rarity: "epic",
    role: "\u0E01\u0E31\u0E19\u0E01\u0E23\u0E30\u0E2A\u0E38\u0E19",
    sprite: "pet_void_jelly",
    flying: true,
    desc: "\u0E01\u0E25\u0E37\u0E19\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E25\u0E2D\u0E22\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E43\u0E01\u0E25\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22 \u0E23\u0E27\u0E21\u0E16\u0E36\u0E07\u0E01\u0E23\u0E30\u0E2A\u0E38\u0E19\u0E40\u0E27\u0E17",
    art: { plan: "blob", c1: "#6a4aa8", c2: "#c8b8ff", c3: "#9fffd8", tentacles: 5, core: true, clear: true, glow: true },
    ability: { kind: "absorb", name: "\u0E01\u0E25\u0E37\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E27\u0E48\u0E32\u0E07", every: 0.25, r: 95, max: 3 },
    text: (v) => `\u0E01\u0E25\u0E37\u0E19\u0E01\u0E23\u0E30\u0E2A\u0E38\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E40\u0E02\u0E49\u0E32\u0E43\u0E01\u0E25\u0E49\u0E15\u0E31\u0E27\u0E40\u0E23\u0E32\u0E43\u0E19\u0E23\u0E30\u0E22\u0E30 ${v.r} \u0E44\u0E14\u0E49 ${v.max} \u0E25\u0E39\u0E01\u0E17\u0E38\u0E01 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  // ---------------------------------------------------------------- legendary
  phoenix_chick: {
    id: "phoenix_chick",
    name: "\u0E25\u0E39\u0E01\u0E19\u0E01\u0E1F\u0E35\u0E19\u0E34\u0E01\u0E0B\u0E4C",
    rarity: "legendary",
    role: "\u0E0A\u0E38\u0E1A\u0E0A\u0E35\u0E27\u0E34\u0E15 + \u0E44\u0E1F",
    sprite: "pet_phoenix_chick",
    flying: true,
    desc: "\u0E44\u0E1F\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E14\u0E31\u0E1A \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E14\u0E31\u0E1A\u0E01\u0E48\u0E2D\u0E19",
    art: { plan: "bird", c1: "#ff7a33", c2: "#ffe0a0", c3: "#ffcf5a", wing: "flame", crest: "flame", tailF: "long", glow: true, eye: "#5a1a0a" },
    ability: { kind: "rebirth", name: "\u0E40\u0E16\u0E49\u0E32\u0E04\u0E37\u0E19\u0E0A\u0E35\u0E1E", every: 6, power: 0.5, r: 120 },
    text: (v) => `\u0E04\u0E23\u0E31\u0E49\u0E07\u0E41\u0E23\u0E01\u0E43\u0E19\u0E41\u0E15\u0E48\u0E25\u0E30\u0E14\u0E31\u0E19\u0E40\u0E08\u0E35\u0E49\u0E22\u0E19\u0E17\u0E35\u0E48\u0E08\u0E30\u0E25\u0E49\u0E21 \u0E1F\u0E37\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 50% \xB7 \u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E27\u0E07\u0E44\u0E1F\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E40\u0E23\u0E32 \xD7${v.power.toFixed(2)}`
  },
  abyss_kraken: {
    id: "abyss_kraken",
    name: "\u0E04\u0E23\u0E32\u0E40\u0E04\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E25\u0E36\u0E01",
    rarity: "legendary",
    role: "\u0E08\u0E31\u0E1A\u0E15\u0E23\u0E36\u0E07",
    sprite: "pet_abyss_kraken",
    flying: true,
    desc: "\u0E2B\u0E19\u0E27\u0E14\u0E08\u0E32\u0E01\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E43\u0E15\u0E49\u0E17\u0E30\u0E40\u0E25\u0E23\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39\u0E44\u0E14\u0E49\u0E17\u0E35\u0E25\u0E30\u0E2B\u0E25\u0E32\u0E22\u0E15\u0E31\u0E27",
    art: { plan: "blob", c1: "#2a4a6a", c2: "#7fa8d0", c3: "#7fe8ff", tentacles: 7, mouth: "fang", spikes: true, eye: "#7fe8ff" },
    ability: { kind: "grasp", name: "\u0E2B\u0E19\u0E27\u0E14\u0E2B\u0E49\u0E27\u0E07\u0E25\u0E36\u0E01", every: 5, power: 0.6, count: 3, stun: 1, range: 320 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E23\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39 ${v.count} \u0E15\u0E31\u0E27 \xD7${v.power.toFixed(2)} \u0E15\u0E23\u0E36\u0E07\u0E44\u0E27\u0E49 ${v.stun} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  celestial_qilin: {
    id: "celestial_qilin",
    name: "\u0E01\u0E34\u0E40\u0E25\u0E19\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C",
    rarity: "legendary",
    role: "\u0E40\u0E02\u0E15\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C + \u0E04\u0E48\u0E32\u0E2A\u0E16\u0E32\u0E19\u0E30",
    sprite: "pet_celestial_qilin",
    desc: "\u0E17\u0E35\u0E48\u0E43\u0E14\u0E17\u0E35\u0E48\u0E01\u0E34\u0E40\u0E25\u0E19\u0E40\u0E2B\u0E22\u0E35\u0E22\u0E1A \u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E19\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E14\u0E19\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C",
    art: { plan: "quad", c1: "#f5d48a", c2: "#fff6e0", c3: "#7fd0c0", ears: "droop", horns: "antler", tail: "bushy", mane: "#ff8a7a", pat: "runes", glow: true },
    ability: { kind: "sanctuary", name: "\u0E41\u0E14\u0E19\u0E01\u0E34\u0E40\u0E25\u0E19", every: 15, r: 135, duration: 4, reduce: 0.35, healPct: 0.03, allPct: 0.04 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E14\u0E19\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C ${v.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E43\u0E19\u0E27\u0E07\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 \u2212${pct(v.reduce)}% \u0E1F\u0E37\u0E49\u0E19 ${pct(v.healPct)}%/\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E04\u0E48\u0E32\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 +${pct(v.allPct)}%`
  },
  nine_tail: {
    id: "nine_tail",
    name: "\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01\u0E40\u0E01\u0E49\u0E32\u0E2B\u0E32\u0E07",
    rarity: "legendary",
    role: "\u0E44\u0E1F\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01",
    sprite: "pet_nine_tail",
    desc: "\u0E2B\u0E32\u0E07\u0E17\u0E31\u0E49\u0E07\u0E40\u0E01\u0E49\u0E32\u0E08\u0E38\u0E14\u0E44\u0E1F\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E43\u0E2B\u0E49\u0E21\u0E31\u0E19\u0E44\u0E25\u0E48\u0E25\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2D\u0E07",
    art: { plan: "quad", c1: "#f3f0ff", c2: "#ffffff", c3: "#7f9fff", ears: "pointy", tail: "nine", pat: "none", eye: "#7f5fd0", glow: true },
    ability: { kind: "foxfire", name: "\u0E44\u0E1F\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01\u0E40\u0E01\u0E49\u0E32\u0E14\u0E27\u0E07", every: 4.5, power: 0.3, count: 9 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E44\u0E1F\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01 ${v.count} \u0E14\u0E27\u0E07\u0E44\u0E25\u0E48\u0E15\u0E32\u0E21\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E14\u0E27\u0E07\u0E25\u0E30 \xD7${v.power.toFixed(2)}`
  },
  obsidian_titan: {
    id: "obsidian_titan",
    name: "\u0E44\u0E17\u0E17\u0E31\u0E19\u0E2D\u0E2D\u0E1A\u0E0B\u0E34\u0E40\u0E14\u0E35\u0E22\u0E19",
    rarity: "legendary",
    role: "\u0E41\u0E1C\u0E48\u0E19\u0E14\u0E34\u0E19\u0E44\u0E2B\u0E27 + \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19",
    sprite: "pet_obsidian_titan",
    desc: "\u0E01\u0E49\u0E32\u0E27\u0E40\u0E14\u0E35\u0E22\u0E27\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E1E\u0E37\u0E49\u0E19\u0E41\u0E22\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E32\u0E21\u0E23\u0E30\u0E25\u0E2D\u0E01",
    art: { plan: "golem", c1: "#2a2430", c2: "#5a4a6a", c3: "#ff5a3a", shards: true, pat: "cracks", glow: true },
    ability: { kind: "quake", name: "\u0E2A\u0E32\u0E21\u0E23\u0E30\u0E25\u0E2D\u0E01\u0E1B\u0E10\u0E1E\u0E35", every: 6, power: 0.55, r: 210, stun: 0.5, defPct: 0.06 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E1C\u0E48\u0E19\u0E14\u0E34\u0E19\u0E44\u0E2B\u0E27 3 \u0E23\u0E30\u0E25\u0E2D\u0E01 \u0E23\u0E30\u0E25\u0E2D\u0E01\u0E25\u0E30 \xD7${v.power.toFixed(2)} \xB7 \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +${pct(v.defPct)}%`
  }
});

// src/data/pets.js
var PITY = 10;
var MAX_STARS = 5;
var STAR_BONUS = 0.15;
var PET_TEAM = 3;
var TIER_ODDS = Object.freeze({ common: 0.5, rare: 0.32, epic: 0.15, legendary: 0.03 });
var BASE_PETS = {
  firefly: {
    id: "firefly",
    name: "\u0E2B\u0E34\u0E48\u0E07\u0E2B\u0E49\u0E2D\u0E22\u0E17\u0E2D\u0E07",
    rarity: "common",
    role: "\u0E1F\u0E37\u0E49\u0E19\u0E1F\u0E39",
    sprite: "pet_firefly",
    flying: true,
    desc: "\u0E2A\u0E48\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E2D\u0E38\u0E48\u0E19\u0E17\u0E35\u0E48\u0E1B\u0E34\u0E14\u0E41\u0E1C\u0E25\u0E40\u0E25\u0E47\u0E01\u0E46 \u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E22\u0E30",
    ability: { kind: "heal", name: "\u0E41\u0E2A\u0E07\u0E2D\u0E38\u0E48\u0E19", every: 6, healPct: 0.025 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 ${(v.healPct * 100).toFixed(1)}%`
  },
  mossmouse: {
    id: "mossmouse",
    name: "\u0E2B\u0E19\u0E39\u0E21\u0E2D\u0E2A",
    rarity: "common",
    role: "\u0E40\u0E01\u0E47\u0E1A\u0E02\u0E2D\u0E07",
    sprite: "pet_mossmouse",
    desc: "\u0E0A\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E41\u0E27\u0E27\u0E27\u0E32\u0E27 \u0E27\u0E34\u0E48\u0E07\u0E40\u0E01\u0E47\u0E1A\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E1A\u0E19\u0E1E\u0E37\u0E49\u0E19",
    ability: { kind: "passive", name: "\u0E21\u0E37\u0E2D\u0E44\u0E27", magnet: 0.8, goldMult: 0.1 },
    text: (v) => `\u0E23\u0E30\u0E22\u0E30\u0E14\u0E39\u0E14\u0E02\u0E2D\u0E07 +${Math.round(v.magnet * 100)}% \xB7 \u0E17\u0E2D\u0E07 +${Math.round(v.goldMult * 100)}%`
  },
  owl: {
    id: "owl",
    name: "\u0E19\u0E01\u0E40\u0E04\u0E49\u0E32\u0E16\u0E48\u0E32\u0E19",
    rarity: "rare",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35",
    sprite: "pet_owl",
    flying: true,
    desc: "\u0E1A\u0E34\u0E19\u0E27\u0E19\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E2B\u0E31\u0E27\u0E41\u0E25\u0E49\u0E27\u0E22\u0E34\u0E07\u0E02\u0E19\u0E44\u0E1F\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14",
    ability: { kind: "bolt", name: "\u0E02\u0E19\u0E44\u0E1F", every: 1.6, power: 0.55, range: 420 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E22\u0E34\u0E07\u0E02\u0E19\u0E44\u0E1F \xD7${v.power.toFixed(2)} \u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14`
  },
  turtle: {
    id: "turtle",
    name: "\u0E40\u0E15\u0E48\u0E32\u0E28\u0E34\u0E25\u0E32",
    rarity: "rare",
    role: "\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19",
    sprite: "pet_turtle",
    desc: "\u0E01\u0E23\u0E30\u0E14\u0E2D\u0E07\u0E2B\u0E34\u0E19\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E41\u0E1A\u0E48\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E44\u0E14\u0E49",
    ability: { kind: "shield", name: "\u0E01\u0E23\u0E30\u0E14\u0E2D\u0E07\u0E41\u0E1A\u0E48\u0E07\u0E1B\u0E31\u0E19", every: 12, shieldPct: 0.1, duration: 6 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E43\u0E2B\u0E49\u0E42\u0E25\u0E48 ${Math.round(v.shieldPct * 100)}% \u0E02\u0E2D\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 \u0E19\u0E32\u0E19 ${v.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  gecko: {
    id: "gecko",
    name: "\u0E01\u0E34\u0E49\u0E07\u0E01\u0E48\u0E32\u0E27\u0E32\u0E22\u0E38",
    rarity: "rare",
    role: "\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E2A\u0E01\u0E34\u0E25",
    sprite: "pet_gecko",
    desc: "\u0E27\u0E34\u0E48\u0E07\u0E40\u0E23\u0E47\u0E27\u0E08\u0E19\u0E25\u0E21\u0E2B\u0E21\u0E38\u0E19\u0E15\u0E32\u0E21 \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22\u0E23\u0E48\u0E32\u0E22\u0E2A\u0E01\u0E34\u0E25\u0E44\u0E14\u0E49\u0E16\u0E35\u0E48\u0E02\u0E36\u0E49\u0E19",
    ability: { kind: "passive", name: "\u0E25\u0E21\u0E40\u0E23\u0E48\u0E07", skillCd: 0.12, perfectRefund: 1 },
    text: (v) => `\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2A\u0E01\u0E34\u0E25 \u2212${Math.round(v.skillCd * 100)}% \xB7 \u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E25\u0E14\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2A\u0E01\u0E34\u0E25 ${v.perfectRefund.toFixed(1)} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  fox: {
    id: "fox",
    name: "\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01\u0E08\u0E31\u0E19\u0E17\u0E23\u0E32",
    rarity: "epic",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35",
    sprite: "pet_fox",
    desc: "\u0E1E\u0E38\u0E48\u0E07\u0E01\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39\u0E41\u0E25\u0E49\u0E27\u0E17\u0E34\u0E49\u0E07\u0E23\u0E2D\u0E22\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E23\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19",
    ability: { kind: "bite", name: "\u0E23\u0E2D\u0E22\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", every: 1.3, power: 0.7, mark: 0.15, markT: 3, range: 360 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E01\u0E31\u0E14 \xD7${v.power.toFixed(2)} \u0E41\u0E25\u0E30\u0E17\u0E33\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22: \u0E40\u0E1B\u0E49\u0E32\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08 +${Math.round(v.mark * 100)}% \u0E19\u0E32\u0E19 ${v.markT} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`
  },
  lantern: {
    id: "lantern",
    name: "\u0E20\u0E39\u0E15\u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07",
    rarity: "epic",
    role: "\u0E1A\u0E31\u0E1E",
    sprite: "pet_lantern",
    flying: true,
    desc: "\u0E14\u0E27\u0E07\u0E44\u0E1F\u0E40\u0E25\u0E47\u0E01\u0E46 \u0E08\u0E32\u0E01\u0E42\u0E23\u0E07\u0E15\u0E35\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27 \u0E1B\u0E25\u0E38\u0E01\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E43\u0E19\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E02\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22",
    ability: { kind: "bless", name: "\u0E1E\u0E23\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F", every: 10, atkPct: 0.2, duration: 4, skillPower: 0.15 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35 +${Math.round(v.atkPct * 100)}% \u0E19\u0E32\u0E19 ${v.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E2A\u0E01\u0E34\u0E25\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 ${Math.round(v.skillPower * 100)}%`
  },
  drake: {
    id: "drake",
    name: "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E40\u0E16\u0E49\u0E32\u0E17\u0E2D\u0E07",
    rarity: "legendary",
    role: "\u0E0A\u0E48\u0E27\u0E22\u0E42\u0E08\u0E21\u0E15\u0E35 + \u0E04\u0E48\u0E32\u0E2A\u0E16\u0E32\u0E19\u0E30",
    sprite: "pet_drake",
    flying: true,
    desc: "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E19\u0E49\u0E2D\u0E22\u0E17\u0E35\u0E48\u0E1F\u0E31\u0E01\u0E08\u0E32\u0E01\u0E16\u0E48\u0E32\u0E19\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C \u0E1E\u0E48\u0E19\u0E44\u0E1F\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E41\u0E25\u0E30\u0E41\u0E1A\u0E48\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22",
    ability: { kind: "breath", name: "\u0E44\u0E1F\u0E40\u0E16\u0E49\u0E32\u0E17\u0E2D\u0E07", every: 3, power: 0.5, ticks: 3, range: 220, arc: 60, allPct: 0.06 },
    text: (v) => `\u0E17\u0E38\u0E01 ${v.every} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1E\u0E48\u0E19\u0E44\u0E1F ${v.ticks} \u0E04\u0E23\u0E31\u0E49\u0E07 \xD7${v.power.toFixed(2)} \xB7 \u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35/\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19/\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 +${Math.round(v.allPct * 100)}%`
  }
};
var PETS = Object.freeze({ ...BASE_PETS, ...PETS_V7 });
var PET_IDS = Object.freeze(Object.keys(PETS));
function getPet(id) {
  return Object.prototype.hasOwnProperty.call(PETS, id) ? PETS[id] : null;
}
var FIXED = /* @__PURE__ */ new Set(["kind", "name", "every", "duration", "markT", "ticks", "range", "arc", "r", "count", "jumps", "len", "width", "radius", "speed", "hitEvery", "charges", "below", "slowT", "spread", "life", "pull", "slow", "stun", "max", "burn"]);
function petValues(pet, stars = 1) {
  const m = 1 + STAR_BONUS * (Math.max(1, Math.min(MAX_STARS, stars)) - 1);
  const out = {};
  for (const [k, v] of Object.entries(pet.ability)) out[k] = FIXED.has(k) || typeof v !== "number" ? v : Math.round(v * m * 1e3) / 1e3;
  return out;
}

// src/data/artifacts.js
var ART_LEVEL_MAX = 5;
var ART_LEVEL_STEP = 0.25;
var AFFINITY_BONUS = 0.5;
var ARTIFACTS = Object.freeze({
  ar_meteor_shard: { id: "ar_meteor_shard", name: "\u0E40\u0E28\u0E29\u0E14\u0E32\u0E27\u0E15\u0E01", rarity: "common", fx: { crit: 0.02 }, look: { shape: "shard", a: "#ffd08a", b: "#ff8a3d" }, desc: "\u0E22\u0E31\u0E07\u0E2D\u0E38\u0E48\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E23\u0E32\u0E27\u0E01\u0E31\u0E1A\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E23\u0E48\u0E27\u0E07\u0E08\u0E32\u0E01\u0E1F\u0E49\u0E32\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E37\u0E19" },
  ar_shadow_quartz: { id: "ar_shadow_quartz", name: "\u0E1C\u0E25\u0E36\u0E01\u0E40\u0E01\u0E23\u0E32\u0E30\u0E40\u0E07\u0E32", rarity: "common", fx: { defFlat: 8 }, look: { shape: "prism", a: "#9a8ad0", b: "#3a3450" }, desc: "\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1B\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E2D\u0E35\u0E01" },
  ar_moon_dew: { id: "ar_moon_dew", name: "\u0E2B\u0E22\u0E14\u0E19\u0E49\u0E33\u0E04\u0E49\u0E32\u0E07\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C", rarity: "common", fx: { hpPct: 0.04 }, look: { shape: "drop", a: "#e8f8ff", b: "#7fc0ef" }, desc: "\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E15\u0E47\u0E21\u0E14\u0E27\u0E07" },
  ar_comet_fang: { id: "ar_comet_fang", name: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E14\u0E32\u0E27\u0E2B\u0E32\u0E07", rarity: "uncommon", fx: { atkPct: 0.03 }, look: { shape: "fang", a: "#bfe3ff", b: "#5fa8ec" }, desc: "\u0E2B\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E22\u0E31\u0E07\u0E25\u0E32\u0E01\u0E41\u0E2A\u0E07\u0E15\u0E32\u0E21\u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E40\u0E2B\u0E27\u0E35\u0E48\u0E22\u0E07" },
  ar_nebula_seed: { id: "ar_nebula_seed", name: "\u0E40\u0E21\u0E25\u0E47\u0E14\u0E40\u0E19\u0E1A\u0E34\u0E27\u0E25\u0E32", rarity: "uncommon", fx: { shieldPct: 0.05 }, look: { shape: "orb", a: "#ffb3e6", b: "#7a4ad0" }, desc: "\u0E2B\u0E48\u0E2D\u0E2B\u0E38\u0E49\u0E21\u0E1C\u0E39\u0E49\u0E16\u0E37\u0E2D\u0E14\u0E49\u0E27\u0E22\u0E2B\u0E21\u0E2D\u0E01\u0E14\u0E32\u0E27\u0E1A\u0E32\u0E07\u0E40\u0E1A\u0E32" },
  ar_gravity_net: { id: "ar_gravity_net", name: "\u0E15\u0E32\u0E02\u0E48\u0E32\u0E22\u0E41\u0E23\u0E07\u0E42\u0E19\u0E49\u0E21\u0E16\u0E48\u0E27\u0E07", rarity: "uncommon", fx: { debuff: 0.06 }, look: { shape: "ring", a: "#9fffd8", b: "#2f5a57" }, desc: "\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E42\u0E14\u0E19\u0E08\u0E30\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01\u0E27\u0E48\u0E32\u0E23\u0E48\u0E32\u0E07\u0E01\u0E32\u0E22\u0E2B\u0E19\u0E31\u0E01\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E34\u0E1A\u0E40\u0E17\u0E48\u0E32" },
  ar_solar_scale: { id: "ar_solar_scale", name: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30", rarity: "rare", fx: { critMult: 0.12 }, look: { shape: "scale", a: "#fff3c4", b: "#f5b041" }, desc: "\u0E25\u0E2D\u0E01\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E08\u0E32\u0E01\u0E1C\u0E34\u0E27\u0E14\u0E27\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E14\u0E27\u0E07\u0E40\u0E25\u0E47\u0E01" },
  ar_polar_vane: { id: "ar_polar_vane", name: "\u0E43\u0E1A\u0E1E\u0E31\u0E14\u0E14\u0E32\u0E27\u0E40\u0E2B\u0E19\u0E37\u0E2D", rarity: "rare", fx: { spd: 0.04 }, look: { shape: "star", a: "#e6fff6", b: "#5fc0a0" }, desc: "\u0E0A\u0E35\u0E49\u0E17\u0E32\u0E07\u0E40\u0E2A\u0E21\u0E2D \u0E41\u0E21\u0E49\u0E43\u0E19\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E17\u0E35\u0E48\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14" },
  ar_quasar_tear: { id: "ar_quasar_tear", name: "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E04\u0E27\u0E2D\u0E0B\u0E32\u0E23\u0E4C", rarity: "rare", fx: { healOnKill: 0.015 }, look: { shape: "drop", a: "#ffffff", b: "#c27ff0" }, desc: "\u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E1E\u0E48\u0E32\u0E22\u0E41\u0E1E\u0E49\u0E02\u0E2D\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E04\u0E37\u0E2D\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E44\u0E2B\u0E25\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E2B\u0E32\u0E40\u0E23\u0E32" },
  ar_saturn_ring: { id: "ar_saturn_ring", name: "\u0E42\u0E25\u0E48\u0E27\u0E07\u0E41\u0E2B\u0E27\u0E19\u0E40\u0E2A\u0E32\u0E23\u0E4C", rarity: "epic", fx: { shieldPct: 0.08, guard: 0.15 }, look: { shape: "planet", a: "#f0d89a", b: "#a8743a" }, desc: "\u0E27\u0E07\u0E41\u0E2B\u0E27\u0E19\u0E2B\u0E21\u0E38\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E1C\u0E39\u0E49\u0E16\u0E37\u0E2D \u0E1B\u0E31\u0E14\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E43\u0E2B\u0E49\u0E40\u0E09\u0E35\u0E22\u0E07\u0E2D\u0E2D\u0E01" },
  ar_galaxy_compass: { id: "ar_galaxy_compass", name: "\u0E40\u0E02\u0E47\u0E21\u0E17\u0E34\u0E28\u0E01\u0E32\u0E41\u0E25\u0E47\u0E01\u0E0B\u0E35", rarity: "epic", fx: { debuff: 0.08, crit: 0.02 }, look: { shape: "spiral", a: "#bfe3ff", b: "#3f6fb8" }, desc: "\u0E0A\u0E35\u0E49\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E08\u0E38\u0E14\u0E2D\u0E48\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E17\u0E38\u0E01\u0E2A\u0E34\u0E48\u0E07" },
  ar_pulsar_heart: { id: "ar_pulsar_heart", name: "\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1E\u0E31\u0E25\u0E0B\u0E32\u0E23\u0E4C", rarity: "epic", fx: { counter: 0.15, atkPct: 0.02 }, look: { shape: "heart", a: "#ff9a8a", b: "#c2412f" }, desc: "\u0E40\u0E15\u0E49\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E31\u0E1A" },
  ar_supernova_core: { id: "ar_supernova_core", name: "\u0E41\u0E01\u0E19\u0E0B\u0E39\u0E40\u0E1B\u0E2D\u0E23\u0E4C\u0E42\u0E19\u0E27\u0E32", rarity: "legendary", fx: { atkPct: 0.06, crit: 0.03 }, look: { shape: "nova", a: "#fff3c4", b: "#ff5a1a" }, desc: "\u0E1E\u0E25\u0E31\u0E07\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E08\u0E32\u0E01\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1E\u0E31\u0E19\u0E25\u0E49\u0E32\u0E19\u0E1B\u0E35\u0E01\u0E48\u0E2D\u0E19" },
  ar_blackhole_mirror: { id: "ar_blackhole_mirror", name: "\u0E01\u0E23\u0E30\u0E08\u0E01\u0E2B\u0E25\u0E38\u0E21\u0E14\u0E33", rarity: "legendary", fx: { counter: 0.25, guard: 0.15 }, look: { shape: "void", a: "#e0b0ff", b: "#120e1c" }, desc: "\u0E17\u0E38\u0E01\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E21\u0E32 \u0E08\u0E30\u0E16\u0E39\u0E01\u0E2A\u0E48\u0E07\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E41\u0E23\u0E07\u0E01\u0E27\u0E48\u0E32\u0E40\u0E14\u0E34\u0E21" },
  ar_cosmic_crown: { id: "ar_cosmic_crown", name: "\u0E21\u0E07\u0E01\u0E38\u0E0E\u0E08\u0E31\u0E01\u0E23\u0E27\u0E32\u0E25", rarity: "mythic", fx: { atkPct: 0.05, defPct: 0.05, hpPct: 0.05, crit: 0.04 }, look: { shape: "crown", a: "#ffffff", b: "#ff5f7a" }, desc: "\u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E04\u0E23\u0E2D\u0E07\u0E08\u0E31\u0E01\u0E23\u0E27\u0E32\u0E25 \u0E08\u0E31\u0E01\u0E23\u0E27\u0E32\u0E25\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E32\u0E01\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E2A\u0E27\u0E21" }
});
var getArtifact = (id) => Object.prototype.hasOwnProperty.call(ARTIFACTS, id) ? ARTIFACTS[id] : null;
var FX_KIND = Object.freeze({ atkPct: "atk", critMult: "atk", defPct: "def", defFlat: "def", hpPct: "def", crit: "crit", debuff: "crit", spd: "crit", shieldPct: "shield", guard: "shield", counter: "shield", healOnKill: "def" });
var KIND_INFO = Object.freeze({
  any: { name: "\u0E17\u0E38\u0E01\u0E0A\u0E19\u0E34\u0E14", color: "#ffffff" },
  atk: { name: "\u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35", color: "#ff8a5a" },
  def: { name: "\u0E04\u0E27\u0E32\u0E21\u0E17\u0E19\u0E17\u0E32\u0E19", color: "#9fe0a0" },
  crit: { name: "\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E41\u0E25\u0E30\u0E14\u0E35\u0E1A\u0E31\u0E1F", color: "#c9a2f5" },
  shield: { name: "\u0E42\u0E25\u0E48\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E31\u0E1A", color: "#7fc0ef" }
});
var TREE = Object.freeze([
  { id: "core", x: 200, y: 72, parent: null, aff: "any", level: 1 },
  { id: "b_atk", x: 70, y: 190, parent: "core", aff: "atk", level: 8 },
  { id: "b_def", x: 158, y: 214, parent: "core", aff: "def", level: 8 },
  { id: "b_crit", x: 242, y: 214, parent: "core", aff: "crit", level: 8 },
  { id: "b_shield", x: 330, y: 190, parent: "core", aff: "shield", level: 8 },
  { id: "l_atk1", x: 28, y: 318, parent: "b_atk", aff: "atk", level: 16 },
  { id: "l_atk2", x: 78, y: 372, parent: "b_atk", aff: "atk", level: 20 },
  { id: "l_def1", x: 126, y: 318, parent: "b_def", aff: "def", level: 16 },
  { id: "l_def2", x: 174, y: 372, parent: "b_def", aff: "def", level: 20 },
  { id: "l_crit1", x: 274, y: 318, parent: "b_crit", aff: "crit", level: 16 },
  { id: "l_crit2", x: 226, y: 372, parent: "b_crit", aff: "crit", level: 20 },
  { id: "l_shield1", x: 372, y: 318, parent: "b_shield", aff: "shield", level: 16 },
  { id: "l_shield2", x: 322, y: 372, parent: "b_shield", aff: "shield", level: 20 }
]);
var getSlot = (id) => TREE.find((s) => s.id === id) || null;
var ART_CAPS = Object.freeze({ atkPct: 0.5, defPct: 0.5, hpPct: 0.5, crit: 0.15, critMult: 0.6, spd: 0.12, defFlat: 120, shieldPct: 0.3, debuff: 0.3, guard: 0.4, counter: 0.6, healOnKill: 0.05 });
var ART_DROP = Object.freeze({ common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 1.8, mythic: 0.2 });

// src/data/zones.js
var ZONE_ROOM = Object.freeze({ w: 1600, h: 1040, wall: 60 });
function zoneStats(level) {
  return { hp: 40 + level * 11, atk: 10 + level * 2, def: 2 + level * 0.75, xp: 6 + level * 2.2, gold: [4 + level, 8 + level * 2] };
}
var MAT = [
  [{ id: "m_iron_shard", weight: 6, qty: [1, 3] }, { id: "m_beast_hide", weight: 3, qty: [1, 2] }, { id: "p_tonic", weight: 1, qty: [1, 1] }],
  [{ id: "m_iron_shard", weight: 5, qty: [2, 3] }, { id: "m_beast_hide", weight: 4, qty: [1, 2] }, { id: "m_thorn_core", weight: 1, qty: [1, 1] }, { id: "p_tonic", weight: 1, qty: [1, 1] }],
  [{ id: "m_iron_shard", weight: 4, qty: [2, 4] }, { id: "m_beast_hide", weight: 4, qty: [2, 3] }, { id: "m_thorn_core", weight: 2, qty: [1, 1] }, { id: "m_ember_core", weight: 1, qty: [1, 1] }],
  [{ id: "m_iron_shard", weight: 3, qty: [3, 5] }, { id: "m_beast_hide", weight: 3, qty: [2, 4] }, { id: "m_thorn_core", weight: 2, qty: [1, 2] }, { id: "m_ember_core", weight: 2, qty: [1, 1] }]
];
var GEAR = [
  [
    { id: "w_hunter_saber", weight: 1, qty: [1, 1] },
    { id: "w_ronin_katana", weight: 1, qty: [1, 1] },
    { id: "w_twin_fangs", weight: 1, qty: [1, 1] },
    { id: "a_hide_vest", weight: 1, qty: [1, 1] },
    { id: "c_moss_bead", weight: 1, qty: [1, 1] },
    { id: "w_reaper_hook", weight: 1, qty: [1, 1] },
    { id: "w_twin_sabers", weight: 1, qty: [1, 1] },
    { id: "a_wanderer_coat", weight: 1, qty: [1, 1] }
  ],
  [
    { id: "w_thorn_edge", weight: 1, qty: [1, 1] },
    { id: "w_mist_katana", weight: 1, qty: [1, 1] },
    { id: "w_venom_daggers", weight: 1, qty: [1, 1] },
    { id: "w_boar_breaker", weight: 1, qty: [1, 1] },
    { id: "w_thorn_rod", weight: 1, qty: [1, 1] },
    { id: "w_thornstring_bow", weight: 1, qty: [1, 1] },
    { id: "w_thorn_pike", weight: 1, qty: [1, 1] },
    { id: "a_bark_mail", weight: 1, qty: [1, 1] },
    { id: "c_boar_tusk", weight: 1, qty: [1, 1] },
    { id: "w_thornreap", weight: 1, qty: [1, 1] },
    { id: "w_twin_thorns", weight: 1, qty: [1, 1] },
    { id: "a_ronin_lamellar", weight: 1, qty: [1, 1] },
    { id: "a_moonlit_robe", weight: 1, qty: [1, 1] },
    { id: "wg_kinnaree", weight: 1, qty: [1, 1] },
    { id: "wg_ash_bat", weight: 1, qty: [1, 1] }
  ],
  [
    { id: "w_ember_fang", weight: 1, qty: [1, 1] },
    { id: "w_moonfall_katana", weight: 1, qty: [1, 1] },
    { id: "w_cinder_talons", weight: 1, qty: [1, 1] },
    { id: "w_furnace_cleaver", weight: 1, qty: [1, 1] },
    { id: "w_ember_scepter", weight: 1, qty: [1, 1] },
    { id: "w_sunfire_bow", weight: 1, qty: [1, 1] },
    { id: "w_ember_glaive", weight: 1, qty: [1, 1] },
    { id: "a_lacquer_plate", weight: 1, qty: [1, 1] },
    { id: "c_cinder_eye", weight: 1, qty: [1, 1] },
    { id: "w_ember_scythe", weight: 1, qty: [1, 1] },
    { id: "w_twin_embers", weight: 1, qty: [1, 1] },
    { id: "a_iron_bastion", weight: 1, qty: [1, 1] },
    { id: "a_wolf_knight", weight: 1, qty: [1, 1] },
    { id: "wg_sky_crystal", weight: 1, qty: [1, 1] }
  ]
];
var ZONE_PARTS = Object.freeze({ z1: "m_storm_quill", z2: "m_frost_heart", z3: "m_hydra_fang", z4: "m_umbral_shard", z5: "m_sun_relic", z6: "m_spore_crown", z7: "m_storm_coil", z8: "m_rift_scale", z9: "m_halo_shard", z10: "m_ash_crown_shard", z11: "m_mirror_shard", z12: "m_eclipse_core" });
var BOSS_EXTRA = Object.freeze({ z4: "w_dusk_scythe", z7: "w_twin_tempest" });
var ZONE_ARMOR = Object.freeze({ z1: "a_gale_vest", z3: "a_marsh_waders", z5: "a_dune_wrap", z6: "a_spore_coat", z7: "a_foundry_plate", z8: "a_magma_scale", z9: "a_sky_vestment", z10: "a_ashen_guard" });
function monsterDrops(tier, zoneId) {
  const out = [
    { chance: 0.55, entries: MAT[tier] },
    { chance: 0.03 + tier * 0.01, entries: GEAR[Math.min(2, tier)] }
  ];
  if (ZONE_PARTS[zoneId]) out.push({ chance: 0.04, entries: [{ id: ZONE_PARTS[zoneId], weight: 1, qty: [1, 1] }] });
  if (ZONE_ARMOR[zoneId]) out.push({ chance: 6e-3, entries: [{ id: ZONE_ARMOR[zoneId], weight: 1, qty: [1, 1] }] });
  return out;
}
function bossDrops(tier, legendary, zoneId) {
  const out = [
    { chance: 1, entries: MAT[tier] },
    { chance: 1, entries: MAT[tier] },
    { chance: 0.6, entries: GEAR[Math.min(2, tier)] },
    { chance: 0.25 + tier * 0.05, entries: GEAR[2] },
    { chance: 0.12 + tier * 0.03, entries: [{ id: legendary, weight: 1, qty: [1, 1] }] },
    { chance: 0.4, entries: [{ id: "m_bloodstone", weight: 1, qty: [1, 1] }] }
  ];
  if (ZONE_PARTS[zoneId]) out.push({ chance: 0.85, entries: [{ id: ZONE_PARTS[zoneId], weight: 1, qty: [1, 3] }] });
  if (BOSS_EXTRA[zoneId]) out.push({ chance: 0.08 + tier * 0.02, entries: [{ id: BOSS_EXTRA[zoneId], weight: 1, qty: [1, 1] }] });
  if (ZONE_ARMOR[zoneId]) out.push({ chance: 0.1 + tier * 0.02, entries: [{ id: ZONE_ARMOR[zoneId], weight: 1, qty: [1, 1] }] });
  return out;
}
var ZONES = Object.freeze([
  {
    id: "z1",
    n: 1,
    name: "\u0E17\u0E38\u0E48\u0E07\u0E2B\u0E0D\u0E49\u0E32\u0E25\u0E21\u0E01\u0E23\u0E14",
    level: 6,
    tier: 0,
    theme: "gale",
    mechanic: "gale",
    desc: "\u0E17\u0E38\u0E48\u0E07\u0E2B\u0E0D\u0E49\u0E32\u0E01\u0E27\u0E49\u0E32\u0E07\u0E17\u0E35\u0E48\u0E25\u0E21\u0E1E\u0E31\u0E14\u0E41\u0E23\u0E07\u0E08\u0E19\u0E1C\u0E25\u0E31\u0E01\u0E04\u0E19\u0E25\u0E49\u0E21 \u0E2A\u0E32\u0E22\u0E25\u0E21\u0E01\u0E23\u0E23\u0E42\u0E0A\u0E01\u0E08\u0E30\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E17\u0E34\u0E28\u0E01\u0E48\u0E2D\u0E19\u0E1E\u0E31\u0E14 \u0E22\u0E37\u0E19\u0E2B\u0E25\u0E1A\u0E2B\u0E25\u0E31\u0E07\u0E2B\u0E34\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E38\u0E48\u0E07\u0E2A\u0E27\u0E19\u0E25\u0E21\u0E44\u0E27\u0E49",
    mechanicText: "\u0E25\u0E21\u0E01\u0E23\u0E23\u0E42\u0E0A\u0E01: \u0E25\u0E39\u0E01\u0E28\u0E23\u0E1A\u0E2D\u0E01\u0E17\u0E34\u0E28 1.2 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E49\u0E27\u0E1C\u0E25\u0E31\u0E01\u0E17\u0E38\u0E01\u0E04\u0E19\u0E44\u0E1B\u0E17\u0E32\u0E07\u0E19\u0E31\u0E49\u0E19",
    monsters: ["z_gust_sprite", "z_seed_spitter"],
    boss: "z_storm_roc",
    rooms: [[["z_gust_sprite", 3], ["z_seed_spitter", 2]], [["z_seed_spitter", 2], ["z_gust_sprite", 3], ["z_gust_sprite", 2]], "boss"]
  },
  {
    id: "z2",
    n: 2,
    name: "\u0E16\u0E49\u0E33\u0E1C\u0E25\u0E36\u0E01\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07",
    level: 8,
    tier: 0,
    theme: "frost",
    mechanic: "ice",
    desc: "\u0E1E\u0E37\u0E49\u0E19\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E25\u0E37\u0E48\u0E19\u0E08\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E14\u0E34\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35 \u0E2B\u0E34\u0E19\u0E22\u0E49\u0E2D\u0E22\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E23\u0E48\u0E27\u0E07\u0E08\u0E32\u0E01\u0E40\u0E1E\u0E14\u0E32\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E22\u0E30",
    mechanicText: "\u0E1E\u0E37\u0E49\u0E19\u0E25\u0E37\u0E48\u0E19: \u0E40\u0E14\u0E34\u0E19\u0E41\u0E25\u0E49\u0E27\u0E44\u0E16\u0E25\u0E15\u0E48\u0E2D \xB7 \u0E2B\u0E34\u0E19\u0E22\u0E49\u0E2D\u0E22\u0E23\u0E48\u0E27\u0E07\u0E15\u0E23\u0E07\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E21\u0E35\u0E27\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19",
    monsters: ["z_frost_slime", "z_ice_archer"],
    boss: "z_glacier_wyrm",
    rooms: [[["z_frost_slime", 3], ["z_ice_archer", 1]], [["z_ice_archer", 2], ["z_frost_slime", 3], ["z_ice_archer", 1]], "boss"]
  },
  {
    id: "z3",
    n: 3,
    name: "\u0E1A\u0E36\u0E07\u0E1E\u0E34\u0E29",
    level: 10,
    tier: 1,
    theme: "marsh",
    mechanic: "toxic",
    desc: "\u0E2B\u0E19\u0E2D\u0E07\u0E19\u0E49\u0E33\u0E17\u0E35\u0E48\u0E40\u0E14\u0E37\u0E2D\u0E14\u0E1B\u0E38\u0E14\u0E46 \u0E41\u0E2D\u0E48\u0E07\u0E1E\u0E34\u0E29\u0E1C\u0E38\u0E14\u0E02\u0E36\u0E49\u0E19\u0E21\u0E32\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E22\u0E46 \u0E22\u0E37\u0E19\u0E41\u0E0A\u0E48\u0E19\u0E32\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E08\u0E30\u0E04\u0E48\u0E2D\u0E22\u0E46 \u0E25\u0E14",
    mechanicText: "\u0E41\u0E2D\u0E48\u0E07\u0E1E\u0E34\u0E29: \u0E1C\u0E38\u0E14\u0E02\u0E36\u0E49\u0E19\u0E17\u0E38\u0E01 5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E22\u0E37\u0E19\u0E43\u0E19\u0E41\u0E2D\u0E48\u0E07 = \u0E15\u0E34\u0E14\u0E1E\u0E34\u0E29",
    monsters: ["z_bog_toad", "z_spore_puff"],
    boss: "z_hydra_mire",
    rooms: [[["z_bog_toad", 2], ["z_spore_puff", 3]], [["z_spore_puff", 3], ["z_bog_toad", 2], ["z_bog_toad", 1], ["z_spore_puff", 2]], "boss"]
  },
  {
    id: "z4",
    n: 4,
    name: "\u0E0B\u0E32\u0E01\u0E1B\u0E23\u0E32\u0E2A\u0E32\u0E17\u0E40\u0E07\u0E32",
    level: 12,
    tier: 1,
    theme: "shadow",
    mechanic: "dark",
    desc: "\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E01\u0E25\u0E37\u0E19\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E2D\u0E01\u0E23\u0E31\u0E28\u0E21\u0E35\u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E21\u0E37\u0E2D\u0E40\u0E07\u0E32\u0E42\u0E1C\u0E25\u0E48\u0E08\u0E32\u0E01\u0E1E\u0E37\u0E49\u0E19\u0E43\u0E15\u0E49\u0E40\u0E17\u0E49\u0E32 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19\u0E23\u0E48\u0E27\u0E21\u0E17\u0E35\u0E21\u0E0A\u0E48\u0E27\u0E22\u0E2A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E44\u0E14\u0E49",
    mechanicText: "\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14: \u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E41\u0E25\u0E30\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E19 \xB7 \u0E21\u0E37\u0E2D\u0E40\u0E07\u0E32\u0E1C\u0E38\u0E14\u0E43\u0E15\u0E49\u0E40\u0E17\u0E49\u0E32\u0E17\u0E38\u0E01 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35",
    monsters: ["z_shade_stalker", "z_bone_lancer"],
    boss: "z_umbral_knight",
    rooms: [[["z_bone_lancer", 2], ["z_shade_stalker", 2]], [["z_shade_stalker", 2], ["z_bone_lancer", 2], ["z_shade_stalker", 2]], "boss"]
  },
  {
    id: "z5",
    n: 5,
    name: "\u0E17\u0E30\u0E40\u0E25\u0E17\u0E23\u0E32\u0E22\u0E40\u0E07\u0E32\u0E41\u0E14\u0E14",
    level: 14,
    tier: 1,
    theme: "dunes",
    mechanic: "sun",
    desc: "\u0E17\u0E23\u0E32\u0E22\u0E14\u0E39\u0E14\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E14\u0E34\u0E19\u0E0A\u0E49\u0E32 \u0E41\u0E25\u0E30\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E08\u0E30\u0E01\u0E27\u0E32\u0E14\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E19\u0E32\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E19\u0E27\u0E22\u0E32\u0E27",
    mechanicText: "\u0E17\u0E23\u0E32\u0E22\u0E14\u0E39\u0E14: \u0E40\u0E14\u0E34\u0E19\u0E0A\u0E49\u0E32\u0E25\u0E07\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07 \xB7 \u0E25\u0E33\u0E41\u0E2A\u0E07\u0E41\u0E14\u0E14\u0E41\u0E1C\u0E14\u0E40\u0E1C\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E19\u0E27\u0E17\u0E38\u0E01 6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35",
    monsters: ["z_sand_burrower", "z_scarab"],
    boss: "z_sphinx_colossus",
    rooms: [[["z_scarab", 4], ["z_sand_burrower", 2]], [["z_sand_burrower", 2], ["z_scarab", 5], ["z_sand_burrower", 2]], "boss"]
  },
  {
    id: "z6",
    n: 6,
    name: "\u0E1B\u0E48\u0E32\u0E40\u0E2B\u0E47\u0E14\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07",
    level: 16,
    tier: 2,
    theme: "glow",
    mechanic: "spores",
    desc: "\u0E40\u0E2B\u0E47\u0E14\u0E22\u0E31\u0E01\u0E29\u0E4C\u0E1E\u0E48\u0E19\u0E2A\u0E1B\u0E2D\u0E23\u0E4C\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30 \u0E17\u0E38\u0E01\u0E14\u0E2D\u0E01\u0E1E\u0E48\u0E19\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E2D\u0E1A \u0E15\u0E49\u0E2D\u0E07\u0E2D\u0E48\u0E32\u0E19\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E43\u0E2B\u0E49\u0E2D\u0E2D\u0E01",
    mechanicText: "\u0E40\u0E2B\u0E47\u0E14\u0E22\u0E31\u0E01\u0E29\u0E4C: \u0E1E\u0E48\u0E19\u0E2A\u0E1B\u0E2D\u0E23\u0E4C\u0E40\u0E1B\u0E47\u0E19\u0E27\u0E07\u0E17\u0E38\u0E01 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 (\u0E40\u0E2B\u0E47\u0E14\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E1E\u0E48\u0E19)",
    monsters: ["z_cap_bouncer", "z_mycel_weaver"],
    boss: "z_mother_morel",
    rooms: [[["z_cap_bouncer", 3], ["z_mycel_weaver", 1]], [["z_mycel_weaver", 2], ["z_cap_bouncer", 3], ["z_mycel_weaver", 2]], "boss"]
  },
  {
    id: "z7",
    n: 7,
    name: "\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32",
    level: 18,
    tier: 2,
    theme: "foundry",
    mechanic: "storm",
    desc: "\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32\u0E25\u0E07\u0E43\u0E19\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21\u0E44\u0E21\u0E48\u0E2B\u0E22\u0E38\u0E14 \u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E08\u0E30\u0E42\u0E14\u0E19\u0E1C\u0E48\u0E32\u0E08\u0E30\u0E21\u0E35\u0E27\u0E07\u0E44\u0E1F\u0E1F\u0E49\u0E32\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E01\u0E48\u0E2D\u0E19",
    mechanicText: "\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32: \u0E1C\u0E48\u0E32\u0E25\u0E07\u0E43\u0E01\u0E25\u0E49\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E17\u0E38\u0E01 2.5 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35",
    monsters: ["z_volt_drone", "z_iron_brute"],
    boss: "z_tesla_titan",
    rooms: [[["z_volt_drone", 3], ["z_iron_brute", 1]], [["z_iron_brute", 2], ["z_volt_drone", 3], ["z_iron_brute", 1]], "boss"]
  },
  {
    id: "z8",
    n: 8,
    name: "\u0E2B\u0E38\u0E1A\u0E40\u0E02\u0E32\u0E25\u0E32\u0E27\u0E32",
    level: 20,
    tier: 2,
    theme: "magma",
    mechanic: "geysers",
    desc: "\u0E1B\u0E25\u0E48\u0E2D\u0E07\u0E25\u0E32\u0E27\u0E32\u0E1B\u0E30\u0E17\u0E38\u0E17\u0E35\u0E25\u0E30\u0E08\u0E38\u0E14\u0E27\u0E19\u0E44\u0E1B\u0E23\u0E2D\u0E1A\u0E2A\u0E19\u0E32\u0E21 \u0E17\u0E34\u0E49\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E44\u0E1F\u0E44\u0E27\u0E49\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E39\u0E48",
    mechanicText: "\u0E1B\u0E25\u0E48\u0E2D\u0E07\u0E25\u0E32\u0E27\u0E32: \u0E1B\u0E30\u0E17\u0E38\u0E27\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E33\u0E14\u0E31\u0E1A \u0E17\u0E34\u0E49\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E44\u0E1F 3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35",
    monsters: ["z_magma_hound", "z_cinder_mortar"],
    boss: "z_rift_drake",
    rooms: [[["z_magma_hound", 3], ["z_cinder_mortar", 1]], [["z_cinder_mortar", 2], ["z_magma_hound", 3], ["z_cinder_mortar", 1]], "boss"]
  },
  {
    id: "z9",
    n: 9,
    name: "\u0E2A\u0E27\u0E19\u0E25\u0E2D\u0E22\u0E1F\u0E49\u0E32",
    level: 22,
    tier: 3,
    theme: "sky",
    mechanic: "void",
    desc: "\u0E2A\u0E27\u0E19\u0E1A\u0E19\u0E40\u0E01\u0E32\u0E30\u0E25\u0E2D\u0E22\u0E1F\u0E49\u0E32 \u0E41\u0E1C\u0E48\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E1A\u0E32\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E08\u0E30\u0E1E\u0E31\u0E07\u0E25\u0E07\u0E2A\u0E39\u0E48\u0E04\u0E27\u0E32\u0E21\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E2D\u0E22\u0E48\u0E32\u0E22\u0E37\u0E19\u0E1A\u0E19\u0E41\u0E1C\u0E48\u0E19\u0E17\u0E35\u0E48\u0E01\u0E30\u0E1E\u0E23\u0E34\u0E1A",
    mechanicText: "\u0E1E\u0E37\u0E49\u0E19\u0E1E\u0E31\u0E07: \u0E41\u0E1C\u0E48\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E01\u0E30\u0E1E\u0E23\u0E34\u0E1A 1.4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E41\u0E25\u0E49\u0E27\u0E1E\u0E31\u0E07 \u0E43\u0E04\u0E23\u0E22\u0E37\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E08\u0E30\u0E23\u0E48\u0E27\u0E07",
    monsters: ["z_feather_monk", "z_cloud_ray"],
    boss: "z_seraph_warden",
    rooms: [[["z_feather_monk", 2], ["z_cloud_ray", 2]], [["z_cloud_ray", 2], ["z_feather_monk", 2], ["z_cloud_ray", 2]], "boss"]
  },
  {
    id: "z10",
    n: 10,
    name: "\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32",
    level: 25,
    tier: 3,
    theme: "throne",
    mechanic: "ashstorm",
    desc: "\u0E2B\u0E49\u0E2D\u0E07\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E16\u0E49\u0E32 \u0E1E\u0E32\u0E22\u0E38\u0E40\u0E16\u0E49\u0E32\u0E1A\u0E14\u0E1A\u0E31\u0E07\u0E2A\u0E32\u0E22\u0E15\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E25\u0E2D\u0E01 \u0E41\u0E25\u0E30\u0E40\u0E16\u0E49\u0E32\u0E16\u0E48\u0E32\u0E19\u0E23\u0E48\u0E27\u0E07\u0E25\u0E07\u0E21\u0E32\u0E44\u0E21\u0E48\u0E2B\u0E22\u0E38\u0E14",
    mechanicText: "\u0E1E\u0E32\u0E22\u0E38\u0E40\u0E16\u0E49\u0E32: \u0E21\u0E37\u0E14\u0E25\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E25\u0E2D\u0E01 \xB7 \u0E16\u0E48\u0E32\u0E19\u0E23\u0E48\u0E27\u0E07\u0E15\u0E32\u0E21\u0E15\u0E31\u0E27\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19",
    monsters: ["z_ash_revenant", "z_cinder_mage"],
    boss: "z_ash_sovereign",
    rooms: [[["z_ash_revenant", 2], ["z_cinder_mage", 2]], [["z_cinder_mage", 2], ["z_ash_revenant", 3], ["z_cinder_mage", 1]], "boss"]
  },
  // v8: two lands past the Ashen Throne
  {
    id: "z11",
    n: 11,
    name: "\u0E40\u0E2B\u0E27\u0E01\u0E23\u0E30\u0E08\u0E01\u0E41\u0E15\u0E01",
    level: 28,
    tier: 3,
    theme: "mirror",
    mechanic: "mirror",
    desc: "\u0E40\u0E2B\u0E27\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E1C\u0E19\u0E31\u0E07\u0E17\u0E38\u0E01\u0E14\u0E49\u0E32\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E30\u0E08\u0E01\u0E41\u0E15\u0E01 \u0E40\u0E07\u0E32\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E22\u0E37\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E35\u0E01\u0E1D\u0E31\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E19\u0E32\u0E21 \u0E41\u0E25\u0E30\u0E21\u0E31\u0E19\u0E22\u0E34\u0E07\u0E41\u0E2A\u0E07\u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E2B\u0E32\u0E04\u0E38\u0E13\u0E40\u0E2A\u0E21\u0E2D",
    mechanicText: "\u0E40\u0E07\u0E32\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19: \u0E41\u0E2A\u0E07\u0E1E\u0E38\u0E48\u0E07\u0E08\u0E32\u0E01\u0E40\u0E07\u0E32\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E1D\u0E31\u0E48\u0E07\u0E15\u0E23\u0E07\u0E02\u0E49\u0E32\u0E21\u0E2A\u0E19\u0E32\u0E21\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E32\u0E15\u0E31\u0E27\u0E04\u0E38\u0E13 (\u0E21\u0E35\u0E40\u0E2A\u0E49\u0E19\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E01\u0E48\u0E2D\u0E19) \xB7 \u0E1A\u0E32\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E32\u0E01\u0E1A\u0E32\u0E17",
    monsters: ["z_mirror_wisp", "z_glass_golem"],
    boss: "z_mirror_queen",
    rooms: [[["z_mirror_wisp", 3], ["z_glass_golem", 1]], [["z_glass_golem", 2], ["z_mirror_wisp", 3], ["z_mirror_wisp", 2]], [["z_mirror_wisp", 2], ["z_glass_golem", 2], ["z_mirror_wisp", 2]], "boss"]
  },
  {
    id: "z12",
    n: 12,
    name: "\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A",
    level: 31,
    tier: 3,
    theme: "eclipse",
    mechanic: "eclipse",
    desc: "\u0E2B\u0E49\u0E2D\u0E07\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E1A\u0E19\u0E22\u0E2D\u0E14\u0E1F\u0E49\u0E32\u0E17\u0E35\u0E48\u0E14\u0E27\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E16\u0E39\u0E01\u0E01\u0E25\u0E37\u0E19\u0E04\u0E23\u0E36\u0E48\u0E07\u0E14\u0E27\u0E07 \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E32\u0E2A\u0E40\u0E15\u0E47\u0E21\u0E14\u0E27\u0E07 \u0E17\u0E31\u0E49\u0E07\u0E2A\u0E19\u0E32\u0E21\u0E08\u0E30\u0E21\u0E37\u0E14\u0E2A\u0E19\u0E34\u0E17\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27",
    mechanicText: "\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A: \u0E17\u0E38\u0E01 14 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E01\u0E25\u0E37\u0E19\u0E2A\u0E19\u0E32\u0E21 \u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E27\u0E07\u0E41\u0E2A\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E27\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27 \u0E22\u0E37\u0E19\u0E19\u0E2D\u0E01\u0E41\u0E2A\u0E07 = \u0E42\u0E14\u0E19\u0E40\u0E1C\u0E32",
    monsters: ["z_eclipse_hound", "z_corona_priest"],
    boss: "z_eclipse_king",
    rooms: [[["z_eclipse_hound", 3], ["z_corona_priest", 1]], [["z_corona_priest", 2], ["z_eclipse_hound", 3], ["z_eclipse_hound", 2]], [["z_eclipse_hound", 2], ["z_corona_priest", 2], ["z_eclipse_hound", 2]], "boss"]
  }
]);
var RAIDS = Object.freeze([
  {
    id: "r1",
    n: 11,
    raid: true,
    name: "\u0E23\u0E31\u0E07\u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18",
    level: 24,
    tier: 3,
    theme: "wrath",
    mechanic: "eruption",
    respawnMs: 30 * 60 * 1e3,
    requires: { zone: "z6", level: 20 },
    desc: "\u0E1B\u0E25\u0E48\u0E2D\u0E07\u0E20\u0E39\u0E40\u0E02\u0E32\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E1A\u0E43\u0E2B\u0E25\u0E21\u0E32\u0E1E\u0E31\u0E19\u0E1B\u0E35 \u0E17\u0E38\u0E01\u0E2A\u0E32\u0E21\u0E2A\u0E34\u0E1A\u0E19\u0E32\u0E17\u0E35\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E43\u0E15\u0E49\u0E25\u0E32\u0E27\u0E32\u0E08\u0E30\u0E40\u0E15\u0E49\u0E19\u0E41\u0E23\u0E07\u0E1E\u0E2D\u0E43\u0E2B\u0E49\u0E21\u0E31\u0E07\u0E01\u0E23\u0E15\u0E37\u0E48\u0E19\u0E02\u0E36\u0E49\u0E19\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07",
    mechanicText: "\u0E25\u0E32\u0E27\u0E32\u0E1B\u0E30\u0E17\u0E38: \u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01\u0E1A\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E1E\u0E48\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07 \xB7 \u0E1A\u0E2D\u0E2A\u0E22\u0E34\u0E48\u0E07\u0E40\u0E08\u0E47\u0E1A\u0E22\u0E34\u0E48\u0E07\u0E40\u0E23\u0E47\u0E27",
    monsters: [],
    boss: "r_wrath_dragon",
    rooms: ["boss"],
    lore: [
      { t: "\u0E2D\u0E31\u0E04\u0E19\u0E34\u0E27\u0E32\u0E23 \u0E1C\u0E39\u0E49\u0E40\u0E1D\u0E49\u0E32\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F", b: "\u0E19\u0E32\u0E19\u0E21\u0E32\u0E41\u0E25\u0E49\u0E27 \u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C\u0E2A\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07 \u0E2D\u0E31\u0E04\u0E19\u0E34\u0E27\u0E32\u0E23\u0E40\u0E1D\u0E49\u0E32\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E1B\u0E48\u0E32\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19\u0E43\u0E19\u0E24\u0E14\u0E39\u0E2B\u0E19\u0E32\u0E27 \u0E2A\u0E48\u0E27\u0E19\u0E19\u0E49\u0E2D\u0E07\u0E2A\u0E32\u0E27\u0E19\u0E34\u0E21\u0E34\u0E15\u0E23\u0E32\u0E40\u0E1D\u0E49\u0E32\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E1A\u0E2D\u0E01\u0E24\u0E14\u0E39\u0E01\u0E32\u0E25 \u0E17\u0E31\u0E49\u0E07\u0E2A\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2B\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19\u0E40\u0E01\u0E34\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E04\u0E33\u0E23\u0E32\u0E21" },
      { t: "\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E44\u0E1F\u0E16\u0E39\u0E01\u0E02\u0E31\u0E07", b: "\u0E04\u0E37\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E19\u0E34\u0E21\u0E34\u0E15\u0E23\u0E32\u0E40\u0E2B\u0E47\u0E19\u0E19\u0E34\u0E21\u0E34\u0E15 \u0E44\u0E1F\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E0A\u0E32\u0E22\u0E08\u0E30\u0E40\u0E1C\u0E32\u0E1B\u0E48\u0E32\u0E17\u0E31\u0E49\u0E07\u0E1C\u0E37\u0E19 \u0E40\u0E18\u0E2D\u0E08\u0E36\u0E07\u0E1C\u0E19\u0E36\u0E01\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E02\u0E2D\u0E07\u0E40\u0E02\u0E32\u0E44\u0E27\u0E49\u0E43\u0E15\u0E49\u0E20\u0E39\u0E40\u0E02\u0E32\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E1A\u0E2D\u0E01\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25 \u0E2D\u0E31\u0E04\u0E19\u0E34\u0E27\u0E32\u0E23\u0E15\u0E37\u0E48\u0E19\u0E02\u0E36\u0E49\u0E19\u0E43\u0E19\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14 \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E48\u0E32\u0E19\u0E49\u0E2D\u0E07\u0E2A\u0E32\u0E27\u0E17\u0E23\u0E22\u0E28\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E2D\u0E22\u0E32\u0E01\u0E04\u0E23\u0E2D\u0E07\u0E1B\u0E48\u0E32\u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27" },
      { t: "\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E14\u0E31\u0E1A", b: "\u0E04\u0E27\u0E32\u0E21\u0E41\u0E04\u0E49\u0E19\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E02\u0E2D\u0E07\u0E40\u0E02\u0E32\u0E23\u0E49\u0E2D\u0E19\u0E02\u0E36\u0E49\u0E19\u0E17\u0E38\u0E01\u0E1B\u0E35 \u0E08\u0E19\u0E25\u0E32\u0E27\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E44\u0E2B\u0E25\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E40\u0E2D\u0E07 \u0E40\u0E02\u0E32\u0E15\u0E37\u0E48\u0E19\u0E17\u0E38\u0E01\u0E2A\u0E32\u0E21\u0E2A\u0E34\u0E1A\u0E19\u0E32\u0E17\u0E35\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E19\u0E49\u0E2D\u0E07\u0E2A\u0E32\u0E27 \u0E41\u0E25\u0E30\u0E40\u0E1C\u0E32\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E02\u0E27\u0E32\u0E07\u0E17\u0E32\u0E07 \u0E16\u0E49\u0E32\u0E43\u0E04\u0E23\u0E40\u0E2D\u0E32\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E19\u0E31\u0E49\u0E19\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E44\u0E14\u0E49 \u0E1A\u0E32\u0E07\u0E17\u0E35\u0E04\u0E27\u0E32\u0E21\u0E41\u0E04\u0E49\u0E19\u0E2D\u0E32\u0E08\u0E44\u0E14\u0E49\u0E1E\u0E31\u0E01" }
    ]
  },
  {
    id: "r2",
    n: 12,
    raid: true,
    name: "\u0E2B\u0E2D\u0E14\u0E32\u0E27\u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C",
    level: 26,
    tier: 3,
    theme: "prophecy",
    mechanic: "starfall",
    requires: { raid: "r1", level: 23 },
    desc: "\u0E2B\u0E2D\u0E04\u0E2D\u0E22\u0E25\u0E2D\u0E22\u0E1F\u0E49\u0E32\u0E17\u0E35\u0E48\u0E14\u0E32\u0E27\u0E17\u0E38\u0E01\u0E14\u0E27\u0E07\u0E04\u0E37\u0E2D\u0E04\u0E33\u0E17\u0E33\u0E19\u0E32\u0E22\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E14 \u0E19\u0E34\u0E21\u0E34\u0E15\u0E23\u0E32\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E01\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E08\u0E30\u0E04\u0E34\u0E14\u0E40\u0E2A\u0E35\u0E22\u0E2D\u0E35\u0E01",
    mechanicText: '\u0E14\u0E32\u0E27\u0E15\u0E01: \u0E27\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E25\u0E47\u0E07\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13 "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E30\u0E44\u0E1B" \xB7 \u0E40\u0E07\u0E32\u0E19\u0E34\u0E21\u0E34\u0E15\u0E40\u0E25\u0E35\u0E22\u0E19\u0E41\u0E1A\u0E1A\u0E17\u0E48\u0E32\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E1A\u0E2D\u0E2A',
    monsters: [],
    boss: "r_prophecy_dragon",
    rooms: ["boss"],
    lore: [
      { t: "\u0E19\u0E34\u0E21\u0E34\u0E15\u0E23\u0E32 \u0E1C\u0E39\u0E49\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E27\u0E31\u0E19\u0E1E\u0E23\u0E38\u0E48\u0E07\u0E19\u0E35\u0E49", b: "\u0E40\u0E18\u0E2D\u0E23\u0E39\u0E49\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E41\u0E23\u0E01\u0E27\u0E48\u0E32\u0E01\u0E32\u0E23\u0E1C\u0E19\u0E36\u0E01\u0E1E\u0E35\u0E48\u0E0A\u0E32\u0E22\u0E08\u0E30\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E02\u0E32\u0E40\u0E01\u0E25\u0E35\u0E22\u0E14\u0E40\u0E18\u0E2D \u0E41\u0E15\u0E48\u0E43\u0E19\u0E17\u0E38\u0E01\u0E2D\u0E19\u0E32\u0E04\u0E15\u0E17\u0E35\u0E48\u0E40\u0E18\u0E2D\u0E40\u0E2B\u0E47\u0E19 \u0E2B\u0E32\u0E01\u0E44\u0E21\u0E48\u0E1C\u0E19\u0E36\u0E01 \u0E1B\u0E48\u0E32\u0E08\u0E30\u0E44\u0E2B\u0E21\u0E49\u0E41\u0E25\u0E30\u0E1E\u0E35\u0E48\u0E0A\u0E32\u0E22\u0E08\u0E30\u0E15\u0E32\u0E22\u0E43\u0E19\u0E01\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E19\u0E31\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22" },
      { t: "\u0E23\u0E32\u0E04\u0E32\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E23\u0E39\u0E49\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32", b: "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E21\u0E2D\u0E07\u0E2D\u0E19\u0E32\u0E04\u0E15 \u0E14\u0E27\u0E07\u0E15\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E18\u0E2D\u0E08\u0E30\u0E02\u0E38\u0E48\u0E19\u0E25\u0E07 \u0E40\u0E18\u0E2D\u0E08\u0E36\u0E07\u0E02\u0E31\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E43\u0E19\u0E2B\u0E2D\u0E14\u0E32\u0E27\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1D\u0E49\u0E32\u0E14\u0E39\u0E1C\u0E19\u0E36\u0E01\u0E08\u0E32\u0E01\u0E17\u0E35\u0E48\u0E44\u0E01\u0E25 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E43\u0E2B\u0E49\u0E43\u0E04\u0E23\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E43\u0E01\u0E25\u0E49\u0E1E\u0E2D\u0E08\u0E30\u0E16\u0E32\u0E21\u0E27\u0E48\u0E32\u0E17\u0E33\u0E44\u0E21" },
      { t: "\u0E04\u0E33\u0E17\u0E33\u0E19\u0E32\u0E22\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22", b: "\u0E19\u0E34\u0E21\u0E34\u0E15\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E40\u0E18\u0E2D\u0E04\u0E37\u0E2D\u0E14\u0E32\u0E1A\u0E2A\u0E2D\u0E07\u0E40\u0E25\u0E48\u0E21 \u0E40\u0E25\u0E48\u0E21\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E15\u0E35\u0E08\u0E32\u0E01\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48 \u0E40\u0E25\u0E48\u0E21\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E08\u0E32\u0E01\u0E14\u0E27\u0E07\u0E15\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E18\u0E2D \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E2D\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E21\u0E37\u0E2D\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19 \u0E04\u0E27\u0E32\u0E21\u0E41\u0E04\u0E49\u0E19\u0E01\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E27\u0E31\u0E07\u0E08\u0E30\u0E44\u0E14\u0E49\u0E40\u0E14\u0E34\u0E19\u0E40\u0E04\u0E35\u0E22\u0E07\u0E01\u0E31\u0E19\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07" }
    ]
  },
  {
    id: "r3",
    n: 13,
    raid: true,
    name: "\u0E25\u0E32\u0E19\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1F\u0E32\u0E01\u0E1F\u0E49\u0E32",
    level: 28,
    tier: 3,
    theme: "judgment",
    mechanic: "verdict",
    requires: { raid: "r2", zone: "z10", level: 26 },
    desc: "\u0E25\u0E32\u0E19\u0E2B\u0E34\u0E19\u0E02\u0E32\u0E27\u0E40\u0E2B\u0E19\u0E37\u0E2D\u0E40\u0E21\u0E06\u0E17\u0E35\u0E48\u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E17\u0E38\u0E01\u0E0A\u0E35\u0E27\u0E34\u0E15 \u0E43\u0E04\u0E23\u0E41\u0E1A\u0E01\u0E1A\u0E32\u0E1B\u0E21\u0E32\u0E01\u0E40\u0E01\u0E34\u0E19\u0E08\u0E30\u0E16\u0E39\u0E01\u0E40\u0E2A\u0E32\u0E41\u0E2A\u0E07\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19",
    mechanicText: "\u0E04\u0E33\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19: \u0E0A\u0E48\u0E2D\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E1A\u0E32\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E16\u0E39\u0E01\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32 (\u0E22\u0E37\u0E19\u0E1C\u0E34\u0E14\u0E0A\u0E48\u0E2D\u0E07 = \u0E42\u0E14\u0E19\u0E40\u0E2A\u0E32\u0E41\u0E2A\u0E07) \xB7 \u0E1F\u0E31\u0E19\u0E14\u0E32\u0E1A\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E1E\u0E23\u0E4C\u0E23\u0E35\u0E48\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19",
    monsters: [],
    boss: "r_judgment_god",
    rooms: ["boss"],
    lore: [
      { t: "\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E0A\u0E31\u0E48\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E1F\u0E49\u0E32", b: "\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2A\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07\u0E21\u0E31\u0E07\u0E01\u0E23\u0E17\u0E30\u0E40\u0E25\u0E32\u0E30\u0E01\u0E31\u0E19\u0E08\u0E19\u0E1B\u0E48\u0E32\u0E41\u0E17\u0E1A\u0E44\u0E2B\u0E21\u0E49 \u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E25\u0E07\u0E21\u0E32\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19 \u0E44\u0E21\u0E48\u0E40\u0E02\u0E49\u0E32\u0E02\u0E49\u0E32\u0E07\u0E43\u0E04\u0E23 \u0E40\u0E1E\u0E23\u0E32\u0E30\u0E04\u0E27\u0E32\u0E21\u0E22\u0E38\u0E15\u0E34\u0E18\u0E23\u0E23\u0E21\u0E02\u0E2D\u0E07\u0E40\u0E02\u0E32\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E43\u0E2B\u0E49\u0E40\u0E2D\u0E19\u0E40\u0E2D\u0E35\u0E22\u0E07" },
      { t: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E1E\u0E25\u0E32\u0E14", b: "\u0E40\u0E04\u0E35\u0E22\u0E27\u0E2A\u0E27\u0E23\u0E23\u0E04\u0E4C\u0E02\u0E2D\u0E07\u0E40\u0E02\u0E32\u0E15\u0E31\u0E14\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07 \u0E22\u0E01\u0E40\u0E27\u0E49\u0E19\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E08\u0E23\u0E34\u0E07\u0E46 \u0E27\u0E48\u0E32\u0E01\u0E31\u0E19\u0E27\u0E48\u0E32\u0E21\u0E35\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E43\u0E19\u0E1E\u0E31\u0E19\u0E04\u0E19\u0E17\u0E35\u0E48\u0E08\u0E30\u0E44\u0E14\u0E49\u0E40\u0E2B\u0E47\u0E19\u0E21\u0E31\u0E19\u0E2B\u0E25\u0E38\u0E14\u0E08\u0E32\u0E01\u0E21\u0E37\u0E2D\u0E40\u0E17\u0E1E" }
    ]
  }
]);
var RUSH = Object.freeze({ id: "rush", bosses: 5, level: 32, requires: { zone: "z10", level: 28 } });
var RUSH_POOL = ["z_storm_roc", "z_glacier_wyrm", "z_hydra_mire", "z_umbral_knight", "z_sphinx_colossus", "z_mother_morel", "z_tesla_titan", "z_rift_drake", "z_seraph_warden", "z_ash_sovereign", "z_mirror_queen", "z_eclipse_king"];
var rushDay = (now = Date.now()) => Math.floor(now / 864e5);
function rushLineup(day = rushDay()) {
  const pool = RUSH_POOL.slice();
  let h = day * 2654435761 >>> 0;
  const out = [];
  for (let i = 0; i < RUSH.bosses; i++) {
    h = Math.imul(h ^ h >>> 15, 2246822507) + 2654435769 >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  out.sort((a, b) => RUSH_POOL.indexOf(a) - RUSH_POOL.indexOf(b));
  return out;
}
function rushZone(day = rushDay()) {
  const line = rushLineup(day);
  return {
    id: RUSH.id,
    n: 30,
    rush: true,
    name: "\u0E25\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E25\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1A\u0E2D\u0E2A",
    level: RUSH.level,
    tier: 3,
    theme: "arena",
    mechanic: "none",
    requires: RUSH.requires,
    desc: "\u0E25\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E25\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E04\u0E38\u0E21\u0E17\u0E38\u0E01\u0E14\u0E34\u0E19\u0E41\u0E14\u0E19\u0E16\u0E39\u0E01\u0E40\u0E23\u0E35\u0E22\u0E01\u0E21\u0E32\u0E2A\u0E39\u0E49\u0E17\u0E35\u0E25\u0E30\u0E15\u0E19 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E39\u0E01\u0E19\u0E49\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E1E\u0E31\u0E01 \u0E21\u0E35\u0E41\u0E15\u0E48\u0E1A\u0E2D\u0E2A\u0E15\u0E48\u0E2D\u0E1A\u0E2D\u0E2A \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E2D\u0E2A\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E17\u0E38\u0E01\u0E27\u0E31\u0E19",
    mechanicText: "\u0E1A\u0E2D\u0E2A\u0E2B\u0E49\u0E32\u0E15\u0E19\u0E15\u0E34\u0E14\u0E01\u0E31\u0E19 \u0E17\u0E38\u0E01\u0E15\u0E19\u0E41\u0E01\u0E23\u0E48\u0E07\u0E40\u0E17\u0E48\u0E32\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E25\u0E32\u0E19 \xB7 \u0E1F\u0E37\u0E49\u0E19 25% \u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1A\u0E2D\u0E2A",
    monsters: [],
    boss: line[line.length - 1],
    lineup: line,
    secretBoss: "z_rush_shadow",
    rooms: line.map((id) => [[id, 1]])
  };
}
var ALL_AREAS = [...ZONES, ...RAIDS];
function getZone(id) {
  if (id === RUSH.id) return rushZone();
  return ALL_AREAS.find((z) => z.id === id) || null;
}
var isRaid = (id) => RAIDS.some((r) => r.id === id);
function mk(id, zoneIdx, name, o) {
  const z = ZONES[zoneIdx];
  const base = zoneStats(z.level);
  const boss = !!o.boss;
  const hpM = o.hp ?? 1, atkM = o.atk ?? 1;
  return [id, Object.freeze({
    id,
    name,
    sprite: id,
    zone: z.id,
    boss,
    faces: o.faces ?? true,
    particles: o.particles,
    hp: Math.round(base.hp * hpM * (boss ? 16 : 1)),
    atk: Math.round(base.atk * atkM * (boss ? 1.25 : 1)),
    def: Math.round(base.def * (o.def ?? 1) * (boss ? 1.4 : 1)),
    speed: o.speed,
    radius: o.radius,
    mass: o.mass ?? (boss ? 8 : 1),
    xp: Math.round(base.xp * (boss ? 14 : o.xp ?? 1)),
    gold: boss ? [base.gold[0] * 10, base.gold[1] * 10] : base.gold,
    sparks: boss ? 4 + z.tier * 2 : 0,
    interruptAt: o.interruptAt,
    scale: o.scale,
    flying: !!o.flying,
    split: o.split || null,
    guardFront: o.guardFront || 0,
    revive: !!o.revive,
    ai: o.ai,
    ai_params: Object.freeze(o.p || {}),
    drops: boss ? bossDrops(z.tier, o.legendary, z.id) : monsterDrops(z.tier, z.id)
  })];
}
function mkRaid(id, raidIdx, name, o) {
  const z = RAIDS[raidIdx];
  const base = zoneStats(z.level);
  return [id, Object.freeze({
    id,
    name,
    sprite: id,
    zone: z.id,
    boss: true,
    raid: true,
    faces: true,
    particles: o.particles,
    hp: Math.round(base.hp * o.hpMul),
    atk: Math.round(base.atk * o.atkMul),
    def: Math.round(base.def * 1.6),
    speed: o.speed,
    radius: o.radius,
    mass: 14,
    xp: Math.round(base.xp * 22),
    gold: [base.gold[0] * 18, base.gold[1] * 18],
    sparks: 14,
    interruptAt: 3,
    flying: !!o.flying,
    ai: o.ai,
    ai_params: Object.freeze(o.p || {}),
    drops: o.drops
  })];
}
var ZONE_ENEMIES = Object.freeze(Object.fromEntries([
  // 1 Gale Meadow
  mk("z_gust_sprite", 0, "\u0E20\u0E39\u0E15\u0E25\u0E21\u0E01\u0E23\u0E14", {
    ai: "zigzag",
    speed: 150,
    radius: 18,
    hp: 0.8,
    particles: ["#cdf3e6", "#9fd6c4", "#ffffff"],
    flying: true,
    faces: false,
    p: { dashes: 3, dashSpeed: 420, dashTime: 0.22, windup: 0.5, dartSpeed: 620, dartTime: 0.35, rest: 0.7 }
  }),
  mk("z_seed_spitter", 0, "\u0E1A\u0E38\u0E1B\u0E1C\u0E32\u0E1E\u0E48\u0E19\u0E40\u0E21\u0E25\u0E47\u0E14", {
    ai: "turret_burrow",
    speed: 0,
    radius: 22,
    hp: 1.1,
    mass: 99,
    particles: ["#6f9a4a", "#d6ef8a", "#e8c34a"],
    faces: false,
    p: { windup: 0.6, shots: 3, spread: 0.35, shotSpeed: 330, volleys: 3, gap: 1.3, burrowTime: 1, emergeRadius: 70 }
  }),
  mk("z_storm_roc", 0, "\u0E23\u0E32\u0E0A\u0E31\u0E19\u0E19\u0E01\u0E1E\u0E32\u0E22\u0E38", {
    boss: true,
    ai: "storm_roc",
    speed: 120,
    radius: 60,
    particles: ["#d9e8f6", "#8aa6c8", "#f5d48a"],
    flying: true,
    legendary: "w_tempest_saber",
    p: { diveTelegraph: 0.8, diveSpeed: 900, dives: 3, fanCount: 9, fanSpread: 1.1, shotSpeed: 360, tornadoLife: 6, rest: 1.1 }
  }),
  // 2 Frost Crystal Cave
  mk("z_frost_slime", 1, "\u0E2A\u0E44\u0E25\u0E21\u0E4C\u0E1C\u0E25\u0E36\u0E01\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07", {
    ai: "hopper",
    speed: 70,
    radius: 24,
    hp: 1.2,
    particles: ["#bfe8ff", "#8fd0f0", "#ffffff"],
    faces: false,
    split: { id: "z_frost_mote", count: 2 },
    p: { hopEvery: 1.1, hopTime: 0.4, hopSpeed: 300, contactRange: 36 }
  }),
  mk("z_frost_mote", 1, "\u0E1C\u0E25\u0E36\u0E01\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E19\u0E49\u0E2D\u0E22", {
    ai: "hopper",
    speed: 90,
    radius: 14,
    hp: 0.35,
    xp: 0.3,
    scale: 0.6,
    particles: ["#bfe8ff", "#ffffff"],
    faces: false,
    p: { hopEvery: 0.7, hopTime: 0.3, hopSpeed: 340, contactRange: 26 }
  }),
  mk("z_ice_archer", 1, "\u0E1E\u0E25\u0E18\u0E19\u0E39\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07", {
    ai: "sniper",
    speed: 95,
    radius: 20,
    hp: 0.9,
    particles: ["#bfe8ff", "#5f8fb8", "#ffffff"],
    p: { keepAway: 360, aim: 0.95, shotSpeed: 720, pierce: true, pool: "ice", cooldown: 2.2 }
  }),
  mk("z_glacier_wyrm", 1, "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E18\u0E32\u0E23\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07", {
    boss: true,
    ai: "glacier_wyrm",
    speed: 110,
    radius: 62,
    particles: ["#e8f8ff", "#8fc4e8", "#ffffff"],
    faces: true,
    legendary: "w_glacier_fang",
    p: { burrowTime: 1.4, emergeTelegraph: 0.95, emergeRadius: 140, breathTelegraph: 0.8, breathRange: 380, breathArc: 0.9, ringCount: 16, shotSpeed: 300, rest: 1 }
  }),
  // 3 Venom Marsh
  mk("z_bog_toad", 2, "\u0E04\u0E32\u0E07\u0E04\u0E01\u0E1A\u0E36\u0E07\u0E1E\u0E34\u0E29", {
    ai: "tongue",
    speed: 80,
    radius: 26,
    hp: 1.3,
    particles: ["#b8d070", "#6a8a3a", "#c27ff0"],
    faces: false,
    p: { range: 330, windup: 0.75, tongueWidth: 34, pull: -520, hopSpeed: 360, hopTime: 0.35, rest: 0.9 }
  }),
  mk("z_spore_puff", 2, "\u0E1E\u0E2D\u0E07\u0E2A\u0E1B\u0E2D\u0E23\u0E4C", {
    ai: "bomber",
    speed: 70,
    radius: 20,
    hp: 0.6,
    particles: ["#ecd2ff", "#b07ad0", "#e8ff9a"],
    faces: false,
    flying: true,
    p: { trigger: 110, swell: 0.95, blast: 120, poolR: 90, poolT: 4 }
  }),
  mk("z_hydra_mire", 2, "\u0E44\u0E2E\u0E14\u0E23\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1A\u0E36\u0E07", {
    boss: true,
    ai: "hydra",
    speed: 0,
    radius: 70,
    mass: 99,
    particles: ["#b8e08a", "#5a8a4a", "#c27ff0"],
    faces: false,
    legendary: "w_hydra_kiss",
    p: { spitEvery: 0.55, spitSpeed: 380, volley: 6, submergeTime: 1.6, waveTelegraph: 0.8, waveRadii: [130, 240, 350], waveGap: 0.55, summon: "z_spore_puff" }
  }),
  // 4 Shadow Ruins
  mk("z_shade_stalker", 3, "\u0E19\u0E31\u0E01\u0E06\u0E48\u0E32\u0E40\u0E07\u0E32", {
    ai: "blink_assassin",
    speed: 120,
    radius: 20,
    hp: 0.9,
    atk: 1.2,
    particles: ["#9a8ad0", "#3a3450", "#c27ff0"],
    p: { fade: 1.6, windup: 0.5, slashRange: 120, slashArc: 1.6, recover: 0.8 }
  }),
  mk("z_bone_lancer", 3, "\u0E2D\u0E31\u0E28\u0E27\u0E34\u0E19\u0E01\u0E23\u0E30\u0E14\u0E39\u0E01\u0E17\u0E27\u0E19", {
    ai: "lancer",
    speed: 85,
    radius: 22,
    hp: 1.3,
    particles: ["#f3ead2", "#c8bca0", "#8e2c21"],
    interruptAt: 1.6,
    p: { range: 260, windup: 0.8, thrustLen: 360, thrustWidth: 44, thrustTime: 0.28, recover: 1 }
  }),
  mk("z_umbral_knight", 3, "\u0E2D\u0E31\u0E28\u0E27\u0E34\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E14\u0E31\u0E1A", {
    boss: true,
    ai: "umbral_knight",
    speed: 140,
    radius: 52,
    particles: ["#e0b0ff", "#2a2438", "#c27ff0"],
    legendary: "w_umbral_greatblade",
    p: { slashTelegraph: 0.7, slashLen: 420, slashWidth: 70, slashes: 3, pulseRadius: 260, pulseTelegraph: 1, summon: "z_shade_stalker", rest: 1 }
  }),
  // 5 Sunscorch Dunes
  mk("z_sand_burrower", 4, "\u0E14\u0E49\u0E27\u0E07\u0E21\u0E38\u0E14\u0E17\u0E23\u0E32\u0E22", {
    ai: "burrower",
    speed: 170,
    radius: 24,
    hp: 1.2,
    particles: ["#f0d89a", "#c8a060", "#6a4a24"],
    interruptAt: 1.5,
    p: { travel: 1.6, emergeTelegraph: 0.8, emergeRadius: 85, spitCount: 5, spitSpeed: 300, exposed: 1.8 }
  }),
  mk("z_scarab", 4, "\u0E41\u0E21\u0E25\u0E07\u0E1B\u0E35\u0E01\u0E41\u0E02\u0E47\u0E07\u0E40\u0E17\u0E2D\u0E23\u0E4C\u0E04\u0E27\u0E2D\u0E22\u0E0B\u0E4C", {
    ai: "swarm",
    speed: 210,
    radius: 14,
    hp: 0.45,
    xp: 0.5,
    scale: 0.75,
    particles: ["#7fd0c0", "#2f6a6a", "#f5d48a"],
    flying: true,
    p: { orbit: 140, orbitTime: 2.2, dashSpeed: 560, dashTime: 0.3, windup: 0.35 }
  }),
  mk("z_sphinx_colossus", 4, "\u0E2A\u0E1F\u0E34\u0E07\u0E0B\u0E4C\u0E22\u0E31\u0E01\u0E29\u0E4C\u0E41\u0E2B\u0E48\u0E07\u0E40\u0E19\u0E34\u0E19\u0E17\u0E23\u0E32\u0E22", {
    boss: true,
    ai: "sphinx",
    speed: 60,
    radius: 70,
    mass: 99,
    particles: ["#f3dca0", "#c8a46a", "#7fe8ff"],
    faces: false,
    legendary: "w_sunspire_staff",
    p: { beamTelegraph: 1, beamLen: 760, beamWidth: 46, beamSweep: 2.2, beamSteps: 11, pillarCount: 6, pillarRadius: 70, pillarTelegraph: 1, rest: 1.2 }
  }),
  // 6 Glowcap Grove
  mk("z_cap_bouncer", 5, "\u0E40\u0E2B\u0E47\u0E14\u0E40\u0E14\u0E49\u0E07", {
    ai: "ricochet",
    speed: 0,
    radius: 24,
    hp: 1.1,
    particles: ["#ffd0e0", "#d06a8a", "#ff7aa8"],
    faces: false,
    p: { windup: 0.7, speed: 560, bounces: 3, travel: 2.4, dizzy: 1.3 }
  }),
  mk("z_mycel_weaver", 5, "\u0E41\u0E21\u0E07\u0E21\u0E38\u0E21\u0E43\u0E22\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07", {
    ai: "weaver",
    speed: 120,
    radius: 20,
    hp: 0.9,
    particles: ["#c8b8ff", "#6a5aa8", "#9fffd8"],
    p: { keepAway: 260, webEvery: 2.6, webTelegraph: 0.9, webRadius: 75, webT: 4, strandSpeed: 260 }
  }),
  mk("z_mother_morel", 5, "\u0E21\u0E32\u0E23\u0E14\u0E32\u0E40\u0E2B\u0E47\u0E14\u0E23\u0E32\u0E0A\u0E34\u0E19\u0E35", {
    boss: true,
    ai: "morel",
    speed: 70,
    radius: 64,
    particles: ["#f0d0ff", "#a86ad0", "#9fffd8"],
    faces: false,
    flying: true,
    legendary: "w_sporebloom_bow",
    p: { spiralTime: 3.2, spiralRate: 0.09, spiralArms: 3, spiralSpeed: 230, rainCount: 9, rainRadius: 70, rainTelegraph: 1, summon: "z_cap_bouncer", rest: 1.2 }
  }),
  // 7 Thunder Foundry
  mk("z_volt_drone", 6, "\u0E42\u0E14\u0E23\u0E19\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32", {
    ai: "orbit_zapper",
    speed: 160,
    radius: 18,
    hp: 0.8,
    particles: ["#fff07a", "#5a6a80", "#c8d8ea"],
    faces: false,
    flying: true,
    p: { orbit: 200, zapEvery: 2.1, zapTelegraph: 0.65, zapWidth: 26 }
  }),
  mk("z_iron_brute", 6, "\u0E22\u0E31\u0E01\u0E29\u0E4C\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E16\u0E37\u0E2D\u0E42\u0E25\u0E48", {
    ai: "shielded",
    speed: 70,
    radius: 30,
    hp: 1.8,
    atk: 1.2,
    mass: 4,
    particles: ["#b8c0cc", "#6a6f78", "#ffcf5a"],
    guardFront: 0.8,
    interruptAt: 2.2,
    p: { smashRange: 110, smashRadius: 95, windup: 0.9, recover: 1.1 }
  }),
  mk("z_tesla_titan", 6, "\u0E44\u0E17\u0E17\u0E31\u0E19\u0E40\u0E17\u0E2A\u0E25\u0E32", {
    boss: true,
    ai: "tesla",
    speed: 80,
    radius: 66,
    particles: ["#a8c0de", "#4a5a70", "#ffe65a"],
    faces: false,
    legendary: "w_thunder_lance",
    p: { pylons: 3, chainTelegraph: 0.9, chainWidth: 30, ringTelegraph: 0.7, ringRadii: [150, 260, 370, 480], ringGap: 0.45, overloadRadius: 200, rest: 1 }
  }),
  mk("z_pylon", 6, "\u0E40\u0E2A\u0E32\u0E19\u0E33\u0E44\u0E1F\u0E1F\u0E49\u0E32", { ai: "pylon", speed: 0, radius: 22, hp: 0.9, mass: 99, xp: 0.2, particles: ["#ffe65a", "#4a5a70"], faces: false, p: {} }),
  // 8 Magma Rift
  mk("z_magma_hound", 7, "\u0E2A\u0E38\u0E19\u0E31\u0E02\u0E25\u0E32\u0E27\u0E32", {
    ai: "trailblazer",
    speed: 230,
    radius: 22,
    hp: 1,
    particles: ["#ff8a3d", "#6a2a1e", "#ffcf5a"],
    p: { circle: 2, trailEvery: 0.22, trailR: 34, trailT: 2.4, pounceTelegraph: 0.55, pounceSpeed: 700, pounceTime: 0.3 }
  }),
  mk("z_cinder_mortar", 7, "\u0E1B\u0E49\u0E2D\u0E21\u0E1B\u0E37\u0E19\u0E04\u0E23\u0E01\u0E16\u0E48\u0E32\u0E19", {
    ai: "mortar",
    speed: 50,
    radius: 26,
    hp: 1.3,
    mass: 6,
    particles: ["#ff7a33", "#5a4a44", "#ffcf5a"],
    p: { shells: 3, scatter: 110, telegraph: 1.15, blast: 70, cooldown: 2.6, keepAway: 320 }
  }),
  mk("z_rift_drake", 7, "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01", {
    boss: true,
    ai: "drake",
    speed: 130,
    radius: 64,
    particles: ["#ffb35a", "#8e2c21", "#ffe89a"],
    legendary: "a_drakescale",
    p: { breathTelegraph: 0.8, breathSteps: 7, breathArc: 0.7, breathRange: 420, meteorCount: 10, meteorRadius: 75, meteorTelegraph: 1.1, chargeSpeed: 760, chargeTime: 0.7, rest: 1 }
  }),
  // 9 Sky Gardens
  mk("z_feather_monk", 8, "\u0E19\u0E31\u0E01\u0E1E\u0E23\u0E15\u0E02\u0E19\u0E19\u0E01", {
    ai: "counter",
    speed: 130,
    radius: 20,
    hp: 1.1,
    particles: ["#ffffff", "#e8e0c8", "#5fa8ec"],
    p: { guard: 1.6, counterRadius: 130, palmRange: 110, palmArc: 1.2, palms: 3, palmGap: 0.32, windup: 0.4 }
  }),
  mk("z_cloud_ray", 8, "\u0E01\u0E23\u0E30\u0E40\u0E1A\u0E19\u0E40\u0E21\u0E06", {
    ai: "glider",
    speed: 0,
    radius: 26,
    hp: 1,
    particles: ["#f4faff", "#a8c8e8", "#ffe65a"],
    flying: true,
    p: { telegraph: 0.9, glideSpeed: 560, trailDelay: 0.45, trailWidth: 40, rest: 1.4 }
  }),
  mk("z_seraph_warden", 8, "\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C\u0E40\u0E17\u0E27\u0E30", {
    boss: true,
    ai: "seraph",
    speed: 110,
    radius: 58,
    particles: ["#fff3a0", "#f3e6c8", "#e0b45a"],
    flying: true,
    legendary: "c_seraph_feather",
    p: { beamTelegraph: 0.85, beamLen: 900, beamWidth: 50, wheels: 4, wheelLife: 5, petalCount: 20, petalSpeed: 250, rest: 1 }
  }),
  // 10 Ashen Throne
  mk("z_ash_revenant", 9, "\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E40\u0E16\u0E49\u0E32", {
    ai: "revenant",
    speed: 110,
    radius: 22,
    hp: 1.1,
    atk: 1.15,
    particles: ["#ff8a3d", "#4a4440", "#8a827a"],
    revive: true,
    p: { range: 120, windup: 0.45, arc: 1.6, swings: 2, gap: 0.35, recover: 0.9, reviveTime: 3 }
  }),
  mk("z_cinder_mage", 9, "\u0E08\u0E2D\u0E21\u0E40\u0E27\u0E17\u0E16\u0E48\u0E32\u0E19", {
    ai: "homing_caster",
    speed: 100,
    radius: 20,
    hp: 0.9,
    particles: ["#ffcf5a", "#5a2a24", "#ffb35a"],
    p: { keepAway: 300, windup: 0.75, orbs: 3, orbSpeed: 210, homing: 1.7, cooldown: 2.6, blinkRange: 160 }
  }),
  mk("z_ash_sovereign", 9, "\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E40\u0E16\u0E49\u0E32\u0E16\u0E48\u0E32\u0E19", {
    boss: true,
    ai: "sovereign",
    speed: 120,
    radius: 60,
    particles: ["#ff8a3d", "#3a2a24", "#e0b45a"],
    legendary: "c_ember_crown",
    p: { waveTelegraph: 0.75, waveLen: 640, waveWidth: 56, waveFan: 5, waveSpread: 0.9, orbCount: 6, orbSpeed: 230, ringTelegraph: 1.2, rest: 0.9, summon: "z_ash_revenant" }
  }),
  // 11 Shattered Mirror Abyss (v8)
  mk("z_mirror_wisp", 10, "\u0E20\u0E39\u0E15\u0E01\u0E23\u0E30\u0E08\u0E01\u0E40\u0E07\u0E32", {
    ai: "mirror_wisp",
    speed: 120,
    radius: 18,
    hp: 0.85,
    particles: ["#e8f4ff", "#7fe8ff", "#ffffff"],
    flying: true,
    faces: false,
    p: { blinkEvery: 2.8, aim: 0.75, shots: 3, spread: 0.22, shotSpeed: 520, keepAway: 280 }
  }),
  mk("z_glass_golem", 10, "\u0E42\u0E01\u0E40\u0E25\u0E21\u0E41\u0E01\u0E49\u0E27\u0E23\u0E49\u0E32\u0E27", {
    ai: "glass_charger",
    speed: 70,
    radius: 30,
    hp: 1.9,
    atk: 1.2,
    mass: 5,
    particles: ["#d8ecff", "#7a9ab8", "#7fe8ff"],
    interruptAt: 2.4,
    p: { range: 520, telegraph: 0.95, chargeSpeed: 720, chargeTime: 0.7, shardEvery: 0.09, shardR: 46, shardDelay: 0.55, exposed: 1.4 }
  }),
  mk("z_mirror_image", 10, "\u0E20\u0E32\u0E1E\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19", {
    ai: "mirror_image",
    speed: 150,
    radius: 40,
    hp: 0.6,
    xp: 0.2,
    particles: ["#e8f4ff", "#7fe8ff", "#ffffff"],
    p: { telegraph: 0.8, len: 640, width: 46, life: 9 }
  }),
  mk("z_mirror_queen", 10, "\u0E23\u0E32\u0E0A\u0E34\u0E19\u0E35\u0E01\u0E23\u0E30\u0E08\u0E01\u0E41\u0E15\u0E01", {
    boss: true,
    ai: "mirror_queen",
    speed: 150,
    radius: 52,
    particles: ["#e8f4ff", "#7fe8ff", "#b88aff"],
    legendary: "w_prism_rapier",
    p: { slashTelegraph: 0.75, slashLen: 760, slashWidth: 54, ringTelegraph: 0.9, ringStep: 120, rings: 4, spokes: 6, spokeTelegraph: 0.8, spokeLen: 900, rest: 0.85, images: 2 }
  }),
  // 12 Eclipse Throne (v8)
  mk("z_eclipse_hound", 11, "\u0E2A\u0E38\u0E19\u0E31\u0E02\u0E04\u0E23\u0E32\u0E2A", {
    ai: "eclipse_hound",
    speed: 240,
    radius: 22,
    hp: 1.05,
    atk: 1.1,
    particles: ["#ffd27a", "#2a2238", "#ffb648"],
    p: { circle: 1.8, telegraph: 0.6, pounceSpeed: 760, pounceTime: 0.32, ringDelay: 0.65, ringR: 150, ringIn: 60, rest: 0.8 }
  }),
  mk("z_corona_priest", 11, "\u0E19\u0E31\u0E01\u0E1A\u0E27\u0E0A\u0E23\u0E31\u0E28\u0E21\u0E35\u0E15\u0E30\u0E27\u0E31\u0E19", {
    ai: "corona_priest",
    speed: 95,
    radius: 20,
    hp: 1,
    particles: ["#ffd27a", "#5a2a14", "#fff3c4"],
    p: { keepAway: 320, markTime: 1.1, markLock: 0.6, markR: 90, beams: 3, beamTelegraph: 0.8, beamLen: 600, beamWidth: 40, cooldown: 2.4 }
  }),
  mk("z_eclipse_king", 11, "\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E23\u0E23\u0E14\u0E34\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E04\u0E23\u0E32\u0E2A", {
    boss: true,
    ai: "eclipse_king",
    speed: 135,
    radius: 58,
    particles: ["#ffd27a", "#2a2238", "#ffb648"],
    legendary: "w_eclipse_halberd",
    p: { flareTelegraph: 0.85, flareLen: 900, flareWidth: 56, dropR: 150, dropSmall: 80, dropTelegraph: 1, crescentR: 300, crescentArc: 1.9, crescentTelegraph: 0.55, crescents: 3, stance: 11, rest: 0.8, summon: "z_eclipse_hound" }
  }),
  // special dungeons (stats from the raid level; hpMul is the boss multiplier)
  mkRaid("r_wrath_dragon", 0, "\u0E2D\u0E31\u0E04\u0E19\u0E34\u0E27\u0E32\u0E23 \u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18", {
    ai: "wrath_dragon",
    hpMul: 120,
    atkMul: 1.5,
    speed: 150,
    radius: 74,
    particles: ["#ff5a1a", "#4a120c", "#ffcf5a"],
    flying: false,
    drops: [
      { chance: 1, entries: [{ id: "m_wrath_scale", weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: MAT[3] },
      { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: "a_wrath_plate", weight: 2, qty: [1, 1] }, { id: "c_wrath_fang", weight: 2, qty: [1, 1] }, { id: "wg_wrath_dragon", weight: 1, qty: [1, 1] }] },
      { chance: 5e-3, entries: [{ id: "m_wrath_heart", weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: "m_bloodstone", weight: 1, qty: [1, 1] }] }
    ],
    p: {
      breathTelegraph: 0.75,
      breathSteps: 9,
      breathArc: 0.7,
      breathRange: 460,
      clawRange: 150,
      clawArc: 1.6,
      clawTelegraph: 0.42,
      tailArc: 1.4,
      diveSpeed: 980,
      diveTime: 0.55,
      diveTelegraph: 0.9,
      rainCount: 12,
      rainRadius: 78,
      rainTelegraph: 1.05,
      crackCount: 4,
      crackWidth: 70,
      rest: 0.85,
      summon: "z_magma_hound"
    }
  }),
  mkRaid("r_prophecy_dragon", 1, "\u0E19\u0E34\u0E21\u0E34\u0E15\u0E23\u0E32 \u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C", {
    ai: "prophecy_dragon",
    hpMul: 130,
    atkMul: 1.45,
    speed: 140,
    radius: 72,
    particles: ["#7fe8ff", "#26305a", "#ffffff"],
    flying: true,
    drops: [
      { chance: 1, entries: [{ id: "m_prophecy_scale", weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: MAT[3] },
      { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: "a_seer_vestment", weight: 2, qty: [1, 1] }, { id: "c_prophecy_lens", weight: 2, qty: [1, 1] }, { id: "wg_prophecy", weight: 1, qty: [1, 1] }] },
      { chance: 5e-3, entries: [{ id: "m_prophecy_eye", weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: "m_bloodstone", weight: 1, qty: [1, 1] }] }
    ],
    p: {
      lead: 0.75,
      starCount: 7,
      starRadius: 70,
      starTelegraph: 1,
      beamCount: 3,
      beamLen: 980,
      beamWidth: 46,
      beamTelegraph: 0.9,
      beamSpin: 0.55,
      orbCount: 14,
      orbSpeed: 240,
      echoDelay: 2.4,
      clawRange: 140,
      clawArc: 1.5,
      clawTelegraph: 0.4,
      rest: 0.9,
      summon: "z_cloud_ray"
    }
  }),
  mkRaid("r_judgment_god", 2, "\u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32", {
    ai: "judgment_god",
    hpMul: 145,
    atkMul: 1.55,
    speed: 120,
    radius: 66,
    particles: ["#fff3a0", "#f5c35a", "#ffffff"],
    flying: true,
    drops: [
      { chance: 1, entries: [{ id: "m_judgment_sigil", weight: 1, qty: [1, 3] }] },
      { chance: 1, entries: MAT[3] },
      { chance: 1, entries: MAT[3] },
      { chance: 0.5, entries: GEAR[2] },
      { chance: 0.06, entries: [{ id: "a_judgment_plate", weight: 2, qty: [1, 1] }, { id: "c_judgment_halo", weight: 2, qty: [1, 1] }, { id: "wg_seraph", weight: 1, qty: [1, 1] }] },
      { chance: 1e-3, entries: [{ id: "w_heaven_scythe", weight: 1, qty: [1, 1] }] },
      { chance: 0.5, entries: [{ id: "m_bloodstone", weight: 1, qty: [1, 1] }] }
    ],
    p: {
      slashRange: 190,
      slashArc: 2,
      slashTelegraph: 0.5,
      slashes: 3,
      slashGap: 0.38,
      gridTelegraph: 1.25,
      pillarRadius: 64,
      pillarCount: 6,
      scaleTelegraph: 1.4,
      swordRain: 16,
      swordTelegraph: 1.1,
      rest: 0.8,
      summon: "z_feather_monk"
    }
  }),
  // v8: the shadow at the end of the Boss Rush (only when nobody fell). It wears the moves of the bosses it beat.
  ["z_rush_shadow", Object.freeze({
    id: "z_rush_shadow",
    name: "\u0E40\u0E07\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E40\u0E08\u0E49\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1A\u0E2D\u0E2A",
    sprite: "z_rush_shadow",
    zone: "rush",
    boss: true,
    faces: true,
    particles: ["#ffb648", "#1a1424", "#6a4aa8"],
    hp: Math.round(zoneStats(34).hp * 150),
    atk: Math.round(zoneStats(34).atk * 1.6),
    def: Math.round(zoneStats(34).def * 1.7),
    speed: 150,
    radius: 56,
    mass: 14,
    xp: Math.round(zoneStats(34).xp * 30),
    gold: [zoneStats(34).gold[0] * 25, zoneStats(34).gold[1] * 25],
    sparks: 30,
    interruptAt: 3,
    flying: false,
    ai: "rush_shadow",
    ai_params: Object.freeze({ persona: 10, rest: 0.7 }),
    drops: [
      { chance: 1, entries: [{ id: "m_bloodstone", weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: [{ id: "m_mirror_shard", weight: 1, qty: [2, 4] }, { id: "m_eclipse_core", weight: 1, qty: [2, 4] }] },
      { chance: 1, entries: MAT[3] },
      { chance: 0.6, entries: GEAR[2] },
      { chance: 0.04, entries: [{ id: "w_eclipse_blade", weight: 1, qty: [1, 1] }] }
    ]
  })]
]));

// src/core/rng.js
function createRng(seed = Date.now() >>> 0) {
  let s = seed >>> 0;
  const next = () => {
    s = s + 1831565813 >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    // inclusive
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    get state() {
      return s;
    }
  };
}

// src/data/tower.js
var ITEMS2 = { ...WEAPONS_V7, ...ARMORS_V7 };
var TOWER = Object.freeze({
  floors: 100,
  checkpoint: 10,
  eliteEvery: 5,
  godEvery: 10,
  levelBase: 5,
  levelPerFloor: 0.4,
  // floor 1 ≈ level 5, floor 100 ≈ level 45
  ascLevel: 12,
  ascHp: 0.55,
  ascAtk: 0.3,
  // each ascension: +12 levels worth, then ×(1+0.55·A) HP, ×(1+0.3·A) attack
  waveRest: 1.4
});
var floorLevel = (f, asc = 0) => TOWER.levelBase + f * TOWER.levelPerFloor + asc * TOWER.ascLevel;
var bandOf = (f) => Math.min(10, Math.max(1, Math.ceil(f / 10)));
var isGodFloor = (f) => f % TOWER.godEvery === 0;
var isEliteFloor = (f) => !isGodFloor(f) && f % TOWER.eliteEvery === 0;
var landOfFloor = (f) => ZONES[bandOf(f) - 1];
var AFFIXES = Object.freeze({
  swift: { name: "\u0E27\u0E48\u0E2D\u0E07\u0E44\u0E27", color: "#9ee0c8", desc: "\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E42\u0E08\u0E21\u0E15\u0E35\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 \u0E40\u0E15\u0E37\u0E2D\u0E19\u0E2A\u0E31\u0E49\u0E19\u0E25\u0E07" },
  armored: { name: "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E2B\u0E19\u0E32", color: "#b8c0cc", desc: "\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E2A\u0E2D\u0E07\u0E40\u0E17\u0E48\u0E32 \u0E17\u0E38\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E17\u0E48\u0E32\u0E2B\u0E19\u0E31\u0E01\u0E08\u0E30\u0E40\u0E08\u0E32\u0E30\u0E44\u0E14\u0E49" },
  vampiric: { name: "\u0E14\u0E39\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14", color: "#e0503a", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E08\u0E32\u0E01\u0E14\u0E32\u0E40\u0E21\u0E08\u0E17\u0E35\u0E48\u0E17\u0E33\u0E44\u0E14\u0E49" },
  volatile: { name: "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E15\u0E32\u0E22", color: "#ff8a3d", desc: "\u0E15\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E1B\u0E47\u0E19\u0E27\u0E07 (\u0E21\u0E35\u0E27\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19)" },
  splitting: { name: "\u0E41\u0E22\u0E01\u0E23\u0E48\u0E32\u0E07", color: "#c8b8ff", desc: "\u0E15\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27\u0E41\u0E15\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E48\u0E32\u0E07\u0E40\u0E25\u0E47\u0E01\u0E2A\u0E2D\u0E07\u0E15\u0E31\u0E27" },
  warded: { name: "\u0E42\u0E25\u0E48\u0E2D\u0E21\u0E15\u0E30", color: "#ffe89a", desc: "\u0E01\u0E32\u0E07\u0E42\u0E25\u0E48\u0E2D\u0E21\u0E15\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E46 \u0E23\u0E2D\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E42\u0E25\u0E48\u0E2B\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E2D\u0E22\u0E15\u0E35" },
  frenzied: { name: "\u0E04\u0E25\u0E31\u0E48\u0E07", color: "#ff5a5a", desc: "\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 40% \u0E08\u0E30\u0E41\u0E23\u0E07\u0E41\u0E25\u0E30\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19\u0E21\u0E32\u0E01" },
  piercing: { name: "\u0E40\u0E08\u0E32\u0E30\u0E40\u0E01\u0E23\u0E32\u0E30", color: "#ff3a6a", desc: "\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E17\u0E30\u0E25\u0E38\u0E42\u0E25\u0E48\u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E2A\u0E19\u0E04\u0E48\u0E32\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 \u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" },
  regen: { name: "\u0E1F\u0E37\u0E49\u0E19\u0E15\u0E31\u0E27", color: "#7fc77a", desc: "\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E42\u0E14\u0E19\u0E15\u0E35\u0E04\u0E23\u0E39\u0E48\u0E2B\u0E19\u0E36\u0E48\u0E07 \u0E01\u0E14\u0E14\u0E31\u0E19\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07" },
  molten: { name: "\u0E25\u0E32\u0E27\u0E32", color: "#ff7a33", desc: "\u0E17\u0E34\u0E49\u0E07\u0E1A\u0E48\u0E2D\u0E44\u0E1F\u0E44\u0E27\u0E49\u0E15\u0E32\u0E21\u0E17\u0E32\u0E07" },
  frost: { name: "\u0E40\u0E22\u0E37\u0E2D\u0E01\u0E41\u0E02\u0E47\u0E07", color: "#9fd8ff", desc: "\u0E42\u0E14\u0E19\u0E15\u0E35\u0E41\u0E25\u0E49\u0E27\u0E0A\u0E49\u0E32\u0E25\u0E07 \u0E2A\u0E30\u0E2A\u0E21\u0E08\u0E19\u0E41\u0E02\u0E47\u0E07\u0E17\u0E37\u0E48\u0E2D" },
  giant: { name: "\u0E22\u0E31\u0E01\u0E29\u0E4C", color: "#c8a46a", desc: "\u0E15\u0E31\u0E27\u0E43\u0E2B\u0E0D\u0E48 \u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E21\u0E32\u0E01 \u0E44\u0E21\u0E48\u0E2A\u0E30\u0E14\u0E38\u0E49\u0E07" },
  shadow: { name: "\u0E40\u0E07\u0E32", color: "#7a6aa8", desc: "\u0E2B\u0E32\u0E22\u0E15\u0E31\u0E27\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E22\u0E30 \u0E42\u0E1C\u0E25\u0E48\u0E2B\u0E25\u0E31\u0E07\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22" }
});
var AFFIX_IDS = Object.freeze(Object.keys(AFFIXES));
var POOL = ZONES.flatMap((z) => z.monsters).filter((id, i, a) => a.indexOf(id) === i);
var GODS = Object.freeze([
  {
    id: "t_god_river",
    floor: 10,
    name: "\u0E27\u0E32\u0E23\u0E34\u0E22\u0E30 \u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    title: "\u0E1C\u0E39\u0E49\u0E41\u0E08\u0E27\u0E40\u0E23\u0E37\u0E2D\u0E02\u0E49\u0E32\u0E21\u0E1D\u0E31\u0E48\u0E07\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22",
    ai: "god_river",
    relic: "m_hell1",
    color: "#7fe8ff",
    particles: ["#7fe8ff", "#2a4a6a", "#ffffff"],
    radius: 70,
    speed: 110,
    hpMul: 55,
    atkMul: 1.4,
    summon: "z_bog_toad",
    mechanic: "\u0E08\u0E21\u0E25\u0E07\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33 (\u0E2D\u0E21\u0E15\u0E30) \u0E41\u0E25\u0E49\u0E27\u0E42\u0E1C\u0E25\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E19\u0E49\u0E33\u0E1E\u0E38 \xB7 \u0E01\u0E23\u0E30\u0E41\u0E2A\u0E19\u0E49\u0E33\u0E1C\u0E25\u0E31\u0E01\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27 \xB7 \u0E1E\u0E32\u0E22\u0E41\u0E08\u0E27\u0E01\u0E27\u0E32\u0E14\u0E41\u0E1E\u0E23\u0E4C\u0E23\u0E35\u0E48\u0E44\u0E14\u0E49",
    lore: "\u0E27\u0E32\u0E23\u0E34\u0E22\u0E30\u0E41\u0E08\u0E27\u0E40\u0E23\u0E37\u0E2D\u0E1E\u0E32\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E02\u0E49\u0E32\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E21\u0E32\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E01\u0E48\u0E2D\u0E19\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E35\u0E22\u0E01 \u0E40\u0E02\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E16\u0E32\u0E21\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E2D\u0E22\u0E32\u0E01\u0E44\u0E1B \u0E40\u0E02\u0E32\u0E41\u0E04\u0E48\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E43\u0E2B\u0E49\u0E43\u0E04\u0E23\u0E01\u0E25\u0E31\u0E1A"
  },
  {
    id: "t_god_chains",
    floor: 20,
    name: "\u0E01\u0E32\u0E2C\u0E42\u0E25\u0E2B\u0E34\u0E15 \u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E42\u0E0B\u0E48\u0E15\u0E23\u0E27\u0E19",
    title: "\u0E1C\u0E39\u0E49\u0E04\u0E38\u0E21\u0E19\u0E31\u0E01\u0E42\u0E17\u0E29\u0E19\u0E34\u0E23\u0E31\u0E19\u0E14\u0E23\u0E4C",
    ai: "god_chains",
    relic: "m_hell2",
    color: "#b8b8c4",
    particles: ["#b8b8c4", "#5a1a1a", "#e0503a"],
    radius: 66,
    speed: 100,
    hpMul: 62,
    atkMul: 1.45,
    summon: "z_bone_lancer",
    mechanic: "\u0E42\u0E0B\u0E48\u0E25\u0E48\u0E32\u0E21\u0E14\u0E36\u0E07\u0E15\u0E31\u0E27 \xB7 \u0E42\u0E0B\u0E48\u0E1F\u0E32\u0E14\u0E40\u0E08\u0E32\u0E30\u0E40\u0E01\u0E23\u0E32\u0E30 (\u0E01\u0E31\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49) \xB7 \u0E25\u0E48\u0E32\u0E21\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E21\u0E15\u0E30\u0E08\u0E19\u0E01\u0E27\u0E48\u0E32\u0E08\u0E30\u0E17\u0E38\u0E1A\u0E2B\u0E21\u0E38\u0E14\u0E42\u0E0B\u0E48\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E32\u0E21",
    lore: "\u0E17\u0E38\u0E01\u0E42\u0E0B\u0E48\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E2C\u0E42\u0E25\u0E2B\u0E34\u0E15\u0E40\u0E04\u0E22\u0E25\u0E48\u0E32\u0E21\u0E43\u0E04\u0E23\u0E44\u0E27\u0E49\u0E2A\u0E31\u0E01\u0E04\u0E19 \u0E40\u0E02\u0E32\u0E08\u0E33\u0E0A\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E01\u0E42\u0E17\u0E29\u0E44\u0E14\u0E49\u0E17\u0E38\u0E01\u0E04\u0E19 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E25\u0E37\u0E21\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E2B\u0E19\u0E35\u0E44\u0E1B\u0E44\u0E14\u0E49"
  },
  {
    id: "t_god_hellfire",
    floor: 30,
    name: "\u0E21\u0E32\u0E23\u0E35\u0E08\u0E34 \u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E19\u0E23\u0E01",
    title: "\u0E40\u0E15\u0E32\u0E40\u0E1C\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E21\u0E2D\u0E14",
    ai: "god_hellfire",
    relic: "m_hell3",
    color: "#ff5a1a",
    particles: ["#ff5a1a", "#3a0e0a", "#ffcf5a"],
    radius: 68,
    speed: 120,
    hpMul: 68,
    atkMul: 1.5,
    summon: "z_magma_hound",
    mechanic: "\u0E42\u0E25\u0E48\u0E40\u0E1B\u0E25\u0E27\u0E44\u0E1F\u0E2D\u0E21\u0E15\u0E30 \u0E08\u0E30\u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E2B\u0E25\u0E31\u0E07\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E27\u0E07\u0E43\u0E2B\u0E0D\u0E48 (\u0E0A\u0E48\u0E2D\u0E07\u0E42\u0E2B\u0E27\u0E48 4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35) \xB7 \u0E27\u0E07\u0E44\u0E1F\u0E0B\u0E49\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E0A\u0E48\u0E2D\u0E07\u0E43\u0E2B\u0E49\u0E25\u0E2D\u0E14 \xB7 \u0E17\u0E30\u0E40\u0E25\u0E40\u0E1E\u0E25\u0E34\u0E07",
    lore: "\u0E21\u0E32\u0E23\u0E35\u0E08\u0E34\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E01\u0E25\u0E35\u0E22\u0E14\u0E43\u0E04\u0E23 \u0E40\u0E02\u0E32\u0E41\u0E04\u0E48\u0E2B\u0E34\u0E27 \u0E41\u0E25\u0E30\u0E2A\u0E34\u0E48\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E17\u0E35\u0E48\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E2D\u0E34\u0E48\u0E21\u0E44\u0E14\u0E49\u0E04\u0E37\u0E2D\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07"
  },
  {
    id: "t_god_silence",
    floor: 40,
    name: "\u0E2A\u0E38\u0E0D\u0E0D\u0E15\u0E32 \u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E27\u0E32\u0E21\u0E40\u0E07\u0E35\u0E22\u0E1A",
    title: "\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E01\u0E25\u0E37\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07",
    ai: "god_silence",
    relic: "m_hell4",
    color: "#5a5a7a",
    particles: ["#5a5a7a", "#14121c", "#c8c8ff"],
    radius: 60,
    speed: 150,
    hpMul: 66,
    atkMul: 1.55,
    summon: "z_shade_stalker",
    mechanic: "\u0E41\u0E22\u0E01\u0E23\u0E48\u0E32\u0E07\u0E40\u0E07\u0E32 (\u0E21\u0E35\u0E23\u0E48\u0E32\u0E07\u0E08\u0E23\u0E34\u0E07\u0E23\u0E48\u0E32\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27) \xB7 \u0E1B\u0E34\u0E14\u0E40\u0E2A\u0E35\u0E22\u0E07: \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E2A\u0E01\u0E34\u0E25 3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \xB7 \u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E1A\u0E14\u0E1A\u0E31\u0E07\u0E2B\u0E49\u0E2D\u0E07",
    lore: "\u0E43\u0E19\u0E2B\u0E49\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E38\u0E0D\u0E0D\u0E15\u0E32\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19 \u0E04\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E43\u0E19\u0E19\u0E31\u0E49\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E32\u0E22 \u0E41\u0E04\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E44\u0E14\u0E49\u0E22\u0E34\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E40\u0E23\u0E35\u0E22\u0E01\u0E02\u0E2D\u0E07\u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32\u0E2D\u0E35\u0E01"
  },
  {
    id: "t_god_judge",
    floor: 50,
    name: "\u0E22\u0E21\u0E17\u0E31\u0E13\u0E11\u0E4C \u0E1C\u0E39\u0E49\u0E0A\u0E31\u0E48\u0E07\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    title: "\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E40\u0E2D\u0E35\u0E22\u0E07",
    ai: "god_judge",
    relic: "m_hell5",
    color: "#e0b45a",
    particles: ["#e0b45a", "#2a2a3a", "#ffffff"],
    radius: 64,
    speed: 100,
    hpMul: 74,
    atkMul: 1.55,
    summon: "z_feather_monk",
    mechanic: "\u0E1A\u0E32\u0E1B: \u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E42\u0E14\u0E19\u0E15\u0E35\u0E08\u0E30\u0E2A\u0E30\u0E2A\u0E21\u0E1A\u0E32\u0E1B \xB7 \u0E04\u0E33\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E41\u0E23\u0E07\u0E15\u0E32\u0E21\u0E1A\u0E32\u0E1B \xB7 \u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07\u0E40\u0E2D\u0E35\u0E22\u0E07: \u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E49\u0E2D\u0E07\u0E16\u0E39\u0E01\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E2A\u0E25\u0E31\u0E1A\u0E02\u0E49\u0E32\u0E07",
    lore: "\u0E22\u0E21\u0E17\u0E31\u0E13\u0E11\u0E4C\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E25\u0E07\u0E42\u0E17\u0E29\u0E43\u0E04\u0E23 \u0E40\u0E02\u0E32\u0E41\u0E04\u0E48\u0E0A\u0E31\u0E48\u0E07 \u0E41\u0E25\u0E49\u0E27\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E43\u0E2B\u0E49\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E1A\u0E32\u0E1B\u0E17\u0E33\u0E07\u0E32\u0E19\u0E40\u0E2D\u0E07"
  },
  {
    id: "t_god_serpent",
    floor: 60,
    name: "\u0E1E\u0E34\u0E29\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C \u0E40\u0E17\u0E1E\u0E2D\u0E2A\u0E23\u0E1E\u0E34\u0E29",
    title: "\u0E07\u0E39\u0E17\u0E35\u0E48\u0E01\u0E25\u0E37\u0E19\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33",
    ai: "god_serpent",
    relic: "m_hell6",
    color: "#a8d070",
    particles: ["#a8d070", "#1a3a2a", "#e8ff9a"],
    radius: 72,
    speed: 160,
    hpMul: 80,
    atkMul: 1.6,
    summon: "z_spore_puff",
    mechanic: "\u0E21\u0E38\u0E14\u0E14\u0E34\u0E19 (\u0E2D\u0E21\u0E15\u0E30) \u0E41\u0E25\u0E49\u0E27\u0E1E\u0E38\u0E48\u0E07\u0E02\u0E36\u0E49\u0E19\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E40\u0E15\u0E37\u0E2D\u0E19 \xB7 \u0E1F\u0E32\u0E14\u0E2B\u0E32\u0E07\u0E40\u0E08\u0E32\u0E30\u0E40\u0E01\u0E23\u0E32\u0E30 \xB7 \u0E1A\u0E36\u0E07\u0E1E\u0E34\u0E29\u0E04\u0E48\u0E2D\u0E22\u0E46 \u0E17\u0E48\u0E27\u0E21\u0E2B\u0E49\u0E2D\u0E07",
    lore: "\u0E1E\u0E34\u0E29\u0E20\u0E38\u0E0A\u0E07\u0E04\u0E4C\u0E25\u0E2D\u0E01\u0E04\u0E23\u0E32\u0E1A\u0E17\u0E38\u0E01\u0E1E\u0E31\u0E19\u0E1B\u0E35 \u0E41\u0E25\u0E30\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E25\u0E2D\u0E01 \u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E01\u0E47\u0E25\u0E36\u0E01\u0E25\u0E07\u0E2D\u0E35\u0E01\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E0A\u0E31\u0E49\u0E19"
  },
  {
    id: "t_god_time",
    floor: 70,
    name: "\u0E23\u0E32\u0E15\u0E23\u0E35\u0E01\u0E32\u0E25 \u0E40\u0E17\u0E1E\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E15\u0E32\u0E22",
    title: "\u0E1C\u0E39\u0E49\u0E19\u0E31\u0E1A\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22",
    ai: "god_time",
    relic: "m_hell7",
    color: "#fff3c4",
    particles: ["#fff3c4", "#3a2a1a", "#c8a050"],
    radius: 64,
    speed: 110,
    hpMul: 86,
    atkMul: 1.65,
    summon: "z_volt_drone",
    mechanic: "\u0E40\u0E02\u0E47\u0E21\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E01\u0E27\u0E32\u0E14\u0E23\u0E2D\u0E1A\u0E2B\u0E49\u0E2D\u0E07 \xB7 \u0E22\u0E49\u0E2D\u0E19\u0E40\u0E27\u0E25\u0E32: \u0E1F\u0E37\u0E49\u0E19\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E01\u0E25\u0E31\u0E1A \u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E15\u0E35\u0E02\u0E31\u0E14\u0E43\u0E19\u0E27\u0E07\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32 \xB7 \u0E2B\u0E22\u0E38\u0E14\u0E40\u0E27\u0E25\u0E32\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E23\u0E32\u0E0A\u0E49\u0E32",
    lore: "\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E02\u0E2D\u0E07\u0E23\u0E32\u0E15\u0E23\u0E35\u0E01\u0E32\u0E25\u0E40\u0E14\u0E34\u0E19\u0E16\u0E2D\u0E22\u0E2B\u0E25\u0E31\u0E07 \u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E21\u0E31\u0E19\u0E15\u0E35 \u0E43\u0E04\u0E23\u0E2A\u0E31\u0E01\u0E04\u0E19\u0E43\u0E19\u0E42\u0E25\u0E01\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E40\u0E27\u0E25\u0E32\u0E19\u0E49\u0E2D\u0E22\u0E25\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
  },
  {
    id: "t_god_masks",
    floor: 80,
    name: "\u0E17\u0E28\u0E1E\u0E31\u0E01\u0E15\u0E23\u0E4C\u0E21\u0E32\u0E23 \u0E40\u0E17\u0E1E\u0E1E\u0E31\u0E19\u0E2B\u0E19\u0E49\u0E32",
    title: "\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E23\u0E34\u0E07",
    ai: "god_masks",
    relic: "m_hell8",
    color: "#ff5a9a",
    particles: ["#ff5a9a", "#3a1a3a", "#ffd0e0"],
    radius: 66,
    speed: 130,
    hpMul: 92,
    atkMul: 1.7,
    summon: "z_cinder_mage",
    mechanic: "\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E32\u0E01\u0E2B\u0E21\u0E38\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \u0E21\u0E35\u0E41\u0E04\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E15\u0E35\u0E40\u0E02\u0E49\u0E32 \xB7 \u0E2B\u0E19\u0E49\u0E32\u0E1C\u0E34\u0E14\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E14\u0E32\u0E40\u0E21\u0E08\u0E01\u0E25\u0E31\u0E1A \xB7 \u0E23\u0E48\u0E32\u0E07\u0E01\u0E23\u0E30\u0E08\u0E01\u0E40\u0E25\u0E35\u0E22\u0E19\u0E17\u0E48\u0E32",
    lore: "\u0E17\u0E28\u0E1E\u0E31\u0E01\u0E15\u0E23\u0E4C\u0E21\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E42\u0E01\u0E2B\u0E01 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E23\u0E01\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23 \u0E23\u0E27\u0E21\u0E16\u0E36\u0E07\u0E15\u0E31\u0E27\u0E21\u0E31\u0E19\u0E40\u0E2D\u0E07"
  },
  {
    id: "t_god_frost",
    floor: 90,
    name: "\u0E2D\u0E2A\u0E38\u0E23\u0E40\u0E2B\u0E21 \u0E40\u0E17\u0E1E\u0E02\u0E38\u0E21\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07",
    title: "\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E19\u0E32\u0E27\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E49\u0E19",
    ai: "god_frost",
    relic: "m_hell9",
    color: "#cfeaff",
    particles: ["#cfeaff", "#2a4a6a", "#ffffff"],
    radius: 72,
    speed: 100,
    hpMul: 100,
    atkMul: 1.75,
    summon: "z_frost_slime",
    mechanic: "\u0E23\u0E31\u0E07\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07: \u0E42\u0E25\u0E48\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E38\u0E1A\u0E41\u0E15\u0E01\u0E01\u0E48\u0E2D\u0E19 \xB7 \u0E2B\u0E34\u0E21\u0E30\u0E40\u0E22\u0E37\u0E2D\u0E01\u0E41\u0E02\u0E47\u0E07: \u0E22\u0E37\u0E19\u0E19\u0E34\u0E48\u0E07\u0E08\u0E30\u0E41\u0E02\u0E47\u0E07\u0E17\u0E37\u0E48\u0E2D \xB7 \u0E2B\u0E2D\u0E01\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E40\u0E08\u0E32\u0E30\u0E40\u0E01\u0E23\u0E32\u0E30",
    lore: "\u0E02\u0E38\u0E21\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E19\u0E23\u0E01\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E44\u0E1F \u0E41\u0E15\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07 \u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E19\u0E41\u0E21\u0E49\u0E41\u0E15\u0E48\u0E04\u0E27\u0E32\u0E21\u0E40\u0E01\u0E25\u0E35\u0E22\u0E14\u0E01\u0E47\u0E41\u0E02\u0E47\u0E07\u0E15\u0E31\u0E27"
  },
  {
    id: "t_god_king",
    floor: 100,
    name: "\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C \u0E23\u0E32\u0E0A\u0E31\u0E19\u0E41\u0E2B\u0E48\u0E07\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01",
    title: "\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E27\u0E48\u0E32\u0E07",
    ai: "god_king",
    relic: "m_hell10",
    color: "#ff3a3a",
    particles: ["#ff3a3a", "#1a0a10", "#f5c35a"],
    radius: 78,
    speed: 120,
    hpMul: 120,
    atkMul: 1.85,
    summon: "z_ash_revenant",
    mechanic: "\u0E2A\u0E32\u0E21\u0E40\u0E1F\u0E2A \u0E22\u0E37\u0E21\u0E1E\u0E25\u0E31\u0E07\u0E40\u0E17\u0E1E\u0E17\u0E31\u0E49\u0E07\u0E40\u0E01\u0E49\u0E32 \xB7 \u0E40\u0E1F\u0E2A\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22: \u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E2D\u0E21\u0E15\u0E30\u0E40\u0E23\u0E35\u0E22\u0E01\u0E40\u0E07\u0E32\u0E40\u0E17\u0E1E \u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33\u0E25\u0E32\u0E22\u0E40\u0E07\u0E32\u0E01\u0E48\u0E2D\u0E19\u0E08\u0E36\u0E07\u0E15\u0E35\u0E44\u0E14\u0E49",
    lore: "\u0E40\u0E17\u0E1E\u0E17\u0E31\u0E49\u0E07\u0E40\u0E01\u0E49\u0E32\u0E04\u0E38\u0E01\u0E40\u0E02\u0E48\u0E32\u0E43\u0E2B\u0E49\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E01\u0E25\u0E31\u0E27 \u0E41\u0E15\u0E48\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E40\u0E02\u0E32\u0E04\u0E37\u0E2D\u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E17\u0E35\u0E48\u0E40\u0E04\u0E22\u0E1B\u0E35\u0E19\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E44\u0E14\u0E49 \u0E41\u0E25\u0E49\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E14\u0E34\u0E19\u0E01\u0E25\u0E31\u0E1A\u0E25\u0E07\u0E21\u0E32"
  }
]);
var godOfFloor = (f) => GODS.find((g) => g.floor === (f - 1) % 100 + 1) || null;
function godDef(g) {
  const base = zoneStats(floorLevel(g.floor));
  return [g.id, Object.freeze({
    id: g.id,
    name: g.name,
    sprite: g.id,
    zone: "tower",
    boss: true,
    god: true,
    faces: true,
    particles: g.particles,
    hp: Math.round(base.hp * g.hpMul),
    atk: Math.round(base.atk * g.atkMul),
    def: Math.round(base.def * 1.7),
    speed: g.speed,
    radius: g.radius,
    mass: 16,
    xp: Math.round(base.xp * 26),
    gold: [base.gold[0] * 20, base.gold[1] * 20],
    sparks: 10 + g.floor / 5,
    interruptAt: 3.5,
    flying: false,
    ai: g.ai,
    ai_params: Object.freeze({ summon: g.summon, color: g.color }),
    drops: []
  })];
}
var TOWER_ENEMIES = Object.freeze(Object.fromEntries(GODS.map(godDef)));
function planFor(f, rng) {
  const band = bandOf(f), land = landOfFloor(f);
  if (isGodFloor(f)) {
    const g = godOfFloor(f);
    return { floor: f, band, land: land.id, theme: land.theme, mechanic: land.mechanic, god: g.id, waves: [[[g.id, 1]]], affixes: [] };
  }
  const own = land.monsters.slice();
  const pick = () => POOL[rng.next() * POOL.length | 0];
  const types = /* @__PURE__ */ new Set([own[rng.next() * own.length | 0]]);
  const want = band >= 6 ? 3 : 2;
  while (types.size < want) types.add(rng.next() < 0.45 ? own[rng.next() * own.length | 0] : pick());
  const list = [...types];
  const nAff = band <= 2 ? rng.next() < 0.5 ? 1 : 0 : band <= 5 ? 1 + (rng.next() < 0.3 ? 1 : 0) : band <= 8 ? 2 : 2 + (rng.next() < 0.5 ? 1 : 0);
  const affixes = [];
  while (affixes.length < nAff) {
    const a = AFFIX_IDS[rng.next() * AFFIX_IDS.length | 0];
    if (!affixes.includes(a)) affixes.push(a);
  }
  const per = 2 + Math.floor(band / 3);
  const waves = [];
  const nWaves = band >= 5 ? 3 : 2;
  for (let w = 0; w < nWaves; w++) waves.push(list.map((id, i) => [id, Math.max(1, per - (i + w) % 2)]));
  const plan = { floor: f, band, land: land.id, theme: land.theme, mechanic: land.mechanic, god: null, waves, affixes, types: list };
  if (isEliteFloor(f)) {
    const lands = ZONES.slice(0, Math.min(ZONES.length, band + 2));
    plan.elite = lands[rng.next() * lands.length | 0].boss;
    plan.waves.push([[plan.elite, 1]]);
  }
  return plan;
}
var PLANS = (() => {
  const out = [], seen = /* @__PURE__ */ new Set();
  for (let f = 1; f <= TOWER.floors; f++) {
    let seed = 7919 * f, plan;
    for (let tries = 0; tries < 50; tries++) {
      plan = planFor(f, createRng(seed + tries * 104729));
      const sig = plan.god || `${plan.land}|${[...plan.types].sort().join(",")}|${[...plan.affixes].sort().join(",")}|${plan.elite || ""}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        plan.sig = sig;
        break;
      }
    }
    out.push(Object.freeze(plan));
  }
  return out;
})();
var BAND_GEAR = Object.freeze({
  1: ["w_flamberge", "w_kris_pair", "w_featherwing_bow", "w_jade_leaf_twins", "a_river_ferryman", "a_moss_ranger"],
  2: ["w_crimson_nodachi", "w_tidebreaker", "w_crescent_staff", "w_war_halberd", "w_sakura_scythe", "a_chain_warden", "a_ember_apprentice"],
  3: ["w_crystal_edge", "w_executioner", "w_rootheart_staff", "w_twin_moon_scythe", "a_hellfire_vest", "a_bone_vanguard", "a_wanderer_fur"],
  4: ["w_moonglass_katana", "w_fang_hook", "w_abyss_trident", "a_silent_shroud", "a_frost_lamellar"],
  5: ["w_dragonbone_blade", "w_vertebra_bow", "w_ribcage_reaper", "a_judge_mantle", "a_crystal_aegis"],
  6: ["w_bonesaw", "w_obsidian_cleaver", "w_serpent_staff", "a_serpent_scale", "a_rune_harness"],
  7: ["w_thunder_katana", "w_storm_longbow", "w_shadow_fangs", "a_clockwork_plate", "a_storm_knight"],
  8: ["w_needle_stiletto", "w_serpent_glaive", "a_thousand_mask", "a_ash_monk"],
  9: ["w_soul_eye_staff", "a_glacier_bastion", "a_void_wrap"],
  10: ["w_sunblade", "w_sun_moon_twins", "a_netherking_regalia"]
});

// src/data/titles.js
var cnt = (o) => Object.keys(o || {}).length;
var towerDeep = (s) => s.tower?.deepest || 0;
var gods = (s) => Object.keys(s.tower?.gods || {}).length;
var ownsRarity = (s, r) => [s.equipment?.weapon, s.equipment?.armor, s.equipment?.charm, s.equipment?.wings, ...s.inventory?.slots || []].some((x) => x && ITEMS[x.id]?.rarity === r);
var maxUpgrade = (s) => Math.max(0, ...[s.equipment?.weapon, s.equipment?.armor, s.equipment?.charm, s.equipment?.wings, ...s.inventory?.slots || []].filter(Boolean).map((x) => x.lvl || 0));
var fiveStar = (s) => Object.values(s.pets?.owned || {}).some((p) => p.stars >= 5);
var TITLES = Object.freeze([
  // ---- the climb
  { id: "lv10", name: "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E1D\u0E36\u0E01\u0E2B\u0E31\u0E14", t: 1, how: "\u0E16\u0E36\u0E07\u0E40\u0E25\u0E40\u0E27\u0E25 10", test: (s) => s.player.level >= 10, b: { hpPct: 0.02 } },
  { id: "lv20", name: "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E40\u0E08\u0E19\u0E2A\u0E19\u0E32\u0E21", t: 2, how: "\u0E16\u0E36\u0E07\u0E40\u0E25\u0E40\u0E27\u0E25 20", test: (s) => s.player.level >= 20, b: { atkPct: 0.03 } },
  { id: "lv30", name: "\u0E22\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21", t: 3, how: "\u0E16\u0E36\u0E07\u0E40\u0E25\u0E40\u0E27\u0E25 30", test: (s) => s.player.level >= 30, b: { atkPct: 0.04, hpPct: 0.04 } },
  { id: "kill100", name: "\u0E1C\u0E39\u0E49\u0E25\u0E49\u0E32\u0E07\u0E23\u0E31\u0E07", t: 1, how: "\u0E01\u0E33\u0E08\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39 500 \u0E15\u0E31\u0E27", test: (s) => s.stats.kills >= 500, b: { crit: 0.01 } },
  { id: "kill2k", name: "\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01\u0E40\u0E2B\u0E19\u0E37\u0E48\u0E2D\u0E22", t: 2, how: "\u0E01\u0E33\u0E08\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39 5,000 \u0E15\u0E31\u0E27", test: (s) => s.stats.kills >= 5e3, b: { atkPct: 0.03 } },
  { id: "kill20k", name: "\u0E1D\u0E31\u0E19\u0E23\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E21\u0E2D\u0E19\u0E2A\u0E40\u0E15\u0E2D\u0E23\u0E4C", t: 4, how: "\u0E01\u0E33\u0E08\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39 50,000 \u0E15\u0E31\u0E27", test: (s) => s.stats.kills >= 5e4, b: { atkPct: 0.05, critMult: 0.1 } },
  // ---- the story and the lands
  { id: "story1", name: "\u0E1C\u0E39\u0E49\u0E1D\u0E48\u0E32\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21", t: 1, how: "\u0E1C\u0E48\u0E32\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E19\u0E18\u0E22\u0E32", test: (s) => !!s.progress?.cleared?.s1, b: { spd: 0.02 } },
  { id: "story2", name: "\u0E1C\u0E39\u0E49\u0E14\u0E31\u0E1A\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21", t: 2, how: "\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E16\u0E48\u0E32\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07", test: (s) => !!s.progress?.cleared?.s2, b: { defPct: 0.03 } },
  { id: "zones3", name: "\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E21\u0E34\u0E15\u0E34", t: 1, how: "\u0E1E\u0E34\u0E0A\u0E34\u0E15\u0E14\u0E31\u0E19\u0E40\u0E08\u0E35\u0E49\u0E22\u0E19\u0E23\u0E27\u0E21 5 \u0E42\u0E0B\u0E19", test: (s) => cnt(s.zones?.cleared) >= 5, b: { goldMult: 0.05 } },
  { id: "zones10", name: "\u0E1C\u0E39\u0E49\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E2A\u0E34\u0E1A\u0E14\u0E34\u0E19\u0E41\u0E14\u0E19", t: 3, how: "\u0E1E\u0E34\u0E0A\u0E34\u0E15\u0E14\u0E31\u0E19\u0E40\u0E08\u0E35\u0E49\u0E22\u0E19\u0E23\u0E27\u0E21\u0E04\u0E23\u0E1A 10 \u0E42\u0E0B\u0E19", test: (s) => ZONES.every((z) => s.zones?.cleared?.[z.id]), b: { hpPct: 0.05, defPct: 0.03 } },
  { id: "wrath", name: "\u0E1C\u0E39\u0E49\u0E14\u0E31\u0E1A\u0E44\u0E1F\u0E1E\u0E34\u0E42\u0E23\u0E18", t: 3, how: "\u0E1B\u0E23\u0E32\u0E1A\u0E2D\u0E31\u0E04\u0E19\u0E34\u0E27\u0E32\u0E23 \u0E21\u0E31\u0E07\u0E01\u0E23\u0E1E\u0E34\u0E42\u0E23\u0E18", test: (s) => (s.raids?.r1?.kills || 0) > 0, b: { critMult: 0.12 } },
  { id: "prophecy", name: "\u0E1C\u0E39\u0E49\u0E2B\u0E25\u0E38\u0E14\u0E1E\u0E49\u0E19\u0E04\u0E33\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C", t: 3, how: "\u0E1B\u0E23\u0E32\u0E1A\u0E19\u0E34\u0E21\u0E34\u0E15\u0E23\u0E32 \u0E21\u0E31\u0E07\u0E01\u0E23\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C", test: (s) => (s.raids?.r2?.kills || 0) > 0, b: { crit: 0.03 } },
  { id: "judgment", name: "\u0E1C\u0E39\u0E49\u0E23\u0E2D\u0E14\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32", t: 4, how: "\u0E1B\u0E23\u0E32\u0E1A\u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32", test: (s) => (s.raids?.r3?.kills || 0) > 0, b: { defPct: 0.06, hpPct: 0.03 } },
  { id: "raids", name: "\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E0A\u0E34\u0E15\u0E2A\u0E32\u0E21\u0E21\u0E31\u0E07\u0E01\u0E23\u0E1F\u0E49\u0E32", t: 4, how: "\u0E1B\u0E23\u0E32\u0E1A\u0E1A\u0E2D\u0E2A\u0E14\u0E31\u0E19\u0E1E\u0E34\u0E40\u0E28\u0E29\u0E04\u0E23\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E32\u0E21 25 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E15\u0E48\u0E2D\u0E15\u0E31\u0E27", test: (s) => RAIDS.every((r) => (s.raids?.[r.id]?.kills || 0) >= 25), b: { atkPct: 0.05, crit: 0.02 } },
  // ---- the tower
  { id: "tower10", name: "\u0E1C\u0E39\u0E49\u0E02\u0E49\u0E32\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13", t: 1, how: "\u0E1C\u0E48\u0E32\u0E19\u0E2B\u0E2D\u0E04\u0E2D\u0E22\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E0A\u0E31\u0E49\u0E19 10", test: (s) => towerDeep(s) >= 10, b: { hpPct: 0.03 } },
  { id: "tower30", name: "\u0E1C\u0E39\u0E49\u0E25\u0E38\u0E22\u0E44\u0E1F\u0E19\u0E23\u0E01", t: 2, how: "\u0E1C\u0E48\u0E32\u0E19\u0E2B\u0E2D\u0E04\u0E2D\u0E22\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E0A\u0E31\u0E49\u0E19 30", test: (s) => towerDeep(s) >= 30, b: { atkPct: 0.03, hpPct: 0.02 } },
  { id: "tower50", name: "\u0E1C\u0E39\u0E49\u0E1C\u0E48\u0E32\u0E19\u0E15\u0E32\u0E0A\u0E31\u0E48\u0E07", t: 3, how: "\u0E1C\u0E48\u0E32\u0E19\u0E2B\u0E2D\u0E04\u0E2D\u0E22\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E0A\u0E31\u0E49\u0E19 50", test: (s) => towerDeep(s) >= 50, b: { defPct: 0.05, critMult: 0.08 } },
  { id: "tower70", name: "\u0E1C\u0E39\u0E49\u0E2B\u0E22\u0E38\u0E14\u0E40\u0E02\u0E47\u0E21\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32", t: 3, how: "\u0E1C\u0E48\u0E32\u0E19\u0E2B\u0E2D\u0E04\u0E2D\u0E22\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E0A\u0E31\u0E49\u0E19 70", test: (s) => towerDeep(s) >= 70, b: { atkPct: 0.05, spd: 0.03 } },
  { id: "tower100", name: "\u0E1C\u0E39\u0E49\u0E42\u0E04\u0E48\u0E19\u0E1A\u0E31\u0E25\u0E25\u0E31\u0E07\u0E01\u0E4C\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01", t: 5, how: "\u0E1C\u0E48\u0E32\u0E19\u0E2B\u0E2D\u0E04\u0E2D\u0E22\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E0A\u0E31\u0E49\u0E19 100", test: (s) => towerDeep(s) >= 100, b: { atkPct: 0.07, hpPct: 0.07, crit: 0.03 } },
  { id: "asc3", name: "\u0E1C\u0E39\u0E49\u0E14\u0E33\u0E14\u0E34\u0E48\u0E07\u0E2A\u0E32\u0E21\u0E02\u0E38\u0E21", t: 5, how: "\u0E44\u0E1B\u0E16\u0E36\u0E07\u0E02\u0E38\u0E21\u0E25\u0E36\u0E01 3", test: (s) => (s.tower?.bestAsc || 0) >= 3, b: { atkPct: 0.08, critMult: 0.2 } },
  { id: "gods5", name: "\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E07\u0E2B\u0E32\u0E23\u0E40\u0E17\u0E1E", t: 4, how: "\u0E1B\u0E23\u0E32\u0E1A\u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01 5 \u0E2D\u0E07\u0E04\u0E4C", test: (s) => gods(s) >= 5, b: { critMult: 0.15, atkPct: 0.03 } },
  { id: "gods10", name: "\u0E21\u0E2B\u0E32\u0E01\u0E32\u0E2C\u0E04\u0E19\u0E43\u0E2B\u0E21\u0E48", t: 5, how: "\u0E1B\u0E23\u0E32\u0E1A\u0E40\u0E17\u0E1E\u0E41\u0E2B\u0E48\u0E07\u0E02\u0E38\u0E21\u0E19\u0E23\u0E01\u0E04\u0E23\u0E1A 10 \u0E2D\u0E07\u0E04\u0E4C", test: (s) => gods(s) >= GODS.length, b: { atkPct: 0.06, defPct: 0.06, hpPct: 0.06 } },
  // ---- companions and blood
  { id: "pets10", name: "\u0E21\u0E34\u0E15\u0E23\u0E02\u0E2D\u0E07\u0E2A\u0E23\u0E23\u0E1E\u0E2A\u0E31\u0E15\u0E27\u0E4C", t: 1, how: "\u0E21\u0E35\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07 15 \u0E0A\u0E19\u0E34\u0E14", test: (s) => cnt(s.pets?.owned) >= 15, b: { goldMult: 0.06 } },
  { id: "pets25", name: "\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07\u0E1D\u0E39\u0E07\u0E2D\u0E2A\u0E39\u0E23", t: 3, how: "\u0E21\u0E35\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07 30 \u0E0A\u0E19\u0E34\u0E14", test: (s) => cnt(s.pets?.owned) >= 30, b: { skillPower: 0.08 } },
  { id: "petsAll", name: "\u0E23\u0E32\u0E0A\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07", t: 5, how: "\u0E21\u0E35\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E0A\u0E19\u0E34\u0E14", test: (s) => cnt(s.pets?.owned) >= Object.keys(PETS).length, b: { skillPower: 0.12, hpPct: 0.04 } },
  { id: "pet5star", name: "\u0E04\u0E39\u0E48\u0E2B\u0E39\u0E2B\u0E49\u0E32\u0E14\u0E32\u0E27", t: 2, how: "\u0E21\u0E35\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07\u0E2B\u0E49\u0E32\u0E14\u0E32\u0E27 1 \u0E15\u0E31\u0E27", test: fiveStar, b: { skillPower: 0.05 } },
  { id: "races10", name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E1C\u0E2A\u0E21", t: 2, how: "\u0E40\u0E04\u0E22\u0E40\u0E1B\u0E47\u0E19 15 \u0E40\u0E1C\u0E48\u0E32", test: (s) => cnt(s.raceSeen) >= 15, b: { hpPct: 0.03 } },
  { id: "races25", name: "\u0E1C\u0E39\u0E49\u0E08\u0E14\u0E08\u0E33\u0E1A\u0E23\u0E23\u0E1E\u0E0A\u0E19", t: 3, how: "\u0E40\u0E04\u0E22\u0E40\u0E1B\u0E47\u0E19 30 \u0E40\u0E1C\u0E48\u0E32", test: (s) => cnt(s.raceSeen) >= 30, b: { atkPct: 0.03, defPct: 0.03 } },
  { id: "racesAll", name: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E17\u0E31\u0E49\u0E07\u0E1B\u0E27\u0E07", t: 5, how: "\u0E40\u0E04\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E40\u0E1C\u0E48\u0E32", test: (s) => cnt(s.raceSeen) >= Object.keys(RACES).length, b: { atkPct: 0.05, hpPct: 0.05, crit: 0.02 } },
  { id: "raceLegend", name: "\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E15\u0E33\u0E19\u0E32\u0E19", t: 3, how: "\u0E44\u0E14\u0E49\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E15\u0E33\u0E19\u0E32\u0E19", test: (s) => Object.keys(s.raceSeen || {}).some((id) => RACES[id]?.rarity === "legendary"), b: { critMult: 0.1 } },
  // ---- the forge and the bag
  { id: "craft1", name: "\u0E25\u0E39\u0E01\u0E28\u0E34\u0E29\u0E22\u0E4C\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19", t: 1, how: "\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E35\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C 1 \u0E0A\u0E34\u0E49\u0E19", test: (s) => s.stats.crafted >= 1, b: { defPct: 0.02 } },
  { id: "craft25", name: "\u0E0A\u0E48\u0E32\u0E07\u0E15\u0E35\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E48\u0E32\u0E22", t: 3, how: "\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E35\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C 60 \u0E0A\u0E34\u0E49\u0E19", test: (s) => s.stats.crafted >= 60, b: { defPct: 0.05 } },
  { id: "up10", name: "\u0E1C\u0E39\u0E49\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E2A\u0E34\u0E1A", t: 2, how: "\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E16\u0E36\u0E07 +12", test: (s) => maxUpgrade(s) >= 12, b: { atkPct: 0.03 } },
  { id: "up15", name: "\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E01\u0E25\u0E31\u0E27\u0E40\u0E15\u0E32\u0E41\u0E15\u0E01", t: 3, how: "\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E16\u0E36\u0E07 +15", test: (s) => maxUpgrade(s) >= 15, b: { atkPct: 0.04, critMult: 0.08 } },
  { id: "up20", name: "\u0E0A\u0E48\u0E32\u0E07\u0E15\u0E35\u0E40\u0E17\u0E1E", t: 5, how: "\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E16\u0E36\u0E07 +20", test: (s) => maxUpgrade(s) >= 20, b: { atkPct: 0.07, defPct: 0.04 } },
  { id: "mythic", name: "\u0E1C\u0E39\u0E49\u0E16\u0E37\u0E2D\u0E02\u0E2D\u0E07\u0E40\u0E17\u0E1E\u0E15\u0E33\u0E19\u0E32\u0E19", t: 4, how: "\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E23\u0E2D\u0E07\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E40\u0E17\u0E1E\u0E15\u0E33\u0E19\u0E32\u0E19", test: (s) => ownsRarity(s, "mythic"), b: { crit: 0.03, critMult: 0.1 } },
  { id: "rich", name: "\u0E40\u0E28\u0E23\u0E29\u0E10\u0E35\u0E41\u0E2B\u0E48\u0E07\u0E04\u0E48\u0E32\u0E22\u0E16\u0E48\u0E32\u0E19", t: 2, how: "\u0E21\u0E35\u0E17\u0E2D\u0E07 1,000,000", test: (s) => s.gold >= 1e6, b: { goldMult: 0.12 } },
  // ---- skill and nerve
  { id: "pvp10", name: "\u0E1C\u0E39\u0E49\u0E17\u0E49\u0E32\u0E14\u0E27\u0E25", t: 2, how: "\u0E0A\u0E19\u0E30 PvP 25 \u0E04\u0E23\u0E31\u0E49\u0E07", test: (s) => (s.pvp?.wins || 0) >= 25, b: { atkPct: 0.02, crit: 0.01 } },
  { id: "pvp50", name: "\u0E41\u0E0A\u0E21\u0E1B\u0E4C\u0E25\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E25\u0E2D\u0E07", t: 4, how: "\u0E0A\u0E19\u0E30 PvP 100 \u0E04\u0E23\u0E31\u0E49\u0E07", test: (s) => (s.pvp?.wins || 0) >= 100, b: { atkPct: 0.04, crit: 0.02 } },
  { id: "rift25", name: "\u0E1C\u0E39\u0E49\u0E08\u0E49\u0E2D\u0E07\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01", t: 2, how: "\u0E23\u0E2D\u0E14\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01\u0E44\u0E23\u0E49\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14\u0E16\u0E36\u0E07\u0E04\u0E25\u0E37\u0E48\u0E19 35", test: (s) => (s.infinite?.best || 0) >= 35, b: { hpPct: 0.04 } },
  { id: "rift60", name: "\u0E1C\u0E39\u0E49\u0E01\u0E25\u0E37\u0E19\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01", t: 4, how: "\u0E23\u0E2D\u0E14\u0E23\u0E2D\u0E22\u0E41\u0E22\u0E01\u0E44\u0E23\u0E49\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14\u0E16\u0E36\u0E07\u0E04\u0E25\u0E37\u0E48\u0E19 80", test: (s) => (s.infinite?.best || 0) >= 80, b: { hpPct: 0.06, defPct: 0.03 } },
  { id: "perfect500", name: "\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E08\u0E31\u0E1A\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49", t: 3, how: "\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C 1,000 \u0E04\u0E23\u0E31\u0E49\u0E07", test: (s) => (s.stats.perfects || 0) >= 1e3, b: { spd: 0.04, crit: 0.02 } },
  { id: "parry300", name: "\u0E42\u0E25\u0E48\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E1E\u0E25\u0E32\u0E14", t: 3, how: "\u0E41\u0E1E\u0E23\u0E4C\u0E23\u0E35\u0E48 600 \u0E04\u0E23\u0E31\u0E49\u0E07", test: (s) => (s.stats.parries || 0) >= 600, b: { defPct: 0.04, critMult: 0.1 } },
  { id: "arts15", name: "\u0E1C\u0E39\u0E49\u0E1B\u0E25\u0E39\u0E01\u0E15\u0E49\u0E19\u0E44\u0E21\u0E49\u0E08\u0E31\u0E01\u0E23\u0E27\u0E32\u0E25", t: 3, how: "\u0E21\u0E35\u0E2D\u0E32\u0E23\u0E4C\u0E15\u0E34\u0E41\u0E1F\u0E01\u0E15\u0E4C 15 \u0E0A\u0E34\u0E49\u0E19", test: (s) => cnt(s.artifacts?.owned) >= 15, b: { skillPower: 0.06, hpPct: 0.02 } },
  // ---- v8: skills, ultimates, the boss arena, the secret weapon
  { id: "skills30", name: "\u0E04\u0E31\u0E21\u0E20\u0E35\u0E23\u0E4C\u0E40\u0E14\u0E34\u0E19\u0E44\u0E14\u0E49", t: 3, how: "\u0E40\u0E23\u0E35\u0E22\u0E19\u0E2A\u0E01\u0E34\u0E25 30 \u0E0A\u0E19\u0E34\u0E14", test: (s) => cnt(s.skills?.ranks) >= 30, b: { skillPower: 0.06 } },
  { id: "ult100", name: "\u0E1C\u0E39\u0E49\u0E1B\u0E25\u0E14\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E44\u0E21\u0E49\u0E15\u0E32\u0E22", t: 3, how: "\u0E43\u0E0A\u0E49\u0E17\u0E48\u0E32\u0E44\u0E21\u0E49\u0E15\u0E32\u0E22 100 \u0E04\u0E23\u0E31\u0E49\u0E07", test: (s) => (s.stats.ults || 0) >= 100, b: { critMult: 0.1, skillPower: 0.04 } },
  { id: "bossrush", name: "\u0E1C\u0E39\u0E49\u0E23\u0E2D\u0E14\u0E25\u0E32\u0E19\u0E40\u0E08\u0E49\u0E32\u0E1A\u0E2D\u0E2A", t: 4, how: "\u0E1C\u0E48\u0E32\u0E19\u0E25\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E25\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E41\u0E2B\u0E48\u0E07\u0E1A\u0E2D\u0E2A", test: (s) => (s.stats.bossRush || 0) >= 1, b: { atkPct: 0.05, hpPct: 0.04 } },
  { id: "eclipse", name: "\u0E1C\u0E39\u0E49\u0E16\u0E37\u0E2D\u0E04\u0E23\u0E32\u0E2A\u0E41\u0E2B\u0E48\u0E07\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30", t: 5, how: "\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E23\u0E2D\u0E07\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E25\u0E31\u0E1A", test: (s) => [s.equipment?.weapon, ...s.inventory?.slots || []].some((x) => x && x.id === "w_eclipse_blade"), b: { atkPct: 0.06, crit: 0.03, critMult: 0.12 } }
]);
var TITLE_TIERS = Object.freeze({ 1: { name: "\u0E2A\u0E33\u0E23\u0E34\u0E14", color: "#c8905a" }, 2: { name: "\u0E40\u0E07\u0E34\u0E19", color: "#cfd6e6" }, 3: { name: "\u0E17\u0E2D\u0E07", color: "#f5c35a" }, 4: { name: "\u0E16\u0E48\u0E32\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07", color: "#ff7a3a" }, 5: { name: "\u0E40\u0E17\u0E1E\u0E15\u0E33\u0E19\u0E32\u0E19", color: "#ff5f7a" } });
var BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));
var getTitle = (id) => BY_ID[id] || null;
var BADGE_EVERY = 5;
var badgeTier = (state) => Math.floor(Object.keys(state.titles?.owned || {}).filter((id) => BY_ID[id]).length / BADGE_EVERY);
var BADGE_NAMES = Object.freeze(["", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 I", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 II", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 III", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 IV", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 V", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 VI", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 VII", "\u0E15\u0E23\u0E32\u0E40\u0E01\u0E35\u0E22\u0E23\u0E15\u0E34\u0E22\u0E28 VIII"]);

// src/config/balance.js
var BALANCE = Object.freeze({
  player: {
    baseHp: 100,
    hpPerLevel: 12,
    baseAtk: 6,
    atkPerLevel: 1.5,
    baseDef: 2,
    defPerLevel: 0.8,
    baseSpeed: 230,
    // world px / second
    baseCrit: 0.05,
    baseCritMult: 1.5,
    maxLevel: 100,
    xpCurveBase: 40,
    xpCurveExp: 1.4,
    radius: 20
  },
  combat: {
    defenseK: 30,
    // damage multiplier = K / (K + def)
    variance: 0.1,
    // +/- 10%
    minDamage: 1,
    critChanceCap: 0.75,
    // Weapon movesets live in data/weapons.js. comboWindow = time after a move ends in which the next tap continues the chain.
    attack: { comboWindow: 0.62, branchDelay: 0.2, chargeDelay: 0.16, dashAttackWindow: 0.28 },
    // Dodge: charges refill one at a time. A hit that lands in the first `perfectWindow` seconds of a dodge = perfect dodge.
    dash: { duration: 0.18, speedMult: 3.1, cooldown: 1.1, charges: 2, perfectWindow: 0.16, blinkDuration: 0.12, blinkSpeedMult: 3.9 },
    perfect: { slowmo: 0.55, timeScale: 0.3, empowerT: 2.5, empowerPower: 0.3 },
    // Chain hits without getting hurt; the counter resets after `resetAfter` seconds without a hit.
    combo: { resetAfter: 3, tiers: [{ at: 10, bonus: 0.05 }, { at: 25, bonus: 0.1 }, { at: 50, bonus: 0.2 }] },
    // Bosses have poise: hits wear it down (perHit × move power); at zero the boss is stunned and takes extra damage.
    poise: { max: 100, perHit: 7, regenDelay: 2.5, regenRate: 14, breakStun: 2.2, breakBonus: 0.3 },
    burn: { ticks: 4, interval: 0.5, power: 0.12 },
    hurtIFrames: 0.6,
    potion: { healPct: 0.35, cooldown: 6 },
    autoAimRange: 280
  },
  inventory: { capacity: 30, maxStack: 99 },
  // ขยายกระเป๋า: +5 ช่องต่อครั้ง ราคาสูงขึ้นทุกครั้งไม่มีที่สิ้นสุด (cost of the n-th expansion, n from 0)
  bag: { step: 5, base: 400, growth: 1.15, linear: 300, maxLevel: 400 },
  pickup: { magnetRadius: 90, collectRadius: 26, flySpeed: 620 },
  upgrade: {
    maxLevel: 20,
    statGrowthPerLevel: 0.12,
    // +12% of base stats per level up to +10
    statGrowthHigh: 0.08,
    // v7: +8% per level from +11 to +20
    successRate: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.22, 0.19, 0.16, 0.13, 0.11, 0.09, 0.07, 0.05, 0.04],
    // index = current level (v8: harder)
    downgradeFrom: 12,
    // v8: a failed attempt from +12 up drops the item one level (was +15)
    goldBase: { common: 30, uncommon: 50, rare: 80, epic: 130, legendary: 200, mythic: 320 },
    goldGrowth: 0.75,
    // cost *= 1 + L * growth (v8: was 0.6)
    // Materials by current level band. qty grows with level inside the band.
    materials: [
      { minLevel: 0, maxLevel: 3, items: [{ id: "m_iron_shard", base: 2, perLevel: 1 }] },
      { minLevel: 4, maxLevel: 6, items: [{ id: "m_iron_shard", base: 4, perLevel: 1 }, { id: "m_beast_hide", base: 1, perLevel: 1 }] },
      { minLevel: 7, maxLevel: 9, items: [{ id: "m_iron_shard", base: 6, perLevel: 1 }, { id: "m_beast_hide", base: 3, perLevel: 1 }, { id: "m_thorn_core", base: 1, perLevel: 0 }] },
      // v7: beyond +10 the forge needs bloodstones from bosses, then relics of the Underworld Tower's gods
      { minLevel: 10, maxLevel: 14, items: [{ id: "m_iron_shard", base: 10, perLevel: 2 }, { id: "m_thorn_core", base: 2, perLevel: 0 }, { id: "m_bloodstone", base: 1, perLevel: 0 }] },
      { minLevel: 15, maxLevel: 17, items: [{ id: "m_iron_shard", base: 20, perLevel: 3 }, { id: "m_bloodstone", base: 2, perLevel: 0 }, { id: "m_hell1", base: 2, perLevel: 1 }] },
      { minLevel: 18, maxLevel: 19, items: [{ id: "m_iron_shard", base: 30, perLevel: 5 }, { id: "m_bloodstone", base: 3, perLevel: 0 }, { id: "m_hell3", base: 2, perLevel: 1 }] }
    ]
  },
  economy: {
    // v9.3.1: epic (purple) gear sells for 50% more (was 160)
    sellEquipBase: { common: 8, uncommon: 30, rare: 75, epic: 240, legendary: 300, mythic: 900 },
    sellUpgradeBonus: 0.5,
    // sell price = base * (1 + lvl * bonus) + refund share of the forge gold spent
    sellRefundRate: 0.25
  },
  firstClearBonusGold: 100,
  // Amber Sparks (pet summons). Boss kills give the `sparks` listed on the enemy.
  sparks: { chest: { small: 1, key: 2, rare: 3 }, loreFirst: 2, firstClear: 10 }
});

// src/data/skillbook.js
var r2 = (x) => Math.round(x * 100) / 100;
var rk = (a, s = 0.18) => [r2(a), r2(a * (1 + s)), r2(a * (1 + 2 * s))];
var cd = (a) => [Math.round(a * 10) / 10, Math.round(a * 9.2) / 10, Math.round(a * 8.4) / 10];
var fl = (a, s = 0.08) => [Math.round(a), Math.round(a * (1 + s)), Math.round(a * (1 + 2 * s))];
var same = (a) => [a, a, a];
var P = (v) => `${Math.round(v * 100)}%`;
function A2(id, name, rarity, cat, el, icon, unlock, cooldown, cast, nums, opt, flaw, desc, lore) {
  return [id, Object.freeze({ id, name, rarity, kind: "active", cat, el, icon: "whirl", art: icon, maxRank: 3, unlock, cooldown, cast, ...nums, opt: Object.freeze(opt || {}), flaw: flaw ? Object.freeze(flaw) : null, desc, lore })];
}
function S(id, name, rarity, el, icon, unlock, nums, desc, lore) {
  return [id, Object.freeze({ id, name, rarity, kind: "passive", cat: "pas", el, icon: "eye", art: icon, maxRank: 3, unlock, ...nums, desc, lore })];
}
var SKILLBOOK = Object.freeze(Object.fromEntries([
  // ================================================================= area (bursts around the hero)
  A2(
    "frost_nova",
    "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E22\u0E37\u0E2D\u0E01\u0E41\u0E02\u0E47\u0E07",
    "uncommon",
    "area",
    "ice",
    { m: "nova", n: 6 },
    { level: 3 },
    cd(8),
    "nova",
    { power: rk(1.2), radius: fl(140), slow: same(0.45) },
    { kb: 120, crack: false, rune: 6 },
    { slow: 0.8, slowT: 1 },
    (r) => `\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E44\u0E2D\u0E40\u0E22\u0E47\u0E19\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E0A\u0E49\u0E32\u0E25\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D ${P(r.slow)}`,
    "\u0E19\u0E49\u0E33\u0E04\u0E49\u0E32\u0E07\u0E41\u0E02\u0E47\u0E07\u0E17\u0E35\u0E48\u0E0B\u0E48\u0E2D\u0E19\u0E43\u0E19\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08"
  ),
  A2(
    "thunder_clap",
    "\u0E1B\u0E23\u0E1A\u0E1F\u0E49\u0E32\u0E04\u0E33\u0E23\u0E32\u0E21",
    "rare",
    "area",
    "volt",
    { m: "nova", n: 8 },
    { level: 7 },
    cd(9),
    "nova",
    { power: rk(1.5), radius: fl(150), stun: same(0.7) },
    { kb: 200, rays: 12, sound: "crit" },
    { root: 0.35 },
    (r) => `\u0E15\u0E1A\u0E21\u0E37\u0E2D\u0E40\u0E23\u0E35\u0E22\u0E01\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E0A\u0E30\u0E07\u0E31\u0E01 ${r.stun} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1F\u0E49\u0E32\u0E14\u0E31\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E41\u0E2A\u0E07\u0E40\u0E2A\u0E21\u0E2D \u0E41\u0E15\u0E48\u0E04\u0E23\u0E31\u0E49\u0E07\u0E19\u0E35\u0E49\u0E21\u0E32\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E01\u0E31\u0E19"
  ),
  A2(
    "shadow_burst",
    "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E07\u0E32",
    "rare",
    "area",
    "shadow",
    { m: "nova", n: 5 },
    { level: 9 },
    cd(10),
    "nova",
    { power: rk(1.9), radius: fl(160), mark: same(0.2) },
    { kb: 260, rune: 5 },
    { selfDmg: 0.04 },
    (r) => `\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E0B\u0E48\u0E2D\u0E19\u0E43\u0E19\u0E15\u0E31\u0E27\u0E2D\u0E2D\u0E01\u0E21\u0E32 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E42\u0E14\u0E19\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E40\u0E1E\u0E34\u0E48\u0E21 ${P(r.mark)} \u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E39\u0E48`,
    "\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E01\u0E34\u0E19\u0E41\u0E2A\u0E07\u0E21\u0E32\u0E19\u0E32\u0E19 \u0E22\u0E48\u0E2D\u0E21\u0E2D\u0E22\u0E32\u0E01\u0E04\u0E37\u0E19\u0E04\u0E27\u0E32\u0E21\u0E21\u0E37\u0E14\u0E43\u0E2B\u0E49\u0E42\u0E25\u0E01"
  ),
  A2(
    "holy_pulse",
    "\u0E04\u0E25\u0E37\u0E48\u0E19\u0E41\u0E2A\u0E07\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C",
    "epic",
    "area",
    "holy",
    { m: "nova", n: 12 },
    { level: 14 },
    cd(12),
    "nova",
    { power: rk(0.9), radius: fl(150), heal: same(0.03) },
    { pulses: 3, gap: 0.35, grow: 0.25, rune: 8, rays: 16 },
    { root: 0.7 },
    (r) => `\u0E41\u0E1C\u0E48\u0E04\u0E25\u0E37\u0E48\u0E19\u0E41\u0E2A\u0E07 3 \u0E23\u0E30\u0E25\u0E2D\u0E01 \u0E41\u0E15\u0E48\u0E25\u0E30\u0E23\u0E30\u0E25\u0E2D\u0E01 ${P(r.power)} \u0E02\u0E22\u0E32\u0E22\u0E27\u0E07\u0E02\u0E36\u0E49\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E22\u0E46 \u0E41\u0E25\u0E30\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 ${P(r.heal)} \u0E17\u0E38\u0E01\u0E23\u0E30\u0E25\u0E2D\u0E01`,
    "\u0E1A\u0E17\u0E2A\u0E27\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E08\u0E33\u0E04\u0E33\u0E44\u0E14\u0E49 \u0E41\u0E15\u0E48\u0E17\u0E38\u0E01\u0E04\u0E19\u0E08\u0E33\u0E41\u0E2A\u0E07\u0E44\u0E14\u0E49"
  ),
  A2(
    "quake_stomp",
    "\u0E01\u0E23\u0E30\u0E17\u0E37\u0E1A\u0E18\u0E23\u0E13\u0E35",
    "uncommon",
    "area",
    "earth",
    { m: "slam", n: 7 },
    { level: 5 },
    cd(7),
    "nova",
    { power: rk(1.4), radius: fl(130) },
    { kb: 420, crack: true, shake: 10, sound: "slam" },
    { root: 0.3 },
    (r) => `\u0E01\u0E23\u0E30\u0E17\u0E37\u0E1A\u0E1E\u0E37\u0E49\u0E19\u0E08\u0E19\u0E41\u0E15\u0E01\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E1C\u0E25\u0E31\u0E01\u0E28\u0E31\u0E15\u0E23\u0E39\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E44\u0E01\u0E25`,
    "\u0E20\u0E39\u0E40\u0E02\u0E32\u0E01\u0E47\u0E40\u0E23\u0E34\u0E48\u0E21\u0E08\u0E32\u0E01\u0E2B\u0E34\u0E19\u0E01\u0E49\u0E2D\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E40\u0E2B\u0E22\u0E35\u0E22\u0E1A"
  ),
  A2(
    "blood_nova",
    "\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E42\u0E25\u0E2B\u0E34\u0E15",
    "epic",
    "area",
    "blood",
    { m: "nova", n: 9 },
    { boss: 8 },
    cd(11),
    "nova",
    { power: rk(2.8), radius: fl(170) },
    { kb: 300, crack: true, rays: 14 },
    { selfDmg: 0.09, minHp: 0.12 },
    (r) => `\u0E08\u0E38\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E43\u0E19\u0E01\u0E32\u0E22\u0E43\u0E2B\u0E49\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E2D\u0E2D\u0E01 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius}`,
    "\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E21\u0E35\u0E23\u0E32\u0E04\u0E32 \u0E41\u0E25\u0E30\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E04\u0E37\u0E2D\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E31\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14"
  ),
  A2(
    "starfall_ring",
    "\u0E27\u0E07\u0E14\u0E32\u0E23\u0E32\u0E23\u0E48\u0E27\u0E07",
    "legendary",
    "area",
    "star",
    { m: "ring", n: 10 },
    { tower: 20 },
    cd(14),
    "nova",
    { power: rk(1.3), radius: fl(130) },
    { pulses: 4, gap: 0.28, grow: 0.4, rune: 10, rays: 20 },
    { expose: 0.2, exposeT: 2.5 },
    (r) => `\u0E27\u0E07\u0E14\u0E32\u0E27\u0E15\u0E01\u0E0B\u0E49\u0E2D\u0E19 4 \u0E27\u0E07\u0E02\u0E22\u0E32\u0E22\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E15\u0E31\u0E27 \u0E27\u0E07\u0E25\u0E30 ${P(r.power)} \u0E27\u0E07\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E01\u0E27\u0E49\u0E32\u0E07\u0E40\u0E01\u0E37\u0E2D\u0E1A\u0E2A\u0E2D\u0E07\u0E40\u0E17\u0E48\u0E32`,
    "\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E23\u0E48\u0E27\u0E07\u0E15\u0E32\u0E21\u0E40\u0E08\u0E49\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E48\u0E27\u0E07\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E41\u0E1E\u0E49 \u0E41\u0E15\u0E48\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E08\u0E30\u0E25\u0E07\u0E21\u0E32"
  ),
  // ================================================================= movement (dashes, blinks, leaps)
  A2(
    "lightning_dash",
    "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E41\u0E25\u0E1A",
    "rare",
    "move",
    "volt",
    { m: "dash", n: 3 },
    { level: 8 },
    cd(6),
    "dash",
    { power: rk(1.5), distance: fl(320) },
    { zap: true, time: 0.16 },
    { selfDmg: 0.03 },
    (r) => `\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E1E\u0E38\u0E48\u0E07 ${r.distance} \u0E2B\u0E19\u0E48\u0E27\u0E22 \u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19 ${P(r.power)} \u0E41\u0E25\u0E49\u0E27\u0E1F\u0E49\u0E32\u0E41\u0E25\u0E1A\u0E0B\u0E49\u0E33\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E43\u0E01\u0E25\u0E49\u0E17\u0E32\u0E07`,
    "\u0E40\u0E23\u0E47\u0E27\u0E01\u0E27\u0E48\u0E32\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14 \u0E0A\u0E49\u0E32\u0E01\u0E27\u0E48\u0E32\u0E04\u0E27\u0E32\u0E21\u0E01\u0E25\u0E31\u0E27"
  ),
  A2(
    "phantom_rush",
    "\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E07\u0E32\u0E0B\u0E49\u0E2D\u0E19",
    "epic",
    "move",
    "shadow",
    { m: "dash", n: 5 },
    { level: 15 },
    cd(9),
    "multidash",
    { power: rk(1.1), distance: fl(220) },
    { count: 3 },
    { dodge: true },
    (r) => `\u0E1E\u0E38\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E01\u0E31\u0E19 3 \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E41\u0E15\u0E48\u0E25\u0E30\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E25\u0E47\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30 ${P(r.power)}`,
    "\u0E40\u0E07\u0E32\u0E2A\u0E32\u0E21\u0E23\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E48\u0E32\u0E07\u0E44\u0E2B\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E08\u0E23\u0E34\u0E07"
  ),
  A2(
    "comet_charge",
    "\u0E1E\u0E38\u0E48\u0E07\u0E14\u0E32\u0E27\u0E2B\u0E32\u0E07",
    "rare",
    "move",
    "fire",
    { m: "dash", n: 7 },
    { level: 11 },
    cd(9),
    "dash",
    { power: rk(1.3), distance: fl(380) },
    { end: 150, endMult: 1.4, time: 0.26 },
    { expose: 0.25, exposeT: 1.5 },
    (r) => `\u0E1E\u0E38\u0E48\u0E07\u0E44\u0E01\u0E25 ${r.distance} \u0E2B\u0E19\u0E48\u0E27\u0E22 ${P(r.power)} \u0E41\u0E25\u0E49\u0E27\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E15\u0E23\u0E07\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E2B\u0E22\u0E38\u0E14`,
    "\u0E14\u0E32\u0E27\u0E2B\u0E32\u0E07\u0E44\u0E21\u0E48\u0E2B\u0E31\u0E19\u0E2B\u0E25\u0E31\u0E07 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E40\u0E1C\u0E32\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32"
  ),
  A2(
    "dragon_rush",
    "\u0E21\u0E31\u0E07\u0E01\u0E23\u0E17\u0E30\u0E22\u0E32\u0E19",
    "epic",
    "move",
    "fire",
    { m: "dash", n: 9 },
    { zone: "z8" },
    cd(10),
    "dash",
    { power: rk(1.6), distance: fl(340) },
    { trailField: 3, motif: "flame", burn: true },
    null,
    (r) => `\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E21\u0E31\u0E07\u0E01\u0E23\u0E40\u0E1E\u0E25\u0E34\u0E07 ${r.distance} \u0E2B\u0E19\u0E48\u0E27\u0E22 ${P(r.power)} \u0E17\u0E34\u0E49\u0E07\u0E17\u0E32\u0E07\u0E44\u0E1F\u0E40\u0E1C\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E40\u0E14\u0E34\u0E19\u0E1C\u0E48\u0E32\u0E19`,
    "\u0E25\u0E32\u0E27\u0E32\u0E08\u0E33\u0E17\u0E32\u0E07\u0E17\u0E35\u0E48\u0E21\u0E31\u0E07\u0E01\u0E23\u0E40\u0E04\u0E22\u0E1C\u0E48\u0E32\u0E19"
  ),
  A2(
    "shadow_step",
    "\u0E01\u0E49\u0E32\u0E27\u0E40\u0E07\u0E32",
    "rare",
    "move",
    "shadow",
    { m: "blink", n: 4 },
    { level: 10 },
    cd(7),
    "blink",
    { power: rk(2.2), range: fl(420) },
    { cuts: 3 },
    { expose: 0.3, exposeT: 1.2 },
    (r) => `\u0E2B\u0E32\u0E22\u0E27\u0E31\u0E1A\u0E44\u0E1B\u0E42\u0E1C\u0E25\u0E48\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14\u0E43\u0E19\u0E23\u0E30\u0E22\u0E30 ${r.range} \u0E41\u0E25\u0E49\u0E27\u0E1F\u0E31\u0E19\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19 ${P(r.power)}`,
    "\u0E40\u0E07\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E40\u0E14\u0E34\u0E19 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E19\u0E41\u0E25\u0E49\u0E27"
  ),
  A2(
    "mirage_strike",
    "\u0E20\u0E32\u0E1E\u0E25\u0E27\u0E07\u0E15\u0E32\u0E1E\u0E31\u0E19\u0E23\u0E48\u0E32\u0E07",
    "legendary",
    "move",
    "arcane",
    { m: "blink", n: 8 },
    { tower: 30 },
    cd(13),
    "mirage",
    { power: rk(1.4) },
    { count: 5, gap: 0.13 },
    { selfDmg: 0.05 },
    (r) => `\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E02\u0E49\u0E32\u0E21\u0E21\u0E34\u0E15\u0E34\u0E1F\u0E31\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39 5 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 \u0E15\u0E31\u0E27\u0E25\u0E30 ${P(r.power)} (\u0E2A\u0E25\u0E31\u0E1A\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E44\u0E14\u0E49)`,
    "\u0E20\u0E32\u0E1E\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E2D\u0E32\u0E08\u0E08\u0E23\u0E34\u0E07\u0E2B\u0E21\u0E14\u0E17\u0E38\u0E01\u0E20\u0E32\u0E1E"
  ),
  A2(
    "sky_leap",
    "\u0E17\u0E30\u0E22\u0E32\u0E19\u0E1F\u0E49\u0E32",
    "uncommon",
    "move",
    "earth",
    { m: "leap", n: 5 },
    { level: 6 },
    cd(8),
    "leap",
    { power: rk(1.8), radius: fl(140) },
    { reach: 420 },
    { root: 0.4 },
    (r) => `\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E2A\u0E39\u0E07\u0E25\u0E07\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14 \u0E01\u0E23\u0E30\u0E41\u0E17\u0E01\u0E1E\u0E37\u0E49\u0E19 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius}`,
    "\u0E22\u0E34\u0E48\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E39\u0E07 \u0E22\u0E34\u0E48\u0E07\u0E25\u0E07\u0E2B\u0E19\u0E31\u0E01"
  ),
  // ================================================================= ranged (volleys, beams, crescents)
  A2(
    "arrow_storm",
    "\u0E1E\u0E32\u0E22\u0E38\u0E28\u0E23",
    "uncommon",
    "atk",
    "wind",
    { m: "volley", n: 7 },
    { level: 4 },
    cd(7),
    "volley",
    { power: rk(0.75), count: same(7) },
    { kind: "arrow", spread: 0.9, speed: 820, pierce: 1 },
    null,
    (r) => `\u0E22\u0E34\u0E07\u0E25\u0E39\u0E01\u0E28\u0E23\u0E1E\u0E31\u0E14 ${r.count} \u0E14\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E19\u0E27\u0E1E\u0E31\u0E14 \u0E14\u0E2D\u0E01\u0E25\u0E30 ${P(r.power)} \u0E17\u0E30\u0E25\u0E38\u0E44\u0E14\u0E49 1 \u0E15\u0E31\u0E27`,
    "\u0E1D\u0E19\u0E17\u0E35\u0E48\u0E15\u0E01\u0E02\u0E36\u0E49\u0E19\u0E1F\u0E49\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E25\u0E39\u0E01\u0E28\u0E23"
  ),
  A2(
    "ice_lances",
    "\u0E2B\u0E2D\u0E01\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07",
    "rare",
    "atk",
    "ice",
    { m: "volley", n: 3 },
    { zone: "z2" },
    cd(8),
    "volley",
    { power: rk(1.5), count: same(3) },
    { kind: "shard", spread: 0.35, speed: 760, pierce: 4, slow: 0.55, r: 12 },
    null,
    (r) => `\u0E1E\u0E38\u0E48\u0E07\u0E2B\u0E2D\u0E01\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07 ${r.count} \u0E40\u0E25\u0E48\u0E21 \u0E40\u0E25\u0E48\u0E21\u0E25\u0E30 ${P(r.power)} \u0E17\u0E30\u0E25\u0E38\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E42\u0E14\u0E19\u0E0A\u0E49\u0E32\u0E25\u0E07`,
    "\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E17\u0E35\u0E48\u0E04\u0E21\u0E01\u0E27\u0E48\u0E32\u0E40\u0E2B\u0E25\u0E47\u0E01 \u0E40\u0E1E\u0E23\u0E32\u0E30\u0E21\u0E31\u0E19\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E38\u0E48\u0E19"
  ),
  A2(
    "fire_orbs",
    "\u0E25\u0E39\u0E01\u0E44\u0E1F\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    "rare",
    "atk",
    "fire",
    { m: "orb", n: 5 },
    { level: 12 },
    cd(9),
    "volley",
    { power: rk(1), count: same(5) },
    { kind: "orb", spread: 1.6, speed: 420, homing: 4, life: 2.2, r: 11, burn: true, stagger: 0.08 },
    { root: 0.4 },
    (r) => `\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E25\u0E39\u0E01\u0E44\u0E1F ${r.count} \u0E25\u0E39\u0E01\u0E17\u0E35\u0E48\u0E44\u0E25\u0E48\u0E15\u0E32\u0E21\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2D\u0E07 \u0E25\u0E39\u0E01\u0E25\u0E30 ${P(r.power)} \u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E44\u0E1F`,
    "\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E40\u0E0A\u0E37\u0E49\u0E2D\u0E14\u0E49\u0E27\u0E22\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07"
  ),
  A2(
    "thousand_needles",
    "\u0E1E\u0E31\u0E19\u0E40\u0E02\u0E47\u0E21\u0E40\u0E07\u0E32",
    "uncommon",
    "atk",
    "steel",
    { m: "volley", n: 16 },
    { level: 5 },
    cd(8),
    "volley",
    { power: rk(0.32), count: same(16) },
    { kind: "knife", spread: 1.3, speed: 980, jitter: 0.25, r: 7, stagger: 0.02 },
    null,
    (r) => `\u0E2A\u0E32\u0E14\u0E40\u0E02\u0E47\u0E21 ${r.count} \u0E40\u0E25\u0E48\u0E21\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 \u0E40\u0E25\u0E48\u0E21\u0E25\u0E30 ${P(r.power)}`,
    "\u0E40\u0E02\u0E47\u0E21\u0E40\u0E25\u0E48\u0E21\u0E40\u0E14\u0E35\u0E22\u0E27\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E01\u0E25\u0E31\u0E27"
  ),
  A2(
    "star_shards",
    "\u0E40\u0E28\u0E29\u0E14\u0E32\u0E23\u0E32",
    "epic",
    "area",
    "star",
    { m: "volley", n: 10 },
    { level: 18 },
    cd(10),
    "volley",
    { power: rk(1.1), count: same(10) },
    { kind: "star", radial: true, speed: 620, pierce: 2, r: 10 },
    null,
    (r) => `\u0E41\u0E15\u0E01\u0E14\u0E32\u0E27\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E28\u0E29 ${r.count} \u0E0A\u0E34\u0E49\u0E19\u0E1E\u0E38\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E23\u0E2D\u0E1A\u0E17\u0E34\u0E28 \u0E0A\u0E34\u0E49\u0E19\u0E25\u0E30 ${P(r.power)} \u0E17\u0E30\u0E25\u0E38\u0E44\u0E14\u0E49 2 \u0E15\u0E31\u0E27`,
    "\u0E14\u0E32\u0E27\u0E41\u0E15\u0E01\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E32\u0E22 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E01\u0E23\u0E30\u0E08\u0E32\u0E22\u0E44\u0E1B\u0E2B\u0E32\u0E40\u0E08\u0E49\u0E32"
  ),
  A2(
    "spirit_wolves",
    "\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E2B\u0E21\u0E32\u0E1B\u0E48\u0E32",
    "epic",
    "atk",
    "wind",
    { m: "orb", n: 2 },
    { boss: 5 },
    cd(11),
    "volley",
    { power: rk(2.2), count: same(2) },
    { kind: "wolf", spread: 0.6, speed: 520, homing: 3.5, life: 2.4, r: 16, pierce: 2 },
    null,
    (r) => `\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E2B\u0E21\u0E32\u0E1B\u0E48\u0E32 ${r.count} \u0E15\u0E31\u0E27\u0E44\u0E25\u0E48\u0E01\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E15\u0E31\u0E27\u0E25\u0E30 ${P(r.power)} \u0E01\u0E31\u0E14\u0E17\u0E30\u0E25\u0E38\u0E44\u0E14\u0E49 2 \u0E15\u0E31\u0E27`,
    "\u0E1D\u0E39\u0E07\u0E17\u0E35\u0E48\u0E15\u0E32\u0E22\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27\u0E22\u0E31\u0E07\u0E27\u0E34\u0E48\u0E07\u0E15\u0E32\u0E21\u0E08\u0E48\u0E32\u0E1D\u0E39\u0E07"
  ),
  A2(
    "chakram",
    "\u0E08\u0E31\u0E01\u0E23\u0E1E\u0E34\u0E06\u0E32\u0E15",
    "epic",
    "atk",
    "steel",
    { m: "crescent", n: 1 },
    { level: 16 },
    cd(7),
    "crescent",
    { power: rk(2), length: fl(560) },
    { speed: 820, r: 46, th: 12 },
    null,
    (r) => `\u0E02\u0E27\u0E49\u0E32\u0E07\u0E08\u0E31\u0E01\u0E23\u0E04\u0E21\u0E01\u0E23\u0E34\u0E1A\u0E44\u0E1B\u0E44\u0E01\u0E25 ${r.length} \u0E2B\u0E19\u0E48\u0E27\u0E22 \u0E15\u0E31\u0E14\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E02\u0E27\u0E32\u0E07 ${P(r.power)}`,
    "\u0E27\u0E07\u0E01\u0E25\u0E21\u0E04\u0E37\u0E2D\u0E23\u0E39\u0E1B\u0E23\u0E48\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14"
  ),
  A2(
    "sun_lance",
    "\u0E2B\u0E2D\u0E01\u0E2A\u0E38\u0E23\u0E34\u0E22\u0E30",
    "rare",
    "atk",
    "holy",
    { m: "beam", n: 1 },
    { zone: "z5" },
    cd(9),
    "beam",
    { power: rk(2.6), length: fl(620) },
    { width: 26 },
    { root: 0.5 },
    (r) => `\u0E22\u0E34\u0E07\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E22\u0E32\u0E27 ${r.length} \u0E2B\u0E19\u0E48\u0E27\u0E22\u0E17\u0E30\u0E25\u0E38\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27 ${P(r.power)}`,
    "\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E04\u0E37\u0E2D\u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E25\u0E31\u0E07\u0E40\u0E25"
  ),
  A2(
    "void_ray",
    "\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E04\u0E27\u0E32\u0E21\u0E27\u0E48\u0E32\u0E07",
    "legendary",
    "atk",
    "void",
    { m: "beam", n: 3 },
    { tower: 40 },
    cd(13),
    "beam",
    { power: rk(5.4), length: fl(560) },
    { width: 30, ticks: 7, gap: 0.18, follow: true },
    { root: 1.3 },
    (r) => `\u0E22\u0E34\u0E07\u0E25\u0E33\u0E41\u0E2A\u0E07\u0E08\u0E32\u0E01\u0E04\u0E27\u0E32\u0E21\u0E27\u0E48\u0E32\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 7 \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E23\u0E27\u0E21 ${P(r.power)} \u0E22\u0E32\u0E27 ${r.length} \u0E2B\u0E19\u0E48\u0E27\u0E22`,
    "\u0E04\u0E27\u0E32\u0E21\u0E27\u0E48\u0E32\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E27\u0E48\u0E32\u0E07 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E2B\u0E34\u0E27"
  ),
  A2(
    "crescent_moon",
    "\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E01\u0E23\u0E35\u0E14\u0E1F\u0E49\u0E32",
    "rare",
    "atk",
    "star",
    { m: "crescent", n: 2 },
    { level: 13 },
    cd(7),
    "crescent",
    { power: rk(1.8), length: fl(600) },
    { r: 64, th: 18 },
    null,
    (r) => `\u0E1F\u0E31\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E40\u0E2A\u0E35\u0E49\u0E22\u0E27\u0E1E\u0E38\u0E48\u0E07\u0E44\u0E01\u0E25 ${r.length} \u0E2B\u0E19\u0E48\u0E27\u0E22 \u0E15\u0E31\u0E14\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27 ${P(r.power)}`,
    "\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E40\u0E15\u0E47\u0E21\u0E14\u0E27\u0E07 \u0E04\u0E21\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14"
  ),
  // ================================================================= sky (meteors, pillars, storms)
  A2(
    "meteor",
    "\u0E2D\u0E38\u0E01\u0E01\u0E32\u0E1A\u0E32\u0E15",
    "rare",
    "area",
    "fire",
    { m: "meteor", n: 1 },
    { level: 10 },
    cd(10),
    "meteor",
    { power: rk(3), radius: fl(150), count: same(1) },
    { delay: 0.75, rock: true, size: 26, shake: 12 },
    null,
    (r) => `\u0E40\u0E23\u0E35\u0E22\u0E01\u0E2D\u0E38\u0E01\u0E01\u0E32\u0E1A\u0E32\u0E15\u0E25\u0E07\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} (\u0E15\u0E01\u0E0A\u0E49\u0E32\u0E40\u0E25\u0E47\u0E01\u0E19\u0E49\u0E2D\u0E22)`,
    "\u0E1F\u0E49\u0E32\u0E01\u0E47\u0E21\u0E35\u0E27\u0E31\u0E19\u0E42\u0E01\u0E23\u0E18"
  ),
  A2(
    "hailstorm",
    "\u0E1E\u0E32\u0E22\u0E38\u0E25\u0E39\u0E01\u0E40\u0E2B\u0E47\u0E1A",
    "uncommon",
    "area",
    "ice",
    { m: "meteor", n: 8 },
    { level: 9 },
    cd(10),
    "meteor",
    { power: rk(0.7), radius: fl(70), count: same(8), slow: same(0.6) },
    { delay: 0.5, spread: 150, stagger: 0.12, size: 10 },
    null,
    (r) => `\u0E25\u0E39\u0E01\u0E40\u0E2B\u0E47\u0E1A ${r.count} \u0E25\u0E39\u0E01\u0E15\u0E01\u0E01\u0E23\u0E30\u0E08\u0E32\u0E22\u0E23\u0E2D\u0E1A\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E25\u0E39\u0E01\u0E25\u0E30 ${P(r.power)} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E0A\u0E49\u0E32\u0E25\u0E07`,
    "\u0E01\u0E49\u0E2D\u0E19\u0E19\u0E49\u0E33\u0E41\u0E02\u0E47\u0E07\u0E17\u0E35\u0E48\u0E1F\u0E49\u0E32\u0E42\u0E22\u0E19\u0E17\u0E34\u0E49\u0E07"
  ),
  A2(
    "holy_judgment",
    "\u0E04\u0E33\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32",
    "epic",
    "area",
    "holy",
    { m: "pillar", n: 3 },
    { raid: "r3" },
    cd(12),
    "meteor",
    { power: rk(2.4), radius: fl(90), count: same(3) },
    { delay: 0.6, each: true, pillar: true },
    null,
    (r) => `\u0E40\u0E2A\u0E32\u0E41\u0E2A\u0E07\u0E1E\u0E34\u0E1E\u0E32\u0E01\u0E29\u0E32\u0E25\u0E07\u0E1A\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39 ${r.count} \u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E15\u0E49\u0E19\u0E25\u0E30 ${P(r.power)}`,
    "\u0E1F\u0E49\u0E32\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E16\u0E32\u0E21\u0E27\u0E48\u0E32\u0E40\u0E08\u0E49\u0E32\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07"
  ),
  A2(
    "thunderstorm",
    "\u0E1E\u0E32\u0E22\u0E38\u0E1F\u0E49\u0E32\u0E04\u0E30\u0E19\u0E2D\u0E07",
    "epic",
    "area",
    "volt",
    { m: "storm", n: 6 },
    { zone: "z7" },
    cd(12),
    "meteor",
    { power: rk(1.3), radius: fl(80), count: same(6) },
    { delay: 0.4, each: true, bolt: true, stagger: 0.25 },
    { root: 0.6 },
    (r) => `\u0E1F\u0E49\u0E32\u0E1C\u0E48\u0E32\u0E25\u0E07 ${r.count} \u0E04\u0E23\u0E31\u0E49\u0E07\u0E44\u0E25\u0E48\u0E44\u0E1B\u0E15\u0E32\u0E21\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30 ${P(r.power)}`,
    "\u0E40\u0E21\u0E06\u0E17\u0E35\u0E48\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2B\u0E25\u0E31\u0E1A"
  ),
  // ================================================================= cones and chains
  A2(
    "dragon_breath",
    "\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E21\u0E31\u0E07\u0E01\u0E23",
    "epic",
    "area",
    "fire",
    { m: "cone", n: 5 },
    { raid: "r1" },
    cd(11),
    "cone",
    { power: rk(3), radius: fl(300) },
    { ticks: 6, gap: 0.16, arc: 1.1, burn: true },
    { root: 1 },
    (r) => `\u0E1E\u0E48\u0E19\u0E44\u0E1F\u0E41\u0E1A\u0E1A\u0E21\u0E31\u0E07\u0E01\u0E23\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E27\u0E22\u0E22\u0E32\u0E27 ${r.radius} \u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 6 \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E23\u0E27\u0E21 ${P(r.power)} \u0E15\u0E34\u0E14\u0E44\u0E1F`,
    "\u0E2D\u0E31\u0E04\u0E19\u0E34\u0E27\u0E32\u0E23\u0E17\u0E34\u0E49\u0E07\u0E44\u0E1F\u0E44\u0E27\u0E49\u0E43\u0E19\u0E17\u0E38\u0E01\u0E04\u0E19\u0E17\u0E35\u0E48\u0E25\u0E49\u0E21\u0E40\u0E02\u0E32\u0E44\u0E14\u0E49"
  ),
  A2(
    "sonic_roar",
    "\u0E04\u0E33\u0E23\u0E32\u0E21\u0E17\u0E30\u0E25\u0E27\u0E07\u0E42\u0E2A\u0E15",
    "uncommon",
    "ctrl",
    "wind",
    { m: "cone", n: 7 },
    { level: 8 },
    cd(10),
    "cone",
    { power: rk(0.9), radius: fl(240), stun: same(0.9), mark: same(0.15) },
    { arc: 1.5, kb: 300, sound: "roar" },
    { expose: 0.2, exposeT: 2 },
    (r) => `\u0E04\u0E33\u0E23\u0E32\u0E21\u0E2A\u0E38\u0E14\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E27\u0E22 ${P(r.power)} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E0A\u0E30\u0E07\u0E31\u0E01 ${r.stun} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E41\u0E25\u0E30\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E40\u0E1E\u0E34\u0E48\u0E21`,
    "\u0E1A\u0E32\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E04\u0E27\u0E32\u0E21\u0E01\u0E25\u0E49\u0E32\u0E04\u0E37\u0E2D\u0E01\u0E32\u0E23\u0E15\u0E30\u0E42\u0E01\u0E19\u0E43\u0E2B\u0E49\u0E14\u0E31\u0E07\u0E01\u0E27\u0E48\u0E32\u0E04\u0E27\u0E32\u0E21\u0E01\u0E25\u0E31\u0E27"
  ),
  A2(
    "chain_lightning",
    "\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E25\u0E39\u0E01\u0E42\u0E0B\u0E48",
    "rare",
    "atk",
    "volt",
    { m: "chain", n: 5 },
    { level: 12 },
    cd(8),
    "chain",
    { power: rk(1.5), jumps: same(5), range: fl(300) },
    { falloff: 0.88 },
    null,
    (r) => `\u0E2A\u0E32\u0E22\u0E1F\u0E49\u0E32\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E08\u0E32\u0E01\u0E28\u0E31\u0E15\u0E23\u0E39\u0E15\u0E31\u0E27\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E44\u0E1B\u0E2D\u0E35\u0E01\u0E15\u0E31\u0E27 ${r.jumps} \u0E04\u0E23\u0E31\u0E49\u0E07 \u0E40\u0E23\u0E34\u0E48\u0E21 ${P(r.power)} \u0E2D\u0E48\u0E2D\u0E19\u0E25\u0E07\u0E17\u0E35\u0E25\u0E30\u0E19\u0E34\u0E14`,
    "\u0E44\u0E1F\u0E1F\u0E49\u0E32\u0E0A\u0E2D\u0E1A\u0E17\u0E32\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E41\u0E25\u0E30\u0E28\u0E31\u0E15\u0E23\u0E39\u0E01\u0E47\u0E22\u0E37\u0E19\u0E43\u0E01\u0E25\u0E49\u0E01\u0E31\u0E19\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B"
  ),
  A2(
    "soul_chain",
    "\u0E42\u0E0B\u0E48\u0E14\u0E39\u0E14\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13",
    "epic",
    "atk",
    "shadow",
    { m: "chain", n: 3 },
    { boss: 12 },
    cd(10),
    "chain",
    { power: rk(1.7), jumps: same(3), range: fl(260) },
    { lifesteal: 0.03, chainLook: true, gap: 0.12, falloff: 1 },
    { selfDmg: 0.02 },
    (r) => `\u0E25\u0E48\u0E32\u0E21\u0E42\u0E0B\u0E48\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E1C\u0E48\u0E32\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39 ${r.jumps} \u0E15\u0E31\u0E27 \u0E15\u0E31\u0E27\u0E25\u0E30 ${P(r.power)} \u0E41\u0E25\u0E30\u0E14\u0E39\u0E14\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27`,
    "\u0E42\u0E0B\u0E48\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E25\u0E48\u0E32\u0E21\u0E23\u0E48\u0E32\u0E07 \u0E41\u0E15\u0E48\u0E25\u0E48\u0E32\u0E21\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08"
  ),
  // ================================================================= fields
  A2(
    "blizzard",
    "\u0E1E\u0E32\u0E22\u0E38\u0E2B\u0E34\u0E21\u0E30",
    "epic",
    "ctrl",
    "ice",
    { m: "field", n: 8 },
    { level: 19 },
    cd(13),
    "field",
    { power: rk(0.45), radius: fl(170), duration: same(4), slow: same(0.45) },
    { at: "target", tick: 0.4, motif: "ice" },
    null,
    (r) => `\u0E40\u0E23\u0E35\u0E22\u0E01\u0E1E\u0E32\u0E22\u0E38\u0E2B\u0E34\u0E21\u0E30\u0E17\u0E35\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E17\u0E38\u0E01 0.4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 ${P(r.power)} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E0A\u0E49\u0E32\u0E25\u0E07`,
    "\u0E04\u0E27\u0E32\u0E21\u0E40\u0E07\u0E35\u0E22\u0E1A\u0E02\u0E2D\u0E07\u0E2B\u0E34\u0E21\u0E30\u0E04\u0E37\u0E2D\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E02\u0E2D\u0E07\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E2B\u0E22\u0E38\u0E14"
  ),
  A2(
    "inferno",
    "\u0E19\u0E23\u0E01\u0E2D\u0E31\u0E04\u0E04\u0E35",
    "epic",
    "area",
    "fire",
    { m: "field", n: 6 },
    { zone: "z10" },
    cd(14),
    "field",
    { power: rk(0.75), radius: fl(160), duration: same(4) },
    { follow: true, tick: 0.4, motif: "flame", burn: true },
    { selfDmg: 0.08 },
    (r) => `\u0E08\u0E38\u0E14\u0E44\u0E1F\u0E19\u0E23\u0E01\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E40\u0E14\u0E34\u0E19\u0E15\u0E32\u0E21\u0E44\u0E1B\u0E14\u0E49\u0E27\u0E22 \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E17\u0E38\u0E01 0.4 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 ${P(r.power)}`,
    "\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E40\u0E1C\u0E32\u0E1C\u0E39\u0E49\u0E23\u0E48\u0E32\u0E22\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E2A\u0E21\u0E2D"
  ),
  A2(
    "sanctuary",
    "\u0E41\u0E14\u0E19\u0E28\u0E31\u0E01\u0E14\u0E34\u0E4C\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C",
    "legendary",
    "def",
    "holy",
    { m: "field", n: 4 },
    { raid: "r2" },
    cd(18),
    "field",
    { radius: fl(150), duration: same(5), heal: same(0.025) },
    { tick: 0.5, reduce: 0.3 },
    { root: 0.5 },
    (r) => `\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E07\u0E41\u0E2A\u0E07\u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E22\u0E37\u0E19\u0E02\u0E49\u0E32\u0E07\u0E43\u0E19\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E19\u0E49\u0E2D\u0E22\u0E25\u0E07 30% \u0E41\u0E25\u0E30\u0E1F\u0E37\u0E49\u0E19 ${P(r.heal)} \u0E17\u0E38\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E41\u0E21\u0E49\u0E41\u0E15\u0E48\u0E04\u0E33\u0E1E\u0E22\u0E32\u0E01\u0E23\u0E13\u0E4C\u0E01\u0E47\u0E40\u0E02\u0E49\u0E32\u0E44\u0E21\u0E48\u0E16\u0E36\u0E07"
  ),
  A2(
    "gravity_well",
    "\u0E1A\u0E48\u0E2D\u0E41\u0E23\u0E07\u0E42\u0E19\u0E49\u0E21\u0E16\u0E48\u0E27\u0E07",
    "epic",
    "ctrl",
    "void",
    { m: "vortex", n: 4 },
    { level: 21 },
    cd(12),
    "field",
    { power: rk(0.5), radius: fl(170), duration: same(2.5) },
    { at: "target", pull: 520, tick: 0.35 },
    null,
    (r) => `\u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E25\u0E38\u0E21\u0E41\u0E23\u0E07\u0E14\u0E39\u0E14\u0E17\u0E35\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E14\u0E39\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E25\u0E47\u0E01\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E32\u0E01\u0E25\u0E32\u0E07 ${P(r.power)} \u0E17\u0E38\u0E01\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30`,
    "\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E15\u0E01\u0E25\u0E07\u0E2A\u0E39\u0E48\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07\u0E43\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14"
  ),
  A2(
    "thorn_garden",
    "\u0E2A\u0E27\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E1E\u0E31\u0E19\u0E18\u0E19\u0E32\u0E01\u0E32\u0E23",
    "uncommon",
    "ctrl",
    "nature",
    { m: "field", n: 9 },
    { flag: "mem_thorns" },
    cd(11),
    "field",
    { power: rk(0.35), radius: fl(150), duration: same(5), slow: same(0.5) },
    { at: "target", tick: 0.5, motif: "thorn" },
    null,
    (r) => `\u0E1B\u0E25\u0E39\u0E01\u0E2A\u0E27\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E17\u0E35\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E27\u0E07\u0E0A\u0E49\u0E32\u0E25\u0E07\u0E41\u0E25\u0E30\u0E42\u0E14\u0E19\u0E17\u0E34\u0E48\u0E21 ${P(r.power)} \u0E17\u0E38\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E08\u0E33\u0E40\u0E08\u0E49\u0E32\u0E44\u0E14\u0E49 \u0E41\u0E25\u0E30\u0E21\u0E31\u0E19\u0E2D\u0E22\u0E32\u0E01\u0E0A\u0E48\u0E27\u0E22"
  ),
  A2(
    "storm_cloud",
    "\u0E40\u0E21\u0E06\u0E1E\u0E32\u0E22\u0E38\u0E15\u0E34\u0E14\u0E15\u0E31\u0E27",
    "rare",
    "sup",
    "volt",
    { m: "storm", n: 3 },
    { level: 14 },
    cd(13),
    "field",
    { power: rk(0.9), radius: fl(240), duration: same(6) },
    { follow: true, tick: 0.5, zap: true },
    null,
    (r) => `\u0E40\u0E21\u0E06\u0E1E\u0E32\u0E22\u0E38\u0E25\u0E2D\u0E22\u0E15\u0E32\u0E21\u0E15\u0E31\u0E27 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1C\u0E48\u0E32\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E23\u0E30\u0E22\u0E30 ${r.radius} \u0E17\u0E38\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 ${P(r.power)}`,
    "\u0E40\u0E21\u0E06\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E08\u0E49\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E08\u0E49\u0E32\u0E19\u0E32\u0E22"
  ),
  A2(
    "black_hole",
    "\u0E2B\u0E25\u0E38\u0E21\u0E14\u0E33",
    "mythic",
    "area",
    "void",
    { m: "vortex", n: 8 },
    { tower: 70 },
    cd(20),
    "field",
    { power: rk(0.6), radius: fl(200), duration: same(3) },
    { at: "target", pull: 760, tick: 0.3, end: 6 },
    { selfDmg: 0.1, minHp: 0.15, root: 0.8 },
    (r) => `\u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E25\u0E38\u0E21\u0E14\u0E33\u0E17\u0E35\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39 \u0E14\u0E39\u0E14\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E02\u0E49\u0E32\u0E01\u0E25\u0E32\u0E07 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E49\u0E27\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E2D\u0E2D\u0E01 ${P(r.power * 6)}`,
    "\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E15\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E2D\u0E30\u0E44\u0E23\u0E44\u0E1B\u0E2D\u0E35\u0E01"
  ),
  // ================================================================= buffs
  A2(
    "berserk",
    "\u0E04\u0E25\u0E31\u0E48\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E14",
    "rare",
    "sup",
    "blood",
    { m: "buff", n: 1 },
    { level: 13 },
    cd(18),
    "buff",
    { dmg: rk(0.3), haste: same(0.25), duration: same(6) },
    {},
    { expose: 0.35, exposeT: 6 },
    (r) => `\u0E04\u0E25\u0E31\u0E48\u0E07 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E14\u0E32\u0E40\u0E21\u0E08 +${P(r.dmg)} \u0E42\u0E08\u0E21\u0E15\u0E35\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 ${P(r.haste)}`,
    "\u0E04\u0E27\u0E32\u0E21\u0E42\u0E01\u0E23\u0E18\u0E40\u0E1B\u0E47\u0E19\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E22\u0E37\u0E21\u0E21\u0E32\u0E08\u0E32\u0E01\u0E2D\u0E19\u0E32\u0E04\u0E15"
  ),
  A2(
    "eagle_focus",
    "\u0E2A\u0E21\u0E32\u0E18\u0E34\u0E2D\u0E34\u0E19\u0E17\u0E23\u0E35",
    "uncommon",
    "sup",
    "wind",
    { m: "buff", n: 2 },
    { level: 6 },
    cd(16),
    "buff",
    { crit: rk(0.18), duration: same(6) },
    {},
    { slow: 0.75, slowT: 6 },
    (r) => `\u0E08\u0E14\u0E08\u0E48\u0E2D ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +${P(r.crit)}`,
    "\u0E19\u0E01\u0E2D\u0E34\u0E19\u0E17\u0E23\u0E35\u0E44\u0E21\u0E48\u0E23\u0E35\u0E1A \u0E40\u0E1E\u0E23\u0E32\u0E30\u0E21\u0E31\u0E19\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E08\u0E30\u0E25\u0E07\u0E15\u0E23\u0E07\u0E44\u0E2B\u0E19"
  ),
  A2(
    "iron_skin",
    "\u0E1C\u0E34\u0E27\u0E40\u0E2B\u0E25\u0E47\u0E01",
    "uncommon",
    "def",
    "steel",
    { m: "buff", n: 3 },
    { level: 5 },
    cd(16),
    "buff",
    { reduce: rk(0.35), duration: same(6) },
    { sound: "block" },
    { slow: 0.7, slowT: 6 },
    (r) => `\u0E1C\u0E34\u0E27\u0E41\u0E02\u0E47\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2B\u0E25\u0E47\u0E01 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E19\u0E49\u0E2D\u0E22\u0E25\u0E07 ${P(r.reduce)}`,
    "\u0E40\u0E01\u0E23\u0E32\u0E30\u0E17\u0E35\u0E48\u0E14\u0E35\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E04\u0E37\u0E2D\u0E40\u0E01\u0E23\u0E32\u0E30\u0E17\u0E35\u0E48\u0E16\u0E2D\u0E14\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49"
  ),
  A2(
    "wind_walk",
    "\u0E40\u0E14\u0E34\u0E19\u0E25\u0E21",
    "common",
    "move",
    "wind",
    { m: "buff", n: 4 },
    { level: 4 },
    cd(14),
    "buff",
    { speed: rk(0.35), duration: same(5) },
    { dodges: true },
    null,
    (r) => `\u0E15\u0E31\u0E27\u0E40\u0E1A\u0E32\u0E14\u0E31\u0E48\u0E07\u0E25\u0E21 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E40\u0E14\u0E34\u0E19\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 ${P(r.speed)} \u0E41\u0E25\u0E30\u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E40\u0E15\u0E47\u0E21\u0E17\u0E31\u0E19\u0E17\u0E35`,
    "\u0E1A\u0E32\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E0A\u0E31\u0E22\u0E0A\u0E19\u0E30\u0E04\u0E37\u0E2D\u0E01\u0E32\u0E23\u0E44\u0E1B\u0E16\u0E36\u0E07\u0E01\u0E48\u0E2D\u0E19"
  ),
  A2(
    "vampiric_aura",
    "\u0E2D\u0E2D\u0E23\u0E48\u0E32\u0E41\u0E27\u0E21\u0E44\u0E1E\u0E23\u0E4C",
    "epic",
    "sup",
    "blood",
    { m: "buff", n: 6 },
    { boss: 15 },
    cd(18),
    "buff",
    { lifesteal: rk(0.1), duration: same(7) },
    {},
    { selfDmg: 0.07, minHp: 0.1 },
    (r) => `\u0E2B\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E14\u0E49\u0E27\u0E22\u0E2B\u0E21\u0E2D\u0E01\u0E40\u0E25\u0E37\u0E2D\u0E14 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E14\u0E39\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14 ${P(r.lifesteal)} \u0E02\u0E2D\u0E07\u0E14\u0E32\u0E40\u0E21\u0E08\u0E17\u0E35\u0E48\u0E17\u0E33`,
    "\u0E01\u0E23\u0E30\u0E2B\u0E32\u0E22\u0E08\u0E19\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E1E\u0E25\u0E31\u0E07"
  ),
  A2(
    "battle_hymn",
    "\u0E1A\u0E17\u0E40\u0E1E\u0E25\u0E07\u0E23\u0E1A",
    "rare",
    "sup",
    "holy",
    { m: "buff", n: 7 },
    { level: 15 },
    cd(18),
    "buff",
    { dmg: rk(0.15), regen: same(0.015), duration: same(8) },
    {},
    null,
    (r) => `\u0E23\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E25\u0E07\u0E23\u0E1A ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E14\u0E32\u0E40\u0E21\u0E08 +${P(r.dmg)} \u0E41\u0E25\u0E30\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E22\u0E46`,
    "\u0E40\u0E1E\u0E25\u0E07\u0E17\u0E35\u0E48\u0E19\u0E31\u0E01\u0E23\u0E1A\u0E23\u0E38\u0E48\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E23\u0E49\u0E2D\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E02\u0E49\u0E32\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21"
  ),
  A2(
    "time_warp",
    "\u0E1A\u0E34\u0E14\u0E40\u0E27\u0E25\u0E32",
    "legendary",
    "sup",
    "arcane",
    { m: "clock", n: 1 },
    { tower: 60 },
    cd(24),
    "buff",
    { haste: rk(0.3), duration: same(5) },
    { refresh: 0.6, dodges: true },
    { expose: 0.3, exposeT: 3 },
    (r) => `\u0E1A\u0E34\u0E14\u0E40\u0E27\u0E25\u0E32: \u0E2A\u0E01\u0E34\u0E25\u0E2D\u0E37\u0E48\u0E19\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E25\u0E14 60% \u0E17\u0E31\u0E19\u0E17\u0E35 \u0E0A\u0E32\u0E23\u0E4C\u0E08\u0E2B\u0E25\u0E1A\u0E40\u0E15\u0E47\u0E21 \u0E41\u0E25\u0E30\u0E42\u0E08\u0E21\u0E15\u0E35\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 ${P(r.haste)} \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E02\u0E2D\u0E07\u0E40\u0E17\u0E1E\u0E19\u0E32\u0E2C\u0E34\u0E01\u0E32\u0E40\u0E14\u0E34\u0E19\u0E16\u0E2D\u0E22\u0E2B\u0E25\u0E31\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35"
  ),
  A2(
    "flame_weapon",
    "\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E40\u0E1E\u0E25\u0E34\u0E07",
    "uncommon",
    "sup",
    "fire",
    { m: "buff", n: 8 },
    { level: 7 },
    cd(15),
    "buff",
    { dmg: rk(0.1), duration: same(8) },
    { burnHits: true },
    null,
    (r) => `\u0E2B\u0E48\u0E2D\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E14\u0E49\u0E27\u0E22\u0E44\u0E1F ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35: \u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E15\u0E34\u0E14\u0E44\u0E1F \u0E41\u0E25\u0E30\u0E14\u0E32\u0E40\u0E21\u0E08 +${P(r.dmg)}`,
    "\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E08\u0E33\u0E04\u0E27\u0E32\u0E21\u0E23\u0E49\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E15\u0E32\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E2D\u0E21\u0E21\u0E31\u0E19"
  ),
  // ================================================================= defence and healing
  A2(
    "crystal_barrier",
    "\u0E01\u0E33\u0E41\u0E1E\u0E07\u0E1C\u0E25\u0E36\u0E01",
    "rare",
    "def",
    "ice",
    { m: "shield", n: 6 },
    { level: 10 },
    cd(14),
    "shield",
    { shieldPct: rk(0.28), duration: same(5), power: rk(1.6) },
    { breakNova: 170 },
    null,
    (r) => `\u0E42\u0E25\u0E48\u0E1C\u0E25\u0E36\u0E01\u0E14\u0E39\u0E14\u0E0B\u0E31\u0E1A ${P(r.shieldPct)} \u0E02\u0E2D\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E41\u0E15\u0E01\u0E08\u0E30\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E40\u0E28\u0E29\u0E1C\u0E25\u0E36\u0E01 ${P(r.power)}`,
    "\u0E1C\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E41\u0E15\u0E01\u0E22\u0E31\u0E07\u0E04\u0E21\u0E01\u0E27\u0E48\u0E32\u0E1C\u0E25\u0E36\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C"
  ),
  A2(
    "second_wind",
    "\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E17\u0E35\u0E48\u0E2A\u0E2D\u0E07",
    "uncommon",
    "def",
    "nature",
    { m: "heal", n: 2 },
    { level: 8 },
    cd(20),
    "heal",
    { heal: rk(0.12), regen: same(0.05) },
    { dur: 3 },
    { root: 1 },
    (r) => `\u0E15\u0E31\u0E49\u0E07\u0E2A\u0E15\u0E34\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E25\u0E36\u0E01 \u0E1F\u0E37\u0E49\u0E19\u0E17\u0E31\u0E19\u0E17\u0E35 ${P(r.heal)} \u0E41\u0E25\u0E49\u0E27\u0E1F\u0E37\u0E49\u0E19\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E2D\u0E35\u0E01 3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E25\u0E49\u0E21\u0E44\u0E14\u0E49 \u0E41\u0E15\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E01\u0E48\u0E2D\u0E19\u0E25\u0E38\u0E01"
  ),
  A2(
    "phoenix_feather",
    "\u0E02\u0E19\u0E19\u0E01\u0E1F\u0E35\u0E19\u0E34\u0E01\u0E0B\u0E4C",
    "epic",
    "def",
    "fire",
    { m: "heal", n: 5 },
    { zone: "z6" },
    cd(22),
    "heal",
    { heal: rk(0.18), power: rk(1.4) },
    { nova: 160, burn: true },
    null,
    (r) => `\u0E40\u0E1C\u0E32\u0E02\u0E19\u0E19\u0E01\u0E1F\u0E35\u0E19\u0E34\u0E01\u0E0B\u0E4C \u0E1F\u0E37\u0E49\u0E19\u0E17\u0E31\u0E19\u0E17\u0E35 ${P(r.heal)} \u0E41\u0E25\u0E30\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14\u0E44\u0E1F\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${P(r.power)}`,
    "\u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E1F\u0E37\u0E49\u0E19\u0E04\u0E37\u0E19\u0E0A\u0E35\u0E1E\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E2A\u0E31\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E16\u0E39\u0E01\u0E40\u0E1C\u0E32"
  ),
  A2(
    "mirror_guard",
    "\u0E17\u0E48\u0E32\u0E42\u0E25\u0E48\u0E01\u0E23\u0E30\u0E08\u0E01",
    "rare",
    "def",
    "arcane",
    { m: "counter", n: 2 },
    { level: 9 },
    cd(10),
    "counter",
    { power: rk(2.4), radius: fl(160), duration: same(1.2) },
    {},
    null,
    (r) => `\u0E15\u0E31\u0E49\u0E07\u0E17\u0E48\u0E32\u0E23\u0E31\u0E1A ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E16\u0E49\u0E32\u0E42\u0E14\u0E19\u0E42\u0E08\u0E21\u0E15\u0E35\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E19\u0E31\u0E49\u0E19\u0E08\u0E30\u0E44\u0E21\u0E48\u0E40\u0E2A\u0E35\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14 \u0E41\u0E25\u0E30\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E31\u0E1A\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${P(r.power)} \u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19`,
    "\u0E01\u0E23\u0E30\u0E08\u0E01\u0E44\u0E21\u0E48\u0E42\u0E01\u0E23\u0E18 \u0E21\u0E31\u0E19\u0E41\u0E04\u0E48\u0E2A\u0E48\u0E07\u0E04\u0E37\u0E19"
  ),
  A2(
    "riposte",
    "\u0E1B\u0E31\u0E14\u0E41\u0E25\u0E49\u0E27\u0E1F\u0E31\u0E19",
    "epic",
    "def",
    "steel",
    { m: "counter", n: 5 },
    { pvp: 10 },
    cd(8),
    "counter",
    { power: rk(3.2), radius: fl(140), duration: same(0.7) },
    {},
    { expose: 0.4, exposeT: 1.5 },
    (r) => `\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E23\u0E31\u0E1A\u0E2A\u0E31\u0E49\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E16\u0E49\u0E32\u0E42\u0E14\u0E19\u0E15\u0E35\u0E08\u0E30\u0E1B\u0E31\u0E14\u0E41\u0E25\u0E30\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E31\u0E1A\u0E41\u0E23\u0E07 ${P(r.power)} \u0E16\u0E49\u0E32\u0E1E\u0E25\u0E32\u0E14\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E08\u0E30\u0E40\u0E1B\u0E34\u0E14\u0E0A\u0E48\u0E2D\u0E07\u0E42\u0E2B\u0E27\u0E48`,
    "\u0E19\u0E31\u0E01\u0E14\u0E32\u0E1A\u0E17\u0E35\u0E48\u0E40\u0E01\u0E48\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E23\u0E2D\u0E43\u0E2B\u0E49\u0E2D\u0E35\u0E01\u0E1D\u0E48\u0E32\u0E22\u0E25\u0E07\u0E21\u0E37\u0E2D\u0E01\u0E48\u0E2D\u0E19"
  ),
  // ================================================================= summons
  A2(
    "blade_orbit",
    "\u0E14\u0E32\u0E1A\u0E27\u0E07\u0E42\u0E04\u0E08\u0E23",
    "rare",
    "sup",
    "steel",
    { m: "orbit", n: 4 },
    { level: 11 },
    cd(14),
    "orbit",
    { power: rk(0.55), count: same(4), duration: same(6) },
    { r: 90, gap: 0.3, motif: "blade" },
    null,
    (r) => `\u0E14\u0E32\u0E1A ${r.count} \u0E40\u0E25\u0E48\u0E21\u0E2B\u0E21\u0E38\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1F\u0E31\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E15\u0E31\u0E27 ${P(r.power)} \u0E17\u0E38\u0E01 0.3 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E14\u0E32\u0E1A\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E21\u0E37\u0E2D\u0E08\u0E31\u0E1A"
  ),
  A2(
    "fire_spirits",
    "\u0E14\u0E27\u0E07\u0E44\u0E1F\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C",
    "epic",
    "sup",
    "fire",
    { m: "orbit", n: 3 },
    { level: 17 },
    cd(15),
    "orbit",
    { power: rk(0.9), count: same(3), duration: same(7) },
    { r: 70, gap: 0.6, motif: "orb", shoot: 460, kind: "orb" },
    null,
    (r) => `\u0E14\u0E27\u0E07\u0E44\u0E1F ${r.count} \u0E14\u0E27\u0E07\u0E25\u0E2D\u0E22\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E22\u0E34\u0E07\u0E44\u0E1F\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E19\u0E23\u0E30\u0E22\u0E30\u0E40\u0E2D\u0E07\u0E17\u0E38\u0E01 0.6 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 ${P(r.power)}`,
    "\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E14\u0E31\u0E1A\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E22\u0E31\u0E07\u0E21\u0E35\u0E04\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E1B\u0E01\u0E1B\u0E49\u0E2D\u0E07"
  ),
  A2(
    "war_totem",
    "\u0E40\u0E2A\u0E32\u0E28\u0E36\u0E01",
    "uncommon",
    "sup",
    "earth",
    { m: "totem", n: 1 },
    { level: 9 },
    cd(15),
    "totem",
    { power: rk(0.8), duration: same(7) },
    { gap: 0.7, range: 480, kind: "bolt" },
    null,
    (r) => `\u0E1B\u0E31\u0E01\u0E40\u0E2A\u0E32\u0E28\u0E36\u0E01\u0E22\u0E34\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2D\u0E07\u0E17\u0E38\u0E01 0.7 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 ${P(r.power)} \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E40\u0E2A\u0E32\u0E44\u0E21\u0E49\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E08\u0E33\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E01\u0E25\u0E2D\u0E07\u0E28\u0E36\u0E01"
  ),
  A2(
    "shadow_clone",
    "\u0E23\u0E48\u0E32\u0E07\u0E40\u0E07\u0E32",
    "epic",
    "sup",
    "shadow",
    { m: "clone", n: 1 },
    { level: 22 },
    cd(16),
    "clone",
    { power: rk(0.9), duration: same(5), radius: fl(90) },
    { gap: 0.4 },
    { selfDmg: 0.05 },
    (r) => `\u0E41\u0E22\u0E01\u0E23\u0E48\u0E32\u0E07\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E27\u0E34\u0E48\u0E07\u0E44\u0E25\u0E48\u0E1F\u0E31\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2D\u0E07 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1F\u0E31\u0E19\u0E25\u0E30 ${P(r.power)}`,
    "\u0E40\u0E07\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2D\u0E22\u0E32\u0E01\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E15\u0E49\u0E40\u0E17\u0E49\u0E32\u0E2D\u0E35\u0E01\u0E15\u0E48\u0E2D\u0E44\u0E1B"
  ),
  // ================================================================= melee techniques
  A2(
    "hundred_cuts",
    "\u0E23\u0E49\u0E2D\u0E22\u0E14\u0E32\u0E1A",
    "epic",
    "atk",
    "steel",
    { m: "flurry", n: 8 },
    { level: 18 },
    cd(10),
    "flurry",
    { power: rk(0.55), hits: same(9) },
    { gap: 0.07, range: 150, arc: 1.9 },
    { root: 0.7 },
    (r) => `\u0E1F\u0E31\u0E19\u0E23\u0E31\u0E27 ${r.hits} \u0E04\u0E23\u0E31\u0E49\u0E07\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E43\u0E19\u0E1E\u0E23\u0E34\u0E1A\u0E15\u0E32 \u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30 ${P(r.power)}`,
    "\u0E23\u0E49\u0E2D\u0E22\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08"
  ),
  A2(
    "cyclone",
    "\u0E1E\u0E32\u0E22\u0E38\u0E2B\u0E21\u0E38\u0E19\u0E14\u0E32\u0E1A",
    "rare",
    "area",
    "wind",
    { m: "whirl", n: 3 },
    { level: 10 },
    cd(10),
    "cyclone",
    { power: rk(0.6), radius: fl(120), duration: same(1.8) },
    { gap: 0.22, speed: 0.2 },
    { expose: 0.2, exposeT: 2 },
    (r) => `\u0E2B\u0E21\u0E38\u0E19\u0E15\u0E31\u0E27\u0E40\u0E1B\u0E47\u0E19\u0E1E\u0E32\u0E22\u0E38 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E40\u0E14\u0E34\u0E19\u0E44\u0E1B\u0E14\u0E49\u0E27\u0E22\u0E44\u0E14\u0E49 \u0E1F\u0E31\u0E19\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 ${P(r.power)} \u0E17\u0E38\u0E01 0.22 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E25\u0E21\u0E2B\u0E21\u0E38\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E04\u0E21"
  ),
  A2(
    "earth_spikes",
    "\u0E2B\u0E19\u0E32\u0E21\u0E18\u0E23\u0E13\u0E35",
    "uncommon",
    "ctrl",
    "earth",
    { m: "spikes", n: 7 },
    { level: 7 },
    cd(8),
    "wave",
    { power: rk(1.4), length: fl(460) },
    { width: 50, motif: "earth", kb: 80 },
    null,
    (r) => `\u0E2B\u0E19\u0E32\u0E21\u0E2B\u0E34\u0E19\u0E1C\u0E38\u0E14\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E19\u0E27\u0E22\u0E32\u0E27 ${r.length} \u0E2B\u0E19\u0E48\u0E27\u0E22\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 ${P(r.power)} \u0E28\u0E31\u0E15\u0E23\u0E39\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E02\u0E36\u0E49\u0E19`,
    "\u0E1E\u0E37\u0E49\u0E19\u0E14\u0E34\u0E19\u0E01\u0E47\u0E42\u0E01\u0E23\u0E18\u0E40\u0E1B\u0E47\u0E19"
  ),
  A2(
    "tidal_wave",
    "\u0E04\u0E25\u0E37\u0E48\u0E19\u0E22\u0E31\u0E01\u0E29\u0E4C",
    "epic",
    "ctrl",
    "water",
    { m: "wave", n: 3 },
    { level: 23 },
    cd(12),
    "wave",
    { power: rk(1.8), length: fl(560) },
    { width: 110, motif: "water", kb: 520, speed: 900 },
    { root: 0.5 },
    (r) => `\u0E0B\u0E31\u0E14\u0E04\u0E25\u0E37\u0E48\u0E19\u0E22\u0E31\u0E01\u0E29\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 ${r.length} \u0E2B\u0E19\u0E48\u0E27\u0E22 ${P(r.power)} \u0E1E\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39\u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E44\u0E1B\u0E44\u0E01\u0E25`,
    "\u0E17\u0E30\u0E40\u0E25\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E40\u0E2B\u0E47\u0E19 \u0E0B\u0E48\u0E2D\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E2B\u0E22\u0E14\u0E19\u0E49\u0E33"
  ),
  A2(
    "hook_chain",
    "\u0E42\u0E0B\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27",
    "uncommon",
    "ctrl",
    "steel",
    { m: "hook", n: 1 },
    { level: 6 },
    cd(8),
    "hook",
    { power: rk(1), range: fl(420) },
    { stun: 0.7 },
    null,
    (r) => `\u0E40\u0E2B\u0E27\u0E35\u0E48\u0E22\u0E07\u0E42\u0E0B\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14\u0E43\u0E19\u0E23\u0E30\u0E22\u0E30 ${r.range} \u0E14\u0E36\u0E07\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32 ${P(r.power)} \u0E41\u0E25\u0E30\u0E0A\u0E30\u0E07\u0E31\u0E01`,
    "\u0E16\u0E49\u0E32\u0E21\u0E31\u0E19\u0E44\u0E21\u0E48\u0E21\u0E32\u0E2B\u0E32 \u0E01\u0E47\u0E25\u0E32\u0E01\u0E21\u0E31\u0E19\u0E21\u0E32"
  ),
  A2(
    "mine_field",
    "\u0E17\u0E38\u0E48\u0E19\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14",
    "rare",
    "ctrl",
    "fire",
    { m: "trap", n: 3 },
    { level: 14 },
    cd(12),
    "trap",
    { power: rk(2), radius: fl(130), count: same(3) },
    { dur: 9 },
    null,
    (r) => `\u0E27\u0E32\u0E07\u0E17\u0E38\u0E48\u0E19\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14 ${r.count} \u0E25\u0E39\u0E01\u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27 \u0E28\u0E31\u0E15\u0E23\u0E39\u0E40\u0E2B\u0E22\u0E35\u0E22\u0E1A\u0E41\u0E25\u0E49\u0E27\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius}`,
    "\u0E17\u0E32\u0E07\u0E40\u0E14\u0E34\u0E19\u0E17\u0E35\u0E48\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E04\u0E37\u0E2D\u0E17\u0E32\u0E07\u0E17\u0E35\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49"
  ),
  A2(
    "death_mark",
    "\u0E15\u0E23\u0E32\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23",
    "epic",
    "ctrl",
    "shadow",
    { m: "mark", n: 1 },
    { boss: 18 },
    cd(12),
    "mark",
    { power: rk(0.6), mark: rk(0.3), duration: same(4) },
    { burst: 150, burstMult: 3 },
    null,
    (r) => `\u0E1B\u0E23\u0E30\u0E17\u0E31\u0E1A\u0E15\u0E23\u0E32\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23\u0E1A\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14 \u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E40\u0E1E\u0E34\u0E48\u0E21 ${P(r.mark)} \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E41\u0E25\u0E49\u0E27\u0E15\u0E23\u0E32\u0E23\u0E30\u0E40\u0E1A\u0E34\u0E14 ${P(r.power * 3)} \u0E23\u0E2D\u0E1A\u0E15\u0E31\u0E27\u0E21\u0E31\u0E19`,
    "\u0E15\u0E23\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E25\u0E31\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E27\u0E49\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32"
  ),
  A2(
    "execute",
    "\u0E1B\u0E23\u0E30\u0E2B\u0E32\u0E23\u0E0A\u0E35\u0E27\u0E34\u0E15",
    "legendary",
    "atk",
    "blood",
    { m: "execute", n: 1 },
    { boss: 30 },
    cd(11),
    "execute",
    { power: rk(3.4) },
    { range: 240, low: 0.35, bonus: 2.5 },
    { root: 0.45 },
    (r) => `\u0E1F\u0E31\u0E19\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14 ${P(r.power)} \u0E16\u0E49\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32 35% \u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 2.5 \u0E40\u0E17\u0E48\u0E32\u0E41\u0E25\u0E30\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19`,
    "\u0E04\u0E21\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E21\u0E17\u0E35\u0E48\u0E2A\u0E2D\u0E07"
  ),
  A2(
    "ground_slam",
    "\u0E17\u0E38\u0E1A\u0E1B\u0E10\u0E1E\u0E35",
    "uncommon",
    "area",
    "earth",
    { m: "slam", n: 3 },
    { level: 5 },
    cd(8),
    "slam",
    { power: rk(1.7), radius: fl(120) },
    { fwd: 90, line: 260, motif: "earth" },
    { root: 0.35 },
    (r) => `\u0E17\u0E38\u0E1A\u0E1E\u0E37\u0E49\u0E19\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 ${P(r.power)} \u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E23\u0E2D\u0E22\u0E41\u0E15\u0E01\u0E1E\u0E38\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E44\u0E1B\u0E2D\u0E35\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E41\u0E19\u0E27`,
    "\u0E41\u0E23\u0E07\u0E17\u0E35\u0E48\u0E25\u0E07\u0E1E\u0E37\u0E49\u0E19 \u0E1E\u0E37\u0E49\u0E19\u0E08\u0E30\u0E04\u0E37\u0E19\u0E43\u0E2B\u0E49\u0E17\u0E38\u0E01\u0E04\u0E19"
  ),
  A2(
    "star_breaker",
    "\u0E17\u0E25\u0E32\u0E22\u0E14\u0E32\u0E23\u0E32",
    "mythic",
    "atk",
    "star",
    { m: "execute", n: 3 },
    { raid: "r3" },
    cd(16),
    "execute",
    { power: rk(5.5) },
    { range: 260, low: 0.5, bonus: 1.8 },
    { selfDmg: 0.08, root: 0.6 },
    (r) => `\u0E23\u0E27\u0E21\u0E41\u0E2A\u0E07\u0E14\u0E32\u0E27\u0E17\u0E31\u0E49\u0E07\u0E1F\u0E49\u0E32\u0E1F\u0E31\u0E19\u0E25\u0E07\u0E28\u0E31\u0E15\u0E23\u0E39\u0E43\u0E01\u0E25\u0E49\u0E2A\u0E38\u0E14 ${P(r.power)} \u0E16\u0E49\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E04\u0E23\u0E36\u0E48\u0E07 \u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19\u0E2D\u0E35\u0E01 80%`,
    "\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E17\u0E25\u0E32\u0E22\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E14\u0E32\u0E27"
  ),
  // ================================================================= passives (each has a hidden price)
  S(
    "glass_cannon",
    "\u0E1B\u0E37\u0E19\u0E43\u0E2B\u0E0D\u0E48\u0E41\u0E01\u0E49\u0E27",
    "rare",
    "fire",
    { m: "pas", n: 1 },
    { level: 8 },
    { atkPct: rk(0.15, 0.25), hpPct: same(-0.12) },
    (r) => `\u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35 +${P(r.atkPct)}`,
    "\u0E41\u0E23\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E40\u0E1B\u0E23\u0E32\u0E30\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14"
  ),
  S(
    "turtle_shell",
    "\u0E01\u0E23\u0E30\u0E14\u0E2D\u0E07\u0E40\u0E15\u0E48\u0E32",
    "uncommon",
    "earth",
    { m: "pas", n: 2 },
    { level: 5 },
    { defPct: rk(0.2, 0.25), spd: same(-0.08) },
    (r) => `\u0E04\u0E48\u0E32\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 +${P(r.defPct)}`,
    "\u0E0A\u0E49\u0E32\u0E41\u0E15\u0E48\u0E16\u0E36\u0E07\u0E40\u0E2A\u0E21\u0E2D"
  ),
  S(
    "berserker_blood",
    "\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E04\u0E25\u0E31\u0E48\u0E07",
    "epic",
    "blood",
    { m: "pas", n: 3 },
    { boss: 10 },
    { lowHpDmg: rk(0.25, 0.3), defPct: same(-0.1) },
    (r) => `\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 40% \u0E14\u0E32\u0E40\u0E21\u0E08 +${P(r.lowHpDmg)}`,
    "\u0E22\u0E34\u0E48\u0E07\u0E40\u0E08\u0E47\u0E1A\u0E22\u0E34\u0E48\u0E07\u0E41\u0E23\u0E07"
  ),
  S(
    "assassin_instinct",
    "\u0E2A\u0E31\u0E0D\u0E0A\u0E32\u0E15\u0E0D\u0E32\u0E13\u0E19\u0E31\u0E01\u0E06\u0E48\u0E32",
    "rare",
    "shadow",
    { m: "pas", n: 4 },
    { level: 11 },
    { critMult: rk(0.25, 0.3), hpPct: same(-0.06) },
    (r) => `\u0E04\u0E27\u0E32\u0E21\u0E41\u0E23\u0E07\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +${P(r.critMult)}`,
    "\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E35\u0E1A\u0E48\u0E2D\u0E22 \u0E02\u0E2D\u0E41\u0E04\u0E48\u0E15\u0E35\u0E16\u0E39\u0E01\u0E17\u0E35\u0E48"
  ),
  S(
    "arcane_mind",
    "\u0E08\u0E34\u0E15\u0E40\u0E27\u0E17",
    "rare",
    "arcane",
    { m: "pas", n: 5 },
    { level: 10 },
    { skillPower: rk(0.12, 0.33), atkPct: same(-0.06) },
    (r) => `\u0E14\u0E32\u0E40\u0E21\u0E08\u0E2A\u0E01\u0E34\u0E25 +${P(r.skillPower)}`,
    "\u0E04\u0E27\u0E32\u0E21\u0E04\u0E34\u0E14\u0E04\u0E21\u0E01\u0E27\u0E48\u0E32\u0E14\u0E32\u0E1A"
  ),
  S(
    "quick_cast",
    "\u0E23\u0E48\u0E32\u0E22\u0E44\u0E27",
    "uncommon",
    "wind",
    { m: "pas", n: 6 },
    { level: 7 },
    { skillCd: rk(0.08, 0.4), skillPower: same(-0.08) },
    (r) => `\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2A\u0E01\u0E34\u0E25 \u2212${P(r.skillCd)}`,
    "\u0E2A\u0E01\u0E34\u0E25\u0E40\u0E1A\u0E32\u0E46 \u0E17\u0E35\u0E48\u0E21\u0E32\u0E1A\u0E48\u0E2D\u0E22\u0E46"
  ),
  S(
    "ember_soul",
    "\u0E27\u0E34\u0E0D\u0E0D\u0E32\u0E13\u0E16\u0E48\u0E32\u0E19",
    "uncommon",
    "fire",
    { m: "pas", n: 7 },
    { level: 6 },
    { ignite: rk(0.08, 0.3), defPct: same(-0.05) },
    (r) => `\u0E42\u0E2D\u0E01\u0E32\u0E2A ${P(r.ignite)} \u0E17\u0E35\u0E48\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E08\u0E30\u0E15\u0E34\u0E14\u0E44\u0E1F`,
    "\u0E16\u0E48\u0E32\u0E19\u0E43\u0E19\u0E2D\u0E01\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E21\u0E2D\u0E14"
  ),
  S(
    "vampire_fang",
    "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E41\u0E27\u0E21\u0E44\u0E1E\u0E23\u0E4C",
    "epic",
    "blood",
    { m: "pas", n: 8 },
    { boss: 14 },
    { lifesteal: rk(0.025, 0.3), hpPct: same(-0.06) },
    (r) => `\u0E14\u0E39\u0E14\u0E40\u0E25\u0E37\u0E2D\u0E14 ${P(r.lifesteal)} \u0E02\u0E2D\u0E07\u0E14\u0E32\u0E40\u0E21\u0E08\u0E17\u0E35\u0E48\u0E17\u0E33`,
    "\u0E01\u0E23\u0E30\u0E2B\u0E32\u0E22\u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2D\u0E34\u0E48\u0E21"
  ),
  S(
    "regeneration",
    "\u0E1F\u0E37\u0E49\u0E19\u0E1F\u0E39\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07",
    "rare",
    "nature",
    { m: "pas", n: 9 },
    { level: 12 },
    { regen: rk(4e-3, 0.4), atkPct: same(-0.05) },
    (r) => `\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 ${(r.regen * 100).toFixed(1)}% \u0E02\u0E2D\u0E07\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E17\u0E38\u0E01\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E41\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E34\u0E14\u0E40\u0E2D\u0E07\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E2D\u0E43\u0E04\u0E23"
  ),
  S(
    "fleet_foot",
    "\u0E40\u0E17\u0E49\u0E32\u0E44\u0E27",
    "common",
    "wind",
    { m: "pas", n: 10 },
    { level: 3 },
    { spd: rk(0.08, 0.25), dashCd: rk(0.1, 0.25), defPct: same(-0.08) },
    (r) => `\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27 +${P(r.spd)} \u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2B\u0E25\u0E1A \u2212${P(r.dashCd)}`,
    "\u0E27\u0E34\u0E48\u0E07\u0E01\u0E48\u0E2D\u0E19 \u0E04\u0E34\u0E14\u0E17\u0E35\u0E2B\u0E25\u0E31\u0E07"
  ),
  S(
    "iron_will",
    "\u0E43\u0E08\u0E40\u0E2B\u0E25\u0E47\u0E01",
    "rare",
    "steel",
    { m: "pas", n: 11 },
    { level: 14 },
    { dmgTaken: rk(-0.06, 0.25), spd: same(-0.06) },
    (r) => `\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E19\u0E49\u0E2D\u0E22\u0E25\u0E07 ${P(-r.dmgTaken)}`,
    "\u0E43\u0E08\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E41\u0E1E\u0E49 \u0E17\u0E33\u0E43\u0E2B\u0E49\u0E23\u0E48\u0E32\u0E07\u0E01\u0E32\u0E22\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E25\u0E49\u0E21"
  ),
  S(
    "last_breath",
    "\u0E25\u0E21\u0E2B\u0E32\u0E22\u0E43\u0E08\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22",
    "legendary",
    "holy",
    { m: "pas", n: 12 },
    { tower: 25 },
    { lastStand: same(1), hpPct: [-0.1, -0.07, -0.04] },
    (r) => "\u0E23\u0E2D\u0E14\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E17\u0E35\u0E48\u0E16\u0E36\u0E07\u0E15\u0E32\u0E22\u0E44\u0E14\u0E49\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E25\u0E07\u0E14\u0E31\u0E19 (\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 1)",
    "\u0E04\u0E27\u0E32\u0E21\u0E15\u0E32\u0E22\u0E22\u0E31\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E2D\u0E04\u0E34\u0E27"
  ),
  S(
    "treasure_hunter",
    "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E21\u0E1A\u0E31\u0E15\u0E34",
    "uncommon",
    "earth",
    { m: "pas", n: 13 },
    { level: 9 },
    { goldMult: rk(0.1, 0.4), dmgTaken: same(0.05) },
    (r) => `\u0E17\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49 +${P(r.goldMult)}`,
    "\u0E17\u0E2D\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E31\u0E19\u0E15\u0E23\u0E32\u0E22\u0E40\u0E2A\u0E21\u0E2D"
  ),
  S(
    "combo_master",
    "\u0E40\u0E0B\u0E35\u0E22\u0E19\u0E04\u0E2D\u0E21\u0E42\u0E1A",
    "rare",
    "steel",
    { m: "pas", n: 14 },
    { level: 16 },
    { comboPct: rk(0.5, 0.5), crit: same(-0.02) },
    (r) => `\u0E42\u0E1A\u0E19\u0E31\u0E2A\u0E14\u0E32\u0E40\u0E21\u0E08\u0E08\u0E32\u0E01\u0E04\u0E2D\u0E21\u0E42\u0E1A\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E02\u0E36\u0E49\u0E19 ${P(r.comboPct)}`,
    "\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E04\u0E37\u0E2D\u0E1E\u0E25\u0E31\u0E07"
  ),
  S(
    "parry_expert",
    "\u0E1B\u0E23\u0E21\u0E32\u0E08\u0E32\u0E23\u0E22\u0E4C\u0E1B\u0E31\u0E14",
    "epic",
    "steel",
    { m: "pas", n: 15 },
    { pvp: 5 },
    { guardPower: rk(0.15, 0.3), counterBonus: rk(0.25, 0.3), hpPct: same(-0.05) },
    (r) => `\u0E42\u0E25\u0E48\u0E01\u0E31\u0E19\u0E44\u0E14\u0E49\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19 ${P(r.guardPower)} \u0E40\u0E04\u0E32\u0E19\u0E4C\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 ${P(r.counterBonus)}`,
    "\u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E42\u0E08\u0E21\u0E15\u0E35\u0E04\u0E37\u0E2D\u0E42\u0E2D\u0E01\u0E32\u0E2A"
  ),
  S(
    "dodge_dancer",
    "\u0E19\u0E31\u0E01\u0E40\u0E15\u0E49\u0E19\u0E2B\u0E25\u0E1A",
    "rare",
    "wind",
    { m: "pas", n: 16 },
    { level: 13 },
    { perfectBonus: [0.03, 0.04, 0.05], perfectRefund: rk(0.5, 0.5), defPct: same(-0.08) },
    (r) => `\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E01\u0E27\u0E49\u0E32\u0E07\u0E02\u0E36\u0E49\u0E19 \u0E2B\u0E25\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2A\u0E01\u0E34\u0E25\u0E25\u0E14 ${r.perfectRefund.toFixed(1)} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D\u0E2A\u0E39\u0E49\u0E04\u0E37\u0E2D\u0E01\u0E32\u0E23\u0E40\u0E15\u0E49\u0E19\u0E23\u0E33\u0E17\u0E35\u0E48\u0E21\u0E35\u0E04\u0E19\u0E41\u0E1E\u0E49"
  ),
  S(
    "heavy_hand",
    "\u0E21\u0E37\u0E2D\u0E2B\u0E19\u0E31\u0E01",
    "uncommon",
    "earth",
    { m: "pas", n: 17 },
    { level: 4 },
    { atkPct: rk(0.08, 0.25), spd: same(-0.05) },
    (r) => `\u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35 +${P(r.atkPct)}`,
    "\u0E15\u0E35\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27\u0E43\u0E2B\u0E49\u0E08\u0E33"
  ),
  S(
    "thorn_hide",
    "\u0E2B\u0E19\u0E31\u0E07\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19",
    "rare",
    "nature",
    { m: "pas", n: 18 },
    { zone: "z3" },
    { thorns: rk(0.18, 0.35), spd: same(-0.04) },
    (r) => `\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E15\u0E35\u0E23\u0E30\u0E22\u0E30\u0E43\u0E01\u0E25\u0E49\u0E42\u0E14\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19 ${P(r.thorns)} \u0E02\u0E2D\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35`,
    "\u0E08\u0E31\u0E1A\u0E02\u0E49\u0E32\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E44\u0E2B\u0E23\u0E48 \u0E40\u0E08\u0E47\u0E1A\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E19\u0E31\u0E49\u0E19"
  ),
  S(
    "mana_battery",
    "\u0E41\u0E1A\u0E15\u0E40\u0E15\u0E2D\u0E23\u0E35\u0E48\u0E40\u0E27\u0E17",
    "uncommon",
    "arcane",
    { m: "pas", n: 19 },
    { level: 15 },
    { skillCd: rk(0.05, 0.4), skillPower: rk(0.05, 0.4), atkPct: same(-0.04) },
    (r) => `\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E2A\u0E01\u0E34\u0E25 \u2212${P(r.skillCd)} \u0E14\u0E32\u0E40\u0E21\u0E08\u0E2A\u0E01\u0E34\u0E25 +${P(r.skillPower)}`,
    "\u0E1E\u0E25\u0E31\u0E07\u0E17\u0E35\u0E48\u0E40\u0E01\u0E47\u0E1A\u0E44\u0E27\u0E49\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E44\u0E2B\u0E19"
  ),
  S(
    "bloodlust",
    "\u0E01\u0E23\u0E30\u0E2B\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14",
    "rare",
    "blood",
    { m: "pas", n: 20 },
    { boss: 6 },
    { healOnKill: rk(0.03, 0.3), atkPct: same(0.04), dmgTaken: same(0.06) },
    (r) => `\u0E01\u0E33\u0E08\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39\u0E41\u0E25\u0E49\u0E27\u0E1F\u0E37\u0E49\u0E19 ${P(r.healOnKill)} \u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35 +4%`,
    "\u0E01\u0E32\u0E23\u0E25\u0E48\u0E32\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E2B\u0E34\u0E27\u0E22\u0E34\u0E48\u0E07\u0E01\u0E27\u0E48\u0E32\u0E40\u0E14\u0E34\u0E21"
  ),
  S(
    "stone_body",
    "\u0E01\u0E32\u0E22\u0E2B\u0E34\u0E19",
    "uncommon",
    "earth",
    { m: "pas", n: 21 },
    { level: 6 },
    { hpPct: rk(0.12, 0.33), spd: same(-0.08), dashCd: same(-0.1) },
    (r) => `\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 +${P(r.hpPct)}`,
    "\u0E20\u0E39\u0E40\u0E02\u0E32\u0E44\u0E21\u0E48\u0E2B\u0E25\u0E1A"
  ),
  S(
    "gamblers_luck",
    "\u0E42\u0E0A\u0E04\u0E19\u0E31\u0E01\u0E1E\u0E19\u0E31\u0E19",
    "rare",
    "arcane",
    { m: "pas", n: 22 },
    { level: 17 },
    { crit: rk(0.08, 0.3), critMult: same(-0.15) },
    (r) => `\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +${P(r.crit)}`,
    "\u0E41\u0E17\u0E07\u0E17\u0E38\u0E01\u0E15\u0E32 \u0E0A\u0E19\u0E30\u0E1A\u0E49\u0E32\u0E07\u0E41\u0E1E\u0E49\u0E1A\u0E49\u0E32\u0E07"
  ),
  S(
    "hunter_eye",
    "\u0E15\u0E32\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E40\u0E07\u0E32",
    "epic",
    "shadow",
    { m: "pas", n: 23 },
    { tower: 15 },
    { debuff: rk(0.15, 0.35), hpPct: same(-0.04) },
    (r) => `\u0E1C\u0E25\u0E02\u0E2D\u0E07\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22 \u0E15\u0E34\u0E14\u0E44\u0E1F \u0E41\u0E25\u0E30\u0E14\u0E35\u0E1A\u0E31\u0E1F\u0E17\u0E35\u0E48\u0E43\u0E2A\u0E48\u0E28\u0E31\u0E15\u0E23\u0E39\u0E41\u0E23\u0E07\u0E02\u0E36\u0E49\u0E19 ${P(r.debuff)}`,
    "\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E38\u0E14\u0E2D\u0E48\u0E2D\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E21\u0E31\u0E19\u0E08\u0E30\u0E23\u0E39\u0E49\u0E15\u0E31\u0E27"
  ),
  S(
    "phoenix_heart",
    "\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1F\u0E35\u0E19\u0E34\u0E01\u0E0B\u0E4C",
    "legendary",
    "fire",
    { m: "pas", n: 24 },
    { raid: "r1" },
    { lowHpRegen: rk(0.02, 0.3), dmgTaken: same(0.04) },
    (r) => `\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E15\u0E48\u0E33\u0E01\u0E27\u0E48\u0E32 30% \u0E1F\u0E37\u0E49\u0E19 ${P(r.lowHpRegen)} \u0E02\u0E2D\u0E07\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E17\u0E38\u0E01\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    "\u0E40\u0E16\u0E49\u0E32\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E2D\u0E38\u0E48\u0E19\u0E1E\u0E2D\u0E08\u0E30\u0E25\u0E38\u0E01\u0E02\u0E36\u0E49\u0E19\u0E43\u0E2B\u0E21\u0E48"
  ),
  S(
    "executioner",
    "\u0E40\u0E1E\u0E0A\u0E0C\u0E06\u0E32\u0E15",
    "epic",
    "blood",
    { m: "pas", n: 25 },
    { boss: 22 },
    { lowFoeDmg: rk(0.25, 0.3), highFoeDmg: same(-0.06) },
    (r) => `\u0E14\u0E32\u0E40\u0E21\u0E08\u0E15\u0E48\u0E2D\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32 30% +${P(r.lowFoeDmg)}`,
    "\u0E07\u0E32\u0E19\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22"
  ),
  S(
    "ultimate_resonance",
    "\u0E1E\u0E25\u0E31\u0E07\u0E2A\u0E31\u0E48\u0E19\u0E1E\u0E49\u0E2D\u0E07",
    "legendary",
    "star",
    { m: "pas", n: 26 },
    { tower: 45 },
    { ultGain: rk(0.15, 0.6), skillPower: same(-0.05) },
    (r) => `\u0E2A\u0E30\u0E2A\u0E21\u0E41\u0E15\u0E49\u0E21\u0E17\u0E48\u0E32\u0E44\u0E21\u0E49\u0E15\u0E32\u0E22\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19 ${P(r.ultGain)}`,
    "\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E48\u0E19\u0E15\u0E32\u0E21\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E2B\u0E31\u0E27\u0E43\u0E08"
  )
]));

// src/data/skills.js
var SKILL_SLOTS = 3;
var FIRST = {
  // ---------------------------------------------------------------- actives
  ember_whirl: {
    id: "ember_whirl",
    rarity: "rare",
    kind: "active",
    name: "\u0E27\u0E07\u0E40\u0E1E\u0E25\u0E34\u0E07",
    icon: "whirl",
    maxRank: 3,
    cat: "area",
    el: "fire",
    art: { m: "whirl", n: 1 },
    unlock: { level: 2 },
    cast: "nova",
    opt: { kb: 320, rays: 8 },
    cooldown: [6, 5.5, 5],
    power: [1.6, 1.9, 2.3],
    radius: [120, 130, 145],
    desc: (r) => `\u0E2B\u0E21\u0E38\u0E19\u0E15\u0E31\u0E27\u0E1F\u0E31\u0E19\u0E23\u0E2D\u0E1A\u0E17\u0E34\u0E28 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22 ${pctx(r.power)} \u0E02\u0E2D\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E42\u0E08\u0E21\u0E15\u0E35 \u0E43\u0E19\u0E23\u0E31\u0E28\u0E21\u0E35 ${r.radius} \u0E01\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E28\u0E31\u0E15\u0E23\u0E39\u0E2D\u0E2D\u0E01`,
    lore: "\u0E17\u0E48\u0E32\u0E41\u0E23\u0E01\u0E17\u0E35\u0E48\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27\u0E2A\u0E2D\u0E19 \u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E44\u0E1F\u0E43\u0E19\u0E40\u0E15\u0E32\u0E22\u0E31\u0E07\u0E25\u0E38\u0E01\u0E42\u0E0A\u0E19"
  },
  fang_lunge: {
    id: "fang_lunge",
    rarity: "uncommon",
    kind: "active",
    name: "\u0E1E\u0E38\u0E48\u0E07\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27",
    icon: "lunge",
    maxRank: 3,
    cat: "move",
    el: "fire",
    art: { m: "dash", n: 1 },
    unlock: { level: 4 },
    cast: "dash",
    opt: {},
    cooldown: [5, 4.5, 4],
    power: [1.4, 1.7, 2],
    distance: [250, 280, 310],
    desc: (r) => `\u0E1E\u0E38\u0E48\u0E07\u0E17\u0E30\u0E25\u0E38\u0E44\u0E1B\u0E02\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E49\u0E32 ${r.distance} \u0E2B\u0E19\u0E48\u0E27\u0E22 \u0E2D\u0E21\u0E15\u0E30\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1E\u0E38\u0E48\u0E07 \u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E42\u0E14\u0E19 ${pctx(r.power)}`,
    lore: "\u0E1D\u0E35\u0E40\u0E17\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E2B\u0E22\u0E38\u0E14\u0E27\u0E34\u0E48\u0E07\u0E15\u0E32\u0E21\u0E23\u0E2D\u0E22\u0E1E\u0E35\u0E48\u0E2A\u0E32\u0E27"
  },
  thorn_snare: {
    id: "thorn_snare",
    rarity: "epic",
    kind: "active",
    name: "\u0E01\u0E23\u0E07\u0E2B\u0E19\u0E32\u0E21",
    icon: "snare",
    maxRank: 3,
    cat: "ctrl",
    el: "nature",
    art: { m: "field", n: 2 },
    unlock: { flag: "mem_thorns" },
    cast: "snare",
    opt: {},
    cooldown: [9, 8, 7],
    power: [0.8, 1, 1.25],
    radius: [110, 125, 140],
    slow: [0.5, 0.45, 0.4],
    duration: [2.5, 3, 3.5],
    desc: (r) => `\u0E40\u0E23\u0E35\u0E22\u0E01\u0E23\u0E32\u0E01\u0E2B\u0E19\u0E32\u0E21\u0E23\u0E2D\u0E1A\u0E28\u0E31\u0E15\u0E23\u0E39\u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E17\u0E33\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22 ${pctx(r.power)} \u0E41\u0E25\u0E30\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E0A\u0E49\u0E32\u0E25\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D ${Math.round(r.slow * 100)}% \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    lore: "\u0E2B\u0E19\u0E32\u0E21\u0E43\u0E19\u0E1B\u0E48\u0E32\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E1F\u0E31\u0E07\u0E16\u0E48\u0E32\u0E19\u0E04\u0E23\u0E36\u0E48\u0E07\u0E14\u0E27\u0E07\u0E43\u0E19\u0E15\u0E31\u0E27\u0E40\u0E08\u0E49\u0E32 \u2014 \u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E41\u0E23\u0E01\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32"
  },
  hearth_ward: {
    id: "hearth_ward",
    rarity: "legendary",
    kind: "active",
    name: "\u0E42\u0E25\u0E48\u0E16\u0E48\u0E32\u0E19\u0E2D\u0E38\u0E48\u0E19",
    icon: "ward",
    maxRank: 3,
    cat: "def",
    el: "fire",
    art: { m: "shield", n: 1 },
    unlock: { flag: "mem_ward" },
    cast: "shield",
    opt: {},
    cooldown: [16, 14, 12],
    shieldPct: [0.25, 0.35, 0.45],
    duration: [5, 5, 6],
    desc: (r) => `\u0E40\u0E01\u0E23\u0E32\u0E30\u0E44\u0E2D\u0E2D\u0E38\u0E48\u0E19\u0E14\u0E39\u0E14\u0E0B\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22 ${Math.round(r.shieldPct * 100)}% \u0E02\u0E2D\u0E07\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 \u0E19\u0E32\u0E19 ${r.duration} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`,
    lore: "\u0E44\u0E2D\u0E2D\u0E38\u0E48\u0E19\u0E08\u0E32\u0E01\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D\u0E2A\u0E35\u0E41\u0E14\u0E07\u0E17\u0E35\u0E48\u0E1E\u0E35\u0E48\u0E16\u0E31\u0E01\u0E43\u0E2B\u0E49 \u2014 \u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2D\u0E48\u0E32\u0E19\u0E08\u0E14\u0E2B\u0E21\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27"
  },
  // ---------------------------------------------------------------- passives
  hawk_eye: {
    id: "hawk_eye",
    rarity: "common",
    kind: "passive",
    name: "\u0E15\u0E32\u0E40\u0E2B\u0E22\u0E35\u0E48\u0E22\u0E27",
    icon: "eye",
    maxRank: 3,
    cat: "pas",
    el: "wind",
    art: { m: "pas", n: 30 },
    unlock: { level: 2 },
    crit: [0.04, 0.08, 0.12],
    desc: (r) => `\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E04\u0E23\u0E34\u0E15\u0E34\u0E04\u0E2D\u0E25 +${Math.round(r.crit * 100)}%`,
    lore: "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32\u0E40\u0E2B\u0E47\u0E19\u0E23\u0E2D\u0E22\u0E2B\u0E19\u0E32\u0E21\u0E17\u0E35\u0E48\u0E02\u0E32\u0E14\u0E01\u0E48\u0E2D\u0E19\u0E04\u0E19\u0E2D\u0E37\u0E48\u0E19\u0E40\u0E2A\u0E21\u0E2D"
  },
  hunter_blood: {
    id: "hunter_blood",
    rarity: "uncommon",
    kind: "passive",
    name: "\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32",
    icon: "blood",
    maxRank: 3,
    cat: "pas",
    el: "blood",
    art: { m: "pas", n: 31 },
    unlock: { level: 3 },
    healOnKill: [0.02, 0.03, 0.04],
    desc: (r) => `\u0E1F\u0E37\u0E49\u0E19\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15 ${Math.round(r.healOnKill * 100)}% \u0E02\u0E2D\u0E07\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E08\u0E31\u0E14\u0E28\u0E31\u0E15\u0E23\u0E39`,
    lore: "\u0E44\u0E1F\u0E43\u0E19\u0E15\u0E31\u0E27\u0E40\u0E08\u0E49\u0E32\u0E01\u0E34\u0E19\u0E40\u0E16\u0E49\u0E32\u0E02\u0E2D\u0E07\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E21\u0E31\u0E19\u0E40\u0E1C\u0E32"
  },
  wind_step: {
    id: "wind_step",
    rarity: "rare",
    kind: "passive",
    name: "\u0E1D\u0E35\u0E40\u0E17\u0E49\u0E32\u0E25\u0E21",
    icon: "wind",
    maxRank: 3,
    cat: "pas",
    el: "wind",
    art: { m: "pas", n: 32 },
    unlock: { level: 3 },
    dashCd: [0.1, 0.2, 0.3],
    spd: [0.03, 0.06, 0.09],
    desc: (r) => `\u0E04\u0E39\u0E25\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E1E\u0E38\u0E48\u0E07\u0E2B\u0E25\u0E1A \u2212${Math.round(r.dashCd * 100)}% \u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27 +${Math.round(r.spd * 100)}%`,
    lore: "\u0E17\u0E32\u0E07\u0E40\u0E14\u0E34\u0E19\u0E43\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E17\u0E38\u0E01\u0E04\u0E37\u0E19 \u0E04\u0E19\u0E17\u0E35\u0E48\u0E0A\u0E49\u0E32\u0E08\u0E30\u0E15\u0E34\u0E14\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E49\u0E32\u0E07\u0E43\u0E19"
  },
  thick_hide: {
    id: "thick_hide",
    rarity: "uncommon",
    kind: "passive",
    name: "\u0E2B\u0E19\u0E31\u0E07\u0E2B\u0E19\u0E32",
    icon: "hide",
    maxRank: 3,
    cat: "pas",
    el: "earth",
    art: { m: "pas", n: 33 },
    unlock: { level: 4 },
    hpPct: [0.06, 0.12, 0.18],
    trapReduce: [0.15, 0.3, 0.45],
    desc: (r) => `\u0E1E\u0E25\u0E31\u0E07\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 +${Math.round(r.hpPct * 100)}% \u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E22\u0E2B\u0E32\u0E22\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01 \u2212${Math.round(r.trapReduce * 100)}%`,
    lore: "\u0E41\u0E1C\u0E25\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E32\u0E01\u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01\u0E43\u0E19\u0E14\u0E31\u0E19\u0E40\u0E08\u0E35\u0E49\u0E22\u0E19 \u0E2A\u0E2D\u0E19\u0E43\u0E2B\u0E49\u0E23\u0E30\u0E27\u0E31\u0E07\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32\u0E04\u0E33\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E43\u0E14"
  }
};
var SKILLS = Object.freeze({ ...FIRST, ...SKILLBOOK });
var SKILL_IDS = Object.freeze(Object.keys(SKILLS));
var SKILL_CATS = Object.freeze([
  { id: "all", name: "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14" },
  { id: "atk", name: "\u0E42\u0E08\u0E21\u0E15\u0E35" },
  { id: "area", name: "\u0E27\u0E07\u0E01\u0E27\u0E49\u0E32\u0E07" },
  { id: "move", name: "\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48" },
  { id: "ctrl", name: "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21" },
  { id: "def", name: "\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19" },
  { id: "sup", name: "\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E1E\u0E25\u0E31\u0E07" },
  { id: "pas", name: "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E27" }
]);
function pctx(v) {
  return `${Math.round(v * 100)}%`;
}
function getSkill(id) {
  return Object.prototype.hasOwnProperty.call(SKILLS, id) ? SKILLS[id] : null;
}
function rankValues(skill, rank) {
  const out = {};
  const i = Math.max(0, Math.min(skill.maxRank, rank) - 1);
  for (const [k, v] of Object.entries(skill)) if (Array.isArray(v)) out[k] = v[i];
  return out;
}

// src/core/state.js
var SAVE_VERSION = 7;
var START_SPARKS = 10;
var HERO_NAME_MAX = 16;
var DEFAULT_HERO_NAME = "\u0E19\u0E31\u0E01\u0E25\u0E48\u0E32";
function createNewState(now = Date.now()) {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    nextUid: 4,
    gold: 60,
    player: { level: 1, xp: 0 },
    equipment: {
      weapon: { uid: 1, id: "w_rust_blade", qty: 1, lvl: 0 },
      armor: { uid: 2, id: "a_cloth_wrap", qty: 1, lvl: 0 },
      charm: null,
      wings: null
      // v6
    },
    inventory: {
      capacity: BALANCE.inventory.capacity,
      bagLevel: 0,
      // v7: each level = +5 slots
      slots: [{ uid: 3, id: "p_tonic", qty: 2, lvl: 0 }]
    },
    progress: { cleared: {}, clears: {} },
    stats: { kills: 0, runs: 0, upgradesWon: 0, upgradesLost: 0, crafted: 0, perfects: 0, parries: 0, bossKills: 0, ults: 0, bossRush: 0 },
    settings: { sfx: 0.8, music: 0.45, ui: 0.7, shake: true, fullscreen: false, landscape: false },
    skills: { ranks: {}, slots: new Array(SKILL_SLOTS).fill(null) },
    story: { name: DEFAULT_HERO_NAME, flags: {}, seen: {}, lore: {} },
    race: { id: null, rolls: 0 },
    // v3: bloodline (null until the awakening)
    raceSlots: [null, null],
    // v7: two stored bloodlines to swap with the active one
    raceSeen: {},
    // v7: every bloodline ever rolled (collection)
    sparks: START_SPARKS,
    // v3: Amber Sparks, the pet-summon currency
    pets: { owned: {}, active: [], pity: 0, summons: 0 },
    social: { friends: {} },
    // v4: friends by account id → { name, at }
    pvp: { wins: 0, losses: 0 },
    // v4: duel record
    zones: { cleared: {}, best: {} },
    // v5: online zones cleared (count) and best time (s)
    raids: {},
    // v6: special dungeons { id: { last (ms of the last kill), kills } }
    blueprints: {},
    // v6: blueprints the chief has drawn { itemId: true }
    artifacts: { owned: {}, slots: {} },
    // v6: artifacts { id: { lvl } } and the Cosmic Tree { slotId: artifactId }
    infinite: { day: "", used: 0, best: 0, runs: 0 },
    // v6: Infinite Rift entries today and the deepest wave
    tower: { best: 0, asc: 0, bestAsc: 0, runs: 0, kills: 0, gods: {}, claimed: {}, deepest: 0 },
    // v7: the Underworld Tower
    titles: { owned: {}, equipped: null },
    profile: { avatar: null, bio: "" },
    // v7: my profile picture (small data URL) and a line about me               // v7: achievements (id → time) and the worn title
    guild: null,
    // v5: { id, name, tag } of my guild (the guild itself is a shared document)
    integrity: "ok"
    // v6: 'modified' once a save was edited outside the game
  };
}
function cleanHeroName(raw) {
  const s = String(raw ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  return Array.from(s).slice(0, HERO_NAME_MAX).join("") || DEFAULT_HERO_NAME;
}

// src/systems/skills.js
var PASSIVE_KEYS = Object.freeze([
  "crit",
  "hpPct",
  "spd",
  "dashCd",
  "trapReduce",
  "healOnKill",
  "atkPct",
  "defPct",
  "critMult",
  "skillPower",
  "skillCd",
  "ignite",
  "lifesteal",
  "regen",
  "dmgTaken",
  "lastStand",
  "goldMult",
  "comboPct",
  "guardPower",
  "counterBonus",
  "perfectBonus",
  "perfectRefund",
  "thorns",
  "debuff",
  "lowHpDmg",
  "lowHpRegen",
  "lowFoeDmg",
  "highFoeDmg",
  "ultGain"
]);
function passiveBonuses(state) {
  const b = Object.fromEntries(PASSIVE_KEYS.map((k) => [k, 0]));
  for (const [id, rank] of Object.entries(state.skills.ranks)) {
    const s = getSkill(id);
    if (!s || s.kind !== "passive" || rank <= 0) continue;
    const v = rankValues(s, rank);
    for (const k of Object.keys(b)) if (v[k] != null) b[k] += v[k];
  }
  return b;
}

// src/systems/inventory.js
var REASONS = Object.freeze({
  UNKNOWN_ITEM: "unknown_item",
  BAD_QTY: "bad_qty",
  FULL: "inventory_full",
  NOT_ENOUGH: "not_enough",
  NOT_FOUND: "not_found"
});

// src/systems/race.js
var NO_STATS = Object.freeze({ hpPct: 0, atkPct: 0, defPct: 0, crit: 0, critMult: 0, spd: 0 });
function raceStats(state) {
  const race = getRace(state.race?.id);
  return race ? { ...NO_STATS, ...race.stats } : { ...NO_STATS };
}
function raceAbility(state) {
  return getRace(state.race?.id)?.ability || {};
}

// src/systems/pets.js
function teamOf(state) {
  const a = state.pets?.active;
  const list = Array.isArray(a) ? a : a ? [a] : [];
  const out = [];
  for (const id of list) if (getPet(id) && state.pets.owned?.[id] && !out.includes(id) && out.length < PET_TEAM) out.push(id);
  return out;
}
function petEntry(state, id) {
  const pet = getPet(id);
  const stars = state.pets.owned[id].stars;
  return { id, pet, stars, v: petValues(pet, stars) };
}
function activePets(state) {
  return teamOf(state).map((id) => petEntry(state, id));
}
var PASSIVE_CAPS = Object.freeze({ magnet: 2.5, goldMult: 0.6, skillCd: 0.35, skillPower: 0.5, allPct: 0.18, perfectRefund: 2.5, dodgeCd: 0.35, spd: 0.15, critPct: 0.1, defPct: 0.2, thorns: 1.2 });
function petPassives(state) {
  const b = Object.fromEntries(Object.keys(PASSIVE_CAPS).map((k) => [k, 0]));
  for (const a of activePets(state)) for (const k of Object.keys(b)) if (typeof a.v[k] === "number") b[k] += a.v[k];
  for (const k of Object.keys(b)) b[k] = Math.round(Math.min(PASSIVE_CAPS[k], b[k]) * 1e3) / 1e3;
  return b;
}

// src/data/rarity.js
var RARITIES = Object.freeze({
  common: { id: "common", name: "\u0E18\u0E23\u0E23\u0E21\u0E14\u0E32", order: 0, color: "#c9bfa9" },
  uncommon: { id: "uncommon", name: "\u0E1B\u0E23\u0E30\u0E13\u0E35\u0E15", order: 1, color: "#7fc77a" },
  rare: { id: "rare", name: "\u0E2B\u0E32\u0E22\u0E32\u0E01", order: 2, color: "#5fa8ec" },
  epic: { id: "epic", name: "\u0E25\u0E49\u0E33\u0E04\u0E48\u0E32", order: 3, color: "#c27ff0" },
  legendary: { id: "legendary", name: "\u0E15\u0E33\u0E19\u0E32\u0E19", order: 4, color: "#f2b544" },
  mythic: { id: "mythic", name: "\u0E40\u0E17\u0E1E\u0E15\u0E33\u0E19\u0E32\u0E19", order: 5, color: "#ff5f7a" }
});

// src/systems/artifacts.js
var EMPTY = Object.freeze(Object.fromEntries(Object.keys(ART_CAPS).map((k) => [k, 0])));
var levelMult = (lvl) => 1 + ART_LEVEL_STEP * (Math.max(1, Math.min(ART_LEVEL_MAX, lvl | 0)) - 1);
function slotMatches(slot, art) {
  if (!slot || !art) return false;
  if (slot.aff === "any") return false;
  return Object.keys(art.fx).some((k) => FX_KIND[k] === slot.aff);
}
function slotFilled(state, id) {
  return !!state.artifacts?.slots?.[id];
}
function slotUnlocked(state, id) {
  const s = getSlot(id);
  if (!s) return false;
  if (state.player.level < s.level) return false;
  return !s.parent || slotFilled(state, s.parent);
}
function artifactEffect(art, lvl, slot) {
  const m = levelMult(lvl) * (slotMatches(slot, art) ? 1 + AFFINITY_BONUS : 1);
  return Object.fromEntries(Object.entries(art.fx).map(([k, v]) => [k, v * m]));
}
function artifactBonuses(state) {
  const out = { ...EMPTY };
  const A3 = state.artifacts;
  if (!A3) return out;
  for (const s of TREE) {
    const id = A3.slots?.[s.id];
    const art = getArtifact(id);
    if (!art || !slotUnlocked(state, s.id)) continue;
    const fx = artifactEffect(art, A3.owned?.[id]?.lvl || 1, s);
    for (const [k, v] of Object.entries(fx)) out[k] += v;
  }
  for (const k of Object.keys(out)) out[k] = Math.min(ART_CAPS[k], Math.round(out[k] * 1e3) / 1e3);
  return out;
}

// src/systems/titles.js
function titleBonuses(state) {
  const b = { atkPct: 0, hpPct: 0, defPct: 0, crit: 0, critMult: 0, spd: 0, goldMult: 0, skillPower: 0 };
  const t = getTitle(state.titles?.equipped);
  if (t && state.titles.owned?.[t.id]) for (const [k, v] of Object.entries(t.b)) b[k] += v;
  const tier = badgeTier(state);
  b.atkPct += tier * 0.01;
  b.defPct += tier * 0.01;
  b.hpPct += tier * 0.01;
  return b;
}

// src/systems/stats.js
var STAT_KEYS = ["atk", "def", "hp", "crit", "critMult", "spd"];
function upgradeMultiplier(lvl) {
  const L = Math.max(0, lvl | 0), u = BALANCE.upgrade;
  return 1 + u.statGrowthPerLevel * Math.min(10, L) + (u.statGrowthHigh ?? u.statGrowthPerLevel) * Math.max(0, L - 10);
}
function itemStats(instance) {
  const def = instance && getItem(instance.id);
  if (!def || !def.stats) return {};
  const m = upgradeMultiplier(instance.lvl);
  const out = {};
  for (const k of STAT_KEYS) {
    if (def.stats[k] == null) continue;
    const v = def.stats[k] * m;
    out[k] = k === "atk" || k === "def" || k === "hp" ? Math.round(v) : Math.round(v * 1e3) / 1e3;
  }
  return out;
}
function baseStats(level) {
  const p = BALANCE.player;
  const l = Math.max(1, level | 0) - 1;
  return {
    hp: Math.round(p.baseHp + p.hpPerLevel * l),
    atk: Math.round(p.baseAtk + p.atkPerLevel * l),
    def: Math.round(p.baseDef + p.defPerLevel * l),
    crit: p.baseCrit,
    critMult: p.baseCritMult,
    spd: 0
  };
}
var r22 = (v) => Math.round(v * 100) / 100;
var r3 = (v) => Math.round(v * 1e3) / 1e3;
function computeStats(state) {
  const s = baseStats(state.player.level);
  for (const slot of EQUIP_SLOTS) {
    const it = itemStats(state.equipment[slot]);
    for (const k of Object.keys(it)) s[k] = (s[k] || 0) + it[k];
  }
  const pb = state.skills ? passiveBonuses(state) : Object.fromEntries(PASSIVE_KEYS.map((k) => [k, 0]));
  const rs = raceStats(state), ra = raceAbility(state);
  const pp = state.pets ? petPassives(state) : { magnet: 0, goldMult: 0, skillCd: 0, skillPower: 0, allPct: 0, perfectRefund: 0, dodgeCd: 0, spd: 0, critPct: 0, defPct: 0, thorns: 0 };
  const art = state.artifacts ? artifactBonuses(state) : null;
  const tb = titleBonuses(state);
  s.crit += pb.crit + rs.crit + (art?.crit || 0) + pp.critPct + tb.crit;
  s.spd += pb.spd + rs.spd + (art?.spd || 0) + pp.spd + tb.spd;
  s.critMult += rs.critMult + (art?.critMult || 0) + tb.critMult + pb.critMult;
  s.def += art?.defFlat || 0;
  const weapon = getItem(state.equipment.weapon?.id);
  return {
    maxHp: Math.max(1, Math.round(s.hp * Math.max(0.3, 1 + pb.hpPct + rs.hpPct + pp.allPct + (art?.hpPct || 0) + tb.hpPct))),
    atk: Math.max(1, Math.round(s.atk * Math.max(0.3, 1 + rs.atkPct + pp.allPct + (art?.atkPct || 0) + tb.atkPct + pb.atkPct))),
    def: Math.max(0, Math.round(s.def * Math.max(0.2, 1 + rs.defPct + pp.allPct + pp.defPct + (art?.defPct || 0) + tb.defPct + pb.defPct))),
    crit: Math.max(0, Math.min(BALANCE.combat.critChanceCap, r3(s.crit))),
    critMult: r22(Math.max(1.1, s.critMult)),
    speed: Math.round(BALANCE.player.baseSpeed * Math.max(0.5, 1 + s.spd)),
    spdBonus: r3(s.spd),
    // dodge / traps / sustain
    dashCdMult: r22(Math.max(0.3, (1 - pb.dashCd) * (1 - (ra.dodgeCd || 0)) * (1 - pp.dodgeCd))),
    perfectBonus: (ra.perfectBonus || 0) + pb.perfectBonus,
    trapReduce: Math.min(0.8, r3(pb.trapReduce + (ra.trapReduce || 0))),
    healOnKill: pb.healOnKill + (art?.healOnKill || 0) + (ra.healOnKill || 0),
    // artifacts
    shieldPct: (art?.shieldPct || 0) + (ra.shieldPct || 0),
    debuff: (art?.debuff || 0) + (ra.debuff || 0) + pb.debuff,
    guardPower: (art?.guard || 0) + (ra.guardPower || 0) + pb.guardPower,
    counterBonus: (art?.counter || 0) + (ra.counterBonus || 0) + pb.counterBonus,
    regen: (ra.regen || 0) + pb.regen,
    lowHpDef: ra.lowHpDef || 0,
    fireReduce: ra.fireReduce || 0,
    ignite: (ra.ignite || 0) + pb.ignite,
    lastStand: !!ra.lastStand || pb.lastStand > 0,
    // v8 skill passives
    lifesteal: r3(pb.lifesteal),
    dmgTaken: r3(Math.max(-0.5, pb.dmgTaken)),
    comboPct: r22(pb.comboPct),
    lowHpDmg: r22(pb.lowHpDmg),
    lowHpRegen: r3(pb.lowHpRegen),
    lowFoeDmg: r22(pb.lowFoeDmg),
    highFoeDmg: r22(pb.highFoeDmg),
    ultGain: r22(pb.ultGain),
    // economy / skills (bloodline + pet)
    goldMult: r22(1 + (ra.goldMult || 0) + pp.goldMult + tb.goldMult + pb.goldMult),
    magnetMult: r22(1 + pp.magnet + (ra.magnet || 0)),
    skillCdMult: r22(Math.max(0.4, (1 - pp.skillCd) * (1 - (ra.skillCd || 0)) * (1 - pb.skillCd))),
    skillPower: r22(Math.max(0.5, 1 + pp.skillPower + (ra.skillPower || 0) + tb.skillPower + pb.skillPower)),
    perfectRefund: pp.perfectRefund + pb.perfectRefund,
    thorns: pp.thorns + pb.thorns,
    wtype: weapon?.wtype || "sword",
    weaponId: weapon?.id || null,
    unique: weapon?.unique || null
  };
}

// src/systems/profile.js
var AVATAR_MAX = 28 * 1024;
var BIO_MAX = 80;
var AVATAR_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
var avatarOk = (v) => typeof v === "string" && v.length <= AVATAR_MAX && AVATAR_RE.test(v);
function cleanBio(v) {
  return Array.from(String(v ?? "").replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩<>]/g, "").replace(/\s+/g, " ").trim()).slice(0, BIO_MAX).join("");
}
function powerOf(stats) {
  return Math.round(stats.atk * 3 + stats.def * 2.5 + stats.maxHp * 0.35 + stats.crit * 400 + (stats.critMult - 1.5) * 60);
}
function publicCard(state) {
  const t = computeStats(state);
  const eq = {};
  for (const s of EQUIP_SLOTS) {
    const it = state.equipment[s];
    if (it) eq[s] = [it.id, it.lvl || 0];
  }
  const arts = [];
  for (const [slot, id] of Object.entries(state.artifacts?.slots || {})) if (getArtifact(id)) arts.push([id, state.artifacts.owned?.[id]?.lvl || 1, slot]);
  const team = teamOf(state).map((id) => [id, state.pets?.owned?.[id]?.stars || 1]);
  const raids = Object.values(state.raids || {}).reduce((a, r) => a + (r?.kills || 0), 0);
  const zones = Object.values(state.zones?.cleared || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  return {
    v: 1,
    n: state.story.name,
    lv: state.player.level,
    r: state.race?.id || null,
    tt: state.titles?.equipped || null,
    tb: state.titles ? badgeTier(state) : 0,
    gt: state.guild?.tag || null,
    gn: state.guild?.name || null,
    av: avatarOk(state.profile?.avatar) ? state.profile.avatar : null,
    bio: cleanBio(state.profile?.bio),
    eq,
    arts: arts.slice(0, 24),
    pets: team,
    petCount: Object.keys(state.pets?.owned || {}).length,
    st: { power: powerOf(t), atk: Math.round(t.atk), def: Math.round(t.def), hp: Math.round(t.maxHp), crit: Math.round(t.crit * 1e3) / 10, critMult: Math.round(t.critMult * 100) / 100 },
    rec: {
      tower: state.tower?.deepest || 0,
      asc: state.tower?.bestAsc || 0,
      gods: Object.keys(state.tower?.gods || {}).length,
      pvpW: state.pvp?.wins || 0,
      pvpL: state.pvp?.losses || 0,
      kills: state.stats?.kills || 0,
      rift: state.infinite?.best || 0,
      raids,
      zones,
      titles: Object.keys(state.titles?.owned || {}).length,
      races: Object.keys(state.raceSeen || {}).length,
      bag: state.inventory?.capacity || 30
    },
    mod: state.integrity === "modified" ? 1 : 0
  };
}

// src/data/stages.js
var STAGES = Object.freeze([
  {
    id: "s1",
    name: "\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E19\u0E18\u0E22\u0E32",
    theme: "thornwood",
    requires: null,
    recommendedLevel: 1,
    desc: "\u0E1B\u0E48\u0E32\u0E17\u0E35\u0E48\u0E40\u0E04\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19 \u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E40\u0E01\u0E48\u0E32\u0E0B\u0E48\u0E2D\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E25\u0E31\u0E07\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E1C\u0E19\u0E36\u0E01 \u0E2B\u0E32\u0E01\u0E38\u0E0D\u0E41\u0E08\u0E08\u0E32\u0E01\u0E1C\u0E39\u0E49\u0E40\u0E1D\u0E49\u0E32 \u0E41\u0E25\u0E49\u0E27\u0E40\u0E1C\u0E0A\u0E34\u0E0D\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E31\u0E1A\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E2B\u0E25\u0E31\u0E07\u0E2B\u0E19\u0E32\u0E21"
  },
  {
    id: "s2",
    name: "\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E16\u0E48\u0E32\u0E19\u0E23\u0E49\u0E32\u0E07",
    theme: "cinder",
    requires: "s1",
    recommendedLevel: 5,
    desc: "\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E44\u0E1F\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E14\u0E31\u0E1A \u0E21\u0E35\u0E0A\u0E48\u0E2D\u0E07\u0E44\u0E1F\u0E41\u0E25\u0E30\u0E2B\u0E34\u0E19\u0E16\u0E25\u0E48\u0E21 \u0E20\u0E39\u0E15\u0E16\u0E48\u0E32\u0E19\u0E41\u0E14\u0E07\u0E22\u0E34\u0E07\u0E25\u0E39\u0E01\u0E44\u0E1F\u0E08\u0E32\u0E01\u0E23\u0E30\u0E22\u0E30\u0E44\u0E01\u0E25 \u0E1F\u0E31\u0E19\u0E25\u0E39\u0E01\u0E44\u0E1F\u0E17\u0E34\u0E49\u0E07\u0E44\u0E14\u0E49\u0E14\u0E49\u0E27\u0E22\u0E14\u0E32\u0E1A"
  }
]);
function getStage(id) {
  return STAGES.find((s) => s.id === id) || null;
}

// src/data/story.js
var SPEAKERS = Object.freeze({
  narr: { name: "", portrait: null },
  hero: { name: "{name}", portrait: "hero" },
  lek: { name: "\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01", portrait: "lek" },
  dao: { name: "\u0E14\u0E32\u0E27", portrait: "dao" },
  golem: { name: "\u0E42\u0E01\u0E40\u0E25\u0E21\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21", portrait: "golem" },
  sys: { name: "", portrait: null }
});
var SCENES = Object.freeze({
  prologue: {
    title: "\u0E1A\u0E17\u0E19\u0E33: \u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21",
    lines: [
      { s: "narr", t: '\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35\u0E01\u0E48\u0E2D\u0E19 \u0E43\u0E19\u0E04\u0E37\u0E19\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E40\u0E23\u0E35\u0E22\u0E01\u0E27\u0E48\u0E32 "\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21" \u0E16\u0E48\u0E32\u0E19\u0E15\u0E49\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E17\u0E35\u0E48\u0E43\u0E2B\u0E49\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19\u0E41\u0E01\u0E48\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E2D\u0E21\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E42\u0E2E\u0E25\u0E14\u0E4C\u0E21\u0E32\u0E2B\u0E25\u0E32\u0E22\u0E23\u0E49\u0E2D\u0E22\u0E1B\u0E35 \u0E14\u0E31\u0E1A\u0E25\u0E07' },
      { s: "narr", t: "\u0E40\u0E0A\u0E49\u0E32\u0E27\u0E31\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19\u0E23\u0E2D\u0E1A\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21 \u0E41\u0E25\u0E30\u0E14\u0E32\u0E27 \u0E0A\u0E48\u0E32\u0E07\u0E15\u0E35\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E1D\u0E35\u0E21\u0E37\u0E2D\u0E14\u0E35\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E2D\u0E31\u0E04\u0E04\u0E35 \u0E01\u0E47\u0E2B\u0E32\u0E22\u0E15\u0E31\u0E27\u0E44\u0E1B" },
      { s: "narr", t: "\u0E2A\u0E20\u0E32\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E27\u0E48\u0E32\u0E14\u0E32\u0E27\u0E02\u0E42\u0E21\u0E22\u0E16\u0E48\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27\u0E2B\u0E19\u0E35\u0E44\u0E1B \u0E21\u0E35\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E19\u0E49\u0E2D\u0E07\u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E02\u0E2D\u0E07\u0E40\u0E18\u0E2D\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E40\u0E0A\u0E37\u0E48\u0E2D" },
      { s: "lek", t: "\u0E15\u0E37\u0E48\u0E19\u0E41\u0E25\u0E49\u0E27\u0E2B\u0E23\u0E37\u0E2D {name} \u0E1D\u0E31\u0E19\u0E23\u0E49\u0E32\u0E22\u0E2D\u0E35\u0E01\u0E41\u0E25\u0E49\u0E27\u0E2A\u0E34\u0E19\u0E30 \u0E41\u0E1C\u0E25\u0E44\u0E2B\u0E21\u0E49\u0E17\u0E35\u0E48\u0E41\u0E02\u0E19\u0E40\u0E08\u0E49\u0E32\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E19\u0E02\u0E49\u0E32\u0E23\u0E39\u0E49\u0E2A\u0E36\u0E01\u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E15\u0E23\u0E07\u0E19\u0E35\u0E49" },
      { s: "hero", t: "\u0E1D\u0E31\u0E19\u0E40\u0E14\u0E34\u0E21\u0E17\u0E38\u0E01\u0E04\u0E37\u0E19 \u0E44\u0E1F \u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27\u0E40\u0E23\u0E35\u0E22\u0E01 \u0E41\u0E25\u0E49\u0E27\u0E01\u0E47\u0E21\u0E37\u0E14\u0E44\u0E1B \u0E02\u0E49\u0E32\u0E08\u0E33\u0E44\u0E14\u0E49\u0E41\u0E04\u0E48\u0E19\u0E31\u0E49\u0E19" },
      { s: "lek", t: "\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35\u0E41\u0E25\u0E49\u0E27 \u0E40\u0E08\u0E49\u0E32\u0E42\u0E15\u0E1E\u0E2D\u0E08\u0E30\u0E16\u0E37\u0E2D\u0E14\u0E32\u0E1A \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E40\u0E25\u0E34\u0E01\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E1E\u0E35\u0E48\u0E2A\u0E32\u0E27\u0E17\u0E35\u0E48\u0E17\u0E34\u0E49\u0E07\u0E40\u0E08\u0E49\u0E32\u0E44\u0E1B" },
      { s: "hero", t: "\u0E1E\u0E35\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E17\u0E34\u0E49\u0E07\u0E02\u0E49\u0E32 \u0E41\u0E25\u0E30\u0E1E\u0E35\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E02\u0E42\u0E21\u0E22\u0E2D\u0E30\u0E44\u0E23\u0E17\u0E31\u0E49\u0E07\u0E19\u0E31\u0E49\u0E19 \u0E02\u0E49\u0E32\u0E08\u0E30\u0E1E\u0E34\u0E2A\u0E39\u0E08\u0E19\u0E4C\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E2B\u0E47\u0E19" },
      { s: "lek", t: "\u0E16\u0E49\u0E32\u0E08\u0E30\u0E40\u0E02\u0E49\u0E32\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21 \u0E40\u0E2D\u0E32\u0E14\u0E32\u0E1A\u0E21\u0E32\u0E43\u0E2B\u0E49\u0E02\u0E49\u0E32\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E01\u0E48\u0E2D\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1B\u0E25\u0E36\u0E01\u0E01\u0E27\u0E48\u0E32\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E40\u0E01\u0E48\u0E32" },
      { s: "hero", thought: true, t: "\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E1E\u0E39\u0E14\u0E16\u0E36\u0E07\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E16\u0E32\u0E21\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E01\u0E47\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07" }
    ]
  },
  s1_enter: {
    title: "\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E2A\u0E19\u0E18\u0E22\u0E32",
    lines: [
      { s: "hero", t: "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E40\u0E02\u0E49\u0E32\u0E43\u0E01\u0E25\u0E49\u0E1B\u0E48\u0E32\u0E19\u0E35\u0E49 \u0E41\u0E1C\u0E25\u0E44\u0E2B\u0E21\u0E49\u0E17\u0E35\u0E48\u0E41\u0E02\u0E19\u0E08\u0E30\u0E40\u0E15\u0E49\u0E19\u0E15\u0E38\u0E1A\u0E46 \u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E21\u0E35\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E2D\u0E35\u0E01\u0E14\u0E27\u0E07" },
      { s: "hero", t: "\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E40\u0E01\u0E48\u0E32\u0E2D\u0E22\u0E39\u0E48\u0E25\u0E36\u0E01\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1B \u0E1B\u0E23\u0E30\u0E15\u0E39\u0E2B\u0E34\u0E19\u0E16\u0E39\u0E01\u0E1C\u0E19\u0E36\u0E01\u0E44\u0E27\u0E49 \u0E15\u0E49\u0E2D\u0E07\u0E2B\u0E32\u0E01\u0E38\u0E0D\u0E41\u0E08\u0E1C\u0E19\u0E36\u0E01\u0E01\u0E48\u0E2D\u0E19" },
      { s: "sys", t: "\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E2B\u0E49\u0E2D\u0E07\u0E1A\u0E19\u0E41\u0E1C\u0E19\u0E17\u0E35\u0E48\u0E21\u0E38\u0E21\u0E02\u0E27\u0E32\u0E1A\u0E19 \u0E2B\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E21\u0E35\u0E28\u0E31\u0E15\u0E23\u0E39\u0E08\u0E30\u0E1B\u0E34\u0E14\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E08\u0E19\u0E01\u0E27\u0E48\u0E32\u0E08\u0E30\u0E01\u0E33\u0E08\u0E31\u0E14\u0E2B\u0E21\u0E14 \u0E01\u0E31\u0E1A\u0E14\u0E31\u0E01\u0E08\u0E30\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E14\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E17\u0E33\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E21\u0E2D" }
    ]
  },
  s1_boss_pre: {
    title: "\u0E1C\u0E39\u0E49\u0E40\u0E1D\u0E49\u0E32\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32",
    lines: [
      { s: "narr", t: "\u0E01\u0E25\u0E32\u0E07\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32 \u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E15\u0E31\u0E27\u0E43\u0E2B\u0E0D\u0E48\u0E22\u0E37\u0E19\u0E40\u0E1D\u0E49\u0E32\u0E41\u0E17\u0E48\u0E19\u0E2B\u0E34\u0E19\u0E17\u0E35\u0E48\u0E41\u0E15\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E2D\u0E07\u0E0B\u0E35\u0E01" },
      { s: "hero", t: "\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19... \u0E21\u0E35\u0E15\u0E23\u0E32\u0E0A\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E17\u0E31\u0E1A\u0E2D\u0E22\u0E39\u0E48 \u0E15\u0E23\u0E32\u0E14\u0E32\u0E27\u0E2A\u0E2D\u0E07\u0E41\u0E09\u0E01 \u0E19\u0E31\u0E48\u0E19\u0E15\u0E23\u0E32\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27" },
      { s: "hero", thought: true, t: "\u0E1E\u0E35\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E17\u0E34\u0E49\u0E07\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48\u0E44\u0E27\u0E49\u0E40\u0E09\u0E22\u0E46 \u0E1E\u0E35\u0E48\u0E15\u0E31\u0E49\u0E07\u0E43\u0E2B\u0E49\u0E21\u0E31\u0E19\u0E40\u0E1D\u0E49\u0E32\u0E2D\u0E30\u0E44\u0E23\u0E1A\u0E32\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07" }
    ]
  },
  s1_boss_post: {
    title: "\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E41\u0E23\u0E01",
    sets: { mem_thorns: true },
    lines: [
      { s: "narr", t: "\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E25\u0E49\u0E21\u0E25\u0E07 \u0E2B\u0E19\u0E32\u0E21\u0E1A\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E21\u0E31\u0E19\u0E23\u0E48\u0E27\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E16\u0E49\u0E32 \u0E41\u0E25\u0E49\u0E27\u0E41\u0E1C\u0E25\u0E44\u0E2B\u0E21\u0E49\u0E17\u0E35\u0E48\u0E41\u0E02\u0E19\u0E01\u0E47\u0E25\u0E38\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E44\u0E1F" },
      { s: "dao", memory: true, t: "\u0E2B\u0E25\u0E31\u0E1A\u0E15\u0E32\u0E44\u0E27\u0E49 {name}... \u0E2D\u0E22\u0E48\u0E32\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E21\u0E37\u0E2D\u0E1E\u0E35\u0E48\u0E19\u0E30" },
      { s: "hero", t: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1E\u0E35\u0E48! \u0E02\u0E49\u0E32\u0E40\u0E04\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48 \u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19\u0E02\u0E49\u0E32\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E19\u0E35\u0E49" },
      { s: "narr", t: "\u0E23\u0E32\u0E01\u0E2B\u0E19\u0E32\u0E21\u0E23\u0E2D\u0E1A\u0E25\u0E32\u0E19\u0E04\u0E25\u0E32\u0E19\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32\u0E2B\u0E22\u0E38\u0E14\u0E15\u0E23\u0E07\u0E1B\u0E25\u0E32\u0E22\u0E40\u0E17\u0E49\u0E32 \u0E41\u0E25\u0E49\u0E27\u0E42\u0E04\u0E49\u0E07\u0E15\u0E31\u0E27\u0E25\u0E07\u0E23\u0E32\u0E27\u0E01\u0E31\u0E1A\u0E01\u0E49\u0E21\u0E2B\u0E31\u0E27\u0E43\u0E2B\u0E49" },
      { s: "hero", t: "\u0E2B\u0E19\u0E32\u0E21\u0E1E\u0E27\u0E01\u0E19\u0E35\u0E49... \u0E1F\u0E31\u0E07\u0E02\u0E49\u0E32?" },
      { s: "sys", t: "\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E2A\u0E48\u0E27\u0E19 \u2014 \u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01\u0E2A\u0E01\u0E34\u0E25 \xAB\u0E01\u0E23\u0E07\u0E2B\u0E19\u0E32\u0E21\xBB (\u0E40\u0E23\u0E35\u0E22\u0E19\u0E44\u0E14\u0E49\u0E17\u0E35\u0E48\u0E40\u0E21\u0E19\u0E39\u0E2A\u0E01\u0E34\u0E25)" }
    ]
  },
  camp_after_s1: {
    title: "\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E25\u0E38\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E1E\u0E39\u0E14",
    lines: [
      { s: "hero", t: "\u0E25\u0E38\u0E07 \u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E21\u0E35\u0E15\u0E23\u0E32\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27 \u0E41\u0E25\u0E30\u0E02\u0E49\u0E32\u0E40\u0E04\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E43\u0E19\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E17\u0E33\u0E44\u0E21\u0E25\u0E38\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E1A\u0E2D\u0E01" },
      { s: "lek", t: "...\u0E40\u0E08\u0E49\u0E32\u0E22\u0E31\u0E07\u0E40\u0E14\u0E47\u0E01 \u0E40\u0E14\u0E47\u0E01\u0E40\u0E2B\u0E47\u0E19\u0E2D\u0E30\u0E44\u0E23\u0E01\u0E47\u0E1D\u0E31\u0E19\u0E16\u0E36\u0E07\u0E21\u0E31\u0E19\u0E44\u0E14\u0E49\u0E17\u0E31\u0E49\u0E07\u0E19\u0E31\u0E49\u0E19" },
      { s: "hero", if: "lore:l_altar", t: "\u0E41\u0E25\u0E49\u0E27\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E2A\u0E2D\u0E07\u0E23\u0E2D\u0E22\u0E1A\u0E19\u0E41\u0E17\u0E48\u0E19\u0E2B\u0E34\u0E19\u0E25\u0E48\u0E30 \u0E23\u0E2D\u0E22\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E40\u0E25\u0E47\u0E01\u0E40\u0E17\u0E48\u0E32\u0E21\u0E37\u0E2D\u0E40\u0E14\u0E47\u0E01" },
      { s: "lek", t: "\u0E1E\u0E2D\u0E44\u0E14\u0E49\u0E41\u0E25\u0E49\u0E27! ...\u0E02\u0E2D\u0E42\u0E17\u0E29 \u0E02\u0E49\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E43\u0E08\u0E15\u0E30\u0E04\u0E2D\u0E01" },
      { s: "lek", t: "\u0E14\u0E32\u0E27\u0E40\u0E04\u0E22\u0E21\u0E35\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21\u0E25\u0E31\u0E1A\u0E43\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E16\u0E48\u0E32\u0E19\u0E23\u0E49\u0E32\u0E07\u0E17\u0E32\u0E07\u0E15\u0E30\u0E27\u0E31\u0E19\u0E2D\u0E2D\u0E01 \u0E16\u0E49\u0E32\u0E2D\u0E22\u0E32\u0E01\u0E23\u0E39\u0E49\u0E19\u0E31\u0E01 \u0E44\u0E1B\u0E14\u0E39\u0E40\u0E2D\u0E32\u0E40\u0E2D\u0E07 \u0E41\u0E15\u0E48\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E01\u0E31\u0E1A\u0E02\u0E49\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07 \u0E16\u0E49\u0E32\u0E40\u0E08\u0E2D\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2D\u0E22\u0E32\u0E01\u0E40\u0E2B\u0E47\u0E19 \u0E43\u0E2B\u0E49\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32" },
      { s: "hero", thought: true, t: "\u0E25\u0E38\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E42\u0E01\u0E23\u0E18 \u0E25\u0E38\u0E07\u0E01\u0E25\u0E31\u0E27" }
    ]
  },
  s2_enter: {
    title: "\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E16\u0E48\u0E32\u0E19\u0E23\u0E49\u0E32\u0E07",
    lines: [
      { s: "hero", t: "\u0E2D\u0E32\u0E01\u0E32\u0E28\u0E02\u0E49\u0E32\u0E07\u0E43\u0E19\u0E23\u0E49\u0E2D\u0E19\u0E1C\u0E34\u0E14\u0E1B\u0E01\u0E15\u0E34 \u0E17\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E04\u0E23\u0E02\u0E38\u0E14\u0E16\u0E48\u0E32\u0E19\u0E21\u0E32\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35\u0E41\u0E25\u0E49\u0E27" },
      { s: "hero", t: "\u0E23\u0E2D\u0E22\u0E23\u0E32\u0E07\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E22\u0E31\u0E07\u0E43\u0E2B\u0E21\u0E48 \u0E21\u0E35\u0E04\u0E19\u0E1B\u0E49\u0E2D\u0E19\u0E16\u0E48\u0E32\u0E19\u0E43\u0E2B\u0E49\u0E2D\u0E30\u0E44\u0E23\u0E1A\u0E32\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E43\u0E19\u0E19\u0E35\u0E49\u0E21\u0E32\u0E15\u0E25\u0E2D\u0E14" },
      { s: "sys", t: "\u0E23\u0E30\u0E27\u0E31\u0E07\u0E0A\u0E48\u0E2D\u0E07\u0E44\u0E1F\u0E1A\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E41\u0E25\u0E30\u0E2B\u0E34\u0E19\u0E16\u0E25\u0E48\u0E21 \u2014 \u0E04\u0E27\u0E31\u0E19\u0E01\u0E31\u0E1A\u0E40\u0E07\u0E32\u0E1A\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E04\u0E37\u0E2D\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E13\u0E40\u0E15\u0E37\u0E2D\u0E19 \u0E1E\u0E38\u0E48\u0E07\u0E2B\u0E25\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E1B\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E40\u0E08\u0E47\u0E1A" }
    ]
  },
  mem_ward: {
    title: "\u0E44\u0E2D\u0E2D\u0E38\u0E48\u0E19\u0E02\u0E2D\u0E07\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D",
    sets: { mem_ward: true },
    lines: [
      { s: "narr", t: "\u0E01\u0E23\u0E30\u0E14\u0E32\u0E29\u0E43\u0E19\u0E21\u0E37\u0E2D\u0E22\u0E31\u0E07\u0E2D\u0E38\u0E48\u0E19 \u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D\u0E2A\u0E35\u0E41\u0E14\u0E07\u0E17\u0E35\u0E48\u0E04\u0E2D\u0E01\u0E47\u0E2D\u0E38\u0E48\u0E19\u0E02\u0E36\u0E49\u0E19\u0E15\u0E32\u0E21" },
      { s: "hero", t: "\u0E1E\u0E35\u0E48\u0E16\u0E31\u0E01\u0E21\u0E31\u0E19\u0E43\u0E2B\u0E49\u0E02\u0E49\u0E32... \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E01\u0E31\u0E19\u0E2B\u0E19\u0E32\u0E27 \u0E41\u0E15\u0E48\u0E01\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E44\u0E1F\u0E43\u0E19\u0E15\u0E31\u0E27\u0E02\u0E49\u0E32\u0E40\u0E2D\u0E07" },
      { s: "sys", t: "\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E2D\u0E35\u0E01\u0E2A\u0E48\u0E27\u0E19 \u2014 \u0E1B\u0E25\u0E14\u0E25\u0E47\u0E2D\u0E01\u0E2A\u0E01\u0E34\u0E25 \xAB\u0E42\u0E25\u0E48\u0E16\u0E48\u0E32\u0E19\u0E2D\u0E38\u0E48\u0E19\xBB" }
    ]
  },
  s2_boss_pre: {
    title: "\u0E40\u0E15\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E14\u0E31\u0E1A",
    lines: [
      { s: "narr", t: "\u0E01\u0E25\u0E32\u0E07\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21 \u0E23\u0E48\u0E32\u0E07\u0E2B\u0E34\u0E19\u0E02\u0E19\u0E32\u0E14\u0E21\u0E2B\u0E36\u0E21\u0E32\u0E19\u0E31\u0E48\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E15\u0E32\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E25\u0E38\u0E01\u0E42\u0E0A\u0E19 \u0E43\u0E19\u0E2D\u0E01\u0E02\u0E2D\u0E07\u0E21\u0E31\u0E19\u0E21\u0E35\u0E16\u0E48\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07" },
      { s: "golem", t: "\u0E16\u0E49\u0E32\u0E21\u0E35\u0E43\u0E04\u0E23\u0E21\u0E32\u0E16\u0E36\u0E07\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48 \u0E44\u0E14\u0E49\u0E42\u0E1B\u0E23\u0E14\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E40\u0E16\u0E2D\u0E30 \u0E02\u0E49\u0E32\u0E44\u0E21\u0E48\u0E2D\u0E22\u0E32\u0E01\u0E43\u0E2B\u0E49\u0E43\u0E04\u0E23\u0E40\u0E08\u0E47\u0E1A\u0E2D\u0E35\u0E01\u0E41\u0E25\u0E49\u0E27" },
      { s: "hero", t: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27... \u0E21\u0E31\u0E19\u0E1E\u0E39\u0E14\u0E14\u0E49\u0E27\u0E22\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48" },
      { s: "golem", t: "\u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A\u0E44\u0E1F\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07 \u0E44\u0E1F\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E15\u0E32" }
    ]
  },
  s2_boss_post: {
    title: "\u0E04\u0E27\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07\u0E02\u0E2D\u0E07\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21",
    sets: { mem_night: true },
    lines: [
      { s: "narr", t: "\u0E42\u0E01\u0E40\u0E25\u0E21\u0E1E\u0E31\u0E07\u0E17\u0E25\u0E32\u0E22 \u0E16\u0E48\u0E32\u0E19\u0E43\u0E19\u0E2D\u0E01\u0E21\u0E31\u0E19\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E40\u0E25\u0E47\u0E01\u0E46 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E16\u0E48\u0E32\u0E19\u0E15\u0E49\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07" },
      { s: "narr", t: "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E44\u0E1F\u0E25\u0E2D\u0E22\u0E21\u0E32\u0E41\u0E15\u0E30\u0E41\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E41\u0E02\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E01\u0E47\u0E1E\u0E31\u0E07\u0E17\u0E25\u0E32\u0E22\u0E25\u0E07\u0E21\u0E32" },
      { s: "dao", memory: true, t: "{name}! \u0E2D\u0E22\u0E48\u0E32\u0E40\u0E02\u0E49\u0E32\u0E21\u0E32 \u0E16\u0E48\u0E32\u0E19\u0E21\u0E31\u0E19\u0E04\u0E25\u0E31\u0E48\u0E07 \u0E21\u0E31\u0E19\u0E01\u0E33\u0E25\u0E31\u0E07\u0E01\u0E34\u0E19\u0E1E\u0E35\u0E48" },
      { s: "narr", t: "\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E16\u0E48\u0E32\u0E19\u0E15\u0E49\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E25\u0E38\u0E01\u0E40\u0E01\u0E34\u0E19\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21 \u0E14\u0E32\u0E27\u0E01\u0E2D\u0E14\u0E21\u0E31\u0E19\u0E44\u0E27\u0E49\u0E14\u0E49\u0E27\u0E22\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E43\u0E2B\u0E49\u0E44\u0E1F\u0E25\u0E32\u0E21\u0E44\u0E1B\u0E16\u0E36\u0E07\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19" },
      { s: "narr", t: "\u0E40\u0E14\u0E47\u0E01\u0E2D\u0E32\u0E22\u0E38\u0E2A\u0E34\u0E1A\u0E2A\u0E2D\u0E07\u0E27\u0E34\u0E48\u0E07\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1B\u0E04\u0E27\u0E49\u0E32\u0E21\u0E37\u0E2D\u0E1E\u0E35\u0E48\u0E2A\u0E32\u0E27 \u0E16\u0E48\u0E32\u0E19\u0E41\u0E15\u0E01\u0E2D\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E2D\u0E07\u0E0B\u0E35\u0E01 \u0E41\u0E25\u0E30\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E1D\u0E31\u0E07\u0E25\u0E07\u0E43\u0E19\u0E41\u0E02\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E14\u0E47\u0E01\u0E04\u0E19\u0E19\u0E31\u0E49\u0E19" },
      { s: "dao", memory: true, t: "\u0E1F\u0E31\u0E07\u0E1E\u0E35\u0E48\u0E19\u0E30 \u0E16\u0E49\u0E32\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E44\u0E1F\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E15\u0E31\u0E27\u0E40\u0E08\u0E49\u0E32 \u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32\u0E08\u0E30\u0E01\u0E25\u0E31\u0E27\u0E40\u0E08\u0E49\u0E32 \u0E1E\u0E35\u0E48\u0E08\u0E30\u0E1E\u0E32\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E44\u0E1B\u0E44\u0E27\u0E49\u0E17\u0E35\u0E48\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1B\u0E48\u0E32 \u0E41\u0E25\u0E49\u0E27\u0E08\u0E30\u0E25\u0E1A\u0E04\u0E37\u0E19\u0E19\u0E35\u0E49\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E40\u0E08\u0E49\u0E32" },
      { s: "dao", memory: true, t: "\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E40\u0E08\u0E49\u0E32\u0E17\u0E33\u0E1C\u0E34\u0E14 \u0E41\u0E15\u0E48\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E1E\u0E35\u0E48\u0E2D\u0E22\u0E32\u0E01\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E44\u0E14\u0E49\u0E42\u0E15\u0E02\u0E36\u0E49\u0E19\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E1A\u0E01\u0E21\u0E31\u0E19" },
      { s: "hero", t: "\u0E02\u0E49\u0E32\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E32\u0E21\u0E25\u0E48\u0E32\u0E42\u0E08\u0E23\u0E17\u0E35\u0E48\u0E02\u0E42\u0E21\u0E22\u0E16\u0E48\u0E32\u0E19... \u0E02\u0E49\u0E32\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07" },
      { s: "hero", t: "\u0E1B\u0E48\u0E32\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E32\u0E21\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E16\u0E48\u0E32\u0E19\u0E2A\u0E2D\u0E07\u0E0B\u0E35\u0E01\u0E2D\u0E22\u0E39\u0E48\u0E2B\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19 \u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E17\u0E38\u0E01\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E25\u0E48\u0E32\u0E21\u0E32 \u0E16\u0E39\u0E01\u0E44\u0E1F\u0E04\u0E23\u0E36\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E02\u0E49\u0E32\u0E40\u0E1C\u0E32\u0E08\u0E19\u0E1A\u0E34\u0E14\u0E40\u0E1A\u0E35\u0E49\u0E22\u0E27" },
      { s: "sys", t: "\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27 \u2014 \u0E01\u0E25\u0E31\u0E1A\u0E04\u0E48\u0E32\u0E22\u0E44\u0E1B\u0E40\u0E1C\u0E0A\u0E34\u0E0D\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E31\u0E1A\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01" }
    ]
  },
  camp_after_s2: {
    title: "\u0E04\u0E33\u0E2A\u0E32\u0E23\u0E20\u0E32\u0E1E\u0E02\u0E2D\u0E07\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01",
    lines: [
      { s: "lek", t: "\u0E40\u0E08\u0E49\u0E32\u0E23\u0E39\u0E49\u0E41\u0E25\u0E49\u0E27\u0E2A\u0E34\u0E19\u0E30 \u0E14\u0E39\u0E08\u0E32\u0E01\u0E2A\u0E32\u0E22\u0E15\u0E32\u0E01\u0E47\u0E23\u0E39\u0E49" },
      { s: "hero", t: "\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E43\u0E19\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E01\u0E1E\u0E35\u0E48\u0E27\u0E48\u0E32\u0E42\u0E08\u0E23\u0E21\u0E32\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35" },
      { s: "lek", t: "\u0E14\u0E32\u0E27\u0E02\u0E2D\u0E02\u0E49\u0E32\u0E40\u0E2D\u0E07 \u0E16\u0E49\u0E32\u0E02\u0E49\u0E32\u0E1E\u0E39\u0E14\u0E04\u0E27\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07 \u0E2A\u0E20\u0E32\u0E08\u0E30\u0E15\u0E32\u0E21\u0E25\u0E48\u0E32\u0E40\u0E14\u0E47\u0E01\u0E17\u0E35\u0E48\u0E21\u0E35\u0E44\u0E1F\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E41\u0E02\u0E19 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E14\u0E32\u0E27 \u0E02\u0E49\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E01\u0E25\u0E35\u0E22\u0E14\u0E04\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E43\u0E2B\u0E49\u0E43\u0E04\u0E23\u0E01\u0E25\u0E31\u0E27\u0E2D\u0E35\u0E01\u0E04\u0E19" },
      { s: "lek", t: "\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E40\u0E08\u0E49\u0E32\u0E40\u0E2D\u0E32\u0E14\u0E32\u0E1A\u0E21\u0E32\u0E15\u0E35\u0E1A\u0E27\u0E01 \u0E02\u0E49\u0E32\u0E1C\u0E2A\u0E21\u0E40\u0E16\u0E49\u0E32\u0E08\u0E32\u0E01\u0E40\u0E15\u0E32\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27\u0E25\u0E07\u0E44\u0E1B\u0E14\u0E49\u0E27\u0E22 \u0E21\u0E31\u0E19\u0E0A\u0E48\u0E27\u0E22\u0E43\u0E2B\u0E49\u0E44\u0E1F\u0E43\u0E19\u0E15\u0E31\u0E27\u0E40\u0E08\u0E49\u0E32\u0E2A\u0E07\u0E1A" },
      { s: "hero", t: "\u0E16\u0E49\u0E32\u0E02\u0E49\u0E32\u0E23\u0E27\u0E21\u0E16\u0E48\u0E32\u0E19\u0E04\u0E37\u0E19 \u0E1B\u0E48\u0E32\u0E08\u0E30\u0E01\u0E25\u0E31\u0E1A\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19 \u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E08\u0E30\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07 \u0E41\u0E15\u0E48\u0E1E\u0E35\u0E48\u0E17\u0E35\u0E48\u0E41\u0E1A\u0E01\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E21\u0E32\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35..." },
      { s: "lek", t: "\u0E2D\u0E32\u0E08\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32 \u0E02\u0E49\u0E32\u0E23\u0E39\u0E49 \u0E44\u0E21\u0E48\u0E27\u0E48\u0E32\u0E40\u0E08\u0E49\u0E32\u0E08\u0E30\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E32\u0E07\u0E44\u0E2B\u0E19 \u0E02\u0E49\u0E32\u0E08\u0E30\u0E15\u0E35\u0E14\u0E32\u0E1A\u0E43\u0E2B\u0E49\u0E40\u0E08\u0E49\u0E32\u0E08\u0E19\u0E01\u0E27\u0E48\u0E32\u0E21\u0E37\u0E2D\u0E08\u0E30\u0E22\u0E01\u0E04\u0E49\u0E2D\u0E19\u0E44\u0E21\u0E48\u0E02\u0E36\u0E49\u0E19" },
      { s: "narr", t: "\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1B\u0E48\u0E32\u0E22\u0E31\u0E07\u0E23\u0E2D\u0E2D\u0E22\u0E39\u0E48 \u2014 \u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E32\u0E27\u0E1A\u0E17\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E08\u0E30\u0E21\u0E32\u0E43\u0E19\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E2B\u0E19\u0E49\u0E32" }
    ]
  }
});
var LORE = Object.freeze({
  l_notice: {
    stage: "s1",
    title: "\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E02\u0E2D\u0E07\u0E2A\u0E20\u0E32\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19",
    text: ["\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E08\u0E31\u0E1A: \u0E14\u0E32\u0E27 \u0E0A\u0E48\u0E32\u0E07\u0E15\u0E35\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E41\u0E2B\u0E48\u0E07\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E2D\u0E31\u0E04\u0E04\u0E35", "\u0E02\u0E49\u0E2D\u0E2B\u0E32\u0E02\u0E42\u0E21\u0E22\u0E16\u0E48\u0E32\u0E19\u0E15\u0E49\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E43\u0E19\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21 \u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2B\u0E15\u0E38\u0E43\u0E2B\u0E49\u0E44\u0E1F\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E14\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21 \u0E1C\u0E39\u0E49\u0E43\u0E14\u0E1E\u0E1A\u0E40\u0E2B\u0E47\u0E19\u0E43\u0E2B\u0E49\u0E41\u0E08\u0E49\u0E07\u0E2A\u0E20\u0E32\u0E42\u0E14\u0E22\u0E14\u0E48\u0E27\u0E19", "\u0E25\u0E07\u0E19\u0E32\u0E21 \u0E1C\u0E39\u0E49\u0E43\u0E2B\u0E0D\u0E48\u0E1A\u0E49\u0E32\u0E19 \u0E41\u0E25\u0E30\u0E1E\u0E22\u0E32\u0E19: \u0E0A\u0E48\u0E32\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E2D\u0E32\u0E27\u0E38\u0E42\u0E2A"],
    thought: "\u0E0A\u0E48\u0E32\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E2D\u0E32\u0E27\u0E38\u0E42\u0E2A... \u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E1E\u0E22\u0E32\u0E19\u0E01\u0E25\u0E48\u0E32\u0E27\u0E2B\u0E32\u0E1E\u0E35\u0E48?"
  },
  l_warden: {
    stage: "s1",
    title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1C\u0E39\u0E49\u0E1E\u0E34\u0E17\u0E31\u0E01\u0E29\u0E4C\u0E1B\u0E48\u0E32",
    text: ["\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E19\u0E31\u0E01\u0E2D\u0E31\u0E04\u0E04\u0E35\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07\u0E44\u0E27\u0E49\u0E40\u0E1D\u0E49\u0E32\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E17\u0E33\u0E23\u0E49\u0E32\u0E22\u0E43\u0E04\u0E23 \u0E08\u0E19\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19\u0E02\u0E49\u0E32\u0E40\u0E2B\u0E47\u0E19\u0E21\u0E31\u0E19\u0E27\u0E34\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E08\u0E32\u0E01\u0E25\u0E32\u0E19 \u0E02\u0E19\u0E1A\u0E19\u0E2B\u0E25\u0E31\u0E07\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E32\u0E21 \u0E15\u0E32\u0E41\u0E14\u0E07\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E16\u0E48\u0E32\u0E19", "\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E19\u0E32\u0E21\u0E07\u0E2D\u0E01\u0E40\u0E23\u0E47\u0E27\u0E02\u0E36\u0E49\u0E19\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E1D\u0E19\u0E15\u0E01 \u0E23\u0E32\u0E27\u0E01\u0E31\u0E1A\u0E1B\u0E48\u0E32\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E2D\u0E30\u0E44\u0E23\u0E1A\u0E32\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07 \u0E41\u0E25\u0E30\u0E21\u0E31\u0E19\u0E25\u0E32\u0E21\u0E44\u0E1B\u0E17\u0E32\u0E07\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19\u0E40\u0E2A\u0E21\u0E2D \u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E25\u0E32\u0E21\u0E44\u0E1B\u0E17\u0E32\u0E07\u0E2D\u0E37\u0E48\u0E19"],
    thought: "\u0E1B\u0E48\u0E32\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E2D\u0E30\u0E44\u0E23... \u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E43\u0E04\u0E23?"
  },
  l_altar: {
    stage: "s1",
    title: "\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E1A\u0E19\u0E41\u0E17\u0E48\u0E19\u0E1A\u0E39\u0E0A\u0E32",
    text: ["\u0E1A\u0E19\u0E41\u0E17\u0E48\u0E19\u0E2B\u0E34\u0E19\u0E21\u0E35\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E2A\u0E2D\u0E07\u0E23\u0E2D\u0E22 \u0E23\u0E2D\u0E22\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E1D\u0E48\u0E32\u0E21\u0E37\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E2B\u0E0D\u0E48 \u0E2D\u0E35\u0E01\u0E23\u0E2D\u0E22\u0E40\u0E25\u0E47\u0E01\u0E40\u0E17\u0E48\u0E32\u0E21\u0E37\u0E2D\u0E40\u0E14\u0E47\u0E01", "\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E40\u0E04\u0E22\u0E27\u0E32\u0E07\u0E16\u0E48\u0E32\u0E19\u0E15\u0E49\u0E19\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E41\u0E15\u0E01\u0E2D\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E2D\u0E07\u0E0B\u0E35\u0E01\u0E08\u0E32\u0E01\u0E14\u0E49\u0E32\u0E19\u0E43\u0E19 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2D\u0E22\u0E07\u0E31\u0E14\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2D\u0E22\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E40\u0E25\u0E22\u0E41\u0E21\u0E49\u0E41\u0E15\u0E48\u0E19\u0E49\u0E2D\u0E22"],
    thought: "\u0E16\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E16\u0E39\u0E01\u0E02\u0E42\u0E21\u0E22 \u0E21\u0E31\u0E19\u0E41\u0E15\u0E01"
  },
  l_worklog: {
    stage: "s2",
    title: "\u0E2A\u0E21\u0E38\u0E14\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27",
    text: ["\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21: \u0E04\u0E23\u0E36\u0E48\u0E07\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E16\u0E37\u0E2D\u0E2D\u0E22\u0E39\u0E48\u0E23\u0E49\u0E2D\u0E19\u0E02\u0E36\u0E49\u0E19\u0E17\u0E38\u0E01\u0E04\u0E37\u0E19 \u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E21\u0E35\u0E20\u0E32\u0E0A\u0E19\u0E30 \u0E21\u0E31\u0E19\u0E08\u0E30\u0E40\u0E1C\u0E32\u0E02\u0E49\u0E32\u0E08\u0E32\u0E01\u0E02\u0E49\u0E32\u0E07\u0E43\u0E19", "\u0E02\u0E49\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2B\u0E25\u0E48\u0E2D\u0E23\u0E48\u0E32\u0E07\u0E2B\u0E34\u0E19\u0E43\u0E2B\u0E49\u0E44\u0E1F\u0E21\u0E35\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 \u0E16\u0E49\u0E32\u0E21\u0E31\u0E19\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E40\u0E1C\u0E32 \u0E21\u0E31\u0E19\u0E08\u0E30\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1C\u0E32\u0E02\u0E49\u0E32", "\u0E02\u0E49\u0E32\u0E2B\u0E48\u0E27\u0E07\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32 \u0E40\u0E14\u0E47\u0E01\u0E04\u0E19\u0E19\u0E31\u0E49\u0E19\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E15\u0E31\u0E27\u0E14\u0E49\u0E27\u0E22\u0E0B\u0E49\u0E33\u0E27\u0E48\u0E32\u0E41\u0E1A\u0E01\u0E2D\u0E30\u0E44\u0E23\u0E44\u0E27\u0E49"],
    thought: "\u0E40\u0E14\u0E47\u0E01\u0E04\u0E19\u0E19\u0E31\u0E49\u0E19... \u0E1E\u0E35\u0E48\u0E2B\u0E21\u0E32\u0E22\u0E16\u0E36\u0E07\u0E43\u0E04\u0E23"
  },
  l_ledger: {
    stage: "s2",
    title: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E16\u0E48\u0E32\u0E19\u0E1B\u0E49\u0E2D\u0E19\u0E40\u0E15\u0E32",
    text: ["\u0E1B\u0E49\u0E2D\u0E19\u0E16\u0E48\u0E32\u0E19\u0E40\u0E02\u0E49\u0E32\u0E2D\u0E01\u0E23\u0E48\u0E32\u0E07\u0E2B\u0E34\u0E19\u0E27\u0E31\u0E19\u0E25\u0E30\u0E2A\u0E32\u0E21\u0E40\u0E01\u0E27\u0E35\u0E22\u0E19\u0E15\u0E32\u0E21\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E0A\u0E48\u0E32\u0E07\u0E14\u0E32\u0E27 \u0E2B\u0E49\u0E32\u0E21\u0E02\u0E32\u0E14\u0E41\u0E21\u0E49\u0E41\u0E15\u0E48\u0E27\u0E31\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27", "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38: \u0E1B\u0E35\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21\u0E16\u0E48\u0E32\u0E19\u0E02\u0E32\u0E14\u0E2A\u0E2D\u0E07\u0E27\u0E31\u0E19 \u0E44\u0E1F\u0E43\u0E19\u0E2D\u0E01\u0E23\u0E48\u0E32\u0E07\u0E2B\u0E34\u0E19\u0E2B\u0E23\u0E35\u0E48\u0E25\u0E07 \u0E1B\u0E35\u0E19\u0E31\u0E49\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21\u0E25\u0E32\u0E21\u0E21\u0E32\u0E16\u0E36\u0E07\u0E23\u0E31\u0E49\u0E27\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19", "\u0E1C\u0E39\u0E49\u0E2A\u0E48\u0E07\u0E16\u0E48\u0E32\u0E19: \u0E25.\u0E2B."],
    thought: "\u0E25.\u0E2B. ...\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01 \u0E25\u0E38\u0E07\u0E02\u0E19\u0E16\u0E48\u0E32\u0E19\u0E21\u0E32\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48\u0E21\u0E32\u0E15\u0E25\u0E2D\u0E14\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35"
  },
  l_lek: {
    stage: "s2",
    title: "\u0E08\u0E14\u0E2B\u0E21\u0E32\u0E22\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2A\u0E48\u0E07",
    text: ["\u0E16\u0E36\u0E07\u0E2A\u0E20\u0E32\u0E2B\u0E21\u0E39\u0E48\u0E1A\u0E49\u0E32\u0E19 \u0E02\u0E49\u0E32\u0E40\u0E2B\u0E47\u0E19\u0E01\u0E31\u0E1A\u0E15\u0E32\u0E27\u0E48\u0E32\u0E14\u0E32\u0E27\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E02\u0E42\u0E21\u0E22\u0E16\u0E48\u0E32\u0E19", "\u0E41\u0E15\u0E48\u0E16\u0E49\u0E32\u0E02\u0E49\u0E32\u0E1E\u0E39\u0E14\u0E04\u0E27\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07 \u0E1E\u0E27\u0E01\u0E17\u0E48\u0E32\u0E19\u0E08\u0E30\u0E15\u0E32\u0E21\u0E25\u0E48\u0E32\u0E40\u0E14\u0E47\u0E01\u0E17\u0E35\u0E48\u0E21\u0E35\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E1A\u0E19\u0E41\u0E02\u0E19 \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E14\u0E32\u0E27 \u0E02\u0E49\u0E32\u0E08\u0E36\u0E07\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E48\u0E08\u0E30\u0E40\u0E07\u0E35\u0E22\u0E1A", "\u0E02\u0E2D\u0E43\u0E2B\u0E49\u0E1F\u0E49\u0E32\u0E25\u0E07\u0E42\u0E17\u0E29\u0E02\u0E49\u0E32\u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27"],
    thought: "\u0E23\u0E2D\u0E22\u0E44\u0E2B\u0E21\u0E49\u0E1A\u0E19\u0E41\u0E02\u0E19"
  },
  l_daoletter: {
    stage: "s2",
    title: "\u0E08\u0E14\u0E2B\u0E21\u0E32\u0E22\u0E16\u0E36\u0E07\u0E19\u0E49\u0E2D\u0E07",
    scene: "mem_ward",
    text: ["\u0E16\u0E36\u0E07 {name}", "\u0E16\u0E49\u0E32\u0E40\u0E08\u0E49\u0E32\u0E2D\u0E48\u0E32\u0E19\u0E08\u0E14\u0E2B\u0E21\u0E32\u0E22\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49 \u0E41\u0E1B\u0E25\u0E27\u0E48\u0E32\u0E1C\u0E19\u0E36\u0E01\u0E17\u0E35\u0E48\u0E1E\u0E35\u0E48\u0E43\u0E2A\u0E48\u0E44\u0E27\u0E49\u0E43\u0E19\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E02\u0E2D\u0E07\u0E40\u0E08\u0E49\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E04\u0E25\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27", "\u0E2D\u0E22\u0E48\u0E32\u0E42\u0E17\u0E29\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E19\u0E30 \u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19\u0E40\u0E08\u0E49\u0E32\u0E41\u0E04\u0E48\u0E08\u0E30\u0E0A\u0E48\u0E27\u0E22\u0E1E\u0E35\u0E48 \u0E21\u0E37\u0E2D\u0E40\u0E25\u0E47\u0E01\u0E46 \u0E19\u0E31\u0E48\u0E19\u0E04\u0E27\u0E49\u0E32\u0E44\u0E27\u0E49\u0E17\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E44\u0E1F\u0E01\u0E33\u0E25\u0E31\u0E07\u0E01\u0E34\u0E19\u0E1E\u0E35\u0E48\u0E17\u0E31\u0E49\u0E07\u0E40\u0E1B\u0E47\u0E19", "\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D\u0E2A\u0E35\u0E41\u0E14\u0E07\u0E1C\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19 \u0E1E\u0E35\u0E48\u0E16\u0E31\u0E01\u0E44\u0E27\u0E49\u0E43\u0E2B\u0E49 \u0E43\u0E2A\u0E48\u0E44\u0E27\u0E49\u0E15\u0E25\u0E2D\u0E14\u0E19\u0E30 \u2014 \u0E14\u0E32\u0E27"],
    thought: "\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E43\u0E2A\u0E48\u0E21\u0E32\u0E40\u0E08\u0E47\u0E14\u0E1B\u0E35..."
  }
});
var GOALS = Object.freeze([
  { id: "g4", when: (st) => st.story.seen.camp_after_s2, text: "\u0E16\u0E48\u0E32\u0E19\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E15\u0E31\u0E27\u0E02\u0E49\u0E32 \u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E01\u0E31\u0E1A\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27\u0E17\u0E35\u0E48\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1B\u0E48\u0E32 \u0E08\u0E30\u0E23\u0E27\u0E21\u0E21\u0E31\u0E19\u0E04\u0E37\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E2B\u0E32\u0E17\u0E32\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E32\u0E21 (\u0E1A\u0E17\u0E15\u0E48\u0E2D\u0E44\u0E1B\u0E40\u0E23\u0E47\u0E27\u0E46 \u0E19\u0E35\u0E49)" },
  { id: "g3b", when: (st) => st.story.seen.s2_boss_post, text: "\u0E01\u0E25\u0E31\u0E1A\u0E04\u0E48\u0E32\u0E22 \u0E44\u0E1B\u0E40\u0E1C\u0E0A\u0E34\u0E0D\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E31\u0E1A\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01" },
  { id: "g3", when: (st) => st.story.seen.camp_after_s1, text: "\u0E2B\u0E32\u0E42\u0E23\u0E07\u0E2B\u0E25\u0E2D\u0E21\u0E25\u0E31\u0E1A\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27\u0E43\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E16\u0E48\u0E32\u0E19\u0E23\u0E49\u0E32\u0E07" },
  { id: "g2", when: (st) => st.story.seen.s1_boss_post, text: "\u0E01\u0E25\u0E31\u0E1A\u0E04\u0E48\u0E32\u0E22 \u0E16\u0E32\u0E21\u0E25\u0E38\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E23\u0E32\u0E02\u0E2D\u0E07\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27\u0E1A\u0E19\u0E40\u0E02\u0E35\u0E49\u0E22\u0E27\u0E2B\u0E21\u0E39\u0E1B\u0E48\u0E32" },
  { id: "g1", when: () => true, text: "\u0E25\u0E49\u0E32\u0E07\u0E21\u0E25\u0E17\u0E34\u0E19\u0E43\u0E2B\u0E49\u0E1E\u0E35\u0E48\u0E14\u0E32\u0E27: \u0E15\u0E32\u0E21\u0E2B\u0E32\u0E23\u0E48\u0E2D\u0E07\u0E23\u0E2D\u0E22\u0E02\u0E2D\u0E07\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21\u0E17\u0E35\u0E48\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E43\u0E19\u0E1B\u0E48\u0E32\u0E2B\u0E19\u0E32\u0E21" }
]);
var MEMORIES = Object.freeze([
  { flag: "mem_thorns", title: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E43\u0E19\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32", text: "\u0E04\u0E37\u0E19\u0E19\u0E31\u0E49\u0E19\u0E02\u0E49\u0E32\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32 \u0E1E\u0E35\u0E48\u0E1A\u0E2D\u0E01\u0E43\u0E2B\u0E49\u0E2B\u0E25\u0E31\u0E1A\u0E15\u0E32\u0E41\u0E25\u0E30\u0E2D\u0E22\u0E48\u0E32\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E21\u0E37\u0E2D \u0E2B\u0E19\u0E32\u0E21\u0E43\u0E19\u0E1B\u0E48\u0E32\u0E01\u0E49\u0E21\u0E2B\u0E31\u0E27\u0E43\u0E2B\u0E49\u0E02\u0E49\u0E32" },
  { flag: "mem_ward", title: "\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D\u0E2A\u0E35\u0E41\u0E14\u0E07", text: "\u0E1E\u0E35\u0E48\u0E16\u0E31\u0E01\u0E1C\u0E49\u0E32\u0E1E\u0E31\u0E19\u0E04\u0E2D\u0E43\u0E2B\u0E49\u0E02\u0E49\u0E32 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E01\u0E31\u0E19\u0E04\u0E27\u0E32\u0E21\u0E23\u0E49\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E44\u0E1F\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E15\u0E31\u0E27\u0E02\u0E49\u0E32\u0E40\u0E2D\u0E07" },
  { flag: "mem_night", title: "\u0E04\u0E37\u0E19\u0E40\u0E16\u0E49\u0E32\u0E16\u0E25\u0E48\u0E21", text: "\u0E16\u0E48\u0E32\u0E19\u0E41\u0E15\u0E01\u0E40\u0E1E\u0E23\u0E32\u0E30\u0E02\u0E49\u0E32\u0E04\u0E27\u0E49\u0E32\u0E21\u0E37\u0E2D\u0E1E\u0E35\u0E48 \u0E04\u0E23\u0E36\u0E48\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E41\u0E02\u0E19\u0E02\u0E49\u0E32 \u0E1E\u0E35\u0E48\u0E1E\u0E32\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E36\u0E48\u0E07\u0E44\u0E1B\u0E2B\u0E31\u0E27\u0E43\u0E08\u0E1B\u0E48\u0E32\u0E41\u0E25\u0E30\u0E25\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E19\u0E35\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E01\u0E1B\u0E49\u0E2D\u0E07\u0E02\u0E49\u0E32" }
]);
var LEK_TALK = Object.freeze({
  g1: "\u0E25\u0E32\u0E19\u0E1A\u0E39\u0E0A\u0E32\u0E2D\u0E22\u0E39\u0E48\u0E25\u0E36\u0E01\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E1B\u0E48\u0E32 \u0E1B\u0E23\u0E30\u0E15\u0E39\u0E1C\u0E19\u0E36\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E01\u0E38\u0E0D\u0E41\u0E08 \u0E2B\u0E32\u0E14\u0E39\u0E15\u0E32\u0E21\u0E2B\u0E49\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E21\u0E35\u0E1E\u0E27\u0E01\u0E20\u0E39\u0E15\u0E2B\u0E19\u0E32\u0E21\u0E40\u0E1D\u0E49\u0E32\u0E2D\u0E22\u0E39\u0E48",
  g2: "\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E08\u0E30\u0E16\u0E32\u0E21\u0E01\u0E47\u0E16\u0E32\u0E21\u0E21\u0E32 ...\u0E02\u0E49\u0E32\u0E44\u0E21\u0E48\u0E2B\u0E19\u0E35\u0E44\u0E1B\u0E44\u0E2B\u0E19\u0E2B\u0E23\u0E2D\u0E01",
  g3: "\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E23\u0E49\u0E2D\u0E19\u0E01\u0E27\u0E48\u0E32\u0E17\u0E35\u0E48\u0E40\u0E08\u0E49\u0E32\u0E04\u0E34\u0E14 \u0E23\u0E30\u0E27\u0E31\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E04\u0E27\u0E31\u0E19\u0E25\u0E2D\u0E22\u0E02\u0E36\u0E49\u0E19 \u0E01\u0E31\u0E1A\u0E40\u0E07\u0E32\u0E1A\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E34\u0E19\u0E08\u0E30\u0E2B\u0E25\u0E48\u0E19",
  g3b: "\u0E02\u0E49\u0E32\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E40\u0E08\u0E49\u0E32\u0E08\u0E30\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E33\u0E16\u0E32\u0E21 \u0E19\u0E31\u0E48\u0E07\u0E25\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E16\u0E2D\u0E30",
  g4: "\u0E14\u0E32\u0E1A\u0E40\u0E08\u0E49\u0E32\u0E22\u0E31\u0E07\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E15\u0E35\u0E1A\u0E27\u0E01\u0E44\u0E14\u0E49\u0E2D\u0E35\u0E01 \u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E47\u0E43\u0E2B\u0E49\u0E02\u0E49\u0E32\u0E17\u0E33\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E17\u0E33\u0E44\u0E14\u0E49"
});
var LEK_BLOODLINE = Object.freeze({
  hunter: "\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E1E\u0E23\u0E32\u0E19\u0E18\u0E23\u0E23\u0E21\u0E14\u0E32\u0E46 ...\u0E41\u0E15\u0E48\u0E14\u0E32\u0E27\u0E40\u0E04\u0E22\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E16\u0E48\u0E32\u0E19\u0E08\u0E30\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E19\u0E17\u0E35\u0E48\u0E43\u0E08\u0E44\u0E21\u0E48\u0E22\u0E2D\u0E21\u0E41\u0E1E\u0E49\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E2A\u0E21\u0E2D",
  moon: '\u0E2B\u0E39\u0E41\u0E1A\u0E1A\u0E19\u0E31\u0E49\u0E19 \u0E02\u0E49\u0E32\u0E40\u0E04\u0E22\u0E40\u0E2B\u0E47\u0E19\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E43\u0E19\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E2D\u0E07\u0E14\u0E32\u0E27 \u0E40\u0E18\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E19\u0E27\u0E48\u0E32 "\u0E04\u0E19\u0E40\u0E07\u0E32\u0E08\u0E31\u0E19\u0E17\u0E23\u0E4C\u0E44\u0E14\u0E49\u0E22\u0E34\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E16\u0E48\u0E32\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E21\u0E31\u0E19\u0E08\u0E30\u0E14\u0E31\u0E1A"',
  stone: "\u0E40\u0E02\u0E32\u0E2B\u0E34\u0E19\u0E07\u0E2D\u0E01\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E08\u0E23\u0E34\u0E07\u0E46 \u0E14\u0E49\u0E27\u0E22 ...\u0E1E\u0E27\u0E01\u0E04\u0E19\u0E07\u0E32\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E07\u0E23\u0E38\u0E48\u0E19\u0E41\u0E23\u0E01\u0E01\u0E47\u0E21\u0E35\u0E40\u0E02\u0E32\u0E41\u0E1A\u0E1A\u0E19\u0E35\u0E49 \u0E01\u0E48\u0E2D\u0E19\u0E40\u0E15\u0E32\u0E2B\u0E25\u0E2D\u0E21\u0E08\u0E30\u0E01\u0E25\u0E37\u0E19\u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32\u0E44\u0E1B",
  sylvan: "\u0E43\u0E1A\u0E44\u0E21\u0E49\u0E1A\u0E19\u0E2B\u0E31\u0E27\u0E40\u0E08\u0E49\u0E32\u0E22\u0E31\u0E07\u0E40\u0E02\u0E35\u0E22\u0E27\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E21\u0E49\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E19\u0E32\u0E27 \u0E1B\u0E48\u0E32\u0E2D\u0E33\u0E1E\u0E31\u0E19\u0E04\u0E07\u0E22\u0E31\u0E07\u0E08\u0E33\u0E40\u0E08\u0E49\u0E32\u0E44\u0E14\u0E49",
  scale: "\u0E40\u0E01\u0E25\u0E47\u0E14\u0E19\u0E31\u0E48\u0E19\u0E23\u0E49\u0E2D\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E17\u0E35\u0E48\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E40\u0E15\u0E32 \u0E23\u0E30\u0E27\u0E31\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E43\u0E2B\u0E49\u0E43\u0E04\u0E23\u0E40\u0E2B\u0E47\u0E19\u0E15\u0E2D\u0E19\u0E40\u0E08\u0E49\u0E32\u0E42\u0E01\u0E23\u0E18",
  ash: '\u0E25\u0E32\u0E22\u0E40\u0E16\u0E49\u0E32\u0E19\u0E31\u0E48\u0E19... \u0E14\u0E32\u0E27\u0E02\u0E35\u0E14\u0E06\u0E48\u0E32\u0E04\u0E33\u0E27\u0E48\u0E32 "\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E21\u0E2D\u0E14" \u0E0B\u0E49\u0E33\u0E41\u0E25\u0E49\u0E27\u0E0B\u0E49\u0E33\u0E2D\u0E35\u0E01 \u0E02\u0E49\u0E32\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E40\u0E02\u0E49\u0E32\u0E43\u0E08\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E40\u0E2D\u0E07\u0E27\u0E48\u0E32\u0E40\u0E18\u0E2D\u0E01\u0E25\u0E31\u0E27\u0E2D\u0E30\u0E44\u0E23'
});

// src/online/match.js
var MODES = Object.freeze({
  "1v1": { id: "1v1", size: 1, name: "\u0E14\u0E27\u0E25 1v1" },
  "2v2": { id: "2v2", size: 2, name: "\u0E17\u0E35\u0E21 2v2" },
  "3v3": { id: "3v3", size: 3, name: "\u0E17\u0E35\u0E21 3v3" },
  coop: { id: "coop", size: 4, name: "\u0E04\u0E13\u0E30\u0E2A\u0E33\u0E23\u0E27\u0E08", coop: true }
  // online zone run: one team of up to four
});
var TEAM_INFO = Object.freeze({ a: { name: "\u0E17\u0E35\u0E21\u0E0A\u0E32\u0E14", color: "#e0593f" }, b: { name: "\u0E17\u0E35\u0E21\u0E2B\u0E22\u0E01", color: "#5fbfa8" } });

// src/online/protocol.js
var FRIENDS_MAX = 50;
var ID_RE = /^(?!__proto__$|constructor$|prototype$)[A-Za-z0-9_.:@+~=/-]{1,128}$/;

// src/online/guild.js
var ROLES2 = Object.freeze({ leader: 3, officer: 2, member: 1 });
var ROLE_NAME = Object.freeze({ leader: "\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32", officer: "\u0E23\u0E2D\u0E07\u0E2B\u0E31\u0E27\u0E2B\u0E19\u0E49\u0E32", member: "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01" });
var GID_RE2 = /^g[a-z0-9]{6,16}$/;
var strip2 = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
function cleanGuildName2(raw) {
  const s = Array.from(strip2(raw)).slice(0, 16).join("");
  return Array.from(s).length >= 3 ? s : null;
}
function cleanTag2(raw) {
  const s = strip2(raw).replace(/[^A-Za-z0-9ก-๙]/g, "");
  const a = Array.from(s).slice(0, 4).join("");
  return Array.from(a).length >= 2 ? a.toUpperCase() : null;
}
function isGuildId(v) {
  return typeof v === "string" && GID_RE2.test(v);
}

// src/persistence/integrity.js
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);

// src/persistence/save.js
var CAPS = Object.freeze({ gold: 999999999999, sparks: 999999, counter: 99999999 });
var num = (v, d, min = -Infinity, max = Infinity) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
var int = (v, d, min, max) => Math.round(num(v, d, min, max));
function sanitize(raw) {
  const warnings = [];
  const fresh = createNewState();
  if (!raw || typeof raw !== "object") throw new Error("save is not an object");
  if (typeof raw.version !== "number") throw new Error("save has no version");
  if (raw.version > SAVE_VERSION) throw new Error(`save version ${raw.version} is newer than this game (${SAVE_VERSION})`);
  const s = createNewState(num(raw.createdAt, Date.now()));
  s.updatedAt = num(raw.updatedAt, Date.now());
  s.gold = int(raw.gold, 0, 0, CAPS.gold);
  s.player.level = int(raw.player?.level, 1, 1, BALANCE.player.maxLevel);
  s.player.xp = int(raw.player?.xp, 0, 0, 1e9);
  s.stats = { ...fresh.stats };
  for (const k of Object.keys(fresh.stats)) s.stats[k] = int(raw.stats?.[k], 0, 0, CAPS.counter);
  s.settings = {
    sfx: num(raw.settings?.sfx, fresh.settings.sfx, 0, 1),
    music: num(raw.settings?.music, fresh.settings.music, 0, 1),
    ui: num(raw.settings?.ui, fresh.settings.ui, 0, 1),
    shake: typeof raw.settings?.shake === "boolean" ? raw.settings.shake : true,
    fullscreen: raw.settings?.fullscreen === true,
    landscape: raw.settings?.landscape === true
  };
  const usedUids = /* @__PURE__ */ new Set();
  let maxUid = 0;
  const cleanInstance = (it, label) => {
    if (!it || typeof it !== "object") return null;
    const def = getItem(it.id);
    if (!def) {
      warnings.push(`\u0E25\u0E1A\u0E44\u0E2D\u0E40\u0E17\u0E21\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01 (${String(it.id)}) \u0E08\u0E32\u0E01${label}`);
      return null;
    }
    let uid = int(it.uid, 0, 1, 1e9);
    if (!uid || usedUids.has(uid)) uid = 0;
    const inst = { uid, id: def.id, qty: isEquipment(def) ? 1 : int(it.qty, 1, 1, BALANCE.inventory.maxStack), lvl: isEquipment(def) ? int(it.lvl, 0, 0, BALANCE.upgrade.maxLevel) : 0 };
    if (uid) {
      usedUids.add(uid);
      maxUid = Math.max(maxUid, uid);
    }
    return inst;
  };
  for (const slot of EQUIP_SLOTS) {
    const inst = cleanInstance(raw.equipment?.[slot], "\u0E0A\u0E48\u0E2D\u0E07\u0E2A\u0E27\u0E21\u0E43\u0E2A\u0E48");
    s.equipment[slot] = inst && getItem(inst.id).category === slot ? inst : null;
  }
  if (!s.equipment.weapon) {
    s.equipment.weapon = { uid: 0, id: "w_rust_blade", qty: 1, lvl: 0 };
    warnings.push("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E43\u0E19\u0E40\u0E0B\u0E1F \u0E08\u0E36\u0E07\u0E43\u0E2B\u0E49\u0E14\u0E32\u0E1A\u0E2A\u0E19\u0E34\u0E21\u0E40\u0E01\u0E48\u0E32\u0E41\u0E17\u0E19");
  }
  const slots = Array.isArray(raw.inventory?.slots) ? raw.inventory.slots : [];
  s.inventory.bagLevel = int(raw.inventory?.bagLevel, 0, 0, BALANCE.bag.maxLevel);
  s.inventory.capacity = BALANCE.inventory.capacity + BALANCE.bag.step * s.inventory.bagLevel;
  s.inventory.slots = [];
  for (const it of slots) {
    const inst = cleanInstance(it, "\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32");
    if (!inst) continue;
    if (s.inventory.slots.length >= s.inventory.capacity) {
      warnings.push("\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32\u0E40\u0E01\u0E34\u0E19\u0E04\u0E27\u0E32\u0E21\u0E08\u0E38 \u0E44\u0E2D\u0E40\u0E17\u0E21\u0E2A\u0E48\u0E27\u0E19\u0E40\u0E01\u0E34\u0E19\u0E16\u0E39\u0E01\u0E15\u0E31\u0E14\u0E2D\u0E2D\u0E01");
      break;
    }
    s.inventory.slots.push(inst);
  }
  let nextUid = Math.max(maxUid + 1, int(raw.nextUid, 1, 1, 1e9));
  for (const slot of EQUIP_SLOTS) if (s.equipment[slot] && !s.equipment[slot].uid) s.equipment[slot].uid = nextUid++;
  for (const it of s.inventory.slots) if (!it.uid) it.uid = nextUid++;
  s.nextUid = nextUid;
  s.progress = { cleared: {}, clears: {} };
  for (const [id, v] of Object.entries(raw.progress?.cleared || {})) if (v === true && getStage(id)) s.progress.cleared[id] = true;
  for (const [id, v] of Object.entries(raw.progress?.clears || {})) if (getStage(id)) s.progress.clears[id] = int(v, 0, 0, 1e9);
  const rawSkills = raw.skills || {};
  s.skills.ranks = {};
  for (const [id, r] of Object.entries(rawSkills.ranks || {})) {
    if (SKILLS[id]) s.skills.ranks[id] = int(r, 0, 0, SKILLS[id].maxRank);
    else warnings.push(`\u0E25\u0E1A\u0E2A\u0E01\u0E34\u0E25\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01 (${String(id)})`);
  }
  s.skills.slots = new Array(SKILL_SLOTS).fill(null);
  (Array.isArray(rawSkills.slots) ? rawSkills.slots : []).slice(0, SKILL_SLOTS).forEach((id, i) => {
    if (id && SKILLS[id]?.kind === "active" && s.skills.ranks[id] > 0 && !s.skills.slots.includes(id)) s.skills.slots[i] = id;
  });
  const rawStory = raw.story || {};
  s.story.name = cleanHeroName(rawStory.name);
  for (const k of ["flags", "seen", "lore"]) {
    s.story[k] = {};
    for (const [id, v] of Object.entries(rawStory[k] || {})) {
      if (v !== true) continue;
      if (k === "lore" && !LORE[id]) continue;
      if (k === "seen" && !SCENES[id]) continue;
      s.story[k][id] = true;
    }
  }
  if (raw.version < 2) {
    warnings.push("\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E40\u0E0B\u0E1F\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E43\u0E2B\u0E21\u0E48: \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E01\u0E34\u0E25\u0E41\u0E25\u0E30\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07");
  }
  if (raw.version < 3) {
    s.race = { id: null, rolls: 0 };
    s.sparks = START_SPARKS + 10 * Object.keys(s.progress.cleared).length;
    warnings.push("\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E40\u0E0B\u0E1F\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E43\u0E2B\u0E21\u0E48: \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14 \u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07 \u0E41\u0E25\u0E30\u0E2D\u0E32\u0E27\u0E38\u0E18\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E14\u0E49\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E2D\u0E33\u0E1E\u0E31\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19)");
  } else {
    const rid = raw.race?.id ?? null;
    s.race = { id: getRace(rid) ? rid : null, rolls: int(raw.race?.rolls, 0, 0, 1e6) };
    if (rid != null && !getRace(rid)) warnings.push(`\u0E40\u0E1C\u0E48\u0E32\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01 (${String(rid)}) \u2014 \u0E1B\u0E25\u0E38\u0E01\u0E2A\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E14\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1F\u0E23\u0E35`);
    s.sparks = int(raw.sparks, 0, 0, CAPS.sparks);
  }
  s.raceSlots = [0, 1].map((i) => {
    const id = raw.raceSlots?.[i];
    return getRace(id) && id !== s.race.id ? id : null;
  });
  if (s.raceSlots[0] && s.raceSlots[0] === s.raceSlots[1]) s.raceSlots[1] = null;
  s.raceSeen = {};
  for (const id of [...Object.keys(raw.raceSeen || {}), s.race.id, ...s.raceSlots]) if (getRace(id)) s.raceSeen[id] = true;
  s.pets = { owned: {}, active: [], pity: 0, summons: 0 };
  for (const [id, v] of Object.entries(raw.pets?.owned || {})) {
    if (!getPet(id)) {
      warnings.push(`\u0E25\u0E1A\u0E2A\u0E31\u0E15\u0E27\u0E4C\u0E40\u0E25\u0E35\u0E49\u0E22\u0E07\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01 (${String(id)})`);
      continue;
    }
    s.pets.owned[id] = { stars: int(v?.stars, 1, 1, MAX_STARS) };
  }
  const act = raw.pets?.active;
  for (const id of Array.isArray(act) ? act : act ? [act] : []) if (typeof id === "string" && s.pets.owned[id] && !s.pets.active.includes(id) && s.pets.active.length < PET_TEAM) s.pets.active.push(id);
  s.pets.pity = int(raw.pets?.pity, 0, 0, PITY - 1);
  s.pets.summons = int(raw.pets?.summons, 0, 0, 1e9);
  s.social = { friends: {} };
  let nFriends = 0;
  for (const [uid, f] of Object.entries(raw.social?.friends || {})) {
    if (!ID_RE.test(uid) || !f || typeof f !== "object" || nFriends >= FRIENDS_MAX) continue;
    s.social.friends[uid] = { name: cleanHeroName(f.name), at: num(f.at, 0, 0, 1e15) };
    nFriends++;
  }
  s.pvp = { wins: int(raw.pvp?.wins, 0, 0, 1e9), losses: int(raw.pvp?.losses, 0, 0, 1e9) };
  s.zones = { cleared: {}, best: {} };
  for (const [id, v] of Object.entries(raw.zones?.cleared || {})) if (getZone(id)) s.zones.cleared[id] = int(v, 0, 0, 1e9);
  for (const [id, v] of Object.entries(raw.zones?.best || {})) if (getZone(id) && typeof v === "number" && v > 0) s.zones.best[id] = int(v, 1, 1, 1e7);
  s.artifacts = { owned: {}, slots: {} };
  for (const [id, v] of Object.entries(raw.artifacts?.owned || {})) if (getArtifact(id) && v && typeof v === "object") s.artifacts.owned[id] = { lvl: int(v.lvl, 1, 1, ART_LEVEL_MAX) };
  for (const [slot, id] of Object.entries(raw.artifacts?.slots || {})) if (getSlot(slot) && s.artifacts.owned[id] && !Object.values(s.artifacts.slots).includes(id)) s.artifacts.slots[slot] = id;
  s.infinite = { day: typeof raw.infinite?.day === "string" ? raw.infinite.day.slice(0, 12) : "", used: int(raw.infinite?.used, 0, 0, 99), best: int(raw.infinite?.best, 0, 0, 1e6), runs: int(raw.infinite?.runs, 0, 0, 1e9) };
  const tw = raw.tower || {};
  s.tower = { best: int(tw.best, 0, 0, 100), asc: int(tw.asc, 0, 0, 999), bestAsc: int(tw.bestAsc, 0, 0, 999), runs: int(tw.runs, 0, 0, 1e9), kills: int(tw.kills, 0, 0, 1e12), gods: {}, claimed: {}, deepest: int(tw.deepest, 0, 0, 1e6) };
  s.tower.bestAsc = Math.max(s.tower.bestAsc, s.tower.asc);
  s.tower.deepest = Math.min(s.tower.deepest, s.tower.asc * 100 + 100);
  for (const g2 of GODS) if (tw.gods?.[g2.id]) s.tower.gods[g2.id] = int(tw.gods[g2.id], 0, 0, 1e9);
  let nClaim = 0;
  for (const k of Object.keys(tw.claimed || {})) if (/^\d{1,3}:\d{1,3}$/.test(k) && nClaim++ < 2e4) s.tower.claimed[k] = 1;
  s.titles = { owned: {}, equipped: null };
  for (const [id, at] of Object.entries(raw.titles?.owned || {})) if (getTitle(id)) s.titles.owned[id] = num(at, 0, 0, 9e15);
  s.titles.equipped = getTitle(raw.titles?.equipped) && s.titles.owned[raw.titles.equipped] ? raw.titles.equipped : null;
  s.profile = { avatar: avatarOk(raw.profile?.avatar) ? raw.profile.avatar : null, bio: cleanBio(raw.profile?.bio) };
  s.blueprints = {};
  for (const [id, v] of Object.entries(raw.blueprints || {})) if (v === true && isEquipment(getItem(id))) s.blueprints[id] = true;
  s.raids = {};
  for (const [id, v] of Object.entries(raw.raids || {})) if (isRaid(id) && v && typeof v === "object") s.raids[id] = { last: int(v.last, 0, 0, 9e15), kills: int(v.kills, 0, 0, 1e9) };
  const g = raw.guild;
  s.guild = g && isGuildId(g.id) && cleanGuildName2(g.name) && cleanTag2(g.tag) ? { id: g.id, name: cleanGuildName2(g.name), tag: cleanTag2(g.tag) } : null;
  s.integrity = raw.integrity === "modified" ? "modified" : "ok";
  let spent = Object.values(s.skills.ranks).reduce((a, r) => a + r, 0);
  if (spent > s.player.level - 1) {
    s.skills.ranks = {};
    s.skills.slots.fill(null);
    warnings.push("\u0E41\u0E15\u0E49\u0E21\u0E2A\u0E01\u0E34\u0E25\u0E40\u0E01\u0E34\u0E19\u0E40\u0E25\u0E40\u0E27\u0E25 \u0E08\u0E36\u0E07\u0E04\u0E37\u0E19\u0E41\u0E15\u0E49\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14");
    spent = 0;
  }
  return { state: s, warnings };
}

// netlify/lib/rank.mjs
var TOP = 100;
var cnt2 = (o) => Object.keys(o || {}).length;
var clamp = (v, hi) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));
var BOARDS = Object.freeze({
  power: (s) => {
    const t = computeStats(s);
    return clamp(t.atk * 3 + t.def * 2.5 + t.maxHp * 0.35 + t.crit * 400 + (t.critMult - 1.5) * 60, 1e6);
  },
  level: (s) => clamp(s.player.level * 1e7 + Math.min(s.player.xp, 9999999), 100 * 1e7 + 9999999),
  tower: (s) => clamp(s.tower?.deepest || 0, 999 * 100 + 100),
  gods: (s) => clamp(cnt2(s.tower?.gods) * 1e6 + Object.values(s.tower?.gods || {}).reduce((a, b) => a + b, 0), GODS.length * 1e6 + 999999),
  kills: (s) => clamp(s.stats.kills, 1e9),
  pvp: (s) => clamp(s.pvp?.wins || 0, 1e7),
  rift: (s) => clamp(s.infinite?.best || 0, 1e5),
  raids: (s) => clamp(RAIDS.reduce((a, r) => a + (s.raids?.[r.id]?.kills || 0), 0), 1e7),
  zones: (s) => clamp(ZONES.reduce((a, z) => a + (s.zones?.cleared?.[z.id] || 0), 0), 1e7),
  pets: (s) => clamp(cnt2(s.pets?.owned) * 100 + Object.values(s.pets?.owned || {}).reduce((a, p) => a + p.stars, 0), Object.keys(PETS).length * 105),
  races: (s) => clamp(cnt2(s.raceSeen), Object.keys(RACES).length),
  titles: (s) => clamp(cnt2(s.titles?.owned), TITLES.length),
  crafted: (s) => clamp(s.stats.crafted, 1e7),
  gold: (s) => clamp(s.gold, 1e12)
});
var BOARD_IDS = Object.freeze(Object.keys(BOARDS));
function stateOfCode(code) {
  try {
    const body = String(code).split(".")[1];
    const raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return sanitize(raw).state;
  } catch {
    return null;
  }
}
function scoresOf(state) {
  if (!state || state.integrity === "modified") return null;
  const out = {};
  for (const [id, f] of Object.entries(BOARDS)) {
    try {
      out[id] = f(state);
    } catch {
      out[id] = 0;
    }
  }
  return out;
}
var readJ = async (kv2, k) => {
  const t = await kv2.get(k);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
async function updateBoards(kv2, uid, account, code, now = Date.now()) {
  const st = stateOfCode(code);
  const sc = scoresOf(st);
  const all = await readJ(kv2, "ranks") || {};
  let changed = false;
  for (const id of BOARD_IDS) {
    const list = Array.isArray(all[id]) ? all[id] : [];
    const i = list.findIndex((e) => e.uid === uid);
    if (!sc || sc[id] <= 0) {
      if (i >= 0) {
        list.splice(i, 1);
        changed = true;
      }
      all[id] = list;
      continue;
    }
    const entry = { uid, n: String(st.story.name || "").slice(0, 16), a: String(account || "").slice(0, 20), v: sc[id], t: st.titles?.equipped || null, lv: st.player.level, r: st.race?.id || null, at: now };
    if (i >= 0) {
      if (list[i].v === entry.v && list[i].n === entry.n && list[i].t === entry.t && list[i].lv === entry.lv) continue;
      list[i] = entry;
    } else if (list.length < TOP || entry.v > list[list.length - 1].v) list.push(entry);
    else continue;
    list.sort((a, b) => b.v - a.v || a.at - b.at);
    all[id] = list.slice(0, TOP);
    changed = true;
  }
  if (changed) await kv2.set("ranks", JSON.stringify(all));
  if (st) {
    try {
      await kv2.set("card/" + uid, JSON.stringify({ ...publicCard(st), acct: String(account || "").slice(0, 20) }));
    } catch {
    }
  }
  return sc;
}
async function readBoard(kv2, board, uid = null) {
  if (!BOARDS[board]) return null;
  const all = await readJ(kv2, "ranks") || {};
  const list = Array.isArray(all[board]) ? all[board] : [];
  const mine = uid ? list.findIndex((e) => e.uid === uid) : -1;
  return { board, entries: list.map(({ uid: _u, ...e }, i) => ({ ...e, rank: i + 1 })), me: mine >= 0 ? mine + 1 : null };
}

// netlify/lib/cloud.mjs
var MAX_BODY2 = 700 * 1024;
var MAX_SAVE = 600 * 1024;
var SESSION_MS = 180 * 24 * 3600 * 1e3;
var LOCK_AFTER = 8;
var LOCK_MS = 10 * 60 * 1e3;
var NAME_RE = /^[\p{L}\p{M}\p{N}_.-]{3,20}$/u;
var CODE_RE = /^EMB1\.[A-Za-z0-9_-]{16,}\.[0-9a-f]{32}$/;
var TOKEN_RE = /^[a-f0-9]{48}$/;
var json3 = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
var sha = (s) => createHash2("sha256").update(String(s)).digest("hex");
var nameKey = (name) => String(name || "").normalize("NFC").trim().toLowerCase();
var kdf = (pass, salt) => new Promise((res, rej) => scrypt(String(pass).normalize("NFC"), salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k.toString("hex"))));
var readJ2 = async (kv2, k) => {
  const t = await kv2.get(k);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
function stampOf(code) {
  try {
    const body = code.split(".")[1];
    const text = Buffer.from(body, "base64url").toString("utf8");
    const v = JSON.parse(text).updatedAt;
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
var RATE3 = /* @__PURE__ */ new Map();
function limited3(key, max, windowMs, now) {
  const r = RATE3.get(key);
  if (!r || now - r.t > windowMs) {
    RATE3.set(key, { n: 1, t: now });
    if (RATE3.size > 5e3) RATE3.clear();
    return false;
  }
  r.n += 1;
  return r.n > max;
}
async function session(kv2, token, now) {
  if (!TOKEN_RE.test(token || "")) return null;
  const s = await readJ2(kv2, "sess/" + sha(token));
  return s && s.exp > now ? s : null;
}
async function newSession(kv2, uid, name, now) {
  const token = randomBytes(24).toString("hex");
  await kv2.set("sess/" + sha(token), JSON.stringify({ uid, name, exp: now + SESSION_MS }));
  return token;
}
async function handleCloud(req, kv2, now = Date.now(), ctx = {}) {
  if (req.method !== "POST") return json3({ error: "method" }, 405);
  if (ctx.ip && limited3("ip:" + ctx.ip, 60, 6e4, now)) return json3({ error: "rate_limited" }, 429);
  const text = await req.text();
  if (text.length > MAX_BODY2) return json3({ error: "too_big" }, 413);
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    return json3({ error: "bad_json" }, 400);
  }
  if (!b || typeof b !== "object") return json3({ error: "bad_json" }, 400);
  const save = b.save == null ? null : String(b.save);
  if (save && (save.length > MAX_SAVE || !CODE_RE.test(save))) return json3({ error: "bad_save" }, 400);
  if (b.op === "ranks") {
    const sess2 = b.token ? await session(kv2, b.token, now) : null;
    const r = await readBoard(kv2, String(b.board || ""), sess2?.uid || null);
    return r ? json3(r) : json3({ error: "board" }, 400);
  }
  if (b.op === "card") {
    const name = String(b.account || "").normalize("NFC").trim();
    if (!NAME_RE.test(name)) return json3({ error: "bad_name" }, 400);
    const acct = await readJ2(kv2, "acct/" + sha(nameKey(name)));
    const card = acct ? await readJ2(kv2, "card/" + acct.uid) : null;
    return card ? json3({ card }) : json3({ error: "no_card" }, 404);
  }
  if (b.op === "register" || b.op === "login") {
    const name = String(b.name || "").normalize("NFC").trim(), pass = String(b.pass || "");
    if (!NAME_RE.test(name)) return json3({ error: "bad_name" }, 400);
    if (pass.length < 6 || pass.length > 64) return json3({ error: "bad_pass" }, 400);
    const ak = sha(nameKey(name));
    if (b.op === "register") {
      if (ctx.ip && limited3("reg:" + ctx.ip, 5, 36e5, now)) return json3({ error: "rate_limited" }, 429);
      if (await kv2.get("acct/" + ak)) return json3({ error: "name_taken" }, 409);
      const salt = randomBytes(16).toString("hex");
      const uid = randomBytes(12).toString("hex");
      await kv2.set("acct/" + ak, JSON.stringify({ name, salt, hash: await kdf(pass, salt), uid, created: now }));
      let updatedAt = 0;
      if (save) {
        updatedAt = stampOf(save) || now;
        await kv2.set("save/" + uid, JSON.stringify({ save, updatedAt, at: now }));
        try {
          await updateBoards(kv2, uid, name, save, now);
        } catch {
        }
      }
      return json3({ token: await newSession(kv2, uid, name, now), name, updatedAt });
    }
    const fail = await readJ2(kv2, "fail/" + ak) || { n: 0, t: 0 };
    if (fail.n >= LOCK_AFTER && now - fail.t < LOCK_MS) return json3({ error: "locked", retryIn: Math.ceil((LOCK_MS - (now - fail.t)) / 1e3) }, 429);
    const acct = await readJ2(kv2, "acct/" + ak);
    const ok = acct && timingSafeEqual(Buffer.from(await kdf(pass, acct.salt), "hex"), Buffer.from(acct.hash, "hex"));
    if (!ok) {
      await kv2.set("fail/" + ak, JSON.stringify({ n: (now - fail.t < LOCK_MS ? fail.n : 0) + 1, t: now }));
      return json3({ error: "wrong" }, 401);
    }
    if (fail.n) await kv2.delete("fail/" + ak);
    const s = await readJ2(kv2, "save/" + acct.uid);
    return json3({ token: await newSession(kv2, acct.uid, acct.name, now), name: acct.name, save: s?.save || null, updatedAt: s?.updatedAt || 0 });
  }
  const sess = await session(kv2, b.token, now);
  if (!sess) return json3({ error: "session" }, 401);
  if (limited3("uid:" + sess.uid, 40, 6e4, now)) return json3({ error: "rate_limited" }, 429);
  if (b.op === "pull") {
    const s = await readJ2(kv2, "save/" + sess.uid);
    return json3({ save: s?.save || null, updatedAt: s?.updatedAt || 0, name: sess.name });
  }
  if (b.op === "push") {
    if (!save) return json3({ error: "bad_save" }, 400);
    const cur = await readJ2(kv2, "save/" + sess.uid);
    const updatedAt = stampOf(save) || now;
    const base = Number(b.base) || 0;
    if (cur && cur.updatedAt > base && cur.updatedAt !== updatedAt && !b.force) return json3({ conflict: true, updatedAt: cur.updatedAt, save: cur.save });
    await kv2.set("save/" + sess.uid, JSON.stringify({ save, updatedAt, at: now }));
    try {
      await updateBoards(kv2, sess.uid, sess.name, save, now);
    } catch {
    }
    return json3({ updatedAt });
  }
  if (b.op === "logout") {
    await kv2.delete("sess/" + sha(b.token));
    return json3({ ok: true });
  }
  return json3({ error: "op" }, 400);
}

// cloudflare/d1.mjs
var SCHEMA = [
  "CREATE TABLE IF NOT EXISTS kv (ns TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (ns, k))",
  "CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, v TEXT NOT NULL, ver INTEGER NOT NULL)"
];
var ready = /* @__PURE__ */ new WeakMap();
function ensureSchema(db) {
  if (!ready.has(db)) ready.set(db, db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => {
    ready.delete(db);
    throw e;
  }));
  return ready.get(db);
}
function kv(db, ns) {
  return {
    async get(k) {
      await ensureSchema(db);
      const r = await db.prepare("SELECT v FROM kv WHERE ns = ? AND k = ?").bind(ns, k).first();
      return r ? r.v : null;
    },
    async set(k, v) {
      await ensureSchema(db);
      await db.prepare("INSERT INTO kv (ns, k, v) VALUES (?, ?, ?) ON CONFLICT(ns, k) DO UPDATE SET v = excluded.v").bind(ns, k, String(v)).run();
    },
    async delete(k) {
      await ensureSchema(db);
      await db.prepare("DELETE FROM kv WHERE ns = ? AND k = ?").bind(ns, k).run();
    },
    async list(prefix = "") {
      await ensureSchema(db);
      const r = await db.prepare("SELECT k FROM kv WHERE ns = ? AND k >= ? AND k < ? ORDER BY k").bind(ns, prefix, prefix + "\uFFFF").all();
      return (r.results || []).map((x) => x.k);
    }
  };
}
function docs(db) {
  return {
    async getVersioned(k) {
      await ensureSchema(db);
      const r = await db.prepare("SELECT v, ver FROM docs WHERE k = ?").bind(k).first();
      return r ? { text: r.v, etag: String(r.ver) } : null;
    },
    async put(k, text, { ifMatch, ifNew } = {}) {
      await ensureSchema(db);
      let r;
      if (ifMatch) r = await db.prepare("UPDATE docs SET v = ?, ver = ver + 1 WHERE k = ? AND ver = ?").bind(text, k, Number(ifMatch) || -1).run();
      else if (ifNew) r = await db.prepare("INSERT OR IGNORE INTO docs (k, v, ver) VALUES (?, ?, 1)").bind(k, text).run();
      else r = await db.prepare("INSERT INTO docs (k, v, ver) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ver = docs.ver + 1").bind(k, text).run();
      return (r?.meta?.changes ?? 1) > 0;
    }
  };
}


// cloudflare/relay.mjs (v9.4) — real-time relay between players.
// The hub above is a mailbox in D1 that pages poll every second or more: fine for "who is online", far too slow for
// playing together. This Durable Object keeps one WebSocket per player and forwards messages straight to the
// addressed player (a few tens of ms). It stores nothing and never reads game data: it only moves {to, items} →
// {from, items}. A page proves it owns its peer id by the same key the hub checks (see handleRt).
var RT_PEER_RE = /^[a-z0-9]{8,24}$/;
var RelayHub = class extends DurableObject {
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
};
async function handleRt(req, env) {
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

// cloudflare/worker.mjs
var SITE = typeof define_SITE_HEADERS_default === "object" ? define_SITE_HEADERS_default : {};
function withHeaders(res, extra = {}) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SITE, ...extra })) out.headers.set(k, v);
  return out;
}
var noDb = () => new Response(JSON.stringify({ ok: false, reason: "no_database" }), { status: 503, headers: { "content-type": "application/json" } });
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const ip = req.headers.get("cf-connecting-ip") || "";
    if (url.pathname === "/api/rt") return handleRt(req, env);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) return withHeaders(noDb(), { "cache-control": "no-store" });
      let res;
      try {
        if (url.pathname === "/api/hub") res = await handleHub(req, kv(env.DB, "hub"), Date.now(), { ip });
        else if (url.pathname === "/api/docs") res = await handleDocs(req, docs(env.DB), kv(env.DB, "hub"), { ip });
        else if (url.pathname === "/api/cloud") res = await handleCloud(req, kv(env.DB, "cloud"), Date.now(), { ip });
        else res = new Response("not found", { status: 404 });
      } catch (e) {
        res = new Response(JSON.stringify({ ok: false, reason: "server_error" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      return withHeaders(res, { "cache-control": "no-store" });
    }
    return withHeaders(await env.ASSETS.fetch(req));
  }
};
export {
  RelayHub,
  worker_default as default
};
