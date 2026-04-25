"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  DollarSign,
  XCircle,
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
  retention?: {
    name: string;
    expireAfterSeconds?: number;
    granularity?: string;
    count: number;
  }[];
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

function formatRetention(seconds?: number): string {
  if (seconds == null) return "—";
  const days = seconds / 86400;
  if (days >= 365) {
    const years = days / 365;
    return Number.isInteger(years) ? `${years}y` : `${years.toFixed(1)}y`;
  }
  return `${days.toFixed(0)}d`;
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

      {/* Retention */}
      <Card>
        <CardHeader>
          <CardTitle>Retention</CardTitle>
          <CardDescription>
            Currently-applied TTL per time-series log collection. Use{" "}
            <code className="font-mono">npm run ttl:dev</code> /{" "}
            <code className="font-mono">ttl:prod</code> in peakhour-mongodb to swap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : !data.retention?.length ? (
            <p className="text-sm text-muted-foreground">No retention metadata reported.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.retention.map((r) => (
                <div key={r.name} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{r.name}</span>
                    <span className="font-semibold tabular-nums">
                      {formatRetention(r.expireAfterSeconds)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>granularity: {r.granularity || "—"}</span>
                    <span>{r.count >= 0 ? `${r.count.toLocaleString()} rows` : "count unavailable"}</span>
                  </div>
                </div>
              ))}
            </div>
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
