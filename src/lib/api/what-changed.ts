import { api } from "@/lib/api";
import type { ComposeChannel } from "@/lib/compose-channel";

/**
 * Client for `GET /v1/content/what-changed`: what is improving, declining or needs attention on each channel, from the results of the business's
 * own posts. Types mirror `peakhour-api/src/v1/services/content/what-changed.ts`. Free: the api calls no model for it.
 */
export type WhatChangedChannelKey = Extract<ComposeChannel, "linkedin" | "x" | "facebook" | "instagram" | "threads">;

export interface WhatChangedDraft {
  channel: WhatChangedChannelKey;
  /** The brief the composer writes the first draft from. */
  brief: string;
}

export interface WhatChangedLine {
  id: string;
  group: "improving" | "declining" | "attention";
  text: string;
  /** Present when the line implies an action. */
  draft?: WhatChangedDraft;
  /** Set when the line already tells the merchant to post more often: a second line that says so is dropped by this flag, never by its words. */
  implies?: "post_more";
}

export interface ChannelWhatChanged {
  channel: WhatChangedChannelKey;
  name: string;
  state: "ok" | "steady" | "not_enough_history";
  /** Posts with results in this period, and how many each period needs before anything is said. */
  measuredPosts: number;
  needed: number;
  lines: WhatChangedLine[];
}

export const whatChangedApi = {
  /** One channel (answered even with no posts), or every channel that has published lately. */
  read: (channel?: WhatChangedChannelKey) =>
    api.get<{ channels: ChannelWhatChanged[] }>(`/v1/content/what-changed${channel ? `?channel=${channel}` : ""}`).then((r) => r.channels),
};
