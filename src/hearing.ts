// Hearing across the room: what you can read of what someone said, from
// where you are. Said is a party you can read: several conversations at
// once in one room, and you follow the one you walk up to. So, as with
// sound, a word is clear close to, fainter further off, and past a point
// only that someone's talking shows, not what; and a loud word carries
// further than a quiet one (a laugh across the room, a whisper only at your
// shoulder). As numbers, apart from the drawing, so they can be checked.
//
// Distances are the room's floor units (walk.ts): a chair's width is about
// 3, the table 18 across, the room 45 by 40.

// How far an ordinary word can be read, and how far it can be seen that
// someone's talking at all. About a group round a corner of the table, and
// most of the room.
export const READ_AT = 10;
export const SEEN_AT = 30;
// Each dB louder than their typical word carries this much further (and a
// quieter one this much less): +9 dB, a word said with feeling, is half as
// far again; -12, a whisper, a third as far.
const PER_DB = 0.055;
// however loud: no further than this times the reach (a shout across the
// room still doesn't reach the far end), and a whisper never less than this
const MOST = 1.8;
const LEAST = 0.3;

// How far a word said `loud` dB above its speaker's typical word can be read.
export const reach = (loud: number): number => READ_AT * Math.min(MOST, Math.max(LEAST, 1 + loud * PER_DB));

// How well a word said `loud` can be read from `d` away: 1 clear, falling to
// 0 at its reach. (Eased, so it holds clear most of the way, then goes.)
export function clarity(d: number, loud = 0): number {
  const r = reach(loud);
  const near = r * 0.6;
  if (d <= near) return 1;
  if (d >= r) return 0;
  const t = (d - near) / (r - near);
  return 1 - t * t * (3 - 2 * t);
}

// How big a caption is drawn from `d` away, as a scale on its size: full
// close to, smaller further off, never so small it's a smudge.
export const scaleAt = (d: number): number => Math.max(0.55, Math.min(1.15, 1.15 - (d / SEEN_AT) * 0.6));

// Whether you can see someone's talking at all from `d` away.
export const seenAt = (d: number): boolean => d < SEEN_AT;

// Who's within reading distance of `at`: what a "near you" transcript is.
export const near = (at: { x: number; z: number }, them: { x: number; z: number }): boolean => Math.hypot(at.x - them.x, at.z - them.z) < READ_AT;

// Space's floor (space.ts), in the same units: wider than it's deep, the
// same for everyone whatever their screen (a phone held upright shows it
// turned), so whoever can read you, you can read. From the middle you can
// read about a third of the way to either end; nobody's ever out of sight.
export const FLOOR = { w: 25, h: 15 };
// how far apart two places on it are, each given as 0 to 1 across and down
export const apart = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot((a.x - b.x) * FLOOR.w, (a.y - b.y) * FLOOR.h);
// Where someone new to Space starts: the place nearest the middle that's
// far enough from everyone already there not to sit on their words, though
// near enough to read them; with nowhere like that, the place furthest from
// anyone.
export function freeSpot(taken: { x: number; y: number }[]): { x: number; y: number } {
  let best = { x: 0.5, y: 0.5 };
  let bestScore = -Infinity;
  for (let i = 0; i <= 16; i++)
    for (let j = 0; j <= 10; j++) {
      const at = { x: 0.1 + (i / 16) * 0.8, y: 0.12 + (j / 10) * 0.76 };
      const room = Math.min(Infinity, ...taken.map((t) => apart(at, t)));
      const fromMiddle = apart(at, { x: 0.5, y: 0.5 });
      // (clear of everyone: nearest the middle wins; otherwise most room)
      const score = room >= READ_AT * 0.55 ? 1000 - fromMiddle : room;
      if (score > bestScore) [best, bestScore] = [at, score];
    }
  return { x: Math.round(best.x * 1000) / 1000, y: Math.round(best.y * 1000) / 1000 };
}
