"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PriceLine } from "@/components/audience/discover-audiences-dialog";
import { usePeaksQuote, quoteTokenFor } from "@/hooks/use-peaks-quote";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { driveAbilities } from "@/lib/drive/files-state";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { SUMMIT_QUESTION_MAX, SUMMIT_QUESTION_MIN, useAskSummitV2, type SummitAskResponse } from "@/lib/api/growth-v2";
import { SUMMIT } from "@/lib/growth-v2-copy";
import { formatPeaks } from "@/lib/pricing";
import { CouncilSeats } from "./decision-card";

/**
 * Ask Peakhour Summit (SUM-5): a merchant-started review of one question, priced per review in Peaks.
 *
 * The price is read from `GET /v1/peaks/quote` when the dialog opens and shown BEFORE Ask is pressed; Ask stays off until a price is in hand
 * (a priced task shows its price before it runs), and the signed receipt for that price travels with the click, so the price shown is the price
 * charged. The api charges only a review that met, so every failure here says the merchant was not charged. The answer is the review's four seats
 * under the names a merchant sees, and a link to the suggested action when the review queued one. Peaks only: no currency figure anywhere.
 */

/** The Growth page's Suggested actions: where a review that queued a suggestion shows it. */
const SUGGESTED_ACTIONS_HREF = "/dashboard/growth/decisions";
/** The existing top-up path for a balance that is too short. */
const BUY_PEAKS_HREF = "/dashboard/peaks";

const NOT_CHARGED = "You were not charged.";

/** What a refused or failed ask says. A short balance is `topUp`: the way forward is a purchase, not a retry, and it is not an alarming error. */
export function summitErrorLine(err: unknown): { text: string; topUp: boolean; retry: boolean } {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case "CREDITS_EXHAUSTED":
      return { text: "You don't have enough Peaks for this review. Nothing was started and nothing was charged.", topUp: true, retry: false };
    case "COUNCIL_UNAVAILABLE":
    case "COUNCIL_FAILED":
      return { text: `${SUMMIT} could not meet just now. ${NOT_CHARGED}`, topUp: false, retry: true };
    case "FORBIDDEN":
      return { text: EDITOR_ONLY, topUp: false, retry: false };
    case "COUNCIL_NOT_RELEASED":
      return { text: `${SUMMIT} is not available yet. ${NOT_CHARGED}`, topUp: false, retry: false };
    case "PRICE_UNAVAILABLE":
      return { text: `${SUMMIT} has no price set just now, so nothing was started. ${NOT_CHARGED}`, topUp: false, retry: true };
    case "QUOTE_NOT_HONOURED":
      return { text: `The price changed while you were looking. Check the new price, then ask again. ${NOT_CHARGED}`, topUp: false, retry: true };
    case "ACT_ALREADY_RUNNING":
    case "DUPLICATE_REQUEST":
      return { text: "A review is already running for this business. Wait for it to finish. You are charged once.", topUp: false, retry: false };
    case "VALIDATION_ERROR":
      return { text: `Say the question you are weighing, in ${SUMMIT_QUESTION_MIN} to ${SUMMIT_QUESTION_MAX} characters.`, topUp: false, retry: false };
    default:
      return { text: `${SUMMIT} could not meet just now. Try again in a moment. If you were charged, it shows on your Peaks page.`, topUp: false, retry: true };
  }
}

/** Why the button is off for a viewer. The api refuses an ask below editor with 403, so the button says so instead of failing. */
export const EDITOR_ONLY = "Asking Peakhour Summit uses Peaks, so it takes an editor role. Ask an owner or admin to change your role.";

/** The header button and its dialog. Off, with the reason, for anyone below editor (the api enforces the same). */
export function AskSummit() {
  const [open, setOpen] = useState(false);
  const { org, orgs } = useAuth();
  const role = orgs?.find((o) => o._id === org?._id)?.role;
  const canAsk = driveAbilities(role).canEdit;
  return (
    <>
      {/* A disabled button shows no tooltip of its own, so the reason sits on a wrapper (hover) and is read out by the button (touch, keyboard, screen reader). */}
      <span title={canAsk ? undefined : EDITOR_ONLY} className="inline-flex">
        <Button variant="outline" onClick={() => setOpen(true)} disabled={!canAsk} aria-describedby={canAsk ? undefined : "ask-summit-editor-only"}>
          <Sparkles aria-hidden /> Ask {SUMMIT}
        </Button>
      </span>
      {canAsk ? null : (
        <span id="ask-summit-editor-only" className="sr-only">
          {EDITOR_ONLY}
        </span>
      )}
      <AskSummitDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AskSummitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [question, setQuestion] = useState("");
  const queryClient = useQueryClient();
  // Quoted when the dialog opens, not when the page renders: the receipt's clock starts when the merchant is about to act.
  const price = usePeaksQuote(PEAKS_ACTIONS.askSummit, open);
  const ask = useAskSummitV2();
  const trimmed = question.trim();
  const longEnough = trimmed.length >= SUMMIT_QUESTION_MIN;
  const answered = ask.isSuccess;
  // A priced ask waits for its price: with no quote in hand the button stays off and the line above it says why.
  const canAsk = longEnough && trimmed.length <= SUMMIT_QUESTION_MAX && !ask.isPending && price.quote !== undefined;

  const submit = () => {
    if (!canAsk) return;
    ask.mutate(
      { question: trimmed, ...quoteTokenFor(price) },
      {
        // A refused receipt is thrown away, not re-sent: the next press must carry a fresh one (see `useAudiencePlan`).
        onError: (err) => {
          if (err instanceof ApiError && err.code === "QUOTE_NOT_HONOURED") void queryClient.resetQueries({ queryKey: ["peaks-quote"] });
        },
      },
    );
  };

  function close(next: boolean) {
    if (!next && ask.isPending) return;
    if (!next) {
      ask.reset();
      setQuestion("");
    }
    onOpenChange(next);
  }

  const failure = ask.isError ? summitErrorLine(ask.error) : undefined;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden="true" />
            Ask {SUMMIT}
          </DialogTitle>
          <DialogDescription>
            Put one question to {SUMMIT}. You get the case for, the case against, the safety checks and a final call. It changes nothing on your ad accounts; if it suggests an
            action, that waits in Suggested actions for you to answer.
          </DialogDescription>
        </DialogHeader>

        {answered ? (
          <SummitAnswer response={ask.data} onNavigate={() => close(false)} />
        ) : (
          <div className="grid gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={ask.isPending}
              maxLength={SUMMIT_QUESTION_MAX}
              rows={4}
              aria-label="Your question"
              placeholder="For example: should we start Google search ads this month?"
            />
            <p className="text-xs text-muted-foreground">
              {trimmed.length < SUMMIT_QUESTION_MIN ? `At least ${SUMMIT_QUESTION_MIN} characters. ` : ""}
              {trimmed.length} of {SUMMIT_QUESTION_MAX}
            </p>
          </div>
        )}

        {/* The price, before Ask, and only while there is still an ask to make: once an answer is shown the review has happened. */}
        {!answered ? <SummitPrice price={price} /> : null}

        {failure ? (
          <div role={failure.topUp ? "status" : "alert"} className="grid gap-2 rounded-lg border p-3 text-sm">
            <p>{failure.text}</p>
            {failure.topUp ? (
              <div>
                <Button asChild variant="outline" size="sm">
                  <Link href={BUY_PEAKS_HREF}>Buy Peaks</Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {answered ? (
            <Button type="button" onClick={() => close(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={ask.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={!canAsk}>
                {ask.isPending ? "Peakhour Summit is meeting…" : failure?.retry ? "Try again" : "Ask"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "This costs N Peaks" once a receipt is held; the shared price line (working it out, free, could not price it) for every other state. */
function SummitPrice({ price }: { price: ReturnType<typeof usePeaksQuote> }) {
  if (price.quote && !price.quote.free) {
    return <p className="text-sm font-medium">This costs {formatPeaks(price.quote.peaks)} Peaks, and only when the review meets.</p>;
  }
  return <PriceLine price={price} />;
}

/** The review's answer: its four seats, and what became of the suggestion. */
function SummitAnswer({ response: r, onNavigate }: { response: SummitAskResponse; onNavigate: () => void }) {
  return (
    <div className="grid gap-3" role="status" aria-label="The answer">
      {r.council ? <CouncilSeats council={r.council} /> : null}
      {r.status === "recorded" ? (
        <p className="text-sm">
          {r.decisionId ? (
            <>
              It suggested an action, and it is waiting for you.{" "}
              <Link href={SUGGESTED_ACTIONS_HREF} onClick={onNavigate} className="font-medium underline underline-offset-2">
                See it in Suggested actions
              </Link>
              .
            </>
          ) : (
            "It suggested an action, but could not queue it just now."
          )}
        </p>
      ) : null}
      {r.status === "declined" ? <p className="text-sm">{SUMMIT} does not suggest an action. {r.reason}</p> : null}
      {r.status === "not_recorded" ? <p className="text-sm">This review could not be saved as a suggested action, so nothing was queued.</p> : null}
      {!r.charged ? <p className="text-xs text-muted-foreground">{NOT_CHARGED}</p> : null}
    </div>
  );
}
