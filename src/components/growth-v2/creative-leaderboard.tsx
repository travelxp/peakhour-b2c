import type { LearningResponse } from "@/lib/api/growth-v2";
import { ABSENT_LABEL, absentReason, figureValue, formatCount } from "@/lib/growth-v2-figure";

/**
 * Which creative patterns win, ranked (from leaderboard3).
 *
 * Ranked by extra outcomes per 1,000 views. A pattern with no figure is listed
 * last, unranked, with its reason, so a pattern nobody could measure never ranks
 * above one that was, or below zero.
 */
type Pattern = LearningResponse["creativePatterns"][number];

/** Measured patterns best-first, then the unmeasured ones in their given order. */
export function rankPatterns(patterns: Pattern[]): Pattern[] {
  const measured = patterns.filter((p) => figureValue(p.liftPer1k) !== undefined);
  const unmeasured = patterns.filter((p) => figureValue(p.liftPer1k) === undefined);
  return [...measured.sort((a, b) => (figureValue(b.liftPer1k) as number) - (figureValue(a.liftPer1k) as number)), ...unmeasured];
}

export function CreativeLeaderboard({ patterns, unitPlural }: { patterns: Pattern[]; unitPlural: string }) {
  if (patterns.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No creative has run long enough to rank yet.</p>;
  }
  const ranked = rankPatterns(patterns);
  const max = Math.max(...ranked.map((p) => figureValue(p.liftPer1k) ?? 0), 0);
  return (
    <ol className="grid gap-3" aria-label={`Creative patterns by extra ${unitPlural} per 1,000 views`}>
      {ranked.map((p, i) => {
        const v = figureValue(p.liftPer1k);
        const n = figureValue(p.n);
        return (
          <li key={p.key} className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2.5">
            <span className="font-mono text-xs text-muted-foreground">{v === undefined ? "–" : i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <b className="min-w-0 truncate text-sm font-medium">
                  {p.label} <span className="font-normal text-muted-foreground">&middot; {p.hookFormat}</span>
                </b>
                <span className="text-sm tabular-nums">
                  {v === undefined ? (
                    <span data-absent="" className="text-muted-foreground" title={absentReason(p.liftPer1k)}>
                      {ABSENT_LABEL}
                    </span>
                  ) : (
                    formatCount(v)
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                {v !== undefined ? <div className="h-full rounded-full bg-chart-3" style={{ width: `${max > 0 ? Math.max((v / max) * 100, 0) : 0}%` }} /> : null}
              </div>
              {n !== undefined ? <p className="mt-0.5 text-xs text-muted-foreground">based on {formatCount(n)} samples</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
