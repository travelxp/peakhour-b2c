import { api } from "@/lib/api";
import type { AdvertisingDeclaration } from "@/lib/ads-copy";
import type { PageScopeMeta } from "@/lib/api/linkedin-ads";

/**
 * Growth-engine client (G3) — the channel-common /v1/growth surface that
 * survives Growth Engine v2: settings, win definition, guardrails, asks,
 * creatives review, the content ledger and measurement health. The v2 screens
 * (home, decisions, channels, learning, rules) are in `growth-v2.ts`.
 */


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

/**
 * D-05 — the merchant's guardrails (peakhour-mongodb mig 372), which the
 * growth engine obeys at every proposal, launch and spend act. Absent means no
 * rule of that kind. `timeZone` is stored WITH the windows it is read in, so a
 * window never moves when the business's derived zone changes.
 */
export interface Guardrails {
  /** Channels the engine may never propose, launch or spend on. */
  deniedChannels?: string[];
  /** D-05b (mig 445): the ONLY channels the engine may act on — never stored
   *  beside `deniedChannels`. A channel added to Peakhour later stays off. */
  allowedChannels?: string[];
  /** D-05b: the engine creates ads only from creatives a person approved.
   *  `true` or absent. */
  approvedAssetsOnly?: true;
  /** Words and names no ad may carry, stored normalised (lowercase, accents
   *  folded, punctuation as spaces); an "&" name is stored both ways. */
  blockedTerms?: string[];
  /** A daily "HH:MM"–"HH:MM" window, in `timeZone`, when no spend starts or
   *  rises. May wrap midnight. */
  quietHours?: { start: string; end: string };
  /** Calendar days ("YYYY-MM-DD", inclusive), in `timeZone`, likewise. */
  blackoutDates?: Array<{ from: string; to: string; label?: string }>;
  timeZone?: string;
  setAt?: string;
  setByUserId?: string;
}

/** The guardrails as `updateSettings` writes them — written whole. */
export interface GuardrailsPatch {
  deniedChannels?: string[];
  /** D-05b: sent only for an allow list (then `deniedChannels` is `[]`). */
  allowedChannels?: string[];
  /** D-05b: sent only when on (off stores nothing; an api without D-05b refuses the key). */
  approvedAssetsOnly?: true;
  blockedTerms?: string[];
  quietHours?: { start: string; end: string } | null;
  blackoutDates?: Array<{ from: string; to: string; label?: string }>;
  timeZone?: string;
}

export interface GrowthSettings {
  /** What this business counts as a win, if anything. Read from here rather
   *  than from `winOptions()` wherever a surface only needs to know WHETHER one
   *  is set — this comes off a Mongo projection, while `winOptions()` refreshes
   *  an OAuth token and calls Google's Admin API. */
  winDefinition?: WinDefinition;
  /** The business's one-time political-advertising declaration, with
   *  provenance. Absent means nobody has declared — the single reading of
   *  absence, which is why withdrawing UNSETS it rather than storing
   *  NOT_DECLARED. */
  advertisingDeclaration?: AdvertisingDeclaration;
  /** D-05: the merchant's guardrails, when any are set. */
  guardrails?: Guardrails;
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
  /**
   * ★★THE WORDING THE VERSION MEANS, SERVED RATHER THAN LOOKED UP.
   *
   * This file used to hold a `Record<version, string>` and resolve the text
   * locally. That made a notice bump a DEPLOY problem: the api would ship a
   * version we had no text for, the card would refuse to collect consent —
   * correctly, since it could not show what it would be stamping — and
   * nobody could declare until the client caught up. Shipping the client
   * first was worse: it sent a shape the api rejected.
   *
   * No merge order avoided that, which is the tell: it was never an
   * ordering problem, it was two copies of one string. The api owns it now.
   *
   * ⚠️STILL OPTIONAL, AND THE GUARD STILL MATTERS. An absent text must make
   * the card refuse, exactly as an unknown version used to — what changed is
   * that this can now only happen on a broken response instead of on every
   * ordinary bump.
   */
  /** ★TWO STRINGS — one per answer. See `ads-copy.ts`: a POLITICAL record
   *  stamped against *"I confirm this is not political advertising"* is a
   *  consent record whose wording asserts the opposite of what it records. */
  currentNoticeText?: { notPolitical?: string; political?: string };
  /**
   * Meta's special ad categories as a form: key + the label to render.
   *
   * ★SERVED FOR P-09'S REASON — five surfaces derived the rate card's copy
   * locally and all five were wrong. A local label map here would silently
   * stop offering any category the api adds.
   *
   * ⚠️Never contains ISSUES_ELECTIONS_POLITICS: it is the same fact as the
   * political declaration shown above it, derived server-side.
   */
  /**
   * ⚠️★★AND THE COST IS NOW PER OPTION, NOT A SIBLING STRING (M-17).
   *
   * `specialAdCategoryConsequence` is GONE. It served one sentence for all
   * five options — *"no lookalikes, no exclusions, no sub-city geo"* — and
   * Meta's restrictions guide names only HOUSING, EMPLOYMENT and
   * FINANCIAL_PRODUCTS_SERVICES. `ONLINE_GAMBLING_AND_GAMING` does not appear
   * on that page at all, so the shared sentence asserted a restriction with no
   * source beside a checkbox a merchant was about to tick.
   *
   * ⏸Pre-launch, so it is deleted rather than kept beside the new shape.
   */
  specialAdCategoryOptions?: Array<{
    key: string;
    label: string;
    consequence: string;
  }>;
  /**
   * Where Meta has stopped allowing political ads — SERVED, never derived.
   *
   * ⚠️★A READING, AND THE SPLIT IS THE PART THAT MATTERS. Meta says *"the EU
   * and associated territories"* and publishes no list, so the api holds the
   * EU 27 as a fact of EU law and the EEA three as an interpretation. A
   * country in NEITHER list is not cleared — the phrase has a residue nobody
   * has enumerated — and a local copy of these lists would state our
   * interpretation as fact in one more place (P-09).
   *
   * ⏸Absent on an api that predates M-17, which reads as *"we cannot tell
   * you"* rather than as *"nothing is banned"*. `euPoliticalAdsVerdict`
   * reports that with `known: false`.
   */
  euPoliticalAdsBan?: {
    bannedCountries?: string[];
    uncertainCountries?: string[];
    since?: string;
  };
  /**
   * The verdict on the declaration ALREADY ON RECORD, computed server-side.
   *
   * ★Absent when there is nothing to judge — a business with no political
   * declaration gets no key rather than an empty verdict, because
   * `{banned: [], uncertain: []}` reads as a clearance for a question nobody
   * asked. Same rule the declaration itself follows.
   */
  politicalAdsRefused?: { banned: string[]; uncertain: string[] };
  declaredByName?: string;
}

// ── The Ask — lead capture, channel-neutral ───────────────────────────────

/**
 * ★NO LINKEDIN VOCABULARY IN THE DEFINITION HALF, deliberately. `identity`,
 * `adButton` and `thankYou.ctaLabel` are ours; the api's adapter maps them to
 * LinkedIn's own enums. The same Ask renders to WhatsApp and site forms later,
 * and this type must not have to change when it does.
 */
export type AskIdentity =
  | "first_name"
  | "last_name"
  | "email"
  | "work_email"
  | "phone"
  | "work_phone"
  | "job_title"
  | "job_function"
  | "seniority"
  | "company_name"
  | "company_size"
  | "industry"
  | "city"
  | "state"
  | "country"
  | "postal_code"
  | "linkedin_profile"
  | "degree"
  | "field_of_study"
  | "school"
  | "gender"
  | "custom";

/** Which downstream consumer justifies asking. A question that fits none of
 *  these does not belong on the form — the discipline the whole surface is
 *  built around. */
export type AskQuestionPurpose = "contact" | "qualify" | "route" | "context";

export type AskIntent =
  | "demo_request"
  | "consultation"
  | "newsletter"
  | "event_registration"
  | "recruitment"
  | "b2b_lead"
  | "custom";

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

// ── Content ledger ──────────────────────────────────────────────────────────
//
// ★★THE TWO HALVES OF A ROW MEASURE DIFFERENT THINGS, and the types keep them
// apart on purpose. SEARCH is a 28-day WINDOW that carries its own bounds;
// ANALYTICS is a SERIES summed from the publish date, carrying the first and
// last day actually present. Nothing on this response is scoped to
// `period` — that filters which PUBLICATIONS are listed and nothing else.

/** The latest per-URL search window for one published page. */
export type LedgerSearch =
  | {
      state: "measured";
      clicks: number;
      impressions: number;
      position?: number;
      /** The window's own bounds. NOT `period`. */
      windowStart: string;
      windowEnd: string;
      capturedAt?: string;
      /** False when the window opens before the page went live — the figures
       *  are still this page's, but "since you published" would be wrong. */
      coversFromPublish: boolean;
      trend?: {
        clicksChange: number;
        impressionsChange: number;
        fromWindowEnd: string;
      };
    }
  | { state: "unknown"; reason: "awaiting_sync" | "window_predates_publish" };

/** What one published page earned in analytics since it went live. */
export type LedgerAnalytics =
  | {
      state: "measured";
      views: number;
      conversions: number;
      /** The first and last day actually present — not the window asked for. */
      coveredSince: string;
      coveredUntil: string;
      /** Days PRESENT, not days spanned: the gap is how a surface knows the
       *  total is a floor. */
      daysCovered: number;
    }
  | {
      state: "unknown";
      reason: "not_connected" | "no_page_rows" | "no_path" | "ambiguous_path";
    };

/** The Search Console suggestion a page was written for, when one was recorded. */
export interface LedgerSuggestion {
  actionKey: string;
  type: string;
  query: string;
  url?: string;
  adoptedAt?: string;
  /** ⚠️ALL THREE ARE ABOUT THE SEARCH TERM, not about the page — the `search`
   *  block on the same row is the page's total across every query it ranks
   *  for. The nesting is what stops the two being subtracted. */
  forQuery: {
    estMonthlyClicks: number;
    clicksAtAdoption: number;
    positionAtAdoption: number;
  };
}

export interface LedgerRow {
  url: string;
  title?: string;
  channel: string;
  sourceType: string;
  publishedAt: string;
  daysLive: number;
  suggestion?: LedgerSuggestion;
  search: LedgerSearch;
  analytics: LedgerAnalytics;
}

export interface LedgerSummary {
  /** Publications IN THIS RESPONSE, not the business's total. */
  pagesInView: number;
  search:
    | {
        state: "measured";
        clicks: number;
        impressions: number;
        windowStart: string;
        windowEnd: string;
        pagesMeasured: number;
      }
    | {
        state: "unavailable";
        /** `mixed_windows` — the measured pages were last synced against
         *  DIFFERENT windows, so a sum of their clicks describes no period at
         *  all. Withheld, exactly as `mixed_currency` is for money. */
        reason: "no_measured_pages" | "mixed_windows";
        pagesMeasured: number;
      };
  analytics:
    | {
        state: "measured";
        views: number;
        conversions: number;
        pagesMeasured: number;
      }
    | {
        state: "unavailable";
        reason: "no_measured_pages";
        pagesMeasured: number;
      };
}

export interface ContentLedgerResponse {
  period: { days: number; since: string; until: string };
  /** The oldest stamp the business carries, or null when nothing is stamped.
   *  NOT `period.since` — the gap between them is work done before anything
   *  recorded who published it. */
  stampedFrom: string | null;
  rows: LedgerRow[];
  summary: LedgerSummary;
  truncated: boolean;
}

/**
 * One measurement check, exactly as the api decided it.
 *
 * ★★THREE STATES, AND THE THIRD IS A REAL ANSWER. `unmeasurable` is neither
 * `ok` nor `attention`: collapsed into the first it tells a business whose
 * analytics we cannot read that their analytics is healthy, and collapsed into
 * the second it invents a fault. Every judgement was made in the api; this side
 * chooses words and a link, and must never re-decide a state.
 *
 * ⏸`state` AND `id` ARE TYPED AS THE UNIONS WE KNOW PLUS A STRING, because the
 * api's sets grow independently of this deploy. A check this build has never
 * heard of still has a headline and a detail the api wrote, and showing those
 * with no fix beside them is strictly better than hiding a finding.
 */
export type HealthState = "ok" | "attention" | "unmeasurable";

export type HealthCheckId =
  | "unassigned_traffic"
  | "self_referral"
  | "hostname_agreement"
  | "key_event"
  | "listing_completeness";

export interface HealthCheck {
  id: HealthCheckId | (string & {});
  state: HealthState | (string & {});
  /** One sentence a shopkeeper can read. */
  headline: string;
  /** Why, and — on `attention` — what to do. */
  detail: string;
}

export interface HealthSummary {
  /** Checks we could actually run. NOT `checks.length`. */
  checked: number;
  attention: number;
  unmeasurable: number;
  headline: string;
}

export interface MeasurementHealthResponse {
  period: { days: number; since: string; until: string };
  summary: HealthSummary;
  checks: HealthCheck[];
}

export const growthApi = {
  /**
   * What we published, and what each page earned.
   *
   * ★`days` FILTERS BY PUBLICATION DATE AND NOTHING ELSE. Each page is then
   * measured over its whole life, because "what did this article earn" is a
   * question about the article, not about the last quarter. Every measurement
   * date on a row comes from that row's own data — the search window's own
   * bounds, the first and last analytics day actually present.
   */
  contentLedger: (days = 90, limit = 50) =>
    api.get<ContentLedgerResponse>(
      `/v1/growth/content-ledger?days=${days}&limit=${limit}`,
    ),

  /**
   * Can the numbers be believed?
   *
   * ★THE CHECK THAT QUALIFIES EVERY OTHER FIGURE IN THE PRODUCT. It makes three
   * live Google calls, so it is asked deliberately — on the page a merchant
   * lands on after connecting an account, not on every render.
   */
  measurementHealth: () =>
    api.get<MeasurementHealthResponse>("/v1/growth/measurement-health"),

  /** What this business could count as a win, and what it currently does. */
  winOptions: () => api.get<WinOptionsResponse>("/v1/growth/win-options"),

  /** Per-business growth settings (the advertising declaration, win
   *  definition and guardrails live here), plus the notice version in force. */
  settings: () => api.get<GrowthSettingsResponse>("/v1/growth/settings"),

  /**
   * Self-serve advertising declaration / win definition / guardrails. The
   * mandate (ceiling, autonomy, target) is v2's and is not written here: the api
   * answers 400 to the four fields it replaced.
   *
   * ⚠️★WAS A BOOLEAN `notPolitical`, AND THE BOOLEAN COULD NOT SAY THE THING
   * M-03 EXISTS FOR: that a merchant IS a political advertiser. `true` meant
   * declared-negative and `false` meant withdrawn, which left the affirmative
   * with no spelling at all. It is `politicalIntent` now — `"POLITICAL"`,
   * `"NOT_POLITICAL"`, or `null` to WITHDRAW by unsetting the record.
   *
   * The client still cannot set declaredAt / declaredByUserId /
   * noticeVersion — the whole value of the field is that the server knows a
   * real person declared it at a known time under known wording.
   *
   * ⚠️AND THE TWO HALVES TRAVEL TOGETHER. The api refuses
   * `specialAdCategories` without `politicalIntent` (DECLARATION_INCOMPLETE)
   * so a record cannot end up with halves consented to under different
   * wordings — and refuses an intent-only PATCH that would ERASE a stored
   * category answer, for the same reason in reverse.
   */
  updateSettings: (patch: {
    /**
     * ⚠️WAS `notPolitical?: boolean` (M-03). The boolean could only ever say
     * NOT_POLITICAL or withdraw, so nothing could record a business that IS a
     * political advertiser — and the Meta special ad category derived from it
     * could never fire. `null` withdraws, which is the unset the old `false`
     * performed.
     *
     * ★b2c does not OFFER "POLITICAL" — Peakhour does not support the
     * obligations it carries, which is why the declaration card renders that
     * state read-only. The type admits it because the api must be able to
     * represent a business support has recorded as one.
     */
    politicalIntent?: "POLITICAL" | "NOT_POLITICAL" | null;
    /**
     * Meta special ad categories the advertiser self-identifies.
     *
     * ★MUST BE SENT WITH `politicalIntent` — the api refuses categories on
     * their own (DECLARATION_INCOMPLETE), because the declaration is made
     * against one notice at one moment and cannot be assembled from separate
     * requests.
     *
     * ⚠️`[]` IS AN ANSWER ("asked, none apply"), not an omission. Meta has no
     * "not answered" value, so the api distinguishes it from absent.
     */
    specialAdCategories?: string[];
    /**
     * The countries the declaration covers (M-17).
     *
     * ⚠️★REQUIRED WITH `politicalIntent: "POLITICAL"`, and the api 400s without
     * it: Meta gives `ISSUES_ELECTIONS_POLITICS` no tax-country default, so a
     * political declaration naming no country could never produce a campaign.
     *
     * ⚠️★AND `[]` IS NOT AN ANSWER, WHICH INVERTS THE FIELD ABOVE. The api's
     * `.min(1)` refuses an empty list — there is no advertising in no
     * countries — so omit the field rather than sending `[]`.
     *
     * ⏸OMITTING IT ON A RECORD THAT HAS ONE IS AN ERASE, and the api refuses
     * that too. The card seeds the box from the stored value for exactly that
     * reason, the way it already does for the categories.
     */
    specialAdCategoryCountries?: string[];
    /** `null` clears it — and clearing is an unset server-side, so "nobody has
     *  chosen" stays the single reading of absence. */
    winDefinition?: {
      source: WinDefinition["source"];
      eventName?: string;
      label: string;
    } | null;
    /**
     * D-05: the guardrails, WRITTEN WHOLE — every rule the card shows, sent
     * together, replacing the stored record (empty lists store no key).
     * `null` clears them all. `timeZone` is optional: the api uses the
     * business's own zone when a window or a blackout is sent without one.
     */
    guardrails?: GuardrailsPatch | null;
  }) => api.patch<GrowthSettingsResponse>("/v1/growth/settings", patch),

  // ── Asks ───────────────────────────────────────────────────────────────

  /** Lead Gen Forms for the active Page's ad account.
   *
   *  Carries the scope it was resolved under (see `PageScopeMeta`): published
   *  forms belong to the ad account they were published into, so an unmapped
   *  Page withholds them rather than falling back to every brand's. Drafts
   *  always come through — they belong to no account yet. */
  listAsks: (includeArchived = false) =>
    api.get<{ asks: Ask[] } & Partial<PageScopeMeta>>(
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
  ) =>
    api.post<{ ask: Ask; leadDelivery: LeadDelivery }>(
      `/v1/growth/asks/${id}/publish`,
      body,
    ),

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
  archiveAsk: (id: string) =>
    api.post<{ ask: Ask }>(`/v1/growth/asks/${id}/archive`),

  // ── Creative review (D-05c) ────────────────────────────────────────────

  /** One page of the business's ad creatives, newest first, with a summary
   *  of the whole business (whatever the filter). */
  listCreatives: (q: { status?: readonly CreativeStatus[]; platform?: string; before?: string; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.status?.length) p.set("status", q.status.join(","));
    if (q.platform) p.set("platform", q.platform);
    if (q.before) p.set("before", q.before);
    if (q.limit) p.set("limit", String(q.limit));
    const qs = p.toString();
    return api.get<CreativesPage>(`/v1/growth/creatives${qs ? `?${qs}` : ""}`);
  },

  /** Approve the creative AS IT WAS SHOWN: `assetsHash` is the list's hash of the
   *  copy on screen, and copy changed since is a 409 CREATIVE_CHANGED. */
  approveCreative: (id: string, assetsHash: string) =>
    api.post<{ status: "approved" }>(`/v1/growth/creatives/${id}/approval`, { expectedAssetsHash: assetsHash }),

  /** Take an approval back; the creative returns to review (or draft if its check warned). */
  withdrawCreativeApproval: (id: string) =>
    api.delete<{ status: "review" | "draft" }>(`/v1/growth/creatives/${id}/approval`),
};

/** `ad_creatives.status` (peakhour-mongodb `zCreativeStatus`). */
export type CreativeStatus = "generating" | "draft" | "review" | "approved" | "deployed" | "paused" | "retired";

/**
 * D-05c — where a creative stands, AS THE ENGINE'S GATE READS IT (api
 * `creativeApprovalState`): `approved` = its approval still matches its copy;
 * `changed_since_approved` = edited after it was approved, so the engine no
 * longer uses it; `not_approved` = no approval in force.
 */
export type CreativeApprovalState = "approved" | "changed_since_approved" | "not_approved";

export interface CreativeReviewItem {
  id: string;
  platform: string;
  format: string | null;
  status: CreativeStatus;
  angle: string | null;
  landingUrl: string | null;
  headlines: string[];
  bodyTexts: string[];
  descriptions: string[];
  ctas: string[];
  imageBriefs: Array<{ prompt: string | null; imageUrl: string | null }>;
  videoUrl: string | null;
  preflight: { decision: "allow" | "warn" | "block"; summary: string | null } | null;
  rationale: string | null;
  retiredReason: string | null;
  approvalState: CreativeApprovalState;
  /** The hash of the copy shown; approving sends it back so unseen edits are refused. */
  assetsHash: string;
  /** Why no ad can use this creative, approved or not (api `creativeCoverageGap`). */
  coverageGap: "platform_unused" | "no_landing_page" | "no_headline" | null;
  approval: { at: string | null; byYou: boolean } | null;
  /** The api's own rule for what its approval writer accepts now. */
  canApprove: boolean;
  canWithdraw: boolean;
  createdAt: string | null;
}

/** The whole business's creatives, whatever the page's filter. */
export interface CreativesSummary {
  /** 0 = Peakhour has never generated a creative for this business. */
  total: number;
  /** Approved as they read now, and usable in an ad — what the engine may use. */
  inForce: number;
  /** `inForce` by platform: an approved creative covers ads on its own platform only. */
  inForceByPlatform: Record<string, number>;
  /** Approved as they read now, but no engine ad can carry them (their channel, or no landing page or headline). */
  approvedUnusable: number;
  /** A person could approve now, and an ad could then use. */
  approvable: number;
  /** Every never-approved creative (draft or review), usable or not: the "To review" tab. */
  awaitingReview: number;
  changedSinceApproved: number;
}

export interface CreativesPage {
  creatives: CreativeReviewItem[];
  nextCursor: string | null;
  /** The first page only (`before` absent); null on a continuation page. */
  summary: CreativesSummary | null;
}
