import type { FeatureContent } from "@/components/marketing/seo/content-types";
import { pathFor } from "@/lib/seo/resolve";

/*
 * /features/peakhour-summit. Claim used: growth.peakhour_summit.reviews_proposals (beta, web and Shopify). The examples of
 * what it reviews (a budget raise, adding a channel) come from COUNCIL_KINDS in peakhour-api
 * src/v1/services/growth/council/types.ts, not from the claim text; they are listed in the SEO-11 report.
 * Plain "Peakhour Summit": no trademark sign, and never the internal seat names.
 */
export const PEAKHOUR_SUMMIT: FeatureContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Growth", href: pathFor("growth") },
    { label: "Peakhour Summit", href: pathFor("feature.peakhour.summit") },
  ],
  eyebrow: "Growth",
  directAnswer:
    "Peakhour Summit is Peakhour's four-part AI review of growth decisions, such as raising an ad budget or adding a channel. It gives you the case for, the case against, safety checks and a final call, and it only recommends: you approve any change.",
  secondaryCta: { label: "See the four parts", href: "#workflow" },
  status: "beta",
  limitations: [
    "It runs only once its review steps are switched on for your account, so it is not available to every business yet.",
    "Peakhour Summit advises and never applies a change. You approve any change.",
    "Reviews run when autonomous growth is switched on for you.",
  ],
  verifiedAt: "2026-11-15",
  platforms: [
    { surface: "web", label: "Peakhour dashboard", status: "beta", body: "Reviews your growth proposals and lets you ask it a question from the Growth screens." },
    { surface: "shopify", label: "Shopify", status: "beta", body: "The same Peakhour Summit inside the Peakhour app in your Shopify admin.", href: pathFor("shopify") },
  ],
  steps: [
    { title: "The case for", body: "The strongest argument for making the change, so you see why it might be worth it." },
    { title: "The case against", body: "The strongest argument against it, so the risks are on the table before you commit." },
    { title: "Safety checks", body: "Checks on the change before it can go anywhere, so a risky proposal is flagged." },
    { title: "Final call", body: "A recommendation. If it suggests an action, the action waits in Suggested actions until you answer it." },
  ],
  prerequisites: [
    "Autonomous growth switched on for your account.",
    "An editor role or higher to ask it a question, because asking uses Peaks.",
    "Peaks in your wallet if you want to ask your own question.",
  ],
  approvalBoundaries: [
    "Peakhour Summit only recommends. It changes nothing on your ad accounts.",
    "If it suggests an action, that action waits for you in Suggested actions.",
    "You see the price in Peaks before you ask, and a review that could not meet does not charge you.",
  ],
  integrations: [
    { label: "Peakhour Growth", href: pathFor("growth"), note: "The module whose proposals Peakhour Summit reviews." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Ask, approve and undo, across the whole platform." },
    { label: "Peaks", href: pathFor("peaks"), note: "What a question to Peakhour Summit is priced in." },
  ],
  pricingNote:
    "Asking Peakhour Summit your own question is priced in Peaks, and the price is shown to you first, before you press Ask. See Pricing for how Peaks work.",
  faqs: [
    {
      q: "What is Peakhour Summit?",
      a: "It is Peakhour's name for its four-part AI review of growth decisions. A review has four parts: The case for, The case against, Safety checks and Final call.",
    },
    {
      q: "What does Peakhour Summit review?",
      a: "Growth proposals, such as raising a budget or adding a channel, and any question you pay to ask it.",
    },
    {
      q: "Can I ask it my own question?",
      a: "Yes. You write one question, you see its price in Peaks before you ask, and you get the four parts back. A review that could not meet does not charge you.",
    },
    {
      q: "Does it change my ad accounts?",
      a: "No. Peakhour Summit only recommends. If it suggests an action, that action waits for you to approve or decline it.",
    },
    {
      q: "Is it available to everyone?",
      a: "Not yet. It is in beta and runs only for accounts where it has been switched on and where autonomous growth is switched on.",
    },
  ],
  related: [
    { label: "Peakhour Growth", href: pathFor("growth"), note: "Campaigns, LinkedIn leads and budgets, with your approval." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "The ask, approve and undo loop." },
    { label: "Pricing", href: pathFor("pricing"), note: "One plan, with Peaks for the jobs that use AI." },
    { label: "Peaks", href: pathFor("peaks"), note: "What Peaks are and how they are bought." },
  ],
  closing: {
    headline: "Get a second opinion before you spend.",
    body: "Join the waitlist and we will tell you the day Peakhour opens to your business.",
  },
};
