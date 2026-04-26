"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Top-of-dashboard banner shown while the onboarding discovery job is
 * still in flight. Auto-dismisses when the backend marks the job
 * `done`, but the user can also dismiss manually (we set a sessionStorage
 * flag so we don't keep showing the banner after a transient close).
 *
 * Polls /v1/onboarding/discovery-status every 3s. Listens to the global
 * react-query cache for ["dashboard-discovery"] so when the strip
 * disappears, the dependent widgets (footprint + recommendations) auto-
 * refetch.
 */
interface DiscoveryStatus {
  status: "pending" | "running" | "done" | "failed";
  currentPhase: "tech_stack" | "footprint" | "recommendations" | null;
  phasesCompleted: string[];
}

interface ProgressStripProps {
  jobId: string;
}

const PHASE_LABEL: Record<string, string> = {
  tech_stack: "Looking up your website…",
  footprint: "Finding your other profiles online…",
  recommendations: "Picking the best platforms for you to grow on…",
};

const POLL_INTERVAL_MS = 3000;
const DISMISS_KEY_PREFIX = "dashboard:strip-dismissed:";

export function DiscoveryProgressStrip({ jobId }: ProgressStripProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Restore dismissal across reloads (per-job)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY_PREFIX + jobId) === "1") {
      setDismissed(true);
    }
  }, [jobId]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + jobId, "1");
    }
  }, [jobId]);

  // Poll
  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const r = await api.get<DiscoveryStatus>(
          `/v1/onboarding/discovery-status?jobId=${jobId}`,
        );
        if (cancelled) return;
        setStatus(r);
        if (r.status === "done" || r.status === "failed") {
          // Invalidate the dashboard discovery snapshot so the
          // footprint + recommendations cards refetch with fresh data.
          queryClient.invalidateQueries({ queryKey: ["dashboard-discovery"] });
          return;
        }
        timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        // On 404 (TTL'd or wrong jobId) just dismiss silently
        if (err instanceof ApiError && err.status === 404) {
          handleDismiss();
          return;
        }
        timeoutId = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [jobId, dismissed, queryClient, handleDismiss]);

  if (dismissed) return null;
  if (!status) return null;

  // Hide on terminal — the user already saw the launch page; here we
  // just want to nudge the dashboard to refetch and step out of the way.
  if (status.status === "done") return null;

  const isFailed = status.status === "failed";
  const phaseLabel = status.currentPhase
    ? PHASE_LABEL[status.currentPhase]
    : "Getting started…";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 px-4 py-3",
        isFailed
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {isFailed ? (
          <Sparkles className="h-4 w-4" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {isFailed
            ? "We had trouble setting things up"
            : "We're setting up your account"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {isFailed
            ? "We'll keep trying in the background. You can keep using the dashboard."
            : phaseLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
