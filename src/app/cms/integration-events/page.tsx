"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
import { formatDateTime, formatMs } from "@/components/cms/ai/format";

interface EventRow {
  timestamp: string;
  provider?: string;
  orgId?: string;
  businessId?: string;
  eventType?: string;
  trigger?: string;
  connectionId?: string;
  outcome?: "success" | "partial_failure" | "error" | "noop" | "skipped";
  externalId?: string;
  postsFetched?: number;
  added?: number;
  updated?: number;
  errors?: number;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
  notes?: string;
}

interface EventsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: EventRow[];
}

const PROVIDERS = [
  "linkedin_content", "linkedin_ads", "beehiiv", "facebook", "x", "x_ads",
  "instagram", "meta_ads", "google_ads", "google_analytics",
  "google_search_console", "google_business_profile", "youtube", "substack",
  "mailchimp", "kit", "shopify", "wordpress", "ghost",
];

const EVENT_TYPES = [
  "sync_run",
  "sync_upsert",
  "webhook",
  "backfill_run",
  "backfill_upsert",
];

const OUTCOMES = ["success", "partial_failure", "error", "noop", "skipped"];

const TRIGGERS = ["cron", "manual", "backfill", "webhook"];

function outcomeBadge(o?: string) {
  switch (o) {
    case "success":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">success</Badge>;
    case "partial_failure":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">partial</Badge>;
    case "error":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">error</Badge>;
    case "noop":
      return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">noop</Badge>;
    case "skipped":
      return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">skipped</Badge>;
    default:
      return <Badge variant="outline">{o || "—"}</Badge>;
  }
}

export default function IntegrationEventsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationEventsInner />
    </Suspense>
  );
}

function IntegrationEventsInner() {
  const searchParams = useSearchParams();
  const [days, setDays] = useState(() => searchParams.get("days") || "7");
  const [provider, setProvider] = useState(() => searchParams.get("provider") || "all");
  const [eventType, setEventType] = useState(() => searchParams.get("eventType") || "all");
  const [outcome, setOutcome] = useState(() => searchParams.get("outcome") || "all");
  const [trigger, setTrigger] = useState(() => searchParams.get("trigger") || "all");
  const [connectionId, setConnectionId] = useState(() => searchParams.get("connectionId") || "");
  // Debounce connectionId so each keystroke doesn't fire a 400 INVALID_PARAMS
  // — the API only accepts a complete 24-char ObjectId.
  const [connectionIdQuery, setConnectionIdQuery] = useState(connectionId);
  useEffect(() => {
    const t = setTimeout(() => setConnectionIdQuery(connectionId), 300);
    return () => clearTimeout(t);
  }, [connectionId]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cms-integration-events", days, provider, eventType, outcome, trigger, connectionIdQuery, page],
    queryFn: () => {
      const params: Record<string, string> = {
        days,
        limit: String(limit),
        offset: String(page * limit),
      };
      if (provider !== "all") params.provider = provider;
      if (eventType !== "all") params.eventType = eventType;
      if (outcome !== "all") params.outcome = outcome;
      if (trigger !== "all") params.trigger = trigger;
      if (connectionIdQuery) params.connectionId = connectionIdQuery;
      return api.get<EventsResponse>("/v1/cms/integration-events", params);
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integration Events</h2>
        <p className="text-muted-foreground mt-1">
          Per-row drill-down on ts_integration_events (1y retention). Each provider sync, webhook, and backfill event is captured here.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load events: {(error as Error).message}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
          <TimeRangeSelector
            value={days}
            onChange={(v) => { setDays(v); setPage(0); }}
            options={[
              { value: "1", label: "Last 24 hours" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
              { value: "365", label: "Last year" },
            ]}
          />
          <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={(v) => { setOutcome(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={trigger} onValueChange={(v) => { setTrigger(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All triggers</SelectItem>
              {TRIGGERS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Connection ID"
            value={connectionId}
            onChange={(e) => { setConnectionId(e.target.value); setPage(0); }}
          />
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
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Added</TableHead>
                <TableHead className="text-right">Latency</TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No events match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow
                    key={`${row.timestamp}-${i}`}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="text-xs whitespace-nowrap">{formatDateTime(row.timestamp)}</TableCell>
                    <TableCell className="text-xs">{row.provider || "—"}</TableCell>
                    <TableCell className="text-xs">{row.eventType || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.trigger || "—"}</TableCell>
                    <TableCell>{outcomeBadge(row.outcome)}</TableCell>
                    <TableCell className="text-right text-xs">{row.postsFetched ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{row.added ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{formatMs(row.durationMs)}</TableCell>
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

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{selected.provider} · {selected.eventType}</SheetTitle>
                <SheetDescription>{formatDateTime(selected.timestamp)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  {outcomeBadge(selected.outcome)}
                  {selected.trigger && <Badge variant="outline">{selected.trigger}</Badge>}
                </div>
                <KV k="Connection" v={selected.connectionId || "—"} mono />
                <KV k="Org" v={selected.orgId || "—"} mono />
                <KV k="Business" v={selected.businessId || "—"} mono />
                {selected.externalId && <KV k="External ID" v={selected.externalId} mono />}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <Mini label="Fetched" value={selected.postsFetched ?? "—"} />
                  <Mini label="Added" value={selected.added ?? "—"} />
                  <Mini label="Updated" value={selected.updated ?? "—"} />
                  <Mini label="Errors" value={selected.errors ?? "—"} />
                </div>
                <KV k="Latency" v={formatMs(selected.durationMs)} />
                {selected.errorName && (
                  <KV k="Error name" v={selected.errorName} mono />
                )}
                {selected.errorMessage && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Error message</p>
                    <pre className="text-xs whitespace-pre-wrap rounded bg-red-50 text-red-900 p-3">{selected.errorMessage}</pre>
                  </div>
                )}
                {selected.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3">{selected.notes}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KV({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono text-xs break-all" : "text-xs break-all"}>{v}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border bg-muted/40 p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
