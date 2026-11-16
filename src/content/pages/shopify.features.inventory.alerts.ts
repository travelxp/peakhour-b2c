import type { ShopifyFeatureContent } from "@/components/marketing/seo/content-types";
import { ADD_STORE_CLOSING, capabilityFacts, featureCrumbs, PRICING_LINK, SHOPIFY_HOME_LINK, siblingLink, type PageClaims } from "./shopify-feature-kit";

const ID = "shopify.features.inventory.alerts";

export const CLAIMS: PageClaims = ["commerce.inventory_alerts.forecast_alert", "commerce.inventory_alerts.po_sheet"];

const inventory = capabilityFacts("commerce.inventory_alerts");

export const CONTENT: ShopifyFeatureContent = {
  crumbs: featureCrumbs("Stock-out alerts", ID),
  eyebrow: "Peakhour for Shopify",
  directAnswer:
    "Peakhour WhatsApps you when a selling product is forecast to run out before a reorder could arrive. The Inventory page also builds a per-vendor purchase-order sheet you can print or download. Nothing is sent to your vendor.",
  secondaryCta: { label: "See how it works", href: "#setup" },
  status: inventory.status,
  limitations: inventory.limitations,
  verifiedAt: inventory.verifiedAt,
  sections: [
    {
      id: "alerts",
      eyebrow: "The alert",
      title: "A WhatsApp message before a product runs out.",
      paragraphs: [
        "Peakhour looks at how fast a product has been selling and how long your vendor takes to deliver. When it is forecast to run out inside that time, you are told once, on WhatsApp.",
        "You get at most one message per store each time Peakhour checks, naming up to three products, and the same product is not repeated within a week. The emergency stop silences the alerts.",
        "Without a verified WhatsApp contact, nothing is sent. The same forecast still shows on the Inventory page, and the alerts start once WhatsApp is connected.",
      ],
    },
    {
      id: "purchase-orders",
      eyebrow: "Purchase-order sheets",
      title: "A sheet for each vendor.",
      paragraphs: [
        "On the Inventory page, pick the products to reorder and Peakhour builds a purchase-order sheet for each vendor. Print it, or download it as a CSV file, and send it yourself.",
        "Nothing is sent to your vendor, and there is no automatic reordering.",
      ],
    },
  ],
  setupSteps: [
    { title: "Install Peakhour", body: "Add Peakhour from the Shopify App Store and approve the permissions listed on this page." },
    { title: "Connect WhatsApp", body: "Verify your own WhatsApp contact in Peakhour, so the alerts have somewhere to go." },
    { title: "Check Inventory", body: "Open Inventory in the Peakhour app to see what is running low, and set each vendor's lead time and the days of stock you want to hold." },
    { title: "Print the order", body: "Pick the products to order, open the purchase-order sheet and print it or download the CSV." },
  ],
  permissions: [
    { name: "read_products", why: "To name each product and its vendor on alerts and purchase-order sheets." },
    { name: "read_inventory", why: "To see how many units you have left." },
    { name: "read_orders", why: "To see how fast each product sells, for the run-out forecast." },
    { name: "read_customers", why: "Shopify asks for it with any order read. The forecast uses order line items and dates, not shopper details." },
  ],
  globalPage: { label: "Peakhour Commerce", href: "/commerce" },
  faqs: [
    {
      q: "Does Peakhour reorder stock for me?",
      a: "No. It builds a purchase-order sheet that you print or download. Nothing is sent to your vendor, and there is no automatic reordering.",
    },
    {
      q: "How are alerts sent?",
      a: "On WhatsApp only, once a week per product, to a verified WhatsApp contact. Email is not used.",
    },
    {
      q: "What if I have not connected WhatsApp?",
      a: "No alert is sent, but the same forecast shows on the Inventory page. Connect WhatsApp and the alerts start.",
    },
    {
      q: "Does it work on stores that are not on Shopify?",
      a: "Not yet. Stock-out alerts and purchase-order sheets are for Shopify stores.",
    },
  ],
  related: [
    ...siblingLink(ID, "shopify.features.automatic.markdowns", "Markdown suggestions for Shopify", "For the products that are not selling, the other side of stock."),
    ...siblingLink(ID, "shopify.features.whatsapp.cod.confirmation", "WhatsApp COD confirmation for Shopify", "Another job that runs on your WhatsApp number."),
    SHOPIFY_HOME_LINK,
    PRICING_LINK,
  ],
  closing: ADD_STORE_CLOSING,
};
