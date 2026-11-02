import type { AdPlatform, ChannelsResponse } from "@/lib/api/growth-v2";
import { PLATFORM_COLOR, PLATFORM_LABEL, figureValue, formatDay, formatPercent } from "@/lib/growth-v2-figure";
import { uncoveredShare } from "@/lib/growth-v2-chart";
import { scale } from "./svg";

/**
 * Each platform's share of the week's budget, week by week (from chart-card11).
 *
 * Stacked bars to 100%. A share the api could not give is left out of the stack
 * and the gap is hatched, so a week with a missing platform visibly does not add
 * up, instead of silently growing the others.
 */
interface ShareByWeekProps {
  weeks: ChannelsResponse["shareByWeek"];
}

const W = 520;
const H = 260;
const L = 36;
const R = 8;
const T = 10;
const B = 30;

export function ShareByWeek({ weeks }: ShareByWeekProps) {
  if (weeks.length === 0) {
    return (
      <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No weekly budget history yet.
      </p>
    );
  }
  const platforms = [...new Set(weeks.flatMap((w) => w.shares.map((s) => s.platform)))] as AdPlatform[];
  const step = (W - L - R) / weeks.length;
  const bw = step * 0.62;
  const y = scale(0, 1, H - B, T);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Share of budget by platform, by week">
        <g className="stroke-border">
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground stroke-none text-[11px]">
                {formatPercent(v)}
              </text>
            </g>
          ))}
        </g>
        {weeks.map((w, i) => {
          const x = L + i * step + (step - bw) / 2;
          let acc = 0;
          const gap = uncoveredShare(w.shares);
          return (
            <g key={w.weekStart}>
              {w.shares.map((s) => {
                const v = figureValue(s.share);
                if (v === undefined) return null;
                const seg = (
                  <rect key={s.platform} x={x} y={y(acc + v)} width={bw} height={Math.max(y(acc) - y(acc + v), 0)} fill={PLATFORM_COLOR[s.platform]}>
                    <title>{`${PLATFORM_LABEL[s.platform]}, week of ${formatDay(w.weekStart)}: ${formatPercent(v)}`}</title>
                  </rect>
                );
                acc += v;
                return seg;
              })}
              {gap > 0.005 ? (
                <rect data-absent="" x={x} y={y(acc + gap)} width={bw} height={Math.max(y(acc) - y(acc + gap), 0)} fill="none" stroke="var(--muted-foreground)" strokeDasharray="3 3">
                  <title>{`Week of ${formatDay(w.weekStart)}: ${formatPercent(gap)} has no figure`}</title>
                </rect>
              ) : null}
              <text x={x + bw / 2} y={H - 12} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {formatDay(w.weekStart)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {platforms.map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[p] }} />
            {PLATFORM_LABEL[p]}
          </li>
        ))}
      </ul>
    </div>
  );
}
