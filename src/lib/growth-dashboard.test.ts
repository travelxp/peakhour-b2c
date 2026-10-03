import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { OptimizerProposal, OptimizerRun, PaidChannel } from "@/lib/api/growth";
import {
  ALL_CHANNELS,
  asSentence,
  changedHeading,
  channelChips,
  channelRow,
  channelRows,
  codeMoney,
  eventDate,
  inChannel,
  learningEmptyText,
  learningItems,
  proposalItems,
  reconnectItems,
  sourceState,
  uncheckedNote,
  withoutCoveredAdsStale,
  type NeedsYouItem,
} from "./growth-dashboard";

// ★UTC+14, the one host zone where an event late in a UTC day is already the
//  next local day — a UTC formatter (`shortDate`) survives every other zone a
//  developer's machine is likely to be in. Set back afterwards, explicitly.
const HOST_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Pacific/Kiritimati";
});
afterAll(() => {
  if (HOST_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = HOST_TZ;
});

/** The local day of a local noon — what eventDate must print for that day. */
const localDay = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const ch = (over: Partial<PaidChannel> = {}): PaidChannel => ({
  platform: "linkedin",
  impressions: 1000,
  clicks: 20,
  spend: 300,
  currency: "USD",
  conversions: 4,
  measurement: "partial",
  campaigns: 2,
  stale: false,
  moved: true,
  lastReadAt: "2026-10-01T10:00:00.000Z",
  ...over,
});

const prop = (over: Partial<OptimizerProposal> = {}): OptimizerProposal => ({
  id: "p1",
  type: "budget_shift" as OptimizerProposal["type"],
  summary: "Move budget to the post that converts",
  evidence: [],
  expectedEffect: "more leads for the same spend",
  rollbackCondition: "cost per lead rises 20%",
  autoApplicable: false,
  status: "proposed",
  ...over,
});

const run = (platform: string, proposals: OptimizerProposal[], id = `run-${platform}`): OptimizerRun => ({
  _id: id,
  platform,
  weekStart: "2026-09-28T00:00:00.000Z",
  proposals,
  createdAt: "2026-09-28T01:00:00.000Z",
});

const item = (id: string, channels?: string[]): NeedsYouItem => ({
  id,
  severity: "attention",
  title: id,
  detail: "",
  ...(channels ? { channels } : {}),
});

describe("channelChips", () => {
  it("offers no filter below two channels", () => {
    expect(channelChips([])).toEqual([]);
    expect(channelChips(["linkedin", "linkedin"])).toEqual([]);
  });

  it("offers All plus each channel once, labelled by platform", () => {
    const chips = channelChips(["linkedin", "meta", "linkedin"]);
    expect(chips.map((c) => c.key)).toEqual([ALL_CHANNELS, "linkedin", "meta"]);
    expect(chips[1].label).toMatch(/LinkedIn/);
    expect(chips[1].label).not.toBe("linkedin");
  });
});

describe("inChannel", () => {
  it("passes everything under All, and an item about the business under any chip", () => {
    expect(inChannel(ALL_CHANNELS, ["x"])).toBe(true);
    expect(inChannel("linkedin", undefined)).toBe(true);
    expect(inChannel("linkedin", [])).toBe(true);
  });

  it("passes an item naming the chip's channel, among others or alone", () => {
    expect(inChannel("linkedin", ["linkedin"])).toBe(true);
    expect(inChannel("linkedin", ["x", "linkedin"])).toBe(true);
  });

  it("holds back an item about other channels only", () => {
    expect(inChannel("linkedin", ["x"])).toBe(false);
    expect(inChannel("linkedin", ["x", "meta"])).toBe(false);
  });
});

describe("eventDate", () => {
  it("dates an event by the merchant's local day, not the UTC day", () => {
    // 20:30Z on 2 Oct is 10:30 on 3 Oct at UTC+14.
    expect(eventDate("2026-10-02T20:30:00.000Z")).toBe(localDay(2026, 10, 3));
  });
});

describe("codeMoney", () => {
  it("prints the code the way paidNote does, grouped, in whole units for a spend", () => {
    expect(codeMoney(1234.56, "USD", true)).toBe("USD 1,235");
  });

  it("keeps the currency's own decimals for a per-conversion cost", () => {
    expect(codeMoney(1234.56, "USD")).toBe("USD 1,234.56");
    expect(codeMoney(75, "JPY")).toBe("JPY 75");
  });

  it("still prints a code Intl refuses", () => {
    expect(codeMoney(1234.5, "NOTACODE", true)).toBe("NOTACODE 1,235");
    expect(codeMoney(12.5, "NOTACODE")).toBe("NOTACODE 12.5");
  });
});

describe("channelRow", () => {
  it("divides spend by conversions for the cost per conversion, in the channel's currency", () => {
    const r = channelRow(ch({ spend: 1234.56, conversions: 4 }));
    expect(r.spend).toBe("USD 1,235");
    expect(r.conversions).toBe("4");
    expect(r.costPerConversion).toBe("USD 308.64");
  });

  it("names a platform that reports no conversions, never 0", () => {
    const r = channelRow(ch({ conversions: null, measurement: "untracked" }));
    expect(r.conversions).toBe("not reported");
    expect(r.costPerConversion).toBe("not measurable");
    expect(r.badge?.label).toBe("Not tracked");
  });

  it("refuses a cost per conversion when spend has no total", () => {
    expect(channelRow(ch({ spend: null })).costPerConversion).toBe("spend not totalled");
    expect(channelRow(ch({ spend: null })).spend).toBe("couldn't be totalled");
  });

  it("refuses a spend with no currency rather than printing a bare number", () => {
    const r = channelRow(ch({ currency: undefined }));
    expect(r.spend).toBe("couldn't be totalled");
    expect(r.costPerConversion).toBe("spend not totalled");
  });

  it("says no conversions yet for a measured zero, and does not divide by it", () => {
    const r = channelRow(ch({ conversions: 0 }));
    expect(r.conversions).toBe("0");
    expect(r.costPerConversion).toBe("no conversions yet");
  });

  it("says a channel that did not move has no figures this window, not a refusal or a zero", () => {
    const r = channelRow(ch({ moved: false, stale: true, spend: null, currency: undefined, conversions: 0 }));
    expect(r.spend).toBe("no figures this window");
    expect(r.conversions).toBe("no figures this window");
    expect(r.costPerConversion).toBe("no figures this window");
    expect(r.note).toMatch(/^stopped updating/);
    expect(r.badge?.label).toBe("Partial");
  });

  it("reads a channel with no moved flag as moved, as paidNote does", () => {
    const r = channelRow(ch({ moved: undefined }));
    expect(r.spend).toBe("USD 300");
    expect(r.costPerConversion).toBe("USD 75.00");
  });

  it("badges each measurement level by name", () => {
    expect(channelRow(ch({ measurement: "tracked" })).badge).toMatchObject({ label: "Tracked", tone: "success" });
    expect(channelRow(ch({ measurement: "partial" })).badge).toMatchObject({ label: "Partial", tone: "warning" });
    expect(channelRow(ch({ measurement: "untracked" })).badge).toMatchObject({ label: "Not tracked", tone: "muted" });
  });

  it("claims a delivery receipt for tracked and no failure for partial", () => {
    expect(channelRow(ch({ measurement: "tracked" })).badge?.meaning).toMatch(/upload reached it in full/);
    expect(channelRow(ch({ measurement: "tracked" })).badge?.meaning).not.toMatch(/checked against/);
    expect(channelRow(ch({ measurement: "partial" })).badge?.meaning).toMatch(/can't confirm/);
  });

  it("shows no badge when the api sent no measurement", () => {
    expect(channelRow(ch({ measurement: undefined })).badge).toBeNull();
  });

  it("dates a stale channel by its last read in local time, and says nothing for a fresh one", () => {
    expect(channelRow(ch({ stale: true, lastReadAt: "2026-10-02T20:30:00.000Z" })).note).toBe(
      `stopped updating — last read ${localDay(2026, 10, 3)}`,
    );
    expect(channelRow(ch({ stale: true, lastReadAt: null })).note).toBe("stopped updating");
    expect(channelRow(ch()).note).toBeNull();
  });
});

describe("channelRows", () => {
  const paid = {
    impressions: 2000,
    campaigns: 3,
    spend: null,
    byChannel: [ch(), ch({ platform: "meta" })],
  };

  it("lists every channel under All and one under its chip", () => {
    expect(channelRows(paid, ALL_CHANNELS).map((r) => r.platform)).toEqual(["linkedin", "meta"]);
    expect(channelRows(paid, "meta").map((r) => r.platform)).toEqual(["meta"]);
  });

  it("is empty with no paid section", () => {
    expect(channelRows(null, ALL_CHANNELS)).toEqual([]);
  });
});

describe("proposalItems", () => {
  it("counts open proposals per channel across every run", () => {
    const items = proposalItems([
      run("linkedin", [prop(), prop({ id: "p2", status: "applied" })], "r1"),
      run("linkedin", [prop({ id: "p3" })], "r2"),
      run("x", [prop({ id: "p4" })], "r3"),
    ]);
    expect(items.map((i) => [i.channels, i.title])).toEqual([
      [["linkedin"], "2 optimizer proposals waiting for your decision"],
      [["x"], "1 optimizer proposal waiting for your decision"],
    ]);
    expect(items[0].href).toBe("/dashboard/optimizer");
  });

  it("raises nothing when no proposal is open", () => {
    expect(proposalItems([run("linkedin", [prop({ status: "dismissed" })])])).toEqual([]);
    expect(proposalItems([])).toEqual([]);
  });
});

describe("reconnectItems", () => {
  it("raises a reconnect for an ads connection that needs it", () => {
    const items = reconnectItems([{ provider: "linkedin_ads", status: "needs_reauth" }]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "reconnect-linkedin",
      severity: "critical",
      channels: ["linkedin"],
      href: "/dashboard/ads?channel=linkedin",
    });
  });

  it("raises nothing when a live connection to the same channel exists", () => {
    expect(
      reconnectItems([
        { provider: "x_ads", status: "needs_reauth" },
        { provider: "x_ads", connected: true, status: "active" },
      ]),
    ).toEqual([]);
  });

  it("raises nothing for a live, an absent or a non-ads connection", () => {
    expect(reconnectItems([{ provider: "linkedin_ads", connected: true, status: "active" }])).toEqual([]);
    expect(reconnectItems([])).toEqual([]);
    expect(reconnectItems([{ provider: "linkedin", status: "needs_reauth" }])).toEqual([]);
  });

  it("reads Meta through its ads capability, not the raw facebook row", () => {
    const withAds = { provider: "facebook", status: "needs_reauth", account: { extra: { adAccounts: [{ id: "a" }] } } };
    const pagesOnly = { provider: "facebook", status: "needs_reauth", account: { extra: { pages: [{ id: "p" }] } } };
    expect(reconnectItems([withAds]).map((i) => i.id)).toEqual(["reconnect-meta"]);
    expect(reconnectItems([pagesOnly])).toEqual([]);
  });
});

describe("withoutCoveredAdsStale", () => {
  const stale = (channels?: string[]) => [item("ads-stale", channels), item("nothing-published")];
  const ids = (xs: { id: string }[]) => xs.map((a) => a.id);

  it("drops ads-stale when every channel it names has a reconnect card — with no paid section at all", () => {
    expect(ids(withoutCoveredAdsStale(stale(["linkedin"]), [item("reconnect-linkedin", ["linkedin"])]))).toEqual([
      "nothing-published",
    ]);
  });

  it("keeps ads-stale when a channel it names has no reconnect card", () => {
    expect(
      ids(withoutCoveredAdsStale(stale(["linkedin", "x"]), [item("reconnect-linkedin", ["linkedin"])])),
    ).toEqual(["ads-stale", "nothing-published"]);
  });

  it("keeps an ads-stale that names no channel, and keeps it with no reconnect cards", () => {
    expect(ids(withoutCoveredAdsStale(stale(), [item("reconnect-x", ["x"])]))).toEqual([
      "ads-stale",
      "nothing-published",
    ]);
    expect(ids(withoutCoveredAdsStale(stale([]), [item("reconnect-x", ["x"])]))).toEqual([
      "ads-stale",
      "nothing-published",
    ]);
    expect(ids(withoutCoveredAdsStale(stale(["x"]), []))).toEqual(["ads-stale", "nothing-published"]);
  });

  it("never drops another action, whatever channels it names", () => {
    const other = [item("campaigns-no-spend", ["linkedin"])];
    expect(ids(withoutCoveredAdsStale(other, [item("reconnect-linkedin", ["linkedin"])]))).toEqual([
      "campaigns-no-spend",
    ]);
  });
});

describe("sourceState and uncheckedNote", () => {
  it("reads a source only when it has data", () => {
    expect(sourceState({ data: { runs: [] }, isError: true })).toBe("read");
    expect(sourceState({ data: undefined, isError: true })).toBe("failed");
    expect(sourceState({ data: undefined, isError: false })).toBe("checking");
  });

  it("names each source that failed", () => {
    expect(uncheckedNote({ proposals: "failed", connections: "read" })).toBe(
      "We couldn't check optimizer proposals just now.",
    );
    expect(uncheckedNote({ proposals: "failed", connections: "failed" })).toBe(
      "We couldn't check optimizer proposals or your ad connections just now.",
    );
  });

  it("says a source still loading is still being checked", () => {
    expect(uncheckedNote({ proposals: "read", connections: "checking" })).toBe("Still checking your ad connections.");
    expect(uncheckedNote({ proposals: "checking", connections: "checking" })).toBe(
      "Still checking optimizer proposals and your ad connections.",
    );
    expect(uncheckedNote({ proposals: "failed", connections: "checking" })).toBe(
      "We couldn't check optimizer proposals just now. Still checking your ad connections.",
    );
  });

  it("says nothing when both were read", () => {
    expect(uncheckedNote({ proposals: "read", connections: "read" })).toBeNull();
  });
});

describe("asSentence", () => {
  it("adds a stop to text that has none", () => {
    expect(asSentence("more leads")).toBe("more leads.");
    expect(asSentence("  more leads  ")).toBe("more leads.");
  });

  it("keeps the stop the text already ends with, inside a closing quote too", () => {
    expect(asSentence("Roughly 20 more clicks a week.")).toBe("Roughly 20 more clicks a week.");
    expect(asSentence("More leads!")).toBe("More leads!");
    expect(asSentence("It said “wait.”")).toBe("It said “wait.”");
  });
});

describe("learningItems", () => {
  const runs = [
    run(
      "linkedin",
      [
        prop({ id: "a", status: "applied", appliedAt: "2026-09-30T20:30:00.000Z", decidedAt: "2026-09-29T09:00:00.000Z" }),
        prop({ id: "b", status: "dismissed", decidedAt: "2026-10-02T09:00:00.000Z" }),
        prop({ id: "c", status: "proposed" }),
        prop({
          id: "d",
          status: "approved",
          decidedAt: "2026-10-03T09:00:00.000Z",
          expectedEffect: "Roughly 20 more clicks a week at the same total spend.",
        }),
      ],
      "r1",
    ),
    run("x", [prop({ id: "e", status: "failed", decidedAt: "2026-10-01T09:00:00.000Z" })], "r2"),
    run("x", [prop({ id: "f", status: "failed", failReason: "X refused the budget" })], "r3"),
  ];

  it("lists approved, applied, dismissed and failed proposals, newest first, undated last", () => {
    expect(learningItems(runs, ALL_CHANNELS, 10).map((i) => i.id)).toEqual(["r1-d", "r1-b", "r2-e", "r1-a", "r3-f"]);
  });

  it("says an approved change's effect is not measured, without doubling the effect's own stop", () => {
    const d = learningItems(runs, ALL_CHANNELS).find((i) => i.id === "r1-d");
    expect(d?.headline).toBe("You approved: Move budget to the post that converts");
    expect(d?.detail).toBe(
      "Expected: Roughly 20 more clicks a week at the same total spend. What it actually did isn't measured yet.",
    );
  });

  it("says an applied change's effect is not measured, and dates it by when it was applied, locally", () => {
    const applied = learningItems(runs, ALL_CHANNELS).find((i) => i.id === "r1-a");
    expect(applied?.headline).toBe("Applied: Move budget to the post that converts");
    expect(applied?.detail).toBe("Expected: more leads for the same spend. What it actually did isn't measured yet.");
    expect(applied?.when).toBe(localDay(2026, 10, 1));
  });

  it("gives a failure its reason, or says none was recorded", () => {
    const items = learningItems(runs, ALL_CHANNELS);
    expect(items.find((i) => i.id === "r3-f")?.detail).toBe("X refused the budget");
    expect(items.find((i) => i.id === "r2-e")?.detail).toBe("No reason was recorded.");
    expect(items.find((i) => i.id === "r3-f")?.when).toBeNull();
  });

  it("says who dismissed a proposal and what it expected", () => {
    const d = learningItems(runs, ALL_CHANNELS).find((i) => i.id === "r1-b");
    expect(d?.headline).toBe("You dismissed: Move budget to the post that converts");
    expect(d?.detail).toBe("It expected: more leads for the same spend.");
  });

  it("leaves out a proposal still open", () => {
    expect(learningItems(runs, ALL_CHANNELS, 10).some((i) => i.id === "r1-c")).toBe(false);
  });

  it("narrows to one channel and stops at the limit", () => {
    expect(learningItems(runs, "x").map((i) => i.id)).toEqual(["r2-e", "r3-f"]);
    expect(learningItems(runs, ALL_CHANNELS, 2).map((i) => i.id)).toEqual(["r1-d", "r1-b"]);
  });
});

describe("learningEmptyText", () => {
  it("speaks for the business under All", () => {
    expect(learningEmptyText(ALL_CHANNELS)).toMatch(/^Nothing has been tried yet\./);
  });

  it("speaks only for the chip's channel under a chip", () => {
    const t = learningEmptyText("meta");
    expect(t).toMatch(/^Nothing has been tried on .*Meta.* yet\.$/);
    expect(t).not.toBe(learningEmptyText(ALL_CHANNELS));
  });
});

describe("changedHeading", () => {
  it("claims no comparison and not 'this week'", () => {
    expect(changedHeading(28)).toBe("What changed in the last 28 days");
  });
});
