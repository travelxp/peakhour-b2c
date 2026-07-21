"use client";

import { useCallback, useState } from "react";
import {
  Loader2,
  Sparkles,
  PackagePlus,
  Warehouse,
  Check,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/hooks/use-locale";
import { minorToMajor } from "@/lib/money";
import {
  useReplenisher,
  useReplenisherBrief,
  useProposeRestock,
  type RestockCandidate,
} from "@/hooks/use-commerce-replenisher";

/**
 * Commerce → Inventory & Supply, restock half (P2.3). Renders the Replenisher's
 * per-location restock plan as a SKU × location table (current stock, days of
 * cover, suggested restock quantity, projected revenue-at-risk) with an inline
 * "Propose restock" intent per row, plus a Peaks-metered AI restock brief.
 * Degrades honestly when no store / nothing to restock.
 */
export function ReplenisherPanel() {
  const { data, isLoading, isError, error } = useReplenisher();
  const brief = useReplenisherBrief();
  const propose = useProposeRestock();
  const { formatNumber } = useLocale();
  const [proposed, setProposed] = useState<Set<string>>(new Set());

  const money = useCallback(
    (minor: number | null, currency: string | null) => {
      if (minor === null) return null;
      const cur = currency ?? "USD";
      return formatNumber(minorToMajor(minor, cur), {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 0,
      });
    },
    [formatNumber],
  );

  const onPropose = useCallback(
    (c: RestockCandidate) => {
      propose.mutate(c.sourceProductId, {
        onSuccess: () => {
          setProposed((prev) => new Set(prev).add(c.sourceProductId));
          toast.success("Restock proposed", {
            description: `${c.title || "Product"} — the Replenisher logged the intent.`,
          });
        },
        onError: () =>
          toast.error("Couldn't propose restock", { description: "Please try again shortly." }),
      });
    },
    [propose],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading restock plan…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {(error as { code?: string })?.code === "NO_STORE_CONNECTED"
            ? "Connect a store to see your restock plan."
            : "The restock plan is unavailable right now. Please try again shortly."}
        </CardContent>
      </Card>
    );
  }

  const { candidates, locations } = data;
  const briefText = brief.data?.brief;

  return (
    <div className="space-y-6">
      {/* Locations context */}
      {locations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Locations:</span>
          {locations.map((l) => (
            <Badge key={l.id} variant="outline" className="gap-1 font-normal">
              <Warehouse className="size-3" />
              {l.name || "Unnamed"}
              {l.isDefault && <span className="text-muted-foreground">· default</span>}
            </Badge>
          ))}
        </div>
      )}

      {/* AI restock brief */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Restock brief</CardTitle>
          <Button size="sm" onClick={() => brief.mutate()} disabled={brief.isPending || candidates.length === 0}>
            {brief.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Writing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> Get restock brief
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {brief.isError ? (
            <p className="text-sm text-muted-foreground">
              {(brief.error as { message?: string })?.message ||
                "Couldn't generate the brief. Please try again."}
            </p>
          ) : briefText ? (
            <p className="whitespace-pre-wrap text-sm">{briefText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              A prioritised, plain-language restock plan — what to reorder this week and roughly
              how much. Uses Peaks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Restock plan — SKU × location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restock plan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {candidates.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {data.scanned
                ? "Nothing needs restocking right now — no at-risk product has recent demand outrunning its stock."
                : "No products have synced yet. Your restock plan appears once your catalog and recent orders sync."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 text-right font-medium">In stock</th>
                    <th className="px-4 py-2 text-right font-medium">Cover</th>
                    <th className="px-4 py-2 text-right font-medium">Restock</th>
                    <th className="px-4 py-2 text-right font-medium">At risk</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {candidates.map((c) => {
                    const risk = money(c.lostSalesAvoidedMinor, c.currency);
                    const isDone = proposed.has(c.sourceProductId);
                    const isBusy = propose.isPending && propose.variables === c.sourceProductId;
                    const stockLabel =
                      c.locationStock !== null ? `${c.locationStock}` : `${c.currentStock}`;
                    return (
                      <tr key={c.sourceProductId} className="align-middle">
                        <td className="max-w-[16rem] px-4 py-3">
                          <p className="line-clamp-1 font-medium">{c.title || "Untitled product"}</p>
                          <p className="text-xs text-muted-foreground">{c.unitsSold} sold · {c.dailyVelocity}/day</p>
                        </td>
                        <td className="px-4 py-3">
                          {c.locationName ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Warehouse className="size-3" />
                              {c.locationName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{stockLabel}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {c.daysOfCover === null ? (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                              <TriangleAlert className="size-3" /> OOS
                            </span>
                          ) : (
                            `${c.daysOfCover}d`
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          +{c.recommendedRestockQty}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{risk ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <Check className="size-3" /> Proposed
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onPropose(c)}
                              disabled={isBusy}
                            >
                              {isBusy ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <>
                                  <PackagePlus className="mr-1 size-4" /> Propose
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {candidates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Restock targets {data.targetCoverDays} days of cover; “at risk” is the revenue a
          stock-out over a {data.leadTimeDays}-day lead window would cost. Proposing logs an
          intent for the Replenisher — nothing is ordered automatically.
        </p>
      )}
    </div>
  );
}
