/**
 * Messenger and Instagram messages (Inbox lane I3e): the connect screen's data and wording.
 * The api is `GET /v1/meta/dm/status` (a 404 while no channel is released: the screen then renders NOTHING),
 * `POST /v1/meta/dm/connect` and `POST /v1/meta/dm/disconnect`.
 */

export type DmChannel = "messenger" | "instagram";

export interface DmStatusPage {
  pageId: string;
  pageName: string | null;
  instagramUsername: string | null;
  connectionId: string;
  messenger: { available: boolean; enabled: boolean };
  instagram: { available: boolean; enabled: boolean };
}

export interface DmStatus {
  channels: Record<DmChannel, boolean>;
  connected: boolean;
  needsReauth: boolean;
  missingPermissions: Partial<Record<DmChannel, string[]>>;
  pages: DmStatusPage[];
}

export const DM_CHANNEL_LABEL: Record<DmChannel, string> = { messenger: "Messenger", instagram: "Instagram messages" };

export const DM_COPY = {
  title: "Messenger and Instagram messages",
  intro:
    "Peakhour answers shoppers who message your Facebook Page or Instagram account, and hands the chat to your team when it should. Every conversation shows in your Inbox.",
  window: "You can reply to a customer for 24 hours after their last message. Meta sets that rule for these channels.",
  connectMeta: "Connect Meta",
  reconnectMeta: "Reconnect Meta",
  grant: "Grant messaging access",
  grantWhy: "Peakhour needs messaging access to your Page before it can answer messages. Meta will ask you to approve it.",
  connectWhy: "Connect Meta to choose a Page.",
  reconnectWhy: "Your Meta connection needs to be reconnected first.",
  noPages: "We could not find a Facebook Page on your Meta connection. Reconnect Meta and choose the Page you want to use.",
  noInstagram: "Link an Instagram professional account to this Page in Instagram settings to use Instagram messages.",
  on: "On",
  off: "Off",
  turnOn: "Turn on",
  turnOff: "Turn off",
} as const;

/** Whether the screen offers the Meta permission step: not connected, or a released channel's permissions are not all granted. */
export function needsMetaStep(status: DmStatus): "connect" | "reconnect" | "grant" | null {
  if (status.needsReauth) return "reconnect";
  if (!status.connected) return "connect";
  const missing = (Object.keys(status.missingPermissions) as DmChannel[]).some(
    (c) => status.channels[c] && (status.missingPermissions[c]?.length ?? 0) > 0,
  );
  return missing ? "grant" : null;
}

/** The api's own sentence when it sent one, else a next step: never a bare code. */
export function dmErrorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" && m.trim() ? m : "That did not work. Check your connection and try again.";
}
