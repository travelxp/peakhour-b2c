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

// Warm, human "we're getting to know you" lines that rotate while setup runs —
// so the wait reads as attentive, never a dead spinner. Catalog-first (works for
// stores with no website/online presence), never phase-jargon.
const LEARNING_MESSAGES = [
  "Getting to know your store…",
  "Learning about what you sell…",
  "Reading through your catalogue…",
  "Understanding your customers…",
  "Setting things up around you…",
];

// Phase detail, when the backend reports one — kept as secondary colour.
const PHASE_LABEL: Record<string, string> = {
  tech_stack: "Looking up your website…",
  footprint: "Finding your other profiles online…",
  recommendations: "Picking the best places for you to grow…",
};

const POLL_INTERVAL_MS = 3000;
const ROTATE_INTERVAL_MS = 3500;
// After this long we step the strip aside — setup keeps running in the
// background so the user is never trapped waiting on it.
const AUTO_BACKGROUND_MS = 25000;
const DISMISS_KEY_PREFIX = "dashboard:strip-dismissed:";

export function DiscoveryProgressStrip({ jobId }: ProgressStripProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  // Restore per-job dismissal across reloads via a lazy initializer (not an
  // effect) so we don't setState synchronously on mount.
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY_PREFIX + jobId) === "1",
  );
  const [msgIndex, setMsgIndex] = useState(0);

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

  // Rotate the warm "learning about you" copy while setup is still running.
  const running = status?.status === "pending" || status?.status === "running";
  useEffect(() => {
    if (dismissed || !running) return;
    const id = setInterval(
      () => setMsgIndex((i) => (i + 1) % LEARNING_MESSAGES.length),
      ROTATE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [dismissed, running]);

  // Never trap the user: after a grace period, step the strip aside. Setup keeps
  // running server-side and the dependent widgets refetch when it lands.
  useEffect(() => {
    if (dismissed || !running) return;
    const id = setTimeout(handleDismiss, AUTO_BACKGROUND_MS);
    return () => clearTimeout(id);
  }, [dismissed, running, handleDismiss]);

  if (dismissed) return null;
  if (!status) return null;

  // Hide on terminal — the user already saw the launch page; here we
  // just want to nudge the dashboard to refetch and step out of the way.
  if (status.status === "done") return null;

  const isFailed = status.status === "failed";
  // Warm, rotating headline while running; a phase detail (when present) sits
  // underneath as secondary colour. Never a bare "Getting started…".
  const headline = isFailed
    ? "We'll finish getting to know you in the background"
    : LEARNING_MESSAGES[msgIndex];
  const subline = isFailed
    ? "Nothing's wrong on your end — you can start using Peakhour now."
    : status.currentPhase
      ? PHASE_LABEL[status.currentPhase]
      : "You can start using Peakhour now — we'll keep learning in the background.";

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
        <p className="text-sm font-medium transition-opacity duration-300">{headline}</p>
        <p className="text-xs text-muted-foreground truncate">{subline}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
      >
        Start now
      </button>
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
