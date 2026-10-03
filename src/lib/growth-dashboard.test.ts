import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { OptimizerProposal, OptimizerRun, PaidChannel } from "@/lib/api/growth";
import { formatMoney } from "@/lib/outcome-value";
import {
  ALL_CHANNELS,
  changedHeading,
  channelChips,
  channelRow,
  channelRows,
  eventDate,
  inChannel,
  isAdsAction,
  learningItems,
  needsYouUnder,
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

const item = (id: string, channel?: string): NeedsYouItem => ({
  id,
  severity: "attention",
  title: id,
  detail: "",
  ...(channel ? { channel } : {}),
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
  it("passes everything under All, and an untagged item under any filter", () => {
    expect(inChannel(ALL_CHANNELS, "x")).toBe(true);
    expect(inChannel("linkedin", undefined)).toBe(true);
  });

  it("passes only the filtered channel's items", () => {
    expect(inChannel("linkedin", "linkedin")).toBe(true);
    expect(inChannel("linkedin", "x")).toBe(false);
  });
});

describe("eventDate", () => {
  it("dates an event by the merchant's local day, not the UTC day", () => {
    // 20:30Z on 2 Oct is 10:30 on 3 Oct at UTC+14.
    expect(eventDate("2026-10-02T20:30:00.000Z")).toBe(localDay(2026, 10, 3));
  });
});

describe("channelRow", () => {
  it("divides spend by conversions for the cost per conversion, in the channel's currency", () => {
    const r = channelRow(ch());
    expect(r.spend).toBe(formatMoney(300, "USD"));
    expect(r.conversions).toBe("4");
    expect(r.costPerConversion).toBe(formatMoney(75, "USD"));
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
    expect(r.spend).toBe(formatMoney(300, "USD"));
    expect(r.costPerConversion).toBe(formatMoney(75, "USD"));
  });

  it("badges each measurement level by name", () => {
    expect(channelRow(ch({ measurement: "tracked" })).badge).toMatchObject({ label: "Tracked", tone: "success" });
    expect(channelRow(ch({ measurement: "partial" })).badge).toMatchObject({ label: "Partial", tone: "warning" });
    expect(channelRow(ch({ measurement: "untracked" })).badge).toMatchObject({ label: "Not tracked", tone: "muted" });
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
    expect(items.map((i) => [i.channel, i.title])).toEqual([
      ["linkedin", "2 optimizer proposals waiting for your decision"],
      ["x", "1 optimizer proposal waiting for your decision"],
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
      channel: "linkedin",
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
  const actions = [{ id: "ads-stale" }, { id: "nothing-published" }];
  const paid = (stale: string[]) => ({
    impressions: 1,
    campaigns: 1,
    spend: null,
    byChannel: ["linkedin", "x"].map((p) => ch({ platform: p, stale: stale.includes(p) })),
  });

  it("drops ads-stale when every stale channel already has a reconnect card", () => {
    expect(
      withoutCoveredAdsStale(actions, paid(["linkedin"]), [item("reconnect-linkedin", "linkedin")]).map((a) => a.id),
    ).toEqual(["nothing-published"]);
  });

  it("keeps ads-stale when a stale channel has no reconnect card", () => {
    expect(
      withoutCoveredAdsStale(actions, paid(["linkedin", "x"]), [item("reconnect-linkedin", "linkedin")]).map((a) => a.id),
    ).toEqual(["ads-stale", "nothing-published"]);
  });

  it("keeps ads-stale when nothing reported is stale, and with no reconnect cards", () => {
    expect(withoutCoveredAdsStale(actions, paid([]), [item("reconnect-x", "x")]).map((a) => a.id)).toEqual([
      "ads-stale",
      "nothing-published",
    ]);
    expect(withoutCoveredAdsStale(actions, paid(["x"]), []).map((a) => a.id)).toEqual([
      "ads-stale",
      "nothing-published",
    ]);
  });
});

describe("needsYouUnder", () => {
  const items = [
    item("reconnect-x", "x"),
    item("campaigns-no-spend"),
    item("campaign-no-audience-abc"),
    item("nothing-published"),
    item("proposals-linkedin", "linkedin"),
  ];

  it("shows everything under All, holding nothing back", () => {
    expect(needsYouUnder(ALL_CHANNELS, items)).toEqual({ items, heldBack: 0 });
  });

  it("under a chip shows that channel's items and the business's, and counts the ads items naming no channel", () => {
    const r = needsYouUnder("linkedin", items);
    expect(r.items.map((i) => i.id)).toEqual(["nothing-published", "proposals-linkedin"]);
    expect(r.heldBack).toBe(2);
  });

  it("tells an ads action from a business one by its id", () => {
    for (const id of ["ads-stale", "campaigns-no-spend", "campaign-no-audience-1"]) expect(isAdsAction(id)).toBe(true);
    for (const id of ["analytics-stale", "nothing-published", "conversions-not_connected", "traffic-without-effort"])
      expect(isAdsAction(id)).toBe(false);
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

describe("learningItems", () => {
  const runs = [
    run(
      "linkedin",
      [
        prop({ id: "a", status: "applied", appliedAt: "2026-09-30T20:30:00.000Z", decidedAt: "2026-09-29T09:00:00.000Z" }),
        prop({ id: "b", status: "dismissed", decidedAt: "2026-10-02T09:00:00.000Z" }),
        prop({ id: "c", status: "proposed" }),
        prop({ id: "d", status: "approved", decidedAt: "2026-10-03T09:00:00.000Z" }),
      ],
      "r1",
    ),
    run("x", [prop({ id: "e", status: "failed", decidedAt: "2026-10-01T09:00:00.000Z" })], "r2"),
    run("x", [prop({ id: "f", status: "failed", failReason: "X refused the budget" })], "r3"),
  ];

  it("lists approved, applied, dismissed and failed proposals, newest first, undated last", () => {
    expect(learningItems(runs, ALL_CHANNELS, 10).map((i) => i.id)).toEqual(["r1-d", "r1-b", "r2-e", "r1-a", "r3-f"]);
  });

  it("says an approved change's effect is not measured", () => {
    const d = learningItems(runs, ALL_CHANNELS).find((i) => i.id === "r1-d");
    expect(d?.headline).toBe("You approved: Move budget to the post that converts");
    expect(d?.detail).toBe("Expected: more leads for the same spend. What it actually did isn't measured yet.");
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

describe("changedHeading", () => {
  it("says what the movements compare, not 'this week'", () => {
    expect(changedHeading(28)).toBe("What changed — the last 28 days against the 28 before");
  });
});
