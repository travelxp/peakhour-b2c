"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, BookMarked, FileSearch, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { UpgradeButton } from "@/components/upgrade/upgrade-button";
import { ApiError } from "@/lib/api";
import { listSources } from "./api";
import { AddSourceDrawer } from "./components/add-source-drawer";
import { InsightsPanel } from "./components/insights-panel";
import { SourceRow } from "./components/source-row";
import type { SourceStatus, TrustedSource } from "./types";

/**
 * Trusted Sources — Phase 0 priority per the LinkedIn 360 plan §3.
 *
 * Ships the Day-1/2 surface: Active tab fully wired against
 * /v1/sources/trusted, status-tab counts, search filter, KPI strip
 * with the metrics computable from the listing payload alone, and
 * the manual Add Source drawer. Suggested + Insights tabs render
 * when data lands but the dedicated Suggested ranker UI + Insights
 * timeline ship in Day-3/4 follow-ups.
 *
 * Gating: behind `content.sources` feature key. Today no plan grants
 * this — the FeatureGate fallback opens the waitlist drawer pre-tagged
 * so signups become signal for the rollout order.
 */

const FEATURE_KEY = "content.sources";
const FEATURE_NAME = "Trusted Sources";
const FEATURE_TAGLINE =
  "Ground every brief, idea, and post in your brand's voice. Add the sites, feeds, channels, and creators your AI should read, watch, and cite.";

/**
 * Status-filtered list tabs are 1:1 with SourceStatus. Aliasing
 * instead of duplicating the union means a future schema addition
 * (e.g., "archived") will TS-error at the `Record<StatusTab, ...>`
 * exhaustiveness check on `byStatus` AND at the `STATUS_TABS` const
 * below — closing the silent-drop gap where a runtime `||` chain
 * would have ignored the new value.
 *
 * `Tab` is the broader union including the Insights view; the
 * Insights tab renders aggregates (not a filtered list) so it sits
 * outside the SourceStatus alias.
 */
type StatusTab = SourceStatus;
type Tab = StatusTab | "insights";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "suggested", label: "Suggested" },
  { value: "rejected", label: "Rejected" },
  { value: "inactive", label: "Inactive" },
];

/**
 * Validate a string against the Tab union — Radix Tabs only emits
 * values from the rendered triggers today, but accepting them via
 * an unchecked cast would defeat the silent-drop guard the
 * StatusTab/Tab split was introduced for. A future caller passing
 * a stray query param into this state would silently land on
 * `"active"` instead of crashing or rendering a broken layout.
 */
function parseTab(v: string): Tab {
  if (v === "insights") return "insights";
  if (STATUS_TABS.some((t) => t.value === v)) return v as StatusTab;
  return "active";
}

export default function TrustedSourcesPage() {
  return (
    <FeatureGate
      feature={FEATURE_KEY}
      featureName={FEATURE_NAME}
      featureTagline={FEATURE_TAGLINE}
      mode="hide"
      fallback={<TrustedSourcesLockedFallback />}
    >
      <TrustedSourcesSurface />
    </FeatureGate>
  );
}

function TrustedSourcesSurface() {
  // Pull all rows up front (cap at 200 — current schema validation
  // ceiling on the listing endpoint). Per-status counts come from
  // the in-memory split below; saves four sequential round-trips
  // every time the page mounts. If a tenant grows past 200 sources
  // the Day-5 server-side pagination tab handles it.
  //
  // `retry: false` so a 401 from a not-yet-ready session or a 400
  // from a missing-business principal surfaces immediately instead
  // of looking like a slow load. The auth-provider is the right
  // place to wait on session boot; this page just renders what we
  // know.
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["trusted-sources", { limit: 200 }],
    queryFn: () => listSources({ limit: 200 }),
    retry: false,
    // Trusted sources change at 15-minute fetcher cadence at most;
    // 30s of staleness avoids the tab-switch refetch storm that
    // would otherwise rebuild every memo and remount the per-row
    // "Xm ago" intervals.
    staleTime: 30_000,
  });

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");

  // Memoize the row list against `data` directly so the deps array
  // for `byStatus` doesn't change on every render (a fresh `?? []`
  // expression yields a new array reference each call).
  const rows = useMemo<TrustedSource[]>(() => data?.rows ?? [], [data]);

  const byStatus = useMemo(() => {
    const groups: Record<StatusTab, TrustedSource[]> = {
      active: [],
      suggested: [],
      rejected: [],
      inactive: [],
    };
    // StatusTab is aliased to SourceStatus, so every r.status is a
    // valid groups[] key by construction. If the schema gains a new
    // status, the Record<StatusTab,…> initialiser above will fail
    // exhaustiveness — that's the desired error surface, not this
    // loop.
    for (const r of rows) {
      groups[r.status].push(r);
    }
    return groups;
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (tab === "insights") return [];
    const list = byStatus[tab];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.identifier.toLowerCase().includes(q),
    );
  }, [byStatus, tab, search]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trusted Sources</h2>
          <p className="text-muted-foreground">
            What your AI reads, watches, and cites.
          </p>
        </div>
        <AddSourceDrawer />
      </header>

      <KpiStrip rows={rows} loading={isLoading} />

      <Tabs value={tab} onValueChange={(v) => setTab(parseTab(v))}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.label}
                <Badge variant="secondary" className="rounded-sm px-1.5 text-[10px]">
                  {byStatus[t.value].length}
                </Badge>
              </TabsTrigger>
            ))}
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          {/* Search filters the row list — irrelevant on Insights, so
              it hides there to avoid implying "search the aggregates". */}
          {tab !== "insights" && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or URL"
              className="h-9 w-full sm:w-72"
            />
          )}
        </div>

        {/* aria-busy on the list region so screen-reader users learn
            when a background revalidation (post-mutation invalidate
            or focus refetch) is in flight — the visual list goes
            stale for ~1s with no indicator without this. */}
        <div className="mt-4" aria-busy={isFetching && !isLoading}>
          {isLoading ? (
            <RowSkeletons />
          ) : isError ? (
            <ErrorCard error={error} />
          ) : tab === "insights" ? (
            <InsightsPanel rows={rows} />
          ) : visibleRows.length === 0 ? (
            <EmptyState tab={tab} hasAnySources={rows.length > 0} hasSearch={Boolean(search.trim())} />
          ) : (
            <div className="space-y-2">
              {visibleRows.map((r) => (
                <SourceRow key={r._id} source={r} />
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

/**
 * KPI strip — four cards per the §3.4 spec. Two metrics are derivable
 * from the listing payload and ship live; two need backend telemetry
 * surfaces that don't exist yet (citations-30d depends on a count
 * over `cnt_source_usage`; coverage-score is a proprietary scoring
 * surface — see plan §3.4 + §6 algo #4) and ship as `—` placeholders
 * with a tooltip-eligible muted state until the endpoint lands.
 */
function KpiStrip({ rows, loading }: { rows: TrustedSource[]; loading: boolean }) {
  const activeCount = rows.filter((r) => r.status === "active").length;

  // 24h fetch health — ratio of recent-success vs recent-failure on
  // active sources. consecutiveFetchFailures resets to 0 on success,
  // so a non-zero value across active sources is the "needs attention"
  // signal. Display as "{healthy}/{total}" so a dropping ratio is
  // visible at a glance.
  const active = rows.filter((r) => r.status === "active");
  const healthy = active.filter((r) => (r.consecutiveFetchFailures ?? 0) === 0).length;
  const fetchHealth = active.length === 0 ? "—" : `${healthy}/${active.length}`;

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Active sources"
        value={activeCount}
        description="Currently feeding the AI"
        icon={BookMarked}
      />
      <KpiCard
        title="Fetch health"
        value={fetchHealth}
        description="Active sources fetched without failure"
        icon={Activity}
      />
      <KpiCard
        title="Citations (30d)"
        value="—"
        description="Lands when usage telemetry ships"
        icon={FileSearch}
      />
      <KpiCard
        title="Coverage score"
        value="—"
        description="Proprietary; algo in design"
        icon={Sparkles}
      />
    </div>
  );
}

/**
 * Error card for the listing fetch — distinguishes the most common
 * failure modes (no active business / unauthenticated) from generic
 * errors so the user sees an actionable message instead of "0
 * sources" with no explanation.
 */
function ErrorCard({ error }: { error: unknown }) {
  const isApi = error instanceof ApiError;
  const status = isApi ? error.status : 0;
  const message = isApi ? error.message : "Could not load trusted sources.";

  // 400 + scope mention from the backend = no business selected
  // (the route's principal-narrowing branch returns
  // "Missing principal scope"). Surface a switcher hint instead of
  // dumping the raw API message.
  const hint =
    status === 400 && /scope/i.test(message)
      ? "Pick a business from the switcher to see its sources."
      : status === 401
        ? "Your session expired. Refresh the page to sign back in."
        : null;

  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-6">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Couldn&apos;t load sources</p>
          <p className="text-sm text-muted-foreground">{hint ?? message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RowSkeletons() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

function EmptyState({
  tab,
  hasAnySources,
  hasSearch,
}: {
  tab: StatusTab;
  hasAnySources: boolean;
  hasSearch: boolean;
}) {
  if (hasSearch) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No sources match that search in this tab.
        </CardContent>
      </Card>
    );
  }
  if (tab === "active" && !hasAnySources) {
    // First-time empty state per the §3.4 spec — soft nudge ("explore
    // first"), not a blocking modal. Per the open-questions log in
    // §14, this lean was already chosen.
    return (
      <Card>
        <CardContent className="space-y-2 py-12 text-center">
          <p className="text-sm font-medium">Your AI is using only platform-default sources.</p>
          <p className="text-sm text-muted-foreground">
            Add 5–10 trusted sources to ground every brief in your brand&apos;s voice.
          </p>
        </CardContent>
      </Card>
    );
  }
  const copy: Record<StatusTab, string> = {
    active: "Nothing active yet — add a source to start grounding briefs.",
    suggested: "No suggested sources right now. The recommender adds candidates as your content grows.",
    rejected: "Nothing rejected. Sources you reject from the Suggested tab show up here.",
    inactive: "No paused sources.",
  };
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {copy[tab]}
      </CardContent>
    </Card>
  );
}

function TrustedSourcesLockedFallback() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Trusted Sources</h2>
        <p className="text-muted-foreground">
          What your AI reads, watches, and cites.
        </p>
      </header>
      <Card className="border-amber-200 bg-linear-to-br from-amber-50/60 to-white dark:border-amber-900/40 dark:from-amber-950/30 dark:to-transparent">
        <CardContent className="space-y-3 p-8 text-center">
          <Sparkles aria-hidden="true" className="mx-auto size-8 text-amber-600 dark:text-amber-400" />
          <h3 className="text-lg font-semibold tracking-tight">Trusted Sources is rolling out</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {FEATURE_TAGLINE}
          </p>
          <div className="pt-1">
            <UpgradeButton
              featureKey={FEATURE_KEY}
              featureName={FEATURE_NAME}
              featureTagline={FEATURE_TAGLINE}
            >
              Join waitlist
            </UpgradeButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
