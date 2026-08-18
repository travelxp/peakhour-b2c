import { api } from "@/lib/api";

/**
 * The saved-reply library — a business's canned answers, shared by every
 * channel that lands in the Inbox.
 *
 * ★THERE IS NO SEND METHOD HERE, and that is deliberate rather than
 * incidental. A saved reply is INSERTED into a composer for a human to
 * edit and send; the sending is whatever that composer already does.
 * Keeping the two apart in the client mirrors the api, where the library
 * and the send path are separate files for the same reason.
 */

/** Mirrors `sup_inbox.source` — the channel an Inbox item arrived on, and
 *  therefore the channel a reply can be scoped to. */
export type SavedReplyChannel =
  | "integration_fit"
  | "in_app"
  | "website"
  | "email"
  | "x"
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "linkedin"
  | "google_review"
  | "other";

export interface SavedReply {
  id: string;
  title: string;
  body: string;
  /** Absent means it fits every channel — the common case. */
  channels?: SavedReplyChannel[];
  tags?: string[];
  status: "active" | "archived";
  /** ★Times INSERTED, not times sent. We know a human put it in a box;
   *  we cannot know whether they then rewrote it. The list is ordered by
   *  this; nothing should report it as messages delivered. */
  usageCount: number;
  lastUsedAt?: string;
}

export interface SavedReplyList {
  replies: SavedReply[];
  /** The server caps the list rather than paginating — a business at the
   *  cap has a curation problem the UI should name. */
  truncated: boolean;
}

export const savedRepliesApi = {
  list: (params?: { channel?: SavedReplyChannel; includeArchived?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.channel) qs.set("channel", params.channel);
    if (params?.includeArchived) qs.set("includeArchived", "1");
    const q = qs.toString();
    return api.get<SavedReplyList>(`/v1/saved-replies${q ? `?${q}` : ""}`);
  },

  create: (body: {
    title: string;
    body: string;
    channels?: SavedReplyChannel[];
    tags?: string[];
  }) => api.post<SavedReply>("/v1/saved-replies", body),

  /** `null` on `channels`/`tags` CLEARS them — the only way to widen a
   *  reply back to every channel after narrowing it. */
  update: (
    id: string,
    body: {
      title?: string;
      body?: string;
      channels?: SavedReplyChannel[] | null;
      tags?: string[] | null;
      status?: "active" | "archived";
    },
  ) => api.patch<SavedReply>(`/v1/saved-replies/${encodeURIComponent(id)}`, body),

  /** Count an INSERT. Best-effort: the reply is already in the box, so a
   *  failed counter must never surface to the person writing. */
  markUsed: (id: string) =>
    api.post<{ counted: boolean }>(`/v1/saved-replies/${encodeURIComponent(id)}/used`, {}),
};
