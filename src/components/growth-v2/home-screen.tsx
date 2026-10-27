"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  useGrowthV2DecisionCounts,
  useGrowthV2Home,
  type Figure,
  type HomeCompare,
  type HomeRefusalCode,
  type HomeResponse,
  type HomeScreenData,
  type HomeWindowKey,
} from "@/lib/api/growth-v2";
import { GROWTH_HOME } from "@/lib/growth-v2-nav";
import { absentReason, unitFor, currencyOf, figureValue, formatCount, formatMoney, homeHeadline, WINDOWS } from "@/lib/growth-v2-figure";
import { sparkValues } from "@/lib/growth-v2-series";
import { ActivityFeed } from "./activity-feed";
import { EfficiencyBullet } from "./efficiency-bullet";
import { FigureValue } from "./figure-value";
import { KpiCard } from "./kpi-card";
import { LiftBand } from "./lift-band";
import { OutcomeFunnel } from "./outcome-funnel";
import { PacingBadge, PacingChart } from "./pacing-chart";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { cn } from "@/lib/utils";
import { WhyWaterfall } from "./why-waterfall";

const COMPARES: Record<HomeCompare, string> = { last_period: "Against the last period", holdout: "Against the holdout" };

/** Growth home: "Is it working?" (plan 1, H1). */
export function HomeScreen() {
  const [window, setWindow] = useState<HomeWindowKey>("7d");
  const [compare, setCompare] = useState<HomeCompare>("last_period");
  const query = useGrowthV2Home(window, compare);
  // The api's own count of open decisions, not a count of one loaded page.
  const counts = useGrowthV2DecisionCounts();
  const open = counts.data?.data.open;
  if (query.data && "refusal" in query.data) return <NotSetUp code={query.data.refusal} />;
  // The prototype's sample is one fixed window: controls that cannot change it would only contradict the page.
  const preview = query.data?.preview === true;
  return (
    <div className="grid gap-4">
      {preview ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Choice label="Window" value={window} options={WINDOWS} onChange={setWindow} text={(o) => o.choice} />
          <Choice label="Compare" value={compare} options={COMPARES} onChange={setCompare} text={(o) => o} />
        </div>
      )}
      <div aria-busy={query.isPlaceholderData} className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}>
        {/* A refusal returned above, so what the boundary hands on is a page. */}
        <QueryBoundary query={query as UseQueryResult<HomeScreenData>}>{(r) => <HomeBody result={r} openDecisions={open} />}</QueryBoundary>
      </div>
    </div>
  );
}

function Choice<K extends string, O>({ label, value, options, onChange, text }: { label: string; value: K; options: Record<K, O>; onChange: (k: K) => void; text: (o: O) => string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border p-0.5">
      {(Object.keys(options) as K[]).map((k) => (
        <Button key={k} type="button" size="sm" variant={k === value ? "secondary" : "ghost"} aria-pressed={k === value} onClick={() => onChange(k)} className={cn("h-8 px-3", k === value && "shadow-none")}>
          {text(options[k])}
        </Button>
      ))}
    </div>
  );
}

/** The two refusals the api gives instead of a page: no mandate, or no business clock. */
export function NotSetUp({ code }: { code: HomeRefusalCode }) {
  const noMandate = code === "NO_MANDATE";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{noMandate ? "Growth isn't set up yet" : "Set your business time zone"}</CardTitle>
        <CardDescription>
          {noMandate
            ? "Tell us what you want more of and what you can spend, and the engine will start reporting here."
            : "Your figures cover whole days on your own clock. Set the time zone in Rules and this page will fill in."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href={noMandate ? `${GROWTH_HOME}/start` : `${GROWTH_HOME}/rules`}>{noMandate ? "Set up Growth" : "Open Rules"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const LOWER_IS_BETTER = new Set(["cost_per_outcome"]);

/** Says so when weeks we could not read cut a trend short, or hide it. */
function sparkNote(spark: Figure[] | undefined): string | undefined {
  if (!spark) return undefined;
  const read = spark.filter((f) => figureValue(f) !== undefined).length;
  if (read === 0 || read === spark.length) return undefined;
  const run = sparkValues(spark);
  return run ? `Trend covers the last ${run.length} weeks we could read in a row.` : "Not enough recent weeks to draw a trend.";
}

export function HomeBody({ result, openDecisions }: { result: HomeScreenData; openDecisions: number | undefined }) {
  const home: HomeResponse = result.data;
  const currency = currencyOf(home.pacing.monthlyCeiling, home.pacing.spentThisMonth);
  const unit = unitFor(home.outcome.kind);
  const words = WINDOWS[home.window.key];
  const holdout = home.window.compare === "holdout";
  const goal = home.goal;
  const soFar = figureValue(goal?.soFar);
  const pace = figureValue(goal?.paceVsGoal);
  const goalPct = goal && soFar !== undefined && goal.perMonth > 0 ? Math.min(100, Math.round((soFar / goal.perMonth) * 100)) : undefined;
  const daysInMonth = result.pacingSeries?.daysInMonth ?? 0;
  const headline = homeHeadline(home, currency);
  const outcomes = home.kpis.find((k) => k.key === "outcomes")?.figure;
  const kpiFormat = (key: string) => (n: number) =>
    key === "cost_per_outcome" || key === "spend" ? formatMoney(n, currency) : key === "roas" ? `${n.toFixed(1)}x` : formatCount(n);
  const waterfallAbsent = "absent" in home.waterfallBasis ? home.waterfallBasis.absent : undefined;
  const waterfallBasis = "basis" in home.waterfallBasis ? home.waterfallBasis.basis : undefined;
  // A reason is a sentence or a code read as one; the full stop is this card's own.
  const waterfallReason = waterfallAbsent ? (absentReason({ absent: waterfallAbsent }) ?? "").replace(/[.\s]+$/, "") : "";

  return (
    <div className="grid gap-4">
      <PageHead
        title="Is it working?"
        description={`${home.outcome.label} for ${words.title}, what the engine caused, and what it costs you. ${home.pacing.daysLeft} days left in the month.`}
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
              <FigureValue figure={outcomes} showReason />
              <small className="ml-2 text-lg font-medium text-muted-foreground">in {words.title}</small>
            </p>
            <p className="mt-3 max-w-prose text-[15px]">{headline}</p>
            {goal ? (
              <div className="mt-4 space-y-1.5">
                <p className="text-sm">
                  This month: <FigureValue figure={goal.soFar} showReason /> of {formatCount(goal.perMonth)} goal
                </p>
                {goalPct !== undefined ? (
                  <>
                    <Progress value={goalPct} aria-label={`${goalPct}% of the monthly goal`} indicatorClassName="bg-chart-1" className="h-2 bg-muted" />
                    <p className="text-xs text-muted-foreground">
                      {goalPct}% of goal
                      {pace !== undefined ? (
                        <>
                          {" "}
                          &middot; heading for {Math.round(pace * 100)}% of goal by month end
                          {figureValue(goal.projected) !== undefined ? ` (about ${formatCount(figureValue(goal.projected) as number)})` : ""}
                        </>
                      ) : (
                        <> &middot; pace not available yet{absentReason(goal.paceVsGoal) ? ` (${absentReason(goal.paceVsGoal)})` : ""}</>
                      )}
                    </p>
                  </>
                ) : (
                  <p data-absent="" className="text-xs text-muted-foreground">
                    Progress against the goal is not available yet.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 space-y-2">
            <EfficiencyBullet
              metric={home.efficiency.metric}
              you={home.efficiency.you}
              target={home.efficiency.target}
              industry={home.efficiency.industry}
              currency={currency}
              unit={unit.one}
            />
            <p className="text-xs text-muted-foreground">{home.efficiency.basis}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {home.kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            figure={k.figure}
            format={kpiFormat(k.key)}
            change={k.change}
            lowerIsBetter={LOWER_IS_BETTER.has(k.key)}
            changeNote={holdout && k.key === "outcomes" ? "vs the holdout" : `vs ${words.before}`}
            spark={sparkValues(k.spark)}
            note={sparkNote(k.spark)}
          />
        ))}
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
            <CardTitle>Spend vs ceiling</CardTitle>
            <CardDescription>This month, day by day.</CardDescription>
          </CardHeader>
          <CardContent>
            <PacingChart spent={home.pacing.spentThisMonth} ceiling={home.pacing.monthlyCeiling} daysLeft={home.pacing.daysLeft} series={result.pacingSeries} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{home.efficiency.metric === "roas" ? "Why your return moved" : `Why cost per ${unit.one} moved`}</CardTitle>
            <CardDescription>From {words.before} to now, one cause at a time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {home.waterfall.length === 0 ? (
              <p data-absent="" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Not available{waterfallReason ? `: ${waterfallReason}` : ""}. We only show causes we can compute.
              </p>
            ) : (
              <WhyWaterfall items={home.waterfall} currency={home.efficiency.metric === "roas" ? undefined : currency} higherIsBetter={home.efficiency.metric === "roas"} />
            )}
            {waterfallBasis ? <p className="text-xs text-muted-foreground">{waterfallBasis}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>From seen to {unit.one === "booking" ? "booked" : "done"}</CardTitle>
            <CardDescription>Organic and paid together, one window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OutcomeFunnel stages={home.funnel.stages} />
            <p className="text-xs text-muted-foreground">{home.funnel.basis}</p>
          </CardContent>
        </Card>
      </div>

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
  );
}
