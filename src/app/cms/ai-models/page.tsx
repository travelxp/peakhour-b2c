"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { formatUsd, formatMs, formatDateTime } from "@/components/cms/ai/format";

interface ModelRow {
  _id: string;
  modelId: string;
  provider: string;
  modelType: string;
  pricing?: { inputPerMillion?: number; outputPerMillion?: number; currency?: string };
  performance?: { contextWindow?: number; maxOutputTokens?: number; p50TtftMs?: number };
  capabilities?: Record<string, boolean>;
  lastSyncedAt?: string;
}

export default function AiModelsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cms-ai-models"],
    queryFn: () => api.get<{ rows: ModelRow[]; total: number }>("/v1/cms/ai-models"),
  });

  const sync = useMutation({
    mutationFn: () =>
      api.post<{ synced: number; totalReceived: number }>("/v1/cms/ai-models/sync"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cms-ai-models"] }),
  });

  const rows = data?.rows ?? [];
  const filtered = search
    ? rows.filter((r) =>
        `${r.modelId} ${r.provider}`.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Model Registry</h2>
          <p className="text-muted-foreground mt-1">
            Synced from Vercel AI Gateway. Powers the evaluator's recommendations.
          </p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`mr-2 size-4 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {sync.isSuccess && sync.data && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 text-sm text-emerald-900">
            Synced {sync.data.synced} of {sync.data.totalReceived} models from Vercel.
          </CardContent>
        </Card>
      )}
      {sync.isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-900">
            Sync failed: {(sync.error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Filter by provider or modelId substring.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Input $/M</TableHead>
                <TableHead className="text-right">Output $/M</TableHead>
                <TableHead className="text-right">P50 TTFT</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead className="text-right">Last sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {data?.total === 0 ? "Registry empty — click 'Sync now'." : "No matches."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                    <TableCell>{row.provider}</TableCell>
                    <TableCell><Badge variant="outline">{row.modelType}</Badge></TableCell>
                    <TableCell className="text-right">
                      {formatUsd(row.pricing?.inputPerMillion)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUsd(row.pricing?.outputPerMillion)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMs(row.performance?.p50TtftMs)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.capabilities &&
                          Object.entries(row.capabilities)
                            .filter(([, v]) => v)
                            .map(([k]) => (
                              <Badge key={k} variant="secondary" className="text-[10px]">
                                {k}
                              </Badge>
                            ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(row.lastSyncedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
