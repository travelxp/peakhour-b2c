import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.whatsapp.cod.confirmation";

export const CLAIMS: PageClaims = ["commerce.cod_confirmation.ask_on_whatsapp"];

const cod = capabilityFacts("commerce.cod_confirmation");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("WhatsApp COD confirmation", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "When a cash-on-delivery order arrives on your Shopify store, Peakhour asks the shopper on WhatsApp to confirm or cancel it. Orders nobody answers are marked after 24 hours, and every outcome shows in your Orders queue. It is for cash-on-delivery stores, wherever they sell, and it needs your own WhatsApp number.",
  secondaryCta: { label: "See what you need first", href: "#status" },
  proof: {
    kind: DEMO,
    title: "Cash-on-delivery orders",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's orders.",
    tiles: [
      { art: "mug", tint: "clay", label: "Order 1042" },
      { art: "bottle", tint: "leaf", label: "Order 1043" },
      { art: "bag", tint: "indigo", label: "Order 1044" },
    ],
  },
  status: cod.status,
  limitations: cod.limitations,
  verifiedAt: cod.verifiedAt,
  sections: [
    {
      id: "what-happens",
      eyebrow: "What happens to each order",
      title: "Ask, wait, and show you the result.",
      paragraphs: ["Every cash-on-delivery order goes through the same four steps, and you see where each one ended up."],
      items: [
        { title: "The order arrives", body: "A cash-on-delivery order is placed on your Shopify store." },
        { title: "The shopper is asked", body: "Peakhour messages the shopper on WhatsApp to confirm or cancel." },
        { title: "Silence is marked", body: "An order with no reply after 24 hours is marked as unanswered." },
        { title: "You see every outcome", body: "Confirmed, cancelled and unanswered orders all show in your Orders queue." },
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Connect your WhatsApp number", body: "Connect your own WhatsApp Business number on the Peakhour website. Without it, no confirmations go out." },
    { title: "Wait for Meta to approve the message", body: "The confirmation message is a template, and Meta has to approve it before Peakhour can send it." },
    { title: "Watch the first orders", body: "The next cash-on-delivery order is asked about on WhatsApp, and its outcome shows in your Orders queue." },
  ],
  permissions: [
    { name: "read_orders", why: "To see new cash-on-delivery orders and where each one stands." },
    { name: "read_customers", why: "Shopify requires it with any order read. Peakhour uses the shopper's phone number to send the WhatsApp message." },
    { name: "write_orders", why: "Only if you switch on tagging, or press Cancel yourself: to tag confirmed and declined orders, and to cancel one when you press Cancel." },
    { name: "write_merchant_managed_fulfillment_orders", why: "Only if you switch it on: to hold a parcel until the shopper answers, and release it afterwards." },
    { name: "write_order_edits", why: "Only for the optional pay online offer, if you switch it on: to apply a percentage discount to one pending cash-on-delivery order." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Does it cancel an order when the shopper says no, or does not answer?",
      a: "No. It never cancels on a No or on silence by itself. A cancel only happens when you press Cancel in the app.",
    },
    {
      q: "Does it hold or tag the order in Shopify?",
      a: "Only if you switch that on and grant the extra Shopify permissions. Until then, Peakhour asks the shopper and shows you the outcome, and leaves the order in Shopify as it is.",
    },
    {
      q: "What do I need before it works?",
      a: "Your own WhatsApp Business number connected, and the confirmation message template approved by Meta.",
    },
    {
      q: "Can it tell whether a shopper who tapped pay online actually paid?",
      a: "No. It cannot see whether a shopper who tapped pay online actually paid.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.whatsapp.ai.shopping", "WhatsApp AI shopping for Shopify", "Sell on the same WhatsApp number."),
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "Answers shoppers' questions on your storefront."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
