/**
 * Ads hub channel registry — /dashboard/ads is the ONE ads surface for every
 * ad channel, with a channel selector instead of a page per platform.
 *
 * Adding a channel means: one entry here + one panel component under
 * `_components/`, and pointing that channel's `cfg_integrations` /
 * channels.config `dashboardPath` at `/dashboard/ads?channel=<key>`. No new
 * route, no new nav item.
 *
 * Only channels that HAVE a panel belong here. A connector that is merely
 * catalogued (meta_ads, google_ads) stays out until its panel exists —
 * otherwise the selector would offer a tab that renders nothing.
 */

/**
 * Shape each registry entry must satisfy. The exported `AdsChannelDef` and
 * `AdsChannelKey` are DERIVED from the array below, so the key union can never
 * drift from the registry and no lookup needs an unchecked cast.
 */
interface AdsChannelShape {
  /** URL value for `?channel=` — stable, user-visible. */
  key: string;
  /** Tab label. */
  label: string;
  /** `int_connections.provider` / `cfg_integrations.key` for this channel. */
  providerKey: string;
  /** Sub-header copy shown while this channel is selected. */
  description: string;
  /**
   * Crons this channel's data depends on — rendered by <CronToolbar/> in
   * non-prod so the panel can be exercised without waiting for Vercel Cron.
   */
  crons: readonly string[];
  /**
   * react-query key prefixes to invalidate after a cron fires, so the panel
   * reflects what the trigger just wrote.
   */
  invalidateQueryKeys: readonly (readonly string[])[];
  /**
   * Search params this channel's panel owns. Switching away drops them —
   * they're meaningless to another channel and would leak across tabs.
   * Required (use []) so the hub can read it off any entry without narrowing.
   */
  ownedParams: readonly string[];
}

/** Selector order. First entry is the fallback when nothing is connected. */
export const ADS_CHANNELS = [
  {
    key: "linkedin",
    label: "LinkedIn Ads",
    providerKey: "linkedin_ads",
    description:
      "Boost your proven LinkedIn posts into campaigns — created as non-spending drafts you activate when ready.",
    crons: ["performance-sync", "growth-optimizer"],
    invalidateQueryKeys: [["linkedin-managed-campaigns"], ["content-hub-integrations"]],
    ownedParams: [],
  },
  {
    key: "x",
    label: "X Ads",
    providerKey: "x_ads",
    description: "Launch and manage promoted-tweet campaigns on X.",
    crons: ["x-ads-metrics-sync"],
    invalidateQueryKeys: [["x-ads-analytics"], ["x-ads-campaigns"]],
    ownedParams: ["account"],
  },
] as const satisfies readonly AdsChannelShape[];

export type AdsChannelDef = (typeof ADS_CHANNELS)[number];
/** Exactly the keys present in ADS_CHANNELS — derived, never hand-maintained. */
export type AdsChannelKey = AdsChannelDef["key"];

const BY_KEY: ReadonlyMap<string, AdsChannelDef> = new Map(
  ADS_CHANNELS.map((c) => [c.key, c] as const),
);

/** Search-param name carrying the selected channel. */
export const ADS_CHANNEL_PARAM = "channel";

export function isAdsChannelKey(value: string | null | undefined): value is AdsChannelKey {
  return ADS_CHANNELS.some((c) => c.key === value);
}

export function getAdsChannel(key: AdsChannelKey): AdsChannelDef {
  const channel = BY_KEY.get(key);
  // Unreachable while `key` is an AdsChannelKey (derived from this very
  // registry) — thrown rather than cast away so a future refactor that breaks
  // the invariant fails loudly instead of returning undefined.
  if (!channel) throw new Error(`Unknown ads channel: ${key}`);
  return channel;
}

/**
 * The search string for switching to `next`, given the current params.
 *
 * Extracted from the hub so the param-dropping rule is unit-testable: it used
 * to live inline in the page component, where deleting it would not have failed
 * a single test.
 */
export function nextAdsHubSearch(
  current: URLSearchParams | ReadonlyURLSearchParamsLike,
  next: AdsChannelKey,
): string {
  const search = new URLSearchParams(current.toString());
  search.set(ADS_CHANNEL_PARAM, next);
  for (const c of ADS_CHANNELS) {
    if (c.key === next) continue;
    for (const owned of c.ownedParams) search.delete(owned);
  }
  return search.toString();
}

/** Structural type for Next's ReadonlyURLSearchParams (avoids a next/navigation import here). */
interface ReadonlyURLSearchParamsLike {
  toString(): string;
}

/**
 * Which channel to show.
 *
 *  1. An explicit, valid `?channel=` always wins — a deep-link from the
 *     Content hub's Manage button must land on the channel it names even when
 *     that channel isn't connected yet (the panel then shows its connect CTA).
 *  2. Otherwise the first CONNECTED channel in registry order, so a customer
 *     with only X Ads doesn't open onto an empty LinkedIn tab.
 *  3. Otherwise the first registered channel.
 *
 * `connectedProviderKeys` should include channels needing re-auth: the
 * connection exists, so the panel belongs on screen with a reconnect banner
 * rather than the "Connect" empty state. What sits UNDER that banner differs by
 * channel — LinkedIn Ads lists from local rows and keeps working, while every X
 * Ads list is fetched live through a connection the api requires to be active,
 * so it shows a reconnect prompt. Each panel owns that copy.
 */
export function resolveAdsChannel(
  param: string | null | undefined,
  connectedProviderKeys: ReadonlySet<string>,
): AdsChannelKey {
  if (isAdsChannelKey(param)) return param;
  const connected = ADS_CHANNELS.find((c) => connectedProviderKeys.has(c.providerKey));
  return (connected ?? ADS_CHANNELS[0]).key;
}
