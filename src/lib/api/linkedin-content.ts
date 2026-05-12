import { api } from "@/lib/api";

export type LinkedInVisibility = "PUBLIC" | "CONNECTIONS" | "LOGGED_IN";

export type LinkedInAuthor =
  | { type: "person" }
  | { type: "org"; pageId: string };

export interface PublishLinkedInPostInput {
  author: LinkedInAuthor;
  commentary: string;
  visibility?: LinkedInVisibility;
  link?: { url: string; title?: string; description?: string };
  imageUrns?: string[];
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
 * `GET /v1/linkedin-content/voice-card` — audit fields + internal signals
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

export const linkedInContentApi = {
  me: () => api.get<LinkedInIdentity>("/v1/linkedin-content/me"),

  publish: (body: PublishLinkedInPostInput) =>
    api.post<{ postId: string }>("/v1/linkedin-content/publish", body),

  scoreHook: (hook: string) =>
    api.post<HookScore>("/v1/linkedin-content/score-hook", { hook }),

  rewriteHook: (hook: string, count?: number) =>
    api.post<RewriteHookResponse>(
      "/v1/linkedin-content/rewrite-hook",
      count !== undefined ? { hook, count } : { hook },
    ),

  /** Fetch the auto-synthesised LinkedIn voice card. ApiError with
   *  `code: "NOT_FOUND"` (404) means "no card yet" — caller should
   *  render an empty state, not surface an error. */
  voiceCard: () =>
    api.get<LinkedInVoiceCard>("/v1/linkedin-content/voice-card"),

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
      `/v1/linkedin-content/engagers${q ? `?${q}` : ""}`,
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
      "/v1/linkedin-content/generate-from-profile",
      count !== undefined ? { count } : {},
    ),
};

/** One generated LinkedIn post draft returned by `generateFromProfile`.
 *  Mirrors the api's response shape exactly — `draftId` is the
 *  cnt_drafts._id the server inserted; the b2c reads it back via the
 *  drafts list endpoint once the user navigates away from the in-memory
 *  cache. */
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
