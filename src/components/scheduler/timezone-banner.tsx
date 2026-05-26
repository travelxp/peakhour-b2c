"use client";

/**
 * <TimezoneBanner /> — surfaces when the audience timezone differs
 * from the user's detected timezone. Subtle, dismissable. Helps the
 * user catch "I scheduled at 9am IST but my audience is in PST" before
 * publishing.
 */

import { Globe, X } from "lucide-react";
import { useEffect, useState } from "react";
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

export function TimezoneBanner({
  timezone,
  className,
  storageKey,
}: TimezoneBannerProps) {
  // SSR-safe: render NOTHING until mounted on the client. The banner
  // is decorative — its absence on the first paint is acceptable, and
  // a hydration mismatch (userTz="UTC" on server vs real tz on client)
  // is not.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [userTz, setUserTz] = useState("UTC");

  // The setState calls below are mount-time hydration of values
  // that legitimately can't be computed during SSR (timezone +
  // sessionStorage). Lint rule guards against cascading renders;
  // here the effect runs exactly once per mount with no cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
    setUserTz(detectTimezone());
    if (storageKey) {
      try {
        setDismissed(sessionStorage.getItem(storageKey) === "1");
      } catch {
        /* sessionStorage may be unavailable (private mode). */
      }
    }
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted || dismissed || userTz === timezone) return null;

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
