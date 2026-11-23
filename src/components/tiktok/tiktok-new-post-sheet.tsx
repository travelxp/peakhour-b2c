"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PostMedia, dropOutline, usePostMedia } from "@/components/composer/post-media";
import { ApiError } from "@/lib/api";
import { scheduler } from "@/lib/scheduler/client";
import { detectTimezone } from "@/lib/scheduler/format";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import { needsOkKeys } from "@/hooks/use-needs-ok";
import { TIKTOK_CHANNEL, mediaRefusal, mediaTypeOf } from "@/lib/tiktok-content-view";

/** TikTok's caption limit (UTF-16 code units), the api's `TIKTOK_CAPTION_MAX`. The api refuses anything longer. */
export const TIKTOK_CAPTION_LIMIT = 2200;

/** The post is saved for a week ahead: TikTok publishing is not open, and nothing should try to send it before the merchant chooses to post. */
const SAVE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

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
  // The shared post media: the picker's own rules, dedupe by file, a message for each file turned away, and drop or paste.
  const postMedia = usePostMedia(TIKTOK_CHANNEL);
  const { media, urls, adding, dropping, dropRef } = postMedia;
  const [error, setError] = useState<string | null>(null);

  const mimes = media.map((m) => m.mime);
  const problems: string[] = [];
  if (media.length === 0) problems.push("Add a video or photos.");
  // One video OR photos, judged by what each file is (its type), never by its name.
  const refusal = mediaRefusal(mimes);
  if (refusal) problems.push(refusal);
  if (text.length > TIKTOK_CAPTION_LIMIT) problems.push(`The caption is ${text.length} characters. TikTok takes up to ${TIKTOK_CAPTION_LIMIT}.`);

  const save = useMutation({
    mutationFn: ({ urls, kinds }: { urls: string[]; kinds: string[] }) =>
      scheduler.commitPlan({
        title: text.trim().slice(0, 60) || "TikTok post",
        source: { sourceType: "ad_hoc", sourceTextHash: sourceTextHash(text.trim()) },
        // No privacy here: the merchant chooses it on the post sheet, and the api checks it when the post is sent.
        channels: [{ channel: TIKTOK_CHANNEL, payload: { text: text.trim(), mediaUrls: urls, channelOptions: { mediaType: mediaTypeOf(kinds) } } }],
        staggerStrategy: "synchronized",
        canonicalScheduledAtUtc: new Date(Date.now() + SAVE_AHEAD_MS).toISOString(),
        timezone: detectTimezone(),
      }),
    onSuccess: () => {
      // ["scheduler:items"] covers the TikTok list under it and the calendar; "Needs your OK" lists the new post too
      void queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
      void queryClient.invalidateQueries({ queryKey: needsOkKeys.all });
      toast.success("Approved. Open it on this page when you are ready to post.");
      onDone();
    },
    onError: (err: unknown) => {
      const raw = err instanceof ApiError || err instanceof Error ? err.message : "";
      setError(raw && raw !== "Invalid request body" ? raw : "This post was not accepted. Check the caption and the video or photos, then try again.");
    },
  });

  return (
    <div ref={dropRef} className={`flex-1 space-y-4 px-6 py-5 ${dropOutline(dropping) ?? ""}`} data-testid="tiktok-drop-target">
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

      <PostMedia state={postMedia} hint="One video, or photos." />

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
        <Button type="button" onClick={() => save.mutate({ urls, kinds: mimes })} disabled={problems.length > 0 || adding || save.isPending} aria-busy={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {save.isPending ? "Saving..." : "Approve and save"}
        </Button>
        <p className="text-xs text-muted-foreground">Nothing is posted yet. You choose how it posts next.</p>
      </div>
    </div>
  );
}
