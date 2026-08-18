import { describe, it, expect } from "vitest";
import { badgedComingSoonKeys, PILLAR_CONNECTOR_KEYS } from "./pillar-channels";
import { PILLAR_ORDER, PILLARS } from "./pillars";
import type { ResolvedIntegration } from "./catalog";
import { CHANNELS } from "@/app/(site)/dashboard/content/channels.config";

/**
 * The homepage states connector availability in two places — the pillar chips
 * and the integrations grid — and before this rule existed they could only
 * ever agree by accident. These pin the three ways the rule refuses to badge
 * and the two ways it insists on it.
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

/** Every key the chips name, so "not published" is genuinely not published. */
const ALL_PUBLISHED = PILLAR_CONNECTOR_KEYS.map((k) => row(k));

describe("badgedComingSoonKeys", () => {
  it("badges nothing when the catalog published nothing", () => {
    // The grid is on its static fallback here, which only lists live
    // connectors — a chip saying "soon" would be the page contradicting itself
    // in the other direction.
    expect(badgedComingSoonKeys([])).toEqual([]);
  });

  it("badges nothing while the platform stage is capping", () => {
    // Today's production state: the resolver marks every row coming_soon, so a
    // badge would describe the platform rather than the connector.
    const capped = ALL_PUBLISHED.map((i) =>
      row(i.key, { surfacedState: "coming_soon", cappedByPlatformStage: true }),
    );
    expect(badgedComingSoonKeys(capped)).toEqual([]);
  });

  it("suppresses badges when only SOME rows carry the cap", () => {
    // The cap is global in practice; a mixed response means we can't tell what
    // the badge would be about, and the conservative read is silence.
    const mixed = [
      row("shopify", { surfacedState: "coming_soon", cappedByPlatformStage: true }),
      row("whatsapp"),
    ];
    expect(badgedComingSoonKeys(mixed)).toEqual([]);
  });

  it("badges the rows the resolver marks coming_soon, and no others", () => {
    const keys = badgedComingSoonKeys(
      ALL_PUBLISHED.map((i) =>
        i.key === "google_ads"
          ? row(i.key, { status: "coming_soon", surfacedState: "coming_soon" })
          : i,
      ),
    );
    expect(keys).toEqual(["google_ads"]);
  });

  it("fails CLOSED for a chip the catalog does not publish at all", () => {
    // Silence would be the over-claim: we cannot prove it is live.
    const withoutShopify = ALL_PUBLISHED.filter((i) => i.key !== "shopify");
    expect(badgedComingSoonKeys(withoutShopify)).toEqual(["shopify"]);
  });

  it("never badges a grid row that isn't coming_soon, whatever the chips need", () => {
    // The fail-closed clause reads pillar keys, which are a superset of no
    // grid row — every card the grid renders IS a published row.
    const keys = new Set(badgedComingSoonKeys(ALL_PUBLISHED));
    for (const i of ALL_PUBLISHED) expect(keys.has(i.key)).toBe(false);
  });
});

describe("PILLAR_CONNECTOR_KEYS", () => {
  it("collects every key the pillar chips name, once", () => {
    const fromContent = PILLAR_ORDER.flatMap((slug) =>
      PILLARS[slug].channels.flatMap((c) => (c.key ? [c.key] : [])),
    );
    expect([...PILLAR_CONNECTOR_KEYS].sort()).toEqual(
      [...new Set(fromContent)].sort(),
    );
    // whatsapp, wordpress, instagram and facebook_pages each serve two
    // pillars — the dedupe is the point, not an accident of the fixture.
    expect(PILLAR_CONNECTOR_KEYS.length).toBeLessThan(fromContent.length);
  });

  it("spells every key the way the provider registry does", () => {
    /**
     * A typo here fails closed, so it would never show as a false claim — it
     * would show as a chip stuck reading "soon" forever, which nobody would
     * think to question. This is the check that catches it first.
     *
     * The Channels Hub registry is the local mirror of the api's provider
     * names, so it is the source of truth available to a unit test. Keys with
     * no channel row yet are listed explicitly, with the reason.
     */
    const known = new Set(CHANNELS.map((c) => c.providerKey));
    const NO_CHANNEL_ROW_YET: Record<string, string> = {
      // Presence's connector. Registered in the api (see provider-names.ts)
      // and grouped under "google" in the catalog, but it has no Channels Hub
      // row because the hub is a CONTENT surface and Presence isn't content.
      google_business_profile: "presence connector, not a content channel",
    };
    for (const key of PILLAR_CONNECTOR_KEYS) {
      expect(
        known.has(key) || key in NO_CHANNEL_ROW_YET,
        `${key} is neither a Channels Hub providerKey nor a documented exception`,
      ).toBe(true);
    }
  });
});
