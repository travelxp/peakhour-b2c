import type { ChannelsResponse } from "@/lib/api/growth-v2";
import { PLATFORM_COLOR, PLATFORM_LABEL, absentReason, figureValue, formatCount, formatMoney } from "@/lib/growth-v2-figure";
import { niceScale, scale } from "./svg";

/**
 * Spend against extra outcomes, one bubble per channel (from chart-card24).
 *
 * Up and to the left is better: more outcomes for less money. A channel is
 * plotted only when both its spend and its outcomes are present; the rest are
 * listed under the chart with the reason. Bubble size is fixed, because the
 * response carries no third measure to size by.
 */
interface ChannelBubblesProps {
  bubbles: ChannelsResponse["bubbles"];
  /** What one outcome is called, plural, e.g. "bookings". */
  unitPlural: string;
}

const W = 520;
const H = 260;
const L = 48;
const R = 16;
const T = 18;
const B = 36;

export function ChannelBubbles({ bubbles, unitPlural }: ChannelBubblesProps) {
  const plotted = bubbles.flatMap((b) => {
    const spend = figureValue(b.spend);
    const outcomes = figureValue(b.outcomes);
    return spend !== undefined && outcomes !== undefined ? [{ b, spend, outcomes }] : [];
  });
  const missing = bubbles.filter((b) => figureValue(b.spend) === undefined || figureValue(b.outcomes) === undefined);

  if (plotted.length === 0) {
    return (
      <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Not available: no channel has both a spend and a count of {unitPlural}.
      </p>
    );
  }

  const currency = plotted.map((p) => p.b.spend).flatMap((m) => ("currency" in m ? [m.currency] : []))[0] ?? "";
  const { top: maxX, ticks: xTicks } = niceScale(Math.max(...plotted.map((p) => p.spend)) * 1.1);
  const { top: maxY, ticks: yTicks } = niceScale(Math.max(...plotted.map((p) => p.outcomes)) * 1.2);
  const x = scale(0, maxX, L, W - R);
  const y = scale(0, maxY, H - B, T);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Spend against extra ${unitPlural} for ${plotted.map((p) => PLATFORM_LABEL[p.b.platform]).join(", ")}`}>
        <g className="stroke-border">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground stroke-none text-[11px]">
                {formatCount(v)}
              </text>
            </g>
          ))}
        </g>
        {xTicks.map((v) => (
          <text key={`x${v}`} x={x(v)} y={H - 16} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {currency ? formatMoney(v, currency) : formatCount(v)}
          </text>
        ))}
        <text x={W - R} y={H - 2} textAnchor="end" className="fill-muted-foreground text-[11px]">
          spend this month
        </text>
        <text x={L} y={T - 6} className="fill-muted-foreground text-[11px]">
          extra {unitPlural}
        </text>
        {plotted.map(({ b, spend, outcomes }) => {
          const eff = figureValue(b.efficiency);
          const color = PLATFORM_COLOR[b.platform];
          return (
            <g key={b.platform}>
              <circle cx={x(spend)} cy={y(outcomes)} r={14} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={2}>
                <title>{`${PLATFORM_LABEL[b.platform]}: ${currency ? formatMoney(spend, currency) : formatCount(spend)} for ${formatCount(outcomes)} extra ${unitPlural}`}</title>
              </circle>
              <text x={x(spend)} y={y(outcomes) - 20} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                {PLATFORM_LABEL[b.platform]}
                {eff !== undefined ? ` · ${currency ? formatMoney(eff, currency) : formatCount(eff)}/extra` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {missing.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {missing.map((b) => (
            <li key={b.platform} data-absent="">
              Not plotted: {PLATFORM_LABEL[b.platform]}
              {absentReason(b.outcomes) ?? absentReason(b.spend) ? ` (${absentReason(b.outcomes) ?? absentReason(b.spend)})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
