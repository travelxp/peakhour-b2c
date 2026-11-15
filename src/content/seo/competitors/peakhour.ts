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
} satisfies Record<string, PeakhourClaim>;

/** A cell Peakhour cannot yet claim: unknown, with the capability the evidence audit still has to add. */
export function pending(pendingCapability: string): PeakhourClaim {
  return {
    value: "unknown",
    pendingCapability,
    note: "Our own evidence for this is still being verified, so nothing is claimed.",
  };
}
