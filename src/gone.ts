// Who's been gone from a room long enough to put their hand down and sit
// them back in their chair (server.ts), as numbers: kept apart from the
// server so it can be checked without waiting a minute.

export const GONE_FOR = 60_000; // ms with no page open in the room

export type Gone = {
  pagesOf: Map<string, number>; // pages each person has open in the room
  goneSince: Map<string, number>; // when each closed their last one
  hands: Map<string, number>; // whose hand is up, since when
  standing: Map<string, unknown>; // who's up and walking about
};

// Whose hands to put down and who to sit, as of `now`, and when each went
// forgotten afterwards. All three are worked out before anything's
// forgotten: in two timers, the one that forgot ran first, the other found
// no time gone, and whoever closed their tab while up stood there for good.
export function overdue(l: Gone, now: number): { hands: string[]; sit: string[]; forget: string[] } {
  const away = (name: string, since: number | undefined): boolean => !l.pagesOf.get(name) && now - (since ?? 0) > GONE_FOR;
  return {
    hands: [...l.hands.keys()].filter((name) => away(name, l.goneSince.get(name) ?? l.hands.get(name))),
    sit: [...l.standing.keys()].filter((name) => away(name, l.goneSince.get(name))),
    forget: [...l.goneSince].filter(([, since]) => now - since > GONE_FOR).map(([name]) => name),
  };
}
