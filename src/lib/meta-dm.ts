/**
 * Messenger and Instagram messages: the status the Facebook Pages card switches and the Inbox read, and their wording.
 * The api is `GET /v1/meta/dm/status` (a 404 while no channel is released: the switches then render NOTHING),
 * `POST /v1/meta/dm/connect` and `POST /v1/meta/dm/disconnect`.
 */

import { api, API_BASE_URL } from "@/lib/api";

export type DmChannel = "messenger" | "instagram";

export interface DmStatusPage {
  pageId: string;
  pageName: string | null;
  instagramUsername: string | null;
  connectionId: string;
  messenger: DmStatusChannel;
  instagram: DmStatusChannel;
}

export interface DmStatusChannel {
  available: boolean;
  enabled: boolean;
  /** Another Peakhour account already uses this Page (or Instagram account) for messages. */
  otherBusiness?: boolean;
}

export interface DmStatus {
  channels: Record<DmChannel, boolean>;
  connected: boolean;
  needsReauth: boolean;
  /** The Page Peakhour uses for this business: the one whose messages are switched on by default. */
  savedPageId?: string | null;
  missingPermissions: Partial<Record<DmChannel, string[]>>;
  pages: DmStatusPage[];
}

/** THE ONE READ OF THE STATUS: the switches on the Facebook Pages card and the Inbox share this key, fetch and cache time. */
export const DM_STATUS_KEY = ["meta-dm-status"] as const;
export const dmStatusQuery = {
  queryKey: DM_STATUS_KEY,
  queryFn: () => api.get<DmStatus>("/v1/meta/dm/status"),
  retry: false,
  staleTime: 30_000,
} as const;

export const DM_COPY = {
  messenger: "Messenger messages",
  instagram: (username: string | null) => (username ? `Instagram messages (@${username})` : "Instagram messages"),
  noInstagram: "No Instagram account is linked to this Page.",
  otherBusiness: "Another Peakhour business already uses this Page for messages, so it cannot be turned on here.",
  noAccess: "Meta did not give Peakhour messaging access.",
  reconnect: "Reconnect Meta",
  note: "Turning this off stops new messages reaching your Inbox. Past conversations stay.",
  failed: "Couldn't change messages. Try again in a moment.",
} as const;

const RETURN_TO = "/dashboard/integrations";

/** The Meta login with the messaging permissions asked in addition (the api adds only the released channels' permissions). */
export const metaMessagingAuthorizeUrl = (): string =>
  `${API_BASE_URL}/v1/integrations/facebook/authorize?messaging=1&returnTo=${encodeURIComponent(RETURN_TO)}`;

/**
 * Why a channel that is off cannot be switched on, or null when it can. Most specific first.
 * Instagram "not linked" is the api saying the channel is unavailable with NO permission gap: the api counts a permission gap only
 * on a Page that has the account, so a linked account whose profile name could not be read never lands here.
 */
export function dmWhyNot(status: DmStatus, page: DmStatusPage, channel: DmChannel): { text: string; reconnect: boolean } | null {
  const state = page[channel];
  if (state.enabled) return null;
  if (state.otherBusiness) return { text: DM_COPY.otherBusiness, reconnect: false };
  const gap = (status.missingPermissions?.[channel]?.length ?? 0) > 0;
  if (status.needsReauth || gap) return { text: DM_COPY.noAccess, reconnect: true };
  if (state.available) return null;
  return channel === "instagram" ? { text: DM_COPY.noInstagram, reconnect: false } : { text: DM_COPY.noAccess, reconnect: true };
}

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function dmErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : DM_COPY.failed;
}
