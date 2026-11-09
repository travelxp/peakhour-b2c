import { describe, it, expect } from "vitest";
import { filterChannels, groupChannels, type ChannelState } from "./channel-groups";
import type { ChannelConfig } from "./channels.config";

function chan(p: Partial<ChannelConfig> & { slug: string }): ChannelConfig {
  return {
    name: p.name ?? p.slug,
    description: p.description ?? "",
    category: p.category ?? "Social",
    providerKey: p.providerKey ?? p.slug,
    status: p.status ?? "live",
    ...p,
  } as ChannelConfig;
}

/** Build a `stateOf` from a slug → state map, defaulting to Available. */
const states =
  (map: Record<string, Partial<ChannelState>>) =>
  (c: ChannelConfig): ChannelState => ({
    isConnected: map[c.slug]?.isConnected ?? false,
    showsComingSoon: map[c.slug]?.showsComingSoon ?? false,
  });

describe("groupChannels", () => {
  const beehiiv = chan({ slug: "beehiiv" });
  const linkedin = chan({ slug: "linkedin" });
  const substack = chan({ slug: "substack" });
  const tiktok = chan({ slug: "tiktok" });

  it("orders the groups Connected → Available → Coming soon", () => {
    const groups = groupChannels(
      [substack, linkedin, tiktok, beehiiv],
      states({
        beehiiv: { isConnected: true },
        substack: { showsComingSoon: true },
      }),
    );
    expect(groups.map((g) => g.key)).toEqual(["connected", "available", "coming_soon"]);
    expect(groups[0].channels.map((c) => c.slug)).toEqual(["beehiiv"]);
    expect(groups[2].channels.map((c) => c.slug)).toEqual(["substack"]);
  });

  it("preserves catalog order within a group", () => {
    // Catalog order encodes the CMS's own priority; re-sorting inside a bucket
    // would throw that away for nothing.
    const groups = groupChannels([tiktok, linkedin, substack], states({}));
    expect(groups[1].channels.map((c) => c.slug)).toEqual(["tiktok", "linkedin", "substack"]);
  });

  it("puts a connected channel in Connected even when it also reads coming-soon", () => {
    // A merchant CAN hold a connection to a channel the catalog still calls
    // unlaunched — a Shopify App Store install never consults a lifecycle.
    const groups = groupChannels(
      [beehiiv],
      states({ beehiiv: { isConnected: true, showsComingSoon: true } }),
    );
    expect(groups[0].channels.map((c) => c.slug)).toEqual(["beehiiv"]);
    expect(groups[2].channels).toEqual([]);
  });

  it("treats a broken connection as Available, not Coming soon", () => {
    // Neither connected nor presented as coming-soon: the row has to stay in
    // the group the merchant can act on, because acting on it IS the fix.
    const groups = groupChannels(
      [linkedin],
      states({ linkedin: { isConnected: false, showsComingSoon: false } }),
    );
    expect(groups[1].channels.map((c) => c.slug)).toEqual(["linkedin"]);
  });

  it("always returns all three groups, empty ones included", () => {
    // The heading on an empty group is the point — "Connected: nothing yet" is
    // the most useful line on the page for a new merchant.
    const groups = groupChannels([], states({}));
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.channels.length === 0)).toBe(true);
    expect(groups[0].empty).toMatch(/nothing connected/i);
  });
});

describe("filterChannels", () => {
  const rows = [
    chan({ slug: "beehiiv", name: "Beehiiv", description: "Auto-tag every newsletter send.", category: "Newsletters" }),
    chan({ slug: "linkedin", name: "LinkedIn", description: "Publish to your company page.", category: "Social" }),
  ];

  it("returns everything for an empty or whitespace query", () => {
    expect(filterChannels(rows, "")).toHaveLength(2);
    expect(filterChannels(rows, "   ")).toHaveLength(2);
  });

  it("matches on name, case-insensitively", () => {
    expect(filterChannels(rows, "LINKED").map((c) => c.slug)).toEqual(["linkedin"]);
  });

  it("matches on description — the query most likely to be typed", () => {
    // Somebody looking for a newsletter tool does not necessarily know it is
    // called Beehiiv.
    expect(filterChannels(rows, "newsletter").map((c) => c.slug)).toEqual(["beehiiv"]);
  });

  it("matches on category", () => {
    expect(filterChannels(rows, "social").map((c) => c.slug)).toEqual(["linkedin"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterChannels(rows, "zzzz")).toEqual([]);
  });
});
