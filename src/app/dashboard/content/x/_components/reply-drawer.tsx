"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Send, Reply, RefreshCw, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { xApi, type XMention } from "@/lib/api/x";
import { ApiError } from "@/lib/api";

const MAX_LEN = 280;

/**
 * Reply drawer for X mentions (Phase 1 M-2). Opens from a mention card's
 * "Suggest reply" button; calls /v1/x/content/mentions/:id/suggest-reply
 * to draft a reply, then publishes via POST /v1/x/content/publish with
 * the mention's externalId as replyToTweetId.
 *
 * Resets fully on close — the next open re-rolls the draft. This is
 * intentional: each session is fresh; partial reply state shouldn't
 * leak between mentions.
 */
export function ReplyDrawer({
  mention,
  open,
  onOpenChange,
}: {
  mention: XMention | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [reasoning, setReasoning] = useState<string | null>(null);
  // Track which mention's draft is loaded so changing the mention prop
  // while the drawer is open (rare but possible) re-rolls instead of
  // showing the wrong draft.
  const loadedFor = useRef<string | null>(null);

  const suggest = useMutation({
    mutationFn: (id: string) => xApi.suggestReplyForMention(id),
    onSuccess: (data, id) => {
      loadedFor.current = id;
      setText(data.text);
      setReasoning(data.reasoning);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : "Couldn't draft a reply.";
      toast.error(message);
    },
  });

  const publish = useMutation({
    mutationFn: (input: { text: string; replyToTweetId: string }) =>
      xApi.publish(input),
    onSuccess: () => {
      toast.success("Reply published.");
      // The reply itself is a new tweet from the business's account, so
      // refresh the Recent tab too. The mentions list invalidate makes
      // the original mention's metrics tick up on next refresh.
      queryClient.invalidateQueries({ queryKey: ["x-tweets"] });
      queryClient.invalidateQueries({ queryKey: ["x-mentions"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : "Couldn't publish the reply.";
      toast.error(message);
    },
  });

  // Auto-fire the suggestion when the drawer opens for a new mention.
  // Skip if we already have a draft for this mention loaded (re-opens
  // shouldn't burn a fresh AI call).
  useEffect(() => {
    if (!open || !mention) return;
    if (loadedFor.current === mention.id) return;
    setText("");
    setReasoning(null);
    suggest.mutate(mention.id);
    // suggest is a stable react-query mutation handle; the effect only
    // needs to fire on open/mention transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mention?.id]);

  // Reset on close so a re-open of a different mention starts clean.
  function handleOpenChange(next: boolean) {
    if (!next) {
      loadedFor.current = null;
      setText("");
      setReasoning(null);
    }
    onOpenChange(next);
  }

  const remaining = MAX_LEN - text.length;
  const tooLong = remaining < 0;
  const empty = text.trim().length === 0;
  const publishDisabled =
    empty || tooLong || publish.isPending || suggest.isPending || !mention;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col gap-4 p-6">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-2">
            <Reply className="size-4" />
            Reply to mention
          </SheetTitle>
          <SheetDescription className="sr-only">
            AI-drafted reply you can edit before publishing.
          </SheetDescription>
        </SheetHeader>

        {mention && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">
              {mention.author.name ?? mention.author.handle ?? mention.author.id}
              {mention.author.handle && (
                <span className="ml-1">@{mention.author.handle}</span>
              )}
            </p>
            <p className="whitespace-pre-wrap line-clamp-4 leading-relaxed">
              {mention.text || (
                <span className="italic text-muted-foreground">
                  (media-only mention)
                </span>
              )}
            </p>
          </div>
        )}

        {suggest.isPending ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 animate-pulse" />
              Drafting a reply…
            </p>
            <Skeleton className="h-24 w-full" />
          </div>
        ) : suggest.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p>{suggest.error instanceof ApiError ? suggest.error.message : "Draft failed."}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => mention && suggest.mutate(mention.id)}
              >
                <RefreshCw className="size-3.5 mr-1" /> Try again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your reply…"
              rows={6}
              className="resize-none"
              aria-label="Reply text"
            />
            {reasoning && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
                <span className="font-medium">Why this reply: </span>
                {reasoning}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => mention && suggest.mutate(mention.id)}
            disabled={!mention || suggest.isPending}
            className="gap-1.5"
          >
            <Sparkles className="size-3.5" />
            Re-draft
          </Button>
          <div className="flex items-center gap-3">
            <span
              className={
                tooLong
                  ? "text-sm font-medium text-destructive"
                  : remaining <= 20
                    ? "text-sm font-medium text-amber-600"
                    : "text-sm text-muted-foreground"
              }
              aria-live="polite"
            >
              {remaining}
            </span>
            <Button
              onClick={() =>
                mention &&
                publish.mutate({
                  text: text.trim(),
                  replyToTweetId: mention.externalId,
                })
              }
              disabled={publishDisabled}
              aria-busy={publish.isPending}
            >
              <Send className="size-4 mr-1.5" />
              {publish.isPending ? "Publishing…" : "Publish reply"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
