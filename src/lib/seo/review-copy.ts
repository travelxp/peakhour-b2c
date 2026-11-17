import { ABOUT } from "@/content/pages/about";
import { COMMERCE } from "@/content/pages/commerce";
import { CONTENT as CONTENT_HUB } from "@/content/pages/content";
import { GUIDES, INDUSTRIES } from "@/content/pages/directories";
import { PEAKHOUR_SUMMIT } from "@/content/pages/feature-peakhour-summit";
import { FEATURE_CONTENT } from "@/content/pages/features";
import { GROWTH } from "@/content/pages/growth";
import { COD_GUIDE } from "@/content/pages/guide-whatsapp-cod-confirmation";
import { HOME_MODULES, homeContent } from "@/content/pages/home";
import { HOW_IT_WORKS } from "@/content/pages/how-it-works";
import { FASHION_APPAREL } from "@/content/pages/industry-fashion-apparel";
import { INTEGRATION_CONTENT } from "@/content/pages/integrations";
import { peaksContent } from "@/content/pages/peaks";
import { PRESENCE } from "@/content/pages/presence";
import { SUPPORT } from "@/content/pages/support";
import { CONTENT as SF_AI_BLOG_GENERATOR } from "@/content/pages/shopify.features.ai.blog.generator";
import { CONTENT as SF_AI_GROWTH_CAMPAIGNS } from "@/content/pages/shopify.features.ai.growth.campaigns";
import { CONTENT as SF_AI_PRODUCT_DESCRIPTIONS } from "@/content/pages/shopify.features.ai.product.descriptions";
import { CONTENT as SF_AI_SEO } from "@/content/pages/shopify.features.ai.seo";
import { CONTENT as SF_AI_SHOPPING_ASSISTANT } from "@/content/pages/shopify.features.ai.shopping.assistant";
import { CONTENT as SF_AUTOMATIC_MARKDOWNS } from "@/content/pages/shopify.features.automatic.markdowns";
import { CONTENT as SF_BUNDLES } from "@/content/pages/shopify.features.bundles";
import { CONTENT as SF_CART_UPSELLS } from "@/content/pages/shopify.features.cart.upsells";
import { CONTENT as SF_CUSTOMER_CONVERSATION_INSIGHTS } from "@/content/pages/shopify.features.customer.conversation.insights";
import { CONTENT as SF_FREQUENTLY_BOUGHT_TOGETHER } from "@/content/pages/shopify.features.frequently.bought.together";
import { CONTENT as SF_INVENTORY_ALERTS } from "@/content/pages/shopify.features.inventory.alerts";
import { CONTENT as SF_MERCHANDISING_AB_TESTING } from "@/content/pages/shopify.features.merchandising.ab.testing";
import { CONTENT as SF_PRODUCT_FINDER } from "@/content/pages/shopify.features.product.finder";
import { CONTENT as SF_PRODUCT_RECOMMENDATIONS } from "@/content/pages/shopify.features.product.recommendations";
import { CONTENT as SF_SEO_AUDIT } from "@/content/pages/shopify.features.seo.audit";
import { CONTENT as SF_WHATSAPP_AI_SHOPPING } from "@/content/pages/shopify.features.whatsapp.ai.shopping";
import { CONTENT as SF_WHATSAPP_COD_CONFIRMATION } from "@/content/pages/shopify.features.whatsapp.cod.confirmation";

import { isAuthoredMode } from "@/lib/seo/publish";

if (!isAuthoredMode()) {
  throw new Error("review-copy.ts evaluates the page copy for the content hash: set REVIEW_HASH_MODE=authored before importing it (see publish.ts, isLinkable)");
}

/*
 * The copy a page's reader sees, by pageId, as data (AR-1). The review manifest hashes it, so changing a word of a page
 * moves its content hash and the page needs a new approval.
 *
 * Only data modules belong here. A page whose copy lives in a component, or whose content depends on the deployment
 * (a directory that lists only the pages that can open, a comparison's "more" section), has no entry: its hash covers the
 * registry record, its claims and (for a comparison) its brief, and REVIEW_COPY_GAPS in review-copy.test.ts names each one.
 */
export const PAGE_COPY: Readonly<Record<string, unknown>> = {
  home: { modules: HOME_MODULES, content: homeContent("") },
  peaks: peaksContent(true),
  "how.it.works": HOW_IT_WORKS,
  presence: PRESENCE,
  commerce: COMMERCE,
  content: CONTENT_HUB,
  support: SUPPORT,
  growth: GROWTH,
  about: ABOUT,
  industries: INDUSTRIES,
  guides: GUIDES,
  "industries.fashion.apparel": FASHION_APPAREL,
  "shopify.guides.whatsapp.cod.confirmation": COD_GUIDE,
  "feature.peakhour.summit": PEAKHOUR_SUMMIT,
  ...Object.fromEntries(Object.entries(FEATURE_CONTENT).map(([id, v]) => [id, v.content])),
  ...Object.fromEntries(Object.entries(INTEGRATION_CONTENT).map(([id, v]) => [id, v.content])),
  "shopify.features.ai.blog.generator": SF_AI_BLOG_GENERATOR,
  "shopify.features.ai.growth.campaigns": SF_AI_GROWTH_CAMPAIGNS,
  "shopify.features.ai.product.descriptions": SF_AI_PRODUCT_DESCRIPTIONS,
  "shopify.features.ai.seo": SF_AI_SEO,
  "shopify.features.ai.shopping.assistant": SF_AI_SHOPPING_ASSISTANT,
  "shopify.features.automatic.markdowns": SF_AUTOMATIC_MARKDOWNS,
  "shopify.features.bundles": SF_BUNDLES,
  "shopify.features.cart.upsells": SF_CART_UPSELLS,
  "shopify.features.customer.conversation.insights": SF_CUSTOMER_CONVERSATION_INSIGHTS,
  "shopify.features.frequently.bought.together": SF_FREQUENTLY_BOUGHT_TOGETHER,
  "shopify.features.inventory.alerts": SF_INVENTORY_ALERTS,
  "shopify.features.merchandising.ab.testing": SF_MERCHANDISING_AB_TESTING,
  "shopify.features.product.finder": SF_PRODUCT_FINDER,
  "shopify.features.product.recommendations": SF_PRODUCT_RECOMMENDATIONS,
  "shopify.features.seo.audit": SF_SEO_AUDIT,
  "shopify.features.whatsapp.ai.shopping": SF_WHATSAPP_AI_SHOPPING,
  "shopify.features.whatsapp.cod.confirmation": SF_WHATSAPP_COD_CONFIRMATION,
};
