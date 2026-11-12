"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChangeOutcome } from "@/components/presence/edit/change-outcome";
import type { usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { cardActions, errorWords, fieldTitle, groupByStage, requestStatus, requestSteps, shortChange, type CapabilitiesResponse, type ChangeCardData, type OutcomeSlot, type Tone } from "@/lib/presence-edit";
import type { PresencePublishing } from "@/lib/presence-panels";
import { requestNeedsYou, requestRowId, SUMMARY_ANCHORS } from "@/lib/presence-summary";

const TONE: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  good: "text-success-on-tint",
  warn: "text-warning-on-tint",
  bad: "text-destructive",
};

type Mutations = Pick<ReturnType<typeof usePresenceEditMutations>, "approve" | "reject" | "undo">;

/**
 * One request: the field, what it changes, where it stands, why, and the one thing to do. MARKUP ONLY: every word and the action come from
 * `requestStatus` in `lib/presence-edit.ts`, the same stage the change cards and Ask Peakhour say.
 */
function RequestRow({
  change,
  label,
  can,
  publishing,
  m,
  onRedo,
  outcome,
  canRedo,
  when,
  now,
}: {
  change: ChangeCardData;
  label: string;
  can: CapabilitiesResponse["can"] | undefined;
  publishing: Pick<PresencePublishing, "blocker" | "heldReason"> | null;
  m: Mutations;
  onRedo: (field: string) => void;
  outcome?: OutcomeSlot | undefined;
  canRedo: (field: string) => boolean;
  when: (iso: string) => string;
  now: number | undefined;
}) {
  const r = requestStatus(change, label, can, publishing, { when, now });
  const steps = requestSteps(change, label, when);
  const busy = m.approve.isPending || m.reject.isPending || m.undo.isPending;
  const failure = (m.approve.variables === change.id && m.approve.error) || (m.reject.variables === change.id && m.reject.error) || (m.undo.variables === change.id && m.undo.error) || null;
  // The one place a sent or live change is put back (the change cards used to hold this button).
  const canUndo = cardActions(change, can).undo;
  const issues = change.validation?.issues ?? [];
  const next = r.next;

  return (
    <li id={requestRowId(change.id)} className="scroll-mt-24 space-y-1 py-3 first:pt-0 last:pb-0" data-testid="request-row" data-stage={r.stage}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">{fieldTitle(change.field)}</p>
        <p className={`text-xs font-medium ${TONE[r.tone]}`}>
          {r.label}
          {change.undone ? " (undone)" : ""}
        </p>
      </div>
      <p className="break-words text-xs text-muted-foreground">{shortChange(change.field, change.before, change.after)}</p>
      {/* Real times only: a step that has not happened is not drawn, and "shows it" is only ever on a live row. */}
      {steps.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="request-steps">
          {steps.join(" · ")}
        </p>
      )}
      {/* What followed a live change: the slot comes from the one outcomes request the page already makes (PE-13), never one per row. */}
      {change.status === "live" && <ChangeOutcome slot={outcome} />}
      {change.source === "assistant" && <p className="text-xs text-muted-foreground">Suggested by Ask Peakhour.</p>}
      {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
      {change.notes.map((n, i) => (
        <p key={`${i}:${n}`} className="text-xs text-warning-on-tint">
          {n}
        </p>
      ))}
      {issues.map((i, k) => (
        <p key={`${k}:${i.message}`} className="text-xs text-destructive">
          {i.message}
        </p>
      ))}
      {failure ? <p className="text-xs text-destructive">{errorWords(failure)}</p> : null}
      {next.kind === "decide" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={busy} onClick={() => m.approve.mutate(change.id)}>
            {m.approve.isPending && m.approve.variables === change.id ? "Approving..." : "Approve"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => m.reject.mutate(change.id)}>
            Decline
          </Button>
        </div>
      )}
      {canUndo && (
        <Button size="sm" variant="outline" className="mt-1 w-fit" disabled={busy} onClick={() => m.undo.mutate(change.id)}>
          Undo (needs approval)
        </Button>
      )}
      {next.kind === "redo" && canRedo(change.field) && (
        <Button size="sm" variant="outline" className="mt-1 w-fit" onClick={() => onRedo(change.field)}>
          {next.label}
        </Button>
      )}
      {next.kind === "fix" && (
        <Button asChild size="sm" variant="outline" className="mt-1 w-fit">
          {next.external ? (
            <a href={next.href} target="_blank" rel="noopener noreferrer">
              {next.label}
            </a>
          ) : (
            <Link href={next.href}>{next.label}</Link>
          )}
        </Button>
      )}
    </li>
  );
}

// Fixed locale and zone, so the server and the browser draw the same text; the page passes its own format (the viewer's zone) in practice.
const defaultWhen = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC`;
};

/** The anchor of one group, so a count in the status line lands on its group. */
const groupAnchor = (id: string) => `requests-group-${id}`;

/**
 * "Your requests": every request in one section. A status line on top counts each stage that has rows (each count links to its group), then
 * the rows sit in groups: what needs the merchant, what is in flight, what finished. Finished rows are drawn, not folded; only requests older
 * than a week sit behind "Show older (N)". The group of a row and every count come from `requestStatus(...).stage` (`groupByStage`).
 */
export function RequestsList({
  open,
  recent,
  older,
  labelFor,
  can,
  publishing,
  m,
  onRedo,
  outcomeFor,
  canRedo,
  formatDateTime,
  now,
}: {
  open: ChangeCardData[];
  recent: ChangeCardData[];
  /** Finished requests past the last week, behind "Show older". */
  older?: ChangeCardData[] | undefined;
  labelFor: (network: string) => string;
  can: CapabilitiesResponse["can"] | undefined;
  publishing: Pick<PresencePublishing, "blocker" | "heldReason"> | null;
  m: Mutations;
  onRedo: (field: string) => void;
  /** The outcome slot for a change, from `useChangeOutcomes`' `slotFor`. */
  outcomeFor?: ((c: ChangeCardData) => OutcomeSlot) | undefined;
  /** Whether an editor can open for a field here: a button that does nothing is not drawn. */
  canRedo: (field: string) => boolean;
  /** The page's own date and time format (the viewer's zone). */
  formatDateTime?: ((iso: string | null | undefined) => string) | undefined;
  /** The page's clock, so a send older than the api checks for stops promising another check. */
  now?: number | undefined;
}) {
  const old = older ?? [];
  const when = formatDateTime ?? defaultWhen;
  const stageOf = (c: ChangeCardData) => requestStatus(c, labelFor(c.network), can, publishing).stage;
  // Newest request first inside a group, whichever list it came from.
  const byNewest = (a: ChangeCardData, b: ChangeCardData) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
  const groups = groupByStage([...open, ...recent].sort(byNewest), stageOf);
  // An older request that still needs the merchant (a failure to make again, an approval) opens the fold, so it is not hidden.
  const olderNeedsYou = old.some((c) => requestNeedsYou(requestStatus(c, labelFor(c.network), can, publishing)) !== null);
  const row = (c: ChangeCardData) => (
    <RequestRow key={c.id} change={c} label={labelFor(c.network)} can={can} publishing={publishing} m={m} onRedo={onRedo} outcome={outcomeFor?.(c)} canRedo={canRedo} when={when} now={now} />
  );
  return (
    <div id={SUMMARY_ANCHORS.requests} className="space-y-3" data-testid="your-requests">
      <h3 className="text-sm font-medium">Your requests</h3>
      {groups.length === 0 && old.length === 0 ? (
        <p className="text-xs text-muted-foreground">No requests yet. Changes you make under Change your listing appear here, from draft to live.</p>
      ) : (
        <>
          {groups.length > 0 && (
            <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground" data-testid="request-counts">
              {groups.map((g, i) => (
                <span key={g.id}>
                  <a href={`#${groupAnchor(g.id)}`} className="underline-offset-2 hover:underline">
                    {g.rows.length} {g.label.toLowerCase()}
                  </a>
                  {i < groups.length - 1 ? " ·" : ""}
                </span>
              ))}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.id} id={groupAnchor(g.id)} className="scroll-mt-24" data-testid="request-group" data-group={g.id}>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                {g.label} ({g.rows.length})
              </h4>
              <ul className="divide-y">{g.rows.map(row)}</ul>
            </div>
          ))}
          {old.length > 0 && (
            <details open={olderNeedsYou || undefined}>
              <summary className="w-fit cursor-pointer text-xs font-medium text-muted-foreground">Show older ({old.length})</summary>
              <ul className="mt-2 divide-y">{old.map(row)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
