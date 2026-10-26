import type { HomeResponse } from "@/lib/api/growth-v2";
import { absentReason, figureValue, formatDay, formatPercent } from "@/lib/growth-v2-figure";
import type { LiftWeek } from "@/lib/growth-v2-series";
import { linePath, niceScale, scale } from "./svg";
import { MeasurementBadge } from "./measurement-badge";

/**
 * Outcomes with ads against the holdout, week by week (from chart-card14 + 25).
 *
 * The holdout is the 5-20% of areas we do not advertise in; "with ads" is the
 * rest, scaled to match. The gap between the two lines is what the ads caused,
 * and the shaded band is the range around "with ads".
 *
 * A week without a range draws no band. Low-powered weeks carry no `low`/`high`
 * (plan 2.6); the band stops there rather than being invented. And with no weekly
 * series at all (the api's home response carries none yet) the chart says so
 * instead of drawing a flat line.
 */
interface LiftBandProps {
  weeks: LiftWeek[] | undefined;
  weeklyGoal?: number;
  lift: HomeResponse["lift"];
  /** What one outcome is called, plural: "bookings". */
  unitPlural: string;
}

const W = 640;
const H = 240;
const L = 36;
const R = 12;
const T = 14;
const B = 28;

export function LiftBand({ weeks, weeklyGoal, lift, unitPlural }: LiftBandProps) {
  const liftPct = figureValue(lift.liftPct);
  const confidence = figureValue(lift.confidence);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {liftPct === undefined
          ? `Too early to say how many ${unitPlural} your ads caused. ${absentReason(lift.liftPct) ?? ""}`.trim()
          : `${formatPercent(liftPct)} of ${unitPlural} would not have happened without your ads${
              confidence !== undefined ? ` (${formatPercent(confidence)} confidence)` : ""
            }, over the last ${lift.windowDays} days.`}
      </p>
      <MeasurementBadge state={liftPct === undefined ? "low_power" : "measured"} />
    </div>
  );

  if (!weeks || weeks.length === 0) {
    return (
      <div className="space-y-3">
        {header}
        <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          The week-by-week chart is not available yet.
        </p>
      </div>
    );
  }

  const { top, ticks: yTicks } = niceScale(Math.max(...weeks.map((w) => w.high ?? w.withAds), ...weeks.map((w) => w.holdout), weeklyGoal ?? 0));
  const x = scale(0, Math.max(weeks.length - 1, 1), L, W - R);
  const y = scale(0, top, H - B, T);
  const withAds = weeks.map((w, i) => [x(i), y(w.withAds)] as const);
  const holdout = weeks.map((w, i) => [x(i), y(w.holdout)] as const);
  const last = weeks[weeks.length - 1];

  // One polygon per run of consecutive weeks that all have a range.
  const bands: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) {
      const upper = run.map((i) => [x(i), y(weeks[i].high as number)] as const);
      const lower = run.map((i) => [x(i), y(weeks[i].low as number)] as const).reverse();
      bands.push(`${linePath([...upper, ...lower])}Z`);
    }
    run = [];
  };
  weeks.forEach((w, i) => (w.low !== undefined && w.high !== undefined ? run.push(i) : flush()));
  flush();

  return (
    <div className="space-y-3">
      {header}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Weekly ${unitPlural}: ${last.withAds} with ads against ${last.holdout} in the holdout in the latest week`}
      >
        <g className="stroke-border">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground stroke-none text-[11px]">
                {Math.round(v)}
              </text>
            </g>
          ))}
        </g>
        {weeks.map((w, i) => (
          <text key={w.weekStart} x={x(i)} y={H - 8} textAnchor={i === weeks.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
            {formatDay(w.weekStart)}
          </text>
        ))}
        {bands.map((d) => (
          <path key={d} d={d} fill="var(--chart-1)" fillOpacity={0.18} />
        ))}
        {weeklyGoal !== undefined ? (
          <line x1={L} x2={W - R} y1={y(weeklyGoal)} y2={y(weeklyGoal)} stroke="var(--destructive)" strokeWidth={1.5} strokeDasharray="5 4" />
        ) : null}
        <path d={linePath(holdout)} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="3 3" />
        <path d={linePath(withAds)} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} />
        {withAds.map(([cx, cy], i) => (
          <circle key={weeks[i].weekStart} cx={cx} cy={cy} r={i === weeks.length - 1 ? 4.5 : 3} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={1.5}>
            <title>{`${formatDay(weeks[i].weekStart)}: ${weeks[i].withAds} with ads, ${weeks[i].holdout} without`}</title>
          </circle>
        ))}
        <text x={x(weeks.length - 1) - 6} y={y(last.withAds) - 12} textAnchor="end" className="fill-foreground text-[11px] font-semibold">
          {last.withAds} with ads
        </text>
        <text x={x(weeks.length - 1) - 6} y={y(last.holdout) + 18} textAnchor="end" className="fill-muted-foreground text-[11px]">
          {last.holdout} without
        </text>
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-sm bg-chart-1" />
          With ads
        </li>
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-sm bg-muted-foreground" />
          Without ads (holdout)
        </li>
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-sm bg-chart-1/20" />
          Range
        </li>
        {weeklyGoal !== undefined ? (
          <li className="flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2.5 rounded-sm bg-destructive" />
            Weekly goal {weeklyGoal}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
