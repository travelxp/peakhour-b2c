"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReviewKit } from "@/hooks/use-review-kit";
import { kitEmptyState, posterCopy, svgDataUri, POSTER_PAGE_NOTE, type ReviewKit } from "@/lib/review-kit";

/**
 * The printable A4 poster (PE-05): the business's name, a line asking for a review, and the QR code.
 *
 * ★PRINT IS DONE WITH CSS, NOT A SECOND PAGE. A print-only copy of the sheet is a direct child of <body> and `@media print` removes every other
 * child (display none, not just hidden, so the dashboard keeps no height and no blank page follows), at A4 with no margin. The words are `lib/review-kit.ts`'s: an honest review is asked for, never a good one, and nothing is
 * offered in return. The network's name is the api's (the adapter's declaration).
 */
const PRINT_CSS = `
@page { size: A4; margin: 0; }
#review-poster-print { display: none; }
@media print {
  /* the poster is a direct child of <body>, so every OTHER child goes: nothing of the dashboard keeps its height, so no blank page follows */
  body > :not(#review-poster-print) { display: none !important; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  #review-poster-print { display: block !important; width: 210mm; height: 297mm; }
  #review-poster-print > div { width: 210mm !important; max-width: none !important; height: 297mm !important; aspect-ratio: auto !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
}
`;

type PosterKit = Extract<ReviewKit, { state: "ready" }>;

/** The sheet itself. Drawn twice: once on screen as a preview, once in the print-only copy that sits directly under <body>. */
function PosterSheet({ kit, id, print = false }: { kit: PosterKit; id?: string; print?: boolean }) {
  const copy = posterCopy(kit);
  return (
    <div
      id={id}
      className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col items-center justify-between rounded-md border bg-white p-[12mm] text-center text-black shadow-sm"
    >
      <p className={print ? "text-[26pt] font-semibold leading-tight" : "text-[clamp(1.25rem,4vw,2.25rem)] font-semibold leading-tight"}>{copy.businessName}</p>
      <div className="space-y-3">
        <p className={print ? "text-[40pt] font-bold leading-tight" : "text-[clamp(1.5rem,6vw,3.5rem)] font-bold leading-tight"}>{copy.headline}</p>
        <p className={print ? "text-[18pt]" : "text-[clamp(0.9rem,2.4vw,1.5rem)]"}>{copy.subline}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- an api-drawn SVG data URI */}
      <img src={svgDataUri(kit.qrSvg)} alt={`QR code that opens ${copy.businessName}'s review page`} className="aspect-square w-[62%] max-w-[120mm]" />
      <p className={print ? "text-[18pt] font-medium" : "text-[clamp(0.9rem,2.4vw,1.5rem)] font-medium"}>{copy.instruction}</p>
    </div>
  );
}

export function ReviewPoster({ location, network }: { location?: string | undefined; network?: string | undefined }) {
  // false while rendering on the server, true in the browser: the portal needs <body>, which only the browser has
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const kit = useReviewKit(location, network);
  if (kit.isPending) return <Skeleton className="mx-auto h-[60vh] w-full max-w-md" />;
  if (kit.isError) {
    return <p className="p-6 text-sm text-muted-foreground">We couldn&apos;t load your poster just now. Try again in a moment.</p>;
  }
  if (kit.data.state !== "ready") {
    const empty = kitEmptyState(kit.data);
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
  const ready = kit.data;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
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
      <PosterSheet kit={ready} />
      {/* The print copy lives directly under <body> (a portal), so the print rules can hide everything else. */}
      {mounted && createPortal(<div id="review-poster-print"><PosterSheet kit={ready} print /></div>, document.body)}
    </div>
  );
}
