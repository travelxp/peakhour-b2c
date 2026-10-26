import type { LearningResponse } from "@/lib/api/growth-v2";
import { ABSENT_LABEL, absentReason, figureValue, formatChange, formatDay } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { ToneBadge, type Tone } from "./tone";

/**
 * Every bet the engine made, in the order the api gives them, with how it was judged (from
 * timeline-activity-1).
 *
 * Each experiment has a verdict from its tripwire: a winner, a loser, or still
 * running. The lift is shown when there is one; an experiment judged inconclusive
 * or too early says why instead of showing a number.
 */
type Experiment = LearningResponse["experiments"][number];

const LOOK: Record<string, { tone: Tone; pin: string; label: string }> = {
  winner: { tone: "good", pin: "border-success bg-success", label: "Won" },
  loser: { tone: "bad", pin: "border-destructive bg-destructive", label: "Lost" },
  inconclusive: { tone: "neutral", pin: "border-muted-foreground bg-card", label: "Inconclusive" },
  running: { tone: "warn", pin: "border-chart-1 bg-card shadow-[inset_0_0_0_4px_var(--chart-1)]", label: "Running" },
};

export function experimentLook(e: Pick<Experiment, "verdict" | "status">) {
  return LOOK[e.verdict ?? (e.status === "running" ? "running" : "inconclusive")];
}

export function ExperimentTimeline({ experiments }: { experiments: Experiment[] }) {
  if (experiments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No experiments yet. The engine will list each bet here before it is judged.</p>;
  }
  return (
    <ol className="grid">
      {experiments.map((e, i) => {
        const look = experimentLook(e);
        const lift = figureValue(e.lift);
        return (
          <li key={e.id} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
            {i < experiments.length - 1 ? <span aria-hidden className="absolute bottom-0 left-[9px] top-[18px] w-0.5 bg-border" /> : null}
            <span aria-hidden className={cn("mt-0.5 size-5 rounded-full border-2", look.pin)} />
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <ToneBadge tone={look.tone} dot>
                  {look.label}
                </ToneBadge>
                {e.startedAt ? <span className="text-xs text-muted-foreground">Started {formatDay(e.startedAt)}</span> : null}
              </div>
              <h3 className="text-sm font-semibold">{e.title}</h3>
              <p className="text-sm text-muted-foreground">
                {lift !== undefined ? (
                  <>
                    Lift <b className="font-medium tabular-nums text-foreground">{formatChange(lift)}</b>
                  </>
                ) : (
                  <span data-absent="">
                    {ABSENT_LABEL}: {absentReason(e.lift)}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
