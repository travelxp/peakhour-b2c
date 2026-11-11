import { describe, it, expect } from "vitest";
import {
  connectedAccounts,
  glanceFigures,
  setupOutstanding,
  setupSteps,
  type HomeStatsSlice,
  type HomeSummarySlice,
} from "./home-overview";
import type { HomeSummary } from "@/hooks/use-home-summary";
import type { Integration } from "@/app/(site)/dashboard/integrations/_components/shared";

// Fixtures are typed against the real api types so a field rename breaks here.
const row = (o: Partial<Integration> & Pick<Integration, "provider">): Integration => ({
  name: o.provider,
  category: "x",
  authType: "oauth",
  availability: "available",
  connected: false,
  ...o,
});

describe("connectedAccounts", () => {
  it("lists nothing when the payload is missing or nothing is connected", () => {
    expect(connectedAccounts(undefined)).toEqual([]);
    expect(connectedAccounts([row({ provider: "shopify" }), row({ provider: "x", status: "disconnected" })])).toEqual([]);
  });

  it("lists connected rows, not a hard-coded set", () => {
    const out = connectedAccounts([
      row({ provider: "shopify", name: "Shopify", connected: true, status: "active", account: { externalId: "1", name: "Chai Co" } }),
      row({ provider: "google_business_profile", name: "Google Business Profile", connected: true }),
      row({ provider: "linkedin_content", name: "LinkedIn Content" }),
    ]);
    expect(out.map((a) => a.provider)).toEqual(["google_business_profile", "shopify"]);
    expect(out.find((a) => a.provider === "shopify")).toMatchObject({ accountName: "Chai Co", state: "live" });
  });

  it("lists a broken connection first, flagged for reconnect", () => {
    const out = connectedAccounts([
      row({ provider: "shopify", connected: true, status: "active" }),
      row({ provider: "whatsapp", name: "WhatsApp", connected: false, status: "needs_reauth" }),
    ]);
    expect(out.map((a) => [a.provider, a.state])).toEqual([
      ["whatsapp", "needs_reconnect"],
      ["shopify", "live"],
    ]);
  });
});

describe("connectedAccounts: Meta", () => {
  const facebook = (o: Partial<Integration> = {}) =>
    row({
      provider: "facebook",
      name: "Facebook",
      connected: true,
      status: "active",
      account: {
        externalId: "1",
        name: "Chai Co login",
        extra: {
          pages: [{ pageName: "Chai Co", instagramAccountId: "ig1", instagramUsername: "chaico" }],
          adAccounts: [{ name: "Chai Ads" }],
        },
      },
      ...o,
    });

  it("lists each connected Meta account on its own, as the Connected accounts page does", () => {
    const out = connectedAccounts([facebook()]);
    expect(out.map((a) => [a.provider, a.name, a.accountName, a.state])).toEqual([
      ["facebook_pages", "Facebook Pages", "Chai Co", "live"],
      ["instagram", "Instagram", "@chaico", "live"],
      ["meta_ads", "Meta Ads", "Chai Ads", "live"],
    ]);
    expect(out.some((a) => a.provider === "facebook")).toBe(false);
  });

  it("omits a Meta account the connection has nothing for", () => {
    const out = connectedAccounts([
      facebook({ account: { externalId: "1", name: "x", extra: { pages: [{ pageName: "Chai Co" }] } } }),
    ]);
    expect(out.map((a) => a.provider)).toEqual(["facebook_pages"]);
  });

  it("flags only the account whose own login is broken", () => {
    const out = connectedAccounts([
      facebook({
        metaConnections: [
          { purpose: null, status: "active" },
          { purpose: "ads", status: "needs_reauth" },
        ],
      }),
    ]);
    expect(out.map((a) => [a.provider, a.state])).toEqual([
      ["meta_ads", "needs_reconnect"],
      ["facebook_pages", "live"],
      ["instagram", "live"],
    ]);
  });

  it("does not list a Meta account that no login serves", () => {
    const out = connectedAccounts([
      facebook({ metaConnections: [{ purpose: "content", status: "active" }] }),
    ]);
    expect(out.map((a) => a.provider)).toEqual(["facebook_pages", "instagram"]);
  });

  it("agrees with the Connected accounts page: same flatten, same connected set", async () => {
    const { flattenMetaIntegration } = await import("./integrations-meta");
    const rows = [facebook(), row({ provider: "shopify", connected: true, status: "active" })];
    const page = flattenMetaIntegration(rows)
      .filter((r) => r.connected)
      .map((r) => r.provider)
      .sort();
    expect(connectedAccounts(rows).map((a) => a.provider).sort()).toEqual(page);
  });
});

const stats = (o: Partial<HomeStatsSlice> = {}): HomeStatsSlice => ({
  content: { total: 0, tagged: 0, highPotential: 0 },
  campaigns: { active: 0, total: 0 },
  connections: { linkedinAds: false },
  ...o,
});

const home = (o: Partial<HomeSummary> = {}): HomeSummarySlice => ({
  kpis: { publishedThisWeek: 0, scheduledUpcoming: 0, needsYou: 0 },
  commerce: null,
  ...o,
}) as HomeSummarySlice;

describe("glanceFigures", () => {
  it("renders nothing when no data has loaded", () => {
    expect(glanceFigures(undefined, undefined)).toEqual([]);
  });

  it("never renders a Customers card or a campaigns card without LinkedIn Ads", () => {
    const keys = glanceFigures(stats(), home()).map((f) => f.key);
    expect(keys).toEqual(["published", "scheduled"]);
  });

  it("omits content cards for an empty library and ad candidates at zero", () => {
    const keys = glanceFigures(stats({ content: { total: 5, tagged: 2, highPotential: 0 } }), home()).map((f) => f.key);
    expect(keys).toContain("content");
    expect(keys).not.toContain("adReady");
  });

  it("shows a real zero for campaigns once LinkedIn Ads is connected", () => {
    const f = glanceFigures(stats({ connections: { linkedinAds: true } }), undefined);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ key: "campaigns", value: 0, label: "LinkedIn campaigns running" });
  });

  it("shows products only for a connected store and caps at four", () => {
    const noStore = glanceFigures(undefined, home({ commerce: { connected: false, productCount: 9, contentCount: null, moneyLoop: null } }));
    expect(noStore.map((f) => f.key)).not.toContain("products");

    const all = glanceFigures(
      stats({ content: { total: 9, tagged: 9, highPotential: 3 }, connections: { linkedinAds: true } }),
      home({ commerce: { connected: true, productCount: 12, contentCount: null, moneyLoop: null } }),
    );
    expect(all).toHaveLength(4);
    expect(all[0].key).toBe("products");
  });

  it("uses no internal jargon in merchant copy", () => {
    const all = glanceFigures(
      stats({ content: { total: 9, tagged: 0, highPotential: 3 }, connections: { linkedinAds: true } }),
      home(),
    );
    const text = JSON.stringify(all).toLowerCase();
    for (const w of ["taxonomy", "high potential", "engine", "signals"]) expect(text).not.toContain(w);
  });
});

describe("setupSteps", () => {
  it("is one list of three, each step appearing once", () => {
    const steps = setupSteps({ hasProfile: false, hasAccount: false, hasContent: false });
    expect(steps).toHaveLength(3);
    expect(new Set(steps.map((s) => s.href)).size).toBe(3);
    expect(setupOutstanding(steps)).toBe(true);
  });

  it("is outstanding until every step is done, then hides", () => {
    expect(setupOutstanding(setupSteps({ hasProfile: true, hasAccount: true, hasContent: false }))).toBe(true);
    expect(setupOutstanding(setupSteps({ hasProfile: true, hasAccount: true, hasContent: true }))).toBe(false);
  });
});
