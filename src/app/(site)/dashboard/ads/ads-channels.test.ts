import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ADS_CHANNELS,
  isAdsChannelKey,
  getAdsChannel,
  nextAdsHubSearch,
  resolveAdsChannel,
  connectedAdsProviderKeys,
  metaAdsConnectionState,
} from "./ads-channels";

const NONE = new Set<string>();

describe("resolveAdsChannel", () => {
  it("an explicit valid ?channel= wins, even when that channel isn't connected", () => {
    // The Content hub's Manage deep-link must land where it points; the panel
    // then renders its own connect CTA.
    expect(resolveAdsChannel("x", NONE)).toBe("x");
    expect(resolveAdsChannel("linkedin", new Set(["x_ads"]))).toBe("linkedin");
  });

  it("falls back to the first CONNECTED channel when no param is given", () => {
    expect(resolveAdsChannel(null, new Set(["x_ads"]))).toBe("x");
    expect(resolveAdsChannel(undefined, new Set(["linkedin_ads"]))).toBe("linkedin");
  });

  it("prefers registry order when several channels are connected", () => {
    expect(resolveAdsChannel(null, new Set(["x_ads", "linkedin_ads"]))).toBe("linkedin");
  });

  it("falls back to the first registered channel when nothing is connected", () => {
    expect(resolveAdsChannel(null, NONE)).toBe(ADS_CHANNELS[0].key);
  });

  it("ignores an unknown or empty param instead of rendering a blank hub", () => {
    expect(resolveAdsChannel("google", new Set(["x_ads"]))).toBe("x");
    expect(resolveAdsChannel("", new Set(["x_ads"]))).toBe("x");
    // Keys are matched exactly — no case folding.
    expect(resolveAdsChannel("LinkedIn", new Set(["x_ads"]))).toBe("x");
  });
});

describe("isAdsChannelKey", () => {
  it("accepts registered keys only", () => {
    expect(isAdsChannelKey("linkedin")).toBe(true);
    expect(isAdsChannelKey("x")).toBe(true);
    expect(isAdsChannelKey("google")).toBe(false);
    expect(isAdsChannelKey(null)).toBe(false);
    expect(isAdsChannelKey(undefined)).toBe(false);
  });
});

describe("ADS_CHANNELS registry", () => {
  it("has unique keys and provider keys", () => {
    expect(new Set(ADS_CHANNELS.map((c) => c.key)).size).toBe(ADS_CHANNELS.length);
    expect(new Set(ADS_CHANNELS.map((c) => c.providerKey)).size).toBe(ADS_CHANNELS.length);
  });

  it("getAdsChannel round-trips every registered key", () => {
    for (const c of ADS_CHANNELS) {
      expect(getAdsChannel(c.key)).toBe(c);
    }
  });

  it("carries the provider keys the Content hub catalog routes from", () => {
    // Regression guard: these must match cfg_integrations.key /
    // int_connections.provider, or the hub can't tell connected from not.
    expect(ADS_CHANNELS.map((c) => c.providerKey)).toEqual(["linkedin_ads", "x_ads", "meta_ads"]);
  });
});

describe("nextAdsHubSearch", () => {
  const search = (q: string) => new URLSearchParams(q);

  it("sets the channel and drops params owned by the channel being left", () => {
    // X owns `account`; carrying it into LinkedIn would leak one channel's
    // state into another.
    expect(nextAdsHubSearch(search("channel=x&account=18ce54"), "linkedin")).toBe(
      "channel=linkedin",
    );
  });

  it("keeps the channel's own params when re-selecting it", () => {
    const out = search(nextAdsHubSearch(search("channel=x&account=18ce54"), "x"));
    expect(out.get("channel")).toBe("x");
    expect(out.get("account")).toBe("18ce54");
  });

  it("preserves unrelated params", () => {
    const out = search(nextAdsHubSearch(search("ref=email&account=abc"), "linkedin"));
    expect(out.get("ref")).toBe("email");
    expect(out.get("account")).toBeNull();
  });

  it("overwrites an invalid or absent channel", () => {
    expect(nextAdsHubSearch(search("channel=google"), "x")).toBe("channel=x");
    expect(nextAdsHubSearch(search(""), "x")).toBe("channel=x");
  });

  it("accepts Next's ReadonlyURLSearchParams shape (toString only)", () => {
    expect(nextAdsHubSearch({ toString: () => "channel=x&account=a1" }, "linkedin")).toBe(
      "channel=linkedin",
    );
  });
});

/**
 * ★★M-16 — the hub must EXPAND the `facebook` row before it matches.
 *
 * The api reports Meta as one `facebook` connection. The ads capability is the
 * virtual `meta_ads` row `flattenMetaIntegration` derives from it — connected
 * only when the parent is, the Ads capability is not switched off, and at least
 * one ad account exists. Fixtures are the api's shape: `account.extra` carrying
 * `capabilities` and `adAccounts`.
 */
describe("★★M-16 connectedAdsProviderKeys", () => {
  const facebook = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
    provider: "facebook",
    connected: true,
    status: "active",
    account: { extra: { adAccounts: [{ id: "act_1", name: "Main" }], capabilities: {}, ...extra } },
    ...over,
  });

  it("★★M-16 a Facebook connection with an ad account counts as meta_ads", () => {
    expect(connectedAdsProviderKeys([facebook()]).has("meta_ads")).toBe(true);
  });

  it("★★M-16 and so a Meta-only org opens on the Meta tab, not an empty LinkedIn one", () => {
    // THE DEFECT, END TO END. Matching the raw list, the set is {facebook} and
    // resolveAdsChannel falls back to the first registered channel.
    expect(resolveAdsChannel(null, connectedAdsProviderKeys([facebook()]))).toBe("meta");
  });

  it("★M-16 no ad account is not an ads connection", () => {
    expect(connectedAdsProviderKeys([facebook({}, { adAccounts: [] })]).has("meta_ads")).toBe(false);
  });

  it("★M-16 the Ads capability switched off is not an ads connection", () => {
    const off = facebook({}, { capabilities: { ads: { enabled: false } } });
    expect(connectedAdsProviderKeys([off]).has("meta_ads")).toBe(false);
  });

  it("★★M-16 a STALE Facebook connection still selects the Meta tab — the panel shows reconnect", () => {
    const stale = facebook({ connected: false, status: "needs_reauth" });
    expect(connectedAdsProviderKeys([stale]).has("meta_ads")).toBe(true);
  });

  it("★M-16 other providers pass through untouched", () => {
    const keys = connectedAdsProviderKeys([
      { provider: "x_ads", connected: true },
      { provider: "linkedin_ads", connected: false, status: "active" },
    ]);
    expect([...keys]).toEqual(["x_ads"]);
  });

  it("★★M-16 R1.2 a STALE connection with Ads switched off is NOT a Meta ads connection", () => {
    // `flattenMetaIntegration` copies the parent's status onto every virtual
    // row, so this came out as a `needs_reauth` meta_ads and the hub opened a
    // Pages-only merchant on the Meta tab behind a reconnect banner.
    const stale = facebook(
      { connected: false, status: "needs_reauth" },
      { capabilities: { ads: { enabled: false } } },
    );
    expect(connectedAdsProviderKeys([stale]).has("meta_ads")).toBe(false);
    expect(metaAdsConnectionState([stale])).toBe("absent");
  });

  it("★★M-16 R1.2 nor is a stale connection with no ad account", () => {
    const stale = facebook({ connected: false, status: "needs_reauth" }, { adAccounts: [] });
    expect(connectedAdsProviderKeys([stale]).has("meta_ads")).toBe(false);
    expect(metaAdsConnectionState([stale])).toBe("absent");
  });

  it("★★M-16 R1.2 but a stale Pages capability still counts for PAGES — the rule is per capability", () => {
    const stale = facebook(
      { connected: false, status: "needs_reauth" },
      { adAccounts: [], pages: [{ pageId: "p1", pageName: "Shop" }] },
    );
    const keys = connectedAdsProviderKeys([stale]);
    expect(keys.has("facebook_pages")).toBe(true);
    expect(keys.has("meta_ads")).toBe(false);
  });

  it("★M-16 the panel's gate: connected wins over a stale sibling row, and reauth is reported", () => {
    const live = facebook();
    const stale = facebook({ connected: false, status: "needs_reauth" });
    expect(metaAdsConnectionState([stale, live])).toBe("connected");
    expect(metaAdsConnectionState([stale])).toBe("needs_reauth");
    expect(metaAdsConnectionState([])).toBe("absent");
    expect(metaAdsConnectionState([{ provider: "x_ads", connected: true }])).toBe("absent");
  });

  /**
   * ★★b2c#573 round 2: ONE helper, EVERY channel, BOTH directions (it
   * replaces M-16's Meta-only R1.6 case, round 3). A key the registry refreshes
   * but no panel reads is a rename nobody followed.
   *
   * ⚠️SCOPE, STATED (round 3): the panel FILE's literal keys. Queries in
   * child components (the LinkedIn account picker, lead forms, targeting
   * dialog) are theirs to refresh, and a non-literal key (`xKeys.all`) is
   * invisible here.
   */
  const panelQueryPrefixes = (key: string) =>
    queryPrefixesIn(
      readFileSync(fileURLToPath(new URL(`./_components/${key}-ads-panel.tsx`, import.meta.url)), "utf8"),
    );
  const queryPrefixesIn = (src: string) => {
    // ★A KEY INSIDE `invalidateQueries({ queryKey })` IS NOT A QUERY THE PANEL
    // MAKES (review of b2c#573 round 3): counting it would make a stale
    // invalidation look like a live query and pin the registry to it.
    // ★THE WHOLE CALL IS REMOVED, NOT A LOOKBACK (review of b2c#575): a
    // 60-character lookback missed `{ exact: true, queryKey }`, a
    // `refetchType` first, or a comment between. Filter objects hold no
    // nested braces, so `[^}]*` spans the whole argument.
    const made = src.replace(/\b\w+Queries\(\s*\{[^}]*\}\s*\)/g, "");
    return [...new Set([...made.matchAll(/queryKey: \[\s*"([a-z0-9_-]+)"/g)].map((m) => m[1]!))];
  };
  /**
   * ★A FLOOR PER PANEL (review of b2c#573 round 3), as M-16's Meta case had:
   * a panel whose queries moved into a child component would otherwise pass
   * on an almost empty set, with the registry trimmed to match.
   */
  it("★the scrape counts queries a panel MAKES, not keys it only invalidates", () => {
    const src = [
      'useQuery({ queryKey: ["x-ads-live"], queryFn })',
      "useQuery({",
      '  queryKey: [',
      '    "x-ads-multi", id],',
      "})",
      'queryClient.invalidateQueries({ queryKey: ["x-ads-stale"] });',
      "queryClient.invalidateQueries({",
      '  queryKey: ["x-ads-stale-2"],',
      "});",
      'queryClient.invalidateQueries({ exact: true, queryKey: ["x-ads-stale-3"] });',
      'queryClient.refetchQueries({ refetchType: "all", queryKey: ["x-ads-stale-4"] });',
      "queryClient.invalidateQueries({",
      "  // a comment between the brace and the key",
      '  queryKey: ["x-ads-stale-5"],',
      "});",
    ].join("\n");
    expect(queryPrefixesIn(src)).toEqual(["x-ads-live", "x-ads-multi"]);
  });
  const MIN_PANEL_QUERIES: Record<string, number> = { linkedin: 2, meta: 7, x: 5 };
  for (const channel of ADS_CHANNELS) {
    it(`★★b2c#573 the ${channel.key} toolbar refreshes exactly the queries its panel file makes`, () => {
      const prefixes = panelQueryPrefixes(channel.key);
      expect(prefixes, "the panel's query keys").toContain("content-hub-integrations");
      // A new channel needs its own floor, and is told so (review of b2c#575).
      const floor = MIN_PANEL_QUERIES[channel.key];
      expect(floor, `add a MIN_PANEL_QUERIES floor for "${channel.key}"`).toBeTypeOf("number");
      expect(prefixes.length, "too few query keys — did they move to a child?").toBeGreaterThanOrEqual(floor!);
      const refreshed: readonly string[] = channel.invalidateQueryKeys.map((k) => k[0]);
      expect(prefixes.filter((p) => !refreshed.includes(p)), "made but not refreshed").toEqual([]);
      expect(refreshed.filter((p) => !prefixes.includes(p)), "refreshed but never made").toEqual([]);
    });
  }

  it("★M-16 leaving the Meta tab drops its ad-account param", () => {
    expect(nextAdsHubSearch(new URLSearchParams("channel=meta&adAccount=act_1"), "x")).toBe(
      "channel=x",
    );
  });
});
