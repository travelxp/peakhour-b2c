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
  inbox: {
    value: "yes",
    capabilityId: "support.channel_inbox",
    note: "One inbox for WhatsApp, website chat and Google reviews. Instagram DMs and Messenger are in development.",
    source: { href: "/support", label: "Peakhour Support" },
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
