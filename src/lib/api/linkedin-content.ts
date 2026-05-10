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

/** Hook DNA score — `tier: "rules"` is the v0 floor; v1+ may add
 *  "personal" (per-business cosine) and "industry" (archetype cosine)
 *  as the embedding pipeline lands. The badge surfaces the tier so
 *  users see when they're getting the floor vs personalised tiers. */
export interface HookScore {
  score: number;
  tier: "rules";
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
}

export const linkedInContentApi = {
  me: () => api.get<LinkedInIdentity>("/v1/linkedin-content/me"),

  publish: (body: PublishLinkedInPostInput) =>
    api.post<{ postId: string }>("/v1/linkedin-content/publish", body),

  scoreHook: (hook: string) =>
    api.post<HookScore>("/v1/linkedin-content/score-hook", { hook }),
};
