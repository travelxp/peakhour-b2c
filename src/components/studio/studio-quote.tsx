"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreditsBalance } from "@/hooks/use-credits";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPeaks } from "@/lib/pricing";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const Q = STUDIO_COPY.quote;

/** Peaks left this month for the "{n} left this month" line; null for an unlimited plan or while it is not known (the line is then left out). */
export function usePeaksLeft(): number | null {
  const balance = useCreditsBalance().data;
  if (!balance || balance.unlimited) return null;
  return Math.max(0, balance.remaining);
}

export type QuoteBlockState = "loading" | "quote" | "unavailable";

export interface QuoteBlockProps {
  state: QuoteBlockState;
  /** The total to show, from the quote. */
  peaks?: number;
  /** "previews": "Up to {n} Peaks for {k} previews..."; "finals": "Uses {n} Peaks for {k} finals"; "total": "Uses {n} Peaks". */
  kind?: "previews" | "finals" | "total";
  units?: number;
  /** The quote's own free flag. Free work shows the word Free, never "0 Peaks". */
  free?: boolean;
  left: number | null;
  /** Show the "Why these sizes?" help beside the "Charged only if it works." line (the previews quote and the Make final bar). */
  help?: boolean;
  onRetry?: () => void;
  className?: string;
}

/**
 * The quote block (UX spec 4.1), the same everywhere a charged step is asked for: the price in Peaks, what is left this month and the
 * promise "Charged only if it works." It never shows a currency symbol, and a free step shows the word "Free".
 *
 * States: loading ("Working out what this costs…", polite), the price, and unavailable (with Retry; the caller disables its button).
 */
export function QuoteBlock({ state, peaks = 0, kind = "total", units, free, left, help, onRetry, className }: QuoteBlockProps) {
  const headline = free
    ? Q.free
    : kind === "previews" && units
      ? Q.upTo(formatPeaks(peaks), units)
      : kind === "finals" && units
        ? Q.usesFinals(formatPeaks(peaks), units)
        : Q.uses(formatPeaks(peaks));
  return (
    <section aria-label={Q.region} data-slot="studio-quote" data-state={state} className={cn("space-y-0.5", className)}>
      {state === "loading" && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {Q.loading}
        </p>
      )}
      {state === "unavailable" && (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{Q.unavailable}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {Q.retry}
            </Button>
          )}
        </div>
      )}
      {state === "quote" && (
        <>
          <p className="text-base font-semibold">{headline}</p>
          {left !== null && <p className="text-sm text-muted-foreground">{Q.left(formatPeaks(left))}</p>}
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {Q.chargedOnlyIfItWorks}
            {help && <WhyTheseSizes />}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * The help beside the quote (UX spec 4.1, Bible test A8): one tap opens it, one tap or Escape closes it, and focus returns to the button.
 * A popover on a desktop, a bottom sheet on a phone.
 */
export function WhyTheseSizes() {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const W = STUDIO_COPY.why;
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-11 sm:size-8"
      aria-label={W.label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={mobile ? () => setOpen(true) : undefined}
    >
      <Info aria-hidden="true" className="size-4" />
    </Button>
  );
  if (mobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader className="p-0">
              <SheetTitle>{W.title}</SheetTitle>
              <SheetDescription>{W.body}</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80">
        <PopoverHeader>
          <PopoverTitle>{W.title}</PopoverTitle>
          <PopoverDescription>{W.body}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
