import { api, ApiError } from "@/lib/api";

/**
 * /v1/creative: Creative Studio's client.
 *
 * Two kinds of read live here:
 *   - the EXISTING api (peakhour-api `routes/creative/post-ideas.ts`): the ideas feed and its dismissal. Free, no AI, no Peaks.
 *   - the DEFENSIVE reads (`GET /v1/creative/studio/availability`, spec 8.2): not on api master when this lane was built. They never throw
 *     and never guess upwards: a missing, failed or unreadable answer means "nothing AI is available yet" and Pro tools off.
 */

// ── Post ideas (EXISTING) ────────────────────────────────────

export type PostIdeaKind =
  | "festival"
  | "low_stock"
  | "overstock"
  | "high_margin"
  | "new_reviews"
  | "new_products"
  | "sold_before";

export type PostFormat = "feed" | "story" | "reel";

export interface PostIdeaProduct {
  id: string;
  title: string;
}

/** One idea as the api sends it. `reason` is one plain line that names the signal; show it unedited. */
export interface PostIdea {
  id: string;
  kind: PostIdeaKind;
  reason: string;
  productIds: string[];
  products: PostIdeaProduct[];
  format: PostFormat;
  /** Counts and names behind the reason (a festival idea carries its name and date). Plain values only. */
  facts: Record<string, string | number | boolean | null>;
  /** ISO time after which the idea is no longer worth posting. */
  expiresAt: string;
}

export interface PostIdeasResponse {
  ideas: PostIdea[];
  generatedAt: string;
  /** Days a dismissed idea stays away (a festival idea stays away until it has passed). */
  coolingDays: number;
  /** ISO country of the business's market, or null. */
  market: string | null;
}

export interface DismissResponse {
  dismissed: true;
  id: string;
  /** ISO time the idea may come back. */
  backAfter: string;
}

// ── Availability (NEW, read defensively) ─────────────────────

export const STUDIO_CAPABILITIES = ["previews", "final", "extend", "wordOptions", "aiIdeas", "video", "textAds"] as const;
export type StudioCapability = (typeof STUDIO_CAPABILITIES)[number];
export type CapabilityState = "on" | "coming_soon";

export interface StudioAvailability {
  capabilities: Record<StudioCapability, CapabilityState>;
  /** The per-user "Pro tools" flag. Off unless the api says exactly `true`. */
  proTools: boolean;
  /** False when the api gave no usable answer (not built yet, failed, unreadable): everything AI is then "coming soon". */
  known: boolean;
}

const allComingSoon = (): Record<StudioCapability, CapabilityState> =>
  Object.fromEntries(STUDIO_CAPABILITIES.map((c) => [c, "coming_soon" as const])) as Record<StudioCapability, CapabilityState>;

/** What every screen assumes until the api has said otherwise. */
export const UNAVAILABLE: StudioAvailability = { capabilities: allComingSoon(), proTools: false, known: false };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Read the availability answer without trusting it. Only the exact string "on" turns a capability on; anything else (a missing key, a
 * misspelt state, a boolean) stays "coming soon". Pro tools is on only for the boolean `true`. Accepts the map under `capabilities` or at
 * the top level, since the contract (spec 8.2) names the content and not the envelope.
 */
export function parseAvailability(raw: unknown): StudioAvailability {
  if (!isRecord(raw)) return UNAVAILABLE;
  const map = isRecord(raw.capabilities) ? raw.capabilities : raw;
  const capabilities = allComingSoon();
  for (const c of STUDIO_CAPABILITIES) if (map[c] === "on") capabilities[c] = "on";
  return { capabilities, proTools: raw.proTools === true, known: true };
}

export const creativeApi = {
  postIdeas: () => api.get<PostIdeasResponse>("/v1/creative/post-ideas"),

  dismissPostIdea: (id: string) => api.post<DismissResponse>("/v1/creative/post-ideas/dismiss", { id }),

  /**
   * Only a 404 (the endpoint is not deployed yet) is an answer: "not available yet". Any other failure (network, 401, 5xx) THROWS, so the
   * query sits in an error state instead of caching "everything coming soon, Pro tools off" for a minute as if the api had said it.
   * {@link useStudioAvailability} turns that error into the same safe default without caching it.
   */
  async availability(): Promise<StudioAvailability> {
    try {
      return parseAvailability(await api.get<unknown>("/v1/creative/studio/availability"));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 501)) return UNAVAILABLE;
      throw e;
    }
  },
};
