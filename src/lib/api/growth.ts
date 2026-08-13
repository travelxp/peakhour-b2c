import { api } from "@/lib/api";
import type { AdvertisingDeclaration } from "@/lib/ads-copy";

/**
 * Growth-engine client (G3) — the channel-common /v1/growth surface.
 *
 * Weekly optimizer runs land as `opt_adjustments` rows: at most 3
 * SMALL, CONSERVATIVE proposals per week, each with evidence, expected
 * effect, and a rollback condition. Humans decide here (autonomy
 * L0/L1); only an approved budget_resplit ever touches the platform,
 * behind the api's no-increase-without-envelope guard. Nothing on this
 * surface can create campaigns or start spend.
 */

export type ProposalType =
  | "hook_weighting"
  | "posting_cadence"
  | "budget_resplit"
  | "boost_threshold"
  | "audience_emphasis";

export type ProposalStatus = "proposed" | "approved" | "dismissed" | "applied" | "failed";

/** Decision outcomes the decide endpoint reports. `retryable` = the
 *  apply failed for a FIXABLE reason and the proposal was reverted to
 *  `proposed` — fix the cause (reconnect / envelope) and decide again. */
export type DecisionStatus = "approved" | "dismissed" | "applied" | "failed" | "retryable";

/**
 * Outcomes (v1).
 *
 * ★THE ABSENCES ARE TYPED, WHICH IS THE WHOLE POINT OF THIS SHAPE. `paid: null`
 * is "this business has no paid channel", not "zero"; `conversions.configured:
 * false` carries a REASON and no count, so no client can render a business
 * nobody has ever counted a win for as one that had none. Those are different
 * facts and only one of them is a verdict on the customer's marketing.
 */
export interface OutcomesResponse {
  period: { days: number; since: string; until: string };
  reach: {
    organic: {
      impressions: number;
      posts: number;
      byPlatform: Array<{ platform: string; impressions: number; posts: number }>;
    };
    paid: { impressions: number; campaigns: number; spend: number; currency?: string } | null;
    site: {
      sessions: number;
      users: number;
      /** Null on a first period AND on stale data — a comparison computed
       *  across a sync that stopped is the most confident wrong number a
       *  dashboard can produce. */
      sessionsDeltaPct: number | null;
      dataThrough: string | null;
      stale: boolean;
    } | null;
  };
  attention: {
    organic: { engagements: number; clicks: number; ratePct: number | null };
    paid: { clicks: number; ctrPct: number | null } | null;
  };
  conversions:
    | {
        configured: true;
        count: number;
        source: "analytics" | "inbox";
        /** What the customer calls it. Present only once they've chosen — the
         *  page says "wins" until then, because naming it for them is how a
         *  headline ends up reading "23 generate_lead this week". */
        label?: string;
        costPer: number | null;
        currency?: string;
      }
    | { configured: false; reason: "not_connected" | "no_key_event"; message: string };
  headline: string;
  movements: Array<{ direction: "up" | "down" | "flat"; text: string }>;
  nextActions: Array<{
    id: string;
    severity: "critical" | "attention" | "opportunity";
    title: string;
    detail: string;
    href?: string;
    cta?: string;
  }>;
}

/** What a business counts as a win. Absent until they've chosen — and absence
 *  is never rendered as a zero. */
export interface WinDefinition {
  source: "analytics_key_event" | "inbox_lead";
  eventName?: string;
  label: string;
  setAt?: string;
}

/**
 * The choices on offer, and only ones we can genuinely count.
 *
 * ★`keyEvents.available: false` IS NOT AN EMPTY LIST. "We asked your property
 * and it has none" and "we couldn't ask" are different sentences, and the
 * `reason` says which — a screen that collapsed them would tell somebody to go
 * and create a key event they may already have.
 */
export interface WinOptionsResponse {
  current: WinDefinition | null;
  keyEvents: {
    available: boolean;
    reason?: "not_connected" | "no_property" | "lookup_failed";
    events: Array<{ eventName: string; custom: boolean }>;
  };
  inbox: { available: boolean };
}

export interface GrowthSettings {
  /** What this business counts as a win, if anything. Read from here rather
   *  than from `winOptions()` wherever a surface only needs to know WHETHER one
   *  is set — this comes off a Mongo projection, while `winOptions()` refreshes
   *  an OAuth token and calls Google's Admin API. */
  winDefinition?: WinDefinition;
  optimizerEnabled?: boolean;
  autonomyLevel?: number;
  weeklyBudgetEnvelope?: number;
  /** The business's one-time political-advertising declaration, with
   *  provenance. Absent means nobody has declared — the single reading of
   *  absence, which is why withdrawing UNSETS it rather than storing
   *  NOT_DECLARED. */
  advertisingDeclaration?: AdvertisingDeclaration;
}

/**
 * The settings envelope. `currentNoticeVersion` and `declaredByName` are
 * read-only siblings of `settings`, not part of the stored record:
 *   - `currentNoticeVersion` is the wording in force RIGHT NOW. The UI
 *     compares it with the declaration's own version to tell "declared" from
 *     "needs re-confirming". Never hardcode a copy — it would drift from the
 *     api's CURRENT_NOTICE_VERSION and mis-state every business's status.
 *   - `declaredByName` is resolved server-side from declaredByUserId, because
 *     an ObjectId is not an attribution a human recognises. Absent when there
 *     is no declaration or the declaring user is gone.
 * Both GET and PATCH return this shape, so the card renders identically from
 * either without waiting for a refetch.
 */
export interface GrowthSettingsResponse {
  settings: GrowthSettings;
  currentNoticeVersion?: string;
  declaredByName?: string;
}

export interface OptimizerProposal {
  id: string;
  type: ProposalType;
  summary: string;
  evidence: string[];
  expectedEffect: string;
  rollbackCondition: string;
  autoApplicable: boolean;
  params?: Record<string, unknown>;
  status: ProposalStatus;
  decidedAt?: string;
  appliedAt?: string;
  failReason?: string;
}

export interface OptimizerRun {
  _id: string;
  platform: string;
  weekStart: string;
  proposals: OptimizerProposal[];
  noAdjustmentReason?: string;
  inputsDigest?: { organicPosts: number; campaignsAnalysed: number; windowDays: number };
  createdAt: string;
}

export type RunNowResult =
  | { created: false; reason: "already_ran" | "optimizer_disabled" | "no_data" }
  | { created: true; runId: string; proposalCount: number };


// ── The Ask — lead capture, channel-neutral ───────────────────────────────

/**
 * ★NO LINKEDIN VOCABULARY IN THE DEFINITION HALF, deliberately. `identity`,
 * `adButton` and `thankYou.ctaLabel` are ours; the api's adapter maps them to
 * LinkedIn's own enums. The same Ask renders to WhatsApp and site forms later,
 * and this type must not have to change when it does.
 */
export type AskIdentity =
  | "first_name" | "last_name" | "email" | "work_email" | "phone" | "work_phone"
  | "job_title" | "job_function" | "seniority" | "company_name" | "company_size"
  | "industry" | "city" | "state" | "country" | "postal_code"
  | "linkedin_profile" | "degree" | "field_of_study" | "school" | "gender" | "custom";

/** Which downstream consumer justifies asking. A question that fits none of
 *  these does not belong on the form — the discipline the whole surface is
 *  built around. */
export type AskQuestionPurpose = "contact" | "qualify" | "route" | "context";

export type AskIntent =
  | "demo_request" | "consultation" | "newsletter"
  | "event_registration" | "recruitment" | "b2b_lead" | "custom";

export interface AskQuestion {
  key: string;
  prompt: string;
  hint?: string;
  identity: AskIdentity;
  kind: "text" | "choice";
  options?: string[];
  required: boolean;
  purpose: AskQuestionPurpose;
  /** One sentence the business owner would agree with. Shown beside the
   *  question so the subtraction argument is visible, not merely claimed. */
  whyAsked: string;
  workEmailOnly?: boolean;
}

export interface Ask {
  _id: string;
  name: string;
  intent: AskIntent;
  status: "draft" | "published" | "archived";
  locale: { country: string; language: string };
  adButton: string;
  content: {
    headline: string;
    description?: string;
    questions: AskQuestion[];
    consents?: Array<{ key: string; text: string; required: boolean }>;
    privacyPolicyUrl?: string;
    legalDisclaimer?: string;
    thankYou: {
      message: string;
      ctaLabel: string;
      ctaUrl?: string;
      ctaKind?: "url" | "whatsapp";
    };
  };
  channels?: {
    linkedin?: {
      formId: string;
      formUrn: string;
      adAccountId: string;
      state: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      reviewStatus?: string;
      rejectionReasons?: string[];
      checkedAt?: string;
      /**
       * ★WHETHER THE LEADS ARRIVE, which is a different fact from the form
       * being live and used to exist only as a toast. `blocked` means the Lead
       * Sync permission has not been granted: the form collects on LinkedIn
       * and nothing reaches the Inbox. Absent means nobody has established it
       * either way — a third state, not a green one.
       */
      leadDelivery?: {
        status: "created" | "existing" | "blocked" | "unknown";
        reason?: string;
        checkedAt?: string;
      };
    };
  };
  design?: { rationale?: string; editedByHuman?: boolean };
  /**
   * ★SERVED BY THE API, NOT DERIVED HERE. A rejected form leaves the campaign
   * active and the budget intact while nothing delivers, so "is it actually
   * working" has to read the same in every surface. Absent until the Ask has
   * been published to a channel.
   */
  serving?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * What happened to lead DELIVERY, which is a different question from whether
 * the form exists.
 *
 * `blocked` means LinkedIn has not granted the Lead Sync permission: the form
 * is live and will collect leads on LinkedIn, and none of them will reach the
 * Inbox. Saying "published ✓" over that state is the thing this field exists
 * to prevent.
 */
export type LeadDelivery =
  | { status: "created" | "existing"; subscriptionId: string }
  | { status: "blocked" | "unknown"; reason: string };

export const growthApi = {
  /** Recent weekly optimizer runs (newest first, up to 12). */
  adjustments: () => api.get<{ runs: OptimizerRun[] }>("/v1/growth/adjustments"),

  /** Run the optimizer now for the active business. Idempotent per ISO
   *  week; typed no-op reasons (already_ran / optimizer_disabled /
   *  no_data) come back as 200s, not errors. */
  runNow: () => api.post<RunNowResult>("/v1/growth/adjustments/run"),

  /** Human decision on one proposal. Approving a budget_resplit also
   *  attempts the guarded platform apply — the response's status says
   *  what ACTUALLY happened (approved / applied / failed / retryable).
   *  Reauth failures arrive as 409 NEEDS_REAUTH instead, and a platform
   *  refusing OUR APP on the ad account as 403 AD_ACCOUNT_NOT_AUTHORIZED.
   *
   *  `notAuthorized` is the same condition arriving on a 200 `retryable`
   *  from an api deployment that predates that code — the board uses it to
   *  suppress its "fix that and approve again" copy, which is wrong for a
   *  refusal no user action can clear. */
  decide: (runId: string, proposalId: string, decision: "approve" | "dismiss") =>
    api.post<{
      ok: true;
      status: DecisionStatus;
      failReason?: string;
      notAuthorized?: boolean;
    }>(
      `/v1/growth/adjustments/${runId}/proposals/${proposalId}/${decision}`,
    ),

  /**
   * What happened, what it means, and what to do next (Outcomes v1).
   *
   * ★DETERMINISTIC AND FREE. Every figure is read off rows the platform already
   * holds — no model call in the path, so no per-view cost and no chance of a
   * sentence that disagrees with the number beside it.
   *
   * ★AND IT SPEAKS BEFORE ANY MONEY IS SPENT. `reach.paid` is null rather than
   * a block of zeros until a campaign has actually served; organic reach and
   * site traffic carry the page until then, which is the state a business is in
   * for its first months.
   */
  outcomes: (days = 28) => api.get<OutcomesResponse>(`/v1/growth/outcomes?days=${days}`),

  /** What this business could count as a win, and what it currently does. */
  winOptions: () => api.get<WinOptionsResponse>("/v1/growth/win-options"),

  /** Per-business growth settings (the optimizer opt-in and the advertising
   *  declaration live here), plus the notice version in force. */
  settings: () => api.get<GrowthSettingsResponse>("/v1/growth/settings"),

  /**
   * Self-serve optimizer opt-in / weekly budget envelope / advertising
   * declaration.
   *
   * `notPolitical: true` records the declaration with server-stamped
   * provenance (who, when, which wording); `false` WITHDRAWS it by unsetting
   * the record. The client cannot set declaredAt / declaredByUserId /
   * noticeVersion — the whole value of the field is that the server knows a
   * real person declared it at a known time under known wording.
   */
  updateSettings: (patch: {
    optimizerEnabled?: boolean;
    weeklyBudgetEnvelope?: number | null;
    notPolitical?: boolean;
    /** `null` clears it — and clearing is an unset server-side, so "nobody has
     *  chosen" stays the single reading of absence. */
    winDefinition?: {
      source: WinDefinition["source"];
      eventName?: string;
      label: string;
    } | null;
  }) => api.patch<GrowthSettingsResponse>("/v1/growth/settings", patch),

  // ── Asks ───────────────────────────────────────────────────────────────

  listAsks: (includeArchived = false) =>
    api.get<{ asks: Ask[] }>(
      `/v1/growth/asks${includeArchived ? "?includeArchived=true" : ""}`,
    ),

  /** Design a new Ask. Runs the designer; NOTHING reaches LinkedIn. */
  designAsk: (body: {
    intent: AskIntent;
    locale?: { country: string; language: string };
    offer?: string;
    followUp?: string;
  }) => api.post<{ ask: Ask }>("/v1/growth/asks", body),

  /**
   * Create the form on LinkedIn.
   *
   * ★THE ONE IRREVERSIBLE STEP ON THIS SURFACE, and not because it spends
   * anything — it cannot — but because LinkedIn freezes a published form's
   * questions. Changing the field list afterwards means a new form and a new
   * creative, so the UI asks before calling this.
   */
  publishAsk: (
    id: string,
    body: { whatsapp?: { phone: string; message: string }; ctaUrl?: string },
  ) => api.post<{ ask: Ask; leadDelivery: LeadDelivery }>(`/v1/growth/asks/${id}/publish`, body),

  /**
   * Edit the WORDING.
   *
   * ★THE QUESTIONS ARE NOT IN THIS PAYLOAD, and that is LinkedIn's rule rather
   * than a missing field: a live form's field list is frozen, so changing what
   * you ask means a new form. The server refuses it by name
   * (`QUESTIONS_FROZEN`) if a client ever tries.
   */
  editAsk: (
    id: string,
    body: {
      name?: string;
      headline?: string;
      description?: string;
      thankYouMessage?: string;
      legalDisclaimer?: string;
    },
  ) => api.patch<{ ask: Ask }>(`/v1/growth/asks/${id}`, body),

  /** Re-read the form from LinkedIn — the only way a rejection surfaces. */
  syncAsk: (id: string) => api.post<{ ask: Ask }>(`/v1/growth/asks/${id}/sync`),

  /** Stop the form collecting, on LinkedIn and here. */
  archiveAsk: (id: string) => api.post<{ ask: Ask }>(`/v1/growth/asks/${id}/archive`),
};
