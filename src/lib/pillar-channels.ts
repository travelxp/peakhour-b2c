import type { ResolvedIntegration } from "@/lib/catalog";
import { PILLAR_ORDER, PILLARS } from "@/lib/pillars";

/**
 * ONE availability rule, shared by the two surfaces on the homepage that state
 * it: the "Channels & platforms" chips inside a pillar card, and the
 * catalog-driven integrations grid further down the page.
 *
 * They disagreed by construction. The grid resolved every card against
 * /v1/platform/catalog and badged it; the chips were plain strings that could
 * only ever be silent. That is not a future problem — production badges
 * eleven cards "Coming soon" right now, four of which (Shopify, WordPress,
 * LinkedIn Ads, Google Ads) the pillar chips were naming a few hundred pixels
 * above with nothing said about them at all.
 *
 * Both surfaces now ask this function and render what it returns.
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
 * The connector keys the homepage may badge "Coming soon" — for BOTH the grid
 * and the chips.
 *
 * Three rules, in order:
 *
 *  1. Nothing advertisable → badge nothing. The grid is rendering its static
 *     fallback, which is restricted to connectors that are live, and a chip
 *     claiming otherwise would be the only voice on the page saying so.
 *
 *  2. A row the resolver marks coming_soon → badge it, UNLESS it carries
 *     `cappedByPlatformStage`.
 *
 *     That flag is the whole subtlety, and it is PER ROW, not global. While
 *     the platform sits at coming_soon/waitlist the resolver forces
 *     `surfacedState` to coming_soon on every row — but it only sets
 *     `cappedByPlatformStage` on the ones that are live underneath. So the
 *     flag is exactly what separates "the platform hasn't launched" (already
 *     said by the announcement bar and the waitlist CTA, and not worth
 *     stamping on WhatsApp, X and Instagram) from "this connector isn't
 *     built yet". Reading the cap as a global gate — "if any row is capped,
 *     say nothing" — deletes all eleven badges production shows today.
 *
 *  3. Plus every pillar chip key that isn't in the list at all. This is the
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
export function badgedComingSoonKeys(
  /** The marketing-advertisable rows — publicMarketingIntegrations() output. */
  published: readonly ResolvedIntegration[],
  /**
   * Every row the catalog returned, advertisable or not. Used for one thing:
   * telling a connector that is on its way out from one that hasn't arrived,
   * both of which are simply ABSENT from `published`.
   */
  all: readonly ResolvedIntegration[],
): string[] {
  if (published.length === 0) return [];

  const publishedKeys = new Set(published.map((i) => i.key));
  const retiring = new Set(
    all.filter((i) => i.status === "deprecated").map((i) => i.key),
  );
  const badged = new Set(
    published
      .filter((i) => i.surfacedState === "coming_soon" && !i.cappedByPlatformStage)
      .map((i) => i.key),
  );
  for (const key of PILLAR_CONNECTOR_KEYS) {
    if (!publishedKeys.has(key) && !retiring.has(key)) badged.add(key);
  }
  return [...badged];
}
