"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChangeOutcome } from "@/components/presence/edit/change-outcome";
import { cardActions, errorWords, fieldTitle, statusWords, valueLines, type CapabilitiesResponse, type ChangeCardData, type ChangeOutcomeItem } from "@/lib/presence-edit";
import type { usePresenceEditMutations } from "@/hooks/use-presence-edit";

const TONE: Record<string, string> = {
  neutral: "text-muted-foreground",
  good: "text-success-on-tint",
  warn: "text-warning-on-tint",
  bad: "text-destructive",
};

function Lines({ field, value }: { field: string; value: unknown }) {
  const lines = valueLines(field, value);
  if (lines.length === 0) return <span className="text-muted-foreground">Nothing set</span>;
  return (
    <>
      {lines.map((l, i) => (
        <span key={i} className="block break-words">
          {l}
        </span>
      ))}
    </>
  );
}

/**
 * One change as a before-and-after card, with the state the engine reports in plain words.
 *
 * MARKUP ONLY. The words and which buttons a role gets are in `lib/presence-edit.ts`. ★A change is "live" only when the engine says so.
 */
export function ChangeCard({
  change,
  label,
  can,
  m,
  extra,
  outcome,
}: {
  change: ChangeCardData;
  label: string;
  /** Something to show with the change (a photo's picture), drawn under the title. */
  extra?: React.ReactNode;
  /** What followed this change, from the list owner's one request (`outcomeFor`, only for a change that `showsOutcome`). */
  outcome?: ChangeOutcomeItem | null;
  can: CapabilitiesResponse["can"] | undefined;
  /** One set of mutations for the whole list, owned by the card that lists the changes. */
  m: Pick<ReturnType<typeof usePresenceEditMutations>, "approve" | "reject" | "undo">;
}) {
  const words = statusWords(change, label, can);
  const act = cardActions(change, can);
  const title = fieldTitle(change.field);
  const busy = m.approve.isPending || m.reject.isPending || m.undo.isPending;
  // Only the card the failed press was for shows it, and a new press clears it.
  const mine = (v: unknown) => v === change.id;
  const failure = (mine(m.approve.variables) && m.approve.error) || (mine(m.reject.variables) && m.reject.error) || (mine(m.undo.variables) && m.undo.error) || null;
  const issues = change.validation?.issues ?? [];

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex gap-2">
          {change.riskTier !== "ordinary" && <Badge variant="outline">{change.riskTier === "risky" ? "Needs care" : "Check this one"}</Badge>}
          {change.source === "assistant" && <Badge variant="secondary">Suggested by Ask Peakhour</Badge>}
          {change.undone && <Badge variant="secondary">Undone</Badge>}
        </div>
      </div>

      {extra}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Now</p>
          <Lines field={change.field} value={change.before} />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">After this change</p>
          <Lines field={change.field} value={change.after} />
        </div>
      </div>

      <div role="status">
        <p className={`text-sm font-medium ${TONE[words.tone]}`}>{words.headline}</p>
        {words.detail && <p className="text-xs text-muted-foreground">{words.detail}</p>}
      </div>

      <ChangeOutcome outcome={outcome} />

      {change.notes.map((n, i) => (
        <p key={i} className="text-xs text-warning-on-tint">
          {n}
        </p>
      ))}
      {issues.map((i, k) => (
        <p key={k} className="text-xs text-destructive">
          {i.message}
        </p>
      ))}
      {act.needsAdmin && <p className="text-xs text-muted-foreground">Only an admin or owner can approve a change.</p>}
      {failure ? <p className="text-xs text-destructive">{errorWords(failure)}</p> : null}

      {(act.approve || act.reject || act.undo) && (
        <div className="flex flex-wrap gap-2">
          {act.approve && (
            <Button size="sm" disabled={busy} onClick={() => m.approve.mutate(change.id)}>
              {m.approve.isPending ? "Approving..." : "Approve"}
            </Button>
          )}
          {act.reject && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => m.reject.mutate(change.id)}>
              Decline
            </Button>
          )}
          {act.undo && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => m.undo.mutate(change.id)}>
              Undo (needs approval)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
