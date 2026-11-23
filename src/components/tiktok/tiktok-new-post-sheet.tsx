"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, X as XIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DrivePicker } from "@/components/composer";
import { MediaImage } from "@/components/shared/media-image";
import { ApiError } from "@/lib/api";
import { scheduler } from "@/lib/scheduler/client";
import { detectTimezone } from "@/lib/scheduler/format";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import { TIKTOK_ITEMS_KEY } from "@/hooks/use-tiktok-content";
import { TIKTOK_CHANNEL } from "@/lib/tiktok-content-view";

/** TikTok's caption limit (UTF-16 code units), the api's `TIKTOK_CAPTION_MAX`. The api refuses anything longer. */
export const TIKTOK_CAPTION_LIMIT = 2200;

/** The post is saved for a week ahead: TikTok publishing is not open, and nothing should try to send it before the merchant chooses to post. */
const SAVE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

interface Media {
  url: string;
  mime: string;
  name?: string | undefined;
}

export function TikTokNewPostSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">New TikTok post</SheetTitle>
          <SheetDescription className="text-xs">Write the caption and add a video or photos. You approve it here, then choose how it posts.</SheetDescription>
        </SheetHeader>
        {open ? <Composer onDone={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasVideo = media.some((m) => m.mime.startsWith("video/"));
  const problems: string[] = [];
  if (media.length === 0) problems.push("Add a video or photos.");
  if (text.length > TIKTOK_CAPTION_LIMIT) problems.push(`The caption is ${text.length} characters. TikTok takes up to ${TIKTOK_CAPTION_LIMIT}.`);

  const save = useMutation({
    mutationFn: () =>
      scheduler.commitPlan({
        title: text.trim().slice(0, 60) || "TikTok post",
        source: { sourceType: "ad_hoc", sourceTextHash: sourceTextHash(text.trim()) },
        channels: [{ channel: TIKTOK_CHANNEL, payload: { text: text.trim(), mediaUrls: media.map((m) => m.url) } }],
        staggerStrategy: "synchronized",
        canonicalScheduledAtUtc: new Date(Date.now() + SAVE_AHEAD_MS).toISOString(),
        timezone: detectTimezone(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TIKTOK_ITEMS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
      toast.success("Approved. Open it on this page when you are ready to post.");
      onDone();
    },
    onError: (err: unknown) => {
      const raw = err instanceof ApiError || err instanceof Error ? err.message : "";
      setError(raw && raw !== "Invalid request body" ? raw : "This post was not accepted. Check the caption and the video or photos, then try again.");
    },
  });

  return (
    <div className="flex-1 space-y-4 px-6 py-5">
      <div className="space-y-1.5">
        <Label htmlFor="tiktok-caption" className="text-sm font-semibold">
          Caption
        </Label>
        <Textarea
          id="tiktok-caption"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={5}
          placeholder="Say something about your video or photos"
          aria-describedby="tiktok-caption-count"
        />
        <p id="tiktok-caption-count" className="text-right text-xs text-muted-foreground">
          {text.length} / {TIKTOK_CAPTION_LIMIT}
        </p>
      </div>

      {media.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Attached media">
          {media.map((m, i) => (
            <li key={`${m.url}-${i}`} className="relative size-20 overflow-hidden rounded-md border bg-muted">
              {m.mime.startsWith("video/") ? (
                <span className="flex size-full items-center justify-center p-1 text-center text-xs text-muted-foreground">{m.name ?? "Video"}</span>
              ) : (
                <MediaImage src={m.url} alt={m.name ?? "Attached photo"} width={80} height={80} className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                aria-label={`Remove ${m.name ?? "this file"}`}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <DrivePicker
          destination={{ kind: "post", channel: TIKTOK_CHANNEL }}
          attached={media.length}
          addLabel="Add to post"
          onSelect={(assets) =>
            setMedia((prev) => {
              const have = new Set(prev.map((m) => m.url));
              return [...prev, ...assets.filter((a) => !have.has(a.url)).map((a) => ({ url: a.url, mime: a.mime, name: a.name }))];
            })
          }
        />
        <span className="text-xs text-muted-foreground">One video, or photos. {hasVideo ? "A video posts on its own." : ""}</span>
      </div>

      {problems.length > 0 && (text !== "" || media.length > 0) ? (
        <ul className="space-y-1 text-xs text-muted-foreground" role="status">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="button" onClick={() => save.mutate()} disabled={problems.length > 0 || save.isPending} aria-busy={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {save.isPending ? "Saving..." : "Approve and save"}
        </Button>
        <p className="text-xs text-muted-foreground">Nothing is posted yet. You choose how it posts next.</p>
      </div>
    </div>
  );
}
