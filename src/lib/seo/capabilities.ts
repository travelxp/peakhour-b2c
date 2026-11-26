import type { ApprovedClaim, Capability } from "./types";

/*
 * The Capability registry: what Peakhour can honestly claim, per surface (plan D3). Evidence lives
 * here, in code, pointing at catalog keys; a runtime catalog read was rejected because a catalog
 * flip would silently publish or unpublish a page with no review.
 *
 * SEO-3 verified every record below against the running code in peakhour-api, peakhour-shopify,
 * peakhour-b2c and peakhour-wordpress (docs/seo/EVIDENCE.md has the table and the reasoning).
 * STATUS is what a merchant on PRODUCTION can use today, not what is built:
 *  - a provider hard-coded coming_soon in production, or a catalog row that is coming_soon or
 *    in_development, is not live, even when the code is complete ("development");
 *  - a claim is written only for what the code proves, in a merchant's words, and a partial
 *    capability gets the narrower claim.
 * Evidence paths are repo-qualified and were opened and read; docs, plans and tests are not evidence.
 * `src/lib/seo/catalog-snapshot.json` records the catalog key and status pairs read on VERIFIED_AT;
 * `scripts/seo/check-catalog.ts` prints drift between `catalogKeys` here and the live catalog.
 * Intentional drift (code built, catalog off) is explained in the record's limitations.
 */

const APPROVED_BY = "owner";
const APPROVED_AT = "2026-11-15";
const VERIFIED_AT = "2026-11-15";

function claim(capabilityId: string, suffix: string, text: string, requires: "beta" | "live"): ApprovedClaim {
  return { id: `${capabilityId}.${suffix}`, text, requires, approvedBy: APPROVED_BY, approvedAt: APPROVED_AT };
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "commerce.ai_shopping_assistant",
    label: "AI shopping assistant",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/shopify-proxy.ts",
          "peakhour-api:src/v1/chat/storefront-turn.ts",
          "peakhour-api:extensions/smart-rail/blocks/chat-panel.liquid",
          "peakhour-api:extensions/smart-rail/shopify.extension.toml",
        ],
        catalogKeys: ["commerce.assistant", "commerce.in_app_assistant"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Answers use your own catalogue and policies; it does not place orders itself on the storefront.",
          "You switch the chat on in the theme editor. A merchant can limit it to signed-in shoppers, pause it, and take over any chat.",
          "The AI call uses Peaks; unpaid stores get a smaller daily allowance.",
        ],
      },
      {
        surface: "whatsapp",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/webhooks/meta.ts",
          "peakhour-api:src/v1/chat/message-handler.ts",
        ],
        catalogKeys: ["commerce.whatsapp", "whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Needs your own WhatsApp Business number connected. Replies after 24 hours need an approved template.",
        ],
      },
      {
        surface: "woocommerce",
        status: "development",
        evidence: [
          "peakhour-wordpress:includes/class-peakhour-commerce-chat.php",
          "peakhour-api:src/v1/routes/integrations/wp-bridge.ts",
          "peakhour-api:src/v1/integrations/providers/woocommerce.provider.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built, but WooCommerce is switched off for production merchants (its commerce features are marked active in the catalog, but there is no WooCommerce connection to carry them), and the WordPress plugin has no confirmed public release.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.ai_shopping_assistant", "answers_from_catalogue", "Answers shoppers from your real catalogue, inside Shopify.", "live"),
    ],
  },
  {
    id: "commerce.whatsapp_shopping",
    label: "WhatsApp shopping and checkout link",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "whatsapp",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/chat/message-handler.ts",
          "peakhour-api:src/v1/chat/wa-checkout.ts",
          "peakhour-api:src/v1/chat/shopify-cart-link.ts",
          "peakhour-api:src/v1/chat/upi-checkout.ts",
          "peakhour-api:src/v1/chat/whatsapp-adapter.ts",
        ],
        catalogKeys: ["commerce.whatsapp", "whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The shopper pays on your Shopify checkout page or on a Razorpay link; payment is not taken inside WhatsApp.",
          "The Shopify cart link is sent only when every store on the account is Shopify; otherwise the shopper gets a Razorpay link.",
          "Needs your WhatsApp Business number connected; replies after 24 hours need an approved template.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.whatsapp_shopping", "checkout_link", "When a shopper agrees to buy on WhatsApp, Peakhour sends a tappable link into your Shopify checkout, or a Razorpay payment link (UPI or card) when the business is not Shopify-only.", "live"),
    ],
  },
  {
    id: "commerce.product_recommendations",
    label: "Product recommendations (Smart Rails)",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/commerce/rail-zones.ts",
          "peakhour-api:src/v1/cron/rails-refresh.ts",
          "peakhour-api:extensions/smart-rail/blocks/smart-rail.liquid",
          "peakhour-api:vercel.json",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "There are 11 kinds of shelf (the list's 12th entry, auto, picks one for you).",
          "You place the block in your theme editor; a shelf with nothing to show hides itself.",
          "Changes the engine suggests wait for your approval.",
        ],
      },
      {
        surface: "woocommerce",
        status: "development",
        evidence: [
          "peakhour-wordpress:includes/class-peakhour-commerce-rails.php",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built with only 3 shelf kinds, and WooCommerce is switched off for production merchants.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.product_recommendations", "shelves", "Builds product shelves that sell, inside Shopify.", "live"),
      claim("commerce.product_recommendations", "eleven_shelf_kinds", "Choose from 11 kinds of product shelf, such as bestsellers, trending, new arrivals, price drops, back in stock, low stock and recently viewed.", "live"),
    ],
  },
  {
    id: "commerce.frequently_bought_together",
    label: "Frequently bought together",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/commerce/rail-zones.ts",
          "peakhour-api:src/v1/cron/rails-copurchase.ts",
          "peakhour-api:extensions/smart-rail/blocks/smart-rail.liquid",
          "peakhour-api:extensions/bundle-discount/src/cart_lines_discounts_generate_run.ts",
          "peakhour-api:vercel.json",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Pairs come from your own past orders, worked out every night, not from AI.",
          "A store with too few past orders gets no list.",
          "The discount is a separate switch (see Buy together and save).",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.frequently_bought_together", "from_orders", "Peakhour works out which products are bought together from your own Shopify orders every night and can show them as a shelf on the product page.", "live"),
    ],
  },
  {
    id: "commerce.cart_upsells",
    label: "Cart and thank-you page suggestions",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:extensions/smart-rail/blocks/smart-rail.liquid",
          "peakhour-api:extensions/thank-you-rail/shopify.extension.toml",
          "peakhour-api:src/v1/routes/shopify-checkout-rails.ts",
          "peakhour-api:src/v1/services/commerce/rail-surfaces.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The thank-you page shows links to product pages (up to 4); it cannot add items to the order.",
          "Needs bought-together lists to exist first.",
          "You add the thank-you block in checkout customisation, and Shopify must approve its network access.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.cart_upsells", "cart_and_thank_you", "Shows Complete your cart suggestions on the cart page and You may also like links on the thank-you page, drawn from products customers bought together.", "live"),
    ],
  },
  {
    id: "commerce.rail_ab_testing",
    label: "Shelf A/B testing",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/commerce/rail-experiments.ts",
          "peakhour-api:src/v1/routes/shopify-rails.ts",
          "peakhour-api:src/v1/cron/rails-improve.ts",
          "peakhour-api:extensions/smart-rail/assets/smart-rail-ab.js",
          "peakhour-shopify:src/pages/rails.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Only shelf kinds that do not depend on the page product can be compared.",
          "The engine proposes a winner; it switches nothing until you approve.",
          "It can say there is not enough data yet.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.rail_ab_testing", "compare_two_strategies", "Test two shelf strategies in the same spot on your Shopify store, and Peakhour tells you which is ahead and proposes the winner for your approval.", "live"),
    ],
  },
  {
    id: "commerce.find_my_match",
    label: "Find my match (product finder)",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/commerce/quiz.ts",
          "peakhour-api:src/v1/routes/shopify-proxy.ts",
          "peakhour-api:extensions/smart-rail/assets/chat-panel-ext.js",
          "peakhour-api:extensions/smart-rail/blocks/chat-inline.liquid",
          "peakhour-shopify:src/pages/theme.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It is part of the shopping assistant, not a separate quiz builder.",
          "It asks 3 to 4 questions made from your own product attributes and price range, and shoppers can skip any.",
          "Needs at least two values for an attribute to ask about it.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.find_my_match", "quick_questions", "Shoppers can tap Find my match and answer a few quick questions, made from your store's own product attributes and price range, to get a shortlist.", "live"),
    ],
  },
  {
    id: "commerce.buy_together_bundles",
    label: "Buy together and save",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:extensions/bundle-discount/shopify.extension.toml",
          "peakhour-api:extensions/bundle-discount/src/cart_lines_discounts_generate_run.ts",
          "peakhour-api:src/v1/services/commerce/rail-bundle.ts",
          "peakhour-api:src/v1/routes/shopify-embedded.ts",
          "peakhour-shopify:src/pages/rail-bundle-view.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Off until you switch it on for a bought-together shelf.",
          "One discount percentage per store, between 5 and 30 percent.",
          "Needs the store's discount permission; it does not build fixed-price packs by hand.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.buy_together_bundles", "percent_off", "Switch on Buy together and save to give 5 to 30 percent off a product's usual companions when they are bought in the same cart.", "live"),
    ],
  },
  {
    id: "commerce.cod_confirmation",
    label: "WhatsApp cash-on-delivery confirmation",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/webhooks/shopify.ts",
          "peakhour-api:src/v1/services/commerce/cod-lane.ts",
          "peakhour-api:src/v1/routes/webhooks/meta.ts",
          "peakhour-api:src/v1/cron/commerce-cod-sweep.ts",
          "peakhour-api:src/v1/routes/shopify-cod-writes.ts",
          "peakhour-api:src/v1/services/cod-writes/index.ts",
          "peakhour-shopify:src/pages/cod.ts",
        ],
        catalogKeys: ["commerce.whatsapp", "whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It never cancels on a No or on silence by itself; a cancel only happens when you press Cancel in the app.",
          "Tagging or holding the order in Shopify happens only if you switch it on and grant the extra Shopify permissions.",
          "Needs your WhatsApp number connected and the confirmation template approved by Meta.",
          "It cannot see whether a shopper who tapped pay online actually paid.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.cod_confirmation", "ask_on_whatsapp", "When a cash-on-delivery order arrives on Shopify, Peakhour asks the shopper on WhatsApp to confirm or cancel, marks unanswered orders after 24 hours, and shows every outcome in your Orders queue.", "live"),
    ],
  },
  {
    id: "commerce.manage_store_from_whatsapp",
    label: "Run Peakhour from WhatsApp",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "whatsapp",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/chat/command-router.ts",
          "peakhour-api:src/v1/chat/platform-agent.ts",
          "peakhour-api:src/v1/services/growth/whatsapp-consent.ts",
        ],
        catalogKeys: ["whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "You cannot manage orders, prices, stock or COD cancellations from WhatsApp; store data is a read-only summary.",
          "STATUS and REPORT commands are not built.",
          "Only works from your verified merchant number.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.manage_store_from_whatsapp", "approvals_and_summary", "On WhatsApp you can approve or skip pending social posts, boost or stop ad campaigns, pause autonomous mode, answer Growth ad decisions, and ask for a read-only summary of your store's stock and sales.", "live"),
    ],
  },
  {
    id: "commerce.inventory_alerts",
    label: "Stock-out alerts and purchase-order sheets",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/cron/commerce-stockout-alerts.ts",
          "peakhour-api:src/v1/services/commerce/stockout-alerts.ts",
          "peakhour-api:src/v1/services/commerce/replenisher.ts",
          "peakhour-api:src/v1/services/commerce/purchase-orders.ts",
          "peakhour-api:src/v1/routes/shopify-inventory-loop.ts",
          "peakhour-shopify:src/lib/inventory-loop.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Alerts come by WhatsApp only, once a week per product, and need a verified WhatsApp contact.",
          "The purchase order is a per-vendor sheet you print or download as CSV; nothing is sent to your vendor and there is no automatic reordering.",
          "Shopify stores only.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.inventory_alerts", "forecast_alert", "Peakhour WhatsApps you when a selling product is forecast to run out before a reorder could arrive.", "live"),
      claim("commerce.inventory_alerts", "po_sheet", "The Inventory page builds a per-vendor purchase-order sheet you can print or download; nothing is sent to your vendor.", "live"),
    ],
  },
  {
    id: "commerce.automatic_markdowns",
    label: "Markdown suggestions and one-click apply",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/shopify-price-apply.ts",
          "peakhour-api:src/v1/services/commerce/markdown-apply.ts",
          "peakhour-api:src/v1/services/commerce/execution.ts",
          "peakhour-api:src/v1/services/commerce/pricer.ts",
          "peakhour-api:src/v1/services/price-write/shopify-writer.ts",
          "peakhour-shopify:src/lib/markdown-apply.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Not automatic: no markdown happens without your click, and nothing runs on a schedule.",
          "Applying needs price changes switched on in Autopilot and the store's product-write permission.",
          "Each change can be undone, unless you changed the price yourself afterwards.",
        ],
      },
    ],
    approvedClaims: [
      claim("commerce.automatic_markdowns", "apply_on_press", "Peakhour suggests markdowns within the discount limit and margin floor you set, and when you preview and press Apply it changes the prices in your Shopify store, with a one-click undo.", "live"),
    ],
  },
  {
    id: "growth.ai_growth_campaigns",
    label: "Campaign discounts and WhatsApp reminders",
    primaryPillar: "growth",
    secondaryPillars: ["commerce"],
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/shopify-embedded.ts",
          "peakhour-api:src/v1/services/campaign-discount/launch.ts",
          "peakhour-api:src/v1/routes/shopify-wa-marketing.ts",
          "peakhour-api:src/v1/services/wa-marketing/broadcasts.ts",
          "peakhour-api:src/v1/cron/wa-marketing.ts",
          "peakhour-shopify:src/pages/win-back.ts",
        ],
        catalogKeys: ["whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Approving a campaign sends nothing to shoppers by itself.",
          "The discount is created only if you switched campaign discounts on and granted the discount permission, and it ends on its deadline.",
          "Broadcasts go only to shoppers who opted in, after your confirmation, and need an approved marketing template; Meta fees apply.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.ai_growth_campaigns", "approved_campaigns", "When you approve a Peakhour campaign it puts the products on a storefront shelf and, if you have switched campaign discounts on, creates a Shopify discount that ends on schedule.", "live"),
    ],
  },
  {
    id: "content.ai_seo_fixes",
    label: "AI SEO fixes",
    primaryPillar: "content",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/seo-fix/adapters/shopify.ts",
          "peakhour-api:src/v1/services/seo-fix/types.ts",
          "peakhour-api:src/v1/routes/shopify-seo.ts",
          "peakhour-api:src/v1/services/seo-fix/apply.ts",
          "peakhour-shopify:src/pages/fix-with-ai.ts",
        ],
        catalogKeys: ["content.meta_sync"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It does not write structured data (schema) or redirects on Shopify.",
          "It leaves alone titles and descriptions that are already good.",
          "Needs Peaks and the Suite plan.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.ai_seo_fixes", "product_pages", "Fixes product pages for Google, inside Shopify.", "live"),
      claim("content.ai_seo_fixes", "tick_and_undo", "Drafts SEO titles, meta descriptions, descriptions and image alt text; you edit and tick the ones you want, and each change or a whole batch can be undone.", "live"),
    ],
  },
  {
    id: "content.ai_product_descriptions",
    label: "AI product descriptions",
    primaryPillar: "content",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/seo-fix/adapters/shopify.ts",
          "peakhour-api:src/v1/services/seo-fix/draft.ts",
          "peakhour-api:src/v1/services/catalog-readiness/fixable.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It writes for products with no description or a thin one, and skips good existing ones.",
          "Nothing is written until you approve; you can undo.",
        ],
      },
      {
        surface: "woocommerce",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/routes/integrations/wp-bridge.ts",
          "peakhour-api:src/v1/integrations/providers/woocommerce.provider.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The API route exists but the WordPress plugin does not call it, and WooCommerce is switched off for production merchants.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.ai_product_descriptions", "write_missing", "Writes product descriptions for products that have none or very thin ones; you review and edit each draft, apply it, and can undo it.", "live"),
    ],
  },
  {
    id: "content.seo_audit",
    label: "Catalogue and SEO audit",
    primaryPillar: "content",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/catalog-readiness/checks.ts",
          "peakhour-api:src/v1/helpers/aeo-readiness.ts",
          "peakhour-api:src/v1/routes/shopify-catalog-readiness.ts",
          "peakhour-api:src/v1/routes/shopify-embedded.ts",
          "peakhour-shopify:src/pages/catalog-readiness.ts",
        ],
        catalogKeys: ["content.aeo_audit", "content.internal_links", "content.refresh"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Page-level findings are as of the last daily crawl.",
          "The Search Console section depends on Google Search Console, which is not yet available to production merchants.",
          "It does not check page speed, backlinks or keywords.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.seo_audit", "catalogue_checks", "Checks every product for missing or thin descriptions, images, prices, product types, vendors and meta descriptions, and your shipping and refund policies.", "live"),
    ],
  },
  {
    id: "content.ai_blog_writer",
    label: "AI blog writer",
    primaryPillar: "content",
    implementations: [
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/adapters/publisher/shopify.ts",
          "peakhour-api:src/v1/adapters/publisher/index.ts",
          "peakhour-api:src/v1/routes/shopify-embedded.ts",
          "peakhour-api:src/v1/scheduler/worker.ts",
          "peakhour-shopify:src/pages/content.ts",
        ],
        catalogKeys: ["content.ai_draft", "content.studio", "content.scheduler"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Articles land as hidden drafts unless you choose to publish.",
          "Repurposing a blog post is off by default for most stores.",
          "Articles go to one blog (News by default).",
        ],
      },
      {
        surface: "wordpress",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/adapters/publisher/wordpress.ts",
          "peakhour-api:src/v1/integrations/providers/wordpress.provider.ts",
        ],
        catalogKeys: ["wordpress"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built, but the WordPress integration is listed as coming soon in production.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.ai_blog_writer", "draft_then_publish", "Drafts blog articles and, after you approve them, publishes them to your Shopify blog as a hidden draft unless you choose to publish.", "live"),
    ],
  },
  {
    id: "content.brand_voice",
    label: "Brand voice (voice cards)",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/content/voice-cards.ts",
          "peakhour-api:src/v1/ai/voice-card-generator.ts",
          "peakhour-api:src/v1/ai/resolver/BusinessContextResolver.ts",
          "peakhour-api:src/v1/helpers/brand-kit.ts",
        ],
        catalogKeys: ["content.brand_voice"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "A voice card is learned from your real posts; one cannot be invented from nothing.",
          "The campaign headline voice is a separate thing and is not joined to it.",
        ],
      },
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/content-voice/index.ts",
          "peakhour-api:src/v1/routes/shopify-content-loop.ts",
          "peakhour-api:src/v1/services/seo-fix/draft.ts",
        ],
        catalogKeys: ["content.brand_voice"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "On Shopify you can edit tone, phrases to avoid and sample lines of an existing card, but not create one.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.brand_voice", "learns_your_voice", "Peakhour learns how your brand writes from your existing posts, per channel, uses that voice when drafting, and keeps adjusting from what you approve or reject.", "live"),
    ],
  },
  {
    id: "content.social_publishing",
    label: "Social publishing",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/adapters/publisher/index.ts",
          "peakhour-api:src/v1/adapters/publisher/linkedin.ts",
          "peakhour-api:src/v1/adapters/publisher/x.ts",
          "peakhour-api:src/v1/adapters/publisher/facebook.ts",
          "peakhour-api:src/v1/adapters/publisher/instagram.ts",
          "peakhour-api:src/v1/cron/publish-scheduled.ts",
          "peakhour-api:src/v1/scheduler/worker.ts",
          "peakhour-api:vercel.json",
        ],
        catalogKeys: ["content.scheduler", "content.multi_format", "linkedin_content", "x", "facebook_pages"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Instagram needs an image or a carousel of 2 to 10 images; no video, reels or text-only posts.",
          "Threads is not available to production merchants.",
          "Nothing posts without an approved plan.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.social_publishing", "four_networks", "Posts approved content to LinkedIn (personal and company pages), X (including threads), Facebook Pages and Instagram (images and carousels) at the time you scheduled it.", "live"),
    ],
  },
  {
    id: "content.beehiiv_newsletter",
    label: "Beehiiv newsletters",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/adapters/publisher/beehiiv.ts",
          "peakhour-api:src/v1/helpers/beehiiv.ts",
          "peakhour-api:src/v1/cron/beehiiv-sync.ts",
          "peakhour-api:src/v1/integrations/providers/beehiiv.provider.ts",
          "peakhour-api:vercel.json",
        ],
        catalogKeys: ["newsletter.beehiiv.import", "newsletter.beehiiv.publish", "beehiiv"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It creates a draft in Beehiiv; you click Send in Beehiiv.",
          "Substack, Kit, Mailchimp and Ghost are not available.",
        ],
      },
    ],
    approvedClaims: [
      claim("content.beehiiv_newsletter", "draft_to_beehiiv", "Connects to Beehiiv, imports your past posts hourly, and sends approved newsletters to Beehiiv as drafts for you to send.", "live"),
    ],
  },
  {
    id: "content.seo_content_optimization",
    label: "SEO content tools in WordPress",
    primaryPillar: "content",
    implementations: [
      {
        surface: "wordpress",
        status: "development",
        evidence: [
          "peakhour-wordpress:includes/class-peakhour-core.php",
          "peakhour-wordpress:includes/class-peakhour-meta.php",
          "peakhour-wordpress:includes/class-peakhour-schema.php",
          "peakhour-wordpress:includes/class-peakhour-links.php",
          "peakhour-wordpress:includes/class-peakhour-refresh.php",
          "peakhour-api:src/v1/routes/integrations/wp-bridge.ts",
          "peakhour-api:src/v1/integrations/providers/wordpress.provider.ts",
        ],
        catalogKeys: ["wordpress"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The WordPress integration is listed (catalog drift on purpose: the code is built, the catalog is coming soon) as coming soon in production, and no public plugin release could be confirmed.",
          "Links are suggestions you insert yourself; nothing is applied until you click.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "growth.ai_search_visibility",
    label: "AI search visibility tracking",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "shopify",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/adapters/seo-data/dataforseo.ts",
          "peakhour-api:src/v1/services/seo-tracking/visibility.ts",
          "peakhour-api:src/v1/cron/seo-tracking.ts",
          "peakhour-api:src/v1/routes/shopify-search-tracking.ts",
          "peakhour-api:src/v1/routes/shopify-search-visibility-latest.ts",
          "peakhour-shopify:src/lib/search-tracking-section.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built and queried, but no screen shows the ChatGPT, Gemini, Perplexity or AI Overview results to the merchant yet.",
          "Tracking is off until you switch it on and accept a Peaks price; AI engines are checked monthly.",
        ],
      },
      {
        surface: "wordpress",
        status: "development",
        evidence: [
          "peakhour-wordpress:includes/class-peakhour-aeo.php",
          "peakhour-api:src/v1/routes/integrations/wp-bridge.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "A per-post AEO audit in the WordPress plugin; WordPress is not yet available to production merchants.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "presence.gbp_management",
    label: "Google Business Profile management",
    primaryPillar: "presence",
    implementations: [
      {
        surface: "web",
        status: "beta",
        evidence: [
          "peakhour-api:src/v1/routes/presence/changes.ts",
          "peakhour-api:src/v1/adapters/presence/google-business-profile.ts",
          "peakhour-api:src/v1/services/presence/change-gate.ts",
          "peakhour-api:src/v1/jobs/handlers/presence-change-apply.ts",
          "peakhour-api:src/v1/routes/presence/media.ts",
          "peakhour-api:src/v1/routes/shopify-presence.ts",
          "peakhour-b2c:src/components/presence/presence-home.tsx",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Changes reach Google only once Peakhour has switched sending on for Google; the code ships with it off and the production value could not be read.",
          "Nothing is sent until an admin on your team approves it; undo is a new change that needs its own approval.",
          "Changing name, address or main category can make Google ask you to verify again.",
          "Edits are made on the web; Shopify and WordPress show the listing read-only.",
        ],
      },
    ],
    approvedClaims: [
      claim("presence.gbp_management", "prepare_and_approve", "Prepare changes to your Google Business Profile hours, details, photos and posts, and nothing is sent to Google until an admin on your team approves it.", "beta"),
    ],
  },
  {
    id: "presence.review_management",
    label: "Google review management",
    primaryPillar: "presence",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/support/index.ts",
          "peakhour-api:src/v1/adapters/presence/google-business-profile.ts",
          "peakhour-api:src/v1/services/presence/review-draft.ts",
          "peakhour-api:src/v1/routes/presence/index.ts",
          "peakhour-api:src/v1/services/presence/reviews.ts",
        ],
        catalogKeys: ["presence.reviews"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "There is no automatic reply: a person reads the AI draft and presses Send.",
          "New reviews arrive on the hourly sync.",
          "A draft costs Peaks.",
        ],
      },
    ],
    approvedClaims: [
      claim("presence.review_management", "draft_then_send", "Google reviews appear in your Inbox, and AI drafts a reply that a person on your team edits and sends to Google.", "live"),
    ],
  },
  {
    id: "presence.listing_health",
    label: "Listing score and alerts",
    primaryPillar: "presence",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/presence/score.ts",
          "peakhour-api:src/v1/services/presence/listing-score.ts",
          "peakhour-api:src/v1/services/presence/alert-rules.ts",
          "peakhour-api:src/v1/cron/performance-sync.ts",
          "peakhour-api:src/v1/services/notifications/presence-alerts.ts",
          "peakhour-api:vercel.json",
        ],
        catalogKeys: ["presence.listings", "presence.insights"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The score says what a customer sees or cannot do; it says nothing about how Google ranks you.",
          "Alerts come by email and in the app, not WhatsApp; only losing control of the listing is emailed at once, the rest arrive in a daily email.",
        ],
      },
    ],
    approvedClaims: [
      claim("presence.listing_health", "score_and_alerts", "Scores how complete your Google listing is, lists the next fixes in order, and emails you when you lose control of the listing, plus a daily email when Google changes a detail, flags a duplicate or your calls and visits drop.", "live"),
    ],
  },
  {
    id: "support.channel_inbox",
    label: "Support inbox: WhatsApp, website chat, Google reviews",
    primaryPillar: "support",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-b2c:src/app/(site)/dashboard/inbox/page.tsx",
          "peakhour-b2c:src/components/inbox/conversations-pane.tsx",
          "peakhour-api:src/v1/routes/support/index.ts",
          "peakhour-api:src/v1/routes/meta-whatsapp/index.ts",
          "peakhour-api:src/v1/routes/storefront-chats.ts",
        ],
        catalogKeys: ["support.channels_core", "support.channels_all"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built and running, but the catalog still lists support channels as coming soon and the owner has not decided to switch them on (plan Q3).",
          "Instagram, Messenger and X messages and email are not in it.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "support.instagram_messenger_inbox",
    label: "Support inbox: Instagram DMs, Messenger and X DMs",
    primaryPillar: "support",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/helpers/meta-dm-release.ts",
          "peakhour-api:src/v1/helpers/x-dm-release.ts",
        ],
        catalogKeys: ["instagram_dm", "messenger", "x_dm"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Switched off for every merchant.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "support.ai_replies",
    label: "Suggested replies",
    primaryPillar: "support",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/services/support/suggest-reply.ts",
          "peakhour-api:src/v1/routes/meta-whatsapp/conversations.ts",
          "peakhour-api:src/v1/routes/storefront-chats.ts",
          "peakhour-api:src/v1/middleware/requireFeature.ts",
        ],
        catalogKeys: ["support.ai_replies"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built and running, but the catalog lists AI replies as coming soon and the owner has not decided to switch it on (plan Q3).",
          "It drafts for a person to edit and send; it never sends by itself.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "support.whatsapp_support",
    label: "WhatsApp customer support",
    primaryPillar: "support",
    implementations: [
      {
        surface: "whatsapp",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/chat/whatsapp-adapter.ts",
          "peakhour-api:src/v1/chat/human-handover.ts",
          "peakhour-api:src/v1/services/support/whatsapp-conversations.ts",
          "peakhour-api:src/v1/routes/webhooks/meta.ts",
          "peakhour-api:src/v1/routes/meta-whatsapp/conversations.ts",
        ],
        catalogKeys: ["support.channels_core"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built and running, but the catalog lists support channels as coming soon and the owner has not decided to switch them on (plan Q3).",
          "The assistant answers shoppers itself and hands over to your team when asked or stuck; after 24 hours only an approved template can be sent.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "support.conversation_insights",
    label: "Conversation insights",
    primaryPillar: "support",
    secondaryPillars: ["commerce"],
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/insights/handlers.ts",
          "peakhour-api:src/v1/services/commerce/demand-insights.ts",
          "peakhour-api:src/v1/services/commerce/demand-signal.ts",
          "peakhour-api:src/v1/services/support/support-analytics.ts",
          "peakhour-api:src/v1/services/commerce/demand-digest.ts",
          "peakhour-b2c:src/components/inbox/insights-pane.tsx",
        ],
        catalogKeys: ["support.inbox"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It analyses the assistant's conversations; it is not a live inbox, and your own test chats are excluded.",
          "An item appears only once several customers raise the same thing.",
          "It shows nothing while the assistant is switched off.",
        ],
      },
      {
        surface: "shopify",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/insights/handlers.ts",
          "peakhour-shopify:src/pages/insights.ts",
        ],
        catalogKeys: ["support.inbox"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Same insights inside the Shopify admin.",
        ],
      },
    ],
    approvedClaims: [
      claim("support.conversation_insights", "unmet_asks", "Shows what several shoppers asked your assistant that it could not answer, including products they wanted that you do not sell, with how often, whether it is rising, and what to do next.", "live"),
    ],
  },
  {
    id: "growth.peakhour_summit",
    label: "Peakhour Summit",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "beta",
        evidence: [
          "peakhour-api:src/v1/cron/growth-council-review.ts",
          "peakhour-api:src/v1/services/growth/council/convene.ts",
          "peakhour-api:src/v1/services/growth/council/pipeline.ts",
          "peakhour-api:src/v1/routes/growth/v2/council.ts",
          "peakhour-api:src/v1/services/growth/seat-names.ts",
          "peakhour-b2c:src/components/growth-v2/ask-summit.tsx",
          "peakhour-b2c:src/lib/growth-v2-copy.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It runs only once its review steps are switched on in the CMS, which could not be read for production.",
          "Summit advises and never applies a change; you approve any change.",
          "Reviews run only for businesses whose growth autonomy level is above 0.",
        ],
      },
      {
        surface: "shopify",
        status: "beta",
        evidence: [
          "peakhour-shopify:src/lib/growth-v2.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The same Summit inside the Shopify app.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.peakhour_summit", "reviews_proposals", "Peakhour Summit reviews your growth proposals, and any question you pay to ask it, with a case for, a case against, safety checks and a final call, and it only recommends.", "beta"),
    ],
  },
  {
    id: "growth.campaign_planning",
    label: "Growth planning",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/growth/first-run-draft.ts",
          "peakhour-api:src/v1/routes/growth/index.ts",
          "peakhour-api:src/v1/services/growth/channel-mix.ts",
          "peakhour-api:src/v1/chat/plan-next.ts",
          "peakhour-api:src/v1/services/growth/campaign-plan-context.ts",
        ],
        catalogKeys: ["growth.ads", "growth.optimizer"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It drafts a plan and a channel recommendation; nothing is created or spent until you approve.",
          "The WhatsApp plan covers a LinkedIn boost of a post you already published, and launches as a draft that spends nothing until you switch it on.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.campaign_planning", "plan_for_approval", "Drafts a first growth strategy and a channel recommendation for you to approve; nothing is created or spent without your approval.", "live"),
    ],
  },
  {
    id: "growth.meta_ads",
    label: "Meta Ads",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-b2c:src/app/(site)/dashboard/ads/_components/meta-ads-panel.tsx",
          "peakhour-b2c:src/lib/api/meta-ads.ts",
          "peakhour-api:src/v1/routes/meta-ads/index.ts",
          "peakhour-api:src/v1/adapters/ads/boost-profile.ts",
          "peakhour-api:src/v1/adapters/ads/index.ts",
        ],
        catalogKeys: ["meta_ads"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Campaigns cannot be created from the dashboard panel; it lists, expands, pauses and resumes.",
          "Meta write paths have not yet run against a live ad account.",
          "It runs through your single Facebook (Meta) connection.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.meta_ads", "list_and_pause", "Lists your Meta campaigns, ad sets and ads with results, and lets you pause or resume them.", "live"),
    ],
  },
  {
    id: "growth.linkedin_ads",
    label: "LinkedIn Ads",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/linkedin-ads.provider.ts",
          "peakhour-api:src/v1/routes/linkedin-ads/index.ts",
          "peakhour-api:src/v1/integrations/catalog-availability.ts",
          "peakhour-b2c:src/lib/api/linkedin-ads.ts",
        ],
        catalogKeys: ["linkedin_ads"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built, but the production catalog lists LinkedIn Ads (the dev catalog has it live, and production wins) as coming soon; the owner decides when it is switched on.",
          "The dashboard boosts a post you already published and manages the campaign; there is no blank-campaign create.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "growth.x_ads",
    label: "X Ads",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/x-ads.provider.ts",
          "peakhour-api:src/v1/routes/x-ads/index.ts",
          "peakhour-b2c:src/lib/api/x-ads.ts",
        ],
        catalogKeys: ["x_ads"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Creating a campaign needs a funding instrument on your X Ads account.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.x_ads", "create_and_pause", "Connect X Ads, create and pause X campaigns and see their results.", "live"),
    ],
  },
  {
    id: "growth.google_ads",
    label: "Google Ads campaigns",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/google-ads.provider.ts",
          "peakhour-api:src/v1/integrations/routes.ts",
          "peakhour-api:src/v1/adapters/ads/google.ts",
          "peakhour-api:src/v1/routes/google-ads/index.ts",
          "peakhour-b2c:src/app/(site)/dashboard/ads/_components/google-ads-panel.tsx",
        ],
        catalogKeys: ["google_ads"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built, but switched off for production merchants (the dev catalog has it live, and production wins): it cannot be connected there, and it has not been tested against a live account.",
          "Google's own approvals for the app are outside Peakhour's code.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "growth.linkedin_growth",
    label: "LinkedIn growth",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/linkedin-content/index.ts",
          "peakhour-api:src/v1/routes/linkedin-ads/index.ts",
          "peakhour-api:src/v1/cron/linkedin-post-sync.ts",
          "peakhour-api:src/v1/cron/linkedin-subscription-reconcile.ts",
          "peakhour-api:vercel.json",
        ],
        catalogKeys: ["linkedin_content", "linkedin.content.full"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Replies, comments and reactions are sent when you or your team trigger them.",
          "Boosting a post is a separate paid-ads step.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.linkedin_growth", "publish_and_boost", "Publish and manage LinkedIn posts, get AI reply and hook suggestions, track engagement, and boost a post into an ad campaign.", "live"),
    ],
  },
  {
    id: "growth.ad_audiences",
    label: "Ad audiences",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/adapters/audience/index.ts",
          "peakhour-api:src/v1/routes/audiences/index.ts",
          "peakhour-api:src/v1/services/ads/audience-materialise.ts",
          "peakhour-b2c:src/lib/audience-library-rules.ts",
          "peakhour-b2c:src/components/audience/discover-audiences-dialog.tsx",
        ],
        catalogKeys: ["growth.ads"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The audience library offers LinkedIn and X today; Google is not available to production merchants and TikTok is not registered.",
          "These are targeting definitions with a reach count, not uploaded customer lists or lookalikes.",
          "Applying an audience leaves a campaign as a draft; it never starts spend.",
        ],
      },
    ],
    approvedClaims: [
      claim("growth.ad_audiences", "targeting", "Plans targeting audiences for LinkedIn and X from your business profile with a real reach count, and lets you reuse them on a draft campaign.", "live"),
    ],
  },
  {
    id: "growth.lead_inbox",
    label: "Growth lead inbox",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-b2c:src/app/(site)/dashboard/inbox/page.tsx",
          "peakhour-b2c:src/lib/api/inbox.ts",
          "peakhour-api:src/v1/routes/support/index.ts",
          "peakhour-api:src/v1/services/linkedin/leadgen-ingest.ts",
          "peakhour-api:src/v1/routes/webhooks/linkedin.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The Leads lane exists, but LinkedIn lead delivery has never been switched on (Lead Sync was never approved).",
          "No lead export or CRM exists.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "platform.ask_peakhour",
    label: "Ask Peakhour",
    primaryPillar: "growth",
    secondaryPillars: ["presence", "content"],
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/ask/index.ts",
          "peakhour-api:src/v1/ai/ask/registry.ts",
          "peakhour-api:src/v1/ai/ask/engines/analytics/gsc-tools.ts",
          "peakhour-api:src/v1/ai/ask/engines/presence/propose.ts",
          "peakhour-api:src/v1/cron/ask-weekly-digest.ts",
          "peakhour-b2c:src/app/(site)/dashboard/ask/page.tsx",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It reads Search Console, Analytics 4 and Business Profile data only on those pages.",
          "It can only prepare a listing change as a card for approval; it never acts on its own.",
          "Search Console is not yet available to production merchants, so those answers depend on it.",
        ],
      },
    ],
    approvedClaims: [
      claim("platform.ask_peakhour", "answers_and_proposes", "Ask Peakhour answers questions from your own data and can only prepare a change as a card for you to approve.", "live"),
    ],
  },
  {
    id: "platform.autopilot",
    label: "Autopilot",
    primaryPillar: "growth",
    secondaryPillars: ["commerce", "content"],
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/services/growth/autonomy.ts",
          "peakhour-api:src/v1/routes/growth/v2/types.ts",
          "peakhour-api:src/v1/services/growth/council/risk.ts",
          "peakhour-api:src/v1/services/commerce/execution.ts",
          "peakhour-api:src/v1/services/commerce/store-writes.ts",
          "peakhour-api:src/v1/routes/shopify-autopilot.ts",
          "peakhour-api:src/v1/cron/wp-autopilot.ts",
          "peakhour-b2c:src/components/growth-v2/autonomy-ladder.tsx",
        ],
        catalogKeys: ["commerce.autopilot", "scheduler.auto_approve"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "New channels and changes to your subscription or autonomy level always need your approval.",
          "Commerce changes run only if the dial allows it, the emergency stop is off, and you switched that kind of change on.",
          "Level 3 is offered only after 5 cleared decisions at level 1 and 8 weeks at level 2.",
        ],
      },
    ],
    approvedClaims: [
      claim("platform.autopilot", "limits_you_set", "Autopilot acts only within limits you set and can reverse; you choose how much it does alone, and new channels or changes to your subscription always need your approval.", "live"),
    ],
  },
  {
    id: "platform.multi_business",
    label: "Several businesses under one account",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/auth/businesses.ts",
          "peakhour-api:src/v1/routes/auth/orgs.ts",
          "peakhour-api:src/v1/helpers/billing.ts",
          "peakhour-b2c:src/components/dashboard/workspace-switcher.tsx",
          "peakhour-b2c:src/components/dashboard/business-switcher.tsx",
        ],
        catalogKeys: ["org.multi_business"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "There is no white-label and no client labelling, although the catalog lists them as active.",
          "Which businesses an account covers follows what you bought.",
        ],
      },
    ],
    approvedClaims: [
      claim("platform.multi_business", "switch_businesses", "Run several businesses under one account and switch between them.", "live"),
    ],
  },
  {
    id: "platform.security",
    label: "Data protection and account deletion",
    primaryPillar: "growth",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/helpers/pii-crypto.ts",
          "peakhour-api:src/v1/helpers/order-customer-seal.ts",
          "peakhour-api:src/v1/cron/commerce-order-pii-sweep.ts",
          "peakhour-api:src/v1/routes/account/deletion.ts",
          "peakhour-api:src/v1/cron/org-deletion-executor.ts",
          "peakhour-api:src/v1/routes/webhooks/shopify.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Only shopper details on store orders are encrypted per business; other data is not claimed.",
          "Account deletion is by API; the website's data-deletion page checks status and sends you to email.",
          "No certification is claimed.",
        ],
      },
    ],
    approvedClaims: [
      claim("platform.security", "order_pii", "Shopper phone, name, email and pincode on store orders are stored encrypted per business and erased after 90 days; an account owner can have the account closed with a 30-day grace period.", "live"),
    ],
  },
  {
    id: "integration.whatsapp",
    label: "WhatsApp connection",
    primaryPillar: "commerce",
    secondaryPillars: ["support"],
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/routes/meta-whatsapp/index.ts",
          "peakhour-api:src/v1/routes/webhooks/meta.ts",
          "peakhour-api:src/v1/helpers/whatsapp-availability.ts",
          "peakhour-b2c:src/components/integrations/whatsapp-embedded-signup.tsx",
        ],
        catalogKeys: ["whatsapp"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Needs a business-owned WhatsApp number; template messages need Meta approval.",
          "Connecting happens on the web, not inside the Shopify admin.",
        ],
      },
    ],
    approvedClaims: [
      claim("integration.whatsapp", "connect_number", "Connect your own WhatsApp Business number through Meta's embedded sign-up so your assistant and your team can chat with customers.", "live"),
    ],
  },
  {
    id: "integration.google_business_profile",
    label: "Google Business Profile connection",
    primaryPillar: "presence",
    implementations: [
      {
        surface: "web",
        status: "beta",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/google-business-profile.provider.ts",
          "peakhour-api:src/v1/integrations/catalog-availability.ts",
          "peakhour-api:src/v1/helpers/platform-env.ts",
        ],
        catalogKeys: ["google_business_profile"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The production catalog list does not show this connection (the dev catalog has it live), so whether production merchants can connect it could not be confirmed.",
          "The Presence features that use it are marked active in the catalog.",
        ],
      },
    ],
    approvedClaims: [
      claim("integration.google_business_profile", "connect_google", "Connect your Google Business Profile with Google sign-in so Peakhour can read your listing, reviews and customer-action figures (calls, directions, website clicks).", "beta"),
    ],
  },
  {
    id: "integration.linkedin",
    label: "LinkedIn connection",
    primaryPillar: "growth",
    secondaryPillars: ["content"],
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/linkedin-content.provider.ts",
          "peakhour-api:src/v1/adapters/publisher/linkedin.ts",
          "peakhour-api:src/v1/integrations/routes.ts",
        ],
        catalogKeys: ["linkedin_content"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Lead delivery from LinkedIn forms is not switched on.",
        ],
      },
    ],
    approvedClaims: [
      claim("integration.linkedin", "connect_linkedin", "Connect LinkedIn to publish, manage and track posts from Peakhour.", "live"),
    ],
  },
  {
    id: "integration.x",
    label: "X connection",
    primaryPillar: "content",
    secondaryPillars: ["growth"],
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/x.provider.ts",
          "peakhour-api:src/v1/adapters/publisher/x.ts",
        ],
        catalogKeys: ["x"],
        verifiedAt: VERIFIED_AT,
      },
    ],
    approvedClaims: [
      claim("integration.x", "connect_x", "Connect X to publish tweets and threads from Peakhour.", "live"),
    ],
  },
  {
    id: "integration.beehiiv",
    label: "Beehiiv connection",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/beehiiv.provider.ts",
          "peakhour-api:src/v1/adapters/publisher/beehiiv.ts",
          "peakhour-api:src/v1/cron/beehiiv-sync.ts",
        ],
        catalogKeys: ["beehiiv"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "It creates drafts in Beehiiv; you send them from Beehiiv.",
        ],
      },
    ],
    approvedClaims: [
      claim("integration.beehiiv", "connect_beehiiv", "Connect Beehiiv with your API key to import past posts and send approved newsletters to Beehiiv as drafts.", "live"),
    ],
  },
  {
    id: "integration.facebook_pages",
    label: "Facebook Pages connection",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/facebook.provider.ts",
          "peakhour-api:src/v1/adapters/publisher/facebook.ts",
          "peakhour-api:src/v1/routes/meta-content/index.ts",
        ],
        catalogKeys: ["facebook_pages"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "One Meta connection covers Pages, Instagram, Meta Ads and WhatsApp.",
          "Publishing only; Messenger is not available.",
        ],
      },
    ],
    approvedClaims: [
      claim("integration.facebook_pages", "post_to_pages", "Connect your Facebook Page and publish approved posts to it.", "live"),
    ],
  },
  {
    id: "integration.instagram",
    label: "Instagram connection (publishing)",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "live",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/facebook.provider.ts",
          "peakhour-api:src/v1/adapters/publisher/instagram.ts",
          "peakhour-api:src/v1/routes/meta-content/index.ts",
        ],
        catalogKeys: ["instagram"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Publishing only: single images and carousels of 2 to 10 images; no video, reels or direct messages.",
          "The dev catalog still lists Instagram as coming soon; the production catalog has it live.",
          "It connects through your Facebook (Meta) connection.",
        ],
      },
    ],
    approvedClaims: [
      claim("integration.instagram", "publish_images", "Publish approved images and carousels to Instagram through your Meta connection.", "live"),
    ],
  },
  {
    id: "integration.google_search_console",
    label: "Google Search Console connection",
    primaryPillar: "content",
    implementations: [
      {
        surface: "web",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/google-search-console.provider.ts",
          "peakhour-api:src/v1/ai/ask/engines/analytics/gsc-tools.ts",
        ],
        catalogKeys: ["gsc"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "Built and read-only, but the production catalog lists it as coming soon (the dev catalog has it live); the owner decides when it is switched on.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "integration.wordpress",
    label: "WordPress connection",
    primaryPillar: "content",
    implementations: [
      {
        surface: "wordpress",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/wordpress.provider.ts",
          "peakhour-api:src/v1/routes/integrations/wp-bridge.ts",
          "peakhour-api:src/v1/cron/wp-autopilot.ts",
          "peakhour-wordpress:peakhour.php",
        ],
        catalogKeys: ["wordpress"],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "The WordPress release is deferred: the catalog lists it as coming soon and no public plugin release could be confirmed.",
          "The plugin writes drafts by default.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
  {
    id: "integration.woocommerce",
    label: "WooCommerce connection",
    primaryPillar: "commerce",
    implementations: [
      {
        surface: "woocommerce",
        status: "development",
        evidence: [
          "peakhour-api:src/v1/integrations/providers/woocommerce.provider.ts",
          "peakhour-api:src/v1/routes/integrations/wp-commerce.ts",
        ],
        verifiedAt: VERIFIED_AT,
        limitations: [
          "WooCommerce is switched off in production in code; there is no WooCommerce row in the production integrations list, although its commerce features are marked active.",
        ],
      },
    ],
    // No claim: not live for production merchants (see limitations).
    approvedClaims: [],
  },
];

const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

export function getCapability(id: string): Capability | undefined {
  return BY_ID.get(id);
}
