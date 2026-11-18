import type { ThreadsPost } from "@/lib/api/threads";

/** The `media_type` values Threads sends, in the words a merchant uses. Unknown ones read as a plain post. */
const TYPES: Record<string, string> = {
  IMAGE: "Photo",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carousel",
  AUDIO: "Audio",
  REPOST_FACADE: "Repost",
};

export function threadsTypeLabel(mediaType: string | undefined): string | undefined {
  return mediaType ? TYPES[mediaType] : undefined;
}

/** The picture for a row: only an image post carries one worth showing. A video's `media_url` is the video file. */
export function threadsThumbnail(p: Pick<ThreadsPost, "mediaType" | "mediaUrl">): string | undefined {
  return p.mediaType === "IMAGE" ? p.mediaUrl : undefined;
}

/** Where "View on Threads" goes: Threads' own permalink, or nothing (an id alone cannot build a link). */
export function threadsViewHref(p: Pick<ThreadsPost, "permalink">): string | undefined {
  return p.permalink && /^https:\/\/(www\.)?threads\.(com|net)\//.test(p.permalink) ? p.permalink : undefined;
}

export type ThreadsHubState = "loading" | "not_connected" | "needs_reauth" | "needs_permission" | "error" | "ready";

/** What the hub shows for the profile read, decided in one place so each state has a test. */
export function threadsHubState(s: {
  loading: boolean;
  error?: { status?: number; code?: string } | null;
}): ThreadsHubState {
  if (s.loading) return "loading";
  if (!s.error) return "ready";
  if (s.error.code === "NEEDS_REAUTH") return "needs_reauth";
  // The code, not the bare 404: a route that is not deployed yet also answers 404 and must not read as "connect".
  if (s.error.code === "THREADS_NOT_CONNECTED") return "not_connected";
  if (s.error.status === 403) return "needs_permission";
  return "error";
}
