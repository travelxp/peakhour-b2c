"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FailedTile, HeartButton, PreviewCard, PreviewImage, PreviewSkeletonTile } from "@/components/studio/preview-card";
import { QuoteBlock, type QuoteBlockState } from "@/components/studio/studio-quote";
import { RefusalNote } from "@/components/studio/refusal-note";
import type { FinalRow, PreviewView } from "@/lib/api/creative-studio";
import { finalPhase, isActionable, isShownTile, type StudioRefusal } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const C = STUDIO_COPY.creative;
const F = STUDIO_COPY.final;

/** S6: progress while previews are made. The page does not wait on a spinner: tiles below fill in as each lands. */
export function MakingCard({ done, total, onStop, stopping }: { done: number; total: number; onStop?: () => void; stopping?: boolean }) {
  const safeTotal = Math.max(total, 1);
  return (
    <section aria-labelledby="studio-making-title" className="space-y-3 rounded-lg border bg-card p-4" data-slot="studio-making">
      <h2 id="studio-making-title" className="text-base font-semibold">
        {C.makingTitle(done, total)}
      </h2>
      <Progress value={Math.round((done / safeTotal) * 100)} aria-label={C.makingTitle(done, total)} />
      <p className="text-sm text-muted-foreground">{C.usually}</p>
      <p className="text-sm text-muted-foreground">{C.youCanLeave}</p>
      {onStop && (
        <Button type="button" variant="ghost" className="h-11" disabled={stopping} onClick={onStop}>
          {C.stop}
        </Button>
      )}
    </section>
  );
}

/** All previews failed: nothing was charged, and the way forward (a new price first) is on the card. */
export function FailedCard({
  quote,
  left,
  count,
  canMake,
  pending,
  refusal,
  planHref,
  onTryAgain,
  onRetryQuote,
  makeLabel,
}: {
  quote: { state: QuoteBlockState; peaks?: number };
  left: number | null;
  count: number;
  canMake: boolean;
  pending: boolean;
  refusal?: StudioRefusal;
  planHref: string;
  onTryAgain: () => void;
  onRetryQuote: () => void;
  makeLabel: string;
}) {
  return (
    <section role="alert" className="space-y-3 rounded-lg border bg-card p-4" data-slot="studio-previews-failed">
      <h2 className="text-base font-semibold">{C.allFailed.title}</h2>
      <QuoteBlock state={quote.state} peaks={quote.peaks} units={count} kind="previews" left={left} help onRetry={onRetryQuote} />
      {!canMake && <p className="text-sm text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToMake}</p>}
      {refusal && <RefusalNote refusal={refusal} onRetry={onTryAgain} />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={!canMake || pending || quote.state !== "quote"} onClick={onTryAgain}>
          {pending ? STUDIO_COPY.brief.starting : makeLabel}
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href={planHref}>{C.allFailed.backToPlan}</Link>
        </Button>
      </div>
    </section>
  );
}

/** Every preview was left out by the Safety check: nothing is shown, nothing is charged, and the reason is given in plain words. */
export function AllDroppedCard({ notes, planHref }: { notes: string[]; planHref: string }) {
  return (
    <section role="alert" className="space-y-3 rounded-lg border bg-card p-4" data-slot="studio-all-dropped">
      <h2 className="text-base font-semibold">{C.allDropped}</h2>
      {notes.length > 0 && (
        <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <Button asChild className="h-11">
        <Link href={planHref}>{C.changeWording}</Link>
      </Button>
    </section>
  );
}

/** After the set: how many the Safety check left out, with "Why?" opening the plain reason. */
export function DroppedLine({ count, notes, onChangeWording }: { count: number; notes: string[]; onChangeWording?: () => void }) {
  const [open, setOpen] = useState(false);
  if (count <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-slot="studio-dropped">
      <p>{C.dropped(count)}</p>
      <Button type="button" variant="link" className="h-11 px-1 sm:h-8" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {C.droppedWhy}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-3 overflow-y-auto p-4">
          <SheetHeader className="p-0">
            <SheetTitle>{C.droppedTitle}</SheetTitle>
            <SheetDescription>{C.dropped(count)}</SheetDescription>
          </SheetHeader>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {onChangeWording && (
            <Button
              type="button"
              className="h-11"
              onClick={() => {
                setOpen(false);
                onChangeWording();
              }}
            >
              {C.changeWording}
            </Button>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * The grid of previews (UX spec S7): 2 columns on a phone, 4 on a large screen, never a horizontal scroller. Tiles for the previews still
 * being made are skeletons that turn into previews as each lands; one that failed says so and that nothing was charged.
 */
export function PreviewGrid({
  previews,
  pending,
  canMake,
  onHeart,
  onOpen,
  onTweak,
  onSkip,
}: {
  previews: PreviewView[];
  /** Tiles still to come (a press in flight asked for more than have landed). */
  pending: number;
  canMake: boolean;
  onHeart: (p: PreviewView, on: boolean) => void;
  onOpen: (p: PreviewView) => void;
  onTweak: (p: PreviewView) => void;
  onSkip: (p: PreviewView) => void;
}) {
  const tiles = previews.filter(isShownTile);
  const ratio = tiles.find((p) => p.width && p.height);
  const aspect = ratio ? `${ratio.width} / ${ratio.height}` : "4 / 5";
  const landed = tiles.filter((p) => p.state !== "rendering");
  return (
    <ul aria-label={C.caption} className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-slot="studio-preview-grid">
      {tiles.map((p, i) => (
        <li key={p.id}>
          {p.state === "rendering" ? (
            <PreviewSkeletonTile index={i} ratio={aspect} />
          ) : p.state === "failed" ? (
            <FailedTile ratio={aspect} />
          ) : (
            <PreviewCard preview={p} index={landed.indexOf(p)} total={landed.length} canMake={canMake} onHeart={onHeart} onOpen={onOpen} onTweak={onTweak} onSkip={onSkip} />
          )}
        </li>
      ))}
      {Array.from({ length: Math.max(0, pending) }, (_, k) => (
        <li key={`pending-${k}`}>
          <PreviewSkeletonTile index={tiles.length + k} ratio={aspect} />
        </li>
      ))}
    </ul>
  );
}

/** Earlier previews (unshortlisted ones are kept 30 days): thumbnails only, tucked away. */
export function EarlierPreviews({ previews }: { previews: PreviewView[] }) {
  if (previews.length === 0) return null;
  return (
    <details className="rounded-lg border p-3" data-slot="studio-earlier">
      <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {C.earlier} ({previews.length})
      </summary>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {previews.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-md border">
            <PreviewImage preview={p} alt={C.previewAlt(i + 1, previews.length, p.headline ?? "", p.productTitle ?? "")} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** "Not for me": the reasons are chips the merchant may pick (none is fine). Free, and it teaches Studio what is liked. */
export function NotForMeDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reasons: string[]) => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const S = C.notForMeSheet;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked([]);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{S.title}</DialogTitle>
          <DialogDescription>{S.description}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1">
          {S.reasons.map((r) => (
            <li key={r} className="flex min-h-11 items-center gap-3">
              <Checkbox
                id={`studio-reason-${r}`}
                checked={picked.includes(r)}
                onCheckedChange={(v) => setPicked((cur) => (v === true ? [...cur, r] : cur.filter((x) => x !== r)))}
              />
              <Label htmlFor={`studio-reason-${r}`} className="flex-1 py-2">
                {r}
              </Label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>
            {S.cancel}
          </Button>
          <Button type="button" className="h-11" disabled={pending} onClick={() => onConfirm(picked)}>
            {S.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The viewer (UX spec S7): one preview large, with Previous and Next buttons (and arrow keys), the heart in the thumb zone, Tweak, and
 * "Look closely" for the full-size picture to pan. A modal dialog: focus is trapped, Escape closes, focus returns to the card.
 */
export function PreviewViewer({
  previews,
  index,
  open,
  canMake,
  onIndex,
  onClose,
  onHeart,
  onTweak,
  onSkip,
}: {
  previews: PreviewView[];
  index: number;
  open: boolean;
  canMake: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onHeart: (p: PreviewView, on: boolean) => void;
  onTweak: (p: PreviewView) => void;
  onSkip: (p: PreviewView) => void;
}) {
  const [close, setClose] = useState(false);
  const p = previews[index];
  if (!p) return null;
  const alt = C.previewAlt(index + 1, previews.length, p.headline ?? "", p.productTitle ?? "");
  const go = (d: number) => onIndex((index + d + previews.length) % previews.length);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setClose(false);
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-h-dvh w-full max-w-none gap-3 overflow-y-auto rounded-none p-3 sm:max-w-xl sm:rounded-lg"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          else if (e.key === "ArrowRight") go(1);
        }}
      >
        <DialogHeader>
          <DialogTitle>{C.viewer.title(index + 1, previews.length)}</DialogTitle>
          <DialogDescription>{C.caption}</DialogDescription>
        </DialogHeader>
        <div className={cn("relative mx-auto w-full overflow-auto rounded-md border", close ? "max-h-[70dvh]" : "")} tabIndex={close ? 0 : -1}>
          <div className={cn(close ? "w-[200%] max-w-none" : "w-full")}>
            <PreviewImage preview={p} alt={alt} />
          </div>
          <Badge variant="secondary" className="absolute start-2 top-2">
            {C.previewBadge}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="icon" className="size-11" aria-label={C.viewer.previous} disabled={previews.length < 2} onClick={() => go(-1)}>
            <ChevronLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
          </Button>
          <div className="flex items-center gap-2">
            {isActionable(p) && (
              <HeartButton
                pressed={p.liked}
                label={C.heartLabel(index + 1)}
                disabled={!canMake}
                onToggle={() => onHeart(p, !p.liked)}
              />
            )}
            {isActionable(p) && (
              <Button type="button" variant="outline" className="h-11" disabled={!canMake} onClick={() => onTweak(p)}>
                {C.tweak}
              </Button>
            )}
            {isActionable(p) && (
              <Button type="button" variant="ghost" className="h-11" disabled={!canMake} onClick={() => onSkip(p)}>
                {C.notForMe}
              </Button>
            )}
            <Button type="button" variant="ghost" className="h-11" aria-pressed={close} onClick={() => setClose((v) => !v)}>
              {C.viewer.lookCloser}
            </Button>
          </div>
          <Button type="button" variant="outline" size="icon" className="size-11" aria-label={C.viewer.next} disabled={previews.length < 2} onClick={() => go(1)}>
            <ChevronRight aria-hidden="true" className="size-5 rtl:rotate-180" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Finals ───────────────────────────────────────────────────────────────────────────────────────────────

/** The latest final of each preview (a retry makes a newer one). */
export function latestFinals(finals: FinalRow[]): FinalRow[] {
  const seen = new Set<string>();
  const out: FinalRow[] = [];
  for (const f of finals) {
    if (seen.has(f.previewId)) continue;
    seen.add(f.previewId);
    out.push(f);
  }
  return out;
}

/**
 * One final, by where it is (UX spec S10). Finals from one press are made one after another, so a final not yet started says it is waiting
 * its turn. A final that did not match its preview is never shown, and says so, that nothing was charged and that the preview is safe.
 * `picture` is drawn once the final is ready (the page reads it).
 */
export function FinalTile({
  final,
  alt,
  picture,
  canMake,
  onTryAgain,
  onTweakPreview,
}: {
  final: FinalRow;
  alt: string;
  picture?: React.ReactNode;
  canMake: boolean;
  onTryAgain: () => void;
  onTweakPreview: () => void;
}) {
  const phase = finalPhase(final);
  return (
    <article data-slot="studio-final" data-phase={phase} aria-label={alt} className="space-y-2 rounded-lg border bg-card p-3">
      {phase === "waiting" && <p className="text-sm font-medium">{F.waiting}</p>}
      {phase === "making" && (
        <p className="text-sm font-medium" aria-live="polite">
          {F.making}
        </p>
      )}
      {phase === "checking" && (
        <p className="text-sm font-medium" aria-live="polite">
          {F.checking}
        </p>
      )}
      {(phase === "waiting" || phase === "making" || phase === "checking") && (
        <div aria-hidden="true" className="aspect-4/5 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      )}
      {phase === "ready" && (
        <>
          <Badge>{STUDIO_COPY.shortlist.chip.ready}</Badge>
          {picture}
          <p className="text-sm text-muted-foreground">{F.caption}</p>
        </>
      )}
      {phase === "blocked" && (
        <>
          <p role="status" className="text-sm">
            {F.blocked}
          </p>
          <div className="flex flex-wrap gap-2">
            {canMake && (
              <Button type="button" variant="outline" className="h-11" onClick={onTryAgain}>
                {F.tryAgain}
              </Button>
            )}
            <Button type="button" variant="ghost" className="h-11" onClick={onTweakPreview}>
              {F.tweakPreview}
            </Button>
          </div>
        </>
      )}
      {phase === "failed" && (
        <>
          <p role="status" className="text-sm">
            {F.failed}
          </p>
          {canMake && (
            <Button type="button" variant="outline" className="h-11" onClick={onTryAgain}>
              {F.tryAgain}
            </Button>
          )}
        </>
      )}
    </article>
  );
}

