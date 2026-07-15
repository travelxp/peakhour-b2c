"use client";

import { CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/hooks/use-locale";
import {
  useCommerceRecommendations,
  useDecideRecommendation,
  type Recommendation,
  type RecommendationDecision,
} from "@/hooks/use-commerce-recommendations";

/**
 * Commerce → Command Center "Needs you" rail. The engine's proposals as
 * actionable intents: approve or dismiss inline (optimistic), each with its
 * projected revenue lift and confidence. Models the Autopilot Home NeedsYouRail
 * pattern (Card + count pill + divided list + "all caught up" empty state), but
 * decisions happen in place rather than jumping elsewhere.
 *
 * Self-contained (fetches its own data); hides entirely when no store is
 * connected — the Command Center already shows that connect state.
 */
export function CommerceNeedsYou() {
  const { data, isLoading, isError } = useCommerceRecommendations();
  const decide = useDecideRecommendation();

  if (isError) return null;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <CardTitle className="text-base">Needs you</CardTitle>
        {total > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            {total}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <CheckCircle2 className="size-7 text-emerald-500" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">
              No proposals waiting. Peakhour will surface new ones here as it finds
              opportunities.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((rec) => (
              <RecommendationRow
                key={rec.id}
                rec={rec}
                busy={decide.isPending}
                onDecide={(decision) => decide.mutate({ id: rec.id, decision })}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationRow({
  rec,
  busy,
  onDecide,
}: {
  rec: Recommendation;
  busy: boolean;
  onDecide: (decision: RecommendationDecision) => void;
}) {
  const { formatNumber } = useLocale();
  const range = rec.expectedRevenueRange;
  const money = (v: number, currency: string) =>
    formatNumber(v, { style: "currency", currency, maximumFractionDigits: 0 });
  // confidenceScore may be a 0–1 fraction or an already-scaled 0–100 value.
  const confidencePct = Math.round(
    rec.confidenceScore <= 1 ? rec.confidenceScore * 100 : rec.confidenceScore,
  );

  return (
    <li className="border-l-2 border-l-amber-500 px-4 py-3">
      <p className="text-sm font-medium">{rec.title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{rec.reasonSummary}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {range && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <TrendingUp aria-hidden="true" className="size-3" />
            {money(range.min, range.currency)}–{money(range.max, range.currency)}
          </span>
        )}
        <span className="text-muted-foreground">confidence {confidencePct}%</span>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => onDecide("approve")}>
          Approve
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("reject")}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}
