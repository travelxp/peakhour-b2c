"use client";

import Link from "next/link";
import { Zap, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreditsBalance, getCapStatus, spendableCap } from "@/hooks/use-credits";

/**
 * Peaks balance in the dashboard top bar, as a fuel gauge.
 *
 * ★IT IS A GAUGE RATHER THAN A NUMBER BECAUSE A NUMBER MEANS NOTHING ALONE.
 * "4.2k Peaks" is not information unless you have memorised your plan's
 * allowance; the fill bar answers "am I fine?" without arithmetic, and it does
 * it in the corner of the eye rather than by being read. That is also why the
 * chip earns a border and a fill in the chrome at all — it carries meaning, so
 * it is not decoration competing with the page.
 *
 * ★AND IT ONLY RAISES ITS VOICE AT THE CAPS. Ordinary state is the neutral
 * border and a brand-gold fill; amber and red arrive from `getCapStatus`, which
 * is the api's own `blocked` for the hard case rather than arithmetic done here.
 * A chip that is always saturated is one the user stops seeing by week two,
 * which is exactly when it first needs to be noticed.
 *
 * Unlimited plans get the glyph and no bar: there is no fraction to draw, and a
 * full bar would read as "nearly out" to anyone scanning shapes.
 */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Fill + text per cap state. Verified ≥3:1 for the bar (non-text) and ≥4.5:1
 *  for the label in both themes. */
const CAP_STYLES: Record<
  "none" | "soft" | "hard",
  { text: string; bar: string; ring: string }
> = {
  none: {
    text: "text-foreground",
    bar: "bg-brand-strong",
    ring: "border-border hover:border-brand/50",
  },
  soft: {
    text: "text-warning-on-tint",
    bar: "bg-warning",
    ring: "border-warning/40 hover:border-warning/70",
  },
  hard: {
    text: "text-destructive-on-tint",
    bar: "bg-destructive",
    ring: "border-destructive/45 hover:border-destructive/75",
  },
};

export function BalanceChip() {
  const { data: balance } = useCreditsBalance();

  if (!balance) return null;

  const capStatus = getCapStatus(balance);
  const styles = CAP_STYLES[capStatus];

  if (balance.unlimited) {
    return (
      <Link
        href="/dashboard/peaks"
        title="Unlimited Peaks — click for the rate card"
        className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground sm:inline-flex"
      >
        <Zap className="size-3.5 text-brand-strong" aria-hidden />
        <InfinityIcon className="size-3.5" aria-hidden />
        <span>Peaks</span>
      </Link>
    );
  }

  const cap = spendableCap(balance);
  // Guard the divide: a plan misconfigured to a zero cap would otherwise make
  // this NaN and the bar would silently not render.
  const pct = cap > 0 ? Math.max(0, Math.min(100, (balance.remaining / cap) * 100)) : 0;
  // A sliver rather than nothing at 0.4%: a bar that disappears entirely reads
  // as "this element failed to load", not as "you are nearly out".
  const width = balance.remaining > 0 ? Math.max(pct, 3) : 0;

  return (
    <Link
      href="/dashboard/peaks"
      title={`${balance.remaining.toLocaleString()} of ${cap.toLocaleString()} Peaks remaining`}
      className={cn(
        "group hidden flex-col gap-1 rounded-lg border px-2.5 py-1 transition-colors sm:flex",
        styles.ring,
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-xs font-medium leading-none", styles.text)}>
        <Zap className="size-3.5" aria-hidden />
        <span className="tabular-nums">{fmt(balance.remaining)}</span>
        <span className="text-muted-foreground">Peaks</span>
      </span>
      {/* The gauge. `aria-hidden` because the accessible answer is already in
          the link's title and its text — a progressbar role here would make a
          screen reader announce the same figure twice, once as prose and once
          as a percentage. */}
      <span aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full transition-[width] duration-500 ease-brand", styles.bar)}
          style={{ width: `${width}%` }}
        />
      </span>
    </Link>
  );
}
