"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { AlertTriangle, CalendarClock, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * /cms/scheduler — cross-org scheduler observability. Reads
 * GET /v1/cms/scheduler-health (platform-level aggregate; CMS-role
 * gated server-side). Surfaces the in-play item backlog, the statuses
 * an operator must act on (failed / awaiting_retry / needs_action),
 * recurring-rule health (spawn errors + overdue), and the orgs with the
 * largest live backlog. The <CronToolbar/> band covers the three crons
 * that move this data.
 */

interface SchedulerHealth {
  generatedAt: string;
  items: {
    byStatus: Record<string, number>;
    total: number;
    attention: { failed: number; awaitingRetry: number; needsAction: number };
  };
  recurring: {
    byStatus: Record<string, number>;
    total: number;
    withSpawnError: number;
    overdue: number;
  };
  topOrgsByPending: { orgId: string; orgName: string; pending: number }[];
}

// Stable display order for item statuses (in-play first, terminal last).
const ITEM_STATUS_ORDER = [
  "queued",
  "ready",
  "in_flight",
  "awaiting_retry",
  "needs_action",
  "published",
  "failed",
  "cancelled",
  "skipped",
];

const RULE_STATUS_ORDER = ["active", "paused", "completed", "expired"];

export default function CmsSchedulerPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cms:scheduler-health"],
    queryFn: () => api.get<SchedulerHealth>("/v1/cms/scheduler-health"),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <CronToolbar crons={["publish-scheduled", "publish-retry", "recurring-spawn"]} />

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarClock className="size-5 text-primary" /> Scheduler health
        </h1>
        <p className="text-muted-foreground">
          Cross-org view of scheduled items and recurring rules.
        </p>
      </div>

      {isLoading ? (
        <HealthSkeleton />
      ) : isError || !data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load scheduler health. Try refreshing.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Attention chips */}
          <div className="grid gap-3 sm:grid-cols-3">
            <AttentionCard label="Failed" value={data.items.attention.failed} />
            <AttentionCard label="Awaiting retry" value={data.items.attention.awaitingRetry} />
            <AttentionCard label="Needs action" value={data.items.attention.needsAction} />
          </div>

          {/* Items by status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                Scheduled items
                <Badge variant="outline" className="tabular-nums">{data.items.total} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatusGrid byStatus={data.items.byStatus} order={ITEM_STATUS_ORDER} />
            </CardContent>
          </Card>

          {/* Recurring rules */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Repeat className="size-4" /> Recurring rules
                <Badge variant="outline" className="tabular-nums">{data.recurring.total} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusGrid byStatus={data.recurring.byStatus} order={RULE_STATUS_ORDER} />
              <div className="flex flex-wrap gap-2">
                <HealthChip
                  label="With spawn error"
                  value={data.recurring.withSpawnError}
                  bad={data.recurring.withSpawnError > 0}
                />
                <HealthChip
                  label="Overdue (>1h)"
                  value={data.recurring.overdue}
                  bad={data.recurring.overdue > 0}
                />
              </div>
            </CardContent>
          </Card>

          {/* Top orgs by backlog */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top orgs by live backlog</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topOrgsByPending.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No orgs with pending scheduled items.
                </p>
              ) : (
                <ul className="divide-y">
                  {data.topOrgsByPending.map((o) => (
                    <li key={o.orgId} className="flex items-center justify-between py-2">
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{o.orgName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{o.orgId}</span>
                      </span>
                      <Badge variant="outline" className="tabular-nums">{o.pending} pending</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-right text-xs text-muted-foreground">
            Snapshot at {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}

function AttentionCard({ label, value }: { label: string; value: number }) {
  const bad = value > 0;
  return (
    <Card className={cn(bad && "border-destructive/40 bg-destructive/5")}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={cn("text-2xl font-semibold tabular-nums", bad && "text-destructive")}>
            {value}
          </span>
        </div>
        {bad && <AlertTriangle className="size-5 text-destructive" />}
      </CardContent>
    </Card>
  );
}

function StatusGrid({
  byStatus,
  order,
}: {
  byStatus: Record<string, number>;
  order: string[];
}) {
  // Known statuses in display order, then any unknown ones the API
  // returned (forward-compat) appended.
  const keys = [
    ...order.filter((k) => k in byStatus),
    ...Object.keys(byStatus).filter((k) => !order.includes(k)),
  ];
  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">None.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <div key={k} className="rounded-md border bg-muted/30 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</span>
          <span className="ml-2 text-sm font-semibold tabular-nums">{byStatus[k]}</span>
        </div>
      ))}
    </div>
  );
}

function HealthChip({ label, value, bad }: { label: string; value: number; bad: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 tabular-nums",
        bad && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      {bad && <AlertTriangle className="size-3" />}
      {label}: {value}
    </Badge>
  );
}

function HealthSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
