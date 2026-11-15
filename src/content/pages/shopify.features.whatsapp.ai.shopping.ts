import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.whatsapp.ai.shopping";

/**
 * The approved claims this page leans on. commerce.whatsapp_shopping has a WhatsApp record but no Shopify record, so
 * the publish gate cannot pass it on the Shopify surface: the page stays "review" until a Shopify-surface record exists.
 */
export const CLAIMS: PageClaims = ["commerce.whatsapp_shopping.checkout_link"];

const wa = capabilityFacts("commerce.whatsapp_shopping", "whatsapp");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("WhatsApp AI shopping", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "With WhatsApp AI shopping, a shopper messages your own WhatsApp Business number and Peakhour's assistant helps them choose. When they agree to buy, Peakhour sends them a tappable link into your Shopify checkout, where they pay on your store's own checkout page.",
  secondaryCta: { label: "See how to set it up", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "A chat that ends in checkout",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's WhatsApp.",
    tiles: [
      { art: "bottle", tint: "leaf", label: "Steel bottle" },
      { art: "mug", tint: "clay", label: "Clay mug" },
      { art: "bag", tint: "indigo", label: "Canvas bag" },
    ],
  },
  status: wa.status,
  limitations: wa.limitations,
  verifiedAt: wa.verifiedAt,
  sections: [
    {
      id: "checkout-link",
      eyebrow: "From chat to checkout",
      title: "The shopper ends up in your own checkout.",
      paragraphs: [
        "When a shopper agrees to buy on WhatsApp, Peakhour sends a tappable link into your Shopify checkout. When the business is not Shopify-only, the shopper gets a Razorpay payment link (UPI or card) instead.",
        "Payment is not taken inside WhatsApp. The shopper pays on your Shopify checkout page or on the Razorpay link.",
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Connect your WhatsApp number", body: "Connecting happens on the Peakhour website, not inside the Shopify admin. It has to be your own WhatsApp Business number." },
    { title: "Add the number to your storefront", body: "Put the same number on the WhatsApp button in the Shopify theme editor, so shoppers can start a chat." },
    { title: "Try a first chat", body: "Message your number, choose a product, and agree to buy. The link opens your Shopify checkout." },
  ],
  permissions: [
    { name: "read_products", why: "To answer from your catalogue and build the cart link from your real products and variants." },
    { name: "read_inventory", why: "To say whether a product is in stock before the shopper agrees to buy." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Does the shopper pay inside WhatsApp?",
      a: "No. The shopper pays on your Shopify checkout page, or on a Razorpay link when the business is not Shopify-only. Payment is not taken inside WhatsApp.",
    },
    {
      q: "Do I need my own WhatsApp number?",
      a: "Yes. WhatsApp shopping needs your own WhatsApp Business number connected.",
    },
    {
      q: "What happens when a shopper replies after 24 hours?",
      a: "Replies sent more than 24 hours after the shopper's last message need a template that Meta has approved.",
    },
    {
      q: "When does the shopper get a Razorpay link instead of a Shopify link?",
      a: "The Shopify cart link is sent only when every store on the account is Shopify. Otherwise the shopper gets a Razorpay link for UPI or card.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.ai.shopping.assistant", "AI shopping assistant for Shopify", "The same assistant on your storefront."),
    ...siblingLink(ID, "shopify.features.whatsapp.cod.confirmation", "WhatsApp COD confirmation for Shopify", "Confirm cash-on-delivery orders on the same number."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
