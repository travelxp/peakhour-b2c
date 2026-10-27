import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  FIXTURE_CHANNELS,
  FIXTURE_HOME,
  FIXTURE_LEARNING,
  FIXTURE_PACING_SERIES,
  FIXTURE_RULES,
  previewDecisions,
} from "@/lib/growth-v2-fixtures";
import { seriesFromHome, type HomeSeries, type PacingSeries } from "@/lib/growth-v2-series";

/**
 * Growth Engine v2 client (plan 2.10): the six screens' read APIs.
 *
 * ★A MIRROR, NOT A DESIGN. The types below are copied from
 * `peakhour-api/src/v1/routes/growth/v2/types.ts` (S2 owns that file; U0 owns
 * this one). A change to a screen's shape is a change to the plan's contract
 * first, then to both files, never to this one alone.
 *
 * ★EVERY FIGURE IS `{ value } | { absent: reason }`. A screen renders the
 * reason. It never turns an absent figure into a 0, because absent is not zero
 * and a reader cannot tell "we did not measure" from "it was nothing".
 *
 * ★UNTIL THE H LANES LAND, THE ROUTES ANSWER 501 `NOT_BUILT`. Each hook below
 * then hands back the prototype's sample data, flagged `preview: true`, and the
 * screen says so on a banner. A fixture is never returned for any other error:
 * a 500 or a 403 must reach the merchant as an error, not as someone else's
 * numbers.
 */

// -- Shared (mirror of types.ts) ---------------------------------------------

export type Figure = { value: number } | { absent: string };

/** A figure in a currency. */
export type Money = { value: number; currency: string } | { absent: string };

export type AdPlatform = "linkedin" | "google_ads" | "meta" | "x";
export type AutonomyLevel = 0 | 1 | 2 | 3;

/** The code every unbuilt v2 route answers 501 with. */
export const NOT_BUILT = "NOT_BUILT";
export interface NotBuiltDetails {
  /** The plan row that builds this route, e.g. "H1". */
  row: string;
}

// -- Mandate, as the screens see it (plan 2.1) ---------------------------------

export type OutcomeKind = "sales" | "bookings" | "leads" | "calls" | "store_visits";
export type OutcomeSource = "orders" | "win_definition" | "gbp_actions" | "ads_conversions";

export interface MandateOutcome {
  kind: OutcomeKind;
  source: OutcomeSource;
  focus?: { by: "product_type" | "tag" | "vendor" | "product" | "key_event"; values: string[]; label: string };
  optimizeFor: "count" | "value";
}

export type MandateTarget = { kind: "cost_per_outcome"; value: number } | { kind: "roas"; value: number };

export interface MandateView {
  outcome: MandateOutcome;
  goal?: { perMonth: number };
  currency: string;
  monthlyCeiling: number;
  target: MandateTarget;
  targetSource: "playbook" | "merchant";
  playbook: { id: string; version: number };
  autonomy: {
    level: AutonomyLevel;
    since: string;
    clearedDecisions: number;
    lastDemotion?: { at: string; decisionId: string; reason: string };
  };
  confirmation: { at: string; via: "signed_link_otp"; renewsAt: string };
  approvers: string[];
}

// -- Home (H1) ---------------------------------------------------------------------

export type HomeWindowKey = "7d" | "month" | "90d";
export type HomeCompare = "holdout" | "last_period";

export interface HomeKpi {
  key: string;
  label: string;
  figure: Figure;
  /**
   * Change against the prior period, as a fraction; absent when there is no prior. With `compare=holdout` only the
   * outcomes KPI carries one (the ads' effect over the scaled holdout).
   */
  change?: Figure;
  /** Eight weekly points ending at the window's close, oldest first. A week that could not be read is absent. */
  spark?: Figure[];
}

/** One week of the lift chart. */
export interface HomeLiftWeek {
  weekStart: string;
  withAds: number;
  holdout: number;
  low?: number;
  high?: number;
}

export interface HomeSpendPoint {
  day: number;
  spend: number;
}

export type HomeFeedKind = "budget" | "pause" | "creative" | "blocked" | "change" | "check";

export interface HomeResponse {
  /** The window the figures cover, on the business clock; `to` is exclusive. */
  window: { key: HomeWindowKey; from: string; to: string; days: number; compare: HomeCompare };
  outcome: { kind: OutcomeKind; label: string; optimizeFor: "count" | "value" };
  /** Absent when the merchant set no goal. Always the calendar month; `paceVsGoal` is projected month-end over `perMonth` (1 = on pace). */
  goal?: { perMonth: number; soFar: Figure; projected: Figure; paceVsGoal: Figure };
  efficiency: {
    metric: "cost_per_outcome" | "roas";
    you: Figure;
    target: Figure;
    industry: Figure;
    /** What `you` is made of: spend over ALL the outcomes counted, not only those the ads caused. */
    basis: string;
  };
  /** Holdout lift (plan 2.6): the latest reading. */
  lift: {
    liftPct: Figure;
    confidence: Figure;
    windowDays: number;
    weeks?: HomeLiftWeek[];
    weeklyGoal?: number;
  };
  kpis: HomeKpi[];
  pacing: {
    spentThisMonth: Money;
    monthlyCeiling: Money;
    daysLeft: number;
    series?: { daysInMonth: number; points: HomeSpendPoint[]; ideal: HomeSpendPoint[]; missingDays: number[] };
  };
  waterfall: Array<{ key: string; label: string; figure: Figure }>;
  /** What the drivers are, or why there are none. */
  waterfallBasis: { basis: string } | { absent: string };
  funnel: { stages: Array<{ key: string; label: string; figure: Figure }>; basis: string };
  feed: Array<{ at: string; kind: HomeFeedKind; title: string; detail?: string; decisionId?: string }>;
}

// -- Decisions (H2 reads, C5 acts) ------------------------------------------------------

export type DecisionKind =
  | "budget_move"
  | "budget_raise"
  | "bid_strategy"
  | "creative_approval"
  | "campaign_launch"
  | "campaign_pause"
  | "playbook_upgrade"
  | "autonomy_change"
  | "mandate_change"
  | "channel_add"
  /** An optimizer proposal that changes no platform setting: never spends. */
  | "content_adjustment";

export type DecisionStatus =
  | "proposed"
  | "approved"
  | "applied"
  | "held"
  | "rejected"
  | "expired"
  | "superseded"
  | "reverted"
  | "failed";

export interface EngineOpView {
  platform: AdPlatform;
  campaignRef: string;
  op:
    | "set_daily_budget"
    | "set_status"
    | "set_bid_strategy"
    | "set_target"
    | "attach_creative"
    | "detach_creative"
    | "set_geo_exclusions"
    | "set_geo_inclusions";
  from?: unknown;
  to: unknown;
}

/** An op with the sentence the api wrote for it: the campaign by name, the change in words. */
export interface DescribedOpView extends EngineOpView {
  description: string;
}

export type DecisionMetric = "outcomes" | "value" | "cost_per_outcome" | "roas";

/** One later step of a governed move: scheduled, applied (with when) or cancelled. */
export interface DecisionStepView {
  op: DescribedOpView;
  dueAt: string;
  status: "scheduled" | "applied" | "cancelled";
  appliedAt?: string;
}

export interface DecisionView {
  id: string;
  kind: DecisionKind;
  source: { engine: string; refId?: string };
  title: string;
  summary: string;
  ops: DescribedOpView[];
  impact?: { metric: DecisionMetric; low: number; high: number; confidence: number; horizonDays: number };
  council?: {
    strategist: { model: string; text: string };
    critic: { model: string; text: string };
    chair: { text: string };
    risk: { checks: Array<{ key: string; pass: boolean; detail: string }> };
  };
  tripwire?: { metric: DecisionMetric; op: "gt" | "lt"; threshold: number; checkBy: string; onTrip: "reverse" | "notify" };
  needsPerson: boolean;
  status: DecisionStatus;
  expiresAt?: string;
  decidedBy?: { via: "inapp" | "whatsapp"; at: string };
  /** The end of the undo window; absent unless the decision is applied with an action still undoable. */
  undoUntil?: string;
  /** `whatsapp` is set only when a message went out. */
  delivery: { inAppAt?: string; whatsapp?: { template: string; sentAt: string } };
  steps?: DecisionStepView[];
  createdAt: string;
}

/** A guardrail block, one per (guardrail, channel): something the engine was stopped from doing. */
export interface GuardrailBlockView {
  id: string;
  code: string;
  platform: AdPlatform;
  title: string;
  message: string;
  count: number;
  lastAt: string;
}

export type DecisionQueue = "open" | "done" | "blocked";

export interface DecisionsResponse {
  queue: DecisionQueue;
  /** Newest first. Empty for `blocked`. */
  decisions: DecisionView[];
  /** Only for `blocked`. */
  blocks: GuardrailBlockView[];
  counts: Record<DecisionQueue, number>;
  /** Pass it back as `cursor` for the next page; absent on the last. */
  nextCursor?: string;
}

export interface DecisionAskResponse {
  answer: string;
}

export type DecisionAction = "approve" | "hold" | "reject" | "undo";

/** What C5's answer routes send back on success (approve, hold, reject: `status`, `scheduled`; undo: `status`, `reverted`). */
export interface DecideResponse {
  status: DecisionStatus;
  /** The later steps of a move over 20%: not applied yet. */
  scheduled?: unknown[];
}

// -- Channels (H3) -----------------------------------------------------------------------

export type ChannelHealthState = "healthy" | "watch" | "problem" | "not_connected";

export interface ChannelsResponse {
  /** The window the figures cover, on the business clock (as Home's); `to` is exclusive. */
  window: { key: HomeWindowKey; from: string; to: string; days: number };
  outcome: { kind: OutcomeKind; label: string; optimizeFor: "count" | "value" };
  /** What a channel's `outcomes` are: attributed to the channel, not the extra outcomes the ads caused. */
  basis: string;
  /** The same window's whole-business figures, read as Home reads them. */
  totals: { spend: Money; outcomes: Figure; efficiency: Figure };
  efficiency: { metric: "cost_per_outcome" | "roas"; target: Figure };
  /** One row per ad platform the business can use. `reason` names the fact the state comes from. */
  health: Array<{
    platform: AdPlatform;
    state: ChannelHealthState;
    reason?: string;
    spend: Money;
    outcomes: Figure;
    efficiency: Figure;
  }>;
  /** Spend against outcomes per channel, for the bubble chart. */
  bubbles: Array<{ platform: AdPlatform; spend: Money; outcomes: Figure; efficiency: Figure }>;
  /** Eight buckets of 7 days ending where the window ends (Home's spark buckets), oldest first; `weekStart` is the local day a bucket opens, not a Monday. */
  shareByWeek: Array<{ weekStart: string; shares: Array<{ platform: AdPlatform; share: Figure }> }>;
  /** Where the allocator's latest decision would leave each platform's share of daily budget; absent when it has made none. */
  allocatorTarget?: { decisionId: string; status: string; at: string; shares: Array<{ platform: AdPlatform; share: Figure }> };
  pacing: {
    spentThisMonth: Money;
    monthlyCeiling: Money;
    daysLeft: number;
    series?: { daysInMonth: number; points: Array<{ day: number; spend: number }>; ideal: Array<{ day: number; spend: number }>; missingDays: number[] };
  };
  /** Which campaigns are listed, and what is said of their results. */
  campaignsBasis: string;
  campaigns: Array<{
    id: string;
    platform: AdPlatform;
    name: string;
    status: string;
    dailyBudget: Money;
    /** The engine's latest accepted change of the daily budget in the last 30 days, in the campaign's own `currency`. */
    engineChange?: { at: string; from: number; to: number; currency: string };
    spend: Money;
    outcomes: Figure;
    efficiency: Figure;
  }>;
}

// -- Learning (H4) -----------------------------------------------------------------------

export interface LearningResponse {
  experiments: Array<{
    id: string;
    title: string;
    status: string;
    verdict?: "winner" | "loser" | "inconclusive";
    startedAt?: string;
    lift: Figure;
  }>;
  creativePatterns: Array<{ key: string; label: string; hookFormat: string; liftPer1k: Figure; n: Figure }>;
  benchmarks: Array<{ metric: string; you: Figure; p25: Figure; p50: Figure; p75: Figure; n: Figure }>;
  heatmap: { rows: string[]; columns: string[]; cells: Array<{ row: string; column: string; figure: Figure }> };
}

// -- Rules (H5) --------------------------------------------------------------------------

export interface RulesResponse {
  /** Absent = the engine is off for this business. */
  mandate?: MandateView;
  autonomy: { level: AutonomyLevel; offeredPromotion?: { to: AutonomyLevel; decisionId: string } };
  guardrails: {
    deniedChannels: string[];
    allowedChannels: string[] | null;
    approvedAssetsOnly: boolean;
    blockedTerms: string[];
    quietHours: { start: string; end: string } | null;
    blackoutDates: Array<{ from: string; to: string; label?: string }>;
    /** The one business clock (plan 2.1). */
    timeZone: string | null;
    adsHalted: boolean;
  };
  connections: Array<{
    platform: AdPlatform;
    connected: boolean;
    currency?: string;
    /** True when the account bills in another currency than the mandate and is not managed. */
    currencyMismatch: boolean;
    /** C3's readiness of the conversion signal; absent for a platform the signal step does not cover. */
    signal?: SignalStateView;
  }>;
  /** The lines the engine never crosses, at any level (H5). */
  neverCrossed: string[];
  /** A mandate change waiting for its signed link and code; absent when none is. */
  pendingChange?: { decisionId: string; summary: string; expiresAt: string };
}

export type SignalStateView = "ready" | "untracked_accepted" | "needed" | "needs_primary_goal" | "not_connected";

/** `PATCH /v1/growth/v2/rules` (H5): the rules as they now stand, and the mandate change it started, if any. */
export interface RulesPatchResponse extends RulesResponse {
  mandateChange?: { decisionId: string; linkSent: true; via: "signed_link_otp" };
}

/** The guardrail edit of `PATCH /rules`: a key left out keeps what is stored; null, [] or false clears. */
export interface GuardrailsPatch {
  deniedChannels?: AdPlatform[];
  allowedChannels?: AdPlatform[] | null;
  approvedAssetsOnly?: boolean;
  blockedTerms?: string[];
  quietHours?: { start: string; end: string } | null;
  blackoutDates?: Array<{ from: string; to: string; label?: string }>;
  timeZone?: string;
}

/** The mandate edit of `PATCH /rules`: it never writes the mandate, it sends a confirmation link. */
export interface MandatePatch {
  outcome?: { kind: OutcomeKind; source: OutcomeSource; focus?: NonNullable<MandateOutcome["focus"]>; optimizeFor?: "count" | "value" };
  monthlyCeiling?: number;
  target?: MandateTarget;
}

export type RulesPatchBody = { guardrails: GuardrailsPatch } | { mandate: MandatePatch };

// -- Onboarding (H5, C6b) -----------------------------------------------------------------

/** `POST /v1/growth/v2/onboarding/draft`. Every field is optional: an empty body asks for the first look. */
export interface FirstRunDraftRequest {
  /** The merchant's answer to "Which best describes you?"; must be one of the tie's candidates. */
  playbookId?: string;
  /** The merchant's yes to "Do customers visit you in person?". */
  customersVisitInPerson?: boolean;
}

export interface DraftOffer {
  kind: OutcomeKind;
  source: OutcomeSource;
  optimizeFor: "count" | "value";
  /** The kind's own word: "Sales", "Bookings". */
  label: string;
  focusSuggestions: Array<{ by: "product_type" | "tag" | "vendor"; values: string[]; label: string; source: "playbook" | "revenue"; revenue: number }>;
  focusWindowDays?: number;
  defaultTarget?: { kind: "cost_per_outcome"; value: number; low: number; high: number; currency: string } | { kind: "roas"; value: number; low: number; high: number };
  targetSource: "playbook" | "merchant";
}

export interface DraftChannel {
  platform: AdPlatform;
  role: "lead" | "test";
  /** A fraction of the ceiling; the shares of a plan add up to 1. */
  monthlyShare: number;
  reason: string;
  connected: boolean;
}

export interface FirstRunDraftResponse {
  /** True when the business already has a mandate: the plan is changed from Rules, not drafted again. */
  alreadyActive: boolean;
  currency?: string;
  /** The business clock. Absent until it is set; the mandate cannot be confirmed without it. */
  timeZone: { value: string } | { absent: string; suggested?: string };
  offers: DraftOffer[];
  askAboutStores: boolean;
  playbook?: { id: string; version: number; title: string };
  /** More than one playbook fits equally: ask "Which best describes you?" and send the answer back as `playbookId`. */
  tie?: { candidates: Array<{ playbookId: string; version: number; title: string }> };
  channels: DraftChannel[];
  ceilingBands: { currency: string; bands: Array<{ key: "starter" | "steady" | "growth"; amount: number }> } | { absent: string };
  excludedByGuardrails: AdPlatform[];
}

/** The plan `POST /onboarding/confirm` validates (W1) and stores pending until its link and code are accepted. */
export interface ConfirmPlanBody {
  outcome: MandateOutcome;
  goal?: { perMonth: number };
  currency: string;
  monthlyCeiling: number;
  target: MandateTarget;
  targetSource: "playbook" | "merchant";
  playbook?: { id: string; version: number };
  approvers?: string[];
}

export interface OnboardingConfirmResponse {
  /** The signed link has been sent; the mandate is written only after its OTP. */
  linkSent: boolean;
  via: "signed_link_otp";
}

// -- The client ----------------------------------------------------------------------------

const BASE = "/v1/growth/v2";

export const growthV2Api = {
  home: (window: HomeWindowKey = "7d", compare: HomeCompare = "last_period") =>
    api.get<HomeResponse>(`${BASE}/home?window=${window}&compare=${compare}`),
  decisions: (queue: DecisionQueue, opts: { cursor?: string; limit?: number } = {}) => {
    const q = new URLSearchParams({ status: queue });
    if (opts.cursor) q.set("cursor", opts.cursor);
    if (opts.limit) q.set("limit", String(opts.limit));
    return api.get<DecisionsResponse>(`${BASE}/decisions?${q.toString()}`);
  },
  decide: (id: string, action: DecisionAction) =>
    api.post<DecideResponse>(`${BASE}/decisions/${encodeURIComponent(id)}/${action}`),
  ask: (id: string, question: string) =>
    api.post<DecisionAskResponse>(`${BASE}/decisions/${encodeURIComponent(id)}/ask`, { question }),
  channels: (window: HomeWindowKey = "7d") => api.get<ChannelsResponse>(`${BASE}/channels?window=${window}`),
  learning: () => api.get<LearningResponse>(`${BASE}/learning`),
  rules: () => api.get<RulesResponse>(`${BASE}/rules`),
  patchRules: (body: RulesPatchBody) => api.patch<RulesPatchResponse>(`${BASE}/rules`, body),
  draft: (body: FirstRunDraftRequest) => api.post<FirstRunDraftResponse>(`${BASE}/onboarding/draft`, body),
  confirm: (body: ConfirmPlanBody) => api.post<OnboardingConfirmResponse>(`${BASE}/onboarding/confirm`, body),
};

// -- 501 NOT_BUILT and the preview fallback --------------------------------------------------

/** True for the one error that means "no lane has built this route yet". */
export function isNotBuilt(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 501 && err.code === NOT_BUILT;
}

/** The plan row an unbuilt route names in its details, e.g. "H1". */
export function notBuiltRow(err: ApiError): string | undefined {
  const d = err.details as Partial<NotBuiltDetails> | undefined;
  return typeof d?.row === "string" ? d.row : undefined;
}

/**
 * What a screen reads: the data, and whether it is the prototype's sample.
 * `row` names the plan row that will replace the sample, when the api said so.
 */
export interface V2Result<T> {
  data: T;
  preview: boolean;
  row?: string;
}

/**
 * Run `fetcher`; when the route answers 501 NOT_BUILT, hand back `fixture`
 * flagged as a preview. Every other failure is rethrown untouched.
 */
export async function loadOrPreview<T>(fetcher: () => Promise<T>, fixture: () => T): Promise<V2Result<T>> {
  try {
    return { data: await fetcher(), preview: false };
  } catch (err) {
    if (isNotBuilt(err)) return { data: fixture(), preview: true, row: notBuiltRow(err) };
    throw err;
  }
}

// -- Hooks, one per screen ---------------------------------------------------------------------

const key = (businessId: string | undefined, screen: string, ...rest: unknown[]) =>
  ["growth-v2", businessId ?? "none", screen, ...rest] as const;

/** What the Growth home draws: the response, and the chart series read out of it. */
export interface HomeScreenData extends V2Result<HomeResponse> {
  series?: HomeSeries;
  pacingSeries?: PacingSeries;
}

/** The two answers the api gives instead of a page: the engine is off, or there is no business clock. */
export type HomeRefusalCode = "NO_MANDATE" | "NO_BUSINESS_CLOCK";
export interface HomeRefusal {
  refusal: HomeRefusalCode;
  preview: false;
}

/**
 * Fetch Growth home, or its refusal as DATA. ★A refusal is an answer, not an error: as data it stays on screen through
 * refetches (an error clears the moment one starts) and is never retried.
 */
export async function loadHome(fetcher: () => Promise<HomeResponse>): Promise<HomeScreenData | HomeRefusal> {
  try {
    const r = await loadOrPreview(fetcher, () => FIXTURE_HOME);
    return { ...r, ...seriesFromHome(r.data) };
  } catch (err) {
    if (err instanceof ApiError && (err.code === "NO_MANDATE" || err.code === "NO_BUSINESS_CLOCK")) return { refusal: err.code, preview: false };
    throw err;
  }
}

/** `placeholderData` that carries the last window over only while the business is the same one. */
export function sameBusiness(businessId: string | undefined) {
  return <T,>(previous: T | undefined, previousQuery: { queryKey: readonly unknown[] } | undefined): T | undefined =>
    previousQuery?.queryKey[1] === (businessId ?? "none") ? previous : undefined;
}

export function useGrowthV2Home(window: HomeWindowKey = "7d", compare: HomeCompare = "last_period") {
  const { business } = useAuth();
  return useQuery<HomeScreenData | HomeRefusal>({
    queryKey: key(business?._id, "home", window, compare),
    queryFn: () => loadHome(() => growthV2Api.home(window, compare)),
    enabled: !!business?._id,
    staleTime: 30_000,
    // Changing the window keeps the last one on screen until the next arrives, instead of collapsing to a skeleton.
    // ★Only for the same business: another business's figures must never stand in for this one's.
    placeholderData: sameBusiness(business?._id),
  });
}

/** The decisions a screen reads: every page so far, merged, and whether there is another. */
export interface DecisionsScreenData extends V2Result<DecisionsResponse> {
  hasMore: boolean;
}

/**
 * One queue of the Decisions screen, a page at a time (`fetchNextPage`).
 *
 * A PREVIEW ONLY ON 501: the sample comes back for `NOT_BUILT` and for nothing else; a 500 or a 403 reaches the
 * merchant as an error. A preview is one page, so it never has another.
 */
/** Every page so far as one result. A stable function, so the query does not re-select on each render. */
export function mergeDecisionPages(d: { pages: Array<V2Result<DecisionsResponse>> }): DecisionsScreenData {
  const first = d.pages[0]!;
  const last = d.pages[d.pages.length - 1]!;
  return {
    // The counts of the newest page: the freshest the screen has.
    data: { ...last.data, decisions: d.pages.flatMap((p) => p.data.decisions), blocks: d.pages.flatMap((p) => p.data.blocks) },
    preview: first.preview,
    ...(first.row !== undefined ? { row: first.row } : {}),
    hasMore: last.data.nextCursor !== undefined,
  };
}

export function useGrowthV2Decisions(queue: DecisionQueue = "open") {
  const { business } = useAuth();
  return useInfiniteQuery({
    queryKey: key(business?._id, "decisions", queue),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      loadOrPreview(
        () => growthV2Api.decisions(queue, pageParam ? { cursor: pageParam } : {}),
        () => previewDecisions(queue),
      ),
    getNextPageParam: (last) => last.data.nextCursor,
    select: mergeDecisionPages,
    enabled: !!business?._id,
    staleTime: 15_000,
  });
}

/** The three tabs' counts, from the cheapest page there is. They do not move when the person changes tab. */
export function useGrowthV2DecisionCounts() {
  const { business } = useAuth();
  return useQuery<V2Result<DecisionsResponse["counts"]>>({
    queryKey: key(business?._id, "decision-counts"),
    queryFn: async () => {
      const r = await loadOrPreview(() => growthV2Api.decisions("open", { limit: 1 }), () => previewDecisions("open"));
      return { data: r.data.counts, preview: r.preview, ...(r.row !== undefined ? { row: r.row } : {}) };
    },
    enabled: !!business?._id,
    staleTime: 15_000,
  });
}

export interface ChannelsScreenData extends V2Result<ChannelsResponse> {
  pacingSeries?: PacingSeries;
}

/** The two answers the api gives instead of the page (as Home's): the engine is off, or there is no business clock. */
export interface ChannelsRefusal {
  refusal: HomeRefusalCode;
  preview: false;
}

/** The pacing chart's series, from the response (the preview sample carries its own). */
export function pacingSeriesFrom(c: ChannelsResponse): PacingSeries | undefined {
  const s = c.pacing.series;
  return s ? { points: s.points, daysInMonth: s.daysInMonth, missingDays: s.missingDays } : undefined;
}

/**
 * Fetch Channels & money, or its refusal as DATA (see `loadHome`). A preview only on 501.
 */
export async function loadChannels(fetcher: () => Promise<ChannelsResponse>): Promise<ChannelsScreenData | ChannelsRefusal> {
  try {
    const r = await loadOrPreview(fetcher, () => FIXTURE_CHANNELS);
    const series = r.preview ? FIXTURE_PACING_SERIES : pacingSeriesFrom(r.data);
    return series ? { ...r, pacingSeries: series } : r;
  } catch (err) {
    if (err instanceof ApiError && (err.code === "NO_MANDATE" || err.code === "NO_BUSINESS_CLOCK")) return { refusal: err.code, preview: false };
    throw err;
  }
}

export function useGrowthV2Channels(window: HomeWindowKey = "7d") {
  const { business } = useAuth();
  return useQuery<ChannelsScreenData | ChannelsRefusal>({
    queryKey: key(business?._id, "channels", window),
    queryFn: () => loadChannels(() => growthV2Api.channels(window)),
    enabled: !!business?._id,
    staleTime: 30_000,
    placeholderData: sameBusiness(business?._id),
  });
}

export function useGrowthV2Learning() {
  const { business } = useAuth();
  return useQuery<V2Result<LearningResponse>>({
    queryKey: key(business?._id, "learning"),
    queryFn: () => loadOrPreview(growthV2Api.learning, () => FIXTURE_LEARNING),
    enabled: !!business?._id,
    staleTime: 60_000,
  });
}

export function useGrowthV2Rules() {
  const { business } = useAuth();
  return useQuery<V2Result<RulesResponse>>({
    queryKey: key(business?._id, "rules"),
    queryFn: () => loadOrPreview(growthV2Api.rules, () => FIXTURE_RULES),
    enabled: !!business?._id,
    staleTime: 60_000,
    // The nav asks on every dashboard page; a 403 for a business without Growth is an answer, not a blip.
    retry: false,
  });
}

/**
 * The mandate a screen may take its currency and outcome unit from: the rules
 * result, but only when it is the same kind of data as the screen. A live
 * decisions list must not be formatted with the sample mandate, and a preview must
 * not borrow a live one.
 */
export function mandateFor(rules: V2Result<RulesResponse> | undefined, screenPreview: boolean): MandateView | undefined {
  return rules && rules.preview === screenPreview ? rules.data.mandate : undefined;
}

/**
 * The First-run plan. `onboarding/draft` is a POST, but it only reads: it writes nothing, so it is a query, asked again
 * whenever an answer changes. The previous answer stays on screen while the next one loads, so the page does not blink.
 */
export function useFirstRunDraft(body: FirstRunDraftRequest, opts: { enabled?: boolean } = {}) {
  const { business } = useAuth();
  return useQuery<FirstRunDraftResponse>({
    queryKey: key(business?._id, "first-run-draft", body),
    queryFn: () => growthV2Api.draft(body),
    enabled: !!business?._id && opts.enabled !== false,
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });
}

/** Send the plan to WhatsApp for confirmation. Nothing is written to the mandate until the link's code is accepted. */
export function useConfirmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmPlanBody) => growthV2Api.confirm(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-v2"] }),
  });
}

/**
 * Edit the rules: a guardrail change is saved at once, and a mandate change sends a confirmation link and writes nothing.
 * Either way the answer is the rules as they now stand, so the screen is set from it and not from a guess.
 */
export function usePatchRules() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: (body: RulesPatchBody) => growthV2Api.patchRules(body),
    onSuccess: (rules) => {
      qc.setQueryData<V2Result<RulesResponse>>(key(business?._id, "rules"), { data: rules, preview: false });
      // The nav and the other screens read the same facts under their own keys.
      return qc.invalidateQueries({ queryKey: ["growth-v2"] });
    },
  });
}

/**
 * Approve, hold, reject or undo a decision (C5's routes). It settles by refetching: a 409 can still have moved the
 * decision (an approve the platform refused goes back to `held`), so the queues are read again whatever the answer was.
 * The Decisions screen never calls this on a preview sample.
 */
export function useDecideV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: DecisionAction }) => growthV2Api.decide(v.id, v.action),
    // Every Growth v2 screen reads the decision queue's effects, so refetch them all.
    onSettled: () => qc.invalidateQueries({ queryKey: ["growth-v2"] }),
  });
}

/** Ask a question about one decision. Free, and moves nothing: no refetch. */
export function useAskDecisionV2() {
  return useMutation({ mutationFn: (v: { id: string; question: string }) => growthV2Api.ask(v.id, v.question) });
}
