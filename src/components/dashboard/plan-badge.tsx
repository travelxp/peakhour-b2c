"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardOrg } from "@/hooks/use-dashboard-org";
import { planDisplayName, planState, upgradeCta, type PlanState } from "@/lib/plan-status";

/**
 * Chip accents by plan STATE, not by tier key (billing plan D19, P4.7). The
 * old map keyed the retired base ladder (free/starter/growth/agency/
 * enterprise), so a Suite holder fell through to the muted "free" chip. One
 * catalog has three states; the billing page reads the same map, so the two
 * surfaces style one plan one way.
 */
export const PLAN_STATE_STYLES: Record<PlanState, string> = {
  paid: "bg-success/15 text-success-on-tint",
  trial: "bg-state-info/15 text-state-info-on-tint",
  none: "bg-warning/15 text-warning-on-tint",
};

/**
 * Compact plan/trial indicator for the dashboard top bar.
 *
 * Reads `/v1/dashboard/org`. Renders:
 *   - a chip naming the plan (`planDisplayName`): the bought plan, the Suite on
 *     its trial, or "No plan" once the trial has ended (D19: padlocked)
 *   - "Xd trial" subtle text while the Suite trial is live
 *   - a call to action linking to /dashboard/settings/billing on the trial and
 *     with no plan, never for a paid business (`upgradeCta`)
 *
 * ★The rules live in `lib/plan-status.ts`, shared with the billing page: a guard
 * written in one file and dropped in the next is how this badge once told a
 * Suite buyer to upgrade on every dashboard page.
 *
 * No fetch fires until the user is authenticated and has an active org
 * — guards prevent the cold-render flash on the auth page and dodge a
 * redundant request when /me has not resolved yet.
 */
export function PlanBadge() {
  // Reads through the shared dashboard/org cache so this badge, the
  // trial-expiry banner, and the billing page all hit one network
  // round-trip per org. After self-serve trial extension, the mutation
  // invalidates the cache and the badge's trial countdown updates.
  const { data: summary } = useDashboardOrg();

  const state = planState(summary);
  if (state === null) return null;

  const trialActive = state === "trial";
  const trialDays = summary?.subscription?.trialDaysRemaining ?? 0;
  const cta = upgradeCta(summary);
  const label = planDisplayName(summary);

  return (
    <div className="flex items-center gap-2">
      {/* ★IT TRUNCATES: the label is the server's own plan name, and this
          header is a non-wrapping `h-14` row shared with three other
          controls. The full name stays reachable as a `title`. */}
      <Badge
        variant="secondary"
        className={cn("max-w-[10rem] font-medium", PLAN_STATE_STYLES[state])}
        title={label ?? undefined}
      >
        {/* ★THE TRUNCATE LIVES ON AN INNER BLOCK. `Badge` is `inline-flex`, and
            `truncate` on a flex container clips without an ellipsis. */}
        <span className="block truncate">{label}</span>
      </Badge>
      {/* Trial countdown + CTA collapse on narrow viewports — below sm the
          header would otherwise wrap. The chip alone communicates the most
          important state on mobile; the rest is reachable via billing. */}
      {trialActive && trialDays > 0 ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {trialDays}d trial
        </span>
      ) : null}
      {cta ? (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="hidden h-7 gap-1 px-2 text-xs sm:inline-flex"
        >
          {/* ★IT NAMES WHAT IT WOULD DO: on the trial, buy before it ends; with
              no plan, buy to continue. */}
          <Link href="/dashboard/settings/billing" title={cta.title}>
            {cta.label}
            <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
