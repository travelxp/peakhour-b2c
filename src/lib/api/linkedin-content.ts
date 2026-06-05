import { api } from "@/lib/api";

export type LinkedInVisibility = "PUBLIC" | "CONNECTIONS" | "LOGGED_IN";

export type LinkedInAuthor =
  | { type: "person" }
  | { type: "org"; pageId: string };

/** How long a LinkedIn poll accepts votes. */
export type LinkedInPollDuration = "ONE_DAY" | "THREE_DAYS" | "SEVEN_DAYS" | "FOURTEEN_DAYS";

/** Native LinkedIn poll (CMA D5). 2–4 options; question ≤140, options ≤30
 *  each. A poll is an exclusive content block (no link/images). */
export interface LinkedInPollInput {
  question: string;
  options: string[];
  duration: LinkedInPollDuration;
}

export interface PublishLinkedInPostInput {
  author: LinkedInAuthor;
  commentary: string;
  visibility?: LinkedInVisibility;
  link?: { url: string; title?: string; description?: string };
  imageUrns?: string[];
  /** Native poll content (CMA D5). Mutually exclusive with `link`/images;
   *  `commentary` still shows as the text above the poll. */
  poll?: LinkedInPollInput;
  /** Optional cnt_ideas pointer — wires the post into the source-usage
   *  audit pipeline so retrieved-source citations + claim extraction
   *  fire when this LinkedIn post ships. Omit for ad-hoc posts. */
  ideaId?: string;
}

export interface LinkedInOrgPage {
  id: string;
  name: string;
  role: string;
}

export interface LinkedInIdentity {
  /** Connection lifecycle status — anything other than `active` means
   *  the caller should render a Reconnect CTA / banner, not treat
   *  this as "no LinkedIn". `needs_reauth` covers the case where
   *  tokens still refresh but the stored scopes no longer cover what
   *  the current provider config requires (refresh-token flow can't
   *  upgrade scopes). */
  status: "active" | "disconnected" | "expired" | "error" | "needs_reauth";
  /** Granted scopes from the last consent. Use to gate features —
   *  e.g. hide org-page authoring when `w_organization_social` is missing. */
  scopes: string[];
  person: {
    urn: string;
    name: string | null;
    avatarUrl?: string;
    email?: string;
  };
  pages: LinkedInOrgPage[];
}

/** Hook DNA score. Tier badge:
 *    "rules"    — Tier C floor (deterministic craft rules only)
 *    "industry" — Tier B blend (Tier C + cosine to industry archetype centroid)
 *    "personal" — Tier A blend (Tier C + cosine to per-business archetype; future)
 *  The composer surfaces the tier so users see when they're
 *  getting the floor vs personalised tiers. */
export interface HookScore {
  score: number;
  tier: "rules" | "industry" | "personal";
  breakdown: {
    length: number;
    opener: number;
    specificData: number;
    audienceNoun: number;
    activeVoice: number;
    rhythm: number;
  };
  signals: {
    wordCount: number;
    visibleChars: number;
    opener: "number" | "question" | "contrarian" | "named_entity" | "generic";
    hasSpecificNumber: boolean;
    hasAudienceNoun: boolean;
    isActiveOpening: boolean;
    firstLineChars: number;
  };
  suggestions: string[];
  /** Archetype match diagnostic — populated when Tier B / A fires.
   *  Surface in the composer hover so curious users can see
   *  "matched bfsi_india archetype, cosine 0.78 across 142 examples". */
  archetypeMatch?: {
    archetypeId: string;
    cohortId: string;
    cosineSimilarity: number;
    archetypeScore: number;
    exampleCount: number;
  };
}

/** Hook rewrite variant — matches `rewrite_hook_variants` skill output.
 *  `score` is the same Hook DNA scale as `HookScore.score`. `technique`
 *  is a short label the API returns describing the rewrite approach
 *  (data-led, contrarian, named decision-maker, etc.). */
export interface HookVariant {
  hook: string;
  score: number;
  technique: string;
}

export interface RewriteHookResponse {
  /** Echo of the input + its score, so the variant panel can show
   *  "your hook scored X" without a separate score-hook roundtrip. */
  original: { hook: string; score: number };
  /** Variants ranked best-first. May be shorter than the requested
   *  `count` if the AI returned near-duplicates that got deduped. */
  variants: HookVariant[];
}

/**
 * LinkedIn voice card surfaced to the composer. Narrow shape served by
 * `GET /v1/linkedin/content/voice-card` — audit fields + internal signals
 * stripped server-side; this is exactly what the panel needs.
 */
export interface LinkedInVoiceCard {
  voice: {
    perspective: "first_person_singular" | "first_person_plural" | "third_person";
    tone: string[];
    formality: number;
    complexity: number;
    sentenceLength: "short" | "medium" | "long" | "mixed_short_and_medium" | "mixed";
    paragraphLength: "short" | "medium" | "long";
    usesRhetoricalQuestions: boolean;
    usesAnecdotes: boolean;
    usesData: boolean;
    dataStyle?: string;
    signaturePhrases: string[];
    avoidPhrases: string[];
    neverDoes: string[];
  };
  structure: {
    openingStyle: string;
    usesSubheadings: boolean;
    subheadingStyle?: string;
    closingStyle: string;
    hasTLDR: boolean;
    hasRecurringSection: boolean;
    recurringSectionName?: string;
    averageWordCount: number;
    wordCountRange: [number, number];
  };
  content: {
    niche: string;
    audience: string;
    audienceSophistication: "beginner" | "intermediate" | "expert";
    primaryAngle: string;
    primaryContentType: string;
    avoidTopics: string[];
  };
  version: number;
  /** Sample size the synthesis was generated from. Use as the "trained on N posts" signal. */
  generatedFrom: number;
  lastGeneratedAt: string;
}

/**
 * Audience Quality Score (AQS) result for one engager.
 * Tier badge:
 *   "rules"    — Tier C floor (frequency + recency + reactions; deterministic)
 *   "enriched" — Tier B (Tier C + LinkedIn People Search enrichment;
 *                 job title × seniority × ICP match; future)
 * Today every engager comes back tier:"rules". The panel renders the
 * badge so users see when the score is the deterministic floor vs the
 * enriched tier.
 */
export interface EngagerScore {
  actorUrn: string;
  actorType: "person" | "org";
  score: number;
  tier: "rules" | "enriched";
  breakdown: {
    frequency: number;
    recency: number;
    reactions: number;
  };
  signals: {
    commentCount: number;
    topLevelCount: number;
    totalReactions: number;
    daysSinceLastComment: number;
    lastCommentedAt: string;
    firstCommentedAt: string;
    lastCommentText: string;
    lastParentPostUrn: string;
  };
}

export interface EngagersResponse {
  engagers: EngagerScore[];
  /** Sum of commentCount across returned engagers — feeds the panel
   *  header's "N comments across M people" line. */
  totalComments: number;
  /** = engagers.length, surfaced so the UI doesn't recompute. */
  distinctActors: number;
  /** Echo of the lookback window the server actually used (after
   *  clamping the ?days query param). */
  lookbackDays: number;
}

/** Shared TanStack Query cache key for the LinkedIn suggested-drafts
 *  surface. Producer: `onboarding/launch/page.tsx` writes the
 *  generate-from-profile response via `queryClient.setQueryData`.
 *  Consumer: `SuggestedDraftsPanel` on the LinkedIn dashboard reads
 *  from the same key. Lives in the api-client module so both
 *  consumers reach a neutral location (not a Next.js `_components`
 *  private folder). */
export const SUGGESTED_DRAFTS_QUERY_KEY = ["linkedin-suggested-drafts"] as const;

/** One per-category finding from the content-policy classifier. */
export interface PolicyFinding {
  category: string;
  verdict: "ok" | "warn" | "block";
  /** One-sentence rationale; empty for "ok". */
  rationale: string;
}

/**
 * Advisory result from `POST /v1/linkedin/content/check-policy` — the
 * proactive, pre-publish content-policy heads-up the composer chip
 * renders. The hard publish-time block still runs server-side on
 * publish; this is advisory only.
 *
 * `overall` is the RAW AI verdict (not the gate's mode-mapped
 * decision) so warn-level issues surface even though the default
 * publish posture would let them through. `checked` is false when the
 * AI gate soft-failed — the chip should render a neutral "couldn't
 * check" state, never a false "Policy: OK".
 */
export interface ComposerPolicyAdvisory {
  overall: "ok" | "warn" | "block";
  summary: string;
  findings: PolicyFinding[];
  issueCount: number;
  checked: boolean;
}

export const linkedInContentApi = {
  me: () => api.get<LinkedInIdentity>("/v1/linkedin/content/me"),

  /** Advisory content-policy pre-check for the composer chip. The route
   *  is rate-limited (429 on burst) and fail-soft, so callers should
   *  treat both a 429 and a thrown error as a transient "couldn't
   *  check" state — never surface it as a publish failure. */
  checkPolicy: (text: string, authorType?: "person" | "org") =>
    api.post<ComposerPolicyAdvisory>("/v1/linkedin/content/check-policy", {
      text,
      ...(authorType ? { authorType } : {}),
    }),

  publish: (body: PublishLinkedInPostInput) =>
    api.post<{ postId: string }>("/v1/linkedin/content/publish", body),

  scoreHook: (hook: string) =>
    api.post<HookScore>("/v1/linkedin/content/score-hook", { hook }),

  rewriteHook: (hook: string, count?: number) =>
    api.post<RewriteHookResponse>(
      "/v1/linkedin/content/rewrite-hook",
      count !== undefined ? { hook, count } : { hook },
    ),

  /** Fetch the auto-synthesised LinkedIn voice card. ApiError with
   *  `code: "NOT_FOUND"` (404) means "no card yet" — caller should
   *  render an empty state, not surface an error. */
  voiceCard: () =>
    api.get<LinkedInVoiceCard>("/v1/linkedin/content/voice-card"),

  /** AQS-ranked recent engagers for the active business. Server returns
   *  an empty `engagers` array (not 404) when no comments have been
   *  ingested yet, so the panel renders an empty state instead of an
   *  error. Omitting the params (or passing 0 / negative values) lets
   *  the server fall back to its own defaults (days=90, limit=25);
   *  only positive values are serialised. */
  engagers: (params?: { days?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (typeof params?.days === "number" && params.days > 0) {
      qs.set("days", String(params.days));
    }
    if (typeof params?.limit === "number" && params.limit > 0) {
      qs.set("limit", String(params.limit));
    }
    const q = qs.toString();
    return api.get<EngagersResponse>(
      `/v1/linkedin/content/engagers${q ? `?${q}` : ""}`,
    );
  },

  /** Generate N initial LinkedIn post drafts grounded in the active
   *  business's profile + voice card + cohort archetype. Persists each
   *  as a cnt_drafts row server-side and returns them in the response.
   *  Designed to fire once on onboarding completion (and on-demand
   *  from a "generate more" button later). Server clamps count to
   *  [1, 10]; defaults to 5 when omitted. */
  generateFromProfile: (count?: number) =>
    api.post<GenerateFromProfileResponse>(
      "/v1/linkedin/content/generate-from-profile",
      count !== undefined ? { count } : {},
    ),

  /** Boost-this-post candidates. Read-only ranking of the business's
   *  recently-published posts by boost-worthiness (velocity + audience
   *  quality + Hook DNA + freshness). Server returns an empty
   *  candidates array (not 404) when no eligible posts exist; the
   *  panel renders an empty state. Default limit 10, max 25 server-side. */
  boostCandidates: (params?: { limit?: number }) => {
    const qs = new URLSearchParams();
    if (typeof params?.limit === "number" && params.limit > 0) {
      qs.set("limit", String(params.limit));
    }
    const q = qs.toString();
    return api.get<BoostCandidatesResponse>(
      `/v1/linkedin/content/boost-candidates${q ? `?${q}` : ""}`,
    );
  },

  /** The user's own PUBLISHED LinkedIn posts (personal + org), newest
   *  first, read from soc_linkedin_posts (the post-sync cron's output).
   *  Keyset pagination: pass the previous response's `nextCursor`. Server
   *  returns an empty array (not 404) when nothing's been synced yet, so
   *  the Feed tab renders an empty state. limit clamped ≤50 server-side. */
  feed: (params?: { limit?: number; cursor?: string; authorType?: "person" | "org" }) => {
    const qs = new URLSearchParams();
    if (typeof params?.limit === "number" && params.limit > 0) {
      qs.set("limit", String(params.limit));
    }
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.authorType) qs.set("authorType", params.authorType);
    const q = qs.toString();
    return api.get<LinkedInFeedResponse>(
      `/v1/linkedin/content/feed${q ? `?${q}` : ""}`,
    );
  },

  /**
   * Add a comment on a post as the member or an org page. `postUrn` is the
   * full `urn:li:share:*` / `urn:li:ugcPost:*`. Throws an ApiError with
   * `code: "RECONNECT_REQUIRED"` (403) when LinkedIn requires the engagement
   * (`_feed`) scopes the connection lacks — callers should surface a Reconnect
   * CTA rather than a generic failure.
   */
  createComment: (postUrn: string, body: CreateCommentInput) =>
    api.post<{ commentUrn: string }>(
      `/v1/linkedin/content/posts/${encodeURIComponent(postUrn)}/comments`,
      body,
    ),

  /**
   * Repurpose a piece of long-form text into a LinkedIn document "carousel"
   * (PDF, one AI-rendered slide per section). LONG-RUNNING — the server
   * generates an image per slide, so a 5-slide carousel can take 30–60s; the
   * caller should show a patient pending state. `newsletterText` must be ≥50
   * chars. Returns the published post id + slide/document metadata.
   */
  /**
   * STEP 1 of the carousel flow: generate the carousel PDF and stash it as a
   * temp object — does NOT publish, and makes no LinkedIn call (so a revoked
   * token doesn't block previewing). LONG-RUNNING (~30–60s — a slide image per
   * section). Returns a `previewUrl` to render + the `previewKey` to pass to
   * `publishCarousel`.
   */
  previewCarousel: (body: CarouselPreviewInput) =>
    api.post<CarouselPreviewResult>(
      "/v1/linkedin/content/repurpose-newsletter-carousel/preview",
      body,
    ),

  /**
   * STEP 2: publish a previewed carousel to LinkedIn by its `previewKey`. The
   * server re-screens the (possibly edited) commentary, posts, and cleans up
   * the temp object. A 403 `RECONNECT_REQUIRED` / 400 `NOT_CONNECTED` means the
   * LinkedIn token needs a reconnect.
   */
  publishCarousel: (body: CarouselPublishInput) =>
    api.post<CarouselResult>(
      "/v1/linkedin/content/repurpose-newsletter-carousel/publish",
      body,
    ),
};

export interface CarouselPreviewInput {
  /** Long-form source to split into slides (≥50 chars). */
  newsletterText: string;
  newsletterDraftId?: string;
  newsletterTitle?: string;
  commentary?: string;
  count?: number;
}

export interface CarouselPreviewResult {
  /** Opaque key for the stored preview PDF — pass to publishCarousel. */
  previewKey: string;
  /** Public URL to render the preview PDF for review. */
  previewUrl: string;
  slideCount: number;
  imagesGenerated: number;
  /** Server-derived post text above the carousel (editable before publish). */
  commentary: string;
  title: string;
}

export interface CarouselPublishInput {
  author: LinkedInAuthor;
  previewKey: string;
  commentary?: string;
  title?: string;
  visibility?: LinkedInVisibility;
}

export interface CreateCommentInput {
  author: LinkedInAuthor;
  text: string;
  /** Composite parent comment URN — set to reply to a comment, not the post. */
  parentCommentUrn?: string;
}

export interface CarouselResult {
  postId: string;
  documentUrn: string;
  slideCount: number;
  imagesGenerated: number;
  /** False when the document upload didn't confirm AVAILABLE before posting
   *  (best-effort path) — the post may still be processing on LinkedIn. */
  documentAvailable: boolean;
}

/** One published post in the LinkedIn Feed tab (GET /feed). */
export interface LinkedInFeedPost {
  /** soc_linkedin_posts._id hex. */
  id: string;
  content: string;
  /** LinkedIn's own post id/urn (for a "View on LinkedIn" deep link);
   *  null on rows synced before the id was captured. */
  linkedInPostId: string | null;
  authorType: "person" | "org" | null;
  /** Raw author URN — distinguishes the specific person/page. */
  authorUrn: string | null;
  /** ISO publish time; null only on malformed legacy rows. */
  publishedAt: string | null;
  performance: {
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  };
}

export interface LinkedInFeedResponse {
  posts: LinkedInFeedPost[];
  /** Pass back as `cursor` to fetch the next page; null = no more. */
  nextCursor: string | null;
}

/** One generated LinkedIn post draft returned by `generateFromProfile`.
 *  Mirrors the api's response shape exactly — `draftId` is the
 *  cnt_drafts._id the server inserted. A future drafts-list endpoint
 *  will let the b2c re-fetch persisted drafts after the in-memory
 *  cache clears (page refresh); for now the panel only surfaces drafts
 *  during the session in which they were generated. */
export interface SuggestedDraft {
  /** ObjectId hex of the cnt_drafts row the server persisted. */
  draftId: string;
  /** First 1-3 lines of the post (above the See-more cut). */
  hook: string;
  /** Remainder of the post body. */
  body: string;
  /** Generator-picked angle — narrow enum on the server. */
  angle:
    | "industry_insight"
    | "customer_story"
    | "thought_leadership"
    | "product_or_service_highlight"
    | "behind_the_scenes"
    | "trend_observation"
    | "founder_personal"
    | "data_point"
    | "lessons_learned"
    | "how_to_practical";
  /** Optional audience segment from the business's taxonomy this post
   *  was tuned for. Surface in a card subtitle when present. */
  audienceSegment?: string;
  /** Optional CTA the generator suggests appending. Kept out of body
   *  so the user can pick whether to include it without re-editing. */
  suggestedCta?: string;
  /** One-sentence reason the post fits — surfaces in a hover/tooltip. */
  rationale: string;
  /** Full Hook DNA score for the post's hook. */
  hookScore: HookScore;
}

/** One boost-this-post candidate returned by `boostCandidates`. Mirrors
 *  the api's response shape exactly. Surfaces the composite score, the
 *  four component breakdowns, the raw signals (likes/comments/shares,
 *  velocity, avg AQS, Hook DNA), and a human-readable rationale for
 *  the UI hover. */
export interface BoostCandidate {
  postId: string;
  linkedInPostUrn: string;
  authorUrn?: string;
  authorType?: "person" | "org";
  publishedAt: string;
  hoursSincePublished: number;
  hookExcerpt: string;
  score: number;
  breakdown: {
    velocity: number;
    audienceQuality: number;
    hookDna: number;
    freshness: number;
  };
  signals: {
    likes: number;
    comments: number;
    shares: number;
    engagement: number;
    velocity: number;
    distinctEngagers: number;
    avgAqsScore: number;
    hookScore: number;
    hookTier: "rules" | "industry" | "personal";
  };
  rationale: string;
  performanceLastUpdated?: string;
}

export interface BoostCandidatesResponse {
  candidates: BoostCandidate[];
  totalPostsConsidered: number;
  eligibleCount: number;
  /** True when the business has more eligible posts than the scorer's
   *  hard cap (currently 30). UI should render "showing top N most
   *  recent" so the user knows there's more. */
  truncated: boolean;
  filteredOut: {
    missingPerformance: number;
    missingContent: number;
    lowEngagement: number;
    tooFresh: number;
    tooStale: number;
  };
}

export interface GenerateFromProfileResponse {
  posts: SuggestedDraft[];
  metadata: {
    usedVoiceCard: boolean;
    voiceCardVersion?: number;
    /** Cohort IDs the business is currently matched to. Each post's
     *  hookScore.archetypeMatch.cohortId tells which one Tier B
     *  actually used for THAT post (may differ across posts in the
     *  batch). */
    businessCohortIds: string[];
    usedBusinessContext: boolean;
  };
}
