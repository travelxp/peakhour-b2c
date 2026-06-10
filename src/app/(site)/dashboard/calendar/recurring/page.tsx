"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Pause,
  Play,
  Plus,
  Repeat,
} from "lucide-react";
import { scheduler } from "@/lib/scheduler/client";
import type { RecurringRuleDto, RecurringRuleStatus } from "@/lib/scheduler/types";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * /dashboard/calendar/recurring — manage recurring schedule rules
 * (scd_recurring_rules). Lists each rule with its cadence, next run,
 * last spawn, channels, run counters, and any spawn error, plus
 * Pause/Resume controls. Rules are CREATED from the composer's schedule
 * mode (recurring option); this surface is the management + health view.
 *
 * The recurring-spawn cron turns due rules into publish plans, so this
 * page renders the <CronToolbar/> band (non-prod) for it.
 */

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLE: Record<RecurringRuleStatus, { label: string; chip: string }> = {
  active: { label: "Active", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  paused: { label: "Paused", chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  completed: { label: "Completed", chip: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-400" },
  expired: { label: "Expired", chip: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-400" },
};

function cadenceSummary(r: RecurringRuleDto): string {
  const at = `at ${r.localTime} ${r.timezone}`;
  const every = (unit: string) => (r.interval > 1 ? `Every ${r.interval} ${unit}s` : null);
  switch (r.freq) {
    case "daily":
      return `${every("day") ?? "Every day"} ${at}`;
    case "weekly": {
      const days = (r.weekdays ?? []).map((d) => WEEKDAY[d] ?? "?").join(", ");
      const lead = every("week") ?? "Weekly";
      return `${lead} on ${days || "—"} ${at}`;
    }
    case "monthly": {
      const lead = every("month") ?? "Monthly";
      return `${lead} on day ${r.dayOfMonth ?? "—"} ${at}`;
    }
    case "custom_cron":
      return `Custom schedule ${at}`;
  }
}

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecurringRulesPage() {
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["scheduler:recurring-rules"],
    queryFn: () => scheduler.listRecurringRules(),
    staleTime: 30_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["scheduler:recurring-rules"] });

  const pause = useMutation({
    mutationFn: (ruleId: string) => scheduler.pauseRecurringRule(ruleId, "user_paused"),
    onSuccess: () => {
      toast.success("Rule paused.");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof ApiError ? err.message : "Couldn't pause the rule."),
  });

  const resume = useMutation({
    mutationFn: (ruleId: string) => scheduler.resumeRecurringRule(ruleId),
    onSuccess: () => {
      toast.success("Rule resumed.");
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof ApiError ? err.message : "Couldn't resume the rule."),
  });

  const rules = rulesQuery.data?.rules ?? [];
  const busyId = pause.isPending
    ? (pause.variables as string)
    : resume.isPending
      ? (resume.variables as string)
      : null;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <CronToolbar crons={["recurring-spawn"]} onTriggered={invalidate} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/calendar"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Calendar
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Repeat className="size-5 text-primary" /> Recurring schedules
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rules that auto-spawn scheduled posts on a cadence. Create one from
            a composer&apos;s schedule step.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/dashboard/calendar">
            <Plus className="size-3.5" /> New from composer
          </Link>
        </Button>
      </div>

      {rulesQuery.isLoading ? (
        <RulesSkeleton />
      ) : rulesQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load your recurring rules. Try refreshing.
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarClock className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No recurring schedules yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Open a composer, choose Schedule, and pick a repeating cadence to
              create your first rule.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rules.map((r) => (
            <RuleCard
              key={r._id}
              rule={r}
              busy={busyId === r._id}
              onPause={() => pause.mutate(r._id)}
              onResume={() => resume.mutate(r._id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  busy,
  onPause,
  onResume,
}: {
  rule: RecurringRuleDto;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  const status = STATUS_STYLE[rule.status];
  const channels = rule.planTemplate?.channels ?? [];
  const runs = rule.maxRuns
    ? `${rule.runsSpawned}/${rule.maxRuns} spawned`
    : `${rule.runsSpawned} spawned`;

  return (
    <li>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {rule.name?.trim() || "Untitled rule"}
            </span>
            <Badge variant="outline" className={cn("text-[10px]", status.chip)}>
              {status.label}
            </Badge>
            <div className="ml-auto flex items-center gap-1.5">
              {channels.map((c) => (
                <ChannelIconCompact key={c.channel} channel={c.channel} size={14} />
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{cadenceSummary(rule)}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              Next run:{" "}
              <span className="font-medium text-foreground">
                {rule.status === "active" ? formatWhen(rule.nextSpawnAt) : "—"}
              </span>
            </span>
            <span>
              Last spawn:{" "}
              <span className="font-medium text-foreground">{formatWhen(rule.lastSpawnedAt)}</span>
            </span>
            <span className="tabular-nums">{runs}</span>
          </div>

          {rule.status === "paused" && rule.pauseReason && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Paused: {rule.pauseReason}
            </p>
          )}
          {rule.lastSpawnError && (
            <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Last spawn failed: {rule.lastSpawnError}</span>
            </p>
          )}

          {/* Actions — only active/paused are actionable; completed +
              expired are terminal (cron-set), no controls. */}
          {rule.status === "active" && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={onPause} disabled={busy} className="gap-1.5">
                <Pause className="size-3.5" /> Pause
              </Button>
            </div>
          )}
          {rule.status === "paused" && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={onResume} disabled={busy} className="gap-1.5">
                <Play className="size-3.5" /> Resume
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function RulesSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i}>
          <Card>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-3 w-48" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
