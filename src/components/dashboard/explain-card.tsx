"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, Loader2, Lightbulb, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useExplain, type ExplainSurface, type ExplainNarration } from "@/hooks/use-explain";

/** Sentiment → left-accent colour for the narration card. */
const ACCENT: Record<ExplainNarration["sentiment"], string> = {
  positive: "border-l-emerald-500",
  neutral: "border-l-muted-foreground/40",
  concern: "border-l-amber-500",
};

/**
 * The user-triggered, Peaks-metered Tier-2 "Explain this" card. Deterministic
 * Tier-1 always renders above it; this is the optional plain-English gloss the
 * owner opts into. Renders nothing when there's no week-over-week comparison to
 * explain (the Tier-1 "not enough history" banner covers that state).
 */
export function ExplainCard({ surface, resource }: { surface: ExplainSurface; resource?: string }) {
  const { query, generate } = useExplain(surface, resource);
  const [outOfPeaks, setOutOfPeaks] = useState(false);

  const data = query.data;
  // Nothing to explain yet (first week / not connected / still syncing) — stay
  // out of the way; the deterministic dashboard already speaks to those states.
  if (query.isLoading || !data || !data.available) return null;

  const narration = data.narration;
  const pending = generate.isPending;

  const run = (refresh: boolean) => {
    setOutOfPeaks(false);
    generate.mutate(
      { refresh },
      {
        onError: (err) => {
          // Peaks hard cap (requireUnderFairUse → 429) — meter, don't paywall:
          // show an honest top-up nudge, never a raw error.
          if (err instanceof ApiError && (err.code === "CREDITS_EXHAUSTED" || err.status === 429)) {
            setOutOfPeaks(true);
          }
        },
      },
    );
  };

  return (
    <Card className={narration ? `border-l-4 ${ACCENT[narration.sentiment]}` : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Explain this
          </CardTitle>
          {narration && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(true)}
              title={data.stale ? "The data has moved on — refresh the explanation" : "Regenerate"}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
              {data.stale ? "Refresh" : "Regenerate"}
            </Button>
          )}
        </div>
        {narration && data.stale && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Your numbers have changed since this was written.
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {outOfPeaks ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <span className="text-amber-900 dark:text-amber-200">
              You&apos;re out of Peaks for now — top up to generate more explanations.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/peaks">
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Peaks
              </Link>
            </Button>
          </div>
        ) : !narration ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Turn this week&apos;s numbers into plain English — what changed, and what to do next.
            </p>
            <Button size="sm" disabled={pending} onClick={() => run(false)}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Explain this week
            </Button>
            <p className="text-xs text-muted-foreground">Uses 1 Peak.</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold">{narration.headline}</p>
            <ul className="space-y-1.5">
              {narration.lines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            {narration.nextAction && (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">Do this: </span>
                  {narration.nextAction}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
