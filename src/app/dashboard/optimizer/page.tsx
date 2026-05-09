"use client";

import { Sparkles, Target, TrendingUp, Zap, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureGate } from "@/components/upgrade/feature-gate";
import { UpgradeButton } from "@/components/upgrade/upgrade-button";
import { useFeature } from "@/hooks/use-feature";

const FEATURE_KEY = "growth.optimizer";
const FEATURE_NAME = "AI Optimizer";
const FEATURE_TAGLINE =
  "An always-on optimizer that auto-promotes winning posts, kills underperformers, and reallocates budget against your stated KPI.";

interface Pillar {
  icon: typeof Target;
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
  // Surface the active plan label in the unlocked header so the page
  // never feels like a placeholder once entitlements switch on.
  const { plan } = useFeature(FEATURE_KEY);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Optimizer</h2>
          <p className="text-muted-foreground">
            An autonomous teammate for paid + organic — running the dials so you don&apos;t have to.
          </p>
        </div>
      </div>

      <FeatureGate
        feature={FEATURE_KEY}
        featureName={FEATURE_NAME}
        featureTagline={FEATURE_TAGLINE}
        mode="hide"
        fallback={<OptimizerWaitlistCard />}
      >
        {/* Unlocked state — until the live optimizer ships, the
            preview pillars double as the surface and a small banner
            confirms the feature is reserved on this plan. */}
        <OptimizerPreview />
        <Card>
          <CardContent className="flex items-center gap-3 py-5 text-sm">
            <Sparkles className="size-4 text-amber-500 shrink-0" />
            <span className="text-muted-foreground">
              Reserved on your <span className="font-medium text-foreground">{plan ?? "current"}</span> plan.
              Live agents roll out as each Phase ships — you&apos;ll see them appear here automatically.
            </span>
          </CardContent>
        </Card>
      </FeatureGate>
    </div>
  );
}

/**
 * Three-up benefit grid used by both the locked fallback and the
 * (future) unlocked surface — keeps the visual weight identical so
 * upgrading doesn't cause a layout shift.
 */
function OptimizerPreview() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PILLARS.map(({ icon: Icon, title, body }) => (
        <Card key={title}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-1.5">
                <Icon className="size-4 text-primary" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Locked state — what every signed-in user sees today, since
 * `growth.optimizer` is not yet on any plan. Renders the preview
 * pillars so the value is visible, then a single waitlist CTA.
 *
 * Prefer mode="hide" + a fallback like this over mode="lock" for
 * full-page features: an inert+muted preview reads like a broken
 * page, while a deliberate "preview + reserve access" card reads
 * like an opt-in.
 */
function OptimizerWaitlistCard() {
  return (
    <div className="space-y-4">
      <OptimizerPreview />
      <Card className="border-amber-200 bg-linear-to-br from-amber-50/60 to-white dark:border-amber-900/40 dark:from-amber-950/30 dark:to-transparent">
        <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/40">
              <Lock className="size-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-medium">Reserve early access</p>
              <p className="text-sm text-muted-foreground">
                AI Optimizer rolls out to founding members first. Join the waitlist to lock in access + early-bird pricing.
              </p>
            </div>
          </div>
          <div className="sm:ml-4">
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
