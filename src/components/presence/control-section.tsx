"use client";

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import {
  changesView,
  controlNote,
  type NoteTone,
  type PresenceNetworkEntry,
} from "@/lib/presence-panels";

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
  formatDateTime,
}: {
  entry: PresenceNetworkEntry | null;
  formatDateTime: (iso: string | null | undefined) => string;
}) {
  const label = entry?.label ?? "the network";
  const control = controlNote(entry, label);
  const changes = changesView(entry, label);
  if (!control && !changes) return null;

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
        <div className="space-y-0.5 border-t pt-3 first:border-t-0 first:pt-0">
          {changes.kind === "some" ? (
            <>
              <p className="text-sm font-medium">{changes.headline}</p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {changes.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {changes.pending && <p className="text-xs text-muted-foreground">{changes.pending}</p>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{changes.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
