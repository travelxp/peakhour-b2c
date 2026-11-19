"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Image as NoPostIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { QueryError } from "@/components/dashboard/query-error";
import { EmptyState } from "@/components/molecules/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AllDroppedCard,
  DroppedLine,
  EarlierPreviews,
  FailedCard,
  FinalTile,
  latestFinals,
  MakingCard,
  NotForMeDialog,
  PreviewGrid,
  PreviewViewer,
} from "@/components/studio/creative-sections";
import { ComingSoon } from "@/components/studio/coming-soon";
import { FinalReview } from "@/components/studio/final-review";
import { PlatformSheet } from "@/components/studio/platform-sheet";
import { OneMore } from "@/components/studio/one-more";
import { usePeaksLeft } from "@/components/studio/studio-quote";
import { TweakPanelView, TweakSheet } from "@/components/studio/tweak-panel";
import { useCancelJob } from "@/hooks/use-jobs";
import {
  useCreative,
  useHeart,
  usePress,
  usePressQuote,
  useSkip,
  useStudioAbilities,
  useStudioPalette,
  useTweak,
} from "@/hooks/use-studio-flow";
import { useStudioAvailability, useStudioPrefs } from "@/hooks/use-studio";
import type { CreativeView, PreviewView, TweakOp } from "@/lib/api/creative-studio";
import { ideasFeedStatus, STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import {
  creativePhase,
  finalsSummary,
  isActionable,
  isShownTile,
  makingProgress,
  receiptsOf,
  STUDIO_PATHS,
  studioRefusal,
  type StudioRefusal,
  type Swatch,
} from "@/lib/studio-flow";

const C = STUDIO_COPY.creative;
const F = STUDIO_COPY.final;

const planHref = (id: string) => `${STUDIO_ROUTES.new}?c=${encodeURIComponent(id)}`;

/** The tweak sheet's contents: the free changes, and the two quoted ones with their own price. */
function TweakContainer({
  view,
  preview,
  alt,
  canMake,
}: {
  view: CreativeView;
  preview: PreviewView;
  alt: string;
  canMake: boolean;
}) {
  const creativeId = view.id;
  const tweak = useTweak(creativeId);
  const press = usePress();
  // The api's own list is the palette (the keys the tweak resolves). The brand kit is asked for only by an api that predates the field.
  const kitPalette = useStudioPalette(!view.palette?.length).data;
  const palette = view.palette?.length ? view.palette : (kitPalette ?? []);
  const availability = useStudioAvailability();
  const { proTools } = useStudioPrefs();
  const left = usePeaksLeft();
  const [bgOpen, setBgOpen] = useState(false);
  const [wordOpen, setWordOpen] = useState(false);
  const [bgOff, setBgOff] = useState(false);
  const [wordOff, setWordOff] = useState(false);
  const [bgRefusal, setBgRefusal] = useState<StudioRefusal | undefined>();
  const [wordRefusal, setWordRefusal] = useState<StudioRefusal | undefined>();
  const [error, setError] = useState<StudioRefusal | undefined>();
  const [colour, setColour] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState("");
  const bgQuote = usePressQuote(creativeId, "new_background", 1, bgOpen);
  const wordQuote = usePressQuote(creativeId, "wording", undefined, wordOpen);

  const run = (op: TweakOp) => {
    setError(undefined);
    tweak.mutate(
      { previewId: preview.id, baseVersion: preview.layoutVersion, op },
      {
        onSuccess: () => setAnnouncement(op.op === "undo" ? C.undone : ""),
        onError: (e) => setError(studioRefusal(e)),
      },
    );
  };

  // A colour is applied to the headline and to the button plate: two changes, the second on the version the first made.
  const onColour = async (s: Swatch) => {
    setError(undefined);
    let version = preview.layoutVersion;
    try {
      const first = await tweak.mutateAsync({ previewId: preview.id, baseVersion: version, op: { op: "colour.set", role: "headline", paletteKey: s.key } });
      // The headline is changed: that is the colour the merchant sees chosen, whatever the button does.
      setColour(s.key);
      version = first.layoutVersion;
    } catch (e) {
      setError(studioRefusal(e));
      return;
    }
    try {
      await tweak.mutateAsync({ previewId: preview.id, baseVersion: version, op: { op: "colour.set", role: "plate", paletteKey: s.key } });
    } catch (e) {
      // A picture with no button plate has nothing more to colour: not an error. Anything else is said, and the headline stays changed.
      if (!(e instanceof ApiError && e.code === "LAYER_MISSING")) setError(studioRefusal(e));
    }
  };

  const quoted = (kind: "new_background" | "wording") => {
    const isBg = kind === "new_background";
    const q = isBg ? bgQuote : wordQuote;
    const open = isBg ? bgOpen : wordOpen;
    const setOpen = isBg ? setBgOpen : setWordOpen;
    const setRefusal = isBg ? setBgRefusal : setWordRefusal;
    const setOff = isBg ? setBgOff : setWordOff;
    const switchedOn = isBg ? availability.capabilities.previews === "on" : availability.capabilities.wordOptions === "on";
    return {
      available: switchedOn && !(isBg ? bgOff : wordOff) && !q.notReleased,
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
          { id: creativeId, kind, previewId: preview.id, receipts: receiptsOf(q.quote) },
          {
            onSuccess: () => {
              setOpen(false);
              toast.success(STUDIO_COPY.tweak.started);
            },
            onError: (e) => {
              const r = studioRefusal(e, isBg ? "Another background" : "New wording");
              if (r.tone === "not_released") setOff(true);
              else setRefusal(r);
            },
          },
        );
      },
      quote: {
        state: q.quote ? ("quote" as const) : q.unavailable ? ("unavailable" as const) : ("loading" as const),
        peaks: q.quote?.totalPeaks,
        onRetry: () => void q.refetch(),
      },
      left,
      pending: press.isPending,
      refusal: isBg ? bgRefusal : wordRefusal,
    };
  };

  return (
    <TweakPanelView
      preview={preview}
      alt={alt}
      palette={palette}
      products={view.brief.productIds.map((id) => ({ id, title: view.previews.find((p) => p.productId === id)?.productTitle ?? "Product" }))}
      canMake={canMake}
      pending={tweak.isPending}
      error={error}
      chosenColour={colour}
      proTools={proTools}
      background={quoted("new_background")}
      wording={quoted("wording")}
      onOp={run}
      onColour={(s) => void onColour(s)}
      announcement={announcement}
    />
  );
}

/**
 * The creative page (UX spec S6 to S8, S10): driven by the creative's status. A plan that has no previews yet goes back to the plan screen;
 * previews being made show progress and fill in tile by tile; failed and all-dropped sets say nothing was charged; ready previews show the
 * grid with the heart and tweak controls; finals show where each is (waiting its turn, making, checking, ready, or did not match).
 * One read, polled while anything is being made.
 */
export function CreativeWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const q = useCreative(id);
  const { canMake } = useStudioAbilities();
  const left = usePeaksLeft();
  const heart = useHeart(id);
  const skip = useSkip(id);
  const press = usePress();
  const cancel = useCancelJob();
  const [announcement, setAnnouncement] = useState("");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [tweakId, setTweakId] = useState<string | null>(null);
  const [skipId, setSkipId] = useState<string | null>(null);
  const [retryRefusal, setRetryRefusal] = useState<StudioRefusal | undefined>();
  const [releasedOff, setReleasedOff] = useState(false);
  const [postFinalId, setPostFinalId] = useState<string | null>(null);
  const view = q.data;
  const phase = view ? creativePhase(view) : undefined;

  // Announce each preview as it lands: "Preview 2 ready."
  const landedBefore = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!view) return;
    const landed = view.previews.filter((p) => p.state !== "rendering" && p.state !== "failed").map((p) => p.id);
    const before = landedBefore.current;
    landedBefore.current = new Set(landed);
    if (!before) return;
    const fresh = landed.filter((x) => !before.has(x));
    if (fresh.length > 0) setAnnouncement(C.previewReady(landed.indexOf(fresh[fresh.length - 1]!) + 1));
  }, [view]);

  // A plan with no previews yet belongs on the plan screen.
  useEffect(() => {
    if (phase === "brief") router.replace(planHref(id));
  }, [phase, id, router]);

  const failedQuote = usePressQuote(id, "previews", view?.brief.count, phase === "failed" && canMake);
  const status = ideasFeedStatus(q);
  const shown = useMemo(() => (view ? view.previews.filter(isShownTile) : []), [view]);
  const landed = shown.filter((p) => p.state !== "rendering" && p.state !== "failed");
  const byId = (pid: string | null) => (pid ? view?.previews.find((p) => p.id === pid) : undefined);

  if (status === "loading" || phase === "brief") {
    return <Skeleton aria-busy="true" aria-label={C.loading} className="h-80 rounded-lg" />;
  }
  if (status === "offline") return <QueryError what={C.error.what} kind="offline" />;
  if (!view) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <EmptyState icon={NoPostIcon} title={C.notFound.title} description={C.notFound.description} action={{ label: C.backToStudio, href: STUDIO_ROUTES.home }} />;
    }
    return <QueryError what={C.error.what} onRetry={() => void q.refetch()} />;
  }

  const onHeart = (p: PreviewView, on: boolean) => {
    heart.mutate(
      { previewId: p.id, on },
      {
        onSuccess: (r) => setAnnouncement(on ? C.heartAdded(r.shortlistCount) : C.heartRemoved(r.shortlistCount)),
        onError: (e) => toast.error(studioRefusal(e).text),
      },
    );
  };

  const activeJob = view.jobs.find((j) => j.id);
  const progress = makingProgress(view);
  const tiles = shown.length;
  const pendingTiles = phase === "making" ? Math.max(0, progress.total - tiles) : 0;
  const tweakPreview = byId(tweakId);
  const viewerIndex = Math.max(0, landed.findIndex((p) => p.id === viewerId));
  const finals = latestFinals(view.finals);
  const summary = finalsSummary(finals);
  const photoAlt = (pid: string) => {
    const p = view.previews.find((x) => x.id === pid);
    return F.alt(p?.headline ?? "", p?.productTitle ?? "");
  };
  const previewAlt = (pid: string) => {
    const p = view.previews.find((x) => x.id === pid);
    return STUDIO_COPY.finalReview.previewAlt(p?.headline ?? "", p?.productTitle ?? "");
  };
  const postFinal = postFinalId ? finals.find((f) => f.id === postFinalId) : undefined;
  const firstActionable = view.previews.find(isActionable);

  const retryPreviews = () => {
    setRetryRefusal(undefined);
    press.mutate(
      { id, kind: "previews", count: view.brief.count, receipts: receiptsOf(failedQuote.quote) },
      {
        onError: (e) => {
          const r = studioRefusal(e, "Making previews");
          // Switched off while the merchant was here: the designed card, no error and no toast.
          if (r.tone === "not_released") setReleasedOff(true);
          else setRetryRefusal(r);
        },
      },
    );
  };

  if (view.kind === "words") {
    return (
      <ComingSoon
        title={STUDIO_COPY.wordsOnly.title}
        description={STUDIO_COPY.wordsOnly.description}
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link href={STUDIO_ROUTES.home}>{STUDIO_COPY.wordsOnly.back}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4" data-slot="studio-creative" data-phase={phase}>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {phase === "making" && (
        <MakingCard
          done={progress.done}
          total={progress.total}
          stopping={cancel.isPending}
          onStop={activeJob?.id && canMake ? () => cancel.mutate(activeJob.id!, { onSuccess: () => toast(C.stopped(progress.done)) }) : undefined}
        />
      )}

      {phase === "failed" && (releasedOff || failedQuote.notReleased) && (
        <ComingSoon
          title={STUDIO_COPY.comingSoon.previews.title}
          description={STUDIO_COPY.comingSoon.previews.description}
          actions={
            <Button asChild variant="outline" className="h-11">
              <Link href={planHref(id)}>{C.allFailed.backToPlan}</Link>
            </Button>
          }
        />
      )}
      {phase === "failed" && !releasedOff && !failedQuote.notReleased && (
        <FailedCard
          quote={{ state: failedQuote.quote ? "quote" : failedQuote.unavailable ? "unavailable" : "loading", peaks: failedQuote.quote?.totalPeaks }}
          left={left}
          count={view.brief.count}
          canMake={canMake}
          pending={press.isPending}
          refusal={retryRefusal}
          planHref={planHref(id)}
          onTryAgain={retryPreviews}
          onRetryQuote={() => void failedQuote.refetch()}
          makeLabel={STUDIO_COPY.brief.make(view.brief.count)}
        />
      )}
      {phase === "all_dropped" && <AllDroppedCard notes={view.safetySummary.notes} planHref={planHref(id)} />}

      {(phase === "making" || phase === "ready") && (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{C.caption}</h2>
            <p className="text-sm text-muted-foreground">{C.hint}</p>
          </div>
          <PreviewGrid
            previews={shown}
            pending={pendingTiles}
            canMake={canMake}
            onHeart={onHeart}
            onOpen={(p) => setViewerId(p.id)}
            onTweak={(p) => setTweakId(p.id)}
            onSkip={(p) => setSkipId(p.id)}
          />
          {phase === "ready" && <p className="text-sm text-muted-foreground">{STUDIO_COPY.creative.disclosure}</p>}
          <DroppedLine
            count={view.safetySummary.dropped}
            notes={view.safetySummary.notes}
            onChangeWording={firstActionable && canMake ? () => setTweakId(firstActionable.id) : undefined}
          />
          <EarlierPreviews previews={view.earlier} />
        </>
      )}

      {finals.length > 0 && (
        <section aria-labelledby="studio-finals-title" className="space-y-3">
          <h2 id="studio-finals-title" className="text-lg font-semibold">
            {F.title}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {finals.map((f) => (
              <li key={f.id}>
                <FinalTile
                  final={f}
                  alt={photoAlt(f.previewId)}
                  canMake={canMake}
                  picture={
                    f.state === "ready" ? (
                      <FinalReview
                        creativeId={id}
                        finalId={f.id}
                        finalAlt={photoAlt(f.previewId)}
                        previewAlt={previewAlt(f.previewId)}
                        canPost={canMake}
                        onChoose={() => setPostFinalId(f.id)}
                      />
                    ) : undefined
                  }
                  onTryAgain={() => {
                    const p = byId(f.previewId);
                    if (p) onHeart(p, true);
                    router.push(STUDIO_PATHS.shortlist);
                  }}
                  onTweakPreview={() => setTweakId(f.previewId)}
                />
              </li>
            ))}
          </ul>
          {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        </section>
      )}

      {phase === "ready" && landed.some(isActionable) && <OneMore id={id} canMake={canMake} />}

      <PlatformSheet
        open={postFinal !== undefined}
        onOpenChange={(o) => !o && setPostFinalId(null)}
        view={view}
        finalId={postFinalId ?? ""}
        headline={view.previews.find((x) => x.id === postFinal?.previewId)?.headline ?? ""}
        canPost={canMake}
      />

      <PreviewViewer
        previews={landed}
        index={viewerIndex}
        open={viewerId !== null && landed.length > 0}
        canMake={canMake}
        onIndex={(i) => setViewerId(landed[i]?.id ?? null)}
        onClose={() => setViewerId(null)}
        onHeart={onHeart}
        onTweak={(p) => {
          setViewerId(null);
          setTweakId(p.id);
        }}
        onSkip={(p) => {
          setViewerId(null);
          setSkipId(p.id);
        }}
      />

      <TweakSheet open={!!tweakPreview} onOpenChange={(o) => !o && setTweakId(null)}>
        {tweakPreview && (
          <TweakContainer
            view={view}
            preview={tweakPreview}
            canMake={canMake}
            alt={C.previewAlt(landed.indexOf(tweakPreview) + 1, landed.length, tweakPreview.headline ?? "", tweakPreview.productTitle ?? "")}
          />
        )}
      </TweakSheet>

      <NotForMeDialog
        open={skipId !== null}
        onOpenChange={(o) => !o && setSkipId(null)}
        pending={skip.isPending}
        onConfirm={(reasons) => {
          if (!skipId) return;
          skip.mutate(
            { previewId: skipId, reasons },
            {
              onSuccess: () => {
                setSkipId(null);
                setAnnouncement(C.skipped);
              },
              onError: (e) => toast.error(studioRefusal(e).text),
            },
          );
        }}
      />
      <p className="text-xs text-muted-foreground">
        <Link href={STUDIO_PATHS.shortlist} className="underline underline-offset-2">
          {STUDIO_COPY.shortlist.list}
        </Link>
      </p>
    </div>
  );
}

