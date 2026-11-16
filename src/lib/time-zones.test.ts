import { describe, it, expect, vi } from "vitest";
import { browserZone, searchZones, supportedZones, timeZoneOptions, zoneGroups, zoneItem, zoneLabel, zoneOffset } from "./time-zones";

const NOW = new Date("2026-11-16T12:00:00Z");
// what Node 24 / ICU lists: the legacy names, and no Asia/Kolkata
const LISTED = ["Asia/Calcutta", "Europe/Kiev", "America/New_York", "Europe/London", "Asia/Dubai", "Pacific/Auckland"];
const find = (groups: ReturnType<typeof zoneGroups>, zone: string) => groups.flatMap((g) => g.items).find((i) => i.value === zone);
const values = (groups: ReturnType<typeof zoneGroups>) => groups.flatMap((g) => g.items.map((i) => i.value));

describe("timeZoneOptions", () => {
  it("★★legacy ids are offered by today's name, UTC is always offered, each once, sorted (R3)", () => {
    expect(timeZoneOptions(["Asia/Calcutta", "Europe/Kiev", "Asia/Kolkata", "America/New_York"])).toEqual(["America/New_York", "Asia/Kolkata", "Europe/Kyiv", "UTC"]);
  });
  it("an id with no modern name is kept as listed", () => {
    expect(timeZoneOptions(["Europe/London"])).toEqual(["Europe/London", "UTC"]);
  });
  it("this browser's own list offers Asia/Kolkata and Europe/Kyiv, and never the legacy names beside them", () => {
    const all = supportedZones();
    expect(all).toContain("Asia/Kolkata");
    expect(all).toContain("Europe/Kyiv");
    expect(all).not.toContain("Asia/Calcutta");
    expect(all).toContain("UTC");
  });
});

describe("zoneOffset and the label", () => {
  it("is the offset right now, in +hh:mm, and +00:00 for UTC", () => {
    expect(zoneOffset("Asia/Kolkata", NOW)).toBe("+05:30");
    expect(zoneOffset("America/New_York", NOW)).toBe("-05:00");
    expect(zoneOffset("UTC", NOW)).toBe("+00:00");
    expect(zoneOffset("Pacific/Kiritimati", NOW)).toBe("+14:00");
  });
  it("follows daylight saving: New York is -04:00 in July", () => {
    expect(zoneOffset("America/New_York", new Date("2026-07-15T12:00:00Z"))).toBe("-04:00");
  });
  it("is empty for a zone this browser cannot read, and the label is then the id alone", () => {
    expect(zoneOffset("Mars/Olympus", NOW)).toBe("");
    expect(zoneLabel("Mars/Olympus", NOW)).toBe("Mars/Olympus");
  });
  it("every label shows the offset, with underscores taken out", () => {
    expect(zoneLabel("Asia/Kolkata", NOW)).toBe("Asia/Kolkata (UTC+05:30)");
    expect(zoneLabel("America/New_York", NOW)).toBe("America/New York (UTC-05:00)");
  });
});

describe("zoneGroups", () => {
  it("offers the modern name for a legacy listing", () => {
    const g = zoneGroups({ supported: LISTED, now: NOW });
    expect(find(g, "Asia/Kolkata")).toBeDefined();
    expect(find(g, "Asia/Calcutta")).toBeUndefined();
    expect(find(g, "Europe/Kyiv")).toBeDefined();
  });
  it("suggests the browser's zone first, then lists it once", () => {
    const g = zoneGroups({ supported: LISTED, browser: "Europe/London", now: NOW });
    expect(g[0]).toMatchObject({ key: "suggested" });
    expect(g[0]!.items.map((i) => i.value)).toEqual(["Europe/London"]);
    expect(values(g).filter((z) => z === "Europe/London")).toHaveLength(1);
  });
  it("a browser zone it cannot read is not suggested", () => {
    expect(zoneGroups({ supported: LISTED, browser: "Mars/Olympus", now: NOW }).some((g) => g.key === "suggested")).toBe(false);
  });
  it("★★a stored zone the list lacks is its own option, as stored, and is never rewritten to its modern name", () => {
    const g = zoneGroups({ supported: ["Asia/Kolkata", "Europe/London"], stored: "Asia/Calcutta", now: NOW });
    expect(g[0]).toMatchObject({ key: "current" });
    expect(g[0]!.items.map((i) => i.value)).toEqual(["Asia/Calcutta"]);
    // and the modern name is still there beside it
    expect(find(g, "Asia/Kolkata")).toBeDefined();
  });
  it("a stored zone the list holds is not shown twice, and there is no 'current' group", () => {
    const g = zoneGroups({ supported: LISTED, stored: "Europe/London", now: NOW });
    expect(g.some((x) => x.key === "current")).toBe(false);
    expect(values(g).filter((z) => z === "Europe/London")).toHaveLength(1);
  });
  it("a stored zone nobody can read is still an option (the server judges it)", () => {
    const g = zoneGroups({ supported: LISTED, stored: "Not/AZone", now: NOW });
    expect(find(g, "Not/AZone")).toMatchObject({ label: "Not/AZone" });
  });
  it("a zone the caller asks to keep is an option too", () => {
    const g = zoneGroups({ supported: ["Europe/London"], stored: "Asia/Kolkata", keep: ["Asia/Calcutta"], now: NOW });
    expect(find(g, "Asia/Calcutta")).toBeDefined();
  });
  it("the zones near the caller come under their own heading, before the rest, and only if the list has them", () => {
    const g = zoneGroups({ supported: LISTED, near: ["Asia/Kolkata", "Asia/Mars"], now: NOW });
    const near = g.find((x) => x.key === "near")!;
    expect(near.items.map((i) => i.value)).toEqual(["Asia/Kolkata"]);
    expect(g.findIndex((x) => x.key === "near")).toBeLessThan(g.findIndex((x) => x.key === "all"));
    expect(values(g).filter((z) => z === "Asia/Kolkata")).toHaveLength(1);
  });
  it("the browser's own zone is the real one when no list is given", () => {
    const b = browserZone();
    expect(b === undefined || typeof b === "string").toBe(true);
    expect(zoneGroups({ now: NOW }).flatMap((g) => g.items).length).toBeGreaterThan(300);
  });
});

describe("searchZones", () => {
  const groups = zoneGroups({ supported: LISTED, now: NOW });
  const found = (q: string) => values(searchZones(groups, q));

  it("★★finds Kolkata by its city", () => {
    expect(found("Kolkata")).toEqual(["Asia/Kolkata"]);
    expect(found("kolkata")).toEqual(["Asia/Kolkata"]);
  });
  it("★★finds Kolkata by its country", () => {
    expect(found("India")).toContain("Asia/Kolkata");
    expect(found("India")).not.toContain("Europe/London");
  });
  it("★★finds Kolkata by its offset, in the ways people write it", () => {
    for (const q of ["+05:30", "UTC+05:30", "gmt+05:30", "+5:30", "utc+5:30", "GMT+5:30"]) expect(found(q), q).toContain("Asia/Kolkata");
    expect(found("gmt-5:00")).toContain("America/New_York");
    expect(found("+05:30")).not.toContain("Europe/London");
    expect(found("+05:30")).not.toContain("Asia/Dubai");
  });
  it("finds a zone by its region", () => {
    expect(found("Pacific")).toEqual(["Pacific/Auckland"]);
  });
  it("finds a zone by its modern name, not only its legacy one", () => {
    expect(found("Kyiv")).toEqual(["Europe/Kyiv"]);
    expect(found("Kiev")).toEqual([]);
  });
  it("every word must match: city and offset together narrow it", () => {
    expect(found("asia +05:30")).toEqual(["Asia/Kolkata"]);
    expect(found("london +05:30")).toEqual([]);
  });
  it("a blank search leaves everything, and a search that matches nothing leaves nothing", () => {
    expect(searchZones(groups, "  ")).toEqual(groups);
    expect(searchZones(groups, "zzzz")).toEqual([]);
  });
  it("drops a group left empty", () => {
    const g = zoneGroups({ supported: LISTED, browser: "Europe/London", now: NOW });
    expect(searchZones(g, "Kolkata").map((x) => x.key)).toEqual(["all"]);
  });
});

describe("zoneItem", () => {
  it("is built once per zone and hour, so opening the picker again does not rebuild it", () => {
    expect(zoneItem("Asia/Kolkata", NOW)).toBe(zoneItem("Asia/Kolkata", NOW));
    // a later hour is a fresh item (the offset can have changed)
    expect(zoneItem("Asia/Kolkata", new Date(NOW.getTime() + 3_600_000))).not.toBe(zoneItem("Asia/Kolkata", NOW));
  });
  it("names the place: the country where the browser knows it, else the region", () => {
    expect(zoneItem("Asia/Kolkata", NOW)).toMatchObject({ value: "Asia/Kolkata", city: "Kolkata", place: "India", offset: "UTC+05:30" });
    expect(zoneItem("UTC", NOW).place).toBe("");
  });
});

describe("a closed picker is cheap", () => {
  it("the trigger's label does not build the country lookup; a search item does, once", async () => {
    vi.resetModules();
    const intl = Intl as unknown as { DisplayNames: typeof Intl.DisplayNames };
    const Orig = intl.DisplayNames;
    let built = 0;
    intl.DisplayNames = class extends Orig {
      constructor(...a: ConstructorParameters<typeof Orig>) {
        super(...a);
        built += 1;
      }
    } as typeof Intl.DisplayNames;
    try {
      const fresh = await import("./time-zones");
      expect(fresh.zoneLabel("Asia/Kolkata", NOW)).toBe("Asia/Kolkata (UTC+05:30)");
      expect(built).toBe(0);
      expect(fresh.zoneItem("Asia/Kolkata", NOW).place).toBe("India");
      expect(built).toBe(1);
      fresh.zoneItem("Europe/London", NOW);
      expect(built).toBe(1);
    } finally {
      intl.DisplayNames = Orig;
    }
  });
});
