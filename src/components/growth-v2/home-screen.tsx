"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGrowthV2Decisions, useGrowthV2Home, type HomeResponse, type HomeScreenData } from "@/lib/api/growth-v2";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { OUTCOME_UNIT, currencyOf, figureValue, formatCount, formatMoney, homeHeadline } from "@/lib/growth-v2-figure";
import { tabCounts } from "@/lib/growth-v2-decisions";
import { ActivityFeed } from "./activity-feed";
import { EfficiencyBullet } from "./efficiency-bullet";
import { FigureValue } from "./figure-value";
import { KpiCard } from "./kpi-card";
import { LiftBand } from "./lift-band";
import { OutcomeFunnel } from "./outcome-funnel";
import { PacingBadge, PacingMeter } from "./pacing-chart";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { WhyWaterfall } from "./why-waterfall";

/** Growth home: "Is it working?" (plan 1, H1). */
export function HomeScreen() {
  const query = useGrowthV2Home();
  const decisions = useGrowthV2Decisions();
  const open = decisions.data ? tabCounts(decisions.data.data.decisions).needs_you : undefined;
  return <QueryBoundary query={query}>{(r) => <HomeBody result={r} openDecisions={open} />}</QueryBoundary>;
}

const LOWER_IS_BETTER = new Set(["cost_per_outcome"]);

export function HomeBody({ result, openDecisions }: { result: HomeScreenData; openDecisions: number | undefined }) {
  const home: HomeResponse = result.data;
  const currency = currencyOf(home.pacing.monthlyCeiling, home.pacing.spentThisMonth);
  const unit = OUTCOME_UNIT[home.outcome.kind];
  const goal = home.goal;
  const soFar = figureValue(goal?.soFar);
  const pace = figureValue(goal?.paceVsGoal);
  const goalPct = goal && soFar !== undefined && goal.perMonth > 0 ? Math.min(100, Math.round((soFar / goal.perMonth) * 100)) : undefined;
  const daysInMonth = result.pacingSeries?.daysInMonth ?? 0;
  const headline = homeHeadline(home, currency);

  return (
    <div className="grid gap-4">
      <PageHead
        title="Is it working?"
        description={`${home.outcome.label} this month, what the engine caused, and what it costs you. ${home.pacing.daysLeft} days left.`}
        actions={
          <>
            <PacingBadge spent={home.pacing.spentThisMonth} ceiling={home.pacing.monthlyCeiling} daysLeft={home.pacing.daysLeft} daysInMonth={daysInMonth} />
            <Button asChild variant="outline" size="sm">
              <Link href={`${GROWTH_HOME}/decisions`}>
                {openDecisions === undefined ? "Decisions" : `${openDecisions} ${openDecisions === 1 ? "decision needs" : "decisions need"} you`}
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your outcome &middot; {home.outcome.label}</p>
            <p className="mt-2 text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
              <FigureValue figure={goal?.soFar ?? home.kpis.find((k) => k.key === "outcomes")?.figure} showReason />
              {goal ? <small className="ml-2 text-lg font-medium text-muted-foreground">of {formatCount(goal.perMonth)} goal</small> : null}
            </p>
            <p className="mt-3 max-w-prose text-[15px]">{headline}</p>
            {goalPct !== undefined ? (
              <div className="mt-4 space-y-1.5">
                <Progress value={goalPct} aria-label={`${goalPct}% of the monthly goal`} indicatorClassName="bg-chart-1" className="h-2 bg-muted" />
                <p className="text-xs text-muted-foreground">
                  {goalPct}% of goal
                  {pace !== undefined ? <> &middot; heading for {Math.round(pace * 100)}% of goal by month end</> : <> &middot; pace not available yet</>}
                </p>
              </div>
            ) : goal ? (
              <p data-absent="" className="mt-4 text-xs text-muted-foreground">
                Progress against the goal is not available yet.
              </p>
            ) : null}
          </div>
          <EfficiencyBullet
            metric={home.efficiency.metric}
            you={home.efficiency.you}
            target={home.efficiency.target}
            industry={home.efficiency.industry}
            currency={currency}
            unit={unit.one}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {home.kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            figure={k.figure}
            format={k.key === "cost_per_outcome" ? (n) => formatMoney(n, currency) : formatCount}
            change={k.change}
            lowerIsBetter={LOWER_IS_BETTER.has(k.key)}
            spark={result.series?.sparks[k.key]}
          />
        ))}
        <Card className="gap-0 py-4">
          <CardContent className="space-y-2 px-4">
            <p className="text-sm font-medium text-muted-foreground">Spend vs ceiling</p>
            <PacingMeter spent={home.pacing.spentThisMonth} ceiling={home.pacing.monthlyCeiling} daysLeft={home.pacing.daysLeft} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{home.outcome.label} with ads vs without</CardTitle>
            <CardDescription>Weekly, from the areas we advertise in (scaled) against the holdout areas.</CardDescription>
          </CardHeader>
          <CardContent>
            <LiftBand weeks={result.series?.liftWeeks} weeklyGoal={result.series?.weeklyGoal} lift={home.lift} unitPlural={unit.many} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What the engine did</CardTitle>
            <CardDescription>Every check, change and refusal, with the reason.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed events={home.feed} decisionsHref={`${GROWTH_HOME}/decisions`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{home.efficiency.metric === "roas" ? "Why your return moved" : `Why cost per ${unit.one} moved`}</CardTitle>
            <CardDescription>From last month to now, one cause at a time.</CardDescription>
          </CardHeader>
          <CardContent>
            <WhyWaterfall items={home.waterfall} currency={home.efficiency.metric === "roas" ? undefined : currency} higherIsBetter={home.efficiency.metric === "roas"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>From seen to {unit.one === "booking" ? "booked" : "done"}</CardTitle>
            <CardDescription>Organic and paid together, one window.</CardDescription>
          </CardHeader>
          <CardContent>
            <OutcomeFunnel stages={home.funnel.stages} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
