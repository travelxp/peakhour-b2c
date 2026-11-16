import { PEAKHOUR_C } from "./peakhour-cmp-c";
import { pending } from "./peakhour";
import { PEAKHOUR_W3A } from "./peakhour-w3a";
import type { CompetitorBrief } from "./types";

const D = "2026-11-16";
const S = {
  home: { href: "https://aftersell.com/", label: "Aftersell home page" },
  pricing: { href: "https://aftersell.com/pricing", label: "Aftersell pricing" },
};

export const AFTERSELL = {
  slug: "aftersell" as const,
  pageId: "shopify.compare.aftersell",
  relatedIds: ["shopify", "shopify.features.cart.upsells", "shopify.features.bundles", "pricing"],
  name: "Aftersell",
  url: "https://aftersell.com/",
  category: "Post-purchase, cart and checkout upsell app for Shopify",
  observedAt: D,
  title: "Peakhour vs Aftersell for Shopify upsells",
  description: "Peakhour cart and thank-you suggestions compared with Aftersell post-purchase and cart upsells on Shopify: offers, tests, setup and pricing, each sourced.",
  h1: "Peakhour vs Aftersell: cart and thank-you upsells on Shopify",
  directAnswer:
    "Aftersell is a dedicated upsell app with one-click post-purchase offers, a customisable cart, thank-you page offers, funnel testing and a recommendation engine on its Complete plan. Peakhour shows cart suggestions and thank-you page links drawn from what customers bought together, and cannot add an item to the order from the thank-you page. If post-purchase and cart upsells are the whole job, Aftersell documents far more. Every answer below links to the vendor's own page and shows the date we read it.",
  buyerUseCases: [
    { title: "One-click offers after checkout", body: "You want a shopper to accept an extra item right after paying." },
    { title: "A cart that sells", body: "You want rewards, free gifts and upsells inside the cart." },
    { title: "Testing offer combinations", body: "You want to try many offers and keep what converts." },
    { title: "Light cart suggestions", body: "You want sensible suggestions without building funnels." },
  ],
  claims: [
    {
      dimension: "One-click post-purchase offers that add to the order",
      vendor: { value: "yes", note: "Its Post-Purchase plan lists post-purchase upsells and one-click offers after checkout.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3A.noOneClickAdd,
    },
    {
      dimension: "Thank-you page offers",
      vendor: { value: "yes", note: "Thank-you page offers are listed on the Post-Purchase and Complete plans.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3A.thankYouLinks,
    },
    {
      dimension: "Cart page suggestions",
      vendor: { value: "yes", note: "Aftersell Cart, with rewards bars, free gifts, conditional upsells, and product page upsells before the cart.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.cartUpsells,
    },
    {
      dimension: "How suggestions are picked",
      vendor: { value: "yes", note: "A recommendation engine with rules based on cart, shopper and product signals is listed on the Complete plan.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_W3A.picks,
    },
    {
      dimension: "A/B tests of offers",
      vendor: { value: "yes", note: "A/B tests of carts, offers and layouts, and multivariate testing on the Post-Purchase plan.", source: S.pricing, observedAt: D },
      peakhour: PEAKHOUR_C.abTesting,
    },
    {
      dimension: "Checkout upsells",
      vendor: { value: "partial", note: "Listed on its Post-Purchase plan, for Shopify Plus only.", source: S.pricing, observedAt: D },
      peakhour: pending(),
    },
    {
      dimension: "Setup without a developer",
      vendor: { value: "yes", note: "Its home page says no code or big dev efforts are needed, and that it is plug and play.", source: S.home, observedAt: D },
      peakhour: pending(),
    },
  ],
  pricing: {
    rows: [
      { plan: "Post-Purchase, 200 orders a month", price: "$34.99 per month, capped at $999.99; 30-day free trial", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Pre-Purchase, 200 orders a month", price: "$59.99 per month, capped at $599.99; 30-day free trial", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Complete, 500 orders a month", price: "$79.99 per month, capped at $1,359.99; 30-day free trial", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Rokt Thanks, unlimited orders", price: "Free; it states stores can earn $0.30 to $0.80 profit per order from partner offers", currency: "USD (bare $, code not stated)", region: "Not stated", observedAt: D, source: S.pricing },
      { plan: "Aftersell Max, high volume", price: "Not published (custom pricing)", currency: "Not stated", region: "Not stated", observedAt: D, source: S.pricing },
    ],
  },
  bestFor: [
    { vendor: "Aftersell", bestFor: "Stores that want a dedicated engine for post-purchase and checkout offers, a rewards cart and thousands of tested offer combinations, and are fine paying by order volume." },
    { vendor: "Peakhour", bestFor: "Shopify merchants who want cart suggestions and thank-you page links drawn from what their own customers bought together, inside one suite, and do not need to add an item to the order after checkout." },
  ],
  limitations: [
    "We read only Aftersell's own public pages, its home and pricing pages. Its Shopify App Store listing was not read for this page. A feature a page does not document is marked Not documented, which is not the same as No.",
    "Its pricing page shows a bare $ with no currency code or region. Plan prices scale with monthly order volume up to a stated cap, and plans and offers change.",
    "Where our own side says Unknown, the evidence for Peakhour is still being verified and nothing is claimed.",
  ],
  faqs: [
    { q: "Is there an Aftersell alternative for Shopify?", a: "Peakhour is one option if you want cart suggestions and thank-you page links from what customers bought together, within a wider suite. If one-click post-purchase offers are your main need, read Aftersell's own pages first." },
    { q: "Where does this information come from?", a: "Only from Aftersell's own public pages, each linked in the table with the date we read it." },
  ],
} satisfies CompetitorBrief;
