"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Heart,
  MessageSquare,
  Rocket,
  Share2,
  TrendingUp,
  User,
} from "lucide-react";
import {
  linkedInContentApi,
  type BoostCandidate,
} from "@/lib/api/linkedin-content";
import { BoostCampaignDialog } from "./boost-campaign-dialog";
import { RetentionFootnote } from "./retention-footnote";

/**
 * BoostCandidatesPanel — ranks the business's recently-published
 * LinkedIn posts by boost-worthiness and surfaces the top N.
 *
 * The "Boost" button opens the Boost-to-Campaign dialog (G1): one
 * click turns the ranked post into a REAL LinkedIn campaign — created
 * as a non-spending draft the user activates from the Ads Manager.
 *
 * Lazy-mounted from the LinkedIn dashboard tabs (same pattern as
 * AudiencePanel) so the boost-candidates query doesn't fire on
 * every page load.
 */
export function BoostCandidatesPanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["linkedin-boost-candidates"],
    queryFn: () => linkedInContentApi.boostCandidates(),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 403) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Surface non-403 errors in the dev console for debugging — same
  // pattern as AudiencePanel. The user-facing toast intentionally
  // doesn't echo err.message (provider strings leak internals).
  if (isError && !(error instanceof ApiError && error.status === 403)) {
    console.error("[BoostCandidatesPanel] boost-candidates query failed:", error);
  }

  if (isLoading) {
    return <BoostPanelSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <PanelShell>
          <EmptyBody
            title="Pick a business to see boost candidates"
            body="Once a business is selected, we'll rank its recent LinkedIn posts by how worth-boosting they are."
          />
        </PanelShell>
      );
    }
    return (
      <PanelShell>
        <EmptyBody
          title="Couldn't load boost candidates"
          body="Try refreshing in a moment. If the problem persists, check your LinkedIn connection."
        />
      </PanelShell>
    );
  }

  if (!data || data.candidates.length === 0) {
    // Empty-state path intentionally does NOT forward `truncated` /
    // `eligibleCount` to PanelShell. If it did, the summary line in
    // PanelShell could render "Top 0 of M+ posts considered" when
    // the candidates array is empty but truncated is true (rare:
    // the server hit the 30-post cap, then in-app filters knocked
    // all of them out for low engagement / missing content). That
    // reads worse than the empty-state body alone, so we hide the
    // summary here on purpose.
    return (
      <PanelShell totalConsidered={data?.totalPostsConsidered ?? 0}>
        <EmptyBody
          title="No boost-worthy posts yet"
          body="We score posts 24h–14d old once they pick up at least 5 weighted engagement (likes + 2·comments + 3·shares). New posts will appear here as they mature."
        />
        {data ? (
          <FilteredOutFootnote
            filteredOut={data.filteredOut}
            totalConsidered={data.totalPostsConsidered}
          />
        ) : null}
      </PanelShell>
    );
  }

  return (
    <PanelShell
      totalConsidered={data.totalPostsConsidered}
      eligibleCount={data.eligibleCount}
      truncated={data.truncated}
    >
      <ol className="divide-y">
        {data.candidates.map((c, i) => (
          <BoostCandidateRow key={c.postId} rank={i + 1} candidate={c} />
        ))}
      </ol>
      <FilteredOutFootnote
        filteredOut={data.filteredOut}
        totalConsidered={data.totalPostsConsidered}
      />
      <RetentionFootnote>
        Posts are scored 24h&ndash;14d after publication. Personal-feed
        posts drop out at 48h under LinkedIn&apos;s Members&apos; Social
        Activity rule; Company-Page posts run the full window.
      </RetentionFootnote>
    </PanelShell>
  );
}

function PanelShell({
  children,
  totalConsidered,
  eligibleCount,
  truncated,
}: {
  children: React.ReactNode;
  totalConsidered?: number;
  eligibleCount?: number;
  truncated?: boolean;
}) {
  const summary =
    typeof totalConsidered === "number" && totalConsidered > 0
      ? truncated
        ? `Top ${eligibleCount ?? 0} of ${totalConsidered}+ posts considered (24h–14d window).`
        : typeof eligibleCount === "number"
          ? `${eligibleCount} of ${totalConsidered} posts considered (24h–14d window).`
          : null
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base leading-none font-semibold">
            Boost-worthy posts
          </h3>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide"
            title="Velocity · Audience quality · Hook DNA · Freshness — composite 0-100. Posts are scored from 24 hours to 14 days after publication; for personal-feed posts the effective ceiling is 48 hours under LinkedIn's Members' Social Activity rule. Autonomous ad-spend is on the roadmap; today this is a recommendation surface."
          >
            Recommender
          </Badge>
        </div>
        {summary ? (
          <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function EmptyBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function FilteredOutFootnote({
  filteredOut,
  totalConsidered,
}: {
  filteredOut: {
    missingPerformance: number;
    missingContent: number;
    lowEngagement: number;
    tooFresh: number;
    tooStale: number;
  };
  totalConsidered: number;
}) {
  // Only render counters that actually fire — lowEngagement,
  // missingContent, missingPerformance. tooFresh/tooStale are
  // clock-skew defences that never fire in practice (Mongo
  // pre-filters the age window). Surfacing those would confuse users
  // since the empty-state copy already covers fresh / stale gating.
  const parts: string[] = [];
  if (filteredOut.lowEngagement > 0) {
    parts.push(
      `${filteredOut.lowEngagement} below the engagement floor (5 weighted)`,
    );
  }
  if (filteredOut.missingContent > 0) {
    parts.push(`${filteredOut.missingContent} missing content`);
  }
  if (filteredOut.missingPerformance > 0) {
    parts.push(`${filteredOut.missingPerformance} missing performance data`);
  }
  if (parts.length === 0) return null;
  return (
    <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
      Of {totalConsidered} recent posts examined: {parts.join(", ")}.
    </p>
  );
}

function formatHoursSincePublished(hours: number): string {
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BoostCandidateRow({
  rank,
  candidate,
}: {
  rank: number;
  candidate: BoostCandidate;
}) {
  const [expanded, setExpanded] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const ActorIcon = candidate.authorType === "org" ? Building2 : User;

  return (
    <li className="flex items-start gap-3 py-3">
      <span className="w-6 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {rank}.
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="block w-full text-left"
          aria-expanded={expanded}
        >
          <p
            className={`text-sm font-medium ${expanded ? "" : "line-clamp-2"}`}
            title={expanded ? undefined : candidate.hookExcerpt}
          >
            {candidate.hookExcerpt}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ActorIcon className="size-3 shrink-0" />
            {candidate.authorType === "org" ? "Company page" : "Personal feed"}
          </span>
          <span>{formatHoursSincePublished(candidate.hoursSincePublished)}</span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3 shrink-0" />
            <span className="font-medium text-foreground">
              {candidate.signals.likes}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3 shrink-0" />
            <span className="font-medium text-foreground">
              {candidate.signals.comments}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Share2 className="size-3 shrink-0" />
            <span className="font-medium text-foreground">
              {candidate.signals.shares}
            </span>
          </span>
        </div>
        <p className="text-[11px] italic text-muted-foreground" title={candidate.rationale}>
          {candidate.rationale}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] uppercase tracking-wide">
          <ComponentBadge
            label="Velocity"
            value={candidate.breakdown.velocity}
            max={40}
          />
          <ComponentBadge
            label="Audience"
            value={candidate.breakdown.audienceQuality}
            max={25}
          />
          <ComponentBadge
            label="Hook DNA"
            value={candidate.breakdown.hookDna}
            max={20}
          />
          <ComponentBadge
            label="Freshness"
            value={candidate.breakdown.freshness}
            max={15}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="text-right">
          <div
            className="font-mono text-base font-semibold tabular-nums"
            title={`Velocity ${candidate.breakdown.velocity}/40 · Audience ${candidate.breakdown.audienceQuality}/25 · Hook DNA ${candidate.breakdown.hookDna}/20 (${candidate.signals.hookTier}) · Freshness ${candidate.breakdown.freshness}/15`}
          >
            {candidate.score}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            / 100
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-7 text-xs"
          title="Turn this post into a LinkedIn campaign — created as a non-spending draft you activate from the Ads Manager."
          onClick={() => setBoostOpen(true)}
        >
          <Rocket className="mr-1 size-3" />
          Boost
        </Button>
        {boostOpen ? (
          <BoostCampaignDialog
            open={boostOpen}
            onOpenChange={setBoostOpen}
            postUrn={candidate.linkedInPostUrn}
            defaultName={`Boost: ${candidate.hookExcerpt.slice(0, 80)}`}
          />
        ) : null}
      </div>
    </li>
  );
}

function ComponentBadge({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  // Heat the badge proportionally to how much of the component's
  // weight the post earned — easier to scan than raw numbers.
  const ratio = max > 0 ? value / max : 0;
  const heat =
    ratio >= 0.75
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : ratio >= 0.4
        ? "bg-muted text-foreground"
        : "bg-muted/40 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] ${heat}`}
      title={`${label}: ${value} / ${max}`}
    >
      <TrendingUp className="size-2.5" />
      <span>{label}</span>
      <span className="font-mono tabular-nums">
        {value}/{max}
      </span>
    </span>
  );
}

function BoostPanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-2 h-3 w-64" />
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 py-3">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-7 w-16" />
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
