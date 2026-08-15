"use client";

/**
 * Pieces shared by the two places a LinkedIn comment can be answered:
 * Library's thread panel, and the Feed's queue.
 *
 * They are the same action with the same rules — LinkedIn's 1,250-character
 * limit, the same author resolution, the same error wording — and keeping
 * two copies meant a fix to one silently left the other wrong. The reply
 * box in particular had already been written twice.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { linkedInContentApi, type LinkedInAuthor } from "@/lib/api/linkedin-content";
import { ApiError } from "@/lib/api";
import { SavedReplyPicker, appendReply } from "@/components/inbox/saved-reply-picker";

/** LinkedIn's own cap on comment text. */
export const COMMENT_MAX_LEN = 1250;

/**
 * Turn an engagement failure into something a person can act on.
 *
 * ★A 403 does NOT promise that reconnecting helps. An org post 403s on a
 * grant predating the `_feed` scopes, which reconnecting fixes; a
 * member-authored post 403s on a permission LinkedIn grants to select
 * developers only, which it never will. The server already words this
 * carefully — pass its message through rather than inventing a cheerier
 * one that sends someone round a loop ending where it started.
 *
 * What we do NOT pass through is a raw transport string: it carries
 * LinkedIn JSON and URNs, and "Active business required" is a sentence
 * written for a log, not a person.
 */
export function engageErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "NOT_CONNECTED") return "Reconnect LinkedIn to continue.";
    if (err.code === "FORBIDDEN" && err.message.includes("business")) {
      return "Pick a business to see your community activity.";
    }
    if (
      err.code === "CONFIRMATION_REQUIRED" ||
      err.code === "VALIDATION_ERROR" ||
      err.code === "INVALID_REQUEST" ||
      err.code === "NOT_FOUND"
    ) {
      return err.message;
    }
    if (err.status === 403 || err.status === 404 || err.status === 429) {
      return err.message;
    }
  }
  return "That didn't work. Please try again.";
}

/**
 * A permalink, or null.
 *
 * ★Guarded rather than interpolated. `parentPostUrn` can hold a comment
 * URN — the ingest falls back to a decorated payload's `object` when
 * LinkedIn sends no `sourcePost` — and a comment URN in a
 * `/feed/update/` path is a dead link. A missing link reads as "no link";
 * a broken one reads as a bug.
 *
 * Raw colons, no `encodeURIComponent`, no trailing slash: matches the
 * backend's permalink convention, and encoding produces `%3A%3A` URLs
 * some browser caches mishandle.
 */
export function linkedInPostUrl(urn: string | null | undefined): string | null {
  if (!urn || !urn.includes("urn:li:")) return null;
  if (urn.startsWith("urn:li:comment:")) return null;
  return `https://www.linkedin.com/feed/update/${urn}`;
}

/** Post a reply to one comment, as a given author. */
export function ReplyBox({
  postUrn,
  parentCommentUrn,
  author,
  onClose,
  onReplied,
}: {
  postUrn: string;
  parentCommentUrn: string;
  author: LinkedInAuthor;
  onClose: () => void;
  /** Refresh whichever list this reply belongs to — the thread, the
   *  replies under a comment, or the Feed queue. */
  onReplied: () => void;
}) {
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () =>
      linkedInContentApi.createComment(postUrn, {
        text: text.trim(),
        author,
        parentCommentUrn,
      }),
    onSuccess: () => {
      toast.success("Reply posted");
      setText("");
      onClose();
      onReplied();
    },
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  return (
    <div className="mt-2 space-y-1.5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX_LEN))}
        placeholder="Write a reply…"
        rows={2}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        {/* ★Inserts, never sends. The reply lands in the textarea above
            and the person still presses Reply — see the picker's own
            note on why that separation is load-bearing. Appending rather
            than replacing keeps a half-typed sentence. */}
        <SavedReplyPicker
          channel="linkedin"
          draft={text}
          disabled={send.isPending}
          onInsert={(body) => {
            // ★Computed against the CURRENT text rather than inside a
            // functional update, because the picker needs the answer
            // synchronously to decide whether to count the insert — and
            // a setState updater's return value is not available to it.
            const next = appendReply(text, body, COMMENT_MAX_LEN);
            if (next.fitted) setText(next.text);
            return next.fitted;
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!text.trim() || send.isPending}
          aria-busy={send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none" />
          )}
          Reply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onClose}
        >
          Cancel
        </Button>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {text.length}/{COMMENT_MAX_LEN}
        </span>
      </div>
    </div>
  );
}
