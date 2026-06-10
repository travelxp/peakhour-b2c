"use client";

import { useQuery } from "@tanstack/react-query";
import { HardDrive, DollarSign, TrendingUp, Recycle, Lightbulb } from "lucide-react";
import { getStorageIntelligence, type StorageIntelligence } from "@/lib/api/storage-intelligence";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

const SOURCE_LABELS: Record<string, string> = {
  ai_generated: "AI generated",
  uploaded: "Uploaded",
  unsplash: "Unsplash",
  imported_beehiiv: "Beehiiv",
  imported_data_url: "Imported (legacy)",
};
const RECLAIM_LABELS: Record<string, string> = {
  unused_90d: "Unused 90d+",
  large_5mb_plus: "Large files",
  duplicate_content_hash: "Duplicates",
  orphan_generated: "AI, never used",
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const gbStr = (n: number) => `${n.toFixed(n < 1 ? 2 : 1)} GB`;

/**
 * CMS Storage Intelligence / P&L dashboard (Media Manager / R2 plan §18).
 * CMS-only — costs never surface to end users. Consumes the read-only
 * /v1/cms/storage-intelligence/summary aggregation.
 */
export default function StorageIntelligencePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cms-storage-intelligence"],
    queryFn: getStorageIntelligence,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage Intelligence</h1>
        <p className="text-sm text-muted-foreground">
          R2 cost vs. overage revenue, usage mix, and cleanup opportunity across all orgs.
          {data ? ` As of ${new Date(data.asOf).toLocaleString()}.` : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load storage intelligence.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : (
        <Dashboard data={data} />
      )}
    </div>
  );
}

function Dashboard({ data }: { data: StorageIntelligence }) {
  const maxSourceBytes = Math.max(1, ...data.sourceMix.map((s) => s.bytes));
  const maxPlanBytes = Math.max(1, ...data.perPlan.map((p) => p.totalBytes));

  return (
    <>
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={HardDrive}
          label="Total stored"
          value={gbStr(data.totals.totalGb)}
          sub={`${data.totals.fileCount.toLocaleString()} assets · ${data.totals.orgCount} orgs`}
        />
        <Kpi
          icon={DollarSign}
          label="R2 cost / mo"
          value={usd(data.pnl.r2CostUsd)}
          sub={`@ $${data.r2CostPerGbMo.toFixed(3)}/GB · incl. ${gbStr(data.totals.softDeletedGb)} grace carry`}
        />
        <Kpi
          icon={TrendingUp}
          label="Overage revenue"
          value={usd(data.pnl.latestOverageRevenueUsd)}
          sub={data.overagePeriods[0] ? `period ${data.overagePeriods[0].period}` : "no realized overage yet"}
        />
        <Kpi
          icon={DollarSign}
          label="Net (overage − cost)"
          value={usd(data.pnl.netUsd)}
          sub={data.pnl.netUsd >= 0 ? "covering R2 cost" : "subsidising R2 cost"}
          tone={data.pnl.netUsd >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Source mix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage by source</CardTitle>
            <CardDescription>Where stored bytes come from (active assets).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sourceMix.length === 0 ? (
              <p className="text-sm text-muted-foreground">No media yet.</p>
            ) : (
              data.sourceMix.map((s) => (
                <ProportionRow
                  key={s.source}
                  label={SOURCE_LABELS[s.source] ?? s.source}
                  right={`${gbStr(s.gb)} · ${s.count.toLocaleString()}`}
                  value={(s.bytes / maxSourceBytes) * 100}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Per-plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage &amp; cost by plan</CardTitle>
            <CardDescription>Stored GB and R2 cost per plan tier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.perPlan.map((p) => (
              <ProportionRow
                key={p.plan}
                label={`${p.plan} (${p.orgCount})`}
                right={`${gbStr(p.gb)} · ${usd(p.r2CostUsd)}/mo`}
                value={(p.totalBytes / maxPlanBytes) * 100}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top consumers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top consumers</CardTitle>
          <CardDescription>Orgs by stored bytes — upsell + margin-risk signal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Org</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Stored</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topConsumers.map((t) => (
                <TableRow key={t.orgId}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{t.plan}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{gbStr(t.gb)}</TableCell>
                  <TableCell className="text-right">{t.fileCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {typeof t.storageOverrideGb === "number" ? `${t.storageOverrideGb} GB` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {data.topConsumers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No usage yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Reclaimable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Recycle className="size-4" /> Reclaimable
            </CardTitle>
            <CardDescription>Smart Delete cleanup opportunity (advisory).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.reclaimable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing flagged for cleanup.</p>
            ) : (
              data.reclaimable.map((r) => (
                <div key={r.kind} className="flex items-center justify-between text-sm">
                  <span>{RECLAIM_LABELS[r.kind] ?? r.kind}</span>
                  <span className="text-muted-foreground">
                    {gbStr(r.gb)} · {r.count.toLocaleString()} assets
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4" /> Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">All healthy — nothing to action.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
  sub: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <div
          className={`mt-1.5 text-2xl font-semibold tabular-nums ${
            tone === "negative" ? "text-red-600 dark:text-red-400" : tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ProportionRow({ label, right, value }: { label: string; right: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="capitalize">{label}</span>
        <span className="text-muted-foreground tabular-nums">{right}</span>
      </div>
      <Progress value={Math.min(100, value)} className="mt-1 h-2" />
    </div>
  );
}
