import { describe, it, expect } from "vitest";
import {
  EMPTY_NEW_CAMPAIGN,
  buildAdSetEdit,
  buildBudgetCut,
  buildCampaignEdit,
  buildCreateBodies,
  dayInZoneToIso,
  isoToDayInZone,
  metaMajorToMinor,
  metaMinorToInput,
  parseAge,
  parseLink,
  readTargeting,
  validateNewCampaign,
  type NewCampaignForm,
} from "./meta-ads-form";

const GOOD: NewCampaignForm = {
  ...EMPTY_NEW_CAMPAIGN,
  name: "  Spring sale ",
  dailyBudget: "25.50",
  countries: ["IN", "AE"],
  ageMin: "21",
  ageMax: "45",
  headline: "Spring is here",
  text: "Fresh arrivals this week.",
  link: "https://shop.example.com/spring",
  image: { mediaId: "665f1c2a9b1e4d0012ab34cd", name: "shirt.png" },
};

describe("metaMajorToMinor", () => {
  it.each([
    ["25.50", "USD", "2550"],
    ["25.5", "USD", "2550"],
    ["25", "USD", "2500"],
    ["1,250.00", "USD", "125000"],
    ["0.99", "USD", "99"],
    ["1500", "JPY", "1500"],
    ["10", "INR", "1000"],
  ])("%s %s -> %s", (input, currency, minor) => {
    expect(metaMajorToMinor(input, currency)).toBe(minor);
  });

  it("refuses a decimal comma instead of reading 25,50 as 2550", () => {
    expect(metaMajorToMinor("25,50", "EUR")).toBeNull();
    expect(metaMajorToMinor("1,5", "EUR")).toBeNull();
    expect(metaMajorToMinor("1,250,000", "USD")).toBe("125000000");
  });

  it("refuses to build a number when the currency is unknown", () => {
    expect(metaMajorToMinor("10", undefined)).toBeNull();
    expect(metaMajorToMinor("10", "")).toBeNull();
  });

  it("does the sum on digits, so 1.15 is 115 and not 114.99999999999999", () => {
    expect(metaMajorToMinor("1.15", "USD")).toBe("115");
    expect(metaMajorToMinor("4.35", "USD")).toBe("435");
  });

  it("refuses a fraction the currency has no unit for, and zero, and words", () => {
    expect(metaMajorToMinor("10.555", "USD")).toBeNull();
    expect(metaMajorToMinor("10.5", "JPY")).toBeNull();
    expect(metaMajorToMinor("0", "USD")).toBeNull();
    expect(metaMajorToMinor("0.00", "USD")).toBeNull();
    expect(metaMajorToMinor("", "USD")).toBeNull();
    expect(metaMajorToMinor("ten", "USD")).toBeNull();
    expect(metaMajorToMinor("-5", "USD")).toBeNull();
    expect(metaMajorToMinor("1e3", "USD")).toBeNull();
  });

  it("allows trailing zeros past the unit, which change nothing", () => {
    expect(metaMajorToMinor("25.500", "USD")).toBe("2550");
  });

  it("refuses an amount too large to be a real budget", () => {
    expect(metaMajorToMinor("9999999999999999", "USD")).toBeNull();
  });
});

describe("metaMinorToInput", () => {
  it.each([
    ["2550", "USD", "25.5"],
    ["2500", "USD", "25"],
    ["5", "USD", "0.05"],
    ["1500", "JPY", "1500"],
  ])("%s %s -> %s", (minor, currency, text) => {
    expect(metaMinorToInput(minor, currency)).toBe(text);
  });

  it("is the inverse of metaMajorToMinor", () => {
    for (const minor of ["1", "99", "100", "12345", "100000"]) {
      expect(metaMajorToMinor(metaMinorToInput(minor, "USD"), "USD")).toBe(minor);
    }
  });

  it("is empty for an absent budget, never 0", () => {
    expect(metaMinorToInput(undefined, "USD")).toBe("");
    expect(metaMinorToInput("", "USD")).toBe("");
  });
});

describe("a calendar day in the ad account's zone", () => {
  it("is the day's first and last moment, as an instant", () => {
    expect(dayInZoneToIso("2026-12-01", "Asia/Kolkata", "start")).toBe("2026-11-30T18:30:00.000Z");
    expect(dayInZoneToIso("2026-12-01", "Asia/Kolkata", "end")).toBe("2026-12-01T18:29:59.000Z");
    expect(dayInZoneToIso("2026-12-01", "UTC", "start")).toBe("2026-12-01T00:00:00.000Z");
  });

  it("follows the daylight-saving offset that is in force on that day", () => {
    // Los Angeles: UTC-8 in December, UTC-7 in July.
    expect(dayInZoneToIso("2026-12-01", "America/Los_Angeles", "start")).toBe("2026-12-01T08:00:00.000Z");
    expect(dayInZoneToIso("2026-07-01", "America/Los_Angeles", "start")).toBe("2026-07-01T07:00:00.000Z");
    // The day clocks go forward (2026-03-08): midnight is still UTC-8, and the end of the day UTC-7.
    expect(dayInZoneToIso("2026-03-08", "America/Los_Angeles", "start")).toBe("2026-03-08T08:00:00.000Z");
    expect(dayInZoneToIso("2026-03-08", "America/Los_Angeles", "end")).toBe("2026-03-09T06:59:59.000Z");
  });

  it("is null for a day that is not one, or a zone that is not one", () => {
    expect(dayInZoneToIso("2026-02-31", "UTC", "start")).toBeNull();
    expect(dayInZoneToIso("soon", "UTC", "start")).toBeNull();
    expect(dayInZoneToIso("2026-12-01", "Not/AZone", "start")).toBeNull();
  });

  it("round-trips through the zone it was made in", () => {
    for (const zone of ["Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland", "UTC"]) {
      const iso = dayInZoneToIso("2026-09-15", zone, "end")!;
      expect(isoToDayInZone(iso, zone)).toBe("2026-09-15");
    }
  });

  it("reads an instant as the day it is in that zone, not in UTC", () => {
    expect(isoToDayInZone("2026-11-30T20:00:00+0000", "Asia/Kolkata")).toBe("2026-12-01");
    expect(isoToDayInZone(undefined, "UTC")).toBe("");
    expect(isoToDayInZone("garbage", "UTC")).toBe("");
  });
});

describe("parseAge and parseLink", () => {
  it("keeps ages inside Meta's range", () => {
    expect(parseAge("18")).toBe(18);
    expect(parseAge("65")).toBe(65);
    expect(parseAge("17")).toBeNull();
    expect(parseAge("66")).toBeNull();
    expect(parseAge("")).toBeNull();
    expect(parseAge("2x")).toBeNull();
  });

  it("takes only a web address", () => {
    expect(parseLink("https://shop.example.com")).toBe("https://shop.example.com/");
    expect(parseLink("http://shop.example.com/a?b=1")).toBe("http://shop.example.com/a?b=1");
    expect(parseLink("javascript:alert(1)")).toBeNull();
    expect(parseLink("shop.example.com")).toBeNull();
    expect(parseLink("  ")).toBeNull();
  });
});

describe("validateNewCampaign", () => {
  it("passes a complete form", () => {
    expect(validateNewCampaign(GOOD, "USD")).toEqual({});
  });

  it("says what is wrong, field by field, in plain words", () => {
    const errors = validateNewCampaign(EMPTY_NEW_CAMPAIGN, "USD");
    expect(Object.keys(errors).sort()).toEqual(["countries", "dailyBudget", "headline", "image", "link", "name", "text"]);
    expect(errors.dailyBudget).toContain("USD");
  });

  it("checks the ages against each other and against the range", () => {
    expect(validateNewCampaign({ ...GOOD, ageMin: "50", ageMax: "30" }, "USD").ageMax).toContain("below");
    expect(validateNewCampaign({ ...GOOD, ageMin: "12" }, "USD").ageMin).toBeDefined();
  });

  it("asks for an image, and leaves its type and size to the picker", () => {
    expect(validateNewCampaign({ ...GOOD, image: null }, "USD").image).toBe("Choose an image.");
    expect(validateNewCampaign(GOOD, "USD").image).toBeUndefined();
  });

  it("refuses a budget with more decimals than the currency has", () => {
    expect(validateNewCampaign({ ...GOOD, dailyBudget: "10.5" }, "JPY").dailyBudget).toBeDefined();
  });
});

describe("buildCreateBodies", () => {
  const bodies = buildCreateBodies(GOOD, { adAccountId: "act_111", currency: "USD", pageId: "9001", imageHash: "hash1" });

  it("makes all three levels PAUSED: nothing can spend until the merchant turns it on", () => {
    expect(bodies.campaign.status).toBe("PAUSED");
    expect(bodies.adSet("c1").status).toBe("PAUSED");
    expect(bodies.ad("s1").status).toBe("PAUSED");
  });

  it("puts the budget on the campaign in the account's minor unit, and none on the ad set", () => {
    expect(bodies.campaign.dailyBudget).toBe("2550");
    expect(bodies.adSet("c1")).not.toHaveProperty("dailyBudget");
    expect(bodies.adSet("c1")).not.toHaveProperty("lifetimeBudget");
  });

  it("sends a JPY budget as whole yen", () => {
    const yen = buildCreateBodies({ ...GOOD, dailyBudget: "1500" }, { adAccountId: "act_1", currency: "JPY", pageId: "1", imageHash: "h" });
    expect(yen.campaign.dailyBudget).toBe("1500");
  });

  it("threads each created id into the level below", () => {
    expect(bodies.adSet("c1").campaignId).toBe("c1");
    expect(bodies.ad("s1").adsetId).toBe("s1");
  });

  it("targets the chosen countries and ages in the shape the ad-set route takes", () => {
    expect(bodies.adSet("c1").targeting).toEqual({ geoLocations: { countries: ["IN", "AE"] }, ageMin: 21, ageMax: 45 });
  });

  it("pairs the goal with a billing event Meta accepts for it", () => {
    expect(bodies.campaign.objective).toBe("OUTCOME_TRAFFIC");
    expect(bodies.adSet("c1").optimizationGoal).toBe("LINK_CLICKS");
    const reach = buildCreateBodies({ ...GOOD, objective: "OUTCOME_AWARENESS" }, { adAccountId: "act_1", currency: "USD", pageId: "1", imageHash: "h" });
    expect(reach.adSet("c").optimizationGoal).toBe("REACH");
    expect(reach.adSet("c").billingEvent).toBe("IMPRESSIONS");
  });

  it("builds the creative from the Page, the uploaded image and the merchant's words", () => {
    const spec = bodies.ad("s1").creative.objectStorySpec;
    expect(spec.pageId).toBe("9001");
    expect(spec.linkData).toMatchObject({
      link: "https://shop.example.com/spring",
      message: "Fresh arrivals this week.",
      name: "Spring is here",
      imageHash: "hash1",
      callToAction: { type: "LEARN_MORE", value: { link: "https://shop.example.com/spring" } },
    });
  });

  it("trims the name", () => {
    expect(bodies.campaign.name).toBe("Spring sale");
  });
});

describe("buildCampaignEdit", () => {
  const was = { name: "Spring sale", dailyBudget: "2550" };

  it("is null when nothing changed, so nothing is sent", () => {
    expect(buildCampaignEdit(was, { name: "Spring sale", budget: "25.5" }, "USD")).toBeNull();
  });

  it("sends only the field that changed", () => {
    expect(buildCampaignEdit(was, { name: "Autumn sale", budget: "25.5" }, "USD")).toEqual({ name: "Autumn sale" });
    expect(buildCampaignEdit(was, { name: "Spring sale", budget: "30" }, "USD")).toEqual({ dailyBudget: "3000" });
  });

  it("keeps a lifetime budget a lifetime budget", () => {
    expect(buildCampaignEdit({ name: "x", lifetimeBudget: "300000" }, { name: "x", budget: "4000" }, "USD")).toEqual({
      lifetimeBudget: "400000",
    });
  });

  it("does not ask a campaign with no budget of its own for one", () => {
    expect(buildCampaignEdit({ name: "x" }, { name: "y", budget: "" }, "USD")).toEqual({ name: "y" });
  });

  it("says so for a blank name or an unreadable budget", () => {
    expect(buildCampaignEdit(was, { name: " ", budget: "25.5" }, "USD")).toHaveProperty("error");
    expect(buildCampaignEdit(was, { name: "x", budget: "lots" }, "USD")).toHaveProperty("error");
  });
});

describe("buildAdSetEdit", () => {
  const targeting = { geo_locations: { countries: ["IN"] }, age_min: 25, age_max: 44 };
  const was = { dailyBudget: "1000", startTime: "2026-10-01T00:00:00+0000", targeting };
  const same = { countries: ["IN"], ageMin: "25", ageMax: "44", budget: "10", start: "2026-10-01", end: "" };

  it("reads what the stored targeting says", () => {
    expect(readTargeting(targeting)).toEqual({ countries: ["IN"], ageMin: "25", ageMax: "44", finerGeo: false });
    expect(readTargeting(undefined)).toEqual({ countries: [], ageMin: "", ageMax: "", finerGeo: false });
  });

  it("is null when nothing changed", () => {
    expect(buildAdSetEdit(was, same, "USD", "UTC")).toBeNull();
  });

  it("sends only the targeting that changed", () => {
    expect(buildAdSetEdit(was, { ...same, countries: ["IN", "GB"] }, "USD", "UTC")).toEqual({ targeting: { countries: ["IN", "GB"] } });
    expect(buildAdSetEdit(was, { ...same, ageMin: "30" }, "USD", "UTC")).toEqual({ targeting: { ageMin: 30 } });
  });

  it("treats the same countries in another order as unchanged", () => {
    const two = { ...was, targeting: { ...targeting, geo_locations: { countries: ["IN", "GB"] } } };
    expect(buildAdSetEdit(two, { ...same, countries: ["GB", "IN"] }, "USD", "UTC")).toBeNull();
  });

  it("converts an end day in the account's zone to an instant", () => {
    expect(buildAdSetEdit(was, { ...same, end: "2026-12-01" }, "USD", "Asia/Kolkata")).toEqual({
      endTime: "2026-12-01T18:29:59.000Z",
    });
  });

  it("sends a changed budget in the minor unit, as the same kind it was", () => {
    expect(buildAdSetEdit(was, { ...same, budget: "12.5" }, "USD", "UTC")).toEqual({ dailyBudget: "1250" });
  });

  it("lets an ad set that stores no countries or ages change its end day, without inventing a targeting", () => {
    const bare = { dailyBudget: "1000", startTime: "2026-10-01T00:00:00+0000" };
    const empty = { countries: [], ageMin: "", ageMax: "", budget: "10", start: "2026-10-01", end: "2026-12-01" };
    expect(buildAdSetEdit(bare, empty, "USD", "UTC")).toEqual({ endTime: "2026-12-01T23:59:59.000Z" });
  });

  it("leaves the countries alone on an ad set that targets cities or regions", () => {
    const city = { ...was, targeting: { ...targeting, geo_locations: { countries: ["US"], cities: [{ key: "1" }] } } };
    expect(readTargeting(city.targeting).finerGeo).toBe(true);
    expect(buildAdSetEdit(city, { ...same, countries: [], ageMax: "50" }, "USD", "UTC")).toEqual({ targeting: { ageMax: 50 } });
  });

  it("refuses an end before the start, no countries, and ages the wrong way round", () => {
    expect(buildAdSetEdit(was, { ...same, end: "2026-09-01" }, "USD", "UTC")).toHaveProperty("error");
    expect(buildAdSetEdit(was, { ...same, countries: [] }, "USD", "UTC")).toHaveProperty("error");
    expect(buildAdSetEdit(was, { ...same, ageMin: "60" }, "USD", "UTC")).toHaveProperty("error");
  });
});

describe("budgets Meta reports as zero, and boxes left as pre-filled", () => {
  it("a lifetime ad set that reports daily_budget 0 is a lifetime ad set", () => {
    const was = { dailyBudget: "0", lifetimeBudget: "300000", startTime: "2026-10-01T00:00:00+0000" };
    const form = { countries: [], ageMin: "", ageMax: "", budget: "3000", start: "2026-10-01", end: "2026-12-01" };
    expect(buildAdSetEdit(was, form, "USD", "UTC")).toEqual({ endTime: "2026-12-01T23:59:59.000Z" });
    expect(buildAdSetEdit(was, { ...form, end: "", budget: "4000" }, "USD", "UTC")).toEqual({ lifetimeBudget: "400000" });
  });

  it("a campaign whose budget is on its ad sets can be renamed", () => {
    expect(buildCampaignEdit({ name: "x", dailyBudget: "0" }, { name: "y", budget: "0" }, "USD")).toEqual({ name: "y" });
  });

  it("an untouched age Meta allows but this form does not offer does not block the save", () => {
    const was = { dailyBudget: "1000", targeting: { geo_locations: { countries: ["IN"] }, age_min: 13, age_max: 44 } };
    const form = { countries: ["IN"], ageMin: "13", ageMax: "44", budget: "10", start: "", end: "" };
    expect(buildAdSetEdit(was, { ...form, budget: "12" }, "USD", "UTC")).toEqual({ dailyBudget: "1200" });
  });
});

describe("buildBudgetCut (a campaign in an ad account the business has not enabled)", () => {
  const was = { dailyBudget: "5000" };
  it("a lower budget is sent, as the one budget field", () => {
    expect(buildBudgetCut(was, "20", "USD")).toEqual({ dailyBudget: "2000" });
  });
  it("a raise or the same figure is never sent", () => {
    expect(buildBudgetCut(was, "80", "USD")).toEqual({ error: "In this account you can only lower the budget." });
    expect(buildBudgetCut(was, "50", "USD")).toBeNull();
  });
  it("nonsense is an error, and a campaign with no budget of its own has nothing to lower", () => {
    expect(buildBudgetCut(was, "abc", "USD")).toHaveProperty("error");
    expect(buildBudgetCut({}, "10", "USD")).toHaveProperty("error");
  });
});
