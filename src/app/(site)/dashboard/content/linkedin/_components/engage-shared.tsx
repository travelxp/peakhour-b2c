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
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  linkedInContentApi,
  type LinkedInAuthor,
  type LinkedInActorProfile,
} from "@/lib/api/linkedin-content";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SavedReplyPicker, appendReply } from "@/components/inbox/saved-reply-picker";

/** LinkedIn's own cap on comment text. */
export const COMMENT_MAX_LEN = 1250;

/**
 * The commenter, as every LinkedIn surface should show them.
 *
 * ★ONE COMPONENT BECAUSE THE FALLBACK IS THE HARD PART. A decoration is
 * absent far more often than it is present — it expires at 24 hours while
 * the things it decorates live 48 (engagers) or indefinitely
 * (interactions) — so "no name" is the common case, not the edge, and
 * every surface has to get the same wording for it. Three copies would
 * mean three different ways of telling a user we do not know who this is.
 *
 * ★AND "A member" IS NOT A PLACEHOLDER TO IMPROVE ON. It is deliberately
 * neutral: it must not imply the person chose anonymity, and it must not
 * read as a loading state that will resolve. It will not — for members
 * other than the authenticated one LinkedIn exposes no profile lookup, so
 * there is nothing to retry.
 */
export function ActorAvatar({
  profile,
  className = "size-8",
}: {
  profile?: LinkedInActorProfile;
  className?: string;
}) {
  const name = profile?.displayName ?? "";
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";
  return (
    <Avatar className={cn("shrink-0", className)}>
      {/* LinkedIn's image URLs carry their own expiry, often shorter than
          our cache — a broken image is normal, and AvatarFallback covers
          it without a retry. */}
      {profile?.pictureUrl && <AvatarImage src={profile.pictureUrl} alt="" />}
      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
    </Avatar>
  );
}

/** The name to print beside {@link ActorAvatar}. Single source so the
 *  neutral fallback cannot drift between surfaces. */
export function actorDisplayName(profile?: LinkedInActorProfile): string {
  return profile?.displayName ?? "A member";
}

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
    // ★503 / DRAFT_UNAVAILABLE. The api writes a specific sentence for a
    // failed AI draft — "write one yourself, or try again in a moment" —
    // precisely so it does not read as the reply having failed. Falling
    // through to the generic message below discarded it and produced the
    // confusion that message exists to prevent.
    if (err.code === "DRAFT_UNAVAILABLE" || err.status === 503) {
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
  commentText,
  postText,
}: {
  postUrn: string;
  parentCommentUrn: string;
  author: LinkedInAuthor;
  onClose: () => void;
  /** Refresh whichever list this reply belongs to — the thread, the
   *  replies under a comment, or the Feed queue. */
  onReplied: () => void;
  /** What the member said, for grounding an AI draft. Absent on a
   *  redacted comment — the button hides rather than drafting a reply to
   *  a question it cannot read. */
  commentText?: string;
  /** Our post, for the same reason. Optional: the server is told to
   *  guess at nothing when it is missing. */
  postText?: string;
}) {
  const [text, setText] = useState("");

  /**
   * ★A DRAFT LANDS IN THE BOX. IT IS NOT SENT.
   *
   * The same rule as the saved-reply picker beside it, and for the same
   * reason — this text goes out publicly under the brand's name. It also
   * REPLACES rather than appends, unlike a saved reply: an AI draft is a
   * whole answer written for this specific comment, and stapling it to a
   * half-finished sentence produces something nobody wrote. Guarded by a
   * confirm when there is work to lose.
   */
  const draft = useMutation({
    mutationFn: () =>
      linkedInContentApi.suggestReply({
        commentText: commentText ?? "",
        ...(postText ? { postText } : {}),
      }),
    onSuccess: (res) => setText(res.reply.slice(0, COMMENT_MAX_LEN)),
    onError: (err) => toast.error(engageErrorMessage(err)),
  });

  function requestDraft() {
    if (
      text.trim().length > 0 &&
      !window.confirm("Replace what you've written with an AI draft?")
    ) {
      return;
    }
    draft.mutate();
  }
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
      {/* ★LOCKED WHILE A DRAFT IS IN FLIGHT. The replace-confirm is
          answered at CLICK time, but the draft arrives seconds later and
          overwrites the box — so anything typed or inserted in between
          was consented to under a question asked about different text.
          Freezing the input is the only way the confirm keeps meaning
          what it said. */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX_LEN))}
        placeholder={draft.isPending ? "Drafting…" : "Write a reply…"}
        rows={2}
        className="text-sm"
        readOnly={draft.isPending}
      />
      <div className="flex items-center gap-2">
        {/* ★Inserts, never sends. The reply lands in the textarea above
            and the person still presses Reply — see the picker's own
            note on why that separation is load-bearing. Appending rather
            than replacing keeps a half-typed sentence. */}
        {/* ★Hidden when there is nothing to read. A draft written
            against an empty comment is a guess dressed as an answer, and
            a redacted comment (past LinkedIn's 48h window) is exactly
            that case — the row survives, the words do not. */}
        {commentText && commentText.trim().length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={draft.isPending || send.isPending}
            aria-busy={draft.isPending}
            onClick={requestDraft}
          >
            {draft.isPending ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Draft with AI
          </Button>
        )}
        <SavedReplyPicker
          channel="linkedin"
          draft={text}
          disabled={send.isPending || draft.isPending}
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
