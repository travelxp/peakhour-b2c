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
  formatResponseTime,
  ratingLabel,
  ratingSubLabel,
  responseCaveat,
  reviewEmptyState,
  sampleCaveat,
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
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {value === null ? (
        <p className="mt-1 text-sm text-muted-foreground">{absent}</p>
      ) : (
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      )}
      {value !== null && sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function WorstList({ summary }: { summary: ReviewSummary }) {
  const { formatDate } = useLocale();
  if (summary.worstRecent.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
              <Badge variant="outline" className="text-[10px]">
                replied
              </Badge>
            ) : (
              <span className="text-[11px] font-medium text-warning-on-tint">unanswered</span>
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

export function ReviewSummaryCard() {
  const query = useQuery({
    queryKey: ["presence-review-summary"],
    queryFn: () => presenceApi.reviewSummary(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // ⚠️`isPending`, NOT `isLoading`. In react-query v5 `isLoading` is
  // `isPending && isFetching`, so a PAUSED query — the offline case — is
  // neither loading nor errored and would fall through to a card full of
  // absent-state copy, which reads as an answer.
  if (query.isPending) {
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
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

  const summary = query.data;
  const empty = reviewEmptyState(summary);
  const cta = unansweredCta(summary);
  const responseNote = responseCaveat(summary);
  const sampleNote = sampleCaveat(summary);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">Reviews</h2>
          <p className="text-xs text-muted-foreground">
            Google Business Profile · last {summary.days} days
          </p>
        </div>
        {cta && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        )}
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">{empty.headline}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{empty.body}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              label="Rating"
              value={ratingLabel(summary)}
              sub={ratingSubLabel(summary)}
              absent="No rated reviews yet"
            />
            <Stat label="Reviews" value={String(summary.volume)} absent="None" />
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

          {(responseNote || sampleNote) && (
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {responseNote && <p>{responseNote}</p>}
              {sampleNote && <p>{sampleNote}</p>}
            </div>
          )}

          <WorstList summary={summary} />
        </>
      )}
    </Card>
  );
}
