import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  FIXTURE_CHANNELS,
  FIXTURE_DECISIONS,
  FIXTURE_FIRST_RUN,
  FIXTURE_HOME,
  FIXTURE_HOME_SERIES,
  FIXTURE_LEARNING,
  FIXTURE_PACING_SERIES,
  FIXTURE_RULES,
} from "@/lib/growth-v2-fixtures";
import type { HomeSeries, PacingSeries } from "@/lib/growth-v2-series";

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

export interface HomeKpi {
  key: string;
  label: string;
  figure: Figure;
  /** Change against the prior period, as a fraction; absent when there is no prior. */
  change?: Figure;
}

export interface HomeResponse {
  outcome: { kind: OutcomeKind; label: string; optimizeFor: "count" | "value" };
  /** Absent when the merchant set no goal. */
  /** `paceVsGoal` is read as projected month-end outcomes over `perMonth` (1 = exactly on pace). The types file does not say; H1 settles it. */
  goal?: { perMonth: number; soFar: Figure; paceVsGoal: Figure };
  efficiency: {
    metric: "cost_per_outcome" | "roas";
    you: Figure;
    target: Figure;
    industry: Figure;
  };
  /** Holdout lift (plan 2.6). */
  lift: { liftPct: Figure; confidence: Figure; windowDays: number };
  kpis: HomeKpi[];
  pacing: { spentThisMonth: Money; monthlyCeiling: Money; daysLeft: number };
  waterfall: Array<{ key: string; label: string; figure: Figure }>;
  funnel: { stages: Array<{ key: string; label: string; figure: Figure }> };
  feed: Array<{ at: string; kind: string; text: string; decisionId?: string }>;
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
  | "channel_add";

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
    | "set_geo_exclusions";
  from?: unknown;
  to: unknown;
}

export interface DecisionView {
  id: string;
  kind: DecisionKind;
  source: { engine: string; refId?: string };
  title: string;
  summary: string;
  ops: EngineOpView[];
  impact?: { metric: "outcomes" | "cost_per_outcome"; low: number; high: number; confidence: number; horizonDays: number };
  council?: {
    strategist: { model: string; text: string };
    critic: { model: string; text: string };
    chair: { text: string };
    risk: { checks: Array<{ key: string; pass: boolean; detail: string }> };
  };
  tripwire?: { metric: string; op: "gt" | "lt"; threshold: number; checkBy: string; onTrip: "reverse" | "notify" };
  needsPerson: boolean;
  status: DecisionStatus;
  expiresAt?: string;
  decidedBy?: { via: "inapp" | "whatsapp"; at: string };
  createdAt: string;
}

export interface DecisionsResponse {
  decisions: DecisionView[];
}

export type DecisionAction = "approve" | "hold" | "reject" | "undo";

// -- Channels (H3) -----------------------------------------------------------------------

export interface ChannelsResponse {
  health: Array<{
    platform: AdPlatform;
    state: "healthy" | "watch" | "problem" | "not_connected";
    reason?: string;
    spend: Money;
    outcomes: Figure;
    efficiency: Figure;
  }>;
  /** Spend against outcomes per channel, for the bubble chart. */
  bubbles: Array<{ platform: AdPlatform; spend: Money; outcomes: Figure; efficiency: Figure }>;
  shareByWeek: Array<{ weekStart: string; shares: Array<{ platform: AdPlatform; share: Figure }> }>;
  pacing: { spentThisMonth: Money; monthlyCeiling: Money; daysLeft: number };
  campaigns: Array<{
    id: string;
    platform: AdPlatform;
    name: string;
    status: string;
    dailyBudget: Money;
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
  }>;
}

// -- Onboarding (H5, C6b) -----------------------------------------------------------------

export interface FirstRunPlanResponse {
  mandate: Omit<MandateView, "confirmation" | "autonomy" | "approvers"> & { autonomyLevel: AutonomyLevel };
  channels: Array<{ platform: AdPlatform; role: "lead" | "test" | "not_now"; monthlyShare: Figure; reason: string }>;
  expectedOutcomes: { low: Figure; high: Figure };
}

export interface OnboardingConfirmResponse {
  /** The signed link has been sent; the mandate is written only after its OTP. */
  linkSent: boolean;
  via: "signed_link_otp";
}

// -- The client ----------------------------------------------------------------------------

const BASE = "/v1/growth/v2";

export const growthV2Api = {
  home: () => api.get<HomeResponse>(`${BASE}/home`),
  decisions: (status?: DecisionStatus) =>
    api.get<DecisionsResponse>(`${BASE}/decisions${status ? `?status=${status}` : ""}`),
  decide: (id: string, action: DecisionAction) =>
    api.post<unknown>(`${BASE}/decisions/${encodeURIComponent(id)}/${action}`),
  channels: () => api.get<ChannelsResponse>(`${BASE}/channels`),
  learning: () => api.get<LearningResponse>(`${BASE}/learning`),
  rules: () => api.get<RulesResponse>(`${BASE}/rules`),
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

/** Sample series the home charts draw. The api's `HomeResponse` carries none, so live data has none. */
export interface HomeScreenData extends V2Result<HomeResponse> {
  series?: HomeSeries;
  pacingSeries?: PacingSeries;
}

export function useGrowthV2Home() {
  const { business } = useAuth();
  return useQuery<HomeScreenData>({
    queryKey: key(business?._id, "home"),
    queryFn: async () => {
      const r = await loadOrPreview(growthV2Api.home, () => FIXTURE_HOME);
      return r.preview ? { ...r, series: FIXTURE_HOME_SERIES, pacingSeries: FIXTURE_PACING_SERIES } : r;
    },
    enabled: !!business?._id,
    staleTime: 30_000,
  });
}

export function useGrowthV2Decisions() {
  const { business } = useAuth();
  return useQuery<V2Result<DecisionsResponse>>({
    queryKey: key(business?._id, "decisions"),
    queryFn: () => loadOrPreview(() => growthV2Api.decisions(), () => FIXTURE_DECISIONS),
    enabled: !!business?._id,
    staleTime: 15_000,
  });
}

export interface ChannelsScreenData extends V2Result<ChannelsResponse> {
  pacingSeries?: PacingSeries;
}

export function useGrowthV2Channels() {
  const { business } = useAuth();
  return useQuery<ChannelsScreenData>({
    queryKey: key(business?._id, "channels"),
    queryFn: async () => {
      const r = await loadOrPreview(growthV2Api.channels, () => FIXTURE_CHANNELS);
      return r.preview ? { ...r, pacingSeries: FIXTURE_PACING_SERIES } : r;
    },
    enabled: !!business?._id,
    staleTime: 30_000,
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
  });
}

/**
 * First-run has no read route: `onboarding/draft` is a POST that H5 builds. Until
 * then the screen shows the prototype's plan, as a preview.
 */
export function useGrowthV2FirstRun() {
  return { data: FIXTURE_FIRST_RUN, preview: true as const };
}

/**
 * Approve, hold, reject or undo a decision. C5 builds the route; until then it
 * answers 501 and the mutation fails with that error, which the screen shows.
 * The Decisions screen never calls this on a preview sample.
 */
export function useDecideV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: DecisionAction }) => growthV2Api.decide(v.id, v.action),
    // Every Growth v2 screen reads the decision queue's effects, so refetch them all.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth-v2"] }),
  });
}
