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
  verificationNote,
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

describe("verificationNote", () => {
  it("words each non-verified state and says nothing for verified or unknown", () => {
    expect(verificationNote("unverified")).toMatch(/hasn't verified/);
    expect(verificationNote("PENDING")).toMatch(/still verifying/);
    expect(verificationNote("suspended")).toMatch(/suspended/);
    expect(verificationNote("verified")).toBeNull();
    expect(verificationNote("VERIFIED")).toBeNull();
    expect(verificationNote("weird")).toBeNull();
    expect(verificationNote(undefined)).toBeNull();
  });
});
