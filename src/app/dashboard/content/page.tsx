"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, API_BASE_URL } from "@/lib/api";
import {
  SECTOR_LABELS,
  AUDIENCE_LABELS,
  CONTENT_TYPE_LABELS,
  SENTIMENT_CONFIG,
  SHELF_LIFE_LABELS,
  AD_ANGLE_LABELS,
  label,
} from "@/lib/content-labels";
import { Badge } from "@/components/ui/badge";
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
    newsletterId: string;
    newsletterTitle: string;
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
  current: number;
  total: number;
  title: string;
  status: "tagged" | "skipped" | "error";
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

  const startAnalysis = useCallback(async () => {
    setAnalysing(true);
    setAnalyseProgress(null);
    setAnalyseResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/v1/content/analyse`, {
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setAnalyseResult(json?.error?.message || "Failed to start analysis.");
        setAnalysing(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setAnalyseResult("Streaming not supported.");
        setAnalysing(false);
        return;
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        let currentEvent = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (currentEvent === "progress") {
                setAnalyseProgress(parsed);
              } else if (currentEvent === "complete") {
                setAnalyseResult(
                  `Done! ${parsed.tagged} tagged` +
                  (parsed.skipped > 0 ? `, ${parsed.skipped} skipped` : "") +
                  (parsed.errors > 0 ? `, ${parsed.errors} errors` : "") +
                  "."
                );
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      // Refresh queries after analysis
      queryClient.invalidateQueries({ queryKey: ["content-stats"] });
      queryClient.invalidateQueries({ queryKey: ["content-library"] });
      queryClient.invalidateQueries({ queryKey: ["content-gaps"] });
    } catch (err) {
      setAnalyseResult("Analysis failed. Please try again.");
    } finally {
      setAnalysing(false);
    }
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
          {hasUntagged && !analysing && (
            <Button onClick={startAnalysis}>
              Analyse {stats.total - stats.tagged} untagged
            </Button>
          )}
          {analysing && (
            <Button disabled>Analysing...</Button>
          )}
        </div>

        {/* Analysis progress */}
        {(analysing || analyseResult) && (
          <Card className={analyseResult ? "border-green-200 bg-green-50/50" : "border-blue-200 bg-blue-50/50"}>
            <CardContent className="py-3 px-4">
              {analysing && analyseProgress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Analysing: <span className="font-medium">{analyseProgress.title}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {analyseProgress.current} / {analyseProgress.total}
                    </span>
                  </div>
                  <Progress value={(analyseProgress.current / analyseProgress.total) * 100} className="h-2" />
                </div>
              ) : analysing ? (
                <p className="text-sm">Starting analysis...</p>
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
                options={Object.entries(SECTOR_LABELS)}
              />
              <FilterSelect
                placeholder="Type"
                value={filters.contentType}
                onChange={(v) => updateFilter("contentType", v)}
                options={Object.entries(CONTENT_TYPE_LABELS)}
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
                            {label(CONTENT_TYPE_LABELS, draft.tags?.contentType)}
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
                                {label(SECTOR_LABELS, s.name)}
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
                  <SectorHeatmap data={gaps.sectorCoverage} />
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
                  <AudienceBars data={gaps.audienceCoverage} />
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
                          key={item.newsletterId}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-sm truncate max-w-xs">
                            {item.newsletterTitle}
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
              {label(CONTENT_TYPE_LABELS, t.contentType)}
            </Badge>
          )}
          <SentimentBadge value={t?.sentiment} />
          {t?.sectors?.slice(0, 2).map((s) => (
            <Badge key={s.name} variant="secondary" className="text-xs">
              {label(SECTOR_LABELS, s.name)}
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

function SectorHeatmap({
  data,
}: {
  data: { _id: string; count: number; avgWeight: number }[];
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const allSectors = Object.keys(SECTOR_LABELS);
  const dataMap = new Map(data.map((d) => [d._id, d]));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {allSectors.map((sector) => {
        const d = dataMap.get(sector);
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
                  {label(SECTOR_LABELS, sector)}
                </p>
                <p className="text-lg font-bold mt-0.5">{count}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {label(SECTOR_LABELS, sector)}: {count} article
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
}: {
  data: { _id: string; count: number; avgRelevance: number }[];
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const allAudiences = Object.keys(AUDIENCE_LABELS);
  const dataMap = new Map(data.map((d) => [d._id, d]));

  return (
    <div className="space-y-3">
      {allAudiences.map((segment) => {
        const d = dataMap.get(segment);
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
                {label(AUDIENCE_LABELS, segment)}
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
