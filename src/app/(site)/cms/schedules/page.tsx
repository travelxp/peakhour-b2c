"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMs } from "@/components/cms/ai/format";
import { StatusBadge } from "@/components/molecules/status-badge";
import { formatRelative } from "@/lib/scheduler/format";
import {
  RUNS_LIMIT,
  useCmsScheduleRuns,
  useCmsSchedules,
  type ScheduleRow,
} from "@/hooks/use-schedules";
import {
  STATUS_LABEL,
  filterSchedules,
  invokeCommand,
  shownStatus,
  statusNote,
  summarise,
  type ShownStatus,
} from "./schedules-logic";

const BADGE_VARIANT = {
  healthy: "success",
  failing: "error",
  missed: "error",
  did_not_finish: "warning",
  running: "info",
  waiting: "muted",
} as const;

function ResultBadge({ row, recordingSince }: { row: ScheduleRow; recordingSince?: string | null }) {
  const s = shownStatus(row);
  const note = statusNote(row, recordingSince, formatDateTime);
  const badge = <StatusBadge status={s} label={STATUS_LABEL[s]} variant={BADGE_VARIANT[s]} dot={s === "running"} />;
  return note ? <span title={note}>{badge}</span> : badge;
}

function When({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  return <span title={formatDateTime(iso)}>{formatRelative(iso)}</span>;
}

export default function CmsSchedulesPage() {
  const { data, isPending, error, errorUpdatedAt } = useCmsSchedules();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const environment = data?.environment;
  const isDev = environment === "dev";
  const all = data?.schedules ?? [];
  const rows = filterSchedules(all, { search, status, area });
  const counts = summarise(all);
  const selectedRow = all.find((s) => s.name === selected) ?? null;
  // Never loaded, and failed at least once: `error` alone resets on each retry.
  const failedWithoutData = !data && errorUpdatedAt > 0;

  const chips: ShownStatus[] = ["healthy", "failing", "missed", "did_not_finish", "running", "waiting"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schedules</h2>
          <p className="mt-1 text-muted-foreground">
            {!environment
              ? "Every scheduled run of the api, and how the last one went."
              : isDev
                ? "Dev (master branch): runs every schedule, like production"
                : "Production"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/cms/jobs">Background jobs</Link>
        </Button>
      </div>

      {data && counts.missed > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-on-tint">
          {counts.missed === 1 ? "1 schedule missed a run" : `${counts.missed} schedules missed a run`}: no run was recorded when due.
        </div>
      )}

      {(error || failedWithoutData) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-on-tint">
          {data
            ? <>Couldn&apos;t refresh the schedules: {(error as Error).message}. Showing the last copy.</>
            : <>Failed to load schedules: {(error as Error | null)?.message ?? "unknown error"}.</>}
        </div>
      )}

      <div className="flex flex-wrap gap-2" aria-label="Summary">
        {chips.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(status === s ? "all" : s)}
          >
            {STATUS_LABEL[s]} <span className="ml-1.5 tabular-nums">{data ? counts[s] : "–"}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-3">
          <Input
            placeholder="Search by name or technical name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as ShownStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger aria-label="Area">
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {(data?.areas ?? []).map((a) => (
                <SelectItem key={a.area} value={a.area}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="col-span-full text-right text-sm text-muted-foreground">
            {data ? `${rows.length} of ${all.length} schedules` : isPending && !failedWithoutData ? "Loading…" : "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>How often</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Last 24 h</TableHead>
                <TableHead>Next run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failedWithoutData ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    The schedules couldn&apos;t be loaded.
                  </TableCell>
                </TableRow>
              ) : !data ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No schedules match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.name}
                    onClick={() => setSelected(row.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(row.name);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open ${row.label}`}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="text-sm font-medium">{row.label}</div>
                      <div className="font-mono text-micro text-muted-foreground">{row.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {data.areas.find((a) => a.area === row.area)?.label ?? row.area}
                    </TableCell>
                    <TableCell className="text-xs">{row.cadence}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs"><When iso={row.lastStartedAt} /></TableCell>
                    <TableCell><ResultBadge row={row} recordingSince={data.recordingSince} /></TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.runs24h} runs
                      {row.failures24h > 0 && (
                        <span className="text-destructive-on-tint">, {row.failures24h} failed</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <When iso={row.nextRunAt} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          {selected && (
            <ScheduleDetail
              name={selected}
              row={selectedRow}
              recordingSince={data?.recordingSince}
              environment={environment ?? "production"}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Detail sheet ───────────────────────────────────────────────

function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Run it once by hand (from a terminal)</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">{command}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            // An insecure origin has no clipboard: say so rather than do nothing.
            const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
            if (!clipboard) {
              setState("failed");
              return;
            }
            clipboard.writeText(command).then(() => setState("copied"), () => setState("failed"));
          }}
        >
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function ScheduleDetail({
  name,
  row,
  recordingSince,
  environment,
}: {
  name: string;
  row: ScheduleRow | null;
  recordingSince?: string | null;
  environment: "production" | "dev";
}) {
  const { data, isPending, error } = useCmsScheduleRuns(name, RUNS_LIMIT);
  const label = row?.label ?? data?.schedule.label ?? name;
  const note = row ? statusNote(row, recordingSince, formatDateTime) : null;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{label}</SheetTitle>
        <SheetDescription className="font-mono text-xs">{name}</SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-4 text-sm">
        {row && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ResultBadge row={row} recordingSince={recordingSince} />
              {row.consecutiveFailures > 0 && (
                <span className="text-xs text-muted-foreground">{row.consecutiveFailures} failed in a row</span>
              )}
            </div>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {row.description && <p>{row.description}</p>}
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">How often</span>
                <span className="text-xs">{row.cadence}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Schedule</span>
                <span className="font-mono text-xs">{row.cron}</span>
              </div>
            </div>
            {row.lastFailedSteps.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Last failed steps</p>
                <ul className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive-on-tint">
                  {row.lastFailedSteps.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}
          </>
        )}

        <CopyCommand command={invokeCommand(name, environment)} />

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Last {RUNS_LIMIT} runs</p>
          {error && !data ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-on-tint">
              Failed to load the runs: {(error as Error).message}
            </div>
          ) : isPending || !data ? (
            <Skeleton className="h-32 w-full" />
          ) : data.runs.length === 0 ? (
            <p className="text-muted-foreground">No runs recorded in the last 30 days.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Took</TableHead>
                  <TableHead className="text-right">HTTP</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Failed steps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.runs.map((r, i) => (
                  <TableRow key={`${i}-${r.startedAt}`}>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.startedAt)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatMs(r.durationMs)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.httpStatus}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={r.outcome}
                        label={r.outcome === "failed" ? "Failed" : "Succeeded"}
                        variant={r.outcome === "failed" ? "error" : "success"}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-micro">
                      {r.failedSteps.length ? r.failedSteps.join(", ") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
