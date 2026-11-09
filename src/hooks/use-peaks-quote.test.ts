import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  deriveQuoteState,
  quoteTokenFor,
  QUOTE_CLOCK_SKEW_MS,
} from "./use-peaks-quote";
import type { BindingPeaksQuote } from "@/lib/api/peaks";

/**
 * ★★THE THREE STATES A PRICED BUTTON BRANCHES ON (P-10).
 *
 * ── ⚠️WHY THIS IS NOT TESTING REACT-QUERY ─────────────────────────────────
 *
 * The rule that matters is not which hook is called. It is that **a DISABLED
 * query and an OFFLINE-PAUSED one are both `pending` in v5, and neither is
 * loading** — so a surface branching on `isPending` shows a spinner that never
 * resolves for a merchant with no connection, and one branching on
 * `!isPending` shows the fallback before the fetch has begun.
 *
 * That is invisible through a rendered hook without a real network and obvious
 * here, which is why the derivation is a pure function.
 */


/** A fixed clock, so expiry is a fact of the input rather than of the run. */
const NOW = 1_780_000_000_000;

const QUOTE = {
  action: "growth.propose_audiences",
  useCase: "growth.campaign_plan",
  label: "Audience proposal",
  description: null,
  peaks: 40,
  breakdown: [
    { useCase: "growth.campaign_plan", label: "Plan", peaks: 20, free: false },
    { useCase: "growth.council", label: "Critique", peaks: 20, free: false },
  ],
  free: false,
  source: "code",
  token: "signed.receipt",
  expiresAt: NOW + 900_000,
} as BindingPeaksQuote;

const base = {
  enabled: true,
  isFetching: false,
  data: undefined,
  error: undefined,
  now: NOW,
};

describe("★★deriveQuoteState — loading, priced, or honestly unavailable", () => {
  it("★★a CLOSED surface is none of the three", () => {
    // ⚠️A disabled query is `pending` for ever. Reporting `unavailable` here
    // would render "we couldn't check the price" on a dialog nobody has opened.
    const s = deriveQuoteState({ ...base, enabled: false });
    expect(s.loading).toBe(false);
    expect(s.unavailable).toBe(false);
    expect(s.quote).toBeUndefined();
  });

  it("★★an OPEN surface with a request in flight is loading, not unavailable", () => {
    const s = deriveQuoteState({ ...base, isFetching: true });
    expect(s.loading).toBe(true);
    expect(s.unavailable).toBe(false);
  });

  it("★★an OPEN surface that is NOT fetching and has nothing is unavailable", () => {
    // The offline case: react-query pauses the query, so it never fetches and
    // never errors. `isPending` is true and means nothing; this is what a
    // surface must branch on.
    const s = deriveQuoteState(base);
    expect(s.loading).toBe(false);
    expect(s.unavailable).toBe(true);
    // ★AND NO REASON, because there is no error — we simply have no price. A
    // reason invented here would tell a merchant whose problem it is when
    // nobody knows.
    expect(s.reason).toBeUndefined();
  });

  it("a quote in hand is neither loading nor unavailable", () => {
    const s = deriveQuoteState({ ...base, data: QUOTE });
    expect(s.quote).toBe(QUOTE);
    expect(s.loading).toBe(false);
    expect(s.unavailable).toBe(false);
  });
});

describe("★★whose problem it is — the api distinguishes these and so must we", () => {
  it("★a stale action key is OURS, and the fix is a deploy", () => {
    const s = deriveQuoteState({
      ...base,
      error: new ApiError("UNKNOWN_ACTION", "No registered Peaks action", 404),
    });
    expect(s.reason).toBe("unknown_action");
    expect(s.unavailable).toBe(true);
  });

  it("★★an unpriced action is an OPERATOR's, and the merchant is right to ask", () => {
    // The route's own comment: *"Collapsing both into one status is how a
    // seeding gap gets debugged as a client bug."*
    const s = deriveQuoteState({
      ...base,
      error: new ApiError("ACTION_NOT_PRICED", "registered but has no ACTIVE rate-card row", 502),
    });
    expect(s.reason).toBe("not_priced");
  });

  it("anything else is unreachable", () => {
    const s = deriveQuoteState({ ...base, error: new Error("socket hang up") });
    expect(s.reason).toBe("unreachable");
  });

  it("★an error over NO receipt produces no quote", () => {
    const s = deriveQuoteState({
      ...base,
      error: new ApiError("ACTION_NOT_PRICED", "x", 502),
    });
    expect(s.quote).toBeUndefined();
  });
});

describe("★★an EXPIRED receipt is withheld, never sent (round 1)", () => {
  it("★★withholds the quote once `expiresAt` has passed", () => {
    // ⚠️THE PREMISE THIS CLIENT WAS BUILT ON WAS WRONG. A lapsed token is not
    // billed at the live rate card — `quotedAction` answers **409
    // QUOTE_NOT_HONOURED and the handler never runs**. So sending a dead
    // receipt FAILS THE ACT, which is strictly worse than sending none.
    const s = deriveQuoteState({ ...base, data: QUOTE, now: QUOTE.expiresAt + 1 });
    expect(s.quote).toBeUndefined();
    expect(s.reason).toBe("expired");
  });

  it("★and the PRICE goes with it — we do not show a number we won't honour", () => {
    // Rendering the figure off a receipt we will not send is the
    // false-price-at-the-moment-of-the-ask this row exists to remove, one
    // refresh later.
    const s = deriveQuoteState({ ...base, data: QUOTE, now: QUOTE.expiresAt + 1 });
    expect(s.quote?.peaks).toBeUndefined();
    expect(s.unavailable).toBe(true);
  });

  it("★a receipt one millisecond short of the SKEW MARGIN is still good", () => {
    // The boundary, because `<=` and `<` are one character apart and one of
    // them throws away a usable quote on every tick. WARN THE EDGE MOVED IN
    // ROUND 2: the margin is subtracted from `expiresAt`, so *still good*
    // now means a millisecond short of `expiresAt - QUOTE_CLOCK_SKEW_MS`.
    const s = deriveQuoteState({
      ...base,
      data: QUOTE,
      now: QUOTE.expiresAt - QUOTE_CLOCK_SKEW_MS - 1,
    });
    expect(s.quote).toBe(QUOTE);
    expect(s.reason).toBeUndefined();
  });

  it("★★withholds a receipt INSIDE the margin, before it is strictly expired", () => {
    // WARN THE DIRECTION IS DELIBERATE (round 2). By its own clock this
    // receipt is still valid; by a server clock thirty seconds ahead it is
    // not. Withholding early costs one GET. Handing it out costs the ACT:
    // 409 QUOTE_NOT_HONOURED, and nothing runs.
    const s = deriveQuoteState({
      ...base,
      data: QUOTE,
      now: QUOTE.expiresAt - QUOTE_CLOCK_SKEW_MS,
    });
    expect(s.quote).toBeUndefined();
    expect(s.reason).toBe("expired");
  });

  it("★★the margin is THIRTY SECONDS, stated rather than read back", () => {
    // ⚠️THE MUTATION RUN FOUND THIS, AND IT IS THE FIXTURE-GAP SHAPE.
    // The two cases above compute `now` FROM `QUOTE_CLOCK_SKEW_MS`, so
    // they move with it: setting the constant to 0 left both of them
    // green, because the expectation slid along with the thing it was
    // meant to pin. ★A guard whose expectation is derived from what it
    // guards proves the RELATION and never the VALUE.
    expect(QUOTE_CLOCK_SKEW_MS).toBe(30_000);
    // And the consequence, stated in a literal the constant cannot move:
    // fifteen seconds before the stamp is INSIDE a thirty-second margin.
    const s = deriveQuoteState({
      ...base,
      data: QUOTE,
      now: QUOTE.expiresAt - 15_000,
    });
    expect(s.quote).toBeUndefined();
    expect(s.reason).toBe("expired");
  });
});

describe("★★an error outranks an expiry (round 2)", () => {
  it("★★a failing refetch over a lapsed receipt reports the ERROR, not expiry", () => {
    // WARN BOTH ARE TRUE AT ONCE, and react-query makes that the NORMAL
    // case: it keeps the last successful `data` while a refetch fails.
    // Answering "expired" renders *Checking the price again...*, which
    // reads as progress -- so a merchant whose rate-card row an operator
    // deactivated watches a reassuring sentence for ever instead of being
    // told we cannot price this.
    const s = deriveQuoteState({
      ...base,
      data: QUOTE,
      now: QUOTE.expiresAt + 1,
      error: new ApiError("ACTION_NOT_PRICED", "no active row", 502),
    });
    expect(s.reason).toBe("not_priced");
    expect(s.quote).toBeUndefined();
  });

  it("★and a lapsed receipt with NO error is still `expired`", () => {
    const s = deriveQuoteState({ ...base, data: QUOTE, now: QUOTE.expiresAt + 1 });
    expect(s.reason).toBe("expired");
  });
});

describe("★★quoteTokenFor — the receipt is attached only while we hold one", () => {
  it("★★attaches the token when the quote is live", () => {
    const s = deriveQuoteState({ ...base, data: QUOTE });
    expect(quoteTokenFor(s)).toEqual({ quoteToken: "signed.receipt" });
  });

  it("★★attaches NOTHING once the receipt has lapsed — absent beats dead", () => {
    // WARN THE ASYMMETRY IS THE WHOLE RULE (R1.1). No receipt charges the
    // live rate card and the act SUCCEEDS; a dead receipt is answered 409
    // and the act never runs. So the fallback is omission, never the token
    // we happen to be holding.
    const s = deriveQuoteState({ ...base, data: QUOTE, now: QUOTE.expiresAt + 1 });
    expect(quoteTokenFor(s)).toEqual({});
  });

  it("attaches nothing when there is no quote at all", () => {
    expect(quoteTokenFor(deriveQuoteState(base))).toEqual({});
  });

  it("★spreads to nothing, so a caller payload is left unchanged", () => {
    // ★THE SHAPE MATTERS, not only the value: every call site SPREADS this
    // into a mutation payload, and `{ quoteToken: undefined }` would send
    // the key with an undefined value rather than omit the key.
    const s = deriveQuoteState(base);
    expect(Object.keys({ objective: "awareness", ...quoteTokenFor(s) })).toEqual([
      "objective",
    ]);
  });
});

describe("★a quote in hand beats a background refetch (round 1)", () => {
  it("★★does not report `loading` while it holds a price", () => {
    // ⚠️Window-focus refetch is on by default. Reporting `loading` here
    // replaced a price already on screen with "working out what this costs"
    // while the button stayed pressable — a surface that forgets what it
    // knows, on the one screen where the number is the point.
    const s = deriveQuoteState({ ...base, data: QUOTE, isFetching: true });
    expect(s.quote).toBe(QUOTE);
    expect(s.loading).toBe(false);
  });

  it("★but DOES report loading on a refetch that has nothing to fall back on", () => {
    const s = deriveQuoteState({ ...base, isFetching: true });
    expect(s.loading).toBe(true);
  });
});

describe("★★an error over a LIVE receipt — the rule the vacuous test named wrongly (round 3)", () => {
  it("★★does NOT withhold a receipt we still hold, and that is deliberate", () => {
    // ⚠️⚠️THIS REPLACES AN ASSERTION THAT COULD NOT FAIL. Its sibling was
    // called *"an error never produces a quote"* and passed only because
    // the shared fixture carries `data: undefined` — so it asserted the
    // absence of something that was never there. The rule it named was
    // NEVER IMPLEMENTED, and nothing noticed for two rounds.
    //
    // ★AND THE RULE IT NAMED IS NOT THE ONE WE WANT. A failed REFRESH is
    // not evidence that the receipt in hand is bad: R1.5 is that a quote
    // in hand beats a background refetch, and withholding on any error
    // would blank a good price on one dropped packet — the defect R1.5
    // exists to have fixed, re-entered through the error branch.
    //
    // ★THE ONE THING THAT IS EVIDENCE A RECEIPT IS BAD is the api
    // REFUSING it, and a 409 is not visible here at all — it arrives on
    // the ACT, not on the quote. So it is handled where it lands, by
    // dropping the receipt from the cache (`use-audience-plan.ts`,
    // `resetQueries`), and not by reading `error` in this function.
    const s = deriveQuoteState({
      ...base,
      data: QUOTE,
      error: new Error("socket hang up"),
    });
    expect(s.quote).toBe(QUOTE);
    expect(s.reason).toBe("unreachable");
  });

  it("★and a LAPSED receipt under the same error is still withheld", () => {
    // The two rules compose in the one direction that matters: an error
    // does not withhold, and expiry always does.
    const s = deriveQuoteState({
      ...base,
      data: QUOTE,
      now: QUOTE.expiresAt + 1,
      error: new Error("socket hang up"),
    });
    expect(s.quote).toBeUndefined();
  });
});
