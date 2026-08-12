"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import {
  reconnectHref,
  ADS_LINKEDIN_PATH,
  LINKEDIN_ADS_PROVIDER,
} from "@/lib/integrations-connect";
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
    mutationFn: (body: { objective: AudienceObjective; platform?: string }) =>
      audiencesApi.plan(body),
    onSuccess: (res) => {
      // Every planned audience is a library row now, so every list of them is
      // stale the moment this returns.
      void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
      opts?.onPlanned?.(res);
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "NOT_CONNECTED" || code === "NEEDS_REAUTH") {
        // ★A REAL PRODUCT CONSTRAINT, SAID PLAINLY. The engine reasons about
        // the business on its own, but it will not hand over an audience it
        // cannot resolve to real entities and size against the platform — a
        // made-up reach is the number a customer divides their budget by. So
        // an ads connection is a prerequisite, and this is the one error on
        // this path with a fix the customer can perform.
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
        toast.error((err as ApiError).message || "We can't plan audiences for that channel yet.");
      } else {
        toastUnhandledApiError(err, "build an audience plan", "LinkedIn");
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
