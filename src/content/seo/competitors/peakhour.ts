import type { PeakhourClaim } from "./types";

const OBSERVED = "2026-11-15";
const SHOPIFY_PAGE = { href: "/shopify", label: "Peakhour for Shopify" };

/** The only Peakhour claims the registry approves today. Each names the capability it rests on. */
export const PEAKHOUR = {
  catalogueAnswers: {
    value: "yes",
    capabilityId: "commerce.ai_shopping_assistant",
    note: "Answers shoppers from your real catalogue, inside Shopify.",
    source: SHOPIFY_PAGE,
    observedAt: OBSERVED,
  },
  storefrontChat: {
    value: "yes",
    capabilityId: "commerce.ai_shopping_assistant",
    note: "The shopping assistant runs inside your Shopify store.",
    source: SHOPIFY_PAGE,
    observedAt: OBSERVED,
  },
  recommendations: {
    value: "yes",
    capabilityId: "commerce.product_recommendations",
    note: "Smart Rails builds product shelves inside Shopify.",
    source: SHOPIFY_PAGE,
    observedAt: OBSERVED,
  },
  codConfirmation: {
    value: "yes",
    capabilityId: "commerce.cod_confirmation",
    note: "Asks the shopper on WhatsApp to confirm or cancel, and flags orders unanswered after 24 hours. It never cancels by itself, and needs your WhatsApp number connected.",
    source: SHOPIFY_PAGE,
    observedAt: OBSERVED,
  },
  whatsappBuyingStep: {
    value: "partial",
    capabilityId: "commerce.whatsapp_shopping",
    note: "Covers the buying step: when a shopper agrees to buy on WhatsApp, Peakhour sends a tappable link into your Shopify checkout, or a Razorpay payment link (UPI or card) when the business is not Shopify-only. Payment is not taken inside WhatsApp.",
    source: SHOPIFY_PAGE,
    observedAt: OBSERVED,
  },
  productDescriptions: {
    value: "yes",
    capabilityId: "content.ai_product_descriptions",
    note: "Writes product descriptions for products that have none or very thin ones; you review and edit each draft, apply it, and can undo it.",
    source: { href: "/shopify/features/ai-product-descriptions", label: "AI product descriptions on Shopify" },
    observedAt: OBSERVED,
  },
} satisfies Record<string, PeakhourClaim>;

/**
 * A cell Peakhour cannot claim: Unknown. Pass the id of an EXISTING capability whose claim is not yet approved;
 * pass nothing where no capability exists.
 */
export function pending(pendingCapability?: string): PeakhourClaim {
  return {
    value: "unknown",
    ...(pendingCapability ? { pendingCapability } : {}),
    note: "Our own evidence for this is not yet approved, so nothing is claimed.",
  };
}
