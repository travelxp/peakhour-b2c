import { formatMoney } from "@/lib/growth-v2-figure";
import { waterfallBars, type WaterfallItem } from "@/lib/growth-v2-chart";
import { niceScale, scale } from "./svg";

/**
 * Why a number moved, one cause at a time (from chart-card15).
 *
 * The first and last bars are the start and end totals; the ones between are the
 * changes that explain the gap. For a cost, down is good (green) and up is bad
 * (red); for a return (`higherIsBetter`) it is the other way round.
 *
 * A cause with no figure is drawn as a dashed placeholder labelled "n/a" and
 * moves nothing. If a total has no figure the chart is replaced by a sentence.
 */
interface WhyWaterfallProps {
  items: WaterfallItem[];
  /** Money currency; omit for a unitless figure (a return). */
  currency?: string;
  higherIsBetter?: boolean;
}

const W = 520;
const H = 230;
const L = 44;
const B = 40;
const T = 22;

export function WhyWaterfall({ items, currency, higherIsBetter = false }: WhyWaterfallProps) {
  const bars = waterfallBars(items);
  if (bars.length === 0) {
    return (
      <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Not available: the start or end figure is missing, so the causes can&apos;t be laid out.
      </p>
    );
  }
  const fmt = (n: number) => (currency ? formatMoney(n, currency) : n.toFixed(1));
  const signed = (n: number) => `${n > 0 ? "+" : "−"}${fmt(Math.abs(n))}`;

  // Every level the walk reaches. A total's bar starts at the axis floor, not at 0.
  const levels = bars.flatMap((b) => (b.kind === "total" ? [b.value] : b.kind === "absent" ? (b.at !== undefined ? [b.at] : []) : [b.from, b.to]));
  // Start the axis a little under the lowest level so small changes stay visible.
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  const span = hi - lo || Math.abs(hi) || 1;
  const min = Math.max(0, lo - span * 0.6);
  const { top: scaleTop, ticks: yTicks } = niceScale(hi + span * 0.1 - min);
  const max = min + scaleTop;
  const y = scale(min, max, H - B, T);
  const bw = Math.min(56, (W - L - 10) / (bars.length * 1.3));
  const gap = bars.length > 1 ? (W - L - 10 - bw * bars.length) / (bars.length - 1) : 0;

  const good = (kind: "up" | "down") => (higherIsBetter ? kind === "up" : kind === "down");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Walk from ${bars[0].label} to ${bars[bars.length - 1].label}`}>
      <g className="stroke-border">
        {yTicks.map((t) => {
          const v = min + t;
          return (
            <g key={t}>
              <line x1={L} x2={W - 10} y1={y(v)} y2={y(v)} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground stroke-none text-[11px]">
                {fmt(Math.round(v))}
              </text>
            </g>
          );
        })}
      </g>
      {bars.map((b, i) => {
        const x = L + i * (bw + gap);
        const [l1, l2] = splitLabel(b.label);
        const label = (
          <>
            <text x={x + bw / 2} y={H - 22} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {l1}
            </text>
            {l2 ? (
              <text x={x + bw / 2} y={H - 9} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {l2}
              </text>
            ) : null}
          </>
        );
        if (b.kind === "absent") {
          const at = b.at !== undefined ? y(b.at) : y(min);
          return (
            <g key={`${b.label}-${i}`} data-absent="">
              <rect x={x} y={at - 8} width={bw} height={16} rx={4} fill="none" stroke="var(--muted-foreground)" strokeDasharray="3 3">
                <title>{`${b.label}: not available. ${b.reason}`}</title>
              </rect>
              <text x={x + bw / 2} y={at + 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                n/a
              </text>
              {label}
            </g>
          );
        }
        const from = Math.max(b.from, min);
        const top = y(Math.max(from, b.to));
        const h = Math.abs(y(from) - y(b.to));
        const fill = b.kind === "total" ? "var(--muted-foreground)" : good(b.kind) ? "var(--success)" : "var(--destructive)";
        return (
          <g key={`${b.label}-${i}`}>
            <rect x={x} y={top} width={bw} height={Math.max(h, 2)} rx={4} fill={fill} opacity={b.kind === "total" ? 0.55 : 1}>
              <title>{`${b.label}: ${b.kind === "total" ? fmt(b.value) : signed(b.value)}`}</title>
            </rect>
            <text x={x + bw / 2} y={top - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
              {b.kind === "total" ? fmt(b.value) : signed(b.value)}
            </text>
            {label}
          </g>
        );
      })}
    </svg>
  );
}

/** Two short lines for an axis label: the first two words, then the rest. */
function splitLabel(label: string): [string, string] {
  const words = label.split(" ");
  return [words.slice(0, 2).join(" "), words.slice(2).join(" ")];
}
