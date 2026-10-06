import { describe, expect, it } from "vitest";
import { openMarket } from "../src/db.ts";
import { POP_AFTER, reserve } from "../src/market.ts";

// The pop runs on a five-minute clock, too slow to wait for over HTTP, so this
// drives the market directly with a clock it controls. It still goes through
// the same openMarket the server uses.
function market() {
  let t = 1_000_000;
  const m = openMarket(":memory:", () => t);
  return { m, wait: (ms: number) => (t += ms) };
}

describe("the bubble", () => {
  it("survives as long as someone buys before the clock runs out", () => {
    const { m, wait } = market();
    m.join("a", "a");
    m.join("b", "b");
    m.trade("a", "buy", 10);
    wait(POP_AFTER - 1);
    m.trade("b", "buy", 1); // restarts the clock
    wait(POP_AFTER - 1);
    const s = m.snapshot("a");
    expect(s.bubble.number).toBe(1);
    expect(s.me!.shares).toBe(10);
  });

  it("pops when nobody buys for five minutes: shares wiped, pot gone, the loss on record", () => {
    const { m, wait } = market();
    m.join("a", "a");
    m.join("b", "b");
    m.trade("a", "buy", 10);
    m.trade("b", "buy", 5);
    m.trade("a", "sell", 2); // a sale doesn't keep it alive
    const pot = reserve(13);
    wait(POP_AFTER);

    const s = m.snapshot("b");
    expect(s.bubble.number).toBe(2);
    expect(s.supply).toBe(0);
    expect(s.nextPrice).toBe(100);
    expect(s.burnedTotal).toBe(pot);
    expect(s.totalCoins + s.pot + s.burnedTotal).toBe(s.granted);
    expect(s.past[0]).toMatchObject({ number: 1, burned: pot, bag: { name: "a", shares: 8 } });
    expect(s.me!.bags[0]).toMatchObject({ bubble: 1, shares: 5 });
    // too late to sell into a bubble that's gone
    expect(m.trade("b", "sell", 1)).toEqual({ ok: false, reason: "no-shares" });
  });

  it("dates the pop to when the clock ran out, not to when someone next looked", () => {
    const { m, wait } = market();
    m.join("a", "a");
    m.trade("a", "buy", 1);
    wait(POP_AFTER * 20);
    const s = m.snapshot();
    expect(s.past[0].poppedAt - s.past[0].startedAt).toBe(POP_AFTER);
  });

  it("has nothing to pop while nobody holds a share", () => {
    const { m, wait } = market();
    m.join("a", "a");
    m.trade("a", "buy", 3);
    m.trade("a", "sell", "max");
    wait(POP_AFTER * 2);
    const s = m.snapshot("a");
    expect(s.bubble.number).toBe(1);
    expect(s.bubble.popsIn).toBeNull();
    expect(s.me!.coins).toBe(10_000);
  });
});
