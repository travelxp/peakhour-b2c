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

  // `now` ticks every second while running; `legacyStartAt` is the
  // origin for callers that don't supply a server-side `startedAt`
  // anchor. We re-stamp `legacyStartAt` on every running:false→true
  // transition so consumers like strategist (which toggles generating
  // multiple times within one component lifetime) get a fresh 0s start
  // each run instead of accumulating from the first toggle.
  //
  // SSR safety: `now` starts at 0 (deterministic) instead of Date.now()
  // so server-rendered HTML matches the first client render. The mount
  // effect immediately calls setNow(Date.now()) to populate real time
  // — a sub-frame transition the user can't perceive. Without this,
  // any future caller that renders ElapsedTimer with running=true on
  // first paint would trigger a Next.js hydration mismatch warning.
  const [now, setNow] = useState(0);
  const [legacyStartAt, setLegacyStartAt] = useState<number | null>(null);

  useEffect(() => {
    if (!running) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLegacyStartAt(null);
      return;
    }
    const t = Date.now();
    setLegacyStartAt(t);
    setNow(t);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  // Origin precedence: server-supplied anchor → fresh per-run legacy
  // anchor → `now` (covers the first render after running flips true,
  // before the effect populates legacyStartAt; resolves to 0s elapsed).
  const origin = anchorMs ?? legacyStartAt ?? now;
  // Clamp to 0 — covers (a) the SSR/pre-mount render where now=0 and
  // anchorMs is in the past (would otherwise produce a huge negative)
  // and (b) clock skew between server-stamped createdAt and Date.now().
  const elapsed = now > 0 ? Math.max(0, Math.floor((now - origin) / 1000)) : 0;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedDisplay = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  // Server ETA: only meaningful with an anchor — without one we can't
  // infer "how long until done" from a duration alone. Also gated on
  // now>0 so the SSR/pre-mount render (now=0) doesn't compute a wildly
  // wrong "~Xs left" from `anchorMs + etaMs - 0`.
  const remainingSec =
    now > 0 && etaMs != null && etaMs > 0 && anchorMs != null
      ? Math.max(0, Math.ceil((anchorMs + etaMs - now) / 1000))
      : null;

  // Progress bar prefers the server ETA, falls back to a static estimate.
  // Clamp to [0, 1] — `now < anchorMs` from clock skew would otherwise
  // produce a negative value.
  let progress: number | undefined;
  if (etaMs != null && etaMs > 0 && anchorMs != null) {
    progress = Math.min(Math.max((now - anchorMs) / etaMs, 0), 1);
  } else if (estimatedSeconds) {
    progress = Math.min(elapsed / estimatedSeconds, 1);
  }

  // Suppress "~0s left" once we overshoot the ETA — the elapsed counter
  // continues to convey "still working", and a stuck "~0s left" beside
  // a ticking elapsed is just noise.
  const remainingDisplay =
    remainingSec != null && remainingSec > 0
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
