"use client";

import { useState } from "react";
import { Download, Library, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useReportMismatch } from "@/hooks/use-studio-flow";
import { studioApi } from "@/lib/api/creative-studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const R = STUDIO_COPY.finalReview;
const F = STUDIO_COPY.final;

export type CompareSide = "final" | "preview";

export interface FinalReviewViewProps {
  finalUrl: string;
  /** The preview this final was made from; none when the api could not give it (the compare control is then left out). */
  previewUrl: string | null;
  width: number;
  height: number;
  finalAlt: string;
  previewAlt: string;
  /** An editor can post; a viewer sees the picture and the line that says who can. */
  canPost: boolean;
  onChoose: () => void;
  onReport: (text: string) => Promise<void>;
  /** The picture did not load: the page asks for a fresh signed link. */
  onImageError: () => void;
}

/**
 * The final, checked against the preview (UX spec S11). The picture at screen width, a Final / Your preview control (a real tab pair, and a
 * press-and-hold on the picture for the quick flip on touch), a zoom to the real pixels, "Looks different? Tell us", and the one next step:
 * Choose where to post. There is no second approval here: the heart approved the look, and Post it is the approval to publish.
 */
export function FinalReviewView(p: FinalReviewViewProps) {
  const [side, setSide] = useState<CompareSide>("final");
  const [held, setHeld] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [report, setReport] = useState(false);
  const shown: CompareSide = held && p.previewUrl ? "preview" : side;
  const url = shown === "preview" && p.previewUrl ? p.previewUrl : p.finalUrl;
  const alt = shown === "preview" ? p.previewAlt : p.finalAlt;
  return (
    <div className="space-y-3" data-slot="studio-final-review" data-side={shown}>
      {p.previewUrl && (
        <div role="tablist" aria-label={R.compare.label} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["final", "preview"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              id={`studio-final-tab-${s}`}
              aria-selected={side === s}
              aria-controls="studio-final-panel"
              tabIndex={side === s ? 0 : -1}
              onClick={() => setSide(s)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = s === "final" ? "preview" : "final";
                  setSide(next);
                  document.getElementById(`studio-final-tab-${next}`)?.focus();
                }
              }}
              className={cn(
                "h-11 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                side === s ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {s === "final" ? R.compare.final : R.compare.preview}
            </button>
          ))}
        </div>
      )}
      <div id="studio-final-panel" role={p.previewUrl ? "tabpanel" : undefined} aria-labelledby={p.previewUrl ? `studio-final-tab-${side}` : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser (see MediaImage) */}
        <img
          src={url}
          alt={alt}
          width={p.width}
          height={p.height}
          decoding="async"
          draggable={false}
          onError={p.onImageError}
          onPointerDown={(e) => {
            if (e.pointerType === "touch" && p.previewUrl) setHeld(true);
          }}
          onPointerUp={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
          className="w-full touch-pan-y select-none rounded-md border"
          style={{ aspectRatio: `${p.width} / ${p.height}` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Button type="button" variant="ghost" size="sm" className="h-11 gap-1.5 px-2" onClick={() => setZoom(true)}>
          <ZoomIn aria-hidden="true" className="size-4" />
          {R.lookClosely}
        </Button>
        <Button type="button" variant="link" size="sm" className="h-11 px-2" onClick={() => setReport(true)}>
          {R.different}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" className="h-12 sm:min-w-52" disabled={!p.canPost} onClick={p.onChoose}>
          {R.choose}
        </Button>
        <Button asChild variant="outline" className="h-12 gap-1.5">
          <a href={p.finalUrl} download target="_blank" rel="noopener noreferrer">
            <Download aria-hidden="true" className="size-4" />
            {R.download}
          </a>
        </Button>
      </div>
      {!p.canPost && <p className="text-sm text-muted-foreground">{R.viewer}</p>}
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Library aria-hidden="true" className="size-4 shrink-0" />
        {R.inLibrary}
      </p>
      <p className="text-xs text-muted-foreground">{R.disclosure}</p>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl gap-2 p-3">
          <DialogHeader className="text-start">
            <DialogTitle>{R.lookClosely}</DialogTitle>
            <DialogDescription>{R.zoomHint}</DialogDescription>
          </DialogHeader>
          {/* The real pixels, scrolled: arrow keys and drag both move around. */}
          <div tabIndex={0} role="region" aria-label={R.lookClosely} className="max-h-[70dvh] overflow-auto rounded-md border">
            {/* eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser (see MediaImage) */}
            <img src={p.finalUrl} alt={p.finalAlt} width={p.width} height={p.height} className="max-w-none" style={{ width: p.width, height: p.height }} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setZoom(false)}>
              {R.closeZoom}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportDialog open={report} onOpenChange={setReport} onSend={p.onReport} />
    </div>
  );
}

/** "What looks different?": one free-text field, then thanks. The words go to the team (the count is how a final that does not match is found). */
export function ReportDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const close = (o: boolean) => {
    if (!o) {
      setText("");
      setState("idle");
    }
    onOpenChange(o);
  };
  const send = async () => {
    setState("sending");
    try {
      await onSend(text.trim());
      setState("sent");
    } catch {
      setState("failed");
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>{R.differentTitle}</DialogTitle>
          <DialogDescription>{R.differentDescription}</DialogDescription>
        </DialogHeader>
        {state === "sent" ? (
          <p role="status" className="text-sm">
            {R.differentThanks}
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="studio-different-text">{R.differentLabel}</Label>
            <Textarea id="studio-different-text" value={text} maxLength={500} rows={4} onChange={(e) => setText(e.target.value)} />
            {state === "failed" && (
              <p role="alert" className="text-sm text-destructive">
                {R.differentFailed}
              </p>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          {state === "sent" ? (
            <Button type="button" className="h-11" onClick={() => close(false)}>
              {STUDIO_COPY.tweak.close}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" className="h-11" onClick={() => close(false)}>
                {STUDIO_COPY.tweak.cancel}
              </Button>
              <Button type="button" className="h-11" disabled={state === "sending"} onClick={() => void send()}>
                {R.differentSend}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A ready final as the creative page shows it: reads the final (a signed link, asked for again every four minutes and after a picture that
 * will not load, up to two fresh links, then the error with Retry) and draws the review. `onChoose` opens the platform sheet.
 */
export function FinalReview({
  creativeId,
  finalId,
  finalAlt,
  previewAlt,
  canPost,
  onChoose,
}: {
  creativeId: string;
  finalId: string;
  finalAlt: string;
  previewAlt: string;
  canPost: boolean;
  onChoose: () => void;
}) {
  const q = useQuery({
    queryKey: ["studio-final", creativeId, finalId],
    queryFn: () => studioApi.finalView(creativeId, finalId),
    staleTime: 4 * 60 * 1000,
    // The link is signed and lapses: ask for a fresh one while the page stays open.
    refetchInterval: 4 * 60 * 1000,
    retry: false,
  });
  const report = useReportMismatch();
  const [loadFails, setLoadFails] = useState(0);
  if (q.isError || loadFails >= 3) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{F.loadFailed}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11"
          onClick={() => {
            setLoadFails(0);
            void q.refetch();
          }}
        >
          {STUDIO_COPY.quote.retry}
        </Button>
      </div>
    );
  }
  if (!q.data?.imageUrl) return <Skeleton className="aspect-4/5 w-full rounded-md" />;
  return (
    <FinalReviewView
      finalUrl={q.data.imageUrl}
      previewUrl={q.data.previewUrl}
      width={q.data.width ?? 1024}
      height={q.data.height ?? 1280}
      finalAlt={finalAlt}
      previewAlt={previewAlt}
      canPost={canPost}
      onChoose={onChoose}
      onImageError={() => {
        setLoadFails((n) => n + 1);
        if (loadFails < 2) void q.refetch();
      }}
      onReport={async (text) => {
        try {
          await report.mutateAsync({ finalId, text: text || undefined });
        } catch (e) {
          toast.error(R.differentFailed);
          throw e;
        }
      }}
    />
  );
}
