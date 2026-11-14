"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PriceLine } from "@/components/audience/discover-audiences-dialog";
import { usePeaksQuote, quoteTokenFor } from "@/hooks/use-peaks-quote";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { driveAbilities } from "@/lib/drive/files-state";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { GOAL_TEXT_MAX, GOAL_TEXT_MIN, useParseGoal, type GoalParseResponse } from "@/lib/api/growth-v2";
import { formatPeaks } from "@/lib/pricing";

/**
 * "Describe it in your own words" inside the Add goal form (PL-9): a sentence becomes a DRAFT goal, priced per goal in Peaks.
 *
 * The price is read from `GET /v1/peaks/quote` and shown BEFORE the button turns on; the signed receipt for that price travels with the click
 * (`x-peaks-quote`, with one `Idempotency-Key` per click), so the price shown is the price charged. The api charges only when a goal comes back:
 * a question back (422 `GOAL_UNCLEAR`) and every failure say the merchant was not charged. The draft only FILLS THE FORM and is shown in a sentence
 * above it; nothing is sent to the plan until the merchant has read it, changed what they like and pressed the form's own button, which runs the
 * usual WhatsApp confirmation. Peaks only: no currency figure beside a price.
 */

const NOT_CHARGED = "You were not charged.";
/** The existing top-up path for a balance that is too short. */
const BUY_PEAKS_HREF = "/dashboard/peaks";

/** Why the button is off for a viewer. The api refuses below editor with 403, so the button says so instead of failing. */
export const DESCRIBE_EDITOR_ONLY = "Describing a goal in your own words uses Peaks, so it takes an editor role. Ask an owner or admin to change your role.";

/** What the api said when it needs a question answered: the question itself (`details.question`, else the message). Undefined for any other error. */
export function unclearQuestion(err: unknown): string | undefined {
  if (!(err instanceof ApiError) || err.code !== "GOAL_UNCLEAR") return undefined;
  const q = (err.details as { question?: unknown } | undefined)?.question;
  return typeof q === "string" && q.trim() !== "" ? q : err.message;
}

/** What a refused or failed attempt says. A short balance is `topUp`: the way forward is a purchase, not a retry. */
export function describeErrorLine(err: unknown): { text: string; topUp: boolean } {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case "CREDITS_EXHAUSTED":
      return { text: "You don't have enough Peaks for this. Nothing was started and nothing was charged.", topUp: true };
    case "FORBIDDEN":
      return { text: DESCRIBE_EDITOR_ONLY, topUp: false };
    case "PRICE_UNAVAILABLE":
      return { text: `This has no price set just now, so nothing was started. ${NOT_CHARGED}`, topUp: false };
    case "QUOTE_NOT_HONOURED":
      return { text: `The price changed while you were looking. Check the new price, then try again. ${NOT_CHARGED}`, topUp: false };
    case "ACT_ALREADY_RUNNING":
    case "DUPLICATE_REQUEST":
      return { text: "That is already running. Wait for it to finish. You are charged once.", topUp: false };
    case "VALIDATION_ERROR":
      return { text: `Say the goal in ${GOAL_TEXT_MIN} to ${GOAL_TEXT_MAX} characters. ${NOT_CHARGED}`, topUp: false };
    case "GOAL_PARSE_NOT_RELEASED":
      return { text: `Describing a goal in your own words is not available yet. ${NOT_CHARGED} You can fill in the form below.`, topUp: false };
    case "NO_PLAN":
    case "NO_OUTCOMES":
      return { text: `This could not be done for your plan yet. ${NOT_CHARGED}`, topUp: false };
    default:
      return { text: `We could not turn that into a goal just now. ${NOT_CHARGED} Try again in a moment, or fill in the form below.`, topUp: false };
  }
}

export function DescribeGoal({ ready, onDraft }: { ready: boolean; onDraft: (goal: GoalParseResponse["goal"]) => void }) {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const { org, orgs } = useAuth();
  const role = orgs?.find((o) => o._id === org?._id)?.role;
  const canDescribe = driveAbilities(role).canEdit;
  // Quoted only for someone who can use it, and only while the form is open (this component lives inside the Add goal dialog).
  const price = usePeaksQuote(PEAKS_ACTIONS.parseGoal, canDescribe);
  const parse = useParseGoal();
  const trimmed = text.trim();
  // A priced task waits for its price: with no quote in hand the button stays off and the line above it says why.
  const canSend = canDescribe && ready && trimmed.length >= GOAL_TEXT_MIN && trimmed.length <= GOAL_TEXT_MAX && !parse.isPending && price.quote !== undefined;

  const submit = () => {
    if (!canSend) return;
    parse.mutate(
      { text: trimmed, ...quoteTokenFor(price) },
      {
        onSuccess: (r) => onDraft(r.goal),
        // A refused receipt is thrown away, not re-sent: the next press must carry a fresh one.
        onError: (err) => {
          if (err instanceof ApiError && err.code === "QUOTE_NOT_HONOURED") void queryClient.resetQueries({ queryKey: ["peaks-quote"] });
        },
      },
    );
  };

  const question = parse.isError ? unclearQuestion(parse.error) : undefined;
  const failure = parse.isError && question === undefined ? describeErrorLine(parse.error) : undefined;

  return (
    <section className="grid gap-2 rounded-lg border p-3" aria-labelledby="describe-goal-title">
      <h3 id="describe-goal-title" className="text-sm font-medium">
        Describe it in your own words
      </h3>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={parse.isPending || !canDescribe}
        maxLength={GOAL_TEXT_MAX}
        rows={3}
        aria-label="Describe the goal"
        placeholder="For example: more weekday bookings for our Goa hotels, 20% of the budget"
      />
      <p className="text-xs text-muted-foreground">
        {trimmed.length} of {GOAL_TEXT_MAX}. We fill in the form below for you to check. Nothing changes in your plan until you confirm it on WhatsApp.
      </p>

      {canDescribe ? <DescribePrice price={price} /> : null}

      {question ? (
        <div role="status" className="grid gap-1 rounded-lg border p-3 text-sm">
          <p>{question}</p>
          <p className="text-xs text-muted-foreground">{NOT_CHARGED} Nothing was changed. Add to your sentence and try again, or fill in the form below.</p>
        </div>
      ) : null}
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
      {parse.isSuccess ? (
        <div role="status" className="grid gap-1 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <p className="font-medium">{parse.data.restatement}</p>
          <p className="text-xs text-muted-foreground">We filled in the form below. Check it, change anything, then send it for confirmation.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {/* A disabled button shows no tooltip of its own, so the reason sits on a wrapper (hover) and is read out by the button (touch, keyboard, screen reader). */}
        <span title={canDescribe ? undefined : DESCRIBE_EDITOR_ONLY} className="inline-flex">
          <Button type="button" variant="outline" size="sm" onClick={submit} disabled={!canSend} aria-describedby={canDescribe ? undefined : "describe-goal-editor-only"}>
            {parse.isPending ? "Reading your sentence…" : "Fill in the form"}
          </Button>
        </span>
        {canDescribe ? null : (
          <span id="describe-goal-editor-only" className="text-xs text-muted-foreground">
            {DESCRIBE_EDITOR_ONLY}
          </span>
        )}
      </div>
    </section>
  );
}

/** "This costs N Peaks" once a receipt is held; the shared price line (working it out, free, could not price it) for every other state. */
function DescribePrice({ price }: { price: ReturnType<typeof usePeaksQuote> }) {
  if (price.quote && !price.quote.free) {
    return <p className="text-sm font-medium">This costs {formatPeaks(price.quote.peaks)} Peaks, and only when a goal comes back.</p>;
  }
  return <PriceLine price={price} />;
}
