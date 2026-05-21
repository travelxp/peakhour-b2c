"use client";

import { useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDashboardOrg, useExtendTrial } from "@/hooks/use-dashboard-org";

/**
 * Surfaces when a trial is within the final 3 days. Includes a single
 * one-click "Extend by 7 days" CTA when the customer's self-serve
 * allowance is unused; falls back to a Contact-us link once that
 * one-shot has been spent. Dismissible per session — the dismissal
 * lives in component state only (not persisted) so it returns on the
 * next dashboard mount; a sticky "remind me tomorrow" would need
 * localStorage + a TTL and isn't worth the complexity yet.
 *
 * Hidden completely when:
 *   - no trial active
 *   - trial active but more than 3 days remain
 *   - user has dismissed it in this session
 *   - data is still loading (no flash)
 */
const WARNING_WINDOW_DAYS = 3;

export function TrialExpiryBanner() {
  const { data, isLoading } = useDashboardOrg();
  const extend = useExtendTrial();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;
  const sub = data?.subscription;
  if (!sub?.trialActive) return null;
  const days = sub.trialDaysRemaining ?? 0;
  if (days > WARNING_WINDOW_DAYS) return null;

  const alreadyExtended = sub.selfServeExtensionUsed === true;

  const handleExtend = () => {
    extend.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          `Trial extended by ${res.addedDays} days`,
          {
            description: `New end date: ${new Date(res.trialEndsAt).toLocaleDateString()}`,
          }
        );
      },
      onError: (err: Error & { code?: string }) => {
        // The api client wraps error responses with a `code` field
        // mirroring the server's machine-readable code. Map known codes
        // to user-facing messages; fall through to a generic fallback
        // so a new server-side code never produces a silent failure.
        const code = (err as { code?: string }).code;
        if (code === "EXTENSION_ALREADY_USED") {
          toast.error("Extension already used", {
            description: "Reach out to hello@peakhour.ai for further help.",
          });
        } else if (code === "NOT_TRIALING") {
          toast.error("Trial ended", {
            description:
              "Your trial has ended — contact hello@peakhour.ai to discuss next steps.",
          });
        } else if (code === "EXTENSION_RACE") {
          toast.info("State changed", {
            description: "Refreshing the latest trial state…",
          });
        } else {
          toast.error("Could not extend trial", {
            description: err.message ?? "Try again or contact support.",
          });
        }
      },
    });
  };

  // Tier-up the visual urgency as days run out. Day 3 = soft amber;
  // days ≤1 = stronger red so the warning isn't easy to ignore on the
  // last day.
  const critical = days <= 1;
  const wrapClass = critical
    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200";

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:gap-3 ${wrapClass}`}
      role="status"
    >
      {critical ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Clock className="size-4 shrink-0" />
      )}
      <div className="flex-1 text-sm">
        <span className="font-medium">
          Your trial ends in {days} day{days === 1 ? "" : "s"}.
        </span>{" "}
        {alreadyExtended ? (
          <span>
            You&apos;ve used your one-time extension —{" "}
            <a
              href="mailto:hello@peakhour.ai"
              className="underline underline-offset-2"
            >
              contact us
            </a>{" "}
            to continue.
          </span>
        ) : (
          <span>Extend by 7 days, no questions asked.</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!alreadyExtended ? (
          <Button
            size="sm"
            variant="default"
            onClick={handleExtend}
            disabled={extend.isPending}
          >
            {extend.isPending ? "Extending…" : "Extend 7 days"}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
