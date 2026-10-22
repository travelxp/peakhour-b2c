import { describe, expect, it } from "vitest";

import type { OptimizerProposal, OptimizerRun, PaidChannel } from "@/lib/api/growth";
import type { UserPreferences } from "@/lib/auth";
import { formatMoneyCode } from "@/lib/outcome-value";
import {
  ALL_CHANNELS,
  asSentence,
  changedHeading,
  channelChips,
  channelRow,
  channelRows,
  eventDate,
  inChannel,
  learningEmptyText,
  learningItems,
  sourceState,
  uncheckedNote,
} from "./growth-dashboard";

// ★THE VIEWER'S ZONE COMES FROM THEIR SETTINGS, so the tests set it there —
//  no process TZ to pin and restore. One instant, 10:30Z on 2 Oct, is 3 Oct
//  at UTC+14 and 1 Oct at UTC-11: a UTC formatter says 2 Oct to both, and a
//  formatter that ignores the setting says the host's day to both.
const at = (timezone: string) => ({ timezone }) as UserPreferences;
const KIRITIMATI = at("Pacific/Kiritimati");
const PAGO_PAGO = at("Pacific/Pago_Pago");
const INSTANT = "2026-10-02T10:30:00.000Z";

/** How the host locale prints a calendar day — the expected label for it. */
const dayLabel = (m: number, d: number) =>
  new Date(Date.UTC(2026, m - 1, d, 12)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

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
    expect(inChannel(ALL_CHANNELS, "x")).toBe(true);
    expect(inChannel("linkedin", undefined)).toBe(true);
  });

  it("passes an item about the chip's channel and holds back one about another", () => {
    expect(inChannel("linkedin", "linkedin")).toBe(true);
    expect(inChannel("linkedin", "x")).toBe(false);
  });
});

describe("eventDate", () => {
  it("dates an event by the viewer's timezone setting, east and west of UTC", () => {
    expect(eventDate(INSTANT, KIRITIMATI)).toBe(dayLabel(10, 3));
    expect(eventDate(INSTANT, PAGO_PAGO)).toBe(dayLabel(10, 1));
  });
});

describe("formatMoneyCode", () => {
  it("prints the code the way paidNote does, grouped, in whole units for a spend", () => {
    expect(formatMoneyCode(1234.56, "USD", true)).toBe("USD 1,235");
  });

  it("keeps the currency's own decimals for a per-conversion cost", () => {
    expect(formatMoneyCode(1234.56, "USD")).toBe("USD 1,234.56");
    expect(formatMoneyCode(75, "JPY")).toBe("JPY 75");
  });

  it("still prints a code Intl refuses", () => {
    expect(formatMoneyCode(1234.5, "NOTACODE", true)).toBe("NOTACODE 1,235");
    expect(formatMoneyCode(12.5, "NOTACODE")).toBe("NOTACODE 12.5");
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

  it("dates a stale channel by its last read in the viewer's zone, and says nothing for a fresh one", () => {
    expect(channelRow(ch({ stale: true, lastReadAt: INSTANT }), KIRITIMATI).note).toBe(
      `stopped updating — last read ${dayLabel(10, 3)}`,
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

  it("dates each row's last read in the viewer's zone", () => {
    const stale = { ...paid, byChannel: [ch({ stale: true, lastReadAt: INSTANT })] };
    expect(channelRows(stale, ALL_CHANNELS, PAGO_PAGO)[0].note).toBe(`stopped updating — last read ${dayLabel(10, 1)}`);
  });
});

describe("uncheckedNote — what the api could not read", () => {
  it("names each unread source, once, in words", () => {
    expect(uncheckedNote(["connections"])).toBe("We couldn't check your ad connections just now.");
    expect(uncheckedNote(["proposals", "guardrail_blocks"])).toBe(
      "We couldn't check optimizer proposals or what your guardrails held back just now.",
    );
    expect(uncheckedNote(["connections", "proposals", "guardrail_blocks"])).toBe(
      "We couldn't check your ad connections, optimizer proposals or what your guardrails held back just now.",
    );
    expect(uncheckedNote(["mystery", "other"])).toBe("We couldn't check part of this list just now.");
  });

  it("says nothing when every source was read, or from an api that predates the field", () => {
    expect(uncheckedNote([])).toBeNull();
    expect(uncheckedNote(undefined)).toBeNull();
  });
});

describe("sourceState", () => {
  it("reads a source only when it has data", () => {
    expect(sourceState({ data: { runs: [] }, isError: true })).toBe("read");
    expect(sourceState({ data: undefined, isError: true })).toBe("failed");
    expect(sourceState({ data: undefined, isError: false })).toBe("checking");
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
        prop({ id: "a", status: "applied", appliedAt: "2026-09-30T10:30:00.000Z", decidedAt: "2026-09-29T09:00:00.000Z" }),
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
    expect(learningItems(runs, ALL_CHANNELS, { limit: 10 }).map((i) => i.id)).toEqual(["r1-d", "r1-b", "r2-e", "r1-a", "r3-f"]);
  });

  it("says an approved change's effect is not measured, without doubling the effect's own stop", () => {
    const d = learningItems(runs, ALL_CHANNELS).find((i) => i.id === "r1-d");
    expect(d?.headline).toBe("Approved: Move budget to the post that converts");
    expect(d?.detail).toBe(
      "Expected: Roughly 20 more clicks a week at the same total spend. What it actually did isn't measured yet.",
    );
  });

  it("says an applied change's effect is not measured, and dates it by when it was applied, in the viewer's zone", () => {
    const applied = learningItems(runs, ALL_CHANNELS, { prefs: KIRITIMATI }).find((i) => i.id === "r1-a");
    expect(applied?.headline).toBe("Applied: Move budget to the post that converts");
    expect(applied?.detail).toBe("Expected: more leads for the same spend. What it actually did isn't measured yet.");
    // 10:30Z on 30 Sept is 1 Oct at UTC+14 — and still 30 Sept in UTC and
    // every zone west of UTC+13:30, so neither a UTC nor a host-zone date passes.
    expect(applied?.when).toBe(dayLabel(10, 1));
  });

  it("gives a failure its reason, or says none was recorded", () => {
    const items = learningItems(runs, ALL_CHANNELS);
    expect(items.find((i) => i.id === "r3-f")?.detail).toBe("X refused the budget");
    expect(items.find((i) => i.id === "r2-e")?.detail).toBe("No reason was recorded.");
    expect(items.find((i) => i.id === "r3-f")?.when).toBeNull();
  });

  it("says a proposal was dismissed, not who by, and what it expected", () => {
    const d = learningItems(runs, ALL_CHANNELS).find((i) => i.id === "r1-b");
    expect(d?.headline).toBe("Dismissed: Move budget to the post that converts");
    expect(d?.detail).toBe("It expected: more leads for the same spend.");
  });

  it("leaves out a proposal still open", () => {
    expect(learningItems(runs, ALL_CHANNELS, { limit: 10 }).some((i) => i.id === "r1-c")).toBe(false);
  });

  it("narrows to one channel and stops at the limit", () => {
    expect(learningItems(runs, "x").map((i) => i.id)).toEqual(["r2-e", "r3-f"]);
    expect(learningItems(runs, ALL_CHANNELS, { limit: 2 }).map((i) => i.id)).toEqual(["r1-d", "r1-b"]);
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
