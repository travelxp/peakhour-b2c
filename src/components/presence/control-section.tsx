"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { ChangeChoices } from "@/components/presence/change-choices";
import { SUMMARY_ANCHORS } from "@/lib/presence-summary";
import {
  changesView,
  controlNote,
  type NoteTone,
  type PresenceListingResponse,
  type PresenceNetworkEntry,
} from "@/lib/presence-panels";

/** The id of the section an alert's link goes to. The api names the same id (`NETWORK_CHANGES_ANCHOR`). */
export const NETWORK_CHANGES_ID = SUMMARY_ANCHORS.networkChanges;

const TONE_ICON: Record<NoteTone, React.ReactNode> = {
  good: <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />,
  warn: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-on-tint" aria-hidden />,
  unknown: <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />,
};

/**
 * Whether edits can go live, and what the network changed by itself.
 *
 * MARKUP ONLY. Every sentence comes from `controlNote` and `changesView` in `lib/presence-panels.ts`,
 * and a block is drawn only where the network declares the capability (the helpers return null
 * otherwise). "We can't tell" is its own look, never the warning one.
 */
export function ControlSection({
  entry,
  listing,
  mapHref,
  formatDateTime,
}: {
  entry: PresenceNetworkEntry | null;
  listing: PresenceListingResponse["listing"] | null;
  /** The listing's page on the network, for "Check it on ...". */
  mapHref?: string | null;
  formatDateTime: (iso: string | null | undefined) => string;
}) {
  const label = entry?.label ?? "the network";
  const control = controlNote(entry, label);
  const changes = changesView(entry, label);
  const listsChanges = changes?.kind === "some";
  // What a choice did. Held here, not in the row: keeping the last change removes the row (and the section) before anyone could read it.
  const [done, setDone] = useState<string | null>(null);
  // An alert links to `#network-changes`. The section draws after the listing loads, so the browser's own jump has nothing to land on yet.
  useEffect(() => {
    if (listsChanges && typeof window !== "undefined" && window.location.hash === `#${NETWORK_CHANGES_ID}`) {
      document.getElementById(NETWORK_CHANGES_ID)?.scrollIntoView({ block: "start" });
    }
  }, [listsChanges]);
  if (!control && !changes && !done) return null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {control && (
        <div className="flex gap-2">
          {TONE_ICON[control.tone]}
          <div className="space-y-0.5">
            <p className={`text-sm font-medium ${control.tone === "warn" ? "text-warning-on-tint" : ""}`}>
              {control.headline}
            </p>
            <p className="text-xs text-muted-foreground">{control.body}</p>
            {control.extras.map((e) => (
              <p key={e} className="text-xs text-muted-foreground">
                {e}
              </p>
            ))}
            {entry?.control.checkedAt && control.tone !== "unknown" && (
              <p className="text-micro text-muted-foreground">
                Checked {formatDateTime(entry.control.checkedAt)}.
              </p>
            )}
          </div>
        </div>
      )}

      {changes && (
        <div id={NETWORK_CHANGES_ID} className="scroll-mt-20 space-y-0.5 border-t pt-3 first:border-t-0 first:pt-0">
          {changes.kind === "some" ? (
            <>
              <p className="text-sm font-medium">{changes.headline}</p>
              <ul className="space-y-2 pl-0 text-xs text-muted-foreground">
                {changes.lines.map((l, i) => (
                  <li key={l.key} id={`network-change-${i}`} className="space-y-1">
                    <p>{l.text}</p>
                    {entry && listing ? <ChangeChoices line={l} entry={entry} listing={listing} mapHref={mapHref} onDone={setDone} /> : null}
                  </li>
                ))}
              </ul>
              {changes.pending && <p className="text-xs text-muted-foreground">{changes.pending}</p>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{changes.text}</p>
          )}
        </div>
      )}

      {done && (
        <p role="status" className="text-xs text-muted-foreground">
          {done}
        </p>
      )}
    </div>
  );
}
