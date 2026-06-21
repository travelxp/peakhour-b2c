"use client";

import { Loader2, Sparkles, AlertTriangle, PackageX, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useInventory,
  useInventoryDiagnosis,
  type StockHealth,
  type InventoryItem,
} from "@/hooks/use-inventory";

const HEALTH_META: Record<
  StockHealth,
  { label: string; chip: string; icon: typeof AlertTriangle }
> = {
  at_risk: {
    label: "At risk",
    chip: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: AlertTriangle,
  },
  slow: {
    label: "Slow / dead",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    icon: PackageX,
  },
  watchlist: {
    label: "Watchlist",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    icon: Eye,
  },
  healthy: {
    label: "Healthy",
    chip: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    icon: CheckCircle2,
  },
};

const HEALTH_ORDER: StockHealth[] = ["at_risk", "slow", "watchlist", "healthy"];

export function InventoryPanel() {
  const { data, isLoading, isError, error } = useInventory();
  const diagnose = useInventoryDiagnosis();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading inventory health…
      </div>
    );
  }

  if (isError || !data) {
    // The API returns NO_STORE_CONNECTED (4xx) when there's no synced store.
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {(error as { code?: string })?.code === "NO_STORE_CONNECTED"
            ? "Connect a store to see your inventory health."
            : "Inventory health is unavailable right now. Please try again shortly."}
        </CardContent>
      </Card>
    );
  }

  if (data.scanned === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No products have synced yet. Once your catalog and recent orders sync,
          your stock-health breakdown appears here.
        </CardContent>
      </Card>
    );
  }

  const attention = data.items.filter((i) => i.health === "at_risk" || i.health === "slow");
  const diagnosisText = diagnose.data?.diagnosis;

  return (
    <div className="space-y-6">
      {/* Health breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HEALTH_ORDER.map((h) => {
          const m = HEALTH_META[h];
          const Icon = m.icon;
          return (
            <Card key={h}>
              <CardContent className="flex flex-col items-start gap-1 p-4">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.chip}`}>
                  <Icon className="size-3" />
                  {m.label}
                </span>
                <span className="text-2xl font-semibold">{data.counts[h]}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Across {data.scanned}
        {data.truncated ? "+" : ""} active products over the last {data.windowDays} days.
      </p>

      {/* AI diagnosis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Recommended actions</CardTitle>
          <Button
            size="sm"
            onClick={() => diagnose.mutate()}
            disabled={diagnose.isPending}
          >
            {diagnose.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Analysing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> Get recommendations
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {diagnose.isError ? (
            <p className="text-sm text-muted-foreground">
              {(diagnose.error as { message?: string })?.message ||
                "Couldn't generate recommendations. Please try again."}
            </p>
          ) : diagnosisText ? (
            <p className="whitespace-pre-wrap text-sm">{diagnosisText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate AI recommendations to prioritise restocks and clear slow
              stock. Uses Peaks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Attention list */}
      {attention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {attention.map((item) => (
                <AttentionRow key={item.sourceProductId} item={item} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AttentionRow({ item }: { item: InventoryItem }) {
  const m = HEALTH_META[item.health];
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title || "Untitled product"}</p>
        <p className="text-xs text-muted-foreground">
          {item.stock === null ? "Stock untracked" : `${item.stock} in stock`} ·{" "}
          {item.unitsSold} sold
          {item.daysOfCover !== null ? ` · ~${item.daysOfCover}d cover` : ""}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${m.chip}`}>
        {m.label}
      </span>
    </li>
  );
}
