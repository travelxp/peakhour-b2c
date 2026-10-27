import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { FIXTURE_CHANNELS, FIXTURE_DECISIONS, FIXTURE_HOME, FIXTURE_LEARNING, FIXTURE_PACING_SERIES, FIXTURE_RULES, previewDecisions } from "@/lib/growth-v2-fixtures";
import type { ChannelsResponse, DecisionsScreenData, DraftOffer, FirstRunDraftResponse, HomeResponse, HomeScreenData } from "@/lib/api/growth-v2";
import { EMPTY_ANSWERS } from "@/lib/growth-v2-firstrun";
import { seriesFromHome } from "@/lib/growth-v2-series";
import { ChannelsBody } from "./channels-screen";
import { FirstRunView, type FirstRunViewProps } from "./first-run-screen";
import { MandateConfirmView, type MandateConfirmViewProps } from "./mandate-confirm";
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

  describe("Channels & money, live", () => {
    const live: ChannelsResponse = {
      ...FIXTURE_CHANNELS,
      health: [
        { platform: "meta", state: "healthy", reason: "Cost per outcome INR 250 against your target of INR 600.", spend: { value: 1000, currency: "INR" }, outcomes: { value: 4 }, efficiency: { value: 250 } },
        { platform: "google_ads", state: "problem", reason: "Google Ads bills in USD, but your plan is in INR. The engine does not manage it, and its spend is left out of your totals.", spend: { absent: "currency_mismatch" }, outcomes: { absent: "currency_mismatch" }, efficiency: { absent: "currency_mismatch" } },
        { platform: "x", state: "problem", reason: "INR 200 spent with no bookings credited to X Ads.", spend: { value: 200, currency: "INR" }, outcomes: { value: 0 }, efficiency: { absent: "no_outcomes_this_week" } },
        { platform: "linkedin", state: "not_connected", reason: "LinkedIn Ads isn't connected.", spend: { absent: "not_connected" }, outcomes: { absent: "not_connected" }, efficiency: { absent: "not_connected" } },
      ],
      bubbles: [{ platform: "meta", spend: { value: 1000, currency: "INR" }, outcomes: { value: 4 }, efficiency: { value: 250 } }],
      allocatorTarget: { decisionId: "d1", status: "proposed", at: "2026-10-26T01:00:00Z", shares: [{ platform: "meta", share: { value: 0.48 } }, { platform: "google_ads", share: { value: 0.52 } }] },
      campaigns: [
        {
          id: "c1", platform: "meta", name: "Alpha videos", status: "active",
          dailyBudget: { value: 600, currency: "INR" }, engineChange: { at: "2026-10-25T10:00:00Z", from: 500, to: 600, currency: "INR" },
          spend: { value: 900, currency: "INR" }, outcomes: { absent: "credit_is_per_channel" }, efficiency: { absent: "credit_is_per_channel" },
        },
        {
          id: "c2", platform: "google_ads", name: "Search", status: "paused",
          dailyBudget: { absent: "no_daily_budget" }, spend: { absent: "currency_mismatch" }, outcomes: { absent: "credit_is_per_channel" }, efficiency: { absent: "credit_is_per_channel" },
        },
      ],
    };
    const body = (channels: ChannelsResponse, unitPlural = "bookings", unitOne = "booking") =>
      html(<ChannelsBody channels={channels} pacingSeries={undefined} unitPlural={unitPlural} unitOne={unitOne} />);

    it("shows each channel's state with the fact that put it there, and an absent figure as an absence", () => {
      const out = body(live);
      expect(out).toContain("Cost per outcome INR 250 against your target of INR 600.");
      expect(out).toContain("Google Ads bills in USD");
      expect(out).toContain("INR 200 spent with no bookings credited to X Ads.");
      expect(out).toContain("LinkedIn Ads isn&#x27;t connected.");
      expect(out).toContain('data-state="problem"');
      expect(out.match(/data-absent=""/g)!.length).toBeGreaterThan(3);
      expect(out).toContain("Not available");
      expect(out).toContain(": Currency mismatch");
    });

    it("says outcomes are credited to a channel, not caused by the ads", () => {
      const out = body(live);
      expect(out).toContain("not the extra outcomes the ads caused");
      expect(out).toContain("Credited bookings");
      expect(out).not.toContain("Extra bookings");
      expect(out).toContain("Spend against credited bookings");
      expect(out).not.toContain("extra bookings");
    });

    it("lists campaigns with budget and spend, notes the engine's change, and drops results columns that would only repeat an absence", () => {
      const out = body(live);
      expect(out).toContain("Alpha videos");
      expect(out).toContain("Active");
      expect(out).toContain("Engine changed it from ₹500 to ₹600");
      expect(out).toContain("Daily budget");
      expect(out).not.toContain("Credit is per channel");
    });

    it("shows the allocator's target where it recorded one, and nothing where it did not", () => {
      expect(body(live)).toMatch(/Meta Ads 48%.*, Google Ads 52%/);
      const without: ChannelsResponse = { ...live };
      delete without.allocatorTarget;
      expect(body(without)).not.toContain("data-allocator-target");
    });

    it("shows the empty states: no campaigns, no share history", () => {
      const out = body({ ...live, campaigns: [], shareByWeek: [] });
      expect(out).toContain("No campaigns yet.");
      expect(out).toContain("No weekly budget history yet.");
    });

    it("a return target is shown as a multiple", () => {
      const roas: ChannelsResponse = { ...live, efficiency: { metric: "roas", target: { value: 4 } }, health: [{ ...live.health[0]!, efficiency: { value: 4.5 } }], bubbles: [{ ...live.bubbles[0]!, efficiency: { value: 4.5 } }] };
      const out = body(roas, "sales", "sale");
      expect(out).toContain("4.5x");
      expect(out).toContain("Return on ad spend");
      // The bubble's label reads the same as the card: a multiple, not money per outcome.
      expect(out).toContain("Meta Ads · 4.5x");
      expect(out).not.toContain("/each");
    });
  });

  it("Learning shows the ledger, the patterns, the benchmarks and the heatmap", () => {
    const out = html(<LearningBody learning={FIXTURE_LEARNING} unitPlural="bookings" currency="INR" />);
    expect(out).toContain("Experiment ledger");
    expect(out).toContain("Price-first carousel");
    expect(out).toContain("Cost per outcome");
    expect(out).toContain("peak");
    expect(out).toContain("5 experiments");
  });

  it("Rules shows the ladder, the mandate, the guardrail switches and the lines it never crosses", () => {
    const out = html(withClient(<RulesBody rules={FIXTURE_RULES} preview />));
    expect(out).toContain("Propose");
    expect(out).toContain("3 of 5 cleared decisions");
    expect(out).toContain("Your mandate");
    expect(out).toContain("₹20,000");
    expect(out).toContain("Only use creatives I approved");
    expect(out).toContain("Blocked words");
    expect(out).toContain("Let the engine use Meta");
    expect(out).toContain("Never, at any level");
    expect(out).toContain("Raise its own autonomy level");
  });

  it("Rules has no control that sets the autonomy level", () => {
    const out = html(withClient(<RulesBody rules={FIXTURE_RULES} preview={false} />));
    // The ladder is a read-only list. No field, select, switch or button mentions the level.
    const controls = out.match(/<(input|select|button)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThan(0);
    for (const tag of controls) expect(tag, tag).not.toMatch(/autonomy|level/i);
    const buttonTexts = [...out.matchAll(/<button\b[^>]*>([^<]*)</g)].map((m) => m[1]);
    for (const t of buttonTexts) expect(t, t).not.toMatch(/autonomy|level|promote|upgrade/i);
  });

  it("Rules shows the signal state beside each connection, and says nothing for a channel that is not connected", () => {
    const out = html(withClient(<RulesBody rules={FIXTURE_RULES} preview />));
    expect(out).toContain("Signal on");
    expect(out).toContain("Not tracked");
  });

  it("Rules turns every control off on a preview, and on live data leaves the switches on", () => {
    const preview = html(withClient(<RulesBody rules={FIXTURE_RULES} preview />));
    expect(preview).toMatch(/<button[^>]* disabled=""[^>]*>Change/);
    expect(preview).toMatch(/<button[^>]*role="switch"[^>]* disabled=""[^>]*aria-label="Only use creatives I approved"|<button[^>]* disabled=""[^>]*role="switch"/);
    const live = html(withClient(<RulesBody rules={FIXTURE_RULES} preview={false} />));
    expect(live).not.toMatch(/<button[^>]* disabled=""[^>]*>Change/);
    expect(live).not.toMatch(/<button[^>]*role="switch"[^>]* disabled=""/);
  });

  it("Rules says a change is waiting for the owner's confirmation, and that the plan is as it was", () => {
    const out = html(withClient(<RulesBody rules={{ ...FIXTURE_RULES, pendingChange: { decisionId: "d1", summary: "Change your plan: monthly ceiling from INR 20000 to INR 30000.", expiresAt: "2026-10-30T00:00:00Z" } }} preview={false} />));
    expect(out).toContain("A change is waiting for your confirmation");
    expect(out).toContain("monthly ceiling from INR 20000 to INR 30000");
    expect(out).toContain("exactly as it was");
  });

  it("Rules points a business with no mandate at First run", () => {
    const out = html(withClient(<RulesBody rules={{ ...FIXTURE_RULES, mandate: undefined }} preview={false} />));
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

// -- H5: First run and the confirmation link -----------------------------------------------------

const OFFER_SALES: DraftOffer = {
  kind: "sales",
  source: "orders",
  optimizeFor: "value",
  label: "Sales",
  focusSuggestions: [{ by: "product_type", values: ["Sarees"], label: "Sarees", source: "revenue", revenue: 800000 }],
  focusWindowDays: 90,
  defaultTarget: { kind: "roas", value: 2.5, low: 1.5, high: 5 },
  targetSource: "playbook",
};
const OFFER_LEADS: DraftOffer = { kind: "leads", source: "win_definition", optimizeFor: "count", label: "Leads", focusSuggestions: [], targetSource: "merchant" };
const OFFER_STORE: DraftOffer = { kind: "store_visits", source: "ads_conversions", optimizeFor: "count", label: "Store visits", focusSuggestions: [], targetSource: "merchant" };

const DRAFT: FirstRunDraftResponse = {
  alreadyActive: false,
  currency: "INR",
  timeZone: { value: "Asia/Kolkata" },
  offers: [OFFER_SALES, OFFER_LEADS],
  askAboutStores: false,
  playbook: { id: "growth-ecommerce-d2c", version: 1, title: "D2C" },
  channels: [
    { platform: "meta", role: "lead", monthlyShare: 0.625, reason: "Short videos.", connected: true },
    { platform: "google_ads", role: "test", monthlyShare: 0.375, reason: "Search on your products.", connected: false },
  ],
  ceilingBands: { currency: "INR", bands: [{ key: "starter", amount: 30000 }, { key: "steady", amount: 60000 }, { key: "growth", amount: 120000 }] },
  excludedByGuardrails: ["x"],
};

const noop = () => {};
const firstRun = (over: Partial<FirstRunViewProps> = {}): FirstRunViewProps => ({
  draft: DRAFT,
  answers: { ...EMPTY_ANSWERS, ceiling: "60000" },
  zone: "",
  signalStep: <p>SIGNAL-STEP</p>,
  blockedReason: undefined,
  onChooseTie: noop,
  onInPerson: noop,
  onOffer: noop,
  onFocus: noop,
  onCeiling: noop,
  onTarget: noop,
  onZone: noop,
  onSaveZone: noop,
  onSend: noop,
  ...over,
});

describe("First run", () => {
  it("asks the three questions, with only the offered outcomes, the focus picker and the playbook's target", () => {
    const out = html(<FirstRunView {...firstRun()} />);
    expect(out).toContain("What do you want more of?");
    expect(out).toContain("Your monthly ceiling");
    expect(out).toContain("What return do you need on your ad spend?");
    expect(out).toContain(">Sales<");
    expect(out).toContain(">Leads<");
    // never offered: store visits and calls, which the api did not offer this business
    expect(out).not.toContain("Store visits");
    expect(out).not.toContain(">Calls<");
    // sales shows the categories the shop really sold
    expect(out).toContain("Sarees");
    expect(out).toContain("Filled in by the D2C playbook");
    expect(out).toContain('value="2.5"');
    expect(out).toContain("SIGNAL-STEP");
  });

  it("offers store visits only when the api offered them, and then asks nothing about stores", () => {
    const withStore = html(<FirstRunView {...firstRun({ draft: { ...DRAFT, offers: [OFFER_SALES, OFFER_STORE] } })} />);
    expect(withStore).toContain("Store visits");
    expect(withStore).not.toContain("Do customers visit you in person?");
    const without = html(<FirstRunView {...firstRun()} />);
    expect(without).toContain("Do customers visit you in person?");
  });

  it("when a store is suspected but cannot be offered, says how to get store visits and still does not offer them", () => {
    const out = html(<FirstRunView {...firstRun({ draft: { ...DRAFT, askAboutStores: true } })} />);
    expect(out).toContain("verified Business Profile");
    expect(out).not.toContain(">Store visits<");
  });

  it("a business offered nothing is told what to connect, not shown a menu", () => {
    const out = html(<FirstRunView {...firstRun({ draft: { ...DRAFT, offers: [] }, blockedReason: "Nothing can be measured for this business yet." })} />);
    expect(out).toContain("Nothing can be measured for this business yet");
    expect(out).not.toContain(">Sales<");
    expect(out).not.toContain(">Leads<");
  });

  it("asks 'Which best describes you?' on a tie, and shows no plan until it is answered", () => {
    const tie: FirstRunDraftResponse = { ...DRAFT, playbook: undefined, channels: [], tie: { candidates: [{ playbookId: "growth-travel", version: 1, title: "Travel" }, { playbookId: "growth-ecommerce-d2c", version: 1, title: "D2C" }] } };
    const out = html(<FirstRunView {...firstRun({ draft: tie })} />);
    expect(out).toContain("Which best describes you?");
    expect(out).toContain(">Travel<");
    expect(out).toContain(">D2C<");
    expect(out).not.toContain("Your first plan");
    expect(out).not.toContain("What do you want more of?");
  });

  it("shows the split of the ceiling, what is not connected, and what the guardrails left out", () => {
    const out = html(<FirstRunView {...firstRun()} />);
    expect(out).toContain("Your first plan");
    expect(out).toContain("63%");
    expect(out).toContain("₹37,500");
    expect(out).toContain("Not connected yet");
    expect(out).toContain("Left out because you turned them off in Rules: X");
  });

  it("asks for the time zone while there is none, prefilled with the suggestion", () => {
    const out = html(<FirstRunView {...firstRun({ draft: { ...DRAFT, timeZone: { absent: "No time zone is set for this business yet.", suggested: "Asia/Kolkata" } }, zone: "Asia/Kolkata" })} />);
    expect(out).toContain("Your time zone");
    expect(out).toContain('value="Asia/Kolkata"');
    expect(html(<FirstRunView {...firstRun()} />)).not.toContain("Your time zone");
  });

  it("keeps Send to WhatsApp off, with the reason, until the plan can be sent", () => {
    const off = html(<FirstRunView {...firstRun({ blockedReason: "Finish step 4 first: switch on your signal, or accept running without one." })} />);
    expect(off).toMatch(/<button[^>]* disabled=""[^>]*>Send to WhatsApp to confirm/);
    expect(off).toContain("Finish step 4 first");
    const on = html(<FirstRunView {...firstRun()} />);
    expect(on).not.toMatch(/<button[^>]* disabled=""[^>]*>Send to WhatsApp to confirm/);
    expect(on).toContain("Send to WhatsApp to confirm");
  });

  it("after the send, says Check WhatsApp and that nothing spends yet", () => {
    const out = html(<FirstRunView {...firstRun({ sent: true })} />);
    expect(out).toContain("Check WhatsApp");
    expect(out).toContain("Until then nothing spends");
    expect(out).toContain("Send the link again");
  });

  it("says why a send failed", () => {
    expect(html(<FirstRunView {...firstRun({ sendError: "Verify your WhatsApp number in Settings first." })} />)).toContain("Verify your WhatsApp number");
  });

  it("points a business that already has a mandate at Rules instead of drafting again", () => {
    const out = html(<FirstRunView {...firstRun({ draft: { ...DRAFT, alreadyActive: true } })} />);
    expect(out).toContain("already running");
    expect(out).toContain("/dashboard/growth/rules");
    expect(out).not.toContain("What do you want more of?");
  });

  it("says it is drafting, and says so plainly when the draft failed", () => {
    expect(html(<FirstRunView {...firstRun({ draft: undefined })} />)).toContain("aria-busy");
    expect(html(<FirstRunView {...firstRun({ draft: undefined, loadFailed: true })} />)).toContain("couldn&#x27;t draft your plan");
  });
});

describe("The confirmation link page", () => {
  const LINK = { plan: "grow Sarees with at most INR 60000 a month in ad spend, aiming for a return of 2.5x on ad spend", sentTo: "ending 01", otpSent: false, change: false };
  const page = (over: Partial<MandateConfirmViewProps> = {}): MandateConfirmViewProps => ({ link: LINK, codeAsked: false, code: "", onCode: noop, onSend: noop, onConfirm: noop, ...over });

  it("shows the plan and where the code will go, and asks nothing until the person asks for a code", () => {
    const out = html(<MandateConfirmView {...page()} />);
    expect(out).toContain("Confirm your plan");
    expect(out).toContain("grow Sarees with at most INR 60000");
    expect(out).toContain("ending 01");
    expect(out).toContain("Nothing is spent until you enter the code");
    expect(out).toContain("Text me the code");
    expect(out).not.toContain("mandate-code");
  });

  it("after a code is sent, takes six digits and keeps Confirm off until they are in", () => {
    const half = html(<MandateConfirmView {...page({ codeAsked: true, code: "123" })} />);
    expect(half).toContain("mandate-code");
    expect(half).toMatch(/<button[^>]* disabled=""[^>]*>Confirm and start/);
    const full = html(<MandateConfirmView {...page({ codeAsked: true, code: "123456" })} />);
    expect(full).not.toMatch(/<button[^>]* disabled=""[^>]*>Confirm and start/);
  });

  it("goes straight to the code when one was already sent for the link", () => {
    expect(html(<MandateConfirmView {...page({ link: { ...LINK, otpSent: true }, codeAsked: true })} />)).toContain("mandate-code");
  });

  it("says a change is a change, and that the plan changes only on the code", () => {
    const out = html(<MandateConfirmView {...page({ link: { ...LINK, change: true } })} />);
    expect(out).toContain("Confirm this change to your plan");
    expect(out).toContain("Your plan changes only when you enter the code");
  });

  it("shows a wrong code's sentence and keeps the box, but shows a finished link's sentence with no box", () => {
    const wrong = html(<MandateConfirmView {...page({ codeAsked: true, code: "123456", error: "That code is not right." })} />);
    expect(wrong).toContain("That code is not right.");
    expect(wrong).toContain("mandate-code");
    const dead = html(<MandateConfirmView {...page({ codeAsked: true, dead: true, error: "This link has expired." })} />);
    expect(dead).toContain("This link has expired.");
    expect(dead).not.toContain("mandate-code");
  });

  it("confirms the plan is on, or that the change is saved, once the code is accepted", () => {
    const on = html(<MandateConfirmView {...page({ done: { activated: true, holdout: { started: true, method: "switchback" } } })} />);
    expect(on).toContain("Your plan is on");
    const changed = html(<MandateConfirmView {...page({ link: { ...LINK, change: true }, done: { activated: true, holdout: { started: false, reason: "kept" } } })} />);
    expect(changed).toContain("Your change is saved");
    expect(changed).not.toContain("Lift measurement has not started");
  });

  it("says when lift measurement did not start, without blocking the plan", () => {
    const out = html(<MandateConfirmView {...page({ done: { activated: true, holdout: { started: false, reason: "no regions" } } })} />);
    expect(out).toContain("Your plan is on");
    expect(out).toContain("Lift measurement has not started yet (no regions)");
  });

  it("shows a link that cannot be read as unusable, with no way to guess a code", () => {
    const out = html(<MandateConfirmView {...page({ link: undefined, loadError: "This link has expired. Links last 24 hours." })} />);
    expect(out).toContain("This link can&#x27;t be used");
    expect(out).toContain("Links last 24 hours");
    expect(out).not.toContain("mandate-code");
  });
});
