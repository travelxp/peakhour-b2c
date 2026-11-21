"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MediaImage } from "@/components/shared/media-image";
import { QuoteBlock, usePeaksLeft, WhyTheseSizes, type QuoteBlockState } from "@/components/studio/studio-quote";
import { RefusalNote } from "@/components/studio/refusal-note";
import { ComingSoon } from "@/components/studio/coming-soon";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFinalQuote, useMakeFinals, useShortlist, useStudioAbilities } from "@/hooks/use-studio-flow";
import { useStudioAvailability } from "@/hooks/use-studio";
import type { ShortlistItem } from "@/lib/api/creative-studio";
import { formatPeaks } from "@/lib/pricing";
import { STUDIO_COPY } from "@/lib/studio-copy";
import {
  affordableUnits,
  chosenForFinal,
  isEligibleForFinal,
  MAX_FINALS_PER_PRESS,
  STUDIO_PATHS,
  studioRefusal,
  type StudioRefusal,
} from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

const S = STUDIO_COPY.shortlist;

/** A value that follows `value` after it has held still for `ms` (the bar's price is asked 300 ms after the count settles). */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface MakeFinalBarViewProps {
  count: number;
  /** "coming_soon": the count still shows, the button reads "Final opens soon" (off) and there is no price. "unknown": still being read: no price, no claim. */
  final: "on" | "coming_soon" | "unknown";
  quote: { state: QuoteBlockState; peaks?: number; free?: boolean };
  canMake: boolean;
  onMake: () => void;
}

/**
 * The Make final bar (UX spec S9): "{n} shortlisted" (a link to the Shortlist), the price with the "Why these sizes?" help, and Make final.
 * A sticky bar above the tab bar on a phone. While final is not available it shows the count and "Final opens soon", never a price.
 */
export function MakeFinalBarView({ count, final, quote, canMake, onMake }: MakeFinalBarViewProps) {
  return (
    <div
      role="region"
      aria-label={S.makeFinal}
      data-slot="studio-make-final-bar"
      className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-background px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:bottom-0 md:start-(--sidebar-width,0px)"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={STUDIO_PATHS.shortlist} className="text-sm font-semibold underline-offset-2 hover:underline">
            {S.barCount(count)}
          </Link>
          {final === "on" && quote.state === "quote" && (
            <p className="flex items-center text-sm text-muted-foreground">
              {quote.free ? STUDIO_COPY.quote.free : `${formatPeaks(quote.peaks ?? 0)} Peaks`}
              <WhyTheseSizes />
            </p>
          )}
          {final === "on" && quote.state === "loading" && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {STUDIO_COPY.quote.loading}
            </p>
          )}
          {final === "on" && quote.state === "unavailable" && <p className="text-sm text-muted-foreground">{STUDIO_COPY.quote.unavailable}</p>}
        </div>
        <Button type="button" className="h-12 min-w-36" disabled={final !== "on" || !canMake} onClick={onMake}>
          {final === "coming_soon" ? S.finalSoon : S.makeFinal}
        </Button>
      </div>
      {!canMake && final === "on" && <p className="mx-auto mt-1 max-w-3xl text-xs text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToMake}</p>}
    </div>
  );
}

export interface MakeFinalSheetViewProps {
  items: ShortlistItem[];
  selected: ReadonlySet<string>;
  onToggle: (previewId: string) => void;
  /** "off": Make final switched off while the sheet was open: the designed card, no price, no error. */
  final: "on" | "off";
  quote: { state: QuoteBlockState; peaks?: number; free?: boolean };
  left: number | null;
  pending: boolean;
  refusal?: StudioRefusal;
  makeInstead?: { label: string; onPress: () => void };
  /** The Peaks ran short part way: how many were started, and the rest were not. */
  startedShort?: number;
  onConfirm: () => void;
  onCancel: () => void;
  /** After "the price changed": drop the sentence; the price is already being asked again. */
  onClearRefusal: () => void;
}

/**
 * The choose sheet (UX spec S9, S10): the shortlisted previews, all ticked, untick to leave one out; the price for the ticked count with
 * the contract stated once (made from the exact preview, a final that doesn't match is not shown and not charged). Finals from one press are
 * made one after another.
 */
export function MakeFinalSheetView(p: MakeFinalSheetViewProps) {
  const n = p.selected.size;
  const items = p.items;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-slot="studio-make-final-sheet">
      {p.final === "off" ? (
        <ComingSoon
          title={STUDIO_COPY.refusal.notAvailable("Making a final")}
          description={STUDIO_COPY.comingSoon.previews.description}
          actions={<Button type="button" variant="outline" className="h-11" onClick={p.onCancel}>{S.cancel}</Button>}
        />
      ) : (
        <>
          <ul aria-label={S.list} className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {items.map((it) => (
              <li key={it.previewId} className="flex items-center gap-3 rounded-lg border p-2">
                <Checkbox id={`studio-final-${it.previewId}`} checked={p.selected.has(it.previewId)} onCheckedChange={() => p.onToggle(it.previewId)} />
                <Label htmlFor={`studio-final-${it.previewId}`} className="flex min-w-0 flex-1 items-center gap-3 py-1">
                  <span className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {it.thumbUrl && <MediaImage src={it.thumbUrl} alt="" width={56} height={56} className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{it.headline || S.untitled}</span>
                    {it.productTitle && <span className="block truncate text-xs text-muted-foreground">{it.productTitle}</span>}
                  </span>
                </Label>
              </li>
            ))}
          </ul>
          {n === 0 && <p className="text-sm text-muted-foreground">{S.selectNone}</p>}
          {n > MAX_FINALS_PER_PRESS && <p className="text-sm text-muted-foreground">{S.tooMany(MAX_FINALS_PER_PRESS)}</p>}
          {n > 0 && n <= MAX_FINALS_PER_PRESS && (
            <QuoteBlock state={p.quote.state} peaks={p.quote.peaks} units={n} kind="finals" free={p.quote.free} left={p.left} help />
          )}
          {p.startedShort !== undefined && <p role="status" className="text-sm">{S.shortSome(p.startedShort)}</p>}
          {p.refusal && <RefusalNote refusal={p.refusal} onRetry={p.onConfirm} onRequote={p.onClearRefusal} makeInstead={p.makeInstead} />}
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-12 flex-1"
              disabled={n === 0 || n > MAX_FINALS_PER_PRESS || p.pending || p.quote.state !== "quote"}
              onClick={p.onConfirm}
            >
              {n > 0 && n <= MAX_FINALS_PER_PRESS && p.quote.state === "quote" && p.quote.peaks !== undefined ? S.confirm(formatPeaks(p.quote.peaks)) : S.chooseTitle}
            </Button>
            <Button type="button" variant="ghost" className="h-12" onClick={p.onCancel}>
              {S.cancel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Everything the Make final bar and its choose sheet need: the shortlist, the capability, the quotes and the press. One component so the bar
 * and the Shortlist page's button can open the same sheet and the count and price never disagree.
 */
export function useMakeFinalFlow() {
  const shortlist = useShortlist();
  const availability = useStudioAvailability();
  const { canMake } = useStudioAbilities();
  const eligible = (shortlist.data?.items ?? []).filter(isEligibleForFinal);
  const caps = availability.capabilities.final;
  const [offNow, setOffNow] = useState(false);
  const final: "on" | "coming_soon" | "unknown" = availability.loading ? "unknown" : caps === "on" && !offNow ? "on" : "coming_soon";
  // The bar's price: asked once the count has settled, only while the bar is on screen.
  const settled = useDebounced(eligible.length, 300);
  const barQuote = useFinalQuote(Math.min(settled, MAX_FINALS_PER_PRESS), final === "on" && canMake && eligible.length > 0 && settled === eligible.length);
  return { shortlist, eligible, final, canMake, setOffNow, barQuote, loadingAvailability: availability.loading };
}

export function MakeFinalSheet({
  open,
  onOpenChange,
  items,
  onNotReleased,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ShortlistItem[];
  onNotReleased: () => void;
}) {
  const mobile = useIsMobile();
  const left = usePeaksLeft();
  const make = useMakeFinals();
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [refusal, setRefusal] = useState<StudioRefusal | undefined>();
  const [short, setShort] = useState<number | undefined>();
  const [off, setOff] = useState(false);
  // All ticked by default; unticking is remembered until the sheet closes. The first MAX_FINALS_PER_PRESS fit one press.
  // Only what is still waiting counts: a preview that left the shortlist since it was ticked (a teammate, a press that started) drops out of the count and the price.
  const chosen = chosenForFinal(items, picked);
  const selected = new Set(chosen.map((i) => i.previewId));
  const quote = useFinalQuote(chosen.length, open && chosen.length > 0 && !off);
  const unitPeaks = quote.quote && chosen.length > 0 ? quote.quote.peaks / chosen.length : undefined;
  const instead = refusal?.code === "CREDITS_EXHAUSTED" ? affordableUnits(refusal.left, unitPeaks, chosen.length) : undefined;

  const reset = () => {
    setPicked(null);
    setRefusal(undefined);
    setShort(undefined);
  };

  const confirm = () => {
    setRefusal(undefined);
    make.mutate(
      { items: chosen.map((i) => ({ creativeId: i.creativeId, previewId: i.previewId })), quoteToken: quote.quote?.token },
      {
        onSuccess: (r) => {
          if (r.refused) {
            setShort(r.finals.length);
            toast(S.started(r.finals.length));
            return;
          }
          toast.success(S.started(r.finals.length));
          reset();
          onOpenChange(false);
        },
        onError: (e) => {
          const r = studioRefusal(e, "Making a final");
          if (r.tone === "not_released") {
            setOff(true);
            onNotReleased();
          } else setRefusal(r);
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 p-4", mobile ? "h-[92dvh]" : "sm:max-w-lg")}>
        <SheetHeader className="p-0">
          <SheetTitle>{S.chooseTitle}</SheetTitle>
          <SheetDescription>{S.chooseDescription}</SheetDescription>
        </SheetHeader>
        <MakeFinalSheetView
          items={items}
          selected={selected}
          onToggle={(id) => {
            const next = new Set(selected);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setPicked(next);
            setRefusal(undefined);
          }}
          final={off ? "off" : "on"}
          quote={{
            state: quote.quote ? "quote" : quote.unavailable ? "unavailable" : "loading",
            peaks: quote.quote?.peaks,
            free: quote.quote?.free,
          }}
          left={left}
          pending={make.isPending}
          refusal={refusal}
          makeInstead={
            instead !== undefined
              ? {
                  label: STUDIO_COPY.refusal.makeInstead(instead, instead === 1 ? "final" : "finals"),
                  onPress: () => {
                    setPicked(new Set(chosen.slice(0, instead).map((i) => i.previewId)));
                    setRefusal(undefined);
                  },
                }
              : undefined
          }
          startedShort={short}
          onConfirm={confirm}
          onCancel={() => onOpenChange(false)}
          onClearRefusal={() => setRefusal(undefined)}
        />
        <SheetFooter className="p-0 pb-[env(safe-area-inset-bottom)]" />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The Make final bar, mounted once by the Studio layout (UX spec S9). It is on screen only when something is waiting to be made final, and
 * never over the plan screen, which has its own price and button. The price is asked of the bar while it is on screen.
 */
export function MakeFinalBar() {
  const pathname = usePathname();
  const flow = useMakeFinalFlow();
  const [open, setOpen] = useState(false);
  // The plan screen has its own price and button, and the batch grid has its own bar for its approved ones.
  const onPlan = pathname.startsWith("/dashboard/studio/new") || pathname.startsWith("/dashboard/studio/batches");
  if (onPlan || flow.eligible.length === 0) return null;
  const quote = flow.barQuote;
  return (
    <>
      <div aria-hidden="true" className="h-24 md:h-20" />
      <MakeFinalBarView
        count={flow.eligible.length}
        final={flow.final}
        quote={{
          state: quote.quote ? "quote" : quote.unavailable ? "unavailable" : "loading",
          peaks: quote.quote?.peaks,
          free: quote.quote?.free,
        }}
        canMake={flow.canMake}
        onMake={() => setOpen(true)}
      />
      <MakeFinalSheet open={open} onOpenChange={setOpen} items={flow.eligible} onNotReleased={() => flow.setOffNow(true)} />
    </>
  );
}
