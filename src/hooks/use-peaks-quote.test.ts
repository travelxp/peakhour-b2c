import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import { deriveQuoteState } from "./use-peaks-quote";
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
  expiresAt: Date.now() + 900_000,
} as BindingPeaksQuote;

const base = { enabled: true, isFetching: false, data: undefined, error: undefined };

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

  it("★an error never produces a quote — there is nothing to render a price from", () => {
    const s = deriveQuoteState({
      ...base,
      error: new ApiError("ACTION_NOT_PRICED", "x", 502),
    });
    expect(s.quote).toBeUndefined();
  });
});
