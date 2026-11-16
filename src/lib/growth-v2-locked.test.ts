import { describe, expect, it } from "vitest";
import type { DraftLockedGoal } from "@/lib/api/growth-v2";
import { distinctNeeds, needHref, needIsExternal } from "./growth-v2-locked";

describe("needHref: the api says where a need leads, this app says the address", () => {
  it("connected accounts and Your business are this app's own pages", () => {
    expect(needHref({ target: "connected_accounts" })).toBe("/dashboard/integrations");
    expect(needHref({ target: "your_business" })).toBe("/dashboard/growth/rules/business");
  });
  it("the Google Analytics help is the api's own address, and opens outside the app", () => {
    expect(needHref({ target: "ga4_key_events_help", url: "https://support.google.com/analytics/answer/9267568" })).toBe("https://support.google.com/analytics/answer/9267568");
    expect(needIsExternal({ target: "ga4_key_events_help" })).toBe(true);
    expect(needIsExternal({ target: "connected_accounts" })).toBe(false);
    expect(needIsExternal({ target: "your_business" })).toBe(false);
  });
  it("a help need that arrives with no address still leads somewhere real", () => {
    expect(needHref({ target: "ga4_key_events_help" })).toMatch(/^https:\/\/support\.google\.com\/analytics/);
  });
});

describe("distinctNeeds", () => {
  const n = (need: string) => ({ need, sentence: `s-${need}`, target: "connected_accounts" as const });
  const locked: DraftLockedGoal[] = [
    { kind: "sales", label: "Sales", needs: [n("connect_store")] },
    { kind: "bookings", label: "Bookings", needs: [n("connect_store"), n("connect_ga4")] },
    { kind: "leads", label: "Leads", needs: [n("connect_ga4")] },
  ];
  it("names each need once, in the order the goals list them", () => {
    expect(distinctNeeds(locked).map((x) => x.need)).toEqual(["connect_store", "connect_ga4"]);
  });
  it("is empty for nothing locked", () => {
    expect(distinctNeeds([])).toEqual([]);
  });
});
