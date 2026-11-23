import { api } from "@/lib/api";

/**
 * Client for `/v1/tiktok/content`: what the connected TikTok account may post (CO-1, peakhour-api). Types mirror the route's answer.
 * Nothing here publishes: the post sheet never calls a publish route while TikTok publishing is off.
 */

export interface TikTokCreatorInfo {
  nickname: string | null;
  avatarUrl: string | null;
  /** What this account may post as, in TikTok's own words (PUBLIC_TO_EVERYONE, ...). The only source of the privacy choices. */
  privacyLevelOptions: string[];
  /** The account has turned comments, Duet or Stitch off in the TikTok app: a post cannot switch them on. */
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  /** Longest video the account may post, in seconds. */
  maxVideoPostDurationSec?: number;
}

export const tiktokContentApi = {
  creatorInfo: () => api.get<TikTokCreatorInfo>("/v1/tiktok/content/creator-info"),
};
