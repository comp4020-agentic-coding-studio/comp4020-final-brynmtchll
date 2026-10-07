# AIR

A market in shares of nothing. Every share costs a little more than the last,
and if nobody buys for five minutes, the bubble pops.

## How it works

- You arrive with 100 coins and pick a trading name.
- There is one thing to buy. The first share costs 1.00 and each share after it
  costs 0.10 more. Selling pays back what the last share cost, so the price
  walks back down.
- Every buy restarts a five-minute clock. Selling doesn't. When the clock runs
  out, the bubble pops: every share is wiped, the money in the pot is gone, and
  a new bubble starts from 1.00.
- The page shows the price, the clock, every holder, every trade, and every
  bubble that has popped so far, with who was left holding the most.
- Next to what all the shares are worth on paper sits the money that actually
  exists to pay for them. The difference is labelled air.

## What good means here (first version)

- **You feel the bubble rather than being told about it.** Within a few
  minutes, someone should make money off a later buyer, and someone should get
  caught holding when it pops.
- **Every profit is visibly someone else's loss.** Nothing hides where the money
  came from: paper wealth sits beside the money in the pot, and the gap is on
  screen the whole time.
- **It needs other people.** Alone, nothing happens. The price only rises when
  others buy, and the bubble only survives while someone keeps buying.
- **The rules fit in your head.** One asset, one price rule, one clock, so what
  happens is down to what people do, not hidden mechanics.
- **The arithmetic is honest.** No money appears or disappears except in a pop,
  and every pop is recorded.
- **It's a small game for a room**, not a trading platform.

## What's checked and what's judged

Checked automatically in `spec/`:

- No money is created, and none is lost except in a pop: coins held, plus the
  pot, plus everything lost in pops, always equals what was handed out, even
  when people trade at the same moment.
- Each share costs 0.10 more than the last, and buying then selling returns
  exactly what you paid.
- You can't sell shares you don't hold or spend coins you don't have.
- The bubble survives while someone buys, pops after five minutes without a buy,
  and records the pop at the moment the clock ran out.
- No player's login id is ever shown to anyone else.

Judged by people:

- Whether it feels like a bubble: do people get greedy, wait too long, panic?
- Whether the paper-versus-pot display makes the gap obvious.

## Sources and precedents

- Smith, Suchanek & Williams (1988), "Bubbles, Crashes, and Endogenous
  Expectations in Experimental Spot Asset Markets", *Econometrica*: small lab
  markets bubble and crash even when the asset's value is known, and bubbles
  shrink when the same group plays again.
- [The Button](https://en.wikipedia.org/wiki/The_Button_(Reddit)) (Reddit,
  2015): a countdown anyone can reset for everyone.
- [Fomo3D](https://www.vice.com/en/article/fomo3d-winner-clogged-ethereum-blockchain/)
  (2018): a rising price plus a timer, billed as "a psychological social
  experiment in greed". Its winner gamed the clock.
- Keynes's beauty contest (*The General Theory*, ch. 12): price is what you
  think other people think it's worth.
- Ian Bogost, *Persuasive Games* (2007): games make arguments through their
  rules.

## Not built yet

- Other people's trades only appear when you reload. The clock ticks in your
  browser and reloads the page when it runs out.
- There are no accounts: a new browser gets another 100 coins.
- There are no bailouts: lose everything and you're out.

## Open questions

- Should every newcomer keep getting 100 coins? That's what keeps the bubble
  fed, which makes it a Ponzi scheme by design.
- How unequal should it be? A steeper price rule hands more to the first buyers.
- Is five minutes right for a crit pod? For a showcase room of a hundred?
