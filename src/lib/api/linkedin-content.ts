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
};
