"use client";

/**
 * <ScheduleConflictWarning /> — surfaces stagger conflicts the
 * SmartTimeEngine resolved (audience-tz filtering, cross-channel
 * min-spacing, ±15 min push-out, clamped wraparound). Renders a
 * collapsible explanation list so the user can see WHY a channel
 * landed at a different time than the others.
 *
 * Powered by the audit strings on PreviewTimeResponse.resolvedTimes[].
 * Hidden when no audit notes exist (synchronized strategies).
 */

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { channelDisplayName } from "@/lib/scheduler/format";
import type { PreviewTimeResponse } from "@/lib/scheduler/types";

export interface ScheduleConflictWarningProps {
  preview?: PreviewTimeResponse;
  className?: string;
}

/** Pretty-print an audit code like `smart_tier1_clamped_to_+-90m` →
 *  `Clamped to ±90 min`. */
function formatNote(note: string): string {
  return note
    .replace(/^smart_tier1_/, "")
    .replace(/^rolling_/, "")
    .replaceAll("_", " ")
    .replace(/(\d+)m/g, "$1 min")
    .replace(/\+-/g, "±")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function ScheduleConflictWarning({
  preview,
  className,
}: ScheduleConflictWarningProps) {
  const [open, setOpen] = useState(false);
  if (!preview) return null;
  const rowsWithNotes = preview.resolvedTimes.filter(
    (r) => r.audit && r.audit.length > 0,
  );
  if (rowsWithNotes.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-amber-300/60 bg-amber-50 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Info className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          Smart-time engine adjusted{" "}
          <b>
            {rowsWithNotes.length} channel
            {rowsWithNotes.length === 1 ? "" : "s"}
          </b>{" "}
          to resolve scheduling conflicts.
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-amber-300/60 px-3 py-2 dark:border-amber-700/40">
          {rowsWithNotes.map((r) => (
            <div key={r.channel}>
              <div className="font-medium">{channelDisplayName(r.channel)}</div>
              <ul className="ml-4 list-disc space-y-0.5">
                {(r.audit ?? []).map((note) => (
                  <li key={note}>{formatNote(note)}</li>
                ))}
              </ul>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1 text-[11px] text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/30"
            onClick={() => setOpen(false)}
          >
            Got it
          </Button>
        </div>
      )}
    </div>
  );
}
