"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useSyncProvider } from "@/hooks/use-sync-provider";
import { useEnqueueJob, useJobs } from "@/hooks/use-jobs";
import { useAuth } from "@/providers/auth-provider";
import { SENTIMENT_CONFIG, SHELF_LIFE_LABELS, label } from "@/lib/content-labels";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { useDataTable, FacetedFilter, DataTablePagination } from "@/components/molecules/data-table";
import type { FacetedFilterOption } from "@/components/molecules/data-table";
import { getContentColumns, type Draft } from "./columns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileX, LayoutGrid, List, Library, BrainCircuit, Plus } from "lucide-react";
import { RepurposeSheet } from "@/components/repurpose/repurpose-sheet";
import type { RepurposeSource } from "@/lib/api/repurpose";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CONTENT_FETCH_LIMIT, ContentStats, GapAnalysis } from "./_components/shared";
import { AdScoreBar, ArticleCard, KpiCard } from "./_components/cards";

// The Intelligence tab is not the first one shown, so its charts load on demand.
const SectorHeatmap = dynamic(() => import("./_components/insight-charts").then((m) => m.SectorHeatmap));
const AudienceBars = dynamic(() => import("./_components/insight-charts").then((m) => m.AudienceBars));

// ── Types ────────────────────────────────────────────────────────

export default function ContentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, business } = useAuth();
  const prefs = user?.preferences ?? null;
  const [view, setView] = useState<"card" | "table">("table");
  // "Write from scratch" CTA busy guard — creates a blank idea then
  // routes into the strategist write flow.
  const [creatingDraft, setCreatingDraft] = useState(false);
  // Sheet state lives at page level so it survives any row re-render
  // during the sheet's open lifecycle.
  const [repurposeSource, setRepurposeSource] = useState<RepurposeSource | null>(null);
  // contentColumns depends on `setRepurposeSource`, which has a stable
  // identity from useState — so the memo invalidates only on prefs
  // change (the row-action callback closes over a stable setter).
  const contentColumns = useMemo(
    () => getContentColumns(prefs, (draftId) => setRepurposeSource({ type: "draft", draftId })),
    [prefs],
  );

  const enqueueJob = useEnqueueJob();
  // useJobs("active") is already mounted at the dashboard layout level
  // for the nav badge; React Query dedupes, so this is a free read.
  const { data: activeJobs } = useJobs("active");

  const { sync: syncBeehiiv, syncing } = useSyncProvider("beehiiv", {
    onEnqueue: () => {
      // Pre-invalidate derived views so when the user returns from the
      // Tasks page the library is fresh by the time the runner has
      // finished. The actual data lands later via the runner; this just
      // marks the cache so the next refetch picks up the new state.
      queryClient.invalidateQueries({ queryKey: ["content-stats"] });
      queryClient.invalidateQueries({ queryKey: ["content-library-all"] });
      queryClient.invalidateQueries({ queryKey: ["content-gaps"] });
    },
  });

  // "Write newsletter from scratch" — create a blank manual idea and
  // route into the strategist write flow (Generate Brief → Write). The
  // generator defaults to the newsletter format when contentFormat is
  // unset, so a title-only idea lands as a newsletter draft. Mirrors the
  // strategist list's New-Idea create-then-navigate pattern.
  async function handleWriteFromScratch() {
    if (creatingDraft) return;
    setCreatingDraft(true);
    try {
      const idea = await api.post<{ _id: string }>("/v1/content/ideas", {
        title: "Untitled newsletter",
      });
      router.push(`/dashboard/strategist/${idea._id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start a new newsletter");
      setCreatingDraft(false);
    }
    // On success we navigate away, so no need to clear creatingDraft.
  }

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["content-stats"],
    queryFn: () => api.get<ContentStats>("/v1/content/stats"),
  });

  // Fetch org taxonomy for dynamic sector/audience labels
  const { data: orgData } = useQuery({
    queryKey: ["dashboard-org"],
    queryFn: () => api.get<{ taxonomy?: { sectors?: string[]; audienceSegments?: { name: string }[]; contentTypes?: string[]; adAngles?: string[] } }>("/v1/dashboard/org"),
    staleTime: 300_000,
  });
  const taxonomySectors = useMemo(() => orgData?.taxonomy?.sectors || [], [orgData]);
  const taxonomyAudiences = useMemo(
    () => (orgData?.taxonomy?.audienceSegments || []).map((a) => typeof a === "string" ? a : a.name),
    [orgData],
  );
  const taxonomyContentTypes = useMemo(() => orgData?.taxonomy?.contentTypes || [], [orgData]);

  // Client-side: fetch last 500 content pieces in one call. Pass
  // includeRepurposeFit=true so the api decorates each row with a
  // rules-based platform-fit band (green/amber/grey) for the per-row
  // Repurpose action color + the "Repurposable" filter chip + the
  // platform-suitability rationale tooltip. No AI cost (rules-only).
  const { data: libraryRes, isLoading: libraryLoading } = useQuery({
    queryKey: ["content-library-all"],
    queryFn: () =>
      api.get<Draft[]>("/v1/content/library", {
        limit: String(CONTENT_FETCH_LIMIT),
        sort: "publishedAt_desc",
        includeRepurposeFit: "true",
      }),
  });

  // Build faceted filter options from taxonomy
  const sentimentOptions: FacetedFilterOption[] = useMemo(
    () => Object.entries(SENTIMENT_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
    [],
  );
  const contentFormatFilterOptions: FacetedFilterOption[] = useMemo(
    () => [
      { value: "newsletter", label: "Newsletter" },
      { value: "article", label: "Article" },
      { value: "advertorial", label: "Advertorial" },
      { value: "pr", label: "PR" },
    ],
    [],
  );
  const contentTypeFilterOptions: FacetedFilterOption[] = useMemo(
    () => taxonomyContentTypes.map((t) => ({ value: t, label: label(undefined, t) })),
    [taxonomyContentTypes],
  );
  const shelfLifeFilterOptions: FacetedFilterOption[] = useMemo(
    () => Object.entries(SHELF_LIFE_LABELS).map(([k, v]) => ({ value: k, label: v })),
    [],
  );

  // useDataTable — client-side sorting, filtering, pagination, faceted counts
  const { table, globalFilter, setGlobalFilter } = useDataTable({
    data: libraryRes || [],
    columns: contentColumns,
    getRowId: (row) => row._id,
    pageSize: 20,
  });

  const { data: gaps } = useQuery({
    queryKey: ["content-gaps"],
    queryFn: () => api.get<GapAnalysis>("/v1/content/gaps"),
  });

  const library = libraryRes || [];
  const hasActiveFilters = table.getState().columnFilters.length > 0 || !!globalFilter;
  const hasUntagged = stats && stats.tagged < stats.total;
  const analysing = enqueueJob.isPending;
  // Disable business-scoped actions until the active business has
  // resolved — prevents the "Pick a business first" toast from firing
  // on a hydration race when stats arrive before AuthProvider does.
  const businessReady = !!business?._id;
  // Backend already dedupes via partial unique index — second click
  // returns the same jobId, no double-spend. But the user gets no
  // feedback after enqueueJob.isPending flips back, so they keep
  // clicking. Gate on whether a content_analyse job is already active.
  // Server filters /v1/jobs by orgId+businessId from JWT, so this is
  // safely scoped per-business. The Job's id is also used to deep-link
  // to /dashboard/tasks for progress.
  const pendingAnalyseJob = useMemo(
    () =>
      activeJobs?.rows?.find(
        (j) =>
          j.kind === "content_analyse" &&
          (j.status === "pending" || j.status === "running"),
      ),
    [activeJobs?.rows],
  );
  const hasPendingAnalyse = !!pendingAnalyseJob;

  /**
   * Enqueue a content_analyse job and redirect to /dashboard/tasks
   * with the new jobId in the URL so the user sees their submission
   * highlighted and can monitor progress. The runner handles the
   * actual fan-out (one tag_drafts child per 10 drafts).
   *
   * `mode` is the reset scope (see content_analyse handler):
   *   "untagged"   — default Analyse-N-untagged button: only process
   *                  drafts with no tags. No reset.
   *   "incomplete" — targeted Re-analyse-N-incomplete button: only
   *                  re-process partial_tagged + transient
   *                  unprocessable. Leaves working "tagged" rows
   *                  untouched. The "finish what didn't land"
   *                  blast-radius the b2c UI exposes.
   *
   * The all-or-nothing legacy mode="all" (wipes EVERY tag and re-tags
   * everything) is NOT exposed in the b2c UI — abuse vector. Ops who
   * need it call the API directly with mode="all" or use the cms
   * drain script (scripts/_drain-quests-tagging.ts).
   *
   * Idempotency: a single stable per-business key. The api's partial
   * unique index on (orgId, idempotencyKey, status:pending|running)
   * means a second submit while the first is still pending|running
   * returns the existing jobId — no double-spend.
   */
  function startAnalysis(mode: "untagged" | "incomplete") {
    if (!business?._id) {
      toast.error("Pick a business first.");
      return;
    }
    enqueueJob.mutate(
      {
        kind: "content_analyse",
        params: { mode },
        idempotencyKey: `content_analyse:${business._id}`,
      },
      {
        onSuccess: (data) => {
          // Refresh content stats once the job lands so the UI doesn't
          // get stuck on stale "untagged" counts after the user returns.
          queryClient.invalidateQueries({ queryKey: ["content-stats"] });
          queryClient.invalidateQueries({ queryKey: ["content-library-all"] });
          queryClient.invalidateQueries({ queryKey: ["content-gaps"] });
          toast.success("Analysis queued — track progress in Tasks.");
          router.push(`/dashboard/tasks?jobId=${data.jobId}`);
        },
        onError: (err: Error) => {
          toast.error(err.message || "Failed to queue analysis. Please try again.");
        },
      },
    );
  }

  function clearFilters() {
    table.resetColumnFilters();
    setGlobalFilter("");
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Cron toolbar — non-prod only. Always visible at the top of
            pages whose data depends on a cron (the canonical
            architecture pattern; see components/dev/cron-toolbar.tsx).
            Beehiiv content depends on three: beehiiv-sync (pulls new
            newsletters), jobs-runner (drains content_analyse children),
            tag-catchup (tags newsletters via the sub-skill path).
            Replaces the inline per-button row that was crammed into
            the header's action row and caused header distortion when
            "Re-analyse N incomplete" wrapped to a second line. */}
        <CronToolbar
          crons={["beehiiv-sync", "jobs-runner", "tag-catchup"]}
          onTriggered={() => {
            queryClient.invalidateQueries({ queryKey: ["content-library-all"] });
            queryClient.invalidateQueries({ queryKey: ["content-stats"] });
          }}
        />
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Content Intelligence
            </h2>
            <p className="text-muted-foreground">
              Your newsletters, AI-tagged and scored for ad potential
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button
              onClick={handleWriteFromScratch}
              disabled={creatingDraft || !businessReady}
              aria-busy={creatingDraft}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {creatingDraft ? "Starting…" : "Write from scratch"}
            </Button>
            <Button
              variant="outline"
              onClick={() => syncBeehiiv()}
              disabled={syncing || !businessReady}
              aria-busy={syncing}
              className="min-w-35"
            >
              {syncing ? "Syncing Beehiiv…" : "Sync Beehiiv"}
            </Button>
            {hasUntagged && (
              <Button
                onClick={() => {
                  // `analysing` (mutation in-flight) takes precedence
                  // over `pendingAnalyseJob`: the active-jobs poll runs
                  // every 10s, so for up to 10s after a job finishes
                  // the rows still contain it. Short-circuiting on the
                  // stale row would deep-link to a finished job
                  // instead of starting the new one the user intends.
                  if (!analysing && pendingAnalyseJob) {
                    router.push(
                      `/dashboard/tasks?jobId=${pendingAnalyseJob._id}`,
                    );
                    return;
                  }
                  startAnalysis("untagged");
                }}
                disabled={analysing || !businessReady}
                variant={
                  hasPendingAnalyse && !analysing ? "secondary" : "default"
                }
              >
                {analysing
                  ? "Queuing…"
                  : hasPendingAnalyse
                    ? "Analysis in progress — view"
                    : `Analyse ${stats.total - stats.tagged} untagged`}
              </Button>
            )}
            {/* Targeted re-tag — only renders when something is actually
                incomplete (partial_tagged + transient-unprocessable). The
                old "Re-analyse all" button wiped EVERY tag and re-ran the
                AI on the working rows too — a foot-gun (~$0.012 × every
                draft per click). The targeted button is bounded by
                `stats.incomplete`, so the worst case is re-processing
                the rows that actually need it. Operators who legitimately
                need to wipe-and-redo everything call mode="all" via the
                API or run scripts/_drain-quests-tagging.ts. */}
            {stats && (stats.incomplete ?? 0) > 0 && (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    disabled={analysing || !businessReady || hasPendingAnalyse}
                  >
                    Re-analyse {stats.incomplete} incomplete
                  </Button>
                }
                title={`Re-analyse ${stats.incomplete} incomplete newsletter${stats.incomplete === 1 ? "" : "s"}`}
                // Per `feedback_ai_costs_cms_only`: AI costs are CMS-only.
                // The previous `~$X.XX (sub-skill path)` exposure was
                // dropped — the user already sees the row count, which is
                // the user-facing signal that matters.
                description={`This will re-process only the ${stats.partialTagged ?? 0} partial-tagged + ${stats.transientUnprocessable ?? 0} transiently-failed newsletters. Working tagged rows are left alone. You can track progress on the Tasks page.`}
                confirmLabel="Re-analyse incomplete"
                onConfirm={() => {
                  // Race guard: the trigger was disabled when this
                  // dialog opened, but the active-jobs poll can land
                  // a fresh content_analyse between trigger-click and
                  // confirm-click. If so, deep-link to it instead of
                  // re-enqueuing (backend would dedupe anyway).
                  if (pendingAnalyseJob) {
                    router.push(
                      `/dashboard/tasks?jobId=${pendingAnalyseJob._id}`,
                    );
                    return;
                  }
                  startAnalysis("incomplete");
                }}
              />
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Content Library"
            value={stats?.total}
            subtitle={stats ? `from ${stats.total > 0 ? "Beehiiv" : "no source"}` : undefined}
            loading={statsLoading}
          />
          <KpiCard
            title="AI Tagged"
            value={stats ? `${stats.taggedPercent}%` : undefined}
            subtitle={stats ? `${stats.tagged} of ${stats.total} articles` : undefined}
            loading={statsLoading}
          />
          <KpiCard
            title="Content Readiness"
            value={stats ? `${stats.contentReadinessScore}` : undefined}
            subtitle="Weighted score (0-100)"
            loading={statsLoading}
            progress={stats?.contentReadinessScore}
          />
          <KpiCard
            title="Ad-Ready"
            value={stats?.highPotential}
            subtitle={`Score 7+ (avg ${stats?.avgAdScore ?? "—"})`}
            loading={statsLoading}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library" className="gap-1.5">
              <Library className="size-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="gap-1.5">
              <BrainCircuit className="size-4" />
              Intelligence
            </TabsTrigger>
          </TabsList>

          {/* ── Library Tab ─────────────────────────────────── */}
          <TabsContent value="library" className="mt-4 space-y-4">
            {/* Toolbar: Search + Faceted Filters + View Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search articles..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-8 w-full lg:w-64"
              />
              <FacetedFilter
                column={table.getColumn("contentFormat")}
                title="Format"
                options={contentFormatFilterOptions}
                align="start"
              />
              <FacetedFilter
                column={table.getColumn("contentType")}
                title="Subtype"
                options={contentTypeFilterOptions}
                align="start"
              />
              <FacetedFilter
                column={table.getColumn("sentiment")}
                title="Sentiment"
                options={sentimentOptions}
                align="start"
              />
              <FacetedFilter
                column={table.getColumn("shelfLife")}
                title="Shelf Life"
                options={shelfLifeFilterOptions}
                align="start"
              />
              {/* "Repurposable" filter — keys on the actions column's
                  accessor (repurposeFit.topBand). Default selection is
                  the most useful single filter ("green" = strong fit on
                  ≥1 connected channel); we leave it as a multi-select
                  so an operator can also include amber ("workable
                  with caveats") if they want a broader pool. */}
              <FacetedFilter
                column={table.getColumn("actions")}
                title="Repurposable"
                options={[
                  { value: "green", label: "Strong fit (green)" },
                  { value: "amber", label: "Workable (amber)" },
                  { value: "grey", label: "Not a fit (grey)" },
                ]}
                align="start"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                  Clear all
                </Button>
              )}

              {/* View toggle */}
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => v && setView(v as "card" | "table")}
                className="ml-auto"
              >
                <ToggleGroupItem value="card" aria-label="Card view" className="h-8 w-8 p-0">
                  <LayoutGrid className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" className="h-8 w-8 p-0">
                  <List className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Loading skeleton */}
            {libraryLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : library.length === 0 ? (
              <EmptyState
                icon={FileX}
                title="No content synced yet"
                description="Connect your Beehiiv account in Settings to get started."
                action={{ label: "Connect integration", href: "/dashboard/integrations" }}
              />
            ) : view === "card" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {table.getRowModel().rows.map((row) => (
                  <ArticleCard
                    key={row.original._id}
                    draft={row.original}
                    onClick={() =>
                      router.push(`/dashboard/content/beehiiv/${row.original._id}`)
                    }
                    onRepurpose={() =>
                      setRepurposeSource({ type: "draft", draftId: row.original._id })
                    }
                  />
                ))}
              </div>
            ) : (
              // `overflow-x-auto` (not overflow-hidden) — the sticky-right
              // actions column needs a scroll container to pin against;
              // overflow-hidden would clip wide columns silently and the
              // sticky positioning would resolve against the document
              // viewport instead of the table's box.
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          // Pull optional per-column header className from
                          // the column def's `meta` (used by the sticky-
                          // right actions column to pin Repurpose to the
                          // viewport edge regardless of overflow).
                          const meta = header.column.columnDef.meta as
                            | { thClassName?: string }
                            | undefined;
                          return (
                            <TableHead key={header.id} className={meta?.thClassName}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          // `group` exposes a hover variant to descendants
                          // — the sticky-right actions cell uses
                          // `group-hover:bg-muted/50` to match the row's
                          // hover background and avoid the sticky-seam
                          // visual artifact.
                          className="group cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/dashboard/content/beehiiv/${row.original._id}`)}
                        >
                          {row.getVisibleCells().map((cell) => {
                            // Same per-column class hook for body cells.
                            // The actions column reads meta.tdClassName to
                            // stay sticky-right; other columns ignore it.
                            const meta = cell.column.columnDef.meta as
                              | { tdClassName?: string }
                              | undefined;
                            return (
                              // Sleekness pass on body row text (2026-05-28
                              // round 2 — user reported "row text looks
                              // bolder, sleekness missing"). The shadcn
                              // Badge primitive bakes `font-medium` into
                              // its base class — every Subtype / Sectors /
                              // Sentiment / Format chip in the row reads as
                              // bold against the lighter surrounding text.
                              // `**:data-[slot=badge]:font-normal!` is the
                              // Tailwind v4 canonical form: `**` matches any
                              // descendant, `data-[slot=badge]` filters to
                              // shadcn's badge data-slot marker, and the
                              // trailing `!` forces specificity over the
                              // baked-in font-medium. Scoped to the Beehiiv
                              // table's TableCells so other tables on the
                              // platform keep their default Badge weight.
                              <TableCell
                                key={cell.id}
                                className={`**:data-[slot=badge]:font-normal! ${meta?.tdClassName ?? ""}`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={contentColumns.length} className="h-24 text-center text-muted-foreground">
                          No articles match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Client-side pagination */}
            {table.getRowModel().rows.length > 0 && (
              <DataTablePagination table={table} />
            )}
          </TabsContent>

          {/* ── Intelligence Tab ──────────────────────────── */}
          <TabsContent value="intelligence" className="mt-4 space-y-6">
            {/* Recommendations */}
            {gaps?.recommendations && gaps.recommendations.length > 0 && (
              <Card className="border-warning/30 bg-warning/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Recommendations</CardTitle>
                  <CardDescription>
                    AI-generated suggestions to improve your content coverage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {gaps.recommendations.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-0.5 h-5 w-5 rounded-full bg-warning/15 text-warning-on-tint flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Sector Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sector Coverage</CardTitle>
                <CardDescription>
                  How your content covers each industry sector
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!gaps?.sectorCoverage?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No tag data yet. Import and tag your newsletters first.
                  </p>
                ) : (
                  <SectorHeatmap data={gaps.sectorCoverage} allSectors={taxonomySectors} />
                )}
              </CardContent>
            </Card>

            {/* Audience Coverage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audience Reach</CardTitle>
                <CardDescription>
                  Which audience segments your content serves
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!gaps?.audienceCoverage?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No tag data yet
                  </p>
                ) : (
                  <AudienceBars data={gaps.audienceCoverage} allAudiences={taxonomyAudiences} />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Keyword Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Keywords</CardTitle>
                  <CardDescription>
                    Most frequent keywords across your content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!gaps?.keywordFrequency?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No keyword data yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {gaps.keywordFrequency.map((kw) => (
                        <Badge
                          key={kw._id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {kw._id}{" "}
                          <span className="ml-1 text-muted-foreground">
                            ({kw.count})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* High Ad-Potential */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Top Ad-Ready Content
                  </CardTitle>
                  <CardDescription>
                    Articles scoring 7+ that could become great ads
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!gaps?.highPotentialUnused?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No high-potential content found yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {gaps.highPotentialUnused.map((item) => (
                        <div
                          key={item.contentId}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-sm truncate max-w-xs">
                            {item.contentTitle}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <AdScoreBar
                              score={item.adPotential.score}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <RepurposeSheet
        open={repurposeSource !== null}
        onOpenChange={(o) => {
          if (!o) setRepurposeSource(null);
        }}
        source={repurposeSource}
      />
    </TooltipProvider>
  );
}

// ── Sub-Components ───────────────────────────────────────────────
