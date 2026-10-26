import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/viz/sparkline";
import type { Figure } from "@/lib/api/growth-v2";
import { absentReason, figureValue, formatChange, formatCount } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { FigureValue } from "./figure-value";

/**
 * One headline number with its change and trend (from stats-card2 / 4 / 8).
 *
 * `change` is a fraction against the prior period. Whether down is good depends
 * on the metric, so the caller says (`lowerIsBetter`): cost per outcome falling
 * is green, bookings falling is red. An absent change prints why, never "0%".
 */
interface KpiCardProps {
  label: string;
  figure: Figure | undefined;
  format?: (n: number) => string;
  change?: Figure;
  lowerIsBetter?: boolean;
  /** What the change is measured against, e.g. "vs last month". */
  changeNote?: string;
  /** A short trend, oldest first. */
  spark?: number[];
  /** Extra line under the figure. */
  note?: string;
  className?: string;
}

export function KpiCard({ label, figure, format = formatCount, change, lowerIsBetter = false, changeNote = "vs last month", spark, note, className }: KpiCardProps) {
  const delta = figureValue(change);
  const good = delta === undefined || delta === 0 ? undefined : delta < 0 === lowerIsBetter;
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-1 px-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
          <FigureValue figure={figure} format={format} showReason />
        </p>
        {change !== undefined ? (
          delta === undefined ? (
            <p className="text-xs text-muted-foreground" title={absentReason(change)}>
              No comparison available
            </p>
          ) : (
            <p
              className={cn(
                "text-xs font-medium",
                good === undefined ? "text-muted-foreground" : good ? "text-success-on-tint" : "text-destructive-on-tint",
              )}
            >
              <span aria-hidden>{delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2013"} </span>
              {formatChange(delta)} <span className="font-normal text-muted-foreground">{changeNote}</span>
            </p>
          )
        ) : null}
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        {spark && spark.length > 1 ? <Sparkline data={spark} width={200} height={36} className="mt-2 h-9 w-full text-chart-1" /> : null}
      </CardContent>
    </Card>
  );
}
