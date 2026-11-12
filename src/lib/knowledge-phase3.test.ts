import { describe, expect, it } from "vitest";
import {
  BENCHMARKS_HREF,
  TOO_SMALL_LINE,
  benchmarkView,
  candidateAskedLine,
  channelsCountedLine,
  coverageHidden,
  dayLabel,
  evidenceDownloadError,
  evidenceError,
  evidenceExportPath,
  evidenceItemView,
  evidenceOrder,
  expiredLine,
  instantInZone,
  keepKnown,
  outcomeLines,
  placedLine,
  preselect,
  setBody,
  setCallError,
  setSections,
  toggleChoice,
  topicRows,
  usedUntilLine,
  weekRows,
  type Candidate,
  type EvidenceItem,
  type PolicyStanding,
} from "@/lib/knowledge-phase3";
import { publishButtons, publishErrorLine, type CapabilitiesResponse } from "@/lib/policy-builder";

const caps = (slots: CapabilitiesResponse["channels"][number]["connections"][number]["slots"]): CapabilitiesResponse => ({
  channels: [{ channel: "x", label: "X", connections: [{ id: "c1", label: "My Page", slots }] }],
});

describe("benchmarks", () => {
  it("shows the api's sentence as it is, and never says should", () => {
    const s: PolicyStanding = {
      state: "ready",
      figures: [{ state: "compared", key: "return_window", label: "your return window", sentence: "Most stores like yours give 15 to 30 days for returns; you give 14." }],
    };
    const v = benchmarkView(s);
    expect(v?.kind).toBe("figures");
    expect(JSON.stringify(v)).toContain("Most stores like yours give 15 to 30 days for returns; you give 14.");
    expect(JSON.stringify(v).toLowerCase()).not.toContain("should");
  });
  it("says too few stores in the words the brief gives, for the whole cohort and for one figure", () => {
    expect(benchmarkView({ state: "too_small" })).toEqual({ kind: "note", text: TOO_SMALL_LINE, href: null, linkLabel: null });
    const v = benchmarkView({ state: "ready", figures: [{ state: "too_small", key: "free_shipping", label: "your free-shipping threshold" }] });
    expect(v).toMatchObject({ kind: "figures", figures: [{ text: "Not enough stores like yours yet to compare.", tone: "quiet" }] });
  });
  it("gives each not-measured reason its own line, never a zero", () => {
    const reasons = ["no_answer", "too_few_orders", "unreadable"] as const;
    const texts = reasons.map((reason) => {
      const v = benchmarkView({ state: "ready", figures: [{ state: "not_measured", key: "cash_on_delivery", label: "cash on delivery", reason }] });
      return v?.kind === "figures" ? v.figures[0].text : "";
    });
    expect(new Set(texts).size).toBe(3);
    for (const t of texts) expect(t).not.toMatch(/\b0\b|%/);
  });
  it("links the benchmarks page only when the merchant has not joined", () => {
    expect(benchmarkView({ state: "unavailable", reason: "not_consented" })).toMatchObject({ href: BENCHMARKS_HREF, linkLabel: "Go to Benchmarks" });
    for (const reason of ["pin_disabled", "not_connected", "no_cohort"] as const) expect(benchmarkView({ state: "unavailable", reason })).toMatchObject({ kind: "note", href: null });
  });
  it("shows nothing before the api answers", () => expect(benchmarkView(undefined)).toBeNull());
});

describe("evidence", () => {
  it("reads the order the way the api does and refuses an empty or over-long one before asking", () => {
    expect(evidenceOrder("  #1001 ")).toEqual({ ok: true, order: "#1001" });
    expect(evidenceOrder("   ")).toMatchObject({ ok: false });
    expect(evidenceOrder("9".repeat(65))).toMatchObject({ ok: false });
    expect(evidenceExportPath("#1001")).toBe("/v1/kb/policies/evidence/export?order=%231001");
  });
  it("words each refusal", () => {
    expect(evidenceError({ status: 404, message: "x" })).toBe("We could not find that order. Check the order number or id.");
    expect(evidenceError({ status: 409, message: "More than one order matches that. Use the order's platform id." })).toContain("platform id");
    expect(evidenceError({ status: 409, message: "" })).toContain("platform id");
    expect(evidenceError({ status: 500, message: "boom" })).not.toContain("boom");
    expect(evidenceDownloadError(404)).toContain("could not find");
  });
  const item = (over: Partial<EvidenceItem>): EvidenceItem => ({
    title: "Returns policy",
    channel: "shopify",
    channelLabel: "Shopify",
    slot: "legal_policy",
    target: "legal_policy:abc:def",
    kind: "published",
    text: "Return within 14 days.",
    hash: "h1",
    recordedAt: "2026-11-01T10:00:00.000Z",
    firstRecordAt: "2026-10-01T10:00:00.000Z",
    textMayBeCut: false,
    sentence: "Published by Peakhour to Shopify.",
    ...over,
  });
  it("says live since, as found on, taken off, and no record before, in the business's zone", () => {
    expect(evidenceItemView(item({}), "Asia/Kolkata").status).toBe("Live since 1 Nov 2026, 15:30 (Asia/Kolkata)");
    expect(evidenceItemView(item({ kind: "as_found" }), "UTC").status).toBe("As found on 1 Nov 2026, 10:00 (UTC)");
    expect(evidenceItemView(item({ kind: "removed", text: null }), "UTC").status).toContain("Taken off on");
    const none = evidenceItemView(item({ kind: "no_record_before", text: null, hash: null, recordedAt: null }), "UTC");
    expect(none.status).toBe("No record before 1 Oct 2026, 10:00 (UTC)");
    expect(none.text).toBeNull();
  });
  it("names the channel and the place in words, and keeps the target", () => {
    const v = evidenceItemView(item({}), "UTC");
    expect(v.where).toBe("Shopify, your store policy");
    expect(v.target).toBe("legal_policy:abc:def");
  });
  it("shows the placed-at time in both zones, and once when the zone is UTC", () => {
    const o = { id: "1", name: "#1", number: 1, placedAtUtc: "2026-11-12T14:05:00.000Z", placedAtLocal: "12 Nov 2026, 19:35 (Asia/Kolkata)", timeZone: "Asia/Kolkata", timeZoneNote: null };
    expect(placedLine(o)).toBe("Order placed 12 Nov 2026, 19:35 (Asia/Kolkata), which is 12 Nov 2026, 14:05 (UTC).");
    expect(placedLine({ ...o, timeZone: "UTC", placedAtLocal: "12 Nov 2026, 14:05 (UTC)" })).toBe("Order placed 12 Nov 2026, 14:05 (UTC).");
  });
  it("reads an unreadable zone as UTC", () => expect(instantInZone("2026-11-01T10:00:00.000Z", "Not/AZone")).toBe("1 Nov 2026, 10:00 (UTC)"));
});

describe("expiry", () => {
  it("says used until the day the entry is about, and expired on the day after", () => {
    const seasonal = { eventKey: "diwali|", eventDate: "2026-11-08" };
    expect(usedUntilLine({ seasonal, validUntil: "2026-11-08T18:30:00.000Z", expired: false })).toBe("Used until 8 Nov 2026");
    expect(expiredLine({ seasonal, validUntil: "2026-11-08T18:30:00.000Z", expired: true })).toBe("Expired on 9 Nov 2026");
    expect(usedUntilLine({ seasonal, expired: true })).toBeNull();
    expect(expiredLine({ seasonal, expired: false })).toBeNull();
  });
  it("carries a month end across", () => expect(expiredLine({ seasonal: { eventKey: "k", eventDate: "2026-12-31" }, expired: true })).toBe("Expired on 1 Jan 2027"));
  it("says nothing on an ordinary entry, and reads a suggestion's own day", () => {
    expect(usedUntilLine({ validUntil: null, seasonal: null })).toBeNull();
    expect(usedUntilLine({})).toBeNull();
    expect(usedUntilLine({ eventDate: "2026-12-25", validUntil: "2026-12-25T18:30:00.000Z" })).toBe("Used until 25 Dec 2026");
  });
  it("falls back to the date of validUntil when no day is given", () => {
    expect(expiredLine({ validUntil: "2026-11-09T00:00:00.000Z", expired: true })).toBe("Expired on 9 Nov 2026");
    expect(expiredLine({ expired: true })).toBe("Expired");
  });
  it("reads the last day of use from validUntil as the day before it, so used-until and expired-on differ by a day", () => {
    const e = { validUntil: "2026-11-09T00:00:00.000Z" };
    expect(usedUntilLine({ ...e, expired: false })).toBe("Used until 8 Nov 2026");
    expect(expiredLine({ ...e, expired: true })).toBe("Expired on 9 Nov 2026");
  });
  it("rejects a day that does not exist", () => expect(dayLabel("2026-02-31")).toBeNull());
  it("words the expired refusal plainly", () => {
    expect(publishErrorLine({ code: "EXPIRED", message: "x" }).message).toContain("has expired");
  });
});

describe("conversation starters", () => {
  const ib = { slot: "ice_breakers_messenger", allowed: true } as const;
  it("draws a section from the slots in capabilities, and from nothing else", () => {
    expect(setSections(undefined)).toEqual([]);
    expect(setSections(caps([{ slot: "page", allowed: true }]))).toEqual([]);
    const s = setSections(caps([ib, { slot: "ice_breakers_instagram", allowed: true }]));
    expect(s.map((x) => x.heading)).toEqual(["Messenger conversation starters", "Instagram conversation starters"]);
    expect(s.every((x) => x.enabled)).toBe(true);
  });
  it("draws not_supported as a note with the api's message, and no controls", () => {
    const [s] = setSections(caps([{ slot: "ice_breakers_messenger", allowed: false, reason: "not_supported", message: "Messenger messages are not open yet: Peakhour is waiting for Meta to approve messaging." }]));
    expect(s.enabled).toBe(false);
    expect(s.note).toContain("waiting for Meta");
  });
  it("asks to reconnect for a missing grant, keeping controls only when a recheck is possible", () => {
    const [a] = setSections(caps([{ slot: "ice_breakers_messenger", allowed: false, reason: "grant_missing", recheckable: true }]));
    const [b] = setSections(caps([{ slot: "ice_breakers_messenger", allowed: false, reason: "grant_missing" }]));
    expect([a.enabled, a.reconnect, b.enabled]).toEqual([true, true, false]);
  });
  it("draws no per-entry button for a set slot", () => {
    const c = caps([ib, { slot: "page", allowed: true }]);
    expect(publishButtons(c).map((b) => b.slot)).toEqual(["page"]);
  });
  const cands = (n: number): Candidate[] => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, title: `Q${i}`, timesAsked: 10 - i, lastAskedAt: null, fits: i !== 1, published: false }));
  it("pre-ticks the top four that fit, in the api's order", () => {
    expect(preselect({ slot: "s", maxEntries: 4, candidates: cands(8) })).toEqual(["e0", "e2", "e3", "e4"]);
    expect(preselect({ slot: "s", maxEntries: 2, candidates: cands(8) })).toEqual(["e0", "e2"]);
    expect(preselect({ slot: "s", maxEntries: null, candidates: cands(8) })).toHaveLength(4);
    expect(preselect(undefined)).toEqual([]);
  });
  it("drops a picked entry that is no longer a candidate", () => {
    expect(keepKnown(["e0", "gone", "e2"], { candidates: cands(3) })).toEqual(["e0", "e2"]);
    expect(keepKnown(["e0"], undefined)).toEqual([]);
  });
  it("swaps one without going past the most", () => {
    expect(toggleChoice(["a", "b"], "b", 4)).toEqual(["a"]);
    expect(toggleChoice(["a", "b", "c", "d"], "e", 4)).toEqual(["a", "b", "c", "d"]);
    expect(toggleChoice(["a"], "b", 4)).toEqual(["a", "b"]);
  });
  const section = { channel: "meta", slot: "ice_breakers_messenger", connectionId: "c1" };
  it("sends replace: true only when asked, the connection, and never an empty or over-full set", () => {
    expect(setBody(section, ["a", "b"], true, 4)).toEqual({ ok: true, body: { channel: "meta", slot: "ice_breakers_messenger", entryIds: ["a", "b"], replace: true, connectionId: "c1" } });
    const plain = setBody(section, ["a"], false, 4);
    expect(plain.ok && "replace" in plain.body).toBe(false);
    expect(setBody(section, [], false, 4).ok).toBe(false);
    expect(setBody(section, ["a", "b", "c"], false, 2).ok).toBe(false);
    expect(setBody(section, ["a", "a"], false, 4)).toMatchObject({ ok: true, body: { entryIds: ["a"] } });
  });
  it("writes one line per entry: published, refused in words, and skipped", () => {
    const r = outcomeLines(
      {
        removed: ["old"],
        results: [
          { entryId: "a", outcome: "published" },
          { entryId: "b", outcome: "refused", code: "TITLE_TOO_LONG", error: "\"A very long question\" is 90 characters and the most that fits there is 80. Shorten the title." },
          { entryId: "c", outcome: "skipped" },
        ],
      },
      { a: "Shipping?", b: "A very long question", c: "Returns?" },
    );
    expect(r.removedLine).toBe("Took down 1 question that was there before.");
    expect(r.lines.map((l) => l.tone)).toEqual(["ok", "bad", "quiet"]);
    expect(r.lines[1].text).toContain("most that fits there is 80");
    expect(r.lines[2].text).toContain("Not tried");
  });
  it("words a title-too-long refusal even without the api's sentence", () => {
    expect(publishErrorLine({ code: "TITLE_TOO_LONG" }).message).toContain("Shorten the title");
  });
  it("words the whole-call refusals", () => {
    expect(setCallError({ code: "EMPTY", message: "x" })).toBe("Choose at least one question.");
    expect(setCallError({ code: "TOO_MANY", message: "Choose at most 4." })).toBe("Choose at most 4.");
    expect(setCallError({ code: "TITLE_TOO_LONG", message: "Shorten it. Nothing was changed." })).toContain("Nothing was changed");
  });
  it("says how often a question is asked", () => {
    expect(candidateAskedLine({ timesAsked: 0 })).toBe("Not asked yet");
    expect(candidateAskedLine({ timesAsked: 1 })).toBe("Asked once");
    expect(candidateAskedLine({ timesAsked: 14 })).toBe("Asked 14 times");
  });
});

describe("coverage", () => {
  it("hides the section on a 404 and only on a 404", () => {
    expect(coverageHidden({ status: 404, code: "NOT_FOUND" })).toBe(true);
    expect(coverageHidden({ status: 500 })).toBe(false);
    expect(coverageHidden({ status: 0 })).toBe(false);
    expect(coverageHidden(null)).toBe(false);
  });
  it("lists topics most-asked first, each covered or not, and links an uncovered one to answering it", () => {
    const rows = topicRows([
      { key: "a", label: "Shipping time", asked: 3, covered: true, entryId: "e1" },
      { key: "b", label: "Gift wrap", asked: 9, covered: false, requestId: "r1" },
      { key: "c", label: "Returns", asked: 5, covered: false, policyType: "returns" },
      { key: "d", label: "Odd", asked: 1, covered: false },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["b", "c", "a", "d"]);
    expect(rows[0].action).toMatchObject({ kind: "request" });
    expect(rows[1].action).toMatchObject({ kind: "policy", policyType: "returns" });
    expect(rows[2]).toMatchObject({ covered: true, action: { kind: "none" }, askedLine: "Asked 3 times" });
    expect(rows[3].askedLine).toBe("Asked once");
    expect(rows[3].action.kind).toBe("none");
  });
  it("keeps the api's order for equal counts", () => {
    expect(topicRows([{ key: "x", label: "X", asked: 2, covered: false }, { key: "y", label: "Y", asked: 2, covered: false }]).map((r) => r.key)).toEqual(["x", "y"]);
  });
  it("gives a week with no questions no percentage, and never more answered than asked", () => {
    const rows = weekRows([
      { weekStart: "2026-11-02", asked: 10, answered: 7 },
      { weekStart: "2026-11-09", asked: 0, answered: 0 },
      { weekStart: "2026-11-16", asked: 4, answered: 9 },
    ]);
    expect(rows.map((r) => r.pct)).toEqual([70, null, 100]);
    expect(rows[0].label).toBe("Week of 2 Nov");
    expect(rows[1].barPct).toBe(0);
    expect(rows[2].answered).toBe(4);
  });
  it("names the channels counted", () => {
    expect(channelsCountedLine(["whatsapp", "web"])).toBe("Counted on: WhatsApp and Website chat.");
    expect(channelsCountedLine(["whatsapp"])).toBe("Counted on: WhatsApp.");
    expect(channelsCountedLine([])).toContain("Counted across");
  });
});
