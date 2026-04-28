"use client";

import { useEffect, useState } from "react";
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
import { useCmsJobs, useCmsJobDetail } from "@/hooks/use-jobs";

// Limit to the kinds the runner currently handles. Adding a new handler
// in peakhour-api means adding it here too — drives the filter dropdown.
const KIND_OPTIONS = [
  "content_analyse",
  "tag_drafts",
  "voice_card_refresh",
  "beehiiv_sync_full",
  "workflow_mirror",
  "onboarding_discovery",
] as const;

const STATUS_OPTIONS = ["pending", "running", "done", "failed", "cancelled"] as const;

const PAGE_SIZE = 50;

export default function CmsJobsPage() {
  const [days, setDays] = useState("7");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [orgId, setOrgId] = useState("");
  const [businessId, setBusinessId] = useState("");
  // Debounced values feed the query — typing in orgId fires a fresh
  // network call per keystroke otherwise (and most intermediate strings
  // aren't valid 24-hex ids anyway).
  const [orgIdQuery, setOrgIdQuery] = useState("");
  const [businessIdQuery, setBusinessIdQuery] = useState("");
  const [showChildren, setShowChildren] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setOrgIdQuery(orgId.trim());
      setBusinessIdQuery(businessId.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [orgId, businessId]);

  const { data, isLoading, error } = useCmsJobs({
    days,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    kind: kind === "all" ? undefined : kind,
    status: status === "all" ? undefined : status,
    orgId: orgIdQuery || undefined,
    businessId: businessIdQuery || undefined,
    showChildren,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Background Jobs</h2>
        <p className="mt-1 text-muted-foreground">
          Cross-org technical view of <code className="font-mono text-xs">bg_jobs</code> — claim
          state, attempts, lastError, params, results. Click a row for full drilldown.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load jobs: {(error as Error).message}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-6">
          <TimeRangeSelector
            value={days}
            onChange={(v) => { setDays(v); resetPage(); }}
            options={[
              { value: "1", label: "Last 24 hours" },
              { value: "3", label: "Last 3 days" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
          <Select value={kind} onValueChange={(v) => { setKind(v); resetPage(); }}>
            <SelectTrigger>
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); resetPage(); }}>
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
            onClick={() => { setShowChildren((v) => !v); resetPage(); }}
          >
            {showChildren ? "Children shown ✓" : "Show children"}
          </Button>
          <div className="col-span-full flex items-center justify-end text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${total.toLocaleString()} matches`}
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
              {isLoading ? (
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
                    <TableCell className="max-w-70 truncate text-xs text-red-700" title={row.lastError}>
                      {row.lastError || (row.cancelRequested ? <span className="text-amber-700">cancel requested</span> : "")}
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
  const { data, isLoading, error } = useCmsJobDetail(id);

  if (isLoading) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Loading job…</SheetTitle>
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
  if (error) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Job unavailable</SheetTitle>
          <SheetDescription className="font-mono text-xs">{id}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {(error as Error).message.includes("404")
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
          {data.cancelRequested && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">cancel requested</Badge>}
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
                      ? "rounded border border-red-200 bg-red-50 p-2 text-xs"
                      : "rounded border p-2 text-xs"
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{p.phase}</span>
                      {p.ok === false && (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">failed</Badge>
                      )}
                      {p.ok === true && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">ok</Badge>
                      )}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatDateTime(p.startedAt)}
                      {p.durationMs != null && <> · {p.durationMs}ms</>}
                    </span>
                  </div>
                  {p.error && (
                    <pre className="mt-1 whitespace-pre-wrap text-xs text-red-900">{p.error}</pre>
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
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-900">{data.lastError}</pre>
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
