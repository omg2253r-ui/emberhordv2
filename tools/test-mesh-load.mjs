// Load-reduction checks for the online layer (v8.0.3). Run: node tools/test-mesh-load.mjs
// Uses an in-process hub (memory store) and a tiny fake RTCPeerConnection, so no browser or network is needed.
import { createMeshNet } from '../src/net/mesh.js';
import { handleHub, memoryKV } from '../netlify/lib/hub.mjs';

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(40); } return false; }

// ---------------------------------------------------------------- fake WebRTC (two pages in one process)
const registry = new Map();
let seq = 0;
class FakeDC extends EventTarget {
  constructor(label) { super(); this.label = label; this.readyState = 'connecting'; this.bufferedAmount = 0; this.peerDc = null; this.sent = []; }
  send(d) { this.sent.push(d); const o = this.peerDc; queueMicrotask(() => o?.dispatchEvent(Object.assign(new Event('message'), { data: d }))); }
  close() { this.readyState = 'closed'; }
}
class FakePC extends EventTarget {
  constructor() { super(); this.id = 'pc' + (++seq); this.iceGatheringState = 'complete'; this.connectionState = 'new'; registry.set(this.id, this); }
  createDataChannel(label) { this.dc = new FakeDC(label); return this.dc; }
  async createOffer() { return { type: 'offer', sdp: 'offer:' + this.id }; }
  async createAnswer() { return { type: 'answer', sdp: 'answer:' + this.id }; }
  async setLocalDescription(d) { this.localDescription = d; }
  async setRemoteDescription(d) {
    this.remote = d;
    if (d.type === 'offer') { this.offerer = registry.get(d.sdp.split(':')[1]); return; }
    // the offerer got the answer: join the two channels and open them
    const answerer = registry.get(d.sdp.split(':')[1]);
    const a = this.dc, b = new FakeDC(a.label);
    a.peerDc = b; b.peerDc = a;
    answerer.dc = b;
    answerer.dispatchEvent(Object.assign(new Event('datachannel'), { channel: b }));
    queueMicrotask(() => { a.readyState = 'open'; b.readyState = 'open'; a.dispatchEvent(new Event('open')); b.dispatchEvent(new Event('open')); });
  }
  close() { registry.delete(this.id); }
}
globalThis.RTCPeerConnection = FakePC;

let listCalls = 0;
function hubFor(store, cacheMs = 0) {
  const counting = { ...store, list: (p) => { listCalls++; return store.list(p); } };
  return (url, opts) => handleHub(new Request('http://test/api/hub', { method: 'POST', body: opts.body }), counting, Date.now(), { cacheMs });
}
const uid = (n) => 'u' + String(n).padStart(14, '0').replace(/\d/g, (c) => 'abcdefghij'[+c]);
const key = (n) => String(n).padStart(24, 'k');
async function player(store, n, extra = {}) {
  return createMeshNet({ uid: uid(n), ukey: key(n), fetchImpl: hubFor(store, extra.cacheMs || 0), ...extra });
}

// ---------------------------------------------------------------- 1. delta presence over an open link
{
  const store = memoryKV();
  const A = await player(store, 1), B = await player(store, 2);
  const linked = await until(() => A.stats().open === 1 && B.stats().open === 1 && A.lobby.peers().length === 2 && B.lobby.peers().length === 2);
  ok(linked, 'two players get a direct (fake) WebRTC link and see each other');

  const dcA = [...registry.values()].map((p) => p.dc).filter((d) => d && d.readyState === 'open');
  const sentBy = (dc) => dc.sent.map((s) => JSON.parse(s)).filter((m) => m.t === 'p');
  const out = dcA.find((d) => d.sent.some((s) => JSON.parse(s).t === 'hi')) && dcA[0];

  await A.lobby.presence({ v: 1, n: 'Aria', lv: 12, ps: ['a', 'b', 'c'], x: 10, y: 20, z: 'village' });
  await wait(30);
  const mark = Math.max(...dcA.map((d) => d.sent.length));
  await A.lobby.presence({ x: 15 });
  await wait(30);
  const all = dcA.flatMap((d) => d.sent.map((s) => JSON.parse(s))).filter((m) => m.t === 'p');
  const lastMsg = all[all.length - 1];
  ok(!!lastMsg && !!lastMsg.d && lastMsg.d.x === 15 && !('p' in lastMsg) && Object.keys(lastMsg.d).length === 1, 'moving sends only the changed field (delta), not the whole presence');
  const bView = B.lobby.peers().find((p) => !p.isMe);
  ok(bView && bView.presence.x === 15 && bView.presence.n === 'Aria' && bView.presence.ps.length === 3, 'the other player sees the merged presence (new x, old name and pets kept)');

  const before = dcA.reduce((s, d) => s + d.sent.length, 0);
  await A.lobby.presence({ x: 15 });
  await wait(30);
  ok(dcA.reduce((s, d) => s + d.sent.length, 0) === before, 'sending an unchanged presence costs nothing');

  await A.lobby.presence({ z: null });
  await wait(150);      // changes from others reach the game in batches of ~50 ms
  ok(!('z' in B.lobby.peers().find((p) => !p.isMe).presence), 'a removed field is removed on the other side too');

  // updates are batched into few notices
  let notices = 0;
  B.lobby.onPeers(() => { notices++; });
  await wait(20); notices = 0;
  for (let i = 0; i < 30; i++) await A.lobby.presence({ x: 100 + i });
  await wait(200);
  ok(notices <= 6 && B.lobby.peers().find((p) => !p.isMe).presence.x === 129, `30 quick updates reached the game as ${notices} notice(s), final position correct`);
  A.close(); B.close();
}

// ---------------------------------------------------------------- 2. relay (hub) links always carry the full presence
{
  const store = memoryKV();
  const A = await player(store, 3, { rtc: false }), B = await player(store, 4, { rtc: false });
  await until(() => A.lobby.peers().length === 2 && B.lobby.peers().length === 2);
  await A.lobby.presence({ v: 1, n: 'Relay', x: 1, y: 2 });
  await A.lobby.presence({ x: 9 });
  const okRelay = await until(() => { const p = B.lobby.peers().find((q) => !q.isMe); return p && p.presence.x === 9 && p.presence.n === 'Relay'; }, 8000);
  ok(okRelay, 'players behind strict NATs (relay through the hub) still get complete, correct presence');
  A.close(); B.close();
}

// ---------------------------------------------------------------- 3. hub roster cache
{
  const run = async (cacheMs) => {
    const store = memoryKV(); listCalls = 0;
    const nets = [];
    for (let i = 20; i < 26; i++) nets.push(await player(store, i, { rtc: false, cacheMs }));
    await wait(3000);
    nets.forEach((n) => n.close());
    return listCalls;
  };
  const cold = await run(0), warm = await run(1200);
  ok(warm < cold * 0.8, `roster cache cuts storage list calls (${cold} → ${warm})`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
