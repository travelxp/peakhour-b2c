"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * PeakHour branded elapsed timer — shows time ticking while an async
 * operation is in progress. Reusable across strategist, content gen, etc.
 *
 * Usage:
 *   <ElapsedTimer running={isLoading} />
 *   <ElapsedTimer running={isLoading} estimatedSeconds={20} />
 */
export function ElapsedTimer({
  running,
  estimatedSeconds,
  className,
}: {
  running: boolean;
  estimatedSeconds?: number;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

  const progress = estimatedSeconds ? Math.min(elapsed / estimatedSeconds, 1) : undefined;

  return (
    <div className={cn("inline-flex items-center gap-2 text-sm tabular-nums", className)}>
      {/* Animated dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>

      {/* Timer */}
      <span className="font-mono text-muted-foreground">{display}</span>

      {/* Progress hint */}
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
