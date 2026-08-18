import type { ResolvedIntegration } from "@/lib/catalog";
import { PILLAR_ORDER, PILLARS } from "@/lib/pillars";

/**
 * ONE availability rule, shared by the two surfaces on the homepage that state
 * it: the "Channels & platforms" chips inside a pillar card, and the
 * catalog-driven integrations grid further down the page.
 *
 * They used to disagree by construction. The grid resolved every card against
 * /v1/platform/catalog and badged it; the chips were plain strings that could
 * only ever be silent. Nobody noticed because the platform stage currently
 * caps every row, so the grid badges nothing either — but the moment the stage
 * advances, "Shopify" reads as available in a chip and "Coming soon" in a card
 * a few hundred pixels below it, on the same page, about the same connector.
 *
 * Both surfaces now ask this function and render what it returns.
 *
 * Server-only by construction — it takes the resolved catalog. The homepage
 * calls it once and passes the result down as plain strings, so the client
 * bundle gets an answer rather than the policy that produced it.
 */

/**
 * Every catalog key the pillar chips name, deduped. Derived from the pillar
 * content itself so adding a chip cannot forget to register its key —
 * the fail-closed branch below reads this list, and a key missing from it
 * would silently opt that chip out of badging altogether.
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
 *  1. No published catalog → badge nothing. The grid is rendering its static
 *     fallback, which is restricted to connectors that are live, and a chip
 *     claiming otherwise would be the only voice on the page saying so.
 *
 *  2. The platform stage is capping → badge nothing. The resolver marks EVERY
 *     row coming_soon while the platform sits at coming_soon/waitlist, so a
 *     badge would be a statement about the platform, not the connector — and
 *     the announcement bar and the waitlist CTA already carry that. (The flag
 *     is per row but the cap is global; treating ANY capped row as capping is
 *     deliberately the conservative reading — it suppresses badges rather than
 *     inventing them.)
 *
 *  3. Otherwise → every published row the resolver marks coming_soon, PLUS
 *     every pillar chip key the catalog does not publish at all. That last
 *     clause is the fail-closed half: a chip naming a connector we cannot
 *     prove is live gets badged, because silence is the over-claim. It cannot
 *     affect the grid, whose cards are published rows by definition.
 */
export function badgedComingSoonKeys(
  published: readonly ResolvedIntegration[],
): string[] {
  if (published.length === 0) return [];
  if (published.some((i) => i.cappedByPlatformStage)) return [];

  const publishedKeys = new Set(published.map((i) => i.key));
  const badged = new Set(
    published.filter((i) => i.surfacedState === "coming_soon").map((i) => i.key),
  );
  for (const key of PILLAR_CONNECTOR_KEYS) {
    if (!publishedKeys.has(key)) badged.add(key);
  }
  return [...badged];
}
