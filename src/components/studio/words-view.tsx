"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AllDroppedCard, DroppedLine } from "@/components/studio/creative-sections";
import { ComingSoon } from "@/components/studio/coming-soon";
import { PostStep } from "@/components/studio/post-step";
import { HeartButton } from "@/components/studio/preview-card";
import { QuoteBlock, usePeaksLeft, type QuoteBlockState } from "@/components/studio/studio-quote";
import { RefusalNote } from "@/components/studio/refusal-note";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConnectedChannels, useHeart, usePress, usePressQuote, useSkip, useStudioAbilities } from "@/hooks/use-studio-flow";
import type { CreativeView, PreviewView, WordsSent } from "@/lib/api/creative-studio";
import { creativePhase, isActionable, makingProgress, receiptsOf, STUDIO_PATHS, studioRefusal, type StudioRefusal } from "@/lib/studio-flow";
import { channelLabel, STUDIO_CHANNELS } from "@/lib/studio-publish";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const W = STUDIO_COPY.words;

/** "Posted on Facebook, Instagram" / "Scheduled on LinkedIn": what a used option says about itself (posted wins), or null while it has gone nowhere. */
export function sentLine(sent: WordsSent | null | undefined): string | null {
  if (!sent) return null;
  const names = (cs: string[]) => cs.map(channelLabel).join(", ");
  if (sent.posted.length > 0) return W.sent.posted(names(sent.posted));
  if (sent.scheduled.length > 0) return W.sent.scheduled(names(sent.scheduled));
  return null;
}

/** One option card (S20): the headline, the main text, the description, the button and the hashtags, with the heart and "Not for me". */
export function WordsCardView({
  preview,
  index,
  total,
  canMake,
  onHeart,
  onSkip,
  onUse,
}: {
  preview: PreviewView;
  index: number;
  total: number;
  canMake: boolean;
  onHeart: (p: PreviewView, on: boolean) => void;
  onSkip: (p: PreviewView) => void;
  onUse: (p: PreviewView) => void;
}) {
  const card = preview.words;
  if (!card) return null;
  const liked = preview.liked;
  const label = W.optionLabel(index + 1, total);
  return (
    <article
      aria-label={label}
      data-slot="studio-words-card"
      data-liked={liked}
      className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4", liked && "border-primary ring-1 ring-primary")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{label}</Badge>
          {sentLine(preview.sent) && (
            <Badge variant="outline" data-slot="studio-words-used">
              {sentLine(preview.sent)}
            </Badge>
          )}
        </div>
        <HeartButton
          pressed={liked}
          label={W.heartLabel(index + 1)}
          disabled={!canMake}
          title={canMake ? undefined : STUDIO_COPY.refusal.askAnEditorToShortlist}
          onToggle={() => onHeart(preview, !liked)}
        />
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{W.headline}</dt>
          <dd className="text-base font-semibold">{card.headline}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{W.mainText}</dt>
          <dd className="whitespace-pre-line">{card.primaryText}</dd>
        </div>
        {card.description && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">{W.description}</dt>
            <dd>{card.description}</dd>
          </div>
        )}
        {card.cta && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">{W.button}</dt>
            <dd>{card.cta}</dd>
          </div>
        )}
        {card.hashtags.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">{W.hashtags}</dt>
            <dd className="text-muted-foreground">{card.hashtags.map((t) => `#${t}`).join(" ")}</dd>
          </div>
        )}
      </dl>
      {preview.safety?.status === "fixed" && <p className="text-xs text-muted-foreground">{preview.safety.note || W.adjusted}</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={!canMake || !liked} onClick={() => onUse(preview)}>
          {sentLine(preview.sent) ? W.sent.useAgain : W.use}
        </Button>
        <Button type="button" variant="ghost" className="h-11" disabled={!canMake} onClick={() => onSkip(preview)}>
          {W.notForMe}
        </Button>
      </div>
    </article>
  );
}

export interface WordsViewProps {
  phase: ReturnType<typeof creativePhase>;
  cards: PreviewView[];
  /** Cards still being written (tiles drawn as skeletons). */
  pending: number;
  progress: { done: number; total: number };
  canMake: boolean;
  droppedCount: number;
  droppedNotes: string[];
  quote: { state: QuoteBlockState; peaks?: number; onRetry: () => void };
  left: number | null;
  /** Writing is switched off (its own switch, never the picture maker's): the designed coming-soon card, no price, no button. */
  notReleased: boolean;
  starting: boolean;
  refusal?: StudioRefusal;
  planHref: string;
  onHeart: (p: PreviewView, on: boolean) => void;
  onSkip: (p: PreviewView) => void;
  onUse: (p: PreviewView) => void;
  /** Write a whole new set (the "more" press) or try again after a failure: one price, one press. */
  onWrite: () => void;
  onRequote: () => void;
}

/**
 * The words-only creative (UX spec S20), drawn from what it is told so every state can be rendered and tested: being written, nothing came
 * through (not charged), every card held back by the Safety check (not charged), the cards with the heart and the hand-off, and switched off.
 * "Options" is the word, never "previews"; there is no Make final (nothing to enlarge).
 */
export function WordsView(p: WordsViewProps) {
  const makeBar = (
    <section aria-label={W.makeMore} className="space-y-2 rounded-lg border bg-card p-4" data-slot="studio-words-more">
      <QuoteBlock state={p.quote.state} peaks={p.quote.peaks} kind="total" left={p.left} onRetry={p.quote.onRetry} />
      {!p.canMake && <p className="text-sm text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToMake}</p>}
      {p.refusal && <RefusalNote refusal={p.refusal} onRetry={p.onWrite} onRequote={p.onRequote} />}
      <Button type="button" variant="outline" className="h-11" disabled={!p.canMake || p.starting || p.quote.state !== "quote"} onClick={p.onWrite}>
        {p.starting ? STUDIO_COPY.brief.wordsPlan.starting : W.makeMore}
      </Button>
    </section>
  );
  if (p.notReleased && p.cards.length === 0) {
    return (
      <ComingSoon
        title={STUDIO_COPY.comingSoon.words.title}
        description={STUDIO_COPY.comingSoon.words.description}
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link href={p.planHref}>{STUDIO_COPY.creative.allFailed.backToPlan}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-4" data-slot="studio-words" data-phase={p.phase}>
      {p.phase === "making" && (
        <section aria-labelledby="studio-words-making" className="space-y-3 rounded-lg border bg-card p-4" data-slot="studio-making">
          <h2 id="studio-words-making" className="text-base font-semibold">
            {W.makingTitle}
          </h2>
          <Progress value={Math.round((p.progress.done / Math.max(p.progress.total, 1)) * 100)} aria-label={W.makingTitle} />
          <p className="text-sm text-muted-foreground">{STUDIO_COPY.creative.usually}</p>
          <p className="text-sm text-muted-foreground">{STUDIO_COPY.creative.youCanLeave}</p>
        </section>
      )}

      {p.phase === "failed" && (
        <section role="alert" className="space-y-3 rounded-lg border bg-card p-4" data-slot="studio-words-failed">
          <h2 className="text-base font-semibold">{W.allFailed.title}</h2>
          {p.notReleased ? null : <QuoteBlock state={p.quote.state} peaks={p.quote.peaks} kind="total" left={p.left} onRetry={p.quote.onRetry} />}
          {!p.canMake && <p className="text-sm text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToMake}</p>}
          {p.refusal && <RefusalNote refusal={p.refusal} onRetry={p.onWrite} onRequote={p.onRequote} />}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11" disabled={!p.canMake || p.starting || p.quote.state !== "quote"} onClick={p.onWrite}>
              {p.starting ? STUDIO_COPY.brief.wordsPlan.starting : W.allFailed.tryAgain}
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href={p.planHref}>{STUDIO_COPY.creative.allFailed.backToPlan}</Link>
            </Button>
          </div>
        </section>
      )}

      {p.phase === "all_dropped" && <AllDroppedCard notes={p.droppedNotes} planHref={p.planHref} />}

      {(p.phase === "making" || p.phase === "ready") && (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{W.caption}</h2>
            <p className="text-sm text-muted-foreground">{W.hint}</p>
          </div>
          {p.cards.length === 0 && p.pending === 0 && <p className="text-sm text-muted-foreground">{p.phase === "ready" ? W.allAside : W.noneYet}</p>}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {p.cards.map((c, i) => (
              <li key={c.id}>
                <WordsCardView preview={c} index={i} total={p.cards.length + p.pending} canMake={p.canMake} onHeart={p.onHeart} onSkip={p.onSkip} onUse={p.onUse} />
              </li>
            ))}
            {Array.from({ length: p.pending }, (_, i) => (
              <li key={`pending-${i}`} aria-hidden="true">
                <Skeleton className="h-56 rounded-lg" />
              </li>
            ))}
          </ul>
          {p.phase === "ready" && <p className="text-sm text-muted-foreground">{W.disclosure}</p>}
          <DroppedLine count={p.droppedCount} notes={p.droppedNotes} />
          {p.phase === "ready" && (p.notReleased ? null : makeBar)}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href={STUDIO_PATHS.shortlist} className="underline underline-offset-2">
          {STUDIO_COPY.shortlist.list}
        </Link>
      </p>
    </div>
  );
}

/**
 * "Use these words": the channels first (the connected ones, all chosen to start with), then the same post step the pictures use, with no
 * picture to wait for. Choosing channels posts nothing; the person approves with Post it or Schedule it.
 */
export function WordsUseSheet({ open, onOpenChange, creativeId, preview }: { open: boolean; onOpenChange: (o: boolean) => void; creativeId: string; preview: PreviewView | undefined }) {
  const mobile = useIsMobile();
  // An option that was already posted or scheduled asks first; every other starts at the channels. The first step is read from the option, so it is right whenever the sheet opens.
  const [chosen, setChosen] = useState<"channels" | "post" | null>(null);
  const used = sentLine(preview?.sent) !== null;
  const step: "again" | "channels" | "post" = chosen ?? (used ? "again" : "channels");
  const setStep = (s: "channels" | "post") => setChosen(s);
  const close = (o: boolean) => {
    if (!o) setChosen(null);
    onOpenChange(o);
  };
  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 p-4", mobile ? "h-[92dvh]" : "sm:max-w-lg")}>
        <SheetHeader className="p-0 text-start">
          <SheetTitle>{step === "again" ? W.again.title : step === "channels" ? W.sheet.title : STUDIO_COPY.post.title}</SheetTitle>
          <SheetDescription>{step === "again" ? W.again.question : step === "channels" ? W.sheet.description : STUDIO_COPY.post.description}</SheetDescription>
        </SheetHeader>
        {open && preview && step === "again" && <WordsAgain sent={preview.sent} onYes={() => setChosen("channels")} onNo={() => close(false)} />}
        {open && preview && step !== "again" && <WordsUseBody step={step} setStep={setStep} creativeId={creativeId} preview={preview} onClose={() => close(false)} />}
      </SheetContent>
    </Sheet>
  );
}

/** The question before an option that already went out is used again: where it went, then Yes or No. Nothing is sent by either. */
export function WordsAgain({ sent, onYes, onNo }: { sent: WordsSent | null | undefined; onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex flex-col gap-4" data-slot="studio-words-again">
      <p className="text-sm">{sentLine(sent)}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="h-12" onClick={onYes}>
          {W.again.yes}
        </Button>
        <Button type="button" variant="outline" className="h-12" onClick={onNo}>
          {W.again.no}
        </Button>
      </div>
    </div>
  );
}

function WordsUseBody({ step, setStep, creativeId, preview, onClose }: { step: "channels" | "post"; setStep: (s: "channels" | "post") => void; creativeId: string; preview: PreviewView; onClose: () => void }) {
  const connected = useConnectedChannels();
  const connectedKeys = useMemo(() => connected.data ?? [], [connected.data]);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const chosen = useMemo(() => connectedKeys.filter((k) => !off.has(k)), [connectedKeys, off]);
  const words = useMemo(() => ({ previewId: preview.id, channels: chosen }), [preview.id, chosen]);
  if (step === "post") {
    return <PostStep creativeId={creativeId} versions={[]} headlineFallback={preview.headline ?? ""} words={words} onBack={() => setStep("channels")} onClose={onClose} />;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-slot="studio-words-channels">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{W.sheet.channels}</legend>
        {connected.isError ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-muted-foreground">{STUDIO_COPY.sizes.loadFailed}</p>
            <Button type="button" variant="outline" className="h-11" onClick={() => void connected.refetch()}>
              {STUDIO_COPY.quote.retry}
            </Button>
          </div>
        ) : connected.isFetching && connectedKeys.length === 0 ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : connectedKeys.length === 0 ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">{W.sheet.noChannels}</p>
            <Button asChild variant="outline" className="h-11">
              <Link href="/dashboard/integrations">{W.sheet.connect}</Link>
            </Button>
          </div>
        ) : (
          STUDIO_CHANNELS.filter((c) => connectedKeys.includes(c.key)).map((c) => (
            <div key={c.key} className="flex min-h-11 items-center gap-3">
              <Checkbox
                id={`words-channel-${c.key}`}
                checked={!off.has(c.key)}
                onCheckedChange={() =>
                  setOff((o) => {
                    const next = new Set(o);
                    if (next.has(c.key)) next.delete(c.key);
                    else next.add(c.key);
                    return next;
                  })
                }
              />
              <Label htmlFor={`words-channel-${c.key}`} className="text-sm">
                {c.label}
              </Label>
            </div>
          ))
        )}
      </fieldset>
      <Button type="button" className="h-12" disabled={chosen.length === 0} onClick={() => setStep("post")}>
        {W.sheet.next}
      </Button>
    </div>
  );
}

/** The words-only creative page, wired: one read (polled by the page), the heart, "Not for me", a whole new set, and the hand-off sheet. */
export function WordsWorkspace({ view }: { view: CreativeView }) {
  const id = view.id;
  const phase = creativePhase(view);
  const { canMake } = useStudioAbilities();
  const left = usePeaksLeft();
  const heart = useHeart(id);
  const skip = useSkip(id);
  const press = usePress();
  const [refusal, setRefusal] = useState<StudioRefusal | undefined>();
  const [releasedOff, setReleasedOff] = useState(false);
  const [useId, setUseId] = useState<string | null>(null);
  const quote = usePressQuote(id, phase === "failed" ? "previews" : "more", undefined, (phase === "failed" || phase === "ready") && canMake);
  const cards = view.previews.filter((p) => p.words && p.state !== "rendering" && p.state !== "failed" && p.state !== "skipped" && p.state !== "dropped");
  const progress = makingProgress(view);
  const pending = phase === "making" ? Math.max(0, progress.total - cards.length) : 0;

  const write = () => {
    setRefusal(undefined);
    press.mutate(
      { id, kind: phase === "failed" ? "previews" : "more", count: view.brief.count, receipts: receiptsOf(quote.quote) },
      {
        onSuccess: () => toast.success(W.moreStarted),
        onError: (e) => {
          const r = studioRefusal(e, "Writing text ads");
          if (r.tone === "not_released") setReleasedOff(true);
          else setRefusal(r);
        },
      },
    );
  };
  return (
    <>
      <WordsView
        phase={phase}
        cards={cards}
        pending={pending}
        progress={progress}
        canMake={canMake}
        droppedCount={view.safetySummary.dropped}
        droppedNotes={view.safetySummary.notes}
        quote={{ state: quote.quote ? "quote" : quote.unavailable ? "unavailable" : "loading", peaks: quote.quote?.totalPeaks, onRetry: () => void quote.refetch() }}
        left={left}
        notReleased={releasedOff || quote.notReleased}
        starting={press.isPending}
        refusal={refusal}
        planHref={`${STUDIO_ROUTES.new}?c=${encodeURIComponent(id)}`}
        onHeart={(p, on) =>
          heart.mutate(
            { previewId: p.id, on },
            { onSuccess: (r) => toast(on ? W.heartAdded(r.shortlistCount) : W.heartRemoved(r.shortlistCount)), onError: (e) => toast.error(studioRefusal(e).text) },
          )
        }
        onSkip={(p) => skip.mutate({ previewId: p.id, reasons: [] }, { onSuccess: () => toast(W.skipped), onError: (e) => toast.error(studioRefusal(e).text) })}
        onUse={(p) => isActionable(p) && setUseId(p.id)}
        onWrite={write}
        onRequote={() => {
          setRefusal(undefined);
          void quote.refetch();
        }}
      />
      <WordsUseSheet open={useId !== null} onOpenChange={(o) => !o && setUseId(null)} creativeId={id} preview={view.previews.find((p) => p.id === useId)} />
    </>
  );
}
