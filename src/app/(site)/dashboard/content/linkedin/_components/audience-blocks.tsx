"use client";

/**
 * The Audience tab's first, second and fourth blocks. The third — who
 * engages — is the existing AQS list in `audience-panel.tsx`.
 *
 * ── ★THESE NUMBERS BEGIN WHEN THE ROLLUP DID ─────────────────────────
 * Everything here comes from `ana_linkedin_community_daily`, written
 * hourly before the 48-hour sweep can reach the rows it is computed
 * from. There is no backfill and there cannot be one: LinkedIn does not
 * serve this history, and the raw rows are gone. So a short series means
 * a young rollup, not a quiet Page — and every block that could be read
 * either way says which it is, from `coverageDays`. Getting that wrong
 * is not a cosmetic problem: it is the difference between "nobody is
 * engaging with us" and "we started measuring on Tuesday".
 *
 * ── ★AND WHY THERE IS NO CHART LIBRARY HERE ──────────────────────────
 * Every one of these is a ranked or proportional list, which the repo
 * already has molecules for. A hand-rolled chart would add a rendering
 * surface, a colour decision and an axis to get wrong, for data whose
 * whole shape is "these categories, these counts".
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/molecules";
// Not re-exported from the barrel — imported directly, like its other
// call sites, rather than widening the barrel as a side effect of this
// change.
import { ProportionListCard } from "@/components/molecules/proportion-list-card";
import { Clock, Heart, MessageSquare, Repeat2, AtSign, Users } from "lucide-react";
import {
  linkedInContentApi,
  type LinkedInAudienceSummary,
  type LinkedInDemographicBucket,
} from "@/lib/api/linkedin-content";
import { ApiError } from "@/lib/api";

/** Reaction type → the word LinkedIn shows for it. An unknown type keeps
 *  its own name rather than vanishing from a list someone is counting. */
const REACTION_LABEL: Record<string, string> = {
  LIKE: "Like",
  PRAISE: "Celebrate",
  EMPATHY: "Love",
  INTEREST: "Insightful",
  APPRECIATION: "Support",
  ENTERTAINMENT: "Funny",
  MAYBE: "Curious",
};

/** How many buckets a facet card shows. Past the top few the counts are
 *  single digits and the question the block answers is already answered. */
const MAX_BUCKETS_PER_FACET = 8;

/** The demographic facets worth showing, in the order a person reads
 *  them: who they are, then what they do, then where. */
const DEMOGRAPHIC_BLOCKS: Array<{ field: string; title: string }> = [
  { field: "followerCountsBySeniority", title: "By seniority" },
  { field: "followerCountsByFunction", title: "By function" },
  { field: "followerCountsByIndustry", title: "By industry" },
  { field: "followerCountsByStaffCountRange", title: "By company size" },
  { field: "followerCountsByGeoCountry", title: "By country" },
];

/**
 * What a block shows when it cannot show numbers.
 *
 * ★NOT `null`. Returning nothing on error deletes the block silently and
 * leaves the window buttons above it looking inert — the user clicks 90d,
 * nothing happens, and there is no way to tell a broken tab from an empty
 * community. A 403 here means no business is selected, which is a thing
 * the person can fix, so it is named rather than absorbed.
 */
function BlockError({ title, error }: { title: string; error: unknown }) {
  const noBusiness = error instanceof ApiError && error.status === 403;
  return (
    <section className="space-y-3">
      <BlockHeading title={title} />
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm font-medium">
            {noBusiness ? "Pick a business to see this" : `Couldn't load ${title.toLowerCase()}`}
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {noBusiness
              ? "Once a business is selected, we'll show how its community has been engaging."
              : "Try again in a moment. Your LinkedIn connection is unaffected — these numbers come from Peakhour, not LinkedIn."}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

export function useAudienceSummary(days: number) {
  return useQuery({
    queryKey: ["linkedin-audience-summary", days],
    queryFn: () => linkedInContentApi.audienceSummary(days),
    // Our own Mongo, not LinkedIn — cheap to refetch, unlike everything
    // else on this pillar.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 2,
  });
}

/**
 * Block 1 — community pulse.
 *
 * Totals plus the reaction mix. The per-day series is deliberately not
 * plotted: with `coverageDays` frequently in single digits, a line chart
 * would draw a trend from three points and imply a precision the data
 * does not have.
 */
export function CommunityPulse({
  summary,
  loading,
  error,
}: {
  summary?: LinkedInAudienceSummary;
  loading: boolean;
  error?: unknown;
}) {
  if (loading) return <BlockSkeleton rows={2} />;
  if (error) return <BlockError title="Community pulse" error={error} />;
  if (!summary) return null;

  const t = summary.totals;
  const reactionItems = Object.entries(t.reactionsByType)
    .map(([type, count]) => ({
      id: type,
      label: REACTION_LABEL[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <section className="space-y-3">
      <BlockHeading
        title="Community pulse"
        coverageDays={summary.coverageDays}
        days={summary.days}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Reactions" value={t.reactions} icon={Heart} />
        <KpiCard title="Comments" value={t.comments} icon={MessageSquare} />
        <KpiCard title="Reposts" value={t.reposts} icon={Repeat2} />
        <KpiCard title="Mentions" value={t.mentions} icon={AtSign} />
      </div>
      <ProportionListCard
        title="Reaction mix"
        items={reactionItems}
        total={t.reactions}
        emptyMessage="No reactions recorded in this window yet."
      />
    </section>
  );
}

/**
 * Block 2 — response health.
 *
 * ★The block nobody else builds, and the only one with an obligation in
 * it. Everything above says how the community behaved; this says whether
 * the business answered.
 */
export function ResponseHealth({
  summary,
  loading,
  error,
}: {
  summary?: LinkedInAudienceSummary;
  loading: boolean;
  error?: unknown;
}) {
  if (loading) return <BlockSkeleton rows={1} />;
  if (error) return <BlockError title="Response health" error={error} />;
  if (!summary) return null;
  const h = summary.responseHealth;

  return (
    <section className="space-y-3">
      {/* ★The badge belongs here as much as on the pulse. Reply rate,
          median first reply and replies-sent are all rollup-derived and
          all window-scoped — a 90-day view backed by three days reports
          an uncaveated reply rate, which is exactly the "not measured
          read as nothing happened" failure this file exists to prevent. */}
      <BlockHeading
        title="Response health"
        coverageDays={summary.coverageDays}
        days={summary.days}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Reply rate"
          // ★"—", not "0%". Null means nothing arrived to answer, which
          // is not a failure to answer it, and this is the number most
          // likely to be screenshotted.
          value={h.replyRate === null ? "—" : `${Math.round(h.replyRate * 100)}%`}
          description={
            h.replyRate === null
              ? "No comments in this window"
              : "Of top-level comments"
          }
        />
        <KpiCard
          title="Median first reply"
          value={h.medianFirstResponseMs === null ? "—" : formatDuration(h.medianFirstResponseMs)}
          description={h.medianFirstResponseMs === null ? "Nothing answered yet" : undefined}
          icon={Clock}
        />
        <KpiCard title="Replies sent" value={h.repliesSent} icon={MessageSquare} />
        <KpiCard
          title="Waiting now"
          value={h.needsReplyOpen}
          // ★The one number this whole surface exists to make impossible
          // to ignore, and it is read live rather than from the rollup.
          description={
            h.oldestUnansweredMs !== null
              ? `Oldest ${formatDuration(h.oldestUnansweredMs)}`
              : "Nothing waiting"
          }
          icon={Users}
        />
      </div>
    </section>
  );
}

/**
 * Block 4 — who follows.
 *
 * ★The largest free win in the plan: this data has been retainable for a
 * year and completely unused. It answers the question the other three
 * blocks cannot — "are the people following us the people we sell to?"
 *
 * Fetched once per tab open and never polled: unlike everything else
 * here it DOES cost a LinkedIn request, against a ~500/day app-wide
 * budget shared with the thread panel and the reactions list.
 */
export function WhoFollows({ orgPageId }: { orgPageId?: string }) {
  const query = useQuery({
    // ★The Page is part of the key, not just the request. Demographics
    // are per Page; a key that omitted it would serve the first Page's
    // breakdown for the second one from cache.
    queryKey: ["linkedin-follower-stats", orgPageId],
    queryFn: () => linkedInContentApi.followerStats(orgPageId as string),
    // ★REQUIRED by the route, which 400s without it before doing anything
    // else. Firing anyway would render the "you publish only to a
    // personal feed" fallback for every Company Page on the platform —
    // a confident wrong answer rather than an error.
    enabled: Boolean(orgPageId),
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 1,
  });

  if (!orgPageId) {
    // Genuinely pageless: the member publishes to their own feed, and
    // LinkedIn has no follower breakdown to give. This is the ONLY
    // situation in which that sentence is true.
    return (
      <section className="space-y-3">
        <BlockHeading title="Who follows" />
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium">No Company Page connected</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              LinkedIn reports follower demographics for Company Pages you
              administer. Personal-feed followers have no breakdown.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (query.isLoading) return <BlockSkeleton rows={2} />;

  const byDemographic = query.data?.byDemographic;
  if (query.isError || !byDemographic) {
    return (
      <section className="space-y-3">
        <BlockHeading title="Who follows" />
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium">Follower demographics unavailable</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              We couldn&apos;t read this Page&apos;s follower breakdown from
              LinkedIn. It needs the page-admin permission, and LinkedIn only
              reports demographics once a Page has enough followers.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  // ★SORTED AND CAPPED. LinkedIn returns these in its own order, which is
  // not by size — a Page spanning sixty industries rendered a sixty-row
  // card with the dominant bucket somewhere in the middle. The reaction
  // mix above was already sorted; these were the same kind of list and
  // were not. The tail is dropped rather than scrolled: past the top few
  // the counts are single digits and the question ("who follows us?")
  // is answered by the head.
  const blocks = DEMOGRAPHIC_BLOCKS.map(({ field, title }) => ({
    title,
    buckets: (byDemographic[field] ?? [])
      .filter((b) => b.organic > 0)
      .sort((a, b) => b.organic - a.organic)
      .slice(0, MAX_BUCKETS_PER_FACET),
  })).filter((b) => b.buckets.length > 0);

  return (
    <section className="space-y-3">
      <BlockHeading title="Who follows" />
      {blocks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium">No follower breakdown yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              LinkedIn reports demographics once a Page has enough followers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {blocks.map(({ title, buckets }) => (
            <ProportionListCard
              key={title}
              title={title}
              items={buckets.map(toItem)}
              total={buckets.reduce((a, b) => a + b.organic, 0)}
              emptyMessage="Nothing reported."
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** A bucket as the proportion card wants it.
 *
 *  ★`label` is what the api resolved from LinkedIn's taxonomy, and it
 *  falls back to the raw id when that lookup failed. Rendering the URN
 *  would be worse than either — unreadable AND indistinguishable from a
 *  bug. */
function toItem(b: LinkedInDemographicBucket) {
  return { id: b.key, label: b.label ?? b.key, count: b.organic };
}

function BlockHeading({
  title,
  coverageDays,
  days,
}: {
  title: string;
  coverageDays?: number;
  days?: number;
}) {
  // ★Shown whenever the window is wider than the data. Without it, a
  // 90-day view holding four days reads as a dead community rather than
  // as a rollup that started on Tuesday — and there is no backfill that
  // will ever close the gap, so the caveat is permanent, not transitional.
  const partial =
    typeof coverageDays === "number" &&
    typeof days === "number" &&
    coverageDays < days;

  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {partial && (
        <Badge variant="outline" className="text-[10px] font-normal">
          {coverageDays} {coverageDays === 1 ? "day" : "days"} measured
        </Badge>
      )}
    </div>
  );
}

function BlockSkeleton({ rows }: { rows: number }) {
  return (
    <section className="space-y-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

/**
 * A duration a person can read at a glance.
 *
 * ★Rounded DOWN to the leading unit on purpose. "2h" for 2h59m
 * understates the wait, and this number exists to prompt action — an
 * overstatement that turned out to be rounding would cost more trust
 * than the precision is worth.
 */
export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
