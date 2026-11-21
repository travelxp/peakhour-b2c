import { describe, it, expect } from "vitest";
import { PILLAR_NAV, STUDIO_FEATURE, growthSubs, pillarForPath, navGroupsFor, type NavGroup } from "./dashboard-nav";
import { PILLAR_COPY, PLAN_COPY, SUB_COPY, MAX_DESCRIPTION } from "./nav-copy";
import { CREATE_MATCHES, PLAN_HREFS } from "./content-nav";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { activeTab, nextTabIndex } from "./pillar-tabs";
import { primaryTabs, isTabActive, COMMERCE_SHORT_LABEL } from "./mobile-tabs";
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
  "/dashboard/studio",
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
  // Content (W1-B): Plan, Create, Needs your OK, Calendar, Results. Web pages, news, sources and
  // holidays are reached inside those (Create / Plan), so they are no longer sidebar items of their own.
  "/dashboard/strategist",
  "/dashboard/content/create",
  "/dashboard/content/needs-ok",
  "/dashboard/calendar",
  "/dashboard/content/ledger",
  // Creative Studio (CS-UI-1): a new pillar between Content and Growth.
  "/dashboard/studio",
  "/dashboard/studio/shortlist",
  "/dashboard/studio/library",
  "/dashboard/studio/learned",
  "/dashboard/growth",
  "/dashboard/growth/decisions",
  "/dashboard/growth/channels",
  "/dashboard/growth/learning",
  "/dashboard/growth/rules",
  // PL-3 (2026-11-14): Growth -> Goals, a new screen the plan names.
  "/dashboard/growth/goals",
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
      // Plan is a group: it takes its own words, and its link is the first planning page's.
      expect(s.label).toBe(s.href === PLAN_HREFS[0] ? PLAN_COPY.label : SUB_COPY[s.href].label);
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

describe("the Content nav (W1-B)", () => {
  const content = () => items(PILLAR_NAV).find((i) => i.href === "/dashboard/content")!.subItems!;
  const DASH = path.join(__dirname, "../app/(site)/dashboard");

  it("has five items, in the order Plan, Create, Needs your OK, Calendar, Results", () => {
    expect(content().map((s) => s.label)).toEqual(["Plan", "Create", "Needs your OK", "Publishing calendar", "Results"]);
  });

  it("lights Plan for each of its four pages, and keeps every page's own copy", () => {
    for (const href of PLAN_HREFS) {
      expect(activeTab(href, content())?.label, href).toBe("Plan");
      expect(SUB_COPY[href], href).toBeDefined();
    }
    expect(PLAN_HREFS).toHaveLength(4);
  });

  it("lights Create for web pages and every channel page, and a nested channel path", () => {
    for (const href of CREATE_MATCHES) expect(activeTab(href, content())?.label, href).toBe("Create");
    expect(activeTab("/dashboard/content/facebook/comments", content())?.label).toBe("Create");
    expect(activeTab("/dashboard/strategist/abc123", content())?.label).toBe("Plan");
  });

  it("leaves the home itself unlit, and Results, Needs your OK and Calendar to themselves", () => {
    expect(activeTab("/dashboard/content", content())).toBeUndefined();
    expect(activeTab("/dashboard/content/ledger", content())?.label).toBe("Results");
    expect(activeTab("/dashboard/content/needs-ok", content())?.label).toBe("Needs your OK");
    expect(activeTab("/dashboard/calendar/recurring", content())?.label).toBe("Publishing calendar");
  });

  it("leaves no content page reachable only by typing its URL", () => {
    const dirs = readdirSync(path.join(DASH, "content"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(path.join(DASH, "content", d.name, "page.tsx")))
      .map((d) => d.name);
    expect(dirs.length).toBeGreaterThan(8);
    for (const name of dirs) {
      expect(activeTab(`/dashboard/content/${name}`, content()), name).toBeDefined();
    }
  });

  it("no longer carries the hidden Auto-publish page", () => {
    expect(existsSync(path.join(DASH, "content/autopilot"))).toBe(false);
    expect(content().some((s) => s.href.includes("autopilot"))).toBe(false);
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

describe("Studio in the navigation", () => {
  it("sits between Content and Growth, gated and hidden (not locked) for an org without it", () => {
    const tops = items(PILLAR_NAV).map((i) => i.href);
    expect(tops.indexOf("/dashboard/studio")).toBe(tops.indexOf("/dashboard/content") + 1);
    expect(tops.indexOf("/dashboard/growth")).toBe(tops.indexOf("/dashboard/studio") + 1);
    const studio = items(PILLAR_NAV).find((i) => i.href === "/dashboard/studio")!;
    expect(studio.feature).toBe(STUDIO_FEATURE);
    expect(studio.hideWhenLocked).toBe(true);
    expect(studio.subItems!.map((s) => s.label)).toEqual(["Ideas", "Shortlist", "Library", "What we've learned"]);
  });

  it("the pillar is named Studio even though its first tab (same href) is Ideas", () => {
    expect(PILLAR_COPY["/dashboard/studio"].label).toBe("Studio");
    expect(SUB_COPY["/dashboard/studio"].label).toBe("Ideas");
  });

  it("a Studio page lights the Studio pillar tabs, and the new-brief page lights Ideas", () => {
    const g = navGroupsFor("present");
    expect(pillarForPath("/dashboard/studio/shortlist", g)?.href).toBe("/dashboard/studio");
    const studio = pillarForPath("/dashboard/studio/new", g)!;
    expect(activeTab("/dashboard/studio/new", studio.subItems!)?.href).toBe("/dashboard/studio");
    expect(activeTab("/dashboard/studio/library", studio.subItems!)?.href).toBe("/dashboard/studio/library");
  });
});

describe("mobile bottom bar", () => {
  it("Studio gets its own cell between Home and Inbox only for an org entitled to it", () => {
    const keys = (hasCommerce: boolean, hasStudio?: boolean) =>
      primaryTabs({ hasCommerce, hasStudio, homeHref: "/dashboard/overview" }).map((t) => t.key);
    expect(keys(false, true)).toEqual(["home", "studio", "inbox", "content", "growth"]);
    // Inbox stays when Studio is on, with Commerce too (UX spec U3: six cells with More).
    expect(keys(true, true)).toEqual(["home", "studio", "inbox", "content", "commerce"]);
    expect(keys(false)).toEqual(["home", "inbox", "content", "growth"]);
    const studio = primaryTabs({ hasCommerce: false, hasStudio: true, homeHref: "/dashboard/overview" })[1];
    expect(isTabActive("/dashboard/studio/c/abc", studio)).toBe(true);
    expect(isTabActive("/dashboard/studios", studio)).toBe(false);
    expect(PILLAR_COPY[studio.copyHref]).toBeDefined();
  });

  it("Commerce takes the short label only when Studio shares the bar (60px cells at 360px)", () => {
    const commerce = (hasStudio: boolean) => primaryTabs({ hasCommerce: true, hasStudio, homeHref: "/dashboard/overview" }).find((t) => t.key === "commerce")!;
    expect(commerce(true).shortLabel).toBe(COMMERCE_SHORT_LABEL);
    expect(commerce(false).shortLabel).toBeUndefined();
    // every label on the crowded bar is a word that fits a 60px cell: none is longer than "Content" or "Studio" or "Growth"
    const labels = primaryTabs({ hasCommerce: true, hasStudio: true, homeHref: "/dashboard/overview" }).map((t) => t.shortLabel ?? PILLAR_COPY[t.copyHref].label);
    expect(Math.max(...labels.map((l) => l.length))).toBeLessThanOrEqual(7);
  });

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

describe("no two destinations share a label where a merchant sees them together", () => {
  it("the command menu list", async () => {
    const { ENTRIES } = await import("@/components/molecules/command-menu-dialog");
    const labels = ENTRIES.map((e) => e.label);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes).toEqual([]);
  });

  it("the sidebar's top level, and each pillar's tab strip, in every Growth state", () => {
    for (const s of ["present", "absent", "not_built", "unknown"] as const) {
      const all = items(navGroupsFor(s));
      const top = all.map((i) => i.label);
      expect(new Set(top).size, `top level (${s})`).toBe(top.length);
      for (const i of all) {
        const labels = (i.subItems ?? []).map((x) => x.label);
        expect(new Set(labels).size, `${i.href} (${s})`).toBe(labels.length);
      }
    }
  });

  it("the sidebar as a whole (pillars and sub-links together)", () => {
    const labels = items(navGroupsFor("absent")).flatMap((i) => [i.label, ...(i.subItems ?? []).map((s) => s.label)]);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes).toEqual([]);
  });

  it("the mobile bar", () => {
    for (const hasCommerce of [true, false]) {
      for (const hasStudio of [true, false]) {
        const labels = [...primaryTabs({ hasCommerce, hasStudio, homeHref: "/dashboard/overview" }).map((t) => t.shortLabel ?? PILLAR_COPY[t.copyHref].label), "More"];
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });
});
