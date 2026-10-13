// A speaker's words, waiting on their own screen before anyone else sees
// them. They go out at the pace they were said, starting WAIT after their
// phrase reaches the queue, unless the speaker does something to the word at
// the top first: typing replaces it (keeping how it was said), deleting drops
// it, a number key puts an effect on it. Each of those gives the top word its
// WAIT again, and the words behind it wait with it, keeping their spacing.
// Kept apart from the page so it can be checked without one; `now` is passed
// in for the same reason.
//
// (A flat second a word let 60 a minute out against the 120 to 150 people
// say, so a long stretch of talk built a queue that emptied in the pauses.)
import { EFFECTS, type Effect, type Word } from "./voice.ts";

export const WAIT = 1000; // ms from a phrase reaching the queue to its first word going
// A phrase that arrives while words are still waiting goes after them, at
// least this long after the last; the real pause between phrases isn't known.
const BETWEEN_PHRASES = 400; // ms

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
  // each waiting word, with when it goes
  const waiting: { word: Word; due: number }[] = [];
  let typed: string | null = null;

  // The speaker's touched the top word: it goes no sooner than WAIT from
  // now, and everything behind it moves back by as much, keeping its pace.
  const hold = (now: number): void => {
    const late = waiting.length ? now + WAIT - waiting[0].due : 0;
    if (late > 0) for (const w of waiting) w.due += late;
  };

  // what's been typed replaces the top word; nothing typed leaves it as it was
  const commit = (): void => {
    const text = typed?.trim().replace(/\s+/g, " ");
    if (text && waiting.length) waiting[0].word = replace(waiting[0].word, text);
    typed = null;
  };

  return {
    add(words, now) {
      if (!words.length) return;
      const last = waiting.at(-1);
      const first = Math.max(now + WAIT, last ? last.due + BETWEEN_PHRASES : 0);
      for (const w of words) waiting.push({ word: w, due: Math.round(first + (w.start - words[0].start) * 1000) });
    },
    words: () => waiting.map((w) => w.word),
    typing: () => typed,
    due: () => waiting[0]?.due ?? null,
    release(now) {
      // someone in the middle of typing over the top word holds it
      if (typed !== null || !waiting.length || now < waiting[0].due) return null;
      return waiting.shift()!.word;
    },
    key(key, now) {
      if (!waiting.length) return false;
      if (typed !== null) {
        if (key === "Enter" || key === " ") commit();
        else if (key === "Escape") typed = null;
        else if (key === "Backspace") typed = typed.slice(0, -1);
        else if (key.length === 1 && typed.length < LONGEST_TYPED) typed += key;
        else return false;
        hold(now);
        return true;
      }
      const effect = Number(key);
      if (Number.isInteger(effect) && effect >= 1 && effect <= EFFECTS.length) {
        const fx: Effect = EFFECTS[effect - 1];
        const top = waiting[0].word;
        waiting[0].word = top.effect === fx ? { ...top, effect: undefined } : { ...top, effect: fx };
        hold(now);
        return true;
      }
      if (key === "Backspace" || key === "Delete") {
        waiting.shift();
        hold(now);
        return true;
      }
      // a letter starts typing over the top word
      if (key.length === 1 && key !== " " && /\S/u.test(key)) {
        typed = key;
        hold(now);
        return true;
      }
      // Enter or Space sends the top word now
      if (key === "Enter" || key === " ") {
        waiting[0].due = now;
        return true;
      }
      return false;
    },
    flush() {
      commit();
      return waiting.splice(0).map((w) => w.word);
    },
  };
}
