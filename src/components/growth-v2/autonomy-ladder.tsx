import { Progress } from "@/components/ui/progress";
import type { AutonomyLevel, RulesResponse } from "@/lib/api/growth-v2";
import { cn } from "@/lib/utils";

/**
 * How much the engine may do on its own, as a four-rung ladder (from
 * stepper-progress-2).
 *
 * The engine earns each rung. L1 to L2 takes 5 cleared decisions; L2 to L3 takes
 * 8 weeks at L2 with no demotion (plan 2.1). It only ever offers a promotion, as
 * a decision, and a bad result on an autonomous action drops it back one level.
 */
export const PROMOTE_TO_L2_AFTER = 5;
export const PROMOTE_TO_L3_WEEKS = 8;

const RUNGS: Array<{ level: AutonomyLevel; name: string; body: string }> = [
  { level: 0, name: "Observe", body: "Reads your data and reports. Never spends." },
  { level: 1, name: "Propose", body: "Proposes every change. You approve each one." },
  {
    level: 2,
    name: "Autopilot",
    body: "Moves money between channels at the same total, pauses weak campaigns and uses creatives you approved. You get a receipt with Undo.",
  },
  { level: 3, name: "Grow", body: "Also raises spend, up to your ceiling, when an extra outcome costs less than your target." },
];

interface AutonomyLadderProps {
  level: AutonomyLevel;
  /** Decisions whose tripwire cleared at this level. */
  clearedDecisions: number;
  /** When the current level began (ISO). */
  since: string;
  offeredPromotion?: RulesResponse["autonomy"]["offeredPromotion"];
  lastDemotion?: { at: string; reason: string };
  /** The clock for "weeks at this level". */
  now: number;
}

/** Whole weeks between two instants, never negative. */
export function weeksAtLevel(sinceIso: string, now: number): number {
  const since = new Date(sinceIso).getTime();
  return Number.isNaN(since) ? 0 : Math.max(0, Math.floor((now - since) / (7 * 86_400_000)));
}

export function AutonomyLadder({ level, clearedDecisions, since, offeredPromotion, lastDemotion, now }: AutonomyLadderProps) {
  const weeks = weeksAtLevel(since, now);
  return (
    <div>
      <ol className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4" aria-label="Autonomy levels">
        {RUNGS.map((r) => {
          const done = r.level < level;
          const current = r.level === level;
          return (
            <li
              key={r.level}
              aria-current={current ? "step" : undefined}
              className={cn(
                "grid content-start gap-1 border-t-4 p-3.5",
                done ? "border-success" : current ? "border-chart-1 bg-chart-1/5" : "border-border",
              )}
            >
              <span className="font-mono text-xs text-muted-foreground">
                L{r.level}
                {current ? " · current" : done ? " · earned" : ""}
              </span>
              <b className="text-[15px]">{r.name}</b>
              <p className="text-sm text-muted-foreground">{r.body}</p>
              {current && r.level === 1 ? (
                <Meter label={`${Math.min(clearedDecisions, PROMOTE_TO_L2_AFTER)} of ${PROMOTE_TO_L2_AFTER} cleared decisions to unlock Autopilot`} value={clearedDecisions / PROMOTE_TO_L2_AFTER} />
              ) : null}
              {current && r.level === 2 ? (
                <Meter label={`${Math.min(weeks, PROMOTE_TO_L3_WEEKS)} of ${PROMOTE_TO_L3_WEEKS} weeks at Autopilot to unlock Grow`} value={weeks / PROMOTE_TO_L3_WEEKS} />
              ) : null}
              {r.level === 3 && level < 3 ? (
                <p className="text-xs text-muted-foreground">Unlocks after {PROMOTE_TO_L3_WEEKS} weeks at Autopilot.</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {offeredPromotion ? (
        <p className="mt-3 text-sm">
          The engine has offered to move up to L{offeredPromotion.to}. It is waiting in Decisions.
        </p>
      ) : null}
      {lastDemotion ? (
        <p className="mt-3 text-sm text-muted-foreground">The engine stepped back a level on its own: {lastDemotion.reason}</p>
      ) : null}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-1 space-y-1">
      <Progress value={Math.max(0, Math.min(1, value)) * 100} aria-label={label} indicatorClassName="bg-chart-1" className="h-1.5 bg-muted" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
