"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SavedReplyPicker, appendReply } from "@/components/inbox/saved-reply-picker";
import { ApiError } from "@/lib/api";
import { inboxApi, type InboxItem } from "@/lib/api/inbox";
import { useLocale } from "@/hooks/use-locale";
import {
  checkReplyText,
  composerStateFor,
  isRetryableRefusal,
  replyCharsRemaining,
  replyOutcome,
  replyRefusal,
  reviewerLabel,
  shouldAdoptPublishedReply,
  shouldRefreshAfter,
  REVIEW_REPLY_MAX_LENGTH,
  TRANSPORT_ERROR_CODE,
  type ReplyOutcome,
  type ReplyRefusal,
} from "@/lib/review-reply";

/**
 * One Google review, and the box that answers it (plan S0·4).
 *
 * ★★★MARKUP ONLY. Every decision this card makes — whether the box may be
 * prefilled, what a refusal means, whether `sent: true, recorded: false` is a
 * success — lives in `lib/review-reply.ts`, because this repo runs vitest
 * WITHOUT JSDOM and a rule in here is a rule nothing asserts. If you find
 * yourself writing an `if` about the reply, it belongs in that module.
 *
 * ⚠️THE ONE THING TO NOT "TIDY UP": the textarea starts EMPTY when there is an
 * AI draft. `review.replyDraft` is a suggestion pending approval, and prefilling
 * it turns Send into a one-click publish of machine-written words under the
 * merchant's name, beneath a customer's review, on a page anyone can read. The
 * suggestion is one explicit click away, which is the whole design.
 */

function Stars({ rating }: { rating?: number }) {
  if (typeof rating !== "number") {
    // ⚠️ABSENT IS NOT ZERO. An empty row of stars reads as "nobody rated this
    // well"; the honest rendering of a missing rating is to say it is missing.
    return <span className="text-[11px] text-muted-foreground">no rating</span>;
  }
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          // `fill-brand text-brand` is what commerce/reviews.tsx already uses
          // for a star; a second colour for the same thing is drift.
          className={`size-3.5 ${
            n <= rating ? "fill-brand text-brand" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

function RefusalNote({ refusal }: { refusal: ReplyRefusal }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
      <p className="font-medium">{refusal.headline}</p>
      {refusal.description && <p className="mt-0.5 text-muted-foreground">{refusal.description}</p>}
      {refusal.href && (
        <Link className="mt-1 inline-block underline underline-offset-2" href={refusal.href}>
          Open Presence
        </Link>
      )}
    </div>
  );
}

function OutcomeNote({
  outcome,
  onForce,
  sending,
}: {
  outcome: ReplyOutcome;
  onForce: () => void;
  sending: boolean;
}) {
  return (
    <div className="rounded-md border border-success/30 bg-success/5 p-2.5 text-xs">
      <p className="font-medium">{outcome.headline}</p>
      {outcome.description && <p className="mt-0.5 text-muted-foreground">{outcome.description}</p>}
      {/* ★THE OVERRIDE IS ONLY OFFERED WHERE IT MEANS SOMETHING. `force` exists
          for one case: a reply deleted in Google's own console, which our row
          still holds — so an un-forced re-send does nothing and says it
          worked. */}
      {outcome.offerForce && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1.5 h-7 px-2 text-xs"
          disabled={sending}
          onClick={onForce}
        >
          Send it again anyway
        </Button>
      )}
    </div>
  );
}

export function ReviewReplyCard({ item, onChanged }: { item: InboxItem; onChanged: () => void }) {
  const { formatDate } = useLocale();
  const state = composerStateFor(item);
  const [text, setText] = useState(state.initialText);
  const [outcome, setOutcome] = useState<ReplyOutcome | null>(null);
  const [refusal, setRefusal] = useState<ReplyRefusal | null>(null);
  // What the box was last seeded from, and whether anybody has typed since.
  const [seen, setSeen] = useState(state.published);
  const [dirty, setDirty] = useState(false);

  // ★★ADOPT A PUBLISHED REPLY THAT ARRIVES AFTER MOUNT — a colleague answering
  // the same review, or our own write landing on a later refetch. Without this
  // the card reads "Update reply" over an empty, send-disabled box. The rule
  // (never over typed text, never adopting an absent one) is in the module;
  // this is the render-time assignment React documents for exactly this.
  if (shouldAdoptPublishedReply({ dirty, seen, incoming: state.published })) {
    setSeen(state.published);
    setText(state.published ?? "");
    // ⚠️★★AND THE NOTES GO WITH THE TEXT THEY WERE ABOUT. Swapping the box
    // contents while leaving "that's already your published reply" — and its
    // force-publish button — standing over the NEW words is the same hazard
    // `edit` clears them for, reached without anybody typing.
    setRefusal(null);
    setOutcome(null);
  }

  const send = useMutation({
    mutationFn: ({ comment, force }: { comment: string; force?: boolean }) =>
      inboxApi.reply(item._id, comment, force),
    onSuccess: (res) => {
      const result = replyOutcome(res);
      setOutcome(result);
      setRefusal(null);
      // ⚠️★★NOT ON `published_unrecorded`. `recorded: false` means the api's
      // updateOne matched NOTHING, so the row is gone and a refetch returns a
      // list without it — unmounting this card, and with it the only place the
      // words "your reply is live, don't send it again" appear. A stale row
      // showing a true warning beats a tidy list that never mentions the reply.
      if (shouldRefreshAfter(result)) onChanged();
    },
    onError: (err) => {
      // ★★A THROW THAT IS NOT AN `ApiError` IS NOT AN ANSWER FROM THE api.
      // Offline, DNS, CORS and a dropped connection all raise a bare
      // TypeError; handing that over as an empty object classified it as
      // `unhandled` and told the merchant to contact support about their own
      // wifi. `TRANSPORT_ERROR_CODE` is where the module puts that case.
      const detail = err instanceof ApiError ? err : { code: TRANSPORT_ERROR_CODE };
      setRefusal(replyRefusal(detail));
      setOutcome(null);
    },
  });

  const resolve = useMutation({
    mutationFn: () => inboxApi.setStatus(item._id, "resolved"),
    onSuccess: () => {
      toast.success("Marked as handled.");
      onChanged();
    },
    onError: () => toast.error("Couldn't update this review. Try again in a moment."),
  });

  // ★★WHAT THE LAST ATTEMPT WAS, so "Try again" repeats THAT attempt. A
  // transient failure during a FORCED re-send used to retry un-forced, which
  // the api answers "unchanged" to — so restoring a reply deleted in Google's
  // own console needed the merchant to find the force button a second time.
  const [lastForce, setLastForce] = useState(false);

  const remaining = replyCharsRemaining(text);
  const checked = checkReplyText(text);
  const sending = send.isPending;

  /**
   * ★★EVERY NOTE ON THIS CARD IS ABOUT TEXT THAT IS NO LONGER IN THE BOX once
   * the merchant types. The dangerous one is "that's already your published
   * reply" and its "send it again anyway" button: left standing over a
   * rewritten reply, it force-publishes NEW words under a banner saying they
   * are a repeat of the old ones.
   */
  function edit(next: string) {
    setText(next);
    setDirty(true);
    setRefusal(null);
    setOutcome(null);
  }

  /** Fill the box without destroying what is in it — `appendReply` refuses
   *  rather than truncating, exactly as the saved-reply picker does. */
  function insert(body: string): boolean {
    const { text: next, fitted } = appendReply(text, body, REVIEW_REPLY_MAX_LENGTH);
    if (fitted) edit(next);
    return fitted;
  }

  function submit(force?: boolean) {
    // ★THE PRE-FLIGHT IS A COURTESY, NOT THE GATE. The api re-checks both rules
    // and its answer is the one that counts; this only saves a round trip to be
    // told what we already knew.
    if (!checked.ok) {
      setRefusal(replyRefusal({ code: checked.code, message: checked.message, status: 400 }));
      setOutcome(null);
      return;
    }
    setLastForce(force === true);
    send.mutate({ comment: checked.comment, force });
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={item.review?.rating} />
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Google
            </Badge>
            {state.published ? (
              <Badge variant="outline" className="text-[10px]">
                replied
              </Badge>
            ) : (
              <span className="text-[11px] font-medium text-warning-on-tint">unanswered</span>
            )}
            {item.status !== "queued" && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {item.status.replaceAll("_", " ")}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
          </div>
          {/* ★THE WEBHOOK WRITES NO `contact` ON A REVIEW ROW — it puts the
              reviewer in the SUBJECT ("New 4★ review from Jo Smith"), so a card
              reading only `contact.name` said "A customer" above every review
              and never rendered the field carrying the name. */}
          <p className="truncate text-sm font-medium">{reviewerLabel(item)}</p>
          {item.body && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{item.body}</p>}
        </div>
        {item.status !== "resolved" && item.status !== "closed" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 px-2 text-xs"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            Mark handled
          </Button>
        )}
      </div>

      {/* What is live on the listing right now. */}
      {state.published && (
        <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs">
          <p className="font-medium">
            Your published reply
            {item.review?.replyPublishedAt ? ` · ${formatDate(item.review.replyPublishedAt)}` : ""}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{state.published}</p>
        </div>
      )}

      {!state.canSend ? (
        <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
          {state.blockedReason}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => edit(e.target.value)}
            rows={3}
            placeholder={
              state.published ? "Edit your reply…" : "Write a reply — it appears publicly on Google."
            }
            aria-label="Reply to this review"
            disabled={sending}
          />
          <div className="flex flex-wrap items-center gap-2">
            {/* ★THE SUGGESTION IS A BUTTON, NOT A DEFAULT. It fills the box and
                leaves the person holding the pen.
                ⚠️AND IT APPENDS RATHER THAN REPLACING. Overwriting threw away
                whatever was already there — a published reply the merchant was
                part-way through editing, or a paragraph they had just typed —
                with no undo, which is the same mistake `appendReply` was
                written to stop the saved-reply picker making. */}
            {state.suggestion && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={sending}
                onClick={() => {
                  if (!insert(state.suggestion ?? "")) {
                    toast.error("The suggestion doesn't fit — shorten your reply first.");
                  }
                }}
              >
                Use the suggested reply
              </Button>
            )}
            <SavedReplyPicker
              channel="google_review"
              draft={text}
              disabled={sending}
              onInsert={insert}
            />
            <span
              className={`ml-auto text-[11px] ${
                remaining < 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {remaining < 0 ? `${-remaining} over` : `${remaining} left`}
            </span>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={sending || !checked.ok}
              onClick={() => submit()}
            >
              {sending ? "Sending…" : state.published ? "Update reply" : "Send reply"}
            </Button>
          </div>

          {refusal && <RefusalNote refusal={refusal} />}
          {/* Only the transient refusals get the button back — a retry on
              LOCATION_NOT_MANAGED invites clicking the same wall. */}
          {refusal && isRetryableRefusal(refusal) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={sending}
              onClick={() => submit(lastForce)}
            >
              Try again
            </Button>
          )}
          {outcome && (
            <OutcomeNote
              outcome={outcome}
              sending={sending}
              onForce={() => submit(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
