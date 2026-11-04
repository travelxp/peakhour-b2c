"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Printer, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { presenceApi } from "@/lib/api/presence";
import { askLine, copyLabel, kitEmptyState, svgDataUri, REVIEW_KIT_QUERY_KEY } from "@/lib/review-kit";

/**
 * Get more reviews: a link to copy, a QR code, and a poster to print (PE-05).
 *
 * ★MARKUP ONLY. The words and rules are in `lib/review-kit.ts`. The network's name comes from the api (the adapter's declaration); this file
 * holds none. One link, the same for every customer: nothing here asks who was pleased.
 * ★NOTHING IS SENT FROM HERE. A person copies the link or prints the poster.
 */
export function ReviewKitCard() {
  const kit = useQuery({ queryKey: REVIEW_KIT_QUERY_KEY, queryFn: () => presenceApi.reviewKit(), staleTime: 60_000 });
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  if (kit.isLoading) return <Skeleton className="h-40 w-full" />;
  // ⚠️A FAILED READ IS NOT "NO LINK": say the read failed.
  if (kit.isError || !kit.data) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">We couldn&apos;t load your review link just now. Try again in a moment.</Card>
    );
  }
  const empty = kitEmptyState(kit.data);
  if (empty || kit.data.state !== "ready") {
    return (
      <Card className="space-y-1 p-4">
        <h2 className="text-base font-semibold">Get more reviews</h2>
        <p className="text-sm font-medium">{empty?.headline}</p>
        <p className="text-sm text-muted-foreground">{empty?.description}</p>
      </Card>
    );
  }
  const ready = kit.data;

  async function copy() {
    try {
      await navigator.clipboard.writeText(ready.link);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 3000);
  }

  return (
    <Card className="space-y-4 p-4 md:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Get more reviews</h2>
        <p className="text-sm text-muted-foreground">
          {askLine(ready)}. Share the link or put the poster where customers can scan it. It is the same for every customer.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- an api-drawn SVG data URI */}
        <img src={svgDataUri(ready.qrSvg)} alt={`QR code that opens ${ready.businessName}'s review page`} className="size-40 shrink-0 rounded-md border bg-white" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all rounded-md bg-muted/40 p-2 text-xs text-muted-foreground" data-testid="review-link">
            {ready.link}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="mr-1.5 size-3.5" aria-hidden />
              {copyLabel(copied)}
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/presence/review-poster">
                <Printer className="mr-1.5 size-3.5" aria-hidden />
                Print the poster
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
