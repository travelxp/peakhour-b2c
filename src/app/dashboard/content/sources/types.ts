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
