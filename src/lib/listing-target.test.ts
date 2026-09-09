/**
 * S5·4 — whether the listing may be offered, and what it contributes.
 *
 * ★★THESE ARE THE DECISIONS THAT LIVE IN A CALL. Whether the listing's own body
 * is sent rather than the social post's, whether hashtags are appended, whether
 * a connection id is named — nothing in `local-post.ts`'s rules would notice
 * any of them changing, and this repo has no jsdom, so a rule left inside the
 * component is a rule nothing asserts.
 *
 * Killer titles are load-bearing — `scripts/mutate-compose-to-listing.mjs`
 * matches them for EQUALITY against vitest's JSON reporter.
 */
import { describe, it, expect } from "vitest";
import {
  listingPlanTarget,
  listingTargetFrom,
  shouldOfferListing,
  LISTING_CHANNEL,
  LISTING_PROVIDER,
  type IntegrationRowLike,
} from "./listing-target";
import { buildListingChannelOptions, emptyListingDraft, type ListingDraft } from "./local-post";

const connectedRow = (locationName: string | null): IntegrationRowLike => ({
  provider: LISTING_PROVIDER,
  connected: true,
  account: { extra: { locationName } },
});

const draft = (over: Partial<ListingDraft> = {}): ListingDraft => ({
  ...emptyListingDraft("Half price coffee all week."),
  ...over,
});

describe("listingTargetFrom — may we offer it", () => {
  it("★★★offers it when the business is allowlisted AND connected", () => {
    expect(listingTargetFrom([LISTING_CHANNEL], [connectedRow("locations/222")])).toEqual({
      available: true,
      locationPicked: true,
    });
  });

  it("★★★does NOT offer it to a business that is not allowlisted", () => {
    // commitPlan answers 403 CHANNEL_NOT_ENABLED — offering the panel would
    // produce a button that fails on every use.
    expect(listingTargetFrom([], [connectedRow("locations/222")]).available).toBe(false);
    expect(listingTargetFrom(["wordpress"], [connectedRow("locations/222")]).available).toBe(false);
  });

  it("★★★does NOT offer it when nothing is connected", () => {
    expect(listingTargetFrom([LISTING_CHANNEL], []).available).toBe(false);
    expect(
      listingTargetFrom([LISTING_CHANNEL], [{ provider: LISTING_PROVIDER, connected: false }])
        .available,
    ).toBe(false);
  });

  it("★★★treats an api that cannot answer as NOT enabled, never as yes", () => {
    // ⚠️THE OPTIMISTIC READING IS THE DANGEROUS ONE. An api predating
    // `gatedChannels` cannot have the gate either, and a request still in
    // flight has told us nothing.
    expect(listingTargetFrom(undefined, [connectedRow("locations/222")]).available).toBe(false);
    expect(listingTargetFrom([LISTING_CHANNEL], undefined).available).toBe(false);
  });

  it("★★★reads NULL as connected-but-unpicked, not as picked", () => {
    // The publisher refuses a connection with nothing selected, terminally.
    const t = listingTargetFrom([LISTING_CHANNEL], [connectedRow(null)]);
    expect(t.available).toBe(true);
    expect(t.locationPicked).toBe(false);
  });

  it("★★★reads an ABSENT locationName as unpicked too — an old api cannot say", () => {
    const t = listingTargetFrom([LISTING_CHANNEL], [
      { provider: LISTING_PROVIDER, connected: true, account: { extra: {} } },
    ]);
    expect(t.available).toBe(true);
    expect(t.locationPicked).toBe(false);
  });

  it("★★looks at the Business Profile row, not whichever row came first", () => {
    const rows: IntegrationRowLike[] = [
      { provider: "linkedin_content", connected: true, account: { extra: {} } },
      connectedRow("locations/222"),
    ];
    expect(listingTargetFrom([LISTING_CHANNEL], rows)).toEqual({
      available: true,
      locationPicked: true,
    });
  });

  it("★★the channel key and the provider name are different strings", () => {
    // zChannelKey is ^[a-z0-9]+$, so the channel cannot carry the underscore
    // the provider name has. Conflating them is why the scheduler could not
    // dispatch this channel at all until the mapping existed.
    expect(LISTING_CHANNEL).toBe("googlebusiness");
    expect(LISTING_PROVIDER).toBe("google_business_profile");
    expect(LISTING_CHANNEL).not.toBe(LISTING_PROVIDER);
  });
});

describe("shouldOfferListing — where the panel belongs", () => {
  it("★★★offers it on an ordinary compose surface", () => {
    expect(shouldOfferListing({ available: true, hasCommitOverride: false, alreadyTargeted: false })).toBe(true);
  });

  it("★★★HIDES it on a surface with its own commit, whose endpoint may drop the payload", () => {
    // ⚠️THE NEWS DESK APPROVE ROUTE IS .strict() and derives the payload
    // server-side, so the merchant's listing body, offer window, coupon and
    // button would be dropped in silence and the RAW IDEA TEXT published to
    // their public listing.
    expect(shouldOfferListing({ available: true, hasCommitOverride: true, alreadyTargeted: false })).toBe(false);
  });

  it("★★★lets an override surface opt back in explicitly", () => {
    // Once its endpoint carries payload through, false is how it says so.
    expect(
      shouldOfferListing({ available: true, hidden: false, hasCommitOverride: true, alreadyTargeted: false }),
    ).toBe(true);
  });

  it("★★★HIDES it when the caller is already scheduling to the listing", () => {
    // ⚠️NOT HYPOTHETICAL. The repurpose sheet targets googlebusiness now that
    // the recommender offers it — for exactly the allowlisted-and-connected
    // merchant this panel is offered to. Two entries for one channel take the
    // same scheduledAtUtc from resolveStagger, hence the same idempotency key,
    // which the unique index rejects on insertMany AFTER the plan document is
    // inserted: an error toast and an orphaned plan.
    expect(
      shouldOfferListing({ available: true, hasCommitOverride: false, alreadyTargeted: true }),
    ).toBe(false);
    // ★AND IT BEATS AN EXPLICIT OPT-IN TOO. "show it anyway" cannot be a way to
    // ask for the collision.
    expect(
      shouldOfferListing({
        available: true,
        hidden: false,
        hasCommitOverride: false,
        alreadyTargeted: true,
      }),
    ).toBe(false);
  });

  it("★★an explicit hide beats everything", () => {
    expect(shouldOfferListing({ available: true, hidden: true, hasCommitOverride: false, alreadyTargeted: false })).toBe(
      false,
    );
  });

  it("★★★never offers it when the merchant may not publish there anyway", () => {
    expect(shouldOfferListing({ available: false, hasCommitOverride: false, alreadyTargeted: false })).toBe(false);
    expect(shouldOfferListing({ available: false, hidden: false, hasCommitOverride: true, alreadyTargeted: false })).toBe(
      false,
    );
  });
});

describe("buildListingChannelOptions — the Call button, belt and braces", () => {
  it("★★★drops a stale URL when the button is Call, even though the rules already refuse it", () => {
    // ⚠️THE FIRST VERSION OF THIS TEST USED actionUrl: "", which cannot reach
    // the branch it was aimed at — `draft.actionUrl.trim()` is falsy, so a
    // mutant removing the CALL check never fired and scored as killed. A
    // fixture that could not come off the wire proves nothing.
    //
    // The pairing is reachable in practice: a merchant types a link, then
    // switches the button to Call. `listingProblems` refuses that so it never
    // reaches a commit — and this function drops the URL anyway, because the
    // api refuses a URL on a CALL and belt-and-braces here costs one condition.
    const opts = buildListingChannelOptions(
      draft({ actionType: "CALL", actionUrl: "https://acme.example" }),
    );
    expect(opts.actionType).toBe("CALL");
    expect(opts).not.toHaveProperty("actionUrl");
  });

  it("★★still carries the URL for every OTHER button", () => {
    // The control: a mutant that drops the URL unconditionally must not pass.
    const opts = buildListingChannelOptions(
      draft({ actionType: "SHOP", actionUrl: "https://acme.example/shop" }),
    );
    expect(opts.actionUrl).toBe("https://acme.example/shop");
  });
});

describe("listingPlanTarget — what it contributes", () => {
  const on = { offered: true, locationPicked: true, enabled: true };

  it("★★★contributes the listing channel when everything is in place", () => {
    const t = listingPlanTarget({ ...on, draft: draft() });
    expect(t?.channel).toBe(LISTING_CHANNEL);
  });

  it("★★★contributes NOTHING when the merchant did not turn it on", () => {
    // ⚠️THIS ONE LANDS ON A PAGE THEIR CUSTOMERS READ. A default-on panel would
    // mean somebody's first scheduled tweet also went to their storefront.
    expect(listingPlanTarget({ ...on, enabled: false, draft: draft() })).toBeNull();
  });

  it("★★★contributes NOTHING when the business may not publish there", () => {
    expect(listingPlanTarget({ ...on, offered: false, draft: draft() })).toBeNull();
  });

  it("★★★contributes NOTHING when no location has been picked", () => {
    expect(listingPlanTarget({ ...on, locationPicked: false, draft: draft() })).toBeNull();
  });

  it("★★★contributes NOTHING while the draft still has problems", () => {
    // The api refuses the same things — terminally, tomorrow. Stopping here is
    // the difference between a fixable form and a dead row.
    expect(listingPlanTarget({ ...on, draft: draft({ summary: "  " }) })).toBeNull();
    expect(
      listingPlanTarget({ ...on, draft: draft({ actionType: "SHOP", actionUrl: "" }) }),
    ).toBeNull();
  });

  it("★★★sends the listing's OWN body, not the social post's", () => {
    const t = listingPlanTarget({ ...on, draft: draft({ summary: "  Open late Friday.  " }) });
    expect(t?.payload.text).toBe("Open late Friday.");
  });

  it("★★★never sends hashtags to a listing", () => {
    // A Local Post renders on Maps and Search, not in a feed; the publisher
    // never appends them and the body is capped.
    const t = listingPlanTarget({ ...on, draft: draft() });
    expect(t?.payload.hashtags).toEqual([]);
  });

  it("★★★names no connection id, leaving the server to resolve it", () => {
    // ⚠️NAMING ONE would mean this surface keeping its own idea of which
    // connection is primary, and disagreeing with the server the day a merchant
    // holds two active Business Profile rows.
    const t = listingPlanTarget({ ...on, draft: draft() });
    expect(t).not.toHaveProperty("connectionId");
  });

  it("★★★forwards the images the rules validated", () => {
    // ⚠️VALIDATED AND THEN DROPPED IS THE WORST OF BOTH. listingProblems
    // checks the media cap and the https requirement, and the api reads media
    // from payload.mediaUrls — so omitting it meant a merchant's chosen image
    // passed every check and never left the browser.
    const t = listingPlanTarget({
      ...on,
      draft: draft({ mediaUrls: ["https://a.example/1.jpg"] }),
    });
    expect(t?.payload.mediaUrls).toEqual(["https://a.example/1.jpg"]);
  });

  it("★★omits mediaUrls entirely when there are none, rather than sending an empty array", () => {
    expect(listingPlanTarget({ ...on, draft: draft() })).not.toHaveProperty("payload.mediaUrls");
    expect(
      listingPlanTarget({ ...on, draft: draft({ mediaUrls: ["  "] }) }),
    ).not.toHaveProperty("payload.mediaUrls");
  });

  it("★★★carries the composed options through", () => {
    const t = listingPlanTarget({
      ...on,
      draft: draft({
        topicType: "OFFER",
        eventTitle: "Winter sale",
        eventStartDate: "2026-12-01",
        couponCode: "WINTER20",
      }),
    });
    expect(t?.payload.channelOptions).toMatchObject({
      topicType: "OFFER",
      event: { title: "Winter sale", startDate: "2026-12-01" },
      offer: { couponCode: "WINTER20" },
    });
  });
});
