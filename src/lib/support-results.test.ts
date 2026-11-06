import { describe, expect, it } from "vitest";
import {
  DEFINITIONS,
  barWidths,
  csatSwitchFailure,
  firstReplyNote,
  formatMoney,
  formatPercent,
  formatRating,
  formatWait,
  isRealDay,
  presetRange,
  rangeProblem,
  ratingNote,
  resolvedNote,
  revenueHeadline,
  supportExportPath,
  supportQuery,
  supportResultsPath,
  type ChatRevenue,
  type SupportMetrics,
  type SupportParams,
} from "./support-results";

const params = (over: Partial<SupportParams> = {}): SupportParams => ({ from: "", to: "", channel: "all", timeZone: "Asia/Kolkata", ...over });

function metrics(over: Partial<SupportMetrics> = {}): SupportMetrics {
  return {
    from: "2026-11-01T00:00:00.000Z",
    to: "2026-11-04T00:00:00.000Z",
    channel: "all",
    timeZone: "UTC",
    conversations: { total: 10, whatsapp: 8, storefront: 2 },
    truncated: false,
    firstReply: { count: 4, medianMs: 600_000, p90Ms: 1_800_000 },
    resolution: { count: 0, medianMs: null, p90Ms: null },
    aiResolved: { count: 3, settled: 6, share: 0.5, measured: true },
    handOver: { count: 1, rate: 0.125, reasons: [{ reason: "shopper_asked", label: "The customer asked for a person", count: 1 }] },
    csat: { asked: 5, responses: 3, average: 4.333, distribution: { "1": 0, "2": 0, "3": 1, "4": 0, "5": 2 }, byResolvedBy: { ai: { responses: 2, average: 4.5 }, human: { responses: 1, average: 4 } } },
    volume: { byChannel: { whatsapp: 20, storefront: 5 }, byHour: [] },
    ...over,
  };
}
const revenue = (over: Partial<ChatRevenue> = {}): ChatRevenue => ({ basis: "estimated", orders: 3, value: 2050.5, currency: "INR", mixedCurrency: false, truncated: false, byChannel: { whatsapp: null, storefront: null }, ...over });

describe("the query the page sends", () => {
  it("sends the zone always, the channel only when it narrows, and the range only when both days are chosen", () => {
    expect(supportQuery(params())).toBe("tz=Asia%2FKolkata");
    expect(supportQuery(params({ channel: "whatsapp", from: "2026-11-01", to: "2026-11-03" }))).toBe("from=2026-11-01&to=2026-11-03&channel=whatsapp&tz=Asia%2FKolkata");
  });

  it("never sends half a range (the API would read the missing end as today or 30 days back)", () => {
    expect(supportQuery(params({ from: "2026-11-01" }))).toBe("tz=Asia%2FKolkata");
    expect(supportQuery(params({ to: "2026-11-01" }))).toBe("tz=Asia%2FKolkata");
  });

  it("the page and the CSV read the same query", () => {
    const p = params({ channel: "storefront", from: "2026-11-01", to: "2026-11-03" });
    expect(supportResultsPath(p)).toBe(`/v1/meta/whatsapp/support-analytics?${supportQuery(p)}`);
    expect(supportExportPath(p)).toBe(`/v1/meta/whatsapp/support-analytics/export?${supportQuery(p)}`);
  });
});

describe("the date range", () => {
  it("a preset is the last N days with today included, as UTC days", () => {
    expect(presetRange(7, new Date("2026-11-03T22:00:00Z"))).toEqual({ from: "2026-10-28", to: "2026-11-03" });
    expect(presetRange(30, new Date("2026-11-03T00:00:00Z"))).toEqual({ from: "2026-10-05", to: "2026-11-03" });
  });

  it("a calendar day that does not exist is not a day", () => {
    expect(isRealDay("2026-11-03")).toBe(true);
    expect(isRealDay("2026-02-30")).toBe(false);
    expect(isRealDay("2026-1-3")).toBe(false);
    expect(isRealDay("")).toBe(false);
  });

  it("names what is wrong with a range, and nothing for a good one or an empty one", () => {
    expect(rangeProblem("", "")).toBeNull();
    expect(rangeProblem("2026-11-01", "2026-11-03")).toBeNull();
    expect(rangeProblem("2026-11-05", "2026-11-01")).toBe("The first day must not be after the last day.");
    expect(rangeProblem("2026-02-30", "2026-03-01")).toBe("Choose real dates.");
    expect(rangeProblem("2026-01-01", "2026-11-01")).toBe("Choose at most 180 days.");
    expect(rangeProblem("2026-05-08", "2026-11-03")).toBeNull();
  });
});

describe("how a number is said", () => {
  it("a wait in the units a person uses, rounded, and nothing measured is not zero", () => {
    expect(formatWait(null)).toBe("No replies yet");
    expect(formatWait(0)).toBe("0 sec");
    expect(formatWait(45_000)).toBe("45 sec");
    expect(formatWait(12 * 60_000)).toBe("12 min");
    expect(formatWait(65 * 60_000)).toBe("1 h 5 min");
    expect(formatWait(2 * 3_600_000)).toBe("2 h");
    expect(formatWait(27 * 3_600_000)).toBe("1 d 3 h");
    expect(formatWait(48 * 3_600_000)).toBe("2 d");
    expect(formatWait(-5)).toBe("No replies yet");
  });

  it("a share, a rating and money", () => {
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.666)).toBe("67%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe("Not enough yet");
    expect(formatRating(4.333)).toBe("4.3 out of 5");
    expect(formatRating(null)).toBe("No ratings yet");
    expect(formatMoney(1999.5, "INR")).toMatch(/1,999\.50/);
    expect(formatMoney(5, "NOT-A-CURRENCY")).toBe("NOT-A-CURRENCY 5");
  });

  it("bar widths are relative to the biggest and all zero when nothing happened", () => {
    expect(barWidths([5, 10, 0])).toEqual([50, 100, 0]);
    expect(barWidths([0, 0])).toEqual([0, 0]);
    expect(barWidths([])).toEqual([]);
  });
});

describe("revenue from chats is an estimate and says when it has no total", () => {
  it("a total with the estimate caveat", () => {
    const h = revenueHeadline(revenue());
    expect(h.value).toMatch(/2,050\.50/);
    expect(h.note).toBe("Orders that included items from the assistant's chats. Shoppers might have bought them anyway, so this is an estimate.");
  });

  it("no orders is said as no orders, not as zero money", () => {
    expect(revenueHeadline(revenue({ orders: 0, value: null }))).toEqual({ value: "No orders yet", note: "No order has come through a chat in this range." });
  });

  it("states the order count and why there is no total: mixed currency, too many, or an unpriced item", () => {
    expect(revenueHeadline(revenue({ mixedCurrency: true, value: null, currency: null }))).toEqual({ value: "3 orders", note: "These orders are in more than one currency, so no total is shown." });
    expect(revenueHeadline(revenue({ truncated: true, value: null }))).toMatchObject({ value: "3 orders", note: expect.stringContaining("too many orders") });
    expect(revenueHeadline(revenue({ value: null }))).toMatchObject({ value: "3 orders", note: expect.stringContaining("no usable price") });
  });
});

describe("what sits under each headline figure", () => {
  it("the assistant's share names the counts it rests on, for every channel (storefront is measured now)", () => {
    expect(resolvedNote(metrics())).toBe("3 of 6 settled conversations were resolved by the assistant.");
    expect(resolvedNote(metrics({ aiResolved: { count: 0, settled: 0, share: null, measured: true } }))).toBe("No conversation has settled in this range yet.");
    // a storefront-only range is a real figure, not "not measured"
    expect(resolvedNote(metrics({ channel: "storefront", aiResolved: { count: 2, settled: 4, share: 0.5, measured: true } }))).toBe("2 of 4 settled conversations were resolved by the assistant.");
    expect(resolvedNote(metrics({ aiResolved: { count: 2, settled: 4, share: 0.5, measured: true } }))).not.toMatch(/not measured/i);
  });

  it("the first reply names how many replies it rests on", () => {
    expect(firstReplyNote({ count: 4, medianMs: 600_000, p90Ms: 1_800_000 })).toBe("9 in 10 first replies came within 30 min (4 measured).");
    expect(firstReplyNote({ count: 0, medianMs: null, p90Ms: null })).toBe("No conversation in this range was answered by a person.");
  });

  it("the rating says how many answered out of how many were asked, and whether anyone is being asked", () => {
    expect(ratingNote(metrics(), true)).toBe("From 3 ratings out of 5 asked.");
    expect(ratingNote(metrics({ csat: { ...metrics().csat, asked: 1, responses: 1 } }), true)).toBe("From 1 rating.");
    expect(ratingNote(metrics({ csat: { ...metrics().csat, asked: 0, responses: 0, average: null } }), false)).toBe("Customers are not being asked to rate. Turn it on below.");
    expect(ratingNote(metrics({ csat: { ...metrics().csat, asked: 0, responses: 0, average: null } }), true)).toBe("No one has been asked in this range yet.");
    expect(ratingNote(metrics({ csat: { ...metrics().csat, asked: 4, responses: 0, average: null } }), true)).toBe("4 asked, none answered yet.");
  });
});

describe("the ratings switch", () => {
  it("a refusal is a sentence from the status, never the server's text", () => {
    expect(csatSwitchFailure(403)).toBe("Only an editor, admin or owner can change this.");
    expect(csatSwitchFailure(401)).toBe("Your session expired. Refresh the page and try again.");
    expect(csatSwitchFailure(500)).toBe("We couldn't save that. Try again in a moment.");
  });
});

describe("the copy a merchant reads", () => {
  const all = [...DEFINITIONS.map((d) => `${d.term} ${d.text}`), formatWait(null), formatRating(null), formatPercent(null)].join(" ");

  it("never shows a retired name or jargon, and says AI credits, never Peaks", () => {
    for (const bad of [/\bPeaks\b/, /\bLens\b/, /Peakhour Commerce/, /Commerce Assistant/, /\bholdout\b/i, /\blift\b/i, /\bagent\b/i, /Growth Council/]) expect(all).not.toMatch(bad);
  });

  it("every definition is a plain sentence and the revenue one says it is an estimate", () => {
    expect(DEFINITIONS.every((d) => d.text.endsWith("."))).toBe(true);
    expect(DEFINITIONS.find((d) => d.term === "Revenue from chats")!.text).toContain("It is an estimate");
    expect(DEFINITIONS.find((d) => d.term === "Resolved by the assistant")!.text).toBe(
      "A WhatsApp conversation the assistant closed with no person replying (the outcome check billed it), or a storefront chat the assistant answered start to finish: the visitor wrote, the assistant replied, and the chat was never handed to the team, no person wrote in it, and nothing new has come for 24 hours. The share is of the conversations that have settled: the assistant resolved them, or a person handled or closed them, or the chat was handed to the team and has gone quiet for 24 hours. A conversation still open is not counted either way.",
    );
    expect(DEFINITIONS.find((d) => d.term === "Handed over")!.text).toBe(
      "A WhatsApp or storefront conversation the assistant passed to the team, because the customer asked for a person, could not be answered twice running, was upset more than once, or raised a payment, refund or discount problem. The rate is of the conversations in the range. A person taking a conversation over on their own is not a hand-over.",
    );
    expect(all).not.toMatch(/grounded/i);
    expect(DEFINITIONS.find((d) => d.term === "Test chats")!.text).toBe("Your own Test on your store chats are never counted.");
  });
});
