import type { LearningResponse } from "@/lib/api/growth-v2";
import { ABSENT_LABEL, absentReason, figureValue, formatChange, formatDay, formatPercent } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { ToneBadge, type Tone } from "./tone";

/**
 * Every bet the engine made, newest first, with how it was judged (from timeline-activity-1).
 *
 * A holdout shows the share of outcomes the ads caused, with its range once the reading has power; a council bet is
 * judged by its tripwire and has no lift. A verdict badge appears only where the api gave a verdict. Without one the
 * badge says what state the experiment is in: starting, running, abandoned, or ended without enough data to judge.
 */
type Experiment = LearningResponse["experiments"][number];

const LOOK: Record<string, { tone: Tone; pin: string; label: string }> = {
  winner: { tone: "good", pin: "border-success bg-success", label: "Won" },
  loser: { tone: "bad", pin: "border-destructive bg-destructive", label: "Lost" },
  inconclusive: { tone: "neutral", pin: "border-muted-foreground bg-card", label: "Inconclusive" },
  running: { tone: "warn", pin: "border-chart-1 bg-card shadow-[inset_0_0_0_4px_var(--chart-1)]", label: "Running" },
  rolling_out: { tone: "info", pin: "border-chart-1 bg-card", label: "Starting" },
  abandoned: { tone: "neutral", pin: "border-dashed border-muted-foreground bg-card", label: "Abandoned" },
  ended: { tone: "neutral", pin: "border-muted-foreground bg-card", label: "Ended, not enough data to judge" },
};

export function experimentLook(e: Pick<Experiment, "verdict" | "status">) {
  // A status we do not know is shown as it came, neutral, and never as a reason the api did not give.
  return LOOK[e.verdict ?? e.status] ?? { tone: "neutral" as Tone, pin: "border-muted-foreground bg-card", label: e.status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) };
}

/** The lift sentence for one experiment: the share the ads caused with its range, or why there is none. */
export function LiftLine({ e }: { e: Experiment }) {
  const lift = figureValue(e.lift);
  if (lift === undefined) {
    // A council bet has no lift by design: its reason is the sentence, not a missing figure.
    return e.kind === "council_bet" ? (
      <span>{absentReason(e.lift)}</span>
    ) : (
      <span data-absent="">
        {ABSENT_LABEL}: {absentReason(e.lift)}
      </span>
    );
  }
  const low = figureValue(e.liftLow);
  const high = figureValue(e.liftHigh);
  // A negative share means the held-out areas did better than the areas with ads: said so, not as "ads caused -8%".
  if (e.kind === "holdout" && lift < 0) {
    return (
      <>
        Areas with ads did <b className="font-medium tabular-nums text-foreground">{formatPercent(-lift)}</b> worse than the held-out areas
        {low !== undefined && high !== undefined ? <span className="tabular-nums"> (range {formatPercent(low)} to {formatPercent(high)})</span> : null}
      </>
    );
  }
  return (
    <>
      {e.kind === "holdout" ? "Ads caused " : "Lift "}
      <b className="font-medium tabular-nums text-foreground">{e.kind === "holdout" ? formatPercent(lift) : formatChange(lift)}</b>
      {e.kind === "holdout" ? " of outcomes" : null}
      {low !== undefined && high !== undefined ? <span className="tabular-nums"> (range {formatPercent(low)} to {formatPercent(high)})</span> : null}
    </>
  );
}

export function ExperimentTimeline({ experiments }: { experiments: Experiment[] }) {
  if (experiments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No experiments yet. The engine will list each bet here before it is judged.</p>;
  }
  return (
    <ol className="grid">
      {experiments.map((e, i) => {
        const look = experimentLook(e);
        return (
          <li key={e.id} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
            {i < experiments.length - 1 ? <span aria-hidden className="absolute bottom-0 left-[9px] top-[18px] w-0.5 bg-border" /> : null}
            <span aria-hidden className={cn("mt-0.5 size-5 rounded-full border-2", look.pin)} />
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <ToneBadge tone={look.tone} dot>
                  {look.label}
                </ToneBadge>
                <span className="text-xs text-muted-foreground">{e.kind === "holdout" ? "Holdout" : "Council bet"}</span>
                {e.startedAt ? <span className="text-xs text-muted-foreground">Started {formatDay(e.startedAt)}</span> : null}
              </div>
              <h3 className="break-words text-sm font-semibold">{e.title}</h3>
              <p className="text-sm text-muted-foreground">
                <LiftLine e={e} />
              </p>
              {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
