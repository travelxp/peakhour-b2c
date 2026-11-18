import { api } from "@/lib/api";

/**
 * Client for `/v1/threads`: the connected Threads profile and its recent posts.
 * Types mirror `peakhour-api/src/v1/routes/threads/index.ts`. A field Threads did not send is
 * absent (posts) or null (profile), never an empty string.
 */

export interface ThreadsProfile {
  id: string;
  username: string | null;
  name: string | null;
  pictureUrl: string | null;
  profileUrl: string | null;
}

export interface ThreadsPost {
  id: string;
  text?: string;
  permalink?: string;
  /** Graph style, "2026-11-17T09:30:00+0000"; read it with `parseGraphTime`. */
  timestamp?: string;
  /** TEXT_POST, IMAGE, VIDEO, CAROUSEL_ALBUM, AUDIO or REPOST_FACADE. */
  mediaType?: string;
  mediaUrl?: string;
}

export interface ThreadsPostsPage {
  posts: ThreadsPost[];
  nextCursor: string | null;
}

const BASE = "/v1/threads";
export const THREADS_PAGE_SIZE = 10;

export const threadsApi = {
  profile: () => api.get<{ profile: ThreadsProfile }>(`${BASE}/profile`),
  posts: (after?: string | null) =>
    api.get<ThreadsPostsPage>(`${BASE}/posts`, {
      limit: String(THREADS_PAGE_SIZE),
      ...(after ? { after } : {}),
    }),
};
