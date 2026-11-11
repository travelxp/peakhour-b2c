"use client";

import Link from "next/link";
import { useNavIntent } from "@/hooks/use-nav-intent";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { presenceApi } from "@/lib/api/presence";
import { INBOX_REVIEWS_HREF, ratingLabel, ratingSubLabel, REVIEW_SUMMARY_QUERY_KEY } from "@/lib/review-summary";
import { fetchView } from "@/lib/presence-panels";
import {
  limitNote,
  placeName,
  placeNeedsAttention,
  placeNoRatingNote,
  REVIEW_PLACES_QUERY_KEY,
  showAllLimit,
  unansweredLabel,
  unplacedNote,
} from "@/lib/review-places";
import { ReviewSummaryCard } from "@/components/presence/review-summary-card";

/**
 * Every location's reviews side by side (PE-R): each place's rating and count, the place that needs attention first, and the reviews
 * still waiting counted per place.
 *
 * ★★MARKUP ONLY: what may be said, in what order and with which numbers is in `lib/review-places.ts` and in the api's ordering.
 * ★NO TOTAL ROW AND NO OVERALL RATING, by design: figures are never added across places or networks.
 * ★PICKING A PLACE NARROWS THE WHOLE PAGE TO IT (`onPick`), the same switcher the other panels follow.
 * ★WHEN THE API CANNOT SPLIT THE NETWORK BY PLACE (one place, or a network whose reviews do not name their place) THIS DRAWS THE ORDINARY
 * SUMMARY, so the section is never empty for want of a places view.
 */
export function ReviewPlacesCard({
  network,
  label,
  onPick,
}: {
  network?: string;
  label?: string | null;
  /** Narrow the page to this place (its reference, as the location switcher carries it). */
  onPick: (locationName: string) => void;
}) {
  const intent = useNavIntent();
  // ★THE LIMIT IS PER NETWORK: "show all" chosen for one network must not widen another's list when the switcher moves.
  const [limits, setLimits] = useState<Record<string, number>>({});
  const limit = limits[network ?? "default"];
  const query = useQuery({
    queryKey: [...REVIEW_PLACES_QUERY_KEY, network ?? "default", limit ?? "default"],
    queryFn: () => presenceApi.reviewPlaces(undefined, network, limit),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // "Show all" keeps the rows on screen while the longer list loads, instead of dropping to a skeleton. ONLY for the same network: rows of
    // another network are never held up as this one's while it loads.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[REVIEW_PLACES_QUERY_KEY.length] === (network ?? "default") ? previous : undefined),
  });
  // ★FETCHED ALONGSIDE, because whether this network can be split by place is only known from the answer above: when it cannot, the ordinary
  // summary is drawn, and it is already on its way (same key as the summary card), not a third step after the first two.
  useQuery({
    queryKey: [...REVIEW_SUMMARY_QUERY_KEY, "all", network ?? "default"],
    queryFn: () => presenceApi.reviewSummary(undefined, undefined, network),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  // an error with rows in hand keeps the rows and says so; a paused query is not a loading one
  const view = fetchView({ hasData: query.data !== undefined, isPending: query.isPending, isError: query.isError, fetchStatus: query.fetchStatus });

  if (view === "loading" || view === "paused") {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        {view === "paused" && (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for a connection — your reviews will load when you&apos;re back online.
          </p>
        )}
      </Card>
    );
  }
  // ★A FAILED FETCH IS NOT AN EMPTY LIST: say so, and offer the retry.
  if (view === "failed") {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your locations&apos; reviews</p>
        <p className="max-w-md text-xs text-muted-foreground">
          This is a problem loading them, not locations with no reviews. Try again in a moment.
        </p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  const answer = query.data!;
  if (!answer.splittable) return <ReviewSummaryCard network={network} label={label} />;

  const note = limitNote(answer);
  const more = showAllLimit(answer);
  const unplaced = unplacedNote(answer.unplaced, answer.label);

  return (
    <Card className="gap-4 p-5">
      <div>
        <h2 className="font-medium">Reviews by location</h2>
        <p className="text-xs text-muted-foreground">
          {answer.label} · last {answer.days} days · the locations that need attention most are first. Ratings are never averaged across locations.
        </p>
      </div>

      <ul className="space-y-2" aria-label="Reviews by location">
        {answer.places.map((p) => {
          const rating = ratingLabel(p);
          const sub = ratingSubLabel(p);
          return (
            <li key={p.locationName} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{placeName(p)}</p>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onPick(p.locationName)}>
                  Show its reviews
                </Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Rating</p>
                  {rating === null ? (
                    <p className="mt-1 text-sm text-muted-foreground">{placeNoRatingNote(p, answer.days)}</p>
                  ) : (
                    <>
                      <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold tabular-nums">
                        <Star className="size-4 fill-brand text-brand" />
                        {rating}
                      </p>
                      {sub && <p className="text-micro text-muted-foreground">{sub}</p>}
                    </>
                  )}
                </div>
                <div>
                  <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Reviews</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{p.volume}</p>
                  <p className="text-micro text-muted-foreground">in the last {answer.days} days</p>
                </div>
                <div>
                  <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">Waiting</p>
                  {placeNeedsAttention(p) ? (
                    <Badge variant="outline" className="mt-1 text-micro text-warning-on-tint">
                      {unansweredLabel(p)}
                    </Badge>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">{unansweredLabel(p)}</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {view === "data_stale" && (
        <p className="text-micro text-warning-on-tint" role="status">
          We couldn&apos;t refresh these just now, so this is what we had.{" "}
          <button type="button" className="underline" onClick={() => query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {(note || unplaced) && (
        <div className="space-y-1 text-micro text-muted-foreground">
          {note && <p>{note}</p>}
          {unplaced && <p>{unplaced}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {more !== null && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setLimits((l) => ({ ...l, [network ?? "default"]: more }))}>
            Show all {answer.total} locations
          </Button>
        )}
        <Button asChild size="sm" variant="ghost" className="h-8">
          <Link href={INBOX_REVIEWS_HREF} {...intent(INBOX_REVIEWS_HREF)}>Open the reviews inbox</Link>
        </Button>
      </div>
    </Card>
  );
}
