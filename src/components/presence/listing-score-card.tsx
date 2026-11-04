"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, HelpCircle, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { presenceScoreApi } from "@/lib/api/presence-score";
import { useListingScore } from "@/hooks/use-presence-score";
import {
  canDecide,
  checkMark,
  effectWord,
  fixControl,
  healthMark,
  orderingSentence,
  presenceScoreQueryKey,
  proposalBody,
  scoreEmptyState,
  scoreHeadline,
  scoreTone,
  sortedChecks,
  sortedHealth,
  statusSentence,
  valueText,
  visibleFixes,
  type ChangeView,
  type CheckState,
  type ScoreFix,
} from "@/lib/presence-score";

/**
 * How complete and healthy the listing is, and the next few fixes in order (PE-10).
 *
 * MARKUP ONLY. The words and rules are in `lib/presence-score.ts`; the api decides which fix may carry an edit. A fix with no edit shows
 * the sentence that says why and no button. Preparing a fix PROPOSES a change card: nothing is sent until a person approves it.
 * A fix that needs the merchant's own words opens the edit form through `onOpenForm`, which the page supplies; without it the fix
 * shows what is missing and why it matters, and no button.
 */
const TONE_CLASS = { good: "text-foreground", fair: "text-warning-on-tint", poor: "text-destructive", none: "text-muted-foreground" } as const;

function Mark({ state }: { state: CheckState | "attention" }) {
  if (state === "ok") return <Check className="size-3.5 text-muted-foreground" aria-hidden />;
  if (state === "gap" || state === "attention") return <AlertTriangle className="size-3.5 text-warning-on-tint" aria-hidden />;
  if (state === "unknown") return <HelpCircle className="size-3.5 text-muted-foreground" aria-hidden />;
  return <Minus className="size-3.5 text-muted-foreground" aria-hidden />;
}

function ChangeCard({ change, busy, error, onApprove, onDiscard }: { change: ChangeView; busy: boolean; error: string | null; onApprove: () => void; onDiscard: () => void }) {
  const issues = [...(change.reason ? [change.reason.message] : []), ...(change.validation?.issues.map((i) => i.message) ?? [])];
  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3 text-sm" data-testid="score-change-card">
      <dl className="grid gap-1 sm:grid-cols-[5rem_1fr]">
        <dt className="text-xs text-muted-foreground">Now</dt>
        <dd className="break-words">{valueText(change.before)}</dd>
        <dt className="text-xs text-muted-foreground">Change to</dt>
        <dd className="break-words font-medium">{valueText(change.after)}</dd>
      </dl>
      {change.notes.map((n, i) => (
        <p key={`${i}:${n}`} className="text-xs text-muted-foreground">{n}</p>
      ))}
      {issues.map((m, i) => (
        <p key={`${i}:${m}`} className="text-xs text-warning-on-tint">{m}</p>
      ))}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">{statusSentence(change.status)}</p>
      {canDecide(change) ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={busy}>Approve</Button>
          <Button size="sm" variant="outline" onClick={onDiscard} disabled={busy}>Not now</Button>
        </div>
      ) : null}
    </div>
  );
}

function FixRow({ fix, onOpenForm }: { fix: ScoreFix; onOpenForm?: ((field: string) => void) | undefined }) {
  const [change, setChange] = useState<ChangeView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const control = fixControl(fix.action, !!onOpenForm);

  async function run(fn: () => Promise<ChangeView | null>) {
    setBusy(true);
    setError(null);
    try {
      setChange(await fn());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const propose = () =>
    run(async () => {
      if (fix.action.kind !== "card") return null;
      const res = await presenceScoreApi.propose(proposalBody(fix.action));
      if (res.notChecked.length > 0) setError(res.notChecked[0]!.message);
      return res.items[0] ?? null;
    });
  const approve = () =>
    run(async () => {
      if (!change) return null;
      // The score is NOT refetched here: the fix stays a gap until a later read shows the change live, so the card must stay put.
      const res = await presenceScoreApi.approve(change.id);
      return res.item;
    });
  const discard = () =>
    run(async () => {
      if (!change) return null;
      await presenceScoreApi.reject(change.id);
      return null;
    });

  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          {fix.rank.position}. {fix.title}
        </p>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{effectWord(fix.rank.effect)}</span>
      </div>
      <p className="text-sm text-muted-foreground">{fix.why}</p>
      {fix.note ? <p className="text-xs text-muted-foreground">{fix.note}</p> : null}
      <p className="text-xs text-muted-foreground">{fix.rank.reason}</p>
      {control?.kind === "note" ? <p className="text-xs text-warning-on-tint">{control.message}</p> : null}
      {control?.kind === "propose" && !change ? (
        <Button size="sm" variant="outline" onClick={propose} disabled={busy}>
          {control.label}
        </Button>
      ) : null}
      {control?.kind === "form" ? (
        <Button size="sm" variant="outline" onClick={() => onOpenForm?.(fix.field)}>
          {control.label}
        </Button>
      ) : null}
      {(control?.kind === "form" && control.risky) || (fix.action.kind === "card" && fix.action.risky) ? (
        <p className="text-xs text-muted-foreground">Changing this may mean verifying your business again.</p>
      ) : null}
      {error && !change ? <p className="text-xs text-destructive">{error}</p> : null}
      {change ? <ChangeCard change={change} busy={busy} error={error} onApprove={approve} onDiscard={discard} /> : null}
    </li>
  );
}

export function ListingScoreCard({ location, onOpenForm }: { location?: string | undefined; onOpenForm?: (field: string) => void }) {
  const q = useListingScore(location);
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  // isPending, not isLoading: a paused query has no data and is not loading, and is not a failure either
  if (q.isPending) return <Skeleton className="h-56 w-full" />;
  // A FAILED READ IS NOT "NO SCORE": say the read failed.
  if (q.isError) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-muted-foreground">
        <span>We couldn&apos;t work out your listing score just now.</span>
        <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: presenceScoreQueryKey(location) })}>
          Try again
        </Button>
      </Card>
    );
  }
  if (q.data.state !== "ready") {
    const empty = scoreEmptyState(q.data);
    return (
      <Card className="space-y-1 p-4">
        <h2 className="text-base font-semibold">Your listing score</h2>
        <p className="text-sm font-medium">{empty?.headline}</p>
        <p className="text-sm text-muted-foreground">{empty?.description}</p>
      </Card>
    );
  }
  const { score, health } = q.data;
  const fixes = visibleFixes(score.fixes, showAll);

  return (
    <Card className="space-y-5 p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Your listing score</h2>
          <p className={`text-2xl font-semibold tabular-nums ${TONE_CLASS[scoreTone(score.score)]}`} data-testid="score-headline">
            {scoreHeadline(score.score)}
          </p>
          <p className="max-w-xl text-sm text-muted-foreground">{score.seen.sentence}</p>
        </div>
      </div>

      {health.length > 0 ? (
        <ul className="divide-y rounded-md border" aria-label="Listing health">
          {sortedHealth(health).map((h) => (
            <li key={h.id} className="flex items-start gap-2 px-3 py-2">
              <span className="mt-0.5"><Mark state={h.state === "ok" ? "ok" : h.state === "attention" ? "attention" : "unknown"} /></span>
              <div className="min-w-0 text-sm">
                <p>
                  {h.headline} <span className="text-xs text-muted-foreground">({healthMark(h.state)})</span>
                </p>
                {h.detail ? <p className="text-xs text-muted-foreground">{h.detail}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">What to fix next</h3>
        {score.fixes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {score.seen.unknown > 0 ? "Nothing we could check needs fixing. Some parts we could not check are left out." : "Nothing is missing from your listing."}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{orderingSentence(score.ordering)}</p>
            <ul className="divide-y">
              {fixes.map((f) => (
                <FixRow key={f.id} fix={f} onOpenForm={onOpenForm} />
              ))}
            </ul>
            {score.fixes.length > fixes.length || showAll ? (
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `Show ${score.fixes.length - fixes.length} more`}
              </Button>
            ) : null}
          </>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Every part we looked at</summary>
        <ul className="mt-2 divide-y">
          {sortedChecks(score.checks).map((c) => (
            <li key={c.id} className="flex items-start gap-2 py-2">
              <span className="mt-0.5"><Mark state={c.state} /></span>
              <div className="min-w-0">
                <p>
                  {c.label} <span className="text-xs text-muted-foreground">({checkMark(c.state)})</span>
                </p>
                {c.note ? <p className="text-xs text-muted-foreground">{c.note}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
