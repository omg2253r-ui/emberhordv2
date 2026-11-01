// v8.6: a boss is never immune. Its dives, burrows, blinks and swaps still play (it hides, it moves, the attack that
// follows is as dangerous as ever) but the hero's blows always land: the time it used to spend untouchable is paid
// back as extra health bars instead (data/bossGuard.js).
//
// Behaviours keep setting `untargetable` while they animate a dodge; this runs right after each boss's behaviour and
// turns the flag into `dodging`, so the hit gate, auto-aim, pets and skills (which all skip untargetable monsters)
// never see a boss as untouchable. The boss behaviours and tricks read `dodging` when they need to know.
export function openBossGuard(e) {
  if (!e.type?.boss) return;
  e.dodging = !!e.untargetable;
  e.untargetable = false;
}

// how faded a boss is drawn while it dodges: ghostly, never gone, so the hero can still aim at it
export const bossHiddenAlpha = (e, hidden) => (e.type?.boss ? Math.min(hidden || 0, 0.6) : hidden || 0);
