"use client";

import { useQuery } from "@tanstack/react-query";
import { HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStorageUsage, type StorageUsage } from "@/lib/api/media";
import { aboutUsd, gbText, peaksText, renewalLine } from "@/lib/storage-copy";
import { openAddSpace } from "@/components/media/add-space-dialog";

/**
 * "Storage" on the Peaks page (Peakhour Drive Q4): its own line, apart from AI work. It lists only what the customer chose, the
 * storage packs, with what they cost in Peaks each month and when each renews. There is no usage charge to show: nothing is
 * charged for the space used.
 */
export function StoragePeaksView({ usage }: { usage: StorageUsage }) {
  // Charging packs only: a cancelled pack will not renew, and a paused one is not being charged until the Peaks are there.
  const live = usage.packs.filter((p) => !p.cancelAtPeriodEnd && !p.paused);
  const monthly = live.reduce((n, p) => n + p.peaksPerMonth, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4" />
          Storage
        </CardTitle>
        <CardDescription className="mt-1">
          Separate from the Peaks your AI work uses. You are only charged for the storage packs you choose, never for the space you use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {usage.packs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No storage packs. Your Drive uses the {gbText(usage.limitGb ?? 0)} GB your {usage.source === "trial" ? "trial" : "plan"} includes.
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{peaksText(monthly)} Peaks a month</span>{" "}
              <span className="text-muted-foreground">({aboutUsd(monthly)} at the list price) for your packs.</span>
            </p>
            <ul className="space-y-2">
              {usage.packs.map((p) => (
                <li key={p.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{gbText(p.gb)} GB</p>
                  <p className="text-xs text-muted-foreground">{renewalLine(p)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        {usage.canBuyPacks && usage.catalog.length > 0 && !usage.paused ? (
          <Button variant="outline" size="sm" onClick={openAddSpace}>
            Add space
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StoragePeaksCard() {
  const { data } = useQuery({ queryKey: ["storage-usage"], queryFn: getStorageUsage, staleTime: 60_000 });
  // Secondary: a failed read hides the card rather than blocking the page.
  return data ? <StoragePeaksView usage={data} /> : null;
}
