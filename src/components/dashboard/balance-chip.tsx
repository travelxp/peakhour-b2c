"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreditsBalance, getCapStatus } from "@/hooks/use-credits";

/**
 * Compact Peaks balance chip for the dashboard top bar.
 *
 * Colour-codes by cap state:
 *   - none  : muted (healthy)
 *   - soft  : amber (≥80% of monthly cap — warning)
 *   - hard  : red   (≥100% — AI features paused)
 *   - unlimited: muted with "∞" glyph
 *
 * Clicking navigates to /dashboard/peaks for the full rate card + history.
 * Renders nothing until the balance fetch resolves.
 */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const CAP_CLASSES: Record<"none" | "soft" | "hard", string> = {
  none: "text-muted-foreground hover:text-foreground",
  soft: "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300",
  hard: "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300",
};

export function BalanceChip() {
  const { data: balance } = useCreditsBalance();

  if (!balance) return null;

  const capStatus = getCapStatus(balance);
  const classes = CAP_CLASSES[capStatus];

  const label = balance.unlimited
    ? "∞ Peaks"
    : `${fmt(balance.remaining)} Peaks`;

  return (
    <Link
      href="/dashboard/peaks"
      className={cn(
        "hidden items-center gap-1 text-xs font-medium transition-colors sm:flex",
        classes,
      )}
      title={
        balance.unlimited
          ? "Unlimited Peaks — click for rate card"
          : `${balance.remaining.toLocaleString()} of ${balance.hardCap.toLocaleString()} Peaks remaining`
      }
    >
      <Zap className="size-3.5" />
      {label}
    </Link>
  );
}
