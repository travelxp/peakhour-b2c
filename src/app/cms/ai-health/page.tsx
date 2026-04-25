"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  XCircle,
  Zap,
} from "lucide-react";
import { KpiCard } from "@/components/cms/ai/kpi-card";
import { formatMs, formatUsd, formatDateTime } from "@/components/cms/ai/format";

interface HealthResponse {
  mongoPingMs: number | null;
  checklist: {
    step1_seed_models: boolean;
    step2_model_registry_sync: boolean;
    step3_first_ai_call: boolean;
    step4_skill_corpus: boolean;
  };
  counts: {
    aiModelsTotal: number;
    aiModelsActive: number;
    registryTotal: number;
    registryWithPricing: number;
    skillTemplates: number;
    bizSkills: number;
  };
  last24h: {
    requests: number;
    errors: number;
    fallbacks: number;
    errorRate: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
  };
  crons: { job: string; lastRunAt?: string; status?: string }[];
  serverTime: string;
}

const CHECKLIST_LABELS: Record<keyof HealthResponse["checklist"], string> = {
  step1_seed_models: "AI useCase configs seeded",
  step2_model_registry_sync: "Model registry synced from Vercel Gateway",
  step3_first_ai_call: "AI call observed in last 24h",
  step4_skill_corpus: "Skill corpus populated",
};

export default function AiHealthPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["cms-ai-health"],
    queryFn: () => api.get<HealthResponse>(`/v1/cms/ai-health`),
    refetchInterval: 30_000,
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Failed to load health: {(error as Error).message}
      </div>
    );
  }

  const errorTone =
    data && data.last24h.errorRate > 0.05
      ? "danger"
      : data && data.last24h.errorRate > 0.01
      ? "warning"
      : "success";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Health</h2>
        <p className="text-muted-foreground mt-1">
          Live activation status, last-24h KPIs, and infrastructure pulse.
          {data && <span className="ml-2 text-xs">Updated {formatDateTime(data.serverTime)}</span>}
        </p>
      </div>

      {/* Activation checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Activation</CardTitle>
          <CardDescription>Steps required for the AI ops surface to be fully wired up.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(Object.keys(CHECKLIST_LABELS) as (keyof HealthResponse["checklist"])[]).map((key) => {
                const ok = data.checklist[key];
                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {ok ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground" />
                    )}
                    <span className={ok ? "" : "text-muted-foreground"}>{CHECKLIST_LABELS[key]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Core KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Mongo ping"
          icon={Database}
          value={isLoading || !data ? "—" : data.mongoPingMs == null ? "down" : `${data.mongoPingMs}ms`}
          hint="Round-trip to primary"
          tone={data?.mongoPingMs == null ? "danger" : data.mongoPingMs > 200 ? "warning" : "success"}
        />
        <KpiCard
          label="24h requests"
          icon={Activity}
          value={isLoading || !data ? "—" : data.last24h.requests.toLocaleString()}
          hint={data ? `${data.last24h.fallbacks} fallback${data.last24h.fallbacks === 1 ? "" : "s"}` : undefined}
        />
        <KpiCard
          label="Error rate"
          icon={AlertTriangle}
          value={isLoading || !data ? "—" : `${(data.last24h.errorRate * 100).toFixed(2)}%`}
          hint={data ? `${data.last24h.errors} errors / ${data.last24h.requests} calls` : undefined}
          tone={errorTone as "default" | "success" | "warning" | "danger"}
        />
        <KpiCard
          label="24h cost"
          icon={DollarSign}
          value={isLoading || !data ? "—" : formatUsd(data.last24h.totalCostUsd)}
          hint={data ? `avg ${formatMs(data.last24h.avgLatencyMs)}` : undefined}
        />
      </div>

      {/* Counts */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading || !data ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)
          ) : (
            <>
              <Stat label="useCase configs" value={`${data.counts.aiModelsActive} / ${data.counts.aiModelsTotal}`} hint="active / total" />
              <Stat label="Registry models" value={data.counts.registryTotal} hint={`${data.counts.registryWithPricing} priced`} />
              <Stat label="Skill templates" value={data.counts.skillTemplates} />
              <Stat label="Business skills" value={data.counts.bizSkills} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Crons */}
      <Card>
        <CardHeader>
          <CardTitle>Cron jobs</CardTitle>
          <CardDescription>Schedule + last run status (populated as jobs report).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-12 w-full" />
          ) : data.crons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cron status reported yet.</p>
          ) : (
            <div className="space-y-2">
              {data.crons.map((cron) => (
                <div key={cron.job} className="flex items-center justify-between text-sm">
                  <span>{cron.job}</span>
                  <div className="flex items-center gap-2">
                    {cron.status && (
                      <Badge variant={cron.status === "completed" ? "secondary" : "destructive"}>
                        {cron.status}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(cron.lastRunAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
