import { describe, it, expect } from "vitest";
import {
  LISTING_ROWS,
  addressLines,
  chartPoints,
  coverageNote,
  driftStatus,
  fetchView,
  hoursLines,
  insightsView,
  locationSwitcher,
  presenceInsightsQueryKey,
  presenceListingQueryKey,
  windowSeries,
  metricTotal,
  setupMessage,
  staleSyncNote,
  type InsightDay,
  type PresenceListingResponse,
  type PresenceSetup,
} from "./presence-panels";

const google = (over: Partial<NonNullable<PresenceListingResponse["google"]>> = {}) => ({
  externalId: "locations/1",
  status: "synced",
  syncMode: "auto",
  lastSyncedAt: "2026-11-03T10:00:00.000Z",
  driftFields: [],
  control: {
    state: "controlled" as const,
    reason: null,
    hasPendingVerification: null,
    ownsBusiness: null,
    pendingEdits: null,
    duplicateOf: null,
    checkedAt: "2026-11-03T10:00:00.000Z",
    lastReadFailedAt: null,
  },
  changes: { items: [], pendingFields: [], checkedAt: null, lastReadFailedAt: null, customerMediaAt: null },
  capabilities: { control: true, networkChanges: true, searchTerms: true, metricKeys: [] },
  searchTerms: { month: null, terms: null, truncated: false, checkedAt: null, lastReadFailedAt: null },
  ...over,
});

const day = (date: string, over: Partial<InsightDay> = {}): InsightDay => ({
  date,
  calls: 0,
  directions: 0,
  websiteClicks: 0,
  messagingClicks: 0,
  bookings: 0,
  views: 0,
  ...over,
});

describe("driftStatus: differs, matches and not checked are three answers", () => {
  it("an empty driftFields on a compared listing means it matches", () => {
    expect(driftStatus(["name"], google())).toBe("matches");
  });
  it("a listed field differs", () => {
    expect(driftStatus(["name"], google({ driftFields: ["name"] }))).toBe("differs");
  });
  it("a multi-field row differs when any one of its fields does", () => {
    const row = LISTING_ROWS.find((r) => r.key === "address")!;
    expect(driftStatus(row.compares, google({ driftFields: ["address.city"] }))).toBe("differs");
    expect(driftStatus(row.compares, google({ driftFields: ["name"] }))).toBe("matches");
  });
  it("a field the api never compares is not checked, even when driftFields is empty", () => {
    expect(driftStatus([], google())).toBe("not_checked");
    const other = LISTING_ROWS.find((r) => r.key === "otherCategories")!;
    expect(driftStatus(other.compares, google())).toBe("not_checked");
    const holiday = LISTING_ROWS.find((r) => r.key === "specialHours")!;
    expect(driftStatus(holiday.compares, google({ driftFields: ["regularHours"] }))).toBe(
      "not_checked",
    );
  });
  it("a listing never compared is not checked, not matching", () => {
    expect(driftStatus(["name"], null)).toBe("not_checked");
    expect(driftStatus(["name"], google({ lastSyncedAt: null }))).toBe("not_checked");
  });
  it("tolerates a missing driftFields array", () => {
    const g = google() as Record<string, unknown>;
    delete g.driftFields;
    expect(driftStatus(["name"], g as unknown as ReturnType<typeof google>)).toBe("matches");
  });
});

describe("every compared api field belongs to a row, so none is silently unshown", () => {
  it("covers the api's eight watched fields", () => {
    const covered = LISTING_ROWS.flatMap((r) => r.compares).sort();
    expect(covered).toEqual(
      [
        "name",
        "primaryCategory",
        "contact.phone",
        "contact.website",
        "address.line1",
        "address.city",
        "address.postalCode",
        "regularHours",
      ].sort(),
    );
  });
});

describe("fetchView", () => {
  const base = { hasData: false, isPending: false, isError: false, fetchStatus: "idle" as const };
  it("pending and fetching is loading", () => {
    expect(fetchView({ ...base, isPending: true, fetchStatus: "fetching" })).toBe("loading");
  });
  it("pending and paused is paused, not loading", () => {
    expect(fetchView({ ...base, isPending: true, fetchStatus: "paused" })).toBe("paused");
  });
  it("an error with no data is failed", () => {
    expect(fetchView({ ...base, isError: true })).toBe("failed");
  });
  it("an error with data keeps the data and is flagged stale", () => {
    expect(fetchView({ ...base, hasData: true, isError: true })).toBe("data_stale");
  });
  it("data is data", () => {
    expect(fetchView({ ...base, hasData: true })).toBe("data");
  });
});

describe("setupMessage", () => {
  const states: PresenceSetup[] = [
    "not_connected",
    "needs_reconnect",
    "needs_location",
    "importing",
  ];
  it("each non-ready state has its own distinct headline", () => {
    const heads = states.map((s) => setupMessage(s, false, "listing")?.headline);
    expect(heads.every(Boolean)).toBe(true);
    expect(new Set(heads).size).toBe(states.length);
  });
  it("ready shows data", () => {
    expect(setupMessage("ready", true, "listing")).toBeNull();
  });
  it("a failing sync with a saved listing shows it, with a note", () => {
    expect(setupMessage("sync_failing", true, "listing")).toBeNull();
    expect(staleSyncNote("sync_failing")).toMatch(/failed/);
    expect(staleSyncNote("ready")).toBeNull();
  });
  it("a failing sync with nothing saved says so", () => {
    expect(setupMessage("sync_failing", false, "listing")?.headline).toMatch(/couldn't read/);
  });
  it("says Google, never GBP, and claims nothing live", () => {
    for (const s of [...states, "sync_failing"] as PresenceSetup[]) {
      for (const subject of ["listing", "performance"] as const) {
        const m = setupMessage(s, false, subject);
        const text = `${m?.headline} ${m?.body}`;
        expect(text).not.toMatch(/GBP|Business Profile|\blive\b/);
      }
    }
  });
});

describe("insights: absent is not zero", () => {
  it("an empty series has no total, not 0", () => {
    expect(metricTotal([], "calls")).toBeNull();
  });
  it("a real zero stays a zero", () => {
    expect(metricTotal([day("2026-11-01")], "calls")).toBe(0);
  });
  it("sums the series", () => {
    expect(
      metricTotal([day("2026-11-01", { calls: 2 }), day("2026-11-02", { calls: 3 })], "calls"),
    ).toBe(5);
  });
  it("the api's all-zero totals do not turn an empty series into data", () => {
    expect(
      insightsView(
        {
          days: 28,
          locationName: "locations/1",
          totals: { calls: 0, directions: 0, websiteClicks: 0, messagingClicks: 0, bookings: 0, views: 0 },
          series: [],
        },
        28,
        new Date("2026-11-04T10:00:00Z"),
      ),
    ).toBe("no_data");
  });
});

describe("chartPoints", () => {
  const now = new Date("2026-11-04T15:00:00.000Z");
  it("covers N days ending yesterday", () => {
    const pts = chartPoints([], "calls", 7, now);
    expect(pts).toHaveLength(7);
    expect(pts[0].date).toBe("2026-10-28");
    expect(pts[6].date).toBe("2026-11-03");
  });
  it("a day with no row is null, a day with a zero row is 0", () => {
    const pts = chartPoints([day("2026-11-03", { calls: 0 })], "calls", 3, now);
    expect(pts.map((p) => p.value)).toEqual([null, null, 0]);
  });
  it("reads the selected metric", () => {
    const pts = chartPoints([day("2026-11-03", { directions: 4, calls: 1 })], "directions", 1, now);
    expect(pts[0].value).toBe(4);
  });
  it("the window follows UTC days even when the local clock is on another date", () => {
    const late = new Date("2026-11-04T23:30:00.000Z");
    expect(chartPoints([], "calls", 1, late)[0].date).toBe("2026-11-03");
  });
});

describe("coverageNote", () => {
  it("is silent for a full window or no data", () => {
    expect(coverageNote([], 7)).toBeNull();
    expect(
      coverageNote(
        Array.from({ length: 7 }, (_, i) => day(`2026-11-0${i + 1}`)),
        7,
      ),
    ).toBeNull();
  });
  it("says how many days have figures, and that the rest are not zero", () => {
    const n = coverageNote([day("2026-11-01"), day("2026-11-02")], 7);
    expect(n).toContain("2 of the last 7 days");
    expect(n).toContain("not counted as zero");
  });
});

describe("listing text", () => {
  it("address skips empty parts", () => {
    expect(
      addressLines({ line1: "12 High St", city: "Leeds", postalCode: "LS1 4AB", country: "GB" }),
    ).toEqual(["12 High St", "Leeds, LS1 4AB", "GB"]);
    expect(addressLines(null)).toEqual([]);
  });
  it("hours: Monday first, a day with no period is closed, none set is empty", () => {
    expect(hoursLines([])).toEqual([]);
    const lines = hoursLines([
      { day: "tue", open: "14:00", close: "18:00" },
      { day: "tue", open: "09:00", close: "12:00" },
    ]);
    expect(lines[0]).toEqual({ day: "Monday", periods: null });
    expect(lines[1].periods).toEqual(["09:00 to 12:00", "14:00 to 18:00"]);
    expect(lines).toHaveLength(7);
  });
});

describe("windowSeries keeps tiles, chart and coverage on one list", () => {
  const now = new Date("2026-11-04T15:00:00.000Z");
  it("drops rows outside the drawn window, including today", () => {
    const rows = [day("2026-10-01", { calls: 9 }), day("2026-11-03", { calls: 1 }), day("2026-11-04", { calls: 5 })];
    const w = windowSeries(rows, 7, now);
    expect(w.map((d) => d.date)).toEqual(["2026-11-03"]);
    expect(metricTotal(w, "calls")).toBe(1);
  });
  it("a row only outside the window is no data, not data", () => {
    expect(
      insightsView({ days: 7, locationName: "l", totals: day("x"), series: [day("2026-09-01")] }, 7, now),
    ).toBe("no_data");
  });
  it("accepts a full ISO timestamp for a date", () => {
    const w = windowSeries([day("2026-11-03T00:00:00.000Z", { calls: 2 })], 7, now);
    expect(w[0].date).toBe("2026-11-03");
    expect(chartPoints(w, "calls", 1, now)[0].value).toBe(2);
  });
});

describe("a saved listing survives a lapsed connection", () => {
  it("reconnect and importing keep a saved listing on the listing panel, with a note", () => {
    expect(setupMessage("needs_reconnect", true, "listing")).toBeNull();
    expect(setupMessage("importing", true, "listing")).toBeNull();
    expect(staleSyncNote("needs_reconnect")).toMatch(/reconnect/);
  });
  it("but the figures panel still says it cannot read them", () => {
    expect(setupMessage("needs_reconnect", true, "performance")?.headline).toMatch(/reconnect/);
  });
});

describe("a malformed day is no figure, not a zero or NaN", () => {
  const now = new Date("2026-11-04T15:00:00.000Z");
  const bad = { ...day("2026-11-03", { views: 10 }), calls: null } as unknown as InsightDay;
  it("total skips it, and is null if nothing is a number", () => {
    expect(metricTotal([bad], "calls")).toBeNull();
    expect(metricTotal([bad], "views")).toBe(10);
  });
  it("chart leaves a gap", () => {
    expect(chartPoints([bad], "calls", 1, now)[0].value).toBeNull();
  });
});

describe("hoursLines tolerates day spelling", () => {
  it("Mon and monday both land on Monday", () => {
    const lines = hoursLines([
      { day: "Mon" as never, open: "09:00", close: "17:00" },
      { day: "monday" as never, open: "18:00", close: "20:00" },
    ]);
    expect(lines[0].periods).toEqual(["09:00 to 17:00", "18:00 to 20:00"]);
  });
});

describe("locationSwitcher - only when there is a choice", () => {
  const two = [
    { locationName: "locations/1", title: "Bandra" },
    { locationName: "locations/2", title: null },
  ];

  it("is hidden for a one-listing business, so the page reads as before", () => {
    expect(locationSwitcher([two[0]!], undefined)).toBeNull();
    expect(locationSwitcher([], undefined)).toBeNull();
    expect(locationSwitcher(undefined, undefined)).toBeNull();
  });

  it("lists every listing, by title where there is one", () => {
    expect(locationSwitcher(two, undefined)?.options).toEqual([
      { value: "locations/1", label: "Bandra" },
      { value: "locations/2", label: "locations/2" },
    ]);
  });

  it("shows the chosen listing, and the first when there is no choice", () => {
    expect(locationSwitcher(two, "locations/2")?.value).toBe("locations/2");
    expect(locationSwitcher(two, undefined)?.value).toBe("locations/1");
  });

  it("the first listing is the api's default, so only another listing is asked for by name", () => {
    expect(locationSwitcher(two, undefined)?.isDefault).toBe(true);
    expect(locationSwitcher(two, "locations/1")?.isDefault).toBe(true);
    expect(locationSwitcher(two, "locations/2")?.isDefault).toBe(false);
  });

  it("a choice that is no longer managed falls back to the first, never to a place the api refuses", () => {
    expect(locationSwitcher(two, "locations/9")?.value).toBe("locations/1");
  });
});

describe("query keys follow the listing", () => {
  it("one listing never reads another's cache", () => {
    expect(presenceListingQueryKey("locations/1")).not.toEqual(presenceListingQueryKey("locations/2"));
    expect(presenceInsightsQueryKey(28, "locations/1")).not.toEqual(presenceInsightsQueryKey(28, "locations/2"));
    expect(presenceInsightsQueryKey(28, undefined)).toEqual(presenceInsightsQueryKey(28, undefined));
  });
});
