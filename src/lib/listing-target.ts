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

/**
 * Should the "also post this to Google" panel be offered on this surface?
 *
 * ★★A `commit` OVERRIDE HIDES IT, AND THIS IS THE MOST DANGEROUS THING S5·4
 * GOT WRONG. An override means the plan does NOT go to
 * `POST /v1/scheduler/plans`, and the endpoints it goes to instead may not
 * carry `payload` at all — the News Desk approve route is `.strict()` and
 * derives the payload server-side from the idea. So the merchant's listing
 * body, offer window, coupon and button would be dropped in silence and the RAW
 * IDEA TEXT published to their public Maps and Search listing: a post they did
 * not write, on the page their customers read.
 *
 * ⚠️DEFAULTED OFF RATHER THAN LEFT TO EACH CALLER TO REMEMBER. Relying on every
 * override surface to opt out is the kind of rule that holds until somebody
 * adds the next one. An explicit `false` opts a surface back in once its
 * endpoint carries `payload` through.
 */
export function shouldOfferListing(args: {
  available: boolean;
  hidden?: boolean | undefined;
  hasCommitOverride: boolean;
  /**
   * The caller is ALREADY scheduling to the listing as one of its channels.
   *
   * ★★★AND THIS IS NOT HYPOTHETICAL — it is what the repurpose sheet does now.
   * `/v1/content/recommend-platforms` passes `includeListing: true`,
   * `googlebusiness` buckets as a social target, and the sheet turns it into a
   * channel entry — for exactly the allowlisted-and-connected merchant this
   * panel is offered to. Appending a second entry for the same channel gives
   * both the same `scheduledAtUtc` from `resolveStagger`, hence the same
   * `scheduledItemIdempotencyKey`, which the unique `by_idempotency` index
   * rejects on `insertMany` — AFTER the plan document is inserted. The merchant
   * gets an error toast and an orphaned plan.
   *
   * ⚠️SO IT IS HIDDEN, NOT DE-DUPLICATED. Silently dropping one of the two
   * would mean the panel the merchant filled in was ignored, or the channel
   * they picked was overwritten. Not offering it says the plainer thing: the
   * listing is already a target here.
   */
  alreadyTargeted: boolean;
}): boolean {
  if (args.alreadyTargeted) return false;
  if (args.hidden === true) return false;
  if (args.hidden === false) return args.available;
  return !args.hasCommitOverride && args.available;
}

/** What the listing adds to the committed plan — `null` when it adds nothing. */
export interface ListingPlanTarget {
  channel: string;
  payload: {
    text: string;
    hashtags: string[];
    mediaUrls?: string[];
    channelOptions: Record<string, unknown>;
  };
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
  // Blanks dropped, exactly as the rules count them.
  const media = args.draft.mediaUrls.map((u) => u.trim()).filter(Boolean);
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
      // ⚠️FORWARDED, BECAUSE THE RULES VALIDATE IT. `listingProblems` checks the
      // media cap and the https requirement, and the api reads media from
      // `payload.mediaUrls` — so leaving it out meant every image a merchant
      // chose would be validated and then silently dropped. Inert today (the
      // panel has no image input yet) and a silent loss the moment one is added,
      // which is the worst time to discover it.
      ...(media.length > 0 ? { mediaUrls: media } : {}),
      channelOptions: buildListingChannelOptions(args.draft),
    },
  };
}
