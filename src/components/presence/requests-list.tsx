"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { errorWords, fieldTitle, requestStatus, shortChange, type CapabilitiesResponse, type ChangeCardData, type Tone } from "@/lib/presence-edit";
import type { PresencePublishing } from "@/lib/presence-panels";

const TONE: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  good: "text-success-on-tint",
  warn: "text-warning-on-tint",
  bad: "text-destructive",
};

type Mutations = Pick<ReturnType<typeof usePresenceEditMutations>, "approve" | "reject">;

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
}: {
  change: ChangeCardData;
  label: string;
  can: CapabilitiesResponse["can"] | undefined;
  publishing: Pick<PresencePublishing, "blocker" | "heldReason"> | null;
  m: Mutations;
  onRedo: (field: string) => void;
}) {
  const r = requestStatus(change, label, can, publishing);
  const busy = m.approve.isPending || m.reject.isPending;
  const failure = (m.approve.variables === change.id && m.approve.error) || (m.reject.variables === change.id && m.reject.error) || null;
  const next = r.next;

  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0" data-testid="request-row" data-stage={r.stage}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">{fieldTitle(change.field)}</p>
        <p className={`text-xs font-medium ${TONE[r.tone]}`}>{r.label}</p>
      </div>
      <p className="break-words text-xs text-muted-foreground">{shortChange(change.field, change.before, change.after)}</p>
      {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
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
      {next.kind === "redo" && (
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

/**
 * "Your requests": what is open or in flight, then what finished in the last week under "Done recently (N)". Drawn inside the publishing
 * status, one section. Nothing is drawn when there is nothing to list.
 */
export function RequestsList({
  open,
  recent,
  labelFor,
  can,
  publishing,
  m,
  onRedo,
}: {
  open: ChangeCardData[];
  recent: ChangeCardData[];
  labelFor: (network: string) => string;
  can: CapabilitiesResponse["can"] | undefined;
  publishing: Pick<PresencePublishing, "blocker" | "heldReason"> | null;
  m: Mutations;
  onRedo: (field: string) => void;
}) {
  if (open.length === 0 && recent.length === 0) return null;
  const row = (c: ChangeCardData) => <RequestRow key={c.id} change={c} label={labelFor(c.network)} can={can} publishing={publishing} m={m} onRedo={onRedo} />;
  return (
    <div className="space-y-2" data-testid="your-requests">
      <h3 className="text-sm font-medium">Your requests</h3>
      {open.length > 0 ? <ul className="divide-y">{open.map(row)}</ul> : <p className="text-xs text-muted-foreground">Nothing is waiting.</p>}
      {recent.length > 0 && (
        <details>
          <summary className="w-fit cursor-pointer text-xs font-medium text-muted-foreground">Done recently ({recent.length})</summary>
          <ul className="mt-2 divide-y">{recent.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
