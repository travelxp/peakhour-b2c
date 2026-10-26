import type {
  ChannelsResponse,
  DecisionsResponse,
  FirstRunPlanResponse,
  HomeResponse,
  LearningResponse,
  RulesResponse,
} from "@/lib/api/growth-v2";
import type { HomeSeries, PacingSeries } from "@/lib/growth-v2-series";

/**
 * The Growth v2 prototype's sample data (Himalayan Trails, a travel business),
 * in the plan 2.10 response shapes.
 *
 * ★THIS IS NOT THE MERCHANT'S DATA. The hooks in `lib/api/growth-v2.ts` return it
 * only while a route answers 501 NOT_BUILT, and every screen then wears a
 * "Preview data" banner. Nothing here may be rendered without that banner, and
 * nothing here may be written back anywhere.
 *
 * The dates are fixed (the prototype's "today" is 26 Oct 2026, day 22 of 31) so a
 * preview never reads as live.
 */

/** The prototype's clock: every "expires in" on a preview is read against this. */
export const PREVIEW_NOW = Date.parse("2026-10-26T11:00:00Z");
export const PREVIEW_BUSINESS_NAME = "Himalayan Trails";

const fig = (value: number) => ({ value });
const inr = (value: number) => ({ value, currency: "INR" });

export const FIXTURE_HOME: HomeResponse = {
  outcome: { kind: "bookings", label: "Trip bookings", optimizeFor: "count" },
  goal: { perMonth: 50, soFar: fig(34), paceVsGoal: fig(0.96) },
  efficiency: { metric: "cost_per_outcome", you: fig(410), target: fig(450), industry: fig(520) },
  lift: { liftPct: fig(0.65), confidence: fig(0.8), windowDays: 56 },
  kpis: [
    { key: "outcomes", label: "Bookings", figure: fig(34), change: fig(0.18) },
    { key: "cost_per_outcome", label: "Cost per booking", figure: fig(410), change: fig(-0.093) },
    { key: "incremental", label: "Extra bookings caused", figure: fig(22), change: { absent: "No last-month holdout reading" } },
  ],
  pacing: { spentThisMonth: inr(13940), monthlyCeiling: inr(20000), daysLeft: 9 },
  waterfall: [
    { key: "start", label: "Sept", figure: fig(452) },
    { key: "creative", label: "New creative", figure: fig(-28) },
    { key: "allocation", label: "Moved to Meta", figure: fig(-19) },
    { key: "auction", label: "Google clicks cost more", figure: fig(9) },
    { key: "season", label: "Season", figure: fig(-4) },
    { key: "end", label: "Now", figure: fig(410) },
  ],
  funnel: {
    stages: [
      { key: "found", label: "Found you", figure: fig(48200) },
      { key: "looked", label: "Chose to look", figure: fig(3140) },
      { key: "enquired", label: "Enquired", figure: fig(412) },
      { key: "booked", label: "Booked", figure: fig(34) },
    ],
  },
  feed: [
    { at: "2026-10-26T11:48:00Z", kind: "check", text: "Checked Meta, Google and X. Nothing broken. Meta's learning finished on 24 Oct." },
    { at: "2026-10-26T09:10:00Z", kind: "budget", text: "Raised Meta by ₹440 a week (step 1 of 2). Approved by you on WhatsApp. Kept to 20% so Meta's learning doesn't restart." },
    { at: "2026-10-25T14:20:00Z", kind: "blocked", text: "Refused a headline with “TrekIndia”. It's on your blocked words, so a new headline was drafted instead." },
    { at: "2026-10-24T08:05:00Z", kind: "pause", text: "Paused “Spiti generic photo”. Cost per booking was 2.4 times the others after 600 views. This was a protective action, so you were told afterwards." },
    { at: "2026-10-23T10:30:00Z", kind: "creative", text: "Generated 6 new creatives. Price-first and founder-video hooks won last month. Waiting for your approval." },
    { at: "2026-10-22T16:00:00Z", kind: "tripwire", text: "Tripwire cleared: Reels-first creative. Cost per booking fell ₹28 and stayed down for 14 days." },
  ],
};

export const FIXTURE_HOME_SERIES: HomeSeries = {
  liftWeeks: [
    { weekStart: "2026-09-07", withAds: 4, holdout: 3, low: 2.8, high: 5.2 },
    { weekStart: "2026-09-14", withAds: 5, holdout: 3, low: 3.75, high: 6.25 },
    { weekStart: "2026-09-21", withAds: 5, holdout: 4, low: 3.7, high: 6.3 },
    { weekStart: "2026-09-28", withAds: 6, holdout: 3, low: 4.65, high: 7.35 },
    { weekStart: "2026-10-05", withAds: 7, holdout: 3, low: 5.6, high: 8.4 },
    { weekStart: "2026-10-12", withAds: 8, holdout: 3, low: 6.55, high: 9.45 },
    { weekStart: "2026-10-19", withAds: 9, holdout: 3, low: 7.5, high: 10.5 },
    { weekStart: "2026-10-26", withAds: 10, holdout: 3, low: 8.45, high: 11.55 },
  ],
  weeklyGoal: 12,
  sparks: {
    outcomes: [4, 5, 5, 6, 7, 8, 9, 10],
    cost_per_outcome: [470, 462, 455, 452, 440, 431, 418, 410],
    incremental: [1, 2, 1, 3, 4, 5, 6, 7],
  },
};

export const FIXTURE_PACING_SERIES: PacingSeries = {
  daysInMonth: 31,
  points: Array.from({ length: 22 }, (_, i) => {
    const day = i + 1;
    // A slightly uneven climb that lands exactly on the month-to-date spend.
    const wobble = 1 + 0.06 * Math.sin(day * 1.7);
    return { day, spend: day === 22 ? 13940 : Math.round((13940 * day * wobble) / 22) };
  }),
};

export const FIXTURE_DECISIONS: DecisionsResponse = {
  decisions: [
    {
      id: "preview-d1",
      kind: "budget_move",
      source: { engine: "allocator" },
      title: "Move ₹700 a week from X to Meta Advantage+ Leads",
      summary: "The council says X costs ₹3,080 per extra booking and Meta ₹531. Your total spend stays the same.",
      ops: [
        { platform: "x", campaignRef: "x-spiti-thread", op: "set_daily_budget", from: 140, to: 40 },
        { platform: "meta", campaignRef: "meta-trip-videos", op: "set_daily_budget", from: 590, to: 653 },
      ],
      impact: { metric: "outcomes", low: 2, high: 5, confidence: 0.8, horizonDays: 30 },
      council: {
        strategist: {
          model: "model A",
          text: "X brought 3 bookings this month, 1 of them extra, at ₹3,080 per extra booking. Meta brought 13 extra at ₹531. Moving most of X's budget to Meta should add 2 to 5 bookings a month at the same total spend.",
        },
        critic: {
          model: "model B (different vendor)",
          text: "X's result rests on 3 bookings, and the holdout range overlaps zero. Cutting X to nothing would end a test that hasn't finished. Keep a ₹280 a week floor so the evidence keeps coming in.",
        },
        chair: {
          text: "Move ₹700 and keep X at ₹280 a week as a test. Tripwire: if Meta's cost per extra booking goes above ₹750 within 14 days, reverse the move on its own and tell you.",
        },
        risk: {
          checks: [
            { key: "ceiling", pass: true, detail: "Total stays under ₹20,000" },
            { key: "no_new_channel", pass: true, detail: "No new channel" },
            { key: "step", pass: true, detail: "Each step is at most 20% of Meta's budget" },
            { key: "learning", pass: true, detail: "Meta is out of learning" },
            { key: "quiet_hours", pass: true, detail: "Outside quiet hours" },
            { key: "undo", pass: true, detail: "Can be undone for 24 hours" },
          ],
        },
      },
      tripwire: { metric: "cost_per_outcome", op: "gt", threshold: 750, checkBy: "2026-11-09T00:00:00Z", onTrip: "reverse" },
      needsPerson: true,
      status: "proposed",
      expiresAt: "2026-10-28T09:00:00Z",
      createdAt: "2026-10-26T09:00:00Z",
    },
    {
      id: "preview-d2",
      kind: "creative_approval",
      source: { engine: "council" },
      title: "Approve 6 new creatives",
      summary: "Price-first carousels and founder videos. You have “approved only” switched on.",
      ops: [
        { platform: "meta", campaignRef: "meta-trip-videos", op: "attach_creative", to: "6 creatives" },
        { platform: "google_ads", campaignRef: "google-trip-names", op: "attach_creative", to: "6 creatives" },
      ],
      needsPerson: true,
      status: "proposed",
      expiresAt: "2026-10-27T10:15:00Z",
      createdAt: "2026-10-23T10:15:00Z",
    },
    {
      id: "preview-d3",
      kind: "bid_strategy",
      source: { engine: "optimizer" },
      title: "Switch Google to Target CPA ₹450",
      summary: "Google has had 31 bookings in 30 days, enough data for target bidding. It restarts Google's learning.",
      ops: [{ platform: "google_ads", campaignRef: "google-trip-names", op: "set_bid_strategy", from: "maximize_clicks", to: "target_cpa_450" }],
      impact: { metric: "cost_per_outcome", low: -68, high: -36, confidence: 0.7, horizonDays: 21 },
      council: {
        strategist: { model: "model A", text: "Google has enough conversions for target bidding, and the target matches your mandate." },
        critic: { model: "model B (different vendor)", text: "Changing the bid strategy restarts learning. Do it after the 14 Nov batch closes, not before it." },
        chair: { text: "Approve for 15 Nov. Reverts on its own if cost goes above ₹600 for 7 days." },
        risk: { checks: [{ key: "learning", pass: false, detail: "Restarts Google's learning" }] },
      },
      tripwire: { metric: "cost_per_outcome", op: "gt", threshold: 600, checkBy: "2026-11-22T00:00:00Z", onTrip: "reverse" },
      needsPerson: true,
      status: "proposed",
      expiresAt: "2026-10-27T09:30:00Z",
      createdAt: "2026-10-22T09:30:00Z",
    },
    {
      id: "preview-d4",
      kind: "creative_approval",
      source: { engine: "sentinel" },
      title: "Tripwire cleared: Reels-first creative",
      summary: "No action needed. Logged in Learning.",
      ops: [],
      needsPerson: false,
      status: "applied",
      createdAt: "2026-10-22T16:00:00Z",
    },
    {
      id: "preview-d5",
      kind: "creative_approval",
      source: { engine: "sentinel" },
      title: "Headline used a blocked word",
      summary: "“TrekIndia” is on your list. Rewritten automatically.",
      ops: [],
      needsPerson: false,
      status: "failed",
      createdAt: "2026-10-21T14:20:00Z",
    },
  ],
};

export const FIXTURE_CHANNELS: ChannelsResponse = {
  health: [
    { platform: "meta", state: "healthy", reason: "Serving, signal tracked", spend: inr(6900), outcomes: fig(13), efficiency: fig(531) },
    { platform: "google_ads", state: "healthy", reason: "Serving, signal tracked", spend: inr(3960), outcomes: fig(8), efficiency: fig(495) },
    { platform: "x", state: "watch", reason: "Serving, no conversion upload", spend: inr(3080), outcomes: fig(1), efficiency: fig(3080) },
    { platform: "linkedin", state: "not_connected", reason: "Not now for travel", spend: { absent: "Not connected" }, outcomes: { absent: "Not connected" }, efficiency: { absent: "Not connected" } },
  ],
  bubbles: [
    { platform: "meta", spend: inr(6900), outcomes: fig(13), efficiency: fig(531) },
    { platform: "google_ads", spend: inr(3960), outcomes: fig(8), efficiency: fig(495) },
    { platform: "x", spend: inr(3080), outcomes: fig(1), efficiency: fig(3080) },
  ],
  shareByWeek: [
    [40, 35, 25],
    [41, 36, 23],
    [42, 37, 21],
    [44, 37, 19],
    [45, 38, 17],
    [47, 38, 15],
    [49, 38, 13],
    [50, 38, 12],
  ].map((s, i) => ({
    weekStart: new Date(Date.UTC(2026, 8, 7 + i * 7)).toISOString().slice(0, 10),
    shares: [
      { platform: "meta" as const, share: fig(s[0] / 100) },
      { platform: "google_ads" as const, share: fig(s[1] / 100) },
      { platform: "x" as const, share: fig(s[2] / 100) },
    ],
  })),
  pacing: { spentThisMonth: inr(13940), monthlyCeiling: inr(20000), daysLeft: 9 },
  campaigns: [
    { id: "preview-c1", platform: "meta", name: "Trip videos (Advantage+ Leads)", status: "Serving", dailyBudget: inr(590), spend: inr(4120), outcomes: fig(9), efficiency: fig(458) },
    { id: "preview-c2", platform: "meta", name: "Price-first carousel", status: "Serving", dailyBudget: inr(400), spend: inr(2780), outcomes: fig(4), efficiency: fig(695) },
    { id: "preview-c3", platform: "google_ads", name: "Trip names Search", status: "Serving", dailyBudget: inr(560), spend: inr(3960), outcomes: fig(8), efficiency: fig(495) },
    { id: "preview-c4", platform: "x", name: "Spiti thread promotion", status: "Reduced", dailyBudget: inr(140), spend: inr(3080), outcomes: fig(1), efficiency: fig(3080) },
    { id: "preview-c5", platform: "meta", name: "Spiti generic photo", status: "Paused by engine", dailyBudget: inr(0), spend: inr(0), outcomes: { absent: "Paused before it had a reading" }, efficiency: { absent: "Paused before it had a reading" } },
  ],
};

const HEAT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT_SLOTS = ["6-9", "9-12", "12-15", "15-18", "18-21", "21-24"];
const HEAT_VALUES = [
  [1, 2, 2, 2, 4, 3],
  [1, 2, 2, 3, 4, 3],
  [1, 2, 3, 3, 5, 3],
  [1, 2, 2, 3, 5, 4],
  [1, 2, 2, 3, 4, 5],
  [2, 4, 4, 4, 5, 5],
  [3, 4, 4, 5, 9, 7],
];

export const FIXTURE_LEARNING: LearningResponse = {
  experiments: [
    { id: "preview-e1", title: "Google: add “family trek” searches", status: "running", startedAt: "2026-10-12T00:00:00Z", lift: { absent: "3 bookings so far, not enough to judge" } },
    { id: "preview-e2", title: "Reels-first creative on Meta", status: "judged", verdict: "winner", startedAt: "2026-10-08T00:00:00Z", lift: fig(0.07) },
    { id: "preview-e3", title: "X: promote the Spiti thread", status: "judged", verdict: "loser", startedAt: "2026-10-07T00:00:00Z", lift: fig(-0.4) },
    { id: "preview-e4", title: "Shift delivery to Sunday evenings", status: "judged", verdict: "winner", startedAt: "2026-09-24T00:00:00Z", lift: fig(0.19) },
    { id: "preview-e5", title: "Holdout: 10% of areas held back", status: "running", startedAt: "2026-09-23T00:00:00Z", lift: { absent: "A holdout is the measurement, not a test with its own lift" } },
  ],
  creativePatterns: [
    { key: "price_first_carousel", label: "Price-first carousel", hookFormat: "carousel", liftPer1k: fig(2.9), n: fig(14) },
    { key: "founder_video", label: "Founder video at camp", hookFormat: "video", liftPer1k: fig(2.4), n: fig(9) },
    { key: "traveller_reviews", label: "Real traveller reviews", hookFormat: "collage", liftPer1k: fig(1.6), n: fig(6) },
    { key: "generic_photo", label: "Generic mountain photo", hookFormat: "image", liftPer1k: fig(0.4), n: fig(11) },
  ],
  benchmarks: [
    { metric: "cost_per_outcome", you: fig(410), p25: fig(450), p50: fig(520), p75: fig(620), n: fig(214) },
    { metric: "enquiry_to_outcome_rate", you: fig(0.083), p25: fig(0.04), p50: fig(0.061), p75: fig(0.09), n: fig(214) },
    { metric: "creative_refresh_days", you: fig(12), p25: fig(14), p50: fig(21), p75: fig(30), n: fig(131) },
    { metric: "incremental_share", you: fig(0.65), p25: fig(0.5), p50: fig(0.58), p75: fig(0.7), n: { absent: "Fewer than 20 merchants report this" } },
  ],
  heatmap: {
    rows: HEAT_DAYS,
    columns: HEAT_SLOTS,
    cells: HEAT_DAYS.flatMap((row, i) => HEAT_SLOTS.map((column, j) => ({ row, column, figure: fig(HEAT_VALUES[i][j]) }))),
  },
};

export const FIXTURE_RULES: RulesResponse = {
  mandate: {
    outcome: { kind: "bookings", source: "orders", optimizeFor: "count" },
    currency: "INR",
    monthlyCeiling: 20000,
    target: { kind: "cost_per_outcome", value: 450 },
    targetSource: "playbook",
    playbook: { id: "travel", version: 1 },
    autonomy: { level: 1, since: "2026-10-02T00:00:00Z", clearedDecisions: 3 },
    confirmation: { at: "2026-10-02T09:00:00Z", via: "signed_link_otp", renewsAt: "2027-01-02T09:00:00Z" },
    approvers: ["preview-owner", "preview-marketing-lead"],
  },
  autonomy: { level: 1 },
  guardrails: {
    deniedChannels: ["linkedin"],
    allowedChannels: ["meta", "google_ads", "x"],
    approvedAssetsOnly: true,
    blockedTerms: ["cheapest", "guaranteed", "TrekIndia"],
    quietHours: { start: "22:00", end: "08:00" },
    blackoutDates: [],
    timeZone: "Asia/Kolkata",
    adsHalted: false,
  },
  connections: [
    { platform: "meta", connected: true, currency: "INR", currencyMismatch: false },
    { platform: "google_ads", connected: true, currency: "INR", currencyMismatch: false },
    { platform: "x", connected: true, currency: "INR", currencyMismatch: false },
    { platform: "linkedin", connected: false, currencyMismatch: false },
  ],
};

export const FIXTURE_FIRST_RUN: FirstRunPlanResponse = {
  mandate: {
    outcome: { kind: "bookings", source: "orders", optimizeFor: "count" },
    currency: "INR",
    monthlyCeiling: 20000,
    target: { kind: "cost_per_outcome", value: 450 },
    targetSource: "playbook",
    playbook: { id: "travel", version: 1 },
    autonomyLevel: 1,
  },
  channels: [
    { platform: "meta", role: "lead", monthlyShare: fig(0.6), reason: "Advantage+ Leads. Short trip videos and price-first carousels, with delivery tilted toward Sunday evenings." },
    { platform: "google_ads", role: "lead", monthlyShare: fig(0.4), reason: "Search on trip names, targeting ₹450 per booking. Brand terms excluded so you aren't paying for people who already know you." },
    { platform: "x", role: "not_now", monthlyShare: { absent: "Not now" }, reason: "Weak evidence for travel. Revisit at week 6." },
  ],
  expectedOutcomes: { low: { absent: "Your own data takes over from about week 4" }, high: { absent: "Your own data takes over from about week 4" } },
};
