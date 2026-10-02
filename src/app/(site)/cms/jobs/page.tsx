"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TimeRangeSelector } from "@/components/cms/ai/time-range-selector";
import { formatDateTime } from "@/components/cms/ai/format";
import { StatusBadge } from "@/components/molecules/status-badge";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { useCmsJobs, useCmsJobDetail, useCmsJobKinds } from "@/hooks/use-jobs";
import {
  childrenModeFor,
  effectiveKind,
  ignoredKind,
  kindSelectOptions,
  kindsStateOf,
  resolveShowChildren,
  type ChildrenMode,
} from "./kind-filter";

const STATUS_OPTIONS = ["pending", "running", "done", "failed", "cancelled"] as const;

const PAGE_SIZE = 50;

export default function CmsJobsPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState("7");
  // The kinds the api serves (its registered handlers plus the kinds bg_jobs
  // holds within the list's reach) — no list kept here. Each state of the
  // query is handled (`./kind-filter`, the same rules as cms#174).
  const kindsQuery = useCmsJobKinds();
  const kindsState = kindsStateOf(kindsQuery);
  const [kindChoice, setKind] = useState("all");
  // A chosen kind a refetch dropped is ignored, not reset: it may be back in
  // the next answer (round 2). The hint below says so and offers a clear.
  const kind = effectiveKind(kindChoice, kindsState);
  const ignored = ignoredKind(kindChoice, kindsState);
  const kindOptions = kindSelectOptions(kindsState);
  const [status, setStatus] = useState("all");
  const [orgId, setOrgId] = useState("");
  const [businessId, setBusinessId] = useState("");
  // Debounced values feed the query — typing in orgId fires a fresh
  // network call per keystroke otherwise (and most intermediate strings
  // aren't valid 24-hex ids anyway).
  const [orgIdQuery, setOrgIdQuery] = useState("");
  const [businessIdQuery, setBusinessIdQuery] = useState("");
  // `auto`: ON for a chosen kind (some only run as children), OFF with "All
  //  kinds"; `on`/`off` are the operator's explicit choice and survive a kind
  //  change (round 1: picking a kind used to force it back on).
  const [childrenMode, setChildrenMode] = useState<ChildrenMode>("auto");
  const showChildren = resolveShowChildren(childrenMode, kind);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // ★ONE PAGE RESET, keyed on everything the list is filtered by (round 3):
  //  a filter can change without a handler (a refetch drops or returns the
  //  chosen kind, and auto children follow it), and the old offset would read
  //  a different result set. Adjusted during render, not in an effect.
  const listFilter = JSON.stringify([days, kind, status, orgIdQuery, businessIdQuery, showChildren]);
  const [prevListFilter, setPrevListFilter] = useState(listFilter);
  if (prevListFilter !== listFilter) {
    setPrevListFilter(listFilter);
    setPage(0);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setOrgIdQuery(orgId.trim());
      setBusinessIdQuery(businessId.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [orgId, businessId]);

  // `isPending`, not `isLoading` (cms#175): a paused list query (offline) is
  // pending with no data but not "loading", and must not read as empty.
  const { data, isPending, isPaused: listPaused, error, errorUpdatedAt } = useCmsJobs({
    days,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    kind: kind === "all" ? undefined : kind,
    status: status === "all" ? undefined : status,
    orgId: orgIdQuery || undefined,
    businessId: businessIdQuery || undefined,
    showChildren,
  });

  // ★Never loaded, and failed at least once (round 1): `error` alone is reset
  //  by each 30s retry, which flickered the failed row back to skeletons.
  const listFailed = !data && errorUpdatedAt > 0;
  // Paused with nothing loaded: waiting, not loading (round 1). Rows already
  // on screen during a paused refresh need no notice.
  const listWaiting = !data && listPaused && !listFailed;
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-6">
      <CronToolbar
        crons={["jobs-runner"]}
        onTriggered={() =>
          queryClient.invalidateQueries({ queryKey: ["cms-jobs"] })
        }
      />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Background Jobs</h2>
        <p className="mt-1 text-muted-foreground">
          Cross-org technical view of <code className="font-mono text-xs">bg_jobs</code> — claim
          state, attempts, lastError, params, results. Click a row for full drilldown.
        </p>
      </div>

      {(error || listFailed) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-on-tint">
          {error ? <>Failed to load jobs: {(error as Error).message}</> : <>Failed to load jobs; trying again…</>}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-6">
          <TimeRangeSelector
            value={days}
            onChange={setDays}
            options={[
              { value: "1", label: "Last 24 hours" },
              { value: "3", label: "Last 3 days" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
          <Select
            value={kind}
            onValueChange={setKind}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {kindsState.status === "pending" && (
                <SelectItem value="__loading" disabled>Loading kinds…</SelectItem>
              )}
              {kindsState.status === "paused" && (
                <SelectItem value="__waiting" disabled>Kinds will load when this tab can fetch…</SelectItem>
              )}
              {kindOptions.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="orgId (24-hex)"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          />
          <Input
            placeholder="businessId (24-hex)"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
          />
          <Button
            variant={showChildren ? "default" : "outline"}
            onClick={() => setChildrenMode(childrenModeFor(!showChildren, kind))}
          >
            {showChildren ? "Children shown ✓" : "Show children"}
          </Button>
          {ignored && (
            <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {ignored === "unknown" ? (
                  <>&ldquo;{kindChoice}&rdquo; isn&apos;t in the latest list of job kinds, so all kinds are shown.</>
                ) : (
                  <>&ldquo;{kindChoice}&rdquo; isn&apos;t among the job kinds read just now (the full list couldn&apos;t be read), so all kinds are shown.</>
                )}
              </span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setKind("all")}>
                Clear
              </Button>
            </div>
          )}
          {!ignored && kindsState.status === "success" && !kindsState.complete && (
            <div className="col-span-full text-sm text-muted-foreground">
              The full list of job kinds couldn&apos;t be read just now, so the kind filter may be missing some; it is checked again every minute while this tab is in view.
            </div>
          )}
          {/* Paused kinds (round 2): reachable here with no kind chosen — the
              list says its own wait in its table row. */}
          {kindsState.status === "paused" && (
            <div className="col-span-full text-sm text-muted-foreground">
              The job kinds will load once the network is back, or this tab is in focus.
            </div>
          )}
          {kindsState.status === "error" && (
            <div className="col-span-full text-sm text-muted-foreground">
              Couldn&apos;t load the job kinds, so the kind filter is unavailable.
            </div>
          )}
          <div className="col-span-full flex items-center justify-end text-sm text-muted-foreground">
            {listFailed ? "—" : listWaiting ? "Waiting…" : isPending ? "Loading…" : `${total.toLocaleString()} matches`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-42.5">Created</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pri</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Org / Business</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Last error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listFailed ? (
                // Never read is not empty: the banner above says why. Kept
                // through the 30s retries (round 1), which reset `error`.
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    The jobs couldn&apos;t be loaded.
                  </TableCell>
                </TableRow>
              ) : listWaiting ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Waiting for the network, or for this tab to be in focus.
                  </TableCell>
                </TableRow>
              ) : isPending ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No jobs match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row._id}
                    onClick={() => setSelectedId(row._id)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {row.parentJobId && (
                          <span className="font-mono text-muted-foreground" title={`child of ${row.parentJobId}`}>↳</span>
                        )}
                        <Badge variant="outline" className="font-mono text-xs">{row.kind}</Badge>
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} dot={row.status === "running" || row.status === "pending"} /></TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.priority}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{row.attempts}/{row.maxAttempts}</TableCell>
                    <TableCell className="font-mono text-[11px] leading-tight">
                      <div className="truncate max-w-45" title={row.orgId}>{row.orgId?.slice(-8) || "—"}</div>
                      <div className="truncate max-w-45 text-muted-foreground" title={row.businessId}>{row.businessId?.slice(-8) || "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-55 truncate text-xs" title={row.displayName}>{row.displayName || "—"}</TableCell>
                    <TableCell className="max-w-70 truncate text-xs text-destructive-on-tint" title={row.lastError}>
                      {row.lastError || (row.cancelRequested ? <span className="text-warning-on-tint">cancel requested</span> : "")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page + 1} of {lastPage + 1}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          {selectedId && <JobDrilldown id={selectedId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Drilldown ──────────────────────────────────────────────────

function JobDrilldown({ id }: { id: string }) {
  // `isPending` (round 1): a paused detail query is not "loading", and fell
  // through to a blank sheet. A failure with nothing loaded stays one through
  // a focus refetch, which resets `error` (round 2).
  const { data, isPending, isPaused, error, errorUpdatedAt } = useCmsJobDetail(id);
  const failed = !data && (error || errorUpdatedAt > 0);

  if (isPending && !failed) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{isPaused ? "Waiting for the network, or for this tab to be in focus…" : "Loading job…"}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{id}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }
  if (failed) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Job unavailable</SheetTitle>
          <SheetDescription className="font-mono text-xs">{id}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-on-tint">
          {!error
            ? "Failed to load job; trying again…"
            : (error as Error).message.includes("404")
              ? "This job has been purged or rolled off (TTL: 90 days for finished jobs)."
              : `Failed to load job: ${(error as Error).message}`}
        </div>
      </>
    );
  }
  if (!data) return null;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono text-base">{data.kind}</SheetTitle>
        <SheetDescription>
          <span className="font-mono text-xs">{data._id}</span> · created {formatDateTime(data.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-4 text-sm">
        {/* Status block */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} dot={data.status === "running" || data.status === "pending"} />
          <Badge variant="outline" className="text-xs">priority {data.priority}</Badge>
          <Badge variant="outline" className="text-xs">attempt {data.attempts}/{data.maxAttempts}</Badge>
          {data.cancelRequested && <Badge className="bg-warning/15 text-warning-on-tint hover:bg-warning/25">cancel requested</Badge>}
          {data.parentJobId && <Badge variant="outline" className="text-xs">child of {data.parentJobId.slice(-8)}</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
          <KV k="Org" v={data.orgId || "—"} mono />
          <KV k="Business" v={data.businessId || "—"} mono />
          <KV k="Enqueued by" v={data.enqueuedByUserId || "—"} mono />
          <KV k="Idempotency key" v={data.idempotencyKey || "—"} mono />
          <KV k="Updated" v={data.updatedAt ? formatDateTime(data.updatedAt) : "—"} />
          <KV k="Finished" v={data.finishedAt ? formatDateTime(data.finishedAt) : "—"} />
          <KV k="Claimed at" v={data.claimedAt ? formatDateTime(data.claimedAt) : "—"} />
          <KV k="Claimed until" v={data.claimedUntil ? formatDateTime(data.claimedUntil) : "—"} />
          <KV k="Worker" v={data.workerId || "—"} mono />
          <KV k="Current phase" v={data.currentPhase || "—"} />
        </div>

        {/* Progress */}
        {data.progress && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="rounded-lg border p-3 text-xs tabular-nums">
              <div>{data.progress.processedUnits} / {data.progress.totalUnits}</div>
              {data.progress.currentLabel && (
                <div className="mt-1 text-muted-foreground">{data.progress.currentLabel}</div>
              )}
              {(data.childrenTotal != null) && (
                <div className="mt-1 text-muted-foreground">
                  Children: {data.childrenDone ?? 0} / {data.childrenTotal}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Children — present for parents only */}
        {data.children && data.children.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Children ({data.children.length})</p>
            <div className="space-y-1.5">
              {data.children.map((c) => (
                <div key={c._id} className="flex items-center gap-2 rounded border p-2 text-xs">
                  <StatusBadge status={c.status} dot={c.status === "running" || c.status === "pending"} />
                  <span className="font-mono text-[11px]">{c._id.slice(-8)}</span>
                  <span className="min-w-0 flex-1 truncate" title={c.displayName}>{c.displayName || c.kind}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.progress ? `${c.progress.processedUnits}/${c.progress.totalUnits}` : "—"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{c.attempts}/{c.maxAttempts}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase history */}
        {data.phaseHistory && data.phaseHistory.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Phase history</p>
            <div className="space-y-1">
              {data.phaseHistory.map((p, i) => (
                <div
                  key={i}
                  className={
                    p.ok === false
                      ? "rounded border border-destructive/30 bg-destructive/10 p-2 text-xs"
                      : "rounded border p-2 text-xs"
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{p.phase}</span>
                      {p.ok === false && (
                        <Badge className="bg-destructive/15 text-destructive-on-tint hover:bg-destructive/30">failed</Badge>
                      )}
                      {p.ok === true && (
                        <Badge className="bg-success/15 text-success-on-tint hover:bg-success/30">ok</Badge>
                      )}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatDateTime(p.startedAt)}
                      {p.durationMs != null && <> · {p.durationMs}ms</>}
                    </span>
                  </div>
                  {p.error && (
                    <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive-on-tint">{p.error}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last error */}
        {data.lastError && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Last error</p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-destructive/10 p-3 text-xs text-destructive-on-tint">{data.lastError}</pre>
          </div>
        )}

        {/* Params + Result — rendered as long as anything is set; an
            empty {} or [] is suppressed but primitives aren't (handler
            results sometimes pack a single number). */}
        {hasContent(data.params) && <JsonBlock label="Params" value={data.params} />}
        {hasContent(data.result) && <JsonBlock label="Result" value={data.result} />}
      </div>
    </>
  );
}

function KV({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "break-all font-mono text-xs" : "text-xs"}>{v}</span>
    </div>
  );
}

function hasContent(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
