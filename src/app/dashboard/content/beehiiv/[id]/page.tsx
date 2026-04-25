"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useLocale } from "@/hooks/use-locale";
import {
  SENTIMENT_CONFIG,
  SHELF_LIFE_LABELS,
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FullArticle {
  _id: string;
  title: string;
  subtitle?: string;
  source: string;
  status: string;
  publishedAt: string;
  webUrl?: string;
  thumbnailUrl?: string;
  readingTimeMin?: number;
  tags: {
    taggedAt: string;
    confidence: number;
    sectors: { name: string; weight: number }[];
    subSectors: string[];
    companies: { name: string; normalizedName?: string; role: string; sentiment?: string; segment?: string; tier?: number }[];
    people: { name: string; title?: string; company?: string; role?: string }[];
    policyTags: { body: string; type?: string; impact?: string }[];
    geographies: { name: string; level?: string; role?: string }[];
    metrics: { name: string; value: string; direction?: string; timeframe?: string }[];
    contentType: string;
    sentiment: string;
    urgency?: number;
    shelfLife: string;
    audienceRelevance: { segment: string; relevance: number; whyRelevant?: string }[];
    adPotential: {
      score: number;
      bestAngle?: string;
      bestHook?: string;
      bestStat?: string;
      whyGoodAd?: string;
      whyBadAd?: string;
    } | null;
    keywords: {
      primary?: string[];
      secondary?: string[];
      longTail?: string[];
      negative?: string[];
    } | null;
    relatedContentIds: string[];
    seriesName?: string;
  } | null;
}

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { formatDate, formatDateTime } = useLocale();
  const id = params.id as string;

  const { data: article, isLoading } = useQuery({
    queryKey: ["content-article", id],
    queryFn: () => api.get<FullArticle>(`/v1/content/library/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium">Article not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const t = article.tags;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Back + Title */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => router.push("/dashboard/content/beehiiv")}
          >
            &larr; Back to library
          </Button>
          <h2 className="text-2xl font-bold tracking-tight leading-tight">
            {article.title}
          </h2>
          {article.subtitle && (
            <p className="text-muted-foreground mt-1">{article.subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
            {article.publishedAt && (
              <span>
                {formatDate(article.publishedAt, { year: "numeric", month: "long", day: "numeric" })}
              </span>
            )}
            {article.readingTimeMin && (
              <span>{article.readingTimeMin} min read</span>
            )}
            <Badge variant="outline">{article.source}</Badge>
            {article.webUrl && (
              <a
                href={article.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View original &rarr;
              </a>
            )}
          </div>
        </div>

        {!t ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                This article hasn&apos;t been AI-tagged yet. It will be
                processed automatically overnight.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column — 12-dimension breakdown */}
            <div className="lg:col-span-2 space-y-4">
              {/* Sectors */}
              <DimensionCard title="Sectors" description="Industry sectors covered">
                <div className="flex flex-wrap gap-2">
                  {t.sectors.map((s) => (
                    <Tooltip key={s.name}>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-sm">
                          {label(undefined,s.name)}
                          <span className="ml-1.5 text-muted-foreground">
                            {Math.round(s.weight * 100)}%
                          </span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Weight: {(s.weight * 100).toFixed(0)}% relevance
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {t.subSectors?.length > 0 && (
                    <div className="w-full mt-1">
                      <span className="text-xs text-muted-foreground">
                        Sub-sectors:{" "}
                        {t.subSectors.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </DimensionCard>

              {/* Audience Relevance */}
              <DimensionCard
                title="Audience Relevance"
                description="How relevant this article is to each audience segment"
              >
                <div className="space-y-3">
                  {t.audienceRelevance
                    .sort((a, b) => b.relevance - a.relevance)
                    .map((ar) => (
                      <div key={ar.segment} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {label(undefined,ar.segment)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(ar.relevance * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={ar.relevance * 100}
                          className="h-2"
                        />
                        {ar.whyRelevant && (
                          <p className="text-xs text-muted-foreground">
                            {ar.whyRelevant}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </DimensionCard>

              {/* Companies */}
              {t.companies && t.companies.length > 0 && (
                <DimensionCard
                  title="Companies Mentioned"
                  description="Organizations referenced in this article"
                >
                  <div className="space-y-2">
                    {t.companies.map((co, i) => (
                      <div
                        key={`${co.name}-${i}`}
                        className="flex items-center gap-2"
                      >
                        <span className="text-sm font-medium">{co.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {co.role}
                        </Badge>
                        {co.sentiment && (
                          <SentimentDot value={co.sentiment} />
                        )}
                      </div>
                    ))}
                  </div>
                </DimensionCard>
              )}

              {/* People */}
              {t.people && t.people.length > 0 && (
                <DimensionCard title="People" description="Individuals mentioned">
                  <div className="flex flex-wrap gap-2">
                    {t.people.map((p, i) => (
                      <Tooltip key={`${p.name}-${i}`}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs">
                            {p.name}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {[p.title, p.company, p.role]
                            .filter(Boolean)
                            .join(" · ") || p.name}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </DimensionCard>
              )}

              {/* Geographies */}
              {t.geographies && t.geographies.length > 0 && (
                <DimensionCard title="Geographies" description="Locations mentioned">
                  <div className="flex flex-wrap gap-2">
                    {t.geographies.map((g, i) => (
                      <Badge key={`${g.name}-${i}`} variant="outline" className="text-xs">
                        {g.name}
                        {g.level && (
                          <span className="ml-1 text-muted-foreground">
                            ({g.level})
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </DimensionCard>
              )}

              {/* Metrics */}
              {t.metrics && t.metrics.length > 0 && (
                <DimensionCard
                  title="Key Metrics"
                  description="Data points and statistics"
                >
                  <div className="space-y-2">
                    {t.metrics.map((m, i) => (
                      <div
                        key={`${m.name}-${i}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {m.value}
                          </span>
                          {m.direction && m.direction !== "unknown" && (
                            <span
                              className={
                                m.direction === "up"
                                  ? "text-green-600"
                                  : m.direction === "down"
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                              }
                            >
                              {m.direction === "up"
                                ? "↑"
                                : m.direction === "down"
                                  ? "↓"
                                  : "→"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DimensionCard>
              )}

              {/* Policy Tags */}
              {t.policyTags && t.policyTags.length > 0 && (
                <DimensionCard
                  title="Policy & Regulation"
                  description="Policy references"
                >
                  <div className="space-y-2">
                    {t.policyTags.map((p, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{p.body}</span>
                        {p.impact && (
                          <span className="text-muted-foreground ml-2">
                            — {p.impact}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </DimensionCard>
              )}

              {/* Keywords */}
              {t.keywords && (
                <DimensionCard title="Keywords" description="SEO and content keywords">
                  <div className="space-y-2">
                    {t.keywords.primary && t.keywords.primary.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          Primary:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.keywords.primary.map((kw) => (
                            <Badge key={kw} className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {t.keywords.secondary && t.keywords.secondary.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          Secondary:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.keywords.secondary.map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {t.keywords.longTail && t.keywords.longTail.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          Long-tail:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.keywords.longTail.map((kw) => (
                            <Badge key={kw} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DimensionCard>
              )}
            </div>

            {/* Right column — Ad Potential + Meta */}
            <div className="space-y-4">
              {/* Ad Potential Card */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Ad Potential</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Score */}
                  <div className="text-center">
                    <div className="text-4xl font-bold">
                      {t.adPotential?.score ?? "—"}
                      <span className="text-lg text-muted-foreground font-normal">
                        /10
                      </span>
                    </div>
                    <Progress
                      value={(t.adPotential?.score ?? 0) * 10}
                      className="h-2 mt-2"
                    />
                  </div>

                  <Separator />

                  {/* Best angle */}
                  {t.adPotential?.bestAngle && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Best Angle
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {label(undefined,t.adPotential.bestAngle)}
                      </p>
                    </div>
                  )}

                  {/* Best hook */}
                  {t.adPotential?.bestHook && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Best Hook
                      </p>
                      <p className="text-sm mt-0.5 italic">
                        &ldquo;{t.adPotential.bestHook}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Best stat */}
                  {t.adPotential?.bestStat && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Key Stat
                      </p>
                      <p className="text-sm font-mono mt-0.5">
                        {t.adPotential.bestStat}
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Why good/bad */}
                  {t.adPotential?.whyGoodAd && (
                    <div>
                      <p className="text-xs font-medium text-green-700 uppercase">
                        Why it works
                      </p>
                      <p className="text-sm mt-0.5">
                        {t.adPotential.whyGoodAd}
                      </p>
                    </div>
                  )}
                  {t.adPotential?.whyBadAd && (
                    <div>
                      <p className="text-xs font-medium text-red-700 uppercase">
                        Potential weakness
                      </p>
                      <p className="text-sm mt-0.5">
                        {t.adPotential.whyBadAd}
                      </p>
                    </div>
                  )}

                  <Button className="w-full" disabled>
                    Generate Ad Creative (Sprint 2)
                  </Button>
                </CardContent>
              </Card>

              {/* Meta info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <MetaRow label="Content Type" value={label(undefined,t.contentType)} />
                  <MetaRow
                    label="Sentiment"
                    value={
                      <SentimentBadgeInline value={t.sentiment} />
                    }
                  />
                  <MetaRow label="Shelf Life" value={label(SHELF_LIFE_LABELS, t.shelfLife)} />
                  {t.urgency != null && (
                    <MetaRow label="Urgency" value={`${t.urgency}/10`} />
                  )}
                  <MetaRow
                    label="AI Confidence"
                    value={`${Math.round(t.confidence * 100)}%`}
                  />
                  <MetaRow
                    label="Tagged At"
                    value={formatDateTime(t.taggedAt)}
                  />
                  {t.seriesName && (
                    <MetaRow label="Series" value={t.seriesName} />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Sub-Components ───────────────────────────────────────────────

function DimensionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetaRow({
  label: l,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{l}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SentimentDot({ value }: { value: string }) {
  const colors: Record<string, string> = {
    positive: "bg-green-500",
    negative: "bg-red-500",
    neutral: "bg-slate-400",
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block h-2 w-2 rounded-full ${colors[value] || "bg-slate-400"}`}
        />
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

function SentimentBadgeInline({ value }: { value?: string }) {
  if (!value) return <span>—</span>;
  const config = SENTIMENT_CONFIG[value];
  if (!config) return <span>{value}</span>;
  return (
    <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
      {config.label}
    </Badge>
  );
}
