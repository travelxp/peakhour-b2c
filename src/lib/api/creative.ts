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

export interface UndismissResponse {
  id: string;
  /** false when there was no dismissal left to take back. */
  restored: boolean;
}

// ── Availability (NEW, read defensively) ─────────────────────

export const STUDIO_CAPABILITIES = ["previews", "final", "extend", "wordOptions", "aiIdeas", "video", "textAds"] as const;
export type StudioCapability = (typeof STUDIO_CAPABILITIES)[number];
export type CapabilityState = "on" | "coming_soon";

/** The business's Studio settings (S19, `GET /v1/creative/studio/availability` `settings`). */
export interface StudioSettings {
  noAiPeople: boolean;
  /** null = no limit. */
  monthlyCapPeaks: number | null;
  remindShortlist: boolean;
  whatsappUpdates: boolean;
  /** Peaks Studio used this calendar month (UTC): what the monthly limit is measured against. */
  usedThisMonthPeaks: number;
}

/** What every setting is until the api says otherwise: the api's own defaults. */
export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  noAiPeople: false,
  monthlyCapPeaks: null,
  remindShortlist: true,
  whatsappUpdates: false,
  usedThisMonthPeaks: 0,
};

export interface StudioAvailability {
  capabilities: Record<StudioCapability, CapabilityState>;
  /** The per-user "Pro tools" flag. Off unless the api says exactly `true`. */
  proTools: boolean;
  settings: StudioSettings;
  /** False when the api gave no usable answer (not built yet, failed, unreadable): everything AI is then "coming soon". */
  known: boolean;
}

const allComingSoon = (): Record<StudioCapability, CapabilityState> =>
  Object.fromEntries(STUDIO_CAPABILITIES.map((c) => [c, "coming_soon" as const])) as Record<StudioCapability, CapabilityState>;

/** What every screen assumes until the api has said otherwise. */
export const UNAVAILABLE: StudioAvailability = { capabilities: allComingSoon(), proTools: false, settings: DEFAULT_STUDIO_SETTINGS, known: false };

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
  return { capabilities, proTools: raw.proTools === true, settings: parseSettings(raw.settings), known: true };
}

/** The settings as the api sent them; a missing or odd field is the default, never a guess. A limit is a whole number of 1 or more, else none. */
export function parseSettings(raw: unknown): StudioSettings {
  if (!isRecord(raw)) return DEFAULT_STUDIO_SETTINGS;
  const d = DEFAULT_STUDIO_SETTINGS;
  const cap = raw.monthlyCapPeaks;
  const used = raw.usedThisMonthPeaks;
  return {
    noAiPeople: raw.noAiPeople === true,
    monthlyCapPeaks: typeof cap === "number" && Number.isInteger(cap) && cap >= 1 ? cap : null,
    remindShortlist: typeof raw.remindShortlist === "boolean" ? raw.remindShortlist : d.remindShortlist,
    whatsappUpdates: raw.whatsappUpdates === true,
    usedThisMonthPeaks: typeof used === "number" && Number.isFinite(used) && used > 0 ? used : 0,
  };
}


// ── Library (CS-3a `GET /v1/creative?view=`) ─────────────────

export type LibraryView = "made" | "plans";

/** One creative in the Library. `thumbUrl` is the cover preview's thumbnail, or null when it could not be signed. */
export interface LibraryItem {
  id: string;
  kind: "image" | "words";
  status: "brief" | "making_previews" | "previews_ready" | "previews_failed" | "has_final" | "archived";
  headline: string | null;
  format: PostFormat;
  productIds: string[];
  updatedAt: string;
  thumbUrl: string | null;
}

export interface LibraryPage {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Memory (CS-3a `/v1/creative/memory`) ─────────────────────

export interface MemoryEvidence {
  count: number;
  since: string;
  basis: "test" | "pattern";
  /** The api's plain sentence: "Based on 12 posts, since 3 Nov." or "Early guess. Based on 2 posts." */
  label: string;
}

export interface MemoryLine {
  id: string;
  text: string;
  kind: "taste" | "rule";
  /** "learned" by Studio, or "you" (a line the merchant wrote with Pro tools). */
  source: "learned" | "you";
  /** "You wrote this", "From a test of two versions" or "A pattern we noticed". Never proof. */
  origin: string;
  evidence: MemoryEvidence | null;
  editable: boolean;
}

/** A rule that always wins. `changeIn: "brand-kit"` links to the Brand Kit; null has nothing to change here. */
export interface MemoryRule {
  text: string;
  changeIn: "brand-kit" | null;
}

export interface MemoryRead {
  lines: MemoryLine[];
  rules: MemoryRule[];
  note: string;
  trends: { approvedPosts: number; enough: boolean; needs: number };
  pooledOptIn: boolean;
}

export interface MemoryExport {
  exportedAt: string;
  lines: Array<{ text: string; kind: string; source: string; evidence?: { count: number; since: string; basis: string }; createdAt: string }>;
  pooledOptIn: boolean;
}

export const MEMORY_LINE_MAX = 140;

export const creativeApi = {
  postIdeas: () => api.get<PostIdeasResponse>("/v1/creative/post-ideas"),

  dismissPostIdea: (id: string) => api.post<DismissResponse>("/v1/creative/post-ideas/dismiss", { id }),

  /** The Undo after a dismissal. Nothing to take back is still a success (`restored: false`). */
  undismissPostIdea: (id: string) => api.post<UndismissResponse>("/v1/creative/post-ideas/undismiss", { id }),

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

  library: (q: { view: LibraryView; q?: string; status?: string; page?: number }) =>
    api.get<LibraryPage>("/v1/creative", {
      view: q.view,
      ...(q.q ? { q: q.q } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.page && q.page > 1 ? { page: String(q.page) } : {}),
    }),

  memory: () => api.get<MemoryRead>("/v1/creative/memory"),
  /** Stop using a line. Free. */
  deleteMemoryLine: (id: string) => api.delete<{ ok: true }>(`/v1/creative/memory/lines/${encodeURIComponent(id)}`),
  /** Pro tools. Only a line the merchant wrote can be reworded. */
  editMemoryLine: (id: string, text: string) => api.patch<{ id: string }>(`/v1/creative/memory/lines/${encodeURIComponent(id)}`, { text }),
  /** Pro tools. */
  addMemoryLine: (text: string) => api.post<{ id: string }>("/v1/creative/memory/lines", { text }),
  setPooled: (optIn: boolean) => api.patch<{ pooledOptIn: boolean }>("/v1/creative/memory/pooled", { optIn }),
  exportMemory: () => api.post<MemoryExport>("/v1/creative/memory/export", {}),
  /** Wipes what Studio learned. The Library is not touched. */
  wipeMemory: () => api.delete<{ deleted: number }>("/v1/creative/memory"),
};
