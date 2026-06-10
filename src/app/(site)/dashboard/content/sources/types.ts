/**
 * Trusted-source types — mirrors the row shape returned by
 * `GET /v1/sources/trusted` on peakhour-api.
 *
 * Source of truth for the field set: cnt_trusted_sources.schema.json
 * + the projection in routes/sources/trusted.ts (the listing route
 * strips `rejectionTopicEmbedding` from the response).
 *
 * Intentionally not all schema fields are typed here — only the ones
 * the UI renders or mutates. Adding a new field requires touching this
 * file so a "renamed in schema, forgotten in UI" drift is harder to
 * miss in code review.
 */

export type SourceType =
  | "website"
  | "rss"
  | "x_handle"
  | "instagram_handle"
  | "youtube_channel"
  | "newsletter"
  | "podcast"
  | "uploaded_doc";

export type SourceStatus = "active" | "suggested" | "rejected" | "inactive";

export type SourceOrigin = "user_suggested" | "ai_suggested";

export type FetchFrequency = "hourly" | "daily" | "weekly" | "manual";

export interface TrustedSourceMetadata {
  followerCount?: number;
  description?: string;
  domainAuthority?: number;
  avgPostFrequency?: string;
  language?: string;
  region?: string;
}

export interface TrustedSource {
  _id: string;
  orgId: string;
  businessId: string;
  type: SourceType;
  identifier: string;
  displayName: string;
  origin: SourceOrigin;
  status: SourceStatus;
  trustScore: number;
  topicTags?: string[];
  usageCount?: number;
  fetchFrequency: FetchFrequency;
  consecutiveFetchFailures?: number;
  // Date strings come back ISO-formatted from Hono's JSON serializer.
  createdAt?: string;
  updatedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  inactivatedAt?: string;
  lastUsedAt?: string;
  lastFetchedAt?: string;
  lastSuccessfulFetchAt?: string;
  nextFetchDue?: string;
  rejectionReason?: string;
  suggestedReason?: string;
  metadata?: TrustedSourceMetadata;
}

export interface ListResponse {
  rows: TrustedSource[];
  total: number;
}

export interface CreateSourceInput {
  type: SourceType;
  identifier: string;
  displayName: string;
  fetchFrequency?: FetchFrequency;
  metadata?: TrustedSourceMetadata;
  /**
   * Lifecycle the row should land in. Defaults to "active" — the
   * Manual / Bulk / OPML tabs omit this entirely so they continue to
   * post user-curated rows that join the active pool immediately.
   * The "From competitor" tab passes "suggested" so AI-recommended
   * rows land in the Suggested tab for review-before-activation.
   */
  as?: "active" | "suggested";
  /**
   * One-sentence relevance pitch from an AI recommender. Honored
   * server-side only when `as: "suggested"`; ignored otherwise.
   */
  suggestedReason?: string;
  /**
   * AI confidence (0..1). Honored server-side only when `as:
   * "suggested"` — overrides the default 0.5 trustScore on suggested
   * writes. Ignored on user-curated writes.
   */
  trustScore?: number;
}

/**
 * Result row from `POST /v1/sources/recommend-from-competitor`. The
 * recommender returns CreateSourceInput-compatible fields plus the
 * extra display metadata (reason, confidence) the UI surfaces during
 * preview. When the operator commits, the reason flows into
 * `suggestedReason` and confidence flows into `trustScore`.
 */
export interface RecommendedSource {
  type: Exclude<SourceType, "uploaded_doc">;
  identifier: string;
  displayName: string;
  fetchFrequency: FetchFrequency;
  reason: string;
  confidence: number;
}

export interface CompetitorRecommendations {
  recommendations: RecommendedSource[];
  competitorSummary: string;
}

export interface PatchSourceInput {
  status?: "active" | "inactive" | "rejected";
  rejectionReason?: string;
  displayName?: string;
  fetchFrequency?: FetchFrequency;
  metadata?: TrustedSourceMetadata;
}

/**
 * UI labels for source types. Kept here (not in the API helper) so
 * copy lives next to the components that render it. Map keyed by the
 * exact schema-enum string to make bad keys a TS error.
 */
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  website: "Website",
  rss: "RSS feed",
  x_handle: "X handle",
  instagram_handle: "Instagram handle",
  youtube_channel: "YouTube channel",
  newsletter: "Newsletter",
  podcast: "Podcast",
  uploaded_doc: "Uploaded document",
};

export const FETCH_FREQUENCY_LABEL: Record<FetchFrequency, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  manual: "Manual",
};
