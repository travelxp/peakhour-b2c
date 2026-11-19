"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PreviewView } from "@/lib/api/creative-studio";
import { isActionable } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const C = STUDIO_COPY.creative;

/**
 * The heart: a toggle button (UX spec 4.7). `aria-pressed`, named "Shortlist preview {i}", 48 x 48, and the pressed state is a filled heart AND an
 * outline on the card, not colour alone. The result is announced by the page's live region, not here.
 */
export function HeartButton({
  pressed,
  label,
  onToggle,
  disabled,
  title,
  className,
}: {
  pressed: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
  /** Why it is off, for a pointer hover (a viewer). */
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex size-12 items-center justify-center rounded-full border bg-background/90 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        className,
      )}
    >
      <Heart aria-hidden="true" className={cn("size-6", pressed ? "fill-destructive text-destructive" : "text-foreground")} />
    </button>
  );
}

/** The image of a preview at its real shape. A failed load is a tile that says so, with a retry (never a broken image). */
export function PreviewImage({ preview, alt, className }: { preview: PreviewView; alt: string; className?: string }) {
  const [failed, setFailed] = useState(0);
  const src = preview.imageUrl ?? preview.thumbUrl;
  const w = preview.width ?? 768;
  const h = preview.height ?? 960;
  if (!src || failed >= 2) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{ aspectRatio: `${w} / ${h}` }}
        className={cn("flex w-full flex-col items-center justify-center gap-2 bg-muted p-3 text-center text-sm text-muted-foreground", className)}
      >
        <span>{C.loadFailedTile}</span>
        {src && (
          <Button type="button" size="sm" variant="outline" className="h-11" onClick={() => setFailed(0)}>
            {STUDIO_COPY.quote.retry}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div style={{ aspectRatio: `${w} / ${h}` }} className={cn("w-full overflow-hidden bg-muted", className)}>
      {/* A signed link can lapse: one more try with the same address, then the tile above. A plain img so the load error can be read. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser (see MediaImage) */}
      <img
        key={failed}
        src={src}
        alt={alt}
        width={w}
        height={h}
        decoding="async"
        onError={() => setFailed((n) => n + 1)}
        className="size-full object-cover"
      />
    </div>
  );
}

const FINAL_CHIP: Partial<Record<PreviewView["state"], string>> = {
  finalizing: STUDIO_COPY.shortlist.chip.making,
  final_ready: STUDIO_COPY.shortlist.chip.ready,
  final_blocked: STUDIO_COPY.shortlist.chip.blocked,
  final_failed: STUDIO_COPY.shortlist.chip.failed,
};

/**
 * One preview (UX spec S7): the picture at its real shape, a "Preview" badge, the heart, and a Tweak button. A heart that a change lapsed
 * shows outlined with "Changed. Tap the heart again." A final that did not match shows "Didn't match. Not charged." with Try again (which
 * hearts the preview again so the next Make final asks for a new price). A viewer cannot spend, so the heart is off with the reason.
 */
export function PreviewCard({
  preview,
  index,
  total,
  canMake,
  onHeart,
  onOpen,
  onTweak,
  onSkip,
}: {
  preview: PreviewView;
  index: number;
  total: number;
  canMake: boolean;
  onHeart: (preview: PreviewView, on: boolean) => void;
  onOpen: (preview: PreviewView) => void;
  onTweak: (preview: PreviewView) => void;
  onSkip: (preview: PreviewView) => void;
}) {
  const alt = C.previewAlt(index + 1, total, preview.headline ?? "", preview.productTitle ?? "");
  const actionable = isActionable(preview);
  const chip = FINAL_CHIP[preview.state];
  const retryFinal = preview.state === "final_blocked" || preview.state === "final_failed";
  const lapsed = !preview.liked && !!preview.lapsedBecause && preview.state === "ready";
  return (
    <article
      data-slot="studio-preview"
      data-state={preview.state}
      aria-label={alt}
      className={cn("flex flex-col overflow-hidden rounded-lg border bg-card", preview.liked && "outline-2 outline-primary")}
    >
      <div className="relative">
        <button type="button" onClick={() => onOpen(preview)} className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${C.open}: ${alt}`}>
          <PreviewImage preview={preview} alt={alt} />
        </button>
        <Badge variant="secondary" className="absolute start-2 bottom-2">
          {C.previewBadge}
        </Badge>
        {actionable && (
          <HeartButton
            className="absolute end-2 top-2"
            pressed={preview.liked}
            label={C.heartLabel(index + 1)}
            disabled={!canMake}
            title={canMake ? undefined : STUDIO_COPY.refusal.askAnEditorToShortlist}
            onToggle={() => onHeart(preview, !preview.liked)}
          />
        )}
      </div>
      <div className="flex flex-col gap-1 p-2">
        {lapsed && <p className="text-xs font-medium text-warning-on-tint">{C.lapsedBadge}</p>}
        {preview.safety?.status === "fixed" && <p className="text-xs text-muted-foreground">{C.adjusted}</p>}
        {chip && <p className="text-xs font-medium">{chip}</p>}
        <div className="flex flex-wrap gap-1">
          {actionable && (
            <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-8" disabled={!canMake} onClick={() => onTweak(preview)}>
              {C.tweak}
            </Button>
          )}
          {actionable && (
            <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-8" disabled={!canMake} onClick={() => onSkip(preview)}>
              {C.notForMe}
            </Button>
          )}
          {retryFinal && canMake && (
            <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => onHeart(preview, true)}>
              {STUDIO_COPY.final.tryAgain}
            </Button>
          )}
        </div>
        {!canMake && actionable && <p className="text-xs text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToShortlist}</p>}
      </div>
    </article>
  );
}

/** A tile that fills in when its preview lands. The shimmer is removed under reduced motion. */
export function PreviewSkeletonTile({ index, ratio = "4 / 5" }: { index: number; ratio?: string }) {
  return (
    <div
      data-slot="studio-preview-skeleton"
      aria-hidden="true"
      data-index={index}
      style={{ aspectRatio: ratio }}
      className="w-full animate-pulse rounded-lg border bg-muted motion-reduce:animate-none"
    />
  );
}

/** A preview that did not come through: a muted tile that says so and that nothing was charged. No retry on the tile. */
export function FailedTile({ ratio = "4 / 5" }: { ratio?: string }) {
  return (
    <div
      data-slot="studio-preview-failed"
      style={{ aspectRatio: ratio }}
      className="flex w-full items-center justify-center rounded-lg border border-dashed bg-muted/40 p-3 text-center text-sm text-muted-foreground"
    >
      {C.failedTile}
    </div>
  );
}
