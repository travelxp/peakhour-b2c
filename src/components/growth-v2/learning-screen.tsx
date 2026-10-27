"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mandateFor, useGrowthV2Learning, useGrowthV2Rules, type LearningResponse, type V2Result } from "@/lib/api/growth-v2";
import { unitFor } from "@/lib/growth-v2-figure";
import { BenchmarkRows } from "./benchmark-rows";
import { CreativeLeaderboard } from "./creative-leaderboard";
import { EnquiryHeatmap } from "./enquiry-heatmap";
import { ExperimentTimeline } from "./experiment-timeline";
import { NotSetUp } from "./not-set-up";
import { PageHead } from "./page-head";
import { QueryBoundary } from "./query-boundary";
import { ToneBadge } from "./tone";

/** Learning: "What did we learn?" Every bet the engine made and what changed because of it (plan 1, H4). */
export function LearningScreen() {
  const query = useGrowthV2Learning();
  const rules = useGrowthV2Rules();
  // The api's own refusals, the same two as Growth home: shown as an answer, not an error.
  if (query.data && "refusal" in query.data) return <NotSetUp code={query.data.refusal} />;
  return (
    <div className="grid gap-4">
      <PageHead title="What did we learn?" description="Every bet the engine made, how it was judged, and what changed because of it." />
      <QueryBoundary query={query as UseQueryResult<V2Result<LearningResponse>>}>{(r) => {
          const mandate = mandateFor(rules.data, r.preview);
          return <LearningBody learning={r.data} unitPlural={unitFor(mandate?.outcome.kind).many} currency={mandate?.currency ?? ""} />;
        }}</QueryBoundary>
    </div>
  );
}

export function LearningBody({ learning, unitPlural, currency }: { learning: LearningResponse; unitPlural: string; currency: string }) {
  const judged = learning.experiments.filter((e) => e.verdict !== undefined);
  const won = judged.filter((e) => e.verdict === "winner").length;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Experiment ledger</CardTitle>
            <CardDescription>{learning.basis.experiments}</CardDescription>
            <CardAction>
              <ToneBadge>
                {learning.experiments.length} {learning.experiments.length === 1 ? "experiment" : "experiments"} &middot; {won} won
              </ToneBadge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ExperimentTimeline experiments={learning.experiments} />
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Creative patterns that win</CardTitle>
              <CardDescription>Your extra {unitPlural} per 1,000 views, by hook, once something measures it.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreativeLeaderboard patterns={learning.creativePatterns} unitPlural={unitPlural} emptyReason={learning.basis.creativePatterns} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>You vs businesses like you</CardTitle>
              <CardDescription>{learning.basis.benchmarks}</CardDescription>
            </CardHeader>
            <CardContent>
              <BenchmarkRows benchmarks={learning.benchmarks} currency={currency} />
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>When people convert</CardTitle>
          <CardDescription>{learning.basis.heatmap} Darker means more.</CardDescription>
        </CardHeader>
        <CardContent>
          <EnquiryHeatmap heatmap={learning.heatmap} unitPlural="credited orders" />
        </CardContent>
      </Card>
    </div>
  );
}
