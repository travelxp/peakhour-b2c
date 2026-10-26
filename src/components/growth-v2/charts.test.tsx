import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIXTURE_CHANNELS, FIXTURE_HOME, FIXTURE_HOME_SERIES, FIXTURE_PACING_SERIES } from "@/lib/growth-v2-fixtures";
import { ChannelBubbles } from "./channel-bubbles";
import { CreativeLeaderboard, rankPatterns } from "./creative-leaderboard";
import { EfficiencyBullet } from "./efficiency-bullet";
import { EnquiryHeatmap } from "./enquiry-heatmap";
import { LiftBand } from "./lift-band";
import { OutcomeFunnel } from "./outcome-funnel";
import { PacingChart } from "./pacing-chart";
import { ShareByWeek } from "./share-by-week";
import { WhyWaterfall } from "./why-waterfall";
import { splitFeedText } from "./activity-feed";
import { standing } from "./benchmark-rows";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("EfficiencyBullet", () => {
  it("draws no bar and says so when your figure is absent, but keeps the target and industry", () => {
    const out = html(<EfficiencyBullet metric="cost_per_outcome" you={{ absent: "No outcomes yet" }} target={{ value: 450 }} industry={{ value: 520 }} currency="INR" />);
    expect(out).toContain("You not available");
    expect(out).toContain("450");
    expect(out).toContain("520");
    expect(out).toContain("You not available, Target");
    // The bar is the only element with an inline width; no figure, no bar.
    expect(out).not.toContain('style="width');
  });

  it("draws every mark when all three are present", () => {
    const out = html(<EfficiencyBullet {...FIXTURE_HOME.efficiency} currency="INR" unit="booking" />);
    expect(out).toContain("410");
    expect(out).toContain("Industry median");
  });
});

describe("LiftBand", () => {
  it("says the weekly chart is unavailable, and draws no line, when there is no series", () => {
    const out = html(<LiftBand weeks={undefined} lift={FIXTURE_HOME.lift} unitPlural="bookings" />);
    expect(out).toContain("not available yet");
    expect(out).not.toContain("<svg");
  });

  it("withholds the lift claim when the holdout is low-powered", () => {
    const out = html(<LiftBand weeks={undefined} lift={{ liftPct: { absent: "Holdout too small" }, confidence: { absent: "n/a" }, windowDays: 28 }} unitPlural="bookings" />);
    expect(out).toContain("Too early to say");
    expect(out).toContain("Holdout too small");
    expect(out).not.toContain("would not have happened");
  });

  it("breaks the band at a week with no range instead of inventing one", () => {
    const weeks = FIXTURE_HOME_SERIES.liftWeeks.map((w, i) => (i === 3 ? { weekStart: w.weekStart, withAds: w.withAds, holdout: w.holdout } : w));
    const out = html(<LiftBand weeks={weeks} lift={FIXTURE_HOME.lift} unitPlural="bookings" />);
    // Two runs of consecutive ranged weeks (0-2 and 4-7) means two band polygons.
    expect(out.match(/fill-opacity="0.18"/g)).toHaveLength(2);
  });
});

describe("WhyWaterfall", () => {
  it("replaces the chart with a sentence when a total is absent", () => {
    const items = FIXTURE_HOME.waterfall.map((i) => (i.key === "start" ? { ...i, figure: { absent: "No September reading" } } : i));
    const out = html(<WhyWaterfall items={items} currency="INR" />);
    expect(out).not.toContain("<svg");
    expect(out).toContain("Not available");
  });

  it("marks an absent cause n/a and does not move the running total", () => {
    const items = FIXTURE_HOME.waterfall.map((i) => (i.key === "season" ? { ...i, figure: { absent: "No seasonality data" } } : i));
    const out = html(<WhyWaterfall items={items} currency="INR" />);
    expect(out).toContain("n/a");
    expect(out).toContain("No seasonality data");
  });
});

describe("OutcomeFunnel", () => {
  it("shows an untracked stage as a labelled gap and the funnel as partly tracked", () => {
    const stages = FIXTURE_HOME.funnel.stages.map((s) => (s.key === "enquired" ? { ...s, figure: { absent: "LinkedIn not tracked" } } : s));
    const out = html(<OutcomeFunnel stages={stages} />);
    expect(out).toContain("Partly tracked");
    expect(out).toContain("LinkedIn not tracked");
    expect(out).toContain("Not available");
  });

  it("is a sentence, not an empty chart, when nothing was counted", () => {
    const out = html(<OutcomeFunnel stages={[{ key: "a", label: "A", figure: { absent: "x" } }]} />);
    expect(out).toContain("none of the stages");
  });
});

describe("PacingChart", () => {
  it("draws the day-by-day line only when it has a series", () => {
    const spent = { value: 13940, currency: "INR" };
    const ceiling = { value: 20000, currency: "INR" };
    expect(html(<PacingChart spent={spent} ceiling={ceiling} daysLeft={9} series={FIXTURE_PACING_SERIES} />)).toContain("<svg");
    const without = html(<PacingChart spent={spent} ceiling={ceiling} daysLeft={9} />);
    expect(without).not.toContain("<svg");
    expect(without).toContain("day-by-day line is not available");
  });

  it("does not draw a meter with an invented spend when spend is absent", () => {
    const out = html(<PacingChart spent={{ absent: "No spend data" }} ceiling={{ value: 20000, currency: "INR" }} daysLeft={9} />);
    expect(out).toContain("Not available");
    expect(out).not.toContain("progressbar");
  });
});

describe("ShareByWeek", () => {
  it("draws a dashed gap where a platform has no share, rather than growing the others", () => {
    const weeks = [
      {
        weekStart: "2026-10-05",
        shares: [
          { platform: "meta" as const, share: { value: 0.5 } },
          { platform: "google_ads" as const, share: { absent: "no report" } },
        ],
      },
    ];
    const out = html(<ShareByWeek weeks={weeks} />);
    expect(out).toContain("has no figure");
    expect(out).toContain("data-absent");
  });

  it("renders the fixture without a gap", () => {
    expect(html(<ShareByWeek weeks={FIXTURE_CHANNELS.shareByWeek} />)).not.toContain("has no figure");
  });
});

describe("ChannelBubbles", () => {
  it("lists a channel with no outcomes as not plotted instead of plotting it at zero", () => {
    const bubbles = [
      ...FIXTURE_CHANNELS.bubbles,
      { platform: "linkedin" as const, spend: { value: 1000, currency: "INR" }, outcomes: { absent: "No conversions reported" }, efficiency: { absent: "n/a" } },
    ];
    const out = html(<ChannelBubbles bubbles={bubbles} unitPlural="bookings" />);
    expect(out).toContain("Not plotted: LinkedIn Ads");
    expect(out).toContain("No conversions reported");
    expect(out.match(/<circle/g)).toHaveLength(FIXTURE_CHANNELS.bubbles.length);
  });
});

describe("EnquiryHeatmap", () => {
  it("hatches a cell with no figure and does not shade it as the lowest value", () => {
    const heatmap = {
      rows: ["Mon"],
      columns: ["6-9", "9-12"],
      cells: [
        { row: "Mon", column: "6-9", figure: { value: 4 } },
        { row: "Mon", column: "9-12", figure: { absent: "No data" } },
      ],
    };
    const out = html(<EnquiryHeatmap heatmap={heatmap} unitPlural="bookings" />);
    expect(out.match(/data-absent/g)).toHaveLength(1);
    expect(out).toContain("peak");
  });

  it("says there is not enough history when every cell is absent", () => {
    const heatmap = { rows: ["Mon"], columns: ["6-9"], cells: [{ row: "Mon", column: "6-9", figure: { absent: "x" } }] };
    expect(html(<EnquiryHeatmap heatmap={heatmap} unitPlural="bookings" />)).toContain("Not enough history");
  });
});

describe("creative leaderboard", () => {
  it("ranks measured patterns best first and puts unmeasured ones last", () => {
    const ranked = rankPatterns([
      { key: "a", label: "A", hookFormat: "x", liftPer1k: { absent: "none" }, n: { absent: "none" } },
      { key: "b", label: "B", hookFormat: "x", liftPer1k: { value: 1 }, n: { value: 3 } },
      { key: "c", label: "C", hookFormat: "x", liftPer1k: { value: 2 }, n: { value: 3 } },
    ]);
    expect(ranked.map((p) => p.key)).toEqual(["c", "b", "a"]);
  });

  it("does not rank an unmeasured pattern", () => {
    const out = html(<CreativeLeaderboard patterns={[{ key: "a", label: "A", hookFormat: "x", liftPer1k: { absent: "none" }, n: { absent: "none" } }]} unitPlural="bookings" />);
    expect(out).toContain("Not available");
    expect(out).not.toContain(">1<");
  });
});

describe("benchmark standing", () => {
  const b = (metric: string, you: number) => ({ metric, you: { value: you }, p25: { value: 450 }, p50: { value: 520 }, p75: { value: 620 } });

  it("treats a lower cost as better and a higher rate as better", () => {
    expect(standing(b("cost_per_outcome", 410))?.tone).toBe("good");
    expect(standing(b("cost_per_outcome", 700))?.tone).toBe("warn");
    expect(standing(b("conversion_rate", 700))?.tone).toBe("good");
  });

  it("gives no verdict when any of the numbers is absent", () => {
    expect(standing({ ...b("cost_per_outcome", 410), p50: { absent: "x" } })).toBeUndefined();
  });
});

describe("splitFeedText", () => {
  it("splits the first sentence from the reason without breaking on decimals", () => {
    expect(splitFeedText("Paused the ad. Cost was 2.4 times the others.")).toEqual({ title: "Paused the ad.", reason: "Cost was 2.4 times the others." });
    expect(splitFeedText("One sentence only")).toEqual({ title: "One sentence only", reason: "" });
  });
});

