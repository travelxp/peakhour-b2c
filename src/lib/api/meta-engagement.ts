import { api } from "@/lib/api";

/**
 * Comments on Facebook Page posts and Instagram media: /v1/meta/engagement.
 * Live reads, nothing is stored. Types mirror peakhour-api helpers/meta-comments.ts.
 */

export interface MetaComment {
  id: string;
  text: string;
  createdTime: string;
  authorName?: string;
  authorId?: string;
  isHidden: boolean;
  likeCount: number;
  canHide: boolean;
  canRemove: boolean;
  permalink?: string;
  replies: MetaComment[];
}

export interface MetaCommentPage {
  comments: MetaComment[];
  nextCursor: string | null;
}

export interface FacebookPage {
  id: string;
  name: string;
}
export interface FacebookPost {
  id: string;
  message?: string;
  createdTime: string;
  permalink?: string;
}
export interface InstagramAccount {
  id: string;
  username?: string;
  name?: string;
  pageId: string;
  pageName: string;
}
export interface InstagramMedia {
  id: string;
  caption?: string;
  mediaType: string;
  permalink?: string;
  timestamp: string;
  commentsCount?: number;
}

const BASE = "/v1/meta/engagement";
const q = (o: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const metaEngagementApi = {
  facebookPages: () => api.get<{ pages: FacebookPage[] }>(`${BASE}/facebook/pages`),
  facebookPosts: (pageId: string) =>
    api.get<{ posts: FacebookPost[] }>(`${BASE}/facebook/pages/${encodeURIComponent(pageId)}/posts`),
  facebookComments: (pageId: string, postId: string, after?: string) =>
    api.get<MetaCommentPage>(`${BASE}/facebook/posts/${encodeURIComponent(postId)}/comments`, q({ pageId, after })),
  facebookReply: (b: { pageId: string; postId: string; commentId: string; message: string }) =>
    api.post<{ id: string }>(`${BASE}/facebook/comments/reply`, b),
  facebookHide: (b: { pageId: string; postId: string; commentId: string; hidden: boolean }) =>
    api.post<{ hidden: boolean }>(`${BASE}/facebook/comments/hidden`, b),
  facebookDelete: (b: { pageId: string; postId: string; commentId: string }) =>
    api.delete<{ deleted: boolean }>(
      `${BASE}/facebook/comments/${encodeURIComponent(b.commentId)}?${qs({ pageId: b.pageId, postId: b.postId })}`,
    ),

  instagramAccounts: () => api.get<{ accounts: InstagramAccount[] }>(`${BASE}/instagram/accounts`),
  instagramMedia: (igUserId: string) =>
    api.get<{ media: InstagramMedia[] }>(`${BASE}/instagram/${encodeURIComponent(igUserId)}/media`),
  instagramComments: (igUserId: string, mediaId: string, after?: string) =>
    api.get<MetaCommentPage>(`${BASE}/instagram/media/${encodeURIComponent(mediaId)}/comments`, q({ igUserId, after })),
  instagramReply: (b: { igUserId: string; mediaId: string; commentId: string; message: string }) =>
    api.post<{ id: string }>(`${BASE}/instagram/comments/reply`, b),
  instagramHide: (b: { igUserId: string; mediaId: string; commentId: string; hidden: boolean }) =>
    api.post<{ hidden: boolean }>(`${BASE}/instagram/comments/hidden`, b),
  instagramDelete: (b: { igUserId: string; mediaId: string; commentId: string }) =>
    api.delete<{ deleted: boolean }>(
      `${BASE}/instagram/comments/${encodeURIComponent(b.commentId)}?${qs({ igUserId: b.igUserId, mediaId: b.mediaId })}`,
    ),
};
