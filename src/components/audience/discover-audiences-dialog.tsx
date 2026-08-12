"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  reconnectHref,
  ADS_LINKEDIN_PATH,
  LINKEDIN_ADS_PROVIDER,
} from "@/lib/integrations-connect";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import {
  audiencesApi,
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

/**
 * What to say when a plan cannot be built, and whether the customer can do
 * anything about it.
 *
 * ★THE TWO THAT ARE NOT FAILURES AT ALL COME BACK AS 200s. `no_geography` is a
 * question for the customer and `registry_empty` is our own unmigrated
 * database; the api records both as a plan row rather than pretending nothing
 * was asked, and neither should be dressed as an error here.
 */
function refusalCopy(reason: string, message: string): { title: string; body: string } {
  switch (reason) {
    case "no_profile":
      return {
        title: "We don't know enough about you yet",
        body: "Build your business profile first — it's what every audience is worked out from.",
      };
    case "no_geography":
    case "geo_unresolved":
      return {
        title: "We need to know where you operate",
        body: "Set the countries on Your Business and we'll work the audiences out from there.",
      };
    default:
      return { title: "We couldn't build a plan", body: message };
  }
}

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
  const queryClient = useQueryClient();
  const [objective, setObjective] = useState<AudienceObjective>("lead_generation");
  const [result, setResult] = useState<AudiencePlanResponse | null>(null);

  const plan = useMutation({
    mutationFn: () => audiencesApi.plan({ objective, platform }),
    onSuccess: (res) => {
      setResult(res);
      // Every planned audience is a library row now, so the list behind this
      // dialog is stale the moment the request returns.
      void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
      if (res.sets.length > 0) {
        toast.success(
          `${res.sets.length} audience${res.sets.length === 1 ? "" : "s"} added to your library.`,
          { description: "Nothing is running — put one on a campaign when you're ready." },
        );
      }
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NOT_CONNECTED" || code === "NEEDS_REAUTH") {
        // ★A REAL PRODUCT CONSTRAINT, SAID PLAINLY. The engine reasons about
        // the business on its own, but it will not hand over an audience it
        // cannot resolve to real entities and size against the platform — a
        // made-up reach is the number a customer divides their budget by. So
        // an ads connection is a prerequisite, and this is the one error on
        // this surface with a fix the customer can perform.
        toast.error("Connect your ads account first.", {
          description:
            "We size every audience against the real platform rather than estimating it, so we need the connection before we can suggest any.",
          action: {
            label: "Connect",
            onClick: () => {
              window.location.href = reconnectHref(ADS_LINKEDIN_PATH, LINKEDIN_ADS_PROVIDER);
            },
          },
        });
      } else if (code === "RATE_LIMITED") {
        toast.error("Give us a moment — we're still working out the last one.");
      } else if (code === "PLATFORM_UNSUPPORTED") {
        toast.error(
          (err as ApiError).message || "We can't plan audiences for that channel yet.",
        );
      } else {
        toastUnhandledApiError(err, "build an audience plan", "LinkedIn");
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
              <Button type="button" onClick={() => plan.mutate()} disabled={plan.isPending}>
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
    const copy = refusalCopy(result.refusal.reason, result.refusal.message);
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
            {/* ★AND ITS OBJECTION TO ITSELF, shown rather than acted on. */}
            {s.critique?.length ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Worth knowing: {s.critique.join(" ")}
              </p>
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
