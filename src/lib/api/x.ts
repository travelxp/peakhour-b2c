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

export const xApi = {
  publish: (body: PublishTweetInput) =>
    api.post<{ id: string; text: string }>("/v1/x/content/publish", body),

  listTweets: (count = 20) =>
    api.get<XTweet[]>("/v1/x/content/tweets", { count: String(count) }),

  refreshMetrics: (ids: string[]) =>
    api.get<XTweet[]>("/v1/x/content/tweets/metrics", { ids: ids.join(",") }),

  deleteTweet: (id: string) =>
    api.delete<unknown>(`/v1/x/content/tweets/${id}`),
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
