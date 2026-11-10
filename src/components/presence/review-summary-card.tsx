"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { presenceApi } from "@/lib/api/presence";
import { useLocale } from "@/hooks/use-locale";
import {
  cardSections,
  formatResponseTime,
  ratingLabel,
  ratingSubLabel,
  responseCaveat,
  reviewEmptyState,
  REVIEW_SUMMARY_QUERY_KEY,
  sampleCaveat,
  summariesOf,
  unansweredCta,
  type ReviewSummary,
} from "@/lib/review-summary";

/**
 * What the reviews say — rating, volume, unanswered, how fast we answer, and
 * the worst recent ones (plan S0·5).
 *
 * ★★★MARKUP ONLY. Whether a figure may be shown at all, what an absence means,
 * and every sentence on the card come from `lib/review-summary.ts`, because this
 * repo runs vitest WITHOUT JSDOM and a rule in here is a rule nothing asserts.
 *
 * ⚠️THE ONE THING TO NOT "TIDY UP": the `?? 0` that is not here. The api answers
 * `null` for a figure it cannot compute, and every one of those nulls is load
 * bearing — "0.0 ★" says this business's customers rate it at nothing, and
 * "responds in 0h" says they answer instantly. Neither is true, and both are one
 * defaulting operator away.
 */

function Stat({
  label,
  value,
  sub,
  absent,
}: {
  label: string;
  value: string | null;
  sub?: string | null;
  /** What to say INSTEAD of a number when there is none. Never "0". */
  absent: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {value === null ? (
        <p className="mt-1 text-sm text-muted-foreground">{absent}</p>
      ) : (
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      )}
      {value !== null && sub && <p className="mt-0.5 text-micro text-muted-foreground">{sub}</p>}
    </div>
  );
}

function WorstList({ summary }: { summary: ReviewSummary }) {
  const { formatDate } = useLocale();
  if (summary.worstRecent.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">
        Worst recent
      </p>
      {summary.worstRecent.map((r) => (
        <div key={r.id} className="rounded-md border p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-0.5 font-medium tabular-nums">
              <Star className="size-3.5 fill-brand text-brand" />
              {r.rating}
            </span>
            <span className="text-muted-foreground">{formatDate(r.receivedAt)}</span>
            {r.answered ? (
              <Badge variant="outline" className="text-micro">
                replied
              </Badge>
            ) : (
              <span className="text-micro font-medium text-warning-on-tint">unanswered</span>
            )}
          </div>
          {/* ⚠️THE CUSTOMER'S OWN WORDS, and a review with no comment is a star
              rating alone — which is said, not filled in with our own text. */}
          {r.excerpt ? (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.excerpt}</p>
          ) : (
            <p className="mt-1 italic text-muted-foreground">No comment — a rating only.</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** `location` narrows the summary to one listing; absent is the whole business. */
export function ReviewSummaryCard({
  location,
  network,
  label,
  onShowAll,
}: {
  location?: string;
  network?: string;
  label?: string | null;
  /** Given when the card is narrowed to one location of several: a way back to all of them. */
  onShowAll?: () => void;
}) {
  const query = useQuery({
    queryKey: [...REVIEW_SUMMARY_QUERY_KEY, location ?? "all", network ?? "default"],
    queryFn: () => presenceApi.reviewSummary(undefined, location, network),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // ⚠️`isPending`, NOT `isLoading`. In react-query v5 `isLoading` is
  // `isPending && isFetching`, so a PAUSED query — the offline case — is
  // neither loading nor errored and would fall through to a card full of
  // absent-state copy, which reads as an answer.
  if (query.isPending) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        {/* ⚠️AN INDEFINITE SKELETON IS NOT AN ANSWER. A paused query never
            resolves and never errors, so without this an offline merchant
            watches a placeholder for ever with nothing to act on — the same
            note the Inbox's own reviews lane carries. */}
        {query.fetchStatus === "paused" && (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for a connection — your reviews will load when you&apos;re back online.
          </p>
        )}
      </Card>
    );
  }

  // ★★A FAILED FETCH IS NOT AN EMPTY LISTING. "No reviews have reached us yet"
  // is a specific claim, and a request that did not complete has not earned it.
  if (query.isError) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your reviews</p>
        <p className="max-w-md text-xs text-muted-foreground">
          This is a problem loading the summary, not a listing with no reviews. Try again in a
          moment.
        </p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  // ★ONE CARD PER NETWORK (PE-R). A rating is a network's own, so a business on two networks sees two cards, each under its network's
  // label, and nothing here adds them. With none connected the api answers an empty list, which is said as "nothing has reached us".
  const summaries = summariesOf(query.data);
  if (summaries.length === 0) {
    const none: ReviewSummary = {
      state: "awaiting_reviews", days: query.data.days, windowStart: query.data.windowStart, totalEver: 0, volume: 0, unanswered: 0, unansweredInWindow: 0,
      sampled: 0, rating: null, ratedCount: 0, respondedCount: 0, timedCount: 0, medianResponseMs: null, worstRecent: [],
    };
    return <NetworkReviews summary={none} label={label ?? null} onShowAll={onShowAll} />;
  }
  return (
    <div className="space-y-4">
      {summaries.map((s) => (
        <NetworkReviews key={s.network ?? "network"} summary={s} label={s.label ?? label ?? null} onShowAll={onShowAll} />
      ))}
    </div>
  );
}

/** One network's reviews: its own rating and counts, under its own name. */
function NetworkReviews({ summary, label, onShowAll }: { summary: ReviewSummary; label: string | null; onShowAll: (() => void) | undefined }) {
  const sections = cardSections(summary);
  const empty = reviewEmptyState(summary, label ?? null);
  const cta = unansweredCta(summary);
  const responseNote = responseCaveat(summary);
  const sampleNote = sampleCaveat(summary);

  // ⚠️`gap-4`, NOT `space-y-4`: Card is already `flex flex-col gap-6`, and
  // twMerge does not reconcile the two groups — the sections sat 40px apart and
  // the skeleton state was taller than the card it replaced.
  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">Reviews</h2>
          <p className="text-xs text-muted-foreground">
            {label ? `${label} · ` : ""}last {summary.days} days
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onShowAll && (
            <Button size="sm" variant="ghost" className="h-8" onClick={onShowAll}>
              All locations
            </Button>
          )}
          {cta && (
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          )}
        </div>
      </div>

      {empty && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">{empty.headline}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{empty.body}</p>
        </div>
      )}

      {/* ★★AN EMPTY WINDOW IS NOT AN EMPTY CARD. `unanswered` is all-time and
          the reply figures are over a different population entirely, so a
          quiet quarter still has both to show — see `cardSections`. */}
      {sections.standingFigures && (
        // ⚠️THE COLUMN COUNT FOLLOWS WHAT IS IN IT. Hard-coded at four, a quiet
        // quarter's two tiles were squeezed into the first two columns with half
        // the card left blank.
        <div
          className={`grid gap-3 ${sections.windowFigures ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}
        >
          {sections.windowFigures && (
            <>
              <Stat
                label="Rating"
                value={ratingLabel(summary)}
                sub={ratingSubLabel(summary)}
                absent="No rated reviews yet"
              />
              <Stat label="Reviews" value={String(summary.volume)} absent="None" />
            </>
          )}
          <Stat
            label="Unanswered"
            value={String(summary.unanswered)}
            sub="all time"
            absent="None"
          />
          <Stat
            label="Usual reply time"
            value={formatResponseTime(summary.medianResponseMs)}
            sub={`over ${summary.timedCount} timed`}
            absent="Not measured yet"
          />
        </div>
      )}

      {(responseNote || sampleNote) && (
        <div className="space-y-1 text-micro text-muted-foreground">
          {responseNote && <p>{responseNote}</p>}
          {sampleNote && <p>{sampleNote}</p>}
        </div>
      )}

      {sections.windowFigures && <WorstList summary={summary} />}
    </Card>
  );
}
