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
 * catalogued (google_ads) stays out until its panel exists — otherwise the
 * selector would offer a tab that renders nothing. (`meta_ads` joined in M-16,
 * with its panel.)
 *
 * ── ★★M-13: WHEN `meta_ads` JOINS, WHICH ROUTES ITS PANEL MAY CALL ───────
 *
 * `lib/meta-ads-surface.ts` holds that list, and `meta-ads-surface.test.ts`
 * fails the moment a b2c file names anything outside it. The distinction is
 * not stylistic: two of the api's Meta ads routes were a **passthrough** —
 * they handed the request to Meta and wrote no `ad_campaigns` row — and a
 * campaign created that way exists at Meta and does not exist here, so
 * `ad-campaign-monitor`, the spend caps and the merchant's kill switch cannot
 * see it at all. Those two are deleted; the rest record what they did.
 *
 * ⏸NO ROUTE PATH IS SPELLED OUT IN THIS FILE, DELIBERATELY. The guard refuses
 * an UNMANAGED literal anywhere under `src/`, comments included — the next
 * author reads a path out of prose as readily as out of code. Paths are written
 * in the contract module and in the one client, `lib/api/meta-ads.ts`, which
 * builds every one through `metaAdsUrl`.
 *
 * ✅The Meta panel is **M-16**, and it has landed. The guard's ADS_CHANNELS case
 * was written to fail when it did; it now asserts the opposite — that `meta`
 * is registered AND that its panel reaches Meta only through that client.
 */

import { META_VIRTUAL_CARDS, type MetaVirtualCard } from "@/lib/integrations-meta";

/**
 * The provider keys the hub counts as connected, from `/v1/integrations`.
 *
 * ⚠️★★EXPANDED FIRST (M-16). The api reports Meta as ONE `facebook` row whose
 * ads capability is a virtual `meta_ads` row derived by
 * `flattenMetaIntegration` — the expansion /dashboard/integrations already
 * uses. Matching the raw list against `meta_ads` finds nothing, so a merchant
 * whose only ad channel is Meta would open onto an empty LinkedIn tab.
 *
 * `needs_reauth` counts: the connection exists, and the panel belongs on
 * screen with a reconnect banner rather than a Connect empty state.
 *
 * ⚠️★★BUT ONLY FOR A CAPABILITY THE STALE CONNECTION ACTUALLY HAS (review
 * R1.2). `flattenMetaIntegration` copies the parent's `status` onto EVERY
 * virtual row, so a stale Pages-only connection — Ads switched off, no ad
 * account — came out as a `needs_reauth` `meta_ads`, and the hub opened it on
 * the Meta tab behind a reconnect banner instead of saying "Connect Meta".
 * A stale virtual row counts only if it would be connected once reconnected:
 * the capability is not switched off and its resources exist, the same two
 * conditions the flattening applies to a LIVE row.
 */
export function connectedAdsProviderKeys(integrations: readonly AdsIntegrationRow[]): Set<string> {
  const set = new Set<string>();
  for (const i of integrations) {
    if (i.provider === "facebook") {
      for (const card of META_VIRTUAL_CARDS) {
        if (metaCapabilityState(i, card) !== "absent") set.add(card.virtualProvider);
      }
      continue;
    }
    if (i.connected === true || i.status === "needs_reauth") set.add(i.provider);
  }
  return set;
}

/** The slice of a `/v1/integrations` row the hub and the Meta panel read. */
export interface AdsIntegrationRow {
  provider: string;
  connected?: boolean;
  status?: string;
  account?: { extra?: Record<string, unknown> };
}

/**
 * One Meta capability of one `facebook` row: live, stale-but-real, or absent.
 *
 * ★THE ONE RULE both the hub's channel pick and the Meta panel's gate read, so
 * the two cannot disagree about whether a merchant is connected — which is what
 * R1.2 found them able to do through `status`.
 */
export function metaCapabilityState(
  row: AdsIntegrationRow,
  card: MetaVirtualCard,
): "connected" | "needs_reauth" | "absent" {
  if (row.provider !== "facebook") return "absent";
  const extra = (row.account?.extra ?? {}) as Record<string, unknown>;
  const caps = (extra.capabilities ?? {}) as Record<string, { enabled?: boolean } | undefined>;
  const usable = card.hasResources(extra) && caps[card.capabilityKey]?.enabled !== false;
  if (!usable) return "absent";
  if (row.connected === true) return "connected";
  if (row.status === "needs_reauth") return "needs_reauth";
  return "absent";
}

/** The Meta ADS capability across every `facebook` row: the best state any has. */
export function metaAdsConnectionState(
  integrations: readonly AdsIntegrationRow[],
): "connected" | "needs_reauth" | "absent" {
  const card = META_VIRTUAL_CARDS.find((c) => c.virtualProvider === "meta_ads");
  if (!card) return "absent";
  const states = integrations.map((i) => metaCapabilityState(i, card));
  if (states.includes("connected")) return "connected";
  if (states.includes("needs_reauth")) return "needs_reauth";
  return "absent";
}

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
    crons: ["ad-campaign-monitor", "performance-sync", "growth-optimizer"],
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
  /**
   * ★★M-16. `providerKey` is the VIRTUAL `meta_ads` row, not `facebook`: the
   * api reports one `facebook` connection and `flattenMetaIntegration` derives
   * the ads capability from it. So the hub expands before it matches — see
   * `connectedAdsProviderKeys` below — or a merchant with only Meta connected
   * opens onto an empty LinkedIn tab.
   *
   * `meta-conversion-sweep` is here because this panel's dataset card is the
   * only way that sweep can ever have something to send; `ad-campaign-monitor`
   * because it is what watches a managed Meta campaign's spend.
   */
  {
    key: "meta",
    label: "Meta Ads",
    providerKey: "meta_ads",
    description:
      "See and pause your Facebook and Instagram campaigns, and choose where purchases from Meta ads are reported.",
    crons: ["ad-campaign-monitor", "meta-conversion-sweep"],
    // ⚠️Every level the table can show (review R1.6): the monitor can pause a
    //  campaign, and an expanded ad set's "not serving" note reads its parent.
    invalidateQueryKeys: [
      ["meta-ads-accounts"],
      ["meta-ads-campaigns"],
      ["meta-ads-adsets"],
      ["meta-ads-ads"],
      ["meta-ads-insights"],
      ["meta-ads-dataset"],
      ["content-hub-integrations"],
    ],
    ownedParams: ["adAccount"],
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
