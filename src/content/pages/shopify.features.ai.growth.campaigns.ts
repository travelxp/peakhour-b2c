import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, DEMO, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.ai.growth.campaigns";

export const CLAIMS: PageClaims = ["growth.ai_growth_campaigns.approved_campaigns"];

const campaigns = capabilityFacts("growth.ai_growth_campaigns");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Campaign discounts", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "When you approve a Peakhour campaign, it puts the products on a storefront shelf and, if you have switched campaign discounts on, creates a Shopify discount that ends on schedule. Approving a campaign sends nothing to shoppers by itself.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  proof: {
    kind: DEMO,
    title: "Campaign to approve",
    caption: "Demo. Product art from a sample store, not a screenshot of a real merchant's campaign.",
    tiles: [
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
      { art: "mug", tint: "clay", label: "Clay mug" },
    ],
  },
  status: campaigns.status,
  limitations: campaigns.limitations,
  verifiedAt: campaigns.verifiedAt,
  sections: [
    {
      id: "campaign-discounts",
      eyebrow: "Campaign discounts",
      title: "A suggestion with a reason, and you decide.",
      paragraphs: [
        "Peakhour suggests a campaign for a product that is ready to push, with the offer and the reason. You approve it or skip it.",
        "An approved campaign puts its products on a storefront shelf. The Shopify discount is created only if you switched campaign discounts on and granted the discount permission, and it ends on its deadline. Undoing the campaign switches the discount off.",
      ],
    },
    {
      id: "whatsapp-reminders",
      eyebrow: "WhatsApp reminders",
      title: "Reminders go only to shoppers who opted in.",
      paragraphs: [
        "When a shopper who opted in to WhatsApp leaves items in their cart, Peakhour can send a reminder with a link back to it, and one more a day later if you choose. It is off until you turn it on, and anyone can reply STOP.",
        "You can also send an offer to opted-in shoppers on WhatsApp. Before anything is sent, you see how many people it reaches and an estimate of Meta's cost, and a broadcast cannot be undone once it starts. It needs an approved marketing template, and Meta bills its fees to you directly with no Peakhour markup.",
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Read the suggestion", body: "Open the campaign Peakhour suggests, read the offer and its reason, and approve it or skip it." },
    { title: "Decide on the discount", body: "To have Peakhour create the Shopify discount, switch campaign discounts on in Autopilot and approve the discount permission. Otherwise you get the suggestion to act on yourself." },
    { title: "Add WhatsApp reminders", body: "Connect your own WhatsApp number and turn on Send cart reminders. Broadcasts are composed in your Peakhour dashboard." },
  ],
  permissions: [
    { name: "write_discounts", why: "Only if you switch campaign discounts on: to create the Shopify discount for an approved campaign, and to switch it off when it ends or you undo it." },
    { name: "read_products", why: "To put the campaign's products on a shelf with their real names, prices and images." },
    { name: "read_orders", why: "For cart reminders: to see abandoned checkouts." },
    { name: "read_customers", why: "For cart reminders: to read a shopper's phone number and WhatsApp consent. The number is held in memory for one send and never stored." },
  ],
  globalPage: { label: "Peakhour Growth", href: "/growth" },
  faqs: [
    {
      q: "Does approving a campaign message my shoppers?",
      a: "No. Approving a campaign sends nothing to shoppers by itself.",
    },
    {
      q: "Is the discount created automatically?",
      a: "Only if you switched campaign discounts on and granted the discount permission. It ends on its deadline, and you can undo it.",
    },
    {
      q: "Who can receive a WhatsApp message?",
      a: "Only shoppers who opted in. A shopper counts as opted in when they agreed to WhatsApp marketing from your store in Shopify, or sent START to your WhatsApp number.",
    },
    {
      q: "What does WhatsApp cost?",
      a: "Meta bills its fees to you directly, and Peakhour adds no markup. Broadcasts need an approved marketing template.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.automatic.markdowns", "Markdown suggestions for Shopify", "A price change you preview and apply yourself."),
    ...siblingLink(ID, "shopify.features.product.recommendations", "Smart Rails product recommendations", "The shelves a campaign's products appear on."),
    ...siblingLink(ID, "shopify.features.bundles", "Buy together and save for Shopify", "A standing saving on products bought together."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
