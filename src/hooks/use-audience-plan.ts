"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  reconnectHref,
  adsProviderFor,
  ADS_LINKEDIN_PATH,
  LINKEDIN_ADS_PROVIDER,
} from "@/lib/integrations-connect";
import { platformLabel } from "@/lib/audience-library-rules";
import { toastUnhandledApiError } from "@/lib/toast-errors";
import {
  audiencesApi,
  type AudienceObjective,
  type AudiencePlanResponse,
} from "@/lib/api/audiences";

/**
 * Run a planning session — the engine working out who this business should be
 * targeting.
 *
 * ★SHARED, BECAUSE TWO SURFACES ASK THE SAME QUESTION FOR DIFFERENT REASONS.
 * The Audiences page asks it cold, so it has to ASK for the objective. The
 * campaign picker already knows the objective — the campaign carries one, and
 * `ad_campaigns.objective` is the same four-value enum `POST /plan` takes — so
 * it must not ask again. What they share is everything after the objective:
 * the call, the cache invalidation, and an error vocabulary in which exactly
 * one failure has a fix the customer can perform.
 *
 * ★IT IS SLOW AND IT COSTS, AND CALLERS MUST SAY SO. One request is a
 * strong-model call plus up to four rounds of platform typeaheads and reach
 * counts. Never fire it on mount.
 */
export function useAudiencePlan(opts?: { onPlanned?: (res: AudiencePlanResponse) => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quoteToken,
      ...body
    }: {
      objective: AudienceObjective;
      platform?: string;
      /** The receipt for the price the merchant just accepted (P-10).
       *  Absent means no price was shown, which is a different act. */
      quoteToken?: string;
    }) => audiencesApi.plan(body, quoteToken),
    onSuccess: (res) => {
      // Every planned audience is a library row now, so every list of them is
      // stale the moment this returns.
      void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
      opts?.onPlanned?.(res);
    },
    onError: (err, variables) => {
      const code = err instanceof ApiError ? err.code : undefined;
      /**
       * WARN A REFUSED QUOTE IS THE MERCHANT'S TO FIX, AND WITHOUT THIS IT
       * WAS NOT (review round 1). `quotedAction` answers 409
       * `QUOTE_NOT_HONOURED` and the handler never runs -- nothing charged,
       * nothing generated. Falling through to `toastUnhandledApiError`
       * classified it PERMANENT and showed a non-dismissable 'contact
       * support and quote reference X', discarding the api's own sentence:
       * *'That price quote has expired. Ask for a fresh quote and confirm
       * the new price.'*
       *
       * STAR THE API'S MESSAGE IS RENDERED RATHER THAN REPLACED. It varies
       * by reason -- expired, wrong action, unverifiable -- and
       * `quoteFailureMessage` exists precisely so every route says the same
       * thing about the same failure. A second wording here would be a
       * second source for one answer.
       *
       * OMITTED THE SURFACE RE-QUOTES ON ITS OWN (`usePeaksQuote` refetches
       * while open and withholds a lapsed receipt), so reaching this branch
       * means the refresh itself has been failing. Pressing again after one
       * is the honest instruction either way.
       */
      if (code === "QUOTE_NOT_HONOURED") {
        /**
         * WARN AND THE REFUSED RECEIPT IS THROWN AWAY (review round 2).
         * Without this the quote stayed in cache: `staleTime` is five
         * minutes, and both `shouldFetchOnMount` and
         * `shouldFetchOptionally` require `isStale` -- so neither pressing
         * again nor closing and reopening the dialog refetched. The client
         * re-sent the SAME refused token on every press for up to five
         * minutes, while the toast told the merchant to ask for a fresh
         * quote. The instruction was honest and the client ignored it.
         *
         * STAR EXPIRY IS NOT THE ONLY REASON A TOKEN IS REFUSED, which is
         * why the refetch loop did not already cover this.
         * `verifyQuoteToken` answers `malformed`, `bad_signature`,
         * `action_mismatch` or `expired` -- and only the last is visible to
         * a client reading `expiresAt`. A receipt refused after a secret
         * rotation is still FRESH by its own clock, so `deriveQuoteState`
         * goes on handing it out for ever. The api refusal is the only
         * evidence it is bad, so it is what has to invalidate it.
         *
         * OMITTED THE WHOLE NAMESPACE, NOT ONE KEY. This hook is told the
         * objective and the platform, never the action key the quote was
         * filed under -- and a refusal is evidence about our receipts in
         * general rather than about one of them. There is one quoted action
         * today, so the prefix and the key name the same query anyway.
         *
         * ⏸MUTATION: INERT. Deleting this line leaves the suite green —
         * there is no test file for this hook, because exercising it needs
         * a QueryClient provider and this repo has no DOM harness to mount
         * one in. Recorded rather than left to look covered. What IS
         * covered is the rule underneath it: `deriveQuoteState` withholds
         * a lapsed receipt, and `quoteTokenFor` refuses to attach one.
         */
        // ⚠️⚠️`resetQueries`, NOT `invalidateQueries` (review round 3, and
        // round 2 got this wrong). `invalidateQueries` marks the query
        // stale and refetches it -- but it KEEPS `data` until the refetch
        // returns. `deriveQuoteState` withholds only on EXPIRY, never on
        // an error, so throughout that window -- and for ever if the
        // re-quote itself fails -- the REFUSED token was still handed
        // out and still attached to the next press. Every press 409s,
        // where sending nothing would have succeeded at the live card.
        //
        // ★SO THE RECEIPT IS DISCARDED, NOT MERELY DOUBTED. `resetQueries`
        // drops the cached data and refetches the active query, which is
        // exactly the intent: we have positive evidence this receipt is
        // bad, and R1.1 says the safe fallback is ABSENCE -- no token
        // bills the live card and succeeds.
        queryClient.resetQueries({ queryKey: ["peaks-quote"] });
        toast.error("That price has changed.", {
          description:
            err instanceof ApiError && err.message
              ? err.message
              : "Ask for a fresh quote and confirm the new price.",
        });
        return;
      }
      /**
       * ★THE CHANNEL THE REQUEST WAS FOR, NOT A CONSTANT.
       *
       * The hook threads `platform` all the way into the request and then said
       * "LinkedIn" in every error — so the day an X campaign uses this, a
       * customer whose X Ads connection is stale is told to reconnect LinkedIn,
       * and the Connect button takes them to the LinkedIn ads page. The api and
       * the X audience adapter both support it today; this is the same
       * storage-key-in-a-headline defect the sibling apply path passes
       * `platformLabel(platform)` to avoid.
       *
       * Latent right now — every campaign in the ads panel is LinkedIn — which
       * is exactly why it would have shipped.
       */
      const platform = variables.platform ?? "linkedin";
      const channel = platformLabel(platform);
      if (code === "NOT_CONNECTED" || code === "NEEDS_REAUTH") {
        // ★A REAL PRODUCT CONSTRAINT, SAID PLAINLY. The engine reasons about
        // the business on its own, but it will not hand over an audience it
        // cannot resolve to real entities and size against the platform — a
        // made-up reach is the number a customer divides their budget by. So
        // an ads connection is a prerequisite, and this is the one error on
        // this path with a fix the customer can perform.
        toast.error(`Connect your ${channel} ads account first.`, {
          description:
            "We size every audience against the real platform rather than estimating it, so we need the connection before we can suggest any.",
          action: {
            label: "Connect",
            onClick: () => {
              // The ads hub is one surface with a `?channel=` parameter, so the
              // return path follows the platform too.
              const returnTo = `/dashboard/ads?channel=${encodeURIComponent(platform)}`;
              window.location.href = reconnectHref(
                platform === "linkedin" ? ADS_LINKEDIN_PATH : returnTo,
                adsProviderFor(platform) ?? LINKEDIN_ADS_PROVIDER,
              );
            },
          },
        });
      } else if (code === "RATE_LIMITED") {
        toast.error("Give us a moment — we're still working out the last one.");
      } else if (code === "PLATFORM_UNSUPPORTED") {
        toast.error((err as ApiError).message || "We can't plan audiences for that channel yet.");
      } else {
        toastUnhandledApiError(err, "build an audience plan", channel);
      }
    },
  });
}

/**
 * What to say when a plan comes back refused, and whether the customer can do
 * anything about it.
 *
 * ★THE TWO THAT ARE NOT FAILURES AT ALL COME BACK AS 200s. `no_geography` is a
 * question for the customer and `registry_empty` is our own unmigrated
 * database; the api records both as a plan row rather than pretending nothing
 * was asked, and neither should be dressed as an error.
 */
export function planRefusalCopy(
  reason: string,
  message: string,
): { title: string; body: string } {
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
