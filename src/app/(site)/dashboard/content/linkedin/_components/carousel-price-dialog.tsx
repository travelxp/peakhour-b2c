"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { quoteTokenFor, usePeaksQuote, type PeaksQuoteState } from "@/hooks/use-peaks-quote";
import { PriceLine } from "@/components/audience/discover-audiences-dialog";
import { formatPeaks } from "@/lib/pricing";

export const CAROUSEL_PRICE_COPY = {
  title: "Make a carousel preview?",
  working: "Five slides, each with its own AI image.",
  no: "Not now",
  yes: "Make the preview",
} as const;

/** "This costs 1,250 Peaks, and only when your preview is ready." once a receipt is held; the shared price line for every other state. */
export function carouselPriceSentence(price: Pick<PeaksQuoteState, "quote">): string | null {
  const quote = price.quote;
  if (!quote || quote.free) return null;
  return `This costs ${formatPeaks(quote.peaks)} Peaks, and you pay only for the images that are made. If one fails, you are not charged for it. Publishing the preview is free.`;
}

/**
 * The price of a carousel, shown BEFORE it is made (CS-5b): the preview makes one AI image per slide, so it is a priced task. The signed receipt for the
 * price on screen travels with the click (`x-peaks-quote`), so the price shown is the price charged. The button stays off until a price is in hand.
 */
export function CarouselPriceDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** The receipt for the price on screen; the caller sends it on the preview call. */
  onConfirm: (quoteToken: string | undefined) => void;
  onCancel: () => void;
}) {
  // Asked for only while the dialog is open, so the receipt's clock starts when the merchant is about to act.
  const price = usePeaksQuote(PEAKS_ACTIONS.linkedinCarousel, open);
  const sentence = carouselPriceSentence(price);
  return (
    <AlertDialog open={open} onOpenChange={(o) => (o ? undefined : onCancel())}>
      <AlertDialogContent data-testid="carousel-price-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{CAROUSEL_PRICE_COPY.title}</AlertDialogTitle>
          <AlertDialogDescription>{CAROUSEL_PRICE_COPY.working}</AlertDialogDescription>
        </AlertDialogHeader>
        {sentence ? <p className="text-sm font-medium" data-testid="carousel-price">{sentence}</p> : <PriceLine price={price} />}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{CAROUSEL_PRICE_COPY.no}</AlertDialogCancel>
          <AlertDialogAction disabled={price.quote === undefined} onClick={() => onConfirm(quoteTokenFor(price).quoteToken)}>
            {CAROUSEL_PRICE_COPY.yes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
