"use client";

/**
 * useListingTarget — may this merchant post to their own Google listing, and is
 * their setup finished enough to try?
 *
 * ★THE DECISION ITSELF LIVES IN `lib/listing-target.ts`, not here. This repo
 * runs vitest without jsdom, so a rule inside a hook is a rule nothing asserts;
 * the same split as `components/presence/gbp-card-state.ts`. All this file does
 * is fetch the two facts and hand them over.
 *
 * ⚠️NEITHER FACT IS AUTHORISATION. `commitPlan` re-asks both questions
 * server-side, so the worst a wrong answer here does is show an affordance that
 * fails loudly — never a post on a merchant's public listing.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  listingTargetFrom,
  type IntegrationRowLike,
  type ListingTarget,
} from "@/lib/listing-target";
import { useSchedulerEntitlements } from "./use-scheduler-entitlements";

export { LISTING_CHANNEL, LISTING_PROVIDER } from "@/lib/listing-target";
export type { ListingTarget } from "@/lib/listing-target";

export function useListingTarget(): ListingTarget {
  const { data: ent } = useSchedulerEntitlements();
  // ★★THE KEY THE REST OF THE APP ALREADY USES for this endpoint, not a new
  // one. A private key would have been invalidated by nothing: a merchant who
  // picks their location and comes straight back to the composer would still
  // see the disabled toggle, for a minute, with no way to tell why. Sharing the
  // key means every existing invalidation — and the one the location picker now
  // fires — reaches this read too.
  const { data } = useQuery({
    queryKey: ["content-hub-integrations"],
    queryFn: () => api.get<{ integrations: IntegrationRowLike[] }>("/v1/integrations"),
    staleTime: 60_000,
  });
  return listingTargetFrom(ent?.gatedChannels?.enabled, data?.integrations);
}
