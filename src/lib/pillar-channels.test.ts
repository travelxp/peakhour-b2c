import { describe, it, expect } from "vitest";
import { badgedComingSoonKeys, PILLAR_CONNECTOR_KEYS } from "./pillar-channels";
import { STATIC_FALLBACK_KEYS } from "./integrations-fallback";
import type { ResolvedIntegration } from "./catalog";
import { CHANNELS } from "@/app/(site)/dashboard/content/channels.config";

/**
 * The homepage states connector availability in two places — the pillar chips
 * and the integrations grid — and before this rule existed they could only
 * ever agree by accident.
 *
 * The fixture below is the shape production actually returns, and getting that
 * wrong is not hypothetical: an earlier draft of this rule read
 * `cappedByPlatformStage` as a global gate, returned nothing whenever any row
 * carried it, and would have deleted all eleven badges the live grid shows.
 * The tests it shipped with agreed with it, because they were written from the
 * same wrong picture. These are built from a captured response instead.
 */

function row(
  key: string,
  over: Partial<ResolvedIntegration> = {},
): ResolvedIntegration {
  return {
    key,
    name: key,
    category: "social_publish",
    status: "live",
    surfacedState: "connectable",
    cappedByPlatformStage: false,
    isAvailable: true,
    ...over,
  };
}

/**
 * A connector that is LIVE, held back only because the platform hasn't
 * launched. The resolver forces `surfacedState` to coming_soon AND sets the
 * cap flag — the flag being the only thing separating it from the row below.
 */
const heldByStage = (key: string) =>
  row(key, {
    status: "live",
    surfacedState: "coming_soon",
    cappedByPlatformStage: true,
    // Held back means NOT connectable — `isAvailable` implies connectable in
    // the resolver, so `true` here would be a row it cannot emit.
    isAvailable: false,
  });

/** A connector that genuinely isn't built yet. Never carries the cap flag. */
const notBuiltYet = (key: string) =>
  row(key, {
    status: "coming_soon",
    surfacedState: "coming_soon",
    cappedByPlatformStage: false,
    isAvailable: false,
  });

/**
 * GET https://api.peakhour.ai/v1/platform/catalog at stage "coming_soon" — all
 * 19 published rows, split as production splits them across the four fields
 * the rule actually reads (key, status, surfacedState, cappedByPlatformStage)
 * plus isAvailable. `name` and `category` are stand-ins; don't extend the
 * predicate onto them without capturing a fresh response.
 *
 * Every row reads `surfacedState: "coming_soon"` — only the cap flag tells the
 * two halves apart, which is the whole point of the fixture.
 */
const PROD: ResolvedIntegration[] = [
  ...[
    "beehiiv",
    "facebook_pages",
    "instagram",
    "linkedin_content",
    "meta_ads",
    "whatsapp",
    "x",
    "x_ads",
  ].map(heldByStage),
  ...[
    "ghost",
    "google_ads",
    "gsc",
    "kit",
    "linkedin_ads",
    "mailchimp",
    "shopify",
    "slack",
    "substack",
    "wordpress",
    "youtube",
  ].map(notBuiltYet),
];

/** The predicate page.tsx applied inline before the rule was extracted. */
const wasBadgedBefore = (i: ResolvedIntegration) =>
  i.surfacedState === "coming_soon" && !i.cappedByPlatformStage;

describe("badgedComingSoonKeys", () => {
  it("falls back to the static allow-list when the catalog is gone", () => {
    /**
     * Reachable in production — getPublicCatalog() returns null on any fetch
     * failure and / is dynamic. The grid degrades to a list of connectors
     * that are genuinely live; returning [] here would leave the chips
     * claiming the six that list deliberately omits.
     */
    expect([...badgedComingSoonKeys({ published: [], all: [] })].sort()).toEqual([
      "google_ads",
      "google_business_profile",
      "linkedin_ads",
      "shopify",
      "wordpress",
    ]);
  });

  it("vouches for exactly what the degraded grid vouches for", () => {
    // Both surfaces answer "what does this page still call live" from one
    // list, so a chip can never outlive a card.
    const badged = new Set(badgedComingSoonKeys({ published: [], all: [] }));
    for (const key of PILLAR_CONNECTOR_KEYS) {
      expect(badged.has(key), key).toBe(!STATIC_FALLBACK_KEYS.has(key));
    }
  });

  it("badges what production badges, and spares the live rows the stage is holding", () => {
    // The regression test for the global-gate bug: eleven, not zero.
    expect([...badgedComingSoonKeys({ published: PROD, all: PROD })].sort()).toEqual([
      "ghost",
      "google_ads",
      // Named by a Presence chip, absent from the catalog → fail-closed.
      "google_business_profile",
      "gsc",
      "kit",
      "linkedin_ads",
      "mailchimp",
      "shopify",
      "slack",
      "substack",
      "wordpress",
      "youtube",
    ]);
  });

  it("spares every chip whose connector is live-but-held, and badges the four that aren't", () => {
    const keys = new Set(badgedComingSoonKeys({ published: PROD, all: PROD }));
    for (const key of [
      "whatsapp",
      "instagram",
      "facebook_pages",
      "meta_ads",
      "linkedin_content",
      "x",
      "x_ads",
      "beehiiv",
    ]) {
      expect(keys.has(key), key).toBe(false);
    }
    for (const key of ["shopify", "wordpress", "linkedin_ads", "google_ads"]) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  it("agrees with the per-card predicate the grid used before it", () => {
    /**
     * The refactor's actual contract: for every row the grid renders, the
     * shared rule must answer exactly what the inline predicate answered. Run
     * over the production fixture so it covers BOTH sides of the flag — a
     * fixture with no capped rows exercises only the branch where the two
     * cannot differ, which is how the bug got through the first time.
     */
    const keys = new Set(badgedComingSoonKeys({ published: PROD, all: PROD }));
    for (const i of PROD) expect(keys.has(i.key), i.key).toBe(wasBadgedBefore(i));
  });

  it("fails CLOSED for a chip the catalog does not carry at all", () => {
    const live = PILLAR_CONNECTOR_KEYS.filter((k) => k !== "shopify").map((k) =>
      row(k),
    );
    expect(badgedComingSoonKeys({ published: live, all: live })).toEqual(["shopify"]);
  });

  it("does not announce a RETIRING connector as an arriving one", () => {
    // `deprecated` is filtered out of the marketing view, so such a row is
    // absent from `published` exactly like one that was never built — and the
    // fail-closed branch would read it backwards. The second argument is the
    // only thing that tells them apart.
    const live = PILLAR_CONNECTOR_KEYS.filter((k) => k !== "beehiiv").map((k) =>
      row(k),
    );
    const all = [
      ...live,
      row("beehiiv", { status: "deprecated", surfacedState: "deprecated" }),
    ];
    expect(badgedComingSoonKeys({ published: live, all: all })).toEqual([]);
  });

  it("leaves locked and deprecated PUBLISHED rows alone", () => {
    // Only `coming_soon` was ever badged. A locked or deprecated row says
    // something else, and the refactor must not start speaking for it.
    const rows = PILLAR_CONNECTOR_KEYS.map((k) =>
      k === "shopify"
        ? row(k, { surfacedState: "locked", isLockedByPlan: true })
        : k === "beehiiv"
          ? row(k, { status: "deprecated", surfacedState: "deprecated" })
          : row(k),
    );
    expect(badgedComingSoonKeys({ published: rows, all: rows })).toEqual([]);
  });
});

describe("PILLAR_CONNECTOR_KEYS", () => {
  it("collects every key the pillar chips name, once", () => {
    /**
     * Spelled out rather than re-derived. Recomputing the same expression the
     * implementation uses compares the code to a copy of itself and asserts
     * nothing — in particular it would not notice the dedupe breaking, or a
     * key-less surface starting to contribute an `undefined`.
     *
     * whatsapp, wordpress, instagram, facebook_pages and linkedin_content
     * each serve two pillars; the four surfaces contribute nothing.
     */
    expect([...PILLAR_CONNECTOR_KEYS].sort()).toEqual([
      "beehiiv",
      "facebook_pages",
      "google_ads",
      "google_business_profile",
      "instagram",
      "linkedin_ads",
      "linkedin_content",
      "meta_ads",
      "shopify",
      "whatsapp",
      "wordpress",
      "x",
      "x_ads",
    ]);
  });

  it("spells every key the way the connector registry does", () => {
    /**
     * A typo here fails closed, so it would never show as a false claim — it
     * would show as a chip stuck reading "soon" forever, which nobody would
     * think to question. This is the check that catches it first.
     *
     * `CHANNELS[].providerKey` is a NEAR-mirror, not the same namespace: it is
     * the api's provider-registry name, while a chip resolves against
     * `cfg_integrations.key`. The two coincide for every row today and nothing
     * enforces that they must — so read a failure here as "go check the
     * catalog key", not as proof the key is wrong. (provider-names.ts is a
     * third namespace again — OAuth-callback display names — and says
     * `google_search_console` where the catalog says `gsc`. Not usable here.)
     */
    const known = new Set(CHANNELS.map((c) => c.providerKey));
    const NO_CHANNEL_ROW: Record<string, string> = {
      // Registered in the api and seeded by migration 168, but the Channels
      // Hub is a CONTENT surface and Presence isn't content, so it has no row.
      google_business_profile: "presence connector, not a content channel",
    };
    for (const key of PILLAR_CONNECTOR_KEYS) {
      expect(
        known.has(key) || key in NO_CHANNEL_ROW,
        `${key} is neither a Channels Hub providerKey nor a documented exception`,
      ).toBe(true);
    }
  });
});
