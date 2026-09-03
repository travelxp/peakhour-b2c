"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardOrg } from "@/hooks/use-dashboard-org";
import { namesAProduct, planDisplayName, showUpgradeCta } from "@/lib/plan-status";

/** Plan-tier accent colors. Tailwind class strings only — kept narrow
 *  so a designer can tune without touching component logic. */
const PLAN_STYLES: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter:
    "bg-state-info/15 text-state-info-on-tint",
  growth:
    "bg-success/15 text-success-on-tint",
  agency:
    "bg-state-progress/15 text-state-progress-on-tint",
  enterprise:
    "bg-warning/15 text-warning-on-tint",
};

/**
 * Compact plan/trial indicator for the dashboard top bar.
 *
 * Reads `/v1/dashboard/org`. Renders:
 *   - a colored badge naming the plan — `planName` where the server has one,
 *     else a paid product's own name, else the base tier
 *   - "Xd trial" subtle text when a trial is active
 *   - a small "Upgrade" CTA linking to /dashboard/settings/billing when the
 *     base tier is upgradable **and the org holds no paid product**
 *
 * ⚠️🚫★★AND THAT SECOND CONDITION IS WHY THIS DOCBLOCK CHANGED. It used to read
 * *"when the plan is upgradable (free/starter/growth)"*, which is what the code
 * did — and `subscription.plan` stays `free` while purchases live in
 * `products[]`, so an org that had bought Peakhour Suite was told to upgrade on
 * every dashboard page. ★The rule lives in `lib/plan-status.ts` now, shared with
 * the billing page, which had already fixed this for itself.
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
  // ⚠️🚫★★THE ACCENT FOLLOWS THE LABEL, NOT THE BASE TIER. A round found a
  //  paying org reading "Peakhour Suite" in the MUTED free-tier chip, because
  //  the colour was still keyed on `subscription.plan`. ★A label and its colour
  //  disagreeing is the same wrong answer in two channels.
  const planClass = namesAProduct(summary)
    ? PLAN_STYLES.growth
    : (PLAN_STYLES[plan] ?? PLAN_STYLES.free);
  const trialActive = summary.subscription.trialActive === true;
  const trialDays = summary.subscription.trialDaysRemaining ?? 0;

  // ── ⚠️🚫★★THE CTA ASKS ABOUT WHAT THE ORG **HOLDS**, NOT ONLY ITS BASE TIER
  //
  // 🚫★★A REPORTED BUG: an org that had bought Peakhour Suite (and Peaks) was
  //  told to *"Upgrade"* on **every dashboard page, permanently** — because
  //  `subscription.plan` stays `free` while purchases live in `products[]`, and
  //  this badge read only the first. ★The billing page it links to already
  //  guarded exactly that, and says so in its own comment: *"without this, the
  //  page reads 'Free' and prompts a re-purchase."* **A guard written in one
  //  file and dropped in the next** — so the rule now lives in one place both
  //  of them read.
  const showUpgrade = showUpgradeCta(summary);

  // ⚠️★AND THE LABEL FOLLOWS THE SUMMARY'S OWN INSTRUCTION. Its type says
  //  *"ALWAYS prefer `planName` — `plan` is a machine tier key"*, and records
  //  what ignoring it did last time: customers were shown
  //  *"Commerce_assistant.Free"* as their plan name. 🚫This badge capitalised
  //  the key while the billing page preferred the name, so the two could call
  //  one plan two different things on two screens.
  const label = planDisplayName(summary);

  return (
    <div className="flex items-center gap-2">
      {/* ⚠️★★IT TRUNCATES NOW, BECAUSE THE LABEL STOPPED BEING SHORT. It used
          to be a capitalised tier key — "Free", "Growth" — and is now the
          server's own name, which runs to things like "Peakhour.ai Commerce:
          Free". 🚫This header is a non-wrapping `h-14` row shared with three
          other controls, so an untruncated chip pushes them off a narrow
          viewport. ★The full name stays reachable as a `title`. */}
      <Badge
        variant="secondary"
        className={cn("max-w-[10rem] font-medium capitalize", planClass)}
        title={label ?? undefined}
      >
        {/* ⚠️★THE TRUNCATE LIVES ON AN INNER BLOCK. `Badge` is `inline-flex`, and
            `truncate` on a flex container clips without an ellipsis — the width
            was protected and the reader got no sign that a word had been cut. */}
        <span className="block truncate">{label}</span>
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
          {/* ★IT NAMES WHAT IT WOULD DO. A bare "Upgrade" beside a plan chip
              does not say whether something is WRONG or something is merely
              available — and the report that produced this change asked for a
              control that explains what is needed. */}
          <Link href="/dashboard/settings/billing" title="See plans and add a product">
            Upgrade
            <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
