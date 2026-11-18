import { api } from "@/lib/api";
import type { MetaCommentsPlatform } from "@/lib/meta-comments-view";
import { activeFirst } from "@/lib/meta-content-view";

/**
 * Comments on Facebook Page posts and Instagram media. Live reads, nothing is stored. Comments, replies and the
 * moderation calls are /v1/meta/engagement; the Facebook Page list is there too (token-free), and the posts, Instagram
 * accounts and media lists are the /v1/meta/content routes. `engagementFor` is the one place that knows which is which.
 * Types mirror peakhour-api helpers/meta-comments.ts.
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
  /** Set while Meta has more replies than `replies` holds. Null means the list is complete. */
  repliesCursor: string | null;
}

export interface MetaCommentPage {
  comments: MetaComment[];
  nextCursor: string | null;
}

/** A Page or an Instagram account to moderate. */
export interface Owner {
  id: string;
  label: string;
}

/** A post (Facebook) or media (Instagram) in the list. */
export interface PostRow {
  id: string;
  text?: string;
  createdTime: string;
  commentCount?: number;
  link?: string;
}

export interface EngagementApi {
  /** "Facebook" or "Instagram", for the screen's words. */
  name: string;
  owners(): Promise<Owner[]>;
  posts(ownerId: string): Promise<PostRow[]>;
  comments(ownerId: string, postId: string, after?: string): Promise<MetaCommentPage>;
  replies(ownerId: string, postId: string, commentId: string, after: string): Promise<MetaCommentPage>;
  reply(ownerId: string, postId: string, commentId: string, message: string): Promise<{ id: string }>;
  hide(ownerId: string, postId: string, commentId: string, hidden: boolean): Promise<{ hidden: boolean }>;
  remove(ownerId: string, postId: string, commentId: string): Promise<{ deleted: boolean }>;
}

const ENG = "/v1/meta/engagement";
const CONTENT = "/v1/meta/content";
const enc = encodeURIComponent;
const q = (o: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

const facebook: EngagementApi = {
  name: "Facebook",
  owners: async () =>
    await api
      .get<{ pages: Array<{ id: string; name: string }>; activePageId?: string | null }>(`${ENG}/facebook/pages`)
      .then((r) => activeFirst(r.pages.map((p) => ({ id: p.id, label: p.name })), r.activePageId)),
  posts: async (pageId) =>
    (
      await api.get<{ posts: Array<{ id: string; message?: string; createdTime: string; permalink?: string }> }>(
        `${CONTENT}/pages/${enc(pageId)}/posts`,
      )
    ).posts.map((p) => ({ id: p.id, text: p.message, createdTime: p.createdTime, link: p.permalink })),
  comments: (pageId, postId, after) =>
    api.get<MetaCommentPage>(`${ENG}/facebook/posts/${enc(postId)}/comments`, q({ pageId, after })),
  replies: (pageId, postId, commentId, after) =>
    api.get<MetaCommentPage>(`${ENG}/facebook/comments/${enc(commentId)}/replies`, q({ pageId, postId, after })),
  reply: (pageId, postId, commentId, message) =>
    api.post(`${ENG}/facebook/comments/reply`, { pageId, postId, commentId, message }),
  hide: (pageId, postId, commentId, hidden) =>
    api.post(`${ENG}/facebook/comments/hidden`, { pageId, postId, commentId, hidden }),
  remove: (pageId, postId, commentId) => api.delete(`${ENG}/facebook/comments/${enc(commentId)}?${qs({ pageId, postId })}`),
};

const instagram: EngagementApi = {
  name: "Instagram",
  owners: async () =>
    await api
      .get<{
        accounts: Array<{ id: string; username?: string; name?: string; pageName: string }>;
        activeAccountId?: string | null;
      }>(`${CONTENT}/instagram/accounts`)
      .then((r) =>
        activeFirst(
          r.accounts.map((a) => ({ id: a.id, label: a.username ? `@${a.username}` : (a.name ?? a.pageName) })),
          r.activeAccountId,
        ),
      ),
  posts: async (igUserId) =>
    (
      await api.get<{
        media: Array<{ id: string; caption?: string; timestamp: string; commentsCount?: number; permalink?: string }>;
      }>(`${CONTENT}/instagram/${enc(igUserId)}/media`)
    ).media.map((m) => ({
      id: m.id,
      text: m.caption,
      createdTime: m.timestamp,
      commentCount: m.commentsCount,
      link: m.permalink,
    })),
  comments: (igUserId, mediaId, after) =>
    api.get<MetaCommentPage>(`${ENG}/instagram/media/${enc(mediaId)}/comments`, q({ igUserId, after })),
  replies: (igUserId, mediaId, commentId, after) =>
    api.get<MetaCommentPage>(`${ENG}/instagram/comments/${enc(commentId)}/replies`, q({ igUserId, mediaId, after })),
  reply: (igUserId, mediaId, commentId, message) =>
    api.post(`${ENG}/instagram/comments/reply`, { igUserId, mediaId, commentId, message }),
  hide: (igUserId, mediaId, commentId, hidden) =>
    api.post(`${ENG}/instagram/comments/hidden`, { igUserId, mediaId, commentId, hidden }),
  remove: (igUserId, mediaId, commentId) =>
    api.delete(`${ENG}/instagram/comments/${enc(commentId)}?${qs({ igUserId, mediaId })}`),
};

export function engagementFor(platform: MetaCommentsPlatform): EngagementApi {
  return platform === "facebook" ? facebook : instagram;
}
