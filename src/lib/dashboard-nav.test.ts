import { describe, it, expect } from "vitest";
import { PILLAR_NAV, growthSubs, pillarForPath, navGroupsFor, type NavGroup } from "./dashboard-nav";
import { PILLAR_COPY, SUB_COPY, MAX_DESCRIPTION } from "./nav-copy";
import { activeTab, nextTabIndex } from "./pillar-tabs";
import { primaryTabs, isTabActive } from "./mobile-tabs";
import { growthNav } from "./growth-v2-nav";

/**
 * The hrefs the sidebar carried BEFORE the plain-language pass, written out by
 * hand from dashboard/layout.tsx at its parent commit. The point of the test is
 * that this list does not move: a rename may change words, never destinations.
 */
const BEFORE_TOP = [
  "/dashboard/overview",
  "/dashboard/integrations",
  "/dashboard/inbox",
  "/dashboard/content",
  "/dashboard/growth",
  "/dashboard/commerce",
  "/dashboard/presence",
  "/dashboard/insights/analytics",
  // "/dashboard/ask" appears only when ASK_ENABLED, which is unset here.
  "/dashboard/tasks",
  "/dashboard/drive",
  "/dashboard/peaks",
  "/dashboard/settings",
];
const BEFORE_SUBS = [
  "/dashboard/content/autopilot",
  "/dashboard/content",
  "/dashboard/pages",
  "/dashboard/content/sources",
  "/dashboard/content/news",
  "/dashboard/strategist",
  "/dashboard/calendar",
  "/dashboard/content/ledger",
  "/dashboard/content/seasonal-events",
  "/dashboard/growth",
  "/dashboard/growth/decisions",
  "/dashboard/growth/channels",
  "/dashboard/growth/learning",
  "/dashboard/growth/rules",
  "/dashboard/growth/start",
  "/dashboard/commerce",
  "/dashboard/commerce/channels",
  "/dashboard/commerce/autopilot",
  "/dashboard/commerce/catalog",
  "/dashboard/commerce/inventory",
  "/dashboard/commerce/pricing",
  "/dashboard/commerce/reviews",
  "/dashboard/commerce/assistant",
  "/dashboard/commerce/knowledge",
  "/dashboard/commerce/win-back",
  "/dashboard/commerce/broadcasts",
  "/dashboard/insights/analytics",
  "/dashboard/insights/search-console",
  "/dashboard/settings",
  "/dashboard/settings/preferences",
  "/dashboard/settings/team",
  "/dashboard/settings/whatsapp",
  "/dashboard/settings/billing",
  "/dashboard/settings/tickets",
];

const items = (groups: NavGroup[]) => groups.flatMap((g) => g.items);
const subHrefs = (groups: NavGroup[]) => items(groups).flatMap((i) => i.subItems ?? []).map((s) => s.href);

describe("no navigation destination is lost", () => {
  it("keeps every top-level href", () => {
    const now = new Set(items(PILLAR_NAV).map((i) => i.href));
    for (const h of BEFORE_TOP) expect(now.has(h), h).toBe(true);
  });

  it("keeps every sub-link href (Growth in every mandate state)", () => {
    const now = new Set([
      ...subHrefs(PILLAR_NAV),
      ...(["present", "absent", "not_built", "unknown"] as const).flatMap((s) => growthSubs(s).map((g) => g.href)),
    ]);
    for (const h of BEFORE_SUBS) expect(now.has(h), h).toBe(true);
  });

  it("adds no destination that was not there before", () => {
    const before = new Set([...BEFORE_TOP, ...BEFORE_SUBS, "/dashboard/ask"]);
    const now = [...items(PILLAR_NAV).map((i) => i.href), ...subHrefs(PILLAR_NAV)];
    for (const h of now) expect(before.has(h), h).toBe(true);
  });

  it("Growth sub-links are the same hrefs, in the same order, as growthNav", () => {
    for (const s of ["present", "absent", "not_built", "unknown"] as const) {
      expect(growthSubs(s).map((g) => g.href)).toEqual(growthNav(s).map((g) => g.href));
    }
  });
});

describe("nav copy is complete", () => {
  it("every top-level item has a label and a description", () => {
    for (const i of items(PILLAR_NAV)) {
      expect(PILLAR_COPY[i.href], i.href).toBeDefined();
      expect(i.label).toBe(PILLAR_COPY[i.href].label);
      expect(i.description, i.href).toBe(PILLAR_COPY[i.href].description);
    }
  });

  it("every sub-link has a label and a description", () => {
    for (const s of items(PILLAR_NAV).flatMap((i) => i.subItems ?? [])) {
      expect(SUB_COPY[s.href], s.href).toBeDefined();
      expect(s.label).toBe(SUB_COPY[s.href].label);
      expect(s.description, s.href).toBeTruthy();
    }
  });

  it("covers Ask Peakhour, which only renders behind a flag", () => {
    expect(PILLAR_COPY["/dashboard/ask"]).toBeDefined();
  });

  it("keeps descriptions to one short line and labels short", () => {
    for (const c of [...Object.values(PILLAR_COPY), ...Object.values(SUB_COPY)]) {
      expect(c.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
      expect(c.description.length).toBeGreaterThan(10);
      expect(c.label.length).toBeLessThanOrEqual(24);
    }
  });

  it("keeps the old names searchable as aliases", () => {
    expect(SUB_COPY["/dashboard/content/ledger"].aliases).toContain("Ledger");
    expect(SUB_COPY["/dashboard/content/news"].aliases).toContain("News Desk");
    expect(SUB_COPY["/dashboard/strategist"].aliases).toContain("Strategist");
    expect(SUB_COPY["/dashboard/commerce"].aliases).toContain("Command Center");
    expect(SUB_COPY["/dashboard/commerce/win-back"].aliases).toContain("Win back carts");
    expect(SUB_COPY["/dashboard/commerce/knowledge"].aliases).toContain("Knowledge base");
    expect(SUB_COPY["/dashboard/commerce/autopilot"].aliases).toContain("Autopilot");
  });

  it("no two sub-links in one pillar share a label", () => {
    for (const i of items(navGroupsFor("absent"))) {
      const labels = (i.subItems ?? []).map((s) => s.label);
      expect(new Set(labels).size, i.href).toBe(labels.length);
    }
  });
});

describe("pillar tabs", () => {
  const settings = items(PILLAR_NAV).find((i) => i.href === "/dashboard/settings")!.subItems!;
  const growth = growthSubs("present");

  it("lights exactly the longest match: Team, not General", () => {
    expect(activeTab("/dashboard/settings/team", settings)?.href).toBe("/dashboard/settings/team");
    expect(activeTab("/dashboard/settings", settings)?.href).toBe("/dashboard/settings");
  });

  it("lights nothing outside the pillar", () => {
    expect(activeTab("/dashboard/inbox", settings)).toBeUndefined();
  });

  it("honours `matches`: /dashboard/ads lights Ad channels & budget", () => {
    expect(activeTab("/dashboard/ads/campaigns", growth)?.href).toBe("/dashboard/growth/channels");
  });

  it("a nested Growth page lights Rules, not Overview", () => {
    expect(activeTab("/dashboard/growth/rules/audiences", growth)?.href).toBe("/dashboard/growth/rules");
  });

  it("finds the pillar only for multi-page pillars", () => {
    const g = navGroupsFor("present");
    expect(pillarForPath("/dashboard/strategist", g)?.href).toBe("/dashboard/content");
    expect(pillarForPath("/dashboard/commerce/pricing", g)?.href).toBe("/dashboard/commerce");
    expect(pillarForPath("/dashboard/settings/billing", g)?.href).toBe("/dashboard/settings");
    expect(pillarForPath("/dashboard/insights/search-console", g)?.href).toBe("/dashboard/insights/analytics");
    expect(pillarForPath("/dashboard/inbox", g)).toBeUndefined();
    expect(pillarForPath("/dashboard/drive", g)).toBeUndefined();
  });

  it("arrow keys wrap and Home/End jump", () => {
    expect(nextTabIndex(0, 4, "ArrowLeft")).toBe(3);
    expect(nextTabIndex(3, 4, "ArrowRight")).toBe(0);
    expect(nextTabIndex(2, 4, "Home")).toBe(0);
    expect(nextTabIndex(1, 4, "End")).toBe(3);
    expect(nextTabIndex(1, 4, "a")).toBeUndefined();
    expect(nextTabIndex(0, 0, "ArrowRight")).toBeUndefined();
  });
});

describe("mobile bottom bar", () => {
  it("shows Growth for everyone and Commerce instead only when entitled", () => {
    expect(primaryTabs({ hasCommerce: false, homeHref: "/dashboard/overview" }).map((t) => t.key)).toEqual([
      "home", "inbox", "content", "growth",
    ]);
    expect(primaryTabs({ hasCommerce: true, homeHref: "/dashboard/overview" }).map((t) => t.key)).toEqual([
      "home", "inbox", "content", "commerce",
    ]);
  });

  it("every bar destination has nav copy", () => {
    for (const t of primaryTabs({ hasCommerce: true, homeHref: "/dashboard/overview" })) {
      expect(PILLAR_COPY[t.copyHref], t.key).toBeDefined();
    }
  });

  it("lights Content for its sub-pages", () => {
    const content = primaryTabs({ hasCommerce: false, homeHref: "/dashboard/overview" })[2];
    expect(isTabActive("/dashboard/strategist", content)).toBe(true);
    expect(isTabActive("/dashboard/contentious", content)).toBe(false);
  });
});
