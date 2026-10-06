import { describe, expect, inject, it } from "vitest";

// The market's promises, checked over HTTP against the running app. These
// trade, so they join players and move the price: they run against a local or
// CI app (a throwaway /data) and skip against the live one unless
// SPEC_WRITES=1 says otherwise.
const baseUrl = inject("baseUrl");
const writable = /\/\/(localhost|127\.0\.0\.1)[:/]/.test(baseUrl) || process.env.SPEC_WRITES === "1";

type State = {
  supply: number;
  nextPrice: number;
  pot: number;
  totalCoins: number;
  burnedTotal: number;
  granted: number;
  players: Record<string, unknown>[];
  me?: { name: string; coins: number; shares: number };
};

// a trader with their own cookie, as a separate browser would be
async function trader(): Promise<{ post: (path: string, body: Record<string, string>) => Promise<string>; state: () => Promise<State> }> {
  let cookie = "";
  const post = async (path: string, body: Record<string, string>): Promise<string> => {
    const res = await fetch(new URL(path, baseUrl), {
      method: "POST",
      body: new URLSearchParams(body),
      headers: cookie ? { cookie } : {},
      redirect: "manual",
    });
    cookie = res.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    return new URL(res.headers.get("location") ?? "/", baseUrl).searchParams.get("m") ?? "ok";
  };
  const state = async (): Promise<State> =>
    (await fetch(new URL("/api/state", baseUrl), { headers: cookie ? { cookie } : {} })).json() as Promise<State>;
  const name = `spec-${Math.random().toString(36).slice(2, 10)}`;
  expect(await post("/join", { name })).toBe("ok");
  return { post, state };
}

// money only ever leaves the market by vanishing in a pop, and every coin that
// does is counted
const conserved = (s: State): void => expect(s.totalCoins + s.pot + s.burnedTotal).toBe(s.granted);

describe.skipIf(!writable)("the market", () => {
  it("gives a new trader 100 coins and remembers them on their next visit", async () => {
    const t = await trader();
    const me = (await t.state()).me;
    expect(me).toMatchObject({ coins: 10_000, shares: 0 });
  });

  it("charges each share 0.10 more than the last, and pays the same back on the way down", async () => {
    const t = await trader();
    const before = await t.state();
    expect(await t.post("/trade", { side: "buy", qty: "3" })).toBe("ok");
    const after = await t.state();
    const p = before.nextPrice;
    expect(after.me!.coins).toBe(10_000 - (p + (p + 10) + (p + 20)));
    expect(after.nextPrice).toBe(p + 30);
    expect(await t.post("/trade", { side: "sell", qty: "3" })).toBe("ok");
    expect((await t.state()).me!.coins).toBe(10_000);
  });

  it("refuses to sell shares you don't hold or spend coins you don't have", async () => {
    const t = await trader();
    expect(await t.post("/trade", { side: "sell", qty: "1" })).toBe("no-shares");
    expect(await t.post("/trade", { side: "buy", qty: "100000" })).toBe("broke");
    expect(await t.post("/trade", { side: "buy", qty: "-5" })).toBe("bad-qty");
    expect((await t.state()).me).toMatchObject({ coins: 10_000, shares: 0 });
  });

  it("never creates money or loses it outside a pop, even when traders hit it at once", async () => {
    const traders = await Promise.all([trader(), trader(), trader()]);
    await Promise.all(
      traders.flatMap((t) => [
        t.post("/trade", { side: "buy", qty: "max" }),
        t.post("/trade", { side: "sell", qty: "2" }),
        t.post("/trade", { side: "buy", qty: "1" }),
        t.post("/trade", { side: "sell", qty: "max" }),
      ]),
    );
    const s = await traders[0].state();
    conserved(s);
    for (const t of traders) {
      const me = (await t.state()).me!;
      expect(me.coins).toBeGreaterThanOrEqual(0);
      expect(me.shares).toBeGreaterThanOrEqual(0);
    }
  });

  it("never shows anyone another trader's id, since it doubles as their login", async () => {
    await trader();
    const s = await (await fetch(new URL("/api/state", baseUrl))).json() as State;
    for (const p of s.players) expect(p).not.toHaveProperty("id");
  });
});
