"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small lock indicator pinned at the top-right of a gated control.
 * Used inline next to a feature toggle, button, or selectable row when
 * we want to mark the surface as Pro-gated without obscuring it.
 *
 * Pair with parent `position: relative` so the absolute-positioning
 * lands inside the gated control's bounding box.
 */
export function UpgradeBadge({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "absolute -top-2 -right-2 z-10 inline-flex items-center gap-1",
        "rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5",
        "text-[10px] font-medium text-brand-label shadow-sm",
        className,
      )}
    >
      <Lock className="size-3" />
      {label ?? "Pro"}
    </span>
  );
}
