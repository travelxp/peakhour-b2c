import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { FIXTURE_CHANNELS, FIXTURE_DECISIONS, FIXTURE_HOME, FIXTURE_LEARNING, FIXTURE_PACING_SERIES, FIXTURE_RULES, previewDecisions } from "@/lib/growth-v2-fixtures";
import type { DecisionsScreenData, HomeResponse, HomeScreenData } from "@/lib/api/growth-v2";
import { seriesFromHome } from "@/lib/growth-v2-series";
import { ChannelsBody } from "./channels-screen";
import { FirstRunScreen } from "./first-run-screen";
import { HomeBody } from "./home-screen";
import { LearningBody } from "./learning-screen";
import { QueryBoundary } from "./query-boundary";
import { RulesBody } from "./rules-screen";
import { Inbox } from "./decisions-screen";
import { DecisionCard } from "./decision-card";

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ business: { _id: "biz-1" } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/growth", useRouter: () => ({ push: vi.fn() }) }));
// The Decisions inbox reads the auth context only through its caller; the body itself takes plain props.

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const withClient = (node: React.ReactElement) => <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>;

describe("QueryBoundary", () => {
  const q = <T extends { preview: boolean; row?: string }>(data: T | undefined, isError = false) =>
    ({ data, isError, error: isError ? new Error("boom") : null, refetch: vi.fn() }) as unknown as UseQueryResult<T>;

  it("wears the Preview data banner on a preview, naming the row", () => {
    const out = html(<QueryBoundary query={q({ preview: true, row: "H3" })}>{() => <p>SCREEN-BODY</p>}</QueryBoundary>);
    expect(out).toContain("Preview data");
    expect(out).toContain("plan row H3");
    expect(out).toContain("SCREEN-BODY");
  });

  it("has no banner on live data", () => {
    const out = html(<QueryBoundary query={q({ preview: false })}>{() => <p>SCREEN-BODY</p>}</QueryBoundary>);
    expect(out).not.toContain("Preview data");
  });

  it("shows an error, not the screen and not sample data, when the query failed", () => {
    const out = html(<QueryBoundary query={q(undefined, true)}>{() => <p>SCREEN-BODY</p>}</QueryBoundary>);
    expect(out).not.toContain("SCREEN-BODY");
    expect(out).not.toContain("Preview data");
    expect(out).toContain("Couldn&#x27;t load this screen");
  });

  it("★keeps the screen when a refetch or a next page failed but there is data to show", () => {
    const out = html(<QueryBoundary query={q({ preview: false }, true)}>{() => <p>SCREEN-BODY</p>}</QueryBoundary>);
    expect(out).toContain("SCREEN-BODY");
    expect(out).not.toContain("Couldn&#x27;t load this screen");
  });

  it("shows a loading state before any data", () => {
    const out = html(<QueryBoundary query={q(undefined)}>{() => <p>SCREEN-BODY</p>}</QueryBoundary>);
    expect(out).toContain("aria-busy");
    expect(out).not.toContain("SCREEN-BODY");
  });
});

describe("the screens render their preview sample", () => {
  const homeData: HomeScreenData = { data: FIXTURE_HOME, preview: true, row: "H1", ...seriesFromHome(FIXTURE_HOME) };

  it("Growth home shows the headline, the goal and every chart", () => {
    const out = html(<HomeBody result={homeData} openDecisions={3} />);
    expect(out).toContain("Is it working?");
    expect(out).toContain("of 50 goal");
    // the big number says which window it counts, above a goal that is always the month
    expect(out).toContain("in this month");
    expect(out).toContain("3 decisions need you");
    expect(out).toContain("What the engine did");
    expect(out.match(/<svg/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("Growth home shows absences, not zeros, when the live response has nothing", () => {
    const live: HomeScreenData = {
      preview: false,
      data: {
        ...FIXTURE_HOME,
        goal: undefined,
        efficiency: { metric: "cost_per_outcome", you: { absent: "No outcomes yet" }, target: { absent: "No target" }, industry: { absent: "No benchmark" }, basis: "Ad spend divided by all paid orders." },
        lift: { liftPct: { absent: "Holdout not started" }, confidence: { absent: "n/a" }, windowDays: 28 },
        pacing: { spentThisMonth: { absent: "Not connected" }, monthlyCeiling: { absent: "Not connected" }, daysLeft: 9 },
        kpis: FIXTURE_HOME.kpis.map((k) => ({ ...k, figure: { absent: "No data yet" }, change: undefined, spark: k.spark?.map(() => ({ absent: "No data yet" })) })),
        waterfall: [],
        waterfallBasis: { absent: "channel_credit_needs_orders" },
        funnel: { stages: FIXTURE_HOME.funnel.stages.map((s) => ({ ...s, figure: { absent: "No data yet" } })), basis: "Counted from your connected sources." },
        feed: [],
      },
    };
    const out = html(<HomeBody result={live} openDecisions={undefined} />);
    expect(out).toContain("Not available");
    expect(out).toContain("Too early to say");
    // The waterfall says why it has no bars, in words.
    expect(out).toContain("Not available: Channel credit needs orders. We only show causes we can compute.");
    expect(out).toContain("We don&#x27;t have a count");
    // No stray zero standing in for an unknown figure.
    expect(out).not.toMatch(/>0</);
    expect(out).not.toContain("0%");
  });

  it("Growth home renders the live shape: the series the api sends, the basis captions and the window's words", () => {
    const live: HomeResponse = {
      ...FIXTURE_HOME,
      window: { key: "7d", from: "2026-10-20", to: "2026-10-27", days: 7, compare: "last_period" },
      // One unreadable week in the middle of a spark: a break, not a zero.
      kpis: FIXTURE_HOME.kpis.map((k) => (k.key === "outcomes" ? { ...k, spark: [{ value: 4 }, { value: 5 }, { absent: "window_predates_store" }, { value: 6 }, { value: 7 }, { value: 8 }, { value: 9 }, { value: 10 }] } : k)),
    };
    const data: HomeScreenData = { preview: false, data: live, ...seriesFromHome(live) };
    expect(data.series!.sparks.outcomes).toEqual([6, 7, 8, 9, 10]);
    const out = html(<HomeBody result={data} openDecisions={2} />);
    expect(out).not.toContain("Preview data");
    expect(out).toContain("the last 7 days");
    expect(out).toContain("vs the week before");
    expect(out).toContain("Ad spend divided by all paid orders");
    expect(out).toContain("Moving spend between channels");
    expect(out).toContain("split into what we can compute");
    expect(out).toContain("Found, chosen and taken-a-step");
    expect(out).toContain("Spend vs ceiling");
    // lift band, sparklines, pacing line and waterfall all draw
    expect(out.match(/<svg/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("Growth home against the holdout says what the change is measured against", () => {
    const live: HomeResponse = { ...FIXTURE_HOME, window: { ...FIXTURE_HOME.window, compare: "holdout" }, kpis: FIXTURE_HOME.kpis.map((k) => (k.key === "cost_per_outcome" ? { ...k, change: { absent: "holdout_compares_outcomes_only" } } : k)) };
    const out = html(<HomeBody result={{ preview: false, data: live, ...seriesFromHome(live) }} openDecisions={undefined} />);
    expect(out).toContain("vs the holdout");
    expect(out).toContain("No comparison available");
  });

  it("Growth home draws no pacing line, and says so, when the api sent no day-by-day series", () => {
    const live: HomeResponse = { ...FIXTURE_HOME, pacing: { ...FIXTURE_HOME.pacing, series: undefined }, lift: { ...FIXTURE_HOME.lift, weeks: undefined } };
    const out = html(<HomeBody result={{ preview: false, data: live, ...seriesFromHome(live) }} openDecisions={undefined} />);
    expect(out).toContain("The day-by-day line is not available yet.");
    expect(out).toContain("The week-by-week chart is not available yet.");
  });

  it("Growth home says why the waterfall is empty in one clean sentence, whatever shape the reason has", () => {
    const empty = (reason: string): string => {
      const live: HomeResponse = { ...FIXTURE_HOME, waterfall: [], waterfallBasis: { absent: reason } };
      return html(<HomeBody result={{ preview: false, data: live, ...seriesFromHome(live) }} openDecisions={undefined} />);
    };
    expect(empty("no_spend_in_a_period")).toContain("Not available: No spend in a period. We only show causes we can compute.");
    // A reason that is already a sentence keeps its capitals and loses its full stop to the card's own.
    const sentence = empty("Meta Ads had no spend last week.");
    expect(sentence).toContain("Not available: Meta Ads had no spend last week. We only show");
    expect(sentence).not.toContain("..");
  });

  it("Growth home says when weeks it could not read cut a trend short, and keeps the holdout note to the outcomes card", () => {
    const gap = [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }, { absent: "window_predates_store" }, { value: 8 }];
    const live: HomeResponse = {
      ...FIXTURE_HOME,
      window: { ...FIXTURE_HOME.window, compare: "holdout" },
      kpis: FIXTURE_HOME.kpis.map((k) => ({ ...k, spark: gap, change: { value: 0.1 } })),
    };
    const out = html(<HomeBody result={{ preview: false, data: live, ...seriesFromHome(live) }} openDecisions={undefined} />);
    expect(out).toContain("Not enough recent weeks to draw a trend.");
    // Only the outcomes card is measured against the holdout.
    expect(out.match(/vs the holdout/g)).toHaveLength(1);
    expect(out).toContain("vs last month");
  });

  it("Growth home names the days with no spend figure rather than drawing them as free", () => {
    const live: HomeResponse = { ...FIXTURE_HOME, pacing: { ...FIXTURE_HOME.pacing, series: { ...FIXTURE_HOME.pacing.series!, missingDays: [5, 6] } } };
    const out = html(<HomeBody result={{ preview: false, data: live, ...seriesFromHome(live) }} openDecisions={undefined} />);
    expect(out).toContain("No spend figures for days 5, 6");
  });

  it("Channels & money shows health, campaigns and a link to campaign management", () => {
    const out = html(<ChannelsBody channels={FIXTURE_CHANNELS} pacingSeries={FIXTURE_PACING_SERIES} unitPlural="bookings" unitOne="booking" />);
    expect(out).toContain("Meta Ads");
    expect(out).toContain("Trip names Search");
    expect(out).toContain("/dashboard/ads");
  });

  it("Channels & money shows a paused campaign's missing outcome as an absence", () => {
    const out = html(<ChannelsBody channels={FIXTURE_CHANNELS} pacingSeries={undefined} unitPlural="bookings" unitOne="booking" />);
    expect(out).toContain("Paused by engine");
    expect(out).toContain("Not available");
    expect(out).toContain("day-by-day line is not available");
  });

  it("Learning shows the ledger, the patterns, the benchmarks and the heatmap", () => {
    const out = html(<LearningBody learning={FIXTURE_LEARNING} unitPlural="bookings" currency="INR" />);
    expect(out).toContain("Experiment ledger");
    expect(out).toContain("Price-first carousel");
    expect(out).toContain("Cost per outcome");
    expect(out).toContain("peak");
    expect(out).toContain("5 experiments");
  });

  it("Rules shows the ladder, the mandate and the guardrails", () => {
    const out = html(<RulesBody rules={FIXTURE_RULES} preview />);
    expect(out).toContain("Propose");
    expect(out).toContain("3 of 5 cleared decisions");
    expect(out).toContain("Your mandate");
    expect(out).toContain("₹20,000");
    expect(out).toContain("Only use creatives I approved");
  });

  it("Rules points a business with no mandate at First run", () => {
    const out = html(<RulesBody rules={{ ...FIXTURE_RULES, mandate: undefined }} preview={false} />);
    expect(out).toContain("The engine is off for this business");
    expect(out).toContain("/dashboard/growth/start");
  });

  it("Decisions lists the queue, shows the council and keeps the preview's buttons off", () => {
    const result: DecisionsScreenData = { data: previewDecisions("open"), preview: true, hasMore: false };
    const out = html(withClient(<Inbox tab="needs_you" result={result} currency="INR" unit={{ one: "booking", many: "bookings" }} businessName="Himalayan Trails" />));
    expect(out).toContain("Move ₹700 a week from X to Meta Advantage+ Leads");
    expect(out).toContain("Strategist");
    expect(out).toContain("Critic");
    expect(out).toContain("Risk check");
    expect(out).toContain("Decision for Himalayan Trails");
    expect(out).toContain("Also sent to WhatsApp on 26 Oct");
    expect(out).toContain("reply CONFIRM");
    expect(out).toContain("Preview data: nothing is sent.");
    expect(out).toMatch(/<button[^>]* disabled=""[^>]*>Approve/);
  });

  it("First run is a preview with its confirm button off", () => {
    const out = html(withClient(<FirstRunScreen />));
    expect(out).toContain("Preview data");
    expect(out).toContain("What do you want more of?");
    expect(out).toContain("Your first plan");
    expect(out).toMatch(/<button[^>]* disabled=""[^>]*>Send to WhatsApp to confirm/);
  });
});

describe("DecisionCard time rules", () => {
  const unit = { one: "booking", many: "bookings" };
  const proposed = FIXTURE_DECISIONS.decisions[0];
  const noop = () => {};

  it("turns Approve off and says so once the decision has expired", () => {
    const out = html(<DecisionCard decision={proposed} currency="INR" unit={unit} now={Date.parse(proposed.expiresAt!) + 3_600_000} onAction={noop} />);
    expect(out).toContain("This expired and nothing changed.");
    expect(out).toMatch(/<button[^>]* disabled=""[^>]*>Approve/);
  });

  it("keeps Approve on while it has time left", () => {
    const out = html(<DecisionCard decision={proposed} currency="INR" unit={unit} now={Date.parse(proposed.createdAt)} onAction={noop} />);
    expect(out).not.toMatch(/<button[^>]* disabled=""[^>]*>Approve/);
  });

  it("offers Undo until the api's window ends, and closes it after", () => {
    const applied = { ...proposed, status: "applied" as const, undoUntil: "2026-10-21T10:00:00Z", decidedBy: { via: "inapp" as const, at: "2026-10-20T10:00:00Z" } };
    const late = html(<DecisionCard decision={applied} currency="INR" unit={unit} now={Date.parse("2026-10-23T10:00:00Z")} onAction={noop} />);
    expect(late).toContain("undo window has passed");
    expect(late).not.toMatch(/Undo<\/button>/);
    const soon = html(<DecisionCard decision={applied} currency="INR" unit={unit} now={Date.parse("2026-10-20T20:00:00Z")} onAction={noop} />);
    expect(soon).toContain("You can undo this for another 14 hours.");
    expect(soon).toMatch(/Undo<\/button>/);
  });

  it("an applied decision with no undo window left offers no Undo at all", () => {
    const applied = { ...proposed, status: "applied" as const };
    const out = html(<DecisionCard decision={applied} currency="INR" unit={unit} now={Date.parse("2026-10-20T20:00:00Z")} onAction={noop} />);
    expect(out).toContain("undo window has passed");
    expect(out).not.toMatch(/Undo<\/button>/);
  });

  it("a held decision keeps Approve and Reject but not Hold", () => {
    const held = { ...proposed, status: "held" as const };
    const out = html(<DecisionCard decision={held} currency="INR" unit={unit} now={Date.parse(proposed.createdAt)} onAction={noop} />);
    expect(out).toContain("On hold");
    expect(out).toMatch(/>Approve<\/button>/);
    expect(out).toMatch(/>Reject<\/button>/);
    expect(out).not.toMatch(/>Hold<\/button>/);
  });
});
