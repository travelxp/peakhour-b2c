import type { HubContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";
import { liveItem, platformItem } from "./hub-helpers";

/** /commerce. Every card is built from an approved claim in src/lib/seo/capabilities.ts (see hub-helpers). */
export const COMMERCE: HubContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Commerce", href: pathFor("commerce") },
  ],
  eyebrow: "Commerce",
  directAnswer:
    "Peakhour Commerce is an AI shopping assistant for your Shopify store and your WhatsApp number. It answers shoppers from your real catalogue, builds product shelves, confirms cash-on-delivery orders and warns you before a product runs out. WooCommerce is coming soon.",
  secondaryCta: { label: "See Peakhour for Shopify", href: pathFor("shopify") },
  items: [
    liveItem("commerce.ai_shopping_assistant.answers_from_catalogue", "shopify", "Shopping assistant", 0),
    liveItem("commerce.whatsapp_shopping.checkout_link", "whatsapp", "Shopping on WhatsApp", 0),
    liveItem("commerce.product_recommendations.eleven_shelf_kinds", "shopify", "Product shelves", 1),
    liveItem("commerce.frequently_bought_together.from_orders", "shopify", "Bought together", 1),
    liveItem("commerce.buy_together_bundles.percent_off", "shopify", "Buy together and save", 1),
    liveItem("commerce.cart_upsells.cart_and_thank_you", "shopify", "Cart and thank-you suggestions", 0),
    liveItem("commerce.rail_ab_testing.compare_two_strategies", "shopify", "Shelf A/B tests", 1),
    liveItem("commerce.find_my_match.quick_questions", "shopify", "Find my match", 0),
    liveItem("commerce.cod_confirmation.ask_on_whatsapp", "shopify", "Cash-on-delivery confirmation", 0),
    liveItem("commerce.inventory_alerts.forecast_alert", "shopify", "Inventory alerts", 0),
    liveItem("commerce.automatic_markdowns.apply_on_press", "shopify", "Markdowns you approve", 0),
    liveItem("commerce.manage_store_from_whatsapp.approvals_and_summary", "whatsapp", "Your store on WhatsApp", 0),
  ],
  platforms: [
    platformItem(
      "commerce.ai_shopping_assistant",
      "shopify",
      "Shopify",
      "The assistant, shelves, COD confirmation and inventory alerts run inside your Shopify store.",
      { href: pathFor("shopify"), limit: 0 },
    ),
    platformItem(
      "commerce.ai_shopping_assistant",
      "whatsapp",
      "WhatsApp",
      "Shoppers ask on your own WhatsApp Business number, and you can take over any chat.",
      { limit: 0 },
    ),
    platformItem(
      "commerce.ai_shopping_assistant",
      "woocommerce",
      "WooCommerce",
      "The WooCommerce assistant is built and not switched on for stores yet.",
    ),
  ],
  control: [
    "You switch the chat on in your theme editor, and you can pause it or take over any chat.",
    "Changes the shelf engine suggests wait for your approval.",
    "A cash-on-delivery order is cancelled only when you press Cancel in the app.",
    "Markdowns change prices only when you preview and press Apply, and each one can be undone.",
  ],
  comingSoonNote: "",
  faqs: [
    {
      q: "Does it work with WooCommerce?",
      a: "Not yet. The WooCommerce version is built, but it is not switched on for stores, so Peakhour Commerce runs on Shopify and WhatsApp today.",
    },
    {
      q: "Can shoppers pay inside WhatsApp?",
      a: "No. The shopper pays on your Shopify checkout page, or on a Razorpay link when the business is not Shopify-only.",
    },
    {
      q: "Does the assistant place orders by itself?",
      a: "No. It answers from your catalogue and policies and sends the shopper to checkout; it does not place orders on your storefront.",
    },
    {
      q: "What does it cost to run?",
      a: "Each AI answer uses Peaks, the AI credits in Peakhour Suite. See the pricing page for the monthly allowance.",
    },
  ],
  related: [
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "Every Shopify feature, install and billing in one place." },
    { label: "Peakhour pricing", href: pathFor("pricing"), note: "One plan for all five modules, with Peaks included." },
    { label: "Support", href: pathFor("support"), note: "What the assistant could not answer, and what is coming." },
    { label: "Growth", href: pathFor("growth"), note: "Plan and review the ads that bring shoppers in." },
  ],
  closing: {
    headline: "Let the assistant answer, and keep the decisions.",
    body: "Start with your Shopify store or your WhatsApp number. You approve what changes, and you can take over any chat.",
  },
};
