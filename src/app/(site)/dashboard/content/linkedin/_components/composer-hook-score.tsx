"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionCost } from "@/components/dashboard/action-cost";
import { Loader2, Sparkles, Wand2, X } from "lucide-react";
import { linkedInContentApi, type HookScore, type HookVariant, type RewriteHookResponse } from "@/lib/api/linkedin-content";

const HOOK_SCORE_DEBOUNCE_MS = 400;

export const HOOK_SCORE_MIN_CHARS = 8;

/**
 * Debounced hook scorer. Fires `POST /v1/linkedin/content/score-hook`
 * 400ms after the user stops typing. Pure-server function (no AI),
 * so the cost of getting it wrong is just a request, not a token bill.
 */
export function useHookScore(text: string): HookScore | null | undefined {
  const trimmed = text.trim();
  const longEnough = trimmed.length >= HOOK_SCORE_MIN_CHARS;
  // Same derived-state pattern as usePolicyCheck: store the async
  // result tagged with its source text; derive null (too-short) /
  // undefined (pending) from the current text so we never call
  // setState synchronously inside the effect. `score: null` is the
  // error sentinel (HookScoreCard hides on null).
  const [res, setRes] = useState<{ forText: string; score: HookScore | null } | null>(null);

  useEffect(() => {
    if (!longEnough) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      linkedInContentApi
        .scoreHook(trimmed)
        .then((s) => {
          if (!cancelled) setRes({ forText: trimmed, score: s });
        })
        .catch(() => {
          if (!cancelled) setRes({ forText: trimmed, score: null });
        });
    }, HOOK_SCORE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, longEnough]);

  if (!longEnough) return null;
  if (!res || res.forText !== trimmed) return undefined; // pending
  return res.score;
}

interface HookScoreBand {
  label: string;
  className: string;
}

function bandForScore(score: number): HookScoreBand {
  if (score >= 80)
    return {
      label: "Strong hook",
      className:
        "border-success/30 bg-success/10 text-success-on-tint",
    };
  if (score >= 55)
    return {
      label: "Decent hook",
      className:
        "border-state-info/30 bg-state-info/10 text-state-info-on-tint",
    };
  if (score >= 30)
    return {
      label: "Weak hook",
      className:
        "border-warning/30 bg-warning/8 text-warning-on-tint",
    };
  return {
    label: "Rework the hook",
    className:
      "border-destructive/30 bg-destructive/10 text-destructive-on-tint",
  };
}

/**
 * HookScore card — surfaces the v0 score, an honest tier badge, and
 * up to 3 plain-English suggestions.
 */
export function HookScoreCard({
  score,
  onRewrite,
  rewritePending,
}: {
  score: HookScore | null | undefined;
  onRewrite?: () => void;
  rewritePending?: boolean;
}) {
  if (score === null) return null;
  if (score === undefined) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Scoring hook…
      </div>
    );
  }
  const band = bandForScore(score.score);
  const topSuggestions = score.suggestions.slice(0, 3);
  const tierMeta = tierBadgeMeta(score.tier);
  return (
    <div className={`space-y-2 rounded-md border px-3 py-2.5 text-sm ${band.className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span className="font-medium">{band.label}</span>
          <span
            className="rounded-sm border border-current/30 px-1.5 py-0 text-[10px] uppercase tracking-wide opacity-80"
            title={tierMeta.tooltip}
          >
            {tierMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRewrite && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={onRewrite}
              disabled={rewritePending}
              aria-busy={rewritePending}
            >
              {rewritePending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Wand2 className="size-3" />
              )}
              {rewritePending ? "Rewriting…" : "Rewrite"}
            </Button>
          )}
          {onRewrite && (
            <ActionCost action="linkedinRewrite" className="text-[10px]" />
          )}
          <span className="font-mono text-base font-semibold tabular-nums">
            {score.score}
            <span className="ml-0.5 text-xs opacity-70">/100</span>
          </span>
        </div>
      </div>
      {score.archetypeMatch && (
        <div className="text-[11px] opacity-80">
          Matched{" "}
          <span className="font-mono">{score.archetypeMatch.cohortId}</span>{" "}
          archetype · cosine{" "}
          {score.archetypeMatch.cosineSimilarity.toFixed(2)} · scored
          against {score.archetypeMatch.exampleCount} examples
        </div>
      )}
      {topSuggestions.length > 0 && (
        <ul className="ml-4 list-disc space-y-0.5 text-xs opacity-90">
          {topSuggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Friendlier copy for the tier badge.
 */
function tierBadgeMeta(tier: HookScore["tier"]): { label: string; tooltip: string } {
  switch (tier) {
    case "industry":
      return {
        label: "Tier: industry",
        tooltip:
          "Blended score: 60% cosine similarity to your industry archetype + 40% craft rules. Higher confidence than the rules-only floor.",
      };
    case "personal":
      return {
        label: "Tier: personal",
        tooltip:
          "Blended score: cosine similarity to your own top-performing hooks + craft rules. Most personalised tier.",
      };
    case "rules":
    default:
      return {
        label: "Tier: rules",
        tooltip:
          "Score from craft rules only (length, opener, specific data, audience naming, active voice, line rhythm). No archetype available yet for your cohort.",
      };
  }
}

/**
 * Variants panel — renders the rewrite_hook_variants response.
 */
export function HookVariantsPanel({
  response,
  onPick,
  onDismiss,
}: {
  response: RewriteHookResponse;
  onPick: (v: HookVariant) => void;
  onDismiss: () => void;
}) {
  const { variants } = response;
  return (
    <div
      className="space-y-2 rounded-md border bg-muted/20 p-3"
      role="region"
      aria-live="polite"
      aria-label="Hook rewrite suggestions"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="size-4" />
          Rewrite suggestions
          <span className="text-xs font-normal text-muted-foreground">
            (your hook scored {response.original.score})
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onDismiss}
          aria-label="Dismiss rewrite suggestions"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rewrites available — try editing the hook yourself and rescoring.
        </p>
      ) : (
        <div className="space-y-1.5">
          {variants.map((v, i) => {
            const band = bandForScore(v.score);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(v)}
                className={`flex w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left text-sm transition hover:shadow-sm ${band.className}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="line-clamp-3 whitespace-pre-line">{v.hook}</span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {v.score}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {v.technique}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Voice Card panel ─────────────────────────────────────────────────
