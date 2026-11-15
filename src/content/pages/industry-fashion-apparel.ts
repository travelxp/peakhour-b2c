import type { IndustryContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";

/*
 * /industries/fashion-apparel, a DRAFT ("review") until it has industry-specific evidence (Bible 7.3, 7.6).
 * Claims used, all on the Shopify surface:
 *   commerce.product_recommendations (shelves, eleven kinds), commerce.find_my_match (quick questions),
 *   commerce.ai_shopping_assistant (answers from your catalogue), commerce.cod_confirmation (ask on WhatsApp).
 * No size-and-fit claim exists, so the page does not make one. No statistics.
 */
export const FASHION_APPAREL: IndustryContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Industries", href: pathFor("industries") },
    { label: "Fashion and apparel", href: pathFor("industries.fashion.apparel") },
  ],
  eyebrow: "Industry",
  directAnswer:
    "For a Shopify fashion store, Peakhour builds product shelves such as Complete the look, lets shoppers answer a few quick questions to get a shortlist, answers their questions from your own catalogue, and asks cash-on-delivery shoppers to confirm on WhatsApp.",
  secondaryCta: { label: "See the use cases", href: "#use-cases" },
  proof: {
    kind: "sample",
    title: "Shelf: complete the look",
    caption: "Sample store art, not a real store. A shelf of the kind Smart Rails builds, with items that go with the one being viewed.",
    tiles: [
      { art: "kurta", tint: "indigo", label: "Indigo kurta" },
      { art: "scarf", tint: "rose", label: "Silk scarf" },
      { art: "bag", tint: "marigold", label: "Jute tote" },
    ],
  },
  problem:
    "A fashion catalogue multiplies by size, colour and season, so shoppers have more to choose from and more to ask before they buy. Stores that take cash on delivery also have orders that nobody confirms, and a parcel that comes back is stock that is out of sale until it returns.",
  useCases: [
    {
      pillar: "Commerce",
      title: "Complete the look shelf",
      body: "Complete the look is one kind of product shelf Peakhour builds on Shopify. It pairs a product with items of a different type that shoppers bought alongside it in your own past orders. A store with too few past orders gets no list.",
    },
    {
      pillar: "Commerce",
      title: "Find my match",
      body: "Shoppers tap Find my match and answer a few quick questions, made from your store's own product attributes and price range, to get a shortlist. They can skip any question.",
    },
    {
      pillar: "Commerce",
      title: "Answers from your catalogue",
      body: "The shopping assistant answers shoppers from your real catalogue and policies inside Shopify. It answers only as well as your product data does, so fit and size details help only if they are in it.",
    },
    {
      pillar: "Commerce",
      title: "Confirm cash-on-delivery orders",
      body: "For stores that take cash on delivery, Peakhour asks the shopper on WhatsApp to confirm or cancel, marks unanswered orders after 24 hours and shows every outcome in your Orders queue.",
    },
    {
      pillar: "Commerce",
      title: "Smart Rails for the rest of the range",
      body: "Choose from 11 kinds of product shelf, such as bestsellers, trending, new arrivals, price drops, back in stock, low stock and recently viewed.",
    },
  ],
  integrations: [
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "Everything the Shopify app does." },
    { label: "Peakhour Commerce", href: pathFor("commerce"), note: "The module behind the shelves and the assistant." },
    { label: "Set up WhatsApp COD confirmation", href: pathFor("shopify.guides.whatsapp.cod.confirmation"), note: "The steps for a cash-on-delivery store." },
  ],
  risks: [
    "This page makes no claim about sales, conversion or return rates. Peakhour has no fashion-specific results to publish yet.",
    "Size and fit answers are only as good as the size and fit information in your product data.",
    "Find my match is part of the shopping assistant, not a separate quiz builder. It asks 3 to 4 questions and needs at least two values for an attribute to ask about it.",
    "WhatsApp confirmation needs your own WhatsApp Business number connected and a confirmation message approved by Meta. It never cancels an order on its own.",
    "Shelves that rely on past orders need enough orders to work from.",
  ],
  platforms: [
    { surface: "shopify", label: "Shopify", status: "live", body: "Shelves, Find my match, the assistant and COD confirmation run inside your Shopify admin and theme editor.", href: pathFor("shopify") },
    {
      surface: "woocommerce",
      label: "WooCommerce",
      status: "development",
      body: "Built, but switched off for production merchants.",
      limitations: ["Nothing to install yet."],
    },
  ],
  faqs: [
    { q: "Does Peakhour work for fashion stores?", a: "Yes, on Shopify. The shelves, Find my match, the shopping assistant and WhatsApp COD confirmation are all live there, and none depends on the kind of product you sell." },
    { q: "Does the assistant answer size and fit questions?", a: "It answers from your own catalogue and policies. If your product pages state sizes and fit, it can use them; Peakhour does not add fit advice of its own." },
    { q: "Do I need cash on delivery to use Peakhour?", a: "No. WhatsApp confirmation is only for stores that take cash on delivery. The shelves, Find my match and the assistant do not need it." },
    { q: "Will this raise my sales or cut my returns?", a: "Peakhour does not promise a result, and this page states no figures." },
  ],
  related: [
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "The app, its features and how to install it." },
    { label: "Peakhour Commerce", href: pathFor("commerce"), note: "The Commerce module in full." },
    { label: "Set up WhatsApp COD confirmation", href: pathFor("shopify.guides.whatsapp.cod.confirmation"), note: "A step-by-step guide." },
    { label: "Pricing", href: pathFor("pricing"), note: "One plan, with Peaks for the jobs that use AI." },
  ],
  closing: { headline: "See it on your own catalogue.", body: "Install Peakhour on Shopify and try the shelves on your real products." },
};
