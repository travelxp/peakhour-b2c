/**
 * Two decisions the compose-to-listing panel rests on, kept where they can be
 * tested — the same shape as `components/presence/gbp-card-state.ts`, and for
 * the same reason: this repo runs vitest without jsdom, so a rule that lives
 * inside a component is a rule nothing asserts.
 *
 *   1. MAY this merchant be offered the panel at all.
 *   2. WHAT, if anything, the listing contributes to the committed plan.
 *
 * ★★THE SECOND IS THE ONE MUTATION TESTING CAN SEE AND A COMPONENT CANNOT.
 * Whether the listing's own body is sent (rather than the social post's),
 * whether hashtags are appended, and whether a connection id is named are all
 * decisions that live in a CALL. Nothing about the rules in `local-post.ts`
 * would notice any of them changing.
 */

import {
  buildListingChannelOptions,
  listingProblems,
  type ListingDraft,
} from "./local-post";

/** The channel key. Flat lowercase because `zChannelKey` is `^[a-z0-9]+$`. */
export const LISTING_CHANNEL = "googlebusiness";

/** The `int_connections.provider` the channel publishes through. Different
 *  string, deliberately — the channel key cannot carry an underscore. */
export const LISTING_PROVIDER = "google_business_profile";

export interface ListingTarget {
  /** Show the panel at all. */
  available: boolean;
  /** False when connected but no location is chosen — the panel says so and
   *  points at the picker rather than offering a toggle that would fail. */
  locationPicked: boolean;
}

/** Just enough of `GET /v1/integrations` to answer the question. */
export interface IntegrationRowLike {
  provider: string;
  connected?: boolean;
  account?: { extra?: { locationName?: string | null } };
}

/**
 * May this merchant be offered "also post this to Google"?
 *
 * ★★TWO INDEPENDENT FACTS, BOTH REQUIRED, and checking only one offers a button
 * the server refuses:
 *
 *   - `googlebusiness` is an allowlist-gated destination, so `commitPlan`
 *     answers 403 `CHANNEL_NOT_ENABLED` for a business that is not on the
 *     per-business list.
 *   - The publisher refuses a connection with no location picked, and that
 *     refusal is TERMINAL — the item ends at `failed`.
 *
 * ⚠️NEITHER IS AUTHORISATION. The server re-asks both, so the worst a wrong
 * answer here does is show an affordance that fails loudly — never a post on a
 * merchant's public listing.
 */
export function listingTargetFrom(
  gatedEnabled: readonly string[] | undefined,
  integrations: readonly IntegrationRowLike[] | undefined,
): ListingTarget {
  // ★ABSENT MEANS NOT ENABLED, NEVER "ASSUME YES". An api that predates
  // `gatedChannels` cannot have the gate either, and a request still in flight
  // has told us nothing — offering the panel in either case produces a 403 on
  // every commit.
  const enabled = gatedEnabled?.includes(LISTING_CHANNEL) ?? false;

  const row = integrations?.find((i) => i.provider === LISTING_PROVIDER);
  const connected = row?.connected === true;
  // ⚠️A STRING, NOT MERELY TRUTHY. The field is three-valued: `null` means
  // connected with nothing picked, `undefined` means an api too old to say.
  // Both must read as not-picked.
  const locationPicked = typeof row?.account?.extra?.locationName === "string";

  return { available: enabled && connected, locationPicked };
}

/** What the listing adds to the committed plan — `null` when it adds nothing. */
export interface ListingPlanTarget {
  channel: string;
  payload: { text: string; hashtags: string[]; channelOptions: Record<string, unknown> };
}

/**
 * The channel entry the listing contributes, or `null`.
 *
 * ★THE THREE CONDITIONS ARE AND-ED, and each is a different failure if dropped:
 * not offered (the business is not allowlisted, so the server 403s), no
 * location picked (the publisher refuses terminally), toggle off (the merchant
 * did not ask — and this one lands on a page their CUSTOMERS read).
 *
 * ⚠️AND A DRAFT WITH PROBLEMS CONTRIBUTES NOTHING. The api refuses the same
 * things, but its refusal ends the scheduled item at `failed` tomorrow; the
 * composer's job is to stop before that, not to send it anyway.
 */
export function listingPlanTarget(args: {
  offered: boolean;
  locationPicked: boolean;
  enabled: boolean;
  draft: ListingDraft;
}): ListingPlanTarget | null {
  if (!args.offered || !args.locationPicked || !args.enabled) return null;
  if (listingProblems(args.draft).length > 0) return null;
  return {
    channel: LISTING_CHANNEL,
    // ★NO connectionId. `resolveConnection` maps the channel key to the
    // provider and picks the business's connection deterministically — naming
    // one here would mean this surface keeping its own idea of which row is
    // primary, and disagreeing with the server the day a merchant holds two.
    payload: {
      // ★THE LISTING'S OWN BODY, trimmed — never the social post's.
      text: args.draft.summary.trim(),
      // ★NO HASHTAGS, EVER. A Local Post renders on a Maps and Search listing,
      // not in a feed; the publisher never appends them and sending them here
      // would only pad a payload that is capped.
      hashtags: [],
      channelOptions: buildListingChannelOptions(args.draft),
    },
  };
}
