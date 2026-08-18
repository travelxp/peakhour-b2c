import type { ResolvedIntegration } from "@/lib/catalog";
import { STATIC_FALLBACK_KEYS } from "@/lib/integrations-fallback";
import { PILLAR_ORDER, PILLARS } from "@/lib/pillars";
import { CHANNELS, type ChannelKey } from "@/lib/pricing-catalog";

/**
 * ONE availability rule, shared by every marketing surface that states it:
 * the "Channels & platforms" chips inside a homepage pillar card, the
 * catalog-driven integrations grid further down that page, and the channel
 * cards on /pricing and /pricing/[pillar].
 *
 * They disagreed by construction. The grid resolved every card against
 * /v1/platform/catalog and badged it; the chips were plain strings that could
 * only ever be silent. That is not a future problem — production badges
 * eleven cards "Coming soon" right now, four of which (Shopify, WordPress,
 * LinkedIn Ads, Google Ads) the pillar chips were naming a few hundred pixels
 * above with nothing said about them at all.
 *
 * All of them now ask this function and render what it returns. The pricing
 * channels were the last holdout and the loudest: their cards carry install
 * copy and, for Shopify, an outbound link to an App Store listing — the
 * strongest availability claim on the site, made with nothing behind it.
 *
 * Server-only by construction — it takes the resolved catalog. The homepage
 * calls it once and passes the result down as plain strings, so the client
 * bundle gets an answer rather than the policy that produced it.
 */

/**
 * Every catalog key the pillar chips name, deduped.
 *
 * DERIVED from the pillar content rather than hand-listed beside it, because
 * the fail-closed branch below reads this list to decide what to badge: a
 * hand-listed key that someone forgot to add would opt its chip out of
 * badging silently, which is the exact failure this whole module exists to
 * prevent. Deriving it makes that impossible rather than merely unlikely.
 */
export const PILLAR_CONNECTOR_KEYS: readonly string[] = [
  ...new Set(
    PILLAR_ORDER.flatMap((slug) =>
      PILLARS[slug].channels.flatMap((c) => (c.key ? [c.key] : [])),
    ),
  ),
];

/**
 * The same, for the channel cards on /pricing and /pricing/[pillar]. Separate
 * constant because the two lists genuinely differ — `bigcommerce` is claimed
 * only by pricing, `linkedin_ads` only by the pillar chips — and knowing which
 * surface put a key in the fail-closed set is worth keeping.
 */
export const CHANNEL_CONNECTOR_KEYS: readonly string[] = [
  ...new Set(
    Object.values(CHANNELS).flatMap((c) =>
      c.connectorKey ? [c.connectorKey] : [],
    ),
  ),
];

/** Every key any marketing surface names, and so every key that can fail closed. */
export const MARKETING_CONNECTOR_KEYS: readonly string[] = [
  ...new Set([...PILLAR_CONNECTOR_KEYS, ...CHANNEL_CONNECTOR_KEYS]),
];

/**
 * The connector keys the marketing site may badge "Coming soon" — for the
 * homepage grid and pillar chips AND the pricing channel surfaces alike.
 *
 * Three rules, in order:
 *
 *  1. Nothing advertisable → badge everything the static fallback doesn't
 *     vouch for. This branch is reachable in production, not just at build:
 *     getPublicCatalog() returns null on any fetch failure, and / is dynamic.
 *
 *     Returning nothing here looks conservative and isn't. The grid degrades
 *     to a list restricted to connectors that are genuinely live, so IT stays
 *     honest — but the other surfaces name several the fallback deliberately
 *     omits (Shopify, WooCommerce, WordPress, LinkedIn Ads, Google Ads,
 *     Google Business Profile, BigCommerce), and silence would render all of
 *     them as available. An API blip would turn this module into the thing it
 *     exists to prevent. So every surface falls back to the same allow-list.
 *
 *  2. A row the resolver marks coming_soon → badge it, UNLESS it carries
 *     `cappedByPlatformStage`.
 *
 *     That flag is the whole subtlety, and it is PER ROW, not global. While
 *     the platform sits at coming_soon/waitlist the resolver forces
 *     `surfacedState` to coming_soon on every row — but it only sets
 *     `cappedByPlatformStage` on the ones that are live underneath. So the
 *     flag is exactly what separates "the platform hasn't launched" from
 *     "this connector isn't built yet" — and the first of those is the
 *     waitlist CTA's job, not something worth stamping on WhatsApp, X and
 *     Instagram. (The CMS announcement banner would carry it too, but it is
 *     disabled in production today, so the CTA is the one that does.)
 *     Reading the cap as a global gate — "if any row is capped, say nothing"
 *     — deletes all eleven badges production shows right now.
 *
 *  3. Plus every key any surface names that isn't in the list at all. This is the
 *     fail-closed half: a chip naming a connector we cannot prove is live
 *     gets badged, because silence is the over-claim. It cannot affect the
 *     grid, whose cards are exactly the rows in this list.
 *
 *     "Isn't in the list", not "isn't in the catalog": the first input is the
 *     MARKETING view, so a row the catalog holds but won't advertise is
 *     absent from it. For hidden/in_development that reads correctly — not
 *     advertisable, can't call it live. For `deprecated` it would read
 *     backwards, announcing a connector on its way OUT as one on its way in,
 *     which is why the second input exists.
 */
export function badgedComingSoonKeys({
  published,
  all,
}: {
  /** The marketing-advertisable rows — publicMarketingIntegrations() output. */
  published: readonly ResolvedIntegration[];
  /**
   * Every row the catalog returned, advertisable or not. Used for one thing:
   * telling a connector that is on its way out from one that hasn't arrived,
   * both of which are simply ABSENT from `published`.
   */
  all: readonly ResolvedIntegration[];
}): string[] {
  // An object, not two positional arrays of the same type, so the roles are
  // named at the call site and a transposition can't compile. (In fairness
  // the two converge on every input I could construct where `all` is a
  // superset of `published`, which is the real invariant — this is about the
  // reader, not a demonstrated bug.)
  if (published.length === 0) {
    return MARKETING_CONNECTOR_KEYS.filter((k) => !STATIC_FALLBACK_KEYS.has(k));
  }

  const publishedKeys = new Set(published.map((i) => i.key));
  const retiring = new Set(
    all.filter((i) => i.status === "deprecated").map((i) => i.key),
  );
  const badged = new Set(
    published
      .filter((i) => i.surfacedState === "coming_soon" && !i.cappedByPlatformStage)
      .map((i) => i.key),
  );
  for (const key of MARKETING_CONNECTOR_KEYS) {
    if (!publishedKeys.has(key) && !retiring.has(key)) badged.add(key);
  }
  return [...badged];
}

/**
 * Does this pricing channel need marking?
 *
 * Exported because three surfaces ask it — the /pricing strip, the /pricing
 * hub cards and /pricing/[pillar] — and they were each writing the same two
 * lines, one of them negated. Three copies of a predicate agree by inspection;
 * one agrees by construction.
 *
 * `native` has no connectorKey and is never badged: the Peakhour web app is
 * where the pillars run, not something connected to.
 */
export function channelIsComingSoon(
  key: ChannelKey,
  badged: ReadonlySet<string>,
): boolean {
  const connector = CHANNELS[key].connectorKey;
  return connector !== undefined && badged.has(connector);
}
