import { cn } from "@/lib/utils";
import { PeaksGlyph } from "./peaks-glyph";

/**
 * Peaks — render a Peaks amount with the coin glyph. Two forms:
 *   <Peaks amount={1240} pill />          balance chip (header)
 *   <Peaks amount={1240} unit="Peaks" />  inline balance / cost row
 *
 * The amount is set in the numeric face (Space Grotesk, tabular) so digits
 * align. Use `pill` for header balance chips; the plain form inline in copy or
 * cost rows ("This action costs 5 Peaks"). The glyph always carries the brand
 * gradient — see PeaksGlyph.
 */
interface PeaksProps {
  amount: number;
  /** Optional trailing label, e.g. "Peaks". */
  unit?: string;
  /** Amber-soft rounded chip styling for header balances. */
  pill?: boolean;
  /** Override the coin size (px). Defaults: 18 (pill), 20 (inline). */
  glyphSize?: number;
  className?: string;
}

export function Peaks({ amount, unit, pill = false, glyphSize, className }: PeaksProps) {
  const num = (
    <span
      className="font-semibold tabular-nums"
      style={{ fontFamily: "var(--font-space-grotesk)" }}
    >
      {amount.toLocaleString()}
    </span>
  );

  if (pill) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-(--brand-soft,oklch(0.95_0.045_78)) px-2.5 py-1 text-sm text-foreground",
          className,
        )}
      >
        <PeaksGlyph size={glyphSize ?? 18} />
        {num}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)}>
      <PeaksGlyph size={glyphSize ?? 20} />
      {num}
      {unit && <span className="text-muted-foreground">{unit}</span>}
    </span>
  );
}
