"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { presenceApi } from "@/lib/api/presence";
import { kitEmptyState, posterCopy, svgDataUri, POSTER_PAGE_NOTE, REVIEW_KIT_QUERY_KEY } from "@/lib/review-kit";

/**
 * The printable A4 poster (PE-05): the business's name, a line asking for a review, and the QR code.
 *
 * ★PRINT IS DONE WITH CSS, NOT A SECOND PAGE. `@media print` hides everything but the poster and sets A4 with no margin, so the dashboard's
 * chrome never reaches the paper. The words are `lib/review-kit.ts`'s: an honest review is asked for, never a good one, and nothing is
 * offered in return. The network's name is the api's (the adapter's declaration).
 */
const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  body * { visibility: hidden !important; }
  #review-poster, #review-poster * { visibility: visible !important; }
  #review-poster { position: fixed; inset: 0; width: 210mm; height: 297mm; box-shadow: none !important; border: 0 !important; }
}
`;

export function ReviewPoster() {
  const kit = useQuery({ queryKey: REVIEW_KIT_QUERY_KEY, queryFn: () => presenceApi.reviewKit(), staleTime: 60_000 });
  if (kit.isLoading) return <Skeleton className="mx-auto h-[60vh] w-full max-w-md" />;
  if (kit.isError || !kit.data) {
    return <p className="p-6 text-sm text-muted-foreground">We couldn&apos;t load your poster just now. Try again in a moment.</p>;
  }
  const empty = kitEmptyState(kit.data);
  if (empty || kit.data.state !== "ready") {
    return (
      <div className="mx-auto max-w-md space-y-2 p-6">
        <p className="font-medium">{empty?.headline}</p>
        <p className="text-sm text-muted-foreground">{empty?.description}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/presence">Back to Presence</Link>
        </Button>
      </div>
    );
  }
  const copy = posterCopy(kit.data);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">{POSTER_PAGE_NOTE}</p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/presence">Back</Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      {/* A4 at 210 x 297 mm; on a narrow screen it scales down with the width. */}
      <div
        id="review-poster"
        className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between rounded-md border bg-white p-[12mm] text-center text-black shadow-sm"
      >
        <p className="text-[clamp(1.25rem,4vw,2.25rem)] font-semibold leading-tight">{copy.businessName}</p>
        <div className="space-y-3">
          <p className="text-[clamp(1.5rem,6vw,3.5rem)] font-bold leading-tight">{copy.headline}</p>
          <p className="text-[clamp(0.9rem,2.4vw,1.5rem)]">{copy.subline}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- an api-drawn SVG data URI */}
        <img src={svgDataUri(kit.data.qrSvg)} alt={`QR code that opens ${copy.businessName}'s review page`} className="aspect-square w-[62%] max-w-[120mm]" />
        <p className="text-[clamp(0.9rem,2.4vw,1.5rem)] font-medium">{copy.instruction}</p>
      </div>
    </div>
  );
}
