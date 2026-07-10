"use client";

import { CheckCircle2, ShoppingBag } from "lucide-react";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { KpiCard } from "@/components/molecules/kpi-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Peaks } from "@/components/peaks/peaks";
import { useWaAnalytics } from "@/hooks/use-wa-analytics";

const PILLAR_LABEL: Record<string, string> = {
  support: "Support",
  commerce: "Commerce",
  growth: "Growth",
  content: "Content",
  general: "General",
};

export default function WhatsAppAnalyticsPage() {
  const { data, isLoading } = useWaAnalytics(30);
  const total = data?.totalPeaks ?? 0;
  const maxPillar = Math.max(1, ...(data?.byPillar ?? []).map((p) => p.peaks));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <CronToolbar crons={["wa-outcome-billing"]} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp outcomes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What your WhatsApp assistant delivered in the last {data?.windowDays ?? 30} days. You’re billed on outcomes, not chatter.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard title="Resolved conversations" value={data?.resolved.count ?? 0} icon={CheckCircle2} />
          <KpiCard title="Assisted orders" value={data?.assisted.count ?? 0} icon={ShoppingBag} />
          <Card className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Peaks spent</p>
            <div className="mt-2">
              <Peaks amount={total} />
            </div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <p className="text-sm font-medium">Outcomes by product</p>
        <div className="mt-3 space-y-2.5">
          {isLoading && <Skeleton className="h-4 w-full" />}
          {!isLoading && (data?.byPillar.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No billable outcomes yet.</p>
          )}
          {data?.byPillar.map((p) => (
            <div key={p.pillar} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm">{PILLAR_LABEL[p.pillar] ?? p.pillar}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(p.peaks / maxPillar) * 100}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right">
                <Peaks amount={p.peaks} />
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
