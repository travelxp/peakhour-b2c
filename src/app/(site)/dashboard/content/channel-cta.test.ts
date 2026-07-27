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

  it("(f) coming_soon never reads as Connected, even if integration says connected", () => {
    const r = resolveChannelCta(chan({ status: "coming_soon" }), { connected: true }, STATIC);
    expect(r.isConnected).toBe(false);
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
