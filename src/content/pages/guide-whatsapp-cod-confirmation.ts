import type { GuideContent } from "@/components/marketing/seo/content-types";
import { getPage } from "@/lib/seo/pages";
import { pathFor } from "@/lib/seo/resolve";

/*
 * /shopify/guides/whatsapp-cod-confirmation, "review". Claim used: commerce.cod_confirmation.ask_on_whatsapp (live on Shopify)
 * and its limitations. The steps are read from peakhour-api src/v1/services/commerce/cod-lane.ts, cod-sweep and
 * services/cod-writes, and peakhour-shopify src/pages/cod.ts, src/lib/cod.ts, src/lib/cod-writes.ts.
 */

/** The feature page SEO-8 builds. Linked through the registry once it is registered; the audit's path until then. */
const FEATURE_PAGE_ID = "shopify.features.whatsapp.cod.confirmation";
function featurePath(): string {
  try {
    getPage(FEATURE_PAGE_ID);
    return pathFor(FEATURE_PAGE_ID);
  } catch {
    return "/shopify/features/whatsapp-cod-confirmation";
  }
}

export const COD_GUIDE: GuideContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Shopify", href: pathFor("shopify") },
    { label: "Set up WhatsApp COD confirmation", href: pathFor("shopify.guides.whatsapp.cod.confirmation") },
  ],
  eyebrow: "Guide for Shopify",
  directAnswer:
    "To confirm cash-on-delivery orders on Shopify, connect your own WhatsApp Business number to Peakhour and get its confirmation message approved by Meta. From then on Peakhour asks each new cash-on-delivery shopper on WhatsApp to confirm or cancel, and marks orders nobody answers after 24 hours.",
  secondaryCta: { label: "See the setup steps", href: "#guide-setup" },
  author: "Peakhour",
  reviewer: "Pending review",
  updatedAt: "2026-11-15",
  sections: [
    {
      id: "why",
      heading: "Why confirm cash-on-delivery orders",
      paragraphs: [
        "With cash on delivery the shopper pays at the door, so nothing has been paid when the order arrives. A shopper who never meant to take the parcel costs you the shipping out and the shipping back, and the stock is out of sale until it returns.",
        "Asking the shopper first is the cheapest check there is. Peakhour does it for you on WhatsApp the moment the order is placed, and shows you the orders nobody answered, so you decide what to do about them before the parcel ships.",
      ],
    },
    {
      id: "need",
      heading: "What you need",
      paragraphs: ["Four things have to be true before the first confirmation goes out."],
      list: [
        "A Shopify store that takes cash-on-delivery orders, with Peakhour installed.",
        "Your own WhatsApp Business number, connected to Peakhour. Confirmations are sent from your number, not from a shared one.",
        "A confirmation message that Meta has approved. WhatsApp reviews every message template before it can be sent, and a template must have the status APPROVED before it can be used.",
        "Your business name set in Peakhour Settings, because the message opens by naming your shop.",
      ],
    },
    {
      id: "default-off",
      heading: "What is off until you switch it on",
      paragraphs: [
        "Peakhour asking the shopper on WhatsApp does not change anything in your Shopify store. Changing the order itself, by tagging it, holding it until the shopper answers or releasing it on a yes, is called Shopify write-back, and it is off by default.",
        "To turn it on you switch on COD orders in Autopilot and approve the extra order permission when Shopify asks, which it does when you reopen Peakhour from your Shopify admin. The emergency stop, if you have it on, blocks it.",
      ],
    },
    {
      id: "setup",
      heading: "Set it up",
      paragraphs: ["Do these in order. The Cash on delivery page in the Peakhour app tells you what is still missing, so you can check your progress as you go."],
      list: [
        "Step 1. Install Peakhour from the Shopify App Store and open it from your Shopify admin.",
        "Step 2. Open Channels, connect your WhatsApp Business number and pick the number to send from.",
        "Step 3. Open Settings and add your business name if it is empty.",
        "Step 4. Wait for Meta to approve the confirmation message. If the Cash on delivery page says Meta has not approved the message yet, there is nothing to do but wait; confirmations start by themselves once it clears. Meta says a review can take up to 24 hours.",
        "Step 5. Optional: in Autopilot, switch on COD orders and approve the new Shopify permission if you want Peakhour to tag and hold orders.",
        "Step 6. Place a test cash-on-delivery order using a WhatsApp number you own, and check that the confirmation message reaches it.",
      ],
    },
    {
      id: "what-happens",
      heading: "What happens to each order",
      paragraphs: [
        "When a cash-on-delivery order arrives, Peakhour sends the shopper a WhatsApp message asking them to confirm or cancel. It asks once per order.",
        "If the shopper answers, the outcome appears in your Orders queue. If nobody answers, Peakhour marks the order unconfirmed after 24 hours. It checks once an hour, so an order can show as unconfirmed up to an hour after its deadline.",
      ],
    },
    {
      id: "unanswered",
      heading: "Unanswered and cancelled orders",
      paragraphs: [
        "Peakhour never cancels an order because a shopper said No or said nothing. An unconfirmed order waits in your queue for you to check.",
        "A cancel happens only when you press Cancel in the app, and only if you have switched write-back on and granted the permission. Shopify does not reopen a cancelled order, so a cancel cannot be undone.",
      ],
    },
    {
      id: "limits",
      heading: "The limits",
      paragraphs: ["Know these before you rely on it."],
      list: [
        "It needs your WhatsApp number connected and the confirmation message approved by Meta.",
        "Orders placed before you fixed a missing connection, approval or setting were not asked, and fixing it starts confirmations for new orders only.",
        "It cannot see whether a shopper who tapped pay online actually paid.",
        "An order with no phone number, or a number Peakhour cannot dial, is not asked.",
        "It runs on Shopify. WooCommerce is not available.",
      ],
    },
  ],
  sources: [
    {
      label: "Meta: WhatsApp message templates",
      href: "https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates",
      note: "Templates must be approved before they can be sent; review can take up to 24 hours.",
    },
  ],
  faqs: [
    { q: "Do I need my own WhatsApp number?", a: "Yes. Confirmations go out from your own WhatsApp Business number, which you connect under Channels." },
    { q: "Why have my confirmations not started?", a: "Usually Meta has not approved the message yet, WhatsApp is not connected, or your business name is not set. The Cash on delivery page in the Peakhour app names the reason." },
    { q: "Does Peakhour cancel orders for me?", a: "No. It never cancels on a No or on silence. A cancel happens only when you press Cancel in the app, with write-back switched on." },
    { q: "Does it change my Shopify orders?", a: "Only if you switch write-back on and grant the extra permission. It is off by default." },
  ],
  related: [
    { label: "WhatsApp COD confirmation for Shopify", href: featurePath(), note: "What the feature does and where it stands." },
    { label: "Peakhour for Shopify", href: pathFor("shopify"), note: "Install the app and see everything it does." },
    { label: "Peakhour for fashion and apparel stores", href: pathFor("industries.fashion.apparel"), note: "Where cash-on-delivery confirmation fits a fashion store." },
    { label: "Pricing", href: pathFor("pricing"), note: "One plan, with Peaks for the jobs that use AI." },
  ],
  closing: { headline: "Ask before you ship.", body: "Install Peakhour on Shopify and connect your WhatsApp number." },
};
