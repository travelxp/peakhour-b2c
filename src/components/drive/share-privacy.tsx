"use client";

import { useQuery } from "@tanstack/react-query";
import { getSharePrivacy, listShareAccess, type ShareAccessEntry, type ShareAccessHistory } from "@/lib/api/drive-share";
import { NOT_OPENED_YET, detailsRemovedText, openedAtText, shareDialogNotice } from "@/lib/drive-share-copy";

/**
 * The customer's half of share-link privacy (owner decision 2026-11-04). Two pieces Drive mounts:
 *
 *   <SharePrivacyNote />            ONE plain line near the expiry and password fields of the share dialog.
 *   <ShareAccessPanel shareId />    the "Opened by" list in a link's details.
 *
 * MOUNT POINTS (Drive lane P owns `dashboard/drive`): put the note under the expiry and password inputs in the share dialog, and the
 * panel in each link's detail row, passing the link's `id` from `GET /v1/media/:id/shares`. Both are self-fetching and need no props
 * beyond that. Every number is the api's, so neither component knows how long anything is kept.
 */

// ── The share dialog's line ──────────────────────────────────

export function SharePrivacyNoteView({ retentionDays }: { retentionDays: number | null }) {
  return (
    <p className="text-xs text-muted-foreground" data-testid="share-privacy-note">
      {retentionDays === null
        ? "When someone opens this link, we keep their IP address and device for a limited time so you can spot a leak."
        : shareDialogNotice(retentionDays)}
    </p>
  );
}

export function SharePrivacyNote() {
  const q = useQuery({ queryKey: ["drive-share-privacy"], queryFn: getSharePrivacy, staleTime: 5 * 60_000, retry: 1 });
  // While the number loads, say nothing rather than a wrong one; if it cannot be read, say the same thing without a number.
  if (q.isPending) return null;
  return <SharePrivacyNoteView retentionDays={q.data?.retentionDays ?? null} />;
}

// ── A link's "Opened by" list ────────────────────────────────

export interface ShareAccessListProps {
  history: ShareAccessHistory | undefined;
  loading?: boolean;
  error?: boolean;
  /** Defaults to the reader's own zone and language; a test passes its own. */
  formatDate?: (iso: string) => string;
}

function entryLine(e: ShareAccessEntry, retentionDays: number, formatDate: (iso: string) => string) {
  const what = e.kind === "opened" ? "Opened" : "Wrong password";
  return (
    <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-sm" data-testid="share-access-entry">
      <span className="font-medium">{what}</span>
      <span className="text-muted-foreground">{formatDate(e.at)}</span>
      {e.detailsRemoved ? (
        <span className="text-muted-foreground">{detailsRemovedText(retentionDays)}</span>
      ) : (
        <>
          <span>{e.deviceLabel}</span>
          {e.ip ? <span className="font-mono text-xs text-muted-foreground">{e.ip}</span> : null}
        </>
      )}
    </li>
  );
}

export function ShareAccessList({ history, loading, error, formatDate = (iso) => openedAtText(iso) }: ShareAccessListProps) {
  if (loading) return <p className="text-sm text-muted-foreground" aria-busy="true">Loading.</p>;
  if (error || !history) return <p className="text-sm text-muted-foreground" role="alert">We could not load who opened this link. Please try again.</p>;
  if (history.entries.length === 0) return <p className="text-sm text-muted-foreground">{NOT_OPENED_YET}</p>;
  return (
    <div>
      <ul className="divide-y" aria-label="Opened by">
        {history.entries.map((e) => entryLine(e, history.retentionDays, formatDate))}
      </ul>
      {history.truncated ? <p className="pt-1 text-xs text-muted-foreground">Showing the most recent opens.</p> : null}
    </div>
  );
}

export function ShareAccessPanel({ shareId }: { shareId: string }) {
  const q = useQuery({ queryKey: ["drive-share-access", shareId], queryFn: () => listShareAccess(shareId), retry: 1 });
  return (
    <section aria-label="Opened by" className="grid gap-1">
      <h4 className="text-sm font-medium">Opened by</h4>
      <ShareAccessList history={q.data} loading={q.isPending} error={q.isError} />
    </section>
  );
}
