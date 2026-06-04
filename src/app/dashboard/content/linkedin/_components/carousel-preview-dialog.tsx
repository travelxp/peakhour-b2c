"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GalleryHorizontalEnd, ImageOff, Loader2, Send } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  linkedInContentApi,
  type CarouselPreviewResult,
  type LinkedInAuthor,
  type LinkedInVisibility,
} from "@/lib/api/linkedin-content";

/** LinkedIn commentary cap (matches the server). */
const COMMENTARY_MAX = 3000;

/**
 * Review-and-publish modal for a generated carousel. Renders the preview PDF,
 * lets the user edit the post text, and publishes via the previewKey (no
 * regeneration → no second image-gen charge). A RECONNECT_REQUIRED /
 * NOT_CONNECTED error surfaces a Reconnect CTA; PREVIEW_EXPIRED tells the user
 * to regenerate.
 */
export function CarouselPreviewDialog({
  preview,
  author,
  visibility,
  targetLabel,
  onClose,
  onPublished,
}: {
  preview: CarouselPreviewResult;
  author: LinkedInAuthor;
  visibility: LinkedInVisibility;
  /** Human label for where this publishes (e.g. a Page name) — shown so the
   *  user knows the target before posting. */
  targetLabel: string;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [commentary, setCommentary] = useState(preview.commentary);
  const imagesMissing = preview.imagesGenerated < preview.slideCount;
  const tooLong = commentary.length > COMMENTARY_MAX;

  const publish = useMutation({
    mutationFn: () =>
      linkedInContentApi.publishCarousel({
        author,
        previewKey: preview.previewKey,
        commentary: commentary.trim() || undefined,
        title: preview.title,
        visibility,
      }),
    onSuccess: () => {
      toast.success("Carousel published to LinkedIn.");
      onPublished();
    },
    onError: (err: unknown) => {
      if (
        err instanceof ApiError &&
        (err.code === "RECONNECT_REQUIRED" || err.code === "NOT_CONNECTED")
      ) {
        toast.error("Reconnect LinkedIn to publish.", {
          action: {
            label: "Reconnect",
            onClick: () => {
              window.location.href = "/dashboard/integrations";
            },
          },
        });
        return;
      }
      if (err instanceof ApiError && err.code === "PREVIEW_EXPIRED") {
        toast.error("This preview expired — close and generate the carousel again.");
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Couldn't publish the carousel.");
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        // Don't let an outside-click/escape close mid-publish.
        if (!o && !publish.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GalleryHorizontalEnd className="size-4" /> Review your carousel
          </DialogTitle>
          <DialogDescription>
            {preview.slideCount} slide{preview.slideCount === 1 ? "" : "s"} — publishing as{" "}
            <span className="font-medium text-foreground">{targetLabel}</span> (
            {visibility === "PUBLIC" ? "Public" : visibility === "CONNECTIONS" ? "Connections" : "Signed-in members"})
            as a swipeable document post.
          </DialogDescription>
        </DialogHeader>

        {imagesMissing && (
          <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <ImageOff className="size-3.5 shrink-0" />
            Slide images couldn&apos;t be generated — this carousel is text-only. You can publish it
            as-is, or cancel and try again.
          </p>
        )}

        <div className="h-115 w-full overflow-hidden rounded-md border bg-muted/30">
          <iframe src={preview.previewUrl} title="Carousel preview" className="h-full w-full" />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="carousel-commentary"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Post text (shown above the carousel)
          </Label>
          <Textarea
            id="carousel-commentary"
            value={commentary}
            onChange={(e) => setCommentary(e.target.value)}
            rows={3}
            className="resize-none text-sm"
            aria-label="Carousel post text"
          />
          <div className="flex items-center justify-between">
            {tooLong ? (
              <span className="text-[11px] text-destructive">
                Trim to {COMMENTARY_MAX} characters to publish.
              </span>
            ) : (
              <span />
            )}
            <span
              className={`text-[11px] tabular-nums ${tooLong ? "text-destructive" : "text-muted-foreground"}`}
            >
              {commentary.length}/{COMMENTARY_MAX}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => publish.mutate()}
            disabled={tooLong || publish.isPending}
            aria-busy={publish.isPending}
            className="gap-1.5"
          >
            {publish.isPending ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="size-4" />
            )}
            {publish.isPending ? "Publishing…" : "Publish carousel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
