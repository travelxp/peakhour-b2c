"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { critiqueTone } from "@/lib/audience-library-rules";
import { useAudiencePlan, planRefusalCopy } from "@/hooks/use-audience-plan";
import { usePeaksQuote } from "@/hooks/use-peaks-quote";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { quoteCostSentence } from "@/lib/peaks-price-label";
import {
  AUDIENCE_OBJECTIVES,
  type AudienceObjective,
  type AudiencePlanResponse,
} from "@/lib/api/audiences";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Ask Peakhour who this business should be targeting.
 *
 * ★THE FEATURE THIS PRODUCT WAS SOLD ON, TURNED ON. `POST /v1/audiences/plan`
 * has shipped the entire chain since B2 — hypotheses reasoned in business
 * language, resolved deterministically against the platform's own typeahead,
 * counted for real reach, scored, argued against, and explained in prose — and
 * no client had ever called it, so `biz_audience_plans` was empty in every
 * environment and the Audiences page could only ever list what a customer had
 * typed in themselves.
 *
 * ★ONE QUESTION, WHICH IS DECISION D13. The engine already knows the industry,
 * the market type, the seniorities that matter and where the business operates
 * — it read them off the site, the business record and the published content.
 * The one thing it cannot infer is what this particular push is FOR, so that is
 * the only thing asked. Geography is deliberately NOT asked here: the profile
 * carries it with its evidence tier, and correcting it belongs on Your Business
 * where the correction is recorded as a stated fact rather than a one-off
 * override.
 *
 * ★IT MOVES NO BUDGET AND TOUCHES NO CAMPAIGN. The result is a set of named,
 * reusable library rows. Putting one on a campaign is a separate act, and
 * activating that campaign is a further one.
 *
 * ⚠️★AND IT IS NOT FREE. This said "IT SPENDS NOTHING", which is true of the
 * merchant's AD BUDGET and false of their Peaks: the api wraps this route in
 * `quotedAction("growth.propose_audiences")` and it bills two useCases. A
 * merchant reading "spends nothing" beside a button that costs them is
 * exactly the false-price-at-the-moment-of-the-ask that §7.0.1's correction
 * box records `ExplainCard` making, on a surface where the number is larger.
 *
 * ★SO THE PRICE IS SHOWN BEFORE THE ASK (§7.0.1 requirement 4, §7.9's
 * largest), and the QUOTE'S RECEIPT travels with the act — so the figure the
 * merchant accepted is the figure they are charged, even if ops edits the
 * rate card in between.
 */

/** What each objective means, in the customer's terms rather than the ad
 *  platform's. The keys are the api's enum — see `AUDIENCE_OBJECTIVES`. */
const OBJECTIVE_COPY: Record<AudienceObjective, { label: string; hint: string }> = {
  lead_generation: {
    label: "Get enquiries",
    hint: "People who could buy, close enough to the decision to fill in a form.",
  },
  website_traffic: {
    label: "Get visitors",
    hint: "A wider group worth bringing to the site to see what you do.",
  },
  brand_awareness: {
    label: "Get known",
    hint: "The market you want to be recognised in, whether or not they act today.",
  },
  engagement: {
    label: "Get engagement",
    hint: "People likely to read, react and follow — the audience that compounds.",
  },
};

export function DiscoverAudiencesDialog({
  open,
  onOpenChange,
  platform = "linkedin",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The channel to resolve against. A parameter, never a path segment — same
   *  rule the api's own surface follows. */
  platform?: string;
}) {
  const [objective, setObjective] = useState<AudienceObjective>("lead_generation");
  /**
   * ★QUOTED WHEN THE DIALOG OPENS, NOT WHEN THE PAGE RENDERS. The token's TTL
   * should start when the merchant is about to act — a receipt minted with
   * the page is already old by the time they choose an objective.
   *
   * ⏸AND IT DOES NOT DEPEND ON THE OBJECTIVE. `growth.propose_audiences` is
   * one registry action whatever this push is for, so re-quoting per
   * objective would mint four receipts to use one.
   */
  const price = usePeaksQuote(PEAKS_ACTIONS.proposeAudiences, open);
  const [result, setResult] = useState<AudiencePlanResponse | null>(null);

  const plan = useAudiencePlan({
    onPlanned: (res) => {
      setResult(res);
      if (res.sets.length > 0) {
        toast.success(
          `${res.sets.length} audience${res.sets.length === 1 ? "" : "s"} added to your library.`,
          { description: "Nothing is running — put one on a campaign when you're ready." },
        );
      }
    },
  });

  /** Closing throws the summary away — the audiences themselves are already in
   *  the library, so nothing is lost, and reopening should not show a stale
   *  result from a previous session. */
  function close(next: boolean) {
    if (!next && plan.isPending) return;
    if (!next) {
      setResult(null);
      plan.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden="true" />
            Find audiences worth targeting
          </DialogTitle>
          <DialogDescription>
            We already know your industry, your market and where you operate. Tell us what
            this push is for and we&apos;ll work out who to put in front of it — sized
            against the real platform, not estimated. Nothing starts spending.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <PlanSummary result={result} />
        ) : (
          <div className="space-y-2">
            {AUDIENCE_OBJECTIVES.map((key) => {
              const copy = OBJECTIVE_COPY[key];
              const picked = objective === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setObjective(key)}
                  aria-pressed={picked}
                  disabled={plan.isPending}
                  className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60 ${
                    picked ? "border-primary bg-muted/40" : ""
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {copy.label}
                    {picked && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{copy.hint}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ★THE PRICE, BEFORE THE ASK — and only while there is still an ask
            to make. Once `result` is set the act has happened and the charge
            is on the Peaks history; repeating the price there would read as a
            second one. */}
        {!result && <PriceLine price={price} />}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => close(false)}>
              See them in your library
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => close(false)}
                disabled={plan.isPending}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() =>
                  plan.mutate({
                    objective,
                    platform,
                    // ★THE RECEIPT FOR THE PRICE ON SCREEN. Absent when we
                    // could not quote — see the footer copy, which then does
                    // not claim a number either. Sending a token we never
                    // showed would be worse than sending none.
                    ...(price.quote ? { quoteToken: price.quote.token } : {}),
                  })
                } disabled={plan.isPending}>
                {/* Named rather than a spinner-with-"Loading": this really does
                    take the better part of a minute — a model call plus up to
                    four rounds of platform lookups and reach counts — and a
                    button that says nothing for that long reads as broken. */}
                {plan.isPending ? "Working out who to target…" : "Find audiences"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the session produced.
 *
 * ★INCLUDING WHAT IT DID NOT. A portfolio that started as five ideas and lost
 * four to resolution would otherwise render as a single audience reading "this
 * is all there was" — so the discarded ideas are counted, and the refusal, when
 * there is one, is a sentence rather than an empty list.
 */
/**
 * What this costs, in one line, before the merchant presses anything.
 *
 * ── ⚠️★★THE FOUR STATES, AND THE FOURTH IS THE ONE THAT GETS DROPPED ────
 *
 * `Free` · a number · *we are working it out* · **we could not price it**.
 * The advertising-declaration card's post-mortem names the same shape and the
 * same mistake: *"a consent surface has four states and the fourth is 'we do
 * not know yet'; treating it as either of the other three is how a form
 * collects an answer nobody gave."* Here the equivalent is quoting a price we
 * do not have.
 *
 * ★AND THE BUTTON STAYS LIVE WHEN WE CANNOT PRICE IT. The merchant can still
 * act; they are simply told we could not show the price first, and the act
 * then bills at the live rate card — which is exactly what happened on every
 * metered button before this existed. Disabling it would turn a transparency
 * feature into an outage, which is the chain §7.0.1's own correction box
 * says was priced wrongly the first time: *"a merchant who cannot see a cost
 * sentence is worse off than one who can; a merchant who cannot declare at
 * all is worse off than both."*
 */
function PriceLine({ price }: { price: ReturnType<typeof usePeaksQuote> }) {
  if (price.loading) {
    return (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Working out what this costs…
      </p>
    );
  }

  if (!price.quote) {
    return (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {/* ⚠️NO NUMBER AND NO "Free". We do not know, and the two failures
            below differ in whose problem it is — the api distinguishes them
            and a client that collapsed them would have an operator debugging
            a seeding gap as a client bug. */}
        {price.reason === "not_priced"
          ? "We can't show the price for this right now — it still uses Peaks."
          : "We couldn't check the price just now — this uses Peaks."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{quoteCostSentence(price.quote)}</p>
      {/* ★THE BREAKDOWN, WHEN THE TOTAL IS MADE OF MORE THAN ONE ACT. The api
          serves it precisely so a merchant asked to accept 40 Peaks can see it
          is two acts at 20 — *"a bare total invites the support question this
          feature exists to prevent"*. Hidden for a single-line quote, where it
          would only repeat the number above it. */}
      {!price.quote.free && price.quote.breakdown.length > 1 && (
        <ul className="text-xs text-muted-foreground">
          {price.quote.breakdown.map((line) => (
            <li key={line.useCase} className="flex justify-between gap-4">
              <span>{line.label}</span>
              {/* Each LINE branches on its own `free` too: a total can be
                  billable while one of its parts is not. */}
              <span>{line.free ? "Free" : `${line.peaks.toLocaleString()} Peaks`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function PlanSummary({ result }: { result: AudiencePlanResponse }) {
  const lost =
    (result.strategist?.rejected?.length ?? 0) + (result.strategist?.dropped?.length ?? 0);

  if (result.refusal) {
    const copy = planRefusalCopy(result.refusal.reason, result.refusal.message);
    return (
      <div className="space-y-1.5 rounded-md border p-3">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        {result.sets.length} audience{result.sets.length === 1 ? "" : "s"} are in your library
        now.
      </p>
      <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
        {result.sets.map((s, i) => (
          <li key={s.id ?? `${s.label}-${i}`} className="rounded-md border p-3">
            <p className="text-sm font-medium">{s.label}</p>
            {/* The engine's own sentence about who these people are, which is
                the half a customer can actually judge. */}
            {(s.explanation ?? s.description) && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.explanation ?? s.description}
              </p>
            )}
            {/* ★AND ITS OBJECTION TO ITSELF, shown rather than acted on.
                ★`note`, NOT THE OBJECT. A first cut typed this as `string[]` and
                called `.join(" ")` on it, which put `[object Object]` on the
                card — the critic has always emitted `{code, note, severity}`.
                The `code` stays unrendered: `note` is the sentence written for
                a customer and the code is for us. */}
            {s.critique?.length ? (
              <ul className="mt-1 space-y-0.5">
                {s.critique.map((c, ci) => {
                  const tone = critiqueTone(c.severity);
                  return (
                    <li key={`${c.code}-${ci}`} className={tone.className}>
                      <span className="font-medium">{tone.lead}</span> {c.note}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {/* ★A SET WITH NO ID DID NOT REACH THE LIBRARY. It is a real
                audience and worth reading, but nothing can be applied to a
                campaign from it — and rendering it identically to the others
                is what would make that discovery happen at activation time. */}
            {s.id === null && (
              <p className="mt-1 text-xs text-muted-foreground">
                We couldn&apos;t save this one — run it again to keep it.
              </p>
            )}
          </li>
        ))}
      </ul>
      {lost > 0 && (
        <p className="text-xs text-muted-foreground">
          {lost} further idea{lost === 1 ? "" : "s"} didn&apos;t survive — either the evidence
          was too thin or the channel couldn&apos;t express them.
        </p>
      )}
    </div>
  );
}
