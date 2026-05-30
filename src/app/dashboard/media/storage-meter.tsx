"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type StorageUsage, formatBytes } from "@/lib/api/media";

/**
 * Storage usage meter (Media Manager / R2 plan §7 L13). Shows GB used vs the
 * plan quota with amber@75% / red@90% states. Reused on the Media Manager
 * page (full) and the dashboard sidebar (compact, PR7).
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
  const pct = usage.percentUsed ?? 0;
  const unbounded = usage.limitBytes === null;
  const tone = pct >= 90 ? "red" : pct >= 75 ? "amber" : "normal";

  const barColor =
    tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-primary";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Storage</span>
        <span className="text-muted-foreground">
          {unbounded ? (
            `${formatBytes(usage.totalBytes)} used`
          ) : (
            <>
              {usage.gbUsed.toFixed(usage.gbUsed < 1 ? 2 : 1)} /{" "}
              {usage.gbIncluded} GB
              {usage.isOverage ? " · overage" : ""}
            </>
          )}
        </span>
      </div>
      {!unbounded && (
        <Progress
          value={Math.min(100, pct)}
          className="mt-1.5 h-2"
          indicatorClassName={barColor}
          aria-label={`Storage ${pct.toFixed(0)}% used`}
        />
      )}
      {!compact && (
        <p className="mt-1 text-xs text-muted-foreground">
          {unbounded
            ? "No storage limit configured for your plan."
            : tone === "red"
              ? "Storage almost full — clean up or upgrade to keep adding media."
              : tone === "amber"
                ? "Approaching your storage limit."
                : `${usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)} plan`}
        </p>
      )}
    </div>
  );
}
