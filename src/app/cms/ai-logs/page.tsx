"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
import { TimeRangeSelector } from "@/components/cms/ai/time-range-selector";
import { StatusChip } from "@/components/cms/ai/status-chip";
import { formatMs, formatTokens, formatUsd, formatDateTime } from "@/components/cms/ai/format";

interface LogRow {
  timestamp: string;
  useCase?: string;
  modelId?: string;
  callType?: string;
  status?: string;
  success?: boolean;
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  durationMs?: number;
  ttftMs?: number;
  steps?: number;
  toolsUsed?: string[];
  requestId?: string;
  entityType?: string;
  entityId?: string;
  promptContent?: string;
  responseContent?: string;
  contentRedacted?: boolean;
}

interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: LogRow[];
}

export default function AiLogsPage() {
  const [days, setDays] = useState("7");
  const [status, setStatus] = useState<string>("all");
  const [useCase, setUseCase] = useState("");
  const [modelId, setModelId] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["cms-ai-logs", days, status, useCase, modelId, page],
    queryFn: () => {
      const params: Record<string, string> = {
        days,
        limit: String(limit),
        offset: String(page * limit),
      };
      if (status !== "all") params.status = status;
      if (useCase) params.useCase = useCase;
      if (modelId) params.modelId = modelId;
      return api.get<LogsResponse>("/v1/cms/ai-logs", params);
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Logs</h2>
        <p className="text-muted-foreground mt-1">
          Drill into individual ts_ai_usage rows. Click any row to inspect the prompt/response.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <TimeRangeSelector value={days} onChange={(v) => { setDays(v); setPage(0); }} />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="rate_limited">Rate-limited</SelectItem>
              <SelectItem value="fallback_used">Fallback used</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="useCase (e.g. content_brief)"
            value={useCase}
            onChange={(e) => { setUseCase(e.target.value); setPage(0); }}
          />
          <Input
            placeholder="modelId (e.g. anthropic/claude-...)"
            value={modelId}
            onChange={(e) => { setModelId(e.target.value); setPage(0); }}
          />
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${total.toLocaleString()} matches`}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Use case</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateTime(row.timestamp)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.useCase || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.modelId || "—"}</TableCell>
                    <TableCell><StatusChip status={row.status} /></TableCell>
                    <TableCell className="text-right text-xs">
                      {formatTokens(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatUsd(row.estimatedCostUsd)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatMs(row.durationMs)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page + 1} of {lastPage + 1}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Drill-down sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.useCase || "AI call"}</SheetTitle>
                <SheetDescription>{formatDateTime(selected.timestamp)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <Field label="Status"><StatusChip status={selected.status} /></Field>
                <Field label="Model" value={selected.modelId} mono />
                <Field label="Call type" value={selected.callType} />
                <Field label="Request ID" value={selected.requestId} mono />
                <div className="grid grid-cols-3 gap-3">
                  <Mini label="Input" value={formatTokens(selected.inputTokens)} />
                  <Mini label="Output" value={formatTokens(selected.outputTokens)} />
                  <Mini label="Total" value={formatTokens(selected.totalTokens)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Mini label="Latency" value={formatMs(selected.durationMs)} />
                  <Mini label="TTFT" value={formatMs(selected.ttftMs)} />
                  <Mini label="Cost" value={formatUsd(selected.estimatedCostUsd)} />
                </div>
                {selected.toolsUsed && selected.toolsUsed.length > 0 && (
                  <Field label="Tools used" value={selected.toolsUsed.join(", ")} />
                )}
                {selected.errorMessage && (
                  <Field label="Error">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-red-50 text-red-900 p-3">{selected.errorMessage}</pre>
                  </Field>
                )}
                {selected.contentRedacted && (
                  <p className="text-xs text-muted-foreground italic">
                    Prompt and response are redacted at viewer-level. Ask a support+ user to reveal.
                  </p>
                )}
                {selected.promptContent && (
                  <Field label="Prompt">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3 max-h-[300px] overflow-auto">{selected.promptContent}</pre>
                  </Field>
                )}
                {selected.responseContent && (
                  <Field label="Response">
                    <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3 max-h-[300px] overflow-auto">{selected.responseContent}</pre>
                  </Field>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value, children, mono = false }: { label: string; value?: string; children?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children ?? <p className={mono ? "font-mono text-xs mt-1" : "mt-1"}>{value || "—"}</p>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-muted/50 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
