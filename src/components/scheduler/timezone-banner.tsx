"use client";

/**
 * <TimezoneBanner /> — surfaces when the audience timezone differs
 * from the user's detected timezone. Subtle, dismissable. Helps the
 * user catch "I scheduled at 9am IST but my audience is in PST" before
 * publishing.
 */

import { Globe, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { detectTimezone } from "@/lib/scheduler/format";

export interface TimezoneBannerProps {
  /** The plan's chosen timezone (typically the audience tz). */
  timezone: string;
  className?: string;
  /** When provided, the banner remembers dismissal under this key in
   *  sessionStorage so it doesn't re-pester on every render. */
  storageKey?: string;
}

/** Lazy initialiser so SSR doesn't touch sessionStorage; the second
 *  render hydrates with the persisted value if any. Avoids the
 *  "setState-in-effect" lint by computing once at mount instead. */
function initialDismissed(storageKey?: string): boolean {
  if (!storageKey || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function TimezoneBanner({
  timezone,
  className,
  storageKey,
}: TimezoneBannerProps) {
  const [dismissed, setDismissed] = useState(() => initialDismissed(storageKey));
  const userTz = typeof window !== "undefined" ? detectTimezone() : "UTC";

  if (dismissed || userTz === timezone) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-sky-300/60 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-700/40 dark:bg-sky-950/30 dark:text-sky-200",
        className,
      )}
    >
      <Globe className="h-4 w-4 shrink-0" />
      <div className="flex-1">
        Scheduling in <b>{timezone}</b> — different from your local{" "}
        <b>{userTz}</b>. Times shown reflect when your audience sees them.
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          if (storageKey && typeof window !== "undefined") {
            sessionStorage.setItem(storageKey, "1");
          }
        }}
        aria-label="Dismiss timezone banner"
        className="rounded p-0.5 hover:bg-sky-200/50 dark:hover:bg-sky-800/40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
