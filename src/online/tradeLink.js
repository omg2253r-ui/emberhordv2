// One live trade between two players, in its own named room ('trade-<id>'). Both sides keep their side of the
// deal in presence (`tr`): offer, locked, the confirmed deal key, done. When both confirmed the SAME key, each
// side applies the deal to its own save (src/online/trade.js) exactly once.
import { PROTOCOL } from './protocol.js';
import { readOffer, emptyOffer, tradeKey, applyTrade, checkTrade } from './trade.js';

const PARTNER_GONE = 4000;
const LINGER = 8000;          // after applying, stay until the partner has applied too (or this long)

export function createTradeLink(app, { ch, tid, host, partner }) {
  const subs = new Set();
  const s = {
    mine: emptyOffer(), theirs: emptyOffer(), myLock: false, theirLock: false, myOk: '', theirOk: '', theirDone: false,
    applied: false, closed: false, result: null, seenPartner: false, partnerAt: Date.now(), appliedAt: 0, theirKey: '',
  };
  const iAmHost = host;
  const notify = () => { for (const fn of subs) fn(s); };
  const key = () => tradeKey(tid, iAmHost ? s.mine : s.theirs, iAmHost ? s.theirs : s.mine);
  const share = () => ch.presence({ v: PROTOCOL, tr: { tid, o: s.mine, lk: s.myLock ? 1 : 0, ok: s.myOk, dn: s.applied ? 1 : 0 } });

  const offPeers = ch.onPeers((c) => {
    if (s.closed) return;
    const p = c.peers.find((x) => x.peer === partner.peer);
    if (!p) return;
    s.seenPartner = true; s.partnerAt = Date.now();
    const tr = p.presence?.tr;
    if (!tr || tr.tid !== tid) { notify(); return; }
    const offer = readOffer(tr.o) || emptyOffer();
    const k = JSON.stringify(offer);
    if (k !== s.theirKey) {
      // their offer changed: every lock and confirmation starts over
      s.theirKey = k; s.theirs = offer;
      if (s.myLock || s.myOk) { s.myLock = false; s.myOk = ''; share(); }
    }
    s.theirLock = !!tr.lk; s.theirOk = typeof tr.ok === 'string' ? tr.ok.slice(0, 2000) : ''; s.theirDone = !!tr.dn;
    maybeApply();
    notify();
  });

  function maybeApply() {
    if (s.applied || !s.myOk || s.myOk !== key() || s.theirOk !== s.myOk) return;
    const r = applyTrade(app.store.get(), s.mine, s.theirs);
    if (!r.ok) { s.result = { ok: false, reason: r.reason }; close(); return; }
    app.store.commit(r.state, { reason: 'trade' });
    s.applied = true; s.appliedAt = Date.now();
    s.result = { ok: true };
    share();
  }

  const timer = setInterval(() => {
    if (s.closed) return;
    // still in the trade room = still here (an idle partner sends nothing new)
    if (ch.peers().some((x) => x.peer === partner.peer)) { s.seenPartner = true; s.partnerAt = Date.now(); }
    if (!s.applied && Date.now() - s.partnerAt > PARTNER_GONE && (s.seenPartner || Date.now() - s.partnerAt > 15000)) { s.result = { ok: false, reason: 'partner_left' }; close(); return; }
    if (s.applied && (s.theirDone || Date.now() - s.appliedAt > LINGER)) close();
  }, 400);

  function close() {
    if (s.closed) return;
    s.closed = true;
    clearInterval(timer); offPeers();
    ch.leave().catch(() => {});
    notify();
  }

  share();
  return {
    get state() { return s; },
    tid, partner,
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    setOffer(offer) {
      if (s.applied || s.closed) return;
      s.mine = offer; s.myLock = false; s.myOk = '';
      share(); notify();
    },
    lock(v) {
      if (s.applied || s.closed) return;
      s.myLock = !!v; if (!v) s.myOk = '';
      share(); notify();
    },
    // check before confirming: can my bag take their offer, is my offer still there?
    check: () => checkTrade(app.store.get(), s.mine, s.theirs),
    confirm() {
      if (s.applied || s.closed || !s.myLock || !s.theirLock) return { ok: false, reason: 'not_locked' };
      const c = checkTrade(app.store.get(), s.mine, s.theirs);
      if (!c.ok) return c;
      s.myOk = key();
      share(); maybeApply(); notify();
      return { ok: true };
    },
    cancel() { if (!s.applied) s.result = { ok: false, reason: 'cancelled' }; close(); },
  };
}
