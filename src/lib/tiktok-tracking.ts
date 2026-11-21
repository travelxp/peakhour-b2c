import { api } from "@/lib/api";

/**
 * The TikTok tracking card's api layer (TT-PX): the pixel that receives a business's orders (peakhour-api EV-1,
 * `src/v1/routes/tiktok-ads/index.ts`) and the catalog feed URL (CAT-G3). The words a merchant reads live here so the
 * card and its tests share them.
 */

export interface TikTokAdvertiser {
  id: string;
  name: string;
}

export interface TikTokPixelOption {
  code: string;
  name?: string;
}

export type TikTokPixelNotUsable = "no_pixel_selected" | "pixel_advertiser_gone" | "pixel_refused";

export interface TikTokPixelChoice {
  code: string;
  advertiserId: string;
  name?: string;
  /** The user (hex id) who chose it, and when. The name is looked up from the team, never stored. */
  selectedBy?: string;
  selectedAt?: string;
}

/** `GET` and `PUT /v1/tiktok/ads/pixels/selected`: sending, or why nothing is sent. */
export interface TikTokPixelStatus {
  sending: boolean;
  reason?: TikTokPixelNotUsable;
  /** The api's sentence for a not-sending state, shown as written. */
  message?: string;
  pixel?: TikTokPixelChoice;
}

export interface TikTokCatalogFeed {
  enabled: boolean;
  url: string | null;
  createdAt?: string | null;
  rotatedAt?: string | null;
  lastFetchedAt?: string | null;
  itemCount?: number;
  /** Products left out of the feed, by reason: `{ reason: count }`. */
  skipped?: Record<string, number>;
}

export const TIKTOK_TRACKING_COPY = {
  title: "TikTok tracking",
  intro: "Choose the TikTok pixel that should receive your orders. Until you choose one, Peakhour sends nothing to TikTok.",
  permission: "Your TikTok connection is missing a permission. Reconnect TikTok, or contact support if this keeps happening.",
  reconnect: "Reconnect TikTok",
  choose: "Choose a pixel",
  chooseAgain: "Choose again",
  change: "Change pixel",
  save: "Save choice",
  cancel: "Cancel",
  noAdvertisers: "No TikTok advertiser account is on this connection yet. Reconnect TikTok and allow access to your advertiser account.",
  noPixels: "This advertiser has no pixels. Create one in TikTok Events Manager first.",
  moreThanListed: "This advertiser has more pixels than we can list. If yours is missing, contact support.",
  loadFailed: "We could not read your TikTok pixel choice. Try again in a moment.",
  listFailed: "We could not load this advertiser's pixels. Try again in a moment.",
  saveFailed: "We could not save that choice. Try again.",
  truncatedAccounts: "Some of your TikTok ad accounts may not be listed. Reconnect TikTok to refresh the list, or contact support.",
  saved: "Orders will now be sent to that TikTok pixel.",
} as const;

export const TIKTOK_FEED_COPY = {
  title: "Product feed for TikTok catalog ads",
  intro: "Create a link to your product list and paste it into TikTok Catalog Manager as a scheduled feed. TikTok then reads your products from it.",
  create: "Create feed URL",
  rotate: "Rotate URL",
  rotateNote: "Rotating makes a new link. The old one stops working, so paste the new one into TikTok Catalog Manager.",
  turnOff: "Turn off",
  copy: "Copy",
  copied: "Copied",
  copyFallback: "Copy failed. Select the link and copy it yourself.",
  shownOnce: "Copy this link now. For your safety we show it only once. If you lose it, rotate the URL to get a new one.",
  hiddenNow: "The feed is on. The link was shown when it was created. Rotate the URL to get a new one.",
  off: "The feed is off.",
  failed: "We could not change the feed. Try again.",
  noUrl: "The new link could not be shown; rotate again to get it.",
} as const;

export function tiktokErrorCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

export function tiktokErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}

/** The advertisers on the tiktok_ads grant, from the integration row (`account.extra.adAccounts`): there is no separate route. */
export function tiktokAdvertisersTruncated(extra: Record<string, unknown> | undefined): boolean {
  return extra?.adAccountsTruncated === true;
}

export function tiktokAdvertisers(extra: Record<string, unknown> | undefined): TikTokAdvertiser[] {
  const raw = extra?.adAccounts;
  if (!Array.isArray(raw)) return [];
  const out: TikTokAdvertiser[] = [];
  for (const a of raw as Array<{ id?: unknown; name?: unknown }>) {
    if (a?.id == null || String(a.id).length === 0) continue;
    const id = String(a.id);
    out.push({ id, name: typeof a.name === "string" && a.name ? a.name : id });
  }
  return out;
}

/** The refusals worth quoting: the api's sentence for these is plain. Anything else gets our own words. */
const QUOTABLE_SAVE_CODES = new Set(["PIXEL_NOT_FOUND", "PIXEL_VERIFY_INCOMPLETE"]);

export function saveErrorMessage(err: unknown): string {
  const code = tiktokErrorCode(err);
  const message = (err as { message?: string } | null)?.message;
  return code && QUOTABLE_SAVE_CODES.has(code) && message ? message : TIKTOK_TRACKING_COPY.saveFailed;
}

/** Errors the merchant fixes by reconnecting: a missing permission, an expired grant, or no connection. */
export function needsReconnect(err: unknown): boolean {
  const code = tiktokErrorCode(err);
  return code === "TIKTOK_PERMISSION" || code === "NEEDS_REAUTH" || code === "NOT_CONNECTED";
}

/** Skipped products as a sentence, or null when none. */
export function skippedLine(skipped: TikTokCatalogFeed["skipped"]): string | null {
  const total = Object.values(skipped ?? {}).reduce((n, c) => n + (typeof c === "number" ? c : 0), 0);
  return total > 0 ? `${total} skipped` : null;
}

export const tiktokTrackingApi = {
  listPixels: (advertiserId: string) =>
    api.get<{ pixels: TikTokPixelOption[]; truncated?: boolean; status?: TikTokPixelStatus }>(
      `/v1/tiktok/ads/pixels?advertiserId=${encodeURIComponent(advertiserId)}`,
    ),
  getSelected: () => api.get<TikTokPixelStatus>("/v1/tiktok/ads/pixels/selected"),
  select: (advertiserId: string, pixelCode: string) =>
    api.put<TikTokPixelStatus>("/v1/tiktok/ads/pixels/selected", { advertiserId, pixelCode }),
  getFeed: () => api.get<TikTokCatalogFeed>("/v1/tiktok/ads/catalog-feed"),
  createFeed: () => api.post<TikTokCatalogFeed>("/v1/tiktok/ads/catalog-feed", {}),
  disableFeed: () => api.delete<unknown>("/v1/tiktok/ads/catalog-feed"),
};
