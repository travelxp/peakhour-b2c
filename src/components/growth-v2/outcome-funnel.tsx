import type { Figure } from "@/lib/api/growth-v2";
import { formatCount, formatPercent } from "@/lib/growth-v2-figure";
import { funnelRows } from "@/lib/growth-v2-chart";
import { cn } from "@/lib/utils";
import { MeasurementBadge } from "./measurement-badge";

/**
 * From seen to done, one window, organic and paid together (from chart-card21).
 *
 * Each stage is a bar sized against the first counted stage, with the rate from
 * the previous counted stage beside it. A stage nobody counted is a hatched row
 * with the reason, not a bar of length zero, and it makes the funnel read
 * "Partly tracked" rather than quietly shortening it.
 */
interface OutcomeFunnelProps {
  stages: Array<{ key: string; label: string; figure: Figure }>;
  className?: string;
}

const TONES = ["bg-chart-1", "bg-chart-1/85", "bg-chart-1/70", "bg-chart-1/55", "bg-chart-1/40"];

export function OutcomeFunnel({ stages, className }: OutcomeFunnelProps) {
  const rows = funnelRows(stages);
  const counted = rows.filter((r) => r.value !== undefined);
  const max = Math.max(...counted.map((r) => r.value as number), 0);
  const partial = counted.length < rows.length;

  if (counted.length === 0) {
    return (
      <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Not available: none of the stages has been counted yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {partial ? <MeasurementBadge state="partial" /> : null}
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{r.label}</span>
              {r.value === undefined ? (
                <span data-absent="" className="text-xs text-muted-foreground">
                  Not available
                </span>
              ) : (
                <span className="tabular-nums">
                  {formatCount(r.value)}
                  {r.rateFromPrev !== undefined ? (
                    <span className="ml-2 text-xs text-muted-foreground">{formatPercent(r.rateFromPrev)} of the stage before</span>
                  ) : null}
                </span>
              )}
            </div>
            {r.value === undefined ? (
              <div
                className="h-7 rounded-sm border border-dashed bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--muted)_6px_12px)] px-2 text-xs leading-7 text-muted-foreground"
                title={r.reason}
              >
                {r.reason}
              </div>
            ) : (
              <div className="h-7 rounded-sm bg-muted">
                <div
                  className={cn("h-full rounded-sm", TONES[Math.min(i, TONES.length - 1)])}
                  style={{ width: `${max > 0 && r.value > 0 ? Math.max((r.value / max) * 100, 1.5) : 0}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
