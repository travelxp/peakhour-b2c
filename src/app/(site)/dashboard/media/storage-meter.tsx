"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type StorageUsage, formatBytes } from "@/lib/api/media";
import { meterState, gbText } from "@/lib/storage-copy";
import { openAddSpace } from "@/components/media/add-space-dialog";

/**
 * Storage meter (Peakhour Drive Q4). Shows the POOL: GB used of the organisation's total, which is every paid business's plan
 * allowance plus any packs it chose. Amber from 80%, red when full, and its own state when a pack could not renew (new uploads
 * paused, files and space safe). The words live in lib/storage-copy.ts so the sidebar and the page say the same thing.
 * Reused on the Media page (full) and the dashboard sidebar (compact).
 */
export function StorageMeter({
  usage,
  compact = false,
  className,
}: {
  usage: StorageUsage;
  compact?: boolean;
  className?: string;
}) {
  const state = meterState(usage);
  const unbounded = state.kind === "unbounded";
  const barColor = state.kind === "full" || state.kind === "paused" ? "bg-destructive" : state.kind === "warn" ? "bg-warning" : "bg-primary";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Storage</span>
        <span className="text-muted-foreground">
          {unbounded ? `${formatBytes(usage.totalBytes)} used` : `${gbText(usage.gbUsed)} / ${gbText(usage.limitGb ?? 0)} GB`}
        </span>
      </div>
      {!unbounded && (
        <Progress
          value={state.pct}
          className="mt-1.5 h-2"
          indicatorClassName={barColor}
          aria-label={`Storage ${Math.round(state.pct)}% used`}
        />
      )}
      {!compact && (
        <div className="mt-1 space-y-2">
          <p className="text-xs text-muted-foreground">{state.message}</p>
          {state.kind === "paused" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/peaks">Top up Peaks</Link>
            </Button>
          ) : null}
          {state.canAddSpace ? (
            <Button variant="outline" size="sm" onClick={openAddSpace}>
              Add space
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
