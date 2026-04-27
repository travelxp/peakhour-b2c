"use client";

import { useState } from "react";
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
import { formatDateTime } from "@/components/cms/ai/format";

interface LogRow {
  timestamp: string;
  component?: string;
  severity?: "error" | "warn" | "info";
  product?: string;
  message?: string;
  errorName?: string;
  stack?: string;
  causeMessage?: string;
  context?: string;
  requestId?: string;
  orgId?: string;
  userId?: string;
  businessId?: string;
  detailRedacted?: boolean;
}

interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: LogRow[];
}

interface ComponentsResponse {
  components: string[];
}

function severityBadge(s?: string) {
  if (s === "error") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">error</Badge>;
  if (s === "warn") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">warn</Badge>;
  if (s === "info") return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">info</Badge>;
  return <Badge variant="outline">{s || "—"}</Badge>;
}

function tryPrettyJson(s?: string): string | undefined {
  if (!s) return undefined;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function LogsPage() {
  const [days, setDays] = useState("7");
  const [severity, setSeverity] = useState("all");
  const [component, setComponent] = useState("all");
  const [q, setQ] = useState("");
  const [requestId, setRequestId] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cms-logs", days, severity, component, q, requestId, page],
    queryFn: () => {
      const params: Record<string, string> = {
        days,
        limit: String(limit),
        offset: String(page * limit),
      };
      if (severity !== "all") params.severity = severity;
      if (component !== "all") params.component = component;
      if (q) params.q = q;
      if (requestId) params.requestId = requestId;
      return api.get<LogsResponse>("/v1/cms/logs", params);
    },
  });

  const { data: componentsData } = useQuery({
    queryKey: ["cms-logs-components", days],
    queryFn: () => api.get<ComponentsResponse>("/v1/cms/logs/components", { days }),
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);
  const components = componentsData?.components || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Application Logs</h2>
        <p className="text-muted-foreground mt-1">
          Structured errors from agent catches, cron handlers, and background jobs (30-day retention). Click any row for full stack and context.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load logs: {(error as Error).message}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
          <TimeRangeSelector
            value={days}
            onChange={(v) => { setDays(v); setPage(0); }}
            options={[
              { value: "1", label: "Last 24 hours" },
              { value: "3", label: "Last 3 days" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
            ]}
          />
          <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={component} onValueChange={(v) => { setComponent(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Component" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All components</SelectItem>
              {components.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search message…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
          <Input
            placeholder="Request ID"
            value={requestId}
            onChange={(e) => { setRequestId(e.target.value); setPage(0); }}
          />
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
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
                <TableHead>Severity</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No logs match these filters.
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
                    <TableCell>{severityBadge(row.severity)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.component || "—"}</TableCell>
                    <TableCell className="text-xs max-w-md truncate" title={row.message}>{row.message || "—"}</TableCell>
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
                <SheetTitle className="font-mono text-base">{selected.component || "log"}</SheetTitle>
                <SheetDescription>{formatDateTime(selected.timestamp)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  {severityBadge(selected.severity)}
                  {selected.errorName && (
                    <Badge variant="outline" className="font-mono text-xs">{selected.errorName}</Badge>
                  )}
                </div>
                <KV k="Request ID" v={selected.requestId || "—"} mono />
                <KV k="Org" v={selected.orgId || "—"} mono />
                <KV k="Business" v={selected.businessId || "—"} mono />
                <KV k="User" v={selected.userId || "—"} mono />
                {selected.message && (
                  <Field label="Message">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-red-50 text-red-900 p-3">{selected.message}</pre>
                  </Field>
                )}
                {selected.causeMessage && (
                  <Field label="Cause">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-amber-50 text-amber-900 p-3">{selected.causeMessage}</pre>
                  </Field>
                )}
                {selected.stack && (
                  <Field label="Stack trace">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3 max-h-96 overflow-auto">{selected.stack}</pre>
                  </Field>
                )}
                {selected.context && (
                  <Field label="Context">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3 max-h-96 overflow-auto">{tryPrettyJson(selected.context)}</pre>
                  </Field>
                )}
                {selected.detailRedacted && (
                  <p className="text-xs text-muted-foreground italic">
                    Stack and context are redacted at viewer-level. Ask a support+ user to reveal.
                  </p>
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
      <span className={mono ? "font-mono text-xs break-all" : ""}>{v}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}
