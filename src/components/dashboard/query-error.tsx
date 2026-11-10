"use client";

import { AlertTriangle, RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QueryErrorProps {
  /** What failed to load, in the merchant's words: "your tickets". */
  what: string;
  /** "error" (default) or "offline" - the same strip, different wording. */
  kind?: "error" | "offline";
  /** Wired to the query's `refetch`. Omit for the offline strip, which retries by itself. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline replacement for a list that could not load. Never reads as "empty":
 * it says the load failed, that nothing was changed, and offers Retry.
 */
export function QueryError({ what, kind = "error", onRetry, className }: QueryErrorProps) {
  const offline = kind === "offline";
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div
      role={offline ? "status" : "alert"}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {offline ? "You look to be offline" : `We couldn't load ${what}`}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {offline
            ? `${what[0].toUpperCase()}${what.slice(1)} will load as soon as the connection is back.`
            : "This is a problem loading the list, not an empty one. Nothing was changed."}
        </p>
      </div>
      {onRetry && !offline && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="mr-1.5 size-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
