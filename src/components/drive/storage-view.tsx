"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { StorageMeter } from "@/components/drive/storage-meter";
import { openAddSpace } from "@/components/media/add-space-dialog";
import { getCleanup, getStorageUsage, type MediaKind, type StorageUsage } from "@/lib/api/media";
import { cleanupTotals, gbText as bytesGbText } from "@/lib/drive/copy";
import { gbText, gbUsedText, meterState, packCostLine, poolLine, renewalLine, USD_NOTE } from "@/lib/storage-copy";

/**
 * The Storage tab (Storage board). It reuses what Q4 shipped and says nothing a second time: the meter and the sentences under it are
 * Q4's (`StorageMeter`, `meterState`), the packs offered are the api's catalog, and "Add space" is Q4's one dialog. What is new here is the
 * bar by kind of file and the line that sends the person to Smart Cleanup.
 *
 * The bar is made of colours from the console's own tokens, in an order that does not depend on how much of each there is.
 */

const KINDS: Array<{ kind: MediaKind; label: string; className: string }> = [
  { kind: "video", label: "Videos", className: "bg-primary" },
  { kind: "image", label: "Images", className: "bg-state-info" },
  { kind: "document", label: "Documents", className: "bg-warning" },
  { kind: "font", label: "Fonts", className: "bg-success" },
];

export function StoragePanel({ usage, cleanupBytes }: { usage: StorageUsage; cleanupBytes: number }) {
  const state = meterState(usage);
  const byKind = usage.byKind;
  const total = usage.totalBytes;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="flex min-w-0 flex-[2_1_26rem] flex-col gap-4 rounded-xl border bg-card p-5" aria-label="What is using your storage">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{gbUsedText(usage.gbUsed)} GB</span>
          {usage.limitGb !== null && <span className="text-[15px] text-muted-foreground">of {gbText(usage.limitGb)} GB. {poolLine(usage)}</span>}
        </div>
        <StorageMeter usage={usage} />
        {byKind && total > 0 && (
          <>
            <div className="flex h-4 gap-0.5 overflow-hidden rounded-lg bg-muted" role="img" aria-label="Storage by kind of file">
              {KINDS.map((k) => (
                <div key={k.kind} className={k.className} style={{ width: `${(byKind[k.kind].bytes / total) * 100}%` }} />
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-x-7 gap-y-2.5 sm:grid-cols-2">
              {KINDS.map((k) => (
                <li key={k.kind} className="flex items-center gap-2.5 text-[15px]">
                  <span className={`size-3 rounded-[3px] ${k.className}`} aria-hidden />
                  <span className="flex-1">{k.label}</span>
                  <span className="text-muted-foreground">{bytesGbText(byKind[k.kind].bytes)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {usage.perBusiness.length > 1 && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">By business</div>
            <ul className="mt-1.5 space-y-1 text-sm">
              {usage.perBusiness.map((b) => (
                <li key={b.businessId} className="flex justify-between gap-3">
                  <span>{b.name || "Your business"}</span>
                  <span className="text-muted-foreground">{bytesGbText(b.bytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3.5 py-3 text-sm">
          <span>
            {cleanupBytes > 0 ? `Smart Cleanup can free ${bytesGbText(cleanupBytes)}. ` : "Nothing to tidy up right now. "}
            {usage.softDeletedBytes > 0 ? `Trash holds ${bytesGbText(usage.softDeletedBytes)} that does not count.` : ""}
          </span>
          <Link href="/dashboard/drive?tab=cleanup" className="whitespace-nowrap text-brand-label underline-offset-2 hover:underline">
            Review Smart Cleanup
          </Link>
        </div>
      </section>

      <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-4">
        <section className="rounded-xl border bg-card p-4.5">
          <h2 className="text-[15px] font-semibold">Add space</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Pick a pack. You are only charged for what you choose.</p>
          {usage.catalog.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {usage.catalog.map((p) => (
                <li key={p.gb} className="flex min-h-10 items-center justify-between rounded-lg border px-3 text-sm">
                  <span className="font-medium">+{p.gb} GB</span>
                  <span className="text-muted-foreground">{p.peaksPerMonth.toLocaleString("en-US")} Peaks a month</span>
                </li>
              ))}
            </ul>
          )}
          {state.canAddSpace ? (
            <Button type="button" className="mt-3 w-full" onClick={openAddSpace}>
              Add space
            </Button>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{usage.paused ? "Top up your Peaks to add space." : "More space is not on offer for your plan."}</p>
          )}
          {usage.packs.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">
              {usage.packs.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{gbText(p.gb)} GB</span>
                  <span className="block text-xs text-muted-foreground">{renewalLine(p)}</span>
                </li>
              ))}
            </ul>
          )}
          {usage.catalog.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{packCostLine(usage.catalog[0]!)}. {USD_NOTE}</p>}
        </section>
        <section className="rounded-xl border bg-card p-4.5">
          <h2 className="text-[15px] font-semibold">Good to know</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">Each business on a paid plan adds its own space. Cancel a pack any time. If Peaks run out, new uploads pause and your files stay online.</p>
        </section>
      </div>
    </div>
  );
}

export function StorageView() {
  const usage = useQuery({ queryKey: ["storage-usage"], queryFn: getStorageUsage, staleTime: 60_000 });
  // The cleanup line is secondary: when it cannot be read the page still shows the storage.
  const cleanup = useQuery({ queryKey: ["drive", "cleanup"], queryFn: getCleanup, staleTime: 30_000 });
  if (usage.isPending) {
    return usage.fetchStatus === "paused" ? (
      <EmptyState icon={AlertTriangle} title="You look to be offline" description="Your storage will load when the connection is back." />
    ) : (
      <Skeleton className="h-72 rounded-xl" aria-busy="true" aria-label="Loading your storage" />
    );
  }
  if (usage.isError) {
    return <EmptyState icon={AlertTriangle} title="Your storage did not load" description="Something went wrong on our side. Nothing was changed." action={{ label: "Try again", onClick: () => void usage.refetch() }} />;
  }
  const totals = cleanupTotals(cleanup.data?.groups ?? [], new Set((cleanup.data?.groups ?? []).filter((g) => g.trashable).map((g) => g.kind)));
  return <StoragePanel usage={usage.data} cleanupBytes={totals.bytes} />;
}
