// The market's arithmetic, kept pure so the rules live in one place.
//
// All money is integer pips (100 pips = 1 coin) so nothing is ever lost to
// rounding: the conservation rule below has to hold exactly, not nearly.
//
// Shares are priced on a linear bonding curve. The k-th share in existence
// costs BASE + STEP * (k - 1), and selling hands back exactly what the last
// share cost, so there is no counterparty to wait for and the pot always holds
// precisely enough to buy every share back. Every coin a seller makes over
// what they paid came from someone who bought after them.

export const GRANT = 10_000; // every new player arrives with 100 coins
export const BASE = 100; // the first share costs 1.00
export const STEP = 10; // each share after it costs 0.10 more

// what the k-th share in existence costs (k starts at 1)
export const priceOf = (k: number): number => BASE + STEP * (k - 1);

// the money that moves when supply goes from s to s + q: what buying q shares
// costs at supply s, and what selling them back from s + q pays out
export const span = (s: number, q: number): number =>
  q * BASE + STEP * (s * q + (q * (q - 1)) / 2);

// what the pot holds when s shares exist
export const reserve = (s: number): number => span(0, s);

// the most shares `coins` can buy when s already exist
export function affordable(s: number, coins: number): number {
  let lo = 0;
  let hi = 1;
  while (span(s, hi) <= coins) hi *= 2;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (span(s, mid) <= coins) lo = mid;
    else hi = mid;
  }
  return lo;
}

export const coins = (pips: number): string => (pips / 100).toFixed(2);
