"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { useAudiencePlan, planRefusalCopy } from "@/hooks/use-audience-plan";
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
 * ★IT SPENDS NOTHING AND TOUCHES NO CAMPAIGN. The result is a set of named,
 * reusable library rows. Putting one on a campaign is a separate act, and
 * activating that campaign is a further one.
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
              <Button type="button" onClick={() => plan.mutate({ objective, platform })} disabled={plan.isPending}>
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
                {s.critique.map((c, ci) => (
                  <li
                    key={`${c.code}-${ci}`}
                    className={
                      c.severity === "warn"
                        ? "text-xs text-amber-700 dark:text-amber-300"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {c.severity === "warn" ? "Worth knowing: " : ""}
                    {c.note}
                  </li>
                ))}
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
