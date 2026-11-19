"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ComingSoon } from "@/components/studio/coming-soon";
import { ProductPicker } from "@/components/studio/product-picker";
import { QuoteBlock, usePeaksLeft, type QuoteBlockState } from "@/components/studio/studio-quote";
import { RefusalNote } from "@/components/studio/refusal-note";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStudioAvailability, useStudioPrefs } from "@/hooks/use-studio";
import { useStudioAbilities } from "@/hooks/use-studio-flow";
import { useBatchQuote, useCreateBatch } from "@/hooks/use-studio-pro";
import { ApiError } from "@/lib/api";
import { receiptsOf, studioRefusal, type StudioRefusal } from "@/lib/studio-flow";
import { affordableProducts, batchBody, batchIds, BATCH_COUNTS, canStartBatch, DEFAULT_BATCH_COUNT, whyLines } from "@/lib/studio-batch-start";
import type { BatchQuote } from "@/lib/api/creative-studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

const B = STUDIO_COPY.batchStart;

/** "Why this price": what the one total is made of, from the quote alone. A plain disclosure, so a keyboard opens it and it needs no script. */
export function WhyThisPrice({ quote }: { quote: BatchQuote }) {
  const w = whyLines(quote);
  return (
    <details className="rounded-lg border px-3 py-1 text-sm" data-slot="studio-batch-why">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8">{B.whyLabel}</summary>
      <ul className="space-y-1.5 pb-2 text-muted-foreground">
        <li>{B.whyPreviews(w.previews.units, w.previews.products, w.previews.each)}</li>
        {w.photos > 0 && <li>{B.whyPhotos(w.photos)}</li>}
        <li>{B.whyCharged}</li>
      </ul>
    </details>
  );
}

export interface BatchConfirmViewProps {
  /** How many products are chosen. */
  products: number;
  count: 3 | 4;
  onCount: (c: 3 | 4) => void;
  /** Making previews is not switched on: the sheet is the coming-soon card, with no price. */
  comingSoon: boolean;
  quote: { state: QuoteBlockState; value?: BatchQuote };
  /** A plain sentence for a product with no photo (no price can be made until it has one). */
  blocked?: string;
  left: number | null;
  canMake: boolean;
  pending: boolean;
  refusal?: StudioRefusal;
  makeInstead?: { label: string; onPress: () => void };
  onMake: () => void;
  onBack: () => void;
  onClose: () => void;
  onRetryQuote: () => void;
  onRequote: () => void;
}

/**
 * The confirm step (UX spec S16): ONE price for the whole batch, never one per product, with "Why this price". The button is off until the
 * price is in. A switched-off use case is the designed coming-soon card; a short balance offers "Make {k} instead".
 */
export function BatchConfirmView(p: BatchConfirmViewProps) {
  if (p.comingSoon) {
    return (
      <div className="space-y-3" data-slot="studio-batch-confirm">
        <ComingSoon
          title={STUDIO_COPY.comingSoon.previews.title}
          description={STUDIO_COPY.comingSoon.previews.description}
          actions={
            <Button type="button" variant="outline" className="h-11" onClick={p.onClose}>
              {B.cancel}
            </Button>
          }
        />
      </div>
    );
  }
  const q = p.quote.value;
  const ready = p.quote.state === "quote" && !!q;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-slot="studio-batch-confirm">
      <p className="text-sm text-muted-foreground">{B.confirmDescription(p.products, p.count)}</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{B.each}</legend>
        <div className="flex gap-2">
          {BATCH_COUNTS.map((c) => (
            <Button key={c} type="button" variant={c === p.count ? "default" : "outline"} className="h-11 flex-1" aria-pressed={c === p.count} disabled={p.pending} onClick={() => p.onCount(c)}>
              {B.eachOption(c)}
            </Button>
          ))}
        </div>
      </fieldset>
      {p.blocked ? (
        <p role="alert" className="rounded-lg border p-3 text-sm" data-slot="studio-batch-blocked">
          {p.blocked}
        </p>
      ) : (
        <QuoteBlock state={p.quote.state} peaks={q?.totalPeaks} kind="previews" units={q?.main.units} left={p.left} onRetry={p.onRetryQuote} />
      )}
      {ready && q && <WhyThisPrice quote={q} />}
      {p.refusal && <RefusalNote refusal={p.refusal} onRetry={p.onMake} onRequote={p.onRequote} makeInstead={p.makeInstead} />}
      {!p.canMake && <p className="text-sm text-muted-foreground">{B.askEditor}</p>}
      <div className="mt-auto flex gap-2 pb-[env(safe-area-inset-bottom)]">
        <Button type="button" variant="ghost" className="h-12" onClick={p.onBack}>
          {B.back}
        </Button>
        <Button type="button" className="h-12 flex-1" disabled={!ready || !p.canMake || p.pending || !!p.blocked} aria-busy={p.pending} onClick={p.onMake}>
          {p.pending ? B.starting : B.make(p.products)}
        </Button>
      </div>
    </div>
  );
}

/**
 * Start a batch from the app (UX spec S4 batch mode, S16). Two steps in sheets: pick the products (a multi-select, up to the batch cap), then
 * the one price for all of them. Pressing it creates the batch and goes to the grid. `initialIds` skips the picking (the catalog's own
 * multi-select). It is only ever opened from `MakeForSeveralButton`, which needs Pro tools and a role that can spend.
 */
export function BatchStartFlow({ open, onClose, initialIds }: { open: boolean; onClose: () => void; initialIds?: string[] }) {
  const mobile = useIsMobile();
  const router = useRouter();
  const availability = useStudioAvailability();
  const left = usePeaksLeft();
  const { canMake } = useStudioAbilities();
  const [picked, setPicked] = useState<string[] | null>(null);
  const [step, setStep] = useState<"pick" | "confirm" | null>(null);
  const [count, setCount] = useState<3 | 4>(DEFAULT_BATCH_COUNT);
  const [refusal, setRefusal] = useState<StudioRefusal | undefined>();
  const [off, setOff] = useState(false);
  const create = useCreateBatch();

  const ids = batchIds(picked ?? initialIds ?? []);
  const where = step ?? (initialIds && initialIds.length > 0 ? "confirm" : "pick");
  const previewsOn = availability.capabilities.previews === "on";
  const body = ids.length > 0 ? batchBody(ids, count) : null;
  const quote = useBatchQuote(body, open && where === "confirm" && previewsOn && !off);
  // Off by the capability read, by a refused press, or by the quote itself answering 409 not-released: the same designed card, never a spinner.
  const comingSoon = off || !previewsOn || quote.notReleased;
  const apiError = quote.error instanceof ApiError ? quote.error : undefined;
  const blocked = apiError?.code === "PHOTO_MISSING" ? studioRefusal(apiError).text : undefined;
  const instead = refusal?.code === "CREDITS_EXHAUSTED" ? affordableProducts(refusal.left, quote.quote, ids.length) : undefined;

  const reset = () => {
    setPicked(null);
    setStep(null);
    setRefusal(undefined);
    setOff(false);
    onClose();
  };

  const make = () => {
    setRefusal(undefined);
    create.mutate(
      { body: batchBody(ids, count), receipts: receiptsOf(quote.quote) },
      {
        onSuccess: (r) => {
          toast.success(B.started);
          reset();
          router.push(`/dashboard/studio/batches/${encodeURIComponent(r.batchId)}`);
        },
        onError: (e) => {
          const r = studioRefusal(e, "Making previews");
          if (r.tone === "not_released") setOff(true);
          else setRefusal(r);
        },
      },
    );
  };

  if (!open) return null;
  if (where === "pick") {
    return (
      <ProductPicker
        open
        batch
        onOpenChange={(o) => {
          if (!o) reset();
        }}
        selected={ids}
        onChange={(next) => setPicked(next)}
        doneLabel={ids.length > 0 ? B.next(ids.length) : B.needOne}
        onDone={() => setStep("confirm")}
      />
    );
  }
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) reset();
      }}
    >
      <SheetContent side={mobile ? "bottom" : "right"} className={mobile ? "max-h-[92dvh] gap-3 overflow-y-auto p-4" : "gap-3 p-4 sm:max-w-lg"}>
        <SheetHeader className="p-0 text-start">
          <SheetTitle>{B.confirmTitle}</SheetTitle>
          <SheetDescription className="sr-only">{B.confirmDescription(ids.length, count)}</SheetDescription>
        </SheetHeader>
        <BatchConfirmView
          products={ids.length}
          count={count}
          onCount={(c) => {
            setCount(c);
            setRefusal(undefined);
          }}
          comingSoon={comingSoon}
          quote={{ state: quote.quote ? "quote" : quote.unavailable ? "unavailable" : "loading", value: quote.quote }}
          blocked={blocked}
          left={left}
          canMake={canMake}
          pending={create.isPending}
          refusal={refusal}
          makeInstead={
            instead !== undefined
              ? {
                  label: STUDIO_COPY.refusal.makeInstead(instead, instead === 1 ? "product" : "products"),
                  onPress: () => {
                    setPicked(ids.slice(0, instead));
                    setRefusal(undefined);
                  },
                }
              : undefined
          }
          onMake={make}
          onBack={() => (initialIds ? reset() : setStep("pick"))}
          onClose={reset}
          onRetryQuote={() => void quote.refetch()}
          onRequote={() => {
            setRefusal(undefined);
            void quote.refetch();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The entry button, on Studio home and in the catalog: "Make previews for several". Pro tools only (a novice never sees it; a viewer cannot
 * spend).
 */
export function MakeForSeveralButton({ onPress, className }: { onPress: () => void; className?: string }) {
  const { proTools } = useStudioPrefs();
  const { canMake } = useStudioAbilities();
  if (!canStartBatch({ proTools, canMake })) return null;
  return (
    <Button type="button" variant="outline" className={className ?? "h-11"} onClick={onPress}>
      <Layers aria-hidden="true" className="size-4" />
      {B.open}
    </Button>
  );
}

/** The entry on Studio home: the button, and the flow it opens (the picker first). Nothing at all unless Pro tools are on and the person can spend. */
export function BatchStartEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MakeForSeveralButton onPress={() => setOpen(true)} />
      {open && <BatchStartFlow open onClose={() => setOpen(false)} />}
    </>
  );
}
