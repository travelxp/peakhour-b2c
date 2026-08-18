import { describe, it, expect } from "vitest";
import {
  INTEGRATIONS_MANAGED_PROVIDERS,
  resolveChannelCta,
  STATIC_DASHBOARD_PATHS,
} from "./channel-cta";
import type { ChannelConfig } from "./channels.config";

const STATIC = new Map<string, string>([
  ["linkedin_content", "/dashboard/content/linkedin"],
]);

function chan(p: Partial<ChannelConfig>): Pick<ChannelConfig, "status" | "dashboardPath" | "providerKey"> {
  return {
    status: p.status ?? "live",
    dashboardPath: p.dashboardPath,
    providerKey: p.providerKey ?? "linkedin_content",
  };
}

describe("resolveChannelCta", () => {
  it("(a) connected + live → Connected, uses catalog dashboardPath", () => {
    const r = resolveChannelCta(
      chan({ status: "live", dashboardPath: "/dashboard/content/x", providerKey: "x" }),
      { connected: true },
      STATIC,
    );
    expect(r.isConnected).toBe(true);
    expect(r.dashboardPath).toBe("/dashboard/content/x");
  });

  it("(b) connected + 'available' + no catalog path → Connected via static fallback (the bug fix)", () => {
    const r = resolveChannelCta(
      chan({ status: "available", dashboardPath: undefined, providerKey: "linkedin_content" }),
      { connected: true },
      STATIC,
    );
    expect(r.isConnected).toBe(true);
    expect(r.dashboardPath).toBe("/dashboard/content/linkedin");
  });

  it("(c) connected + no path anywhere → Connected, managed via Integrations", () => {
    // This is the NORMAL state for the Meta capability rows (facebook_pages,
    // instagram, meta_ads) and wordpress: /dashboard/integrations IS where you
    // manage them. The action must stay enabled — only the label changes.
    const r = resolveChannelCta(
      chan({ status: "available", dashboardPath: undefined, providerKey: "meta_ads" }),
      { connected: true },
      STATIC,
    );
    expect(r.isConnected).toBe(true);
    expect(r.dashboardPath).toBeUndefined();
    expect(r.manageViaIntegrations).toBe(true);
    // meta_ads is integrations-managed BY DESIGN, so no dev warning.
    expect(r.configGap).toBe(false);
  });

  it("manageViaIntegrations is false whenever a path exists, and for unconnected rows", () => {
    expect(
      resolveChannelCta(
        chan({ status: "live", dashboardPath: "/dashboard/ads?channel=x", providerKey: "x_ads" }),
        { connected: true },
        STATIC,
      ).manageViaIntegrations,
    ).toBe(false);
    // Not connected → nothing to manage yet; the row shows Connect.
    expect(
      resolveChannelCta(
        chan({ status: "available", providerKey: "unknown_provider" }),
        { connected: false },
        STATIC,
      ).manageViaIntegrations,
    ).toBe(false);
  });

  it("configGap flags the REACHABLE linkedin_ads shape: available + no path + not integrations-managed", () => {
    // The shape that actually shipped broken. `toLifecycle` maps a pathless
    // catalog row to "available", never "live", so a `live`-keyed guard would
    // have missed this — that's why the predicate is status !== coming_soon.
    for (const connected of [true, false]) {
      expect(
        resolveChannelCta(
          chan({ status: "available", dashboardPath: undefined, providerKey: "linkedin_ads" }),
          { connected },
          STATIC,
        ).configGap,
      ).toBe(true);
    }
  });

  it("configGap stays quiet for genuinely integrations-managed providers", () => {
    // These have no screen by design — flagging them would be 4 false
    // positives per mount and would train people to ignore the warning.
    for (const providerKey of INTEGRATIONS_MANAGED_PROVIDERS) {
      expect(
        resolveChannelCta(
          chan({ status: "available", dashboardPath: undefined, providerKey }),
          { connected: true },
          STATIC,
        ).configGap,
      ).toBe(false);
    }
  });

  it("configGap is cleared by a path from either source, and never fires for coming_soon", () => {
    expect(
      resolveChannelCta(
        chan({ status: "available", dashboardPath: undefined, providerKey: "linkedin_content" }),
        { connected: true },
        STATIC,
      ).configGap,
    ).toBe(false);
    expect(
      resolveChannelCta(
        chan({ status: "live", dashboardPath: "/dashboard/ads?channel=x", providerKey: "x_ads" }),
        { connected: true },
        STATIC,
      ).configGap,
    ).toBe(false);
    // Not launched yet → nothing to route to, nothing to warn about.
    expect(
      resolveChannelCta(
        chan({ status: "coming_soon", dashboardPath: undefined, providerKey: "google_ads" }),
        undefined,
        STATIC,
      ).configGap,
    ).toBe(false);
  });

  it("an operator-blanked catalog path falls through to the static fallback", () => {
    // display.dashboardPath is `z.string().optional()`, so "" is storable —
    // `??` would treat it as set and strand the row.
    const r = resolveChannelCta(
      chan({ status: "available", dashboardPath: "", providerKey: "linkedin_content" }),
      { connected: true },
      STATIC,
    );
    expect(r.dashboardPath).toBe("/dashboard/content/linkedin");
    expect(r.manageViaIntegrations).toBe(false);
  });

  it("(d) not-connected + live → not Connected", () => {
    const r = resolveChannelCta(chan({ status: "live", providerKey: "x" }), { connected: false }, STATIC);
    expect(r.isConnected).toBe(false);
  });

  it("(e) not-connected + available → not Connected", () => {
    const r = resolveChannelCta(chan({ status: "available" }), undefined, STATIC);
    expect(r.isConnected).toBe(false);
  });

  it("(f) ★coming_soon + a real connection READS AS CONNECTED", () => {
    // This case asserted the opposite until 2026-08-18, on the premise that a
    // not-yet-launched channel could not have a real connection. shopify
    // disproves it: `channels.config.ts` carries it as `coming_soon`, and a
    // production merchant holds a live connection to it because App Store
    // installs never consult a lifecycle. The old rule gave that merchant a
    // disabled "Coming soon" row with no Connected badge.
    const r = resolveChannelCta(chan({ status: "coming_soon" }), { connected: true }, STATIC);
    expect(r.isConnected).toBe(true);
  });

  it("(f2) coming_soon with NO connection still reads as not-Connected", () => {
    // The lifecycle still governs every channel nobody is connected to, which
    // is the case it was actually written for.
    const r = resolveChannelCta(chan({ status: "coming_soon" }), { connected: false }, STATIC);
    expect(r.isConnected).toBe(false);
    expect(resolveChannelCta(chan({ status: "coming_soon" }), undefined, STATIC).isConnected).toBe(false);
  });
});

/**
 * ★`showsComingSoon` DRIVES CLICKABILITY, and it is the reason this lives in a
 * tested function instead of inline in the page.
 *
 * The first cut of this fix derived the rule inline in `page.tsx` as
 * `channel.status === "coming_soon" && !isConnected`. That covered only ACTIVE
 * connections, because `isConnected` is `connected`, which the API sets from
 * `status === "active"`. A production Shopify merchant in `needs_reauth`
 * therefore still got a DISABLED row badged "Coming soon" — the original bug,
 * surviving the fix for it, on a surface with no test file to catch it.
 *
 * `page.tsx` reads this value for `actionDisabled`, the button variant, the
 * button label and `StatusBadge`. These cases are what hold all four.
 */
describe("resolveChannelCta — showsComingSoon", () => {
  const SHOPIFY = { status: "coming_soon" as const, providerKey: "shopify" };

  it("signposts a coming-soon channel the org has never connected", () => {
    expect(resolveChannelCta(chan(SHOPIFY), undefined, STATIC).showsComingSoon).toBe(true);
    expect(
      resolveChannelCta(chan(SHOPIFY), { connected: false }, STATIC).showsComingSoon,
    ).toBe(true);
  });

  it("signposts a coming-soon channel the org disconnected", () => {
    expect(
      resolveChannelCta(chan(SHOPIFY), { connected: false, status: "disconnected" }, STATIC)
        .showsComingSoon,
    ).toBe(true);
  });

  it("★yields to a BROKEN connection — the case the inline version missed", () => {
    for (const status of ["needs_reauth", "expired", "error"]) {
      const r = resolveChannelCta(chan(SHOPIFY), { connected: false, status }, STATIC);
      expect(r.showsComingSoon).toBe(false);
      // Not connected either — the row is neither "Connected" nor "Coming
      // soon". It is reachable, which is the whole point: /dashboard/integrations
      // is where the Reconnect lives.
      expect(r.isConnected).toBe(false);
    }
  });

  it("yields to an ACTIVE connection", () => {
    const r = resolveChannelCta(
      chan(SHOPIFY),
      { connected: true, status: "active" },
      STATIC,
    );
    expect(r.showsComingSoon).toBe(false);
    expect(r.isConnected).toBe(true);
  });

  it("never signposts a channel that isn't coming_soon", () => {
    for (const status of ["live", "available"] as const) {
      expect(
        resolveChannelCta(chan({ status, providerKey: "x" }), undefined, STATIC).showsComingSoon,
      ).toBe(false);
    }
  });

  it("does not report a connected shopify row as a config gap", () => {
    // shopify has no dashboardPath in either source and is managed from
    // /dashboard/integrations, so the row becoming reachable must not start
    // firing the dev-only config-gap console.error.
    const r = resolveChannelCta(
      chan(SHOPIFY),
      { connected: false, status: "needs_reauth" },
      STATIC,
    );
    expect(r.dashboardPath).toBeUndefined();
    expect(r.configGap).toBe(false);
    expect(r.manageViaIntegrations).toBe(false); // not connected, so no "Manage"
  });

  it("keeps the eight genuinely-unlaunched rows out of configGap", () => {
    // Dropping the coming_soon clause outright (rather than keying it off the
    // presented state) would fire a console.error per unconnected coming-soon
    // row on every mount in dev.
    const r = resolveChannelCta(
      chan({ status: "coming_soon", providerKey: "youtube" }),
      undefined,
      STATIC,
    );
    expect(r.showsComingSoon).toBe(true);
    expect(r.configGap).toBe(false);
  });

  it("catalog dashboardPath takes precedence over the static fallback", () => {
    const r = resolveChannelCta(
      chan({ status: "available", dashboardPath: "/dashboard/content/linkedin-new", providerKey: "linkedin_content" }),
      { connected: true },
      STATIC,
    );
    expect(r.dashboardPath).toBe("/dashboard/content/linkedin-new");
  });

  it("real STATIC_DASHBOARD_PATHS carries linkedin_content (regression guard)", () => {
    // The exact invariant that broke: linkedin_content must have a fallback
    // path so a catalog row missing display.dashboardPath still deep-links.
    expect(STATIC_DASHBOARD_PATHS.get("linkedin_content")).toBe(
      "/dashboard/content/linkedin",
    );
  });

  it("real STATIC_DASHBOARD_PATHS routes both ad channels into the Ads hub", () => {
    // linkedin_ads had NO path in either source, so a connected org's Manage
    // fell through to /dashboard/integrations. Both ad channels now deep-link
    // into the one hub with the channel pre-selected.
    expect(STATIC_DASHBOARD_PATHS.get("linkedin_ads")).toBe("/dashboard/ads?channel=linkedin");
    expect(STATIC_DASHBOARD_PATHS.get("x_ads")).toBe("/dashboard/ads?channel=x");
  });
});
