import type { Money } from "@/lib/api/growth-v2";
import { currencyOf, figureValue, formatMoney, moneyText } from "@/lib/growth-v2-figure";
import { idealSpend, pacingState, type PacingState } from "@/lib/growth-v2-chart";
import type { PacingSeries } from "@/lib/growth-v2-series";
import { linePath, niceScale, scale } from "./svg";
import { ToneBadge, type Tone } from "./tone";

/**
 * Cumulative spend this month against the ceiling (from chart-card27).
 *
 * The dashed line is an even climb to the ceiling; the filled line is what was
 * spent. Above the ceiling is red and the last 15% below it is amber. With no
 * day-by-day series (the api carries none yet) there is a plain meter, never a
 * made-up line.
 */
interface PacingChartProps {
  spent: Money;
  ceiling: Money;
  daysLeft: number;
  series?: PacingSeries;
}

const STATE: Record<PacingState, { tone: Tone; label: string }> = {
  healthy: { tone: "good", label: "On pace" },
  ahead: { tone: "warn", label: "Ahead of pace" },
  over: { tone: "bad", label: "Over the ceiling" },
  unknown: { tone: "neutral", label: "Not enough to tell" },
};

const W = 360;
const H = 220;
const L = 44;
const R = 10;
const T = 12;
const B = 28;

export function PacingBadge({ spent, ceiling, daysLeft, daysInMonth }: { spent: Money; ceiling: Money; daysLeft: number; daysInMonth: number }) {
  const s = STATE[pacingState(spent, ceiling, daysLeft, daysInMonth)];
  return (
    <ToneBadge tone={s.tone} dot>
      {s.label}
    </ToneBadge>
  );
}

export function PacingChart({ spent, ceiling, daysLeft, series }: PacingChartProps) {
  const s = figureValue(spent);
  const c = figureValue(ceiling);
  const currency = currencyOf(spent, ceiling);

  if (s === undefined || c === undefined) {
    return (
      <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Not available: spend or the ceiling is missing. Spent {moneyText(spent)}, ceiling {moneyText(ceiling)}.
      </p>
    );
  }

  const meter = <PacingMeter spent={spent} ceiling={ceiling} daysLeft={daysLeft} />;

  if (!series || series.points.length < 2) {
    return (
      <div className="space-y-3">
        {meter}
        <p data-absent="" className="text-xs text-muted-foreground">
          The day-by-day line is not available yet.
        </p>
      </div>
    );
  }

  const dim = series.daysInMonth;
  const { top, ticks: yTicks } = niceScale(Math.max(c * 1.2, ...series.points.map((p) => p.spend)));
  const x = scale(1, dim, L, W - R);
  const y = scale(0, top, H - B, T);
  const pts = series.points.map((p) => [x(p.day), y(p.spend)] as const);
  const lastPt = series.points[series.points.length - 1];
  const dayMarks = [1, 8, 15, 22, dim].filter((d) => d <= dim);

  return (
    <div className="space-y-3">
      {meter}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Spend so far ${formatMoney(s, currency)} against a ${formatMoney(c, currency)} ceiling`}>
        <rect x={L} y={y(top)} width={W - R - L} height={y(c) - y(top)} fill="var(--destructive)" fillOpacity={0.1} />
        <rect x={L} y={y(c)} width={W - R - L} height={y(c * 0.85) - y(c)} fill="var(--warning)" fillOpacity={0.12} />
        <g className="stroke-border">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground stroke-none text-[11px]">
                {formatMoney(v, currency)}
              </text>
            </g>
          ))}
        </g>
        {dayMarks.map((d) => (
          <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {d}
          </text>
        ))}
        <line x1={x(1)} y1={y(0)} x2={x(dim)} y2={y(idealSpend(c, dim, dim))} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        <path d={`${linePath(pts)}L${x(lastPt.day)},${y(0)}L${x(1)},${y(0)}Z`} fill="var(--chart-3)" fillOpacity={0.2} />
        <path d={linePath(pts)} fill="none" stroke="var(--chart-3)" strokeWidth={2.5} />
        <circle cx={x(lastPt.day)} cy={y(lastPt.spend)} r={4} fill="var(--chart-3)" />
        <text x={W - R - 4} y={y(c) - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
          ceiling {formatMoney(c, currency)}
        </text>
      </svg>
    </div>
  );
}

/** The month's spend as a plain meter against the ceiling. Needs both figures. */
export function PacingMeter({ spent, ceiling, daysLeft }: { spent: Money; ceiling: Money; daysLeft: number }) {
  const s = figureValue(spent);
  const c = figureValue(ceiling);
  const currency = currencyOf(spent, ceiling);
  if (s === undefined || c === undefined) {
    return (
      <p data-absent="" className="text-sm text-muted-foreground">
        Not available: spent {moneyText(spent)}, ceiling {moneyText(ceiling)}.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums">{formatMoney(s, currency)}</span>
        <span className="text-muted-foreground">of {formatMoney(c, currency)} ceiling</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={c}
        aria-valuenow={Math.min(s, c)}
        aria-label="Spent this month against the ceiling"
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-chart-3" style={{ width: `${c > 0 ? Math.min(100, (s / c) * 100) : 0}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{daysLeft} days left this month</p>
    </div>
  );
}
