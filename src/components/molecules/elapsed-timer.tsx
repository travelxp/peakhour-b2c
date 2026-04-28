"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * PeakHour branded elapsed timer — shows time ticking while an async
 * operation is in progress. Reusable across strategist, content gen, etc.
 *
 * Modes:
 * - Anchored (preferred): pass `startedAt` so elapsed survives a refresh
 *   and reflects the real time since the job was enqueued. When the
 *   handler also fills `etaMs`, a "~Xs left" hint counts down beside it.
 * - Legacy: omit `startedAt` and the timer ticks from component-mount
 *   time (kept for ad-hoc loading spinners that don't have a server
 *   anchor — e.g. one-shot strategist calls without a job row).
 *
 * Usage:
 *   <ElapsedTimer running={isLoading} />
 *   <ElapsedTimer running startedAt={job.createdAt} etaMs={job.progress?.etaMs} />
 *   <ElapsedTimer running={isLoading} estimatedSeconds={20} />
 */
export function ElapsedTimer({
  running,
  startedAt,
  etaMs,
  estimatedSeconds,
  className,
}: {
  running: boolean;
  /** ISO string or Date — when set, elapsed = now - startedAt (refresh-safe). */
  startedAt?: Date | string;
  /** Server-side ETA in ms (e.g. job.progress.etaMs). Requires `startedAt` to render. */
  etaMs?: number;
  /** Static fallback ETA in seconds — only used when `etaMs` isn't provided. */
  estimatedSeconds?: number;
  className?: string;
}) {
  const anchorMs = useMemo(() => {
    if (!startedAt) return null;
    const t = typeof startedAt === "string" ? Date.parse(startedAt) : startedAt.getTime();
    return Number.isFinite(t) ? t : null;
  }, [startedAt]);

  // Single `now` state drives both elapsed and remaining derivations —
  // avoids the prior "setElapsed inside effect" pattern flagged by the
  // old TODO and keeps the two values in lockstep.
  const [now, setNow] = useState(() => Date.now());
  // Mount epoch — used as the elapsed origin only when there's no
  // `startedAt` anchor (legacy callers). Lazy useState initialiser
  // captures Date.now() exactly once and stays stable across renders.
  const [mountAt] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  const origin = anchorMs ?? mountAt;
  const elapsed = Math.max(0, Math.floor((now - origin) / 1000));

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  // Server ETA: only meaningful with an anchor — without one we can't
  // infer "how long until done" from a duration alone.
  const remainingSec =
    etaMs != null && etaMs > 0 && anchorMs != null
      ? Math.max(0, Math.ceil((anchorMs + etaMs - now) / 1000))
      : null;

  // Progress bar prefers the server ETA, falls back to a static estimate.
  let progress: number | undefined;
  if (etaMs != null && etaMs > 0 && anchorMs != null) {
    progress = Math.min((now - anchorMs) / etaMs, 1);
  } else if (estimatedSeconds) {
    progress = Math.min(elapsed / estimatedSeconds, 1);
  }

  const remainingDisplay =
    remainingSec != null
      ? remainingSec >= 60
        ? `~${Math.ceil(remainingSec / 60)}m left`
        : `~${remainingSec}s left`
      : null;

  return (
    <div className={cn("inline-flex items-center gap-2 text-sm tabular-nums", className)}>
      {/* Animated dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>

      {/* Timer */}
      <span className="font-mono text-muted-foreground">{elapsedDisplay}</span>

      {/* ETA hint */}
      {remainingDisplay && (
        <span className="text-xs text-muted-foreground">· {remainingDisplay}</span>
      )}

      {/* Progress bar */}
      {progress !== undefined && progress < 1 && (
        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/50 transition-all duration-1000 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
