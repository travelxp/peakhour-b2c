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
import { formatMs, formatDateTime } from "@/components/cms/ai/format";

interface LogRow {
  timestamp: string;
  method?: string;
  routePath?: string;
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  requestId?: string;
  userId?: string;
  orgId?: string;
  ip?: string;
  userAgent?: string;
  error?: string;
  request?: string;
  response?: string;
}

interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: LogRow[];
}

function statusBadge(code?: number) {
  if (!code) return null;
  if (code >= 500) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{code}</Badge>;
  if (code >= 400) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{code}</Badge>;
  if (code >= 300) return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{code}</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{code}</Badge>;
}

export default function ApiLogsPage() {
  const [days, setDays] = useState("1");
  const [method, setMethod] = useState("all");
  const [path, setPath] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const limit = 50;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cms-api-logs", days, method, path, errorsOnly, page],
    queryFn: () => {
      const params: Record<string, string> = {
        days,
        limit: String(limit),
        offset: String(page * limit),
      };
      if (method !== "all") params.method = method;
      if (path) params.path = path;
      if (errorsOnly) params.errorsOnly = "true";
      return api.get<LogsResponse>("/v1/cms/api-logs", params);
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">API Logs</h2>
        <p className="text-muted-foreground mt-1">
          peakhour-api request stream (30-day retention). Click a row for full details.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load logs: {(error as Error).message}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
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
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Path contains…"
            value={path}
            onChange={(e) => { setPath(e.target.value); setPage(0); }}
          />
          <Button
            variant={errorsOnly ? "default" : "outline"}
            onClick={() => { setErrorsOnly((v) => !v); setPage(0); }}
          >
            {errorsOnly ? "Errors only ✓" : "Errors only"}
          </Button>
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
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                    <TableCell><Badge variant="outline">{row.method}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{row.path}</TableCell>
                    <TableCell>{statusBadge(row.statusCode)}</TableCell>
                    <TableCell className="text-right text-xs">{formatMs(row.latencyMs)}</TableCell>
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
                <SheetTitle>{selected.method} {selected.path}</SheetTitle>
                <SheetDescription>{formatDateTime(selected.timestamp)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-3 text-sm">
                <KV k="Status" v={selected.statusCode != null ? String(selected.statusCode) : "—"} />
                <KV k="Latency" v={formatMs(selected.latencyMs)} />
                <KV k="Route pattern" v={selected.routePath || "—"} />
                <KV k="Request ID" v={selected.requestId || "—"} mono />
                <KV k="User" v={selected.userId || "—"} mono />
                <KV k="Org" v={selected.orgId || "—"} mono />
                <KV k="IP" v={selected.ip || "—"} />
                <KV k="User agent" v={selected.userAgent || "—"} />
                {selected.error && (
                  <div>
                    <p className="text-xs text-muted-foreground">Error</p>
                    <pre className="text-xs whitespace-pre-wrap rounded bg-red-50 text-red-900 p-3">{selected.error}</pre>
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
      <span className={mono ? "font-mono text-xs" : ""}>{v}</span>
    </div>
  );
}
