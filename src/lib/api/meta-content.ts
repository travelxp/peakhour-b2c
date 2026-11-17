import { api } from "@/lib/api";

/**
 * Client for `/v1/meta/content`: the Facebook Page and Instagram reads.
 *
 * Types mirror `peakhour-api/src/v1/helpers/meta.ts`. The rule carried over from
 * there: **a figure that is absent is one Meta did not report, never zero**, so
 * every figure is `number | null` and `unavailable` says why.
 */

export interface MetaPage {
  id: string;
  name: string;
  category?: string;
}

export interface MetaInstagramAccount {
  id: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  mediaCount?: number;
}

/** One linked Instagram account with the Page it is linked through. */
export interface MetaInstagramListed extends MetaInstagramAccount {
  pageId: string;
  pageName: string;
}

export interface MetaPagePost {
  id: string;
  message?: string;
  createdTime: string;
  permalink?: string;
  fullPicture?: string;
}

export interface MetaInstagramMedia {
  id: string;
  caption?: string;
  mediaType: string;
  mediaUrl?: string;
  /** Present on videos and reels, and on a carousel whose cover is a video. */
  thumbnailUrl?: string;
  permalink?: string;
  timestamp: string;
  likeCount?: number;
  commentsCount?: number;
}

export interface MetaInsightPoint {
  date: string;
  value: number;
}

export interface MetaAccountFigure {
  total: number;
  series: MetaInsightPoint[];
}

export interface MetaPageInsights {
  mediaViews: MetaAccountFigure | null;
  postEngagements: MetaAccountFigure | null;
  newFollows: MetaAccountFigure | null;
  pageViews: MetaAccountFigure | null;
  followers: number | null;
  unavailable: Partial<Record<string, string>>;
}

export interface MetaInstagramAccountInsights {
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
  totalInteractions: number | null;
  followers: number | null;
  followerSeries: MetaInsightPoint[] | null;
  unavailable: Partial<Record<string, string>>;
}

export interface MetaPostInsights {
  mediaViews: number | null;
  mediaViewers: number | null;
  engagedUsers: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  unavailable: Partial<Record<string, string>>;
}

export interface MetaMediaInsights {
  views: number | null;
  reach: number | null;
  engagement: number | null;
  saved: number | null;
  unavailable: Partial<Record<string, string>>;
}

export interface InsightWindow {
  since: string;
  until: string;
}

const BASE = "/v1/meta/content";

export const metaContentApi = {
  pages: () => api.get<{ pages: MetaPage[] }>(`${BASE}/pages`),
  /** Every linked Instagram account in one call. */
  instagramAccounts: () => api.get<{ accounts: MetaInstagramListed[] }>(`${BASE}/instagram/accounts`),
  pageInsights: (pageId: string, w: InsightWindow) =>
    api.get<{ insights: MetaPageInsights }>(`${BASE}/pages/${encodeURIComponent(pageId)}/insights`, { ...w }),
  pagePosts: (pageId: string, limit = 25) =>
    api.get<{ posts: MetaPagePost[] }>(`${BASE}/pages/${encodeURIComponent(pageId)}/posts`, { limit: String(limit) }),
  postInsights: (postId: string) =>
    api.get<{ insights: MetaPostInsights }>(`${BASE}/pages/posts/${encodeURIComponent(postId)}/insights`),
  igInsights: (igUserId: string, w: InsightWindow) =>
    api.get<{ insights: MetaInstagramAccountInsights }>(
      `${BASE}/instagram/${encodeURIComponent(igUserId)}/insights`,
      { ...w },
    ),
  igMedia: (igUserId: string, limit = 25) =>
    api.get<{ media: MetaInstagramMedia[] }>(`${BASE}/instagram/${encodeURIComponent(igUserId)}/media`, {
      limit: String(limit),
    }),
  mediaInsights: (mediaId: string, igUserId: string) =>
    api.get<{ insights: MetaMediaInsights }>(`${BASE}/instagram/media/${encodeURIComponent(mediaId)}/insights`, {
      igUserId,
    }),
};
