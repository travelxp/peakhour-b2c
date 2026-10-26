import { ToneBadge, type Tone } from "./tone";

/**
 * How far a number can be believed (plan 2.6, 2.10).
 *
 * - `measured`: read against a holdout, or from a signal the platform confirms.
 * - `low_power`: a holdout exists but is too small to give a range, so the figure
 *   is withheld rather than guessed.
 * - `partial`: some of the sources behind it are not tracked.
 * - `untracked`: no signal at all. The figure is the platform's claim, if any.
 */
export type MeasurementState = "measured" | "low_power" | "partial" | "untracked";

const MEASUREMENT: Record<MeasurementState, { tone: Tone; label: string }> = {
  measured: { tone: "good", label: "Measured" },
  low_power: { tone: "warn", label: "Too early to tell" },
  partial: { tone: "warn", label: "Partly tracked" },
  untracked: { tone: "neutral", label: "Not tracked" },
};

export function measurementLabel(state: MeasurementState): string {
  return MEASUREMENT[state].label;
}

export function MeasurementBadge({ state, detail, className }: { state: MeasurementState; detail?: string; className?: string }) {
  const m = MEASUREMENT[state];
  return (
    <ToneBadge tone={m.tone} dot className={className}>
      {m.label}
      {detail ? <span className="font-normal opacity-80">: {detail}</span> : null}
    </ToneBadge>
  );
}
