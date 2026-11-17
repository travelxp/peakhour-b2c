import type { PeakhourClaim } from "./types";

const OBSERVED = "2026-11-16";
const src = (href: string, label: string) => ({ source: { href, label }, observedAt: OBSERVED });
const INV = src("/shopify/features/inventory-alerts", "Peakhour stock-out alerts and purchase-order sheets");
const AB = src("/shopify/features/merchandising-ab-testing", "Peakhour shelf A/B testing");
const COD = src("/shopify/features/whatsapp-cod-confirmation", "Peakhour WhatsApp COD confirmation");

/**
 * CMP-W3B: Peakhour claims for the inventory, A/B testing and COD comparisons. Each rests on a capability whose
 * approved claim and limitations in src/lib/seo/capabilities.ts cover it; a note never goes beyond them.
 */
export const PEAKHOUR_W3B = {
  stockoutAlert: {
    value: "yes",
    capabilityId: "commerce.inventory_alerts",
    note: "Messages you on WhatsApp when a selling product is forecast to run out before a reorder could arrive. WhatsApp only, once a week per product, and it needs a verified WhatsApp contact.",
    ...INV,
  },
  poSheet: {
    value: "partial",
    capabilityId: "commerce.inventory_alerts",
    note: "The Inventory page builds a per-vendor purchase-order sheet you print or download as CSV.",
    ...INV,
  },
  poNotSent: {
    value: "not-supported",
    capabilityId: "commerce.inventory_alerts",
    note: "Nothing is sent to your vendor; the sheet is yours to send.",
    ...INV,
  },
  noAutoReorder: {
    value: "not-supported",
    capabilityId: "commerce.inventory_alerts",
    note: "There is no automatic reordering.",
    ...INV,
  },
  shopifyOnly: {
    value: "not-supported",
    capabilityId: "commerce.inventory_alerts",
    note: "Shopify stores only.",
    ...INV,
  },
  shelfTests: {
    value: "yes",
    capabilityId: "commerce.rail_ab_testing",
    note: "Tests two shelf strategies in the same spot on your Shopify store.",
    ...AB,
  },
  shelfLimit: {
    value: "partial",
    capabilityId: "commerce.rail_ab_testing",
    note: "Only shelf kinds that do not depend on the page product can be compared.",
    ...AB,
  },
  winnerForApproval: {
    value: "yes",
    capabilityId: "commerce.rail_ab_testing",
    note: "Says which strategy is ahead and proposes the winner for your approval. It switches nothing until you approve.",
    ...AB,
  },
  notEnoughData: {
    value: "yes",
    capabilityId: "commerce.rail_ab_testing",
    note: "It can say there is not enough data yet.",
    ...AB,
  },
  codAsk: {
    value: "yes",
    capabilityId: "commerce.cod_confirmation",
    note: "When a cash-on-delivery order arrives on Shopify, asks the shopper on WhatsApp to confirm or cancel. Needs your WhatsApp number connected and the confirmation template approved by Meta.",
    ...COD,
  },
  codUnanswered: {
    value: "yes",
    capabilityId: "commerce.cod_confirmation",
    note: "Marks orders unanswered after 24 hours.",
    ...COD,
  },
  codQueue: {
    value: "yes",
    capabilityId: "commerce.cod_confirmation",
    note: "Shows every outcome in your Orders queue.",
    ...COD,
  },
  codNoAutoCancel: {
    value: "not-supported",
    capabilityId: "commerce.cod_confirmation",
    note: "It never cancels on a No or on silence by itself; a cancel happens only when you press Cancel in the app.",
    ...COD,
  },
} satisfies Record<string, PeakhourClaim>;
