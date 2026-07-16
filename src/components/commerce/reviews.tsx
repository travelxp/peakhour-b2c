"use client";

import { useState, useCallback } from "react";
import { Loader2, Sparkles, Star, Store, Wrench, MessageSquareReply, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { RankedListCard } from "@/components/molecules/ranked-list-card";
import { ProportionListCard } from "@/components/molecules/proportion-list-card";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import {
  useReviewsSummary,
  useReviewsList,
  useAnalyzeReviews,
  useDraftResponse,
  useProposeFix,
  type ThemeStat,
  type ReviewListItem,
  type ReviewSentiment,
} from "@/hooks/use-commerce-reputation";

/**
 * Commerce → Reviews (P2.8). The Reputation agent's read-out over the connected
 * channels: top issues (RankedListCard), sentiment + rating breakdowns
 * (ProportionListCard), PDP-fix intent cards for recurring negative themes, and
 * per-review response cards with AI-drafted replies. Gated on `commerce.nav`.
 */

const SENTIMENT_LABEL: Record<ReviewSentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  mixed: "Mixed",
};

export function CommerceReviews() {
  return (
    <FeatureGate feature="commerce.nav" featureName="Commerce">
      <ReviewsBody />
    </FeatureGate>
  );
}

function ReviewsBody() {
  const { data, isLoading, isError } = useReviewsSummary();
  const analyze = useAnalyzeReviews();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <EmptyState
          icon={Store}
          title="Connect a store to see your reviews"
          description="Reviews light up once a store with reviews is connected — Peakhour reads them across channels and finds the recurring themes."
          action={{ label: "Connect a store", href: "/dashboard/integrations" }}
        />
      </div>
    );
  }

  if (data.totalReviews === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Header />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reviews have synced yet. Once your store&apos;s reviews sync, your top issues and
            sentiment breakdown appear here.
          </CardContent>
        </Card>
      </div>
    );
  }

  const themeItems = data.topThemes.map((t: ThemeStat) => ({
    id: t.theme,
    title: t.theme.replace(/_/g, " "),
    subtitle: t.negativeCount > 0 ? `${t.negativeCount} negative of ${t.count}` : `${t.count} mentions`,
    value: t.count,
  }));

  const sentimentItems = (Object.keys(data.sentimentBreakdown) as ReviewSentiment[])
    .map((k) => ({ id: k, label: SENTIMENT_LABEL[k], count: data.sentimentBreakdown[k] }))
    .filter((i) => i.count > 0);
  const sentimentTotal = sentimentItems.reduce((s, i) => s + i.count, 0);

  const ratingItems = ["5", "4", "3", "2", "1"]
    .map((r) => ({ id: r, label: `${r}★`, count: data.ratingDistribution[r] ?? 0 }))
    .filter((i) => i.count > 0);
  const ratingTotal = ratingItems.reduce((s, i) => s + i.count, 0);

  // Recurring NEGATIVE themes are the PDP-fix candidates.
  const fixThemes = data.topThemes.filter((t) => t.negativeCount > 0).slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Header />

      {/* Stat row + analyse */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Star className="size-5 fill-amber-400 text-amber-400" />
          <span className="text-2xl font-semibold tabular-nums">
            {data.averageRating ?? "—"}
          </span>
          <span className="text-sm text-muted-foreground">avg · {data.totalReviews} reviews</span>
        </div>
        <span className="text-sm text-muted-foreground">{data.respondedReviews} replied</span>
        {data.pendingReviews > 0 && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() =>
              analyze.mutate(undefined, {
                onSuccess: (r) => toast.success(`Analysed ${r.analysed} review${r.analysed === 1 ? "" : "s"}`),
                onError: () => toast.error("Couldn't analyse reviews", { description: "Please try again." }),
              })
            }
            disabled={analyze.isPending}
          >
            {analyze.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Analysing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> Analyse {data.pendingReviews} new
              </>
            )}
          </Button>
        )}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <RankedListCard
          title="Top issues"
          items={themeItems}
          emptyMessage={
            data.analysedReviews === 0
              ? "Analyse your reviews to surface recurring themes."
              : "No recurring themes yet."
          }
          limit={8}
        />
        <ProportionListCard
          title="Sentiment"
          items={sentimentItems}
          total={sentimentTotal}
          emptyMessage="Analyse your reviews to see sentiment."
        />
        <ProportionListCard
          title="Ratings"
          items={ratingItems}
          total={ratingTotal}
          emptyMessage="No ratings yet."
        />
      </div>

      {fixThemes.length > 0 && <FixIntents themes={fixThemes} />}

      <ResponseCards />
    </div>
  );
}

function Header() {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold">Reviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What customers are saying, across your channels — the recurring themes, the sentiment,
        and where to act. Peakhour drafts replies and flags product-page fixes.
      </p>
    </header>
  );
}

function FixIntents({ themes }: { themes: ThemeStat[] }) {
  const propose = useProposeFix();
  const [done, setDone] = useState<Set<string>>(new Set());

  const onPropose = useCallback(
    (theme: string) => {
      propose.mutate(theme, {
        onSuccess: () => {
          setDone((prev) => new Set(prev).add(theme));
          toast.success("Fix proposed", { description: `Flagged "${theme.replace(/_/g, " ")}" for a product-page fix.` });
        },
        onError: () => toast.error("Couldn't propose fix", { description: "Please try again." }),
      });
    },
    [propose],
  );

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold">Suggested fixes</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const isDone = done.has(t.theme);
          const isBusy = propose.isPending && propose.variables === t.theme;
          return (
            <Card key={t.theme}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium capitalize">{t.theme.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.negativeCount} negative mention{t.negativeCount === 1 ? "" : "s"}
                  </p>
                </div>
                {isDone ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" /> Proposed
                  </span>
                ) : (
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onPropose(t.theme)}>
                    {isBusy ? <Loader2 className="size-4 animate-spin" /> : (<><Wrench className="mr-1 size-4" /> Fix</>)}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ResponseCards() {
  const { data, isLoading } = useReviewsList("needs_response");
  const draft = useDraftResponse();
  const items = data?.items ?? [];

  if (isLoading || items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Needs a reply</h2>
      <div className="space-y-3">
        {items.slice(0, 10).map((r) => (
          <ReviewCard key={r.id} review={r} draft={draft} />
        ))}
      </div>
    </section>
  );
}

function ReviewCard({
  review,
  draft,
}: {
  review: ReviewListItem;
  draft: ReturnType<typeof useDraftResponse>;
}) {
  const isBusy = draft.isPending && draft.variables === review.id;
  // Show a freshly-returned draft for this review, else any stored draft.
  const shownDraft =
    draft.data?.reviewId === review.id ? draft.data.draft : review.responseDraft;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {review.rating != null && (
                <span className="inline-flex items-center gap-0.5 text-sm tabular-nums">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {review.rating}
                </span>
              )}
              {review.authorName && <span className="text-sm font-medium">{review.authorName}</span>}
              {review.sentiment && (
                <Badge variant="outline" className="text-xs font-normal">
                  {SENTIMENT_LABEL[review.sentiment]}
                </Badge>
              )}
            </div>
            {review.title && <p className="mt-1 text-sm font-medium">{review.title}</p>}
            {review.bodySnippet && (
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{review.bodySnippet}</p>
            )}
          </div>
          {review.responseStatus !== "published" && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={isBusy}
              onClick={() =>
                draft.mutate(review.id, {
                  onError: () =>
                    toast.error("Couldn't draft a reply", { description: "Please try again." }),
                })
              }
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <MessageSquareReply className="mr-1 size-4" /> {shownDraft ? "Redraft" : "Draft reply"}
                </>
              )}
            </Button>
          )}
        </div>
        {shownDraft && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {review.responseStatus === "published" ? "Published reply" : "Draft reply · uses Peaks"}
            </p>
            <p className="whitespace-pre-wrap">{shownDraft}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
