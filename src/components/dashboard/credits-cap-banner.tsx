"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditsBalance, getCapStatus, spendableCap, capRecoveryCta } from "@/hooks/use-credits";

/**
 * Dismissible banner that surfaces when an org approaches or hits its
 * monthly Peaks limit.
 *
 *   - soft: amber — "You've used N% of your Peaks", when own spend is inside the
 *     plan's warning band measured against the SPENDABLE cap (`spendableCap`)
 *   - hard: red — "Peaks limit reached, AI paused", when the api says `blocked`
 *
 * ⚠️★NEITHER THRESHOLD IS `used ≥ hardCap` ANY MORE, and the bullets above used
 * to say it was. The pause is the server's verdict (see `getCapStatus`) and the
 * percentage counts purchased Peaks. The CTA follows `capRecoveryCta` for the
 * same reason: on a paid plan the way back is a purchase, not an upgrade.
 *
 * Dismissal is session-scoped (component state). Persisting it across
 * reloads via localStorage is deliberately deferred — the hard-cap banner
 * should reappear on every page load until the user acts.
 *
 * Renders nothing when: unlimited plan, below soft threshold, loading,
 * or dismissed (for soft cap only — hard cap cannot be dismissed).
 */
export function CreditCapBanner() {
  const { data: balance, isLoading } = useCreditsBalance();
  const [softDismissed, setSoftDismissed] = useState(false);

  if (isLoading || !balance || balance.unlimited) return null;

  const capStatus = getCapStatus(balance);
  if (capStatus === "none") return null;
  if (capStatus === "soft" && softDismissed) return null;

  const cap = spendableCap(balance);
  // Against the SPENDABLE cap, so the figure can't read "102% used" beside copy
  // promising the limit hasn't been reached yet.
  const pct = cap > 0 ? Math.min(100, Math.round((balance.used / cap) * 100)) : 0;
  const cta = capRecoveryCta(balance);
  // Purchased Peaks are part of the allowance being spent, so name it for what
  // it is rather than calling a topped-up wallet "your monthly Peaks".
  const walletNoun =
    balance.topUpUsable && balance.topUpBalance > 0 ? "available Peaks" : "monthly Peaks";
  const resetDate = new Date(balance.resetAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (capStatus === "hard") {
    return (
      <div
        className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive-on-tint sm:flex-row sm:items-center sm:gap-3"
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="size-4 shrink-0" />
        <div className="flex-1 text-sm">
          <span className="font-medium">Monthly Peaks limit reached.</span>{" "}
          AI features are paused until {resetDate}. {cta.verb} to resume immediately.
        </div>
        <Button size="sm" variant="destructive" asChild>
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </div>
    );
  }

  // soft cap
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning-on-tint sm:flex-row sm:items-center sm:gap-3"
      role="status"
      aria-live="polite"
    >
      <Zap className="size-4 shrink-0" />
      <div className="flex-1 text-sm">
        <span className="font-medium">You&apos;ve used {pct}% of your {walletNoun}.</span>{" "}
        AI features will pause when the limit is reached. Resets on {resetDate}.
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" asChild className="border-warning/30">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSoftDismissed(true)}
          aria-label="Dismiss"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
