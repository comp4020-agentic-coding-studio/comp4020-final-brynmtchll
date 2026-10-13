// A speaker's words, waiting on their own screen before anyone else sees
// them. The word at the top goes out after WAIT, unless its speaker does
// something to it first: typing replaces it (keeping how it was said),
// deleting drops it, a number key puts an effect on it. Each of those starts
// its wait again, so there's time to see the result. Kept apart from the page
// so it can be checked without one; `now` is passed in for the same reason.
//
// A word a second is 60 a minute against the 120 to 150 people say, so a
// long stretch of talk builds a queue that empties in the pauses.
import { EFFECTS, type Effect, type Word } from "./voice.ts";

export const WAIT = 1000; // ms the top word waits before it goes

export type Queue = {
  // words just heard, to the back of the queue
  add(words: Word[], now: number): void;
  // what's waiting, top first, and what's being typed over the top
  words(): readonly Word[];
  typing(): string | null;
  // when the top word goes, or null with nothing waiting
  due(): number | null;
  // the top word if its time's up, removed; call as time passes
  release(now: number): Word | null;
  // a key pressed while the speaker's queue has the keyboard; true if the
  // queue took it (so the page doesn't do anything else with it)
  key(key: string, now: number): boolean;
  // everything still waiting, at once (the speaker's leaving)
  flush(): Word[];
};

// A replacement keeps how the word it replaces was said, but not what the
// spelling did with it: a typed word's letters aren't the heard word's, so
// which one was drawn out (held) no longer applies, though how long it was
// held still does (voice.ts picks a letter again).
const replace = (w: Word, text: string): Word => ({ ...w, w: text, held: null });

const LONGEST_TYPED = 40;

export function queue(): Queue {
  const waiting: Word[] = [];
  let typed: string | null = null;
  let due: number | null = null;

  const restart = (now: number): void => {
    due = waiting.length ? now + WAIT : null;
  };

  // what's been typed replaces the top word; nothing typed leaves it as it was
  const commit = (): void => {
    const text = typed?.trim().replace(/\s+/g, " ");
    if (text && waiting.length) waiting[0] = replace(waiting[0], text);
    typed = null;
  };

  return {
    add(words, now) {
      const wasEmpty = waiting.length === 0;
      waiting.push(...words);
      if (wasEmpty) restart(now);
    },
    words: () => waiting,
    typing: () => typed,
    due: () => (waiting.length ? due : null),
    release(now) {
      // someone in the middle of typing over the top word holds it
      if (typed !== null || !waiting.length || due === null || now < due) return null;
      const out = waiting.shift()!;
      restart(now);
      return out;
    },
    key(key, now) {
      if (!waiting.length) return false;
      if (typed !== null) {
        if (key === "Enter" || key === " ") commit();
        else if (key === "Escape") typed = null;
        else if (key === "Backspace") typed = typed.slice(0, -1);
        else if (key.length === 1 && typed.length < LONGEST_TYPED) typed += key;
        else return false;
        restart(now);
        return true;
      }
      const effect = Number(key);
      if (Number.isInteger(effect) && effect >= 1 && effect <= EFFECTS.length) {
        const fx: Effect = EFFECTS[effect - 1];
        waiting[0] = waiting[0].effect === fx ? { ...waiting[0], effect: undefined } : { ...waiting[0], effect: fx };
        restart(now);
        return true;
      }
      if (key === "Backspace" || key === "Delete") {
        waiting.shift();
        restart(now);
        return true;
      }
      // a letter starts typing over the top word
      if (key.length === 1 && key !== " " && /\S/u.test(key)) {
        typed = key;
        restart(now);
        return true;
      }
      // Enter or Space sends the top word now
      if (key === "Enter" || key === " ") {
        due = now;
        return true;
      }
      return false;
    },
    flush() {
      commit();
      const out = waiting.splice(0);
      due = null;
      return out;
    },
  };
}
