import type { ChannelConfig } from "./channels.config";

/**
 * Grouping and search for the Content channels hub — pure, so it can be tested
 * without the page.
 *
 * ── ★★WHY GROUPING BEAT SORTING
 *
 * The hub used to render every channel in catalog order, so a merchant with two
 * connections and thirty available integrations had to read thirty rows to find
 * the two that were theirs. Connected → Available → Coming soon puts what you
 * own at the top of the list.
 *
 * ★But an ORDER alone is invisible. Three sorted-but-unlabelled runs look like
 * one arbitrary list, and the reader has no way to know that the boundary
 * between row 2 and row 3 means anything. The groups carry headings for that
 * reason — and the heading is also what makes an empty group legible: "no
 * connected channels yet" says something, where its silent absence would not.
 *
 * ── ★★AND CONNECTEDNESS IS NOT LIFECYCLE
 *
 * The bucket is decided by `resolveChannelCta`, never by `channel.status`. A
 * merchant holding a broken connection is neither Connected nor Coming soon —
 * that conflation is what once badged a `needs_reauth` Shopify row "Coming
 * soon" and disabled the only route to fixing it. Anything that is neither
 * connected nor presented as coming-soon is Available, which is exactly what
 * a broken connection should read as: a row you can act on.
 */

export type ChannelGroupKey = "connected" | "available" | "coming_soon";

export interface ChannelGroup {
  key: ChannelGroupKey;
  title: string;
  /** Shown when the group has no rows. */
  empty: string;
  channels: ChannelConfig[];
}

const GROUP_META: Record<ChannelGroupKey, { title: string; empty: string }> = {
  connected: {
    title: "Connected",
    empty: "Nothing connected yet. Pick one below to get started.",
  },
  available: {
    title: "Available",
    empty: "Everything available here is already connected.",
  },
  coming_soon: {
    title: "Coming soon",
    empty: "Nothing queued up right now.",
  },
};

/** The state of one row, as the page has already resolved it. */
export interface ChannelState {
  isConnected: boolean;
  showsComingSoon: boolean;
}

/**
 * Bucket channels into the three groups, preserving catalog order within each.
 *
 * Stable within a group on purpose: catalog order encodes the CMS's own
 * priority, and re-sorting alphabetically inside a bucket would throw that away
 * for no gain.
 */
export function groupChannels(
  channels: readonly ChannelConfig[],
  stateOf: (channel: ChannelConfig) => ChannelState,
): ChannelGroup[] {
  const buckets: Record<ChannelGroupKey, ChannelConfig[]> = {
    connected: [],
    available: [],
    coming_soon: [],
  };
  for (const channel of channels) {
    const state = stateOf(channel);
    // Order matters: connected wins over coming-soon, because a merchant CAN
    // hold a connection to a channel the catalog still calls unlaunched (a
    // Shopify App Store install never consults a lifecycle).
    const key: ChannelGroupKey = state.isConnected
      ? "connected"
      : state.showsComingSoon
        ? "coming_soon"
        : "available";
    buckets[key].push(channel);
  }
  return (["connected", "available", "coming_soon"] as const).map((key) => ({
    key,
    ...GROUP_META[key],
    channels: buckets[key],
  }));
}

/**
 * Filter channels by a free-text query over name, description and category.
 *
 * ★DESCRIPTION AND CATEGORY ARE SEARCHED, NOT JUST THE NAME. Somebody looking
 * for a newsletter tool does not necessarily know it is called Beehiiv, and a
 * search that only matched names would answer "no results" to the query most
 * likely to be typed by the person who most needs the list.
 *
 * An empty or whitespace-only query returns the input untouched — the caller
 * must not have to special-case "not searching".
 */
export function filterChannels(
  channels: readonly ChannelConfig[],
  query: string,
): ChannelConfig[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...channels];
  return channels.filter((c) =>
    `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(q),
  );
}
