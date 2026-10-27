import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "@/lib/api";
import { FIXTURE_LEARNING } from "@/lib/growth-v2-fixtures";
import { NOT_BUILT, loadLearning, type LearningResponse } from "@/lib/api/growth-v2";
import { LearningBody } from "./learning-screen";

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz-1" } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/growth/learning", useRouter: () => ({ push: vi.fn() }) }));

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PARTS = ["Overnight", "Morning", "Afternoon", "Evening"];

/** The api's live shape: mixed states, a low-power holdout, a benchmark under 20, no creative patterns, sparse cells. */
const LIVE: LearningResponse = {
  experiments: [
    { id: "h1", kind: "holdout", title: "Ads held out of areas covering about 10% of your market", status: "ended", verdict: "winner", startedAt: "2026-09-01T00:00:00.000Z", lift: { value: 0.375 }, liftLow: { value: 0.15 }, liftHigh: { value: 0.6 } },
    { id: "h2", kind: "holdout", title: "Ads on and off, week by week", status: "running", startedAt: "2026-10-01T00:00:00.000Z", lift: { absent: "not_enough_data_to_measure" } },
    { id: "h3", kind: "holdout", title: "Ads held out of areas covering about 5% of your market", status: "abandoned", lift: { absent: "no_holdout_reading_yet" }, note: "no learning-free window in 14 days" },
    { id: "h4", kind: "holdout", title: "An ended holdout that never had enough data", status: "ended", startedAt: "2026-08-01T00:00:00.000Z", lift: { absent: "not_enough_data_to_measure" } },
    { id: "b1", kind: "council_bet", title: "Move 20% of Meta budget to Google.", status: "ended", verdict: "loser", lift: { absent: "judged_by_its_tripwire_not_by_lift" } },
  ],
  creativePatterns: [],
  benchmarks: [
    { metric: "cost_per_outcome", you: { value: 410 }, p25: { value: 450 }, p50: { value: 520 }, p75: { value: 620 }, n: { value: 214 }, source: "pin", asOf: "2026-09-30" },
    { metric: "roas", you: { absent: "not_measured_for_you" }, p25: { absent: "fewer_than_20_businesses" }, p50: { absent: "fewer_than_20_businesses" }, p75: { absent: "fewer_than_20_businesses" }, n: { absent: "fewer_than_20_businesses" }, source: "pin", asOf: "2026-09-30" },
  ],
  heatmap: {
    rows: DAYS,
    columns: PARTS,
    cells: DAYS.flatMap((row) => PARTS.map((column) => ({ row, column, figure: row === "Tue" && column === "Morning" ? { value: 12 } : { absent: "fewer_than_5_credited_orders" } }))),
  },
  basis: {
    experiments: "BASIS-EXPERIMENTS",
    creativePatterns: "Nothing records a creative's lift with a sample size yet.",
    benchmarks: "BASIS-BENCHMARKS",
    heatmap: "BASIS-HEATMAP",
  },
};

describe("loadLearning: a refusal is data, a failure is an error, only a 501 is a preview", () => {
  it.each(["NO_MANDATE", "NO_BUSINESS_CLOCK"] as const)("returns %s as an answer to show", async (code) => {
    expect(await loadLearning(async () => { throw new ApiError(code, "refused", 409); })).toEqual({ refusal: code, preview: false });
  });
  it("returns the live page untouched, and the sample only for 501 NOT_BUILT", async () => {
    expect(await loadLearning(async () => LIVE)).toEqual({ data: LIVE, preview: false });
    expect(await loadLearning(async () => { throw new ApiError(NOT_BUILT, "not built", 501, "r", { row: "H4" }); })).toMatchObject({ preview: true, row: "H4", data: FIXTURE_LEARNING });
  });
  it.each([["500", new ApiError("LEARNING_FAILED", "boom", 500)], ["another 409", new ApiError("ALREADY_DECIDED", "no", 409)]])("rethrows a %s", async (_n, err) => {
    await expect(loadLearning(async () => { throw err; })).rejects.toBe(err);
  });
});

describe("Learning, live", () => {
  const out = html(<LearningBody learning={LIVE} unitPlural="bookings" currency="INR" />);

  it("shows each experiment with its verdict badge only where the api gave one", () => {
    expect(out).toContain("Won");
    expect(out).toContain("Lost");
    expect(out).toContain("Running");
    expect(out).toContain("Abandoned");
    expect(out).toContain("Ended, not enough data to judge");
    // Two verdicts in five experiments.
    expect(out).toContain("5 experiments");
    expect(out).toContain("1 won");
  });

  it("shows a holdout's lift with its range, and a lift without power as an absence with its reason", () => {
    expect(out).toContain("Ads caused");
    expect(out).toContain("38%");
    expect(out).toContain("range 15% to 60%");
    expect(out).toContain("Not available: Not enough data to measure");
    expect(out).toContain("no learning-free window in 14 days");
  });

  it("a council bet says it is judged by its tripwire, not that a figure is missing", () => {
    expect(out).toContain("Judged by its tripwire not by lift");
    expect(out).not.toMatch(/Not available: Judged by its tripwire/);
  });

  it("an empty creative-pattern list shows the api's reason, not a made-up ranking", () => {
    expect(out).toContain("Nothing records a creative&#x27;s lift with a sample size yet.");
    expect(out).not.toContain("Price-first carousel");
  });

  it("shows you against the quartiles with n, and a benchmark under 20 as absences without a comparison", () => {
    expect(out).toContain("214 businesses");
    expect(out).toContain("Better than most");
    expect(out).toContain("Return on ad spend");
    expect(out).toContain("Fewer than 20 businesses");
    expect(out).toContain("BASIS-BENCHMARKS");
  });

  it("the heatmap shades the cell that has data and hatches the rest; its basis is printed", () => {
    expect(out).toContain("BASIS-HEATMAP");
    expect(out.match(/data-absent=""/g)!.length).toBeGreaterThanOrEqual(27);
    expect(out).toContain("peak");
    expect(out).toContain("Tue Morning: 12");
  });

  it("an all-absent heatmap says there is not enough history, never a grid of zeros", () => {
    const empty: LearningResponse = { ...LIVE, heatmap: { ...LIVE.heatmap, cells: LIVE.heatmap.cells.map((c) => ({ ...c, figure: { absent: "fewer_than_5_credited_orders" } })) } };
    const o = html(<LearningBody learning={empty} unitPlural="bookings" currency="INR" />);
    expect(o).toContain("Not enough history yet");
    expect(o).not.toContain("Tue Morning: 12");
  });

  it("nothing at all yet renders the empty states, not an error", () => {
    const none: LearningResponse = { ...LIVE, experiments: [], benchmarks: [] };
    const o = html(<LearningBody learning={none} unitPlural="bookings" currency="INR" />);
    expect(o).toContain("No experiments yet");
    expect(o).toContain("No comparison yet");
    expect(o).toContain("0 experiments");
  });

  it("the sample still renders for the 501 preview", () => {
    const o = html(<LearningBody learning={FIXTURE_LEARNING} unitPlural="bookings" currency="INR" />);
    expect(o).toContain("Price-first carousel");
    expect(o).toContain("5 experiments");
  });
});
