import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import { formatPeaks } from "@/lib/pricing";
import { META_ANALYTICS_BATCH } from "@/lib/api/meta-ads";
import {
  META_OFFSET_ONE_CURRENCIES,
  ISO_ZERO_DECIMAL_NOT_IN_META_TABLE,
  META_MERCHANT_FACING_CODES,
  formatMetaMoney,
  metaAdsErrorMessage,
  metaAdsNeedsReconnect,
  metaBudgetLabel,
  metaCurrencyOffsetDecimals,
  metaInsightsRange,
  metaKpiState,
  metaKpiText,
  metaFigureText,
  metaInsightsIds,
  META_INSIGHTS_MAX_CAMPAIGNS,
  metaLaunchChargeSentence,
  metaMinorToMajor,
  metaNotServingBecause,
  metaStatusToggle,
  sumReported,
} from "./meta-ads-view";

/**
 * ★★M-16 — the Meta panel's decisions, as a spec. b2c has no DOM harness, so
 * these are the only executable statement of what the panel does.
 */

describe("★★M-16 money — Meta's minor units are not always cents", () => {
  it("★★M-16 a two-decimal currency divides by 100", () => {
    expect(metaMinorToMajor("50000", "INR")).toBe(500);
    expect(metaMinorToMajor("1999", "USD")).toBe(19.99);
  });

  it("★★M-16 an offset-one currency does NOT — ¥5,000 is not ¥50", () => {
    expect(metaMinorToMajor("5000", "JPY")).toBe(5000);
    expect(metaMinorToMajor("5000", "jpy")).toBe(5000);
    // ⏸And the ISO zero-decimal ones Meta's table does not mention.
    expect(metaMinorToMajor("5000", "XOF")).toBe(5000);
  });

  it("★M-16 a missing currency is Meta's default, two decimals", () => {
    expect(metaCurrencyOffsetDecimals(undefined)).toBe(2);
  });

  it("★★M-16 an empty or non-numeric budget is absent, not a budget of zero", () => {
    expect(metaMinorToMajor("", "USD")).toBeUndefined();
    expect(metaMinorToMajor(" ", "USD")).toBeUndefined();
    expect(metaMinorToMajor("12.5", "USD")).toBeUndefined();
    expect(metaMinorToMajor(undefined, "USD")).toBeUndefined();
  });

  it("★M-16 money is grouped in the PINNED locale, whatever the host's", () => {
    expect(formatMetaMoney(250000, "INR")).toBe("₹250,000.00");
    expect(formatMetaMoney(5000, "JPY")).toBe("¥5,000");
  });

  it("★M-16 an unknown currency code still renders rather than throwing", () => {
    expect(formatMetaMoney(12, "ZZZ1")).toBe("ZZZ1 12.00");
  });
});

describe("★★M-16 budget line", () => {
  it("★M-16 a daily budget reads per day", () => {
    expect(metaBudgetLabel({ dailyBudget: "50000" }, "INR", "campaign")).toEqual({
      kind: "daily",
      text: "₹500.00/day",
    });
  });

  it("★M-16 a lifetime budget reads as a total", () => {
    expect(metaBudgetLabel({ lifetimeBudget: "100000" }, "USD", "adSet").kind).toBe("lifetime");
  });

  it("★★M-16 a campaign with NO budget says where the budget is, not zero", () => {
    // Without campaign budget optimisation the budget lives on the ad sets.
    const label = metaBudgetLabel({}, "USD", "campaign");
    expect(label).toEqual({ kind: "elsewhere", text: "Set on its ad sets" });
    expect(label.text).not.toMatch(/0/);
  });

  it("★M-16 and an ad set with none points at its campaign", () => {
    expect(metaBudgetLabel({ dailyBudget: "0" }, "USD", "adSet").text).toBe("Set on its campaign");
  });
});

describe("★★M-16 absent is not zero", () => {
  it("★★M-16 nothing reported is undefined, not a total of 0", () => {
    expect(sumReported([undefined, undefined])).toBeUndefined();
    expect(sumReported([])).toBeUndefined();
  });

  it("★★M-16 a real zero IS a total", () => {
    expect(sumReported([0, 0])).toEqual({ total: 0, reported: 2, of: 2 });
  });

  it("★★M-16 a partial report says how partial", () => {
    expect(sumReported([10, undefined, 5])).toEqual({ total: 15, reported: 2, of: 3 });
  });

  it("★M-16 a NaN is not a report", () => {
    expect(sumReported([Number.NaN, 4])).toEqual({ total: 4, reported: 1, of: 2 });
  });
});

describe("★★M-16 status", () => {
  it("★M-16 ACTIVE and PAUSED flip to each other", () => {
    expect(metaStatusToggle("ACTIVE")).toEqual({ next: "PAUSED" });
    expect(metaStatusToggle("PAUSED")).toEqual({ next: "ACTIVE" });
  });

  it("★★M-16 anything else offers no toggle — a delete is not undone here", () => {
    expect(metaStatusToggle("DELETED")).toBeNull();
    expect(metaStatusToggle("ARCHIVED")).toBeNull();
    expect(metaStatusToggle("")).toBeNull();
  });

  it("★★M-16 an ACTIVE ad set under a PAUSED campaign is not serving, and says so", () => {
    expect(metaNotServingBecause("ACTIVE", { campaign: "PAUSED" })).toBe(
      "Not serving — its campaign is paused.",
    );
  });

  it("★★M-16 an ACTIVE ad under a PAUSED ad set is not serving either — three levels", () => {
    expect(metaNotServingBecause("ACTIVE", { campaign: "ACTIVE", adSet: "PAUSED" })).toBe(
      "Not serving — its ad set is paused.",
    );
  });

  it("★M-16 the campaign is named first when both ancestors are paused", () => {
    expect(metaNotServingBecause("ACTIVE", { campaign: "PAUSED", adSet: "PAUSED" })).toMatch(
      /campaign/,
    );
  });

  it("★★M-16 no note when the whole chain is ACTIVE, or the node is itself paused", () => {
    // ⚠️THE ALARM DIRECTION: a note on a serving ad would tell a merchant a
    // live ad is dark.
    expect(metaNotServingBecause("ACTIVE", { campaign: "ACTIVE", adSet: "ACTIVE" })).toBeNull();
    expect(metaNotServingBecause("ACTIVE", { campaign: "ACTIVE" })).toBeNull();
    expect(metaNotServingBecause("PAUSED", { campaign: "PAUSED" })).toBeNull();
  });
});

describe("★★M-16 the price before Activate (§7.0.1 requirement 4)", () => {
  it("★★M-16 quotes the row's MULTIPLIER — what the rollup charges", () => {
    const s = metaLaunchChargeSentence({ free: false, creditMultiplier: 30 });
    expect(s).toContain(`${formatPeaks(30)} Peaks`);
    expect(s).toMatch(/once/);
  });

  it("★★M-16 says Ads Manager campaigns are never charged — the api's own rule", () => {
    expect(metaLaunchChargeSentence({ free: false, creditMultiplier: 30 })).toMatch(
      /Ads Manager are never charged/,
    );
  });

  it("★M-16 a free row says free, never '0 Peaks'", () => {
    const s = metaLaunchChargeSentence({ free: true, creditMultiplier: 30 });
    expect(s).toMatch(/free/i);
    expect(s).not.toMatch(/\d+ Peaks/);
  });

  it("★★M-16 an unloaded card quotes no number", () => {
    const s = metaLaunchChargeSentence(undefined);
    expect(s).not.toMatch(/\d/);
    expect(s).toMatch(/may be charged/);
  });
});

describe("★★M-16 errors", () => {
  it("★★M-16 a merchant-facing code renders the api's own sentence", () => {
    const err = new ApiError("ADS_HALTED", "Advertising is switched off for this business.", 409);
    expect(metaAdsErrorMessage(err, "fallback")).toBe("Advertising is switched off for this business.");
  });

  it("★★M-16 STATUS_PERSIST_FAILED keeps its warning — Meta already moved", () => {
    const err = new ApiError(
      "STATUS_PERSIST_FAILED",
      "The campaign is now ACTIVE on Meta, but we couldn't record that here.",
      500,
    );
    expect(metaAdsErrorMessage(err, "Couldn't update")).toMatch(/now ACTIVE on Meta/);
  });

  it("★★M-16 a fallback code's raw text is NOT rendered — it can be Meta's own error", () => {
    const err = new ApiError("FETCH_FAILED", "(#100) Unsupported get request. Object 1202 …", 400, "req-9");
    const s = metaAdsErrorMessage(err, "Couldn't load campaigns.");
    expect(s).toBe("Couldn't load campaigns. (reference req-9)");
    expect(s).not.toContain("#100");
  });

  it("★M-16 a non-ApiError is the fallback", () => {
    expect(metaAdsErrorMessage(new Error("boom"), "Couldn't load.")).toBe("Couldn't load.");
  });

  it("★M-16 reconnect-class failures are recognised, others are not", () => {
    expect(metaAdsNeedsReconnect(new ApiError("NEEDS_REAUTH", "x", 409))).toBe(true);
    expect(metaAdsNeedsReconnect(new ApiError("CAPABILITY_SCOPE_MISSING", "x", 403))).toBe(true);
    expect(metaAdsNeedsReconnect(new ApiError("ADS_HALTED", "x", 409))).toBe(false);
    expect(metaAdsNeedsReconnect(new Error("x"))).toBe(false);
  });
});

describe("★M-16 insights range", () => {
  it("★M-16 is date-only, which is all the api's regex accepts", () => {
    const [start, end] = metaInsightsRange(30, new Date("2026-09-23T18:00:00Z"));
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toBe("2026-09-23");
  });

  it("★★M-16 R1.5 holds EXACTLY `days` dates — Meta's time_range is inclusive at both ends", () => {
    // It read 2026-08-24..2026-09-23: 31 dates under a "30d" label.
    const [start, end] = metaInsightsRange(30, new Date("2026-09-23T18:00:00Z"));
    expect(start).toBe("2026-08-25");
    const dates = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
    expect(dates).toBe(30);
  });
});

describe("★★M-16 R1.3 the KPI cards never claim what we did not ask", () => {
  const base = {
    campaignsPending: false,
    campaignsError: false,
    campaignCount: 3,
    insightsPending: false,
    insightsError: false,
  };

  it("★★M-16 R1.3 while CAMPAIGNS load, the cards are loading — not 'Not reported'", () => {
    // The insights query is disabled until campaigns arrive, and a disabled
    // query's isLoading is false in v5 — which is what said "Not reported".
    // ⚠️THE INPUT THE PANEL ACTUALLY PASSES: while campaigns load, the id list
    //  is EMPTY (so `campaignCount` is 0) and the disabled insights query is
    //  pending. A first cut passed `campaignCount: 3` here — a state the panel
    //  cannot be in — and a mutation deleting the campaigns-pending check
    //  SURVIVED it, because the count routed around the check. With the real
    //  input, dropping the check says "No campaigns" about an account whose
    //  campaigns have not arrived yet.
    expect(
      metaKpiState({ ...base, campaignsPending: true, campaignCount: 0, insightsPending: true }),
    ).toBe("loading");
    expect(metaKpiText("loading", undefined, String)).toBeNull();
  });

  it("★★M-16 R1.3 a failed campaign read is an error, not 'Not reported'", () => {
    const s = metaKpiState({ ...base, campaignsError: true, insightsPending: true });
    expect(s).toBe("error");
    expect(metaKpiText(s, undefined, String)).toBe("Unavailable");
  });

  it("★M-16 a failed insights read is an error too", () => {
    expect(metaKpiState({ ...base, insightsError: true })).toBe("error");
  });

  it("★M-16 no campaigns says so", () => {
    const s = metaKpiState({ ...base, campaignCount: 0, insightsPending: true });
    expect(s).toBe("none");
    expect(metaKpiText(s, undefined, String)).toBe("No campaigns");
  });

  it("★★M-16 only a COMPLETED insights read may say it has no figures", () => {
    expect(metaKpiState(base)).toBe("ready");
    expect(metaKpiText("ready", undefined, String)).toBe("No figures");
    // ★★R3.1: no claim that Meta withheld anything — a campaign that did not
    //  deliver may return no row at all, and that is not an omission.
    expect(metaKpiText("ready", undefined, String)).not.toMatch(/report/i);
    expect(metaKpiText("ready", { total: 12, reported: 1, of: 1 }, (n) => `#${n}`)).toBe("#12");
  });
});

describe("★★M-16 R2.1 a table cell obeys the cards' rule", () => {
  const money = (n: number) => `$${n}`;

  it("★★M-16 R2.1 a FAILED insights read is 'Unavailable' in the row, not 'Not reported'", () => {
    expect(metaFigureText("error", undefined, money)).toBe("Unavailable");
  });

  it("★M-16 R2.1 loading is blank, a completed read without a figure is 'No figures'", () => {
    expect(metaFigureText("loading", undefined, money)).toBe("");
    expect(metaFigureText("ready", undefined, money)).toBe("No figures");
    expect(metaFigureText("ready", 12, money)).toBe("$12");
  });

  it("★★M-16 R2.1 the panel spells 'Not reported' nowhere itself — every figure goes through the helper", () => {
    // ⚠️R1.3 fixed the cards and left the rows with their own ternary: the
    // one-place-of-two shape. A quoted copy in the panel is the next place.
    const panel = readFileSync(
      fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/meta-ads-panel.tsx", import.meta.url)),
      "utf8",
    );
    expect(panel).toContain("metaFigureText(");
    // ⚠️ANYWHERE IN THE FILE, COMMENTS INCLUDED — M-13's policy for Meta paths,
    //  for its reason. Two narrower versions were tried and both failed their
    //  own paired cases: "in expression position" cannot tell a comment's
    //  `ABSENT IS NOT ZERO: "…"` from a ternary's `: "…"`. The panel's comments
    //  were rephrased instead, which is the safe direction.
    expect(panel).not.toMatch(/Not reported|No figures/);
  });

  it("★M-16 R2.1 and that check SAYS SO for a real copy", () => {
    expect(/Not reported/.test('spend={v !== undefined ? fmt(v) : "Not reported"}')).toBe(true);
  });
});

describe("★★M-16 R2.2 the not-serving note names what the parent IS", () => {
  it("★★M-16 R2.2 an ARCHIVED campaign is not called paused — it has no switch to resume", () => {
    expect(metaNotServingBecause("ACTIVE", { campaign: "ARCHIVED" })).toBe(
      "Not serving — its campaign is archived.",
    );
    expect(metaNotServingBecause("ACTIVE", { campaign: "ACTIVE", adSet: "DELETED" })).toBe(
      "Not serving — its ad set is deleted.",
    );
  });

  it("★M-16 R2.2 an unknown status is 'not active', never a guess at 'paused'", () => {
    expect(metaNotServingBecause("ACTIVE", { campaign: "IN_PROCESS" })).toBe(
      "Not serving — its campaign is not active.",
    );
  });
});

describe("★★#571 R1.2 the insights read is capped at the old cost, and says so", () => {
  it("★★R1.2 at most two analytics batches — what the panel cost when the list stopped at 50", () => {
    expect(META_INSIGHTS_MAX_CAMPAIGNS).toBeLessThanOrEqual(2 * META_ANALYTICS_BATCH);
    const ids = Array.from({ length: 500 }, (_, i) => `c${i}`);
    expect(metaInsightsIds(ids)).toHaveLength(META_INSIGHTS_MAX_CAMPAIGNS);
    expect(metaInsightsIds(ids)[0]).toBe("c0");
  });

  it("★R1.2 fewer campaigns than the cap are all requested", () => {
    expect(metaInsightsIds(["a", "b"])).toEqual(["a", "b"]);
  });

  it("★★R1.2 a campaign we never asked about is 'Not loaded', never 'No figures'", () => {
    // "No figures" is a statement about what Meta answered.
    expect(metaFigureText("ready", undefined, String, false)).toBe("Not loaded");
    expect(metaFigureText("ready", undefined, String, true)).toBe("No figures");
  });

  it("★★R1.2 the panel requests, totals and labels by the capped list", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/meta-ads-panel.tsx", import.meta.url)),
      "utf8",
    );
    expect(src).toContain("metaAdsApi.insights(insightIds,");
    expect(src).not.toContain("metaAdsApi.insights(campaignIds,");
    expect(src).toContain("insightSet.has(c.id)");
  });
});

describe("★★the panel reads the api's truncated flag, never a count (api#1409)", () => {
  const panel = () =>
    readFileSync(
      fileURLToPath(new URL("../app/(site)/dashboard/ads/_components/meta-ads-panel.tsx", import.meta.url)),
      "utf8",
    );

  it("★★each of the three lists shows its notice from `.truncated`", () => {
    const src = panel();
    for (const q of ["campaigns", "adSets", "ads"]) {
      expect(src, q).toContain(`${q}.data?.truncated === true`);
    }
  });

  it("★★and no notice is decided by comparing a length to a page size", () => {
    // ⚠️The rule this replaced: a list of exactly 50 read as "maybe more",
    //  which is the alarm direction once the route follows the cursor.
    expect(panel()).not.toMatch(/length\s*>=\s*\d+|PAGE_SIZE/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe("★★M-16 — the copies are peakhour-api's, checked against its source", () => {
  /**
   * ⏸THE SIBLING CHECKOUT, OR A SKIP — `meta-ads-surface.test.ts`'s rule: keyed
   * on the CHECKOUT, not on the file. A missing checkout skips; a missing FILE
   * inside a present checkout FAILS, because that is the api moving the thing
   * these copies are checked against.
   */
  const SIBLING = fileURLToPath(new URL("../../../peakhour-api", import.meta.url));
  const HELPER = fileURLToPath(
    new URL("../../../peakhour-api/src/v1/helpers/meta-ads.ts", import.meta.url),
  );
  const ROUTES = fileURLToPath(
    new URL("../../../peakhour-api/src/v1/routes/meta-ads/index.ts", import.meta.url),
  );
  const CAPABILITY = fileURLToPath(
    new URL("../../../peakhour-api/src/v1/helpers/meta-capability.ts", import.meta.url),
  );
  const present = existsSync(SIBLING);
  const read = (p: string) => {
    if (!existsSync(p)) throw new Error(`[m16] peakhour-api is checked out but ${p} is missing`);
    return readFileSync(p, "utf8");
  };
  /** The quoted members of `const <name> = new Set([...])` in `src`. */
  const setMembers = (src: string, name: string): string[] => {
    const m = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(src);
    if (!m) throw new Error(`[m16] no ${name} in the api helper`);
    return [...m[1]!.matchAll(/"([A-Z]{3})"/g)].map((x) => x[1]!).sort();
  };

  it.skipIf(!present)("★★M-16 the offset-one currencies are the api's, exactly", () => {
    const src = read(HELPER);
    const api = setMembers(src, "META_OFFSET_ONE_CURRENCIES");
    expect(api.length).toBeGreaterThan(5);
    expect([...META_OFFSET_ONE_CURRENCIES].sort()).toEqual(api);
  });

  it.skipIf(!present)("★★M-16 and so are the ISO zero-decimal ones", () => {
    const src = read(HELPER);
    const api = setMembers(src, "ISO_ZERO_DECIMAL_NOT_IN_META_TABLE");
    expect(api.length).toBeGreaterThan(5);
    expect([...ISO_ZERO_DECIMAL_NOT_IN_META_TABLE].sort()).toEqual(api);
  });

  it.skipIf(!present)("★★the api's three list routes return the truncated flag the panel reads", () => {
    // ⏸THE MERGE ORDER, AS A TEST: red against an api checkout that predates
    //  api#1409, which is the deploy this client needs.
    const routes = read(ROUTES);
    for (const key of ["campaigns", "adSets", "ads"]) {
      expect(routes, key).toMatch(new RegExp(`return ok\\(c, \\{ ${key}, truncated \\}\\)`));
    }
  });

  it.skipIf(!present)("★★M-16 the batch size is the api's analytics cap", () => {
    const m = /const MAX_ANALYTICS_CAMPAIGNS = (\d+);/.exec(read(ROUTES));
    expect(m, "MAX_ANALYTICS_CAMPAIGNS not found in the api's route file").not.toBeNull();
    expect(META_ANALYTICS_BATCH).toBe(Number(m![1]));
  });

  it.skipIf(!present)("★★M-16 every allowlisted code is one the Meta routes can actually send", () => {
    // ⚠️NON-VACUITY FOR THE ALLOWLIST. A code spelled wrongly here is a code
    // whose merchant-facing sentence is silently replaced by the fallback —
    // the allowlist would permit nothing it names.
    const routes = read(ROUTES);
    const capability = read(CAPABILITY);
    const missing = [...META_MERCHANT_FACING_CODES].filter(
      (code) => !routes.includes(`"${code}"`) && !capability.includes(`"${code}"`),
    );
    expect(missing).toEqual([]);
  });
});
