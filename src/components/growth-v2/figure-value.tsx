import type { Figure, Money } from "@/lib/api/growth-v2";
import { ABSENT_LABEL, absentReason, formatCount, formatMoney, figureValue } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";

/**
 * A plan 2.10 figure on screen.
 *
 * ★ABSENT IS A LABELLED ABSENCE, NEVER A 0. `{ absent: reason }` renders the
 * words "Not available" with the reason beside them (in `title` and for
 * assistive tech, and inline with `showReason`). There is no code path from an
 * absent figure to a digit: the value branch is the only one that formats a
 * number, and it is reached only through `figureValue`.
 */
interface FigureValueProps {
  figure: Figure | undefined;
  /** How to print a present value. Defaults to a grouped count. */
  format?: (n: number) => string;
  /** Print the reason after the label, not just in the tooltip. */
  showReason?: boolean;
  className?: string;
}

export function FigureValue({ figure, format = formatCount, showReason = false, className }: FigureValueProps) {
  const value = figureValue(figure);
  if (value !== undefined) {
    return <span className={cn("tabular-nums", className)}>{format(value)}</span>;
  }
  return <Absence reason={absentReason(figure)} showReason={showReason} className={className} />;
}

/** A money figure in its own currency; absent renders the same labelled absence. */
export function MoneyValue({ money, showReason = false, className }: { money: Money | undefined; showReason?: boolean; className?: string }) {
  if (money !== undefined && "value" in money) {
    return <span className={cn("tabular-nums", className)}>{formatMoney(money.value, money.currency)}</span>;
  }
  return <Absence reason={absentReason(money)} showReason={showReason} className={className} />;
}

function Absence({ reason, showReason, className }: { reason: string | undefined; showReason: boolean; className?: string }) {
  return (
    <span data-absent="" title={reason} className={cn("text-muted-foreground", className)}>
      {ABSENT_LABEL}
      {reason ? (
        showReason ? (
          <span className="ml-1 text-xs font-normal">({reason})</span>
        ) : (
          <span className="sr-only">: {reason}</span>
        )
      ) : null}
    </span>
  );
}
