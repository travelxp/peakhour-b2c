import type { Figure, LearningResponse } from "@/lib/api/growth-v2";
import { ABSENT_LABEL, absentReason, figureValue, formatCount, formatMoney, formatPercent } from "@/lib/growth-v2-figure";
import { ToneBadge, type Tone } from "./tone";

/**
 * You against businesses like you, from opted-in first-party outcomes (plan 2.2,
 * k >= 20).
 *
 * The response gives each metric's name and four numbers but no unit, so the unit
 * comes from the name: money in the mandate's currency, a rate as a percent,
 * anything else as a plain count. Where the sample is too small to publish, the
 * row says so and shows no comparison at all.
 */
type Benchmark = LearningResponse["benchmarks"][number];

const LABEL: Record<string, string> = {
  cost_per_outcome: "Cost per outcome",
  roas: "Return on ad spend",
  enquiry_to_outcome_rate: "Enquiry to outcome",
  creative_refresh_days: "Days between creative refreshes",
  incremental_share: "Share of outcomes caused by ads",
};

const LOWER_IS_BETTER = new Set(["cost_per_outcome", "creative_refresh_days"]);

export const metricLabel = (metric: string) =>
  LABEL[metric] ?? metric.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function metricFormat(metric: string, currency: string): (n: number) => string {
  if (metric === "cost_per_outcome") return (n) => formatMoney(n, currency);
  if (/(_rate|_share)$/.test(metric)) return formatPercent;
  return formatCount;
}

/** Where `you` sits against the quartiles, in words. `undefined` when any number is missing. */
export function standing(b: Pick<Benchmark, "metric" | "you" | "p25" | "p50" | "p75">): { tone: Tone; label: string } | undefined {
  const you = figureValue(b.you);
  const p25 = figureValue(b.p25);
  const p50 = figureValue(b.p50);
  const p75 = figureValue(b.p75);
  if (you === undefined || p25 === undefined || p50 === undefined || p75 === undefined) return undefined;
  const lower = LOWER_IS_BETTER.has(b.metric);
  // Fold "lower is better" into "higher is better" by flipping the sign.
  const s = lower ? -1 : 1;
  const [y, a, m, c] = [you * s, p25 * s, p50 * s, p75 * s];
  const [q1, q3] = a < c ? [a, c] : [c, a];
  if (y > q3) return { tone: "good", label: "Better than most" };
  if (y >= m) return { tone: "good", label: "Better than the median" };
  if (y >= q1) return { tone: "info", label: "Typical" };
  return { tone: "warn", label: "Below most" };
}

export function BenchmarkRows({ benchmarks, currency }: { benchmarks: Benchmark[]; currency: string }) {
  if (benchmarks.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No comparison yet. The playbook has no benchmark for your goal, or fewer than 20 similar businesses have opted in.</p>;
  }
  return (
    <ul className="divide-y">
      {benchmarks.map((b) => {
        const fmt = metricFormat(b.metric, currency);
        const st = standing(b);
        const n = figureValue(b.n);
        return (
          <li key={b.metric} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
            <div className="min-w-0">
              <b className="text-sm font-medium">{metricLabel(b.metric)}</b>
              <p className="text-xs text-muted-foreground">
                You <Num figure={b.you} fmt={fmt} strong /> &middot; median <Num figure={b.p50} fmt={fmt} />
                {n !== undefined ? <> &middot; {formatCount(n)} businesses</> : null}
              </p>
              {n === undefined ? (
                <p data-absent="" className="text-xs text-muted-foreground">
                  {ABSENT_LABEL}: {absentReason(b.n)}
                </p>
              ) : null}
            </div>
            {st && n !== undefined ? <ToneBadge tone={st.tone}>{st.label}</ToneBadge> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Num({ figure, fmt, strong = false }: { figure: Figure; fmt: (n: number) => string; strong?: boolean }) {
  const v = figureValue(figure);
  if (v === undefined) {
    return (
      <span data-absent="" title={absentReason(figure)}>
        {ABSENT_LABEL.toLowerCase()}
      </span>
    );
  }
  return <b className={strong ? "font-medium tabular-nums text-foreground" : "font-normal tabular-nums"}>{fmt(v)}</b>;
}
