import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { FIXTURE_CHANNELS, FIXTURE_DECISIONS, FIXTURE_HOME, FIXTURE_HOME_SERIES, FIXTURE_LEARNING, FIXTURE_PACING_SERIES, FIXTURE_RULES } from "@/lib/growth-v2-fixtures";
import type { HomeScreenData } from "@/lib/api/growth-v2";
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

  it("shows a loading state before any data", () => {
    const out = html(<QueryBoundary query={q(undefined)}>{() => <p>SCREEN-BODY</p>}</QueryBoundary>);
    expect(out).toContain("aria-busy");
    expect(out).not.toContain("SCREEN-BODY");
  });
});

describe("the screens render their preview sample", () => {
  const homeData: HomeScreenData = { data: FIXTURE_HOME, preview: true, row: "H1", series: FIXTURE_HOME_SERIES, pacingSeries: FIXTURE_PACING_SERIES };

  it("Growth home shows the headline, the goal and every chart", () => {
    const out = html(<HomeBody result={homeData} openDecisions={3} />);
    expect(out).toContain("Is it working?");
    expect(out).toContain("of 50 goal");
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
        efficiency: { metric: "cost_per_outcome", you: { absent: "No outcomes yet" }, target: { absent: "No target" }, industry: { absent: "No benchmark" } },
        lift: { liftPct: { absent: "Holdout not started" }, confidence: { absent: "n/a" }, windowDays: 28 },
        kpis: FIXTURE_HOME.kpis.map((k) => ({ ...k, figure: { absent: "No data yet" }, change: undefined })),
        waterfall: FIXTURE_HOME.waterfall.map((w) => ({ ...w, figure: { absent: "No data yet" } })),
        funnel: { stages: FIXTURE_HOME.funnel.stages.map((s) => ({ ...s, figure: { absent: "No data yet" } })) },
        pacing: { spentThisMonth: { absent: "Not connected" }, monthlyCeiling: { absent: "Not connected" }, daysLeft: 9 },
        feed: [],
      },
    };
    const out = html(<HomeBody result={live} openDecisions={undefined} />);
    expect(out).toContain("Not available");
    expect(out).toContain("Too early to say");
    expect(out).toContain("We don&#x27;t have a count");
    // No stray zero standing in for an unknown figure.
    expect(out).not.toMatch(/>0</);
    expect(out).not.toContain("0%");
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
    const out = html(withClient(<Inbox decisions={FIXTURE_DECISIONS.decisions} preview currency="INR" unit={{ one: "booking", many: "bookings" }} businessName="Himalayan Trails" />));
    expect(out).toContain("Needs you");
    expect(out).toContain("Move ₹700 a week from X to Meta Advantage+ Leads");
    expect(out).toContain("Strategist");
    expect(out).toContain("Critic");
    expect(out).toContain("Risk check");
    expect(out).toContain("Decision for Himalayan Trails");
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

  it("closes Undo after 24 hours", () => {
    const applied = { ...proposed, status: "applied" as const, decidedBy: { via: "inapp" as const, at: "2026-10-20T10:00:00Z" } };
    const late = html(<DecisionCard decision={applied} currency="INR" unit={unit} now={Date.parse("2026-10-23T10:00:00Z")} onAction={noop} />);
    expect(late).toContain("undo window has passed");
    const soon = html(<DecisionCard decision={applied} currency="INR" unit={unit} now={Date.parse("2026-10-20T20:00:00Z")} onAction={noop} />);
    expect(soon).toContain("Undo works for 24 hours");
  });
});
