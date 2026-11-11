import { describe, it, expect } from "vitest";
import {
  INSIGHT_METRICS,
  NOT_AVAILABLE_YET,
  changesView,
  chartHasData,
  chartPoints,
  controlNote,
  declaredMetrics,
  fieldWords,
  changeLine,
  putBackValue,
  metricTotal,
  monthStartIso,
  searchTermsView,
  termCountText,
  type InsightDay,
  type PresenceControl,
  type PresenceNetworkEntry,
  type PresenceSearchTerms,
} from "./presence-panels";

/**
 * PE-04b: what the Presence panels may say about control, the network's own changes, search terms and a
 * missing figure. `NET` stands in for the network's display name; the lib names none.
 */

const NET = "TestNet";
type G = PresenceNetworkEntry;

const control = (over: Partial<PresenceControl> = {}): PresenceControl => ({
  state: "controlled",
  reason: null,
  hasPendingVerification: null,
  ownsBusiness: null,
  pendingEdits: null,
  duplicateOf: null,
  checkedAt: "2026-11-03T10:00:00.000Z",
  lastReadFailedAt: null,
  ...over,
});
const caps = (over: Partial<G["capabilities"]> = {}): G["capabilities"] => ({
  control: true,
  networkChanges: true,
  searchTerms: true,
  metricKeys: ["calls", "impressions"],
  ...over,
});
const noTerms: PresenceSearchTerms = { month: null, terms: null, truncated: false, checkedAt: null, lastReadFailedAt: null };
const g = (over: Partial<G> = {}): G => ({
  network: "testnet",
  label: NET,
  externalId: "x",
  status: "synced",
  syncMode: "auto",
  lastSyncedAt: "2026-11-03T10:00:00.000Z",
  driftFields: [],
  control: control(),
  changes: { items: [], pendingFields: [], checkedAt: "2026-11-03T10:00:00.000Z", lastReadFailedAt: null, customerMediaAt: null },
  capabilities: caps(),
  searchTerms: noTerms,
  ...over,
});

describe("controlNote: the three states are three different things", () => {
  it("controlled says you manage the listing, never that edits go live (the publishing status answers that)", () => {
    const n = controlNote(g(), NET)!;
    expect(n.tone).toBe("good");
    expect(n.headline).toBe("You manage this listing");
    expect(n.headline).not.toMatch(/go live/);
  });

  it("not controlled is a warning, and always says may", () => {
    for (const reason of ["under_review", "needs_verification", "ownership_conflict", "guideline_violation", "suspended", "disabled", "other"]) {
      const n = controlNote(g({ control: control({ state: "not_controlled", reason }) }), NET)!;
      expect(n.tone, reason).toBe("warn");
      expect(n.headline).toBe("Your edits may not go live");
      expect(n.body, reason).toMatch(/\bmay\b/);
      expect(n.body).toContain(NET);
    }
  });

  it("an unrecognised reason still warns, in the same hedged words", () => {
    const n = controlNote(g({ control: control({ state: "not_controlled", reason: "something_new" }) }), NET)!;
    expect(n.tone).toBe("warn");
    expect(n.body).toMatch(/may not let your edits go live/);
  });

  it("★unknown is neither 'lost control' nor 'all good'", () => {
    const n = controlNote(g({ control: control({ state: "unknown", checkedAt: null }) }), NET)!;
    expect(n.tone).toBe("unknown");
    expect(n.headline).toMatch(/can't tell/);
    expect(n.headline).not.toBe("You manage this listing");
    expect(n.headline).not.toBe("Your edits may not go live");
    // ★The send blocks on unknown, so it never reassures; it says nothing is sent until we know.
    expect(n.body).not.toMatch(/not a sign that anything is wrong/);
    expect(n.body).toMatch(/Nothing is sent to .+ until we know/);
    expect(n.body).toMatch(/haven't asked/);
  });

  it("unknown after a failed read says we asked and got no answer", () => {
    const n = controlNote(g({ control: control({ state: "unknown", checkedAt: null, lastReadFailedAt: "2026-11-03T11:00:00.000Z" }) }), NET)!;
    expect(n.tone).toBe("unknown");
    expect(n.body).toMatch(/didn't get an answer/);
  });

  it("a failed read after an answer keeps the answer and says it may be out of date", () => {
    const n = controlNote(g({ control: control({ lastReadFailedAt: "2026-11-03T11:00:00.000Z" }) }), NET)!;
    expect(n.tone).toBe("good");
    expect(n.extras.join(" ")).toMatch(/may be out of date/);
  });

  it("a failure OLDER than the answer is not mentioned", () => {
    const n = controlNote(g({ control: control({ lastReadFailedAt: "2026-11-02T11:00:00.000Z" }) }), NET)!;
    expect(n.extras).toEqual([]);
  });

  it("pending edits, a duplicate, and a started verification are each their own sentence", () => {
    const n = controlNote(
      g({ control: control({ state: "not_controlled", reason: "needs_verification", hasPendingVerification: true, pendingEdits: true, duplicateOf: "locations/9" }) }),
      NET,
    )!;
    expect(n.extras).toContain(`Some of your edits are waiting for ${NET} to publish them.`);
    expect(n.extras).toContain(`${NET} may have this business listed twice.`);
    expect(n.extras).toContain("A verification has already been started.");
  });

  it("no verification sentence when none was started, or for another reason", () => {
    const a = controlNote(g({ control: control({ state: "not_controlled", reason: "needs_verification", hasPendingVerification: false }) }), NET)!;
    const b = controlNote(g({ control: control({ state: "not_controlled", reason: "suspended", hasPendingVerification: true }) }), NET)!;
    expect(a.extras).toEqual([]);
    expect(b.extras).toEqual([]);
  });

  it("built from the declaration: no block where the network does not report control", () => {
    expect(controlNote(g({ capabilities: caps({ control: false }) }), NET)).toBeNull();
    expect(controlNote(null, NET)).toBeNull();
  });

  it("names the network it is given and no other", () => {
    const text = JSON.stringify([
      controlNote(g({ control: control({ state: "not_controlled", reason: "suspended" }) }), NET),
      controlNote(g({ control: control({ state: "unknown" }) }), NET),
    ]);
    expect(text).not.toMatch(/google/i);
  });
});

describe("changesView: null and [] are different answers", () => {
  it("★null items is 'no answer yet', which must not read as nothing changed", () => {
    const v = changesView(g({ changes: { items: null, pendingFields: null, checkedAt: null, lastReadFailedAt: null, customerMediaAt: null } }), NET)!;
    expect(v.kind).toBe("no_answer");
    expect((v as { text: string }).text).toMatch(/not the same as no changes/);
    expect((v as { text: string }).text).not.toMatch(/hasn't changed anything/);
  });

  it("★an empty list is the network saying nothing changed", () => {
    const v = changesView(g(), NET)!;
    expect(v.kind).toBe("none");
    expect((v as { text: string }).text).toBe(`${NET} hasn't changed anything on its own.`);
  });

  it("lists what changed, in plain words, with a suggestion when there is one", () => {
    const v = changesView(
      g({
        changes: {
          items: [{ field: "phone", suggested: "+1 555 0100", before: "+1 555 0199" }, { field: "regularHours" }, { field: "other", label: "attributes.x" }],
          pendingFields: ["website"],
          checkedAt: "2026-11-03T10:00:00.000Z",
          lastReadFailedAt: null,
          customerMediaAt: null,
        },
      }),
      NET,
    )!;
    expect(v.kind).toBe("some");
    if (v.kind !== "some") return;
    expect(v.headline).toBe(`${NET} changed 3 things on its own`);
    expect(v.lines.map((l) => l.text)).toEqual([
      `${NET} changed your phone number from "+1 555 0199" to "+1 555 0100".`,
      `${NET} changed your opening hours.`,
      `${NET} changed a detail Peakhour doesn't track yet.`,
    ]);
    // the path is never shown, only sent back to say which change is meant
    expect(JSON.stringify(v.lines.map((l) => l.text))).not.toMatch(/attributes[.]x/);
    expect(v.lines[2]!.path).toBe("attributes.x");
    // put mine back only where we hold plain text
    expect(v.lines.map((l) => l.canPutBack)).toEqual([true, false, false]);
    expect(v.pending).toBe(`Waiting for ${NET} to publish your edit to: website.`);
  });

  it("one change is 'something', and an empty list still reports a waiting edit", () => {
    const one = changesView(g({ changes: { items: [{ field: "name" }], pendingFields: [], checkedAt: "x", lastReadFailedAt: null, customerMediaAt: null } }), NET)!;
    expect((one as { headline: string }).headline).toBe(`${NET} changed something on its own`);
    const waiting = changesView(g({ changes: { items: [], pendingFields: ["description"], checkedAt: "x", lastReadFailedAt: null, customerMediaAt: null } }), NET)!;
    expect((waiting as { text: string }).text).toMatch(/Waiting for TestNet to publish your edit to: description/);
  });

  it("no block where the network does not report changes", () => {
    expect(changesView(g({ capabilities: caps({ networkChanges: false }) }), NET)).toBeNull();
    expect(changesView(null, NET)).toBeNull();
  });

  it("an unknown field is said plainly, never as its path and never blank", () => {
    expect(fieldWords("zzz")).toBe("a detail Peakhour doesn't track yet");
    expect(fieldWords("temporaryClosure")).toBe("temporary closure");
    expect(fieldWords("serviceArea")).toBe("service area");
  });

  it("an unknown before says only to; no value names the field; a long value is one bounded line", () => {
    expect(changeLine({ field: "website", suggested: "https://b.example" }, NET)).toBe(`${NET} changed your website to "https://b.example".`);
    expect(changeLine({ field: "website" }, NET)).toBe(`${NET} changed your website.`);
    expect(changeLine({ field: "description", suggested: ["a", "b".repeat(300)].join(String.fromCharCode(10)) }, NET)).not.toContain(String.fromCharCode(10));
  });

  it("put mine back: the value in the engine's shape, the other numbers going with a phone number", () => {
    expect(putBackValue({ field: "name", before: "Acme" }, null)).toBe("Acme");
    expect(putBackValue({ field: "phone", before: "1" }, { contact: { additionalPhones: ["2"] } })).toEqual({ primary: "1", additional: ["2"] });
    expect(putBackValue({ field: "phone", before: "1" }, null)).toEqual({ primary: "1", additional: [] });
    expect(putBackValue({ field: "regularHours", before: "x" }, null)).toBeNull();
    expect(putBackValue({ field: "phone" }, null)).toBeNull();
    expect(putBackValue({ field: "description", before: "" }, null)).toBeNull();
  });
});

describe("search terms: a threshold is fewer than N, never N", () => {
  const f = (n: number) => String(n);

  it("an exact count reads as a count, singular for one", () => {
    expect(termCountText({ term: "a", value: 120, threshold: null }, f)).toBe("120 searches");
    expect(termCountText({ term: "a", value: 1, threshold: null }, f)).toBe("1 search");
    expect(termCountText({ term: "a", value: 0, threshold: null }, f)).toBe("0 searches");
  });

  it("★a threshold reads 'Fewer than N searches' and shows no bare number", () => {
    const t = termCountText({ term: "a", value: null, threshold: 15 }, f);
    expect(t).toBe("Fewer than 15 searches");
  });

  it("uses the caller's number format", () => {
    expect(termCountText({ term: "a", value: 12345, threshold: null }, (n) => `#${n}`)).toBe("#12345 searches");
    expect(termCountText({ term: "a", value: null, threshold: 15 }, (n) => `#${n}`)).toBe("Fewer than #15 searches");
  });

  it("a term with neither says not available, not 0", () => {
    expect(termCountText({ term: "a", value: null, threshold: null }, f)).toBe("not available yet");
  });

  it("★never asked (terms null) is not 'nobody searched'", () => {
    const v = searchTermsView(g(), NET)!;
    expect(v.kind).toBe("no_answer");
    expect((v as { text: string }).text).toMatch(/haven't received the first list/);
  });

  it("a failed read says it will try again", () => {
    const v = searchTermsView(g({ searchTerms: { ...noTerms, lastReadFailedAt: "2026-11-03T11:00:00.000Z" } }), NET)!;
    expect(v.kind).toBe("no_answer");
    expect((v as { text: string }).text).toMatch(/didn't get an answer/);
  });

  it("an answered month with no terms is its own state and does not claim nobody searched", () => {
    const v = searchTermsView(g({ searchTerms: { month: "2026-10", terms: [], truncated: false, checkedAt: "x", lastReadFailedAt: null } }), NET)!;
    expect(v.kind).toBe("none");
    expect((v as { text: string }).text).toMatch(/doesn't mean nobody searched/);
  });

  it("terms carry a note only when a threshold or a cut applies", () => {
    const mk = (terms: PresenceSearchTerms["terms"], truncated = false) =>
      searchTermsView(g({ searchTerms: { month: "2026-10", terms, truncated, checkedAt: "x", lastReadFailedAt: null } }), NET)! as { kind: "terms"; note: string | null };
    expect(mk([{ term: "a", value: 5, threshold: null }]).note).toBeNull();
    expect(mk([{ term: "a", value: null, threshold: 15 }]).note).toMatch(/"fewer than"/);
    expect(mk([{ term: "a", value: 5, threshold: null }], true).note).toMatch(/cut short/);
    expect(mk([{ term: "a", value: null, threshold: 15 }], true).note).toMatch(/fewer than.*cut short/);
  });

  it("no block where the network does not report search terms", () => {
    expect(searchTermsView(g({ capabilities: caps({ searchTerms: false }) }), NET)).toBeNull();
    expect(searchTermsView(null, NET)).toBeNull();
  });

  it("monthStartIso is a calendar month's first instant in UTC, and only for a real month", () => {
    expect(monthStartIso("2026-10")).toBe("2026-10-01T00:00:00Z");
    expect(monthStartIso("2026-01")).toBe("2026-01-01T00:00:00Z");
    for (const bad of ["2026-13", "2026-00", "Oct 2026", "2026-10\n", "", "2026-1"]) expect(monthStartIso(bad)).toBeNull();
  });
});

describe("a missing figure is not available yet, not zero", () => {
  const day = (date: string, over: Partial<InsightDay> = {}): InsightDay => ({
    date,
    calls: null,
    directions: null,
    websiteClicks: null,
    messagingClicks: null,
    bookings: null,
    views: null,
    ...over,
  });
  const now = new Date("2026-11-04T15:00:00.000Z");

  it("★a metric with no figure on any day has no total", () => {
    expect(metricTotal([day("2026-11-01"), day("2026-11-02")], "calls")).toBeNull();
  });

  it("a stored zero stays a zero, beside a missing metric", () => {
    const rows = [day("2026-11-01", { calls: 0 })];
    expect(metricTotal(rows, "calls")).toBe(0);
    expect(metricTotal(rows, "bookings")).toBeNull();
  });

  it("sums the days that have a figure and skips the ones that do not", () => {
    expect(metricTotal([day("2026-11-01", { calls: 3 }), day("2026-11-02"), day("2026-11-03", { calls: 2 })], "calls")).toBe(5);
  });

  it("a day with a row but no figure is a gap in the chart, not a point at zero", () => {
    const pts = chartPoints([day("2026-11-03", { calls: 4 }), day("2026-11-02")], "calls", 3, now);
    // the window is three days: Nov 1 (no row), Nov 2 (a row, no figure), Nov 3
    expect(pts.map((p) => p.value)).toEqual([null, null, 4]);
  });

  it("★a window of only gaps has no chart", () => {
    expect(chartHasData(chartPoints([day("2026-11-03"), day("2026-11-02")], "calls", 3, now))).toBe(false);
    expect(chartHasData(chartPoints([day("2026-11-03", { calls: 0 })], "calls", 3, now))).toBe(true);
  });

  it("the words for a missing figure never include a 0", () => {
    expect(NOT_AVAILABLE_YET).toBe("Not available yet");
    expect(NOT_AVAILABLE_YET).not.toMatch(/0/);
  });
});

describe("declaredMetrics: tiles come from the declaration", () => {
  it("shows only the declared metrics, through the neutral names", () => {
    const keys = declaredMetrics({ metricKeys: ["calls", "impressions"] }).map((m) => m.key);
    expect(keys).toEqual(["views", "calls"]);
  });

  it("with no declaration to go by, shows them all rather than hiding a figure", () => {
    expect(declaredMetrics(undefined)).toBe(INSIGHT_METRICS);
    expect(declaredMetrics(null)).toBe(INSIGHT_METRICS);
  });

  it("a declaration of nothing shows nothing", () => {
    expect(declaredMetrics({ metricKeys: [] })).toEqual([]);
  });

  it("every tile maps to a distinct neutral key", () => {
    const neutral = INSIGHT_METRICS.map((m) => m.neutral);
    expect(new Set(neutral).size).toBe(neutral.length);
  });
});
