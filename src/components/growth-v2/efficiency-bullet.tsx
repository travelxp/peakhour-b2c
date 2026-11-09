import type { Figure } from "@/lib/api/growth-v2";
import { ABSENT_LABEL, absentReason, figureValue, formatMoney } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";

/**
 * You, against your target and the industry (from chart-card26).
 *
 * A bullet graph: a bar from zero to your figure, a tick at your target and a
 * tick at the industry median, on one scale. The scale is zero to a quarter
 * above the largest figure present, so a bar's length is always honest.
 *
 * Absent figures are left off the scale and named below it. If `you` is absent
 * there is no bar and the label says so, but the target and industry still show.
 */
interface EfficiencyBulletProps {
  metric: "cost_per_outcome" | "roas";
  you: Figure;
  target: Figure;
  industry: Figure;
  /** Currency for cost per outcome. Ignored for roas. */
  currency: string;
  /** What one outcome is called, e.g. "booking". */
  unit?: string;
  className?: string;
}

export function EfficiencyBullet({ metric, you, target, industry, currency, unit = "outcome", className }: EfficiencyBulletProps) {
  const fmt = (n: number) => (metric === "roas" ? `${n.toFixed(1)}x` : formatMoney(n, currency));
  const marks = [
    { key: "you", label: "You", figure: you },
    { key: "target", label: "Target", figure: target },
    { key: "industry", label: "Industry median", figure: industry },
  ] as const;
  const present = marks.map((m) => figureValue(m.figure)).filter((v): v is number => v !== undefined);
  const max = present.length ? Math.max(...present) * 1.25 : 0;
  const pct = (v: number) => (max > 0 ? Math.min(100, (v / max) * 100) : 0);
  const youV = figureValue(you);
  const targetV = figureValue(target);
  const industryV = figureValue(industry);
  const summary = marks
    .map((m) => {
      const v = figureValue(m.figure);
      return `${m.label} ${v === undefined ? ABSENT_LABEL.toLowerCase() : fmt(v)}`;
    })
    .join(", ");
  const heading = metric === "roas" ? "Return on ad spend" : `Cost per ${unit}`;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {heading}: you, your target and the industry
      </p>
      <div role="img" aria-label={`${heading}. ${summary}`} className="relative h-12 pt-5">
        <div className="absolute inset-x-0 bottom-0 h-8 rounded bg-muted" />
        {industryV !== undefined ? (
          <div
            className="absolute bottom-0 h-8 w-0.5 bg-chart-3"
            style={{ left: `${pct(industryV)}%` }}
            title={`Industry median ${fmt(industryV)}`}
          />
        ) : null}
        {youV !== undefined ? (
          <div className="absolute bottom-2.5 h-3 rounded-sm bg-foreground" style={{ width: `${pct(youV)}%` }} />
        ) : null}
        {targetV !== undefined ? (
          <div className="absolute bottom-0 h-8 w-[3px] bg-destructive" style={{ left: `${pct(targetV)}%` }} title={`Target ${fmt(targetV)}`} />
        ) : null}
        {youV !== undefined ? (
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums"
            style={{ left: `${Math.min(Math.max(pct(youV), 12), 88)}%` }}
          >
            {fmt(youV)} you
          </span>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-sm bg-foreground" />
          You {youV === undefined ? <Why figure={you} /> : <b className="font-medium tabular-nums text-foreground">{fmt(youV)}</b>}
        </li>
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block h-2.5 w-[3px] bg-destructive" />
          Target {targetV === undefined ? <Why figure={target} /> : <b className="font-medium tabular-nums text-foreground">{fmt(targetV)}</b>}
        </li>
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block h-2.5 w-0.5 bg-chart-3" />
          Industry median {industryV === undefined ? <Why figure={industry} /> : <b className="font-medium tabular-nums text-foreground">{fmt(industryV)}</b>}
        </li>
      </ul>
    </div>
  );
}

function Why({ figure }: { figure: Figure }) {
  return (
    <span data-absent="" title={absentReason(figure)}>
      {ABSENT_LABEL.toLowerCase()}
    </span>
  );
}
