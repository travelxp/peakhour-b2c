"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardOrg } from "@/hooks/use-dashboard-org";

/** Plans where an upgrade is meaningful. agency + enterprise hide the
 *  CTA (they're already at/near the top of the price ladder; surfacing
 *  "Upgrade" to those users is noise). */
const UPGRADABLE = new Set(["free", "starter", "growth"]);

/** Plan-tier accent colors. Tailwind class strings only — kept narrow
 *  so a designer can tune without touching component logic. */
const PLAN_STYLES: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter:
    "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  growth:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  agency:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  enterprise:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

function planLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Compact plan/trial indicator for the dashboard top bar.
 *
 * Reads `/v1/dashboard/org` which derives the plan from the canonical
 * `subscription.plan` (see peakhour-api dashboard/index.ts). Renders:
 *   - a colored badge with the plan name
 *   - "Xd trial" subtle text when a trial is active
 *   - a small "Upgrade" CTA linking to /dashboard/settings/billing when
 *     the plan is upgradable (free/starter/growth); hidden for
 *     agency/enterprise
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

  if (!summary?.subscription?.plan) return null;

  const plan = summary.subscription.plan;
  const planClass = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  const trialActive = summary.subscription.trialActive === true;
  const trialDays = summary.subscription.trialDaysRemaining ?? 0;
  const showUpgrade = UPGRADABLE.has(plan);

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="secondary"
        className={cn("font-medium capitalize", planClass)}
      >
        {planLabel(plan)}
      </Badge>
      {/* Trial countdown + Upgrade CTA collapse on narrow viewports —
          below sm the header would otherwise wrap (badge + countdown +
          button + FeedbackWidget all competing for the same row). The
          plan-tier chip alone communicates the most important state on
          mobile; the rest is reachable via the badge route to billing. */}
      {trialActive && trialDays > 0 ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {trialDays}d trial
        </span>
      ) : null}
      {showUpgrade ? (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="hidden h-7 gap-1 px-2 text-xs sm:inline-flex"
        >
          <Link href="/dashboard/settings/billing">
            Upgrade
            <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
