"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreditsBalance, getCapStatus, spendableCap } from "@/hooks/use-credits";

/**
 * Compact Peaks balance chip for the dashboard top bar.
 *
 * Colour-codes by cap state:
 *   - none  : muted (healthy)
 *   - soft  : amber (inside the plan's warning band, measured against the
 *             SPENDABLE cap — plan allowance plus any purchased Peaks)
 *   - hard  : red   (the api reports `blocked` — it would refuse the next call)
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
  soft: "text-warning-on-tint hover:text-warning",
  hard: "text-destructive-on-tint",
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
          : // ⚠️★AGAINST THE SPENDABLE CAP, NOT `hardCap`. `remaining` already
            // counts purchased Peaks, so pairing it with the plan allowance
            // alone rendered "7,000 of 5,000 Peaks remaining" for anyone
            // holding a top-up pack — a tooltip contradicting itself.
            `${balance.remaining.toLocaleString()} of ${spendableCap(balance).toLocaleString()} Peaks remaining`
      }
    >
      <Zap className="size-3.5" />
      {label}
    </Link>
  );
}
