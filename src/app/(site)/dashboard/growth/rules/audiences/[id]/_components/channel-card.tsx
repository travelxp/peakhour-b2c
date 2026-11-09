"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  audienceLibraryApi,
  type AudienceChannelGap,
  type AudienceResolutionResponse,
  type AudienceSet,
} from "@/lib/api/audiences";
import {
  attributeLabel,
  channelNotes,
  gapSentence,
  reachReading,
  platformLabel,
  refreshability,
  resolutionReach,
  shouldAskOnMount,
} from "@/lib/audience-library-rules";

/**
 * What this audience looks like on ONE channel (G3).
 *
 * ★THE SEAM, MADE VISIBLE TO A CUSTOMER INSTEAD OF CLAIMED IN A DOC. "On
 * LinkedIn: 2.4M people. On X: we can't get a count, and these two things can't
 * be expressed there" is the sentence this whole track exists to be able to
 * say.
 *
 * ★AND IT ASKS ONLY WHEN THE ANSWER IS ALREADY PAID FOR. The route is a cache
 * read when the stored entry is CURRENT; on a stale one it takes an org-wide
 * rate-limit token and runs a full typeahead round, a reach call and a write.
 * `shouldAskOnMount` is that distinction, and it is a tested function rather
 * than a `Boolean(known)` — the first cut fired a metered resolution for every
 * pre-E1 entry (stale by construction) just by opening the page.
 */
export function ChannelCard({ set, platform }: { set: AudienceSet; platform: string }) {
  const { business } = useAuth();
  const queryClient = useQueryClient();
  const known = set.channels.find((c) => c.platform === platform);
  const [asked, setAsked] = useState(() => shouldAskOnMount(known));
  const [refreshing, setRefreshing] = useState(false);

  // The business is in the key like every other business-scoped query here:
  // the route is business-scoped server-side, and a key that does not say which
  // business is one cache `clear()` away from rendering another one's answer.
  const queryKey = ["audience-resolution", business?._id ?? "none", set.id, platform] as const;
  const resolution = useQuery({
    queryKey,
    queryFn: () => audienceLibraryApi.getResolution(set.id, platform),
    enabled: asked,
    // The answer is cached server-side into the set; re-asking on every focus
    // would re-run a typeahead round for a page that has not changed.
    staleTime: 5 * 60_000,
    retry: false,
  });

  /**
   * Ask the channel again.
   *
   * ★THE FORCED CALL'S OWN ANSWER IS WHAT GETS RENDERED. A first cut awaited it,
   * THREW THE PAYLOAD AWAY and then issued a second, unforced GET — so
   * `refreshFailed`, which only the attempting call produces, was unreachable
   * on the one path that can produce it, and a stale entry paid for two
   * resolutions per button press.
   *
   * ★AND A FAILURE IS SAID OUT LOUD. With no `catch`, a 429 left the spinner
   * stopping over byte-identical data and nothing else happening — on the one
   * control that can actually trip an org-wide bucket.
   */
  async function refresh() {
    setRefreshing(true);
    try {
      // ★CANCEL FIRST. A focus refetch is in flight exactly when the cached
      // answer is older than `staleTime` — which is the state a customer is in
      // when they press this — and it would land AFTER the forced write with a
      // response carrying no `refreshFailed`: the toast says the refresh failed
      // and the card shows a clean cache hit.
      await queryClient.cancelQueries({ queryKey });
      const fresh = await audienceLibraryApi.getResolution(set.id, platform, { refresh: true });
      queryClient.setQueryData(queryKey, fresh);
      // The forced call WRITES the resolution back server-side, so the parent
      // set's `channels[]` — its staleness, its reach — is now behind. Without
      // this the library list keeps showing the old number and a remount
      // decides whether to ask using flags that have moved.
      void queryClient.invalidateQueries({ queryKey: ["audience-set"] });
      void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
      if (fresh.available && fresh.refreshFailed) {
        toast.warning(`We couldn't ask ${platformLabel(platform)} again.`, {
          description: fresh.refreshFailed.message,
        });
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(
        code === "RATE_LIMITED"
          ? "We're still working out the last one — give it a moment."
          : `We couldn't ask ${platformLabel(platform)} again just now. Nothing was changed.`,
      );
    } finally {
      setRefreshing(false);
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
              {known ? "Check again" : "Check this channel"}
            </Button>
          ) : (
            <RefreshControl data={data} platform={platform} onRefresh={refresh} busy={refreshing} />
          )}
        </div>

        {/* ★TWO DIFFERENT UNASKED STATES, AND A FIRST CUT RENDERED BOTH AS THE
            SECOND. `known` present means we HAVE a stored answer and are simply
            not re-asking for a fresh one — so withholding its reach and its
            gaps made this page know LESS than the library row that links to it,
            which is the opposite of the page's entire premise. `known` absent
            is the real "nobody has asked", which is its own answer and not
            "it doesn't work here". */}
        {!asked && known ? (
          <div className="space-y-2">
            {(() => {
              const reach = reachReading(known);
              const notes = channelNotes(known);
              return (
                <>
                  <p
                    className={
                      reach.kind === "counted" ? "text-sm font-medium" : "text-sm text-muted-foreground"
                    }
                  >
                    {reach.text}
                  </p>
                  {notes.length > 0 && (
                    <p className="text-xs text-muted-foreground">{notes.join(" · ")}</p>
                  )}
                </>
              );
            })()}
            <p className="text-xs text-muted-foreground">
              This is what we worked out last time. Checking asks{" "}
              {platformLabel(platform)} again — it puts nothing on a campaign and spends no
              budget.
            </p>
          </div>
        ) : !asked ? (
          <p className="text-sm text-muted-foreground">
            We haven&apos;t worked out what this audience looks like on{" "}
            {platformLabel(platform)}. Checking asks {platformLabel(platform)} directly — it
            puts nothing on a campaign and spends no budget.
          </p>
        ) : resolution.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
        ) : resolution.isError ? (
          // ★AND A CONTROL, BECAUSE THE COPY PROMISES ONE. `asked` is one-way
          // and `RefreshControl` renders nothing without data, so a rate-limited
          // card told the customer to "ask again" with nothing to press and
          // stayed inert until a full page reload — on the state they reach by
          // doing what the page just told them to.
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {resolution.error instanceof ApiError && resolution.error.code === "RATE_LIMITED"
                ? "We're still working out the last one — give it a moment and ask again."
                : resolution.error instanceof ApiError &&
                    resolution.error.code === "PLATFORM_UNSUPPORTED"
                  ? `We can't build audiences for ${platformLabel(platform)} yet.`
                  : "We couldn't ask just now. Nothing was changed."}
            </p>
            {!(
              resolution.error instanceof ApiError &&
              resolution.error.code === "PLATFORM_UNSUPPORTED"
            ) && (
              <Button size="sm" variant="ghost" onClick={() => void resolution.refetch()}>
                Ask again
              </Button>
            )}
          </div>
        ) : !data ? null : !data.available ? (
          // ★A REFUSAL IS THE ANSWER, RENDERED AS ONE. The api returns 200 with
          // a reason precisely so this is not a broken screen: "this audience
          // is a geography and nothing else, so there's nothing to translate
          // for X" is what the customer asked to know.
          <div className="space-y-2">
            <p className="text-sm">{data.message}</p>
            <GapList gaps={data.gaps} platform={platform} />
            {/* ★AND NOT EVERY REFUSAL IS ABOUT THE AUDIENCE. "Connect LinkedIn
                Ads to see what this looks like there" is a refusal about the
                CONNECTION, and rendering it as a bare sentence leaves a
                first-run business — nothing connected, which is the default
                state of this page — with no way forward from the screen that
                told them. */}
            {CONNECTION_CODES.has(data.code) && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/integrations">Go to integrations</Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void resolution.refetch()}>
                  I&apos;ve done that — check again
                </Button>
              </div>
            )}
            {RETRYABLE_CODES.has(data.code) && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={() => void resolution.refetch()}
              >
                Try again
              </Button>
            )}
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

            {/* ★TWO STATEMENTS, AND A FIRST CUT SHOWED ONLY ONE OF THEM AT A
                TIME. `stale` is about the ENTRY — it cannot be shown to be
                current — and `refreshFailed` is about the CALL. On the
                combination that matters most (a stale entry we then failed to
                refresh) suppressing the first told the customer the refresh
                failed and left them believing what they were reading was
                current. The api reports them separately for exactly this. */}
            {data.stale && data.rematerialisable && (
              <p className="text-xs text-muted-foreground">
                This was worked out by an older version of us, so we can&apos;t promise it&apos;s
                today&apos;s answer
                {/* ★AND NO IMPERATIVE TO PRESS A BUTTON WE KNOW WILL FAIL. When
                    the refresh failed for a reason nothing on this card can fix,
                    "ask again for a fresh one" is an instruction to repeat what
                    just did not work. */}
                {data.refreshFailed ? "." : " — ask again for a fresh one."}
              </p>
            )}
            {data.refreshFailed && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  We couldn&apos;t ask {platformLabel(platform)} again just now, so this is what
                  we had. {data.refreshFailed.message}
                </p>
                {/* ★THE SAME CONNECTION CODES ARRIVE ON THIS PATH TOO, AND A
                    FIRST CUT LOOKED FOR THEM ONLY ON `available: false`. The api
                    returns the CACHED entry whenever one exists — so a business
                    that resolved LinkedIn once and later lost the token got a
                    "reconnect" sentence with no route to Integrations, while a
                    business that had never resolved it got the link. The more
                    common case had the worse answer. */}
                {CONNECTION_CODES.has(data.refreshFailed.code) && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/integrations">Go to integrations</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Refusals whose fix is a connection the customer owns. */
const CONNECTION_CODES = new Set(["NOT_CONNECTED", "NEEDS_REAUTH"]);
/** Refusals that are ours or the platform's, and may simply work next time. */
const RETRYABLE_CODES = new Set(["PROVIDER_FAILED", "TIMED_OUT", "TOKEN_FAILED"]);

/**
 * The refresh control, or the sentence saying why there isn't one.
 *
 * ★A CHANNEL SHAPE NOBODY DERIVED CANNOT BE RE-DERIVED, and the two ways that
 * happens need different sentences: a human built this one, or it was read off
 * a campaign as it ran. Offering the button on either would be a dead control
 * — the api refuses both, `force` included.
 */
function RefreshControl({
  data,
  platform,
  onRefresh,
  busy,
}: {
  data: AudienceResolutionResponse | undefined;
  platform: string;
  onRefresh: () => Promise<void>;
  busy: boolean;
}) {
  if (!data?.available) return null;
  const { canRefresh, reason } = refreshability(data.resolution, {
    rematerialisable: data.rematerialisable,
  });
  if (!canRefresh) return <span className="text-xs text-muted-foreground">{reason}</span>;
  return (
    <Button size="sm" variant="ghost" onClick={() => void onRefresh()} disabled={busy}>
      <RefreshCw className={`mr-1.5 size-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
      {busy ? `Asking ${platformLabel(platform)}…` : "Ask again"}
    </Button>
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
