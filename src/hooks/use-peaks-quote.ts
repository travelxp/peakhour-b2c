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
  reason: "unknown_action" | "not_priced" | "unreachable" | undefined;
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
  });

  return deriveQuoteState({
    enabled,
    // ⚠️`isFetching`, NOT `isPending` — see the header and `deriveQuoteState`.
    isFetching: query.isFetching,
    data: query.data,
    error: query.error,
  });
}

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
}): PeaksQuoteState {
  const code = input.error instanceof ApiError ? input.error.code : undefined;
  return {
    quote: input.data,
    loading: input.isFetching,
    // ★ASKED, NOT FETCHING, AND NOTHING TO SHOW FOR IT. `enabled` is part of
    // it because a surface that has not opened has not asked — reporting
    // `unavailable` there would render "we couldn't check the price" on a
    // dialog nobody has opened.
    unavailable: input.enabled && !input.isFetching && !input.data,
    reason: input.error
      ? code === "UNKNOWN_ACTION"
        ? "unknown_action"
        : code === "ACTION_NOT_PRICED"
          ? "not_priced"
          : "unreachable"
      : undefined,
  };
}
