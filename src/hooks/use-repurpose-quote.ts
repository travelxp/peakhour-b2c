"use client";

import { useQuery } from "@tanstack/react-query";
import { repurposeQuote, type RepurposeQuote, type RepurposeQuoteTokens } from "@/lib/api/repurpose";
import { QUOTE_CLOCK_SKEW_MS } from "@/hooks/use-peaks-quote";

/**
 * The price of writing for the channels ticked in the Repurpose sheet, asked for as the merchant ticks them and before they press Generate.
 *
 * The sheet prices a CHOICE, not one fixed act: the number depends on which channels are ticked (X is a post and a thread; a blog channel
 * is an article at its own price), so the query is keyed by the ticked set and the api answers one binding quote per kind of writing. The
 * receipts travel back on the press (`repurpose(req, tokens)`), and the api charges that price for the pieces that were written.
 *
 * It follows `usePeaksQuote`'s rules, for the same reasons: asked only while the sheet is on its pick step (the receipt's clock starts when
 * the merchant is about to act), refreshed inside its life, never retried (a price that cannot be set does not improve), a lapsed receipt
 * withheld rather than sent (the api would answer 409 and the press would never run), and "loading" and "unavailable" kept apart.
 */
export interface RepurposeQuoteState {
  /** The price for the ticked channels, or undefined until one arrives (and once its receipts have lapsed). */
  quote: RepurposeQuote | undefined;
  /** A request is genuinely in flight and there is no price to show yet. */
  loading: boolean;
  /** We asked and cannot give a price. The press must stay off: nothing is run that was not priced. */
  unavailable: boolean;
  /** The receipts to send with the press: only while a price is held. */
  tokens: RepurposeQuoteTokens;
  /** Ask again (a price that failed is not retried on its own). */
  retry: () => void;
}

/** The earliest moment either receipt lapses, in epoch ms (Infinity when nothing is written). */
function earliestExpiry(q: RepurposeQuote): number {
  return Math.min(q.posts?.quote.expiresAt ?? Infinity, q.articles?.quote.expiresAt ?? Infinity);
}

export function deriveRepurposeQuote(input: {
  /** Asks again; handed through as `retry`. */
  refetch?: () => void;
  enabled: boolean;
  isFetching: boolean;
  data: RepurposeQuote | undefined;
  /** Injected so expiry is testable without a clock. */
  now: number;
}): RepurposeQuoteState {
  const expired = !!input.data && earliestExpiry(input.data) - QUOTE_CLOCK_SKEW_MS <= input.now;
  const quote = expired ? undefined : input.data;
  return {
    quote,
    loading: input.isFetching && !quote,
    unavailable: input.enabled && !input.isFetching && !quote,
    retry: () => input.refetch?.(),
    tokens: quote
      ? {
          ...(quote.posts ? { posts: quote.posts.quote.token } : {}),
          ...(quote.articles ? { articles: quote.articles.quote.token } : {}),
        }
      : {},
  };
}

export function useRepurposeQuote(platforms: string[], enabled: boolean): RepurposeQuoteState {
  // Sorted so the same ticks in another order are one price, not two requests.
  const key = [...platforms].sort();
  const live = enabled && key.length > 0;
  const query = useQuery({
    queryKey: ["repurpose-quote", key],
    queryFn: () => repurposeQuote(key),
    enabled: live,
    retry: false,
    // Shorter than the receipt's life, as `usePeaksQuote` does: a price on screen is never more than a third of the way through it.
    staleTime: 5 * 60 * 1000,
    refetchInterval: live ? 5 * 60 * 1000 : false,
  });
  return deriveRepurposeQuote({
    refetch: () => void query.refetch(),
    enabled: live,
    // eslint-disable-next-line react-hooks/purity -- read during render on purpose, as `usePeaksQuote` does: the refetch above bounds how stale it can be.
    now: Date.now(),
    isFetching: query.isFetching,
    data: query.data,
  });
}
