"use client";

import { useMemo } from "react";
import { BookMarked, Sparkles, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PendingItemsCard } from "@/components/molecules/pending-items-card";
import { ProportionListCard } from "@/components/molecules/proportion-list-card";
import { RankedListCard } from "@/components/molecules/ranked-list-card";
import { SOURCE_TYPE_LABEL, type SourceType, type TrustedSource } from "../types";

/**
 * Insights panel — Day-3 surface per the LinkedIn 360 plan §3.4.
 *
 * Composes generic molecules (KpiCard, RankedListCard,
 * ProportionListCard, PendingItemsCard) so the same shapes can be
 * reused for the X / LinkedIn / Beehiiv insights surfaces when they
 * land. This module's only job is the trusted-sources-specific
 * aggregate computation + the wiring to those molecules.
 *
 * Ships the aggregates derivable from the listing payload alone:
 *   • Active count, total citations (sum of usageCount), avg trust
 *     across active sources.
 *   • Top 5 cited sources (by usageCount, ties broken by trustScore).
 *   • Active sources by type (proportion list).
 *
 * Held back for follow-ups (depend on backend telemetry that doesn't
 * exist yet — see PendingItemsCard items below):
 *   • Citation timeline — needs `cnt_source_usage` time-series.
 *   • Coverage heatmap — proprietary scorer (§6 algo #4).
 *   • Drift alerts — rejection-topic embedding comparison cron.
 */

interface InsightsPanelProps {
  rows: TrustedSource[];
}

export function InsightsPanel({ rows }: InsightsPanelProps) {
  const stats = useMemo(() => computeStats(rows), [rows]);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Insights light up once you&apos;ve added sources and the AI starts citing them.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top row: three KpiCards (existing molecule). Citations
          shows a hint when 0 so a brand-new tenant doesn't read it
          as "your AI doesn't cite anything" — it reads "you haven't
          generated content yet." */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Active sources"
          value={stats.totalActive}
          icon={BookMarked}
        />
        <KpiCard
          title="Citations"
          value={stats.totalCitations}
          description={
            stats.totalCitations === 0
              ? "Once the AI cites a source, the count lands here"
              : "All-time, across active sources"
          }
          icon={Sparkles}
        />
        <KpiCard
          title="Avg trust"
          value={stats.avgTrust === null ? "—" : `${Math.round(stats.avgTrust * 100)}`}
          description="Active sources, 0–100"
          icon={Trophy}
        />
      </div>

      {/* Two-up: top cited + by-type breakdown. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RankedListCard
          title="Top cited"
          items={stats.topCited.map((s) => ({
            id: s._id,
            title: s.displayName,
            subtitle: s.identifier,
            value: s.usageCount ?? 0,
          }))}
          emptyMessage="No citations yet. The AI cites sources as it generates briefs and plans."
        />
        <ProportionListCard
          title="Active sources by type"
          items={stats.byType.map((b) => ({
            id: b.type,
            label: SOURCE_TYPE_LABEL[b.type],
            count: b.count,
          }))}
          total={stats.totalActive}
          emptyMessage="No active sources to break down."
        />
      </div>

      <PendingItemsCard
        items={[
          { title: "Citation timeline", gatedOn: "cnt_source_usage time-series aggregate endpoint" },
          { title: "Coverage heatmap", gatedOn: "proprietary scorer (algo in design)" },
          { title: "Drift alerts", gatedOn: "rejection-topic embedding comparison cron" },
        ]}
      />
    </div>
  );
}

interface AggregateStats {
  totalActive: number;
  totalCitations: number;
  avgTrust: number | null;
  byType: Array<{ type: SourceType; count: number }>;
  topCited: TrustedSource[];
}

/**
 * Aggregate over **active** sources only. Including paused or
 * rejected rows would inflate citation counts the user can't act on,
 * and inflate the type breakdown with sources their AI is no longer
 * reading.
 */
function computeStats(rows: TrustedSource[]): AggregateStats {
  const active = rows.filter((r) => r.status === "active");

  const totalCitations = active.reduce((sum, r) => sum + (r.usageCount ?? 0), 0);

  const avgTrust =
    active.length === 0
      ? null
      : active.reduce((sum, r) => sum + r.trustScore, 0) / active.length;

  const typeCounts = new Map<SourceType, number>();
  for (const r of active) {
    typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
  }
  const byType = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Top cited — break ties by trustScore so a higher-trust source
  // leads when two sources have the same usage count. The molecule
  // caps display at 5; we still pre-filter and sort here.
  const topCited = [...active]
    .filter((r) => (r.usageCount ?? 0) > 0)
    .sort((a, b) => {
      const ua = a.usageCount ?? 0;
      const ub = b.usageCount ?? 0;
      if (ub !== ua) return ub - ua;
      return b.trustScore - a.trustScore;
    });

  return {
    totalActive: active.length,
    totalCitations,
    avgTrust,
    byType,
    topCited,
  };
}
