"use client";

/**
 * <UpgradeCallout /> — small amber callout the composer renders when
 * the user has selected an option their plan doesn't unlock. The
 * UpgradeDrawer pattern (link to /pricing or open in-app drawer) is
 * the bigger surface; this is the compact "Pro feature" hint that
 * sits next to the gated control.
 */

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UpgradeCalloutProps {
  /** Plain-English explanation of what the user needs to upgrade to.
   *  Example: "Auto-approve publishing is on Growth+ plans." */
  message: string;
  /** Optional href to the pricing / upgrade page. Defaults to
   *  /dashboard/settings (peakhour-b2c hosts the upgrade flow there). */
  upgradeHref?: string;
  /** "compact" — inline next to a single control; "banner" — full-
   *  width banner above a section. Default: compact. */
  variant?: "compact" | "banner";
  className?: string;
}

export function UpgradeCallout({
  message,
  upgradeHref = "/dashboard/settings",
  variant = "compact",
  className,
}: UpgradeCalloutProps) {
  return (
    <div
      className={cn(
        "inline-flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200",
        variant === "compact" ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs w-full",
        className,
      )}
    >
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="flex-1">
        {message}{" "}
        <Link
          href={upgradeHref}
          className="font-medium underline-offset-2 hover:underline"
        >
          Upgrade →
        </Link>
      </span>
    </div>
  );
}
