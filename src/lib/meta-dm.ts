/**
 * Messenger and Instagram messages (Inbox lane I3e): the connect screen's data and wording.
 * The api is `GET /v1/meta/dm/status` (a 404 while no channel is released: the screen then renders NOTHING),
 * `POST /v1/meta/dm/connect` and `POST /v1/meta/dm/disconnect`.
 */

import { api } from "@/lib/api";

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

export const DM_CHANNEL_LABEL: Record<DmChannel, string> = { messenger: "Messenger", instagram: "Instagram messages" };

export const DM_PANEL_ID = "meta-dm-connect";

/** THE ONE READ OF THE STATUS: the panel, the line on the Facebook Pages card and the Inbox all share this key, fetch and cache time. */
export const DM_STATUS_KEY = ["meta-dm-status"] as const;
export const dmStatusQuery = {
  queryKey: DM_STATUS_KEY,
  queryFn: () => api.get<DmStatus>("/v1/meta/dm/status"),
  retry: false,
  staleTime: 30_000,
} as const;

export const DM_COPY = {
  title: "Messenger and Instagram messages",
  intro:
    "Peakhour answers shoppers who message your Facebook Page or Instagram account, and hands the chat to your team when it should. Every conversation shows in your Inbox. It is on by default for the Page Peakhour uses, which you choose in Meta accounts above. Turn it off here any time.",
  window: "You can reply to a customer for 24 hours after their last message. Meta sets that rule for these channels.",
  connectMeta: "Connect Meta",
  reconnectMeta: "Reconnect Meta",
  grant: "Grant messaging access",
  grantWhy: "Peakhour needs messaging access to your Page before it can answer messages. Meta will ask you to approve it.",
  connectWhy: "Connect Meta to choose a Page.",
  reconnectWhy: "Your Meta connection needs to be reconnected first.",
  noPages: "We could not find a Facebook Page on your Meta connection. Reconnect Meta and choose the Page you want to use.",
  otherBusiness: "Another Peakhour account already uses this Page for messages, so it cannot be turned on here.",
  noAccess: "Meta did not give Peakhour messaging access. Use the button above to connect Meta again and accept the messaging permissions, then turn this on.",
  noInstagram: "Link an Instagram professional account to this Page in Instagram settings to use Instagram messages.",
  on: "On",
  onFor: (page: string) => `On for ${page}`,
  pointerOn: (page: string) => `Messages: on for ${page}`,
  pointerOff: "Messages: off",
  off: "Off",
  turnOn: "Turn on",
  turnOff: "Turn off",
} as const;

/** The Page's name for a sentence: never an empty string. */
export const dmPageName = (page: Pick<DmStatusPage, "pageName">): string => page.pageName?.trim() || "your Facebook Page";

/** Why a channel that is off cannot be switched on, in words, or null when it can (or simply is off). Most specific first. */
export function dmWhyNot(page: DmStatusPage, channel: DmChannel): string | null {
  const state = page[channel];
  if (state.enabled) return null;
  if (channel === "instagram" && !page.instagramUsername) return DM_COPY.noInstagram;
  if (state.otherBusiness) return DM_COPY.otherBusiness;
  if (!state.available) return DM_COPY.noAccess;
  return null;
}

/**
 * The one line on the Facebook Pages card: whether messages are on for the Page Peakhour uses (`pageId` when the card knows it, else
 * the api's `savedPageId`). ★NEVER NAMES A DIFFERENT PAGE: when that Page is not in the status there is no line, not a guess.
 * Null too while messaging is not released (the panel is hidden as well).
 */
export function dmPointer(status: DmStatus, pageId?: string | null): { on: boolean; text: string } | null {
  if (!status.channels.messenger && !status.channels.instagram) return null;
  const id = pageId ?? status.savedPageId;
  const saved = id ? status.pages.find((p) => p.pageId === id) : undefined;
  if (!saved) return null;
  const on = (["messenger", "instagram"] as const).some((c) => status.channels[c] && saved[c].enabled);
  return { on, text: on ? DM_COPY.pointerOn(dmPageName(saved)) : DM_COPY.pointerOff };
}

/** Whether the screen offers the Meta permission step: not connected, or a released channel's permissions are not all granted. */
export function needsMetaStep(status: DmStatus): "connect" | "reconnect" | "grant" | null {
  if (status.needsReauth) return "reconnect";
  if (!status.connected) return "connect";
  // an older api may omit the field: nothing is then known to be missing
  const missingBy = status.missingPermissions ?? {};
  const missing = (Object.keys(missingBy) as DmChannel[]).some((c) => status.channels[c] && (missingBy[c]?.length ?? 0) > 0);
  return missing ? "grant" : null;
}

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function dmErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : "That did not work. Check your connection and try again.";
}
