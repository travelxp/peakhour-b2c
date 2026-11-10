import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { deltaSentence, deltaText, type PeriodDelta } from "@/lib/period-delta";

/**
 * "+12% vs last week" under a figure. Renders nothing when there is no prior
 * period (`delta` null): an empty slot is honest, "0%" is not.
 *
 * The visible text is short and the arrow is decoration; a screen reader gets
 * the full sentence ("People: up 12% compared with the week before.") instead.
 * Colour is never the only signal: the sign, the arrow and the words carry it.
 */
export function DeltaChip({
  delta,
  label,
  vs,
  comparedWith,
  lowerIsBetter = false,
  className,
}: {
  delta: PeriodDelta | null | undefined;
  /** What the figure is, for the spoken sentence: "People". */
  label: string;
  /** Short visible tail: "vs last week". */
  vs: string;
  /** Spoken tail: "the week before". */
  comparedWith: string;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  if (!delta) return null;
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1 text-xs font-medium",
        delta.tone === "good" && "text-success-on-tint",
        delta.tone === "bad" && "text-destructive-on-tint",
        delta.tone === "neutral" && "text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className="inline-flex items-center gap-0.5">
        <Icon className="size-3" />
        {deltaText(delta)}
        <span className="font-normal text-muted-foreground">{vs}</span>
      </span>
      <span className="sr-only">{deltaSentence(label, delta, comparedWith, lowerIsBetter)}</span>
    </span>
  );
}
