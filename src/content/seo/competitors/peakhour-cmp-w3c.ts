import { PEAKHOUR_C } from "./peakhour-cmp-c";
import type { PeakhourClaim } from "./types";

const OBSERVED = "2026-11-16";
const src = (href: string, label: string) => ({ source: { href, label }, observedAt: OBSERVED });
const SEO = src("/shopify/features/ai-seo", "Peakhour AI SEO");
const AUDIT = src("/shopify/features/seo-audit", "Peakhour catalogue and SEO audit");
const DESC = src("/shopify/features/ai-product-descriptions", "Peakhour AI product descriptions");
const CAMPAIGNS = src("/shopify/features/ai-growth-campaigns", "Peakhour AI growth campaigns");

/**
 * CMP-W3C: Peakhour claims for the content, SEO and discount comparisons. Every note stays inside the approved claim
 * or the limitations recorded on the same capability in src/lib/seo/capabilities.ts. No claim here mentions WhatsApp:
 * the campaign discount comparison implies no WhatsApp reminder or broadcast.
 */
export const PEAKHOUR_W3C = {
  // Re-exported so the briefs read from one place.
  productDescriptions: PEAKHOUR_C.productDescriptions,
  blogWriter: PEAKHOUR_C.blogWriter,
  brandVoice: PEAKHOUR_C.brandVoice,
  seoAudit: PEAKHOUR_C.seoAudit,
  seoFixes: PEAKHOUR_C.seoFixes,
  bundles: PEAKHOUR_C.bundles,
  seoTitlesAndAlt: {
    value: "yes",
    capabilityId: "content.ai_seo_fixes",
    note: "Drafts SEO titles, meta descriptions, descriptions and image alt text for your products, inside Shopify.",
    ...SEO,
  },
  seoTickAndUndo: {
    value: "yes",
    capabilityId: "content.ai_seo_fixes",
    note: "You edit and tick the ones you want, and each change or a whole batch can be undone.",
    ...SEO,
  },
  seoNoSchema: {
    value: "not-supported",
    capabilityId: "content.ai_seo_fixes",
    note: "It does not write structured data (schema) on Shopify.",
    ...SEO,
  },
  seoNoRedirects: {
    value: "not-supported",
    capabilityId: "content.ai_seo_fixes",
    note: "It does not write redirects on Shopify.",
    ...SEO,
  },
  auditNoKeywords: {
    value: "not-supported",
    capabilityId: "content.seo_audit",
    note: "The audit does not check keywords.",
    ...AUDIT,
  },
  auditNoSpeed: {
    value: "not-supported",
    capabilityId: "content.seo_audit",
    note: "The audit does not check page speed.",
    ...AUDIT,
  },
  descriptionsApprove: {
    value: "yes",
    capabilityId: "content.ai_product_descriptions",
    note: "Nothing is written to your store until you approve the draft.",
    ...DESC,
  },
  descriptionsUndo: {
    value: "yes",
    capabilityId: "content.ai_product_descriptions",
    note: "You can undo an applied description.",
    ...DESC,
  },
  campaignDiscount: {
    value: "partial",
    capabilityId: "growth.ai_growth_campaigns",
    note: "When you approve a Peakhour campaign and have switched campaign discounts on, it creates a Shopify discount. It needs the discount permission, and approving sends nothing to shoppers by itself.",
    ...CAMPAIGNS,
  },
  campaignDeadline: {
    value: "yes",
    capabilityId: "growth.ai_growth_campaigns",
    note: "The Shopify discount a campaign creates ends on its deadline.",
    ...CAMPAIGNS,
  },
  campaignShelf: {
    value: "yes",
    capabilityId: "growth.ai_growth_campaigns",
    note: "An approved campaign puts its products on a storefront shelf.",
    ...CAMPAIGNS,
  },
  markdowns: {
    value: "yes",
    capabilityId: "commerce.automatic_markdowns",
    note: "Suggests markdowns within the discount limit and margin floor you set. When you preview and press Apply it changes prices in your Shopify store, with a one-click undo.",
    ...src("/shopify/features/markdown-suggestions", "Peakhour markdown suggestions"),
  },
} satisfies Record<string, PeakhourClaim>;
