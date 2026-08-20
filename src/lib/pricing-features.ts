import {
  canonicalFeatureKey,
  featureLabel,
  type ResolvedProductTier,
} from "@/lib/pricing";

/**
 * The customer-facing vocabulary for the pricing surface.
 *
 * `cfg_features.name` is written for the CATALOG — it names the thing we
 * built ("Content Ideator Supervisor", "Commerce workspace", "Peakhour Content
 * (paid)"). A buyer comparing two plans is asking a different question, and a
 * feature table full of internal product names answers none of it. This module
 * is the one place that translation happens, so the cards and the comparison
 * table can never describe the same capability two different ways.
 *
 * It layers OVER the catalog exactly like lib/pricing-catalog.ts does: which
 * tier grants which key still comes from the API, and nothing here can make a
 * plan appear to include something it doesn't. Renaming is all this does.
 */

/**
 * Capabilities a buyer should never see in a plan comparison.
 *
 * Two kinds, both plumbing:
 *   - `*.nav` — the workspace/cockpit the pillar renders into. Every tier that
 *     grants the pillar at all grants this, so as a row it is a line of ticks
 *     that distinguishes nothing.
 *   - entitlement MARKERS — keys whose only job is to flip a gate elsewhere.
 *     `content.assistant` is literally named "Peakhour Content (paid)": it is
 *     the flag that unlocks the paid content assistant, not a feature anyone
 *     buys, and printing it in a table tells a buyer their paid plan includes
 *     "(paid)".
 *
 * Listed explicitly rather than matched by pattern: a rule like "hide anything
 * ending in .nav" would silently swallow a future real feature, and the cost
 * of an entry here is one line.
 */
export const HIDDEN_FEATURE_KEYS: ReadonlySet<string> = new Set([
  "commerce.nav",
  "presence.nav",
  "content.assistant",
]);

/**
 * Plain-language names, keyed by the CANONICAL feature key (so the WooCommerce
 * and Shopify spellings of one capability share an entry — see
 * `canonicalFeatureKey`).
 *
 * House style, applied to every entry below:
 *   - say what the customer gets, not what the module is called
 *   - sentence case, no trailing period, no product nouns we invented
 *   - short enough to read as a table row at a glance
 *
 * A key absent from this map falls back to the catalog's own `name`, and only
 * then to `featureLabel` — so a capability added to the catalog tomorrow still
 * renders something sane, just in catalog voice until someone writes copy.
 */
export const CUSTOMER_FEATURE_LABELS: Record<string, string> = {
  /* ── Commerce ──────────────────────────────────────────────────────── */
  "commerce.assistant": "AI shopping assistant on your storefront",
  "commerce.catalog_sync": "Products, prices and stock stay in sync",
  "commerce.whatsapp": "Answers shoppers on WhatsApp",
  "commerce.in_app_assistant": "Ask your catalog from your store admin",
  "commerce.product_descriptions": "AI product descriptions",
  "commerce.multilingual": "Replies in your shopper’s own language",
  "commerce.command_center": "See what the assistant did, and what it earned",
  "commerce.autopilot": "Autopilot, with approval controls you set",
  "commerce.channels_all": "Every connected sales channel",

  /* ── Content ───────────────────────────────────────────────────────── */
  "content.studio": "AI writing workspace",
  "content.brand_voice": "Writes in your brand voice",
  "content.repurpose": "Turn one piece into many",
  "content.multi_format": "Blogs, newsletters, social posts and more",
  "content.scheduler": "Content calendar with scheduled publishing",
  "content.supervisor": "Automatic content ideas, ranked for you",
  "content.trusted_sources": "Ground everything in sources you trust",
  "scheduler.recurring": "Recurring slots that refill themselves",
  "scheduler.bundles": "Publish to several channels at once",
  "scheduler.auto_approve": "Publishes on schedule without manual approval",
  "scheduler.bulk_csv": "Load a whole calendar from a spreadsheet",

  /* ── Support ───────────────────────────────────────────────────────── */
  "support.inbox": "One inbox for every conversation",
  "support.channels_core": "Email, website and in-app chat",
  "support.channels_all": "WhatsApp and social DMs too",
  "support.ai_replies": "AI-drafted replies, ready to send",
  "support.assignment": "Assign and route to the right person",
  "support.sla": "Response and resolution timers",

  /* ── Growth ────────────────────────────────────────────────────────── */
  "growth.ads": "Ad campaigns across platforms",
  "growth.seo": "SEO and answer-engine optimisation",
  "growth.creator_campaigns": "Creator and influencer campaigns",
  "growth.automation": "Automated acquisition and nurture flows",
  "growth.performance_analytics": "See which channels actually pay back",

  /* ── Presence ──────────────────────────────────────────────────────── */
  "presence.listings": "One business listing, synced everywhere",
  "presence.reviews": "Every review in one inbox",
  "presence.insights": "Views, calls and directions",
  "presence.control_plane": "Update your listing over WhatsApp",

  /* ── Account-level (bundles) ───────────────────────────────────────── */
  "account.multi_product": "Every product from one workspace",
};

/** True when a key is plumbing rather than something a buyer is choosing. */
export function isHiddenFeature(key: string): boolean {
  return HIDDEN_FEATURE_KEYS.has(canonicalFeatureKey(key));
}

/**
 * The name to print for a feature key. Precedence, highest first:
 *   1. our customer-facing rewrite
 *   2. the catalog's own `cfg_features.name` (passed in from `featureDetails`)
 *   3. `featureLabel`'s humanised leaf, so nothing ever renders raw
 */
export function customerFeatureLabel(key: string, catalogName?: string): string {
  return (
    CUSTOMER_FEATURE_LABELS[canonicalFeatureKey(key)] ??
    catalogName ??
    featureLabel(key)
  );
}

/** True when this tier actually grants the capability, platform spelling aside. */
export function tierGrants(tier: ResolvedProductTier, key: string): boolean {
  const target = canonicalFeatureKey(key);
  return tier.features.some((f) => canonicalFeatureKey(f) === target);
}

/** One row of the full comparison table. `included[i]` matches `tiers[i]`. */
export interface ComparisonRow {
  /** Canonical key — stable React key, and what the row is really about. */
  key: string;
  /**
   * EVERY canonical key that merged into this row, `key` included.
   *
   * ★ROWS MERGE BY LABEL, SO ONE ROW CAN BE SEVERAL KEYS — and a caller that
   * filters by scope has to ask about all of them. `/pricing/[pillar]` narrows
   * a Suite comparison to the module's own keys; with only `key` to go on, a
   * label collision between Suite's key and the free tier's silently DROPPED a
   * capability the module genuinely grants, because the first key seen wins and
   * the first tier is Suite.
   */
  keys: string[];
  label: string;
  included: boolean[];
}

/**
 * Build the comparison rows for a set of tiers, in the order the tiers are
 * given (so the table's columns match the cards above it).
 *
 * Three things happen here that a naive union of `tier.features` does not do,
 * each of which was visible on the live catalog:
 *
 *   - platform spellings collapse, so a product that grants
 *     `commerce.woocommerce.product_descriptions` on one tier and
 *     `commerce.product_descriptions` on another gets ONE row, not two
 *     near-identical ones whose ticks are in different columns;
 *   - plumbing is dropped (see HIDDEN_FEATURE_KEYS);
 *   - rows that resolve to the same label merge, inclusion OR-ed together —
 *     the last line of defence against a duplicate row, since the label is
 *     what a reader actually compares.
 */
export function comparisonRows(tiers: ResolvedProductTier[]): ComparisonRow[] {
  // Catalog copy for the fallback, keyed canonically. First tier to describe a
  // key wins; they agree in practice, and picking one is better than picking
  // whichever happened to be last.
  const catalogNames = new Map<string, string>();
  for (const tier of tiers) {
    for (const detail of tier.featureDetails ?? []) {
      const key = canonicalFeatureKey(detail.key);
      if (!catalogNames.has(key)) catalogNames.set(key, detail.name);
    }
  }

  const grantedByTier = tiers.map(
    (tier) =>
      new Set(
        tier.features.filter((f) => !isHiddenFeature(f)).map(canonicalFeatureKey),
      ),
  );

  const rowsByLabel = new Map<string, ComparisonRow>();
  const rows: ComparisonRow[] = [];
  for (const granted of grantedByTier) {
    for (const key of granted) {
      const label = customerFeatureLabel(key, catalogNames.get(key));
      const existing = rowsByLabel.get(label);
      const included = grantedByTier.map((set) => set.has(key));
      if (existing) {
        // Same words, different key — merge rather than print the line twice.
        existing.included = existing.included.map((was, i) => was || included[i]);
        if (!existing.keys.includes(key)) existing.keys.push(key);
        continue;
      }
      const row: ComparisonRow = { key, keys: [key], label, included };
      rowsByLabel.set(label, row);
      rows.push(row);
    }
  }
  return rows;
}
