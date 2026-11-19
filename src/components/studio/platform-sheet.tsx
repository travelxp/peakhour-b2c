"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PostStep, type PostVersion } from "@/components/studio/post-step";
import { SizesStepView } from "@/components/studio/sizes-step";
import { usePeaksLeft, WhyTheseSizes } from "@/components/studio/studio-quote";
import { usePeaksQuote } from "@/hooks/use-peaks-quote";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConnectedChannels, useExtendVersions, usePlacements, useRenderVersions } from "@/hooks/use-studio-flow";
import { useStudioAvailability, useStudioPrefs } from "@/hooks/use-studio";
import { STUDIO_ACTIONS } from "@/lib/api/peaks";
import type { CreativeView, VersionRow } from "@/lib/api/creative-studio";
import { affordableUnits, studioRefusal, type StudioRefusal } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import {
  defaultTicked,
  extendCount,
  isTickable,
  makeSizes,
  sizeRows,
  STUDIO_CHANNELS,
} from "@/lib/studio-publish";
import { cn } from "@/lib/utils";

const Z = STUDIO_COPY.sizes;

/**
 * "Choose where to post" (UX spec S12 and S13) as one sheet with two steps: the sizes (free, or quoted for a size that needs more background),
 * then the caption, the time and the act that publishes. Sizes come only from verified ad-spec rows; the one final is cut into each of them.
 */
export function PlatformSheet({
  open,
  onOpenChange,
  view,
  finalId,
  headline,
  canPost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: CreativeView;
  finalId: string;
  /** The final's headline: the caption when the api has none. */
  headline: string;
  canPost: boolean;
}) {
  const mobile = useIsMobile();
  const [step, setStep] = useState<"sizes" | "post">("sizes");
  const close = (o: boolean) => {
    if (!o) setStep("sizes");
    onOpenChange(o);
  };
  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 p-4", mobile ? "h-[92dvh]" : "sm:max-w-lg")}>
        <SheetHeader className="p-0 text-start">
          <SheetTitle>{step === "sizes" ? Z.title : STUDIO_COPY.post.title}</SheetTitle>
          <SheetDescription className="flex items-center">
            {step === "sizes" ? Z.description : STUDIO_COPY.post.description}
            {step === "sizes" && <WhyTheseSizes />}
          </SheetDescription>
        </SheetHeader>
        {open && <PlatformBody step={step} setStep={setStep} view={view} finalId={finalId} headline={headline} canPost={canPost} onClose={() => close(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function PlatformBody({
  step,
  setStep,
  view,
  finalId,
  headline,
  canPost,
  onClose,
}: {
  step: "sizes" | "post";
  setStep: (s: "sizes" | "post") => void;
  view: CreativeView;
  finalId: string;
  headline: string;
  canPost: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const availability = useStudioAvailability();
  const { proTools } = useStudioPrefs();
  const left = usePeaksLeft();
  const connected = useConnectedChannels();
  const connectedKeys = useMemo(() => connected.data ?? [], [connected.data]);
  const channels = STUDIO_CHANNELS.map((c) => ({ ...c, connected: connectedKeys.includes(c.key) }));
  // Every connected channel is chosen to start with: choosing sizes posts nothing.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const chosenChannels = useMemo(() => new Set(connectedKeys.filter((k) => !off.has(k))), [connectedKeys, off]);
  const chosenList = useMemo(() => [...chosenChannels], [chosenChannels]);
  const placements = usePlacements(chosenList, view.brief.format, finalId, step === "sizes");
  const mine = useMemo<VersionRow[]>(() => view.versions.filter((v) => v.finalId === finalId), [view.versions, finalId]);
  const rows = useMemo(() => sizeRows(placements.data ?? [], mine), [placements.data, mine]);
  const extendOn = availability.capabilities.extend === "on";

  // What is ticked: the free sizes to start with, then the merchant's choices. A size that stops being tickable (a teammate's press, a failure) drops out.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const ticked = useMemo(() => {
    const base = picked ?? defaultTicked(rows);
    return new Set(rows.filter((r) => base.has(r.placement.key) && isTickable(r) && (extendOn || r.state === "ready")).map((r) => r.placement.key));
  }, [picked, rows, extendOn]);
  const nExtend = extendCount(rows, ticked);
  const unitQuote = usePeaksQuote(STUDIO_ACTIONS.extendSize, step === "sizes" && extendOn && rows.some((r) => r.state === "needs_extend" || r.state === "extend_failed"), { units: 1 });
  const totalQuote = usePeaksQuote(STUDIO_ACTIONS.extendSize, step === "sizes" && extendOn && nExtend > 0, { units: Math.max(1, nExtend) });

  const render = useRenderVersions(view.id, finalId);
  const extend = useExtendVersions(view.id, finalId);
  const [refusal, setRefusal] = useState<StudioRefusal | undefined>();
  const [working, setWorking] = useState(false);
  const [postVersions, setPostVersions] = useState<PostVersion[]>([]);

  // A closed and reopened sheet starts again from the free sizes.
  useEffect(() => {
    setPicked(null);
  }, [finalId]);

  const toggleChannel = (key: string) => {
    const next = new Set(off);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOff(next);
  };
  const toggleRow = (key: string) => {
    const next = new Set(ticked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicked(next);
    setRefusal(undefined);
  };

  const unitPeaks = unitQuote.quote?.peaks;
  const perSize = totalQuote.quote && nExtend > 0 ? totalQuote.quote.peaks / nExtend : unitPeaks;
  const instead = refusal?.code === "CREDITS_EXHAUSTED" ? affordableUnits(refusal.left, perSize, nExtend) : undefined;

  const goOn = async () => {
    setRefusal(undefined);
    setWorking(true);
    try {
      const r = await makeSizes({
        rows,
        ticked,
        render: async (keys) => (await render.mutateAsync(keys)).versions,
        extend: (keys) => extend.mutateAsync({ placementKeys: keys, quoteToken: totalQuote.quote?.token }),
        quotedUnits: totalQuote.quote ? nExtend : 0,
      });
      // The draw found a different number of sizes that need more background than the price covers: nothing was started. The sizes now show
      // their own state, and the price is asked again for the new count.
      if (r.requote) {
        void qc.invalidateQueries({ queryKey: ["peaks-quote"] });
        setRefusal({ code: "QUOTE_NOT_HONOURED", tone: "error", text: STUDIO_COPY.refusal.priceChangedNoFigure, action: "requote" });
        return;
      }
      // A refusal of the quoted step stops here and says why; the free sizes stay chosen.
      if (r.extendError !== undefined) {
        setRefusal(studioRefusal(r.extendError, "Making more background"));
        return;
      }
      if (r.ready.length > 0) {
        setPostVersions(r.ready.map((v) => ({ id: v.id, channel: v.channel, label: v.label, width: v.width, height: v.height })));
        setStep("post");
      } else if (!r.extendStarted) {
        // Nothing can go on and nothing was started (a size is being made by someone else, or came back in a state that cannot be posted): say so.
        setRefusal({ code: "NOT_READY", tone: "error", text: Z.nothingReady, action: "retry" });
      }
    } catch (e) {
      setRefusal(studioRefusal(e));
    } finally {
      setWorking(false);
    }
  };

  if (connected.isError) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm">
        <p>{Z.loadFailed}</p>
        <Button type="button" size="sm" variant="outline" className="h-11" onClick={() => void connected.refetch()}>
          {STUDIO_COPY.quote.retry}
        </Button>
      </div>
    );
  }

  if (step === "post") {
    return (
      <PostStep
        creativeId={view.id}
        versions={postVersions}
        headlineFallback={headline}
        onBack={() => setStep("sizes")}
        onClose={onClose}
      />
    );
  }

  return (
    <SizesStepView
      channels={channels}
      chosenChannels={chosenChannels}
      onToggleChannel={toggleChannel}
      status={placements.isError ? "error" : chosenList.length === 0 ? (connected.isFetching ? "loading" : "ready") : placements.data ? "ready" : "loading"}
      rows={rows}
      ticked={ticked}
      onToggleRow={toggleRow}
      extendOn={extendOn}
      unitPeaks={unitPeaks}
      extendTicked={nExtend}
      quote={{
        state: totalQuote.quote ? "quote" : totalQuote.unavailable ? "unavailable" : "loading",
        peaks: totalQuote.quote?.peaks,
        free: totalQuote.quote?.free,
      }}
      left={left}
      proTools={proTools}
      working={working}
      refusal={refusal}
      makeInstead={
        instead !== undefined
          ? {
              label: STUDIO_COPY.refusal.makeInstead(instead, instead === 1 ? "size" : "sizes"),
              onPress: () => {
                const keep = rows.filter((r) => ticked.has(r.placement.key) && (r.state === "needs_extend" || r.state === "extend_failed")).slice(0, instead).map((r) => r.placement.key);
                const free = rows.filter((r) => ticked.has(r.placement.key) && r.state === "ready").map((r) => r.placement.key);
                setPicked(new Set([...free, ...keep]));
                setRefusal(undefined);
              },
            }
          : undefined
      }
      stillMaking={rows.filter((r) => r.state === "extending").length}
      canPost={canPost}
      onRetry={() => void placements.refetch()}
      onContinue={() => void goOn()}
      onRequote={() => {
        setRefusal(undefined);
        void qc.invalidateQueries({ queryKey: ["peaks-quote"] });
      }}
    />
  );
}
