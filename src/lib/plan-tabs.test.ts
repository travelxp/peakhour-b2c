import { describe, expect, it } from "vitest";
import { PLAN_HREFS } from "./content-nav";
import { SUB_COPY } from "./nav-copy";
import { activeTab } from "./pillar-tabs";
import { planTabs } from "./plan-tabs";

describe("planTabs", () => {
  it("is the four planning pages, in the group's order, in nav-copy's words", () => {
    const tabs = planTabs();
    expect(tabs.map((t) => t.href)).toEqual([...PLAN_HREFS]);
    expect(tabs.map((t) => t.label)).toEqual(["Content plan", "Industry news", "Holidays & events", "Content sources"]);
    for (const t of tabs) expect(t.label).toBe(SUB_COPY[t.href].label);
  });

  it("lights one tab per page, including a nested idea page", () => {
    const tabs = planTabs();
    expect(activeTab("/dashboard/content/news", tabs)?.label).toBe("Industry news");
    expect(activeTab("/dashboard/strategist/abc123", tabs)?.label).toBe("Content plan");
    expect(activeTab("/dashboard/content/ledger", tabs)).toBeUndefined();
  });
});
