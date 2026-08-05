"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  audienceLibraryApi,
  type AudienceChannelGap,
  type AudienceSet,
} from "@/lib/api/audiences";
import {
  attributeLabel,
  gapSentence,
  platformLabel,
  refreshability,
  resolutionReach,
} from "@/lib/audience-library-rules";

/**
 * What this audience looks like on ONE channel (G3).
 *
 * ★THE SEAM, MADE VISIBLE TO A CUSTOMER INSTEAD OF CLAIMED IN A DOC. "On
 * LinkedIn: 2.4M people. On X: we can't get a count, and these two things can't
 * be expressed there" is the sentence this whole track exists to be able to
 * say.
 *
 * ★AND IT ASKS ONLY WHEN ASKED. `GET /sets/:id/resolutions/:platform` runs a
 * typeahead round and a reach call, and it WRITES the answer back — so firing
 * it on mount for every channel would spend a customer's rate limit rendering a
 * page. The card opens with what is already stored and offers the question.
 */
export function ChannelCard({
  set,
  platform,
}: {
  set: AudienceSet;
  platform: string;
}) {
  const known = set.channels.find((c) => c.platform === platform);
  /** Nobody asks a channel by accident: the query is disabled until they do,
   *  or until the channel is one we have already resolved (where the answer is
   *  a cache read on the api's side and costs nothing). */
  const [asked, setAsked] = useState(Boolean(known));
  const [refreshing, setRefreshing] = useState(false);

  const resolution = useQuery({
    queryKey: ["audience-resolution", set.id, platform],
    queryFn: () => audienceLibraryApi.getResolution(set.id, platform),
    enabled: asked,
    // The answer is cached server-side into the set; re-asking on every focus
    // would re-run a typeahead round for a page that has not changed.
    staleTime: 5 * 60_000,
    retry: false,
  });

  async function refresh() {
    setRefreshing(true);
    try {
      await audienceLibraryApi.getResolution(set.id, platform, { refresh: true });
    } finally {
      setRefreshing(false);
      void resolution.refetch();
    }
  }

  const data = resolution.data;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{platformLabel(platform)}</h3>
          {!asked ? (
            <Button size="sm" variant="outline" onClick={() => setAsked(true)}>
              <Search className="mr-1.5 size-3.5" aria-hidden="true" />
              Check this channel
            </Button>
          ) : data?.available ? (
            (() => {
              const { canRefresh, reason } = refreshability(data.resolution, {
                rematerialisable: data.rematerialisable,
              });
              return canRefresh ? (
                <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={refreshing}>
                  <RefreshCw
                    className={`mr-1.5 size-3.5 ${refreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {refreshing ? "Asking…" : "Ask again"}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{reason}</span>
              );
            })()
          ) : null}
        </div>

        {/* ★NOBODY HAS ASKED IS ITS OWN ANSWER. Not "it doesn't work here", and
            not a blank — a claim about a customer's reach on a channel nobody
            has queried is the thing this surface exists not to make. */}
        {!asked ? (
          <p className="text-sm text-muted-foreground">
            We haven&apos;t worked out what this audience looks like on{" "}
            {platformLabel(platform)}. Checking asks {platformLabel(platform)} directly — it
            changes nothing and spends nothing.
          </p>
        ) : resolution.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
        ) : resolution.isError ? (
          <p className="text-sm text-muted-foreground">
            {resolution.error instanceof ApiError && resolution.error.code === "RATE_LIMITED"
              ? "We're still working out the last one — give it a moment and ask again."
              : resolution.error instanceof ApiError &&
                  resolution.error.code === "PLATFORM_UNSUPPORTED"
                ? `We can't build audiences for ${platformLabel(platform)} yet.`
                : "We couldn't ask just now. Nothing was changed."}
          </p>
        ) : !data ? null : !data.available ? (
          // ★A REFUSAL IS THE ANSWER, RENDERED AS ONE. The api returns 200 with
          // a reason precisely so this is not a broken screen: "this audience
          // is a geography and nothing else, so there's nothing to translate
          // for X" is what the customer asked to know.
          <div className="space-y-2">
            <p className="text-sm">{data.message}</p>
            <GapList gaps={data.gaps} platform={platform} />
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const reach = resolutionReach(data.resolution, platform);
              return (
                <p className={reach.sourced ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                  {reach.text}
                </p>
              );
            })()}

            {/* What the channel actually bound, in its own words — the readable
                half of the criteria. The criteria themselves are the
                platform's and are deliberately not rendered: a customer cannot
                act on a URN. */}
            {(data.resolution.basis ?? []).length > 0 && (
              <ul className="space-y-1">
                {data.resolution.basis!.map((b) => (
                  <li key={b.attribute} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xs text-muted-foreground">
                      {attributeLabel(b.attribute)}
                    </span>
                    {b.values.map((v, i) => (
                      <Badge
                        key={`${b.attribute}:${i}:${v}`}
                        variant="outline"
                        className="font-normal whitespace-normal"
                      >
                        {v}
                      </Badge>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            <GapList gaps={data.gaps} platform={platform} />

            {/* ★"WE COULDN'T RE-ASK" IS NOT "THIS IS CURRENT". Without saying
                so, a failed refresh is indistinguishable from a cache hit —
                which is why the api reports it separately from `stale`. */}
            {data.refreshFailed && (
              <p className="text-xs text-muted-foreground">
                We couldn&apos;t ask {platformLabel(platform)} again just now, so this is what we
                had. {data.refreshFailed.message}
              </p>
            )}
            {data.stale && !data.refreshFailed && data.rematerialisable && (
              <p className="text-xs text-muted-foreground">
                This was worked out by an older version of us — ask again for today&apos;s answer.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What the channel could not express — by name, never as a count.
 *
 * ★TWO KINDS OF GAP, KEPT APART. "X can't target seniority at all" is a fact
 * about the channel; "X matched 3 of your 5 job titles" is a fact about those
 * values, and it names them. A customer can act on the second and can only
 * plan around the first.
 */
function GapList({ gaps, platform }: { gaps: AudienceChannelGap[]; platform: string }) {
  if (gaps.length === 0) return null;
  return (
    <div className="space-y-1 rounded-md border border-dashed p-2.5">
      <p className="text-xs font-medium">What {platformLabel(platform)} couldn&apos;t express</p>
      <ul className="space-y-1">
        {gaps.map((gap) => (
          <li key={`${gap.attribute}:${gap.variant}`} className="text-xs text-muted-foreground">
            {gapSentence(gap, platform)}
            {gap.values.length > 0 && (
              <span className="block pl-3">
                {gap.values.map((v) => `“${v.value}” — ${v.reason}`).join("; ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
