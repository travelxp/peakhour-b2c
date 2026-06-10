import { describe, it, expect } from "vitest";
import { resolveChannelCta, STATIC_DASHBOARD_PATHS } from "./channel-cta";
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

  it("(c) connected + no path anywhere → Connected, dashboardPath undefined", () => {
    const r = resolveChannelCta(
      chan({ status: "available", dashboardPath: undefined, providerKey: "unknown_provider" }),
      { connected: true },
      STATIC,
    );
    expect(r.isConnected).toBe(true);
    expect(r.dashboardPath).toBeUndefined();
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
});
