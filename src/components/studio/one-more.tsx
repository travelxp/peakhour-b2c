"use client";

import { useState } from "react";
import { toast } from "sonner";
import { QuotedStep, type QuotedTweak } from "@/components/studio/tweak-panel";
import { usePeaksLeft } from "@/components/studio/studio-quote";
import { usePress, usePressQuote } from "@/hooks/use-studio-flow";
import { useStudioAvailability } from "@/hooks/use-studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { receiptsOf, studioRefusal, type StudioRefusal } from "@/lib/studio-flow";

/**
 * "Make one more preview" (UX spec S7): a quoted press of one unit, so it shows its own price and waits for a confirm. Off (with "Coming
 * soon") while previews are not available; a refusal is written inside the step and nothing is charged.
 */
export function OneMore({ id, canMake }: { id: string; canMake: boolean }) {
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState(false);
  const [refusal, setRefusal] = useState<StudioRefusal | undefined>();
  const availability = useStudioAvailability();
  const left = usePeaksLeft();
  const press = usePress();
  const quote = usePressQuote(id, "more", undefined, open);
  if (!canMake) return null;
  const q: QuotedTweak = {
    available: availability.capabilities.previews === "on" && !off && !quote.notReleased,
    open,
    onOpen: () => setOpen(true),
    onCancel: () => {
      setOpen(false);
      setRefusal(undefined);
    },
    onClearRefusal: () => setRefusal(undefined),
    onConfirm: () => {
      setRefusal(undefined);
      press.mutate(
        { id, kind: "more", receipts: receiptsOf(quote.quote) },
        {
          onSuccess: () => {
            setOpen(false);
            toast.success(STUDIO_COPY.tweak.started);
          },
          onError: (e) => {
            const r = studioRefusal(e, "Making previews");
            if (r.tone === "not_released") setOff(true);
            else setRefusal(r);
          },
        },
      );
    },
    quote: {
      state: quote.quote ? "quote" : quote.unavailable ? "unavailable" : "loading",
      peaks: quote.quote?.totalPeaks,
      onRetry: () => void quote.refetch(),
    },
    left,
    pending: press.isPending,
    refusal,
  };
  return (
    <div className="max-w-sm">
      <QuotedStep title={STUDIO_COPY.creative.makeOneMore} hint={STUDIO_COPY.quote.chargedOnlyIfItWorks} q={q} />
    </div>
  );
}
