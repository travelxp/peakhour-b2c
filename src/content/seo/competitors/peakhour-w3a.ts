import type { PeakhourClaim } from "./types";

const OBSERVED = "2026-11-16";
const SHOPIFY = { source: { href: "/shopify", label: "Peakhour for Shopify" }, observedAt: OBSERVED };

/**
 * CMP-W3A: Peakhour claims for the selling-more comparisons. Each rests on a capability whose approved claim or recorded
 * limitation in src/lib/seo/capabilities.ts covers it, and the note never goes beyond that text.
 */
export const PEAKHOUR_W3A = {
  thankYouLinks: {
    value: "partial",
    capabilityId: "commerce.cart_upsells",
    note: "Shows You may also like links on the thank-you page, up to 4. They are links to product pages, and you add the block in checkout customisation.",
    ...SHOPIFY,
  },
  noOneClickAdd: {
    value: "not-supported",
    capabilityId: "commerce.cart_upsells",
    note: "The thank-you page shows links to product pages; it cannot add items to the order.",
    ...SHOPIFY,
  },
  picks: {
    value: "yes",
    capabilityId: "commerce.cart_upsells",
    note: "Suggestions are drawn from products customers bought together, so those bought-together lists need to exist first.",
    ...SHOPIFY,
  },
  fromOrders: {
    value: "yes",
    capabilityId: "commerce.frequently_bought_together",
    note: "Works out which products are bought together from your own Shopify orders every night and can show them as a shelf on the product page. A store with too few past orders gets no list.",
    ...SHOPIFY,
  },
  noFixedPacks: {
    value: "not-supported",
    capabilityId: "commerce.buy_together_bundles",
    note: "Does not build fixed-price packs by hand. The discount applies to a product's usual companions bought in the same cart.",
    ...SHOPIFY,
  },
  onePercent: {
    value: "partial",
    capabilityId: "commerce.buy_together_bundles",
    note: "One discount percentage per store, between 5 and 30 percent. It is off until you switch it on for a bought-together shelf.",
    ...SHOPIFY,
  },
  findMyMatch: {
    value: "yes",
    capabilityId: "commerce.find_my_match",
    note: "Shoppers tap Find my match and answer a few quick questions, made from your store's own product attributes and price range, to get a shortlist.",
    ...SHOPIFY,
  },
  noQuizBuilder: {
    value: "not-supported",
    capabilityId: "commerce.find_my_match",
    note: "It is part of the shopping assistant, not a separate quiz builder.",
    ...SHOPIFY,
  },
  questionsFromCatalogue: {
    value: "yes",
    capabilityId: "commerce.find_my_match",
    note: "Asks 3 to 4 questions made from your own product attributes and price range, and shoppers can skip any. An attribute needs at least two values to be asked about.",
    ...SHOPIFY,
  },
} satisfies Record<string, PeakhourClaim>;
