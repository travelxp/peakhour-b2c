"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { peaksApi, type BindingPeaksQuote, type PeaksActionKey } from "@/lib/api/peaks";

/**
 * The price of one act, fetched at the moment the merchant is about to take it.
 *
 * ── ★WHY `enabled` AND NOT A `useEffect` ──────────────────────────────────
 *
 * A quote's token has a TTL, and the api's own note says when it should start:
 * *"a TTL should start when the merchant is about to act, not when a list was
 * rendered."* So the query is gated on the surface being OPEN, and react-query
 * re-runs it when it opens again — a dialog closed and reopened gets a fresh
 * fifteen minutes rather than a receipt that may lapse mid-read.
 *
 * ── ⚠️★★`isPending` IS NOT "LOADING" IN v5, AND THIS IS THE TRAP ─────────
 *
 * A DISABLED query is `pending` for ever — it has no data and is not fetching —
 * and so is a query paused because the browser is offline. A surface that
 * renders "working out the price…" on `isPending` therefore shows a spinner
 * that never resolves for a merchant with no connection, and one that renders
 * the FALLBACK on `!isPending` shows it before the fetch has begun.
 *
 * ★SO THIS RETURNS THE THREE STATES A CALLER ACTUALLY BRANCHES ON, derived
 * rather than left to each surface: `quote` (we have a price), `loading` (we
 * are genuinely asking), and `unavailable` (we asked and cannot answer). A
 * caller that gets none of the three has not opened the surface yet.
 */
export interface PeaksQuoteState {
  /** The binding quote, or undefined until one arrives. */
  quote: BindingPeaksQuote | undefined;
  /** A request is genuinely in flight. NOT true for a disabled or paused query. */
  loading: boolean;
  /**
   * We asked and could not get a price.
   *
   * ⚠️★DISTINCT FROM `loading`, and a surface must not collapse them: a
   * merchant who is offline is not waiting for anything, and telling them to
   * wait is worse than telling them we cannot price this right now.
   */
  unavailable: boolean;
  /**
   * Whose problem it is, when there is one.
   *
   * ★THE API DISTINGUISHES THESE AND A CLIENT MUST NOT COLLAPSE THEM.
   * `unknown_action` is OUR stale key and the fix is a deploy;
   * `not_priced` is an operator problem — a registry row nobody has seeded or
   * somebody has deactivated — and the merchant is right to be asking. The
   * route's own comment: *"Collapsing both into one status is how a seeding gap
   * gets debugged as a client bug."*
   */
  reason: "unknown_action" | "not_priced" | "unreachable" | "expired" | undefined;
}

export function usePeaksQuote(action: PeaksActionKey, enabled: boolean): PeaksQuoteState {
  const query = useQuery({
    queryKey: ["peaks-quote", action],
    // `request` already unwraps the envelope, so this IS the quote.
    queryFn: () => peaksApi.quote(action),
    enabled,
    /**
     * ★NOT RETRIED ON A 404 OR A 502, and retried on nothing else either.
     * Neither failure gets better by asking again: a stale key is stale until a
     * deploy, and an unseeded rate-card row is unseeded until an operator acts.
     * Retrying would delay the honest "we can't price this" by the length of
     * the backoff, on a dialog the merchant is sitting in front of.
     */
    retry: false,
    /**
     * ★SHORTER THAN THE TOKEN'S TTL, DELIBERATELY. A cached quote whose token
     * has expired is worse than no quote: the price renders, the merchant
     * accepts it, and the api refuses the receipt and charges the live card.
     * Five minutes against a fifteen-minute token leaves room for the act
     * itself, which on this surface takes the better part of a minute.
     */
    staleTime: 5 * 60 * 1000,
    /**
     * WARN KEPT FRESH WHILE THE SURFACE IS OPEN (review round 1), because a
     * LAPSED receipt is worse than none: the api answers 409 and the act
     * never runs, so a dialog left open past the TTL would fail on every
     * press. A quote is one GET with no model call behind it; five minutes
     * against a fifteen-minute token means what we hold is never more than
     * a third of the way through its life.
     */
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
  });

  return deriveQuoteState({
    enabled,
    /**
     * ⏸READ DURING RENDER, DELIBERATELY, AND THE RULE IS RIGHT IN GENERAL.
     * "Is this receipt still valid" is a question about the clock, and the only
     * pure alternatives are worse: a `now` in state needs a timer re-rendering
     * this subtree every second to stay honest, and a value captured once goes
     * stale exactly when it matters.
     *
     * ★THE IMPURITY IS BOUNDED. A stale read here can only mean we render a
     * price a moment longer than we should; `refetchInterval` replaces the
     * receipt every five minutes against a fifteen-minute TTL, so the window
     * this could be wrong in is one the refetch has already closed.
     */
    // eslint-disable-next-line react-hooks/purity
    now: Date.now(),
    // ⚠️`isFetching`, NOT `isPending` — see the header and `deriveQuoteState`.
    isFetching: query.isFetching,
    data: query.data,
    error: query.error,
  });
}

/**
 * How early a receipt is treated as lapsed, to absorb the difference between
 * the clock of the server that minted it and the browser reading it
 * (review round 2).
 *
 * STAR THIRTY SECONDS AGAINST A FIFTEEN-MINUTE TTL is 3% of the life of a
 * quote -- small enough that it never costs a merchant a usable price, large
 * enough to cover the ordinary difference between two machines.
 */
export const QUOTE_CLOCK_SKEW_MS = 30 * 1000;

/**
 * The three states, derived from what react-query reports.
 *
 * ★EXPORTED AND PURE SO IT CAN BE TESTED AT ALL. The rule that matters here
 * is not which hook is called — it is that a DISABLED query and an
 * OFFLINE-PAUSED one are both `pending` in v5 and neither is loading, and
 * that an error and an absence are different answers. None of that is
 * observable through a rendered hook without a real network; all of it is
 * observable here.
 */
export function deriveQuoteState(input: {
  enabled: boolean;
  isFetching: boolean;
  data: BindingPeaksQuote | undefined;
  error: unknown;
  /** Injected so expiry is testable without a clock. */
  now: number;
}): PeaksQuoteState {
  const code = input.error instanceof ApiError ? input.error.code : undefined;
  /**
   * WARN A LAPSED RECEIPT IS WITHHELD, NOT HANDED OUT (review round 1).
   * `quotedAction` answers 409 and the handler never runs, so sending a dead
   * token FAILS THE ACT -- strictly worse than sending none, which charges
   * the live card and succeeds. The refetch above makes this rare; this is
   * what happens when the refetch itself has been failing.
   *
   * STAR AND THE PRICE GOES WITH IT. Rendering the number off a receipt we
   * will not send is the false-price-at-the-moment-of-the-ask this row
   * exists to remove, one refresh later.
   */
  // WARN A MARGIN, NOT A SKEW FIX (review round 2). `expiresAt` is minted by
  // the SERVER and compared against the BROWSER clock, and the two failure
  // directions are not symmetric: a browser clock that runs FAST withholds a
  // receipt slightly early and costs one GET, while one that runs SLOW hands
  // out a receipt the api has already stopped honouring -- and R1.1 is that
  // sending a dead token FAILS THE ACT outright, where sending none succeeds
  // at the live card. So the cheap direction is taken deliberately.
  //
  // STAR IT DOES NOT SOLVE REAL SKEW and is not claimed to. A clock minutes
  // out is still wrong here, and can only be fixed where the token is READ.
  // What this closes is the last seconds of a receipt life -- exactly the
  // window `refetchInterval` cannot help with, because reaching it at all
  // means the refresh has been failing.
  const expired =
    !!input.data && input.data.expiresAt - QUOTE_CLOCK_SKEW_MS <= input.now;
  const quote = expired ? undefined : input.data;
  return {
    quote,
    // STAR A QUOTE IN HAND BEATS A BACKGROUND REFETCH (round 1). `loading`
    // was read first by the renderer, so a window-focus refetch replaced a
    // price already on screen with 'working out what this costs' while the
    // button stayed pressable -- a surface that forgets what it knows.
    loading: input.isFetching && !quote,
    // ★ASKED, NOT FETCHING, AND NOTHING TO SHOW FOR IT. `enabled` is part of
    // it because a surface that has not opened has not asked — reporting
    // `unavailable` there would render "we couldn't check the price" on a
    // dialog nobody has opened.
    unavailable: input.enabled && !input.isFetching && !quote,
    // WARN AN ERROR OUTRANKS AN EXPIRY (review round 2). Both are true at
    // once in the normal case -- react-query keeps the last successful
    // `data` while a refetch fails -- and the first cut answered
    // "expired", which this surface renders as *"Checking the price
    // again..."*. That reads as PROGRESS. When the refetch is failing for
    // a reason that will not clear on its own (an ACTION_NOT_PRICED row an
    // operator deactivated, a network that is down), the merchant watches
    // a reassuring sentence for ever instead of being told we cannot price
    // this. The error is the more specific answer, so it is the one given.
    reason: input.error
      ? code === "UNKNOWN_ACTION"
        ? "unknown_action"
        : code === "ACTION_NOT_PRICED"
          ? "not_priced"
          : "unreachable"
      : expired
        ? "expired"
        : undefined,
  };
}

/**
 * The receipt to send with the act, as a payload fragment.
 *
 * -- WARN WHY THIS IS A FUNCTION AND NOT A SPREAD AT THE CALL SITE --------
 *
 * Because it WAS a spread at three call sites, and requirement 4 was met at
 * two of them. `...(price.quote ? { quoteToken: price.quote.token } : {})` is
 * a rule -- *send the receipt only while we are actually holding one* --
 * written out longhand everywhere it applies, which is the shape section
 * 7.0.1 correction box is entirely about: *five surfaces deriving one rule
 * five ways*, and all five were wrong.
 *
 * STAR AND THE RULE IS LOAD-BEARING IN BOTH DIRECTIONS. Omitting the receipt
 * charges the live rate card and SUCCEEDS; sending a lapsed one is answered
 * **409 QUOTE_NOT_HONOURED and the act never runs** (R1.1). Reading
 * `price.quote` -- which `deriveQuoteState` withholds once lapsed -- and
 * never the raw response, is the whole of the rule.
 */
export function quoteTokenFor(price: Pick<PeaksQuoteState, "quote">): {
  quoteToken?: string;
} {
  return price.quote ? { quoteToken: price.quote.token } : {};
}
