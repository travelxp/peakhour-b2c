"use client";

import { Target, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { UpgradeButton } from "@/components/upgrade/upgrade-button";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { useQueryClient } from "@tanstack/react-query";
import { AdjustmentsBoard } from "./_components/adjustments-board";

const FEATURE_KEY = "growth.optimizer";
const FEATURE_NAME = "Optimizer";
const FEATURE_TAGLINE =
  "An always-on optimizer that auto-promotes winning posts, kills underperformers, and reallocates budget against your stated KPI.";

interface Pillar {
  icon: LucideIcon;
  title: string;
  body: string;
}

const PILLARS: Pillar[] = [
  {
    icon: Target,
    title: "Outcome-driven",
    body: "Set a KPI (CPL, MQLs, follower growth) — the optimizer chooses what to test, where to spend, and when to scale.",
  },
  {
    icon: TrendingUp,
    title: "Closed-loop creative",
    body: "Winning organic posts auto-promote into ad variants. Winning ad creatives recycle into next week's content plan.",
  },
  {
    icon: Zap,
    title: "Auto-pause & reallocate",
    body: "Underperforming creatives are paused at thresholds you set. Their budget moves to whatever is hitting the KPI.",
  },
];

export default function OptimizerPage() {
  const queryClient = useQueryClient();
  return (
    <div className="space-y-6">
      <CronToolbar
        crons={["growth-optimizer", "outcome-backfill", "per-stream-effectiveness-rollup"]}
        onTriggered={() =>
          queryClient.invalidateQueries({ queryKey: ["growth-adjustments"] })
        }
      />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Optimizer</h2>
        {/* Honest at today's autonomy ceiling (L0/L1): it proposes,
            you decide. The autonomous framing stays on the locked-
            state marketing card, not above the live board. */}
        <p className="text-muted-foreground">
          A weekly teammate for paid + organic — it brings you the
          evidence and the dials; you make the calls.
        </p>
      </div>

      <FeatureGate
        feature={FEATURE_KEY}
        featureName={FEATURE_NAME}
        featureTagline={FEATURE_TAGLINE}
        mode="hide"
        fallback={<OptimizerWaitlistCard />}
      >
        {/* Unlocked branch (G3): the live weekly-review board. Every
            proposal is a human decision at today's autonomy ceiling
            (L0/L1) — the board and its copy say so explicitly. */}
        <AdjustmentsBoard />
      </FeatureGate>
    </div>
  );
}

/**
 * Three-up benefit grid — visual language adapted from
 * @shadcnblocks/feature358 (bordered-square icon badge above a
 * stacked title + description). The block's defaults are
 * landing-page scale (py-32, text-lg titles, p-8 cards); we drop the
 * outer section + use shadcn Card (canonical container in this
 * dashboard) at p-6 so the grid sits naturally inside a 6-padding
 * dashboard layout.
 */
function OptimizerPreview() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PILLARS.map(({ icon: Icon, title, body }) => (
        <Card key={title}>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex size-10 items-center justify-center rounded-md border">
              <Icon aria-hidden="true" className="size-5" />
            </div>
            {/* h3 so screen-reader users hit a heading per card; the
                page <h2> sits above this grid so the outline reads
                page-title → pillar-title without jumping levels. */}
            <h3 className="text-base font-medium tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Locked state — what every signed-in user sees today, since
 * `growth.optimizer` is not yet on any plan.
 *
 * Layout adapted from @shadcnblocks/cta36 (horizontal split:
 * heading + description left, action right; collapses to stacked on
 * small screens). The block's defaults are landing-page scale
 * (py-32, max-w-5xl, text-2xl/4xl); we drop the outer section, keep
 * the pattern, and tone everything to dashboard scale (text-base
 * heading, no oversized container).
 *
 * Why mode="hide" + this fallback (over mode="lock"): for full-page
 * features, an inert+muted preview reads like a broken page; a
 * deliberate "preview + reserve access" card reads like an opt-in.
 */
function OptimizerWaitlistCard() {
  return (
    <div className="space-y-4">
      <OptimizerPreview />
      <Card className="border-amber-200 bg-linear-to-br from-amber-50/60 to-white dark:border-amber-900/40 dark:from-amber-950/30 dark:to-transparent">
        <CardContent className="flex flex-col items-start justify-between gap-6 p-6 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-base font-semibold tracking-tight text-amber-950 dark:text-amber-100">
              Reserve early access to Optimizer
            </h3>
            {/* amber-on-amber so contrast holds at the gradient's
                amber end (where `text-muted-foreground` is the
                weakest). The white end + the dark theme are both
                comfortably safe with this token pair. */}
            <p className="max-w-xl text-sm text-amber-900/80 dark:text-amber-200/80">
              Optimizer rolls out to founding members first. Join the waitlist to lock in access + early-bird pricing.
            </p>
          </div>
          <div className="shrink-0">
            <UpgradeButton
              featureKey={FEATURE_KEY}
              featureName={FEATURE_NAME}
              featureTagline={FEATURE_TAGLINE}
            >
              Join waitlist
            </UpgradeButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
