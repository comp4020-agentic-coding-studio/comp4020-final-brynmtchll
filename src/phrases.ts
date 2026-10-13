// Cutting someone's speech into phrases as they talk, so each can be heard
// and sent while they carry on. Fed the microphone a batch at a time (at
// 16 kHz); hands back each phrase as it ends. Kept apart from the page so it
// can be checked on recorded speech.
//
// A phrase ends at a pause once there's enough of it to be worth hearing, or,
// for someone who never pauses, at the quietest moment of its last stretch
// once it's run long. Whisper takes about the same time on a short phrase as
// a long one (it always reads a 30 s window), so phrases aren't cut shorter
// than they need to be.

const RATE = 16_000;
const PAUSE = 0.4; // seconds of quiet that end a phrase
const SHORTEST = 0.8; // seconds of sound before a pause can end one
// A phrase with less sound than SHORTEST still ends once it's been quiet for
// LONG_PAUSE: a lone "Yes." would otherwise sit behind seconds of silence
// until the next sentence, and go out glued to it (a 0.4 s "Yes." left 6 s
// after it was said). With no sound at all, what there is is thrown away.
const LONG_PAUSE = 0.8;
const LONGEST = 6; // seconds: past this, it's cut at its quietest recent moment
const CUT_WITHIN = 1.2; // seconds back from the end to look for that moment
const TAIL = 0.2; // seconds of quiet kept on the end, so the last word isn't clipped

// Quiet is measured against the room: QUIET_MARGIN above its background, the
// quietest of the last few seconds (a low percentile, so one click doesn't
// count). Until there are a few seconds of it to go on, the background is
// taken to be no louder than ASSUMED_FLOOR: someone already talking when
// they turn their microphone on would otherwise be taken for the room, and
// none of their pauses heard. JFK's first sentence, from a recording with
// hiss, ran to the cap when the background was learned slowly from a guess.
const QUIET_MARGIN = 8; // dB
const BACKGROUND_OVER = 8; // seconds
const ASSUMED_FLOOR = -50; // dB
const KNOWN_AFTER = 2; // seconds

const db = (xs: Float32Array): number => {
  let s = 0;
  for (const x of xs) s += x * x;
  return 10 * Math.log10(s / Math.max(1, xs.length) + 1e-12);
};

export type Phraser = {
  // a batch of microphone samples; returns any phrases it ended, in order
  push(samples: Float32Array): Float32Array[];
  // the microphone's off: whatever was being said, as a last phrase
  end(): Float32Array[];
  // how loud the last batch was above the room, 0 to 1, for a level meter
  level(): number;
};

export function phraser(): Phraser {
  const batches: { samples: Float32Array; db: number }[] = []; // the phrase so far
  let length = 0; // samples
  let sound = 0; // samples of sound (not quiet) in it
  let quietFor = 0; // samples of quiet at its end
  const levels: { db: number; n: number }[] = []; // the last few seconds, for the background
  let heard = 0; // samples heard since starting
  let lastLevel = 0;

  const floor = (): number => {
    const sorted = levels.map((l) => l.db).sort((a, b) => a - b);
    const quietest = sorted[Math.floor(sorted.length * 0.1)] ?? ASSUMED_FLOOR;
    return heard < KNOWN_AFTER * RATE ? Math.min(quietest, ASSUMED_FLOOR) : quietest;
  };

  // the phrase's first `upTo` samples, as one array, and what's left of it
  // after them carried into the next phrase
  function take(upTo: number): Float32Array {
    const out = new Float32Array(upTo);
    let at = 0;
    const rest: typeof batches = [];
    for (const b of batches) {
      if (at >= upTo) rest.push(b);
      else if (at + b.samples.length <= upTo) out.set(b.samples, at);
      else {
        out.set(b.samples.subarray(0, upTo - at), at);
        rest.push({ samples: b.samples.slice(upTo - at), db: b.db });
      }
      at += b.samples.length;
    }
    batches.length = 0;
    batches.push(...rest);
    length = batches.reduce((n, b) => n + b.samples.length, 0);
    // what's carried on is counted afresh
    const f = floor();
    sound = batches.filter((b) => b.db >= f + QUIET_MARGIN).reduce((n, b) => n + b.samples.length, 0);
    quietFor = 0;
    for (let i = batches.length - 1; i >= 0 && batches[i].db < f + QUIET_MARGIN; i--) quietFor += batches[i].samples.length;
    return out;
  }

  // where to cut a phrase that's run long: just after its quietest batch in
  // the last CUT_WITHIN, so a word isn't split between two phrases
  function quietestCut(): number {
    let at = 0;
    let best = length;
    let bestDb = Infinity;
    for (const b of batches) {
      at += b.samples.length;
      if (at >= length - CUT_WITHIN * RATE && at < length && b.db < bestDb) {
        bestDb = b.db;
        best = at;
      }
    }
    return best;
  }

  return {
    push(samples) {
      const level = db(samples);
      heard += samples.length;
      levels.push({ db: level, n: samples.length });
      while (levels.reduce((n, l) => n + l.n, 0) > BACKGROUND_OVER * RATE) levels.shift();
      const f = floor();
      const quiet = level < f + QUIET_MARGIN;
      lastLevel = Math.min(1, Math.max(0, (level - f) / 40));

      if (length === 0 && quiet) return []; // nothing said yet: don't keep silence
      batches.push({ samples, db: level });
      length += samples.length;
      if (quiet) quietFor += samples.length;
      else {
        sound += samples.length;
        quietFor = 0;
      }

      if ((quietFor >= PAUSE * RATE && sound >= SHORTEST * RATE) || quietFor >= LONG_PAUSE * RATE) {
        const phrase = sound > 0 ? take(length - Math.max(0, quietFor - TAIL * RATE)) : null;
        batches.length = 0;
        length = sound = quietFor = 0;
        return phrase ? [phrase] : [];
      }
      if (length >= LONGEST * RATE) return [take(quietestCut())];
      return [];
    },
    end() {
      if (length === 0 || sound === 0) {
        batches.length = 0;
        length = sound = quietFor = 0;
        return [];
      }
      const phrase = take(length - Math.max(0, quietFor - TAIL * RATE));
      batches.length = 0;
      length = sound = quietFor = 0;
      return [phrase];
    },
    level: () => lastLevel,
  };
}
