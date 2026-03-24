"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, API_BASE_URL } from "@/lib/api";
import {
  CONTENT_CATEGORY_LABELS,
  SENTIMENT_CONFIG,
  SHELF_LIFE_LABELS,
  label,
} from "@/lib/content-labels";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────

interface TagSummary {
  sectors: { name: string; weight: number }[];
  companies: { name: string; role: string; sentiment?: string }[];
  contentType: string;
  sentiment: string;
  shelfLife: string;
  adPotentialScore: number;
  adPotentialAngle?: string;
  topKeywords: string[];
  audienceRelevance: { segment: string; relevance: number }[];
}

interface Draft {
  _id: string;
  title: string;
  subtitle?: string;
  source: string;
  status: string;
  publishedAt: string;
  webUrl?: string;
  thumbnailUrl?: string;
  readingTimeMin?: number;
  tags: TagSummary | null;
}

interface ContentStats {
  total: number;
  tagged: number;
  taggedPercent: number;
  highPotential: number;
  avgAdScore: number;
  evergreenPercent: number;
  sectorDiversity: number;
  contentReadinessScore: number;
  shelfLifeDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
}

interface GapAnalysis {
  sectorCoverage: { _id: string; count: number; avgWeight: number }[];
  audienceCoverage: { _id: string; count: number; avgRelevance: number }[];
  highPotentialUnused: {
    contentId: string;
    contentTitle: string;
    adPotential: { score: number; bestAngle?: string; bestHook?: string };
    sectors: { name: string; weight: number }[];
  }[];
  keywordFrequency: { _id: string; count: number }[];
  contentTypeDistribution: { _id: string; count: number }[];
  shelfLifeDistribution: { _id: string; count: number }[];
  recommendations: string[];
}

// ── Filters ──────────────────────────────────────────────────────

interface Filters {
  search: string;
  sector: string;
  contentType: string;
  sentiment: string;
  shelfLife: string;
  minAdScore: string;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  sector: "",
  contentType: "",
  sentiment: "",
  shelfLife: "",
  minAdScore: "",
  sort: "publishedAt_desc",
};

// ── Main Page ────────────────────────────────────────────────────

interface AnalyseProgress {
  tagged: number;
  total: number;
  remaining: number;
  batchNum: number;
  currentTitle: string;
  currentStatus: "tagged" | "partial" | "error";
}

export default function ContentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"card" | "table">("table");
  const [page, setPage] = useState(1);
  const [analysing, setAnalysing] = useState(false);
  const [analyseProgress, setAnalyseProgress] = useState<AnalyseProgress | null>(null);
  const [analyseResult, setAnalyseResult] = useState<string | null>(null);

  const queryParams: Record<string, string> = {
    page: String(page),
    limit: view === "card" ? "12" : "20",
  };
  if (filters.search) queryParams.search = filters.search;
  if (filters.sector) queryParams.sector = filters.sector;
  if (filters.contentType) queryParams.contentType = filters.contentType;
  if (filters.sentiment) queryParams.sentiment = filters.sentiment;
  if (filters.shelfLife) queryParams.shelfLife = filters.shelfLife;
  if (filters.minAdScore) queryParams.minAdScore = filters.minAdScore;
  if (filters.sort) queryParams.sort = filters.sort;

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
  const taxonomySectors = orgData?.taxonomy?.sectors || [];
  const taxonomyAudiences = (orgData?.taxonomy?.audienceSegments || []).map((a) => typeof a === "string" ? a : a.name);
  const taxonomyContentTypes = orgData?.taxonomy?.contentTypes || [];
  // Build dynamic label maps from taxonomy
  const sectorOptions: [string, string][] = taxonomySectors.map((s) => [s, label(undefined, s)]);
  const contentTypeOptions: [string, string][] = taxonomyContentTypes.map((t) => [t, label(undefined, t)]);

  const { data: libraryRes, isLoading: libraryLoading } = useQuery({
    queryKey: ["content-library", queryParams],
    queryFn: () =>
      api.get<Draft[]>("/v1/content/library", queryParams),
  });

  const { data: gaps } = useQuery({
    queryKey: ["content-gaps"],
    queryFn: () => api.get<GapAnalysis>("/v1/content/gaps"),
  });

  const library = libraryRes || [];
  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) => v && k !== "sort"
  );
  const hasUntagged = stats && stats.tagged < stats.total;
  const cancelRef = useRef(false);

  const startAnalysis = useCallback((force: boolean) => {
    setAnalysing(true);
    setAnalyseProgress(null);
    setAnalyseResult(null);
    cancelRef.current = false;

    const url = `${API_BASE_URL}/v1/content/analyse${force ? "?force=true" : ""}`;

    // Use fetch with ReadableStream for SSE (EventSource doesn't send cookies)
    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          setAnalyseResult(json?.error?.message || "Failed to start analysis.");
          setAnalysing(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setAnalyseResult("Streaming not supported.");
          setAnalysing(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let eventType = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelRef.current) {
            reader.cancel();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // SSE format: "event: X\ndata: Y\nid: Z\n\n"
          // Split on double newline to get complete events
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // Last element is incomplete

          for (const event of events) {
            const lines = event.split("\n");
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) data = line.slice(5).trim();
            }

            if (!data) continue;
            try {
              const parsed = JSON.parse(data);

              if (eventType === "progress") {
                setAnalyseProgress({
                  tagged: parsed.tagged,
                  total: parsed.total,
                  remaining: parsed.remaining,
                  batchNum: 0,
                  currentTitle: parsed.title,
                  currentStatus: parsed.status,
                });
              } else if (eventType === "complete") {
                setAnalyseResult(
                  `All done! ${parsed.tagged} newsletters tagged with AI insights.` +
                  (parsed.skipped > 0 ? ` ${parsed.skipped} partially tagged.` : "") +
                  (parsed.errors > 0 ? ` ${parsed.errors} failed.` : "")
                );
              }
            } catch { /* skip malformed events */ }
          }
        }

        if (cancelRef.current) {
          setAnalyseResult("Analysis cancelled. Click Analyse to continue with remaining.");
        }

        queryClient.invalidateQueries({ queryKey: ["content-stats"] });
        queryClient.invalidateQueries({ queryKey: ["content-library"] });
        queryClient.invalidateQueries({ queryKey: ["content-gaps"] });
        setAnalysing(false);
      })
      .catch(() => {
        setAnalyseResult("Analysis failed. Please try again.");
        setAnalysing(false);
      });
  }, [queryClient]);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
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
          <div className="flex gap-2">
            {hasUntagged && !analysing && (
              <Button onClick={() => startAnalysis(false)}>
                Analyse {stats.total - stats.tagged} untagged
              </Button>
            )}
            {!analysing && stats && stats.tagged > 0 && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">Re-analyse all</Button>
                }
                title="Re-analyse all content"
                description="This will delete all existing AI tags and re-analyse every newsletter from scratch. This may take a while."
                confirmLabel="Re-analyse"
                variant="destructive"
                onConfirm={() => startAnalysis(true)}
              />
            )}
            {analysing && (
              <Button variant="outline" onClick={() => { cancelRef.current = true; }}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Analysis progress */}
        {(analysing || analyseResult) && (
          <Card className={analyseResult ? "border-green-200 bg-green-50/50" : "border-blue-200 bg-blue-50/50"}>
            <CardContent className="py-3 px-4">
              {analysing && analyseProgress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-md">
                      {analyseProgress.currentStatus === "tagged" ? "✓" : analyseProgress.currentStatus === "partial" ? "◐" : "✗"}{" "}
                      <span className="font-medium">{analyseProgress.currentTitle}</span>
                    </span>
                    <span className="text-muted-foreground font-medium shrink-0 ml-2">
                      {analyseProgress.tagged} / {analyseProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={analyseProgress.total > 0 ? (analyseProgress.tagged / analyseProgress.total) * 100 : 0}
                    className="h-2"
                  />
                </div>
              ) : analysing ? (
                <AnalysingPlaceholder />
              ) : analyseResult ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{analyseResult}</p>
                  <Button variant="ghost" size="sm" onClick={() => setAnalyseResult(null)}>
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

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
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          </TabsList>

          {/* ── Library Tab ─────────────────────────────────── */}
          <TabsContent value="library" className="mt-4 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search articles..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="w-48"
              />
              <FilterSelect
                placeholder="Sector"
                value={filters.sector}
                onChange={(v) => updateFilter("sector", v)}
                options={sectorOptions}
              />
              <FilterSelect
                placeholder="Type"
                value={filters.contentType}
                onChange={(v) => updateFilter("contentType", v)}
                options={contentTypeOptions}
              />
              <FilterSelect
                placeholder="Sentiment"
                value={filters.sentiment}
                onChange={(v) => updateFilter("sentiment", v)}
                options={Object.entries(SENTIMENT_CONFIG).map(([k, v]) => [k, v.label])}
              />
              <FilterSelect
                placeholder="Min Ad Score"
                value={filters.minAdScore}
                onChange={(v) => updateFilter("minAdScore", v)}
                options={[["5", "5+"], ["6", "6+"], ["7", "7+"], ["8", "8+"], ["9", "9+"]]}
              />
              <Select value={filters.sort} onValueChange={(v) => updateFilter("sort", v)}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publishedAt_desc">Newest first</SelectItem>
                  <SelectItem value="publishedAt_asc">Oldest first</SelectItem>
                  <SelectItem value="adScore_desc">Highest ad score</SelectItem>
                  <SelectItem value="title_asc">Title A-Z</SelectItem>
                </SelectContent>
              </Select>

              {/* View toggle */}
              <div className="ml-auto flex gap-1">
                <Button
                  variant={view === "card" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("card")}
                >
                  Cards
                </Button>
                <Button
                  variant={view === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("table")}
                >
                  Table
                </Button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Active filters:
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}

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
              <Card>
                <CardContent className="py-16 text-center">
                  <p className="text-lg font-medium mb-2">
                    {hasActiveFilters
                      ? "No articles match your filters"
                      : "No content synced yet"}
                  </p>
                  <p className="text-muted-foreground text-sm mb-4">
                    {hasActiveFilters
                      ? "Try adjusting your filters or clearing them."
                      : "Connect your Beehiiv account in Settings to get started."}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : view === "card" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {library.map((draft) => (
                  <ArticleCard
                    key={draft._id}
                    draft={draft}
                    onClick={() =>
                      router.push(`/dashboard/content/${draft._id}`)
                    }
                  />
                ))}
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sectors</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Ad Score</TableHead>
                      <TableHead>Shelf Life</TableHead>
                      <TableHead>Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {library.map((draft) => (
                      <TableRow
                        key={draft._id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          router.push(`/dashboard/content/${draft._id}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {draft.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {label(undefined,draft.tags?.contentType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {draft.tags?.sectors?.slice(0, 2).map((s) => (
                              <Badge
                                key={s.name}
                                variant="secondary"
                                className="text-xs"
                              >
                                {label(undefined,s.name)}
                              </Badge>
                            )) ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SentimentBadge value={draft.tags?.sentiment} />
                        </TableCell>
                        <TableCell>
                          <AdScoreBar score={draft.tags?.adPotentialScore} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {label(SHELF_LIFE_LABELS, draft.tags?.shelfLife)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {draft.publishedAt
                            ? new Date(draft.publishedAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Pagination */}
            {library.length > 0 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={library.length < (view === "card" ? 12 : 20)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Intelligence Tab ──────────────────────────── */}
          <TabsContent value="intelligence" className="mt-4 space-y-6">
            {/* Recommendations */}
            {gaps?.recommendations && gaps.recommendations.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
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
                        <span className="mt-0.5 h-5 w-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">
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
    </TooltipProvider>
  );
}

// ── Sub-Components ───────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  loading,
  progress: progressValue,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  loading?: boolean;
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold mt-1">{value ?? "—"}</p>
            {progressValue !== undefined && (
              <Progress value={progressValue} className="h-1.5 mt-2" />
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
      <SelectTrigger className="w-36 h-9 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All</SelectItem>
        {options.map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ArticleCard({
  draft,
  onClick,
}: {
  draft: Draft;
  onClick: () => void;
}) {
  const t = draft.tags;
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {draft.thumbnailUrl && (
        <div className="h-32 overflow-hidden rounded-t-lg">
          <img
            src={draft.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 leading-snug">
          {draft.title}
        </h3>
        {draft.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {draft.subtitle}
          </p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap gap-1">
          {t?.contentType && (
            <Badge variant="outline" className="text-xs">
              {label(undefined,t.contentType)}
            </Badge>
          )}
          <SentimentBadge value={t?.sentiment} />
          {t?.sectors?.slice(0, 2).map((s) => (
            <Badge key={s.name} variant="secondary" className="text-xs">
              {label(undefined,s.name)}
            </Badge>
          ))}
        </div>

        {/* Ad score bar */}
        <div className="flex items-center justify-between">
          <AdScoreBar score={t?.adPotentialScore} />
          <span className="text-xs text-muted-foreground">
            {draft.publishedAt
              ? new Date(draft.publishedAt).toLocaleDateString()
              : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function AdScoreBar({ score }: { score?: number }) {
  if (score == null)
    return (
      <span className="text-xs text-muted-foreground">Not scored</span>
    );

  const color =
    score >= 8
      ? "bg-green-500"
      : score >= 6
        ? "bg-amber-500"
        : score >= 4
          ? "bg-orange-400"
          : "bg-red-400";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${score * 10}%` }}
            />
          </div>
          <span className="text-xs font-medium">{score}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Ad Potential Score: {score}/10</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ~17s per AI call (Haiku 4.5) for first chunk of 5.
// 12 messages × 2.5s = 30s coverage (17s + 75% buffer) before first result streams.
const LOADING_MESSAGES = [
  "Warming up AI engines...",
  "Reading your content library...",
  "Sending content to AI for analysis...",
  "Identifying industry sectors...",
  "Mapping companies and people mentioned...",
  "Extracting key metrics and data points...",
  "Scoring ad potential for each article...",
  "Mapping audience relevance per segment...",
  "Analysing sentiment and urgency...",
  "Cross-referencing with your taxonomy...",
  "Finalising 12-dimension analysis...",
  "Almost there — first results coming...",
];

function AnalysingPlaceholder() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm animate-pulse">{LOADING_MESSAGES[msgIndex]}</p>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-primary/40 animate-[shimmer_2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

function SentimentBadge({ value }: { value?: string }) {
  if (!value) return null;
  const config = SENTIMENT_CONFIG[value];
  if (!config) return <Badge variant="outline" className="text-xs">{value}</Badge>;
  return (
    <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
      {config.label}
    </Badge>
  );
}

/** Normalize a string for comparison: lowercase, strip special chars */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Check if two strings match by normalized form or substring containment */
function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function SectorHeatmap({
  data,
  allSectors,
}: {
  data: { _id: string; count: number; avgWeight: number }[];
  allSectors: string[];
}) {
  // Taxonomy is the single source of truth. Match tag data to taxonomy entries
  // using fuzzy matching (e.g., tag "aviation" matches taxonomy "Airlines & Aviation").
  // Unmatched tag data gets its own entry at the end.
  const usedTagIds = new Set<string>();

  function findTagData(taxonomyValue: string) {
    let total = { count: 0, avgWeight: 0, matched: 0 };
    for (const d of data) {
      if (fuzzyMatch(taxonomyValue, d._id)) {
        total.count += d.count;
        total.avgWeight += d.avgWeight * d.count;
        total.matched++;
        usedTagIds.add(d._id);
      }
    }
    if (total.matched === 0) return null;
    return { count: total.count, avgWeight: total.avgWeight / total.count };
  }

  const sectors = allSectors.length > 0 ? allSectors : data.map((d) => d._id);

  // Deduplicate taxonomy entries
  const seen = new Set<string>();
  const uniqueSectors = sectors.filter((s) => {
    const norm = normalize(s);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  // Pre-compute tag data FIRST — this populates usedTagIds via findTagData calls
  const sectorData = uniqueSectors.map((sector) => ({
    name: sector,
    data: findTagData(sector),
  }));

  // THEN find unmatched — usedTagIds is now populated
  const unmatched = data.filter((d) => !usedTagIds.has(d._id));

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (sectorData.length === 0 && unmatched.length === 0) {
    return <p className="text-sm text-muted-foreground">No sectors configured or tagged yet.</p>;
  }

  // Append unmatched tag data
  for (const d of unmatched) {
    sectorData.push({ name: d._id, data: { count: d.count, avgWeight: d.avgWeight } });
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {sectorData.map(({ name: sector, data: d }) => {
        const count = d?.count ?? 0;
        const intensity = count > 0 ? Math.max(0.1, count / maxCount) : 0;
        const bg =
          count === 0
            ? "bg-red-50 border-red-200"
            : intensity > 0.6
              ? "bg-green-100 border-green-300"
              : intensity > 0.3
                ? "bg-amber-50 border-amber-200"
                : "bg-orange-50 border-orange-200";

        return (
          <Tooltip key={sector}>
            <TooltipTrigger asChild>
              <div
                className={`rounded-lg border p-2 text-center transition-colors ${bg}`}
              >
                <p className="text-xs font-medium leading-tight">
                  {label(undefined,sector)}
                </p>
                <p className="text-lg font-bold mt-0.5">{count}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {label(undefined,sector)}: {count} article
                {count !== 1 ? "s" : ""}
                {d ? `, avg weight ${(d.avgWeight * 100).toFixed(0)}%` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function AudienceBars({
  data,
  allAudiences,
}: {
  data: { _id: string; count: number; avgRelevance: number }[];
  allAudiences: string[];
}) {
  const usedTagIds = new Set<string>();

  function findTagData(taxonomyValue: string) {
    let total = { count: 0, avgRelevance: 0, matched: 0 };
    for (const d of data) {
      if (fuzzyMatch(taxonomyValue, d._id)) {
        total.count += d.count;
        total.avgRelevance += d.avgRelevance * d.count;
        total.matched++;
        usedTagIds.add(d._id);
      }
    }
    if (total.matched === 0) return null;
    return { count: total.count, avgRelevance: total.avgRelevance / total.count };
  }

  const segments = allAudiences.length > 0 ? allAudiences : data.map((d) => d._id);

  const seen = new Set<string>();
  const uniqueSegments = segments.filter((s) => {
    const norm = normalize(s);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  // Pre-compute FIRST — populates usedTagIds
  const segmentData = uniqueSegments.map((seg) => ({
    name: seg,
    data: findTagData(seg),
  }));

  // THEN find unmatched
  const unmatched = data.filter((d) => !usedTagIds.has(d._id));
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  for (const d of unmatched) {
    segmentData.push({ name: d._id, data: { count: d.count, avgRelevance: d.avgRelevance } });
  }

  if (segmentData.length === 0) {
    return <p className="text-sm text-muted-foreground">No audience segments configured or tagged yet.</p>;
  }

  return (
    <div className="space-y-3">
      {segmentData.map(({ name: segment, data: d }) => {
        const count = d?.count ?? 0;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const color =
          count === 0
            ? "bg-red-400"
            : pct > 60
              ? "bg-green-500"
              : pct > 30
                ? "bg-amber-500"
                : "bg-orange-400";

        return (
          <div key={segment} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {label(undefined, segment)}
              </span>
              <span className="text-xs text-muted-foreground">
                {count} article{count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
