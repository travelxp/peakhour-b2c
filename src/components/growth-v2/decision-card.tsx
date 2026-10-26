import { Check, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecisionAction, DecisionView } from "@/lib/api/growth-v2";
import { describeImpact, describeOp, KIND_LABEL, STATUS_LABEL } from "@/lib/growth-v2-decisions";
import { formatDay, formatMoney, hoursUntil } from "@/lib/growth-v2-figure";
import { cn } from "@/lib/utils";
import { ToneBadge, type Tone } from "./tone";

/**
 * One decision in full, with the Growth Council's seats (from inbox7's detail
 * pane).
 *
 * The council is four seats, and the card shows all four as the api sends them:
 * the strategist's case, the critic's objection (a different model vendor), the
 * chair's ruling, and the risk officer's checklist, which is rules, not a model.
 * A decision with no `council` block simply has no seats; none are invented.
 *
 * Actions are the caller's: pass `onAction` to enable them, or `actionsDisabled`
 * with a reason (a preview sample must not pretend to approve anything).
 */
interface DecisionCardProps {
  decision: DecisionView;
  currency: string;
  /** What one outcome is called. */
  unit: { one: string; many: string };
  /** The clock for "expires in". Passed in so a preview can freeze it. */
  now: number;
  onAction?: (action: DecisionAction) => void;
  /** Why the buttons are off, shown beside them. */
  actionsDisabled?: string;
  pending?: boolean;
  className?: string;
}

const STATUS_TONE: Partial<Record<DecisionView["status"], Tone>> = {
  proposed: "info",
  applied: "good",
  approved: "good",
  failed: "bad",
  held: "warn",
  reverted: "neutral",
};

export function DecisionCard({ decision: d, currency, unit, now, onAction, actionsDisabled, pending, className }: DecisionCardProps) {
  const impact = d.impact ? describeImpact(d.impact, currency, unit) : undefined;
  const canAct = d.status === "proposed" && d.needsPerson;
  const left = d.expiresAt ? hoursUntil(d.expiresAt, now) : undefined;
  const expired = d.expiresAt !== undefined && left === 0 && new Date(d.expiresAt).getTime() <= now;
  const off = pending || actionsDisabled !== undefined || !onAction || expired;
  // Undo lasts 24 hours from when it was applied (plan 2.4). Without a time we cannot say it has passed.
  const appliedAt = d.decidedBy?.at ? new Date(d.decidedBy.at).getTime() : Number.NaN;
  const undoOpen = Number.isNaN(appliedAt) || now - appliedAt < 24 * 3_600_000;

  return (
    <article className={cn("grid min-w-0 content-start gap-4", className)}>
      <div className="flex flex-wrap gap-2">
        {d.council ? <ToneBadge tone="ai">Growth Council</ToneBadge> : null}
        <ToneBadge>{KIND_LABEL[d.kind]}</ToneBadge>
        <ToneBadge tone={STATUS_TONE[d.status] ?? "neutral"} dot>
          {STATUS_LABEL[d.status]}
        </ToneBadge>
        {d.status === "proposed" && !d.needsPerson ? <ToneBadge tone="good">Within your mandate</ToneBadge> : null}
      </div>

      <h2 className="text-balance text-lg font-semibold">{d.title}</h2>
      <p className="text-sm text-muted-foreground">{d.summary}</p>

      {impact ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg bg-muted px-3 py-2.5">
            <b className="block text-lg font-semibold tabular-nums">{impact.range}</b>
            <span className="text-xs text-muted-foreground">{impact.caption}</span>
          </div>
          {d.ops.length > 1 ? (
            <div className="rounded-lg bg-muted px-3 py-2.5">
              <b className="block text-lg font-semibold tabular-nums">{d.ops.length} steps</b>
              <span className="text-xs text-muted-foreground">applied in order, each within the safe step size</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {d.ops.length > 0 ? (
        <section aria-label="What would change">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">What changes</h3>
          <ul className="space-y-1 text-sm">
            {d.ops.map((op, i) => (
              <li key={`${op.platform}-${op.campaignRef}-${op.op}-${i}`}>{describeOp(op, currency)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.council ? (
        <div className="grid gap-2.5">
          <Seat who="Strategist" tone="info" model={d.council.strategist.model}>
            {d.council.strategist.text}
          </Seat>
          <Seat who="Critic" tone="warn" model={d.council.critic.model}>
            {d.council.critic.text}
          </Seat>
          <Seat who="Chair's decision" tone="neutral">
            {d.council.chair.text}
          </Seat>
          <section className="grid gap-1 rounded-lg border p-3" aria-label="Risk check">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ToneBadge tone={d.council.risk.checks.every((c) => c.pass) ? "good" : "warn"}>Risk check</ToneBadge>
              <span className="font-normal text-muted-foreground">rules, not a model</span>
            </div>
            <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {d.council.risk.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-1.5">
                  {c.pass ? (
                    <Check aria-label="Passed" className="mt-0.5 size-4 shrink-0 text-success-on-tint" />
                  ) : (
                    <X aria-label="Needs attention" className="mt-0.5 size-4 shrink-0 text-warning-on-tint" />
                  )}
                  <span>{c.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {d.tripwire ? (
        <p className="rounded-lg border border-dashed p-3 text-sm">
          <b className="font-medium">Tripwire:</b> if {d.tripwire.metric.replace(/_/g, " ")} goes {d.tripwire.op === "gt" ? "above" : "below"}{" "}
          <span className="tabular-nums">{d.tripwire.metric === "cost_per_outcome" ? formatMoney(d.tripwire.threshold, currency) : d.tripwire.threshold}</span> by{" "}
          {formatDay(d.tripwire.checkBy)}, {d.tripwire.onTrip === "reverse" ? "this is reversed on its own and you are told" : "you are told"}.
        </p>
      ) : null}

      {canAct ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={off} onClick={() => onAction?.("approve")}>
            Approve
          </Button>
          <Button variant="outline" disabled={off} onClick={() => onAction?.("hold")}>
            Hold
          </Button>
          <Button variant="ghost" disabled={off} onClick={() => onAction?.("reject")}>
            Reject
          </Button>
          <span className="text-xs text-muted-foreground">
            {actionsDisabled ??
              (expired
                ? "This expired and nothing changed."
                : left === undefined
                  ? "If you don't answer, nothing changes."
                  : `Expires in ${left}h. If you don't answer, nothing changes.`)}
          </span>
        </div>
      ) : d.status === "applied" && d.ops.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={off || !undoOpen} onClick={() => onAction?.("undo")}>
            <Undo2 aria-hidden /> Undo
          </Button>
          <span className="text-xs text-muted-foreground">{actionsDisabled ?? (undoOpen ? "Undo works for 24 hours after it was applied." : "The 24-hour undo window has passed.")}</span>
        </div>
      ) : null}
    </article>
  );
}

function Seat({ who, tone, model, children }: { who: string; tone: Tone; model?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1 rounded-lg border p-3" aria-label={who}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <ToneBadge tone={tone}>{who}</ToneBadge>
        {model ? <span className="font-mono font-normal text-muted-foreground">{model}</span> : null}
      </div>
      <p className="text-sm">{children}</p>
    </section>
  );
}
