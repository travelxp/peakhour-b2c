"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Zap, Clock, AlertTriangle, TrendingUp, Activity } from "lucide-react";

interface UsageSummary {
  period: { days: number; since: string };
  totals: {
    totalCalls: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgDuration: number;
    errorCount: number;
  };
  byUseCase: { useCase: string; calls: number; totalTokens: number; avgDuration: number; errors: number }[];
  byModel: { modelId: string; calls: number; totalTokens: number; inputTokens: number; outputTokens: number }[];
  byOrg: { orgId: string; plan: string; calls: number; totalTokens: number }[];
  byDay: { date: string; calls: number; totalTokens: number; errors: number }[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export default function AiUsagePage() {
  const [days, setDays] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["cms-ai-usage", days],
    queryFn: () => api.get<UsageSummary>(`/v1/cms/ai-usage/summary?days=${days}`),
  });

  const totals = data?.totals;
  const errorRate = totals && totals.totalCalls > 0
    ? ((totals.errorCount / totals.totalCalls) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Usage</h2>
          <p className="text-muted-foreground mt-1">
            Token usage, model distribution, and per-org consumption
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Zap} label="Total Calls" value={totals?.totalCalls?.toLocaleString() || "0"} />
          <KpiCard icon={Brain} label="Total Tokens" value={formatTokens(totals?.totalTokens || 0)} sub={`${formatTokens(totals?.totalInputTokens || 0)} in / ${formatTokens(totals?.totalOutputTokens || 0)} out`} />
          <KpiCard icon={Clock} label="Avg Duration" value={formatMs(totals?.avgDuration || 0)} />
          <KpiCard icon={AlertTriangle} label="Error Rate" value={`${errorRate}%`} sub={`${totals?.errorCount || 0} errors`} variant={Number(errorRate) > 5 ? "destructive" : "default"} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Use Case */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Use Case</CardTitle>
            <CardDescription>Token consumption per AI feature</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Use Case</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.byUseCase?.map((row) => (
                  <TableRow key={row.useCase}>
                    <TableCell className="font-medium">
                      <Badge variant="outline" className="text-xs">{row.useCase}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTokens(row.totalTokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMs(row.avgDuration)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.errors || "—"}</TableCell>
                  </TableRow>
                )) || (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Model</CardTitle>
            <CardDescription>Distribution across AI providers</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.byModel?.map((row) => (
                  <TableRow key={row.modelId}>
                    <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTokens(row.inputTokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTokens(row.outputTokens)}</TableCell>
                  </TableRow>
                )) || (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* By Org */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Organization (Top 10)</CardTitle>
          <CardDescription>Heaviest AI consumers</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Org ID</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.byOrg?.map((row) => (
                <TableRow key={row.orgId}>
                  <TableCell className="font-mono text-xs">{row.orgId}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{row.plan || "free"}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTokens(row.totalTokens)}</TableCell>
                </TableRow>
              )) || (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Daily trend — simple text-based for now */}
      {data?.byDay && data.byDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" />
              Daily Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byDay.slice(-14).map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="tabular-nums">{row.date}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTokens(row.totalTokens)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.errors || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, variant = "default" }: {
  icon: any; label: string; value: string; sub?: string; variant?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className={`flex size-10 items-center justify-center rounded-lg ${variant === "destructive" ? "bg-destructive/10" : "bg-primary/10"}`}>
          <Icon className={`size-5 ${variant === "destructive" ? "text-destructive" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
