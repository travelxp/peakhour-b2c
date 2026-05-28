import { api } from "@/lib/api";

export interface XTweet {
  id: string;
  text: string;
  createdAt?: string;
  publicMetrics?: {
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    impressionCount: number;
  };
}

export interface PublishTweetInput {
  text: string;
  replyToTweetId?: string;
  quoteTweetId?: string;
  mediaIds?: string[];
}

/**
 * X mention row served by GET /v1/x/content/mentions. Mirrors the
 * soc_social_mentions schema; nullable fields are explicit nulls on
 * the wire (the api projection defaults them) so the type stays free
 * of `undefined` drift between the boundary and React state.
 */
export interface XMention {
  id: string;
  externalId: string;
  author: {
    id: string;
    handle: string | null;
    name: string | null;
    /** Author follower count at sync time. M-4: surfaced in the
     *  urgency badge tooltip. Null when the cron's user.fields
     *  expansion was missing public_metrics. */
    followerCount: number | null;
    /** Twitter/X verified flag at sync time. Null when unknown
     *  (legacy rows synced before M-4). */
    verified: boolean | null;
  };
  text: string;
  url: string | null;
  mediaUrls: string[];
  parentId: string | null;
  conversationId: string | null;
  metrics: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    impressions: number;
    lastUpdated?: string;
  } | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  readAt: string | null;
  mentionedAt: string;
  /** Urgency score + reason tags (Phase 1 M-4). Null on legacy rows
   *  that pre-date the cron's scoring pass; readers treat null as
   *  "unknown / no badge." */
  urgency: {
    score: number;
    reasons: string[];
  } | null;
}

export type MentionsSort = "urgency" | "recent";

export interface ListMentionsResult {
  mentions: XMention[];
  nextCursor: string | null;
}

export type MentionsFilter = "unread" | "all";

export const xApi = {
  publish: (body: PublishTweetInput) =>
    api.post<{ id: string; text: string }>("/v1/x/content/publish", body),

  listTweets: (count = 20) =>
    api.get<XTweet[]>("/v1/x/content/tweets", { count: String(count) }),

  refreshMetrics: (ids: string[]) =>
    api.get<XTweet[]>("/v1/x/content/tweets/metrics", { ids: ids.join(",") }),

  deleteTweet: (id: string) =>
    api.delete<unknown>(`/v1/x/content/tweets/${id}`),

  listMentions: (params: {
    filter?: MentionsFilter;
    sort?: MentionsSort;
    limit?: number;
    cursor?: string;
  } = {}) => {
    const query: Record<string, string> = {};
    if (params.filter) query.filter = params.filter;
    if (params.sort) query.sort = params.sort;
    if (params.limit) query.limit = String(params.limit);
    if (params.cursor) query.cursor = params.cursor;
    return api.get<ListMentionsResult>("/v1/x/content/mentions", query);
  },

  markMentionRead: (id: string) =>
    api.post<{ id: string; readAt: string }>(`/v1/x/content/mentions/${id}/read`),

  suggestReplyForMention: (id: string) =>
    api.post<{
      mentionId: string;
      replyToTweetId: string;
      text: string;
      reasoning: string | null;
    }>(`/v1/x/content/mentions/${id}/suggest-reply`),
};

/**
 * Extract the tweet id from a status URL. Used by the composer's reply-to /
 * quote-tweet input — accepting a URL is friendlier than asking for the raw id.
 * Returns undefined if the input doesn't look like a tweet URL.
 */
export function extractTweetId(input: string): string | undefined {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
  return match?.[1];
}
